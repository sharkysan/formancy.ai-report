import { describe, expect, test } from 'vitest'
import { CHART_PALETTE } from './chart.js'
import type { ReportDefinition } from './definition.js'
import { reportHash } from './hash.js'
import { MAX_CHART_SERIES, MAX_LABEL_LENGTH, MIN_CHART_SIDE } from './limits.js'
import { editable, getAt, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

const CH = '/regions/summary/4'

/** The fixture with each edit made at its full pointer, a copy of each value; undefined removes what is there. */
function report(edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const document = editable(richReport())
  for (const [pointer, value] of Object.entries(edits)) {
    if (value === undefined) removeAt(document, pointer)
    else setAt(document, pointer, JSON.parse(JSON.stringify(value)))
  }
  return document
}

/** The fixture with each edit made at a pointer under its chart. */
function chart(edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return report(Object.fromEntries(Object.entries(edits).map(([pointer, value]) => [`${CH}${pointer}`, value])))
}

/** The code and path of each error a document is refused with; none when it is valid. */
function refusals(document: unknown): string[] {
  const outcome = validateReport(document)
  return outcome.valid ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`)
}

/** The fixture's chart, a pie of its first series alone: a pie takes no axis titles. */
const PIE = { '/chart': 'pie', '/series/1': undefined, '/categoryTitle': undefined, '/valueTitle': undefined, '/valueLabels': undefined }

/** The index of a detail field in the fixture's contract. */
function fieldIndex(id: string): number {
  const fields = getAt(richReport(), '/datasets/detail/fields') as readonly { readonly id: string }[]
  return fields.findIndex((field) => field.id === id)
}

describe('a chart', () => {
  // The validator's copy is what a session commits and what is hashed. A
  // chart it read and left out of its copy would be dropped by the first
  // edit, and not count in the hash that publication pins.
  test('is read back whole, and is part of what the hash names', () => {
    const outcome = validateReport(richReport())
    expect(outcome.valid ? [] : outcome.errors).toEqual([])
    expect(outcome.valid && getAt(outcome.report, CH)).toEqual(getAt(richReport(), CH))
    const without = chart({ '/title': undefined, '/palette': undefined, '/valueLabels': undefined })
    const read = validateReport(without)
    expect(read.valid && Object.hasOwn(getAt(read.report, CH) as object, 'title')).toBe(false)
    expect(reportHash(chart({ '/series/0/label': 'Total' }) as unknown as ReportDefinition)).not.toBe(reportHash(richReport()))
  })

  // A chart in the page footer would be drawn on every page, and one in the
  // report header above the flow it charts; one in a table cell has no box.
  // The spec puts it in the flow.
  test('stands in the body and the summary, in columns and keep-together blocks, and nowhere else', () => {
    const block = getAt(richReport(), CH)
    const columns = {
      id: 'side',
      kind: 'columns',
      columns: [
        { width: 'fill', components: [{ ...(block as object), id: 'in-columns' }] },
        { width: 100, components: [] },
      ],
    }
    expect(refusals(report({ '/regions/body/4': columns }))).toEqual([])
    expect(refusals(report({ '/regions/body/3/components/1': { ...(block as object), id: 'in-keep' } }))).toEqual([])
    expect(refusals(report({ '/regions/body/0': { ...(block as object), id: 'in-body' } }))).toEqual([])
    expect(refusals(report({ '/regions/reportHeader/0': { ...(block as object), id: 'in-report-header' } }))).toEqual([
      'misplaced-flow-component /regions/reportHeader/0',
    ])
    expect(refusals(report({ '/regions/pageHeader/0': { ...(block as object), id: 'in-header' } }))).toEqual(['misplaced-flow-component /regions/pageHeader/0'])
    expect(refusals(report({ '/regions/pageFooter/0': { ...(block as object), id: 'in-footer' } }))).toEqual(['misplaced-flow-component /regions/pageFooter/0'])
  })

  // A property this version does not know could be the one that decides
  // what is drawn; a chart that drops it draws something else.
  test('refuses a property it does not know, and one it lacks', () => {
    expect(refusals(chart({ '/legend': true }))).toEqual([`unknown-property ${CH}/legend`])
    expect(refusals(chart({ '/dataset': 'header' }))).toEqual([`not-one-of ${CH}/dataset`])
    expect(refusals(chart({ '/chart': 'donut' }))).toEqual([`not-one-of ${CH}/chart`])
    for (const key of ['chart', 'dataset', 'width', 'height', 'category', 'series', 'valueFormat', 'emptyText']) {
      expect(refusals(chart({ [`/${key}`]: undefined }))).toEqual([`missing-property ${CH}/${key}`])
    }
  })
})

describe('the size of a chart', () => {
  // A chart narrower than an inch holds no plot beneath its title and
  // labels; a chart wider than the page is cut by it. Refused where it is
  // written, as an image's box is.
  test('is at least MIN_CHART_SIDE, and within the printable area', () => {
    expect(refusals(chart({ '/width': MIN_CHART_SIDE }))).toEqual([])
    expect(refusals(chart({ '/height': MIN_CHART_SIDE }))).toEqual([])
    expect(refusals(chart({ '/width': MIN_CHART_SIDE - 1 }))).toEqual([`out-of-range ${CH}/width`])
    expect(refusals(chart({ '/height': 10 }))).toEqual([`out-of-range ${CH}/height`])
    expect(refusals(chart({ '/width': 0 }))).toEqual([`out-of-range ${CH}/width`])
    expect(refusals(chart({ '/width': 5000 }))).toEqual([`exceeds-printable-area ${CH}/width`])
    expect(refusals(chart({ '/height': 5000 }))).toEqual([`exceeds-printable-area ${CH}/height`])
  })
})

describe('the category of a chart', () => {
  // A category from a header field has no rows to group; an unknown field
  // groups nothing. The chart reads the detail rows alone.
  test('is a detail field the dataset declares', () => {
    expect(refusals(chart({ '/category/field/field': 'region' }))).toEqual([`unknown-field ${CH}/category/field/field`])
    expect(refusals(chart({ '/category/field/dataset': 'header' }))).toEqual([`not-one-of ${CH}/category/field/dataset`])
  })

  // A sum of text cannot be totalled exactly; a date category is a label,
  // a boolean is not "text, a date, or a number".
  test('totals numbers, and labels categories of text, dates and numbers', () => {
    for (const field of ['site', 'dueOn', 'quantity', 'amount']) expect(refusals(chart({ '/category/field/field': field }))).toEqual([])
    for (const field of ['shipped', 'shippedAt', 'recordedAt', 'photo']) {
      // A nullable field also asks its label; only the type is under test.
      expect(refusals(chart({ '/category/field/field': field, '/category/nullLabel': 'None' }))).toEqual([`binding-type-mismatch ${CH}/category/field`])
    }
    expect(refusals(chart({ '/series/0/of/field': 'site' }))).toEqual([`aggregate-type-mismatch ${CH}/series/0/of`])
    expect(refusals(chart({ '/series/0/of/field': 'dueOn' }))).toEqual([`aggregate-type-mismatch ${CH}/series/0/of`])
    expect(refusals(chart({ '/series/0/fn': 'avg' }))).toEqual([`missing-property ${CH}/series/0/rounding`])
  })

  // A format that cannot display the category's type would print it as
  // something else, or not at all.
  test('prints in a format that displays its type', () => {
    expect(refusals(chart({ '/category/field/field': 'dueOn', '/category/format': { kind: 'date', style: 'short' } }))).toEqual([])
    expect(refusals(chart({ '/category/format': { kind: 'date', style: 'short' } }))).toEqual([`format-type-mismatch ${CH}/category/format`])
    expect(refusals(chart({ '/category/format': { kind: 'text', transform: 'upper' } }))).toEqual([])
    expect(refusals(chart({ '/category/format': { kind: 'wide' } }))).toEqual([`unknown-kind ${CH}/category/format/kind`])
  })

  // Rows without a category would be drawn under no word, or dropped.
  test('asks a category that may be null for the label its rows print under', () => {
    const nullable = { [`/datasets/detail/fields/${fieldIndex('site')}/nullable`]: true }
    expect(refusals(report(nullable))).toEqual([`missing-property ${CH}/category/nullLabel`])
    expect(refusals(report({ ...nullable, [`${CH}/category/nullLabel`]: 'Unknown' }))).toEqual([])
    expect(refusals(chart({ '/category/nullLabel': 'Unknown' }))).toEqual([])
  })
})

describe('the series of a chart', () => {
  // A chart of no series has nothing to draw; one of more than the palette
  // holds has series a legend cannot tell apart.
  test('are one to MAX_CHART_SERIES', () => {
    const series = (count: number): unknown[] => Array.from({ length: count }, (_, index) => ({ id: `series-${index}`, label: `Series ${index}`, fn: 'count' }))
    expect(refusals(chart({ '/series': series(MAX_CHART_SERIES), '/palette': undefined }))).toEqual([])
    expect(refusals(chart({ '/series': series(MAX_CHART_SERIES + 1), '/palette': undefined }))).toEqual([`too-many ${CH}/series`])
    expect(refusals(chart({ '/series': [] }))).toEqual([`too-few ${CH}/series`])
  })

  // A series is found by its id in the model and in a review; two of one
  // id are one series to whoever reads them back.
  test('have identifiers that are unique in the chart', () => {
    expect(refusals(chart({ '/series/0/id': 'Amount' }))).toEqual([`invalid-id ${CH}/series/0/id`])
    expect(refusals(chart({ '/series/1/id': 'amount' }))).toEqual([`duplicate-id ${CH}/series/1/id`])
  })

  // A total of rows with no field to total is a guess; only a count may
  // leave the field out, to count rows.
  test('read a field unless they count, and total numbers only', () => {
    expect(refusals(chart({ '/series/0/of': undefined }))).toEqual([`missing-property ${CH}/series/0/of`])
    expect(refusals(chart({ '/series/1/of': { dataset: 'detail', field: 'site' } }))).toEqual([])
    expect(refusals(chart({ '/series/0/fn': 'min', '/series/0/of/field': 'dueOn' }))).toEqual([`aggregate-type-mismatch ${CH}/series/0/of`])
    expect(refusals(chart({ '/series/0/of/field': 'nothing' }))).toEqual([`unknown-field ${CH}/series/0/of/field`])
    expect(refusals(chart({ '/series/0/of/dataset': 'header' }))).toEqual([`not-one-of ${CH}/series/0/of/dataset`])
  })

  // An average is rarely exact (1, 1 and 2 average 1.333...), so it says
  // how it is rounded, as an aggregate's must.
  test('declare the rounding of an average', () => {
    const average = { '/series/0/fn': 'avg', '/series/0/rounding': { scale: 2, mode: 'half-even' } }
    expect(refusals(chart(average))).toEqual([])
    expect(refusals(chart({ ...average, '/series/0/rounding/scale': 99 }))).toEqual([`out-of-range ${CH}/series/0/rounding/scale`])
  })
})

describe('the values of a chart', () => {
  // A chart prints sums and counts; a date or a text format would print a
  // total as something it is not.
  test('print in a number or a currency format', () => {
    expect(refusals(chart({ '/valueFormat': { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } }))).toEqual([])
    expect(refusals(chart({ '/valueFormat': { kind: 'date', style: 'short' } }))).toEqual([`format-type-mismatch ${CH}/valueFormat`])
    expect(refusals(chart({ '/valueFormat': { kind: 'text' } }))).toEqual([`format-type-mismatch ${CH}/valueFormat`])
  })

  // A chart has no current row: a currency read from a detail field would
  // be the currency of no row.
  test('are in a currency the report knows, never one read from a row', () => {
    const fromField = { kind: 'currency', currency: { kind: 'field', field: { dataset: 'detail', field: 'site' } }, scale: 2 }
    expect(refusals(chart({ '/valueFormat': fromField }))).toEqual([`misplaced-detail-field ${CH}/valueFormat/currency/field`])
    const fromHeader = { kind: 'currency', currency: { kind: 'field', field: { dataset: 'header', field: 'currency' } }, scale: 2 }
    expect(refusals(chart({ '/valueFormat': fromHeader }))).toEqual([])
    const fromParameter = { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 }
    expect(refusals(chart({ '/valueFormat': fromParameter }))).toEqual([])
  })
})

describe('the palette of a chart', () => {
  // A palette of nothing colours no series; more than eight is colours no
  // series could be given.
  test('is one to CHART_PALETTE.length colours, each written #rrggbb', () => {
    expect(refusals(chart({ '/palette': [...CHART_PALETTE] }))).toEqual([])
    expect(refusals(chart({ '/palette': [] }))).toEqual([`too-few ${CH}/palette`])
    expect(refusals(chart({ '/palette': [...CHART_PALETTE, '#000000'] }))).toEqual([`too-many ${CH}/palette`])
    expect(refusals(chart({ '/palette': ['#1F77B4', '#d95f02'] }))).toEqual([`invalid-color ${CH}/palette/0`])
    expect(refusals(chart({ '/palette': 'blue' }))).toEqual([`wrong-type ${CH}/palette`])
  })

  // Two series of one colour are told apart by nothing.
  test('names no colour twice', () => {
    expect(refusals(chart({ '/palette': ['#1f77b4', '#1f77b4'] }))).toEqual([`invalid-chart ${CH}/palette/1`])
  })

  // A series past the end of its chart's palette would be drawn in a colour
  // nobody chose, or in none. A pie's slices are its categories, which only
  // the data counts, so its palette is held to them where the data is.
  test('has a colour for each series of a bar or a line chart', () => {
    expect(refusals(chart({ '/palette': ['#1f77b4'] }))).toEqual([`invalid-chart ${CH}/palette`])
    expect(refusals(chart({ '/chart': 'line', '/valueLabels': undefined, '/palette': ['#1f77b4'] }))).toEqual([`invalid-chart ${CH}/palette`])
    expect(refusals(chart({ '/palette': ['#1f77b4', '#d95f02'] }))).toEqual([])
    expect(refusals(chart({ '/palette': [...CHART_PALETTE] }))).toEqual([])
    expect(refusals(chart({ ...PIE, '/palette': ['#1f77b4'] }))).toEqual([])
    // Said by counts alone: a colour is the author's, and the message needs none.
    const outcome = validateReport(chart({ '/palette': ['#1f77b4'] }))
    expect(outcome.valid ? [] : outcome.errors.map(({ message }) => message)).toEqual([
      expect.stringMatching(/has 2 series, and its palette colours 1 of them/),
    ])
  })
})

describe('the words of a chart', () => {
  // A title the page cannot hold on a line is cut or wrapped by the
  // renderer; the bound is the one every label has.
  test('are at most MAX_LABEL_LENGTH characters', () => {
    const long = 'x'.repeat(MAX_LABEL_LENGTH + 1)
    const edits: Record<string, string> = {
      '/title': long,
      '/categoryTitle': long,
      '/valueTitle': long,
      '/emptyText': long,
      '/series/0/label': long,
      '/category/nullLabel': long,
    }
    for (const [pointer, value] of Object.entries(edits)) expect(refusals(chart({ [pointer]: value }))).toEqual([`too-long ${CH}${pointer}`])
    expect(refusals(chart({ '/title': 'x'.repeat(MAX_LABEL_LENGTH) }))).toEqual([])
  })

  // A legend entry of nothing names no series, a chart with nothing to
  // draw would print a blank where it says why, and the rows without a
  // category would be drawn under a category of no word.
  test('are not blank where a reader needs them', () => {
    expect(refusals(chart({ '/series/0/label': '' }))).toEqual([`invalid-chart ${CH}/series/0/label`])
    expect(refusals(chart({ '/emptyText': ' \t' }))).toEqual([`invalid-chart ${CH}/emptyText`])
    expect(refusals(chart({ '/category/nullLabel': '' }))).toEqual([`invalid-chart ${CH}/category/nullLabel`])
    expect(refusals(chart({ '/category/nullLabel': ' ' }))).toEqual([`invalid-chart ${CH}/category/nullLabel`])
    // A title is optional, and a chart without one is a chart.
    expect(refusals(chart({ '/title': undefined }))).toEqual([])
  })
})

describe('the kind of a chart', () => {
  // A share of an average is no share of a whole.
  test('draws a pie of one series that sums or counts', () => {
    expect(refusals(chart(PIE))).toEqual([])
    expect(refusals(chart({ ...PIE, '/series/0/fn': 'count', '/series/0/of': undefined }))).toEqual([])
    expect(refusals(chart({ '/chart': 'pie', '/categoryTitle': undefined, '/valueTitle': undefined }))).toEqual([`invalid-chart ${CH}/series`])
    // Said by its count: how many series the pie has is what is wrong.
    const two = validateReport(chart({ '/chart': 'pie', '/categoryTitle': undefined, '/valueTitle': undefined }))
    expect(two.valid ? [] : two.errors.map(({ message }) => message)).toEqual([expect.stringContaining('this chart has 2')])
    const average = { '/series/0/fn': 'avg', '/series/0/rounding': { scale: 2, mode: 'half-even' } }
    expect(refusals(chart({ ...PIE, ...average }))).toEqual([`invalid-chart ${CH}/series/0/fn`])
    expect(refusals(chart({ ...PIE, '/series/0/fn': 'max', '/series/0/of/field': 'quantity' }))).toEqual([`invalid-chart ${CH}/series/0/fn`])
  })

  // A pie has no axes; a title of one would be drawn beside nothing.
  test('has no axis titles on a pie', () => {
    expect(refusals(chart({ ...PIE, '/categoryTitle': 'Site' }))).toEqual([`invalid-chart ${CH}/categoryTitle`])
    expect(refusals(chart({ ...PIE, '/valueTitle': 'CHF' }))).toEqual([`invalid-chart ${CH}/valueTitle`])
    expect(refusals(chart({ ...PIE, '/valueLabels': true }))).toEqual([])
  })

  // Two series' value labels at one category could only collide.
  test('refuses value labels on a line chart of several series', () => {
    expect(refusals(chart({ '/chart': 'line' }))).toEqual([`invalid-chart ${CH}/valueLabels`])
    expect(refusals(chart({ '/chart': 'line', '/valueLabels': false }))).toEqual([])
    expect(refusals(chart({ '/chart': 'line', '/series/1': undefined }))).toEqual([])
    expect(refusals(chart({ '/chart': 'bar' }))).toEqual([])
  })
})
