import { describe, expect, test } from 'vitest'
import { chartProblems } from './check-charts.js'
import type { Page } from './check-page.js'
import type { ExpectedChart } from './fixture.js'
import type { PdfBox, PdfPage, PdfPath, PdfTextItem, ReadPdf } from './read-pdf.js'

/**
 * A chart proved on the PDF it produced (0003, 0058): `chartProblems` held
 * to reads of charts as the renderer draws them, one right and the others
 * each wrong in the one way a check exists to see.
 *
 * The corpus cannot render a chart: report-render-pdf's tests depend on
 * it, so it depends on no renderer. Each read here is built by hand in the
 * shapes `readPdf` gives: those of charts `renderPdf` drew on 2026-11-13
 * (this branch at 7fa9028, ECharts 6.1.0, pdfjs-dist 6.4.299), each after
 * a 9 pt paragraph on the corpus's A4 page, read back by `readPdf` and
 * written here to the thousandth of a point. To retake one, render the
 * chart its expectation describes with `renderPdf` from the renderer's
 * `dist/` and print `readPdf(bytes).pages[0]`'s clips, paths and items.
 * Every run of a real render is in its read, the paragraph's included, so
 * that a check reading anything it should not would fail the reads that
 * are right; 23b proves the check against the real renders of every
 * fixture.
 */

const REGULAR = 'BZZZZZ+Roboto-Regular'
const MEDIUM = 'CZZZZZ+Roboto-Medium'

const box = (x: number, top: number, width: number, height: number): PdfBox => ({ x, top, bottom: top + height, width, height })
/** A run read across the page, 8 pt as a chart's words print unless told otherwise. */
const run = (text: string, x: number, top: number, width: number, font = REGULAR, size = 8): PdfTextItem => ({
  text,
  ...box(x, top, width, size),
  angle: 0,
  font,
})
const filled = (paint: `#${string}`, x: number, top: number, width: number, height: number): PdfPath => ({
  ...box(x, top, width, height),
  paint: 'fill',
  fill: paint,
  clip: 0,
})
const stroked = (paint: `#${string}`, x: number, top: number, width: number, height: number): PdfPath => ({
  ...box(x, top, width, height),
  paint: 'stroke',
  stroke: paint,
  clip: 0,
})
/** A legend's swatch: an 8 pt square filled and stroked in its colour. */
const swatch = (paint: `#${string}`, x: number, top: number): PdfPath => ({ ...box(x, top, 8, 8), paint: 'fillStroke', fill: paint, stroke: paint, clip: 0 })
/** A gridline, stroked in the renderer's grid colour, `chart-option.ts`'s GRID; and the category axis's line, in its AXIS colour. */
const gridline = (top: number, x: number, width: number): PdfPath => stroked('#d9d9d9', x, top, width, 0)
const axisLine = (top: number, x: number, width: number): PdfPath => stroked('#000000', x, top, width, 0)
/** A tick as the runtime resolves one: its value exactly, and its label, the value itself unless told otherwise. */
const tick = (exact: string, text = exact): ExpectedChart['ticks'][number] => ({ exact, text })
/** The 9 pt paragraph above every chart here, which is no chart's. */
const BEFORE = run('Before', 40, 37.15, 26.38, REGULAR, 9)

/** What one page of a read draws, and the SVG images' boxes the checks found on it. */
interface Drawn {
  readonly clips: readonly PdfBox[]
  readonly paths: readonly PdfPath[]
  readonly items: readonly PdfTextItem[]
  readonly drawings?: readonly PdfBox[]
}

/** What `chartProblems` finds of `charts` on these pages. */
function problemsOf(charts: readonly ExpectedChart[], ...drawn: readonly Drawn[]): string[] {
  const read: PdfPage[] = drawn.map(({ clips, paths, items }, index) => ({ number: index + 1, width: 595.28, height: 841.89, items, images: [], paths, clips }))
  const pdf: ReadPdf = { pages: read, fonts: [], attachments: [] }
  const pages: Page[] = read.map((page, index) => ({ page, lines: [], header: [], footer: [], body: [], drawings: drawn[index]!.drawings ?? [] }))
  return chartProblems(pdf, pages, charts)
}

/** `list` with `old` replaced by each of `now`, or taken out where there is none. */
function replaced<T>(list: readonly T[], old: T, ...now: T[]): T[] {
  if (!list.includes(old)) throw new Error('the read has no such shape to replace')
  return list.flatMap((each) => (each === old ? now : [each]))
}

/**
 * Bars: two series over three regions, one value missing, one zero and one
 * below zero, every value labelled, with a title, axis titles and a legend.
 */
const SALES: ExpectedChart = {
  id: 'sales',
  chart: 'bar',
  width: 300,
  height: 200,
  words: ['Sales', 'Region', 'CHF', 'North', 'South', 'East', '10.25', '0', '15', '-5', '7.5', 'Plan', 'Actual'],
  categories: ['North', 'South', 'East'],
  ticks: ['-5', '0', '5', '10', '15'].map((exact) => tick(exact)),
  marks: [
    { paint: '#1f77b4', values: ['10.25', null, '0'] },
    { paint: '#ff7f0e', values: ['15', '-5', '7.5'] },
  ],
  faces: [],
  empty: false,
}
const SALES_BOX = box(40, 46.547, 300, 200)
const PLAN_NORTH = filled('#1f77b4', 69.3, 121.247, 33.2, 34.8)
const ACTUAL_NORTH = filled('#ff7f0e', 110.8, 105.047, 33.2, 51)
const ACTUAL_SOUTH = filled('#ff7f0e', 204.1, 156.047, 33.2, 17)
const PLAN_SWATCH = swatch('#1f77b4', 153.754, 232.859)
const SALES_GRID = [173.047, 156.047, 139.047, 122.047, 105.047].map((top) => gridline(top, 60, 280))
const SALES_AXIS = axisLine(173.047, 60, 280)
const NORTH = run('North', 96.561, 196.444, 20.199)
const SOUTH = run('South', 189.623, 196.444, 20.746)
const EAST = run('East', 285.51, 196.444, 15.645)
const REGION = run('Region', 187.701, 206.719, 24.59)
const PLAN = run('Plan', 166.754, 233.194, 15.762)
const ACTUAL = run('Actual', 203.766, 233.194, 22.73)
const TICK_5 = run('5', 47.496, 135.381, 4.496)
const SALES_READ: Drawn = {
  clips: [SALES_BOX],
  paths: [
    ...SALES_GRID,
    SALES_AXIS,
    PLAN_NORTH,
    filled('#1f77b4', 256, 156.047, 33.2, 0),
    ACTUAL_NORTH,
    ACTUAL_SOUTH,
    filled('#ff7f0e', 297.5, 130.547, 33.2, 25.5),
    PLAN_SWATCH,
    swatch('#ff7f0e', 190.766, 232.859),
  ],
  items: [
    BEFORE,
    run('Sales', 180.201, 52.569, 19.598, MEDIUM),
    REGION,
    run('CHF', 52.324, 81.694, 15.336),
    NORTH,
    SOUTH,
    EAST,
    run('-5', 45.285, 169.381, 6.707),
    run('0', 47.496, 152.381, 4.496),
    TICK_5,
    run('10', 43, 118.381, 8.992),
    run('15', 43, 101.381, 8.992),
    run('10.25', 75.872, 107.844, 20.094),
    run('0', 270.343, 142.694, 4.496),
    run('15', 122.905, 91.694, 8.992),
    run('-5', 217.384, 179.069, 6.707),
    run('7.5', 308.523, 117.194, 11.102),
    PLAN,
    ACTUAL,
  ],
}
const sales = (edit: Partial<Drawn>): Drawn => ({ ...SALES_READ, ...edit })

/** A line of two series over four months, one with a gap and one with no value at all, its values unlabelled, as a line of several series' are. */
const BALANCE: ExpectedChart = {
  id: 'balance',
  chart: 'line',
  width: 260,
  height: 160,
  words: ['Balance', 'Jan', 'Feb', 'Mar', 'Apr', 'Paid', 'Owed'],
  categories: ['Jan', 'Feb', 'Mar', 'Apr'],
  ticks: ['0', '5', '10', '15'].map((exact) => tick(exact)),
  marks: [
    { paint: '#2ca02c', values: ['6', null, '12', '9'] },
    { paint: '#d62728', values: [null, null, null, null] },
  ],
  faces: [],
  empty: false,
}
const PAID_LINE = stroked('#2ca02c', 210, 90.847, 60, 19.8)
const PAID_JAN = filled('#2ca02c', 87.996, 128.347, 4, 4)
const BALANCE_READ: Drawn = {
  clips: [box(40, 46.547, 260, 160)],
  paths: [
    ...[170.047, 137.047, 104.047, 71.047].map((top) => gridline(top, 60, 240)),
    axisLine(170.047, 60, 240),
    PAID_LINE,
    PAID_JAN,
    filled('#2ca02c', 208, 88.747, 4, 4),
    filled('#2ca02c', 268.002, 108.547, 4, 4),
    swatch('#2ca02c', 134.959, 192.859),
    swatch('#d62728', 172.022, 192.859),
  ],
  items: [
    BEFORE,
    run('Balance', 155.686, 52.569, 28.629, MEDIUM),
    run('Jan', 83.401, 179.069, 13.184),
    run('Feb', 143.458, 179.069, 13.074),
    run('Mar', 202.974, 179.069, 14.047),
    run('Apr', 263.788, 179.069, 12.422),
    run('0', 47.496, 166.381, 4.496),
    run('5', 47.496, 133.381, 4.496),
    run('10', 43, 100.381, 8.992),
    run('15', 43, 67.381, 8.992),
    run('Paid', 147.959, 193.194, 15.813),
    run('Owed', 185.022, 193.194, 20.27),
  ],
}
const balance = (edit: Partial<Drawn>): Drawn => ({ ...BALANCE_READ, ...edit })

/** A pie of three slices, the last of them nothing, its values in its legend. */
const SHARES: ExpectedChart = {
  id: 'shares',
  chart: 'pie',
  width: 200,
  height: 200,
  words: ['Shares', 'North: 3 (75.0 %)', 'South: 1 (25.0 %)', 'East: 0 (0.0 %)'],
  categories: [],
  ticks: [],
  marks: [
    { paint: '#1f77b4', values: ['3'] },
    { paint: '#ff7f0e', values: ['1'] },
    { paint: '#2ca02c', values: ['0'] },
  ],
  faces: [],
  empty: false,
}
const NORTH_SLICE = filled('#1f77b4', 67.8, 65.647, 144.601, 144.601)
const SOUTH_SLICE = filled('#ff7f0e', 67.8, 65.647, 72.2, 72.2)
/** What ECharts drew of the zero slice: a sector of no sweep, from the pie's centre to its rim at noon, which the read omits and a case adds. */
const EAST_SLICE = filled('#2ca02c', 140, 65.647, 0, 72.2)
const SHARES_READ: Drawn = {
  clips: [box(40, 46.547, 200, 200)],
  paths: [NORTH_SLICE, SOUTH_SLICE, swatch('#1f77b4', 63.16, 215.484), swatch('#ff7f0e', 143.977, 215.484), swatch('#2ca02c', 63.16, 232.859)],
  items: [
    BEFORE,
    run('Shares', 127.621, 52.569, 24.758, MEDIUM),
    run('North: 3 (75.0 %)', 76.16, 215.819, 59.566),
    run('South: 1 (25.0 %)', 156.977, 215.819, 60.113),
    run('East: 0 (0.0 %)', 76.16, 233.194, 50.516),
  ],
}
const shares = (edit: Partial<Drawn>): Drawn => ({ ...SHARES_READ, ...edit })

/** A chart with nothing to draw: its title and its empty text, and no clip and no path. */
const NOTHING: ExpectedChart = {
  id: 'nothing',
  chart: 'line',
  width: 200,
  height: 100,
  words: ['Balance', 'No data'],
  categories: [],
  ticks: [],
  marks: [],
  faces: [],
  empty: true,
}
const NOTHING_TITLE = run('Balance', 125.686, 52.569, 28.629, MEDIUM)
const NO_DATA = run('No data', 125.957, 92.881, 28.086)
const NOTHING_READ: Drawn = { clips: [], paths: [], items: [BEFORE, NOTHING_TITLE, NO_DATA] }

describe('chartProblems', () => {
  // A check that found something wrong with what the renderer draws would
  // fail every fixture; each of the charts the cases below change passes.
  test.each([
    ['a bar chart', SALES, SALES_READ],
    ['a line chart with a gap and a series of no value', BALANCE, BALANCE_READ],
    ['a pie with a zero slice', SHARES, SHARES_READ],
    ['a chart with nothing to draw', NOTHING, NOTHING_READ],
  ] as const)('passes %s as the renderer draws it', (_, chart, read) => {
    expect(problemsOf([chart], read)).toEqual([])
  })

  // A chart is found by its clip, as an SVG image is: a chart that is not
  // drawn at all is one problem, and its words are not then read for it.
  test('finds a chart that is not drawn', () => {
    expect(problemsOf([SALES], sales({ clips: [] }))).toEqual(['the chart sales, 300 × 200 pt, is not drawn: no clip of its size holds a painted path'])
  })

  // A clip an SVG image of the chart's size took is the image's, and one
  // that holds no paint is no drawing: the chart is not found in either.
  test('takes no clip an SVG image took, nor one nothing is painted in', () => {
    expect(problemsOf([SALES], sales({ drawings: [SALES_BOX] }))).toEqual([
      'the chart sales, 300 × 200 pt, is not drawn: no clip of its size holds a painted path',
    ])
    expect(problemsOf([SALES], sales({ paths: [] }))).toEqual(['the chart sales, 300 × 200 pt, is not drawn: no clip of its size holds a painted path'])
  })

  // Charts are found in document order, each after the one before: the
  // second of two charts of one size takes the second clip, on the next
  // page, and a chart not found leaves the next to be sought from where
  // the one before it was.
  test('finds charts of one size in document order across pages', () => {
    expect(problemsOf([SALES, { ...SALES, id: 'again' }], SALES_READ, SALES_READ)).toEqual([])
    expect(problemsOf([SALES, { ...SALES, id: 'again' }, { ...SALES, id: 'third' }], SALES_READ, SALES_READ)).toEqual([
      'the chart third, 300 × 200 pt, is not drawn: no clip of its size holds a painted path',
    ])
  })

  // ECharts clips a series to its plot, and a path's clip is the innermost
  // (C14): a chart's marks painted in a clip set inside its box are its own.
  test("reads a chart's marks painted in a clip set inside its box", () => {
    const plot = box(60, 105.047, 280, 68)
    const inner = SALES_READ.paths.map((path): PdfPath => (path.paint === 'fill' ? { ...path, clip: 1 } : path))
    expect(problemsOf([SALES], sales({ clips: [SALES_BOX, plot], paths: inner }))).toEqual([])
  })

  // The converter clips a drawing to its box (0058): a mark reaching past
  // the clip it is painted in is drawn cut, which shows less than its value.
  test('finds a mark its clip cuts', () => {
    const past = filled('#ff7f0e', 110.8, 40, 33.2, 116.047)
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, ACTUAL_NORTH, past) }))).toContain(
      'page 1: the chart sales paints a path its clip cuts: fill #ff7f0e at 110.8, 40, 33.2 × 116.05 pt',
    )
  })
})

describe("a chart's words", () => {
  // A word printed past the chart's box stands over what is beside it, and
  // a check reading only the words inside would not see it gone.
  test('finds a word moved outside the box', () => {
    const moved = run('Region', 187.701, 250, 24.59)
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, REGION, moved) }))).toEqual([
      "page 1: the chart sales does not print 'Region' inside its box",
    ])
  })

  // A category that did not print leaves its bars unnamed.
  test('finds a missing category', () => {
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, EAST) }))).toEqual(["page 1: the chart sales does not print 'East' inside its box"])
  })

  // A word half in the box is the chart's, and cut where its box ends.
  test('finds a word that reaches past the box', () => {
    const past = run('Actual', 330, 233.194, 22.73)
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, ACTUAL, past) }))).toEqual([
      "page 1: the chart sales prints 'Actual' past its box, from 330, 233.19 to 352.73, 241.19 pt",
    ])
  })

  // ECharts printing a word of its own -- a key it was handed, `c0` --
  // is a word the runtime never wrote (R19); one printed twice is a word
  // that stands twice.
  test('finds a word that is none of its words, and one printed twice', () => {
    expect(problemsOf([SALES], sales({ items: [...SALES_READ.items, run('c0', 100, 60, 8)] }))).toEqual([
      "page 1: the chart sales prints 'c0', which is none of its words",
    ])
    expect(problemsOf([SALES], sales({ items: [...SALES_READ.items, run('Plan', 250, 233.194, 15.762)] }))).toEqual([
      "page 1: the chart sales prints 'Plan' twice inside its box; its words hold it once",
    ])
    const thrice = [...SALES_READ.items, run('Plan', 250, 233.194, 15.762), run('Plan', 280, 233.194, 15.762)]
    expect(problemsOf([SALES], sales({ items: thrice }))).toEqual(["page 1: the chart sales prints 'Plan' 3 times inside its box; its words hold it once"])
  })

  // A word may hold a no-break space, which PDF.js reads back as a space,
  // or two spaces, which it reads as one (measured on the renderer's legend
  // entries 'Sud:\u00a01 (25,0 %)' and 'North  East'): a word is sought as
  // PDF.js extracts it, by `normalise`, so that a word printed whole is not
  // said to be missing. So are a category's label, a tick's and a face's.
  test('reads a word with a no-break space, or two spaces, as PDF.js extracts it', () => {
    const spaced = (text: string): string => text.replace(' ', '\u00a0')
    const pie: ExpectedChart = { ...SHARES, words: SHARES.words.map(spaced), faces: [{ text: spaced('North: 3 (75.0 %)'), postScriptName: 'Roboto-Regular' }] }
    expect(problemsOf([pie], SHARES_READ)).toEqual([])
    expect(problemsOf([{ ...pie, faces: [{ text: spaced('North: 3 (75.0 %)'), postScriptName: 'Roboto-Medium' }] }], SHARES_READ)).toEqual([
      "page 1: the chart shares prints 'North: 3 (75.0 %)' in Roboto-Regular; its face is Roboto-Medium",
    ])
    expect(problemsOf([{ ...SHARES, words: SHARES.words.map((word) => word.replace(' ', '  ')) }], SHARES_READ)).toEqual([])
    const bars: ExpectedChart = {
      ...SALES,
      words: SALES.words.map((word) => (word === 'North' ? ' North\u00a0' : word)),
      categories: [' North\u00a0', 'South', 'East'],
    }
    expect(problemsOf([bars], SALES_READ)).toEqual([])
    const raised = { ...NORTH, ...box(96.561, 140, 20.199, 8) }
    expect(problemsOf([bars], sales({ items: replaced(SALES_READ.items, NORTH, raised) }))).toEqual([
      "page 1: the chart sales prints category 1's label 'North' nowhere under its slot, centred at 106.67 pt",
    ])
    const ticks: ExpectedChart = { ...SALES, ticks: SALES.ticks.map(({ exact, text }) => tick(exact, `${text}\u00a0`)) }
    expect(problemsOf([ticks], SALES_READ)).toEqual([])
    expect(problemsOf([{ ...NOTHING, words: ['Balance', 'No\u00a0data'] }], NOTHING_READ)).toEqual([])
  })

  // The renderer draws a chart's words across and never turns one (R6, the
  // fallback): a label turned a quarter is read by its turned box, which a
  // check of where words stand would otherwise take as placed.
  test('finds a label turned 90°', () => {
    const turned: PdfTextItem = { ...NORTH, ...box(102.661, 190.344, 8, 20.199), angle: 90 }
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, NORTH, turned) }))).toEqual([
      "page 1: the chart sales prints 'North' turned 90°; its words read across",
    ])
  })

  // A chart's words print in the report's face (0043): a word mapped to a
  // host face that printed in Roboto reads the same text. The faces are
  // Liberation Serif's names as the renderer's serif chart printed them.
  test('finds a word in Roboto where the host face was expected', () => {
    const face = (text: string): string => (text === 'Sales' ? 'LiberationSerif-Bold' : 'LiberationSerif')
    const serif: ExpectedChart = {
      ...SALES,
      faces: [...SALES.words, ...SALES.ticks.map(({ text }) => text)].map((text) => ({ text, postScriptName: face(text) })),
    }
    const items = SALES_READ.items.map((item) =>
      item === BEFORE ? item : { ...item, font: item.text === 'Sales' ? 'CZZZZZ+LiberationSerif-Bold' : 'DZZZZZ+LiberationSerif' },
    )
    expect(problemsOf([serif], sales({ items }))).toEqual([])
    const roboto = items.map((item) => (item.text === 'North' ? { ...item, font: REGULAR } : item))
    expect(problemsOf([serif], sales({ items: roboto }))).toEqual(["page 1: the chart sales prints 'North' in Roboto-Regular; its face is LiberationSerif"])
  })

  // Two words over each other print neither legibly, though each is in its
  // box and printed once.
  test('finds two words that meet', () => {
    const over = run('Plan', 200, 233.194, 15.762)
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, PLAN, over) }))).toEqual([
      "page 1: the chart sales prints 'Plan' and 'Actual' over each other",
    ])
    // Half a point over is under the page's overlap allowance, and still two words that meet, which the renderer refuses.
    const touching = run('Plan', 188.504, 233.194, 15.762)
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, PLAN, touching) }))).toEqual([
      "page 1: the chart sales prints 'Plan' and 'Actual' over each other",
    ])
  })

  // A category's label names the bars above it: two labels swapped print
  // every word once, in the box, and name the wrong bars; one in its
  // slot's column but up in the plot names none.
  test('finds a category label away from its slot', () => {
    const raised = { ...NORTH, ...box(96.561, 140, 20.199, 8) }
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, NORTH, raised) }))).toEqual([
      "page 1: the chart sales prints category 1's label 'North' nowhere under its slot, centred at 106.67 pt",
    ])
    const [north, south] = [
      { ...NORTH, x: 189.9 },
      { ...SOUTH, x: 96.287 },
    ]
    expect(problemsOf([SALES], sales({ items: replaced(replaced(SALES_READ.items, NORTH, north), SOUTH, south) }))).toEqual([
      "page 1: the chart sales prints category 1's label 'North' nowhere under its slot, centred at 106.67 pt",
      "page 1: the chart sales prints category 2's label 'South' nowhere under its slot, centred at 200 pt",
    ])
  })
})

describe("a chart's axis", () => {
  // A gridline missing is a tick the axis does not show.
  test('finds a gridline missing', () => {
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, SALES_GRID[2]!) }))).toEqual([
      "page 1: the chart sales draws 4 gridlines in the grid's colour; its ticks are 5",
    ])
  })

  // The gridlines are the plot: one narrower, or out of step, is an axis
  // that reads differently at one tick than at the next.
  test('finds a gridline narrower than the plot, and one out of step', () => {
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, SALES_GRID[3]!, gridline(122.047, 60, 200)) }))).toEqual([
      'page 1: the chart sales draws its gridline of tick 4 from 60 to 260 pt across; its lowest from 60 to 340',
    ])
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, SALES_GRID[3]!, gridline(124.047, 60, 280)) }))).toContain(
      'page 1: the chart sales draws its gridlines unevenly: 17 pt apart from its lowest tick, 15 pt from tick 3 to tick 4',
    )
  })

  // The category axis's line is the plot's foot, which the paint contract
  // draws in the axis's colour beside the lowest gridline.
  test('finds the axis line missing', () => {
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, SALES_AXIS) }))).toEqual([
      "page 1: the chart sales draws no line in the axis's colour along its plot's foot at 173.05 pt",
    ])
  })

  // The ticks are thinned every k-th from the lowest (Task 21): one
  // dropped among them, or the lowest dropped, is an axis that reads
  // otherwise than it is spaced.
  test('finds tick labels not every k-th from the lowest', () => {
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, TICK_5) }))).toEqual([
      "page 1: the chart sales labels its ticks '-5', '0', '10', '15'; one in every 1 from the lowest is '-5', '0', '5', '10', '15'",
    ])
    const lowest = SALES_READ.items.filter((item) => item.text !== '-5' || item.x > 60)
    expect(problemsOf([SALES], sales({ items: lowest }))).toEqual([
      "page 1: the chart sales labels its ticks '0', '5', '10', '15'; at least two, from its lowest, '-5'",
    ])
  })

  // The renderer thins the labels to every k-th from the lowest where they
  // would stand too close, keeping every gridline (Task 21): a check that
  // demanded every tick's label would fail every tall axis on a short plot.
  test('passes tick labels thinned to every second from the lowest', () => {
    const thinned = SALES_READ.items.filter((item) => !['0', '10'].includes(item.text) || item.x > 60)
    expect(problemsOf([SALES], sales({ items: thinned }))).toEqual([])
  })

  // A tick labelled twice beside the plot is a label over another, or two
  // labels of one height; one labelled nowhere leaves the axis unread.
  test('finds a tick labelled twice, and none labelled', () => {
    expect(problemsOf([SALES], sales({ items: [...SALES_READ.items, run('5', 41, 135.381, 4.496)] }))).toEqual([
      "page 1: the chart sales prints tick '5' twice beside its plot",
    ])
    const unlabelled = SALES_READ.items.filter((item) => item.x + item.width > 60)
    expect(problemsOf([SALES], sales({ items: unlabelled }))).toEqual(["page 1: the chart sales labels none of its ticks; at least two, from its lowest, '-5'"])
  })

  // A tick's label stands at its gridline, its value rising up the page:
  // a label moved off its gridline labels another height.
  test('finds a tick label away from its gridline', () => {
    const moved = { ...TICK_5, ...box(47.496, 110, 4.496, 8) }
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, TICK_5, moved) }))).toEqual([
      "page 1: the chart sales prints tick '5' from 110 to 118 pt down the page, not across its gridline at 139.05",
      "page 1: the chart sales prints tick '10' no higher than tick '5'",
    ])
  })
})

describe("a bar chart's bars", () => {
  // A bar drawn shorter than its value is the chart lying; the check must see 2 pt.
  test('finds a bar whose length is not its value', () => {
    const short = filled('#ff7f0e', 110.8, 107.047, 33.2, 49)
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, ACTUAL_NORTH, short) }))).toEqual([
      'page 1: the chart sales draws the bar of series 2 at category 1 from 107.05 to 156.05 pt down the page; its value stands from 105.05 to 156.05',
    ])
  })

  // A legend's swatch is filled and stroked, a bar filled alone (0058): a
  // check that counted a swatch as a bar would see one too many; one that
  // lost its stroke is a bar of the series' colour outside the plot.
  test('finds a swatch drawn as a bar', () => {
    const unstroked = filled('#1f77b4', 153.754, 232.859, 8, 8)
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, PLAN_SWATCH, unstroked) }))).toEqual([
      "page 1: the chart sales paints a filled path in series 1's colour outside its plot: fill #1f77b4 at 153.75, 232.86, 8 × 8 pt",
    ])
  })

  // A value the series does not have draws no bar; one it has draws one.
  test('finds a bar where there is no value, one missing and one drawn twice', () => {
    const where = filled('#1f77b4', 162.6, 140, 33.2, 16.047)
    expect(problemsOf([SALES], sales({ paths: [...SALES_READ.paths, where] }))).toEqual([
      'page 1: the chart sales draws a bar of series 1 at category 2, which has no value',
    ])
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, ACTUAL_SOUTH) }))).toEqual([
      'page 1: the chart sales draws no bar of series 2 at category 2',
    ])
    expect(problemsOf([SALES], sales({ paths: [...SALES_READ.paths, ACTUAL_SOUTH] }))).toEqual([
      'page 1: the chart sales draws 2 bars of series 2 at category 2',
    ])
  })

  // A zero is a bar of no length, which ECharts draws along zero: it may
  // be left out, since nothing of it shows, but not drawn tall.
  test('lets a zero be drawn as no bar, and not as a bar of a length', () => {
    const zero = SALES_READ.paths.find((path) => path.fill === '#1f77b4' && path.height === 0)!
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, zero) }))).toEqual([])
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, zero, filled('#1f77b4', 256, 150, 33.2, 6.047)) }))).toEqual([
      'page 1: the chart sales draws the bar of series 1 at category 3 from 150 to 156.05 pt down the page; its value stands from 156.05 to 156.05',
    ])
  })

  // A bar stands in its category's slot: one across a slot's edge stands
  // between two categories and names neither, as a group ECharts widened
  // past its slot would.
  test("finds a bar across its slot's edge", () => {
    const across = filled('#ff7f0e', 140, 156.047, 33.2, 17)
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, ACTUAL_SOUTH, across) }))).toEqual([
      'page 1: the chart sales draws the bar of series 2 at category 2 from 140 to 173.2 pt across, past its slot from 153.33 to 246.67',
    ])
  })

  // Every bar of a chart is one width: a narrower one reads as another kind.
  test('finds a bar of another width', () => {
    const narrow = filled('#ff7f0e', 204.1, 156.047, 20, 17)
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, ACTUAL_SOUTH, narrow) }))).toEqual([
      'page 1: the chart sales draws the bar of series 2 at category 2 20 pt wide; its first bar is 33.2',
    ])
  })

  // The paint contract names no stroke of a series' colour on a bar chart,
  // and nothing painted in the grid's colour but its gridlines.
  test('finds a path the paint contract does not name', () => {
    expect(problemsOf([SALES], sales({ paths: [...SALES_READ.paths, stroked('#1f77b4', 70, 120, 30, 30)] }))).toEqual([
      'page 1: the chart sales paints stroke #1f77b4 at 70, 120, 30 × 30 pt, which is no part of a chart',
    ])
    expect(problemsOf([SALES], sales({ paths: [...SALES_READ.paths, filled('#d9d9d9', 70, 120, 30, 30)] }))).toEqual([
      'page 1: the chart sales paints fill #d9d9d9 at 70, 120, 30 × 30 pt, which is no part of a chart',
    ])
  })
})

describe("a line chart's marks", () => {
  // A series with no value draws no path (Task 20's ruling): ECharts writes
  // its line empty and the converter draws nothing, while its swatch still
  // prints; anything of its colour in the plot is a value it does not have.
  test('finds a mark of a series that has no value', () => {
    expect(problemsOf([BALANCE], balance({ paths: [...BALANCE_READ.paths, filled('#d62728', 148, 120, 4, 4)] }))).toEqual([
      'page 1: the chart balance draws a marker of series 2 at category 2, which has no value',
    ])
    expect(problemsOf([BALANCE], balance({ paths: [...BALANCE_READ.paths, stroked('#d62728', 90, 100, 60, 20)] }))).toEqual([
      'page 1: the chart balance draws 1 line of series 2; its values make 0 stretches of two or more',
    ])
  })

  // A value with no marker is a point the line does not show.
  test('finds a marker missing, and one that is no square', () => {
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_JAN) }))).toEqual([
      'page 1: the chart balance draws no marker of series 1 at category 1',
    ])
    expect(problemsOf([BALANCE], balance({ paths: [...BALANCE_READ.paths, filled('#2ca02c', 95, 128.347, 4, 4)] }))).toEqual([
      'page 1: the chart balance draws 2 markers of series 1 at category 1',
    ])
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_JAN, filled('#2ca02c', 87.996, 127.347, 4, 6)) }))).toEqual([
      'page 1: the chart balance draws the marker of series 1 at category 1 4 × 6 pt, which is no square',
    ])
  })

  // A marker in its category's slot but off its middle stands for another
  // place along the axis, which on a line is another time.
  test("finds a marker off its category's middle", () => {
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_JAN, filled('#2ca02c', 93, 128.347, 4, 4)) }))).toEqual([
      'page 1: the chart balance draws the marker of series 1 at category 1 at 95, 130.35; its value stands at 90, 130.45',
    ])
  })

  // A line across the gap would show a value the series does not have;
  // one that does not reach its points shows others than it has.
  test('finds a line across a gap, and one that does not join its points', () => {
    expect(problemsOf([BALANCE], balance({ paths: [...BALANCE_READ.paths, stroked('#2ca02c', 90, 90.847, 120, 39.6)] }))).toEqual([
      'page 1: the chart balance draws 2 lines of series 1; its values make 1 stretch of two or more',
    ])
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_LINE, stroked('#2ca02c', 210, 90.847, 60, 25)) }))).toEqual([
      'page 1: the chart balance draws its line of series 1 from category 3 to 4 across 210 to 270 pt and down 90.85 to 115.85 pt; its values span 210 to 270 across and 90.85 to 110.65 down',
    ])
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_LINE, stroked('#2ca02c', 150, 90.847, 120, 19.8)) }))).toEqual([
      'page 1: the chart balance draws its line of series 1 from category 3 to 4 across 150 to 270 pt and down 90.85 to 110.65 pt; its values span 210 to 270 across and 90.85 to 110.65 down',
    ])
  })

  // A check on the values' doubles would read 1000000000000001.06 as
  // 1000000000000001, a tick, and pass this marker drawn on that tick's
  // gridline -- and fail the renderer's, 2.14 pt above it (Task 19). The
  // place is worked out from the decimals.
  test('finds a marker that only the exact place catches', () => {
    expect(Number('1000000000000001.06')).toBe(1000000000000001)
    const ticks = ['1000000000000000', '1000000000000001', '1000000000000002', '1000000000000003', '1000000000000004']
    const close: ExpectedChart = {
      id: 'close',
      chart: 'line',
      width: 260,
      height: 160,
      words: ['Q1', 'Q2'],
      categories: ['Q1', 'Q2'],
      ticks: ticks.map((exact) => tick(exact)),
      marks: [{ paint: '#9467bd', values: ['1000000000000001.06', '1000000000000003'] }],
      faces: [],
      empty: false,
    }
    const q1 = filled('#9467bd', 165.206, 149.907, 4, 4)
    const read: Drawn = {
      clips: [box(40, 46.547, 260, 160)],
      paths: [
        ...[188.047, 154.047, 120.047, 86.047, 52.047].map((top) => gridline(top, 122.9, 177.1)),
        axisLine(188.047, 122.9, 177.1),
        stroked('#9467bd', 167.2, 86.047, 88.5, 66),
        q1,
        filled('#9467bd', 253.737, 83.947, 4, 4),
      ],
      items: [
        BEFORE,
        run('Q1', 162.203, 197.069, 10),
        run('Q2', 250.734, 197.069, 10),
        ...ticks.map((text, index) => run(text, 43, 184.381 - 34 * index, 71.938)),
      ],
    }
    expect(problemsOf([close], read)).toEqual([])
    const onTheTick = filled('#9467bd', 165.206, 152.047, 4, 4)
    expect(problemsOf([close], { ...read, paths: replaced(read.paths, q1, onTheTick) })).toEqual([
      'page 1: the chart close draws the marker of series 1 at category 1 at 167.21, 154.05; its value stands at 167.18, 152.01',
    ])
  })

  // A tick prints the runtime's label, which in Swiss French is 1'000 for
  // the value 1000: the axis is placed by the ticks' values, and a check
  // reading a label as a value could place no axis that prints one.
  test("places an axis by its ticks' values, whatever their labels print", () => {
    const turnover: ExpectedChart = {
      id: 'turnover',
      chart: 'bar',
      width: 220,
      height: 140,
      words: ['Q1', 'Q2', "1'500", "2'750.50"],
      categories: ['Q1', 'Q2'],
      ticks: [tick('0'), tick('1000', "1'000"), tick('2000', "2'000"), tick('3000', "3'000")],
      marks: [{ paint: '#8c564b', values: ['1500', '2750.5'] }],
      faces: [],
      empty: false,
    }
    const read: Drawn = {
      clips: [box(40, 46.547, 220, 140)],
      paths: [
        ...[168.047, 134.047, 100.047, 66.047].map((top) => gridline(top, 70.4, 189.6)),
        axisLine(168.047, 70.4, 189.6),
        filled('#8c564b', 79.9, 117.047, 75.8, 51),
        filled('#8c564b', 174.7, 74.547, 75.8, 93.5),
      ],
      items: [
        BEFORE,
        run('Q1', 112.787, 177.069, 10),
        run('Q2', 207.596, 177.069, 10),
        run('0', 57.887, 164.381, 4.496),
        run("1'000", 43, 130.381, 19.383),
        run("2'000", 43, 96.381, 19.383),
        run("3'000", 43, 62.381, 19.383),
        run("1'500", 108.096, 103.694, 19.383),
        run("2'750.50", 197.354, 61.177, 30.484),
      ],
    }
    expect(problemsOf([turnover], read)).toEqual([])
  })

  // A mark of a series' colour outside the plot is a value drawn where no
  // value stands.
  test('finds a marker outside the plot', () => {
    expect(problemsOf([BALANCE], balance({ paths: [...BALANCE_READ.paths, filled('#2ca02c', 150, 180, 4, 4)] }))).toEqual([
      "page 1: the chart balance paints a filled path in series 1's colour outside its plot: fill #2ca02c at 150, 180, 4 × 4 pt",
    ])
  })
})

describe("a pie's slices", () => {
  // ECharts draws a zero slice as a sector of no sweep, from the pie's
  // centre to its rim: a path in the zero slice's colour that its box
  // cannot prove has no area, which a rasteriser that paints every pixel a
  // shape touches may print as a hairline. A slice of nothing paints
  // nothing.
  test('finds a path drawn for a zero slice', () => {
    expect(problemsOf([SHARES], shares({ paths: [...SHARES_READ.paths, EAST_SLICE] }))).toEqual([
      'page 1: the chart shares paints slice 3, which has no share of its pie',
    ])
  })

  // The renderer hands ECharts each share to 10^-17 of the pie (Task 19's
  // QUOTIENT_UNIT): a slice under that is a share of nothing, which draws
  // no path and must not be demanded one; a slice of exactly 10^-17 is a
  // share, drawn however thin. The pie's total is 10^20, so 1000 of it is
  // one part and 999 none.
  test('expects no path of a slice under 10^-17 of its pie, and one of a slice of 10^-17', () => {
    const tiny: ExpectedChart = {
      id: 'tiny',
      chart: 'pie',
      width: 160,
      height: 160,
      words: ['Most', 'Least', 'Less'],
      categories: [],
      ticks: [],
      marks: [
        { paint: '#1f77b4', values: ['99999999999999998001'] },
        { paint: '#ff7f0e', values: ['999'] },
        { paint: '#2ca02c', values: ['1000'] },
      ],
      faces: [],
      empty: false,
    }
    const [least, less] = [filled('#ff7f0e', 120, 46.547, 0, 70.5), filled('#2ca02c', 120, 46.547, 0, 70.5)]
    const read: Drawn = {
      clips: [box(40, 46.547, 160, 160)],
      paths: [
        filled('#1f77b4', 50.017, 46.545, 141, 141),
        less,
        swatch('#1f77b4', 65, 192.859),
        swatch('#ff7f0e', 104.543, 192.859),
        swatch('#2ca02c', 145.441, 192.859),
      ],
      items: [BEFORE, run('Most', 78, 193.194, 18.293), run('Least', 117.543, 193.194, 19.648), run('Less', 158.441, 193.194, 16.809)],
    }
    expect(problemsOf([tiny], read)).toEqual([])
    expect(problemsOf([tiny], { ...read, paths: [...read.paths, least] })).toEqual(['page 1: the chart tiny paints slice 2, which has no share of its pie'])
    expect(problemsOf([tiny], { ...read, paths: replaced(read.paths, less) })).toEqual(['page 1: the chart tiny paints nothing of slice 3'])
  })

  // A slice drawn twice is a share drawn twice; the slices together are a
  // disc, whose box is a square.
  test('finds a slice drawn twice, and slices that make no disc', () => {
    expect(problemsOf([SHARES], shares({ paths: [...SHARES_READ.paths, SOUTH_SLICE] }))).toEqual(['page 1: the chart shares paints slice 2 in 2 paths'])
    const stretched = filled('#1f77b4', 67.8, 65.647, 144.601, 120)
    expect(problemsOf([SHARES], shares({ paths: replaced(SHARES_READ.paths, NORTH_SLICE, stretched) }))).toEqual([
      'page 1: the chart shares paints its slices together across 144.6 × 120 pt, which is no square',
    ])
  })
})

describe('a chart with nothing to draw', () => {
  // An empty chart has no SVG and no clip (R7, R8): it is proved by its
  // title and its empty text alone, the empty text below the title within
  // the box's size, and its box is not proved (0058).
  test('finds its empty text missing, and its title not above it', () => {
    expect(problemsOf([NOTHING], { ...NOTHING_READ, items: [BEFORE, NOTHING_TITLE] })).toEqual(["the chart nothing does not print its empty text 'No data'"])
    const below = run('Balance', 125.686, 120, 28.629, MEDIUM)
    expect(problemsOf([NOTHING], { ...NOTHING_READ, items: [BEFORE, below, NO_DATA] })).toEqual([
      "page 1: the chart nothing prints its title 'Balance' nowhere above its empty text within its box",
    ])
    const far = run('Balance', 125.686, 52.569 - 60, 28.629, MEDIUM)
    expect(problemsOf([NOTHING], { ...NOTHING_READ, items: [BEFORE, far, NO_DATA] })).toEqual([
      "page 1: the chart nothing prints its title 'Balance' nowhere above its empty text within its box",
    ])
  })

  // An empty chart prints its words once and draws nothing between them:
  // a gridline there is an axis drawn for no data.
  test('finds its words printed twice, and a chart paint between them', () => {
    expect(problemsOf([NOTHING], { ...NOTHING_READ, items: [...NOTHING_READ.items, run('No data', 126.957, 92.881, 28.086)] })).toContain(
      "page 1: the chart nothing prints 'No data' twice where its words stand",
    )
    expect(problemsOf([NOTHING], { ...NOTHING_READ, paths: [gridline(80, 40, 200)] })).toEqual([
      'page 1: the chart nothing paints stroke #d9d9d9 at 40, 80, 200 × 0 pt between its words',
    ])
  })

  // An empty chart's words are held as a drawn chart's are: across, and
  // in their faces.
  test('holds its words to their angle and their faces', () => {
    const faces = [
      { text: 'Balance', postScriptName: 'Roboto-Medium' },
      { text: 'No data', postScriptName: 'Roboto-Medium' },
    ]
    expect(problemsOf([{ ...NOTHING, faces }], NOTHING_READ)).toEqual([
      "page 1: the chart nothing prints 'No data' in Roboto-Regular; its face is Roboto-Medium",
    ])
    expect(problemsOf([NOTHING], { ...NOTHING_READ, items: [BEFORE, NOTHING_TITLE, { ...NO_DATA, angle: 90 }] })).toEqual([
      "page 1: the chart nothing prints 'No data' turned 90°; its words read across",
    ])
  })

  // An empty chart need not have a title; one whose title a heading above
  // it repeats is proved by the nearer run of it, its own.
  test('reads an empty chart with no title, and one under a heading of its title', () => {
    expect(problemsOf([{ ...NOTHING, words: ['No data'] }], NOTHING_READ)).toEqual([])
    const heading = run('Balance', 40, 20, 28.629, MEDIUM, 14)
    expect(problemsOf([NOTHING], { ...NOTHING_READ, items: [heading, ...NOTHING_READ.items] })).toEqual([])
  })

  // Two empty charts of the same words are two charts: each is proved by
  // runs of its own, so one printed does not pass both.
  test('proves each of two empty charts by runs of its own', () => {
    const again: ExpectedChart = { ...NOTHING, id: 'again' }
    // A page of its own holds runs of its own, as every page PDF.js reads does.
    const second: Drawn = { ...NOTHING_READ, items: NOTHING_READ.items.map((item) => ({ ...item })) }
    expect(problemsOf([NOTHING, again], NOTHING_READ, second)).toEqual([])
    expect(problemsOf([NOTHING, again], NOTHING_READ)).toEqual(["the chart again does not print its empty text 'No data'"])
  })

  // A chart whose only words print nothing proves nothing, and has nothing
  // to be found by.
  test('reads nothing of a chart with no word', () => {
    expect(problemsOf([{ ...NOTHING, words: [] }], { clips: [], paths: [], items: [BEFORE] })).toEqual([])
  })
})

describe("a chart's expectation", () => {
  // A value or a tick that is no decimal, or ticks that do not ascend
  // evenly, is a fixture's mistake, not the PDF's: the check says so
  // rather than prove a chart against an axis it cannot place.
  test.each([
    [
      'a value that is no decimal',
      { ...SALES, marks: [{ paint: '#1f77b4', values: ['1e3', null, '0'] }, SALES.marks[1]!] },
      "the expectation of the chart sales holds '1e3', which is no decimal",
    ],
    [
      'ticks that do not ascend evenly',
      { ...SALES, ticks: ['-5', '0', '5', '10', '16'].map((exact) => tick(exact)) },
      'the expectation of the chart sales has ticks that do not ascend in equal steps',
    ],
    ['a single tick', { ...SALES, ticks: [tick('0')] }, 'the expectation of the chart sales has ticks that do not ascend in equal steps'],
    [
      'a slice with no value',
      { ...SHARES, marks: [SHARES.marks[0]!, { paint: '#ff7f0e', values: [null] }, SHARES.marks[2]!] },
      'the expectation of the chart shares has a slice with no value',
    ],
    [
      'a pie of nothing',
      { ...SHARES, marks: SHARES.marks.map(({ paint }) => ({ paint, values: ['0'] })) },
      'the expectation of the chart shares is a pie of nothing, which is an empty chart',
    ],
  ] as const)('refuses %s', (_, chart, message) => {
    const read = chart.chart === 'pie' ? SHARES_READ : SALES_READ
    expect(() => problemsOf([chart], read)).toThrow(message)
  })
})
