/**
 * How an SVG is refused, what cleaning one removed, and how a name read from
 * one is repeated back: the words every part of the SVG reader shares.
 *
 * A refusal or a removal names what was found, never a value: a link's
 * address, a script's text or a style's content is not repeated back to a
 * person, a log or a test snapshot. A name is repeated only when it is
 * short ASCII (`shown`), so neither a message nor the list of removals grows
 * with what a file holds, and neither carries bytes a reader would decode
 * as something else.
 */
import { MAX_KEY_LENGTH, MAX_SVG_REMOVED_NAMES } from './limits.js'

/** Why an SVG is refused, each the first thing found that is wrong with it. */
export const SVG_REFUSAL_CODES = [
  /** Not XML whose root is an svg element in the SVG namespace. */
  'not-svg',
  /** The XML itself: unclosed, mismatched, an attribute twice, data after the root, a character XML forbids. */
  'not-well-formed',
  /** A UTF-16 or UTF-32 file, a declared encoding other than UTF-8, US-ASCII or ISO-8859-1, or a byte past ASCII in what is kept. */
  'encoding',
  /** A DOCTYPE with an internal subset, or an entity XML does not predefine. */
  'doctype',
  /** text, tspan, textPath, or character data where a drawing holds none. */
  'text',
  /** An embedded picture. */
  'raster',
  /** use, symbol, an href or url() to anything but a gradient or a clip path in the file, or a cycle. */
  'reference',
  /** An element, attribute, property, value or CSS construct this format does not draw as a browser draws it. */
  'unsupported',
  /** A number past MAX_SVG_COORDINATE, a negative size, a viewBox side under 1. */
  'out-of-range',
  /** Past MAX_SVG_BYTES, MAX_SVG_ELEMENTS, MAX_SVG_SEGMENTS, MAX_SVG_GROUPS, MAX_SVG_STOPS, MAX_SVG_DASHES or MAX_SVG_RULES. */
  'too-large',
  /** Nesting past MAX_SVG_DEPTH. */
  'too-deep',
] as const
export type SvgRefusalCode = (typeof SVG_REFUSAL_CODES)[number]

export interface SvgRefusal {
  readonly ok: false
  readonly code: SvgRefusalCode
  /** English, for a log or a person: what was found and where, by element path (`svg/g[2]/text`), never a value, then what to do (`SVG_ADVICE`). */
  readonly message: string
}

/**
 * A refusal on its way out of the reader. It is thrown where the problem is
 * found, deep in a value grammar, and caught once, at `cleanSvg`'s edge, so
 * that no partly read drawing is ever returned.
 */
export class SvgRefused extends Error {
  readonly code: SvgRefusalCode

  constructor(code: SvgRefusalCode, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * What a person can do about each kind of refusal, said after what was
 * found unless the refusal knows something more particular. Every refusal
 * says one, because a refusal is what a person who uploaded a logo is
 * shown, and "unsupported" alone sends them back to the drawing program
 * with nothing to try (0030).
 */
export const SVG_ADVICE: { readonly [C in SvgRefusalCode]: string } = {
  'not-svg': 'save the drawing as an SVG file',
  'not-well-formed': 'save the drawing again from the program it was made in',
  encoding: 'save it as UTF-8, with every name in ASCII',
  doctype: 'save it as plain SVG',
  text: 'convert the text to outlines',
  raster: 'add the picture as a PNG or JPEG asset of its own',
  reference: 'save it again through a program that expands references, with everything it names inside the file',
  unsupported: 'expand it into plain shapes in the drawing program, or remove it',
  'out-of-range': 'give the drawing an ordinary size in the drawing program',
  'too-large': 'simplify the drawing',
  'too-deep': 'flatten its groups',
}

/** What a stylesheet is refused with: every program that writes CSS into an SVG can write attributes instead. */
export const CSS_ADVICE = 'export it with presentation attributes rather than CSS'

/** Refused, with what was found (`what`) and what to do (`advice`, the code's own when the refusal knows nothing more particular). */
export function refuse(code: SvgRefusalCode, what: string, advice: string = SVG_ADVICE[code]): never {
  throw new SvgRefused(code, `${what}; ${advice}`)
}

/**
 * A name as a message may repeat it: ASCII name characters, a leading hyphen
 * allowed for a vendor's property (`-inkscape-stroke`), and no longer than
 * the format's own longest name (`MAX_KEY_LENGTH`). Anything else is said as
 * `otherwise`: a name past that is never one this format knows, and a byte
 * past ASCII would be read as another character by another reader.
 */
const SHOWN = /^-?[A-Za-z_][A-Za-z0-9_.:-]*$/

export function shown(name: string, otherwise: string): string {
  return name.length <= MAX_KEY_LENGTH && SHOWN.test(name) ? name : otherwise
}

/** What cleaning removed: names only, never a value. */
export interface SvgRemoval {
  readonly kind: SvgRemovalKind
  /** The element, attribute or property name as written (`sodipodi:namedview`, `onclick`, `-inkscape-stroke`); for a comment, a declaration or a DOCTYPE, the kind again. */
  readonly name: string
  readonly count: number
}

export type SvgRemovalKind = 'element' | 'attribute' | 'property' | 'comment' | 'declaration' | 'doctype'

/** What stands in for a name `shown` will not repeat, by kind. */
const UNSHOWN: { readonly [K in SvgRemovalKind]: string } = {
  element: 'an element in another namespace',
  attribute: 'an attribute with a long or non-ASCII name',
  property: 'a property with a long or non-ASCII name',
  comment: 'comment',
  declaration: 'declaration',
  doctype: 'doctype',
}

/**
 * The removals of one cleaning, grouped by kind and name with a count. The
 * first `MAX_SVG_REMOVED_NAMES` distinct names are kept; every removal of a
 * name past them is counted in `more`, so that a file of fifty thousand
 * distinctly named attributes reports thirty-two names and a count of the
 * rest, not fifty thousand names.
 */
export class Removals {
  private readonly named = new Map<string, { kind: SvgRemovalKind; name: string; count: number }>()
  private further = 0

  add(kind: SvgRemovalKind, name: string): void {
    const said = shown(name, UNSHOWN[kind])
    const key = `${kind} ${said}`
    const found = this.named.get(key)
    if (found !== undefined) found.count += 1
    else if (this.named.size < MAX_SVG_REMOVED_NAMES) this.named.set(key, { kind, name: said, count: 1 })
    else this.further += 1
  }

  get more(): number {
    return this.further
  }

  list(): readonly SvgRemoval[] {
    return [...this.named.values()].map(({ kind, name, count }) => ({ kind, name, count }))
  }
}
