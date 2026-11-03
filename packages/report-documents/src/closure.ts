import { decodedBytes } from './inflate.js'
import { MAX_DOCUMENT_OBJECTS } from './limits.js'
import { isArray, isDict, isName, isRef, isStream, type PdfStream, type PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'
import { caught, refuse, type DocumentRefusal } from './refusals.js'

/**
 * The closure: every object a document's pages draw with, by the number a
 * reference names it by, reached from what they draw with -- their
 * resources, their groups, their appearances' forms. What a renderer
 * copies into a report's PDF beside the pages it places.
 *
 * Walked without recursion, each object once, so that a font two pages
 * share is one object and a chain of any length is walked as far as the
 * bound. Each object is counted against `MAX_DOCUMENT_OBJECTS` as it is
 * reached, before it is kept; each stream is decoded once, from the
 * document's one budget, as a viewer of the report will decode it, and
 * none is kept decoded. A page is never part of it: a resource that
 * reaches one is refused. Nor is a layer: a dictionary marked as
 * belonging to one (/OC) is refused, as the pages refuse a catalog that
 * says the document has layers.
 */

/**
 * Keys the closure does not follow. /Parent and /P lead back into the
 * document -- a field's parent, an annotation's page, a structure
 * element's parent -- and /Metadata and /PieceInfo print nothing: XMP for
 * a program that catalogues the file, and private data for the program
 * that wrote it. A reference under one of them names an object the
 * closure does not hold, as a reference that names no object does.
 */
const NOT_FOLLOWED: ReadonlySet<string> = new Set(['Parent', 'P', 'Metadata', 'PieceInfo'])

/** Internal: the objects `roots` reach, numbered for the document, refused past MAX_DOCUMENT_OBJECTS or where one is a page. */
export function closureOf(parsed: ParsedDocument, roots: readonly PdfValue[]): ReadonlyMap<number, PdfValue | PdfStream> | DocumentRefusal {
  return caught(() => {
    const pages = new Set(parsed.pages)
    const closure = new Map<number, PdfValue | PdfStream>()
    const pending: PdfValue[] = [...roots]
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (isRef(value)) {
        if (closure.has(value.object)) continue
        if (pages.has(value.object)) refuse('resource-page')
        const object = parsed.objects.get(value.object)
        // A reference to no object is null (ISO 32000-1 7.3.10).
        if (object === undefined) continue
        if (closure.size >= MAX_DOCUMENT_OBJECTS) refuse('reached')
        if (isStream(object)) decodedBytes(object, parsed.budget, isName(object.dict.entries.get('Subtype'), 'Image'))
        closure.set(value.object, object)
        pending.push(isStream(object) ? object.dict : object)
      } else if (isArray(value)) {
        for (const item of value) pending.push(item)
      } else if (isDict(value)) {
        if (value.entries.has('OC')) refuse('layers')
        for (const [key, item] of value.entries) if (!NOT_FOLLOWED.has(key)) pending.push(item)
      }
    }
    return closure
  })
}
