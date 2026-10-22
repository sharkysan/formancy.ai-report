import { readPdf, SITE_VISIT_V2 } from '@formancy/report-corpus'
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'
import { resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition, TableComponent } from '@formancy/report-spec'
import { PAGE_SIZES } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { MIN_COLUMN_WIDTH } from './generate-layout.js'
import { formOf, generate, generatedFrom, generationRefusals, notesOf, readData, readOne, SUBMISSION } from './test-support.js'

/**
 * A generated table stands on the page that gives each of its columns the
 * room a word of its heading needs, or is refused (0045). The renderer
 * breaks no word in a table's cell and refuses one wider than its column
 * (0011): a draft of more columns than its page gives that room passed
 * report-spec's validator, report-core's diagnostics and the runtime, and
 * was refused only when it printed -- the site visit, one row per
 * submission, at its fourth column. So a table of up to as many columns as
 * a portrait A4 page gives `MIN_COLUMN_WIDTH` each stands on one, up to as
 * many as a landscape page gives on that, said, and one of more is refused
 * as wider than a page, never cut to its first columns.
 *
 * Proved on the PDF the renderer produced (0003), with a heading word of
 * 71.7 pt in the header's Roboto Medium at 9 pt -- `Massnahmenplan`,
 * measured with fontkit from the renderer's own font file on 22 October
 * 2026 -- which a column of `MIN_COLUMN_WIDTH` holds inside the
 * renderer's padding, and a column one more would not: so the bound is
 * where that room ends, and moved either way, one of these cases fails.
 */

/** Long enough for a render on a runner busy with other suites; one that hangs still fails. */
const TIMEOUT = 120_000

/** A heading word of 71.7 pt in Roboto Medium at 9 pt: room inside a column of `MIN_COLUMN_WIDTH`, and none in a narrower one. */
const WORD = 'Massnahmenplan'

/** A form whose repeater's rows hold `count` fields, each headed by `WORD`. */
const wide = (count: number) => formOf([{ key: 'site', type: 'text', label: 'Site' }, { key: 'items', type: 'repeater', label: 'Items', fields: Array.from({ length: count }, (_, index) => ({ key: `c${index}`, type: 'text', label: WORD })) }])

/** A visit of two rows, each of `count` short answers. */
const visit = (count: number) => ({ site: 'Bern', items: ['r1', 'r2'].map((id) => ({ _id: id, ...Object.fromEntries(Array.from({ length: count }, (_, index) => [`c${index}`, 'Wert'])) })) })

const ITEMS = { kind: 'repeater', repeater: 'items' } as const

/** The PDF of `report` with `data` read into it, read back. */
async function printed(report: ReportDefinition, count: number) {
  const data = readData(readOne(report, { form: wide(count), submission: { id: SUBMISSION, data: visit(count) } }))
  const resolution = resolveReport(report, data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z', timeZone: 'Europe/Zurich' })
  if (!resolution.ok) throw new Error(`refused: ${JSON.stringify(resolution.errors)}`)
  return readPdf(await renderPdf(resolution.document, { maxPages: 5 }))
}

/** `report` with its table's last column once more, as a person might add one by hand. */
function oneMore(report: ReportDefinition): ReportDefinition {
  const table = report.regions.body.find((component): component is TableComponent => component.kind === 'table') as TableComponent
  const last = table.columns.at(-1) as TableComponent['columns'][number]
  const columns = [...table.columns, { ...last, id: 'column-more' }]
  return { ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component === table ? { ...table, columns } : component)) } }
}

describe('a generated table', () => {
  // On a portrait page each of six columns has the room, and the draft
  // prints every heading and every answer, the page portrait.
  test('of as many columns as a portrait page gives that room stands on one, and prints', async () => {
    const portrait = Math.floor((PAGE_SIZES.A4.width - 2 * 56.69) / MIN_COLUMN_WIDTH)
    expect(portrait).toBe(6)
    const { report, notes } = generatedFrom(generate(wide(portrait), { id: 'r', locale: 'de-CH', detail: ITEMS }))
    expect(report.page.orientation).toBe('portrait')
    expect(notesOf(notes).filter((note) => note.startsWith('table'))).toEqual([])
    const pdf = await printed(report, portrait)
    expect([pdf.pages.length, Math.round(pdf.pages[0]?.width ?? 0)]).toEqual([1, 595])
    const items = pdf.pages.flatMap((page) => page.items).map((item) => item.text.trim())
    expect([items.filter((text) => text === WORD).length, items.filter((text) => text === 'Wert').length]).toEqual([portrait, 2 * portrait])
  }, TIMEOUT)

  // One column more than portrait gives that room turns the page
  // landscape, said, and up to as many as landscape gives, it prints.
  test('of more stands on a landscape page, said, up to as many columns as it gives that room, and prints', async () => {
    const landscape = Math.floor((PAGE_SIZES.A4.height - 2 * 56.69) / MIN_COLUMN_WIDTH)
    expect(landscape).toBe(9)
    for (const count of [7, landscape]) {
      const { report, notes } = generatedFrom(generate(wide(count), { id: 'r', locale: 'de-CH', detail: ITEMS }))
      expect(report.page.orientation).toBe('landscape')
      expect(notesOf(notes).filter((note) => note.startsWith('table'))).toEqual(['table-landscape /form/model/fields/1/fields'])
      const pdf = await printed(report, count)
      expect([pdf.pages.length, Math.round(pdf.pages[0]?.width ?? 0)]).toEqual([1, 842])
      expect(pdf.pages.flatMap((page) => page.items).filter((item) => item.text.trim() === WORD)).toHaveLength(count)
    }
  }, TIMEOUT)

  // The bound is where the room ends: the same draft with one column more,
  // portrait at seven and landscape at ten, is refused by the renderer at
  // the heading word, as the site visit one row per submission was.
  test('would be refused when it printed, one column past either bound', async () => {
    for (const count of [6, 9]) {
      const { report } = generatedFrom(generate(wide(count), { id: 'r', locale: 'de-CH', detail: ITEMS }))
      const refusal = await printed(oneMore(report), count).then(
        () => undefined,
        (error: unknown) => error,
      )
      expect(refusal, `${count + 1} columns`).toBeInstanceOf(RenderRefusal)
      expect((refusal as RenderRefusal).message).toMatch(/^a word of the header of table table, column \d+ is/)
    }
  }, TIMEOUT)

  // More columns than a landscape page gives that room are refused, by
  // where the columns stand in the form, and never cut to the first nine:
  // the site visit read one row per submission is thirteen of them.
  test('of more columns than a landscape page gives that room is refused, never cut to its first', () => {
    expect(generationRefusals(generate(wide(10), { id: 'r', locale: 'de-CH', detail: ITEMS }))).toEqual(['too-many-columns /form/model/fields/1/fields'])
    const outcome = generate(SITE_VISIT_V2, { id: 'site-visits', locale: 'de-CH', detail: { kind: 'submissions' } })
    expect(generationRefusals(outcome)).toEqual(['too-many-columns /form/model/fields'])
    if (!outcome.ok) expect(outcome.errors[0]?.message).toMatch(/13 columns.* 9 /)
  })
})
