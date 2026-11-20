import { defaults, line, titled, type ChartReading } from './chart-parts.js'
import type { DocxChart } from './model.js'
import type { XmlNode } from './xml.js'

/**
 * The two axes of a bar or a line chart's part read back (0076): what a
 * check holds to the block -- each axis's title and its labels' face,
 * where the category axis stands, the value axis's ends, step and format
 * -- and everything else held to the one value a report's chart states.
 */

/** What neither axis has: it is drawn, and has no tick mark. */
const NO_TICKS = { delete: '0', majorTickMark: 'none', minorTickMark: 'none' }

export function categoryAxis(reading: ChartReading, axis: XmlNode): NonNullable<DocxChart['categoryAxis']> {
  const { a, c, fail, fixed, need, stated, whole } = reading
  const scaling = need(axis, 'scaling')
  fixed(scaling, { orientation: 'minMax' })
  if (c(scaling, 'min') !== undefined || c(scaling, 'max') !== undefined) fail('the category axis states a range')
  fixed(axis, { ...NO_TICKS, axId: '1', crossAx: '2', axPos: 'b', tickLblPos: 'low', auto: '0', lblAlgn: 'ctr', lblOffset: '100', noMultiLvlLbl: '1' })
  const crosses = stated(axis, 'crosses')
  if (crosses !== 'autoZero' && crosses !== 'min') return fail(`the category axis crosses the value axis at '${crosses}'`)
  const shape = c(axis, 'spPr')
  if (shape !== undefined && (a(shape, 'noFill') !== undefined || a(shape, 'solidFill') !== undefined)) fail('the category axis is filled')
  return {
    ...titled(reading, axis, "the category axis's title"),
    face: defaults(reading, axis, "the category axis's labels"),
    line: line(reading, shape, 'the category axis') ?? fail('the category axis has no line'),
    crosses,
    every: whole(axis, 'tickLblSkip'),
  }
}

export function valueAxis(reading: ChartReading, axis: XmlNode): NonNullable<DocxChart['valueAxis']> {
  const { a, c, decimal, fail, fixed, need, stated } = reading
  const scaling = need(axis, 'scaling')
  fixed(scaling, { orientation: 'minMax' })
  fixed(axis, { ...NO_TICKS, axId: '2', crossAx: '1', axPos: 'l', tickLblPos: 'nextTo', crosses: 'autoZero', crossBetween: 'between' })
  const format = need(axis, 'numFmt')
  if (format.attributes.get('sourceLinked') !== '0') fail("the value axis takes its labels' format from a workbook")
  const shape = c(axis, 'spPr')
  if (shape === undefined || line(reading, shape, 'the value axis') !== undefined || a(shape, 'solidFill') !== undefined)
    fail('the value axis has a line, or a fill')
  const grid = c(axis, 'majorGridlines')
  return {
    ...titled(reading, axis, "the value axis's title"),
    face: defaults(reading, axis, "the value axis's labels"),
    min: decimal(stated(scaling, 'min'), "the value axis's lowest value"),
    max: decimal(stated(scaling, 'max'), "the value axis's highest value"),
    step: decimal(stated(axis, 'majorUnit'), "the value axis's step"),
    format: format.attributes.get('formatCode') ?? fail('the value axis states no format'),
    grid: line(reading, grid === undefined ? undefined : c(grid, 'spPr'), 'the gridlines') ?? fail('the value axis has no gridlines'),
  }
}
