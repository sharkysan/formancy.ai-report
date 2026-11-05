import { heldImage, isImage } from './images.js'
import { decodedBytes } from './inflate.js'
import { heldInlineImages, ownResources } from './inline-images.js'
import { MAX_DOCUMENT_OBJECTS } from './limits.js'
import { isArray, isDict, isName, isRef, isStream, resolved, type PdfDict, type PdfObjects, type PdfStream, type PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'
import { caught, refuse, type DocumentRefusal } from './refusals.js'

/**
 * The closure: every object a document's pages draw with, by the number a
 * reference names it by, reached from what they draw with -- their
 * resources, their groups, their appearances' forms. What a renderer
 * copies into a report's PDF beside the pages it places.
 *
 * Walked without recursion: each object is reached once, and each array
 * and dictionary walked once for each way it is read, so that a font two
 * pages share is one object, a direct /Resources a thousand pages inherit
 * is walked once, and a chain of any length is walked as far as the bound.
 * Each object is counted against `MAX_DOCUMENT_OBJECTS` as it is reached,
 * before it is kept. Each stream is read as a viewer of the report will
 * read it where it stands, and none is kept decoded: an image -- an
 * XObject that says it is one, a soft mask, a stencil mask, an alternate
 * a printing viewer may print in its place -- is held to the pixels it
 * declares and passed on undecoded, charged nothing
 * (images.ts); content -- a form's, a tiling pattern's, a Type 3 glyph's,
 * a soft mask's group's -- is decoded once, from the document's one
 * budget, and its inline images held as a page's are (inline-images.ts);
 * anything else -- a font file, a function, an ICC profile -- is decoded
 * once from the same budget, whatever it says of itself. A stream that
 * stands in two such places is read as each. A page is never part of it:
 * a resource that reaches one is refused. Nor is a layer: a dictionary
 * marked as belonging to one (/OC), or a layer's own (/Type /OCG or
 * /OCMD), is refused, as the pages refuse a catalog that says the document
 * has layers.
 */

/**
 * How the walk reads a value: as any value; as a /Resources dictionary,
 * whose maps of names it reads as name maps; as a name map, whose keys are
 * names a content stream or an encoding chose; as a Type 3 font's glyphs,
 * or a resources' XObjects, name maps whose every value is drawn as content
 * or as an XObject; as an image's alternates, a list of alternate image
 * dictionaries, each read as any value but for its /Image; and, where a
 * stream stands, as content a viewer draws whatever the stream says of
 * itself, as an XObject, which its /Subtype makes an image or a form as
 * Do reads it, or as an image -- a mask, an alternate's /Image -- a viewer
 * decodes whatever it says. Any other value in one of those three places
 * is read as any value.
 */
const VALUE = 0
const RESOURCES = 1
const NAMES = 2
const GLYPHS = 3
const XOBJECTS = 4
const ALTERNATES = 5
const ALTERNATE = 6
const CONTENT = 7
const XOBJECT = 8
const IMAGE = 9
type Walked = typeof VALUE | typeof RESOURCES | typeof NAMES | typeof GLYPHS | typeof XOBJECTS | typeof ALTERNATES | typeof ALTERNATE
/** The readings of where a stream stands: a container there is read as any value. */
type Reading = Walked | typeof CONTENT | typeof XOBJECT | typeof IMAGE

/** The entries of a /Resources dictionary that map names a content stream chooses to what it draws (ISO 32000-1 7.8.3). */
const NAME_MAPS: ReadonlySet<string> = new Set(['ExtGState', 'ColorSpace', 'Pattern', 'Shading', 'XObject', 'Font', 'Properties'])

/**
 * Keys the closure does not follow, where they are keys: /Parent and /P
 * lead back into the document -- a field's parent, an annotation's page, a
 * structure element's parent -- and /Metadata and /PieceInfo print nothing:
 * XMP for a program that catalogues the file, and private data for the
 * program that wrote it. A reference under one of them names an object the
 * closure does not hold, as a reference that names no object does. In a
 * name map -- each map of a /Resources dictionary, a Type 3 font's
 * /CharProcs, a DeviceN's /Colorants and its mixing hints' /Solidities and
 * /DotGain, and an ExtGState's halftone under /HT, each keyed by names the
 * file chose -- they are names, like /OC there, and every value is
 * followed: a form named /P is held to every guard a form named /X is, a
 * glyph named /P is drawn and read for its inline images, and a spot
 * colour named /P keeps its tint function and its screen. A dictionary is
 * a name map by where it stands, never by what it says of itself.
 */
const NOT_FOLLOWED: ReadonlySet<string> = new Set(['Parent', 'P', 'Metadata', 'PieceInfo'])

/**
 * Keys whose value is a name map wherever they stand: a DeviceN attributes
 * dictionary's /Colorants and its mixing hints' /Solidities and /DotGain,
 * keyed by colorant names; and an ExtGState's /HT, a halftone that a type 5
 * keys by the colorants it screens. Read so whatever its type, a halftone
 * has every key followed, which fails closed: it holds no resources, no
 * layer and nothing drawn as a form. A Type 3 font's /CharProcs is a name
 * map too, keyed by glyph names, whose values are drawn as content.
 */
const NAMED_BY_KEY: ReadonlySet<string> = new Set(['Colorants', 'Solidities', 'DotGain', 'HT'])

/**
 * How the value under `key`, in a dictionary read as `reading`, is read: a
 * soft mask's group, under /G, is drawn as content wherever it stands, as
 * PDF.js draws it whatever its /Subtype says; an image's soft mask and its
 * stencil mask, under /SMask and /Mask, are images a viewer decodes; each
 * fails closed elsewhere. An alternate's /Image is the image a viewer that
 * prints by the standard prints where the alternate says it is for
 * printing (ISO 32000-1 8.9.5.4), and Report prints.
 */
function under(reading: Walked, key: string): Reading {
  if (key === 'Resources') return RESOURCES
  if (key === 'CharProcs') return GLYPHS
  if (key === 'G') return CONTENT
  if (key === 'SMask' || key === 'Mask') return IMAGE
  if (key === 'Alternates') return ALTERNATES
  if (key === 'Image' && reading === ALTERNATE) return IMAGE
  if (NAMED_BY_KEY.has(key)) return NAMES
  if (reading !== RESOURCES || !NAME_MAPS.has(key)) return VALUE
  return key === 'XObject' ? XOBJECTS : NAMES
}

/** How each value of a name map read as `reading` is read. */
const ENTRIES: ReadonlyMap<Walked, Reading> = new Map([
  [NAMES, VALUE],
  [GLYPHS, CONTENT],
  [XOBJECTS, XOBJECT],
])

/** Whether a stream is content by what it says of itself: a form XObject, or a tiling pattern (ISO 32000-1 8.10, 8.7.3.1). */
function drawsContent(objects: PdfObjects, stream: PdfStream): boolean {
  const entries = stream.dict.entries
  return isName(resolved(objects, entries.get('Subtype')), 'Form') || resolved(objects, entries.get('PatternType')) === 1
}

/**
 * The streams the closure reaches, each read as a viewer reads it where it
 * stands, every time it is reached: an image held to the pixels it
 * declares and passed on undecoded; content decoded and its inline images
 * held, with its own resources; anything else decoded. A stream that stands
 * in two places is read as each, once for each: an image a font descriptor
 * also names is decoded as the font file a viewer reads it as. Each decode
 * is taken from the document's one budget -- a stream decoded as data and
 * later reached as content is decoded again there, and charged again.
 */
class Streams {
  private readonly parsed: ParsedDocument
  private readonly decoded = new Set<PdfStream>()
  /** The content streams read for their inline images already. */
  private readonly drawn = new Set<PdfStream>()

  constructor(parsed: ParsedDocument) {
    this.parsed = parsed
  }

  /** A stream reached where `reading` says it stands. */
  reached(stream: PdfStream, reading: Reading): void {
    const objects = this.parsed.objects
    // An image is held again wherever it is reached: a few look-ups, and nothing taken from the budget.
    if (reading === IMAGE || (reading === XOBJECT && isImage(objects, stream))) heldImage(objects, stream)
    else if (reading === CONTENT || drawsContent(objects, stream)) this.content(stream)
    else this.data(stream)
  }

  /** A stream drawn as content: decoded, and its inline images held, once however often it is reached so. */
  private content(stream: PdfStream): void {
    if (this.drawn.has(stream)) return
    this.drawn.add(stream)
    this.decoded.add(stream)
    const { objects, budget } = this.parsed
    heldInlineImages(this.parsed, decodedBytes(stream, budget), ownResources(objects, stream), budget)
  }

  private data(stream: PdfStream): void {
    if (this.decoded.has(stream)) return
    this.decoded.add(stream)
    decodedBytes(stream, this.parsed.budget)
  }
}

/**
 * Internal: the objects `roots` reach, numbered for the document, refused past MAX_DOCUMENT_OBJECTS or where one is a page.
 * Each root is read as a /Resources dictionary is: a page's group and an appearance's form hold none of the keys
 * that map names, and so read as any other value does.
 */
export function closureOf(parsed: ParsedDocument, roots: readonly PdfValue[]): ReadonlyMap<number, PdfValue | PdfStream> | DocumentRefusal {
  return caught(() => {
    const pages = new Set(parsed.pages)
    const closure = new Map<number, PdfValue | PdfStream>()
    const streams = new Streams(parsed)
    const walked = Array.from({ length: ALTERNATE + 1 }, () => new Set<object>())
    const values: PdfValue[] = []
    const readings: Reading[] = []
    const reach = (value: PdfValue, reading: Reading): void => {
      values.push(value)
      readings.push(reading)
    }
    for (const root of roots) reach(root, RESOURCES)
    for (let value = values.pop(); value !== undefined; value = values.pop()) {
      const reading = readings.pop() as Reading
      const read: Walked = reading === CONTENT || reading === XOBJECT || reading === IMAGE ? VALUE : reading
      if (isRef(value)) {
        if (pages.has(value.object)) refuse('resource-page')
        let object = closure.get(value.object)
        if (object === undefined) {
          object = parsed.objects.get(value.object)
          // A reference to no object is null (ISO 32000-1 7.3.10).
          if (object === undefined) continue
          if (closure.size >= MAX_DOCUMENT_OBJECTS) refuse('reached')
          closure.set(value.object, object)
        }
        if (isStream(object)) streams.reached(object, reading)
        reach(isStream(object) ? object.dict : object, read)
        continue
      }
      if (!isArray(value) && !isDict(value)) continue
      const seen = walked[read] as Set<object>
      if (seen.has(value)) continue
      seen.add(value)
      const entries = ENTRIES.get(read)
      if (isArray(value)) for (const item of value) reach(item, read === ALTERNATES ? ALTERNATE : VALUE)
      else if (entries !== undefined) for (const item of value.entries.values()) reach(item, entries)
      else {
        if (layered(parsed, value)) refuse('layers')
        for (const [key, item] of value.entries) if (!NOT_FOLLOWED.has(key)) reach(item, under(read, key))
      }
    }
    return closure
  })
}

/** Whether `dict` belongs to a layer (/OC), or is one: an optional content group or membership dictionary (ISO 32000-1 8.11.2). */
function layered(parsed: ParsedDocument, dict: PdfDict): boolean {
  const type = resolved(parsed.objects, dict.entries.get('Type'))
  return dict.entries.has('OC') || isName(type, 'OCG') || isName(type, 'OCMD')
}
