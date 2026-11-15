import { diagnose } from '@formancy/report-core'
import { checkReport } from '@formancy/report-runtime'
import { reportIn, validateReport } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { INVOICE_EDITIONS, INVOICE_LANGUAGES, invoiceAlone, invoiceLanguagesData } from './invoice-languages.js'
import { INVOICE, invoiceData } from './invoice.js'
import { FRENCH, GERMAN } from './invoice-words.js'

/**
 * The invoice in four languages (0063): one report, the German starter's,
 * its words written in French, Italian and English too, and held to the
 * same invoice written in each language alone, which the renderer's
 * `languages.test.ts` holds its PDFs to. What is held here is the report
 * and its data; what prints is held on the PDF there.
 */

describe('the invoice in four languages', () => {
  // It is the starter's report, so that what the PDFs prove of it is
  // proved of the invoice a person opens: one that had drifted from the
  // starter would prove a report nobody uses.
  test('is the German starter’s report, its id aside, with a translation for each other edition', () => {
    const { translations, id, ...report } = INVOICE_LANGUAGES
    expect({ ...report, id: INVOICE.report.id }).toEqual(INVOICE.report)
    expect([id, translations?.map(({ locale }) => locale)]).toEqual(['invoice-languages', ['fr-CH', 'it-CH', 'en-CH']])
    expect(INVOICE_EDITIONS.map(({ locale }) => locale)).toEqual(['de-CH', 'fr-CH', 'it-CH', 'en-CH'])
  })

  // Every language is whole: a word left out of a translation would have
  // the renderer's test refused, or held to a PDF in which a word stood
  // in German, rather than proving a French invoice.
  test('is valid, and whole in every language it declares', () => {
    expect(validateReport(INVOICE_LANGUAGES).valid).toBe(true)
    const found = diagnose(INVOICE_LANGUAGES)
    expect(found.filter(({ severity, language }) => severity === 'error' || language !== undefined)).toEqual([])
    expect(INVOICE_EDITIONS.map(({ locale }) => checkReport(INVOICE_LANGUAGES, locale).ok)).toEqual([true, true, true, true])
  })

  // Written in a language, it is that language's invoice alone, word for
  // word and nothing else: a translation that changed something besides
  // a word, or a word the walk did not reach, would show here before any
  // PDF is drawn.
  test.each(INVOICE_EDITIONS.map((edition) => [edition.locale, edition] as const))(
    'written in %s, is the same invoice written in it alone',
    (locale, edition) => {
      expect(reportIn(INVOICE_LANGUAGES, locale)).toEqual(invoiceAlone(edition))
    },
  )

  // The data is the German invoice's, its lines described in the render's
  // language: the host's data is in the language it chose, and the German
  // lines in a French invoice would leave its page half in each.
  test('bills the German invoice’s customer and total in every language, its lines described in that language', () => {
    expect(invoiceLanguagesData(GERMAN)).toEqual(invoiceData())
    const french = invoiceLanguagesData(FRENCH)
    expect(french.header).toEqual(invoiceData().header)
    const described = (rows: readonly Record<string, unknown>[] | undefined) => (rows ?? []).map(({ description, unit, ...rest }) => [description, unit, rest])
    expect(described(french.detail).map(([description, unit]) => [description, unit])).toEqual(
      FRENCH.items.map(([description, unit]) => [description, unit]).reverse(),
    )
    expect(described(french.detail).map(([, , rest]) => rest)).toEqual(described(invoiceData().detail).map(([, , rest]) => rest))
  })
})
