import { deflateSync } from 'node:zlib'
import { pngOf, readZip } from '@formancy/report-corpus'
import { MAX_ASSET_BYTES } from '@formancy/report-runtime'
import type { Block, Image, ImageAsset, Table } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_MEDIA_BYTES, MAX_DOCX_PARAGRAPHS } from './limits.js'
import { renderDocx } from './render.js'
import { documentOf, paragraph, refusalOf } from './testing/support.js'

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

  test('a character past the bound is refused, naming the paragraph that crossed it', () => {
    const refusal = refusalOf(documentOf([paragraph('first'), paragraph('a'.repeat(MAX_DOCX_CHARACTERS - 4))]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'body[1]' })
    expect(refusal.message).toMatch(/more than 4000000 characters long/)
  })

  test('the characters at the bound in one paragraph are written', () => {
    const bytes = renderDocx(documentOf([paragraph('first'), paragraph('a'.repeat(MAX_DOCX_CHARACTERS - 5))]))
    expect(readZip(bytes).find((entry) => entry.name === 'word/document.xml')!.bytes.length).toBeGreaterThan(MAX_DOCX_CHARACTERS)
  }, 60_000)

  // A refusal for size comes before anything is built: the walk that counts is the walk that checks, and it stops where the count crosses.
  test('is refused without building anything of the document', () => {
    const rows = 4 * MAX_DOCX_PARAGRAPHS
    const started = performance.now()
    expect(refusalOf(documentOf([table(rows, 'a')])).code).toBe('content-too-large')
    // Building a file of the bound's paragraphs takes seconds; counting four times as many takes a fraction of one.
    expect(performance.now() - started).toBeLessThan(1500)
  })
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

  test('a byte past the bound are refused, naming the picture that crossed it', () => {
    const refusal = refusalOf(documentOf([image(first), image(second), image(padded('third', 100, 3))]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'third' })
    expect(refusal.message).toMatch(/the pictures up to third hold 41943140 bytes; a Word file may hold 41943040/)
  }, 120_000)
})
