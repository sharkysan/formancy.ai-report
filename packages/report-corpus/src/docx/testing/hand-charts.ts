import type { AxisChart, Chart, PieChart, ResolvedDocument } from '../../document.js'
import { expectation, type Fixture } from '../../fixture.js'
import { DECLARATION, DRAWING, HAND_DOCUMENT, handParts, margins, plain, R, relationships, SECTION, text, TINY, TYPE, W } from './hand.js'

/**
 * A Word file with a bar, a line and a pie chart and a chart with nothing
 * to draw, written by hand (0076), for the tests of the corpus's reader
 * and checks of a chart: each chart's part typed out below as record
 * 0076 states it, element by element. Nothing in it comes from
 * report-render-docx, so a reader or a check that passes it was not
 * taught by the writer what to expect.
 */

/** Two series of bars over four regions, each value labelled: one below zero, one of zero and one missing. */
export const HAND_BARS: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'sales',
  width: 360,
  height: 240,
  style: { size: 8, color: '#333333', italic: false },
  title: 'Sales by region',
  categoryTitle: 'Region',
  valueTitle: 'CHF thousands',
  categories: ['North', 'South', 'East', 'West'],
  series: [
    {
      color: '#1f77b4',
      values: [{ exact: '10.25', text: '10.25' }, { exact: '-5', text: '-5.00' }, null, { exact: '7.5', text: '7.50' }],
    },
    {
      color: '#d95f02',
      values: [
        { exact: '15', text: '15.00' },
        { exact: '2.5', text: '2.50' },
        { exact: '-2.5', text: '-2.50' },
        { exact: '0', text: '0.00' },
      ],
    },
  ],
  ticks: ['-5', '0', '5', '10', '15'].map((exact) => ({ exact, text: exact })),
  valueLabels: true,
  legend: [
    { text: 'Plan', color: '#1f77b4' },
    { text: 'Actual', color: '#d95f02' },
  ],
}

/** One line over three months, broken where February has no value, with no title, no label and no legend; its ticks half a unit apart. */
export const HAND_LINE: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'balance',
  width: 300,
  height: 200,
  categories: ['Jan', 'Feb', 'Mar'],
  series: [{ color: '#1b9e77', values: [{ exact: '0.5', text: '0.5' }, null, { exact: '1.25', text: '1.3' }] }],
  ticks: [
    { exact: '0', text: '0.0' },
    { exact: '0.5', text: '0.5' },
    { exact: '1', text: '1.0' },
    { exact: '1.5', text: '1.5' },
  ],
  valueLabels: false,
  legend: [],
}

/** A pie of three regions, one of them nothing, each entry of its legend its value and its share. */
export const HAND_PIE: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'shares',
  width: 200,
  height: 200,
  title: 'Shares',
  slices: [
    { color: '#1f77b4', value: { exact: '45', text: '45' } },
    { color: '#d95f02', value: { exact: '0', text: '0' } },
    { color: '#1b9e77', value: { exact: '55', text: '55' } },
  ],
  legend: [
    { text: 'North: 45 (45.0 %)', color: '#1f77b4' },
    { text: 'South: 0 (0.0 %)', color: '#d95f02' },
    { text: 'East: 55 (55.0 %)', color: '#1b9e77' },
  ],
}

/** A chart with nothing to draw: its title and its empty text. */
export const HAND_EMPTY: Chart = {
  kind: 'chart',
  chart: 'line',
  id: 'nothing',
  width: 300,
  height: 120,
  title: 'Balance',
  legend: [],
  empty: 'No rows to chart',
  categories: [],
  series: [],
  ticks: [],
  valueLabels: false,
}

/** The document the file says: a heading kept with the bar chart under it, the three charts, the one with nothing to draw, and a line after them. */
export const HAND_CHARTS_DOCUMENT: ResolvedDocument = {
  ...HAND_DOCUMENT,
  body: [
    { kind: 'paragraph', runs: [{ text: 'Charts by hand' }], style: { size: 10 }, keepWithNext: true },
    HAND_BARS,
    HAND_LINE,
    HAND_PIE,
    HAND_EMPTY,
    { kind: 'paragraph', runs: [{ text: 'After the charts' }], style: { size: 10 } },
  ],
}

export const HAND_CHARTS: Fixture = {
  id: 'hand-charts',
  title: 'A bar, a line and a pie chart and one with nothing to draw, written by hand',
  document: HAND_CHARTS_DOCUMENT,
  maxPages: 2,
  expect: expectation(HAND_CHARTS_DOCUMENT, { maxPagesExpected: 2 }),
}

const C = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"'
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
export const CHART_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'

const fill = (hex: string): string => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`
const NO_LINE = '<a:ln><a:noFill/></a:ln>'
const ACROSS = '<a:bodyPr rot="0" vert="horz"/>'
/** What a word is set in: 8 pt Roboto, in `hex`, bold where it is a title. */
const face = (tag: 'rPr' | 'defRPr', hex: string, bold = false): string =>
  `<a:${tag} sz="800" b="${bold ? 1 : 0}" i="0">${fill(hex)}<a:latin typeface="Roboto"/><a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:${tag}>`
const word = (words: string, hex: string, bold = false): string =>
  `<c:tx><c:rich>${ACROSS}<a:p><a:r>${face('rPr', hex, bold)}<a:t>${words}</a:t></a:r></a:p></c:rich></c:tx>`
const defaults = (hex: string): string => `<c:txPr>${ACROSS}<a:p><a:pPr>${face('defRPr', hex)}</a:pPr></a:p></c:txPr>`
const title = (words: string, hex: string, bold = false): string => `<c:title>${word(words, hex, bold)}<c:overlay val="0"/></c:title>`
/** Literal points, one for each entry that is not null, at its index. */
const points = (list: readonly (string | null)[]): string =>
  `<c:ptCount val="${list.length}"/>${list.map((each, index) => (each === null ? '' : `<c:pt idx="${index}"><c:v>${each}</c:v></c:pt>`)).join('')}`
const cat = (list: readonly (string | null)[]): string => `<c:cat><c:strLit>${points(list)}</c:strLit></c:cat>`
const val = (list: readonly (string | null)[]): string => `<c:val><c:numLit><c:formatCode>General</c:formatCode>${points(list)}</c:numLit></c:val>`
const shows = (value: 0 | 1): string =>
  `<c:showLegendKey val="0"/><c:showVal val="${value}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>`
/** A label for each entry that is not null, above its bar's end, and a series that of itself labels nothing. */
const labels = (list: readonly (string | null)[], hex: string): string =>
  `<c:dLbls>${list.map((each, index) => (each === null ? '' : `<c:dLbl><c:idx val="${index}"/>${word(each, hex)}<c:dLblPos val="outEnd"/>${shows(1)}</c:dLbl>`)).join('')}${defaults(hex)}<c:dLblPos val="outEnd"/>${shows(0)}</c:dLbls>`

const categoryAxis = (crosses: string, hex: string, titled = ''): string =>
  `<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${titled}<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>` +
  `<c:spPr><a:ln w="9525">${fill('000000')}</a:ln></c:spPr>${defaults(hex)}<c:crossAx val="2"/><c:crosses val="${crosses}"/><c:auto val="0"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:tickLblSkip val="1"/><c:noMultiLvlLbl val="1"/></c:catAx>`
const valueAxis = (min: string, max: string, step: string, format: string, hex: string, titled = ''): string =>
  `<c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:max val="${max}"/><c:min val="${min}"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>` +
  `<c:majorGridlines><c:spPr><a:ln w="6350">${fill('D9D9D9')}</a:ln></c:spPr></c:majorGridlines>${titled}<c:numFmt formatCode="${format}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
  `<c:spPr>${NO_LINE}</c:spPr>${defaults(hex)}<c:crossAx val="1"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="${step}"/></c:valAx>`

/** A chart's part: its title or none, its plot, its legend or none, and what paints nothing and sets its words. */
const space = (titled: string, plot: string, legend: boolean, hex: string): string =>
  `${DECLARATION}<c:chartSpace ${C} ${A}><c:roundedCorners val="0"/><c:chart>${titled}<c:autoTitleDeleted val="${titled === '' ? 1 : 0}"/><c:plotArea>${plot}<c:spPr><a:noFill/></c:spPr></c:plotArea>` +
  `${legend ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${defaults(hex)}</c:legend>` : ''}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
  `<c:spPr><a:noFill/>${NO_LINE}</c:spPr>${defaults(hex)}</c:chartSpace>`

const GREY = '333333'
const REGIONS = ['North', 'South', 'East', 'West']
const bars = (index: number, name: string, hex: string, values: readonly (string | null)[], said: readonly (string | null)[]): string =>
  `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${name}</c:v></c:tx><c:spPr>${fill(hex)}${NO_LINE}</c:spPr><c:invertIfNegative val="0"/>${labels(said, GREY)}${cat(REGIONS)}${val(values)}</c:ser>`

/** The bar chart: two bars to a category a quarter of a bar apart, and 56 hundredths of a bar between two categories. */
const BAR_PART = space(
  title('Sales by region', GREY, true),
  '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>' +
    bars(0, 'Plan', '1F77B4', ['10.25', '-5', null, '7.5'], ['10.25', '-5.00', null, '7.50']) +
    bars(1, 'Actual', 'D95F02', ['15', '2.5', '-2.5', '0'], ['15.00', '2.50', '-2.50', '0.00']) +
    '<c:gapWidth val="56"/><c:overlap val="-25"/><c:axId val="1"/><c:axId val="2"/></c:barChart>' +
    categoryAxis('autoZero', GREY, title('Region', GREY)) +
    valueAxis('-5', '15', '5', '0', GREY, title('CHF thousands', GREY)),
  true,
  GREY,
)

const LINE_PART = space(
  '',
  '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' +
    `<c:ser><c:idx val="0"/><c:order val="0"/><c:spPr><a:ln w="19050">${fill('1B9E77')}</a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="4"/><c:spPr>${fill('1B9E77')}${NO_LINE}</c:spPr></c:marker>` +
    `${cat(['Jan', 'Feb', 'Mar'])}${val(['0.5', null, '1.25'])}<c:smooth val="0"/></c:ser>` +
    '<c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:lineChart>' +
    categoryAxis('min', '000000') +
    valueAxis('0', '1.5', '0.5', '0.0', '000000'),
  false,
  '000000',
)

const PIE_PART = space(
  title('Shares', '000000', true),
  '<c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>' +
    ['1F77B4', 'D95F02', '1B9E77'].map((hex, index) => `<c:dPt><c:idx val="${index}"/><c:spPr>${fill(hex)}${NO_LINE}</c:spPr></c:dPt>`).join('') +
    `${cat(['North: 45 (45.0 %)', 'South: 0 (0.0 %)', 'East: 55 (55.0 %)'])}${val(['45', '0', '55'])}</c:ser><c:firstSliceAng val="0"/></c:pieChart>`,
  true,
  '000000',
)

/** An inline chart of `width` by `height` points, 12,700 English Metric Units to the point. */
const inline = (id: number, relationship: string, width: number, height: number): string =>
  `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width * 12700}" cy="${height * 12700}"/><wp:docPr id="${id}" name="Chart ${id}"/>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart ${C} r:id="${relationship}"/></a:graphicData></a:graphic></wp:inline></w:drawing>`
const drawn = (id: number, relationship: string, width: number, height: number): string =>
  `<w:p><w:pPr>${TINY}</w:pPr><w:r>${TINY}${inline(id, relationship, width, height)}</w:r></w:p>`

const ROBOTO = '<w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/>'
const EIGHT = '<w:sz w:val="16"/><w:szCs w:val="16"/>'
/** A centred line of the box of a chart with nothing to draw, at 8 points. */
const centred = (words: string, bold: boolean): string =>
  `<w:p><w:pPr><w:jc w:val="center"/><w:rPr>${ROBOTO}${EIGHT}</w:rPr></w:pPr><w:r><w:rPr>${ROBOTO}${bold ? '<w:b/>' : ''}<w:color w:val="000000"/>${EIGHT}</w:rPr>${text(words)}</w:r></w:p>`
/** The box of the chart with nothing to draw: 300 points wide and at least 120 tall, its title and its empty text in its middle. */
const EMPTY =
  `<w:tbl><w:tblPr><w:tblW w:w="6000" w:type="dxa"/><w:tblLayout w:type="fixed"/>${margins(0, 0)}</w:tblPr><w:tblGrid><w:gridCol w:w="6000"/></w:tblGrid>` +
  '<w:tr><w:trPr><w:trHeight w:val="2400" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="6000" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
  `${centred('Balance', true)}${centred('No rows to chart', false)}</w:tc></w:tr></w:tbl>`

const BODY = [
  plain('Charts by hand', '<w:keepNext/>'),
  drawn(1, 'rId6', 360, 240),
  drawn(2, 'rId7', 300, 200),
  drawn(3, 'rId8', 200, 200),
  EMPTY,
  plain('After the charts'),
].join('')

export const [BAR_CHART, LINE_CHART, PIE_CHART] = ['word/charts/chart1.xml', 'word/charts/chart2.xml', 'word/charts/chart3.xml'] as const

/** The file's parts by name: the hand-written file's, with this body, its three charts' parts in place of its picture. */
export function handChartParts(): Map<string, string | Uint8Array> {
  const parts = handParts()
  parts.delete('word/media/image1.png')
  parts.set(
    '[Content_Types].xml',
    (parts.get('[Content_Types].xml') as string).replace(
      '</Types>',
      `${[1, 2, 3].map((each) => `<Override PartName="/word/charts/chart${each}.xml" ContentType="${CHART_CONTENT_TYPE}"/>`).join('')}</Types>`,
    ),
  )
  parts.set('word/document.xml', `${DECLARATION}<w:document ${W} ${R} ${DRAWING}><w:body>${BODY}${SECTION}</w:body></w:document>`)
  parts.set(
    'word/_rels/document.xml.rels',
    relationships(
      [`${TYPE}/styles`, 'styles.xml'],
      [`${TYPE}/settings`, 'settings.xml'],
      [`${TYPE}/fontTable`, 'fontTable.xml'],
      [`${TYPE}/header`, 'header1.xml'],
      [`${TYPE}/footer`, 'footer1.xml'],
      [`${TYPE}/chart`, 'charts/chart1.xml'],
      [`${TYPE}/chart`, 'charts/chart2.xml'],
      [`${TYPE}/chart`, 'charts/chart3.xml'],
    ),
  )
  parts.set(BAR_CHART, BAR_PART)
  parts.set(LINE_CHART, LINE_PART)
  parts.set(PIE_CHART, PIE_PART)
  return parts
}
