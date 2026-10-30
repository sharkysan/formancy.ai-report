import { readPdf, type ReadPdf } from '@formancy/report-corpus'
import type { Block, ResolvedDocument, TableColumn } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { bareDocument, ledger, paragraph, PAGE, PRINTABLE_WIDTH, TIMEOUT } from './testing/documents.js'
import { MAX_WORD_LINES } from './words.js'

/**
 * A word wider than where it stands. pdfmake widens a column it is handed
 * as `'*'` to its longest word, so a table, a column or a frame grew past
 * the page and its right-hand side printed off the paper, while the render
 * succeeded. The renderer hands pdfmake every width as a number, refuses a
 * table cell whose word is wider than its column -- broken anywhere, an
 * amount would print as two numbers -- and lets a paragraph break a long
 * word across lines, up to a bound that keeps pdfmake's breaking from
 * costing more than a moment.
 */

const LEFT = PAGE.margins.left
const RIGHT = LEFT + PRINTABLE_WIDTH
const WIDE = 'W'.repeat(100)

async function refusal(document: ResolvedDocument): Promise<unknown> {
  return renderPdf(document, { maxPages: 20 }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

async function printed(body: readonly Block[]): Promise<ReadPdf> {
  return readPdf(await renderPdf(bareDocument('Widths', body), { maxPages: 20 }))
}

/** Every run of the PDF, with the page it is on. */
const runs = (pdf: ReadPdf) => pdf.pages.flatMap((page) => page.items)

describe('a table cell', () => {
  // 100 W in a fill column pushed the table to 980pt on a 595pt page, and
  // every column right of it off the paper; a German compound word in the
  // quotation's description pushed its amounts past the right margin.
  test(
    'is refused when a word in it is wider than its column, fill or fixed',
    async () => {
      const wide = ledger('wide-word', [{ kind: 'detail', cells: ['K-1', WIDE, '1234.50'] }])
      expect(await refusal(bareDocument('Wide word', [wide]))).toMatchObject({
        code: 'content-too-large',
        subject: 'wide-word',
        message: expect.stringContaining('column 2') as string,
      })
      const columns: TableColumn[] = [
        { width: 60, align: 'left' },
        { width: 'fill', align: 'left' },
        { width: 50, align: 'right' },
      ]
      const amount = ledger('amount', [{ kind: 'total', cells: ['Total', '', 'CHF 10,612,357.00'] }], columns)
      expect(await refusal(bareDocument('Amount', [amount]))).toMatchObject({
        code: 'content-too-large',
        subject: 'amount',
        message: expect.stringContaining('column 3') as string,
      })
    },
    TIMEOUT,
  )

  // A row across the table has the whole table's width, less its padding.
  test(
    'across the table has every column for its word',
    async () => {
      const across = ledger('across', [
        { kind: 'groupHeader', cells: ['W'.repeat(40)], across: true },
        { kind: 'detail', cells: ['K-1', 'Short', '1.00'] },
      ])
      expect(await refusal(bareDocument('Across', [across]))).toBe('rendered')
    },
    TIMEOUT,
  )

  // pdfmake breaks a word one line at a time, measuring all that is left of
  // it for each: 16,384 W in a 20pt column took 42 seconds before it was
  // drawn. Refused before pdfmake lays out a line.
  test(
    'refuses a word of any length before pdfmake breaks it',
    async () => {
      const columns: TableColumn[] = [
        { width: 28, align: 'left' },
        { width: 'fill', align: 'left' },
        { width: 90, align: 'right' },
      ]
      const started = performance.now()
      const outcome = await refusal(bareDocument('Long word', [ledger('long', [{ kind: 'detail', cells: ['W'.repeat(16_384), 'B', '1.00'] }], columns)]))
      expect(outcome).toMatchObject({ code: 'content-too-large', subject: 'long' })
      expect(performance.now() - started).toBeLessThan(15_000)
    },
    TIMEOUT,
  )
})

describe('a fill column and a frame', () => {
  // The fill slot widened to its word and pushed the right column off the
  // paper; now the word breaks inside its slot, and the right column stands
  // where its width puts it.
  test(
    'keep a long word in a paragraph inside the slot it stands in',
    async () => {
      const pdf = await printed([
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: [paragraph(WIDE)] },
            { width: 150, blocks: [paragraph('RIGHT COLUMN TEXT')] },
          ],
        },
      ])
      const right = runs(pdf).find((run) => run.text.startsWith('RIGHT'))
      expect(right?.x).toBeCloseTo(RIGHT - 150, 3)
      const left = runs(pdf).filter((run) => run.text.startsWith('W'))
      expect(left.map((run) => run.text).join('')).toBe(WIDE)
      expect(Math.max(...left.map((run) => run.x + run.width))).toBeLessThanOrEqual(RIGHT - 150 + 0.01)
    },
    TIMEOUT,
  )

  // A framed section's one cell was '*' too: 31 of 100 W ran off the page.
  test(
    'keep a long word in a paragraph inside the frame',
    async () => {
      const pdf = await printed([{ kind: 'section', border: { thickness: 1, color: '#000000' }, padding: 6, blocks: [paragraph(WIDE)] }])
      const word = runs(pdf).filter((run) => run.text.startsWith('W'))
      expect(word.map((run) => run.text).join('')).toBe(WIDE)
      expect(Math.min(...word.map((run) => run.x))).toBeGreaterThanOrEqual(LEFT + 7 - 0.01)
      expect(Math.max(...word.map((run) => run.x + run.width))).toBeLessThanOrEqual(RIGHT - 7 + 0.01)
    },
    TIMEOUT,
  )
})

describe('a paragraph', () => {
  // A long identifier breaks across lines, as the corpus's long-paragraph
  // fixture asks; one that would take more than the bound's lines is
  // refused, naming the block, before pdfmake breaks any of it.
  test(
    `breaks a word across up to ${MAX_WORD_LINES} lines, and refuses a longer one`,
    async () => {
      const column = (text: string): Block => ({
        kind: 'columns',
        columns: [
          { width: 40, blocks: [paragraph(text)] },
          { width: 'fill', blocks: [] },
        ],
      })
      expect(await refusal(bareDocument('Broken', [column('W'.repeat(4 * MAX_WORD_LINES))]))).toBe('rendered')
      expect(await refusal(bareDocument('Too long', [paragraph('Before'), column('W'.repeat(16_384))]))).toMatchObject({
        code: 'content-too-large',
        subject: 'body[1].columns[0].blocks[0]',
      })
    },
    TIMEOUT,
  )
})
