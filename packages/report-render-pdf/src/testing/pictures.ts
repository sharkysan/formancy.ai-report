import { GROUPED_EQUIPMENT, QUOTATION, rasterPage, readPdf, SERVICE_INSPECTION, STARTER_IMAGES, type Starter } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { renderPdf } from '../node.js'
import { pageLines } from './lines.js'

/**
 * The README's pictures: pages of the three starters, resolved by the
 * runtime, rendered by this package and drawn by PDF.js (`rasterPage`).
 * `scripts/readme-pictures.ts` writes them to `docs/images/` with a
 * manifest; `pictures.test.ts` holds each picture to the text of the page
 * it was drawn from, and the README's caption of it to that text.
 */

export interface PictureSpec {
  /** The file under `docs/images/`. */
  readonly file: string
  readonly starter: Starter
  readonly page: number
  /** The picture's caption, its alt text in the README. */
  readonly caption: string
  /** Lines the caption quotes, each of which the page prints. */
  readonly shows: readonly string[]
}

export const PICTURES: readonly PictureSpec[] = [
  {
    file: 'starter-quotation.png',
    starter: QUOTATION,
    page: 1,
    caption: "The quotation starter, an Offerte: line items in Swiss francs, then Zwischensumme, MWST 8.1 %, Rundung and Total CHF 3'143.00",
    shows: ['Offerte', "Total CHF 3'143.00"],
  },
  {
    file: 'starter-service-inspection.png',
    starter: SERVICE_INSPECTION,
    page: 2,
    caption: "The service inspection starter, page 2: the frame headed Defect found, the photo from the data, and the sign-off above Inspector's signature kept with it",
    shows: ['Defect found', "Inspector's signature"],
  },
  {
    file: 'starter-grouped-equipment.png',
    starter: GROUPED_EQUIPMENT,
    page: 1,
    caption: 'The equipment register starter, grouped by site: Basel (12 items) heads its group, and Subtotal Basel 12 closes it',
    shows: ['Basel (12 items)', 'Subtotal Basel 12'],
  },
]

/** Pixels to the point: 745 by 1053 pixels for an A4 page. */
export const SCALE = 1.25

/** The starter's page as a PNG, and the lines PDF.js reads on that page of the same PDF. */
export async function picture(spec: PictureSpec): Promise<{ readonly png: Uint8Array; readonly lines: readonly string[] }> {
  const pdf = await starterPdf(spec.starter)
  const page = (await readPdf(pdf)).pages[spec.page - 1]
  if (page === undefined) throw new RangeError(`${spec.starter.id} has no page ${spec.page}`)
  return { png: await rasterPage(pdf, spec.page, SCALE), lines: pageLines(page).map((line) => line.text) }
}

/** The starter's own data, resolved for a final render and rendered. */
export async function starterPdf(starter: Starter): Promise<Uint8Array> {
  const outcome = resolveReport(starter.report, starter.data, {
    mode: 'final',
    parameters: starter.parameters,
    images: (ref) => STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest),
    creationDate: '2026-10-15T08:00:00Z',
  })
  if (!outcome.ok) throw new Error(`${starter.id} was refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return renderPdf(outcome.document, { maxPages: 20 })
}
