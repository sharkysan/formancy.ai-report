// A writer of ZIP archives in the format's plain case, for the e-invoice
// gate's tests (0027, 0031): zip.test.mjs reads every refusal of the reader
// on an archive that is otherwise valid, and verapdf.test.mjs reads the
// veraPDF a JAR bundles out of one. Test support, run by no gate itself.

import { crc32, deflateRawSync } from 'node:zlib'

const u16 = (value) => {
  const bytes = Buffer.alloc(2)
  bytes.writeUInt16LE(value)
  return bytes
}
const u32 = (value) => {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32LE(value >>> 0)
  return bytes
}

/**
 * A ZIP of `entries`, each `{ name, data?, method?, mode?, flags?, descriptor? }`:
 * deflated unless `method` is 0, the name in UTF-8 (flag 11), a directory
 * where the name ends in `/`, and the sizes and CRC in a data descriptor
 * after the data, as Maven's JARs write them, where `descriptor` is set.
 */
export function zipOf(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data ?? '')
    const method = entry.method ?? (entry.name.endsWith('/') ? 0 : 8)
    const stored = method === 8 ? deflateRawSync(data) : data
    const flags = entry.flags ?? 0x0800 | (entry.descriptor ? 0x0008 : 0)
    const crc = crc32(data)
    const [localCrc, localCompressed, localSize] = entry.descriptor ? [0, 0, 0] : [crc, stored.length, data.length]
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0), u16(0), u32(localCrc), u32(localCompressed), u32(localSize), u16(name.length), u16(0), name, stored])
    const descriptor = entry.descriptor ? Buffer.concat([u32(0x08074b50), u32(crc), u32(stored.length), u32(data.length)]) : Buffer.alloc(0)
    const mode = entry.mode ?? (entry.name.endsWith('/') ? 0o040755 : 0o100644)
    centrals.push(Buffer.concat([u32(0x02014b50), u16(0x031e), u16(20), u16(flags), u16(method), u16(0), u16(0), u32(entry.crc ?? crc), u32(stored.length), u32(entry.size ?? data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(mode * 0x10000), u32(offset), name]))
    locals.push(local, descriptor)
    offset += local.length + descriptor.length
  }
  const central = Buffer.concat(centrals)
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)])
  return Buffer.concat([...locals, central, end])
}
