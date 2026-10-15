import { fileURLToPath } from 'node:url'
import pdfmake from 'pdfmake'
import { describe, expect, test, vi } from 'vitest'
import { verify, verifyRefusal } from '../checks.js'
import { pageDimensions, RenderRefusal, type Block, type Image, type KeepTogether, type RenderOptions, type ResolvedDocument, type TableColumn, type TableRow } from '../document.js'
import { expectation, type Fixture, type Stated } from '../fixture.js'
import { ALL_FIXTURES } from '../fixtures/all.js'
import { details, documentOf, heading, ledger, paragraph, totalRow } from '../fixtures/build.js'
import { BODY_HEIGHT, PRINTABLE_WIDTH } from '../fixtures/geometry.js'
import { longTable } from '../fixtures/long-table.js'
import { oneRow } from '../fixtures/one-row.js'
import { oversized } from '../fixtures/oversized.js'
import { encodePng } from '../fixtures/png.js'
import { uniqueWords } from '../fixtures/words.js'
import { lineHas, pageLines } from '../lines.js'
import { readPdf, type ReadPdf } from '../read-pdf.js'
import { pdfmakeAdapter } from './pdfmake.js'
import { RULE_SPACE } from './pdfmake-content.js'

/**
 * pdfmake on the corpus: every fixture rendered by the adapter and proved on
 * the PDF it produced, with the corpus's own checks, never on the definition
 * pdfmake was given.
 */

/**
 * The fixtures pdfmake cannot satisfy, each with what it cannot do and
 * exactly the problems the checks report. A fixture listed here is still
 * rendered and checked, and its case asserts those problems: it fails the day
 * the fixture passes and the day it fails another way, so the list can
 * neither outlive its finding nor stand for a different one.
 */
const CANNOT: ReadonlyMap<string, { readonly reason: string; readonly problems: readonly string[] }> = new Map()

/** Long enough for the corpus's largest documents on a slow runner; a render that hangs still fails. */
const TIMEOUT = 120_000

/** What the fixture's checks find wrong with what the adapter did: a PDF that fails them, or a refusal that is not the one expected. */
async function problems(fixture: Fixture, options: RenderOptions = { maxPages: fixture.maxPages }): Promise<string[]> {
  const rendered = await pdfmakeAdapter.render(fixture.document, options).then(
    (bytes) => ({ bytes }),
    (error: unknown) => ({ error }),
  )
  if ('error' in rendered) return verifyRefusal(fixture, rendered.error)
  return verify(fixture, await readPdf(rendered.bytes))
}

describe('pdfmake on the corpus', () => {
  // Each fixture is one way a report goes wrong -- a row lost at a page
  // break, a header that does not repeat, a total that is not the one the
  // data holds, a truncated job -- and its checks are what would see it.
  // A fixture here that passes is one pdfmake, through this adapter, does
  // not get wrong.
  for (const fixture of ALL_FIXTURES) {
    const finding = CANNOT.get(fixture.id)
    test(`${fixture.id}: ${finding === undefined ? fixture.title : `fails: ${finding.reason}`}`, async () => {
      expect(await problems(fixture)).toEqual(finding?.problems ?? [])
    }, TIMEOUT)
  }
})

describe('the pdfmake adapter', () => {
  // A PDF that differs on every run cannot be reproduced from its inputs, nor
  // found again by its digest: the creation date is the document's own.
  test('renders the same document to the same bytes', async () => {
    const options = { maxPages: oneRow.maxPages }
    const [first, second] = await Promise.all([pdfmakeAdapter.render(oneRow.document, options), pdfmakeAdapter.render(oneRow.document, options)])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  })

  // The version recorded with every trial result is the engine that ran, not
  // the one a manifest asked for.
  test('names pdfmake and the version installed', () => {
    expect(pdfmakeAdapter.name).toBe('pdfmake')
    expect(pdfmakeAdapter.version).toBe('0.3.11')
  })

  // A cancelled job that still returns a PDF has not been cancelled.
  test('refuses a job whose signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(pdfmakeAdapter.render(oneRow.document, { maxPages: 5, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' })
  })

  // An abort that arrives while pdfmake works: its layout is synchronous and
  // cannot be interrupted, so the adapter must look again once it returns,
  // rather than hand back the PDF of a job the caller gave up on.
  test('refuses a job aborted while it renders', async () => {
    const controller = new AbortController()
    const rendering = pdfmakeAdapter.render(oneRow.document, { maxPages: 5, signal: controller.signal })
    controller.abort()
    await expect(rendering).rejects.toBeInstanceOf(RenderRefusal)
    await expect(rendering).rejects.toMatchObject({ code: 'cancelled' })
  })
})

describe('the page limit', () => {
  // pdfmake's own limit, `maxPagesNumber`, cuts the document short and
  // returns the first pages as though they were all of it. The adapter's
  // limit must refuse one page past it and allow exactly it, or a report one
  // page over the limit arrives looking complete.
  test('allows a document of exactly the limit and refuses one page more', async () => {
    const pages = (await readPdf(await pdfmakeAdapter.render(longTable.document, { maxPages: longTable.maxPages }))).pages.length
    expect(pages).toBeGreaterThan(1)
    expect((await readPdf(await pdfmakeAdapter.render(longTable.document, { maxPages: pages }))).pages).toHaveLength(pages)
    await expect(pdfmakeAdapter.render(longTable.document, { maxPages: pages - 1 })).rejects.toMatchObject({ code: 'too-many-pages' })
  }, TIMEOUT)

  // A refusal that comes only after laying out all six thousand rows costs
  // what rendering them would: the limit bounds the work, not just the
  // output. Watched on pdfmake itself, which still does the layout: each of
  // the adapter's passes is laid out until pdfmake begins a page past the
  // limit's worth of paper, and no further.
  test('stops laying out an oversized job one page past the limit', async () => {
    const laidOut: number[] = []
    const createPdf = pdfmake.createPdf.bind(pdfmake)
    const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
      const pass = laidOut.push(0) - 1
      const background = definition.background
      return createPdf(
        {
          ...definition,
          background: (page, size) => {
            // The height of the pages begun before this one.
            laidOut[pass] = (page - 1) * size.height
            return typeof background === 'function' ? background(page, size) : null
          },
        },
        options,
      )
    })
    try {
      await expect(pdfmakeAdapter.render(oversized.document, { maxPages: oversized.maxPages })).rejects.toMatchObject({ code: 'too-many-pages' })
    } finally {
      spy.mockRestore()
    }
    const { height } = pageDimensions(oversized.document.page)
    expect(laidOut.length).toBeGreaterThan(0)
    expect(Math.max(...laidOut)).toBeLessThanOrEqual((oversized.maxPages + 1) * height)
  }, TIMEOUT)
})

describe('page regions', () => {
  // pdfmake draws a page header into the top page margin, and a header taller
  // than that margin loses its lines without a word. The margin is measured
  // from the header itself, so a header of three lines prints all three on
  // every page and the body starts below it.
  test('a page header of three lines prints whole on every page, over nothing', async () => {
    const lines = ['Formancy Report corpus: a page header of three lines', 'Its second line', 'Its third line']
    const document = { ...documentOf('Tall header', [ledger('lines', [...details(1, 120), totalRow(details(1, 120))])]), pageHeader: lines.map((line) => paragraph(line, { size: 8 })) }
    const fixture = fixtureOf('tall-header', document, { minPagesExpected: 2, maxPagesExpected: 10 })
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
    expect(verify(fixture, pdf)).toEqual([])
    for (const page of pdf.pages) {
      expect(lines.filter((line) => !pageLines(page).some((found) => lineHas(found, line))), `page ${page.number}`).toEqual([])
    }
  }, TIMEOUT)

  // A region that is not there takes no space: a report without a page
  // header starts at the top margin, and one with only a footer is not
  // pushed down by a header it does not have. A one-line header of 8pt
  // Roboto moves the body down by its line, 9.375pt, and the 6pt gap.
  test.each([
    ['a page header only', [paragraph('Only a header', { size: 8 })], [], 15.375],
    ['a page footer only', [], [paragraph('Only a footer', { size: 8 })], 0],
  ] as const)('a document with %s', async (_, pageHeader, pageFooter, shift) => {
    const columnHeaderTop = async (document: ResolvedDocument): Promise<number> => {
      const fixture = fixtureOf('regions', document, { minPagesExpected: 2, maxPagesExpected: 5 })
      const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
      expect(verify(fixture, pdf)).toEqual([])
      return pageLines(pdf.pages[0]!).find((line) => lineHas(line, 'Key'))!.top
    }
    const bare = { ...documentOf('Regions', [ledger('lines', details(1, 120))]), pageHeader: [], pageFooter: [] }
    expect((await columnHeaderTop({ ...bare, pageHeader, pageFooter })) - (await columnHeaderTop(bare))).toBeCloseTo(shift, 3)
  }, TIMEOUT)

  // A logo in the page header is drawn on every page and must be embedded
  // once: once per page, a report grows by the logo's size for every page.
  test('embeds an image in the page header once, however many pages draw it', async () => {
    const logo: Image = { kind: 'image', asset: { id: 'logo', mediaType: 'image/png', bytes: encodePng(16, 8, (x) => [x * 16, 0, 0]) }, width: 32, height: 16 }
    const document = { ...documentOf('Logo', [ledger('lines', details(1, 120))]), pageHeader: [logo] }
    const bytes = await pdfmakeAdapter.render(document, { maxPages: 10 })
    const pdf = await readPdf(bytes)
    expect(pdf.pages.length).toBeGreaterThan(2)
    expect(pdf.pages.map((page) => page.images.length)).toEqual(pdf.pages.map(() => 1))
    expect(Buffer.from(bytes).toString('latin1').match(/\/Subtype \/Image/g)).toHaveLength(1)
  }, TIMEOUT)

  // The two points at which page regions leave no body, in 8pt Roboto, whose
  // line is 9.375pt, on the corpus page, whose printable area is 769.89pt:
  // with a one-line footer and a 6pt gap to each, 80 header lines leave the
  // body nothing; 100 do not fit the printable area at all. pdfmake would
  // lose header lines and lay the body out over the footer.
  test.each([
    [80, 'the page header and footer leave no room for the body'],
    [100, 'the page header and footer are taller than the printable area'],
  ])('refuses %i lines of page header', async (lines, message) => {
    const document = { ...documentOf('Header over the page', [paragraph('Body')]), pageHeader: Array.from({ length: lines }, (_, index) => paragraph(`Header line ${index + 1}`, { size: 8 })) }
    await expect(pdfmakeAdapter.render(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'content-too-large', message: expect.stringContaining(message) })
  })
})

describe('text', () => {
  // A run's bold and a paragraph's italic are each a font the PDF must carry
  // and use, and a paragraph that names no size has the default one: a style
  // lost on the way prints in the wrong face, without an error.
  test('prints each run in its own face, embedded, and a paragraph without a size at 10pt', async () => {
    const document = documentOf('Styles', [
      { kind: 'paragraph', runs: [{ text: 'Plain and ' }, { text: 'bold', bold: true }] },
      { kind: 'paragraph', runs: [{ text: 'Italic and ' }, { text: 'bold italic', bold: true }], style: { italic: true } },
    ])
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: 5 }))
    const faces = pdf.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, ''))
    expect(faces).toEqual(expect.arrayContaining(['Roboto-Regular', 'Roboto-Medium', 'Roboto-Italic', 'Roboto-MediumItalic']))
    expect(pdf.fonts.filter((font) => !font.embedded)).toEqual([])
    expect(pdf.pages[0]!.items.find((item) => item.text.startsWith('Plain'))!.height).toBeCloseTo(10, 5)
  })

  // An empty paragraph is an empty line, as in a word processor; nothing at
  // all would close up the space an author left.
  test('prints an empty paragraph as one empty line', async () => {
    const topOfBelow = async (blocks: Block[]): Promise<number> => {
      const pdf = await readPdf(await pdfmakeAdapter.render(documentOf('Empty', blocks), { maxPages: 5 }))
      return pageLines(pdf.pages[0]!).find((line) => lineHas(line, 'Below'))!.top
    }
    const [above, below] = [paragraph('Above'), paragraph('Below')]
    // One line of the default 10pt Roboto: 10 × 2400 / 2048.
    expect((await topOfBelow([above, { kind: 'paragraph', runs: [] }, below])) - (await topOfBelow([above, below]))).toBeCloseTo(11.71875, 3)
  })
})

describe('pdfmake as the adapter configures it', () => {
  // The adapter's documents name no file and no address, but pdfmake reads
  // either when a definition names one. Its policies are what would stop a
  // definition that reached it from reading the server's files or calling
  // out: set by the adapter, they allow the four font files and nothing else.
  test('reads no file but its fonts, and no address at all', async () => {
    await pdfmakeAdapter.render(oneRow.document, { maxPages: 5 })
    const attempt = (source: string): Promise<Buffer> => pdfmake.createPdf({ images: { source }, content: [{ image: 'source', width: 10, height: 10 }] }).getBuffer()
    await expect(attempt('https://example.invalid/logo.png')).rejects.toThrow(/Access to URL denied/)
    await expect(attempt(fileURLToPath(import.meta.url))).rejects.toThrow(/Access to local file denied/)
  })

  // pdfmake's fonts and policies are one setting for the whole process. A
  // host that configured pdfmake for something else -- every file and
  // address allowed, no fonts -- must not change what the adapter renders
  // with: the adapter sets its own again for every render, so the render
  // still embeds Roboto, and afterwards pdfmake still reads nothing else.
  test('sets its fonts and policies again for each render, over what anything else set', async () => {
    pdfmake.setFonts({})
    pdfmake.setLocalAccessPolicy(() => true)
    pdfmake.setUrlAccessPolicy(() => true)
    const pdf = await readPdf(await pdfmakeAdapter.render(oneRow.document, { maxPages: 5 }))
    expect(pdf.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, ''))).toContain('Roboto-Regular')
    expect(pdf.fonts.filter((font) => !font.embedded)).toEqual([])
    const attempt = (source: string): Promise<Buffer> => pdfmake.createPdf({ images: { source }, content: [{ image: 'source', width: 10, height: 10 }] }).getBuffer()
    await expect(attempt(fileURLToPath(import.meta.url))).rejects.toThrow(/Access to local file denied/)
    await expect(attempt('https://example.invalid/logo.png')).rejects.toThrow(/Access to URL denied/)
  })
})

describe('space', () => {
  // A spacer a line taller than asked for, or a page that starts a line
  // down after a break, moves every boundary after it: a summary that fits
  // its page moves to the next one.
  test('a spacer takes exactly its height, and a page break none', async () => {
    const topOf = async (blocks: Block[], text: string): Promise<{ page: number; top: number }> => {
      const pdf = await readPdf(await pdfmakeAdapter.render(documentOf('Space', blocks), { maxPages: 5 }))
      const page = pdf.pages.find((each) => pageLines(each).some((line) => lineHas(line, text)))!
      return { page: page.number, top: pageLines(page).find((line) => lineHas(line, text))!.top }
    }
    const [above, below] = [paragraph('Above the space'), paragraph('Below the space')]
    const without = await topOf([above, below], 'Below the space')
    const spaced = await topOf([above, { kind: 'spacer', height: 100 }, below], 'Below the space')
    expect(spaced.top - without.top).toBeCloseTo(100, 2)
    const first = await topOf([above, below], 'Above the space')
    expect(await topOf([above, { kind: 'pageBreak' }, below], 'Below the space')).toEqual({ page: 2, top: first.top })
  })

  // A rule is a half-point line with 3pt above and below it; what the checks
  // can see of it is the space it takes, since they read no vector paths.
  test('a rule takes its line and the space around it', async () => {
    const topOfBelow = async (blocks: Block[]): Promise<number> => {
      const pdf = await readPdf(await pdfmakeAdapter.render(documentOf('Rule', blocks), { maxPages: 5 }))
      return pageLines(pdf.pages[0]!).find((line) => lineHas(line, 'Below the rule'))!.top
    }
    const [above, below] = [paragraph('Above the rule'), paragraph('Below the rule')]
    expect((await topOfBelow([above, { kind: 'rule' }, below])) - (await topOfBelow([above, below]))).toBeCloseTo(RULE_SPACE, 3)
  })
})

describe('keeping content together', () => {
  // pdfmake 0.3.11 draws an unbreakable block taller than the page nowhere
  // at all, and says nothing. A keep-together block that cannot fit on any
  // page is refused instead.
  test('refuses a keep-together block taller than a page', async () => {
    const tall: KeepTogether = { kind: 'keepTogether', blocks: Array.from({ length: 120 }, (_, index) => paragraph(`Kept line ${index + 1}`)) }
    await expect(pdfmakeAdapter.render(documentOf('Tall block', [tall]), { maxPages: 10 })).rejects.toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
  })

  // A heading and a table inside a keep-together block move with it, whole:
  // no keep-with-next or group-header rule may break inside the block, where
  // pdfmake would lose what follows the break.
  test('moves a heading and a table inside a keep-together block with the block', async () => {
    const block: KeepTogether = { kind: 'keepTogether', blocks: [heading('A table kept whole'), ledger('kept', [{ kind: 'groupHeader', cells: ['Region K', '', ''] }, ...details(1, 4)])] }
    const document = documentOf('Table in a block', [{ kind: 'spacer', height: BODY_HEIGHT - 60 }, block])
    const fixture = fixtureOf('kept-table', document, { minPagesExpected: 2, maxPagesExpected: 2 })
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
    expect(verify(fixture, pdf)).toEqual([])
    expect(['A table kept whole', 'Region K', 'ROW-0001', 'ROW-0004'].map((text) => pageOf(pdf, text))).toEqual([2, 2, 2, 2])
  }, TIMEOUT)

  // A row of several lines split by a page break reads as two rows, the
  // second without its key. Rows that fit on a page move whole to the next.
  // Whether they fit is measured, row by row; a row whose first cell is
  // empty is measured as well as one whose first cell has its key.
  test.each([
    ['its key in the first cell', (key: string, words: string): string[] => [key, words, '1.00']],
    ['an empty first cell', (key: string, words: string): string[] => ['', `${key} ${words}`, '1.00']],
  ])('never splits a row that fits on a page, with %s', async (_, cellsOf) => {
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
    const fixture = fixtureOf('tall-rows', document, { keys: printed.flat(), minPagesExpected: 2, maxPagesExpected: 10 })
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
    expect(verify(fixture, pdf)).toEqual([])
    const split = printed.filter((words) => pageOf(pdf, words[0]!) !== pageOf(pdf, words.at(-1)!))
    expect(split.map((words) => words[0])).toEqual([])
  }, TIMEOUT)

  // A heading at the foot of a page with what it heads on the next one. The
  // spacer leaves 20pt: room for the 14pt heading, not for what follows.
  // What it heads starts where its first text or image does: past a spacer
  // at the top of a keep-together block, for one.
  test.each([
    ['the table it heads', ledger('lines', details(1, 5))],
    ['the image it heads', { kind: 'image', asset: { id: 'chart', mediaType: 'image/png', bytes: encodePng(8, 8, () => [0, 90, 0]) }, width: 80, height: 40 } as const],
    ['the keep-together block it heads', { kind: 'keepTogether', blocks: [{ kind: 'spacer', height: 2 }, paragraph('Kept under the heading'), paragraph('And kept with it')] } as const],
  ] as const)('moves a heading to the next page with %s', async (_, headed) => {
    const document = documentOf('Heading at the foot', [{ kind: 'spacer', height: BODY_HEIGHT - 20 }, heading('Lines'), headed])
    const fixture = fixtureOf('heading-at-foot', document, { minPagesExpected: 2, maxPagesExpected: 2 })
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
    expect(verify(fixture, pdf)).toEqual([])
    expect(pageOf(pdf, 'Lines')).toBe(2)
    expect(pdf.pages[0]!.images.length + pageLines(pdf.pages[0]!).filter((line) => lineHas(line, 'Key')).length).toBe(0)
  }, TIMEOUT)

  // A heading with nothing after it to keep it with, at the end or before a
  // page break, stays where it falls rather than moving to a page of its own.
  test.each([
    ['at the end', [] as Block[]],
    ['before a page break', [{ kind: 'pageBreak' }, paragraph('Next chapter')] as Block[]],
  ])('leaves a heading with nothing after it where it falls, %s', async (_, after) => {
    const document = documentOf('Last heading', [{ kind: 'spacer', height: BODY_HEIGHT - 20 }, heading('Closing remarks'), ...after])
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: 5 }))
    expect(pageOf(pdf, 'Closing remarks')).toBe(1)
  }, TIMEOUT)

  // Two headings in a row, the second over a table: kept one at a time, the
  // first would stay with the second and the second move without it. A
  // spacer and a rule between them and the table print no text to be kept
  // with, and are passed over.
  test('moves a run of headings to the next page together', async () => {
    const document = documentOf('Headings at the foot', [
      { kind: 'spacer', height: BODY_HEIGHT - 40 },
      heading('Ledger section'),
      heading('Ledger lines'),
      { kind: 'spacer', height: 1 },
      { kind: 'rule' },
      ledger('lines', details(1, 5)),
    ])
    const fixture = fixtureOf('headings-at-foot', document, { minPagesExpected: 2, maxPagesExpected: 2 })
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
    expect(verify(fixture, pdf)).toEqual([])
    expect([pageOf(pdf, 'Ledger section'), pageOf(pdf, 'Ledger lines')]).toEqual([2, 2])
    expect(pageOf(pdf, 'ROW-0001')).toBe(2)
  }, TIMEOUT)

  // The rule above, where it cannot hold: a heading first on its page, over a
  // block too tall to share the page with it. Moving the heading would leave
  // an empty page behind and orphan it again on the next; it stays.
  test('leaves a heading where it is when what follows cannot share a page with it', async () => {
    // 69 lines of 9pt Roboto are 727.7pt, which fits the corpus page's body
    // of 739.1pt; a 14pt heading's 16.4pt more does not.
    const block: KeepTogether = { kind: 'keepTogether', blocks: Array.from({ length: 69 }, (_, index) => paragraph(`Kept line ${index + 1}`)) }
    expect((await readPdf(await pdfmakeAdapter.render(documentOf('A full page', [block]), { maxPages: 5 }))).pages).toHaveLength(1)
    const document = documentOf('Heading over a full page', [heading('Kept lines'), block])
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: 5 }))
    expect(pdf.pages).toHaveLength(2)
    expect(pageOf(pdf, 'Kept lines')).toBe(1)
    expect(pageOf(pdf, 'Kept line 1')).toBe(2)
  }, TIMEOUT)

  // The corpus's group-boundary fixture has rows of one line. A row of nine
  // that does not fit under its group header moves to the next page whole,
  // and pdfmake reports every line of it but the first as still on the page
  // before: the group header must not be fooled into staying behind. Swept
  // across the page boundary, so that some placement puts the group header
  // last on the first page.
  test('keeps a group header with a row of several lines, wherever the page breaks', async () => {
    const description = uniqueWords(60).join(' ')
    for (let before = 40; before <= 52; before++) {
      const rows: TableRow[] = [...details(1, before), { kind: 'groupHeader', cells: ['Region B', '', ''] }, { kind: 'detail', cells: ['ROW-9001', description, '1.00'] }, ...details(before + 1, before + 3)]
      const document = documentOf('Group header over a tall row', [ledger('lines', rows)])
      const fixture = fixtureOf(`group-header-before-${before}`, document, { minPagesExpected: 2, maxPagesExpected: 3 })
      expect(verify(fixture, await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages })))).toEqual([])
    }
  }, TIMEOUT)

  // A row that fits a page under the column header, but not under its group
  // header as well, cannot be kept whole and with its group header at once:
  // kept whole, it moves to the next page and leaves the group header behind
  // on whatever page the group header is moved to. The row splits instead.
  // 68 lines of 9pt Roboto with padding and rule are 721.7pt; under the
  // repeated header, 722.6pt of the body is left, and 707.5pt under a group
  // header too.
  test('splits a row that fits on a page only without its group header', async () => {
    const description = Array.from({ length: 68 }, (_, index) => `Line ${index + 1} of the description`).join('\n')
    const rows: TableRow[] = [...details(1, 48), { kind: 'groupHeader', cells: ['Region T', '', ''] }, { kind: 'detail', cells: ['ROW-9002', description, '1.00'] }, ...details(49, 50)]
    const document = documentOf('Group header over a page-high row', [ledger('lines', rows)])
    const fixture = fixtureOf('group-header-page-high-row', document, { minPagesExpected: 2, maxPagesExpected: 4 })
    expect(verify(fixture, await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages })))).toEqual([])
  }, TIMEOUT)

  // A group header over a row that prints nothing has nothing on the page
  // to be kept with. A rule that went looking anyway would never find it,
  // and move the group header to a page of its own every time.
  test('leaves a group header over an empty row where it falls', async () => {
    const rows: TableRow[] = [...details(1, 3), { kind: 'groupHeader', cells: ['Region C', '', ''] }, { kind: 'detail', cells: ['', '', ''] }, ...details(4, 6)]
    const pdf = await readPdf(await pdfmakeAdapter.render(documentOf('Group header over nothing', [ledger('lines', rows)]), { maxPages: 5 }))
    expect(pdf.pages).toHaveLength(1)
    expect(pageOf(pdf, 'Region C')).toBe(1)
  }, TIMEOUT)

  // The group header the corpus's group-boundary fixture cannot reach: the
  // first row of a table that starts near the foot of a page, under the
  // column header. Both move with the first detail row.
  test('keeps a table that starts with a group header together with its first detail row', async () => {
    const rows: TableRow[] = [{ kind: 'groupHeader', cells: ['Region A', '', ''] }, ...details(1, 3)]
    const document = documentOf('Group header first', [{ kind: 'spacer', height: BODY_HEIGHT - 38 }, ledger('lines', rows)])
    const fixture = fixtureOf('group-header-first', document, { minPagesExpected: 2, maxPagesExpected: 2 })
    const pdf = await readPdf(await pdfmakeAdapter.render(document, { maxPages: fixture.maxPages }))
    expect(verify(fixture, pdf)).toEqual([])
    expect(pageOf(pdf, 'Region A')).toBe(2)
  }, TIMEOUT)
})

describe('what the adapter refuses before pdfmake sees it', () => {
  // pdfmake has no number for the current page outside the page header and
  // footer. Printing anything else in its place would be a wrong number.
  test('a page field in the body', async () => {
    const document = documentOf('Body field', [paragraph('Before'), { kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }] }])
    await expect(pdfmakeAdapter.render(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported', subject: 'body[1]' })
  })

  // A page break inside a repeated region, or inside a block kept on one page,
  // asks for two things that cannot both be done.
  test('a page break in a page region or in a keep-together block', async () => {
    const inHeader = { ...documentOf('Break in header', [paragraph('Body')]), pageHeader: [paragraph('Header'), { kind: 'pageBreak' } as const] }
    await expect(pdfmakeAdapter.render(inHeader, { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported', subject: 'pageHeader[1]' })
    const inBlock = documentOf('Break in block', [{ kind: 'keepTogether', blocks: [paragraph('One'), { kind: 'pageBreak' }, paragraph('Two')] }])
    await expect(pdfmakeAdapter.render(inBlock, { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported', subject: 'body[0].blocks[1]' })
    // A keep-together block inside a page region is still in the region.
    const inRegionBlock = { ...documentOf('Break in a header block', [paragraph('Body')]), pageHeader: [{ kind: 'keepTogether', blocks: [{ kind: 'pageBreak' }] } as const] }
    await expect(pdfmakeAdapter.render(inRegionBlock, { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported', message: 'pageHeader[0].blocks[0] is a page break inside a page region' })
  })

  // Fixed columns wider than the page push the table past the right margin,
  // where a printer cuts it off.
  test('a table whose fixed columns are wider than the page', async () => {
    const columns: TableColumn[] = [
      { width: 300, align: 'left' },
      { width: 'fill', align: 'left' },
      { width: 300, align: 'right' },
    ]
    await expect(pdfmakeAdapter.render(documentOf('Wide table', [ledger('wide', details(1, 3), columns)]), { maxPages: 5 })).rejects.toMatchObject({ code: 'content-too-large', subject: 'wide' })
  })

  // An image drawn larger than the printable area runs past a margin; pdfmake
  // draws it anyway.
  test('an image larger than the printable area', async () => {
    const image: Image = { kind: 'image', asset: { id: 'banner', mediaType: 'image/png', bytes: encodePng(4, 4, () => [0, 0, 0]) }, width: PRINTABLE_WIDTH + 10, height: 40 }
    await expect(pdfmakeAdapter.render(documentOf('Wide image', [image]), { maxPages: 5 })).rejects.toMatchObject({ code: 'content-too-large', subject: 'banner' })
    const tall: Image = { ...image, width: 40, height: BODY_HEIGHT + 10 }
    await expect(pdfmakeAdapter.render(documentOf('Tall image', [tall]), { maxPages: 5 })).rejects.toMatchObject({ code: 'content-too-large', subject: 'banner' })
  })

  // A page header and footer that fill the page leave no body: pdfmake would
  // lose header lines and draw the body over the footer.
  test('a page header taller than the printable area', async () => {
    const document = { ...documentOf('Header over the page', [paragraph('Body')]), pageHeader: Array.from({ length: 100 }, (_, index) => paragraph(`Header line ${index + 1}`)) }
    await expect(pdfmakeAdapter.render(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'content-too-large' })
  })

  // Each is a document no engine could print as written. pdfmake would fail
  // on some with an error that names nothing, and print others wrongly: a
  // missing cell as a shifted row, an image of no size as nothing at all, a
  // creation date that is not one into the PDF's metadata.
  test.each([
    ['a row with fewer cells than columns', documentOf('Short row', [ledger('short', [{ kind: 'detail', cells: ['ROW-0001', 'Only two cells'] }])]), 'short'],
    ['a header with fewer cells than columns', documentOf('Short header', [{ ...ledger('short-header', details(1, 2)), header: ['Key', 'Description'] }]), 'short-header'],
    ['a table with no columns', documentOf('No columns', [{ ...ledger('no-columns', []), columns: [], header: [] }]), 'no-columns'],
    [
      'a column no wider than its cell padding',
      documentOf('Narrow column', [
        ledger('narrow', details(1, 2), [
          { width: 6, align: 'left' },
          { width: 'fill', align: 'left' },
          { width: 90, align: 'right' },
        ]),
      ]),
      'narrow',
    ],
    ['an image drawn at no size', documentOf('No size', [{ kind: 'image', asset: { id: 'dot', mediaType: 'image/png', bytes: encodePng(2, 2, () => [0, 0, 0]) }, width: 0, height: 10 }]), 'dot'],
    ['a creation date that is not a date', { ...documentOf('Undated', [paragraph('Body')]), info: { title: 'Undated', creationDate: 'yesterday' } }, 'info.creationDate'],
  ] as const)('%s', async (_, document, subject) => {
    await expect(pdfmakeAdapter.render(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported', subject })
  })
})

function fixtureOf(id: string, document: ResolvedDocument, stated: Stated): Fixture {
  return { id, title: id, document, maxPages: 20, expect: expectation(document, stated) }
}

/** The one page a line of `text` is on, as whole words; a test that asks expects exactly one. */
function pageOf(pdf: ReadPdf, text: string): number | undefined {
  const pages = pdf.pages.filter((page) => pageLines(page).some((line) => lineHas(line, text))).map((page) => page.number)
  expect(pages, text).toHaveLength(1)
  return pages[0]
}
