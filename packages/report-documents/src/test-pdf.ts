import { Deflate, deflate } from 'pako'

/**
 * Test support for the reader: a PDF writer, and the files most tests
 * start from, written in code byte by byte, so that no test carries a
 * binary file a reviewer cannot read. Nothing here uses the reader's own
 * code, so that a file framed by the reader would not agree with it
 * whatever it read. The hostile files are `test-hostile.ts`'s. Never
 * published: nothing in `index.ts` exports it.
 *
 * Most files start from objects 1 to 4 -- a catalog, a page tree of one
 * page, the page and its content, a line with no text so that no font is
 * needed -- and each generator changes the one thing it is about.
 */

export const MIB = 1024 * 1024

/** `text` as bytes, one a character, which must be below 256. */
export function latin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    joined.set(part, at)
    at += part.length
  }
  return joined
}

/** `unit` `count` times over, copied by the engine rather than written a byte at a time: the runs that fill a file to a bound. */
export function repeated(unit: string | Uint8Array, count: number): Uint8Array {
  const once = typeof unit === 'string' ? latin1(unit) : unit
  const bytes = new Uint8Array(once.length * count)
  if (bytes.length === 0) return bytes
  bytes.set(once)
  for (let filled = once.length; filled < bytes.length; filled *= 2) bytes.copyWithin(filled, 0, Math.min(filled, bytes.length - filled))
  return bytes
}

/** Where a cross-reference places an object: at an offset of the file, in an object stream, or nowhere (free). */
export type XrefEntry =
  | { readonly kind: 'at'; readonly offset: number; readonly gen?: number }
  | { readonly kind: 'in'; readonly stream: number; readonly index: number }
  | { readonly kind: 'free' }

/** `value` big-endian in `width` bytes of `rows` at `at`. */
export function field(rows: Uint8Array, at: number, width: number, value: number): void {
  for (let i = 0; i < width; i += 1) rows[at + i] = Math.floor(value / 256 ** (width - 1 - i)) & 0xff
}

/** The smallest PDF writer the files need: every object written where the file says it is, unless a generator means it not to be. */
export class PdfWriter {
  private readonly parts: Uint8Array[] = []
  length = 0
  /** The offset of the last definition written of each object. */
  readonly offsets = new Map<number, number>()

  constructor(header = '%PDF-1.7\n%\xe2\xe3\xcf\xd3\n') {
    this.raw(header)
  }

  raw(part: string | Uint8Array): number {
    const at = this.length
    const bytes = typeof part === 'string' ? latin1(part) : part
    this.parts.push(bytes)
    this.length += bytes.length
    return at
  }

  object(num: number, body: string | Uint8Array, gen = 0): number {
    const at = this.raw(`${num} ${gen} obj\n`)
    this.raw(body)
    this.raw('\nendobj\n')
    this.offsets.set(num, at)
    return at
  }

  /** A stream object; `length` is what its /Length says, its data's length unless a generator lies. */
  stream(num: number, dict: string, data: Uint8Array, length = String(data.length)): number {
    const at = this.raw(`${num} 0 obj\n<<${dict}/Length ${length}>>\nstream\n`)
    this.raw(data)
    this.raw('\nendstream\nendobj\n')
    this.offsets.set(num, at)
    return at
  }

  /** An object stream, object `num`, of `members` in order, Flate-compressed; the entries a cross-reference gives them. */
  objectStream(num: number, members: readonly (readonly [number, string])[]): Map<number, XrefEntry> {
    const bodies: string[] = []
    const pairs: string[] = []
    let offset = 0
    for (const [member, body] of members) {
      pairs.push(`${member} ${offset}`)
      bodies.push(body)
      offset += body.length + 1
    }
    const header = `${pairs.join(' ')}\n`
    this.stream(num, `/Type/ObjStm/N ${members.length}/First ${header.length}/Filter/FlateDecode`, deflate(latin1(header + bodies.join('\n'))))
    return new Map(members.map(([member], index) => [member, { kind: 'in', stream: num, index }]))
  }

  /** A classic cross-reference of `entries` -- an offset, or `free` -- after the free head of the list, and its trailer. Returns its offset. */
  xref(trailer: string, entries: ReadonlyMap<number, number | 'free'> = this.offsets, size?: number): number {
    const at = this.raw('xref\n')
    const numbers = [...entries.keys()].sort((a, b) => a - b)
    const runs: number[][] = []
    for (const num of numbers) {
      const run = runs.at(-1)
      if (run !== undefined && run.at(-1) === num - 1) run.push(num)
      else runs.push([num])
    }
    const lines: string[] = ['0 1\n0000000000 65535 f \n']
    for (const run of runs) {
      lines.push(`${run[0]} ${run.length}\n`)
      for (const num of run) {
        const entry = entries.get(num)
        lines.push(entry === 'free' ? '0000000000 00001 f \n' : `${String(entry).padStart(10, '0')} 00000 n \n`)
      }
    }
    this.raw(lines.join(''))
    this.raw(`trailer\n<</Size ${size ?? (numbers.at(-1) ?? 0) + 1}${trailer}>>\n`)
    return at
  }

  /**
   * A cross-reference stream, object `num`, of `entries` and, unless
   * `listed` is false, of itself, with /W [1 4 2], Flate-compressed; with
   * `predicted`, its rows under PNG's Up predictor (/Predictor 12), as
   * Acrobat writes them. Returns its offset.
   */
  xrefStream(num: number, trailer: string, entries: ReadonlyMap<number, XrefEntry>, predicted = false, listed = true): number {
    const own = new Map(entries)
    const at = this.length
    own.set(num, listed ? { kind: 'at', offset: at } : { kind: 'free' })
    const last = [...own.keys()].reduce((most, key) => Math.max(most, key), 0)
    const rows = new Uint8Array((last + 1) * 7)
    for (let n = 0; n <= last; n += 1) {
      const entry: XrefEntry = own.get(n) ?? { kind: 'free' }
      if (entry.kind === 'at') {
        field(rows, n * 7, 1, 1)
        field(rows, n * 7 + 1, 4, entry.offset)
        field(rows, n * 7 + 5, 2, entry.gen ?? 0)
      } else if (entry.kind === 'in') {
        field(rows, n * 7, 1, 2)
        field(rows, n * 7 + 1, 4, entry.stream)
        field(rows, n * 7 + 5, 2, entry.index)
      }
    }
    const data = predicted ? upPredicted(rows, 7) : rows
    const parms = predicted ? '/DecodeParms<</Predictor 12/Columns 7>>' : ''
    this.stream(num, `/Type/XRef/Size ${last + 1}/W[1 4 2]/Filter/FlateDecode${parms}${trailer}`, deflate(data))
    return at
  }

  end(xrefAt: number): Uint8Array {
    this.raw(`startxref\n${xrefAt}\n%%EOF\n`)
    return concat(this.parts)
  }
}

/** Rows of `columns` bytes under PNG's Up filter: each row its filter byte, 2, then its difference from the row above. */
function upPredicted(rows: Uint8Array, columns: number): Uint8Array {
  const count = rows.length / columns
  const out = new Uint8Array(count * (columns + 1))
  for (let r = 0; r < count; r += 1) {
    out[r * (columns + 1)] = 2
    for (let i = 0; i < columns; i += 1) {
      const above = r > 0 ? (rows[(r - 1) * columns + i] ?? 0) : 0
      out[r * (columns + 1) + 1 + i] = ((rows[r * columns + i] ?? 0) - above) & 0xff
    }
  }
  return out
}

/** A page's drawing: one line, no text, so that no font is needed. */
export const CONTENT = latin1('0 0 m 100 100 l S\n')

export interface PageOptions {
  readonly content?: Uint8Array
  /** Entries of the content stream's dictionary besides its /Length. */
  readonly contentDict?: string
  /** Entries of the page's dictionary besides its own. */
  readonly page?: string
}

/** Objects 1 to 4: a catalog, a page tree of one page, the page, and its content. */
export function basic(w: PdfWriter, options: PageOptions = {}): void {
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>')
  w.object(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R${options.page ?? ''}>>`)
  w.stream(4, options.contentDict ?? '', options.content ?? CONTENT)
}

/** A whole one-page file with a classic cross-reference: what most files here start from; `extra` writes more objects before the cross-reference. */
export function onePage(options: PageOptions = {}, extra?: (w: PdfWriter) => void): Uint8Array {
  const w = new PdfWriter()
  basic(w, options)
  extra?.(w)
  return w.end(w.xref('/Root 1 0 R'))
}

/** The same file under a cross-reference stream, object 5. */
export function onePageUnderXrefStream(predicted = false): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
  return w.end(w.xrefStream(5, '/Root 1 0 R', entries, predicted))
}

/** Objects 1 to 4 and object 5, `body`, which the page names, so that every reader parses it. */
export const withObject5 = (body: string | Uint8Array): Uint8Array => onePage({ page: '/Probe 5 0 R' }, (w) => w.object(5, body))

/** A file of exactly `n` bytes, `make`'s, whose argument is what the generator fills: found by measuring and correcting. */
export function exactly(n: number, make: (fill: number) => Uint8Array): Uint8Array {
  let fill = Math.max(0, n - make(0).length)
  let bytes = make(fill)
  for (let tries = 0; bytes.length !== n; tries += 1) {
    if (tries > 8) throw new Error(`no fill makes ${n} bytes`)
    fill += n - bytes.length
    bytes = make(fill)
  }
  return bytes
}

/** A one-page file of exactly `n` bytes, a comment making up the rest. */
export const ofBytes = (n: number): Uint8Array => exactly(n, (pad) => onePage({}, (w) => w.raw(comment(pad))))

/** A comment of `size` bytes, its end of line among them; nothing under two. */
export const comment = (size: number): Uint8Array => (size < 2 ? new Uint8Array(0) : concat([latin1('%'), repeated('x', size - 2), latin1('\n')]))

/**
 * `size` bytes of zeros, deflated a mebibyte at a time, so that the zeros
 * are never held. At level 1, the fastest pako writes: any level inflates
 * to the same zeros, and the reader stops at the bound whatever the ratio.
 */
export function deflatedZeros(size: number): Uint8Array {
  const deflater = new Deflate({ level: 1 })
  const chunk = new Uint8Array(MIB)
  for (let left = size; left > 0; left -= MIB) deflater.push(left >= MIB ? chunk : chunk.subarray(0, left), false)
  deflater.push(new Uint8Array(0), true)
  return deflater.result
}
