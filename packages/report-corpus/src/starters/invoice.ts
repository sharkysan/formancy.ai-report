import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { ENGLISH, FRENCH, GERMAN, ITALIAN } from './invoice-words.js'
import type { Edition, Party } from './invoice-words.js'
import { LETTERHEAD, LOGO_ASSET } from './logo.js'
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
 *
 * The same report is made in French, Italian and English too, as samples
 * (`INVOICE_SAMPLES`): `invoice-words.ts` holds each language's words and
 * parties, and this file the one report they are put into, so that the
 * four differ in nothing but what they say and whom they bill. The German
 * is the starter.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const
const text = (value: string) => [{ kind: 'text', text: value }] as const

/** The line at the head of the invoice: the firm, its address, and its UID as the VAT number it is. */
const sender = (firm: Party, vatNumber: string): string =>
  `${firm.name} · ${firm.street} ${firm.buildingNumber} · ${firm.postalCode} ${firm.town} · CHE-123.456.789 ${vatNumber}`

/** The invoice's report in the edition's words, its slip in the edition's language. */
function report(edition: Edition): ReportDefinition {
  const { labels, columns, creditor } = edition
  return {
    reportSpecVersion: '0',
    id: edition.id,
    title: edition.title,
    locale: edition.locale,
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
          { id: 'number', type: 'string', label: labels.number, nullable: false },
          { id: 'issuedOn', type: 'date', label: labels.issuedOn, nullable: false },
          { id: 'dueOn', type: 'date', label: labels.dueOn, nullable: false },
          { id: 'customer', type: 'string', label: labels.customer, nullable: false },
          { id: 'street', type: 'string', label: labels.street, nullable: false },
          { id: 'buildingNumber', type: 'string', label: labels.buildingNumber, nullable: false },
          { id: 'postcode', type: 'string', label: labels.postcode, nullable: false },
          { id: 'city', type: 'string', label: labels.city, nullable: false },
          { id: 'reference', type: 'string', label: labels.reference, nullable: false },
        ],
      },
      detail: {
        id: 'invoice-lines',
        fields: [
          { id: 'article', type: 'string', label: labels.article, nullable: false },
          { id: 'description', type: 'string', label: labels.description, nullable: false },
          { id: 'quantity', type: 'decimal', label: labels.quantity, nullable: false, scale: 2 },
          { id: 'unit', type: 'string', label: labels.unit, nullable: false },
          { id: 'unitPrice', type: 'decimal', label: labels.unitPrice, nullable: false, scale: 2 },
          { id: 'amount', type: 'decimal', label: labels.amount, nullable: false, scale: 2 },
        ],
      },
    },
    parameters: [],
    assets: [LOGO_ASSET],
    aggregates: [
      { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
      {
        id: 'total',
        fn: 'sum',
        of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } },
        rounding: { scale: 2, mode: 'half-away-from-zero' },
      },
    ],
    regions: {
      pageHeader: [],
      reportHeader: [
        ...LETTERHEAD,
        { id: 'sender', kind: 'text', style: 'sender', content: text(sender(creditor, edition.vatNumber)) },
        { id: 'sender-gap', kind: 'spacer', height: 12 },
        {
          id: 'addresses',
          kind: 'columns',
          columns: [
            {
              width: 'fill',
              components: [
                { id: 'customer', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('customer') }] },
                {
                  id: 'street',
                  kind: 'text',
                  style: 'address',
                  content: [
                    { kind: 'field', field: header('street') },
                    { kind: 'text', text: ' ' },
                    { kind: 'field', field: header('buildingNumber') },
                  ],
                },
                {
                  id: 'city',
                  kind: 'text',
                  style: 'address',
                  content: [
                    { kind: 'field', field: header('postcode') },
                    { kind: 'text', text: ' ' },
                    { kind: 'field', field: header('city') },
                  ],
                },
              ],
            },
            {
              width: 190,
              components: [
                { id: 'title', kind: 'text', style: 'title', content: text(edition.heading) },
                {
                  id: 'number',
                  kind: 'text',
                  content: [
                    { kind: 'text', text: edition.numberIs },
                    { kind: 'field', field: header('number') },
                  ],
                },
                {
                  id: 'issued-on',
                  kind: 'text',
                  content: [
                    { kind: 'text', text: edition.issuedOnIs },
                    { kind: 'field', field: header('issuedOn'), format: { kind: 'date', style: 'medium' } },
                  ],
                },
                {
                  id: 'due-on',
                  kind: 'text',
                  content: [
                    { kind: 'text', text: edition.dueOnIs },
                    { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'medium' } },
                  ],
                },
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
            { id: 'article', header: columns[0], width: 82, align: 'left', value: { kind: 'field', field: detail('article') } },
            { id: 'description', header: columns[1], width: 'fill', align: 'left', value: { kind: 'field', field: detail('description') } },
            {
              id: 'quantity',
              header: columns[2],
              width: 50,
              align: 'right',
              value: { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 2, grouping: true } },
            },
            { id: 'unit', header: columns[3], width: 58, align: 'left', value: { kind: 'field', field: detail('unit') } },
            { id: 'unit-price', header: columns[4], width: 82, align: 'right', value: { kind: 'field', field: detail('unitPrice'), format: CHF } },
            { id: 'amount', header: columns[5], width: 92, align: 'right', value: { kind: 'field', field: detail('amount'), format: CHF } },
          ],
          sort: [{ field: detail('article'), direction: 'asc' }],
          totals: [
            {
              cells: [
                { column: 'article', value: { kind: 'text', text: edition.subtotal } },
                { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'report', format: CHF } },
              ],
            },
            {
              cells: [
                { column: 'article', value: { kind: 'text', text: edition.vat } },
                { column: 'amount', value: { kind: 'expression', expression: { cel: 'round(totals.subtotal * dec("0.081"), 2)' }, format: CHF } },
              ],
            },
            {
              cells: [
                { column: 'article', value: { kind: 'text', text: edition.total } },
                { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: CHF } },
              ],
              style: 'grand',
            },
          ],
          emptyText: edition.empty,
          repeatHeader: true,
        },
      ],
      summary: [
        { id: 'summary-gap', kind: 'spacer', height: 12 },
        {
          id: 'terms',
          kind: 'text',
          content: [
            { kind: 'text', text: edition.terms[0] },
            { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'long' } },
            { kind: 'text', text: edition.terms[1] },
          ],
        },
      ],
      pageFooter: [],
    },
    paymentPart: {
      kind: 'swissQrBill',
      language: edition.language,
      account: text('CH44 3199 9123 0008 8901 2'),
      creditor: {
        name: text(creditor.name),
        street: text(creditor.street),
        buildingNumber: text(creditor.buildingNumber),
        postalCode: text(creditor.postalCode),
        town: text(creditor.town),
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
      message: [
        { kind: 'text', text: edition.message },
        { kind: 'field', field: header('number') },
      ],
    },
    provenance: { kind: 'blank' },
  }
}

/** The edition's line items, its article numbers from 2001 up, given in the reverse of the order the report prints them in. */
function lines(edition: Edition): Record<string, string>[] {
  return edition.items
    .map(([description, unit, quantity, unitPrice], index) => ({
      article: `${edition.articles}-${2001 + index}`,
      description,
      quantity,
      unit,
      unitPrice,
      amount: lineAmount(quantity, unitPrice),
    }))
    .reverse()
}

/** The edition's data: its header, with its customer and its QR reference, and its line items. */
function data(edition: Edition): ReportData {
  const detail = lines(edition)
  const { customer } = edition
  return {
    header: {
      number: edition.number,
      issuedOn: '2026-10-15',
      dueOn: '2026-11-14',
      customer: customer.name,
      street: customer.street,
      buildingNumber: customer.buildingNumber,
      postcode: customer.postalCode,
      city: customer.town,
      reference: edition.reference,
    },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

/** The invoice in the edition's language, with its data. */
const invoice = (edition: Edition): Starter => ({
  id: edition.id,
  title: edition.title,
  proves: edition.proves,
  report: report(edition),
  data: data(edition),
  parameters: {},
})

/** The invoice's line items, `R-2001` up, given in the reverse of the order the report prints them in. */
export function invoiceLines(): Record<string, string>[] {
  return lines(GERMAN)
}

/** The invoice: its header, with SIX's example QR reference, and its line items. */
export function invoiceData(): ReportData {
  return data(GERMAN)
}

export const INVOICE: Starter = invoice(GERMAN)

/** The invoice in French, for Romandy: a sample, which the Studio's picker does not offer. A sample has a starter's shape. */
export const INVOICE_FR: Starter = invoice(FRENCH)

/** The invoice in Italian, for Ticino: a sample. */
export const INVOICE_IT: Starter = invoice(ITALIAN)

/** The invoice in English, from a firm in Basel: a sample. */
export const INVOICE_EN: Starter = invoice(ENGLISH)

/** The invoice in German, French, Italian and English, each with its slip in its language: the German is the starter, and the others are samples of it. */
export const INVOICE_SAMPLES: readonly Starter[] = [INVOICE, INVOICE_FR, INVOICE_IT, INVOICE_EN]
