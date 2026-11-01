/**
 * What validation can say is wrong with a report, as stable codes.
 *
 * A code is for a program -- the builder links it to a property editor, a
 * test asserts it -- and the message is for a person. Codes are never
 * reworded once released; a new rule gets a new code. Each has a refusal
 * test in `validate.test.ts`, which does not compile while one is missing.
 */
export const REPORT_ERROR_CODES = [
  // The document as a whole.
  /** Not a report definition at all; a formancy form is named as one. */
  'not-a-report',
  /** A report of a version this package does not read. */
  'unsupported-version',
  /** A value JSON cannot hold: undefined, NaN, a function, an accessor, an array hole, an object that throws when read. */
  'not-json',
  /** More errors were found than are listed. */
  'too-many-errors',

  // Shape: what a property must be.
  'wrong-type',
  'missing-property',
  /** A property this version does not know; shapes are strict. */
  'unknown-property',
  /** A component, inline, format or value of a kind this version does not know. */
  'unknown-kind',
  'not-one-of',
  'out-of-range',
  'not-an-integer',
  /** A length finer than the hundredth of a point lengths are stored to. */
  'too-precise',
  /** A string, or a property name, past its bound. */
  'too-long',
  /** An array past its bound, or a region past its component budget. */
  'too-many',
  'too-few',
  /** A CEL expression that is empty or only whitespace. */
  'empty-expression',

  // Strings with a syntax.
  'invalid-id',
  'invalid-locale',
  'invalid-color',
  'invalid-currency',
  'invalid-digest',
  /** A parameter default its own type would refuse. */
  'invalid-default',
  /** Where a dataset is read from a formancy form: a data path or a repeater that is not field keys joined by dots, or an empty member (0042). */
  'invalid-form-path',
  /** A string that should hold an exact decimal and does not. */
  'invalid-decimal',
  /**
   * A text of a QR-bill that no data can change, which SIX's rules for the
   * QR-bill refuse: an account, a reference, a part of an address, the
   * message or the billing information; or an account, a reference and a
   * currency that do not go together.
   */
  'invalid-qr-bill',
  /**
   * An EPC QR code the EPC's guidelines refuse where it is written: a
   * literal IBAN, BIC, name, reference, text, information or purpose that
   * breaks its rule; a BIC an IBAN does not go with, or none where one is
   * needed; a reference and a text together; literal texts that pass 331
   * bytes alone; or, with Austria's caption, a size in which no version
   * prints the modules the PSA allows.
   */
  'invalid-epc-qr-code',
  /**
   * An e-invoice that EN 16931's rules, or this version's narrower ones,
   * refuse where it is written, each refusal naming the business term and
   * the rule: a literal text, code or rate that breaks its rule; a seller,
   * a buyer, a time of supply, a period or VAT categories that cannot make
   * a valid invoice; lines that are not what the table over the detail
   * dataset prints; a QR-bill or an EPC QR code that asks to be paid
   * otherwise than the e-invoice says; or a title its PDF/A cannot hold.
   */
  'invalid-e-invoice',
  /**
   * A chart that says what no reader could use: a series label or empty
   * text that is blank; a palette that names a colour twice; a pie of
   * more than one series, of a function outside `PIE_FUNCTIONS`, or with
   * an axis title; or a line chart with value labels over more than one
   * series.
   */
  'invalid-chart',

  // Declarations.
  /** Margins that leave less than MIN_PRINTABLE_PT either way. */
  'printable-area-too-small',
  'scale-on-non-decimal',
  /** Two declarations with one id in one list: styles, fields, parameters, assets, aggregates, or the two datasets. */
  'duplicate-id',
  /** An id the format gives a meaning of its own: an aggregate called `key`, which `group.key` reads as the value grouped by. */
  'reserved-id',
  /**
   * A dataset read from a formancy form that is not read whole: a field of
   * one that says nowhere it is read, a field that says where in a dataset
   * read from none, or one dataset read from a form beside one that is not
   * (0042).
   */
  'incomplete-form-binding',
  /** A dataset that reads what it is not from a form: the header rows, the detail one record, or a header beside a detail of one row per submission (0042). */
  'misplaced-form-binding',
  /**
   * An override of a binding for one form version (0048) that says both a
   * path and nothing, or neither, or that prints nothing of a field that
   * may not be null.
   */
  'invalid-form-override',

  // References to what the report declares.
  'unknown-style',
  'unknown-dataset',
  'unknown-field',
  'unknown-parameter',
  'unknown-asset',
  'unknown-aggregate',
  'unknown-column',
  /** A font token mapped to an asset that is an image, not a font. */
  'asset-not-a-font',
  /** An image that draws a font asset, which is not a picture. */
  'asset-not-an-image',
  /** A print style that sets bold or italic in a mapped font family that has no bold, italic or bold-italic face; a face is never synthesised. */
  'missing-face',

  // Placement and structure.
  /** A table, page break or keep-together block outside the body and the summary. */
  'misplaced-flow-component',
  /** A table or page break inside a columns or keep-together block. */
  'nested-flow-component',
  /** A page number or count outside the page header and footer, or anywhere in what a QR code, an EPC QR code, a QR-bill or an e-invoice encodes. */
  'misplaced-page-counter',
  /** A detail field where there is no current row: outside the table's cells, or in a group header or footer when it is not the field grouped by. */
  'misplaced-detail-field',
  /** A group's aggregate outside a group header or footer. */
  'misplaced-group-aggregate',
  /** A second table over the detail dataset. */
  'second-detail-table',
  'nesting-too-deep',
  /** Two components with one id, anywhere in the report. */
  'duplicate-component-id',
  /** Two columns with one id in one table. */
  'duplicate-column-id',
  /** Two cells for one column in one footer row. */
  'duplicate-footer-cell',
  /** A field sorted by twice, or sorted by and grouped by: the second key orders nothing. */
  'duplicate-sort-key',
  /** A fixed size larger than the page's printable area: an image, a QR code, a rectangle, a spacer, or the fixed widths of a table or a columns block. */
  'exceeds-printable-area',
  /** A payment part on a page it is not printed on: a QR-bill is printed across the foot of an A4 page in portrait, below the top margin. */
  'payment-part-page',

  // Types meeting.
  /** An aggregate over a field of a type it cannot take. */
  'aggregate-type-mismatch',
  /** A number, currency or date format over a value of a type it does not format. */
  'format-type-mismatch',
  /** A field or parameter bound where its type does not fit: an image field printed, sorted or grouped by; a field that is not an image drawn as one; a currency that is not a string; a choice of a form read into a field that is not a string (0042). */
  'binding-type-mismatch',
] as const

export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[number]

export interface ReportError {
  /** A JSON Pointer (RFC 6901) to what is wrong; '' is the whole document. */
  readonly path: string
  readonly code: ReportErrorCode
  readonly message: string
  /** The innermost component the error is inside, when it is inside one whose id could be read. */
  readonly componentId?: string
}

/** Errors as one line of text, for an exception that has to carry them: each its code, path and message. */
export function describeErrors(errors: readonly ReportError[]): string {
  return errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('; ')
}
