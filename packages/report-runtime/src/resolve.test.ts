import { reportHash } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import { MAX_DATA_ERRORS } from './data-errors.js'
import type { Block, Paragraph, ResolvedDocument, Table } from './document.js'
import { PREVIEW_LABEL, resolveReport } from './resolve.js'
import type { RenderManifest, ResolveOptions } from './resolve.js'
import type { RuntimeError } from './resolve-errors.js'
import { sampleData, sampleReport, sampleRow } from './test-support.js'

const CREATED = '2026-10-15T08:00:00Z'
const FINAL: ResolveOptions = { mode: 'final', parameters: { from: '2026-01-01' }, creationDate: CREATED }

/** The resolution of `report` over `data`, failing the test with the errors when it is refused. */
function resolved(
  report: ReportDefinition = sampleReport(),
  data: ReportData = sampleData(),
  options: ResolveOptions = FINAL,
): { document: ResolvedDocument; manifest: RenderManifest; warnings: readonly RuntimeError[] } {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

/** The errors `report` over `data` is refused with, as stage, code and path. */
function refusals(report: ReportDefinition = sampleReport(), data: ReportData = sampleData(), options: ResolveOptions = FINAL): string[] {
  const outcome = resolveReport(report, data, options)
  return outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)
}

/** The sample report with its table's group taken away. */
function ungrouped(): ReportDefinition {
  const report = sampleReport()
  const body = report.regions.body.map((component) => {
    if (component.kind !== 'table') return component
    const { group: _group, ...table } = component
    return table
  })
  return { ...report, regions: { ...report.regions, body } }
}

const text = (block: Block | undefined): string =>
  block?.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : `{${run.field}}`)).join('') : `<${block?.kind}>`

describe('resolveReport', () => {
  // The report header is the start of the body and the summary its end; a
  // document that put the header's title after the table would print a
  // report upside down.
  test('lowers the report header, the body and the summary into one body, in order', () => {
    const report = sampleReport()
    const withSummary: ReportDefinition = {
      ...report,
      regions: { ...report.regions, summary: [{ id: 'closing', kind: 'text', content: [{ kind: 'text', text: 'End.' }] }] },
    }
    const { document } = resolved(withSummary)
    expect(document.body.map((block) => block.kind)).toEqual(['paragraph', 'spacer', 'paragraph', 'table', 'paragraph'])
    expect(text(document.body[0])).toBe('Deliveries for Muster AG1. Januar 2026422026-01-01')
    expect(text(document.body.at(-1))).toBe('End.')
    expect(document.info).toEqual({ title: 'Deliveries by site', creationDate: '2026-10-15T08:00:00Z' })
    expect(document.page).toEqual(report.page)
  })

  // The manifest is what a stored PDF is reproduced from (plan 14): the
  // exact report, its version, the locale and zone it was formatted in, the
  // data's consistency and completeness, and every parameter as the format
  // writes it -- a default applied, an exact number still exact.
  test('says what the document was resolved from', () => {
    const report = sampleReport()
    const { manifest } = resolved(report, sampleData(), {
      ...FINAL,
      parameters: { from: '2026-01-01', threshold: '12345678901234567890.12', copies: '9007199254740993' },
    })
    expect(manifest).toEqual({
      reportHash: reportHash(report),
      reportSpecVersion: '0',
      locale: 'de-CH',
      timeZone: 'UTC',
      mode: 'final',
      consistency: 'host-captured',
      completeness: { complete: true, captured: 1 },
      parameters: {
        from: '2026-01-01',
        draft: false,
        threshold: '12345678901234567890.12',
        currency: 'CHF',
        copies: '9007199254740993',
        heading: 'Deliveries',
      },
    })
  })

  // A stored PDF is traced to what collected its data only if the manifest
  // kept beside it says so (0041): the form, the exact version of it, and
  // the submission. Copied as the check held it, so that a host changing
  // its object afterwards does not change what the manifest says, in a
  // final render as in a preview.
  test('names where its data came from, when the data says', () => {
    const source = {
      provider: 'formancy-form',
      submissions: [
        { id: 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380', form: 'site-visit', formHash: '767a65b36d4c02adf432d91ccdf7f8f285eebdbfc2987fb08fecd846b721dc42' },
      ],
    }
    const data = { ...sampleData(), source } as ReportData
    for (const mode of ['final', 'preview'] as const) {
      const { manifest } = resolved(sampleReport(), data, { ...FINAL, mode })
      expect(manifest.source).toEqual({
        provider: 'formancy-form',
        submissions: [
          { id: 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380', form: 'site-visit', formHash: '767a65b36d4c02adf432d91ccdf7f8f285eebdbfc2987fb08fecd846b721dc42' },
        ],
      })
      expect(manifest.source).not.toBe(source)
    }
    expect(Object.hasOwn(resolved().manifest, 'source')).toBe(false)
  })

  // A report is untrusted input whatever its type says: a component kind
  // this version does not know is refused whole, never skipped.
  test('refuses a report the validator refuses, with its errors', () => {
    const report = sampleReport()
    const broken = { ...report, regions: { ...report.regions, summary: [{ id: 'gauge', kind: 'gauge' }] } } as unknown as ReportDefinition
    expect(refusals(broken)).toEqual(['report unknown-kind /regions/summary/0/kind'])
  })

  // The runtime never renders what the editor refuses (0009): a report
  // that calls the clock would print differently tomorrow.
  test('refuses a report its diagnostics give an error for', () => {
    const report = sampleReport()
    const clocked: ReportDefinition = {
      ...report,
      regions: { ...report.regions, summary: [{ id: 'when', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'string(now())' } }] }] },
    }
    expect(refusals(clocked)).toEqual(['expressions expression-not-reproducible /regions/summary/0/content/0/expression/cel'])
  })

  // An author fixing a render fixes the options, the parameters and the
  // data in one go when each is told at once.
  test('lists what is wrong with the options, the parameters and the data together', () => {
    const data = { ...sampleData([sampleRow({ amount: 12.5 })]) }
    const options: ResolveOptions = { mode: 'final', parameters: { from: '2026-02-30', copies: 'two' }, creationDate: 'today', timeZone: 'Mars/Olympus' }
    expect(refusals(sampleReport(), data, options)).toEqual([
      'resolve invalid-creation-date ',
      'format unsupported-time-zone ',
      'parameters invalid-date /from',
      'parameters invalid-integer /copies',
      'data decimal-as-number /detail/0/amount',
    ])
  })

  // A locale the engine does not have would be replaced by the host's
  // without a word; it is refused where the report names it.
  test('refuses a locale the engine does not have', () => {
    expect(refusals({ ...sampleReport(), locale: 'qaa' })).toEqual(['format unsupported-locale /locale'])
  })

  // A render that fails partway is refused whole, saying where: here a
  // quantity divided by zero copies, in one column of one row.
  test('refuses a report an evaluation fails in, naming the column and the row', () => {
    const outcome = resolveReport(sampleReport(), sampleData([sampleRow(), sampleRow({ sku: 'B-2' })]), {
      ...FINAL,
      parameters: { from: '2026-01-01', copies: '0' },
    })
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.errors).toEqual([
      expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', componentId: 'lines', columnId: 'per-copy', row: 0 }),
      expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', componentId: 'lines', columnId: 'per-copy', row: 1 }),
    ])
  })

  // A render in which every row fails stops once the error list is full,
  // and says the list was cut short, whether or not its table groups.
  test.each([
    ['grouped', sampleReport()],
    ['ungrouped', ungrouped()],
  ])('stops a %s table once the error list is full, saying so', (_name, report) => {
    const rows = Array.from({ length: MAX_DATA_ERRORS + 50 }, (_, index) => sampleRow({ sku: `S-${index}` }))
    const outcome = resolveReport(report, sampleData(rows), { ...FINAL, parameters: { from: '2026-01-01', copies: '0' } })
    const errors = outcome.ok ? [] : outcome.errors
    expect(errors).toHaveLength(MAX_DATA_ERRORS + 1)
    expect(errors.at(-1)).toMatchObject({ stage: 'resolve', code: 'too-many-errors' })
  })

  // An amount whose currency the data leaves empty would print as some
  // other currency's; it is an error, never a guess.
  test('refuses an amount without a currency, as the formatter says', () => {
    const data: ReportData = { ...sampleData(), header: { ...sampleData().header, currency: null } }
    expect(refusals(sampleReport(), data)).toEqual(['format no-currency /regions/body/1/columns/3/value'])
  })
})

describe('incomplete data', () => {
  const incomplete = (): ReportData => ({ ...sampleData([sampleRow(), sampleRow({ sku: 'B-2' })]), completeness: { complete: false, captured: 2, cap: 2 } })

  // A final render prints every row or none (plan 13.6).
  test('is refused in a final render', () => {
    expect(refusals(sampleReport(), incomplete())).toEqual(['data incomplete /completeness/complete'])
  })

  // A preview may show what was captured, and says so where a reader of
  // the PDF sees it -- on every page, at the top of the page header -- and
  // in the manifest and warnings a program reads.
  test('is resolved in a preview, labelled on every page and in the manifest', () => {
    const { document, manifest, warnings } = resolved(sampleReport(), incomplete(), { ...FINAL, mode: 'preview' })
    expect(manifest.mode).toBe('preview')
    expect(manifest.completeness).toEqual({ complete: false, captured: 2, cap: 2 })
    expect(warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual(['data incomplete /completeness/complete'])
    expect(document.pageHeader.map(text)).toEqual([PREVIEW_LABEL])
    expect((document.pageHeader[0] as Paragraph).style).toEqual({ size: 8, bold: true, color: '#b00020' })
  })

  // A preview of complete data prints as the report would: the label is
  // for data that is not all there.
  test('labels nothing in a preview of complete data', () => {
    const { document, warnings } = resolved(sampleReport(), sampleData(), { ...FINAL, mode: 'preview' })
    expect(warnings).toEqual([])
    expect(document.pageHeader).toEqual([])
  })

  // A preview's data may lack a field. What reads it prints nothing, and a
  // computed value that reads it is said once, as a warning, rather than
  // refusing the preview; the final render refuses the same data.
  test('prints nothing where a preview lacks a field, and says so once', () => {
    const { sku: _sku, ...first } = sampleRow()
    const { sku: _again, ...second } = sampleRow({ site: 'Thun' })
    const data = sampleData([first, second])
    expect(refusals(sampleReport(), data)).toEqual(['data missing-field /detail/0/sku', 'data missing-field /detail/1/sku'])
    const { document, warnings } = resolved(sampleReport(), data, { ...FINAL, mode: 'preview' })
    expect(warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual(['data missing-field /detail/0/sku'])
    const table = document.body.find((block): block is Table => block.kind === 'table')
    expect(table?.rows.filter((row) => row.kind === 'detail').map((row) => row.cells[0])).toEqual(['', ''])
    expect(text(document.pageHeader[0])).toBe(PREVIEW_LABEL)
  })

  // An expression that reads the missing field prints nothing either, and
  // is said once for the expression, not once per row it was read in.
  test('prints nothing for an expression that reads a field a preview lacks, and says so once', () => {
    const { quantity: _quantity, ...first } = sampleRow()
    const { quantity: _again, ...second } = sampleRow({ sku: 'B-2' })
    const { document, warnings } = resolved(sampleReport(), sampleData([first, second]), { ...FINAL, mode: 'preview' })
    expect(warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual([
      'data missing-field /detail/0/quantity',
      'evaluation missing-value /regions/body/1/columns/2/value/expression/cel',
    ])
    const table = document.body.find((block): block is Table => block.kind === 'table')
    expect(table?.rows.filter((row) => row.kind === 'detail').map((row) => row.cells.slice(0, 3))).toEqual([
      ['A-1', '', ''],
      ['B-2', '', ''],
    ])
  })
})
