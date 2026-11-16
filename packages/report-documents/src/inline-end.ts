import { isRegular, isWhite } from './bytes.js'

/**
 * Internal: the release of PDF.js whose ends of inline images the reader
 * mirrors, read from its legacy/build/pdf.worker.mjs -- the one the corpus
 * proves pages with and the Studio previews in: `findDefaultInlineStreamEnd`'s
 * search, its text and operator tests and its operator map (here), and the
 * byte `inlineStreamSkipEI` passes over after a marker's `EI`
 * (inline-images.ts, `ended`). scripts/mirrored-pdfjs.test.mjs fails when
 * the pdfjs-dist the corpus or the Studio pins is another; it reads this
 * module, which imports bytes.ts alone, so that the guard loads nothing of
 * pdf-lib's or pako's.
 */
export const MIRRORED_PDFJS = '6.4.299'

/**
 * Where PDF.js 6.4.299 (`MIRRORED_PDFJS`) -- the viewer the corpus pins, and the Studio's --
 * ends an inline image whose data it finds the end of by searching:
 * unfiltered and Flate (`Parser.findDefaultInlineStreamEnd`,
 * pdf.worker.mjs:16875). It takes an `EI` followed by SPACE, LF or CR as
 * the end only where the 15 bytes after that look like text, and where,
 * within the 75 after it, its lexer finds an operator it knows after as
 * many operands as the operator takes, before anything it does not know;
 * anywhere else it searches on, and reads what follows as image data. The
 * reader takes its own `EI` only where PDF.js would, by the same tests,
 * read conservatively: a token the reader does not read as PDF.js would
 * fails the test, and so does a byte PDF.js's text test refuses anywhere
 * up to the operator it accepts.
 */

/**
 * ISO 32000-1 Annex A's operators, each with the operands PDF.js holds it
 * to (`EvaluatorPreprocessor.opMap`, pdf.worker.mjs:43421): exactly that
 * many, or, for one that takes a varying number, at most that many. A
 * Map, not an object's keys: /constructor would find what an object's
 * prototype holds.
 */
type Arity = readonly [operands: number, varying: boolean]

/** Each of `operators` with the operands it takes. */
const taking = (operands: number, varying: boolean, operators: readonly string[]): (readonly [string, Arity])[] =>
  operators.map((operator) => [operator, [operands, varying]])

const OPERATORS: ReadonlyMap<string, Arity> = new Map([
  ...taking(0, false, ['q', 'Q', 'h', 'S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'n', 'W', 'W*', 'BT', 'ET', 'T*', 'BI', 'ID', 'EMC', 'BX', 'EX']),
  ...taking(1, false, [
    'w',
    'J',
    'j',
    'M',
    'ri',
    'i',
    'gs',
    'Tc',
    'Tw',
    'Tz',
    'TL',
    'Tr',
    'Ts',
    'Tj',
    'TJ',
    "'",
    'CS',
    'cs',
    'G',
    'g',
    'sh',
    'EI',
    'Do',
    'MP',
    'BMC',
  ]),
  ...taking(2, false, ['d', 'm', 'l', 'Tf', 'Td', 'TD', 'd0', 'DP', 'BDC']),
  ...taking(3, false, ['RG', 'rg', '"']),
  ...taking(4, false, ['v', 'y', 're', 'K', 'k']),
  ...taking(6, false, ['cm', 'c', 'Tm', 'd1']),
  ...taking(4, true, ['SC', 'sc']),
  ...taking(33, true, ['SCN', 'scn']),
])

/** The bytes PDF.js looks at after a candidate: 15 for text, 75 for an operator. */
const TEXT = 15
const LOOKED_AT = 75

const NUL = 0x00
const LF = 0x0a
const CR = 0x0d
const SPACE = 0x20
const DEL = 0x7f
const PERCENT = 0x25
const LEFT = 0x28
const RIGHT = 0x29
const BACKSLASH = 0x5c
const SLASH = 0x2f
const LESS = 0x3c
const GREATER = 0x3e

/** A number as PDF.js's `getNumber` reads a whole run as one: a sign, digits, and a point among or before them. */
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/

/** Whether PDF.js's text test admits the byte at `at` of `window` (pdf.worker.mjs:16903): a NUL not followed by another, an LF, a CR, or a byte from SPACE to DEL. */
function text(window: Uint8Array, at: number): boolean {
  const byte = window[at] as number
  if (byte === NUL) return window[at + 1] !== NUL
  return byte === LF || byte === CR || (byte >= SPACE && byte <= DEL)
}

/** Past white space and comments from `at`, as PDF.js's lexer passes them. */
function pastSpace(window: Uint8Array, at: number): number {
  let end = at
  while (end < window.length) {
    const byte = window[end]
    if (byte === PERCENT) while (end < window.length && window[end] !== LF && window[end] !== CR) end += 1
    else if (isWhite(byte)) end += 1
    else break
  }
  return end
}

/** Past the literal string that begins at `at`, or -1 where it does not end in `window`. */
function pastString(window: Uint8Array, at: number): number {
  let depth = 0
  for (let end = at; end < window.length; end += 1) {
    const byte = window[end]
    if (byte === BACKSLASH) end += 1
    else if (byte === LEFT) depth += 1
    else if (byte === RIGHT && (depth -= 1) === 0) return end + 1
  }
  return -1
}

/** Past the hexadecimal string that begins at `at`, or -1 where it does not end in `window`. */
function pastHex(window: Uint8Array, at: number): number {
  const close = window.indexOf(GREATER, at + 1)
  return close < 0 ? -1 : close + 1
}

/** Past the run of regular bytes from `at`. */
function pastRun(window: Uint8Array, at: number): number {
  let end = at
  while (end < window.length && isRegular(window[end])) end += 1
  return end
}

/** The words PDF.js's lexer reads as values, not operators. */
const VALUES: ReadonlySet<string> = new Set(['true', 'false', 'null'])

/**
 * Where an operator PDF.js accepts ends in `window`, the bytes after a
 * candidate's white space, or -1. Operands are numbers, names, strings,
 * hexadecimal strings, true, false and null; an operator is a run that is
 * one of Annex A's as a whole, accepted after as many operands as it
 * takes, and counted from none again after any other number. Anything
 * else -- an array, a dictionary, a run PDF.js would split or not know, a
 * string the window cuts, the window's end -- is no operator PDF.js
 * accepts, as its lexer reads the window as all there is.
 */
function acceptedOperator(window: Uint8Array): number {
  let operands = 0
  let at = pastSpace(window, 0)
  while (at < window.length) {
    const byte = window[at]
    let end = -1
    if (byte === LEFT) end = pastString(window, at)
    else if (byte === LESS && window[at + 1] !== LESS) end = pastHex(window, at)
    else if (byte === SLASH) end = pastRun(window, at + 1)
    else if (isRegular(byte)) end = pastRun(window, at)
    if (end < 0) return -1
    const word = isRegular(byte) ? String.fromCharCode(...window.subarray(at, end)) : undefined
    if (word === undefined || NUMBER.test(word) || VALUES.has(word)) operands += 1
    else {
      const operator = OPERATORS.get(word)
      if (operator === undefined) return -1
      const [takes, varying] = operator
      if (varying ? operands <= takes : operands === takes) return end
      operands = 0
    }
    at = pastSpace(window, end)
  }
  return -1
}

/**
 * Internal: whether PDF.js ends an unfiltered or Flate inline image at an
 * `EI` that stands at `at` in `content` -- followed by the end, or by SPACE,
 * LF or CR and then nothing, or by bytes its text test and its operator
 * test accept -- given that the data before it holds no candidate of its
 * own (inline-images.ts refuses one).
 */
export function viewerEndsAt(content: Uint8Array, at: number): boolean {
  const after = at + 2
  if (after >= content.length) return true
  const byte = content[after]
  if (byte !== SPACE && byte !== LF && byte !== CR) return false
  const window = content.subarray(after + 1, after + 1 + LOOKED_AT)
  if (window.length === 0) return true
  const end = acceptedOperator(window)
  if (end < 0) return false
  for (let i = 0; i < Math.min(window.length, Math.max(TEXT, end)); i += 1) if (!text(window, i)) return false
  return true
}
