/**
 * What the diagnostics say of a report in a language its translations
 * declare (0063), each diagnostic naming that language.
 *
 * - **`word-missing`.** Each word the language does not translate, and
 *   each expression that prints words it does not, once, at the first
 *   place it stands. An expression run where a word stands prints words
 *   where it gives text -- a string, or a value the compiler cannot tell,
 *   which may be one -- its run prints it as text, and its source holds a
 *   quote: CEL writes every string literal between quotes, so the test
 *   can call too many expressions words and never too few, without a
 *   parser of its own.
 * - **`translation-differs`.** A translated expression that would print
 *   another thing than its source: another type, a member read that its
 *   source does not read or one it does not read that its source does, or
 *   a translation of an expression that prints no words -- a number is no
 *   language's.
 * - **Every diagnostic the report written in the language gives that its
 *   own does not**, through the same `diagnosis`: so a translation is held
 *   to every rule the report is, by the compilation that holds the
 *   report's own -- an expression's errors at each place its source
 *   stands, an e-invoice's total its page prints -- and what is decided
 *   once is not decided again here.
 * - **`unused-translation`.** A translation of a word, or of an
 *   expression, the report no longer prints: a warning, and never printed.
 *
 * A word missing leaves the report valid, so that a session, a builder and
 * a server can hold a report being translated; it is never printed in
 * another language, and the runtime refuses a render in a language whose
 * errors are not all answered.
 */
import { reportWords, wordExpressionSites, writtenIn } from '@formancy/report-spec'
import type { ReportDefinition, Translation, WordExpressionSite } from '@formancy/report-spec'
import type { CompiledExpression } from '../expressions/compile-site.js'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic, Where } from './codes.js'
import { diagnosis } from './diagnosis.js'
import type { Diagnosis } from './diagnosis.js'

/** The types an expression gives that may print as text: a string, or a value the compiler cannot tell. */
const TEXT: ReadonlySet<string> = new Set(['string', 'dyn'])

/** A quote of either kind CEL writes a string literal between. */
const QUOTE = /["']/

/** What an expression run where a word stands prints, as its own language's compilation tells: words, a value that is none, or what an error keeps from being known. */
type Verdict =
  { readonly kind: 'words'; readonly compiled: CompiledExpression } | { readonly kind: 'value'; readonly type: string } | { readonly kind: 'unknown' }

function verdict(site: WordExpressionSite, own: Diagnosis): Verdict {
  const compiled = own.compiled.expressions.get(site.path)
  // A source the compiler refuses has its own error, which refuses every render.
  if (compiled === undefined) return { kind: 'unknown' }
  const type = compiled.program.resultType
  const format = compiled.site.format?.kind
  if (TEXT.has(type) && (format === undefined || format === 'text') && QUOTE.test(site.cel)) return { kind: 'words', compiled }
  return { kind: 'value', type: format === undefined || format === 'text' ? type : `${type}, printed as a ${format}` }
}

/** Every member an expression reads, as `name.member`, sorted. */
function readsOf(compiled: CompiledExpression): readonly string[] {
  return compiled.reads.map(({ name, member }) => `${name}.${member}`).sort()
}

/** A diagnostic's identity, to tell one the written report gives from one the report's own gives. */
const keyOf = ({ code, path, message, position }: Diagnostic): string => `${code} ${path} ${message} ${position?.start ?? ''} ${position?.end ?? ''}`

/** Where a diagnostic about a site points, in `language`, at `path`. */
const atSite = (site: WordExpressionSite, path: string, language: string): Where => ({
  path,
  componentId: site.componentId,
  columnId: site.columnId,
  language,
})

/** The diagnostics of the translated expression at `entry`, standing at `sites`: one that prints no words, or one whose translation would print another thing. */
function expressionDifferences(sites: readonly WordExpressionSite[], entry: string, own: Diagnosis, written: Diagnosis, language: string): Diagnostic[] {
  return sites.flatMap((site): Diagnostic[] => {
    const said = verdict(site, own)
    if (said.kind === 'unknown') return []
    if (said.kind === 'value') {
      const message = `this expression prints ${said.type}, not words, and only an expression that prints words is translated: in ${language} it would print another value than in the report's own language`
      return [diagnostic('translation-differs', message, atSite(site, entry, language))]
    }
    const translation = written.compiled.expressions.get(site.path)
    // A translation the compiler refuses has the compiler's errors, given with the written report's.
    if (translation === undefined) return []
    const [source, theirs] = [said.compiled.program.resultType, translation.program.resultType]
    if (source !== theirs) {
      const message = `the translation in ${language} gives ${theirs}, and the expression it translates gives ${source}: a translation prints what its expression prints, in other words`
      return [diagnostic('translation-differs', message, atSite(site, entry, language))]
    }
    const [reads, translated] = [readsOf(said.compiled), readsOf(translation)]
    if (reads.join(' ') === translated.join(' ')) return []
    const message = `the translation in ${language} reads ${translated.join(', ') || 'nothing'}, and the expression it translates reads ${reads.join(', ') || 'nothing'}: a translation reads exactly what its expression reads, so that what reads a field is the expression's alone`
    return [diagnostic('translation-differs', message, atSite(site, entry, language))]
  })
}

/** Each word, and each expression that prints words, that `translation` does not translate: once, at the first place it stands. */
function missing(report: ReportDefinition, translation: Translation, sites: readonly WordExpressionSite[], own: Diagnosis): Diagnostic[] {
  const language = translation.locale
  const words = new Set(translation.words.map(({ word }) => word))
  const expressions = new Set(translation.expressions.map(({ cel }) => cel))
  const said = new Set<string>()
  const refused = `a render in ${language} is refused until it has one, and never prints it in another language`
  const literal = reportWords(report).flatMap((place): Diagnostic[] => {
    if (words.has(place.text) || said.has(place.text)) return []
    said.add(place.text)
    return [diagnostic('word-missing', `${quote(place.text)} has no translation in ${language}: ${refused}`, { ...place, language })]
  })
  const computed = sites.flatMap((site): Diagnostic[] => {
    if (expressions.has(site.cel) || said.has(site.cel) || verdict(site, own).kind !== 'words') return []
    said.add(site.cel)
    return [diagnostic('word-missing', `this expression prints words, and has no translation in ${language}: ${refused}`, atSite(site, site.path, language))]
  })
  return [...literal, ...computed]
}

/**
 * The diagnostics of `report` in `locale`, a language its translations
 * declare, `own` its diagnosis in its own: none for its own language, or
 * one it does not declare.
 */
export function inLanguage(report: ReportDefinition, locale: string, own: Diagnosis): Diagnostic[] {
  const index = (report.translations ?? []).findIndex((translation) => translation.locale === locale)
  const translation = report.translations?.[index]
  if (translation === undefined) return []
  const base = `/translations/${index}`
  const sites = wordExpressionSites(report)
  const written = diagnosis(writtenIn(report, locale))
  const entries = new Map(translation.expressions.map(({ cel }, entry) => [cel, `${base}/expressions/${entry}/expression/cel`]))
  // Where a translated expression stands, the written report's diagnostic is the translation's, and points at it.
  const translatedAt = new Map(sites.flatMap((site) => (entries.has(site.cel) ? [[site.path, entries.get(site.cel) as string] as const] : [])))
  const differences = translation.expressions.flatMap(({ cel }, entry) =>
    expressionDifferences(
      sites.filter((site) => site.cel === cel),
      `${base}/expressions/${entry}/expression/cel`,
      own,
      written,
      locale,
    ),
  )
  const ownKeys = new Set(own.diagnostics.map(keyOf))
  const added = written.diagnostics
    .filter((found) => !ownKeys.has(keyOf(found)))
    .map((found): Diagnostic => ({ ...found, path: translatedAt.get(found.path) ?? found.path, message: `in ${locale}, ${found.message}`, language: locale }))
  const printed = new Set(reportWords(report).map(({ text }) => text))
  const placed = new Set(sites.map(({ cel }) => cel))
  const unused = [
    ...translation.words.flatMap(({ word }, entry) =>
      printed.has(word)
        ? []
        : [
            diagnostic('unused-translation', `the report prints no ${quote(word)} to translate: this translation is kept for nothing`, {
              path: `${base}/words/${entry}`,
              language: locale,
            }),
          ],
    ),
    ...translation.expressions.flatMap(({ cel }, entry) =>
      placed.has(cel)
        ? []
        : [
            diagnostic('unused-translation', 'the report prints this expression nowhere a word stands: this translation is kept for nothing', {
              path: `${base}/expressions/${entry}`,
              language: locale,
            }),
          ],
    ),
  ]
  return [...missing(report, translation, sites, own), ...differences, ...added, ...unused]
}

/**
 * Every expression run of `report` -- a report the validator accepts --
 * where a word stands that prints words, in document order: what a
 * language translates, as `word-missing` says of each, and what the
 * builders mark and edit as a word (0063). The one verdict the diagnostics
 * give, so that the two never disagree.
 */
export function wordExpressions(report: ReportDefinition): readonly WordExpressionSite[] {
  const own = diagnosis(report)
  return wordExpressionSites(report).filter((site) => verdict(site, own).kind === 'words')
}

/**
 * Every diagnostic of `report` -- a report the validator accepts -- in
 * `locale`, a language its translations declare, each naming it: what a
 * render in that language is refused for, beside the report's own errors,
 * which refuse every render. None for the report's own language, whose
 * are `diagnose`'s, or for one it does not declare.
 */
export function languageDiagnostics(report: ReportDefinition, locale: string): Diagnostic[] {
  return inLanguage(report, locale, diagnosis(report))
}
