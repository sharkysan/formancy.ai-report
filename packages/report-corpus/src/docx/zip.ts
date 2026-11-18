import { crc32, inflateRawSync } from 'node:zlib'

/**
 * A zip archive read back for the corpus's tests by a reader that is not
 * its writer (0068): this walk of the central directory and Node's zlib,
 * never fflate, which report-render-docx writes with. It reads what a
 * package of ECMA-376's Part 2 is zipped as and nothing more, and refuses
 * the rest, each refusal naming the entry: an archive that does not end
 * with its directory, one of several disks or in Zip64, an entry that is
 * encrypted, written with a data descriptor or by a method other than
 * stored and deflate, one whose local header says otherwise than the
 * directory, whose data does not inflate to its size or sum to its
 * CRC-32, a name twice, a name that climbs out of the archive, and an
 * entry dated otherwise than `ZIP_EPOCH`, the one date the writer gives
 * every entry so that no clock reaches a file's bytes.
 */

/** One file of the archive, as its directory lists it. */
export interface ZipEntry {
  readonly name: string
  readonly bytes: Uint8Array
  /** Whether it was deflated, or stored as it is. */
  readonly method: 'stored' | 'deflated'
}

/** 1 January 1980, 00:00:00, the first date a zip can hold, in MS-DOS's fields: what every entry is dated. */
export const ZIP_EPOCH = { date: 0x0021, time: 0 } as const

const END = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
/** The end record's length without a comment, which the writer never writes. */
const END_LENGTH = 22

/** Every entry of `bytes`, in the directory's order; throws, naming the entry, where the archive is not one this reads. */
export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - END_LENGTH
  if (end < 0 || view.getUint32(end, true) !== END) throw new Error('the archive does not end with its directory: it is cut off, or carries a comment')
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error('the archive is one of several disks')
  const count = view.getUint16(end + 10, true)
  const [size, start] = [view.getUint32(end + 12, true), view.getUint32(end + 16, true)]
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff) throw new Error('the archive is in Zip64')
  if (view.getUint16(end + 8, true) !== count || start + size !== end) throw new Error('the directory is not where the archive says it is')
  const entries: ZipEntry[] = []
  const names = new Set<string>()
  let offset = start
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== CENTRAL) throw new Error(`entry ${index} of the directory is not an entry`)
    const [nameLength, extraLength, commentLength] = [view.getUint16(offset + 28, true), view.getUint16(offset + 30, true), view.getUint16(offset + 32, true)]
    const name = ascii(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (names.has(name)) throw new Error(`the archive holds ${name} twice`)
    names.add(name)
    checkName(name)
    entries.push(readEntry(bytes, view, offset, name))
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (offset !== end) throw new Error('the directory holds more than its entries')
  return entries
}

/** A name of printable ASCII: the writer names its own parts, and a part's name holds no other character. */
function ascii(bytes: Uint8Array): string {
  let name = ''
  for (const byte of bytes) {
    if (byte < 0x20 || byte > 0x7e) throw new Error('the archive holds a name outside printable ASCII')
    name += String.fromCharCode(byte)
  }
  return name
}

/** A name is a path inside the archive: no step up, no root, no backslash, and no folder of its own. */
function checkName(name: string): void {
  const steps = name.split('/')
  if (name === '' || name.includes('\\') || steps.some((step) => step === '' || step === '.' || step === '..'))
    throw new Error(`the archive holds the name '${name}', which is no path inside it`)
}

/** The entry the directory lists at `central`, its data read from where its local header puts it and held to what both say of it. */
function readEntry(bytes: Uint8Array, view: DataView, central: number, name: string): ZipEntry {
  const flags = view.getUint16(central + 8, true)
  if ((flags & 1) !== 0) throw new Error(`${name} is encrypted`)
  if ((flags & 8) !== 0) throw new Error(`${name} is written with a data descriptor`)
  const method = view.getUint16(central + 10, true)
  if (method !== 0 && method !== 8) throw new Error(`${name} is compressed by method ${method}, where this reads stored and deflated entries`)
  const [time, date] = [view.getUint16(central + 12, true), view.getUint16(central + 14, true)]
  if (time !== ZIP_EPOCH.time || date !== ZIP_EPOCH.date)
    throw new Error(`${name} is dated otherwise than 1 January 1980, 00:00:00, which every entry of a written file is`)
  const [sum, compressed, size, local] = [
    view.getUint32(central + 16, true),
    view.getUint32(central + 20, true),
    view.getUint32(central + 24, true),
    view.getUint32(central + 42, true),
  ]
  if (local + 30 > bytes.length || view.getUint32(local, true) !== LOCAL) throw new Error(`${name} has no local header where the directory says`)
  const same =
    view.getUint16(local + 6, true) === flags &&
    view.getUint16(local + 8, true) === method &&
    view.getUint16(local + 10, true) === time &&
    view.getUint16(local + 12, true) === date &&
    view.getUint32(local + 14, true) === sum &&
    view.getUint32(local + 18, true) === compressed &&
    view.getUint32(local + 22, true) === size
  const localName = view.getUint16(local + 26, true)
  const data = local + 30 + localName + view.getUint16(local + 28, true)
  if (!same || ascii(bytes.subarray(local + 30, local + 30 + localName)) !== name || data + compressed > bytes.length)
    throw new Error(`${name}'s local header says otherwise than the directory`)
  const raw = bytes.subarray(data, data + compressed)
  const read = method === 0 ? raw : inflated(raw, size, name)
  if (read.length !== size) throw new Error(`${name} holds ${read.length} bytes where the directory says ${size}`)
  if (crc32(read) !== sum) throw new Error(`${name} does not sum to its CRC-32`)
  return { name, bytes: read, method: method === 0 ? 'stored' : 'deflated' }
}

/** `raw` inflated by Node's zlib, to no more than the size the directory promises. */
function inflated(raw: Uint8Array, size: number, name: string): Uint8Array {
  try {
    // A plain array of bytes, not Node's Buffer: what a part's bytes are compared with.
    return new Uint8Array(inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) }))
  } catch {
    throw new Error(`${name} does not inflate to the ${size} bytes the directory says`)
  }
}
