// What a package's files say: the fonts and ICC profiles in its directory, and
// the digests of the licence files at its root. `dependency-licences.mjs` walks
// the tree and judges what this reads; nothing here decides what is allowed.

import { createHash } from 'node:crypto'
import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** sfnt versions: TrueType, CFF-flavoured OpenType, and Apple's TrueType tag. */
const OPEN_TYPE = new Set([0x00010000, 0x4f54544f, 0x74727565])

/**
 * The sentences a font's licence description (name ID 13) begins with, as the
 * OFL's FAQ, Liberation Sans 2 and Apache-licensed font projects write them,
 * and what each means. Anything else is a licence this does not recognise,
 * refused until reviewed: Liberation Sans 1, under GPL-2.0 with a font
 * exception, says "Licensed under the Liberation Fonts license".
 */
const FONT_LICENCES = [
  [/^This Font Software is licensed under the SIL Open Font License, Version 1\.1\b/, 'OFL-1.1'],
  [/^Licensed under the SIL Open Font License, Version 1\.1\b/, 'OFL-1.1'],
  [/^Licensed under the Apache License, Version 2\.0\b/, 'Apache-2.0'],
]

/**
 * What an OpenType font's name table says of its version and licence. A font
 * is untrusted input: anything that is not an OpenType font, or whose tables
 * run past its end, is `{ readable: false }`, never a crash and never a pass.
 */
export function fontLicence(bytes) {
  try {
    if (!OPEN_TYPE.has(bytes.readUInt32BE(0))) return { readable: false }
    const names = new Map()
    for (let table = 0; table < bytes.readUInt16BE(4); table += 1) {
      const record = 12 + 16 * table
      if (bytes.toString('latin1', record, record + 4) !== 'name') continue
      const at = bytes.readUInt32BE(record + 8)
      const storage = at + bytes.readUInt16BE(at + 4)
      for (let index = 0; index < bytes.readUInt16BE(at + 2); index += 1) {
        const name = at + 6 + 12 * index
        const platform = bytes.readUInt16BE(name)
        const id = bytes.readUInt16BE(name + 6)
        // Unicode and Windows names are UTF-16BE; a Mac Roman one is not read.
        if ((platform !== 0 && platform !== 3) || names.has(id)) continue
        const start = storage + bytes.readUInt16BE(name + 10)
        const end = start + bytes.readUInt16BE(name + 8)
        if (end > bytes.length) return { readable: false }
        names.set(id, Buffer.from(bytes.subarray(start, end)).swap16().toString('utf16le'))
      }
    }
    const description = names.get(13)
    return {
      readable: true,
      version: names.get(5),
      description,
      licence: FONT_LICENCES.find(([sentence]) => sentence.test(description ?? ''))?.[1],
    }
  } catch {
    return { readable: false }
  }
}

/** Files that are fonts, by extension: OpenType and TrueType, collections, web fonts and Type 1. */
const FONT_FILE = /\.(ttf|otf|ttc|otc|woff2?|eot|pfb|pfa)$/i

/** Files that are ICC profiles, by extension. */
const PROFILE_FILE = /\.ic[cm]$/i

/** Whether a file's first bytes are an ICC profile's, whatever it is called: the profile file signature `acsp` at byte 36 of its header (ICC.1, 7.2). */
function looksLikeProfile(head) {
  return head.length >= 40 && head.toString('latin1', 36, 40) === 'acsp'
}

/**
 * Whether a file's first bytes are a font's, whatever it is called: an sfnt
 * whose table directory fits the file, a collection, a web font, or Type 1
 * as text or in its binary segments. Text that merely begins `true` or
 * `OTTO` is not an sfnt: its table directory does not fit.
 */
function looksLikeFont(head, size) {
  const tag = head.toString('latin1', 0, 4)
  if (['ttcf', 'wOFF', 'wOF2'].includes(tag) || head.toString('latin1', 0, 14) === '%!PS-AdobeFont') return true
  if (head[0] === 0x80 && head[1] === 0x01 && head.toString('latin1', 6, 20) === '%!PS-AdobeFont') return true
  if (head.length < 12 || !OPEN_TYPE.has(head.readUInt32BE(0))) return false
  const tables = head.readUInt16BE(4)
  return tables > 0 && 12 + 16 * tables <= size
}

/** The first bytes of a file, enough to tell a font or an ICC profile by. */
function headOf(path) {
  const handle = openSync(path, 'r')
  try {
    const head = Buffer.alloc(40)
    return head.subarray(0, readSync(handle, head, 0, head.length, 0))
  } finally {
    closeSync(handle)
  }
}

/**
 * Files named as code, text or an image, which are not opened to look for a
 * font or an ICC profile: a package holds thousands of them, and opening
 * each one made the first walk of pdfmake's closure take 18.7 s instead of
 * 0.67 s (one Windows machine, 2026-10-15). A font or a profile under one of
 * these names is not found -- one inside a script, as pdfmake's browser
 * build carries both, or inside an image -- which 0006 says.
 */
const NOT_OPENED = /\.(c?js|mjs|d\.[cm]?ts|[cm]?ts|map|json|md|markdown|txt|html?|css|ya?ml|png|jpe?g|gif|svg|wasm|node)$/i

const byPath = (a, b) => (a.path < b.path ? -1 : 1)

/**
 * Every font file and every ICC profile in a package's directory, outside
 * its own node_modules, by path: each by its extension, or by its first
 * bytes. A font is read for its licence; a profile is known by its digest.
 */
export function filesIn(directory) {
  const fonts = []
  const profiles = []
  const walk = (at) => {
    for (const item of readdirSync(at, { withFileTypes: true })) {
      if (item.name === 'node_modules') continue
      const path = join(at, item.name)
      if (item.isDirectory()) {
        walk(path)
        continue
      }
      if (!item.isFile()) continue
      const named = FONT_FILE.test(item.name) || PROFILE_FILE.test(item.name)
      const head = named || NOT_OPENED.test(item.name) ? undefined : headOf(path)
      const file = relative(directory, path).replaceAll('\\', '/')
      if (FONT_FILE.test(item.name) || (head !== undefined && looksLikeFont(head, statSync(path).size)))
        fonts.push({ path: file, ...fontLicence(readFileSync(path)) })
      else if (PROFILE_FILE.test(item.name) || (head !== undefined && looksLikeProfile(head)))
        profiles.push({ path: file, digest: `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}` })
    }
  }
  walk(directory)
  return { fonts: fonts.sort(byPath), profiles: profiles.sort(byPath) }
}

/**
 * The licence texts of a package's directory by digest, `path` to its
 * `sha256:`: the files at its root named licence, copying or notice, and
 * every file of its `licenses` directory, as a review reads them. A
 * symlink reads as missing, so the review fails closed.
 */
export function licenceTextsIn(directory) {
  const found = {}
  const digestOf = (path) =>
    `sha256:${createHash('sha256')
      .update(readFileSync(join(directory, path)))
      .digest('hex')}`
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (item.isFile() && /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i.test(item.name)) found[item.name] = digestOf(item.name)
  }
  try {
    for (const item of readdirSync(join(directory, 'licenses'), { withFileTypes: true })) {
      if (item.isFile()) found[`licenses/${item.name}`] = digestOf(`licenses/${item.name}`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
  }
  return found
}
