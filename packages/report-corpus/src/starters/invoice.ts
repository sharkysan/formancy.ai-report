import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { lineAmount } from './quotation.js'
import type { Starter } from './starter.js'

/**
 * The invoice with a QR payment part, "Rechnung mit QR-Zahlteil": who
 * invoices whom, line items, the totals under them, and a Swiss QR-bill
 * across the foot of the last page that pays the invoice's total, in Swiss
 * francs for a Swiss German reader. It proves a payment part: the receipt
 * and the payment part printed where SIX puts them, its amount the report's
 * own exact total, its QR reference, its debtor and its message read from
 * the data.
 *
 * The totals are the quotation's without its cash rounding, since a bill
 * is paid to the centime:
 * - the subtotal is the exact sum of the amounts;
 * - the VAT line is an expression over it, rounded to the centime;
 * - the total is declared as a sum of each amount times 1.081, rounded once
 *   to the centime: the subtotal times 1.081 exactly, rounded, which is the
 *   subtotal plus the printed VAT, as the subtotal is a whole number of
 *   centimes. The bill's amount is that total, the one aggregate, so what
 *   the table prints and what the code asks for cannot differ.
 *
 * The rate is the template's, as the quotation's is. The account and the
 * reference are SIX's own example QR-IBAN and QR reference (IG 2.4, Annex
 * A), which no bank books; the creditor and the customer are invented.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const
const text = (value: string) => [{ kind: 'text', text: value }] as const

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'invoice',
  title: 'Rechnung mit QR-Zahlteil',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'address', size: 10 },
    { id: 'grand', size: 10.5, bold: true },
    { id: 'sender', size: 8, color: '#555555' },
  ],
  datasets: {
    header: {
      id: 'invoice',
      fields: [
        { id: 'number', type: 'string', label: 'Nummer', nullable: false },
        { id: 'issuedOn', type: 'date', label: 'Datum', nullable: false },
        { id: 'dueOn', type: 'date', label: 'Zahlbar bis', nullable: false },
        { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
        { id: 'street', type: 'string', label: 'Strasse', nullable: false },
        { id: 'buildingNumber', type: 'string', label: 'Hausnummer', nullable: false },
        { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
        { id: 'city', type: 'string', label: 'Ort', nullable: false },
        { id: 'reference', type: 'string', label: 'QR-Referenz', nullable: false },
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
    { id: 'total', fn: 'sum', of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } }, rounding: { scale: 2, mode: 'half-away-from-zero' } },
  ],
  regions: {
    pageHeader: [],
    reportHeader: [
      { id: 'sender', kind: 'text', style: 'sender', content: text('Formancy Haustechnik AG · Industriestrasse 7 · 3052 Zollikofen · CHE-123.456.789 MWST') },
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
              { id: 'number', kind: 'text', content: [{ kind: 'text', text: 'Nummer: ' }, { kind: 'field', field: header('number') }] },
              { id: 'issued-on', kind: 'text', content: [{ kind: 'text', text: 'Datum: ' }, { kind: 'field', field: header('issuedOn'), format: { kind: 'date', style: 'medium' } }] },
              { id: 'due-on', kind: 'text', content: [{ kind: 'text', text: 'Zahlbar bis: ' }, { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'medium' } }] },
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
          { id: 'article', header: 'Artikel', width: 82, align: 'left', value: { kind: 'field', field: detail('article') } },
          { id: 'description', header: 'Beschreibung', width: 'fill', align: 'left', value: { kind: 'field', field: detail('description') } },
          { id: 'quantity', header: 'Menge', width: 50, align: 'right', value: { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 2, grouping: true } } },
          { id: 'unit', header: 'Einheit', width: 58, align: 'left', value: { kind: 'field', field: detail('unit') } },
          { id: 'unit-price', header: 'Preis', width: 82, align: 'right', value: { kind: 'field', field: detail('unitPrice'), format: CHF } },
          { id: 'amount', header: 'Betrag', width: 92, align: 'right', value: { kind: 'field', field: detail('amount'), format: CHF } },
        ],
        sort: [{ field: detail('article'), direction: 'asc' }],
        totals: [
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Zwischensumme' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'report', format: CHF } },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'MWST 8.1 %' } },
              { column: 'amount', value: { kind: 'expression', expression: { cel: 'round(totals.subtotal * dec("0.081"), 2)' }, format: CHF } },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Total' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: CHF } },
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
      { id: 'terms', kind: 'text', content: [{ kind: 'text', text: 'Bitte bezahlen Sie bis ' }, { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'long' } }, { kind: 'text', text: ' mit dem QR-Zahlteil unten.' }] },
    ],
    pageFooter: [],
  },
  paymentPart: {
    kind: 'swissQrBill',
    language: 'de',
    account: text('CH44 3199 9123 0008 8901 2'),
    creditor: {
      name: text('Formancy Haustechnik AG'),
      street: text('Industriestrasse'),
      buildingNumber: text('7'),
      postalCode: text('3052'),
      town: text('Zollikofen'),
      country: text('CH'),
    },
    currency: 'CHF',
    amount: { cel: 'totals.total' },
    debtor: {
      name: [{ kind: 'field', field: header('customer') }],
      street: [{ kind: 'field', field: header('street') }],
      buildingNumber: [{ kind: 'field', field: header('buildingNumber') }],
      postalCode: [{ kind: 'field', field: header('postcode') }],
      town: [{ kind: 'field', field: header('city') }],
      country: text('CH'),
    },
    reference: [{ kind: 'field', field: header('reference') }],
    message: [{ kind: 'text', text: 'Rechnung ' }, { kind: 'field', field: header('number') }],
  },
  provenance: { kind: 'blank' },
}

/** Description, unit, quantity and unit price, each quantity and price exact to the centime. */
const ITEMS: readonly (readonly [string, string, string, string])[] = [
  ['Wartung Lüftungsanlage, Grundpauschale', 'Pausch.', '1.00', '480.00'],
  ['Ersatzfilter F7 für Monoblock', 'Stk', '6.00', '38.50'],
  ['Arbeitszeit Servicetechniker', 'h', '3.75', '128.00'],
  ['Dichtungsband EPDM', 'm', '12.50', '4.35'],
  ['Fahrzeugpauschale Region Bern', 'Pausch.', '1.00', '65.00'],
]

/** The invoice's line items, `R-2001` up, given in the reverse of the order the report prints them in. */
export function invoiceLines(): Record<string, string>[] {
  return ITEMS.map(([description, unit, quantity, unitPrice], index) => ({ article: `R-${2001 + index}`, description, quantity, unit, unitPrice, amount: lineAmount(quantity, unitPrice) })).reverse()
}

/** The invoice: its header, with SIX's example QR reference, and its line items. */
export function invoiceData(): ReportData {
  const detail = invoiceLines()
  return {
    header: {
      number: 'R-2026-0731',
      issuedOn: '2026-10-15',
      dueOn: '2026-11-14',
      customer: 'Bäckerei Müller AG',
      street: 'Hauptstrasse',
      buildingNumber: '12',
      postcode: '3011',
      city: 'Bern',
      reference: '210000000003139471430009017',
    },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

export const INVOICE: Starter = {
  id: 'invoice',
  title: 'Rechnung mit QR-Zahlteil',
  proves: 'a Swiss QR-bill: the receipt and the payment part at the foot of the last page, paying the invoice’s exact total by a QR reference read from the data',
  report: REPORT,
  data: invoiceData(),
  parameters: {},
}
