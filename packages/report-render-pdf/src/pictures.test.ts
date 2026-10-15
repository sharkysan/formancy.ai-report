import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { TIMEOUT } from './testing/documents.js'
import { picture, PICTURES } from './testing/pictures.js'

/**
 * The README's pictures of the starters, held to the text they show. Each
 * was drawn by `scripts/readme-pictures.ts` from a page this package
 * rendered, and the manifest beside it records the lines PDF.js read on
 * that page. A picture whose page now prints something else, a picture
 * edited by hand, and a caption that quotes what its page does not print
 * each fail here, naming the picture; the script draws them again.
 */

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const images = path.join(root, 'docs', 'images')

interface Entry {
  readonly file: string
  readonly starter: string
  readonly page: number
  readonly sha256: string
  readonly caption: string
  readonly lines: readonly string[]
}

/** A PNG's width and height, from its header. */
const size = (png: Uint8Array): [number, number] => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

const manifest = JSON.parse(readFileSync(path.join(images, 'pictures.json'), 'utf8')) as Entry[]
const readme = readFileSync(path.join(root, 'README.md'), 'utf8')

describe("the README's pictures", () => {
  // A picture the manifest does not list, or listed and not drawn, is one
  // nothing holds.
  test('are every picture the script draws, each listed once', () => {
    expect(manifest.map(({ file, starter, page }) => [file, starter, page])).toEqual(PICTURES.map((spec) => [spec.file, spec.starter.id, spec.page]))
  })

  test.each(PICTURES.map((spec) => [spec.file, spec] as const))('%s shows the page it was drawn from', async (file, spec) => {
    const entry = manifest.find((each) => each.file === file) as Entry
    // The PNG is the one the script wrote, not one edited by hand since.
    expect(createHash('sha256').update(readFileSync(path.join(images, file))).digest('hex')).toBe(entry.sha256)
    // The page prints today what it printed when the picture was drawn, and is drawn at the picture's size.
    const drawn = await picture(spec)
    expect(drawn.lines).toEqual(entry.lines)
    expect(size(drawn.png)).toEqual(size(readFileSync(path.join(images, file))))
    // The caption quotes what the page prints, and the README shows the picture under it.
    expect(entry.caption).toBe(spec.caption)
    for (const quoted of spec.shows) {
      expect(spec.caption).toContain(quoted)
      expect(entry.lines.some((line) => line.includes(quoted))).toBe(true)
    }
    expect(readme).toContain(`![${spec.caption}](docs/images/${file})`)
  }, TIMEOUT)
})
