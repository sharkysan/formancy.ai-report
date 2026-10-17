import { describe, expect, test } from 'vitest'
import { RenderRefusal, type Image, type QrBill, type ResolvedDocument, type Table } from '../document.js'
import { details, documentOf, ledger, paragraph, totalRow } from '../fixtures/build.js'
import { encodePng } from '../fixtures/png.js'
import { lineHas, pageLines } from '../lines.js'
import { readPdf } from '../read-pdf.js'
import { pdfmakeAdapter } from './pdfmake.js'
import { pdfme } from './pdfme.js'

/**
 * What the document grew after the renderer trial, which neither trial
 * adapter draws. Each is refused as `unsupported`, naming where it stands,
 * by both adapters alike: a block skipped or a style ignored would print a
 * report that is not the one asked for, with nothing to say so.
 */

const ADAPTERS = [pdfmakeAdapter, pdfme] as const

/** An 8 × 8 pixel image in a box twice as wide as it is tall. */
function squareIn(fit: Image['fit']): Image {
  return { kind: 'image', asset: { id: 'square', mediaType: 'image/png', bytes: encodePng(8, 8, () => [0, 90, 0]) }, width: 80, height: 40, fit }
}

/** A QR-bill as the runtime resolves SIX's example 3, the payload cut short: neither adapter reads it. */
const BILL: QrBill = {
  kind: 'swissQrBill',
  payload: ['SPC', '0200', '1', 'CH5204835012345671000'].join('\n'),
  headings: {
    paymentPart: 'Payment part',
    receipt: 'Receipt',
    account: 'Account / Payable to',
    reference: 'Reference',
    additionalInformation: 'Additional information',
    payableBy: 'Payable by (name/address)',
    currency: 'Currency',
    amount: 'Amount',
    acceptancePoint: 'Acceptance point',
    separate: 'Separate before paying in',
  },
  account: 'CH52 0483 5012 3456 7100 0',
  creditor: ['Muster Stiftung', 'P.O. box', '3001 Bern'],
  reference: null,
  additionalInformation: [],
  debtor: null,
  currency: 'CHF',
  amount: null,
}

/** The corpus's ledger of three rows, with `patch` laid over it. */
function table(patch: Partial<Table>): Table {
  return { ...ledger('lines', details(1, 3)), ...patch }
}

const UNDRAWN: readonly (readonly [string, ResolvedDocument, string])[] = [
  [
    'a columns block',
    documentOf('Columns', [
      paragraph('Before'),
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [paragraph('Left')] },
          { width: 'fill', blocks: [paragraph('Right')] },
        ],
      },
    ]),
    'body[1]',
  ],
  ['a section', documentOf('Section', [paragraph('Before'), { kind: 'section', blocks: [paragraph('Framed')], border: { thickness: 1, color: '#000000' } }]), 'body[1]'],
  ['a rectangle in the page footer', { ...documentOf('Rectangle', [paragraph('Body')]), pageFooter: [paragraph('Footer'), { kind: 'rectangle', width: 40, height: 10, fill: '#cccccc' }] }, 'pageFooter[1]'],
  ['a rectangle in a keep-together block', documentOf('Kept rectangle', [{ kind: 'keepTogether', blocks: [paragraph('Kept'), { kind: 'rectangle', width: 40, height: 10 }] }]), 'body[0].blocks[1]'],
  ['a QR code', documentOf('QR code', [paragraph('Before'), { kind: 'qrCode', id: 'order-code', text: 'https://formancy.ai/report/', size: 85.04, errorCorrection: 'M' }]), 'body[1]'],
  // A slip left out would print an invoice nobody can pay by, and say nothing.
  ['a payment part', { ...documentOf('Bill', [paragraph('Invoice')]), paymentPart: BILL }, 'paymentPart'],
  ['a QR code in the page header', { ...documentOf('Header code', [paragraph('Body')]), pageHeader: [{ kind: 'qrCode', id: 'header-code', text: 'A-1', size: 40, errorCorrection: 'L' }] }, 'pageHeader[0]'],
  ['a paragraph in the serif font', documentOf('Serif', [paragraph('Set in serif', { font: 'serif' })]), 'body[0]'],
  ['a paragraph in the mono font, in the page header', { ...documentOf('Mono', [paragraph('Body')]), pageHeader: [paragraph('Set in mono', { font: 'mono' })] }, 'pageHeader[0]'],
  ['a paragraph in colour', documentOf('Colour', [paragraph('Printed in red', { color: '#c00000' })]), 'body[0]'],
  ['a rule of another weight', documentOf('Heavy rule', [paragraph('Above'), { kind: 'rule', thickness: 2 }]), 'body[1]'],
  ['a rule in colour', documentOf('Grey rule', [paragraph('Above'), { kind: 'rule', thickness: 0.5, color: '#808080' }]), 'body[1]'],
  ['a table with a styled header', documentOf('Header style', [table({ headerStyle: { italic: true } })]), 'lines'],
  ['a table with a styled row', documentOf('Row style', [table({ rows: [...details(1, 2), { ...totalRow(details(1, 2)), style: { bold: true } }] })]), 'lines'],
  ['a table with a styled cell', documentOf('Cell style', [table({ rows: [{ ...details(1, 1)[0]!, cellStyles: [null, null, { color: '#c00000' }] }] })]), 'lines'],
  ['a group header across the table', documentOf('Across', [table({ rows: [{ kind: 'groupHeader', cells: ['Region A'], across: true }, ...details(1, 2)] })]), 'lines'],
  // Each adapter draws an image at exactly its box, which is what either fit
  // draws only for an image of the box's own proportions. Any other would be
  // stretched, which is neither.
  ['an image of other proportions than its box, to contain', documentOf('Contain', [squareIn('contain')]), 'square'],
  ['an image of other proportions than its box, to cover', documentOf('Cover', [squareIn('cover')]), 'square'],
]

describe.each(ADAPTERS)('the $name trial adapter', (adapter) => {
  test.each(UNDRAWN)('refuses %s as unsupported, naming it', async (_, document, subject) => {
    const rendering = adapter.render(document, { maxPages: 5 })
    await expect(rendering).rejects.toBeInstanceOf(RenderRefusal)
    await expect(rendering).rejects.toMatchObject({ code: 'unsupported', subject })
  })

  // A check that refused every font, colour, rule and image would pass every
  // case above. What the trial drew is still drawn when a document names it
  // outright: the sans font, black text, a black rule of half a point, and an
  // image of its box's proportions to either fit.
  test('draws the sans font, black text, a black half-point rule and an image of its own proportions to cover', async () => {
    const wide: Image = { ...squareIn('cover'), asset: { id: 'wide', mediaType: 'image/png', bytes: encodePng(16, 8, () => [0, 90, 0]) } }
    const document = documentOf('Named', [paragraph('Sans in black', { font: 'sans', color: '#000000' }), { kind: 'rule', thickness: 0.5, color: '#000000' }, paragraph('Below the rule'), wide])
    const pdf = await readPdf(await adapter.render(document, { maxPages: 5 }))
    const lines = pdf.pages.flatMap((page) => pageLines(page))
    expect(['Sans in black', 'Below the rule'].filter((text) => !lines.some((line) => lineHas(line, text)))).toEqual([])
    expect(pdf.pages.flatMap((page) => page.images).map((image) => [Math.round(image.width), Math.round(image.height)])).toEqual([[80, 40]])
  })
})
