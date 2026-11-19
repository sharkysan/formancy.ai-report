import {
  ALL_FIXTURES,
  CHART_FIXTURES,
  CODE_FIXTURES,
  docxCharts,
  EURO_INVOICE_AT,
  FIRST_PAGE_FIXTURES,
  IMAGE_KINDS,
  KEEP_WITH_FIXTURES,
  MALFORMED,
  readCodes,
  readDocxCodes,
  readPdf,
  readPdfObjects,
  SHIFTED_FIXTURES,
  STARTERS,
  SVG_FIXTURES,
  verify,
  verifyDocx,
  wordRefusal,
  type DocxBlock,
  type DocxChartFrame,
  type Fixture,
} from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { MAX_ASSET_BYTES, MAX_ASSET_SIDE, readCopyLabel, RenderRefusal, SHIFTED_SIZE } from '@formancy/report-runtime'
import type { AxisChart, Block, Chart, EpcQrCode, ImageAsset, QrCode, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { MAX_DOCX_CHARTS, MAX_DOCX_IMAGE_DATA } from './limits.js'
import { CHART_TEXT_SIZE, DEFAULT_SIZE, KIND_BOLD, TABLE_SIZE } from './look.js'
import { blank, documentOf, fixtureOf, padded, paragraph, refusalOf, resolved, written } from './testing/support.js'

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
 * **The image data a document's pictures may hold**, the renderer's
 * `MAX_IMAGE_DATA` and the writer's `MAX_DOCX_IMAGE_DATA`: the renderer
 * exports no number, so the two are held to each other by the picture
 * each engine refuses at, a byte past the bound and not at it.
 *
 * **What the two refuse otherwise**, since the record says they do: a
 * picture past a bound of the writer's that is no picture either, which
 * the writer refuses for its size, before it reads it, and the renderer
 * as no picture.
 *
 * And one thing the two must agree on that neither states: **the lines a
 * text with line endings prints**. The PDF's are counted on the page, by
 * where the paragraph after the text stands; the file's are the breaks it
 * states.
 *
 * **A code** is the one thing both draw of a decision made below both
 * (0074): its symbol and what refuses it are report-runtime's. So a code
 * of the Word file, decoded from its picture, is the code the PDF prints,
 * decoded from its page -- its text, its bytes, its level and its version
 * -- in a square of the PDF's size, at the PDF's module; and a code that
 * is refused is refused by both in the same words.
 *
 * **A chart** is drawn by each engine its own way, ECharts' layout in the
 * PDF and Word's own chart in the file (0076), from one block. So every
 * word a chart's part states is a word the PDF draws, at that size in a
 * face of that weight and slant, and every word the PDF draws of a chart
 * is one the part states -- but the value axis's labels, which a Word
 * file does not state: the PDF's are the block's ticks' texts, and the
 * file's axis runs from the lowest tick to the highest in their step.
 * Each engine's file is held to the one expectation the corpus derives
 * of the document. And what the two refuse otherwise is said: what the
 * PDF refuses of a layout Word makes itself, and each engine's own bound
 * on a document's charts.
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
          if (run.kind === 'chart') for (const word of wordsOfChart(run.frame)) words.add(word)
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

/**
 * Every word a chart's part states, as it prints: its title, its axes'
 * titles and each value's label in the face each states, each category's
 * label in the category axis's, and each series' name, or a pie's
 * slice's, in the legend's. The value axis's labels are none of them:
 * Word writes those from the numbers.
 */
function wordsOfChart({ chart }: DocxChartFrame): string[] {
  const { categoryAxis, valueAxis, legend } = chart
  const stated = [chart.title, categoryAxis?.title, valueAxis?.title, ...chart.series.flatMap((series) => series.labels)]
  const named = chart.series.flatMap((series) => [
    ...(chart.kind === 'pie' || series.name === undefined ? [] : [{ text: series.name, face: legend?.face }]),
    ...series.categories.map((text) => ({ text: text ?? '', face: chart.kind === 'pie' ? legend?.face : categoryAxis?.face })),
  ])
  return [...stated, ...named].flatMap((word) => {
    if (word?.face === undefined) return []
    const { size, bold, italic } = word.face
    return word.text.split(/\s+/).flatMap((each) => (each === '' ? [] : [printed(each, size, bold, italic)]))
  })
}

/** Every chart of `blocks`, however deep. */
function chartsOf(blocks: readonly Block[]): Chart[] {
  return blocks.flatMap((block) =>
    block.kind === 'chart'
      ? [block]
      : block.kind === 'columns'
        ? block.columns.flatMap((slot) => chartsOf(slot.blocks))
        : block.kind === 'section' || block.kind === 'keepTogether'
          ? chartsOf(block.blocks)
          : [],
  )
}

/** A chart's word as its PDF prints it: in the chart's words' face, at their size. */
function chartPrinted(chart: Chart, text: string): string[] {
  const style = chart.style ?? {}
  return text
    .trim()
    .split(/\s+/)
    .flatMap((word) => (word === '' ? [] : [printed(word, style.size ?? CHART_TEXT_SIZE, style.bold ?? false, style.italic ?? false)]))
}

/**
 * The words of the value axes' labels of `document`'s charts, as the PDF
 * prints them: each tick's text. They are the one thing of a chart the
 * PDF prints and a Word file does not state.
 */
function tickWords(document: ResolvedDocument): Set<string> {
  return new Set(chartsOf(document.body).flatMap((chart) => (chart.chart === 'pie' ? [] : chart.ticks.flatMap(({ text }) => chartPrinted(chart, text)))))
}

/** Every word a PDF draws as it prints: its box's height, which is its size, and its face's weight and slant by its PostScript name. */
async function wordsOfPdf(document: ResolvedDocument): Promise<Set<string>> {
  const pdf = await readPdf(await renderPdf(document, { maxPages: 400 }))
  const words = new Set<string>()
  for (const page of pdf.pages)
    for (const item of page.items)
      // A run that reads across the page is as tall as its size; one turned a quarter turn, an EPC QR code's caption, is as wide.
      for (const word of item.text.split(/\s+/))
        if (word !== '') words.add(printed(word, item.angle === 90 ? item.width : item.height, /Medium|Bold/.test(item.font), /Italic/.test(item.font)))
  return words
}

/** `document` without its page regions: the body alone, which a PDF prints once. */
function bodyAlone(document: ResolvedDocument): ResolvedDocument {
  const { firstPageHeader: _own, ...rest } = document
  return { ...rest, pageHeader: [], pageFooter: [] }
}

/** The fixtures both engines write: those the PDF renders and a Word file holds. */
const FIXTURES: readonly Fixture[] = [
  ...ALL_FIXTURES,
  ...SVG_FIXTURES,
  ...KEEP_WITH_FIXTURES,
  ...FIRST_PAGE_FIXTURES,
  ...SHIFTED_FIXTURES,
  ...CODE_FIXTURES,
  ...CHART_FIXTURES,
].filter((fixture) => fixture.expect.outcome === 'render' && wordRefusal(fixture.document) === undefined)

/** The starters that are e-invoices, each as the copy of its final render, the one document of it both engines write (0077). */
const COPIES: readonly (readonly [string, ResolvedDocument])[] = STARTERS.filter((starter) => starter.report.eInvoice !== undefined).map(
  (starter) => [`the copy of the ${starter.id} starter`, resolved(starter, { eInvoice: 'copy' })] as const,
)

const BOTH: readonly (readonly [string, ResolvedDocument])[] = [
  ...STARTERS.map((starter) => [`the ${starter.id} starter`, resolved(starter)] as const).filter(([, document]) => wordRefusal(document) === undefined),
  ...COPIES,
  ...FIXTURES.map((fixture) => [`the ${fixture.id} fixture`, fixture.document] as const),
]

describe('what a document leaves to an engine', () => {
  // A suite that compared nothing would hold nothing: the starters that export and the fixtures both write are all here.
  test('is compared on every starter and fixture both engines write', () => {
    expect(BOTH.length).toBeGreaterThan(20)
    // The six of record 0068, the euro invoice, which is paid by a code (0074), the sales report, which draws two charts (0076), and the
    // invoice and the payment reminder, which a QR-bill pays (0075); and the two that are e-invoices, each as its copy (0077).
    expect(BOTH.filter(([name]) => name.endsWith('starter'))).toHaveLength(12)
    expect(COPIES).toHaveLength(2)
  })

  // The sizes and the bold no style states are the renderer's constants, typed again in look.ts: one changed alone would print a report's
  // table a point larger, or its totals light, in one engine and not the other, with every word in its place.
  test.each(BOTH)(
    'prints %s with the sizes, weights and slants the PDF prints it with',
    async (_name, document) => {
      const body = bodyAlone(document)
      // A slip's words are the file's too (0075): each heading and value at the size and in the weight the PDF prints it.
      const read = written(body)
      const [file, pdf] = [wordsOfFile([...read.body, ...(read.slip?.blocks ?? [])]), await wordsOfPdf(body)]
      // A word pdfmake broke across lines is several words to PDF.js and one to the file: an identifier with no space in it, past forty
      // characters. Such a word is held by its pieces, each a piece of it printed as it prints.
      const long = [...file].filter((word) => word.indexOf(' @ ') > 40)
      const piece = (word: string): boolean => {
        const [text, how] = word.split(' @ ') as [string, string]
        return long.some((whole) => whole.endsWith(` @ ${how}`) && whole.includes(text))
      }
      // A word pdfmake broke after a hyphen, in a column too narrow for it, is its parts to PDF.js and one word to the file: the e-invoice's
      // 'Gas-Brennwertkessel' (0077). Such a word is held by its parts, each printed as the word prints, and each part by the word.
      const parts = (word: string): string[] => {
        const [text, how] = word.split(' @ ') as [string, string]
        return text.split(/(?<=-)(?=.)/).map((each) => `${each} @ ${how}`)
      }
      const hyphened = [...file].filter((word) => !pdf.has(word) && parts(word).length > 1 && parts(word).every((each) => pdf.has(each)))
      const part = new Set(hyphened.flatMap(parts))
      expect([...file].filter((word) => !pdf.has(word) && !long.includes(word) && !hyphened.includes(word)).sort()).toEqual([])
      // A chart's value axis is labelled by Word, from the numbers (0076): the PDF's labels are the block's ticks' texts, and no word of the file.
      const ticks = tickWords(body)
      expect([...pdf].filter((word) => !file.has(word) && !piece(word) && !ticks.has(word) && !part.has(word)).sort()).toEqual([])
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

describe('a copy of an e-invoice in both engines', () => {
  // The label is the runtime's paragraph, which each engine prints as it prints any paragraph: a label one engine printed light, or at
  // another size, would be a copy that says what it is in one file and whispers it in the other. Read on the header each prints.
  test.each(COPIES)(
    'prints the label of %s at the size and in the weight the PDF prints it, in the header of each',
    async (_name, document) => {
      const label = readCopyLabel(document.pageHeader)
      const run = label?.paragraph.runs[0]
      if (label?.asWritten !== true || run === undefined || !('text' in run)) throw new Error('the document is no copy')
      const words = run.text.split(/\s+/).map((word) => printed(word, 8, true, false))
      const file = wordsOfFile(written(document).header?.blocks ?? [])
      const pdf = await wordsOfPdf(document)
      expect(words.filter((word) => !file.has(word))).toEqual([])
      expect(words.filter((word) => !pdf.has(word))).toEqual([])
    },
    TIMEOUT,
  )

  // The copy carries no XML, so neither engine can embed one: the PDF drawn of it is a plain PDF that embeds nothing, as the Word file
  // written of it holds no part but a report's (`copy.test.ts`).
  test.each(COPIES)(
    'draws %s as a PDF that embeds nothing',
    async (_name, document) => {
      expect(document.eInvoice).toBeUndefined()
      const objects = await readPdfObjects(await renderPdf(document, { maxPages: 40 }))
      expect(objects.embeddedFiles).toEqual([])
    },
    TIMEOUT,
  )
})

describe('a code in both engines', () => {
  /** Every code among `blocks`, inside every container, in document order. */
  const codesOf = (blocks: readonly Block[]): (QrCode | EpcQrCode)[] =>
    blocks.flatMap((block): (QrCode | EpcQrCode)[] => {
      if (block.kind === 'qrCode' || block.kind === 'epcQrCode') return [block]
      if (block.kind === 'columns') return block.columns.flatMap((slot) => codesOf(slot.blocks))
      return 'blocks' in block ? codesOf(block.blocks) : []
    })

  /** What a scanner reads of a code, as one line: its text, its level and its version. */
  const said = (code: { readonly text: string; readonly ecLevel: string; readonly version: number }): string => `${code.ecLevel} ${code.version} ${code.text}`

  /**
   * The documents with a code that both engines draw: every code fixture
   * of the corpus, the euro invoice, and its Austrian sample, whose code
   * stands in the PSA's frame. Without their page regions, which a PDF
   * prints on every page; the regions' codes are the code fixtures' own
   * case below.
   */
  const CODED: readonly (readonly [string, ResolvedDocument])[] = [
    ...BOTH.filter(([, document]) => codesOf(document.body).length > 0),
    ['the euro invoice from Austria', resolved(EURO_INVOICE_AT)] as const,
  ]

  // A suite that compared no code would hold none: the fixtures of codes and the starter a code pays.
  test('is compared on every code fixture and on the starters a code pays', () => {
    expect(CODED.map(([name]) => name)).toEqual([
      'the euro-invoice starter',
      // An e-invoice's copy is paid by the EPC QR code its invoice prints (0077): the code of a copy is the invoice's.
      'the copy of the e-invoice starter',
      'the copy of the e-invoice-xrechnung starter',
      ...CODE_FIXTURES.filter((fixture) => codesOf(fixture.document.body).length > 0).map((fixture) => `the ${fixture.id} fixture`),
      'the euro invoice from Austria',
    ])
    expect(CODED.length).toBeGreaterThan(8)
  })

  // The symbol is decided once, below both engines, and each draws it its own way: vectors on a page, pixels in a picture. Read back by
  // ZXing from each, a code says the same text in the same bytes at the same level and version, stands in a square of the same size --
  // the PDF's is the white it paints under the code, the file's the picture's extent -- and has modules of the same size. A writer
  // that drew another symbol, or the same at another size, would print a report whose Word file pays another account than its PDF.
  test.each(CODED)(
    "prints %s with the codes the PDF prints, in squares of the PDF's size",
    async (_name, document) => {
      const body = bodyAlone(document)
      const bytes = await renderPdf(body, { maxPages: 20 })
      const pdf = await readPdf(bytes)
      const drawn = (await Promise.all(pdf.pages.map(async (page) => (await readCodes(bytes, page.number)).map((code) => ({ code, page }))))).flat()
      const file = await readDocxCodes(written(body))
      const blocks = codesOf(body.body)
      expect(file).toHaveLength(blocks.length)
      // A code of no text is a symbol of no data, which a scanner reads in neither. Every other is read in both, in the document's order:
      // down the page in the PDF, block by block in the file.
      const stated = blocks.flatMap((block, index) => ((block.kind === 'qrCode' ? block.text : block.payload) === '' ? [] : [{ block, written: file[index]! }]))
      expect(stated.map(({ written: each }) => each.read && said(each.read))).toEqual(drawn.map(({ code }) => said(code)))
      stated.forEach(({ block, written: each }, index) => {
        const { code, page } = drawn[index]!
        expect(each.read!.bytes).toEqual(code.bytes)
        // The white the PDF paints under the code, exactly its square: the smallest white square around where the scanner found the symbol.
        const squares = page.paths.filter(
          (path) =>
            path.fill === '#ffffff' &&
            Math.abs(path.width - path.height) < 0.01 &&
            path.x <= code.x &&
            path.top <= code.top &&
            path.x + path.width >= code.x + code.width,
        )
        const side = Math.min(...squares.map((path) => path.width))
        expect(side).toBeCloseTo(block.size, 2)
        const { modules } = each
        if (block.kind === 'epcQrCode' && block.caption !== undefined) {
          // In Austria's frame the picture is the symbol and its distance from the frame, at the module the PDF draws -- the symbol's side
          // over its modules, within what a scanner's corners allow -- and the frame's line, the picture and the caption's band are the square.
          expect(Math.abs(each.module - code.width / modules)).toBeLessThan(0.02)
          expect(each.module * (modules + 8.5) + 7).toBeCloseTo(side, 2)
        } else {
          expect(each.picture.width).toBeCloseTo(side, 2)
          expect(each.picture.height).toBeCloseTo(side, 2)
          expect(each.module).toBeCloseTo(side / (modules + 8), 3)
        }
      })
    },
    TIMEOUT,
  )

  // A code in a page region is drawn on every page of the PDF, and written once into the region's part of the file: each of the fixture's
  // three regions' codes says in the file what it says on the page, the page footer's on every page and page 1's own header's on page 1 alone.
  test(
    "prints the codes of the page regions the PDF prints: the footer's on every page, page 1's own on page 1",
    async () => {
      const { document, maxPages } = CODE_FIXTURES.find((fixture) => fixture.id === 'qr-code-regions')!
      const bytes = await renderPdf(document, { maxPages })
      const pages = (await readPdf(bytes)).pages.length
      expect(pages).toBeGreaterThan(1)
      const file = await readDocxCodes(written(document))
      const [header, first, footer] = (['header', 'firstHeader', 'footer'] as const).map((region) => said(file.find((code) => code.region === region)!.read!))
      for (let page = 1; page <= pages; page++) {
        const drawn = (await readCodes(bytes, page)).map(said)
        expect(drawn.sort()).toEqual([page === 1 ? first : header, footer].sort())
      }
    },
    TIMEOUT,
  )

  // What refuses a code is one rule, asked by both: a code of the corpus's malformed documents is refused by both in the very same words,
  // where every other document of that list is held to the same code and subject alone. An engine that came to decide a code for itself
  // again would say it otherwise.
  test('refuses a code in the words the PDF refuses it in', async () => {
    const codes = MALFORMED.filter((each) => /(^|-)qr-code-/.test(each.id))
    expect(codes.length).toBeGreaterThan(15)
    for (const { id, document } of codes) {
      const pdf = await renderPdf(document, { maxPages: 5 }).then(
        () => 'drawn',
        (error: unknown) => (error instanceof RenderRefusal ? error.message : 'failed'),
      )
      expect(refusalOf(document).message, id).toBe(pdf)
    }
  })

  // The one refusal of a code each engine makes for itself: taller than a page. The PDF judges it against the body between its regions
  // and the writer against the printable area, each in its own words, and both by the same code and for the same code.
  test('refuses a code taller than a page as the PDF does, by its code and its id', async () => {
    const document = documentOf([{ kind: 'qrCode', id: 'tall-code', text: 'A', size: 500, errorCorrection: 'M' }])
    const landscape = { ...document, page: { ...document.page, orientation: 'landscape' as const } }
    const pdf = await renderPdf(landscape, { maxPages: 5 }).then(
      () => undefined,
      (error: unknown) => (error instanceof RenderRefusal ? { code: error.code, subject: error.subject } : undefined),
    )
    expect(pdf).toEqual({ code: 'content-too-large', subject: 'tall-code' })
    const word = refusalOf(landscape)
    expect({ code: word.code, subject: word.subject }).toEqual(pdf)
  })
})

describe('a chart in both engines', () => {
  const DRAWN = CHART_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render')
  const sales = resolved(STARTERS.find((starter) => starter.id === 'sales-report')!)
  const CHARTED: readonly Fixture[] = [...DRAWN, fixtureOf('sales-report', sales)]

  // A suite that compared no chart would hold none: every chart fixture the PDF draws, and the starter that draws two.
  test('is compared on every chart fixture the PDF draws and on the sales report', () => {
    expect(DRAWN.length).toBeGreaterThan(8)
    expect(chartsOf(sales.body).map((chart) => chart.chart)).toEqual(['bar', 'pie'])
  })

  // One expectation, derived of the document alone, and two files: a chart whose words, values or box one engine got otherwise fails here in that engine.
  test.each(DRAWN.map((fixture) => [fixture.id, fixture] as const))(
    '%s: the PDF and the Word file are each the chart the document says',
    async (_id, fixture) => {
      expect(verify(fixture, await readPdf(await renderPdf(fixture.document, { maxPages: 400 })))).toEqual([])
      expect(await verifyDocx(fixture, written(fixture.document))).toEqual([])
    },
    TIMEOUT,
  )

  // The PDF prints every k-th tick's text; Word prints a number at each gridline. Both are the block's ticks: the PDF's words theirs, the file's axis theirs.
  test.each(CHARTED.map((fixture) => [fixture.id, fixture] as const))(
    '%s: the value axis the PDF labels is the axis the Word file states',
    async (_id, { document }) => {
      const body = bodyAlone(document)
      const axes = chartsOf(body.body).filter((chart): chart is AxisChart => chart.chart !== 'pie' && chart.empty === undefined)
      const stated = docxCharts(written(body)).flatMap(({ chart }) => (chart.valueAxis === undefined ? [] : [chart.valueAxis]))
      expect(stated.map((axis) => [axis.min, axis.max])).toEqual(axes.map((chart) => [chart.ticks[0]!.exact, chart.ticks.at(-1)!.exact]))
      // As many gridlines as the block has ticks: the highest less the lowest is the step that many times less one. Small numbers, read as numbers.
      expect(stated.map((axis) => Math.round((Number(axis.max) - Number(axis.min)) / Number(axis.step)) + 1)).toEqual(axes.map((chart) => chart.ticks.length))
      // And the lowest tick's label is on the PDF's page, in the words' face: the axis is labelled from its foot.
      const pdf = await wordsOfPdf(body)
      for (const chart of axes) for (const word of chartPrinted(chart, chart.ticks[0]!.text)) expect(pdf.has(word), `${chart.id}: ${word}`).toBe(true)
    },
    TIMEOUT,
  )

  /** What the PDF renderer refuses `document` as, or undefined where it draws it. */
  async function pdfRefusal(document: ResolvedDocument): Promise<{ readonly code: string; readonly subject: string | undefined } | undefined> {
    try {
      await renderPdf(document, { maxPages: 400 })
      return undefined
    } catch (error) {
      if (error instanceof RenderRefusal) return { code: error.code, subject: error.subject }
      throw error
    }
  }

  const UNFIT = CHART_FIXTURES.filter((fixture) => fixture.expect.outcome === 'refuse' && fixture.expect.refusal?.code === 'content-too-large')

  // The record says the two differ here: what does not fit a chart's box is refused by the engine that lays it out, and Word lays its own chart out.
  test.each(UNFIT.map((fixture) => [fixture.id, fixture] as const))(
    '%s: refused by the PDF for what ECharts laid out, and written as a Word file',
    async (_id, fixture) => {
      expect(await pdfRefusal(fixture.document)).toEqual(fixture.expect.refusal)
      expect(await verifyDocx(fixtureOf(fixture.id, fixture.document), written(fixture.document))).toEqual([])
    },
    TIMEOUT,
  )

  // A word no report prints is refused by both, as a paragraph's is: by the same code, naming the chart.
  test('refuses a word of a chart in a script no report prints as the PDF does', async () => {
    const { document } = CHART_FIXTURES.find((fixture) => fixture.id === 'chart-unprintable-label')!
    const word = refusalOf(document)
    expect({ code: word.code, subject: word.subject }).toEqual(await pdfRefusal(document))
  })

  // Neither engine's page holds a box taller than it: each says so its own way, by the same code and the chart's id.
  test('refuses a chart taller than a page as the PDF does, by its code and its id', async () => {
    const chart = { ...(DRAWN[0]!.document.body.find((block) => block.kind === 'chart') as Chart), height: 5000 }
    const document = documentOf([chart])
    expect(await pdfRefusal(document)).toEqual({ code: 'content-too-large', subject: chart.id })
    expect(refusalOf(document)).toMatchObject({ code: 'content-too-large', subject: chart.id })
  })

  // Each engine bounds a document's charts by what they cost it, and the two costs are not one: the record says which engine refuses what.
  test(
    'each engine holds the charts of a document to a bound of its own',
    async () => {
      const line = (id: string, series: number, categories: number): Chart => ({
        kind: 'chart',
        chart: 'line',
        id,
        width: 495,
        height: 200,
        categories: Array.from({ length: categories }, () => ''),
        series: Array.from({ length: series }, (_, index) => ({
          color: `#${String(index + 1).repeat(6)}`,
          values: Array.from({ length: categories }, () => ({ exact: '1', text: '1' })),
        })),
        ticks: [
          { exact: '0', text: '0' },
          { exact: '1', text: '1' },
        ],
        valueLabels: false,
        legend: [],
      })
      // Three lines of eight series over two hundred categories cost the PDF's layout more than a render may; a Word file holds sixteen.
      const heavy = documentOf([0, 1, 2].map((index) => ({ ...line(`heavy${index}`, 8, 200), title: 'Heavy' })))
      expect(await pdfRefusal(heavy)).toEqual({ code: 'content-too-large', subject: 'heavy2' })
      expect(docxCharts(written(heavy))).toHaveLength(3)
      // One more small chart than a Word file holds is a part too many for it, and little for the PDF to lay out.
      const many = documentOf(Array.from({ length: MAX_DOCX_CHARTS + 1 }, (_, index) => line(`small${index}`, 1, 2)))
      expect(refusalOf(many)).toMatchObject({ code: 'content-too-large', subject: `small${MAX_DOCX_CHARTS}` })
      expect(await pdfRefusal(many)).toBeUndefined()
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
    // A face that is no font, which each engine reads before it walks anything.
    fonts: { serif: { normal: { id: 'face', digest: `sha256:${'0'.repeat(64)}`, bytes: new Uint8Array([1, 2, 3, 4]) } } },
  })
  const STEPS: readonly (readonly [string, ResolvedDocument])[] = (
    [
      ['face', {}],
      ['info.creationDate', { fonts: {} }],
      ['info.title', { info: { title: 7 as unknown as string, creationDate: '2026-01-01T00:00:00Z' } }],
      ['page.size', { info: { title: 'Wrong', creationDate: '2026-01-01T00:00:00Z' } }],
      ['pageHeader[0]', { page: A4 }],
      ['firstPageHeader[0]', { pageHeader: [] }],
      ['pageFooter[0]', { firstPageHeader: [] }],
      ['body[1]', { pageFooter: [] }],
      ['broken', { body: [broken] }],
    ] as const
  ).reduce<[string, ResolvedDocument][]>((steps, [subject, right]) => [...steps, [subject, { ...(steps.at(-1)?.[1] ?? WRONG), ...right }]], [])

  // Every document of the list below is wrong once. A document wrong twice is refused for one thing, and for the same thing by both: a
  // face that is no font, the creation date, the title, the page, the page header, page 1's own, the page footer, the body's blocks in
  // their order, and a picture's bytes last, wherever the picture stands -- an engine that read them where it met the picture would
  // refuse this body for another block.
  test.each(STEPS)(
    'a document wrong in several places is refused by both engines for %s first',
    async (subject, document) => {
      const word = refusalOf(document)
      expect(word.subject).toBe(subject)
      expect({ code: word.code, subject: word.subject }).toEqual(await pdfRefusal(document))
    },
    TIMEOUT,
  )

  // The image data a document's pictures may hold is a number in each engine, and the writer's is stated to be the renderer's. Both
  // refuse by the picture that crossed it, so two documents hold the numbers to each other without either being drawn: one whose third
  // picture takes the count a byte past the bound, and one whose third takes it to the bound exactly and is not what is refused -- the
  // fourth is, a JPEG, which both count by its bytes. An engine whose bound were a byte higher would draw the first, one whose bound
  // were a byte lower would refuse the second a picture sooner, and one that counted no JPEG would draw the second.
  describe('past the image data its pictures may hold', () => {
    const image = (asset: ImageAsset): Block => ({ kind: 'image', asset, width: 32, height: 32, fit: 'contain' })
    /** The scanlines of a PNG of sixteen-bit RGBA, eight bytes a pixel, or of eight-bit, four: a filter byte and its pixels a row. */
    const scanlines = (width: number, height: number, bytes: number): number => height * (1 + width * bytes)
    const SIDE = MAX_ASSET_SIDE
    /** The largest PNG an asset may be, and one a row short of it. */
    const [whole, short] = [blank('whole', SIDE, SIDE), blank('short', SIDE, SIDE - 1)]
    const JPEG = IMAGE_KINDS.find((asset) => asset.mediaType === 'image/jpeg')!
    const held = scanlines(SIDE, SIDE, 8) + scanlines(SIDE, SIDE - 1, 8)

    test.each([
      // Two rows of eight-bit RGBA are a byte more than the one row of sixteen-bit that the two pictures before them leave room for.
      ['a byte past it', [whole, short, blank('rows', SIDE, 2, 'rgba')], held + scanlines(SIDE, 2, 4) - MAX_DOCX_IMAGE_DATA, 'rows'],
      ['at it, and a JPEG more', [whole, short, blank('row', SIDE, 1), JPEG], held + scanlines(SIDE, 1, 8) - MAX_DOCX_IMAGE_DATA, JPEG.id],
    ] as const)(
      '%s, is refused by both engines by the same code, for the picture that crossed it',
      async (_name, assets, past, subject) => {
        // The first document's pictures are a byte past the bound together; the second's PNGs are at it, to the byte.
        expect(past).toBe(subject === 'rows' ? 1 : 0)
        const document = documentOf(assets.map(image))
        const word = refusalOf(document)
        expect(word).toMatchObject({ code: 'content-too-large', subject })
        expect({ code: word.code, subject: word.subject }).toEqual(await pdfRefusal(document))
      },
      TIMEOUT,
    )
  })

  // The record says of two documents that the engines refuse them otherwise, and this holds it to both. The writer counts before it
  // reads -- an asset's bytes from its length, a PNG's image data from its header -- so that nothing past a bound is read or inflated,
  // and says the picture is too large. The renderer holds a render's pictures to no bound on their bytes, and inflates a PNG before it
  // counts its image data, and says the picture is none. A renderer that came to count first, or to bound the bytes, would make the
  // record's sentence untrue, and fail here.
  describe('a picture past a bound of the writer that is no picture either', () => {
    const image = (asset: ImageAsset): Block => ({ kind: 'image', asset, width: 32, height: 32, fit: 'contain' })
    const SIDE = MAX_ASSET_SIDE
    test.each<[string, ImageAsset[]]>([
      // Two assets of the largest size are all a file may store; the third is declared a PNG and is none.
      [
        'its bytes',
        [
          padded('first', MAX_ASSET_BYTES, 1),
          padded('second', MAX_ASSET_BYTES, 2),
          { id: 'third', mediaType: 'image/png', bytes: new Uint8Array(100).fill(0x55) },
        ],
      ],
      // Two of the largest PNG are all the image data a file may hold; the third's header promises as much, and its data is no stream.
      [
        'its image data',
        [blank('first', SIDE, SIDE), blank('second', SIDE, SIDE), blank('third', SIDE, SIDE, 'deep', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))],
      ],
    ])(
      'past %s, is refused by the writer for its size and by the renderer as no picture',
      async (_name, assets) => {
        const document = documentOf(assets.map(image))
        expect(refusalOf(document)).toMatchObject({ code: 'content-too-large', subject: 'third' })
        expect(await pdfRefusal(document)).toEqual({ code: 'invalid-asset', subject: 'third' })
      },
      TIMEOUT,
    )
  })

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
