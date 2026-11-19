import { CHART_FIXTURES, SVG_MARK, UNSEEN_JPEGS } from '@formancy/report-corpus'
import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, RenderRefusal } from '@formancy/report-runtime'
import type { Block, Image, ResolvedDocument, Table } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderDocx } from './render.js'
import { documentOf, paragraph, refusalOf, written } from './testing/support.js'

/**
 * What the writer refuses (0068), each by its code, its subject and what
 * its sentence says, and each whole: a refusal is thrown before a byte is
 * written, so nothing is returned of a document that would print
 * otherwise than its PDF, or not at all. A file written of any of these
 * would open in Word and look whole.
 */

/** A chart of a kind no report knows, which any engine refuses by its id (0076): a block the writer refuses where the walk meets it. A chart as the runtime resolves one is written (`charts.test.ts`). */
const CHART = { ...CHART_FIXTURES[0]!.document.body.find((block) => block.kind === 'chart')!, chart: 'radar' } as unknown as Block
const CHART_ID = (CHART as { readonly id: string }).id
const [TURNED, CMYK] = UNSEEN_JPEGS as unknown as [Image['asset'], Image['asset']]
const SVG: Image['asset'] = { id: 'mark', mediaType: 'image/svg+xml', bytes: SVG_MARK }
const image = (asset: Image['asset'], more: Partial<Image> = {}): Image => ({ kind: 'image', asset, width: 40, height: 40, fit: 'contain', ...more })
const table = (id: string, more: Partial<Table> = {}): Table => ({
  kind: 'table',
  id,
  columns: [{ width: 'fill', align: 'left' }],
  header: ['Key'],
  rows: [],
  emptyText: 'None',
  ...more,
})
const label = (text: string): Block => ({ kind: 'paragraph', runs: [{ text }], style: { size: 8, bold: true, color: '#b00020' } })
/** A payment part that is no QR-bill, which the rules below both engines refuse (0075); a bill the runtime resolved is written (`slip.test.ts`). */
const SLIP = {} as NonNullable<ResolvedDocument['paymentPart']>
const invoice = (kind: string): NonNullable<ResolvedDocument['eInvoice']> => ({ kind }) as NonNullable<ResolvedDocument['eInvoice']>
/** A QR code the rules below both engines refuse (0074): its square is too small for its text at 0.4 mm a module. */
const FINE: Block = { kind: 'qrCode', id: 'code', text: 'https://formancy.ai/report/', size: 40, errorCorrection: 'M' }

type Case = readonly [name: string, document: ResolvedDocument, code: string, subject: string, sentence: RegExp]

const holds = ([, document, code, subject, sentence]: Case): void => {
  const refusal = refusalOf(document)
  expect({ code: refusal.code, subject: refusal.subject }).toEqual({ code, subject })
  expect(refusal.message).toMatch(sentence)
}

describe('what belongs to the PDF is refused, naming it', () => {
  const cases: readonly Case[] = [
    ['a Factur-X e-invoice', documentOf([], { eInvoice: invoice('facturX') }), 'unsupported', 'eInvoice', /PDF\/A-3b that embeds its XML/],
    ['an XRechnung', documentOf([], { eInvoice: invoice('xrechnung') }), 'unsupported', 'eInvoice', /XRechnung.*is no copy/],
    ['a preview labelled as lacking data', documentOf([], { pageHeader: [label(PREVIEW_LABEL)] }), 'unsupported', 'pageHeader', /a paragraph a person deletes/],
    [
      "an e-invoice's preview",
      documentOf([], { pageHeader: [label(E_INVOICE_PREVIEW_LABEL), paragraph('Invoice')] }),
      'unsupported',
      'pageHeader',
      /labelled on every page/,
    ],
  ]
  test.each(cases)('%s', (...each) => {
    holds(each)
  })

  // The order is the record's: the document's own parts before any block, so that the same report is refused for the same thing whatever else it holds.
  // An e-invoice paid by a QR-bill is refused as the e-invoice it is: its slip is written since 0075, and its bill is looked at last.
  test('an e-invoice before a label, a label before a chart no engine draws, and each before a payment part', () => {
    const labelled = documentOf([CHART], { pageHeader: [label(PREVIEW_LABEL)] })
    const invoiced = { ...labelled, eInvoice: invoice('facturX') }
    expect(refusalOf({ ...invoiced, paymentPart: SLIP }).subject).toBe('eInvoice')
    expect(refusalOf({ ...labelled, paymentPart: SLIP }).subject).toBe('pageHeader')
    expect(refusalOf(invoiced).subject).toBe('eInvoice')
    expect(refusalOf(labelled).subject).toBe('pageHeader')
    expect(refusalOf({ ...labelled, pageHeader: [] }).subject).toBe(CHART_ID)
  })

  // A code is the writer's to draw since 0074, and what refuses one is the rule both engines ask: refused by that rule's code and subject,
  // in the PDF's words, where the walk meets it -- after a block no engine prints that stands before it, and before one that stands after.
  test('a code the rules below both engines refuse is refused as they refuse it, where the walk meets it', () => {
    const red = paragraph('red', { color: 'red' })
    const refusal = refusalOf(documentOf([FINE, red]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'code' })
    expect(refusal.message).toMatch(/^the QR code code is 40 pt a side, which makes the 37 modules across its symbol and quiet zone 1\.08 pt each/)
    expect(refusalOf(documentOf([red, FINE])).subject).toBe('body[0]')
    // Before a chart no engine draws after it, and such a chart before it first: neither kind is refused ahead of the other but by where it stands.
    expect(refusalOf(documentOf([FINE, CHART])).subject).toBe('code')
    expect(refusalOf(documentOf([CHART, FINE])).subject).toBe(CHART_ID)
  })

  // The whole order, a place at a time: a document wrong in every place the writer looks is refused for a face that is no font, which is
  // read before anything is walked, then for its creation date, and with each place put right for the next. A host that shows a person
  // one refusal shows the same one whatever else the report holds.
  test("a face that is no font, the creation date, the title, the page, then the page header, page 1's own, the page footer, the body, and last the payment part", () => {
    const red = paragraph('red', { color: 'red' })
    const faced: ResolvedDocument = {
      ...documentOf([red, CHART], { pageHeader: [red], firstPageHeader: [red], pageFooter: [red] }),
      info: { title: 7 as unknown as string, creationDate: 'yesterday' },
      page: { size: 'A3' as 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
      paymentPart: SLIP,
      fonts: { serif: { normal: { id: 'face', digest: `sha256:${'0'.repeat(64)}`, bytes: new Uint8Array([1, 2, 3, 4]) } } },
    }
    const { fonts: _face, ...everywhere } = faced
    const dated = { ...everywhere, info: { ...everywhere.info, creationDate: '2026-01-01T00:00:00Z' } }
    const titled = { ...dated, info: { ...dated.info, title: 'T' } }
    const paged = { ...titled, page: documentOf([]).page }
    const headed = { ...paged, pageHeader: [] }
    const first = { ...headed, firstPageHeader: [] }
    const footed = { ...first, pageFooter: [] }
    const steps = [faced, everywhere, dated, titled, paged, headed, first, footed, { ...footed, body: [CHART, red] }, { ...footed, body: [] }]
    expect(steps.map((each) => refusalOf(each).subject)).toEqual([
      'face',
      'info.creationDate',
      'info.title',
      'page.size',
      'pageHeader[0]',
      'firstPageHeader[0]',
      'pageFooter[0]',
      // In the body, whichever stands first: a block no engine prints before a chart no engine draws, and such a chart before one.
      'body[0]',
      CHART_ID,
      // A payment part that is no bill, once every block is right: where the PDF renderer looks at it (0075).
      'paymentPart',
    ])
  })

  // The label is the runtime's own paragraph at the head of the header: the same words lower down, or in the body, are a report's own.
  test('a report that only quotes the label is written', () => {
    const quoted = documentOf([paragraph(PREVIEW_LABEL)], { pageHeader: [paragraph('Letterhead'), label(PREVIEW_LABEL)] })
    expect(written(quoted).body).toHaveLength(1)
  })
})

describe('what nobody has seen Word print as the PDF does is refused, naming it', () => {
  const cases: readonly Case[] = [
    ['a JPEG its Exif block turns', documentOf([image(TURNED)]), 'unsupported', 'jpeg-turned', /Exif block turns or mirrors \(orientation 6\)/],
    ['a JPEG of four components', documentOf([image(CMYK)]), 'unsupported', 'jpeg-cmyk', /four components.*CMYK/],
    [
      'an SVG that covers a box of other proportions',
      documentOf([image(SVG, { fit: 'cover', width: 80 })]),
      'unsupported',
      'mark',
      /covers a box of other proportions/,
    ],
    [
      'a table in a bordered section',
      documentOf([{ kind: 'section', border: { thickness: 1, color: '#000000' }, blocks: [table('boxed')] }]),
      'unsupported',
      'boxed',
      /a table's cell.*header row/,
    ],
    // Padding alone frames a section: it is a cell all the same.
    [
      'a table in a section that only pads',
      documentOf([{ kind: 'section', padding: 4, blocks: [table('padded')] }]),
      'unsupported',
      'padded',
      /a table's cell/,
    ],
    [
      'a table in a keep-together block in a filled section',
      documentOf([{ kind: 'section', fill: '#eeeeee', blocks: [{ kind: 'keepTogether', blocks: [table('kept')] }] }]),
      'unsupported',
      'kept',
      /a table's cell/,
    ],
    [
      'a page break in a framed section',
      documentOf([{ kind: 'section', fill: '#eeeeee', blocks: [paragraph('Before'), { kind: 'pageBreak' }] }]),
      'unsupported',
      'body[0].blocks[1]',
      /Word starts no page inside a cell/,
    ],
  ]
  test.each(cases)('%s', (...each) => {
    holds(each)
  })

  // What a Word file holds as the PDF does is written: the refusals above must not reach further than their reason.
  test.each<[string, Block]>([
    ['a table in a section with no frame', { kind: 'section', blocks: [table('plain')] }],
    ['a page break in a section with no frame', { kind: 'section', blocks: [paragraph('Before'), { kind: 'pageBreak' }] }],
    ['an SVG that covers a box of its own proportions', image(SVG, { fit: 'cover' })],
    ['an SVG contained in a box of other proportions', image(SVG, { width: 80 })],
  ])('%s is written', (_name, block) => {
    expect(written(documentOf([block])).body.length).toBeGreaterThan(0)
  })
})

describe("the writer's own bounds are refused, naming the block", () => {
  // The printable area of an A4 page with 50 points of margin is 741.89 points tall.
  const cases: readonly Case[] = [
    [
      'a picture taller than the printable area',
      documentOf([image(SVG, { width: 40, height: 742 })]),
      'content-too-large',
      'mark',
      /742 pt tall; the printable area is 741\.89 pt/,
    ],
    [
      'a rectangle taller than the printable area',
      documentOf([{ kind: 'rectangle', width: 10, height: 742 }]),
      'content-too-large',
      'body[0]',
      /the rectangle body\[0\] is 742 pt tall/,
    ],
    [
      'a spacer taller than the printable area',
      documentOf([{ kind: 'spacer', height: 742 }]),
      'content-too-large',
      'body[0]',
      /the spacer body\[0\] is 742 pt tall/,
    ],
    [
      'a rule lighter than a border of Word',
      documentOf([{ kind: 'rule', thickness: 0.1 }]),
      'unsupported',
      'body[0]',
      /a rule 0\.1 pt thick; a line of a Word file is from 0\.25 to 12 pt/,
    ],
    ['a rule heavier than a border of Word', documentOf([{ kind: 'rule', thickness: 12.1 }]), 'unsupported', 'body[0]', /a rule 12\.1 pt thick/],
    [
      'a section border heavier than a border of Word',
      documentOf([{ kind: 'section', border: { thickness: 20, color: '#000000' }, blocks: [] }]),
      'unsupported',
      'body[0]',
      /has a border 20 pt thick/,
    ],
    [
      'a creation date of a year no core property states',
      documentOf([], { info: { title: 'T', creationDate: '+012026-01-01T00:00:00Z' } }),
      'unsupported',
      'info.creationDate',
      /a year a Word file cannot state/,
    ],
  ]
  test.each(cases)('%s', (...each) => {
    holds(each)
  })

  // At the bound each is written: a limit applied with >= where it means > would refuse the tallest picture a page holds.
  test.each<[string, Block]>([
    ['a picture as tall as the printable area', image(SVG, { width: 40, height: 741.89 })],
    ['a rule a quarter of a point thick', { kind: 'rule', thickness: 0.25 }],
    ['a rule twelve points thick', { kind: 'rule', thickness: 12 }],
  ])('%s is written', (_name, block) => {
    expect(written(documentOf([block])).body).toHaveLength(1)
  })
})

describe("a length that rounds to none of Word's units is refused, naming the block", () => {
  // A Word file states a length in twentieths of a point and a picture's extent in English Metric Units, 12,700 to the point. A width or a
  // height that rounds to none was written as a table of no width, a row of exactly no height, a picture of no extent -- which the PDF draws,
  // thin as it is, and which nobody has seen Word draw. A spacer that small is no space, and writes nothing; a box that small is refused.
  const fine: Block = { kind: 'section', padding: 247.63, blocks: [{ kind: 'section', fill: '#eeeeee', blocks: [paragraph('x')] }] }
  const cases: readonly Case[] = [
    [
      'a rectangle a hundredth of a point wide',
      documentOf([{ kind: 'rectangle', width: 0.01, height: 10 }]),
      'unsupported',
      'body[0]',
      /a rectangle of 0\.01 × 10 pt; a Word file states no length under a fortieth of a point/,
    ],
    [
      'a rectangle a hundredth of a point tall',
      documentOf([{ kind: 'rectangle', width: 10, height: 0.01 }]),
      'unsupported',
      'body[0]',
      /a rectangle of 10 × 0\.01 pt/,
    ],
    [
      'a column a hundredth of a point wide',
      documentOf([
        {
          kind: 'columns',
          columns: [
            { width: 0.01, blocks: [] },
            { width: 'fill', blocks: [] },
          ],
        },
      ]),
      'unsupported',
      'body[0]',
      /has a column 0\.01 pt wide; a Word file states no length under a fortieth of a point/,
    ],
    [
      'a fill column left a hundredth of a point',
      documentOf([
        {
          kind: 'columns',
          columns: [
            { width: 495.27, blocks: [] },
            { width: 'fill', blocks: [] },
          ],
        },
      ]),
      'unsupported',
      'body[0]',
      /has a column 0\.0\d+ pt wide/,
    ],
    // The outer section's padding leaves its blocks two hundredths of a point: the framed one inside it would be a table that wide.
    ['a framed section where it stands two hundredths of a point wide', documentOf([fine]), 'unsupported', 'body[0].blocks[0]', /stands 0\.02 pt wide/],
    [
      'a picture drawn at under an English Metric Unit',
      documentOf([image(SVG, { width: 0.00003, height: 40 })]),
      'unsupported',
      'mark',
      /is drawn 0\.00003 × 0\.00003 pt, under the unit a Word file states a picture's extent in/,
    ],
  ]
  test.each(cases)('%s', (...each) => {
    holds(each)
  })

  // At the least each unit states, each is written: the refusals above must not reach a hairline a report means.
  test.each<[string, Block]>([
    ['a rectangle of three hundredths of a point a side', { kind: 'rectangle', width: 0.03, height: 0.03 }],
    [
      'a column three hundredths of a point wide',
      {
        kind: 'columns',
        columns: [
          { width: 0.03, blocks: [] },
          { width: 'fill', blocks: [] },
        ],
      },
    ],
    ['a picture drawn at an English Metric Unit', image(SVG, { width: 0.0001, height: 40 })],
  ])('%s is written', (_name, block) => {
    expect(written(documentOf([block])).body.length).toBeGreaterThan(0)
  })
})

describe('what no engine prints is refused as the PDF renderer refuses it', () => {
  const field: Block = { kind: 'paragraph', runs: [{ field: 'pageNumber' }] }
  const nested = (depth: number): Block => (depth === 0 ? paragraph('deep') : { kind: 'section', blocks: [nested(depth - 1)] })
  const page = (more: Partial<ResolvedDocument['page']>): Partial<ResolvedDocument> => ({
    page: { size: 'A4', orientation: 'portrait', margins: { top: 0, right: 0, bottom: 0, left: 0 }, ...more },
  })
  const cases: readonly Case[] = [
    [
      'a table in a columns block',
      documentOf([{ kind: 'columns', columns: [{ width: 'fill', blocks: [table('aside')] }] }]),
      'unsupported',
      'aside',
      /inside a columns block/,
    ],
    [
      'a page break in a page region',
      documentOf([], { pageHeader: [{ kind: 'pageBreak' }] }),
      'unsupported',
      'pageHeader[0]',
      /a page break inside a page region/,
    ],
    [
      'a page break in a keep-together block',
      documentOf([{ kind: 'keepTogether', blocks: [{ kind: 'pageBreak' }] }]),
      'unsupported',
      'body[0].blocks[0]',
      /inside a keep-together block/,
    ],
    [
      'a page break in a column',
      documentOf([{ kind: 'columns', columns: [{ width: 'fill', blocks: [{ kind: 'pageBreak' }] }] }]),
      'unsupported',
      'body[0].columns[0].blocks[0]',
      /inside a columns block/,
    ],
    ['a page field in the body', documentOf([field]), 'unsupported', 'body[0]', /prints a page field/],
    [
      "a page field in page 1's own header",
      documentOf([], { firstPageHeader: [field] }),
      'unsupported',
      'firstPageHeader[0]',
      /page 1's own header holds none/,
    ],
    ['a block the document does not hold', documentOf([{ kind: 'barcode' } as unknown as Block]), 'unsupported', 'body[0]', /a barcode block/],
    [
      'a field the document does not hold',
      documentOf([], { pageFooter: [{ kind: 'paragraph', runs: [{ field: 'date' }] } as unknown as Block] }),
      'unsupported',
      'pageFooter[0]',
      /a field a report does not know/,
    ],
    [
      'a run set off the line in an unknown way',
      documentOf([{ kind: 'paragraph', runs: [{ text: '2', baseline: 'ordinal' }] } as unknown as Block]),
      'unsupported',
      'body[0]',
      /below or above the line/,
    ],
    ['an image fitted in an unknown way', documentOf([image(SVG, { fit: 'stretch' as Image['fit'] })]), 'unsupported', 'mark', /fitted 'stretch'/],
    ['an image of no size', documentOf([image(SVG, { width: 0 })]), 'unsupported', 'mark', /drawn 0 × 40 pt/],
    ['an image wider than where it stands', documentOf([image(SVG, { width: 500 })]), 'content-too-large', 'mark', /500 pt wide; it stands 495\.28 pt wide/],
    ['a size outside the format', documentOf([paragraph('big', { size: 200 })]), 'unsupported', 'body[0]', /set at 200 pt/],
    ['a colour that is no colour', documentOf([paragraph('red', { color: 'red' })]), 'unsupported', 'body[0]', /names the colour 'red'/],
    ['an alignment the document does not hold', documentOf([paragraph('x', { align: 'justify' as 'left' })]), 'unsupported', 'body[0]', /aligned 'justify'/],
    ['blocks nested past sixteen', documentOf([nested(18)]), 'unsupported', `body[0]${'.blocks[0]'.repeat(16)}.blocks`, /nested more than 16 blocks deep/],
    [
      'margins that leave no page',
      documentOf([], page({ margins: { top: 0, right: 300, bottom: 0, left: 300 } })),
      'content-too-large',
      'page.margins',
      /no printable area/,
    ],
    [
      'a creation date that is no date',
      documentOf([], { info: { title: 'T', creationDate: 'yesterday' } }),
      'unsupported',
      'info.creationDate',
      /is not a date/,
    ],
    [
      'a title that is no text',
      documentOf([], { info: { title: 7 as unknown as string, creationDate: '2026-01-01T00:00:00Z' } }),
      'unsupported',
      'info.title',
      /the title is not text/,
    ],
    ['a paper the format does not name', documentOf([], page({ size: 'A3' as 'A4' })), 'unsupported', 'page.size', /page size 'A3'/],
    ['a rule of no thickness', documentOf([{ kind: 'rule', thickness: 0 }]), 'unsupported', 'body[0]', /a rule 0 pt thick/],
    [
      'columns wider than where they stand',
      documentOf([
        {
          kind: 'columns',
          columns: [
            { width: 300, blocks: [] },
            { width: 300, blocks: [] },
          ],
        },
      ]),
      'content-too-large',
      'body[0]',
      /fixed columns are 600 pt wide/,
    ],
    [
      'a table whose row has a cell too many',
      documentOf([table('lines', { rows: [{ kind: 'detail', cells: ['a', 'b'] }] })]),
      'unsupported',
      'lines',
      /has 2 cells for 1 columns/,
    ],
    [
      'a detail row that keeps rows',
      documentOf([table('lines', { rows: [{ kind: 'detail', cells: ['a'], keepWithRows: 2 }] })]),
      'unsupported',
      'lines',
      /only a group header does/,
    ],
  ]
  test.each(cases)('%s', (...each) => {
    holds(each)
  })
})

// A refusal is the runtime's own class, thrown: a caller that catches the PDF renderer's catches the writer's, and gets no bytes of a file that lost something.
test("a refusal is thrown as the runtime's RenderRefusal, and nothing is returned", () => {
  let returned: Uint8Array | undefined
  expect(() => {
    returned = renderDocx(documentOf([CHART]))
  }).toThrow(RenderRefusal)
  expect(returned).toBeUndefined()
})
