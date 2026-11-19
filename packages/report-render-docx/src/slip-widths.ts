import type { BillFace } from '@formancy/report-runtime'

/**
 * The face a Word file's slip is named in, and how wide it sets each
 * character a bill may hold (0075): what the writer proves a slip's lines
 * to fit by, since it embeds no font and measures with none.
 *
 * The slip is named in Arial, one of the four faces SIX admits (IG 3.4:
 * Arial, Frutiger, Helvetica and Liberation Sans), which a reader with
 * Word has; the font table gives Liberation Sans as its other name, the
 * face the PDF prints the slip in (0043), for a reader that has that and
 * no Arial. The two set every character below at one width: Liberation
 * Sans was drawn to Arial's metrics, and on 19 November 2026 each of
 * these advances, and the ascender and the descender, was read the same
 * from the Arial 7.07 of Windows 11 Pro 10.0.26200 and from the
 * Liberation Sans 2.1.5 the renderer ships, in both faces. A reader with
 * neither chooses a face of its own, by the font table's kind, and the
 * widths are then that face's: a line may be wider than its place there,
 * which is why no row of the slip is of an exact height (`slip.ts`).
 *
 * The characters are the ones SIX allows a bill (IG 4.1.1, report-spec's
 * `checkQrBillText`): Basic Latin, Latin-1 Supplement, Latin Extended-A,
 * Ș ș Ț ț and the euro sign. A character outside them has no width
 * here, and a bill that prints one is refused: nothing could show its
 * line to fit. The advances are Liberation Sans 2.1.5's own, in its 2048
 * units to the em, without kerning, which Word applies to none of a run
 * that does not ask for it; `slip-widths.test.ts` reads them again from
 * the renderer's font files, and holds the list of characters to
 * report-spec's rule.
 */

/** The family the slip's every run names, and the other name the font table gives it. */
export const SLIP_FAMILY = 'Arial'
export const SLIP_OTHER_FAMILY = 'Liberation Sans'

/** The face's units to the em. */
const UNITS = 2048

/** How far below its line's top the face's baseline stands, and how tall its line is, in ems: the horizontal header's ascender, and that less its descender, the PDF renderer's `LIBERATION_ASCENDER` and `LIBERATION_LINE` stated again. */
export const SLIP_ASCENDER = 1854 / UNITS
export const SLIP_LINE = 2288 / UNITS

/** The runs of code points the widths below are of, each from its first to its last. */
export const SLIP_RANGES: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0x17f],
  [0x218, 0x21b],
  [0x20ac, 0x20ac],
]

/** Each face's advances, a list for each of `SLIP_RANGES`, in units. */
export const SLIP_ADVANCES: Readonly<Record<BillFace, readonly (readonly number[])[]>> = {
  normal: [
    // prettier-ignore
    [
      569, 569, 727, 1139, 1139, 1821, 1366, 391, 682, 682, 797, 1196, 569, 682, 569, 569, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139,
      1139, 1139, 569, 569, 1196, 1196, 1196, 1139, 2079, 1366, 1366, 1479, 1479, 1366, 1251, 1593, 1479, 569, 1024, 1366, 1139, 1706, 1479, 1593,
      1366, 1593, 1479, 1366, 1251, 1479, 1366, 1933, 1366, 1366, 1251, 569, 569, 569, 961, 1139, 682, 1139, 1139, 1024, 1139, 1139, 569, 1139,
      1139, 455, 455, 1024, 455, 1706, 1139, 1139, 1139, 1139, 682, 1024, 569, 1139, 1024, 1479, 1024, 1024, 1024, 684, 532, 684, 1196,
    ],
    // prettier-ignore
    [
      569, 682, 1139, 1139, 1139, 1139, 532, 1139, 682, 1509, 758, 1139, 1196, 682, 1509, 1131, 819, 1124, 682, 682, 682, 1180, 1100, 682,
      682, 682, 748, 1139, 1708, 1708, 1708, 1251, 1366, 1366, 1366, 1366, 1366, 1366, 2048, 1479, 1366, 1366, 1366, 1366, 569, 569, 569, 569,
      1479, 1479, 1593, 1593, 1593, 1593, 1593, 1196, 1593, 1479, 1479, 1479, 1479, 1366, 1366, 1251, 1139, 1139, 1139, 1139, 1139, 1139, 1821, 1024,
      1139, 1139, 1139, 1139, 569, 569, 569, 569, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1124, 1251, 1139, 1139, 1139, 1139, 1024, 1139, 1024,
      1366, 1139, 1366, 1139, 1366, 1139, 1479, 1024, 1479, 1024, 1479, 1024, 1479, 1024, 1479, 1259, 1479, 1139, 1366, 1139, 1366, 1139, 1366, 1139,
      1366, 1139, 1366, 1139, 1593, 1139, 1593, 1139, 1593, 1139, 1593, 1139, 1479, 1139, 1479, 1139, 569, 569, 569, 569, 569, 569, 569, 455,
      569, 569, 1505, 909, 1024, 455, 1366, 1024, 1024, 1139, 455, 1139, 455, 1139, 597, 1139, 684, 1139, 455, 1479, 1139, 1479, 1139, 1479,
      1139, 1237, 1481, 1139, 1593, 1139, 1593, 1139, 1593, 1139, 2048, 1933, 1479, 682, 1479, 682, 1479, 682, 1366, 1024, 1366, 1024, 1366, 1024,
      1366, 1024, 1251, 569, 1251, 768, 1251, 569, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1933, 1479, 1366, 1024,
      1366, 1251, 1024, 1251, 1024, 1251, 1024, 455,
    ],
    // prettier-ignore
    [
      1366, 1024, 1251, 569,
    ],
    // prettier-ignore
    [
      1139,
    ],
  ],
  bold: [
    // prettier-ignore
    [
      569, 682, 971, 1139, 1139, 1821, 1479, 487, 682, 682, 797, 1196, 569, 682, 569, 569, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139,
      1139, 1139, 682, 682, 1196, 1196, 1196, 1251, 1997, 1479, 1479, 1479, 1479, 1366, 1251, 1593, 1479, 569, 1139, 1479, 1251, 1706, 1479, 1593,
      1366, 1593, 1479, 1366, 1251, 1479, 1366, 1933, 1366, 1366, 1251, 682, 569, 682, 1196, 1139, 682, 1139, 1251, 1139, 1251, 1139, 682, 1251,
      1251, 569, 569, 1139, 569, 1821, 1251, 1251, 1251, 1251, 797, 1139, 682, 1251, 1139, 1593, 1139, 1139, 1024, 797, 573, 797, 1196,
    ],
    // prettier-ignore
    [
      569, 682, 1139, 1139, 1139, 1139, 573, 1139, 682, 1509, 758, 1139, 1196, 682, 1509, 1131, 819, 1124, 682, 682, 682, 1180, 1139, 682,
      682, 682, 748, 1139, 1708, 1708, 1708, 1251, 1479, 1479, 1479, 1479, 1479, 1479, 2048, 1479, 1366, 1366, 1366, 1366, 569, 569, 569, 569,
      1479, 1479, 1593, 1593, 1593, 1593, 1593, 1196, 1593, 1479, 1479, 1479, 1479, 1366, 1366, 1251, 1139, 1139, 1139, 1139, 1139, 1139, 1821, 1139,
      1139, 1139, 1139, 1139, 569, 569, 569, 569, 1251, 1251, 1251, 1251, 1251, 1251, 1251, 1124, 1251, 1251, 1251, 1251, 1251, 1139, 1251, 1139,
      1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1139, 1479, 1472, 1479, 1251, 1366, 1139, 1366, 1139, 1366, 1139,
      1366, 1139, 1366, 1139, 1593, 1251, 1593, 1251, 1593, 1251, 1593, 1251, 1479, 1251, 1479, 1251, 569, 569, 569, 569, 569, 569, 569, 569,
      569, 569, 1607, 1139, 1139, 569, 1479, 1139, 1139, 1251, 569, 1251, 569, 1251, 789, 1251, 981, 1251, 569, 1479, 1251, 1479, 1251, 1479,
      1251, 1451, 1481, 1251, 1593, 1251, 1593, 1251, 1593, 1251, 2048, 1933, 1479, 797, 1479, 797, 1479, 797, 1366, 1139, 1366, 1139, 1366, 1139,
      1366, 1139, 1251, 682, 1251, 981, 1251, 682, 1479, 1251, 1479, 1251, 1479, 1251, 1479, 1251, 1479, 1251, 1479, 1251, 1933, 1593, 1366, 1139,
      1366, 1251, 1024, 1251, 1024, 1251, 1024, 569,
    ],
    // prettier-ignore
    [
      1366, 1139, 1251, 682,
    ],
    // prettier-ignore
    [
      1139,
    ],
  ],
}

/** The advance of `point` in `face`, in units; undefined where it is none of SIX's characters. */
function advance(point: number, face: BillFace): number | undefined {
  for (const [index, [first, last]] of SLIP_RANGES.entries()) if (point >= first && point <= last) return SLIP_ADVANCES[face][index]![point - first]
  return undefined
}

/** The first character of `text` that has no width here, as its code point; undefined where every one has. */
export function unmeasured(text: string): number | undefined {
  for (const character of text) {
    const point = character.codePointAt(0)!
    if (advance(point, 'normal') === undefined) return point
  }
  return undefined
}

/** How wide `text` is set in `face` at `size` points, in points; every character of it is one `unmeasured` passed. */
export function slipWidth(text: string, face: BillFace, size: number): number {
  let units = 0
  for (const character of text) units += advance(character.codePointAt(0)!, face)!
  return (units * size) / UNITS
}
