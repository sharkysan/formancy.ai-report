import { describeCommands, diagnose, languageDiagnostics, reportFacts } from '@formancy/report-core'
import { STARTERS, QUOTATION } from '@formancy/report-corpus'
import { reportHash } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { applyCommands, checkReport, describeFormat, listCommands } from './tools.js'
import type { ToolResult } from './tools.js'

/**
 * The tools as plain functions, over the corpus's starters (0088).
 *
 * What a tool decides is tested here, without a protocol; `server.test.ts`
 * holds that each is reachable and that its arguments survive the trip.
 * Every verdict is the package's own -- report-spec's validator,
 * report-core's diagnostics, its registry and its session -- so each case
 * holds a tool's answer to what that package says of the same report,
 * never to a verdict written out here.
 */

/** The `data` a tool answered with, as the shape the case reads. */
const dataOf = <T>(result: ToolResult): T => result.data as T

interface Verdict {
  readonly valid: true
  readonly hash: string
  readonly diagnostics: readonly { readonly code: string; readonly severity: string; readonly language?: string }[]
  readonly languages: readonly { readonly locale: string; readonly diagnostics: readonly { readonly code: string; readonly severity: string }[] }[]
}

interface Refused {
  readonly refusal: { readonly code: string; readonly message: string; readonly path?: string; readonly errors?: readonly unknown[] }
  readonly hash?: string
}

const quotation = QUOTATION.report

describe('describe_format', () => {
  // Typed into the tool, the facts would describe the format one release
  // behind; they are report-core's, which reads report-spec's constants.
  test('answers report-core’s facts, which need no server', () => {
    const result = describeFormat()
    expect(result.ok).toBe(true)
    expect(result.data).toEqual(reportFacts())
    expect(result.summary).toContain(`"${reportFacts().reportSpecVersion}"`)
  })
})

describe('validate_report', () => {
  // A tool that called a starter wrong would teach an agent to "fix" a
  // report every builder opens; each is judged as report-core judges it.
  test('passes every starter, with report-core’s own diagnostics and each declared language’s', () => {
    expect(STARTERS.length).toBeGreaterThan(5)
    for (const { id, report } of STARTERS) {
      const result = checkReport(report)
      const verdict = dataOf<Verdict>(result)
      expect(verdict.valid, id).toBe(true)
      expect(verdict.hash, id).toBe(reportHash(report))
      expect(verdict.diagnostics, id).toEqual(diagnose(report).filter((found) => found.language === undefined))
      expect(
        verdict.languages.map(({ locale }) => locale),
        id,
      ).toEqual((report.translations ?? []).map(({ locale }) => locale))
      for (const { locale, diagnostics } of verdict.languages) expect(diagnostics, `${id} in ${locale}`).toEqual(languageDiagnostics(report, locale))
      // A warning prints as written, so a starter with no error is ok.
      expect(result.ok, id).toBe(diagnose(report).every(({ severity }) => severity !== 'error'))
    }
  })

  // The three lists are the order a save, a render and a language's render
  // judge in: a language's errors listed among the report's own would read
  // as refusing every render, when they refuse that language's alone.
  test('lists a declared language’s errors under it, and not among the report’s own', () => {
    const french = applyCommands(quotation, [{ command: 'addLanguage', args: ['fr-CH'] }])
    const { report } = dataOf<{ report: ReportDefinition }>(french)
    const result = checkReport(report)
    const verdict = dataOf<Verdict>(result)
    expect(verdict.diagnostics.filter(({ severity }) => severity === 'error')).toEqual([])
    const [language] = verdict.languages
    expect(language?.locale).toBe('fr-CH')
    expect(language?.diagnostics.length).toBeGreaterThan(0)
    expect(language?.diagnostics.every(({ code }) => code === 'word-missing')).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.summary).toContain('fr-CH')
  })

  // A report the validator refuses is never diagnosed: the diagnostics
  // read a valid report, and a save refuses this one before anything else.
  test('answers the validator’s errors for a document that is no report, and nothing else', () => {
    const result = checkReport({ specVersion: '4', id: 'contact', title: 'Contact', model: { fields: [] } })
    expect(result.ok).toBe(false)
    expect(result.data).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'not-a-report', path: '' })] })
    expect(result.summary).toContain('save')
  })

  // A broken document deep inside: the error's JSON Pointer is what an
  // agent fixes by, so it is the validator's, unchanged.
  test('gives each error its code, its path and its sentence as the validator does', () => {
    const broken = { ...quotation, page: { ...quotation.page, size: 'A3' } }
    const { errors } = dataOf<{ errors: readonly { code: string; path: string; message: string }[] }>(checkReport(broken))
    expect(errors).toEqual([expect.objectContaining({ path: '/page/size' })])
    expect(errors[0]?.message).not.toBe('')
  })
})

describe('describe_commands', () => {
  // The registry's own description, so a command added to report-core is
  // a command an agent is told about, and none is typed into the tool.
  test('answers report-core’s description of its registry', () => {
    const result = listCommands()
    expect(result.ok).toBe(true)
    expect(result.data).toEqual(describeCommands())
  })
})

describe('apply_commands', () => {
  // The builder's path: a session opened on the report and the commands
  // applied as one batch, so an agent and a click do one edit one way.
  test('answers the new report, its hash and its diagnostics', () => {
    const result = applyCommands(quotation, [
      { command: 'setTitle', args: ['Offerte 2026-117'] },
      { command: 'setLocale', args: ['de-DE'] },
    ])
    expect(result.ok).toBe(true)
    const answered = dataOf<Verdict & { report: ReportDefinition; changed: boolean }>(result)
    expect(answered.changed).toBe(true)
    expect(answered.report.title).toBe('Offerte 2026-117')
    expect(answered.report.locale).toBe('de-DE')
    expect(answered.hash).toBe(reportHash(answered.report))
    expect(answered.diagnostics).toEqual(diagnose(answered.report))
    expect(result.summary).toContain('2 commands')
  })

  // An agent that rebuilt the document from what it remembered would drop
  // what it did not name; a command changes only what it names.
  test('keeps every part the commands do not name', () => {
    const { report } = dataOf<{ report: ReportDefinition }>(applyCommands(quotation, [{ command: 'setTitle', args: ['Offerte'] }]))
    expect({ ...report, title: quotation.title }).toEqual(quotation)
  })

  // A refusal is the command's own, word for word, and nothing after it
  // runs; the hash it answers is the report's as it was given.
  test('answers a refused command’s code, sentence and path, and leaves the report as it was', () => {
    const result = applyCommands(quotation, [
      { command: 'setTitle', args: ['Offerte'] },
      { command: 'removeComponent', args: ['no-such-component'] },
    ])
    expect(result.ok).toBe(false)
    const { refusal, hash } = dataOf<Refused>(result)
    expect(refusal.code).toBe('not-found')
    expect(refusal.message).toContain('no-such-component')
    expect(hash).toBe(reportHash(quotation))
    expect(result.summary).toContain('not-found')
    expect(result.summary).toContain('Nothing was applied')
  })

  // A result the validator refuses is refused whole, with the validator's
  // errors, as the builder's session refuses it.
  test('refuses a result the validator refuses, with its errors', () => {
    const { refusal } = dataOf<Refused>(applyCommands(quotation, [{ command: 'setLocale', args: ['not a locale'] }]))
    expect(refusal.code).toBe('invalid-document')
    expect(refusal.errors).toEqual([expect.objectContaining({ path: '/locale' })])
  })

  // The agent passes the hash it last checked; a report that is not that
  // one -- edited by hand meanwhile, or another draft -- is refused.
  test('refuses the edit when the report given is not the one expectedHash names', () => {
    const fresh = applyCommands(quotation, [{ command: 'setTitle', args: ['Offerte'] }], reportHash(quotation))
    expect(fresh.ok).toBe(true)
    const stale = applyCommands(quotation, [{ command: 'setTitle', args: ['Offerte'] }], 'sha256:0000')
    expect(dataOf<Refused>(stale).refusal.code).toBe('stale-document')
  })

  // A descriptor read from JSON was never type-checked: one that is no
  // command, or a batch inside the batch, is refused by the registry.
  test('refuses what the registry refuses: an unknown command, wrong arguments, a batch inside the batch', () => {
    const code = (commands: readonly unknown[]) => dataOf<Refused>(applyCommands(quotation, commands)).refusal.code
    expect(code([{ command: 'setColour', args: ['red'] }])).toBe('unknown-command')
    expect(code([{ command: 'setTitle', args: [42] }])).toBe('invalid-arguments')
    expect(code([{ command: 'batch', args: [[]] }])).toBe('invalid-arguments')
    expect(code(['setTitle'])).toBe('invalid-arguments')
  })

  // An empty list is an edit that changes nothing, said as such rather
  // than as a change.
  test('says when the commands changed nothing', () => {
    const result = applyCommands(quotation, [])
    expect(result.ok).toBe(true)
    expect(dataOf<{ changed: boolean; hash: string }>(result)).toMatchObject({ changed: false, hash: reportHash(quotation) })
  })

  // A report the validator refuses has no session to apply anything in.
  test('refuses a report the validator refuses before any command runs', () => {
    const result = applyCommands({ reportSpecVersion: '9' }, [{ command: 'setTitle', args: ['Offerte'] }])
    expect(result.ok).toBe(false)
    expect(result.data).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'unsupported-version' })] })
  })
})
