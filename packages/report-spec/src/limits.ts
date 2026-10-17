/**
 * The bounds a report definition is held to, and why each exists.
 *
 * A template is untrusted input, even when an administrator wrote it. Every
 * array, string and number in it is bounded, so that validating, hashing,
 * editing and later laying one out costs work that does not grow with
 * whatever a broken or hostile document holds. An array is measured before
 * any element of it is read.
 *
 * The numbers are chosen, not measured: each sits well above what the three
 * starter reports need (plan 7) and low enough to keep that work small. Two
 * are not chosen, and say where they come from. Raising a bound is safe;
 * lowering one refuses reports that were valid, which once the format is
 * frozen means a new reportSpecVersion.
 */

/**
 * Errors listed per validation. Past it, one `too-many-errors` entry says
 * the list was cut short, so a caller never mistakes a partial list for a
 * whole one. Enough to fix a broken template in one pass; not so many that
 * a document of junk produces megabytes of messages.
 */
export const MAX_ERRORS = 100

/**
 * Components in one region, counting those inside containers, so wrapping
 * components in a container does not get round it. A printed page holds a
 * few dozen blocks; a region of five hundred is a document that should be
 * two.
 */
export const MAX_REGION_COMPONENTS = 500

/**
 * How deep containers (columns, keep-together blocks) nest. A container
 * inside four others is refused. Every stage that walks the tree --
 * validation, the core's commands, the runtime, the layout -- recurses this
 * deep and no deeper, and nesting past it is a layout no reader follows.
 */
export const MAX_NESTING_DEPTH = 4

/** Columns in a columns block: fewer than two is not columns; more than four on A4 is too narrow to read. */
export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 4

/** Columns in a table: wider than a landscape page can show legibly, and a bound on per-row work. */
export const MAX_TABLE_COLUMNS = 32

/** Sort keys on a table. Each one costs a comparison per row pair; a longer sort is usually a missing key. */
export const MAX_SORT_KEYS = 8

/** Rows under a group or under the table: a subtotal, a discount, two tax lines and a total fit with room to spare. */
export const MAX_FOOTER_ROWS = 8

/** Fields in one dataset contract: a report prints a fraction of any source table's columns. */
export const MAX_DATASET_FIELDS = 64

/** Print styles in one report. A report's look is a handful of tokens; this is many handfuls. */
export const MAX_STYLES = 64

/** Conditional style rules on one component or column. Each is an expression evaluated per render or per row. */
export const MAX_STYLE_RULES = 8

/** Parameters: each is a field on the parameter form a person fills in before rendering. */
export const MAX_PARAMETERS = 32

/** Asset references: each is a lookup and a byte budget at render time. */
export const MAX_ASSETS = 64

/** Aggregates: each is a pass over the detail rows, per group and once overall. */
export const MAX_AGGREGATES = 32

/**
 * VAT categories an e-invoice declares, each a VAT breakdown (BG-23) its
 * XML writes and a basis and an amount its page reads. Germany's two rates,
 * an exempt category and a reverse-charged one take four; eight is twice
 * that, and a list of breakdowns no invoice prints is refused unread.
 */
export const MAX_VAT_CATEGORIES = 8

/** Inline runs in one paragraph or group header. A paragraph with more bindings than this is a table. */
export const MAX_INLINES = 64

/**
 * Characters in a property name. The format's own names are short and its
 * ids are at most 64 characters, so a longer name is never one it knows. It
 * is refused before a path is built from it, so that no path and no message
 * grows with what a document holds.
 */
export const MAX_KEY_LENGTH = 64

/** Characters (UTF-16 code units, as JavaScript counts) in a literal run of text: several pages of prose. */
export const MAX_TEXT_LENGTH = 10_000

/** Characters in a title, label, column header, empty-state text or parameter default: one line, generously. */
export const MAX_LABEL_LENGTH = 200

/** Characters in a CEL expression. An expression is a formula, not a program; the runtime bounds its evaluation too. */
export const MAX_EXPRESSION_LENGTH = 1024

/** Digits after the decimal point, for fields, formats and rounding. Covers every currency's minor unit and unit prices to many places. */
export const MAX_SCALE = 20

/** Font sizes in points: below 4 is not legible print, above 96 is a poster. */
export const MIN_FONT_SIZE = 4
export const MAX_FONT_SIZE = 96

/**
 * The longest length anything in a report may have, in points. Not chosen:
 * 14,400 units (200 inches) is the largest page dimension PDF readers
 * implement (ISO 32000-1, Annex C), so nothing longer can appear on a page.
 */
export const MAX_LENGTH_PT = 14_400

/**
 * The smallest printable area the margins may leave, each way: one inch,
 * 72 points. Not chosen so much as named: less than an inch of width does
 * not hold a word of body text.
 */
export const MIN_PRINTABLE_PT = 72
