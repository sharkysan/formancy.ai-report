/*
 * The one PDF reader (report-documents), from the packed package under Node:
 * a PDF the renderer drew taken by its header and read whole by
 * readDocument, its pages within the bound the package exports, and the
 * same bytes with one before the header refused, by isPdf and by
 * readDocument; a refusal held by the type the package exports, its code
 * one of the package's list, and a notice the same way. consume.ts runs it
 * and prints what it returns. It lives apart because it changes when the
 * reader does, and the rest of consume.ts does not.
 */
import {
  DOCUMENT_NOTICE_CODES,
  DOCUMENT_REFUSAL_CODES,
  MAX_DOCUMENT_PAGES,
  PDF_MEDIA_TYPE,
  isPdf,
  readDocument,
  type DocumentNotice,
  type DocumentRead,
  type DocumentRefusal,
  type PrintablePage,
} from '@formancy/report-documents'

/** A refusal as a host holds one, by the type the package exports. */
const encrypted: DocumentRefusal = { ok: false, code: 'encrypted', message: 'it is encrypted' }

/** A notice as a host holds one, by the type the package exports: a code and a count. */
const links: DocumentNotice = { code: 'links', count: 2 }

export function documentsRead(pdf: Uint8Array): string {
  if (PDF_MEDIA_TYPE !== 'application/pdf') throw new Error(`the PDF media type is ${PDF_MEDIA_TYPE}`)
  if (!DOCUMENT_REFUSAL_CODES.includes(encrypted.code)) throw new Error('the refusal codes do not hold encrypted')
  if (!DOCUMENT_NOTICE_CODES.includes(links.code)) throw new Error('the notice codes do not hold links')
  if (!isPdf(pdf)) throw new Error('the PDF the renderer drew was not taken for one')
  const padded = new Uint8Array(pdf.length + 1)
  padded.set(pdf, 1)
  if (isPdf(padded)) throw new Error('a PDF with a byte before its header was taken for one')
  const read: DocumentRead = readDocument(pdf)
  if (!read.ok) throw new Error(`readDocument refused the PDF the renderer drew: ${read.message}`)
  const pages: readonly PrintablePage[] = read.document.pages
  if (pages.length < 1 || pages.length > MAX_DOCUMENT_PAGES) throw new Error(`readDocument read ${pages.length} pages`)
  const refused = readDocument(padded)
  if (refused.ok || refused.code !== 'not-pdf') throw new Error('readDocument read a PDF with a byte before its header')
  return `report-documents took the ${pdf.length}-byte PDF the renderer drew by its header and read its ${pages.length} page(s) whole, and refused it with a byte before`
}
