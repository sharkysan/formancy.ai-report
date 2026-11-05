export {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_DEPTH,
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
