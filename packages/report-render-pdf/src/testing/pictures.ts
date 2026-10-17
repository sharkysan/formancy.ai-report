import { EURO_INVOICE, GROUPED_EQUIPMENT, INVOICE, INVOICE_EN, INVOICE_FR, INVOICE_IT, QUOTATION, rasterPage, readPdf, SERVICE_INSPECTION, STARTER_IMAGES, type Starter } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { renderPdf } from '../node.js'
import { pageLines } from './lines.js'

/**
 * The README's pictures: a page of each starter, and of each invoice
 * sample, resolved by the runtime, rendered by this package and drawn by
 * PDF.js (`rasterPage`). `scripts/readme-pictures.ts` writes them to
 * `docs/images/` with a manifest for each list, `pictures.json` for the
 * starters' and `samples.json` for the samples'; `pictures.test.ts` holds
 * each picture to the text of the page it was drawn from, and the
 * README's caption of it to that text.
 */

export interface PictureSpec {
  /** The file under `docs/images/`. */
  readonly file: string
  /** The starter, or the sample in a starter's shape, it is a page of. */
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
  {
    file: 'starter-invoice.png',
    starter: INVOICE,
    page: 1,
    caption: "The invoice starter, a Rechnung: its line items, then Zwischensumme, MWST 8.1 % and Total CHF 1'416.52, and across the foot of the page its QR-bill, the Empfangsschein and the Zahlteil with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Rechnung', "Total CHF 1'416.52", 'Empfangsschein', 'Zahlteil', 'CHF 1 416.52'],
  },
  {
    file: 'starter-euro-invoice.png',
    starter: EURO_INVOICE,
    page: 1,
    caption: 'The euro invoice starter, a German Rechnung: its line items in euro, then Nettobetrag, Umsatzsteuer 19 % and Rechnungsbetrag 1.132,44 €, and under them the Bankverbindung, IBAN: DE83 0123 4567 0012 3456 78, beside the EPC QR code that pays it',
    shows: ['Rechnung', 'Nettobetrag', 'Umsatzsteuer 19 %', 'Rechnungsbetrag 1.132,44 €', 'Bankverbindung', 'IBAN: DE83 0123 4567 0012 3456 78'],
  },
]

/**
 * The invoice samples' pictures, in the order of `INVOICE_SAMPLES`, but
 * the German's: that sample is the invoice starter, whose picture is in
 * `PICTURES`. They have a manifest of their own because the Studio's
 * browser gate holds every picture `pictures.json` lists to a starter its
 * picker offers, and the samples are not offered there.
 */
export const SAMPLE_PICTURES: readonly PictureSpec[] = [
  {
    file: 'invoice-fr.png',
    starter: INVOICE_FR,
    page: 1,
    caption: "The invoice in French, a Facture: its line items, then Sous-total, TVA 8,1 % and Total 1'416.52 CHF, and across the foot of the page its QR-bill, the Récépissé and the Section paiement with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Facture', 'Sous-total', 'TVA 8,1 %', "Total 1'416.52 CHF", 'Récépissé', 'Section paiement', 'CHF 1 416.52'],
  },
  {
    file: 'invoice-it.png',
    starter: INVOICE_IT,
    page: 1,
    caption: 'The invoice in Italian, a Fattura: its line items, then Subtotale, IVA 8,1 % and Totale CHF 1416.52, and across the foot of the page its QR-bill, the Ricevuta and the Sezione pagamento with its Swiss QR Code, each for CHF 1 416.52',
    shows: ['Fattura', 'Subtotale', 'IVA 8,1 %', 'Totale CHF 1416.52', 'Ricevuta', 'Sezione pagamento', 'CHF 1 416.52'],
  },
  {
    file: 'invoice-en.png',
    starter: INVOICE_EN,
    page: 1,
    caption: "The invoice in English, an Invoice: its line items, then Subtotal, VAT 8.1% and Total CHF 1'416.52, and across the foot of the page its QR-bill, the Receipt and the Payment part with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Invoice', 'Subtotal', 'VAT 8.1%', "Total CHF 1'416.52", 'Receipt', 'Payment part', 'CHF 1 416.52'],
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
