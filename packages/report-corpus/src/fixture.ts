import { faceKey, readFont, type ResolvedFonts } from '@formancy/report-runtime'
import type {
  BaselineShift,
  Block,
  Chart,
  ChartValue,
  EpcQrCode,
  Image,
  Inline,
  Paragraph,
  RefusalCode,
  ResolvedDocument,
  Table,
  TableRow,
} from './document.js'

/**
 * A fixture is a document an engine must render, or refuse, and what the PDF
 * it renders must show. Every expectation is derived from the document's own
 * data by the functions below, never typed a second time, so the two cannot
 * drift apart.
 */
export interface Fixture {
  /** Stable, kebab-case; the trial's results are keyed by it. */
  readonly id: string
  readonly title: string
  readonly document: ResolvedDocument
  /** Passed to the engine as its page limit. */
  readonly maxPages: number
  readonly expect: Expectation
}

export interface ExpectedRefusal {
  readonly code: RefusalCode
  /** The asset, table or block the refusal must name, when it is about one. */
  readonly subject?: string
}

/** A cell that prints: its text as a line of extracted text has it, and its column, from 0. */
export interface ExpectedCell {
  readonly column: number
  readonly text: string
}

/** One table row as the document holds it. */
export interface ExpectedRow {
  readonly kind: TableRow['kind']
  /** Its first cell, which the row is found by; empty when the row has none, and then it cannot be found. */
  readonly key: string
  /** Its cells that print, in column order. */
  readonly cells: readonly ExpectedCell[]
  /**
   * A group header's: how many of the rows after it start on its page,
   * the number its document row keeps (0059); absent where the row keeps
   * none, and the header is then held only to not ending its page. A
   * fixture states fewer where a page cannot hold that many.
   */
  readonly keepWithRows?: number
}

export interface ExpectedTable {
  readonly id: string
  /** The header row's cells, which stand above the table's first line on every page the table reaches. */
  readonly header: readonly string[]
  readonly rows: readonly ExpectedRow[]
  /** What prints under the header in place of detail rows when there are none; empty when there are some. */
  readonly emptyText: string
}

/**
 * An image's size on the page, in points, and how it is drawn: a PNG or a
 * JPEG as an image the PDF embeds, an SVG as vectors, painted inside a clip
 * of its box (0030).
 */
export interface ExpectedImage {
  readonly kind: 'raster' | 'vector'
  readonly width: number
  readonly height: number
}

/**
 * A drawing in the body: what is painted inside a clip of its box, and
 * found by that clip (`drawings.ts`) -- an SVG image (0030), or a chart
 * ECharts drew (0058), known by its id.
 */
export type ExpectedDrawing =
  | { readonly kind: 'image'; readonly width: number; readonly height: number }
  | { readonly kind: 'chart'; readonly id: string; readonly width: number; readonly height: number }

/** A series or a slice of a chart (`ExpectedChart.marks`). */
export interface ExpectedMark {
  readonly paint: string
  readonly values: readonly (string | null)[]
  /** Present where the chart labels its values: one per value, the text its label prints, null where it prints none. */
  readonly labels?: readonly (string | null)[]
}

/** A run of text and the PostScript name of the face it must print in (0043), after any subset prefix. */
export interface ExpectedFontName {
  readonly text: string
  readonly postScriptName: string
}

/**
 * A chart in the body as its PDF must show it (0058), from the runtime's
 * block: its box, every word it prints, and each of its series' or slices'
 * colour and values, which the check holds its marks to
 * (`check-charts.ts`). A word that prints nothing -- a label empty once
 * trimmed -- is no word, and nothing could prove it printed (0058).
 */
export interface ExpectedChart {
  readonly id: string
  readonly chart: Chart['chart']
  /** Points: the box the chart is drawn in. */
  readonly width: number
  readonly height: number
  /**
   * Every word but a tick's, each printed once inside the box: a word the
   * list holds twice prints twice. Its title, its axes' titles, each
   * category's label, each value's where the chart labels them and each
   * legend entry; an empty chart's title, where it prints one, then its
   * empty text.
   */
  readonly words: readonly string[]
  /** A bar or a line chart's category labels, in order, '' where one prints nothing; a pie's none, since its legend entries hold them. */
  readonly categories: readonly string[]
  /** Each tick, lowest first, its value exactly, which places the axis, and its label: the chart prints every k-th label from the lowest, which the layout chooses. */
  readonly ticks: readonly ChartValue[]
  /**
   * A bar or a line chart's series, each its colour and its values exactly
   * (`ChartValue.exact`), one per category, null where it has none, and,
   * where the chart labels its values, the text each value's label prints,
   * null where it prints none; a pie's slices, each its colour and its one
   * value, whose label prints in its legend entry alone.
   */
  readonly marks: readonly ExpectedMark[]
  /** Its legend's entries, in order, each its words as PDF.js extracts them -- '' where they print nothing -- and the paint of what it names, its swatch's; none where it has no legend. */
  readonly legend: readonly { readonly text: string; readonly paint: string }[]
  /** The face each of its words prints in, ticks included, by the face's PostScript name after any subset prefix: its token's host face, or Roboto's where the sans token maps none. */
  readonly faces: readonly ExpectedFontName[]
  /** Whether it has nothing to draw: its words are then all it prints. */
  readonly empty: boolean
  /**
   * A chart with nothing to draw has no box to be found by, and its words
   * are sought after the chart that draws something before it in its own
   * flow -- the body, or the column it stands in, through sections and
   * keep-together blocks -- by that chart's id, where there is one.
   */
  readonly after?: string
  /** Where no chart is drawn before it in its flow: how many page breaks stand before it, its words being sought on the pages after them. */
  readonly breaks?: number
}

/**
 * What page 1 shows of its page regions where the document gives page 1 a
 * header of its own (0060), in place of what every other page shows.
 */
export interface ExpectedFirstPage {
  /** Page 1's own header's lines without page fields, in place of `pageHeaderLines` on page 1. */
  readonly headerLines: readonly string[]
  /** Page 1's own header's images and the page footer's, in place of `pageRegionImages` on page 1. */
  readonly regionImages: readonly ExpectedImage[]
  /** Page 1's own header's runs set below or above the line and the page footer's, in place of `pageRegionShiftedRuns` on page 1 (0061). */
  readonly shiftedRuns: readonly ExpectedShiftedRun[]
}

/**
 * A run the document sets below or above the line (0061): its text as one
 * run of extracted text has it, which way it is set, and its paragraph's
 * size where the paragraph states one, which it prints at `SHIFTED_SIZE`
 * of; absent, the engine's default size, which the corpus does not know.
 */
export interface ExpectedShiftedRun {
  readonly text: string
  readonly shift: BaselineShift
  readonly size?: number
}

export interface Expectation {
  /** `render-or-refuse`: either a PDF that passes every check, or this refusal. */
  readonly outcome: 'render' | 'refuse' | 'render-or-refuse'
  /** Present exactly when the outcome allows a refusal. */
  readonly refusal?: ExpectedRefusal
  /**
   * Each occurs exactly once across the pages, in this order, reading pages
   * in turn and each page top to bottom, left to right. A key is matched as
   * whole words: `ROW-0001` is not found in `ROW-00010`.
   */
  readonly keys: readonly string[]
  /**
   * Every table, each row's cells printed in column order on the line its key
   * begins -- or, for a row that wraps, top-aligned on that line and
   * continued below it -- and the header above the table on every page.
   */
  readonly tables: readonly ExpectedTable[]
  /** The page header's lines without page fields: each a line of its own on every page that prints the page header, above all of the body. */
  readonly pageHeaderLines: readonly string[]
  /** Present exactly when the document gives page 1 a header of its own, none among them (0060): page 1's regions, which page 1 alone shows. */
  readonly firstPage?: ExpectedFirstPage
  /** The page footer's lines without page fields: each a line of its own on every page, below all of the body. */
  readonly pageFooterLines: readonly string[]
  /**
   * A line every page has, below all of the body. A named group `pageNumber`
   * must capture the page's number and `pageCount` the number of pages.
   */
  readonly footerEveryPage?: RegExp
  /** Each appears on one line of some page, as whole words. */
  readonly exactText: readonly string[]
  /**
   * Each is printed as lines of its own on one page, and reads exactly so
   * once the engine's line breaks and all other whitespace are taken out:
   * text an engine may wrap anywhere, such as an identifier with no space in
   * it. A fixture places it where it cannot run onto the next page, whose
   * header would stand in the middle of it.
   */
  readonly wrappedText: readonly string[]
  /** Each group's lines all appear on one page. */
  readonly keptTogether: readonly (readonly string[])[]
  /**
   * The kept-together groups come in order of the room the page leaves them,
   * most first, as a sweep across a page boundary places them: some fit under
   * what precedes them, the rest start a page of their own, and once one has
   * moved every later one does too.
   */
  readonly keptTogetherByRoom: boolean
  readonly minPagesExpected: number
  readonly maxPagesExpected: number
  /** No page's last table line is a group header or the column header: a heading never ends a page alone. */
  readonly noOrphanedHeaders: boolean
  /**
   * Every page prints something between its page header and footer: text,
   * an image, or a drawing -- an SVG image or a chart. Off for a document
   * whose body has a spacer or a rule, which print nothing the checks can
   * read and may be all a page holds.
   */
  readonly noEmptyPages: boolean
  /** All text, every image and every drawing -- an SVG image, a chart -- lies inside the document's margins. */
  readonly allTextInsidePrintable: boolean
  /** No two pieces of text, no text and an image or a drawing, and no two of those, are drawn over each other, but a chart's own words, which print inside its box. */
  readonly noOverlaps: boolean
  /** Every font a page uses travels inside the PDF. */
  readonly fontsEmbedded: boolean
  /** Each run of text held to the face it prints in, by the face's PostScript name after the subset prefix (0043); empty where a fixture maps no host font. */
  readonly fontNames: readonly ExpectedFontName[]
  /** The body's images, in document order, each drawn once at this size. */
  readonly images: readonly ExpectedImage[]
  /**
   * The body's drawings in document order through every container -- a
   * column, a section, a keep-together block -- each found after the one
   * before (`drawings.ts`): its SVG images, and its charts that have
   * something to draw (`drawingsOf`). A drawing it does not list is
   * sought nowhere, and a chart not sought is proved by nothing.
   */
  readonly drawings: readonly ExpectedDrawing[]
  /** Every chart in the body, in document order through every container (`chartsOf`), each proved by `check-charts.ts` where `drawings.ts` placed it. */
  readonly charts: readonly ExpectedChart[]
  /** The page header's and footer's images, each drawn at this size on every page that prints them: on every page but page 1 where `firstPage` is present. */
  readonly pageRegionImages: readonly ExpectedImage[]
  /**
   * The body's runs set below or above the line, each read so once, into
   * the line it stands on (`lines.ts`); and no run read so that the
   * document does not set, on any page (`shiftedRuns`).
   */
  readonly shiftedRuns: readonly ExpectedShiftedRun[]
  /** The page header's and footer's runs set below or above the line, each read so on every page that prints them: on every page but page 1 where `firstPage` is present. */
  readonly pageRegionShiftedRuns: readonly ExpectedShiftedRun[]
}

/** What a fixture states about itself; everything else in its expectation is derived, and the drawings it seeks and the charts it proves always are. */
export type Stated = Pick<Expectation, 'maxPagesExpected'> & Partial<Omit<Expectation, 'maxPagesExpected' | 'drawings' | 'charts'>>

/**
 * The expectation a document implies, with what the fixture states laid over
 * it: keys from the first cell of every table row and the lines of every
 * keep-together block, every table's header and rows, the page header's and
 * footer's lines, and page 1's own header's where it has one, the body's
 * and the page regions' images, and every layout check on.
 */
export function expectation(document: ResolvedDocument, stated: Stated): Expectation {
  const footerEveryPage = footerPattern(document.pageFooter)
  return {
    outcome: 'render',
    keys: keysOf(document.body, false),
    tables: tables(document.body).map(expectedTable),
    pageHeaderLines: plainLines(document.pageHeader),
    ...(document.firstPageHeader === undefined ? {} : { firstPage: firstPageOf(document.firstPageHeader, document.pageFooter) }),
    pageFooterLines: plainLines(document.pageFooter),
    ...(footerEveryPage === undefined ? {} : { footerEveryPage }),
    exactText: [],
    wrappedText: [],
    keptTogether: keptTogether(document.body),
    keptTogetherByRoom: false,
    minPagesExpected: 1,
    noOrphanedHeaders: true,
    noEmptyPages: !flatten(document.body).some((block) => block.kind === 'spacer' || block.kind === 'rule'),
    allTextInsidePrintable: true,
    noOverlaps: true,
    fontsEmbedded: true,
    fontNames: [],
    images: imagesOf(document.body),
    pageRegionImages: imagesOf([...document.pageHeader, ...document.pageFooter]),
    shiftedRuns: shiftedRunsOf(document.body),
    pageRegionShiftedRuns: shiftedRunsOf([...document.pageHeader, ...document.pageFooter]),
    ...stated,
    // Derived together and never stated, so that a drawing is never sought apart from the chart it proves (N3).
    drawings: drawingsOf(document.body),
    charts: chartsOf(document),
  }
}

/** Page 1's regions under its own header, `firstPageHeader`, and the page footer every page prints. */
function firstPageOf(firstPageHeader: readonly Block[], pageFooter: readonly Block[]): ExpectedFirstPage {
  const regions = [...firstPageHeader, ...pageFooter]
  return { headerLines: plainLines(firstPageHeader), regionImages: imagesOf(regions), shiftedRuns: shiftedRunsOf(regions) }
}

/**
 * The runs `blocks` set below or above the line, in document order, in
 * every paragraph however deep it stands -- a column, a section, a
 * keep-together block -- each with its paragraph's size where the
 * paragraph states one (0061). A run that prints nothing a reader sees, a
 * space or nothing at all, is not among them: PDF.js extracts no run for
 * it.
 */
export function shiftedRunsOf(blocks: readonly Block[]): ExpectedShiftedRun[] {
  return paragraphsOf(blocks).flatMap(({ runs, style }) =>
    runs.flatMap((run): ExpectedShiftedRun[] => {
      if (!('text' in run) || run.baseline === undefined || normalise(run.text) === '') return []
      return [{ text: normalise(run.text), shift: run.baseline, ...(style?.size === undefined ? {} : { size: style.size }) }]
    }),
  )
}

/** Every paragraph among `blocks` and inside each container, in document order. */
function paragraphsOf(blocks: readonly Block[]): Paragraph[] {
  return blocks.flatMap((block): Paragraph[] => {
    if (block.kind === 'paragraph') return [block]
    if (block.kind === 'columns') return block.columns.flatMap((column) => paragraphsOf(column.blocks))
    return 'blocks' in block ? paragraphsOf(block.blocks) : []
  })
}

/** The images among `blocks`, in document order: an SVG drawn as vectors, any other as an image. */
function imagesOf(blocks: readonly Block[]): ExpectedImage[] {
  const expected = ({ asset, width, height }: Image): ExpectedImage => ({ kind: asset.mediaType === 'image/svg+xml' ? 'vector' : 'raster', width, height })
  return flatten(blocks).flatMap((block) => (block.kind === 'image' ? [expected(block)] : []))
}

/** Every block, the contents of keep-together blocks included, in document order. */
export function flatten(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => (block.kind === 'keepTogether' ? [block, ...flatten(block.blocks)] : [block]))
}

export function tables(blocks: readonly Block[]): Table[] {
  return flatten(blocks).filter((block) => block.kind === 'table')
}

/** The drawings among `blocks`, in document order through every container, as `epcCodes` walks them: each SVG image, and each chart with something to draw; a chart with nothing to draw is no drawing (R7, R8). */
export function drawingsOf(blocks: readonly Block[]): ExpectedDrawing[] {
  return blocks.flatMap((block): ExpectedDrawing[] => {
    if (block.kind === 'image') return block.asset.mediaType === 'image/svg+xml' ? [{ kind: 'image', width: block.width, height: block.height }] : []
    if (block.kind === 'chart') return block.empty === undefined ? [{ kind: 'chart', id: block.id, width: block.width, height: block.height }] : []
    if (block.kind === 'columns') return block.columns.flatMap((column) => drawingsOf(column.blocks))
    return 'blocks' in block ? drawingsOf(block.blocks) : []
  })
}

/**
 * Every chart in `document`'s body as its PDF must show it, in document
 * order through every container, as `drawingsOf` walks them: its words as
 * PDF.js extracts them (`normalise`), none that prints nothing; a bar or a
 * line chart's categories and ticks, a pie's none; each series' or slice's
 * colour and exact values; the face each word prints in where its token
 * maps a host font (0043); and a chart with nothing to draw anchored in
 * its flow. A flow is the body, or a column: a section or a keep-together
 * block flows in the flow it stands in, and a column flows below what
 * stands before its columns block, apart from the columns beside it, so
 * that an empty chart is sought after the chart drawn before it there
 * (`ExpectedChart.after`), and where none is, after the page breaks before
 * it (`ExpectedChart.breaks`), which stand in the body and its sections
 * alone. What follows a columns block stands below every column, and
 * after the last chart drawn in any.
 */
export function chartsOf(document: ResolvedDocument): ExpectedChart[] {
  const charts: ExpectedChart[] = []
  let breaks = 0
  /** `blocks` walked, `drawn` the id of the chart drawn last before them in their flow; the one drawn last once they are. */
  const walk = (blocks: readonly Block[], drawn: string | undefined): string | undefined => {
    let last = drawn
    for (const block of blocks) {
      if (block.kind === 'pageBreak') breaks += 1
      else if (block.kind === 'chart') {
        const anchor = block.empty === undefined ? {} : last === undefined ? { breaks } : { after: last }
        charts.push({ ...expectedChart(block, document.fonts), ...anchor })
        if (block.empty === undefined) last = block.id
      } else if (block.kind === 'columns') {
        const before = last
        for (const column of block.columns) {
          const ended = walk(column.blocks, before)
          if (ended !== before) last = ended
        }
      } else if ('blocks' in block) last = walk(block.blocks, last)
    }
    return last
  }
  walk(document.body, undefined)
  return charts
}

/** `chart` as its PDF must show it, its words' faces read from `fonts` where its token maps a host font. */
function expectedChart(chart: Chart, fonts: ResolvedFonts | undefined): ExpectedChart {
  const printed = (texts: readonly (string | undefined)[]): string[] => texts.map((text) => normalise(text ?? '')).filter((text) => text !== '')
  const axis = chart.chart === 'pie' ? undefined : chart
  const values = axis?.valueLabels === true ? axis.series.flatMap(({ values: each }) => each.flatMap((value) => (value === null ? [] : [value.text]))) : []
  const title = printed([chart.title])
  const words = printed([axis?.categoryTitle, axis?.valueTitle, ...(axis?.categories ?? []), ...values, ...chart.legend.map(({ text }) => text), chart.empty])
  const ticks = axis?.ticks ?? []
  const [titleFace, wordsFace] = [true, false].map((bold) => faceName(chart, fonts, bold))
  const named = (texts: readonly string[], postScriptName: string | undefined): ExpectedFontName[] =>
    postScriptName === undefined ? [] : texts.map((text) => ({ text, postScriptName }))
  return {
    id: chart.id,
    chart: chart.chart,
    width: chart.width,
    height: chart.height,
    words: [...title, ...words],
    categories: (axis?.categories ?? []).map(normalise),
    ticks,
    marks:
      chart.chart === 'pie'
        ? chart.slices.map(({ color, value }) => ({ paint: color, values: [value.exact] }))
        : chart.series.map(({ color, values: each }) => ({
            paint: color,
            values: each.map((value) => value?.exact ?? null),
            ...(chart.valueLabels ? { labels: each.map((value) => (value === null ? null : (printed([value.text])[0] ?? null))) } : {}),
          })),
    legend: chart.legend.map(({ text, color }) => ({ text: normalise(text), paint: color })),
    faces: [...named(title, titleFace), ...named([...words, ...printed(ticks.map(({ text }) => text))], wordsFace)],
    empty: chart.empty !== undefined,
  }
}

/**
 * The PostScript names of Roboto 3.014's four faces, which the renderer
 * prints the sans token in where a report maps it no host font, as the
 * PDF names them: its own `face-identity.ts` holds each to its file, and
 * report-render-pdf's `corpus.test.ts` holds these to a chart it draws in
 * each face.
 */
const ROBOTO: { readonly [Key in ReturnType<typeof faceKey>]: string } = {
  normal: 'Roboto-Regular',
  bold: 'Roboto-Medium',
  italic: 'Roboto-Italic',
  boldItalic: 'Roboto-MediumItalic',
}

/**
 * The PostScript name of the face a word of `chart` prints in: its title
 * bold, every other word its style's weight, each its style's slant
 * (`chart-faces.ts`), in the face `fonts` maps its token to, read from its
 * bytes as the renderer reads them, or in Roboto's where the sans token
 * maps none. None where another token maps none, or no such face, or one
 * that is no font, each of which the renderer refuses.
 */
function faceName(chart: Chart, fonts: ResolvedFonts | undefined, title: boolean): string | undefined {
  const style = chart.style ?? {}
  const [token, key] = [style.font ?? 'sans', faceKey(title || (style.bold ?? false), style.italic ?? false)]
  const faces = fonts?.[token]
  if (faces === undefined) return token === 'sans' ? ROBOTO[key] : undefined
  const asset = faces[key]
  const read = asset === undefined ? undefined : readFont(asset.bytes)
  return read?.ok === true ? read.names.postScriptName : undefined
}

/** Every EPC QR code among `blocks`, inside every container -- a column, a section, a keep-together block -- in document order. */
export function epcCodes(blocks: readonly Block[]): EpcQrCode[] {
  return blocks.flatMap((block): EpcQrCode[] => {
    if (block.kind === 'epcQrCode') return [block]
    if (block.kind === 'columns') return block.columns.flatMap((column) => epcCodes(column.blocks))
    return 'blocks' in block ? epcCodes(block.blocks) : []
  })
}

/** A paragraph's text when it has no page fields, with its whitespace as a line of extracted text has it. */
export function plainText(runs: readonly Inline[]): string | undefined {
  if (runs.some((run) => 'field' in run)) return undefined
  return normalise(runs.map((run) => ('text' in run ? run.text : '')).join(''))
}

/** Whitespace runs as one space, and none at either end: how a line of extracted text is compared. */
export function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Each table row's first cell, and each line of a keep-together block, in document order; a row with no first cell has no key. */
function keysOf(blocks: readonly Block[], kept: boolean): string[] {
  return blocks.flatMap((block) => {
    if (block.kind === 'table') return block.rows.map((row) => normalise(row.cells[0] ?? '')).filter((key) => key !== '')
    if (block.kind === 'keepTogether') return keysOf(block.blocks, true)
    const text = kept && block.kind === 'paragraph' ? plainText(block.runs) : undefined
    return text ? [text] : []
  })
}

function expectedTable(table: Table): ExpectedTable {
  const printed = (cells: readonly string[]): ExpectedCell[] =>
    cells.map((cell, column) => ({ column, text: normalise(cell) })).filter((cell) => cell.text !== '')
  return {
    id: table.id,
    header: printed(table.header).map((cell) => cell.text),
    rows: table.rows.map((row) => ({
      kind: row.kind,
      key: normalise(row.cells[0] ?? ''),
      cells: printed(row.cells),
      ...(row.keepWithRows === undefined ? {} : { keepWithRows: row.keepWithRows }),
    })),
    emptyText: table.rows.some((row) => row.kind === 'detail') ? '' : normalise(table.emptyText),
  }
}

/** The lines of a page region's paragraphs that have no page field; a line with one is matched by `footerPattern`. */
function plainLines(blocks: readonly Block[]): string[] {
  return flatten(blocks).flatMap((block) => {
    const text = block.kind === 'paragraph' ? plainText(block.runs) : undefined
    return text ? [text] : []
  })
}

function keptTogether(blocks: readonly Block[]): string[][] {
  return flatten(blocks)
    .filter((block) => block.kind === 'keepTogether')
    .map((block) =>
      flatten(block.blocks).flatMap((inner) => {
        const text = inner.kind === 'paragraph' ? plainText(inner.runs) : undefined
        return text ? [text] : []
      }),
    )
}

/**
 * The line the page footer prints, as a pattern: its text literally, each
 * page field as digits in a named group. The first paragraph with a page
 * field is the one matched; a footer without one has no pattern.
 */
export function footerPattern(footer: readonly Block[]): RegExp | undefined {
  const paragraph = footer.find((block) => block.kind === 'paragraph' && block.runs.some((run) => 'field' in run))
  if (paragraph?.kind !== 'paragraph') return undefined
  const named = new Set<string>()
  const source = paragraph.runs
    .map((run) => {
      if ('text' in run) return run.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (named.has(run.field)) return `\\k<${run.field}>`
      named.add(run.field)
      return `(?<${run.field}>\\d+)`
    })
    .join('')
  return new RegExp(`^${source.replace(/\s+/g, ' ').trim()}$`)
}
