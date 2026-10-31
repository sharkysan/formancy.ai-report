import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pdfmake from 'pdfmake'
import { readAnnotations, readPdf } from '@formancy/report-corpus'
import { cleanSvg, RenderRefusal, SVG_ELEMENTS, type Image, type ImageAsset } from '@formancy/report-runtime'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Vector } from './assets.js'
import { renderPdf } from './node.js'
import { converterOptions, DRAWN, foreignMarkup, svgContent } from './svg-content.js'
import { bareDocument, paragraph, TIMEOUT } from './testing/documents.js'
import { encodePng } from './testing/images.js'
import { DRAWINGS, rawSvgAsset, svg, SVG_THREATS, svgAsset } from './testing/svg.js'

/**
 * An SVG as a host might hand it over, never cleaned: each of the hazards
 * pdfmake's converter meets in one (`testing/svg.ts`), refused before
 * pdfmake runs, and the two guards behind that refusal -- the renderer's
 * own list of elements, and the converter's callbacks -- each shown to hold
 * without the other.
 */

const image = (asset: ImageAsset): Image => ({ kind: 'image', asset, width: 60, height: 60, fit: 'contain' })

/** A drawing as the check hands one on, of nothing: what a guard behind the check is handed when the check is wrong. */
const VECTOR: Vector = {
  kind: 'vector',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  svg: '<svg/>',
  segments: 0,
  groups: 0,
  units: 0,
  extent: { groups: { inverse: 0, origin: 0 }, patterns: { linear: 0, offset: 0 }, local: 0, own: 0, nesting: 0 },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('an SVG as it came', () => {
  // A host that never ran cleanSvg hands the renderer the file as it came.
  // Every hazard is refused as invalid-asset, naming the asset, before
  // pdfmake is asked to make anything, so that no pass of it ever sees the
  // file; and the refusal repeats none of what made the file dangerous. A
  // file the cleaner would accept once cleaned -- a link, a script -- is
  // refused too: what prints is what was approved, and nothing is cleaned
  // at print.
  test.each(SVG_THREATS)('$name is refused before pdfmake runs, naming the asset and none of its value', async ({ bytes, outcome, secrets }) => {
    const cleaned = cleanSvg(bytes)
    expect(cleaned.ok ? 'removed' : cleaned.code).toBe(outcome)
    const created = vi.spyOn(pdfmake, 'createPdf')
    const refusal = await renderPdf(bareDocument('Threat', [image(rawSvgAsset(bytes, 'threat'))]), { maxPages: 1 }).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(refusal).toBeInstanceOf(RenderRefusal)
    expect(refusal).toMatchObject({
      code: 'invalid-asset',
      subject: 'threat',
      message: expect.stringMatching(/^the image asset threat is not an SVG the renderer draws: /),
    })
    for (const secret of secrets) expect((refusal as RenderRefusal).message).not.toContain(secret)
    expect(created).not.toHaveBeenCalled()
  })

  // What the cleaner removes is gone from the drawing it writes: the link
  // the converter would have written as an annotation to its address, the
  // script, the handler, the title. Approved and printed, the page holds
  // no annotation and no text, and the PDF none of their words.
  test.each(SVG_THREATS.filter((threat) => threat.outcome === 'removed'))('$name, cleaned, prints nothing of what was removed', async ({ bytes, secrets }) => {
    const cleaned = cleanSvg(bytes)
    if (!cleaned.ok) throw new Error(cleaned.message)
    const pdf = await renderPdf(bareDocument('Cleaned', [image({ id: 'cleaned', mediaType: 'image/svg+xml', bytes: cleaned.bytes })]), { maxPages: 1 })
    expect(await readAnnotations(pdf)).toEqual([])
    expect((await readPdf(pdf)).pages[0]!.items).toEqual([])
    const text = Buffer.from(pdf).toString('latin1')
    for (const secret of secrets) expect(text).not.toContain(secret)
  })
})

describe("the renderer's own list of elements", () => {
  /** `text` as the check would hand it on, were the check wrong. */
  const vector = (text: string): Vector => ({ ...VECTOR, svg: text })

  // Were the cleaner to let something through, the renderer would still
  // hand the converter none of what 0030 found it acts on: an image's
  // file, text in a font pdfmake picks, a style sheet, a reference out of
  // the drawing, a link's annotation, an entity. The list is the
  // renderer's own, not report-spec's tables, so that the two must be
  // wrong together for one to reach pdfmake.
  test.each([
    ['a local image', 'the element image'],
    ['an embedded image', 'the element image'],
    ['text in CJK', 'a character that is not printable ASCII'],
    ['an imported style sheet', 'the element style'],
    ['an external style sheet', 'markup that is not an element'],
    ['a DOCTYPE declaring an entity', 'an entity'],
    ['an undeclared entity', 'an entity'],
    ['a use fan-out', 'the element use'],
    ['a foreign object', 'the element foreignObject'],
    ['a filter', 'the element filter'],
    ['a javascript link', 'the element a'],
    ['a script and a handler', 'the element script'],
    ['metadata, a title and a comment', 'markup that is not an element'],
  ])('refuses %s, as it came, before pdfmake sees it', (name, found) => {
    const threat = SVG_THREATS.find((each) => each.name === name)!
    const text = new TextDecoder().decode(threat.bytes)
    expect(() => svgContent(image(rawSvgAsset(threat.bytes, 'threat')), vector(text))).toThrow(
      new RenderRefusal('invalid-asset', `the image asset threat holds ${found}, which the renderer never hands pdfmake's SVG converter`, 'threat'),
    )
  })

  // A list that refused everything would pass every case above: every
  // drawing the cleaner writes passes it, element by element.
  test.each(Object.entries(DRAWINGS))('passes the drawing %s, cleaned', (_, text) => {
    const cleaned = cleanSvg(new TextEncoder().encode(text))
    expect(cleaned.ok && foreignMarkup(new TextDecoder().decode(cleaned.bytes))).toBeUndefined()
  })

  // The list is written here so that it and report-spec's tables must be
  // wrong together, but it may never refuse what the cleaner writes: an
  // element report-spec came to keep would be approved and then refused at
  // every print, and only a drawing that happened to hold one would show
  // it. So the list is report-spec's, element for element, and a change
  // there is decided here too.
  test("names the elements report-spec's cleaner writes, no more and no fewer", () => {
    expect([...DRAWN].sort()).toEqual([...SVG_ELEMENTS].sort())
  })
})

describe("the converter's callbacks", () => {
  /** `text` drawn by pdfmake's converter as the renderer would draw it, with the renderer's options and without its list of elements. */
  async function drawn(text: string): Promise<unknown> {
    // A render leaves pdfmake configured with the renderer's fonts and policies.
    await renderPdf(bareDocument('Configure', [paragraph('Configure')]), { maxPages: 1 })
    const node = { svg: text, width: 60, height: 60, options: converterOptions('unguarded', 'contain') }
    return pdfmake
      .createPdf({ content: [node] })
      .getBuffer()
      .then(
        () => 'drawn',
        (error: unknown) => error,
      )
  }

  // Past the list, an image's href reaches the converter, which would open
  // the file past pdfmake's local access policy (`pdfmake.test.ts`): its
  // image callback, which the converter asks before it opens anything,
  // refuses the asset instead, and nothing is read.
  test(
    'refuse an image, before its file is opened',
    async () => {
      const directory = mkdtempSync(path.join(tmpdir(), 'report-render-pdf-'))
      try {
        const file = path.join(directory, 'secret.png').split(path.sep).join('/')
        writeFileSync(
          file,
          encodePng(4, 4, () => [255, 0, 0]),
        )
        expect(await drawn(svg(`<image href="${file}" width="10" height="10"/>`))).toEqual(
          new RenderRefusal(
            'invalid-asset',
            "the image asset unguarded asks pdfmake's SVG converter to open an image, which the renderer never lets it do",
            'unguarded',
          ),
        )
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    },
    TIMEOUT,
  )

  // A drawing the converter cannot draw as written it draws otherwise,
  // saying so to the console alone (`pdfmake.test.ts`): its warning
  // refuses the asset instead, and repeats nothing the file held.
  test(
    'refuse a drawing the converter would warn about and draw on',
    async () => {
      const loop = svg(
        '<clipPath id="secret"><rect clip-path="url(#secret)" width="1" height="1"/></clipPath><rect width="10" height="10" clip-path="url(#secret)"/>',
      )
      const refusal = await drawn(loop)
      expect(refusal).toEqual(
        new RenderRefusal(
          'invalid-asset',
          "pdfmake's SVG converter could not draw the image asset unguarded as it was approved: it warned, and the renderer draws an SVG whole or not at all",
          'unguarded',
        ),
      )
      expect((refusal as Error).message).not.toContain('secret')
    },
    TIMEOUT,
  )

  // The converter's option is the asset's own to say how it is fitted;
  // what the drawing says of itself on its root the cleaner never writes.
  test('fit the drawing as the image is fitted', () => {
    expect(converterOptions('a', 'contain').preserveAspectRatio).toBe('xMidYMid meet')
    expect(converterOptions('a', 'cover').preserveAspectRatio).toBe('xMidYMid slice')
    expect(svgContent(image(svgAsset(DRAWINGS.mark!)), { ...VECTOR, width: 120, height: 120, svg: '<svg/>' })).toMatchObject({
      svg: '<svg/>',
      width: 60,
      height: 60,
    })
  })
})

describe('a drawing shrunk to the bound', () => {
  /** A drawing of a square, and of every page-sized group the bounds allow -- a clip, a group opacity, a translucent gradient -- under two groups of `scale` each. */
  const shrunk = (scale: string): string =>
    svg(
      `<clipPath id="c"><rect width="1" height="1"/></clipPath><linearGradient id="t"><stop/><stop offset="1" stop-opacity="0.5"/></linearGradient><rect width="100" height="100" fill="#264653"/>` +
        `<g transform="scale(${scale})"><g transform="scale(${scale})"><rect width="5" height="5" clip-path="url(#c)"/><g opacity="0.5"><rect width="5" height="5" fill="url(#t)"/></g></g></g>`,
    )

  // svg-to-pdfkit inverts the matrix a clip or a group opacity is drawn
  // under, to find the page's box in its user space; under four groups of
  // a millionth, approved as they were, PDFKit threw `unsupported number`
  // from inside pdfmake -- an error, not a refusal, which named no asset --
  // at every print of an asset the cleaner had approved. A drawing shrunk as
  // far as the bound allows draws, in a box of a point and in one the page's
  // width; the drawing shrunk past it, in the form the cleaner would have
  // written it, is refused at print as an invalid asset, naming it.
  test(
    'draws at the bound, and past it is refused as an invalid asset, never thrown',
    async () => {
      const asset = svgAsset(shrunk('0.001'), 'shrunk')
      for (const side of [1, 480]) {
        const pdf = await renderPdf(bareDocument('Shrunk', [{ kind: 'image', asset, width: side, height: side, fit: 'contain' }]), { maxPages: 1 })
        expect(await readAnnotations(pdf)).toEqual([])
      }
      // Four groups of a millionth, each written as the cleaner writes a group.
      const millionth = '<g transform="matrix(0.000001 0 0 0.000001 0 0)">'
      const past = new TextDecoder()
        .decode(asset.bytes)
        .replaceAll('<g transform="matrix(0.001 0 0 0.001 0 0)">', millionth.repeat(2))
        .replace('</svg>', '</g></g></svg>')
      expect(past.split(millionth)).toHaveLength(5)
      const refusal = await renderPdf(bareDocument('Past', [image(rawSvgAsset(past, 'shrunk'))]), { maxPages: 1 }).then(
        () => undefined,
        (error: unknown) => error,
      )
      expect(refusal).toBeInstanceOf(RenderRefusal)
      expect(refusal).toMatchObject({
        code: 'invalid-asset',
        subject: 'shrunk',
        message: expect.stringContaining('shrinks what it transforms, or flattens it'),
      })
    },
    TIMEOUT,
  )

  /** A page of `body` on A4 turned to landscape, its margins narrow: the widest box an image may have. */
  const landscape = (body: ImageAsset): Parameters<typeof renderPdf>[0] => ({
    ...bareDocument('Landscape', [{ kind: 'image', asset: body, width: 550, height: 550, fit: 'contain' }]),
    page: { size: 'A4', orientation: 'landscape', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
  })

  // PDFKit writes a gradient's pattern under the page's matrix, the
  // shape's, the shape's box and the gradient's own transform: a group
  // turned and scaled a millionfold, painting a shape a million wide with
  // a gradient of the same transform, threw `unsupported number: -1.1e+21`
  // from inside PDFKit in a box 550 points wide, an approved asset that
  // could never print. A gradient composed to the bound draws in that box;
  // that drawing, in the form the cleaner would have written it, is
  // refused at print as an invalid asset.
  test(
    'a gradient composed to the bound draws, and one past it is refused as an invalid asset, never thrown',
    async () => {
      const atBound = svgAsset(
        svg(
          '<linearGradient id="g"><stop/><stop offset="1" stop-color="#e76f51"/></linearGradient><g transform="scale(1000)"><rect width="1000" height="1000" fill="url(#g)"/></g>',
          '0 0 1 1',
        ),
        'gradient',
      )
      expect(await readAnnotations(await renderPdf(landscape(atBound), { maxPages: 1 }))).toEqual([])
      const turned = 'matrix(1000000 1000000 -1000000 1000000 0 0)'
      const past = svg(
        `<linearGradient id="g1" gradientTransform="${turned}"><stop/><stop offset="1" stop-color="#ff0000"/></linearGradient><g transform="${turned}"><rect width="1000000" height="1000000" fill="url(#g1)"/></g>`,
        '0 0 1 1',
      )
      const refusal = await renderPdf(landscape(rawSvgAsset(past, 'gradient')), { maxPages: 1 }).then(
        () => undefined,
        (error: unknown) => error,
      )
      expect(refusal).toBeInstanceOf(RenderRefusal)
      expect(refusal).toMatchObject({ code: 'invalid-asset', subject: 'gradient', message: expect.stringContaining('paints a gradient transformed past') })
    },
    TIMEOUT,
  )
})
