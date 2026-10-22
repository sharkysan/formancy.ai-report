/**
 * A field removed with everything that reads it (0048): what a review
 * offers where a form version removed a field the report reads, and the
 * author would rather it printed no more.
 *
 * What reads it is what the diagnostics find, from one walk
 * (`reportParts`): a run, a format's currency, an image's source, a sort
 * key, a group's key, an aggregate's field, each where it is named; and an
 * expression, wherever it stands, that reads it by what the parser the
 * compiler asks says it reads (`reads.ts`), never a second reading of CEL.
 * Each reader goes with what holds it: the component, for its content or
 * its condition; the table's column, for its value or its condition; a
 * style rule alone, since a rule says how something prints and never
 * what; a footer cell, and its row where no cell of it is left; a sort
 * key, and the sort with its last; the group, for its key or its header;
 * an aggregate, and then every reader of that aggregate in turn, to the
 * end of the chain. A table whose every column goes, goes whole, and
 * whatever stands inside a component that goes goes with it, once.
 *
 * The payment part and the e-invoice change by their own commands alone
 * (0039, `PART_COMMANDS`): a field either of them reads, directly or
 * through an aggregate, is refused as `read-by-part`, and nothing goes.
 * What is left is the validator's to judge, as every edit's is: a column
 * the e-invoice prints its lines by, gone, refuses the edit whole.
 *
 * `fieldReaders` walks a report and reads its expressions once, for every
 * field a review asks about: the removal, and the expressions a change of
 * the field's type can reach -- those that read it, directly, through an
 * aggregate or as the group's key -- which a review compiles alone.
 */
import { GROUP_KEY, walkComponents } from '@formancy/report-spec'
import type { Component, DatasetRole, ReportDefinition, SortKey, StyleRule, TableComponent, TableFooterRow } from '@formancy/report-spec'
import { reportParts } from '../diagnostics/parts.js'
import type { ExpressionSite, NamedUse } from '../diagnostics/parts.js'
import { expressionReads, READ_AS, readsMember } from '../expressions/reads.js'
import type { Reads } from '../expressions/reads.js'
import { quote, refuse } from '../outcome.js'
import type { CommandOutcome } from '../outcome.js'
import { removeComponent, updateComponent } from './components.js'
import { removeAggregate, removeField } from './declarations.js'
import { removeColumn, removeFooterCell, removeFooterRow, setGroup, setSort, updateColumn } from './table.js'
import type { FooterRows } from './table.js'

/** Where a read stands: a JSON Pointer, and the component and column it is in. */
type Place = Pick<NamedUse, 'path' | 'componentId' | 'columnId'>

/** Each component of a report by its id, and where it stands. */
type Placed = ReadonlyMap<string, { readonly path: string; readonly component: Component }>

/** What holds a read of the field, and so goes with it. */
type Holder =
  | { readonly kind: 'part'; readonly part: 'paymentPart' | 'eInvoice'; readonly path: string }
  | { readonly kind: 'aggregate'; readonly index: number }
  | { readonly kind: 'component'; readonly id: string }
  | { readonly kind: 'rule'; readonly component: string; readonly column?: string; readonly index: number }
  | { readonly kind: 'column'; readonly table: string; readonly column: string }
  | { readonly kind: 'cell'; readonly table: string; readonly footer: FooterRows; readonly row: number; readonly column: string }
  | { readonly kind: 'sort'; readonly table: string; readonly index: number }
  | { readonly kind: 'group'; readonly table: string }

const PART = /^\/(paymentPart|eInvoice)(?:\/|$)/
const AGGREGATE = /^\/aggregates\/(\d+)\//
const RULE = /\/styleWhen\/(\d+)\/when\/cel$/
const CELL = /^\/(totals|group\/footer)\/(\d+)\/cells\/(\d+)\//
const SORT = /^\/sort\/(\d+)$/

/** What holds a read of a table at `rest`, its pointer inside the table. */
function tableHolder(table: TableComponent, rest: string, columnId: string | undefined): Holder {
  if (columnId !== undefined) return { kind: 'column', table: table.id, column: columnId }
  const cell = CELL.exec(rest)
  if (cell !== null) {
    const footer: FooterRows = cell[1] === 'totals' ? 'totals' : 'groupFooter'
    // The walk named a cell of a footer row the table holds.
    const rows = (footer === 'totals' ? table.totals : table.group?.footer) as readonly TableFooterRow[]
    const row = Number(cell[2])
    return { kind: 'cell', table: table.id, footer, row, column: (rows[row] as TableFooterRow).cells[Number(cell[3])]?.column as string }
  }
  if (rest.startsWith('/group/')) return { kind: 'group', table: table.id }
  const sort = SORT.exec(rest)
  return sort === null ? { kind: 'component', id: table.id } : { kind: 'sort', table: table.id, index: Number(sort[1]) }
}

/** What holds the read at `place`, in a report whose components are `placed`. */
function holderOf(placed: Placed, place: Place): Holder {
  const part = PART.exec(place.path)
  if (part !== null) return { kind: 'part', part: part[1] as 'paymentPart' | 'eInvoice', path: place.path }
  const aggregate = AGGREGATE.exec(place.path)
  if (aggregate !== null) return { kind: 'aggregate', index: Number(aggregate[1]) }
  // Every other place a report names a field or an aggregate is in a component, which reportParts names.
  const found = placed.get(place.componentId as string) as { readonly path: string; readonly component: Component }
  const rule = RULE.exec(place.path)
  if (rule !== null) return { kind: 'rule', component: found.component.id, ...(place.columnId === undefined ? {} : { column: place.columnId }), index: Number(rule[1]) }
  if (found.component.kind !== 'table') return { kind: 'component', id: found.component.id }
  return tableHolder(found.component, place.path.slice(found.path.length), place.columnId)
}

/** One walk of a report: what it names where, each expression with what it reads, each component where it stands. */
interface Walk {
  readonly report: ReportDefinition
  readonly named: readonly NamedUse[]
  readonly sites: readonly { readonly site: ExpressionSite; readonly reads: Reads }[]
  readonly walked: readonly { readonly path: string; readonly component: Component }[]
  readonly placed: Placed
}

/** Every place that reads `fieldId` of `slot`, and every reader of an aggregate that reads it, in turn; and the expressions among them, by the pointer to their `cel`. */
function readsOf(walk: Walk, slot: DatasetRole, fieldId: string): { readonly places: readonly Place[]; readonly expressions: ReadonlySet<string> } {
  const expressions = new Set<string>()
  const readers = (names: (use: NamedUse) => boolean, scope: readonly string[], id: string): Place[] => {
    const sites = walk.sites.filter(({ reads }) => readsMember(reads, scope, id)).map(({ site }) => site)
    for (const site of sites) expressions.add(site.path)
    return [...walk.named.filter(names), ...sites]
  }
  const places = readers((use) => use.kind === 'field' && use.field.dataset === slot && use.field.field === fieldId, [READ_AS[slot]], fieldId)
  const gone = new Set<number>()
  for (let next = 0; next < places.length; next++) {
    const aggregate = AGGREGATE.exec((places[next] as Place).path)
    const index = aggregate === null ? undefined : Number(aggregate[1])
    if (index === undefined || gone.has(index)) continue
    gone.add(index)
    const id = (walk.report.aggregates[index] as { readonly id: string }).id
    places.push(...readers((use) => use.kind === 'aggregate' && use.aggregate === id, ['totals', 'group'], id))
  }
  return { places, expressions }
}

/** What goes from one table, by kind. */
interface TableParts {
  readonly columns: Set<string>
  /** Each cell once, by its footer, its row and its column. */
  readonly cells: Map<string, Extract<Holder, { kind: 'cell' }>>
  readonly sort: Set<number>
  group: boolean
}

/** The holders, gathered, once the payment part and the e-invoice are known to hold none: the components, the style rules by component and column, each table's parts, the aggregates by index. */
function gathered(holders: readonly Exclude<Holder, { kind: 'part' }>[]) {
  const components = new Set<string>()
  const rules = new Map<string, Set<number>>()
  const tables = new Map<string, TableParts>()
  const aggregates = new Set<number>()
  const of = (table: string): TableParts => tables.get(table) ?? (tables.set(table, { columns: new Set(), cells: new Map(), sort: new Set(), group: false }).get(table) as TableParts)
  for (const holder of holders) {
    if (holder.kind === 'component') components.add(holder.id)
    else if (holder.kind === 'aggregate') aggregates.add(holder.index)
    else if (holder.kind === 'rule') {
      const key = ruleKey(holder.component, holder.column)
      rules.set(key, (rules.get(key) ?? new Set()).add(holder.index))
    } else if (holder.kind === 'column') of(holder.table).columns.add(holder.column)
    else if (holder.kind === 'cell') of(holder.table).cells.set(`${holder.footer} ${holder.row} ${holder.column}`, holder)
    else if (holder.kind === 'sort') of(holder.table).sort.add(holder.index)
    else of(holder.table).group = true
  }
  return { components, rules, tables, aggregates }
}

/** The key the style rules of a component, or of a column of a table, are gathered by. */
const ruleKey = (component: string, column?: string): string => `${component} ${column ?? ''}`

type Edit = (working: ReportDefinition) => CommandOutcome

/** What goes of one footer of a table: the rows no cell of which is left, and the cells that go alone, by row and column. */
interface FooterFate {
  readonly rows: readonly number[]
  readonly cells: readonly { readonly row: number; readonly index: number; readonly column: string }[]
}

/** What goes of `rows`, a footer of a table whose `parts` go: a cell under a column that goes, with it; a cell that reads the field, alone; a row of which no cell is left, whole. */
function footerFate(rows: readonly TableFooterRow[], footer: FooterRows, parts: TableParts): FooterFate {
  const fate: { rows: number[]; cells: { row: number; index: number; column: string }[] } = { rows: [], cells: [] }
  for (const [row, { cells }] of rows.entries()) {
    const read = (column: string): boolean => parts.cells.has(`${footer} ${row} ${column}`)
    if (cells.length > 0 && cells.every(({ column }) => parts.columns.has(column) || read(column))) fate.rows.push(row)
    else for (const [index, { column }] of cells.entries()) if (read(column) && !parts.columns.has(column)) fate.cells.push({ row, index, column })
  }
  return fate
}

/** The style rules of `rules` kept once those at `gone` go: null where none is left, which removes them. */
function keptRules(rules: readonly StyleRule[], gone: ReadonlySet<number>): readonly StyleRule[] | null {
  const kept = rules.filter((_rule, index) => !gone.has(index))
  return kept.length === 0 ? null : kept
}

/** The pointers to the rules at `gone` under `path`, and the edit that takes them, through `edit`. */
function ruleRemoval(path: string, gone: ReadonlySet<number> | undefined, edit: (kept: readonly StyleRule[] | null) => Edit, rules: readonly StyleRule[] | undefined): { readonly pointers: string[]; readonly edits: Edit[] } {
  if (gone === undefined) return { pointers: [], edits: [] }
  // The walk named a rule of them; one found through an aggregate is found after one that reads the field itself.
  return { pointers: [...gone].sort((a, b) => a - b).map((index) => `${path}/styleWhen/${index}`), edits: [edit(keptRules(rules as readonly StyleRule[], gone))] }
}

/** What goes of `table`, at `path`, as pointers and as the commands that take it: its columns' rules and its columns, its sort keys, its group, its footers' rows and cells. */
function tableRemoval(table: TableComponent, path: string, parts: TableParts | undefined, rules: ReadonlyMap<string, ReadonlySet<number>>): { readonly pointers: string[]; readonly edits: Edit[] } {
  const pointers: string[] = []
  const edits: Edit[] = []
  const later: Edit[] = []
  for (const [index, column] of table.columns.entries()) {
    if (parts?.columns.has(column.id) === true) {
      pointers.push(`${path}/columns/${index}`)
      later.push((working) => removeColumn(working, table.id, column.id))
      continue
    }
    const kept = ruleRemoval(`${path}/columns/${index}`, rules.get(ruleKey(table.id, column.id)), (styleWhen) => (working) => updateColumn(working, table.id, column.id, { styleWhen }), column.styleWhen)
    pointers.push(...kept.pointers)
    edits.push(...kept.edits)
  }
  if (parts === undefined) return { pointers, edits }
  // A sort key names its field outside any expression, so the walk named each in document order, once.
  pointers.push(...[...parts.sort].map((index) => `${path}/sort/${index}`))
  if (parts.group) pointers.push(`${path}/group`)
  const footers: [FooterRows, string, readonly TableFooterRow[] | undefined][] = [['groupFooter', 'group/footer', parts.group ? undefined : table.group?.footer], ['totals', 'totals', table.totals]]
  const rowEdits: Edit[] = []
  for (const [footer, at, rows] of footers) {
    const fate = footerFate(rows ?? [], footer, parts)
    const goes = [...fate.rows.map((row) => ({ row, pointer: `${path}/${at}/${row}` })), ...fate.cells.map(({ row, index }) => ({ row, pointer: `${path}/${at}/${row}/cells/${index}` }))]
    pointers.push(...goes.sort((a, b) => a.row - b.row).map(({ pointer }) => pointer))
    // A cell goes before any row does, while each row stands at its index; the rows go last first.
    edits.push(...fate.cells.map(({ row, column }) => (working: ReportDefinition) => removeFooterCell(working, table.id, footer, row, column)))
    rowEdits.push(...[...fate.rows].reverse().map((row) => (working: ReportDefinition) => removeFooterRow(working, table.id, footer, row)))
  }
  edits.push(...rowEdits)
  if (parts.sort.size > 0) {
    const kept = (table.sort as readonly SortKey[]).filter((_key, index) => !parts.sort.has(index))
    edits.push((working) => setSort(working, table.id, kept.length === 0 ? null : kept))
  }
  if (parts.group) edits.push((working) => setGroup(working, table.id, null))
  return { pointers, edits: [...edits, ...later] }
}

/** The removal of `fieldId` of `slot` from the report `walk` walked, with its readers, as `removeFieldWithReaders` gives it. */
function removal(walk: Walk, slot: DatasetRole, fieldId: string): CommandOutcome<{ readonly removed: readonly string[] }> {
  const { report, walked, placed } = walk
  const fields = report.datasets[slot]?.fields
  if (fields === undefined) return refuse('not-found', `the report declares no ${slot} dataset`, { path: `/datasets/${slot}` })
  const index = fields.findIndex(({ id }) => id === fieldId)
  if (index === -1) return refuse('not-found', `no field of the ${slot} dataset is ${quote(fieldId)}`, { path: `/datasets/${slot}/fields` })
  const holders = readsOf(walk, slot, fieldId).places.map((place) => holderOf(placed, place))
  const part = holders.find((holder) => holder.kind === 'part')
  if (part !== undefined) {
    const what = part.part === 'paymentPart' ? "the report's payment part" : "the report's e-invoice"
    return refuse('read-by-part', `${quote(fieldId)} of the ${slot} dataset is read by ${what}, which only its own commands change: change what it reads there first`, { path: part.path })
  }
  const { components, rules, tables, aggregates } = gathered(holders as Exclude<Holder, { kind: 'part' }>[])
  // A table that loses every column holds nothing to print, and goes whole.
  for (const [id, parts] of tables) if ((placed.get(id)?.component as TableComponent).columns.every((column) => parts.columns.has(column.id))) components.add(id)
  const removed: string[] = []
  const gone: string[] = []
  const edits: Edit[] = []
  for (const { component, path } of walked) {
    if (gone.some((prefix) => path.startsWith(`${prefix}/`))) continue
    if (components.has(component.id)) {
      gone.push(path)
      removed.push(path)
      edits.push((working) => removeComponent(working, component.id))
      continue
    }
    const own = ruleRemoval(path, rules.get(ruleKey(component.id)), (styleWhen) => (working) => updateComponent(working, component.id, component.kind, { styleWhen } as never), component.styleWhen)
    const table = component.kind === 'table' ? tableRemoval(component, path, tables.get(component.id), rules) : { pointers: [], edits: [] }
    removed.push(...own.pointers, ...table.pointers)
    edits.push(...own.edits, ...table.edits)
  }
  for (const at of [...aggregates].sort((a, b) => a - b)) {
    removed.push(`/aggregates/${at}`)
    const id = (report.aggregates[at] as { readonly id: string }).id
    edits.push((working) => removeAggregate(working, id))
  }
  removed.push(`/datasets/${slot}/fields/${index}`)
  edits.push((working) => removeField(working, slot, fieldId))
  let working = report
  for (const edit of edits) {
    const outcome = edit(working)
    if (!outcome.ok) return outcome
    working = outcome.report
  }
  return { ok: true, report: working, removed }
}

/** What reads each field of one report, from one walk of it and one reading of each of its expressions (0048). */
export interface FieldReaders {
  /** The field removed with everything that reads it: what `removeFieldWithReaders` gives, without walking the report again. */
  readonly removal: (slot: DatasetRole, fieldId: string) => CommandOutcome<{ readonly removed: readonly string[] }>
  /**
   * The expressions, by the JSON Pointer to their `cel`, whose compilation
   * a change of the field's type, or of whether it may be null, can
   * change: each that reads it, each that reads an aggregate that reads
   * it, in turn, and, for a field a table is grouped by, each that reads
   * the group's key. `compileReport(report, them)` compiles them alone.
   */
  readonly expressions: (slot: DatasetRole, fieldId: string) => ReadonlySet<string>
}

/** What reads each field of `report`, walked once and its expressions read once, for a review that asks of many fields. */
export function fieldReaders(report: ReportDefinition): FieldReaders {
  const parts = reportParts(report)
  const walked = [...walkComponents(report)]
  const walk: Walk = { report, named: parts.named, sites: parts.expressions.map((site) => ({ site, reads: expressionReads([site.cel]) })), walked, placed: new Map(walked.map((entry) => [entry.component.id, entry])) }
  return {
    removal: (slot, fieldId) => removal(walk, slot, fieldId),
    expressions: (slot, fieldId) => {
      const { expressions } = readsOf(walk, slot, fieldId)
      const grouped = slot === 'detail' && walk.named.some((use) => use.kind === 'field' && use.field.dataset === 'detail' && use.field.field === fieldId && use.path.endsWith('/group/by'))
      return grouped ? new Set([...expressions, ...walk.sites.filter(({ reads }) => readsMember(reads, ['group'], GROUP_KEY)).map(({ site }) => site.path)]) : expressions
    },
  }
}

/**
 * The field `fieldId` of the dataset in `slot` removed, with every
 * component, column, style rule, footer cell and row, sort key, group and
 * aggregate that reads it, and every reader of such an aggregate, as one
 * edit; and what went, as JSON Pointers into the report before it, in
 * document order, the aggregates and the field last. Refused as
 * `not-found` for a field the dataset does not declare, and as
 * `read-by-part` for one the payment part or the e-invoice reads.
 */
export function removeFieldWithReaders(report: ReportDefinition, slot: DatasetRole, fieldId: string): CommandOutcome<{ readonly removed: readonly string[] }> {
  return fieldReaders(report).removal(slot, fieldId)
}
