/**
 * A total of every row printed under a table that prints some of them
 * (0062). A table with a condition prints the rows it selects, and its
 * total rows read `table`, the totals of those rows; `totals` is still
 * every detail row's. A total row that prints an aggregate over the
 * report, or an expression that reads `totals` and not `table`, prints a
 * number of rows the table does not show, under them, where it reads as
 * theirs. It renders as written: a grand total under a part of the rows,
 * labelled as one, is a line an author may mean, so it is a warning.
 *
 * Only the table's total rows are said. A group's header and footer print
 * a group's share of every row more often than by mistake, and an
 * expression that reads both names compares the table's rows with every
 * row on purpose. What an expression reads is asked of the parser, as the
 * compiler asks it (`reads.ts`).
 */
import { walkComponents } from '@formancy/report-spec'
import type { Inline, ReportDefinition } from '@formancy/report-spec'
import { expressionReads } from '../expressions/reads.js'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'

/** What a total row's cell prints of every row, said after "this", and where; undefined for one that prints none. */
function everyRow(value: Inline, path: string): { readonly what: string; readonly path: string } | undefined {
  if (value.kind === 'aggregate' && value.over === 'report') {
    return { what: `prints ${quote(value.aggregate)} over every detail row; over "table", it is the total of the rows the table prints`, path: `${path}/over` }
  }
  if (value.kind !== 'expression') return undefined
  const reads = expressionReads([value.expression.cel])
  if (!reads.has('totals') || reads.has('table')) return undefined
  return { what: "reads totals, which are every detail row's; table.<id> is the total of the rows the table prints", path: `${path}/expression/cel` }
}

export function tableDiagnostics(report: ReportDefinition): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const { component, path } of walkComponents(report)) {
    if (component.kind !== 'table' || component.rowsWhen === undefined) continue
    for (const [row, { cells }] of (component.totals ?? []).entries()) {
      for (const [index, cell] of cells.entries()) {
        const said = everyRow(cell.value, `${path}/totals/${row}/cells/${index}/value`)
        if (said === undefined) continue
        const message = `the table ${quote(component.id)} prints only the rows its condition selects, and this ${said.what}`
        found.push(diagnostic('total-of-every-row', message, { path: said.path, componentId: component.id }))
      }
    }
  }
  return found
}
