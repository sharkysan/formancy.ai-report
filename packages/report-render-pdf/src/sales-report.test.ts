import {
  GRID_PAINT,
  readPdf,
  SALES_REPORT,
  salesReportData,
  salesReportLines,
  starterImages,
  verify,
  type PdfBox,
  type PdfPage,
  type PdfPath,
  type PdfTextItem,
  type ReadPdf,
  type SalesReportLine,
} from '@formancy/report-corpus'
import { resolveReport, type AxisChart, type Block, type Chart, type PieChart, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { fixtureOf, normalise, TIMEOUT } from './testing/documents.js'
import { crowding, MARGIN, markAt, marksOn } from './testing/letterhead.js'
import { pageLines } from './testing/lines.js'

/**
 * The monthly sales report starter (0067), end to end: resolved by the
 * runtime against its synthetic data, rendered by pdfmake and proved on
 * the PDF it produced, read back with PDF.js (0003). Its claim is that the
 * charts and the table agree, and it is proved on the page, apart from the
 * runtime: each product line's lines and total, and the month's, are
 * recomputed here in plain BigInt from the data and formatted with Intl;
 * each bar is measured against the gridlines the PDF draws and held to its
 * product line's total, its label to the digits that total prints under
 * its group in the table, and the bars' labels together to the month's
 * total; each slice is measured by the turn its outline sweeps and held
 * to its region's share of the month, and its legend to the region's
 * total and that share rounded once (0055, 0058). No number is carried
 * through `Number` but a measured coordinate and the quotient it is held
 * to. Its pages are proved as the order confirmation's are: the
 * letterhead on page 1 alone, the running header from page 2 (0060).
 */

const CREATED = '2026-12-01T08:00:00Z'
const LOCALE = 'de-CH'

const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
/** A decimal as the runtime writes one, of two places or fewer -- a tick is written with none -- in centimes. */
const centimesOf = (exact: string): bigint => {
  const [whole = '', fraction = ''] = exact.split('.')
  if (fraction.length > 2) throw new RangeError(`${exact} has more places than a centime`)
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`)
}
/** Centimes as a decimal string of two places, which Intl formats exactly. */
const decimal = (value: bigint): string => {
  const size = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${size / 100n}.${String(size % 100n).padStart(2, '0')}`
}
/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** An amount in Swiss francs as Intl prints it in Swiss German, as a table's cell prints it. */
const francs = (value: bigint): string =>
  normalise(
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      decimal(value) as Intl.StringNumericLiteral,
    ),
  )
/** An amount's digits as Intl prints them in Swiss German with two places and grouping, as a chart prints a value. */
const digits = (value: bigint): string =>
  normalise(new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(decimal(value) as Intl.StringNumericLiteral))
/** Thousandths of a whole as Intl prints a percentage of one place in Swiss German. */
const percent = (permille: bigint): string =>
  normalise(
    new Intl.NumberFormat(LOCALE, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      `${permille / 1000n}.${String(permille % 1000n).padStart(3, '0')}` as Intl.StringNumericLiteral,
    ),
  )
/** A day as Intl writes it in Swiss German, medium. */
const day = (iso: string): string => new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
/** A printed amount's centimes, read back from its digits: the grouping's apostrophes and a currency's code dropped. */
const printed = (text: string): bigint =>
  BigInt(
    text
      .replace(/^CHF\s?/, '')
      .replace(/'/g, '')
      .replace('.', ''),
  )

const LINES = salesReportLines()
const total = (lines: readonly SalesReportLine[]): bigint => lines.reduce((sum, line) => sum + cents(line.amount), 0n)
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const MONTH = total(LINES)

/** The lines of each value of `key`, the values in the order of their code units, each value's lines by day and then by number. */
function linesBy(key: 'category' | 'region'): [string, SalesReportLine[]][] {
  const values = [...new Set(LINES.map((line) => line[key]))].sort(byCodeUnit)
  return values.map((value) => [
    value,
    LINES.filter((line) => line[key] === value).sort((a, b) => byCodeUnit(a.date, b.date) || byCodeUnit(a.number, b.number)),
  ])
}

/** What the table prints, line by line, its heading and its header first: each product line headed by its count, its lines, and its total, then the month's. */
function tableLines(): string[] {
  const line = ({ number, date, region, description, quantity, unit, amount }: SalesReportLine): string =>
    `${number} ${day(date)} ${region} ${description} ${digits(cents(quantity))} ${unit} ${francs(cents(amount))}`
  return [
    'Belege nach Sparte',
    'Beleg Datum Region Beschreibung Menge Einheit Betrag',
    ...linesBy('category').flatMap(([category, lines]) => [
      `${category} (${lines.length} Belege)`,
      ...lines.map(line),
      `Total ${category} ${francs(total(lines))}`,
    ]),
    `Total Umsatz ${francs(MONTH)}`,
  ]
}

function resolved(): ResolvedDocument {
  const outcome = resolveReport(SALES_REPORT.report, salesReportData(), { mode: 'final', parameters: {}, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

async function rendered(document: ResolvedDocument): Promise<ReadPdf> {
  return readPdf(await renderPdf(document, { maxPages: 20 }))
}

/** The document's charts, in document order, through its columns. */
function chartsOf(blocks: readonly Block[]): Chart[] {
  return blocks.flatMap((block) =>
    block.kind === 'chart' ? [block] : block.kind === 'columns' ? chartsOf(block.columns.flatMap((column) => column.blocks)) : [],
  )
}

/** Each page's lines, top to bottom. */
const linesOn = (pdf: ReadPdf): string[][] => pdf.pages.map((page) => pageLines(page).map((line) => line.text))

/** The one rectangular clip on `page` of `chart`'s size, which its marks are painted in, and its index among the page's clips. */
function clipOf(page: PdfPage, chart: Chart): { readonly box: PdfBox; readonly index: number } {
  const found = page.clips.flatMap((box, index) =>
    Math.abs(box.width - chart.width) < 0.01 && Math.abs(box.height - chart.height) < 0.01 ? [{ box, index }] : [],
  )
  expect(found, `the clip of the chart ${chart.id}`).toHaveLength(1)
  return found[0]!
}

/** The runs of text inside `box`. */
const inside = (page: PdfPage, box: PdfBox): PdfTextItem[] =>
  page.items.filter((item) => item.x >= box.x && item.x + item.width <= box.x + box.width && item.top >= box.top && item.bottom <= box.top + box.height)

const RUNNING_HEAD = 'Umsatzbericht November 2026 · Formancy Haustechnik AG'
const SENDER = 'Formancy Haustechnik AG · Industriestrasse 7 · 3052 Zollikofen · CHE-123.456.789 MWST'
const COLUMN_HEADER = 'Beleg Datum Region Beschreibung Menge Einheit Betrag'

/**
 * Points: how far a bar's measured height may stand from the height its
 * total is worth on the gridlines the PDF draws. Measured on 17 November
 * 2026, the bars stand at most 0.049 pt from their heights; on this plot
 * 0.25 pt is about CHF 139, so this holds a bar to its total's height, a
 * credit note left out moving one by 0.68 pt or more, and not to the cent:
 * the cent is held by its label, which prints the digits.
 */
const ON_THE_PAGE = 0.25

/**
 * Points along the arc: how far a slice's measured end may stand from
 * where its exact share ends. Measured on 17 November 2026, the slices end
 * at most 0.041 pt from their exact sectors, and a pie drawn from the
 * legend's shares, rounded to a tenth of a percent, would end up to
 * 0.133 pt from them; a tenth of a point tells the two apart.
 */
const ON_THE_ARC = 0.1

describe('the sales report', () => {
  // The table, line by line, across the page break: each product line under
  // its header, which counts its lines, its lines by day and number, its
  // total; then the month's total over every line; and at the head of page
  // 1 the same month's total and count. A group of another product line's
  // lines, a total of another group's or of every line, or a line printed
  // twice or not at all, would read otherwise here. The page regions and
  // the column header the table repeats on page 2 are taken out, so what is
  // held is the table's own lines in order.
  test(
    'prints each product line’s lines, grouped and totalled, and the month’s total over every line',
    async () => {
      const pdf = await rendered(resolved())
      const pages = linesOn(pdf)
      const body = pages.flatMap((lines, index) =>
        lines.filter((line, at) => line !== RUNNING_HEAD && !/^Seite \d+ von \d+$/.test(line) && !(index > 0 && at <= 1 && line === COLUMN_HEADER)),
      )
      const start = body.indexOf('Belege nach Sparte')
      const table = tableLines()
      expect(body.slice(start, start + table.length)).toEqual(table)
      expect(body[start + table.length]).toBe('Beträge in Schweizer Franken ohne MWST; eine Gutschrift mindert den Umsatz ihrer Sparte und ihrer Region.')
      expect(pages[0]).toEqual(
        expect.arrayContaining([
          'Umsatzbericht November 2026',
          'Zeitraum: 1. November 2026 bis 30. November 2026',
          `Umsatz ${francs(MONTH)} aus ${String(LINES.length)} Belegen`,
        ]),
      )
      expect(LINES.some((line) => cents(line.amount) < 0n)).toBe(true)
    },
    TIMEOUT,
  )

  // The layout, by the corpus's checks over the document the runtime
  // resolved: every row of the table once and in its place, under its
  // column header repeated on page 2, each product line's header on the
  // page of the first three lines it keeps (0059); both charts, each word
  // in its box and its face, each bar its value's length, each slice its
  // share's sector, each legend entry beside its swatch (0058); page 1
  // holding its own header's lines and its mark, and page 2 the page
  // header's (0060); the footer on every page; no run over another or past
  // a margin.
  test(
    'lays its two pages out whole, its charts and its table',
    async () => {
      const document = resolved()
      const pdf = await rendered(document)
      expect(pdf.pages).toHaveLength(2)
      expect(verify(fixtureOf('sales-report', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
    },
    TIMEOUT,
  )

  // Each bar, measured on the page: standing on zero's gridline, as tall
  // as its product line's total is worth on the gridlines the PDF draws,
  // under the category its group heads, and labelled with the very digits
  // that group's total prints in the table, which are the total recomputed
  // here; and the bars' labels add up to the month's total the table
  // prints. A bar of another product line's lines, bars in another order
  // than the table's groups, a label rounded otherwise than the table's
  // total, or a bar drawn to another scale, reads otherwise here.
  test(
    'draws each bar as long as its product line’s total, labelled with the digits its group’s total prints, the bars adding up to the month',
    async () => {
      const document = resolved()
      const pdf = await rendered(document)
      const page = pdf.pages[0]!
      const bars = chartsOf(document.body)[0] as AxisChart
      const { box, index } = clipOf(page, bars)
      const marks = page.paths.filter((path) => path.clip === index && path.paint === 'fill' && path.fill === bars.series[0]?.color).sort((a, b) => a.x - b.x)
      const gridlines = page.paths.filter((path) => path.clip === index && path.paint === 'stroke' && path.stroke === GRID_PAINT).map((path) => path.top)
      const [zero, top] = [Math.max(...gridlines), Math.min(...gridlines)]
      const highest = centimesOf(bars.ticks.at(-1)!.exact)
      expect(centimesOf(bars.ticks[0]!.exact)).toBe(0n)
      const words = inside(page, box)
      const lines = linesOn(pdf).flat()
      const groups = linesBy('category')
      expect(marks).toHaveLength(groups.length)
      const labels = groups.map(([category, rows], at) => {
        const bar = marks[at] as PdfPath
        const worth = total(rows)
        const middle = (item: PdfTextItem): number => item.x + item.width / 2
        const over = (item: PdfTextItem): boolean => middle(item) > bar.x && middle(item) < bar.x + bar.width
        // Its height is the one quotient carried through Number: its total over the highest tick's, in millionths.
        const height = (Number((worth * 1_000_000n) / highest) / 1_000_000) * (zero - top)
        expect(Math.abs(bar.top + bar.height - zero), `${category} stands on zero`).toBeLessThanOrEqual(ON_THE_PAGE)
        expect(Math.abs(bar.height - height), `${category}'s height`).toBeLessThanOrEqual(ON_THE_PAGE)
        expect(words.filter((item) => over(item) && item.top > zero).map(({ text }) => text)).toEqual([category])
        // Its label is the run nearest above its end: the chart's title may stand higher up over a bar.
        const label = words
          .filter((item) => over(item) && item.bottom <= bar.top)
          .sort((a, b) => b.bottom - a.bottom)
          .slice(0, 1)
          .map(({ text }) => text)
        expect(label).toEqual([digits(worth)])
        const footer = lines.filter((line) => line.startsWith(`Total ${category} `))
        expect(footer).toEqual([`Total ${category} ${francs(worth)}`])
        expect(printed(footer[0]!.slice(`Total ${category} `.length))).toBe(printed(label[0]!))
        return printed(label[0]!)
      })
      const month = lines.filter((line) => line.startsWith('Total Umsatz '))
      expect(month).toEqual([`Total Umsatz ${francs(MONTH)}`])
      expect(labels.reduce((sum, each) => sum + each, 0n)).toBe(printed(month[0]!.slice('Total Umsatz '.length)))
    },
    TIMEOUT,
  )

  // Each slice, measured on the page by the turn its outline sweeps from
  // noon, clockwise, from where the regions before it end: its region's
  // total over the month's, as the sectors are drawn, to a tenth of a
  // point, which a pie drawn from the legend's rounded shares misses; and its
  // legend entry saying the region's total, recomputed here, and that
  // share rounded once, half away from zero, to a tenth of a percent. A
  // slice of another region's lines, a share of another whole than the
  // month's, or a share rounded twice, reads otherwise here; and the
  // slices' totals, as their legend prints them, add up to the month's
  // total the table prints.
  test(
    'draws each region’s slice its share of the month, its legend its total and that share rounded once',
    async () => {
      const document = resolved()
      const pdf = await rendered(document)
      const page = pdf.pages[0]!
      const pie = chartsOf(document.body)[1] as PieChart
      const { box, index } = clipOf(page, pie)
      const regions = linesBy('region')
      expect(pie.slices).toHaveLength(regions.length)
      const turn = 2 * Math.PI
      /** In radians, clockwise from noon, where `point` stands seen from `centre`, the page's y running down. */
      const at = ([x, y]: readonly [number, number], [cx, cy]: readonly [number, number]): number => (Math.atan2(x - cx, cy - y) + turn) % turn
      let before = 0n
      const words = inside(page, box).map(({ text }) => text)
      const shown = regions.map(([region, rows], slice) => {
        const worth = total(rows)
        const outline = page.paths.find((path) => path.clip === index && path.paint === 'fill' && path.fill === pie.slices[slice]?.color)
        const points = outline?.subpaths[0] ?? []
        const [start, end, centre] = [points[0]!, points.at(-2)!, points.at(-1)!]
        const radius = Math.hypot(start[0] - centre[0], start[1] - centre[1])
        // Of a turn, worked out in BigInt to millionths: where the regions before it end, and what this one sweeps.
        const from = Number((before * 1_000_000n) / MONTH) / 1_000_000
        const sweep = Number((worth * 1_000_000n) / MONTH) / 1_000_000
        const arc = (a: number, b: number): number => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) * turn * radius
        expect(arc(at(start, centre) / turn, from), `where ${region} starts`).toBeLessThanOrEqual(ON_THE_ARC)
        expect(arc(at(end, centre) / turn, (from + sweep) % 1), `where ${region} ends`).toBeLessThanOrEqual(ON_THE_ARC)
        before += worth
        const entry = words.filter((word) => word.startsWith(`${region}:`))
        expect(entry).toEqual([`${region}: ${digits(worth)} (${percent(halfAway(worth * 1000n, MONTH))})`])
        return printed(entry[0]!.slice(`${region}: `.length, entry[0]!.lastIndexOf(' (')))
      })
      expect(before).toBe(MONTH)
      const month = linesOn(pdf)
        .flat()
        .filter((line) => line.startsWith('Total Umsatz '))
      expect(month).toEqual([`Total Umsatz ${francs(MONTH)}`])
      expect(shown.reduce((sum, each) => sum + each, 0n)).toBe(printed(month[0]!.slice('Total Umsatz '.length)))
    },
    TIMEOUT,
  )

  // Page 1 opens with the firm's letterhead, its mark at the margins'
  // corner and its line of whom it is from first under it, with no running
  // header above it; page 2 opens with the running header, the month, and
  // draws no mark; each page counts itself of two. A running header on
  // page 1 would stand over the letterhead, and a letterhead in the page
  // header would print on page 2 too.
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
    },
    TIMEOUT,
  )
})
