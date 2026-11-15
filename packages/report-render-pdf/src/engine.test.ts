import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import nodePdfmake from 'pdfmake'
import browserPdfmake from 'pdfmake/build/pdfmake.js'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { engine as browserEngine } from './browser-engine.js'
import { glyphsOnce, type Engine, type VirtualFs } from './engine.js'
import { characterMap, type Face, type Glyphs } from './glyphs.js'
import { planFonts } from './host-fonts.js'
import { engine as nodeEngine } from './node-engine.js'
import { fixture, TIMEOUT } from './testing/documents.js'

/**
 * The glyphs of the faces an engine embeds, read the first time a document
 * needs them and kept for every document after: a read that succeeded is
 * never made again, and a read that failed is kept for none of them.
 *
 * And the faces each entry opens for measuring a chart's words: from a
 * document of its own pdfmake, configured as a pass is, so that ECharts
 * lays a word out in the width pdfmake will print it in.
 */

const FONTS = {
  normal: readFileSync(fileURLToPath(new URL('../fonts/LiberationSans-Regular.ttf', import.meta.url))),
  bold: readFileSync(fileURLToPath(new URL('../fonts/LiberationSans-Bold.ttf', import.meta.url))),
} as const
type BillFace = keyof typeof FONTS

/** A read of `FONTS` that fails the first `failures` times it is asked for `normal`, and counts every face it is asked for. */
function reader(failures: number): { readonly read: (face: BillFace) => Promise<Uint8Array>; readonly reads: BillFace[] } {
  const reads: BillFace[] = []
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

/** Roboto's four faces, each mapping 'A': the plan reads only a host's faces here, and Roboto's glyphs come from the engine, which no check below asks. */
const ROBOTO: Glyphs = { normal: new Set([0x41]), bold: new Set([0x41]), italics: new Set([0x41]), bolditalics: new Set([0x41]) }

/** Liberation Serif 2.1.5's four faces, the corpus's host font, mapped as the report's serif. */
const SERIF = { serif: fixture('host-fonts').document.fonts!.serif! }

/** The family a mapped serif prints in. */
const HOST_SERIF = 'formancy-host-serif'

/** Each entry's engine, and the pdfmake build whose process-wide virtual files it writes a render's host faces into. */
const ENTRIES: readonly { readonly entry: string; readonly engine: Engine; readonly virtualfs: VirtualFs }[] = [
  { entry: 'Node', engine: nodeEngine, virtualfs: (nodePdfmake as unknown as { readonly virtualfs: VirtualFs }).virtualfs },
  { entry: 'browser', engine: browserEngine, virtualfs: (browserPdfmake as unknown as { readonly virtualfs: VirtualFs }).virtualfs },
]

/** The host faces left in `virtualfs`: those a render names under `formancy-report-render-pdf/font/`. */
const hostFiles = (virtualfs: VirtualFs): string[] => Object.keys(virtualfs.storage).filter((name) => name.startsWith('formancy-report-render-pdf/font/'))

/**
 * Each word at 8 pt, in each face, as pdfmake 0.3.11 measured it on 12
 * November 2026: a text node with `noWrap`, in a pass of pdfmake's Node
 * build, its `_maxWidth` read back, and the same width summed from
 * fontkit's advances word by word (scratchpad probe `widths.mjs`); the
 * chart spike's measure, in both builds, for the regular faces. 'AVA' and
 * 'To' kern in Liberation Serif's own bytes, to 15.26953125 and 8.328125
 * (8.6015625 for bold 'To'): what a host's face prints in is its bytes
 * stripped of their layout tables, measured here by its plain advances,
 * 4437, 2275 and 2390 of its 2048 units, read with fontkit (scratchpad
 * probe `edges-kern.mjs`).
 */
const MEASURED: readonly { readonly family: string; readonly face: Face; readonly widths: Readonly<Record<string, number>> }[] = [
  { family: 'Roboto', face: 'normal', widths: { 'Umsatz nach Region': 73.19140625, '-30.00': 22.3046875 } },
  { family: 'Roboto', face: 'bold', widths: { 'Umsatz nach Region': 73.5703125, '-30.00': 23.12890625 } },
  { family: HOST_SERIF, face: 'normal', widths: { 'Umsatz nach Region': 66.6484375, '-30.00': 20.6640625, AVA: 17.33203125, To: 8.88671875 } },
  { family: HOST_SERIF, face: 'bold', widths: { 'Umsatz nach Region': 70.21875, '-30.00': 20.6640625, To: 9.3359375 } },
]

/** pdfmake's slanted faces and bold ones, as a text node names them. */
const styleOf = (face: Face): { readonly bold: boolean; readonly italics: boolean } => ({
  bold: face === 'bold' || face === 'bolditalics',
  italics: face === 'italics' || face === 'bolditalics',
})

describe('the faces an engine opens for measuring', () => {
  // The browser build warns, under Node, that it has no local-access policy
  // to set: a browser has no local files for it to guard. Silenced here, and
  // held to being that warning and no other, as browser.test.ts holds it.
  let warn: MockInstance<typeof console.warn>
  beforeAll(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => {
    const warnings = new Set(warn.mock.calls.map((call) => String(call[0])))
    warn.mockRestore()
    expect([...warnings].filter((each) => !each.startsWith('No local access policy defined'))).toEqual([])
  })

  // pdfmake's virtual files are process-wide and have no delete: a measure
  // that left a host's face in them would keep a firm's font in the process
  // after its render, and one that opened a face after removing it would
  // fail in a browser, and in Node ask the disk for the file's name. Each
  // face is opened at once, from the file the render wrote, and the file is
  // gone once the faces are opened, or once opening one failed; a face not
  // asked for then is never opened after.
  test.each(ENTRIES)(
    "opens a host face for measuring from the render's virtual files, and leaves none behind, in the $entry entry",
    async ({ engine, virtualfs }) => {
      const host = planFonts(SERIF, ROBOTO).engine
      const widths = await engine.widths(host, [
        { family: HOST_SERIF, face: 'normal' },
        { family: 'Roboto', face: 'normal' },
      ])
      expect(hostFiles(virtualfs)).toEqual([])
      // Liberation Serif's width, which only the render's virtual file holds, and Roboto's beside it.
      expect(widths.width(HOST_SERIF, 'normal', 8, 'Umsatz nach Region')).toBe(66.6484375)
      expect(widths.width('Roboto', 'normal', 8, 'Umsatz nach Region')).toBe(73.19140625)
      expect(() => widths.width(HOST_SERIF, 'bold', 8, 'Umsatz nach Region')).toThrow(`no face ${HOST_SERIF} bold was opened for measuring`)
      // A family the table does not hold: pdfmake refuses to open it, and the faces before it are taken out all the same.
      await expect(
        engine.widths(host, [
          { family: HOST_SERIF, face: 'normal' },
          { family: 'formancy-host-mono', face: 'normal' },
        ]),
      ).rejects.toThrow("Font 'formancy-host-mono' in style 'normal' is not defined")
      expect(hostFiles(virtualfs)).toEqual([])
    },
    TIMEOUT,
  )

  // ECharts places each word by the width it is told, and pdfmake prints
  // it in the width pdfmake measures: a measure taken otherwise -- another
  // face, another size's scale, the bytes before the render stripped them,
  // which kern 'AVA' and 'To' -- would put a word beside its neighbour by
  // one width and print it in another, over it. Each width is the one a
  // pass of the same entry's pdfmake gives the same text node, and the one
  // measured, in Roboto and in a host's Liberation Serif, regular and bold,
  // for words with no whitespace at their edges and no tab.
  test.each(ENTRIES)(
    'measures a word with no whitespace at its edges and no tab as pdfmake measures it, in the $entry entry',
    async ({ engine }) => {
      const host = planFonts(SERIF, ROBOTO).engine
      const widths = await engine.widths(host, MEASURED)
      const nodes = MEASURED.map(({ family, face, widths: words }) =>
        Object.keys(words).map((text) => ({ text, font: family, ...styleOf(face), fontSize: 8, noWrap: true })),
      )
      await engine.run({ content: nodes.flat() }, host)
      const measured = MEASURED.map(({ family, face, widths: words }) => ({
        family,
        face,
        widths: Object.fromEntries(Object.keys(words).map((text) => [text, widths.width(family, face, 8, text)])),
      }))
      const passed = MEASURED.map(({ family, face }, index) => ({
        family,
        face,
        widths: Object.fromEntries(nodes[index]!.map((node) => [node.text, (node as { readonly _maxWidth?: number })._maxWidth])),
      }))
      expect(measured).toEqual(passed)
      expect(measured).toEqual(MEASURED)
    },
    TIMEOUT,
  )

  // pdfmake cuts a run's leading and trailing whitespace out of the width
  // it lays the run out by, and expands a tab to four spaces before it
  // measures; `width` is PDFKit's, which does neither. So a word holding
  // either is measured apart from how pdfmake prints it, and must reach
  // `width` trimmed and without a tab. Pinned in both entries, Roboto at
  // 8 pt, as measured on 12 November 2026 (scratchpad probe
  // `edges-kern.mjs`): a `width` that took pdfmake's rule up would decide
  // what a word's edges and tabs measure in a second place, and fail here.
  test.each(ENTRIES)(
    "measures a word's edge whitespace and a tab as PDFKit does, which pdfmake does not, in the $entry entry",
    async ({ engine }) => {
      const host = planFonts(undefined, ROBOTO).engine
      const widths = await engine.widths(host, [{ family: 'Roboto', face: 'normal' }])
      // The words as written: pdfmake may write a node's text over as it expands a tab.
      const words = [' North ', 'a\tb', 'North']
      const nodes = words.map((text) => ({ text, font: 'Roboto', fontSize: 8, noWrap: true }))
      await engine.run({ content: nodes }, host)
      expect(words.map((text, index) => [widths.width('Roboto', 'normal', 8, text), (nodes[index] as { readonly _maxWidth?: number })._maxWidth])).toEqual([
        [24.16796875, 20.19921875],
        [12.390625, 16.78125],
        [20.19921875, 20.19921875],
      ])
    },
    TIMEOUT,
  )
})
