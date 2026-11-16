import { RenderRefusal, type Chart } from '@formancy/report-runtime'
import type { ChartLayout } from './chart-option.js'
import type { PlacedWord } from './chart-svg.js'

/**
 * Where a chart's words may stand (0058): inside its box, apart from each
 * other, and, but for a value's label, out of its plot. pdfmake prints
 * every word where it is placed, so a word past the box would print over
 * what stands beside the chart, and two that meet one over the other: the
 * chart is refused, naming it and its box, and quoting no word. The one
 * statement of the rule, for a chart ECharts laid out (`chart-draw.ts`)
 * and one with nothing to draw, whose title and empty text the renderer
 * places itself (`chart-empty.ts`). It imports nothing of ECharts, so
 * that a document whose only chart is empty loads none.
 */

/** What a refusal of `chart` starts with: its id and its box. */
export const named = (chart: Chart): string => `the chart ${chart.id}, ${String(chart.width)} by ${String(chart.height)} points, `

/** A refusal of `chart` whose content does not fit, saying what it `has`. */
export function tooLarge(chart: Chart, has: string): never {
  throw new RenderRefusal('content-too-large', `${named(chart)}${has}`, chart.id)
}

/** `size` points, to the hundredth, as a refusal says it. */
export const points = (size: number): string => String(Math.round(size * 100) / 100)

/** A plot, or a pie's square, in points from the chart's top left. */
export type Plot = NonNullable<ChartLayout['plot']>

/** What a box is to the rules: a word's, a plot's or a pie's square, from the chart's top left. */
interface Box {
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Whether `a` and `b` overlap: boxes that share an edge do not meet. */
const meet = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.top < b.top + b.height && b.top < a.top + a.height

/**
 * `words`, of `chart`, on `plot` where it has one, refused where a word
 * stands past the box, a word but a value's label stands in the plot, or
 * two words meet; returned as they are otherwise.
 */
export function held(chart: Chart, words: readonly PlacedWord[], plot?: Plot): readonly PlacedWord[] {
  const past = ({ x, top, width, height }: PlacedWord): boolean => x < 0 || top < 0 || x + width > chart.width || top + height > chart.height
  if (words.some(past)) tooLarge(chart, 'has a word that would leave its box')
  if (plot !== undefined) {
    const area: Box = { x: plot.left, top: plot.top, width: plot.width, height: plot.height }
    if (words.some((word) => !word.key.startsWith('value/') && meet(word, area))) tooLarge(chart, 'has a word that would stand in its plot')
  }
  if (words.some((word, index) => words.slice(index + 1).some((other) => meet(word, other)))) tooLarge(chart, 'has two words that would meet')
  return words
}
