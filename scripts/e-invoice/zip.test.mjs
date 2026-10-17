import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'
import { afterAll, describe, expect, test } from 'vitest'
import { entryNamed, MAX_UNPACKED, unzip, zipEntries } from './zip.mjs'

/**
 * The ZIP reader the gate unpacks KoSIT's configuration with, and reads
 * Mustang's schematron out of its JAR with (0027). The archives here are
 * written by `zipOf` below, a writer of the format's plain case, so that
 * every refusal is seen on an archive that is otherwise valid.
 */
const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})
const scratch = () => {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), 'e-invoice-zip-')))
  made.push(directory)
  return directory
}

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
function zipOf(entries) {
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

describe('reading an archive', () => {
  // Maven writes each entry's sizes after its data, so the local header
  // says nothing: the central directory is what says where an entry ends.
  test('lists the central directory and reads stored, deflated and descriptor-sized entries', () => {
    const archive = zipOf([{ name: 'xslt/', method: 0 }, { name: 'xslt/a.xslt', data: '<a/>', descriptor: true }, { name: 'b.txt', data: 'plain', method: 0 }])
    expect(zipEntries(archive).map((entry) => [entry.name, entry.size, entry.directory])).toEqual([
      ['xslt/', 0, true],
      ['xslt/a.xslt', 4, false],
      ['b.txt', 5, false],
    ])
    expect(entryNamed(archive, 'xslt/a.xslt').toString()).toBe('<a/>')
    expect(entryNamed(archive, 'b.txt').toString()).toBe('plain')
    expect(() => entryNamed(archive, 'c.txt')).toThrow('the archive has no c.txt')
  })

  // An entry whose bytes are not the ones its CRC was taken of, or that
  // inflate to another length, is a damaged or doctored archive; the
  // archive's hash was right, so this is the format's own second check.
  test('refuses an entry whose CRC or size is not its data’s', () => {
    expect(() => entryNamed(zipOf([{ name: 'a.txt', data: 'abc', crc: 1 }]), 'a.txt')).toThrow('a.txt: its data is not what its CRC-32 was taken of')
    expect(() => entryNamed(zipOf([{ name: 'a.txt', data: 'abc', size: 4 }]), 'a.txt')).toThrow('a.txt: it inflates to 3 bytes, not the 4 its directory says')
  })

  // Encryption, a method other than storing and deflating, and a size past
  // the bound are refused before an entry's data is read: none is in the
  // archives the register pins, so one is not those archives.
  test('refuses an encrypted entry, another method, a size past its bound and no archive at all', () => {
    expect(() => zipEntries(zipOf([{ name: 'a.txt', data: 'abc', flags: 0x0801 }]))).toThrow('a.txt: it is encrypted')
    expect(() => zipEntries(zipOf([{ name: 'a.txt', data: 'abc', method: 12 }]))).toThrow('a.txt: its method is 12, and only stored (0) and deflated (8) are read')
    expect(() => zipEntries(zipOf([{ name: 'a.txt', data: 'abc', size: MAX_UNPACKED + 1 }]))).toThrow(`a.txt: it says it is ${String(MAX_UNPACKED + 1)} bytes, past the ${String(MAX_UNPACKED)} an archive here may unpack to`)
    expect(() => zipEntries(Buffer.from('not a zip at all'))).toThrow('no end of central directory: not a ZIP archive')
  })
})

describe('unzipping', () => {
  // The configuration as KoSIT reads it: directories and files under the
  // destination, nothing else.
  test('writes every directory and file under the destination', () => {
    const directory = scratch()
    const written = unzip(zipOf([{ name: 'resources/', method: 0 }, { name: 'resources/a.xsl', data: '<xsl/>' }, { name: 'scenarios.xml', data: '<s/>' }]), directory)
    expect(written).toEqual(['resources/a.xsl', 'scenarios.xml'])
    expect(readFileSync(join(directory, 'resources', 'a.xsl'), 'utf8')).toBe('<xsl/>')
    expect(readdirSync(directory).sort()).toEqual(['resources', 'scenarios.xml'])
  })

  // A path that leaves the destination writes wherever it names; a link
  // points wherever it was made to. Two names that are one file on a
  // case-insensitive disk would leave whichever came last. Each is
  // refused, and the archive is read whole before anything is written, so
  // nothing is left half unpacked.
  test.each([
    ['/etc/a.xsl', 'the name /etc/a.xsl is absolute'],
    ['C:/a.xsl', 'the name C:/a.xsl is absolute'],
    ['resources/../../a.xsl', 'the name resources/../../a.xsl has a . or .. segment'],
    ['resources\\a.xsl', 'the name resources\\a.xsl holds a backslash'],
    ['resources//a.xsl', 'the name resources//a.xsl has an empty segment'],
  ])('refuses %s, and writes nothing', (name, message) => {
    const directory = scratch()
    expect(() => unzip(zipOf([{ name: 'first.txt', data: 'x' }, { name, data: 'x' }]), directory)).toThrow(message)
    expect(readdirSync(directory)).toEqual([])
  })

  test('refuses a link and a name twice, and writes nothing', () => {
    const directory = scratch()
    expect(() => unzip(zipOf([{ name: 'a.txt', data: 'x' }, { name: 'link', data: '/etc/passwd', mode: 0o120777 }]), directory)).toThrow('link: it is neither a file nor a directory')
    expect(() => unzip(zipOf([{ name: 'a.txt', data: 'x' }, { name: 'A.TXT', data: 'y' }]), directory)).toThrow('A.TXT: the archive names it twice')
    expect(readdirSync(directory)).toEqual([])
    expect(existsSync(join(directory, 'a.txt'))).toBe(false)
  })
})
