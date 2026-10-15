import { expectation, type Fixture } from '../fixture.js'
import { details, documentOf, ledger, totalRow } from './build.js'

/**
 * Six thousand rows against a limit of twenty pages: at the densest plausible
 * rows the table needs a hundred or more (the fixture test computes it). The
 * engine refuses with too-many-pages. Twenty pages of the first rows would be
 * a report that looks complete and is not.
 */
const rows = details(1, 6000)
const document = documentOf('Oversized', [ledger('lines', [...rows, totalRow(rows)])])
const MAX_PAGES = 20

export const oversized: Fixture = {
  id: 'oversized',
  title: 'An oversized job: 6000 rows against a 20-page limit, refused, never truncated',
  document,
  maxPages: MAX_PAGES,
  expect: expectation(document, { outcome: 'refuse', refusal: { code: 'too-many-pages' }, maxPagesExpected: MAX_PAGES }),
}
