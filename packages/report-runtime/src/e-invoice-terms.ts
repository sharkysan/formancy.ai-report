/**
 * An e-invoice's terms but its lines -- its number, its dates, its seller
 * and its buyer, its categories' reasons, its payment instructions, its
 * paid amount -- each read in the report's scope once the data has
 * resolved it, and held to EN 16931's rules: report-spec's `en16931.ts`,
 * the very functions its validator applies to a literal, named by the same
 * tables.
 *
 * - **Read as a paragraph.** Each text is its runs, read as a paragraph's
 *   in the report's scope (`readRuns`), so the XML holds what the same runs
 *   would print. A literal passes again; a value from data is held where
 *   the validator could not see it.
 * - **What may be left out is.** An optional text the data resolves to
 *   blank, nulls and all, is a term the XML leaves out, as an EPC QR code's
 *   optional texts are: a nullable field's null is how data says "none".
 *   A needed one that prints nothing breaks its rule (BR-02, BR-06 ...);
 *   one whose runs print something around a null is refused as a text cut
 *   short.
 * - **What only the whole says** -- the identifiers the lines' categories
 *   need of the seller and the buyer (BR-CO-26, BR-S-02, BR-E-02,
 *   BR-AE-02), the time of supply (§ 14 UStG), a category's reason (BR-E-10,
 *   BR-AE-10) -- is said of the categories the lines are in, once every
 *   part has resolved; an invoicing period's order (BR-29) once both its
 *   dates have.
 * - **A preview holds what it has**: a term it has no value for is one it
 *   lacks, and what only an absence breaks it does not say. What the data
 *   holds it holds to the same rules.
 *
 * A rule broken is `invalid-e-invoice` at the term, naming its business
 * term and the rule, never the value, which may be a person's name,
 * account or VAT identifier.
 */
import { decimalFromString, decimalToString } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import {
  buyerIdentificationBreak,
  checkEInvoiceDate,
  checkEInvoiceDecimal,
  checkEInvoiceText,
  checkInvoicingPeriod,
  E_INVOICE_DATES,
  E_INVOICE_DECIMALS,
  E_INVOICE_TEXT_TERMS,
  E_INVOICE_TEXTS,
  eInvoiceBlank,
  en16931Rule,
  sellerIdentificationBreaks,
  supplyBreak,
  vatReasonBreak,
} from '@formancy/report-spec'
import type { EInvoiceAddress, EInvoiceBuyer, EInvoiceDateTerm, EInvoiceSeller, EInvoiceTextTerm, Expression, FacturXInvoice, Inline, PaymentMeansCode, SchemeId, VatCategory } from '@formancy/report-spec'
import { readRuns } from './inlines.js'
import { reportScope, valueOf } from './render-context.js'
import type { Render, Scope } from './render-context.js'
import { aType } from './resolve-errors.js'

/** A postal address (BG-5, BG-8) as the XML writes it. */
export interface AddressTerms {
  readonly line1: string
  readonly line2?: string
  readonly postalCode: string
  readonly city: string
  /** A code of report-spec's `COUNTRY_CODES`. */
  readonly country: string
}

/** A seller (BG-4) or a buyer (BG-7) as the XML writes it; a buyer has no tax number. */
export interface PartyTerms {
  readonly name: string
  /** Its spaces dropped. */
  readonly vatId?: string
  readonly taxNumber?: string
  readonly legalId?: { readonly id: string; readonly scheme?: SchemeId }
  readonly address: AddressTerms
}

/** The payment instructions (BG-16) as the XML writes them. */
export interface PaymentTerms {
  readonly means: PaymentMeansCode
  /** BT-84, as the EPC QR code's account rule writes it: its spaces dropped, its letters capitals. */
  readonly account: string
  readonly bic?: string
  readonly accountName?: string
  readonly remittance?: string
}

/** Every term of an e-invoice but its lines and its totals, as the XML writes it; each date YYYY-MM-DD. */
export interface InvoiceTerms {
  readonly number: string
  readonly issued: string
  readonly seller: PartyTerms
  readonly buyer: PartyTerms
  readonly buyerReference?: string
  readonly delivered?: string
  readonly period?: { readonly start?: string; readonly end?: string }
  /** The exemption reason (BT-120) of each category a line is in that gives one, by the category's id. */
  readonly reasons: ReadonlyMap<string, string>
  readonly payment?: PaymentTerms
  readonly due?: string
  readonly terms?: string
}

/** What is read with: every input but what the e-invoice adds, and the report's scope. */
interface Reader {
  readonly render: Omit<Render, 'invoice'>
  readonly scope: Scope
}

/** What an error names the e-invoice by: it stands in no component. */
const OWNER = { said: 'the e-invoice' } as const

function refuse({ render }: Pick<Reader, 'render'>, path: string, message: string): undefined {
  render.problems.error({ stage: 'resolve', code: 'invalid-e-invoice', path, message: `the e-invoice: ${message}` })
  return undefined
}

/**
 * A read term: its value, null where it is none -- left out, or one a
 * preview has no value for -- or undefined where it was refused or could
 * not be read, which is recorded.
 */
type Read<T> = T | null | undefined

/** The text of `term`, its runs at `path`, held to its rule. */
function text(reader: Reader, term: EInvoiceTextTerm, runs: readonly Inline[] | undefined, path: string): Read<string> {
  if (runs === undefined) return null
  const read = readRuns(reader.render, reader.scope, runs, path, OWNER)
  if (read.refused) return undefined
  const rule = E_INVOICE_TEXTS[term]
  const blank = eInvoiceBlank(read.text)
  if (reader.render.preview && (blank || read.nulls.length > 0)) return null
  if (blank && rule.required === undefined) return null
  if (!blank && read.nulls.length > 0) return refuse(reader, path, `${rule.what} has a run with no value, and written without it the e-invoice would hold less than its runs print`)
  const checked = checkEInvoiceText(term, read.text)
  return checked.ok ? checked.value : refuse(reader, path, `${rule.what} ${checked.rule}`)
}

/** The date of `term`, its expression at `path`: a day on the calendar, YYYY-MM-DD. */
function date(reader: Reader, term: EInvoiceDateTerm, expression: Expression | undefined, path: string): Read<string> {
  if (expression === undefined) return null
  const value = valueOf(reader.render, reader.scope, `${path}/cel`)
  if (value === undefined) return undefined
  const rule = E_INVOICE_DATES[term]
  if (value === null) return rule.required === undefined || reader.render.preview ? null : refuse(reader, path, `${rule.what} ${en16931Rule(rule.required, 'has no value, and an e-invoice needs it')}`)
  if (value.type !== 'date' && value.type !== 'string') return refuse(reader, path, `${rule.what} is a date, and this gives ${aType(value.type)}`)
  const checked = checkEInvoiceDate(value.value)
  return checked.ok ? checked.value : refuse(reader, path, `${rule.what} ${checked.rule}`)
}

/** `value` under `key` where it is a value; nothing where it is none or was refused. */
const term = <K extends string, V>(key: K, value: Read<V>): { [P in K]?: V } => (value === null || value === undefined ? {} : ({ [key]: value } as { [P in K]: V }))

/** Whether every one of `values` was read and is there: what a term needs of each of its parts. */
const all = (...values: readonly Read<unknown>[]): boolean => values.every((value) => value !== null && value !== undefined)

function address(reader: Reader, held: EInvoiceAddress, path: string, which: 'seller' | 'buyer'): Read<AddressTerms> {
  const terms = E_INVOICE_TEXT_TERMS[which].address
  const line1 = text(reader, terms.line1, held.line1, `${path}/line1`)
  const line2 = text(reader, terms.line2, held.line2, `${path}/line2`)
  const postalCode = text(reader, terms.postalCode, held.postalCode, `${path}/postalCode`)
  const city = text(reader, terms.city, held.city, `${path}/city`)
  const country = text(reader, terms.country, held.country, `${path}/country`)
  if (line2 === undefined || !all(line1, postalCode, city, country)) return undefined
  return { line1: line1 as string, ...term('line2', line2), postalCode: postalCode as string, city: city as string, country: country as string }
}

/** A party as read, and which of its identifiers are there: one refused is there, as the validator says of one written. */
interface ReadParty {
  readonly party: Read<PartyTerms>
  readonly has: { readonly vatId: boolean; readonly taxNumber: boolean; readonly legalId: boolean }
}

function party(reader: Reader, held: EInvoiceSeller | EInvoiceBuyer, path: string, which: 'seller' | 'buyer'): ReadParty {
  const terms = E_INVOICE_TEXT_TERMS[which]
  const name = text(reader, terms.name, held.name, `${path}/name`)
  const vatId = text(reader, terms.vatId, held.vatId, `${path}/vatId`)
  // A buyer has no tax registration identifier (BT-32 is the seller's).
  const taxNumber = which === 'seller' ? text(reader, E_INVOICE_TEXT_TERMS.seller.taxNumber, (held as EInvoiceSeller).taxNumber, `${path}/taxNumber`) : null
  const legalId = text(reader, terms.legalId, held.legalId?.id, `${path}/legalId/id`)
  const where = address(reader, held.address, `${path}/address`, which)
  const has = { vatId: vatId !== null, taxNumber: taxNumber !== null, legalId: legalId !== null }
  if (vatId === undefined || taxNumber === undefined || legalId === undefined || !all(name, where)) return { party: undefined, has }
  const scheme = held.legalId?.scheme
  const registration = legalId === null ? {} : { legalId: { id: legalId, ...(scheme === undefined ? {} : { scheme }) } }
  return { party: { name: name as string, ...term('vatId', vatId), ...term('taxNumber', taxNumber), ...registration, address: where as AddressTerms }, has }
}

function payment(reader: Reader, invoice: FacturXInvoice): { readonly payment: Read<PaymentTerms>; readonly account: string | undefined } {
  const held = invoice.payment
  if (held === undefined) return { payment: null, account: undefined }
  const terms = E_INVOICE_TEXT_TERMS.payment
  const account = text(reader, terms.iban, held.iban, '/eInvoice/payment/iban')
  const bic = text(reader, terms.bic, held.bic, '/eInvoice/payment/bic')
  const accountName = text(reader, terms.accountName, held.accountName, '/eInvoice/payment/accountName')
  const remittance = text(reader, terms.remittance, held.remittance, '/eInvoice/payment/remittance')
  const known = account ?? undefined
  if (bic === undefined || accountName === undefined || remittance === undefined || !all(account)) return { payment: undefined, account: known }
  return { payment: { means: held.means, account: account as string, ...term('bic', bic), ...term('accountName', accountName), ...term('remittance', remittance) }, account: known }
}

/** The paid amount (BT-113), read in the report's scope: a whole number of cents, at two places, or null where none is paid. */
export function paidAmount(render: Omit<Render, 'invoice'>, invoice: FacturXInvoice): Read<Decimal> {
  if (invoice.paid === undefined) return null
  const path = '/eInvoice/paid'
  const value = valueOf(render, reportScope(render, render.totals.report), `${path}/cel`)
  if (value === undefined || value === null) return value
  const what = E_INVOICE_DECIMALS['BT-113'].what
  if (value.type !== 'decimal') return refuse({ render }, path, `${what} is a decimal, and this gives ${aType(value.type)}`)
  const checked = checkEInvoiceDecimal('BT-113', decimalToString(value.value))
  return checked.ok ? decimalFromString(checked.value) : refuse({ render }, path, `${what} ${checked.rule}`)
}

/** What reading the terms gives: the terms, where every one is there; and the payment account, where its rule took it, for a payment code to be held to. */
export interface ReadTerms {
  readonly terms: InvoiceTerms | undefined
  readonly account: string | undefined
}

/**
 * Every term of `invoice` but its lines and its totals, each read in the
 * report's scope and held to its rule, and what the whole breaks said of
 * `used`, the categories the lines are in. `terms` is undefined where a
 * term was refused, which is recorded, or a preview lacks one.
 */
export function readTerms(render: Omit<Render, 'invoice'>, invoice: FacturXInvoice, used: readonly VatCategory[]): ReadTerms {
  const reader: Reader = { render, scope: reportScope(render, render.totals.report) }
  const number = text(reader, E_INVOICE_TEXT_TERMS.number, invoice.number, '/eInvoice/number')
  const issued = date(reader, 'BT-2', invoice.issued, '/eInvoice/issued')
  const seller = party(reader, invoice.seller, '/eInvoice/seller', 'seller')
  const buyer = party(reader, invoice.buyer, '/eInvoice/buyer', 'buyer')
  const buyerReference = text(reader, E_INVOICE_TEXT_TERMS.buyerReference, invoice.buyerReference, '/eInvoice/buyerReference')
  const delivered = date(reader, 'BT-72', invoice.delivered, '/eInvoice/delivered')
  const start = date(reader, 'BT-73', invoice.period?.start, '/eInvoice/period/start')
  const end = date(reader, 'BT-74', invoice.period?.end, '/eInvoice/period/end')
  const reasons = used.map((category) => [category, text(reader, E_INVOICE_TEXT_TERMS.reason, category.reason, `/eInvoice/vat/${invoice.vat.indexOf(category)}/reason`)] as const)
  const paying = payment(reader, invoice)
  const due = date(reader, 'BT-9', invoice.due, '/eInvoice/due')
  const terms = text(reader, E_INVOICE_TEXT_TERMS.terms, invoice.terms, '/eInvoice/terms')

  const ordered = typeof start === 'string' && typeof end === 'string' ? checkInvoicingPeriod(start, end) : undefined
  if (ordered !== undefined) refuse(reader, '/eInvoice/period', ordered)
  if (!render.preview) {
    const codes = used.map(({ code }) => code)
    for (const rule of sellerIdentificationBreaks(seller.has, codes)) refuse(reader, '/eInvoice/seller', rule)
    const unidentified = buyerIdentificationBreak(buyer.has, codes)
    if (unidentified !== undefined) refuse(reader, '/eInvoice/buyer', unidentified)
    const unsupplied = supplyBreak(delivered !== null, start !== null || end !== null)
    if (unsupplied !== undefined) refuse(reader, '/eInvoice/delivered', unsupplied)
    for (const [category, reason] of reasons) {
      const unreasoned = vatReasonBreak(category.code, reason !== null)
      if (unreasoned !== undefined) refuse(reader, `/eInvoice/vat/${invoice.vat.indexOf(category)}/reason`, unreasoned)
    }
  }
  const read = [number, issued, seller.party, buyer.party, buyerReference, delivered, start, end, paying.payment, due, terms, ...reasons.map(([, reason]) => reason)]
  if (render.problems.failed || read.includes(undefined) || !all(number, issued, seller.party, buyer.party)) return { terms: undefined, account: paying.account }
  return {
    terms: {
      number: number as string,
      issued: issued as string,
      seller: seller.party as PartyTerms,
      buyer: buyer.party as PartyTerms,
      ...term('buyerReference', buyerReference),
      ...term('delivered', delivered),
      ...(start === null && end === null ? {} : { period: { ...term('start', start), ...term('end', end) } }),
      reasons: new Map(reasons.flatMap(([category, reason]) => (typeof reason === 'string' ? [[category.id, reason] as const] : []))),
      ...term('payment', paying.payment),
      ...term('due', due),
      ...term('terms', terms),
    },
    account: paying.account,
  }
}
