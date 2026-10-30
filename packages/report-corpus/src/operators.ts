import { OPS, type PageViewport, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PdfBox, PdfPaint, PdfPath } from './read-pdf.js'

/**
 * What a page's operators draw besides its text: each image and where it
 * lands, each path the page paints and in what, each clip that is one
 * rectangle, and the fonts the page sets. Read from the operator list
 * PDF.js builds for the page, following the transformation matrix through
 * `save`, `restore`, `transform` and form XObjects, so each box is where it
 * lands on the page.
 *
 * Two things here keep a claim about a drawing from passing for the wrong
 * reason (0003, 0030):
 * - **A soft mask paints nothing a reader sees.** It says where what is
 *   painted next shows, and pdfmake's SVG converter paints a clip path's
 *   shape into one in white. Everything between a `beginGroup` whose
 *   options carry a soft mask and its `endGroup` is skipped: its paths, its
 *   clips and its images. The fonts it sets are still listed, since a font
 *   the file uses and does not embed is what the embedding check is about.
 * - **A clip is a rectangle by its points, never by its bounding box.** A
 *   diamond has the bounding box of a square. A clip is listed when its
 *   path is one subpath of four corners on the page, joined by lines that
 *   run alternately across and down it.
 *
 * What it does not see: an area painted by a shading operator (`sh`) rather
 * than a path -- PDFKit 0.19.1 and pdfmake's SVG converter paint a gradient
 * as a pattern and never write one -- and a path's stroke, whose width a
 * path's box leaves out.
 */

type Matrix = readonly [number, number, number, number, number, number]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** Six numbers, from an array or a typed array; the identity for none, which is what PDF.js passes for a transparency group's form. */
function matrix(values: ArrayLike<unknown> | null | undefined): Matrix {
  if (values === null || values === undefined) return IDENTITY
  const [a, b, c, d, e, f] = Array.from(values, Number)
  return [a ?? 1, b ?? 0, c ?? 0, d ?? 1, e ?? 0, f ?? 0]
}

/** `m` applied first, then `n`: the matrix a `cm` operator with `m` leaves when the current one is `n`. */
function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

type Point = readonly [number, number]

/** A point in the current user space, on the page: in points from its top left. */
function onPage(ctm: Matrix, viewport: PageViewport, [x, y]: Point): Point {
  return viewport.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]) as [number, number]
}

/** The page box that holds `corners`. */
function boxOf(corners: readonly Point[]): PdfBox {
  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  const x = Math.min(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  return { x, top, bottom, width: Math.max(...xs) - x, height: bottom - top }
}

/** The page box of the rectangle from `x0, y0` to `x1, y1` in user space: an image's unit square, a path's bounds. */
function rectangleBox(ctm: Matrix, viewport: PageViewport, [x0, y0, x1, y1]: readonly [number, number, number, number]): PdfBox {
  return boxOf(
    [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ].map((corner) => onPage(ctm, viewport, corner as unknown as Point)),
  )
}

/** PDF.js's own codes for a path's parts, in the data a `constructPath` carries (`DrawOPS`). */
const MOVE = 0
const LINE = 1
const CLOSE = 4

/** How far apart, in points, two corners of a rectangle may be across the side they share: PDF.js hands paths over as 32-bit floats. */
const SQUARE = 0.01

/**
 * The page box of `data` when it is one rectangle with sides along the
 * page's: a move and three or four lines -- the fourth back to the start --
 * and at most a close, whose four corners turn alternately across and down
 * the page. `re` reaches PDF.js as exactly that, and so does a rectangle
 * written as `m l l l h`, as the SVG converter writes its viewport's clip.
 */
function rectangle(data: ArrayLike<number> | null, ctm: Matrix, viewport: PageViewport): PdfBox | undefined {
  if (data === null) return undefined
  const corners: Point[] = []
  for (let index = 0; index < data.length;) {
    const op = data[index++]
    if (op === CLOSE) {
      if (index !== data.length) return undefined
      break
    }
    if (op !== (corners.length === 0 ? MOVE : LINE)) return undefined
    corners.push(onPage(ctm, viewport, [data[index++]!, data[index++]!]))
  }
  if (corners.length === 5 && Math.hypot(corners[4]![0] - corners[0]![0], corners[4]![1] - corners[0]![1]) <= SQUARE) corners.pop()
  if (corners.length !== 4) return undefined
  const across = (a: Point, b: Point): boolean => Math.abs(a[1] - b[1]) <= SQUARE
  const down = (a: Point, b: Point): boolean => Math.abs(a[0] - b[0]) <= SQUARE
  const [a, b, c, d] = corners as [Point, Point, Point, Point]
  const turns = (across(a, b) && down(b, c) && across(c, d) && down(d, a)) || (down(a, b) && across(b, c) && down(c, d) && across(d, a))
  return turns ? boxOf(corners) : undefined
}

/** How each operator that ends a path paints it; `endPath` paints nothing. */
const PAINTS: ReadonlyMap<number, PdfPath['paint']> = new Map([
  [OPS.fill, 'fill'],
  [OPS.eoFill, 'fill'],
  [OPS.stroke, 'stroke'],
  [OPS.closeStroke, 'stroke'],
  [OPS.fillStroke, 'fillStroke'],
  [OPS.eoFillStroke, 'fillStroke'],
  [OPS.closeFillStroke, 'fillStroke'],
  [OPS.closeEOFillStroke, 'fillStroke'],
])

interface State {
  ctm: Matrix
  /** The innermost rectangular clip in force, by its index among the page's clips. */
  clip: number | undefined
  fill: PdfPaint
  stroke: PdfPaint
}

export interface Drawn {
  readonly images: PdfBox[]
  readonly paths: PdfPath[]
  readonly clips: PdfBox[]
  readonly fontIds: Set<string>
}

/**
 * Every image, painted path and rectangular clip on `page`, and the fonts
 * it sets. The list is the page's own operators: PDF.js merges runs of
 * images into one operation only when it renders, never in the list
 * `getOperatorList` returns, so every image drawn is one paint here.
 */
export async function drawnOn(page: PDFPageProxy, viewport: PageViewport): Promise<Drawn> {
  const { fnArray, argsArray } = await page.getOperatorList()
  const drawn: Drawn = { images: [], paths: [], clips: [], fontIds: new Set() }
  const stack: State[] = []
  let state: State = { ctm: IDENTITY, clip: undefined, fill: '#000000', stroke: '#000000' }
  let clipping = false
  /** How many groups deep inside a soft mask the walk is; 0 outside one. */
  let masked = 0
  for (let index = 0; index < fnArray.length; index++) {
    const fn = fnArray[index]
    const args = argsArray[index] as unknown[]
    if (fn === OPS.setFont) drawn.fontIds.add(args[0] as string)
    if (masked > 0) {
      if (fn === OPS.beginGroup) masked++
      if (fn === OPS.endGroup) masked--
      continue
    }
    switch (fn) {
      case OPS.beginGroup:
        if ((args[0] as { smask?: unknown }).smask) masked = 1
        break
      case OPS.save:
        stack.push({ ...state })
        break
      case OPS.restore:
      case OPS.paintFormXObjectEnd:
        state = stack.pop() ?? { ...state, ctm: IDENTITY }
        break
      case OPS.transform:
        state.ctm = multiply(matrix(args), state.ctm)
        break
      case OPS.paintFormXObjectBegin:
        // The form's own matrix, which PDF.js passes as a typed array, and as nothing for a transparency group's.
        stack.push({ ...state })
        state.ctm = multiply(matrix(args[0] as ArrayLike<number> | null), state.ctm)
        break
      case OPS.setFillRGBColor:
        state.fill = args[0] as PdfPaint
        break
      case OPS.setStrokeRGBColor:
        state.stroke = args[0] as PdfPaint
        break
      // PDF.js turns every other colour into an RGB one; what reaches these is a pattern or a shading.
      case OPS.setFillColorN:
        state.fill = 'pattern'
        break
      case OPS.setStrokeColorN:
        state.stroke = 'pattern'
        break
      case OPS.clip:
      case OPS.eoClip:
        clipping = true
        break
      case OPS.constructPath:
        paintPath(args as unknown as PathArgs, state, viewport, drawn, clipping)
        clipping = false
        break
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        drawn.images.push(rectangleBox(state.ctm, viewport, [0, 0, 1, 1]))
        break
    }
  }
  return drawn
}

/** What PDF.js 6 hands a `constructPath`: the operator that ends the path, the path as `DrawOPS` data, and its bounds in user space. */
type PathArgs = readonly [number, readonly (ArrayLike<number> | null)[], ArrayLike<number> | null]

/** The path a `constructPath` ends: a clip when one was asked for and it is a rectangle, and a painted path when it is painted. */
function paintPath([op, [data], bounds]: PathArgs, state: State, viewport: PageViewport, drawn: Drawn, clipping: boolean): void {
  // The clip applies once the path ends, so the path that sets it is painted, if at all, inside the clip before it.
  const inside = state.clip
  if (clipping) {
    const box = rectangle(data ?? null, state.ctm, viewport)
    if (box !== undefined) state.clip = drawn.clips.push(box) - 1
  }
  const paint = PAINTS.get(op)
  if (paint === undefined || bounds === null) return
  const [x0, y0, x1, y1] = Array.from(bounds) as [number, number, number, number]
  drawn.paths.push({
    ...rectangleBox(state.ctm, viewport, [x0, y0, x1, y1]),
    paint,
    ...(paint === 'stroke' ? {} : { fill: state.fill }),
    ...(paint === 'fill' ? {} : { stroke: state.stroke }),
    ...(inside === undefined ? {} : { clip: inside }),
  })
}
