import { ALL_FIXTURES, type Expectation, type ExpectedCell, type ExpectedTable, type Fixture } from '@formancy/report-corpus'
import type { Block, Inline, Paragraph, ResolvedDocument, Table, TableColumn, TableRow, TextStyle } from '@formancy/report-runtime'

/**
 * Documents for the renderer's own tests, built as the corpus builds its
 * fixtures, and the expectation the corpus derives from a document.
 *
 * These are copies of `@formancy/report-corpus`'s `fixtures/build.ts` and
 * `fixture.ts`, which its index does not export; they go once it does. One
 * difference: `flatten` here reads the blocks of sections and columns as
 * well as keep-together blocks, so that a table or a kept block inside a
 * section is expected like any other. The corpus's reads keep-together
 * blocks alone, because its fixtures hold no sections.
 */

/** Long enough for the corpus's largest documents on a slow runner; a render that hangs still fails. */
export const TIMEOUT = 120_000

/** The fixture a test takes something from, by id; a test that names one the corpus does not have fails here. */
export function fixture(id: string): Fixture {
  const found = ALL_FIXTURES.find((each) => each.id === id)
  if (found === undefined) throw new Error(`the corpus has no fixture '${id}'`)
  return found
}

/** The corpus page: A4 portrait, 36pt above and below, 40pt at the sides. */
export const PAGE = fixture('one-row').document.page

export const BODY_SIZE = 9
export const SMALL_SIZE = 8

/** Roboto's line, as a multiple of the font size: 2400 of 2048 units. */
export const LINE = 2400 / 2048

/** 515.28pt: A4 with 40pt side margins. */
export const PRINTABLE_WIDTH = 595.28 - PAGE.margins.left - PAGE.margins.right

/**
 * A `documentOf` body's height as the renderer lays it out, 739.14pt: the
 * printable area less a page header and footer of one 8pt line each and the
 * 6pt gap from each to the body.
 */
export const BODY_HEIGHT = 841.89 - PAGE.margins.top - PAGE.margins.bottom - 2 * (SMALL_SIZE * LINE + 6)

/** Fixed, so that a document renders to the same PDF every time. */
const CREATED = '2026-01-01T00:00:00Z'

export function paragraph(text: string, style: TextStyle = {}): Paragraph {
  return { kind: 'paragraph', runs: [{ text }], style: { size: BODY_SIZE, ...style } }
}

export function heading(text: string): Paragraph {
  return { ...paragraph(text, { size: 14, bold: true }), keepWithNext: true }
}

/** "Page n of N", centred, on every page. */
const PAGE_FOOTER: Paragraph = {
  kind: 'paragraph',
  runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }],
  style: { size: SMALL_SIZE, align: 'center' },
}

/** A document on the corpus page, its title in the page header on every page. */
export function documentOf(title: string, body: readonly Block[]): ResolvedDocument {
  return {
    info: { title, creationDate: CREATED },
    page: PAGE,
    pageHeader: [paragraph(`Formancy Report corpus: ${title}`, { size: SMALL_SIZE })],
    pageFooter: [PAGE_FOOTER],
    body,
  }
}

/** A document of `body` alone, without page regions: what a test reading every run of a page wants. */
export function bareDocument(title: string, body: readonly Block[]): ResolvedDocument {
  return { ...documentOf(title, body), pageHeader: [], pageFooter: [] }
}

/** Key, description and amount: 70pt, what is left, and 90pt right-aligned. */
export const LEDGER_COLUMNS: readonly TableColumn[] = [
  { width: 70, align: 'left' },
  { width: 'fill', align: 'left' },
  { width: 90, align: 'right' },
]

export function ledger(id: string, rows: readonly TableRow[], columns: readonly TableColumn[] = LEDGER_COLUMNS): Table {
  return { kind: 'table', id, columns, header: ['Key', 'Description', 'Amount'], rows, emptyText: 'No records' }
}

/** An amount in cents as the string that prints, `-0.01` or `1234.50`, computed exactly. */
function amount(cents: bigint): string {
  const sign = cents < 0n ? '-' : ''
  const absolute = cents < 0n ? -cents : cents
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

/** Detail rows `from` to `to`, keyed `ROW-0001` and priced by number. */
export function details(from: number, to: number): TableRow[] {
  return Array.from({ length: to - from + 1 }, (_, index) => {
    const n = from + index
    return { kind: 'detail', cells: [`ROW-${String(n).padStart(4, '0')}`, `Line item ${n}`, amount(BigInt(((n * 7919) % 99999) + 1))] }
  })
}

/** The total row under `rows`: the exact sum of their detail amounts. */
export function totalRow(rows: readonly TableRow[], label = 'Total'): TableRow {
  const sum = rows.filter((row) => row.kind === 'detail').reduce((total, row) => total + BigInt((row.cells[2] ?? '0').replace('.', '')), 0n)
  return { kind: 'total', cells: [label, '', amount(sum)] }
}

/** What a test states about a document; everything else in its expectation is derived. */
export type Stated = Pick<Expectation, 'maxPagesExpected'> & Partial<Omit<Expectation, 'maxPagesExpected'>>

/** A fixture of `document`, its expectation derived, with a page limit of 20. */
export function fixtureOf(id: string, document: ResolvedDocument, stated: Stated): Fixture {
  return { id, title: id, document, maxPages: 20, expect: expectation(document, stated) }
}

/**
 * The expectation a document implies, with what the test states laid over
 * it: keys from the first cell of every table row and the lines of every
 * keep-together block, every table's header and rows, the page header's and
 * footer's lines, the body's images, and every layout check on.
 */
export function expectation(document: ResolvedDocument, stated: Stated): Expectation {
  const footerEveryPage = footerPattern(document.pageFooter)
  return {
    outcome: 'render',
    keys: keysOf(document.body, false),
    tables: flatten(document.body).filter((block) => block.kind === 'table').map(expectedTable),
    pageHeaderLines: plainLines(document.pageHeader),
    pageFooterLines: plainLines(document.pageFooter),
    ...(footerEveryPage === undefined ? {} : { footerEveryPage }),
    exactText: [],
    wrappedText: [],
    keptTogether: flatten(document.body)
      .filter((block) => block.kind === 'keepTogether')
      .map((block) => plainLines(block.blocks)),
    keptTogetherByRoom: false,
    minPagesExpected: 1,
    noOrphanedHeaders: true,
    // A page of these alone prints nothing the corpus's checks see: no text, and no image.
    noEmptyPages: !flatten(document.body).some((block) => block.kind === 'spacer' || block.kind === 'rule' || block.kind === 'rectangle' || block.kind === 'qrCode'),
    allTextInsidePrintable: true,
    noOverlaps: true,
    fontsEmbedded: true,
    images: flatten(document.body).flatMap((block) => (block.kind === 'image' ? [{ width: block.width, height: block.height }] : [])),
    ...stated,
  }
}

/** Every block, the contents of keep-together blocks, sections and columns included, in document order. */
export function flatten(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block): Block[] => {
    if (block.kind === 'keepTogether' || block.kind === 'section') return [block, ...flatten(block.blocks)]
    if (block.kind === 'columns') return [block, ...block.columns.flatMap((slot) => flatten(slot.blocks))]
    return [block]
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
  return blocks.flatMap((block): string[] => {
    if (block.kind === 'table') return block.rows.map((row) => normalise(row.cells[0] ?? '')).filter((key) => key !== '')
    if (block.kind === 'keepTogether') return keysOf(block.blocks, true)
    if (block.kind === 'section') return keysOf(block.blocks, kept)
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

/** The lines of the paragraphs among `blocks` that have no page field. */
function plainLines(blocks: readonly Block[]): string[] {
  return flatten(blocks).flatMap((block) => {
    const text = block.kind === 'paragraph' ? plainText(block.runs) : undefined
    return text ? [text] : []
  })
}

/** The line the page footer prints, as a pattern: its text literally, each page field as digits in a named group. */
function footerPattern(footer: readonly Block[]): RegExp | undefined {
  const found = footer.find((block) => block.kind === 'paragraph' && block.runs.some((run) => 'field' in run))
  if (found?.kind !== 'paragraph') return undefined
  const named = new Set<string>()
  const source = found.runs
    .map((run) => {
      if ('text' in run) return run.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (named.has(run.field)) return `\\k<${run.field}>`
      named.add(run.field)
      return `(?<${run.field}>\\d+)`
    })
    .join('')
  return new RegExp(`^${source.replace(/\s+/g, ' ').trim()}$`)
}
