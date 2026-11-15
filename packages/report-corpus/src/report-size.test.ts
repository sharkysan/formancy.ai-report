import type { ReportDefinition } from '@formancy/report-runtime'
import { MAX_LANGUAGES, MAX_REPORT_BYTES, MAX_WORDS, reportWords, wordExpressionSites } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { SITE_VISIT_REPORT } from './forms/site-visit.js'
import { E_INVOICE_SAMPLES, EURO_INVOICE_SAMPLES, INVOICE_LANGUAGES, INVOICE_SAMPLES, STARTERS, XRECHNUNG_SAMPLES } from './starters/index.js'

/** The factor `MAX_REPORT_BYTES`'s comment in report-spec's `limits.ts` states, which this file is the guard of. */
const MARGIN = 16

/** The bytes of a report as the draft's route reads it: the UTF-8 of its JSON, which is what a client sends. */
function serialisedBytes(report: ReportDefinition): number {
  return new TextEncoder().encode(JSON.stringify(report)).byteLength
}

/** Every report the corpus holds, once each: the starters and the samples that share their definitions, then the site visit's and the invoice in four languages (0063). */
const REPORTS = new Map<string, ReportDefinition>([
  ...[...STARTERS, ...INVOICE_SAMPLES, ...EURO_INVOICE_SAMPLES, ...E_INVOICE_SAMPLES, ...XRECHNUNG_SAMPLES].map(
    (starter) => [starter.id, starter.report] as const,
  ),
  ['site-visit-report', SITE_VISIT_REPORT],
  [INVOICE_LANGUAGES.id, INVOICE_LANGUAGES],
])

describe('the size a report may have as a draft', () => {
  // A starter grown past the limit would be a report the Studio offers that
  // no server keeps: the draft's route would refuse the first save of what
  // a new author opened.
  test.each([...REPORTS])('%s fits MAX_REPORT_BYTES', (_id, report) => {
    expect(serialisedBytes(report)).toBeLessThanOrEqual(MAX_REPORT_BYTES)
  })

  // The limit's comment states the factor it leaves over the largest report
  // the corpus holds. Without this, a starter that grew toward the limit, or
  // a limit lowered toward the starters, would leave the comment stating a
  // margin nobody has: the first report a person adds to would be refused
  // on its next save.
  test('leaves the factor limits.ts states over the largest report the corpus holds', () => {
    const largest = Math.max(...[...REPORTS.values()].map(serialisedBytes))
    expect(MAX_REPORT_BYTES).toBeGreaterThanOrEqual(largest * MARGIN)
  })
})

/** The words and word expressions a report would ask a translation for: its distinct words, and the distinct sources of the expression runs where words stand. */
function wordsOf(report: ReportDefinition): { readonly words: readonly string[]; readonly expressions: readonly string[] } {
  return {
    words: [...new Set(reportWords(report).map(({ text }) => text))],
    expressions: [...new Set(wordExpressionSites(report).map(({ cel }) => cel))],
  }
}

describe('the words a translation may hold', () => {
  // MAX_WORDS's comment in report-spec's limits.ts states the factor it
  // leaves over the corpus's report with the most words. A starter grown
  // toward it, or a bound lowered toward the starters, would leave a
  // report the Studio offers that no language could be written in whole.
  test('leaves the factor limits.ts states over the report the corpus holds with the most words', () => {
    const most = Math.max(...[...REPORTS.values()].map((report) => wordsOf(report).words.length + wordsOf(report).expressions.length))
    expect(MAX_WORDS).toBeGreaterThanOrEqual(most * MARGIN)
  })

  // The same comment says the richest report written in every language a
  // report may have still fits a draft: one that did not would be a report
  // a server refuses to keep once its last language is added.
  test('keeps every report written in MAX_LANGUAGES languages inside MAX_REPORT_BYTES', () => {
    for (const report of REPORTS.values()) {
      const { words, expressions } = wordsOf(report)
      const translations = Array.from({ length: MAX_LANGUAGES - 1 }, (_, index) => ({
        locale: `x${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
        words: words.map((word) => ({ word, text: word })),
        expressions: expressions.map((cel) => ({ cel, expression: { cel } })),
      }))
      expect(serialisedBytes({ ...report, translations })).toBeLessThanOrEqual(MAX_REPORT_BYTES)
    }
  })
})
