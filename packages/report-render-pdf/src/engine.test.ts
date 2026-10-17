import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { glyphsOnce } from './engine.js'
import { characterMap } from './glyphs.js'

/**
 * The glyphs of the faces an engine embeds, read the first time a document
 * needs them and kept for every document after: a read that succeeded is
 * never made again, and a read that failed is kept for none of them.
 */

const FONTS = {
  normal: readFileSync(fileURLToPath(new URL('../fonts/LiberationSans-Regular.ttf', import.meta.url))),
  bold: readFileSync(fileURLToPath(new URL('../fonts/LiberationSans-Bold.ttf', import.meta.url))),
} as const
type Face = keyof typeof FONTS

/** A read of `FONTS` that fails the first `failures` times it is asked for `normal`, and counts every face it is asked for. */
function reader(failures: number): { readonly read: (face: Face) => Promise<Uint8Array>; readonly reads: Face[] } {
  const reads: Face[] = []
  let failed = 0
  return {
    reads,
    read: async (face) => {
      reads.push(face)
      if (face === 'normal' && failed < failures) {
        failed += 1
        throw new Error('the font did not load')
      }
      return new Uint8Array(FONTS[face])
    },
  }
}

describe('the glyphs an engine reads once', () => {
  // A read that failed once -- a file the process could not open just then,
  // a font chunk a browser could not fetch -- kept as the answer would fail
  // every later document until the process restarted or the page reloaded.
  // Every document that asks while it is failing hears so; the next one
  // reads the fonts again, and prints.
  test('are read again by the next document after a read that failed', async () => {
    const { read, reads } = reader(1)
    const glyphs = glyphsOnce(['normal', 'bold'], read)
    await Promise.all([expect(glyphs()).rejects.toThrow('the font did not load'), expect(glyphs()).rejects.toThrow('the font did not load')])
    const kept = await glyphs()
    expect([...kept.normal]).toEqual([...characterMap(FONTS.normal)])
    expect([...kept.bold]).toEqual([...characterMap(FONTS.bold)])
    expect(reads).toEqual(['normal', 'bold', 'normal', 'bold'])
  })

  // Fonts read for every document would parse two character maps, or in a
  // browser import a chunk, for each one: once read, the glyphs are kept,
  // shared by the documents that asked at the same time and handed to every
  // one that asks after.
  test('are read once, however many documents ask, at the same time or after', async () => {
    const { read, reads } = reader(0)
    const glyphs = glyphsOnce(['normal', 'bold'], read)
    const [first, ...others] = await Promise.all([glyphs(), glyphs(), glyphs()])
    others.push(await glyphs())
    expect(others.every((each) => each === first)).toBe(true)
    expect(reads).toEqual(['normal', 'bold'])
  })
})
