import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_FIXTURES, QUOTATION, readZip, SERVICE_INSPECTION, ZIP_EPOCH } from '@formancy/report-corpus'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { ZIP_EPOCH as WRITTEN_EPOCH } from './package.js'
import { renderDocx } from './render.js'
import { resolved } from './testing/support.js'
import { fromWire, toWire } from './testing/wire.js'

/**
 * The same document gives the same file (0068): a host stores a file by
 * its digest, and a preview's file is compared with a server's. A zip
 * writer stamps each entry with the clock unless it is told otherwise,
 * and a clock read in local time differs from one machine to the next;
 * these hold the bytes to the document alone, in Node. The browser's
 * bytes are the Studio's gate's to hold: fflate serves a browser another
 * file than Node, and no test here loads it.
 */

/** A starter with a photograph and an SVG, one with tables and totals, and the corpus's host fonts: every kind of part a file holds. */
const DOCUMENTS: readonly (readonly [string, ResolvedDocument])[] = [
  ['the service inspection', resolved(SERVICE_INSPECTION)],
  ['the quotation', resolved(QUOTATION)],
  ['the host fonts', ALL_FIXTURES.find((fixture) => fixture.id === 'host-fonts')!.document],
]

const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const UNRUN = path.join(path.dirname(createRequire(import.meta.url).resolve('unrun/package.json')), 'dist', 'cli.mjs')
const CHILD = fileURLToPath(new URL('testing/write-child.ts', import.meta.url))

/** `document` written by a process of its own whose clock is in `zone`: the minutes its zone is from UTC, and the file. */
function inChild(document: ResolvedDocument, zone: string): { readonly offset: number; readonly file: Buffer } {
  const output = execFileSync(process.execPath, [UNRUN, CHILD], {
    input: toWire(document),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TZ: zone },
  })
  const [offset, file] = output.split('\n')
  return { offset: Number(offset), file: Buffer.from(file!, 'base64') }
}

describe.each(DOCUMENTS)('%s', (_name, document) => {
  // A file that differed from one write to the next could not be found again by its digest.
  test('is the same bytes written twice', () => {
    expect(digest(renderDocx(document))).toBe(digest(renderDocx(document)))
  })

  // The entry's date is made of local fields: read in another zone as an instant, it would be another day, and other bytes.
  test('is the same bytes in another process, fourteen hours ahead of UTC and eight behind', () => {
    // The child reads the very document the test writes, its pictures' and its faces' bytes and all.
    expect(fromWire(toWire(document))).toEqual(document)
    const here = digest(renderDocx(document))
    const [ahead, behind] = [inChild(document, 'Pacific/Kiritimati'), inChild(document, 'America/Los_Angeles')]
    // The zones took: a child that ran in the test's own zone twice would prove nothing.
    expect([ahead.offset, behind.offset]).toEqual([-840, 480])
    expect([digest(ahead.file), digest(behind.file)]).toEqual([here, here])
  }, 120_000)

  // Every entry, in the directory and in its own header: one dated by the clock is other bytes each second.
  test('dates every entry of its zip 1 January 1980, 00:00:00', () => {
    const bytes = renderDocx(document)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const dates: number[][] = []
    for (let at = 0; at + 4 <= bytes.length; at++) {
      const signature = view.getUint32(at, true)
      // A local header's time and date stand ten bytes in, the directory's twelve.
      if (signature === 0x04034b50) dates.push([view.getUint16(at + 10, true), view.getUint16(at + 12, true)])
      else if (signature === 0x02014b50) dates.push([view.getUint16(at + 12, true), view.getUint16(at + 14, true)])
    }
    const entries = readZip(bytes)
    expect(dates.length).toBeGreaterThanOrEqual(2 * entries.length)
    expect(dates.every(([time, date]) => time === ZIP_EPOCH.time && date === ZIP_EPOCH.date)).toBe(true)
  })

  // The parts in one order: content types first, as a package's are, then the document, its parts, and the pictures as they are met.
  test('writes its parts in one order, the content types first', () => {
    const names = readZip(renderDocx(document)).map((entry) => entry.name)
    expect(names.slice(0, 8)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'word/settings.xml',
      'word/fontTable.xml',
    ])
    expect(
      names
        .slice(8)
        .every((name) => /^word\/(header[12]\.xml|footer1\.xml|_rels\/(header[12]|footer1)\.xml\.rels|media\/image\d+\.(png|jpeg|svg))$/.test(name)),
    ).toBe(true)
  })
})

// The constant is a date of local fields, since fflate reads a date's local fields into an entry: as an instant it would be another day in another zone.
test('the date every entry is given is 1 January 1980 by its local fields', () => {
  const fields = [
    WRITTEN_EPOCH.getFullYear(),
    WRITTEN_EPOCH.getMonth(),
    WRITTEN_EPOCH.getDate(),
    WRITTEN_EPOCH.getHours(),
    WRITTEN_EPOCH.getMinutes(),
    WRITTEN_EPOCH.getSeconds(),
  ]
  expect(fields).toEqual([1980, 0, 1, 0, 0, 0])
})
