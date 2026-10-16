import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodePdfmake from 'pdfmake'
import browserPdfmake from 'pdfmake/build/pdfmake.js'
import vfs from 'pdfmake/build/vfs_fonts.js'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { ALL_FIXTURES, readCodes, readPdf, verify, verifyRefusal } from '@formancy/report-corpus'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { renderPdf as renderInBrowser } from './browser.js'
import { renderPdf as renderInNode } from './node.js'
import { documentOf, fixture, paragraph, TIMEOUT } from './testing/documents.js'

/**
 * The browser entry, run here in Node: pdfmake's browser build with its
 * virtual-file fonts, behind the same renderer as the Node entry. What this
 * shows is that the two entries hand pdfmake the same definitions and get
 * the same pages back, and that the browser entry reaches no Node module.
 * It does not show the browser build in a browser: that is the Studio's
 * browser gate's, once there is one.
 */

const here = path.dirname(fileURLToPath(import.meta.url))

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

/** A definition as pdfmake was handed it, before pdfmake changes it in place: every function by its source, and the page header and footer by what they lay out on page 2 of 3. */
function serialised(definition: TDocumentDefinitions): string {
  const regions = [definition.header, definition.footer].map((region) => (typeof region === 'function' ? region(2, 3, { width: 0, height: 0, orientation: 'portrait' }) : region))
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
    for (const each of ALL_FIXTURES) {
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
    for (const each of ALL_FIXTURES) {
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

  // A browser preview that differs from itself on every render cannot be
  // compared with anything.
  test('renders the same document to the same bytes', async () => {
    const { document, maxPages } = fixture('images')
    const [first, second] = await Promise.all([renderInBrowser(document, { maxPages }), renderInBrowser(document, { maxPages })])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  })

  // The fonts the browser entry embeds are base64 inside a script, which
  // the dependency-licence guard cannot read (0006). They are the very
  // bytes of the four font files it does read, as OFL-1.1.
  test('embeds the Roboto of pdfmake’s font files, byte for byte', () => {
    const fonts = path.join(path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts', 'Roboto')
    for (const file of ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf']) {
      expect(Buffer.from(vfs[file] ?? '', 'base64').equals(readFileSync(path.join(fonts, file))), file).toBe(true)
    }
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
  // that bundles it. Read from the sources, following each relative import.
  test('reaches no Node module and no Node build of pdfmake', () => {
    const external = new Set<string>()
    const visit = (file: string, seen: Set<string>): void => {
      if (seen.has(file)) return
      seen.add(file)
      const source = readFileSync(path.join(here, file), 'utf8')
      // `import x from 'y'` and `import 'y'`, but not `import type`, which leaves nothing behind.
      for (const [, specifier] of source.matchAll(/^import (?!type )(?:[^'"]*from )?'([^']+)'/gm)) {
        if (specifier!.startsWith('./')) visit(specifier!.slice(2).replace(/\.js$/, '.ts'), seen)
        else external.add(specifier!)
      }
      for (const [, specifier] of source.matchAll(/^export (?!type )[^'"]*from '([^']+)'/gm)) external.add(specifier!)
    }
    visit('browser.ts', new Set())
    expect([...external].sort()).toEqual(['@formancy/report-runtime', 'pdfmake/build/pdfmake.js', 'pdfmake/build/vfs_fonts.js', 'uqr'])
  })
})
