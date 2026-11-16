import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { invoiceOf, sender } from './invoice.js'
import { ENGLISH, FRENCH, GERMAN, ITALIAN } from './invoice-words.js'
import type { Edition } from './invoice-words.js'

/**
 * The invoice in four languages (0063): one report, the German starter's,
 * whose words are written in French, Italian and English too, so that a
 * render that names fr-CH, it-CH or en-CH prints it in that language. It
 * is neither a starter nor a sample: 0024's four samples stay four
 * reports with their own firms, beside it.
 *
 * Its translations are `invoice-words.ts`'s editions, word for word: the
 * title, the heading and the words before the number and the dates, the
 * column headers, the totals' labels, the empty text, the sentence of
 * terms and the slip's message; and the line under the mark, which keeps
 * the German firm and calls its UID the VAT number in each language's word
 * for it. The firm, the customer, the number and the reference are the
 * German invoice's in every language: a bill's parties are no words.
 *
 * Its data is the German invoice's, each line described in the language a
 * render prints in. A report's data is the host's, in the language the
 * host chose, and nothing translates it; the German lines in a French
 * invoice would leave its page half in each.
 *
 * `invoiceAlone` is the same invoice written in one language alone, from
 * the same edition's words: what a render of the four-language invoice in
 * that language is held to, word for word here and by its PDF in the
 * renderer's `languages.test.ts`.
 */

/** The editions the invoice is written in, the report's own first. */
export const INVOICE_EDITIONS: readonly Edition[] = [GERMAN, FRENCH, ITALIAN, ENGLISH]

/** `edition` as the four-language invoice bills in it: its words, its locale, its slip's language and its lines' descriptions, and the German firm, customer, labels, number, reference and article numbers. */
const billedIn = (edition: Edition): Edition => ({
  ...edition,
  id: 'invoice-languages',
  labels: GERMAN.labels,
  creditor: GERMAN.creditor,
  customer: GERMAN.customer,
  number: GERMAN.number,
  reference: GERMAN.reference,
  articles: GERMAN.articles,
})

/** Every word the invoice prints in `edition`'s language, in the order the report holds them. */
const wordsOf = (edition: Edition): readonly string[] => [
  edition.title,
  sender(GERMAN.creditor, edition.vatNumber),
  edition.heading,
  edition.numberIs,
  edition.issuedOnIs,
  edition.dueOnIs,
  ...edition.columns,
  edition.subtotal,
  edition.vat,
  edition.total,
  edition.empty,
  ...edition.terms,
  edition.message,
]

type Translation = NonNullable<ReportDefinition['translations']>[number]

/** The invoice's German words written in `edition`'s language. */
function translation(edition: Edition): Translation {
  const own = wordsOf(GERMAN)
  return { locale: edition.locale, words: wordsOf(edition).map((text, index) => ({ word: own[index] as string, text })), expressions: [] }
}

/** The invoice in German, French, Italian and English: the German starter's report, its words written in the three others too. */
export const INVOICE_LANGUAGES: ReportDefinition = {
  ...invoiceOf(billedIn(GERMAN)).report,
  translations: [FRENCH, ITALIAN, ENGLISH].map(translation),
}

/** The four-language invoice's data for a render in `edition`'s locale: the German invoice's, each line described in the edition's words. */
export const invoiceLanguagesData = (edition: Edition): ReportData => invoiceOf(billedIn(edition)).data

/** The same invoice written in `edition`'s language alone, with no translations: what a render of `INVOICE_LANGUAGES` in its locale prints. */
export const invoiceAlone = (edition: Edition): ReportDefinition => invoiceOf(billedIn(edition)).report
