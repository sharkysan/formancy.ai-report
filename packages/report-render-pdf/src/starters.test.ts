import {
  equipmentData,
  GROUPED_EQUIPMENT,
  INSPECTION_PHOTO,
  inspectionData,
  INVOICE,
  invoiceData,
  QUOTATION,
  quotationData,
  readCodes,
  readPdf,
  SERVICE_INSPECTION,
  STARTER_IMAGES,
  verify,
  type ReadPdf,
  type Starter,
} from '@formancy/report-corpus'
import { PREVIEW_LABEL, RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { ImageRef, ImageResolver, ReportData, ResolvedDocument, ResolveOptions } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { fixtureOf, normalise, TIMEOUT, type Stated } from './testing/documents.js'
import { lineHas, pageLines, type Line } from './testing/lines.js'

/**
 * The three starters of plan 7 and the invoice with its QR-bill, end to end: each definition resolved by the
 * runtime against its synthetic data, rendered by pdfmake, and proved on the
 * PDF it produced, read back with PDF.js (0003) -- never on the document the
 * renderer was given. The corpus's checks prove the layout: every row once
 * and in its place, the header on every page, the footer numbering, nothing
 * over a margin or over other text. The values are proved apart from the
 * runtime: each total is recomputed here in plain BigInt from the data, and
 * formatted with Intl, and the PDF must print exactly that.
 */

const CREATED = '2026-10-15T08:00:00Z'

/** The in-test host: it holds the starters' approved images by id and digest, and records what it was asked for. */
function host(): { readonly images: ImageResolver; readonly asked: ImageRef[] } {
  const asked: ImageRef[] = []
  const images: ImageResolver = (ref) => {
    asked.push(ref)
    return STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest)
  }
  return { images, asked }
}

/** `starter` resolved against `data`, failing the test with the errors when it is refused. */
function resolved(starter: Starter, data: ReportData, options: Partial<ResolveOptions> = {}): ResolvedDocument {
  const outcome = resolveReport(starter.report, data, { mode: 'final', parameters: starter.parameters, images: host().images, creationDate: CREATED, ...options })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

async function printed(document: ResolvedDocument, maxPages = 20): Promise<ReadPdf> {
  return readPdf(await renderPdf(document, { maxPages }))
}

/** Every line of the PDF, page by page, top to bottom. */
const linesOf = (pdf: ReadPdf): Line[] => pdf.pages.flatMap((page) => pageLines(page))

/** The number of the page a line starting with `words` is first printed on; undefined when none is. */
const pageWith = (pdf: ReadPdf, words: string): number | undefined => pdf.pages.find((page) => pageLines(page).some((line) => ` ${line.text} `.startsWith(` ${normalise(words)} `)))?.number

/** The lines that begin with `words`, as whole words. */
const startingWith = (pdf: ReadPdf, words: string): Line[] => linesOf(pdf).filter((line) => ` ${line.text} `.startsWith(` ${normalise(words)} `))

/** Cents as the exact decimal string they are. */
const decimal = (cents: bigint): string => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
const cents = (text: string): bigint => BigInt(text.replace('.', ''))

/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** An amount in Swiss francs as Intl prints it for `locale`, handed the exact decimal string, with its spaces as a PDF line has them. */
const francs = (locale: string, amount: bigint): string => normalise(new Intl.NumberFormat(locale, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(decimal(amount) as Intl.StringNumericLiteral))

describe('the service inspection report', () => {
  const NOTES = Array.from({ length: 60 }, (_, index) => `N${String(index + 1).padStart(2, '0')}:`)
  const DEFECT = 'The belt of the exhaust fan is cracked and must be replaced within 30 days.'

  // An inspection's long notes flow over pages whole and in order, its
  // defect is framed where it was found, its photo is drawn at its box from
  // the bytes the host holds -- asked for by id and digest, never fetched --
  // and every page says which of how many it is.
  test('prints every note once and in order, the defect, the photo, the signature lines, and Page n of N', async () => {
    const { images, asked } = host()
    const document = resolved(SERVICE_INSPECTION, inspectionData({ defect: true }), { images })
    expect(asked).toEqual([{ asset: INSPECTION_PHOTO.asset, digest: INSPECTION_PHOTO.digest }])
    const pdf = await printed(document)
    const stated: Stated = { minPagesExpected: 2, maxPagesExpected: 4, keys: [...NOTES, 'Defect found', 'Photo'], exactText: ["Inspector's signature", 'Place and date'], wrappedText: [DEFECT] }
    expect(verify(fixtureOf('service-inspection', document, stated), pdf)).toEqual([])
    expect(pdf.pages.length).toBeGreaterThanOrEqual(2)
    expect(pdf.pages.map((page) => pageLines(page).at(-1)?.text)).toEqual(pdf.pages.map((page) => `Page ${page.number} of ${pdf.pages.length}`))
    expect(pdf.pages.flatMap((page) => page.images).map(({ width, height }) => [Math.round(width), Math.round(height)])).toEqual([[240, 180]])
  }, TIMEOUT)

  // The sign-off stood alone on a last page, under nothing it signed, when
  // the notes filled the page before (23 to 27 notes, and 70 to 74). The
  // photo and the sentence it signs now stand on its page, wherever the
  // notes end.
  test('never leaves the signature lines alone on a page', async () => {
    const alone: number[] = []
    for (const notes of [20, 22, 23, 24, 25, 26, 27, 28, 30, 70, 71, 72, 73, 74]) {
      const pdf = await printed(resolved(SERVICE_INSPECTION, inspectionData({ notes })))
      const signed = pageWith(pdf, "Inspector's signature")
      if (signed === undefined || signed !== pageWith(pdf, 'Photo') || signed !== pageWith(pdf, 'Inspected as recorded above by')) alone.push(notes)
    }
    expect(alone).toEqual([])
  }, TIMEOUT)

  // A visit without a photo printed the 'Photo' heading over 180pt of
  // nothing; it prints neither, and the sentence and the signature lines
  // still stand together.
  test('prints no photo heading and no empty box without a photo', async () => {
    const pdf = await printed(resolved(SERVICE_INSPECTION, inspectionData({ photo: false })))
    expect(pageWith(pdf, 'Photo')).toBeUndefined()
    expect(pdf.pages.flatMap((page) => page.images)).toEqual([])
    expect(pageWith(pdf, 'Inspected as recorded above by')).toBe(pageWith(pdf, "Inspector's signature"))
  }, TIMEOUT)

  // The defect section prints only when there is a defect: without one,
  // neither its heading nor its frame's text is anywhere in the PDF, and
  // nothing else moves out of place.
  test('leaves the defect section out when no defect was found', async () => {
    const document = resolved(SERVICE_INSPECTION, inspectionData({ defect: false }))
    const pdf = await printed(document)
    expect(verify(fixtureOf('service-inspection-clear', document, { minPagesExpected: 2, maxPagesExpected: 4, keys: NOTES }), pdf)).toEqual([])
    expect(linesOf(pdf).filter((line) => line.text.includes('Defect') || line.text.includes('exhaust fan'))).toEqual([])
  }, TIMEOUT)
})

describe('the quotation', () => {
  const LINES = 45
  const data = quotationData(LINES)
  const lines = [...(data.detail as Record<string, string>[])].sort((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
  const chf = (amount: bigint): string => francs('de-CH', amount)

  // The independent reference: the subtotal is the sum of the supplied
  // amounts; VAT is 8.1 % of it, rounded half away to the centime; the
  // total is subtotal and VAT, rounded half away to 0.05; the rounding line
  // is what that took or added, so that the lines add up to the total.
  const subtotal = lines.reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
  const vat = halfAway(subtotal * 81n, 1000n)
  const total = halfAway(subtotal + vat, 5n) * 5n
  const rounding = total - subtotal - vat

  // Every line item once, in article order though the provider sent them
  // the other way round, its amount exactly the supplier's in Swiss francs;
  // the table's header repeated on every page it reaches; the totals
  // exactly what the reference computes; and "Seite n von N" on every page.
  test('prints every line item once in order with its exact amount, and totals as the reference computes them', async () => {
    const document = resolved(QUOTATION, data)
    const pdf = await printed(document)
    expect(verify(fixtureOf('quotation', document, { minPagesExpected: 2, maxPagesExpected: 6 }), pdf)).toEqual([])
    const found = lines.map((line) => startingWith(pdf, line['article'] as string))
    expect(found.map((each) => each.length)).toEqual(lines.map(() => 1))
    expect(found.map(([line], index) => line !== undefined && lineHas(line, chf(cents(lines[index]?.['amount'] as string))))).toEqual(lines.map(() => true))
    const articles = linesOf(pdf).flatMap((line) => (/^A-\d{4}\b/.exec(line.text) ?? []).map((match) => match))
    expect(articles).toEqual(lines.map((line) => line['article']))
    expect(startingWith(pdf, 'Zwischensumme').map((line) => line.text)).toEqual([`Zwischensumme ${chf(subtotal)}`])
    expect(startingWith(pdf, 'MWST 8.1 %').map((line) => line.text)).toEqual([`MWST 8.1 % ${chf(vat)}`])
    expect(startingWith(pdf, 'Rundung').map((line) => line.text)).toEqual([`Rundung ${chf(rounding)}`])
    expect(startingWith(pdf, 'Total').map((line) => line.text)).toEqual([`Total ${chf(total)}`])
    expect(rounding).not.toBe(0n)
    // The grand total stands out from the lines above it: set larger, as its style says, not only in the weight every total row has.
    const size = (words: string): number | undefined => pdf.pages.flatMap((page) => page.items).find((item) => item.text.startsWith(words))?.height
    expect(size('Total')).toBeGreaterThan(size('Zwischensumme') as number)
    expect(startingWith(pdf, 'Formancy Haustechnik AG').map((line) => line.text)).toEqual(['Formancy Haustechnik AG · Industriestrasse 7, 3052 Zollikofen · CHE-123.456.789 MWST'])
    expect(pdf.pages.map((page) => pageLines(page).filter((line) => line.text === 'Artikel Beschreibung Menge Einheit Preis Betrag').length)).toEqual(pdf.pages.map(() => 1))
    expect(pdf.pages.map((page) => pageLines(page).at(-1)?.text)).toEqual(pdf.pages.map((page) => `Seite ${page.number} von ${pdf.pages.length}`))
  }, TIMEOUT)

  // A quotation of 31 lines printed its subtotal and VAT under the last
  // line and its total alone on the next page; at 32 all three stood alone
  // there, under the repeated header. Wherever the page ends, the totals
  // stand on the page of the last line item.
  test('keeps its totals on the page of the last line item, wherever the page ends', async () => {
    const apart: string[] = []
    for (const count of [27, 28, 29, 30, 31, 32, 33, 34, 35, 64, 65, 66, 67, 68, 69, 70]) {
      const document = resolved(QUOTATION, quotationData(count))
      const pdf = await printed(document)
      expect(verify(fixtureOf(`quotation-${count}`, document, { maxPagesExpected: 6 }), pdf)).toEqual([])
      const last = `A-${1000 + count}`
      const pages = ['Zwischensumme', 'MWST 8.1 %', 'Rundung', 'Total'].map((words) => pageWith(pdf, words))
      if (pages.some((page) => page !== pageWith(pdf, last))) apart.push(`${count}: ${pages.join(',')} / ${pageWith(pdf, last)}`)
    }
    expect(apart).toEqual([])
  }, TIMEOUT)

  // 'CHF 1'250'000.00' in a column too narrow for it printed 'CHF
  // 1'250'000.0' with '0' on the next line. An amount prints on one line,
  // whole, or the report is refused; the starter's columns hold seven
  // digits.
  test('prints a seven-digit amount whole, on one line', async () => {
    const data = quotationData(3)
    const big = { article: 'A-2001', description: 'Gesamtsanierung Lüftung', quantity: '1.00', unit: 'Pausch.', unitPrice: '1250000.00', amount: '1250000.00' }
    const detail = [...(data.detail as Record<string, string>[]), big]
    const pdf = await printed(resolved(QUOTATION, { ...data, detail, completeness: { complete: true, captured: detail.length } }))
    expect(startingWith(pdf, 'A-2001').map((line) => line.text)).toEqual([`A-2001 Gesamtsanierung Lüftung 1.00 Pausch. ${chf(125000000n)} ${chf(125000000n)}`])
  }, TIMEOUT)

  // A job too big for its page limit is refused, never cut short: no PDF
  // of the first pages of a quotation with the totals missing.
  test('refuses a quotation too long for its page limit', async () => {
    const document = resolved(QUOTATION, quotationData(600))
    await expect(renderPdf(document, { maxPages: 5 })).rejects.toSatisfy((error) => error instanceof RenderRefusal && error.code === 'too-many-pages')
  }, TIMEOUT)
})

describe('the equipment register', () => {
  const data = equipmentData(40)
  const rows = data.detail as Record<string, string>[]
  const chf = (amount: bigint): string => francs('en-GB', amount)
  /** The sites in the order an English reader sorts them, each with its rows' tags in order, its count and its exact sum. */
  const sites = [...new Set(rows.map((row) => row['site'] as string))]
    .sort(new Intl.Collator('en-GB').compare)
    .map((site) => {
      const own = rows.filter((row) => row['site'] === site)
      return { site, tags: own.map((row) => row['tag'] as string).sort(), count: own.length, sum: own.reduce((sum, row) => sum + cents(row['value'] as string), 0n) }
    })

  // Grouped by site in a stable order: each group headed by its own key and
  // count, its rows by tag, its subtotal and count exactly its rows', and a
  // grand total that is every row's -- though the provider sent the rows
  // mixed, newest first.
  test('groups by site, heads each group with its key, and counts and totals each exactly', async () => {
    const document = resolved(GROUPED_EQUIPMENT, data)
    const pdf = await printed(document)
    expect(verify(fixtureOf('grouped-equipment', document, { minPagesExpected: 1, maxPagesExpected: 4 }), pdf)).toEqual([])
    expect(sites).toHaveLength(4)
    // Groups that count alike could not show a group's count was its own.
    expect(new Set(sites.map(({ count }) => count)).size).toBe(4)
    const order = sites.flatMap(({ site, tags, count }) => [`${site} (${count} items)`, ...tags, `Subtotal ${site}`])
    const printedOrder = linesOf(pdf).flatMap((line) => order.filter((key) => ` ${line.text} `.startsWith(` ${key} `)))
    expect(printedOrder).toEqual(order)
    for (const { site, count, sum } of sites) expect(startingWith(pdf, `Subtotal ${site}`).map((line) => line.text)).toEqual([`Subtotal ${site} ${count} ${chf(sum)}`])
    const grand = sites.reduce((sum, site) => sum + site.sum, 0n)
    expect(startingWith(pdf, 'Grand total').map((line) => line.text)).toEqual([`Grand total ${rows.length} ${chf(grand)}`])
  }, TIMEOUT)

  // A subtotal stood alone at the top of a page under the repeated header,
  // apart from every row it adds up, and the grand total alone on a last
  // page. Wherever a page ends, each subtotal is on the page of its group's
  // last row, and the grand total on the page of the last subtotal.
  test('keeps each subtotal with its last row, and the grand total with the last subtotal', async () => {
    const apart: string[] = []
    for (let count = 30; count <= 46; count++) {
      const rows = equipmentData(count).detail as Record<string, string>[]
      const pdf = await printed(resolved(GROUPED_EQUIPMENT, equipmentData(count)))
      const groups = [...new Set(rows.map((row) => row['site'] as string))].sort(new Intl.Collator('en-GB').compare)
      for (const site of groups) {
        const last = rows.filter((row) => row['site'] === site).map((row) => row['tag'] as string).sort().at(-1) as string
        if (pageWith(pdf, `Subtotal ${site}`) !== pageWith(pdf, last)) apart.push(`${count}: ${site}`)
      }
      if (pageWith(pdf, 'Grand total') !== pageWith(pdf, `Subtotal ${groups.at(-1)}`)) apart.push(`${count}: grand total`)
    }
    expect(apart).toEqual([])
  }, TIMEOUT)

  // At 200 items a grand total of 'CHF 10,612,357.00' was broken in the
  // middle of the number, its last '0' on the next line. The book value
  // column holds it whole, and the corpus's checks find every row in place.
  test('prints a register of 200 items with every amount whole', async () => {
    const document = resolved(GROUPED_EQUIPMENT, equipmentData(200))
    const pdf = await printed(document)
    expect(verify(fixtureOf('grouped-equipment-200', document, { minPagesExpected: 4, maxPagesExpected: 12 }), pdf)).toEqual([])
  }, TIMEOUT)

  // With nothing recorded the table says so, heads no group, and its total
  // is of nothing: 0 items worth CHF 0.00 (0007).
  test('prints its empty state and a grand total of nothing', async () => {
    const document = resolved(GROUPED_EQUIPMENT, equipmentData(0))
    const pdf = await printed(document)
    expect(verify(fixtureOf('grouped-equipment-empty', document, { maxPagesExpected: 1 }), pdf)).toEqual([])
    expect(startingWith(pdf, 'No equipment recorded.')).toHaveLength(1)
    expect(startingWith(pdf, 'Grand total').map((line) => line.text)).toEqual([`Grand total 0 ${chf(0n)}`])
    expect(linesOf(pdf).filter((line) => line.text.startsWith('Subtotal'))).toEqual([])
  }, TIMEOUT)

  // Data the provider calls incomplete: a final render refuses it, and a
  // preview prints it labelled as a preview on every page, and says so in
  // its manifest, so that it is never taken for the register.
  test('refuses incomplete data in a final render and labels a preview of it on every page', async () => {
    const incomplete: ReportData = { ...data, completeness: { complete: false, captured: rows.length, cap: rows.length } }
    const final = resolveReport(GROUPED_EQUIPMENT.report, incomplete, { mode: 'final', parameters: GROUPED_EQUIPMENT.parameters, creationDate: CREATED })
    expect(final.ok ? [] : final.errors.map((error) => `${error.stage} ${error.code}`)).toEqual(['data incomplete'])
    const preview = resolveReport(GROUPED_EQUIPMENT.report, incomplete, { mode: 'preview', parameters: GROUPED_EQUIPMENT.parameters, creationDate: CREATED })
    if (!preview.ok) throw new Error(preview.errors.map((error) => error.message).join('; '))
    expect(preview.manifest.completeness.complete).toBe(false)
    const pdf = await printed(preview.document)
    expect(verify(fixtureOf('grouped-equipment-preview', preview.document, { maxPagesExpected: 4 }), pdf)).toEqual([])
    expect(pdf.pages.map((page) => pageLines(page)[0]?.text)).toEqual(pdf.pages.map(() => PREVIEW_LABEL))
  }, TIMEOUT)
})

describe('the invoice', () => {
  const data = invoiceData()
  const lines = [...(data.detail as Record<string, string>[])].sort((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
  const chf = (amount: bigint): string => francs('de-CH', amount)
  /** An amount as SIX's slip prints it: a space between thousands, a point and two places (IG 3.5.3). */
  const slipAmount = (amount: bigint): string => decimal(amount).replace(/\B(?=(\d{3})+\.)/g, ' ')

  // The independent reference: the subtotal is the sum of the supplied
  // amounts; VAT is 8.1 % of it, rounded half away to the centime; the
  // total is the two, to the centime, as a bill is paid.
  const subtotal = lines.reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
  const vat = halfAway(subtotal * 81n, 1000n)
  const total = subtotal + vat

  // An invoice is paid by its slip: every line item once, in article order
  // though the data sent them the other way round, and the totals exactly
  // what the reference computes, on the one page whose foot the receipt
  // and the payment part take; and the code, decoded from the page's
  // pixels, asks for exactly the total the table prints, which the receipt
  // and the payment part print too. A bill that asked for another amount
  // than the invoice states would be paid wrongly, and nothing on the page
  // would show it.
  test('prints its lines and totals, and a QR-bill on the same page for exactly the printed total', async () => {
    const document = resolved(INVOICE, data)
    const bytes = await renderPdf(document, { maxPages: 20 })
    const pdf = await readPdf(bytes)
    expect(pdf.pages).toHaveLength(1)
    const found = lines.map((line) => startingWith(pdf, line['article'] as string))
    expect(found.map((each) => each.length)).toEqual(lines.map(() => 1))
    expect(found.map(([line], index) => line !== undefined && lineHas(line, chf(cents(lines[index]?.['amount'] as string))))).toEqual(lines.map(() => true))
    expect(startingWith(pdf, 'Zwischensumme').map((line) => line.text)).toEqual([`Zwischensumme ${chf(subtotal)}`])
    expect(startingWith(pdf, 'MWST 8.1 %').map((line) => line.text)).toEqual([`MWST 8.1 % ${chf(vat)}`])
    expect(startingWith(pdf, 'Total').map((line) => line.text)).toEqual([`Total ${chf(total)}`])
    const codes = await readCodes(bytes, 1)
    expect(codes.map((code) => code.text)).toEqual([document.paymentPart?.payload])
    expect(codes[0]?.text.split('\n').slice(18, 20)).toEqual([decimal(total), 'CHF'])
    expect(pdf.pages[0]?.items.filter((item) => item.text === slipAmount(total)).length).toBe(2)
    for (const heading of ['Empfangsschein', 'Zahlteil']) expect(pdf.pages[0]?.items.some((item) => item.text === heading), heading).toBe(true)
  }, TIMEOUT)
})
