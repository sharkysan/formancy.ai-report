import type { ContentSvg } from 'pdfmake/interfaces.js'
import { RenderRefusal, type Image } from '@formancy/report-runtime'
import type { Vector } from './assets.js'

/**
 * An SVG asset as pdfmake draws it (0030): the drawing `checkSvg` accepted,
 * handed to the SVG converter pdfmake 0.3.11 vendors, svg-to-pdfkit, as the
 * very text that was approved, in the image's box. The converter fits the
 * drawing's viewBox into the box itself, centred: `contain` is its
 * `xMidYMid meet`, all of the drawing as large as the box allows, and
 * `cover` its `xMidYMid slice`, the box filled and what falls outside it
 * clipped by the outer svg's viewport, which the converter clips to
 * (`pdfmake.test.ts` holds both). Nothing is drawn outside the box.
 *
 * What decides is the check: bytes that are not exactly what `cleanSvg`
 * writes never get this far (`assets.ts`). Two guards stand behind it, so
 * that a bug in the cleaner does not reach the converter as it would a
 * customer's file:
 *
 * - **The renderer's own list of elements.** Before it is handed on, the
 *   text is held to the elements a cleaned drawing may hold, written here
 *   and not taken from report-spec's tables, so that the two would have to
 *   be wrong together: printable ASCII, no entity, and every tag one of
 *   `DRAWN`. A link, an image, text, `use`, a style sheet, a comment or a
 *   DOCTYPE is refused.
 * - **Callbacks that throw.** The converter would open an `<image>`'s file
 *   past pdfmake's local access policy, or a virtual file in a browser, and
 *   draws on past what it cannot read, saying so only to the console. Its
 *   `imageCallback` and `warningCallback` throw instead, and its
 *   `documentCallback` is left unset, so that it follows no reference out of
 *   the drawing. They do not stop a link: the converter writes a link
 *   annotation for an `<a>` whatever its callbacks say (`pdfmake.test.ts`),
 *   which is why the list above refuses one.
 */

/** The elements of a drawing in the form `cleanSvg` writes (0030), the renderer's own copy: it may refuse more than report-spec's tables, never less, and `svg-threats.test.ts` holds it to them. */
export const DRAWN: ReadonlySet<string> = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
])

/** A tag's name as a refusal may repeat it: short, and nothing but a name's characters. */
const NAME = /^[A-Za-z][A-Za-z0-9:._-]{0,63}$/

/**
 * What in `svg` the renderer never hands the converter, or nothing: a
 * character that is not printable ASCII, an entity, or a tag -- an end tag,
 * a comment, a DOCTYPE or a processing instruction among them -- that is
 * not one of `DRAWN`.
 */
export function foreignMarkup(svg: string): string | undefined {
  if (/[^\x20-\x7e]/.test(svg)) return 'a character that is not printable ASCII'
  if (svg.includes('&')) return 'an entity'
  for (const [, name = ''] of svg.matchAll(/<\/?([^\s/>]*)/g)) {
    if (!DRAWN.has(name)) return NAME.test(name) ? `the element ${name}` : 'markup that is not an element'
  }
  return undefined
}

/** What pdfmake's SVG converter is handed beside the drawing, which pdfmake 0.3.11 passes on (`Renderer.renderSVG`) and its types do not declare. */
export interface ConverterOptions {
  readonly preserveAspectRatio?: string
  readonly imageCallback?: (href: string) => never
  readonly warningCallback: (warning: string) => never
}

/** An SVG node with options for pdfmake's SVG converter. */
export type ConvertedSvg = ContentSvg & { readonly options: ConverterOptions }

/**
 * The converter's options for the asset `id` drawn as `fit` says: the
 * viewBox fitted into the box, and both callbacks refusing the asset.
 * Neither repeats what the converter was handed: a callback is what holds
 * only where the check has failed, and then the drawing may hold anything
 * -- a file's path, an id, a word -- which the converter's warnings quote.
 */
export function converterOptions(id: string, fit: Image['fit']): ConverterOptions {
  return {
    preserveAspectRatio: fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
    imageCallback: () => {
      throw new RenderRefusal('invalid-asset', `the image asset ${id} asks pdfmake's SVG converter to open an image, which the renderer never lets it do`, id)
    },
    warningCallback: () => {
      throw new RenderRefusal(
        'invalid-asset',
        `pdfmake's SVG converter could not draw the image asset ${id} as it was approved: it warned, and the renderer draws an SVG whole or not at all`,
        id,
      )
    },
  }
}

/** The drawings that have passed the list: one in a page region is built anew for every page, and read once. */
const PASSED = new WeakSet<Vector>()

/** `image`, an SVG whose drawing the checks read as `vector`, as pdfmake's node: the drawing in the image's box, guarded and under the converter's options. */
export function svgContent(image: Image, vector: Vector): ConvertedSvg {
  const { id } = image.asset
  if (!PASSED.has(vector)) {
    const foreign = foreignMarkup(vector.svg)
    if (foreign !== undefined)
      throw new RenderRefusal('invalid-asset', `the image asset ${id} holds ${foreign}, which the renderer never hands pdfmake's SVG converter`, id)
    PASSED.add(vector)
  }
  return { svg: vector.svg, width: image.width, height: image.height, options: converterOptions(id, image.fit) }
}
