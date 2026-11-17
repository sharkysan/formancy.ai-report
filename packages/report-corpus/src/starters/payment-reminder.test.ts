import { diagnose } from '@formancy/report-core'
import { checkReport, resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-runtime'
import { reportIn, validateReport } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { starterImages } from './index.js'
import { PAYMENT_REMINDER, paymentReminderAlone, paymentReminderData, paymentReminderItems, REMINDER_EDITIONS } from './payment-reminder.js'
import type { PaymentReminderItem } from './payment-reminder.js'

/**
 * The payment reminder (0066): the firm's reminder of the invoices a
 * customer has not paid, its items -- the invoices, what was received
 * against them and the reminder's fee -- one list printed as two tables
 * picked by their kind (0062), the balance of all of them paid by a Swiss
 * QR-bill at the foot of the last page (0022), under the firm's letterhead
 * on page 1 and a running header from page 2 (0060), written in Swiss
 * German with its words in French, Italian and English, the slip's
 * headings in the language a render names (0063). What is held here is
 * the report and its data; what prints, in each language, is held on the
 * PDF by the renderer's `payment-reminder.test.ts`.
 */

type Component = ReportDefinition['regions']['body'][number]
type Table = Extract<Component, { kind: 'table' }>

const tables = (): Table[] => PAYMENT_REMINDER.report.regions.body.filter((component): component is Table => component.kind === 'table')
const ITEMS = paymentReminderItems()
const of = (...kinds: PaymentReminderItem['kind'][]): PaymentReminderItem[] => ITEMS.filter((item) => kinds.includes(item.kind))
const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
const decimal = (value: bigint): string => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`
const [GERMAN] = REMINDER_EDITIONS

describe('the payment reminder', () => {
  // Two tables over one list, each picking its items by their kind: a
  // table with no condition would print the fee and every payment among
  // the invoices, and a payment picked by both would print twice, each
  // time totalled as that table's own.
  test('prints its items as two tables, the overdue invoices and what was received against them, each picking its kinds', () => {
    expect(tables().map((table) => [table.id, table.rowsWhen?.cel])).toEqual([
      ['overdue', 'row.kind == "invoice"'],
      ['received', 'row.kind == "payment" || row.kind == "credit"'],
    ])
  })

  // Every item is one of four kinds, each kind has items, and the fee is
  // one: an item of a fifth kind would print in no table and still count
  // in the balance the slip asks for, and a second fee would be charged
  // where the page prints one sum for it.
  test('has items of four kinds and of no other, one of them its fee', () => {
    expect([...new Set(ITEMS.map(({ kind }) => kind))].sort()).toEqual(['credit', 'fee', 'invoice', 'payment'])
    expect(of('fee')).toHaveLength(1)
  })

  // An item's amount is what it does to the customer's account, as the
  // ledger books it: an invoice and the fee owed, a payment and a credit
  // received, below zero. The balance is their sum alone; an amount
  // received handed over above zero would be added to what is owed.
  test('books each invoice and the fee as owed and each payment and credit as received', () => {
    expect(of('invoice', 'fee').filter(({ amount }) => cents(amount) <= 0n)).toEqual([])
    expect(of('payment', 'credit').filter(({ amount }) => cents(amount) >= 0n)).toEqual([])
  })

  // Order is only proved by items that arrive out of the order each
  // table prints them in: the invoices by their due date, what was
  // received by its date. Items already in that order would pass a table
  // that never sorted.
  test('arrives out of the order each of its tables prints', () => {
    const due = of('invoice').map(({ dueOn }) => dueOn as string)
    expect(due).not.toEqual([...due].sort())
    const received = of('payment', 'credit').map(({ date }) => date)
    expect(received).not.toEqual([...received].sort())
  })

  // The expression language reads a date as its ISO string and has no
  // arithmetic over dates, so the days overdue are the host's: here held
  // to the reminder's date less each invoice's due date, counted in whole
  // days of the calendar. A count that drifted from the dates would print
  // a number the page's own dates contradict.
  test('counts each invoice’s days overdue from its due date to the reminder’s date', () => {
    const issuedOn = paymentReminderData().header?.['issuedOn'] as string
    const day = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000
    expect(of('invoice').map(({ dueOn, daysOverdue }) => [dueOn, daysOverdue])).toEqual(
      of('invoice').map(({ dueOn }) => [dueOn, String(day(issuedOn) - day(dueOn as string))]),
    )
    expect(of('invoice').filter(({ daysOverdue }) => !/^[1-9][0-9]*$/.test(daysOverdue ?? ''))).toEqual([])
    // Only an invoice is due and overdue; what was received names the invoice it was booked against, and the fee none.
    expect(of('payment', 'credit', 'fee').map(({ invoice, dueOn, daysOverdue }) => [invoice === null, dueOn, daysOverdue])).toEqual(
      of('payment', 'credit', 'fee').map(({ kind }) => [kind === 'fee', null, null]),
    )
    const invoices = new Set(of('invoice').map(({ invoice }) => invoice))
    expect(of('payment', 'credit').filter(({ invoice }) => !invoices.has(invoice))).toEqual([])
  })

  // The bill asks for the balance of every item, the one aggregate the
  // page prints as what is due, computed here in BigInt from the items
  // and not by the runtime: the invoices less what was received, and the
  // fee. Its reference is the reminder's own, made from its number, and
  // its message names it; a bill that asked for the invoices' total, or
  // was booked by an invoice's reference, would be paid as something
  // other than this reminder. The code's text is compared whole, line by
  // line, in SIX's order.
  test('is paid by a QR-bill for the balance of every item, by the reminder’s own reference and message, from the customer', () => {
    const { report } = PAYMENT_REMINDER
    expect(report.paymentPart?.amount).toEqual({ cel: 'totals.balance' })
    const outcome = resolveReport(report, paymentReminderData(), { mode: 'final', parameters: {}, images: starterImages, creationDate: '2026-11-17T08:00:00Z' })
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
    const balance = ITEMS.reduce((sum, item) => sum + cents(item.amount), 0n)
    expect(outcome.document.paymentPart?.payload.split('\n')).toEqual([
      ...['SPC', '0200', '1', 'CH4431999123000889012'],
      ...['S', 'Formancy Haustechnik AG', 'Industriestrasse', '7', '3052', 'Zollikofen', 'CH'],
      ...['', '', '', '', '', '', ''],
      ...[decimal(balance), 'CHF'],
      ...['S', 'Schreinerei Keller GmbH', 'Bahnhofstrasse', '24', '3123', 'Belp', 'CH'],
      ...['QRR', '000000000000000000202600949', 'Mahnung M-2026-0094', 'EPD'],
    ])
    expect(outcome.document.paymentPart?.reference).toBe('00 00000 00000 00000 02026 00949')
  })

  // A reminder whose items leave nothing due has no bill to print: SIX's
  // amount runs from 0.01, and the runtime refuses the render rather than
  // print a slip for nothing or for a credit, which the record and the
  // register name as a cost a host meets. One cent due still prints, so
  // the line is the bill's own rule and not a margin of the starter's.
  test.each([
    ['one cent due', '-3207.29', true],
    ['nothing due', '-3207.30', false],
    ['more received than owed', '-3300.00', false],
  ] as const)('with %s, is %s printed', (_case, payment, prints) => {
    const items = [...ITEMS, { kind: 'payment', invoice: 'R-2026-0673', date: '2026-11-16', dueOn: null, daysOverdue: null, amount: payment } as const]
    const outcome = resolveReport(PAYMENT_REMINDER.report, paymentReminderData(items), {
      mode: 'final',
      parameters: {},
      images: starterImages,
      creationDate: '2026-11-17T08:00:00Z',
    })
    expect(outcome.ok ? 'printed' : outcome.errors.map(({ code, path }) => `${code} ${path}`)).toEqual(
      prints ? 'printed' : ['invalid-qr-bill /paymentPart/amount'],
    )
  })

  // No items at all leave nothing due either, and are refused alike.
  test('with no items, is refused for its bill', () => {
    const outcome = resolveReport(PAYMENT_REMINDER.report, paymentReminderData([]), {
      mode: 'final',
      parameters: {},
      images: starterImages,
      creationDate: '2026-11-17T08:00:00Z',
    })
    expect(outcome.ok ? 'printed' : outcome.errors.map(({ code, path }) => `${code} ${path}`)).toEqual(['invalid-qr-bill /paymentPart/amount'])
  })

  // Page 1 prints the firm's letterhead in its own header, and page 2 on
  // a slim running header that names the reminder and the customer
  // (0060): a running header on page 1 would print above the letterhead,
  // and a letterhead in the page header would print on every page.
  test('prints its letterhead on page 1 alone, and a running header that names the reminder from page 2', () => {
    const { regions } = PAYMENT_REMINDER.report
    expect(regions.firstPageHeader?.map(({ id }) => id)).toEqual(['logo', 'logo-gap', 'sender'])
    const runs = regions.pageHeader.flatMap((component) => (component.kind === 'text' ? component.content : []))
    expect(runs).toEqual(
      expect.arrayContaining([
        { kind: 'field', field: { dataset: 'header', field: 'number' } },
        { kind: 'field', field: { dataset: 'header', field: 'customer' } },
      ]),
    )
  })

  // It is the reminder written in Swiss German, its words written in three
  // languages more, the one column whose words an expression prints among
  // them: one that had drifted from the German reminder would prove, in
  // French, a report nobody opens.
  test('is the German reminder, with a translation for French, Italian and English, its one expression of words among them', () => {
    const { translations, ...report } = PAYMENT_REMINDER.report
    expect(report).toEqual(paymentReminderAlone(GERMAN!))
    expect([report.locale, translations?.map(({ locale }) => locale)]).toEqual(['de-CH', ['fr-CH', 'it-CH', 'en-CH']])
    expect(translations?.map(({ expressions }) => expressions.map(({ cel }) => cel))).toEqual([
      ['row.kind == "credit" ? "Gutschrift" : "Zahlung"'],
      ['row.kind == "credit" ? "Gutschrift" : "Zahlung"'],
      ['row.kind == "credit" ? "Gutschrift" : "Zahlung"'],
    ])
    // Each language's expression is stated, as the German one is: the
    // renderer's test reads the page against the same words, so a language
    // whose credit note and payment were swapped would pass it, printing a
    // payment as a credit note.
    expect(translations?.map(({ expressions }) => expressions.map(({ expression }) => expression.cel))).toEqual([
      ['row.kind == "credit" ? "Note de crédit" : "Paiement"'],
      ['row.kind == "credit" ? "Nota di credito" : "Pagamento"'],
      ['row.kind == "credit" ? "Credit note" : "Payment"'],
    ])
    expect(REMINDER_EDITIONS.map(({ locale }) => locale)).toEqual(['de-CH', 'fr-CH', 'it-CH', 'en-CH'])
  })

  // Every word the reminder prints differs from the German in each of its
  // other languages, the sender's line by its word for VAT and the
  // column's expression by its two words: a German word copied into a
  // translation would print on that language's page as the language's
  // own, where the renderer's test, which reads the page against the same
  // words, could not tell it from a translation.
  test('writes each of its words anew in every other language, none of them left in German', () => {
    const left = (PAYMENT_REMINDER.report.translations ?? []).flatMap(({ locale, words, expressions }) => [
      ...words.filter(({ word, text }) => word === text).map(({ word }) => `${locale} ${word}`),
      ...expressions.filter(({ cel, expression }) => cel === expression.cel).map(({ cel }) => `${locale} ${cel}`),
    ])
    expect(left).toEqual([])
  })

  // Every language is whole: a word left out of one would refuse the
  // Studio's Preview in that language, and the renderer's test would be
  // refused, or held to a page with a German word on it, rather than
  // proving a French reminder. The one warning is the starters' own: its
  // bill pays SIX's example QR-IBAN, as the invoice's does (0039).
  test('is valid, and whole in every language it declares', () => {
    expect(validateReport(PAYMENT_REMINDER.report).valid).toBe(true)
    expect(diagnose(PAYMENT_REMINDER.report).map((found) => `${found.severity} ${found.code} ${found.path}`)).toEqual([
      'warning example-payment-part /paymentPart',
    ])
    expect(REMINDER_EDITIONS.map(({ locale }) => checkReport(PAYMENT_REMINDER.report, locale).ok)).toEqual([true, true, true, true])
  })

  // Written in a language, it is that language's reminder alone, word for
  // word and nothing else, its slip's language that locale's (0063): a
  // translation that changed anything but a word, or a slip left in
  // German on a French reminder, shows here before any PDF.
  test.each(REMINDER_EDITIONS.map((edition) => [edition.locale, edition] as const))(
    'written in %s, is the same reminder written in it alone, its slip in that language',
    (locale, edition) => {
      const written = reportIn(PAYMENT_REMINDER.report, locale)
      expect(written).toEqual(paymentReminderAlone(edition))
      expect(written.paymentPart?.language).toBe(locale.slice(0, 2))
    },
  )

  // Data prints as the host hands it over, in whatever language it was
  // written (0063): so the reminder's data is dates, numbers, amounts, the
  // customer's name and address, the reminder's and the invoices' numbers,
  // a reference and each item's kind, which no language translates and
  // only its tables' conditions and its one expression read. A word in the
  // data would print in German on the French reminder.
  test('reads data no language translates', () => {
    const { datasets } = PAYMENT_REMINDER.report
    const strings = (fields: readonly { id: string; type: string }[] = []): string[] => fields.filter(({ type }) => type === 'string').map(({ id }) => id)
    expect([strings(datasets.header?.fields), strings(datasets.detail?.fields)]).toEqual([
      ['number', 'customer', 'street', 'buildingNumber', 'postcode', 'city', 'reference'],
      ['kind', 'invoice'],
    ])
  })
})
