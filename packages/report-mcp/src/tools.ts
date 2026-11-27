/**
 * What Formancy Report can be asked by a coding agent, as plain functions
 * from JSON to JSON (0088, after formancy.ai 0056).
 *
 * Apart from the server for the reason formancy's are: a tool that can only
 * be exercised through a transport is one nobody tests properly. Every
 * verdict here is another package's: report-spec's validator decides what a
 * report is, report-core's diagnostics what a render refuses, and its
 * registry and session what an edit does. Nothing here judges a report a
 * second way, so an agent is told what the builder, a save and a render
 * would say, in the order they would say it.
 *
 * None of these needs a server, a file or the network: each is a function
 * of its arguments, and the report an agent works on is the one it hands
 * over, which nothing here keeps.
 */
import { describeCommands, diagnose, openReportSession, reportFacts } from '@formancy/report-core'
import type { CommandDescriptor, Diagnostic, Refusal } from '@formancy/report-core'
import { reportHash, validateReport } from '@formancy/report-spec'
import type { ReportDefinition, ReportError } from '@formancy/report-spec'

/** A tool's answer: whether there is nothing to fix, one or two sentences for the model, and the part an agent acts on, which every tool gives. */
export interface ToolResult {
  /** False means the agent has something to fix before going on, or was refused. */
  readonly ok: boolean
  readonly summary: string
  readonly data: unknown
}

/** What a report the validator accepts is told: its hash, its own diagnostics, and each declared language's. */
export interface Verdict {
  readonly valid: true
  /** `reportHash` of the report: what an edit's `expectedHash` names. */
  readonly hash: string
  /** The report's own diagnostics: an error here refuses every render. */
  readonly diagnostics: readonly Diagnostic[]
  /** Each language the report's translations declare, in their order: an error here refuses a render in that language alone. */
  readonly languages: readonly { readonly locale: string; readonly diagnostics: readonly Diagnostic[] }[]
}

/** How many of `found` are errors, and how many warnings, in words. */
function counted(found: readonly Diagnostic[]): string {
  const errors = found.filter(({ severity }) => severity === 'error').length
  return `${plural(errors, 'error')} and ${plural(found.length - errors, 'warning')}`
}

const plural = (count: number, noun: string): string => `${String(count)} ${noun}${count === 1 ? '' : 's'}`

const hasError = (found: readonly Diagnostic[]): boolean => found.some(({ severity }) => severity === 'error')

/**
 * `report`'s diagnostics, split as a render judges them: `diagnose` gives
 * the report's own first and then each declared language's, each naming
 * its language, so the split is by that name and nothing is diagnosed
 * twice.
 */
function verdictOf(report: ReportDefinition): Verdict {
  const found = diagnose(report)
  return {
    valid: true,
    hash: reportHash(report),
    diagnostics: found.filter(({ language }) => language === undefined),
    languages: (report.translations ?? []).map(({ locale }) => ({ locale, diagnostics: found.filter(({ language }) => language === locale) })),
  }
}

/** What the validator refused, as an answer: the errors, in its order, each with its code, its JSON Pointer and its sentence. */
function invalid(errors: readonly ReportError[], what: string): ToolResult {
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
 * A report judged as a save and a render judge it, without saving or
 * rendering anything: the validator, whose errors a save refuses; then the
 * report's own diagnostics, whose errors refuse every render; then each
 * declared language's, whose errors refuse a render in that language. A
 * later list means nothing of a report an earlier one refused, so a report
 * the validator refuses is answered with its errors alone.
 */
export function checkReport(report: unknown): ToolResult {
  const validation = validateReport(report)
  if (!validation.valid) return invalid(validation.errors, 'The document')
  const verdict = verdictOf(validation.report)
  const clean = !hasError(verdict.diagnostics) && verdict.languages.every(({ diagnostics }) => !hasError(diagnostics))
  return {
    ok: clean,
    summary: `${clean ? 'Valid, and nothing refuses a render' : 'Valid, and a save takes it, but a render is refused'}: ${said(verdict)}.`,
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

/** A refusal as an answer: its code, its sentence, its place and the validator's errors where it has them, and the hash of the report as given. */
function refused(refusal: Refusal, hash: string): ToolResult {
  const { ok: _ok, ...reason } = refusal
  return {
    ok: false,
    summary: `Refused, ${refusal.code}: ${refusal.message}. Nothing was applied: the report is as it was given.`,
    data: { refusal: reason, hash },
  }
}

/**
 * Commands applied to a report as one edit, through the builder's own
 * path: a session opened on the report, and the commands as one batch,
 * each step checked by the registry before it runs, the result validated
 * once, and a stale `expectedHash` refused before anything runs. A
 * refusal changes nothing; the new report is answered with its hash and
 * its verdict, so that the next edit can name the hash of the report it
 * was made against.
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
  return {
    ok: true,
    summary: changed
      ? `Applied ${plural(commands.length, 'command')} as one edit. The report now has ${said(verdict)}.`
      : `The ${plural(commands.length, 'command')} changed nothing: the report is as it was given, with ${said(verdict)}.`,
    data: { changed, report: session.document(), ...verdict },
  }
}
