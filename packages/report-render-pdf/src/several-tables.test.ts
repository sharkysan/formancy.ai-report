import { readPdf, verify } from '@formancy/report-corpus'
import { resolveReport, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { fixtureOf, normalise, TIMEOUT } from './testing/documents.js'
import { pageLines } from './testing/lines.js'
import { ORDER_LINES, orderData, SEVERAL_TABLES, type OrderLine } from './testing/several-tables.js'

/**
 * Several tables over one detail dataset (0062), end to end: the order's
 * goods, its services and its returns, each a table selecting its lines
 * by a condition, resolved by the runtime, rendered by pdfmake, and proved
 * on the PDF it produced, read back with PDF.js (0003). The corpus's
 * checks prove the layout: every row once and in its place, each header
 * where its table prints, nothing over a margin or over other text. What
 * each table prints is proved apart from the runtime: its lines selected,
 * ordered and grouped here from the data, each total recomputed in plain
 * BigInt and formatted with Intl, and the PDF must read exactly that.
 */

const CREATED = '2026-11-15T08:00:00Z'

const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
const decimal = (value: bigint): string => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`

/** An amount in Swiss francs as Intl prints it in English, handed the exact decimal string, with its spaces as a PDF line has them. */
const francs = (value: bigint): string =>
  normalise(
    new Intl.NumberFormat('en', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      decimal(value) as Intl.StringNumericLiteral,
    ),
  )

const sum = (rows: readonly OrderLine[]): bigint => rows.reduce((total, row) => total + cents(row.amount), 0n)
const printed = (row: OrderLine): string => `${row.item} ${row.quantity} ${francs(cents(row.amount))}`
const of = (kind: OrderLine['kind']): OrderLine[] => ORDER_LINES.filter((row) => row.kind === kind)
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** The goods, by category and then by item, each category headed and closed by its subtotal, then the table's total and count. */
function goodsLines(): string[] {
  const goods = of('goods')
  const categories = [...new Set(goods.map(({ category }) => category))].sort(byCodeUnit)
  return [
    ...categories.flatMap((category) => {
      const own = goods.filter((row) => row.category === category).sort((a, b) => byCodeUnit(a.item, b.item))
      return [`Category ${category}`, ...own.map(printed), `Subtotal ${category} ${francs(sum(own))}`]
    }),
    `Goods total ${francs(sum(goods))}`,
    `Goods lines ${goods.length}`,
  ]
}

/** The services, largest first, then the table's total and its share of every line. */
function serviceLines(): string[] {
  const services = of('service').sort((a, b) => (cents(a.amount) > cents(b.amount) ? -1 : cents(a.amount) < cents(b.amount) ? 1 : 0))
  return [...services.map(printed), `Services total ${francs(sum(services))}`, `Service lines ${services.length} of ${ORDER_LINES.length}`]
}

async function rendered(): Promise<{ readonly document: ResolvedDocument; readonly lines: string[]; readonly pdf: Awaited<ReturnType<typeof readPdf>> }> {
  const outcome = resolveReport(SEVERAL_TABLES, orderData(), { mode: 'final', creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  const pdf = await readPdf(await renderPdf(outcome.document, { maxPages: 5 }))
  return { document: outcome.document, lines: pdf.pages.flatMap((page) => pageLines(page).map((line) => line.text)), pdf }
}

describe('several tables over one detail dataset', () => {
  // The whole page, line by line: each table under its own header prints
  // its lines and no other's, in its own order and groups; each subtotal
  // and total is the sum of the lines printed above it; the table that
  // selects nothing prints its empty text and a total of 0; and the
  // summary's total is every line's. A table that printed every row, or a
  // total of rows it does not show, would read otherwise here.
  test(
    'prints each table’s own lines, ordered, grouped and totalled as its own, and the order’s total of every line',
    async () => {
      const { lines } = await rendered()
      expect(of('return')).toEqual([])
      expect(lines).toEqual([
        'Order 4711',
        'Goods delivered',
        'Item Qty Amount',
        ...goodsLines(),
        'Services rendered',
        'Service Hours Amount',
        ...serviceLines(),
        'Returns',
        'Returned item Qty Amount',
        'No returns on this order.',
        `Returns total ${francs(0n)}`,
        'Return lines 0',
        `Order total ${francs(sum(ORDER_LINES))} for ${ORDER_LINES.length} lines`,
      ])
    },
    TIMEOUT,
  )

  // The layout, by the corpus's checks over the document the runtime
  // resolved: every row of the three tables once and in its place, under
  // its table's header, and no run drawn over another or past a margin.
  test(
    'lays the three tables out whole, no run over another',
    async () => {
      const { document, pdf } = await rendered()
      expect(document.body.filter((block) => block.kind === 'table').map((block) => block.id)).toEqual(['goods', 'services', 'returns'])
      expect(verify(fixtureOf('several-tables', document, { maxPagesExpected: 1, exactText: ['No returns on this order.'] }), pdf)).toEqual([])
    },
    TIMEOUT,
  )
})
