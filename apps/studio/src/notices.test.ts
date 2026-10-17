// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { EMBEDDED_NOTICES } from './embedded-notices.js'

/**
 * The notices embedded-notices.ts hands the notices plugin for the fonts the
 * Studio ships inside scripts: notices/roboto-ofl.txt, for the Roboto that
 * pdfmake's build/vfs_fonts.js carries, a file written by hand; and
 * Liberation Sans's own licence file, for the fonts report-render-pdf's
 * bill-fonts chunk carries. Each is held here to the fonts themselves, as
 * dependency-licences.mjs reads a font's licence from the font (0006).
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

/** report-render-pdf, whose fonts/ holds Liberation Sans and the licence file its release ships, and whose dist/ the Studio bundles. */
const renderPdf = join(app, '..', '..', 'packages', 'report-render-pdf')
const LIBERATION = ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf']
/** Words with every run of white space one space: the licence file wraps the OFL's lines its own way. */
const flowed = (text: string): string => text.replace(/\s+/g, ' ')

describe("the notice for report-render-pdf's embedded Liberation Sans", () => {
  const entry = EMBEDDED_NOTICES.find((each) => each.package === '@formancy/report-render-pdf')

  // A QR-bill's slip prints in Liberation Sans, which report-render-pdf's
  // browser entry carries as base64 in a chunk of its own, and the Studio
  // ships that chunk. The package is this repository's, so without a
  // notice the fonts would reach every browser under this repository's
  // terms. The OFL asks that each copy carry the copyright notice and the
  // licence (its condition 2): the notice is the licence file Liberation
  // Sans 2.1.5's release ships, which the package ships beside the fonts,
  // not a copy that could drift from it. Each font's own name table says
  // whose the fonts are, under what licence and which version, and the
  // notice must say the same.
  test("is the fonts' own licence file, with each font's copyright, licence and version", () => {
    if (entry === undefined) throw new Error('embedded-notices.ts names no notice for report-render-pdf')
    expect(entry.from).toBe(join(renderPdf, 'fonts', 'LICENSE-LiberationSans.txt'))
    const notice = flowed(readFileSync(entry.from, 'utf8'))
    for (const file of LIBERATION) {
      const own = names(readFileSync(join(renderPdf, 'fonts', file)))
      // A line of the name table's copyright, without its full stop, as the licence file writes it.
      for (const line of (own.get(0) ?? '(none)').split('\n').map((each) => each.trim().replace(/\.$/, ''))) expect({ file, line, held: notice.includes(line) }).toEqual({ file, line, held: true })
      expect({ file, licence: own.get(13) }).toEqual({ file, licence: 'Licensed under the SIL Open Font License, Version 1.1' })
      const version = /^Version (\d+\.\d+\.\d+)$/.exec(own.get(5) ?? '')?.[1]
      expect({ file, name: entry.name }).toEqual({ file, name: `Liberation Sans ${version ?? '(none)'}, under the SIL Open Font License 1.1` })
    }
    expect(notice).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007')
    expect(notice).toContain('5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license')
    expect(notice.trimEnd().endsWith('OTHER DEALINGS IN THE FONT SOFTWARE.')).toBe(true)
  })

  // The file the notice is about is named by a pattern, since the
  // package's build hashes the chunk's name: one that matched no chunk of
  // its dist, or two, would be about no file or the wrong one. A build of
  // the Studio stops on a notice whose file it does not bundle.
  test("names the one chunk report-render-pdf's build writes the fonts into", () => {
    const file = entry?.file
    if (!(file instanceof RegExp)) throw new Error('the notice for report-render-pdf names no pattern')
    expect(readdirSync(join(renderPdf, 'dist')).map((name) => `dist/${name}`).filter((name) => file.test(name))).toEqual([expect.stringMatching(/^dist\/bill-fonts-/)])
  })
})
