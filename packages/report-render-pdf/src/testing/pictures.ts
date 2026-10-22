import {
  EURO_INVOICE,
  EURO_INVOICE_AT,
  EURO_INVOICE_ES,
  EURO_INVOICE_FR,
  EURO_INVOICE_IE,
  EURO_INVOICE_IT,
  EURO_INVOICE_NL,
  GROUPED_EQUIPMENT,
  INVOICE,
  INVOICE_EN,
  INVOICE_FR,
  INVOICE_IT,
  drawingsOn,
  QUOTATION,
  rasterPage,
  readPdf,
  SERVICE_INSPECTION,
  SITE_VISIT_STARTER,
  starterImages,
  type Drawing,
  type Starter,
} from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { renderPdf } from '../node.js'
import { pageLines } from './lines.js'

/**
 * The README's pictures: a page of each starter, and of each invoice
 * sample, resolved by the runtime, rendered by this package and drawn by
 * PDF.js (`rasterPage`). `scripts/readme-pictures.ts` writes them to
 * `docs/images/` with a manifest for each list, `pictures.json` for the
 * starters' and `samples.json` for the samples'; `pictures.test.ts` holds
 * each picture to the lines of the page it was drawn from, with where each
 * starts, and to its drawings, and the README's caption of it to those
 * lines.
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
    caption: "The quotation starter, an Offerte under the firm's mark: line items in Swiss francs, then Zwischensumme, MWST 8.1 %, Rundung and Total CHF 3'143.00",
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
    caption: "The invoice starter, a Rechnung under the firm's mark: its line items, then Zwischensumme, MWST 8.1 % and Total CHF 1'416.52, and across the foot of the page its QR-bill, the Empfangsschein and the Zahlteil with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Rechnung', "Total CHF 1'416.52", 'Empfangsschein', 'Zahlteil', 'CHF 1 416.52'],
  },
  {
    file: 'starter-euro-invoice.png',
    starter: EURO_INVOICE,
    page: 1,
    caption: "The euro invoice starter, a German Rechnung under the firm's mark: its line items in euro, then Nettobetrag, Umsatzsteuer 19 % and Rechnungsbetrag 1.132,44 €, and under them the Bankverbindung, IBAN: DE83 0123 4567 0012 3456 78, beside the EPC QR code that pays it",
    shows: ['Rechnung', 'Nettobetrag', 'Umsatzsteuer 19 %', 'Rechnungsbetrag 1.132,44 €', 'Bankverbindung', 'IBAN: DE83 0123 4567 0012 3456 78'],
  },
  {
    file: 'starter-site-visit.png',
    starter: SITE_VISIT_STARTER,
    page: 1,
    caption: 'The site visit starter, generated from version 2 of a formancy form: a line for each answer, from Objekt: Bahnhofplatz 1, 3011 Bern, the inspector, the ticked boxes and the matrix under their headings, Elektrik: [x] among them, the findings one table under Befunde, and the page counted, 1 / 1',
    shows: ['Objekt: Bahnhofplatz 1, 3011 Bern', 'Elektrik: [x]', 'Befunde', '1 / 1'],
  },
]

/**
 * The samples' pictures: the invoice's, in the order of `INVOICE_SAMPLES`,
 * then the euro invoice's, in the order of `EURO_INVOICE_SAMPLES`, each
 * but the German's: those samples are the starters, whose pictures are in
 * `PICTURES`. They have a manifest of their own because the Studio's
 * browser gate holds every picture `pictures.json` lists to a starter its
 * picker offers, and the samples are not offered there.
 */
export const SAMPLE_PICTURES: readonly PictureSpec[] = [
  {
    file: 'invoice-fr.png',
    starter: INVOICE_FR,
    page: 1,
    caption: "The invoice in French, a Facture under the firm's mark: its line items, then Sous-total, TVA 8,1 % and Total 1'416.52 CHF, and across the foot of the page its QR-bill, the Récépissé and the Section paiement with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Facture', 'Sous-total', 'TVA 8,1 %', "Total 1'416.52 CHF", 'Récépissé', 'Section paiement', 'CHF 1 416.52'],
  },
  {
    file: 'invoice-it.png',
    starter: INVOICE_IT,
    page: 1,
    caption: "The invoice in Italian, a Fattura under the firm's mark: its line items, then Subtotale, IVA 8,1 % and Totale CHF 1416.52, and across the foot of the page its QR-bill, the Ricevuta and the Sezione pagamento with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Fattura', 'Subtotale', 'IVA 8,1 %', 'Totale CHF 1416.52', 'Ricevuta', 'Sezione pagamento', 'CHF 1 416.52'],
  },
  {
    file: 'invoice-en.png',
    starter: INVOICE_EN,
    page: 1,
    caption: "The invoice in English, an Invoice under the firm's mark: its line items, then Subtotal, VAT 8.1% and Total CHF 1'416.52, and across the foot of the page its QR-bill, the Receipt and the Payment part with its Swiss QR Code, each for CHF 1 416.52",
    shows: ['Invoice', 'Subtotal', 'VAT 8.1%', "Total CHF 1'416.52", 'Receipt', 'Payment part', 'CHF 1 416.52'],
  },
  {
    file: 'euro-invoice-at.png',
    starter: EURO_INVOICE_AT,
    page: 1,
    caption: "The euro invoice from Austria, a Rechnung under the firm's mark: the boiler's parts, then Nettobetrag, USt 20 % and Gesamtbetrag € 629,44, and under them the Bankverbindung, IBAN: AT93 8012 3000 1234 5678, beside the EPC QR code in Austria's frame, Zahlen mit Code up its side",
    shows: ['Rechnung', 'Nettobetrag', 'USt 20 %', 'Gesamtbetrag € 629,44', 'Bankverbindung', 'IBAN: AT93 8012 3000 1234 5678', 'Zahlen mit Code'],
  },
  {
    file: 'euro-invoice-fr.png',
    starter: EURO_INVOICE_FR,
    page: 1,
    caption: "The euro invoice from France, a Facture under the firm's mark: the boiler's parts, then Total HT, TVA 20 % and Total TTC 629,44 €, and under them the Coordonnées bancaires, IBAN : FR76 0123 4000 1200 0123 4567 880, beside the EPC QR code that pays it",
    shows: ['Facture', 'Total HT', 'TVA 20 %', 'Total TTC 629,44 €', 'Coordonnées bancaires', 'IBAN : FR76 0123 4000 1200 0123 4567 880'],
  },
  {
    file: 'euro-invoice-it.png',
    starter: EURO_INVOICE_IT,
    page: 1,
    caption: "The euro invoice from Italy, a Fattura under the firm's mark: the boiler's parts, then Imponibile, IVA 22% and Totale fattura 639,93 €, the notice Copia di cortesia, and under them the Coordinate bancarie, IBAN: IT53 N000 0000 0120 0001 2345 678, beside the EPC QR code that pays it",
    shows: ['Fattura', 'Imponibile', 'IVA 22%', 'Totale fattura 639,93 €', 'Copia di cortesia', 'Coordinate bancarie', 'IBAN: IT53 N000 0000 0120 0001 2345 678'],
  },
  {
    file: 'euro-invoice-es.png',
    starter: EURO_INVOICE_ES,
    page: 1,
    caption: "The euro invoice from Spain, a Factura under the firm's mark: the boiler's parts, then Base imponible, IVA 21 % and Total factura 634,68 €, and under them the Datos bancarios, IBAN: ES25 0000 0012 7000 1234 5678, beside the EPC QR code that pays it",
    shows: ['Factura', 'Base imponible', 'IVA 21 %', 'Total factura 634,68 €', 'Datos bancarios', 'IBAN: ES25 0000 0012 7000 1234 5678'],
  },
  {
    file: 'euro-invoice-nl.png',
    starter: EURO_INVOICE_NL,
    page: 1,
    caption: "The euro invoice from the Netherlands, a Factuur under the firm's mark: the boiler's parts, then Totaal excl. btw, Btw 21% and Totaal incl. btw € 634,68, and under them the Bankgegevens, IBAN: NL17 FMNC 0123 4567 89, beside the EPC QR code that pays it",
    shows: ['Factuur', 'Totaal excl. btw', 'Btw 21%', 'Totaal incl. btw € 634,68', 'Bankgegevens', 'IBAN: NL17 FMNC 0123 4567 89'],
  },
  {
    file: 'euro-invoice-ie.png',
    starter: EURO_INVOICE_IE,
    page: 1,
    caption: "The euro invoice from Ireland, an Invoice under the firm's mark: the boiler's parts, then Subtotal, VAT 23% and Total due €645.17, and under them the Bank details, IBAN: IE30 FMNC 0000 0012 3456 78, beside the EPC QR code that pays it",
    shows: ['Invoice', 'Subtotal', 'VAT 23%', 'Total due €645.17', 'Bank details', 'IBAN: IE30 FMNC 0000 0012 3456 78'],
  },
]

/** Pixels to the point: 745 by 1053 pixels for an A4 page. */
export const SCALE = 1.25

/** Where a line starts on its page: its left edge and its top, to the hundredth of a point. */
export type Place = readonly [number, number]

const hundredth = (value: number): number => Math.round(value * 100) / 100

/**
 * The starter's page as a PNG, and what PDF.js reads on that page of the
 * same PDF: its lines, where each of them starts, in the same order, and
 * its drawings (report-corpus's `drawingsOn`).
 */
export async function picture(spec: PictureSpec): Promise<{ readonly png: Uint8Array; readonly lines: readonly string[]; readonly places: readonly Place[]; readonly drawings: readonly Drawing[] }> {
  const pdf = await starterPdf(spec.starter)
  const page = (await readPdf(pdf)).pages[spec.page - 1]
  if (page === undefined) throw new RangeError(`${spec.starter.id} has no page ${spec.page}`)
  const lines = pageLines(page)
  return { png: await rasterPage(pdf, spec.page, SCALE), lines: lines.map((line) => line.text), places: lines.map((line) => [hundredth(line.x), hundredth(line.top)] as const), drawings: drawingsOn(page) }
}

/** The starter's own data, resolved for a final render and rendered. */
export async function starterPdf(starter: Starter): Promise<Uint8Array> {
  const outcome = resolveReport(starter.report, starter.data, {
    mode: 'final',
    parameters: starter.parameters,
    images: starterImages,
    creationDate: '2026-10-15T08:00:00Z',
  })
  if (!outcome.ok) throw new Error(`${starter.id} was refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return renderPdf(outcome.document, { maxPages: 20 })
}
