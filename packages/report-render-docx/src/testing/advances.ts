import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * A TrueType font's advances, read from its own tables by a walk of this
 * file's own (0075): the character map in format 4, and the horizontal
 * metrics. For the tests that hold the widths the writer states for a
 * slip to the Liberation Sans the PDF renderer ships, and that measure a
 * written slip's lines by something other than the writer's table.
 */

export interface FaceAdvances {
  readonly unitsPerEm: number
  readonly ascender: number
  readonly descender: number
  /** The advance of the glyph `point` maps to, in units; undefined where it maps to none. */
  readonly of: (point: number) => number | undefined
}

export function readAdvances(bytes: Uint8Array): FaceAdvances {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tables = new Map<string, number>()
  for (let index = 0; index < view.getUint16(4); index++) {
    const at = 12 + 16 * index
    tables.set(String.fromCharCode(...bytes.subarray(at, at + 4)), view.getUint32(at + 8))
  }
  const table = (tag: string): number => {
    const at = tables.get(tag)
    if (at === undefined) throw new Error(`the font has no ${tag} table`)
    return at
  }
  const [head, hhea, hmtx, cmap] = [table('head'), table('hhea'), table('hmtx'), table('cmap')]
  const metrics = view.getUint16(hhea + 34)
  let map: number | undefined
  for (let index = 0; index < view.getUint16(cmap + 2); index++) {
    const at = cmap + 4 + 8 * index
    const offset = cmap + view.getUint32(at + 4)
    // Windows, Unicode's Basic Multilingual Plane, as segments.
    if (view.getUint16(at) === 3 && view.getUint16(at + 2) === 1 && view.getUint16(offset) === 4) map = offset
  }
  if (map === undefined) throw new Error('the font has no character map in format 4')
  const [sub, segments] = [map, view.getUint16(map + 6) / 2]
  const glyph = (point: number): number => {
    for (let segment = 0; segment < segments; segment++) {
      if (point > view.getUint16(sub + 14 + 2 * segment)) continue
      const start = view.getUint16(sub + 16 + 2 * segments + 2 * segment)
      if (point < start) return 0
      const delta = view.getInt16(sub + 16 + 4 * segments + 2 * segment)
      const rangeAt = sub + 16 + 6 * segments + 2 * segment
      const range = view.getUint16(rangeAt)
      if (range === 0) return (point + delta) & 0xffff
      const found = view.getUint16(rangeAt + range + 2 * (point - start))
      return found === 0 ? 0 : (found + delta) & 0xffff
    }
    return 0
  }
  return {
    unitsPerEm: view.getUint16(head + 18),
    ascender: view.getInt16(hhea + 4),
    descender: view.getInt16(hhea + 6),
    of: (point) => {
      const found = glyph(point)
      return found === 0 ? undefined : view.getUint16(hmtx + 4 * Math.min(found, metrics - 1))
    },
  }
}

const face = (file: string): FaceAdvances => readAdvances(readFileSync(fileURLToPath(new URL(`../../../report-render-pdf/fonts/${file}`, import.meta.url))))

/** Liberation Sans 2.1.5's two faces, as the PDF renderer ships them in its `fonts` directory. */
export const LIBERATION: Readonly<Record<'normal' | 'bold', FaceAdvances>> = {
  normal: face('LiberationSans-Regular.ttf'),
  bold: face('LiberationSans-Bold.ttf'),
}

/** How wide `text` is in `face` at `size` points, by the font's own advances; throws where the face has no glyph for a character of it. */
export function measured(text: string, weight: 'normal' | 'bold', size: number): number {
  const read = LIBERATION[weight]
  let units = 0
  for (const character of text) {
    const advance = read.of(character.codePointAt(0)!)
    if (advance === undefined) throw new Error(`Liberation Sans has no glyph for U+${character.codePointAt(0)!.toString(16)}`)
    units += advance
  }
  return (units * size) / read.unitsPerEm
}
