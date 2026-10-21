/**
 * The e-invoice: its shape, and EN 16931's rules applied to every text no
 * data can change.
 *
 * Its texts are runs read in the report's scope and written into the XML,
 * so they read what a paragraph in the summary reads and never a page
 * number or count, as `validate-payment-text.ts` reads every payment
 * code's. A text of literal runs is written the same into every invoice, so
 * `en16931.ts`'s rules are applied to it here, where it is written; any
 * other is checked by the runtime with the same rules, once the data has
 * resolved it. What only the template's declarations decide is decided
 * here too: the seller's and the buyer's identifiers a category needs, the
 * time of supply, and one breakdown for each category.
 *
 * What the e-invoice says of the rest of the report -- that its lines are
 * what the table prints, that a payment code asks for its account, that
 * its title can stand in a PDF/A's metadata -- is
 * `validate-e-invoice-report.ts`'s.
 */
import { fieldKey, kindOf, oneOf, optional, readArray, readObject, reference, shape, strictKeys } from './check.js'
import { E_INVOICE_CURRENCIES, E_INVOICE_KINDS, E_INVOICE_PROFILES, INVOICE_TYPE_CODES, PAYMENT_MEANS_CODES, VAT_CATEGORY_CODES } from './e-invoice.js'
import type {
  AddressScheme,
  EInvoice,
  EInvoiceAddress,
  EInvoiceBuyer,
  EInvoiceKind,
  EInvoiceSeller,
  ElectronicAddress,
  FacturXInvoice,
  InvoicingPeriod,
  LegalIdentifier,
  PaymentInstructions,
  SchemeId,
  SellerContact,
  VatCategory,
  VatCategoryCode,
} from './e-invoice.js'
import { periodBreak, supplyBreak } from './en16931-dates.js'
import { checkAddressScheme, checkEInvoiceText, checkSchemeId, E_INVOICE_TEXT_TERMS, E_INVOICE_TEXTS } from './en16931-texts.js'
import type { EInvoiceTextTerm } from './en16931-texts.js'
import { buyerIdentificationBreak, checkVatRate, sellerIdentificationBreaks, vatCategoryBreaks, vatReasonBreak } from './en16931-vat.js'
import { en16931Rule } from './en16931.js'
import { MAX_VAT_CATEGORIES } from './limits.js'
import { at } from './pointer.js'
import type { Ctx } from './validate-context.js'
import { declare } from './validate-context.js'
import { checkEInvoiceReport, readLines } from './validate-e-invoice-report.js'
import type { EInvoiceSurroundings } from './validate-e-invoice-report.js'
import { readExpression } from './validate-inline.js'
import { readPaymentText, unquoted } from './validate-payment-text.js'
import type { PaymentScope, PaymentText } from './validate-payment-text.js'

/** Where an e-invoice's runs are read: in the report's scope, written into its XML. */
export const E_INVOICE_SCOPE: PaymentScope = { region: 'eInvoice', reads: 'report', encoded: 'an e-invoice' }

/** A text of the e-invoice, read as every payment code's is, and refused as `invalid-e-invoice` when its term's rule refuses it. */
function readTerm(c: Ctx, value: unknown, path: string, term: EInvoiceTextTerm): PaymentText<string> {
  return readPaymentText(c, value, path, E_INVOICE_SCOPE, 'invalid-e-invoice', E_INVOICE_TEXTS[term].what, (text) => checkEInvoiceText(term, text))
}

/** A part of the e-invoice that holds others, read with exactly its properties: written as a string, it is refused unquoted, since it is a party's name, address or account. */
function readPart(c: Ctx, value: unknown, path: string, required: readonly string[], optionalKeys: readonly string[] = []): Record<string, unknown> | undefined {
  return typeof value === 'string' ? unquoted(c, path, 'an object', E_INVOICE_SCOPE) : shape(c.f, value, path, required, optionalKeys)
}

/** Whether a property that is present was read: absent is read, as nothing. */
const read = (o: Record<string, unknown>, key: string, value: unknown): boolean => o[key] === undefined || value !== undefined

type Party = 'seller' | 'buyer'

function readAddress(c: Ctx, value: unknown, path: string, party: Party): EInvoiceAddress | undefined {
  const o = readPart(c, value, path, ['line1', 'postalCode', 'city', 'country'], ['line2'])
  if (o === undefined) return undefined
  const address: Partial<Record<keyof EInvoiceAddress, PaymentText<string>['runs']>> = {}
  let whole = true
  for (const [part, term] of Object.entries(E_INVOICE_TEXT_TERMS[party].address) as [keyof EInvoiceAddress, EInvoiceTextTerm][]) {
    const { runs } = readTerm(c, o[part], at(path, part), term)
    if (runs !== undefined) address[part] = runs
    else if (o[part] !== undefined || part !== 'line2') whole = false
  }
  return whole ? (address as EInvoiceAddress) : undefined
}

/** What a refusal calls a legal registration's scheme. */
const SCHEMES: { readonly [P in Party]: string } = {
  seller: "the scheme of the seller's legal registration identifier (BT-30-1)",
  buyer: "the scheme of the buyer's legal registration identifier (BT-47-1)",
}

function readLegalId(c: Ctx, value: unknown, path: string, party: Party): LegalIdentifier | undefined {
  const o = readPart(c, value, path, ['id'], ['scheme'])
  if (o === undefined) return undefined
  const id = readTerm(c, o.id, at(path, 'id'), E_INVOICE_TEXT_TERMS[party].legalId)
  const code = reference(c.f, o.scheme, at(path, 'scheme'))
  const checked = code === undefined ? undefined : checkSchemeId(code)
  if (checked?.ok === false) c.f.report(at(path, 'scheme'), 'invalid-e-invoice', `${SCHEMES[party]} ${checked.rule}`)
  const scheme: SchemeId | undefined = checked?.ok === true ? checked.value : undefined
  return id.runs === undefined || !read(o, 'scheme', scheme) ? undefined : { id: id.runs, ...optional('scheme', scheme) }
}

/** What a refusal calls an electronic address's scheme. */
const ADDRESS_SCHEME_TERMS: { readonly [P in Party]: string } = {
  seller: "the scheme of the seller's electronic address (BT-34-1)",
  buyer: "the scheme of the buyer's electronic address (BT-49-1)",
}

/** An electronic address: its identifier, a text, and its scheme, a code of the list, which EN 16931 needs with it (BR-62, BR-63). */
function readElectronicAddress(c: Ctx, value: unknown, path: string, party: Party): ElectronicAddress | undefined {
  const o = readPart(c, value, path, ['id', 'scheme'])
  if (o === undefined) return undefined
  const id = readTerm(c, o.id, at(path, 'id'), E_INVOICE_TEXT_TERMS[party].electronicAddress)
  const code = reference(c.f, o.scheme, at(path, 'scheme'))
  const checked = code === undefined ? undefined : checkAddressScheme(code)
  if (checked?.ok === false) c.f.report(at(path, 'scheme'), 'invalid-e-invoice', `${ADDRESS_SCHEME_TERMS[party]} ${checked.rule}`)
  const scheme: AddressScheme | undefined = checked?.ok === true ? checked.value : undefined
  return id.runs === undefined || scheme === undefined ? undefined : { id: id.runs, scheme }
}

/** The seller's contact: its name, its telephone number and its email address, each a text, all three given. */
function readContact(c: Ctx, value: unknown, path: string): SellerContact | undefined {
  const o = readPart(c, value, path, ['name', 'telephone', 'email'])
  if (o === undefined) return undefined
  const terms = E_INVOICE_TEXT_TERMS.seller.contact
  const name = readTerm(c, o.name, at(path, 'name'), terms.name)
  const telephone = readTerm(c, o.telephone, at(path, 'telephone'), terms.telephone)
  const email = readTerm(c, o.email, at(path, 'email'), terms.email)
  return name.runs === undefined || telephone.runs === undefined || email.runs === undefined ? undefined : { name: name.runs, telephone: telephone.runs, email: email.runs }
}

/** The seller, its identifiers held to what the categories it declares need when those could be read. */
function readSeller(c: Ctx, value: unknown, path: string, codes: readonly VatCategoryCode[] | undefined): EInvoiceSeller | undefined {
  const o = readPart(c, value, path, ['name', 'address'], ['vatId', 'taxNumber', 'legalId', 'electronicAddress', 'contact'])
  if (o === undefined) return undefined
  const terms = E_INVOICE_TEXT_TERMS.seller
  const name = readTerm(c, o.name, at(path, 'name'), terms.name)
  const vatId = readTerm(c, o.vatId, at(path, 'vatId'), terms.vatId)
  const taxNumber = readTerm(c, o.taxNumber, at(path, 'taxNumber'), terms.taxNumber)
  const legalId = readLegalId(c, o.legalId, at(path, 'legalId'), 'seller')
  const electronicAddress = readElectronicAddress(c, o.electronicAddress, at(path, 'electronicAddress'), 'seller')
  const contact = readContact(c, o.contact, at(path, 'contact'))
  const address = readAddress(c, o.address, at(path, 'address'), 'seller')
  // Said of what is written, read or not: an identifier refused is there.
  const has = { vatId: o.vatId !== undefined, taxNumber: o.taxNumber !== undefined, legalId: o.legalId !== undefined }
  for (const rule of codes === undefined ? [] : sellerIdentificationBreaks(has, codes)) c.f.report(path, 'invalid-e-invoice', rule)
  if (
    name.runs === undefined ||
    address === undefined ||
    !read(o, 'vatId', vatId.runs) ||
    !read(o, 'taxNumber', taxNumber.runs) ||
    !read(o, 'legalId', legalId) ||
    !read(o, 'electronicAddress', electronicAddress) ||
    !read(o, 'contact', contact)
  ) {
    return undefined
  }
  return {
    name: name.runs,
    ...optional('vatId', vatId.runs),
    ...optional('taxNumber', taxNumber.runs),
    ...optional('legalId', legalId),
    ...optional('electronicAddress', electronicAddress),
    ...optional('contact', contact),
    address,
  }
}

/** The buyer, its identifiers held to what a reverse-charged category needs. */
function readBuyer(c: Ctx, value: unknown, path: string, codes: readonly VatCategoryCode[] | undefined): EInvoiceBuyer | undefined {
  const o = readPart(c, value, path, ['name', 'address'], ['vatId', 'legalId', 'electronicAddress'])
  if (o === undefined) return undefined
  const terms = E_INVOICE_TEXT_TERMS.buyer
  const name = readTerm(c, o.name, at(path, 'name'), terms.name)
  const vatId = readTerm(c, o.vatId, at(path, 'vatId'), terms.vatId)
  const legalId = readLegalId(c, o.legalId, at(path, 'legalId'), 'buyer')
  const electronicAddress = readElectronicAddress(c, o.electronicAddress, at(path, 'electronicAddress'), 'buyer')
  const address = readAddress(c, o.address, at(path, 'address'), 'buyer')
  const broken = codes && buyerIdentificationBreak({ vatId: o.vatId !== undefined, legalId: o.legalId !== undefined }, codes)
  if (broken !== undefined) c.f.report(path, 'invalid-e-invoice', broken)
  if (name.runs === undefined || address === undefined || !read(o, 'vatId', vatId.runs) || !read(o, 'legalId', legalId) || !read(o, 'electronicAddress', electronicAddress)) return undefined
  return { name: name.runs, ...optional('vatId', vatId.runs), ...optional('legalId', legalId), ...optional('electronicAddress', electronicAddress), address }
}

/** A category as read: the category when all of it was, and the code and the rate by value when each was. */
interface ReadCategory {
  readonly category: VatCategory | undefined
  readonly id: string | undefined
  readonly code: VatCategoryCode | undefined
  readonly rate: string | undefined
}

function readVatCategory(c: Ctx, value: unknown, path: string): ReadCategory {
  const o = shape(c.f, value, path, ['id', 'code', 'rate'], ['reason'])
  const id = fieldKey(c.f, o?.id, at(path, 'id'))
  const code = oneOf(c.f, o?.code, at(path, 'code'), VAT_CATEGORY_CODES)
  const written = reference(c.f, o?.rate, at(path, 'rate'))
  const checked = written === undefined || code === undefined ? undefined : checkVatRate(code, written)
  if (checked?.ok === false) c.f.report(at(path, 'rate'), 'invalid-e-invoice', `the VAT category's rate (BT-119) ${checked.rule}`)
  const reason = readTerm(c, o?.reason, at(path, 'reason'), E_INVOICE_TEXT_TERMS.reason)
  const unreasoned = o && code && vatReasonBreak(code, o.reason !== undefined)
  if (unreasoned !== undefined) c.f.report(at(path, 'reason'), 'invalid-e-invoice', unreasoned)
  const rate = checked?.ok === true ? checked.value : undefined
  if (o === undefined || id === undefined || code === undefined || rate === undefined || written === undefined || !read(o, 'reason', reason.runs)) {
    return { category: undefined, id, code, rate }
  }
  return { category: { id, code, rate: written, ...optional('reason', reason.runs) }, id, code, rate }
}

/** What a breakdown's refusal is said of: its rate, or the category itself. */
const BREAKDOWN_FIELDS = { rate: "the VAT category's rate (BT-119)", code: 'the VAT category (BT-118)' } as const

/**
 * The categories, one at least (BR-CO-18), each id once, each one breakdown
 * (`vatCategoryBreaks`); and their codes, when every one could be read, for
 * what the parties' identifiers must be.
 */
function readVatCategories(c: Ctx, value: unknown, path: string): { categories: readonly VatCategory[] | undefined; codes: readonly VatCategoryCode[] | undefined } {
  const items = readArray(c.f, value, path, MAX_VAT_CATEGORIES)
  if (items === undefined) return { categories: undefined, codes: undefined }
  if (items.length === 0) c.f.report(path, 'invalid-e-invoice', en16931Rule('BR-CO-18', 'an e-invoice declares one VAT category at least, the VAT breakdown (BG-23) its lines are in'))
  const read = items.map((item, index) => readVatCategory(c, item, at(path, index)))
  declare(
    c.f,
    read.map(({ id }, index) => ({ id, path: at(at(path, index), 'id'), value: true })),
    'duplicate-id',
    (id) => `${id} is already the id of a VAT category of this invoice`,
  )
  const rated = read.flatMap(({ code, rate }, index) => (code === undefined || rate === undefined ? [] : [{ index, code, rate }]))
  for (const { index, field, rule } of vatCategoryBreaks(rated)) {
    c.f.report(at(at(path, (rated[index] as { index: number }).index), field), 'invalid-e-invoice', `${BREAKDOWN_FIELDS[field]} ${rule}`)
  }
  const codes = read.map(({ code }) => code)
  const categories = read.map(({ category }) => category)
  return {
    categories: categories.every((category) => category !== undefined) ? categories : undefined,
    codes: codes.every((code) => code !== undefined) ? codes : undefined,
  }
}

/** The invoicing period: a start, an end or both (BR-CO-19), each an expression. */
function readPeriod(c: Ctx, value: unknown, path: string): InvoicingPeriod | undefined {
  const o = shape(c.f, value, path, [], ['start', 'end'])
  if (o === undefined) return undefined
  const broken = periodBreak(o.start !== undefined, o.end !== undefined)
  if (broken !== undefined) c.f.report(path, 'invalid-e-invoice', broken)
  const start = readExpression(c.f, o.start, at(path, 'start'))
  const end = readExpression(c.f, o.end, at(path, 'end'))
  if (broken !== undefined || !read(o, 'start', start) || !read(o, 'end', end)) return undefined
  return { ...optional('start', start), ...optional('end', end) }
}

/** The payment instructions, and the account as the XML writes it when it is literal and its rule took it. */
function readPayment(c: Ctx, value: unknown, path: string): { payment: PaymentInstructions | undefined; account: string | undefined } {
  const o = readPart(c, value, path, ['means', 'iban'], ['bic', 'accountName', 'remittance'])
  const means = oneOf(c.f, o?.means, at(path, 'means'), PAYMENT_MEANS_CODES)
  const terms = E_INVOICE_TEXT_TERMS.payment
  const iban = readTerm(c, o?.iban, at(path, 'iban'), terms.iban)
  const bic = readTerm(c, o?.bic, at(path, 'bic'), terms.bic)
  const accountName = readTerm(c, o?.accountName, at(path, 'accountName'), terms.accountName)
  const remittance = readTerm(c, o?.remittance, at(path, 'remittance'), terms.remittance)
  if (o === undefined || means === undefined || iban.runs === undefined || !read(o, 'bic', bic.runs) || !read(o, 'accountName', accountName.runs) || !read(o, 'remittance', remittance.runs)) {
    return { payment: undefined, account: iban.checked }
  }
  const payment = { means, iban: iban.runs, ...optional('bic', bic.runs), ...optional('accountName', accountName.runs), ...optional('remittance', remittance.runs) }
  return { payment, account: iban.checked }
}

const FACTUR_X_REQUIRED = ['kind', 'profile', 'type', 'currency', 'number', 'issued', 'seller', 'buyer', 'vat', 'lines']
const FACTUR_X_OPTIONAL = ['businessProcess', 'buyerReference', 'delivered', 'period', 'payment', 'due', 'terms', 'paid']

function readFacturX(c: Ctx, o: Record<string, unknown>, path: string, around: EInvoiceSurroundings): FacturXInvoice | undefined {
  strictKeys(c.f, o, path, FACTUR_X_REQUIRED, FACTUR_X_OPTIONAL)
  const profile = oneOf(c.f, o.profile, at(path, 'profile'), E_INVOICE_PROFILES)
  const type = oneOf(c.f, o.type, at(path, 'type'), INVOICE_TYPE_CODES)
  const currency = oneOf(c.f, o.currency, at(path, 'currency'), E_INVOICE_CURRENCIES)
  const number = readTerm(c, o.number, at(path, 'number'), E_INVOICE_TEXT_TERMS.number)
  const issued = readExpression(c.f, o.issued, at(path, 'issued'))
  const businessProcess = readTerm(c, o.businessProcess, at(path, 'businessProcess'), E_INVOICE_TEXT_TERMS.businessProcess)
  // The categories first: what the parties' identifiers must be depends on their codes.
  const { categories, codes } = readVatCategories(c, o.vat, at(path, 'vat'))
  const seller = readSeller(c, o.seller, at(path, 'seller'), codes)
  const buyer = readBuyer(c, o.buyer, at(path, 'buyer'), codes)
  const buyerReference = readTerm(c, o.buyerReference, at(path, 'buyerReference'), E_INVOICE_TEXT_TERMS.buyerReference)
  const unsupplied = supplyBreak(o.delivered !== undefined, o.period !== undefined)
  if (unsupplied !== undefined) c.f.report(at(path, 'delivered'), 'invalid-e-invoice', unsupplied)
  const delivered = readExpression(c.f, o.delivered, at(path, 'delivered'))
  const period = readPeriod(c, o.period, at(path, 'period'))
  const { lines, named } = readLines(c, o.lines, at(path, 'lines'))
  const { payment, account } = readPayment(c, o.payment, at(path, 'payment'))
  const due = readExpression(c.f, o.due, at(path, 'due'))
  const terms = readTerm(c, o.terms, at(path, 'terms'), E_INVOICE_TEXT_TERMS.terms)
  const paid = readExpression(c.f, o.paid, at(path, 'paid'))
  checkEInvoiceReport(c, path, around, { named, pays: o.payment !== undefined, account })
  if (
    profile === undefined ||
    type === undefined ||
    currency === undefined ||
    number.runs === undefined ||
    issued === undefined ||
    seller === undefined ||
    buyer === undefined ||
    categories === undefined ||
    lines === undefined ||
    !read(o, 'businessProcess', businessProcess.runs) ||
    !read(o, 'buyerReference', buyerReference.runs) ||
    !read(o, 'delivered', delivered) ||
    !read(o, 'period', period) ||
    !read(o, 'payment', payment) ||
    !read(o, 'due', due) ||
    !read(o, 'terms', terms.runs) ||
    !read(o, 'paid', paid)
  ) {
    return undefined
  }
  return {
    kind: 'facturX',
    profile,
    type,
    currency,
    number: number.runs,
    issued,
    ...optional('businessProcess', businessProcess.runs),
    seller,
    buyer,
    ...optional('buyerReference', buyerReference.runs),
    ...optional('delivered', delivered),
    ...optional('period', period),
    vat: categories,
    lines,
    ...optional('payment', payment),
    ...optional('due', due),
    ...optional('terms', terms.runs),
    ...optional('paid', paid),
  }
}

type EInvoiceReader<E extends EInvoice> = (c: Ctx, o: Record<string, unknown>, path: string, around: EInvoiceSurroundings) => E | undefined

/** How each kind of e-invoice is read. A table over every kind, so a kind added to E_INVOICE_KINDS without a reader does not compile. */
const READERS: { readonly [K in EInvoiceKind]: EInvoiceReader<Extract<EInvoice, { kind: K }>> } = {
  facturX: readFacturX,
}

/**
 * The e-invoice at `path`, read with what it says of the report around it:
 * its title, its regions and its payment part, as far as each could be
 * read. Absent, the report is none.
 */
export function readEInvoice(c: Ctx, value: unknown, path: string, around: EInvoiceSurroundings): EInvoice | undefined {
  const o = typeof value === 'string' ? unquoted(c, path, 'an object', E_INVOICE_SCOPE) : readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, E_INVOICE_KINDS)
  if (o === undefined || kind === undefined) return undefined
  return READERS[kind](c, o, path, around)
}
