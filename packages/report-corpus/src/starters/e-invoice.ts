import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { EURO_COUNTRIES } from './euro-invoice-countries.js'
import { EURO_WORDS } from './euro-invoice-words.js'
import { dated, EUR, EURO_PAGE, EURO_STYLES, payment, positions, recipient, sender } from './euro-invoice.js'
import { LETTERHEAD, LOGO_ASSET } from './logo.js'
import { lineAmount } from './quotation.js'
import type { Starter } from './starter.js'

/**
 * The e-invoice, "Rechnung (ZUGFeRD)": the euro invoice's heating firm
 * invoicing a German business, as an EN 16931 invoice the runtime writes
 * as Factur-X / ZUGFeRD CII (0027). Its firm, account, BIC, page, styles,
 * head, table and bank details are the German euro invoice's, its billing
 * in `euro-invoice-countries.ts` and its words in `euro-invoice-words.ts`,
 * put together by `euro-invoice.ts`;
 * what it adds is the e-invoice block, and the totals the runtime computes
 * for the page and the XML at once, printed by name under the table: the
 * net amount, a row for each VAT category a line is in, the VAT, the
 * total and, where something was paid, the amount paid and the amount
 * due. Its EPC code asks for the amount due, to the e-invoice's account.
 *
 * It is a sample, not a starter, as the invoice's other languages are
 * (0024): neither builder edits an e-invoice, and the Studio's picker keeps
 * its starters. The renderer draws its final render as the PDF/A-3b that
 * embeds its XML (0031).
 *
 * **Its variants are its data**, so that each path an e-invoice may take
 * is one the e-invoice gate sees, and from the one template:
 * - **the sample**, lines at 19 % and at 7 %, a delivery date, a buyer with
 *   no VAT identifier, payment by SEPA credit transfer (58);
 * - **reverse charge**, heating installed for a builder (AE), with the
 *   reason, the buyer's VAT identifier (BR-AE-02) and an invoicing period
 *   in place of a delivery date, paid by credit transfer (30);
 * - **exempt and paid**, an exempt line (E) beside standard-rated lines, a
 *   paid amount, so the amount due is not the total, and a discount
 *   written as a line of a negative quantity at a positive price, since
 *   BR-27 refuses a negative price and the format has no allowances.
 *
 * One variant is not data alone: the payment means is a code of the
 * definition (BT-81), not a run, so the reverse-charge variant's report is
 * the sample's with `30` in its place and an id of its own, since another
 * definition under one id would be one report to a host that keys reports
 * by it (0024). The test holds the two to differ in those two values and
 * nothing else.
 *
 * What the law asks, as read on gesetze-im-internet.de on 17 October 2026
 * and no further: firewood ("Brennholz in Form von ... Scheiten, Zweigen")
 * is at 7 % (§ 12 Abs. 2 Nr. 1 UStG with Anlage 2 Nr. 48); heating
 * installed in a building is a "Bauleistung", whose tax a buyer that
 * itself "nachhaltig entsprechende Leistungen erbringt" owes (§ 13b Abs. 2
 * Nr. 4, Abs. 5 Satz 2), and the invoice says
 * "Steuerschuldnerschaft des Leistungsempfängers" (§ 14a Abs. 5); "die
 * Gewährung ... von Krediten" is exempt (§ 4 Nr. 8 Buchst. a), which the
 * sample takes an instalment agreement's interest, agreed apart, to be.
 * Whether that holds of a given agreement (the UStAE was not read), and
 * what § 14 Abs. 5 asks of an invoice after a payment on account, nobody
 * here checked, and the samples do not claim it.
 *
 * The parties are invented, the firm's and its account as
 * `euro-invoice-countries.ts` says. The buyer's VAT identifier, DE271828181, ends in a 1
 * where ISO 7064's MOD 11,10 gives the eight digits before it a 0, so that
 * no business has it; each creditor reference is ISO 11649's of the
 * invoice's number, its check digits computed as the IBAN's are.
 */

type Component = ReportDefinition['regions']['body'][number]
type Inline = Extract<Component, { kind: 'text' }>['content'][number]
type EInvoice = NonNullable<ReportDefinition['eInvoice']>

/** The German euro invoice's billing and words: its firm, account and BIC, and the words of its head, table and bank details. */
const [GERMANY, GERMAN] = [EURO_COUNTRIES.DE, EURO_WORDS.DE]
const { firm } = GERMANY

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const text = (value: string): Inline[] => [{ kind: 'text', text: value }]
const field = (name: string): Inline => ({ kind: 'field', field: header(name) })
/** A run that prints what `cel` gives, in euro. */
const euro = (cel: string): Inline => ({ kind: 'expression', expression: { cel }, format: EUR })

/** The exemption reasons (BT-120), printed under the table and written into the XML alike. */
export const EXEMPT_REASON = 'Steuerfrei nach § 4 Nr. 8 Buchst. a UStG'
export const REVERSE_CHARGE_REASON = 'Steuerschuldnerschaft des Leistungsempfängers'

/** The payment terms (BT-20), printed under the totals and written into the XML alike. */
const TERMS: readonly Inline[] = [
  { kind: 'text', text: 'Zahlbar ohne Abzug bis zum ' },
  { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'long' } },
  { kind: 'text', text: ' auf das unten genannte Konto, unter Angabe der Referenz.' },
]

/**
 * A row under the table: what it is, and an amount in the amount column's
 * width at the right; shown when `when` holds, as a category no line is in
 * prints no row.
 */
function totalRow(id: string, label: readonly Inline[], amount: string, options: { readonly when?: string; readonly grand?: boolean } = {}): Component {
  const { when, grand = false } = options
  return {
    id,
    kind: 'columns',
    ...(when === undefined ? {} : { visibleWhen: { cel: when } }),
    columns: [
      { width: 'fill', components: [{ id: `${id}-label`, kind: 'text', ...(grand ? { style: 'grand' } : {}), content: label }] },
      { width: 84, components: [{ id: `${id}-amount`, kind: 'text', style: grand ? 'grand-figure' : 'figure', content: [euro(amount)] }] },
    ],
  }
}

/** Every total the XML holds, each printed from the name the runtime binds it to: the net amount, each category's basis and tax, the VAT, the total, and what was paid and is due. */
const TOTALS: readonly Component[] = [
  totalRow('net', text('Nettobetrag'), 'invoice.taxBasisTotal'),
  totalRow('vat-standard', [{ kind: 'text', text: 'Umsatzsteuer 19 % auf ' }, euro('vatBasis.standard')], 'vatAmount.standard', { when: 'vatAmount.standard != null' }),
  totalRow('vat-reduced', [{ kind: 'text', text: 'Umsatzsteuer 7 % auf ' }, euro('vatBasis.reduced')], 'vatAmount.reduced', { when: 'vatAmount.reduced != null' }),
  totalRow('vat-exempt', [{ kind: 'text', text: `${EXEMPT_REASON}, Entgelt ` }, euro('vatBasis.exempt')], 'vatAmount.exempt', { when: 'vatAmount.exempt != null' }),
  totalRow('vat-reverse', [{ kind: 'text', text: `${REVERSE_CHARGE_REASON}, Entgelt ` }, euro('vatBasis.reverse')], 'vatAmount.reverse', { when: 'vatAmount.reverse != null' }),
  totalRow('vat-total', text('Umsatzsteuer gesamt'), 'invoice.taxTotal'),
  totalRow('grand', text('Rechnungsbetrag'), 'invoice.grandTotal', { grand: true }),
  totalRow('prepaid', text('Bereits gezahlt'), 'invoice.paid', { when: 'invoice.paid != null' }),
  totalRow('due', text('Zahlbetrag'), 'invoice.duePayable', { when: 'invoice.paid != null', grand: true }),
]

/**
 * A German firm's address (BG-5), its two lines as its invoices' head
 * prints them, a street and then a post code before its city, in the terms
 * EN 16931 writes: the first line (BT-35), the post code (BT-38) and the
 * city (BT-37). The e-invoice reads the one spelling the euro invoice
 * prints, so that the page and the XML cannot name two addresses; lines of
 * another shape are refused, never parted otherwise. Exported for its test.
 */
export function sellerAddress(address: readonly string[]): EInvoice['seller']['address'] {
  const [street, town, ...more] = address
  const parted = /^(\d{5}) (\S.*)$/u.exec(town ?? '')
  if (street === undefined || parted === null || more.length > 0) throw new Error(`the e-invoice cannot part the firm's address, ${JSON.stringify(address)}, into a street, a post code and a city`)
  const [, postcode = '', city = ''] = parted
  return { line1: text(street), postalCode: text(postcode), city: text(city), country: text('DE') }
}

/** How the firm is paid (BG-16): by SEPA credit transfer, to the account its EPC code pays. */
const PAYMENT: NonNullable<EInvoice['payment']> = { means: '58', iban: text(GERMANY.iban), bic: text(GERMANY.bic), accountName: text(firm.name), remittance: [field('reference')] }

/**
 * The e-invoice: the seller the firm, the buyer and the dates read from
 * the header, the four VAT categories a line may be in, and its lines the
 * table's rows, its name, quantity, price and amount the very columns that
 * print them. A line's identifier (BT-126) is its position, which each
 * line has to itself; the article number the table prints is the seller's
 * own (BT-155, which this version does not write), which two lines of one
 * article would share.
 */
const INVOICE: EInvoice = {
  kind: 'facturX',
  profile: 'en16931',
  type: '380',
  currency: 'EUR',
  number: [field('number')],
  issued: { cel: 'header.issuedOn' },
  seller: {
    name: text(firm.name),
    vatId: text(firm.vatNumber),
    address: sellerAddress(firm.address),
  },
  buyer: {
    name: [field('customer')],
    vatId: [field('customerVatId')],
    address: { line1: [field('street'), { kind: 'text', text: ' ' }, field('buildingNumber')], postalCode: [field('postcode')], city: [field('city')], country: text('DE') },
  },
  delivered: { cel: 'header.servedOn' },
  period: { start: { cel: 'header.periodStart' }, end: { cel: 'header.periodEnd' } },
  vat: [
    { id: 'standard', code: 'S', rate: '19' },
    { id: 'reduced', code: 'S', rate: '7' },
    { id: 'exempt', code: 'E', rate: '0', reason: text(EXEMPT_REASON) },
    { id: 'reverse', code: 'AE', rate: '0', reason: text(REVERSE_CHARGE_REASON) },
  ],
  lines: {
    table: 'positions',
    name: 'description',
    quantity: 'quantity',
    netPrice: 'unit-price',
    netAmount: 'amount',
    id: { kind: 'field', field: detail('position') },
    unit: { kind: 'field', field: detail('unitCode') },
    vat: { kind: 'field', field: detail('vat') },
  },
  payment: PAYMENT,
  due: { cel: 'header.dueOn' },
  terms: TERMS,
  paid: { cel: 'header.paid' },
}

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'e-invoice',
  title: 'Rechnung (ZUGFeRD)',
  locale: 'de-DE',
  page: EURO_PAGE,
  styles: [...EURO_STYLES, { id: 'figure', align: 'right' }, { id: 'grand-figure', size: 10.5, bold: true, align: 'right' }],
  datasets: {
    header: {
      id: 'invoice',
      fields: [
        { id: 'number', type: 'string', label: 'Rechnungsnummer', nullable: false },
        { id: 'issuedOn', type: 'date', label: 'Rechnungsdatum', nullable: false },
        { id: 'servedOn', type: 'date', label: 'Leistungsdatum', nullable: true },
        { id: 'periodStart', type: 'date', label: 'Leistungszeitraum von', nullable: true },
        { id: 'periodEnd', type: 'date', label: 'Leistungszeitraum bis', nullable: true },
        { id: 'dueOn', type: 'date', label: 'Zahlbar bis', nullable: false },
        { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
        { id: 'street', type: 'string', label: 'Straße', nullable: false },
        { id: 'buildingNumber', type: 'string', label: 'Hausnummer', nullable: false },
        { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
        { id: 'city', type: 'string', label: 'Ort', nullable: false },
        { id: 'customerVatId', type: 'string', label: 'USt-IdNr. des Kunden', nullable: true },
        { id: 'reference', type: 'string', label: 'Referenz', nullable: false },
        { id: 'paid', type: 'decimal', label: 'Bereits gezahlt', nullable: true, scale: 2 },
      ],
    },
    detail: {
      id: 'invoice-lines',
      fields: [
        { id: 'position', type: 'integer', label: 'Position', nullable: false },
        { id: 'article', type: 'string', label: 'Artikel', nullable: false },
        { id: 'description', type: 'string', label: 'Beschreibung', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false, scale: 2 },
        { id: 'unit', type: 'string', label: 'Einheit', nullable: false },
        { id: 'unitCode', type: 'string', label: 'Einheit (UN/ECE)', nullable: false },
        { id: 'unitPrice', type: 'decimal', label: 'Einzelpreis', nullable: false, scale: 2 },
        { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
        { id: 'vat', type: 'string', label: 'Umsatzsteuer', nullable: false },
      ],
    },
  },
  parameters: [],
  assets: [LOGO_ASSET],
  aggregates: [],
  regions: {
    pageHeader: [],
    reportHeader: [
      ...LETTERHEAD,
      sender(GERMANY, GERMAN),
      { id: 'sender-gap', kind: 'spacer', height: 12 },
      {
        id: 'addresses',
        kind: 'columns',
        columns: [
          {
            width: 'fill',
            components: [
              ...recipient(GERMANY),
              { id: 'customer-vat-id', kind: 'text', visibleWhen: { cel: 'header.customerVatId != null' }, content: [{ kind: 'text', text: 'USt-IdNr.: ' }, field('customerVatId')] },
            ],
          },
          {
            width: 190,
            components: [
              { id: 'title', kind: 'text', style: 'title', content: text('Rechnung') },
              { id: 'number', kind: 'text', content: [{ kind: 'text', text: 'Rechnungsnummer: ' }, field('number')] },
              { id: 'issued-on', kind: 'text', content: dated('Rechnungsdatum: ', 'issuedOn') },
              { id: 'served-on', kind: 'text', visibleWhen: { cel: 'header.servedOn != null' }, content: dated('Leistungsdatum: ', 'servedOn') },
              { id: 'period', kind: 'text', visibleWhen: { cel: 'header.periodStart != null' }, content: [...dated('Leistungszeitraum: ', 'periodStart'), ...dated(' bis ', 'periodEnd')] },
              { id: 'due-on', kind: 'text', content: dated('Zahlbar bis: ', 'dueOn') },
            ],
          },
        ],
      },
      { id: 'head-gap', kind: 'spacer', height: 18 },
    ],
    body: [positions(GERMAN, undefined)],
    summary: [
      { id: 'totals-gap', kind: 'spacer', height: 6 },
      ...TOTALS,
      { id: 'summary-gap', kind: 'spacer', height: 12 },
      { id: 'terms', kind: 'text', content: TERMS },
      { id: 'payment-gap', kind: 'spacer', height: 18 },
      payment(GERMANY, GERMAN, { cel: 'invoice.duePayable' }, euro('invoice.duePayable')),
    ],
    pageFooter: [],
  },
  eInvoice: INVOICE,
  provenance: { kind: 'blank' },
}

/** A unit as the table prints it, and as UN/ECE Recommendation 20 codes it (BT-130). */
const UNITS = { 'Pausch.': 'LS', h: 'HUR', Stk: 'H87', kg: 'KGM', m: 'MTR' } as const

/** Description, unit, quantity, unit price and VAT category of a line, each quantity and price exact to the cent; a discount's quantity is negative. */
type Item = readonly [string, keyof typeof UNITS, string, string, 'standard' | 'reduced' | 'exempt' | 'reverse']

/** Quantity times unit price to the cent, as the euro invoice's are; a negative quantity, a discount's, gives a negative amount. */
const netAmount = (quantity: string, unitPrice: string): string => (quantity.startsWith('-') ? `-${lineAmount(quantity.slice(1), unitPrice)}` : lineAmount(quantity, unitPrice))

/** `items` as the data gives them, each at its position, 1 up, and its article number, `first` up; in the reverse of the order the report prints them in. */
function lines(first: number, items: readonly Item[]): Record<string, string>[] {
  return items.map(([description, unit, quantity, unitPrice, vat], index) => ({ position: String(index + 1), article: `H-${first + index}`, description, quantity, unit, unitCode: UNITS[unit], unitPrice, amount: netAmount(quantity, unitPrice), vat })).reverse()
}

/** What every variant's header holds that it does not set: no delivery date, no period, no VAT identifier, nothing paid. */
const NONE = { servedOn: null, periodStart: null, periodEnd: null, customerVatId: null, paid: null } as const

function data(header: Record<string, string | null>, detail: Record<string, string>[]): ReportData {
  return { header: { ...NONE, ...header }, detail, completeness: { complete: true, captured: detail.length }, consistency: 'host-captured' }
}

/** The sample's data: a restaurant's boiler serviced and its firewood delivered, at 19 % and at 7 %, on a delivery date. */
export function eInvoiceData(): ReportData {
  return data(
    { number: 'RE-2026-0820', issuedOn: '2026-10-16', servedOn: '2026-10-12', dueOn: '2026-10-30', customer: 'Gasthaus Zur Linde GmbH', street: 'Venloer Straße', buildingNumber: '210', postcode: '50823', city: 'Köln', reference: 'RF34 2026 0820' },
    lines(3101, [
      ['Wartung Gas-Brennwertkessel', 'Pausch.', '1.00', '245.00', 'standard'],
      ['Arbeitszeit Techniker', 'h', '3.50', '76.00', 'standard'],
      ['Abgasmessung', 'Pausch.', '1.00', '48.00', 'standard'],
      ['Dichtungssatz Brenner', 'Stk', '2.00', '18.90', 'standard'],
      ['Kaminholz Buche, ofenfertig', 'kg', '250.00', '0.38', 'reduced'],
      ['Anzündholz Fichte', 'kg', '12.50', '1.00', 'reduced'],
      ['Anfahrt Köln', 'Pausch.', '1.00', '39.00', 'standard'],
    ]),
  )
}

/** Variant (b): a boiler, radiators and pipes installed in a builder's new building over September, the builder owing the tax. */
export function reverseChargeData(): ReportData {
  return data(
    { number: 'RE-2026-0821', issuedOn: '2026-10-05', periodStart: '2026-09-01', periodEnd: '2026-09-30', dueOn: '2026-11-04', customer: 'Domblick Bau GmbH', street: 'Butzweilerstraße', buildingNumber: '35', postcode: '50829', city: 'Köln', customerVatId: 'DE271828181', reference: 'RF07 2026 0821' },
    lines(3201, [
      ['Gas-Brennwertkessel 24 kW, geliefert und montiert', 'Stk', '1.00', '3450.00', 'reverse'],
      ['Heizkörper Typ 22, montiert', 'Stk', '14.00', '212.50', 'reverse'],
      ['Rohrleitung Kupfer 18 mm, verlegt', 'm', '86.50', '24.80', 'reverse'],
      ['Arbeitszeit Monteur', 'h', '38.25', '68.00', 'reverse'],
    ]),
  )
}

/** Variant (c): three boilers serviced for a property manager, less its framework discount, the instalment agreement's interest exempt, and a payment on account made. */
export function exemptPaidData(): ReportData {
  return data(
    { number: 'RE-2026-0822', issuedOn: '2026-10-14', servedOn: '2026-10-09', dueOn: '2026-10-28', customer: 'Hausverwaltung Severin GmbH', street: 'Severinstraße', buildingNumber: '120', postcode: '50678', city: 'Köln', reference: 'RF77 2026 0822', paid: '300.00' },
    lines(3301, [
      ['Wartung Gastherme, Haus 1', 'Pausch.', '1.00', '189.00', 'standard'],
      ['Wartung Gastherme, Haus 2', 'Pausch.', '1.00', '189.00', 'standard'],
      ['Wartung Gastherme, Haus 3', 'Pausch.', '1.00', '189.00', 'standard'],
      ['Umwälzpumpe getauscht', 'Stk', '1.00', '312.00', 'standard'],
      ['Nachlass Rahmenvertrag, 10 % der Wartung', 'Pausch.', '-1.00', '56.70', 'standard'],
      ['Zinsen Ratenzahlung, gesondert vereinbart', 'Pausch.', '1.00', '14.35', 'exempt'],
    ]),
  )
}

/** The sample's report paid by credit transfer (30), under an id of its own. */
const REVERSE_CHARGE_REPORT: ReportDefinition = { ...REPORT, id: 'e-invoice-reverse-charge', eInvoice: { ...INVOICE, payment: { ...PAYMENT, means: '30' } } }

export const E_INVOICE: Starter = {
  id: 'e-invoice',
  title: 'Rechnung (ZUGFeRD)',
  proves: 'an EN 16931 e-invoice: its totals and VAT breakdown computed once for the page and the XML, at 19 % and 7 %, with a delivery date, paid by SEPA credit transfer and an EPC code for the amount due',
  report: REPORT,
  data: eInvoiceData(),
  parameters: {},
}

export const E_INVOICE_REVERSE_CHARGE: Starter = {
  id: 'e-invoice-reverse-charge',
  title: 'Rechnung (ZUGFeRD)',
  proves: 'reverse charge (AE) with its reason and the buyer’s VAT identifier, an invoicing period in place of a delivery date, and payment by credit transfer (30)',
  report: REVERSE_CHARGE_REPORT,
  data: reverseChargeData(),
  parameters: {},
}

export const E_INVOICE_EXEMPT_PAID: Starter = {
  id: 'e-invoice-exempt-paid',
  title: 'Rechnung (ZUGFeRD)',
  proves: 'an exempt line (E) with its reason beside standard-rated lines, a discount as a negative quantity at a positive price, and a paid amount, so the amount due is not the total',
  report: REPORT,
  data: exemptPaidData(),
  parameters: {},
}

/** The e-invoice and its two variants: samples, which the Studio's picker does not offer. */
export const E_INVOICE_SAMPLES: readonly Starter[] = [E_INVOICE, E_INVOICE_REVERSE_CHARGE, E_INVOICE_EXEMPT_PAID]
