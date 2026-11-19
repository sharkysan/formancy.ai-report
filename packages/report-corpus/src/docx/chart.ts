import { CHART_SPACE } from './chart-vocabulary.js'
import type { DocxBorder, DocxChart, DocxChartFace, DocxChartSeries, DocxChartWord } from './model.js'
import { readPart, type OpcPackage, type Part } from './package.js'
import { NS } from './vocabulary.js'
import { child, childrenNamed, type XmlNode } from './xml.js'

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
 * What this cannot show is what Word draws of the part: where it puts a
 * word, whether two meet, or that it opens the file.
 */

export const CHART_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'

/** A decimal as the runtime writes one: a minus or none, digits, and a point and digits or none. */
const DECIMAL = /^-?\d+(?:\.\d+)?$/

/** English Metric Units to the point. */
const EMU = 12700

/** The chart `part` is; throws, naming the part, where it is not one report-render-docx writes. */
export function readChart(part: Part, opc: OpcPackage): DocxChart {
  const fail = (message: string): never => {
    throw new Error(`${part.name}: ${message}`)
  }
  if (part.contentType !== CHART_CONTENT_TYPE) fail('the part is drawn as a chart and is of another content type')
  if (opc.relationships(part.name).length > 0) fail('the chart leads to another part, where a chart holds its data itself: no workbook, no file and no address')
  const root = readPart(part.bytes, part.name, CHART_SPACE)

  const c = (node: XmlNode, local: string): XmlNode | undefined => child(node, NS.c, local)
  const a = (node: XmlNode, local: string): XmlNode | undefined => child(node, NS.a, local)
  const need = (node: XmlNode, local: string): XmlNode => c(node, local) ?? fail(`${node.local} holds no ${local}`)
  const stated = (node: XmlNode, local: string): string => need(node, local).attributes.get('val') ?? fail(`${local} states no value`)
  /** Holds `local` of `node` to the one value a report's chart states for it. */
  const fixed = (node: XmlNode, values: Readonly<Record<string, string>>): void => {
    for (const [local, value] of Object.entries(values)) {
      const read = stated(node, local)
      if (read !== value) fail(`${node.local} states ${local} as '${read}', where a report's chart states '${value}'`)
    }
  }
  const whole = (node: XmlNode, local: string, written = stated(node, local)): number => {
    if (!/^-?\d+$/.test(written)) fail(`${node.local} states ${local} as '${written}', which is no whole number`)
    return Number(written)
  }
  const decimal = (written: string, what: string): string => (DECIMAL.test(written) ? written : fail(`${what} is '${written}', which is no decimal`))

  const colour = (node: XmlNode | undefined, of: string): string => {
    const written = node === undefined ? undefined : a(node, 'srgbClr')?.attributes.get('val')
    if (written === undefined || !/^[0-9A-Fa-f]{6}$/.test(written)) fail(`${of} names the colour '${String(written)}', which is not six hex digits`)
    return `#${(written as string).toLowerCase()}`
  }
  /** A shape's line: none, or one of a weight in a colour. */
  const line = (shape: XmlNode | undefined, of: string): DocxBorder | undefined => {
    const ln = shape === undefined ? undefined : a(shape, 'ln')
    if (ln === undefined) return fail(`${of} states no line, which Word then draws as it likes`)
    if (a(ln, 'noFill') !== undefined)
      return ln.attributes.has('w') || a(ln, 'solidFill') !== undefined ? fail(`${of} has a line both drawn and not`) : undefined
    return { weight: whole(ln, 'w', ln.attributes.get('w') ?? fail(`${of} has a line of no weight`)) / EMU, color: colour(a(ln, 'solidFill'), of) }
  }
  /** A shape filled in one colour, with no line around it. */
  const filled = (shape: XmlNode | undefined, of: string): string => {
    if (shape === undefined || a(shape, 'noFill') !== undefined || line(shape, of) !== undefined)
      fail(`${of} is not filled in one colour with no line around it`)
    return colour(a(shape as XmlNode, 'solidFill'), of)
  }
  /** A shape that paints nothing: no fill and, where `outlined`, no line either. */
  const unpainted = (shape: XmlNode | undefined, of: string, outlined = true): void => {
    if (shape === undefined || a(shape, 'noFill') === undefined || a(shape, 'solidFill') !== undefined) fail(`${of} is filled, or left for Word to fill`)
    if (outlined ? line(shape, of) !== undefined : a(shape as XmlNode, 'ln') !== undefined) fail(`${of} has a line around it`)
  }

  const across = (holder: XmlNode, of: string): void => {
    const body = a(holder, 'bodyPr')
    if (body?.attributes.get('rot') !== '0' || body.attributes.get('vert') !== 'horz') fail(`${of} is not held across: Word may turn it`)
  }
  const face = (set: XmlNode | undefined, of: string): DocxChartFace => {
    if (set === undefined) return fail(`${of} states nothing of what it is set in`)
    const [size, bold, italic] = ['sz', 'b', 'i'].map((key) => set.attributes.get(key) ?? fail(`${of} states no ${key}`))
    const families = ['latin', 'ea', 'cs'].map((slot) => a(set, slot)?.attributes.get('typeface'))
    if (families[0] === undefined || families.some((family) => family !== families[0])) fail(`${of} names its three typeface slots otherwise than alike`)
    if ([bold, italic].some((flag) => flag !== '0' && flag !== '1')) fail(`${of} states its weight or its slant as neither 0 nor 1`)
    return {
      family: families[0] as string,
      size: whole(set, 'sz', size) / 100,
      bold: bold === '1',
      italic: italic === '1',
      color: colour(a(set, 'solidFill'), of),
    }
  }
  /** What the words Word writes itself are set in. */
  const defaults = (holder: XmlNode, of: string): DocxChartFace => {
    const set = need(holder, 'txPr')
    across(set, of)
    const paragraph = a(set, 'p')
    const properties = paragraph === undefined ? undefined : a(paragraph, 'pPr')
    return face(properties === undefined ? undefined : a(properties, 'defRPr'), of)
  }
  /** A word the part states: one run of one paragraph. */
  const word = (holder: XmlNode, of: string): DocxChartWord => {
    const rich = c(need(holder, 'tx'), 'rich') ?? fail(`${of} is no word of the file's own`)
    across(rich, of)
    const paragraph = a(rich, 'p')
    const run = paragraph === undefined ? undefined : a(paragraph, 'r')
    const text = run === undefined ? undefined : a(run, 't')
    if (run === undefined || text === undefined) return fail(`${of} holds no text`)
    return { text: text.text, face: face(a(run, 'rPr'), of) }
  }
  const titled = (holder: XmlNode, of: string): { readonly title?: DocxChartWord } => {
    const title = c(holder, 'title')
    if (title === undefined) return {}
    fixed(title, { overlay: '0' })
    return { title: word(title, of) }
  }

  /** Literal data: a list as long as its count, each point at its index and null where the part states none. */
  const literal = (holder: XmlNode | undefined, kind: 'strLit' | 'numLit', of: string): (string | null)[] => {
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
    return points
  }
  const SHOWS = { showLegendKey: '0', showCatName: '0', showSerName: '0', showPercent: '0', showBubbleSize: '0' }
  const labelled = (series: XmlNode, count: number, of: string): Pick<DocxChartSeries, 'labels' | 'labelPosition'> => {
    const labels = new Array<DocxChartWord | null>(count).fill(null)
    const all = c(series, 'dLbls')
    if (all === undefined) return { labels }
    // Of itself a series labels nothing: every label is a word the part states for one point.
    fixed(all, { ...SHOWS, showVal: '0' })
    defaults(all, `the labels of ${of}`)
    const labelPosition = stated(all, 'dLblPos')
    let last = -1
    for (const each of childrenNamed(all, NS.c, 'dLbl')) {
      const index = whole(each, 'idx')
      if (index <= last || index >= count) fail(`${of} labels a point out of its order, or past its count`)
      last = index
      fixed(each, { ...SHOWS, showVal: '1', dLblPos: labelPosition })
      labels[index] = word(each, `a label of ${of}`)
    }
    return { labels, labelPosition }
  }
  const series = (node: XmlNode, index: number, kind: DocxChart['kind']): DocxChartSeries => {
    const of = `series ${index}`
    fixed(node, { idx: String(index), order: String(index) })
    const categories = c(node, 'cat') === undefined ? undefined : literal(c(node, 'cat'), 'strLit', `the categories of ${of}`)
    const values = literal(c(node, 'val'), 'numLit', of)
    if (categories !== undefined && categories.length !== values.length) fail(`${of} has ${categories.length} categories for ${values.length} values`)
    const name = c(node, 'tx')
    const shape = c(node, 'spPr')
    const points = new Array<string | null>(values.length).fill(null)
    for (const point of childrenNamed(node, NS.c, 'dPt')) {
      const at = whole(point, 'idx')
      if (at < 0 || at >= points.length || points[at] !== null) fail(`${of} paints a point twice, or one past its count`)
      points[at] = filled(c(point, 'spPr'), `point ${at} of ${of}`)
    }
    const drawn: { color?: string; line?: number; marker?: number } = {}
    if (kind === 'bar') {
      fixed(node, { invertIfNegative: '0' })
      drawn.color = filled(shape, of)
    } else if (kind === 'line') {
      fixed(node, { smooth: '0' })
      const stroke = line(shape, of) ?? fail(`${of} is a line that is not drawn`)
      if (shape !== undefined && (a(shape, 'noFill') !== undefined || a(shape, 'solidFill') !== undefined)) fail(`${of} is a line with a fill`)
      const marker = need(node, 'marker')
      fixed(marker, { symbol: 'circle' })
      if (filled(c(marker, 'spPr'), `the markers of ${of}`) !== stroke.color) fail(`${of} has markers of another colour than its line`)
      Object.assign(drawn, { color: stroke.color, line: stroke.weight, marker: whole(marker, 'size') })
    } else if (shape !== undefined || points.includes(null)) fail(`${of} is a pie's and does not paint each of its points, and only them`)
    return {
      ...(name === undefined ? {} : { name: c(name, 'v')?.text ?? fail(`${of} has a name that is no text`) }),
      ...drawn,
      categories: categories ?? new Array<string | null>(values.length).fill(null),
      values,
      ...labelled(node, values.length, of),
      points,
    }
  }

  fixed(root, { roundedCorners: '0' })
  unpainted(c(root, 'spPr'), 'the chart')
  const chart = need(root, 'chart')
  const area = need(chart, 'plotArea')
  unpainted(c(area, 'spPr'), 'the plot', false)
  const drawn = (['bar', 'line', 'pie'] as const).flatMap((kind) => {
    const node = c(area, `${kind}Chart`)
    return node === undefined ? [] : [{ kind, node }]
  })
  if (drawn.length !== 1) return fail('the plot holds not one bar, line or pie chart')
  const { kind, node } = drawn[0]!
  const title = titled(chart, 'the title')
  fixed(chart, { autoTitleDeleted: title.title === undefined ? '1' : '0', plotVisOnly: '1', dispBlanksAs: 'gap' })
  const read = childrenNamed(node, NS.c, 'ser').map((each, index) => series(each, index, kind))
  const [categoryAxis, valueAxis] = [c(area, 'catAx'), c(area, 'valAx')]
  if (kind === 'pie') {
    fixed(node, { varyColors: '1', firstSliceAng: '0' })
    if (read.length !== 1 || categoryAxis !== undefined || valueAxis !== undefined) fail('a pie of not one series, or with an axis')
  } else {
    fixed(node, kind === 'bar' ? { barDir: 'col', grouping: 'clustered', varyColors: '0' } : { grouping: 'standard', varyColors: '0', marker: '1' })
    if (
      childrenNamed(node, NS.c, 'axId')
        .map((each) => each.attributes.get('val'))
        .join() !== '1,2'
    )
      fail('the chart is drawn on other axes than its two')
    if (categoryAxis === undefined || valueAxis === undefined) return fail('a bar or a line chart without its two axes')
  }
  const NO_TICKS = { delete: '0', majorTickMark: 'none', minorTickMark: 'none' }
  const legend = c(chart, 'legend')
  if (legend !== undefined) fixed(legend, { overlay: '0' })
  return {
    part: part.name,
    kind,
    ...title,
    series: read,
    ...(kind === 'bar' ? { bars: { gapWidth: whole(node, 'gapWidth'), overlap: whole(node, 'overlap') } } : {}),
    ...(categoryAxis === undefined
      ? {}
      : {
          categoryAxis: (() => {
            const scaling = need(categoryAxis, 'scaling')
            fixed(scaling, { orientation: 'minMax' })
            if (c(scaling, 'min') !== undefined || c(scaling, 'max') !== undefined) fail('the category axis states a range')
            fixed(categoryAxis, {
              ...NO_TICKS,
              axId: '1',
              crossAx: '2',
              axPos: 'b',
              tickLblPos: 'low',
              auto: '0',
              lblAlgn: 'ctr',
              lblOffset: '100',
              noMultiLvlLbl: '1',
            })
            const crosses = stated(categoryAxis, 'crosses')
            if (crosses !== 'autoZero' && crosses !== 'min') fail(`the category axis crosses the value axis at '${crosses}'`)
            const shape = c(categoryAxis, 'spPr')
            if (shape !== undefined && (a(shape, 'noFill') !== undefined || a(shape, 'solidFill') !== undefined)) fail('the category axis is filled')
            return {
              ...titled(categoryAxis, "the category axis's title"),
              face: defaults(categoryAxis, "the category axis's labels"),
              line: line(shape, 'the category axis') ?? fail('the category axis has no line'),
              crosses: crosses as 'autoZero' | 'min',
              every: whole(categoryAxis, 'tickLblSkip'),
            }
          })(),
        }),
    ...(valueAxis === undefined
      ? {}
      : {
          valueAxis: (() => {
            const scaling = need(valueAxis, 'scaling')
            fixed(scaling, { orientation: 'minMax' })
            fixed(valueAxis, { ...NO_TICKS, axId: '2', crossAx: '1', axPos: 'l', tickLblPos: 'nextTo', crosses: 'autoZero', crossBetween: 'between' })
            const format = need(valueAxis, 'numFmt')
            if (format.attributes.get('sourceLinked') !== '0') fail("the value axis takes its labels' format from a workbook")
            const shape = c(valueAxis, 'spPr')
            if (shape === undefined || line(shape, 'the value axis') !== undefined || a(shape, 'solidFill') !== undefined)
              fail('the value axis has a line, or a fill')
            const grid = c(valueAxis, 'majorGridlines')
            return {
              ...titled(valueAxis, "the value axis's title"),
              face: defaults(valueAxis, "the value axis's labels"),
              min: decimal(stated(scaling, 'min'), "the value axis's lowest value"),
              max: decimal(stated(scaling, 'max'), "the value axis's highest value"),
              step: decimal(stated(valueAxis, 'majorUnit'), "the value axis's step"),
              format: format.attributes.get('formatCode') ?? fail('the value axis states no format'),
              grid: line(grid === undefined ? undefined : c(grid, 'spPr'), 'the gridlines') ?? fail('the value axis has no gridlines'),
            }
          })(),
        }),
    ...(legend === undefined ? {} : { legend: { position: stated(legend, 'legendPos'), face: defaults(legend, 'the legend') } }),
    face: defaults(root, 'the chart'),
  }
}
