/**
 * An image component lowered to the bytes it draws.
 *
 * An image shows an asset the template pins, or an image field of the
 * header dataset (0007). Either way it names an approved asset by its id
 * and digest, and the host's lookup hands over the bytes: the runtime never
 * follows an address and fetches nothing. What comes back is checked here --
 * bytes, and a media type a report may draw, the one the template declares
 * for its own asset -- and copied, so that nothing the host changes
 * afterwards reaches the document. Whether the bytes are a picture is the
 * renderer's to say (`invalid-asset`).
 *
 * The lookup is trusted to return the bytes the digest pins: the runtime has
 * no hash function of its own, being free of Node and of the DOM, and does
 * not check them against it.
 *
 * An image field with no value draws nothing, and its box is kept as space,
 * so that what follows it stands where it would with a picture: null prints
 * as nothing (0007), and nothing moves.
 *
 * Each approved asset is asked for once per render, and every image that
 * draws it shares the one copy, so that a logo on every page header, or a
 * photo drawn by forty components, is held and embedded once. An answer
 * past `MAX_ASSET_BYTES` is refused before it is copied.
 */
import { ASSET_MEDIA_TYPES } from '@formancy/report-spec'
import type { AssetMediaType, ImageComponent } from '@formancy/report-spec'
import { MAX_ASSET_BYTES } from './document.js'
import type { Image, ImageAsset, Spacer } from './document.js'
import { imageValue } from './render-context.js'
import type { ImageBytes, ImageRef, Render } from './render-context.js'
import type { ResolveErrorCode } from './resolve-errors.js'

/** Why an asset's bytes could not be had: the code, and what to say after the component's id. */
interface Refusal {
  readonly code: ResolveErrorCode
  readonly message: string
}

/** What the host handed over, if it is bytes of a media type a report draws, within the limit: copied. A string says why it is not. */
function checkedBytes(found: unknown, declared: AssetMediaType | undefined): { readonly mediaType: AssetMediaType; readonly bytes: Uint8Array } | string {
  const media = `is not bytes of ${declared === undefined ? ASSET_MEDIA_TYPES.join(' or ') : declared}`
  if (typeof found !== 'object' || found === null) return media
  const { mediaType, bytes } = found as Partial<ImageBytes>
  if (!(bytes instanceof Uint8Array) || !ASSET_MEDIA_TYPES.includes(mediaType as AssetMediaType)) return media
  if (declared !== undefined && mediaType !== declared) return media
  if (bytes.length > MAX_ASSET_BYTES) return `is ${bytes.length} bytes; an asset may have ${MAX_ASSET_BYTES} (20 MB)`
  return { mediaType: mediaType as AssetMediaType, bytes: new Uint8Array(bytes) }
}

/** The bytes of `ref`, asked of the host and checked, or why they could not be had. */
function fetched(render: Render, ref: ImageRef, declared: AssetMediaType | undefined): ImageAsset | Refusal {
  if (render.images === undefined) return { code: 'missing-asset', message: 'the report draws an image, and the host gave no way to fetch approved assets' }
  let found: unknown
  let bytes: ReturnType<typeof checkedBytes>
  try {
    // The answer is read inside the guard too: a getter on it is the host's code, and may throw.
    found = render.images(ref)
    bytes = checkedBytes(found, declared)
  } catch {
    return { code: 'asset-lookup-failed', message: `fetching the approved asset ${ref.asset} failed` }
  }
  if (found === undefined) return { code: 'missing-asset', message: `the host has no bytes for the approved asset ${ref.asset} at its digest` }
  if (typeof bytes === 'string') return { code: 'invalid-asset', message: `the host's answer for the approved asset ${ref.asset} ${bytes}` }
  return { id: ref.asset, ...bytes }
}

/** Each render's assets, by id, digest and the type declared for them: asked for once, and shared. */
const ASSETS = new WeakMap<Render, Map<string, ImageAsset | Refusal>>()

function assetOf(render: Render, ref: ImageRef, declared: AssetMediaType | undefined): ImageAsset | Refusal {
  const cache = ASSETS.get(render) ?? new Map<string, ImageAsset | Refusal>()
  ASSETS.set(render, cache)
  const key = JSON.stringify([ref.asset, ref.digest, declared ?? null])
  const known = cache.get(key)
  if (known !== undefined) return known
  const asset = fetched(render, ref, declared)
  cache.set(key, asset)
  return asset
}

/** `component`, at `path`, as the image it draws, the space it keeps when its field is null, or undefined when its bytes could not be had, which is recorded. */
export function imageBlock(render: Render, component: ImageComponent, path: string): Image | Spacer | undefined {
  const { source } = component
  let ref: ImageRef
  let declared: AssetMediaType | undefined
  if (source.kind === 'asset') {
    // report-spec refuses an image of an asset the report does not declare.
    const asset = render.report.assets.find(({ id }) => id === source.asset) as { readonly id: string; readonly mediaType: AssetMediaType; readonly digest: string }
    ref = { asset: asset.id, digest: asset.digest }
    declared = asset.mediaType
  } else {
    const value = imageValue(render, source.field)
    if (value === null) return { kind: 'spacer', height: component.height }
    ref = { asset: value.asset, digest: value.digest }
  }
  const asset = assetOf(render, ref, declared)
  if ('code' in asset) {
    render.problems.error({ stage: 'resolve', code: asset.code, path: `${path}/source`, message: `component ${component.id}: ${asset.message}`, componentId: component.id })
    return undefined
  }
  return { kind: 'image', asset, width: component.width, height: component.height, fit: component.fit }
}
