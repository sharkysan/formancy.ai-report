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
import type { ResolvedDocument } from '@formancy/report-runtime'
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
 * documents, each refused by both, by the same code and the same subject.
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
