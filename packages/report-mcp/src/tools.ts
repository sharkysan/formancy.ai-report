/**
 * What Formancy Report can be asked by a coding agent, as plain functions
 * from JSON to JSON (0088, after formancy.ai 0056).
 *
 * Apart from the server for the reason formancy's are: a tool that can only
 * be exercised through a transport is one nobody tests properly. Every
 * verdict here is another package's: report-spec's validator decides what a
 * report is, report-core's diagnostics what a render refuses, and its
 * registry and session what an edit does. Nothing here judges a report a
 * second way, so an agent is told what the builder, the validator and a
 * render would say, in the order they would say it, and whether the
 * report is within `MAX_REPORT_BYTES`, the bound a draft's body is held
 * to. What a save asks of the server's own state is the server's: that the
 * report's id is the template's, that every image it declares is kept
 * there, and that it maps no font (0049).
 *
 * None of these needs a server, a file or the network: each is a function
 * of its arguments, and the report an agent works on is the one it hands
 * over, which nothing here keeps.
 */
import { describeCommands, diagnose, openReportSession, reportFacts } from '@formancy/report-core'
import type { CommandDescriptor, Diagnostic, Refusal } from '@formancy/report-core'
import { MAX_REPORT_BYTES, reportHash, reportWords, validateReport, wordExpressionSites } from '@formancy/report-spec'
import type { ReportDefinition, ReportError } from '@formancy/report-spec'

/** A tool's answer: whether there is nothing to fix, one or two sentences for the model, and the part an agent acts on, which every tool gives. */
export interface ToolResult {
  /** False means the agent has something to fix before going on, or was refused. */
  readonly ok: boolean
  /**
   * True where the tool did what it was asked though `ok` is false: an
   * edit applied whose report is past `MAX_REPORT_BYTES`. Its answer is
   * the report the agent carries on from, so it is no call that ended in an
   * error, which the protocol's `isError` says (0088, 2026-11-27).
   */
  readonly applied?: true
  readonly summary: string
  readonly data: unknown
}

/** What a report the validator accepts is told: its hash, its size against the draft's bound, its own diagnostics, and each declared language's. */
export interface Verdict {
  readonly valid: true
  /** `reportHash` of the report: what an edit's `expectedHash` names. */
  readonly hash: string
  /**
   * The report's bytes as report-spec measures `MAX_REPORT_BYTES`, and the
   * bound; past it, `code` names the refusal a save gives a body that
   * large, before anything reads it (0049).
   */
  readonly size: { readonly bytes: number; readonly max: number; readonly code?: 'report-too-large' }
  /** The report's own diagnostics: an error here refuses every render. */
  readonly diagnostics: readonly Diagnostic[]
  /** Each language the report's translations declare, in their order: an error here refuses a render in that language alone. */
  readonly languages: readonly LanguageVerdict[]
}

/** What a language lacks that stands in the payment part: a word or an expression, by its source, and every place it stands. */
export interface ForPerson {
  readonly kind: 'word' | 'expression'
  readonly source: string
  /** The JSON Pointer to each place it stands, in document order; the first is where `word-missing` stands. */
  readonly paths: readonly [string, ...string[]]
}

/** A declared language's verdict: its diagnostics, and of what it lacks, what a person writes and no agent translates. */
export interface LanguageVerdict {
  readonly locale: string
  readonly diagnostics: readonly Diagnostic[]
  /**
   * Each word or expression the language lacks, among its `word-missing`,
   * that stands anywhere in the payment part: printed on the QR-bill's slip
   * and encoded in the code a bank reads, so a person's to write, and never
   * an agent's to translate (0039, 0048; 0088, 2026-11-28).
   */
  readonly forPerson: readonly ForPerson[]
}

/** Where the payment part stands in a report's JSON, by the definition's own key. */
const PAYMENT_PART = `/${'paymentPart' satisfies keyof ReportDefinition}/`

/**
 * What `locale` lacks in `report` that stands in the payment part: of the
 * `word-missing` among `found`, each word and expression by report-spec's
 * one walk of a report's words, with every place it stands, whose places
 * include one under `/paymentPart/` -- a word that also stands elsewhere
 * among them, since a word is translated once, wherever it stands. The
 * rule report-ai's request leaves the payment part to a person by (0085),
 * by the same walk. An e-invoice's texts are no words in it.
 */
function forPersonOf(report: ReportDefinition, found: readonly Diagnostic[]): ForPerson[] {
  const missingAt = new Set(found.filter(({ code }) => code === 'word-missing').map(({ path }) => path))
  const bySource = (places: readonly { readonly path: string; readonly source: string }[], kind: ForPerson['kind']): ForPerson[] => {
    const grouped = new Map<string, [string, ...string[]]>()
    for (const { path, source } of places) {
      const known = grouped.get(source)
      if (known === undefined) grouped.set(source, [path])
      else known.push(path)
    }
    return [...grouped].map(([source, paths]) => ({ kind, source, paths }))
  }
  return [
    ...bySource(
      reportWords(report).map(({ path, text }) => ({ path, source: text })),
      'word',
    ),
    ...bySource(
      wordExpressionSites(report).map(({ path, cel }) => ({ path, source: cel })),
      'expression',
    ),
  ].filter(({ paths }) => missingAt.has(paths[0]) && paths.some((path) => path.startsWith(PAYMENT_PART)))
}

/** How many of `found` are errors, and how many warnings, in words. */
function counted(found: readonly Diagnostic[]): string {
  const errors = found.filter(({ severity }) => severity === 'error').length
  return `${plural(errors, 'error')} and ${plural(found.length - errors, 'warning')}`
}

/** `count` and `noun`, in the plural but for one. */
export const plural = (count: number, noun: string): string => `${String(count)} ${noun}${count === 1 ? '' : 's'}`

const hasError = (found: readonly Diagnostic[]): boolean => found.some(({ severity }) => severity === 'error')

/** The UTF-8 length of `report`'s JSON: how report-spec states `MAX_REPORT_BYTES` is measured, and what a server counts of a draft's body. */
export const bytesOf = (report: unknown): number => new TextEncoder().encode(JSON.stringify(report)).byteLength

/** Whether `verdict`'s report is past the bound a draft is held to. */
const tooLarge = (verdict: Verdict): boolean => verdict.size.code !== undefined

/** The bound in a sentence, where `verdict`'s report is past it. */
const sizeSaid = (verdict: Verdict): string =>
  `It is ${String(verdict.size.bytes)} bytes as JSON, past MAX_REPORT_BYTES, ${String(verdict.size.max)}: a save refuses it as report-too-large before reading it.`

/**
 * `report`'s diagnostics, split as a render judges them: `diagnose` gives
 * the report's own first and then each declared language's, each naming
 * its language, so the split is by that name and nothing is diagnosed
 * twice.
 */
function verdictOf(report: ReportDefinition): Verdict {
  const found = diagnose(report)
  const bytes = bytesOf(report)
  return {
    valid: true,
    hash: reportHash(report),
    size: { bytes, max: MAX_REPORT_BYTES, ...(bytes > MAX_REPORT_BYTES ? { code: 'report-too-large' as const } : {}) },
    diagnostics: found.filter(({ language }) => language === undefined),
    languages: (report.translations ?? []).map(({ locale }) => {
      const diagnostics = found.filter(({ language }) => language === locale)
      return { locale, diagnostics, forPerson: forPersonOf(report, diagnostics) }
    }),
  }
}

/** What the validator refused, as an answer: the errors, in its order, each with its code, its JSON Pointer and its sentence. */
export function invalid(errors: readonly ReportError[], what: string): ToolResult {
  return {
    ok: false,
    summary: `${what} is not a report this version reads: the validator gives ${plural(errors.length, 'error')}, and a save refuses it until each is fixed. Fix them in order, by each error's path.`,
    data: { valid: false, errors },
  }
}

/** The verdict in a sentence: the report's own counts, then each language's. */
function said(verdict: Verdict): string {
  const languages = verdict.languages.map(({ locale, diagnostics }) => `in ${locale}, ${counted(diagnostics)}, an error refusing a render in ${locale} alone`)
  return [`${counted(verdict.diagnostics)} of its own, an error refusing every render`, ...languages].join('; ')
}

/**
 * Everything the format allows, and the traps, so a model need not guess:
 * without it a model writes a float where the format holds a decimal's
 * digits, a second detail dataset, or a translation keyed by a name it
 * invented, and spends a turn on each refusal. Report-core's facts, read
 * from the format's constants.
 */
export function describeFormat(): ToolResult {
  const facts = reportFacts()
  return {
    ok: true,
    summary:
      `Formancy Report reads reportSpecVersion "${facts.reportSpecVersion}", the draft. A component kind, a field type or a name ` +
      'an expression reads that is not listed here does not exist, whatever other report writers call it; read the notes before writing.',
    data: facts,
  }
}

/**
 * A report judged as the validator and a render judge it, without saving
 * or rendering anything: the validator, whose errors a save refuses; the
 * draft's bound, `MAX_REPORT_BYTES`; then the report's own diagnostics,
 * whose errors refuse every render; then each declared language's, whose
 * errors refuse a render in that language. A later list means nothing of a
 * report an earlier one refused, so a report the validator refuses is
 * answered with its errors alone.
 */
export function checkReport(report: unknown): ToolResult {
  const validation = validateReport(report)
  if (!validation.valid) return invalid(validation.errors, 'The document')
  const verdict = verdictOf(validation.report)
  const renders = !hasError(verdict.diagnostics) && verdict.languages.every(({ diagnostics }) => !hasError(diagnostics))
  const judged = `${renders ? 'Valid, and nothing refuses a render' : 'Valid, but a render is refused'}: ${said(verdict)}.`
  return {
    ok: renders && !tooLarge(verdict),
    summary: tooLarge(verdict) ? `${sizeSaid(verdict)} ${judged}` : judged,
    data: verdict,
  }
}

/** Every command report-core has, as the data a descriptor is, by its registry. */
export function listCommands(): ToolResult {
  const described = describeCommands()
  return {
    ok: true,
    summary:
      `${plural(described.commands.length, 'command')}, each written as { "command": name, "args": [...] }, its arguments after the report. ` +
      `apply_commands runs a list of at most ${String(described.maxBatchCommands)} as one edit; a batch inside it is refused. ` +
      'A command in partCommands may change whom a payment reaches: say so to the person before the report is used.',
    data: described,
  }
}

/**
 * A refusal as an answer: its code, its sentence, its place and the
 * validator's errors where it has them, and the hash of the report as
 * given -- but for a stale edit, whose obvious retry with that hash would
 * disarm the check without the agent reading the report again: it is told
 * to validate the report it means to edit instead.
 */
function refused(refusal: Refusal, hash: string): ToolResult {
  const { ok: _ok, ...reason } = refusal
  const said = `Refused, ${refusal.code}: ${refusal.message}. Nothing was applied: the report is as it was given.`
  if (refusal.code === 'stale-document')
    return {
      ok: false,
      summary: `${said} Call validate_report on the report you mean to edit, and write the commands against it and the hash it answers.`,
      data: { refusal: reason },
    }
  return { ok: false, summary: said, data: { refusal: reason, hash } }
}

/**
 * Commands applied to a report as one edit, through the builder's own
 * path: a session opened on the report, and the commands as one batch,
 * each step checked by the registry before it runs, the result validated
 * once, and a stale `expectedHash` refused before anything runs. A
 * refusal changes nothing; the new report is answered with its hash and
 * its verdict, so that the next edit can name the hash of the report it
 * was made against. An edit applied is `ok` though the report it made has
 * a diagnostic error -- a language just added lacks every word until the
 * next edit -- but not where the report is past `MAX_REPORT_BYTES`, which
 * no save takes and only another edit can bring back within it. That
 * answer is `applied`, and no error: the edit was made, and the report it
 * made is the one to edit next.
 */
export function applyCommands(report: unknown, commands: readonly unknown[], expectedHash?: string): ToolResult {
  const opening = openReportSession(report)
  if (!opening.ok) return invalid(opening.errors, 'The report given')
  const { session } = opening
  const before = session.revision()
  // A descriptor read from JSON is the registry's to judge; the batch checks every step before it runs one.
  const descriptor = { command: 'batch', args: [commands] } as unknown as CommandDescriptor
  const outcome = session.apply(descriptor, { label: 'apply_commands', ...(expectedHash === undefined ? {} : { expectedHash }) })
  if (!outcome.ok) return refused(outcome, session.hash())
  const changed = session.revision() !== before
  const verdict = verdictOf(session.document())
  const applied = changed
    ? `Applied ${plural(commands.length, 'command')} as one edit. The report now has ${said(verdict)}.`
    : `The ${plural(commands.length, 'command')} changed nothing: the report is as it was given, with ${said(verdict)}.`
  return {
    ok: !tooLarge(verdict),
    ...(tooLarge(verdict) ? { applied: true as const } : {}),
    summary: tooLarge(verdict) ? `${applied} ${sizeSaid(verdict)}` : applied,
    data: { changed, report: session.document(), ...verdict },
  }
}
