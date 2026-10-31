/**
 * How far the numbers svg-to-pdfkit writes for a cleaned drawing reach,
 * wherever the drawing is placed, and how deep it nests the graphics state
 * (0030): what the renderer holds an image of it to in an e-invoice, whose
 * PDF/A-3 may hold no integer past 2,147,483,647 and nest the graphics
 * state no deeper than 28 (ISO 19005-2's 6.1.13, veraPDF's rules 6.1.13-1
 * and 6.1.13-8). Nothing is refused by it here: a report that is no
 * e-invoice is no PDF/A, and draws such a drawing as it always did.
 *
 * What the converter writes, and what each number grows with -- a
 * `source.js:N` is a line of the converter, as `limits.ts` says:
 *
 * - The drawing's outlines, in their own coordinates: the points of its
 *   paths and shapes, and those the converter draws them with, which a
 *   quadratic reflected after a quadratic and an arc whose radii it grows
 *   to reach its ends (`source.js:1010-1068`) take past every number the
 *   file holds; each shape's box in `svg-path.ts` holds them all: `own`.
 *   The rest of what it writes of the drawing itself -- each element's own
 *   matrix, a stroke's width and dashes, a gradient's ends -- is a number
 *   the cleaner holds to `MAX_SVG_COORDINATE`, which the renderer adds.
 * - The viewBox fitted into the image's box, which the renderer finds from
 *   the viewBox and the box alone.
 * - Every page-sized transparency group's /BBox (`docBeginGroup`,
 *   `source.js:67-90`): the page's corners taken through the inverse of
 *   all the element that makes it is drawn under, page and box included
 *   (`getPageBBox`, `source.js:536-539`). It grows with the inverse of the
 *   drawing's matrix there, and with where that inverse takes the viewBox's
 *   origin, and as the box shrinks: `groups`.
 * - Every gradient's /Matrix: PDFKit's matrix where the gradient is
 *   painted, times the shape's box and the gradient's own transform
 *   (`source.js:1863-1866`, and pdfkit.js's gradient `apply`), taken over
 *   every box inside the shape's (`spreadUnder`). A group starts PDFKit's
 *   matrix again from the identity (`source.js:83`), so inside one that is
 *   the matrices below the group's times the box, the same wherever the
 *   drawing is placed: `local`. Outside every group it is the page's and
 *   the box's matrix times the drawing's: `patterns`.
 * - The box of what a clip in objectBoundingBox units clips, written as a
 *   matrix inside the clip's group (`source.js:2211-2213`): for a group,
 *   the boxes of its shapes through the matrices between them, and any box
 *   inside that, the converter's being the outlines'; `local` too.
 *
 * Each is an upper bound, since a shape's box is the cleaner's, which holds
 * the converter's. What the page and the box add is the renderer's to
 * find, since only it knows them.
 */
import type { ViewBox } from './svg-drawing.js'
import { type Box, inverse, type Matrix, type Spread } from './svg-transform.js'

export interface SvgExtent {
  /** The page-sized groups': the largest row sum of the inverse of the linear part of a matrix one is drawn under, and the largest coordinate that inverse takes the viewBox's origin to. */
  readonly groups: { readonly inverse: number; readonly origin: number }
  /** The gradients' painted outside every group: the largest entry of the linear part of a matrix one may be drawn under, its shape's box and its own transform included, and the largest coordinate of that matrix's translation less the viewBox's origin. */
  readonly patterns: { readonly linear: number; readonly offset: number }
  /** The largest entry of a matrix the converter may write in a group's own coordinates: a gradient's inside a group, and the box of what a clip in objectBoundingBox units clips. */
  readonly local: number
  /** The largest coordinate of a point the converter draws an outline with, in the outline's own coordinates, a clip path's included. */
  readonly own: number
  /** The deepest the converter nests the graphics state in one content stream: once as it starts, once for the svg, once for every group and every shape, a group's own stream starting again. A clip path's stream nests two, its own save and its shape's (`source.js:2207-2219`), below any shape in the svg's. */
  readonly nesting: number
}

export type { Box }

/** The extent of a drawing, gathered where the walk that counts its cost decides what the converter draws (`svg-cost.ts`). */
export class Extent {
  private readonly origin: readonly [number, number]
  private inverse = 0
  private reach = 0
  private linear = 0
  private offset = 0
  private local = 0
  private own = 0
  private nesting = 0

  constructor(viewBox: ViewBox) {
    this.origin = [viewBox.x, viewBox.y]
  }

  /** A page-sized group, made by an element drawn under `under`. */
  group(under: Matrix): void {
    const [a, b, c, d, e, f] = inverse(under)
    this.inverse = Math.max(this.inverse, Math.abs(a) + Math.abs(c), Math.abs(b) + Math.abs(d))
    const [x, y] = this.origin
    this.reach = Math.max(this.reach, Math.abs(a * x + c * y + e), Math.abs(b * x + d * y + f))
  }

  /** A gradient painted outside every group: the matrices it may be drawn under, from the root. */
  pattern({ least, greatest }: Spread): void {
    const [x, y] = this.origin
    this.linear = Math.max(this.linear, largest([...least.slice(0, 4), ...greatest.slice(0, 4)]))
    this.offset = Math.max(this.offset, Math.abs(least[4] - x), Math.abs(greatest[4] - x), Math.abs(least[5] - y), Math.abs(greatest[5] - y))
  }

  /** A gradient painted inside a group: the matrices it may be drawn under, from where the group began. */
  inGroup({ least, greatest }: Spread): void {
    this.local = Math.max(this.local, largest([...least, ...greatest]))
  }

  /** The box, in the clipped element's own coordinates, that a clip in objectBoundingBox units draws its shapes in: a matrix of the width, height and corner of a box inside it. */
  clipBox([left, top, right, bottom]: Box): void {
    this.local = Math.max(this.local, right - left, bottom - top, largest([left, top, right, bottom]))
  }

  /** An outline the converter draws, inside `box` in its own coordinates. */
  outline(box: Box): void {
    this.own = Math.max(this.own, largest(box))
  }

  /** A save `depth` deep in its stream. */
  nest(depth: number): void {
    this.nesting = Math.max(this.nesting, depth)
  }

  extent(): SvgExtent {
    return {
      groups: { inverse: this.inverse, origin: this.reach },
      patterns: { linear: this.linear, offset: this.offset },
      local: this.local,
      own: this.own,
      nesting: this.nesting,
    }
  }
}

function largest(entries: readonly number[]): number {
  return Math.max(...entries.map(Math.abs))
}
