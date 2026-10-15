import { compareDecimal, decimalFromString, decimalToString } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import type { ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { checkData } from './data.js'
import type { CheckedRecord } from './data.js'
import { groupRows, orderKeys, orderRows, orderTable } from './sort-group.js'
import type { OrderKey, OrderedRow } from './sort-group.js'
import { below, sampleData, sampleReport, sampleRow, seeded } from './test-support.js'

/** Records with one field, `value`, holding each of `values`. */
const records = (values: readonly unknown[]): CheckedRecord[] => values.map((value) => Object.freeze({ value }) as CheckedRecord)

/** The provider's index of each row, in the order given. */
const indices = (rows: readonly OrderedRow[]): number[] => rows.map(({ index }) => index)

const key = (type: OrderKey['type'], direction: OrderKey['direction'] = 'asc'): OrderKey => ({ field: 'value', type, direction })

const dec = decimalFromString

describe('orderRows', () => {
  // Decimals compare by value: as strings, 10.00 sorts before 9.5, and 1.5
  // and 1.50 are different keys.
  test('orders decimals by value, and equal values by the provider', () => {
    const rows = records([dec('10.00'), dec('9.5'), dec('1.50'), dec('-2'), dec('1.5'), dec('99999999999999999999.99')])
    expect(indices(orderRows(rows, [key('decimal')], 'en'))).toEqual([3, 2, 4, 1, 0, 5])
  })

  // Integers compare as BigInt: past 2^53 two integers a Number would read
  // as one keep their order.
  test('orders integers exactly, past 2^53', () => {
    const rows = records([9007199254740993n, 9007199254740992n, -1n, 10n, 9n])
    expect(indices(orderRows(rows, [key('integer')], 'en'))).toEqual([2, 4, 3, 1, 0])
  })

  // Dates are fixed-width ISO strings, whose order is the calendar's.
  test('orders dates in calendar order', () => {
    const rows = records(['2026-01-02', '2025-12-31', '0005-01-01', '2026-01-01'])
    expect(indices(orderRows(rows, [key('date')], 'en'))).toEqual([2, 1, 3, 0])
  })

  // A fraction of a second is held without trailing zeros, so the strings
  // differ in length: compared as they stand, '10:00:00.5Z' would sort
  // before '10:00:00Z', since '.' comes before 'Z'.
  test('orders date-times and instants by time, fractions included', () => {
    const local = records(['2026-01-01T10:00:01', '2026-01-01T10:00:00.5', '2026-01-01T10:00:00', '2026-01-01T10:00:00.05'])
    expect(indices(orderRows(local, [key('datetime')], 'en'))).toEqual([2, 3, 1, 0])
    const instants = records(['2026-01-01T10:00:00.5Z', null, '2026-01-01T10:00:00Z', '2025-12-31T23:59:59.999999999Z'])
    expect(indices(orderRows(instants, [key('instant')], 'en'))).toEqual([3, 2, 0, 1])
  })

  // Text sorts as the report's language sorts it: in German Ä goes with A,
  // in Swedish after Z. Code-unit order would put it after Z in both.
  test('orders text by the locale', () => {
    const rows = records(['Zürich', 'Äsch', 'Bern', 'Aarau'])
    expect(indices(orderRows(rows, [key('string')], 'de-CH'))).toEqual([3, 1, 2, 0])
    expect(indices(orderRows(rows, [key('string')], 'sv'))).toEqual([3, 2, 0, 1])
  })

  // Two spellings the collator holds equal -- é composed and decomposed --
  // are still different keys: they are ordered by code unit after the
  // collator, so identical keys always stand together and a group never
  // splits around another spelling.
  test('orders text the collator holds equal by code unit, so equal keys stand together', () => {
    const composed = 'é'
    const decomposed = 'é'
    const rows = records([composed, decomposed, composed, decomposed])
    const ordered = orderRows(rows, [key('string')], 'fr')
    expect(ordered.map(({ record }) => record.value)).toEqual([decomposed, decomposed, composed, composed])
    expect(indices(ordered)).toEqual([1, 3, 0, 2])
  })

  // Booleans order false before true.
  test('orders booleans false first', () => {
    expect(indices(orderRows(records([true, false, true]), [key('boolean')], 'en'))).toEqual([1, 0, 2])
  })

  // Nulls go last whichever way a key runs, and a field a preview lacks
  // sorts as null: an empty cell never lands among the values.
  test('puts nulls and missing values last in either direction', () => {
    const rows = records([null, 2n, undefined, 1n])
    expect(indices(orderRows(rows, [key('integer')], 'en'))).toEqual([3, 1, 0, 2])
    expect(indices(orderRows(rows, [key('integer', 'desc')], 'en'))).toEqual([1, 3, 0, 2])
  })

  // Descending reverses the values, not the provider's order among equals
  // (0007): rows whose keys are all equal keep the order they came in.
  test('keeps the provider order among equal keys when descending', () => {
    const rows = records([1n, 2n, 1n, 2n])
    expect(indices(orderRows(rows, [key('integer', 'desc')], 'en'))).toEqual([1, 3, 0, 2])
  })

  // Keys apply in order: the second only among rows the first holds equal.
  test('applies keys in order', () => {
    const rows = [
      { site: 'Bern', sku: 'B' },
      { site: 'Basel', sku: 'Z' },
      { site: 'Bern', sku: 'A' },
      { site: 'Basel', sku: 'A' },
    ] as unknown as CheckedRecord[]
    const keys: OrderKey[] = [
      { field: 'site', type: 'string', direction: 'desc' },
      { field: 'sku', type: 'string', direction: 'asc' },
    ]
    expect(indices(orderRows(rows, keys, 'de-CH'))).toEqual([2, 0, 3, 1])
  })

  // Generated: rows with few distinct keys and many ties, in both
  // directions, held to what a stable order means: the keys never step
  // back, equal keys keep the provider's order, and every row appears once.
  // Upstream's compareDecimal is the reference; orderRows compares its own
  // way, on integers scaled once per key.
  test('gives a stable total order on generated rows', () => {
    const next = seeded(4711)
    const values = ['-1', '0', '0.0', '1.5', '1.50', '10', '9.99'].map(dec)
    for (let round = 0; round < 200; round++) {
      const direction = next() < 0.5 ? 'asc' : 'desc'
      const rows = records(Array.from({ length: below(next, 60) }, () => (next() < 0.1 ? null : values[below(next, values.length)])))
      const ordered = orderRows(rows, [key('decimal', direction)], 'en')
      expect([...indices(ordered)].sort((a, b) => a - b)).toEqual(rows.map((_, index) => index))
      for (let at = 1; at < ordered.length; at++) {
        const [before, after] = [ordered[at - 1] as OrderedRow, ordered[at] as OrderedRow]
        const [a, b] = [before.record.value as Decimal | null, after.record.value as Decimal | null]
        if (a === null) {
          expect(b).toBeNull()
          expect(before.index).toBeLessThan(after.index)
          continue
        }
        if (b === null) continue
        const order = compareDecimal(b, a) * (direction === 'asc' ? 1 : -1)
        expect(order).toBeGreaterThanOrEqual(0)
        if (order === 0) expect(before.index).toBeLessThan(after.index)
      }
    }
  })
})

describe('groupRows', () => {
  // Groups come out in the order of their rows, each with its key, and the
  // rows of a group are consecutive and in order.
  test('makes one group per run of equal keys, key first', () => {
    const ordered = orderRows(records(['Bern', 'Basel', 'Bern', null]), [key('string')], 'de-CH')
    const groups = groupRows(ordered, { field: 'value', type: 'string' })
    expect(groups.map((group) => [group.key, indices(group.rows)])).toEqual([
      ['Basel', [1]],
      ['Bern', [0, 2]],
      [null, [3]],
    ])
  })

  // Decimals that are equal by value are one group, whatever their scale:
  // 1.5 and 1.50 are one amount. The group shows its first row's spelling.
  test('groups decimals by value', () => {
    const ordered = orderRows(records([dec('1.50'), dec('2'), dec('1.5')]), [key('decimal')], 'en')
    const groups = groupRows(ordered, { field: 'value', type: 'decimal' })
    expect(groups.map((group) => [decimalToString(group.key as Decimal), indices(group.rows)])).toEqual([
      ['1.50', [0, 2]],
      ['2', [1]],
    ])
  })

  // A missing value groups with null: both print as an empty key.
  test('groups missing values with nulls', () => {
    const groups = groupRows(orderRows(records([undefined, null]), [key('integer')], 'en'), { field: 'value', type: 'integer' })
    expect(groups.map((group) => [group.key, indices(group.rows)])).toEqual([[null, [0, 1]]])
  })

  // An empty table has no group headers or footers to print.
  test('makes no groups of no rows', () => {
    expect(groupRows([], { field: 'value', type: 'string' })).toEqual([])
  })
})

describe('orderKeys and orderTable', () => {
  const table = (report: ReportDefinition): TableComponent => report.regions.body.find((component) => component.kind === 'table') as TableComponent

  // The group's key orders first, then the sort keys (0007), each typed by
  // the detail contract.
  test('order by the group key first, then the sort keys', () => {
    const report = sampleReport()
    expect(orderKeys(report, table(report))).toEqual([
      { field: 'site', type: 'string', direction: 'asc' },
      { field: 'sku', type: 'string', direction: 'asc' },
    ])
  })

  // A table without sort keys orders by its group's key alone.
  test('order by the group key alone when there are no sort keys', () => {
    const report = sampleReport()
    const { sort: _sort, ...unsorted } = table(report)
    expect(orderKeys(report, unsorted)).toEqual([{ field: 'site', type: 'string', direction: 'asc' }])
  })

  // A table's rows ordered and grouped from checked data: sites in order,
  // the site that is null last, SKUs in order within each.
  test('order and group a table from checked data', () => {
    const report = sampleReport()
    const rows = [
      sampleRow({ site: 'Bern', sku: 'B-2' }),
      sampleRow({ site: null, sku: 'A-1' }),
      sampleRow({ site: 'Aarau', sku: 'C-3' }),
      sampleRow({ site: 'Bern', sku: 'A-9' }),
    ]
    const checked = checkData(report, sampleData(rows), { mode: 'final' })
    if (!checked.ok) throw new Error('refused')
    const ordered = orderTable(report, table(report), checked.data.detail)
    expect(indices(ordered.rows)).toEqual([2, 3, 0, 1])
    expect(ordered.groups?.map((group) => [group.key, indices(group.rows)])).toEqual([
      ['Aarau', [2]],
      ['Bern', [3, 0]],
      [null, [1]],
    ])
  })

  // A table without a group has its rows in order and no groups at all.
  test('give no groups for a table without one', () => {
    const report = sampleReport()
    const { group: _group, ...ungrouped } = table(report)
    const ordered = orderTable(report, ungrouped, records([]))
    expect(ordered).toEqual({ rows: [] })
  })

  // An image has no order; report-spec refuses a report that sorts by one,
  // and one that reached here anyway is a defect.
  test('throw for a key on an image field', () => {
    const report = sampleReport()
    const fields = report.datasets.detail?.fields as unknown as { id: string; type: string }[]
    ;(fields.find(({ id }) => id === 'sku') as { type: string }).type = 'image'
    expect(() => orderKeys(report, table(report))).toThrow(RangeError)
    const { detail: _detail, ...noDetail } = report.datasets
    expect(() => orderKeys({ ...report, datasets: noDetail }, table(report))).toThrow(RangeError)
  })
})
