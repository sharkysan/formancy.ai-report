import { SWISS_CODE_SIZE, SWISS_CROSS, type QrSymbol } from '@formancy/report-runtime'
import { modulePixels, pngOf, UP } from './code-png.js'

/**
 * A QR-bill's Swiss QR Code as the picture a Word file embeds for it
 * (0075): a PNG of one bit a pixel, black on white, every module a
 * square of whole pixels, and over its centre the Swiss cross, drawn
 * into the picture.
 *
 * It has no quiet zone of its own: SIX prints the code at 46 mm whatever
 * its version, its modules that over theirs, and the slip leaves 5 mm
 * blank around it (IG 3.5.2, 6.4.1), which the slip's layout keeps
 * (`slip.ts`). The cross is SIX's logo as the PDF draws it over the code
 * (report-runtime's `SWISS_CROSS`): a white square of 7 mm, a black one
 * of 6 mm on it, and a white cross on that. A Word file holds no drawing
 * over a picture that nobody has seen Word place, so the cross is pixels
 * of the picture itself, each white or black by where its centre stands:
 * its edges are within half a pixel, a 1,200th of an inch, of SIX's.
 */

/** A Swiss QR Code's side in millimetres (IG 6.4). */
const SIDE = 46

/** The pixels a module of `symbol` takes at 46 mm: fine enough for its size, as every code's picture is (`code-png.ts`). */
export function swissPixels(symbol: QrSymbol): number {
  const across = symbol.modules.length
  return modulePixels(SWISS_CODE_SIZE / across, across)
}

/** What the cross makes of a pixel whose centre is `x`, `y` millimetres from the code's centre: white, black, or nothing where the symbol shows. */
function cross(x: number, y: number): boolean | undefined {
  const [across, down] = [Math.abs(x), Math.abs(y)]
  if (Math.max(across, down) > SWISS_CROSS.white / 2) return undefined
  if (Math.max(across, down) > SWISS_CROSS.black / 2) return true
  const [arm, span] = [SWISS_CROSS.arm / 2, SWISS_CROSS.span / 2]
  return (across <= arm && down <= span) || (down <= arm && across <= span)
}

/**
 * `symbol` as a PNG, `pixels` a module, the Swiss cross over its centre:
 * a set bit a white pixel. A scanline that is the one above it is PNG's
 * filter for that and nothing more, so the picture is small. The same
 * symbol at the same pixels is the same bytes.
 */
export function swissPng(symbol: QrSymbol, pixels: number): Uint8Array {
  const side = symbol.modules.length * pixels
  const stride = 1 + Math.ceil(side / 8)
  const lines = new Uint8Array(side * stride)
  // The scanlines that repeat the one above them: emptied once every line has been compared with the one it follows, as it was drawn.
  const repeats: number[] = []
  const millimetres = (pixel: number): number => ((pixel + 0.5) * SIDE) / side - SIDE / 2
  for (let y = 0; y < side; y++) {
    const at = y * stride
    const row = symbol.modules[Math.floor(y / pixels)]!
    const down = millimetres(y)
    for (let x = 0; x < side; x++) {
      const white = cross(millimetres(x), down) ?? row[Math.floor(x / pixels)] !== true
      if (white) lines[at + 1 + (x >> 3)]! |= 0x80 >> (x & 7)
    }
    if (y === 0) continue
    let same = true
    for (let byte = 1; byte < stride && same; byte++) same = lines[at + byte] === lines[at - stride + byte]
    if (same) repeats.push(at)
  }
  for (const at of repeats) {
    lines.fill(0, at + 1, at + stride)
    lines[at] = UP
  }
  return pngOf(side, lines)
}
