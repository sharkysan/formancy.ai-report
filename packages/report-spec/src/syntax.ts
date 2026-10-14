/**
 * What a valid string looks like, for each string in a report that has a
 * syntax. One pattern per thing, so the validator and an editor checking a
 * value as it is typed cannot disagree.
 *
 * Each accepts one spelling of each value -- lower-case hex, canonical
 * locale case, no negative zero -- so that one value has one canonical hash.
 */

/**
 * Identifiers: lower-case letters, digits and hyphens, starting with a
 * letter, at most 64 characters. The names a deployment resolves -- a
 * dataset, an asset -- are written this way, as formancy writes a named
 * options source (formancy.ai 0077), and so are the format's structural
 * names: components, styles, table columns.
 */
const IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/

/** Whether `value` is an identifier a report can use for a component, style, dataset, asset or table column. */
export function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value)
}

/**
 * Field keys: formancy's `fieldKey` exactly -- letters, digits and
 * underscores, starting with a letter or an underscore, at most 64
 * characters, the case part of the key. The names an expression reads are
 * written this way: a dataset field, a parameter, an aggregate. So a form's
 * or a dataset's key is the report's key unrenamed, and CEL reads it with a
 * dot, `row.unitPrice`, where a hyphen would read as a subtraction.
 */
const FIELD_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

/** Whether `value` is a field key: the id of a dataset field, a parameter or an aggregate. */
export function isFieldKey(value: unknown): value is string {
  return typeof value === 'string' && FIELD_KEY.test(value)
}

/** A formancy form's id, as its schema writes one (`formId`): at most 128 characters. */
export const FORM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/**
 * The BCP 47 subset a report's locale may be: a language (2-3 letters), an
 * optional script (4 letters, title case) and an optional region (2 letters
 * upper case, or 3 digits) -- 'en', 'de-CH', 'zh-Hans-CN', 'es-419'.
 * Variants, extensions and private use are refused rather than half-read,
 * and a regular expression rather than Intl decides, because Intl's
 * canonicalisation differs between ICU versions and a template must
 * validate the same in every runtime.
 */
export const LOCALE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/

/** A colour: `#rrggbb`, lower case. */
export const COLOR = /^#[0-9a-f]{6}$/

/** An ISO 4217 currency code, upper case. */
export const CURRENCY = /^[A-Z]{3}$/

/** An asset's content digest: SHA-256, lower-case hex. */
export const DIGEST = /^sha256:[0-9a-f]{64}$/

/** A form version's hash, as `@formancy/spec`'s `schemaHash` writes it: 64 lower-case hex digits. */
export const SCHEMA_HASH = /^[0-9a-f]{64}$/

/** An exact integer as a string: no sign but '-', no leading zeros, no exponent, and no '-0'. */
export const INTEGER = /^(?:0|-?[1-9]\d*)$/

/**
 * An exact decimal as a string: an integer, optionally a point and at least
 * one digit. Trailing zeros are kept, because they say the scale ('1.50' has
 * two places); a negative zero ('-0', '-0.00') is refused.
 */
export const DECIMAL = /^(?:-?[1-9]\d*(?:\.\d+)?|0(?:\.\d+)?|-0\.\d*[1-9]\d*)$/

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Whether `value` is a calendar date written YYYY-MM-DD: 2024-02-29 is one, 2026-02-29 is not. */
export function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value)
  if (match === null) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1) return false
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const days = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31
  return day <= days
}
