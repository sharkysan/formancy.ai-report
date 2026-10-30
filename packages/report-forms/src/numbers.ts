/**
 * The number rule (0042). A formancy `number` answer is a JavaScript
 * number, a double: formancy's engine checks `typeof value === 'number'`
 * and stores what the control gave it. A report prints exact digits, and
 * the runtime refuses a decimal as a number (0010). So the double that is
 * already in the submission is turned into its digits here, once, and
 * digits are never turned into a double:
 *
 * - **An integer field** reads a safe integer, as its digits. Past 2^53 a
 *   double has lost its last digits, and a fraction is not a count.
 * - **A decimal field** reads a safe integer as its digits, and any other
 *   number nearer zero than 2^53 as the shortest decimal that is that
 *   double, written without an exponent, when that decimal has at most 15
 *   significant digits. Every decimal of 15 digits or fewer below 2^53
 *   that a person typed comes back so, as exactly what was typed less its
 *   trailing zeros (`numbers.test.ts` holds it from 10^-300 to below
 *   10^15, and past that every such decimal is a safe integer), so this
 *   prints what was typed. A double whose shortest decimal is longer came
 *   from arithmetic -- a computed `0.1 + 0.2` -- or from more digits than
 *   a double keeps, and is refused, never rounded. Past 2^53 a double is
 *   refused as it is for an integer field, however short its shortest
 *   decimal: it has lost its last digits, and a typed 10000000000000001
 *   is stored as 1e16. Below the smallest normal double, two typed
 *   decimals can be one double, so a number there is refused too.
 *
 * What the rule cannot see: a decimal of more than 15 digits that formancy
 * stored as a double whose shortest decimal is short. A typed
 * 0.10000000000000001 is stored as 0.1, and prints as 0.1, since nothing in
 * the double says otherwise.
 */

/** Significant digits a double keeps of any decimal typed into it: IEEE 754's 15. */
export const MAX_EXACT_DIGITS = 15

/** The smallest normal double. Below it a double has fewer bits, and 15 digits no longer come back. */
const MIN_NORMAL = 2 ** -1022

export type NumberDigits = { readonly ok: true; readonly digits: string } | { readonly ok: false; readonly message: string }

const refused = (message: string): NumberDigits => ({ ok: false, message })

const PAST_SAFE = 'a number past 2^53, which a double holds without its last digits'

/** `value` as an integer field prints it: a safe integer's digits, or why not. */
export function integerDigits(value: number): NumberDigits {
  // String(-0) is '0': an integer has one spelling of zero.
  if (Number.isSafeInteger(value)) return { ok: true, digits: String(value) }
  if (Number.isInteger(value)) return refused(`${PAST_SAFE}; an integer field prints every digit or none`)
  return refused('a number with a fraction, or one that is not finite, read into an integer field, which prints whole numbers and never rounds one')
}

/**
 * The digits a fraction's `exponent` places them at, written out: `12345`
 * at 2 is `123.45`, at -3 `0.0012345`. A number the rule writes so has a
 * fraction, so its point stands before its last digit.
 */
function written(digits: string, exponent: number): string {
  const point = exponent + 1
  return point > 0 ? `${digits.slice(0, point)}.${digits.slice(point)}` : `0.${'0'.repeat(-point)}${digits}`
}

/** `value` as a decimal field prints it: a safe integer's digits, or its shortest decimal when that has at most 15 significant digits, or why not. */
export function decimalDigits(value: number): NumberDigits {
  if (!Number.isFinite(value)) return refused('a number that is not finite has no digits to print')
  if (Number.isSafeInteger(value)) return { ok: true, digits: String(value) }
  // Every double past 2^53 is a whole number, and none of them holds its last digits.
  if (Number.isInteger(value)) return refused(`${PAST_SAFE}, so it is refused, never printed as another number`)
  if (Math.abs(value) < MIN_NORMAL)
    return refused('a number nearer zero than the smallest normal double, where two decimals a person typed can be one number; it is refused, never rounded')
  // toExponential() without an argument writes the shortest digits that are
  // this double, one before the point: `-1.2345e-3`.
  const [mantissa = '', exponent = '0'] = value.toExponential().split('e')
  const digits = mantissa.replace('-', '').replace('.', '')
  if (digits.length > MAX_EXACT_DIGITS) {
    return refused(
      `a number of more than ${MAX_EXACT_DIGITS} significant digits: arithmetic made it, or more digits were typed than a double keeps, and printed it would be a number nobody wrote; it is refused, never rounded`,
    )
  }
  return { ok: true, digits: `${value < 0 ? '-' : ''}${written(digits, Number(exponent))}` }
}
