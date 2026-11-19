import type { Chart } from '@formancy/report-runtime'
import type { DocxFonts } from './fonts.js'
import { ONE_CELL_TABLE } from './limits.js'
import { BLACK, CHART_TEXT_SIZE } from './look.js'
import { emptyLine, SEPARATOR, type BlockNode, type ParagraphNode, type RelationshipId } from './nodes.js'
import { twips } from './units.js'

/**
 * A chart in a Word file (0076): Word's own chart, a part of the file
 * that the body draws inline in exactly the chart's box, stated from the
 * runtime's block alone (`chart-xml.ts`) -- every word the block gives
 * it, each value's digits as the block holds them, the axis the block's
 * ticks, every colour the block's. Nothing of it is laid out here: where
 * a word stands is Word's.
 *
 * A chart with nothing to draw is no chart of Word's, which would draw
 * an empty plot and has no place for the words the PDF prints in its
 * stead: it is its box, a cell as wide as the chart and at least as
 * tall, never exactly, so that Word cuts no word of it, in a row that
 * does not split across pages, and in the
 * middle of it the chart's title, bold, and its empty text, each centred.
 *
 * This module holds what the check, the count and the two writings of a
 * chart share: which of its words print, and what they are set in.
 */

/** What a chart's word is set in: every property stated, since a chart's part inherits nothing from the document. */
export interface ChartFace {
  readonly family: string
  /** Points. */
  readonly size: number
  readonly bold: boolean
  readonly italic: boolean
  /** Lower-case `#rrggbb`. */
  readonly color: string
}

/**
 * `text` as a chart prints it: trimmed of the whitespace at either end,
 * as the PDF prints it, and undefined where nothing is left -- a word
 * that prints nothing is no word, and its slot, a category's or a legend
 * entry's, stays.
 */
export function printed(text: string | undefined): string | undefined {
  const word = text?.trim()
  return word === undefined || word === '' ? undefined : word
}

/** The face `chart`'s words are set in, and its title's: its style's token, size, slant and colour, the title bold. */
export function chartFaces(chart: Chart, fonts: DocxFonts): { readonly words: ChartFace; readonly title: ChartFace } {
  const style = chart.style ?? {}
  const words = {
    family: fonts.family(style.font),
    size: style.size ?? CHART_TEXT_SIZE,
    bold: style.bold ?? false,
    italic: style.italic ?? false,
    color: style.color ?? BLACK,
  }
  return { words, title: { ...words, bold: true } }
}

/** One word a chart may print, by where it stands in the block, for a refusal that quotes none. */
export interface ChartWord {
  readonly where: string
  /** As the block holds it: a document made by hand may hold what is no text. */
  readonly text: unknown
  /** Whether it prints in the title's face. */
  readonly title: boolean
  /** How often a Word file states it: a category's label once for each series that names it, and a tick's label never, which Word writes from the number. */
  readonly times: number
}

/**
 * Every word `chart` holds that a chart prints, in the order the PDF
 * renderer reads them: its title, its axes' titles, each category's
 * label, each tick's, each value's where the chart labels them and it has
 * one, each legend entry and its empty text.
 */
export function chartWords(chart: Chart): ChartWord[] {
  const named = `the chart ${chart.id}`
  const words: ChartWord[] = []
  const add = (where: string, text: unknown, title = false, times = 1): void => {
    if (text !== undefined) words.push({ where: `${where} of ${named}`, text, title, times })
  }
  add('the title', chart.title, true)
  if (chart.chart !== 'pie') {
    add("the category axis's title", chart.categoryTitle)
    add("the value axis's title", chart.valueTitle)
    chart.categories.forEach((text, index) => {
      add(`category ${index}`, text, false, Math.max(1, chart.series.length))
    })
    chart.ticks.forEach((tick, index) => {
      add(`tick ${index}`, tick.text, false, 0)
    })
    if (chart.valueLabels)
      chart.series.forEach(({ values }, series) => {
        values.forEach((each, index) => {
          if (each !== null) add(`the value of series ${series} at category ${index}`, each.text)
        })
      })
  }
  chart.legend.forEach(({ text }, index) => {
    add(`legend entry ${index}`, text)
  })
  add('the empty text', chart.empty)
  return words
}

/**
 * What `chart` is of the file's paragraphs, characters and runs
 * (`limits.ts`), and how often it names its family, each time as long as
 * a run does (`check.ts`'s `family`). Drawn, a paragraph, its inline
 * chart's, and the characters of every word its part states, as often as
 * it states it, with every digit of its numbers; with nothing to draw, a table of one cell and a
 * paragraph of one run for each of its two words that prints.
 */
export function chartCount(chart: Chart): { readonly paragraphs: number; readonly characters: number; readonly runs: number; readonly families: number } {
  const lengths = chartWords(chart).flatMap(({ text, times }) => {
    const word = times > 0 && typeof text === 'string' ? printed(text) : undefined
    return word === undefined ? [] : [word.length * times]
  })
  const said = lengths.reduce((total, each) => total + each, 0)
  if (chart.empty !== undefined) return { paragraphs: ONE_CELL_TABLE + lengths.length, characters: said, runs: lengths.length, families: 2 * lengths.length }
  // A number's digits are written as they are, however many: counted with the words, so that the characters bound what a chart's part holds.
  const numbers = chart.chart === 'pie' ? chart.slices.map(({ value }) => value) : [...chart.ticks, ...chart.series.flatMap(({ values }) => values)]
  const characters = numbers.reduce((total, each) => total + (each === null ? 0 : each.exact.length), said)
  // Each word the part states names the family once, and so do the defaults of the chart, its two axes, its legend and each series' labels.
  const series = chart.chart === 'pie' ? 1 : chart.series.length
  return { paragraphs: 1, characters, runs: 0, families: lengths.length + 4 + series }
}

/** What draws a chart: the relationship, in the body's part, of the part it becomes, and its number among the file's drawings. */
export interface ChartParts {
  readonly part: (chart: Chart) => RelationshipId
  readonly next: () => number
}

/** The nodes `chart` is written as. */
export function chartNodes(chart: Chart, fonts: DocxFonts, parts: ChartParts): BlockNode[] {
  if (chart.empty === undefined) {
    const drawn = { id: parts.next(), width: chart.width, height: chart.height, part: parts.part(chart) }
    return [{ kind: 'paragraph', runs: [{ kind: 'chart', chart: drawn }], mark: undefined, keepNext: false, keepLines: false }]
  }
  const faces = chartFaces(chart, fonts)
  const line = (text: string | undefined, face: ChartFace): ParagraphNode[] => {
    const word = printed(text)
    if (word === undefined) return []
    return [
      {
        kind: 'paragraph',
        runs: [{ kind: 'text', text: word, style: face }],
        mark: { family: face.family, size: face.size },
        align: 'center',
        keepNext: false,
        keepLines: false,
      },
    ]
  }
  const words = [...line(chart.title, faces.title), ...line(chart.empty, faces.words)]
  const width = twips(chart.width)
  // At least the chart's height, never exactly: a row of an exact height cuts what does not fit it, and the words' lines are Word's.
  // And whole: the PDF reserves the box on one page, and a row that may split would break it across two.
  const row = { cantSplit: true, height: chart.height, grows: true as const }
  return [
    {
      kind: 'table',
      grid: [width],
      padding: { x: 0, y: 0 },
      rows: [{ ...row, cells: [{ width, align: 'center', content: words.length === 0 ? [emptyLine(SEPARATOR)] : words }] }],
    },
  ]
}
