import {
  E_INVOICE_SAMPLES,
  EURO_INVOICE_SAMPLES,
  INVOICE_LANGUAGES,
  INVOICE_SAMPLES,
  SERVICE_INSPECTION,
  SITE_VISIT_REPORT,
  STARTERS,
  XRECHNUNG_SAMPLES,
} from '@formancy/report-corpus'
import { insertComponent, MAX_BATCH_COMMANDS, translateWord } from '@formancy/report-core'
import { MAX_INLINES, MAX_TEXT_LENGTH, MAX_WORDS } from '@formancy/report-spec'
import type { ReportDefinition, TextComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { MAX_MODEL_REQUEST_BYTES, requestBytes } from '../limits.js'
import type { AskModel } from '../turn/ask.js'
import { declinedAnswer } from '../turn/ask.js'
import { translateMissing } from './reader.js'
import { translationRequest } from './request.js'
import type { TranslationRequest } from './request.js'
import { withLanguage } from './test-support.js'

/**
 * The bounds a translation's turn is held to (0085): the bytes of a turn's
 * request, measured on the corpus and held to the factors
 * `MAX_MODEL_REQUEST_BYTES`'s comment states, refused one past it before
 * anything is asked; and the entries of a turn, one answer one batch.
 */

/** Every report the corpus holds, once each, as `report-size.test.ts` holds them to a draft's bound. */
const REPORTS = new Map<string, ReportDefinition>([
  ...[...STARTERS, ...INVOICE_SAMPLES, ...EURO_INVOICE_SAMPLES, ...E_INVOICE_SAMPLES, ...XRECHNUNG_SAMPLES].map(
    (starter) => [starter.id, starter.report] as const,
  ),
  ['site-visit-report', SITE_VISIT_REPORT],
  [INVOICE_LANGUAGES.id, INVOICE_LANGUAGES],
])

/** The factor the bound's comment states over the largest request the corpus makes. */
const MARGIN = 16

function requestOf(report: ReportDefinition, locale: string): TranslationRequest {
  const made = translationRequest(report, locale)
  if (!made.ok) throw new Error(`refused at ${String(made.bytes)} bytes`)
  return made.request
}

/** `report` with paragraphs of `words` appended to its body, `MAX_INLINES` runs a paragraph, each run one word. */
function withWords(report: ReportDefinition, words: readonly string[]): ReportDefinition {
  let working = report
  for (let start = 0; start < words.length; start += MAX_INLINES) {
    const paragraph: TextComponent = {
      id: `words-${String(start)}`,
      kind: 'text',
      content: words.slice(start, start + MAX_INLINES).map((text) => ({ kind: 'text', text })),
    }
    const inserted = insertComponent(working, { region: 'body', index: 0 }, paragraph)
    if (!inserted.ok) throw new Error(inserted.message)
    working = inserted.report
  }
  return working
}

/** `count` words, each told from the others by its number. */
const numbered = (count: number, length = 0): string[] =>
  Array.from({ length: count }, (_, index) => `Wort ${String(index).padStart(4, '0')} ${'a'.repeat(length)}`)

describe('the bytes of a turn', () => {
  // The bound's comment states what it holds: a turn of MAX_BATCH_COMMANDS
  // entries as large as the corpus's largest, and sixteen times its
  // largest request. A starter grown toward it, or a bound lowered toward
  // the starters, would refuse a report the Studio offers, and one
  // raised past the least power of two would state a number nobody chose.
  test("holds a full turn of entries like the corpus's, and sixteen times its largest request, at the least power of two that does", () => {
    const measured = [...REPORTS.values()].map((each) => {
      const { report, locale } = withLanguage(each)
      return requestOf(report, locale)
    })
    const largest = Math.max(...measured.map(({ bytes }) => bytes))
    const perEntry = Math.max(...measured.map(({ bytes, asked }) => bytes / asked.length))
    expect(MAX_MODEL_REQUEST_BYTES).toBeGreaterThanOrEqual(largest * MARGIN)
    expect(MAX_MODEL_REQUEST_BYTES).toBeGreaterThanOrEqual(MAX_BATCH_COMMANDS * perEntry)
    expect(MAX_MODEL_REQUEST_BYTES / 2).toBeLessThan(MAX_BATCH_COMMANDS * perEntry)
    expect(Number.isInteger(Math.log2(MAX_MODEL_REQUEST_BYTES))).toBe(true)
  })

  // A request a host's server refuses for its size would be paid for in a
  // round trip, and through a relay pasted for nothing; refused here, it
  // never leaves. The bound itself is a request like any other.
  test('refuses a request one byte past the bound before anything is asked, and asks one at it', async () => {
    const base = withLanguage(SERVICE_INSPECTION.report)
    const sized = (lengths: readonly number[]): ReportDefinition =>
      withWords(
        base.report,
        lengths.map((length, index) => `Langes Wort ${String(index)} ${'a'.repeat(length)}`),
      )
    const bytesOf = (report: ReportDefinition): number => {
      const made = translationRequest(report, base.locale)
      return made.ok ? made.request.bytes : made.bytes
    }
    const full = MAX_TEXT_LENGTH - 20
    let count = 1
    while (bytesOf(sized(Array.from({ length: count }, () => full))) <= MAX_MODEL_REQUEST_BYTES) count += 1
    const over = bytesOf(sized(Array.from({ length: count }, () => full))) - MAX_MODEL_REQUEST_BYTES
    const at = (extra: number): ReportDefinition => sized([...Array.from({ length: count - 1 }, () => full), full - over + extra])

    const past = at(1)
    expect(bytesOf(past)).toBe(MAX_MODEL_REQUEST_BYTES + 1)
    expect(translationRequest(past, base.locale)).toEqual({
      ok: false,
      code: 'request-too-large',
      bytes: MAX_MODEL_REQUEST_BYTES + 1,
      max: MAX_MODEL_REQUEST_BYTES,
    })
    const asked: string[] = []
    const ask: AskModel<'translation'> = (prompt) => {
      asked.push(prompt.user)
      return Promise.resolve(declinedAnswer('scripted'))
    }
    expect(await translateMissing(ask, past, base.locale)).toEqual({
      ok: false,
      ended: 'too-large',
      attempts: 0,
      bytes: MAX_MODEL_REQUEST_BYTES + 1,
      max: MAX_MODEL_REQUEST_BYTES,
    })
    expect(asked).toEqual([])

    const bound = at(0)
    expect(bytesOf(bound)).toBe(MAX_MODEL_REQUEST_BYTES)
    expect(await translateMissing(ask, bound, base.locale)).toMatchObject({ ok: false, ended: 'declined', attempts: 1 })
    expect(asked).toHaveLength(1)

    // A request measured by its first turn alone would pass here and have
    // its second turn, the complaint after it, refused by a server bounded
    // by the same number. Every answer that is none is answered, in turn,
    // and no turn a run sends is past the bound.
    const turns: number[] = []
    for (const wrong of [
      'prose',
      '{"words": {}}',
      '{"into": "it-CH"}',
      '{"into": "fr-CH", "words": []}',
      '{"into": "fr-CH", "expressions": []}',
      '{"declined": ""}',
    ]) {
      const answers = [wrong, declinedAnswer('scripted')]
      const once: AskModel<'translation'> = (prompt) => {
        turns.push(requestBytes(prompt.user))
        return Promise.resolve(answers[prompt.attempt - 1] ?? '')
      }
      await translateMissing(once, bound, base.locale)
    }
    expect(Math.max(...turns)).toBe(MAX_MODEL_REQUEST_BYTES)
  })
})

describe('the entries of a turn', () => {
  // One answer is one batch, and a batch holds at most MAX_BATCH_COMMANDS
  // commands (0048): a turn that asked more would bring back an answer no
  // session could apply as one step.
  test('asks at most MAX_BATCH_COMMANDS entries, and the rest in a turn of its own', () => {
    const { report, locale } = withLanguage(SERVICE_INSPECTION.report)
    const lacking = requestOf(report, locale).asked.length
    const request = requestOf(withWords(report, numbered(MAX_BATCH_COMMANDS)), locale)
    expect(request.asked).toHaveLength(MAX_BATCH_COMMANDS)
    expect(request.later).toBe(lacking)
    expect(request.asked.at(-1)?.key).toBe(`w${String(MAX_BATCH_COMMANDS)}`)
  })

  // A translation holds at most MAX_WORDS words (0063): asking a language
  // with no room left for more would bring back words the format refuses
  // to keep, every one of them.
  test('asks no more words than the language has room for, and the rest later', () => {
    const { report, locale } = withLanguage(SERVICE_INSPECTION.report)
    const words = numbered(MAX_WORDS + 10)
    let working = withWords(report, words)
    for (const word of words.slice(0, MAX_WORDS - 4)) {
      const written = translateWord(working, locale, word, word)
      if (!written.ok) throw new Error(written.message)
      working = written.report
    }
    const request = requestOf(working, locale)
    const lacking = requestOf(report, locale).asked.length + 14
    expect(request.asked).toHaveLength(4)
    expect(request.later).toBe(lacking - 4)
  })
})
