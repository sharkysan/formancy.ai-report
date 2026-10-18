import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodePdfmake from 'pdfmake'
import browserPdfmake from 'pdfmake/build/pdfmake.js'
import vfs from 'pdfmake/build/vfs_fonts.js'
import type { ContentSvg, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { ALL_FIXTURES, E_INVOICE, inflatedDigest, readAnnotations, readCodes, readPdf, readPdfObjects, SVG_FIXTURES, verify, verifyRefusal } from '@formancy/report-corpus'
import { resolveReport, type ResolvedDocument } from '@formancy/report-runtime'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import type * as billFonts from './bill-fonts.js'
import { renderPdf as renderInBrowser } from './browser.js'
import { renderPdf as renderInNode } from './node.js'
import { converterOptions } from './svg-content.js'
import { billDocument, resolvedBill, SIX_EXAMPLES } from './testing/bills.js'
import { documentOf, fixture, paragraph, TIMEOUT } from './testing/documents.js'
import { encodePng } from './testing/images.js'
import { DRAWINGS, MARK, rawSvgAsset, svg, SVG_THREATS, svgAsset } from './testing/svg.js'

/**
 * The browser entry, run here in Node: pdfmake's browser build with its
 * virtual-file fonts, behind the same renderer as the Node entry. What this
 * shows is that the two entries hand pdfmake the same definitions and get
 * the same pages back, and that the browser entry reaches no Node module.
 * It does not show the browser build in a browser: that is the Studio's
 * browser gate's, once there is one.
 */

const here = path.dirname(fileURLToPath(import.meta.url))

/** EPC069-12 v3.1's first example, in a 30 mm square with Austria's caption. */
const EPC_CODE = {
  kind: 'epcQrCode',
  id: 'pay-code',
  payload: ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'Franz Mustermänn', 'DE71110220330123456789', 'EUR12.3', 'GDDS', 'RF18539007547034'].join('\n'),
  size: 85.04,
  caption: 'zahlenMitCode',
} as const

// The browser build warns, under Node, that it has no local-access policy to
// set: a browser has no local files for it to guard. Silenced here, and held
// to being that warning and no other.
let warn: MockInstance<typeof console.warn>
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(() => {
  const warnings = new Set(warn.mock.calls.map((call) => String(call[0])))
  warn.mockRestore()
  expect([...warnings].filter((each) => !each.startsWith('No local access policy defined'))).toEqual([])
})

/** The de-DE e-invoice sample, resolved by the runtime in a final render: a document that carries its XML. */
function eInvoiceDocument(): ResolvedDocument {
  const outcome = resolveReport(E_INVOICE.report, E_INVOICE.data, { mode: 'final', parameters: E_INVOICE.parameters, creationDate: '2026-10-16T08:00:00Z' })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
  return outcome.document
}

/** The SHA-256 of the ICC's sRGB2014.icc, which the licence guard reviewed in pdfkit's file (`e-invoice.test.ts`). */
const SRGB2014 = '384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a'

/** A definition as pdfmake was handed it, before pdfmake changes it in place: every function by its source, and the page header and footer by what they lay out on pages 2 and 3 of 3, the last of which holds a payment part's slip. */
function serialised(definition: TDocumentDefinitions): string {
  const regions = [definition.header, definition.footer].flatMap((region) => [2, 3].map((page) => (typeof region === 'function' ? region(page, 3, { width: 0, height: 0, orientation: 'portrait' }) : region)))
  return JSON.stringify({ definition, regions }, (_, value: unknown) => (typeof value === 'function' ? `function ${String(value)}` : value))
}

/** Every definition `render` hands `pdfmake`, in order. */
async function definitions(pdfmake: typeof nodePdfmake, render: () => Promise<unknown>): Promise<string[]> {
  const seen: string[] = []
  const createPdf = pdfmake.createPdf.bind(pdfmake)
  const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
    seen.push(serialised(definition))
    return createPdf(definition, options)
  })
  try {
    await render().catch(() => undefined)
  } finally {
    spy.mockRestore()
  }
  return seen
}

describe('the browser entry', () => {
  // Two entries that built their definitions apart could disagree about a
  // page break and nobody would find out until a browser preview and a
  // server's PDF differed. Every pass of every fixture: the measuring passes
  // and the PDF, refusals included.
  test('hands pdfmake the definitions the Node entry does, for every fixture', async () => {
    for (const each of [...ALL_FIXTURES, ...SVG_FIXTURES]) {
      const options = { maxPages: each.maxPages }
      const inNode = await definitions(nodePdfmake, () => renderInNode(each.document, options))
      const inBrowser = await definitions(browserPdfmake as unknown as typeof nodePdfmake, () => renderInBrowser(each.document, options))
      expect(inBrowser.length, each.id).toBe(inNode.length)
      expect(inBrowser, each.id).toEqual(inNode)
    }
  }, TIMEOUT)

  // The same definitions through another build of pdfmake are still another
  // engine's output: each fixture is proved on the PDF it produced, with the
  // corpus's checks, as the Node entry's are.
  test('renders every fixture of the corpus as its checks expect, or refuses it as they allow', async () => {
    for (const each of [...ALL_FIXTURES, ...SVG_FIXTURES]) {
      const rendered = await renderInBrowser(each.document, { maxPages: each.maxPages }).then(
        (bytes) => ({ bytes }),
        (error: unknown) => ({ error }),
      )
      const problems = 'error' in rendered ? verifyRefusal(each, rendered.error) : verify(each, await readPdf(rendered.bytes))
      expect(problems, each.id).toEqual([])
    }
  }, TIMEOUT)

  // The pages themselves: every run of text and every image where the Node
  // entry puts it.
  test('puts every run and image where the Node entry does', async () => {
    const { document, maxPages } = fixture('group-boundary')
    const [inNode, inBrowser] = await Promise.all([renderInNode(document, { maxPages }), renderInBrowser(document, { maxPages })])
    const pages = async (bytes: Uint8Array): Promise<unknown> => (await readPdf(bytes)).pages
    expect(await pages(inBrowser)).toEqual(await pages(inNode))
  }, TIMEOUT)

  // The corpus's fixtures hold no QR code, which the trial's engines did
  // not draw. A code the browser encoded or placed otherwise than Node
  // would scan to something else in a preview than in the PDF a server
  // sends: the same definitions, in the body and in the page footer, and
  // the same code read back from both.
  test('hands pdfmake the definitions the Node entry does for QR codes, which read back the same', async () => {
    const document = { ...documentOf('Codes', [paragraph('Pay with the code'), { kind: 'qrCode', id: 'payment', text: 'Grüezi 9,99 € 🧾', size: 90, errorCorrection: 'Q' } as const]), pageFooter: [{ kind: 'qrCode', id: 'footer', text: 'INV-2026-0042', size: 40, errorCorrection: 'M' } as const] }
    const options = { maxPages: 5 }
    const inNode = await definitions(nodePdfmake, () => renderInNode(document, options))
    const inBrowser = await definitions(browserPdfmake as unknown as typeof nodePdfmake, () => renderInBrowser(document, options))
    expect(inBrowser).toEqual(inNode)
    const codes = await readCodes(await renderInBrowser(document, options), 1)
    expect(codes.map(({ text, ecLevel }) => ({ text, ecLevel }))).toEqual([
      { text: 'Grüezi 9,99 € 🧾', ecLevel: 'Q' },
      { text: 'INV-2026-0042', ecLevel: 'M' },
    ])
    expect(codes).toEqual(await readCodes(await renderInNode(document, options), 1))
  }, TIMEOUT)

  // A slip the browser drew otherwise than Node would show a payer one
  // thing in the Studio's preview and another in the PDF a server sends:
  // the same definitions, the slip in the last page's footer among them,
  // the same code read back, and every run where Node puts it.
  test('hands pdfmake the definitions the Node entry does for a QR-bill, which prints the same', async () => {
    const document = billDocument(resolvedBill(SIX_EXAMPLES.two), [paragraph('Invoice 2026-0042')])
    const options = { maxPages: 5 }
    const inNode = await definitions(nodePdfmake, () => renderInNode(document, options))
    const inBrowser = await definitions(browserPdfmake as unknown as typeof nodePdfmake, () => renderInBrowser(document, options))
    expect(inBrowser).toEqual(inNode)
    const [nodeBytes, browserBytes] = [await renderInNode(document, options), await renderInBrowser(document, options)]
    expect((await readCodes(browserBytes, 1)).map(({ text }) => text)).toEqual([document.paymentPart!.payload])
    expect(await readCodes(browserBytes, 1)).toEqual(await readCodes(nodeBytes, 1))
    expect((await readPdf(browserBytes)).pages).toEqual((await readPdf(nodeBytes)).pages)
  }, TIMEOUT)

  // An EPC QR code's caption is text in Liberation Sans, which pdfmake's
  // SVG converter draws from the font table. A browser that drew it
  // otherwise than Node, or in another face, would show a payer another
  // code in the Studio's preview than the PDF a server sends: the same
  // definitions, the same code read back, the caption in Liberation Sans,
  // and every run where Node puts it.
  test('hands pdfmake the definitions the Node entry does for a captioned EPC QR code, which prints the same', async () => {
    const document = documentOf('EPC', [paragraph('Zahlbar ohne Abzug'), EPC_CODE])
    const options = { maxPages: 5 }
    const inNode = await definitions(nodePdfmake, () => renderInNode(document, options))
    const inBrowser = await definitions(browserPdfmake as unknown as typeof nodePdfmake, () => renderInBrowser(document, options))
    expect(inBrowser).toEqual(inNode)
    const [nodeBytes, browserBytes] = [await renderInNode(document, options), await renderInBrowser(document, options)]
    expect((await readCodes(browserBytes, 1)).map(({ text }) => text)).toEqual([EPC_CODE.payload])
    expect(await readCodes(browserBytes, 1)).toEqual(await readCodes(nodeBytes, 1))
    const read = await readPdf(browserBytes)
    expect(read.pages).toEqual((await readPdf(nodeBytes)).pages)
    expect(read.pages[0]!.items.filter((item) => item.angle === 90).map((item) => item.text)).toEqual(['Zahlen mit Code'])
    expect(read.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, '')).sort()).toEqual(['LiberationSans', 'Roboto-Regular'])
  }, TIMEOUT)

  // A browser preview that differs from itself on every render cannot be
  // compared with anything.
  test('renders the same document to the same bytes', async () => {
    const { document, maxPages } = fixture('images')
    const [first, second] = await Promise.all([renderInBrowser(document, { maxPages }), renderInBrowser(document, { maxPages })])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  })

  // An e-invoice drawn in a browser is the same invoice a server draws:
  // the same definitions, PDF/A-3b's version and subset among them, the
  // runtime's XML embedded byte for byte, its output intent's profile the
  // reviewed sRGB2014, and every object the Node entry draws, each stream
  // inflated -- the pages, the XMP, the information dictionary, the /ID,
  // the output intent and the version. Not the same bytes: the browser
  // build deflates with a zlib of its own, and its PDF of the e-invoice
  // sample was 37,307 bytes where Node's was 37,578 (measured on 18
  // October 2026). The profile comes from another place here -- base64
  // inside pdfmake's browser build (`build/pdfmake.js` 20777), which the
  // licence guard cannot read inside a script (0006) -- so a test through
  // the Node entry alone would pass whatever the browser build carried.
  test('hands pdfmake the definitions the Node entry does for an e-invoice, which embeds the same XML beside the reviewed profile', async () => {
    const document = eInvoiceDocument()
    const options = { maxPages: 5 }
    const inNode = await definitions(nodePdfmake, () => renderInNode(document, options))
    const inBrowser = await definitions(browserPdfmake as unknown as typeof nodePdfmake, () => renderInBrowser(document, options))
    expect(inBrowser).toEqual(inNode)
    expect(inBrowser.at(-1)).toContain('"version":"1.7","subset":"PDF/A-3b"')
    const [nodeBytes, browserBytes] = [await renderInNode(document, options), await renderInBrowser(document, options)]
    const [node, browser] = [await readPdfObjects(nodeBytes), await readPdfObjects(browserBytes)]
    expect(browser.associatedFiles.map((file) => Buffer.from(file.embedded?.bytes ?? []).toString('utf8'))).toEqual([document.eInvoice!.xml])
    expect(browser.outputIntents.map((intent) => createHash('sha256').update(intent.profile?.bytes ?? new Uint8Array()).digest('hex'))).toEqual([SRGB2014])
    expect(browser.associatedFiles).toEqual(node.associatedFiles)
    expect(await inflatedDigest(browserBytes)).toBe(await inflatedDigest(nodeBytes))
  }, TIMEOUT)

  // An e-invoice is found again by its digest, or by nothing: the file's
  // dates are the document's, and the XMP holds no clock and no random id.
  test('renders an e-invoice to the same bytes', async () => {
    const document = eInvoiceDocument()
    const [first, second] = await Promise.all([renderInBrowser(document, { maxPages: 5 }), renderInBrowser(document, { maxPages: 5 })])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  }, TIMEOUT)

  // The fonts the browser entry embeds are base64 inside a script, which
  // the dependency-licence guard cannot read (0006). They are the very
  // bytes of the four font files it does read, as OFL-1.1.
  test('embeds the Roboto of pdfmake’s font files, byte for byte', () => {
    const fonts = path.join(path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts', 'Roboto')
    for (const file of ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf']) {
      expect(Buffer.from(vfs[file] ?? '', 'base64').equals(readFileSync(path.join(fonts, file))), file).toBe(true)
    }
  })

  // The slip's Liberation Sans reaches a browser as base64 inside a script
  // the build makes of the package's own font files, which the
  // dependency-licence guard reads as OFL-1.1 and cannot see inside a
  // script (0006). They are those files' very bytes.
  test('embeds the Liberation Sans of the package’s own font files, byte for byte', async () => {
    const { LIBERATION_SANS } = await import('./bill-fonts.js')
    const fonts = path.join(here, '..', 'fonts')
    expect(Buffer.from(LIBERATION_SANS.normal, 'base64').equals(readFileSync(path.join(fonts, 'LiberationSans-Regular.ttf')))).toBe(true)
    expect(Buffer.from(LIBERATION_SANS.bold, 'base64').equals(readFileSync(path.join(fonts, 'LiberationSans-Bold.ttf')))).toBe(true)
  })

  // A pdfmake whose vfs_fonts.js no longer carries a face would leave the
  // font table naming a virtual file that is not there, and fail somewhere
  // in PDFKit with an error about it. It fails here, naming the face.
  test('says which face is missing when pdfmake’s virtual fonts lack one', async () => {
    const fonts = vfs as Record<string, string>
    const medium = fonts['Roboto-Medium.ttf']!
    delete fonts['Roboto-Medium.ttf']
    try {
      await expect(renderInBrowser(fixture('one-row').document, { maxPages: 5 })).rejects.toThrow("pdfmake's vfs_fonts.js has no Roboto-Medium.ttf")
    } finally {
      fonts['Roboto-Medium.ttf'] = medium
    }
  })

  // A browser has no `node:` modules and no Node build of pdfmake: a value
  // import of either anywhere the browser entry reaches breaks every app
  // that bundles it. And the slip's fonts, over a megabyte as base64,
  // reach an app only through an import made the first time a document has
  // a payment part or a captioned EPC QR code: imported statically, every
  // host's bundle would carry them, a host that never prints either among
  // them. Read from the sources, following each relative import; that the
  // import is made only then is held below.
  test('reaches no Node module and no Node build of pdfmake, and Liberation Sans only through an import of its own', () => {
    const reach = (entry: string): { readonly files: Set<string>; readonly external: Set<string>; readonly dynamic: Set<string> } => {
      const [files, external, dynamic] = [new Set<string>(), new Set<string>(), new Set<string>()]
      const visit = (file: string): void => {
        if (files.has(file)) return
        files.add(file)
        const source = readFileSync(path.join(here, file), 'utf8')
        // `import x from 'y'` and `import 'y'`, but not `import type`, which leaves nothing behind.
        for (const [, specifier] of source.matchAll(/^import (?!type )(?:[^'"]*from )?'([^']+)'/gm)) {
          if (specifier!.startsWith('./')) visit(specifier!.slice(2).replace(/\.js$/, '.ts'))
          else external.add(specifier!)
        }
        for (const [, specifier] of source.matchAll(/^export (?!type )[^'"]*from '([^']+)'/gm)) external.add(specifier!)
        for (const [, specifier] of source.matchAll(/\bimport\('([^']+)'\)/g)) dynamic.add(specifier!)
      }
      visit(entry)
      return { files, external, dynamic }
    }
    const browser = reach('browser.ts')
    expect([...browser.external].sort()).toEqual(['@formancy/report-runtime', 'pdfmake/build/pdfmake.js', 'pdfmake/build/vfs_fonts.js', 'uqr'])
    expect([...browser.dynamic]).toEqual(['./bill-fonts.js'])
    expect(browser.files.has('bill-fonts.ts')).toBe(false)
    const fonts = reach('bill-fonts.ts')
    expect([...fonts.external].sort()).toEqual(['../fonts/LiberationSans-Bold.ttf', '../fonts/LiberationSans-Regular.ttf'])
    expect(fonts.dynamic.size).toBe(0)
  })
})

describe('an SVG asset in a browser', () => {
  // pdfmake's browser build bundles a converter of its own, beside the one
  // Node's runs: a browser that drew a logo otherwise than Node would show
  // one drawing in the Studio's preview and another in the PDF a server
  // sends. The same definitions, the drawing in the body and in the page
  // header, and the same paths and clips on every page, read by the
  // corpus's reader, which follows the transparency groups a clip path
  // draws into: read from the page's own content stream alone, the clipped
  // drawing was one painted shape of its three, and a browser that drew
  // the other two otherwise would have passed.
  test('hands pdfmake the definitions the Node entry does, which draw the same', async () => {
    const document = { ...documentOf('Mark', [paragraph('Body'), { kind: 'image', asset: svgAsset(DRAWINGS.clips!, 'clips'), width: 80, height: 80, fit: 'cover' } as const]), pageHeader: [{ kind: 'image', asset: svgAsset(MARK), width: 30, height: 30, fit: 'contain' } as const] }
    const options = { maxPages: 5 }
    const inNode = await definitions(nodePdfmake, () => renderInNode(document, options))
    const inBrowser = await definitions(browserPdfmake as unknown as typeof nodePdfmake, () => renderInBrowser(document, options))
    expect(inBrowser).toEqual(inNode)
    const drawn = async (pdf: Uint8Array): Promise<unknown> => (await readPdf(pdf)).pages.map(({ paths, clips }) => ({ paths, clips }))
    const drawnInBrowser = await renderInBrowser(document, options)
    const drawnInNode = await renderInNode(document, options)
    expect(await drawn(drawnInBrowser)).toEqual(await drawn(drawnInNode))
    // The mark's three paths in the header, and the clipped drawing's three in the body: what the groups hold is read.
    expect((await readPdf(drawnInNode)).pages[0]!.paths.length).toBeGreaterThanOrEqual(6)
    expect(await readAnnotations(drawnInBrowser)).toEqual([])
  }, TIMEOUT)

  // The threats reach the browser entry as they reach Node's, through a
  // host that never cleaned them: each is refused, naming the asset, before
  // the browser build is asked to make anything.
  test('refuses every hazard as it came before pdfmake runs, as Node does', async () => {
    const created = vi.spyOn(browserPdfmake, 'createPdf')
    try {
      for (const threat of SVG_THREATS) {
        const document = { ...documentOf('Threat', [paragraph('Body')]), body: [{ kind: 'image', asset: rawSvgAsset(threat.bytes, 'threat'), width: 40, height: 40, fit: 'contain' } as const] }
        const [inBrowser, inNode] = await Promise.all([renderInBrowser(document, { maxPages: 1 }).catch((error: unknown) => error), renderInNode(document, { maxPages: 1 }).catch((error: unknown) => error)])
        expect(inBrowser, threat.name).toMatchObject({ code: 'invalid-asset', subject: 'threat' })
        expect(inBrowser, threat.name).toEqual(inNode)
      }
      expect(created).not.toHaveBeenCalled()
    } finally {
      created.mockRestore()
    }
  }, TIMEOUT)

  // The browser build's converter opens an <image>'s href in pdfmake's
  // virtual files, where a host may have put its own and the renderer puts
  // its fonts (0030): handed one, it embeds it. The renderer's
  // image callback refuses the asset instead.
  test('refuses an image the browser build would open from its virtual files', async () => {
    await renderInBrowser(fixture('one-row').document, { maxPages: 5 })
    browserPdfmake.addVirtualFileSystem({ 'host-secret.png': Buffer.from(encodePng(4, 4, () => [255, 0, 0])).toString('base64') })
    const node = (options?: object): ContentSvg & { readonly options?: object } => ({ svg: svg('<image href="host-secret.png" width="10" height="10"/>'), width: 40, height: 40, ...(options === undefined ? {} : { options }) })
    const pdf = new Uint8Array(await (browserPdfmake.createPdf({ content: [node()] }) as unknown as { getBuffer(): Promise<Uint8Array> }).getBuffer())
    expect((await readPdf(pdf)).pages[0]!.images).toHaveLength(1)
    await expect((browserPdfmake.createPdf({ content: [node(converterOptions('virtual', 'contain'))] }) as unknown as { getBuffer(): Promise<Uint8Array> }).getBuffer()).rejects.toMatchObject({ code: 'invalid-asset', subject: 'virtual' })
  }, TIMEOUT)
})

describe('the slip’s fonts in a browser', () => {
  /** A browser entry of its own, which has loaded no chunk yet, with `bill-fonts.js` as `factory` makes it. */
  async function freshEntry(factory: () => Pick<typeof billFonts, 'LIBERATION_SANS'>): Promise<typeof renderInBrowser> {
    vi.resetModules()
    vi.doMock('./bill-fonts.js', factory)
    return (await import('./browser.js')).renderPdf
  }
  const bill = (): ReturnType<typeof billDocument> => billDocument(resolvedBill(SIX_EXAMPLES.two), [paragraph('Invoice 2026-0042')])
  afterEach(() => {
    vi.doUnmock('./bill-fonts.js')
    vi.resetModules()
  })

  // A chunk that failed to load once -- a network that dropped, a deploy
  // that replaced it -- kept as failed would fail every later bill until
  // the page reloaded. The bill it failed for fails; the next one loads the
  // chunk again, and prints its slip.
  test('are loaded again by the next bill after a load that failed', async () => {
    const renderPdf = await freshEntry(() => {
      throw new Error('the chunk did not load')
    })
    // Vitest's own error, an import that rejects as a chunk's does, carrying the factory's.
    await expect(renderPdf(bill(), { maxPages: 5 })).rejects.toHaveProperty('cause.message', 'the chunk did not load')
    vi.doUnmock('./bill-fonts.js')
    const document = bill()
    expect((await readCodes(await renderPdf(document, { maxPages: 5 }), 1)).map(({ text }) => text)).toEqual([document.paymentPart!.payload])
  }, TIMEOUT)

  // A host that prints neither a bill nor a captioned EPC QR code never
  // loads the chunk, whose megabyte it would fetch for nothing: a page of
  // text, and an EPC QR code without its caption, print in Roboto alone.
  // The first captioned code is what loads it. Counted by the getter, as
  // below.
  test('are never loaded by a document with neither a bill nor a captioned EPC QR code', async () => {
    let loads = 0
    const { LIBERATION_SANS } = await import('./bill-fonts.js')
    const renderPdf = await freshEntry(() => ({
      get LIBERATION_SANS() {
        loads += 1
        return LIBERATION_SANS
      },
    }))
    const { caption: _caption, ...uncaptioned } = EPC_CODE
    await renderPdf(documentOf('Text', [paragraph('Invoice 2026-0042')]), { maxPages: 5 })
    const read = await readPdf(await renderPdf(documentOf('EPC', [uncaptioned]), { maxPages: 5 }))
    expect(read.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, ''))).toEqual(['Roboto-Regular'])
    expect(loads).toBe(0)
    await renderPdf(documentOf('EPC', [EPC_CODE]), { maxPages: 5 })
    expect(loads).toBe(1)
  }, TIMEOUT)

  // A host that prints EPC QR codes and never a bill still prints their
  // captions in Liberation Sans: the first captioned code loads the chunk,
  // as the first bill does. Not loaded, the face is not in pdfmake's
  // virtual files, and the caption is not drawn in it.
  test('are loaded by the first captioned EPC QR code, though no bill asks for them', async () => {
    let loads = 0
    const { LIBERATION_SANS } = await import('./bill-fonts.js')
    const renderPdf = await freshEntry(() => ({
      get LIBERATION_SANS() {
        loads += 1
        return LIBERATION_SANS
      },
    }))
    const read = await readPdf(await renderPdf(documentOf('EPC', [EPC_CODE]), { maxPages: 5 }))
    expect(loads).toBe(1)
    expect(read.pages[0]!.items.filter((item) => item.angle === 90).map((item) => item.text)).toEqual(['Zahlen mit Code'])
    expect(read.fonts.map((font) => font.name)).toContainEqual(expect.stringMatching(/\+LiberationSans$/))
  }, TIMEOUT)

  // A chunk imported for every bill would decode and parse two fonts each
  // time: once it has loaded, every later bill prints from it. The faces
  // are read off the chunk once for each import, which the getter counts.
  // The bills print one after another: Vitest hands an import made while
  // another of the same mock is under way the module itself, not the mock
  // (its mocker says so), and that import would go uncounted; the bills
  // that ask at the same time share one load in engine.test.ts.
  test('are loaded once, by the first bill, however many follow', async () => {
    let loads = 0
    const { LIBERATION_SANS } = await import('./bill-fonts.js')
    const renderPdf = await freshEntry(() => ({
      get LIBERATION_SANS() {
        loads += 1
        return LIBERATION_SANS
      },
    }))
    for (let each = 0; each < 3; each += 1) await renderPdf(bill(), { maxPages: 5 })
    expect(loads).toBe(1)
  }, TIMEOUT)
})
