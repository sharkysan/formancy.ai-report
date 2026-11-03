import { decodedBytes } from './inflate.js'
import { MAX_DOCUMENT_OBJECTS } from './limits.js'
import { isArray, isDict, isName, isRef, isStream, resolved, type PdfDict, type PdfStream, type PdfValue } from './model.js'
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
 * before it is kept; each stream is decoded once, from the document's one
 * budget, as a viewer of the report will decode it, and none is kept
 * decoded. A page is never part of it: a resource that reaches one is
 * refused. Nor is a layer: a dictionary marked as belonging to one (/OC),
 * or a layer's own (/Type /OCG or /OCMD), is refused, as the pages refuse
 * a catalog that says the document has layers.
 */

/**
 * How the walk reads a value: as any value; as a /Resources dictionary,
 * whose maps of names it reads as name maps; or as a name map, whose keys
 * are names a content stream or an encoding chose.
 */
const VALUE = 0
const RESOURCES = 1
const NAMES = 2
type Reading = typeof VALUE | typeof RESOURCES | typeof NAMES

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
 * /DotGain, and a type 5 halftone, each keyed by names the file chose --
 * they are names, like /OC there, and every value is followed: a form
 * named /P is held to every guard a form named /X is, a glyph named /P is
 * drawn, and a spot colour named /P keeps its tint function.
 */
const NOT_FOLLOWED: ReadonlySet<string> = new Set(['Parent', 'P', 'Metadata', 'PieceInfo'])

/**
 * Keys whose value is a name map wherever they stand: a Type 3 font's
 * /CharProcs, keyed by glyph names, and a DeviceN attributes dictionary's
 * /Colorants and its mixing hints' /Solidities and /DotGain, keyed by
 * colorant names.
 */
const NAMED_BY_KEY: ReadonlySet<string> = new Set(['CharProcs', 'Colorants', 'Solidities', 'DotGain'])

/** How the value under `key`, in a dictionary read as `reading`, is read. */
function under(reading: Reading, key: string): Reading {
  if (key === 'Resources') return RESOURCES
  if (NAMED_BY_KEY.has(key)) return NAMES
  return reading === RESOURCES && NAME_MAPS.has(key) ? NAMES : VALUE
}

/**
 * Whether `dict` is a halftone of type 5, keyed by the colorants it
 * screens besides its /Type and /Default: a name map, whose /Type and
 * /Default read as the values they are.
 */
function screensByColorant(parsed: ParsedDocument, dict: PdfDict): boolean {
  return resolved(parsed.objects, dict.entries.get('HalftoneType')) === 5
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
    const walked = [new Set<object>(), new Set<object>(), new Set<object>()] as const
    const values: PdfValue[] = []
    const readings: Reading[] = []
    const reach = (value: PdfValue, reading: Reading): void => {
      values.push(value)
      readings.push(reading)
    }
    for (const root of roots) reach(root, RESOURCES)
    for (let value = values.pop(); value !== undefined; value = values.pop()) {
      const reading = readings.pop() as Reading
      if (isRef(value)) {
        if (pages.has(value.object)) refuse('resource-page')
        let object = closure.get(value.object)
        if (object === undefined) {
          object = parsed.objects.get(value.object)
          // A reference to no object is null (ISO 32000-1 7.3.10).
          if (object === undefined) continue
          if (closure.size >= MAX_DOCUMENT_OBJECTS) refuse('reached')
          if (isStream(object)) decodedBytes(object, parsed.budget, isName(object.dict.entries.get('Subtype'), 'Image'))
          closure.set(value.object, object)
        }
        reach(isStream(object) ? object.dict : object, reading)
        continue
      }
      if (!isArray(value) && !isDict(value)) continue
      if (walked[reading].has(value)) continue
      walked[reading].add(value)
      if (isArray(value)) for (const item of value) reach(item, VALUE)
      else if (reading === NAMES || screensByColorant(parsed, value)) for (const item of value.entries.values()) reach(item, VALUE)
      else {
        if (layered(parsed, value)) refuse('layers')
        for (const [key, item] of value.entries) if (!NOT_FOLLOWED.has(key)) reach(item, under(reading, key))
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
