import {
  ORDER_CONFIRMATION,
  orderConfirmationData,
  orderConfirmationLines,
  readPdf,
  starterImages,
  verify,
  type OrderConfirmationLine,
  type ReadPdf,
} from '@formancy/report-corpus'
import { resolveReport, type Block, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { fixtureOf, normalise, TIMEOUT } from './testing/documents.js'
import { crowding, MARGIN, markAt, marksOn } from './testing/letterhead.js'
import { pageLines } from './testing/lines.js'

/**
 * The order confirmation starter (0064), end to end: resolved by the
 * runtime against its synthetic data, rendered by pdfmake and proved on
 * the PDF it produced, read back with PDF.js (0003). What each of its three
 * tables prints is proved apart from the runtime: its lines picked by
 * their kind, ordered and grouped here from the data, each total
 * recomputed in plain BigInt and formatted with Intl (0062). Its pages are
 * proved by where their lines and the firm's mark stand: the letterhead on
 * page 1 alone and the running header from page 2 (0060), and the third
 * delivery's header kept with its first three lines on page 2, where kept
 * with one it would stand at the foot of page 1 (0059).
 */

const CREATED = '2026-11-16T08:00:00Z'
const LOCALE = 'de-CH'

const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
const decimal = (value: bigint): string =>
  `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`
/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** An amount in Swiss francs as Intl prints it in Swiss German, handed the exact decimal string, with its spaces as a PDF line has them. */
const francs = (value: bigint): string =>
  normalise(
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      decimal(value) as Intl.StringNumericLiteral,
    ),
  )
/** A quantity as Intl prints it with two places and grouping. */
const quantity = (value: string): string =>
  normalise(new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value as Intl.StringNumericLiteral))
/** A day as Intl writes it in Swiss German, long or medium. */
const day = (iso: string, style: 'long' | 'medium'): string =>
  new Intl.DateTimeFormat(LOCALE, { dateStyle: style, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

const LINES = orderConfirmationLines()
const of = (kind: OrderConfirmationLine['kind']): OrderConfirmationLine[] => LINES.filter((line) => line.kind === kind)
const sum = (lines: readonly OrderConfirmationLine[]): bigint => lines.reduce((total, line) => total + cents(line.amount), 0n)
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const byArticle = (lines: readonly OrderConfirmationLine[]): OrderConfirmationLine[] => [...lines].sort((a, b) => byCodeUnit(a.article, b.article))

/** The goods' deliveries, in the order their days come, each with its lines by article. */
function deliveries(): [string, OrderConfirmationLine[]][] {
  const days = [...new Set(of('goods').map(({ delivery }) => delivery))].sort(byCodeUnit)
  return days.map((each) => [each, byArticle(of('goods').filter(({ delivery }) => delivery === each))])
}

/** What each table prints, line by line, its header first: the goods by delivery, the services, the returns, each closed by its own total. */
function tableLines(): string[] {
  const goods = ({ article, description, quantity: count, unit, unitPrice, amount }: OrderConfirmationLine) =>
    `${article} ${description} ${quantity(count)} ${unit} ${francs(cents(unitPrice))} ${francs(cents(amount))}`
  const service = ({ description, quantity: count, unit, unitPrice, amount }: OrderConfirmationLine) =>
    `${description} ${quantity(count)} ${unit} ${francs(cents(unitPrice))} ${francs(cents(amount))}`
  const credit = ({ article, description, quantity: count, unit, amount }: OrderConfirmationLine) =>
    `${article} ${description} ${quantity(count)} ${unit} ${francs(cents(amount))}`
  return [
    'Waren',
    'Artikel Beschreibung Menge Einheit Preis Betrag',
    ...deliveries().flatMap(([each, lines]) => [`Lieferung vom ${day(each, 'long')}`, ...lines.map(goods), `Zwischensumme Lieferung ${francs(sum(lines))}`]),
    `Total Waren ${francs(sum(of('goods')))}`,
    'Leistungen',
    'Leistung Menge Einheit Ansatz Betrag',
    ...byArticle(of('service')).map(service),
    `Total Leistungen ${francs(sum(of('service')))}`,
    'Rücknahmen',
    'Artikel Beschreibung Menge Einheit Gutschrift',
    ...byArticle(of('return')).map(credit),
    `Total Rücknahmen ${francs(sum(of('return')))}`,
  ]
}

async function rendered(document: ResolvedDocument): Promise<ReadPdf> {
  return readPdf(await renderPdf(document, { maxPages: 20 }))
}

function resolved(): ResolvedDocument {
  const outcome = resolveReport(ORDER_CONFIRMATION.report, orderConfirmationData(), {
    mode: 'final',
    parameters: {},
    images: starterImages,
    creationDate: CREATED,
  })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

/** Each page's lines, top to bottom. */
const linesOn = (pdf: ReadPdf): string[][] => pdf.pages.map((page) => pageLines(page).map((line) => line.text))

const RUNNING_HEAD = 'Auftragsbestätigung AB-2026-1107 · Bäckerei Müller AG'
const SENDER = 'Formancy Haustechnik AG · Industriestrasse 7 · 3052 Zollikofen · CHE-123.456.789 MWST'

describe('the order confirmation', () => {
  // The three tables over one list, line by line, across the page break:
  // each under its own header prints the lines of its kind and no other's,
  // the goods grouped by delivery and each delivery closed by its own
  // subtotal, every table closed by the total of what it printed; and
  // under them the order's net, VAT and total, over every line. A table
  // that printed every line, a total of another table's lines or of every
  // line, or a delivery's subtotal of another's, would read otherwise here.
  // The page regions and the column header a table repeats on page 2 are
  // taken out, so what is held is each table's own lines in order.
  test(
    'prints each table’s own lines, grouped and totalled as its own, and the order’s totals over every line',
    async () => {
      const pdf = await rendered(resolved())
      const pages = linesOn(pdf)
      const goodsHeader = 'Artikel Beschreibung Menge Einheit Preis Betrag'
      const body = pages.flatMap((lines, index) =>
        lines.filter((line, at) => line !== RUNNING_HEAD && !/^Seite \d+ von \d+$/.test(line) && !(index > 0 && at <= 1 && line === goodsHeader)),
      )
      const start = body.indexOf('Waren')
      const tables = tableLines()
      expect(body.slice(start, start + tables.length)).toEqual(tables)
      const net = sum(LINES)
      const vat = halfAway(net * 81n, 1000n)
      expect(body.slice(start + tables.length, start + tables.length + 3)).toEqual([
        `Nettobetrag ${francs(net)}`,
        `MWST 8.1 % ${francs(vat)}`,
        `Total ${francs(net + vat)}`,
      ])
      expect(of('return').every((line) => cents(line.amount) < 0n)).toBe(true)
    },
    TIMEOUT,
  )

  // The layout, by the corpus's checks over the document the runtime
  // resolved: every row of the three tables once and in its place, under
  // its table's header and its column header repeated on page 2; page 1
  // holding its own header's lines and its mark, and page 2 the page
  // header's; each delivery's header on the page of the lines it keeps; the
  // footer on every page; no run over another or past a margin.
  test(
    'lays its two pages out whole, each delivery’s header with the lines it keeps',
    async () => {
      const document = resolved()
      const pdf = await rendered(document)
      expect(pdf.pages).toHaveLength(2)
      expect(verify(fixtureOf('order-confirmation', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
    },
    TIMEOUT,
  )

  // Page 1 opens with the firm's letterhead, its mark at the margins'
  // corner and its line of whom it is from first under it, with no running
  // header above it; page 2 opens with the running header, the order's
  // number, and draws no mark; each page counts itself of two. A running
  // header on page 1 would stand over the letterhead, and a letterhead in
  // the page header would print on page 2 too.
  test(
    'prints its letterhead on page 1 and the running header from page 2, and counts its pages',
    async () => {
      const pdf = await rendered(resolved())
      const [first, second] = pdf.pages
      const pages = linesOn(pdf)
      expect(marksOn(first!)).toEqual([markAt(MARGIN)])
      expect(crowding(first!, markAt(MARGIN))).toEqual([])
      expect(pages[0]?.[0]).toBe(SENDER)
      expect(pages[0]).not.toContain(RUNNING_HEAD)
      expect(marksOn(second!)).toEqual([])
      expect(pages[1]?.[0]).toBe(RUNNING_HEAD)
      expect(pages[1]).not.toContain(SENDER)
      expect(pages.map((lines) => lines.at(-1))).toEqual(['Seite 1 von 2', 'Seite 2 von 2'])
      expect(pages[0]).toEqual(expect.arrayContaining(['Bäckerei Müller AG', 'Nummer: AB-2026-1107', `Datum: ${day('2026-11-16', 'medium')}`]))
    },
    TIMEOUT,
  )

  // The third delivery's header falls at the foot of page 1, where its
  // first two lines would fit under it and the third would not: kept with
  // its first three lines, the header and those lines start page 2. With
  // the count taken out of the resolved document, the rule before 0059,
  // the same header stands on page 1 with two lines under it and the third
  // on page 2: so the page end the starter is to show is really met, and a
  // count the renderer ignored would fail here.
  test(
    'keeps the third delivery’s header with its first three lines on page 2, where kept with one it stands at the foot of page 1',
    async () => {
      const document = resolved()
      const [third, lines] = deliveries()[2]!
      const header = `Lieferung vom ${day(third, 'long')}`
      const kept = (pdf: ReadPdf): number[] =>
        [header, ...lines.slice(0, 3).map(({ article }) => article)].map(
          (key) => pdf.pages.find((page) => pageLines(page).some((line) => ` ${line.text} `.startsWith(` ${key} `)))?.number ?? 0,
        )
      expect(kept(await rendered(document))).toEqual([2, 2, 2, 2])
      const goods = document.body.find((block) => block.kind === 'table' && block.id === 'goods')
      expect(goods?.kind === 'table' && goods.rows.filter((row) => row.kind === 'groupHeader').map((row) => row.keepWithRows)).toEqual([3, 3, 3])
      const strip = (blocks: readonly Block[]): Block[] =>
        blocks.map((block) => (block.kind === 'table' ? { ...block, rows: block.rows.map(({ keepWithRows: _kept, ...row }) => row) } : block))
      expect(kept(await rendered({ ...document, body: strip(document.body) }))).toEqual([1, 1, 1, 2])
    },
    TIMEOUT,
  )
})
