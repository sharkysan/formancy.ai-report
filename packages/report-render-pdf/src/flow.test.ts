import { readPdf, verify, type ReadPdf } from '@formancy/report-corpus'
import type { Block, Image, KeepTogether, ResolvedDocument, TableRow } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { RULE_GAP } from './content.js'
import { BODY_HEIGHT, details, documentOf, fixtureOf, heading, ledger, PAGE, paragraph, TIMEOUT, totalRow } from './testing/documents.js'
import { encodePng } from './testing/images.js'
import { lineHas, lineOf, pageLines, pageOf } from './testing/lines.js'

/**
 * How the body flows over pages: the page regions it flows between, the
 * space its blocks take, and what is kept together across a page break.
 * Each is a default of pdfmake's that the renderer works around, because the
 * default loses or misplaces content without saying so (0005).
 */

async function rendered(document: ResolvedDocument, maxPages = 20): Promise<ReadPdf> {
  return readPdf(await renderPdf(document, { maxPages }))
}

/** Unique words, so that a word found on a page is found nowhere else. */
function uniqueWords(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `word${String(index).padStart(4, '0')}`)
}

describe('the page', () => {
  // A landscape report printed on a portrait page runs off its right edge.
  test(
    'prints a landscape page as wide as its paper is tall',
    async () => {
      const document: ResolvedDocument = { ...documentOf('Landscape', [ledger('lines', details(1, 40))]), page: { ...PAGE, orientation: 'landscape' } }
      const pdf = await rendered(document)
      expect(verify(fixtureOf('landscape', document, { minPagesExpected: 2, maxPagesExpected: 3 }), pdf)).toEqual([])
      expect(pdf.pages.map(({ width, height }) => [width, height])).toEqual(pdf.pages.map(() => [841.89, 595.28]))
    },
    TIMEOUT,
  )
})

describe('page regions', () => {
  // pdfmake draws a page header into the top page margin, and a header taller
  // than that margin loses its lines without a word. The margin is measured
  // from the header itself, so a header of three lines prints all three on
  // every page and the body starts below it.
  test(
    'a page header of three lines prints whole on every page, over nothing',
    async () => {
      const lines = ['Formancy Report corpus: a page header of three lines', 'Its second line', 'Its third line']
      const document = {
        ...documentOf('Tall header', [ledger('lines', [...details(1, 120), totalRow(details(1, 120))])]),
        pageHeader: lines.map((line) => paragraph(line, { size: 8 })),
      }
      const fixture = fixtureOf('tall-header', document, { minPagesExpected: 2, maxPagesExpected: 10 })
      const pdf = await rendered(document)
      expect(verify(fixture, pdf)).toEqual([])
      for (const page of pdf.pages) {
        expect(
          lines.filter((line) => !pageLines(page).some((found) => lineHas(found, line))),
          `page ${page.number}`,
        ).toEqual([])
      }
    },
    TIMEOUT,
  )

  // A region that is not there takes no space: a report without a page
  // header starts at the top margin, and one with only a footer is not
  // pushed down by a header it does not have. A one-line header of 8pt
  // Roboto moves the body down by its line, 9.375pt, and the 6pt gap.
  test.each([
    ['a page header only', [paragraph('Only a header', { size: 8 })], [], 15.375],
    ['a page footer only', [], [paragraph('Only a footer', { size: 8 })], 0],
  ] as const)(
    'a document with %s',
    async (_, pageHeader, pageFooter, shift) => {
      const columnHeaderTop = async (document: ResolvedDocument): Promise<number> => {
        const pdf = await rendered(document)
        expect(verify(fixtureOf('regions', document, { minPagesExpected: 2, maxPagesExpected: 5 }), pdf)).toEqual([])
        return pageLines(pdf.pages[0]!).find((line) => lineHas(line, 'Key'))!.top
      }
      const bare = { ...documentOf('Regions', [ledger('lines', details(1, 120))]), pageHeader: [], pageFooter: [] }
      expect((await columnHeaderTop({ ...bare, pageHeader, pageFooter })) - (await columnHeaderTop(bare))).toBeCloseTo(shift, 3)
    },
    TIMEOUT,
  )

  // A logo in the page header is drawn on every page and must be embedded
  // once: once per page, a report grows by the logo's size for every page.
  test(
    'embeds an image in the page header once, however many pages draw it',
    async () => {
      const logo: Image = {
        kind: 'image',
        asset: { id: 'logo', mediaType: 'image/png', bytes: encodePng(16, 8, (x) => [x * 16, 0, 0]) },
        width: 32,
        height: 16,
        fit: 'contain',
      }
      const bytes = await renderPdf({ ...documentOf('Logo', [ledger('lines', details(1, 120))]), pageHeader: [logo] }, { maxPages: 10 })
      const pdf = await readPdf(bytes)
      expect(pdf.pages.length).toBeGreaterThan(2)
      expect(pdf.pages.map((page) => page.images.length)).toEqual(pdf.pages.map(() => 1))
      expect(
        Buffer.from(bytes)
          .toString('latin1')
          .match(/\/Subtype \/Image/g),
      ).toHaveLength(1)
    },
    TIMEOUT,
  )

  // A page number in a column of the page footer is still the footer's:
  // each page's number and the count, beside the footer's other column.
  test(
    'prints the page number and count in a column of the page footer',
    async () => {
      const pageFooter: Block[] = [
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: [paragraph('Formancy Report', { size: 8 })] },
            {
              width: 100,
              blocks: [
                {
                  kind: 'paragraph',
                  runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }],
                  style: { size: 8, align: 'right' },
                },
              ],
            },
          ],
        },
      ]
      const pdf = await rendered({ ...documentOf('Footer columns', [ledger('lines', details(1, 120))]), pageFooter })
      expect(pdf.pages.length).toBeGreaterThan(1)
      for (const page of pdf.pages) {
        const footer = pageLines(page).at(-1)!
        expect(footer.text, `page ${page.number}`).toBe(`Formancy Report Page ${page.number} of ${pdf.pages.length}`)
      }
    },
    TIMEOUT,
  )

  // The two points at which page regions leave no body, in 8pt Roboto, whose
  // line is 9.375pt, on the corpus page, whose printable area is 769.89pt:
  // with a one-line footer and a 6pt gap to each, 80 header lines leave the
  // body nothing; 100 do not fit the printable area at all. pdfmake would
  // lose header lines and lay the body out over the footer.
  test.each([
    [80, 'the page header and footer leave no room for the body'],
    [100, 'the page header and footer are taller than the printable area'],
  ])('refuses %i lines of page header', async (lines, message) => {
    const document = {
      ...documentOf('Header over the page', [paragraph('Body')]),
      pageHeader: Array.from({ length: lines }, (_, index) => paragraph(`Header line ${index + 1}`, { size: 8 })),
    }
    await expect(renderPdf(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'content-too-large', message: expect.stringContaining(message) })
  })
})

describe('text', () => {
  // An empty paragraph is an empty line, as in a word processor; nothing at
  // all would close up the space an author left.
  test('prints an empty paragraph as one empty line', async () => {
    const topOfBelow = async (blocks: Block[]): Promise<number> => lineOf(await rendered(documentOf('Empty', blocks), 5), 'Below').top
    const [above, below] = [paragraph('Above'), paragraph('Below')]
    // One line of the default 10pt Roboto: 10 × 2400 / 2048.
    expect((await topOfBelow([above, { kind: 'paragraph', runs: [] }, below])) - (await topOfBelow([above, below]))).toBeCloseTo(11.71875, 3)
  })

  // A paragraph that names no size prints at the renderer's default; one
  // that falls back to pdfmake's own, 12pt, would move every line after it.
  test('prints a paragraph without a size at 10pt', async () => {
    const pdf = await rendered(documentOf('Default size', [{ kind: 'paragraph', runs: [{ text: 'Plain' }] }]), 5)
    expect(pdf.pages[0]!.items.find((item) => item.text.startsWith('Plain'))!.height).toBeCloseTo(10, 5)
  })
})

describe('space', () => {
  // A spacer a line taller than asked for, or a page that starts a line
  // down after a break, moves every boundary after it: a summary that fits
  // its page moves to the next one.
  test('a spacer takes exactly its height, and a page break none', async () => {
    const topOf = async (blocks: Block[], text: string): Promise<{ page: number; top: number }> => {
      const { page, top } = lineOf(await rendered(documentOf('Space', blocks), 5), text)
      return { page, top }
    }
    const [above, below] = [paragraph('Above the space'), paragraph('Below the space')]
    const without = await topOf([above, below], 'Below the space')
    const spaced = await topOf([above, { kind: 'spacer', height: 100 }, below], 'Below the space')
    expect(spaced.top - without.top).toBeCloseTo(100, 2)
    const first = await topOf([above, below], 'Above the space')
    expect(await topOf([above, { kind: 'pageBreak' }, below], 'Below the space')).toEqual({ page: 2, top: first.top })
  })

  // A rule takes its line and 3pt above and below it, whatever its weight:
  // a thick rule that took the space of a thin one would be drawn into the
  // text after it.
  test.each([0.5, 4])('a rule %s pt thick takes its line and the space around it', async (thickness) => {
    const topOfBelow = async (blocks: Block[]): Promise<number> => lineOf(await rendered(documentOf('Rule', blocks), 5), 'Below the rule').top
    const [above, below] = [paragraph('Above the rule'), paragraph('Below the rule')]
    expect((await topOfBelow([above, { kind: 'rule', thickness }, below])) - (await topOfBelow([above, below]))).toBeCloseTo(2 * RULE_GAP + thickness, 3)
  })
})

describe('keeping content together', () => {
  // pdfmake 0.3.11 draws an unbreakable block taller than the page nowhere
  // at all, and says nothing. A keep-together block that cannot fit on any
  // page is refused instead.
  test('refuses a keep-together block taller than a page', async () => {
    const tall: KeepTogether = { kind: 'keepTogether', blocks: Array.from({ length: 120 }, (_, index) => paragraph(`Kept line ${index + 1}`)) }
    await expect(renderPdf(documentOf('Tall block', [tall]), { maxPages: 10 })).rejects.toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
  })

  // A heading and a table inside a keep-together block move with it, whole:
  // no keep-with-next or group-header rule may break inside the block, where
  // pdfmake would lose what follows the break.
  test(
    'moves a heading and a table inside a keep-together block with the block',
    async () => {
      const block: KeepTogether = {
        kind: 'keepTogether',
        blocks: [heading('A table kept whole'), ledger('kept', [{ kind: 'groupHeader', cells: ['Region K', '', ''] }, ...details(1, 4)])],
      }
      const document = documentOf('Table in a block', [{ kind: 'spacer', height: BODY_HEIGHT - 60 }, block])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('kept-table', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect(['A table kept whole', 'Region K', 'ROW-0001', 'ROW-0004'].map((text) => pageOf(pdf, text))).toEqual([2, 2, 2, 2])
    },
    TIMEOUT,
  )

  // A row of several lines split by a page break reads as two rows, the
  // second without its key. Rows that fit on a page move whole to the next.
  // Whether they fit is measured, row by row; a row whose first cell is
  // empty is measured as well as one whose first cell has its key.
  test.each([
    ['its key in the first cell', (key: string, words: string): string[] => [key, words, '1.00']],
    ['an empty first cell', (key: string, words: string): string[] => ['', `${key} ${words}`, '1.00']],
  ])(
    'never splits a row that fits on a page, with %s',
    async (_, cellsOf) => {
      // Rows of 30 to 69 words, so that page breaks fall inside rows rather than between them.
      const counts = Array.from({ length: 40 }, (_, index) => 30 + ((index * 13) % 40))
      const words = uniqueWords(counts.reduce((sum, count) => sum + count, 0))
      const starts = counts.map((_, index) => counts.slice(0, index).reduce((sum, count) => sum + count, 0))
      const rows: TableRow[] = counts.map((count, index) => ({
        kind: 'detail',
        cells: cellsOf(`ROW-${String(index + 1).padStart(4, '0')}`, words.slice(starts[index], starts[index]! + count).join(' ')),
      }))
      const document = documentOf('Tall rows', [ledger('lines', rows)])
      const printed = rows.map((row) => row.cells.slice(0, 2).join(' ').trim().split(' '))
      const pdf = await rendered(document)
      expect(verify(fixtureOf('tall-rows', document, { keys: printed.flat(), minPagesExpected: 2, maxPagesExpected: 10 }), pdf)).toEqual([])
      expect(printed.filter((each) => pageOf(pdf, each[0]!) !== pageOf(pdf, each.at(-1)!)).map((each) => each[0])).toEqual([])
    },
    TIMEOUT,
  )

  // A heading at the foot of a page with what it heads on the next one. The
  // spacer leaves 20pt: room for the 14pt heading, not for what follows.
  // What it heads starts where its first text or image does: past a spacer
  // at the top of a keep-together block, for one.
  test.each([
    ['the table it heads', ledger('lines', details(1, 5))],
    [
      'the image it heads',
      {
        kind: 'image',
        asset: { id: 'chart', mediaType: 'image/png', bytes: encodePng(16, 8, () => [0, 90, 0]) },
        width: 80,
        height: 40,
        fit: 'contain',
      } as const,
    ],
    [
      'the keep-together block it heads',
      { kind: 'keepTogether', blocks: [{ kind: 'spacer', height: 2 }, paragraph('Kept under the heading'), paragraph('And kept with it')] } as const,
    ],
    [
      'the columns it heads',
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [{ kind: 'spacer', height: 30 }] },
          { width: 'fill', blocks: [paragraph('Beside nothing'), paragraph('And below it')] },
        ],
      } as const,
    ],
    [
      'the framed section it heads',
      {
        kind: 'section',
        border: { thickness: 1, color: '#000000' },
        blocks: [paragraph('Framed under the heading'), paragraph('And framed with it')],
      } as const,
    ],
  ] as const)(
    'moves a heading to the next page with %s',
    async (_, headed) => {
      const document = documentOf('Heading at the foot', [{ kind: 'spacer', height: BODY_HEIGHT - 20 }, heading('Lines'), headed])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('heading-at-foot', document, { minPagesExpected: 2, maxPagesExpected: 2, noEmptyPages: false }), pdf)).toEqual([])
      expect(pageOf(pdf, 'Lines')).toBe(2)
      expect(pdf.pages[0]!.images.length + pageLines(pdf.pages[0]!).filter((line) => !/^(Formancy Report corpus|Page \d)/.test(line.text)).length).toBe(0)
    },
    TIMEOUT,
  )

  // A heading with nothing after it to keep it with, at the end or before a
  // page break, stays where it falls rather than moving to a page of its own.
  test.each([
    ['at the end', [] as Block[]],
    ['before a page break', [{ kind: 'pageBreak' }, paragraph('Next chapter')] as Block[]],
  ])(
    'leaves a heading with nothing after it where it falls, %s',
    async (_, after) => {
      const pdf = await rendered(documentOf('Last heading', [{ kind: 'spacer', height: BODY_HEIGHT - 20 }, heading('Closing remarks'), ...after]), 5)
      expect(pageOf(pdf, 'Closing remarks')).toBe(1)
    },
    TIMEOUT,
  )

  // Two headings in a row, the second over a table: kept one at a time, the
  // first would stay with the second and the second move without it. A
  // spacer, a rule and a rectangle between them and the table print no text
  // to be kept with, and are passed over. A section without a frame is not
  // there: the heading inside it is kept with the table after it.
  test(
    'moves a run of headings to the next page together',
    async () => {
      const document = documentOf('Headings at the foot', [
        { kind: 'spacer', height: BODY_HEIGHT - 40 },
        heading('Ledger section'),
        { kind: 'section', blocks: [heading('Ledger lines')] },
        { kind: 'spacer', height: 1 },
        { kind: 'rule', thickness: 0.5 },
        { kind: 'rectangle', width: 20, height: 1, fill: '#cccccc' },
        ledger('lines', details(1, 5)),
      ])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('headings-at-foot', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect([pageOf(pdf, 'Ledger section'), pageOf(pdf, 'Ledger lines'), pageOf(pdf, 'ROW-0001')]).toEqual([2, 2, 2])
    },
    TIMEOUT,
  )

  // The rule above, where it cannot hold: a heading first on its page, over a
  // block too tall to share the page with it. Moving the heading would leave
  // an empty page behind and orphan it again on the next; it stays.
  test(
    'leaves a heading where it is when what follows cannot share a page with it',
    async () => {
      // 69 lines of 9pt Roboto are 727.7pt, which fits the corpus page's body
      // of 739.1pt; a 14pt heading's 16.4pt more does not.
      const block: KeepTogether = { kind: 'keepTogether', blocks: Array.from({ length: 69 }, (_, index) => paragraph(`Kept line ${index + 1}`)) }
      expect((await rendered(documentOf('A full page', [block]), 5)).pages).toHaveLength(1)
      const pdf = await rendered(documentOf('Heading over a full page', [heading('Kept lines'), block]), 5)
      expect(pdf.pages).toHaveLength(2)
      expect(pageOf(pdf, 'Kept lines')).toBe(1)
      expect(pageOf(pdf, 'Kept line 1')).toBe(2)
    },
    TIMEOUT,
  )

  // The corpus's group-boundary fixture has rows of one line. A row of nine
  // that does not fit under its group header moves to the next page whole,
  // and pdfmake reports every line of it but the first as still on the page
  // before: the group header must not be fooled into staying behind. Swept
  // across the page boundary, so that some placement puts the group header
  // last on the first page.
  test(
    'keeps a group header with a row of several lines, wherever the page breaks',
    async () => {
      const description = uniqueWords(60).join(' ')
      for (let before = 40; before <= 52; before++) {
        const rows: TableRow[] = [
          ...details(1, before),
          { kind: 'groupHeader', cells: ['Region B', '', ''] },
          { kind: 'detail', cells: ['ROW-9001', description, '1.00'] },
          ...details(before + 1, before + 3),
        ]
        const document = documentOf('Group header over a tall row', [ledger('lines', rows)])
        expect(verify(fixtureOf(`group-header-before-${before}`, document, { minPagesExpected: 2, maxPagesExpected: 3 }), await rendered(document))).toEqual([])
      }
    },
    TIMEOUT,
  )

  // A row that fits a page under the column header, but not under its group
  // header as well, cannot be kept whole and with its group header at once:
  // kept whole, it moves to the next page and leaves the group header behind.
  // The row splits instead. 68 lines of 9pt Roboto with padding and rule are
  // 721.7pt; under the repeated header, 722.6pt of the body is left, and
  // 707.5pt under a group header too.
  test(
    'splits a row that fits on a page only without its group header',
    async () => {
      const description = Array.from({ length: 68 }, (_, index) => `Line ${index + 1} of the description`).join('\n')
      const rows: TableRow[] = [
        ...details(1, 48),
        { kind: 'groupHeader', cells: ['Region T', '', ''] },
        { kind: 'detail', cells: ['ROW-9002', description, '1.00'] },
        ...details(49, 50),
      ]
      const document = documentOf('Group header over a page-high row', [ledger('lines', rows)])
      expect(verify(fixtureOf('group-header-page-high-row', document, { minPagesExpected: 2, maxPagesExpected: 4 }), await rendered(document))).toEqual([])
    },
    TIMEOUT,
  )

  // A group header over a row that prints nothing has nothing on the page
  // to be kept with. A rule that went looking anyway would never find it,
  // and move the group header to a page of its own every time.
  test(
    'leaves a group header over an empty row where it falls',
    async () => {
      const rows: TableRow[] = [
        ...details(1, 3),
        { kind: 'groupHeader', cells: ['Region C', '', ''] },
        { kind: 'detail', cells: ['', '', ''] },
        ...details(4, 6),
      ]
      const pdf = await rendered(documentOf('Group header over nothing', [ledger('lines', rows)]), 5)
      expect(pdf.pages).toHaveLength(1)
      expect(pageOf(pdf, 'Region C')).toBe(1)
    },
    TIMEOUT,
  )

  // The group header the corpus's group-boundary fixture cannot reach: the
  // first row of a table that starts near the foot of a page, under the
  // column header. Both move with the first detail row.
  test(
    'keeps a table that starts with a group header together with its first detail row',
    async () => {
      const rows: TableRow[] = [{ kind: 'groupHeader', cells: ['Region A', '', ''] }, ...details(1, 3)]
      const document = documentOf('Group header first', [{ kind: 'spacer', height: BODY_HEIGHT - 38 }, ledger('lines', rows)])
      const pdf = await rendered(document)
      expect(verify(fixtureOf('group-header-first', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      expect(pageOf(pdf, 'Region A')).toBe(2)
    },
    TIMEOUT,
  )
})
