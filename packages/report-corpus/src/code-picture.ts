import { codesIn, type PixelCode } from './codes.js'
import type { GreyPixels } from './docx/png.js'

/**
 * A code's picture, as a Word file embeds one (0074, extending 0003), held
 * on its own pixels: read back by the corpus's PNG reader (`docx/png.ts`)
 * and decoded by ZXing (`codes.ts`), as a scanner reads it. Two readings,
 * neither the writer's.
 *
 * `codeGrid` is the picture as a drawing: a square of whole pixels a
 * module, black on white, its symbol four modules in from every side,
 * exactly. It is found from the pixels alone -- the first dark run of
 * the first row that holds one is the finder pattern's, seven modules --
 * and every pixel is then held to the module it stands in, so a picture
 * resampled, smoothed or a pixel out is no grid, and the last dark
 * column and row to standing four modules from the right and the
 * bottom, so a symbol in the corner of a larger square is none either.
 * `readPictureCode` is what the picture says: its text, its bytes, its
 * level and its version, and where ZXing finds its symbol; a symbol
 * ZXing reads only mirrored, turned or light on dark is refused where it
 * is read (`codesIn`). The grid cannot tell a symbol from its mirror,
 * and ZXing cannot tell a symbol from one in a larger square: a picture
 * is held by both, and its version by each to the other
 * (`check-docx-codes.ts`).
 */

/** The modules of a picture's symbol and the pixels each takes. */
export interface CodeGrid {
  /** Pixels a module, across and down: a whole number. */
  readonly pixels: number
  /** The symbol's modules a side, without its quiet zone. */
  readonly modules: number
  /** The version of that many modules (ISO/IEC 18004: 4 a version and 17). */
  readonly version: number
}

/** ISO/IEC 18004's quiet zone: four modules of white on every side of the symbol. */
const QUIET = 4

/** A finder pattern's side in modules, and so the length of the first dark run a symbol's first row holds. */
const FINDER = 7

/** The picture's grid; throws, saying why, where the picture is not a symbol drawn in whole pixels a module with its quiet zone around it. */
export function codeGrid(png: GreyPixels): CodeGrid {
  const { width, height, data } = png
  if (width !== height) throw new Error(`the picture is ${width} by ${height} pixels, and a code's is square`)
  const first = data.indexOf(0)
  if (first < 0) throw new Error('the picture is all white')
  const [x, y] = [first % width, Math.floor(first / width)]
  let run = 0
  while (x + run < width && data[first + run] === 0) run++
  const pixels = run / FINDER
  if (!Number.isInteger(pixels)) throw new Error(`the picture's first dark run is ${run} pixels, which is no seven modules of whole pixels`)
  if (x !== QUIET * pixels || y !== QUIET * pixels)
    throw new Error(`the picture's symbol starts ${x} pixels in and ${y} down, where four modules of ${pixels} pixels are ${QUIET * pixels}`)
  const across = width / pixels
  const version = (across - 2 * QUIET - 17) / 4
  if (!Number.isInteger(version) || version < 1 || version > 40)
    throw new Error(`the picture is ${across} modules of ${pixels} pixels across, which is no version's symbol with its quiet zone`)
  // The last column and the last row that hold a dark pixel: where the symbol ends.
  let [right, bottom] = [0, 0]
  for (let row = 0; row < height; row++) {
    const module = Math.floor(row / pixels) * pixels * width
    for (let column = 0; column < width; column++) {
      const value = data[row * width + column]!
      if (value !== data[module + Math.floor(column / pixels) * pixels])
        throw new Error(`the pixel ${column}, ${row} is not the colour of the module it stands in: the picture is not whole pixels a module`)
      const quiet = Math.min(row, column, height - 1 - row, width - 1 - column) < QUIET * pixels
      if (quiet && value !== 255) throw new Error(`the pixel ${column}, ${row} is dark inside the quiet zone of four modules`)
      if (value === 0) [right, bottom] = [Math.max(right, column), row]
    }
  }
  // Four modules of white on the right and under the symbol, and no more: with more, the picture is a larger version's square around
  // this symbol, and its modules at its extent are not the modules it prints.
  const [fromRight, fromBottom] = [width - 1 - right, height - 1 - bottom]
  if (fromRight !== QUIET * pixels || fromBottom !== QUIET * pixels)
    throw new Error(
      `the picture's symbol ends ${fromRight} pixels from the right and ${fromBottom} from the bottom, where four modules of ${pixels} pixels are ${QUIET * pixels}`,
    )
  return { pixels, modules: across - 2 * QUIET, version }
}

/** `png` as the pixels ZXing reads: red, green, blue and alpha a pixel. */
function rgba(png: GreyPixels): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(png.data.length * 4)
  png.data.forEach((value, index) => pixels.set([value, value, value, 255], index * 4))
  return pixels
}

/** The one code ZXing reads in the picture, placed in the picture's pixels; undefined where it reads none; throws where it reads several, or reads one only mirrored, turned or light on dark (`codesIn`). */
export async function readPictureCode(png: GreyPixels): Promise<PixelCode | undefined> {
  const found = await codesIn({ data: rgba(png), width: png.width, height: png.height })
  if (found.length > 1) throw new Error(`the picture holds ${found.length} codes`)
  return found[0]
}
