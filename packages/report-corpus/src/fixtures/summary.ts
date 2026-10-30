import type { Block, Image, KeepTogether } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { details, documentOf, heading, ledger, paragraph, totalRow } from './build.js'
import { bodyHeight, BODY_SIZE, LINE_FACTOR_RANGE, lineHeight } from './geometry.js'
import { encodePng } from './png.js'

/**
 * A report summary, kept together, at the foot of a page: with just room
 * for it, and without. The first page holds a short statement; each summary
 * then starts a page under a filler of a known height -- an image, drawn at
 * exactly its size, standing in for detail rows an engine would measure its
 * own way, and visible to the checks where a spacer would not be.
 *
 * Where the boundary falls is the engine's: its page header, footer and
 * line height decide how much of the page the summary needs and how much is
 * left. In the corpus's model a body is 737.09 to 740.29pt tall and the
 * summary's six lines 59.4 to 70.2pt (`LINE_FACTOR_RANGE`), so the filler
 * that leaves exactly room for it lies between 666.89 and 680.89pt
 * (`BOUNDARY`).
 *
 * - **summary-fits** sweeps that range: one summary after each filler from
 *   2pt below it to 2pt above, 2pt apart. On any engine whose boundary is in
 *   the range, one summary fits with less than 2pt to spare and the next
 *   misses by less than 2pt. The checks prove what is engine-independent:
 *   every summary whole on one page, the boundary crossed inside the sweep,
 *   and summaries moved only after the last that fitted.
 * - **summary-overflows** has one summary after a filler two lines past the
 *   range, which no plausible engine fits: it moves whole, to page 3 of 3.
 */
const statement = details(1, 10)
const total = totalRow(statement)

/**
 * The six lines of a summary. A numbered one names its number on every line,
 * so that every line of every summary in a document is a key printed once.
 */
function summary(number?: number): KeepTogether {
  const of = number === undefined ? '' : ` for summary ${number}`
  return {
    kind: 'keepTogether',
    blocks: [
      paragraph(number === undefined ? 'Summary of the statement' : `Summary ${number} of the statement`, { bold: true }),
      paragraph(`Rows counted${of}: ${statement.length}`),
      paragraph(`Gross total${of}: ${total.cells[2]}`),
      paragraph(`Discounts${of}: 0.00`),
      paragraph(`Net total${of}: ${total.cells[2]}`),
      paragraph(number === undefined ? 'Prepared for the Formancy Report corpus.' : `End of summary ${number}.`),
    ],
  }
}

const SUMMARY_LINES = summary().blocks.length

/** A body's height and a summary's, when a line is `factor` times its font size. */
const range = (factor: number): { body: number; summary: number } => ({ body: bodyHeight(factor), summary: SUMMARY_LINES * BODY_SIZE * factor })

/** The fillers that leave a summary exactly room, from the tallest lines and most room taken to the shortest. */
export const BOUNDARY = {
  min: range(LINE_FACTOR_RANGE.max).body - range(LINE_FACTOR_RANGE.max).summary,
  max: range(LINE_FACTOR_RANGE.min).body - range(LINE_FACTOR_RANGE.min).summary,
} as const

/** The sweep's step, in points: less than a fifth of a line. */
export const SWEEP_STEP = 2

/** summary-fits's fillers, from a step below the range to a step above it. */
export const SWEEP: readonly number[] = Array.from(
  { length: Math.floor((BOUNDARY.max - BOUNDARY.min) / SWEEP_STEP) + 3 },
  (_, index) => BOUNDARY.min - SWEEP_STEP + index * SWEEP_STEP,
)

/** summary-overflows's filler: two lines past the range. */
export const OVERFLOW = BOUNDARY.max + 2 * lineHeight(BODY_SIZE)

/** A 1 × 10 pixel PNG, drawn a tenth as wide as it is tall: any engine draws it at its own proportions. */
const FILLER_PIXELS = { id: 'filler', mediaType: 'image/png', bytes: encodePng(1, 10, () => [220, 220, 220]) } as const

function filler(height: number): Image {
  return { kind: 'image', asset: FILLER_PIXELS, width: height / 10, height, fit: 'contain' }
}

function statementPage(): Block[] {
  return [heading('Statement'), ledger('statement', [...statement, total])]
}

/** One section per filler, each on a page of its own: the filler, then its summary. */
const sweepDocument = documentOf('Summary at the boundary', [
  ...statementPage(),
  ...SWEEP.flatMap((height, index): Block[] => [{ kind: 'pageBreak' }, filler(height), summary(index + 1)]),
])

export const summaryFits: Fixture = {
  id: 'summary-fits',
  title: 'A summary that just fits, or just does not, swept across the page boundary: whole on one page, moved only once it does not fit',
  document: sweepDocument,
  maxPages: 40,
  expect: expectation(sweepDocument, {
    keptTogetherByRoom: true,
    // The statement, a page per filler, and a page more per summary that moved: at least one moved, and at least one did not.
    minPagesExpected: 1 + SWEEP.length + 1,
    maxPagesExpected: 1 + 2 * SWEEP.length - 1,
  }),
}

const overflowDocument = documentOf('Summary past the boundary', [...statementPage(), { kind: 'pageBreak' }, filler(OVERFLOW), summary()])

export const summaryOverflows: Fixture = {
  id: 'summary-overflows',
  title: 'A summary that does not fit and moves whole to a new page',
  document: overflowDocument,
  maxPages: 10,
  // The statement, the filler, and the summary on a page of its own.
  expect: expectation(overflowDocument, { minPagesExpected: 3, maxPagesExpected: 3 }),
}
