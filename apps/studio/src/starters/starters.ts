/**
 * The reports the Studio opens: the corpus's starters, plan 7's three
 * (R19), the invoice with its QR-bill and the invoice with its EPC QR code,
 * each with its synthetic data, and a blank report to build from nothing.
 */
import type { ImageResolver } from '@formancy/report-runtime'
import { emptyReport } from '@formancy/report-spec'
import type { StudioImage, StudioStarter } from './codec.js'

/** An empty A4 page, nothing declared: what Blank opens, with the data envelope of a report that reads none. */
export const BLANK: StudioStarter = {
  id: 'blank',
  title: 'Blank report',
  proves: 'nothing yet: an empty page to build on',
  report: emptyReport('blank', 'Blank report', 'en-GB'),
  data: { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' },
  parameters: {},
}

/** The corpus's starters, in its order, then Blank. */
export function studioStarters(corpus: readonly StudioStarter[]): readonly StudioStarter[] {
  return [...corpus, BLANK]
}

/** What the picker calls a starter, from its id: 'grouped-equipment' is "Grouped equipment". */
export function starterLabel(starter: Pick<StudioStarter, 'id'>): string {
  const words = starter.id.replaceAll('-', ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

/**
 * The host's lookup of approved assets (0010): the bytes for an asset only
 * when both its id and its digest are the ones held.
 */
export function imagesOf(images: readonly StudioImage[]): ImageResolver {
  return (ref) => {
    const found = images.find((image) => image.asset === ref.asset && image.digest === ref.digest)
    return found === undefined ? undefined : { mediaType: found.mediaType, bytes: found.bytes }
  }
}
