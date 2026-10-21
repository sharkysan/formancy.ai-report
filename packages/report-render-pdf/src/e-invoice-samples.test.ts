import { E_INVOICE, E_INVOICE_SAMPLES, elementsAt, LOGO, readCii, readCodes, readPdf, starterImages, textAt, verify, XRECHNUNG_SAMPLES, type CiiElement, type PdfCode, type PdfPage, type PdfTextItem, type ReadPdf, type Starter } from '@formancy/report-corpus'
import { MAX_SVG_COORDINATE, resolveReport, XRECHNUNG, XRECHNUNG_COPY_LABEL, type ReportData, type ReportDefinition, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { checkImageAsset, type Vector } from './assets.js'
import { renderPdf } from './node.js'
import { SVG_INTEGER_BOUND, svgReach } from './svg-pdfa.js'
import { fixtureOf, normalise, TIMEOUT } from './testing/documents.js'
import { crowding, markAt, marksOn, MARGIN, MARK_SIDE } from './testing/letterhead.js'
import { runLines } from './testing/lines.js'

/**
 * The e-invoice samples' pages against the XML they embed (0031,
 * extending 0027), read back from the PDF the engine produced (0003): what
 * a person reads and what the receiver's software reads must be one
 * invoice, and in Germany a picture that says otherwise may be a second
 * (§ 14c UStG; the BMF names "eine andere Leistungsbeschreibung", UStAE
 * 14c.1 Abs. 4a). No validator checks it: veraPDF reads the container,
 * Mustang and KoSIT the XML.
 *
 * The page and the XML are one evaluation by construction -- a line's
 * terms are the table's columns, a total is a name the runtime binds --
 * and report-core holds that a run reads every total. What only this test
 * holds is that what the page shows is what the XML says. report-core is
 * static: it counts a run behind a condition that never holds as printing
 * its total, and does not see the total a template computes itself and
 * prints in its place; and an e-invoice that names another column for the
 * item than the one the table prints the item in is a template like any
 * other. Both are below, as controls the comparison must find.
 *
 * Read from the PDF: the XML, out of the PDF itself, the bytes a
 * receiver's software reads, parsed by saxes; by PDF.js, the firm's line,
 * the buyer, the number and the dates, every line of the table cell by
 * cell, every row under it, the terms and the bank details; and the EPC
 * code, decoded by ZXing from the pixels PDF.js draws. Each must be the
 * XML's value as Intl prints it for de-DE in the format this test states,
 * and the XML's amounts are recomputed here in BigInt from the sample's
 * data, at rates this test states, never read from the runtime.
 *
 * The XRechnung sample (0038) is read so too: its PDF embeds nothing, so
 * its XML is the resolved document's, the very text a host takes and
 * sends, and its page must say, as its first line, that it is the copy.
 *
 * What it cannot show: a customer template's page, since only the samples
 * are compared, nor what a sample's template prints for other data.
 */

const CREATED = '2026-10-16T08:00:00Z'

const STT = 'rsm:SupplyChainTradeTransaction'
const LINE = `${STT}/ram:IncludedSupplyChainTradeLineItem`
const HTA = `${STT}/ram:ApplicableHeaderTradeAgreement`
const HTD = `${STT}/ram:ApplicableHeaderTradeDelivery`
const HTS = `${STT}/ram:ApplicableHeaderTradeSettlement`
const SUMMATION = `${HTS}/ram:SpecifiedTradeSettlementHeaderMonetarySummation`
const DATE = 'udt:DateTimeString'

/** The table's header, as the template prints it over the lines. */
const HEADER = ['Artikel', 'Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Betrag']
/** What the template prints that is no term of the e-invoice: the heading over the bank details, and the hint beside the code. */
const OWN_WORDS = ['Bankverbindung', 'Oder scannen Sie den Code links mit Ihrer Banking-App.']
/** The bank details' labels, as the template prints them, each before what it names. */
const DETAIL = /^(Empfänger|IBAN|BIC|Betrag|Referenz): /u
/** How the table prints each unit of UN/ECE Recommendation 20 the samples use: this test's own reading of the codes. */
const PRINTED_UNITS: Readonly<Record<string, string>> = { LS: 'Pausch.', HUR: 'h', H87: 'Stk', KGM: 'kg', MTR: 'm' }
/** The code and the rate of each category, as this test states them, apart from the definition. */
const CATEGORIES = { standard: ['S', 19n], reduced: ['S', 7n], exempt: ['E', 0n], reverse: ['AE', 0n] } as const

/** A run's left edge where a column's other runs stand, to well under a point: a column's left-aligned runs share one. */
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.5
const textOf = (run: PdfTextItem): string => normalise(run.text)
/** A cell's or a column's text read on onto its next line: a word pdfmake broke at its hyphen is one word again. */
const joined = (before: string, after: string): string => (before === '' ? after : before.endsWith('-') ? `${before}${after}` : `${before} ${after}`)

const euros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantities = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
/** An amount the XML holds, as the template prints it, in euro for de-DE, handed the exact decimal string. */
const euro = (amount: string | undefined): string => normalise(euros.format(amount as Intl.StringNumericLiteral))
/** A date the XML holds, `YYYYMMDD` (format 102), as the template prints it for de-DE, in UTC as the runtime formats a date. */
const day = (date: string | undefined): string => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date?.slice(0, 4)}-${date?.slice(4, 6)}-${date?.slice(6, 8)}T00:00:00Z`))
/** An IBAN as a person reads it: in groups of four. */
const grouped = (code: string | undefined): string => (code ?? '').replace(/(.{4})(?=.)/g, '$1 ')
/** An amount as the EPC code writes it (EPC069-12 v3.1 2.2): in euro, as short as it goes. */
const epcAmount = (amount: string | undefined): string => `EUR${(amount ?? '').replace(/\.?0+$/, '')}`

/** What a page shows of its e-invoice, in the parts the template lays it out in, each as a reader reads it. */
interface Shown {
  /** The copy's label, the first line of an XRechnung's page, where the page prints one. */
  readonly label: string | undefined
  /** The firm's line over the head: the seller. */
  readonly firm: string
  /** The buyer's lines, under the firm's at its left edge. */
  readonly buyer: readonly string[]
  /** The column at the title's left edge: the title, the number and the dates, read on where a line wraps. */
  readonly head: string
  /** Each row of the table, in its order: the item, the quantity, the unit, the price and the amount. Its article number is the seller's own (BT-155, which this version does not write). */
  readonly lines: readonly (readonly string[])[]
  /** Each row under the table, its label and its amount. */
  readonly totals: readonly string[]
  readonly terms: string | undefined
  readonly details: readonly string[]
  /** Each code's BIC, beneficiary, IBAN and amount, its elements 5 to 8. */
  readonly codes: readonly (readonly string[])[]
  /** Every run read as none of the above. */
  readonly unread: readonly string[]
}

/** What the page prints, read from its runs where they stand. Read in the template's layout, which this test states; a run of it nowhere else is unread. */
function shownBy(pdf: ReadPdf, codes: readonly PdfCode[]): Shown {
  if (pdf.pages.length !== 1) throw new Error(`the PDF has ${pdf.pages.length} pages, where each sample prints one`)
  const all = runLines(pdf.pages[0]!)
  // The page header's one line of an XRechnung's copy, above the firm's.
  const labelled = all[0]?.length === 1 && textOf(all[0][0]!) === XRECHNUNG_COPY_LABEL
  const lines = labelled ? all.slice(1) : all
  const header = lines.findIndex((line) => line.map(textOf).join('|') === HEADER.join('|'))
  if (header < 1) throw new Error("the page prints no table header under the firm's line")

  const [firm, ...besideFirm] = lines[0]!
  const above = lines.slice(1, header).flat()
  const title = above.find((run) => textOf(run) === 'Rechnung')
  const buyer = above.filter((run) => near(run.x, firm!.x))
  const head = above.filter((run) => title !== undefined && near(run.x, title.x))

  // A row begins at the article column's edge; a cell that wraps goes on below at its own, until the next row begins.
  const rows: string[][] = []
  let next = header + 1
  const article = lines[header]![0]!.x
  while (lines[next] !== undefined && near(lines[next]![0]!.x, article)) {
    const first = lines[next]!
    const cells = first.map(textOf)
    const cellAt = (run: PdfTextItem): number => first.findIndex((cell, index) => index > 0 && near(cell.x, run.x))
    for (next += 1; lines[next] !== undefined && lines[next]!.every((run) => cellAt(run) > 0); next += 1) {
      for (const run of lines[next]!) cells[cellAt(run)] = joined(cells[cellAt(run)]!, textOf(run))
    }
    rows.push(cells)
  }
  const totals: string[] = []
  for (; lines[next]?.length === 2; next += 1) totals.push(lines[next]!.map(textOf).join(' '))
  const terms = lines[next]?.map(textOf).join(' ')
  const rest = lines.slice(next + 1).flat()

  return {
    label: labelled ? XRECHNUNG_COPY_LABEL : undefined,
    firm: firm === undefined ? '' : textOf(firm),
    buyer: buyer.map(textOf),
    head: head.map(textOf).reduce(joined, ''),
    lines: rows.map((cells) => cells.slice(1)),
    totals,
    terms,
    details: rest.filter((run) => DETAIL.test(textOf(run))).map(textOf),
    codes: codes.map((code) => code.text.split('\n').slice(4, 8)),
    unread: [...besideFirm, ...above.filter((run) => !buyer.includes(run) && !head.includes(run)), ...rest.filter((run) => !DETAIL.test(textOf(run)))].map(textOf),
  }
}

/** What the page must show of what `root`, the XML a PDF embeds, holds: each term as the template prints it, in the format this test states. */
function heldBy(root: CiiElement): Shown {
  const at = (path: string): string | undefined => textAt(root, path)
  const [seller, buyer] = [`${HTA}/ram:SellerTradeParty`, `${HTA}/ram:BuyerTradeParty`]
  const buyerVatId = at(`${buyer}/ram:SpecifiedTaxRegistration/ram:ID`)
  const delivered = at(`${HTD}/ram:ActualDeliverySupplyChainEvent/ram:OccurrenceDateTime/${DATE}`)
  const start = at(`${HTS}/ram:BillingSpecifiedPeriod/ram:StartDateTime/${DATE}`)
  const means = `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans`
  const [account, iban, bic] = [at(`${means}/ram:PayeePartyCreditorFinancialAccount/ram:AccountName`), at(`${means}/ram:PayeePartyCreditorFinancialAccount/ram:IBANID`), at(`${means}/ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID`)]
  const [due, paid] = [at(`${SUMMATION}/ram:DuePayableAmount`), at(`${SUMMATION}/ram:TotalPrepaidAmount`)]
  const reference = at(`${HTA}/ram:BuyerReference`)
  const xrechnung = at('rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID') === XRECHNUNG['3.0'].guideline
  const breakdown = elementsAt(root, `${HTS}/ram:ApplicableTradeTax`).map((tax) => {
    const of = (name: string): string | undefined => textAt(tax, `ram:${name}`)
    const label = of('CategoryCode') === 'S' ? `Umsatzsteuer ${of('RateApplicablePercent')} % auf` : `${of('ExemptionReason')}, Entgelt`
    return `${label} ${euro(of('BasisAmount'))} ${euro(of('CalculatedAmount'))}`
  })
  return {
    label: xrechnung ? XRECHNUNG_COPY_LABEL : undefined,
    firm: `${at(`${seller}/ram:Name`)} · ${at(`${seller}/ram:PostalTradeAddress/ram:LineOne`)} · ${at(`${seller}/ram:PostalTradeAddress/ram:PostcodeCode`)} ${at(`${seller}/ram:PostalTradeAddress/ram:CityName`)} · USt-IdNr. ${at(`${seller}/ram:SpecifiedTaxRegistration/ram:ID`)}`,
    buyer: [at(`${buyer}/ram:Name`), at(`${buyer}/ram:PostalTradeAddress/ram:LineOne`), `${at(`${buyer}/ram:PostalTradeAddress/ram:PostcodeCode`)} ${at(`${buyer}/ram:PostalTradeAddress/ram:CityName`)}`, ...(buyerVatId === undefined ? [] : [`USt-IdNr.: ${buyerVatId}`])].map(String),
    head: [
      'Rechnung',
      `Rechnungsnummer: ${at('rsm:ExchangedDocument/ram:ID')}`,
      `Rechnungsdatum: ${day(at(`rsm:ExchangedDocument/ram:IssueDateTime/${DATE}`))}`,
      ...(delivered === undefined ? [] : [`Leistungsdatum: ${day(delivered)}`]),
      ...(start === undefined ? [] : [`Leistungszeitraum: ${day(start)} bis ${day(at(`${HTS}/ram:BillingSpecifiedPeriod/ram:EndDateTime/${DATE}`))}`]),
      `Zahlbar bis: ${day(at(`${HTS}/ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime/${DATE}`))}`,
      ...(reference === undefined ? [] : [`Leitweg-ID: ${reference}`]),
    ].join(' '),
    lines: elementsAt(root, LINE).map((line) => {
      const of = (path: string): string | undefined => textAt(line, path)
      const unit = elementsAt(line, 'ram:SpecifiedLineTradeDelivery/ram:BilledQuantity')[0]?.attributes['unitCode']
      return [
        String(of('ram:SpecifiedTradeProduct/ram:Name')),
        quantities.format(of('ram:SpecifiedLineTradeDelivery/ram:BilledQuantity') as Intl.StringNumericLiteral),
        String(PRINTED_UNITS[unit ?? '']),
        euro(of('ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount')),
        euro(of('ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount')),
      ]
    }),
    totals: [
      `Nettobetrag ${euro(at(`${SUMMATION}/ram:TaxBasisTotalAmount`))}`,
      ...breakdown,
      `Umsatzsteuer gesamt ${euro(at(`${SUMMATION}/ram:TaxTotalAmount`))}`,
      `Rechnungsbetrag ${euro(at(`${SUMMATION}/ram:GrandTotalAmount`))}`,
      ...(paid === undefined ? [] : [`Bereits gezahlt ${euro(paid)}`, `Zahlbetrag ${euro(due)}`]),
    ],
    terms: normalise(String(at(`${HTS}/ram:SpecifiedTradePaymentTerms/ram:Description`))),
    details: [`Empfänger: ${account}`, `IBAN: ${grouped(iban)}`, `BIC: ${bic}`, `Betrag: ${euro(due)}`, `Referenz: ${at(`${HTS}/ram:PaymentReference`)}`],
    codes: [[String(bic), String(account), String(iban), epcAmount(due)]],
    unread: OWN_WORDS,
  }
}

/** Every place `page` and `xml` part, by its path in `Shown`: what the page prints there, and what the XML holds. */
function partings(page: unknown, xml: unknown, at = ''): string[] {
  if (typeof page === 'object' && page !== null && typeof xml === 'object' && xml !== null) {
    const keys = [...new Set([...Object.keys(page), ...Object.keys(xml)])]
    return keys.flatMap((key) => partings((page as Record<string, unknown>)[key], (xml as Record<string, unknown>)[key], `${at}/${key}`))
  }
  return Object.is(page, xml) ? [] : [`${at}: the page prints ${JSON.stringify(page)}, the XML holds ${JSON.stringify(xml)}`]
}

interface Printed {
  readonly document: ResolvedDocument
  readonly pdf: ReadPdf
  /** The bytes of the one file the PDF names factur-x.xml, as PDF.js reads them out of it; undefined for an XRechnung's copy, which embeds nothing. */
  readonly embedded: Uint8Array | undefined
  /** That file, parsed; an XRechnung's XML, the resolved document's. */
  readonly root: CiiElement
  readonly shown: Shown
}

/** `report` resolved against `data` in a final render, drawn, and read back; once for each `id`, since two samples may share one report. */
const printed = new Map<string, Promise<Printed>>()
function print(id: string, report: ReportDefinition, data: ReportData): Promise<Printed> {
  let found = printed.get(id)
  if (found === undefined) {
    found = (async () => {
      const outcome = resolveReport(report, data, { mode: 'final', parameters: {}, images: starterImages, creationDate: CREATED })
      if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
      const bytes = await renderPdf(outcome.document, { maxPages: 5 })
      const pdf = await readPdf(bytes)
      const shown = shownBy(pdf, await readCodes(bytes, 1))
      if (outcome.document.eInvoice?.kind === 'xrechnung') {
        if (pdf.attachments.length !== 0) throw new Error(`the XRechnung's copy embeds ${pdf.attachments.length} files`)
        return { document: outcome.document, pdf, embedded: undefined, root: readCii(outcome.document.eInvoice.xml), shown }
      }
      const files = pdf.attachments.filter((file) => file.name === 'factur-x.xml')
      if (files.length !== 1 || files[0]!.bytes === undefined) throw new Error(`the PDF embeds ${files.length} files named factur-x.xml`)
      const embedded = files[0]!.bytes
      // Not UTF-8 throws; a byte-order mark is kept, for the byte comparison to find.
      const root = readCii(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(embedded))
      return { document: outcome.document, pdf, embedded, root, shown }
    })()
    printed.set(id, found)
  }
  return found
}

/** Cents as an amount the data writes, at exactly two places; any other spelling is the data's defect. */
function cents(amount: string): bigint {
  if (!/^-?\d+\.\d{2}$/.test(amount)) throw new Error(`${amount} is not an amount at two places`)
  return BigInt(amount.replace('.', ''))
}
/** `numerator / denominator`, the denominator positive, rounded half away from zero. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (numerator < 0n ? -((-2n * numerator + denominator) / (2n * denominator)) : (2n * numerator + denominator) / (2n * denominator))
/** Cents as the XML writes an amount: exactly two places, a minus where negative. */
const written = (amount: bigint): string => {
  const whole = amount < 0n ? -amount : amount
  return `${amount < 0n ? '-' : ''}${whole / 100n}.${String(whole % 100n).padStart(2, '0')}`
}

/** What a sample's own data comes to, computed here: each line's amount, in the table's order; each category a line is in, in the order declared, its code, rate, basis and tax; and the totals. */
function reference(data: ReportData) {
  const rows = (data.detail as Record<string, string>[]).toSorted((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
  const lines = rows.map((row) => ({ amount: halfAway(cents(row['quantity'] as string) * cents(row['unitPrice'] as string), 100n), category: row['vat'] as keyof typeof CATEGORIES }))
  const breakdown = (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).flatMap((category) => {
    const own = lines.filter((line) => line.category === category)
    const basis = own.reduce((sum, line) => sum + line.amount, 0n)
    const [code, rate] = CATEGORIES[category]
    return own.length === 0 ? [] : [[code, String(rate), written(basis), written(halfAway(basis * rate, 100n))]]
  })
  const net = lines.reduce((sum, line) => sum + line.amount, 0n)
  const tax = breakdown.reduce((sum, [, , , amount]) => sum + cents(amount as string), 0n)
  const paid = (data.header as Record<string, string | null>)['paid'] ?? null
  return { lines: lines.map((line) => written(line.amount)), breakdown, totals: [written(net), written(tax), written(net + tax), paid ?? undefined, written(net + tax - (paid === null ? 0n : cents(paid)))] }
}

/** The amounts `root` holds, in `reference`'s shape. */
function amountsOf(root: CiiElement) {
  const at = (name: string): string | undefined => textAt(root, `${SUMMATION}/ram:${name}`)
  return {
    lines: elementsAt(root, LINE).map((line) => textAt(line, 'ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount')),
    breakdown: elementsAt(root, `${HTS}/ram:ApplicableTradeTax`).map((tax) => ['CategoryCode', 'RateApplicablePercent', 'BasisAmount', 'CalculatedAmount'].map((name) => textAt(tax, `ram:${name}`))),
    totals: [at('TaxBasisTotalAmount'), at('TaxTotalAmount'), at('GrandTotalAmount'), at('TotalPrepaidAmount'), at('DuePayableAmount')],
  }
}

const samples = E_INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const)
/** The Factur-X samples and the XRechnung sample, whose page is compared with its XML alike. */
const everySample = [...E_INVOICE_SAMPLES, ...XRECHNUNG_SAMPLES].map((sample) => [sample.id, sample] as const)

describe('an e-invoice sample, read back from its PDF', () => {
  // What is compared below is what a receiver's software reads: the file
  // the PDF embeds, read out of the PDF, which must be the runtime's XML
  // byte for byte, and whose amounts are the sample's data's, recomputed
  // here in BigInt -- each line its quantity times its price to the cent,
  // each category's tax its basis at its rate rounded once, half away from
  // zero, the totals their sums, and what was paid off the amount due -- so
  // that a page equal to its XML is a page equal to its data.
  test.each(samples)("%s embeds the runtime's XML byte for byte, whose amounts are its data's in BigInt", async (_id, sample: Starter) => {
    const { document, embedded, root } = await print(sample.id, sample.report, sample.data)
    expect(Buffer.from(embedded!).equals(Buffer.from(new TextEncoder().encode(document.eInvoice!.xml)))).toBe(true)
    expect(amountsOf(root)).toEqual(reference(sample.data))
  }, TIMEOUT)

  // An XRechnung's copy embeds nothing (0038): the invoice is its XML,
  // the resolved document's, which a host sends; the copy holds no file a
  // receiver could take for a second invoice. Its XML's amounts are its
  // data's, recomputed here as the samples' are.
  test.each(XRECHNUNG_SAMPLES.map((sample) => [sample.id, sample] as const))("%s embeds nothing, and its XML's amounts are its data's in BigInt", async (_id, sample: Starter) => {
    const { pdf, embedded, root } = await print(sample.id, sample.report, sample.data)
    expect([embedded, pdf.attachments]).toEqual([undefined, []])
    expect(amountsOf(root)).toEqual(reference(sample.data))
  }, TIMEOUT)

  // The page is the XML's invoice, all of it: the seller and the buyer, the
  // number and the dates, the delivery date or the period, every line --
  // its item, quantity, unit, price and amount, in the table's order --
  // every row under the table, a row for each category a line is in and
  // none for another, the terms, the bank details, and a code that asks
  // for the amount due to the XML's account; and nothing else but the
  // template's own words. A page that printed one thing where its XML held
  // another would show the buyer one invoice and file another. And a reader
  // reads it: the corpus's checks find no text drawn over text, nothing
  // past a margin and every font embedded (0003). Its table is this test's
  // to read, against the XML: the corpus's reads a cell word by word, and
  // takes the item pdfmake broke after "Gas-" for a word the cell lacks.
  test.each(everySample)('%s prints what its XML holds, where a reader reads it, and nothing else', async (id, sample: Starter) => {
    const { document, pdf, root, shown } = await print(sample.id, sample.report, sample.data)
    expect(partings(shown, heldBy(root))).toEqual([])
    expect(verify(fixtureOf(id, document, { maxPagesExpected: 1, tables: [] }), pdf)).toEqual([])
  }, TIMEOUT)

  // The firm's e-invoices carry its mark as its other invoices do (0032):
  // drawn as vectors at the margins' corner, 15 mm square, in its blue and
  // white, with no image embedded for it -- a PDF/A-3b holds an SVG drawn
  // so (0030) -- and no text beside it or in the 12 pt under it, the firm's
  // line the first under it. The XML says nothing of it, as the test above
  // holds by finding nothing on the page the XML does not.
  test.each(samples)('%s prints the firm’s mark at the head of its page', async (_id, sample: Starter) => {
    const { pdf } = await print(sample.id, sample.report, sample.data)
    const [page] = pdf.pages as [PdfPage]
    expect(marksOn(page)).toEqual([markAt(MARGIN)])
    expect([page.images, crowding(page, markAt(MARGIN))]).toEqual([[], []])
  }, TIMEOUT)

  // An SVG in an e-invoice is held to what a PDF/A-3 may hold: every
  // number the converter writes for it, bounded from above, under
  // SVG_INTEGER_BOUND (0030). The mark, with no group, no gradient and no
  // clip of its own, in its box on A4, reaches no further than the bound's
  // floor for any drawing, the converter's own numbers at twice
  // MAX_SVG_COORDINATE: a thousandth of the bound, by its construction and
  // not by a margin someone measured.
  test("the firm's mark reaches no further in an e-invoice than any drawing does, a thousandth of the PDF/A-3 bound", async () => {
    const vector = (await checkImageAsset({ id: LOGO.asset, mediaType: LOGO.mediaType, bytes: LOGO.bytes })) as Vector
    const reach = svgReach(vector, { width: MARK_SIDE, height: MARK_SIDE, fit: 'contain' }, { paperWidth: 595.28, paperHeight: 841.89 })
    expect(reach).toBe(2 * MAX_SVG_COORDINATE)
    expect(reach).toBeLessThan(SVG_INTEGER_BOUND / 1000)
  })
})

type Component = ReportDefinition['regions']['summary'][number]

/** A row under the table that prints, in the grand total's style, `cel` in euro under `label`, shown when `when` holds. */
function grandRow(id: string, label: string, cel: string, when?: string): Component {
  return {
    id,
    kind: 'columns',
    ...(when === undefined ? {} : { visibleWhen: { cel: when } }),
    columns: [
      { width: 'fill', components: [{ id: `${id}-label`, kind: 'text', style: 'grand', content: [{ kind: 'text', text: label }] }] },
      { width: 84, components: [{ id: `${id}-amount`, kind: 'text', style: 'grand-figure', content: [{ kind: 'expression', expression: { cel }, format: { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } }] }] },
    ],
  }
}

/** A rate's VAT summed over the lines of `category`, rounded half to even, once: what a template might compute beside the runtime. */
const vatOf = (id: string, category: string, rate: string): NonNullable<ReportDefinition['aggregates']>[number] => ({
  id,
  fn: 'sum',
  of: { kind: 'expression', expression: { cel: `row.vat == "${category}" ? row.amount * dec("${rate}") : dec("0")` } },
  rounding: { scale: 2, mode: 'half-even' },
})

describe('the comparison, watched failing', () => {
  // A template that prints a total it computes itself -- the net amount
  // and each rate's VAT summed by aggregates, each rounded half to even,
  // as an ERP may round -- and keeps the runtime's total behind a
  // condition that does not hold, which report-core counts as printed.
  // The runtime resolves it and the renderer draws it: on the sample's own
  // data its total is 871,62 €, where the XML says 871.63, since the VAT
  // at 7 % on 107.50 is 7.525, which half to even rounds down. The
  // comparison finds that cent, at that row, and nothing else.
  test('a template printing a total of its own parts from its XML at that total, by a cent, and nowhere else', async () => {
    const { report } = E_INVOICE
    const own: ReportDefinition = {
      ...report,
      id: 'e-invoice-own-total',
      aggregates: [...report.aggregates, { id: 'ownNet', fn: 'sum', of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }, vatOf('ownStandardVat', 'standard', '0.19'), vatOf('ownReducedVat', 'reduced', '0.07')],
      regions: {
        ...report.regions,
        summary: report.regions.summary.flatMap((component) =>
          component.id === 'grand' ? [grandRow('grand', 'Rechnungsbetrag', 'totals.ownNet + totals.ownStandardVat + totals.ownReducedVat'), grandRow('grand-runtime', 'Rechnungsbetrag', 'invoice.grandTotal', 'false')] : [component],
        ),
      },
    }
    const { root, shown } = await print(own.id, own, E_INVOICE.data)
    expect(partings(shown, heldBy(root))).toEqual(['/totals/4: the page prints "Rechnungsbetrag 871,62 €", the XML holds "Rechnungsbetrag 871,63 €"'])
  }, TIMEOUT)

  // A template whose e-invoice names the article column as the item's
  // name (BT-153), where the table prints the item in the description
  // column: the article is a string field, as an item's name is, and
  // nothing before this comparison refuses it. The XML then names each
  // item by its article number while the page describes it -- the BMF's
  // "andere Leistungsbeschreibung" -- and the comparison finds every
  // line's item, and nothing else: the amounts are the very columns'.
  test("a template whose e-invoice names another column for the item than its table prints it in parts at every line's item, and nowhere else", async () => {
    const { report } = E_INVOICE
    const invoice = report.eInvoice!
    const other: ReportDefinition = { ...report, id: 'e-invoice-other-field', eInvoice: { ...invoice, lines: { ...invoice.lines, name: 'article' } } }
    const { root, shown } = await print(other.id, other, E_INVOICE.data)
    const rows = (E_INVOICE.data.detail as Record<string, string>[]).toSorted((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
    expect(partings(shown, heldBy(root))).toEqual(rows.map((row, index) => `/lines/${index}/0: the page prints ${JSON.stringify(row['description'])}, the XML holds ${JSON.stringify(row['article'])}`))
  }, TIMEOUT)
})
