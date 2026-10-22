import { createHash } from 'node:crypto'
import fs, { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import pdfmake from 'pdfmake'
import type { ContentSvg, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { readAnnotations, readPdf, readPdfObjects, readXmp } from '@formancy/report-corpus'
import { describe, expect, test, vi } from 'vitest'
import { collect, type PdfStream } from './engine.js'
import { renderPdf } from './node.js'
import { PDF_A_3B, type PdfKitDocument, type PdfKitFileOptions } from './pdfa.js'
import { converterOptions } from './svg-content.js'
import { fixture } from './testing/documents.js'
import { readDrawing } from './testing/drawing.js'
import { dataUrl, DECODED, imageOrder, SIDE } from './testing/decoding.js'
import { invoiced } from './testing/e-invoice.js'
import { encodePng } from './testing/images.js'
import { MARK, svg, svgAsset } from './testing/svg.js'

/**
 * pdfmake as the Node entry configures it, and the PDF read from it.
 */

const attempt = (source: string): Promise<Buffer> => pdfmake.createPdf({ images: { source }, content: [{ image: 'source', width: 10, height: 10 }] }).getBuffer()

describe('pdfmake as the renderer configures it', () => {
  // The renderer's documents name no file and no address, but pdfmake reads
  // either when a definition names one. Its policies are what would stop a
  // definition that reached it from reading the server's files or calling
  // out: set by the renderer, they allow the four font files and nothing else.
  test('reads no file but its fonts, and no address at all', async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    await expect(attempt('https://example.invalid/logo.png')).rejects.toThrow(/Access to URL denied/)
    await expect(attempt(fileURLToPath(import.meta.url))).rejects.toThrow(/Access to local file denied/)
  })

  // pdfmake's fonts and policies are one setting for the whole process. A
  // host that configured pdfmake for something else -- every file and
  // address allowed, no fonts -- must not change what the renderer renders
  // with: it sets its own again for every render, so the render still embeds
  // Roboto, and afterwards pdfmake still reads nothing else.
  test('sets its fonts and policies again for each render, over what anything else set', async () => {
    pdfmake.setFonts({})
    pdfmake.setLocalAccessPolicy(() => true)
    pdfmake.setUrlAccessPolicy(() => true)
    const pdf = await readPdf(await renderPdf(fixture('one-row').document, { maxPages: 5 }))
    expect(pdf.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, ''))).toContain('Roboto-Regular')
    expect(pdf.fonts.filter((font) => !font.embedded)).toEqual([])
    await expect(attempt(fileURLToPath(import.meta.url))).rejects.toThrow(/Access to local file denied/)
    await expect(attempt('https://example.invalid/logo.png')).rejects.toThrow(/Access to URL denied/)
  })

  // A host face goes into pdfmake's virtual files for one render and out
  // again afterwards, since the files are process-wide and pdfmake has no
  // delete: its VirtualFileSystem keeps them in a plain `storage` object,
  // which the renderer writes a key into and deletes (engine.ts's
  // registerHostFonts). Were pdfmake to hold them elsewhere, or to stop
  // exposing `storage`, a process would leak every host font it ever drew,
  // and this fails first.
  test('keeps its virtual files in a storage object a key can be deleted from', () => {
    const { virtualfs } = pdfmake as unknown as { virtualfs: { storage: Record<string, unknown>; existsSync(name: string): boolean } }
    expect(typeof virtualfs.storage).toBe('object')
    const name = 'formancy-report-render-pdf/font/pin.ttf'
    virtualfs.storage[name] = new Uint8Array([1, 2, 3])
    expect(virtualfs.existsSync(name)).toBe(true)
    delete virtualfs.storage[name]
    expect(virtualfs.existsSync(name)).toBe(false)
  })

  // A PDF/A's output intent is the ICC profile PDFKit reads from its own
  // `data` folder with `fs`, past pdfmake's policy, as it ends the
  // document (pdfkit.js 5265): the one file beside the fonts a render
  // reads (0031, amending 0005), and only an e-invoice's. A host that
  // bundles the Node entry must copy it there, as it does the fonts. Were
  // PDFKit to read anything else -- its standard fonts' metrics, a second
  // profile -- or a plain report to read the profile, this fails first.
  test('reads, for an e-invoice alone, the ICC profile PDFKit ships besides the fonts, and nothing else', async () => {
    const pdfkit = path.dirname(createRequire(createRequire(import.meta.url).resolve('pdfmake')).resolve('pdfkit'))
    const profile = path.join(pdfkit, 'data', 'sRGB_IEC61966_2_1.icc')
    const fonts = path.join(path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts', 'Roboto')
    const reads = async (document: Parameters<typeof renderPdf>[0]): Promise<string[]> => {
      const spy = vi.spyOn(fs, 'readFileSync')
      try {
        await renderPdf(document, { maxPages: 5 })
        return [...new Set(spy.mock.calls.map(([file]) => path.resolve(String(file))))].sort()
      } finally {
        spy.mockRestore()
      }
    }
    const { document } = fixture('one-row')
    const plain = await reads(document)
    expect(plain.length).toBeGreaterThan(0)
    expect(plain.filter((file) => path.dirname(file) !== fonts)).toEqual([])
    expect(await reads(invoiced(document))).toEqual([...plain, path.resolve(profile)].sort())
  })
})

describe("pdfmake's measuring, which the renderer reads", () => {
  // The word check reads each text node's widest word from the _minWidth
  // pdfmake writes onto it, in the function pdfmake calls for the first
  // page's background, before it lays out a line (words.ts). Were pdfmake
  // to stop writing it, or to call that function first, every word would
  // pass unchecked; this fails first.
  test("has written each text node's widest word by the time it asks for the first background", async () => {
    // A render leaves pdfmake configured with the renderer's fonts and policies.
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const node = { text: 'short WWWWWWWWWW tail' }
    const lone = { text: 'WWWWWWWWWW' }
    const seen: unknown[] = []
    await pdfmake
      .createPdf({
        content: [node, lone],
        defaultStyle: { font: 'Roboto' },
        background: (page) => {
          if (page === 1) seen.push((node as { _minWidth?: unknown })._minWidth, (lone as { _maxWidth?: unknown })._maxWidth)
          return null
        },
      })
      .getBuffer()
    expect(typeof seen[0]).toBe('number')
    expect(seen[0]).toBeCloseTo(seen[1] as number, 6)
  })
})

describe("PDFKit's images that decode before they embed, which the renderer writes in order", () => {
  // The hazard 0035 works around, in pdfmake alone: PDFKit numbers an
  // image's soft mask, and writes the image, when its decode finishes
  // (pdfkit.js 3926-3996), so a small image's mask takes the first number
  // and is written first, before a large one's drawn above it -- in 200 of
  // 200 renders (19 October 2026). The renderer's `image-order.ts` holds
  // its own PDFs to the order pdfmake opened their images; once PDFKit
  // numbers and writes its images as it opens them, this fails, and that
  // can go.
  test("numbers and writes a small image's soft mask before a large one's drawn above it", async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const bytes = await pdfmake
      .createPdf({ images: { large: dataUrl(DECODED.alpha), small: dataUrl(DECODED.small) }, content: [{ image: 'large', width: 100 }, { image: 'small', width: 100 }], defaultStyle: { font: 'Roboto' } })
      .getBuffer()
    const { widths, masks, masksAt, drawnAt } = await imageOrder(new Uint8Array(bytes))
    expect(widths).toEqual([SIDE.alpha, SIDE.small])
    expect(masks).toHaveLength(2)
    expect(masks[0]).toBeGreaterThan(masks[1]!)
    expect(masksAt[0]).toBeGreaterThan(masksAt[1]!)
    expect(drawnAt[0]).toBeGreaterThan(drawnAt[1]!)
  })
})

describe("pdfmake's positions, which the table rules read", () => {
  // A block's rule reads the page its last row starts on from the row's
  // cell itself (build.ts's pageOf), because pdfmake's queries walk every
  // node to the end of the document for each rule. pdfmake records each
  // node's positions on the node, and corrects the page of one with an id
  // that an unbreakable block moved to the next page; this fails first if
  // either stops.
  test('records each node’s pages on it, and corrects a moved one with an id', async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const filler = Array.from({ length: 70 }, (_, index) => ({ text: `Line ${index}`, fontSize: 9 }))
    const moved = { text: 'moved', id: 'moved' }
    const seen: (number | undefined)[] = []
    await pdfmake
      .createPdf({
        content: [...filler, { stack: [{ text: 'kept' }, moved], unbreakable: true }],
        defaultStyle: { font: 'Roboto' },
        pageBreakBefore: (node) => {
          if (node.id === 'moved') seen.push(node.startPosition.pageNumber, (moved as { positions?: { pageNumber: number }[] }).positions?.[0]?.pageNumber)
          return false
        },
      })
      .getBuffer()
    expect(seen).toEqual([2, 2])
  })
})

describe("pdfmake's footer, which a QR-bill's slip is drawn as", () => {
  // The slip is the last page's footer (definition.ts): pdfmake lays the
  // footer out once every page is, knowing their count, in a box as tall as
  // the bottom margin, and content placed absolutely above that box's top
  // has the room down to the paper's foot. Were pdfmake to stop calling the
  // footer with the count, or to measure that room from the box, a slip
  // would be drawn on the wrong page or lose its lower lines without a
  // word; this fails first.
  test('lays out content placed above the footer’s top on the last page, with the room down to the paper’s foot', async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const lines = Array.from({ length: 30 }, (_, index) => ({ text: `Slip line ${index}`, fontSize: 10, lineHeight: 1 }))
    const calls: (readonly [number, number])[] = []
    const bytes = await pdfmake
      .createPdf({
        pageSize: { width: 595.28, height: 841.89 },
        pageMargins: [40, 40, 40, 40],
        content: [{ text: 'Body', pageBreak: 'after' }, { text: 'More' }],
        defaultStyle: { font: 'Roboto' },
        footer: (page, count) => {
          calls.push([page, count])
          return page === count ? { stack: lines, absolutePosition: { x: 40, y: -320 } } : null
        },
      })
      .getBuffer()
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ])
    const pdf = await readPdf(new Uint8Array(bytes))
    expect(pdf.pages[0]!.items.filter((item) => item.text.startsWith('Slip line'))).toEqual([])
    const drawn = pdf.pages[1]!.items.filter((item) => item.text.startsWith('Slip line'))
    expect(drawn).toHaveLength(30)
    // Roboto's line is 2400 of its 2048 units, its ascender 1900: the first line's top 320 pt above the footer's, at 841.89 - 40.
    const baseline = (item: (typeof drawn)[number]): number => item.bottom - 0.2 * item.height
    expect(baseline(drawn[0]!)).toBeCloseTo(841.89 - 40 - 320 + (1900 / 2048) * 10, 2)
    expect(baseline(drawn[29]!) - baseline(drawn[0]!)).toBeCloseTo(29 * (2400 / 2048) * 10, 2)
  })
})

describe("pdfmake's SVG converter, which draws an SVG asset", () => {
  /** `node`, an SVG node, alone on an A4 page 40 pt in from the left and the top, as pdfmake 0.3.11 draws it once a render has configured it. */
  async function drawn(node: ContentSvg & { readonly options?: object }): Promise<Uint8Array> {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    return new Uint8Array(await pdfmake.createPdf({ pageSize: 'A4', pageMargins: [40, 40, 40, 40], content: [node] }).getBuffer())
  }
  const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1')
  const count = (bytes: Uint8Array, pattern: RegExp): number => (latin1(bytes).match(pattern) ?? []).length

  // svg-to-pdfkit opens an <image>'s href as a file through PDFKit, which
  // pdfmake's local access policy does not guard: the renderer's allows
  // its fonts alone, and the file is embedded all the same. That is what
  // the renderer's image callback, and the check before it, exist for; an
  // upgrade that guards it shows here.
  test("opens an <image>'s local file past pdfmake's local access policy", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'report-render-pdf-'))
    try {
      const file = path.join(directory, 'secret.png').split(path.sep).join('/')
      writeFileSync(file, encodePng(4, 4, () => [255, 0, 0]))
      const pdf = await drawn({ svg: svg(`<image href="${file}" width="10" height="10"/>`), width: 40, height: 40 })
      expect((await readPdf(pdf)).pages[0]!.images).toHaveLength(1)
      await expect(attempt(file)).rejects.toThrow(/Access to local file denied/)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  // pdfmake measures an SVG by reading it with xmldoc, and hands the
  // converter what xmldoc writes back, with the box's size added: the
  // drawing re-indented, one element a line, and otherwise as written. The
  // canonical form holds nothing xmldoc and the converter's own reader could
  // read apart -- no text, no entity, no DOCTYPE, no prefix -- so the
  // second reading is of the same tree; a pdfmake that rewrote more would
  // show here.
  test('hands the converter what xmldoc writes back: re-indented, with the box’s size', async () => {
    const text = new TextDecoder().decode(svgAsset(MARK).bytes)
    const node = { svg: text, width: 42.52, height: 42.52 }
    await drawn(node)
    const elements = text.slice(text.indexOf('>') + 1, text.lastIndexOf('</svg>')).replace(/(?<=\/>)(?=<)/g, '\n  ')
    expect(node.svg).toBe(`${text.slice(0, text.indexOf('>'))} width="42.52" height="42.52">\n  ${elements}\n</svg>`)
  })

  // Without a warning callback the converter says what it cannot draw to
  // the console and draws on, otherwise than written: a clip path that
  // clips itself is drawn without its clip. The renderer's callback refuses
  // instead (`svg-threats.test.ts`).
  test('warns to the console and draws on, without a warning callback', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const pdf = await drawn({ svg: svg('<clipPath id="c"><rect clip-path="url(#c)" width="1" height="1"/></clipPath><rect width="10" height="10" clip-path="url(#c)"/>'), width: 40, height: 40 })
      expect(pdf.length).toBeGreaterThan(0)
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual(['SVGtoPDF: loop of circular references for id "c"'])
    } finally {
      warn.mockRestore()
    }
  })

  // `cover` is drawn as `xMidYMid slice`, past the box, and the outer
  // svg's viewport clips it: the converter sets a clip of exactly the box
  // before it draws. Were it to stop, a covered logo would paint over what
  // stands beside it.
  test('clips the drawing to its viewport, the box', async () => {
    const [page] = readDrawing(await drawn({ svg: svg('<rect width="200" height="100" fill="#1f4e79"/>', '0 0 200 100'), width: 40, height: 40, options: { preserveAspectRatio: 'xMidYMid slice' } }))
    expect(page!.clips).toEqual([{ kind: 'line', x: 40, top: 40, width: 40, height: 40 }])
    expect(page!.shapes.map(({ x, width }) => [x, width])).toEqual([[20, 80]])
  })

  // The converter draws a clip path again for every element it clips, and
  // a gradient again for every shape painted with it; each clip, and each
  // translucent gradient twice over, is a transparency group whose box is
  // the whole page in the drawing's units, whatever the drawing's size
  // (0030). report-spec counts each reference and MAX_SVG_GROUPS
  // bounds the groups by that; a converter that drew either once, or a
  // group of the drawing's own size, would show here.
  test('draws a clip path and a gradient for every reference, each group the size of the page', async () => {
    const clipped = (uses: number): string => svg(`<clipPath id="c"><rect width="50" height="50"/></clipPath>${'<rect width="10" height="10" fill="#000" clip-path="url(#c)"/>'.repeat(uses)}`)
    const painted = (uses: number, opacity: string): string => svg(`<linearGradient id="g"><stop/><stop offset="1" stop-color="#fff" stop-opacity="${opacity}"/></linearGradient>${'<rect width="10" height="10" fill="url(#g)"/>'.repeat(uses)}`)
    const box = 42.52
    const once = await drawn({ svg: clipped(1), width: box, height: box })
    const thrice = await drawn({ svg: clipped(3), width: box, height: box })
    expect([count(once, /\/Subtype \/Form/g), count(thrice, /\/Subtype \/Form/g), count(thrice, /\/SMask/g)]).toEqual([1, 3, 3])
    expect([count(await drawn({ svg: painted(3, '1'), width: box, height: box }), /\/ShadingType/g), count(await drawn({ svg: painted(3, '0.5'), width: box, height: box }), /\/ShadingType/g)]).toEqual([3, 6])
    // The viewBox is 100 units in a box of 42.52 pt: the group's box, in those units, is the A4 page.
    const [x1, y1, x2, y2] = /\/BBox \[([^\]]*)\]/.exec(latin1(once))![1]!.split(' ').map(Number) as [number, number, number, number]
    expect([((x2 - x1) * box) / 100, ((y2 - y1) * box) / 100].map((side) => Math.round(side * 100) / 100)).toEqual([595.28, 841.89])
  })

  // The converter writes a link annotation for an <a>, to any address --
  // `javascript:` included -- whatever its callbacks say: it has no
  // callback for a link. The cleaner unwraps every <a> and the renderer's
  // own list of elements refuses one (`svg-content.ts`); the callbacks
  // alone would not.
  test("writes an <a>'s link whatever its callbacks say", async () => {
    const pdf = await drawn({ svg: svg('<a href="javascript:app.alert(1)"><rect width="100" height="100" fill="#f00"/></a>'), width: 40, height: 40, options: converterOptions('linked', 'contain') })
    expect(await readAnnotations(pdf)).toEqual([{ page: 1, subtype: 'Link', url: 'javascript:app.alert(1)' }])
  })
})

describe('reading the PDF out of PDFKit', () => {
  // pdfmake's own getBuffer waits for the end of the stream and never
  // listens for an error, so a stream that fails would leave the render
  // pending forever: a job that neither finishes nor fails.
  test('rejects when the stream fails, rather than waiting for an end that never comes', async () => {
    const stream = new PassThrough()
    const reading = collect(stream as unknown as PdfStream)
    stream.destroy(new Error('the stream failed'))
    await expect(reading).rejects.toThrow('the stream failed')
  })

  // Every chunk, in order: a PDF missing a chunk, or with two swapped, is a
  // file no reader opens.
  test('joins every chunk in order', async () => {
    // PDFKit has written its pages by the time pdfmake hands the stream over; ending it writes the rest.
    const stream = new PassThrough()
    stream.write(Buffer.from('%PDF-'))
    stream.write(Buffer.from('1.3'))
    expect(new TextDecoder().decode(await collect(stream as unknown as PdfStream))).toBe('%PDF-1.3')
  })
})

describe("pdfkit's PDF/A-3 and embedded files, which an e-invoice is drawn with", () => {
  const CREATED = new Date('2026-10-16T08:00:00Z')
  const XML = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?>\n<Rechnung>Grüße</Rechnung>\n')

  /**
   * A PDF of `text` that pdfmake makes as the renderer leaves it configured,
   * with `definition`'s options -- a PDF/A-3b's by default -- and `finish`
   * acting on PDFKit's document before it is ended, as the renderer's own
   * hook does.
   */
  async function pdf(text: string, { definition = PDF_A_3B as TDocumentDefinitions, title = 'Rechnung', finish }: { definition?: TDocumentDefinitions; title?: string; finish?: (document: PdfKitDocument) => void } = {}): Promise<Uint8Array> {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const document = (await pdfmake.createPdf({ ...definition, info: { title, creationDate: CREATED }, content: [{ text }], defaultStyle: { font: 'Roboto' } }).getStream()) as unknown as PdfStream & PdfKitDocument
    finish?.(document)
    return collect(document)
  }
  const embed =
    (relationship?: string) =>
    (document: PdfKitDocument): void => {
      // Without a relationship as PDFKit's own types have it: the option left out.
      const options = { name: 'factur-x.xml', type: 'text/xml', description: 'Rechnung', creationDate: CREATED, modifiedDate: CREATED, ...(relationship === undefined ? {} : { relationship }) }
      document.file(XML.buffer.slice(XML.byteOffset, XML.byteOffset + XML.byteLength) as ArrayBuffer, options as PdfKitFileOptions)
    }

  // pdfmake hands the definition's version to PDFKit, which writes the
  // XMP only at a version above 1.3 (pdfkit.js 6070), the default of both.
  // A PDF/A subset without the version is a PDF 1.3 with an output intent
  // and no XMP, which veraPDF fails (6.6.2.1-1), and nothing says so: the
  // renderer sets both, and this fails first if PDFKit stops needing it,
  // or starts writing XMP where it is not asked to.
  test('writes no XMP without version 1.7, a PDF/A subset or not', async () => {
    const without = await readPdfObjects(await pdf('PDF/A', { definition: { subset: PDF_A_3B.subset, content: [] } }))
    expect(without).toMatchObject({ version: '1.3', metadata: undefined })
    expect(without.outputIntents).toHaveLength(1)
    const withVersion = await readPdfObjects(await pdf('PDF/A'))
    expect(withVersion.version).toBe('1.7')
    expect(withVersion.metadata).toBeDefined()
  })

  // The relationship is an option PDFKit takes and @types/pdfkit 0.17.6
  // does not declare, which `pdfa.ts` types itself. Without it PDFKit
  // writes Unspecified (pdfkit.js 5163), which BR-HYBRID-11 warns of and
  // veraPDF passes: were PDFKit to drop or rename the option, every
  // e-invoice would say so unseen by any validator in the gate.
  test('writes the relationship it is given as /AFRelationship, which its types leave out, and Unspecified without one', async () => {
    const given = await readPdfObjects(await pdf('Rechnung', { finish: embed('Alternative') }))
    expect(given.associatedFiles.map(({ relationship }) => relationship)).toEqual(['Alternative'])
    const left = await readPdfObjects(await pdf('Rechnung', { finish: embed() }))
    expect(left.associatedFiles.map(({ relationship }) => relationship)).toEqual(['Unspecified'])
  })

  // PDFKit writes the title into the XMP's dc:title unescaped (pdfkit.js
  // 6025-6032), so a title with an ampersand or an angle bracket
  // leaves the XMP not well-formed, where veraPDF fails it (6.6.2.1-4,
  // 6.6.2.1-5, 6.6.4-1, measured on 1.30.3 on 2026-10-17). It is why an
  // e-invoice's title is refused there, in report-spec and in the
  // renderer, and the information dictionary keeps the title as written.
  // The day PDFKit escapes it, this fails, and the refusal can be weighed
  // again.
  test('writes the title into the XMP unescaped, so that an ampersand leaves it not well-formed', async () => {
    const objects = await readPdfObjects(await pdf('Rechnung', { title: 'Müller & Söhne <AG>' }))
    expect(objects.info['Title']).toBe('Müller & Söhne <AG>')
    expect(objects.metadata?.xmp).toContain('<rdf:li xml:lang="x-default">Müller & Söhne <AG></rdf:li>')
    expect(() => readXmp(objects.metadata!.xmp)).toThrow()
  })

  // ISO 32000-1 (Table 46) asks for /CheckSum as the MD5's 16 bytes;
  // PDFKit writes its 32 hexadecimal digits as a literal string
  // (pdfkit.js 472-474, 5205), which veraPDF 1.30.3 does not flag: it
  // reports the checksum as the file declares it (the e-invoice gate's
  // control-checksum.pdf, recorded on 18 October 2026). It
  // is left as PDFKit writes it, a patch being a copy (0002's spirit), and
  // `limitations.json` says so; this fails the day it changes, either way.
  test('writes /CheckSum as the MD5 in 32 hexadecimal digits, not the 16 bytes ISO 32000-1 asks for', async () => {
    const [file] = (await readPdfObjects(await pdf('Rechnung', { finish: embed('Alternative') }))).associatedFiles
    const checkSum = file?.embedded?.params?.checkSum
    expect(checkSum).toHaveLength(32)
    expect(Buffer.from(checkSum!).toString('latin1')).toBe(createHash('md5').update(XML).digest('hex'))
  })

  // PDFKit's trailer /ID is the MD5 of the information dictionary
  // (pdfkit.js 607-616), not of the content: two PDFs of one title and one
  // creation date share it, whatever they print. PDF/A asks only that there
  // is one (6.1.3-1); ISO 32000-1 asks that it be based on the content.
  // Left as PDFKit writes it, and said so in `limitations.json`: two
  // e-invoices of one title, created in the same second, share an /ID.
  test('gives two PDFs of one title and creation date one /ID, whatever they print', async () => {
    const [one, two] = [await readPdfObjects(await pdf('Rechnung 1')), await readPdfObjects(await pdf('Rechnung 2'))]
    expect(one.id).toBeDefined()
    expect(two.id).toEqual(one.id)
    expect((await readPdfObjects(await pdf('Rechnung 1', { title: 'Gutschrift' }))).id).not.toEqual(one.id)
  })
})
