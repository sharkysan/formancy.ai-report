/**
 * The XML an SVG is written in, read from its bytes: markup, attributes,
 * character data and references, checked for well-formedness as it goes.
 *
 * Bytes, not text: report-spec's ES2023 library has no `TextDecoder`, and
 * needs none. Every byte is read as the character of that number (Latin-1),
 * so a name or a value keeps its bytes exactly and a byte past ASCII stays a
 * character past ASCII, which the cleaner refuses wherever it would be kept:
 * a byte past 0x7F must mean the same thing to every reader of the file,
 * and the one way to be sure of that is to keep none. What is removed -- a
 * comment, a title, an editor's label -- may hold any.
 *
 * Iterative, never recursive, so that no nesting reaches the stack, and
 * stopped at the first error: a reference to an entity XML does not
 * predefine (`doctype`, since only a DOCTYPE could declare one), or an
 * unclosed, mismatched or otherwise malformed construct (`not-well-formed`),
 * named by byte offset and by the element path the reader was in.
 */
import { MAX_KEY_LENGTH } from './limits.js'
import { refuse } from './svg-refusal.js'

export interface XmlAttribute {
  /** As written, prefix and all. */
  readonly name: string
  /** Where its value's bytes start and end, inside the quotes. */
  readonly start: number
  readonly end: number
}

export type XmlToken =
  | { readonly kind: 'declaration'; readonly version: string; readonly encoding: string | undefined }
  | { readonly kind: 'doctype' }
  | { readonly kind: 'comment' }
  | { readonly kind: 'pi'; readonly target: string }
  | { readonly kind: 'cdata'; readonly start: number; readonly end: number }
  | { readonly kind: 'text'; readonly start: number; readonly end: number }
  | { readonly kind: 'start'; readonly name: string; readonly attributes: readonly XmlAttribute[]; readonly empty: boolean }
  | { readonly kind: 'end'; readonly name: string }

const LT = 0x3c
const GT = 0x3e
const AMP = 0x26
const SLASH = 0x2f
const BANG = 0x21
const EQUALS = 0x3d
const QUOTE = 0x22
const APOSTROPHE = 0x27
const SEMICOLON = 0x3b

function isWhite(byte: number | undefined): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d
}

function isNameStart(byte: number | undefined): boolean {
  return byte !== undefined && ((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || byte === 0x5f || byte === 0x3a || byte >= 0x80)
}

function isNameByte(byte: number | undefined): boolean {
  return isNameStart(byte) || (byte !== undefined && ((byte >= 0x30 && byte <= 0x39) || byte === 0x2d || byte === 0x2e))
}

/** The bytes from `start` to `end` as characters of their own numbers. */
export function latin1(bytes: Uint8Array, start: number, end: number): string {
  let text = ''
  for (let at = start; at < end; at += 8192) text += String.fromCharCode(...bytes.subarray(at, Math.min(end, at + 8192)))
  return text
}

/** Whether a code point is a character XML 1.0 allows (production 2), which a numeric reference must name. */
function isXmlChar(code: number): boolean {
  return code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff)
}

const PREDEFINED: { readonly [name: string]: string } = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

export class XmlReader {
  private readonly bytes: Uint8Array
  private at: number
  /** The element path the reader is in, for messages; the tree that reads the tokens keeps it. */
  path = 'the document'

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.at = 0
    const [b0, b1, b2] = bytes
    if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) this.at = 3
    else if ((b0 === 0xfe && b1 === 0xff) || (b0 === 0xff && b1 === 0xfe) || b0 === 0 || b1 === 0)
      refuse('encoding', 'the file is UTF-16 or UTF-32', 'save it as UTF-8')
    for (let i = this.at; i < bytes.length; i += 1) {
      const byte = bytes[i] as number
      if (byte < 0x20 && !isWhite(byte)) this.malformed(i, 'a control character XML forbids')
    }
  }

  private malformed(at: number, what: string): never {
    return refuse('not-well-formed', `at byte ${at} in ${this.path}: ${what}`)
  }

  private startsWith(text: string, at = this.at): boolean {
    for (let k = 0; k < text.length; k += 1) if (this.bytes[at + k] !== text.charCodeAt(k)) return false
    return true
  }

  /** Where `text` first starts between `from` and `to`, or -1. Every search is bounded, so that no construct is searched past its own end and reading stays linear in the bytes. */
  private find(text: string, from: number, to = this.bytes.length): number {
    const first = text.charCodeAt(0)
    for (let i = this.index(first, from, to); i >= 0; i = this.index(first, i + 1, to)) if (this.startsWith(text, i)) return i
    return -1
  }

  private index(byte: number, from: number, to: number): number {
    const found = this.bytes.subarray(from, to).indexOf(byte)
    return found < 0 ? -1 : from + found
  }

  private name(): string {
    const start = this.at
    if (!isNameStart(this.bytes[this.at])) this.malformed(start, 'markup without a name')
    while (isNameByte(this.bytes[this.at])) this.at += 1
    const name = latin1(this.bytes, start, this.at)
    const colon = name.indexOf(':')
    if (colon === 0 || colon === name.length - 1 || name.indexOf(':', colon + 1) >= 0) this.malformed(start, 'a name with a misplaced colon')
    return name
  }

  private skipWhite(): boolean {
    const start = this.at
    while (isWhite(this.bytes[this.at])) this.at += 1
    return this.at > start
  }

  /** The next token, or undefined at the end of the bytes. */
  next(): XmlToken | undefined {
    const { bytes } = this
    if (this.at >= bytes.length) return undefined
    const start = this.at
    if (bytes[start] !== LT) {
      const lt = bytes.indexOf(LT, start)
      this.at = lt < 0 ? bytes.length : lt
      this.references(start, this.at)
      const close = this.find(']]>', start, this.at)
      if (close >= 0) this.malformed(close, ']]> in character data')
      return { kind: 'text', start, end: this.at }
    }
    if (this.startsWith('<?')) return this.instruction(start)
    if (this.startsWith('<!--')) {
      const dashes = this.find('--', start + 4)
      if (dashes < 0 || bytes[dashes + 2] !== GT) this.malformed(start, 'a comment that holds -- or is not closed')
      this.at = dashes + 3
      return { kind: 'comment' }
    }
    if (this.startsWith('<![CDATA[')) {
      const close = this.find(']]>', start + 9)
      if (close < 0) this.malformed(start, 'a CDATA section that is not closed')
      this.at = close + 3
      return { kind: 'cdata', start: start + 9, end: close }
    }
    if (this.startsWith('<!DOCTYPE')) return this.doctype(start)
    if (bytes[start + 1] === BANG) this.malformed(start, 'a declaration outside a DOCTYPE')
    if (bytes[start + 1] === SLASH) {
      this.at = start + 2
      const name = this.name()
      this.skipWhite()
      if (bytes[this.at] !== GT) this.malformed(start, 'an end tag that is not closed')
      this.at += 1
      return { kind: 'end', name }
    }
    return this.startTag(start)
  }

  private instruction(start: number): XmlToken {
    this.at = start + 2
    const target = this.name()
    const close = this.find('?>', this.at)
    if (close < 0) this.malformed(start, 'a processing instruction that is not closed')
    if (close > this.at && !isWhite(this.bytes[this.at])) this.malformed(start, 'a processing instruction without a space after its target')
    const body = latin1(this.bytes, this.at, close)
    this.at = close + 2
    if (target.toLowerCase() !== 'xml') return { kind: 'pi', target }
    const bom = this.bytes[0] === 0xef ? 3 : 0
    if (target !== 'xml' || start !== bom) this.malformed(start, 'an XML declaration anywhere but at the very start')
    const declaration = /^\s+version\s*=\s*(["'])([^"']*)\1(?:\s+encoding\s*=\s*(["'])([^"']*)\3)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\5)?\s*$/.exec(body)
    if (declaration === null) this.malformed(start, 'an XML declaration that is not one')
    return { kind: 'declaration', version: declaration[2] ?? '', encoding: declaration[4] }
  }

  private doctype(start: number): XmlToken {
    let quote: number | undefined
    for (let i = start + 9; i < this.bytes.length; i += 1) {
      const byte = this.bytes[i]
      if (quote !== undefined) {
        if (byte === quote) quote = undefined
      } else if (byte === QUOTE || byte === APOSTROPHE) quote = byte
      else if (byte === 0x5b)
        refuse('doctype', 'the DOCTYPE declares entities in an internal subset, which this format does not expand', "save it without Illustrator's editing capabilities, or as plain SVG")
      else if (byte === GT) {
        this.at = i + 1
        return { kind: 'doctype' }
      }
    }
    return this.malformed(start, 'a DOCTYPE that is not closed')
  }

  private startTag(start: number): XmlToken {
    this.at = start + 1
    const name = this.name()
    const attributes: XmlAttribute[] = []
    const seen = new Set<string>()
    for (;;) {
      const spaced = this.skipWhite()
      const byte = this.bytes[this.at]
      if (byte === GT) {
        this.at += 1
        return { kind: 'start', name, attributes, empty: false }
      }
      if (byte === SLASH && this.bytes[this.at + 1] === GT) {
        this.at += 2
        return { kind: 'start', name, attributes, empty: true }
      }
      if (byte === undefined) this.malformed(start, 'a start tag that is not closed')
      if (!spaced) this.malformed(this.at, 'attributes not separated by a space')
      const attributeAt = this.at
      const attribute = this.name()
      if (seen.has(attribute)) this.malformed(attributeAt, 'an attribute given twice')
      seen.add(attribute)
      this.skipWhite()
      if (this.bytes[this.at] !== EQUALS) this.malformed(this.at, 'an attribute without a value')
      this.at += 1
      this.skipWhite()
      const quote = this.bytes[this.at]
      if (quote !== QUOTE && quote !== APOSTROPHE) this.malformed(this.at, 'an attribute value without quotes')
      const valueStart = this.at + 1
      const valueEnd = this.bytes.indexOf(quote, valueStart)
      if (valueEnd < 0) this.malformed(this.at, 'an attribute value that is not closed')
      const lt = this.index(LT, valueStart, valueEnd)
      if (lt >= 0) this.malformed(lt, '< in an attribute value')
      this.references(valueStart, valueEnd)
      attributes.push({ name: attribute, start: valueStart, end: valueEnd })
      this.at = valueEnd + 1
    }
  }

  /** Every reference between `start` and `end`, checked: XML's five entities, or a number naming a character XML allows. */
  private references(start: number, end: number): void {
    for (let i = this.index(AMP, start, end); i >= 0; i = this.index(AMP, i + 1, end)) this.reference(i, end)
  }

  /** The reference at `at`: what it stands for, and where it ends. */
  private reference(at: number, end: number): { readonly text: string; readonly next: number } {
    // A reference longer than the format's longest name is not one this reader follows: `&#x10FFFF;` is ten bytes.
    const semicolon = this.index(SEMICOLON, at, Math.min(end, at + MAX_KEY_LENGTH))
    if (semicolon < 0) this.malformed(at, '& that does not start a reference')
    const body = latin1(this.bytes, at + 1, semicolon)
    const numeric = /^#(?:([0-9]+)|x([0-9a-fA-F]+))$/.exec(body)
    if (numeric !== null) {
      const code = numeric[1] !== undefined ? Number.parseInt(numeric[1], 10) : Number.parseInt(numeric[2] ?? '', 16)
      if (!isXmlChar(code)) this.malformed(at, 'a reference to a character XML forbids')
      return { text: String.fromCodePoint(code), next: semicolon + 1 }
    }
    const predefined = PREDEFINED[body]
    if (predefined === undefined) {
      if (!/^[A-Za-z_:][A-Za-z0-9._:-]*$/.test(body)) this.malformed(at, '& that does not start a reference')
      refuse('doctype', `at byte ${at} in ${this.path}: a reference to an entity XML does not predefine, which only a DOCTYPE could declare`)
    }
    return { text: predefined, next: semicolon + 1 }
  }

  /**
   * The characters between `start` and `end`, references replaced by what
   * they stand for, and, in an attribute value, each literal tab, line feed
   * and carriage return by a space, as XML normalises a value (3.3.3).
   */
  decode(start: number, end: number, value: boolean): string {
    let text = ''
    let from = start
    for (let i = this.index(AMP, start, end); i >= 0; ) {
      text += latin1(this.bytes, from, i)
      const { text: replaced, next } = this.reference(i, end)
      text += replaced
      from = next
      i = this.index(AMP, next, end)
    }
    text += latin1(this.bytes, from, end)
    return value ? text.replace(/[\t\n\r]/g, ' ') : text
  }

  /** The bytes between `start` and `end` as they are, as a CDATA section holds them. */
  raw(start: number, end: number): string {
    return latin1(this.bytes, start, end)
  }

  /** Whether the bytes between `start` and `end` are XML whitespace alone. */
  isWhite(start: number, end: number): boolean {
    for (let i = start; i < end; i += 1) if (!isWhite(this.bytes[i])) return false
    return true
  }
}
