import {
  PDFArray,
  PDFBool,
  PDFContext,
  PDFDict,
  PDFNull,
  PDFNumber,
  PDFObjectParser,
  type PDFHexString,
  type PDFName,
  type PDFObject,
  type PDFRef,
  type PDFStream,
  type PDFString,
} from '@pdfme/pdf-lib'
import { find, hexValue, isDelimiter, isDigit, isNumeric, isRegular, isWhite, keyword } from './bytes.js'
import {
  MAX_DOCUMENT_DEPTH,
  MAX_DOCUMENT_NAME_BYTES,
  MAX_DOCUMENT_NAME_LENGTH,
  MAX_DOCUMENT_NUMBER_LENGTH,
  MAX_DOCUMENT_STRING_LENGTH,
  MAX_DOCUMENT_VALUES,
} from './limits.js'
import { isRef, type PdfDict, type PdfName, type PdfRef, type PdfStream, type PdfString, type PdfValue } from './model.js'
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

class Name implements PdfName {
  readonly name: string

  constructor(name: string) {
    this.name = name
  }
}

class Reference implements PdfRef {
  readonly object: number

  constructor(object: number) {
    this.object = object
  }
}

class Bytes implements PdfString {
  readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }
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

/**
 * What one document's parse has made so far, which every grammar over its
 * bytes and its object streams shares: its counts, its names, and its
 * references, each held once.
 */
export class Reading {
  readonly context = PDFContext.create()
  private values = 0
  private nameBytes = 0
  private readonly names = new Map<string, Name>()
  /** References by object number, where they name generation 0, as almost every reference does; by number and generation where not. */
  private readonly refs = new Map<number, Reference>()
  private readonly otherRefs = new Map<string, Reference>()
  /** The reference to object 0, which no definition is (`parse.ts` refuses one): what a number no object can have names. */
  private readonly nowhere = new Reference(0)
  /** The generation a reference names, where it is not 0; every other reference names 0. */
  readonly generations = new Map<PdfRef, number>()

  counted(): void {
    this.values += 1
    if (this.values > MAX_DOCUMENT_VALUES) refuse('values')
  }

  /** The document's one name of this written form, its decoded bytes counted the first time it is met. */
  name(written: string, length: number): Name {
    const known = this.names.get(written)
    if (known !== undefined) return known
    this.nameBytes += length
    if (this.nameBytes > MAX_DOCUMENT_NAME_BYTES) refuse('name-bytes')
    const made = new Name(written)
    this.names.set(written, made)
    return made
  }

  /**
   * The document's one reference to an object at a generation: a whole
   * object number, a generation from 0 to 65,535. An object number no file
   * can define -- below 1, or past what a number holds exactly, as a writer
   * that wraps a negative one through 2^64 writes it -- names no object, as
   * a reference to any object a file does not hold names none (ISO 32000-1
   * 7.3.10): the one reference to object 0, which no definition is, however
   * many such numbers the file writes. A fraction would name an object to a
   * reader that rounded it, and is refused.
   */
  ref(object: number, generation: number): Reference {
    if (!Number.isInteger(object) || !Number.isInteger(generation) || generation < 0 || generation > 65_535) refuse('reference')
    if (object < 1 || !Number.isSafeInteger(object)) return this.nowhere
    const known = generation === 0 ? this.refs.get(object) : this.otherRefs.get(`${object} ${generation}`)
    if (known !== undefined) return known
    const made = new Reference(object)
    if (generation === 0) this.refs.set(object, made)
    else {
      this.otherRefs.set(`${object} ${generation}`, made)
      this.generations.set(made, generation)
    }
    return made
  }
}

export class Grammar extends PDFObjectParser {
  private readonly data: Uint8Array
  private readonly reading: Reading
  private readonly inObjectStream: boolean
  private depth = 0

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
    const value = Number(String.fromCharCode(...this.data.subarray(start, end)))
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
    return this.dictOf(this.parseDict())
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
   * by the reading, and never goes into pdf-lib's process-lifetime pool;
   * and a number ends where its digits do, not where the look for a
   * generation and an R stopped, so that a member of an object stream ends
   * where its last token does (`parse.ts`). What the look read -- white
   * space and comments, a number -- the read after it reads again, so no
   * byte is read more than three times.
   */
  protected override parseNumberOrRef(): PDFNumber | PDFRef {
    const first = this.parseRawNumber()
    const end = this.at
    this.skipWhitespaceAndComments()
    if (isDigit(this.peek())) {
      const second = this.parseRawNumber()
      this.skipWhitespaceAndComments()
      if (this.peek() === R) {
        this.moveTo(this.at + 1)
        return this.reading.ref(first, second) as unknown as PDFRef
      }
    }
    this.moveTo(end)
    return PDFNumber.of(first)
  }

  /** pdf-lib's number grammar -- a sign, digits and a point up to the first point, then digits -- measured first, and never NaN. */
  protected override parseRawNumber(): number {
    const data = this.data
    const start = this.at
    const bound = start + MAX_DOCUMENT_NUMBER_LENGTH
    let end = start
    while (end <= bound && isNumeric(data[end])) {
      end += 1
      if (data[end - 1] === POINT) break
    }
    while (end <= bound && isDigit(data[end])) end += 1
    if (end > bound) refuse('number-length')
    const value = Number(String.fromCharCode(...data.subarray(start, end)))
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
    // Most names are written as they are named: read in one call, as one flat string.
    let plain = true
    for (let at = start; at < end && plain; at += 1) plain = NAMED[this.data[at] as number]?.length === 1
    if (plain) return this.reading.name(String.fromCharCode(...this.data.subarray(start, end)), end - start) as unknown as PDFName
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

  /** A literal string as its bytes, its escapes and ends of line read as ISO 32000-1 7.3.4.2 reads them. */
  protected override parseString(): PDFString {
    const data = this.data
    const bytes: number[] = []
    let at = this.at + 1
    for (let depth = 1; ;) {
      if (at >= data.length) refuse('string-end')
      const byte = data[at] as number
      at += 1
      if (byte === BACKSLASH) at = this.escaped(at, bytes)
      else if (byte === CR) {
        bytes.push(LF)
        if (data[at] === LF) at += 1
      } else {
        if (byte === LEFT) depth += 1
        if (byte === RIGHT) depth -= 1
        if (depth === 0) break
        bytes.push(byte)
      }
      if (bytes.length > MAX_DOCUMENT_STRING_LENGTH) refuse('string-length')
    }
    this.moveTo(at)
    return new Bytes(Uint8Array.from(bytes)) as unknown as PDFString
  }

  /** The escape after a backslash at `at`, its byte pushed to `bytes`; where the string goes on. */
  private escaped(at: number, bytes: number[]): number {
    const data = this.data
    const byte = data[at]
    if (byte === undefined) refuse('string-end')
    if (isOctal(byte)) {
      let value = byte - 0x30
      let next = at + 1
      for (; next < at + 3 && isOctal(data[next]); next += 1) value = value * 8 + (data[next] as number) - 0x30
      bytes.push(value & 0xff)
      return next
    }
    // A backslash and an end of line continue the string on the next line.
    if (byte === CR) return data[at + 1] === LF ? at + 2 : at + 1
    if (byte === LF) return at + 1
    bytes.push(ESCAPES[byte] ?? byte)
    return at + 1
  }

  /** A hexadecimal string as its bytes: pairs of digits, white space between them, an odd last digit followed by 0 (7.3.4.3). */
  protected override parseHexString(): PDFHexString {
    const data = this.data
    const bytes: number[] = []
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
        bytes.push(high * 16 + digit)
        high = -1
      }
      if (bytes.length > MAX_DOCUMENT_STRING_LENGTH) refuse('string-length')
    }
    if (high >= 0) bytes.push(high * 16)
    if (bytes.length > MAX_DOCUMENT_STRING_LENGTH) refuse('string-length')
    this.moveTo(at)
    return new Bytes(Uint8Array.from(bytes)) as unknown as PDFHexString
  }

  private enter(): void {
    this.depth += 1
    if (this.depth > MAX_DOCUMENT_DEPTH) refuse('depth')
  }

  protected override parseArray(ref?: PDFRef): PDFArray {
    this.enter()
    const array = super.parseArray(ref)
    this.depth -= 1
    return array
  }

  protected override parseDict(ref?: PDFRef): PDFDict {
    this.enter()
    const dict = super.parseDict(ref)
    this.depth -= 1
    return dict
  }

  /**
   * pdf-lib's, without its search: a stream stands only as an indirect
   * object's whole value, and its data ends where its /Length says. A
   * dictionary that is no stream ends at its `>>`, not where the look for
   * `stream` stopped.
   */
  protected override parseDictOrStream(ref?: PDFRef): PDFDict | PDFStream {
    const nested = this.depth > 0 || this.inObjectStream
    const dict = this.parseDict(ref)
    const end = this.at
    this.skipWhitespaceAndComments()
    if (!STREAM.some((word) => this.matchKeyword(word))) {
      this.moveTo(end)
      return dict
    }
    if (nested) refuse('stream-inside')
    return this.streamOf(this.dictOf(dict)) as unknown as PDFStream
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

  /** What pdf-lib's grammar made, in the model. */
  private neutral(object: PDFObject): PdfValue {
    if (object instanceof Name || object instanceof Bytes || object instanceof Reference) return object
    if (object instanceof PDFNumber) return object.asNumber()
    if (object instanceof PDFArray) return object.asArray().map((item) => this.neutral(item))
    if (object instanceof PDFDict) return this.dictOf(object)
    if (object instanceof PDFBool) return object.asBoolean()
    if (object === PDFNull) return null
    // Every other kind pdf-lib makes is read by the reader's own code above, and a stream within a value is refused.
    return refuse('unreadable')
  }

  /** A dictionary in the model, keyed by its names' written forms; an entry of null is none (ISO 32000-1 7.3.7). */
  private dictOf(dict: PDFDict): PdfDict {
    const entries = new Map<string, PdfValue>()
    for (const [key, value] of dict.entries()) {
      const neutral = this.neutral(value)
      if (neutral !== null) entries.set((key as unknown as Name).name, neutral)
    }
    return { entries }
  }
}
