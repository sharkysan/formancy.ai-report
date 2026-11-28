/**
 * A report's diagnostics, its own and each declared language's, with what
 * each language lacks, from one diagnosis of the report (0088, after the
 * re-review of #112's N-H): what report-mcp's verdict reads on every
 * validate_report and apply_commands, which asked `missingWords` once per
 * language, each asking for a diagnosis of the whole report again.
 *
 * `diagnosis` is wrapped, and nothing else is changed of it, so that a case
 * can count the diagnoses of the report given.
 */
import { reportWords, validateReport } from '@formancy/report-spec'
import type { ReportDefinition, Translation } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { thawed } from '../snapshot.js'
import { sampleReport, setAt } from '../test-support.js'
import { diagnose, diagnoseByLanguage } from './diagnose.js'
import { diagnosis } from './diagnosis.js'
import { languageDiagnostics, missingWords } from './words.js'

vi.mock('./diagnosis.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./diagnosis.js')>()
  return { ...original, diagnosis: vi.fn(original.diagnosis) }
})

/** The sample's word expression that stands in the payment part's message, which no language below translates. */
const MESSAGE = '" for " + header.customer'

/** A translation into `locale` of every word of `report` but those `left`, and of no expression. */
function lacking(report: ReportDefinition, locale: string, left: readonly string[]): Translation {
  const words = [...new Set(reportWords(report).map(({ text }) => text))].filter((word) => !left.includes(word))
  return { locale, words: words.map((word) => ({ word, text: `${locale}:${word}` })), expressions: [] }
}

/** The sample in French and in Italian, each lacking words of its own, every expression and the payment part's message. */
function inTwoLanguages(): ReportDefinition {
  const sample = sampleReport()
  const report = thawed(sample)
  setAt(report, '/translations', [lacking(sample, 'fr-CH', ['Qty']), lacking(sample, 'it-CH', ['Total', 'Qty'])])
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the sample in two languages is invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

describe('diagnoseByLanguage', () => {
  // One answer for what three functions give: were it to disagree with any
  // of them, an agent would be told a language lacks what a render in it
  // does not refuse, or leave out what it does.
  test('gives the report’s own diagnostics, each language’s, and what each lacks, as diagnose, languageDiagnostics and missingWords give them', () => {
    const report = inTwoLanguages()
    const { diagnostics, languages } = diagnoseByLanguage(report)
    expect(diagnostics).toEqual(diagnose(report).filter(({ language }) => language === undefined))
    expect(languages.map(({ locale }) => locale)).toEqual(['fr-CH', 'it-CH'])
    for (const { locale, diagnostics: found, missing } of languages) {
      expect(found, locale).toEqual(languageDiagnostics(report, locale))
      expect(missing, locale).toEqual(missingWords(report, locale))
      expect(found.some(({ code }) => code === 'word-missing')).toBe(true)
    }
    // Every language lacks the slip's message, which stands in the payment part.
    for (const { locale, missing } of languages)
      expect(
        missing.paymentPart.map(({ source }) => source),
        locale,
      ).toContain(MESSAGE)
    expect([...diagnostics, ...languages.flatMap(({ diagnostics: found }) => found)]).toEqual(diagnose(report))
  })

  // The cost N-H measured: missingWords diagnoses the report again for each
  // language, up to +80 % on every check of a starter in twenty-three
  // languages. Here the report given is diagnosed once, and each language's
  // written report once, which a language's diagnostics need.
  test('diagnoses the report given once, however many languages it declares', () => {
    const report = inTwoLanguages()
    const counted = vi.mocked(diagnosis)
    counted.mockClear()
    diagnoseByLanguage(report)
    expect(counted.mock.calls.filter(([given]) => given === report)).toHaveLength(1)
    expect(counted.mock.calls).toHaveLength(1 + 2)
    // What it replaces, for the comparison: diagnose, and missingWords once a language.
    counted.mockClear()
    diagnose(report)
    for (const locale of ['fr-CH', 'it-CH']) missingWords(report, locale)
    expect(counted.mock.calls.filter(([given]) => given === report)).toHaveLength(1 + 2)
  })

  // A report in its own language alone has nothing to split.
  test('gives a report that declares no language its own diagnostics and no language', () => {
    const report = sampleReport()
    expect(diagnoseByLanguage(report)).toEqual({ diagnostics: diagnose(report), languages: [] })
  })
})
