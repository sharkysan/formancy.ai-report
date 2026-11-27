/**
 * Each note `reportFacts()` gives an agent, held to what refuses what it
 * says (0088). A note is prose, and prose does not break: told that `/` is
 * refused after the compiler came to accept it, every agent would go on
 * avoiding it, and told that a QR-bill is `paymentPart` after a rename,
 * every agent would write a report the validator refuses. So each note has
 * a case here that asks the validator, the compiler or the command it
 * names, and `HELD` is typed over every key of `NOTES`, so a note added
 * without a case does not compile.
 */
import { MAX_TABLES, reportWords, validateReport, walkComponents } from '@formancy/report-spec'
import type { Component, Inline, ReportDefinition, ValueScope } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { setPaymentAccount } from './commands/e-invoice.js'
import type { CommandDescriptor } from './commands/registry.js'
import { addLanguage, translateWord } from './commands/translations.js'
import { diagnose } from './diagnostics/diagnose.js'
import { expressionSites } from './diagnostics/parts.js'
import { NOTES, reportFacts } from './facts.js'
import { openReportSession } from './session.js'
import { accepted, eInvoiceSample, refused, sampleReport, setAt } from './test-support.js'

/** A deep copy of the sample a case may write to: its JSON read back, since the package has no structuredClone among its types. */
const copied = (): ReportDefinition => JSON.parse(JSON.stringify(sampleReport())) as ReportDefinition

/** The codes the validator refuses `report` with, each at its path. */
function refusedWith(report: unknown): string[] {
  const validation = validateReport(report)
  return validation.valid ? [] : validation.errors.map(({ code, path }) => `${code} ${path}`)
}

/** A copy of the sample, changed by `change`, which may write to it. */
function sample(change: (report: { -readonly [K in keyof ReportDefinition]: ReportDefinition[K] }) => void): unknown {
  const report = copied() as { -readonly [K in keyof ReportDefinition]: ReportDefinition[K] }
  change(report)
  return report
}

/**
 * The diagnostic codes `cel` gives where the sample computes a value in
 * `scope`: the sample with that one expression written as `cel`, which the
 * validator still takes, diagnosed, and what is said at its path.
 */
function compiled(cel: string, scope: ValueScope): string[] {
  const site = expressionSites(sampleReport()).find((each) => each.scope === scope && each.kind === 'computed' && each.term === undefined)
  if (site === undefined) throw new Error(`the sample computes no value in ${scope}`)
  const report = copied()
  setAt(report, site.path, cel)
  const validation = validateReport(report)
  if (!validation.valid) throw new Error(`the validator refuses ${cel}: ${JSON.stringify(validation.errors)}`)
  return diagnose(validation.report)
    .filter(({ path }) => path === site.path)
    .map(({ code }) => code)
}

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

const HELD = {
  // A report of another version, or the form an agent knows best, is
  // refused whole by the version check, never read in part.
  version: () => {
    expect(refusedWith({ ...sampleReport(), reportSpecVersion: '1' })).toEqual(['unsupported-version /reportSpecVersion'])
    expect(refusedWith({ specVersion: '6', id: 'contact', title: 'Contact', model: { fields: [] } })[0]).toMatch(/^not-a-report/)
  },
  // A decimal written as a JSON number is refused where a parameter's
  // default holds it; in an expression a double is refused as inexact, `/`
  // as inexact on integers and as no operation on decimals, and dec() and
  // divide() of two decimals are not refused.
  exact: () => {
    const withDefault = (value: unknown) =>
      sample((report) => {
        report.parameters = [...report.parameters, { id: 'rate', type: 'decimal', label: 'Rate', required: false, default: value as string }]
      })
    expect(refusedWith(withDefault(12.5)).length).toBeGreaterThan(0)
    expect(refusedWith(withDefault('12.50'))).toEqual([])
    expect(compiled('1.5 * 2.0', 'row')).toContain('expression-inexact')
    expect(compiled('row.quantity / 2', 'row')).toContain('expression-inexact')
    expect(compiled('row.amount / dec("3")', 'row')).toContain('expression-type')
    expect(compiled('divide(row.amount, dec("3"), 2)', 'row')).toEqual([])
    expect(compiled('row.amount * dec("12.50")', 'row')).toEqual([])
  },
  // A third dataset is no role the format has, and a table past
  // MAX_TABLES is refused, every one of them over the detail rows.
  datasets: () => {
    expect(refusedWith(sample((report) => (report.datasets = { ...report.datasets, lines: report.datasets.detail } as ReportDefinition['datasets'])))).toEqual([
      expect.stringMatching(/^unknown-property \/datasets\/lines/),
    ])
    const table = sampleReport().regions.body.find(({ kind }) => kind === 'table') as Component
    const tables = (count: number) =>
      sample((report) => {
        report.regions = {
          ...report.regions,
          body: [...report.regions.body, ...Array.from({ length: count }, (_, at) => ({ ...table, id: `more-${String(at)}` }))],
        }
      })
    const held = [...walkComponents(sampleReport())].filter(({ component }) => component.kind === 'table').length
    expect(refusedWith(tables(MAX_TABLES - held))).toEqual([])
    expect(refusedWith(tables(MAX_TABLES - held + 1)).some((error) => error.startsWith('too-many'))).toBe(true)
  },
  // A name read where its place does not bind it, a name read whole or by
  // a key computed as it renders, an image field, the clock and a random
  // draw are each refused; a key written out is a member's read.
  reads: () => {
    expect(compiled('row.amount', 'report')).toContain('expression-out-of-scope')
    expect(compiled('size(params)', 'report')).toContain('expression-dynamic-read')
    expect(compiled('row[header.customer]', 'row')).toContain('expression-dynamic-read')
    expect(compiled('row["amount"]', 'row')).toEqual([])
    expect(compiled('header.signature', 'report')).toContain('expression-unreadable-field')
    expect(compiled('now()', 'report')).toContain('expression-not-reproducible')
    expect(compiled('random()', 'report')).toContain('expression-not-reproducible')
  },
  // A word is translated by the text the report prints: one it prints is
  // taken, and a key of the agent's own is refused.
  words: () => {
    const french = accepted(addLanguage(sampleReport(), 'fr-CH'))
    const [printed] = reportWords(french)
    expect(printed).toBeDefined()
    expect(accepted(translateWord(french, 'fr-CH', printed?.text ?? '', 'traduit')).translations?.[0]?.words).toEqual([
      { word: printed?.text, text: 'traduit' },
    ])
    expect(refused(translateWord(french, 'fr-CH', 'invoice.heading', 'Facture')).ok).toBe(false)
  },
  // The bill is the report's own part: a component of its kind in a
  // region is no kind the format has, and the EPC QR code is one.
  qrBill: () => {
    expect(sampleReport().paymentPart?.kind).toBe('swissQrBill')
    const inRegion = sample((report) => {
      report.regions = { ...report.regions, body: [...report.regions.body, { kind: 'swissQrBill', id: 'bill' } as unknown as Component] }
    })
    expect(refusedWith(inRegion).some((error) => error.startsWith('unknown-kind'))).toBe(true)
    expect([...walkComponents(sampleReport())].some(({ component }) => component.kind === 'epcQrCode')).toBe(true)
  },
  // The account is written into the e-invoice and every EPC QR code by
  // one command, and a term EN 16931 does not allow is refused whole.
  eInvoice: () => {
    const account = 'DE89 3704 0044 0532 0130 00'
    const changed = accepted(setPaymentAccount(eInvoiceSample(), account))
    const codes = [...walkComponents(changed)].flatMap(({ component }) => (component.kind === 'epcQrCode' ? [component.iban] : []))
    expect([changed.eInvoice?.payment?.iban, ...codes]).toEqual([said(account), said(account)])
    const opening = openReportSession(eInvoiceSample())
    if (!opening.ok) throw new Error('the e-invoice sample does not open')
    expect(opening.session.apply({ command: 'updateEInvoice', args: [{ currency: 'XXX' }] } as unknown as CommandDescriptor)).toMatchObject({
      ok: false,
      code: 'invalid-document',
    })
  },
  // A length of three places is refused: the format holds points to the hundredth.
  lengths: () => {
    const margins = (top: number) =>
      sample((report) => {
        report.page = { ...report.page, margins: { ...report.page.margins, top } }
      })
    expect(refusedWith(margins(56.7))).toEqual([])
    expect(refusedWith(margins(56.695))).toEqual([expect.stringMatching(/^too-precise \/page\/margins\/top/)])
  },
  // A report the validator takes may still have a diagnostic error,
  // which names no language, and a language's errors name it.
  order: () => {
    const report = copied()
    const site = expressionSites(report).find((each) => each.scope === 'report' && each.kind === 'computed' && each.term === undefined)
    setAt(report, site?.path ?? '', 'row.amount')
    expect(refusedWith(report)).toEqual([])
    expect(diagnose(report).filter(({ severity, language }) => severity === 'error' && language === undefined).length).toBeGreaterThan(0)
    const french = accepted(addLanguage(sampleReport(), 'fr-CH'))
    expect(
      diagnose(french)
        .filter(({ severity }) => severity === 'error')
        .every(({ language }) => language === 'fr-CH'),
    ).toBe(true)
  },
} satisfies { readonly [K in keyof typeof NOTES]: () => void }

describe('each note an agent is told', () => {
  // The notes reportFacts() gives are NOTES', every one, in its order.
  test('is one of NOTES, in its order', () => {
    expect(reportFacts().notes).toEqual(Object.values(NOTES))
  })

  for (const [key, held] of Object.entries(HELD)) test(`holds: ${key}`, held)
})
