/**
 * The builder scenarios about a report's several tables over its detail
 * rows (0062): a further table inserted from the palette by keyboard
 * through the place chooser, given the condition that selects its rows,
 * and both undone; and a table duplicated, its copy given a condition,
 * whose total row, a total of every row as the copy kept it, the problems
 * then warn of. Their own report, an order's lines and one table over
 * them with a total, since the scenario report has no detail rows.
 */
import type { ReportDefinition, TableComponent } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

const detail = (field: string) => ({ kind: 'field', field: { dataset: 'detail', field } }) as const

/** The order's one table: every line, each column a field of it, and a total row of every line's amount. */
const LINES: TableComponent = {
  id: 'lines',
  kind: 'table',
  dataset: 'detail',
  columns: [
    { id: 'item', header: 'Item', width: 'fill', align: 'left', value: detail('item') },
    { id: 'kind', header: 'Kind', width: 80, align: 'left', value: detail('kind') },
    { id: 'amount', header: 'Amount', width: 80, align: 'right', value: detail('amount') },
  ],
  totals: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report' } }] }],
  emptyText: 'No lines.',
  repeatHeader: true,
}

/** The order, its lines its body's one table and its summary empty: a fresh copy. Every runner opens a session over it, which refuses a report the validator does. */
function orderReport(): ReportDefinition {
  const report: ReportDefinition = {
    reportSpecVersion: '0',
    id: 'order',
    title: 'Order',
    locale: 'en',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
    styles: [],
    datasets: {
      detail: {
        id: 'order-lines',
        fields: [
          { id: 'item', type: 'string', label: 'Item', nullable: false },
          { id: 'kind', type: 'string', label: 'Kind', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
        ],
      },
    },
    parameters: [],
    assets: [],
    aggregates: [{ id: 'total', fn: 'sum', of: detail('amount') }],
    regions: { reportHeader: [], pageHeader: [], body: [LINES], pageFooter: [], summary: [] },
  }
  return JSON.parse(JSON.stringify(report)) as ReportDefinition
}

/** Each table of the order, wherever it stands, as its id and its condition: what the scenarios' `document` expectations compare. */
const tables = (report: ReportDefinition): string =>
  [...report.regions.body, ...report.regions.summary]
    .filter((component): component is TableComponent => component.kind === 'table')
    .map((table) => `${table.id}:${table.rowsWhen?.cel ?? 'every row'}`)
    .join(', ')

/** The scenarios about several tables, their names in `locale`. */
export function tablesScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const table = t('kind.table')
  const tree = (name: string, selected?: boolean): ScenarioQuery => ({ role: 'treeitem', name, ...(selected === undefined ? {} : { selected }) })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  /** A table's outline row once two read the same: its kind and its id. */
  const copy = (id: string): string => t('outline.duplicate', { label: table, id })
  /** A column's outline row once a copy of its table repeats it: its heading, and its table's id beside its own. */
  const column = (tableId: string, id: string, header: string): string => t('outline.duplicate', { label: header, id: `${tableId}/${id}` })
  const condition: ScenarioQuery = { role: PROPERTY_ROLES.expression, name: t('field.rowsWhen') }
  const chooser: ScenarioQuery = { role: 'dialog', name: t('places.insert', { kind: table }) }
  const problems: ScenarioQuery = { role: 'status', name: t('pane.problems') }
  const warned = button(t('problem.item', { severity: t('severity.warning'), where: copy('lines-2') }))
  const undo = button(t('action.undo'))
  const scenario = (name: string, steps: readonly ScenarioStep[]): BuilderScenario => ({ name, locale, report: orderReport, steps })

  return [
    // A further table comes in as any component does, from the palette
    // through the place chooser, over every row; its condition is one
    // field of its own, and each is one undo step.
    scenario('insert a second table into the summary by keyboard, give it a condition, and undo both', [
      { do: 'focus', ...button(table) },
      { do: 'press', key: 'Enter' },
      { expect: 'present', ...chooser },
      { do: 'focus', ...button(t('target.inside', { where: t('region.summary') })) },
      { do: 'press', key: 'Enter' },
      { expect: 'absent', ...chooser },
      { expect: 'focused', ...tree(copy('table'), true) },
      { expect: 'document', says: 'the summary holds a second table, of every row', check: (report) => tables(report) === 'lines:every row, table:every row' },
      { expect: 'value', ...condition, value: '' },
      { do: 'fill', ...condition, text: 'row.kind == "service"' },
      {
        expect: 'document',
        says: 'the second table prints the services alone',
        check: (report) => tables(report) === 'lines:every row, table:row.kind == "service"',
      },
      { expect: 'value', ...condition, value: 'row.kind == "service"' },
      { do: 'click', ...undo },
      { expect: 'document', says: 'the second table prints every row again', check: (report) => tables(report) === 'lines:every row, table:every row' },
      { do: 'click', ...undo },
      { expect: 'document', says: 'the order holds its one table again', check: (report) => tables(report) === 'lines:every row' },
      { expect: 'absent', ...tree(copy('table')) },
      { expect: 'present', ...tree(table) },
    ]),
    // A duplicate keeps everything its table had, its total row of every
    // line among it, which no builder edits yet: given a condition, the
    // copy prints some lines over a total of all of them, and the problems
    // say so of the copy, a warning, until the condition is undone. Its
    // columns keep their ids too, and each is still a row of its own name,
    // its table's id beside its own: the copy's Amount is selected by name
    // and the table's own is not.
    scenario('duplicate a table, and a condition on the copy warns of its total of every row', [
      { do: 'click', ...tree(table) },
      { do: 'press', key: 'd', modifiers: ['Control'] },
      { expect: 'document', says: 'a copy of every row follows the table', check: (report) => tables(report) === 'lines:every row, lines-2:every row' },
      { expect: 'focused', ...tree(copy('lines-2'), true) },
      { do: 'fill', ...condition, text: 'row.kind == "goods"' },
      { expect: 'document', says: 'the copy prints the goods alone', check: (report) => tables(report) === 'lines:every row, lines-2:row.kind == "goods"' },
      { expect: 'text', ...problems, text: `${t('pane.problems')} 1` },
      { expect: 'present', ...warned },
      { do: 'click', ...undo },
      { expect: 'absent', ...warned },
      { expect: 'document', says: 'the copy prints every row again', check: (report) => tables(report) === 'lines:every row, lines-2:every row' },
      { do: 'click', ...tree(column('lines-2', 'amount', 'Amount')) },
      { expect: 'focused', ...tree(column('lines-2', 'amount', 'Amount'), true) },
      { expect: 'present', ...tree(column('lines', 'amount', 'Amount'), false) },
    ]),
  ]
}
