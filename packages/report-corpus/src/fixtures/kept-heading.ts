import type { Paragraph, TableRow } from '../document.js'
import { expectation, plainText, type Fixture } from '../fixture.js'
import { details, documentOf, heading, ledger, paragraph } from './build.js'
import { pagesOfRows, ROWS_PER_PAGE_RANGE } from './geometry.js'

/**
 * Headings kept with the next block, each over a table that runs past the
 * page it starts on, so that every page it continues on repeats its
 * column header: one heading under a line at the top of the body, and a
 * run of two headings wherever the first table ends.
 *
 * Each table has more rows than any plausible page holds
 * (`ROWS_PER_PAGE_RANGE`), so on every engine it runs on to the next page
 * under its header. The first heading stands under one line at the top of
 * page 1, where any engine has room for it, the column header and the
 * table's first row: all three print on that line's page, and an engine
 * that took the heading to the next page with its table, leaving the rest
 * of page 1 empty, fails. The run stands where the first table ends, which
 * is the engine's: both headings print on the page of the second table's
 * first row, at the foot of a page or on the next one with the table, and
 * an engine that moved them one at a time, leaving the first heading
 * alone on a page, fails. The corpus's header check holds the column
 * header over each table on every page it reaches.
 *
 * Not in `ALL_FIXTURES`, which is the corpus the renderer trial chose an
 * engine on (0005): the trial's pdfme adapter keeps no heading with
 * anything, its pdfmake adapter keeps one with a table's header
 * (`trial/pdfmake-content.ts`'s `anchorOf`) and fails both groups here,
 * as the renderer did until 2026-11-20 (0011), and the trial's findings
 * are of that corpus as it stood. The renderer answers to it as it
 * answers to those. The Word writer does
 * not: what it is about is where a page breaks, which in a Word file is
 * Word's (0068), and its headings' marks are every other fixture's.
 */

/** More rows than any plausible page holds under its header, by `extra`. */
const pastThePage = (extra: number): number => ROWS_PER_PAGE_RANGE.max + extra

const opening: Paragraph = paragraph('Statement for the period, line by line')
const titled = heading('Deliveries')
const deliveries = details(1, pastThePage(10))
const returns = details(deliveries.length + 1, deliveries.length + pastThePage(20))
const run = [heading('Returns'), heading('Returned goods')] as const

/** A paragraph's text, as a line of it is read: every paragraph here is text alone. */
const textOf = ({ runs }: Paragraph): string => plainText(runs)!

/** A table's first row's key, which is how the corpus finds it: every table here has rows. */
const keyOf = (rows: readonly TableRow[]): string => rows[0]!.cells[0]!

const document = documentOf('Kept headings', [opening, titled, ledger('deliveries', deliveries), ...run, ledger('returns', returns)])

/**
 * The rows, and a row more for each other line -- the opening line, three
 * headings and the second table's header on its first page -- and as many
 * again for the room the run leaves at the foot of a page it moves from.
 */
const pages = pagesOfRows(deliveries.length + returns.length + 2 * 5)

export const keptHeading: Fixture = {
  id: 'kept-heading',
  title: 'Headings kept with tables that run past the page: each on the page of its first row, a run of them together, the header on every page',
  document,
  maxPages: 20,
  expect: expectation(document, {
    onOnePage: [
      [textOf(opening), textOf(titled), keyOf(deliveries)],
      [...run.map(textOf), keyOf(returns)],
    ],
    minPagesExpected: pages.min,
    maxPagesExpected: pages.max,
  }),
}

/** The kept heading fixtures, which the renderer answers to beside `ALL_FIXTURES`. */
export const KEPT_HEADING_FIXTURES: readonly Fixture[] = [keptHeading]
