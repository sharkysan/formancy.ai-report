/**
 * Byte arithmetic the renderer needs in Node and in a browser alike, written
 * on the standard library alone: neither `Buffer` nor `node:zlib` exists in a
 * browser, and the browser entry shares every line of this package but its
 * font loading (`browser.ts`).
 */

/** CRC-32 as PNG and zlib compute it: the reflected polynomial 0xedb88320, every bit inverted before and after. */
const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, byte) => {
  let crc = byte
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard base64 with padding, as a `data:` URL carries bytes. */
export function base64(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[offset], bytes[offset + 1], bytes[offset + 2]]
    const left = bytes.length - offset
    parts.push(
      BASE64[a >> 2]! +
        BASE64[((a & 3) << 4) | (b >> 4)]! +
        (left > 1 ? BASE64[((b & 15) << 2) | (c >> 6)]! : '=') +
        (left > 2 ? BASE64[c & 63]! : '='),
    )
  }
  return parts.join('')
}

/** The bytes standard base64 with padding spells, as pdfmake's virtual files hold fonts; whitespace ignored, anything else not base64 refused. */
export function fromBase64(text: string): Uint8Array {
  const digits = text.replace(/\s+/g, '').replace(/=+$/, '')
  const bytes = new Uint8Array(Math.floor((digits.length * 3) / 4))
  let bits = 0
  let held = 0
  let at = 0
  for (const digit of digits) {
    const value = BASE64.indexOf(digit)
    if (value === -1) throw new Error('not base64')
    bits = (bits << 6) | value
    held += 6
    if (held >= 8) {
      held -= 8
      bytes[at++] = (bits >> held) & 0xff
    }
  }
  return bytes
}

/** What inflating gave: every chunk in order, or why it stopped. */
export type Inflated = { readonly kind: 'done'; readonly length: number } | { readonly kind: 'too-long' } | { readonly kind: 'invalid' }

/**
 * Inflates zlib-wrapped `data` -- a PNG's image data -- with the platform's
 * own `DecompressionStream`, handing each chunk to `each` as it arrives and
 * stopping, without reading further, once more than `limit` bytes have come
 * out: the limit is what the image's header promises, so a PNG whose data
 * inflates to gigabytes costs no more than one that keeps its promise.
 *
 * Data that is not a whole zlib stream is `invalid`, and so is data with
 * bytes after the stream's end, which Node's `inflateSync` would ignore and
 * the Compression Streams standard refuses: refusing them costs a PNG some
 * decoder would have drawn, and keeps Node and a browser in agreement.
 */
export async function inflate(data: Uint8Array<ArrayBuffer>, limit: number, each: (chunk: Uint8Array, offset: number) => void): Promise<Inflated> {
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return { kind: 'done', length }
      if (length + value.length > limit) {
        await reader.cancel()
        return { kind: 'too-long' }
      }
      each(value, length)
      length += value.length
    }
  } catch {
    return { kind: 'invalid' }
  }
}
