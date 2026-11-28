import { walkComponents } from '@formancy/report-spec'
import type { ComponentKind, ComponentLocation, RegionName, ReportDefinition } from '@formancy/report-spec'

/**
 * Where a word stands in a report, in words a model reads (0085): "the
 * header of column 'qty' in table 'lines', in the body".
 *
 * Derived from each place's JSON Pointer -- report-spec's walk of a
 * report's words, `wordPlaces`, names every place by one -- and from the
 * component it stands in, its kind, its id and its region. An id is a
 * name (`NOT_WORDS`' `**\/id`), never printed text, and the one thing of
 * the report a place says besides what kind of thing stands there. A word
 * is a column header or a sentence, and a model that cannot tell which
 * writes a sentence where a header stood (formancy.ai 0161's places, made
 * of a report's walk).
 *
 * Model-facing English, whatever the person's language, because the
 * reader of a request is a model.
 */

/** A place inside a component, after the component's own pointer, and what it is, for a component `id`. */
type Placer = (rest: string, id: string, column: string | undefined) => string | undefined

const NONE: Placer = () => undefined

/** A run of a paragraph: literal text or an expression run where a word stands. */
const RUN = /^\/content\/\d+\/(?:text|expression\/cel)$/

const text: Placer = (rest, id) => (RUN.test(rest) ? `a run of text in paragraph '${id}'` : undefined)

const table: Placer = (rest, id, column) => {
  if (/^\/columns\/\d+\/header$/.test(rest)) return `the header of column '${column ?? ''}' in table '${id}'`
  if (/^\/columns\/\d+\/value\//.test(rest)) return `what each row prints in column '${column ?? ''}' of table '${id}'`
  if (rest.startsWith('/group/header/')) return `the header each group of table '${id}' prints`
  if (rest.startsWith('/group/footer/')) return `a cell of the footer each group of table '${id}' prints`
  if (rest.startsWith('/totals/')) return `a cell of the totals under table '${id}'`
  if (rest === '/emptyText') return `what table '${id}' prints when it has no rows`
  return undefined
}

const CHART: { readonly [rest: string]: (id: string) => string } = {
  '/category/nullLabel': (id) => `the label chart '${id}' gives the rows that have no category`,
  '/emptyText': (id) => `what chart '${id}' prints when it has nothing to draw`,
  '/title': (id) => `the title of chart '${id}'`,
  '/categoryTitle': (id) => `the title of the category axis of chart '${id}'`,
  '/valueTitle': (id) => `the title of the value axis of chart '${id}'`,
}

const chart: Placer = (rest, id) => {
  if (/^\/series\/\d+\/label$/.test(rest)) return `the label of a series in chart '${id}'`
  return CHART[rest]?.(id)
}

/**
 * The places each kind holds words in. A table over every kind, as
 * report-spec's walk of the words is, so a kind added to the format does
 * not compile here until somebody says what its places are called.
 */
const PLACERS: { readonly [K in ComponentKind]: Placer } = {
  text,
  image: NONE,
  qrCode: NONE,
  epcQrCode: NONE,
  line: NONE,
  rectangle: NONE,
  spacer: NONE,
  columns: NONE,
  section: NONE,
  table,
  chart,
  pageBreak: NONE,
  keepTogether: NONE,
}

/** Where on the pages a region prints. */
const REGIONS: { readonly [R in RegionName]: string } = {
  reportHeader: 'in the report header, before the body',
  firstPageHeader: "in the first page's own page header",
  pageHeader: 'in the page header, on every page',
  body: 'in the body',
  pageFooter: 'in the page footer, on every page',
  summary: 'in the summary, after the body',
}

/** What a place of the report's own level is, outside every component. Looked up by a pointer, which starts with a slash, so never by a name an object holds. */
const REPORT: { readonly [path: string]: string } = {
  '/title': "the report's title, which the PDF's properties show",
}

/** The last segment of a pointer: what a place no phrase names is called by, its property's own key. */
const lastSegment = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/**
 * A function from a place -- its pointer, and the component and the column
 * it stands in, as report-spec's walk gives them -- to its phrase. A place
 * no phrase here knows is named by its property's key, so that a place the
 * format gains is still told the model as something, and never dropped.
 */
export function placesOf(report: ReportDefinition): (place: { readonly path: string; readonly componentId?: string; readonly columnId?: string }) => string {
  const components = new Map<string, ComponentLocation>(walkComponents(report).map((location) => [location.component.id, location]))
  return ({ path, componentId, columnId }) => {
    const location = componentId === undefined ? undefined : components.get(componentId)
    if (location === undefined) return REPORT[path] ?? `"${lastSegment(path)}" of the report`
    const { component, region } = location
    const rest = path.slice(location.path.length)
    const what = PLACERS[component.kind](rest, component.id, columnId) ?? `"${lastSegment(path)}" of ${component.kind} '${component.id}'`
    return `${what}, ${REGIONS[region]}`
  }
}
