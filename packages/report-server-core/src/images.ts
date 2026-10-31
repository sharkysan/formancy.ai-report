import { assetDigest, checkSvg, imageHeader, isDigest, MAX_ASSET_BYTES, MAX_SVG_BYTES, sniffImage } from '@formancy/report-spec'
import { can } from './actions.js'
import { answer, refuse } from './answer.js'
import type { Answer, RefusalAnswer } from './answer.js'
import type { Asking } from './drafts.js'
import type { StoredImage } from './store.js'
import { REFUSALS } from './wire.js'
import type { ImageKept } from './wire.js'

/**
 * The image use cases (0049): keeping and reading the images a draft's
 * assets name. A keep reads the bytes before a store sees them, as the
 * renderer will read them at print, so that nothing is kept that no report
 * could print and a digest in a report always names the bytes it pinned.
 * The order of the checks is the order of the code, and every one refuses
 * what the ones before it let through.
 */

/**
 * Whether `digestHex` is a digest as a path carries one: the 64 lower-case
 * hexadecimal digits of a SHA-256, without the `sha256:` a report writes
 * before them. Judged by report-spec's `isDigest` with the prefix put back,
 * the one rule a store names a file by, so that nothing this lets through
 * is a digest the store refuses.
 */
const isDigestHex = (digestHex: string): boolean => isDigest(`sha256:${digestHex}`)

/**
 * Keeps an image under the digest of its bytes, for the asking tenant. An
 * SVG is kept only in the form report-spec's `cleanSvg` writes, which a
 * builder has already made of it; a PNG or JPEG only as the renderer reads
 * it. The media type kept is the one the bytes sniff as, which the request's
 * `Content-Type` must name, and the answer is the same for a second keep of
 * the same image.
 */
export async function keepImage(asking: Asking, digestHex: string, contentType: string, bytes: Uint8Array): Promise<Answer<ImageKept> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'asset.keep', roles)) return refuse(403, REFUSALS.forbidden)
  if (!isDigestHex(digestHex)) return refuse(400, REFUSALS['digest-invalid'])
  if (bytes.length > MAX_ASSET_BYTES) return refuse(413, REFUSALS['image-too-large'])
  const kind = sniffImage(bytes)
  if (kind === undefined) return refuse(422, { ...REFUSALS['image-refused'], reason: 'not-an-image' })
  const [claimed = ''] = contentType.split(';')
  if (claimed.trim().toLowerCase() !== kind) return refuse(415, REFUSALS['unsupported-media-type'])
  if (kind === 'image/svg+xml') {
    if (bytes.length > MAX_SVG_BYTES) return refuse(413, REFUSALS['image-too-large'])
    const checked = checkSvg(bytes)
    if (!checked.ok) return refuse(422, { ...REFUSALS['image-refused'], reason: checked.code })
  } else {
    const header = imageHeader(bytes)
    if (!header.ok) return refuse(422, { ...REFUSALS['image-refused'], reason: header.code })
  }
  const digest = `sha256:${digestHex}`
  if (assetDigest(bytes) !== digest) return refuse(422, REFUSALS['digest-mismatch'])
  await store.keepImage(identity.tenant, digest, { mediaType: kind, bytes })
  return answer(200, { digest })
}

/** The asking tenant's image under `digestHex`, as it was kept. */
export async function readImage(asking: Asking, digestHex: string): Promise<Answer<StoredImage> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'asset.read', roles)) return refuse(403, REFUSALS.forbidden)
  if (!isDigestHex(digestHex)) return refuse(400, REFUSALS['digest-invalid'])
  const image = await store.readImage(identity.tenant, `sha256:${digestHex}`)
  if (image === undefined) return refuse(404, REFUSALS['no-asset'])
  return answer(200, image)
}
