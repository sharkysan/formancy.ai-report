import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { sender } from './invoice.js'
import { GERMAN } from './invoice-words.js'
import { LETTERHEAD, LOGO_ASSET } from './logo.js'
import { ENGLISH_REMINDER, FRENCH_REMINDER, GERMAN_REMINDER, ITALIAN_REMINDER } from './payment-reminder-words.js'
import type { ReminderWords } from './payment-reminder-words.js'
import type { Starter } from './starter.js'

/**
 * The payment reminder, "Mahnung" (0066): the firm reminds a customer of
 * the invoices it has not paid, in Swiss francs, written in Swiss German
 * with its words in French, Italian and English, so that a render in the
 * customer's language prints it whole, the slip's headings in SIX's words
 * for that language (0063). It proves:
 * - **several tables over one list of items** (0062): the customer's open
 *   items, as the firm's ledger holds them, and two tables that pick theirs
 *   by its `kind` -- the overdue invoices, each with its date, its due
 *   date and its days overdue, and the payments and credit notes received
 *   against them -- each with its own total;
 * - **one balance, paid by a Swiss QR-bill** (0022): every item's amount
 *   as the ledger books it, an invoice and the reminder's fee owed, a
 *   payment and a credit below zero, summed once by one aggregate, which
 *   the page prints as what is due and the bill asks for, by the
 *   reminder's own QR reference and with its number as the message;
 * - **page 1's own header** (0060): the firm's letterhead on page 1, and a
 *   slim running header that names the reminder from page 2, where a
 *   reminder of more invoices runs on to it; its own data fits page 1 with
 *   the slip at its foot, as a reminder of one sheet does.
 *
 * The fee is an item of the list, as the ledger books it, so that the one
 * aggregate holds it, and the summary prints it by an aggregate of its
 * own. Each invoice's days overdue are the host's, counted from its due
 * date to the reminder's: the expression language reads a date as its
 * ISO string and has no arithmetic over dates. What a payment and a credit
 * note are called is an expression over the item's kind, written in each
 * language, so that the data holds no word.
 *
 * The firm is the invoices' (0032), and the account SIX's example QR-IBAN
 * (IG 2.4, Annex A), which no bank books; the customer, its invoices and
 * what it paid are invented. The reference is made from the reminder's
 * number, with the check digit IG Annex B computes.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const
const DAY = { kind: 'date', style: 'medium' } as const
const text = (value: string) => ({ kind: 'text', text: value }) as const
const balance = (over: 'report' | 'table') => ({ kind: 'aggregate', aggregate: 'balance', over, format: CHF }) as const

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

/** What the column of what was received prints for an item: a credit note's word, or a payment's, in `words`' language. */
const kindOf = (words: ReminderWords): string => `row.kind == "credit" ? ${JSON.stringify(words.kinds[0])} : ${JSON.stringify(words.kinds[1])}`

/** A line under the tables, right-aligned: its label, then its amount. */
const sum = (id: string, label: string, value: Extract<Component, { kind: 'text' }>['content'][number], style = 'sum'): Component => ({
  id,
  kind: 'text',
  style,
  content: [text(label), value],
})

/** The firm the reminder is from: the invoices' firm, in Zollikofen. */
const FIRM = GERMAN.creditor

/** The reminder written in `words`' language alone, with no translations. */
function reminder(words: ReminderWords): ReportDefinition {
  const [invoice, date, dueOn, days, amount] = words.columns
  return {
    reportSpecVersion: '0',
    id: 'payment-reminder',
    title: words.title,
    locale: words.locale,
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
    styles: [
      { id: 'sender', size: 8, color: '#555555' },
      { id: 'title', size: 16, bold: true },
      { id: 'address', size: 10 },
      { id: 'small', size: 8, color: '#555555' },
      { id: 'heading', size: 11, bold: true },
      { id: 'strong', bold: true },
      { id: 'sum', align: 'right' },
      { id: 'grand', size: 10.5, bold: true, align: 'right' },
    ],
    datasets: {
      header: {
        id: 'reminder',
        fields: [
          { id: 'number', type: 'string', label: 'Nummer', nullable: false },
          { id: 'issuedOn', type: 'date', label: 'Datum', nullable: false },
          { id: 'remindedOn', type: 'date', label: 'Zahlungserinnerung vom', nullable: false },
          { id: 'payBy', type: 'date', label: 'Zahlbar bis', nullable: false },
          { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
          { id: 'street', type: 'string', label: 'Strasse', nullable: false },
          { id: 'buildingNumber', type: 'string', label: 'Hausnummer', nullable: false },
          { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
          { id: 'city', type: 'string', label: 'Ort', nullable: false },
          { id: 'reference', type: 'string', label: 'QR-Referenz', nullable: false },
        ],
      },
      detail: {
        id: 'open-items',
        fields: [
          { id: 'kind', type: 'string', label: 'Art', nullable: false },
          { id: 'invoice', type: 'string', label: 'Rechnung', nullable: true },
          { id: 'date', type: 'date', label: 'Datum', nullable: false },
          { id: 'dueOn', type: 'date', label: 'Fällig am', nullable: true },
          { id: 'daysOverdue', type: 'integer', label: 'Tage überfällig', nullable: true },
          { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
        ],
      },
    },
    parameters: [],
    assets: [LOGO_ASSET],
    aggregates: [
      { id: 'balance', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
      { id: 'fee', fn: 'sum', of: { kind: 'expression', expression: { cel: 'row.kind == "fee" ? row.amount : dec("0")' } } },
    ],
    regions: {
      firstPageHeader: [...LETTERHEAD, { id: 'sender', kind: 'text', style: 'sender', content: [text(sender(FIRM, words.vatNumber))] }],
      pageHeader: [
        {
          id: 'running-head',
          kind: 'text',
          style: 'small',
          content: [text(words.reminderIs), { kind: 'field', field: header('number') }, text(' · '), { kind: 'field', field: header('customer') }],
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
                {
                  id: 'street',
                  kind: 'text',
                  style: 'address',
                  content: [{ kind: 'field', field: header('street') }, text(' '), { kind: 'field', field: header('buildingNumber') }],
                },
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
                { id: 'title', kind: 'text', style: 'title', content: [text(words.title)] },
                { id: 'number', kind: 'text', content: [text(words.numberIs), { kind: 'field', field: header('number') }] },
                { id: 'issued-on', kind: 'text', content: [text(words.issuedOnIs), { kind: 'field', field: header('issuedOn'), format: DAY }] },
              ],
            },
          ],
        },
        { id: 'head-gap', kind: 'spacer', height: 18 },
      ],
      body: [
        {
          id: 'intro',
          kind: 'text',
          content: [text(words.intro[0]), { kind: 'field', field: header('remindedOn'), format: { kind: 'date', style: 'long' } }, text(words.intro[1])],
        },
        { id: 'intro-gap', kind: 'spacer', height: 12 },
        // Not kept with its table: the renderer moves a heading kept with a
        // table that runs past its page to the next page with the whole
        // table (0064), which a reminder of more invoices meets. It stands
        // near the top of page 1's body, so no page ends under it.
        { id: 'overdue-heading', kind: 'text', style: 'heading', content: [text(words.overdue)] },
        {
          id: 'overdue',
          kind: 'table',
          dataset: 'detail',
          rowsWhen: { cel: 'row.kind == "invoice"' },
          columns: [
            column('invoice', invoice, 'fill', 'left', { kind: 'field', field: detail('invoice') }),
            column('date', date, 70, 'left', { kind: 'field', field: detail('date'), format: DAY }),
            column('due-on', dueOn, 70, 'left', { kind: 'field', field: detail('dueOn'), format: DAY }),
            column('days', days, 44, 'right', { kind: 'field', field: detail('daysOverdue'), format: { kind: 'number', scale: 0, grouping: true } }),
            column('amount', amount, 92, 'right', { kind: 'field', field: detail('amount'), format: CHF }),
          ],
          sort: [{ field: detail('dueOn'), direction: 'asc' }],
          totals: [
            {
              cells: [
                { column: 'invoice', value: text(words.overdueTotal) },
                { column: 'amount', value: balance('table') },
              ],
              style: 'strong',
            },
          ],
          emptyText: words.noOverdue,
          repeatHeader: true,
        },
        { id: 'received-gap', kind: 'spacer', height: 12 },
        { id: 'received-heading', kind: 'text', style: 'heading', content: [text(words.received)], keepWithNext: true },
        {
          id: 'received',
          kind: 'table',
          dataset: 'detail',
          rowsWhen: { cel: 'row.kind == "payment" || row.kind == "credit"' },
          columns: [
            column('kind', words.kind, 'fill', 'left', { kind: 'expression', expression: { cel: kindOf(words) } }),
            column('date', date, 70, 'left', { kind: 'field', field: detail('date'), format: DAY }),
            column('invoice', invoice, 114, 'left', { kind: 'field', field: detail('invoice') }),
            column('amount', amount, 92, 'right', { kind: 'field', field: detail('amount'), format: CHF }),
          ],
          sort: [{ field: detail('date'), direction: 'asc' }],
          totals: [
            {
              cells: [
                { column: 'kind', value: text(words.receivedTotal) },
                { column: 'amount', value: balance('table') },
              ],
              style: 'strong',
            },
          ],
          emptyText: words.noReceived,
          repeatHeader: true,
        },
      ],
      summary: [
        { id: 'summary-gap', kind: 'spacer', height: 12 },
        sum('fee', words.fee, { kind: 'aggregate', aggregate: 'fee', over: 'report', format: CHF }),
        sum('due', words.due, balance('report'), 'grand'),
        { id: 'terms-gap', kind: 'spacer', height: 12 },
        {
          id: 'terms',
          kind: 'text',
          content: [text(words.terms[0]), { kind: 'field', field: header('payBy'), format: { kind: 'date', style: 'long' } }, text(words.terms[1])],
        },
      ],
      pageFooter: [],
    },
    paymentPart: {
      kind: 'swissQrBill',
      language: words.language,
      account: [text('CH44 3199 9123 0008 8901 2')],
      creditor: {
        name: [text(FIRM.name)],
        street: [text(FIRM.street)],
        buildingNumber: [text(FIRM.buildingNumber)],
        postalCode: [text(FIRM.postalCode)],
        town: [text(FIRM.town)],
        country: [text('CH')],
      },
      currency: 'CHF',
      amount: { cel: 'totals.balance' },
      debtor: {
        name: [{ kind: 'field', field: header('customer') }],
        street: [{ kind: 'field', field: header('street') }],
        buildingNumber: [{ kind: 'field', field: header('buildingNumber') }],
        postalCode: [{ kind: 'field', field: header('postcode') }],
        town: [{ kind: 'field', field: header('city') }],
        country: [text('CH')],
      },
      reference: [{ kind: 'field', field: header('reference') }],
      message: [text(words.reminderIs), { kind: 'field', field: header('number') }],
    },
    provenance: { kind: 'blank' },
  }
}

/** The editions the reminder is written in, its own language first. */
export const REMINDER_EDITIONS: readonly ReminderWords[] = [GERMAN_REMINDER, FRENCH_REMINDER, ITALIAN_REMINDER, ENGLISH_REMINDER]

/** Every word the reminder prints in `words`' language, in the order the report holds them: the same places in every language. */
const wordsOf = (words: ReminderWords): readonly string[] => [
  words.title,
  sender(FIRM, words.vatNumber),
  words.reminderIs,
  words.numberIs,
  words.issuedOnIs,
  ...words.intro,
  words.overdue,
  ...words.columns,
  words.overdueTotal,
  words.noOverdue,
  words.received,
  words.kind,
  words.receivedTotal,
  words.noReceived,
  words.fee,
  words.due,
  ...words.terms,
]

type Translation = NonNullable<ReportDefinition['translations']>[number]

/**
 * The reminder's German words written in `words`' language: each German
 * word once, as a translation keys it (0063), and the expression that
 * names what was received. A word that stands in two places -- the title
 * is the heading too, and "Mahnung " heads the running header and the
 * slip's message -- is one word, and is refused here if two places would
 * need two translations of it.
 */
function translation(words: ReminderWords): Translation {
  const own = wordsOf(GERMAN_REMINDER)
  const translated = new Map<string, string>()
  wordsOf(words).forEach((written, index) => {
    const word = own[index] as string
    const known = translated.get(word)
    if (known !== undefined && known !== written) throw new Error(`the reminder's ${JSON.stringify(word)} stands where ${words.locale} writes it two ways`)
    translated.set(word, written)
  })
  return {
    locale: words.locale,
    words: [...translated].map(([word, written]) => ({ word, text: written })),
    expressions: [{ cel: kindOf(GERMAN_REMINDER), expression: { cel: kindOf(words) } }],
  }
}

/** The reminder written in `words`' language alone, with no translations: what a render of the starter in that locale prints. */
export const paymentReminderAlone = (words: ReminderWords): ReportDefinition => reminder(words)

/** One item of the customer's account as the provider gives it: what it is, the invoice it belongs to, its date, an invoice's due date and days overdue, and its amount, below zero where it was received. */
export interface PaymentReminderItem {
  readonly kind: 'invoice' | 'payment' | 'credit' | 'fee'
  readonly invoice: string | null
  readonly date: string
  readonly dueOn: string | null
  readonly daysOverdue: string | null
  readonly amount: string
}

const invoiceItem = (invoice: string, date: string, dueOn: string, daysOverdue: string, amount: string): PaymentReminderItem => ({
  kind: 'invoice',
  invoice,
  date,
  dueOn,
  daysOverdue,
  amount,
})
const received = (kind: 'payment' | 'credit', invoice: string, date: string, amount: string): PaymentReminderItem => ({
  kind,
  invoice,
  date,
  dueOn: null,
  daysOverdue: null,
  amount,
})

/**
 * The customer's open items on the reminder's day, 17 November 2026, in
 * the order the ledger lists them -- as each was booked, which is neither
 * by kind, by due date nor by date -- so that only the tables'
 * conditions and sorts put them where they print: four invoices past
 * their due date, two payments and a credit note against three of them,
 * and the reminder's fee. Each invoice was due before the earlier
 * reminder of 20 October.
 */
export function paymentReminderItems(): PaymentReminderItem[] {
  return [
    invoiceItem('R-2026-0614', '2026-08-21', '2026-09-20', '58', '486.35'),
    received('payment', 'R-2026-0582', '2026-09-25', '-1000.00'),
    invoiceItem('R-2026-0673', '2026-09-15', '2026-10-15', '33', '129.70'),
    invoiceItem('R-2026-0582', '2026-08-04', '2026-09-03', '75', '1842.60'),
    received('payment', 'R-2026-0659', '2026-10-30', '-500.00'),
    invoiceItem('R-2026-0659', '2026-09-08', '2026-10-08', '40', '2315.00'),
    received('credit', 'R-2026-0614', '2026-10-02', '-86.35'),
    { kind: 'fee', invoice: null, date: '2026-11-17', dueOn: null, daysOverdue: null, amount: '20.00' },
  ]
}

/** The reminder's data: its header, the customer's address and the reminder's own QR reference, and `items`, the starter's own unless a test hands others. */
export function paymentReminderData(items: readonly PaymentReminderItem[] = paymentReminderItems()): ReportData {
  const detail = items.map((item) => ({ ...item }))
  return {
    header: {
      number: 'M-2026-0094',
      issuedOn: '2026-11-17',
      remindedOn: '2026-10-20',
      payBy: '2026-11-27',
      customer: 'Schreinerei Keller GmbH',
      street: 'Bahnhofstrasse',
      buildingNumber: '24',
      postcode: '3123',
      city: 'Belp',
      reference: '000000000000000000202600949',
    },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'host-captured',
  }
}

export const PAYMENT_REMINDER: Starter = {
  id: 'payment-reminder',
  title: 'Mahnung',
  proves:
    'two tables over one list of open items, the overdue invoices and what was received against them, each picking its kinds; the balance of every item, the fee among them, paid by a Swiss QR-bill in the language a render names; and a letterhead on page 1 in place of the running header a longer reminder prints from page 2',
  report: { ...reminder(GERMAN_REMINDER), translations: [FRENCH_REMINDER, ITALIAN_REMINDER, ENGLISH_REMINDER].map(translation) },
  data: paymentReminderData(),
  parameters: {},
}
