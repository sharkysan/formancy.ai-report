/**
 * The neutral object graph a PDF is read into: plain values that hold no
 * parser's type, so that nothing of the parser leaves the package and
 * every reader of a document -- the runtime, the renderer, the server, the
 * builders -- reads the same values.
 *
 * A name is held in one written form of its own: its bytes, `#xx`-escaped
 * wherever PDF does not let a byte stand for itself in a name, so that
 * `/T#79pe` and `/Type` are one name, as they are to every viewer, and a
 * name can be written back as it reads. A string is held as its bytes,
 * escapes decoded. A dictionary is keyed by its names in that form; an
 * entry whose value is null is no entry (ISO 32000-1 7.3.7).
 */

/** A value of a document's object graph, written as the file wrote it: a name in its #-escaped form, a string as its bytes. */
export type PdfValue = null | boolean | number | PdfName | PdfString | readonly PdfValue[] | PdfDict | PdfRef
export interface PdfName {
  readonly name: string
}
export interface PdfString {
  readonly bytes: Uint8Array
}
export interface PdfDict {
  readonly entries: ReadonlyMap<string, PdfValue>
}
export interface PdfRef {
  readonly object: number
}
/** Its dictionary and its bytes as encoded, the filters its dictionary names. */
export interface PdfStream {
  readonly dict: PdfDict
  readonly bytes: Uint8Array
}

/** A document's objects, by the number a `PdfRef` names. */
export type PdfObjects = ReadonlyMap<number, PdfValue | PdfStream>

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null && !Array.isArray(value)

export const isArray = (value: unknown): value is readonly PdfValue[] => Array.isArray(value)
export const isDict = (value: unknown): value is PdfDict => isObject(value) && 'entries' in value
export const isRef = (value: unknown): value is PdfRef => isObject(value) && 'object' in value
export const isStream = (value: unknown): value is PdfStream => isObject(value) && 'dict' in value

/** A whole number from 0: a count, an offset, a length. */
export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** Whether `value` is a name, and, given `name`, that name. */
export function isName(value: unknown, name?: string): value is PdfName {
  return isObject(value) && 'name' in value && (name === undefined || value.name === name)
}

/**
 * The value a reference names, null where no object has its number; any
 * other value as it is. One look-up is the whole of it: the parse refuses an
 * object that is nothing but a reference, so what a reference names is never
 * another.
 */
export function resolved(objects: PdfObjects, value: PdfValue | undefined): PdfValue | PdfStream | undefined {
  return isRef(value) ? (objects.get(value.object) ?? null) : value
}
