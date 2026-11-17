import {
  inflatedDigest,
  PAYMENT_REMINDER,
  paymentReminderAlone,
  paymentReminderData,
  paymentReminderItems,
  readCodes,
  readPdf,
  readPdfObjects,
  REMINDER_EDITIONS,
  starterImages,
  verify,
  type PaymentReminderItem,
  type ReadPdf,
  type ReminderWords,
} from '@formancy/report-corpus'
import { QR_BILL_TOP, resolveReport, type ReportData, type ReportDefinition, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { expectation, fixtureOf, normalise, TIMEOUT, type Stated } from './testing/documents.js'
import { crowding, MARGIN, markAt, marksOn } from './testing/letterhead.js'
import { pageLines } from './testing/lines.js'

/**
 * The payment reminder starter (0066), end to end, in each language it is
 * written in (0063): resolved by the runtime in that locale, rendered by
 * pdfmake and proved on the PDF it produced, read back with PDF.js (0003).
 * What each of its two tables prints is proved apart from the runtime:
 * its items picked by their kind and ordered here from the data (0062),
 * every total and what is due recomputed in plain BigInt and formatted
 * with Intl for the locale. The slip's code is decoded by ZXing from the
 * pixels PDF.js draws (0020), and its headings, which are SIX's (IG Annex
 * C), are stated here, not read from the corpus (0022). Its pages are
 * proved by where their lines and the firm's mark stand: the letterhead
 * on page 1 alone, and, for a reminder of more invoices, the running
 * header from page 2 and the slip at the foot of the last page (0060).
 */

const CREATED = '2026-11-17T08:00:00Z'
const NUMBER = 'M-2026-0094'
const REFERENCE = '000000000000000000202600949'
const SENDER = 'Formancy Haustechnik AG · Industriestrasse 7 · 3052 Zollikofen · CHE-123.456.789'

/** SIX's two headings of the slip, in each language the reminder is written in (IG Annex C). */
const HEADINGS: Readonly<Record<string, readonly [receipt: string, paymentPart: string]>> = {
  'de-CH': ['Empfangsschein', 'Zahlteil'],
  'fr-CH': ['Récépissé', 'Section paiement'],
  'it-CH': ['Ricevuta', 'Sezione pagamento'],
  'en-CH': ['Receipt', 'Payment part'],
}

const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
/** Cents as the exact decimal string they are, below zero with its sign. */
const decimal = (value: bigint): string => {
  const size = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${size / 100n}.${String(size % 100n).padStart(2, '0')}`
}
const sum = (items: readonly PaymentReminderItem[]): bigint => items.reduce((total, item) => total + cents(item.amount), 0n)

/** An amount in Swiss francs as Intl prints it for `locale`, handed the exact decimal string, with its spaces as a PDF line has them. */
const francs = (locale: string, value: bigint): string =>
  normalise(
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      decimal(value) as Intl.StringNumericLiteral,
    ),
  )
/** A whole number as Intl prints it for `locale`, handed its digits. */
const count = (locale: string, digits: string): string => normalise(new Intl.NumberFormat(locale).format(digits as Intl.StringNumericLiteral))
/** A day as Intl writes it for `locale`, long or medium. */
const day = (locale: string, iso: string, style: 'long' | 'medium'): string =>
  normalise(new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)))
/** An amount as SIX's slip prints it: a space between thousands, a point and two places (IG 3.5.3). */
const slipAmount = (value: bigint): string => decimal(value).replace(/\B(?=(\d{3})+\.)/g, ' ')

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const of = (items: readonly PaymentReminderItem[], ...kinds: PaymentReminderItem['kind'][]): PaymentReminderItem[] =>
  items.filter((item) => kinds.includes(item.kind))

/**
 * Every line from the overdue invoices' heading down to what is due, in
 * `words`' language, for `items`: the invoices by their due date, each
 * with its dates as the locale writes them, its days overdue and its
 * amount, closed by their total; what was received by its date, a credit
 * note's word or a payment's, closed by its total; then the fee and what
 * is due, the balance of every item.
 */
function reminderLines(words: ReminderWords, items: readonly PaymentReminderItem[]): string[] {
  const { locale } = words
  const [invoice, date, dueOn, days, amount] = words.columns
  const overdue = of(items, 'invoice').sort((a, b) => byCodeUnit(a.dueOn as string, b.dueOn as string))
  const received = of(items, 'payment', 'credit').sort((a, b) => byCodeUnit(a.date, b.date))
  return [
    words.overdue,
    `${invoice} ${date} ${dueOn} ${days} ${amount}`,
    ...overdue.map(
      (each) =>
        `${each.invoice} ${day(locale, each.date, 'medium')} ${day(locale, each.dueOn as string, 'medium')} ${count(locale, each.daysOverdue as string)} ${francs(locale, cents(each.amount))}`,
    ),
    `${words.overdueTotal} ${francs(locale, sum(overdue))}`,
    words.received,
    `${words.kind} ${date} ${invoice} ${amount}`,
    ...received.map(
      (each) =>
        `${each.kind === 'credit' ? words.kinds[0] : words.kinds[1]} ${day(locale, each.date, 'medium')} ${each.invoice} ${francs(locale, cents(each.amount))}`,
    ),
    `${words.receivedTotal} ${francs(locale, sum(received))}`,
    `${words.fee}${francs(locale, sum(of(items, 'fee')))}`,
    `${words.due}${francs(locale, sum(items))}`,
  ].map(normalise)
}

/** `report` resolved against `data` in `locale`, where one is named, failing the test with the errors when it is refused. */
function resolved(report: ReportDefinition, data: ReportData, locale?: string): ResolvedDocument {
  const outcome = resolveReport(report, data, {
    mode: 'final',
    parameters: {},
    images: starterImages,
    creationDate: CREATED,
    ...(locale === undefined ? {} : { locale }),
  })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

interface Printed {
  readonly document: ResolvedDocument
  readonly bytes: Uint8Array
  readonly pdf: ReadPdf
}

/** The starter printed in `locale` from `items`, drawn once for every test that reads it. */
const printings = new Map<string, Promise<Printed>>()
function printed(locale: string, items: readonly PaymentReminderItem[] = paymentReminderItems(), key = locale): Promise<Printed> {
  let found = printings.get(key)
  if (found === undefined) {
    found = (async () => {
      const document = resolved(PAYMENT_REMINDER.report, paymentReminderData(items), locale)
      const bytes = await renderPdf(document, { maxPages: 20 })
      return { document, bytes, pdf: await readPdf(bytes) }
    })()
    printings.set(key, found)
  }
  return found
}

/** Each page's lines, top to bottom. */
const linesOn = (pdf: ReadPdf): string[][] => pdf.pages.map((page) => pageLines(page).map((line) => line.text))

/**
 * The PDF with every run of the slip and of the instruction over it taken
 * off its last page, which the slip's foot is: the pages the corpus's
 * layout checks read, the slip being drawn across the paper, past the
 * margins (0022), 10.24 pt under the instruction.
 */
const aboveSlip = (pdf: ReadPdf): ReadPdf => ({
  ...pdf,
  pages: pdf.pages.map((page, index) =>
    index < pdf.pages.length - 1 ? page : { ...page, items: page.items.filter((item) => item.bottom < QR_BILL_TOP - 10.24) },
  ),
})

/**
 * What the corpus's checks hold `document`'s `pages` pages to, derived
 * from it, each table row known by its first two cells: an invoice's
 * number stands in both tables, and a kind's word begins every row of
 * the second, so neither alone is a key the page prints once.
 */
function stated(document: ResolvedDocument, pages: number): Stated {
  const derived = expectation(document, { maxPagesExpected: pages })
  const tables = derived.tables.map((table) => ({
    ...table,
    rows: table.rows.map((row) =>
      row.key === ''
        ? row
        : {
            ...row,
            key: row.cells
              .slice(0, 2)
              .map(({ text }) => text)
              .join(' '),
          },
    ),
  }))
  return { minPagesExpected: pages, maxPagesExpected: pages, tables, keys: tables.flatMap(({ rows }) => rows.flatMap(({ key }) => (key === '' ? [] : [key]))) }
}

/** The words of `words` the reminder prints as whole words on one line: its labels, headings and totals, the sentences aside, which wrap where their language does. */
const ownWords = (words: ReminderWords): string[] =>
  [
    words.title,
    words.vatNumber,
    words.overdue,
    ...words.columns,
    words.overdueTotal,
    words.received,
    words.kind,
    ...words.kinds,
    words.receivedTotal,
    words.fee,
    words.due,
  ].map((each) => normalise(each).trim())

const [GERMAN] = REMINDER_EDITIONS as [ReminderWords, ...ReminderWords[]]
const languages = REMINDER_EDITIONS.map((words) => [words.locale, words] as const)

describe('the payment reminder, printed in each of its languages', () => {
  // A render in a translation's locale is a reminder a reader of that
  // language pays from: both tables line by line, each picking its kinds,
  // in its order and closed by its own total, the fee and what is due
  // recomputed here from the items; the sentences, the title and the
  // reminder's number; the slip's headings in its language and no
  // other's; and the code, decoded from the page's pixels, asking for
  // exactly what the page says is due, by the reminder's reference and
  // with its message in that language, the slip printing that amount on
  // the receipt and the payment part. A German word left at one place, an
  // amount formatted in German, a table that printed every item, or a slip
  // still in German would each print a French reminder that is half
  // German, or one that asks for another amount than it states.
  test.each(languages)(
    'prints in %s both tables line by line, what is due, and a slip in that language that asks for it',
    async (locale, words) => {
      const { document, bytes, pdf } = await printed(locale)
      expect(pdf.pages).toHaveLength(1)
      const lines = linesOn(pdf)[0] ?? []
      const expected = reminderLines(words, paymentReminderItems())
      const start = lines.indexOf(expected[0] as string)
      expect(lines.slice(start, start + expected.length)).toEqual(expected)
      const header = paymentReminderData().header as Readonly<Record<string, string>>
      expect(lines).toEqual(
        expect.arrayContaining([
          normalise(`${SENDER} ${words.vatNumber}`),
          normalise(words.title),
          normalise(`${words.numberIs}${NUMBER}`),
          normalise(`${words.issuedOnIs}${day(locale, header['issuedOn'] as string, 'medium')}`),
        ]),
      )
      const text = ` ${lines.join(' ')} `
      expect(text).toContain(normalise(`${words.intro[0]}${day(locale, header['remindedOn'] as string, 'long')}${words.intro[1]}`))
      expect(text).toContain(normalise(`${words.terms[0]}${day(locale, header['payBy'] as string, 'long')}${words.terms[1]}`))
      expect((await readPdfObjects(bytes)).info['Title']).toBe(words.title)

      const texts = new Set(pdf.pages[0]?.items.map((item) => item.text))
      expect((HEADINGS[locale] ?? []).filter((heading) => !texts.has(heading))).toEqual([])
      const others = Object.entries(HEADINGS).flatMap(([other, headings]) => (other === locale ? [] : headings))
      expect(others.filter((heading) => texts.has(heading))).toEqual([])

      const due = sum(paymentReminderItems())
      const codes = await readCodes(bytes, 1)
      expect(codes.map((code) => code.text)).toEqual([document.paymentPart?.payload])
      const payload = codes[0]?.text.split('\n') ?? []
      expect([payload.slice(18, 20), payload.slice(27, 30)]).toEqual([
        [decimal(due), 'CHF'],
        ['QRR', REFERENCE, `${words.reminderIs}${NUMBER}`],
      ])
      expect(pdf.pages[0]?.items.filter((item) => item.text === slipAmount(due))).toHaveLength(2)
    },
    TIMEOUT,
  )

  // None of the reminder's own German that differs from the language's
  // words prints on its page: a German label, heading or total left at
  // one place would be read by a French customer as the firm's mistake.
  test.each(languages.filter(([locale]) => locale !== GERMAN.locale))(
    'prints in %s none of the German words that differ from its own',
    async (locale, words) => {
      const { pdf } = await printed(locale)
      const own = new Set(ownWords(words))
      const lines = linesOn(pdf).flat()
      const prints = (word: string): boolean => lines.some((line) => ` ${line} `.includes(` ${word} `))
      expect(ownWords(GERMAN).filter((word) => !own.has(word) && prints(word))).toEqual([])
    },
    TIMEOUT,
  )

  // The layout, by the corpus's checks over the document the runtime
  // resolved in that language: every row of both tables once and in its
  // place, under its table's header, each known by its first two cells;
  // page 1 holding its own header's lines and its mark; no run over
  // another or past a margin. The slip is drawn across the paper, past the
  // margins by design (0022), and is held by its code and its headings
  // above, so the checks read the page above it.
  test.each(languages)(
    'lays its page out whole in %s above the slip',
    async (locale) => {
      const { document, pdf } = await printed(locale)
      expect(verify(fixtureOf(`payment-reminder-${locale}`, document, stated(document, 1)), aboveSlip(pdf))).toEqual([])
    },
    TIMEOUT,
  )

  // The renderer has no language step: it draws what the runtime
  // resolved. So a render in a language is the same PDF as the reminder
  // written in that language alone, its slip in that language; a stage
  // that read the report's own words, its locale or its slip's language
  // rather than the render's would differ here wherever the lines above
  // do not look.
  test.each(languages)(
    'prints in %s the same PDF as the reminder written in that language alone',
    async (locale, words) => {
      const { bytes } = await printed(locale)
      const alone = await renderPdf(resolved(paymentReminderAlone(words), paymentReminderData()), { maxPages: 20 })
      expect(await inflatedDigest(bytes)).toBe(await inflatedDigest(alone))
    },
    TIMEOUT,
  )

  // Page 1 opens with the firm's letterhead, its mark at the margins'
  // corner and its line of whom it is from first under it, with no running
  // header above it: a running header on page 1 would stand over the
  // letterhead, and a reminder without the mark would not be the firm's.
  test(
    'prints its letterhead on page 1, with no running header there',
    async () => {
      const { pdf } = await printed('de-CH')
      const [first] = pdf.pages
      expect(marksOn(first!)).toEqual([markAt(MARGIN)])
      expect(crowding(first!, markAt(MARGIN))).toEqual([])
      const lines = linesOn(pdf)[0] ?? []
      expect(lines[0]).toBe(`${SENDER} MWST`)
      expect(lines.filter((line) => line.startsWith(`Mahnung ${NUMBER}`))).toEqual([])
    },
    TIMEOUT,
  )
})

/**
 * Forty invoices more, each overdue by thirty days on the reminder's day,
 * their amounts unlike: so many that the overdue invoices run past page 1.
 */
const MORE: readonly PaymentReminderItem[] = Array.from({ length: 40 }, (_, index) => ({
  kind: 'invoice',
  invoice: `R-2026-${String(701 + index).padStart(4, '0')}`,
  date: '2026-09-18',
  dueOn: '2026-10-18',
  daysOverdue: '30',
  amount: `${100 + index}.${String((index * 37) % 100).padStart(2, '0')}`,
}))

describe('a payment reminder of more invoices than page 1 holds', () => {
  // A reminder runs on to page 2 where its items do: page 1 keeps the
  // letterhead and prints no running header; page 2 opens with the
  // running header, which names the reminder and the customer, then the
  // overdue invoices' column header again, and draws no mark; the slip is
  // the last page's foot, so page 1 has no code and page 2 one, asking for
  // the balance of every item, recomputed here. A letterhead on every page,
  // a page 2 with no word of whose reminder it is, or a slip on page 1
  // under a table that goes on would each be wrong on the paper.
  test(
    'prints the running header from page 2, the overdue invoices’ header again under it, and the slip on the last page alone',
    async () => {
      const items = [...paymentReminderItems(), ...MORE]
      const { document, bytes, pdf } = await printed('de-CH', items, 'de-CH more')
      expect(pdf.pages).toHaveLength(2)
      const [first, second] = pdf.pages
      const pages = linesOn(pdf)
      expect([marksOn(first!), marksOn(second!)]).toEqual([[markAt(MARGIN)], []])
      expect(pages[0]?.[0]).toBe(`${SENDER} MWST`)
      expect(pages[1]?.slice(0, 2)).toEqual([`Mahnung ${NUMBER} · Schreinerei Keller GmbH`, 'Rechnung Datum Fällig am Tage Betrag'])
      expect(pages[0]?.filter((line) => line.startsWith(`Mahnung ${NUMBER}`))).toEqual([])
      expect([(await readCodes(bytes, 1)).length, (await readCodes(bytes, 2)).map((code) => code.text)]).toEqual([0, [document.paymentPart?.payload]])
      const due = sum(items)
      expect(document.paymentPart?.payload.split('\n').slice(18, 20)).toEqual([decimal(due), 'CHF'])
      expect(pages[1]).toEqual(
        expect.arrayContaining([`Total überfällige Rechnungen ${francs('de-CH', sum(of(items, 'invoice')))}`, `Zu bezahlen ${francs('de-CH', due)}`]),
      )
      expect(HEADINGS['de-CH']?.filter((heading) => !second?.items.some((item) => item.text === heading))).toEqual([])
      expect(HEADINGS['de-CH']?.filter((heading) => first?.items.some((item) => item.text === heading))).toEqual([])
    },
    TIMEOUT,
  )

  // The layout of both pages, by the corpus's checks over the page above
  // the slip: every overdue invoice once and in its order across the
  // break, the column header repeated on page 2, page 1 its own header's
  // lines and page 2 the running header's, no run over another or past a
  // margin.
  test(
    'lays both its pages out whole above the slip',
    async () => {
      const { document, pdf } = await printed('de-CH', [...paymentReminderItems(), ...MORE], 'de-CH more')
      expect(verify(fixtureOf('payment-reminder-more', document, stated(document, 2)), aboveSlip(pdf))).toEqual([])
    },
    TIMEOUT,
  )
})
