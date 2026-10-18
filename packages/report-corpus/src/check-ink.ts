import { points } from './check-page.js'
import { placeDrawings } from './drawings.js'
import type { Fixture } from './fixture.js'
import { rasterPixels, type PagePixels } from './raster.js'
import { readPdf, type PdfBox } from './read-pdf.js'

/**
 * That nothing of an SVG image shows past its box, proved on the page's
 * pixels (0003, 0030). The operator list says a drawing is painted inside a
 * clip of its box (`drawings.ts`), but a path painted there may reach past
 * it -- `cover` draws the drawing larger than the box and leaves the clip to
 * hide the rest, and a drawing moved off its box by a transform still has
 * its paths -- so only the pixels can say what the clip kept in.
 *
 * The band around a drawing is read as the page's: a fixture leaves it
 * empty, since text or a rule set closer than the band would be ink in it.
 * A pixel is ink when any of its channels is darker than `WHITE`, and a
 * pixel the box's edge crosses is the box's: the edge itself is drawn
 * smooth, so its pixels are partly the drawing's.
 */

/**
 * A channel at or below this is ink; above it, the white the page is drawn
 * on. Every pixel of every band around the corpus's SVG fixtures' drawings
 * is exactly 255 (measured 2026-10-18 with PDF.js 6.4.299 on
 * @napi-rs/canvas 1.0.11 under Windows, at `INK_SCALE`); the five levels
 * below it are a margin for another platform's canvas, which nothing here
 * measured.
 */
const WHITE = 250

/** How a page is drawn for the check: four pixels to the point, a 2 pt band in eight pixels. */
export const INK_SCALE = 4

/** How far around a drawing's box the paper must be white, in points. */
export const INK_BAND = 2

/**
 * The ink in the band `band` points wide around `box`, on a page drawn at
 * `scale` pixels to the point: a problem naming the drawing, how many
 * pixels of ink and where the first is, or none.
 */
export function inkAround(pixels: PagePixels, scale: number, box: PdfBox, band: number): string[] {
  const inside = { left: Math.floor(box.x * scale), top: Math.floor(box.top * scale), right: Math.ceil((box.x + box.width) * scale), bottom: Math.ceil(box.bottom * scale) }
  const reach = Math.ceil(band * scale)
  const [left, top] = [Math.max(0, inside.left - reach), Math.max(0, inside.top - reach)]
  const [right, bottom] = [Math.min(pixels.width, inside.right + reach), Math.min(pixels.height, inside.bottom + reach)]
  let found = 0
  let first: readonly [number, number] | undefined
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (x >= inside.left && x < inside.right && y >= inside.top && y < inside.bottom) continue
      const at = (y * pixels.width + x) * 4
      if (pixels.data[at]! > WHITE && pixels.data[at + 1]! > WHITE && pixels.data[at + 2]! > WHITE) continue
      found++
      first ??= [x, y]
    }
  }
  if (first === undefined) return []
  const where = `${points(first[0] / scale)}, ${points(first[1] / scale)}`
  return [`a drawing at ${points(box.x)}, ${points(box.top)} shows past its box: ${found} pixels of ink within ${band} pt of it, the first at ${where}`]
}

/**
 * Whether anything of the SVG images `fixture` expects shows past their
 * boxes in `bytes`, the PDF an engine rendered of it: every page holding
 * one is drawn by PDF.js and the band around each drawing read. Each
 * problem names the fixture and the page; none means it passes. A drawing
 * that is not found is `verify`'s to report, and is not read here.
 */
export async function verifyInk(fixture: Fixture, bytes: Uint8Array, scale = INK_SCALE, band = INK_BAND): Promise<string[]> {
  const { boxes } = placeDrawings(await readPdf(bytes), fixture.expect)
  const problems: string[] = []
  for (const [index, drawings] of boxes.entries()) {
    if (drawings.length === 0) continue
    const pixels = await rasterPixels(bytes, index + 1, scale)
    for (const box of drawings) problems.push(...inkAround(pixels, scale, box, band).map((problem) => `${fixture.id}: page ${index + 1}: ${problem}`))
  }
  return problems
}
