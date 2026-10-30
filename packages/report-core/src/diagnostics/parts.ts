/**
 * The parts of a report the diagnostics read: every expression, with the
 * scope its place gives it and what it is for, and every style, asset,
 * field, parameter and aggregate named outside an expression -- in the
 * components, in the payment part and in the e-invoice -- and where each
 * field and aggregate is named, for what removes a field with its readers.
 *
 * One walk, so that where an expression stands is decided once: the
 * diagnostics and `compileReport`, which the runtime compiles a report with,
 * both take its sites from here.
 */
import { E_INVOICE_DATES, E_INVOICE_DECIMALS, E_INVOICE_LINE_CODES, E_INVOICE_LINE_COLUMNS, QR_BILL_ADDRESS_RULES, walkComponents } from '@formancy/report-spec'
import type {
  Component,
  ComponentKind,
  EInvoice,
  EInvoiceAddress,
  EInvoiceBuyer,
  EInvoiceDateTerm,
  EInvoiceKind,
  EInvoiceLineCode,
  EInvoiceLineColumn,
  EInvoiceSeller,
  Expression,
  FieldRef,
  FieldType,
  Format,
  Inline,
  PaymentInstructions,
  PaymentPart,
  PaymentPartKind,
  QrBillAddress,
  ReportDefinition,
  RowValue,
  SellerContact,
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
  /**
   * For an expression an e-invoice is written from -- one of the e-invoice's
   * own, or the value of a column that prints a term of each line -- the
   * term it gives the XML. Such an expression is part of what the
   * e-invoice's totals are computed from or written with, so it never
   * reads them.
   */
  readonly term?: InvoiceTerm
  /** For an expression a run holds, the format the run prints its value with, where it has one. */
  readonly format?: Format
}

/** What an expression gives an e-invoice's XML. */
export interface InvoiceTerm {
  /** As a message names it: "the issue date (BT-2)", or, for a run of one of the e-invoice's texts, "a text of the e-invoice". */
  readonly what: string
  /** The types of field it may be, given as an expression reads each -- for a line's term, report-spec's own -- absent for a run, which gives text whatever it computes. */
  readonly types?: readonly FieldType[]
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

/**
 * A field or an aggregate named outside an expression, and where: the JSON
 * Pointer to what names it -- a run, a format's currency, an image's
 * source, a sort key, a group's key, an aggregate's field, a line's code
 * -- and the component and the column it stands in.
 */
export type NamedUse = ({ readonly kind: 'field'; readonly field: FieldRef } | { readonly kind: 'aggregate'; readonly aggregate: string }) & {
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
  /** Each field and aggregate of `fields` and `aggregates`, where it is named, in document order. */
  readonly named: readonly NamedUse[]
}

/** A run of one of an e-invoice's texts: text, whatever it computes. */
const TEXT: InvoiceTerm = { what: 'a text of the e-invoice' }

/** The table an e-invoice's lines are the rows of, and the term each column it names prints. */
interface LineColumns {
  readonly table: string
  readonly columns: ReadonlyMap<string, InvoiceTerm>
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
  readonly named: NamedUse[] = []

  private readonly lines: LineColumns | undefined

  constructor(lines: LineColumns | undefined) {
    this.lines = lines
  }

  expression(
    expression: Expression | undefined,
    path: string,
    scope: ValueScope,
    kind: ExpressionSite['kind'],
    owner: Owner = {},
    term?: InvoiceTerm,
    format?: Format,
  ): void {
    if (expression === undefined) return
    this.expressions.push({
      cel: expression.cel,
      scope,
      kind,
      path: `${path}/cel`,
      ...owner,
      ...(term === undefined ? {} : { term }),
      ...(format === undefined ? {} : { format }),
    })
  }

  /** The term the column `column` of the table `table` prints of each line, when the e-invoice names it. */
  lineTerm(table: string, column: string): InvoiceTerm | undefined {
    return this.lines?.table === table ? this.lines.columns.get(column) : undefined
  }

  style(style: string | undefined): void {
    if (style !== undefined) this.styles.push(style)
  }

  /** A field named at `path`, outside an expression. */
  field(field: FieldRef, path: string, owner: Owner): void {
    this.fields.push(field)
    this.named.push({ kind: 'field', field, path, ...owner })
  }

  /** An aggregate named at `path`, outside an expression. */
  aggregate(aggregate: string, path: string, owner: Owner): void {
    this.aggregates.push(aggregate)
    this.named.push({ kind: 'aggregate', aggregate, path, ...owner })
  }

  /** Style rules: each a condition read in `scope`, and a style. */
  rules(rules: readonly StyleRule[] | undefined, path: string, scope: ValueScope, owner: Owner): void {
    for (const [index, rule] of (rules ?? []).entries()) {
      this.expression(rule.when, `${path}/${index}/when`, scope, 'visible', owner)
      this.style(rule.style)
    }
  }

  format(format: Format | undefined, path: string, owner: Owner): void {
    if (format?.kind !== 'currency') return
    if (format.currency.kind === 'field') this.field(format.currency.field, `${path}/currency`, owner)
    if (format.currency.kind === 'parameter') this.parameters.push(format.currency.parameter)
  }

  inline(inline: Inline, path: string, scope: ValueScope, owner: Owner, term?: InvoiceTerm): void {
    if (inline.kind === 'field') this.field(inline.field, path, owner)
    if (inline.kind === 'parameter') this.parameters.push(inline.parameter)
    if (inline.kind === 'aggregate') this.aggregate(inline.aggregate, path, owner)
    if (inline.kind === 'aggregate' && (inline.format?.kind === 'number' || inline.format?.kind === 'currency')) {
      this.printedTotals.push({ aggregate: inline.aggregate, scale: inline.format.scale, path: `${path}/format`, ...owner })
    }
    if (inline.kind === 'expression') this.expression(inline.expression, `${path}/expression`, scope, 'computed', owner, term, inline.format)
    if ('format' in inline) this.format(inline.format, `${path}/format`, owner)
  }

  inlines(inlines: readonly Inline[], path: string, scope: ValueScope, owner: Owner, term?: InvoiceTerm): void {
    for (const [index, inline] of inlines.entries()) this.inline(inline, `${path}/${index}`, scope, owner, term)
  }

  /** A text of an e-invoice, read as a paragraph's in the report's scope; absent, it holds none. */
  invoiceText(inlines: readonly Inline[] | undefined, path: string): void {
    if (inlines !== undefined) this.inlines(inlines, path, 'report', {}, TEXT)
  }

  /** A code read from each of an e-invoice's lines: a detail field, or an expression in the row's scope. */
  lineCode(value: RowValue, path: string, term: InvoiceTerm): void {
    if (value.kind === 'field') this.field(value.field, path, {})
    else this.expression(value.expression, `${path}/expression`, 'row', 'computed', {}, term)
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
  image: (image, path, into) => {
    if (image.source.kind === 'asset') into.assets.push(image.source.asset)
    else into.field(image.source.field, `${path}/source`, { componentId: image.id })
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
      into.inline(column.value, `${at}/value`, 'row', owner, into.lineTerm(table.id, column.id))
      into.expression(column.visibleWhen, `${at}/visibleWhen`, 'report', 'visible', owner)
      into.style(column.style)
      into.rules(column.styleWhen, `${at}/styleWhen`, 'row', owner)
    }
    const owner = { componentId: table.id }
    for (const [index, key] of (table.sort ?? []).entries()) into.field(key.field, `${path}/sort/${index}`, owner)
    if (table.group !== undefined) {
      into.field(table.group.by, `${path}/group/by`, owner)
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

type InvoiceReader<K extends EInvoiceKind> = (invoice: Extract<EInvoice, { kind: K }>, path: string, into: Collector) => void

/** A date term: a date, read as its ISO string, as a date field is. */
const date = (term: EInvoiceDateTerm): InvoiceTerm => ({ what: E_INVOICE_DATES[term].what, types: ['date'] })

/** The keys of a table over every key of `T`: one added to the format without being read here does not compile. */
const keysOf = <T>(table: { readonly [K in keyof T]-?: true }): readonly (keyof T)[] => Object.keys(table) as (keyof T)[]

/** The texts of each party, of the seller's contact and of an address, and of the payment instructions, in the order the type holds them. */
const SELLER_TEXTS = keysOf<Omit<EInvoiceSeller, 'legalId' | 'electronicAddress' | 'contact' | 'address'>>({ name: true, vatId: true, taxNumber: true })
const BUYER_TEXTS = keysOf<Omit<EInvoiceBuyer, 'legalId' | 'electronicAddress' | 'address'>>({ name: true, vatId: true })
const CONTACT_TEXTS = keysOf<SellerContact>({ name: true, telephone: true, email: true })
const ADDRESS_TEXTS = keysOf<EInvoiceAddress>({ line1: true, line2: true, postalCode: true, city: true, country: true })
const PAYMENT_TEXTS = keysOf<Omit<PaymentInstructions, 'means'>>({ iban: true, bic: true, accountName: true, remittance: true })

/** A party's texts, its legal registration's, its electronic address's, the seller's contact's and its address's, in the order the type holds them. */
function party<P extends EInvoiceSeller | EInvoiceBuyer>(held: P, texts: readonly (keyof P)[], path: string, into: Collector): void {
  for (const key of texts) into.invoiceText(held[key] as readonly Inline[] | undefined, `${path}/${String(key)}`)
  into.invoiceText(held.legalId?.id, `${path}/legalId/id`)
  into.invoiceText(held.electronicAddress?.id, `${path}/electronicAddress/id`)
  const contact = 'contact' in held ? held.contact : undefined
  for (const key of CONTACT_TEXTS) into.invoiceText(contact?.[key], `${path}/contact/${key}`)
  for (const part of ADDRESS_TEXTS) into.invoiceText(held.address[part], `${path}/address/${part}`)
}

/**
 * EN 16931's terms, which an e-invoice of either kind holds. An e-invoice
 * stands in no component: its texts are read as a paragraph's in the
 * report's scope, its dates and its paid amount as values there, and its
 * line codes in each row's, as what an aggregate reads from each row is;
 * each is named by its path alone, in the order the type holds them. The
 * columns its lines are printed by are read where they stand, in the
 * table.
 */
const en16931 = (invoice: EInvoice, path: string, into: Collector): void => {
  into.invoiceText(invoice.number, `${path}/number`)
  into.expression(invoice.issued, `${path}/issued`, 'report', 'computed', {}, date('BT-2'))
  into.invoiceText(invoice.businessProcess, `${path}/businessProcess`)
  party(invoice.seller, SELLER_TEXTS, `${path}/seller`, into)
  party(invoice.buyer, BUYER_TEXTS, `${path}/buyer`, into)
  into.invoiceText(invoice.buyerReference, `${path}/buyerReference`)
  into.expression(invoice.delivered, `${path}/delivered`, 'report', 'computed', {}, date('BT-72'))
  into.expression(invoice.period?.start, `${path}/period/start`, 'report', 'computed', {}, date('BT-73'))
  into.expression(invoice.period?.end, `${path}/period/end`, 'report', 'computed', {}, date('BT-74'))
  for (const [index, category] of invoice.vat.entries()) into.invoiceText(category.reason, `${path}/vat/${index}/reason`)
  for (const key of Object.keys(E_INVOICE_LINE_CODES) as EInvoiceLineCode[])
    into.lineCode(invoice.lines[key], `${path}/lines/${key}`, E_INVOICE_LINE_CODES[key])
  for (const key of PAYMENT_TEXTS) into.invoiceText(invoice.payment?.[key], `${path}/payment/${key}`)
  into.expression(invoice.due, `${path}/due`, 'report', 'computed', {}, date('BT-9'))
  into.invoiceText(invoice.terms, `${path}/terms`)
  into.expression(invoice.paid, `${path}/paid`, 'report', 'computed', {}, { what: E_INVOICE_DECIMALS['BT-113'].what, types: ['decimal'] })
}

/** What each kind of e-invoice holds. A table over every kind, as PAYMENT_PARTS is: an XRechnung's expressions are where a Factur-X invoice's are, its version and the profile being none (0038). */
const E_INVOICES: { readonly [K in EInvoiceKind]: InvoiceReader<K> } = {
  facturX: en16931,
  xrechnung: en16931,
}

/** The table an e-invoice's lines are the rows of, and the term each column it names prints. */
function lineColumns(invoice: EInvoice | undefined): LineColumns | undefined {
  if (invoice === undefined) return undefined
  const named = Object.keys(E_INVOICE_LINE_COLUMNS) as EInvoiceLineColumn[]
  return { table: invoice.lines.table, columns: new Map(named.map((key) => [invoice.lines[key], E_INVOICE_LINE_COLUMNS[key]])) }
}

/** Every expression and every name the report holds, in document order -- the components, the payment part, the e-invoice -- the aggregates' expressions last. */
export function reportParts(report: ReportDefinition): ReportParts {
  const into = new Collector(lineColumns(report.eInvoice))
  for (const { component, path } of walkComponents(report)) {
    const owner = { componentId: component.id }
    into.expression(component.visibleWhen, `${path}/visibleWhen`, 'report', 'visible', owner)
    into.style(component.style)
    into.rules(component.styleWhen, `${path}/styleWhen`, 'report', owner)
    ;(READERS[component.kind] as Reader<ComponentKind>)(component, path, into)
  }
  if (report.paymentPart !== undefined) PAYMENT_PARTS[report.paymentPart.kind](report.paymentPart, '/paymentPart', into)
  if (report.eInvoice !== undefined) (E_INVOICES[report.eInvoice.kind] as InvoiceReader<EInvoiceKind>)(report.eInvoice, '/eInvoice', into)
  for (const [index, aggregate] of report.aggregates.entries()) {
    // What an aggregate reads, it reads from each detail row.
    if (aggregate.of?.kind === 'field') into.field(aggregate.of.field, `/aggregates/${index}/of`, {})
    if (aggregate.of?.kind === 'expression') into.expression(aggregate.of.expression, `/aggregates/${index}/of/expression`, 'row', 'computed')
  }
  return into
}

/** Every expression in the report, each with the scope it is compiled in and what it is for. */
export function expressionSites(report: ReportDefinition): readonly ExpressionSite[] {
  return reportParts(report).expressions
}
