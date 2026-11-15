import { EDGE, plural, points } from './check-page.js'
import type { Expectation, ExpectedDrawing, ExpectedImage } from './fixture.js'
import type { PdfBox, PdfPage, PdfPath, ReadPdf } from './read-pdf.js'

/**
 * Where each drawing is drawn: an SVG image (0030), and a chart ECharts
 * laid out (0058). pdfmake's SVG converter clips a drawing to its
 * viewport, which the renderer makes the drawing's box, and paints its
 * paths inside that clip; so a drawing is found as a rectangular clip of
 * its size that a painted path stands inside (`PdfPath.clip`), never as an
 * image, of which the PDF has none for it. Its box on the page is that
 * clip's, and the margin and overlap checks read an SVG image's as they
 * read an image's. A chart's clip holds the clips set inside it as well:
 * a path's clip is the innermost, and a clip of the plot would hold its
 * marks (C14), though svg-to-pdfkit, the SVG converter pdfmake 0.3.11
 * vendors, draws ECharts' clip of a series as a soft mask, which sets no
 * clip (`operators.ts`).
 *
 * What it rests on, and what it does not see:
 * - **A drawing is known by its size and its paint.** Another drawing of
 *   the same size -- a QR code, which the renderer draws as an SVG too --
 *   could stand in for one. Clips nothing matches are not problems: a QR
 *   code's is one. But a chart's clip is claimed once: a clip of a placed
 *   chart's size that no drawing took and that holds a path in one of its
 *   series' or slices' paints is the chart drawn twice, and is said. An
 *   SVG image drawn twice is not seen.
 * - **The order is the document's.** A page region's SVG images are found
 *   on each page first; then the body's SVG images and charts, in one walk
 *   in document order through every container, each after the one before,
 *   so that an image and a chart of one size never take each other's
 *   clip. Columns that break across pages break that order: a column's
 *   drawing may stand on a later page than the next column's.
 * - **Inside the box is the pixels' to say.** A path painted inside a clip
 *   may reach past it -- `cover` does, and the clip hides the rest -- so
 *   that nothing of a drawing shows past its box is `check-ink.ts`'s.
 */

/** A chart as it is drawn on a page: its id, its clip's box, and the clips that are its own -- its clip and each set inside it -- by their indices among the page's. */
export interface PlacedChart {
  readonly id: string
  readonly box: PdfBox
  readonly clips: ReadonlySet<number>
}

/** Each page's SVG image boxes and charts, as the checks read them, and what is wrong with where they are. */
export interface PlacedDrawings {
  readonly boxes: readonly (readonly PdfBox[])[]
  readonly charts: readonly (readonly PlacedChart[])[]
  readonly problems: readonly string[]
}

/** A rectangular clip on a page, whether a path is painted inside it, and whether a drawing has been found in it. */
interface Clip {
  readonly page: number
  readonly index: number
  readonly box: PdfBox
  readonly painted: boolean
  used: boolean
}

/** How many of the clips that do hold paint a problem lists, when none is of the size sought. */
const LISTED = 5

/** The drawings `expected` holds, found among `pdf`'s clips. */
export function placeDrawings(pdf: ReadPdf, expected: Expectation): PlacedDrawings {
  const vector = (images: readonly ExpectedImage[]): ExpectedImage[] => images.filter((image) => image.kind === 'vector')
  const regions = vector(expected.pageRegionImages)
  const boxes: PdfBox[][] = pdf.pages.map(() => [])
  const charts: PlacedChart[][] = pdf.pages.map(() => [])
  const clips: Clip[] = pdf.pages.flatMap((page) =>
    page.clips.map((box, index) => ({ page: page.number, index, box, painted: page.paths.some((path) => path.clip === index), used: false })),
  )
  const problems: string[] = []
  const take = (clip: Clip): void => {
    clip.used = true
    boxes[clip.page - 1]!.push(clip.box)
  }
  for (const page of pdf.pages) {
    const onPage = clips.filter((clip) => clip.page === page.number)
    for (const [index, image] of regions.entries()) {
      const found = onPage.find((clip) => !clip.used && clip.painted && sized(clip.box, image))
      if (found === undefined) problems.push(`page ${page.number}: ${missing(`the SVG image ${index + 1} of the page regions`, image, onPage)}`)
      else take(found)
    }
  }
  // Each of the body's after the one before it; one not found leaves the next to be sought from the same place.
  let [next, images] = [0, 0]
  for (const drawing of expected.drawings) {
    const what = drawing.kind === 'image' ? `the SVG image ${++images} of the body` : `the chart ${drawing.id}`
    const after = clips.slice(next)
    const at = after.findIndex((clip, offset) => !clip.used && sized(clip.box, drawing) && painted(drawing, clip, after.slice(offset + 1)) > 0)
    if (at < 0) {
      problems.push(missing(what, drawing, after))
      continue
    }
    const found = after[at]!
    const own = after.slice(at, at + painted(drawing, found, after.slice(at + 1)))
    next += at + own.length
    if (drawing.kind === 'image') take(found)
    else {
      for (const clip of own) clip.used = true
      charts[found.page - 1]!.push({ id: drawing.id, box: found.box, clips: new Set(own.map(({ index }) => index)) })
    }
  }
  return { boxes, charts, problems: [...problems, ...drawnTwice(pdf, expected, charts, clips)] }
}

/**
 * A chart drawn a second time: a clip of a placed chart's size that no
 * drawing took, holding a path in one of that chart's marks' paints. A
 * chart's clip is claimed once, and its copy prints its data twice where
 * the document draws it once. A clip of its size in another paint is no
 * chart's -- a QR code's is one -- unless a series is painted in it.
 */
function drawnTwice(pdf: ReadPdf, expected: Expectation, charts: readonly (readonly PlacedChart[])[], clips: readonly Clip[]): string[] {
  const left = clips.filter((clip) => !clip.used && clip.painted)
  return charts.flat().flatMap(({ id, box }) => {
    const paints = new Set(expected.charts.find((chart) => chart.id === id)?.marks.map(({ paint }) => paint.toLowerCase()))
    const copy = left.find(
      (clip) =>
        sized(clip.box, box) &&
        pdf.pages[clip.page - 1]!.paths.some(
          (path) => path.clip === clip.index && [path.fill, path.stroke].some((paint) => paint !== undefined && paints.has(paint.toLowerCase())),
        ),
    )
    if (copy === undefined) return []
    copy.used = true
    return [`page ${copy.page}: the chart ${id} is drawn twice: a second clip of its size, at ${points(copy.box.x)}, ${points(copy.box.top)}, holds its paint`]
  })
}

/**
 * How many clips from `first` on are `drawing`'s, `after` those that
 * follow it, where a path is painted inside one of them, and 0 where none
 * is: an SVG image's own clip; a chart's, and each after it on its page
 * set inside it.
 */
function painted(drawing: ExpectedDrawing, first: Clip, after: readonly Clip[]): number {
  if (drawing.kind === 'image') return first.painted ? 1 : 0
  const outside = after.findIndex((clip) => clip.page !== first.page || !within(clip.box, first.box))
  const own = [first, ...(outside < 0 ? after : after.slice(0, outside))]
  return own.some((clip) => clip.painted) ? own.length : 0
}

/** Whether `inner` lies inside `outer`, give or take `EDGE`. */
const within = (inner: PdfBox, outer: PdfBox): boolean =>
  inner.x >= outer.x - EDGE && inner.x + inner.width <= outer.x + outer.width + EDGE && inner.top >= outer.top - EDGE && inner.bottom <= outer.bottom + EDGE

function sized(box: PdfBox, { width, height }: { readonly width: number; readonly height: number }): boolean {
  return Math.abs(box.width - width) <= EDGE && Math.abs(box.height - height) <= EDGE
}

/** Why `drawing` was not found among `clips`: a clip of its size with nothing painted inside it, or no clip of its size, and then the sizes of those that hold paint. */
function missing(what: string, drawing: { readonly width: number; readonly height: number }, clips: readonly Clip[]): string {
  const size = `${points(drawing.width)} × ${points(drawing.height)} pt`
  const empty = clips.find((clip) => !clip.used && sized(clip.box, drawing))
  if (empty !== undefined)
    return `${what}, ${size}, has its clip at ${points(empty.box.x)}, ${points(empty.box.top)} on page ${empty.page}, and nothing painted inside it`
  const others = clips.filter((clip) => !clip.used && clip.painted)
  const listed = others.slice(0, LISTED).map((clip) => `${points(clip.box.width)} × ${points(clip.box.height)} pt on page ${clip.page}`)
  const more = others.length > LISTED ? ` and ${plural(others.length - LISTED, 'other')}` : ''
  return `${what}, ${size}, is not drawn: no clip of its size holds a painted path${listed.length === 0 ? '' : `; the clips that do are ${listed.join(', ')}${more}`}`
}

/**
 * A drawing on a page as a picture's manifest records it (0032): a
 * rectangular clip a painted path stands inside -- an SVG image, a QR
 * code -- with the clip's box, `[x, top, width, height]` to the hundredth
 * of a point; the paints of its paths, sorted; and each of its paths, in
 * the order the page paints them, as its paint and its box to the
 * hundredth: `fill #1f4e79 [58.11, 58.11, 39.69, 39.69]`. A path's box is
 * its points' (`PdfPath`), so a path redrawn with every point inside its
 * old box is the same path here; a path no rectangle clips -- a rule, a
 * border -- belongs to no drawing.
 */
export interface Drawing {
  readonly box: readonly [number, number, number, number]
  readonly paints: readonly string[]
  readonly paths: readonly string[]
}

const hundredth = (value: number): number => Math.round(value * 100) / 100

/** A path as a drawing records it: how it is painted, in what, and its box to the hundredth. */
function pathOf(path: PdfPath): string {
  const paint = [path.fill === undefined ? undefined : `fill ${path.fill}`, path.stroke === undefined ? undefined : `stroke ${path.stroke}`].filter(
    (part) => part !== undefined,
  )
  return `${paint.join(' ')} [${[path.x, path.top, path.width, path.height].map(hundredth).join(', ')}]`
}

/** Every drawing on `page`, in the order the page sets their clips: each clip a painted path stands inside. */
export function drawingsOn(page: PdfPage): Drawing[] {
  return page.clips.flatMap((clip, index) => {
    const paths = page.paths.filter((path) => path.clip === index)
    if (paths.length === 0) return []
    const paints = [...new Set(paths.flatMap((path) => [path.fill, path.stroke]).filter((paint) => paint !== undefined))].sort()
    return [{ box: [hundredth(clip.x), hundredth(clip.top), hundredth(clip.width), hundredth(clip.height)] as const, paints, paths: paths.map(pathOf) }]
  })
}
