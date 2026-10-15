import { crc32 as nodeCrc32, deflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { base64, crc32, fromBase64, inflate } from './bytes.js'

/**
 * The byte arithmetic written for both entries, held to Node's own, which
 * the browser entry cannot use: a wrong CRC refuses every PNG, a wrong
 * base64 embeds every image broken.
 */

/** Bytes of every value, in an order that is not their own, and of every length up to `length`. */
function samples(length: number): Uint8Array[] {
  const bytes = Uint8Array.from({ length }, (_, index) => (index * 151 + 7) % 256)
  return Array.from({ length: length + 1 }, (_, end) => bytes.subarray(0, end))
}

describe('crc32', () => {
  test('is zlib’s, for every length up to 300 bytes', () => {
    for (const sample of samples(300)) expect(crc32(sample)).toBe(nodeCrc32(sample))
  })
})

describe('base64', () => {
  // Every remainder of the length by three, which decides the padding.
  test('is Node’s, for every length up to 300 bytes', () => {
    for (const sample of samples(300)) expect(base64(sample)).toBe(Buffer.from(sample).toString('base64'))
  })
})

describe('fromBase64', () => {
  // The browser entry reads the fonts it holds text to from pdfmake's
  // virtual files, which are base64: a wrong decoder would hold text to
  // another font's characters.
  test('is Node’s, for every length up to 300 bytes, and refuses what is not base64', () => {
    for (const sample of samples(300)) expect([...fromBase64(Buffer.from(sample).toString('base64'))]).toEqual([...sample])
    expect([...fromBase64('aGVs\nbG8=')]).toEqual([...Buffer.from('hello')])
    expect(() => fromBase64('a$b=')).toThrow('not base64')
  })
})

describe('inflate', () => {
  const data = new Uint8Array(deflateSync(Buffer.alloc(100_000, 0x2a)))
  const fresh = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes)

  // Every byte, in order, at the offset it has in the whole.
  test('hands over every byte it inflates, each at its offset', async () => {
    const out = new Uint8Array(100_000)
    expect(await inflate(fresh(data), 100_000, (chunk, offset) => out.set(chunk, offset))).toEqual({ kind: 'done', length: 100_000 })
    expect(out.every((byte) => byte === 0x2a)).toBe(true)
  })

  // A limit it reads past is no limit: a PNG of a few kilobytes that inflates
  // to gigabytes would be inflated whole before anything was refused.
  test('stops once more than its limit has come out, without handing it over', async () => {
    let handed = 0
    expect(await inflate(fresh(data), 99_999, (chunk) => (handed += chunk.length))).toEqual({ kind: 'too-long' })
    expect(handed).toBeLessThanOrEqual(99_999)
  })

  test.each([
    ['data that is not deflated', new Uint8Array(32).fill(7)],
    ['a stream cut short', data.subarray(0, data.length - 4)],
    ['nothing at all', new Uint8Array(0)],
  ])('refuses %s as invalid', async (_, bytes) => {
    expect(await inflate(fresh(bytes), 100_000, () => {})).toEqual({ kind: 'invalid' })
  })
})
