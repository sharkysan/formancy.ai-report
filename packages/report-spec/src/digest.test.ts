import { describe, expect, test } from 'vitest'
import { assetDigest } from './digest.js'
import { utf8 } from './svg-test-support.js'
import { richReport } from './test-support.js'
import { validateReport } from './validate.js'

/**
 * An asset's digest as report-spec takes it, where a person adds an image
 * (0033): SHA-256 by @noble/hashes, written as the format writes a digest.
 * It is held to FIPS 180-2's own examples and to Web Crypto's SHA-256,
 * which a host that takes the digest itself would use. vitest runs these
 * under Node, whose global `crypto` is Web Crypto; report-spec's ES2023
 * library declares no such global, so the test names the one call it makes.
 */

const WEB_CRYPTO = (globalThis as unknown as { readonly crypto: { readonly subtle: { digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer> } } }).crypto.subtle

async function webCryptoDigest(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await WEB_CRYPTO.digest('SHA-256', bytes))
  return `sha256:${[...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** Bytes of every value, in an order that is not their own, `length` of them. */
const pattern = (length: number): Uint8Array => Uint8Array.from({ length }, (_, index) => (index * 151 + 7) % 256)

describe('assetDigest', () => {
  // FIPS 180-2's examples (appendix B.1 to B.3) and the empty message. A
  // digest that differed from them would differ from every host's, and
  // every image a person added would be refused as missing, its bytes kept
  // under one digest and asked for under another.
  test.each([
    ['the empty message', utf8(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['"abc"', utf8('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['the two-block message', utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['a million "a"', new Uint8Array(1_000_000).fill(0x61), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
  ])('is SHA-256 of %s, as FIPS 180-2 gives it', (_, bytes, hex) => {
    expect(assetDigest(bytes)).toBe(`sha256:${hex}`)
  })

  // Every length up to two blocks and a little over, where the padding
  // takes one block or two, and a mebibyte and one byte: a digest that was
  // right for short messages alone would differ from a host's for a logo.
  test("is Web Crypto's, for every length up to 130 bytes and a mebibyte", async () => {
    for (const length of [...Array.from({ length: 131 }, (_, index) => index), 1_048_577]) {
      const bytes = pattern(length)
      expect(assetDigest(bytes), `${length} bytes`).toBe(await webCryptoDigest(bytes))
    }
  })

  // A file's bytes often arrive as a view into a larger buffer. A digest of
  // the buffer behind it would name bytes the asset does not hold.
  test('is of the bytes a view holds, never the buffer behind it', () => {
    const buffer = pattern(64)
    expect(assetDigest(buffer.subarray(10, 20))).toBe(assetDigest(Uint8Array.from(buffer.subarray(10, 20))))
    expect(assetDigest(buffer.subarray(10, 20))).not.toBe(assetDigest(buffer))
  })

  // The digest is the format's: a report declaring an asset by it is one
  // the validator accepts. One written in upper case, or without its
  // algorithm, would be refused only once a host had kept the bytes.
  test('is a digest the validator accepts', () => {
    const report = richReport()
    const validation = validateReport({ ...report, assets: report.assets.map((asset) => ({ ...asset, digest: assetDigest(utf8('a logo')) })) })
    expect(validation.valid).toBe(true)
  })

  // A string is no file's bytes: digesting its text, in whatever encoding,
  // would give a digest no host's matches, so it is refused where it is
  // made rather than found missing at print.
  test('throws for anything but bytes', () => {
    expect(() => assetDigest('abc' as unknown as Uint8Array)).toThrow(TypeError)
    expect(() => assetDigest([0x61, 0x62, 0x63] as unknown as Uint8Array)).toThrow(TypeError)
  })
})
