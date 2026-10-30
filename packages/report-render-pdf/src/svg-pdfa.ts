import { MAX_SVG_COORDINATE, MAX_SVG_DEPTH, RenderRefusal, type Image } from '@formancy/report-runtime'
import type { Vector } from './assets.js'

/**
 * An SVG in an e-invoice (0030, beside 0031): what the PDF/A-3 an e-invoice
 * is drawn as holds an image of one to, checked before pdfmake runs. PDF/A-2
 * and -3 make ISO 32000-1's implementation limits requirements (ISO
 * 19005-2, 6.1.13): no integer past 2,147,483,647 in magnitude, and the
 * graphics state nested no deeper than 28. PDFKit writes a whole number
 * with no point, as an integer (pdfkit.js 173-178), and svg-to-pdfkit
 * computes some of its numbers through the inverse of the drawing's matrix
 * and the image's box: a drawing whose clip and transparency are shrunk a
 * millionfold, drawn a point square, wrote a group's /BBox of
 * 78,520,000,000 into an e-invoice that said it was a PDF/A-3b, which
 * veraPDF 1.30.3 failed on its rule 6.1.13-1 (measured 18 October 2026).
 *
 * So the check bounds, from above, every number the converter writes for
 * an image -- from report-spec's extent of the drawing (`svg-extent.ts`),
 * the image's box and fit, and the page, the image standing anywhere on it,
 * since where pdfmake puts it is not known before it runs -- and refuses an
 * image whose bound passes `SVG_INTEGER_BOUND`, or whose drawing nests
 * deeper than `PDF_A_NESTING`, as `unsupported`, naming it and saying what
 * to do. pdfmake draws an image in the page's own stream, whether it stands
 * in the body, a page region, a section, columns or a keep-together block,
 * and nests nothing around it (measured that day with veraPDF), so the
 * drawing's nesting is the stream's. A report that is no e-invoice is no
 * PDF/A, and draws such an image as it always did.
 */

/** The largest integer, in magnitude, a PDF/A-2 or -3 may hold (ISO 19005-2, 6.1.13; veraPDF's rule 6.1.13-1). A real may reach 3.403 × 10^38, past the 10^21 at which PDFKit throws. */
export const PDF_A_INTEGER = 2_147_483_647

/** The deepest a PDF/A-2 or -3 may nest the graphics state, q inside q (ISO 19005-2, 6.1.13; veraPDF's rule 6.1.13-8). */
export const PDF_A_NESTING = 28

/**
 * What floating point may put between the bound and what the converter
 * writes, relative, derived and not measured. The groups' term is computed
 * from the matrix the cleaner composed, and the converter composes the same
 * matrices in its own order, the page's flip and the fit's scale first, and
 * inverts the product to find a group's box. Below the svg at most
 * `MAX_SVG_DEPTH` - 1 elements bring a matrix each, and the fit comes
 * before them, so the product is at most `MAX_SVG_DEPTH` products (the
 * flip is exact); an entry of a product's linear part is two products
 * summed, so each rounds it at most twice, by 2^-53 of an entry that no
 * cancellation shrank: 2 × `MAX_SVG_DEPTH` units. Inverting magnifies that
 * by the matrix's condition number, at most 4 × `MAX_SVG_COORDINATE`² for
 * a matrix whose entries and whose inverse's are each at most
 * `MAX_SVG_COORDINATE`, as the cleaner's `compose` holds them; and twice
 * that, for the two computations: 2 × 4 × 10^12 × 2 × 32 × 2^-53, 5.7 %.
 * The other terms invert nothing, and lose less. Not bounded by it:
 * matrices built to cancel one another term by term, whose products
 * floating point gets wrong in both (0030).
 */
export const SVG_INTEGER_MARGIN = 2 * (4 * MAX_SVG_COORDINATE ** 2) * (2 * MAX_SVG_DEPTH) * 2 ** -53

/** The largest an SVG's numbers may be bounded at in an e-invoice: `PDF_A_INTEGER` less `SVG_INTEGER_MARGIN`. */
export const SVG_INTEGER_BOUND = Math.floor(PDF_A_INTEGER * (1 - SVG_INTEGER_MARGIN))

/**
 * What the converter writes of the drawing besides its outlines' points,
 * which the extent's `own` holds: each element's own matrix, a stroke's
 * width and dashes, a gradient's ends, each a number the cleaner holds to
 * `MAX_SVG_COORDINATE`; and a radial gradient's focus, which the converter
 * moves inside its circle (`source.js:1884-1888`), within twice it.
 */
const WRITTEN = 2 * MAX_SVG_COORDINATE

/** The paper, in points. */
export interface Paper {
  readonly paperWidth: number
  readonly paperHeight: number
}

/**
 * The largest magnitude, from above, of a number svg-to-pdfkit writes for
 * `vector` drawn as `image` anywhere on `paper`. The converter fits the
 * viewBox to the box with a scale `s` and the offset `d` that centres it
 * (`parseAspectRatio`, source.js:624-637); PDFKit's page matrix flips the
 * page, and the image's corner is somewhere on it. So a page corner, back
 * through the page and the image's corner, is at most the page's longer
 * side away from it in each coordinate, and back through the fit at most
 * that and `d`, over `s`, from the viewBox's origin. Then:
 *
 * - the fit itself is written as `s`, and `d` less `s` times the origin;
 * - a group's /BBox is that through the inverse of its matrix: at most
 *   where the inverse takes the origin, and its row sum times the rest;
 * - a gradient's /Matrix outside every group is the page's and the fit's
 *   times its own: `s` times its linear part, and its translation from the
 *   origin `s` times as far from the image's corner, `d` and the page's
 *   side further;
 * - a gradient's inside a group, and a clip's box, are the drawing's own,
 *   wherever it stands: `local`;
 * - the outlines' points are written in their own coordinates: `own`.
 */
export function svgReach(vector: Vector, image: Pick<Image, 'width' | 'height' | 'fit'>, paper: Paper): number {
  return Math.max(placed(vector, image, paper), outlines(vector))
}

/** The numbers the drawing itself writes, wherever it is placed: its outlines' points, and the rest at `WRITTEN`. */
function outlines({ extent }: Vector): number {
  return Math.max(WRITTEN, extent.own)
}

/** The numbers that grow with where the drawing is placed and how large: `svgReach`'s fit, groups, gradients and what is written in a group's own coordinates. */
function placed(vector: Vector, image: Pick<Image, 'width' | 'height' | 'fit'>, paper: Paper): number {
  const { extent } = vector
  const across = { x: image.width / vector.width, y: image.height / vector.height }
  const s = image.fit === 'cover' ? Math.max(across.x, across.y) : Math.min(across.x, across.y)
  const dx = (image.width - vector.width * s) / 2
  const dy = (image.height - vector.height * s) / 2
  const side = Math.max(paper.paperWidth, paper.paperHeight)
  const d = Math.max(Math.abs(dx), Math.abs(dy))
  const fit = Math.max(s, Math.abs(dx - s * vector.x), Math.abs(dy - s * vector.y))
  const groups = extent.groups.inverse === 0 ? 0 : extent.groups.origin + (extent.groups.inverse * (side + d)) / s
  const patterns = Math.max(s * extent.patterns.linear, extent.patterns.linear === 0 ? 0 : side + s * extent.patterns.offset + d)
  return Math.max(fit, groups, patterns, extent.local)
}

/** Refuses `image`, an SVG of `vector`, where an e-invoice's PDF/A-3 cannot hold what the converter writes for it on `paper`. */
export function checkSvgInEInvoice(vector: Vector, image: Image, paper: Paper): void {
  const { id } = image.asset
  if (vector.extent.nesting > PDF_A_NESTING) {
    throw new RenderRefusal(
      'unsupported',
      `the image ${id} is an SVG that pdfmake's converter draws ${vector.extent.nesting} graphics states deep, and an e-invoice is drawn as a PDF/A-3, which nests them ${PDF_A_NESTING} deep at most: flatten the groups it nests`,
      id,
    )
  }
  const own = outlines(vector)
  const reach = Math.max(own, placed(vector, image, paper))
  if (reach > SVG_INTEGER_BOUND) {
    const advice =
      own === reach
        ? 'save it again from the drawing program, its arcs drawn with radii that reach their ends and its smooth curves with control points of their own'
        : 'draw it larger, or flatten the transforms under its clips, its transparency and its gradients'
    throw new RenderRefusal(
      'unsupported',
      `the image ${id} is an SVG whose numbers, drawn ${image.width} × ${image.height} pt, could reach ${Math.ceil(reach)}, and an e-invoice is drawn as a PDF/A-3, which holds an integer to ${PDF_A_INTEGER}, ${SVG_INTEGER_BOUND} with the renderer's margin for rounding: ${advice}`,
      id,
    )
  }
}
