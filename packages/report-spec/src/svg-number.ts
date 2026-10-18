/**
 * The numbers of an SVG: read by SVG's number grammar, bounded, and written
 * back in one form every reader reads alike.
 *
 * A number is kept exactly where it can be: as an integer and a count of
 * decimal places, when the file wrote it in nine places or fewer. A
 * coordinate a path reaches by relative steps is then their exact decimal
 * sum, not the float sum -- `l.1.2` twice is at 0.2 0.4, never at
 * 0.20000000000000001 -- so the written form grows no digits the author did
 * not write, and never moves a point the author drew. Past nine places, and
 * for what is computed rather than written (a unit converted, a transform
 * composed), the number is the float, written as JavaScript's shortest
 * round trip. Either way, reading the written form again gives the same
 * number and writes the same text: the fixed point `checkSvg` tests for.
 *
 * A magnitude below 10^-6 is written as 0: no exponent is ever written
 * (JavaScript writes none between 10^-6 and 10^21), and the root's viewBox
 * is at least one unit wide, so a millionth of a unit is below anything a
 * page shows. A magnitude past `MAX_SVG_COORDINATE` is refused.
 */
import { MAX_SVG_COORDINATE } from './limits.js'
import { refuse } from './svg-refusal.js'

export interface SvgNumber {
  readonly value: number
  /** The number times 10^`places`, an integer held exactly, when the file wrote it in at most `MAX_PLACES` places; undefined for a float. */
  readonly scaled: number | undefined
  readonly places: number
}

/** The most decimal places a number is kept exactly in, and then in at most 15 digits, which a double holds exactly, as it does the sum of two. */
const MAX_PLACES = 9
const POWERS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000] as const

export const ZERO: SvgNumber = { value: 0, scaled: 0, places: 0 }
export const ONE: SvgNumber = { value: 1, scaled: 1, places: 0 }

/** A number computed, not written. */
export function float(value: number): SvgNumber {
  return { value, scaled: undefined, places: 0 }
}

function power(places: number): number {
  return POWERS[places] as number
}

const DIGIT_0 = 0x30
const DIGIT_9 = 0x39

function isDigit(code: number): boolean {
  return code >= DIGIT_0 && code <= DIGIT_9
}

/**
 * Where the number that starts at `at` ends, or -1 when none starts there:
 * a sign, digits with at most one point and at least one digit, and an
 * exponent only when digits follow its `e`. `1.5.5` is two numbers, `1e` a
 * number and a stray letter, as SVG's grammar and svg-to-pdfkit both read
 * them.
 */
export function scanNumber(text: string, at: number): number {
  let i = at
  const sign = text.charCodeAt(i)
  if (sign === 0x2b || sign === 0x2d) i += 1
  let digits = 0
  while (isDigit(text.charCodeAt(i))) {
    i += 1
    digits += 1
  }
  if (text.charCodeAt(i) === 0x2e) {
    i += 1
    while (isDigit(text.charCodeAt(i))) {
      i += 1
      digits += 1
    }
  }
  if (digits === 0) return -1
  const e = text.charCodeAt(i)
  if (e === 0x65 || e === 0x45) {
    let j = i + 1
    const exponentSign = text.charCodeAt(j)
    if (exponentSign === 0x2b || exponentSign === 0x2d) j += 1
    if (isDigit(text.charCodeAt(j))) {
      while (isDigit(text.charCodeAt(j))) j += 1
      i = j
    }
  }
  return i
}

/** The number `text` holds between `start` and `end`, which `scanNumber` found, refused as `out-of-range` past the bound. */
export function numberAt(text: string, start: number, end: number, where: string): SvgNumber {
  const written = text.slice(start, end)
  const value = Number(written)
  if (!(Math.abs(value) <= MAX_SVG_COORDINATE)) refuse('out-of-range', `${where} holds a number past ${MAX_SVG_COORDINATE}`)
  return { value, ...exactly(written) }
}

/** The whole of `text`, which must be one number and nothing else, surrounding whitespace aside. */
export function readNumber(text: string, where: string): SvgNumber {
  const trimmed = text.trim()
  const end = scanNumber(trimmed, 0)
  if (end !== trimmed.length || end <= 0) refuse('unsupported', `${where} is not a number`, 'write it as a number')
  return numberAt(trimmed, 0, end, where)
}

/** The exact form of a number as written, or none when it has more places or digits than a double holds exactly. */
function exactly(written: string): { readonly scaled: number | undefined; readonly places: number } {
  // `scanNumber` admits only what this pattern reads.
  const [, sign = '', whole = '', writtenFraction = '', exponent = '0'] = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(written) ?? []
  // Trailing zeros dropped by a loop: `/0+$/` tries every start in a run of zeros, which a mebibyte of them makes quadratic.
  let kept = writtenFraction.length
  while (kept > 0 && writtenFraction.charCodeAt(kept - 1) === DIGIT_0) kept -= 1
  const fraction = writtenFraction.slice(0, kept)
  let places = fraction.length - Number(exponent)
  let digits = `${whole}${fraction}`.replace(/^0+/, '')
  if (digits === '') return { scaled: 0, places: 0 }
  if (places < 0) {
    digits += '0'.repeat(-places)
    places = 0
  }
  if (places > MAX_PLACES || digits.length > 15) return { scaled: undefined, places: 0 }
  const scaled = Number(digits)
  return { scaled: sign === '-' ? -scaled : scaled, places }
}

/** The sum of two numbers, exact when both are; refused as `out-of-range` past the bound, as a relative path that walks off the page is. */
export function plus(a: SvgNumber, b: SvgNumber, where: string): SvgNumber {
  let sum: SvgNumber
  if (a.scaled !== undefined && b.scaled !== undefined) {
    const places = Math.max(a.places, b.places)
    const scaled = a.scaled * power(places - a.places) + b.scaled * power(places - b.places)
    sum = { value: scaled / power(places), scaled, places }
  } else sum = float(a.value + b.value)
  if (!(Math.abs(sum.value) <= MAX_SVG_COORDINATE)) refuse('out-of-range', `${where} reaches a point past ${MAX_SVG_COORDINATE}`)
  return sum
}

/** A hundredth of a number, exact when it is and two more places still fit: what a percentage is. */
export function hundredth(n: SvgNumber): SvgNumber {
  if (n.scaled !== undefined && n.places + 2 <= MAX_PLACES) return { value: n.scaled / power(n.places + 2), scaled: n.scaled, places: n.places + 2 }
  return float(n.value / 100)
}

/** The number clamped between `low` and `high`, as SVG clamps an opacity or an offset. */
export function clamp(n: SvgNumber, low: SvgNumber, high: SvgNumber): SvgNumber {
  if (n.value < low.value) return low
  if (n.value > high.value) return high
  return n
}

/** The number's written form: no exponent, no sign on zero, no trailing zero, nothing below 10^-6. */
export function writeNumber(n: SvgNumber): string {
  if (!(Math.abs(n.value) >= 1e-6)) return '0'
  if (n.scaled === undefined) return String(n.value)
  const digits = String(Math.abs(n.scaled)).padStart(n.places + 1, '0')
  const whole = digits.slice(0, digits.length - n.places)
  const fraction = digits.slice(digits.length - n.places).replace(/0+$/, '')
  return `${n.scaled < 0 ? '-' : ''}${whole}${fraction === '' ? '' : `.${fraction}`}`
}
