import { describe, expect, test } from 'vitest'
import { checkSvg } from './svg.js'
import { cleaned, svg } from './svg-test-support.js'

/**
 * The extent of a cleaned drawing (`svg-extent.ts`, 0030): how far the
 * numbers svg-to-pdfkit writes for it reach, measured on drawings whose
 * matrices are worked out here by hand, in binary fractions a double holds
 * exactly, so that each expected number is the arithmetic of the comment
 * above it and not the code's.
 */

const NAMESPACE = 'xmlns="http://www.w3.org/2000/svg"'
const GRADIENT = '<linearGradient id="g"><stop/><stop offset="1" stop-color="#e76f51"/></linearGradient>'
const CLIP = '<clipPath id="c"><rect width="1" height="1"/></clipPath>'
const BOX_CLIP = '<clipPath id="c" clipPathUnits="objectBoundingBox"><rect width="0.5" height="0.5"/></clipPath>'
const NOTHING = { groups: { inverse: 0, origin: 0 }, patterns: { linear: 0, offset: 0 }, local: 0 }
/** A curve whose control points reach past its outline: the cleaner's box of it is -10 to 10 by 0 to 4, the converter's, the outline's own, -5 to 10. */
const CURVE = 'M10 0 C-10 0 -10 4 10 4 Z'
/** A gradient a quarter as wide as the box it is drawn in, moved on half the box's width: in the cleaner's box of `CURVE` it starts at that box's left edge. */
const QUARTER = '<linearGradient id="q" gradientTransform="matrix(0.25 0 0 1 0.5 0)"><stop/><stop offset="1" stop-color="#e76f51"/></linearGradient>'

describe('the extent of a drawing', () => {
  // A drawing with no page-sized group and no gradient reaches no further
  // than its own numbers: the renderer has nothing else to hold it to but
  // its nesting. svg-to-pdfkit saves the graphics state once as it starts,
  // once for the svg and once for each group and shape inside it: a
  // rectangle in the svg is three deep.
  test('of a shape alone is its own numbers and its nesting', () => {
    expect(cleaned(svg('<rect width="1" height="1"/>')).extent).toEqual({ ...NOTHING, own: 1, nesting: 3 })
  })

  // A group at an opacity is a page-sized group whose box is the page's
  // corners through the inverse of the matrix it is drawn under. For
  // matrix(1 0 1 2 10 20), x' = x + y + 10 and y' = 2y + 20: its
  // determinant is 2, the inverse of its linear part [[2, -1], [0, 1]] / 2,
  // whose rows sum to 1.5 and 0.5; and the viewBox's origin (2, 3), less
  // the translation (10, 20), is (-8, -17), which that inverse takes to
  // (0.5, -8.5). A renderer that missed the skew, or the origin, would
  // bound the box short.
  test('of a group at an opacity is its inverse, and where it takes the origin', () => {
    const drawing = `<svg ${NAMESPACE} viewBox="2 3 10 10"><g transform="matrix(1 0 1 2 10 20)" opacity="0.5"><rect width="1" height="1"/></g></svg>`
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, groups: { inverse: 1.5, origin: 8.5 }, own: 1, nesting: 3 })
  })

  // A clip on a shape is a group too, drawn under the shape's own matrix:
  // matrix(0.25 0 0 0.125 0 0) inverts to 4 and 8, rows summing to 4 and 8.
  test('of a clipped shape is the inverse of its own matrix', () => {
    const drawing = svg(`<defs>${CLIP}</defs><rect transform="matrix(0.25 0 0 0.125 0 0)" width="1" height="1" clip-path="url(#c)"/>`)
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, groups: { inverse: 8, origin: 0 }, own: 1, nesting: 3 })
  })

  // A gradient outside every group is drawn under the page, the box and
  // the drawing's matrices: the drawing's part is the shape's matrix times
  // a box inside its own, matrix(2 0 0 3 5 6) times a box inside 30 by 40
  // at (10, 20). Its linear part reaches 2 × 30 and 3 × 40, so 120; its
  // translation is where the matrix takes the box's corner, which may be as
  // far as the shape's far corner (40, 60), so (85, 186): from the
  // viewBox's origin (1, 2), 184. A renderer that took the near corner
  // alone, 64, would bound short a gradient whose box the converter finds
  // elsewhere inside the cleaner's, as it does for a curve below.
  test("of a gradient outside a group is its matrix's scale and its offset from the origin", () => {
    const drawing = `<svg ${NAMESPACE} viewBox="1 2 100 100"><defs>${GRADIENT}</defs><rect transform="matrix(2 0 0 3 5 6)" x="10" y="20" width="30" height="40" fill="url(#g)"/></svg>`
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, patterns: { linear: 120, offset: 184 }, own: 60, nesting: 3 })
  })

  // A stroke painted with a gradient is a pattern as a fill is, in the
  // same box: the same rectangle stroked, and not filled, reaches as far. A
  // walk that measured fills alone would leave a stroke's gradient
  // unbounded.
  test("of a gradient a stroke is painted with is the fill's", () => {
    const drawing = `<svg ${NAMESPACE} viewBox="1 2 100 100"><defs>${GRADIENT}</defs><rect transform="matrix(2 0 0 3 5 6)" x="10" y="20" width="30" height="40" fill="none" stroke="url(#g)"/></svg>`
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, patterns: { linear: 120, offset: 184 }, own: 60, nesting: 3 })
  })

  // A gradient in user space is drawn under the shape's matrix and its own
  // alone, whatever the shape's box: matrix(2 0 0 3 5 6), whose linear part
  // reaches 3 and whose translation, from the origin (1, 2), is (4, 4).
  // Measured in the box 30 by 40, it would reach 120 and 184.
  test('of a gradient in user space is its matrix without the box', () => {
    const user = '<linearGradient id="u" gradientUnits="userSpaceOnUse"><stop/><stop offset="1" stop-color="#e76f51"/></linearGradient>'
    const drawing = `<svg ${NAMESPACE} viewBox="1 2 100 100"><defs>${user}</defs><rect transform="matrix(2 0 0 3 5 6)" x="10" y="20" width="30" height="40" fill="url(#u)"/></svg>`
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, patterns: { linear: 3, offset: 4 }, own: 60, nesting: 3 })
  })

  // svg-to-pdfkit measures the box a gradient is drawn in on the outline
  // (`source.js:867-890`), and the cleaner holds a curve by its control
  // points, so the two boxes differ: `CURVE`'s is -5 to 10 to the
  // converter, -10 to 10 here. `QUARTER`'s matrix in the cleaner's box,
  // matrix(5 0 0 4 0 0), starts the gradient at 0, where the converter's
  // starts it at 2.5. So each entry is taken over every box inside the
  // cleaner's: the translation is the box's corner, -10 to 10, plus half
  // its width, 0 to 10, but never past the right edge, so -10 to 10; the
  // linear part a quarter of 20, and 4. Inside a group at an opacity the
  // same matrix is the group's own.
  test("of a gradient in the box of a curve is its matrix in every box inside the curve's", () => {
    const drawing = svg(`<defs>${QUARTER}</defs><path d="${CURVE}" fill="url(#q)"/>`)
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, patterns: { linear: 5, offset: 10 }, own: 10, nesting: 3 })
    const grouped = svg(`<defs>${QUARTER}</defs><g opacity="0.5"><path d="${CURVE}" fill="url(#q)"/></g>`)
    expect(cleaned(grouped).extent).toEqual({ ...NOTHING, groups: { inverse: 1, origin: 0 }, local: 10, own: 10, nesting: 3 })
  })

  // Inside a group, PDFKit's matrix starts again where the group began, so
  // a gradient's matrix there is the matrices below the group's: the
  // shape's own 4 times its box 10, so 40, wherever the drawing is placed.
  // Measured from the root it is 20, and a renderer that took that would
  // pass a drawing whose group shrinks a millionfold and whose shape grows
  // as much, which wrote a pattern matrix of 10^12 into an e-invoice's
  // PDF/A on 18 October 2026.
  test('of a gradient inside a group is measured from where the group began', () => {
    const drawing = svg(
      `<defs>${GRADIENT}</defs><g transform="matrix(0.5 0 0 0.5 0 0)" opacity="0.5"><rect transform="matrix(4 0 0 4 0 0)" width="10" height="10" fill="url(#g)"/></g>`,
    )
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, groups: { inverse: 2, origin: 0 }, local: 40, own: 10, nesting: 3 })
  })

  // A clip in objectBoundingBox units draws its shapes in the box of what
  // it clips, a matrix of that box's width, height and corner. For a group,
  // the box of its shapes through the matrices below it: the rectangle 10
  // by 2 at (-3, 1), under matrix(2 0 0 5 1 1), spans -5 to 15 and 6 to 16,
  // so matrix(20 0 0 10 -5 6) or a box inside it, whose largest entry is 20.
  test('of a group clipped in its own box is that box', () => {
    const drawing = svg(`<defs>${BOX_CLIP}</defs><g clip-path="url(#c)"><rect transform="matrix(2 0 0 5 1 1)" x="-3" y="1" width="10" height="2"/></g>`)
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, groups: { inverse: 1, origin: 0 }, local: 20, own: 7, nesting: 3 })
  })

  // The converter's box of a group holds the shapes of the groups inside
  // it too, each through its own matrix (`source.js:1564-1577`): a square
  // at x 100 in a group scaled twice is at 200 to 202 by 0 to 2 in the
  // clipped group's box. A walk that stopped at the first group would find
  // no box at all.
  test('of a group clipped in its own box holds the groups inside it', () => {
    const drawing = svg(`<defs>${BOX_CLIP}</defs><g clip-path="url(#c)"><g transform="matrix(2 0 0 2 0 0)"><rect x="100" width="1" height="1"/></g></g>`)
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, groups: { inverse: 1, origin: 0 }, local: 202, own: 101, nesting: 3 })
  })

  // The clip's matrix is written as the converter's box, whose corner may
  // be anywhere inside the cleaner's: `CURVE` moved on to 980 -- 1000, which
  // the converter finds from 985, is held at its far corner, 1000. Its
  // near corner, 980, falls short of what is written.
  test("of a group clipped in the box of a curve is that box's far corner", () => {
    const drawing = svg(`<defs>${BOX_CLIP}</defs><g clip-path="url(#c)"><path d="M1000 0 C980 0 980 4 1000 4 Z"/></g>`)
    expect(cleaned(drawing).extent).toEqual({ ...NOTHING, groups: { inverse: 1, origin: 0 }, local: 1000, own: 1000, nesting: 3 })
  })

  // What the converter writes of the drawing itself is its outlines'
  // points, and those are not only the points the file holds: a quadratic
  // after a quadratic reflects the last one's control point, so a chain of
  // them walks away from every point it ends at. From (3, 0) after Q0 3,
  // the reflections are (6, -3), (-12, 3) and (18, -3), and the last
  // curve's first control point is 3 + (18 - 3) × 2 / 3: 13, where no
  // number in the path is past 3. A renderer that took the file's numbers
  // for the converter's would bound a long chain at a million and see
  // billions written.
  test("of a drawing's outlines is their control points, a reflected one's too", () => {
    expect(cleaned(svg('<path d="M0 0 Q0 3 3 0 T-3 0 T3 0 T-3 0" fill="#000"/>')).extent.own).toBe(13)
  })

  // An arc whose radii are too short for its ends is drawn with radii the
  // converter grows until they reach (`source.js:1037-1041`): A1 1 from 0
  // to 8 is a half circle of radius 4 about (4, 0), whose curves' control
  // points lie within 4 × hypot(1, 4/3 × tan 15°) of it (`svg-path.ts`),
  // so 4 + 4.2476 -- irrational, so compared to twelve places. The file's
  // numbers reach 8; an arc of radii a millionth and a million drawn across
  // a million reaches 5 × 10^17.
  test('of an arc is the reach of the radii the converter grows it to', () => {
    expect(cleaned(svg('<path d="M0 0 A1 1 0 0 1 8 0" fill="#000"/>')).extent.own).toBeCloseTo(4 + 4 * Math.hypot(1, (4 / 3) * Math.tan(Math.PI / 12)), 12)
    expect(cleaned(svg('<path d="M0 0 A0.000001 1000000 0 1 1 1000000 0 Z" fill="#000"/>')).extent.own).toBeGreaterThan(5e17)
  })

  // A group at an opacity is drawn into a stream of its own, which starts
  // its nesting again: of five groups, the third at an opacity, the svg's
  // own stream nests to that group, five deep with the converter's own
  // save and the svg's, and the group's stream to the rectangle, three
  // below it. Five opaque groups nest the rectangle eight deep.
  test('nests each stream from where it begins', () => {
    const turn = '<g transform="matrix(0 1 -1 0 0 0)">'
    const drawing = svg(`${turn}${turn}<g opacity="0.5">${turn}${turn}<rect width="1" height="1"/></g></g></g></g></g>`)
    expect(cleaned(drawing).extent.nesting).toBe(5)
    const opaque = svg(`${turn}${turn}<g transform="matrix(0 1 -1 0 0 0)">${turn}${turn}<rect width="1" height="1"/></g></g></g></g></g>`)
    expect(cleaned(opaque).extent.nesting).toBe(8)
  })

  // What the renderer draws by is checkSvg's, and it is cleanSvg's own:
  // the group's stream starts at the group, so the gradient's matrix there
  // is the shape's box, 10.
  test('is the same where it is checked', () => {
    const drawing = cleaned(
      svg(`<defs>${GRADIENT}</defs><g transform="matrix(0.5 0 0 0.5 0 0)" opacity="0.5"><rect width="10" height="10" fill="url(#g)"/></g>`),
    )
    expect(checkSvg(drawing.bytes)).toMatchObject({ ok: true, extent: { ...NOTHING, groups: { inverse: 2, origin: 0 }, local: 10, own: 10, nesting: 3 } })
  })
})
