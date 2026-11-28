/**
 * What someone writing a report from nothing has to be told: the format's
 * vocabularies, what an expression may read and as what, the bounds that
 * refuse a report, and the few facts that cost a model a turn (0088).
 *
 * Here rather than in whatever does the telling -- the MCP's
 * `describe_format` today, a model's briefing later -- because a fact stated
 * twice is true in one place after the next change to the format. Every
 * list is the constant it names, the very object; every limit report-spec
 * exports is a bound here, or is named in facts.test.ts with why no report
 * written as JSON is refused past it; every name a note gives is typed
 * against what it names, and every number it says is read from its
 * constant; and facts.test.ts holds each note to what refuses what it
 * says. What is typed here is only the notes' words, and each note is
 * something an author writing from memory of other report writers gets
 * wrong.
 */
import {
  AGGREGATE_FUNCTIONS,
  COMPONENT_KINDS,
  DATASET_ROLES,
  EXPRESSION_NAMES,
  FIELD_TYPES,
  FONT_FAMILIES,
  FORMAT_KINDS,
  INLINE_KINDS,
  MAX_AGGREGATES,
  MAX_ASSETS,
  MAX_CHART_SERIES,
  MAX_COLUMNS,
  MAX_DATASET_FIELDS,
  MAX_EXPRESSION_LENGTH,
  MAX_FONT_SIZE,
  MAX_FOOTER_ROWS,
  MAX_FORM_MEMBER_LENGTH,
  MAX_FORM_OVERRIDES,
  MAX_FORM_PATH_KEYS,
  MAX_INLINES,
  MAX_KEEP_WITH_ROWS,
  MAX_KEY_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LANGUAGES,
  MAX_LENGTH_PT,
  MAX_NESTING_DEPTH,
  MAX_PARAMETERS,
  MAX_QR_BILL_ADDITIONAL_INFORMATION,
  MAX_REGION_COMPONENTS,
  MAX_REPORT_BYTES,
  MAX_SCALE,
  MAX_SORT_KEYS,
  MAX_STYLE_RULES,
  MAX_STYLES,
  MAX_TABLE_COLUMNS,
  MAX_TABLES,
  MAX_TEXT_LENGTH,
  MAX_VAT_CATEGORIES,
  MAX_WORDS,
  MIN_CHART_SIDE,
  MIN_COLUMNS,
  MIN_FONT_SIZE,
  MIN_PRINTABLE_PT,
  OPTIONAL_REGIONS,
  PAGE_SIZE_NAMES,
  PARAMETER_TYPES,
  REGION_NAMES,
  REPORT_FORMAT,
  REPORT_SPEC_VERSION,
  ROUNDING_MODES,
} from '@formancy/report-spec'
import type { ComponentKind, DatasetRole, ReportDefinition, TranslatedExpression, TranslatedWord, Translation } from '@formancy/report-spec'
import type { CommandName } from './commands/registry.js'
import { DIAGNOSTIC_SEVERITIES } from './diagnostics/codes.js'
import { EXPRESSION_TYPES, SCOPE_NAMES } from './expressions/members.js'
import type { ScopeName } from './expressions/members.js'

/**
 * The bounds a report written as JSON is refused past, each under the name
 * of the report-spec constant it is, so that what an agent is told and
 * what the package exports are spelt alike: every limit report-spec
 * exports but those of a file a report names by its digest, and the
 * number of errors the validator lists, which facts.test.ts names with
 * their reasons.
 */
const BOUNDS = {
  MAX_REPORT_BYTES,
  MAX_REGION_COMPONENTS,
  MAX_NESTING_DEPTH,
  MIN_COLUMNS,
  MAX_COLUMNS,
  MAX_TABLES,
  MAX_TABLE_COLUMNS,
  MAX_SORT_KEYS,
  MAX_FOOTER_ROWS,
  MAX_KEEP_WITH_ROWS,
  MAX_DATASET_FIELDS,
  MAX_FORM_PATH_KEYS,
  MAX_FORM_MEMBER_LENGTH,
  MAX_FORM_OVERRIDES,
  MAX_PARAMETERS,
  MAX_AGGREGATES,
  MAX_ASSETS,
  MAX_STYLES,
  MAX_STYLE_RULES,
  MAX_INLINES,
  MAX_KEY_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_EXPRESSION_LENGTH,
  MAX_SCALE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MAX_LENGTH_PT,
  MIN_PRINTABLE_PT,
  MAX_CHART_SERIES,
  MIN_CHART_SIDE,
  MAX_VAT_CATEGORIES,
  MAX_QR_BILL_ADDITIONAL_INFORMATION,
  MAX_LANGUAGES,
  MAX_WORDS,
} as const

/** The names the notes give, each typed against what it names, so that a rename there does not compile here. */
const VERSION = 'reportSpecVersion' satisfies keyof ReportDefinition
const PAYMENT_PART = 'paymentPart' satisfies keyof ReportDefinition
const E_INVOICE = 'eInvoice' satisfies keyof ReportDefinition
const TRANSLATIONS = 'translations' satisfies keyof ReportDefinition
const HEADER = 'header' satisfies DatasetRole
const DETAIL = 'detail' satisfies DatasetRole
const EPC_QR_CODE = 'epcQrCode' satisfies ComponentKind
const UPDATE_E_INVOICE = 'updateEInvoice' satisfies CommandName
const SET_PAYMENT_ACCOUNT = 'setPaymentAccount' satisfies CommandName
const READ = (['params', 'header', 'row', 'totals', 'table', 'group'] as const satisfies readonly ScopeName[]).map((name) => `${name}.<id>`)
const TRANSLATION = `{ ${'locale' satisfies keyof Translation}, ${'words' satisfies keyof Translation}: [{ ${'word' satisfies keyof TranslatedWord}, ${'text' satisfies keyof TranslatedWord} }], ${'expressions' satisfies keyof Translation}: [{ ${'cel' satisfies keyof TranslatedExpression}, ${'expression' satisfies keyof TranslatedExpression} }] }`

/**
 * What an author writing from memory of other report writers gets wrong,
 * each keyed by what it is about, in the order they meet it. facts.test.ts
 * holds each to the validator, the compiler or the command that refuses
 * what it says, and a note added without such a case does not compile
 * there.
 */
export const NOTES = {
  version: `A report is its own JSON document with ${VERSION} "${REPORT_SPEC_VERSION}", the draft; a document of another version, or a formancy form, is refused whole, never partly read.`,
  exact:
    'Exact values travel as strings with their type, never as JSON numbers: a decimal or integer parameter’s default is "12.50" or "3". In an expression an exact number is dec("12.50"), and a division divide(a, b, places) of two decimals, as divide(row.amount, dec("3"), 2); a double, as 1.5, is refused as inexact, and `/` is refused, as inexact on integers, whose remainder it drops, and as no operation on decimals.',
  datasets: `A report reads at most two datasets, ${HEADER}, a single row, and ${DETAIL}, its rows; every table, chart and aggregate over rows reads the ${DETAIL} dataset, and a report holds at most ${String(MAX_TABLES)} tables over it.`,
  reads: `An expression reads a member by its id, ${READ.join(', ')}, only where its place binds that name, and never a name whole or by a key computed as it renders, as size(params) or row[header.field]; an image field is drawn and never read, and the clock and random draws are refused.`,
  words: `A word is translated by its exact text in the report’s own language: each of ${TRANSLATIONS} is ${TRANSLATION}, a word keyed by the text the report prints and an expression by its source, never by a key of your own.`,
  qrBill: `A Swiss QR-bill is the report’s ${PAYMENT_PART}, at most one, printed at the foot of its last page, and never a component of a region; an EPC QR code is a component, ${EPC_QR_CODE}.`,
  eInvoice: `An e-invoice is the report’s ${E_INVOICE}, held to EN 16931 term by term: change one with ${UPDATE_E_INVOICE}, and the account it shares with its QR-bill and every EPC QR code with ${SET_PAYMENT_ACCOUNT}, which writes it in all of them.`,
  lengths: 'Lengths are PDF points, 1/72 inch, written to the hundredth.',
  order:
    'A report is judged in this order: the validator’s errors refuse a save, a diagnostic error refuses every render, and one that names a language refuses a render in that language alone; a warning prints as written.',
} as const

export interface ReportFacts {
  readonly format: typeof REPORT_FORMAT
  /** The one version this package reads; a report of another is refused whole. */
  readonly reportSpecVersion: typeof REPORT_SPEC_VERSION
  /** The regions, in the order a reader meets them; `optionalRegions` those a report may leave out. */
  readonly regions: typeof REGION_NAMES
  readonly optionalRegions: typeof OPTIONAL_REGIONS
  readonly componentKinds: typeof COMPONENT_KINDS
  /** The kinds of run a text's paragraph holds. */
  readonly inlineKinds: typeof INLINE_KINDS
  readonly datasetRoles: typeof DATASET_ROLES
  readonly fieldTypes: typeof FIELD_TYPES
  readonly parameterTypes: typeof PARAMETER_TYPES
  readonly aggregateFunctions: typeof AGGREGATE_FUNCTIONS
  readonly roundingModes: typeof ROUNDING_MODES
  readonly formatKinds: typeof FORMAT_KINDS
  readonly pageSizes: typeof PAGE_SIZE_NAMES
  /** The font tokens a print style names, each mapped to a face the host approved or printed in the renderer's own. */
  readonly fontFamilies: typeof FONT_FAMILIES
  /** Every name an expression may read, in some scope or in an e-invoice. */
  readonly scopes: typeof SCOPE_NAMES
  /** The names each place binds: `row` in a table's rows, `table` in its total rows and its group's header and footer, `group` in those, `params`, `header` and `totals` everywhere. */
  readonly namesByScope: typeof EXPRESSION_NAMES
  /** The CEL type each field and parameter type is read as. */
  readonly expressionTypes: typeof EXPRESSION_TYPES
  /** Every code a diagnostic of a valid report gives, with the severity it always has. */
  readonly diagnostics: typeof DIAGNOSTIC_SEVERITIES
  /** Every bound a report written as JSON is refused past, by its constant's name. */
  readonly bounds: typeof BOUNDS
  /** What an author writing from memory of other report writers gets wrong, in the order they meet it. */
  readonly notes: readonly string[]
}

export function reportFacts(): ReportFacts {
  return {
    format: REPORT_FORMAT,
    reportSpecVersion: REPORT_SPEC_VERSION,
    regions: REGION_NAMES,
    optionalRegions: OPTIONAL_REGIONS,
    componentKinds: COMPONENT_KINDS,
    inlineKinds: INLINE_KINDS,
    datasetRoles: DATASET_ROLES,
    fieldTypes: FIELD_TYPES,
    parameterTypes: PARAMETER_TYPES,
    aggregateFunctions: AGGREGATE_FUNCTIONS,
    roundingModes: ROUNDING_MODES,
    formatKinds: FORMAT_KINDS,
    pageSizes: PAGE_SIZE_NAMES,
    fontFamilies: FONT_FAMILIES,
    scopes: SCOPE_NAMES,
    namesByScope: EXPRESSION_NAMES,
    expressionTypes: EXPRESSION_TYPES,
    diagnostics: DIAGNOSTIC_SEVERITIES,
    bounds: BOUNDS,
    notes: Object.values(NOTES),
  }
}
