import { openReportSession } from '@formancy/report-core'
import { expectation, readPdf, verify } from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { resolveReport } from '@formancy/report-runtime'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { walkComponents } from '@formancy/report-spec'
import type { Component, ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { reviewFormVersion } from './review.js'
import type { FormReview, ReviewItem } from './review.js'
import { formOf, generate, generatedFrom, read, readData } from './test-support.js'

/**
 * A form version reviewed for a report of several tables over its detail
 * rows, each selecting them by a condition (0062, 0048). A condition is
 * an expression of its table's, which `fieldReaders` finds, so a version
 * that removes a field a condition reads blocks the report as one that
 * removes a printed field does, and the removal offered takes the table
 * whole, as it takes a component whose condition reads the field. A
 * field printed as nothing from a version is null in that version's rows,
 * and a condition reads that null: the rows leave a table that selects
 * them by a value of the field, and go into one that selects them by any
 * other.
 */

/** Long enough for a render on a runner busy with other suites; one that hangs still fails. */
const TIMEOUT = 120_000

/** The finding's fields: an area, a kind of finding, unrequired, and the hours spent. */
const FINDING = [
  { key: 'area', type: 'text', label: 'Area' },
  { key: 'kind', type: 'text', label: 'Kind' },
  { key: 'hours', type: 'number', label: 'Hours', min: 0, step: 0.25 },
] as const

/** The first version: a site, and the findings, each of every field. */
const V1 = formOf([
  { key: 'site', type: 'text', label: 'Site', required: true },
  { key: 'findings', type: 'repeater', label: 'Findings', fields: [...FINDING] },
])

/** The second: the findings no longer say their kind. */
const V2 = formOf([
  { key: 'site', type: 'text', label: 'Site', required: true },
  { key: 'findings', type: 'repeater', label: 'Findings', fields: FINDING.filter(({ key }) => key !== 'kind') },
])

/**
 * The report generated from the first version, its table of every finding
 * printing each field, and two more after it: the roof's findings, and
 * every other, each printing the area and the hours and selecting its
 * rows by the kind.
 */
function severalTables(): ReportDefinition {
  const generated = generatedFrom(generate(V1, { id: 'visit', locale: 'en', detail: { kind: 'repeater', repeater: 'findings' } })).report
  const table = generated.regions.body.find((component): component is TableComponent => component.kind === 'table')
  if (table === undefined) throw new Error('the generator wrote no table')
  const printed = table.columns.filter((column) => column.header !== 'Kind')
  const roof: TableComponent = { ...table, id: 'roof', columns: printed, rowsWhen: { cel: 'row.kind == "roof"' }, emptyText: 'No roof findings.' }
  const other: TableComponent = { ...table, id: 'other', columns: printed, rowsWhen: { cel: 'row.kind != "roof"' }, emptyText: 'No other findings.' }
  return { ...generated, regions: { ...generated.regions, body: [...generated.regions.body, roof, other] } }
}

const REPORT = severalTables()

/** The review's items, failing the test where it was refused. */
function itemsOf(review: FormReview): readonly ReviewItem[] {
  if (!review.ok) throw new Error(`refused: ${review.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('; ')}`)
  return review.items
}

/** The review of the second version for `report`, handed the first. */
const reviewed = (report: ReportDefinition = REPORT): FormReview => reviewFormVersion(report, { form: V2, versions: [V1] })

/** `report` with the resolution of `kind` for the kind of finding applied, as a host applies it: against the hash it was computed for. */
function resolved(kind: string, report: ReportDefinition = REPORT): ReportDefinition {
  const resolution = itemsOf(reviewed(report))
    .find((item) => item.field === 'kind')
    ?.resolutions.find((each) => each.kind === kind)
  if (resolution === undefined) throw new Error(`no ${kind} for the kind`)
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  const outcome = opening.session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash, label: kind })
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
  return opening.session.document()
}

/** Where `id` stands in `report`, as a pointer. */
function pathOf(report: ReportDefinition, id: string): string {
  const found = walkComponents(report).find(({ component }: { component: Component }) => component.id === id)
  if (found === undefined) throw new Error(`no ${id}`)
  return found.path
}

/** A visit to the site, its findings answering `form`. */
const visit = (findings: readonly Record<string, unknown>[]): Record<string, unknown> => ({ site: 'Hauptstrasse 12', findings: [...findings] })

/** What each table of `document` prints, by its id: each detail row's cells, or its empty text where it has none. */
function printedBy(document: ResolvedDocument): Record<string, readonly (readonly string[])[] | string> {
  const tables: Record<string, readonly (readonly string[])[] | string> = {}
  for (const block of document.body)
    if (block.kind === 'table') {
      const rows = block.rows.filter((row) => row.kind === 'detail').map((row) => row.cells)
      tables[block.id] = rows.length === 0 ? block.emptyText : rows
    }
  return tables
}

describe('reviewFormVersion, a report of several tables', () => {
  // A version that drops a field a table's condition reads would leave the
  // table selecting by a field the version never answers: it blocks, as a
  // printed field's removal does. Its removal takes each table that
  // selects by the field whole -- a table that printed every row once its
  // condition went would be one nobody wrote -- and the table that only
  // prints the field keeps every row, without its column.
  test('blocks a version that removes a field a condition reads, and its removal takes those tables whole and keeps the other', () => {
    const items = itemsOf(reviewed())
    expect(items.map((item) => [item.dataset, item.field, item.change, item.blocks, item.resolutions.map((resolution) => resolution.kind)])).toEqual([
      ['detail', 'kind', 'field.removed', true, ['print-nothing', 'remove']],
    ])
    const removal = items[0]?.resolutions.find((resolution) => resolution.kind === 'remove')
    expect(removal?.removes).toEqual(expect.arrayContaining([pathOf(REPORT, 'roof'), pathOf(REPORT, 'other'), `${pathOf(REPORT, 'table')}/columns/1`]))
    const gone = resolved('remove')
    const tables = walkComponents(gone).flatMap(({ component }: { component: Component }) =>
      component.kind === 'table' ? [[component.id, component.columns.map((column) => column.header)]] : [],
    )
    expect(tables).toEqual([['table', ['Area', 'Hours']]])
  })

  // Printing nothing of the kind from the second version is offered, and
  // what it costs is what a condition makes of a null: the second
  // version's findings leave the roof's table, which selects by the kind
  // being "roof", and go into the other, which selects by its being
  // anything else; the first version's go on printing where their kind
  // puts them. Proved on the PDF each render produced (0003), against the
  // rows the document gave each table: the report's two selecting tables
  // alone, whose conditions every finding meets one of, so that each
  // prints once and the corpus's checks find each row by its area.
  test(
    'prints nothing of a removed field a condition reads, and the second version’s rows leave the tables that select by its value',
    async () => {
      const selecting = { ...REPORT, regions: { ...REPORT.regions, body: REPORT.regions.body.filter((component) => component.id !== 'table') } }
      const nothing = resolved('print-nothing', selecting)
      const printed = async (form: unknown, findings: readonly Record<string, unknown>[]) => {
        const resolution = resolveReport(nothing, readData(read(nothing, form, visit(findings))), {
          mode: 'final',
          creationDate: '2026-11-15T08:00:00Z',
          timeZone: 'Europe/Zurich',
        })
        if (!resolution.ok) throw new Error(`refused: ${resolution.errors.map((error) => `${error.code} ${error.path}`).join('; ')}`)
        const pdf = await readPdf(await renderPdf(resolution.document, { maxPages: 5 }))
        const fixture = { id: 'several-tables-reviewed', title: 'A visit after the review', document: resolution.document, maxPages: 5 }
        expect(verify({ ...fixture, expect: expectation(resolution.document, { maxPagesExpected: 1 }) }, pdf)).toEqual([])
        return printedBy(resolution.document)
      }
      expect(
        await printed(V2, [
          { _id: 'r1', area: 'Roof', hours: 1.25 },
          { _id: 'r2', area: 'Cellar', hours: 2 },
        ]),
      ).toEqual({
        roof: 'No roof findings.',
        other: [
          ['Roof', '1.25'],
          ['Cellar', '2.00'],
        ],
      })
      expect(
        await printed(V1, [
          { _id: 'r1', area: 'Roof', kind: 'roof', hours: 1.25 },
          { _id: 'r2', area: 'Cellar', kind: 'damp', hours: 2 },
        ]),
      ).toEqual({
        roof: [['Roof', '1.25']],
        other: [['Cellar', '2.00']],
      })
    },
    TIMEOUT,
  )
})
