/**
 * Where the Studio keeps images: the starters' approved assets, which
 * cross into the page with them, and every image a person adds in either
 * builder (0033) -- in the page's memory and nowhere else, for as long as
 * the tab is open. Nothing is sent anywhere, and a reload forgets what was
 * added, with the sessions that declared it.
 *
 * One store for every starter's editor, and one lookup for every Preview
 * (0010): the bytes kept by their digest, so the same image added twice is
 * held once, and each asset the report may name by its id and digest, the
 * lookup answering only for a pair it was handed. Nothing is ever let go:
 * an undo takes the declaration back, and a redo gives it back, and the
 * Preview prints it again from the bytes kept here.
 */
import type { ImageStore } from '@formancy/report-builder-core'
import type { ImageResolver } from '@formancy/report-runtime'
import type { StudioImage } from '../starters/codec.js'

export interface StudioImages {
  /** The lookup a Preview hands the runtime: an image's bytes for an asset id and a digest held together. */
  readonly resolve: ImageResolver
  /** What every editor is made with: it keeps whatever a person adds, at once. */
  readonly store: ImageStore
}

/** An asset id and a digest, as one key: the digest's syntax holds no space. */
const pair = (asset: string, digest: string): string => `${digest} ${asset}`

export function studioImages(starters: readonly StudioImage[]): StudioImages {
  /** The bytes, by digest: what an asset is, whatever its id. */
  const bytes = new Map<string, Uint8Array>()
  /** Each asset id and digest the lookup answers for, and the type it was declared as. */
  const assets = new Map<string, string>()
  const hold = (asset: string, digest: string, mediaType: string, held: Uint8Array): void => {
    // A copy, so bytes changed after they were handed over never print.
    if (!bytes.has(digest)) bytes.set(digest, Uint8Array.from(held))
    assets.set(pair(asset, digest), mediaType)
  }
  for (const image of starters) hold(image.asset, image.digest, image.mediaType, image.bytes)
  return {
    resolve(ref) {
      const mediaType = assets.get(pair(ref.asset, ref.digest))
      const held = bytes.get(ref.digest)
      return mediaType === undefined || held === undefined ? undefined : { mediaType, bytes: held }
    },
    store: {
      async keep(image) {
        hold(image.asset, image.digest, image.mediaType, image.bytes)
        return { ok: true }
      },
    },
  }
}
