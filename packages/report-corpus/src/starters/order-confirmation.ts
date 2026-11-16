import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { sender } from './invoice.js'
import { GERMAN } from './invoice-words.js'
import { LETTERHEAD, LOGO_ASSET } from './logo.js'
import { lineAmount } from './quotation.js'
import type { Starter } from './starter.js'

/**
 * The order confirmation, "Auftragsbestätigung" (0064): the firm confirms
 * an order of goods, the work to fit them and two returns, in Swiss
 * francs for a Swiss German reader, over two pages. It proves:
 * - **several tables over one list of lines** (0062): every line of the
 *   order is a detail row, and three tables pick theirs by its `kind` --
 *   the goods, the services and the returns -- each with its own columns,
 *   order and total, and the order's total under all three, over every
 *   line;
 * - **a group header kept with its first rows** (0059): the goods are
 *   grouped by the day they are delivered, and each delivery's header is
 *   kept on its page with its first three lines, where one delivery's
 *   header falls at the foot of page 1;
 * - **page 1's own header** (0060): the firm's letterhead, its mark and
 *   its address, on page 1 alone, where page 2 on prints a slim running
 *   header with the order's number, and the page footer counts every page.
 *
 * The totals are the invoice's: the net amount is the exact sum of every
 * line's amount, a return's negative; the VAT line an expression over it,
 * rounded to the centime; and the total the net times 1.081, rounded once,
 * which is the net plus the printed VAT, as the net is a whole number of
 * centimes. The firm is the invoices' and the quotation's (0032), the
 * customer the quotation's; the goods and their prices are invented.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const
const QUANTITY = { kind: 'number', scale: 2, grouping: true } as const
const text = (value: string) => ({ kind: 'text', text: value }) as const
const net = (over: 'report' | 'table' | 'group') => ({ kind: 'aggregate', aggregate: 'net', over, format: CHF }) as const

type Component = ReportDefinition['regions']['body'][number]
type Table = Extract<Component, { kind: 'table' }>
type Column = Table['columns'][number]

const column = (id: string, heading: string, width: Column['width'], align: Column['align'], value: Column['value']): Column => ({
  id,
  header: heading,
  width,
  align,
  value,
})
const article = column('article', 'Artikel', 62, 'left', { kind: 'field', field: detail('article') })
const description = column('description', 'Beschreibung', 'fill', 'left', { kind: 'field', field: detail('description') })
const quantity = column('quantity', 'Menge', 48, 'right', { kind: 'field', field: detail('quantity'), format: QUANTITY })
const unit = column('unit', 'Einheit', 44, 'left', { kind: 'field', field: detail('unit') })
const amount = (heading: string) => column('amount', heading, 86, 'right', { kind: 'field', field: detail('amount'), format: CHF })

/** The row under a table that totals the lines it prints, its label in the column `at`. */
const tableTotal = (at: string, label: string) => ({
  cells: [
    { column: at, value: text(label) },
    { column: 'amount', value: net('table') },
  ],
  style: 'strong',
})

/** A heading, kept with the table it heads where `kept`. */
const heading = (id: string, words: string, kept = true): Component => ({
  id,
  kind: 'text',
  style: 'heading',
  content: [text(words)],
  ...(kept ? { keepWithNext: true } : {}),
})

/** A line under the tables, right-aligned: its label, then its amount. */
const sum = (id: string, label: string, value: Extract<Component, { kind: 'text' }>['content'][number], style = 'sum'): Component => ({
  id,
  kind: 'text',
  style,
  content: [text(label), value],
})

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'order-confirmation',
  title: 'Auftragsbestätigung',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'sender', size: 8, color: '#555555' },
    { id: 'title', size: 16, bold: true },
    { id: 'address', size: 10 },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
    { id: 'heading', size: 11, bold: true },
    { id: 'strong', bold: true },
    { id: 'sum', align: 'right' },
    { id: 'grand', size: 10.5, bold: true, align: 'right' },
  ],
  datasets: {
    header: {
      id: 'order',
      fields: [
        { id: 'number', type: 'string', label: 'Nummer', nullable: false },
        { id: 'confirmedOn', type: 'date', label: 'Datum', nullable: false },
        { id: 'customerOrder', type: 'string', label: 'Bestellung des Kunden', nullable: false },
        { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
        { id: 'street', type: 'string', label: 'Strasse', nullable: false },
        { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
        { id: 'city', type: 'string', label: 'Ort', nullable: false },
      ],
    },
    detail: {
      id: 'order-lines',
      fields: [
        { id: 'kind', type: 'string', label: 'Art', nullable: false },
        { id: 'delivery', type: 'date', label: 'Lieferung', nullable: false },
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
  assets: [LOGO_ASSET],
  aggregates: [
    { id: 'net', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
    {
      id: 'total',
      fn: 'sum',
      of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } },
      rounding: { scale: 2, mode: 'half-away-from-zero' },
    },
  ],
  regions: {
    firstPageHeader: [...LETTERHEAD, { id: 'sender', kind: 'text', style: 'sender', content: [text(sender(GERMAN.creditor, 'MWST'))] }],
    pageHeader: [
      {
        id: 'running-head',
        kind: 'text',
        style: 'small',
        content: [text('Auftragsbestätigung '), { kind: 'field', field: header('number') }, text(' · '), { kind: 'field', field: header('customer') }],
      },
    ],
    reportHeader: [
      {
        id: 'addresses',
        kind: 'columns',
        columns: [
          {
            width: 'fill',
            components: [
              { id: 'customer', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('customer') }] },
              { id: 'street', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('street') }] },
              {
                id: 'city',
                kind: 'text',
                style: 'address',
                content: [{ kind: 'field', field: header('postcode') }, text(' '), { kind: 'field', field: header('city') }],
              },
            ],
          },
          {
            width: 190,
            components: [
              { id: 'title', kind: 'text', style: 'title', content: [text('Auftragsbestätigung')] },
              { id: 'number', kind: 'text', content: [text('Nummer: '), { kind: 'field', field: header('number') }] },
              {
                id: 'confirmed-on',
                kind: 'text',
                content: [text('Datum: '), { kind: 'field', field: header('confirmedOn'), format: { kind: 'date', style: 'medium' } }],
              },
              { id: 'customer-order', kind: 'text', content: [text('Ihre Bestellung: '), { kind: 'field', field: header('customerOrder') }] },
            ],
          },
        ],
      },
      { id: 'head-gap', kind: 'spacer', height: 18 },
    ],
    body: [
      // Not kept with its table: the renderer moves a heading kept with a
      // table that runs past its page to the next page with the whole table,
      // leaving page 1 without it (0064). The heading stands where page 1's
      // body starts, so no page ends under it.
      heading('goods-heading', 'Waren', false),
      {
        id: 'goods',
        kind: 'table',
        dataset: 'detail',
        rowsWhen: { cel: 'row.kind == "goods"' },
        columns: [
          article,
          description,
          quantity,
          unit,
          column('unit-price', 'Preis', 78, 'right', { kind: 'field', field: detail('unitPrice'), format: CHF }),
          amount('Betrag'),
        ],
        sort: [{ field: detail('article'), direction: 'asc' }],
        group: {
          by: detail('delivery'),
          direction: 'asc',
          header: [text('Lieferung vom '), { kind: 'expression', expression: { cel: 'group.key' }, format: { kind: 'date', style: 'long' } }],
          headerStyle: 'strong',
          keepWithRows: 3,
          footer: [
            {
              cells: [
                { column: 'description', value: text('Zwischensumme Lieferung') },
                { column: 'amount', value: net('group') },
              ],
            },
          ],
        },
        totals: [tableTotal('description', 'Total Waren')],
        emptyText: 'Keine Waren.',
        repeatHeader: true,
      },
      { id: 'services-gap', kind: 'spacer', height: 12 },
      heading('services-heading', 'Leistungen'),
      {
        id: 'services',
        kind: 'table',
        dataset: 'detail',
        rowsWhen: { cel: 'row.kind == "service"' },
        columns: [
          column('description', 'Leistung', 'fill', 'left', { kind: 'field', field: detail('description') }),
          quantity,
          unit,
          column('rate', 'Ansatz', 78, 'right', { kind: 'field', field: detail('unitPrice'), format: CHF }),
          // Not "Betrag", the goods' word: two columns of one header are labelled by their ids in the design view, and at a table's right end that label stands over the table's.
          amount('Total'),
        ],
        sort: [{ field: detail('article'), direction: 'asc' }],
        totals: [tableTotal('description', 'Total Leistungen')],
        emptyText: 'Keine Leistungen.',
        repeatHeader: true,
      },
      { id: 'returns-gap', kind: 'spacer', height: 12 },
      heading('returns-heading', 'Rücknahmen'),
      {
        id: 'returns',
        kind: 'table',
        dataset: 'detail',
        rowsWhen: { cel: 'row.kind == "return"' },
        columns: [article, description, quantity, unit, amount('Gutschrift')],
        sort: [{ field: detail('article'), direction: 'asc' }],
        totals: [tableTotal('description', 'Total Rücknahmen')],
        emptyText: 'Keine Rücknahmen.',
        repeatHeader: true,
      },
    ],
    summary: [
      { id: 'summary-gap', kind: 'spacer', height: 12 },
      sum('net', 'Nettobetrag ', net('report')),
      sum('vat', 'MWST 8.1 % ', { kind: 'expression', expression: { cel: 'round(totals.net * dec("0.081"), 2)' }, format: CHF }),
      sum('total', 'Total ', { kind: 'aggregate', aggregate: 'total', over: 'report', format: CHF }, 'grand'),
      { id: 'terms-gap', kind: 'spacer', height: 12 },
      { id: 'terms', kind: 'text', content: [text('Wir danken für Ihren Auftrag. Geliefert wird frei Baustelle, zahlbar innert 30 Tagen netto.')] },
    ],
    pageFooter: [
      {
        id: 'page-of',
        kind: 'text',
        style: 'footer',
        content: [text('Seite '), { kind: 'pageNumber' }, text(' von '), { kind: 'pageCount' }],
      },
    ],
  },
  provenance: { kind: 'blank' },
}

/** One line of the order as the provider gives it: what it is, when it is delivered, and its article, words, quantity, unit, price and amount. */
export interface OrderConfirmationLine {
  readonly kind: 'goods' | 'service' | 'return'
  readonly delivery: string
  readonly article: string
  readonly description: string
  readonly quantity: string
  readonly unit: string
  readonly unitPrice: string
  readonly amount: string
}

/** Description, unit, quantity and unit price, each quantity and price exact to the centime. */
type Item = readonly [description: string, unit: string, quantity: string, unitPrice: string]

/**
 * The goods, by the day each delivery comes: the ventilation first, then
 * the heat pump, then the underfloor heating, in 15, 14 and 6 lines. So
 * many that the third delivery's header falls at the foot of page 1, two
 * lines' room above the page footer: kept with one line, as before 0059,
 * it would start there with two of its lines under it, and kept with three
 * it starts page 2 with them.
 */
const DELIVERIES: readonly (readonly [day: string, items: readonly Item[]])[] = [
  [
    '2026-11-23',
    [
      ['Lüftungsgerät Monoblock', 'Stk', '1.00', '8450.00'],
      ['Wärmerad Ersatzteilset', 'Set', '1.00', '640.00'],
      ['Taschenfilter F7', 'Stk', '12.00', '38.50'],
      ['Keilriemen SPA 1250', 'Stk', '4.00', '27.80'],
      ['Lüftungskanal verzinkt', 'm', '24.50', '46.20'],
      ['Bogen 90° DN 315', 'Stk', '8.00', '58.40'],
      ['Schalldämpfer DN 315', 'Stk', '2.00', '312.00'],
      ['Brandschutzklappe DN 250', 'Stk', '3.00', '486.00'],
      ['Volumenstromregler DN 250', 'Stk', '4.00', '228.50'],
      ['Dichtungsband EPDM', 'm', '35.00', '4.35'],
      ['Kanalisolation 30 mm', 'm', '18.00', '22.90'],
      ['Wetterschutzgitter 630 × 400', 'Stk', '1.00', '348.00'],
      ['Revisionsöffnung DN 315', 'Stk', '4.00', '86.50'],
      ['Kondensatpumpe', 'Stk', '1.00', '264.00'],
      ['Befestigungsmaterial', 'Pausch.', '1.00', '185.00'],
    ],
  ],
  [
    '2026-12-07',
    [
      ['Wärmepumpe Luft/Wasser 12 kW', 'Stk', '1.00', '14650.00'],
      ['Pufferspeicher 500 l', 'Stk', '1.00', '1890.00'],
      ['Umwälzpumpe DN 32', 'Stk', '2.00', '742.00'],
      ['Mischventil 3-Weg DN 32', 'Stk', '1.00', '398.00'],
      ['Kugelhahn DN 32', 'Stk', '6.00', '64.80'],
      ['Verbundrohr 32 × 3', 'm', '36.00', '18.40'],
      ['Rohrisolation 32 mm', 'm', '36.00', '9.60'],
      ['Ausdehnungsgefäss 80 l', 'Stk', '1.00', '286.00'],
      ['Sicherheitsventil 3 bar', 'Stk', '1.00', '48.90'],
      ['Schmutzfänger DN 32', 'Stk', '2.00', '96.40'],
      ['Entlüfter automatisch', 'Stk', '4.00', '18.70'],
      ['Thermometer 0–120 °C', 'Stk', '4.00', '24.60'],
      ['Manometer 0–4 bar', 'Stk', '2.00', '32.80'],
      ['Wärmemengenzähler', 'Stk', '1.00', '512.00'],
    ],
  ],
  [
    '2027-01-11',
    [
      ['Dämmplatte ThermoPlan FB 30', 'Stk', '84.00', '12.80'],
      ['Heizrohr PE-RT 16 × 2', 'm', '420.00', '1.95'],
      ['Randdämmstreifen', 'm', '96.00', '1.20'],
      ['Heizkreisverteiler 6-fach', 'Stk', '1.00', '624.00'],
      ['Stellantrieb 230 V', 'Stk', '12.00', '42.50'],
      ['Raumthermostat Funk', 'Stk', '6.00', '148.00'],
    ],
  ],
]

/** The work to fit the goods, each on the day of the delivery it fits. */
const SERVICES: readonly (readonly [day: string, item: Item])[] = [
  ['2026-11-23', ['Montage Lüftungsgerät', 'h', '16.00', '118.00']],
  ['2026-12-07', ['Montage Wärmepumpe', 'h', '12.00', '118.00']],
  ['2026-12-07', ['Elektroanschluss', 'h', '6.50', '124.00']],
  ['2027-01-11', ['Verlegung Fussbodenheizung', 'h', '18.00', '112.00']],
  ['2027-01-11', ['Inbetriebnahme und Einregulierung', 'Pausch.', '1.00', '980.00']],
  ['2027-01-11', ['Einweisung Betriebspersonal', 'h', '2.00', '118.00']],
]

/** What the customer gives back, credited: goods of an earlier order, on the day of the delivery that takes them away. */
const RETURNS: readonly (readonly [day: string, item: Item])[] = [
  ['2026-11-23', ['Taschenfilter F5, Fehllieferung', 'Stk', '6.00', '32.40']],
  ['2026-12-07', ['Umwälzpumpe DN 25, ungeöffnet', 'Stk', '1.00', '412.00']],
]

/** A line of `kind`, its article numbered from `first`, its amount the quantity times the price to the centime, a return's credited. */
const line = (kind: OrderConfirmationLine['kind'], first: number) => {
  return ([day, [words, unit, count, price]]: readonly [string, Item], index: number): OrderConfirmationLine => {
    const credited = lineAmount(count, price)
    return {
      kind,
      delivery: day,
      article: `${kind === 'goods' ? 'W' : kind === 'service' ? 'L' : 'R'}-${first + index}`,
      description: words,
      quantity: count,
      unit,
      unitPrice: price,
      amount: kind === 'return' ? `-${credited}` : credited,
    }
  }
}

/**
 * The order's lines, every kind mixed, in the order a provider might keep
 * them -- as each line was entered, which is neither by kind, by delivery
 * nor by article -- so that only the tables' conditions, groups and sorts
 * put them where they print.
 */
export function orderConfirmationLines(): OrderConfirmationLine[] {
  const goods = DELIVERIES.flatMap(([day, items]) => items.map((item) => [day, item] as const)).map(line('goods', 3001))
  const lines = [...goods, ...SERVICES.map(line('service', 4001)), ...RETURNS.map(line('return', 5001))]
  // Each line's place is its index times 7919 modulo the prime 101: distinct for fewer than 101 lines, so every line is taken once.
  const place = (index: number): number => (index * 7919) % 101
  return lines
    .map((each, index) => ({ each, at: place(index) }))
    .sort((a, b) => a.at - b.at)
    .map(({ each }) => each)
}

/** The order confirmation's data: its header, the customer the quotation's, and its lines. */
export function orderConfirmationData(): ReportData {
  const detail = orderConfirmationLines().map((each) => ({ ...each }))
  return {
    header: {
      number: 'AB-2026-1107',
      confirmedOn: '2026-11-16',
      customerOrder: 'B-4471',
      customer: 'Bäckerei Müller AG',
      street: 'Hauptstrasse 12',
      postcode: '3011',
      city: 'Bern',
    },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

export const ORDER_CONFIRMATION: Starter = {
  id: 'order-confirmation',
  title: 'Auftragsbestätigung',
  proves:
    'several tables over one list of lines, each picking its lines by their kind and totalling its own; a delivery’s header kept with its first three lines; and a letterhead on page 1 in place of the running header the later pages print',
  report: REPORT,
  data: orderConfirmationData(),
  parameters: {},
}
