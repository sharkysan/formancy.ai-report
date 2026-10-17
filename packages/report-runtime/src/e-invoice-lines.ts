/**
 * An e-invoice's lines (BG-25): one for each row of the table that prints
 * them, read once, before the totals, for the page and the XML alike
 * (0027).
 *
 * - **One evaluation.** The four columns the e-invoice names -- the item
 *   name (BT-153), the invoiced quantity (BT-129), the net price (BT-146)
 *   and the net amount (BT-131) -- are read here for every row, as the
 *   table reads a cell, and kept by the path of each column's value and the
 *   row's index: the table prints the very value kept (`inlines.ts`). So
 *   the page and the XML cannot each read a line, and part. The line's
 *   identifier (BT-126), its unit (BT-130) and its VAT category (BT-151)
 *   are codes a page need not print, read from each row as an aggregate
 *   reads it.
 * - **In the table's order** (`orderTable`, 0007), which the XML holds
 *   them in.
 * - **Held to EN 16931's rules**, report-spec's functions over text, the
 *   ones its validator applies to a literal (`en16931.ts`): a code from a
 *   closed list, a net price that is not negative, a net amount that is a
 *   whole number of cents, never rounded, a category the invoice declares.
 *   And to what EN 16931 defines and no rule of CEN's tests: a net amount
 *   that is the quantity times the net price, rounded once to the cent
 *   (`lineNetAmount`), and a line identifier no other line has. A rule
 *   broken is `invalid-e-invoice`, naming the row and the column or the
 *   code, the term and the rule, never the value.
 * - **Printed as the XML holds it.** A quantity or a net price whose
 *   column's format shows fewer places than it has is refused: the page
 *   would round it, and the XML would not.
 * - **A preview holds what it has.** A final render refuses a term that
 *   has no value (BR-21 to BR-26, BR-CO-04) and a table of no rows
 *   (BR-16). A preview takes a term with no value as one it lacks, and
 *   leaves a line whose net amount or category it lacks out of every
 *   total, as an aggregate skips a null; what the data does hold it holds
 *   to the same rules.
 */
import { compareDecimal, decimalFromString, decimalToString } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import { checkEInvoiceDecimal, checkEInvoiceText, checkLineCategory, E_INVOICE_DECIMALS, E_INVOICE_LINE_CODES, E_INVOICE_LINE_COLUMNS, E_INVOICE_TEXTS, eInvoiceBlank, en16931Rule, walkComponents } from '@formancy/report-spec'
import type { EInvoiceDecimalTerm, EInvoiceLineCode, EInvoiceLineColumn, EInvoiceLineTerm, EInvoiceTextTerm, En16931Rule, FacturXInvoice, FieldType, TableComponent, VatCategory } from '@formancy/report-spec'
import { roundDecimalAs } from './decimal.js'
import { lineNetAmount } from './e-invoice-totals.js'
import type { TypedValue } from './format.js'
import { inlineValue } from './inlines.js'
import type { BoundInline } from './inlines.js'
import { fieldValue, rowScope, valueOf } from './render-context.js'
import type { Render, Scope } from './render-context.js'
import { aType, placed } from './resolve-errors.js'
import { orderTable } from './sort-group.js'
import type { OrderedRow } from './sort-group.js'

/** A line's terms as the XML writes them. */
export interface LineTerms {
  /** BT-126. */
  readonly id: string
  /** BT-153. */
  readonly name: string
  /** BT-129, as written. */
  readonly quantity: string
  /** BT-130, a code of report-spec's `UNIT_CODES`. */
  readonly unit: string
  /** BT-146, as written. */
  readonly netPrice: string
  /** BT-131, at exactly two places. */
  readonly netAmount: Decimal
  /** The category the line names (BT-151), and so its rate (BT-152). */
  readonly category: VatCategory
}

type LineKey = EInvoiceLineColumn | EInvoiceLineCode

/** The key of each term of `LineTerms` the e-invoice names a column or a code by. */
const TERM_OF: { readonly [K in LineKey]: keyof LineTerms } = { name: 'name', quantity: 'quantity', netPrice: 'netPrice', netAmount: 'netAmount', id: 'id', unit: 'unit', vat: 'category' }

/** A line as a render read it from its row: each term, null where a preview has no value for it, and the row's index in the data. */
export type ReadLine = { readonly [K in keyof LineTerms]: LineTerms[K] | null } & { readonly row: number }

/** The lines in the table's order, and what the named columns printed of each row, by the path of each column's value. */
export interface ReadLines {
  readonly lines: readonly ReadLine[]
  readonly columns: ReadonlyMap<string, readonly (TypedValue | null)[]>
}

/** What the lines are read with: every input but what the e-invoice adds. */
type Reading = Omit<Render, 'invoice'>

/** Where a term of a line is read, as a refusal names it. */
interface Place {
  readonly path: string
  readonly said: string
  readonly componentId?: string
  readonly columnId?: string
  readonly row: number
}

function refuse(render: Reading, place: Place, message: string): undefined {
  render.problems.error({ stage: 'resolve', code: 'invalid-e-invoice', path: place.path, message: `${place.said}, detail row ${place.row}: ${message}`, ...placed(place) })
  return undefined
}

/** The rule a term with no value breaks: every line term is needed. */
function required(term: EInvoiceLineTerm): string {
  const rule = term.term in E_INVOICE_DECIMALS ? E_INVOICE_DECIMALS[term.term as EInvoiceDecimalTerm].required : E_INVOICE_TEXTS[term.term as EInvoiceTextTerm].required
  // Every term of a line has the rule of CEN's its absence breaks (`en16931.test.ts`).
  return en16931Rule(rule as En16931Rule, 'has no value, and every line of an e-invoice has one')
}

/** A value as its term's text: a decimal and an integer by their own digits, a text as it is. */
function written(value: TypedValue): string {
  return value.type === 'decimal' ? decimalToString(value.value) : String(value.value)
}

/**
 * The term `term` of a line, read as `value`, held to its rule: what the
 * XML writes, null where a preview has no value for it, or undefined when
 * it is refused, which is recorded at `place`.
 */
function checked(render: Reading, term: EInvoiceLineTerm, value: TypedValue | null, place: Place): string | null | undefined {
  if (value === null || (render.preview && value.type === 'string' && eInvoiceBlank(value.value))) {
    return render.preview ? null : refuse(render, place, `${term.what} ${required(term)}`)
  }
  if (!term.types.includes(value.type as FieldType)) return refuse(render, place, `${term.what} is read from ${term.types.map(aType).join(' or ')}, and this gives ${aType(value.type)}`)
  const text = written(value)
  const outcome = term.term in E_INVOICE_DECIMALS ? checkEInvoiceDecimal(term.term as EInvoiceDecimalTerm, text) : checkEInvoiceText(term.term as EInvoiceTextTerm, text)
  return outcome.ok ? outcome.value : refuse(render, place, `${term.what} ${outcome.rule}`)
}

/** A column the e-invoice names: its key, its value, where that stands, and what it printed of each row. */
interface NamedColumn {
  readonly key: EInvoiceLineColumn
  readonly id: string
  readonly value: BoundInline
  readonly path: string
  readonly printed: (TypedValue | null)[]
}

/** The table the lines are the rows of, and the columns that print their terms. */
function namedColumns(render: Reading, invoice: FacturXInvoice): { readonly table: TableComponent; readonly columns: readonly NamedColumn[] } {
  // report-spec's validator holds the lines to this table, and each named column to it: shown, and a detail field or an expression.
  const located = walkComponents(render.report).find(({ component }) => component.kind === 'table' && component.id === invoice.lines.table) as { readonly component: TableComponent; readonly path: string }
  const table = located.component
  const columns = (Object.keys(E_INVOICE_LINE_COLUMNS) as EInvoiceLineColumn[]).map((key): NamedColumn => {
    const index = table.columns.findIndex((column) => column.id === invoice.lines[key])
    const column = table.columns[index] as TableComponent['columns'][number]
    return { key, id: column.id, value: column.value as BoundInline, path: `${located.path}/columns/${index}/value`, printed: new Array<TypedValue | null>(render.data.detail.length).fill(null) }
  })
  return { table, columns }
}

/**
 * The columns whose term the XML writes with the data's own places, which
 * their format may not round: the quantity and the net price. The net
 * amount and every total are amounts the XML writes at two places, which
 * the editing core holds a format to where the template is written.
 */
const AS_WRITTEN: ReadonlySet<EInvoiceLineColumn> = new Set(['quantity', 'netPrice'])

/** The places `column` prints `value` at, where printing it there would round it, by value; undefined where it prints it as it is. */
function roundingPlaces(column: NamedColumn, value: TypedValue): number | undefined {
  const format = column.value.format
  if (!AS_WRITTEN.has(column.key) || value.type !== 'decimal' || (format?.kind !== 'number' && format?.kind !== 'currency')) return undefined
  const shown = roundDecimalAs(value.value, { scale: format.scale, mode: 'half-away-from-zero' })
  return compareDecimal(shown, value.value) === 0 ? undefined : format.scale
}

/** The term of `column` in `row`, read and held to its rule, and to the places its column prints; `undefined` when it could not be, which is recorded. */
function readColumn(render: Reading, scope: Scope, column: NamedColumn, place: Place): string | null | undefined {
  const value = inlineValue(render, scope, column.value, column.path)
  if (value === undefined) return undefined
  column.printed[place.row] = value
  const term = E_INVOICE_LINE_COLUMNS[column.key]
  const text = checked(render, term, value, place)
  const places = typeof text === 'string' ? roundingPlaces(column, value as TypedValue) : undefined
  if (places === undefined) return text
  return refuse(render, place, `${term.what} has more places than its column prints, ${places}, so the page would print another than the XML holds: the column prints the places the data gives`)
}

/** The line of `row`, every term read and held to its rule; undefined when a term is refused or could not be read, which is recorded. */
function readLine(render: Reading, invoice: FacturXInvoice, table: TableComponent, columns: readonly NamedColumn[], row: OrderedRow): ReadLine | undefined {
  const scope = rowScope(render, render.totals.report, row)
  const terms: Partial<Record<keyof LineTerms, string | VatCategory | Decimal | null>> = {}
  let whole = true
  const keep = (key: LineKey, value: string | VatCategory | Decimal | null | undefined): void => {
    if (value === undefined) whole = false
    else terms[TERM_OF[key]] = value
  }
  const placeOf = (column: NamedColumn): Place => ({ path: column.path, said: `component ${table.id}, column ${column.id}`, componentId: table.id, columnId: column.id, row: row.index })
  for (const column of columns) {
    const text = readColumn(render, scope, column, placeOf(column))
    keep(column.key, column.key === 'netAmount' && typeof text === 'string' ? decimalFromString(text) : text)
  }
  const { quantity, netPrice, netAmount } = terms as Partial<Record<'quantity' | 'netPrice', string | null>> & { readonly netAmount?: Decimal | null }
  if (typeof quantity === 'string' && typeof netPrice === 'string' && netAmount !== undefined && netAmount !== null && compareDecimal(lineNetAmount(quantity, netPrice), netAmount) !== 0) {
    const amount = columns.find(({ key }) => key === 'netAmount') as NamedColumn
    keep('netAmount', refuse(render, placeOf(amount), `${E_INVOICE_LINE_COLUMNS.netAmount.what} is not ${E_INVOICE_LINE_COLUMNS.quantity.what} times ${E_INVOICE_LINE_COLUMNS.netPrice.what}, rounded once to the cent: a receiver that multiplies them reads another amount`))
  }
  for (const key of Object.keys(E_INVOICE_LINE_CODES) as EInvoiceLineCode[]) {
    const code = invoice.lines[key]
    const path = `/eInvoice/lines/${key}`
    const value = code.kind === 'field' ? fieldValue(render, row.record, code.field) : valueOf(render, scope, `${path}/expression/cel`)
    if (value === undefined) {
      whole = false
      continue
    }
    const place = { path, said: 'the e-invoice', row: row.index }
    const text = checked(render, E_INVOICE_LINE_CODES[key], value, place)
    if (key !== 'vat' || typeof text !== 'string') keep(key, text)
    else {
      const category = checkLineCategory(text, invoice.vat)
      keep(key, category.ok ? category.value : refuse(render, place, `${E_INVOICE_LINE_CODES.vat.what} ${category.rule}`))
    }
  }
  return whole ? ({ ...terms, row: row.index } as ReadLine) : undefined
}

/**
 * `invoice`'s lines in the table's order, each term read once and held to
 * its rule, and what the named columns printed of each row; undefined when
 * a line is refused, or could not be read, which is recorded. A final
 * render refuses a table of no rows (BR-16).
 */
export function readLines(render: Reading, invoice: FacturXInvoice): ReadLines | undefined {
  const { table, columns } = namedColumns(render, invoice)
  const lines: ReadLine[] = []
  const ids = new Set<string>()
  let whole = true
  for (const row of orderTable(render.report, table, render.data.detail).rows) {
    if (render.problems.full) return undefined
    const line = readLine(render, invoice, table, columns, row)
    if (line === undefined) whole = false
    else if (line.id !== null && ids.has(line.id)) {
      // BT-126 is the line's own (EN 16931, as XRechnung 3.0.2 gives its model): the later of two is refused.
      refuse(render, { path: '/eInvoice/lines/id', said: 'the e-invoice', row: row.index }, `${E_INVOICE_LINE_CODES.id.what} is an earlier line's, and each line of an e-invoice has its own`)
      whole = false
    } else {
      if (line.id !== null) ids.add(line.id)
      lines.push(line)
    }
  }
  if (!render.preview && render.data.detail.length === 0) {
    render.problems.error({
      stage: 'resolve',
      code: 'invalid-e-invoice',
      path: '/eInvoice/lines/table',
      message: `the e-invoice: ${en16931Rule('BR-16', `an e-invoice has one line at least, a row of the table ${table.id}, and the data has no rows`)}`,
      componentId: table.id,
    })
    return undefined
  }
  return whole ? { lines, columns: new Map(columns.map(({ path, printed }) => [path, printed])) } : undefined
}

/** The lines a final render writes: every term of each read, which a final render refuses a line without. */
export function writtenLines(lines: readonly ReadLine[]): readonly LineTerms[] | undefined {
  return lines.every((line) => Object.values(line).every((term) => term !== null)) ? (lines as readonly LineTerms[]) : undefined
}
