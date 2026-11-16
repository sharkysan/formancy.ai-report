import { diagnose } from '@formancy/report-core'
import { checkReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-runtime'
import { reportIn, validateReport } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { PRODUCT_DATA_SHEET, productDataSheetAlone, SHEET_EDITIONS } from './product-data-sheet.js'

/**
 * The product data sheet (0064): a technical sheet for an invented
 * building product, its values set with runs below and above the line
 * (0061), written in Swiss German with its words in French, Italian and
 * English too (0063). What is held here is the report and its data; what
 * prints in each language is held on the PDF by the renderer's
 * `product-data-sheet.test.ts`.
 */

type Component = ReportDefinition['regions']['body'][number]

/** Every text component's runs set below or above the line, in reading order, each as its text and its baseline. */
function shifted(report: ReportDefinition): [string, string][] {
  const found: [string, string][] = []
  const walk = (components: readonly Component[]): void => {
    for (const component of components) {
      if (component.kind === 'text') {
        for (const run of component.content) if ('baseline' in run && run.baseline !== undefined && run.kind === 'text') found.push([run.text, run.baseline])
      } else if (component.kind === 'columns') component.columns.forEach((column) => walk(column.components))
      else if (component.kind === 'section' || component.kind === 'keepTogether') walk(component.components)
    }
  }
  const { regions } = report
  for (const region of [regions.reportHeader, regions.pageHeader, regions.body, regions.summary, regions.pageFooter]) walk(region)
  return found
}

const [GERMAN] = SHEET_EDITIONS

describe('the product data sheet', () => {
  // It is the sheet written in Swiss German, its words written in three
  // languages more: one that had drifted from the German sheet would
  // prove, in French, a report nobody opens.
  test('is the German sheet, with a translation for French, Italian and English', () => {
    const { translations, ...report } = PRODUCT_DATA_SHEET.report
    expect(report).toEqual(productDataSheetAlone(GERMAN!))
    expect([report.locale, translations?.map(({ locale }) => locale)]).toEqual(['de-CH', ['fr-CH', 'it-CH', 'en']])
    expect(SHEET_EDITIONS.map(({ locale }) => locale)).toEqual(['de-CH', 'fr-CH', 'it-CH', 'en'])
  })

  // Every language is whole: a word left out of one would refuse the
  // Studio's Preview in that language, and the renderer's test would be
  // refused, or held to a page with a German word on it, rather than
  // proving a French sheet.
  test('is valid, and whole in every language it declares', () => {
    expect(validateReport(PRODUCT_DATA_SHEET.report).valid).toBe(true)
    expect(diagnose(PRODUCT_DATA_SHEET.report)).toEqual([])
    expect(SHEET_EDITIONS.map(({ locale }) => checkReport(PRODUCT_DATA_SHEET.report, locale).ok)).toEqual([true, true, true, true])
  })

  // Written in a language, it is that language's sheet alone, word for
  // word and nothing else: a translation that changed anything but a
  // word, or a word the walk did not reach, shows here before any PDF.
  test.each(SHEET_EDITIONS.map((edition) => [edition.locale, edition] as const))('written in %s, is the same sheet written in it alone', (locale, edition) => {
    expect(reportIn(PRODUCT_DATA_SHEET.report, locale)).toEqual(productDataSheetAlone(edition))
  })

  // Each power and index is a run set off the line, the same runs in
  // every language: a power typed as Unicode's superscript digit -- m³,
  // CO₂ -- would print in a face's own small glyph, or in none, and is no
  // run a person can set or a check can find, which is what the sheet is
  // to show (0061).
  test('sets its powers, its index and its footnotes’ marks as runs off the line, the same in every language, and no Unicode super- or subscript', () => {
    const expected = [
      ['3', 'superscript'],
      ['2', 'superscript'],
      ['1', 'superscript'],
      ['2', 'superscript'],
      ['2', 'superscript'],
      ['2', 'subscript'],
      ['2', 'superscript'],
      ['1', 'superscript'],
      ['2', 'superscript'],
    ]
    for (const { locale } of SHEET_EDITIONS) expect(shifted(reportIn(PRODUCT_DATA_SHEET.report, locale)), locale).toEqual(expected)
    const scripts = /[²³¹⁰-₟]/u
    expect(scripts.test(JSON.stringify(PRODUCT_DATA_SHEET.report))).toBe(false)
    expect(scripts.test(JSON.stringify(PRODUCT_DATA_SHEET.data))).toBe(false)
  })

  // Data prints as the host hands it over, in whatever language it was
  // written (0063): so the sheet's data is numbers, a date, and the
  // product's name, its article number and its fire class, which no
  // language translates. A description in the data would print in German
  // on the French sheet.
  test('reads data no language translates: numbers, a date, and the product’s name, number and class', () => {
    const fields = PRODUCT_DATA_SHEET.report.datasets.header?.fields ?? []
    expect(fields.filter(({ type }) => type === 'string').map(({ id }) => id)).toEqual(['product', 'article', 'fireClass'])
    expect([...new Set(fields.map(({ type }) => type))].sort()).toEqual(['date', 'decimal', 'integer', 'string'])
  })
})
