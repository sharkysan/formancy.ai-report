import type { TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { documentOf, LEDGER_COLUMNS, ledger } from './build.js'
import { pagesOfText, PRINTABLE_WIDTH } from './geometry.js'
import { uniqueWords } from './words.js'

/**
 * One detail row taller than a page: its description is 4000 words, which
 * at the narrowest character and tightest line any engine might use is still
 * more than two pages tall in its column (the fixture test computes it). An
 * engine continues the row on the next pages or refuses it as too large; it
 * never clips it, so if it renders, every word is there once, in order.
 */
export const DESCRIPTION_WORDS = uniqueWords(4000)

const description = DESCRIPTION_WORDS.join(' ')
const row: TableRow = { kind: 'detail', cells: ['ROW-0001', description, '12.00'] }
const document = documentOf('Tall row', [ledger('lines', [row])])

/** The description column: what the fixed columns leave of the printable width. */
const descriptionWidth = PRINTABLE_WIDTH - LEDGER_COLUMNS.reduce((sum, column) => sum + (column.width === 'fill' ? 0 : column.width), 0)
const pages = pagesOfText(description.length, descriptionWidth, 2)

export const tallRow: Fixture = {
  id: 'tall-row',
  title: 'A row taller than a page: continued whole, or refused as too large',
  document,
  maxPages: 60,
  expect: expectation(document, {
    outcome: 'render-or-refuse',
    refusal: { code: 'content-too-large' },
    keys: [row.cells[0] ?? '', ...DESCRIPTION_WORDS],
    exactText: [row.cells[2] ?? ''],
    minPagesExpected: pages.min,
    maxPagesExpected: pages.max,
  }),
}
