import type { Block, EpcQrCode, Inline, RefusalCode, ResolvedDocument, Table, TableRow } from './document.js'

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
}

export interface ExpectedTable {
  readonly id: string
  /** The header row's cells, which stand above the table's first line on every page the table reaches. */
  readonly header: readonly string[]
  readonly rows: readonly ExpectedRow[]
  /** What prints under the header in place of detail rows when there are none; empty when there are some. */
  readonly emptyText: string
}

/** An image's size on the page, in points. */
export interface ExpectedImage {
  readonly width: number
  readonly height: number
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
  /** The page header's lines without page fields: each a line of its own on every page, above all of the body. */
  readonly pageHeaderLines: readonly string[]
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
   * Every page prints something between its page header and footer: text or
   * an image. Off for a document whose body has a spacer or a rule, which
   * print nothing the checks can read and may be all a page holds.
   */
  readonly noEmptyPages: boolean
  /** All text and every image lies inside the document's margins. */
  readonly allTextInsidePrintable: boolean
  /** No two pieces of text, and no text and image, are drawn over each other. */
  readonly noOverlaps: boolean
  /** Every font a page uses travels inside the PDF. */
  readonly fontsEmbedded: boolean
  /** The body's images, in document order, each drawn once at this size. */
  readonly images: readonly ExpectedImage[]
}

/** What a fixture states about itself; everything else in its expectation is derived. */
export type Stated = Pick<Expectation, 'maxPagesExpected'> & Partial<Omit<Expectation, 'maxPagesExpected'>>

/**
 * The expectation a document implies, with what the fixture states laid over
 * it: keys from the first cell of every table row and the lines of every
 * keep-together block, every table's header and rows, the page header's and
 * footer's lines, the body's images, and every layout check on.
 */
export function expectation(document: ResolvedDocument, stated: Stated): Expectation {
  const footerEveryPage = footerPattern(document.pageFooter)
  return {
    outcome: 'render',
    keys: keysOf(document.body, false),
    tables: tables(document.body).map(expectedTable),
    pageHeaderLines: plainLines(document.pageHeader),
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
    images: flatten(document.body).flatMap((block) => (block.kind === 'image' ? [{ width: block.width, height: block.height }] : [])),
    ...stated,
  }
}

/** Every block, the contents of keep-together blocks included, in document order. */
export function flatten(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => (block.kind === 'keepTogether' ? [block, ...flatten(block.blocks)] : [block]))
}

export function tables(blocks: readonly Block[]): Table[] {
  return flatten(blocks).filter((block) => block.kind === 'table')
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
  const printed = (cells: readonly string[]): ExpectedCell[] => cells.map((cell, column) => ({ column, text: normalise(cell) })).filter((cell) => cell.text !== '')
  return {
    id: table.id,
    header: printed(table.header).map((cell) => cell.text),
    rows: table.rows.map((row) => ({ kind: row.kind, key: normalise(row.cells[0] ?? ''), cells: printed(row.cells) })),
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
