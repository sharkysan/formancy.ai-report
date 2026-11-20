import { MAX_SCALE } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { valueAxisFormat } from './check-docx-charts.js'
import { verifyDocx } from './check-docx.js'
import type { Block, Chart } from './document.js'
import { docxCharts } from './docx-charts.js'
import { readDocx } from './docx/read.js'
import {
  BAR_CHART,
  CHART_CONTENT_TYPE,
  HAND_BARS,
  HAND_CHARTS,
  HAND_CHARTS_DOCUMENT,
  HAND_LINE,
  HAND_PIE,
  handChartParts,
  LINE_CHART,
  PIE_CHART,
} from './docx/testing/hand-charts.js'
import { handDocx, plain, relationships, rewritten, TINY, TYPE } from './docx/testing/hand.js'
import { expectation, type Fixture } from './fixture.js'

/**
 * What `readDocx` reads of a chart and `verifyDocx` holds one to (0076),
 * proved on the file written by hand (`docx/testing/hand-charts.ts`),
 * never on one the writer wrote: the file passes as it stands, and with
 * one thing of a chart taken out of it or written otherwise the reader
 * refuses it or the check says so. A check that never failed on a defect
 * has not been shown to see it.
 */

type Parts = Map<string, string | Uint8Array>
const DOCUMENT = 'word/document.xml'

const problems = async (parts: ReadonlyMap<string, string | Uint8Array>, fixture: Fixture = HAND_CHARTS): Promise<string> =>
  (await verifyDocx(fixture, readDocx(handDocx(parts)))).join('\n')

/** The hand-written file with `from` in the part `name` written as `to`. */
const written = (name: string, from: string, to: string): Parts => rewritten(name, from, to, handChartParts())

/** The fixture with the chart `id` of its body changed by `change`. */
const changed = (id: string, change: (chart: Chart) => Chart): Fixture => {
  const body = HAND_CHARTS_DOCUMENT.body.map((block): Block => (block.kind === 'chart' && block.id === id ? change(block) : block))
  const document = { ...HAND_CHARTS_DOCUMENT, body }
  return { ...HAND_CHARTS, document, expect: expectation(document, { maxPagesExpected: 2 }) }
}

/** The hand-written file with the first `from` in the part `name` written as `to`, where it stands there more than once. */
const first = (name: string, from: string, to: string): Parts => {
  const parts = handChartParts()
  const part = parts.get(name) as string
  if (!part.includes(from)) throw new Error(`'${from}' does not stand in ${name}`)
  return parts.set(
    name,
    part.replace(from, () => to),
  )
}

/** What `pattern` finds in the hand-written part `name`. */
const found = (name: string, pattern: RegExp): string => pattern.exec(handChartParts().get(name) as string)![0]

// The file as it was typed is its document, whole: without this, every case below could fail for a reason of its own.
test('the hand-written file of charts is its document, with nothing to say against it', async () => {
  expect(await problems(handChartParts())).toBe('')
})

describe('readDocx reads a chart’s part', () => {
  const [bars, line, pie, ...more] = docxCharts(readDocx(handDocx(handChartParts())))

  // A chart with nothing to draw is words in a box, and no part: a reader that listed it would have a check look for a chart that is none.
  test('for each chart that draws something, in the document’s order, and none for one that draws nothing', () => {
    expect([bars?.chart.kind, line?.chart.kind, pie?.chart.kind]).toEqual(['bar', 'line', 'pie'])
    expect(more).toEqual([])
    expect([bars?.width, bars?.height, bars?.name]).toEqual([360, 240, 'Chart 1'])
  })

  // The digits are what a check holds to the report's: read through a number, 10.25 and 10.250 would be one value, and a 40-digit total another.
  test('each value as the digits the part writes, and a point the part states none for as none', () => {
    expect(bars!.chart.series.map((series) => series.values)).toEqual([
      ['10.25', '-5', null, '7.5'],
      ['15', '2.5', '-2.5', '0'],
    ])
    expect(line!.chart.series[0]!.values).toEqual(['0.5', null, '1.25'])
  })

  // What a word is set in is what a check compares with the chart's style: a property read wrongly is a style never checked.
  test('every word the part states with what it is set in, and each series’ name, colour and labels', () => {
    expect(bars!.chart.title).toEqual({ text: 'Sales by region', face: { family: 'Roboto', size: 8, bold: true, italic: false, color: '#333333' } })
    expect(bars!.chart.series[0]).toMatchObject({ name: 'Plan', color: '#1f77b4', categories: ['North', 'South', 'East', 'West'], labelPosition: 'outEnd' })
    expect(bars!.chart.series[0]!.labels.map((label) => label?.text ?? null)).toEqual(['10.25', '-5.00', null, '7.50'])
    expect(line!.chart.series[0]).toMatchObject({ color: '#1b9e77', line: 1.5, marker: 4, labels: [null, null, null] })
    expect(line!.chart.title).toBeUndefined()
  })

  // The axis is what keeps Word from scaling the chart itself: its ends, its step and its labels' format as the part writes them.
  test('the value axis from its lowest value to its highest, its step and its format, and where the category axis stands', () => {
    expect(bars!.chart.valueAxis).toMatchObject({ min: '-5', max: '15', step: '5', format: '0', grid: { weight: 0.5, color: '#d9d9d9' } })
    expect(bars!.chart.categoryAxis).toMatchObject({ crosses: 'autoZero', every: 1, line: { weight: 0.75, color: '#000000' } })
    expect(line!.chart.valueAxis).toMatchObject({ min: '0', max: '1.5', step: '0.5', format: '0.0' })
    expect(line!.chart.categoryAxis!.crosses).toBe('min')
    expect(bars!.chart.bars).toEqual({ gapWidth: 56, overlap: -25 })
  })

  // A pie's slices are points of one series, each its own colour, and its legend's entries its categories.
  test('a pie’s slices, their colours and their names, and its legend at the foot', () => {
    expect(pie!.chart.series).toHaveLength(1)
    expect(pie!.chart.series[0]).toMatchObject({
      values: ['45', '0', '55'],
      points: ['#1f77b4', '#d95f02', '#1b9e77'],
      categories: ['North: 45 (45.0 %)', 'South: 0 (0.0 %)', 'East: 55 (55.0 %)'],
    })
    expect(pie!.chart.legend).toMatchObject({ position: 'b' })
    expect(line!.chart.legend).toBeUndefined()
  })
})

const CHART_RELS = 'word/charts/_rels/chart1.xml.rels'

describe('readDocx refuses a chart', () => {
  // Each a file that leads somewhere or leaves something to Word that a report's chart states: a reader that took it would let a writer's mistake pass every check built on it.
  test.each<[string, () => Parts, RegExp]>([
    [
      'that takes its data from an address',
      () => {
        const rels = `${relationships([`${TYPE}/oleObject`, 'https://example.invalid/book.xlsx']).replace('/>', ' TargetMode="External"/>')}`
        return handChartParts().set(CHART_RELS, rels)
      },
      /the relationship rId1 leads outside the package/,
    ],
    [
      'that holds a workbook of its own',
      () => {
        const parts = handChartParts()
        parts.set(
          '[Content_Types].xml',
          (parts.get('[Content_Types].xml') as string).replace(
            '<Default Extension="png"',
            '<Default Extension="xlsx" ContentType="application/vnd.ms-excel"/><Default Extension="png"',
          ),
        )
        parts.set(CHART_RELS, relationships([`${TYPE}/package`, '../embeddings/book.xlsx']))
        return parts.set('word/embeddings/book.xlsx', new Uint8Array([80, 75]))
      },
      /chart1\.xml: the chart leads to another part, where a chart holds its data itself/,
    ],
    [
      'that names where its data comes from',
      () => written(BAR_CHART, '</c:chartSpace>', '<c:externalData r:id="rId1" xmlns:r="x"/></c:chartSpace>'),
      /externalData in .*chartSpace, which the vocabulary does not hold there/,
    ],
    [
      'whose values are a formula’s cache',
      () => written(LINE_CHART, '<c:val><c:numLit>', '<c:val><c:numRef><c:f>Sheet1!$B$2:$B$4</c:f></c:numRef><c:numLit>'),
      /numRef in .*val, which the vocabulary does not hold there/,
    ],
    [
      'of another content type',
      () => written('[Content_Types].xml', `<Override PartName="/word/charts/chart2.xml" ContentType="${CHART_CONTENT_TYPE}"/>`, ''),
      /chart2\.xml: the part is drawn as a chart and is of another content type/,
    ],
    [
      'in a page header',
      () => handChartParts().set('word/_rels/header1.xml.rels', relationships([`${TYPE}/chart`, 'charts/chart3.xml'])),
      /header1\.xml: the relationship rId1 is of a type a file does not hold/,
    ],
    [
      'that a drawing says is a picture',
      () =>
        written(
          DOCUMENT,
          'uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId8"/>',
          'uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId8"/>',
        ),
      /a drawing that is neither a picture nor a chart, or says it is one and holds the other/,
    ],
    ['with rounded corners', () => written(PIE_CHART, '<c:roundedCorners val="0"/>', '<c:roundedCorners val="1"/>'), /chartSpace states roundedCorners as '1'/],
    [
      'whose lines Word smooths',
      () => written(LINE_CHART, '<c:smooth val="0"/>', '<c:smooth val="1"/>'),
      /ser states smooth as '1', where a report's chart states '0'/,
    ],
    [
      'whose bars below zero Word paints otherwise',
      () =>
        written(
          BAR_CHART,
          '<c:invertIfNegative val="0"/><c:dLbls><c:dLbl><c:idx val="0"/><c:tx><c:rich><a:bodyPr rot="0" vert="horz"/><a:p><a:r><a:rPr sz="800" b="0" i="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Roboto"/><a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:rPr><a:t>10.25<',
          '<c:invertIfNegative val="1"/><c:dLbls><c:dLbl><c:idx val="0"/><c:tx><c:rich><a:bodyPr rot="0" vert="horz"/><a:p><a:r><a:rPr sz="800" b="0" i="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Roboto"/><a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:rPr><a:t>10.25<',
        ),
      /ser states invertIfNegative as '1'/,
    ],
    [
      'that Word titles itself',
      () => written(LINE_CHART, '<c:autoTitleDeleted val="1"/>', '<c:autoTitleDeleted val="0"/>'),
      /chart states autoTitleDeleted as '0', where a report's chart states '1'/,
    ],
    [
      'whose missing values Word draws as zero',
      () => written(LINE_CHART, '<c:dispBlanksAs val="gap"/>', '<c:dispBlanksAs val="zero"/>'),
      /chart states dispBlanksAs as 'zero'/,
    ],
    ['whose slices Word paints alike', () => written(PIE_CHART, '<c:varyColors val="1"/>', '<c:varyColors val="0"/>'), /pieChart states varyColors as '0'/],
    [
      'whose first slice starts elsewhere than at the top',
      () => written(PIE_CHART, '<c:firstSliceAng val="0"/>', '<c:firstSliceAng val="90"/>'),
      /pieChart states firstSliceAng as '90'/,
    ],
    ['whose bars lie', () => written(BAR_CHART, '<c:barDir val="col"/>', '<c:barDir val="bar"/>'), /barChart states barDir as 'bar'/],
    [
      'whose bars are stacked',
      () => written(BAR_CHART, '<c:grouping val="clustered"/>', '<c:grouping val="stacked"/>'),
      /barChart states grouping as 'stacked'/,
    ],
    ['whose line has no markers', () => written(LINE_CHART, '<c:marker val="1"/>', '<c:marker val="0"/>'), /lineChart states marker as '0'/],
    [
      'whose markers are another colour than their line',
      () =>
        written(
          LINE_CHART,
          '<c:size val="4"/><c:spPr><a:solidFill><a:srgbClr val="1B9E77"/>',
          '<c:size val="4"/><c:spPr><a:solidFill><a:srgbClr val="000000"/>',
        ),
      /series 0 has markers of another colour than its line/,
    ],
    ['whose title lies over its plot', () => written(PIE_CHART, '</c:tx><c:overlay val="0"/>', '</c:tx><c:overlay val="1"/>'), /title states overlay as '1'/],
    [
      'a word of which is turned',
      () => written(PIE_CHART, '<c:title><c:tx><c:rich><a:bodyPr rot="0" vert="horz"/>', '<c:title><c:tx><c:rich><a:bodyPr rot="-5400000" vert="horz"/>'),
      /the title is not held across: Word may turn it/,
    ],
    [
      'whose background is left to Word',
      () => written(PIE_CHART, '</c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>', '</c:chart><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>'),
      /the chart is filled, or left for Word to fill/,
    ],
    [
      'with a line around it',
      () =>
        written(
          PIE_CHART,
          '</c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>',
          '</c:chart><c:spPr><a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></c:spPr>',
        ),
      /the chart has a line around it/,
    ],
    [
      'with a value that is no decimal',
      () => written(LINE_CHART, '<c:v>1.25</c:v>', '<c:v>1.25E0</c:v>'),
      /a value of series 0 is '1\.25E0', which is no decimal/,
    ],
    [
      'with a point past its count',
      () => written(LINE_CHART, '<c:pt idx="2"><c:v>1.25</c:v>', '<c:pt idx="3"><c:v>1.25</c:v>'),
      /series 0 has a point out of its order, or past its count/,
    ],
    [
      'whose values state a format',
      () => written(LINE_CHART, '<c:formatCode>General</c:formatCode>', '<c:formatCode>0.00</c:formatCode>'),
      /series 0 states a format for its values/,
    ],
    [
      'whose axis takes its format from a workbook',
      () => written(LINE_CHART, 'sourceLinked="0"', 'sourceLinked="1"'),
      /the value axis takes its labels' format from a workbook/,
    ],
    [
      'with an axis taken away',
      () => written(LINE_CHART, '<c:delete val="0"/><c:axPos val="l"/>', '<c:delete val="1"/><c:axPos val="l"/>'),
      /valAx states delete as '1'/,
    ],
    [
      'with tick marks',
      () =>
        written(
          LINE_CHART,
          '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>',
          '<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>',
        ),
      /catAx states majorTickMark as 'out'/,
    ],
    [
      'whose category labels stand beside the axis',
      () => written(LINE_CHART, '<c:tickLblPos val="low"/>', '<c:tickLblPos val="nextTo"/>'),
      /catAx states tickLblPos as 'nextTo'/,
    ],
    [
      'whose points stand on the gridlines',
      () => written(LINE_CHART, '<c:crossBetween val="between"/>', '<c:crossBetween val="midCat"/>'),
      /valAx states crossBetween as 'midCat'/,
    ],
    [
      'whose value axis has a line',
      () =>
        written(
          LINE_CHART,
          '<c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>',
          '<c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></c:spPr>',
        ),
      /the value axis has a line, or a fill/,
    ],
    [
      'whose series labels every value itself',
      () =>
        written(
          BAR_CHART,
          '<c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:cat><c:strLit><c:ptCount val="4"/><c:pt idx="0"><c:v>North</c:v></c:pt><c:pt idx="1"><c:v>South</c:v></c:pt><c:pt idx="2"><c:v>East</c:v></c:pt><c:pt idx="3"><c:v>West</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="4"/><c:pt idx="0"><c:v>10.25<',
          '<c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:cat><c:strLit><c:ptCount val="4"/><c:pt idx="0"><c:v>North</c:v></c:pt><c:pt idx="1"><c:v>South</c:v></c:pt><c:pt idx="2"><c:v>East</c:v></c:pt><c:pt idx="3"><c:v>West</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="4"/><c:pt idx="0"><c:v>10.25<',
        ),
      /dLbls states showVal as '1', where a report's chart states '0'/,
    ],
    [
      'with a label that is a share Word works out',
      () =>
        written(
          BAR_CHART,
          '<a:t>7.50</a:t></a:r></a:p></c:rich></c:tx><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/>',
          '<a:t>7.50</a:t></a:r></a:p></c:rich></c:tx><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/>',
        ),
      /dLbl states showPercent as '1'/,
    ],
    [
      'whose words name three families',
      () =>
        written(
          PIE_CHART,
          '<a:rPr sz="800" b="1" i="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Roboto"/><a:ea typeface="Roboto"/>',
          '<a:rPr sz="800" b="1" i="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Roboto"/><a:ea typeface="Arial"/>',
        ),
      /the title names its three typeface slots otherwise than alike/,
    ],
    [
      'on other axes than its own',
      () => written(LINE_CHART, '<c:axId val="1"/><c:axId val="2"/></c:lineChart>', '<c:axId val="1"/><c:axId val="3"/></c:lineChart>'),
      /the chart is drawn on other axes than its two/,
    ],
    [
      'whose bars have a line around them',
      () =>
        written(
          BAR_CHART,
          '<c:tx><c:v>Plan</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="1F77B4"/></a:solidFill><a:ln><a:noFill/></a:ln>',
          '<c:tx><c:v>Plan</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="1F77B4"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>',
        ),
      /series 0 is not filled in one colour with no line around it/,
    ],
    [
      'painted in a colour that is no six hex digits',
      () =>
        written(PIE_CHART, '<c:idx val="1"/><c:spPr><a:solidFill><a:srgbClr val="D95F02"/>', '<c:idx val="1"/><c:spPr><a:solidFill><a:srgbClr val="orange"/>'),
      /point 1 of series 0 names the colour 'orange', which is not six hex digits/,
    ],
    [
      'with more categories than values',
      () =>
        rewritten(
          LINE_CHART,
          '<c:v>Mar</c:v></c:pt>',
          '<c:v>Mar</c:v></c:pt><c:pt idx="3"><c:v>Apr</c:v></c:pt>',
          written(LINE_CHART, '<c:cat><c:strLit><c:ptCount val="3"/>', '<c:cat><c:strLit><c:ptCount val="4"/>'),
        ),
      /series 0 has 4 categories for 3 values/,
    ],
    [
      'whose count of points is no number',
      () => written(LINE_CHART, '<c:cat><c:strLit><c:ptCount val="3"/>', '<c:cat><c:strLit><c:ptCount val="three"/>'),
      /strLit states ptCount as 'three', which is no whole number/,
    ],
    [
      'a slice of which is painted twice',
      () => written(PIE_CHART, '<c:dPt><c:idx val="2"/>', '<c:dPt><c:idx val="1"/>'),
      /series 0 paints a point twice, or one past its count/,
    ],
    [
      'a slice of which is left for Word to paint',
      () =>
        written(PIE_CHART, '<c:dPt><c:idx val="2"/><c:spPr><a:solidFill><a:srgbClr val="1B9E77"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:dPt>', ''),
      /series 0 is a pie's and does not paint each of its points, and only them/,
    ],
    [
      'without its value axis',
      () => written(LINE_CHART, /<c:valAx>.*<\/c:valAx>/.exec(handChartParts().get(LINE_CHART) as string)![0], ''),
      /a bar or a line chart without its two axes/,
    ],
    ['whose title holds no text', () => written(PIE_CHART, '<a:t>Shares</a:t>', ''), /the title holds no text/],
    ['a word of which states no size', () => written(PIE_CHART, '<a:rPr sz="800" b="1" i="0">', '<a:rPr b="1" i="0">'), /the title states no sz/],
    [
      'a word of which states its weight in a word',
      () => written(PIE_CHART, '<a:rPr sz="800" b="1" i="0">', '<a:rPr sz="800" b="true" i="0">'),
      /the title states its weight or its slant as neither 0 nor 1/,
    ],
    ['whose line is filled', () => written(LINE_CHART, '<c:spPr><a:ln w="19050">', '<c:spPr><a:noFill/><a:ln w="19050">'), /series 0 is a line with a fill/],
    [
      'whose line is not drawn',
      () =>
        written(
          LINE_CHART,
          '<c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="1B9E77"/></a:solidFill></a:ln></c:spPr><c:marker>',
          '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:marker>',
        ),
      /series 0 is a line that is not drawn/,
    ],
    [
      'whose one series is numbered otherwise than by its place',
      () => written(LINE_CHART, '<c:ser><c:idx val="0"/>', '<c:ser><c:idx val="1"/>'),
      /ser states idx as '1', where a report's chart states '0'/,
    ],
    [
      'a series of which holds no values',
      () => written(LINE_CHART, /<c:val>.*<\/c:val>/.exec(handChartParts().get(LINE_CHART) as string)![0], ''),
      /series 0 holds no literal data/,
    ],
    [
      'whose category axis states a range',
      () =>
        written(
          LINE_CHART,
          '<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/>',
          '<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/><c:max val="2"/>',
        ),
      /the category axis states a range/,
    ],
    [
      'whose category axis stands at the top',
      () => written(LINE_CHART, '<c:crosses val="min"/>', '<c:crosses val="max"/>'),
      /the category axis crosses the value axis at 'max'/,
    ],
    [
      'whose outline is both drawn and not',
      () =>
        written(
          PIE_CHART,
          '</c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>',
          '</c:chart><c:spPr><a:noFill/><a:ln w="9525"><a:noFill/></a:ln></c:spPr>',
        ),
      /the chart has a line both drawn and not/,
    ],
    ['that states a choice and no value for it', () => written(PIE_CHART, '<c:firstSliceAng val="0"/>', '<c:firstSliceAng/>'), /firstSliceAng states no value/],
    // A plot that held a second kind would pass with the first read and the rest ignored: one chart of one kind is all a report's chart is.
    [
      'whose plot holds a line chart beside its bars',
      () =>
        written(
          BAR_CHART,
          '</c:barChart>',
          '</c:barChart><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/><c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:lineChart>',
        ),
      /the plot holds not one bar, line or pie chart/,
    ],
    [
      'that is a pie of two series',
      () => {
        const series = found(PIE_CHART, /<c:ser>.*<\/c:ser>/)
        return written(
          PIE_CHART,
          series,
          `${series}${series.replace('<c:ser><c:idx val="0"/><c:order val="0"/>', '<c:ser><c:idx val="1"/><c:order val="1"/>')}`,
        )
      },
      /a pie of not one series, or with an axis/,
    ],
    [
      'that is a pie with an axis',
      () => written(PIE_CHART, '</c:pieChart>', `</c:pieChart>${found(LINE_CHART, /<c:catAx>.*<\/c:catAx>/)}`),
      /a pie of not one series, or with an axis/,
    ],
    [
      'a label of which stands out of its order',
      () => first(BAR_CHART, '<c:dLbl><c:idx val="1"/>', '<c:dLbl><c:idx val="0"/>'),
      /series 0 labels a point out of its order, or past its count/,
    ],
    [
      'whose category axis is filled',
      () => written(LINE_CHART, '<c:spPr><a:ln w="9525">', '<c:spPr><a:noFill/><a:ln w="9525">'),
      /the category axis is filled/,
    ],
    [
      'whose bars leave their outline to Word',
      () => first(BAR_CHART, '<a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative', '</c:spPr><c:invertIfNegative'),
      /series 0 states no line, which Word then draws as it likes/,
    ],
    [
      'whose legend states nothing of what it is set in',
      () => {
        const legend = found(PIE_CHART, /<c:legend>.*<\/c:legend>/)
        return written(PIE_CHART, legend, legend.replace(/<a:pPr>.*<\/a:pPr>/, ''))
      },
      /the legend states nothing of what it is set in/,
    ],
    // The plot's outline is pinned as the chart's is: left unsaid, Word draws one in its own colour.
    [
      'whose plot leaves its outline to Word',
      () => written(BAR_CHART, '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>', '<c:spPr><a:noFill/></c:spPr></c:plotArea>'),
      /the plot states no line, which Word then draws as it likes/,
    ],
    // A category the part does not state is one Word numbers itself: a label that prints nothing is stated, as nothing.
    [
      'that leaves a category for Word to name',
      () => written(LINE_CHART, '<c:pt idx="1"><c:v>Feb</c:v></c:pt>', ''),
      /the categories of series 0 leave a point for Word to name/,
    ],
    // Two drawings of one part is a form the writer never writes, and nobody has seen Word open.
    [
      'that two drawings draw',
      () => written(DOCUMENT, 'r:id="rId7"', 'r:id="rId6"'),
      /word\/charts\/chart1\.xml is drawn twice, where each drawing has a part of its own/,
    ],
    // What the vocabulary lets stand empty or unsaid, each a thing Word would then decide: refused, never read as its default.
    [
      'whose category axis has no line',
      () =>
        written(
          LINE_CHART,
          /<c:spPr><a:ln w="9525">.*?<\/a:ln><\/c:spPr>/.exec(handChartParts().get(LINE_CHART) as string)![0],
          '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>',
        ),
      /the category axis has no line/,
    ],
    [
      'whose gridlines are not drawn',
      () =>
        written(
          LINE_CHART,
          /<c:majorGridlines>.*<\/c:majorGridlines>/.exec(handChartParts().get(LINE_CHART) as string)![0],
          '<c:majorGridlines><c:spPr><a:ln><a:noFill/></a:ln></c:spPr></c:majorGridlines>',
        ),
      /the value axis has no gridlines/,
    ],
    [
      'whose value axis states no format',
      () => written(LINE_CHART, '<c:numFmt formatCode="0.0" sourceLinked="0"/>', '<c:numFmt sourceLinked="0"/>'),
      /the value axis states no format/,
    ],
    ['whose line has no weight', () => written(LINE_CHART, '<c:spPr><a:ln w="19050">', '<c:spPr><a:ln>'), /series 0 has a line of no weight/],
    [
      'a point of which has no index',
      () => written(LINE_CHART, '<c:pt idx="2"><c:v>1.25</c:v>', '<c:pt><c:v>1.25</c:v>'),
      /series 0 has a point with no index/,
    ],
    [
      'a point of which has no value',
      () => written(LINE_CHART, '<c:pt idx="2"><c:v>1.25</c:v></c:pt>', '<c:pt idx="2"/>'),
      /series 0 has a point with no value/,
    ],
    [
      'a series of which has a name that is no text',
      () => written(BAR_CHART, '<c:tx><c:v>Plan</c:v></c:tx>', '<c:tx/>'),
      /series 0 has a name that is no text/,
    ],
    [
      'whose title is no word of the file’s own',
      () => written(PIE_CHART, /<c:title><c:tx>.*?<\/c:tx>/.exec(handChartParts().get(PIE_CHART) as string)![0], '<c:title><c:tx/>'),
      /the title is no word of the file's own/,
    ],
    [
      'whose title holds no paragraph',
      () =>
        written(
          PIE_CHART,
          /<c:title><c:tx><c:rich><a:bodyPr rot="0" vert="horz"\/><a:p>.*?<\/a:p>/.exec(handChartParts().get(PIE_CHART) as string)![0],
          '<c:title><c:tx><c:rich><a:bodyPr rot="0" vert="horz"/>',
        ),
      /the title holds no text/,
    ],
    [
      'whose title holds no run',
      () =>
        written(
          PIE_CHART,
          /<c:title><c:tx><c:rich><a:bodyPr rot="0" vert="horz"\/><a:p>.*?<\/a:p>/.exec(handChartParts().get(PIE_CHART) as string)![0],
          '<c:title><c:tx><c:rich><a:bodyPr rot="0" vert="horz"/><a:p/>',
        ),
      /the title holds no text/,
    ],
    [
      'a slice past its count of which is painted',
      () => written(PIE_CHART, '<c:dPt><c:idx val="2"/>', '<c:dPt><c:idx val="5"/>'),
      /series 0 paints a point twice, or one past its count/,
    ],
    [
      'a label of which stands past its count',
      () => first(BAR_CHART, '<c:dLbl><c:idx val="3"/>', '<c:dLbl><c:idx val="9"/>'),
      /series 0 labels a point out of its order, or past its count/,
    ],
    ['whose legend says not where it stands', () => written(PIE_CHART, '<c:legendPos val="b"/>', ''), /legend holds no legendPos/],
    [
      'whose defaults state no paragraph',
      () =>
        written(
          PIE_CHART,
          /<\/c:chart><c:spPr>.*?<\/c:spPr><c:txPr><a:bodyPr rot="0" vert="horz"\/><a:p>.*?<\/a:p>/.exec(handChartParts().get(PIE_CHART) as string)![0],
          '</c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr rot="0" vert="horz"/>',
        ),
      /the chart states nothing of what it is set in/,
    ],
    [
      'a word of which names no colour',
      () => written(PIE_CHART, '<a:rPr sz="800" b="1" i="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill>', '<a:rPr sz="800" b="1" i="0">'),
      /the title names the colour 'undefined'/,
    ],
    [
      'without its gridlines',
      () => written(LINE_CHART, found(LINE_CHART, /<c:majorGridlines>.*<\/c:majorGridlines>/), ''),
      /the gridlines states no line, which Word then draws as it likes/,
    ],
    [
      'whose markers state no paint',
      () => written(LINE_CHART, found(LINE_CHART, /<c:size val="4"\/><c:spPr>.*?<\/c:spPr>/), '<c:size val="4"/>'),
      /the markers of series 0 is not filled in one colour with no line around it/,
    ],
  ])('%s', (_name, parts, message) => {
    expect(() => readDocx(handDocx(parts()))).toThrow(message)
  })

  // A cell's words at its foot are no words in the middle of a box: the reader knows the middle alone.
  test('whose box of nothing to draw holds its words at its foot', () => {
    expect(() => readDocx(handDocx(written(DOCUMENT, '<w:vAlign w:val="center"/>', '<w:vAlign w:val="bottom"/>')))).toThrow(
      /a cell whose blocks stand 'bottom'/,
    )
  })
})

const NORTH_LABEL = '<a:t>10.25</a:t>'

// Word writes the value axis's labels from a format the file states, in the reader's own separators. It is held to the places the ticks'
// text prints and to grouped thousands where the runtime printed them grouped: the values' own places would print 20000 under the
// PDF's 20'000.00, and grouping the runtime did not do would print a separator the report never prints.
test('a value axis is held to the places its ticks print, its thousands grouped where they print grouped', () => {
  const axis = (...ticks: (readonly [string, string])[]): string | undefined =>
    valueAxisFormat({ ...HAND_BARS, ticks: ticks.map(([exact, text]) => ({ exact, text })) })
  expect(axis(['0', '0.00'], ['10000', '10\u2019000.00'], ['20000', '20\u2019000.00'])).toBe('#,##0.00')
  expect(axis(['0', 'EUR 0'], ['5000', 'EUR 5.000'], ['10000', 'EUR 10.000'])).toBe('#,##0')
  expect(axis(['0', '0.00'], ['10000', '10000.00'], ['20000', '20000.00'])).toBe('0.00')
  expect(axis(['-5', '-5'], ['0', '0'], ['5', '5'])).toBe('0')
  expect(axis(['0', '0,000'], ['0.5', '0,500'], ['1', '1,000'])).toBe('0.000')
  expect(axis(['0', '0.0'], ['0.50', '0.5'], ['1.00', '1.0'])).toBe('0.0')
  // A tick's text written longer than any number the runtime resolves, by hand, asks no more places of the format than MAX_SCALE.
  expect(axis(['0', `0.${'1'.repeat(10_000)}`], ['5', '5'], ['10', '10'])).toBe(`0.${'0'.repeat(MAX_SCALE)}`)
})

describe('verifyDocx fails on a chart', () => {
  // Each a way a writer states a chart that Word then draws as another chart than the report's, with nothing in the file saying so.
  test.each<[string, () => Parts, RegExp, Fixture?]>([
    [
      'of another size than its box',
      () => written(DOCUMENT, '<wp:extent cx="4572000" cy="3048000"/>', '<wp:extent cx="4572000" cy="3000000"/>'),
      /the chart sales is drawn 360 × 236\.2\d+ pt where its box is 360 × 240/,
    ],
    [
      'with room around it',
      () =>
        written(
          DOCUMENT,
          '<w:p><w:pPr><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="4572000"',
          '<w:p><w:pPr><w:ind w:left="200"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="4572000"',
        ),
      /the chart sales stands with room around it/,
    ],
    [
      'of another kind',
      handChartParts,
      /the chart balance is a line chart where the document's is a bar chart/,
      changed('balance', (chart) => ({ ...(chart as typeof HAND_LINE), chart: 'bar' })),
    ],
    [
      'with another title',
      () => written(BAR_CHART, '<a:t>Sales by region</a:t>', '<a:t>Sales by area</a:t>'),
      /the chart sales the title is 'Sales by area' where the chart prints 'Sales by region'/,
    ],
    [
      'with a title it does not have',
      handChartParts,
      /the chart shares the title is 'Shares' where the chart prints none/,
      changed('shares', ({ title: _title, ...chart }) => chart),
    ],
    [
      'without its title',
      handChartParts,
      /the chart balance the title is missing where the chart prints 'Balance'/,
      changed('balance', (chart) => ({ ...chart, title: 'Balance' })),
    ],
    [
      'whose title is not bold',
      () => written(BAR_CHART, '<a:rPr sz="800" b="1" i="0">', '<a:rPr sz="800" b="0" i="0">'),
      /the chart sales the title is not bold/,
    ],
    [
      'a value of which is written with other digits',
      () => written(BAR_CHART, '<c:v>10.25</c:v>', '<c:v>10.250</c:v>'),
      /series 0 holds the values 10\.250, -5, –, 7\.5 where the chart's are 10\.25, -5, –, 7\.5/,
    ],
    [
      'with a value where it has none',
      () => written(BAR_CHART, '<c:pt idx="1"><c:v>-5</c:v></c:pt>', '<c:pt idx="1"><c:v>-5</c:v></c:pt><c:pt idx="2"><c:v>0</c:v></c:pt>'),
      /series 0 holds the values 10\.25, -5, 0, 7\.5/,
    ],
    [
      'a category of which says something else',
      () => written(LINE_CHART, '<c:v>Feb</c:v>', '<c:v>February</c:v>'),
      /the chart balance series 0 names the categories Jan, February, Mar/,
    ],
    [
      'a series of which is named otherwise',
      () => written(BAR_CHART, '<c:tx><c:v>Plan</c:v></c:tx>', '<c:tx><c:v>Budget</c:v></c:tx>'),
      /series 0 is named 'Budget' where the chart's legend says 'Plan'/,
    ],
    [
      'a series of which is another colour',
      () =>
        written(
          BAR_CHART,
          '<c:tx><c:v>Actual</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="D95F02"/>',
          '<c:tx><c:v>Actual</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="D95F03"/>',
        ),
      /series 1 is painted #d95f03 where the chart's is #d95f02/,
    ],
    [
      'a label of which says another value',
      () => written(BAR_CHART, NORTH_LABEL, '<a:t>10.3</a:t>'),
      /series 0's label at category 0 is '10\.3' where the chart prints '10\.25'/,
    ],
    [
      'that labels values the chart does not',
      handChartParts,
      /series 0's label at category 0 is '10\.25' where the chart prints none/,
      changed('sales', (chart) => ({ ...(chart as typeof HAND_BARS), valueLabels: false })),
    ],
    [
      'that leaves a value unlabelled',
      handChartParts,
      /the chart balance series 0's label at category 0 is missing where the chart prints '0\.5'/,
      changed('balance', (chart) => ({ ...(chart as typeof HAND_LINE), valueLabels: true })),
    ],
    [
      'whose axis starts elsewhere than at its lowest tick',
      () => written(BAR_CHART, '<c:min val="-5"/>', '<c:min val="-10"/>'),
      /has a value axis from -10 to 15 where its ticks run from -5 to 15/,
    ],
    [
      'whose axis ends at a number written otherwise',
      () => written(LINE_CHART, '<c:max val="1.5"/>', '<c:max val="1.50"/>'),
      /has a value axis from 0 to 1\.50 where its ticks run from 0 to 1\.5/,
    ],
    [
      'whose gridlines stand at another step',
      () => written(BAR_CHART, '<c:majorUnit val="5"/>', '<c:majorUnit val="2.5"/>'),
      /has gridlines every 2\.5, which is not the step between its ticks/,
    ],
    [
      'whose axis prints fewer places than its ticks need',
      () => written(LINE_CHART, 'formatCode="0.0"', 'formatCode="0"'),
      /prints its value axis as '0' where its ticks need '0\.0'/,
    ],
    [
      'that labels every other category',
      () => written(BAR_CHART, '<c:tickLblSkip val="1"/>', '<c:tickLblSkip val="2"/>'),
      /labels every 2th category, where a chart labels each/,
    ],
    [
      'whose bars stand on the axis’s foot',
      () => written(BAR_CHART, '<c:crosses val="autoZero"/><c:auto', '<c:crosses val="min"/><c:auto'),
      /the chart sales has its category axis at 'min' of its value axis/,
    ],
    [
      'whose category axis is titled otherwise',
      () => written(BAR_CHART, '<a:t>Region</a:t>', '<a:t>Area</a:t>'),
      /the category axis's title is 'Area' where the chart prints 'Region'/,
    ],
    [
      'whose value axis is titled otherwise',
      () => written(BAR_CHART, '<a:t>CHF thousands</a:t>', '<a:t>CHF</a:t>'),
      /the value axis's title is 'CHF' where the chart prints 'CHF thousands'/,
    ],
    [
      'without its legend',
      () => written(PIE_CHART, /<c:legend>.*<\/c:legend>/.exec(handChartParts().get(PIE_CHART) as string)![0], ''),
      /the chart shares has no legend where the chart has one/,
    ],
    [
      'with a legend it does not have',
      handChartParts,
      /the chart shares has a legend where the chart has none/,
      changed('shares', (chart) => ({ ...chart, legend: [] })),
    ],
    [
      'whose legend stands at its side',
      () => written(PIE_CHART, '<c:legendPos val="b"/>', '<c:legendPos val="r"/>'),
      /the chart shares has its legend at 'r', and not at its foot/,
    ],
    [
      'a slice of which is another value',
      () => written(PIE_CHART, '<c:v>55</c:v>', '<c:v>54</c:v>'),
      /the chart shares holds the slices 45, 0, 54 where the chart's are 45, 0, 55/,
    ],
    [
      'a slice of which is another colour',
      () =>
        written(PIE_CHART, '<c:idx val="1"/><c:spPr><a:solidFill><a:srgbClr val="D95F02"/>', '<c:idx val="1"/><c:spPr><a:solidFill><a:srgbClr val="1F77B4"/>'),
      /paints its slices #1f77b4, #1f77b4, #1b9e77/,
    ],
    [
      'a slice of which is named with another share',
      () => written(PIE_CHART, 'North: 45 (45.0 %)', 'North: 45 (45 %)'),
      /names its slices North: 45 \(45 %\), South: 0/,
    ],
    [
      'whose words are another size than its style says',
      () =>
        written(
          BAR_CHART,
          `${NORTH_LABEL.replace('<a:t>10.25</a:t>', '')}<a:rPr sz="800" b="0" i="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Roboto"/><a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:rPr><a:t>10.25</a:t>`,
          '<a:rPr sz="900" b="0" i="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Roboto"/><a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:rPr><a:t>10.25</a:t>',
        ),
      /series 0's label at category 0 is 9 pt where its style says 8/,
    ],
    [
      'whose words are another colour than its style says',
      handChartParts,
      /the chart sales the title is #333333 where its style says #000000/,
      changed('sales', (chart) => ({ ...chart, style: { ...chart.style, color: '#000000' } })),
    ],
    [
      'whose words are upright where its style slants them',
      handChartParts,
      /the chart sales its words' default is not italic/,
      changed('sales', (chart) => ({ ...chart, style: { ...chart.style, italic: true } })),
    ],
  ])('%s', async (_name, parts, message, fixture) => {
    expect(await problems(parts(), fixture)).toMatch(message)
  })
})

describe('a word of a chart that prints nothing', () => {
  const blankCategory = changed('balance', (chart) => ({ ...(chart as typeof HAND_LINE), categories: ['Jan', ' ', 'Mar'] }))
  const blankName = changed('sales', (chart) => ({ ...chart, legend: [chart.legend[0]!, { ...chart.legend[1]!, text: ' ' }] }))

  // Left unstated, Word fills the slot with a number of its own, or "Series2": the part states the word, as nothing.
  test('is stated as nothing, a category and a series’ name alike', async () => {
    expect(await problems(written(LINE_CHART, '<c:v>Feb</c:v>', '<c:v></c:v>'), blankCategory)).toBe('')
    expect(await problems(written(BAR_CHART, '<c:tx><c:v>Actual</c:v></c:tx>', '<c:tx><c:v></c:v></c:tx>'), blankName)).toBe('')
  })

  // A file that still says the word, or leaves the name out for Word to give, is another chart than the report's.
  test('fails where the file says a word in its place, or leaves the series unnamed', async () => {
    expect(await problems(handChartParts(), blankCategory)).toMatch(/series 0 names the categories Jan, Feb, Mar where the chart's are Jan, , Mar/)
    expect(await problems(written(BAR_CHART, '<c:tx><c:v>Actual</c:v></c:tx>', ''), blankName)).toMatch(
      /series 1 is named by Word where the chart's legend says ''/,
    )
  })
})

// A pie the document gives no legend states no categories at all, and its slices are read all the same, each unnamed.
test('a pie without a legend is read with its slices unnamed, and is its document', async () => {
  const bare = rewritten(PIE_CHART, found(PIE_CHART, /<c:cat>.*<\/c:cat>/), '', written(PIE_CHART, found(PIE_CHART, /<c:legend>.*<\/c:legend>/), ''))
  const [, , pie] = docxCharts(readDocx(handDocx(bare)))
  expect(pie!.chart.series[0]!.categories).toEqual([null, null, null])
  expect(
    await problems(
      bare,
      changed('shares', (chart) => ({ ...chart, legend: [] })),
    ),
  ).toBe('')
})

// A series the file lacks is a series of the report's left out: said once, before any series is compared with another's.
test('verifyDocx fails on a chart with a series fewer than the document’s', async () => {
  const more = changed('balance', (chart) => {
    const line = chart as typeof HAND_LINE
    return { ...line, series: [...line.series, { color: '#d95f02', values: [null, null, null] }] }
  })
  expect(await problems(handChartParts(), more)).toMatch(/the chart balance holds 1 series where the chart has 2/)
})

// A chart that is not alone in its paragraph has something beside it the document does not: the walk says so before it reads the chart.
test('verifyDocx fails on a chart that shares its paragraph', async () => {
  const beside = first(DOCUMENT, '</w:drawing></w:r></w:p>', `</w:drawing></w:r><w:r>${TINY}<w:t xml:space="preserve">x</w:t></w:r></w:p>`)
  expect(await problems(beside)).toMatch(/the chart sales is not a paragraph of one chart/)
})

describe('verifyDocx fails on a chart with nothing to draw', () => {
  // Its box and its words are all a reader has of it: each a way the file loses one of them.
  test.each<[string, () => Parts, RegExp, Fixture?]>([
    [
      'whose box is exactly as tall, and may cut its words',
      () => written(DOCUMENT, 'w:hRule="atLeast"', 'w:hRule="exact"'),
      /the chart nothing, which has nothing to draw, is not a cell 300 pt wide and at least 120 pt tall/,
    ],
    [
      'whose box may break across two pages',
      () => written(DOCUMENT, '<w:cantSplit/>', ''),
      /the chart nothing, which has nothing to draw, is a box that may split across two pages/,
    ],
    [
      'whose box is another width',
      () => written(DOCUMENT, '<w:tblW w:w="6000" w:type="dxa"/>', '<w:tblW w:w="5000" w:type="dxa"/>'),
      /is not a cell 300 pt wide and at least 120 pt tall/,
    ],
    [
      'whose box is filled',
      () => written(DOCUMENT, '<w:vAlign w:val="center"/>', '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/><w:vAlign w:val="center"/>'),
      /is a box with a line, a fill or padding/,
    ],
    ['whose words stand at the top of its box', () => written(DOCUMENT, '<w:vAlign w:val="center"/>', ''), /does not hold its words in the middle of its box/],
    [
      'with another empty text',
      () => written(DOCUMENT, 'No rows to chart', 'Nothing'),
      /does not print its empty text 'No rows to chart' as a paragraph of one run/,
    ],
    [
      'without its title',
      handChartParts,
      /holds 2 paragraphs where it prints 1 of its title and its empty text/,
      changed('nothing', ({ title: _title, ...chart }) => chart),
    ],
    [
      'whose title is not centred',
      () =>
        written(
          DOCUMENT,
          '<w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:b/>',
          '<w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:b/>',
        ),
      /does not centre its title/,
    ],
    [
      'whose title is not bold',
      () => written(DOCUMENT, '<w:b/><w:color w:val="000000"/><w:sz w:val="16"/>', '<w:color w:val="000000"/><w:sz w:val="16"/>'),
      /its title is not bold/,
    ],
    [
      'drawn as a chart of Word’s',
      handChartParts,
      /body\[2\] is a paragraph where the file holds its table/,
      changed('balance', () => ({ ...HAND_LINE, id: 'balance', empty: 'None', categories: [], series: [], ticks: [] })),
    ],
  ])('%s', async (_name, parts, message, fixture) => {
    expect(await problems(parts(), fixture)).toMatch(message)
  })

  // A chart that prints neither word still reserves its box: the cell ends with a paragraph, as every cell does, and holds nothing else.
  test('that prints something where it has neither a title nor an empty text', async () => {
    const bare = changed('nothing', ({ title: _title, ...chart }) => ({ ...chart, empty: ' ' }))
    expect(await problems(handChartParts(), bare)).toMatch(/prints something where it has no title and no empty text/)
  })
})

// The pie's legend is its categories: a pie the document gives no legend names no slice, and the check holds the file to that.
test('verifyDocx fails on a pie that names its slices where the chart has no legend', async () => {
  expect(
    await problems(
      handChartParts(),
      changed('shares', (chart) => ({ ...(chart as typeof HAND_PIE), legend: [] })),
    ),
  ).toMatch(/names its slices North: 45 \(45\.0 %\), South: 0 \(0\.0 %\), East: 55 \(55\.0 %\) where the chart's legend says –, –, –/)
})

describe('a group of lines kept on one page with a chart', () => {
  const kept = (...group: string[]): Fixture => ({ ...HAND_CHARTS, expect: expectation(HAND_CHARTS_DOCUMENT, { maxPagesExpected: 2, keptTogether: [group] }) })
  const HEADING = plain('Charts by hand', '<w:keepNext/>')

  // A chart's title is a word of its part: sought among the body's paragraphs it is found nowhere, and every chart under a heading would fail.
  test('finds a line that is a chart’s title at the chart’s own paragraph', async () => {
    expect(await problems(handChartParts(), kept('Charts by hand', 'Sales by region'))).toBe('')
  })

  // Only a chart's title is found at a chart: a line that is neither a paragraph nor a word of a chart is still a line the file lost.
  test('is still sought where a line of it is nowhere in the file', async () => {
    expect(await problems(handChartParts(), kept('Charts by hand', 'Sales by nobody'))).toMatch(
      /the kept lines from 'Charts by hand' are not all marked to stay on one page/,
    )
  })

  // The group holds the heading itself, and not the block walk alone: the line before the chart's is kept with it, or the group fails.
  test('fails by the group where the heading over the chart is not kept with it', async () => {
    const parts = written(DOCUMENT, '<w:keepNext/>', '')
    expect(await problems(parts, kept('Charts by hand', 'Sales by region'))).toMatch(
      /the kept lines from 'Charts by hand' are not all marked to stay on one page/,
    )
  })

  // A paragraph that says what the chart's title says is not the chart: the group's lines are sought in their order, the title after the heading.
  test('is found at the chart though a paragraph before the heading says its title', async () => {
    const said = { kind: 'paragraph', runs: [{ text: 'Sales by region' }], style: { size: 10 } } as const
    const document = { ...HAND_CHARTS_DOCUMENT, body: [said, ...HAND_CHARTS_DOCUMENT.body] }
    const fixture: Fixture = {
      ...HAND_CHARTS,
      document,
      expect: expectation(document, { maxPagesExpected: 2, keptTogether: [['Charts by hand', 'Sales by region']] }),
    }
    expect(await problems(written(DOCUMENT, HEADING, `${plain('Sales by region')}${HEADING}`), fixture)).toBe('')
    // And the heading's mark is still what holds it: without it the group fails, whatever the paragraph above says.
    expect(await problems(written(DOCUMENT, HEADING, `${plain('Sales by region')}${plain('Charts by hand')}`), fixture)).toMatch(
      /the kept lines from 'Charts by hand'/,
    )
  })
})
