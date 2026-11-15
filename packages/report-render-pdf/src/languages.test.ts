import {
  E_INVOICE_SAMPLES,
  EURO_INVOICE_SAMPLES,
  inflatedDigest,
  INVOICE_EDITIONS,
  INVOICE_LANGUAGES,
  INVOICE_SAMPLES,
  invoiceAlone,
  invoiceLanguagesData,
  readCodes,
  readPdf,
  readPdfObjects,
  starterImages,
  STARTERS,
  XRECHNUNG_SAMPLES,
  type Edition,
  type ReadPdf,
  type Starter,
} from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import type { ReportData, ReportDefinition, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { normalise, TIMEOUT } from './testing/documents.js'
import { pageLines, type Line } from './testing/lines.js'

/**
 * One template in several languages, end to end (0063): the corpus's
 * invoice in four languages, resolved by the runtime in each locale it is
 * written in, rendered by pdfmake and proved on the PDF it produced, read
 * back with PDF.js (0003). The total is recomputed here in BigInt from the
 * lines and formatted with Intl for the locale; the code is decoded by
 * ZXing from the pixels PDF.js draws; the slip's headings, which are
 * SIX's (IG Annex C), are stated here, not read from the corpus. A table's
 * empty text, which the invoice prints only without lines, is held by the
 * runtime's `languages.test.ts` in the document.
 *
 * The renderer has no language step: it draws what the runtime resolved.
 * So each PDF is held, by `inflatedDigest`, to the PDF of the same invoice
 * written in that language alone, and every starter and sample to the
 * same bytes with its own locale named as with none.
 */

const CREATED = '2026-10-15T08:00:00Z'

/** SIX's two headings of the slip, in each language the invoice is written in (IG Annex C). */
const HEADINGS: Readonly<Record<string, readonly [receipt: string, paymentPart: string]>> = {
  'de-CH': ['Empfangsschein', 'Zahlteil'],
  'fr-CH': ['Récépissé', 'Section paiement'],
  'it-CH': ['Ricevuta', 'Sezione pagamento'],
  'en-CH': ['Receipt', 'Payment part'],
}

/** Cents as the exact decimal string they are. */
const decimal = (cents: bigint): string => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
const cents = (text: string): bigint => BigInt(text.replace('.', ''))

/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** An amount in Swiss francs as Intl prints it for `locale`, handed the exact decimal string, with its spaces as a PDF line has them. */
const francs = (locale: string, amount: bigint): string =>
  normalise(
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      decimal(amount) as Intl.StringNumericLiteral,
    ),
  )

/** `report` resolved against `data` in `locale`, where one is named, failing the test with the errors when it is refused. */
function resolved(report: ReportDefinition, data: ReportData, locale?: string, parameters: Starter['parameters'] = {}): ResolvedDocument {
  const outcome = resolveReport(report, data, {
    mode: 'final',
    parameters,
    images: starterImages,
    creationDate: CREATED,
    ...(locale === undefined ? {} : { locale }),
  })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

/** Every line of the PDF, page by page, top to bottom. */
const linesOf = (pdf: ReadPdf): Line[] => pdf.pages.flatMap((page) => pageLines(page))

/** Whether the PDF prints `words` as whole words, on one line. */
const prints = (pdf: ReadPdf, words: string): boolean => linesOf(pdf).some((line) => ` ${line.text} `.includes(` ${normalise(words)} `))

/** The lines that begin with `words`, as whole words. */
const startingWith = (pdf: ReadPdf, words: string): Line[] => linesOf(pdf).filter((line) => ` ${line.text} `.startsWith(` ${normalise(words)} `))

/** Each word of `edition`'s report the invoice prints on its page, on one line: the title is the PDF's, and the empty text prints only without lines. */
const pageWords = (edition: Edition): readonly string[] => [
  edition.heading,
  edition.numberIs,
  edition.issuedOnIs,
  edition.dueOnIs,
  ...edition.columns,
  edition.subtotal,
  edition.vat,
  edition.total,
  ...edition.terms,
  edition.message,
  edition.vatNumber,
]

/** Each word of `texts`, split where a line may wrap: a line's description wraps in its column, and is read word by word. */
const wordsIn = (texts: readonly string[]): Set<string> => new Set(texts.flatMap((text) => normalise(text).split(' ')))

/** The descriptions and units of `edition`'s lines: the data's words, in the language it bills in. */
const lineWords = (edition: Edition): readonly string[] => edition.items.flatMap(([description, unit]) => [description, unit])

const [GERMAN] = INVOICE_EDITIONS as [Edition, ...Edition[]]
const languages = INVOICE_EDITIONS.map((edition) => [edition.locale, edition] as const)

describe('the invoice in four languages, printed in each', () => {
  // A render in a translation's locale is a PDF a reader of that language
  // pays from: every word of its page in that language, and none of the
  // report's own German that differs from it, its lines described in it;
  // its title in it; its total as that locale writes it, exactly what the
  // lines sum to with the VAT; the slip's headings in its language and no
  // other's; and the code, decoded from the page's pixels, carrying the
  // message in that language and asking for the printed total. A German
  // word left at one place, a total formatted in German, or a slip still
  // in German would each print a French invoice that is half German.
  test.each(languages)(
    'prints its words, its total and its slip in %s, and none of the report’s own words that differ',
    async (locale, edition) => {
      const document = resolved(INVOICE_LANGUAGES, invoiceLanguagesData(edition), locale)
      const bytes = await renderPdf(document, { maxPages: 20 })
      const pdf = await readPdf(bytes)
      expect(pdf.pages).toHaveLength(1)
      expect(pageWords(edition).filter((words) => !prints(pdf, words))).toEqual([])
      const own = new Set(pageWords(edition).map(normalise))
      expect(pageWords(GERMAN).filter((words) => !own.has(normalise(words)) && prints(pdf, words))).toEqual([])
      // The lines are the host's data, handed over in the render's language: each of their words prints, and none of the German lines' but those this language prints too, as the customer's town.
      const data = invoiceLanguagesData(edition)
      expect([...wordsIn(lineWords(edition))].filter((word) => !prints(pdf, word))).toEqual([])
      const expected = wordsIn([...lineWords(edition), ...pageWords(edition), ...Object.values(data.header ?? {}).map(String)])
      expect([...wordsIn(lineWords(GERMAN))].filter((word) => !expected.has(word) && prints(pdf, word))).toEqual([])
      expect((await readPdfObjects(bytes)).info['Title']).toBe(edition.title)

      const lines = data.detail as Record<string, string>[]
      const subtotal = lines.reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
      const total = subtotal + halfAway(subtotal * 81n, 1000n)
      expect(startingWith(pdf, edition.total).map((line) => line.text)).toEqual([`${normalise(edition.total)} ${francs(locale, total)}`])

      const texts = new Set(pdf.pages[0]?.items.map((item) => item.text))
      expect((HEADINGS[locale] ?? []).filter((heading) => !texts.has(heading))).toEqual([])
      const others = Object.entries(HEADINGS).flatMap(([other, headings]) => (other === locale ? [] : headings))
      expect(others.filter((heading) => texts.has(heading))).toEqual([])

      const codes = await readCodes(bytes, 1)
      expect(codes.map((code) => code.text)).toEqual([document.paymentPart?.payload])
      const payload = codes[0]?.text.split('\n') ?? []
      const number = data.header?.['number'] as string
      expect([payload.includes(`${edition.message}${number}`), payload.slice(18, 20)]).toEqual([true, [decimal(total), 'CHF']])
    },
    TIMEOUT,
  )

  // The renderer draws what the runtime resolved, so a render in a
  // translation's locale is the same PDF as the same invoice written in
  // that language alone: a stage that read the report's own words, its
  // locale or its slip's language rather than the render's would print a
  // PDF that differs here, wherever the checks above do not look.
  test.each(languages)(
    'prints in %s the same PDF as the same invoice written in that language alone',
    async (locale, edition) => {
      const data = invoiceLanguagesData(edition)
      const translated = await renderPdf(resolved(INVOICE_LANGUAGES, data, locale), { maxPages: 20 })
      const alone = await renderPdf(resolved(invoiceAlone(edition), data), { maxPages: 20 })
      expect(await inflatedDigest(translated)).toBe(await inflatedDigest(alone))
    },
    TIMEOUT,
  )
})

/** Every starter and sample the corpus holds, once each. */
const EVERY = [
  ...new Map([...STARTERS, ...INVOICE_SAMPLES, ...EURO_INVOICE_SAMPLES, ...E_INVOICE_SAMPLES, ...XRECHNUNG_SAMPLES].map((each) => [each.id, each])).values(),
]

describe('a report rendered in its own locale, named', () => {
  // A report without translations prints as it did before languages
  // were added: naming its own locale is naming none. A PDF that changed
  // by a byte when a host names the locale, a PDF/A among them, would be a
  // report that prints otherwise for one host than for another.
  test.each(EVERY.map((each) => [each.id, each] as const))(
    '%s prints the same bytes with its own locale named as with none',
    async (_id, each) => {
      const none = await renderPdf(resolved(each.report, each.data, undefined, each.parameters), { maxPages: 20 })
      const named = await renderPdf(resolved(each.report, each.data, each.report.locale, each.parameters), { maxPages: 20 })
      expect(Buffer.from(named).equals(Buffer.from(none))).toBe(true)
    },
    TIMEOUT,
  )
})
