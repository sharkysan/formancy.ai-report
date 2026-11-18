/**
 * A resolved document's points as Word's units, rounded once and here
 * (0068). Word holds a length in twentieths of a point, a size in
 * half-points, a border's weight in eighths of a point and a picture's
 * extent in English Metric Units, 12,700 to the point; a crop is a
 * thousandth of a percent. So a length is the document's to within a
 * fortieth of a point, a size to within a quarter, a weight to within a
 * sixteenth: the file says what the document says to the unit Word
 * keeps, and the rounding is a cost record 0068 names. No value is
 * rounded: a cell is the string the runtime formatted.
 */

/** Twentieths of a point: a length, a width, a margin, an exact line. */
export function twips(points: number): number {
  return Math.round(points * 20)
}

/** Half-points: a run's size. */
export function halfPoints(points: number): number {
  return Math.round(points * 2)
}

/** Eighths of a point: a border's weight. */
export function eighths(points: number): number {
  return Math.round(points * 8)
}

/** English Metric Units: a picture's extent. */
export function emu(points: number): number {
  return Math.round(points * 12700)
}

/** Thousandths of a percent: what a crop cuts from a side. */
export function cropUnits(fraction: number): number {
  return Math.round(fraction * 100_000)
}

/** The lightest and the heaviest line Word's borders hold, in points: a quarter of a point and twelve (`ST_EighthPointMeasure`, 2 to 96). */
export const MIN_BORDER = 0.25
export const MAX_BORDER = 12
