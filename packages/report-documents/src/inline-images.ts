import { find, isDelimiter, isRegular, isWhite, keyword, startsAt } from './bytes.js'
import { Grammar, Reading } from './grammar.js'
import { componentsOf, declared, declaredSize, type ImageSize } from './images.js'
import { inflatedEnd, passedOn, type InflateBudget } from './inflate.js'
import { isArray, isDict, isName, resolved, type PdfDict, type PdfObjects, type PdfStream, type PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'
import { caught, DocumentRefused, refuse, type DocumentRefusal } from './refusals.js'

/**
 * The inline images a content stream holds (ISO 32000-1 8.9.7): `BI`, a
 * dictionary, `ID` and one white-space byte, the image's data, `EI`. A
 * viewer of the report decodes each, as it decodes an image XObject, so
 * each is held to the pixels it declares (images.ts), each alone. Its
 * data is delimited exactly, so that what follows it is read as the
 * operators it is: unfiltered, by its declared rows, which its colour
 * space's components and its bits a sample make up; Flate, where the
 * decoder finds its end, decoded through the document's budget; ASCIIHex
 * and ASCII85, at their markers; then white space and `EI`. PDF.js ends
 * unfiltered and Flate data where it first finds "EI" and white space, so
 * data that holds those anywhere a viewer could end it is refused: what
 * the reader reads and what a viewer draws never differ. An inline image
 * whose data begins in any other filter -- DCT, fax, run-length, LZW -- is
 * one whose end the reader cannot find, and is refused. The filters after
 * the first are the viewer's, as an image XObject's are.
 *
 * The lexer reads each byte a bounded number of times. It knows enough of
 * the content to find `BI` only where an operator may stand: never in a
 * string, a comment, a hexadecimal string or a name. Anywhere else a "BI"
 * in a run of regular bytes begins an inline image, glued to what stands
 * before it or not, inside an array or a dictionary or not, as PDF.js
 * reads one there: PDF.js splits "qBI" into q and BI, and parses BI inside
 * an array. Nothing else about the content is refused: its operators are
 * the viewer's.
 */

const PERCENT = 0x25
const LEFT = 0x28
const RIGHT = 0x29
const BACKSLASH = 0x5c
const LESS = 0x3c
const GREATER = 0x3e
const SLASH = 0x2f
const TILDE = 0x7e
const CR = 0x0d
const LF = 0x0a
const B = 0x42
const E = 0x45
const I = 0x49
const ID = keyword('ID')
const EI = keyword('EI')

/** The filters an inline image may name abbreviated (ISO 32000-1 Table 94), each the one it stands for. A Map, not an object's keys: /constructor would find what an object's prototype holds. */
const FILTERS: ReadonlyMap<string, string> = new Map([
  ['AHx', 'ASCIIHexDecode'],
  ['A85', 'ASCII85Decode'],
  ['LZW', 'LZWDecode'],
  ['Fl', 'FlateDecode'],
  ['RL', 'RunLengthDecode'],
  ['CCF', 'CCITTFaxDecode'],
  ['DCT', 'DCTDecode'],
])

/** The filters whose end the reader finds exactly: Flate by inflating it, ASCIIHex and ASCII85 at their markers. */
const DELIMITED: ReadonlySet<string> = new Set(['FlateDecode', 'ASCIIHexDecode', 'ASCII85Decode'])

/**
 * What the lexer does at each byte, as a table it looks up once a byte:
 * passes over it -- white space, and a delimiter that is a token of its
 * own -- or reads the token it begins: a run of regular bytes (bytes.ts),
 * a comment, a string, a hexadecimal string or a dictionary's `<<`, a name.
 */
const SKIP = 0
const RUN = 1
const COMMENT = 2
const STRING = 3
const ANGLE = 4
const NAME = 5
const BEGINS = Uint8Array.from({ length: 256 }, (_, byte) => {
  if (byte === PERCENT) return COMMENT
  if (byte === LEFT) return STRING
  if (byte === LESS) return ANGLE
  if (byte === SLASH) return NAME
  return isRegular(byte) ? RUN : SKIP
})
const regular = (byte: number | undefined): boolean => BEGINS[byte as number] === RUN

/** The bits a sample may be written in (ISO 32000-1 8.9.5.1). */
const BITS: ReadonlySet<number> = new Set([1, 2, 4, 8, 16])

/**
 * One reading a document, which every inline image's dictionary in it is
 * read into: their values are counted together against
 * `MAX_DOCUMENT_VALUES`, and their names against `MAX_DOCUMENT_NAME_BYTES`,
 * as the file's own are, so that a document of a few hundred thousand
 * inline images is refused rather than read for seconds.
 */
const readings = new WeakMap<ParsedDocument, Reading>()

function readingOf(parsed: ParsedDocument): Reading {
  let reading = readings.get(parsed)
  if (reading === undefined) {
    reading = new Reading()
    readings.set(parsed, reading)
  }
  return reading
}

/**
 * Whether "BI" stands anywhere in `content`, found by the platform's own
 * search: an inline image begins with it, so a content that does not hold
 * it -- most do not, and a stream of zeros never does -- holds none, and is
 * not read byte by byte.
 */
function mayHoldImages(content: Uint8Array): boolean {
  for (let at = content.indexOf(B); at >= 0; at = content.indexOf(B, at + 1)) if (content[at + 1] === I) return true
  return false
}

/** Where a comment that begins at `at` ends: at the end of its line. */
function endOfLine(content: Uint8Array, at: number): number {
  const length = content.length
  let end = at + 1
  while (end < length && content[end] !== CR && content[end] !== LF) end += 1
  return end
}

/** Where a literal string that begins at `at` ends, past its last parenthesis: an escaped byte skipped, nested parentheses balanced; the content's end where it never closes. */
function endOfString(content: Uint8Array, at: number): number {
  const length = content.length
  let depth = 0
  for (let end = at; end < length; end += 1) {
    const byte = content[end]
    if (byte === BACKSLASH) end += 1
    else if (byte === LEFT) depth += 1
    else if (byte === RIGHT) {
      depth -= 1
      if (depth === 0) return end + 1
    }
  }
  return length
}

/** Where a hexadecimal string that begins at `at` ends, past its `>`; the content's end where it never closes. */
function endOfHex(content: Uint8Array, at: number): number {
  const end = find(content, [GREATER], at + 1)
  return end < 0 ? content.length : end + 1
}

/** Where a run of regular bytes from `at` ends: a name's, after its slash. */
function endOfRun(content: Uint8Array, at: number): number {
  let end = at
  while (regular(content[end])) end += 1
  return end
}

/** The inline images of one content, read in one pass. */
class InlineImages {
  private readonly parsed: ParsedDocument
  private readonly content: Uint8Array
  private readonly resources: PdfDict
  private readonly budget: InflateBudget
  /** The grammar each dictionary is read with, made at the first. */
  private grammar: Grammar | undefined

  constructor(parsed: ParsedDocument, content: Uint8Array, resources: PdfDict, budget: InflateBudget) {
    this.parsed = parsed
    this.content = content
    this.resources = resources
    this.budget = budget
  }

  read(): void {
    const content = this.content
    if (!mayHoldImages(content)) return
    const length = content.length
    for (let at = 0; at < length;) {
      const begins = BEGINS[content[at] as number]
      if (begins === SKIP) at += 1
      else if (begins === RUN) at = this.run(at)
      else if (begins === NAME) at = endOfRun(content, at + 1)
      else if (begins === STRING) at = endOfString(content, at)
      else if (begins === COMMENT) at = endOfLine(content, at)
      else at = content[at + 1] === LESS ? at + 2 : endOfHex(content, at)
    }
  }

  /** Past a run of regular bytes that begins at `at`, or past the inline image a "BI" in it begins. */
  private run(at: number): number {
    const content = this.content
    let previous: number | undefined
    for (let end = at; ; end += 1) {
      const byte = content[end]
      if (!regular(byte)) return end
      if (previous === B && byte === I) return this.image(end + 1)
      previous = byte
    }
  }

  /** Past the `EI` of the inline image whose dictionary begins at `from`, held to the pixels it declares and its data delimited. */
  private image(from: number): number {
    const { dict, data } = this.dictionary(from)
    const size = declaredSize(this.parsed.objects, dict)
    const filters = this.filters(dict)
    const [first] = filters
    if (first !== undefined && !DELIMITED.has(first)) refuse('inline-filter')
    passedOn(filters)
    const end = this.dataEnd(data, first, dict, size)
    if (first === undefined || first === 'FlateDecode') this.searched(data, end)
    return this.ended(end)
  }

  /**
   * An inline image's dictionary, from `from` to its `ID`, and where its
   * data begins: after `ID` and the one white-space byte after it. Pairs of
   * a name and a value, each name once; anything else, the grammar's
   * faults among it, is no inline image.
   */
  private dictionary(from: number): { readonly dict: PdfDict; readonly data: number } {
    const content = this.content
    this.grammar ??= new Grammar(content, readingOf(this.parsed), true)
    const grammar = this.grammar
    grammar.moveTo(from)
    const entries = new Map<string, PdfValue>()
    try {
      for (;;) {
        grammar.space()
        const at = grammar.at
        if (startsAt(content, ID, at)) return isWhite(content[at + 2]) ? { dict: { entries }, data: at + 3 } : refuse('inline-image')
        const key = grammar.indirect().value
        if (!isName(key) || entries.has(key.name)) refuse('inline-image')
        // The grammar refuses a stream here, as one inside another object, so a value is never one.
        const { value } = grammar.indirect()
        if (value !== null) entries.set(key.name, value)
      }
    } catch (error) {
      if (error instanceof DocumentRefused) throw error
      return refuse('inline-image')
    }
  }

  /** The filters an inline image names, abbreviated or not, each as the one it stands for. */
  private filters(dict: PdfDict): readonly string[] {
    const objects = this.parsed.objects
    const written = declared(objects, dict, 'F', 'Filter', 'inline-image')
    const listed = written === undefined ? [] : isArray(written) ? written : [written]
    return listed.map((item) => {
      const filter = resolved(objects, item)
      return isName(filter) ? (FILTERS.get(filter.name) ?? filter.name) : refuse('inline-image')
    })
  }

  /** Where an inline image's data, from `data`, ends, by the filter it begins in or by its rows where it has none. */
  private dataEnd(data: number, first: string | undefined, dict: PdfDict, size: ImageSize): number {
    const content = this.content
    if (first === 'FlateDecode') return data + inflatedEnd(content.subarray(data), this.budget)
    if (first === 'ASCIIHexDecode') {
      const marker = find(content, [GREATER], data)
      return marker < 0 ? refuse('inline-end') : marker + 1
    }
    if (first === 'ASCII85Decode') {
      const marker = find(content, [TILDE], data)
      return marker >= 0 && content[marker + 1] === GREATER ? marker + 2 : refuse('inline-end')
    }
    const row = Math.ceil((size.width * componentsOf(this.parsed.objects, dict, this.resources) * this.bits(dict)) / 8)
    const end = data + row * size.height
    return end <= content.length ? end : refuse('inline-end')
  }

  /**
   * Refused where data a viewer finds the end of by searching -- unfiltered
   * or Flate, from `data` to `end` -- holds "EI" followed by white space,
   * inside it or as its last two bytes: PDF.js would end the image there,
   * and read the rest of its data as the operators it is not, an inline
   * image the reader never held among them.
   */
  private searched(data: number, end: number): void {
    const content = this.content
    for (let at = data; at + 1 < end; at += 1) if (content[at] === E && content[at + 1] === I && isWhite(content[at + 2])) refuse('inline-end')
  }

  /** The bits a sample of an unfiltered inline image is written in: one of ISO's, or an image mask's one, which it need not give. */
  private bits(dict: PdfDict): number {
    const objects = this.parsed.objects
    const bits = declared(objects, dict, 'BPC', 'BitsPerComponent', 'inline-image')
    if (declared(objects, dict, 'IM', 'ImageMask', 'image-space') === true) return bits === undefined || bits === 1 ? 1 : refuse('inline-image')
    return typeof bits === 'number' && BITS.has(bits) ? bits : refuse('inline-image')
  }

  /** Past the `EI` that follows an inline image's data, ending at `end`, after white space -- some, as the data a viewer searches needs -- a token of its own, or no inline image. */
  private ended(end: number): number {
    const content = this.content
    let at = end
    while (isWhite(content[at])) at += 1
    const after = content[at + 2]
    if (at === end || !startsAt(content, EI, at) || (after !== undefined && !isWhite(after) && !isDelimiter(after))) refuse('inline-end')
    return at + 2
  }
}

/**
 * Internal: every inline image `content` holds held to the pixels it
 * declares and delimited exactly -- an unfiltered one's colour space named
 * by name counted in `resources`, Flate data decoded from `budget`; throws
 * the refusal.
 */
export function heldInlineImages(parsed: ParsedDocument, content: Uint8Array, resources: PdfDict, budget: InflateBudget): void {
  new InlineImages(parsed, content, resources, budget).read()
}

/** Internal: undefined where every inline image `content` holds is held, or why not. */
export function checkInlineImages(parsed: ParsedDocument, content: Uint8Array, resources: PdfDict, budget: InflateBudget): undefined | DocumentRefusal {
  return caught((): undefined => {
    heldInlineImages(parsed, content, resources, budget)
    return undefined
  })
}

const NONE: PdfDict = { entries: new Map() }

/**
 * Internal: the resources a form, a pattern's cell or a glyph draws its
 * inline images with: its own /Resources, and none where it holds none.
 * Never the page's that draws it, which may be another on another page
 * (ISO 32000-1 7.8.3 deprecates inheriting them).
 */
export function ownResources(objects: PdfObjects, stream: PdfStream): PdfDict {
  const resources = resolved(objects, stream.dict.entries.get('Resources'))
  return isDict(resources) ? resources : NONE
}
