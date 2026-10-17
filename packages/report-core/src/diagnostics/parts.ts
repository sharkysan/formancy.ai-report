/**
 * The parts of a report the diagnostics read: every expression, with the
 * scope its place gives it and what it is for, and every style, asset,
 * field, parameter and aggregate named outside an expression -- in the
 * components and in the payment part.
 *
 * One walk, so that where an expression stands is decided once: the
 * diagnostics and `compileReport`, which the runtime compiles a report with,
 * both take its sites from here.
 */
import { QR_BILL_ADDRESS_RULES, walkComponents } from '@formancy/report-spec'
import type {
  Component,
  ComponentKind,
  Expression,
  FieldRef,
  Format,
  Inline,
  PaymentPart,
  PaymentPartKind,
  QrBillAddress,
  ReportDefinition,
  StyleRule,
  TableFooterRow,
  ValueScope,
} from '@formancy/report-spec'

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
  /** What the expression is the amount of, when it is a payment code's -- a decimal, or null to leave it for the payer. */
  readonly amount?: PaymentAmount
}

/** The payment codes an amount is printed in, as a message names each. */
export type PaymentAmount = 'a QR-bill' | 'an EPC QR code'

/** What an expression belongs to: a component, and within a table a column. */
interface Owner {
  readonly componentId?: string
  readonly columnId?: string
}

/** An aggregate printed with a number or currency format: where, and at how many places. */
export interface PrintedTotal {
  readonly aggregate: string
  readonly scale: number
  /** The JSON Pointer to the format. */
  readonly path: string
  readonly componentId?: string
  readonly columnId?: string
}

/** Everything the report names, outside expressions, and every expression. */
export interface ReportParts {
  readonly expressions: readonly ExpressionSite[]
  /** Every aggregate printed with a format that rounds, in document order. */
  readonly printedTotals: readonly PrintedTotal[]
  readonly styles: readonly string[]
  readonly assets: readonly string[]
  readonly fields: readonly FieldRef[]
  readonly parameters: readonly string[]
  readonly aggregates: readonly string[]
}

/** What one walk collects into, and the places it is collecting from. */
class Collector {
  readonly expressions: ExpressionSite[] = []
  readonly printedTotals: PrintedTotal[] = []
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
    if (inline.kind === 'aggregate' && (inline.format?.kind === 'number' || inline.format?.kind === 'currency')) {
      this.printedTotals.push({ aggregate: inline.aggregate, scale: inline.format.scale, path: `${path}/format`, ...owner })
    }
    if (inline.kind === 'expression') this.expression(inline.expression, `${path}/expression`, scope, 'computed', owner)
    if ('format' in inline) this.format(inline.format)
  }

  inlines(inlines: readonly Inline[], path: string, scope: ValueScope, owner: Owner): void {
    for (const [index, inline] of inlines.entries()) this.inline(inline, `${path}/${index}`, scope, owner)
  }

  /** A payment code's amount: a value, read in the report's scope. */
  amount(expression: Expression | undefined, path: string, of: PaymentAmount, owner: Owner): void {
    if (expression !== undefined) this.expressions.push({ cel: expression.cel, scope: 'report', kind: 'computed', path: `${path}/cel`, ...owner, amount: of })
  }

  /** A text a code holds, read as a paragraph's in the report's scope; absent, it holds none. */
  optionalInlines(inlines: readonly Inline[] | undefined, path: string, owner: Owner): void {
    if (inlines !== undefined) this.inlines(inlines, path, 'report', owner)
  }

  /** Each part of an address, in the order the code holds them; a party absent holds none. */
  address(address: QrBillAddress | undefined, path: string): void {
    for (const part of Object.keys(QR_BILL_ADDRESS_RULES) as (keyof QrBillAddress)[]) {
      const runs = address?.[part]
      if (runs !== undefined) this.inlines(runs, `${path}/${part}`, 'report', {})
    }
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
  // What a QR code encodes is what its content prints, read as a
  // paragraph's in the same place.
  qrCode: (code, path, into) => into.inlines(code.content, `${path}/content`, 'report', { componentId: code.id }),
  // What an EPC QR code encodes, in the order its payload holds it: each
  // text read as a paragraph's in its place, its amount as a value, all
  // named after the code.
  epcQrCode: (code, path, into) => {
    const owner = { componentId: code.id }
    into.optionalInlines(code.bic, `${path}/bic`, owner)
    into.inlines(code.beneficiary, `${path}/beneficiary`, 'report', owner)
    into.inlines(code.iban, `${path}/iban`, 'report', owner)
    into.amount(code.amount, `${path}/amount`, 'an EPC QR code', owner)
    for (const key of ['reference', 'text', 'information'] as const) into.optionalInlines(code[key], `${path}/${key}`, owner)
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

type PartReader<K extends PaymentPartKind> = (part: Extract<PaymentPart, { kind: K }>, path: string, into: Collector) => void

/**
 * What each kind of payment part holds. A table over every kind, as
 * READERS is. A bill stands in no component: its texts are read as a
 * paragraph's in the report's scope, named by their paths alone, in the
 * order the code holds them.
 */
const PAYMENT_PARTS: { readonly [K in PaymentPartKind]: PartReader<K> } = {
  swissQrBill: (bill, path, into) => {
    into.inlines(bill.account, `${path}/account`, 'report', {})
    into.address(bill.creditor, `${path}/creditor`)
    into.amount(bill.amount, `${path}/amount`, 'a QR-bill', {})
    into.address(bill.debtor, `${path}/debtor`)
    for (const key of ['reference', 'message', 'billingInformation'] as const) into.optionalInlines(bill[key], `${path}/${key}`, {})
  },
}

/** Every expression and every name the report holds, in document order -- the components, then the payment part -- the aggregates' expressions last. */
export function reportParts(report: ReportDefinition): ReportParts {
  const into = new Collector()
  for (const { component, path } of walkComponents(report)) {
    const owner = { componentId: component.id }
    into.expression(component.visibleWhen, `${path}/visibleWhen`, 'report', 'visible', owner)
    into.style(component.style)
    into.rules(component.styleWhen, `${path}/styleWhen`, 'report', owner)
    ;(READERS[component.kind] as Reader<ComponentKind>)(component as never, path, into)
  }
  if (report.paymentPart !== undefined) (PAYMENT_PARTS[report.paymentPart.kind] as PartReader<PaymentPartKind>)(report.paymentPart, '/paymentPart', into)
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
