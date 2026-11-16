import { EDGE, points, quoted } from './check-page.js'
import type { ExpectedChart } from './fixture.js'
import type { PdfBox, PdfPage, PdfPath, PdfTextItem } from './read-pdf.js'

/**
 * A drawn chart as the chart checks read it (`check-charts.ts`), and what
 * they share: how a path is painted, how far apart two boxes are, and the
 * runtime's decimals worked out exactly, `Number` applied to a quotient
 * alone, to make a coordinate.
 */

/** A drawn chart as its page shows it. */
export interface ChartRead {
  readonly expected: ExpectedChart
  readonly page: PdfPage
  /** Its clip's box: the chart's box on the page. */
  readonly box: PdfBox
  /** The paths painted in its clip and in the clips set inside it. */
  readonly paths: readonly PdfPath[]
  /** The runs of text that meet its box. */
  readonly items: readonly PdfTextItem[]
  /** A problem of the chart: `what` after its page and its name. */
  readonly say: (what: string) => string
}

/** Points two boxes of a chart's -- its words, its bars -- may share both ways before they meet: PDF.js reads where each stands to far less, and the renderer refuses any two words that meet (`chart-held.ts`). */
export const MEET = 0.01

export const near = (a: number, b: number): boolean => Math.abs(a - b) <= EDGE

/** Whether `inner` lies inside `outer`, give or take `EDGE`. */
export const within = (inner: PdfBox, outer: PdfBox): boolean =>
  inner.x >= outer.x - EDGE && inner.x + inner.width <= outer.x + outer.width + EDGE && inner.top >= outer.top - EDGE && inner.bottom <= outer.bottom + EDGE

/** Whether `a` and `b` share more than `by` both across and down. */
export const meet = (a: PdfBox, b: PdfBox, by: number): boolean =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > by && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > by

/** How many times a word prints, as a problem says it. */
export const times = (count: number): string => (count === 1 ? 'once' : count === 2 ? 'twice' : `${String(count)} times`)

/** Whether `path` is painted `paint` in `colour` alone: a swatch, filled and stroked, in it both ways. */
export function painted(path: PdfPath, paint: PdfPath['paint'], colour: string): boolean {
  const same = (each: string | undefined): boolean => each?.toLowerCase() === colour.toLowerCase()
  if (path.paint !== paint) return false
  if (paint === 'fillStroke') return same(path.fill) && same(path.stroke)
  return same(paint === 'fill' ? path.fill : path.stroke)
}

/** Whether `path` is painted in `colour`, filled, stroked or both. */
export const inPaint = (path: PdfPath, colour: string): boolean => [path.fill, path.stroke].some((paint) => paint?.toLowerCase() === colour.toLowerCase())

/** A path as a problem names it: how it is painted, in what, and its box. */
export function described(path: PdfPath): string {
  const paint = [path.fill === undefined ? [] : [`fill ${path.fill}`], path.stroke === undefined ? [] : [`stroke ${path.stroke}`]].flat().join(' and ')
  return `${paint} at ${points(path.x)}, ${points(path.top)}, ${points(path.width)} × ${points(path.height)} pt`
}

/** Each path of `read` that `named` does not name, as a problem. */
export function unnamed(read: ChartRead, named: (path: PdfPath) => boolean): string[] {
  return read.paths.filter((path) => !named(path)).map((path) => read.say(`paints ${described(path)}, which is no part of a chart`))
}

/** A decimal as the runtime writes one (`ChartValue.exact`): its units, and how many of its digits are places. */
export interface Decimal {
  readonly units: bigint
  readonly scale: number
}

export function decimalOf(exact: string, chart: ExpectedChart): Decimal {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(exact)
  if (match === null) throw new Error(`the expectation of the chart ${chart.id} holds ${quoted(exact)}, which is no decimal`)
  const [, sign = '', whole = '', fraction = ''] = match
  const units = BigInt(whole + fraction)
  return { units: sign === '-' ? -units : units, scale: fraction.length }
}

/** `value`'s units at `scale`, as many places as its own or more. */
export const unitsAt = (value: Decimal, scale: number): bigint => value.units * 10n ** BigInt(scale - value.scale)

/** The parts the check works a quotient out to before `Number` makes it a coordinate. */
const PLACE_UNIT = 10n ** 17n

/** `numerator / denominator`, the denominator above 0, as a double: its whole part exactly and the rest to `PLACE_UNIT`. */
export const quotient = (numerator: bigint, denominator: bigint): number =>
  Number(numerator / denominator) + Number(((numerator % denominator) * PLACE_UNIT) / denominator) / Number(PLACE_UNIT)
