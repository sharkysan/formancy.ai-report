import { OVERLAP, quoted, type Page } from './check-page.js'
import type { ExpectedCell, ExpectedRow, ExpectedTable } from './fixture.js'
import { lineHas, type Line } from './lines.js'

/**
 * The tables as the pages print them. Each row is found by its key at the
 * start of a line and read from there, cell by cell: a value is proved on
 * the row it belongs to, not merely somewhere on some page. A row that wraps
 * is read on, line by line and across a page break, until every word of
 * every cell is accounted for.
 *
 * What a row is read as: its first line holds the start of every cell that
 * prints, in column order, as the document's cells are aligned to the top of
 * the row; every later line holds the next words of one or more cells, still
 * in column order; and nothing else. A row without a key cannot be found,
 * and its lines are nobody's. A word broken inside a cell is read as a word
 * the cell does not hold: no fixture's cell has a word wider than its column.
 */

/** A line's place: its page's index in the pages, and its index in that page's body lines. */
export interface At {
  readonly page: number
  readonly line: number
}

/** A row found on the pages: the line it begins and every body line it prints on. */
export interface PlacedRow {
  readonly table: ExpectedTable
  readonly row: ExpectedRow
  readonly lines: readonly At[]
  /** How it fails to print its cells, if it does. */
  readonly problem?: string
}

export interface ReadTables {
  readonly rows: readonly PlacedRow[]
  /** Rows whose key the pages print, though never at the start of a line. */
  readonly displaced: readonly string[]
}

interface Marker {
  readonly table: ExpectedTable
  readonly row: ExpectedRow
  readonly words: readonly string[]
}

export function readTables(pages: readonly Page[], tables: readonly ExpectedTable[]): ReadTables {
  const markers = new Map<string, Marker[]>()
  for (const table of tables) {
    for (const row of table.rows) {
      if (row.key === '') continue
      const words = row.key.split(' ')
      markers.set(words[0]!, [...(markers.get(words[0]!) ?? []), { table, row, words }])
    }
  }
  const starts = (line: Line): Marker | undefined => markerOf(line, markers)
  const rows: PlacedRow[] = []
  pages.forEach(({ body }, page) => {
    body.forEach((line, index) => {
      const marker = starts(line)
      if (marker !== undefined) rows.push({ table: marker.table, row: marker.row, ...readRow(pages, { page, line: index }, marker, starts) })
    })
  })
  const found = new Set(rows.map(({ row }) => row))
  const displaced = tables.flatMap((table) =>
    table.rows.flatMap((row) => {
      if (row.key === '' || found.has(row)) return []
      const page = pages.findIndex(({ body }) => body.some((line) => lineHas(line, row.key)))
      if (page < 0) return []
      const line = pages[page]!.body.find((each) => lineHas(each, row.key))!
      return [`page ${page + 1}: the row ${row.key} does not begin a line, so its cells are not in column order: ${quoted(line.text, 80)}`]
    }),
  )
  return { rows, displaced }
}

/** The row a line begins, known by its key: the longest key the line starts with. */
function markerOf(line: Line, markers: ReadonlyMap<string, readonly Marker[]>): Marker | undefined {
  return (markers.get(line.words[0] ?? '') ?? [])
    .filter((marker) => marker.words.every((word, index) => line.words[index] === word))
    .reduce<Marker | undefined>((longest, marker) => (longest === undefined || marker.words.length > longest.words.length ? marker : longest), undefined)
}

/**
 * The lines a row prints on, from the line it begins, and what is wrong
 * with them. A row whose first line is exactly its cells is done; any other
 * is read on until its cells run out, another row begins, or a line holds
 * something the row does not.
 */
function readRow(pages: readonly Page[], start: At, marker: Marker, starts: (line: Line) => Marker | undefined): { lines: At[]; problem?: string } {
  const { row, table } = marker
  const first = pages[start.page]!.body[start.line]!
  const lines: At[] = [start]
  if (first.text === row.cells.map((cell) => cell.text).join(' ')) return { lines }
  const reading = new Reading(row.cells)
  const opening = reading.take(first.words, true)
  if (opening !== undefined) return { lines, problem: `page ${start.page + 1}: the row ${row.key} ${opening}; it reads ${quoted(first.text, 80)}` }
  const headerLine = table.header.join(' ')
  let at: At = { page: start.page, line: start.line + 1 }
  let unread: Line | undefined
  while (!reading.done()) {
    const page = pages[at.page]
    if (page === undefined) break
    const line = page.body[at.line]
    // Off the foot of the page, the row continues on the next, under its table's header.
    if (line === undefined) at = { page: at.page + 1, line: 0 }
    else if (line.text === headerLine) at = { ...at, line: at.line + 1 }
    else if (starts(line) !== undefined) break
    else if (reading.take(line.words, false) !== undefined) {
      unread = line
      break
    } else {
      lines.push(at)
      at = { ...at, line: at.line + 1 }
    }
  }
  const rest = reading.rest()
  if (rest === undefined) return { lines }
  const stopped = Math.min(at.page, pages.length - 1) + 1
  const begun = stopped === start.page + 1 ? '' : `, begun on page ${start.page + 1},`
  const next = unread === undefined ? '' : `; the next line reads ${quoted(unread.text, 60)}`
  return { lines, problem: `page ${stopped}: the row ${row.key}${begun} stops before ${quoted(rest.words, 60)} of its column ${rest.column + 1} cell${next}` }
}

/** A row's cells as words, and how many of each have been read. */
class Reading {
  readonly #cells: readonly ExpectedCell[]
  readonly #words: readonly (readonly string[])[]
  #taken: number[]

  constructor(cells: readonly ExpectedCell[]) {
    this.#cells = cells
    this.#words = cells.map((cell) => cell.text.split(' '))
    this.#taken = cells.map(() => 0)
  }

  /**
   * Reads one line as the next words of each cell in column order, taking
   * as many of each as match. On the row's first line every cell must give
   * at least one. Returns what is wrong with the line, having read none of
   * it, or nothing, having read all of it.
   */
  take(words: readonly string[], first: boolean): string | undefined {
    const taken = [...this.#taken]
    let at = 0
    for (const [index, cell] of this.#words.entries()) {
      let count = 0
      while (at + count < words.length && taken[index]! + count < cell.length && words[at + count] === cell[taken[index]! + count]) count++
      if (first && count === 0) return `prints nothing of its column ${this.#cells[index]!.column + 1} cell ${quoted(this.#cells[index]!.text)} on its first line`
      taken[index] = taken[index]! + count
      at += count
    }
    if (at < words.length) return `prints ${quoted(words.slice(at).join(' '))}, which is not the next of its cells`
    this.#taken = taken
    return undefined
  }

  done(): boolean {
    return this.rest() === undefined
  }

  /** The first cell with words still to read, and those words. */
  rest(): { column: number; words: string } | undefined {
    const index = this.#words.findIndex((cell, at) => this.#taken[at]! < cell.length)
    if (index < 0) return undefined
    return { column: this.#cells[index]!.column, words: this.#words[index]!.slice(this.#taken[index]).join(' ') }
  }
}

/** Every body line of `table` on each page: its rows' lines, its empty text, and any line holding one of its keys elsewhere than at the start. */
function tableLines(pages: readonly Page[], read: ReadTables, table: ExpectedTable): Line[][] {
  const lines = pages.map((): Line[] => [])
  for (const placed of read.rows) {
    if (placed.table !== table) continue
    for (const at of placed.lines) lines[at.page]!.push(pages[at.page]!.body[at.line]!)
  }
  const keys = table.rows.map((row) => row.key).filter((key) => key !== '')
  pages.forEach(({ body }, page) => {
    for (const line of body) {
      if (lines[page]!.includes(line)) continue
      if ((table.emptyText !== '' && line.text === table.emptyText) || keys.some((key) => lineHas(line, key))) lines[page]!.push(line)
    }
  })
  return lines
}

/** The problems with how each row prints its cells, and the rows whose key is not where a row begins. */
export function rowProblems(read: ReadTables): string[] {
  return [...read.rows.flatMap((placed) => (placed.problem === undefined ? [] : [placed.problem])), ...read.displaced]
}

/** On every page a table reaches, each of its header cells above the first of its lines there. */
export function headers(pages: readonly Page[], read: ReadTables, tables: readonly ExpectedTable[]): string[] {
  return tables.flatMap((table) => {
    if (table.header.length === 0) return []
    return tableLines(pages, read, table).flatMap((lines, index) => {
      const first = lines.reduce<Line | undefined>((top, line) => (top === undefined || line.top < top.top ? line : top), undefined)
      if (first === undefined) return []
      const { body } = pages[index]!
      const absent = table.header.filter((cell) => !body.some((line) => line.bottom <= first.top + OVERLAP && lineHas(line, cell)))
      if (absent.length === 0) return []
      const cells = absent.map((cell) => quoted(cell)).join(', ')
      return [`page ${index + 1}: ${absent.length === 1 ? `the header cell ${cells} is` : `the header cells ${cells} are`} not above the first line of table ${table.id}, ${quoted(first.text)}`]
    })
  })
}

/**
 * No page ends a table with a heading: neither a group header, which would
 * stand over rows on the next page, nor the column header, which would stand
 * over none. A heading ends its page when nothing of the body -- no line, no
 * image -- is below it there; whatever follows a heading in the document is
 * its table's rows, so a row without a key counts as well as one with.
 */
export function orphans(pages: readonly Page[], read: ReadTables, tables: readonly ExpectedTable[]): string[] {
  const last = (index: number, heading: Line): boolean => {
    const { body, page } = pages[index]!
    return !body.some((line) => line !== heading && line.top >= heading.bottom - OVERLAP) && !page.images.some((image) => image.top >= heading.bottom - OVERLAP)
  }
  const groupHeaders = read.rows.flatMap(({ row, lines: [start] }) => {
    if (row.kind !== 'groupHeader' || start === undefined || !last(start.page, pages[start.page]!.body[start.line]!)) return []
    return [`page ${start.page + 1}: the last table row is the group header '${row.key}'`]
  })
  const columnHeaders = tables.flatMap((table) => {
    const headerLine = table.header.join(' ')
    if (headerLine === '') return []
    return pages.flatMap(({ body }, index) =>
      body.filter((line) => line.text === headerLine && last(index, line)).map(() => `page ${index + 1}: the column header of table ${table.id} ends the page, with none of its rows under it`),
    )
  })
  return [...groupHeaders, ...columnHeaders]
}
