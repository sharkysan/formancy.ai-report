/*
 * The one PDF reader (report-documents), from the packed package under Node:
 * a PDF the renderer drew taken by its header, and the same bytes
 * with one before the header refused. consume.ts runs it and prints what it
 * returns. It lives apart because it changes when the reader does, and the
 * rest of consume.ts does not.
 */
import { PDF_MEDIA_TYPE, isPdf } from '@formancy/report-documents'

export function documentsRead(pdf: Uint8Array): string {
  if (PDF_MEDIA_TYPE !== 'application/pdf') throw new Error(`the PDF media type is ${PDF_MEDIA_TYPE}`)
  if (!isPdf(pdf)) throw new Error('the PDF the renderer drew was not taken for one')
  const padded = new Uint8Array(pdf.length + 1)
  padded.set(pdf, 1)
  if (isPdf(padded)) throw new Error('a PDF with a byte before its header was taken for one')
  return `report-documents took the ${pdf.length}-byte PDF the renderer drew by its header and refused it with a byte before`
}
