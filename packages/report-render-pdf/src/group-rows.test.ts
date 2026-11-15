import { readPdf, verify, type Fixture, type ReadPdf } from '@formancy/report-corpus'
import type { Block, ResolvedDocument, TableRow } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { BODY_HEIGHT, details, documentOf, fixtureOf, ledger, LINE, TIMEOUT, totalRow } from './testing/documents.js'
import { pageOf } from './testing/lines.js'

/**
 * A group header kept on its page with as many of its group's first rows
 * as its row keeps, or as many as fit (0059), proved on the PDFs read back
 * with PDF.js (0003): by the corpus's checks, which hold each header to the
 * rows its row keeps, and by the page each row's key is printed on.
 *
 * The heights the cases are built from are the renderer's own: a table row
 * of 9pt Roboto is a line of 9 × 2400/2048 = 10.546875pt, 2pt of padding
 * above and below it and the 0.5pt rule under it, 15.046875pt in all; the
 * corpus page's body is 739.14pt; and a page holds, under the table's top
 * rule and its repeated column header, 723.59pt of rows, of which a block
 * kept together may take 722.59pt, a point being kept for rounding.
 */

/** A row's pitch: its lines, its padding and the rule under it. */
const pitch = (lines: number): number => lines * 9 * LINE + 4.5

/** The rows a block kept together may take on a page under the repeated column header: the body less the top rule, the header's pitch and a point. */
const ROOM = BODY_HEIGHT - 0.5 - pitch(1) - 1

async function rendered(document: ResolvedDocument, maxPages = 10): Promise<ReadPdf> {
  return readPdf(await renderPdf(document, { maxPages }))
}

/** `label`'s group: its header keeping `keep`, `rows`, and its subtotal. */
function group(label: string, keep: number | undefined, rows: readonly TableRow[]): TableRow[] {
  const header: TableRow = { kind: 'groupHeader', cells: [`Delivery ${label}`, '', ''], ...(keep === undefined ? {} : { keepWithRows: keep }) }
  return [header, ...rows, { ...totalRow(rows, `Subtotal ${label}`), kind: 'groupFooter' }]
}

/** A detail row keyed `key` whose description is `lines` lines, each of words of its own, none of them its key. */
function tall(key: string, lines: number): TableRow {
  return { kind: 'detail', cells: [key, Array.from({ length: lines }, (_, index) => `Line ${index + 1} of item ${key.slice(4)}`).join('\n'), '1.00'] }
}

/** A detail row that prints nothing. */
const BLANK: TableRow = { kind: 'detail', cells: ['', '', ''] }

/** `fixture` expecting the group header keyed `key` to keep `count` rows -- fewer than its row says, where a page holds no more -- or none. */
function expecting(fixture: Fixture, key: string, count: number | undefined): Fixture {
  const tables = fixture.expect.tables.map((table) => ({
    ...table,
    rows: table.rows.map((row) => {
      if (row.key !== key) return row
      const { keepWithRows: _stated, ...rest } = row
      return count === undefined ? rest : { ...rest, keepWithRows: count }
    }),
  }))
  return { ...fixture, expect: { ...fixture.expect, tables } }
}

/** The same document's bytes with every row's count taken out: what a report that states none prints. */
async function withoutCounts(document: ResolvedDocument): Promise<[string, string]> {
  const strip = (blocks: readonly Block[]): Block[] =>
    blocks.map((block) => {
      if (block.kind === 'table') return { ...block, rows: block.rows.map(({ keepWithRows: _keep, ...row }) => row) }
      return block.kind === 'section' ? { ...block, blocks: strip(block.blocks) } : block
    })
  const [kept, plain] = await Promise.all([renderPdf(document, { maxPages: 10 }), renderPdf({ ...document, body: strip(document.body) }, { maxPages: 10 })])
  return [Buffer.from(kept).toString('base64'), Buffer.from(plain).toString('base64')]
}

describe('a group header that keeps three rows', () => {
  // The header kept with its first row alone could start a group at the
  // foot of a page with one row under it, or two, which is what a count
  // of three is stated to prevent. Swept across the page's foot, so that
  // some placement leaves the header no room, one row, two and three.
  test(
    'stands on the page of its first three rows, wherever the page ends',
    async () => {
      const failures: string[] = []
      for (let before = 42; before <= 50; before++) {
        const rows = [...details(1, before), ...group('D01', 3, details(before + 1, before + 4))]
        const document = documentOf('Kept rows', [ledger('deliveries', rows)])
        const pdf = await rendered(document)
        expect(verify(fixtureOf(`kept-${before}`, document, { minPagesExpected: 1, maxPagesExpected: 2 }), pdf)).toEqual([])
        const pages = ['Delivery D01', ...[1, 2, 3].map((at) => `ROW-${String(before + at).padStart(4, '0')}`)].map((key) => pageOf(pdf, key))
        if (new Set(pages).size !== 1) failures.push(`${before} rows before: ${pages.join(', ')}`)
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )

  // A group no longer than its count stands whole, header to subtotal, and
  // the table's total with it, by the closing rows' rule the block runs
  // into: kept with its rows alone, the subtotal and the total could still
  // be left behind with the last row, apart from the header.
  test(
    'prints a group of two rows that keeps both whole, with its subtotal and the total',
    async () => {
      const failures: string[] = []
      for (let before = 42; before <= 50; before++) {
        const own = group('D02', 2, details(before + 1, before + 2))
        const rows = [...details(1, before), ...own, totalRow([...details(1, before), ...own])]
        const document = documentOf('Kept group', [ledger('deliveries', rows)])
        const pdf = await rendered(document)
        expect(verify(fixtureOf(`kept-whole-${before}`, document, { minPagesExpected: 1, maxPagesExpected: 2 }), pdf)).toEqual([])
        const pages = ['Delivery D02', `ROW-${String(before + 2).padStart(4, '0')}`, 'Subtotal D02', 'Total'].map((key) => pageOf(pdf, key))
        if (new Set(pages).size !== 1) failures.push(`${before} rows before: ${pages.join(', ')}`)
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )

  // The first group of a table moves with the column header, and takes the
  // rows it keeps with it (`keepWithHeaderRows`): left to the column
  // header's own rule, the header, the group header and one row would stay
  // at the foot of the page, and the rest of the rows the group keeps go
  // to the next. Five rows of 15.05pt do not fit in the 70pt the spacer
  // leaves, and four do.
  test(
    'moves with the column header and the rows it keeps where it is the first row of its table',
    async () => {
      const document = documentOf('Kept first', [{ kind: 'spacer', height: BODY_HEIGHT - 70 }, ledger('deliveries', group('D03', 3, details(1, 4)))])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('kept-first', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect(['Key Description Amount', 'Delivery D03', 'ROW-0001', 'ROW-0003'].map((key) => pageOf(pdf, key))).toEqual([2, 2, 2, 2])
    },
    TIMEOUT,
  )
})

describe('a group header whose rows do not fit on a page with it', () => {
  // Twenty one-line rows leave 422.66pt of the first page. A header and
  // rows of 25 lines, 268.17pt each: with one row 283.22pt, which fits
  // there; with two 551.39pt, which does not, but fits a page; with three
  // 819.56pt, which fits none. Kept with its first row alone, the header
  // would start the group at the foot of the first page with one row; kept
  // with three, never; kept with the two that fit, it starts the second
  // page with them, and the third row starts the third.
  test(
    'is kept with as many as fit',
    async () => {
      expect([pitch(1) + pitch(25), pitch(1) + 2 * pitch(25), pitch(1) + 3 * pitch(25)].map((height) => height <= ROOM)).toEqual([true, true, false])
      const rows = [...details(1, 20), ...group('D04', 3, [tall('ROW-9001', 25), tall('ROW-9002', 25), tall('ROW-9003', 25)])]
      const document = documentOf('Kept as fit', [ledger('deliveries', rows)])
      const pdf = await rendered(document)
      expect(verify(expecting(fixtureOf('kept-as-fit', document, { minPagesExpected: 3, maxPagesExpected: 3 }), 'Delivery D04', 2), pdf)).toEqual([])
      expect(['ROW-0020', 'Delivery D04', 'ROW-9001', 'ROW-9002', 'ROW-9003'].map((key) => pageOf(pdf, key))).toEqual([1, 2, 2, 2, 3])
    },
    TIMEOUT,
  )

  // Rows of 40 lines, 426.38pt: a header and one is 441.42pt, which fits a
  // page, and with two 867.80pt, which does not. No count above one fits,
  // so the header is kept with its first row, as every header always was:
  // the same PDF, to the byte, as a header that keeps none.
  test(
    'is kept with its first row where no more fit, as a header that keeps none',
    async () => {
      expect([pitch(1) + pitch(40), pitch(1) + 2 * pitch(40)].map((height) => height <= ROOM)).toEqual([true, false])
      const rows = [...details(1, 20), ...group('D05', 3, [tall('ROW-9001', 40), tall('ROW-9002', 40), tall('ROW-9003', 40)])]
      const document = documentOf('Kept first row', [ledger('deliveries', rows)])
      const pdf = await rendered(document)
      expect(verify(expecting(fixtureOf('kept-first-row', document, { minPagesExpected: 4, maxPagesExpected: 4 }), 'Delivery D05', undefined), pdf)).toEqual([])
      expect(['Delivery D05', 'ROW-9001', 'ROW-9002'].map((key) => pageOf(pdf, key))).toEqual([2, 2, 3])
      const [kept, plain] = await withoutCounts(document)
      expect(kept === plain).toBe(true)
    },
    TIMEOUT,
  )
})

describe('a group header over rows with no text', () => {
  /** Rows before the header, and its place: 45 leave a header two rows under it on its page, as `stands on the page of its first three rows` sweeps. */
  const BEFORE = 45

  // A row that prints nothing counts where it stands: the header keeps
  // three rows, the second blank, and the third, which prints, is on its
  // page. A count that a blank row anywhere among them ended would fall to
  // one, and leave the header at the foot of the first page with one row.
  test(
    'counts a row with no text among the rows it keeps',
    async () => {
      const rows = [...details(1, BEFORE), ...group('D06', 3, [...details(BEFORE + 1, BEFORE + 1), BLANK, ...details(BEFORE + 2, BEFORE + 4)])]
      const document = documentOf('Kept over a blank', [ledger('deliveries', rows)])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('kept-over-blank', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect(['Delivery D06', 'ROW-0046', 'ROW-0047', 'ROW-0048'].map((key) => pageOf(pdf, key))).toEqual([2, 2, 2, 2])
    },
    TIMEOUT,
  )

  // A rule finds a row on its page by its text alone, and a block whose
  // last row prints nothing could never be held there: the header is kept
  // with the rows before it that print, here two, and stays where two fit.
  // Moved to the next page for its blank third row, it would leave the
  // two rows of room it had empty for nothing a reader could see.
  test(
    'ends the rows it keeps on the last that prints',
    async () => {
      const rows = [...details(1, BEFORE), ...group('D07', 3, [...details(BEFORE + 1, BEFORE + 2), BLANK, ...details(BEFORE + 3, BEFORE + 4)])]
      const document = documentOf('Kept before a blank', [ledger('deliveries', rows)])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('kept-before-blank', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect(['ROW-0045', 'Delivery D07', 'ROW-0046', 'ROW-0047', 'ROW-0048'].map((key) => pageOf(pdf, key))).toEqual([1, 1, 1, 1, 2])
    },
    TIMEOUT,
  )

  // A group's last row blank, and its subtotal printed: the block ends on
  // the subtotal, which prints, and the group stands whole on one page.
  // Judged by its last detail row, the header would keep two rows, and
  // the subtotal could stand apart from the header it closes.
  test(
    "keeps a whole group with its subtotal, though the group's last row prints nothing",
    async () => {
      const rows = [...details(1, BEFORE), ...group('D08', 3, [...details(BEFORE + 1, BEFORE + 2), BLANK]), ...details(BEFORE + 3, BEFORE + 6)]
      const document = documentOf('Kept to a blank', [ledger('deliveries', rows)])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('kept-to-blank', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect(['Delivery D08', 'ROW-0046', 'ROW-0047', 'Subtotal D08'].map((key) => pageOf(pdf, key))).toEqual([2, 2, 2, 2])
    },
    TIMEOUT,
  )

  // Nothing to find on the page, nothing kept: a header over rows none of
  // which prints, and a header that prints nothing over rows that do, are
  // left where they fall, to the byte as a header that keeps none. A rule
  // that went looking would move the header to a page of its own.
  test(
    'keeps nothing where the header or every row it keeps prints nothing',
    async () => {
      const unprinted: TableRow = { kind: 'groupHeader', cells: ['', '', ''], keepWithRows: 3 }
      for (const [rows, staying] of [
        [[...details(1, BEFORE), ...group('D09', 3, [BLANK, BLANK, BLANK, ...details(BEFORE + 1, BEFORE + 2)])], 'Delivery D09'],
        [[...details(1, BEFORE), unprinted, ...details(BEFORE + 1, BEFORE + 4)], 'ROW-0046'],
      ] as const) {
        const document = documentOf('Kept nothing', [ledger('deliveries', rows)])
        const pdf = await rendered(document)
        expect(pdf.pages).toHaveLength(2)
        expect(pageOf(pdf, staying)).toBe(1)
        const [kept, plain] = await withoutCounts(document)
        expect(kept === plain).toBe(true)
      }
    },
    TIMEOUT,
  )

  // A table's first group header moves with the column header, which reads
  // no text: one that prints nothing keeps its first row there, as every
  // header did, and never its count. With three, the column header, the
  // blank header and three rows of 15.05pt would not fit the 70pt the
  // spacer leaves, and the table would start on the next page.
  test(
    'keeps one row with a first group header that prints nothing',
    async () => {
      const unprinted: TableRow = { kind: 'groupHeader', cells: ['', '', ''], keepWithRows: 3 }
      const document = documentOf('Kept nothing first', [{ kind: 'spacer', height: BODY_HEIGHT - 70 }, ledger('deliveries', [unprinted, ...details(1, 4)])])
      const pdf = await rendered(document)
      expect(['ROW-0001', 'ROW-0002', 'ROW-0003'].map((key) => pageOf(pdf, key))).toEqual([1, 1, 2])
      const [kept, plain] = await withoutCounts(document)
      expect(kept === plain).toBe(true)
    },
    TIMEOUT,
  )
})

describe('a group header where its breaks are not planned', () => {
  // In a framed section a table's breaks are made by its rules alone, one
  // layout each (`table-rules.ts`): the longer block is a block like any
  // other there, and a rule that read the header's first row alone would
  // keep it with one.
  test(
    'stands on the page of its first three rows inside a framed section',
    async () => {
      const failures: string[] = []
      for (let before = 40; before <= 48; before++) {
        const rows = [...details(1, before), ...group('D10', 3, details(before + 1, before + 4))]
        const document = documentOf('Kept in a frame', [
          { kind: 'section', border: { thickness: 1, color: '#000000' }, padding: 4, blocks: [ledger('deliveries', rows)] },
        ])
        const pdf = await rendered(document)
        expect(verify(fixtureOf(`kept-framed-${before}`, document, { minPagesExpected: 1, maxPagesExpected: 2 }), pdf)).toEqual([])
        const pages = ['Delivery D10', ...[1, 2, 3].map((at) => `ROW-${String(before + at).padStart(4, '0')}`)].map((key) => pageOf(pdf, key))
        if (new Set(pages).size !== 1) failures.push(`${before} rows before: ${pages.join(', ')}`)
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )

  // A row of 80 lines is taller than a page, so the table's rows may split
  // and nothing is kept by rows' heights but group headers. The third row
  // the header keeps starts on the header's page, as its first row always
  // did; one line rows cannot split, so it stands there whole.
  test(
    'keeps its third row starting on its page in a table whose rows split',
    async () => {
      expect(pitch(80)).toBeGreaterThan(ROOM)
      const failures: string[] = []
      for (let between = 34; between <= 42; between++) {
        const rows = [tall('ROW-9001', 80), ...details(1, between), ...group('D11', 3, details(between + 1, between + 4))]
        const document = documentOf('Kept where rows split', [ledger('deliveries', rows)])
        const pdf = await rendered(document)
        expect(verify(fixtureOf(`kept-split-${between}`, document, { minPagesExpected: 2, maxPagesExpected: 3 }), pdf)).toEqual([])
        const pages = ['Delivery D11', `ROW-${String(between + 3).padStart(4, '0')}`].map((key) => pageOf(pdf, key))
        if (pages[0] !== pages[1]) failures.push(`${between} rows between: ${pages.join(', ')}`)
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )
})
