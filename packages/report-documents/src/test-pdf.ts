import { Deflate, deflate } from 'pako'

/**
 * Test support for the reader: PDFs written in code, byte by byte, so that
 * no test carries a binary file a reviewer cannot read, and every hostile
 * file of the parser spike (H1-H12) is written again here, deterministic,
 * at the size its own bound refuses it at rather than past the byte bound.
 * Nothing here uses the reader's own code, so that a file framed by the
 * reader would not agree with it whatever it read. Never published:
 * nothing in `index.ts` exports it.
 *
 * Most files start from objects 1 to 4 -- a catalog, a page tree of one
 * page, the page and its content, a line with no text so that no font is
 * needed -- and each generator changes the one thing it is about. The two
 * files PDFKit encrypted are pinned as bytes, which says why.
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
function field(rows: Uint8Array, at: number, width: number, value: number): void {
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

/** H1: a Standard /Encrypt dictionary (V 2, R 3, 128-bit) the trailer names, with an /ID; nothing is actually encrypted. */
export function encryptionDictionary(): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  w.object(5, `<</Filter/Standard/V 2/R 3/Length 128/P -4/O<${'00'.repeat(32)}>/U<${'00'.repeat(32)}>>>`)
  return w.end(w.xref(`/Root 1 0 R/Encrypt 5 0 R/ID[<${'01'.repeat(16)}><${'01'.repeat(16)}>]`))
}

/**
 * H1: as an encrypting writer of object streams writes a file -- its object
 * stream's data scrambled, its cross-reference stream, at the end, naming
 * the /Encrypt dictionary. Read in order, the object stream is met first
 * and does not inflate: the file is refused as encrypted only where the
 * last trailer is read before it.
 */
export function encryptedObjectStream(): Uint8Array {
  const w = new PdfWriter()
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  w.stream(4, '', CONTENT)
  w.stream(5, '/Type/ObjStm/N 2/First 8/Filter/FlateDecode', latin1('scrambled by an encryption'))
  w.object(6, '<</Filter/Standard/V 4/R 4/Length 128/P -4/O<00>/U<00>>>')
  const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
  entries.set(1, { kind: 'in', stream: 5, index: 0 })
  entries.set(2, { kind: 'in', stream: 5, index: 1 })
  return w.end(w.xrefStream(7, `/Root 1 0 R/Encrypt 6 0 R/ID[<${'01'.repeat(16)}><${'01'.repeat(16)}>]`, entries))
}

/** H2: three pages of 4 KiB of drawing each, what a file cut short is cut from. */
export function threePages(): Uint8Array {
  const w = new PdfWriter()
  const drawing = latin1(Array.from({ length: 256 }, (_, i) => `${i} ${i} m ${i + 9} ${i + 9} l S\n`).join(''))
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R 5 0 R 7 0 R]/Count 3>>')
  for (const page of [3, 5, 7]) {
    w.object(page, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents ${page + 1} 0 R>>`)
    w.stream(page + 1, '', drawing)
  }
  return w.end(w.xref('/Root 1 0 R'))
}

/*
 * H3: each bomb takes the deflated zeros it carries, `deflatedZeros`'s, so
 * that a test writes them once for all four. The object and cross-reference
 * streams hold nothing but zeros: the reader refuses them while they
 * inflate, before what they hold is read.
 */

/** H3: the page's content `deflated`. */
export const contentBomb = (deflated: Uint8Array): Uint8Array => onePage({ content: deflated, contentDict: '/Filter/FlateDecode' })

/** H3: the same deflated again, behind [/FlateDecode /FlateDecode]. */
export const doubleBomb = (deflated: Uint8Array): Uint8Array => onePage({ content: deflate(deflated), contentDict: '/Filter[/FlateDecode/FlateDecode]' })

/** H3: an object stream of `deflated`, which the page names object 5 in. */
export function objectStreamBomb(deflated: Uint8Array): Uint8Array {
  const w = new PdfWriter()
  basic(w, { page: '/Probe 5 0 R' })
  w.stream(6, '/Type/ObjStm/N 1/First 4/Filter/FlateDecode', deflated)
  const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
  entries.set(5, { kind: 'in', stream: 6, index: 0 })
  return w.end(w.xrefStream(7, '/Root 1 0 R', entries))
}

/** H3: the file's cross-reference stream, six rows claimed, `deflated`. */
export function xrefStreamBomb(deflated: Uint8Array): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const at = w.length
  w.stream(5, '/Type/XRef/Size 6/W[1 4 2]/Root 1 0 R/Filter/FlateDecode', deflated)
  return w.end(at)
}

/** H4: arrays nested `depth` deep. */
export const nestedArrays = (depth: number): string => '['.repeat(depth) + ']'.repeat(depth)

/** H4: dictionaries nested `depth` deep, each the value of the one around it. */
export const nestedDicts = (depth: number): string => '<</A '.repeat(depth) + '1' + ' >>'.repeat(depth)

/** H5: a classic cross-reference of a million entries, the first five real and the rest free, under /Size 2^31 - 1. */
export function hugeXrefTable(): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const at = w.raw('xref\n0 1000000\n0000000000 65535 f \n')
  for (let num = 1; num < 5; num += 1) w.raw(`${String(w.offsets.get(num)).padStart(10, '0')} 00000 n \n`)
  w.raw(repeated('0000000000 00001 f \n', 1_000_000 - 5))
  w.raw('trailer\n<</Size 2147483647/Root 1 0 R>>\n')
  return w.end(at)
}

/** H5: a classic cross-reference whose one section claims `count` entries and holds none. */
export function claimingXrefTable(count: number): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const at = w.raw(`xref\n0 ${count}\ntrailer\n<</Size 5/Root 1 0 R>>\n`)
  return w.end(at)
}

/** H5: the file's cross-reference stream, object 5, with these /Size, /W and /Index, and true rows for objects 0 to 5 only. */
export function claimingXrefStream(size: string, widths: readonly [number, number, number], index: string): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const at = w.length
  const width = widths[0] + widths[1] + widths[2]
  const rows = new Uint8Array(6 * width)
  for (const [num, offset] of [...w.offsets, [5, at] as const]) {
    field(rows, num * width, widths[0], 1)
    field(rows, num * width + widths[0], widths[1], offset)
  }
  w.stream(5, `/Type/XRef/Size ${size}/Index[${index}]/W[${widths.join(' ')}]/Root 1 0 R/Filter/FlateDecode`, deflate(rows))
  return w.end(at)
}

/** H6: `size` bytes of runs of `run` digits (0 to 9 over and over), each followed by a space, between objects 3 and 4. */
export function junkBetween(size: number, run: number): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>')
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  const unit = concat([repeated('0123456789', Math.ceil(run / 10)).subarray(0, run), latin1(' ')])
  w.raw(repeated(unit, Math.ceil(size / unit.length)).subarray(0, size))
  w.raw('\n')
  w.stream(4, '', CONTENT)
  return w.end(w.xref('/Root 1 0 R'))
}

/** H7: a page tree whose root's only kid is a /Pages node whose only kid is the root. */
export function kidsCycle(): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[5 0 R]/Count 1>>')
  w.object(5, '<</Type/Pages/Parent 2 0 R/Kids[2 0 R]/Count 1>>')
  w.object(3, '<</Type/Page/Parent 5 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  w.stream(4, '', CONTENT)
  return w.end(w.xref('/Root 1 0 R'))
}

/** H7: a page with no /Resources or /MediaBox of its own, under a root whose /Parent is a node whose /Parent is the root. */
export function parentCycle(): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R]/Count 1/Parent 5 0 R>>')
  w.object(5, '<</Type/Pages/Kids[]/Count 0/Parent 2 0 R>>')
  w.object(3, '<</Type/Page/Parent 2 0 R/Contents 4 0 R>>')
  w.stream(4, '', CONTENT)
  return w.end(w.xref('/Root 1 0 R'))
}

/** H7: /Count 1000000000 over one page. */
export function countLie(): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R]/Count 1000000000>>')
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  w.stream(4, '', CONTENT)
  return w.end(w.xref('/Root 1 0 R'))
}

/**
 * H8: as many one-number objects after objects 1 to 4 as fill a file of
 * exactly `size` bytes, a comment making up the rest. Its cross-reference
 * lists objects 1 to 4 alone: the reader refuses at the definitions bound,
 * a ninth of the way in, long before the cross-reference that would find
 * the rest unlisted -- and writing a stream that lists all of them would
 * cost a test seconds for bytes nothing reads.
 */
export function objectsFilling(size: number): Uint8Array {
  const lines: string[] = []
  let length = 0
  for (let num = 5; length < size - 512; num += 1) {
    const line = `${num} 0 obj 1 endobj\n`
    lines.push(line)
    length += line.length
  }
  const objects = latin1(lines.join(''))
  return exactly(size, (pad) => onePage({}, (w) => w.raw(concat([objects, comment(pad)]))))
}

/** H8: `count` pages in one /Kids, sharing one content stream and one /Resources. */
export function manyPages(count: number): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  const kids = Array.from({ length: count }, (_, i) => `${i + 5} 0 R`).join(' ')
  w.object(2, `<</Type/Pages/Kids[${kids}]/Count ${count}>>`)
  w.object(3, '<<>>')
  w.stream(4, '', CONTENT)
  const parts: string[] = []
  let at = w.length
  for (let i = 0; i < count; i += 1) {
    const line = `${i + 5} 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources 3 0 R/Contents 4 0 R>>\nendobj\n`
    w.offsets.set(i + 5, at)
    at += line.length
    parts.push(line)
  }
  w.raw(parts.join(''))
  return w.end(w.xref('/Root 1 0 R'))
}

/** H10: the content stream's /Length a million bytes past the end of the file. */
export function lengthPastEnd(): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>')
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  w.stream(4, '', CONTENT, '1000000')
  return w.end(w.xref('/Root 1 0 R'))
}

/** H10: the content stream's /Length `5 0 R`, a chain of `links` references ending in the real length; none with no links. */
export function lengthChain(links: number): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>')
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  w.stream(4, '', CONTENT, '5 0 R')
  for (let i = 0; i < links; i += 1) w.object(5 + i, `${6 + i} 0 R`)
  w.object(5 + links, String(CONTENT.length))
  return w.end(w.xref('/Root 1 0 R'))
}

/** H11: the page written twice, 612 x 792 and then 100 x 100, the last cross-reference naming the first. */
export function shadow(): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const first = w.offsets.get(3) ?? 0
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Resources<<>>/Contents 4 0 R>>')
  return w.end(w.xref('/Root 1 0 R', new Map([...w.offsets, [3, first]])))
}

/** The content H12's update writes. */
export const UPDATED_CONTENT = latin1('0 0 m 200 200 l S\n')

/** H12: the page's content replaced by an incremental update that a second cross-reference, with /Prev, names. */
export function incrementalUpdate(): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const firstXref = w.xref('/Root 1 0 R')
  w.raw(`startxref\n${firstXref}\n%%EOF\n`)
  w.stream(4, '', UPDATED_CONTENT)
  return w.end(w.xref(`/Root 1 0 R/Prev ${firstXref}`, new Map([[4, w.offsets.get(4) ?? 0]]), 5))
}

/**
 * H1: two files PDFKit 0.19.1 wrote with a user password -- one page of
 * text and a line, `new PDFDocument({ pdfVersion, userPassword: 'report',
 * info: { CreationDate: new Date(0) }, size: [200, 200], margin: 10 })` --
 * pdfVersion '1.4' encrypting with RC4 (128-bit), '1.7ext3' with AESV3
 * (256-bit), each made once on 3 November 2026 and pinned here as base64:
 * AESV3 draws its salts and its key at random, so it cannot be written
 * again byte for byte.
 */
const RC4 = [
  'JVBERi0xLjQKJf////8KOCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRpYUJveCBbMCAwIDIwMCAyMDBdCi9Db250ZW50cyA2',
  'IDAgUgovUmVzb3VyY2VzIDcgMCBSCi9Vc2VyVW5pdCAxCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0lt',
  'YWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjEgOSAwIFIKPj4KL0NvbG9yU3BhY2UgPDwKPj4KPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0xlbmd0aCA4OQov',
  'RmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KlQ23NDqbdUiqdghrN1quVSeu/aZY8dPCBoi4bSPog8xdPOu/W2FOq2ImejrUQHIv8HfNefQtb1Uw',
  'iqMbEC3Byz/GfBPijbyupfRQhRjo9tmbrB6KR7LmKN0KZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iagooi4ZOf5GmKQplbmRvYmoKMTIgMCBvYmoKKHCd',
  '2J0+/ykKZW5kb2JqCjEzIDAgb2JqCig81ReoOrndzbzgbDeOU19cbkYpCmVuZG9iagoxMCAwIG9iago8PAovUHJvZHVjZXIgMTEgMCBSCi9DcmVhdG9y',
  'IDEyIDAgUgovQ3JlYXRpb25EYXRlIDEzIDAgUgo+PgplbmRvYmoKOSAwIG9iago8PAovVHlwZSAvRm9udAovQmFzZUZvbnQgL0hlbHZldGljYQovU3Vi',
  'dHlwZSAvVHlwZTEKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKPj4KZW5kb2JqCjQgMCBvYmoKPDwKPj4KZW5kb2JqCjE0IDAgb2JqCjw8Ci9sZW5n',
  'dGggNjczCi9UeXBlIC9NZXRhZGF0YQovU3VidHlwZSAvWE1MCi9MZW5ndGggNjc1Cj4+CnN0cmVhbQpdEO/e0HB2Y2JRviRuVhvOYvYP8Wmd2A67thI+',
  'tbKvwWNjgN9uvB/j0dLi2xJ6YVK7bNrBZQm7pqMN/T21AMczK2EkVtkAD0qviv4St4/zpAa+E+eIkcT683CmLTM2C1inp9+0Rxoz+ep5TWJeGOqmWsP3',
  'E+11weLJ89LPHqnDF5mgw5edjik/v1vV1kHfGtrIC172EpNcVnoiEVY1AawjhPNqNVSgOkMAm5GyeTxM/e7DJpE+JKRE2tj3ePTTqxa7haIdI0sK0z8N',
  'hhCFCJuzWXPHguPMwuvzdb3mW/f1FA4ldPt/xuBFp577SA0UN7Rl3VmZu1L4Vvvqe+/kUWvE18RzjUiranAq0SYDI9OwhHTrcIERxUu++2q35w4l+NLL',
  'k+GBBXT2Sm6GFZrm6a1Ae3Kl9Pv3H+rYoXJJp3QLyFiJMSzKuyl9jq1pyg6GUZAqPdbYvoKFUirMJj4sJnibaCV3fX3oHosZmMiVYPsyeSowN5xBnnlU',
  'X7WDqrCB5h6ndXQaciaGWvJX2ofrJ975NSwR8h1v+DktxPadgJNWTP8idaLENuu0GPDngRZuWPyE8+i+1jtyN5Ay/QuJNy5IgK4qNptFnrBn8xzAIzGY',
  'pFGy4UgSsCAcs79AB4WJOFuf7qjsniA7buagkdckKpNYbURisw7TUAtlBK64ZfuYBhojybQgONMCwUkxPXTAWUqNY/GOMqcLHl/OwjE/NHHLa18GBUse',
  'lffmQNmnjTLKDZ3zboHxaDvsQDKEqmNEn+t/p/D2PeQesFfRi8zNiRh2eHqP8EsTF1Oa1q84EnFxnHvftNSDE53M6XlVyJTZfFcaJc19QMxvTCObQ1PH',
  'XqbfjuacoJXv1hp4Gm9x3gQbxLmHwgv+Etl+7BFKR0W0gRw3efoKZW5kc3RyZWFtCmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9DYXRhbG9nCi9QYWdl',
  'cyAxIDAgUgovTmFtZXMgMiAwIFIKL01ldGFkYXRhIDE0IDAgUgo+PgplbmRvYmoKMSAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMg',
  'WzggMCBSXQo+PgplbmRvYmoKMiAwIG9iago8PAovRGVzdHMgPDwKICAvTmFtZXMgWwpdCj4+Cj4+CmVuZG9iago1IDAgb2JqCjw8Ci9GaWx0ZXIgL1N0',
  'YW5kYXJkCi9WIDIKL0xlbmd0aCAxMjgKL1IgMwovTyA8MGIyMjcyMTNhYjgzNzQ5NTk1ZWMyYTUyNzM5NTc4MzJhZDM4ODJmMDc1MmI4YmY1ZTVjNzEy',
  'NDZjODI0ZjZlZD4KL1UgPDkwODYwMTU5Yzc2ZTFkODkwOGI0ZTJmMmY1ZjMyMmUxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA+Ci9QIC0z',
  'OTA0Cj4+CmVuZG9iagp4cmVmCjAgMTUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAxNTI3IDAwMDAwIG4gCjAwMDAwMDE1ODQgMDAwMDAgbiAKMDAw',
  'MDAwMTQ0OCAwMDAwMCBuIAowMDAwMDAwNjU4IDAwMDAwIG4gCjAwMDAwMDE2MzEgMDAwMDAgbiAKMDAwMDAwMDIzOCAwMDAwMCBuIAowMDAwMDAwMTMx',
  'IDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDU2MSAwMDAwMCBuIAowMDAwMDAwNDg1IDAwMDAwIG4gCjAwMDAwMDAzOTggMDAwMDAg',
  'biAKMDAwMDAwMDQyMyAwMDAwMCBuIAowMDAwMDAwNDQ4IDAwMDAwIG4gCjAwMDAwMDA2NzkgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxNQovUm9v',
  'dCAzIDAgUgovSW5mbyAxMCAwIFIKL0lEIFs8M2FjMTVmY2U1YzY0MWViNzJhODA1ZWI5MGYwOTk1NTY+IDwzYWMxNWZjZTVjNjQxZWI3MmE4MDVlYjkw',
  'ZjA5OTU1Nj5dCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgoxODQxCiUlRU9GCg==',
]
const AESV3 = [
  'JVBERi0xLjcKJf////8KOCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRpYUJveCBbMCAwIDIwMCAyMDBdCi9Db250ZW50cyA2',
  'IDAgUgovUmVzb3VyY2VzIDcgMCBSCi9Vc2VyVW5pdCAxCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0lt',
  'YWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjEgOSAwIFIKPj4KL0NvbG9yU3BhY2UgPDwKPj4KPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0xlbmd0aCAxMTIK',
  'L0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4Kc3RyZWFtCvvwfkPMBAhi0sjST3OqHSg3USY8WPC80A2GP83ayZ+lmrHsOSpofIC65b+LiwSS/NHzL2gZ7xYZ',
  'jMaz103xWXpUU8q7ibaIxg8z5lBe+EvyKOE9wBp5eqH5bcwGJ/NI3K/Rakl4smW8d/OxLiw+KcEKZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iagoorrqy',
  'qNg2SfeQy9Y5g6KIXCjViYZ9vQRBXCkAlsoyAZeG+ikKZW5kb2JqCjEyIDAgb2JqCihaJ7xqi4DyAED6BH5cXEp3DhBKfsY9Xh7fZ+lcKWHdux9cKCkK',
  'ZW5kb2JqCjEzIDAgb2JqCig7fQQ9f3iR+uNAQVxumoIup5hC8tlccn3Jj2s2ugeHTraFAB54ZbBjvGHo8R3eglxy9MYpCmVuZG9iagoxMCAwIG9iago8',
  'PAovUHJvZHVjZXIgMTEgMCBSCi9DcmVhdG9yIDEyIDAgUgovQ3JlYXRpb25EYXRlIDEzIDAgUgo+PgplbmRvYmoKOSAwIG9iago8PAovVHlwZSAvRm9u',
  'dAovQmFzZUZvbnQgL0hlbHZldGljYQovU3VidHlwZSAvVHlwZTEKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKPj4KZW5kb2JqCjQgMCBvYmoKPDwK',
  'Pj4KZW5kb2JqCjE0IDAgb2JqCjw8Ci9sZW5ndGggNjczCi9UeXBlIC9NZXRhZGF0YQovU3VidHlwZSAvWE1MCi9MZW5ndGggNzA0Cj4+CnN0cmVhbQrl',
  'w9kCUD6lct9n5dJIRimRdc4JsUZAczJK5B2cRBRzw0qdS4Ll46XOtR45c9zHdXUcwuu5aG937jmYyCF6E7P+Uw59Ys7xmWoO7HXOyaXAPNBoFMu8kTB7',
  'Nm4r4vvCS1ujgpNECBoh26+p6jUODnz4W+u2NNlPvFTRwisWS6w9aPbLvpamf4OoD03ClTIS4dvJlK4Jvg9gtZLftglisdzvPRvktkWU5qE4KNy7q/vZ',
  'jGSxwdqTK1nb9VA0Am93/Ck22EVQx2XWVEOYE05LnTDLz1AL+TrLOjTRbvEMBwSeNeIlvb7K+dYE3remZrTP7N+zjN4LeHCDMQna5Wz577KxBQ7fimTz',
  'NJxtqslOBzlBDFpYFA7tazuYPztwf/zv7HBbYwr63Xo3kdVrDHHvqwWzGOoX/6LlBuojNhnzzzHddMp6b3OIHKn92yuUlj3IpD9ewvKJXW9c3+qanN83',
  'dEHS+6HJD/rKuIzxKPYWB7evLcqdZ+YqxT5Hr5YRzxyv4JsdwTrnSWrGp/fe1PMVWxoMMZ+JakGgEAI6P024tnhbQiKYr5m8ig9omnLpPBlcBwLkXggX',
  'Amu3+De+k4+ljMhct1/um7Awws8R03R0rR7I0EvG9SzO8osfcXWqVBs88xejXGpus/sz/ySZXRsZUL2PruNr1VtTdPCjFcaOV1Mm3M2usrRwVRxwDicL',
  'HnDx4yDnHBSUSHqjTrW3FcLaLdOqZX4bP7DFX/aq3HAJZ/rFAVJJqV9An3dEG0u/ne9co+lmrP6XaNb0rdGHasLrerD+iUCrfCY2lvuo3HLFVRabr/SJ',
  '07zmvKCZW25Xoz49kE9ftlwfJ7h3I3kN2COAOuGAP4/hOkX39Y8GDBdr7d9t9dRZsnuXCkz6k7LQkzElomaFfVTg+42pSmwOLpuJYkfd6kMzhkb9V1Sn',
  'j+DxcjxU+AplbmRzdHJlYW0KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCi9OYW1lcyAyIDAgUgovTWV0YWRhdGEg',
  'MTQgMCBSCj4+CmVuZG9iagoxIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbOCAwIFJdCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9E',
  'ZXN0cyA8PAogIC9OYW1lcyBbCl0KPj4KPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0ZpbHRlciAvU3RhbmRhcmQKL1YgNQovTGVuZ3RoIDI1NgovQ0YgPDwK',
  'L1N0ZENGIDw8Ci9BdXRoRXZlbnQgL0RvY09wZW4KL0NGTSAvQUVTVjMKL0xlbmd0aCAzMgo+Pgo+PgovU3RtRiAvU3RkQ0YKL1N0ckYgL1N0ZENGCi9S',
  'IDUKL08gPDQzZWY3MGJkYmI2OGY3YzgzMWE0N2VmYmU3OGQ0MWI4NWVlNWYwNWQxZmQ2NDdmYWQ0NzcxYzVjOWUxYTEyYjY0MTU0Yjk3Y2ZhYjc4ODEz',
  'MmUwZDI4NzkyMDJhYzA0YT4KL09FIDw3Zjk3NTdiY2JjNTY1MWFhMmQ3MWJkNTBlZDQ4ZjczMzhmNWFkNDg0Nzc4YmQ0MGRiNDZjNDI3YzZhODQzNTkz',
  'PgovVSA8ZDM4MDVlMjJkMmQ3ZTgzMTcxMTcyNTc3YjdiMTMwYTkzZjk5ZTI5MzhjMzEwN2MwZGIwNjhjMTQwYmE0MjA2Mzc2NjQ5ZmM4OTQyYzhkMjRl',
  'MDA3ZmRkZTc3ZTRlYjFlPgovVUUgPDM2YTVkZjcyZDRhZWYwNDU0YTcyMzE2MGJlYTVhZTc0Nzk1MmFjOTUwZTQ0YjU0MWMyZWFlOWY0ZjRhZWY0NDA+',
  'Ci9QIC0zOTA0Ci9QZXJtcyA8NjVlMzkzYjRmZWJiNGQzY2VhN2MzMmE1ZDFlZWI1MGI+Cj4+CmVuZG9iagp4cmVmCjAgMTUKMDAwMDAwMDAwMCA2NTUz',
  'NSBmIAowMDAwMDAxNjcwIDAwMDAwIG4gCjAwMDAwMDE3MjcgMDAwMDAgbiAKMDAwMDAwMTU5MSAwMDAwMCBuIAowMDAwMDAwNzcyIDAwMDAwIG4gCjAw',
  'MDAwMDE3NzQgMDAwMDAgbiAKMDAwMDAwMDIzOCAwMDAwMCBuIAowMDAwMDAwMTMxIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDY3',
  'NSAwMDAwMCBuIAowMDAwMDAwNTk5IDAwMDAwIG4gCjAwMDAwMDA0MjIgMDAwMDAgbiAKMDAwMDAwMDQ3NSAwMDAwMCBuIAowMDAwMDAwNTI5IDAwMDAw',
  'IG4gCjAwMDAwMDA3OTMgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxNQovUm9vdCAzIDAgUgovSW5mbyAxMCAwIFIKL0lEIFs8M2FjMTVmY2U1YzY0',
  'MWViNzJhODA1ZWI5MGYwOTk1NTY+IDwzYWMxNWZjZTVjNjQxZWI3MmE4MDVlYjkwZjA5OTU1Nj5dCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgoy',
  'MzI0CiUlRU9GCg==',
]

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function fromBase64(text: string): Uint8Array {
  const digits = text.replace(/=+$/, '')
  const bytes = new Uint8Array(Math.floor((digits.length * 3) / 4))
  let value = 0
  let bits = 0
  let at = 0
  for (const digit of digits) {
    value = (value << 6) | BASE64.indexOf(digit)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[at] = (value >> bits) & 0xff
      at += 1
      value &= (1 << bits) - 1
    }
  }
  return bytes
}

export const encryptedRc4 = (): Uint8Array => fromBase64(RC4.join(''))
export const encryptedAesv3 = (): Uint8Array => fromBase64(AESV3.join(''))
