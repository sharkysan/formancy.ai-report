import { utf8Length } from '@formancy/report-spec'
import { encode } from 'uqr'
import { RenderRefusal, type QrCode } from './document.js'

/**
 * A QR code's symbol (ISO/IEC 18004), and what refuses one: decided here
 * once, below every engine, so that the PDF renderer and the Word writer
 * draw one symbol of a code and refuse the same codes in the same words
 * (0074). An engine draws the symbol it is handed, and decides nothing of
 * it.
 *
 * uqr encodes the text as UTF-8 in byte mode -- or as digits or
 * upper-case alphanumerics, when that is all it holds -- in the smallest
 * version that holds it at the level asked, and never raises the level to
 * fill a version. An engine encodes a code once, when it checks the
 * document, and draws that symbol, so that what is refused and what is
 * drawn are one decision (0020).
 *
 * The square a code stands in is its `size`, its quiet zone inside it:
 * four modules on every side, white, the symbol between them, so a
 * module is the size over the symbol's modules and eight.
 */

/** ISO/IEC 18004's quiet zone: four modules of white on every side of the symbol. */
export const QR_QUIET_ZONE = 4

/**
 * The smallest module drawn: 0.4 mm, 1.13 pt. ISO/IEC 18004 leaves the
 * module's size to the application; SIX's Swiss Implementation Guidelines
 * for the QR-bill, version 2.3, section 6.3, require at least 0.4 mm when
 * printing, and that is taken here as what a printer prints and a phone's
 * camera reads reliably. A square too small for its text at that module is
 * refused, naming the size it needs, never drawn finer. It is a borrowed
 * minimum: the same guidelines draw their largest code finer (0020).
 */
export const QR_MIN_MODULE = (0.4 * 72) / 25.4

/**
 * The most characters any QR code holds: 7089 digits, version 40 at level
 * L (ISO/IEC 18004, table 7). A character is a code point, as a reader
 * counts one: an emoji is one, though JavaScript holds it in two code
 * units. Longer text fits no version in any mode, and is refused before it
 * is encoded, which takes time and memory with the length of the text;
 * within it, the encoder decides by the bytes the text takes.
 */
export const QR_MAX_CHARACTERS = 7089

const LEVELS: ReadonlySet<unknown> = new Set(['L', 'M', 'Q', 'H'])

/** A code's symbol, without its quiet zone: rows of modules, `true` for dark, as many rows as modules in each. */
export interface QrSymbol {
  readonly modules: readonly (readonly boolean[])[]
}

/** The version `symbol` is, from its modules a side (ISO/IEC 18004: 4 a version and 17). */
export function qrSymbolVersion(symbol: QrSymbol): number {
  return (symbol.modules.length - 17) / 4
}

/** A code point as Unicode writes it: U+5C71. */
const codePoint = (point: number): string => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`

/** The lone half of a surrogate pair `text` holds, as a refusal names it, or undefined: with the u flag, a pair is one character and only a lone half is a surrogate. */
export function loneSurrogate(text: string): string | undefined {
  const lone = /\p{Cs}/u.exec(text)?.[0]
  return lone === undefined ? undefined : codePoint(lone.charCodeAt(0))
}

/** How many code points `text` holds, counted without building them into an array. */
function codePoints(text: string): number {
  let count = 0
  for (const _ of text) count++
  return count
}

/**
 * Refuses a code's square that is no size, as `unsupported`, or wider
 * than the `width` it stands at, as `content-too-large`: a code is a
 * square that stands where an image may. How tall a page's body is, is an
 * engine's to know, and to refuse a square by.
 */
export function refuseSquare(what: string, id: string, size: number, width: number): void {
  if (!(size > 0 && Number.isFinite(size))) throw new RenderRefusal('unsupported', `${what} is drawn ${size} pt a side`, id)
  if (size > width) throw new RenderRefusal('content-too-large', `${what} is ${size} pt wide; it stands ${width.toFixed(2)} pt wide`, id)
}

/**
 * `code`'s symbol where it stands `width` points wide, or the refusal
 * that says why it is not drawn: a square of no size, a level or text no
 * encoder can draw, as `unsupported`; a square wider than where it
 * stands, text no version holds, or a square too small for the version
 * that holds it, as `content-too-large`. Each names the code by its id.
 */
export function qrSymbol(code: QrCode, width: number): QrSymbol {
  const { id, text, size, errorCorrection } = code
  refuseSquare(`the QR code ${id}`, id, size, width)
  if (!LEVELS.has(errorCorrection))
    throw new RenderRefusal(
      'unsupported',
      `the QR code ${id} asks for the error correction level '${String(errorCorrection)}'; the levels are L, M, Q and H`,
      id,
    )
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `the QR code ${id} encodes something that is not text`, id)
  const lone = loneSurrogate(text)
  if (lone !== undefined)
    throw new RenderRefusal('unsupported', `the QR code ${id} holds ${lone}, half of a surrogate pair without the other, which has no UTF-8`, id)
  // No text has more code points than code units, so they are counted only past the cap.
  const characters = text.length > QR_MAX_CHARACTERS ? codePoints(text) : text.length
  if (characters > QR_MAX_CHARACTERS)
    throw new RenderRefusal('content-too-large', `the QR code ${id} holds ${characters} characters; no QR code holds more than ${QR_MAX_CHARACTERS}`, id)
  const modules = encoded(text, errorCorrection, id)
  refuseFineModules({ modules }, size, `the QR code ${id}`, 'its text', id)
  return { modules }
}

/**
 * Refuses `symbol` drawn in a square of `size` with its quiet zone when its
 * modules would be finer than 0.4 mm, naming the square `holds` needs:
 * the floor every code drawn with a quiet zone is held to (0020).
 */
export function refuseFineModules(symbol: QrSymbol, size: number, what: string, holds: string, id: string): void {
  const count = symbol.modules.length + 2 * QR_QUIET_ZONE
  const smallest = count * QR_MIN_MODULE
  if (size < smallest) {
    throw new RenderRefusal(
      'content-too-large',
      `${what} is ${size} pt a side, which makes the ${count} modules across its symbol and quiet zone ${(size / count).toFixed(2)} pt each; the smallest module is 0.4 mm (${QR_MIN_MODULE.toFixed(2)} pt), so ${holds} needs a square of at least ${(Math.ceil(smallest * 100) / 100).toFixed(2)} pt`,
      id,
    )
  }
}

/** Whether `error` is what uqr 0.1.3 says of text no version holds, and says of nothing else. */
export function tooLong(error: unknown): boolean {
  return error instanceof RangeError && error.message === 'Data too long'
}

/** The symbol uqr encodes, without its quiet zone; refused when no version holds the text. */
function encoded(text: string, level: QrCode['errorCorrection'], id: string): boolean[][] {
  try {
    return encode(text, { ecc: level, border: 0, boostEcc: false }).data
  } catch (error) {
    if (!tooLong(error)) throw error
    throw new RenderRefusal('content-too-large', `the QR code ${id} holds ${utf8Length(text)} bytes of text, more than a QR code at level ${level} holds`, id)
  }
}

/**
 * The most characters a Swiss QR Code holds, its line feeds included: 997
 * (IG 6.2), which is what version 25 holds at level M in byte mode. A
 * payload of more is refused before it is encoded.
 */
export const SWISS_QR_MAX_CHARACTERS = 997

/** The largest version SIX allows (IG 6.2): 117 modules a side. */
const SWISS_MAX_VERSION = 25

/**
 * A QR-bill's Swiss QR Code (IG 6), or the refusal that says why it is not
 * drawn: its payload as UTF-8 at level M (6.1), in the smallest version that
 * holds it (6.4), and never past version 25 (6.2). A payload of more than
 * 997 characters is refused unencoded; one whose UTF-8 is more than version
 * 25 holds, once the encoder finds none does. Every refusal names the
 * payment part, and none quotes the payload: it holds names and accounts.
 *
 * SIX prints the code at 46 mm whatever its version, so a module is 46 mm
 * over the symbol's modules, 0.393 mm at version 25: finer than the 0.4 mm
 * a `qrCode` is held to, which is SIX's own figure for print (6.3). SIX's
 * size is drawn, not the floor (0020's generic minimum does not apply).
 */
export function swissSymbol(payload: unknown): QrSymbol {
  const refuse = (code: 'unsupported' | 'content-too-large', what: string): RenderRefusal =>
    new RenderRefusal(code, `the payment part's Swiss QR Code ${what}`, 'paymentPart')
  if (typeof payload !== 'string') throw refuse('unsupported', 'holds something that is not text')
  const lone = loneSurrogate(payload)
  if (lone !== undefined) throw refuse('unsupported', `holds ${lone}, half of a surrogate pair without the other, which has no UTF-8`)
  const characters = payload.length > SWISS_QR_MAX_CHARACTERS ? codePoints(payload) : payload.length
  if (characters > SWISS_QR_MAX_CHARACTERS) throw refuse('content-too-large', `holds ${characters} characters; SIX allows ${SWISS_QR_MAX_CHARACTERS}`)
  try {
    return { modules: encode(payload, { ecc: 'M', border: 0, boostEcc: false, maxVersion: SWISS_MAX_VERSION }).data }
  } catch (error) {
    if (!tooLong(error)) throw error
    throw refuse(
      'content-too-large',
      `holds ${utf8Length(payload)} bytes, more than version ${SWISS_MAX_VERSION} holds at level M, the largest code SIX allows`,
    )
  }
}
