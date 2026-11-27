/**
 * What someone writing a report from nothing has to be told: the format's
 * vocabularies, what an expression may read and as what, the bounds that
 * refuse a report, and the few facts that cost a model a turn (0088).
 *
 * Here rather than in whatever does the telling -- the MCP's
 * `describe_format` today, a model's briefing later -- because a fact stated
 * twice is true in one place after the next change to the format. Every
 * list is the constant it names, the very object, and every number a note
 * says is read from its constant; what is typed here is only what no
 * constant says, the notes, and each of them is something an author
 * writing from memory of other report writers gets wrong.
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
  MAX_DATASET_FIELDS,
  MAX_ERRORS,
  MAX_EXPRESSION_LENGTH,
  MAX_KEY_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LANGUAGES,
  MAX_NESTING_DEPTH,
  MAX_PARAMETERS,
  MAX_REGION_COMPONENTS,
  MAX_REPORT_BYTES,
  MAX_STYLES,
  MAX_TABLE_COLUMNS,
  MAX_TABLES,
  MAX_TEXT_LENGTH,
  MAX_WORDS,
  OPTIONAL_REGIONS,
  PAGE_SIZE_NAMES,
  PARAMETER_TYPES,
  REGION_NAMES,
  REPORT_FORMAT,
  REPORT_SPEC_VERSION,
  ROUNDING_MODES,
} from '@formancy/report-spec'
import { DIAGNOSTIC_SEVERITIES } from './diagnostics/codes.js'
import { EXPRESSION_TYPES, SCOPE_NAMES } from './expressions/members.js'

/**
 * The bounds a report is refused past, each under the name of the
 * report-spec constant it is, so that what an agent is told and what the
 * package exports are spelt alike.
 */
const BOUNDS = {
  MAX_REPORT_BYTES,
  MAX_ERRORS,
  MAX_REGION_COMPONENTS,
  MAX_NESTING_DEPTH,
  MAX_TABLES,
  MAX_TABLE_COLUMNS,
  MAX_DATASET_FIELDS,
  MAX_PARAMETERS,
  MAX_AGGREGATES,
  MAX_ASSETS,
  MAX_STYLES,
  MAX_KEY_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_EXPRESSION_LENGTH,
  MAX_LANGUAGES,
  MAX_WORDS,
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
    notes: [
      `A report is its own JSON document with reportSpecVersion "${REPORT_SPEC_VERSION}", the draft; a document of another version, or a formancy form, is refused whole, never partly read.`,
      'Exact values travel as strings with their type, never as JSON numbers: a decimal or integer parameter\'s default is "12.50" or "3". In an expression an exact number is dec("12.50"), and a division divide(dec(a), dec(b), places); a double, or `/`, is refused as inexact.',
      `A report reads at most two datasets, header, a single row, and detail, its rows; every table, chart and aggregate over rows reads the detail dataset, and a report holds at most ${String(MAX_TABLES)} tables over it.`,
      'An expression reads a member by its id, `params.<id>`, `header.<id>`, `row.<id>`, `totals.<id>`, `table.<id>` or `group.<id>`, only where its place binds that name, and never a name whole, as `size(params)` or `row[key]`; an image field is drawn and never read, and the clock and random draws are refused.',
      'A word is translated by its exact text in the report’s own language: each translation is { locale, words: [{ word, text }], expressions: [{ cel, expression }] }, a word keyed by the text the report prints and an expression by its source, never by a key of your own.',
      'A Swiss QR-bill is the report’s paymentPart, at most one, printed at the foot of its last page, and never a component of a region; an EPC QR code is a component, epcQrCode.',
      'An e-invoice is the report’s eInvoice, held to EN 16931 term by term: change one with updateEInvoice, and the account it shares with its QR-bill and every EPC QR code with setPaymentAccount, which writes it in all of them; the builders never add one from nothing, so begin from a report that carries one.',
      'Lengths are PDF points, 1/72 inch, written to the hundredth.',
      'A report is judged in the order a save and a render judge it: the validator’s errors refuse it everywhere, a diagnostic error refuses every render, and one that names a language refuses a render in that language alone; a warning prints as written.',
    ],
  }
}
