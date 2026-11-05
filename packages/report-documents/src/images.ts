import { filtersOf, passedOn } from './inflate.js'
import { MAX_DOCUMENT_IMAGE_PIXELS } from './limits.js'
import { isArray, isCount, isDict, isName, isStream, resolved, type PdfDict, type PdfObjects, type PdfStream, type PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'
import { caught, refuse, type DocumentRefusal, type Finding } from './refusals.js'

/**
 * An image as a viewer of the report decodes it, which the reader never
 * does: the pixels it declares -- its width times its height -- held to
 * `MAX_DOCUMENT_IMAGE_PIXELS`, each image alone, and its data passed on as
 * it is written and charged nothing. A stream is an image where it stands
 * as one (closure.ts), never by what it says of itself; an inline image a
 * content stream holds is held to the same count (inline-images.ts), and
 * its colour space's components counted where its rows need them.
 *
 * Its size is read as PDF.js reads it, an XObject's as an inline image's:
 * abbreviated as ISO 32000-1 Table 93 abbreviates it, or in full, and
 * refused where it is given both ways, so that no image declares one size
 * to the reader and another to a viewer. An image XObject's filters are its
 * /Filter's, as every stream's are (inflate.ts).
 */

/** What an image declares a viewer decodes it to. */
export interface ImageSize {
  readonly width: number
  readonly height: number
}

/** The components of each colour space family a name or an array's first name gives, where its family alone says (ISO 32000-1 8.6, Table 94's abbreviations among them). A Map, not an object's keys: /constructor would find what an object's prototype holds. */
const FAMILIES: ReadonlyMap<string, number> = new Map([
  ['DeviceGray', 1],
  ['G', 1],
  ['DeviceRGB', 3],
  ['RGB', 3],
  ['DeviceCMYK', 4],
  ['CMYK', 4],
])

/** The array families whose components their family alone gives: an index into a palette, a tint, and the CIE-based spaces. */
const ARRAYS: ReadonlyMap<string, number> = new Map([...FAMILIES, ['Indexed', 1], ['I', 1], ['Separation', 1], ['CalGray', 1], ['CalRGB', 3], ['Lab', 3]])

/**
 * Internal: what an image's `dict` declares under a key, abbreviated or in
 * full, a reference resolved one level and a reference to no object
 * nothing; refused for what `finding` says where it is given both ways.
 */
export function declared(objects: PdfObjects, dict: PdfDict, short: string, full: string, finding: Finding): PdfValue | PdfStream | undefined {
  const abbreviated = dict.entries.get(short)
  const written = dict.entries.get(full)
  if (abbreviated !== undefined && written !== undefined) refuse(finding)
  return resolved(objects, abbreviated ?? written) ?? undefined
}

/** A width or a height: a whole number from 1. */
function extent(value: PdfValue | PdfStream | undefined): number {
  return isCount(value) && value >= 1 ? value : refuse('image-size')
}

/**
 * The components of the colour space `space` names: a family by its name or
 * as an array's first name; a DeviceN by its colorants, an ICC profile by
 * its /N; a name its `resources` map under /ColorSpace, counted where it
 * stands there. A pattern, which no image is drawn in, and anything else are
 * refused.
 */
function spaceComponents(objects: PdfObjects, written: PdfValue | PdfStream | undefined, resources?: PdfDict): number {
  const space = resolved(objects, written)
  if (isName(space)) {
    const family = FAMILIES.get(space.name)
    if (family !== undefined) return family
    // Looked up once: what the resources name it is counted with none, so that a name there names a family.
    const named = resources === undefined ? undefined : resolved(objects, resources.entries.get('ColorSpace'))
    const entry = isDict(named) ? named.entries.get(space.name) : undefined
    return entry === undefined ? refuse('image-space') : spaceComponents(objects, entry)
  }
  if (!isArray(space)) refuse('image-space')
  // An empty list has no first name.
  const kind = resolved(objects, space[0])
  if (!isName(kind)) refuse('image-space')
  const fixed = ARRAYS.get(kind.name)
  if (fixed !== undefined) return fixed
  if (kind.name === 'DeviceN') {
    const colorants = resolved(objects, space[1])
    return isArray(colorants) && colorants.length > 0 ? colorants.length : refuse('image-space')
  }
  if (kind.name === 'ICCBased') {
    const profile = resolved(objects, space[1])
    const n = isStream(profile) ? resolved(objects, profile.dict.entries.get('N')) : undefined
    return isCount(n) && n >= 1 ? n : refuse('image-space')
  }
  return refuse('image-space')
}

/**
 * Internal: the components a sample of the image `dict` describes has --
 * an image mask's one, whatever else it says, or its colour space's, a name
 * looked for in `resources` -- what an unfiltered inline image's rows are
 * long by; refused where they cannot be counted. Throws the refusal.
 */
export function componentsOf(objects: PdfObjects, dict: PdfDict, resources: PdfDict): number {
  if (declared(objects, dict, 'IM', 'ImageMask', 'image-space') === true) return 1
  return spaceComponents(objects, declared(objects, dict, 'CS', 'ColorSpace', 'image-space'), resources)
}

/** Internal: the size the image `dict` describes declares, held to `MAX_DOCUMENT_IMAGE_PIXELS`. Throws the refusal. */
export function declaredSize(objects: PdfObjects, dict: PdfDict): ImageSize {
  const width = extent(declared(objects, dict, 'W', 'Width', 'image-size'))
  const height = extent(declared(objects, dict, 'H', 'Height', 'image-size'))
  if (width * height > MAX_DOCUMENT_IMAGE_PIXELS) refuse('image-pixels')
  return { width, height }
}

/** Internal: the pixels the image `dict` describes declares, or why they cannot be counted or are too many. */
export function imagePixels(parsed: ParsedDocument, dict: PdfDict): number | DocumentRefusal {
  return caught(() => {
    const { width, height } = declaredSize(parsed.objects, dict)
    return width * height
  })
}

/** Internal: whether an XObject says it is an image, its /Subtype resolved one level, as Do reads it to draw it as one. */
export const isImage = (objects: PdfObjects, stream: PdfStream): boolean => isName(resolved(objects, stream.dict.entries.get('Subtype')), 'Image')

/** Internal: an image the reader passes on undecoded, held to the pixels it declares and to the filters it may be passed on in; throws the refusal. */
export function heldImage(objects: PdfObjects, stream: PdfStream): void {
  passedOn(filtersOf(stream.dict))
  declaredSize(objects, stream.dict)
}
