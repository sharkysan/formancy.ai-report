/**
 * What a report that is an e-invoice binds beside the format's names, where
 * those cannot be read, and what each of the e-invoice's expressions must
 * give (0027, beside 0009).
 *
 * `invoice`, `vatBasis` and `vatAmount` (report-spec's `E_INVOICE_NAMES`)
 * hold the totals the runtime computes once from the e-invoice's lines,
 * after the aggregates, for the page and the XML alike. Every member is a
 * decimal: a document total is never null; a category's basis and amount
 * are null when no line is in it; the paid amount is what the e-invoice's
 * expression gives, and no member where it declares none.
 *
 * They are read wherever `totals` is, but not where they are computed
 * from: an aggregate's expression, computed before them; one of the
 * e-invoice's own, which the XML writes beside them and the amount due is
 * computed from; and a column that prints a term of each line, which they
 * are the sums of. A read there is a circle no render could close, and is
 * refused as a name the place does not bind, as one in a report that is no
 * e-invoice is.
 */
import type { DeclaredType } from '@formancy/expressions'
import { INVOICE_TOTALS } from '@formancy/report-spec'
import type { EInvoice, EInvoiceName, FieldType, InvoiceTotal } from '@formancy/report-spec'
import type { ExpressionSite } from '../diagnostics/parts.js'
import type { SiteOutcome } from './compile-site.js'
import type { ExpressionMember } from './members.js'
import { readAs } from './members.js'

/** What each of the e-invoice's names holds, member by member. */
export type InvoiceMembers = { readonly [N in EInvoiceName]: ReadonlyMap<string, ExpressionMember> }

/** A document total: computed over every line, 0.00 over none. */
const TOTAL: ExpressionMember = { type: 'decimal', nullable: false }

/** A category's basis or amount: null when no line is in it. */
const BREAKDOWN: ExpressionMember = { type: 'decimal', nullable: true }

/**
 * What each name holds in a report whose e-invoice is `invoice`, its paid
 * amount read as `paid`; nothing in a report that is none. The totals in
 * report-spec's order, the categories in the order the e-invoice declares
 * them.
 */
export function invoiceMembers(invoice: EInvoice | undefined, paid: ExpressionMember | undefined): InvoiceMembers {
  if (invoice === undefined) return { invoice: new Map(), vatBasis: new Map(), vatAmount: new Map() }
  const totals = (Object.keys(INVOICE_TOTALS) as InvoiceTotal[]).flatMap((id): [string, ExpressionMember][] => {
    if (id !== 'paid') return [[id, TOTAL]]
    return paid === undefined ? [] : [[id, paid]]
  })
  const categories = (): Map<string, ExpressionMember> => new Map(invoice.vat.map(({ id }) => [id, BREAKDOWN]))
  return { invoice: new Map(totals), vatBasis: categories(), vatAmount: categories() }
}

/**
 * What `invoice.paid` is read as, from how the e-invoice's paid amount
 * compiled: a decimal, null where the expression may give null. One that
 * did not compile has no type anyone could check a read of: it is read as
 * a value that may be anything, so its fault is reported once, where it is.
 */
export function paidMember(outcome: SiteOutcome): ExpressionMember {
  if (!outcome.ok) return { type: 'dyn', nullable: true }
  return { type: 'decimal', nullable: outcome.compiled.program.resultType !== 'decimal' }
}

/**
 * Why the expression at `site` cannot read the e-invoice's names, said
 * after the name; undefined where it can. `invoiced` says whether the
 * report is an e-invoice.
 */
export function invoiceRefusal(site: ExpressionSite, invoiced: boolean): string | undefined {
  if (!invoiced) return 'has a value only in a report that is an e-invoice, and this report is none'
  // An aggregate's expression is the one site under /aggregates/, as compileReport finds it.
  if (site.path.startsWith('/aggregates/')) return "holds what the e-invoice computes after every aggregate, and an aggregate's expression cannot read it"
  if (site.term === undefined) return undefined
  const what = site.columnId === undefined ? site.term.what : `the column that prints ${site.term.what}`
  return `holds the totals the e-invoice computes from its lines, and ${what} is part of what they are computed from or written with: it cannot read them`
}

/** What a field of each type is, as a message says it. */
const SAID: { readonly [T in FieldType]: string } = {
  string: 'a text',
  integer: 'an integer',
  decimal: 'a decimal',
  boolean: 'a boolean',
  date: 'a date, read as its ISO string',
  datetime: 'a date and a time',
  instant: 'an instant',
  image: 'an image',
}

/** What to say of an expression of an e-invoice's term that gives what the term is not. */
export interface TermBreak {
  readonly message: string
  readonly hint?: string
}

/**
 * What breaks the term of the expression at `site`, which gives `type`; or
 * undefined, when it has no term of a type or gives one the term takes. A
 * term takes what an expression reads each type of field it may be as,
 * and a value that may be null, checked as `dyn`, which the render checks
 * again once it holds the value. A date is taken as the ISO string a date
 * field is read as, so whether a text is a date is the render's to say.
 */
export function termBreak(site: ExpressionSite, type: string): TermBreak | undefined {
  const term = site.term
  if (term?.types === undefined) return undefined
  // No term is an image, the one type of field nothing reads.
  const takes = new Set<string>(['dyn', ...term.types.map((field) => readAs(field) as DeclaredType)])
  if (takes.has(type)) return undefined
  const what = `${term.what} is ${term.types.map((field) => SAID[field]).join(' or ')}, and ${site.columnId === undefined ? 'this expression' : "this column's value"} gives ${type}`
  const decimal = term.types.length === 1 && term.types[0] === 'decimal' && (type === 'int' || type === 'string')
  return decimal ? { message: what, hint: 'dec() makes a decimal of an integer, or of a string of digits' } : { message: what }
}
