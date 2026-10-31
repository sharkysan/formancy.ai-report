// ZIP archives, read with Node's built-ins and nothing else (0027): KoSIT's
// XRechnung configuration, which the gate unpacks for KoSIT to read, and
// Mustang's JAR, out of which it reads the schematron Mustang runs.
//
// An archive is untrusted data even after its SHA-256 has matched the
// register: the register says these are the bytes the release served when
// somebody read them, not that what they hold is harmless. So this reads the
// format itself rather than handing it to an `unzip` binary, whose rules
// differ between Info-ZIP's, bsdtar and Windows' own, and it writes only
// what a configuration is: regular files and directories, each under the
// destination. A link, an absolute path, a `..`, a backslash, a name given
// twice (by case too, as a Windows disk reads it), an encrypted entry, a
// method other than storing or deflating, ZIP64 and an entry whose CRC is
// not its data's are each refused, and nothing is left half written: the
// archive is read whole before the first file is written.
//
// The central directory is what says where an entry is and how long: Maven
// writes a JAR's sizes in a data descriptor after each entry's data, and its
// local header says nothing of them.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, inflateRawSync } from 'node:zlib'

/**
 * The most an archive here may unpack to, in bytes, and so the most any one
 * entry may. KoSIT's configuration of 2026-08-31 unpacks to 5,696,701 bytes
 * in 113 entries, and the largest entry the gate reads from Mustang's JAR,
 * `xslt/ZF_250/FACTUR-X_EN16931.xslt`, is 656,731 (both read with Python's
 * zipfile on 17 October 2026); this is a little under six times the first.
 * An archive past it is refused before anything is inflated.
 */
export const MAX_UNPACKED = 32 * 1024 * 1024

const END = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const utf8 = new TextDecoder('utf-8', { fatal: true })

/** Where the end of central directory record starts: searched back from the end, past a comment of at most 65,535 bytes. */
function endRecord(bytes) {
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) if (bytes.readUInt32LE(at) === END) return at
  throw new Error('no end of central directory: not a ZIP archive')
}

/** An entry's name: UTF-8 where flag 11 says so, plain ASCII otherwise, since anything else is CP437 nobody here reads. */
function nameOf(raw, flags) {
  if ((flags & 0x0800) !== 0) return utf8.decode(raw)
  if (raw.some((byte) => byte >= 0x80)) throw new Error(`an entry's name is neither UTF-8 nor ASCII`)
  return raw.toString('latin1')
}

/**
 * Every entry of the archive's central directory, in its order:
 * `{ name, method, size, compressedSize, crc, offset, directory, mode }`.
 * An archive split across disks, or in ZIP64, an encrypted entry, an
 * unknown method or a size past the bound throws.
 */
export function zipEntries(bytes) {
  const end = endRecord(bytes)
  const [disk, startDisk, onDisk, total] = [4, 6, 8, 10].map((at) => bytes.readUInt16LE(end + at))
  const size = bytes.readUInt32LE(end + 12)
  const start = bytes.readUInt32LE(end + 16)
  if (disk !== 0 || startDisk !== 0 || onDisk !== total) throw new Error('an archive split across disks, which this reader refuses')
  if (total === 0xffff || size === 0xffffffff || start === 0xffffffff) throw new Error('a ZIP64 archive, which this reader refuses')
  const entries = []
  let at = start
  for (let index = 0; index < total; index += 1) {
    if (at + 46 > end || bytes.readUInt32LE(at) !== CENTRAL) throw new Error(`entry ${String(index)} of the central directory is not where the archive says`)
    const made = bytes.readUInt8(at + 5)
    const flags = bytes.readUInt16LE(at + 8)
    const method = bytes.readUInt16LE(at + 10)
    const crc = bytes.readUInt32LE(at + 16)
    const compressedSize = bytes.readUInt32LE(at + 20)
    const unpacked = bytes.readUInt32LE(at + 24)
    const [nameLength, extraLength, commentLength] = [28, 30, 32].map((offset) => bytes.readUInt16LE(at + offset))
    const external = bytes.readUInt32LE(at + 38)
    const offset = bytes.readUInt32LE(at + 42)
    const name = nameOf(bytes.subarray(at + 46, at + 46 + nameLength), flags)
    if (compressedSize === 0xffffffff || unpacked === 0xffffffff || offset === 0xffffffff) throw new Error(`${name}: a ZIP64 entry, which this reader refuses`)
    if ((flags & 0x0001) !== 0) throw new Error(`${name}: it is encrypted`)
    if (method !== 0 && method !== 8) throw new Error(`${name}: its method is ${String(method)}, and only stored (0) and deflated (8) are read`)
    if (unpacked > MAX_UNPACKED)
      throw new Error(`${name}: it says it is ${String(unpacked)} bytes, past the ${String(MAX_UNPACKED)} an archive here may unpack to`)
    // The file type is in the upper half of the external attributes where the archive was made on Unix (3).
    const mode = made === 3 ? (external >>> 16) & 0o170000 : 0
    entries.push({ name, method, size: unpacked, compressedSize, crc, offset, directory: name.endsWith('/'), mode })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** One entry's data, inflated and held to the size and CRC-32 its directory gives. */
export function readEntry(bytes, entry) {
  if (bytes.readUInt32LE(entry.offset) !== LOCAL) throw new Error(`${entry.name}: its local header is not where the directory says`)
  const start = entry.offset + 30 + bytes.readUInt16LE(entry.offset + 26) + bytes.readUInt16LE(entry.offset + 28)
  const stored = bytes.subarray(start, start + entry.compressedSize)
  if (stored.length !== entry.compressedSize) throw new Error(`${entry.name}: its data runs past the archive`)
  const data = entry.method === 8 ? inflateRawSync(stored, { maxOutputLength: MAX_UNPACKED }) : stored
  if (data.length !== entry.size)
    throw new Error(`${entry.name}: it inflates to ${String(data.length)} bytes, not the ${String(entry.size)} its directory says`)
  if (crc32(data) !== entry.crc) throw new Error(`${entry.name}: its data is not what its CRC-32 was taken of`)
  return data
}

/** The data of the one entry named `name`. */
export function entryNamed(bytes, name) {
  const found = zipEntries(bytes).filter((entry) => entry.name === name)
  if (found.length === 0) throw new Error(`the archive has no ${name}`)
  if (found.length > 1) throw new Error(`the archive has ${name} ${String(found.length)} times`)
  return readEntry(bytes, found[0])
}

/** Why `name` may not be written under a destination, or undefined when it may. */
function nameBreak(name) {
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return `the name ${name} is absolute`
  if (name.includes('\\')) return `the name ${name} holds a backslash`
  const segments = (name.endsWith('/') ? name.slice(0, -1) : name).split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) return `the name ${name} has a . or .. segment`
  if (segments.some((segment) => segment === '')) return `the name ${name} has an empty segment`
  return undefined
}

/**
 * Every directory and file of the archive, written under `directory`;
 * answers the files' names, in the archive's order. Every refusal is made
 * before the first file is written.
 */
export function unzip(bytes, directory) {
  const entries = zipEntries(bytes)
  const seen = new Set()
  let total = 0
  const files = []
  for (const entry of entries) {
    const wrong = nameBreak(entry.name)
    if (wrong !== undefined) throw new Error(wrong)
    if (entry.mode !== 0 && entry.mode !== (entry.directory ? 0o040000 : 0o100000)) throw new Error(`${entry.name}: it is neither a file nor a directory`)
    const key = entry.name.replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) throw new Error(`${entry.name}: the archive names it twice`)
    seen.add(key)
    total += entry.size
    if (total > MAX_UNPACKED) throw new Error(`the archive unpacks to more than the ${String(MAX_UNPACKED)} bytes an archive here may`)
    if (!entry.directory) files.push({ name: entry.name, data: readEntry(bytes, entry) })
  }
  for (const entry of entries) if (entry.directory) mkdirSync(join(directory, entry.name), { recursive: true })
  for (const file of files) {
    const path = join(directory, file.name)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, file.data)
  }
  return files.map((file) => file.name)
}
