/**
 * The values an SVG's kept properties and geometry may take, each read by
 * its own grammar into a typed value, and refused, named, when it is not one
 * the format reads.
 *
 * A value outside its grammar is refused, never ignored as a browser
 * ignores an invalid declaration: ignoring it would print a drawing the
 * author did not write, whose cause nobody would find. Keywords, units and
 * colour names are read in any case, as CSS reads them, and written in one.
 */
import { INHERITED, type Property } from './svg-allow.js'
import { SVG_NAMED_COLOURS } from './svg-colours.js'
import { clamp, float, hundredth, numberAt, ONE, readNumber, scanNumber, type SvgNumber, ZERO } from './svg-number.js'
import { MAX_SVG_COORDINATE, MAX_SVG_DASHES } from './limits.js'
import { refuse } from './svg-refusal.js'

export type Colour = { readonly kind: 'colour'; readonly hex: string } | { readonly kind: 'current' }
export type Paint =
  | { readonly kind: 'none' }
  | Colour
  | { readonly kind: 'url'; readonly id: string; readonly fallback: Colour | { readonly kind: 'none' } | undefined }

/** A kept property's value, as its grammar read it. */
export type Value =
  | { readonly type: 'paint'; readonly paint: Paint }
  | { readonly type: 'colour'; readonly colour: Colour }
  | { readonly type: 'number'; readonly number: SvgNumber }
  | { readonly type: 'keyword'; readonly keyword: string }
  | { readonly type: 'dashes'; readonly dashes: readonly SvgNumber[] | 'none' }
  | { readonly type: 'clip'; readonly id: string | undefined }

/** `inherit` on a property that inherits anyway: it wins the cascade and writes nothing. */
export const INHERIT = 'inherit'

const KEYWORDS: { readonly [P in Property]?: readonly string[] } = {
  'fill-rule': ['nonzero', 'evenodd'],
  'clip-rule': ['nonzero', 'evenodd'],
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  display: ['inline', 'block', 'none'],
  visibility: ['visible'],
  'vector-effect': ['none'],
}

/** Why a keyword the format knows of is refused, where it is not merely unknown, and what to do. */
const REFUSED_KEYWORDS: { readonly [keyword: string]: { readonly why: string; readonly advice: string } } = {
  arcs: { why: 'a line join svg-to-pdfkit does not draw', advice: 'use miter, round or bevel' },
  'miter-clip': { why: 'a line join svg-to-pdfkit does not draw', advice: 'use miter, round or bevel' },
  hidden: { why: 'hidden', advice: 'remove what is hidden, or show it' },
  collapse: { why: 'hidden', advice: 'remove what is hidden, or show it' },
  'non-scaling-stroke': { why: 'a stroke whose width depends on the box it is drawn in', advice: 'expand the stroke' },
}

/** A property's value, `INHERIT`, or a refusal naming `where`. */
export function readProperty(property: Property, text: string, where: string): Value | typeof INHERIT {
  const value = text.trim()
  const lower = value.toLowerCase()
  if (lower === 'inherit') {
    if (!INHERITED.has(property)) refuse('unsupported', `${where} inherits a property that does not inherit`, 'give it its value')
    return INHERIT
  }
  if (['initial', 'unset', 'revert', 'revert-layer'].includes(lower)) refuse('unsupported', `${where} is a CSS-wide keyword`, 'give it its value')
  switch (property) {
    case 'fill':
    case 'stroke':
      return { type: 'paint', paint: readPaint(value, where) }
    case 'stop-color':
      return { type: 'colour', colour: readColour(value, where) }
    case 'color': {
      const colour = readColour(value, where)
      // `color: currentColor` is the colour inherited (CSS Color 4, 6.4).
      return colour.kind === 'current' ? INHERIT : { type: 'colour', colour }
    }
    case 'fill-opacity':
    case 'stroke-opacity':
    case 'opacity':
    case 'stop-opacity':
      return { type: 'number', number: readOpacity(value, where) }
    case 'stroke-width':
      return { type: 'number', number: nonNegative(readLength(value, where, false), where) }
    case 'stroke-dashoffset':
      return { type: 'number', number: readLength(value, where, false) }
    case 'stroke-miterlimit': {
      const limit = readNumber(value, where)
      if (limit.value < 1) refuse('out-of-range', `${where} is under 1`, 'give it 1 or more')
      return { type: 'number', number: limit }
    }
    case 'stroke-dasharray':
      return { type: 'dashes', dashes: readDashes(value, where) }
    case 'clip-path': {
      if (lower === 'none') return { type: 'clip', id: undefined }
      const { id, rest } = readUrl(value, where)
      // A clip path has no fallback: what follows its url is not a clip-path a browser reads.
      if (rest !== '') refuse('unsupported', `${where} is not none or url(#id)`, 'write it as none or url(#id)')
      return { type: 'clip', id }
    }
    default:
      return { type: 'keyword', keyword: readKeyword(property, lower, where) }
  }
}

function readKeyword(property: Property, lower: string, where: string): string {
  if ((KEYWORDS[property] ?? []).includes(lower)) return lower
  const refused = REFUSED_KEYWORDS[lower]
  if (refused !== undefined) refuse('unsupported', `${where} is ${refused.why}`, refused.advice)
  return refuse('unsupported', `${where} is not a value of ${property} this format reads`)
}

function nonNegative(n: SvgNumber, where: string): SvgNumber {
  if (n.value < 0) refuse('out-of-range', `${where} is negative`, 'give it zero or more')
  return n
}

/** An opacity: a number or a percentage, clamped to 0..1 as SVG clamps it. */
export function readOpacity(text: string, where: string): SvgNumber {
  const trimmed = text.trim()
  const n = trimmed.endsWith('%') ? hundredth(readNumber(trimmed.slice(0, -1), where)) : readNumber(trimmed, where)
  return clamp(n, ZERO, ONE)
}

/** Each unit and the user units it is, at CSS's 96 to the inch, as svg-to-pdfkit converts it. */
const UNITS: ReadonlyMap<string, number> = new Map([
  ['', 1],
  ['px', 1],
  ['pt', 96 / 72],
  ['pc', 96 / 6],
  ['mm', 96 / 25.4],
  ['cm', 96 / 2.54],
  ['in', 96],
])
const RELATIVE_UNITS: ReadonlySet<string> = new Set(['em', 'ex', 'rem', 'ch', 'vw', 'vh', 'vmin', 'vmax', 'cap', 'ic', 'lh', 'rlh', 'q'])

/**
 * A length in user units. A percentage is a hundredth where `percent`
 * allows one -- a stop's offset, a gradient's coordinates in its box -- and
 * refused elsewhere; a unit relative to a font or a viewport is refused,
 * since a drawing has neither.
 */
export function readLength(text: string, where: string, percent: boolean): SvgNumber {
  const trimmed = text.trim()
  const end = scanNumber(trimmed, 0)
  if (end <= 0) refuse('unsupported', `${where} is not a length`, LENGTH_ADVICE)
  const unit = trimmed.slice(end).toLowerCase()
  const n = numberAt(trimmed, 0, end, where)
  if (unit === '%') {
    if (!percent) refuse('unsupported', `${where} is a percentage, which this format reads only for an offset, an opacity and a gradient in its box`, LENGTH_ADVICE)
    return hundredth(n)
  }
  if (RELATIVE_UNITS.has(unit)) refuse('unsupported', `${where} is in a unit relative to a font or a viewport, which a drawing has neither of`, LENGTH_ADVICE)
  const factor = UNITS.get(unit)
  if (factor === undefined) refuse('unsupported', `${where} is not a length`, LENGTH_ADVICE)
  return factor === 1 ? n : checked(float(n.value * factor), where)
}

/** What to do about a length this format does not read. */
const LENGTH_ADVICE = 'write it in user units, px, pt, pc, mm, cm or in'
/** What to do about a list of numbers this format does not read. */
const NUMBERS_ADVICE = 'write it as numbers separated by spaces or commas'

/** A number computed from one read, refused as `out-of-range` when converting its unit took it past the bound. */
function checked(n: SvgNumber, where: string): SvgNumber {
  if (!(Math.abs(n.value) <= MAX_SVG_COORDINATE)) refuse('out-of-range', `${where} holds a number past ${MAX_SVG_COORDINATE}`)
  return n
}

/**
 * Numbers separated as SVG separates them in a list -- whitespace, or a
 * comma with whitespace around it -- and also by nothing where a sign or a
 * point starts the next (`10-20`). A comma with no number after it is
 * refused, as a leading one is.
 */
export function readNumbers(text: string, where: string): SvgNumber[] {
  const numbers: SvgNumber[] = []
  let i = skipSpace(text, 0)
  while (i < text.length) {
    const end = scanNumber(text, i)
    if (end < 0) refuse('unsupported', `${where} is not a list of numbers`, NUMBERS_ADVICE)
    numbers.push(numberAt(text, i, end, where))
    i = skipSpace(text, end)
    if (text.charCodeAt(i) === 0x2c) {
      i = skipSpace(text, i + 1)
      if (i >= text.length || scanNumber(text, i) < 0) refuse('unsupported', `${where} is not a list of numbers`, NUMBERS_ADVICE)
    }
  }
  return numbers
}

export function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d
}

export function skipSpace(text: string, at: number): number {
  let i = at
  while (isSpace(text.charCodeAt(i))) i += 1
  return i
}

/** A dash array: `none`, or up to `MAX_SVG_DASHES` non-negative lengths, an odd list doubled as SVG doubles it, and all zeros the solid line SVG draws for them. */
function readDashes(text: string, where: string): readonly SvgNumber[] | 'none' {
  if (text.toLowerCase() === 'none') return 'none'
  const parts = text.split(/\s*,\s*|\s+/)
  if (parts.some((part) => part === '')) refuse('unsupported', `${where} is not a dash array`, NUMBERS_ADVICE)
  // Counted before a part is read, so that a mebibyte of dashes is not read to be refused.
  if (parts.length * (parts.length % 2 === 1 ? 2 : 1) > MAX_SVG_DASHES) refuse('too-large', `${where} has more than ${MAX_SVG_DASHES} dashes`, `give it at most ${MAX_SVG_DASHES} entries`)
  const dashes = parts.map((part) => nonNegative(readLength(part, where, false), where))
  const doubled = dashes.length % 2 === 1 ? [...dashes, ...dashes] : dashes
  return doubled.every((dash) => dash.value === 0) ? 'none' : doubled
}

/** What may stand between `#` and the end of a reference: an id's own characters, digits first allowed, as Canva writes them. */
const ID = /^[A-Za-z0-9_.:-]+$/

/** What a URL written without quotes cannot hold. */
function endsUnquoted(code: number): boolean {
  return isSpace(code) || code === 0x22 || code === 0x27 || code === 0x28 || code === 0x29
}

/**
 * A `url(#id)`, quoted or not, naming something in the file, and what
 * follows it. Read by hand, one pass, rather than by a pattern whose
 * whitespace on either side of an empty address a regular expression would
 * try every split of.
 */
function readUrl(text: string, where: string): { readonly id: string; readonly rest: string } {
  const notUrl = (): never => refuse('unsupported', `${where} is not none or url(#id)`, 'write it as none or url(#id)')
  if (text.slice(0, 4).toLowerCase() !== 'url(') notUrl()
  let i = skipSpace(text, 4)
  const quote = text.charCodeAt(i)
  let target: string
  if (quote === 0x22 || quote === 0x27) {
    const close = text.indexOf(text.charAt(i), i + 1)
    if (close < 0) notUrl()
    target = text.slice(i + 1, close)
    i = close + 1
  } else {
    const start = i
    while (i < text.length && !endsUnquoted(text.charCodeAt(i))) i += 1
    target = text.slice(start, i)
  }
  i = skipSpace(text, i)
  if (text.charCodeAt(i) !== 0x29) notUrl()
  if (!target.startsWith('#')) refuse('reference', `${where} refers to something outside the file`, 'put what it names into the file')
  const id = target.slice(1)
  if (!ID.test(id)) refuse('reference', `${where} names an id this format does not read`, 'give what it names an id of ASCII letters, digits, _, ., : and -')
  return { id, rest: text.slice(i + 1).trim() }
}

/** A paint: `none`, a colour, `currentColor`, or a gradient in the file with an optional fallback. */
function readPaint(text: string, where: string): Paint {
  if (text.toLowerCase() === 'none') return { kind: 'none' }
  if (/^url\(/i.test(text)) {
    const { id, rest } = readUrl(text, where)
    if (rest === '') return { kind: 'url', id, fallback: undefined }
    return { kind: 'url', id, fallback: rest.toLowerCase() === 'none' ? { kind: 'none' } : readColour(rest, where) }
  }
  return readColour(text, where)
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/
const RGB = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/
// Each number written one way only: `\d*\.?\d+` splits a run of digits every way it can, and tries them all.
const RGB_PERCENT = /^rgb\(\s*(\d+(?:\.\d+)?|\.\d+)%\s*,\s*(\d+(?:\.\d+)?|\.\d+)%\s*,\s*(\d+(?:\.\d+)?|\.\d+)%\s*\)$/

/**
 * A colour: `#rgb`, `#rrggbb`, `rgb()` of integers or of percentages, a CSS
 * colour name, or `currentColor`. A colour with an alpha -- `#rgba`,
 * `rgba()`, `hsla()`, `transparent` -- would have to become an opacity,
 * which is a second decision, and is refused with `hsl()` and the system
 * colours (0030).
 */
function readColour(text: string, where: string): Colour {
  const lower = text.trim().toLowerCase()
  if (lower === 'currentcolor') return { kind: 'current' }
  if (HEX.test(lower)) return { kind: 'colour', hex: lower.length === 4 ? `#${[...lower.slice(1)].map((digit) => digit + digit).join('')}` : lower }
  const named = SVG_NAMED_COLOURS.get(lower)
  if (named !== undefined) return { kind: 'colour', hex: named }
  const integers = RGB.exec(lower)
  if (integers !== null) return { kind: 'colour', hex: hexOf(integers.slice(1).map((channel) => Math.min(255, Number(channel)))) }
  const percentages = RGB_PERCENT.exec(lower)
  if (percentages !== null) return { kind: 'colour', hex: hexOf(percentages.slice(1).map((channel) => Math.round((Math.min(100, Number(channel)) * 255) / 100))) }
  return refuse('unsupported', `${where} is a colour this format does not read: one with an alpha, hsl(), transparent or a system colour`, 'write it as #rrggbb, with fill-opacity, stroke-opacity or stop-opacity for its alpha')
}

function hexOf(channels: readonly number[]): string {
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
