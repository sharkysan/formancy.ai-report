/*
 * An image a person adds (0033), from the packed packages under Node: the
 * entry points the editor reads a file with, and the editor adding one.
 * consume.ts runs it and prints what it returns; it lives apart because
 * consume.ts stood at its size budget when it came.
 *
 * - report-spec's `assetDigest` is the SHA-256 node:crypto takes, as the
 *   digest the quotation declares its mark by, so a host that takes its
 *   own digest, with Node or Web Crypto, keys what the editor hands it by
 *   the same one; and the runtime hands on report-spec's own image
 *   readers and limits, not copies;
 * - an editor made with a host's store reads a PNG -- the scenarios', from
 *   the packed builder-core -- recognises it from its bytes, hands the
 *   store its id, digest and bytes, and only then declares it, in one
 *   step; refuses a GIF named as a PNG before the store hears of it; and
 *   offers Add image… only with a store.
 */
import { assetDigest, emptyReport, imageHeader, MAX_ASSET_BYTES, MAX_ASSET_SIDE, sniffImage } from '@formancy/report-spec'
import {
  imageHeader as runtimeImageHeader,
  MAX_ASSET_BYTES as RUNTIME_MAX_ASSET_BYTES,
  MAX_ASSET_SIDE as RUNTIME_MAX_ASSET_SIDE,
  sniffImage as runtimeSniffImage,
} from '@formancy/report-runtime'
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import { createReportEditor, SCENARIO_PNG, SCENARIO_PNG_DIGEST } from '@formancy/report-builder-core'
import type { AddedImage, EditorOutcome, ImageFile, ImageStore } from '@formancy/report-builder-core'
import { createHash } from 'node:crypto'
import { logo } from './quotation.js'

/** A file a person chose, as a builder hands it on: its name, its size and its bytes. */
const chosen = (name: string, bytes: Uint8Array): ImageFile => ({ name, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer })

const sha256 = (bytes: Uint8Array): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

/** A session over a blank letter, with nothing declared. */
function letter(): ReportSession {
  const opening = openReportSession(emptyReport('letter', 'Brief', 'de-CH'))
  if (!opening.ok) throw new Error('a blank report did not open a session')
  return opening.session
}

/** Checks the images a person adds from the packed packages; throws on the first wrong, and says what held. */
export async function addedImages(): Promise<string> {
  for (const [what, bytes, expected] of [
    ['the quotation’s mark', logo.bytes, logo.digest],
    ['the scenarios’ PNG', SCENARIO_PNG, SCENARIO_PNG_DIGEST],
    ['no bytes', new Uint8Array(0), sha256(new Uint8Array(0))],
  ] as const) {
    if (assetDigest(bytes) !== sha256(bytes) || assetDigest(bytes) !== expected)
      throw new Error(`report-spec's assetDigest of ${what} is not node:crypto's SHA-256`)
  }
  if (
    runtimeSniffImage !== sniffImage ||
    runtimeImageHeader !== imageHeader ||
    RUNTIME_MAX_ASSET_BYTES !== MAX_ASSET_BYTES ||
    RUNTIME_MAX_ASSET_SIDE !== MAX_ASSET_SIDE
  ) {
    throw new Error("the runtime's image readers and limits are not report-spec's own")
  }
  const header = imageHeader(SCENARIO_PNG)
  if (sniffImage(SCENARIO_PNG) !== 'image/png' || !header.ok || header.width !== 2 || header.height !== 1)
    throw new Error('the scenarios’ PNG was not read as a PNG of 2 by 1 pixels')

  const session = letter()
  const offered: AddedImage[] = []
  const store: ImageStore = {
    accept: ['image/png'],
    async keep(image) {
      // Kept before the report declares it: the session has no such asset yet.
      if (session.document().assets.length > 0) throw new Error('the report declared the image before the host kept it')
      offered.push(image)
      return { ok: true }
    },
  }
  const editor = createReportEditor(session, { locale: 'de-CH', images: store })
  if (!editor.state().images.store || editor.state().images.accept !== 'image/png,.png')
    throw new Error('an editor made with a store does not offer Add image… for what the store keeps')
  const gif: EditorOutcome = await editor.addImage(chosen('logo.png', Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b])))
  if (gif.ok || gif.code !== 'not-an-image' || offered.length > 0) throw new Error('a GIF named as a PNG was not refused before the store heard of it')
  const added = await editor.addImage(chosen('Logo Müller AG.png', SCENARIO_PNG))
  const [kept] = offered
  if (
    !added.ok ||
    offered.length !== 1 ||
    kept?.asset !== 'logo-muller-ag' ||
    kept.digest !== SCENARIO_PNG_DIGEST ||
    sha256(kept.bytes) !== SCENARIO_PNG_DIGEST
  )
    throw new Error('the PNG was not handed to the store by its id, its digest and its bytes')
  if (
    JSON.stringify(session.document().assets) !== JSON.stringify([{ id: 'logo-muller-ag', mediaType: 'image/png', digest: SCENARIO_PNG_DIGEST }]) ||
    session.undoLabel() === undefined
  )
    throw new Error('the PNG kept was not declared, in one step')
  editor.dispatch({ type: 'undo' })
  if (session.document().assets.length !== 0 || offered.length !== 1) throw new Error('an undo did not take the declaration back alone')
  editor.dispose()
  const bare = createReportEditor(letter())
  if (bare.state().images.store) throw new Error('an editor made without a store offers Add image…')
  bare.dispose()
  return `report-spec's assetDigest was node:crypto's SHA-256 and the runtime's image readers report-spec's own; an editor with a host's store refused a GIF named as a PNG before the store heard of it, handed it a PNG read from its bytes as logo-muller-ag at its digest, declared it in one step only then, and one without a store offered no Add image…`
}
