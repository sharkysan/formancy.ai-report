import { element, many, one, text } from './vocabulary.js'
import type { ElementDef, Group } from './xml.js'

/**
 * The closed vocabulary a chart's part is read in (0076): every element
 * and attribute of a `c:chartSpace` that `readDocx` reads, each element's
 * children in the order ECMA-376 Part 1 gives them, transcribed from
 * ISO/IEC 29500-4:2016's transitional `dml-chart.xsd` and, for a word's
 * properties and a shape's paints, `dml-main.xsd`, for these elements and
 * no others.
 *
 * What is not here is what a report's chart never holds, and a part that
 * holds it is refused: `c:externalData`, the relationship to a workbook or
 * to an address; `c:strRef` and `c:numRef`, a formula naming cells of one;
 * `c:userShapes`, `c:extLst`, a field in a label, a layout stated by
 * hand, and every kind of chart but a bar, a line and a pie chart.
 *
 * `c:ser` is three definitions, a bar's, a line's and a pie's, since each
 * kind's series holds other children in another order; `c:marker` is two,
 * a line series' marker and a line chart's saying that it has them; and
 * `c:tx` two, a series' name and a word of rich text.
 */

const c = (local: string, attributes: readonly string[] = [], content: () => readonly Group[] = () => []): ElementDef =>
  element('c', local, attributes, content)
const a = (local: string, attributes: readonly string[] = [], content: () => readonly Group[] = () => []): ElementDef =>
  element('a', local, attributes, content)

/** An element whose one attribute is `val`. */
const val = (local: string): Group => one(c(local, ['val']))

const solidFill = a('solidFill', [], () => [one(a('srgbClr', ['val']))])
const noFill = a('noFill')
/** A line: none, or one of a weight in a colour. */
const ln = a('ln', ['w'], () => [one(noFill), one(solidFill)])
/** A shape's paints, in `CT_ShapeProperties`' order: its fill, then its line. */
const spPr = c('spPr', [], () => [one(noFill), one(solidFill), one(ln)])

/** A word's properties, in `CT_TextCharacterProperties`' order: its colour, then its family in three scripts' slots. */
const characters = (local: string): ElementDef =>
  a(local, ['sz', 'b', 'i'], () => [one(solidFill), one(a('latin', ['typeface'])), one(a('ea', ['typeface'])), one(a('cs', ['typeface']))])
const bodyPr = a('bodyPr', ['rot', 'vert'])
/** A word the file states: one paragraph of one run. */
const rich = c('rich', [], () => [one(bodyPr), one(a('p', [], () => [one(a('r', [], () => [one(characters('rPr')), one(text('a', 't'))]))]))])
/** What the words Word writes itself are set in: a paragraph's default properties, and no word. */
const txPr = c('txPr', [], () => [one(bodyPr), one(a('p', [], () => [one(a('pPr', [], () => [one(characters('defRPr'))]))]))])
const word = c('tx', [], () => [one(rich)])
const title = c('title', [], () => [one(word), val('overlay')])

const pt = c('pt', ['idx'], () => [one(text('c', 'v'))])
/** Literal data, which names no cell: a count, and a point for each index that has one. */
const strLit = c('strLit', [], () => [val('ptCount'), many(pt)])
const numLit = c('numLit', [], () => [one(text('c', 'formatCode')), val('ptCount'), many(pt)])
const cat = c('cat', [], () => [one(strLit)])
const values = c('val', [], () => [one(numLit)])

const shows = (): Group[] => ['showLegendKey', 'showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize'].map(val)
const dLbl = c('dLbl', [], () => [val('idx'), one(word), val('dLblPos'), ...shows()])
const dLbls = c('dLbls', [], () => [many(dLbl), one(txPr), val('dLblPos'), ...shows()])

const name = c('tx', [], () => [one(text('c', 'v'))])
const barSer = c('ser', [], () => [val('idx'), val('order'), one(name), one(spPr), val('invertIfNegative'), one(dLbls), one(cat), one(values)])
const marker = c('marker', [], () => [val('symbol'), val('size'), one(spPr)])
const lineSer = c('ser', [], () => [val('idx'), val('order'), one(name), one(spPr), one(marker), one(dLbls), one(cat), one(values), val('smooth')])
const dPt = c('dPt', [], () => [val('idx'), one(spPr)])
const pieSer = c('ser', [], () => [val('idx'), val('order'), many(dPt), one(cat), one(values)])

const axIds = many(c('axId', ['val']))
const barChart = c('barChart', [], () => [val('barDir'), val('grouping'), val('varyColors'), many(barSer), val('gapWidth'), val('overlap'), axIds])
const lineChart = c('lineChart', [], () => [val('grouping'), val('varyColors'), many(lineSer), val('marker'), axIds])
const pieChart = c('pieChart', [], () => [val('varyColors'), many(pieSer), val('firstSliceAng')])

const scaling = c('scaling', [], () => [val('orientation'), val('max'), val('min')])
const catAx = c('catAx', [], () => [
  val('axId'),
  one(scaling),
  val('delete'),
  val('axPos'),
  one(title),
  val('majorTickMark'),
  val('minorTickMark'),
  val('tickLblPos'),
  one(spPr),
  one(txPr),
  val('crossAx'),
  val('crosses'),
  val('auto'),
  val('lblAlgn'),
  val('lblOffset'),
  val('tickLblSkip'),
  val('noMultiLvlLbl'),
])
const valAx = c('valAx', [], () => [
  val('axId'),
  one(scaling),
  val('delete'),
  val('axPos'),
  one(c('majorGridlines', [], () => [one(spPr)])),
  one(title),
  one(c('numFmt', ['formatCode', 'sourceLinked'])),
  val('majorTickMark'),
  val('minorTickMark'),
  val('tickLblPos'),
  one(spPr),
  one(txPr),
  val('crossAx'),
  val('crosses'),
  val('crossBetween'),
  val('majorUnit'),
])

const plotArea = c('plotArea', [], () => [one(barChart), one(lineChart), one(pieChart), one(catAx), one(valAx), one(spPr)])
const legend = c('legend', [], () => [val('legendPos'), val('overlay'), one(txPr)])
const chart = c('chart', [], () => [one(title), val('autoTitleDeleted'), one(plotArea), one(legend), val('plotVisOnly'), val('dispBlanksAs')])

/** `word/charts/chartN.xml`. */
export const CHART_SPACE: ElementDef = c('chartSpace', [], () => [val('roundedCorners'), one(chart), one(spPr), one(txPr)])
