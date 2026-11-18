import { deflateSync } from 'node:zlib'
import { encodePng, pngOf, readZip } from '@formancy/report-corpus'
import { MAX_ASSET_BYTES } from '@formancy/report-runtime'
import type { Block, Image, ImageAsset, Paragraph, Table } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_MEDIA_BYTES, MAX_DOCX_PARAGRAPHS, MAX_DOCX_PICTURES, MAX_DOCX_RUNS } from './limits.js'
import { renderDocx } from './render.js'
import { keptRows, type StyledRow } from './rows.js'
import { documentOf, paragraph, refusalOf, written } from './testing/support.js'

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

  // The count is of every block that is a paragraph of the file, wherever it stands: a bound that counted cells alone would be passed by paragraphs.
  test('is counted across the page regions and the body, a spacer and a picture a paragraph each', () => {
    const blocks: Block[] = Array.from({ length: MAX_DOCX_PARAGRAPHS / 2 }, () => ({ kind: 'spacer', height: 1 }))
    const one = documentOf([...blocks, ...blocks])
    expect(() => renderDocx(one)).not.toThrow()
    expect(refusalOf({ ...one, pageHeader: [paragraph('one more')] })).toMatchObject({ code: 'content-too-large', subject: `body[${MAX_DOCX_PARAGRAPHS - 1}]` })
  }, 120_000)

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
