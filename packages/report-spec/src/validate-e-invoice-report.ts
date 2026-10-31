/**
 * What an e-invoice says of the report around it, held where the report
 * can be read: that its lines are what the table over the detail dataset
 * prints, that a payment code printed with it asks for its account and its
 * currency, and that a Factur-X invoice's title can stand in the PDF/A's
 * metadata.
 *
 * The page and the XML are one invoice, or the page is a second one: a
 * picture that differs from the structured part in what the invoice says
 * "may be a further invoice" under § 14c UStG (BMF, 15 October 2025, UStAE
 * 14c.1 (4a), which names "eine andere Leistungsbeschreibung"). So a line
 * is read from the columns the table prints it with, once per row, and no
 * column, table or container that prints one may be hidden; and a payment
 * code that names another account than the XML's is refused where both are
 * literal. What only a render knows -- an account read from the data, the
 * amount a code asks for, which is an expression -- the runtime compares.
 */
import type { RowValue } from './aggregates.js'
import { identifier, quote, shape } from './check.js'
import type { Regions } from './definition.js'
import { E_INVOICE_LINE_CODES, E_INVOICE_LINE_COLUMNS } from './en16931-lines.js'
import type { EInvoiceLineCode, EInvoiceLineColumn } from './en16931-lines.js'
import { xmlCharacterBreak } from './en16931-texts.js'
import { en16931Rule } from './en16931.js'
import { checkEpcIban } from './epc-payload.js'
import { E_INVOICE_CURRENCIES } from './e-invoice.js'
import type { EInvoiceKind, EInvoiceLines } from './e-invoice.js'
import type { PaymentPart } from './payment-part.js'
import { at } from './pointer.js'
import { checkQrBillAccount } from './qr-bill.js'
import type { TableComponent } from './table.js'
import type { Ctx } from './validate-context.js'
import { readRowValue } from './validate-inline.js'
import { literal } from './validate-payment-text.js'
import type { InlineKind } from './values.js'
import { walkRegions } from './walk.js'
import type { ComponentLocation } from './walk.js'

/** The parts of the report an e-invoice is held against, each as far as it could be read. */
export interface EInvoiceSurroundings {
  readonly title: string | undefined
  readonly regions: Regions | undefined
  readonly paymentPart: PaymentPart | undefined
}

/** The ids the lines name, each when it could be read: the table, and the column of each term. */
export type NamedColumns = { readonly [K in EInvoiceLineColumn | 'table']?: string }

/**
 * The lines: the table and the columns they are printed by, ids checked
 * against the table once the report's regions are read, and each code read
 * from the row as an aggregate reads it, a detail field of the code's type
 * or an expression the core types.
 */
export function readLines(c: Ctx, value: unknown, path: string): { readonly lines: EInvoiceLines | undefined; readonly named: NamedColumns } {
  const o = shape(c.f, value, path, ['table', 'name', 'quantity', 'netPrice', 'netAmount', 'id', 'unit', 'vat'])
  const named: Record<string, string> = {}
  for (const key of ['table', ...(Object.keys(E_INVOICE_LINE_COLUMNS) as EInvoiceLineColumn[])]) {
    const id = identifier(c.f, o?.[key], at(path, key))
    if (id !== undefined) named[key] = id
  }
  const codes: Partial<Record<EInvoiceLineCode, RowValue>> = {}
  for (const [key, { what, types }] of Object.entries(E_INVOICE_LINE_CODES) as [EInvoiceLineCode, (typeof E_INVOICE_LINE_CODES)[EInvoiceLineCode]][]) {
    const read = readRowValue(c, o?.[key], at(path, key))
    if (read?.type !== undefined && !types.includes(read.type)) {
      c.f.report(at(at(path, key), 'field'), 'binding-type-mismatch', `${what} is read from a ${types.join(' or ')} field, and this is a ${read.type}`)
    } else if (read !== undefined) codes[key] = read.value
  }
  const { table, name, quantity, netPrice, netAmount } = named
  const { id, unit, vat } = codes
  if (
    table === undefined ||
    name === undefined ||
    quantity === undefined ||
    netPrice === undefined ||
    netAmount === undefined ||
    id === undefined ||
    unit === undefined ||
    vat === undefined
  ) {
    return { lines: undefined, named }
  }
  return { lines: { table, name, quantity, netPrice, netAmount, id, unit, vat }, named }
}

/** What a column prints that is not read from the row, as a refusal says it. */
const UNROWED: { readonly [K in Exclude<InlineKind, 'field' | 'expression'>]: string } = {
  text: 'a literal text',
  parameter: 'a parameter',
  aggregate: 'a total',
  pageNumber: 'a page number',
  pageCount: 'a page count',
}

/** Reports what a line's term breaks in the column `id` of `table`, which another term may already print. */
function checkColumn(c: Ctx, table: TableComponent, key: EInvoiceLineColumn, id: string, path: string, printedBy: Map<string, EInvoiceLineColumn>): void {
  const { what, types } = E_INVOICE_LINE_COLUMNS[key]
  const column = table.columns.find((candidate) => candidate.id === id)
  if (column === undefined) {
    c.f.report(path, 'unknown-column', `the table ${quote(table.id)} has no column ${quote(id)} to print ${what}`)
    return
  }
  const other = printedBy.get(id)
  if (other !== undefined)
    c.f.report(
      path,
      'invalid-e-invoice',
      `${what} is printed by the column that prints ${E_INVOICE_LINE_COLUMNS[other].what}: a column prints one term of a line`,
    )
  else printedBy.set(id, key)
  if (column.visibleWhen !== undefined)
    c.f.report(path, 'invalid-e-invoice', `${what} is printed by a column that may be hidden, and every line the XML holds prints it`)
  const cell = column.value
  if (cell.kind === 'expression') return
  if (cell.kind !== 'field') {
    c.f.report(
      path,
      'invalid-e-invoice',
      `${what} is read from each row, and its column prints ${UNROWED[cell.kind]}: it prints a detail field or an expression`,
    )
    return
  }
  if (cell.field.dataset !== 'detail') {
    c.f.report(
      path,
      'invalid-e-invoice',
      `${what} is read from each row, and its column prints a header field, the same in every row: it prints a detail field or an expression`,
    )
    return
  }
  const type = c.declared.datasets?.get('detail')?.get(cell.field.field)
  if (type !== undefined && !types.includes(type))
    c.f.report(path, 'binding-type-mismatch', `${what} is a ${types.join(' or ')}, and its column prints a ${type} field`)
}

/**
 * The lines held to the table over the detail dataset (BR-16 where there is
 * none): its id, and each term's column, printed in every render.
 */
function checkLines(c: Ctx, path: string, locations: readonly ComponentLocation[], named: NamedColumns): void {
  // The first table is the one over the detail dataset only because
  // version 0 has one table and it is over that dataset (`readTable` and
  // `second-detail-table`, validate-table.ts). A version that allows a
  // second must find the table the lines name here instead.
  const found = locations.find(({ component }) => component.kind === 'table')
  if (found === undefined) {
    c.f.report(
      at(path, 'table'),
      'invalid-e-invoice',
      en16931Rule('BR-16', 'an e-invoice has one line at least, a row of the table over the detail dataset, and this report has no such table'),
    )
    return
  }
  const table = found.component as TableComponent
  if (named.table !== undefined && named.table !== table.id) {
    c.f.report(
      at(path, 'table'),
      'invalid-e-invoice',
      `the lines are the rows of the table over the detail dataset, ${quote(table.id)}, and this names another`,
    )
    return
  }
  // The table and every container it stands in: a condition on any hides the lines.
  if (locations.some(({ component, path: where }) => component.visibleWhen !== undefined && (where === found.path || found.path.startsWith(`${where}/`)))) {
    c.f.report(
      at(path, 'table'),
      'invalid-e-invoice',
      'the lines are printed by a table that may be hidden, or that stands in a component that may be: every line the XML holds is printed',
    )
  }
  const printedBy = new Map<string, EInvoiceLineColumn>()
  for (const key of Object.keys(E_INVOICE_LINE_COLUMNS) as EInvoiceLineColumn[]) {
    const id = named[key]
    if (id !== undefined) checkColumn(c, table, key, id, at(path, key), printedBy)
  }
}

/**
 * Reports a payment code's account, `written` when it is literal and its
 * own rule took it, at `path`: the e-invoice names an account (BT-84) for
 * every code to ask for, `account` when it is literal and its rule took it,
 * and a code that asks for another is refused. An account not known on
 * either side is the render's to compare.
 */
function checkAccount(c: Ctx, path: string, code: string, written: string | undefined, pays: boolean, account: string | undefined): void {
  if (!pays) {
    c.f.report(
      path,
      'invalid-e-invoice',
      `${code} asks to be paid to an account, and the e-invoice names none: its payment instructions (BG-16) give the account (BT-84)`,
    )
  } else if (written !== undefined && account !== undefined && written !== account) {
    c.f.report(
      path,
      'invalid-e-invoice',
      `${code} asks to be paid to another account than the e-invoice's payment account (BT-84): a page and its XML name one account`,
    )
  }
}

/** Every payment code the report prints, the QR-bill and each EPC QR code, held to the e-invoice's currency and account, shown or hidden. */
function checkPaymentCodes(
  c: Ctx,
  around: EInvoiceSurroundings,
  locations: readonly ComponentLocation[] | undefined,
  pays: boolean,
  account: string | undefined,
): void {
  const bill = around.paymentPart
  if (bill !== undefined) {
    if (!(E_INVOICE_CURRENCIES as readonly string[]).includes(bill.currency)) {
      c.f.report(
        '/paymentPart/currency',
        'invalid-e-invoice',
        `a QR-bill printed with an e-invoice asks for the e-invoice's currency, ${E_INVOICE_CURRENCIES.join(', ')} (BT-5)`,
      )
    }
    const text = literal(bill.account)
    const checked = text === undefined ? undefined : checkQrBillAccount(text)
    checkAccount(c, '/paymentPart/account', 'the QR-bill', checked?.ok === true ? checked.value.iban : undefined, pays, account)
  }
  for (const { component, path } of locations ?? []) {
    if (component.kind !== 'epcQrCode') continue
    const text = literal(component.iban)
    const checked = text === undefined ? undefined : checkEpcIban(text)
    checkAccount(c, at(path, 'iban'), 'the EPC QR code', checked?.ok === true ? checked.value : undefined, pays, account)
  }
}

/**
 * The rule a Factur-X invoice's title breaks, or undefined. The renderer
 * writes the title into the PDF/A's XMP, and its engine writes it there
 * unescaped (`_addInfo` in pdfkit 0.19.1's `js/pdfkit.js`): "Müller & Söhne
 * <AG>" makes metadata that is not XML, and a PDF that is not PDF/A. The
 * title is the template's own string, never data, so it is refused where
 * it is written; the page may print the three characters. An XRechnung's
 * copy is a plain PDF with no XMP, and its XML holds no title (0038).
 */
function titleBreak(title: string): string | undefined {
  const characters = xmlCharacterBreak(title)
  if (characters !== undefined) return `an e-invoice's title ${characters}`
  return /[&<>]/.test(title)
    ? "an e-invoice's title is written into its PDF/A's metadata, where &, < and > cannot stand as written: this one holds one"
    : undefined
}

/**
 * Everything the e-invoice at `path` says of the report around it: a
 * Factur-X invoice's title, the lines' table and columns, and every
 * payment code. `pays` says whether it gives payment instructions,
 * `account` is their account when it is literal and its rule took it, and
 * `kind` is the e-invoice's.
 */
export function checkEInvoiceReport(
  c: Ctx,
  path: string,
  around: EInvoiceSurroundings,
  invoice: { readonly named: NamedColumns; readonly pays: boolean; readonly account: string | undefined; readonly kind: EInvoiceKind },
): void {
  const broken = around.title === undefined || invoice.kind !== 'facturX' ? undefined : titleBreak(around.title)
  if (broken !== undefined) c.f.report('/title', 'invalid-e-invoice', broken)
  const locations = around.regions && walkRegions(around.regions)
  if (locations !== undefined) checkLines(c, at(path, 'lines'), locations, invoice.named)
  checkPaymentCodes(c, around, locations, invoice.pays, invoice.account)
}
