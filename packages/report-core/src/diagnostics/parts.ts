/**
 * The parts of a report the diagnostics read: every expression, with the
 * scope its place gives it and what it is for, and every style, asset,
 * field, parameter and aggregate named outside an expression.
 *
 * One walk, so that where an expression stands is decided once: the
 * diagnostics and `compileReport`, which the runtime compiles a report with,
 * both take its sites from here.
 */
import { walkComponents } from '@formancy/report-spec'
import type { Component, ComponentKind, Expression, FieldRef, Format, Inline, ReportDefinition, StyleRule, TableFooterRow, ValueScope } from '@formancy/report-spec'

/** An expression and how to compile it: the names its scope binds, and the policy of what it is for. */
export interface ExpressionSite {
  readonly cel: string
  readonly scope: ValueScope
  /** `visible` for a condition, which must be a boolean; `computed` for a value printed. */
  readonly kind: 'visible' | 'computed'
  /** The JSON Pointer to the expression's `cel`. */
  readonly path: string
  /** The innermost component it stands in; none for an aggregate's. */
  readonly componentId?: string
  /** The table column it belongs to, for a column's value, condition or style rule. */
  readonly columnId?: string
}

/** What an expression belongs to: a component, and within a table a column. */
interface Owner {
  readonly componentId?: string
  readonly columnId?: string
}

/** Everything the report names, outside expressions, and every expression. */
export interface ReportParts {
  readonly expressions: readonly ExpressionSite[]
  readonly styles: readonly string[]
  readonly assets: readonly string[]
  readonly fields: readonly FieldRef[]
  readonly parameters: readonly string[]
  readonly aggregates: readonly string[]
}

/** What one walk collects into, and the places it is collecting from. */
class Collector {
  readonly expressions: ExpressionSite[] = []
  readonly styles: string[] = []
  readonly assets: string[] = []
  readonly fields: FieldRef[] = []
  readonly parameters: string[] = []
  readonly aggregates: string[] = []

  expression(expression: Expression | undefined, path: string, scope: ValueScope, kind: ExpressionSite['kind'], owner: Owner = {}): void {
    if (expression === undefined) return
    this.expressions.push({ cel: expression.cel, scope, kind, path: `${path}/cel`, ...owner })
  }

  style(style: string | undefined): void {
    if (style !== undefined) this.styles.push(style)
  }

  /** Style rules: each a condition read in `scope`, and a style. */
  rules(rules: readonly StyleRule[] | undefined, path: string, scope: ValueScope, owner: Owner): void {
    for (const [index, rule] of (rules ?? []).entries()) {
      this.expression(rule.when, `${path}/${index}/when`, scope, 'visible', owner)
      this.style(rule.style)
    }
  }

  format(format: Format | undefined): void {
    if (format?.kind !== 'currency') return
    if (format.currency.kind === 'field') this.fields.push(format.currency.field)
    if (format.currency.kind === 'parameter') this.parameters.push(format.currency.parameter)
  }

  inline(inline: Inline, path: string, scope: ValueScope, owner: Owner): void {
    if (inline.kind === 'field') this.fields.push(inline.field)
    if (inline.kind === 'parameter') this.parameters.push(inline.parameter)
    if (inline.kind === 'aggregate') this.aggregates.push(inline.aggregate)
    if (inline.kind === 'expression') this.expression(inline.expression, `${path}/expression`, scope, 'computed', owner)
    if ('format' in inline) this.format(inline.format)
  }

  inlines(inlines: readonly Inline[], path: string, scope: ValueScope, owner: Owner): void {
    for (const [index, inline] of inlines.entries()) this.inline(inline, `${path}/${index}`, scope, owner)
  }

  footer(rows: readonly TableFooterRow[] | undefined, path: string, scope: ValueScope, owner: Owner): void {
    for (const [index, row] of (rows ?? []).entries()) {
      for (const [at, cell] of row.cells.entries()) this.inline(cell.value, `${path}/${index}/cells/${at}/value`, scope, owner)
      this.style(row.style)
    }
  }
}

type Reader<K extends ComponentKind> = (component: Extract<Component, { kind: K }>, path: string, into: Collector) => void

const NOTHING = (): void => undefined

/**
 * What each kind holds beyond what every component has. A table over every
 * kind, so a kind added to the format without saying what it names does not
 * compile. What a container holds is visited by the walk itself.
 */
const READERS: { readonly [K in ComponentKind]: Reader<K> } = {
  text: (text, path, into) => into.inlines(text.content, `${path}/content`, 'report', { componentId: text.id }),
  image: (image, _path, into) => {
    if (image.source.kind === 'asset') into.assets.push(image.source.asset)
    else into.fields.push(image.source.field)
  },
  line: NOTHING,
  rectangle: NOTHING,
  spacer: NOTHING,
  columns: NOTHING,
  section: NOTHING,
  pageBreak: NOTHING,
  keepTogether: NOTHING,
  table: (table, path, into) => {
    into.style(table.headerStyle)
    for (const [index, column] of table.columns.entries()) {
      const at = `${path}/columns/${index}`
      const owner = { componentId: table.id, columnId: column.id }
      // A column's value and style rules are read per row; whether it shows
      // is read once per report.
      into.inline(column.value, `${at}/value`, 'row', owner)
      into.expression(column.visibleWhen, `${at}/visibleWhen`, 'report', 'visible', owner)
      into.style(column.style)
      into.rules(column.styleWhen, `${at}/styleWhen`, 'row', owner)
    }
    const owner = { componentId: table.id }
    for (const key of table.sort ?? []) into.fields.push(key.field)
    if (table.group !== undefined) {
      into.fields.push(table.group.by)
      into.inlines(table.group.header, `${path}/group/header`, 'group', owner)
      into.style(table.group.headerStyle)
      into.footer(table.group.footer, `${path}/group/footer`, 'group', owner)
    }
    into.footer(table.totals, `${path}/totals`, 'report', owner)
  },
}

/** Every expression and every name the report holds, in document order, the aggregates' expressions last. */
export function reportParts(report: ReportDefinition): ReportParts {
  const into = new Collector()
  for (const { component, path } of walkComponents(report)) {
    const owner = { componentId: component.id }
    into.expression(component.visibleWhen, `${path}/visibleWhen`, 'report', 'visible', owner)
    into.style(component.style)
    into.rules(component.styleWhen, `${path}/styleWhen`, 'report', owner)
    ;(READERS[component.kind] as Reader<ComponentKind>)(component as never, path, into)
  }
  for (const [index, aggregate] of report.aggregates.entries()) {
    // What an aggregate reads, it reads from each detail row.
    if (aggregate.of?.kind === 'field') into.fields.push(aggregate.of.field)
    if (aggregate.of?.kind === 'expression') into.expression(aggregate.of.expression, `/aggregates/${index}/of/expression`, 'row', 'computed')
  }
  return into
}

/** Every expression in the report, each with the scope it is compiled in and what it is for. */
export function expressionSites(report: ReportDefinition): readonly ExpressionSite[] {
  return reportParts(report).expressions
}
