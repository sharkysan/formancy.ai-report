import { baselineOf, readPdf, SHIFTED_FIXTURES, type PdfTextItem } from '@formancy/report-corpus'
import {
  RenderRefusal,
  resolveReport,
  SHIFTED_RISE,
  SHIFTED_SIZE,
  type BaselineShift,
  type Inline,
  type Paragraph,
  type ReportDefinition,
  type ResolvedDocument,
} from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { checkShifted, LOWERED_LINE } from './shifted.js'
import { bareDocument, documentOf, LINE, TIMEOUT } from './testing/documents.js'

/**
 * A run set below or above the line (0061), on the PDF pdfmake produced and
 * PDF.js read back: drawn at `SHIFTED_SIZE` of its paragraph's size, its
 * baseline moved by `SHIFTED_RISE` of that size from the run beside it on
 * the line, in Roboto and in a host's Liberation Serif; and the paragraph
 * refused where pdfmake could set such a run on a line of its own, read
 * from pdfmake's own words (`shifted.ts`).
 *
 * The geometry is read here from PDF.js's runs directly, never through the
 * corpus's line reader, which joins a run only where it is drawn at exactly
 * this geometry and so cannot be the proof of it. The corpus's checks over
 * `SHIFTED_FIXTURES` are `corpus.test.ts`'s. A run is set so in page 1's
 * own header (0060) as anywhere, and in the language a render names
 * (0063) as in the report's own.
 */

/** How near, in points, what PDF.js reads must be to what the document states: a hundredth of a point. */
const POINT = 0.01

function run(text: string, baseline?: BaselineShift): Inline {
  return baseline === undefined ? { text } : { text, baseline }
}

function paragraphOf(runs: readonly Inline[], size: number): Paragraph {
  return { kind: 'paragraph', runs, style: { size } }
}

/** A run PDF.js read set below or above the line, with the run on the line it was read against. */
interface Read {
  readonly text: string
  readonly shift: BaselineShift
  readonly size: number
}

/**
 * Every run on `items` drawn smaller than `size`, read against the run on
 * the line that ends where it starts or starts where it ends: its size held
 * to `SHIFTED_SIZE` of `size`, and its baseline's distance from that run's
 * to `SHIFTED_RISE` of `size`, each to a hundredth of a point. A small run
 * with no such neighbour, or drawn at any other size or move, fails here.
 */
function shiftedRunsOn(items: readonly PdfTextItem[], size: number): Read[] {
  const onLine = items.filter((item) => Math.abs(item.height - size) <= POINT)
  return items
    .filter((item) => item.height < size - POINT)
    .map((item) => {
      expect(item.height, `'${item.text}' is drawn at ${SHIFTED_SIZE} of ${size} pt`).toBeCloseTo(SHIFTED_SIZE * size, 2)
      const beside = onLine.find((other) => Math.abs(other.x + other.width - item.x) <= POINT || Math.abs(item.x + item.width - other.x) <= POINT)
      expect(beside, `'${item.text}' stands against a run on the line`).toBeDefined()
      const rise = baselineOf(beside!) - baselineOf(item)
      const shift = rise > 0 ? 'superscript' : 'subscript'
      expect(rise, `'${item.text}' is moved by ${shift}'s ${SHIFTED_RISE[shift]} of ${size} pt`).toBeCloseTo(SHIFTED_RISE[shift] * size, 2)
      return { text: item.text, shift, size: item.height }
    })
}

/** The runs `document`'s body sets below or above the line, in order, as `shiftedRunsOn` reads them. */
function setIn(document: ResolvedDocument): { text: string; shift: BaselineShift }[] {
  return document.body.flatMap((block) =>
    block.kind === 'paragraph'
      ? block.runs.flatMap((each) => ('text' in each && each.baseline !== undefined ? [{ text: each.text, shift: each.baseline }] : []))
      : [],
  )
}

/** Liberation Serif 2.1.5's line, as a multiple of the font size: its ascender and descender, 1825 and 443 of 2048 units, as the renderer reads a host face's (`host-fonts.ts`). */
const SERIF_LINE = (1825 + 443) / 2048

/**
 * The lines of a paragraph of `size` on `items`, top to bottom, by the
 * baselines of its runs on the line, and the line each run stands on: a run
 * set off the line by the nearest baseline, within half the size.
 */
function linesOf(items: readonly PdfTextItem[], size: number): { readonly baselines: readonly number[]; readonly lineOf: (item: PdfTextItem) => number } {
  const onLine = items.filter((item) => Math.abs(item.height - size) <= POINT)
  const baselines = [...new Set(onLine.map((item) => Math.round(baselineOf(item) * 100) / 100))].sort((a, b) => a - b)
  return { baselines, lineOf: (item) => baselines.findIndex((baseline) => Math.abs(baseline - baselineOf(item)) < 0.5 * size) }
}

/**
 * Every pair of runs on different lines whose boxes, as the corpus draws a
 * run's, share more than `POINT` both ways: none may. Two runs set solid,
 * one under the other, touch, which rounding leaves a little either side.
 */
function overlapping(items: readonly PdfTextItem[], lineOf: (item: PdfTextItem) => number): string[] {
  const shared = (from: number, to: number, otherFrom: number, otherTo: number): boolean => Math.min(to, otherTo) - Math.max(from, otherFrom) > POINT
  return items.flatMap((item, index) =>
    items
      .slice(index + 1)
      .filter(
        (other) =>
          lineOf(other) !== lineOf(item) &&
          shared(item.top, item.bottom, other.top, other.bottom) &&
          shared(item.x, item.x + item.width, other.x, other.x + other.width),
      )
      .map((other) => `'${item.text}' on line ${lineOf(item) + 1} and '${other.text}' on line ${lineOf(other) + 1}`),
  )
}

async function rendered(document: ResolvedDocument): Promise<PdfTextItem[]> {
  const pdf = await readPdf(await renderPdf(document, { maxPages: 1 }))
  return pdf.pages.flatMap((page) => [...page.items])
}

async function refusalOf(document: ResolvedDocument): Promise<unknown> {
  return renderPdf(document, { maxPages: 2 }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

describe('a run set below or above the line, on the PDF', () => {
  // pdfmake sets `sub` and `sup` at 0.58 of the size, moved 0.35 and 0.75
  // of that, and the document states those figures as Report's. A renderer
  // that handed pdfmake neither printed H2O with its digit on the line; a
  // pdfmake release that moved them would print a formula the corpus does
  // not read. Each kind of word: a lowered digit between letters, a raised
  // one after its letter, a raised minus and digit, an isotope's mass before
  // its letter, a lowered letter and a footnote's mark a no-break space from
  // its text -- at two sizes, in the face the report prints in by default.
  test.each([10, 13])(
    'is drawn at SHIFTED_SIZE of its paragraph and moved by SHIFTED_RISE, in Roboto at %s pt',
    async (size) => {
      const document = bareDocument('Formulas', [
        paragraphOf(
          [
            run('Water H'),
            run('2', 'subscript'),
            run('O, 24 m'),
            run('2', 'superscript'),
            run(', 4.5 × 10'),
            run('−3', 'superscript'),
            run(' and '),
            run('14', 'superscript'),
            run('C, the index a'),
            run('i', 'subscript'),
            run(', a mark'),
            run('1', 'superscript'),
            run('\u00a0read.'),
          ],
          size,
        ),
      ])
      expect(shiftedRunsOn(await rendered(document), size)).toEqual(setIn(document).map((each) => ({ ...each, size: expect.closeTo(SHIFTED_SIZE * size, 2) })))
    },
    TIMEOUT,
  )

  // A host face lays its line out by its own metrics (0043); the run set
  // below or above it is pdfmake's same 0.58 and move, in the face its
  // paragraph prints in, regular and bold, a raised minus among them, which
  // Liberation Serif has no raised form of.
  test(
    "is drawn at the same geometry in a host's Liberation Serif",
    async () => {
      const fixture = SHIFTED_FIXTURES.find((each) => each.id === 'shifted-host-fonts')!
      const size = (fixture.document.body[1] as Paragraph).style!.size!
      // Its body alone: the corpus's page header and footer print smaller than the body, and no run of theirs is set off the line.
      const items = await rendered({ ...fixture.document, pageHeader: [], pageFooter: [] })
      expect(items.filter((item) => item.text.startsWith('SERIF')).every((item) => /Serif/.test(item.font))).toBe(true)
      expect(shiftedRunsOn(items, size)).toEqual(setIn(fixture.document).map((each) => ({ ...each, size: expect.closeTo(SHIFTED_SIZE * size, 2) })))
    },
    TIMEOUT,
  )

  // pdfmake makes no room for a run set off the line: a raised run's box
  // reaches above its line's text, a lowered one's below. The renderer
  // makes room below a line that holds a lowered run, `LOWERED_LINE` of the
  // size to the next line's baseline where the face's own line is less,
  // and leaves every other line its face's: without it, a formula's digit
  // would print over a raised run on the line below. The corpus's wrapped
  // paragraph, whose runs set both ways stand on lines with a line above
  // and a line below, is read where it was drawn: each run's box against
  // every run of another line, set off it or not, and each line's
  // distance from the next.
  test(
    'stands clear of the lines above and below it where its paragraph wraps',
    async () => {
      const formulas = SHIFTED_FIXTURES.find((each) => each.id === 'shifted-formulas')!
      const wrapped = formulas.document.body.at(-1) as Paragraph
      const size = wrapped.style!.size!
      const items = await rendered(bareDocument('Wrapped', [wrapped]))
      const { baselines, lineOf } = linesOf(items, size)
      const shifted = items
        .filter((item) => item.height < size - POINT)
        .map((item) => ({ item, line: lineOf(item), raised: baselineOf(item) < baselines[lineOf(item)]! }))
      expect(shifted.every(({ line }) => line >= 0)).toBe(true)
      // Some line between the first and the last holds a raised run and a lowered one.
      const inner = shifted.filter(({ line }) => line > 0 && line < baselines.length - 1)
      expect(new Set(inner.map(({ raised }) => raised))).toEqual(new Set([true, false]))
      expect(overlapping(items, lineOf)).toEqual([])
      // Some lines hold a lowered run and some do not: each is as far from the next as it needs, and no farther.
      const lowered = new Set(shifted.filter(({ raised }) => !raised).map(({ line }) => line))
      const above = baselines.slice(0, -1).map((_, index) => lowered.has(index))
      expect(new Set(above)).toEqual(new Set([true, false]))
      baselines.slice(1).forEach((baseline, index) => {
        const pitch = lowered.has(index) ? Math.max(LINE, LOWERED_LINE) : LINE
        expect(baseline - baselines[index]!, `line ${index + 1} to the next`).toBeCloseTo(pitch * size, 2)
      })
    },
    TIMEOUT,
  )

  // A lowered digit on one line over a raised one on the next: by the
  // corpus's boxes the two met, in Liberation Serif at 10 points and in
  // Roboto at 24 by 1.11 pt, though each stood clear of the text on the
  // line. The line that holds the lowered run is `LOWERED_LINE` of the size
  // to the next line's baseline -- a lowered run's drop, a raised one's
  // rise and the small run's own size -- so the two are set solid, one
  // under the other, their boxes apart.
  test.each<[string, number]>([
    ['Liberation Serif', SERIF_LINE],
    ['Roboto', LINE],
  ])(
    'makes room below a line that holds a lowered run for a raised run on the next, in %s',
    async (face, line) => {
      const stacked = SHIFTED_FIXTURES.find((each) => each.id === 'shifted-stacked')!
      const columns = stacked.document.body.flatMap((block) => (block.kind === 'columns' ? [block] : []))
      const column = columns.find((block) => ((block.columns[0]!.blocks[0] as Paragraph).style!.font === 'serif') === (face === 'Liberation Serif'))!
      const size = (column.columns[0]!.blocks[0] as Paragraph).style!.size!
      // That column alone: the corpus's page header and footer print smaller than the body, and no run of theirs is set off the line.
      const items = await rendered({ ...stacked.document, body: [column], pageHeader: [], pageFooter: [] })
      const { baselines, lineOf } = linesOf(items, size)
      expect(baselines).toHaveLength(2)
      expect(line).toBeLessThan(LOWERED_LINE)
      expect(baselines[1]! - baselines[0]!).toBeCloseTo(LOWERED_LINE * size, 2)
      expect(items.filter((item) => item.height < size - POINT).map((item) => [item.text, lineOf(item)])).toEqual([
        ['2', 0],
        ['2', 1],
      ])
      expect(overlapping(items, lineOf)).toEqual([])
    },
    TIMEOUT,
  )

  // A run that sets no baseline is drawn on its line at its paragraph's
  // size, as every run was before 0061: the renderer hands pdfmake no `sub`
  // or `sup` for it, so nothing small is drawn on the page at all.
  test(
    'leaves a paragraph that sets none on its line',
    async () => {
      const items = await rendered(bareDocument('Plain', [paragraphOf([run('Water H'), run('2'), run('O.')], 10)]))
      expect(items.filter((item) => Math.abs(item.height - 10) > POINT)).toEqual([])
    },
    TIMEOUT,
  )

  // A render in a language the report declares (0063) prints the
  // translation's text where the report's own stood, at the baseline the
  // report's run sets: a translation writes a run's text and nothing else
  // of it, so a word set below the line in German is set below it in
  // French, at the size and the move every such run is drawn at, and a
  // digit set above it prints as written. The runtime holds the document;
  // here it is held on the PDF, the German word printed nowhere.
  test(
    'sets a word below or above the line in the language a render names, as the report sets it',
    async () => {
      const report: ReportDefinition = {
        reportSpecVersion: '0',
        id: 'area',
        title: 'Fläche',
        locale: 'de-CH',
        page: { size: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
        styles: [{ id: 'body', size: 10 }],
        datasets: {},
        parameters: [],
        assets: [],
        aggregates: [],
        regions: {
          reportHeader: [],
          pageHeader: [],
          body: [
            {
              id: 'area',
              kind: 'text',
              style: 'body',
              content: [
                { kind: 'text', text: 'Fläche in m' },
                { kind: 'text', text: '2', baseline: 'superscript' },
                { kind: 'text', text: ', Spitze bei t' },
                { kind: 'text', text: 'Ende', baseline: 'subscript' },
              ],
            },
          ],
          pageFooter: [],
          summary: [],
        },
        translations: [
          {
            locale: 'fr-CH',
            words: [
              { word: 'Fläche', text: 'Surface' },
              { word: 'Fläche in m', text: 'Surface en m' },
              { word: ', Spitze bei t', text: ', pic à t' },
              { word: 'Ende', text: 'fin' },
            ],
            expressions: [],
          },
        ],
      }
      const data = { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' } as const
      const outcome = resolveReport(report, data, { mode: 'final', parameters: {}, creationDate: '2026-10-15T08:00:00Z', locale: 'fr-CH' })
      if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join('; ')}`)
      const items = await rendered(outcome.document)
      expect(shiftedRunsOn(items, 10).map(({ text, shift }) => [text, shift])).toEqual([
        ['2', 'superscript'],
        ['fin', 'subscript'],
      ])
      expect(items.map((item) => item.text).join('|')).not.toMatch(/Fläche|Spitze|Ende/u)
    },
    TIMEOUT,
  )

  // Page 1's own header (0060) is laid out in page 1's background, and page
  // 1's body moved below the room a pass of its own measured for it. A run
  // set off the line there is drawn as anywhere else, and a line of it that
  // holds a lowered run takes `LOWERED_LINE` of its size: a pass that
  // measured the header without that room would start page 1's body by as
  // much inside the header's last line, where a raised run of the body's
  // first line would meet the lowered one.
  test(
    "sets one in page 1's own header, page 1's body below the room a lowered run takes",
    async () => {
      const size = 10
      const formula = paragraphOf([run('Order of H'), run('2', 'subscript'), run('O in 1 m'), run('3', 'superscript')], size)
      const plain = paragraphOf([run('Order of H2O in 1 m3')], size)
      const under = (header: Paragraph): Promise<PdfTextItem[]> =>
        rendered({ ...bareDocument('First page', [paragraphOf([run('Body.')], size)]), firstPageHeader: [header] })
      const [items, flat] = await Promise.all([under(formula), under(plain)])
      expect(shiftedRunsOn(items, size).map(({ text, shift }) => [text, shift])).toEqual([
        ['2', 'subscript'],
        ['3', 'superscript'],
      ])
      const body = (read: readonly PdfTextItem[]): number => baselineOf(read.find((item) => item.text === 'Body.')!)
      expect(LINE).toBeLessThan(LOWERED_LINE)
      expect(body(items) - body(flat)).toBeCloseTo((LOWERED_LINE - LINE) * size, 2)
    },
    TIMEOUT,
  )
})

describe('a paragraph whose run could stand alone on a line', () => {
  // pdfmake lays a line out as tall as its runs' own lines and moves a run
  // set off it only when it draws it: a line of nothing but such runs is
  // laid out small and drawn above its own top, into the line before. Each
  // way a word comes to hold no run on the line is refused, naming the
  // paragraph, a column's included, before a line is laid out.
  test.each<[string, readonly Inline[]]>([
    ['a word of nothing but such runs', [run('2', 'subscript'), run('3', 'superscript')]],
    ["a footnote's mark after a space", [run('A measured value '), run('1', 'superscript')]],
    ["a footnote's mark before a space, whose word holds the space alone", [run('1', 'superscript'), run(' As read on site.')]],
    ['a run beside one that prints nothing, before it', [run('Na'), run(''), run('2', 'subscript')]],
    ['a run beside one that prints nothing, after it', [run('Value '), run('2', 'superscript'), run('')]],
    ['a run whose value prints a space before its digit, which leaves the digit a word of its own', [run('Area'), run(' 2', 'superscript')]],
  ])(
    'refuses %s as unsupported, naming it',
    async (_name, runs) => {
      const refused = await refusalOf(documentOf('Alone', [paragraphOf([run('Before.')], 9), paragraphOf(runs, 9)]))
      expect(refused).toBeInstanceOf(RenderRefusal)
      expect(refused).toMatchObject({ code: 'unsupported', subject: 'body[1]' })
      expect((refused as RenderRefusal).message).toContain('U+00A0')
    },
    TIMEOUT,
  )

  // A page region's paragraph is read in the pass that measures the
  // regions, as its words are: one refused there is refused once, naming
  // the region's block.
  test(
    "refuses one in a page region, naming the region's block",
    async () => {
      const document: ResolvedDocument = {
        ...documentOf('Footer', [paragraphOf([run('Body.')], 9)]),
        pageFooter: [paragraphOf([run('Note '), run('1', 'superscript')], 8)],
      }
      expect(await refusalOf(document)).toMatchObject({ code: 'unsupported', subject: 'pageFooter[0]' })
    },
    TIMEOUT,
  )

  // Page 1's own header (0060) is drawn in page 1's background, laid out
  // after the check has read the body's words, and is recorded in no pass
  // but the one that measures it alone: read there, as its words are, or
  // nowhere, and then printed with its run on a line of its own, drawn
  // into the line above. Refused, naming the header's block.
  test(
    "refuses one in page 1's own header, naming the header's block",
    async () => {
      const document: ResolvedDocument = {
        ...documentOf('First page', [paragraphOf([run('Body.')], 9)]),
        firstPageHeader: [paragraphOf([run('Letterhead.')], 9), paragraphOf([run('Order '), run('1', 'superscript')], 9)],
      }
      expect(await refusalOf(document)).toMatchObject({ code: 'unsupported', subject: 'firstPageHeader[1]' })
    },
    TIMEOUT,
  )

  // pdfmake breaks a word wider than its line anywhere, and a piece of it
  // could hold such a run and no run on the line: refused as too large,
  // naming the paragraph in its column, though every piece of the word is
  // narrower than the column and the word check passes it.
  test(
    'refuses a word that holds one and is wider than its line, as content-too-large',
    async () => {
      const formula = paragraphOf([run('Na'), run('2', 'subscript'), run('SO'), run('4', 'subscript'), run('·10H'), run('2', 'subscript'), run('O')], 9)
      const document = documentOf('Wide', [
        paragraphOf([run('Before.')], 9),
        {
          kind: 'columns',
          columns: [
            { width: 40, blocks: [formula] },
            { width: 'fill', blocks: [] },
          ],
        },
      ])
      expect(await refusalOf(document)).toMatchObject({ code: 'content-too-large', subject: 'body[1].columns[0].blocks[0]' })
    },
    TIMEOUT,
  )

  // A baseline the renderer does not know -- a document built by hand, or
  // by a runtime of another release -- would print its run on the line,
  // as though nothing were set: refused, as an unknown field is (0011).
  test.each<[string, Inline]>([
    ['on a run of text', { text: '2', baseline: 'middle' as BaselineShift }],
    ['on a page field', { field: 'pageNumber', baseline: 'superscript' } as unknown as Inline],
  ])(
    'refuses a baseline it does not know %s, before anything is laid out',
    async (_name, odd) => {
      const document: ResolvedDocument = { ...documentOf('Odd', [paragraphOf([run('H')], 9)]), pageFooter: [paragraphOf([run('H'), odd], 8)] }
      expect(await refusalOf(document)).toMatchObject({ code: 'unsupported', subject: 'pageFooter[0]' })
    },
    TIMEOUT,
  )
})

describe("the check, on pdfmake's words", () => {
  /** pdfmake's word as `TextInlines` measures it, as far as the check reads it. */
  const word = (text: string, width: number, shift?: BaselineShift, chained = false, cuts: { leadingCut?: number; trailingCut?: number } = {}) => ({
    text,
    width,
    sub: shift === 'subscript',
    sup: shift === 'superscript',
    leadingCut: cuts.leadingCut ?? 0,
    trailingCut: cuts.trailingCut ?? 0,
    ...(chained ? { noNewLine: true } : {}),
  })
  const room = (inlines: readonly object[], width = 100) => [{ node: { _inlines: inlines }, width, subject: 'body[0]' }]

  // A run on the line is one that prints something a reader sees: a word
  // holding such a run and a no-break space and text passes, and so does a
  // word of text whose next word holds one, as they are not chained, and a
  // word still chained where pdfmake's words end, read whole all the same.
  test('passes a word that holds a run on the line printing a character', () => {
    expect(() => checkShifted(room([word('H', 7, undefined, true), word('2', 3, 'subscript', true)]))).not.toThrow()
    expect(() => checkShifted(room([word('2', 3, 'subscript', true)]))).toThrow(expect.objectContaining({ code: 'unsupported' }))
    expect(() => checkShifted(room([word('H', 7, undefined, true), word('2', 3, 'subscript', true), word('O', 7)]))).not.toThrow()
    expect(() => checkShifted(room([word('1', 3, 'superscript', true), word('\u00a0read', 20)]))).not.toThrow()
    expect(() => checkShifted(room([word('plain ', 25, undefined, false, { trailingCut: 2.5 }), word('text', 15)]))).not.toThrow()
  })

  // A word whose only run on the line prints a space, or nothing, holds no
  // run on the line a reader sees: pdfmake lays it out as tall as that
  // run's line, but the run set off the line stands on it as alone, apart
  // from the text it belongs to, and is refused all the same (0061).
  test.each([
    ['a space', ' '],
    ['nothing', ''],
    ['a no-break space alone', '\u00a0'],
  ])('refuses a word whose run on the line prints %s', (_name, text) => {
    expect(() => checkShifted(room([word('1', 3, 'superscript', true), word(text, 2.5, undefined, false, { trailingCut: 2.5 })]))).toThrow(
      expect.objectContaining({ code: 'unsupported', subject: 'body[0]' }),
    )
  })

  // The width is pdfmake's own for a word that starts a line, its leading
  // cut and its trailing cuts left out (`Line.hasEnoughSpaceForInline`): a
  // word that fits exactly, but for spaces at its head and its end, is laid
  // out whole, and is not refused; a hundredth of a point more is broken
  // by pdfmake.
  test('holds a word to its line as pdfmake measures it, leading and trailing spaces left out', () => {
    const exact = [word(' H', 52, undefined, true, { leadingCut: 2 }), word('2', 20, 'subscript', true), word('O  ', 35, undefined, false, { trailingCut: 5 })]
    expect(() => checkShifted(room(exact, 100))).not.toThrow()
    expect(() => checkShifted(room(exact, 99.99))).toThrow(expect.objectContaining({ code: 'content-too-large', subject: 'body[0]' }))
  })

  // A node pdfmake has not measured holds no words to read: passed over
  // silently, every run so set would print unchecked. The renderer records
  // only nodes pdfmake measures before the first page's background, so one
  // without words is pdfmake changed, and stops the render.
  test('stops on a node pdfmake has written no words onto, rather than pass it', () => {
    expect(() => checkShifted([{ node: {}, width: 100, subject: 'body[0]' }])).toThrow(/pdfmake has measured no words/)
  })

  // A word without its width or its cuts measures as no number, which is
  // wider than nothing: passed, a word too wide for its line would print
  // unchecked. pdfmake 0.3.11 writes them on every word (`pdfmake.test.ts`).
  test('stops on a word pdfmake has written no width or cuts onto, rather than pass it', () => {
    expect(() => checkShifted(room([{ text: 'H', width: 7, noNewLine: true }, word('2', 3, 'subscript')]))).toThrow(/without its width and its cuts/)
  })
})
