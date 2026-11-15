/**
 * The builder scenarios about a table's group: how many of the group's
 * first rows its header is kept on its page with (0059), a number on a
 * grouped table's properties. It reads one where the report states none,
 * takes a count typed into the group, shows the validator's reason on
 * itself for one out of range, writes one as the member's absence, and is
 * undone; given back as it reads, it is no edit; and a table without a
 * group has no such field. Their own report, an order's lines grouped by
 * delivery, since version 0 has one table and the scenario report has
 * none.
 */
import type { ReportDefinition, TableComponent, TableGroup } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

const detail = (field: string) => ({ kind: 'field', field: { dataset: 'detail', field } }) as const

const GROUP: TableGroup = { by: { dataset: 'detail', field: 'delivery' }, direction: 'asc', header: [detail('delivery')], footer: [] }

/** The order's one table, its lines grouped by delivery, stating no count. */
const LINES: TableComponent = {
  id: 'lines',
  kind: 'table',
  dataset: 'detail',
  columns: [
    { id: 'item', header: 'Item', width: 'fill', align: 'left', value: detail('item') },
    { id: 'quantity', header: 'Quantity', width: 80, align: 'right', value: detail('quantity') },
  ],
  group: GROUP,
  emptyText: 'No lines.',
  repeatHeader: true,
}

/** The order, `lines` its body's one component: a fresh copy. Every runner opens a session over it, which refuses a report the validator does. */
function order(lines: TableComponent): ReportDefinition {
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
          { id: 'delivery', type: 'string', label: 'Delivery', nullable: false },
          { id: 'item', type: 'string', label: 'Item', nullable: false },
          { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
        ],
      },
    },
    parameters: [],
    assets: [],
    aggregates: [],
    regions: { reportHeader: [], pageHeader: [], body: [lines], pageFooter: [], summary: [] },
  }
  return JSON.parse(JSON.stringify(report)) as ReportDefinition
}

/** The order, its lines grouped by delivery. */
const groupedReport = (): ReportDefinition => order(LINES)

/** The order, its table without a group. */
function ungroupedReport(): ReportDefinition {
  const { group: _group, ...lines } = LINES
  return order(lines)
}

/**
 * Whether the order's group, as the session holds it, states `count` --
 * undefined for no count -- and every other member as it was. Its table is
 * its body's one component, and a group taken away keeps nothing it had.
 */
const keeps = (report: ReportDefinition, count: number | undefined): boolean => {
  const { keepWithRows, ...rest }: Partial<TableGroup> = { ...(report.regions.body[0] as TableComponent).group }
  return keepWithRows === count && JSON.stringify(rest) === JSON.stringify(GROUP)
}

/** The scenarios about a table's group, their names in `locale`. */
export function tableGroupScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const table: ScenarioQuery = { role: 'treeitem', name: t('kind.table') }
  const count: ScenarioQuery = { role: PROPERTY_ROLES.number, name: t('field.keepWithRows') }
  const undo: ScenarioQuery = { role: 'button', name: t('action.undo') }
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition = groupedReport): BuilderScenario => ({
    name,
    locale,
    report,
    steps,
  })

  return [
    // A count is the group's: typed, it is written into the group and
    // nothing else of it; out of range, the validator refuses it on the
    // field, and the group keeps what it had; one is the rule every group
    // header already has, written as the member's absence, so a report
    // edited back to one hashes as one never edited; and Undo brings back
    // the count the one replaced.
    scenario('keep a group header with its first rows, a count out of range refused on its field', [
      { do: 'click', ...table },
      { expect: 'value', ...count, value: '1' },
      { do: 'fill', ...count, text: '3' },
      { expect: 'document', says: 'the group keeps three rows with its header', check: (report) => keeps(report, 3) },
      { expect: 'value', ...count, value: '3' },
      { do: 'fill', ...count, text: '0' },
      { expect: 'invalid', ...count },
      { expect: 'document', says: 'the group still keeps three', check: (report) => keeps(report, 3) },
      { do: 'fill', ...count, text: '1' },
      { expect: 'document', says: 'the group states no count', check: (report) => keeps(report, undefined) },
      { expect: 'value', ...count, value: '1' },
      { do: 'click', ...undo },
      { expect: 'document', says: 'the group keeps three again', check: (report) => keeps(report, 3) },
      { expect: 'value', ...count, value: '3' },
    ]),
    // A field that reads one where the report states none, given one back
    // or emptied, as a person tabbing through it does, would otherwise be
    // an edit that changes nothing: an Undo for it, and "Changed" said.
    scenario('a group header’s count given back as it reads changes nothing', [
      { do: 'click', ...table },
      { do: 'fill', ...count, text: '1' },
      { do: 'fill', ...count, text: '' },
      { expect: 'document', says: 'the group states no count', unchanged: true, check: (report) => keeps(report, undefined) },
      { expect: 'value', ...count, value: '1' },
      { do: 'click', ...undo },
      { expect: 'text', ...said, text: t('status.nothingToUndo') },
    ]),
    // A table without a group has no header to keep with anything, and a
    // count written there would be a group of one member, which the format
    // refuses. Its own fields are there, so the field's absence is not the
    // pane's.
    scenario(
      'a table without a group has no count of rows kept with a group header',
      [
        { do: 'click', ...table },
        { expect: 'present', role: PROPERTY_ROLES.text, name: t('field.emptyText') },
        { expect: 'absent', ...count },
      ],
      ungroupedReport,
    ),
  ]
}
