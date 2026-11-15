import { MAX_SVG_GROUPS, MAX_SVG_SEGMENTS, RenderRefusal, type Image, type ImageAsset } from '@formancy/report-runtime'
import { checkImageAsset, MAX_IMAGE_DATA, MAX_SVG_DRAWING, type CheckedImage, type Vector } from './assets.js'
import { refuseCmyk } from './pdfa-check.js'
import type { PdfA } from './pdfa.js'
import { checkSvgInPdfA, type Paper } from './svg-pdfa.js'

/**
 * What a render's images cost together, judged once the walk (`check.ts`)
 * has found every one and where it stands, and the place each asset is
 * read: apart from the walk, since what a render may hold of images is
 * decided by what they cost, not by where a block may stand.
 */

/** An image the walk found, and whether it is drawn on every page: one in the page header or footer, which pdfmake draws on each. */
export interface PlacedImage {
  readonly image: Image
  readonly everyPage: boolean
}

/**
 * Every image's asset, read once however many images draw it, and what the
 * images cost together, each refusal naming the asset whose image crossed
 * it:
 *
 * - the image data the PNGs and JPEGs hold, once for each asset, against
 *   `MAX_IMAGE_DATA`, as `content-too-large`: each is embedded once;
 * - in a PDF/A, an e-invoice's PDF/A-3b or a PDF/A-2b (`pdfa-check.ts`),
 *   a JPEG PDFKit draws in DeviceCMYK, refused as `unsupported`: the
 *   PDF/A has an sRGB output intent, beside which no image may be CMYK
 *   (veraPDF 6.2.4.3-3), and a second intent would have to share its
 *   profile (6.2.3-2);
 * - in a PDF/A, an image of an SVG whose numbers, at its box and on its
 *   page, could pass the integers a PDF/A holds, or whose drawing nests
 *   the graphics state deeper than one may, refused as `unsupported`
 *   (`svg-pdfa.ts`): each image, since its box decides;
 * - what drawing the SVGs costs the renderer, for every image of one,
 *   against `MAX_SVG_DRAWING`, as `content-too-large`: the converter draws an SVG wherever it
 *   stands, and one in the page header or footer on every page, counted as `maxPages`,
 *   the pages the report may have, which is known before the render; one
 *   in page 1's own header (0060) is drawn on page 1 alone, and counted once;
 * - what the SVGs cost a reader to paint, against `MAX_SVG_SEGMENTS` and
 *   `MAX_SVG_GROUPS`, as `content-too-large`, the bounds of one drawing, measured as what one page
 *   may cost: every SVG image of the body counted as though all of them fell
 *   on one page, beside those of the page regions, which every page draws,
 *   and page 1's own header's. Which page each lands on is known only once
 *   pdfmake has laid the body out.
 */
export async function checkImages(
  images: readonly PlacedImage[],
  maxPages: number,
  pdfa: PdfA | undefined,
  paper: Paper,
): Promise<ReadonlyMap<ImageAsset, CheckedImage>> {
  const assets = new Map<ImageAsset, CheckedImage>()
  const total = { data: 0, units: 0, segments: 0, groups: 0 }
  for (const { image, everyPage } of images) {
    const { id } = image.asset
    let read = assets.get(image.asset)
    if (read === undefined) {
      read = await checkImageAsset(image.asset)
      if (pdfa !== undefined && read.kind === 'raster' && read.cmyk) refuseCmyk(id, pdfa)
      assets.set(image.asset, read)
      total.data += read.kind === 'raster' ? read.data : 0
      if (total.data > MAX_IMAGE_DATA)
        throw new RenderRefusal('content-too-large', `the images up to ${id} hold ${total.data} bytes of image data; a render may hold ${MAX_IMAGE_DATA}`, id)
    }
    if (pdfa !== undefined && read.kind === 'vector') checkSvgInPdfA(read, image, paper, pdfa)
    if (read.kind === 'vector') addVector(total, read, everyPage ? maxPages : 1, id)
  }
  return assets
}

/** One more SVG image, drawn `times` times, added to what the render's SVG images cost; refused past a bound. */
function addVector(total: { units: number; segments: number; groups: number }, vector: Vector, times: number, id: string): void {
  total.units += vector.units * times
  total.segments += vector.segments
  total.groups += vector.groups
  if (total.units > MAX_SVG_DRAWING) {
    throw new RenderRefusal(
      'content-too-large',
      `the SVG images up to ${id} cost ${total.units} units to draw, each in the page header or footer counted on every page the report may have, one in page 1's own header once; a render may draw ${MAX_SVG_DRAWING}`,
      id,
    )
  }
  const onePage = 'on one page, every SVG image of the body counted as though it fell there beside those of the page regions'
  if (total.segments > MAX_SVG_SEGMENTS)
    throw new RenderRefusal(
      'content-too-large',
      `the SVG images up to ${id} would cost a reader ${total.segments} weighted segments to paint ${onePage}; a page may cost ${MAX_SVG_SEGMENTS}`,
      id,
    )
  if (total.groups > MAX_SVG_GROUPS)
    throw new RenderRefusal(
      'content-too-large',
      `the SVG images up to ${id} would make ${total.groups} units of page-sized transparency groups ${onePage}; a page may make ${MAX_SVG_GROUPS}`,
      id,
    )
}
