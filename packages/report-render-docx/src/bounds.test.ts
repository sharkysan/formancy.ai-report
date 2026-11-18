import { deflateSync } from 'node:zlib'
import { encodePng, IMAGE_KINDS, pngOf, readZip, SVG_MARK } from '@formancy/report-corpus'
import { MAX_ASSET_BYTES, MAX_ASSET_SIDE } from '@formancy/report-runtime'
import type { Block, Image, ImageAsset, Paragraph, ResolvedFonts, Table } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import {
  MAX_DOCX_CHARACTERS,
  MAX_DOCX_FAMILY_LENGTH,
  MAX_DOCX_IMAGE_DATA,
  MAX_DOCX_MEDIA_BYTES,
  MAX_DOCX_PARAGRAPHS,
  MAX_DOCX_PICTURES,
  MAX_DOCX_RUNS,
} from './limits.js'
import { renderDocx } from './render.js'
import { keptRows, type StyledRow } from './rows.js'
import { LONGEST_FAMILY, QUOTED_FAMILY } from './testing/fonts.js'
import { blank, documentOf, paragraph, refusalOf, written } from './testing/support.js'

/**
 * The writer's bounds (0068), at each and one past it. The writer builds
 * a file in one step, in memory, on the thread that calls it, and counts
 * no page: a document it would run out of memory on must be refused
 * before any of it is built, and one at a bound must be written, since a
 * limit applied with >= where it means > refuses what it promised.
 *
 * What a file at the bounds costs is measured apart, a process a
 * measurement, and said where the bounds are (`limits.ts`): a test that
 * timed it would fail on a busy runner.
 */

/** A table of one column whose header and `rows` rows each hold `text`: a cell is a paragraph. */
const table = (rows: number, text: string): Table => ({
  kind: 'table',
  id: 'lines',
  columns: [{ width: 'fill', align: 'left' }],
  header: [text],
  rows: Array.from({ length: rows }, () => ({ kind: 'detail', cells: [text] })),
  emptyText: '',
})

/** How often `needle` stands in `bytes`. */
function count(bytes: Uint8Array, needle: string): number {
  const [haystack, sought] = [Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), Buffer.from(needle)]
  let found = 0
  for (let at = haystack.indexOf(sought); at >= 0; at = haystack.indexOf(sought, at + sought.length)) found += 1
  return found
}

describe('the paragraphs and the characters of a file', () => {
  // The worst a document may ask for: every paragraph the bound allows, holding every character the other allows between them.
  test('at both bounds at once are written, every paragraph and every character of them', () => {
    const each = MAX_DOCX_CHARACTERS / MAX_DOCX_PARAGRAPHS
    expect(Number.isInteger(each)).toBe(true)
    const bytes = renderDocx(documentOf([table(MAX_DOCX_PARAGRAPHS - 1, '&'.repeat(each))]))
    const document = readZip(bytes).find((entry) => entry.name === 'word/document.xml')!.bytes
    // Every cell a paragraph, and the one that ends the body after its table.
    expect(count(document, '<w:p>')).toBe(MAX_DOCX_PARAGRAPHS + 1)
    expect(count(document, '&amp;')).toBe(MAX_DOCX_CHARACTERS)
  }, 120_000)

  // A bound that named nothing would leave a person to find which of a report's tables is the one too long.
  test('one paragraph past the bound is refused, naming the table that crossed it', () => {
    const refusal = refusalOf(documentOf([table(MAX_DOCX_PARAGRAPHS, 'a')]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'lines' })
    expect(refusal.message).toMatch(/more than 100000 paragraphs, a table's cell being one/)
  })

  /** So many spacers, each a paragraph of the file and nothing else. */
  const spacers = (length: number): Block[] => Array.from({ length }, () => ({ kind: 'spacer', height: 1 }))

  // The count is of every block that is a paragraph of the file, wherever it stands: a bound that counted cells alone would be passed by paragraphs.
  test('is counted across the page regions and the body, a spacer a paragraph', () => {
    const one = documentOf(spacers(MAX_DOCX_PARAGRAPHS))
    expect(() => renderDocx(one)).not.toThrow()
    expect(refusalOf({ ...one, pageHeader: [paragraph('one more')] })).toMatchObject({ code: 'content-too-large', subject: `body[${MAX_DOCX_PARAGRAPHS - 1}]` })
  }, 120_000)

  const DOT: ImageAsset = { id: 'dot', mediaType: 'image/png', bytes: encodePng(1, 1, () => [0, 0, 0]) }

  // Each of these is written as a paragraph of its own, or as a table's cell that ends with one, and none of them is text: a kind whose
  // count were dropped would let a report of nothing else -- a hundred thousand rules, or boxes -- past the bound that the cells are held
  // to. A rectangle and a section's frame are a table each around their paragraph, with its own properties, its grid, its row and its
  // cell's borders and fill, twice a cell of a table in the XML it is written in: counted as one, 100,000 filled rectangles were written
  // in 3.3 seconds and 1,250 MB, more than any text the bounds allow. One of each after spacers: at the bound written, and one past it
  // refused by the block that crossed it.
  test.each<[string, Block, number, (at: string) => string]>([
    ['a picture', { kind: 'image', asset: DOT, width: 10, height: 10, fit: 'contain' }, 1, () => DOT.id],
    ['a rule', { kind: 'rule', thickness: 1 }, 1, (at) => at],
    ['a page break', { kind: 'pageBreak' }, 1, (at) => at],
    ['a column', { kind: 'columns', columns: [{ width: 'fill', blocks: [] }] }, 1, (at) => at],
    ['a rectangle', { kind: 'rectangle', width: 10, height: 10 }, 2, (at) => at],
    ['a framed section', { kind: 'section', padding: 2, blocks: [] }, 2, (at) => at],
  ])(
    '%s is counted with the paragraphs: at the bound written, and past it refused by the block that crossed it',
    (_name, block, counted, subject) => {
      const room = MAX_DOCX_PARAGRAPHS - counted
      expect(() => renderDocx(documentOf([...spacers(room), block]))).not.toThrow()
      expect(refusalOf(documentOf([...spacers(room + 1), block]))).toMatchObject({ code: 'content-too-large', subject: subject(`body[${room + 1}]`) })
    },
    120_000,
  )

  // The second bound, since a cell may be sixteen thousand characters: the paragraphs alone would let a document ask for a billion and a half.
  test('a character past the bound is refused, naming the paragraph that crossed it', () => {
    const refusal = refusalOf(documentOf([paragraph('first'), paragraph('a'.repeat(MAX_DOCX_CHARACTERS - 4))]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'body[1]' })
    expect(refusal.message).toMatch(/more than 4000000 characters long/)
  })

  // At the bound and not one short of it: applied with >= where it means >, the limit would refuse the text it promised to write.
  test('the characters at the bound in one paragraph are written', () => {
    const bytes = renderDocx(documentOf([paragraph('first'), paragraph('a'.repeat(MAX_DOCX_CHARACTERS - 5))]))
    expect(readZip(bytes).find((entry) => entry.name === 'word/document.xml')!.bytes.length).toBeGreaterThan(MAX_DOCX_CHARACTERS)
  }, 60_000)

  // A refusal for size comes before anything is built: the walk that counts is the walk that checks, and it stops at the row that crosses.
  // Held by what is never read, not by a clock: a cell past that row which would be refused for its character is not reached, and the
  // block after the table, which says when it is asked what it is, is asked by nothing, neither the walk nor a builder.
  test('is refused where the count crosses, with nothing after it read and nothing built', () => {
    const long = table(2 * MAX_DOCX_PARAGRAPHS, 'a')
    const rows = long.rows.map((row, index) => (index === long.rows.length - 1 ? { ...row, cells: ['\u0001'] } : row))
    let asked = false
    const after = Object.defineProperty({ runs: [{ text: 'after' }] }, 'kind', {
      enumerable: true,
      get: () => {
        asked = true
        return 'paragraph'
      },
    }) as unknown as Block
    expect(refusalOf(documentOf([{ ...long, rows }, after]))).toMatchObject({ code: 'content-too-large', subject: 'lines' })
    expect(asked).toBe(false)
  })

  // A report of headings alone, each kept with the next. Marked one heading at a time, each walked to what it heads, the file cost the square
  // of its paragraphs: 40,000 held the thread half a minute, and 80,000 were not written after 80 seconds. Marked in one pass, they cost their count.
  test('every one kept with the next, at the bound, is written, and every one but the last marked', () => {
    const headings: Block[] = Array.from({ length: MAX_DOCX_PARAGRAPHS - 1 }, () => ({ ...paragraph('h'), keepWithNext: true }))
    const bytes = renderDocx(documentOf([...headings, paragraph('text')]))
    const document = readZip(bytes).find((entry) => entry.name === 'word/document.xml')!.bytes
    expect(count(document, '<w:p>')).toBe(MAX_DOCX_PARAGRAPHS)
    expect(count(document, '<w:keepNext/>')).toBe(MAX_DOCX_PARAGRAPHS - 1)
  }, 120_000)

  // A table that closes with total after total. Each closing row looked back over every closing row above it for the row they add up, so
  // such a table cost the square of its rows too: 20,000 took a second and 40,000 four. Held by what is read, not by a clock: every row's
  // kind is asked for a few times, however many totals stand above it.
  test('a table of totals alone is marked by reading each row, not each row for every total above it', () => {
    let asked = 0
    const row = (kind: StyledRow['kind']): StyledRow =>
      Object.defineProperty({ index: 0, cells: ['t'], styles: [{}], across: false }, 'kind', {
        get: () => {
          asked += 1
          return kind
        },
      }) as unknown as StyledRow
    const rows = [row('header'), row('detail'), ...Array.from({ length: 10_000 }, () => row('total'))]
    // The header with the detail row, the detail row with the first total, and every total with the next: all but the last.
    expect(keptRows(rows, table(1, 't')).size).toBe(rows.length - 1)
    expect(asked).toBeLessThan(4 * rows.length)
  })
})

describe("a font's family, written longer than it is named", () => {
  // A family may be 31 characters, and the bounds are measured with one that long. One of 31 quotation marks is written six times as
  // long, in each of the four font slots of every run and every paragraph mark: 620 characters more a time, which nothing counted, so
  // that a table of 100,000 cells set in it was 124 MB of its name. Counted as characters, a file holds no more of them than of text.
  const QUOTED: ResolvedFonts = { sans: { normal: QUOTED_FAMILY } }
  /** What a run, or a paragraph's mark, set in that family is written longer than one of a family written as it is named. */
  const more = 4 * MAX_DOCX_FAMILY_LENGTH * ('&quot;'.length - 1)
  /** A paragraph of no run: its mark alone states the family. */
  const mark: Paragraph = { kind: 'paragraph', runs: [] }

  // In the page header a page field, three runs and a mark; in the body marks alone and one paragraph of a run: the characters left
  // under the bound are that run's text, at the bound to the character.
  test('is counted for every run, a page field three, and every paragraph mark: at the bound written, a character past it refused', () => {
    const marks = Math.floor(MAX_DOCX_CHARACTERS / more) - 6
    const text = MAX_DOCX_CHARACTERS - (marks + 6) * more
    expect(text).toBeGreaterThan(0)
    const document = (letters: number) =>
      documentOf([...Array.from({ length: marks }, () => mark), paragraph('A'.repeat(letters))], {
        fonts: QUOTED,
        pageHeader: [{ kind: 'paragraph', runs: [{ field: 'pageNumber' }] }],
      })
    expect(() => renderDocx(document(text))).not.toThrow()
    const refusal = refusalOf(document(text + 1))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: `body[${marks}]` })
    expect(refusal.message).toMatch(/more than 4000000 characters long, \d+ of them what a font's family is written past 31 characters/)
  }, 120_000)

  // A cell is a run and a mark, set in the family its own style names: counted where the cells are.
  test("is counted for every cell of a table, a run and a mark each, in the cell's own font", () => {
    const cells = Math.floor(MAX_DOCX_CHARACTERS / (2 * more))
    const text = MAX_DOCX_CHARACTERS - cells * 2 * more
    expect(text).toBeGreaterThan(0)
    const fonts: ResolvedFonts = { serif: { normal: QUOTED_FAMILY } }
    /** A table of that many cells, empty but for its header's, each set in `font`; the header light, since the font maps a regular face alone. */
    const lines = (letters: number, font: 'serif' | 'sans'): Table => {
      const plain = table(cells - 1, '')
      return { ...plain, header: ['A'.repeat(letters)], headerStyle: { font, bold: false }, rows: plain.rows.map((row) => ({ ...row, style: { font } })) }
    }
    expect(() => renderDocx(documentOf([lines(text, 'serif')], { fonts }))).not.toThrow()
    expect(refusalOf(documentOf([lines(text + 1, 'serif')], { fonts }))).toMatchObject({ code: 'content-too-large', subject: 'lines' })
    // The same table in the sans font, which this report maps to nothing: Roboto is written as it is named, and costs no character.
    expect(() => renderDocx(documentOf([lines(text + 1, 'sans')], { fonts }))).not.toThrow()
  }, 120_000)

  // The longest family Word reads, of letters, is what the bounds are measured with: it costs a file none of its characters.
  test('costs nothing where the family is written as it is named, however long', () => {
    const fonts: ResolvedFonts = { sans: { normal: LONGEST_FAMILY } }
    expect(() => renderDocx(documentOf([paragraph('AAAAA'), paragraph('A'.repeat(MAX_DOCX_CHARACTERS - 5))], { fonts }))).not.toThrow()
  }, 120_000)
})

describe('the runs of a file', () => {
  /** A paragraph of `runs`, each a run of its own. */
  const ofRuns = (runs: Paragraph['runs']): Paragraph => ({ kind: 'paragraph', runs })
  const letters = (length: number): Paragraph['runs'] => Array.from({ length }, () => ({ text: 'a' }))
  const fields = (length: number): Paragraph['runs'] => Array.from({ length }, () => ({ field: 'pageNumber' as const }))

  // A run states its own properties, some two hundred characters of XML for one of text. Bounded by its paragraph and its characters
  // alone, one paragraph of four million letters, each a run, was within both and held the thread nine seconds before the string the
  // file is built in grew past what V8 allows, a RangeError and no refusal.
  test('one past the bound in one paragraph is refused, naming the paragraph that crossed it', () => {
    const refusal = refusalOf(documentOf([paragraph('first'), ofRuns(letters(MAX_DOCX_RUNS))]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'body[1]' })
    expect(refusal.message).toMatch(/more than 200000 runs/)
  })

  // At the bound and not one short of it: applied with >= where it means >, the limit would refuse the runs it promised to write.
  test('at the bound are written, every one a run of the file', () => {
    const bytes = renderDocx(documentOf([paragraph('first'), ofRuns(letters(MAX_DOCX_RUNS - 1))]))
    const document = readZip(bytes).find((entry) => entry.name === 'word/document.xml')!.bytes
    expect(count(document, '<w:t xml:space="preserve">a</w:t>')).toBe(MAX_DOCX_RUNS - 1)
  }, 120_000)

  // A page field counts no character, and Word writes it as three runs: a million of them in the page header, no character at all, were
  // a RangeError after three seconds and a gigabyte. Counted as the three runs it is written as, the third of the bound is the most.
  test('a page field is counted as the three runs Word writes it as', () => {
    const most = Math.floor(MAX_DOCX_RUNS / 3)
    expect(() => renderDocx(documentOf([], { pageHeader: [ofRuns(fields(most))] }))).not.toThrow()
    expect(refusalOf(documentOf([], { pageHeader: [ofRuns(fields(most + 1))] }))).toMatchObject({ code: 'content-too-large', subject: 'pageHeader[0]' })
  }, 120_000)

  // An empty run writes nothing, and the walk still reads it: a bound that counted only what is written would let a paragraph of empty runs
  // be as long as the host's memory.
  test('an empty run is counted, though nothing of it is written', () => {
    const empty = Array.from({ length: MAX_DOCX_RUNS + 1 }, () => ({ text: '' }))
    expect(refusalOf(documentOf([ofRuns(empty)]))).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
  })

  // A line ending is written as a break, and what follows it as a `w:t` of its own: some forty characters of XML for the one character it
  // was counted as. One paragraph of one run of four million characters, every other a line feed, inside every bound, was written in 4.6
  // seconds and 1,440 MB. Counted as a run each, the bound on runs is the bound on breaks too.
  test('a line ending in a run is a run more: at the bound written, each a break, and one past it refused', () => {
    /** One run of so many line endings, a letter before each and one after the last: the run, and a run more for each ending. */
    const lines = (endings: number): Paragraph => ofRuns([{ text: `${'a\n'.repeat(endings)}a` }])
    const bytes = renderDocx(documentOf([lines(MAX_DOCX_RUNS - 1)]))
    const document = readZip(bytes).find((entry) => entry.name === 'word/document.xml')!.bytes
    expect(count(document, '<w:br/>')).toBe(MAX_DOCX_RUNS - 1)
    const refusal = refusalOf(documentOf([lines(MAX_DOCX_RUNS)]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
    expect(refusal.message).toMatch(/more than 200000 runs, a page field being three, a table's cell one and each line ending in a text one more/)
  }, 120_000)

  // A cell's text is another path through the walk: 100,000 cells of 40 characters, every other a line feed, were 979 MB and 4.6 seconds.
  test("a line ending in a table's cell is a run more, counted with the cell", () => {
    const [cells, endings] = [1000, MAX_DOCX_RUNS / 1000 - 1]
    expect(cells * (1 + endings)).toBe(MAX_DOCX_RUNS)
    const cell = `${'a\n'.repeat(endings)}a`
    expect(() => renderDocx(documentOf([table(cells - 1, cell)]))).not.toThrow()
    expect(refusalOf(documentOf([{ ...table(cells - 1, cell), header: [`\n${cell}`] }]))).toMatchObject({ code: 'content-too-large', subject: 'lines' })
  }, 120_000)

  // A carriage return and a line feed together end one line, and are one break of the file: counted as two, a text from Windows would
  // be refused at half the lines it may hold.
  test('a carriage return and a line feed together are one line ending, and each alone is one', () => {
    const lines = (ending: string, endings: number): Paragraph => ofRuns([{ text: `${`a${ending}`.repeat(endings)}a` }])
    for (const ending of ['\r\n', '\r', '\n']) {
      expect(() => renderDocx(documentOf([lines(ending, MAX_DOCX_RUNS - 1)]))).not.toThrow()
      expect(refusalOf(documentOf([lines(ending, MAX_DOCX_RUNS)]))).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
    }
  }, 120_000)

  // A cell is a run of its own, so a table at the paragraphs' bound is within the runs': the bound on runs is not a lower bound on cells.
  test("is counted across a table's cells and the paragraphs beside it, a cell being one", () => {
    // Its header and its rows, one paragraph short of the bound, which the paragraph beside it reaches.
    const cells = MAX_DOCX_PARAGRAPHS - 1
    const lines = table(cells - 1, 'c')
    expect(() => renderDocx(documentOf([lines, ofRuns(letters(MAX_DOCX_RUNS - cells))]))).not.toThrow()
    expect(refusalOf(documentOf([lines, ofRuns(letters(MAX_DOCX_RUNS - cells + 1))]))).toMatchObject({
      code: 'content-too-large',
      subject: 'body[1]',
    })
  }, 120_000)
})

describe('the pictures of a file', () => {
  const image = (asset: ImageAsset): Image => ({ kind: 'image', asset, width: 10, height: 10, fit: 'contain' })
  const PIXEL = encodePng(1, 1, () => [0, 0, 0])
  /** So many assets, each one of its own: the same bytes under another name are another asset, and another part of the file. */
  const assets = (length: number): ImageAsset[] => Array.from({ length }, (_, index) => ({ id: `picture-${index + 1}`, mediaType: 'image/png', bytes: PIXEL }))

  // Each asset is an entry of the zip, and a zip's directory counts its entries in sixteen bits: fflate writes a count past them modulo
  // 65,536 with nothing said, and 65,600 pictures were a file whose directory stated 72 entries, which no reader opens. The bound stands
  // far under that count, and a file at it is read back whole, every picture a part and a relationship.
  test('at the bound are written, each a part of the file, which is read back whole', () => {
    const docx = written(documentOf(assets(MAX_DOCX_PICTURES).map(image)))
    expect([...docx.parts.keys()].filter((name) => name.startsWith('word/media/'))).toHaveLength(MAX_DOCX_PICTURES)
    expect(docx.relationships('word/document.xml').filter(({ target }) => target.startsWith('word/media/'))).toHaveLength(MAX_DOCX_PICTURES)
  }, 120_000)

  // Refused, never written with the pictures past the bound left out, and by the asset that crossed it.
  test('one past the bound is refused, naming the asset that crossed it', () => {
    const refusal = refusalOf(documentOf(assets(MAX_DOCX_PICTURES + 1).map(image)))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: `picture-${MAX_DOCX_PICTURES + 1}` })
    expect(refusal.message).toMatch(/holds more than 1024 pictures/)
  })

  // The count is of assets, as the parts are: a logo drawn on every line of a long report is one picture.
  test('are counted by their assets, one drawn past the bound in number being one', () => {
    const [logo] = assets(1)
    const drawn = Array.from({ length: MAX_DOCX_PICTURES + 1 }, () => image(logo!))
    expect(() => renderDocx(documentOf(drawn))).not.toThrow()
  }, 120_000)
})

describe("the bytes of a file's pictures", () => {
  /** A PNG of one grey pixel, padded with a text chunk to exactly `length` bytes; `mark` tells one such picture from another. */
  function padded(id: string, length: number, mark: number): ImageAsset {
    const header = new Uint8Array(13)
    new DataView(header.buffer).setUint32(0, 1)
    new DataView(header.buffer).setUint32(4, 1)
    header.set([8, 0, 0, 0, 0], 8)
    const data = new Uint8Array(deflateSync(new Uint8Array([0, mark])))
    // The signature, and twelve bytes of framing a chunk, around the header, the text, the image data and the end.
    const text = new Uint8Array(length - 8 - 4 * 12 - header.length - data.length).fill(0x78)
    text.set(new TextEncoder().encode('Comment\0'))
    return {
      id,
      mediaType: 'image/png',
      bytes: pngOf([
        ['IHDR', header],
        ['tEXt', text],
        ['IDAT', data],
        ['IEND', new Uint8Array(0)],
      ]),
    }
  }
  const image = (asset: ImageAsset): Image => ({ kind: 'image', asset, width: 10, height: 10, fit: 'contain' })
  const [first, second] = [padded('first', MAX_ASSET_BYTES, 1), padded('second', MAX_ASSET_BYTES, 2)]

  // Two pictures of the largest an asset may be: what the PDF renderer's own bound counts.
  test('at the bound are written, each a part of its very bytes, drawn however often', () => {
    expect(first.bytes.length + second.bytes.length).toBe(MAX_DOCX_MEDIA_BYTES)
    const bytes = renderDocx(documentOf([image(first), image(second), image(first)]))
    const media = readZip(bytes).filter((entry) => entry.name.startsWith('word/media/'))
    expect(media.map((entry) => entry.bytes.length)).toEqual([MAX_ASSET_BYTES, MAX_ASSET_BYTES])
    expect(Buffer.from(media[1]!.bytes).equals(Buffer.from(second.bytes))).toBe(true)
  }, 120_000)

  // A picture's bytes are stored as they are, so the file is as large as they are together: refused past the bound by the picture that crossed it.
  test('a byte past the bound are refused, naming the picture that crossed it', () => {
    const refusal = refusalOf(documentOf([image(first), image(second), image(padded('third', 100, 3))]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'third' })
    expect(refusal.message).toMatch(/the pictures up to third hold 41943140 bytes; a Word file may hold 41943040/)
  }, 120_000)
})

describe("the image data of a file's pictures", () => {
  const image = (asset: ImageAsset): Image => ({ kind: 'image', asset, width: 10, height: 10, fit: 'contain' })
  /** The largest PNG an asset may be: 4,096 pixels a side, sixteen bits of RGB with alpha, 134,221,824 bytes of scanlines in a file of some 130 KB. */
  const largest = (id: string): ImageAsset => blank(id, MAX_ASSET_SIDE, MAX_ASSET_SIDE)
  const [first, second] = [largest('first'), largest('second')]
  const MARK: ImageAsset = { id: 'mark', mediaType: 'image/svg+xml', bytes: SVG_MARK }
  const JPEG = IMAGE_KINDS.find((asset) => asset.mediaType === 'image/jpeg')!

  // The writer inflates every PNG it embeds, to refuse what is none, and a PNG's file says little of what it inflates to: 321 of the
  // largest, all of one colour, were within the bound on the pictures' bytes and on their count, and each was inflated in full, eight of
  // them in 5.4 seconds. Two is what the PDF renderer holds a render to, and what is held here: at it, both are written.
  test('at the bound is written, an SVG beside it holding none', () => {
    expect(2 * MAX_ASSET_SIDE * (1 + MAX_ASSET_SIDE * 8)).toBe(MAX_DOCX_IMAGE_DATA)
    const docx = written(documentOf([image(first), image(MARK), image(second), image(first)]))
    expect([...docx.parts.keys()].filter((name) => /^word\/media\/image\d+\.png$/.test(name))).toHaveLength(3)
  }, 120_000)

  // Refused by the picture that crossed it, as the renderer refuses it: a PNG of one pixel is two bytes of scanline.
  test('two bytes past the bound is refused, naming the picture that crossed it', () => {
    const refusal = refusalOf(documentOf([image(first), image(second), image(blank('pixel', 1, 1, 'grey'))]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'pixel' })
    expect(refusal.message).toMatch(/the pictures up to pixel hold 268443650 bytes of image data.* a Word file may hold 268443648/)
  }, 120_000)

  // A JPEG is stored as it is and inflates to nothing: its bytes are counted, since the PDF renderer counts them, and a document it
  // refuses for its image data should not be one the writer writes.
  test("counts a JPEG's bytes as they are", () => {
    expect(refusalOf(documentOf([image(first), image(second), image(JPEG)]))).toMatchObject({ code: 'content-too-large', subject: JPEG.id })
  }, 120_000)

  // The count is taken from a PNG's header, before its data is inflated, or it would bound nothing: the third picture here promises the
  // largest and its data is no stream at all, which is found only by inflating it. Refused for its size, it was never inflated. The PDF
  // renderer inflates first and refuses this one as no picture: the one document the two refuse otherwise.
  test('is counted before a PNG is inflated: one past the bound whose data is no stream is refused for its size', () => {
    const third = blank('third', MAX_ASSET_SIDE, MAX_ASSET_SIDE, 'deep', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))
    // Alone it is no picture, by the data that does not inflate.
    expect(refusalOf(documentOf([image(third)]))).toMatchObject({ code: 'invalid-asset', subject: 'third' })
    expect(refusalOf(documentOf([image(first), image(second), image(third)]))).toMatchObject({ code: 'content-too-large', subject: 'third' })
  }, 120_000)
})
