import { RenderRefusal, type Image, type ImageAsset } from '@formancy/report-runtime'
import { drawnSize, readPicture, type Held, type Picture } from './assets.js'
import { shown } from './check-units.js'
import { MAX_DOCX_PICTURES } from './limits.js'
import { emu } from './units.js'

/**
 * A file's pictures, held before a byte is written (0068) once the walk
 * (`check.ts`) has met every image: apart from the walk, since what a
 * file may hold of pictures is decided by what they cost together and by
 * what each asset's bytes are, not by where a block stands.
 *
 * It changes when what a file's pictures may cost together does, or what
 * an image is held to of the picture it draws. What one asset's bytes are
 * held to is `assets.ts`'s.
 */

/**
 * Every image's asset as it is embedded, read once however many images
 * draw it, in the order the walk met them and once it has walked every
 * block: where the PDF renderer reads them (`check-images.ts` there), so
 * that a document wrong in a block and in a picture's bytes is refused
 * for the block by both.
 *
 * Each new asset is counted before it is read, and refused past
 * `MAX_DOCX_PICTURES`; then read with what the pictures before it hold
 * (`assets.ts`), and refused where its bytes and theirs are past
 * `MAX_DOCX_MEDIA_BYTES`, counted from its length before a byte of it
 * is read, where its bytes are no picture, where its image data and
 * theirs are past `MAX_DOCX_IMAGE_DATA`, counted from its header before
 * a PNG's is inflated, or where it is a picture nobody has seen Word
 * print as the PDF does. Then each
 * image is held to its picture: an SVG to a box of its own proportions
 * where it covers one, and any picture to an extent Word's unit states.
 */
export function readPictures(images: readonly Image[]): Map<ImageAsset, Picture> {
  const pictures = new Map<ImageAsset, Picture>()
  let held: Held = { bytes: 0, data: 0 }
  for (const image of images) {
    const { id } = image.asset
    let picture = pictures.get(image.asset)
    if (picture === undefined) {
      if (pictures.size === MAX_DOCX_PICTURES)
        throw new RenderRefusal(
          'content-too-large',
          `the report holds more than ${MAX_DOCX_PICTURES} pictures, ${id} the first past them; a Word file holds no more`,
          id,
        )
      picture = readPicture(image.asset, held)
      pictures.set(image.asset, picture)
      held = { bytes: held.bytes + image.asset.bytes.length, data: held.data + picture.data }
    }
    // An SVG is drawn whole in its picture's box: one that covers a box of other proportions would have to be cropped.
    if (
      picture.kind === 'svg' &&
      image.fit === 'cover' &&
      Math.abs(picture.width * image.height - picture.height * image.width) > 1e-6 * picture.width * image.height
    )
      throw new RenderRefusal(
        'unsupported',
        `the image ${id} is an SVG that covers a box of other proportions than its own, which needs the drawing cropped; whether Word crops one as the PDF does is not known here: a Word file holds an SVG at its own proportions alone`,
        id,
      )
    // A picture's extent is stated in English Metric Units: one that rounds to none would be a picture of no extent.
    const { width, height } = drawnSize(image, picture)
    if (emu(width) < 1 || emu(height) < 1)
      throw new RenderRefusal(
        'unsupported',
        `the image ${id} is drawn ${shown(width)} × ${shown(height)} pt, under the unit a Word file states a picture's extent in, 12,700 to the point: the PDF draws it, and what Word draws of a picture of no extent is not known here`,
        id,
      )
  }
  return pictures
}
