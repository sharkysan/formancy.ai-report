import { Decimal, decimalFromString, decimalToString, evaluate, fixedCapabilities } from '@formancy/expressions'
import type { ExpressionValue } from '@formancy/expressions'
import type { AggregateDef, ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Diagnostic } from '../diagnostics/codes.js'
import { expressionSites } from '../diagnostics/parts.js'
import { frozenSample, sampleReport } from '../test-support.js'
import { compileReport } from './compile-report.js'
import { expressionValues } from './values.js'
import type { ExpressionValues } from './values.js'

const AMOUNT_VALUE = '/regions/body/2/columns/3/value/expression/cel'
const AMOUNT_WHEN = '/regions/body/2/columns/3/styleWhen/0/when/cel'
const INTRO_VALUE = '/regions/body/0/content/2/expression/cel'
const GROSS = '/aggregates/2/of/expression/cel'
const TOTAL_VALUE = '/regions/body/2/totals/1/cells/1/value/expression/cel'

/** The sample with `aggregates` in place of its own. */
const withAggregates = (aggregates: readonly AggregateDef[]): ReportDefinition => ({ ...sampleReport(), aggregates })

/**
 * One row of the sample's data, as a dataset delivers it and the format
 * writes it (0007): an integer and a decimal as their exact strings, an
 * instant with its zone, a date as its ISO string, a missing value as null.
 */
const DATA: ExpressionValues = {
  params: { from: '2026-01-01', draft: false, threshold: null, currency: 'CHF', copies: '2' },
  header: { customer: 'ACME', orderedOn: '2026-01-05', currency: 'CHF' },
  row: {
    site: 'Zürich',
    sku: 'A-1',
    quantity: '3',
    unit_price: '4.1250',
    amount: '12.38',
    shippedAt: null,
    recordedAt: '2026-01-05T10:00:00+01:00',
    shipped: true,
  },
  totals: { subtotal: '12.38', lines: '1', gross: '13.38278', average: '3.0', latest: '2026-01-05T09:00:00Z' },
  group: { subtotal: '12.38', lines: '1', gross: '13.38278', average: '3.0', latest: '2026-01-05T09:00:00Z', key: 'Zürich' },
}

/** The report never calls the clock or a random draw; these are what evaluate requires to be handed. */
const capabilities = fixedCapabilities({ nowMs: 0, today: '2026-01-01', random: 0 })

/** What `pointer`'s expression evaluates to over DATA, a decimal as its string. */
function valueAt(report: ReportDefinition, pointer: string): ExpressionValue | string {
  const compiled = compileReport(report).expressions.get(pointer)
  if (compiled === undefined) throw new Error(`nothing compiled at ${pointer}`)
  const outcome = evaluate(compiled.program, expressionValues(compiled, DATA), { capabilities })
  if (!outcome.ok) throw new Error(`${pointer}: ${outcome.error.message}`)
  const { value } = outcome
  return value instanceof Decimal ? decimalToString(value) : value
}

describe('compileReport', () => {
  // The runtime evaluates what the editor checked, with the same compiler
  // and the same declarations: every expression of a sound report compiles,
  // once, keyed by the pointer to it, and nothing is said against it.
  test('compiles every expression of a sound report, keyed by where it stands', () => {
    const report = frozenSample()
    const { expressions, diagnostics } = compileReport(report)
    expect(diagnostics).toEqual([])
    expect([...expressions.keys()].sort()).toEqual(
      expressionSites(report)
        .map(({ path }) => path)
        .sort(),
    )
  })

  // What a program reads is what the runtime binds: each member under the
  // name it was compiled with, typed as the member is.
  test('says what each program reads, the variable it reads it as and the type it is bound as', () => {
    const compiled = compileReport(frozenSample()).expressions.get(AMOUNT_VALUE)
    expect(compiled?.reads).toEqual([
      { name: 'row', member: 'quantity', variable: 'row_quantity', type: 'int', nullable: false },
      { name: 'row', member: 'unit_price', variable: 'row_unit_price', type: 'decimal', nullable: false },
    ])
    expect(compiled?.program.resultType).toBe('decimal')
  })

  // A review compiles, for each resolution that changes a field's type,
  // the expressions that change can reach and no others (0048): the whole
  // report compiled once a resolution made a review of a report at its
  // bounds take minutes. What the asked-for expressions read is computed
  // from every aggregate's, which are compiled with them.
  test('compiles the expressions asked for alone, with every aggregate and what they read', () => {
    const report = frozenSample()
    const aggregates = expressionSites(report)
      .filter(({ path }) => path.startsWith('/aggregates/'))
      .map(({ path }) => path)
    expect([...compileReport(report, new Set()).expressions.keys()]).toEqual(aggregates)
    const only = compileReport(report, new Set([AMOUNT_VALUE, TOTAL_VALUE]))
    expect([...only.expressions.keys()]).toEqual([AMOUNT_VALUE, TOTAL_VALUE, ...aggregates])
    const whole = compileReport(report).expressions.get(TOTAL_VALUE)
    expect([only.expressions.get(TOTAL_VALUE)?.reads, only.expressions.get(TOTAL_VALUE)?.program.resultType]).toEqual([whole?.reads, whole?.program.resultType])
    const broken = JSON.parse(JSON.stringify(sampleReport()).replace('params.draft == false', 'params.draft ==')) as ReportDefinition
    expect(compileReport(broken, new Set([AMOUNT_VALUE])).diagnostics).toEqual([])
  })

  // An expression an error was diagnosed for has no program: the runtime
  // refuses a report with an error, and has nothing to run in its place.
  test('gives no program for an expression with an error', () => {
    // The first of the two places the sample writes this condition: the intro's.
    const broken = JSON.parse(JSON.stringify(sampleReport()).replace('params.draft == false', 'params.draft ==')) as ReportDefinition
    const { expressions, diagnostics } = compileReport(broken)
    expect(diagnostics.map(({ code, path }) => `${code} ${path}`)).toEqual(['expression-syntax /regions/body/0/visibleWhen/cel'])
    expect(expressions.has('/regions/body/0/visibleWhen/cel')).toBe(false)
  })
})

describe('aggregateOrder', () => {
  // An aggregate whose expression reads a total needs that total computed
  // first, over every row. The order the runtime computes them in is the
  // one the editor checked: each after every aggregate it reads, otherwise
  // as declared.
  test('puts each aggregate after the aggregates its expression reads', () => {
    const share: AggregateDef = {
      id: 'share',
      fn: 'sum',
      of: { kind: 'expression', expression: { cel: 'divide(row.amount * dec("100"), totals.subtotal, 2)' } },
    }
    const report = withAggregates([share, ...sampleReport().aggregates])
    expect(compileReport(report).aggregateOrder).toEqual(['subtotal', 'share', 'lines', 'gross', 'average', 'latest'])
    expect(compileReport(frozenSample()).aggregateOrder).toEqual(['subtotal', 'lines', 'gross', 'average', 'latest'])
  })

  // An aggregate that reads itself, directly or through another, has no
  // place in any order; nor has one that reads such an aggregate. Each is
  // left out, and diagnosed where its expression reads the total that
  // closes the circle.
  test('leaves out the aggregates that read themselves, and those that read them', () => {
    const circular = (id: string, cel: string): AggregateDef => ({ id, fn: 'sum', of: { kind: 'expression', expression: { cel } } })
    const report = withAggregates([
      ...sampleReport().aggregates,
      circular('net', 'row.amount + totals.tax'),
      circular('tax', 'totals.net * dec("0.081")'),
      circular('after', 'totals.net'),
    ])
    const { aggregateOrder, diagnostics, expressions } = compileReport(report)
    expect(aggregateOrder).toEqual(['subtotal', 'lines', 'gross', 'average', 'latest'])
    expect(diagnostics.map(({ code, path, position }) => `${code} ${path} ${position?.start}-${position?.end}`)).toEqual([
      'aggregate-cycle /aggregates/5/of/expression/cel 13-23',
      'aggregate-cycle /aggregates/6/of/expression/cel 0-10',
      'aggregate-cycle /aggregates/7/of/expression/cel 0-10',
    ])
    expect(
      ['/aggregates/5/of/expression/cel', '/aggregates/6/of/expression/cel', '/aggregates/7/of/expression/cel'].some((path) => expressions.has(path)),
    ).toBe(false)
  })
})

describe('expressionValues', () => {
  // The binding is one function the runtime imports. Evaluated by
  // upstream's evaluate over data written as the format writes it, every
  // expression of the sample runs -- a decimal compared with a decimal, an
  // integer turned into one, a timestamp -- where binding members as raw
  // JSON or as maps would fail some of them at render.
  test('binds the data so that every expression of the sample evaluates', () => {
    const report = frozenSample()
    const { expressions } = compileReport(report)
    for (const [pointer, compiled] of expressions) {
      const outcome = evaluate(compiled.program, expressionValues(compiled, DATA), { capabilities })
      expect(outcome.ok, `${pointer}: ${outcome.ok ? '' : outcome.error.message}`).toBe(true)
    }
  })

  // And each gives what the data says: exact decimal arithmetic, rounded as
  // written, an integer printed as one, a comparison of two decimals.
  test.each([
    [AMOUNT_VALUE, '12.38'],
    [AMOUNT_WHEN, false],
    [INTRO_VALUE, 'ACME x2'],
    [GROSS, '13.38278'],
    [TOTAL_VALUE, '13.38278'],
  ])('evaluates %s to %s', (pointer, expected) => {
    expect(valueAt(frozenSample(), pointer)).toEqual(expected)
  })

  // A group header's key is bound as the value of the field grouped by, so
  // the header computes with the site its rows are for.
  test('binds the group key in a group header', () => {
    const report = JSON.parse(
      JSON.stringify(sampleReport()).replace('\\" (\\" + string(group.lines)', '\\" \\" + group.key + \\" (\\" + string(group.lines)'),
    ) as ReportDefinition
    expect(valueAt(report, '/regions/body/2/group/header/2/expression/cel')).toBe(' Zürich (1)')
  })

  // The decimal the binding makes is upstream's own, at the scale written.
  test('binds a decimal at the scale the data writes it', () => {
    const compiled = compileReport(frozenSample()).expressions.get(GROSS)
    expect(compiled && expressionValues(compiled, DATA)).toEqual({ row_amount: decimalFromString('12.38') })
  })
})

/** Where the sample's table stands, the condition a table may be given there, and a cell and a group footer's expression in it. */
const LINES = '/regions/body/2'
const ROWS_WHEN = `${LINES}/rowsWhen/cel`
const GROUP_FOOTER_VALUE = `${LINES}/group/footer/0/cells/1/value/expression/cel`
const GROUP_HEADER_VALUE = `${LINES}/group/header/2/expression/cel`

/** The sample with its table changed by `change`. */
function withTable(change: (table: TableComponent) => TableComponent): ReportDefinition {
  const report = sampleReport()
  return { ...report, regions: { ...report.regions, body: report.regions.body.map((each) => (each.kind === 'table' ? change(each) : each)) } }
}

/** The code and path of each diagnostic of `report`, and its message where `said`. */
const diagnosed = (report: ReportDefinition): string[] => compileReport(report).diagnostics.map(({ code, path }) => `${code} ${path}`)

describe("a table's condition", () => {
  // The condition selects a row by what the row holds, a parameter, the
  // header or a total of every row: compiled in any narrower scope, a
  // condition such as `row.amount < totals.subtotal` would be refused
  // where it means something (0062).
  test('reads the row, the parameters, the header and the totals of every row', () => {
    const report = withTable((table) => ({
      ...table,
      rowsWhen: { cel: 'row.quantity > 1 && params.draft == false && header.customer != "" && row.amount < totals.subtotal' },
    }))
    expect(diagnosed(report)).toEqual([])
    expect(
      compileReport(report)
        .expressions.get(ROWS_WHEN)
        ?.reads.map(({ name, member }) => `${name}.${member}`),
    ).toEqual(['header.customer', 'params.draft', 'row.amount', 'row.quantity', 'totals.subtotal'])
  })

  // The groups and the table's own totals are made of the rows it
  // selects, so a condition that read them would select by what its own
  // selection makes; one that gives no boolean selects nothing anyone
  // could say.
  test("reads neither the group nor the table's totals, and gives a boolean", () => {
    const at = (cel: string): readonly Diagnostic[] => compileReport(withTable((table) => ({ ...table, rowsWhen: { cel } }))).diagnostics
    expect(at('group.lines > 0').map(({ code, message }) => [code, message])).toEqual([
      ['expression-out-of-scope', "group has a value only in a group's header and footer"],
    ])
    expect(at('table.lines > 0').map(({ code, message }) => [code, message])).toEqual([
      ['expression-out-of-scope', "table has a value only in a table's total rows and a group's header and footer"],
    ])
    expect(at('row.quantity').map(({ code, path, componentId }) => [code, path, componentId])).toEqual([['expression-policy', ROWS_WHEN, 'lines']])
  })
})

describe("a table's totals", () => {
  // `table.<id>` is the report's aggregate over the rows the table prints:
  // typed as the aggregate is, read in the table's total rows and its
  // group's header and footer, and nowhere a row is current, since the
  // row is what it is totalled from (0062).
  test('are read as table.<id> under the table, typed as the aggregate, and refused in a cell and a paragraph', () => {
    const report = JSON.parse(
      JSON.stringify(sampleReport()).replace('"cel":"totals.gross"', '"cel":"table.gross"').replace('"cel":"group.lines"', '"cel":"table.lines"'),
    ) as ReportDefinition
    expect(diagnosed(report)).toEqual([])
    expect(compileReport(report).expressions.get(TOTAL_VALUE)?.reads).toEqual([
      { name: 'table', member: 'gross', variable: 'table_gross', type: 'decimal', nullable: false },
    ])
    expect(compileReport(report).expressions.get(GROUP_FOOTER_VALUE)?.reads).toEqual([
      { name: 'table', member: 'lines', variable: 'table_lines', type: 'int', nullable: false },
    ])
    expect(compileReport(report).members.table).toEqual(compileReport(report).members.totals)
    const misplaced = JSON.parse(
      JSON.stringify(sampleReport())
        .replace('"cel":"round(dec(row.quantity) * row.unit_price, 2)"', '"cel":"table.gross"')
        .replace('"cel":"header.customer + \\" x\\" + string(params.copies)"', '"cel":"string(table.lines)"'),
    ) as ReportDefinition
    expect(compileReport(misplaced).diagnostics.map(({ code, path }) => `${code} ${path}`)).toEqual([
      `expression-out-of-scope ${INTRO_VALUE}`,
      `expression-out-of-scope ${AMOUNT_VALUE}`,
    ])
  })
})

describe("a group's key", () => {
  // Two tables grouped by fields of two types: each group's key is its own
  // table's, so `group.key + 1` adds to an integer under one and is
  // refused under the other. Typed by the first grouping table, the second
  // table's key would be checked, and bound, as the other field's type.
  test('is typed in each table by the field that table groups by', () => {
    const report = sampleReport()
    const lines = report.regions.body[2] as TableComponent
    const group = lines.group as NonNullable<TableComponent['group']>
    const byQuantity: TableComponent = {
      ...lines,
      id: 'by-quantity',
      group: { ...group, by: { dataset: 'detail', field: 'quantity' }, header: [{ kind: 'expression', expression: { cel: 'string(group.key + 1)' } }] },
    }
    const twoTables: ReportDefinition = { ...report, regions: { ...report.regions, summary: [...report.regions.summary, byQuantity] } }
    expect(diagnosed(twoTables)).toEqual([])
    const keyed = JSON.parse(
      JSON.stringify(twoTables).replace('"cel":"\\" (\\" + string(group.lines) + \\")\\""', '"cel":"string(group.key + 1)"'),
    ) as ReportDefinition
    expect(diagnosed(keyed)).toEqual([`expression-type ${GROUP_HEADER_VALUE}`])
    expect([...compileReport(twoTables).members.groupKeys]).toEqual([
      ['lines', { type: 'string', nullable: false }],
      ['by-quantity', { type: 'int', nullable: false }],
    ])
  })
})
