import { createHash } from 'node:crypto'
import type { ReportDefinition } from '@formancy/report-runtime'
import { SVG_MARK } from '../fixtures/svg.js'
import type { StarterImage } from './starter.js'

/**
 * The firm's mark (0032): what the QR-bill invoice, the euro invoice and
 * the quotation, their samples and the e-invoice samples print at the top
 * left of their first page, above the line that says whom they are from.
 * Every one of their firms is an invented "Formancy" of a trade, so one
 * mark serves them all, and the firm's invoices differ in nothing but
 * their words (0024, 0028).
 *
 * It is the corpus's own mark (`SVG_MARK`, 0030), invented here and
 * imitating no firm's: a deep-blue disc with a white gable stroked over a
 * white drop, for a building's services and its water. It holds no word,
 * which a page's text could not show and which could read as a name; no
 * cross, which the Swiss cross and the red cross make a protected sign and
 * the QR-bill's slip already prints; no square, which beside a QR code
 * reads as a finder pattern; and none of the room's violet or teal, since
 * the page is the document and not the room. Its bytes are the drawing
 * `cleanSvg` writes of it as a drawing program saved it (`SVG_AS_SAVED`),
 * written out so that a reviewer reads what prints, and approved as any
 * asset is: by the digest of exactly these bytes, which a host hands over
 * when the runtime asks for `logo` (`STARTER_IMAGES`).
 */

/** The mark, as the host approved it: the bytes `cleanSvg` writes, named by their SHA-256. */
export const LOGO: StarterImage = {
  asset: 'logo',
  digest: `sha256:${createHash('sha256').update(SVG_MARK).digest('hex')}`,
  mediaType: 'image/svg+xml',
  bytes: SVG_MARK,
}

/** The mark as a report declares it: an approved asset by its id, media type and digest (0007). */
export const LOGO_ASSET: ReportDefinition['assets'][number] = { id: LOGO.asset, mediaType: LOGO.mediaType, digest: LOGO.digest }

/**
 * The head of a letter of the firm's: the mark 15 mm square, 42.52 pt to
 * the hundredth, drawn whole by `contain` into a box of its own
 * proportions, then 12 pt before the sender's line. It stands first in the
 * report header, so that it prints once, at the margins' corner of the
 * first page, as a letterhead does, and never as a running head; an image
 * has no alignment of its own, so the top right would need a columns row
 * (0032).
 */
export const LETTERHEAD: readonly ReportDefinition['regions']['reportHeader'][number][] = [
  { id: 'logo', kind: 'image', source: { kind: 'asset', asset: LOGO.asset }, width: 42.52, height: 42.52, fit: 'contain' },
  { id: 'logo-gap', kind: 'spacer', height: 12 },
]
