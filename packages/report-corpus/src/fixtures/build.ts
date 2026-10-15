import type { Block, Paragraph, ParagraphStyle, ResolvedDocument, Table, TableColumn, TableRow } from '../document.js'
import { BODY_SIZE, PAGE, SMALL_SIZE } from './geometry.js'

/**
 * The parts every fixture is made of: one page setup, one page header and
 * footer, one ledger table shape. A fixture differs from another only in what
 * it is about.
 */

/** Fixed, so that a fixture renders to the same PDF every time. */
const CREATED = '2026-01-01T00:00:00Z'

export function paragraph(text: string, style: ParagraphStyle = {}): Paragraph {
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

const LEDGER_HEADER = ['Key', 'Description', 'Amount'] as const

/** Key, description and amount: 70pt, what is left, and 90pt right-aligned. */
export const LEDGER_COLUMNS: readonly TableColumn[] = [
  { width: 70, align: 'left' },
  { width: 'fill', align: 'left' },
  { width: 90, align: 'right' },
]

export function ledger(id: string, rows: readonly TableRow[], columns: readonly TableColumn[] = LEDGER_COLUMNS): Table {
  return { kind: 'table', id, columns, header: [...LEDGER_HEADER], rows, emptyText: 'No records' }
}

/** `ROW-0001` for 1: a key every row can be found by, and no other row's key contains. */
function rowKey(n: number): string {
  return `ROW-${String(n).padStart(4, '0')}`
}

/** An amount in cents as the string that prints, `-0.01` or `1234.50`, computed exactly. */
export function amount(cents: bigint): string {
  const sign = cents < 0n ? '-' : ''
  const absolute = cents < 0n ? -cents : cents
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

/** A detail row's amount in cents, varied and repeatable: from 0.01 to 999.99. */
function centsFor(n: number): bigint {
  return BigInt(((n * 7919) % 99999) + 1)
}

/** Detail rows `from` to `to`, keyed and priced by number. */
export function details(from: number, to: number): TableRow[] {
  return Array.from({ length: to - from + 1 }, (_, index) => {
    const n = from + index
    return { kind: 'detail', cells: [rowKey(n), `Line item ${n}`, amount(centsFor(n))] }
  })
}

/** The total row under `rows`: the exact sum of their detail amounts. */
export function totalRow(rows: readonly TableRow[], label = 'Total'): TableRow {
  const sum = rows.filter((row) => row.kind === 'detail').reduce((total, row) => total + BigInt((row.cells[2] ?? '0').replace('.', '')), 0n)
  return { kind: 'total', cells: [label, '', amount(sum)] }
}
