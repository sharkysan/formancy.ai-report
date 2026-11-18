import {
  ALL_FIXTURES,
  FIRST_PAGE_FIXTURES,
  KEEP_WITH_FIXTURES,
  MALFORMED,
  readPdf,
  SHIFTED_FIXTURES,
  STARTERS,
  SVG_FIXTURES,
  wordRefusal,
  type DocxBlock,
  type Fixture,
} from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { RenderRefusal, SHIFTED_SIZE } from '@formancy/report-runtime'
import type { Block, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { DEFAULT_SIZE, KIND_BOLD, TABLE_SIZE } from './look.js'
import { documentOf, paragraph, refusalOf, resolved, written } from './testing/support.js'

/**
 * The writer held to the PDF renderer (0068). Two things a resolved
 * document leaves to an engine are stated in both, since no package below
 * both holds them, and nothing but this suite holds the two statements
 * together.
 *
 * **What a document's text prints as where no style says**: a
 * paragraph's size, a table cell's, bold for a table's header, group and
 * total rows, italic for its empty text. Each document both engines
 * write is written without its page regions -- which a PDF repeats on
 * every page -- and its PDF read back with PDF.js: every word of the Word
 * file, with the size, the weight and the slant its run states, is a
 * word the PDF draws at that size in a face of that weight and slant,
 * and every word of the PDF is one of the file's. A word, not a run: PDF.js
 * gives text by line and face, and a table's header on every page it
 * reaches. Colour, a table's rules and padding, and every gap print
 * nothing this reads, and are held by review.
 *
 * **What no engine prints of a document**: the corpus's list of malformed
 * documents, each refused by both, by the same code and the same subject;
 * and one document wrong in every place an engine looks, put right a place
 * at a time, refused by both for the same place at each step.
 *
 * And one thing the two must agree on that neither states: **the lines a
 * text with line endings prints**. The PDF's are counted on the page, by
 * where the paragraph after the text stands; the file's are the breaks it
 * states.
 */

const TIMEOUT = 240_000

/** A word and how it prints: its size to the hundredth of a point, and whether its face is bold and italic. */
const printed = (word: string, size: number, bold: boolean, italic: boolean): string =>
  `${word} @ ${size.toFixed(2)} pt${bold ? ' bold' : ''}${italic ? ' italic' : ''}`

/** Every word of a Word file's blocks as it prints: a run set off the line at the fraction of its size the PDF draws it at. */
function wordsOfFile(blocks: readonly DocxBlock[]): Set<string> {
  const words = new Set<string>()
  const walk = (list: readonly DocxBlock[]): void => {
    for (const block of list) {
      if (block.kind === 'table') for (const row of block.rows) for (const cell of row.cells) walk(cell.blocks)
      else {
        // Runs that follow each other in one size, weight and slant are one run to PDF.js, which gives text by line and face: 'Total' and ':' are 'Total:'.
        let [text, set] = [
          '',
          undefined as undefined | { readonly size: number; readonly bold: boolean; readonly italic: boolean; readonly shift: string | undefined },
        ]
        const flush = (): void => {
          if (set !== undefined) for (const word of text.split(/\s+/)) if (word !== '') words.add(printed(word, set.size, set.bold, set.italic))
          text = ''
        }
        for (const run of block.runs) {
          if (run.kind !== 'text') continue
          const size = (run.props.size ?? Number.NaN) * (run.props.shift === undefined ? 1 : SHIFTED_SIZE)
          // A run set below the line and one set above it are of one size, and two runs: each is moved its own way.
          if (set?.size !== size || set.bold !== run.props.bold || set.italic !== run.props.italic || set.shift !== run.props.shift) flush()
          set = { size, bold: run.props.bold, italic: run.props.italic, shift: run.props.shift }
          text += run.text
        }
        flush()
      }
    }
  }
  walk(blocks)
  return words
}

/** Every word a PDF draws as it prints: its box's height, which is its size, and its face's weight and slant by its PostScript name. */
async function wordsOfPdf(document: ResolvedDocument): Promise<Set<string>> {
  const pdf = await readPdf(await renderPdf(document, { maxPages: 400 }))
  const words = new Set<string>()
  for (const page of pdf.pages)
    for (const item of page.items)
      for (const word of item.text.split(/\s+/)) if (word !== '') words.add(printed(word, item.height, /Medium|Bold/.test(item.font), /Italic/.test(item.font)))
  return words
}

/** `document` without its page regions: the body alone, which a PDF prints once. */
function bodyAlone(document: ResolvedDocument): ResolvedDocument {
  const { firstPageHeader: _own, ...rest } = document
  return { ...rest, pageHeader: [], pageFooter: [] }
}

/** The fixtures both engines write: those the PDF renders and a Word file holds. */
const FIXTURES: readonly Fixture[] = [...ALL_FIXTURES, ...SVG_FIXTURES, ...KEEP_WITH_FIXTURES, ...FIRST_PAGE_FIXTURES, ...SHIFTED_FIXTURES].filter(
  (fixture) => fixture.expect.outcome === 'render' && wordRefusal(fixture.document) === undefined,
)

const BOTH: readonly (readonly [string, ResolvedDocument])[] = [
  ...STARTERS.map((starter) => [`the ${starter.id} starter`, resolved(starter)] as const).filter(([, document]) => wordRefusal(document) === undefined),
  ...FIXTURES.map((fixture) => [`the ${fixture.id} fixture`, fixture.document] as const),
]

describe('what a document leaves to an engine', () => {
  // A suite that compared nothing would hold nothing: the starters that export and the fixtures both write are all here.
  test('is compared on every starter and fixture both engines write', () => {
    expect(BOTH.length).toBeGreaterThan(20)
    expect(BOTH.filter(([name]) => name.endsWith('starter'))).toHaveLength(6)
  })

  // The sizes and the bold no style states are the renderer's constants, typed again in look.ts: one changed alone would print a report's
  // table a point larger, or its totals light, in one engine and not the other, with every word in its place.
  test.each(BOTH)(
    'prints %s with the sizes, weights and slants the PDF prints it with',
    async (_name, document) => {
      const body = bodyAlone(document)
      const [file, pdf] = [wordsOfFile(written(body).body), await wordsOfPdf(body)]
      // A word pdfmake broke across lines is several words to PDF.js and one to the file: an identifier with no space in it, past forty
      // characters. Such a word is held by its pieces, each a piece of it printed as it prints.
      const long = [...file].filter((word) => word.indexOf(' @ ') > 40)
      const piece = (word: string): boolean => {
        const [text, how] = word.split(' @ ') as [string, string]
        return long.some((whole) => whole.endsWith(` @ ${how}`) && whole.includes(text))
      }
      expect([...file].filter((word) => !pdf.has(word) && !long.includes(word)).sort()).toEqual([])
      expect([...pdf].filter((word) => !file.has(word) && !piece(word)).sort()).toEqual([])
    },
    TIMEOUT,
  )

  // The comparison itself, on a document that states no size and no weight: the engine's own for a paragraph, a header, a detail row, a total and an empty text.
  test(
    'are the sizes and the weights of text that states none',
    async () => {
      const table = { kind: 'table', id: 'lines', columns: [{ width: 'fill', align: 'left' }], header: ['Heading'], emptyText: 'Nothing' } as const
      const document = documentOf([
        paragraph('Paragraph'),
        {
          ...table,
          rows: [
            { kind: 'detail', cells: ['Detail'] },
            { kind: 'total', cells: ['Total'] },
          ],
        },
        { ...table, id: 'empty', rows: [] },
      ])
      const stated = [
        printed('Paragraph', DEFAULT_SIZE, false, false),
        printed('Heading', TABLE_SIZE, KIND_BOLD.header, false),
        printed('Detail', TABLE_SIZE, KIND_BOLD.detail, false),
        printed('Total', TABLE_SIZE, KIND_BOLD.total, false),
        printed('Nothing', TABLE_SIZE, KIND_BOLD.empty, true),
      ]
      expect([...wordsOfFile(written(document).body)].sort()).toEqual([...stated].sort())
      expect([...(await wordsOfPdf(document))].sort()).toEqual([...stated].sort())
    },
    TIMEOUT,
  )
})

describe('the lines a text with line endings prints', () => {
  /** Where the top of the word `after` stands on the first page of `document`'s PDF, in points from the top of the page. */
  async function topOfAfter(document: ResolvedDocument): Promise<number> {
    const pdf = await readPdf(await renderPdf(document, { maxPages: 2 }))
    const found = pdf.pages[0]!.items.filter((item) => item.text.trim() === 'after')
    if (found.length !== 1) throw new Error(`'after' is printed ${found.length} times`)
    return found[0]!.top
  }
  const runs = (...texts: readonly string[]): Block => ({ kind: 'paragraph', runs: texts.map((text) => ({ text })) })
  /** Measured once, on the PDF: where a paragraph stands with nothing above it, and how much lower each line of a paragraph above puts it. */
  let ruler: Promise<{ readonly none: number; readonly line: number }> | undefined
  const ruled = (): Promise<{ readonly none: number; readonly line: number }> =>
    (ruler ??= Promise.all(
      [[], [paragraph('x')], [paragraph('x'), paragraph('x')]].map((above) => topOfAfter(documentOf([...above, paragraph('after')]))),
    ).then(([none, one, two]) => ({ none: none!, line: two! - one! })))
  /** The lines `block` prints in the PDF: how far it pushes the paragraph after it down, in lines of a paragraph's own. */
  async function linesOfParagraph(block: Block): Promise<number> {
    const { none, line } = await ruled()
    return ((await topOfAfter(documentOf([block, paragraph('after')]))) - none) / line
  }
  const table = (cell: string, id = 'lines'): Block => ({
    kind: 'table',
    id,
    columns: [{ width: 'fill', align: 'left' }],
    header: ['Key'],
    rows: [
      { kind: 'detail', cells: [cell] },
      { kind: 'detail', cells: ['after'] },
    ],
    emptyText: '',
  })
  /** Measured once: where the row under a cell of one line stands, and how much lower a second line in the cell puts it. */
  let cellRuler: Promise<{ readonly one: number; readonly line: number }> | undefined
  const cellRuled = (): Promise<{ readonly one: number; readonly line: number }> =>
    (cellRuler ??= Promise.all(['x', 'x\nx'].map((cell) => topOfAfter(documentOf([table(cell)])))).then(([one, two]) => ({ one: one!, line: two! - one! })))
  /** The lines a cell of `text` prints in the PDF: how much lower the row under it stands than under a cell of one line, in lines of a cell's own. */
  async function linesOfCell(text: string): Promise<number> {
    const { one, line } = await cellRuled()
    return 1 + ((await topOfAfter(documentOf([table(text)]))) - one) / line
  }
  /** The lines the file states for its body's first paragraph, or for the cell under its header: one, and one more for each break. */
  const linesOfFile = (document: ResolvedDocument): number => {
    const [first] = written(document).body
    const stated = first?.kind === 'table' ? first.rows[1]?.cells[0]?.blocks[0] : first
    if (stated?.kind !== 'paragraph') throw new Error('the file opens with neither the paragraph nor the cell the document opens with')
    return 1 + stated.runs.reduce((breaks, run) => breaks + (run.kind === 'text' ? run.text.split('\n').length - 1 : 0), 0)
  }

  // pdfmake ends a line at each line ending and opens none after the one that ends a text: 'one\n' is one line, and the paragraph after it
  // stands where it stands after 'one'. A file that stated a break for that ending would print a line the PDF does not, with every word in
  // its place, so nothing that compares words sees it: the lines are counted, on the PDF.
  test.each([
    ['one line', ['one'], 1],
    ['a line feed inside it', ['one\ntwo'], 2],
    ['a carriage return inside it', ['one\rtwo'], 2],
    ['the two together inside it', ['one\r\ntwo'], 2],
    ['a line feed at its start', ['\none'], 2],
    ['two line feeds inside it', ['one\n\ntwo'], 3],
    ['a line feed at its end', ['one\n'], 1],
    ['a carriage return at its end', ['one\r'], 1],
    ['the two together at its end', ['one\r\n'], 1],
    ['two line feeds at its end', ['one\n\n'], 2],
    ['a line feed alone', ['\n'], 1],
    ['a run that ends in a line feed before another', ['one\n', 'two'], 2],
    ['a last run that ends in a line feed', ['one', 'two\n'], 1],
    ['a last run that is a line feed', ['one', '\n'], 1],
    ['a run of nothing after a line feed, which opens a line', ['one\n', ''], 2],
    ['a run of nothing before one that ends in a line feed', ['', 'one\n'], 1],
    ['two runs that each end in a line feed', ['one\n', '\n'], 2],
  ] as const)(
    'a paragraph of %s prints as many lines in the PDF as the file states',
    async (_name, texts, lines) => {
      const block = runs(...texts)
      expect(await linesOfParagraph(block)).toBeCloseTo(lines, 2)
      expect(linesOfFile(documentOf([block, paragraph('after')]))).toBe(lines)
    },
    TIMEOUT,
  )

  // A cell's text is another path through both engines: the same count, by where the row under the cell stands.
  test.each([
    ['one line', 'one', 1],
    ['a line feed inside it', 'one\ntwo', 2],
    ['a line feed at its end', 'one\n', 1],
    ['the two together at its end', 'one\r\n', 1],
    ['two line feeds at its end', 'one\n\n', 2],
    ['a line feed alone', '\n', 1],
  ] as const)(
    'a cell of %s prints as many lines in the PDF as the file states',
    async (_name, text, lines) => {
      expect(await linesOfCell(text)).toBeCloseTo(lines, 2)
      expect(linesOfFile(documentOf([table(text)]))).toBe(lines)
    },
    TIMEOUT,
  )
})

describe('what no engine prints of a document', () => {
  /** What the PDF renderer refuses `document` as; fails the test where it draws it. */
  async function pdfRefusal(document: ResolvedDocument): Promise<{ readonly code: string; readonly subject: string | undefined }> {
    try {
      await renderPdf(document, { maxPages: 5 })
    } catch (error) {
      if (error instanceof RenderRefusal) return { code: error.code, subject: error.subject }
      throw error
    }
    throw new Error('the PDF renderer drew the document')
  }

  /** A paragraph no engine prints, wherever it stands: refused by its place. */
  const red = paragraph('red', { color: 'red' })
  /** A picture whose bytes are none, which an engine finds once it has walked every block. */
  const broken: Block = {
    kind: 'image',
    asset: { id: 'broken', mediaType: 'image/png', bytes: new TextEncoder().encode('not a PNG') },
    width: 32,
    height: 32,
    fit: 'contain',
  }
  const A4 = documentOf([]).page
  /** A document wrong in every place an engine looks, and the same with one place after another put right, each named by what is refused then. */
  const WRONG: ResolvedDocument = documentOf([broken, red], {
    info: { title: 7 as unknown as string, creationDate: 'yesterday' },
    page: { ...A4, size: 'A3' as 'A4' },
    pageHeader: [red],
    firstPageHeader: [red],
    pageFooter: [red],
  })
  const STEPS: readonly (readonly [string, ResolvedDocument])[] = (
    [
      ['info.creationDate', {}],
      ['info.title', { info: { title: 7 as unknown as string, creationDate: '2026-01-01T00:00:00Z' } }],
      ['page.size', { info: { title: 'Wrong', creationDate: '2026-01-01T00:00:00Z' } }],
      ['pageHeader[0]', { page: A4 }],
      ['firstPageHeader[0]', { pageHeader: [] }],
      ['pageFooter[0]', { firstPageHeader: [] }],
      ['body[1]', { pageFooter: [] }],
      ['broken', { body: [broken] }],
    ] as const
  ).reduce<[string, ResolvedDocument][]>((steps, [subject, right]) => [...steps, [subject, { ...(steps.at(-1)?.[1] ?? WRONG), ...right }]], [])

  // Every document of the list below is wrong once. A document wrong twice is refused for one thing, and for the same thing by both: the
  // creation date, the title, the page, the page header, page 1's own, the page footer, the body's blocks in their order, and a picture's
  // bytes last, wherever the picture stands -- an engine that read them where it met the picture would refuse this body for another block.
  test.each(STEPS)(
    'a document wrong in several places is refused by both engines for %s first',
    async (subject, document) => {
      const word = refusalOf(document)
      expect(word.subject).toBe(subject)
      expect({ code: word.code, subject: word.subject }).toEqual(await pdfRefusal(document))
    },
    TIMEOUT,
  )

  // The list holds both engines' statements of the contract together: an empty one, or one of a handful, would hold nothing.
  test('is a list of every way a document breaks its contract with an engine', () => {
    expect(MALFORMED.length).toBeGreaterThan(50)
    expect(new Set(MALFORMED.map((each) => each.id)).size).toBe(MALFORMED.length)
  })

  // The two engines state the contract twice. Each document here is refused by both, for the same thing: a check one engine lost, or
  // names otherwise, is a document that prints in one and is refused in the other.
  test.each(MALFORMED.map((each) => [each.id, each.title, each.document] as const))(
    '%s: %s, is refused by both engines by the same code and subject',
    async (_id, _title, document) => {
      const word = refusalOf(document)
      expect({ code: word.code, subject: word.subject }).toEqual(await pdfRefusal(document))
    },
    TIMEOUT,
  )
})
