/**
 * A report written in one of its languages (0063): the one function the
 * validator, the core and the runtime write a language with.
 */
import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { declaredLocales, renderLocale, reportIn, substitutions, writtenIn } from './report-in.js'
import { getAt, richReport } from './test-support.js'
import type { Translation } from './translation.js'
import { reportWords } from './translation.js'

/** Every word of the fixture written in French, and its word expressions. */
function french(): Translation {
  const words = [...new Set(reportWords(richReport()).map(({ text }) => text))]
  return {
    locale: 'fr-CH',
    words: words.map((word) => ({ word, text: `fr:${word}` })),
    expressions: [{ cel: 'header.customer', expression: { cel: '"client " + header.customer' } }],
  }
}

/** The fixture with `translations`. */
function translated(...translations: Translation[]): ReportDefinition {
  return { ...richReport(), translations }
}

describe('writtenIn and reportIn', () => {
  // Every word place prints the language's word: one left in the report's
  // own would print German in a French invoice.
  test("replace every word at every place it stands, and each word expression, by the language's", () => {
    const report = reportIn(translated(french()), 'fr-CH')
    expect(report.title).toBe('fr:Orders by site')
    expect(getAt(report, '/regions/body/2/columns/1/header')).toBe('fr:Qty')
    expect(getAt(report, '/regions/body/2/emptyText')).toBe('fr:No order lines.')
    expect(getAt(report, '/regions/summary/4/emptyText')).toBe('fr:No order lines.')
    expect(getAt(report, '/regions/body/2/group/header/0/text')).toBe('fr:Site ')
    expect(getAt(report, '/regions/body/2/totals/1/cells/0/value/text')).toBe('fr:Total incl. VAT')
    expect(getAt(report, '/regions/summary/4/categoryTitle')).toBe('fr:Site')
    expect(getAt(report, '/paymentPart/message/0/text')).toBe('fr:Order from ')
    expect(getAt(report, '/regions/body/0/content/2/expression/cel')).toBe('"client " + header.customer')
    expect(reportWords(report).every(({ text }) => text.startsWith('fr:'))).toBe(true)
  })

  // What is no word prints as written in every language: a QR code's
  // content, an EPC QR code's texts, a bill's account, an expression that
  // stands where no word does.
  test('leave every string that is no word as it is', () => {
    const report = reportIn(translated({ ...french(), expressions: [{ cel: 'totals.subtotal', expression: { cel: 'totals.lines' } }] }), 'fr-CH')
    expect(getAt(report, '/regions/summary/2/content/0/text')).toBe('Orders for ')
    expect(getAt(report, '/regions/summary/3/information/0/text')).toBe('Orders from ')
    expect(getAt(report, '/paymentPart/account/0/text')).toBe('CH44 3199 9123 0008 8901 2')
    expect(getAt(report, '/paymentPart/amount/cel')).toBe('totals.subtotal')
    expect(getAt(report, '/regions/summary/3/amount/cel')).toBe('totals.subtotal')
  })

  // A render in a language formats, orders and labels in its locale, and
  // what reads the result reads a report in one language, as before.
  test("set the report's locale to the language's, and leave no translations", () => {
    const report = reportIn(translated(french()), 'fr-CH')
    expect(report.locale).toBe('fr-CH')
    expect(report).not.toHaveProperty('translations')
  })

  // The slip's headings follow a translated render where SIX has headings
  // in its language, and keep the bill's own where it has none: a French
  // invoice with German headings, or a Spanish one with none.
  test("print the slip's headings in the language's own where SIX has them, and the bill's otherwise", () => {
    const empty = (locale: string): Translation => ({ locale, words: [], expressions: [] })
    const report = translated(empty('fr-CH'), empty('it-CH'), empty('en-GB'), empty('rm-CH'), empty('es-ES'), empty('de-DE'))
    const language = (locale: string): unknown => writtenIn(report, locale).paymentPart?.language
    expect(['fr-CH', 'it-CH', 'en-GB', 'rm-CH', 'es-ES', 'de-DE', 'de-CH'].map(language)).toEqual(['fr', 'it', 'en', 'rm', 'de', 'de', 'de'])
    const english = { ...report, paymentPart: { ...(report.paymentPart as NonNullable<ReportDefinition['paymentPart']>), language: 'en' as const } }
    expect(writtenIn(english, 'de-CH').paymentPart?.language).toBe('en')
    expect(writtenIn(english, 'es-ES').paymentPart?.language).toBe('en')
    expect(writtenIn(english, 'de-DE').paymentPart?.language).toBe('de')
  })

  // A report without a bill is not given one by a language.
  test('give a report without a payment part none', () => {
    const { paymentPart: _bill, ...report } = translated(french())
    expect(writtenIn(report, 'fr-CH')).not.toHaveProperty('paymentPart')
  })

  // In its own language a report prints as it always has: a render that
  // names its own locale is the render that names none.
  test('give the report without its translations in its own locale, and a report without translations as it is', () => {
    expect(reportIn(translated(french()), 'de-CH')).toEqual(richReport())
    expect(writtenIn(translated(french()), 'de-CH')).toEqual(richReport())
    expect(reportIn(richReport(), 'de-CH')).toEqual(richReport())
  })

  // A word is never printed in another language: no fallback to the
  // report's own, and no locale near the one asked for.
  test("refuse a word the language lacks, which writtenIn leaves in the report's own", () => {
    const partial = translated({ ...french(), words: french().words.slice(1) })
    expect(() => reportIn(partial, 'fr-CH')).toThrow(/1 of this report's words are not written in "fr-CH"/)
    expect(writtenIn(partial, 'fr-CH').title).toBe('Orders by site')
  })

  // A locale the report does not declare is a caller that skipped
  // renderLocale: printed, it would be the report's own words in a
  // stranger's formats.
  test('refuse a locale the report does not declare', () => {
    expect(() => reportIn(translated(french()), 'fr')).toThrow(RangeError)
    expect(() => writtenIn(richReport(), 'fr-CH')).toThrow(/"fr-CH" is not a locale this report is written in/)
  })

  // The report handed over is a session's or a validator's copy, and is
  // read again after: writing a language must not change it.
  test('change nothing of the report they are handed', () => {
    const report = translated(french())
    const before = JSON.stringify(report)
    reportIn(report, 'fr-CH')
    expect(JSON.stringify(report)).toBe(before)
  })
})

describe('substitutions', () => {
  // The validator reports a broken translation at its entry: each string
  // replaced says which entry it came from.
  test("name each place a translation replaces, what prints there and the translation's entry", () => {
    const replaced = substitutions(translated(french()), 0)
    expect(replaced.find(({ path }) => path === '/regions/body/2/columns/1/header')).toEqual({
      path: '/regions/body/2/columns/1/header',
      text: 'fr:Qty',
      entry: `/translations/0/words/${french().words.findIndex(({ word }) => word === 'Qty')}/text`,
    })
    expect(replaced.at(-1)).toEqual({
      path: '/regions/body/0/content/2/expression/cel',
      text: '"client " + header.customer',
      entry: '/translations/0/expressions/0/expression/cel',
    })
    expect(replaced.filter(({ text }) => text === 'fr:No order lines.').map(({ path }) => path)).toEqual([
      '/regions/body/2/emptyText',
      '/regions/summary/4/emptyText',
    ])
  })
})

describe('renderLocale', () => {
  // A render that names no locale prints in the report's own, as every
  // render did before.
  test("is the report's own when none is asked for, and the one asked for where the report is written in it", () => {
    const report = translated(french())
    expect(renderLocale(report)).toEqual({ ok: true, locale: 'de-CH' })
    expect(renderLocale(report, 'de-CH')).toEqual({ ok: true, locale: 'de-CH' })
    expect(renderLocale(report, 'fr-CH')).toEqual({ ok: true, locale: 'fr-CH' })
  })

  // A near locale is another language: de-DE writes ß where de-CH writes
  // ss, and fr is not fr-CH.
  test('refuses a locale the report is not written in, near ones among them, naming those it is', () => {
    expect(renderLocale(translated(french()), 'fr')).toEqual({
      ok: false,
      message: '"fr" is not a locale this report is written in; it is written in de-CH, fr-CH',
    })
    expect(renderLocale(richReport(), 'de-DE')).toEqual({ ok: false, message: '"de-DE" is not a locale this report is written in; it is written in de-CH' })
  })

  // The languages a builder offers, its own first.
  test('reads the declared locales in order, the report its own first', () => {
    expect(declaredLocales(translated(french(), { locale: 'it-CH', words: [], expressions: [] }))).toEqual(['de-CH', 'fr-CH', 'it-CH'])
    expect(declaredLocales(richReport())).toEqual(['de-CH'])
  })
})
