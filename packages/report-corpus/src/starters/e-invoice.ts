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
 * The sample is a starter too, so that a person opens an e-invoice in the
 * Studio and edits it in either builder (0044); its variants are samples
 * alone, as the invoice's other languages are (0024). The renderer draws
 * its final render as the PDF/A-3b that embeds its XML (0031).
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
 *   BR-27 refuses a negative price and the format has no allowances;
 * - **addressed**, every term past 0027's (0037): the business process
 *   (BT-23), the firm's electronic address (BT-34) by email and the
 *   buyer's (BT-49) by its GLN, read from the data, and the firm's contact
 *   (BG-6). A German B2B invoice needs none of them; XRechnung needs them
 *   all, and the gate judges them here first.
 *
 * Two variants are not data alone: the payment means is a code of the
 * definition (BT-81), not a run, so the reverse-charge variant's report is
 * the sample's with `30` in its place and an id of its own, since another
 * definition under one id would be one report to a host that keys reports
 * by it (0024); and the addressed variant's report is the sample's with
 * the terms past 0027's, the header field its buyer's address is read
 * from, and an id of its own. The test holds each to differ from the
 * sample in those and nothing else.
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
 * invoice's number, its check digits computed as the IBAN's are. The
 * addressed variant's identifiers are the standard-setters' own examples,
 * read on 20 October 2026: the firm's telephone number one of the
 * Bundesnetzagentur's "Drama Numbers" for Köln, 0221 4710 000 to 999,
 * which "können genehmigungsfrei in Medien gezeigt, abgedruckt und
 * gesprochen verwendet werden"; its email addresses under `.example`, a
 * name RFC 2606 reserves so that it reaches nobody; the buyer's GLN GS1
 * Germany's worked example, 4012345 00000 9 ("Automatische
 * Identifizierungstechnik AIT in der Bundeswehr"); its contact the name
 * the German identity card's specimen bears; and its business process
 * Peppol BIS Billing 3.0's.
 */

type Component = ReportDefinition['regions']['body'][number]
type Inline = Extract<Component, { kind: 'text' }>['content'][number]
type EInvoice = Extract<NonNullable<ReportDefinition['eInvoice']>, { kind: 'facturX' }>

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

/** How the firm is paid (BG-16): by SEPA credit transfer, to the account its EPC code pays. The XRechnung sample's too. */
export const PAYMENT: NonNullable<EInvoice['payment']> = { means: '58', iban: text(GERMANY.iban), bic: text(GERMANY.bic), accountName: text(firm.name), remittance: [field('reference')] }

/**
 * The e-invoice: the seller the firm, the buyer and the dates read from
 * the header, the four VAT categories a line may be in, and its lines the
 * table's rows, its name, quantity, price and amount the very columns that
 * print them. A line's identifier (BT-126) is its position, which each
 * line has to itself; the article number the table prints is the seller's
 * own (BT-155, which this version does not write), which two lines of one
 * article would share.
 */
export const INVOICE: EInvoice = {
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

type Dataset = NonNullable<ReportDefinition['datasets']['header']>

/** The invoice's header: its number and dates, the buyer, and what was paid. */
const HEADER: Dataset = {
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
}

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'e-invoice',
  title: 'Rechnung (ZUGFeRD)',
  locale: 'de-DE',
  page: EURO_PAGE,
  styles: [...EURO_STYLES, { id: 'figure', align: 'right' }, { id: 'grand-figure', size: 10.5, bold: true, align: 'right' }],
  datasets: {
    header: HEADER,
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
export type Item = readonly [string, keyof typeof UNITS, string, string, 'standard' | 'reduced' | 'exempt' | 'reverse']

/** Quantity times unit price to the cent, as the euro invoice's are; a negative quantity, a discount's, gives a negative amount. */
const netAmount = (quantity: string, unitPrice: string): string => (quantity.startsWith('-') ? `-${lineAmount(quantity.slice(1), unitPrice)}` : lineAmount(quantity, unitPrice))

/** `items` as the data gives them, each at its position, 1 up, and its article number, `first` up; in the reverse of the order the report prints them in. The XRechnung sample's are read so too (`xrechnung.ts`). */
export function lines(first: number, items: readonly Item[]): Record<string, string>[] {
  return items.map(([description, unit, quantity, unitPrice, vat], index) => ({ position: String(index + 1), article: `H-${first + index}`, description, quantity, unit, unitCode: UNITS[unit], unitPrice, amount: netAmount(quantity, unitPrice), vat })).reverse()
}

/** What every variant's header holds that it does not set: no delivery date, no period, no VAT identifier, nothing paid. */
const NONE = { servedOn: null, periodStart: null, periodEnd: null, customerVatId: null, paid: null } as const

/** A sample's data, complete and captured by the host: `header`, every field it does not set none, and `detail`. */
export function data(header: Record<string, string | null>, detail: Record<string, string>[]): ReportData {
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

/** Variant (d): the restaurant's boiler serviced again and its firewood delivered, to its invoicing address, the buyer's GLN. */
export function addressedData(): ReportData {
  return data(
    { number: 'RE-2026-0823', issuedOn: '2026-10-19', servedOn: '2026-10-15', dueOn: '2026-11-02', customer: 'Gasthaus Zur Linde GmbH', street: 'Venloer Straße', buildingNumber: '210', postcode: '50823', city: 'Köln', customerGln: '4012345000009', reference: 'RF50 2026 0823' },
    lines(3401, [
      ['Wartung Gas-Brennwertkessel', 'Pausch.', '1.00', '245.00', 'standard'],
      ['Arbeitszeit Techniker', 'h', '1.50', '76.00', 'standard'],
      ['Kaminholz Buche, ofenfertig', 'kg', '200.00', '0.38', 'reduced'],
      ['Anfahrt Köln', 'Pausch.', '1.00', '39.00', 'standard'],
    ]),
  )
}

/** The sample's report paid by credit transfer (30), under an id of its own. */
const REVERSE_CHARGE_REPORT: ReportDefinition = { ...REPORT, id: 'e-invoice-reverse-charge', eInvoice: { ...INVOICE, payment: { ...PAYMENT, means: '30' } } }

/** The firm's contact (BG-6): its accountant, at one of the Bundesnetzagentur's numbers for Köln, at an address under `.example`. */
export const CONTACT: NonNullable<EInvoice['seller']['contact']> = { name: text('Erika Mustermann'), telephone: text('+49 221 4710 820'), email: text('e.mustermann@formancy-haustechnik.example') }

/** Peppol BIS Billing 3.0's business process (BT-23), the addressed sample's and the XRechnung sample's. */
export const BUSINESS_PROCESS: readonly Inline[] = text('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')

/** The firm's invoice inbox (BT-34), by email (EM), the addressed sample's and the XRechnung sample's. */
export const FIRM_INBOX: NonNullable<EInvoice['seller']['electronicAddress']> = { id: text('rechnung@formancy-haustechnik.example'), scheme: 'EM' }

/**
 * The sample's report with every term past 0027's (0037), under an id of
 * its own: Peppol BIS Billing 3.0's business process, the firm's invoice
 * inbox by email (EM), its contact, and the buyer's GLN (0088), read from
 * a header field the other variants do not have.
 */
const ADDRESSED_REPORT: ReportDefinition = {
  ...REPORT,
  id: 'e-invoice-addressed',
  datasets: { ...REPORT.datasets, header: { ...HEADER, fields: [...HEADER.fields, { id: 'customerGln', type: 'string', label: 'GLN des Kunden', nullable: false }] } },
  eInvoice: {
    ...INVOICE,
    businessProcess: BUSINESS_PROCESS,
    seller: { ...INVOICE.seller, electronicAddress: FIRM_INBOX, contact: CONTACT },
    buyer: { ...INVOICE.buyer, electronicAddress: { id: [field('customerGln')], scheme: '0088' } },
  },
}

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

export const E_INVOICE_ADDRESSED: Starter = {
  id: 'e-invoice-addressed',
  title: 'Rechnung (ZUGFeRD)',
  proves: 'every term past 0027’s, none of which a German B2B invoice needs: the business process, the seller’s electronic address by email and the buyer’s by its GLN, and the seller’s contact',
  report: ADDRESSED_REPORT,
  data: addressedData(),
  parameters: {},
}

/** The e-invoice and its three variants: samples, of which the Studio's picker offers the e-invoice alone, a starter (0044). */
export const E_INVOICE_SAMPLES: readonly Starter[] = [E_INVOICE, E_INVOICE_REVERSE_CHARGE, E_INVOICE_EXEMPT_PAID, E_INVOICE_ADDRESSED]
