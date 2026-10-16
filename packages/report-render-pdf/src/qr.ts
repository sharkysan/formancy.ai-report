import type { ContentSvg } from 'pdfmake/interfaces.js'
import { encode } from 'uqr'
import { RenderRefusal, type QrCode } from '@formancy/report-runtime'
import { codePoint } from './glyphs.js'

/**
 * A QR code (ISO/IEC 18004), encoded by uqr and drawn as vectors.
 *
 * The text is encoded once, when the document is checked (`check.ts`), and
 * the symbol that check returns is the one every pass draws, so what is
 * refused and what is drawn are one decision. uqr encodes the text as UTF-8
 * in byte mode -- or as digits or upper-case alphanumerics, when that is
 * all it holds -- in the smallest version that holds it at the level
 * asked, and never raises the level to fill a version.
 *
 * The square is the code's `size`, its quiet zone inside it: four modules
 * on every side, white, the symbol between them, so a module is the size
 * over the symbol's modules and eight. The white is drawn whole under the
 * code, so it scans on a tinted section, and the dark modules over it are
 * one path, filled once (`qrContent`).
 */

/** ISO/IEC 18004's quiet zone: four modules of white on every side of the symbol. */
export const QUIET_ZONE = 4

/**
 * The smallest module drawn: 0.4 mm, 1.13 pt. ISO/IEC 18004 leaves the
 * module's size to the application; SIX's Swiss Implementation Guidelines
 * for the QR-bill, version 2.3, section 6.3, require at least 0.4 mm when
 * printing, and that is taken here as what a printer prints and a phone's
 * camera reads reliably. A square too small for its text at that module is
 * refused, naming the size it needs, never drawn finer. It is a borrowed
 * minimum: the same guidelines draw their largest code finer (0020).
 */
export const MIN_MODULE = (0.4 * 72) / 25.4

/**
 * The most characters any QR code holds: 7089 digits, version 40 at level
 * L (ISO/IEC 18004, table 7). A character is a code point, as a reader
 * counts one: an emoji is one, though JavaScript holds it in two code
 * units. Longer text fits no version in any mode, and is refused before it
 * is encoded, which takes time and memory with the length of the text;
 * within it, the encoder decides by the bytes the text takes.
 */
export const MAX_CHARACTERS = 7089

const LEVELS: ReadonlySet<unknown> = new Set(['L', 'M', 'Q', 'H'])

/** A code's symbol, without its quiet zone: rows of modules, `true` for dark, as many rows as modules in each. */
export interface QrSymbol {
  readonly modules: readonly (readonly boolean[])[]
}

/** How many code points `text` holds, counted without building them into an array. */
function codePoints(text: string): number {
  let count = 0
  for (const _ of text) count++
  return count
}

/**
 * `code`'s symbol, or the refusal that says why it is not drawn: a level or
 * text no encoder can draw, as `unsupported`; text no version holds, or a
 * square too small for the version that holds it, as `content-too-large`.
 * Each names the code by its id. Its size is checked already.
 */
export function qrSymbol(code: QrCode): QrSymbol {
  const { id, text, size, errorCorrection } = code
  if (!LEVELS.has(errorCorrection)) throw new RenderRefusal('unsupported', `the QR code ${id} asks for the error correction level '${String(errorCorrection)}'; the levels are L, M, Q and H`, id)
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `the QR code ${id} encodes something that is not text`, id)
  // With the u flag, a surrogate pair is one character and only a lone half is a surrogate.
  const lone = /\p{Cs}/u.exec(text)?.[0]
  if (lone !== undefined) throw new RenderRefusal('unsupported', `the QR code ${id} holds ${codePoint(lone.charCodeAt(0))}, half of a surrogate pair without the other, which has no UTF-8`, id)
  // No text has more code points than code units, so they are counted only past the cap.
  const characters = text.length > MAX_CHARACTERS ? codePoints(text) : text.length
  if (characters > MAX_CHARACTERS) throw new RenderRefusal('content-too-large', `the QR code ${id} holds ${characters} characters; no QR code holds more than ${MAX_CHARACTERS}`, id)
  const modules = encoded(text, errorCorrection, id)
  const count = modules.length + 2 * QUIET_ZONE
  const smallest = count * MIN_MODULE
  if (size < smallest) {
    throw new RenderRefusal(
      'content-too-large',
      `the QR code ${id} is ${size} pt a side, which makes the ${count} modules across its symbol and quiet zone ${(size / count).toFixed(2)} pt each; the smallest module is 0.4 mm (${MIN_MODULE.toFixed(2)} pt), so its text needs a square of at least ${(Math.ceil(smallest * 100) / 100).toFixed(2)} pt`,
      id,
    )
  }
  return { modules }
}

/** The symbol uqr encodes, without its quiet zone; refused when no version holds the text, which uqr 0.1.3 says with this error and no other. */
function encoded(text: string, level: QrCode['errorCorrection'], id: string): boolean[][] {
  try {
    return encode(text, { ecc: level, border: 0, boostEcc: false }).data
  } catch (error) {
    if (!(error instanceof RangeError && error.message === 'Data too long')) throw error
    throw new RenderRefusal('content-too-large', `the QR code ${id} holds ${new TextEncoder().encode(text).length} bytes of text, more than a QR code at level ${level} holds`, id)
  }
}

/**
 * The code's square, exactly `size` points a side: white, and over it its
 * dark modules in black, one path filled once, each run of them in a row a
 * rectangle of it. Drawn in modules, the square's own units, and scaled to
 * `size`.
 *
 * Filled once, because a run filled on its own is blended into the page on
 * its own: where two rows meet inside a pixel, each covers part of it, and
 * a viewer draws a light line between them. The path is drawn as an SVG,
 * because pdfmake 0.3.11 cannot place one in a canvas: its `offsetVector`
 * (`helpers/tools.js`) moves a canvas's rectangles, lines and polylines to
 * where the canvas stands, never a `path`, which stays at the page's
 * corner; and a polyline's points, moved in place, are not put back when a
 * page break makes it lay the document out again. An SVG it places as it
 * places an image.
 */
export function qrContent(symbol: QrSymbol, size: number): ContentSvg {
  const { modules } = symbol
  const across = modules.length + 2 * QUIET_ZONE
  const runs: string[] = []
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue
      const start = x
      while (row[x + 1] === true) x++
      const length = x + 1 - start
      runs.push(`M${QUIET_ZONE + start} ${QUIET_ZONE + y}h${length}v1h-${length}z`)
    }
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${across} ${across}"><rect width="${across}" height="${across}" fill="#ffffff"/><path d="${runs.join('')}" fill="#000000"/></svg>`
  return { svg, width: size, height: size }
}
