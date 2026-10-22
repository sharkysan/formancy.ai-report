/**
 * An e-invoice's fields (0044): every term of report-spec's `EInvoice`, of
 * either kind -- 0027's, 0037's and 0038's -- as the properties pane shows
 * it when the e-invoice is selected.
 *
 * Tables over every term, part by part -- the invoice's own, a party's,
 * its address's, its contact's, a VAT category's, the lines' and the
 * payment instructions' -- so that a term added to the format without its
 * field does not compile. The parties, the seller's contact, each VAT
 * category, the lines and the payment instructions are groups, each name
 * in them said after what it is of ("Buyer's city", "VAT category 2:
 * rate in per cent"), so that every name is unique in the form; an
 * XRechnung's own terms -- its version, the buyer's reference that carries
 * a public buyer's Leitweg-ID, and the business process -- are a group of
 * their own, first.
 *
 * Each text is edited run by run as a payment code's is, one line each but
 * the payment terms, where a line break stands (BT-20). A part a party may
 * leave out that is one identifier and a scheme -- its legal registration,
 * its electronic address -- is put in by typing its identifier and taken
 * away by emptying it; the seller's contact and the payment instructions,
 * of several terms, are optional groups with Add and Remove in a Factur-X
 * invoice, which may leave them out, and part of every XRechnung, which
 * needs them (0038). The VAT categories are a list, added to, moved and
 * removed one step each. A line's identifier, unit and category are read
 * from a detail field or an expression: a choice of the two, and the
 * expression's own field where it is one.
 *
 * What a field makes of what was typed is the same as everywhere: whether
 * it is an invoice EN 16931's and XRechnung's rules take is report-spec's
 * to say when the edit is applied, on the field typed in, in its words.
 * The IBAN's field writes the account the e-invoice shares with every
 * payment code printed with it, which `properties.ts` makes one command.
 */
import {
  ADDRESS_SCHEMES,
  E_INVOICE_CURRENCIES,
  E_INVOICE_PROFILES,
  FACTUR_X_PROFILES,
  INVOICE_TYPE_CODES,
  PAYMENT_MEANS_CODES,
  SCHEME_IDS,
  VAT_CATEGORY_CODES,
  vatCategoryBreaks,
  walkComponents,
  XRECHNUNG_VERSIONS,
} from '@formancy/report-spec'
import type {
  EInvoice,
  EInvoiceAddress,
  EInvoiceBuyer,
  EInvoiceLines,
  EInvoiceSeller,
  FacturXInvoice,
  Inline,
  InvoicingPeriod,
  PaymentInstructions,
  RowValue,
  SellerContact,
  VatCategory,
  XRechnungInvoice,
} from '@formancy/report-spec'
import type { PropertyOption } from './model-properties.js'
import { NO_ACCOUNT } from './palette.js'
import { choiceField, codeTextFields, expressionField, isGroup, optionalCodeTextFields, optionalGroup, textField } from './property-fields.js'
import type { FieldContext, FieldSpec, GroupButton, GroupSpec, PanelSpec, Written } from './property-fields.js'
import { contentLocale, editorText } from './text.js'
import type { MessageId } from './text.js'

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]
const KEEP: Written = { ok: true, unchanged: true }
const setTo = (next: unknown, at: string): Written => ({ ok: true, value: next, at })

type Party = 'seller' | 'buyer'
type Choice = PropertyOption & { readonly stored: unknown }

/** The words of each part of a party's postal address (BG-5, BG-8), named after the party. */
const ADDRESS_WORDS: { readonly [P in Party]: { readonly [K in keyof EInvoiceAddress]-?: MessageId } } = {
  seller: { line1: 'field.sellerLine1', line2: 'field.sellerLine2', postalCode: 'field.sellerPostalCode', city: 'field.sellerCity', country: 'field.sellerCountry' },
  buyer: { line1: 'field.buyerLine1', line2: 'field.buyerLine2', postalCode: 'field.buyerPostalCode', city: 'field.buyerCity', country: 'field.buyerCountry' },
}

/** A party's postal address, part by part as EN 16931 lists them, the second line alone one it may leave out. */
function addressFields(party: Party, address: EInvoiceAddress, context: FieldContext): FieldSpec[] {
  const words = ADDRESS_WORDS[party]
  const key = (part: keyof EInvoiceAddress): string => `/${party}/address/${part}`
  const PARTS: { readonly [K in keyof EInvoiceAddress]-?: () => FieldSpec[] } = {
    line1: () => codeTextFields(address.line1, key('line1'), words.line1, context),
    line2: () => optionalCodeTextFields(address.line2, key('line2'), words.line2, context),
    postalCode: () => codeTextFields(address.postalCode, key('postalCode'), words.postalCode, context),
    city: () => codeTextFields(address.city, key('city'), words.city, context),
    country: () => codeTextFields(address.country, key('country'), words.country, context),
  }
  return (Object.keys(PARTS) as (keyof EInvoiceAddress)[]).flatMap((part) => PARTS[part]())
}

/**
 * A part of a party that is one identifier and a scheme, at `owner`, which
 * the party may leave out -- its legal registration (BT-30, BT-47), its
 * electronic address (BT-34, BT-49): its identifier's field, typed into
 * while the part is absent, puts the part in, as `fresh` makes it; emptied,
 * it takes the whole part away; the scheme is a choice while it is there.
 */
function identifiedFields(owner: string, part: { readonly id: readonly Inline[]; readonly scheme?: string } | undefined, words: { readonly id: MessageId; readonly scheme: MessageId }, schemes: readonly Choice[], fresh: (id: readonly Inline[]) => unknown, context: FieldContext): FieldSpec[] {
  const ids = optionalCodeTextFields(part?.id, `${owner}/id`, words.id, context).map(
    (spec): FieldSpec => ({
      ...spec,
      write: (input) => {
        const written = spec.write(input)
        if (!written.ok || 'unchanged' in written) return written
        if (written.value === null) return setTo(null, owner)
        return part === undefined ? setTo(fresh(written.value as readonly Inline[]), owner) : written
      },
    }),
  )
  return part === undefined ? ids : [...ids, choiceField(`${owner}/scheme`, { id: words.scheme }, 'select', schemes, part.scheme ?? '')]
}

/** The schemes a legal registration may be given in (BT-30-1, BT-47-1), none among them: a German commercial register number has none. */
const legalSchemes = ({ t }: FieldContext): Choice[] => [{ value: '', label: t('option.none'), stored: null }, ...SCHEME_IDS.map((scheme) => ({ value: scheme, label: t(`option.scheme${scheme}`), stored: scheme }))]

/** The schemes an electronic address is given in (BT-34-1, BT-49-1), one of which it needs (BR-62, BR-63). */
const addressSchemes = ({ t }: FieldContext): Choice[] => ADDRESS_SCHEMES.map((scheme) => ({ value: scheme, label: t(`option.address${scheme}`), stored: scheme }))

/** A party's legal registration, its words named after the party. */
function legalFields(party: Party, id: MessageId, scheme: MessageId, legal: EInvoiceSeller['legalId'], context: FieldContext): FieldSpec[] {
  return identifiedFields(`/${party}/legalId`, legal, { id, scheme }, legalSchemes(context), (runs) => ({ id: runs }), context)
}

/** A party's electronic address, put in by email (EM) until its scheme is chosen. */
function electronicFields(party: Party, id: MessageId, scheme: MessageId, address: EInvoiceSeller['electronicAddress'], context: FieldContext): FieldSpec[] {
  return identifiedFields(`/${party}/electronicAddress`, address, { id, scheme }, addressSchemes(context), (runs) => ({ id: runs, scheme: 'EM' }), context)
}

/** The seller's contact's terms (BG-6): its contact point, its telephone number and its email address, each needed while there is a contact. */
function contactFields(contact: SellerContact, context: FieldContext): FieldSpec[] {
  const TERMS: { readonly [K in keyof SellerContact]-?: () => FieldSpec[] } = {
    name: () => codeTextFields(contact.name, '/seller/contact/name', 'field.contactName', context),
    telephone: () => codeTextFields(contact.telephone, '/seller/contact/telephone', 'field.contactTelephone', context),
    email: () => codeTextFields(contact.email, '/seller/contact/email', 'field.contactEmail', context),
  }
  return (Object.keys(TERMS) as (keyof SellerContact)[]).flatMap((term) => TERMS[term]())
}

/**
 * What Add contact puts in, until the seller's own is given: a name in the
 * report's language, as a new component's words are (`contentLocale`);
 * one of the Bundesnetzagentur's numbers for Köln kept for media, 0221
 * 4710 000 to 999, which the corpus's samples read (`e-invoice.ts`); and an
 * address under `example.com`, a name RFC 2606 reserves -- neither reaches
 * anyone. Each holds to XRechnung's shapes (BR-DE-27, -28).
 */
function exampleContact(context: FieldContext): SellerContact {
  return { name: said(editorText(contentLocale(context.report.locale))('default.contactName')), telephone: said('+49 221 4710 000'), email: said('contact@example.com') }
}

const CONTACT_WORDS = { add: 'action.addContact', remove: 'action.removeContact', added: 'history.addContact', removed: 'history.removeContact', announced: { added: 'status.itemAdded', removed: 'status.itemRemoved' } } as const

/** The seller's contact: a group of its own, optional in a Factur-X invoice, part of every XRechnung (BR-DE-2). */
function contactGroup(contact: SellerContact | undefined, kind: EInvoice['kind'], context: FieldContext): GroupSpec {
  const fields = contact === undefined ? undefined : contactFields(contact, context)
  if (kind === 'xrechnung') return { key: '/seller/contact', words: 'group.sellerContact', fields: fields ?? [], buttons: [] }
  return optionalGroup('/seller/contact', 'group.sellerContact', fields, exampleContact(context), CONTACT_WORDS)
}

type PartyFields<P> = (party: P, kind: EInvoice['kind'], context: FieldContext) => readonly PanelSpec[]

/** Each of the seller's terms (BG-4), in EN 16931's order: its fields, and its contact's group. */
const SELLER: { readonly [K in keyof EInvoiceSeller]-?: PartyFields<EInvoiceSeller> } = {
  name: (seller, _kind, context) => codeTextFields(seller.name, '/seller/name', 'field.sellerName', context),
  vatId: (seller, _kind, context) => optionalCodeTextFields(seller.vatId, '/seller/vatId', 'field.sellerVatId', context),
  taxNumber: (seller, _kind, context) => optionalCodeTextFields(seller.taxNumber, '/seller/taxNumber', 'field.sellerTaxNumber', context),
  legalId: (seller, _kind, context) => legalFields('seller', 'field.sellerLegalId', 'field.sellerLegalScheme', seller.legalId, context),
  electronicAddress: (seller, _kind, context) => electronicFields('seller', 'field.sellerAddress', 'field.sellerAddressScheme', seller.electronicAddress, context),
  address: (seller, _kind, context) => addressFields('seller', seller.address, context),
  contact: (seller, kind, context) => [contactGroup(seller.contact, kind, context)],
}

/** Each of the buyer's terms (BG-7), in EN 16931's order. */
const BUYER: { readonly [K in keyof EInvoiceBuyer]-?: PartyFields<EInvoiceBuyer> } = {
  name: (buyer, _kind, context) => codeTextFields(buyer.name, '/buyer/name', 'field.buyerName', context),
  vatId: (buyer, _kind, context) => optionalCodeTextFields(buyer.vatId, '/buyer/vatId', 'field.buyerVatId', context),
  legalId: (buyer, _kind, context) => legalFields('buyer', 'field.buyerLegalId', 'field.buyerLegalScheme', buyer.legalId, context),
  electronicAddress: (buyer, _kind, context) => electronicFields('buyer', 'field.buyerAddress', 'field.buyerAddressScheme', buyer.electronicAddress, context),
  address: (buyer, _kind, context) => addressFields('buyer', buyer.address, context),
}

/** A party's group, its fields in its table's order, and any group of its own -- the seller's contact -- after it. */
function partyGroups<P extends object>(key: string, words: MessageId, party: P, terms: { readonly [K in keyof P]-?: PartyFields<P> }, kind: EInvoice['kind'], context: FieldContext): PanelSpec[] {
  const specs = (Object.keys(terms) as (keyof P)[]).flatMap((term) => terms[term](party, kind, context))
  return [{ key, words, fields: specs.filter((spec): spec is FieldSpec => !isGroup(spec)), buttons: [] }, ...specs.filter(isGroup)]
}

/** Each VAT category's code, as its option says it. */
const vatCodes = ({ t }: FieldContext): Choice[] => VAT_CATEGORY_CODES.map((code) => ({ value: code, label: t(`option.vat${code}`), stored: code }))

/**
 * A VAT category's group, the item at `index` of `count`, numbered from 1:
 * its identifier, the code, the rate and the exemption reason, and its
 * Move up, Move down and Remove, each one step, the keyboard following the
 * category it moved and going to the list's Add once it is removed.
 */
function vatGroup(category: VatCategory, index: number, count: number, context: FieldContext): GroupSpec {
  const item = index + 1
  const key = `/vat/${index}`
  const TERMS: { readonly [K in keyof VatCategory]-?: () => FieldSpec[] } = {
    id: () => [textField(`${key}/id`, { id: 'field.vatCategoryId', item }, 'text', () => category.id)],
    code: () => [choiceField(`${key}/code`, { id: 'field.vatCategoryCode', item }, 'select', vatCodes(context), category.code)],
    rate: () => [textField(`${key}/rate`, { id: 'field.vatCategoryRate', item }, 'text', () => category.rate)],
    reason: () => optionalCodeTextFields(category.reason, `${key}/reason`, { id: 'field.vatCategoryReason', item }, context),
  }
  const up = index > 0
  const down = index < count - 1
  const buttons: GroupButton[] = [
    { words: 'action.moveVatCategoryUp', item, action: { type: 'moveItem', key, to: index - 1 }, available: up, ...(up ? { then: { group: `/vat/${index - 1}`, button: 0 } } : {}) },
    { words: 'action.moveVatCategoryDown', item, action: { type: 'moveItem', key, to: index + 1 }, available: down, ...(down ? { then: { group: `/vat/${index + 1}`, button: 1 } } : {}) },
    { words: 'action.removeVatCategory', item, action: { type: 'removeItem', key }, available: true, then: { group: '/vat', button: 0 } },
  ]
  return { key, words: 'group.vatCategory', item, fields: (Object.keys(TERMS) as (keyof VatCategory)[]).flatMap((term) => TERMS[term]()), buttons }
}

/**
 * The VAT category Add VAT category puts at the end of the list, under the
 * first identifier `category` and a number gives that the invoice does not
 * hold: the first of Germany's that is another breakdown than every one
 * the invoice declares, by report-spec's own rule (`vatCategoryBreaks`),
 * since this version writes German invoices alone (0027) -- standard rated
 * at 19 % (§ 12 Abs. 1 UStG), at 7 % (Abs. 2), exempt, reverse-charged,
 * the last two with a reason in the report's language, the reverse
 * charge's the words § 14a Abs. 5 UStG asks for in a German report, and an
 * exemption's naming no provision, which the seller gives. Where the
 * invoice declares all four, it is the first again, which report-spec
 * would refuse (BR-S-08), and `free` says so, so that the button is drawn
 * unavailable and, pressed, says why.
 */
function freshCategory(categories: readonly VatCategory[], context: FieldContext): { readonly category: VatCategory; readonly free: boolean } {
  const taken = new Set(categories.map((category) => category.id))
  let number = categories.length + 1
  while (taken.has(`category${String(number)}`)) number += 1
  const words = editorText(contentLocale(context.report.locale))
  const candidates: readonly Omit<VatCategory, 'id'>[] = [
    { code: 'S', rate: '19' },
    { code: 'S', rate: '7' },
    { code: 'E', rate: '0', reason: said(words('default.exemptReason')) },
    { code: 'AE', rate: '0', reason: said(words('default.reverseChargeReason')) },
  ]
  const free = candidates.find((candidate) => !vatCategoryBreaks([...categories, candidate]).some((broken) => broken.index === categories.length))
  return { category: { id: `category${String(number)}`, ...(free ?? (candidates[0] as Omit<VatCategory, 'id'>)) }, free: free !== undefined }
}

/** The VAT categories, a group each, then the list's own group, with Add VAT category, the keyboard going to the new category's first field, unavailable where the invoice holds every breakdown it adds. */
function vatGroups(categories: readonly VatCategory[], context: FieldContext): GroupSpec[] {
  const { category, free } = freshCategory(categories, context)
  const list: GroupSpec = {
    key: '/vat',
    words: 'group.vatCategories',
    fields: [],
    buttons: [{ words: 'action.addVatCategory', action: { type: 'addItem', key: '/vat' }, available: free, ...(free ? { then: { group: `/vat/${String(categories.length)}` } } : {}) }],
    list: {
      key: '/vat',
      items: categories,
      value: category,
      item: 'group.vatCategory',
      added: 'history.addVatCategory',
      removed: 'history.removeVatCategory',
      moved: 'history.moveVatCategory',
      ...(free ? {} : { full: 'status.vatCategoriesFull' }),
    },
  }
  return [...categories.map((category, index) => vatGroup(category, index, categories.length, context)), list]
}

/** The report's tables, by id: the lines are the rows of one of them. */
function tableChoices({ report }: FieldContext): Choice[] {
  return walkComponents(report).flatMap(({ component }) => (component.kind === 'table' ? [{ value: component.id, label: component.id, stored: component.id }] : []))
}

/** The columns of the table the lines name, by heading -- and id, where two share one -- each what a column of a line's term may be. */
function columnChoices(lines: EInvoiceLines, { report }: FieldContext): Choice[] {
  const found = walkComponents(report).find(({ component }) => component.id === lines.table)?.component
  const columns = found?.kind === 'table' ? found.columns : []
  const label = (header: string, id: string): string => (header === '' ? id : columns.filter((column) => column.header === header).length > 1 ? `${header} (${id})` : header)
  return columns.map((column) => ({ value: column.id, label: label(column.header, column.id), stored: column.id }))
}

/**
 * A line's code read from each row (`RowValue`): a choice of a detail
 * field or an expression and, where it is an expression, the expression.
 * An expression chosen over a field reads that field (`row.<field>`), so
 * that the choice alone changes nothing the line holds.
 */
function rowValueFields(row: RowValue, key: string, words: MessageId, expression: MessageId, context: FieldContext): FieldSpec[] {
  const fields = (context.report.datasets.detail?.fields ?? []).filter((field) => field.type !== 'image')
  const asExpression: RowValue = row.kind === 'expression' ? row : { kind: 'expression', expression: { cel: `row.${row.field.field}` } }
  const options: Choice[] = [
    ...fields.map((field) => ({ value: `field:${field.id}`, label: field.label, stored: { kind: 'field', field: { dataset: 'detail', field: field.id } } })),
    { value: 'expression', label: context.t('option.readExpression'), stored: asExpression },
  ]
  const choice = choiceField(key, { id: words }, 'select', options, row.kind === 'field' ? `field:${row.field.field}` : 'expression')
  return row.kind === 'expression' ? [choice, expressionField(`${key}/expression`, { id: expression }, row.expression.cel, true)] : [choice]
}

/** Each of the lines' terms (BG-25): the table, the column of each of the four a page prints, and the three codes read from each row. */
const LINES: { readonly [K in keyof EInvoiceLines]-?: (lines: EInvoiceLines, context: FieldContext) => FieldSpec[] } = {
  table: (lines, context) => [choiceField('/lines/table', { id: 'field.linesTable' }, 'select', tableChoices(context), lines.table)],
  name: (lines, context) => [choiceField('/lines/name', { id: 'field.lineName' }, 'select', columnChoices(lines, context), lines.name)],
  quantity: (lines, context) => [choiceField('/lines/quantity', { id: 'field.lineQuantity' }, 'select', columnChoices(lines, context), lines.quantity)],
  netPrice: (lines, context) => [choiceField('/lines/netPrice', { id: 'field.lineNetPrice' }, 'select', columnChoices(lines, context), lines.netPrice)],
  netAmount: (lines, context) => [choiceField('/lines/netAmount', { id: 'field.lineNetAmount' }, 'select', columnChoices(lines, context), lines.netAmount)],
  id: (lines, context) => rowValueFields(lines.id, '/lines/id', 'field.lineId', 'field.lineIdExpression', context),
  unit: (lines, context) => rowValueFields(lines.unit, '/lines/unit', 'field.lineUnit', 'field.lineUnitExpression', context),
  vat: (lines, context) => rowValueFields(lines.vat, '/lines/vat', 'field.lineVat', 'field.lineVatExpression', context),
}

/** Each of the payment instructions' terms (BG-16): the means, the account the payment codes share, its bank, its name and the remittance information. */
const PAYMENT: { readonly [K in keyof PaymentInstructions]-?: (payment: PaymentInstructions, context: FieldContext) => FieldSpec[] } = {
  means: (payment, { t }) => [choiceField('/payment/means', { id: 'field.paymentMeans' }, 'select', PAYMENT_MEANS_CODES.map((code) => ({ value: code, label: t(`option.means${code}`), stored: code })), payment.means)],
  iban: (payment, context) => codeTextFields(payment.iban, '/payment/iban', 'field.iban', context),
  bic: (payment, context) => optionalCodeTextFields(payment.bic, '/payment/bic', 'field.bic', context),
  accountName: (payment, context) => optionalCodeTextFields(payment.accountName, '/payment/accountName', 'field.accountName', context),
  remittance: (payment, context) => optionalCodeTextFields(payment.remittance, '/payment/remittance', 'field.remittance', context),
}

const PAYMENT_WORDS = { add: 'action.addPayment', remove: 'action.removePayment', added: 'history.addPayment', removed: 'history.removePayment', announced: { added: 'status.itemAdded', removed: 'status.itemRemoved' } } as const

/**
 * The payment instructions' group: optional in a Factur-X invoice, added
 * as a SEPA credit transfer to the palette's account that pays nobody,
 * until the seller's own is typed; part of every XRechnung (BR-DE-1).
 */
function paymentGroup(invoice: EInvoice, context: FieldContext): GroupSpec {
  const { payment } = invoice
  const fields = payment === undefined ? undefined : (Object.keys(PAYMENT) as (keyof PaymentInstructions)[]).flatMap((term) => PAYMENT[term](payment, context))
  if (invoice.kind === 'xrechnung') return { key: '/payment', words: 'group.payment', fields: fields ?? [], buttons: [] }
  return optionalGroup('/payment', 'group.payment', fields, { means: '58', iban: said(NO_ACCOUNT) }, PAYMENT_WORDS)
}

/**
 * The start or the end of the invoicing period (BT-73, BT-74), either of
 * which it may give: typed while there is no period, it puts one in;
 * emptied, the period goes with it where the other is not given either.
 */
function periodField(term: keyof InvoicingPeriod, period: InvoicingPeriod | undefined, words: MessageId): FieldSpec {
  const spec = expressionField(`/period/${term}`, { id: words }, period?.[term]?.cel, false)
  const other = term === 'start' ? 'end' : 'start'
  return {
    ...spec,
    write: (input) => {
      const written = spec.write(input)
      if (!written.ok || 'unchanged' in written) return written
      if (period === undefined) return written.value === null ? KEEP : setTo({ [term]: written.value }, '/period')
      return written.value === null && period[other] === undefined ? setTo(null, '/period') : written
    },
  }
}

/** Every term of either kind but the kind itself, which never changes in place. */
type Term = Exclude<keyof FacturXInvoice | keyof XRechnungInvoice, 'kind'>

type TermFields = (invoice: EInvoice, context: FieldContext) => readonly PanelSpec[]

/** Each term's fields or groups, in the order the panel shows them: what names the invoice, its dates and routing, the parties, when it was supplied, its categories, its lines, how it is paid. */
const TERMS: { readonly [K in Term]-?: TermFields } = {
  version: (invoice) =>
    invoice.kind === 'xrechnung' ? [choiceField('/version', { id: 'field.xrechnungVersion' }, 'select', XRECHNUNG_VERSIONS.map((version) => ({ value: version, label: version, stored: version })), invoice.version)] : [],
  profile: (invoice) =>
    invoice.kind === 'facturX'
      ? [choiceField('/profile', { id: 'field.profile' }, 'select', E_INVOICE_PROFILES.map((profile) => ({ value: profile, label: FACTUR_X_PROFILES[profile].conformanceLevel, stored: profile })), invoice.profile)]
      : [],
  type: (invoice, { t }) => [choiceField('/type', { id: 'field.invoiceType' }, 'select', INVOICE_TYPE_CODES.map((code) => ({ value: code, label: t(`option.invoiceType${code}`), stored: code })), invoice.type)],
  currency: (invoice) => [choiceField('/currency', { id: 'field.currency' }, 'select', E_INVOICE_CURRENCIES.map((code) => ({ value: code, label: code, stored: code })), invoice.currency)],
  number: (invoice, context) => codeTextFields(invoice.number, '/number', 'field.invoiceNumber', context),
  issued: (invoice) => [expressionField('/issued', { id: 'field.issued' }, invoice.issued.cel, true)],
  buyerReference: (invoice, context) => optionalCodeTextFields(invoice.buyerReference, '/buyerReference', 'field.buyerReference', context),
  businessProcess: (invoice, context) => optionalCodeTextFields(invoice.businessProcess, '/businessProcess', 'field.businessProcess', context),
  seller: (invoice, context) => partyGroups('/seller', 'group.seller', invoice.seller, SELLER, invoice.kind, context),
  buyer: (invoice, context) => partyGroups('/buyer', 'group.buyer', invoice.buyer, BUYER, invoice.kind, context),
  delivered: (invoice) => [expressionField('/delivered', { id: 'field.delivered' }, invoice.delivered?.cel, false)],
  period: (invoice) => [periodField('start', invoice.period, 'field.periodStart'), periodField('end', invoice.period, 'field.periodEnd')],
  vat: (invoice, context) => vatGroups(invoice.vat, context),
  lines: (invoice, context) => [{ key: '/lines', words: 'group.lines', fields: (Object.keys(LINES) as (keyof EInvoiceLines)[]).flatMap((term) => LINES[term](invoice.lines, context)), buttons: [] }],
  payment: (invoice, context) => [paymentGroup(invoice, context)],
  due: (invoice) => [expressionField('/due', { id: 'field.due' }, invoice.due?.cel, false)],
  terms: (invoice, context) => optionalCodeTextFields(invoice.terms, '/terms', 'field.paymentTerms', context, undefined, 'multiline'),
  paid: (invoice) => [expressionField('/paid', { id: 'field.paid' }, invoice.paid?.cel, false)],
}

/** An XRechnung's own terms, its group first in the panel: its version, the buyer's reference that carries a public buyer's Leitweg-ID, and the business process (0038). */
const XRECHNUNG_TERMS: readonly Term[] = ['version', 'buyerReference', 'businessProcess']

/** An e-invoice's fields and groups, every term's, in the order of `TERMS`; an XRechnung's own first, in a group of their own, keyed by the invoice itself. */
export function invoiceFields(invoice: EInvoice, context: FieldContext): PanelSpec[] {
  const terms = Object.keys(TERMS) as Term[]
  const of = (term: Term): readonly PanelSpec[] => TERMS[term](invoice, context)
  if (invoice.kind !== 'xrechnung') return terms.flatMap(of)
  const own = XRECHNUNG_TERMS.flatMap(of).filter((spec): spec is FieldSpec => !isGroup(spec))
  return [{ key: '', words: 'group.xrechnung', fields: own, buttons: [] }, ...terms.filter((term) => !XRECHNUNG_TERMS.includes(term)).flatMap(of)]
}
