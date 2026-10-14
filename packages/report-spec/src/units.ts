/**
 * Lengths: the one conversion between points and millimetres, and the one
 * rounding every stored length goes through (plan 9).
 *
 * A report stores points, the PDF unit. Millimetres are what an author in
 * Switzerland or Germany types and reads, so the builder converts at its
 * edge, here and nowhere else.
 */

/** Points per inch: the default PDF user-space unit is 1/72 inch. */
export const POINTS_PER_INCH = 72

/** Millimetres per inch, exactly. */
export const MILLIMETRES_PER_INCH = 25.4

/**
 * To the nearest hundredth, ties away from zero, and never -0.
 *
 * Ties are decided on the binary value JavaScript computed, which for a
 * product like `mm * 72 / 25.4` is already a little either side of any
 * exact tie. Symmetric about zero, so a length and its negation round to
 * the same magnitude.
 */
function toHundredths(value: number): number {
  return (Math.sign(value) * Math.round(Math.abs(value) * 100)) / 100 + 0
}

/**
 * A length in points rounded to the 0.01 pt a report stores. A hundredth of
 * a point is under four thousandths of a millimetre: finer than any printer
 * places ink, coarse enough that one length has one stored value.
 */
export function roundPt(points: number): number {
  return toHundredths(points)
}

/** Millimetres to points, rounded to 0.01 pt. */
export function mmToPt(millimetres: number): number {
  return roundPt((millimetres * POINTS_PER_INCH) / MILLIMETRES_PER_INCH)
}

/**
 * Points to millimetres, rounded to 0.01 mm, for display. A value typed in
 * millimetres to two decimals, stored with `mmToPt`, comes back as typed:
 * the stored point value is within 0.005 pt (0.0018 mm) of the exact one,
 * well inside the 0.005 mm that would change the displayed hundredth.
 */
export function ptToMm(points: number): number {
  return toHundredths((points * MILLIMETRES_PER_INCH) / POINTS_PER_INCH)
}
