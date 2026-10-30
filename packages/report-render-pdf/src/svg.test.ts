import { createHash } from 'node:crypto'
import pdfmake from 'pdfmake'
import { inspectionData, rasterPixels, readAnnotations, readPdf, SERVICE_INSPECTION, SVG_MARK, SVG_WINDOW, verify, verifyInk } from '@formancy/report-corpus'
import {
  checkSvg,
  MAX_SVG_GROUPS,
  MAX_SVG_SEGMENTS,
  resolveReport,
  type Block,
  type Image,
  type ImageAsset,
  type ImageRef,
  type ReportDefinition,
  type ResolvedDocument,
} from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { drawingUnits, MAX_SVG_DRAWING } from './assets.js'
import { renderPdf } from './node.js'
import { converterOptions } from './svg-content.js'
import { bareDocument, fixtureOf, paragraph, TIMEOUT } from './testing/documents.js'
import { readDrawing } from './testing/drawing.js'
import { colourAt, DRAWINGS, inkBox, MARK, MARK_COLOURS, svg, svgAsset } from './testing/svg.js'

/**
 * An SVG asset drawn (0030), proved on the PDF it produced (0003): its
 * paths and clips read from the page's content stream (`testing/drawing.ts`),
 * which the converter draws into directly for a drawing without
 * transparency groups, and its pixels drawn by PDF.js where what matters is
 * what the clip hides. The page is the corpus's: 40 pt from the left edge
 * and 36 pt from the top, where a bare document's first block stands.
 */

const LEFT = 40
const TOP = 36
const SCALE = 4

const image = (asset: ImageAsset, width = 60, height = 60, fit: Image['fit'] = 'contain'): Image => ({ kind: 'image', asset, width, height, fit })

/** `document` rendered, and held to carrying no annotation: the converter writes a link for an `<a>` whatever its callbacks say, and every render of an SVG here shows none got through. */
async function rendered(document: ResolvedDocument, maxPages = 5): Promise<Uint8Array> {
  const pdf = await renderPdf(document, { maxPages })
  expect(await readAnnotations(pdf)).toEqual([])
  return pdf
}

/**
 * `text` as it came, never cleaned, drawn by the converter under the
 * renderer's options in a box 60 pt square where a bare document's first
 * block stands: what the cleaner and the check keep from the page, shown
 * on it so that each claim below is seen to fail without them.
 */
async function asItCame(text: string): Promise<Uint8Array> {
  // A render leaves pdfmake configured with the renderer's fonts and policies.
  await rendered(bareDocument('Configure', [paragraph('Configure')]))
  const node = { svg: text, width: 60, height: 60, options: converterOptions('as-it-came', 'contain') }
  return new Uint8Array(await pdfmake.createPdf({ pageSize: 'A4', pageMargins: [LEFT, TOP, LEFT, TOP], content: [node] }).getBuffer())
}

describe('an SVG image', () => {
  // A logo is a vector file, and printed as one it is sharp at any size and
  // never an image the PDF embeds. It is drawn in its own colours, inside a
  // clip of exactly its box, with nothing of it outside the box, no text of
  // its own and no annotation: what the converter would add for a link or
  // a word is never there. Read by the corpus's reader, which follows a
  // form and a transparency group as the page's own stream does not, so
  // that a colour drawn inside one is seen too.
  test(
    'is drawn as vectors, in its own colours, inside a clip of exactly its box',
    async () => {
      for (const drawing of [MARK, DRAWINGS.clips!]) {
        const bytes = await rendered(bareDocument('Mark', [image(svgAsset(drawing))]))
        const [page] = (await readPdf(bytes)).pages
        const box = page!.clips[0]!
        expect([box.x, box.top, box.width, box.height].map((n) => Math.round(n * 1000) / 1000)).toEqual([LEFT, TOP, 60, 60])
        for (const path of page!.paths) {
          expect(path.clip, "every path inside the box's clip").toBeDefined()
          expect(path.x).toBeGreaterThanOrEqual(LEFT - 0.001)
          expect(path.top).toBeGreaterThanOrEqual(TOP - 0.001)
          if (drawing === MARK) {
            // The mark draws inside its viewBox; the clipped drawing paints past it, inside the clip.
            expect(path.x + path.width).toBeLessThanOrEqual(LEFT + 60.001)
            expect(path.top + path.height).toBeLessThanOrEqual(TOP + 60.001)
          }
        }
        expect(page!.images).toEqual([])
        expect(page!.items).toEqual([])
      }
      const [mark] = (await readPdf(await rendered(bareDocument('Mark', [image(svgAsset(MARK))])))).pages
      expect(new Set(mark!.paths.flatMap((path) => [path.fill, path.stroke]).filter((colour) => colour !== undefined))).toEqual(
        new Set([MARK_COLOURS.disc, MARK_COLOURS.white]),
      )
      const [clips] = (await readPdf(await rendered(bareDocument('Clips', [image(svgAsset(DRAWINGS.clips!))])))).pages
      // The stroked diagonal is filled in SVG's default black too, which paints nothing on a line.
      expect(new Set(clips!.paths.flatMap((path) => [path.fill, path.stroke]).filter((colour) => colour !== undefined))).toEqual(
        new Set(['#264653', '#000000', '#e9c46a', '#e76f51']),
      )
    },
    TIMEOUT,
  )

  // `contain` keeps the drawing's proportions, the whole of it as large as
  // the box allows, centred: a drawing twice as wide as tall, filling its
  // viewBox, in a square box is the box's width and half its height, a
  // quarter of the box above it and below it. `preserveAspectRatio="none"`
  // would stretch it to the square.
  test('keeps its proportions under contain, centred in its box', async () => {
    const wide = svgAsset(svg('<rect width="200" height="100" fill="#1f4e79"/>', '0 0 200 100'))
    const [page] = readDrawing(await rendered(bareDocument('Contain', [image(wide, 80, 80)])))
    const [rect] = page!.shapes
    expect([rect!.x, rect!.top, rect!.width, rect!.height]).toEqual([LEFT, TOP + 20, 80, 40])
    expect(page!.clips).toEqual([{ kind: 'line', x: LEFT, top: TOP, width: 80, height: 80 }])
  })

  // `cover` fills the box at the drawing's proportions and clips what falls
  // outside it: the operator list shows the drawing past the box, which
  // only the clip hides, so the claim is made on the pixels. Ink fills the
  // box to its edges and none lies beyond them.
  test(
    'covers its box under cover and paints nothing outside it, by its pixels',
    async () => {
      const wide = svgAsset(svg('<rect width="200" height="100" fill="#1f4e79"/>', '0 0 200 100'))
      const bytes = await rendered(bareDocument('Cover', [image(wide, 60, 60, 'cover')]))
      const [page] = readDrawing(bytes)
      expect(page!.shapes[0]!.width).toBe(120)
      const ink = inkBox(await rasterPixels(bytes, 1, SCALE), SCALE)
      expect(ink).toEqual({ x: LEFT, top: TOP, right: LEFT + 60, bottom: TOP + 60 })
    },
    TIMEOUT,
  )

  // A transform on the root moved the drawing and its clip together, so
  // that a drawing could paint anywhere on the page -- over a QR-bill's
  // amount (0030). The cleaner moves it onto a group inside the root:
  // drawn, the drawing moves inside its box and the box clips it. Moved
  // past the box, nothing of it is seen; moved half out of it, the half in
  // it is.
  test(
    'cannot be moved off its box by a transform on its root, by its pixels',
    async () => {
      const square = (transform: string): string => svg('<rect width="100" height="100" fill="#1f4e79"/>', '0 0 100 100', ` transform="${transform}"`)
      const away = await rendered(bareDocument('Away', [image(svgAsset(square('translate(400 300)')))]))
      expect(inkBox(await rasterPixels(away, 1, SCALE), SCALE)).toBeUndefined()
      const half = await rendered(bareDocument('Half', [image(svgAsset(square('translate(50 50)')))]))
      expect(inkBox(await rasterPixels(half, 1, SCALE), SCALE)).toEqual({ x: LEFT + 30, top: TOP + 30, right: LEFT + 60, bottom: TOP + 60 })
      // As it came, the drawing and its clip move together, in the page's points: 400 across and 300 down.
      expect(inkBox(await rasterPixels(await asItCame(square('translate(400 300)')), 1, SCALE), SCALE)).toEqual({
        x: LEFT + 400,
        top: TOP + 300,
        right: LEFT + 460,
        bottom: TOP + 360,
      })
    },
    TIMEOUT,
  )

  // The root's own paint is carried onto the drawing (0030): Figma's
  // `fill="none"` on the root leaves its stroked paths unfilled, where
  // dropped they print as black blobs; Affinity's even-odd rule in the
  // root's style leaves the middle of a ring of two circles running the
  // same way round white, where the default rule fills it.
  test(
    "carries its root's paint: fill none prints no fill, and an even-odd rule its hole",
    async () => {
      const [figma] = readDrawing(await rendered(bareDocument('Figma', [image(svgAsset(DRAWINGS['figma-like']!))])))
      expect(figma!.shapes.map(({ fill, stroke }) => ({ fill, stroke }))).toEqual([
        { fill: undefined, stroke: '#1f4e79' },
        { fill: undefined, stroke: '#1f4e79' },
      ])
      // As it came, with the root's paint dropped as a root's attributes are, each path fills black under its stroke.
      const dropped = DRAWINGS['figma-like']!.replace(' width="100" height="100" fill="none"', '')
      expect(readDrawing(await asItCame(dropped))[0]!.shapes.map(({ fill, stroke }) => ({ fill, stroke }))).toEqual([
        { fill: '#000000', stroke: '#1f4e79' },
        { fill: '#000000', stroke: '#1f4e79' },
      ])
      const ring = await rendered(bareDocument('Affinity', [image(svgAsset(DRAWINGS['affinity-like']!))]))
      const pixels = await rasterPixels(ring, 1, SCALE)
      // The viewBox is 100 units in a box of 60 pt: its middle at 30 pt in, the ring 10 pt in from the top.
      expect(colourAt(pixels, SCALE, LEFT + 30, TOP + 30)).toBe('#ffffff')
      expect(colourAt(pixels, SCALE, LEFT + 30, TOP + 9)).toBe(MARK_COLOURS.disc)
    },
    TIMEOUT,
  )

  // pdfmake lays a page region out again for every page and the converter
  // draws the drawing again each time: on each of three pages, the clip of
  // its box and its paths in its colours.
  test(
    'in a page header, is drawn on every page',
    async () => {
      const pages: Block[] = [paragraph('One'), { kind: 'pageBreak' }, paragraph('Two'), { kind: 'pageBreak' }, paragraph('Three')]
      const document = { ...bareDocument('Header', pages), pageHeader: [image(svgAsset(MARK), 30, 30)] }
      const drawn = readDrawing(await rendered(document))
      expect(drawn).toHaveLength(3)
      for (const page of drawn) {
        expect(page.clips).toContainEqual({ kind: 'line', x: LEFT, top: TOP, width: 30, height: 30 })
        expect(page.shapes.filter((shape) => shape.fill === MARK_COLOURS.disc)).toHaveLength(1)
      }
    },
    TIMEOUT,
  )
})

describe('what SVG images may cost a render', () => {
  /** A drawing of one path of `lines` lines and the move it starts with, filled. */
  const path = (lines: number): string =>
    svg(`<path d="M0 0${Array.from({ length: lines }, (_, i) => `L${(i * 37) % 100} ${(i * 61) % 100}`).join('')}" fill="#1f4e79"/>`)

  /** What drawing `inner` once costs the renderer, and its cleaned bytes' share of it. */
  const units = (inner: string): { readonly units: number; readonly bytes: number } => {
    const checked = checkSvg(svgAsset(svg(inner)).bytes)
    if (!checked.ok) throw new Error(checked.message)
    return { units: drawingUnits(checked), bytes: Math.ceil(checked.bytes.length / 32) }
  }

  // Each thing the converter draws costs the renderer what its weight says
  // (assets.ts): a drawing that differs from another by one of each costs
  // that weight more, beside the unit every 32 bytes of it cost. A weight
  // left out would let a header logo of gradients or clips cost every page
  // many times what was counted.
  test.each([
    ['a line', '<path d="M0 0L1 1L2 0" fill="#000"/>', '<path d="M0 0L1 1L2 0L3 1" fill="#000"/>', 1],
    ['a curve', '<path d="M0 0L1 1L2 0" fill="#000"/>', '<path d="M0 0L1 1L2 0C3 1 4 1 5 0" fill="#000"/>', 3],
    [
      'an element',
      '<path d="M0 0L1 1L2 0" fill="#000"/>',
      '<path d="M0 0L1 1L2 0" fill="#000"/><g fill="#000"><path d="M0 0L1 1L2 0" fill="#000"/></g>',
      12 + 3 + 12,
    ],
    [
      'a gradient stop',
      '<linearGradient id="a"><stop/><stop offset="1"/></linearGradient><rect width="1" height="1" fill="url(#a)"/>',
      '<linearGradient id="a"><stop/><stop offset=".5"/><stop offset="1"/></linearGradient><rect width="1" height="1" fill="url(#a)"/>',
      12 + 6,
    ],
    [
      'a transparency group',
      '<g fill="#000"><rect width="1" height="1"/><rect x="2" width="1" height="1"/></g>',
      '<g fill="#000" opacity="0.5"><rect width="1" height="1"/><rect x="2" width="1" height="1"/></g>',
      40,
    ],
  ])('%s costs its weight', (_, less, more, weight) => {
    expect(units(more).units - units(less).units).toBe(weight + units(more).bytes - units(less).bytes)
  })

  // pdfmake reads the drawing's whole text again in every pass and the
  // converter on every draw, whatever it draws: 10,506 arcs that draw
  // nothing, a mebibyte of seventeen-digit numbers, cost the renderer what
  // 35,000 short lines do (assets.ts). So every 32 bytes are a unit more,
  // and the same commands written in longer numbers cost more.
  test('every 32 bytes of a drawing cost a unit', () => {
    const short = units('<path d="M0 0L1 1L2 0" fill="#000"/>')
    const long = units('<path d="M0 0L1.123456789 1.123456789L2.123456789 0.123456789" fill="#000"/>')
    expect(long.units - short.units).toBe(long.bytes - short.bytes)
    expect(long.bytes).toBeGreaterThan(short.bytes)
    const n = '-111111.111111111'
    const arcs = units(
      `<rect width="1" height="1" fill="#000"/><path d="M${n} ${n}${` A111111.111111111 111111.111111111 0 0 0 ${n} ${n}`.repeat(1000)}" fill="#000"/>`,
    )
    expect(arcs.units).toBe(5 + (1 + 1000) + 12 * 3 + arcs.bytes)
  })

  // A drawing in a page header is drawn on every page, so it counts as
  // many times as the report may have pages, which is known before the
  // render: a drawing of about 10,000 units at the most pages the budget
  // holds it to is drawn, and one more page is past it, though the report
  // prints one. In the body it counts once, at any limit.
  test(
    'counts an SVG in a page region on every page the report may have, and refuses past MAX_SVG_DRAWING',
    async () => {
      const asset = svgAsset(path(MAX_SVG_DRAWING / 100 - 1 - 24 - 2000), 'logo')
      const checked = checkSvg(asset.bytes)
      if (!checked.ok) throw new Error(checked.message)
      const cost = drawingUnits(checked)
      const pages = Math.floor(MAX_SVG_DRAWING / cost)
      expect(pages).toBeGreaterThanOrEqual(99)
      const header = (maxPages: number): Promise<unknown> =>
        rendered({ ...bareDocument('Header', [paragraph('One page')]), pageHeader: [image(asset, 30, 30)] }, maxPages)
      await expect(header(pages)).resolves.toBeInstanceOf(Uint8Array)
      await expect(header(pages + 1)).rejects.toMatchObject({
        code: 'content-too-large',
        subject: 'logo',
        message: `the SVG images up to logo cost ${cost * (pages + 1)} units to draw, each in a page region counted on every page the report may have; a render may draw ${MAX_SVG_DRAWING}`,
      })
      await expect(rendered(bareDocument('Body', [image(asset, 30, 30)]), pages + 1)).resolves.toBeInstanceOf(Uint8Array)
    },
    TIMEOUT,
  )

  // What one drawing may cost a reader was measured as what a page may
  // cost: a 6 KB logo of translucent gradients froze a preview for seconds
  // (0030). Every SVG image of the body is counted as though all of
  // them fell on one page, beside those of the page regions, which every
  // page draws: a drawing of three units of groups prints once, and twice
  // is past MAX_SVG_GROUPS, in the body or once in the header and once in
  // the body. So with segments.
  test(
    'counts every SVG image of the body as though it fell on one page, beside those of the page regions',
    async () => {
      const fade = svgAsset(
        svg(
          '<linearGradient id="t"><stop/><stop offset="1" stop-opacity="0.5"/></linearGradient><rect width="10" height="10" fill="url(#t)"/><g opacity="0.8"><rect x="20" width="10" height="10" fill="#000"/></g>',
        ),
        'fade',
      )
      const groups = checkSvg(fade.bytes)
      expect(groups.ok && groups.groups).toBe(3)
      await expect(rendered(bareDocument('Once', [image(fade, 30, 30)]))).resolves.toBeInstanceOf(Uint8Array)
      const refusal = {
        code: 'content-too-large',
        subject: 'fade',
        message: `the SVG images up to fade would make 6 units of page-sized transparency groups on one page, every SVG image of the body counted as though it fell there beside those of the page regions; a page may make ${MAX_SVG_GROUPS}`,
      }
      await expect(rendered(bareDocument('Twice', [image(fade, 30, 30), { kind: 'pageBreak' }, image(fade, 30, 30)]))).rejects.toMatchObject(refusal)
      await expect(rendered({ ...bareDocument('Header and body', [image(fade, 30, 30)]), pageHeader: [image(fade, 30, 30)] })).rejects.toMatchObject(refusal)
      const half = svgAsset(path(MAX_SVG_SEGMENTS / 2), 'half')
      const segments = checkSvg(half.bytes)
      expect(segments.ok && segments.segments).toBe(MAX_SVG_SEGMENTS / 2 + 1)
      await expect(rendered(bareDocument('Half', [image(half, 30, 30)]))).resolves.toBeInstanceOf(Uint8Array)
      await expect(rendered(bareDocument('Twice half', [image(half, 30, 30), image(half, 30, 30)]))).rejects.toMatchObject({
        code: 'content-too-large',
        subject: 'half',
        message: expect.stringContaining(`would cost a reader ${MAX_SVG_SEGMENTS + 2} weighted segments to paint on one page`),
      })
    },
    TIMEOUT,
  )
})

describe('an SVG from a report', () => {
  const digest = (bytes: Uint8Array): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  const MARK_ASSET = { asset: 'mark', digest: digest(SVG_MARK), mediaType: 'image/svg+xml', bytes: SVG_MARK } as const
  const SKETCH = { asset: 'inspection-sketch', digest: digest(SVG_WINDOW), mediaType: 'image/svg+xml', bytes: SVG_WINDOW } as const
  const NOTES = Array.from({ length: 60 }, (_, index) => `N${String(index + 1).padStart(2, '0')}:`)

  // A logo reaches the page from a report as a PNG does (0030): a
  // template's asset, declared an SVG and named by its digest, and an image
  // field whose value names an approved SVG. The host hands over the bytes
  // for each, asked by id and digest, and the runtime carries the media
  // type to the renderer, which draws each as vectors in its box: the
  // inspection's mark above its title, and the visit's sketch where its
  // photo stands. Proved on the PDF and its pixels, as the corpus proves a
  // fixture.
  test(
    "draws a template's SVG asset and an image field's SVG, each resolved by the runtime from the host",
    async () => {
      const { report } = SERVICE_INSPECTION
      const withMark: ReportDefinition = {
        ...report,
        assets: [{ id: MARK_ASSET.asset, mediaType: MARK_ASSET.mediaType, digest: MARK_ASSET.digest }],
        regions: {
          ...report.regions,
          reportHeader: [
            { id: 'mark-image', kind: 'image', source: { kind: 'asset', asset: MARK_ASSET.asset }, width: 42.52, height: 42.52, fit: 'contain' },
            ...report.regions.reportHeader,
          ],
        },
      }
      const visit = inspectionData()
      const data = { ...visit, header: { ...visit.header, photo: { asset: SKETCH.asset, digest: SKETCH.digest } } }
      const asked: ImageRef[] = []
      const images = (ref: ImageRef): (typeof MARK_ASSET | typeof SKETCH) | undefined => {
        asked.push(ref)
        return [MARK_ASSET, SKETCH].find((each) => each.asset === ref.asset && each.digest === ref.digest)
      }
      const outcome = resolveReport(withMark, data, { mode: 'final', parameters: {}, images, creationDate: '2026-10-15T08:00:00Z' })
      if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; '))
      expect(asked.map((ref) => ref.asset).sort()).toEqual([MARK_ASSET.asset, SKETCH.asset].sort())
      const bytes = await rendered(outcome.document, 20)
      const fixture = fixtureOf('svg-from-a-report', outcome.document, {
        minPagesExpected: 2,
        maxPagesExpected: 4,
        keys: [...NOTES, 'Defect found', 'Photo'],
        exactText: ["Inspector's signature", 'Place and date'],
        wrappedText: ['The belt of the exhaust fan is cracked and must be replaced within 30 days.'],
      })
      expect(fixture.expect.images).toEqual([
        { kind: 'vector', width: 42.52, height: 42.52 },
        { kind: 'vector', width: 240, height: 180 },
      ])
      const pdf = await readPdf(bytes)
      expect(verify(fixture, pdf)).toEqual([])
      expect(pdf.pages.flatMap((page) => page.images)).toEqual([])
      expect(await verifyInk(fixture, bytes)).toEqual([])
    },
    TIMEOUT,
  )
})
