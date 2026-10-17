import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { lineAmount } from './quotation.js'
import type { Starter } from './starter.js'

/**
 * The invoice paid by an EPC QR code, "Rechnung mit SEPA-Zahlcode": a
 * German heating firm's invoice to a private customer, in euro, for a
 * German reader. It proves an EPC QR code: a SEPA credit transfer of the
 * invoice's own exact total, at the left of the payment details that end
 * its last page and which it holds -- the beneficiary, the IBAN, the BIC,
 * the amount -- each printed beside it in plain text, as EPC069-12 means
 * the code to be printed, so that the payer can compare what the app read.
 * Its square is 32 mm, in which every payload the EPC allows prints, with
 * Austria's frame or without, as a new code's in the builders is.
 *
 * It holds what UStG section 14 (4) asks of an invoice: the supplier's
 * and the customer's full names and addresses; the supplier's VAT number;
 * the date of issue; an invoice number; the quantity and kind of each
 * item; the date of the service; the net amount, the rate and the tax; and
 * the note on the customer's duty to keep it, since maintenance of a
 * private customer's heating is a service in connection with a property
 * (section 14 (2) sentence 2 number 3, section 14b (1) sentence 5: two
 * years). It is no e-invoice, and need not be: section 14 (2) sentence 2
 * number 1 asks for one only between businesses. What a GmbH's business
 * letters must also say (GmbHG section 35a) nobody here checked, and the
 * starter does not claim it.
 *
 * The totals are the QR-bill invoice's, at 19 %: the net amount is the
 * exact sum of the line amounts; the tax line is an expression over it,
 * rounded to the cent; the total is declared as a sum of each amount times
 * 1.19, rounded once to the cent, which is the net amount plus the printed
 * tax, as the net amount is a whole number of cents. The code's amount is
 * that total, the one aggregate, and the payment details print it too, so
 * what the table says, what the details say and what the code asks for
 * cannot differ.
 *
 * Every party and number is invented, and none is anybody's:
 * - the account is a German IBAN of bank code 01234567, where every bank
 *   code in the Bundesbank's Bankleitzahlendatei valid from 7 September to
 *   6 December 2026 starts with a digit from 1 to 8 (13,760 records, read
 *   on 17 October 2026); its check digits, 83, are ISO 13616's, computed
 *   in BigInt from the account and the country and checked by report-spec;
 * - the BIC is a test BIC: a 0 as its location's second character marks
 *   one that the live network does not route to (ISO 9362, as Wikipedia's
 *   article on it gives it; SWIFT's text was not read), and no bank in the
 *   Bundesbank's file has its four letters;
 * - the reference is an ISO 11649 creditor reference of the invoice's
 *   number, its check digits computed as the IBAN's are;
 * - the VAT number is the format's well-known sample, DE123456789, whose
 *   last digit is not the check digit ISO 7064's MOD 11,10 gives the eight
 *   before it, so that no business has it;
 * - the customer is the name and address the German identity card's
 *   specimen bears.
 */

/** The firm the invoice is from and the code pays: one spelling of each, for the code and for what is printed beside it. */
const COMPANY = 'Formancy Haustechnik GmbH'
const IBAN = 'DE83 0123 4567 0012 3456 78'
const BIC = 'FMNCDEF0XXX'

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const EUR = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } as const
const text = (value: string) => [{ kind: 'text', text: value }] as const
const dated = (label: string, field: string) => [{ kind: 'text', text: label }, { kind: 'field', field: header(field), format: { kind: 'date', style: 'medium' } }] as const

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'euro-invoice',
  title: 'Rechnung mit SEPA-Zahlcode',
  locale: 'de-DE',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'address', size: 10 },
    { id: 'grand', size: 10.5, bold: true },
    { id: 'sender', size: 8, color: '#555555' },
    { id: 'heading', size: 10, bold: true },
  ],
  datasets: {
    header: {
      id: 'invoice',
      fields: [
        { id: 'number', type: 'string', label: 'Rechnungsnummer', nullable: false },
        { id: 'issuedOn', type: 'date', label: 'Rechnungsdatum', nullable: false },
        { id: 'servedOn', type: 'date', label: 'Leistungsdatum', nullable: false },
        { id: 'dueOn', type: 'date', label: 'Zahlbar bis', nullable: false },
        { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
        { id: 'street', type: 'string', label: 'Straße', nullable: false },
        { id: 'buildingNumber', type: 'string', label: 'Hausnummer', nullable: false },
        { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
        { id: 'city', type: 'string', label: 'Ort', nullable: false },
        { id: 'reference', type: 'string', label: 'Referenz', nullable: false },
      ],
    },
    detail: {
      id: 'invoice-lines',
      fields: [
        { id: 'article', type: 'string', label: 'Artikel', nullable: false },
        { id: 'description', type: 'string', label: 'Beschreibung', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false, scale: 2 },
        { id: 'unit', type: 'string', label: 'Einheit', nullable: false },
        { id: 'unitPrice', type: 'decimal', label: 'Einzelpreis', nullable: false, scale: 2 },
        { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [
    { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
    { id: 'total', fn: 'sum', of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.19")' } }, rounding: { scale: 2, mode: 'half-away-from-zero' } },
  ],
  regions: {
    pageHeader: [],
    reportHeader: [
      { id: 'sender', kind: 'text', style: 'sender', content: text(`${COMPANY} · Industriestraße 7 · 50735 Köln · USt-IdNr. DE123456789`) },
      { id: 'sender-gap', kind: 'spacer', height: 12 },
      {
        id: 'addresses',
        kind: 'columns',
        columns: [
          {
            width: 'fill',
            components: [
              { id: 'customer', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('customer') }] },
              { id: 'street', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('street') }, { kind: 'text', text: ' ' }, { kind: 'field', field: header('buildingNumber') }] },
              { id: 'city', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('postcode') }, { kind: 'text', text: ' ' }, { kind: 'field', field: header('city') }] },
            ],
          },
          {
            width: 190,
            components: [
              { id: 'title', kind: 'text', style: 'title', content: text('Rechnung') },
              { id: 'number', kind: 'text', content: [{ kind: 'text', text: 'Rechnungsnummer: ' }, { kind: 'field', field: header('number') }] },
              { id: 'issued-on', kind: 'text', content: dated('Rechnungsdatum: ', 'issuedOn') },
              { id: 'served-on', kind: 'text', content: dated('Leistungsdatum: ', 'servedOn') },
              { id: 'due-on', kind: 'text', content: dated('Zahlbar bis: ', 'dueOn') },
            ],
          },
        ],
      },
      { id: 'head-gap', kind: 'spacer', height: 18 },
    ],
    body: [
      {
        id: 'positions',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'article', header: 'Artikel', width: 96, align: 'left', value: { kind: 'field', field: detail('article') } },
          { id: 'description', header: 'Beschreibung', width: 'fill', align: 'left', value: { kind: 'field', field: detail('description') } },
          { id: 'quantity', header: 'Menge', width: 50, align: 'right', value: { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 2, grouping: true } } },
          { id: 'unit', header: 'Einheit', width: 52, align: 'left', value: { kind: 'field', field: detail('unit') } },
          { id: 'unit-price', header: 'Einzelpreis', width: 76, align: 'right', value: { kind: 'field', field: detail('unitPrice'), format: EUR } },
          { id: 'amount', header: 'Betrag', width: 84, align: 'right', value: { kind: 'field', field: detail('amount'), format: EUR } },
        ],
        sort: [{ field: detail('article'), direction: 'asc' }],
        totals: [
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Nettobetrag' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'report', format: EUR } },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Umsatzsteuer 19 %' } },
              { column: 'amount', value: { kind: 'expression', expression: { cel: 'round(totals.subtotal * dec("0.19"), 2)' }, format: EUR } },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Rechnungsbetrag' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: EUR } },
            ],
            style: 'grand',
          },
        ],
        emptyText: 'Keine Positionen.',
        repeatHeader: true,
      },
    ],
    summary: [
      { id: 'summary-gap', kind: 'spacer', height: 12 },
      {
        id: 'terms',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Bitte überweisen Sie den Rechnungsbetrag bis zum ' },
          { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'long' } },
          { kind: 'text', text: ' auf das unten genannte Konto und geben Sie dabei die Referenz an.' },
        ],
      },
      { id: 'terms-gap', kind: 'spacer', height: 6 },
      { id: 'retention', kind: 'text', content: text('Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre lang aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).') },
      { id: 'payment-gap', kind: 'spacer', height: 18 },
      // The heading first and the code at the left of its details: in the
      // design view a container's label sits at its top end and a
      // component's at its top start, so a code at the top of a column at
      // the right end would have its label over the columns' and the
      // block's, which neither a reader nor axe could tell apart.
      {
        id: 'payment',
        kind: 'keepTogether',
        components: [
          { id: 'bank-heading', kind: 'text', style: 'heading', content: text('Bankverbindung') },
          {
            id: 'payment-details',
            kind: 'columns',
            columns: [
              {
                width: 90.71,
                components: [
                  {
                    id: 'payment-code',
                    kind: 'epcQrCode',
                    size: 90.71,
                    beneficiary: text(COMPANY),
                    iban: text(IBAN),
                    bic: text(BIC),
                    amount: { cel: 'totals.total' },
                    reference: [{ kind: 'field', field: header('reference') }],
                    information: [{ kind: 'text', text: 'Rechnung ' }, { kind: 'field', field: header('number') }],
                  },
                ],
              },
              { width: 12, components: [] },
              {
                width: 'fill',
                components: [
                  { id: 'paid-to', kind: 'text', content: text(`Empfänger: ${COMPANY}`) },
                  { id: 'paid-iban', kind: 'text', content: text(`IBAN: ${IBAN}`) },
                  { id: 'paid-bic', kind: 'text', content: text(`BIC: ${BIC}`) },
                  { id: 'paid-amount', kind: 'text', content: [{ kind: 'text', text: 'Betrag: ' }, { kind: 'aggregate', aggregate: 'total', over: 'report', format: EUR }] },
                  { id: 'paid-reference', kind: 'text', content: [{ kind: 'text', text: 'Referenz: ' }, { kind: 'field', field: header('reference') }] },
                  { id: 'scan-gap', kind: 'spacer', height: 6 },
                  { id: 'scan', kind: 'text', style: 'sender', content: text('Oder scannen Sie den Code links mit Ihrer Banking-App.') },
                ],
              },
            ],
          },
        ],
      },
    ],
    pageFooter: [],
  },
  provenance: { kind: 'blank' },
}

/** Description, unit, quantity and unit price, each quantity and price exact to the cent. */
const ITEMS: readonly (readonly [string, string, string, string])[] = [
  ['Wartung Gastherme', 'Pausch.', '1.00', '189.00'],
  ['Arbeitszeit Techniker', 'h', '2.75', '76.00'],
  ['Umwälzpumpe getauscht', 'Stk', '1.00', '312.00'],
  ['Ausdehnungsgefäß 25 l', 'Stk', '1.00', '148.00'],
  ['Zündelektrode mit Dichtung', 'Stk', '1.00', '31.50'],
  ['Heizungswasser nachgefüllt', 'l', '12.50', '1.85'],
  ['Anfahrt Köln', 'Pausch.', '1.00', '39.00'],
]

/** The invoice's line items, `H-3001` up, given in the reverse of the order the report prints them in. */
export function euroInvoiceLines(): Record<string, string>[] {
  return ITEMS.map(([description, unit, quantity, unitPrice], index) => ({ article: `H-${3001 + index}`, description, quantity, unit, unitPrice, amount: lineAmount(quantity, unitPrice) })).reverse()
}

/** The invoice: its header, with a creditor reference of its number, and its line items. */
export function euroInvoiceData(): ReportData {
  const detail = euroInvoiceLines()
  return {
    header: {
      number: 'RE-2026-0815',
      issuedOn: '2026-10-15',
      servedOn: '2026-10-08',
      dueOn: '2026-10-29',
      customer: 'Erika Mustermann',
      street: 'Heidestraße',
      buildingNumber: '17',
      postcode: '51147',
      city: 'Köln',
      reference: 'RF72 2026 0815',
    },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

export const EURO_INVOICE: Starter = {
  id: 'euro-invoice',
  title: 'Rechnung mit SEPA-Zahlcode',
  proves: 'an EPC QR code: a SEPA credit transfer of the invoice’s exact total in euro, by a creditor reference read from the data, beside the payment details it holds, printed in plain text',
  report: REPORT,
  data: euroInvoiceData(),
  parameters: {},
}
