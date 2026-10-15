import { emptyReport, EXPRESSION_NAMES, FIELD_TYPES, PARAMETER_TYPES, VALUE_SCOPES } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { thawed } from '../snapshot.js'
import { frozenSample, sampleReport } from '../test-support.js'
import { compileReport } from './compile-report.js'
import { EXPRESSION_TYPES, SCOPE_NAMES } from './members.js'
import type { ScopeName } from './members.js'

/** What `name` holds in `report`, as plain entries in declaration order. */
const held = (report: ReportDefinition, name: ScopeName): [string, unknown][] => [...compileReport(report).members[name]]

describe('the members each name holds', () => {
  // Each parameter is a member of params, with the type it is checked and
  // bound as. An optional parameter without a default may be null.
  test('params: each parameter, typed, null only when optional without a default', () => {
    expect(held(frozenSample(), 'params')).toEqual([
      ['from', { type: 'string', nullable: false }],
      ['draft', { type: 'bool', nullable: false }],
      ['threshold', { type: 'decimal', nullable: true }],
      ['currency', { type: 'string', nullable: false }],
      ['copies', { type: 'int', nullable: false }],
    ])
  })

  // An image field's value is an asset id the host resolves; it is drawn,
  // never read (0007), so it is no member of header or row.
  test('header and row: each field of their dataset, except images', () => {
    expect(held(frozenSample(), 'header')).toEqual([
      ['customer', { type: 'string', nullable: false }],
      ['orderedOn', { type: 'string', nullable: false }],
      ['currency', { type: 'string', nullable: false }],
    ])
    expect(held(frozenSample(), 'row')).toEqual([
      ['site', { type: 'string', nullable: false }],
      ['sku', { type: 'string', nullable: false }],
      ['quantity', { type: 'int', nullable: false }],
      ['unit_price', { type: 'decimal', nullable: false }],
      ['amount', { type: 'decimal', nullable: false }],
      ['shippedAt', { type: 'string', nullable: true }],
      ['recordedAt', { type: 'timestamp', nullable: false }],
      ['shipped', { type: 'bool', nullable: true }],
    ])
  })

  // An aggregate's type is what it computes (0007): a count is an integer,
  // an average a decimal, a sum, minimum or maximum the type it reads -- for
  // an expression, the type the compiler gives it, so a total over an
  // expression is checked like any other. Over no rows only count and sum
  // have a value. A group also holds its key, the value it is keyed by, of
  // the type of the field grouped by; without it a group header could print
  // its key only as a field, never compute with it.
  test('totals and group: each aggregate, typed by what it computes, an expression by what it gives; group its key too', () => {
    const aggregates = [
      ['subtotal', { type: 'decimal', nullable: false }],
      ['lines', { type: 'int', nullable: false }],
      ['gross', { type: 'decimal', nullable: false }],
      ['average', { type: 'decimal', nullable: true }],
      ['latest', { type: 'timestamp', nullable: true }],
    ]
    expect(held(frozenSample(), 'totals')).toEqual(aggregates)
    expect(held(frozenSample(), 'group')).toEqual([...aggregates, ['key', { type: 'string', nullable: false }]])
  })

  // The key is the grouped field's value, so it has that field's type and
  // may be null where the field may: the rows without a value are a group
  // of their own, keyed by null.
  test('types the group key as the field grouped by, null where that field may be', () => {
    const report = thawed(sampleReport())
    const table = report.regions.body[2]
    if (table?.kind !== 'table' || table.group === undefined) throw new Error('the sample has moved its table')
    table.group.by = { dataset: 'detail', field: 'shippedAt' }
    table.group.header = [{ kind: 'text', text: 'Shipped' }]
    table.sort = []
    expect(held(report, 'group').at(-1)).toEqual(['key', { type: 'string', nullable: true }])
  })

  // A report whose table does not group has no group to key: group holds
  // the aggregates and nothing else.
  test('holds no key when the table does not group', () => {
    const report = thawed(sampleReport())
    const table = report.regions.body[2]
    if (table?.kind !== 'table') throw new Error('the sample has moved its table')
    delete table.group
    expect(held(report, 'group').map(([id]) => id)).toEqual(['subtotal', 'lines', 'gross', 'average', 'latest'])
  })

  // A minimum is the type of what it reads, and null over no rows.
  test('types a minimum of an expression as the expression, null over no rows', () => {
    const report = { ...sampleReport(), aggregates: [{ id: 'least', fn: 'min', of: { kind: 'expression', expression: { cel: 'row.quantity' } } }] } as const
    expect(held(report, 'totals')).toEqual([['least', { type: 'int', nullable: true }]])
  })

  // A blank report declares nothing, and its expressions read nothing.
  test('holds no members in a blank report', () => {
    const { members } = compileReport(emptyReport('blank', 'Blank', 'en'))
    expect(SCOPE_NAMES.every((name) => members[name].size === 0)).toBe(true)
  })

  // A report without a header dataset still has header, with no members:
  // the name is the format's, whatever the report declares.
  test('holds header with no members when no header dataset is declared', () => {
    const { header: _gone, ...datasets } = sampleReport().datasets
    expect(held({ ...sampleReport(), datasets }, 'header')).toEqual([])
  })
})

describe('SCOPE_NAMES', () => {
  // A name the format adds to EXPRESSION_NAMES must say what it holds here,
  // or an expression in that scope would read nothing under it.
  test('are every name the format binds, in every scope', () => {
    const names = new Set(VALUE_SCOPES.flatMap((scope) => EXPRESSION_NAMES[scope]))
    expect([...names].sort()).toEqual([...SCOPE_NAMES].sort())
  })
})

describe('EXPRESSION_TYPES', () => {
  // Every field type but image, and so every parameter type, has the type
  // an expression reads it as; a type added to the format without one would
  // be read as nothing.
  test('types every readable field type and every parameter type', () => {
    expect(Object.keys(EXPRESSION_TYPES).sort()).toEqual(FIELD_TYPES.filter((type) => type !== 'image').sort())
    for (const type of PARAMETER_TYPES) expect(EXPRESSION_TYPES[type]).toBeDefined()
  })
})
