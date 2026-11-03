/**
 * How a PDF is refused: the codes, what a person can do about each, what
 * the reader found at each place it refuses, and the refusal it throws
 * where it finds a fault and catches once, at its edge.
 *
 * A refusal names what was found, in the reader's own words, never a byte
 * of the file: no name, no string, no offset and no object number. Every
 * message is one of `FINDINGS`, then its code's advice, so a message can
 * hold nothing the file chose; the page a later refusal names travels as a
 * number beside it (`page`), never inside it.
 */

/** Why a PDF is refused, each the first thing found that is wrong with it. */
export const DOCUMENT_REFUSAL_CODES = [
  /** No PDF header at its first byte. */
  'not-pdf',
  /** Past `MAX_DOCUMENT_BYTES`, refused before a byte is parsed. */
  'too-large',
  /** A trailer that names an /Encrypt dictionary, with or without a password to open it. */
  'encrypted',
  /** Not written as ISO 32000 writes a PDF, or damaged: cut short, bytes between or after its objects, a token past its bound, a stream whose length or data is wrong. */
  'malformed',
  /** Arrays and dictionaries nested past `MAX_DOCUMENT_DEPTH`. */
  'too-deep',
  /** More objects than `MAX_DOCUMENT_OBJECTS`, written or claimed by a cross-reference; more values than `MAX_DOCUMENT_VALUES`; names past `MAX_DOCUMENT_NAME_BYTES`. */
  'too-many-objects',
  /** Streams that decode past `MAX_DOCUMENT_INFLATED`, every stage of every stream together. */
  'inflates-too-far',
  /** A filter the reader does not decode where it has to: LZW, Crypt, a TIFF predictor, an image's own filter, or a name PDF does not define. */
  'unsupported-filter',
  /** The cross-reference and the objects disagree: an earlier definition named than the last one written, a place where no object is, an object it does not list, a generation no object has. */
  'xref-disagrees',
  /** A page tree that is not a tree: a node reached twice, a parent that is not the node holding it, a count that is not its pages. */
  'page-tree',
  /** More pages than `MAX_DOCUMENT_PAGES`. */
  'too-many-pages',
  /** A page turned by other than a multiple of 90 degrees. */
  'unsupported-rotation',
  /** A page whose box has no area. */
  'no-area',
  /** Optional content: layers a viewer may hide and a print would show. */
  'optional-content',
  /** A resource of a page that reaches a page object. */
  'resource-names-a-page',
  /** A form that asks the viewer to draw its fields, which a print cannot do. */
  'needs-appearances',
  /** An annotation that prints and holds no appearance to print. */
  'annotation-without-appearance',
  /** An annotation whose appearance state names no appearance it holds. */
  'appearance-state-missing',
  /** An annotation that stays upright on a turned page. */
  'annotation-turned',
  /** A link without an appearance whose border a viewer would draw. */
  'link-border',
] as const
export type DocumentRefusalCode = (typeof DOCUMENT_REFUSAL_CODES)[number]

export interface DocumentRefusal {
  readonly ok: false
  readonly code: DocumentRefusalCode
  /** English, for a log or a person, said after the document's name: what was found, then what to do. */
  readonly message: string
  /** The page, counted from 1, where what was found belongs to one. */
  readonly page?: number
}

const SAVE_AGAIN = 'save it again as a PDF from the program that made it'

/** What a person can do about each kind of refusal, said after what was found. */
export const DOCUMENT_ADVICE: { readonly [C in DocumentRefusalCode]: string } = {
  'not-pdf': 'save it as a PDF and add that file',
  'too-large': 'add a smaller PDF, or split this one',
  encrypted: 'save a copy without a password or restrictions, and add that',
  malformed: SAVE_AGAIN,
  'too-deep': SAVE_AGAIN,
  'too-many-objects': `${SAVE_AGAIN}, or split it`,
  'inflates-too-far': `${SAVE_AGAIN}, or split it`,
  'unsupported-filter': SAVE_AGAIN,
  'xref-disagrees': SAVE_AGAIN,
  'page-tree': SAVE_AGAIN,
  'too-many-pages': 'split it into PDFs of fewer pages',
  'unsupported-rotation': 'save it again with its pages turned by quarter turns',
  'no-area': SAVE_AGAIN,
  'optional-content': 'save it again with its layers flattened, so that it prints what it shows',
  'resource-names-a-page': SAVE_AGAIN,
  'needs-appearances': 'save it again from a PDF editor so that its form fields are drawn, or print it to a PDF',
  'annotation-without-appearance': 'flatten its annotations and form fields, or print it to a PDF, and add that',
  'appearance-state-missing': 'flatten its annotations and form fields, or print it to a PDF, and add that',
  'annotation-turned': 'flatten its annotations and form fields, or print it to a PDF, and add that',
  'link-border': 'save it again without borders around its links, or print it to a PDF',
}

/** What the reader found, at each place it refuses a file, and the code that is. */
export const FINDINGS = {
  header: ['not-pdf', 'it does not begin as a PDF begins'],
  bytes: ['too-large', 'it is larger than a document may be'],
  encrypted: ['encrypted', 'it is encrypted'],
  'no-eof': ['malformed', 'it does not end as a PDF ends, and may have been cut short'],
  'after-eof': ['malformed', 'it holds bytes after its end'],
  'eof-far': ['malformed', 'its end is further from its last byte than a PDF allows'],
  'between-objects': ['malformed', 'it holds bytes between its objects that belong to none of them'],
  'object-header': ['malformed', 'an object in it does not begin as an object does'],
  'object-end': ['malformed', 'an object in it does not end as an object does'],
  'trailer-alone': ['malformed', 'its trailer follows no cross-reference'],
  'xref-entry': ['malformed', 'an entry of its cross-reference is not written as one'],
  'xref-trailer': ['malformed', 'its cross-reference has no trailer'],
  'name-length': ['malformed', 'a name in it is longer than a name may be'],
  'name-escape': ['malformed', 'a name in it holds a number sign that escapes no byte'],
  'string-length': ['malformed', 'a string in it is longer than a string may be'],
  'string-end': ['malformed', 'a string in it does not end'],
  'hex-string': ['malformed', 'a hexadecimal string in it holds a character that is not a hexadecimal digit'],
  'number-length': ['malformed', 'a number in it is longer than a number may be'],
  number: ['malformed', 'a number in it is not one'],
  reference: ['malformed', 'a reference in it names no object a PDF can hold'],
  'stream-inside': ['malformed', 'a stream in it stands inside another object'],
  'stream-length': ['malformed', 'a stream in it does not give its length as a number'],
  'stream-past-end': ['malformed', 'a stream in it runs past the end of the file'],
  'stream-end': ['malformed', 'a stream in it does not end where its length says'],
  'length-chain': ['malformed', 'the length of a stream in it is a reference to another reference'],
  'xref-stream': ['malformed', 'its cross-reference stream does not say how its rows are laid out'],
  'xref-stream-rows': ['malformed', 'its cross-reference stream holds fewer rows than it says'],
  'xref-size': ['malformed', 'its cross-reference lists an object past the number of objects it says it holds'],
  'object-stream': ['malformed', 'an object stream in it does not say how its objects are laid out'],
  'object-stream-offset': ['malformed', 'an object stream in it places an object past its end'],
  'object-stream-order': ['malformed', 'an object stream in it does not hold its objects one after another'],
  'prev-cycle': ['malformed', 'its cross-references name one another in a cycle'],
  'no-startxref': ['malformed', 'it does not say where its cross-reference is'],
  'no-catalog': ['malformed', 'its trailer names no catalog'],
  'filter-name': ['malformed', 'a stream in it does not name its filters directly, by name'],
  'flate-header': ['malformed', 'a compressed stream in it does not begin as compressed data does'],
  'flate-data': ['malformed', 'a compressed stream in it is damaged or cut short'],
  'flate-after': ['malformed', 'a compressed stream in it holds bytes after its compressed data'],
  predictor: ['malformed', 'a predicted stream in it is not laid out as its predictor says'],
  unreadable: ['malformed', 'it is written in a way the reader cannot follow'],
  depth: ['too-deep', 'it nests arrays or dictionaries deeper than a document may'],
  stack: ['too-deep', 'it nests deeper than the reader can follow'],
  objects: ['too-many-objects', 'it holds more objects than a document may'],
  'xref-claim': ['too-many-objects', 'its cross-reference claims more objects than a document may hold'],
  values: ['too-many-objects', 'it holds more values than a document may'],
  'name-bytes': ['too-many-objects', "its names, together, are longer than a document's may be"],
  inflated: ['inflates-too-far', 'its compressed streams expand past what a document may hold'],
  filter: ['unsupported-filter', 'a stream in it is compressed in a way the reader does not decode'],
  startxref: ['xref-disagrees', 'it says its cross-reference is where none is'],
  prev: ['xref-disagrees', 'its cross-reference names an earlier one where none is'],
  'xref-stream-nowhere': ['xref-disagrees', 'its cross-reference names a cross-reference stream where none is'],
  shadow: ['xref-disagrees', 'its cross-reference names an earlier definition of an object than the last one written'],
  unlisted: ['xref-disagrees', 'it holds an object its cross-reference does not list'],
  misplaced: ['xref-disagrees', 'its cross-reference places an object where the object is not'],
  missing: ['xref-disagrees', 'its cross-reference names an object it does not hold'],
  generation: ['xref-disagrees', 'a reference in it names a generation of an object that its cross-reference does not give'],
  'pages-root': ['page-tree', 'its catalog names no page tree'],
  'pages-root-parent': ['page-tree', "its page tree's root has a parent"],
  'pages-kids': ['page-tree', 'a node of its page tree does not list its kids in an array'],
  'pages-kid': ['page-tree', 'its page tree holds a kid that is neither a page nor a node'],
  'pages-twice': ['page-tree', 'its page tree reaches one node twice'],
  'pages-parent': ['page-tree', 'a page or a node of its page tree names another parent than the node that holds it'],
  'pages-count': ['page-tree', 'a node of its page tree counts other than the pages under it'],
  pages: ['too-many-pages', 'it has more pages than a document may'],
} as const satisfies Record<string, readonly [DocumentRefusalCode, string]>
export type Finding = keyof typeof FINDINGS

/** The refusal for what was found. */
export function refusal(finding: Finding): DocumentRefusal {
  const [code, found] = FINDINGS[finding]
  return { ok: false, code, message: `${found}; ${DOCUMENT_ADVICE[code]}` }
}

/**
 * A refusal on its way out of the reader. It is thrown where the fault is
 * found, deep in a token or a cross-reference, and caught once, at the
 * reader's edge (`caught`), so that nothing partly read is ever returned.
 */
export class DocumentRefused extends Error {
  readonly refusal: DocumentRefusal

  constructor(refusal: DocumentRefusal) {
    super(refusal.message)
    this.refusal = refusal
  }
}

/** Refused for what was found. */
export function refuse(finding: Finding): never {
  throw new DocumentRefused(refusal(finding))
}

/**
 * What `read` returns, or the refusal it throws. Anything else thrown --
 * pdf-lib's own exceptions for bytes its grammar cannot follow, and any
 * fault of the reader's -- is a stable refusal too, never the exception's
 * class or message, which may quote the file: running out of stack is
 * `too-deep`, everything else `malformed`. V8 and JavaScriptCore say a
 * stack ran out by a RangeError whose message names the call stack,
 * SpiderMonkey by an InternalError of "too much recursion". The depth bound
 * and the iterative walks keep a file from running the stack out; a host
 * that calls the reader deep in its own stack still may.
 */
export function caught<T>(read: () => T): T | DocumentRefusal {
  try {
    return read()
  } catch (error) {
    if (error instanceof DocumentRefused) return error.refusal
    if (error instanceof RangeError && /call stack/i.test(error.message)) return refusal('stack')
    if (error instanceof Error && error.name === 'InternalError' && /too much recursion/i.test(error.message)) return refusal('stack')
    return refusal('unreadable')
  }
}
