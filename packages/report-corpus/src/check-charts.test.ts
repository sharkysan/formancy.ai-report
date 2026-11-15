import { describe, expect, test } from 'vitest'
import { chartProblems } from './check-charts.js'
import { outsidePrintable, overlaps } from './check-layout.js'
import { pagesOf, type Page } from './check-page.js'
import { placeDrawings } from './drawings.js'
import { expectation, type ExpectedChart, type ExpectedDrawing } from './fixture.js'
import type { PdfBox, PdfCurve, PdfPage, PdfPath, PdfTextItem, ReadPdf } from './read-pdf.js'

/**
 * A chart proved on the PDF it produced (0003, 0058): `chartProblems` held
 * to reads of charts as the renderer draws them, one right and the others
 * each wrong in the one way a check exists to see, each placed by
 * `placeDrawings`, as `verify` places them.
 *
 * The corpus cannot render a chart: report-render-pdf's tests depend on
 * it, so it depends on no renderer. Each read here is built by hand in the
 * shapes `readPdf` gives: those of charts `renderPdf` drew on 2026-11-13
 * (this branch at 8818a5a, ECharts 6.1.0, pdfjs-dist 6.4.299), each after
 * a 9 pt paragraph on the corpus's A4 page, read back by `readPdf` and
 * written here to the thousandth of a point. A path's subpaths are written
 * where the check reads them, a series' line's and a slice's, as they were
 * read; any other path's are its box's corners. To retake one, render the chart its
 * expectation describes with `renderPdf` from the renderer's `dist/` and
 * print `readPdf(bytes).pages[0]`'s clips, paths and items. Every run of a
 * real render is in its read, the paragraph's included, so that a check
 * reading anything it should not would fail the reads that are right;
 * 23b proves the check against the real renders of every fixture.
 */

const REGULAR = 'BZZZZZ+Roboto-Regular'
const MEDIUM = 'CZZZZZ+Roboto-Medium'

type Point = readonly [number, number]
const box = (x: number, top: number, width: number, height: number): PdfBox => ({ x, top, bottom: top + height, width, height })
/** A run read across the page, 8 pt as a chart's words print unless told otherwise. */
const run = (text: string, x: number, top: number, width: number, font = REGULAR, size = 8): PdfTextItem => ({
  text,
  ...box(x, top, width, size),
  angle: 0,
  font,
})
/** The corners of a box, a path's one subpath where its points are none of the check's business. */
const corners = (x: number, top: number, width: number, height: number): Point[][] => [
  [
    [x, top],
    [x + width, top],
    [x + width, top + height],
    [x, top + height],
  ],
]
/** A filled path: its box's corners, unless its subpaths are given, as a slice's are. */
const filled = (paint: `#${string}`, x: number, top: number, width: number, height: number, subpaths?: Point[][]): PdfPath => ({
  ...box(x, top, width, height),
  paint: 'fill',
  fill: paint,
  clip: 0,
  subpaths: subpaths ?? corners(x, top, width, height),
  curves: [],
})
/** A stroked path: a line across the page from its left to its right, unless its subpaths are given, as a series' line's are. */
const stroked = (paint: `#${string}`, x: number, top: number, width: number, height: number, subpaths?: Point[][]): PdfPath => ({
  ...box(x, top, width, height),
  paint: 'stroke',
  stroke: paint,
  clip: 0,
  subpaths: subpaths ?? [
    [
      [x, top],
      [x + width, top],
    ],
  ],
  curves: [],
})
/** A curve of a slice's arc as the test writes it: its two control points and its end, each across and down the page. */
type Arc = readonly [number, number, number, number, number, number]
/**
 * A pie's slice as the renderer draws it: one subpath from `start`
 * through each curve of its arc -- its two control points and its end,
 * which the reader writes as a curve and as a point -- and a line to
 * `centre`, where it draws one; a whole circle draws none.
 */
function sector(paint: `#${string}`, x: number, top: number, width: number, height: number, start: Point, arcs: readonly Arc[], centre?: Point): PdfPath {
  let from = start
  const curves = arcs.map(([ax, ay, bx, by, tx, ty]): PdfCurve => {
    const curve: PdfCurve = {
      from,
      through: [
        [ax, ay],
        [bx, by],
      ],
      to: [tx, ty],
    }
    from = curve.to
    return curve
  })
  return {
    ...box(x, top, width, height),
    paint: 'fill',
    fill: paint,
    clip: 0,
    subpaths: [[start, ...curves.map(({ to }) => to), ...(centre === undefined ? [] : [centre])]],
    curves,
  }
}
/** `path` moved `across` and `down` the page, its points and its curves with it. */
function shifted(path: PdfPath, across: number, down: number): PdfPath {
  const move = ([x, y]: Point): Point => [x + across, y + down]
  return {
    ...path,
    ...box(path.x + across, path.top + down, path.width, path.height),
    subpaths: path.subpaths.map((points) => points.map(move)),
    curves: path.curves.map(({ from, through: [a, b], to }) => ({ from: move(from), through: [move(a), move(b)], to: move(to) })),
  }
}
/** A legend's swatch: an 8 pt square filled and stroked in its colour. */
const swatch = (paint: `#${string}`, x: number, top: number): PdfPath => ({
  ...box(x, top, 8, 8),
  paint: 'fillStroke',
  fill: paint,
  stroke: paint,
  clip: 0,
  subpaths: corners(x, top, 8, 8),
  curves: [],
})
/** A gridline, stroked in the renderer's grid colour, `chart-option.ts`'s GRID; and the category axis's line, in its AXIS colour. */
const gridline = (top: number, x: number, width: number): PdfPath => stroked('#d9d9d9', x, top, width, 0)
const axisLine = (top: number, x: number, width: number): PdfPath => stroked('#000000', x, top, width, 0)
/** A tick as the runtime resolves one: its value exactly, and its label, the value itself unless told otherwise. */
const tick = (exact: string, text = exact): ExpectedChart['ticks'][number] => ({ exact, text })
/** The 9 pt paragraph above every chart here, which is no chart's. */
const BEFORE = run('Before', 40, 37.15, 26.38, REGULAR, 9)

/** What one page of a read draws. */
interface Drawn {
  readonly clips: readonly PdfBox[]
  readonly paths: readonly PdfPath[]
  readonly items: readonly PdfTextItem[]
}

/** The corpus's A4 page, 36 pt above and below and 40 pt at the sides. */
const NOTHING_ELSE_PAGE = { size: 'A4', orientation: 'portrait', margins: { top: 36, right: 40, bottom: 36, left: 40 } } as const
/** An expectation of no body, laid under the drawings a case places. */
const NOTHING_ELSE = expectation(
  {
    info: { title: 'Charts', creationDate: '2026-01-01T00:00:00Z' },
    page: NOTHING_ELSE_PAGE,
    pageHeader: [],
    pageFooter: [],
    body: [],
  },
  { maxPagesExpected: 5 },
)

/** A PDF of these pages, A4 each. */
function pdfOf(...drawn: readonly Drawn[]): ReadPdf {
  const read: PdfPage[] = drawn.map(({ clips, paths, items }, index) => ({ number: index + 1, width: 595.28, height: 841.89, items, images: [], paths, clips }))
  return { pages: read, fonts: [], attachments: [] }
}

/** What `verify` says of `charts` on these pages, `drawings` the body's in document order: where `placeDrawings` places them, and what `chartProblems` finds. */
function checked(charts: readonly ExpectedChart[], drawings: readonly ExpectedDrawing[], ...drawn: readonly Drawn[]): string[] {
  const pdf = pdfOf(...drawn)
  const placed = placeDrawings(pdf, { ...NOTHING_ELSE, drawings })
  return [...placed.problems, ...chartProblems(pdf, pagesOf(pdf, NOTHING_ELSE, placed), charts)]
}

/** A chart as a drawing, sought by its clip. */
const drawingOf = ({ id, width, height }: ExpectedChart): ExpectedDrawing => ({ kind: 'chart', id, width, height })

/** What `verify` says of `charts` on these pages, the body's drawings being the charts that draw something, in their order. */
function problemsOf(charts: readonly ExpectedChart[], ...drawn: readonly Drawn[]): string[] {
  return checked(charts, charts.filter(({ empty }) => !empty).map(drawingOf), ...drawn)
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
const PAID_LINE = stroked('#2ca02c', 210, 90.847, 60, 19.8, [
  [
    [210, 90.847],
    [270, 110.647],
  ],
])
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
const NORTH_SLICE = sector(
  '#1f77b4',
  67.8,
  65.647,
  144.45,
  144.463,
  [140, 65.647],
  [
    [154.286, 65.644, 168.252, 69.876, 180.133, 77.808],
    [192.015, 85.741, 201.278, 97.018, 206.751, 110.213],
    [212.22, 123.416, 213.65, 137.944, 210.861, 151.959],
    [208.072, 165.975, 201.19, 178.848, 191.084, 188.952],
    [180.978, 199.056, 168.104, 205.936, 154.088, 208.723],
    [140.072, 211.509, 125.544, 210.076, 112.342, 204.606],
    [99.15, 199.128, 87.878, 189.862, 79.949, 177.98],
    [72.021, 166.097, 67.793, 152.131, 67.8, 137.847],
  ],
  [140, 137.847],
)
const SOUTH_ARCS: readonly Arc[] = [
  [67.79, 118.694, 75.385, 100.321, 88.916, 86.766],
  [102.471, 73.233, 120.846, 65.637, 140, 65.647],
]
const SOUTH_SLICE = sector('#ff7f0e', 67.8, 65.647, 72.2, 72.2, [67.8, 137.847], SOUTH_ARCS, [140, 137.847])
/** What the renderer drew of the zero slice until 8818a5a, taken off its render at 7fa9028: a sector of no sweep, from the pie's centre to its rim at noon. */
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
    expect(problemsOf([SALES], sales({ clips: [] }))).toEqual([
      'the chart sales, 300 × 200 pt, is not drawn: no clip of its size holds a painted path',
      'the chart sales is proved by nothing: no clip of it was placed',
    ])
  })

  // A chart is proved where the walk that places drawings found it, and
  // a chart the walk was never asked to seek was found nowhere: skipped,
  // it was proved by nothing and said nothing, as an expectation that
  // sought no drawing for it once did (N3). It is said, whatever placed
  // it or did not.
  test('says of a chart nothing placed that it is proved by nothing', () => {
    expect(checked([SALES], [], SALES_READ)).toEqual(['the chart sales is proved by nothing: no clip of it was placed'])
  })

  // A clip an SVG image of the chart's size took before it is the
  // image's, and one that holds no paint is no drawing: the chart is not
  // found in either.
  test('takes no clip an SVG image took, nor one nothing is painted in', () => {
    expect(checked([SALES], [{ kind: 'image', width: 300, height: 200 }, drawingOf(SALES)], SALES_READ)).toEqual([
      'the chart sales, 300 × 200 pt, is not drawn: no clip of its size holds a painted path',
      'the chart sales is proved by nothing: no clip of it was placed',
    ])
    expect(problemsOf([SALES], sales({ paths: [] }))).toEqual([
      'the chart sales, 300 × 200 pt, has its clip at 40, 46.55 on page 1, and nothing painted inside it',
      'the chart sales is proved by nothing: no clip of it was placed',
    ])
  })

  // Charts are found in document order, each after the one before: the
  // second of two charts of one size takes the second clip, on the next
  // page, and a chart not found leaves the next to be sought from where
  // the one before it was.
  test('finds charts of one size in document order across pages', () => {
    expect(problemsOf([SALES, { ...SALES, id: 'again' }], SALES_READ, SALES_READ)).toEqual([])
    expect(problemsOf([SALES, { ...SALES, id: 'again' }, { ...SALES, id: 'third' }], SALES_READ, SALES_READ)).toEqual([
      'the chart third, 300 × 200 pt, is not drawn: no clip of its size holds a painted path',
      'the chart third is proved by nothing: no clip of it was placed',
    ])
  })

  // An SVG image and a chart are found in one walk, in document order: an
  // image of a chart's size after it, before it or beside it in a column
  // takes its own clip, never the chart's, and the chart never the
  // image's. The reads are the renderer's: the pie of 3, 1 and 2 and the
  // corpus's mark at 200 pt square, a spacer between them or a column
  // each. Walked out of document order, the image takes the chart's clip.
  test('places a chart and an SVG image of its size in document order, after, before and beside it', () => {
    const image: ExpectedDrawing = { kind: 'image', width: 200, height: 200 }
    const page = (pie: { paths: PdfPath[]; items: PdfTextItem[] }, mark: PdfPath[], clips: PdfBox[]): Drawn => ({
      clips,
      paths: [...pie.paths, ...mark].sort((a, b) => a.clip! - b.clip!),
      items: [BEFORE, ...pie.items],
    })
    const after = page(mixAt(40, 46.547, 0), markAt(40, 266.547, 1), [box(40, 46.547, 200, 200), box(40, 266.547, 200, 200)])
    const before = page(mixAt(40, 266.547, 1), markAt(40, 46.547, 0), [box(40, 46.547, 200, 200), box(40, 266.547, 200, 200)])
    const beside = page(mixAt(40, 46.547, 0), markAt(297.64, 46.547, 1), [box(40, 46.547, 200, 200), box(297.64, 46.547, 200, 200)])
    expect(checked([MIX], [drawingOf(MIX), image], after)).toEqual([])
    expect(checked([MIX], [image, drawingOf(MIX)], before)).toEqual([])
    expect(checked([MIX], [drawingOf(MIX), image], beside)).toEqual([])
    expect(checked([MIX], [image, drawingOf(MIX)], after)).toContain('page 1: the chart mix paints nothing of slice 1')
  })

  // The body's drawings are sought as its expectation lists them, SVG
  // images and charts in one walk (`drawingsOf`), and never from its
  // images besides: an expectation that sought the SVG images its images
  // list when it listed no drawing found no chart, and proved none (N3).
  test('seeks the drawings an expectation lists, and nothing its images list besides', () => {
    const read: PdfPage = {
      number: 1,
      width: 595.28,
      height: 841.89,
      items: [BEFORE],
      images: [],
      paths: markAt(40, 46.547, 0),
      clips: [box(40, 46.547, 200, 200)],
    }
    const pdf: ReadPdf = { pages: [read], fonts: [], attachments: [] }
    const images = [{ kind: 'vector', width: 200, height: 200 }] as const
    expect(placeDrawings(pdf, { ...NOTHING_ELSE, images, drawings: [] })).toEqual({ boxes: [[]], charts: [[]], problems: [] })
    expect(placeDrawings(pdf, { ...NOTHING_ELSE, images, drawings: [{ kind: 'image', width: 200, height: 200 }] })).toEqual({
      boxes: [[box(40, 46.547, 200, 200)]],
      charts: [[]],
      problems: [],
    })
  })

  // ECharts clips a series to its plot, and a path's clip is the innermost
  // (C14): a chart's marks painted in a clip set inside its box are its own.
  // No render has been seen to set one -- svg-to-pdfkit draws ECharts' clip
  // of a series as a soft mask, which sets no clip and which the reader
  // skips (`operators.ts`) -- so this read is doctored: the renderer's bars
  // moved into a clip of its plot, as a converter that drew the clip as a
  // clip would paint them.
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

describe('a chart among what else its page prints', () => {
  /** The pages `verify` reads of these, `charts` the body's drawings where they draw something. */
  const pagesFor = (charts: readonly ExpectedChart[], ...drawn: readonly Drawn[]): Page[] => {
    const pdf = pdfOf(...drawn)
    const expected = { ...NOTHING_ELSE, drawings: charts.filter(({ empty }) => !empty).map(drawingOf) }
    return pagesOf(pdf, expected, placeDrawings(pdf, expected))
  }
  /** `drawn` moved `across` the page, its clips, paths and runs with it. */
  const movedAcross = ({ clips, paths, items }: Drawn, across: number): Drawn => ({
    clips: clips.map((clip) => box(clip.x + across, clip.top, clip.width, clip.height)),
    paths: paths.map((path) => shifted(path, across, 0)),
    items: items.map((item) => ({ ...item, x: item.x + across })),
  })

  // A chart's box is a picture's to the page's checks: text printed over
  // its marks is hidden by them, and a box past a margin a printer cuts.
  // Its own words print inside it, and are the chart's check's to hold
  // (check 2): taken as text over the chart, every chart would fail.
  test('takes its box as a picture, which text other than its words overlaps', () => {
    expect(overlaps(pagesFor([SALES], SALES_READ), [SALES])).toEqual([])
    const over = run('Footnote', 120, 100, 40, REGULAR, 9)
    expect(overlaps(pagesFor([SALES], sales({ items: [...SALES_READ.items, over] })), [SALES])).toEqual([
      "page 1: the chart sales at 40, 46.55 overlaps 'Footnote' by 40 × 9 pt",
    ])
    // Its words are its own and no other chart's: one of them printed over another chart is text over that one.
    const other = { ...SALES, id: 'other', words: [] }
    expect(overlaps(pagesFor([other], SALES_READ), [other])).toContain("page 1: the chart other at 40, 46.55 overlaps 'Sales' by 19.6 × 8 pt")
  })

  // A chart drawn past the right margin is cut by a printer, though a
  // viewer shows it whole, and one at the page's foot over the footer
  // hides it: its box is held to the margins and the regions as an
  // image's is.
  test('holds its box inside the margins', () => {
    const past = movedAcross(SALES_READ, 260)
    expect(outsidePrintable(pagesFor([SALES], past), NOTHING_ELSE_PAGE)).toContain(
      'page 1: the chart sales at 300, 46.55 extends past the right margin (to 600 pt; the margin is at 555.28)',
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
      "page 1: the chart sales draws 4 gridlines in the grid's colour across its plot; its ticks are 5",
    ])
  })

  // The gridlines are the plot: one narrower is no gridline, since a
  // series' line in the grid's colour is narrower too; one beside the rest,
  // or out of step, is an axis that reads differently at one tick than at
  // the next.
  test('finds a gridline narrower than the plot, one beside it, and one out of step', () => {
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, SALES_GRID[3]!, gridline(122.047, 60, 200)) }))).toEqual([
      "page 1: the chart sales draws 4 gridlines in the grid's colour across its plot; its ticks are 5",
    ])
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, SALES_GRID[3]!, gridline(122.047, 70, 280)) }))).toContain(
      'page 1: the chart sales draws its gridline of tick 4 from 70 to 350 pt across; its lowest from 60 to 340',
    )
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

  // A tick's middle as the reader boxes it stands 0.0418 em below its
  // gridline in Roboto (`LINE_OFFSET`), past EDGE at 14 pt: a check that
  // held it to EDGE alone would fail the renderer's ticks at that size.
  test("allows a tick label the reader's offset from its line", () => {
    const large = { ...TICK_5, ...box(47.496, 139.047 + 0.0418 * 14 - 7, 4.496, 14) }
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, TICK_5, large) }))).toEqual([])
  })

  // A tick's label stands at its gridline, its value rising up the page:
  // a label moved off its gridline labels another height.
  test('finds a tick label away from its gridline', () => {
    const moved = { ...TICK_5, ...box(47.496, 110, 4.496, 8) }
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, TICK_5, moved) }))).toEqual([
      "page 1: the chart sales prints tick '5' with its middle at 114 pt down the page, 25.05 from its gridline at 139.05",
      "page 1: the chart sales prints tick '10' no higher than tick '5'",
    ])
    // 3 pt off still crosses its gridline, and labels a height 3 pt from its tick's; 0.33 pt is Roboto's own offset at 8 pt (`LINE_OFFSET`).
    const off = { ...TICK_5, ...box(47.496, 138.381, 4.496, 8) }
    expect(problemsOf([SALES], sales({ items: replaced(SALES_READ.items, TICK_5, off) }))).toEqual([
      "page 1: the chart sales prints tick '5' with its middle at 142.38 pt down the page, 3.33 from its gridline at 139.05",
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

  // Two series' bars drawn over each other show one value where two
  // stand, each in its slot and of its length.
  test('finds two bars over each other', () => {
    const over = filled('#ff7f0e', 69.3, 105.047, 33.2, 51)
    expect(problemsOf([SALES], sales({ paths: replaced(SALES_READ.paths, ACTUAL_NORTH, over) }))).toEqual([
      'page 1: the chart sales draws the bars of series 1 at category 1 and series 2 at category 1 over each other',
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
      'page 1: the chart balance draws 1 line of series 2; its values make no stretch of two or more, which ECharts draws as none',
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

  // A line series paints its markers, its line and its swatch: a path in
  // its colour painted any other way is no part of a chart.
  test("finds a path of a line's colour that is none of its marks", () => {
    const outlined: PdfPath = { ...filled('#2ca02c', 150, 120, 4, 4), paint: 'fillStroke', stroke: '#000000' }
    expect(problemsOf([BALANCE], balance({ paths: [...BALANCE_READ.paths, outlined] }))).toEqual([
      'page 1: the chart balance paints fill #2ca02c and stroke #000000 at 150, 120, 4 × 4 pt, which is no part of a chart',
    ])
  })

  // A marker in its category's slot but off its middle stands for another
  // place along the axis, which on a line is another time.
  test("finds a marker off its category's middle", () => {
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_JAN, filled('#2ca02c', 93, 128.347, 4, 4)) }))).toEqual([
      'page 1: the chart balance draws the marker of series 1 at category 1 at 95, 130.35; its value stands at 90, 130.45',
    ])
  })

  // ECharts draws a series' line as one path, a subpath for each stretch of
  // two values or more (measured): a line joined across the gap has the
  // box of the line drawn either side of it, and shows a value the series
  // does not have. Both reads are the renderer's line of 1, 2, -, 3, 2,
  // the second with its two parts joined into one.
  test('passes a line drawn in a part for each stretch, and finds one joined across its gap', () => {
    const two: ExpectedChart = {
      id: 'two',
      chart: 'line',
      width: 300,
      height: 160,
      words: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      ticks: ['0', '1', '2', '3'].map((exact) => tick(exact)),
      marks: [{ paint: '#1f77b4', values: ['1', '2', null, '3', '2'] }],
      faces: [],
      empty: false,
    }
    const parts: Point[][] = [
      [
        [83.9, 142.047],
        [140.8, 97.047],
      ],
      [
        [254.6, 52.047],
        [311.5, 97.047],
      ],
    ]
    const line = stroked('#1f77b4', 83.9, 52.047, 227.6, 90, parts)
    const read: Drawn = {
      clips: [box(40, 46.547, 300, 160)],
      paths: [
        ...[187.047, 142.047, 97.047, 52.047].map((top) => gridline(top, 55.5, 284.5)),
        axisLine(187.047, 55.5, 284.5),
        line,
        filled('#1f77b4', 81.949, 139.947, 4, 4),
        filled('#1f77b4', 138.85, 94.947, 4, 4),
        filled('#1f77b4', 252.651, 49.947, 4, 4),
        filled('#1f77b4', 309.552, 94.947, 4, 4),
      ],
      items: [
        BEFORE,
        run('Jan', 77.355, 196.069, 13.184),
        run('Feb', 134.31, 196.069, 13.074),
        run('Mar', 190.725, 196.069, 14.047),
        run('Apr', 248.438, 196.069, 12.422),
        run('May', 304.018, 196.069, 15.063),
        ...['0', '1', '2', '3'].map((text, index) => run(text, 43, 183.381 - 45 * index, 4.496)),
      ],
    }
    expect(problemsOf([two], read)).toEqual([])
    const joined = stroked('#1f77b4', 83.9, 52.047, 227.6, 90, [parts.flat()])
    expect(problemsOf([two], { ...read, paths: replaced(read.paths, line, joined) })).toEqual([
      'page 1: the chart two draws its line of series 1 in 1 part; its values make 2 stretches of two or more',
    ])
  })

  // A line that does not run through its points shows other values than
  // its series has; a series with a stretch of values and no line hides it.
  test('finds a line off its points, and one missing', () => {
    const off = stroked('#2ca02c', 210, 90.847, 60, 25, [
      [
        [210, 90.847],
        [270, 115.847],
      ],
    ])
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_LINE, off) }))).toEqual([
      'page 1: the chart balance draws part 1 of its line of series 1 through 210, 90.85; 270, 115.85; its values from category 3 to 4 stand at 210, 90.85; 270, 110.65',
    ])
    expect(problemsOf([BALANCE], balance({ paths: replaced(BALANCE_READ.paths, PAID_LINE) }))).toEqual([
      'page 1: the chart balance draws 0 lines of series 1; its values make 1 stretch of two or more, which ECharts draws as one line',
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
        stroked('#9467bd', 167.2, 86.047, 88.5, 66, [
          [
            [167.2, 152.047],
            [255.7, 86.047],
          ],
        ]),
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

describe('a series in any colour', () => {
  // The renderer's charts of one series over three months, its values 1, 3
  // and 2 or 2, 2 and 2 on ticks 0 to 3, drawn in one geometry whatever
  // their colour: only the series' paths differ between them.
  const plain = (chart: 'bar' | 'line', paint: string, values: readonly string[]): ExpectedChart => ({
    id: 'plain',
    chart,
    width: 260,
    height: 160,
    words: ['Jan', 'Feb', 'Mar'],
    categories: ['Jan', 'Feb', 'Mar'],
    ticks: ['0', '1', '2', '3'].map((exact) => tick(exact)),
    marks: [{ paint, values }],
    faces: [],
    empty: false,
  })
  const read = (series: readonly PdfPath[]): Drawn => ({
    clips: [box(40, 46.547, 260, 160)],
    paths: [...[187.047, 142.047, 97.047, 52.047].map((top) => gridline(top, 55.5, 244.5)), axisLine(187.047, 55.5, 244.5), ...series],
    items: [
      BEFORE,
      run('Jan', 89.655, 196.069, 13.184),
      run('Feb', 171.211, 196.069, 13.074),
      run('Mar', 252.226, 196.069, 14.047),
      ...['0', '1', '2', '3'].map((text, index) => run(text, 43, 183.381 - 45 * index, 4.496)),
    ],
  })
  const line = (paint: `#${string}`, [a, b, c]: readonly number[]): PdfPath[] => [
    stroked(paint, 96.2, Math.min(a!, b!, c!), 163, Math.max(a!, b!, c!) - Math.min(a!, b!, c!), [
      [
        [96.2, a!],
        [177.7, b!],
        [259.2, c!],
      ],
    ]),
    filled(paint, 94.249, a! - 2.1, 4, 4),
    filled(paint, 175.751, b! - 2.1, 4, 4),
    filled(paint, 257.252, c! - 2.1, 4, 4),
  ]
  const bars = (paint: `#${string}`): PdfPath[] => [
    filled(paint, 63.6, 142.047, 65.2, 45),
    filled(paint, 145.1, 52.047, 65.2, 135),
    filled(paint, 226.6, 97.047, 65.2, 90),
  ]

  // The validator admits any colour for a series, the grid's and the
  // axis's among them: a black line is the commonest a person picks, and
  // a check that took its stroke for the axis's line, or a grey line flat
  // on a tick for its gridline, would fail the renderer's charts of them.
  test.each([
    ['a black line', plain('line', '#000000', ['1', '3', '2']), line('#000000', [142.047, 52.047, 97.047])],
    ['a grey line', plain('line', '#d9d9d9', ['1', '3', '2']), line('#d9d9d9', [142.047, 52.047, 97.047])],
    ['a grey line flat on a tick', plain('line', '#d9d9d9', ['2', '2', '2']), line('#d9d9d9', [97.047, 97.047, 97.047])],
    ['black bars', plain('bar', '#000000', ['1', '3', '2']), bars('#000000')],
    ['grey bars', plain('bar', '#d9d9d9', ['1', '3', '2']), bars('#d9d9d9')],
  ] as const)('passes %s as the renderer draws it', (_, chart, series) => {
    expect(problemsOf([chart], read(series))).toEqual([])
  })

  // The grid and the axis are still known by where they stand: a grey
  // line of the series' moved off its points is the series' to answer
  // for, never a gridline gone missing.
  test("holds a series' line in the grid's colour to its points", () => {
    expect(problemsOf([plain('line', '#d9d9d9', ['2', '2', '2'])], read(line('#d9d9d9', [97.047, 97.047, 92])))).toEqual([
      'page 1: the chart plain draws the marker of series 1 at category 3 at 259.25, 91.9; its value stands at 259.25, 97.05',
      'page 1: the chart plain draws part 1 of its line of series 1 through 96.2, 97.05; 177.7, 97.05; 259.2, 92; its values from category 1 to 3 stand at 96.25, 97.05; 177.75, 97.05; 259.25, 97.05',
    ])
  })
})

/** A pie of three slices, 3, 1 and 2, as the renderer drew it in a box whose clip is at `x`, `top`, its paths in clip `clip`. */
const MIX: ExpectedChart = {
  id: 'mix',
  chart: 'pie',
  width: 200,
  height: 200,
  words: ['Shares', 'S1 3', 'S2 1', 'S3 2'],
  categories: [],
  ticks: [],
  marks: [
    { paint: '#1f77b4', values: ['3'] },
    { paint: '#ff7f0e', values: ['1'] },
    { paint: '#2ca02c', values: ['2'] },
  ],
  faces: [],
  empty: false,
}
/** The renderer's slices of the pie of 3, 1 and 2 at 200 pt, its clip at 40, 46.547: each arc in its quarter turns or less, about the pie's centre. */
const MIX_SLICES: readonly PdfPath[] = [
  sector(
    '#1f77b4',
    140,
    65.647,
    80.938,
    161.8,
    [140, 65.647],
    [
      [161.459, 65.647, 182.041, 74.169, 197.218, 89.34],
      [212.396, 104.51, 220.928, 125.087, 220.938, 146.547],
      [220.928, 168.006, 212.396, 188.583, 197.218, 203.754],
      [182.041, 218.925, 161.459, 227.447, 140, 227.447],
    ],
    [140, 146.547],
  ),
  sector(
    '#ff7f0e',
    69.9,
    146.547,
    70.1,
    80.9,
    [140, 227.447],
    [
      [125.8, 227.458, 111.847, 223.734, 99.542, 216.647],
      [87.235, 209.552, 77.012, 199.344, 69.9, 187.047],
    ],
    [140, 146.547],
  ),
  sector(
    '#2ca02c',
    59.05,
    65.647,
    80.95,
    121.4,
    [69.9, 187.047],
    [
      [62.792, 174.74, 59.05, 160.779, 59.05, 146.568],
      [59.05, 132.356, 62.792, 118.395, 69.9, 106.089],
      [84.366, 81.055, 111.087, 65.639, 140, 65.647],
    ],
    [140, 146.547],
  ),
]
function mixAt(x: number, top: number, clip = 0): { paths: PdfPath[]; items: PdfTextItem[] } {
  const at = (path: PdfPath): PdfPath => ({ ...shifted(path, x - 40, top - 46.547), clip })
  return {
    paths: [
      ...MIX_SLICES.map(at),
      swatch('#1f77b4', x + 48.785, top + 186.312),
      swatch('#ff7f0e', x + 85.762, top + 186.312),
      swatch('#2ca02c', x + 122.738, top + 186.312),
    ].map((path) => ({ ...path, clip })),
    items: [
      run('Shares', x + 87.621, top + 6.022, 24.758, MEDIUM),
      run('S1 3', x + 61.785, top + 186.647, 15.727),
      run('S2 1', x + 98.762, top + 186.647, 15.727),
      run('S3 2', x + 135.738, top + 186.647, 15.727),
    ],
  }
}

/** The corpus's SVG mark drawn 200 pt square, `contain`, as the renderer drew it in a box whose clip is at `x`, `top`, its paths in clip `clip`. */
const markAt = (x: number, top: number, clip: number): PdfPath[] =>
  [
    filled('#1f4e79', x + 6.667, top + 6.667, 186.667, 186.667),
    stroked('#ffffff', x + 46.667, top + 53.333, 106.667, 50, [
      [
        [x + 46.667, top + 103.333],
        [x + 100, top + 53.333],
        [x + 153.333, top + 103.333],
      ],
    ]),
    filled('#ffffff', x + 76.667, top + 90, 46.667, 70),
  ].map((path) => ({ ...path, clip }))

describe("a pie's slices", () => {
  // A slice is the sector its share makes, from noon and clockwise: two
  // slices whose colours are swapped print the legend's words beside the
  // other's sector, and paint every path once. The read is the renderer's
  // pie of 3, 1 and 2, the second with its first and third slices'
  // colours swapped.
  test("passes each slice in its share's sector, and finds two whose paints are swapped", () => {
    const { paths, items } = mixAt(40, 46.547)
    const read: Drawn = { clips: [box(40, 46.547, 200, 200)], paths, items: [BEFORE, ...items] }
    expect(problemsOf([MIX], read)).toEqual([])
    const [first, , third] = paths as [PdfPath, PdfPath, PdfPath]
    const swapped = replaced(replaced(paths, first, { ...first, fill: '#2ca02c' }), third, { ...third, fill: '#1f77b4' })
    expect(problemsOf([MIX], { ...read, paths: swapped })).toEqual([
      "page 1: the chart mix paints slice 1 from 69.9, 187.05 to 140, 65.65 round 140, 146.55; its share's sector runs from 140, 65.63 to 140, 227.47 round 140, 146.55",
      "page 1: the chart mix paints slice 3 from 140, 65.65 to 140, 227.45 round 140, 146.55; its share's sector runs from 69.92, 187.01 to 140, 65.63 round 140, 146.55",
    ])
  })

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
    // The slice of 999 parts in 10^20 as the renderer drew it until 8818a5a, and the slice of 1000 as it draws it, no arc and a line to the centre.
    const [least, less] = [filled('#ff7f0e', 120, 46.547, 0, 70.5), sector('#2ca02c', 120, 46.547, 0, 70.5, [120, 46.547], [], [120, 117.047])]
    const read: Drawn = {
      clips: [box(40, 46.547, 160, 160)],
      paths: [
        // All but 10^-17 of the pie: a whole circle, split where zrender rounds a point, its arcs written again on the pie's circle, and no centre.
        sector(
          '#1f77b4',
          49.535,
          46.547,
          140.934,
          140.938,
          [120, 46.547],
          [
            [138.386, 46.547, 156.043, 53.733, 169.205, 66.57],
            [182.366, 79.408, 189.989, 96.882, 190.447, 115.262],
            [190.905, 133.642, 184.161, 151.473, 171.654, 164.95],
            [159.148, 178.427, 141.87, 186.482, 123.507, 187.397],
            [105.144, 188.312, 87.151, 182.014, 73.366, 169.847],
            [59.582, 157.68, 51.099, 140.608, 49.728, 122.273],
            [48.37, 103.946, 54.225, 85.814, 66.045, 71.743],
            [77.865, 57.671, 94.714, 48.773, 113, 46.947],
            [114.162, 46.814, 115.326, 46.709, 116.493, 46.634],
            [117.661, 46.576, 118.83, 46.547, 120, 46.547],
          ],
        ),
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

  // A slice is held by every point of its outline (N1): a slice whose arc
  // runs round the other side of its centre -- its ends and its apex where
  // its sector's are, as a flipped arc flag draws its complement -- covers
  // the slices beside it; a second wedge in its path paints another share;
  // a slice whose outline runs back past its centre paints its neighbours';
  // and a slice with its arc removed is a triangle. Each is the renderer's
  // pie of 3, 1 and 2 with one slice so changed.
  test('finds a slice drawn round the other side of its centre, one in two parts, one reaching past its centre, and one with no arc', () => {
    const { paths, items } = mixAt(40, 46.547)
    const read = (slice: number, path: PdfPath): Drawn => ({
      clips: [box(40, 46.547, 200, 200)],
      paths: replaced(paths, paths[slice]!, path),
      items: [BEFORE, ...items],
    })
    const [first, second, third] = paths as [PdfPath, PdfPath, PdfPath]
    const flip = ([x, y]: Point): Point => [280 - x, 293.094 - y]
    const outline = first.subpaths[0]!
    const keep = (point: Point): Point => (point === outline[0] || point === outline.at(-2) ? point : flip(point))
    const mirrored: PdfPath = {
      ...first,
      subpaths: [[outline[0]!, ...outline.slice(1, -2).map(flip), outline.at(-2)!, outline.at(-1)!]],
      curves: first.curves.map(({ from, through: [a, b], to }) => ({ from: keep(from), through: [flip(a), flip(b)], to: keep(to) })),
    }
    expect(problemsOf([MIX], read(0, mirrored))).toEqual([
      "page 1: the chart mix paints slice 1 through 59.06, 146.55, 80.94 pt outside its share's sector from 140, 65.63 to 140, 227.47 round 140, 146.55",
    ])
    const wedged: PdfPath = {
      ...second,
      subpaths: [
        ...second.subpaths,
        [
          [60, 60],
          [70, 60],
          [65, 70],
        ],
      ],
    }
    expect(problemsOf([MIX], read(1, wedged))).toEqual(['page 1: the chart mix paints slice 2 in 2 parts, where a slice is one'])
    // An outline that runs back past its centre, to the top of the pie, paints into its neighbours' though every point stands on a line its sweep's edge runs along.
    const [start, middle, ...rest] = second.subpaths[0]!
    const reaching: PdfPath = { ...second, subpaths: [[start!, middle!, [140, 100], ...rest]] }
    expect(problemsOf([MIX], read(1, reaching))).toEqual([
      "page 1: the chart mix paints slice 2 through 140, 100, 46.55 pt outside its share's sector from 140, 227.47 to 69.92, 187.01 round 140, 146.55",
    ])
    const arcless: PdfPath = { ...third, subpaths: [[third.subpaths[0]![0]!, third.subpaths[0]!.at(-2)!, third.subpaths[0]!.at(-1)!]], curves: [] }
    expect(problemsOf([MIX], read(2, arcless))).toEqual(['page 1: the chart mix paints slice 3 with no arc, where its arc is 169.48 pt long'])
  })

  // A slice drawn on another circle than the pie's bulges past its
  // neighbours or falls short of them: each end of its curves stands on
  // the pie's circle. The renderer's first slice of 3, 1 and 2, its first
  // curve's end pushed 2 pt out along its ray, its next curve's start with
  // it.
  test("finds a slice whose arc leaves the pie's circle", () => {
    const { paths, items } = mixAt(40, 46.547)
    const first = paths[0]!
    const pushed = (point: Point): Point => (point[0] === 197.218 && point[1] === 89.34 ? [198.632, 87.926] : point)
    const bulging: PdfPath = {
      ...first,
      subpaths: first.subpaths.map((points) => points.map(pushed)),
      curves: first.curves.map(({ from, through, to }) => ({ from: pushed(from), through, to: pushed(to) })),
    }
    expect(problemsOf([MIX], { clips: [box(40, 46.547, 200, 200)], paths: replaced(paths, first, bulging), items: [BEFORE, ...items] })).toEqual([
      "page 1: the chart mix paints slice 1's arc through 198.63, 87.93, 82.91 pt from the pie's centre at 140, 146.55; its radius is 80.92",
    ])
  })

  // An arc may leave its circle between its curves' ends, which stand on
  // it: a curve whose control points are pushed out bulges past the
  // circle into the page beside the pie, one swung across noon paints
  // into its neighbour's sector, and one whose control points lie on its
  // chord cuts the slice short by a flat edge (M-A). Each curve is held
  // at points a quarter of a point apart along it. A notch of straight
  // lines between a slice's ends, one through a point at half the radius,
  // is held at that point (M-B). Each is the renderer's pie of 3, 1 and
  // 2, one of its slices doctored, its ends and its centre kept.
  test("finds a slice's arc that leaves its circle or its sector between its curves' ends", () => {
    const { paths, items } = mixAt(40, 46.547)
    const read = (slice: number, path: PdfPath): Drawn => ({
      clips: [box(40, 46.547, 200, 200)],
      paths: replaced(paths, paths[slice]!, path),
      items: [BEFORE, ...items],
    })
    const [first, second, third] = paths as [PdfPath, PdfPath, PdfPath]
    const centre: Point = [140, 146.547]
    /** `point` moved `by` out from the pie's centre. */
    const out =
      (by: number) =>
      ([x, y]: Point): Point => {
        const away = Math.hypot(x - centre[0], y - centre[1])
        return [centre[0] + ((x - centre[0]) * (away + by)) / away, centre[1] + ((y - centre[1]) * (away + by)) / away]
      }
    const bulged: PdfPath = { ...second, curves: second.curves.map(({ from, through: [a, b], to }) => ({ from, through: [out(4)(a), out(4)(b)], to })) }
    expect(problemsOf([MIX], read(1, bulged))).toEqual([
      "page 1: the chart mix paints slice 2's arc through 80.58, 205.83, 83.94 pt from the pie's centre at 140, 146.55; its radius is 80.92",
    ])
    // The curve of the third slice that ends at noon, its control points pulled across noon into the first slice's sweep.
    const last = third.curves.at(-1)!
    const swung: PdfPath = {
      ...third,
      curves: [
        ...third.curves.slice(0, -1),
        {
          ...last,
          through: [
            [last.through[0][0] + 40, last.through[0][1] - 10],
            [last.through[1][0] + 40, last.through[1][1]],
          ],
        },
      ],
    }
    expect(problemsOf([MIX], read(2, swung))).toEqual([
      "page 1: the chart mix paints slice 3 through 142.47, 66.09, 2.47 pt outside its share's sector from 69.92, 187.01 to 140, 65.63 round 140, 146.55",
    ])
    // Its second curve's control points on the line between that curve's ends.
    const [, chord] = first.curves as [PdfCurve, PdfCurve]
    const along = (t: number): Point => [chord.from[0] + (chord.to[0] - chord.from[0]) * t, chord.from[1] + (chord.to[1] - chord.from[1]) * t]
    const flattened: PdfPath = {
      ...first,
      curves: first.curves.map((curve) => (curve === chord ? { ...curve, through: [along(1 / 3), along(2 / 3)] } : curve)),
    }
    expect(problemsOf([MIX], read(0, flattened))).toEqual([
      "page 1: the chart mix paints slice 1's arc through 209.08, 117.94, 74.77 pt from the pie's centre at 140, 146.55; its radius is 80.92",
    ])
    // Its two middle curves taken out for two lines through a point at half its radius, its outer two kept.
    const outline = first.subpaths[0]!
    const [c0, c1, c2, c3] = first.curves as [PdfCurve, PdfCurve, PdfCurve, PdfCurve]
    const inner: Point = [centre[0] + (c1.to[0] - centre[0]) / 2, centre[1] + (c1.to[1] - centre[1]) / 2]
    const notched: PdfPath = { ...first, subpaths: [[outline[0]!, c0.to, inner, c2.to, c3.to, outline.at(-1)!]], curves: [c0, c3] }
    expect(problemsOf([MIX], read(0, notched))).toEqual([
      "page 1: the chart mix paints slice 1's arc through 180.47, 146.55, 40.47 pt from the pie's centre at 140, 146.55; its radius is 80.92",
    ])
  })

  // A slice drawn in no part, or as one point, paints nothing of its share
  // where it is counted as painted (N5): it is said, never skipped.
  test('finds a slice drawn in no part, and one drawn as a single point', () => {
    const { paths, items } = mixAt(40, 46.547)
    const second = paths[1]!
    const read = (path: PdfPath): Drawn => ({ clips: [box(40, 46.547, 200, 200)], paths: replaced(paths, second, path), items: [BEFORE, ...items] })
    expect(problemsOf([MIX], read({ ...second, subpaths: [], curves: [] }))).toEqual(['page 1: the chart mix paints slice 2 in no part, where a slice is one'])
    expect(problemsOf([MIX], read({ ...second, subpaths: [[second.subpaths[0]![0]!]], curves: [] }))).toEqual([
      'page 1: the chart mix paints slice 2 as a single point',
    ])
  })

  // A sliver whose arc is shorter than a tenth's diagonal may draw no curve,
  // its ends rounded into one point, or a hair out to the circle and back;
  // a slice near half a turn printed off its circle before the renderer
  // wrote its arcs again; and a pie of one slice has no centre to read but
  // its box's. Each is the renderer's pie at e0a8637, and passes.
  test('passes a pie of 9999 and 1, one of 45, 2 and 44, and one of one slice', () => {
    const pie = (id: string, size: number, values: readonly string[], words: readonly string[]): ExpectedChart => ({
      id,
      chart: 'pie',
      width: size,
      height: size,
      words: ['Shares', ...words],
      categories: [],
      ticks: [],
      marks: values.map((value, index) => ({ paint: (['#1f77b4', '#ff7f0e', '#2ca02c'] as const)[index]!, values: [value] })),
      faces: [],
      empty: false,
    })
    const sliver: Drawn = {
      clips: [box(40, 46.547, 160.23, 160.23)],
      paths: [
        sector(
          '#1f77b4',
          59.063,
          65.647,
          122.105,
          122.067,
          [120.1, 65.647],
          [
            [136.286, 65.643, 151.81, 72.066, 163.262, 83.505],
            [174.713, 94.944, 181.154, 110.461, 181.167, 126.647],
            [181.171, 142.839, 174.743, 158.37, 163.296, 169.822],
            [151.85, 181.274, 136.322, 187.71, 120.13, 187.714],
            [103.938, 187.718, 88.407, 181.29, 76.955, 169.843],
            [65.503, 158.396, 59.066, 142.869, 59.063, 126.677],
            [59.068, 110.491, 65.501, 94.97, 76.947, 83.526],
            [88.393, 72.082, 103.914, 65.651, 120.1, 65.647],
          ],
          [120.1, 126.647],
        ),
        // 0.038 pt of arc: a hair out to the circle and back.
        sector(
          '#ff7f0e',
          120.1,
          65.609,
          0,
          61.037,
          [120.1, 65.647],
          [
            [120.1, 65.634, 120.1, 65.622, 120.1, 65.609],
            [120.1, 65.622, 120.1, 65.634, 120.1, 65.647],
          ],
          [120.1, 126.647],
        ),
        swatch('#1f77b4', 80.644, 193.089),
        swatch('#ff7f0e', 131.109, 193.089),
      ],
      items: [BEFORE, run('Shares', 107.736, 52.569, 24.758, MEDIUM), run('S1 9999', 93.644, 193.424, 29.215), run('S2 1', 144.109, 193.424, 15.727)],
    }
    expect(problemsOf([pie('sliver', 160.23, ['9999', '1'], ['S1 9999', 'S2 1'])], sliver)).toEqual([])
    const wide: Drawn = {
      clips: [box(40, 46.547, 300, 300)],
      paths: [
        sector(
          '#1f77b4',
          190,
          65.647,
          130.938,
          261.8,
          [190, 65.647],
          [
            [224.331, 65.647, 257.288, 79.13, 281.775, 103.192],
            [306.262, 127.255, 320.319, 159.972, 320.918, 194.297],
            [321.519, 228.636, 308.604, 261.836, 284.957, 286.742],
            [261.31, 311.648, 228.824, 326.267, 194.5, 327.447],
          ],
          [190, 196.547],
        ),
        sector(
          '#ff7f0e',
          176.5,
          196.547,
          18,
          130.959,
          [194.5, 327.447],
          [
            [191.496, 327.537, 188.49, 327.523, 185.487, 327.407],
            [182.484, 327.29, 179.487, 327.07, 176.5, 326.747],
          ],
          [190, 196.547],
        ),
        sector(
          '#2ca02c',
          59.064,
          65.647,
          130.936,
          261.1,
          [176.5, 326.747],
          [
            [143.129, 323.287, 112.359, 307.15, 90.539, 281.665],
            [68.72, 256.18, 57.515, 223.291, 59.237, 189.786],
            [60.979, 156.281, 75.516, 124.723, 99.848, 101.624],
            [124.179, 78.524, 156.45, 65.646, 190, 65.647],
          ],
          [190, 196.547],
        ),
        swatch('#1f77b4', 134.289, 332.859),
        swatch('#ff7f0e', 175.762, 332.859),
        swatch('#2ca02c', 212.738, 332.859),
      ],
      items: [
        BEFORE,
        run('Shares', 177.621, 52.569, 24.758, MEDIUM),
        run('S1 45', 147.289, 333.194, 20.223),
        run('S2 2', 188.762, 333.194, 15.727),
        run('S3 44', 225.738, 333.194, 20.223),
      ],
    }
    expect(problemsOf([pie('wide', 300, ['45', '2', '44'], ['S1 45', 'S2 2', 'S3 44'])], wide)).toEqual([])
    const whole: Drawn = {
      clips: [box(40, 46.547, 200, 200)],
      paths: [
        sector(
          '#1f77b4',
          59.065,
          65.643,
          161.873,
          161.841,
          [140, 65.647],
          [
            [161.108, 65.647, 181.382, 73.893, 196.497, 88.627],
            [211.612, 103.361, 220.373, 123.417, 220.912, 144.518],
            [221.441, 165.626, 213.701, 186.105, 199.343, 201.586],
            [184.984, 217.067, 165.145, 226.324, 144.057, 227.383],
            [122.969, 228.441, 102.302, 221.216, 86.466, 207.251],
            [70.63, 193.285, 60.878, 173.684, 59.291, 152.629],
            [57.713, 131.578, 64.422, 110.744, 77.986, 94.57],
            [91.55, 78.395, 110.897, 68.16, 131.9, 66.047],
            [133.245, 65.901, 134.593, 65.789, 135.943, 65.711],
            [137.295, 65.656, 138.647, 65.634, 140, 65.647],
          ],
        ),
        swatch('#1f77b4', 125.762, 232.859),
      ],
      items: [BEFORE, run('Shares', 127.621, 52.569, 24.758, MEDIUM), run('S1 5', 138.762, 233.194, 15.727)],
    }
    expect(problemsOf([pie('whole', 200, ['5'], ['S1 5'])], whole)).toEqual([])
  })

  // A slice whose apex stands aside of the others' is a wedge with a kink,
  // whatever its arc: the pie of 3, 1 and 2, its second slice's last point,
  // the centre, 1.05 pt aside, which moves the slices' mean a third of that.
  test('finds a slice about another centre than the others', () => {
    const { paths, items } = mixAt(40, 46.547)
    const second = paths[1]!
    const aside = { ...second, subpaths: [[...second.subpaths[0]!.slice(0, -1), [141.05, 146.547] as const]] }
    expect(problemsOf([MIX], { clips: [box(40, 46.547, 200, 200)], paths: replaced(paths, second, aside), items: [BEFORE, ...items] })).toEqual([
      "page 1: the chart mix paints slice 2 from 140, 227.45 to 69.9, 187.05 round 141.05, 146.55; its share's sector runs from 140.35, 227.57 to 70.18, 187.06 round 140.35, 146.55",
    ])
  })

  // A slice drawn twice is a share drawn twice; a slice whose arc ends
  // elsewhere, or about another centre, is another share than its own. The
  // pie's centre is its slices' mean, so of two slices 2 pt apart each is
  // a point from it, and both are named: two cannot say which is wrong.
  test('finds a slice drawn twice, one ending elsewhere, and one about another centre', () => {
    expect(problemsOf([SHARES], shares({ paths: [...SHARES_READ.paths, SOUTH_SLICE] }))).toEqual(['page 1: the chart shares paints slice 2 in 2 paths'])
    const short = sector('#ff7f0e', 67.8, 65.647, 72.2, 72.2, [67.8, 137.847], [SOUTH_ARCS[0]!, [102.471, 73.233, 120.846, 65.637, 130, 66.3]], [140, 137.847])
    expect(problemsOf([SHARES], shares({ paths: replaced(SHARES_READ.paths, SOUTH_SLICE, short) }))).toEqual([
      "page 1: the chart shares paints slice 2 from 67.8, 137.85 to 130, 66.3 round 140, 137.85; its share's sector runs from 67.79, 137.85 to 140, 65.64 round 140, 137.85",
    ])
    const aside = { ...SOUTH_SLICE, subpaths: [[...SOUTH_SLICE.subpaths[0]!.slice(0, -1), [142, 137.847] as const]] }
    expect(problemsOf([SHARES], shares({ paths: replaced(SHARES_READ.paths, SOUTH_SLICE, aside) }))).toEqual([
      "page 1: the chart shares paints slice 1 from 140, 65.65 to 67.8, 137.85 round 140, 137.85; its share's sector runs from 141, 65.14 to 68.3, 137.85 round 141, 137.85",
      "page 1: the chart shares paints slice 2 from 67.8, 137.85 to 140, 65.65 round 142, 137.85; its share's sector runs from 68.3, 137.85 to 141, 65.14 round 141, 137.85",
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

  // An empty chart stands after the chart drawn before it in its flow,
  // the body or its column (`ExpectedChart.after`): its words printed only
  // before that chart are some other text's, and do not pass for it.
  test('seeks an empty chart after the chart drawn before it in its flow', () => {
    const following: ExpectedChart = { ...NOTHING, after: 'sales' }
    expect(problemsOf([NOTHING, SALES], NOTHING_READ, SALES_READ)).toEqual([])
    expect(problemsOf([SALES, following], NOTHING_READ, SALES_READ)).toEqual([
      "the chart nothing does not print its empty text 'No data' after the chart drawn before it",
    ])
    // On the drawn chart's page, its words above the drawn chart's box stand before it.
    const lower = mixAt(40, 266.547)
    const page: Drawn = { clips: [box(40, 266.547, 200, 200)], paths: lower.paths, items: [BEFORE, NOTHING_TITLE, NO_DATA, ...lower.items] }
    expect(problemsOf([NOTHING, MIX], page)).toEqual([])
    expect(problemsOf([MIX, { ...NOTHING, after: 'mix' }], page)).toEqual([
      "the chart nothing does not print its empty text 'No data' after the chart drawn before it",
    ])
    // Below the drawn chart on its page, they stand after it.
    const upper = mixAt(40, 46.547)
    const below = [
      { ...NOTHING_TITLE, top: 270, bottom: 278 },
      { ...NO_DATA, top: 310, bottom: 318 },
    ]
    expect(
      problemsOf([MIX, { ...NOTHING, after: 'mix' }], { clips: [box(40, 46.547, 200, 200)], paths: upper.paths, items: [BEFORE, ...upper.items, ...below] }),
    ).toEqual([])
  })

  // An empty chart in a later column than a drawn chart may stand higher
  // than it: the column it stands in has no chart drawn before it, and its
  // words are sought on the page the page breaks before it leave it. The
  // read is the renderer's: the pie of 3, 1 and 2 under a 100 pt spacer in
  // the first column, the empty chart in the second.
  test('seeks an empty chart with no chart drawn before it in its column anywhere after its page breaks', () => {
    const pie = mixAt(40, 146.547)
    const read: Drawn = {
      clips: [box(40, 146.547, 200, 200)],
      paths: pie.paths,
      items: [BEFORE, ...pie.items, run('Balance', 383.326, 52.569, 28.629, MEDIUM), run('No data', 383.597, 92.881, 28.086)],
    }
    expect(problemsOf([MIX, NOTHING], read)).toEqual([])
    // After a page break, its words on the page before stand before it.
    expect(problemsOf([MIX, { ...NOTHING, breaks: 1 }], read)).toEqual([
      "the chart nothing does not print its empty text 'No data' after the page break before it",
    ])
    expect(problemsOf([{ ...NOTHING, breaks: 2 }], { clips: [], paths: [], items: [BEFORE] }, { clips: [], paths: [], items: [BEFORE] }, NOTHING_READ)).toEqual(
      [],
    )
    expect(problemsOf([{ ...NOTHING, breaks: 3 }], NOTHING_READ)).toEqual([
      "the chart nothing does not print its empty text 'No data' after the 3 page breaks before it",
    ])
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
