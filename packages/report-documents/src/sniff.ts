/** The media type of a PDF document. */
export const PDF_MEDIA_TYPE = 'application/pdf'

const PERCENT = 0x25
const P = 0x50
const D = 0x44
const F = 0x46
const HYPHEN = 0x2d
const DOT = 0x2e
const ONE = 0x31
const TWO = 0x32
const ZERO = 0x30
const NINE = 0x39

/**
 * Whether the bytes begin as a PDF: `%PDF-1.` or `%PDF-2.` and a digit, at
 * the first byte. A viewer may find a header past junk and read the file; the
 * strict reader refuses it, so nothing earlier is skipped here.
 */
export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  if (bytes[0] !== PERCENT || bytes[1] !== P || bytes[2] !== D || bytes[3] !== F || bytes[4] !== HYPHEN) return false
  if (bytes[5] !== ONE && bytes[5] !== TWO) return false
  if (bytes[6] !== DOT) return false
  const digit = bytes[7] as number
  return digit >= ZERO && digit <= NINE
}
