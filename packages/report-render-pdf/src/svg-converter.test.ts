import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import { QUOTATION, quotationData, rasterPixels, readAnnotations } from '@formancy/report-corpus'
import { cleanSvg, MAX_SVG_GROUPS, MAX_SVG_SEGMENTS, resolveReport, type Image, type ImageAsset } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { checkImageAsset, type Vector } from './assets.js'
import { renderPdf } from './node.js'
import { svgContent } from './svg-content.js'
import { bareDocument, paragraph, TIMEOUT } from './testing/documents.js'
import { withoutMark } from './testing/letterhead.js'
import { DRAWINGS, mutations, svg, utf8 } from './testing/svg.js'

/**
 * Every drawing the cleaner accepts against the converter that draws it
 * (0030): the converter's warnings are refusals now, so a drawing
 * approved that makes it warn would be refused at every print after; what
 * the bounds accept, against what it costs a reader to paint; and the
 * colours the converter would read by name, against the cleaner's.
 */

/**
 * The drawings, each cleaned, read by the renderer's check and drawn
 * through its node and options, in one pdfmake document: the annotations
 * on its pages, or the refusal the check, the list of elements or the
 * converter's callbacks threw.
 */
async function drawnTogether(texts: readonly string[]): Promise<unknown> {
  try {
    const nodes = await Promise.all(
      texts.map(async (text, index) => {
        const cleaned = cleanSvg(utf8(text))
        if (!cleaned.ok) throw new Error(`refused: ${cleaned.message}`)
        const asset: ImageAsset = { id: `drawing-${index}`, mediaType: 'image/svg+xml', bytes: cleaned.bytes }
        const image: Image = { kind: 'image', asset, width: 30, height: 30, fit: index % 2 === 0 ? 'contain' : 'cover' }
        return svgContent(image, (await checkImageAsset(asset)) as Vector)
      }),
    )
    return await readAnnotations(new Uint8Array(await pdfmake.createPdf({ content: nodes }).getBuffer()))
  } catch (error) {
    return error
  }
}

describe('every drawing the cleaner accepts', () => {
  // A converter warning, an image or a link in any of them would be a
  // drawing approved and then refused, or drawn otherwise than approved,
  // at every print. The drawings, and a thousand seeded mutations of them
  // that the cleaner accepts -- numbers at the edges a drawing may hold,
  // transforms of no area, dashes of nothing, paint and clips added -- are
  // read by the renderer's check and drawn by the converter through the
  // renderer's node and its callbacks, fifty to a document: none is refused
  // by the check, none warns, none opens an image and none writes an
  // annotation. A batch that fails is drawn again one by one, so the
  // drawing that failed is named. It found, first, a clip on a gradient
  // that the cleaner wrote as `url(#)` and then refused: approved, and
  // refused at every print.
  test('draws through the converter’s throwing callbacks without a warning, an image or a link', async () => {
    // A render leaves pdfmake configured with the renderer's fonts and policies.
    await renderPdf(bareDocument('Configure', [paragraph('Configure')]), { maxPages: 1 })
    const accepted = [...Object.values(DRAWINGS), ...mutations(1000, 0x5eed)].filter((text) => cleanSvg(utf8(text)).ok)
    // A stream the cleaner refused nearly all of would test nothing.
    expect(accepted.length).toBeGreaterThan(600)
    for (let start = 0; start < accepted.length; start += 50) {
      const batch = accepted.slice(start, start + 50)
      const together = await drawnTogether(batch)
      if (Array.isArray(together) && together.length === 0) continue
      for (const text of batch) expect(await drawnTogether([text]), text).toEqual([])
    }
  }, TIMEOUT)
})

describe('the worst drawing the bounds accept', () => {
  /** A zigzag of `lines` lines, each across the drawing's whole height: a rasteriser's worst, which pays for a segment on every row of pixels it spans. */
  const zigzag = (lines: number): string => `M0 0${Array.from({ length: lines }, (_, i) => `L${((i + 1) * 37) % 100} ${i % 2 === 0 ? 100 : 0}`).join('')}`
  /** Every group the bounds allow -- four clips of one clip path -- one of them over a zigzag of every segment they leave. */
  const clipped = (lines: number): string =>
    svg(`<clipPath id="c"><rect x="5" y="5" width="90" height="90"/></clipPath><g clip-path="url(#c)"><path d="${zigzag(lines)}" fill="#264653"/></g>${[0, 1, 2].map((i) => `<rect x="${i * 30}" y="80" width="20" height="20" fill="#e76f51" clip-path="url(#c)"/>`).join('')}`)

  /** The median of three rasters of a PDF's first page at scale 2, in milliseconds. */
  async function rasterised(pdf: Uint8Array): Promise<number> {
    const runs: number[] = []
    for (let run = 0; run < 3; run += 1) {
      const started = performance.now()
      await rasterPixels(pdf, 1, 2)
      runs.push(performance.now() - started)
    }
    return runs.sort((a, b) => a - b)[1]!
  }

  // What the bounds accept costs every reader of the PDF to paint, and the
  // Studio's preview on every edit (0030). The slowest drawing measured at
  // the bounds is this one page-wide: a zigzag every segment of which
  // crosses the box, in a clipped group, and three more shapes in the same
  // clip. It is held to a starter page drawn in the same process, so that a
  // slower machine, CI's, is not a slower drawing: PDF.js drew it at scale 2
  // in 446 to 448 ms and the quotation's first page in 54 to 59, about
  // eight times as long, medians of five over two runs (2026-10-18, Intel
  // i9-10900K under Node 24.21.0, pdfjs-dist 6.4.299 on @napi-rs/canvas
  // 1.0.11, a shared machine). The ceiling is twice that. At 30,000
  // segments, where 0030 says the bound stood before this drawing was
  // measured, it took 1.66 s, about thirty starter pages: a bound raised
  // that far fails here, as does a pdfmake that paints the drawing several
  // times slower beside what it draws of a report. The quotation is drawn
  // without the firm's mark it has carried since 0032, as it printed when
  // it was measured: a yardstick that held an SVG would slow with the
  // drawing, and hide the very slowing this test is here to catch.
  test('rasterises page-wide, at scale 2, in under sixteen times a starter page', async () => {
    const without = cleanSvg(utf8(clipped(1)))
    if (!without.ok) throw new Error(without.message)
    const text = clipped(1 + MAX_SVG_SEGMENTS - without.segments)
    const cleaned = cleanSvg(utf8(text))
    expect(cleaned.ok && [cleaned.segments, cleaned.groups]).toEqual([MAX_SVG_SEGMENTS, MAX_SVG_GROUPS])
    if (!cleaned.ok) return
    const pdf = await renderPdf(bareDocument('Worst', [{ kind: 'image', asset: { id: 'worst', mediaType: 'image/svg+xml', bytes: cleaned.bytes }, width: 480, height: 480, fit: 'contain' }]), { maxPages: 1 })
    expect(await readAnnotations(pdf)).toEqual([])
    const quotation = resolveReport(withoutMark(QUOTATION.report), quotationData(), { mode: 'final', parameters: {}, creationDate: '2026-10-15T08:00:00Z', images: () => undefined })
    if (!quotation.ok) throw new Error(quotation.errors.map((error) => error.message).join('; '))
    const starter = await renderPdf(quotation.document, { maxPages: 20 })
    // PDF.js loads its fonts and its code on the first page it draws.
    await rasterPixels(starter, 1, 2)
    expect((await rasterised(pdf)) / (await rasterised(starter))).toBeLessThan(16)
  }, TIMEOUT)
})

describe("the converter's colour names", () => {
  const pdfmakeDirectory = path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json'))

  /** The names and colours svg-to-pdfkit reads, from its own table in a build of pdfmake. */
  function namedColours(file: string): ReadonlyMap<string, string> {
    const table = /const NamedColors = \{([^}]*)\}/.exec(readFileSync(path.join(pdfmakeDirectory, file), 'utf8'))?.[1] ?? ''
    const hex = (channel: string): string => Number(channel).toString(16).padStart(2, '0')
    return new Map([...table.matchAll(/(\w+): \[(\d+),\s*(\d+),\s*(\d+)\]/g)].map(([, name, r, g, b]) => [name!, `#${hex(r!)}${hex(g!)}${hex(b!)}`]))
  }

  /** The colour the cleaner writes for `name`, or why it refuses it. */
  function written(name: string): string {
    const cleaned = cleanSvg(utf8(svg(`<rect width="1" height="1" fill="${name}"/>`)))
    return cleaned.ok ? (/fill="(#[0-9a-f]{6})"/.exec(new TextDecoder().decode(cleaned.bytes))?.[1] ?? 'none') : cleaned.code
  }

  // The cleaner reads CSS Color 4's names and writes each as #rrggbb, so
  // the converter's own table is never read for an approved drawing. Were
  // the two to differ for a name both know, a logo would print in another
  // colour than a browser shows it, and nothing would say so. Each of the
  // converter's names, in Node's build and the browser's, is the colour the
  // cleaner writes for it; CSS Color 4 adds one name the converter lacks,
  // yellowgreen, which it would print black.
  test.each(['js/3rd-party/svg-to-pdfkit/source.js', 'build/pdfmake.js'])("in %s, are the cleaner's, which knows one more", (file) => {
    const colours = namedColours(file)
    expect(colours.size).toBe(147)
    for (const [name, colour] of colours) expect(written(name), name).toBe(colour)
    expect(colours.has('yellowgreen')).toBe(false)
    expect(written('yellowgreen')).toBe('#9acd32')
  })
})
