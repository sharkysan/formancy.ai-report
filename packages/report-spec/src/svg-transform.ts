/**
 * Transforms: an element's `transform` or a gradient's `gradientTransform`,
 * read by SVG 1.1's transform-list grammar, composed into one matrix and
 * written as `matrix(a b c d e f)`.
 *
 * The cleaner also composes the matrices from the root down to each
 * element and refuses a drawing where any entry of one passes
 * `MAX_SVG_COORDINATE`, or of its inverse: svg-to-pdfkit inverts the matrix
 * an element is drawn under to find the page's box in its user space for
 * every clip and every group opacity (`getPageBBox`, `source.js:536`), so a
 * matrix that shrinks the drawing a millionfold twice over gives that box
 * corners past the 10^21 at which PDFKit throws. With every point under the
 * bound too, every coordinate the converter computes stays far below it
 * (limits.ts says what was measured).
 *
 * CSS's transform functions -- units on the arguments, `rotate(30deg)`,
 * `translateX` -- are not SVG's, and svg-to-pdfkit reads none of them, so
 * they are refused as not a transform.
 */
import { MAX_SVG_COORDINATE } from './limits.js'
import { float, readNumber, writeNumber } from './svg-number.js'
import { refuse } from './svg-refusal.js'
import { readNumbers, skipSpace } from './svg-values.js'

export type Matrix = readonly [number, number, number, number, number, number]

/** What to do about a transform this format does not read. */
const TRANSFORM_ADVICE = "write it with SVG's matrix, translate, scale, rotate, skewX and skewY"

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `a` then `b`: the matrix that maps through `b` first, as SVG composes a transform list left to right. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

const FUNCTION = /^(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** One transform function's matrix, from its arguments, or undefined when it has the wrong number of them. */
function functionMatrix(name: string, a: readonly number[]): Matrix | undefined {
  const [p = 0, q = 0, r = 0] = a
  switch (name) {
    case 'matrix':
      return a.length === 6 ? (a as unknown as Matrix) : undefined
    case 'translate':
      return a.length === 1 || a.length === 2 ? [1, 0, 0, 1, p, q] : undefined
    case 'scale':
      return a.length === 1 || a.length === 2 ? [p, 0, 0, a.length === 2 ? q : p, 0, 0] : undefined
    case 'rotate': {
      if (a.length !== 1 && a.length !== 3) return undefined
      const cos = Math.cos(radians(p))
      const sin = Math.sin(radians(p))
      const turn: Matrix = [cos, sin, -sin, cos, 0, 0]
      return a.length === 1 ? turn : multiply(multiply([1, 0, 0, 1, q, r], turn), [1, 0, 0, 1, -q, -r])
    }
    case 'skewX':
      return a.length === 1 ? [1, 0, Math.tan(radians(p)), 1, 0, 0] : undefined
    default:
      return a.length === 1 ? [1, Math.tan(radians(p)), 0, 1, 0, 0] : undefined
  }
}

/** A transform list composed into one matrix, written back as the cleaner writes it so that reading the written form again gives the same matrix. */
export function readTransform(text: string, where: string): Matrix {
  let matrix = IDENTITY
  let i = skipSpace(text, 0)
  while (i < text.length) {
    const match = FUNCTION.exec(text.slice(i))
    if (match === null) refuse('unsupported', `${where} is not a transform this format reads`, TRANSFORM_ADVICE)
    const [whole, name = '', args = ''] = match
    const step = functionMatrix(
      name,
      readNumbers(args, where).map((n) => n.value),
    )
    if (step === undefined) refuse('unsupported', `${where} gives ${name} the wrong number of arguments`, TRANSFORM_ADVICE)
    matrix = multiply(matrix, step)
    i = skipSpace(text, i + whole.length)
    if (text.charCodeAt(i) === 0x2c) {
      i = skipSpace(text, i + 1)
      if (i >= text.length) refuse('unsupported', `${where} is not a transform this format reads`, TRANSFORM_ADVICE)
    }
  }
  return written(matrix, where)
}

/**
 * The matrix each entry of which is what its written form reads back as,
 * so that a drawing is composed, bounded and counted from what is written.
 * A matrix that flattens the drawing to a line or a point is refused: it
 * draws nothing a reader can see, and a PDF reader may refuse its singular
 * matrix.
 */
function written(matrix: Matrix, where: string): Matrix {
  const entries = matrix.map((entry) => readNumber(writeNumber(float(entry)), where).value) as unknown as Matrix
  if (entries[0] * entries[3] - entries[1] * entries[2] === 0)
    refuse('out-of-range', `${where} flattens what it transforms to nothing`, 'remove what it flattens, or give the transform an area')
  return entries
}

export function isIdentity(matrix: Matrix): boolean {
  return matrix.every((entry, i) => entry === IDENTITY[i])
}

/** The `matrix(…)` an element's transform is written as; the identity is not written. */
export function writeMatrix(matrix: Matrix): string {
  return `matrix(${matrix.map((entry) => writeNumber(float(entry))).join(' ')})`
}

/** A box: left, top, right, bottom. */
export type Box = readonly [number, number, number, number]

/** The least and the greatest each entry of a matrix may be. */
export interface Spread {
  readonly least: Matrix
  readonly greatest: Matrix
}

/**
 * The matrix a shape's gradient is drawn under -- the matrix `shape`, the
 * shape's box when the gradient is drawn in it, and the gradient's own
 * transform, composed, which PDFKit writes as the pattern's matrix after
 * its own (`source.js:1863-1866`) -- over every box the converter may
 * draw it in. The converter measures the box on the outline
 * (`source.js:867-890`), which lies inside the box the cleaner holds
 * (`svg-path.ts`), a curve's by its control points, but not at its corner:
 * so `box` stands for every box inside it. Each entry is linear in the
 * box's corner and size, across and down apart, and a box inside spans,
 * across, from a left edge at or right of `box`'s to a right edge at or
 * left of its; an entry is least and greatest, then, at one of nine boxes,
 * the whole width or none at either edge, across, and so down. Without a
 * box -- a gradient in user space -- the one matrix.
 */
export function spreadUnder(shape: Matrix, box: Box | undefined, gradient: Matrix): Spread {
  if (box === undefined) {
    const drawn = multiply(shape, gradient)
    return { least: drawn, greatest: drawn }
  }
  const [left, top, right, bottom] = box
  const across = [
    [0, left],
    [right - left, left],
    [0, right],
  ] as const
  const down = [
    [0, top],
    [bottom - top, top],
    [0, bottom],
  ] as const
  const least = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity]
  const greatest = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity]
  for (const [width, x] of across)
    for (const [height, y] of down) {
      const drawn = multiply(shape, multiply([width, 0, 0, height, x, y], gradient))
      for (let i = 0; i < 6; i += 1) {
        least[i] = Math.min(least[i] as number, drawn[i] as number)
        greatest[i] = Math.max(greatest[i] as number, drawn[i] as number)
      }
    }
  return { least: least as unknown as Matrix, greatest: greatest as unknown as Matrix }
}

/**
 * Where a shape's gradient is drawn, from the root (`spreadUnder`).
 * Refused as `out-of-range` when an entry could pass the bound: three
 * matrices each within it compose to a million cubed, and a group turned
 * and scaled a millionfold, painting a shape a million wide with a
 * gradient of the same transform, threw `unsupported number: -1.1e+21`
 * from inside PDFKit, page-wide in a landscape box 550 points wide; and a
 * gradient the cleaner's box of a curve held under the bound wrote 5 ×
 * 10^12 in the converter's.
 */
export function gradientUnder(shape: Matrix, box: Box | undefined, gradient: Matrix, where: string): Spread {
  const drawn = spreadUnder(shape, box, gradient)
  if (!bounded(drawn.least) || !bounded(drawn.greatest)) refuse('out-of-range', `${where} paints a gradient transformed past ${MAX_SVG_COORDINATE}`)
  return drawn
}

/** The inverse of a matrix `compose` has held to an area, as svg-to-pdfkit inverts one (`source.js:545-548`). */
export function inverse(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix
  const determinant = a * d - b * c
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant]
}

/** Whether every entry is a number of magnitude at most the bound. */
function bounded(entries: readonly number[]): boolean {
  return entries.every((entry) => Math.abs(entry) <= MAX_SVG_COORDINATE)
}

/**
 * The composed matrix, refused as `out-of-range` when an entry of it, or of
 * the inverse of its linear part, passes the bound: a matrix that
 * magnifies past it, or shrinks past its reciprocal.
 */
export function compose(outer: Matrix, inner: Matrix, where: string): Matrix {
  const composed = multiply(outer, inner)
  if (!bounded(composed)) refuse('out-of-range', `${where} is transformed past ${MAX_SVG_COORDINATE}`)
  const [a, b, c, d] = composed
  const determinant = a * d - b * c
  if (!bounded([d / determinant, b / determinant, c / determinant, a / determinant]))
    refuse('out-of-range', `${where} shrinks what it transforms, or flattens it, past a factor of ${MAX_SVG_COORDINATE}`)
  return composed
}
