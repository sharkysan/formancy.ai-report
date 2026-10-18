import { EDGE, plural, points } from './check-page.js'
import type { Expectation, ExpectedImage } from './fixture.js'
import type { PdfBox, ReadPdf } from './read-pdf.js'

/**
 * Where each SVG image is drawn (0030). pdfmake's SVG converter clips a
 * drawing to its viewport, which the renderer makes the image's box, and
 * paints its paths inside that clip; so an SVG image is found as a
 * rectangular clip of its size that a painted path stands inside
 * (`PdfPath.clip`), never as an image, of which the PDF has none for it.
 * Its box on the page is that clip's, and the margin and overlap checks
 * read it as they read an image's.
 *
 * What it rests on, and what it does not see:
 * - **A drawing is known by its size and its paint.** Another drawing of
 *   the same size -- a QR code, which the renderer draws as an SVG too --
 *   could stand in for one. Clips nothing matches are not problems: a QR
 *   code's is one.
 * - **The order is the pages'.** A page region's drawings are found on each
 *   page first, then the body's in document order, each after the one
 *   before.
 * - **Inside the box is the pixels' to say.** A path painted inside a clip
 *   may reach past it -- `cover` does, and the clip hides the rest -- so
 *   that nothing of a drawing shows past its box is `check-ink.ts`'s.
 */

/** Each page's SVG image boxes, as the checks read them, and what is wrong with where they are. */
export interface PlacedDrawings {
  readonly boxes: readonly (readonly PdfBox[])[]
  readonly problems: readonly string[]
}

/** A rectangular clip on a page, whether a path is painted inside it, and whether a drawing has been found in it. */
interface Clip {
  readonly page: number
  readonly box: PdfBox
  readonly painted: boolean
  used: boolean
}

/** How many of the clips that do hold paint a problem lists, when none is of the size sought. */
const LISTED = 5

/** The SVG images `expected` holds, found among `pdf`'s clips. */
export function placeDrawings(pdf: ReadPdf, expected: Expectation): PlacedDrawings {
  const vector = (images: readonly ExpectedImage[]): ExpectedImage[] => images.filter((image) => image.kind === 'vector')
  const [regions, body] = [vector(expected.pageRegionImages), vector(expected.images)]
  const boxes: PdfBox[][] = pdf.pages.map(() => [])
  const clips: Clip[] = pdf.pages.flatMap((page) => page.clips.map((box, index) => ({ page: page.number, box, painted: page.paths.some((path) => path.clip === index), used: false })))
  const problems: string[] = []
  const take = (clip: Clip): void => {
    clip.used = true
    boxes[clip.page - 1]!.push(clip.box)
  }
  for (const page of pdf.pages) {
    const onPage = clips.filter((clip) => clip.page === page.number)
    for (const [index, image] of regions.entries()) {
      const found = onPage.find((clip) => fits(clip, image))
      if (found === undefined) problems.push(`page ${page.number}: ${missing(`the SVG image ${index + 1} of the page regions`, image, onPage)}`)
      else take(found)
    }
  }
  // Each of the body's after the one before it; one not found leaves the next to be sought from the same place.
  let next = 0
  for (const [index, image] of body.entries()) {
    const after = clips.slice(next)
    const found = after.find((clip) => fits(clip, image))
    if (found === undefined) {
      problems.push(missing(`the SVG image ${index + 1} of the body`, image, after))
      continue
    }
    take(found)
    next = clips.indexOf(found) + 1
  }
  return { boxes, problems }
}

function fits(clip: Clip, image: ExpectedImage): boolean {
  return !clip.used && clip.painted && sized(clip.box, image)
}

function sized(box: PdfBox, { width, height }: ExpectedImage): boolean {
  return Math.abs(box.width - width) <= EDGE && Math.abs(box.height - height) <= EDGE
}

/** Why `image` was not found among `clips`: a clip of its size with nothing painted in it, or no clip of its size, and then the sizes of those that hold paint. */
function missing(what: string, image: ExpectedImage, clips: readonly Clip[]): string {
  const size = `${points(image.width)} × ${points(image.height)} pt`
  const empty = clips.find((clip) => !clip.used && sized(clip.box, image))
  if (empty !== undefined) return `${what}, ${size}, has its clip at ${points(empty.box.x)}, ${points(empty.box.top)} on page ${empty.page}, and nothing painted inside it`
  const others = clips.filter((clip) => !clip.used && clip.painted)
  const listed = others.slice(0, LISTED).map((clip) => `${points(clip.box.width)} × ${points(clip.box.height)} pt on page ${clip.page}`)
  const more = others.length > LISTED ? ` and ${plural(others.length - LISTED, 'other')}` : ''
  return `${what}, ${size}, is not drawn: no clip of its size holds a painted path${listed.length === 0 ? '' : `; the clips that do are ${listed.join(', ')}${more}`}`
}
