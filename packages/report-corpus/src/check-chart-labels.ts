import { heightAt, LINE_OFFSET, markKey, slotAt, type Axes } from './check-chart-marks.js'
import { decimalOf, painted, type ChartRead } from './check-chart-read.js'
import { EDGE, points, quoted } from './check-page.js'
import type { PdfPath, PdfTextItem } from './read-pdf.js'

/**
 * A chart's legend and its values' labels held to the marks they name
 * (0058): the words of each are held by check 2 to print once inside the
 * box, and here to where they print, so that a legend naming each series
 * by another's colour, or a value printed at another bar, is seen. A
 * legend is a chart's only key from a colour to what it names, a pie's
 * only key from a slice to its category; a value's label is a number the
 * report prints.
 *
 * - **A legend's entry** is its swatch, a square filled and stroked in
 *   its paint, one of it, and its words, the nearest run right of the
 *   swatch on its row, `LEGEND_GAP` from it. A swatch no entry names is
 *   said too: a legend drawn where the chart has none, or an entry drawn
 *   twice.
 * - **A value's label** is centred across on its mark -- a bar, or a
 *   line's marker -- and stands `LABEL_DISTANCE` beyond its value's end:
 *   above a bar's end, or below it for a value below zero, which at the
 *   lowest tick sets it between the plot's foot and the categories' labels
 *   (Task 21); above a line's marker. Of the runs of its text that are
 *   no tick's label, the one nearest where it stands is taken, each once.
 *
 * What it rests on, measured on 2026-11-15 on the renderer's draws (at
 * e0a8637) of the chart fixtures (`fixtures/charts.ts`), and of
 * `chart-bars`, `chart-line`, `chart-markup` and `chart-pie` again at 6
 * and 14 pt in Roboto, at 8 in Liberation Mono and at 11 in Liberation
 * Serif (`chart-bars` at 14 pt refused, its words meeting):
 * - every legend entry's words stood 5.000 pt right of its swatch, 38 of
 *   them, which ECharts 6.1.0 sets, their middle 0.034 em above to 0.042
 *   below the swatch's, the reader's offset (`LINE_OFFSET`);
 * - every label's middle stood within 0.071 pt across of its bar's, 70 of
 *   them, and within 0.041 of its marker's, 25;
 * - ECharts sets a label's line `LABEL_DISTANCE` beyond its mark's end,
 *   and the reader boxes a run inside its line (`read-pdf.ts`), by the
 *   face's descent less a fifth of its size above it, by its ascent less
 *   four fifths below: the box stood 0.007 to 0.100 of the size farther
 *   above a bar or a marker, 0.033 to 0.128 farther below a bar
 *   (`LABEL_INSET` allows 0.15). A face whose ascent or descent stands
 *   farther from those, which 0043's line admits, would be read as a
 *   label off its mark.
 *
 * What it does not see: a label is known by its text, so two of one text
 * whose places are swapped are each where one of them belongs, and pass.
 */

/** Points: how far right of its swatch a legend entry's words start, ECharts' own, measured. */
const LEGEND_GAP = 5

/** Points: how far beyond its mark's end a value's label stands, `chart-option.ts`'s VALUE_LABEL_DISTANCE, which report-render-pdf's `corpus.test.ts` holds it to. */
export const LABEL_DISTANCE = 5

/** Of the size: how far past `LABEL_DISTANCE` the reader's box of a label may stand, the face's share of the line the reader does not box. */
const LABEL_INSET = 0.15

/** A run's middle down the page. */
const middle = (box: { readonly top: number; readonly bottom: number }): number => (box.top + box.bottom) / 2

/**
 * Each legend entry of the chart: its one swatch in its paint, and its
 * words the nearest run right of it on its row, `LEGEND_GAP` from it; and
 * every swatch some entry's.
 */
export function legendProblems(read: ChartRead): string[] {
  const { expected, say } = read
  const swatches = read.paths.filter((path) => path.paint === 'fillStroke' && expected.marks.some(({ paint }) => painted(path, 'fillStroke', paint)))
  const claimed = new Set<PdfPath>()
  const problems = expected.legend.flatMap(({ text, paint }, index) => {
    const entry = `legend entry ${index + 1}`
    const own = swatches.filter((path) => painted(path, 'fillStroke', paint))
    for (const path of own) claimed.add(path)
    const [swatch] = own
    if (swatch === undefined) return [say(`draws no swatch of ${entry} in its colour ${paint}`)]
    if (own.length > 1) return [say(`draws ${String(own.length)} swatches of ${entry} in its colour ${paint}`)]
    if (text === '') return []
    const right = swatch.x + swatch.width
    const [beside] = read.items
      .filter((item) => item.x >= right - EDGE && Math.abs(middle(item) - middle(swatch)) <= EDGE + LINE_OFFSET * item.height)
      .sort((a, b) => a.x - b.x)
    if (beside === undefined) return [say(`prints nothing beside the swatch of ${entry}, which names ${quoted(text)}`)]
    if (beside.text !== text) return [say(`prints ${quoted(beside.text)} beside the swatch of ${entry}, which names ${quoted(text)}`)]
    const gap = beside.x - right
    return Math.abs(gap - LEGEND_GAP) <= EDGE
      ? []
      : [say(`prints ${quoted(text)} ${points(gap)} pt right of the swatch of ${entry}; its words start ${String(LEGEND_GAP)} pt from it`)]
  })
  return [
    ...problems,
    ...swatches.filter((path) => !claimed.has(path)).map((path) => say(`draws a swatch at ${points(path.x)}, ${points(path.top)}, which is no legend entry's`)),
  ]
}

/**
 * Each labelled value's label: of the runs of its text that are no tick's
 * label, `words`, the nearest where it stands, each taken once; centred
 * across on its mark, or in its slot where none is drawn -- a zero, which
 * ECharts may draw along zero or not at all -- and `LABEL_DISTANCE`
 * beyond its value's end: above a bar's, below it for a value below zero,
 * above a line's marker. A label none of its runs prints is check 2's to
 * say, and a marker none is drawn of the line check's.
 */
export function labelProblems(
  read: ChartRead,
  { plot, place, marks }: Required<Pick<Axes, 'plot' | 'place' | 'marks'>>,
  words: readonly PdfTextItem[],
): string[] {
  const { expected, say } = read
  const used = new Set<PdfTextItem>()
  return expected.marks.flatMap(({ values, labels = [] }, series) =>
    labels.flatMap((label, category) => {
      const value = values[category]
      if (label === null || value === null || value === undefined) return []
      const mark = marks.get(markKey(series, category))
      if (expected.chart === 'line' && mark === undefined) return []
      const below = expected.chart === 'bar' && decimalOf(value, expected).units < 0n
      const end = mark !== undefined && expected.chart === 'line' ? mark.top : heightAt(plot, place(value))
      const [left, right] = slotAt(plot, expected, category)
      const across = mark === undefined ? (left + right) / 2 : mark.x + mark.width / 2
      const edgeOf = below ? (item: PdfTextItem): number => item.top : (item: PdfTextItem): number => item.bottom
      const wanted = below ? end + LABEL_DISTANCE : end - LABEL_DISTANCE
      const away = (item: PdfTextItem): number => Math.hypot(item.x + item.width / 2 - across, edgeOf(item) - wanted)
      const [run] = words
        .filter((item) => item.text === label && !used.has(item))
        .map((item) => ({ item, by: away(item) }))
        .sort((a, b) => a.by - b.by)
        .map(({ item }) => item)
      if (run === undefined) return []
      used.add(run)
      const of = `series ${String(series + 1)} at category ${String(category + 1)}`
      const what = expected.chart === 'line' ? 'marker' : 'bar'
      const centred = run.x + run.width / 2
      const gap = below ? run.top - end : end - run.bottom
      return [
        ...((mark === undefined ? centred >= left - EDGE && centred <= right + EDGE : Math.abs(centred - across) <= EDGE)
          ? []
          : [
              say(
                `prints the label ${quoted(label)} of ${of} centred at ${points(centred)} pt across; ${mark === undefined ? `its slot runs from ${points(left)} to ${points(right)}` : `its ${what} is centred at ${points(across)}`}`,
              ),
            ]),
        ...(gap >= LABEL_DISTANCE - EDGE && gap <= LABEL_DISTANCE + EDGE + LABEL_INSET * run.height
          ? []
          : [
              say(
                `prints the label ${quoted(label)} of ${of} from ${points(run.top)} to ${points(run.bottom)} pt down the page; it stands ${String(LABEL_DISTANCE)} pt ${below ? 'below' : 'above'} its ${what === 'marker' ? 'marker' : "value's end"} at ${points(end)}`,
              ),
            ]),
      ]
    }),
  )
}
