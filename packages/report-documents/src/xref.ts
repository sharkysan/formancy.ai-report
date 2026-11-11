import { isDigit, keyword } from './bytes.js'
import type { Grammar } from './grammar.js'
import { decodedBytes } from './inflate.js'
import { MAX_DOCUMENT_OBJECTS, MAX_DOCUMENT_XREF_ENTRIES, MAX_DOCUMENT_XREF_SECTIONS } from './limits.js'
import { isArray, isCount, type PdfDict, type PdfStream } from './model.js'
import type { InflateBudget } from './reading.js'
import { refuse } from './refusals.js'

/**
 * A PDF's cross-reference: each section read as the loop meets it -- a
 * classic table and its trailer, or a cross-reference stream -- every claim
 * it makes held, before an entry is read, to `MAX_DOCUMENT_OBJECTS` within
 * the section and to `MAX_DOCUMENT_XREF_ENTRIES` with every other section
 * the file holds, chained or not, and the sections themselves to
 * `MAX_DOCUMENT_XREF_SECTIONS`; every subsection held below its /Size;
 * and the sections chained from the last `startxref` through /Prev and a
 * hybrid file's /XRefStm, newest first. pdf-lib reads the sections and
 * throws them away; its row reader trusts /Size, /W and /Index, so the
 * reader reads a stream's rows itself, after holding them to what they
 * claim.
 */

/** Where a cross-reference places an object: at an offset of the file, in an object stream, or nowhere. */
export type Entry =
  | { readonly kind: 'at'; readonly offset: number; readonly gen: number }
  | { readonly kind: 'in'; readonly stream: number; readonly index: number }
  | { readonly kind: 'free' }

export interface Section {
  readonly entries: ReadonlyMap<number, Entry>
  /** A classic table's trailer, or a cross-reference stream's dictionary. */
  readonly trailer: PdfDict
  readonly prev: number | undefined
  readonly xrefStm: number | undefined
}

const FREE: Entry = { kind: 'free' }
const TRAILER = keyword('trailer')
const IN_USE = 0x6e
const FREED = 0x66

/**
 * What every section of a file claims, together: each section is read and
 * kept as the loop meets it, chained or not, so a file of sections nothing
 * chains is held here -- the sections as each is met, before it is read,
 * and their entries as each claim is, before its rows are.
 */
export class Claims {
  private sections = 0
  private entries = 0

  section(): void {
    this.sections += 1
    if (this.sections > MAX_DOCUMENT_XREF_SECTIONS) refuse('xref-sections')
  }

  claim(count: number): void {
    this.entries += count
    if (this.entries > MAX_DOCUMENT_XREF_ENTRIES) refuse('xref-claim')
  }
}

/** Every object number is below /Size: a subsection from `first` of `count` entries names none at or past it. */
function belowSize(first: number, count: number, size: number): void {
  if (first + count > size) refuse('xref-size')
}

/** What every section's trailer is held to: no encryption, and a /Size within the bound, besides the free head of the list. */
function checked(trailer: PdfDict): PdfDict {
  if (trailer.entries.has('Encrypt')) refuse('encrypted')
  const size = trailer.entries.get('Size')
  if (typeof size === 'number' && size > MAX_DOCUMENT_OBJECTS + 1) refuse('xref-claim')
  return trailer
}

/** The offset a trailer's key names; one that is not an offset names a place no section stands at. */
function offsetIn(trailer: PdfDict, key: string): number | undefined {
  const value = trailer.entries.get(key)
  if (value === undefined) return undefined
  return isCount(value) ? value : -1
}

/** A classic section, the grammar just past its `xref`: subsections of `first count` and their entries, then its trailer. */
export function table(grammar: Grammar, claims: Claims): Section {
  claims.section()
  const entries = new Map<number, Entry>()
  const subsections: (readonly [number, number])[] = []
  let claimed = 0
  grammar.space()
  while (isDigit(grammar.peek())) {
    const first = grammar.int('xref-entry')
    grammar.space()
    const count = grammar.int('xref-entry')
    claimed += count
    if (claimed > MAX_DOCUMENT_OBJECTS + 1) refuse('xref-claim')
    claims.claim(count)
    subsections.push([first, count])
    // The rows are counted, not the object numbers: past 2^53 a number plus one is the same number.
    for (let row = 0; row < count; row += 1) {
      const num = first + row
      grammar.space()
      const offset = grammar.int('xref-entry')
      grammar.space()
      const gen = grammar.int('xref-entry')
      grammar.space()
      const kind = grammar.peek()
      if (kind !== IN_USE && kind !== FREED) refuse('xref-entry')
      grammar.moveTo(grammar.at + 1)
      if (!entries.has(num)) entries.set(num, kind === IN_USE ? { kind: 'at', offset, gen } : FREE)
    }
    grammar.space()
  }
  if (!grammar.match(TRAILER)) refuse('xref-trailer')
  grammar.space()
  const trailer = checked(grammar.dictionary())
  // A table's /Size follows its rows, so its subsections are held to it once it is read; ISO 32000 requires one.
  const size = trailer.entries.get('Size')
  if (!isCount(size)) refuse('xref-size')
  for (const [first, count] of subsections) belowSize(first, count, size)
  return { entries, trailer, prev: offsetIn(trailer, 'Prev'), xrefStm: offsetIn(trailer, 'XRefStm') }
}

/** `width` bytes of `rows` at `at`, big-endian: within the rows, which are held to every row their stream claims before one is read. */
function field(rows: Uint8Array, at: number, width: number): number {
  let value = 0
  for (let i = 0; i < width; i += 1) value = value * 256 + (rows[at + i] as number)
  return value
}

/**
 * A cross-reference stream: its /Size, /W and /Index read and held to the
 * bound before its rows are inflated against the budget, which must hold
 * every row they claim. A row's type 1 places an object at an offset, 2 in
 * an object stream; 0, and any type PDF does not define, frees it (ISO
 * 32000-1 7.5.8.3).
 */
export function xrefStream(stream: PdfStream, budget: InflateBudget, claims: Claims): Section {
  claims.section()
  const trailer = checked(stream.dict)
  const size = trailer.entries.get('Size')
  const widths = trailer.entries.get('W')
  if (!isCount(size) || !isArray(widths) || widths.length !== 3 || !widths.every((width) => isCount(width) && width <= 4)) refuse('xref-stream')
  const index = trailer.entries.get('Index') ?? [0, size]
  if (!isArray(index) || index.length % 2 !== 0 || !index.every(isCount)) refuse('xref-stream')
  const [typeWidth, offsetWidth, thirdWidth] = widths as readonly [number, number, number]
  const counts = index.filter((_, i) => i % 2 === 1) as readonly number[]
  const claimed = counts.reduce((sum, count) => sum + count, 0)
  if (claimed > MAX_DOCUMENT_OBJECTS + 1) refuse('xref-claim')
  for (let i = 0; i < index.length; i += 2) belowSize(index[i] as number, index[i + 1] as number, size)
  claims.claim(claimed)
  const width = typeWidth + offsetWidth + thirdWidth
  const rows = decodedBytes(stream, budget)
  if (rows.length < claimed * width) refuse('xref-stream-rows')
  const entries = new Map<number, Entry>()
  let at = 0
  for (let i = 0; i < index.length; i += 2) {
    const first = index[i] as number
    for (let row = 0; row < (index[i + 1] as number); row += 1) {
      const num = first + row
      const type = typeWidth === 0 ? 1 : field(rows, at, typeWidth)
      const second = field(rows, at + typeWidth, offsetWidth)
      const third = field(rows, at + typeWidth + offsetWidth, thirdWidth)
      at += width
      if (entries.has(num)) continue
      entries.set(num, type === 1 ? { kind: 'at', offset: second, gen: third } : type === 2 ? { kind: 'in', stream: second, index: third } : FREE)
    }
  }
  return { entries, trailer, prev: offsetIn(trailer, 'Prev'), xrefStm: undefined }
}

/**
 * The entries the file's cross-reference gives, the newest section's
 * first: from the section the last `startxref` names, then its /XRefStm,
 * then its /Prev's, and so on; and the newest trailer.
 */
export function chained(
  sections: ReadonlyMap<number, Section>,
  startxref: number | undefined,
): { readonly entries: ReadonlyMap<number, Entry>; readonly trailer: PdfDict } {
  if (startxref === undefined) refuse('no-startxref')
  const newest = sections.get(startxref)
  if (newest === undefined) refuse('startxref')
  const entries = new Map<number, Entry>()
  const merge = (from: ReadonlyMap<number, Entry>): void => {
    for (const [num, entry] of from) if (!entries.has(num)) entries.set(num, entry)
  }
  const seen = new Set<number>()
  for (let at: number | undefined = startxref; at !== undefined;) {
    if (seen.has(at)) refuse('prev-cycle')
    seen.add(at)
    const section = sections.get(at)
    if (section === undefined) refuse('prev')
    merge(section.entries)
    if (section.xrefStm !== undefined) {
      const hybrid = sections.get(section.xrefStm)
      if (hybrid === undefined) refuse('xref-stream-nowhere')
      merge(hybrid.entries)
    }
    at = section.prev
  }
  return { entries, trailer: newest.trailer }
}
