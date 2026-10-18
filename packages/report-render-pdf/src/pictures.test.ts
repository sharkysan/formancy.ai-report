import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EURO_INVOICE_SAMPLES, INVOICE_SAMPLES, STARTERS, type Drawing } from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { TIMEOUT } from './testing/documents.js'
import { picture, PICTURES, SAMPLE_PICTURES, type PictureSpec, type Place } from './testing/pictures.js'

/**
 * The README's pictures of the starters and of both invoices' samples, held
 * to the text and the drawings they show. Each was drawn by
 * `scripts/readme-pictures.ts` from a page this package rendered, and the
 * manifest beside it records what PDF.js read on that page (0032): its
 * lines, where each of them starts, `[x, top]` to the hundredth of a point,
 * and its drawings, each clip a painted path stands inside, with its box,
 * its paints and each of its paths, painted in what and where
 * (report-corpus's `drawingsOn`): `pictures.json` for the starters',
 * `samples.json` for the samples'. A picture whose page now prints other
 * words, or the same words elsewhere -- every line under a mark moved down
 * -- or draws otherwise -- a drawing or a path of one added, removed,
 * moved, resized or repainted, a mark among them, which prints no text --
 * a picture edited by hand, and a caption that quotes what its page does
 * not print each fail here, naming the picture; the script draws them
 * again. What it does not see: a path redrawn with every point inside its
 * old box, a rule, a border or an image, which no manifest records, and
 * the colour of text. Pixels are never compared: they are the platform's
 * canvas.
 */

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const images = path.join(root, 'docs', 'images')

interface Entry {
  readonly file: string
  /** The starter's id, in `pictures.json`. */
  readonly starter?: string
  /** The sample's id, in `samples.json`. */
  readonly sample?: string
  readonly page: number
  readonly sha256: string
  readonly caption: string
  readonly lines: readonly string[]
  /** Where each of `lines` starts, in the same order. */
  readonly places: readonly Place[]
  /** The page's drawings, a QR code's among them, in the order the page sets their clips. */
  readonly drawings: readonly Drawing[]
}

/** Each line with where it starts, so that a line moved fails as itself. */
const placed = (lines: readonly string[], places: readonly Place[] | undefined): string[] => lines.map((line, index) => `${line} at ${places?.[index]?.join(', ') ?? 'no place recorded'}`)

/** A PNG's width and height, from its header. */
const size = (png: Uint8Array): [number, number] => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

const starters = JSON.parse(readFileSync(path.join(images, 'pictures.json'), 'utf8')) as Entry[]
const samples = JSON.parse(readFileSync(path.join(images, 'samples.json'), 'utf8')) as Entry[]
const readme = readFileSync(path.join(root, 'README.md'), 'utf8')

describe("the README's pictures", () => {
  // A picture the manifest does not list, or listed and not drawn, is one
  // nothing holds.
  test('are every picture the script draws, each listed once', () => {
    expect(starters.map(({ file, starter, page }) => [file, starter, page])).toEqual(PICTURES.map((spec) => [spec.file, spec.starter.id, spec.page]))
    expect(samples.map(({ file, sample, page }) => [file, sample, page])).toEqual(SAMPLE_PICTURES.map((spec) => [spec.file, spec.starter.id, spec.page]))
  })

  // The README's "What the starters print" shows a page of each: a starter
  // added to the corpus without one is a report the README says nothing
  // of, and a reader never sees printed.
  test('show a page of every starter', () => {
    expect(new Set(PICTURES.map((spec) => spec.starter.id))).toEqual(new Set(STARTERS.map((starter) => starter.id)))
  })

  // The pages show each invoice in each language and country it is a
  // sample of: a sample without a picture is one nobody sees printed. And
  // the Studio's browser gate holds every picture pictures.json lists to a
  // starter its picker offers, so a sample listed there, which the picker
  // does not offer, would fail it; each German sample is its starter,
  // pictured once.
  test('show a page of every sample of either invoice, the starters in pictures.json and the samples in samples.json', () => {
    const everySample = [...INVOICE_SAMPLES, ...EURO_INVOICE_SAMPLES]
    expect(everySample.filter((sample) => ![...PICTURES, ...SAMPLE_PICTURES].some((spec) => spec.starter === sample)).map((sample) => sample.id)).toEqual([])
    expect(PICTURES.filter((spec) => !STARTERS.includes(spec.starter)).map((spec) => spec.file)).toEqual([])
    expect(SAMPLE_PICTURES.filter((spec) => STARTERS.includes(spec.starter) || !everySample.includes(spec.starter)).map((spec) => spec.file)).toEqual([])
  })

  const listed = (list: readonly PictureSpec[], manifest: readonly Entry[]) => list.map((spec) => [spec.file, spec, manifest] as const)
  test.each([...listed(PICTURES, starters), ...listed(SAMPLE_PICTURES, samples)])('%s shows the page it was drawn from', async (file, spec, manifest) => {
    const entry = manifest.find((each) => each.file === file) as Entry
    // The PNG is the one the script wrote, not one edited by hand since.
    expect(createHash('sha256').update(readFileSync(path.join(images, file))).digest('hex')).toBe(entry.sha256)
    // The page prints and draws today what it did when the picture was drawn, where it did, and is drawn at the picture's size.
    const drawn = await picture(spec)
    expect(drawn.lines).toEqual(entry.lines)
    expect(placed(drawn.lines, drawn.places)).toEqual(placed(entry.lines, entry.places))
    expect(drawn.drawings).toEqual(entry.drawings)
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
