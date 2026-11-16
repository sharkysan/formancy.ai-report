/**
 * What a report's translations may be (0063): their shape, their bounds,
 * and each one held to every rule each place of its word holds the word
 * to, refused at the translation and naming the place.
 */
import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { reportHash } from './hash.js'
import { MAX_EXPRESSION_LENGTH, MAX_LABEL_LENGTH, MAX_LANGUAGES, MAX_TEXT_LENGTH, MAX_WORDS } from './limits.js'
import { editable, eInvoiceReport, refusals, richReport, setAt } from './test-support.js'
import type { Translation } from './translation.js'
import { validateReport } from './validate.js'
import { newContext } from './validate-context.js'
import { checkLanguages } from './validate-translations.js'

/** A French translation of three of the fixture's words and its one word expression. */
const french = (): Translation => ({
  locale: 'fr-CH',
  words: [
    { word: 'Orders by site', text: 'Commandes par site' },
    { word: 'Qty', text: 'Qté' },
    { word: 'No order lines.', text: 'Aucune ligne de commande.' },
  ],
  expressions: [{ cel: 'header.customer', expression: { cel: 'header.customer + " (client)"' } }],
})

/** `report` with `translations`, as a document the tests may edit. */
function translated(translations: unknown, report: ReportDefinition = richReport()): Record<string, unknown> {
  const document = editable(report)
  setAt(document, '/translations', translations)
  return document
}

/** The message of the one error a document is refused with. */
function message(document: unknown): string {
  const outcome = validateReport(document)
  if (outcome.valid || outcome.errors.length !== 1) throw new Error(`expected one error, found ${outcome.valid ? 'none' : outcome.errors.length}`)
  return (outcome.errors[0] as { message: string }).message
}

describe('a report with translations', () => {
  // A translation the validator dropped, or rebuilt otherwise, would be a
  // language that printed other words than the ones saved.
  test('reads back whole, and is part of what the hash names', () => {
    const document = translated([french()])
    expect(validateReport(document)).toEqual({ valid: true, report: { ...richReport(), translations: [french()] } })
    expect(reportHash(document as unknown as ReportDefinition)).not.toBe(reportHash(richReport()))
  })

  // Every report saved before translations is the report it was: a hash
  // that moved would unpin every published report.
  test('leaves a report without them valid and hashed as before', () => {
    expect(reportHash(richReport())).toBe('2982668d5dbe692bab65f10c49abdb09e01e9f72d5422fd97f113758274aba44')
    expect(validateReport(richReport())).toEqual({ valid: true, report: richReport() })
  })

  // One report has one spelling: an empty list beside an absent one would
  // be two hashes for one report.
  test('is refused an empty list of them', () => {
    expect(refusals(translated([]))).toEqual(['too-few /translations'])
  })

  // A language just added holds no words yet, and is a report being
  // translated: valid, so that a session can hold it.
  test('holds a language with no words yet', () => {
    expect(refusals(translated([{ locale: 'it-CH', words: [], expressions: [] }]))).toEqual([])
  })

  // Strict shapes: a property this version does not know could be the one
  // that says which words a language prints.
  test('is refused a translation of another shape', () => {
    expect(refusals(translated([{ locale: 'fr-CH', words: [], expressions: [], fallback: 'de-CH' }]))).toEqual(['unknown-property /translations/0/fallback'])
    expect(refusals(translated([{ locale: 'fr-CH', words: [] }]))).toEqual(['missing-property /translations/0/expressions'])
    expect(refusals(translated([{ ...french(), words: [{ word: 'Qty' }] }]))).toEqual(['missing-property /translations/0/words/0/text'])
  })
})

describe("a translation's language", () => {
  // A render names its locale as the report names its own; one spelt
  // otherwise could be asked for and never found.
  test('is written as the report writes its own locale', () => {
    expect(refusals(translated([{ ...french(), locale: 'fr_CH' }]))).toEqual(['invalid-locale /translations/0/locale'])
  })

  // Two French translations would leave which one prints to the order they
  // were read in; the report's own would print a translation over the
  // report's own words.
  test('is refused twice, or as the report its own', () => {
    expect(refusals(translated([french(), { ...french(), words: [] }]))).toEqual(['duplicate-language /translations/1/locale'])
    expect(refusals(translated([{ ...french(), locale: 'de-CH' }]))).toEqual(['duplicate-language /translations/0/locale'])
  })

  // A report whose own locale cannot be read is refused for that, once: its
  // translations are read for what they are, and no language is said to
  // be its own twice.
  test("is read beside a report's own locale that cannot be, which is refused alone", () => {
    const document = translated([french(), { locale: 'de_CH', words: [], expressions: [] }])
    setAt(document, '/locale', 'de_CH')
    expect(refusals(document)).toEqual(['invalid-locale /locale', 'invalid-locale /translations/1/locale'])
  })

  // Bounded as everything is: a report in a thousand languages is validated
  // a thousand times.
  test('counts at most MAX_LANGUAGES with the report its own', () => {
    const locales = Array.from(
      { length: MAX_LANGUAGES },
      (_, index) => `x${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
    )
    const languages = locales.map((locale) => ({ locale, words: [], expressions: [] }))
    expect(refusals(translated(languages.slice(0, MAX_LANGUAGES - 1)))).toEqual([])
    expect(refusals(translated(languages))).toEqual(['too-many /translations'])
  })
})

describe("a translation's words", () => {
  // A word with no letter is never asked for, so a translation of one
  // translates nothing the report would look up.
  test('are refused where one holds no letter', () => {
    expect(refusals(translated([{ ...french(), words: [{ word: '12.50', text: '12,50' }] }]))).toEqual(['not-a-word /translations/0/words/0/word'])
  })

  // One word, one translation: two would leave which prints to the order
  // they were read in.
  test('are refused where one is translated twice', () => {
    const twice = { ...french(), words: [...french().words, { word: 'Qty', text: 'Quantité' }] }
    expect(refusals(translated([twice]))).toEqual(['duplicate-word /translations/0/words/3/word'])
    const expressions = { ...french(), expressions: [...french().expressions, { cel: 'header.customer', expression: { cel: '"client"' } }] }
    expect(refusals(translated([expressions]))).toEqual(['duplicate-word /translations/0/expressions/1/cel'])
  })

  // A word a language leaves out cannot print nothing there: a blank
  // translation would print a column with no header.
  test('are refused a blank translation', () => {
    expect(refusals(translated([{ ...french(), words: [{ word: 'Qty', text: '  ' }] }]))).toEqual(['blank-translation /translations/0/words/0/text'])
    expect(refusals(translated([{ ...french(), expressions: [{ cel: 'header.customer', expression: { cel: ' ' } }] }]))).toEqual([
      'empty-expression /translations/0/expressions/0/expression/cel',
    ])
  })

  // A translation no word looks up yet is held by no place's rule, so it is
  // bounded where it is: a megabyte of text kept for a word the report no
  // longer prints would be kept unread.
  test('are bounded where they are, a word and its text by MAX_TEXT_LENGTH and an expression by MAX_EXPRESSION_LENGTH', () => {
    const long = 'x'.repeat(MAX_TEXT_LENGTH + 1)
    expect(refusals(translated([{ ...french(), words: [{ word: long, text: 'a' }] }]))).toEqual(['too-long /translations/0/words/0/word'])
    expect(refusals(translated([{ ...french(), words: [{ word: 'unused', text: long }] }]))).toEqual(['too-long /translations/0/words/0/text'])
    const cel = 'x'.repeat(MAX_EXPRESSION_LENGTH + 1)
    expect(refusals(translated([{ ...french(), expressions: [{ cel, expression: { cel: '"a"' } }] }]))).toEqual(['too-long /translations/0/expressions/0/cel'])
    expect(refusals(translated([{ ...french(), expressions: [{ cel: '', expression: { cel: '"a"' } }] }]))).toEqual([
      'empty-expression /translations/0/expressions/0/cel',
    ])
  })

  // Bounded as everything is, each list measured before it is read.
  test('count at most MAX_WORDS words and MAX_WORDS expressions', () => {
    const words = Array.from({ length: MAX_WORDS + 1 }, (_, index) => ({ word: `w${index}`, text: `t${index}` }))
    expect(refusals(translated([{ ...french(), words }]))).toEqual(['too-many /translations/0/words'])
    const expressions = Array.from({ length: MAX_WORDS + 1 }, (_, index) => ({ cel: `"${index}"`, expression: { cel: '"t"' } }))
    expect(refusals(translated([{ ...french(), expressions }]))).toEqual(['too-many /translations/0/expressions'])
    expect(refusals(translated([{ ...french(), words: words.slice(0, MAX_WORDS) }]))).toEqual([])
  })
})

describe('a translation held to the rules of each place its word stands in', () => {
  // A column header is one line, whatever its language: a French header
  // past the bound would be a header the report's own could never be.
  test('refuses a column header past MAX_LABEL_LENGTH, at the translation, naming the place', () => {
    const long = { ...french(), words: [{ word: 'Qty', text: 'q'.repeat(MAX_LABEL_LENGTH + 1) }] }
    expect(refusals(translated([long]))).toEqual(['too-long /translations/0/words/0/text'])
    expect(message(translated([long]))).toContain('/regions/body/2/columns/1/header')
    expect(message(translated([long]))).toContain('fr-CH')
  })

  // A word in two places is one translation held to both: a paragraph
  // takes far more than a header, and the header's bound still holds.
  test('holds a word that stands in two places to the stricter of them, once', () => {
    const document = editable(richReport())
    setAt(document, '/regions/body/3/components/1/content/0/text', 'Qty')
    setAt(document, '/translations', [{ ...french(), words: [{ word: 'Qty', text: 'q'.repeat(MAX_LABEL_LENGTH + 1) }] }])
    expect(refusals(document)).toEqual(['too-long /translations/0/words/0/text'])
    setAt(document, '/translations', [{ ...french(), words: [{ word: 'Qty', text: 'q'.repeat(MAX_LABEL_LENGTH) }] }])
    expect(refusals(document)).toEqual([])
  })

  // The slip's message is encoded in the bill's QR code: SIX's characters
  // and its length, with the billing information's 50 characters, hold in
  // every language, or no bank reads the French bill.
  test("refuses a QR-bill's message outside SIX's characters or past its length", () => {
    const document = editable(richReport())
    setAt(document, '/paymentPart/message', [{ kind: 'text', text: 'Order from Seldwyla' }])
    const outside = { ...french(), words: [{ word: 'Order from Seldwyla', text: 'Commande 😀' }] }
    setAt(document, '/translations', [outside])
    expect(refusals(document)).toEqual(['invalid-qr-bill /translations/0/words/0/text'])
    expect(message(document)).toContain('/paymentPart/message')
    setAt(document, '/translations', [{ ...french(), words: [{ word: 'Order from Seldwyla', text: 'c'.repeat(91) }] }])
    expect(refusals(document)).toEqual(['invalid-qr-bill /translations/0/words/0/text'])
    setAt(document, '/translations', [{ ...french(), words: [{ word: 'Order from Seldwyla', text: 'c'.repeat(90) }] }])
    expect(refusals(document)).toEqual([])
  })

  // A Factur-X's title is written into its PDF/A's metadata, whatever
  // language it is in.
  test("refuses a Factur-X's title holding &", () => {
    const title = { locale: 'fr-CH', words: [{ word: 'Orders by site', text: 'Commandes & sites' }], expressions: [] }
    expect(refusals(translated([title], eInvoiceReport()))).toEqual(['invalid-e-invoice /translations/0/words/0/text'])
  })

  // A word the report does not print is held to no place: it is warned of
  // by the core, and never printed.
  test('holds a translation of no word the report prints to its own bounds alone', () => {
    expect(refusals(translated([{ ...french(), words: [{ word: 'Nowhere', text: 'q'.repeat(MAX_LABEL_LENGTH + 1) }] }]))).toEqual([])
  })

  // Each language is written and judged on its own: a second language's
  // error is that language's, named at its translation.
  test('names the translation that broke a rule, in each language', () => {
    const italian = { locale: 'it-CH', words: [{ word: 'Qty', text: 'q'.repeat(MAX_LABEL_LENGTH + 1) }], expressions: [] }
    expect(refusals(translated([french(), italian]))).toEqual(['too-long /translations/1/words/0/text'])
  })
})

describe('checkLanguages', () => {
  // The mapping to a translation's entry is by where the error stands. One
  // that stands near no translated string -- which no rule of the format
  // gives, since a written report differs from the report only there --
  // is still the translation's, and the whole report's error names no
  // path a reader could not find.
  test('reports an error near no translated string at the translation, and one of the whole report as such', () => {
    const report = { ...richReport(), translations: [french()] }
    const c = newContext()
    checkLanguages(c, report, [french()], (again) => {
      again.f.report('/page/size', 'not-one-of', 'a page')
      again.f.report('', 'too-many-errors', 'more')
      return undefined
    })
    expect(c.f.errors()).toEqual([
      { path: '/translations/0', code: 'not-one-of', message: 'written in fr-CH, where it stands at /page/size, a page' },
      { path: '/translations/0/words/0/text', code: 'too-many-errors', message: 'written in fr-CH, where it stands at the report as a whole, more' },
    ])
  })
})
