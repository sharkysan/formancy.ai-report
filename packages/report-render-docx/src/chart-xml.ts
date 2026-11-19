import type { AxisChart, Chart, ChartSeriesValues, PieChart } from '@formancy/report-runtime'
import { digitsOf, exactOf, minus, placesOf } from './chart-exact.js'
import { chartFaces, printed, type ChartFace } from './charts.js'
import type { DocxFonts } from './fonts.js'
import { AXIS, BAR_CATEGORY_GAP, BAR_GAP, GRID, LINE_WIDTH, POINT_RADIUS } from './look.js'
import { emu } from './units.js'
import { attribute, decimal, element, hexColor, own, part, text, type AttributeValue, type Name, type Xml } from './xml.js'

/**
 * A chart's part, `word/charts/chartN.xml` (0076): DrawingML's
 * `c:chartSpace`, which Word draws, written from the runtime's block
 * alone, every element's children in the order ECMA-376 Part 1 gives
 * them -- transcribed from ISO/IEC 29500-4:2016's transitional
 * `dml-chart.xsd` and `dml-main.xsd` for the elements below and no
 * others, and transcribed once more in the corpus's reader
 * (`chart-vocabulary.ts` there).
 *
 * - **Data, and no workbook.** Each series' categories and values are
 *   literals (`c:strLit`, `c:numLit`), which name no cell: the part has
 *   no relationship, no `c:externalData`, and no formula. A value the
 *   block has none for is a point the part does not state.
 * - **Numbers.** A value is the block's `exact`, digit for digit
 *   (`decimal`). The value axis is the block's ticks: its lowest and its
 *   highest as its ends, and their step, worked out in BigInt, as the
 *   room between two gridlines, so that Word scales nothing itself.
 * - **Words.** Every word the block gives is one the part states: the
 *   title, the axes' titles, each category's label, each series' name --
 *   its legend entry -- and each value's label, a point's own text and
 *   never a number Word formats. A category's label and a series' name
 *   that print nothing are stated all the same, as nothing, so that Word
 *   writes no word of its own in the slot. A pie's categories are its legend's
 *   entries, which hold each value and its share as the runtime wrote
 *   them; no label stands on a slice. The value axis's labels alone are
 *   Word's: it writes them from the numbers, in the reader's own
 *   separators, at as many places as the ticks need (`axisFormat`).
 * - **Look.** Each series and slice in the block's colour, with no line
 *   around it; every word in the chart's face, held across; no fill and
 *   no line around the chart or its plot; gridlines and the category
 *   axis's line as the PDF draws them; the legend at the foot. What
 *   DrawingML leaves to Word unless it is said -- a title of Word's own,
 *   rounded corners, a smoothed line, a bar below zero in another paint,
 *   a missing value drawn as nothing, every category labelled -- is
 *   said.
 */

const CHART = own('http://schemas.openxmlformats.org/drawingml/2006/chart')
const MAIN = own('http://schemas.openxmlformats.org/drawingml/2006/main')

/** An element whose one attribute is `val`. */
const val = (name: Name, value: AttributeValue): Xml => element(name, [['val', value]])
const flag = (name: Name, on: boolean): Xml => val(name, on ? 1 : 0)

const solid = (color: string): Xml => element('a:solidFill', [], [element('a:srgbClr', [['val', hexColor(color)]])])
const NO_FILL = element('a:noFill')
const NO_LINE = element('a:ln', [], [NO_FILL])
/** A line `weight` points wide. */
const stroke = (weight: number, color: string): Xml => element('a:ln', [['w', emu(weight)]], [solid(color)])
const shape = (...paints: readonly Xml[]): Xml => element('c:spPr', [], paints)

/** Held across: without it Word may turn a category's label, or an axis's title. */
const ACROSS = element('a:bodyPr', [
  ['rot', 0],
  ['vert', own('horz')],
])

/** A word's properties, in `CT_TextCharacterProperties`' order: its size in hundredths of a point, its weight, its slant, its colour, and its family in all three scripts' slots. */
function characters(name: 'a:rPr' | 'a:defRPr', face: ChartFace): Xml {
  const family = attribute(face.family)
  return element(
    name,
    [
      ['sz', Math.round(face.size * 100)],
      ['b', face.bold ? 1 : 0],
      ['i', face.italic ? 1 : 0],
    ],
    [solid(face.color), ...(['a:latin', 'a:ea', 'a:cs'] as const).map((slot) => element(slot, [['typeface', family]]))],
  )
}

/** A word the part states: one run of one paragraph. */
const word = (words: string, face: ChartFace): Xml =>
  element(
    'c:tx',
    [],
    [element('c:rich', [], [ACROSS, element('a:p', [], [element('a:r', [], [characters('a:rPr', face), element('a:t', [], [text(words)])])])])],
  )

/** What the words Word writes itself are set in. */
const defaults = (face: ChartFace): Xml => element('c:txPr', [], [ACROSS, element('a:p', [], [element('a:pPr', [], [characters('a:defRPr', face)])])])

/** A title, beside what it titles and never over it; none for a word that prints nothing. */
function title(words: string | undefined, face: ChartFace): Xml[] {
  const said = printed(words)
  return said === undefined ? [] : [element('c:title', [], [word(said, face), flag('c:overlay', false)])]
}

/** Literal points: a count, and a point at its index for each entry there is. */
function points(entries: readonly (Xml | undefined)[]): Xml[] {
  return [
    val('c:ptCount', entries.length),
    ...entries.flatMap((each, index) => (each === undefined ? [] : [element('c:pt', [['idx', index]], [element('c:v', [], [each])])])),
  ]
}

/** A series' categories, every one stated: a label that prints nothing as nothing, since a category the part leaves out is one Word numbers itself. */
const categories = (labels: readonly (string | undefined)[]): Xml =>
  element('c:cat', [], [element('c:strLit', [], points(labels.map((label) => text(printed(label) ?? ''))))])

/** A series' values, each the block's digits; the format is General, so that the part says nothing of how a value prints. */
const values = (exact: readonly (string | undefined)[]): Xml =>
  element(
    'c:val',
    [],
    [
      element(
        'c:numLit',
        [],
        [element('c:formatCode', [], [own('General')]), ...points(exact.map((each) => (each === undefined ? undefined : decimal(each))))],
      ),
    ],
  )

const SHOWN = ['c:showLegendKey', 'c:showVal', 'c:showCatName', 'c:showSerName', 'c:showPercent', 'c:showBubbleSize'] as const
/** What a label shows of Word's own: nothing, or, where a point states its own text, that text in the value's place. */
const shows = (value: boolean): Xml[] => SHOWN.map((name) => flag(name, value && name === 'c:showVal'))

/**
 * A series' labels: for each value that has one a point's own, whose
 * text is the runtime's, at `position`; and of itself the series labels
 * nothing, so that Word formats no number. None where the chart labels
 * no value.
 */
function labels(chart: AxisChart, { values: each }: ChartSeriesValues, face: ChartFace, position: 'outEnd' | 't'): Xml[] {
  if (!chart.valueLabels) return []
  const placed = val('c:dLblPos', own(position))
  const stated = each.flatMap((value, index) => {
    const said = value === null ? undefined : printed(value.text)
    return said === undefined ? [] : [element('c:dLbl', [], [val('c:idx', index), word(said, face), placed, ...shows(true)])]
  })
  return [element('c:dLbls', [], [...stated, defaults(face), placed, ...shows(false)])]
}

/**
 * What every series opens with: its place, and its name, the legend's
 * entry, where the chart has a legend -- stated though it prints nothing,
 * as nothing, since a series the part does not name is one Word names
 * itself, "Series2", beside the swatch.
 */
function opening(chart: AxisChart, index: number): Xml[] {
  const name = chart.legend.length === 0 ? [] : [element('c:tx', [], [element('c:v', [], [text(printed(chart.legend[index]?.text) ?? '')])])]
  return [val('c:idx', index), val('c:order', index), ...name]
}

/** The two axes' ids, each the other's cross axis. */
const [CATEGORY_AXIS, VALUE_AXIS] = [1, 2]

const exactOfEach = (series: ChartSeriesValues): (string | undefined)[] => series.values.map((value) => value?.exact)

/**
 * Bars, side by side: each filled in its series' colour with no line
 * around it, one below zero painted as any other. The gaps are the PDF's
 * two, in Word's terms, whole hundredths of a bar's width: between two
 * bars of a category `BAR_GAP` of a bar, and between two categories what
 * `BAR_CATEGORY_GAP` of a slot is in bars.
 */
function barChart(chart: AxisChart, face: ChartFace): Xml {
  const bars = chart.series.length
  const gap = (100 * BAR_CATEGORY_GAP * (bars + (bars - 1) * BAR_GAP)) / (1 - BAR_CATEGORY_GAP)
  return element(
    'c:barChart',
    [],
    [
      val('c:barDir', own('col')),
      val('c:grouping', own('clustered')),
      flag('c:varyColors', false),
      ...chart.series.map((series, index) =>
        element(
          'c:ser',
          [],
          [
            ...opening(chart, index),
            shape(solid(series.color), NO_LINE),
            flag('c:invertIfNegative', false),
            ...labels(chart, series, face, 'outEnd'),
            categories(chart.categories),
            values(exactOfEach(series)),
          ],
        ),
      ),
      val('c:gapWidth', Math.round(gap)),
      val('c:overlap', -Math.round(100 * BAR_GAP)),
      val('c:axId', CATEGORY_AXIS),
      val('c:axId', VALUE_AXIS),
    ],
  )
}

/** Lines: each stroked in its series' colour and never smoothed, a marker at each value, filled in that colour, and the line broken where a value is missing (`c:dispBlanksAs`). */
function lineChart(chart: AxisChart, face: ChartFace): Xml {
  return element(
    'c:lineChart',
    [],
    [
      val('c:grouping', own('standard')),
      flag('c:varyColors', false),
      ...chart.series.map((series, index) =>
        element(
          'c:ser',
          [],
          [
            ...opening(chart, index),
            shape(stroke(LINE_WIDTH, series.color)),
            element('c:marker', [], [val('c:symbol', own('circle')), val('c:size', 2 * POINT_RADIUS), shape(solid(series.color), NO_LINE)]),
            ...labels(chart, series, face, 't'),
            categories(chart.categories),
            values(exactOfEach(series)),
            flag('c:smooth', false),
          ],
        ),
      ),
      flag('c:marker', true),
      val('c:axId', CATEGORY_AXIS),
      val('c:axId', VALUE_AXIS),
    ],
  )
}

/** A pie: one series, each slice a point in its own colour from the top, clockwise, as the PDF draws it, and named by its legend entry. */
function pieChart(chart: PieChart): Xml {
  const series = [
    val('c:idx', 0),
    val('c:order', 0),
    ...chart.slices.map(({ color }, index) => element('c:dPt', [], [val('c:idx', index), shape(solid(color), NO_LINE)])),
    ...(chart.legend.length === 0 ? [] : [categories(chart.slices.map((_, index) => chart.legend[index]?.text))]),
    values(chart.slices.map(({ value }) => value.exact)),
  ]
  return element('c:pieChart', [], [flag('c:varyColors', true), element('c:ser', [], series), val('c:firstSliceAng', 0)])
}

const UNMARKED = [val('c:majorTickMark', own('none')), val('c:minorTickMark', own('none'))]

/**
 * The category axis: every category labelled, at the plot's foot, its
 * line the PDF's. A bar stands on where this axis crosses the value
 * axis, so a bar chart's crosses at zero; a line chart's stands at the
 * value axis's lowest value, the plot's foot, as the PDF draws it.
 */
function categoryAxis(chart: AxisChart, face: ChartFace): Xml {
  return element(
    'c:catAx',
    [],
    [
      val('c:axId', CATEGORY_AXIS),
      element('c:scaling', [], [val('c:orientation', own('minMax'))]),
      flag('c:delete', false),
      val('c:axPos', own('b')),
      ...title(chart.categoryTitle, face),
      ...UNMARKED,
      val('c:tickLblPos', own('low')),
      shape(stroke(AXIS.weight, AXIS.color)),
      defaults(face),
      val('c:crossAx', VALUE_AXIS),
      val('c:crosses', chart.chart === 'bar' ? own('autoZero') : own('min')),
      flag('c:auto', false),
      val('c:lblAlgn', own('ctr')),
      val('c:lblOffset', 100),
      val('c:tickLblSkip', 1),
      flag('c:noMultiLvlLbl', true),
    ],
  )
}

/**
 * The format Word prints the value axis's labels in: digits, at as many
 * places as the tick that needs the most, and nothing else -- no
 * grouping, no currency and no unit, none of which the block states
 * apart from the text it printed them in.
 */
function axisFormat(ticks: readonly string[]): Xml {
  const places = Math.max(...ticks.map((tick) => placesOf(exactOf(tick)!)))
  return attribute(places === 0 ? '0' : `0.${'0'.repeat(places)}`)
}

/**
 * The value axis: the runtime's ticks, from the lowest to the highest in
 * their step, a gridline at each, no line of its own and no tick mark,
 * its title held across.
 */
function valueAxis(chart: AxisChart, face: ChartFace): Xml {
  const ticks = chart.ticks.map(({ exact }) => exact)
  const [lowest, next, highest] = [ticks[0]!, ticks[1]!, ticks.at(-1)!]
  const step = digitsOf(minus(exactOf(next)!, exactOf(lowest)!))
  return element(
    'c:valAx',
    [],
    [
      val('c:axId', VALUE_AXIS),
      element('c:scaling', [], [val('c:orientation', own('minMax')), val('c:max', decimal(highest)), val('c:min', decimal(lowest))]),
      flag('c:delete', false),
      val('c:axPos', own('l')),
      element('c:majorGridlines', [], [shape(stroke(GRID.weight, GRID.color))]),
      ...title(chart.valueTitle, face),
      element('c:numFmt', [
        ['formatCode', axisFormat(ticks)],
        ['sourceLinked', 0],
      ]),
      ...UNMARKED,
      val('c:tickLblPos', own('nextTo')),
      shape(NO_LINE),
      defaults(face),
      val('c:crossAx', CATEGORY_AXIS),
      val('c:crosses', own('autoZero')),
      val('c:crossBetween', own('between')),
      val('c:majorUnit', decimal(step)),
    ],
  )
}

/** `chart`, which has something to draw and which the checks passed, as the text of its part. */
export function chartXml(chart: Chart, fonts: DocxFonts): string {
  const faces = chartFaces(chart, fonts)
  const titled = title(chart.title, faces.title)
  const plot =
    chart.chart === 'pie'
      ? [pieChart(chart)]
      : [chart.chart === 'bar' ? barChart(chart, faces.words) : lineChart(chart, faces.words), categoryAxis(chart, faces.words), valueAxis(chart, faces.words)]
  const legend = chart.legend.length === 0 ? [] : [element('c:legend', [], [val('c:legendPos', own('b')), flag('c:overlay', false), defaults(faces.words)])]
  const drawn = element(
    'c:chart',
    [],
    [
      ...titled,
      // Without a title of its own Word titles a chart of one series by that series' name: said not to.
      flag('c:autoTitleDeleted', titled.length === 0),
      element('c:plotArea', [], [...plot, shape(NO_FILL, NO_LINE)]),
      ...legend,
      flag('c:plotVisOnly', true),
      val('c:dispBlanksAs', own('gap')),
    ],
  )
  const space = element(
    'c:chartSpace',
    [
      ['xmlns:c', CHART],
      ['xmlns:a', MAIN],
    ],
    [flag('c:roundedCorners', false), drawn, shape(NO_FILL, NO_LINE), defaults(faces.words)],
  )
  return part(space)
}
