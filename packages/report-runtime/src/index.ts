export { MAX_ASSET_BYTES, REFUSAL_CODES, RenderRefusal } from './document.js'
export type {
  Block,
  Columns,
  ColumnSlot,
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
} from './document.js'

export { checkData, CONSISTENCY_MODES, DATA_MODES, MAX_DETAIL_ROWS } from './data.js'
export type { CheckedData, CheckedRecord, Completeness, Consistency, DataCheck, DataCheckOptions, DataMode, ReportData } from './data.js'
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

export { resolveReport, PREVIEW_LABEL } from './resolve.js'
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
