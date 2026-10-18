import { INVOICE, INVOICE_SAMPLES, readCodes, readPdf, starterImages, type PdfPage, type ReadPdf, type Starter } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { normalise, TIMEOUT } from './testing/documents.js'
import { crowding, markAt, markPixels, marksOn, MARGIN } from './testing/letterhead.js'
import { lineHas, pageLines, type Line } from './testing/lines.js'

/**
 * The corpus's invoice samples, end to end: the invoice starter's report
 * in German, French, Italian and English, each resolved by the runtime
 * against its own data, rendered by pdfmake and proved on the PDF it
 * produced (0003). The values are proved apart from the runtime: the total
 * is recomputed here in BigInt from the sample's lines and formatted with
 * Intl for the sample's locale, and the page must print exactly that; the
 * code is decoded by ZXing from the pixels PDF.js draws, and must ask for
 * the same amount. What each sample says in its language -- the locale
 * it formats in, its totals' labels, the words before its due date, and
 * the slip's headings, which are SIX's (IG Annex C) -- is stated here, not
 * read from the sample.
 */

const CREATED = '2026-10-15T08:00:00Z'

/** Cents as the exact decimal string they are. */
const decimal = (cents: bigint): string => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
const cents = (text: string): bigint => BigInt(text.replace('.', ''))

/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** An amount in Swiss francs as Intl prints it for `locale`, handed the exact decimal string, with its spaces as a PDF line has them. */
const francs = (locale: string, amount: bigint): string => normalise(new Intl.NumberFormat(locale, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(decimal(amount) as Intl.StringNumericLiteral))

/** A date of the data, `YYYY-MM-DD`, as Intl prints it for `locale` in `style`, in UTC as the runtime formats a date. */
const day = (locale: string, date: string, style: 'medium' | 'long'): string => normalise(new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)))

/** An amount as SIX's slip prints it in every language: a space between thousands, a point and two places (IG 3.5.3). */
const slipAmount = (amount: bigint): string => decimal(amount).replace(/\B(?=(\d{3})+\.)/g, ' ')

/** What each sample prints in its language: its locale, the totals' labels, the words before the due date, and the slip's two headings. */
const SAYS = {
  invoice: { locale: 'de-CH', subtotal: 'Zwischensumme', vat: 'MWST 8.1 %', total: 'Total', due: 'Zahlbar bis:', receipt: 'Empfangsschein', paymentPart: 'Zahlteil' },
  'invoice-fr': { locale: 'fr-CH', subtotal: 'Sous-total', vat: 'TVA 8,1 %', total: 'Total', due: 'Payable jusqu’au :', receipt: 'Récépissé', paymentPart: 'Section paiement' },
  'invoice-it': { locale: 'it-CH', subtotal: 'Subtotale', vat: 'IVA 8,1 %', total: 'Totale', due: 'Pagabile entro:', receipt: 'Ricevuta', paymentPart: 'Sezione pagamento' },
  'invoice-en': { locale: 'en-CH', subtotal: 'Subtotal', vat: 'VAT 8.1%', total: 'Total', due: 'Due date:', receipt: 'Receipt', paymentPart: 'Payment part' },
} as const

function resolved(sample: Starter): ResolvedDocument {
  const outcome = resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

/** Every line of the PDF, page by page, top to bottom. */
const linesOf = (pdf: ReadPdf): Line[] => pdf.pages.flatMap((page) => pageLines(page))

/** The lines that begin with `words`, as whole words. */
const startingWith = (pdf: ReadPdf, words: string): Line[] => linesOf(pdf).filter((line) => ` ${line.text} `.startsWith(` ${normalise(words)} `))

describe('the invoice samples', () => {
  // Each sample is an invoice a reader of its language pays from one page:
  // every line item once, in article order though the data sent them the
  // other way round, each amount in the locale's format; the subtotal, the
  // VAT and the total exactly what the reference computes, under the
  // sample's own labels, and the due date as the locale writes it; and the
  // code, decoded from the page's pixels, asking for exactly the total the
  // table prints, which both parts of the slip print too, under SIX's
  // headings in the sample's language and in no other's. A sample that
  // printed its total in another locale's format, a slip in the wrong
  // language, or a code asking for another amount than the page states
  // would each be shown as what the product does.
  test.each(INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const))('%s prints one page, its totals in its locale, and a slip in its language for exactly the printed total', async (id, sample) => {
    const says = SAYS[id as keyof typeof SAYS]
    const { locale } = says
    const chf = (amount: bigint): string => francs(locale, amount)
    const lines = [...(sample.data.detail as Record<string, string>[])].sort((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
    const subtotal = lines.reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
    const vat = halfAway(subtotal * 81n, 1000n)
    const total = subtotal + vat

    const document = resolved(sample)
    const bytes = await renderPdf(document, { maxPages: 20 })
    const pdf = await readPdf(bytes)
    expect(pdf.pages).toHaveLength(1)
    const found = lines.map((line) => startingWith(pdf, line['article'] as string))
    expect(found.map((each) => each.length)).toEqual(lines.map(() => 1))
    expect(found.map(([line], index) => line !== undefined && lineHas(line, chf(cents(lines[index]?.['amount'] as string))))).toEqual(lines.map(() => true))
    expect(startingWith(pdf, says.subtotal).map((line) => line.text)).toEqual([`${says.subtotal} ${chf(subtotal)}`])
    expect(startingWith(pdf, says.vat).map((line) => line.text)).toEqual([`${says.vat} ${chf(vat)}`])
    expect(startingWith(pdf, says.total).map((line) => line.text)).toEqual([`${says.total} ${chf(total)}`])
    expect(startingWith(pdf, says.due).map((line) => line.text)).toEqual([`${says.due} ${day(locale, sample.data.header?.['dueOn'] as string, 'medium')}`])

    const codes = await readCodes(bytes, 1)
    expect(codes.map((code) => code.text)).toEqual([document.paymentPart?.payload])
    const [amount, currency] = codes[0]?.text.split('\n').slice(18, 20) ?? []
    expect([amount, currency]).toEqual([decimal(total), 'CHF'])
    // The total the page prints, in the locale's format, is the amount the code asks for.
    expect(startingWith(pdf, says.total).map((line) => line.text)).toEqual([`${says.total} ${chf(cents(amount as string))}`])
    expect(pdf.pages[0]?.items.filter((item) => item.text === slipAmount(total)).length).toBe(2)
    const texts = new Set(pdf.pages[0]?.items.map((item) => item.text))
    expect([says.receipt, says.paymentPart].filter((heading) => !texts.has(heading))).toEqual([])
    const others = Object.values(SAYS).filter((other) => other !== says)
    expect(others.flatMap((other) => [other.receipt, other.paymentPart]).filter((heading) => texts.has(heading))).toEqual([])
  }, TIMEOUT)

  // The firm's mark heads the page (0032), and pushes nothing off it: the
  // page is one, and its slip and its code are where the test above holds
  // them. It is drawn as vectors at the margins' corner, 15 mm square, in
  // its blue and white and no other paint, with no image embedded for it,
  // nothing else on the page in its blue, and no text beside it or in the
  // 12 pt under it, the firm's line the first under it. A mark missing,
  // moved, scaled or recoloured, drawn twice, or crowding the line that
  // says whom the invoice is from would each show here.
  test.each(INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const))('%s prints the firm’s mark at the head of its page, above the line that says whom it is from', async (_id, sample) => {
    const pdf = await readPdf(await renderPdf(resolved(sample), { maxPages: 20 }))
    const [page] = pdf.pages as [PdfPage]
    expect(marksOn(page)).toEqual([markAt(MARGIN)])
    expect(page.images).toEqual([])
    expect(crowding(page, markAt(MARGIN))).toEqual([])
    expect(pageLines(page)[0]?.text).toMatch(/^Formancy /)
  }, TIMEOUT)

  // The operator list says the mark's paths stand inside a clip of its
  // box; that nothing of them shows past it is the pixels' to say (0030):
  // PDF.js draws the disc in its blue and the drop in white, and leaves the
  // paper white in a band 2 pt around the box, beside the slip's code.
  test('draws the mark inside its box and nothing of it past it, by its pixels', async () => {
    const bytes = await renderPdf(resolved(INVOICE), { maxPages: 20 })
    expect(await markPixels(bytes, markAt(MARGIN))).toEqual({ disc: '#1f4e79', drop: '#ffffff', around: [] })
  }, TIMEOUT)
})
