import type { ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { frozen, sampleReport } from '../test-support.js'
import { diagnose } from './diagnose.js'
import { tableDiagnostics } from './tables.js'

/**
 * A total of every row printed under a table that prints some of them
 * (0062): the warning, where it is said, and where it is not.
 */

/** The sample with its table changed by `change`. */
function withTable(change: (table: TableComponent) => TableComponent): ReportDefinition {
  const report = sampleReport()
  return frozen({ ...report, regions: { ...report.regions, body: report.regions.body.map((each) => (each.kind === 'table' ? change(each) : each)) } })
}

/** The sample's table given a condition on its rows. */
const selecting = (table: TableComponent): TableComponent => ({ ...table, rowsWhen: { cel: 'row.quantity > 1' } })

describe('a total of every row under a table that selects its rows', () => {
  // The sample's total rows print totals over every row, which under a
  // table of every row are its own. Once the table selects its rows, each
  // of them reads as the total of the rows above it and is not: an
  // aggregate run over the report, and an expression that reads `totals`
  // and not `table`, are each said, naming the table and the total.
  test('is warned of at each total that reads every row', () => {
    const diagnostics = tableDiagnostics(withTable(selecting))
    expect(diagnostics.map(({ code, severity, path, componentId }) => [code, severity, path, componentId])).toEqual([
      ['total-of-every-row', 'warning', '/regions/body/2/totals/0/cells/1/value/over', 'lines'],
      ['total-of-every-row', 'warning', '/regions/body/2/totals/0/cells/2/value/over', 'lines'],
      ['total-of-every-row', 'warning', '/regions/body/2/totals/1/cells/1/value/expression/cel', 'lines'],
    ])
    expect(diagnostics.map(({ message }) => message)).toEqual([
      'the table "lines" prints only the rows its condition selects, and this prints "lines" over every detail row; over "table", it is the total of the rows the table prints',
      'the table "lines" prints only the rows its condition selects, and this prints "subtotal" over every detail row; over "table", it is the total of the rows the table prints',
      'the table "lines" prints only the rows its condition selects, and this reads totals, which are every detail row\'s; table.<id> is the total of the rows the table prints',
    ])
    expect(diagnose(withTable(selecting)).filter(({ code }) => code === 'total-of-every-row')).toEqual(diagnostics)
  })

  // A table of every row prints its own totals as `totals`: existing
  // reports say nothing new, nor does a table with no total rows. An
  // expression that reads both names compares the table's rows with every
  // row on purpose -- a share of the whole -- and a group's header and
  // footer print a group's share of every row more often than by mistake:
  // neither is said.
  test("is not warned of under a table of every row or with no total rows, beside the table's own total, or in a group's rows", () => {
    expect(tableDiagnostics(withTable((table) => table))).toEqual([])
    const { totals: _totals, ...untotalled } = selecting(sampleReport().regions.body[2] as TableComponent)
    expect(tableDiagnostics(withTable(() => untotalled))).toEqual([])
    const shares = withTable((table) => ({
      ...selecting(table),
      group: {
        ...(table.group as NonNullable<TableComponent['group']>),
        footer: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'report' } }] }],
      },
      totals: [
        { cells: [{ column: 'amount', value: { kind: 'expression', expression: { cel: 'divide(table.subtotal * dec("100"), totals.subtotal, 1)' } } }] },
      ],
    }))
    expect(tableDiagnostics(shares)).toEqual([])
  })
})
