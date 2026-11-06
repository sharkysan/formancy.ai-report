import {
  PDFBool,
  PDFContext,
  PDFNull,
  PDFObjectParser,
  type PDFArray,
  type PDFDict,
  type PDFHexString,
  type PDFName,
  type PDFNumber,
  type PDFObject,
  type PDFRef,
  type PDFStream,
  type PDFString,
} from '@pdfme/pdf-lib'
import { find, hexValue, isDelimiter, isDigit, isNumeric, isRegular, isWhite, keyword } from './bytes.js'
import { MAX_DOCUMENT_DEPTH, MAX_DOCUMENT_NAME_LENGTH, MAX_DOCUMENT_NUMBER_LENGTH, MAX_DOCUMENT_STRING_LENGTH } from './limits.js'
import { isRef, type PdfDict, type PdfStream, type PdfValue } from './model.js'
import { Bytes, Dict, Name, Reading, Reference } from './reading.js'
import { refuse, type Finding } from './refusals.js'

/**
 * The object grammar: pdf-lib 6.2.4's `PDFObjectParser`, which reads
 * arrays, dictionaries, references and keywords, with every token read by
 * the reader's own code -- a name, a string, a hexadecimal string, a number
 * -- measured before it is copied and refused past its bound, every value
 * counted, nesting counted, and a stream's data taken where its /Length
 * says, never searched for. What pdf-lib makes is turned into the neutral
 * model as soon as an object is read, so that no pdf-lib type leaves the
 * grammar.
 *
 * pdf-lib's own name reading pools every name it meets for the life of the
 * process, a character at a time (the parser spike's table 9: about 28
 * bytes a character, never freed); here a name is read flat and held once
 * per document. A reference is made by the reading too, never by pdf-lib's
 * `PDFRef.of`, whose pool keeps each distinct one for the life of the
 * process: the spike measured 124 MiB kept after a file of 900,000.
 */

type ByteStream = ConstructorParameters<typeof PDFObjectParser>[0]

const SCRATCH = PDFContext.create()

/**
 * pdf-lib's ByteStream over `data`, which its index does not export: taken
 * from the protected field `bytes` of a parser made for the purpose. An
 * internal of pdf-lib's, which `parse.test.ts` pins.
 */
export function byteStreamOf(data: Uint8Array): ByteStream {
  return (PDFObjectParser.forBytes(data, SCRATCH) as unknown as { readonly bytes: ByteStream }).bytes
}

const SLASH = 0x2f
const HASH = 0x23
const LEFT = 0x28
const RIGHT = 0x29
const BACKSLASH = 0x5c
const GREATER = 0x3e
const LESS = 0x3c
const LEFT_BRACKET = 0x5b
const RIGHT_BRACKET = 0x5d
const CR = 0x0d
const LF = 0x0a
const POINT = 0x2e
const R = 0x52
const ENDSTREAM = keyword('endstream')
/** `stream` and its end of line, which pdf-lib lets be a carriage return alone or a space before CRLF. */
const STREAM = [keyword('stream \r\n'), keyword('stream\r\n'), keyword('stream\r'), keyword('stream\n')]
/** A literal string's escapes that stand for a byte other than themselves (ISO 32000-1, table 3). */
const ESCAPES: Readonly<Record<number, number>> = { 0x6e: LF, 0x72: CR, 0x74: 0x09, 0x62: 0x08, 0x66: 0x0c }

/** Each byte as a name writes it: itself where a name may hold it as it is, else `#` and two hex digits. */
const NAMED = Array.from({ length: 256 }, (_, byte) =>
  byte >= 0x21 && byte <= 0x7e && byte !== HASH && !isDelimiter(byte) ? String.fromCharCode(byte) : `#${byte.toString(16).toUpperCase().padStart(2, '0')}`,
)

const isOctal = (byte: number | undefined): boolean => byte !== undefined && byte >= 0x30 && byte <= 0x37

/**
 * The bytes from `start` to `end` as a string of a character a byte, flat
 * as V8 holds a name the reading keeps once: built a character at a time up
 * to twelve, which V8 keeps flat -- it makes a rope only of thirteen or
 * more -- and five times faster than one call over a view (measured over
 * two million names in Node 22.23.3 on 6 November 2026); past twelve, in
 * one call over a view, which is flat.
 */
function flat(data: Uint8Array, start: number, end: number): string {
  if (end - start > 12) return String.fromCharCode(...data.subarray(start, end))
  let text = ''
  for (let at = start; at < end; at += 1) text += String.fromCharCode(data[at] as number)
  return text
}

/**
 * The number `data` writes from `start` to `end`: a run of up to fifteen
 * digits summed as it is read, which is exact below 10^15 and allocates
 * nothing; anything else -- a sign, a point, more digits -- by JavaScript's
 * own reading of its text, which rounds it as a viewer does.
 */
function numberOf(data: Uint8Array, start: number, end: number): number {
  if (end > start && end - start <= 15) {
    let value = 0
    let at = start
    for (; at < end && isDigit(data[at]); at += 1) value = value * 10 + (data[at] as number) - 0x30
    if (at === end) return value
  }
  let text = ''
  for (let at = start; at < end; at += 1) text += String.fromCharCode(data[at] as number)
  return Number(text)
}

/** A stream whose /Length is a reference: its data ends where that object says, which the parse checks once the object is read. */
export interface PendingLength {
  readonly stream: PdfStream
  /** The object its /Length names. */
  readonly length: number
  /** Where its data starts, and where the `endstream` found after it begins, less an end of line. */
  readonly start: number
  readonly end: number
}

/** An indirect object's value in the model, and its pending length where it is such a stream. */
export interface Indirect {
  readonly value: PdfValue | PdfStream
  readonly pending?: PendingLength
}

class StreamValue implements Indirect {
  readonly value: PdfStream
  readonly pending?: PendingLength

  constructor(value: PdfStream, pending?: PendingLength) {
    this.value = value
    if (pending !== undefined) this.pending = pending
  }
}

export class Grammar extends PDFObjectParser {
  private readonly data: Uint8Array
  private readonly reading: Reading
  private readonly inObjectStream: boolean
  private depth = 0
  /** Where the last escape `escape` read ends. */
  private escapeEnd = 0

  constructor(data: Uint8Array, reading: Reading, inObjectStream = false) {
    super(byteStreamOf(data), reading.context)
    this.data = data
    this.reading = reading
    this.inObjectStream = inObjectStream
  }

  get at(): number {
    return this.bytes.offset()
  }

  moveTo(offset: number): void {
    this.bytes.moveTo(offset)
  }

  done(): boolean {
    return this.bytes.done()
  }

  peek(): number | undefined {
    return this.bytes.peek()
  }

  /** Past white space and comments. */
  space(): void {
    this.skipWhitespaceAndComments()
  }

  /** Past `word` where it stands here. */
  match(word: number[]): boolean {
    return this.matchKeyword(word)
  }

  /** A run of digits: an object's number or generation, an offset, a count; refused as `otherwise` where there is none. */
  int(otherwise: Finding): number {
    const start = this.at
    const end = this.run(isDigit, MAX_DOCUMENT_NUMBER_LENGTH, 'number-length')
    if (end === start) refuse(otherwise)
    const value = numberOf(this.data, start, end)
    if (!Number.isSafeInteger(value)) refuse('number')
    this.moveTo(end)
    return value
  }

  /** The value of an indirect object or of an object stream's member, read whole, in the model. */
  indirect(): Indirect {
    const object = this.parseObject() as PDFObject | StreamValue
    return object instanceof StreamValue ? object : { value: this.neutral(object) }
  }

  /** A trailer: a dictionary, in the model. */
  dictionary(): PdfDict {
    return this.parseDict() as unknown as PdfDict
  }

  /** Where the run of bytes `inside` admits from here ends, refused as `finding` past `limit` bytes, never read further than one past it. */
  private run(inside: (byte: number | undefined) => boolean, limit: number, finding: Finding): number {
    const start = this.at
    let end = start
    while (end - start <= limit && inside(this.data[end])) end += 1
    if (end - start > limit) refuse(finding)
    return end
  }

  override parseObject(ref?: PDFRef): PDFObject {
    this.reading.counted()
    return super.parseObject(ref)
  }

  /**
   * pdf-lib's own -- a number, or two and an R -- but a reference is made
   * by the reading, and never goes into pdf-lib's process-lifetime pool; a
   * number is the model's from the first, never a pdf-lib PDFNumber, whose
   * constructor writes its string form; and a number ends where its digits
   * do, not where the look for a generation and an R stopped, so that a
   * member of an object stream ends where its last token does
   * (`parse.ts`). The look measures the number after it without reading
   * it, and reads it only as the generation of a reference: each number is
   * read once, and no byte is measured more than twice.
   */
  protected override parseNumberOrRef(): PDFNumber | PDFRef {
    const first = this.parseRawNumber()
    const end = this.at
    this.skipWhitespaceAndComments()
    if (isDigit(this.peek())) {
      const second = this.at
      this.moveTo(this.numberEnd())
      this.skipWhitespaceAndComments()
      if (this.peek() === R) {
        const after = this.at + 1
        this.moveTo(second)
        const generation = this.parseRawNumber()
        this.moveTo(after)
        return this.reading.ref(first, generation) as unknown as PDFRef
      }
    }
    this.moveTo(end)
    return first as unknown as PDFNumber
  }

  /** Where pdf-lib's number grammar from here ends -- a sign, digits and a point up to the first point, then digits -- refused past the bound. */
  private numberEnd(): number {
    const data = this.data
    const bound = this.at + MAX_DOCUMENT_NUMBER_LENGTH
    let end = this.at
    while (end <= bound && isNumeric(data[end])) {
      end += 1
      if (data[end - 1] === POINT) break
    }
    while (end <= bound && isDigit(data[end])) end += 1
    if (end > bound) refuse('number-length')
    return end
  }

  /** pdf-lib's number grammar, measured first, and never NaN. */
  protected override parseRawNumber(): number {
    const start = this.at
    const end = this.numberEnd()
    const value = numberOf(this.data, start, end)
    if (!Number.isFinite(value)) refuse('number')
    this.moveTo(end)
    return value
  }

  /** A name: its bytes measured, its escapes decoded, held in its one written form, once a document. */
  protected override parseName(): PDFName {
    this.reading.counted()
    this.bytes.assertNext(SLASH)
    const start = this.at
    const end = this.run(isRegular, MAX_DOCUMENT_NAME_LENGTH, 'name-length')
    this.moveTo(end)
    // Most names are written as they are named: read as one flat string.
    let plain = true
    for (let at = start; at < end && plain; at += 1) plain = NAMED[this.data[at] as number]?.length === 1
    if (plain) return this.reading.name(flat(this.data, start, end), end - start) as unknown as PDFName
    const decoded: number[] = []
    for (let at = start; at < end;) {
      if (this.data[at] !== HASH) {
        decoded.push(this.data[at] as number)
        at += 1
        continue
      }
      const high = hexValue(this.data[at + 1])
      const low = hexValue(this.data[at + 2])
      if (at + 2 >= end || high < 0 || low < 0) refuse('name-escape')
      decoded.push(high * 16 + low)
      at += 3
    }
    return this.reading.name(decoded.map((byte) => NAMED[byte]).join(''), decoded.length) as unknown as PDFName
  }

  /**
   * A literal string as its bytes, its escapes and ends of line read as ISO
   * 32000-1 7.3.4.2 reads them: a view of the file's own bytes where it
   * reads as written, of its document's decoded strings where not (`Reading`
   * `decoded`). Counted again, beside the value `parseObject` counts: the
   * view its bytes are held in costs what several values do.
   */
  protected override parseString(): PDFString {
    this.reading.counted()
    const data = this.data
    const out = this.reading.scratch
    const start = this.at + 1
    let length = 0
    let plain = true
    let at = start
    for (let depth = 1; ;) {
      if (at >= data.length) refuse('string-end')
      const byte = data[at] as number
      at += 1
      if (byte === BACKSLASH) {
        plain = false
        const escaped = this.escape(at)
        at = this.escapeEnd
        if (escaped >= 0) out[length++] = escaped
      } else if (byte === CR) {
        plain = false
        out[length++] = LF
        if (data[at] === LF) at += 1
      } else {
        if (byte === LEFT) depth += 1
        if (byte === RIGHT) depth -= 1
        if (depth === 0) break
        out[length++] = byte
      }
      if (length > MAX_DOCUMENT_STRING_LENGTH) refuse('string-length')
    }
    this.moveTo(at)
    const bytes = length > 0 && plain ? data.subarray(start, start + length) : this.reading.decoded(length)
    return new Bytes(bytes) as unknown as PDFString
  }

  /** The byte the escape after a backslash at `at` stands for, or -1 where it continues the string on the next line; where it ends in `escapeEnd`. */
  private escape(at: number): number {
    const data = this.data
    const byte = data[at]
    if (byte === undefined) refuse('string-end')
    if (isOctal(byte)) {
      let value = byte - 0x30
      let next = at + 1
      for (; next < at + 3 && isOctal(data[next]); next += 1) value = value * 8 + (data[next] as number) - 0x30
      this.escapeEnd = next
      return value & 0xff
    }
    // A backslash and an end of line continue the string on the next line.
    if (byte === CR) {
      this.escapeEnd = data[at + 1] === LF ? at + 2 : at + 1
      return -1
    }
    this.escapeEnd = at + 1
    return byte === LF ? -1 : (ESCAPES[byte] ?? byte)
  }

  /**
   * A hexadecimal string as its bytes: pairs of digits, white space between
   * them, an odd last digit followed by 0 (7.3.4.3); held with the
   * document's decoded strings, and counted again, as a literal one is.
   */
  protected override parseHexString(): PDFHexString {
    this.reading.counted()
    const data = this.data
    const out = this.reading.scratch
    let length = 0
    let high = -1
    let at = this.at + 1
    for (;;) {
      const byte = data[at]
      at += 1
      if (byte === GREATER) break
      if (isWhite(byte)) continue
      const digit = hexValue(byte)
      if (digit < 0) refuse('hex-string')
      if (high < 0) high = digit
      else {
        out[length++] = high * 16 + digit
        high = -1
      }
      if (length > MAX_DOCUMENT_STRING_LENGTH) refuse('string-length')
    }
    if (high >= 0) out[length++] = high * 16
    if (length > MAX_DOCUMENT_STRING_LENGTH) refuse('string-length')
    this.moveTo(at)
    return new Bytes(this.reading.decoded(length)) as unknown as PDFHexString
  }

  private enter(): void {
    this.depth += 1
    if (this.depth > MAX_DOCUMENT_DEPTH) refuse('depth')
  }

  /**
   * pdf-lib's loop, each item in the model as it is read: no PDFArray is
   * made and walked again, which cost a file of values a third of its read.
   */
  protected override parseArray(): PDFArray {
    this.enter()
    this.bytes.assertNext(LEFT_BRACKET)
    this.skipWhitespaceAndComments()
    const items: PdfValue[] = []
    while (this.bytes.peek() !== RIGHT_BRACKET) {
      items.push(this.neutral(this.parseObject()))
      this.skipWhitespaceAndComments()
    }
    this.bytes.assertNext(RIGHT_BRACKET)
    this.depth -= 1
    return items as unknown as PDFArray
  }

  /**
   * pdf-lib's loop, keyed by its names' written forms, each value in the
   * model as it is read, and no PDFDict made, nor its /Type looked up in
   * pdf-lib's pool of names. A key written twice keeps the place it was
   * first written and the value it was last, as pdf-lib's map does; an
   * entry of null is none (ISO 32000-1 7.3.7), taken out once the
   * dictionary ends, so that a key written again after a null keeps its
   * first place too.
   */
  protected override parseDict(): PDFDict {
    this.enter()
    this.bytes.assertNext(LESS)
    this.bytes.assertNext(LESS)
    this.skipWhitespaceAndComments()
    let entries = new Map<string, PdfValue>()
    let nulls = false
    while (!this.bytes.done() && this.bytes.peek() !== GREATER && this.bytes.peekAhead(1) !== GREATER) {
      const key = (this.parseName() as unknown as Name).name
      const value = this.neutral(this.parseObject())
      entries.set(key, value)
      nulls ||= value === null
      this.skipWhitespaceAndComments()
    }
    this.skipWhitespaceAndComments()
    this.bytes.assertNext(GREATER)
    this.bytes.assertNext(GREATER)
    if (nulls) entries = new Map([...entries].filter(([, value]) => value !== null))
    this.depth -= 1
    return new Dict(entries) as unknown as PDFDict
  }

  /**
   * pdf-lib's, without its search: a stream stands only as an indirect
   * object's whole value, and its data ends where its /Length says. A
   * dictionary that is no stream ends at its `>>`, not where the look for
   * `stream` stopped.
   */
  protected override parseDictOrStream(): PDFDict | PDFStream {
    const nested = this.depth > 0 || this.inObjectStream
    const dict = this.parseDict()
    const end = this.at
    this.skipWhitespaceAndComments()
    if (!STREAM.some((word) => this.matchKeyword(word))) {
      this.moveTo(end)
      return dict
    }
    if (nested) refuse('stream-inside')
    return this.streamOf(dict as unknown as PdfDict) as unknown as PDFStream
  }

  private streamOf(dict: PdfDict): StreamValue {
    const start = this.at
    const length = dict.entries.get('Length')
    if (isRef(length)) {
      // A length written later as an object of its own: the data runs to the `endstream` that follows, less an end of
      // line, and is held to the length once the parse has read that object.
      const found = find(this.data, ENDSTREAM, start)
      if (found < 0) refuse('stream-end')
      let end = found
      if (end > start && this.data[end - 1] === LF) end -= 1
      if (end > start && this.data[end - 1] === CR) end -= 1
      this.moveTo(found + ENDSTREAM.length)
      const stream = { dict, bytes: this.data.subarray(start, end) }
      return new StreamValue(stream, { stream, length: length.object, start, end })
    }
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) refuse('stream-length')
    if (start + length > this.data.length) refuse('stream-past-end')
    this.moveTo(start + length)
    this.skipWhitespace()
    if (!this.matchKeyword(ENDSTREAM)) refuse('stream-end')
    return new StreamValue({ dict, bytes: this.data.subarray(start, start + length) })
  }

  /** What the grammar made, in the model: every container is the model's as it is read, and pdf-lib makes only booleans and null. */
  private neutral(object: PDFObject): PdfValue {
    if (object instanceof Name || object instanceof Bytes || object instanceof Reference || object instanceof Dict) return object
    if (typeof object === 'number' || Array.isArray(object)) return object as PdfValue
    if (object instanceof PDFBool) return object.asBoolean()
    if (object === PDFNull) return null
    // A stream within a value is refused where it is read, and the grammar reads every other kind itself.
    return refuse('unreadable')
  }
}
