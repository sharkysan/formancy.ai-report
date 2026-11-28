import { addLanguage, insertComponent, translateExpression, translateWord, wordExpressions } from '@formancy/report-core'
import { MAX_INLINES, NOT_WORDS, reportWords, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition, TextComponent } from '@formancy/report-spec'
import { readAnswer } from '../turn/ask.js'
import type { Checkable } from '../turn/ask.js'

/**
 * What the translation suites share, and the package never imports: a
 * report with a language added and half of it written, a report grown by
 * paragraphs of numbered words, and the strings a report holds where no
 * word stands, read by report-spec's own `NOT_WORDS`. No Node: the
 * package's typecheck reads this file too.
 */

/** The first of these a report declares no language in: the one a suite adds. */
const SPARE_LOCALES = ['fr-CH', 'nl', 'es', 'pl'] as const

/** `report` with a language it does not declare added, nothing written in it yet, and that language. */
export function withLanguage(report: ReportDefinition): { readonly report: ReportDefinition; readonly locale: string } {
  const declared = new Set([report.locale, ...(report.translations ?? []).map(({ locale }) => locale)])
  const locale = SPARE_LOCALES.find((spare) => !declared.has(spare)) as string
  const added = addLanguage(report, locale)
  if (!added.ok) throw new Error(added.message)
  return { report: added.report, locale }
}

/** `report` with each word and word expression `chosen` picks written in `locale` as its own source, a translation the format and the compiler accept. */
function written(report: ReportDefinition, locale: string, chosen: (index: number, source: string) => boolean): ReportDefinition {
  const words = [...new Set(reportWords(report).map(({ text }) => text))]
  const expressions = [...new Set(wordExpressions(report).map(({ cel }) => cel))]
  let working = report
  for (const [index, word] of words.entries()) {
    if (!chosen(index, word)) continue
    const outcome = translateWord(working, locale, word, word)
    if (!outcome.ok) throw new Error(outcome.message)
    working = outcome.report
  }
  for (const [index, cel] of expressions.entries()) {
    if (!chosen(index, cel)) continue
    const outcome = translateExpression(working, locale, cel, { cel })
    if (!outcome.ok) throw new Error(outcome.message)
    working = outcome.report
  }
  return working
}

/** `report` with every other word and word expression of `locale` written, and every word of the payment part's message. */
export function halfWritten(report: ReportDefinition, locale: string): ReportDefinition {
  const message = new Set(reportWords(report).flatMap(({ path, text }) => (path.startsWith('/paymentPart/') ? [text] : [])))
  return written(report, locale, (index, source) => index % 2 === 0 || message.has(source))
}

/** `report` with every word and word expression of `locale` written: a language that lacks nothing. */
export function allWritten(report: ReportDefinition, locale: string): ReportDefinition {
  return written(report, locale, () => true)
}

/** A JSON Pointer's segments, unescaped. */
const segmentsOf = (path: string): readonly string[] => (path === '' ? [] : path.slice(1).split('/'))

/** Whether `segments` match `pattern`: `*` any one segment, `**` any number of them, as `NOT_WORDS` writes them. */
function matchSegments(pattern: readonly string[], segments: readonly string[]): boolean {
  if (pattern.length === 0) return segments.length === 0
  const [head, ...rest] = pattern
  if (head === '**') return segments.some((_, index) => matchSegments(rest, segments.slice(index))) || matchSegments(rest, [])
  return segments.length > 0 && (head === '*' || head === segments[0]) && matchSegments(rest, segments.slice(1))
}

/** The `NOT_WORDS` pattern `path` matches in `report`, or undefined: an absolute one, or one relative to the innermost component around it. */
export function notAWord(report: ReportDefinition, path: string): string | undefined {
  const owner = walkComponents(report)
    .filter((location) => path.startsWith(`${location.path}/`))
    .at(-1)
  for (const { at } of NOT_WORDS) {
    for (const pattern of at) {
      const colon = pattern.indexOf(':')
      if (colon === -1) {
        if (matchSegments(segmentsOf(pattern), segmentsOf(path))) return pattern
        continue
      }
      const kind = pattern.slice(0, colon)
      if (owner === undefined || (kind !== '*' && kind !== owner.component.kind)) continue
      if (matchSegments(segmentsOf(pattern.slice(colon + 1)), segmentsOf(path.slice(owner.path.length)))) return pattern
    }
  }
  return undefined
}

/** Every string `value` holds, at its JSON Pointer, in document order. */
export function stringsIn(value: unknown, path = ''): readonly { readonly path: string; readonly text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((item, index) => stringsIn(item, `${path}/${String(index)}`))
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, item]) => stringsIn(item, `${path}/${key}`))
}

/**
 * Whether `user` holds `text`, as written or as JSON escapes it. A string
 * that holds no letter -- an amount, a date, a code -- is looked for as a
 * whole JSON string, quotes and all, since the request's own keys and
 * counts are digits that would hold it otherwise.
 */
export function holds(user: string, text: string): boolean {
  if (!/\p{L}/u.test(text)) return user.includes(JSON.stringify(text))
  return user.includes(text) || user.includes(JSON.stringify(text).slice(1, -1))
}

/** What `readAnswer` finds in `text`, as the run hands it to a check: never a decline, which ends a run before any check. */
export function checkable(text: string): Checkable {
  const read = readAnswer(text)
  if (read?.kind === 'declined') throw new Error(`a decline is no answer to check: ${read.reason}`)
  return read
}

/** `report` with paragraphs of `words` put at the head of its body, `MAX_INLINES` runs a paragraph, each run one word. */
export function withWords(report: ReportDefinition, words: readonly string[]): ReportDefinition {
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
export const numbered = (count: number, length = 0): string[] =>
  Array.from({ length: count }, (_, index) => `Wort ${String(index).padStart(4, '0')} ${'a'.repeat(length)}`)

/** `report` with each of `words` written in `locale` as itself. */
export function writtenAsThemselves(report: ReportDefinition, locale: string, words: readonly string[]): ReportDefinition {
  let working = report
  for (const word of words) {
    const outcome = translateWord(working, locale, word, word)
    if (!outcome.ok) throw new Error(outcome.message)
    working = outcome.report
  }
  return working
}
