import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { assetDigest, type FontAsset } from '@formancy/report-runtime'

/**
 * Faces for the renderer's host-font tests (0043): the Liberation Sans the
 * package ships and pdfmake's Roboto, read as a host's font would be, and
 * faces crafted from them by rewriting a table or a record -- the line a
 * face lays out, its embedding bits, the characters it maps, and the layout
 * tables fontkit runs -- so that each test names the one thing it changed.
 *
 * fontkit is loaded as PDFKit, which pdfmake loads, loads it: the copy that
 * lays a render's text out, whose behaviour the crafted tables are about.
 */

const fonts = (file: string): string => fileURLToPath(new URL(`../../fonts/${file}`, import.meta.url))
const own = createRequire(fileURLToPath(new URL('../../package.json', import.meta.url)))
const fromPdfmake = createRequire(own.resolve('pdfmake'))
const fromPdfkit = createRequire(fromPdfmake.resolve('pdfkit'))

export const LIBERATION_REGULAR = new Uint8Array(readFileSync(fonts('LiberationSans-Regular.ttf')))
export const LIBERATION_BOLD = new Uint8Array(readFileSync(fonts('LiberationSans-Bold.ttf')))
export const ROBOTO_REGULAR = new Uint8Array(
  readFileSync(path.join(path.dirname(own.resolve('pdfmake/package.json')), 'fonts', 'Roboto', 'Roboto-Regular.ttf')),
)

/** Where fontkit's CommonJS build is, as PDFKit requires it: what a worker requires to lay text out as a render does. */
export const FONTKIT = fromPdfkit.resolve('fontkit')

/** Where PDFKit is, as pdfmake requires it. */
const PDFKIT = fromPdfmake.resolve('pdfkit')

/** The version of that fontkit, from its own manifest, which its exports map does not export. */
export const FONTKIT_VERSION = (JSON.parse(readFileSync(path.join(path.dirname(FONTKIT), '..', 'package.json'), 'utf8')) as { version: string }).version

/** What the tests read of a fontkit font: its layout tables, its layout, and the PostScript name PDFKit keeps it by. */
export interface FontkitFont {
  readonly postscriptName: string | null
  GSUB?: unknown
  GPOS?: unknown
  GDEF?: unknown
  kern?: unknown
  morx?: unknown
  glyphForCodePoint(point: number): { readonly id: number }
  glyphsForString(text: string): readonly { readonly id: number }[]
  layout(text: string): { readonly glyphs: readonly { readonly id: number }[] }
  readonly _layoutEngine: { readonly engine: { readonly morxProcessor?: unknown } | null | undefined }
}
export const fontkit = fromPdfkit('fontkit') as { create(buffer: Buffer): FontkitFont }

/** A face as the runtime hands one over, its digest that of its bytes unless `digest` says otherwise. */
export const face = (id: string, bytes: Uint8Array, digest = assetDigest(bytes)): FontAsset => ({ id, digest, bytes })

const u16 = (value: number): number[] => [(value >>> 8) & 0xff, value & 0xff]
const u32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
const tagOf = (bytes: Uint8Array, record: number): string => String.fromCharCode(...bytes.subarray(record, record + 4))

/** The directory record of the table tagged `tag`: where its record is, and its offset and length. */
export function tableOf(bytes: Uint8Array, tag: string): { readonly record: number; readonly offset: number; readonly length: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let index = 0; index < view.getUint16(4); index += 1) {
    const record = 12 + 16 * index
    if (tagOf(bytes, record) === tag) return { record, offset: view.getUint32(record + 8), length: view.getUint32(record + 12) }
  }
  throw new Error(`the font has no ${tag} table`)
}

/** `bytes` with the record tagged `from` tagged `to` and pointed at `data`, appended to the file: a table replaced, or one of another kind put in its record. */
export function withTable(bytes: Uint8Array, from: string, to: string, data: Uint8Array): Uint8Array {
  const at = (bytes.length + 3) & ~3
  const out = new Uint8Array(at + data.length)
  out.set(bytes)
  out.set(data, at)
  const { record } = tableOf(out, from)
  const view = new DataView(out.buffer)
  out.set(
    [...to].map((character) => character.charCodeAt(0)),
    record,
  )
  view.setUint32(record + 8, at)
  view.setUint32(record + 12, data.length)
  return out
}

/** `bytes` with its OS/2 fsType, the u16 eight bytes into the table, set to `value`. */
export function withFsType(bytes: Uint8Array, value: number): Uint8Array {
  const out = Uint8Array.from(bytes)
  new DataView(out.buffer).setUint16(tableOf(out, 'OS/2').offset + 8, value)
  return out
}

/** `bytes` with its horizontal header's ascender and descender, the line PDFKit lays the face out by, set to these, in font units. */
export function withLine(bytes: Uint8Array, ascender: number, descender: number): Uint8Array {
  const out = Uint8Array.from(bytes)
  const view = new DataView(out.buffer)
  const { offset } = tableOf(out, 'hhea')
  view.setInt16(offset + 4, ascender)
  view.setInt16(offset + 6, descender)
  return out
}

/** Each record of name ID 6, the PostScript name, in the naming table of `bytes`: where its record is, and where its string is and how long. */
function postScriptRecords(bytes: Uint8Array): { readonly record: number; readonly at: number; readonly length: number }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const { offset } = tableOf(bytes, 'name')
  const storage = offset + view.getUint16(offset + 4)
  const found: { readonly record: number; readonly at: number; readonly length: number }[] = []
  for (let index = 0; index < view.getUint16(offset + 2); index += 1) {
    const record = offset + 6 + 12 * index
    if (view.getUint16(record + 6) === 6) found.push({ record, at: storage + view.getUint16(record + 10), length: view.getUint16(record + 8) })
  }
  return found
}

/** `name` as a record of `platform` holds it: Mac Roman on the Macintosh platform, UTF-16 on the others. */
const encodedName = (name: string, platform: number): number[] =>
  platform === 1 ? [...name].map((character) => character.charCodeAt(0)) : [...name].flatMap((character) => u16(character.charCodeAt(0)))

/** `out`'s record of name ID 6 `found` set to `platform`, `encoding` and `language`, holding `name` where its string was, which it must fit. */
function setPostScriptRecord(
  out: Uint8Array,
  found: { readonly record: number; readonly at: number; readonly length: number },
  platform: number,
  encoding: number,
  language: number,
  name: string,
): void {
  const encoded = encodedName(name, platform)
  if (encoded.length > found.length) throw new Error(`the name ${name} is longer than the record it replaces`)
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
  view.setUint16(found.record, platform)
  view.setUint16(found.record + 2, encoding)
  view.setUint16(found.record + 4, language)
  view.setUint16(found.record + 8, encoded.length)
  out.set(encoded, found.at)
}

/**
 * `bytes` with every record of name ID 6 saying `name`, each in its own
 * platform and language: a face of the font it was made from with a
 * PostScript name of its own, which PDFKit keeps apart from it (0043).
 * `name` is no longer than the name it replaces.
 */
export function named(bytes: Uint8Array, name: string): Uint8Array {
  const out = Uint8Array.from(bytes)
  const view = new DataView(out.buffer)
  for (const found of postScriptRecords(out))
    setPostScriptRecord(out, found, view.getUint16(found.record), view.getUint16(found.record + 2), view.getUint16(found.record + 4), name)
  return out
}

/**
 * `bytes`, a face of two records of name ID 6, with the first a Windows
 * English record of `best` and the second a Macintosh English one of
 * `last`, everything else as it was: report-spec's reader returns the
 * best, the Windows record, and fontkit the last English one, which PDFKit
 * keeps the face by.
 */
export function withPostScriptNames(bytes: Uint8Array, best: string, last: string): Uint8Array {
  const out = Uint8Array.from(bytes)
  const [first, second] = postScriptRecords(out)
  if (first === undefined || second === undefined) throw new Error('the font has fewer than two PostScript name records')
  setPostScriptRecord(out, first, 3, 1, 0x409, best)
  setPostScriptRecord(out, second, 1, 0, 0, last)
  return out
}

/** `bytes` with a line `ems` tall at its units to the em, its descender kept: the line PDFKit lays the face out by. */
export function withEms(bytes: Uint8Array, ems: number): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const units = view.getUint16(tableOf(bytes, 'head').offset + 18)
  const descender = view.getInt16(tableOf(bytes, 'hhea').offset + 6)
  return withLine(bytes, Math.round(ems * units) + descender, descender)
}

/** `bytes` with the record tagged `from` tagged `to`, so a reader finds a table of the new kind where the old one is. */
export function retag(bytes: Uint8Array, from: string, to: string): Uint8Array {
  const out = Uint8Array.from(bytes)
  out.set(
    [...to].map((character) => character.charCodeAt(0)),
    tableOf(out, from).record,
  )
  return out
}

/** `bytes` mapping the characters of `text` alone, each to the glyph it mapped to: its character map replaced by a format 12 subtable of one group a character. */
export function withCharacters(bytes: Uint8Array, text: string): Uint8Array {
  const font = fontkit.create(Buffer.from(bytes))
  const points = [...new Set([...text].map((character) => character.codePointAt(0)!))].sort((a, b) => a - b)
  const groups = points.flatMap((point) => [...u32(point), ...u32(point), ...u32(font.glyphForCodePoint(point).id)])
  const subtable = [...u16(12), ...u16(0), ...u32(16 + groups.length), ...u32(0), ...u32(points.length), ...groups]
  return withTable(bytes, 'cmap', 'cmap', Uint8Array.from([...u16(0), ...u16(1), ...u16(3), ...u16(10), ...u32(12), ...subtable]))
}

/**
 * An AAT `morx` table of one rearrangement subtable whose one entry stays
 * in state 0 and does not advance: fontkit's state machine
 * (`AATStateMachine.process`) runs it for as long as the thread lives. The
 * font 0040 measured holding PDFKit past twenty seconds on one 'A'.
 */
export const NEVER_ADVANCING_MORX = Uint8Array.from([
  // The header: version 2, one chain.
  ...u16(2),
  ...u16(0),
  ...u32(1),
  // The chain: its default flags and length, no features, one subtable.
  ...u32(1),
  ...u32(16 + 46),
  ...u32(0),
  ...u32(1),
  // The subtable: its length, coverage and type 0 (rearrangement), its feature flags.
  ...u32(46),
  0,
  0,
  0,
  0,
  ...u32(1),
  // Its state header: four classes, and where the class table, the state array and the entries are.
  ...u32(4),
  ...u32(16),
  ...u32(22),
  ...u32(30),
  // A class table of no glyphs, every glyph out of bounds.
  ...u16(8),
  ...u16(0),
  ...u16(0),
  // State 0: every class to entry 0.
  ...u16(0),
  ...u16(0),
  ...u16(0),
  ...u16(0),
  // Entry 0: to state 0, and DONT_ADVANCE.
  ...u16(0),
  ...u16(0x4000),
])

/**
 * A GSUB table whose one feature, `ccmp`, which fontkit applies to every
 * run, names a lookup of type 10, which the specification does not define:
 * fontkit throws "Unknown version 10" laying out any text, a plain error
 * out of pdfmake rather than a refusal.
 */
export const THROWING_GSUB = Uint8Array.from([
  // The header: version 1.0, and where the script, feature and lookup lists are.
  ...u16(1),
  ...u16(0),
  ...u16(10),
  ...u16(30),
  ...u16(44),
  // One script, DFLT, whose default language system uses feature 0.
  ...u16(1),
  0x44,
  0x46,
  0x4c,
  0x54,
  ...u16(8),
  ...u16(4),
  ...u16(0),
  ...u16(0),
  ...u16(0xffff),
  ...u16(1),
  ...u16(0),
  // One feature, ccmp, of lookup 0.
  ...u16(1),
  0x63,
  0x63,
  0x6d,
  0x70,
  ...u16(8),
  ...u16(0),
  ...u16(1),
  ...u16(0),
  // One lookup, of type 10, with one subtable.
  ...u16(1),
  ...u16(4),
  ...u16(10),
  ...u16(0),
  ...u16(1),
  ...u16(8),
  ...u16(1),
  ...u16(6),
  ...u16(0),
  ...u16(1),
  ...u16(0),
  ...u16(0),
])

/**
 * Liberation Sans and its bold under PostScript names of their own,
 * HostSans and HostSans-Bold: a host's faces, which PDFKit keeps apart from
 * the renderer's own Liberation Sans, and which the faces crafted from them
 * change one thing of. A face crafted from the renderer's own bytes under
 * its name is refused for that (`face-identity.ts`), whatever else it is.
 */
export const HOST_SANS = named(LIBERATION_REGULAR, 'HostSans')
export const HOST_SANS_BOLD = named(LIBERATION_BOLD, 'HostSans-Bold')

/** Liberation Sans, named HostLoops, with the never-advancing `morx` in place of its GPOS: a font report-spec's reader accepts, which fontkit lays out with its AAT engine. */
export const NEVER_ADVANCING = withTable(named(LIBERATION_REGULAR, 'HostLoops'), 'GPOS', 'morx', NEVER_ADVANCING_MORX)

/** Liberation Sans, named HostThrows, with the throwing GSUB in place of its own: a font the reader accepts, which fontkit throws laying out. */
export const THROWING = withTable(named(LIBERATION_REGULAR, 'HostThrows'), 'GSUB', 'GSUB', THROWING_GSUB)

/**
 * What becomes of `text` laid out in `bytes` by fontkit and embedded by
 * PDFKit, as a render lays out and embeds a run, in a worker of its own:
 * `laid out` once PDFKit has written the PDF, `threw` with what fontkit or
 * PDFKit threw, or `no answer` when neither came within `ms`, and the
 * worker was stopped. A render pass cannot be interrupted (0011), so a
 * face that might never finish is tried here, never on the test's thread.
 */
export function layOutInWorker(bytes: Uint8Array, text: string, ms: number): Promise<'laid out' | `threw: ${string}` | 'no answer'> {
  const source = `
    const { parentPort, workerData } = require('node:worker_threads')
    const fontkit = require(workerData.fontkit)
    const PDFDocument = require(workerData.pdfkit)
    try {
      fontkit.create(Buffer.from(workerData.bytes)).layout(workerData.text)
      const document = new PDFDocument()
      document.on('data', () => undefined)
      document.on('end', () => parentPort.postMessage('laid out'))
      document.font(Buffer.from(workerData.bytes)).fontSize(10).text(workerData.text)
      document.end()
    } catch (error) {
      parentPort.postMessage('threw: ' + error.message)
    }`
  return new Promise((resolve, reject) => {
    const worker = new Worker(source, { eval: true, workerData: { fontkit: FONTKIT, pdfkit: PDFKIT, bytes, text } })
    const timer = setTimeout(() => void worker.terminate().then(() => resolve('no answer')), ms)
    worker.once('message', (answer: 'laid out' | `threw: ${string}`) => {
      clearTimeout(timer)
      void worker.terminate().then(() => resolve(answer))
    })
    worker.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}
