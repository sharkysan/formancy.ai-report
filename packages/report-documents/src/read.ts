import { closureOf } from './closure.js'
import type { PdfStream, PdfValue } from './model.js'
import { noticesOf, Tally, type DocumentNotice } from './notices.js'
import { pagesOf, type PrintablePage } from './pages.js'
import { parseDocument, type ParsedDocument } from './parse.js'
import { caught, type DocumentRefusal } from './refusals.js'

/**
 * The reader's one entry: a PDF's bytes read whole, or refused. The parse
 * (parse.ts) reads the file into the neutral model, every bound held
 * before the work it bounds; the pages (pages.ts) are read in order, each
 * as a viewer shows it, its annotations flattened by the print rule
 * (annotations.ts); the closure (closure.ts) is every object they draw
 * with; and the notices (notices.ts) say what does not survive printing.
 * Each stage returns the first refusal it meets, and the read returns it
 * as it comes: nothing partly read is ever returned. Synchronous, as
 * report-spec's `readFont` is, so that the runtime reads every document
 * of a report before it hands the report on; nothing here awaits, and
 * nothing reaches the network, the file system or a global of Node's or a
 * browser's.
 */

/**
 * A document read whole. Every byte array it holds -- a stream's bytes, a
 * string's, a page's content -- is a view of the read's own copy of the
 * file, or of the bytes it decoded, shared between values: a stream's and a
 * string's may be views of one buffer. A host never writes to one, and
 * never reads past the view, through its `buffer` or otherwise: what lies
 * beside it is another value's, or the file's.
 */
export interface PrintableDocument {
  /** Every page, in the order it prints. */
  readonly pages: readonly PrintablePage[]
  /** Every object the pages reach, by the number a PdfRef names: shared between pages. */
  readonly objects: ReadonlyMap<number, PdfValue | PdfStream>
  /** What the document holds that does not survive printing, a count of each kind, said to whoever adds it. */
  readonly notices: readonly DocumentNotice[]
}

export type DocumentRead = { readonly ok: true; readonly document: PrintableDocument } | DocumentRefusal

/**
 * Internal: what the pages draw with, which the closure is taken from:
 * each page's resources, its transparency group where it has one, and the
 * dictionary of each appearance's form -- not the form, a stream, which is
 * no value the closure walks, and whose bytes the annotations decoded
 * already. The form itself is the appearance's (`FlattenedAppearance`),
 * and in the objects only where something else reaches it by reference.
 */
export const rootsOf = (pages: readonly PrintablePage[]): PdfValue[] =>
  pages.flatMap((page) => [page.resources, ...(page.group === undefined ? [] : [page.group]), ...page.appearances.map((drawn) => drawn.form.dict)])

/** Internal: a document read whole, with the parse it was read from, which the tests read the budget of; or the first refusal. */
export function readWhole(bytes: Uint8Array): (PrintableDocument & { readonly parsed: ParsedDocument }) | DocumentRefusal {
  const parsed = parseDocument(bytes)
  if ('ok' in parsed) return parsed
  const tally = new Tally()
  const pages = pagesOf(parsed, tally)
  if ('ok' in pages) return pages
  const objects = closureOf(parsed, rootsOf(pages))
  if ('ok' in objects) return objects
  return { parsed, pages, objects, notices: noticesOf(parsed, tally) }
}

/**
 * What a read made, frozen where JavaScript freezes: the document, its
 * pages, each page, its box, its appearances and theirs, and its notices.
 * The object graph -- a page's content and resources, every value of the
 * objects -- is the read's own, made from its own copy of the bytes and
 * shared with no other read, but not frozen: a Map and a typed array
 * cannot be.
 */
function frozen({ pages, objects, notices }: PrintableDocument): PrintableDocument {
  for (const page of pages) {
    Object.freeze(page.box)
    for (const drawn of page.appearances) Object.freeze(Object.freeze(drawn).matrix)
    Object.freeze(page.appearances)
    Object.freeze(page)
  }
  for (const notice of notices) Object.freeze(notice)
  return Object.freeze({ pages: Object.freeze(pages), objects, notices: Object.freeze(notices) })
}

/**
 * A PDF's bytes read whole: its pages, every object they draw with, and
 * what it holds that does not survive printing; or the first refusal,
 * which names what was found and never a byte of the file. Synchronous.
 * Never throws: anything thrown while it reads -- by pdf-lib's grammar, by
 * pako, by a fault of the reader's own -- is a refusal of the reader's own
 * words (`caught`). The bytes are a Uint8Array of the host's own realm --
 * one of an iframe or a vm is refused, as not-pdf: a host copies one into
 * its own realm first -- and are copied before one is read, so that the
 * caller's buffer may be reused the moment the read returns.
 */
export function readDocument(bytes: Uint8Array): DocumentRead {
  return Object.freeze(
    caught((): DocumentRead => {
      const read = readWhole(bytes)
      return 'ok' in read ? read : { ok: true, document: frozen(read) }
    }),
  )
}
