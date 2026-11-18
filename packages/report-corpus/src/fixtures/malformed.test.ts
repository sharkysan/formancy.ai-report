import { gunzipSync, inflateRawSync, inflateSync } from 'node:zlib'
import { imageHeader } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import type { Image } from '../document.js'
import { MALFORMED } from './malformed.js'

/**
 * The PNGs of the malformed documents whose image data is no stream
 * (0068), each held to being wrong in the one way its title says. Both
 * engines are held to refusing every one alike, and a refusal proves
 * little of a fixture that is wrong by a slip as well: a stored block
 * mistyped, a checksum of other bytes. So each is a whole PNG but for its
 * image data, zlib refuses that data for the reason the fixture is here
 * for, and where the reason is one a decompressor more lenient than zlib
 * reads past, the data is the scanlines once that one thing is put right.
 */

/** The image data of the malformed document `id`, once its PNG's chunks, header and all, have passed. */
function dataOf(id: string): Uint8Array {
  const { document } = MALFORMED.find((each) => each.id === id)!
  const header = imageHeader((document.body[0] as Image).asset.bytes)
  if (!header.ok || header.mediaType !== 'image/png') throw new Error(`${id} is no whole PNG: ${header.ok ? 'a JPEG' : header.message}`)
  return header.data
}

/** What zlib says of `data` as a zlib stream: its error, or the bytes it inflates to and how many of `data` it read. */
function inflated(data: Uint8Array): string | { readonly bytes: number[]; readonly read: number } {
  try {
    const { buffer, engine } = inflateSync(data, { info: true }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } }
    return { bytes: [...buffer], read: engine.bytesWritten }
  } catch (error) {
    return (error as Error).message
  }
}

/** The scanlines the pictures promise: four lines of a filter byte and four pixels, all nothing. */
const SCANLINES = new Array<number>(20).fill(0)

describe('a PNG whose image data is no stream of its scanlines', () => {
  // The four a decompressor that compares no checksum and reads past no end would inflate to the scanlines.
  test('is wrong by its checksum, by what follows its stream, or by a stream that never ends', () => {
    expect(inflated(dataOf('image-png-checksum'))).toBe('incorrect data check')
    // zlib's one-shot inflate stops where the stream ends, as the platform's streaming decompressor does not: the bytes after it are what it left.
    const [trailed, resummed] = [dataOf('image-png-bytes-after'), dataOf('image-png-bytes-after-summed')]
    expect(inflated(trailed)).toEqual({ bytes: SCANLINES, read: trailed.length - 8 })
    expect(inflated(resummed)).toEqual({ bytes: SCANLINES, read: resummed.length - 8 })
    expect(inflated(dataOf('image-png-cut-short'))).toBe('unexpected end of file')
  })

  // A stored block is its length and that length's complement: a reader that takes the length alone finds the scanlines and their checksum.
  test('is a stored block wrong in the complement of its length alone', () => {
    const data = dataOf('image-png-stored-lengths')
    expect(inflated(data)).toBe('invalid stored block lengths')
    const right = Uint8Array.from(data)
    right.set([0xeb, 0xff], 5)
    expect(inflated(right)).toEqual({ bytes: SCANLINES, read: data.length })
  })

  // Deflate's fixed codes reach 287 and its lengths stop at 285: a reader that takes 286 for a length finds a line of nothing and its checksum.
  test('is a block of the fixed codes wrong in one length code alone', () => {
    const data = dataOf('image-png-length-code')
    expect(inflated(data)).toBe('invalid literal/length code')
    // The same block with the last length code deflate defines, 285, three bits further: a byte of nothing and 258 copies of it.
    const block = Uint8Array.from(data.subarray(2, -4))
    expect([...block]).toEqual([0x63, 0x18, 0x03, 0x00])
    block[2] = 0x05
    expect([...inflateRawSync(block)]).toEqual(new Array<number>(259).fill(0))
    // What the picture promises is what a length of 260 would make of it: one line, a filter byte and 260 pixels.
    const header = imageHeader((MALFORMED.find((each) => each.id === 'image-png-length-code')!.document.body[0] as Image).asset.bytes)
    expect(header).toMatchObject({ ok: true, width: 260, height: 1, bitsPerPixel: 8 })
    expect([...data.subarray(-4)]).toEqual([0x01, 0x05, 0x00, 0x01])
  })

  // The scanlines in a gzip member, whole: no zlib stream, and one a decompressor that reads the wrapper off the data inflates.
  test('is a gzip member, whole, where a zlib stream belongs', () => {
    const data = dataOf('image-png-gzip')
    expect(inflated(data)).toBe('incorrect header check')
    expect([...gunzipSync(data)]).toEqual(SCANLINES)
  })
})
