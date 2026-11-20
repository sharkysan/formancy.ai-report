import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { sender } from './invoice.js'
import { GERMAN } from './invoice-words.js'
import { LETTERHEAD, LOGO_ASSET } from './logo.js'
import { lineAmount } from './quotation.js'
import type { Starter } from './starter.js'

/**
 * The monthly sales report, "Umsatzbericht" (0067): the firm's sales of
 * November 2026, line by line, in Swiss francs for a Swiss German reader,
 * over two pages. It proves:
 * - **a bar and a pie chart of the detail rows** (0052, 0055, 0058): each
 *   product line's sales as a bar, labelled with its total, and each
 *   region's as a slice of the month's, its legend saying its total and
 *   its share;
 * - **charts that agree with the table beside them**: one table of the
 *   same lines grouped by the bar chart's category, each group closed by
 *   its total and the table by the month's, every total to the centime;
 *   each bar's label prints the digits its group's total prints, each
 *   slice's share is its region's total over the month's, rounded once,
 *   and the bars add up to the month's total, as the slices do;
 * - **page 1's own header** (0060): the firm's letterhead, where page 2
 *   prints a slim running header with the month, and the page footer
 *   counts every page; each product line's header kept with its first
 *   three lines (0059).
 *
 * The totals are the runtime's, decided once (0010, 0055): a bar and a
 * group's total are one sum of one field over the same rows, and print in
 * one number of places. A credit note is a line below zero, which lowers
 * its product line's and its region's sales. The firm is the invoices' and
 * the order confirmation's (0032); the lines, their regions and their
 * amounts are invented.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const
/** Every value a chart prints -- each tick, each bar's label, each slice's value -- to the centime, as the table prints its amounts; the axis says the currency. */
const AMOUNT = { kind: 'number', scale: 2, grouping: true } as const
const text = (value: string) => ({ kind: 'text', text: value }) as const
const sales = (over: 'report' | 'table' | 'group') => ({ kind: 'aggregate', aggregate: 'sales', over, format: CHF }) as const

type Component = ReportDefinition['regions']['body'][number]
type Chart = Extract<Component, { kind: 'chart' }>
type Table = Extract<Component, { kind: 'table' }>
type Column = Table['columns'][number]

const column = (id: string, heading: string, width: Column['width'], align: Column['align'], value: Column['value']): Column => ({
  id,
  header: heading,
  width,
  align,
  value,
})

/** What a chart of the month's lines prints with nothing to draw. */
const NO_SALES = 'Keine Umsätze im Zeitraum.'

/** A chart of the month's lines, each `category` one bar or one slice, totalling their amounts, every value printed to the centime. */
const chartOf = (id: string, chart: 'bar' | 'pie', category: string, width: number, title: string): Chart => ({
  id,
  kind: 'chart',
  chart,
  dataset: 'detail',
  width,
  height: 220,
  category: { field: detail(category), order: 'asc' },
  series: [{ id: 'sales', label: 'Umsatz', fn: 'sum', of: detail('amount') }],
  valueFormat: AMOUNT,
  emptyText: NO_SALES,
  title,
  ...(chart === 'bar' ? { valueTitle: 'CHF' } : {}),
  valueLabels: true,
})

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'sales-report',
  title: 'Umsatzbericht',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'sender', size: 8, color: '#555555' },
    { id: 'title', size: 16, bold: true },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
    { id: 'heading', size: 11, bold: true },
    { id: 'strong', bold: true },
  ],
  datasets: {
    header: {
      id: 'period',
      fields: [
        { id: 'month', type: 'string', label: 'Monat', nullable: false },
        { id: 'from', type: 'date', label: 'Von', nullable: false },
        { id: 'to', type: 'date', label: 'Bis', nullable: false },
        { id: 'issuedOn', type: 'date', label: 'Erstellt am', nullable: false },
      ],
    },
    detail: {
      id: 'sales-lines',
      fields: [
        { id: 'number', type: 'string', label: 'Beleg', nullable: false },
        { id: 'date', type: 'date', label: 'Datum', nullable: false },
        { id: 'category', type: 'string', label: 'Sparte', nullable: false },
        { id: 'region', type: 'string', label: 'Region', nullable: false },
        { id: 'description', type: 'string', label: 'Beschreibung', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false, scale: 2 },
        { id: 'unit', type: 'string', label: 'Einheit', nullable: false },
        { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [LOGO_ASSET],
  aggregates: [
    { id: 'sales', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
    { id: 'documents', fn: 'count' },
  ],
  regions: {
    firstPageHeader: [...LETTERHEAD, { id: 'sender', kind: 'text', style: 'sender', content: [text(sender(GERMAN.creditor, 'MWST'))] }],
    pageHeader: [
      {
        id: 'running-head',
        kind: 'text',
        style: 'small',
        content: [text('Umsatzbericht '), { kind: 'field', field: header('month') }, text(` · ${GERMAN.creditor.name}`)],
      },
    ],
    reportHeader: [
      { id: 'title', kind: 'text', style: 'title', content: [text('Umsatzbericht '), { kind: 'field', field: header('month') }] },
      {
        id: 'period',
        kind: 'text',
        content: [
          text('Zeitraum: '),
          { kind: 'field', field: header('from'), format: { kind: 'date', style: 'long' } },
          text(' bis '),
          { kind: 'field', field: header('to'), format: { kind: 'date', style: 'long' } },
        ],
      },
      {
        id: 'issued-on',
        kind: 'text',
        content: [text('Erstellt am: '), { kind: 'field', field: header('issuedOn'), format: { kind: 'date', style: 'medium' } }],
      },
      {
        id: 'key-figures',
        kind: 'text',
        style: 'strong',
        content: [text('Umsatz '), sales('report'), text(' aus '), { kind: 'aggregate', aggregate: 'documents', over: 'report' }, text(' Belegen')],
      },
      { id: 'head-gap', kind: 'spacer', height: 14 },
    ],
    body: [
      {
        id: 'charts',
        kind: 'columns',
        columns: [
          { width: 'fill', components: [chartOf('by-category', 'bar', 'category', 290, 'Umsatz nach Sparte')] },
          { width: 180, components: [chartOf('by-region', 'pie', 'region', 180, 'Umsatz nach Region')] },
        ],
      },
      { id: 'table-gap', kind: 'spacer', height: 16 },
      // Not kept with its table: left so while the renderer moved a heading
      // kept with a table that runs past its page to the next page with the
      // whole table (0064). It stands under the charts, far from page 1's
      // foot, and kept or not it prints the same there (0011, fixed
      // 2026-11-20).
      { id: 'lines-heading', kind: 'text', style: 'heading', content: [text('Belege nach Sparte')] },
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          column('number', 'Beleg', 54, 'left', { kind: 'field', field: detail('number') }),
          column('date', 'Datum', 56, 'left', { kind: 'field', field: detail('date'), format: { kind: 'date', style: 'medium' } }),
          column('region', 'Region', 60, 'left', { kind: 'field', field: detail('region') }),
          column('description', 'Beschreibung', 'fill', 'left', { kind: 'field', field: detail('description') }),
          column('quantity', 'Menge', 44, 'right', { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 2, grouping: true } }),
          column('unit', 'Einheit', 44, 'left', { kind: 'field', field: detail('unit') }),
          column('amount', 'Betrag', 82, 'right', { kind: 'field', field: detail('amount'), format: CHF }),
        ],
        sort: [
          { field: detail('date'), direction: 'asc' },
          { field: detail('number'), direction: 'asc' },
        ],
        group: {
          by: detail('category'),
          direction: 'asc',
          header: [{ kind: 'expression', expression: { cel: 'group.key + " (" + string(group.documents) + " Belege)"' } }],
          headerStyle: 'strong',
          keepWithRows: 3,
          footer: [
            {
              cells: [
                { column: 'description', value: { kind: 'expression', expression: { cel: '"Total " + group.key' } } },
                { column: 'amount', value: sales('group') },
              ],
              style: 'strong',
            },
          ],
        },
        totals: [
          {
            cells: [
              { column: 'description', value: text('Total Umsatz') },
              { column: 'amount', value: sales('table') },
            ],
            style: 'strong',
          },
        ],
        emptyText: NO_SALES,
        repeatHeader: true,
      },
    ],
    summary: [
      { id: 'note-gap', kind: 'spacer', height: 8 },
      {
        id: 'note',
        kind: 'text',
        style: 'small',
        content: [text('Beträge in Schweizer Franken ohne MWST; eine Gutschrift mindert den Umsatz ihrer Sparte und ihrer Region.')],
      },
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

/** One sales line as the provider gives it: its document's number and date, its product line and region, and what was sold, how much, and for how much. */
export interface SalesReportLine {
  readonly number: string
  readonly date: string
  readonly category: string
  readonly region: string
  readonly description: string
  readonly quantity: string
  readonly unit: string
  readonly amount: string
}

/** Day of November, product line, region, description, quantity, unit and unit price, each quantity and price exact to the centime; a credit note's last. */
type Sale = readonly [day: string, category: string, region: string, description: string, quantity: string, unit: string, price: string, credit?: 'credit']

/**
 * The month's sales, by product line: heating, ventilation, plumbing and
 * service, in 13, 9, 12 and 8 lines, each sold in one of five regions
 * around the firm's town. Two are credit notes, a pump and two mixer
 * taps taken back, each in a product line and a region that still sell
 * far more than they credit.
 */
const SALES: readonly Sale[] = [
  ['02', 'Heizung', 'Mittelland', 'Wärmepumpe 8 kW', '1.00', 'Stk', '12480.00'],
  ['04', 'Heizung', 'Stadt Bern', 'Wärmepumpe 12 kW', '1.00', 'Stk', '14650.00'],
  ['18', 'Heizung', 'Seeland', 'Wärmepumpe 16 kW', '1.00', 'Stk', '17920.00'],
  ['04', 'Heizung', 'Stadt Bern', 'Pufferspeicher 500 l', '1.00', 'Stk', '1890.00'],
  ['10', 'Heizung', 'Oberland', 'Heizkessel Gas 24 kW', '1.00', 'Stk', '6340.00'],
  ['11', 'Heizung', 'Emmental', 'Radiator 600 × 1000', '6.00', 'Stk', '412.50'],
  ['16', 'Heizung', 'Mittelland', 'Heizrohr PE-RT 16 mm', '420.00', 'm', '1.95'],
  ['16', 'Heizung', 'Mittelland', 'Heizkreisverteiler', '2.00', 'Stk', '624.00'],
  ['19', 'Heizung', 'Seeland', 'Umwälzpumpe DN 32', '3.00', 'Stk', '742.00'],
  ['23', 'Heizung', 'Oberland', 'Mischventil DN 32', '2.00', 'Stk', '398.00'],
  ['25', 'Heizung', 'Stadt Bern', 'Wärmemengenzähler', '4.00', 'Stk', '512.00'],
  ['27', 'Heizung', 'Emmental', 'Raumthermostat Funk', '9.00', 'Stk', '148.00'],
  ['26', 'Heizung', 'Seeland', 'Gutschrift Umwälzpumpe', '1.00', 'Stk', '742.00', 'credit'],
  ['03', 'Lüftung', 'Stadt Bern', 'Lüftungsgerät KWL 350', '1.00', 'Stk', '7450.00'],
  ['12', 'Lüftung', 'Mittelland', 'Lüftungsgerät KWL 550', '1.00', 'Stk', '9280.00'],
  ['05', 'Lüftung', 'Stadt Bern', 'Lüftungskanal DN 160', '48.50', 'm', '46.20'],
  ['12', 'Lüftung', 'Mittelland', 'Schalldämpfer DN 160', '4.00', 'Stk', '312.00'],
  ['17', 'Lüftung', 'Oberland', 'Brandschutzklappe', '6.00', 'Stk', '486.00'],
  ['20', 'Lüftung', 'Seeland', 'Volumenstromregler', '5.00', 'Stk', '228.50'],
  ['24', 'Lüftung', 'Emmental', 'Taschenfilter F7', '24.00', 'Stk', '38.50'],
  ['26', 'Lüftung', 'Oberland', 'Wetterschutzgitter', '2.00', 'Stk', '348.00'],
  ['30', 'Lüftung', 'Stadt Bern', 'Abluftventilator', '3.00', 'Stk', '865.00'],
  ['02', 'Sanitär', 'Emmental', 'Boiler 300 l', '2.00', 'Stk', '2140.00'],
  ['06', 'Sanitär', 'Stadt Bern', 'Wandklosett', '6.00', 'Stk', '486.00'],
  ['06', 'Sanitär', 'Stadt Bern', 'Waschtisch 60 cm', '8.00', 'Stk', '324.00'],
  ['09', 'Sanitär', 'Seeland', 'Duschrinne 80 cm', '4.00', 'Stk', '268.00'],
  ['13', 'Sanitär', 'Mittelland', 'Mischbatterie', '12.00', 'Stk', '189.00'],
  ['13', 'Sanitär', 'Oberland', 'Enthärtungsanlage', '1.00', 'Stk', '3280.00'],
  ['17', 'Sanitär', 'Mittelland', 'Verbundrohr 20 mm', '186.00', 'm', '9.80'],
  ['20', 'Sanitär', 'Emmental', 'Rückflussverhinderer', '3.00', 'Stk', '154.00'],
  ['24', 'Sanitär', 'Seeland', 'Druckreduzierventil', '2.00', 'Stk', '268.50'],
  ['25', 'Sanitär', 'Oberland', 'Spülkasten UP', '6.00', 'Stk', '312.00'],
  ['27', 'Sanitär', 'Seeland', 'Regenwassertank', '1.00', 'Stk', '4860.00'],
  ['30', 'Sanitär', 'Mittelland', 'Gutschrift Mischbatterie', '2.00', 'Stk', '189.00', 'credit'],
  ['03', 'Service', 'Mittelland', 'Wartung Wärmepumpe', '6.00', 'h', '118.00'],
  ['09', 'Service', 'Stadt Bern', 'Wartung Lüftung', '8.50', 'h', '118.00'],
  ['11', 'Service', 'Oberland', 'Service Heizkessel', '3.00', 'Pausch.', '285.00'],
  ['16', 'Service', 'Emmental', 'Störungsbehebung', '4.50', 'h', '124.00'],
  ['19', 'Service', 'Seeland', 'Inbetriebnahme', '2.00', 'Pausch.', '980.00'],
  ['23', 'Service', 'Stadt Bern', 'Legionellenprüfung', '5.00', 'Stk', '165.00'],
  ['24', 'Service', 'Mittelland', 'Filterwechsel', '12.00', 'Stk', '64.00'],
  ['28', 'Service', 'Oberland', 'Pikettdienst', '3.00', 'h', '186.00'],
]

/**
 * The month's lines, every product line mixed, in the order a provider
 * might keep them -- neither by product line, by day nor by number -- so
 * that only the table's group and sort put them where they print. Each is
 * numbered in the order of its day, an invoice `R-26-1101` up and a credit
 * note `G-26-0041` up; its amount is the quantity times the price to the
 * centime, a credit note's below zero.
 */
export function salesReportLines(): SalesReportLine[] {
  const byDay = SALES.map((sale, index) => ({ sale, index })).sort((a, b) => (a.sale[0] === b.sale[0] ? a.index - b.index : a.sale[0] < b.sale[0] ? -1 : 1))
  let invoice = 1101
  let credit = 41
  const lines = byDay.map(({ sale: [day, category, region, description, quantity, unit, price, credited] }): SalesReportLine => {
    const amount = lineAmount(quantity, price)
    return {
      number: credited === undefined ? `R-26-${String(invoice++)}` : `G-26-${String(credit++).padStart(4, '0')}`,
      date: `2026-11-${day}`,
      category,
      region,
      description,
      quantity,
      unit,
      amount: credited === undefined ? amount : `-${amount}`,
    }
  })
  // Each line's place is its index times 7919 modulo the prime 101: distinct for fewer than 101 lines, so every line is taken once.
  const place = (index: number): number => (index * 7919) % 101
  return lines
    .map((each, index) => ({ each, at: place(index) }))
    .sort((a, b) => a.at - b.at)
    .map(({ each }) => each)
}

/** The sales report's data: the month it reports, the day it was made, and the month's lines. */
export function salesReportData(): ReportData {
  const detail = salesReportLines().map((each) => ({ ...each }))
  return {
    header: { month: 'November 2026', from: '2026-11-01', to: '2026-11-30', issuedOn: '2026-12-01' },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

export const SALES_REPORT: Starter = {
  id: 'sales-report',
  title: 'Umsatzbericht',
  proves:
    'a bar chart and a pie chart of the detail rows beside a table of the same rows grouped by the bar chart’s category, each bar’s label the total its group prints and each slice’s share its region’s total over the month’s, rounded once; and a letterhead on page 1 in place of the running header the later pages print',
  report: REPORT,
  data: salesReportData(),
  parameters: {},
}
