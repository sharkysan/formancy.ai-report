import pdfmake from 'pdfmake'
import browserPdfmake from 'pdfmake/build/pdfmake.js'
import { readPdf } from '@formancy/report-corpus'
import { MAX_FONT_SIZE, MIN_FONT_SIZE, XRECHNUNG_COPY_PARAGRAPH } from '@formancy/report-runtime'
import type { Block, Image, Paragraph, ResolvedDocument, Section, Table, TableColumn, TextStyle } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf as renderInBrowser } from './browser.js'
import { MAX_DEPTH } from './check.js'
import { renderPdf } from './node.js'
import { BODY_HEIGHT, details, documentOf, ledger, PAGE, paragraph, PRINTABLE_WIDTH } from './testing/documents.js'
import { copied, E_INVOICE_FILE, invoiced, XRECHNUNG_FILE } from './testing/e-invoice.js'
import { encodePng } from './testing/images.js'
import { pageLines } from './testing/lines.js'

/**
 * What the renderer refuses, and how it says so: a `RenderRefusal` with a
 * code a caller can act on and a subject naming where the problem is.
 * Every one of these is refused before pdfmake writes anything, and none
 * comes back as a PDF with something missing.
 */

const dot = (id = 'dot'): Image['asset'] => ({ id, mediaType: 'image/png', bytes: encodePng(2, 2, () => [0, 0, 0]) })

async function refusal(document: ResolvedDocument): Promise<unknown> {
  return renderPdf(document, { maxPages: 5 }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

describe('what pdfmake cannot place', () => {
  // pdfmake has no number for the current page outside the page header and
  // footer. Printing anything else in its place would be a wrong number.
  test.each([
    ['in the body', [paragraph('Before'), { kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }] }], 'body[1]'],
    ['in a section in the body', [{ kind: 'section', blocks: [{ kind: 'paragraph', runs: [{ field: 'pageCount' }] }] }], 'body[0].blocks[0]'],
    ['in a column in the body', [{ kind: 'columns', columns: [{ width: 'fill', blocks: [{ kind: 'paragraph', runs: [{ field: 'pageNumber' }] }] }] }], 'body[0].columns[0].blocks[0]'],
  ] as const)('a page field %s', async (_, body, subject) => {
    expect(await refusal(documentOf('Body field', body))).toMatchObject({ code: 'unsupported', subject })
  })

  // A page break inside a repeated region, a block kept on one page, or a
  // column of a columns block asks for two things that cannot both be done.
  test.each([
    ['in the page header', { ...documentOf('Break in header', [paragraph('Body')]), pageHeader: [paragraph('Header'), { kind: 'pageBreak' }] }, 'pageHeader[1]', 'pageHeader[1] is a page break inside a page region'],
    ['in a keep-together block', documentOf('Break in block', [{ kind: 'keepTogether', blocks: [paragraph('One'), { kind: 'pageBreak' }, paragraph('Two')] }]), 'body[0].blocks[1]', 'body[0].blocks[1] is a page break inside a keep-together block'],
    ['in a keep-together block in a page region', { ...documentOf('Break in a header block', [paragraph('Body')]), pageHeader: [{ kind: 'keepTogether', blocks: [{ kind: 'pageBreak' }] }] }, 'pageHeader[0].blocks[0]', 'pageHeader[0].blocks[0] is a page break inside a page region'],
    ['in a column', documentOf('Break in a column', [{ kind: 'columns', columns: [{ width: 'fill', blocks: [{ kind: 'pageBreak' }] }] }]), 'body[0].columns[0].blocks[0]', 'body[0].columns[0].blocks[0] is a page break inside a columns block'],
  ] as const)('a page break %s', async (_, document, subject, message) => {
    expect(await refusal(document as ResolvedDocument)).toMatchObject({ code: 'unsupported', subject, message })
  })

  // A table is part of the flow, as report-spec has it: inside a column it
  // would break across pages beside the other columns, which nothing here
  // lays out. A section can hold one.
  test('a table in a column', async () => {
    expect(await refusal(documentOf('Table in a column', [{ kind: 'columns', columns: [{ width: 'fill', blocks: [ledger('beside', details(1, 2))] }] }]))).toMatchObject({ code: 'unsupported', subject: 'beside' })
  })
})

describe('what is too large for where it stands', () => {
  // Fixed columns wider than the page push the table past the right margin,
  // where a printer cuts it off.
  test('a table whose fixed columns are wider than the page', async () => {
    const columns: TableColumn[] = [
      { width: 300, align: 'left' },
      { width: 'fill', align: 'left' },
      { width: 300, align: 'right' },
    ]
    expect(await refusal(documentOf('Wide table', [ledger('wide', details(1, 3), columns)]))).toMatchObject({ code: 'content-too-large', subject: 'wide' })
  })

  // Inside a section, its border and padding leave a table less than the
  // page: 460pt of fixed columns fit the page's 515.28pt, leaving the fill
  // column room for its header's word, and not the 455.28pt that 30pt of
  // padding either side leaves.
  test('a table that fits the page but not the frame around it', async () => {
    const columns: TableColumn[] = [
      { width: 230, align: 'left' },
      { width: 'fill', align: 'left' },
      { width: 230, align: 'right' },
    ]
    const table = ledger('wide', details(1, 3), columns)
    expect(await refusal(documentOf('Wide table', [table]))).toBe('rendered')
    expect(await refusal(documentOf('Wide table in a frame', [{ kind: 'section', padding: 30, blocks: [table] }]))).toMatchObject({ code: 'content-too-large', subject: 'wide' })
  })

  // An image or a rectangle drawn larger than the printable area runs past
  // a margin; pdfmake draws it anyway. Narrower than the page, it can still
  // be wider than the column it stands in, and run into the next one.
  test.each([
    ['an image wider than the page', [{ kind: 'image', asset: dot('banner'), width: PRINTABLE_WIDTH + 10, height: 40, fit: 'contain' }], 'banner'],
    ['an image taller than the body', [{ kind: 'image', asset: dot('banner'), width: 40, height: BODY_HEIGHT + 10, fit: 'contain' }], 'banner'],
    ['an image wider than its column', [{ kind: 'columns', columns: [{ width: 100, blocks: [{ kind: 'image', asset: dot('banner'), width: 120, height: 40, fit: 'contain' }] }, { width: 'fill', blocks: [] }] }], 'banner'],
    ['an image taller than the body inside a frame', [{ kind: 'section', padding: 10, blocks: [{ kind: 'image', asset: dot('banner'), width: 40, height: BODY_HEIGHT - 10, fit: 'contain' }] }], 'banner'],
    ['a rectangle wider than the page', [{ kind: 'rectangle', width: PRINTABLE_WIDTH + 1, height: 10, fill: '#000000' }], 'body[0]'],
    ['a rectangle taller than the body', [{ kind: 'rectangle', width: 10, height: BODY_HEIGHT + 1, fill: '#000000' }], 'body[0]'],
    ['columns whose fixed widths are wider than the page', [{ kind: 'columns', columns: [{ width: 300, blocks: [] }, { width: 300, blocks: [] }] }], 'body[0]'],
    ['columns that leave a fill column nothing', [{ kind: 'columns', columns: [{ width: PRINTABLE_WIDTH, blocks: [] }, { width: 'fill', blocks: [] }] }], 'body[0]'],
    ['a section whose padding leaves nothing', [{ kind: 'section', padding: PRINTABLE_WIDTH / 2, blocks: [paragraph('Squeezed')] }], 'body[0]'],
  ] as const)('%s', async (_, body, subject) => {
    expect(await refusal(documentOf('Too large', body as readonly Block[]))).toMatchObject({ code: 'content-too-large', subject })
  })

  // A line no page's body holds, which pdfmake drops whole without a word:
  // a 96 pt line of Roboto is 112.50 pt, here in a body of 100. A table's
  // cell takes its row's style where its own is null, as the runtime
  // writes a column with no style of its own: counted by its cell styles
  // alone, the row's 96 pt 'BIG' was gone from the PDF, which 0.2.0
  // refused; so is a cell left empty, which the measuring pass lays out as
  // a no-break space of its size.
  const columns: TableColumn[] = [{ width: 'fill', align: 'left' }, { width: 'fill', align: 'left' }]
  const tall = (rows: Table['rows']): Table => ({ kind: 'table', id: 'tall', columns, header: ['H1', 'H2'], headerStyle: { size: 4 }, rows, emptyText: 'none' })
  test.each<[string, Block, string]>([
    ['a line of text', paragraph('BIG', { size: 96 }), 'a line of body[0] is 112.50 pt tall'],
    ['a row in its row’s style, under a null cell style', tall([{ kind: 'detail', cells: ['BIG', 'small'], style: { size: 96 }, cellStyles: [null, { size: 4 }] }]), 'a line of table tall is 116.50 pt tall'],
    ['a row’s empty cell', tall([{ kind: 'detail', cells: ['', 'small'], cellStyles: [{ size: 96 }, { size: 4 }] }]), 'a line of table tall is 116.50 pt tall'],
  ])('%s taller than the body', async (_, block, said) => {
    const page = { ...PAGE, margins: { ...PAGE.margins, top: 370.945, bottom: 370.945 } }
    expect(await refusal({ ...documentOf('Too tall', [block, paragraph('After')]), page, pageHeader: [], pageFooter: [] })).toMatchObject({ code: 'content-too-large', message: expect.stringContaining(`${said}; the body is 100.00 pt where it stands`) as string })
  })

  // A keep-together block inside a framed section has less of a page than
  // the body: the frame's border and padding above and below it, 44pt here,
  // which leave 695.14pt of the 739.14pt body. 66 lines of 9pt Roboto are
  // 696.09pt: with the frame not counted, pdfmake drew none of them and
  // returned a PDF without the block (observed on 2026-10-15). 65 lines,
  // 685.55pt, fit, and are drawn whole.
  test('a keep-together block that fits the body but not the frame around it', async () => {
    const kept = (count: number): Block => ({ kind: 'keepTogether', blocks: Array.from({ length: count }, (_, index) => paragraph(`Kept line ${index + 1}`)) })
    const framed = (count: number): Section => ({ kind: 'section', border: { thickness: 2, color: '#000000' }, padding: 20, blocks: [kept(count)] })
    expect(await refusal(documentOf('Kept', [kept(66)]))).toBe('rendered')
    expect(await refusal(documentOf('Kept in a frame', [framed(66)]))).toMatchObject({ code: 'content-too-large', subject: 'body[0].blocks[0]' })
    const pdf = await readPdf(await renderPdf(documentOf('Kept in a frame', [paragraph('Before'), framed(65)]), { maxPages: 5 }))
    expect(pdf.pages.map((page) => pageLines(page).filter((line) => line.text.startsWith('Kept line')).length)).toEqual([0, 65])
  })
})

describe('what is malformed', () => {
  // Each is a document no engine could print as written. pdfmake would fail
  // on some with an error that names nothing, and print others wrongly: a
  // missing cell as a shifted row, an image of no size as nothing at all, a
  // creation date that is not one into the PDF's metadata, a colour it cannot
  // read in black.
  test.each([
    ['a row with fewer cells than columns', [ledger('short', [{ kind: 'detail', cells: ['ROW-0001', 'Only two cells'] }])], 'short'],
    ['a header with fewer cells than columns', [{ ...ledger('short-header', details(1, 2)), header: ['Key', 'Description'] }], 'short-header'],
    ['a table with no columns', [{ ...ledger('no-columns', []), columns: [], header: [] }], 'no-columns'],
    ['a row across the table with more than one cell', [ledger('across', [{ kind: 'groupHeader', cells: ['Region A', 'B'], across: true }])], 'across'],
    ['a row with a cell style too few', [ledger('styles', [{ kind: 'detail', cells: ['A', 'B', 'C'], cellStyles: [null, null] }])], 'styles'],
    ['a column aligned in no known way', [ledger('aligned', details(1, 2), [{ width: 'fill', align: 'justify' as 'left' }, { width: 'fill', align: 'left' }, { width: 'fill', align: 'left' }])], 'aligned'],
    ['a column no wider than its cell padding', [ledger('narrow', details(1, 2), [{ width: 6, align: 'left' }, { width: 'fill', align: 'left' }, { width: 90, align: 'right' }])], 'narrow'],
    ['an image drawn at no size', [{ kind: 'image', asset: dot(), width: 0, height: 10, fit: 'contain' }], 'dot'],
    ['an image fitted in no known way', [{ kind: 'image', asset: dot(), width: 10, height: 10, fit: 'stretch' as 'cover' }], 'dot'],
    ['a rule of no thickness', [{ kind: 'rule', thickness: 0 }], 'body[0]'],
    ['a rectangle of no height', [{ kind: 'rectangle', width: 10, height: 0, fill: '#000000' }], 'body[0]'],
    ['a spacer of negative height', [{ kind: 'spacer', height: -5 }], 'body[0]'],
    ['a columns block of no columns', [{ kind: 'columns', columns: [] }], 'body[0]'],
    ['a column of no width', [{ kind: 'columns', columns: [{ width: 0, blocks: [] }] }], 'body[0]'],
    ['a section border of no thickness', [{ kind: 'section', border: { thickness: 0, color: '#000000' }, blocks: [] }], 'body[0]'],
    ['a section of negative padding', [{ kind: 'section', padding: -1, blocks: [] }], 'body[0]'],
    ['text of no size', [paragraph('Nothing', { size: 0 })], 'body[0]'],
    // The format sets text at MIN_FONT_SIZE to MAX_FONT_SIZE, and a document the runtime resolved holds no other size. The page bound counts a line as its size: 20,000 paragraphs at 0.001 pt, in a report limited to five pages, printed on one, each line over the last.
    ['text below the format’s smallest size', Array.from({ length: 20_000 }, (_, index) => paragraph(`L${index}`, { size: 0.001 })), 'body[0]'],
    ['text past the format’s largest size', [paragraph('Huge', { size: MAX_FONT_SIZE + 0.5 })], 'body[0]'],
    ['a table’s header below it', [{ ...ledger('header-size', details(1, 2)), headerStyle: { size: MIN_FONT_SIZE - 0.5 } }], 'header-size'],
    ['a table’s cell below it', [ledger('cell-size', [{ kind: 'detail', cells: ['A', 'B', 'C'], cellStyles: [null, { size: 0.001 }, null] }])], 'cell-size'],
    ['text aligned in no known way', [paragraph('Justified', { align: 'justify' as 'left' })], 'body[0]'],
    ['a colour in upper case', [paragraph('Shouting', { color: '#FF0000' })], 'body[0]'],
    ['a colour by name', [{ kind: 'rule', thickness: 1, color: 'red' }], 'body[0]'],
    ['a fill that is not a colour', [{ kind: 'rectangle', width: 10, height: 10, fill: 'transparent' }], 'body[0]'],
    ['a border colour that is not one', [{ kind: 'section', border: { thickness: 1, color: '#12345' }, blocks: [] }], 'body[0]'],
    ['a style on a table row with a colour that is not one', [ledger('row-colour', [{ kind: 'detail', cells: ['A', 'B', 'C'], style: { color: 'blue' } }])], 'row-colour'],
    ['a block of a kind the renderer does not know', [{ kind: 'barcode' } as unknown as Block], 'body[0]'],
    // Names an object has from its prototype found a font, and crashed pdfmake with an error naming nothing.
    ['a font named like a property of every object', [paragraph('Inherited', { font: 'constructor' as 'sans' })], 'body[0]'],
    ['a font named like a method of every object', [paragraph('Inherited', { font: 'toString' as 'sans' })], 'body[0]'],
    // Text that is not a string reached pdfmake as inlines with properties of their own: a link was written into the PDF.
    ['a run whose text is not a string', [{ kind: 'paragraph', runs: [{ text: [{ text: 'click', link: 'https://example.invalid/x' }] as unknown as string }] }], 'body[0]'],
    ['a cell that is not a string', [ledger('linked', [{ kind: 'detail', cells: ['A', { text: 'B', link: 'https://example.invalid/x' } as unknown as string, 'C'] }])], 'linked'],
  ] as const)('%s', async (_, body, subject) => {
    expect(await refusal(documentOf('Malformed', body as readonly Block[]))).toMatchObject({ code: 'unsupported', subject })
  })

  // A page field from a runtime that knows one this renderer does not: in a
  // page region, where page fields stand, it would print as nothing.
  test('a page field the renderer does not know', async () => {
    const document = { ...documentOf('Unknown field', [paragraph('Body')]), pageHeader: [{ kind: 'paragraph', runs: [{ field: 'sheetNumber' as 'pageNumber' }] } as const] }
    expect(await refusal(document)).toMatchObject({ code: 'unsupported', subject: 'pageHeader[0]' })
  })

  // The page and the metadata, which every page depends on.
  test.each([
    ['a creation date that is not a date', { info: { title: 'Undated', creationDate: 'yesterday' } }, 'info.creationDate'],
    ['a page size the renderer does not know', { page: { size: 'A3' as 'A4', orientation: 'portrait', margins: { top: 36, right: 36, bottom: 36, left: 36 } } }, 'page.size'],
    ['a page size named like a property of every object', { page: { size: '__proto__' as 'A4', orientation: 'portrait', margins: { top: 36, right: 36, bottom: 36, left: 36 } } }, 'page.size'],
    ['a page size named like a method of every object', { page: { size: 'valueOf' as 'A4', orientation: 'portrait', margins: { top: 36, right: 36, bottom: 36, left: 36 } } }, 'page.size'],
    ['a title that is not text', { info: { title: ['Not', 'text'] as unknown as string, creationDate: '2026-01-01T00:00:00Z' } }, 'info.title'],
    ['an orientation the renderer does not know', { page: { size: 'A4', orientation: 'sideways' as 'portrait', margins: { top: 36, right: 36, bottom: 36, left: 36 } } }, 'page.orientation'],
    ['a negative margin', { page: { size: 'A4', orientation: 'portrait', margins: { top: -1, right: 36, bottom: 36, left: 36 } } }, 'page.margins'],
  ] as const)('%s', async (_, change, subject) => {
    expect(await refusal({ ...documentOf('Malformed page', [paragraph('Body')]), ...change } as ResolvedDocument)).toMatchObject({ code: 'unsupported', subject })
  })

  // Margins that meet leave nothing to print in.
  test('margins that leave no printable area', async () => {
    const page = { size: 'A4', orientation: 'portrait', margins: { top: 36, right: 300, bottom: 36, left: 300 } } as const
    expect(await refusal({ ...documentOf('No room', [paragraph('Body')]), page })).toMatchObject({ code: 'content-too-large', subject: 'page.margins' })
  })

  // A document nested deeper than any report could be would end the render
  // in a stack overflow, a crash that names nothing, rather than a refusal.
  test('blocks nested deeper than the renderer recurses', async () => {
    let body: Block = paragraph('At the bottom')
    for (let depth = 0; depth <= MAX_DEPTH + 1; depth++) body = { kind: 'section', blocks: [body] }
    expect(await refusal(documentOf('Deep', [body]))).toMatchObject({ code: 'unsupported', message: expect.stringContaining(`nested more than ${MAX_DEPTH} blocks deep`) })
  })
})

describe('an image asset that is not what it says', () => {
  // The media type picks the check the bytes are held to, and the engine's
  // way of drawing them: an SVG read as a PNG is refused as a broken PNG,
  // and a PNG read as an SVG would reach the cleaner's reader. Each is
  // refused naming the asset and what its bytes are instead; and an SVG
  // the cleaner refuses -- nested past what the converter recurses through,
  // past what an SVG asset may be -- is refused as it would be at approval.
  const svg = (inner: string): Uint8Array => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`)
  const RECT = '<rect width="1" height="1"/>'
  const huge = svg(`<!--${' '.repeat(1_048_576)}-->${RECT}`)
  test.each([
    ['a PNG declared an SVG', { id: 'logo', mediaType: 'image/svg+xml', bytes: encodePng(2, 2, () => [0, 0, 0]) }, 'the image asset logo is declared an SVG and is not one: it is a PNG'],
    ['an SVG declared a PNG', { id: 'logo', mediaType: 'image/png', bytes: svg(RECT) }, 'the image asset logo is declared a PNG and is not one: it is an SVG'],
    ['an SVG declared a JPEG', { id: 'logo', mediaType: 'image/jpeg', bytes: svg(RECT) }, 'the image asset logo is declared a JPEG and is not one: it is an SVG'],
    ['an SVG of forty levels', { id: 'logo', mediaType: 'image/svg+xml', bytes: svg(`${'<g>'.repeat(40)}${RECT}${'</g>'.repeat(40)}`) }, `the image asset logo is not an SVG the renderer draws: svg${'/g'.repeat(32)} nests past 32 levels; flatten its groups`],
    ['an SVG of more than a mebibyte', { id: 'logo', mediaType: 'image/svg+xml', bytes: huge }, `the image asset logo is not an SVG the renderer draws: the file is ${huge.length} bytes; the limit is 1048576; simplify the drawing`],
  ] as const)('%s', async (_, asset, message) => {
    expect(await refusal(documentOf('Mislabelled', [{ kind: 'image', asset, width: 40, height: 40, fit: 'contain' }]))).toMatchObject({ code: 'invalid-asset', subject: 'logo', message })
  })
})

describe('an e-invoice', () => {
  const ENTRIES = [
    ['in Node', renderPdf],
    ['in a browser', renderInBrowser],
  ] as const
  const refused = async (render: (typeof ENTRIES)[number][1], document: ResolvedDocument): Promise<unknown> =>
    render(document, { maxPages: 5 }).then(
      () => 'rendered',
      (error: unknown) => error,
    )
  const invoice = (file?: unknown): ResolvedDocument => invoiced(documentOf('E-invoice', [paragraph('Rechnung')]), file)
  /** A character by its code point, written so that no editor turns it into the character or drops it. */
  const char = (code: number): string => String.fromCharCode(code)

  // A file from a runtime that names it otherwise than this renderer knows
  // -- another name, relationship or conformance level, or no XML at all --
  // would be embedded as something its reader does not look for, and one
  // whose XML holds a lone surrogate would reach the PDF as other bytes
  // than the runtime wrote: UTF-8 cannot encode one, and an encoder puts
  // U+FFFD in its place without a word. Each is refused, in either entry,
  // and the refusal names what is unknown, never the XML, which holds
  // people's names and accounts.
  test.each([
    ['no file at all', null, 'the e-invoice is not a file the renderer knows'],
    ['text in place of a file', E_INVOICE_FILE.xml, 'the e-invoice is not a file the renderer knows'],
    ['XML that is not text', { ...E_INVOICE_FILE, xml: new TextEncoder().encode(E_INVOICE_FILE.xml) }, "the e-invoice's XML is not text"],
    ['XML holding a lone high surrogate', { ...E_INVOICE_FILE, xml: E_INVOICE_FILE.xml.replace('Erika', `Erika ${char(0xd800)}`) }, "the e-invoice's XML holds a lone surrogate, which UTF-8 cannot encode as it stands"],
    ['XML holding a lone low surrogate', { ...E_INVOICE_FILE, xml: E_INVOICE_FILE.xml.replace('Erika', `Erika ${char(0xdc00)}`) }, "the e-invoice's XML holds a lone surrogate, which UTF-8 cannot encode as it stands"],
    ['another file name', { ...E_INVOICE_FILE, fileName: 'zugferd-invoice.xml' }, 'the e-invoice is embedded under a file name the renderer does not know'],
    ['a conformance level of another profile', { ...E_INVOICE_FILE, conformanceLevel: 'EXTENDED' }, 'the e-invoice states a conformance level the renderer does not know'],
    ['a relationship its profile does not have', { ...E_INVOICE_FILE, relationship: 'Data' }, 'the e-invoice is related to the PDF otherwise than a file of its conformance level is'],
    ['a conformance level named like a property of every object', { ...E_INVOICE_FILE, conformanceLevel: 'constructor' }, 'the e-invoice states a conformance level the renderer does not know'],
  ] as const)('with %s is refused as one the renderer does not know', async (_, eInvoice, message) => {
    for (const [, render] of ENTRIES) {
      const error = await refused(render, invoice(eInvoice))
      expect(error).toMatchObject({ code: 'unsupported', subject: 'eInvoice', message })
      expect(String((error as Error).message)).not.toContain('Mustermann')
    }
  })

  // pdfkit writes the title into the PDF/A's XMP as it is, unescaped
  // (pdfkit.js 6025-6032; `pdfmake.test.ts` holds it): a title with an ampersand or an
  // angle bracket, or a character XML 1.0 cannot write, would leave the
  // XMP not well-formed, a PDF that says it is a PDF/A and is not one.
  // report-spec refuses such a title in an e-invoice report; a document
  // that reached the renderer with one anyway is refused too, naming the
  // title and not quoting it. The same title in a document that is no
  // e-invoice is drawn, as it always was: it reaches no XMP there.
  test.each([
    ['an ampersand', 'Müller & Söhne'],
    ['a less-than sign', 'Rechnung <Entwurf>'],
    ['a greater-than sign', 'Rechnung -> Kunde'],
    ['a control character', `Rechnung${char(0x07)}`],
    ['a lone surrogate', `Rechnung ${char(0xdc00)}`],
    ['a noncharacter XML 1.0 excludes', `Rechnung ${char(0xfffe)}`],
  ])('with a title holding %s is refused, naming the title', async (_, title) => {
    const document = { ...invoice(), info: { ...invoice().info, title } }
    for (const [, render] of ENTRIES) {
      const error = await refused(render, document)
      expect(error).toMatchObject({
        code: 'unsupported',
        subject: 'info.title',
        message: "an e-invoice's title is written into its PDF/A's XMP as it stands, where it may hold no &, < or > and no character XML 1.0 cannot write: this one does",
      })
    }
    if (/[&<>]/.test(title)) expect(await refused(renderPdf, documentOf(title, [paragraph('Rechnung')]))).toBe('rendered')
  })

  // A refused e-invoice reaches neither entry's pdfmake: no PDF of it,
  // partial or plain, exists anywhere.
  test('writes no PDF of a refused one in either entry', async () => {
    const spies = [vi.spyOn(pdfmake, 'createPdf'), vi.spyOn(browserPdfmake, 'createPdf')]
    try {
      for (const [, render] of ENTRIES) await expect(render(invoice({ ...E_INVOICE_FILE, fileName: 'zugferd-invoice.xml' }), { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported', subject: 'eInvoice' })
      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  // The file it knows is drawn, in either entry: the refusals above are
  // of what is unknown, not of e-invoices (0031; `e-invoice.test.ts` and
  // `browser.test.ts` read what is drawn).
  test.each(ENTRIES)('it knows is drawn %s', async (_, render) => {
    expect(await refused(render, invoice())).toBe('rendered')
  })
})

describe('an XRechnung', () => {
  const ENTRIES = [
    ['in Node', renderPdf],
    ['in a browser', renderInBrowser],
  ] as const
  const outcome = async (render: (typeof ENTRIES)[number][1], document: ResolvedDocument): Promise<unknown> =>
    render(document, { maxPages: 5 }).then(
      () => 'rendered',
      (error: unknown) => error,
    )
  const copy = (file?: unknown): ResolvedDocument => copied(documentOf('XRechnung', [paragraph('Rechnung')]), file)

  // The file of either kind is known by its kind (0038). One of a kind the
  // renderer does not know, or a Factur-X file from a runtime that names
  // no kind, would be drawn as something it is not -- a hybrid that embeds
  // nothing, or a copy with no label -- and is refused, never guessed.
  test.each([
    ['a kind the renderer does not know', { ...E_INVOICE_FILE, kind: 'zugferd' }],
    ['no kind at all', (({ kind: _kind, ...file }) => file)(E_INVOICE_FILE)],
    ['a kind named like a property of every object', { ...E_INVOICE_FILE, kind: 'constructor' }],
  ] as const)('with %s is refused as an e-invoice the renderer does not know', async (_, eInvoice) => {
    for (const [, render] of ENTRIES) expect(await outcome(render, invoiced(documentOf('E-invoice', [paragraph('Rechnung')]), eInvoice))).toMatchObject({ code: 'unsupported', subject: 'eInvoice', message: 'the e-invoice is of a kind the renderer does not know' })
  })

  // An XRechnung's file names its syntax, its guideline and its version,
  // report-spec's `XRECHNUNG`; one that names another -- UBL, which this
  // release writes no writer of, a version it does not write, the
  // Factur-X profile's guideline -- is from a runtime that wrote another
  // invoice than this renderer knows, and is refused, as a lone surrogate
  // and XML that is not text are in any e-invoice.
  test.each([
    ['another syntax', { ...XRECHNUNG_FILE, syntax: 'ubl' }, 'the XRechnung is written in a syntax the renderer does not know'],
    ['another version', { ...XRECHNUNG_FILE, version: '2.3' }, 'the XRechnung is of a version the renderer does not know'],
    ['a version named like a property of every object', { ...XRECHNUNG_FILE, version: 'constructor' }, 'the XRechnung is of a version the renderer does not know'],
    ["the Factur-X profile's guideline", { ...XRECHNUNG_FILE, guideline: 'urn:cen.eu:en16931:2017' }, 'the XRechnung names another specification identifier than its version has'],
    ['XML that is not text', { ...XRECHNUNG_FILE, xml: 42 }, "the e-invoice's XML is not text"],
    ['XML holding a lone surrogate', { ...XRECHNUNG_FILE, xml: XRECHNUNG_FILE.xml.replace('Erika', `Erika ${String.fromCharCode(0xd800)}`) }, "the e-invoice's XML holds a lone surrogate, which UTF-8 cannot encode as it stands"],
  ] as const)('with %s is refused as one the renderer does not know', async (_, eInvoice, message) => {
    for (const [, render] of ENTRIES) {
      const error = await outcome(render, copy(eInvoice))
      expect(error).toMatchObject({ code: 'unsupported', subject: 'eInvoice', message })
      expect(String((error as Error).message)).not.toContain('Mustermann')
    }
  })

  // The PDF of an XRechnung is a copy, its invoice the XML (0038, Q1): the
  // runtime opens every page's header with the label that says so. A
  // document that carries an XRechnung without it -- made otherwise than
  // the runtime makes one, or by a runtime that forgot -- would print a
  // final picture of an invoice that says nothing of what it is, and is
  // refused. So is the label's text in another style than the runtime's:
  // in white on the white page, at one point, or in no style of its own,
  // so in whatever a template's page header prints in, PDF.js still finds
  // the text, and no reader sees it.
  const relabel = (document: ResolvedDocument, label: Paragraph): ResolvedDocument => ({ ...document, pageHeader: [label, ...document.pageHeader.slice(1)] })
  const restyled = (style: TextStyle) => (document: ResolvedDocument) => relabel(document, { ...XRECHNUNG_COPY_PARAGRAPH, style })
  test.each([
    ['no page header at all', (document: ResolvedDocument) => ({ ...document, pageHeader: [] })],
    ['the label after another block', (document: ResolvedDocument) => ({ ...document, pageHeader: [...document.pageHeader.slice(1), document.pageHeader[0]!] })],
    ['another label', (document: ResolvedDocument) => relabel(document, paragraph('Kopie'))],
    // A page number is no text of the label's, wherever it stands in the paragraph.
    ['the label with a page number in it', (document: ResolvedDocument) => relabel(document, { ...XRECHNUNG_COPY_PARAGRAPH, runs: [...XRECHNUNG_COPY_PARAGRAPH.runs, { field: 'pageNumber' }] })],
    ['the label in white', restyled({ ...XRECHNUNG_COPY_PARAGRAPH.style, color: '#ffffff' })],
    ['the label at one point', restyled({ ...XRECHNUNG_COPY_PARAGRAPH.style, size: 1 })],
    ['the label in no style of its own', (document: ResolvedDocument) => relabel(document, { kind: 'paragraph', runs: XRECHNUNG_COPY_PARAGRAPH.runs })],
    // A list's items and an object's keys read alike, so a run handed on in an object is a document made otherwise too.
    ['the label’s run in an object, not a list', (document: ResolvedDocument) => relabel(document, { ...XRECHNUNG_COPY_PARAGRAPH, runs: { ...XRECHNUNG_COPY_PARAGRAPH.runs } as unknown as Paragraph['runs'] })],
  ] as const)('with %s on its pages is refused', async (_, unlabel) => {
    for (const [, render] of ENTRIES) {
      expect(await outcome(render, unlabel(copy()))).toMatchObject({
        code: 'unsupported',
        subject: 'pageHeader',
        message: "an XRechnung's PDF is a copy of its XML, labelled so at the top of every page, and this document's page header does not open with the label as the runtime writes it",
      })
    }
  })

  // The XRechnung the renderer knows is drawn in either entry, as a plain
  // PDF: its title reaches no XMP, so one with an ampersand is drawn too
  // (`xrechnung.test.ts` reads what is drawn).
  test.each(ENTRIES)('it knows is drawn %s, its title whatever it is', async (_, render) => {
    expect(await outcome(render, copy())).toBe('rendered')
    expect(await outcome(render, { ...copy(), info: { ...copy().info, title: 'Müller & Söhne <AG>' } })).toBe('rendered')
  })
})

describe('refusing', () => {
  // A refusal is decided before the PDF is written: a refused document never
  // reaches pdfmake's last pass, so no PDF of it, partial or whole, exists.
  test('writes no PDF of a document it refuses', async () => {
    const createPdf = vi.spyOn(pdfmake, 'createPdf')
    try {
      await expect(renderPdf(documentOf('Refused', [paragraph('Fine'), { kind: 'rule', thickness: -1 }]), { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported' })
      expect(createPdf).not.toHaveBeenCalled()
    } finally {
      createPdf.mockRestore()
    }
  })
})
