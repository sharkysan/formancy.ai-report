import { SALES_REPORT } from '@formancy/report-corpus'
import { walkComponents } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { placesOf } from './places.js'

/**
 * Where a request says a word stands (0085), for every place report-spec's
 * walk of the words visits, on the monthly sales report's own components:
 * a paragraph, a table and its group and totals, and a chart, each in the
 * region it prints in. The request suite holds every starter's places to
 * these shapes; this one holds each shape to its place.
 */

const report = SALES_REPORT.report
const phrase = placesOf(report)
const pathOf = (id: string): string => walkComponents(report).find(({ component }) => component.id === id)?.path ?? ''

describe('the place a word stands in', () => {
  // A model that cannot tell a header from a sentence writes a sentence
  // where a header stood; each place says which it is, by the component's
  // kind, its id, the column's and the region.
  test.each([
    ['/title', undefined, undefined, "the report's title, which the PDF's properties show"],
    [`${pathOf('title')}/content/0/text`, 'title', undefined, "a run of text in paragraph 'title', in the report header, before the body"],
    [
      `${pathOf('running-head')}/content/1/expression/cel`,
      'running-head',
      undefined,
      "a run of text in paragraph 'running-head', in the page header, on every page",
    ],
    [`${pathOf('sender')}/content/0/text`, 'sender', undefined, "a run of text in paragraph 'sender', in the first page's own page header"],
    [`${pathOf('lines')}/columns/2/header`, 'lines', 'region', "the header of column 'region' in table 'lines', in the body"],
    [`${pathOf('lines')}/columns/2/value/text`, 'lines', 'region', "what each row prints in column 'region' of table 'lines', in the body"],
    [`${pathOf('lines')}/columns/2/value/expression/cel`, 'lines', 'region', "what each row prints in column 'region' of table 'lines', in the body"],
    [`${pathOf('lines')}/group/header/0/expression/cel`, 'lines', undefined, "the header each group of table 'lines' prints, in the body"],
    [`${pathOf('lines')}/group/footer/0/cells/0/value/text`, 'lines', undefined, "a cell of the footer each group of table 'lines' prints, in the body"],
    [`${pathOf('lines')}/totals/0/cells/0/value/text`, 'lines', undefined, "a cell of the totals under table 'lines', in the body"],
    [`${pathOf('lines')}/emptyText`, 'lines', undefined, "what table 'lines' prints when it has no rows, in the body"],
    [
      `${pathOf('by-category')}/category/nullLabel`,
      'by-category',
      undefined,
      "the label chart 'by-category' gives the rows that have no category, in the body",
    ],
    [`${pathOf('by-category')}/series/0/label`, 'by-category', undefined, "the label of a series in chart 'by-category', in the body"],
    [`${pathOf('by-category')}/emptyText`, 'by-category', undefined, "what chart 'by-category' prints when it has nothing to draw, in the body"],
    [`${pathOf('by-category')}/title`, 'by-category', undefined, "the title of chart 'by-category', in the body"],
    [`${pathOf('by-category')}/categoryTitle`, 'by-category', undefined, "the title of the category axis of chart 'by-category', in the body"],
    [`${pathOf('by-category')}/valueTitle`, 'by-category', undefined, "the title of the value axis of chart 'by-category', in the body"],
    [`${pathOf('note')}/content/0/text`, 'note', undefined, "a run of text in paragraph 'note', in the summary, after the body"],
    [`${pathOf('page-of')}/content/0/text`, 'page-of', undefined, "a run of text in paragraph 'page-of', in the page footer, on every page"],
  ])('says %s is where it is', (path, componentId, columnId, said) => {
    expect(phrase({ path, ...(componentId === undefined ? {} : { componentId }), ...(columnId === undefined ? {} : { columnId }) })).toBe(said)
  })

  // A place the format gains before anybody names it here is still told
  // the model as something, by its property's key, and never dropped: a
  // word told nowhere would leave a header and a sentence alike.
  test('names a place no phrase knows by its property, in the component and the report alike', () => {
    expect(phrase({ path: `${pathOf('by-category')}/subtitle`, componentId: 'by-category' })).toBe(`"subtitle" of chart 'by-category', in the body`)
    expect(phrase({ path: `${pathOf('lines')}/caption`, componentId: 'lines' })).toBe(`"caption" of table 'lines', in the body`)
    expect(phrase({ path: `${pathOf('title')}/heading`, componentId: 'title' })).toBe(`"heading" of text 'title', in the report header, before the body`)
    expect(phrase({ path: '/paymentPart/message/0/text' })).toBe('"text" of the report')
  })
})
