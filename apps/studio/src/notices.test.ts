// @vitest-environment node

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * notices/roboto-ofl.txt, which vite.config.ts hands the notices plugin for
 * the Roboto that pdfmake's build/vfs_fonts.js carries: a file written by
 * hand, held here to the fonts themselves, as dependency-licences.mjs reads a
 * font's licence from the font (0006).
 */

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const notice = readFileSync(join(app, 'notices', 'roboto-ofl.txt'), 'utf8')

// pdfmake is the renderer's dependency, not the Studio's: found from there.
const pdfmake = dirname(createRequire(join(app, '..', '..', 'packages', 'report-render-pdf', 'package.json')).resolve('pdfmake/package.json'))
const FONTS = ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf']

/** A TrueType font's Windows names (platform 3), by name id: what its name table says of itself. */
function names(bytes: Buffer): Map<number, string> {
  const found = new Map<number, string>()
  for (let table = 0; table < bytes.readUInt16BE(4); table += 1) {
    const record = 12 + 16 * table
    if (bytes.toString('latin1', record, record + 4) !== 'name') continue
    const at = bytes.readUInt32BE(record + 8)
    const storage = at + bytes.readUInt16BE(at + 4)
    for (let index = 0; index < bytes.readUInt16BE(at + 2); index += 1) {
      const name = at + 6 + 12 * index
      const id = bytes.readUInt16BE(name + 6)
      if (bytes.readUInt16BE(name) !== 3 || found.has(id)) continue
      const start = storage + bytes.readUInt16BE(name + 10)
      found.set(id, Buffer.from(bytes.subarray(start, start + bytes.readUInt16BE(name + 8))).swap16().toString('utf16le'))
    }
  }
  return found
}

/** The base64 vfs_fonts.js holds for `file`, decoded. */
function embedded(file: string): Buffer {
  const vfs = readFileSync(join(pdfmake, 'build', 'vfs_fonts.js'), 'utf8')
  const match = new RegExp(`"${file.replace('.', '\\.')}":\\s*"([A-Za-z0-9+/=]+)"`).exec(vfs)
  if (match === null) throw new Error(`vfs_fonts.js holds no ${file}`)
  return Buffer.from(match[1] ?? '', 'base64')
}

describe("the notice for pdfmake's embedded Roboto", () => {
  // The fonts the notice is about are the ones the Studio ships: each file
  // vfs_fonts.js carries is byte for byte the font pdfmake ships beside it,
  // whose name table the rest of this file reads. Were they different, the
  // name tables below would be the wrong fonts'.
  test('is about the very fonts vfs_fonts.js embeds', () => {
    for (const file of FONTS) expect(embedded(file).equals(readFileSync(join(pdfmake, 'fonts', 'Roboto', file)))).toBe(true)
  })

  // The OFL asks that each copy carry the copyright notice and the licence
  // (its condition 2). A notice whose copyright line or licence sentence
  // drifted from what the fonts say would reproduce somebody's notice, not
  // Roboto's; and a pdfmake that changed its fonts would leave a notice for
  // the old ones, which the version line catches.
  test("carries each font's own copyright, licence and version", () => {
    for (const file of FONTS) {
      const own = names(readFileSync(join(pdfmake, 'fonts', 'Roboto', file)))
      expect({ file, copyright: notice.includes(`\n${own.get(0) ?? '(none)'}\n`) }).toEqual({ file, copyright: true })
      expect({ file, licence: notice.includes(`\n${own.get(13) ?? '(none)'}\n`) }).toEqual({ file, licence: true })
      const version = /^Version (\d+\.\d+)/.exec(own.get(5) ?? '')?.[1]
      expect({ file, version: notice.startsWith(`Roboto ${version ?? '(none)'},`) }).toEqual({ file, version: true })
      expect(own.get(13)).toMatch(/^This Font Software is licensed under the SIL Open Font License, Version 1\.1\b/)
    }
  })

  // The licence itself, whole: its title and its last condition's sentence.
  test('reproduces the SIL Open Font License 1.1', () => {
    expect(notice).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007')
    expect(notice).toContain('5) The Font Software, modified or unmodified, in part or in whole,\nmust be distributed entirely under this license')
    expect(notice.trimEnd().endsWith('OTHER DEALINGS IN THE FONT SOFTWARE.')).toBe(true)
  })
})
