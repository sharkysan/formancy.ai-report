import { RenderRefusal } from '@formancy/report-runtime'
import { eighths, MAX_BORDER, MIN_BORDER, twips } from './units.js'

/**
 * What Word's units do not state, refused as `unsupported` before a byte
 * is written (0068): a line lighter or heavier than Word's borders hold,
 * and a length that rounds to none of the twentieths of a point it is
 * written in -- each a length the PDF draws and the file would state as
 * another, since every length is rounded to its unit (`units.ts`); and a
 * length as those refusals state one. Which length of a block is held
 * here is the walk's to say (`check.ts`); a picture's extent, in English
 * Metric Units, is held once its asset is read and the size it is drawn
 * at known (`check-pictures.ts`).
 *
 * It changes when the writer writes a length in another of Word's units,
 * or what Word holds of one is read otherwise.
 */

/** A line's weight held to what Word's borders hold: from a quarter of a point to twelve, in eighths. */
export function checkLine(weight: number, what: string, subject: string): void {
  if (eighths(weight) < eighths(MIN_BORDER) || eighths(weight) > eighths(MAX_BORDER))
    throw new RenderRefusal('unsupported', `${what} ${weight} pt thick; a line of a Word file is from ${MIN_BORDER} to ${MAX_BORDER} pt`, subject)
}

/** A length as a sentence states one: to four digits, so that a share of a width is not its every binary place. */
export const shown = (points: number): string => String(Number(points.toPrecision(4)))

/**
 * Whether a length rounds to none of Word's twentieths of a point: one
 * under a fortieth. A table that wide, or a row of exactly that height,
 * would be written as one of no width or no height, which the PDF draws,
 * thin as it is, and nobody has seen Word draw. A spacer that small is no
 * space and writes nothing (`blocks.ts`); a box that small is refused.
 */
export const tooSmall = (points: number): boolean => twips(points) < 1
export const NO_LENGTH = 'a Word file states no length under a fortieth of a point'
