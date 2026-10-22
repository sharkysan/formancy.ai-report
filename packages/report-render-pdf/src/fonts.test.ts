import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetDigest, characterMap as readCharacterMap, readFont } from '@formancy/report-runtime'
import type { Font } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { OWN_FACES } from './face-identity.js'
import { characterMap } from './glyphs.js'
import { LIBERATION_LINE, LINE_FACTOR } from './style.js'
import { TIMEOUT } from './testing/documents.js'

/**
 * The faces the renderer embeds, read by report-spec's font reader through
 * the runtime (0040), from the files pdfmake and this package ship: Roboto
 * 3.014 from pdfmake's own copy, Liberation Sans 2.1.5 from `fonts/`. And
 * the reader held to the one that matters at print: fontkit, which PDFKit
 * lays text out and subsets with, loaded from the PDFKit pdfmake loads.
 * A third reader of binary fonts is the risk 0040 names; this is where it
 * would be found disagreeing.
 */

const own = createRequire(path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'package.json'))
const fromPdfmake = createRequire(own.resolve('pdfmake'))
const fromPdfkit = createRequire(fromPdfmake.resolve('pdfkit'))

/** fontkit's font, as far as this reads it. */
interface FontkitFont {
  readonly characterSet: readonly number[]
  readonly postscriptName: string | null
  glyphForCodePoint(point: number): { readonly id: number; readonly path: { readonly commands: readonly unknown[] } }
}
const fontkit = fromPdfkit('fontkit') as { create(buffer: Buffer): FontkitFont }

/** PDFKit's document, as far as this drives it. */
interface PdfKitDocument {
  on(event: string, listener: (value: Buffer) => void): void
  font(source: Buffer): PdfKitDocument
  fontSize(size: number): PdfKitDocument
  text(text: string): PdfKitDocument
  end(): void
}
const PDFDocument = fromPdfmake('pdfkit') as new () => PdfKitDocument

const roboto = path.join(path.dirname(own.resolve('pdfmake/package.json')), 'fonts', 'Roboto')
const liberation = fileURLToPath(new URL('../fonts', import.meta.url))
const bytesOf = (directory: string, file: string): Uint8Array => new Uint8Array(readFileSync(path.join(directory, file)))

/** What the reader is held to of each face, measured from the files with the probe the 0.3.0 plan used and read again on 21 October 2026. */
const FACES = [
  { directory: roboto, file: 'Roboto-Regular.ttf', family: 'Roboto', subfamily: 'Regular', postScriptName: 'Roboto-Regular', weight: 400, italic: false, bold: false, regular: true },
  { directory: roboto, file: 'Roboto-Medium.ttf', family: 'Roboto', subfamily: 'Medium', postScriptName: 'Roboto-Medium', weight: 500, italic: false, bold: false, regular: true },
  { directory: roboto, file: 'Roboto-Italic.ttf', family: 'Roboto', subfamily: 'Italic', postScriptName: 'Roboto-Italic', weight: 400, italic: true, bold: false, regular: false },
  { directory: roboto, file: 'Roboto-MediumItalic.ttf', family: 'Roboto', subfamily: 'Medium Italic', postScriptName: 'Roboto-MediumItalic', weight: 500, italic: true, bold: false, regular: false },
  { directory: liberation, file: 'LiberationSans-Regular.ttf', family: 'Liberation Sans', subfamily: 'Regular', postScriptName: 'LiberationSans', weight: 400, italic: false, bold: false, regular: true },
  { directory: liberation, file: 'LiberationSans-Bold.ttf', family: 'Liberation Sans', subfamily: 'Bold', postScriptName: 'LiberationSans-Bold', weight: 700, italic: false, bold: true, regular: false },
] as const

const METRICS = {
  Roboto: { unitsPerEm: 2048, ascender: 1900, descender: -500, lineGap: 0, glyphs: 1326, characters: 927, version: 'Version 3.014; 2025' },
  'Liberation Sans': { unitsPerEm: 2048, ascender: 1854, descender: -434, lineGap: 67, glyphs: 2620, characters: 2327, version: 'Version 2.1.5' },
} as const

function read(bytes: Uint8Array): Font {
  const outcome = readFont(bytes)
  if (!outcome.ok) throw new Error(`refused: ${outcome.message}`)
  return outcome
}

const be16 = (value: number): number[] => [(value >>> 8) & 0xff, value & 0xff]
const be32 = (value: number): number[] => [...be16(value >>> 16), ...be16(value)]

/** A format 4 subtable that maps `point` to glyph 1, and its final segment. */
const format4Of = (point: number): number[] => [
  ...be16(4), ...be16(32), ...be16(0), ...be16(4), ...be16(4), ...be16(1), ...be16(0),
  ...be16(point), ...be16(0xffff), ...be16(0), ...be16(point), ...be16(0xffff), ...be16(1 - point), ...be16(1), ...be16(0), ...be16(0),
]

/** A format 12 subtable that maps `point` to glyph 1. */
const format12Of = (point: number): number[] => [...be16(12), ...be16(0), ...be32(28), ...be32(0), ...be32(1), ...be32(point), ...be32(point), ...be32(1)]

/** An sfnt of a character map alone, of these subtables in the order given, which is all `characterMap` reads. */
function characterMapOnly(subtables: readonly (readonly [number, number, readonly number[]])[]): Uint8Array {
  let offset = 4 + 8 * subtables.length
  const records = subtables.flatMap(([platform, encoding, table]) => {
    const record = [...be16(platform), ...be16(encoding), ...be32(offset)]
    offset += table.length
    return record
  })
  const table = [...be16(0), ...be16(subtables.length), ...records, ...subtables.flatMap(([, , subtable]) => subtable)]
  return Uint8Array.from([...be32(0x00010000), ...be16(1), ...be16(16), ...be16(0), ...be16(0), ...[...'cmap'].map((character) => character.charCodeAt(0)), ...be32(0), ...be32(28), ...be32(table.length), ...table])
}

describe("the renderer's faces, read by report-spec's reader", () => {
  // Each face read to the values measured from its file: a reader that
  // took a name from the wrong record, a metric from the wrong offset or
  // an fsType from the wrong bit would describe another font than the one
  // the PDF embeds. Roboto Medium, which pdfmake prints as bold, says
  // regular: a person, not the font's flags, says which face a file is.
  test.each(FACES)('$file', (face) => {
    const { glyphs, characters, version, ...metrics } = METRICS[face.family]
    const font = read(bytesOf(face.directory, face.file))
    expect(font).toMatchObject({
      names: { family: face.family, subfamily: face.subfamily, postScriptName: face.postScriptName, version },
      embedding: 'installable',
      fsType: 0,
      metrics,
      style: { weight: face.weight, italic: face.italic, bold: face.bold, regular: face.regular },
      glyphs,
    })
    expect(font.characters.size).toBe(characters)
    // The renderer's own map of the face, glyphs.ts's, is the reader's.
    expect([...characterMap(bytesOf(face.directory, face.file))]).toEqual([...font.characters])
  })

  // The renderer reads its faces through the reader, not beside it. A face
  // whose maps disagree is read as fontkit reads it: its full-repertoire
  // map before both BMP ones, and the Windows BMP map before the Unicode
  // one listed first. The parser glyphs.ts had took the first BMP map in
  // table order and threw on a face with none in format 4, so a renderer
  // that kept a reader of its own would print by another map than PDFKit's.
  test("glyphs.ts reads a face's character map as the reader does, where the face's maps disagree", () => {
    const full = characterMapOnly([[0, 3, format4Of(0x41)], [3, 1, format4Of(0x42)], [3, 10, format12Of(0x1f600)]])
    expect([...characterMap(full)]).toEqual([0x1f600])
    expect(readCharacterMap(full)).toEqual({ ok: true, characters: new Set([0x1f600]) })
    expect([...characterMap(characterMapOnly([[0, 3, format4Of(0x41)], [3, 1, format4Of(0x42)]]))]).toEqual([0x42])
  })

  // A host face of one of these faces' names and other bytes is refused,
  // and one of their bytes embedded as the renderer embeds its own
  // (`face-identity.ts`), each known by the name fontkit reads in it and
  // the digest of its bytes: a table that named a face by another's name
  // or digest would let a face PDFKit draws as this one through, or strip
  // the renderer's own bytes. Each face states one name, the one fontkit
  // reads.
  test('are the faces face-identity.ts knows, by name and digest', () => {
    expect(
      FACES.map((face) => {
        const bytes = bytesOf(face.directory, face.file)
        return { postScriptName: fontkit.create(Buffer.from(bytes)).postscriptName, postScriptNames: read(bytes).names.postScriptNames, digest: assetDigest(bytes) }
      }),
    ).toEqual(OWN_FACES.map(({ postScriptName, digest }) => ({ postScriptName, postScriptNames: [postScriptName], digest })))
  })

  // The two line constants the renderer lays text out by are these faces'
  // horizontal headers, ascender less descender; a constant that drifted
  // from its face would measure every line of a report wrong.
  test("the renderer's line constants are the faces' own lines", () => {
    for (const face of FACES) {
      const { metrics } = read(bytesOf(face.directory, face.file))
      expect((metrics.ascender - metrics.descender) / metrics.unitsPerEm, face.file).toBe(face.family === 'Roboto' ? LINE_FACTOR : LIBERATION_LINE)
    }
  })
})

describe('fontkit, which PDFKit draws with', () => {
  /** For each code point the reader maps, in its order, how many commands fontkit draws its glyph with: none is a glyph drawn as nothing. */
  function drawn(bytes: Uint8Array, characters: ReadonlySet<number>): number[] {
    const font = fontkit.create(Buffer.from(bytes))
    return [...characters].map((point) => font.glyphForCodePoint(point).path.commands.length)
  }

  /** Every character the reader maps from U+0020 to below U+3000, for PDFKit to embed. */
  const textOf = (characters: ReadonlySet<number>): string => String.fromCodePoint(...[...characters].filter((point) => point >= 0x20 && point < 0x3000))

  /** The code points fontkit and the reader disagree on: one maps a glyph where the other finds glyph 0. */
  function disagreements(bytes: Uint8Array, characters: ReadonlySet<number>): number[] {
    const font = fontkit.create(Buffer.from(bytes))
    return [...new Set([...font.characterSet, ...characters])].filter((point) => (font.glyphForCodePoint(point).id !== 0) !== characters.has(point))
  }

  // A character the reader holds that fontkit maps to glyph 0 prints as
  // nothing, with the render succeeding; one fontkit maps that the reader
  // leaves out is text refused that the face prints. Every code point
  // either names, each face.
  test.each(FACES)('maps every character of $file as the reader does', (face) => {
    const bytes = bytesOf(face.directory, face.file)
    expect(disagreements(bytes, read(bytes).characters)).toEqual([])
  })

  /** The PDF PDFKit writes of `text` in `bytes`, embedded and subset. */
  function embedded(bytes: Uint8Array, text: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument()
      const chunks: Buffer[] = []
      document.on('data', (chunk) => chunks.push(chunk))
      document.on('end', () => resolve(Buffer.concat(chunks).length))
      document.on('error', reject)
      try {
        document.font(Buffer.from(bytes)).fontSize(10).text(text)
        document.end()
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  /** The tables the reader reads, by tag, with where the directory records each: where a mutation can change what it decides. */
  function readTables(bytes: Uint8Array): { tag: string; record: number; offset: number; length: number }[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const found: { tag: string; record: number; offset: number; length: number }[] = []
    for (let index = 0; index < view.getUint16(4); index++) {
      const record = 12 + 16 * index
      const tag = String.fromCharCode(...bytes.subarray(record, record + 4))
      if (['head', 'hhea', 'hmtx', 'maxp', 'OS/2', 'post', 'name', 'cmap', 'loca', 'glyf'].includes(tag)) found.push({ tag, record, offset: view.getUint32(record + 8), length: view.getUint32(record + 12) })
    }
    return found
  }

  // fontkit reads a table's recorded length to see the table at all, and
  // to end the arrays no field counts, loca's offsets among them: a length
  // the reader accepted that fontkit read otherwise would throw inside
  // pdfmake, or draw a glyph as nothing with the render succeeding. Every
  // table the reader reads, recorded as empty, as one byte and as half its
  // length: refused, or drawn by fontkit glyph for glyph as the face is,
  // and embedded by PDFKit.
  test.each([FACES[0], FACES[4]])(
    'reads every recorded length of $file as fontkit does',
    async (face) => {
      const bytes = bytesOf(face.directory, face.file)
      const whole = drawn(bytes, read(bytes).characters)
      let accepted = 0
      for (const table of readTables(bytes)) {
        for (const length of [0, 1, Math.floor(table.length / 2)]) {
          const recorded = Uint8Array.from(bytes)
          new DataView(recorded.buffer).setUint32(table.record + 12, length)
          const outcome = readFont(recorded)
          if (!outcome.ok) continue
          accepted += 1
          expect(drawn(recorded, outcome.characters), `${table.tag} recorded as ${length} bytes`).toEqual(whole)
          await expect(embedded(recorded, textOf(outcome.characters)), `${table.tag} recorded as ${length} bytes`).resolves.toBeGreaterThan(0)
        }
      }
      // Each table but loca read at one byte and at half its length: a reader that refused them would refuse fonts PDFKit prints.
      expect(accepted).toBe(18)
    },
    TIMEOUT * 4,
  )

  // A font the reader accepts is one PDFKit embeds: a reader that passed
  // a font fontkit then threw on would turn a refusal the renderer can say
  // into an error inside pdfmake. Seeded corruptions of the tables the
  // reader reads and of their records in the directory -- its layout
  // tables, GSUB and GPOS, it does not read, and 0040 says so -- each
  // either refused, or mapped alike by fontkit, named alike, and embedded
  // by PDFKit with every character it maps below U+3000. On 22 October
  // 2026, 300 of each face measured so: 276 of 600 accepted, none thrown,
  // none mapped or named otherwise.
  test.each([FACES[0], FACES[4]])(
    'embeds every corruption of $file that the reader accepts, and maps it alike',
    async (face) => {
      const bytes = bytesOf(face.directory, face.file)
      const tables = readTables(bytes)
      let state = 0x0f0a7
      const random = (): number => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
        return state / 0x1_0000_0000
      }
      // Each table's data, and each table's record in the directory: its tag, checksum, offset and length.
      const regions = [...tables, ...tables.map((table) => ({ offset: table.record, length: 16 }))]
      let accepted = 0
      for (let round = 0; round < 80; round++) {
        const corrupted = Uint8Array.from(bytes)
        const region = regions[Math.floor(random() * regions.length)]!
        for (let flips = 1 + Math.floor(random() * 3); flips > 0; flips--) corrupted[region.offset + Math.floor(random() * region.length)] = Math.floor(random() * 256)
        const outcome = readFont(corrupted)
        if (!outcome.ok) continue
        accepted += 1
        expect(disagreements(corrupted, outcome.characters), `round ${round}`).toEqual([])
        expect(readCharacterMap(corrupted)).toEqual({ ok: true, characters: outcome.characters })
        // The name the reader says the PDF names the font by is the one fontkit hands PDFKit, and one of those the renderer tells faces apart by.
        expect(fontkit.create(Buffer.from(corrupted)).postscriptName, `round ${round}`).toBe(outcome.names.postScriptName)
        expect(outcome.names.postScriptNames, `round ${round}`).toContain(outcome.names.postScriptName)
        await expect(embedded(corrupted, textOf(outcome.characters)), `round ${round}`).resolves.toBeGreaterThan(0)
      }
      // A sweep the reader refused whole would prove nothing of what it accepts.
      expect(accepted).toBeGreaterThan(30)
    },
    TIMEOUT * 4,
  )
})
