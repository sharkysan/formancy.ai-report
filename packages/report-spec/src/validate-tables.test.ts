/**
 * Several tables over the detail rows (0062): each with its own columns,
 * order, group and total rows, a condition that selects the rows it
 * prints, totals over those rows read as `table`, and the bound on how
 * many a report holds.
 */
import { describe, expect, test } from 'vitest'
import type { FieldRef } from './data.js'
import { reportHash } from './hash.js'
import { MAX_TABLES } from './limits.js'
import { editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

/** Where the fixture's own table stands, the closing section of its summary, and the end of its summary. */
const LINES = '/regions/body/2'
const CLOSING = '/regions/summary/0/components'
const SUMMARY_END = '/regions/summary/5'

/**
 * A second table over the fixture's detail rows: the shipped ones alone,
 * by site and due date, grouped by SKU, each group and the whole totalled
 * over the rows it prints.
 */
function shippedTable(id = 'shipped'): Record<string, unknown> {
  return {
    id,
    kind: 'table',
    dataset: 'detail',
    rowsWhen: { cel: 'row.shipped == true' },
    columns: [
      { id: 'site', header: 'Site', width: 'fill', align: 'left', value: { kind: 'field', field: detail('site') } },
      { id: 'due', header: 'Due', width: 80, align: 'right', value: { kind: 'field', field: detail('dueOn'), format: { kind: 'date', style: 'short' } } },
      {
        id: 'amount',
        header: 'Amount',
        width: 80,
        align: 'right',
        value: { kind: 'field', field: detail('amount'), format: { kind: 'number', scale: 2, grouping: true } },
      },
    ],
    sort: [{ field: detail('dueOn'), direction: 'asc' }],
    group: {
      by: detail('sku'),
      direction: 'desc',
      header: [{ kind: 'field', field: detail('sku') }],
      footer: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'group' } }] }],
    },
    totals: [
      {
        cells: [
          { column: 'site', value: { kind: 'text', text: 'Shipped' } },
          { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'table' } },
        ],
      },
    ],
    emptyText: 'Nothing shipped.',
    repeatHeader: true,
  }
}

/** A third table, of every row and no order of its own: the SKUs and their quantities. */
function quantitiesTable(): Record<string, unknown> {
  return {
    id: 'quantities',
    kind: 'table',
    dataset: 'detail',
    columns: [
      { id: 'sku', header: 'SKU', width: 'fill', align: 'left', value: { kind: 'field', field: detail('sku') } },
      { id: 'qty', header: 'Qty', width: 50, align: 'right', value: { kind: 'field', field: detail('quantity') } },
    ],
    totals: [{ cells: [{ column: 'qty', value: { kind: 'expression', expression: { cel: 'table.lines' } } }] }],
    emptyText: 'No lines.',
    repeatHeader: true,
  }
}

/** The fixture with the shipped lines' table at the end of its summary and the quantities' in its closing section. */
function threeTables(): Record<string, unknown> {
  const report = editable(richReport())
  setAt(report, SUMMARY_END, shippedTable())
  setAt(report, `${CLOSING}/3`, quantitiesTable())
  return report
}

/** The fixture with `count` tables in all: its own and copies of it after it in the body, and, when `inSection`, the last of them in the summary's closing section. */
function tables(count: number, inSection: boolean): Record<string, unknown> {
  const report = editable(richReport())
  const copies = Array.from({ length: count - 1 }, (_, index) => ({ ...(getAt(report, LINES) as object), id: `copy-${index + 1}` }))
  const inBody = inSection ? copies.slice(0, -1) : copies
  inBody.forEach((copy, index) => setAt(report, `/regions/body/${3 + index}`, copy))
  // The keep-together block and the page break follow the copies, as they followed the table.
  const rest = (richReport().regions.body as readonly unknown[]).slice(3)
  rest.forEach((component, index) => setAt(report, `/regions/body/${3 + inBody.length + index}`, component))
  if (inSection) setAt(report, `${CLOSING}/3`, copies.at(-1))
  return report
}

describe('several tables', () => {
  // Before 0062 a second table was refused whatever it held. Read back
  // whole, each table keeps its own columns, sort keys, group and total
  // rows; one left out of the validator's copy would be dropped by the
  // first edit, and one the hash did not name could change under a pinned
  // publication.
  test('are each read back whole, with their own columns, order, group and totals, and named by the hash', () => {
    const report = threeTables()
    const outcome = validateReport(report)
    expect(outcome.valid ? [] : outcome.errors).toEqual([])
    expect(outcome.valid && outcome.report).toEqual(report)
    const resorted = threeTables()
    setAt(resorted, `${SUMMARY_END}/sort/0/direction`, 'desc')
    const read = validateReport(resorted)
    expect(read.valid && outcome.valid && reportHash(read.report)).not.toBe(outcome.valid && reportHash(outcome.report))
  })

  // A table's condition is what it prints, so it is part of the report: a
  // copy without it would print every row, and a hash without it would
  // name two reports that print differently by one name.
  test("read back a table's condition, which the hash names", () => {
    const outcome = validateReport(threeTables())
    expect(outcome.valid && getAt(outcome.report, `${SUMMARY_END}/rowsWhen`)).toEqual({ cel: 'row.shipped == true' })
    const unconditioned = threeTables()
    removeAt(unconditioned, `${SUMMARY_END}/rowsWhen`)
    const read = validateReport(unconditioned)
    expect(read.valid && outcome.valid && reportHash(read.report)).not.toBe(outcome.valid && reportHash(outcome.report))
  })

  // A condition of only whitespace selects nothing anyone could say: the
  // runtime would have to decide whether that means every row or none.
  test('refuse an empty condition, and one that is no expression', () => {
    const blank = threeTables()
    setAt(blank, `${SUMMARY_END}/rowsWhen/cel`, '  ')
    expect(refusals(blank)).toEqual([`empty-expression ${SUMMARY_END}/rowsWhen/cel`])
    const literal = threeTables()
    setAt(literal, `${SUMMARY_END}/rowsWhen`, 'row.shipped == true')
    expect(refusals(literal)).toEqual([`wrong-type ${SUMMARY_END}/rowsWhen`])
  })
})

describe('the tables a report holds', () => {
  // Each table orders the rows it selects, work no step budget counts, so
  // the number of tables is bounded; counted in containers too, so that
  // wrapping a table in a section does not get round it. The table past
  // the bound is refused where it stands, and none before it.
  test('are at most MAX_TABLES, counting those inside containers', () => {
    expect(refusals(tables(MAX_TABLES, false))).toEqual([])
    expect(refusals(tables(MAX_TABLES, true))).toEqual([])
    expect(refusals(tables(MAX_TABLES + 1, false))).toEqual([`too-many /regions/body/${2 + MAX_TABLES}`])
    expect(refusals(tables(MAX_TABLES + 1, true))).toEqual([`too-many ${CLOSING}/3`])
    const said = validateReport(tables(MAX_TABLES + 1, true))
    expect(said.valid ? [] : said.errors.map(({ message }) => message)).toEqual([
      `a report holds at most ${MAX_TABLES} tables, counting those inside containers, and this is table ${MAX_TABLES + 1}`,
    ])
  })
})

describe("a total over a table's rows", () => {
  // `over: 'table'` totals the rows the table prints: in its total rows,
  // and in its group's header and footer, where a group's share of its
  // table is printed. Anywhere else there is no table whose rows it could
  // be, as there is no group outside a group's rows.
  test("is taken in the table's total rows and its group's header and footer", () => {
    const report = editable(richReport())
    setAt(report, `${LINES}/totals/0/cells/2/value/over`, 'table')
    setAt(report, `${LINES}/group/footer/0/cells/1/value/over`, 'table')
    setAt(report, `${LINES}/group/header/2`, { kind: 'aggregate', aggregate: 'lines', over: 'table' })
    expect(refusals(report)).toEqual([])
  })

  test('is refused in a paragraph and in a cell', () => {
    const paragraph = editable(richReport())
    setAt(paragraph, '/regions/body/0/content/2', { kind: 'aggregate', aggregate: 'lines', over: 'table' })
    expect(refusals(paragraph)).toEqual(['misplaced-table-aggregate /regions/body/0/content/2/over'])
    const cell = editable(richReport())
    setAt(cell, `${LINES}/columns/1/value`, { kind: 'aggregate', aggregate: 'lines', over: 'table' })
    expect(refusals(cell)).toEqual([`misplaced-table-aggregate ${LINES}/columns/1/value/over`])
  })

  // A total row is read once, under the table, where no row is current:
  // reading the table's own scope there changes nothing of that.
  test('leaves a detail field in a total row refused', () => {
    const report = editable(richReport())
    setAt(report, `${LINES}/totals/0/cells/0/value`, { kind: 'field', field: detail('sku') })
    expect(refusals(report)).toEqual([`misplaced-detail-field ${LINES}/totals/0/cells/0/value/field`])
  })
})
