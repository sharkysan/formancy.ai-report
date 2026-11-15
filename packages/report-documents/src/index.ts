/**
 * The reader's public surface: `readDocument`, what it returns and refuses,
 * the bounds it holds a PDF to, and the neutral model its objects are in.
 * The model's type guards are internal: a host tells its kinds apart by
 * their keys -- a PdfStream holds `dict` and `bytes`, its data as encoded;
 * a PdfString `bytes` alone, the string's bytes, escapes decoded; a PdfDict
 * `entries`, a PdfName `name`, a PdfRef `object`. The first package that
 * walks the objects is to export the guards from here rather than write
 * its own, so that the kinds are told apart in one place.
 */
export {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_NESTING,
  MAX_DOCUMENT_IMAGE_PIXELS,
  MAX_DOCUMENT_INFLATED,
  MAX_DOCUMENT_NAME_BYTES,
  MAX_DOCUMENT_NAME_LENGTH,
  MAX_DOCUMENT_NUMBER_LENGTH,
  MAX_DOCUMENT_OBJECTS,
  MAX_DOCUMENT_PAGES,
  MAX_DOCUMENT_STRING_LENGTH,
  MAX_DOCUMENT_VALUES,
  MAX_DOCUMENT_XREF_ENTRIES,
  MAX_DOCUMENT_XREF_SECTIONS,
} from './limits.js'
export type { PdfDict, PdfName, PdfRef, PdfStream, PdfString, PdfValue } from './model.js'
export { DOCUMENT_NOTICE_CODES, type DocumentNotice, type DocumentNoticeCode } from './notices.js'
export type { FlattenedAppearance, Matrix, PrintablePage, Rotation } from './pages.js'
export { readDocument, type DocumentRead, type PrintableDocument } from './read.js'
export { DOCUMENT_REFUSAL_CODES, type DocumentRefusal, type DocumentRefusalCode } from './refusals.js'
export { PDF_MEDIA_TYPE, isPdf } from './sniff.js'
