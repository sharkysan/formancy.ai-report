import { find, findLast, isDigit, isWhite, keyword, startsAt } from './bytes.js'
import { Grammar, type Indirect, type PendingLength } from './grammar.js'
import { decodedBytes, type InflateBudget } from './inflate.js'
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_OBJECTS } from './limits.js'
import { isArray, isCount, isDict, isName, isRef, isStream, type PdfDict, type PdfObjects, type PdfStream, type PdfValue } from './model.js'
import { pageTree } from './page-tree.js'
import { Reading } from './reading.js'
import { caught, refuse, type DocumentRefusal } from './refusals.js'
import { isPdf } from './sniff.js'
import { chained, Claims, table, xrefStream, type Entry, type Section } from './xref.js'

/**
 * The strict parse: a PDF's bytes read into the neutral model, every
 * object by number as the last cross-reference names it, or refused.
 *
 * pdf-lib's own document loop is not used: it skips junk a byte at a time
 * (twenty mebibytes of digits never finish), keeps the last definition
 * written whatever the cross-reference names (a shadowed revision prints),
 * loads a file cut short, and is asynchronous. The loop here is the parser
 * spike's: the byte bound, the header at the first byte and the file's end
 * found before a byte is parsed, an encrypted file refused from its last
 * trailer; then, from the top, only indirect objects, cross-reference
 * sections and `startxref`, between white space and comments, anything
 * else refused at once. Every definition's place is kept, and once the
 * file is read the last definition of each number must be the one the
 * cross-reference chain names. Synchronous throughout: nothing here or in
 * the pdf-lib code it calls awaits.
 */

/** Internal: the file parsed, every object by number as the last cross-reference names it, and its pages, the tree walked. */
export interface ParsedDocument {
  readonly objects: PdfObjects
  readonly trailer: PdfDict
  readonly catalog: PdfDict
  /** The object numbers of its pages, in the order they print. */
  readonly pages: readonly number[]
  /**
   * What the parse left of `MAX_DOCUMENT_INFLATED` after its object and
   * cross-reference streams: the pages' content and the closure's streams
   * are decoded from it, so that a document decodes `MAX_DOCUMENT_INFLATED`
   * once, every stream of it together. Each read of the pages, or of a
   * closure, takes from it again.
   */
  readonly budget: InflateBudget
}

const OBJ = keyword('obj')
const ENDOBJ = keyword('endobj')
const XREF = keyword('xref')
const TRAILER = keyword('trailer')
const STARTXREF = keyword('startxref')
const EOF = keyword('%%EOF')
/** Acrobat looks for %%EOF in a file's last 1,024 bytes (ISO 32000-1, Annex H). */
const EOF_WITHIN = 1024

/**
 * Where the loop read a definition: at an offset of the file, or at an
 * index of an object stream -- the definition of that stream it was read
 * from named by its offset, since an update may write the stream again.
 */
type Where =
  | { readonly kind: 'at'; readonly offset: number; readonly gen: number }
  | { readonly kind: 'in'; readonly stream: number; readonly index: number; readonly from: number }

interface Definition {
  /** Each place the number was defined, in the order the loop read them. */
  readonly wheres: Where[]
  /** The last definition's value, and its pending length where it is such a stream. */
  read: Indirect
  /** Whether the last definition is a cross-reference stream, which need not list itself. */
  xrefStream: boolean
}

const generationOf = (definition: Definition): number => {
  const last = definition.wheres.at(-1)
  return last?.kind === 'at' ? last.gen : 0
}

/** Whether `entry` names the definition read at `where`. */
const names = (entry: Exclude<Entry, { kind: 'free' }>, where: Where): boolean =>
  entry.kind === 'at'
    ? where.kind === 'at' && where.offset === entry.offset && where.gen === entry.gen
    : where.kind === 'in' && where.stream === entry.stream && where.index === entry.index

/**
 * Whether the trailer the last `startxref` names says the file is
 * encrypted: read before the loop, so that an encrypted file is refused as
 * that, not as an object stream that does not inflate. Anything that
 * stops this reading is the loop's to find.
 */
function encryptedByItsLastTrailer(bytes: Uint8Array): boolean {
  const startxref = findLast(bytes, STARTXREF)
  if (startxref < 0) return false
  return (
    caught(() => {
      const grammar = new Grammar(bytes, new Reading())
      grammar.moveTo(startxref + STARTXREF.length)
      grammar.space()
      const at = grammar.int('no-startxref')
      if (startsAt(bytes, XREF, at)) {
        const trailer = find(bytes, TRAILER, at)
        if (trailer < 0) return false
        grammar.moveTo(trailer + TRAILER.length)
        grammar.space()
        return grammar.dictionary().entries.has('Encrypt')
      }
      grammar.moveTo(at)
      grammar.int('object-header')
      grammar.space()
      grammar.int('object-header')
      grammar.space()
      if (!grammar.match(OBJ)) refuse('object-header')
      grammar.space()
      const { value } = grammar.indirect()
      return isStream(value) && value.dict.entries.has('Encrypt')
    }) === true
  )
}

class Loop {
  private readonly bytes: Uint8Array
  private readonly reading = new Reading()
  private readonly grammar: Grammar
  private readonly budget: InflateBudget = { left: MAX_DOCUMENT_INFLATED, reading: this.reading }
  private readonly definitions = new Map<number, Definition>()
  private readonly sections = new Map<number, Section>()
  private readonly claims = new Claims()
  private count = 0
  private startxref: number | undefined

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.grammar = new Grammar(bytes, this.reading)
  }

  read(): ParsedDocument {
    const bytes = this.bytes
    if (!isPdf(bytes)) refuse('header')
    const eof = findLast(bytes, EOF)
    if (eof < 0) refuse('no-eof')
    for (let at = eof + EOF.length; at < bytes.length; at += 1) if (!isWhite(bytes[at])) refuse('after-eof')
    if (bytes.length - eof > EOF_WITHIN) refuse('eof-far')
    if (encryptedByItsLastTrailer(bytes)) refuse('encrypted')
    const grammar = this.grammar
    for (grammar.space(); !grammar.done(); grammar.space()) {
      const at = grammar.at
      if (isDigit(grammar.peek())) this.object(at)
      else if (grammar.match(XREF)) this.sections.set(at, table(grammar, this.claims))
      else if (grammar.match(STARTXREF)) {
        grammar.space()
        this.startxref = grammar.int('no-startxref')
      } else if (grammar.match(TRAILER)) refuse('trailer-alone')
      else refuse('between-objects')
    }
    const { entries, trailer } = chained(this.sections, this.startxref)
    const objects = this.agreed(entries)
    this.referencesAgree(objects)
    this.lengthsHeld(objects)
    const root = trailer.entries.get('Root')
    const catalog = isRef(root) ? objects.get(root.object) : undefined
    if (!isDict(catalog) || !isName(catalog.entries.get('Type'), 'Catalog')) refuse('no-catalog')
    return { objects, trailer, catalog, pages: pageTree(objects, catalog), budget: this.budget }
  }

  /** `N G obj`, its value, `endobj`; a cross-reference stream read as a section, an object stream's members as definitions of their own. */
  private object(at: number): void {
    const grammar = this.grammar
    const num = grammar.int('object-header')
    grammar.space()
    const gen = grammar.int('object-header')
    grammar.space()
    if (num < 1 || gen > 65_535 || !grammar.match(OBJ)) refuse('object-header')
    grammar.space()
    const read = grammar.indirect()
    grammar.space()
    if (!grammar.match(ENDOBJ)) refuse('object-end')
    const where: Where = { kind: 'at', offset: at, gen }
    const type = isStream(read.value) ? read.value.dict.entries.get('Type') : undefined
    this.define(num, where, read, isName(type, 'XRef'))
    if (isStream(read.value) && isName(type, 'XRef')) this.sections.set(at, xrefStream(read.value, this.budget, this.claims))
    if (isStream(read.value) && isName(type, 'ObjStm')) this.objectStream(num, read.value, at)
  }

  private define(num: number, where: Where, read: Indirect, xrefStream: boolean): void {
    this.count += 1
    if (this.count > MAX_DOCUMENT_OBJECTS) refuse('objects')
    const known = this.definitions.get(num)
    if (known === undefined) this.definitions.set(num, { wheres: [where], read, xrefStream })
    else {
      known.wheres.push(where)
      known.read = read
      known.xrefStream = xrefStream
    }
  }

  /**
   * An object stream's members, its /N held to the bound before it is
   * inflated against the budget, each read by the same grammar, in order:
   * the header, then each member from its offset, each read ending where
   * the next member begins, so that every byte of the stream is read once.
   * `from` is the offset of the stream's definition, which its members name.
   */
  private objectStream(container: number, stream: PdfStream, from: number): void {
    const n = stream.dict.entries.get('N')
    const first = stream.dict.entries.get('First')
    if (!isCount(n) || !isCount(first)) refuse('object-stream')
    if (this.count + n > MAX_DOCUMENT_OBJECTS) refuse('objects')
    const data = decodedBytes(stream, this.budget)
    const grammar = new Grammar(data, this.reading, true)
    const header: (readonly [number, number])[] = []
    for (let i = 0; i < n; i += 1) {
      grammar.space()
      const num = grammar.int('object-stream')
      grammar.space()
      header.push([num, grammar.int('object-stream')])
    }
    for (const [index, [num, offset]] of header.entries()) {
      if (num < 1) refuse('object-stream')
      // What was read before -- the header, or the member before -- ends where this member begins. A read takes at
      // least a byte, so the offsets increase, as ISO 32000-1 7.5.7 has them, and no byte is read twice.
      if (grammar.at > first + offset) refuse('object-stream-order')
      if (first + offset >= data.length) refuse('object-stream-offset')
      grammar.moveTo(first + offset)
      this.define(num, { kind: 'in', stream: container, index, from }, grammar.indirect(), false)
    }
  }

  /**
   * Every definition held to the entry the chain gives its number, and
   * every entry to a definition: the objects the file holds, as the last
   * cross-reference names them.
   */
  private agreed(entries: ReadonlyMap<number, Entry>): Map<number, PdfValue | PdfStream> {
    const objects = new Map<number, PdfValue | PdfStream>()
    for (const [num, definition] of this.definitions) {
      const entry = entries.get(num)
      // Unlisted, the definition is one a viewer may find or not; freed by an update, it is nothing to every viewer.
      if (entry === undefined && !definition.xrefStream) refuse('unlisted')
      if (entry === undefined || entry.kind === 'free') continue
      // An object that is nothing but a reference makes a look-up a chain; every value a reference names is the object
      // itself, one look-up away, as everything that resolves one reads it.
      if (isRef(definition.read.value)) refuse('bare-reference')
      const last = definition.wheres.at(-1) as Where
      if (!names(entry, last)) refuse(definition.wheres.some((where) => names(entry, where)) ? 'shadow' : 'misplaced')
      // A member of an object stream that is not itself where the chain places it is found by no viewer; one read from
      // another definition of the stream than the one the chain places is H11's shadow, by way of its container.
      if (last.kind === 'in') {
        const container = entries.get(last.stream)
        if (container?.kind !== 'at') refuse('missing')
        if (container.offset !== last.from) refuse('shadow')
      }
      objects.set(num, definition.read.value)
    }
    // An entry in use that names no definition is nothing where no object can stand -- at offset 0, the header, as
    // Apple's Quartz writes an unused number, or past the end -- and anywhere else a place a viewer might find an
    // object the loop never read.
    for (const [num, entry] of entries) {
      if (entry.kind === 'free' || num === 0 || this.definitions.has(num)) continue
      if (entry.kind === 'at' && (entry.offset === 0 || entry.offset >= this.bytes.length)) continue
      refuse('missing')
    }
    return objects
  }

  /**
   * Every reference the objects hold names the generation the
   * cross-reference gives its object. Walked only where a generation other
   * than 0 was written, by a reference or a definition, which almost no
   * file has.
   */
  private referencesAgree(objects: ReadonlyMap<number, PdfValue | PdfStream>): void {
    const generations = this.reading.generations
    const kept = new Map<number, number>()
    for (const num of objects.keys()) {
      const generation = generationOf(this.definitions.get(num) as Definition)
      if (generation !== 0) kept.set(num, generation)
    }
    if (generations.size === 0 && kept.size === 0) return
    const walk = (value: PdfValue): void => {
      if (isRef(value)) {
        if (objects.has(value.object) && (generations.get(value) ?? 0) !== (kept.get(value.object) ?? 0)) refuse('generation')
      } else if (isArray(value)) value.forEach(walk)
      else if (isDict(value)) value.entries.forEach(walk)
    }
    for (const value of objects.values()) walk(isStream(value) ? value.dict : value)
  }

  /** Each stream whose /Length is a reference, held to the number that object is: its data ends there, white space after it. */
  private lengthsHeld(objects: Map<number, PdfValue | PdfStream>): void {
    for (const [num, definition] of this.definitions) {
      const pending: PendingLength | undefined = definition.read.pending
      if (pending === undefined || !objects.has(num)) continue
      const length = objects.get(pending.length) ?? null
      if (!isCount(length)) refuse('stream-length')
      if (pending.start + length > pending.end) refuse('stream-end')
      for (let at = pending.start + length; at < pending.end; at += 1) if (!isWhite(this.bytes[at])) refuse('stream-end')
      objects.set(num, { dict: pending.stream.dict, bytes: this.bytes.subarray(pending.start, pending.start + length) })
    }
  }
}

/**
 * Internal: the file parsed, or why not. Synchronous; never throws. The
 * bytes are held to their bound, then copied, before one is read: every
 * stream the parse keeps is a view of its own copy, so that a caller who
 * reuses its buffer, or another thread that writes the SharedArrayBuffer
 * under it while the parse runs, changes nothing that was read or checked.
 * Copied by construction, never by `slice`, which Node's Buffer makes a
 * view. The bytes are a Uint8Array of the host's own realm: anything else
 * -- an ArrayBuffer, a DataView, a Proxy, an iframe's or a vm's
 * Uint8Array -- is refused (`not-bytes`) before a property of it is read,
 * and a host that holds bytes of another realm copies them into its own
 * first.
 */
export function parseDocument(bytes: Uint8Array): ParsedDocument | DocumentRefusal {
  return caught(() => {
    // An ArrayBuffer has no length, and a view of one is no copy; a Proxy traps whatever is read of it, and isView sees none.
    if (!ArrayBuffer.isView(bytes) || !(bytes instanceof Uint8Array)) refuse('not-bytes')
    if (bytes.length > MAX_DOCUMENT_BYTES) refuse('bytes')
    const copy = new Uint8Array(bytes)
    // A subclass's length may say other than what it holds: the copy's is what it holds.
    if (copy.length > MAX_DOCUMENT_BYTES) refuse('bytes')
    return new Loop(copy).read()
  })
}
