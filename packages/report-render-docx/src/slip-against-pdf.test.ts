import { BILL_EXAMPLES, readCodes, readPdf, readSlipCode, type DocxBlock, type PdfTextItem } from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { RenderRefusal, type QrBill, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderDocx } from './render.js'
import { BILLS, billDocument, resolvedBill } from './testing/bills.js'
import { documentOf, refusalOf, written } from './testing/support.js'

/**
 * A QR-bill's slip in both engines (0075). Its rules, its geometry and
 * its code's symbol are decided once, below both (report-runtime's
 * `bill-check.ts`, `slip-print.ts` and `qr-symbol.ts`), and each engine
 * draws them its own way: pdfmake's content at the foot of the last
 * page, and paragraphs and tables on a page of the file's own. So:
 *
 * **A bill that is refused is refused by both, in the same words**,
 * wherever the refusal is the rule's and not an engine's own.
 *
 * **The information's lines are the PDF's lines**, each heading and each
 * line of each value, in order: the writer breaks a value by the widths
 * it states, the PDF's engine by the face it embeds, and a slip that
 * broke one elsewhere would be a line taller or shorter than the PDF's.
 * But a word wider than its line, which billing information is: each
 * engine breaks that its own way, and its characters are held, not its
 * lines.
 *
 * **The code is the PDF's code**: what ZXing reads in the file's picture
 * is what it reads on the PDF's page, byte for byte, at the same level
 * and version, in a square of the same size.
 *
 * **What the two refuse otherwise** is said: what the PDF refuses of what
 * it measured above the slip, which a Word file's slip has a page to
 * itself for; and a character SIX does not allow, which the PDF's face
 * draws and the writer has no width for.
 */

const TIMEOUT = 120_000
const mm = (value: number): number => (value * 72) / 25.4
/** The slip's top on an A4 page: 105 mm above its foot (IG 3.1). */
const TOP = 841.89 - mm(105)

async function pdfRefusal(document: ResolvedDocument): Promise<{ readonly code: string; readonly subject: string | undefined; readonly message: string }> {
  try {
    await renderPdf(document, { maxPages: 5 })
  } catch (error) {
    if (error instanceof RenderRefusal) return { code: error.code, subject: error.subject, message: error.message }
    throw error
  }
  throw new Error('the PDF was drawn, where a refusal was expected')
}

describe('a bill no engine draws is refused by both in the same words', () => {
  const GOOD = resolvedBill(BILL_EXAMPLES.two)
  const A4 = documentOf([]).page
  const long = Array.from({ length: 3 }, () => 'Muster '.repeat(20).trim())
  const cases: readonly (readonly [string, object, Partial<ResolvedDocument['page']>?])[] = [
    ['a kind nobody knows', { kind: 'giro' }],
    ['an account that is no text', { account: 7 }],
    ["a creditor's address of five lines", { creditor: ['a', 'b', 'c', 'd', 'e'] }],
    ["a creditor's address of one line", { creditor: ['a'] }],
    ["a debtor's address that is no lines", { debtor: 'Simon Muster' }],
    ['a reference longer than any value SIX allows', { reference: '1'.repeat(141) }],
    ['additional information of three lines', { additionalInformation: ['a', 'b', 'c'] }],
    ['a currency SIX does not allow', { currency: 'USD' }],
    ['an amount with a comma', { amount: '1 949,75' }],
    ["an amount past SIX's range", { amount: '1 000 000 000.00' }],
    ['a heading that is missing', { headings: { ...GOOD.headings, amount: undefined } }],
    ['a payload of 998 characters', { payload: 'x'.repeat(998) }],
    ['a payload that is no text', { payload: 7 }],
    ['a page of US Letter', {}, { size: 'Letter' }],
    ['a page in landscape', {}, { orientation: 'landscape' }],
    ['a top margin that reaches into the slip', {}, { margins: { ...A4.margins, top: 560 } }],
    // Measured by each engine its own way, and said in the same words: the PDF's by a layout, the file's by the widths it states.
    ['information taller than its section', { creditor: long, debtor: long }],
  ]

  // A bill the two refused in other words, or one refused and one drew, would be a report whose Word file says something else of its
  // bill than its PDF: the rule is one, below both, and this holds each engine to asking it.
  test.each(cases)(
    '%s',
    async (_name, wrong, page) => {
      const document = billDocument({ ...GOOD, ...(wrong as Partial<QrBill>) }, [], {
        page: { ...A4, ...(page as Partial<ResolvedDocument['page']> | undefined) },
      })
      const word = refusalOf(document)
      expect(word.subject).toBe('paymentPart')
      expect(word).toEqual(await pdfRefusal(document))
    },
    TIMEOUT,
  )
})

describe('what the two refuse otherwise', () => {
  const GOOD = resolvedBill(BILL_EXAMPLES.two)

  // The slip has a page to itself in a Word file, so nothing the report prints above it can reach into it: a header the PDF refuses the
  // bill for, since its last page has no room for both, is no reason to refuse the file.
  test(
    'a page header that leaves the slip no room on the last page is refused by the PDF, and written by the writer',
    async () => {
      const document = billDocument(GOOD, [], {
        page: { ...documentOf([]).page, margins: { top: 500, right: 50, bottom: 50, left: 50 } },
        pageHeader: [{ kind: 'spacer', height: 60 }],
      })
      expect(await pdfRefusal(document)).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
      expect(written(document).slip).toBeDefined()
    },
    TIMEOUT,
  )

  // Greek is in the PDF's face and in no rule of SIX's: the runtime never resolves such a bill, and of one made by hand the PDF draws
  // what its face draws, while the writer, which has widths for SIX's characters alone, refuses it.
  test(
    'a character SIX does not allow, which Liberation Sans draws, is drawn by the PDF and refused by the writer',
    async () => {
      const document = billDocument({ ...GOOD, creditor: ['Ωmega AG', '8000 Seldwyla'] })
      expect((await renderPdf(document, { maxPages: 5 })).length).toBeGreaterThan(0)
      expect(refusalOf(document)).toMatchObject({ code: 'unsupported', subject: 'paymentPart' })
    },
    TIMEOUT,
  )
})

/** A line of text as PDF.js reads it in a box of the page: its runs joined, without its spaces. */
function pdfLines(items: readonly PdfTextItem[], box: { readonly x: number; readonly right: number; readonly top: number; readonly bottom: number }): string[] {
  const baseline = (item: PdfTextItem): number => item.bottom - 0.2 * item.height
  const inside = items.filter(
    (item) => item.x >= box.x - 1 && item.x < box.right && baseline(item) > box.top && baseline(item) <= box.bottom && item.text.trim() !== '',
  )
  const lines = new Map<number, PdfTextItem[]>()
  for (const item of inside) {
    const key = Math.round(baseline(item) * 2)
    lines.set(key, [...(lines.get(key) ?? []), item])
  }
  return [...lines]
    .sort(([above], [below]) => above - below)
    .map(([, line]) =>
      [...line]
        .sort((left, right) => left.x - right.x)
        .map((item) => item.text)
        .join('')
        .replaceAll(' ', ''),
    )
}

/**
 * `lines` with the ones that together are `word` made one: a value with
 * no place to break at, wider than its line, which each engine breaks its
 * own way -- the writer where the line is full, the PDF's engine first
 * where Unicode's rules let it, after the `//` billing information begins
 * with, and then by a width it estimates.
 */
function joined(lines: readonly string[], word: string | undefined): string[] {
  if (word === undefined) return [...lines]
  for (let from = 0; from < lines.length; from++)
    for (let to = from + 1; to <= lines.length; to++) if (lines.slice(from, to).join('') === word) return [...lines.slice(0, from), word, ...lines.slice(to)]
  return [...lines]
}

/** The lines a cell's own paragraphs print, in order, without their spaces: its tables' cells are not its lines. */
const fileLines = (blocks: readonly DocxBlock[]): string[] =>
  blocks.flatMap((block) => (block.kind === 'paragraph' && block.runs[0]?.kind === 'text' ? [block.runs[0].text.replaceAll(' ', '')] : []))

describe.each(BILLS)('the slip of %s in both engines', (_name, bill) => {
  const resolved = resolvedBill(bill)
  const document = billDocument(resolved, [])

  // The same lines, in the same order: a value the writer broke elsewhere than the PDF's engine would stand on other lines, and where it
  // took a line more its section would end lower than the PDF's.
  test(
    "prints its information on the PDF's lines, in the receipt and in the payment part",
    async () => {
      const pdf = await readPdf(await renderPdf(document, { maxPages: 5 }))
      const { items } = pdf.pages.at(-1)!
      const [, table] = written(document).slip!.blocks
      if (table?.kind !== 'table') throw new Error('the slip is no table')
      const [receipt, , information] = table.rows[0]!.cells
      // The receipt's cell holds its title before its information and the acceptance point after its amount: neither is the information's.
      const before = receipt!.blocks.findIndex(
        (block) =>
          block.kind === 'table' &&
          block.rows.some((row) => row.cells.some((cell) => cell.blocks.some((each) => each.kind === 'paragraph' && each.runs.length > 0))),
      )
      expect(fileLines(receipt!.blocks.slice(0, before)).slice(1)).toEqual(
        pdfLines(items, { x: mm(5), right: mm(57), top: TOP + mm(12), bottom: TOP + mm(68) }),
      )
      // Billing information has no space in it: where it is wider than a line, its lines are each engine's own, and its characters the same.
      const billing = resolved.additionalInformation.find((text) => text.startsWith('//'))
      const paid = pdfLines(items, { x: mm(118), right: mm(205), top: TOP + mm(5), bottom: TOP + mm(90) })
      expect(joined(fileLines(information!.blocks), billing)).toEqual(joined(paid, billing))
      // And nothing is merged where it fits a line: the lines are then the PDF's, every one.
      if (billing !== undefined && billing.length < 60) expect(fileLines(information!.blocks)).toEqual(paid)
    },
    TIMEOUT,
  )

  // One symbol, decided below both: a file whose code said another account than its PDF's would be paid to it.
  test(
    'holds the code the PDF prints: its payload byte for byte, its level and its version, 46 mm a side',
    async () => {
      const bytes = await renderPdf(document, { maxPages: 5 })
      const [drawn, ...more] = await readCodes(bytes, 1)
      const file = (await readSlipCode(written(document)))!
      expect(more).toEqual([])
      expect(drawn!.text).toBe(resolved.payload)
      expect(file.read).toMatchObject({ text: drawn!.text, ecLevel: drawn!.ecLevel, version: drawn!.version })
      expect(file.read!.bytes).toEqual(drawn!.bytes)
      // The PDF's symbol from its first module to its last, as the scanner found it, is the picture's extent: SIX's 46 mm.
      expect(drawn!.width).toBeCloseTo(file.picture.width, 0)
      expect(file.picture.width).toBeCloseTo(mm(46), 3)
    },
    TIMEOUT,
  )
})

// A suite that compared no slip would hold none.
// Every bill is written whole, most of each write its Swiss QR Code drawn at 600 pixels to the inch: the suite's sixteen took 1.1 seconds
// alone and 3.0 to 3.3 under coverage, which is how CI's test job runs this suite, and 5.4 here beside other work, past vitest's own 5
// seconds, measured on 27 November 2026 on an Intel Core i9-10900K under Node 24.21.0, and 2.2 in CI's job that day (run 46010242982).
// So it takes the bound every other case here takes.
test(
  'every bill of the suite is written by the writer',
  () => {
    expect(BILLS.length).toBeGreaterThan(10)
    for (const [, bill] of BILLS) expect(renderDocx(billDocument(resolvedBill(bill))).length).toBeGreaterThan(0)
  },
  TIMEOUT,
)
