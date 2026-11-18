export { verify, verifyRefusal } from './checks.js'
export { verifyDocx, wordRefusal } from './check-docx.js'
export { readDocx } from './docx/read.js'
export type {
  Docx,
  DocxBlock,
  DocxBorder,
  DocxCell,
  DocxPage,
  DocxParagraph,
  DocxPicture,
  DocxRegion,
  DocxRow,
  DocxRun,
  DocxRunProps,
  DocxTable,
} from './docx/model.js'
export { readPackage } from './docx/package.js'
export type { OpcPackage, Part, Relationship } from './docx/package.js'
export { readZip, ZIP_EPOCH } from './docx/zip.js'
export type { ZipEntry } from './docx/zip.js'
export { AXIS_PAINT, GRID_PAINT } from './check-chart-marks.js'
export { SHARE_UNIT } from './check-chart-pie.js'
export { LABEL_DISTANCE } from './check-chart-labels.js'
export { inkAround, verifyInk } from './check-ink.js'
export { pageDimensions, RenderRefusal } from './document.js'
export type {
  Block,
  Columns,
  ColumnSlot,
  EngineAdapter,
  Image,
  ImageAsset,
  Inline,
  KeepTogether,
  PageBreak,
  PageSetup,
  Paragraph,
  QrCode,
  Rectangle,
  RefusalCode,
  RenderOptions,
  ResolvedDocument,
  Rule,
  Section,
  Spacer,
  Table,
  TableColumn,
  TableRow,
  TextStyle,
} from './document.js'
export type {
  Expectation,
  ExpectedCell,
  ExpectedChart,
  ExpectedDrawing,
  ExpectedFirstPage,
  ExpectedImage,
  ExpectedRefusal,
  ExpectedRow,
  ExpectedShiftedRun,
  ExpectedTable,
  Fixture,
  Stated,
} from './fixture.js'
export { chartsOf, drawingsOf, epcCodes, expectation, shiftedRunsOf } from './fixture.js'
export {
  SITE_VISIT_HIGH,
  SITE_VISIT_REPORT,
  SITE_VISIT_SUBMISSION_V1,
  SITE_VISIT_SUBMISSION_V2,
  SITE_VISIT_SUBMISSION_V3,
  SITE_VISIT_V1,
  SITE_VISIT_V2,
  SITE_VISIT_V3,
  siteVisitFindings,
} from './forms/site-visit.js'
export type { StoredSubmission } from './forms/site-visit.js'
export { ALL_FIXTURES } from './fixtures/all.js'
export { KEEP_WITH_FIXTURES } from './fixtures/group-keep-with.js'
export { MALFORMED } from './fixtures/malformed.js'
export type { Malformed } from './fixtures/malformed.js'
export { IMAGE_KINDS, UNSEEN_JPEGS } from './image-kinds.js'
/** A PNG made in code, and one made of given chunks: what a test of another engine builds its own pictures with. */
export { encodePng, pngOf } from './fixtures/png.js'
export { SVG_BOUND, SVG_BOUND_SIDE, SVG_FIXTURES, SVG_MARK, SVG_WINDOW } from './fixtures/svg.js'
export { CHART_FIXTURES } from './fixtures/charts.js'
export { FIRST_PAGE_FIXTURES } from './fixtures/first-page-header.js'
export { SHIFTED_FIXTURES } from './fixtures/shifted.js'
export { JOIN_GAP, offLine } from './lines.js'
export { baselineOf, readPdf } from './read-pdf.js'
export { curvePoints, curveSamples, onCurve } from './curves.js'
export { drawingsOn } from './drawings.js'
export type { Drawing } from './drawings.js'
export { readPdfNumbers } from './numbers.js'
export type { PdfNumber, PdfNumberToken } from './numbers.js'
export { inflatedDigest, readPdfObjects } from './objects.js'
export type { PdfEmbeddedFile, PdfFileParams, PdfFileSpecification, PdfImage, PdfMetadata, PdfNamedFile, PdfObjects, PdfOutputIntent } from './objects.js'
export { childrenOf, propertiesOf, readXmp, XMP_NAMESPACES } from './xmp.js'
export type { XmlAttribute, XmlElement, Xmp } from './xmp.js'
export { elementsAt, readCii, textAt, textsAt } from './testing/cii.js'
export type { CiiElement } from './testing/cii.js'
export { rasterPage, rasterPixels } from './raster.js'
export type { PagePixels } from './raster.js'
export { readCodes } from './codes.js'
export type { PdfCode } from './codes.js'
export { readAnnotations } from './annotations.js'
export type { PdfAnnotation } from './annotations.js'
export {
  addressedData,
  E_INVOICE,
  E_INVOICE_ADDRESSED,
  E_INVOICE_EXEMPT_PAID,
  E_INVOICE_REVERSE_CHARGE,
  E_INVOICE_SAMPLES,
  eInvoiceData,
  equipmentData,
  equipmentRows,
  EURO_INVOICE,
  EURO_INVOICE_AT,
  EURO_INVOICE_ES,
  EURO_INVOICE_FR,
  EURO_INVOICE_IE,
  EURO_INVOICE_IT,
  EURO_INVOICE_NL,
  EURO_INVOICE_SAMPLES,
  euroInvoiceData,
  euroInvoiceLines,
  exemptPaidData,
  GROUPED_EQUIPMENT,
  INSPECTION_PHOTO,
  inspectionData,
  inspectionNotes,
  INVOICE,
  INVOICE_EDITIONS,
  INVOICE_EN,
  INVOICE_FR,
  INVOICE_IT,
  INVOICE_LANGUAGES,
  INVOICE_SAMPLES,
  invoiceAlone,
  invoiceData,
  invoiceLanguagesData,
  invoiceLines,
  LETTERHEAD,
  lineAmount,
  LOGO,
  LOGO_ASSET,
  ORDER_CONFIRMATION,
  orderConfirmationData,
  orderConfirmationLines,
  PAYMENT_REMINDER,
  paymentReminderAlone,
  paymentReminderData,
  paymentReminderItems,
  PRODUCT_DATA_SHEET,
  productDataSheetAlone,
  productDataSheetData,
  QUOTATION,
  quotationData,
  quotationLines,
  REMINDER_EDITIONS,
  reverseChargeData,
  SALES_REPORT,
  salesReportData,
  salesReportLines,
  SERVICE_INSPECTION,
  SHEET_EDITIONS,
  SITE_VISIT_STARTER,
  SITE_VISIT_STARTER_OPTIONS,
  STARTER_IMAGES,
  starterImages,
  STARTERS,
  XRECHNUNG_SAMPLE,
  XRECHNUNG_SAMPLES,
  xrechnungData,
} from './starters/index.js'
export type {
  Edition,
  OrderConfirmationLine,
  PaymentReminderItem,
  ReminderWords,
  SalesReportLine,
  SheetWords,
  Starter,
  StarterImage,
} from './starters/index.js'
export type { PdfAttachment, PdfBox, PdfCurve, PdfFont, PdfPage, PdfPaint, PdfPath, PdfTextItem, ReadPdf } from './read-pdf.js'
