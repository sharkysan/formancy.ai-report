import { categoryAxis, valueAxis } from './chart-axes.js'
import { chartReading, defaults, titled, unpainted } from './chart-parts.js'
import { series } from './chart-series.js'
import { CHART_SPACE } from './chart-vocabulary.js'
import type { DocxChart } from './model.js'
import { readPart, type OpcPackage, type Part } from './package.js'
import { NS } from './vocabulary.js'
import { childrenNamed } from './xml.js'

/**
 * A chart's part read back (0076, extending 0068): Word's own chart as
 * the file states it, held to a closed vocabulary (`chart-vocabulary.ts`)
 * and, here, to the one form a report's chart is written in. What the
 * model keeps is what a check compares with the document -- the kind,
 * each word and what it is set in, each value's digits, the axis, the
 * colours (`model.ts`); everything else the part states is held here to
 * the one value a report's chart states, and a part that states another
 * is refused, naming it.
 *
 * So is a part that leads anywhere: a chart of a report holds its data
 * itself, as literals, and has no relationship -- to a workbook inside
 * the file, to a file beside it or to an address.
 *
 * Here is the chart itself: its part, its plot, its kind and its legend.
 * What every reading shares is `chart-parts.ts`'s, a series
 * `chart-series.ts`'s and the axes `chart-axes.ts`'s.
 *
 * What this cannot show is what Word draws of the part: where it puts a
 * word, whether two meet, or that it opens the file.
 */

export const CHART_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'

/** The chart `part` is; throws, naming the part, where it is not one report-render-docx writes. */
export function readChart(part: Part, opc: OpcPackage): DocxChart {
  const reading = chartReading(part.name)
  const { c, fail, fixed, need, stated, whole } = reading
  if (part.contentType !== CHART_CONTENT_TYPE) fail('the part is drawn as a chart and is of another content type')
  if (opc.relationships(part.name).length > 0) fail('the chart leads to another part, where a chart holds its data itself: no workbook, no file and no address')
  const root = readPart(part.bytes, part.name, CHART_SPACE)
  fixed(root, { roundedCorners: '0' })
  unpainted(reading, c(root, 'spPr'), 'the chart')
  const chart = need(root, 'chart')
  const area = need(chart, 'plotArea')
  unpainted(reading, c(area, 'spPr'), 'the plot', false)
  const drawn = (['bar', 'line', 'pie'] as const).flatMap((kind) => {
    const node = c(area, `${kind}Chart`)
    return node === undefined ? [] : [{ kind, node }]
  })
  const [only, ...more] = drawn
  if (only === undefined || more.length > 0) return fail('the plot holds not one bar, line or pie chart')
  const { kind, node } = only
  const title = titled(reading, chart, 'the title')
  fixed(chart, { autoTitleDeleted: title.title === undefined ? '1' : '0', plotVisOnly: '1', dispBlanksAs: 'gap' })
  const read = childrenNamed(node, NS.c, 'ser').map((each, index) => series(reading, each, index, kind))
  const axes = [c(area, 'catAx'), c(area, 'valAx')] as const
  if (kind === 'pie') {
    fixed(node, { varyColors: '1', firstSliceAng: '0' })
    if (read.length !== 1 || axes[0] !== undefined || axes[1] !== undefined) fail('a pie of not one series, or with an axis')
  } else {
    fixed(node, kind === 'bar' ? { barDir: 'col', grouping: 'clustered', varyColors: '0' } : { grouping: 'standard', varyColors: '0', marker: '1' })
    const ids = childrenNamed(node, NS.c, 'axId').map((each) => each.attributes.get('val'))
    if (ids.join() !== '1,2') fail('the chart is drawn on other axes than its two')
    if (axes[0] === undefined || axes[1] === undefined) return fail('a bar or a line chart without its two axes')
  }
  const legend = c(chart, 'legend')
  if (legend !== undefined) fixed(legend, { overlay: '0' })
  return {
    part: part.name,
    kind,
    ...title,
    series: read,
    ...(kind === 'bar' ? { bars: { gapWidth: whole(node, 'gapWidth'), overlap: whole(node, 'overlap') } } : {}),
    ...(axes[0] === undefined ? {} : { categoryAxis: categoryAxis(reading, axes[0]) }),
    ...(axes[1] === undefined ? {} : { valueAxis: valueAxis(reading, axes[1]) }),
    ...(legend === undefined ? {} : { legend: { position: stated(legend, 'legendPos'), face: defaults(reading, legend, 'the legend') } }),
    face: defaults(reading, root, 'the chart'),
  }
}
