/**
 * The report's font map, validated (0043): which approved font assets each
 * font token prints in, face by face, and whether the faces a report's own
 * styles ask for are mapped.
 *
 * A face names an asset the report declares, whose media type is a font's:
 * an undeclared id is `unknown-asset`, and an image asset mapped as a face
 * is `asset-not-a-font`. Nothing here reads a font's bytes -- a face is a
 * reference, resolved by the deployment -- so what is checked is the
 * mapping's shape and its references, as for every asset a report names.
 *
 * `missing-face` is the one rule that reads a style against the map: a
 * print style that sets `bold` or `italic` for a mapped family without that
 * family's bold, italic or bold-italic face. A face is never synthesised
 * (plan 20), so a report whose heading is bold in a mapped family that has
 * no bold face could not print, and the author hears so while editing. What
 * the renderer prints bold of its own -- a table's header and total rows --
 * it holds to the map at print, where the data decides which faces a run
 * needs.
 */
import { isFontMediaType } from './assets.js'
import { optional, quote, reference, shape } from './check.js'
import { faceKey } from './font-map.js'
import type { FontFaceKey, FontFaces, FontMap } from './font-map.js'
import { at } from './pointer.js'
import { FONT_FAMILIES } from './styles.js'
import type { PrintStyle } from './styles.js'
import { resolve } from './validate-context.js'
import type { Ctx } from './validate-context.js'

/** The faces of a family a report may map, `normal` required and the rest optional, read in `FONT_FACE_KEYS`' order. */
function readFaces(c: Ctx, value: unknown, path: string): FontFaces | undefined {
  const o = shape(c.f, value, path, ['normal'], ['bold', 'italic', 'boldItalic'])
  const face = (key: FontFaceKey): string | undefined => {
    const asset = reference(c.f, o?.[key], at(path, key))
    if (asset === undefined) return undefined
    const mediaType = resolve(c.f, c.declared.assets, asset, at(path, key), 'unknown-asset', 'asset')
    if (mediaType !== undefined && !isFontMediaType(mediaType))
      c.f.report(at(path, key), 'asset-not-a-font', `the asset ${quote(asset)} is an image, not a font`)
    return asset
  }
  const normal = face('normal')
  const bold = face('bold')
  const italic = face('italic')
  const boldItalic = face('boldItalic')
  if (o === undefined || normal === undefined) return undefined
  return { normal, ...optional('bold', bold), ...optional('italic', italic), ...optional('boldItalic', boldItalic) }
}

/** The font map in `value`, its families read in `FONT_FAMILIES`' order; absent is no map. */
export function readFontMap(c: Ctx, value: unknown, path: string): FontMap | undefined {
  if (value === undefined) return undefined
  const o = shape(c.f, value, path, [], FONT_FAMILIES)
  if (o === undefined) return undefined
  const map: { -readonly [F in keyof FontMap]: FontFaces } = {}
  let complete = true
  for (const family of FONT_FAMILIES) {
    if (o[family] === undefined) continue
    const faces = readFaces(c, o[family], at(path, family))
    if (faces === undefined) complete = false
    else map[family] = faces
  }
  return complete ? map : undefined
}

/**
 * Reports a `missing-face` for each print style that sets a weight or a
 * slant its mapped family has no face for: the style names the family and
 * the face, the face is read from the style's own `bold` and `italic`, and
 * `boldItalic` is the face a style that is both needs.
 */
export function checkMissingFaces(c: Ctx, styles: readonly PrintStyle[] | undefined, fonts: FontMap | undefined, path: string): void {
  if (styles === undefined || fonts === undefined) return
  styles.forEach((style, index) => {
    if (style.font === undefined) return
    const faces = fonts[style.font]
    if (faces === undefined) return
    const key = faceKey(style.bold === true, style.italic === true)
    if (key === 'normal' || faces[key] !== undefined) return
    c.f.report(at(path, index), 'missing-face', `the style ${quote(style.id)} prints ${WHICH[key]} in the ${style.font} font, which maps no ${key} face`)
  })
}

/** What a style asks for, for a message a person reads. */
const WHICH: { readonly [K in Exclude<FontFaceKey, 'normal'>]: string } = { bold: 'bold text', italic: 'italic text', boldItalic: 'bold italic text' }
