import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import type { Starter } from './starter.js'

/**
 * The quotation (plan 7): who quotes and to whom, line items, and the
 * totals under them, in Swiss francs for a Swiss German reader. It proves a
 * table header repeated over pages, exact totals kept on one page with the
 * last line item, currency formatting and a page footer.
 *
 * The amounts are the data's -- supplied financial values (plan 7) -- and
 * every total is the report's, declared once:
 * - the subtotal is the exact sum of the amounts;
 * - the VAT line is an expression over it, rounded to the centime;
 * - the total is the gross, rounded to the nearest 0.05 for cash, as the
 *   aggregate's declared rounding says;
 * - the rounding line is what the cash rounding added or took away: the
 *   total less the subtotal and the printed VAT, so that the printed lines
 *   add up to the printed total, as a reader checking the column expects.
 *
 * The total is declared as a sum of each amount times 1.081, rounded once:
 * that is the subtotal times 1.081 exactly. It equals the subtotal plus the
 * printed VAT, rounded to 0.05, because both roundings go half away from
 * zero and the boundaries of a 0.05 step fall where those of a centime do,
 * at a half centime. The rate is the template's, explicitly: the report
 * claims no tax law, and a rate that changes is a new template. The
 * supplier, its UID and its address are the data's, invented.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'quotation',
  title: 'Offerte',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'address', size: 10 },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
    { id: 'grand', size: 10.5, bold: true },
    { id: 'sender', size: 8, color: '#555555' },
  ],
  datasets: {
    header: {
      id: 'quotation',
      fields: [
        { id: 'number', type: 'string', label: 'Nummer', nullable: false },
        { id: 'quotedOn', type: 'date', label: 'Datum', nullable: false },
        { id: 'validUntil', type: 'date', label: 'Gültig bis', nullable: false },
        { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
        { id: 'street', type: 'string', label: 'Strasse', nullable: false },
        { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
        { id: 'city', type: 'string', label: 'Ort', nullable: false },
        { id: 'contact', type: 'string', label: 'Kontakt', nullable: true },
        { id: 'supplier', type: 'string', label: 'Anbieter', nullable: false },
        { id: 'supplierAddress', type: 'string', label: 'Adresse des Anbieters', nullable: false },
        { id: 'supplierUid', type: 'string', label: 'UID des Anbieters', nullable: false },
      ],
    },
    detail: {
      id: 'quotation-lines',
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
    { id: 'total', fn: 'sum', of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } }, rounding: { scale: 2, mode: 'half-away-from-zero', increment: '0.05' } },
  ],
  regions: {
    pageHeader: [{ id: 'running-head', kind: 'text', style: 'small', content: [{ kind: 'text', text: 'Offerte ' }, { kind: 'field', field: header('number') }] }],
    reportHeader: [
      {
        id: 'sender',
        kind: 'text',
        style: 'sender',
        content: [
          { kind: 'field', field: header('supplier') },
          { kind: 'text', text: ' · ' },
          { kind: 'field', field: header('supplierAddress') },
          { kind: 'text', text: ' · ' },
          { kind: 'field', field: header('supplierUid') },
          { kind: 'text', text: ' MWST' },
        ],
      },
      { id: 'sender-gap', kind: 'spacer', height: 12 },
      {
        id: 'addresses',
        kind: 'columns',
        columns: [
          {
            width: 'fill',
            components: [
              { id: 'customer', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('customer') }] },
              { id: 'contact', kind: 'text', style: 'address', visibleWhen: { cel: 'header.contact != null' }, content: [{ kind: 'text', text: 'z. Hd. ' }, { kind: 'field', field: header('contact') }] },
              { id: 'street', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('street') }] },
              { id: 'city', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('postcode') }, { kind: 'text', text: ' ' }, { kind: 'field', field: header('city') }] },
            ],
          },
          {
            width: 190,
            components: [
              { id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Offerte' }] },
              { id: 'number', kind: 'text', content: [{ kind: 'text', text: 'Nummer: ' }, { kind: 'field', field: header('number') }] },
              { id: 'quoted-on', kind: 'text', content: [{ kind: 'text', text: 'Datum: ' }, { kind: 'field', field: header('quotedOn'), format: { kind: 'date', style: 'medium' } }] },
              { id: 'valid-until', kind: 'text', content: [{ kind: 'text', text: 'Gültig bis: ' }, { kind: 'field', field: header('validUntil'), format: { kind: 'date', style: 'medium' } }] },
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
              { column: 'article', value: { kind: 'text', text: 'Rundung' } },
              { column: 'amount', value: { kind: 'expression', expression: { cel: 'totals.total - (totals.subtotal + round(totals.subtotal * dec("0.081"), 2))' }, format: CHF } },
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
      { id: 'validity', kind: 'text', content: [{ kind: 'text', text: 'Diese Offerte ist gültig bis ' }, { kind: 'field', field: header('validUntil'), format: { kind: 'date', style: 'long' } }, { kind: 'text', text: '.' }] },
      { id: 'terms', kind: 'text', content: [{ kind: 'text', text: 'Zahlbar innert 30 Tagen netto.' }] },
    ],
    pageFooter: [
      { id: 'page-of', kind: 'text', style: 'footer', content: [{ kind: 'text', text: 'Seite ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' von ' }, { kind: 'pageCount' }] },
    ],
  },
  provenance: { kind: 'blank' },
}

/** Description, unit, quantity and unit price, each quantity and price exact to the centime. */
const ITEMS: readonly (readonly [string, string, string, string])[] = [
  ['Wartung Lüftungsanlage, Grundpauschale', 'Pausch.', '1.00', '480.00'],
  ['Ersatzfilter F7 für Monoblock', 'Stk', '6.00', '38.50'],
  ['Keilriemen SPA 1250', 'Stk', '2.00', '27.80'],
  ['Arbeitszeit Servicetechniker', 'h', '3.75', '128.00'],
  ['Reinigung Kondensatwanne', 'Pausch.', '1.00', '95.00'],
  ['Fahrzeugpauschale Region Bern', 'Pausch.', '1.00', '65.00'],
  ['Dichtungsband EPDM', 'm', '12.50', '4.35'],
  ['Desinfektionsmittel für Wärmerad', 'l', '2.50', '18.90'],
  ['Messprotokoll Luftmengen', 'Stk', '1.00', '150.00'],
  ['Kleinmaterial', 'Pausch.', '1.00', '23.45'],
  ['Austausch Druckdifferenzschalter', 'Stk', '1.00', '1212.40'],
  ['Entsorgung Altfilter', 'kg', '7.25', '1.85'],
]

/** Centimes as francs: 123456n as '1234.56'. */
function francs(centimes: bigint): string {
  return `${centimes / 100n}.${String(centimes % 100n).padStart(2, '0')}`
}

/** A non-negative amount to the centime, as the data writes one: digits, a point and exactly two places. */
const CENTIMES = /^(?:0|[1-9]\d*)\.\d{2}$/

/**
 * Quantity times unit price, both non-negative and written to the centime,
 * rounded half away from zero to the centime: the supplier's amount. Any
 * other input is refused, rather than made into a malformed amount: the
 * arithmetic below reads both as whole centimes.
 */
export function lineAmount(quantity: string, unitPrice: string): string {
  if (!CENTIMES.test(quantity) || !CENTIMES.test(unitPrice)) throw new RangeError('lineAmount takes a quantity and a unit price written with exactly two places, and neither negative')
  const product = BigInt(quantity.replace('.', '')) * BigInt(unitPrice.replace('.', ''))
  return francs((product + 50n) / 100n)
}

/** `count` line items, `A-1001` up, given in the reverse of the order the report prints them in. */
export function quotationLines(count: number): Record<string, string>[] {
  return Array.from({ length: count }, (_, index) => {
    const [description, unit, quantity, unitPrice] = ITEMS[index % ITEMS.length] as readonly [string, string, string, string]
    return { article: `A-${1001 + index}`, description, quantity, unit, unitPrice, amount: lineAmount(quantity, unitPrice) }
  }).reverse()
}

/** A quotation of `lines` line items. */
export function quotationData(lines = ITEMS.length): ReportData {
  const detail = quotationLines(lines)
  return {
    header: {
      number: 'Q-2026-0415',
      quotedOn: '2026-10-15',
      validUntil: '2026-11-14',
      customer: 'Bäckerei Müller AG',
      street: 'Hauptstrasse 12',
      postcode: '3011',
      city: 'Bern',
      contact: 'Herr Peter Kühni',
      supplier: 'Formancy Haustechnik AG',
      supplierAddress: 'Industriestrasse 7, 3052 Zollikofen',
      supplierUid: 'CHE-123.456.789',
    },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

export const QUOTATION: Starter = {
  id: 'quotation',
  title: 'Offerte',
  proves: 'a repeated table header, exact totals with a VAT line and cash rounding, Swiss franc formatting and a page footer',
  report: REPORT,
  data: quotationData(),
  parameters: {},
}
