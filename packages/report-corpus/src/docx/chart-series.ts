import { defaults, filled, line, word, type ChartReading } from './chart-parts.js'
import type { DocxChart, DocxChartSeries, DocxChartWord } from './model.js'
import { NS } from './vocabulary.js'
import { childrenNamed, type XmlNode } from './xml.js'

/**
 * A series of a chart's part read back (0076): its literal data, its
 * labels, its name and its paints, each held to the form a report's
 * chart states it in for its kind.
 */

/** Literal data: a list as long as its count, each point at its index and null where the part states none. */
function literal(reading: ChartReading, holder: XmlNode | undefined, kind: 'strLit' | 'numLit', of: string): (string | null)[] {
  const { c, decimal, fail, whole } = reading
  const data = holder === undefined ? undefined : c(holder, kind)
  if (data === undefined) return fail(`${of} holds no literal data`)
  if (kind === 'numLit' && c(data, 'formatCode')?.text !== 'General') fail(`${of} states a format for its values, which are the report's digits`)
  const points = new Array<string | null>(whole(data, 'ptCount')).fill(null)
  let last = -1
  for (const point of childrenNamed(data, NS.c, 'pt')) {
    const index = whole(point, 'idx', point.attributes.get('idx') ?? fail(`${of} has a point with no index`))
    if (index <= last || index >= points.length) fail(`${of} has a point out of its order, or past its count`)
    last = index
    const written = c(point, 'v')?.text ?? fail(`${of} has a point with no value`)
    points[index] = kind === 'numLit' ? decimal(written, `a value of ${of}`) : written
  }
  // A value a series has none for is a point the part does not state; a word is always stated, as nothing where it prints nothing, or Word
  // writes a number of its own in its place.
  if (kind === 'strLit' && points.includes(null)) fail(`${of} leave a point for Word to name`)
  return points
}

/** What a label shows of Word's own: nothing but, for a point's own label, its text in the value's place. */
const SHOWS = { showLegendKey: '0', showCatName: '0', showSerName: '0', showPercent: '0', showBubbleSize: '0' }

/** A series' labels: of itself it labels nothing, and every label is a word the part states for one point. */
function labelled(reading: ChartReading, series: XmlNode, count: number, of: string): Pick<DocxChartSeries, 'labels' | 'labelPosition'> {
  const { c, fail, fixed, stated, whole } = reading
  const labels = new Array<DocxChartWord | null>(count).fill(null)
  const all = c(series, 'dLbls')
  if (all === undefined) return { labels }
  fixed(all, { ...SHOWS, showVal: '0' })
  defaults(reading, all, `the labels of ${of}`)
  const labelPosition = stated(all, 'dLblPos')
  let last = -1
  for (const each of childrenNamed(all, NS.c, 'dLbl')) {
    const index = whole(each, 'idx')
    if (index <= last || index >= count) fail(`${of} labels a point out of its order, or past its count`)
    last = index
    fixed(each, { ...SHOWS, showVal: '1', dLblPos: labelPosition })
    labels[index] = word(reading, each, `a label of ${of}`)
  }
  return { labels, labelPosition }
}

/** What a series is painted in, by its kind: a bar's fill, a line's stroke and its markers, and nothing of a pie's, whose points are each their own. */
function painted(
  reading: ChartReading,
  node: XmlNode,
  kind: DocxChart['kind'],
  points: readonly (string | null)[],
  of: string,
): Pick<DocxChartSeries, 'color' | 'line' | 'marker'> {
  const { a, c, fail, fixed, need, whole } = reading
  const shape = c(node, 'spPr')
  if (kind === 'bar') {
    fixed(node, { invertIfNegative: '0' })
    return { color: filled(reading, shape, of) }
  }
  if (kind === 'line') {
    fixed(node, { smooth: '0' })
    const stroke = line(reading, shape, of) ?? fail(`${of} is a line that is not drawn`)
    if (shape !== undefined && (a(shape, 'noFill') !== undefined || a(shape, 'solidFill') !== undefined)) fail(`${of} is a line with a fill`)
    const marker = need(node, 'marker')
    fixed(marker, { symbol: 'circle' })
    if (filled(reading, c(marker, 'spPr'), `the markers of ${of}`) !== stroke.color) fail(`${of} has markers of another colour than its line`)
    return { color: stroke.color, line: stroke.weight, marker: whole(marker, 'size') }
  }
  if (shape !== undefined || points.includes(null)) fail(`${of} is a pie's and does not paint each of its points, and only them`)
  return {}
}

/** The series `node`, the `index`th of a chart of `kind`. */
export function series(reading: ChartReading, node: XmlNode, index: number, kind: DocxChart['kind']): DocxChartSeries {
  const { c, fail, fixed, whole } = reading
  const of = `series ${index}`
  fixed(node, { idx: String(index), order: String(index) })
  const categories = c(node, 'cat') === undefined ? undefined : literal(reading, c(node, 'cat'), 'strLit', `the categories of ${of}`)
  const values = literal(reading, c(node, 'val'), 'numLit', of)
  if (categories !== undefined && categories.length !== values.length) fail(`${of} has ${categories.length} categories for ${values.length} values`)
  const name = c(node, 'tx')
  const points = new Array<string | null>(values.length).fill(null)
  for (const point of childrenNamed(node, NS.c, 'dPt')) {
    const at = whole(point, 'idx')
    if (at < 0 || at >= points.length || points[at] !== null) fail(`${of} paints a point twice, or one past its count`)
    points[at] = filled(reading, c(point, 'spPr'), `point ${at} of ${of}`)
  }
  return {
    ...(name === undefined ? {} : { name: c(name, 'v')?.text ?? fail(`${of} has a name that is no text`) }),
    ...painted(reading, node, kind, points, of),
    categories: categories ?? new Array<string | null>(values.length).fill(null),
    values,
    ...labelled(reading, node, values.length, of),
    points,
  }
}
