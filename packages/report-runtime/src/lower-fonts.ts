/**
 * A report's font map resolved to the bytes the renderer embeds (0043).
 *
 * The definition maps each font token to approved font assets, face by face
 * ([report-spec's `font-map.ts`](../../report-spec/src/font-map.ts)); here
 * the host's lookup hands over each face's bytes, as it does an image's
 * (0033), and the runtime reads them once with report-spec's `readFont`
 * before it hands them on, so that a font the renderer could not embed is
 * refused where the data is resolved, not deep inside the engine. The
 * renderer reads them again, since it is a package boundary that takes
 * resolved input and approved bytes and refuses what it cannot draw (0011);
 * what is read here is read there too, by the one reader.
 *
 * A font is structural, not a value: a token a report maps prints all its
 * text in that face, so a face whose bytes cannot be had, or that `readFont`
 * refuses, refuses the render -- in a preview too, since a preview that
 * dropped a mapped face would print its text in another font nobody chose
 * (fail closed). Each face is fetched once, however many tokens or weights
 * share one asset.
 *
 * Nothing here is shared with the host: the bytes are copied, as an image's
 * are, so that what the host changes afterwards never reaches the document.
 */
import { FONT_FACE_KEYS, isFontMediaType, MAX_FONT_BYTES, readFont } from '@formancy/report-spec'
import type { AssetRef, FontFaceKey, FontFamily, FontMap } from '@formancy/report-spec'
import type { FontAsset, ResolvedFaces, ResolvedFonts } from './document.js'
import type { ImageBytes, Render } from './render-context.js'

/** The faces of one family, by key: what `resolveFaces` builds. */
type Faces = { -readonly [K in FontFaceKey]?: FontAsset }

/**
 * `fonts` resolved to the bytes each face prints in, or undefined when the
 * report maps nothing. A face that cannot be had or that `readFont` refuses
 * records an error and resolves nothing for that face; the caller refuses
 * the render when any error was recorded.
 */
export function resolveFonts(render: Render, fonts: FontMap | undefined): ResolvedFonts | undefined {
  if (fonts === undefined) return undefined
  const byId = new Map<string, FontAsset | undefined>()
  const result: { -readonly [F in FontFamily]?: ResolvedFaces } = {}
  for (const [family, faces] of Object.entries(fonts) as [FontFamily, FontMap[FontFamily]][]) {
    if (faces === undefined) continue
    const resolved: Faces = {}
    for (const key of FONT_FACE_KEYS) {
      const id = faces[key]
      if (id === undefined) continue
      const asset = faceAsset(render, byId, id, `/fonts/${family}/${key}`)
      if (asset !== undefined) resolved[key] = asset
    }
    // `normal` is required by the validator; a resolution that reached here without it has recorded the error that stops the render.
    if (resolved.normal !== undefined) result[family] = resolved as ResolvedFaces
  }
  return result
}

/** The bytes of the face asset `id`, fetched once and kept, checked with `readFont`; undefined when it could not be had, which is recorded at `path`. */
function faceAsset(render: Render, byId: Map<string, FontAsset | undefined>, id: string, path: string): FontAsset | undefined {
  if (byId.has(id)) return byId.get(id)
  const asset = fetchFace(render, id, path)
  byId.set(id, asset)
  return asset
}

/** What the host holds for the font asset `id`, copied and read, or undefined with an error recorded at `path`. */
function fetchFace(render: Render, id: string, path: string): FontAsset | undefined {
  const error = (code: 'missing-asset' | 'invalid-asset' | 'asset-lookup-failed', message: string): undefined => {
    render.problems.error({ stage: 'resolve', code, path, message })
    return undefined
  }
  if (render.images === undefined) return error('missing-asset', `the report maps a font, and the host gave no way to fetch approved assets`)
  // report-spec refuses a font map that names an undeclared asset, so the ref is one the report declares.
  const declared = render.report.assets.find((ref) => ref.id === id) as AssetRef
  let found: ImageBytes | undefined
  try {
    found = render.images({ asset: declared.id, digest: declared.digest })
  } catch {
    return error('asset-lookup-failed', `fetching the approved font ${id} failed`)
  }
  if (found === undefined) return error('missing-asset', `the host has no bytes for the approved font ${id} at its digest`)
  if (typeof found !== 'object' || !(found.bytes instanceof Uint8Array) || !isFontMediaType(found.mediaType)) {
    return error('invalid-asset', `the host's answer for the approved font ${id} is not bytes of ${declared.mediaType}`)
  }
  if (found.bytes.length > MAX_FONT_BYTES)
    return error('invalid-asset', `the approved font ${id} is ${found.bytes.length} bytes; a font may have ${MAX_FONT_BYTES}`)
  const bytes = new Uint8Array(found.bytes)
  const read = readFont(bytes)
  if (!read.ok) return error('invalid-asset', `the approved font ${id}: the font ${read.message}`)
  return { id, digest: declared.digest, bytes }
}
