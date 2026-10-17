import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { EURO_COUNTRIES } from './euro-invoice-countries.js'
import type { AddressPart, EuroBilling, EuroCountry, WholeRate } from './euro-invoice-countries.js'
import { EURO_WORDS } from './euro-invoice-words.js'
import type { EuroWords } from './euro-invoice-words.js'
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
 * The totals are the QR-bill invoice's, at the country's rate: the net
 * amount is the exact sum of the line amounts; the tax line is an
 * expression over it, rounded to the cent; the total is declared as a sum
 * of each amount times one plus the rate, rounded once to the cent, which
 * is the net amount plus the printed tax, as the net amount is a whole
 * number of cents. The code's amount is that total, the one aggregate, and
 * the payment details print it too, so that what the table says, what the
 * details say and what the code asks for cannot differ.
 *
 * The same report is made for Austria, France, Italy, Spain, the
 * Netherlands and Ireland, as samples (`EURO_INVOICE_SAMPLES`), which sell
 * the boiler's parts rather than maintain it:
 * `euro-invoice-countries.ts` holds whom each bills, at what rate and to
 * which account, and where each account and rate was read;
 * `euro-invoice-words.ts` holds each language's words; and this file the
 * one report they are put into. The German is the starter, and its JSON is
 * what it was before the samples were made (`euro-samples.test.ts`).
 *
 * The e-invoice samples (`e-invoice.ts`, 0027) are the German firm's
 * invoices to German businesses. Their page, styles, head, table and bank
 * details are the parts this file exports, put together with Germany's
 * billing and words, so that two invoices of one firm cannot drift apart.
 */

type Component = ReportDefinition['regions']['body'][number]
type Inline = Extract<Component, { kind: 'text' }>['content'][number]
type Expression = NonNullable<Component['visibleWhen']>
type TableComponent = Extract<Component, { kind: 'table' }>

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
export const EUR = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } as const
const text = (value: string) => [{ kind: 'text', text: value }] as const
/** A label and a date of the header, as the invoice's head prints it. */
export const dated = (label: string, field: string) => [{ kind: 'text', text: label }, { kind: 'field', field: header(field), format: { kind: 'date', style: 'medium' } }] as const

/** The fields of an address line in the country's order, `between` each: a space, or a comma and a space where a country writes "Calle Mayor, 12". */
const joined = (parts: readonly AddressPart[], between = ' ') => parts.flatMap((part, index) => [...(index === 0 ? [] : [{ kind: 'text', text: between } as const]), { kind: 'field', field: header(part) } as const])

/**
 * The two decimals a whole rate is written as, by its digits and never by
 * a number: the tax's share of the net amount, `0.19`, and the total's
 * factor, `1.19`.
 */
const shares = (rate: WholeRate): readonly [share: string, factor: string] => [`0.${rate}`, `1.${rate}`]

/** The fields of the data that hold the customer's address. */
const ADDRESS_PARTS: readonly string[] = ['street', 'buildingNumber', 'postcode', 'city'] satisfies readonly AddressPart[]

/**
 * Whether the country's invoice prints the field: an address part it
 * leaves out -- Ireland's postcode, as its customer has no Eircode -- is
 * neither in its dataset nor in its data, since a field nothing prints is
 * one the editor warns would be fetched for nothing.
 */
const printsField = (billing: EuroBilling, field: string): boolean => !ADDRESS_PARTS.includes(field) || [...billing.address.street, ...billing.address.town].some((part) => part === field)

/** The line at the head of the invoice: the firm, its address in its country's order, its VAT number, and what else its country asks a company's invoice to say of it. */
export const sender = (billing: EuroBilling, words: EuroWords): Component => ({
  id: 'sender',
  kind: 'text',
  style: 'sender',
  content: text([billing.firm.name, ...billing.firm.address, `${words.vatNumber} ${billing.firm.vatNumber}`, ...(billing.firm.legal ?? [])].join(' · ')),
})

/** The customer's name and address, as the window of an envelope shows them, in the order the country writes the parts of each line. */
export const recipient = (billing: EuroBilling): Component[] => [
  { id: 'customer', kind: 'text', style: 'address', content: [{ kind: 'field', field: header('customer') }] },
  { id: 'street', kind: 'text', style: 'address', content: joined(billing.address.street, billing.address.comma === true ? ', ' : ' ') },
  { id: 'city', kind: 'text', style: 'address', content: joined(billing.address.town) },
]

/** The page every edition prints on. */
export const EURO_PAGE: ReportDefinition['page'] = { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } }

/** The styles every edition prints with. */
export const EURO_STYLES: ReportDefinition['styles'] = [
  { id: 'title', size: 16, bold: true },
  { id: 'address', size: 10 },
  { id: 'grand', size: 10.5, bold: true },
  { id: 'sender', size: 8, color: '#555555' },
  { id: 'heading', size: 10, bold: true },
]

/** The invoice's two datasets, labelled in the country's words: its header, without an address part the country does not print, and its lines. */
function datasets(billing: EuroBilling, labels: EuroWords['labels']): ReportDefinition['datasets'] {
  return {
    header: {
      id: 'invoice',
      fields: (
        [
          { id: 'number', type: 'string', label: labels.number, nullable: false },
          { id: 'issuedOn', type: 'date', label: labels.issuedOn, nullable: false },
          { id: 'servedOn', type: 'date', label: labels.servedOn, nullable: false },
          { id: 'dueOn', type: 'date', label: labels.dueOn, nullable: false },
          { id: 'customer', type: 'string', label: labels.customer, nullable: false },
          { id: 'street', type: 'string', label: labels.street, nullable: false },
          { id: 'buildingNumber', type: 'string', label: labels.buildingNumber, nullable: false },
          { id: 'postcode', type: 'string', label: labels.postcode, nullable: false },
          { id: 'city', type: 'string', label: labels.city, nullable: false },
          { id: 'reference', type: 'string', label: labels.reference, nullable: false },
        ] as const
      ).filter((field) => printsField(billing, field.id)),
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
  }
}

/** The head of the invoice: whom it is from, the customer's address, and the heading over its number and dates. */
function reportHeader(billing: EuroBilling, words: EuroWords): ReportDefinition['regions']['reportHeader'] {
  return [
    sender(billing, words),
    { id: 'sender-gap', kind: 'spacer', height: 12 },
    {
      id: 'addresses',
      kind: 'columns',
      columns: [
        {
          width: 'fill',
          components: recipient(billing),
        },
        {
          width: 190,
          components: [
            { id: 'title', kind: 'text', style: 'title', content: text(words.heading) },
            { id: 'number', kind: 'text', content: [{ kind: 'text', text: words.numberIs }, { kind: 'field', field: header('number') }] },
            { id: 'issued-on', kind: 'text', content: dated(words.issuedOnIs, 'issuedOn') },
            { id: 'served-on', kind: 'text', content: dated(words.servedOnIs, 'servedOn') },
            { id: 'due-on', kind: 'text', content: dated(words.dueOnIs, 'dueOn') },
          ],
        },
      ],
    },
    { id: 'head-gap', kind: 'spacer', height: 18 },
  ]
}

/** The table of the lines it bills, headed in the country's words, and the rows under it, if any. */
export function positions(words: EuroWords, totals: TableComponent['totals']): TableComponent {
  const { columns } = words
  return {
    id: 'positions',
    kind: 'table',
    dataset: 'detail',
    columns: [
      { id: 'article', header: columns[0], width: 96, align: 'left', value: { kind: 'field', field: detail('article') } },
      { id: 'description', header: columns[1], width: 'fill', align: 'left', value: { kind: 'field', field: detail('description') } },
      { id: 'quantity', header: columns[2], width: 50, align: 'right', value: { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 2, grouping: true } } },
      { id: 'unit', header: columns[3], width: 52, align: 'left', value: { kind: 'field', field: detail('unit') } },
      { id: 'unit-price', header: columns[4], width: 76, align: 'right', value: { kind: 'field', field: detail('unitPrice'), format: EUR } },
      { id: 'amount', header: columns[5], width: 84, align: 'right', value: { kind: 'field', field: detail('amount'), format: EUR } },
    ],
    sort: [{ field: detail('article'), direction: 'asc' }],
    ...(totals === undefined ? {} : { totals }),
    emptyText: words.empty,
    repeatHeader: true,
  }
}

/** The rows under the table: its net amount, the tax at the country's rate, and the total. */
function taxTotals(billing: EuroBilling, words: EuroWords, share: string): NonNullable<TableComponent['totals']> {
  return [
    {
      cells: [
        { column: 'article', value: { kind: 'text', text: words.net } },
        { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'report', format: EUR } },
      ],
    },
    {
      cells: [
        { column: 'article', value: { kind: 'text', text: words.vat(billing.rate) } },
        { column: 'amount', value: { kind: 'expression', expression: { cel: `round(totals.subtotal * dec("${share}"), 2)` }, format: EUR } },
      ],
    },
    {
      cells: [
        { column: 'article', value: { kind: 'text', text: words.total } },
        { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: EUR } },
      ],
      style: 'grand',
    },
  ]
}

/**
 * The payment details beside the code that pays the invoice, the code
 * asking for `amount` and the details printing it by `printed`. The
 * heading first and the code at the left of its details: in the design
 * view a container's label sits at its top end and a component's at its
 * top start, so a code at the top of a column at the right end would have
 * its label over the columns' and the block's, which neither a reader nor
 * axe could tell apart.
 */
export function payment(billing: EuroBilling, words: EuroWords, amount: Expression, printed: Inline): Component {
  const { bank } = words
  const { firm, caption } = billing
  return {
    id: 'payment',
    kind: 'keepTogether',
    components: [
      { id: 'bank-heading', kind: 'text', style: 'heading', content: text(bank.heading) },
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
                beneficiary: text(firm.name),
                iban: text(billing.iban),
                bic: text(billing.bic),
                amount,
                reference: [{ kind: 'field', field: header('reference') }],
                information: [{ kind: 'text', text: words.information }, { kind: 'field', field: header('number') }],
                // Last, and only where asked, so that a code without it keeps the keys and the JSON it had.
                ...(caption === undefined ? {} : { caption }),
              },
            ],
          },
          { width: 12, components: [] },
          {
            width: 'fill',
            components: [
              { id: 'paid-to', kind: 'text', content: text(`${bank.paidTo}${firm.name}`) },
              { id: 'paid-iban', kind: 'text', content: text(`${bank.iban}${billing.iban}`) },
              { id: 'paid-bic', kind: 'text', content: text(`${bank.bic}${billing.bic}`) },
              { id: 'paid-amount', kind: 'text', content: [{ kind: 'text', text: bank.amount }, printed] },
              { id: 'paid-reference', kind: 'text', content: [{ kind: 'text', text: bank.reference }, { kind: 'field', field: header('reference') }] },
              { id: 'scan-gap', kind: 'spacer', height: 6 },
              { id: 'scan', kind: 'text', style: 'sender', content: text(bank.scan) },
            ],
          },
        ],
      },
    ],
  }
}

/** Under the table: the terms, the notice its law asks for, and the payment details beside the code that pays it. */
function summary(billing: EuroBilling, words: EuroWords): ReportDefinition['regions']['summary'] {
  const { notice } = words
  return [
    { id: 'summary-gap', kind: 'spacer', height: 12 },
    {
      id: 'terms',
      kind: 'text',
      content: [
        { kind: 'text', text: words.terms[0] },
        { kind: 'field', field: header('dueOn'), format: { kind: 'date', style: 'long' } },
        { kind: 'text', text: words.terms[1] },
      ],
    },
    ...(notice === undefined
      ? []
      : [
          { id: 'terms-gap', kind: 'spacer', height: 6 },
          { id: notice.id, kind: 'text', content: text(notice.text) },
        ] as const),
    { id: 'payment-gap', kind: 'spacer', height: 18 },
    payment(billing, words, { cel: 'totals.total' }, { kind: 'aggregate', aggregate: 'total', over: 'report', format: EUR }),
  ]
}

/** The invoice's report in the country's words, rate and account. */
function report(billing: EuroBilling, words: EuroWords): ReportDefinition {
  const [share, factor] = shares(billing.rate)
  return {
    reportSpecVersion: '0',
    id: billing.id,
    title: words.title,
    locale: billing.locale,
    page: EURO_PAGE,
    styles: EURO_STYLES,
    datasets: datasets(billing, words.labels),
    parameters: [],
    assets: [],
    aggregates: [
      { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
      { id: 'total', fn: 'sum', of: { kind: 'expression', expression: { cel: `row.amount * dec("${factor}")` } }, rounding: { scale: 2, mode: 'half-away-from-zero' } },
    ],
    regions: {
      pageHeader: [],
      reportHeader: reportHeader(billing, words),
      body: [positions(words, taxTotals(billing, words, share))],
      summary: summary(billing, words),
      pageFooter: [],
    },
    provenance: { kind: 'blank' },
  }
}

/** The country's line items, its article numbers up from its first, given in the reverse of the order the report prints them in. */
function lines(billing: EuroBilling, words: EuroWords): Record<string, string>[] {
  return words.items
    .map(([description, unit], index) => {
      const [quantity, unitPrice] = billing.work[index] as readonly [string, string]
      return { article: `${billing.articles.prefix}-${billing.articles.first + index}`, description, quantity, unit, unitPrice, amount: lineAmount(quantity, unitPrice) }
    })
    .reverse()
}

/** The country's data: its header, with its customer and a creditor reference of its number, and its line items. */
function data(billing: EuroBilling, words: EuroWords): ReportData {
  const detail = lines(billing, words)
  const { customer } = billing
  const header = {
    number: billing.number,
    issuedOn: billing.issuedOn,
    servedOn: billing.servedOn,
    dueOn: billing.dueOn,
    customer: customer.name,
    street: customer.street,
    buildingNumber: customer.buildingNumber,
    postcode: customer.postalCode,
    city: customer.town,
    reference: billing.reference,
  }
  return {
    header: Object.fromEntries(Object.entries(header).filter(([field]) => printsField(billing, field))),
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

/**
 * The euro invoice of `country`, with its data. Refused while the country
 * bills another number of lines than its words describe, since a line
 * without its words would be dropped, and its amount from the total.
 */
function euroInvoice(country: EuroCountry): Starter {
  const [billing, words] = [EURO_COUNTRIES[country], EURO_WORDS[country]]
  if (billing.work.length !== words.items.length) throw new Error(`the euro invoice from ${country} bills ${billing.work.length} lines, and its words describe ${words.items.length}`)
  return { id: billing.id, title: words.title, proves: words.proves, report: report(billing, words), data: data(billing, words), parameters: {} }
}

/** The invoice's line items, `H-3001` up, given in the reverse of the order the report prints them in. */
export function euroInvoiceLines(): Record<string, string>[] {
  return lines(EURO_COUNTRIES.DE, EURO_WORDS.DE)
}

/** The invoice: its header, with a creditor reference of its number, and its line items. */
export function euroInvoiceData(): ReportData {
  return data(EURO_COUNTRIES.DE, EURO_WORDS.DE)
}

export const EURO_INVOICE: Starter = euroInvoice('DE')

/** The euro invoice from Austria, in the PSA's frame: a sample, which the Studio's picker does not offer. A sample has a starter's shape. */
export const EURO_INVOICE_AT: Starter = euroInvoice('AT')

/** The euro invoice from France: a sample. */
export const EURO_INVOICE_FR: Starter = euroInvoice('FR')

/** The euro invoice from Italy, a courtesy copy: a sample. */
export const EURO_INVOICE_IT: Starter = euroInvoice('IT')

/** The euro invoice from Spain: a sample. */
export const EURO_INVOICE_ES: Starter = euroInvoice('ES')

/** The euro invoice from the Netherlands: a sample. */
export const EURO_INVOICE_NL: Starter = euroInvoice('NL')

/** The euro invoice from Ireland: a sample. */
export const EURO_INVOICE_IE: Starter = euroInvoice('IE')

/** The euro invoice from Germany, Austria, France, Italy, Spain, the Netherlands and Ireland: the German is the starter, and the others are samples of it. */
export const EURO_INVOICE_SAMPLES: readonly Starter[] = [EURO_INVOICE, EURO_INVOICE_AT, EURO_INVOICE_FR, EURO_INVOICE_IT, EURO_INVOICE_ES, EURO_INVOICE_NL, EURO_INVOICE_IE]
