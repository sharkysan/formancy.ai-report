export { REFUSAL_CODES, RenderRefusal } from './document.js'
export type {
  Block,
  Columns,
  ColumnSlot,
  EInvoiceFile,
  EpcQrCode,
  FacturXFile,
  Image,
  ImageAsset,
  Inline,
  KeepTogether,
  PageBreak,
  PageSetup,
  Paragraph,
  QrBill,
  QrBillHeadings,
  QrCode,
  Rectangle,
  RefusalCode,
  ResolvedDocument,
  Rule,
  Section,
  Spacer,
  Table,
  TableColumn,
  TableRow,
  TextStyle,
  XRechnungFile,
} from './document.js'

export { checkData, CONSISTENCY_MODES, DATA_MODES, MAX_DETAIL_ROWS } from './data.js'
export type { CheckedData, CheckedRecord, Completeness, Consistency, DataCheck, DataCheckOptions, DataMode, ReportData } from './data.js'
export { SOURCE_PROVIDERS } from './source.js'
export type { DataSource, FormancyDataSource, FormSource, FormSubmission, SourceProvider } from './source.js'
export { DATA_ERROR_CODES, MAX_DATA_ERRORS } from './data-errors.js'
export type { DataError, DataErrorCode } from './data-errors.js'
export { checkParameters } from './parameters.js'
export type { CheckedParameters, ParameterCheck } from './parameters.js'
export { MAX_STRING_LENGTH, readValue, VALUE_ERROR_CODES } from './values.js'
export type { CheckedValue, FieldValues, ImageValue, ValueErrorCode, ValueRead } from './values.js'

export { averageDecimals, maxDecimal, minDecimal, roundDecimalAs, sumDecimals } from './decimal.js'
export { createFormatter, FORMAT_ERROR_CODES, MAX_FORMATTED_DIGITS, plainText, supportedLocale } from './format.js'
export type { CurrencyScope, FormatContext, Formatted, FormatErrorCode, Formatter, PrintableType, TypedValue } from './format.js'
export { groupRows, orderKeys, orderRows, orderTable } from './sort-group.js'
export type { OrderedRow, OrderedTable, OrderKey, RowGroup } from './sort-group.js'
export { CAPABILITIES, EVALUATION_ERROR_CODES, EXPRESSION_STEP_BUDGET, prepareExpressions, RENDER_STEP_BUDGET } from './evaluate.js'
export type { ConditionEvaluation, Evaluation, EvaluationError, EvaluationErrorCode, ExpressionsPreparation, ReportExpressions } from './evaluate.js'

export { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, resolveReport, XRECHNUNG_COPY_LABEL, XRECHNUNG_COPY_PARAGRAPH } from './resolve.js'
export type { RenderManifest, Resolution, ResolveOptions } from './resolve.js'
export { checkReport } from './report-check.js'
export type { ReportCheck } from './report-check.js'
export { RESOLVE_ERROR_CODES } from './resolve-errors.js'
export type { ResolveErrorCode, RuntimeError, RuntimeStage } from './resolve-errors.js'
export type { ImageBytes, ImageRef, ImageResolver } from './render-context.js'
/** The definition `resolveReport` reads, so that a caller of the runtime names it without depending on report-spec itself. */
export type { ReportDefinition } from '@formancy/report-spec'
/**
 * What report-spec decides of a QR-bill that an engine needs to draw its
 * slip, handed on so that an engine, which depends on the runtime alone,
 * reads the one decision rather than making its own: the slip's size and
 * place, the page it is printed on, the currencies, the amount's range and
 * the longest value SIX allows.
 */
export { checkQrBillAmount, MAX_QR_BILL_ADDITIONAL_INFORMATION, QR_BILL_CURRENCIES, QR_BILL_SIZE, QR_BILL_TOP, qrBillPageBreak } from '@formancy/report-spec'
export type { QrBillPageBreak } from '@formancy/report-spec'
/**
 * What report-spec decides of how an EPC QR code is printed, handed on as
 * the QR-bill's decisions are: the most bytes and the largest version the
 * EPC allows, the modules a symbol of a version has, the side of a module in a square, and
 * Austria's frame, caption and modules' widths, with the least version a
 * captioned code is drawn at and the rule a captioned code breaks.
 */
export { EPC_CAPTION, EPC_CAPTION_MODULE, EPC_FRAME, EPC_MAX_BYTES, EPC_MAX_VERSION, epcCaptionBreak, epcLeastVersion, epcModule, qrSymbolModules } from '@formancy/report-spec'
export type { EpcCaption } from '@formancy/report-spec'
/**
 * What report-spec decides of how an e-invoice is embedded, handed on as
 * the QR-bill's decisions are, so that an engine embeds and describes the
 * file by the one decision [S]: its name and media type, the XMP
 * extension's namespace and prefix, the document type and version it
 * states, and each profile's conformance level and relationship; and what
 * names each XRechnung version, its guideline, release and syntax, which
 * an engine holds an XRechnung's file to (0038).
 */
export { FACTUR_X, FACTUR_X_PROFILES, XRECHNUNG, XRECHNUNG_VERSIONS } from '@formancy/report-spec'
export type { FacturXProfileTerms, XRechnungTerms, XRechnungVersion } from '@formancy/report-spec'
/**
 * What report-spec decides of an image's bytes, handed on as the QR-bill's
 * decisions are (0033): `MAX_ASSET_BYTES`, the most an asset may have,
 * which the runtime holds a host's answer to and the renderer the bytes it
 * draws; `MAX_ASSET_SIDE`, the most pixels a side of a PNG or a JPEG;
 * `sniffImage`, what the bytes are by their first bytes; and `imageHeader`,
 * a PNG's or a JPEG's structure read as an upload reads it, which the
 * renderer checks a picture by before it inflates a PNG's image data.
 */
export { IMAGE_REFUSAL_CODES, imageHeader, MAX_ASSET_BYTES, MAX_ASSET_SIDE, sniffImage } from '@formancy/report-spec'
export type { ImageRefusal, ImageRefusalCode, JpegHeader, PngHeader, RasterHeader } from '@formancy/report-spec'
/**
 * What report-spec decides of an SVG asset, handed on as the QR-bill's
 * decisions are (0030): `checkSvg`, which an engine applies to an SVG's
 * bytes before it draws them, accepting only the drawing `cleanSvg` writes,
 * with what it costs to draw and how far the numbers the converter writes
 * for it reach (`SvgExtent`); `cleanSvg`, for a host that approves assets
 * beside its render code; the refusal codes; `SVG_ELEMENTS`, the elements
 * an approved drawing is written with, which an engine's own guard holds
 * itself to; `MAX_SVG_BYTES`, the largest an SVG asset may be, which the
 * runtime holds an answer to; `MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS`,
 * what one page may cost a reader to paint, which an engine holds a page of
 * several SVGs to; and `MAX_SVG_COORDINATE` and `MAX_SVG_DEPTH`, which
 * bound the matrices a drawing is composed of, from which an engine derives
 * how far its own arithmetic may stray from that extent.
 */
export { checkSvg, cleanSvg, MAX_SVG_BYTES, MAX_SVG_COORDINATE, MAX_SVG_DEPTH, MAX_SVG_GROUPS, MAX_SVG_SEGMENTS, SVG_ELEMENTS, SVG_REFUSAL_CODES } from '@formancy/report-spec'
export type { CheckedSvg, CleanSvg, SvgExtent, SvgRefusal, SvgRefusalCode, SvgRemoval, SvgRemovalKind, SvgViewBox } from '@formancy/report-spec'
