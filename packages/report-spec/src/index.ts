export { checkSpecVersion, REPORT_FORMAT, REPORT_SPEC_VERSION } from './version.js'
export type { SpecVersionCheck } from './version.js'

export { ORIENTATIONS, PAGE_SIZE_NAMES } from './page.js'
export type { Margins, Orientation, PageSettings, PageSizeName } from './page.js'
export { ALIGNMENTS, FONT_FAMILIES } from './styles.js'
export type { Alignment, FontFamily, PrintStyle, StyleRule } from './styles.js'
export { DATASET_FORM_KINDS, DATASET_ROLES, FIELD_TYPES, FORM_READS, PARAMETER_TYPES } from './data.js'
export type {
  DatasetContract,
  DatasetFormBinding,
  DatasetFormKind,
  DatasetRole,
  Datasets,
  FieldContract,
  FieldFormBinding,
  FieldFormOverride,
  FieldRef,
  FieldType,
  FormRead,
  ParameterDef,
  ParameterType,
} from './data.js'
export { ASSET_AND_FONT_MEDIA_TYPES, ASSET_MEDIA_TYPES, FONT_MEDIA_TYPES, isFontMediaType } from './assets.js'
export type { AnyAssetMediaType, AssetMediaType, AssetRef, FontMediaType } from './assets.js'
export { FONT_FACE_KEYS, faceKey } from './font-map.js'
export type { FontFaceKey, FontFaces, FontMap } from './font-map.js'
export { BIDI_CONTROLS, PRINTED_BLOCKS, refusedCharacter, UNICODE_VERSION } from './font-scripts.js'
export type { CharacterRefusal, PrintedBlock } from './font-scripts.js'
export {
  AGGREGATE_SCOPES,
  CURRENCY_SOURCE_KINDS,
  DATE_STYLES,
  EXPRESSION_NAMES,
  FORMAT_KINDS,
  GROUP_KEY,
  INLINE_KINDS,
  TEXT_TRANSFORMS,
  VALUE_SCOPES,
} from './values.js'
export type {
  AggregateInline,
  AggregateScope,
  CurrencyFormat,
  CurrencySource,
  CurrencySourceKind,
  DateFormat,
  DateStyle,
  Expression,
  ExpressionInline,
  FieldInline,
  Format,
  FormatKind,
  Inline,
  InlineKind,
  NumberFormat,
  PageCountInline,
  PageNumberInline,
  ParameterInline,
  TextFormat,
  TextInline,
  TextTransform,
  ValueScope,
} from './values.js'
export { AGGREGATE_FUNCTIONS, ROUNDING_MODES } from './aggregates.js'
export type { AggregateDef, AggregateFunction, Rounding, RoundingMode, RowValue } from './aggregates.js'
export { COMPONENT_KINDS, IMAGE_FITS, IMAGE_SOURCE_KINDS, QR_ERROR_CORRECTION } from './components.js'
export type {
  Border,
  ColumnsComponent,
  ColumnSlot,
  Component,
  ComponentBase,
  ComponentKind,
  ImageComponent,
  ImageFit,
  ImageSource,
  ImageSourceKind,
  KeepTogetherComponent,
  LineComponent,
  PageBreakComponent,
  QrCodeComponent,
  QrErrorCorrection,
  RectangleComponent,
  SectionComponent,
  SpacerComponent,
  TextComponent,
  Width,
} from './components.js'
export { CHART_CATEGORY_TYPES, CHART_KINDS, CHART_ORDERS, CHART_PALETTE, PIE_FUNCTIONS } from './chart.js'
export type { ChartCategory, ChartComponent, ChartKind, ChartOrder, ChartSeries } from './chart.js'
export { SORT_DIRECTIONS } from './table.js'
export type { SortDirection, SortKey, TableColumn, TableComponent, TableFooterCell, TableFooterRow, TableGroup } from './table.js'
export { PROVENANCE_KINDS, REGION_NAMES } from './definition.js'
export type { Provenance, ProvenanceKind, RegionName, Regions, ReportDefinition } from './definition.js'

export { PAYMENT_PART_KINDS, QR_BILL_CURRENCIES, QR_BILL_LANGUAGES } from './payment-part.js'
export type { PaymentPart, PaymentPartKind, QrBillAddress, QrBillCurrency, QrBillLanguage, SwissQrBill } from './payment-part.js'
export {
  checkQrBillAccount,
  checkQrBillAdditionalInformation,
  checkQrBillAmount,
  checkQrBillReference,
  checkQrBillText,
  MAX_QR_BILL_ADDITIONAL_INFORMATION,
  QR_BILL_ADDRESS_RULES,
  QR_BILL_BILLING_RULE,
  QR_BILL_EXAMPLE,
  QR_BILL_EXAMPLE_ACCOUNTS,
  QR_BILL_MESSAGE_RULE,
  QR_BILL_SIZE,
  QR_BILL_TOP,
  qrBillPageBreak,
  qrBillPairing,
} from './qr-bill.js'
export type { QrBillAccount, QrBillCheck, QrBillPageBreak, QrBillPairingBreak, QrBillReference, QrBillReferenceType, QrBillTextRule } from './qr-bill.js'

export type { PaymentCheck } from './payment-reference.js'

export { EPC_CAPTIONS } from './epc-qr-code.js'
export type { EpcCaption, EpcQrCodeComponent } from './epc-qr-code.js'
export {
  checkEpcAmount,
  checkEpcBic,
  checkEpcField,
  checkEpcIban,
  checkEpcPayload,
  checkEpcPurpose,
  checkEpcReference,
  checkEpcText,
  EPC_BENEFICIARY_RULE,
  EPC_INFORMATION_RULE,
  EPC_MAX_BYTES,
  EPC_TEXT_FIELDS,
  EPC_TEXT_RULE,
  epcBlank,
  epcPairing,
  epcPayload,
  utf8Length,
} from './epc-payload.js'
export type { EpcPairingBreak, EpcPayloadFields, EpcTextField, EpcTextFieldRule, EpcTextRule } from './epc-payload.js'
export { EPC_CAPTION, EPC_CAPTION_MODULE, EPC_FRAME, EPC_MAX_VERSION, epcCaptionBreak, epcLeastVersion, epcModule, qrSymbolModules } from './epc-print.js'

export {
  COUNTRY_CODES,
  E_INVOICE_CURRENCIES,
  ADDRESS_SCHEMES,
  E_INVOICE_KINDS,
  E_INVOICE_NAMES,
  E_INVOICE_PROFILES,
  FACTUR_X,
  FACTUR_X_PROFILES,
  INVOICE_TOTALS,
  INVOICE_TYPE_CODES,
  PAYMENT_MEANS_CODES,
  SCHEME_IDS,
  UNIT_CODES,
  VAT_BREAKDOWN,
  VAT_CATEGORY_CODES,
  VAT_PREFIXES,
  XRECHNUNG,
  XRECHNUNG_VERSIONS,
} from './e-invoice.js'
export type {
  AddressScheme,
  CountryCode,
  EInvoice,
  EInvoiceAddress,
  EInvoiceBuyer,
  EInvoiceCurrency,
  EInvoiceKind,
  EInvoiceLines,
  EInvoiceName,
  EInvoiceProfile,
  EInvoiceSeller,
  EInvoiceTerms,
  ElectronicAddress,
  FacturXInvoice,
  FacturXProfileTerms,
  InvoiceTotal,
  InvoiceTypeCode,
  InvoicingPeriod,
  LegalIdentifier,
  PaymentInstructions,
  PaymentMeansCode,
  SchemeId,
  SellerContact,
  UnitCode,
  VatCategory,
  VatCategoryCode,
  XRechnungInvoice,
  XRechnungTerms,
  XRechnungVersion,
} from './e-invoice.js'
export { EN16931_RULES, en16931Rule, FULL_ADDRESS, neededBy } from './en16931.js'
export type { EInvoiceNeed, En16931Rule } from './en16931.js'
export {
  checkAddressScheme,
  checkCountryCode,
  checkEInvoiceText,
  checkElectronicAddress,
  checkSchemeId,
  checkUnitCode,
  checkVatIdentifier,
  E_INVOICE_KIND_TEXTS,
  E_INVOICE_TEXT_TERMS,
  E_INVOICE_TEXTS,
  eInvoiceBlank,
  xmlCharacterBreak,
} from './en16931-texts.js'
export type { EInvoiceTextRule, EInvoiceTextRules, EInvoiceTextTerm, EInvoiceTextTerms } from './en16931-texts.js'
export { checkEInvoiceDecimal, E_INVOICE_DECIMALS } from './en16931-decimals.js'
export type { EInvoiceDecimalRule, EInvoiceDecimalTerm } from './en16931-decimals.js'
export { checkEInvoiceDate, checkInvoicingPeriod, E_INVOICE_DATES, periodBreak, supplyBreak } from './en16931-dates.js'
export type { EInvoiceDateRule, EInvoiceDateTerm } from './en16931-dates.js'
export { E_INVOICE_LINE_CODES, E_INVOICE_LINE_COLUMNS } from './en16931-lines.js'
export type { EInvoiceLineCode, EInvoiceLineColumn, EInvoiceLineTerm } from './en16931-lines.js'
export { buyerIdentificationBreak, checkLineCategory, checkVatRate, sellerIdentificationBreaks, vatCategoryBreaks, vatReasonBreak } from './en16931-vat.js'
export type { VatCategoryBreak } from './en16931-vat.js'
export {
  isXRechnungRule,
  leitwegIdBreak,
  skontoBreak,
  XRECHNUNG_HELD,
  XRECHNUNG_NEEDS,
  XRECHNUNG_PATTERNS,
  XRECHNUNG_RULES,
  XRECHNUNG_TEXT_NEEDS,
  xrechnungRule,
} from './xrechnung.js'
export type { XRechnungNeed, XRechnungPattern, XRechnungRule } from './xrechnung.js'

export { validateReport } from './validate.js'
export type { ReportValidation } from './validate.js'
export { REPORT_ERROR_CODES } from './errors.js'
export type { ReportError, ReportErrorCode } from './errors.js'
export {
  MAX_AGGREGATES,
  MAX_ASSET_BYTES,
  MAX_ASSET_SIDE,
  MAX_ASSETS,
  MAX_CHART_SERIES,
  MAX_COLUMNS,
  MAX_DATASET_FIELDS,
  MAX_ERRORS,
  MAX_EXPRESSION_LENGTH,
  MAX_FONT_BYTES,
  MAX_FONT_CHARACTERS,
  MAX_FONT_COMPONENTS,
  MAX_FONT_GLYPH_WORK,
  MAX_FONT_LINE,
  MAX_FONT_OUTLINE_WORK,
  MAX_FONT_POINTS,
  MAX_FONT_SIZE,
  MAX_FOOTER_ROWS,
  MAX_FORM_MEMBER_LENGTH,
  MAX_FORM_OVERRIDES,
  MAX_FORM_PATH_KEYS,
  MAX_INLINES,
  MAX_KEY_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LENGTH_PT,
  MAX_NESTING_DEPTH,
  MAX_PARAMETERS,
  MAX_REGION_COMPONENTS,
  MAX_REPORT_BYTES,
  MAX_SCALE,
  MAX_SORT_KEYS,
  MAX_STYLE_RULES,
  MAX_STYLES,
  MAX_SVG_BYTES,
  MAX_SVG_CASCADE,
  MAX_SVG_COORDINATE,
  MAX_SVG_DASHES,
  MAX_SVG_DEPTH,
  MAX_SVG_ELEMENTS,
  MAX_SVG_GROUPS,
  MAX_SVG_REMOVED_NAMES,
  MAX_SVG_RULES,
  MAX_SVG_SEGMENTS,
  MAX_SVG_STOPS,
  MAX_TABLE_COLUMNS,
  MAX_TEXT_LENGTH,
  MAX_VAT_CATEGORIES,
  MIN_CHART_SIDE,
  MIN_COLUMNS,
  MIN_FONT_LINE,
  MIN_FONT_SIZE,
  MIN_PRINTABLE_PT,
} from './limits.js'
export { isDigest, isFieldKey, isFormId, isFormPath, isIdentifier, isSchemaHash } from './syntax.js'

export { assetDigest } from './digest.js'
export { IMAGE_REFUSAL_CODES, imageHeader, sniffImage } from './image-header.js'
export type { ImageRefusal, ImageRefusalCode, JpegHeader, PngHeader, RasterHeader } from './image-header.js'

export { checkSvg, cleanSvg } from './svg.js'
export type { CheckedSvg, CleanSvg } from './svg.js'
export type { SvgExtent } from './svg-extent.js'
export { SVG_REFUSAL_CODES } from './svg-refusal.js'
export { KEPT_ELEMENTS as SVG_ELEMENTS } from './svg-allow.js'
export type { SvgRefusal, SvgRefusalCode, SvgRemoval, SvgRemovalKind } from './svg-refusal.js'
export type { ViewBox as SvgViewBox } from './svg-drawing.js'

export { readFont } from './font.js'
export type { Font, FontMetrics, FontStyle } from './font.js'
export { characterMap } from './font-cmap.js'
export type { FontCharacters } from './font-cmap.js'
export type { FontNames } from './font-names.js'
export type { FontEmbedding } from './font-tables.js'
export { FONT_EMBEDDING_REFUSALS, FONT_FORMATS, FONT_REFUSAL_CODES } from './font-refusal.js'
export type { FontEmbeddingRefusal, FontFormat, FontRefusal, FontRefusalCode } from './font-refusal.js'

export { reportHash } from './hash.js'
export { emptyReport } from './empty.js'
export { componentAt, walkComponents } from './walk.js'
export type { ComponentLocation } from './walk.js'
export { MILLIMETRES_PER_INCH, mmToPt, POINTS_PER_INCH, ptToMm, roundPt } from './units.js'
export { PAGE_SIZES, pageDimensions, printableArea, squareRoom } from './page.js'
export type { PageDimensions } from './page.js'
