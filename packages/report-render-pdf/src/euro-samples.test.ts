import {
  epcCodes,
  EURO_INVOICE_AT,
  EURO_INVOICE_SAMPLES,
  readCodes,
  readPdf,
  starterImages,
  type PdfCode,
  type PdfPage,
  type ReadPdf,
  type Starter,
} from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { normalise, TIMEOUT } from './testing/documents.js'
import { crowding, markAt, markPixels, marksOn, MARGIN } from './testing/letterhead.js'
import { lineHas, pageLines, type Line } from './testing/lines.js'

/**
 * The corpus's euro invoice samples, end to end: the euro starter and its
 * six samples from Austria, France, Italy, Spain, the Netherlands and
 * Ireland, each resolved by the runtime against its own data, rendered by
 * pdfmake and proved on the PDF it produced (0003). The values are proved
 * apart from the runtime: each total is recomputed here in BigInt at the
 * rate this test states, and formatted with Intl for the locale this test
 * states, and the page must print exactly that; the code is decoded by
 * ZXing from the pixels PDF.js draws, and must ask for the same amount.
 * What each sample says -- its totals' labels, the words before its due
 * date, before each payment detail, and its customer's lines -- is stated
 * here, not read from the sample (0024's lesson: a test that reads its
 * expectations from the sample passes whatever the sample says).
 *
 * The EPC QR code's page rests on these: its card "beside the details it
 * holds" on the details found beside each decoded code, its card "proved
 * on the PDF it produced" on every sample decoded to the amount it
 * prints, and its card on Austria's frame on the caption read back here
 * on the Austrian sample alone (0028).
 */

const CREATED = '2026-10-15T08:00:00Z'

/** What each sample prints in its words: its locale, its rate in whole percent, its totals' labels, the words before its due date and before each detail beside the code, and its customer's lines. */
const SAYS = {
  'euro-invoice': {
    locale: 'de-DE',
    rate: 19n,
    labels: ['Nettobetrag', 'Umsatzsteuer 19 %', 'Rechnungsbetrag'],
    due: 'Zahlbar bis:',
    details: ['Empfänger:', 'IBAN:', 'BIC:', 'Betrag:', 'Referenz:'],
    address: ['Erika Mustermann', 'Heidestraße 17', '51147 Köln'],
  },
  'euro-invoice-at': {
    locale: 'de-AT',
    rate: 20n,
    labels: ['Nettobetrag', 'USt 20 %', 'Gesamtbetrag'],
    due: 'Zahlbar bis:',
    details: ['Empfänger:', 'IBAN:', 'BIC:', 'Betrag:', 'Zahlungsreferenz:'],
    address: ['Max Mustermann', 'Hauptstraße 12', '4600 Wels'],
  },
  'euro-invoice-fr': {
    locale: 'fr-FR',
    rate: 20n,
    labels: ['Total HT', 'TVA 20 %', 'Total TTC'],
    due: 'Échéance :',
    details: ['Bénéficiaire :', 'IBAN :', 'BIC :', 'Montant :', 'Référence :'],
    address: ['Jean Dupont', '12 rue de la République', '69002 Lyon'],
  },
  'euro-invoice-it': {
    locale: 'it-IT',
    rate: 22n,
    labels: ['Imponibile', 'IVA 22%', 'Totale fattura'],
    due: 'Scadenza:',
    details: ['Beneficiario:', 'IBAN:', 'BIC:', 'Importo:', 'Riferimento:'],
    address: ['Mario Rossi', 'Via Roma, 15', '10121 Torino'],
  },
  'euro-invoice-es': {
    locale: 'es-ES',
    rate: 21n,
    labels: ['Base imponible', 'IVA 21 %', 'Total factura'],
    due: 'Vencimiento:',
    details: ['Beneficiario:', 'IBAN:', 'BIC:', 'Importe:', 'Referencia:'],
    address: ['Carmen Española Española', 'Calle Mayor, 12', '46001 Valencia'],
  },
  'euro-invoice-nl': {
    locale: 'nl-NL',
    rate: 21n,
    labels: ['Totaal excl. btw', 'Btw 21%', 'Totaal incl. btw'],
    due: 'Vervaldatum:',
    details: ['Begunstigde:', 'IBAN:', 'BIC:', 'Bedrag:', 'Betalingskenmerk:'],
    address: ['Jan Jansen', 'Kerkstraat 12', '3511 LX Utrecht'],
  },
  'euro-invoice-ie': {
    locale: 'en-IE',
    rate: 23n,
    labels: ['Subtotal', 'VAT 23%', 'Total due'],
    due: 'Due date:',
    details: ['Payee:', 'IBAN:', 'BIC:', 'Amount:', 'Reference:'],
    address: ['Joe Bloggs', '14 Main Street', 'Ennis, Co. Clare'],
  },
} as const

/** Austria's caption, as the PSA words it (PSA v3.0 5). */
const CAPTION = 'Zahlen mit Code'

/** Cents as the exact decimal string they are. */
const decimal = (cents: bigint): string => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
const cents = (text: string): bigint => BigInt(text.replace('.', ''))

/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** An amount in euro as Intl prints it for `locale`, handed the exact decimal string, with its spaces as a PDF line has them. */
const euros = (locale: string, amount: bigint): string =>
  normalise(
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      decimal(amount) as Intl.StringNumericLiteral,
    ),
  )

/** A date of the data, `YYYY-MM-DD`, as Intl prints it for `locale` in the medium style, in UTC as the runtime formats a date. */
const day = (locale: string, date: string): string =>
  normalise(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)))

/** An IBAN or a creditor reference as a person reads it: in groups of four. */
const grouped = (code: string): string => code.replace(/(.{4})(?=.)/g, '$1 ')

/** Every line of the PDF, page by page, top to bottom. */
const linesOf = (pdf: ReadPdf): Line[] => pdf.pages.flatMap((page) => pageLines(page))

/** The lines that begin with `words`, as whole words. */
const startingWith = (pdf: ReadPdf, words: string): Line[] => linesOf(pdf).filter((line) => ` ${line.text} `.startsWith(` ${normalise(words)} `))

interface Printed {
  readonly document: ResolvedDocument
  readonly bytes: Uint8Array
  readonly pdf: ReadPdf
  readonly codes: readonly PdfCode[]
}

/** Each sample resolved, rendered, read back and decoded once, for every case that asks about it. */
const printed = new Map<string, Promise<Printed>>()
function print(sample: Starter): Promise<Printed> {
  const cached = printed.get(sample.id)
  if (cached !== undefined) return cached
  const made = (async () => {
    const outcome = resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, images: starterImages, creationDate: CREATED })
    if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
    const bytes = await renderPdf(outcome.document, { maxPages: 20 })
    return { document: outcome.document, bytes, pdf: await readPdf(bytes), codes: await readCodes(bytes, 1) }
  })()
  printed.set(sample.id, made)
  return made
}

const samples = EURO_INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const)

describe('the euro invoice samples', () => {
  // Each sample is an invoice a reader of its country pays from one page:
  // every line once, in article order though the data sent them the other
  // way round, each amount in the locale's format; the net amount, the tax
  // and the total exactly what the reference computes, under the sample's
  // own labels; the due date as the locale writes it; the customer's lines
  // in the country's order; and one code, decoded from the page's pixels at
  // level M in a version the EPC allows, asking for exactly the total the
  // table prints, with whom it pays, the IBAN, the BIC, the amount and the
  // reference printed beside it, right of it and within its height, in the
  // sample's words. A sample that printed its total in another locale's
  // format, a label in another language, or a code asking for another
  // amount than the page states would each be shown as what the product
  // does.
  test.each(samples)(
    '%s prints one page, its totals in its locale, and a code for exactly the printed total beside the details it holds',
    async (id, sample) => {
      const says = SAYS[id as keyof typeof SAYS]
      const eur = (amount: bigint): string => euros(says.locale, amount)
      const lines = [...(sample.data.detail as Record<string, string>[])].sort((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
      const net = lines.reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
      const tax = halfAway(net * says.rate, 100n)
      const total = net + tax

      const { document, pdf, codes } = await print(sample)
      expect(pdf.pages).toHaveLength(1)
      const found = lines.map((line) => startingWith(pdf, line['article'] as string))
      expect(found.map((each) => each.length)).toEqual(lines.map(() => 1))
      expect(found.map(([line], index) => line !== undefined && lineHas(line, eur(cents(lines[index]?.['amount'] as string))))).toEqual(lines.map(() => true))
      const [netIs, taxIs, totalIs] = says.labels
      expect([netIs, taxIs, totalIs].map((label) => startingWith(pdf, label).map((line) => line.text))).toEqual([
        [`${netIs} ${eur(net)}`],
        [`${taxIs} ${eur(tax)}`],
        [`${totalIs} ${eur(total)}`],
      ])
      expect(startingWith(pdf, says.due).map((line) => line.text)).toEqual([`${says.due} ${day(says.locale, sample.data.header?.['dueOn'] as string)}`])
      expect(says.address.map((words) => startingWith(pdf, words).length)).toEqual([1, 1, 1])

      expect(codes.map((code) => [code.text, code.ecLevel])).toEqual(epcCodes(document.body).map((resolved) => [resolved.payload, 'M']))
      const [code] = codes as [PdfCode]
      expect(code.version).toBeLessThanOrEqual(13)
      const [, , , , bic, name, iban, amount, , reference] = code.text.split('\n')
      expect(amount).toBe(`EUR${decimal(total).replace(/\.?0+$/, '')}`)
      const [paidTo, ibanIs, bicIs, amountIs, referenceIs] = says.details
      const details = [
        `${paidTo} ${name}`,
        `${ibanIs} ${grouped(iban as string)}`,
        `${bicIs} ${bic}`,
        `${amountIs} ${eur(total)}`,
        `${referenceIs} ${grouped(reference as string)}`,
      ]
      expect(details.map((words) => startingWith(pdf, words).map((line) => line.text))).toEqual(details.map((words) => [words]))
      const beside = details
        .flatMap((words) => startingWith(pdf, words))
        .filter((line) => line.x > code.x + code.width && line.bottom > code.top && line.top < code.bottom)
      expect(beside.map((line) => line.text)).toEqual(details)
      expect(code.x + code.width).toBeLessThan((pdf.pages[0]?.width as number) / 2)
      expect(code.top).toBeGreaterThan(startingWith(pdf, totalIs)[0]?.bottom as number)
    },
    TIMEOUT,
  )

  // Austria's sample wears the PSA's frame, and it alone: "Zahlen mit
  // Code" read back as a turned run, up the right side of the symbol and
  // left of the details, within the symbol's height. The caption on
  // another country's code would print Austria's words on its invoice;
  // its absence on Austria's would print a code the PSA frames otherwise.
  test.each(samples)(
    '%s wears Austria’s frame only if it is the Austrian sample',
    async (id, sample) => {
      const { pdf, codes } = await print(sample)
      const [code] = codes as [PdfCode]
      const captions = pdf.pages[0]?.items.filter((item) => normalise(item.text) === CAPTION) ?? []
      const details = startingWith(pdf, SAYS[id as keyof typeof SAYS].details[0])
      expect(
        captions.map((caption) => [
          caption.angle,
          caption.x >= code.x + code.width,
          caption.x + caption.width < (details[0]?.x as number),
          caption.top >= code.top - 1,
          caption.bottom <= code.bottom + 1,
        ]),
      ).toEqual(id === 'euro-invoice-at' ? [[90, true, true, true, true]] : [])
    },
    TIMEOUT,
  )

  // pdfmake draws a character its face has no glyph for as nothing, and the
  // renderer refuses such a document before it draws it (glyphs.ts), so
  // each sample printing at all is each of its locales' characters in
  // Roboto, and no text read back needs looking at for one. fr-FR groups a
  // thousand with U+202F, which Roboto lacks: the samples keep every amount
  // under a thousand, and no amount on a page prints a grouping mark.
  test.each(samples.slice(1))(
    '%s prints in its locale with no glyph missing, and no amount with a grouping mark',
    async (_id, sample) => {
      expect(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format('1000.00' as Intl.StringNumericLiteral)).toContain(' ')
      const { pdf } = await print(sample)
      const items = pdf.pages.flatMap((page) => page.items.map((item) => item.text))
      expect(items.filter((text) => /\d[\u202f\u00a0.,']\d{3}[,.]\d{2}/u.test(text))).toEqual([])
    },
    TIMEOUT,
  )

  // The firm's mark heads the page (0032), and pushes nothing off it: the
  // page is one, and its code stands beside its details, as the first test
  // holds. It is drawn as vectors at the margins' corner, 15 mm square, in
  // its blue and white and no other paint, with no image embedded for it,
  // nothing else on the page in its blue, and no text beside it or in the
  // 12 pt under it, the firm's line the first under it. A mark missing,
  // moved, scaled or recoloured, drawn twice, or crowding the line that
  // says whom the invoice is from would each show here.
  test.each(samples)(
    '%s prints the firm’s mark at the head of its page, above the line that says whom it is from',
    async (_id, sample) => {
      const { pdf } = await print(sample)
      const [page] = pdf.pages as [PdfPage]
      expect(marksOn(page)).toEqual([markAt(MARGIN)])
      expect(page.images).toEqual([])
      expect(crowding(page, markAt(MARGIN))).toEqual([])
      expect(pageLines(page)[0]?.text).toMatch(/^Formancy /)
    },
    TIMEOUT,
  )

  // That nothing of the mark shows past its box is the pixels' to say
  // (0030): on the Austrian sample, whose code wears the PSA's frame, PDF.js
  // draws the disc in its blue and the drop in white, and leaves the paper
  // white in a band 2 pt around the box.
  test(
    'draw the mark inside its box and nothing of it past it, by its pixels',
    async () => {
      const { bytes } = await print(EURO_INVOICE_AT)
      expect(await markPixels(bytes, markAt(MARGIN))).toEqual({ disc: '#1f4e79', drop: '#ffffff', around: [] })
    },
    TIMEOUT,
  )
})
