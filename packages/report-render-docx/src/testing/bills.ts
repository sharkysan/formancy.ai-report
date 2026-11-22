import { BILL_EXAMPLES, GERMAN_BILL, LONG_BILL, resolvedBill, type SwissQrBill } from '@formancy/report-corpus'
import type { Block, QrBill, ResolvedDocument } from '@formancy/report-runtime'
import { documentOf, paragraph } from './support.js'

/**
 * QR-bills for the writer's tests (0075): the corpus's, which the PDF
 * renderer's tests draw too, each resolved by the runtime from a report
 * that carries one, so that the payload and every text are the
 * runtime's.
 */

type Language = SwissQrBill['language']

/** Every language a slip is printed in (IG Annex C): a record over the format's own, so that one added there without its case here does not compile. */
export const LANGUAGES = Object.keys({ de: 0, fr: 0, it: 0, en: 0, rm: 0 } satisfies Record<Language, 0>) as Language[]

/** The bills a slip is tried with, by name: SIX's examples, the second in every language, and the one whose every value is as long as SIX allows. */
export const BILLS: readonly (readonly [string, SwissQrBill])[] = [
  ...Object.entries(BILL_EXAMPLES).map(([name, bill]) => [`example ${name}`, bill] as const),
  ['example two in German', GERMAN_BILL],
  ...LANGUAGES.map((language) => [`example three in ${language}`, { ...BILL_EXAMPLES.three, language }] as const),
  ...LANGUAGES.map((language) => [`the longest values in ${language}`, { ...LONG_BILL, language }] as const),
]

export { resolvedBill }

/** A document of `body` on the corpus's A4 page, paid by `bill`. */
export function billDocument(bill: QrBill, body: readonly Block[] = [paragraph('An invoice')], more: Partial<ResolvedDocument> = {}): ResolvedDocument {
  return documentOf(body, { paymentPart: bill, ...more })
}
