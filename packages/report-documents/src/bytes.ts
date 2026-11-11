/**
 * A PDF's bytes as its syntax classes them (ISO 32000-1 7.2.2), and the
 * searches the reader runs over them. Written over `Uint8Array` alone, so
 * that the reader runs as it is in a browser, a worker and Node: no
 * `Buffer`, no `TextDecoder`.
 */

/** NUL, tab, line feed, form feed, carriage return and space. */
export const isWhite = (byte: number | undefined): boolean => byte === 0x00 || byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d || byte === 0x20

const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25])

/** `( ) < > [ ] { } / %`. */
export const isDelimiter = (byte: number | undefined): boolean => byte !== undefined && DELIMITERS.has(byte)

/** Neither white space nor a delimiter: a byte of a name, a number or a keyword. */
export const isRegular = (byte: number | undefined): boolean => byte !== undefined && !isWhite(byte) && !isDelimiter(byte)

export const isDigit = (byte: number | undefined): boolean => byte !== undefined && byte >= 0x30 && byte <= 0x39

/** A digit, a sign or a point: what pdf-lib's grammar reads a number from. */
export const isNumeric = (byte: number | undefined): boolean => isDigit(byte) || byte === 0x2b || byte === 0x2d || byte === 0x2e

/** A hexadecimal digit's value, either case, or -1. */
export function hexValue(byte: number | undefined): number {
  if (byte === undefined) return -1
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30
  if (byte >= 0x41 && byte <= 0x46) return byte - 0x37
  if (byte >= 0x61 && byte <= 0x66) return byte - 0x57
  return -1
}

/** A keyword's bytes, from ASCII text. */
export const keyword = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0))

/** Whether `word` stands at `at`, an offset from 0. */
export function startsAt(bytes: Uint8Array, word: readonly number[], at: number): boolean {
  if (at + word.length > bytes.length) return false
  for (let i = 0; i < word.length; i += 1) if (bytes[at + i] !== word[i]) return false
  return true
}

/** The first place at or after `from` where `word` stands, or -1. */
export function find(bytes: Uint8Array, word: readonly number[], from: number): number {
  for (let at = Math.max(0, from); at + word.length <= bytes.length; at += 1) if (startsAt(bytes, word, at)) return at
  return -1
}

/** The last place where `word` stands, or -1. */
export function findLast(bytes: Uint8Array, word: readonly number[]): number {
  for (let at = bytes.length - word.length; at >= 0; at -= 1) if (startsAt(bytes, word, at)) return at
  return -1
}
