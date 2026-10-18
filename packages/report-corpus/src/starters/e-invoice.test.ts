import { diagnose } from '@formancy/report-core'
import { checkReport, resolveReport } from '@formancy/report-runtime'
import type { Block, Columns, ResolvedDocument, Table } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { elementsAt, readCii, textAt, textsAt } from '../testing/cii.js'
import type { CiiElement } from '../testing/cii.js'
import { E_INVOICE, E_INVOICE_EXEMPT_PAID, E_INVOICE_REVERSE_CHARGE, E_INVOICE_SAMPLES, sellerAddress } from './e-invoice.js'
import { EURO_INVOICE } from './euro-invoice.js'
import { STARTERS } from './index.js'
import type { Starter } from './starter.js'

/**
 * The e-invoice samples: the de-DE e-invoice and its two variants, the
 * same template over other data. What the runtime makes of each is read
 * back here, in the document and the XML it resolves to, before any PDF:
 *
 * - **the XML against BigInt.** Each sample's XML is read by saxes
 *   (`testing/cii.ts`), and every amount it holds -- each line's, each
 *   category's basis and tax, the totals, the amount paid and due -- is
 *   compared with what this test computes in BigInt from the sample's own
 *   data, at rates it states itself, never with the runtime's sums;
 * - **the page against the XML.** What the resolved document prints --
 *   every line of the table, every total under it, the head, the terms and
 *   the bank details -- is compared, as text, with the XML's values as Intl
 *   formats them for de-DE, so that a page that printed one thing and an
 *   XML that held another fails here.
 *
 * That the PDF prints them, and embeds that very XML, is held on the PDF
 * the engine produced (0003) by report-render-pdf's
 * `e-invoice-samples.test.ts`.
 */

const CREATED = '2026-10-16T08:00:00Z'

function resolved(sample: Starter): ResolvedDocument {
  const outcome = resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, creationDate: CREATED })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; '))
  return outcome.document
}

/** The sample's XML, read back: its root element. */
function xmlOf(sample: Starter): CiiElement {
  const file = resolved(sample).eInvoice
  if (file === undefined) throw new Error(`${sample.id} resolved to no e-invoice`)
  return readCii(file.xml)
}

const samples = E_INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const)

describe('the e-invoice samples', () => {
  // The sample and the two variants the e-invoice gate sees every accepted
  // path through, all in German: a fourth, or one in another language,
  // would claim what the PR does not (France waits), and a sample that
  // became a starter would put an e-invoice in the Studio's picker that
  // neither builder edits.
  test('are the e-invoice and its two variants, in German, and none is a starter', () => {
    expect(E_INVOICE_SAMPLES.map((sample) => [sample.id, sample.title, sample.report.locale])).toEqual([
      ['e-invoice', 'Rechnung (ZUGFeRD)', 'de-DE'],
      ['e-invoice-reverse-charge', 'Rechnung (ZUGFeRD)', 'de-DE'],
      ['e-invoice-exempt-paid', 'Rechnung (ZUGFeRD)', 'de-DE'],
    ])
    expect(STARTERS.filter((starter) => E_INVOICE_SAMPLES.includes(starter))).toEqual([])
  })

  // The variants are the template over other data, so that what the gate
  // passes is the template an author has, and not three. The exempt
  // variant is the very report; the reverse-charge one cannot be, since
  // the payment means is a code of the definition, and differs in it and
  // in the id another definition needs (0024), and in nothing else.
  test('are one template: the exempt variant the very report, the reverse-charge one apart only in its id and its payment means', () => {
    const differences = (a: unknown, b: unknown, at = ''): string[] => {
      if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b) ? [] : [at]
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
      return keys.flatMap((key) => differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}/${key}`))
    }
    expect(E_INVOICE_EXEMPT_PAID.report).toBe(E_INVOICE.report)
    expect(differences(E_INVOICE.report, E_INVOICE_REVERSE_CHARGE.report)).toEqual(['/eInvoice/payment/means', '/id'])
    expect([E_INVOICE.report.eInvoice?.payment?.means, E_INVOICE_REVERSE_CHARGE.report.eInvoice?.payment?.means]).toEqual(['58', '30'])
  })

  // One firm, one account: the e-invoice's seller, account and BIC are the
  // euro invoice's own, as its EPC code pays them. A sample that drifted
  // from it would print one firm's invoice with another's account.
  test("bill as the euro invoice's firm, to its account, through its BIC", () => {
    const code = (sample: Starter) => {
      const found: unknown[] = []
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(walk)
        else if (typeof value === 'object' && value !== null) {
          if ((value as { kind?: unknown }).kind === 'epcQrCode') found.push(value)
          Object.values(value).forEach(walk)
        }
      }
      walk(sample.report.regions)
      return found as readonly { readonly beneficiary: unknown; readonly iban: unknown; readonly bic: unknown }[]
    }
    const [euro] = code(EURO_INVOICE)
    const invoice = E_INVOICE.report.eInvoice
    expect(code(E_INVOICE).map(({ beneficiary, iban, bic }) => ({ beneficiary, iban, bic }))).toEqual([{ beneficiary: euro?.beneficiary, iban: euro?.iban, bic: euro?.bic }])
    expect([invoice?.seller.name, invoice?.payment?.accountName, invoice?.payment?.iban, invoice?.payment?.bic]).toEqual([euro?.beneficiary, euro?.beneficiary, euro?.iban, euro?.bic])
  })

  // The seller's address is parted out of the one spelling the euro
  // invoice's head prints, so that the page and the XML name one address.
  // Lines of another shape -- no town, a city before its post code, a post
  // code of four digits, two spaces, a third line -- would be written into
  // the XML parted wrongly, a city as a post code or a country left out,
  // and are refused when the corpus is imported rather than written.
  test("part the firm's address into a street, a post code and a city, and refuse lines of another shape", () => {
    const words = (runs: readonly unknown[]) => runs.map((run) => (run as { readonly text: string }).text).join('')
    const parted = sellerAddress(['Industriestraße 7', '50735 Köln'])
    expect([parted.line1, parted.postalCode, parted.city, parted.country].map((runs) => words(runs ?? []))).toEqual(['Industriestraße 7', '50735', 'Köln', 'DE'])
    const refused = [['Industriestraße 7'], ['Industriestraße 7', 'Köln 50735'], ['Industriestraße 7', '5073 Köln'], ['Industriestraße 7', '50735  Köln'], ['Industriestraße 7', '50735 Köln', 'Deutschland']]
    for (const address of refused) expect(() => sellerAddress(address), JSON.stringify(address)).toThrow("the e-invoice cannot part the firm's address")
  })

  // A sample the validator refuses, or whose expressions the editor marks,
  // is a broken e-invoice shown as an example; a warning -- a total the
  // page does not print among them -- is one an author would see first.
  test.each(samples)('%s validates, with no diagnostic at all', (_id, sample) => {
    const outcome = checkReport(sample.report)
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
    expect(diagnose(sample.report).map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`)).toEqual([])
  })

  // Its own data in a final render, with nothing a preview would warn of,
  // and an e-invoice in the document: a final render writes the XML or
  // refuses.
  test.each(samples)('%s resolves its own data in a final render, to a document carrying its XML', (_id, sample) => {
    const outcome = resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, creationDate: CREATED })
    expect(outcome.ok ? outcome.warnings : outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`)).toEqual([])
    expect(outcome.ok && [outcome.document.eInvoice?.fileName, outcome.document.eInvoice?.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice ')]).toEqual(['factur-x.xml', true])
  })
})

const STT = 'rsm:SupplyChainTradeTransaction'
const LINE = `${STT}/ram:IncludedSupplyChainTradeLineItem`
const HTA = `${STT}/ram:ApplicableHeaderTradeAgreement`
const HTD = `${STT}/ram:ApplicableHeaderTradeDelivery`
const HTS = `${STT}/ram:ApplicableHeaderTradeSettlement`
const SUMMATION = `${HTS}/ram:SpecifiedTradeSettlementHeaderMonetarySummation`
const DATE = 'udt:DateTimeString'

/** Each line of the XML (BG-25), its terms as written. */
function xmlLines(root: CiiElement) {
  return elementsAt(root, LINE).map((line) => ({
    id: textAt(line, 'ram:AssociatedDocumentLineDocument/ram:LineID'),
    name: textAt(line, 'ram:SpecifiedTradeProduct/ram:Name'),
    quantity: textAt(line, 'ram:SpecifiedLineTradeDelivery/ram:BilledQuantity'),
    unit: elementsAt(line, 'ram:SpecifiedLineTradeDelivery/ram:BilledQuantity')[0]?.attributes['unitCode'],
    netPrice: textAt(line, 'ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount'),
    category: textAt(line, 'ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:CategoryCode'),
    rate: textAt(line, 'ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:RateApplicablePercent'),
    netAmount: textAt(line, 'ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount'),
  }))
}

/** Each VAT breakdown of the XML (BG-23), in its order. */
function xmlBreakdown(root: CiiElement) {
  return elementsAt(root, `${HTS}/ram:ApplicableTradeTax`).map((tax) => ({
    category: textAt(tax, 'ram:CategoryCode'),
    rate: textAt(tax, 'ram:RateApplicablePercent'),
    basis: textAt(tax, 'ram:BasisAmount'),
    amount: textAt(tax, 'ram:CalculatedAmount'),
    reason: textAt(tax, 'ram:ExemptionReason'),
  }))
}

/** The document's totals (BG-22) as the XML writes them, BT-113 undefined where it holds none. */
function xmlTotals(root: CiiElement) {
  const at = (name: string): string | undefined => textAt(root, `${SUMMATION}/ram:${name}`)
  return { lineTotal: at('LineTotalAmount'), taxBasisTotal: at('TaxBasisTotalAmount'), taxTotal: at('TaxTotalAmount'), grandTotal: at('GrandTotalAmount'), paid: at('TotalPrepaidAmount'), duePayable: at('DuePayableAmount') }
}

describe("the samples' XML, against BigInt", () => {
  /** The rate and code of each category, as this test states them, apart from the definition. */
  const CATEGORIES = { standard: ['S', 19n], reduced: ['S', 7n], exempt: ['E', 0n], reverse: ['AE', 0n] } as const
  type Category = keyof typeof CATEGORIES
  /** An amount of the data, at exactly two places, in cents; any other spelling is the data's defect. */
  const cents = (amount: string): bigint => {
    if (!/^-?\d+\.\d{2}$/.test(amount)) throw new Error(`${amount} is not an amount at two places`)
    return BigInt(amount.replace('.', ''))
  }
  /** `numerator / denominator`, the denominator positive, rounded half away from zero. */
  const halfAway = (numerator: bigint, denominator: bigint): bigint => (numerator < 0n ? -((-2n * numerator + denominator) / (2n * denominator)) : (2n * numerator + denominator) / (2n * denominator))
  /** Cents as the XML writes an amount: exactly two places, a minus where negative. */
  const written = (amount: bigint): string => `${amount < 0n ? '-' : ''}${(amount < 0n ? -amount : amount) / 100n}.${String((amount < 0n ? -amount : amount) % 100n).padStart(2, '0')}`

  /** What the sample's own data comes to, computed here: each line, each category a line is in, in the order declared, and the totals. */
  function reference(sample: Starter) {
    const rows = (sample.data.detail as Record<string, string>[]).toSorted((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1))
    const lines = rows.map((row) => ({ amount: halfAway(cents(row['quantity'] as string) * cents(row['unitPrice'] as string), 100n), category: row['vat'] as Category, data: cents(row['amount'] as string) }))
    const breakdown = (Object.keys(CATEGORIES) as Category[]).flatMap((category) => {
      const own = lines.filter((line) => line.category === category)
      if (own.length === 0) return []
      const basis = own.reduce((sum, line) => sum + line.amount, 0n)
      const [code, rate] = CATEGORIES[category]
      return [{ category: code, rate: String(rate), basis: written(basis), amount: written(halfAway(basis * rate, 100n)) }]
    })
    const net = lines.reduce((sum, line) => sum + line.amount, 0n)
    const tax = breakdown.reduce((sum, each) => sum + cents(each.amount), 0n)
    const paid = (sample.data.header as Record<string, string | null>)['paid'] ?? null
    return {
      lines: lines.map((line) => [written(line.data), written(line.amount), CATEGORIES[line.category][0]]),
      breakdown,
      totals: { lineTotal: written(net), taxBasisTotal: written(net), taxTotal: written(tax), grandTotal: written(net + tax), paid: paid ?? undefined, duePayable: written(net + tax - (paid === null ? 0n : cents(paid))) },
    }
  }

  // Each line's net amount is its quantity times its price to the cent, as
  // the data says it is; each category's basis is the sum of its lines,
  // its tax the basis at its rate rounded once, half away from zero; the
  // totals add up; and what was paid comes off the amount due. A runtime
  // that rounded per line, rounded half to even, or dropped the paid
  // amount would write another XML than this computes.
  test.each(samples)("%s's amounts are its data's, computed in BigInt", (_id, sample) => {
    const root = xmlOf(sample)
    const expected = reference(sample)
    // The data's own amounts are its quantities times its prices, or the sample's data is wrong before the runtime reads it.
    expect(expected.lines.filter(([data, computed]) => data !== computed)).toEqual([])
    expect(xmlLines(root).map((line) => [line.netAmount, line.category])).toEqual(expected.lines.map(([, computed, code]) => [computed, code]))
    expect(xmlBreakdown(root).map(({ category, rate, basis, amount }) => ({ category, rate, basis, amount }))).toEqual(expected.breakdown)
    expect(xmlTotals(root)).toEqual(expected.totals)
  })

  // The variants are there so the gate sees every path the PR accepts
  // (0027): the sample's two standard rates, its delivery date and SEPA
  // transfer; reverse charge with its reason, the buyer's VAT identifier,
  // a period and a plain credit transfer; an exempt category with its
  // reason, a paid amount and a discount at a negative quantity and a
  // positive price. A variant whose data stopped taking its path would
  // leave that path ungated, and pass every other test.
  test.each([
    ['e-invoice', { categories: ['S:', 'S:'], delivered: ['20261012'], period: [[], []], means: '58', buyerVatId: [], paid: undefined, negative: [] }],
    ['e-invoice-reverse-charge', { categories: ['AE:Steuerschuldnerschaft des Leistungsempfängers'], delivered: [], period: [['20260901'], ['20260930']], means: '30', buyerVatId: ['DE271828181'], paid: undefined, negative: [] }],
    ['e-invoice-exempt-paid', { categories: ['S:', 'E:Steuerfrei nach § 4 Nr. 8 Buchst. a UStG'], delivered: ['20261009'], period: [[], []], means: '58', buyerVatId: [], paid: '300.00', negative: [['-1.00', '56.70', '-56.70']] }],
  ] as const)('%s takes the path it is there for', (id, path) => {
    const root = xmlOf(E_INVOICE_SAMPLES.find((sample) => sample.id === id) as Starter)
    expect({
      categories: xmlBreakdown(root).map(({ category, reason }) => `${category}:${reason ?? ''}`),
      delivered: textsAt(root, `${HTD}/ram:ActualDeliverySupplyChainEvent/ram:OccurrenceDateTime/${DATE}`),
      period: [textsAt(root, `${HTS}/ram:BillingSpecifiedPeriod/ram:StartDateTime/${DATE}`), textsAt(root, `${HTS}/ram:BillingSpecifiedPeriod/ram:EndDateTime/${DATE}`)],
      means: textAt(root, `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:TypeCode`),
      buyerVatId: textsAt(root, `${HTA}/ram:BuyerTradeParty/ram:SpecifiedTaxRegistration/ram:ID`),
      paid: xmlTotals(root).paid,
      negative: xmlLines(root).flatMap((line) => (line.quantity?.startsWith('-') === true ? [[line.quantity, line.netPrice, line.netAmount]] : [])),
    }).toEqual(path)
  })
})

/** A paragraph's text, its runs joined. */
const textOf = (block: Block): string => (block.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : '')).join('') : '')

/** Every block of `blocks`, the blocks inside sections, columns and keep-together blocks among them, in reading order. */
function everyBlock(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block): Block[] => {
    if (block.kind === 'section' || block.kind === 'keepTogether') return [block, ...everyBlock(block.blocks)]
    if (block.kind === 'columns') return [block, ...block.columns.flatMap((slot) => everyBlock(slot.blocks))]
    return [block]
  })
}

describe("the samples' pages, against their XML", () => {
  const euros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
  const quantities = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
  /** An amount of the XML as Intl prints it in euro for de-DE, handed the exact decimal string. */
  const euro = (amount: string | undefined): string => euros.format(amount as Intl.StringNumericLiteral)
  /** A date of the XML, `YYYYMMDD` (format 102), as Intl prints it for de-DE in `style`, in UTC as the runtime formats a date. */
  const day = (date: string | undefined, style: 'medium' | 'long' = 'medium'): string => new Intl.DateTimeFormat('de-DE', { dateStyle: style, timeZone: 'UTC' }).format(new Date(`${date?.slice(0, 4)}-${date?.slice(4, 6)}-${date?.slice(6, 8)}T00:00:00Z`))
  /** How the table prints each unit of UN/ECE Recommendation 20 the samples use: this test's own reading of the codes. */
  const PRINTED_UNITS: Readonly<Record<string, string>> = { LS: 'Pausch.', HUR: 'h', H87: 'Stk', KGM: 'kg', MTR: 'm' }

  const page = (sample: Starter) => {
    const document = resolved(sample)
    const blocks = everyBlock(document.body)
    const tables = blocks.filter((block): block is Table => block.kind === 'table')
    const columns = blocks.filter((block): block is Columns => block.kind === 'columns')
    return { document, blocks, tables, columns, root: readCii(document.eInvoice?.xml ?? '') }
  }

  // Every line the table prints is the XML's line: the item's name, its
  // quantity, its unit, its price and its amount, in the table's order. A
  // table that printed a line from another column or field than the
  // e-invoice names, or a unit whose code means another, would show the
  // buyer one invoice and file another. The article number the table
  // prints first is the seller's own (BT-155, which this version does not
  // write), never the line's identifier: two lines of one article would
  // share it, where BT-126 is each line's own. The identifier is the
  // line's position, 1 up in the table's order.
  test.each(samples)("%s's table prints every line of its XML", (_id, sample) => {
    const { tables, root } = page(sample)
    expect(tables.map((table) => table.id)).toEqual(['positions'])
    const printed = tables[0]?.rows.filter((row) => row.kind === 'detail').map((row) => row.cells.slice(1))
    const lines = xmlLines(root)
    expect(printed).toEqual(lines.map((line) => [line.name, quantities.format(line.quantity as Intl.StringNumericLiteral), PRINTED_UNITS[line.unit ?? ''], euro(line.netPrice), euro(line.netAmount)]))
    expect(lines.map((line) => line.id)).toEqual(lines.map((_line, index) => String(index + 1)))
    expect(sample.report.eInvoice?.lines.id).toEqual({ kind: 'field', field: { dataset: 'detail', field: 'position' } })
    expect(tables[0]?.rows.filter((row) => row.kind !== 'detail')).toEqual([])
  })

  // Every total under the table is the XML's, in its order: the net
  // amount, a row for each category a line is in -- its rate, or its
  // exemption reason as the XML gives it, its basis and its tax -- the VAT,
  // the total and, where something was paid, what was and what is due; and
  // none for a category no line is in. A row that printed a sum of its own
  // would part from the XML the first time the two rounded differently.
  test.each(samples)("%s prints every total of its XML under the table, and no other", (_id, sample) => {
    const { columns, root } = page(sample)
    const rows = columns.filter((block) => block.columns.length === 2 && block.columns.every((slot) => slot.blocks.length === 1 && slot.blocks[0]?.kind === 'paragraph'))
    const totals = xmlTotals(root)
    const breakdown = xmlBreakdown(root).map(({ category, rate, basis, amount, reason }) => [category === 'S' ? `Umsatzsteuer ${rate} % auf ${euro(basis)}` : `${reason}, Entgelt ${euro(basis)}`, euro(amount)])
    expect(rows.map((row) => row.columns.map((slot) => textOf(slot.blocks[0] as Block)))).toEqual([
      ['Nettobetrag', euro(totals.taxBasisTotal)],
      ...breakdown,
      ['Umsatzsteuer gesamt', euro(totals.taxTotal)],
      ['Rechnungsbetrag', euro(totals.grandTotal)],
      ...(totals.paid === undefined
        ? []
        : [
            ['Bereits gezahlt', euro(totals.paid)],
            ['Zahlbetrag', euro(totals.duePayable)],
          ]),
    ])
  })

  // The head of the invoice is the XML's: the buyer's name and address,
  // its VAT identifier where it has one, the number, the issue date, the
  // delivery date or the period, whichever the XML holds, and the due
  // date; the firm's line holds the seller's name, address and VAT number.
  test.each(samples)("%s's head prints the parties and dates of its XML", (_id, sample) => {
    const { blocks, columns, root } = page(sample)
    const buyer = `${HTA}/ram:BuyerTradeParty`
    const seller = `${HTA}/ram:SellerTradeParty`
    const vatId = textAt(root, `${buyer}/ram:SpecifiedTaxRegistration/ram:ID`)
    const delivered = textAt(root, `${HTD}/ram:ActualDeliverySupplyChainEvent/ram:OccurrenceDateTime/${DATE}`)
    const start = textAt(root, `${HTS}/ram:BillingSpecifiedPeriod/ram:StartDateTime/${DATE}`)
    const end = textAt(root, `${HTS}/ram:BillingSpecifiedPeriod/ram:EndDateTime/${DATE}`)
    expect(columns[0]?.columns.map((slot) => slot.blocks.map(textOf))).toEqual([
      [textAt(root, `${buyer}/ram:Name`), textAt(root, `${buyer}/ram:PostalTradeAddress/ram:LineOne`), `${textAt(root, `${buyer}/ram:PostalTradeAddress/ram:PostcodeCode`)} ${textAt(root, `${buyer}/ram:PostalTradeAddress/ram:CityName`)}`, ...(vatId === undefined ? [] : [`USt-IdNr.: ${vatId}`])],
      [
        'Rechnung',
        `Rechnungsnummer: ${textAt(root, 'rsm:ExchangedDocument/ram:ID')}`,
        `Rechnungsdatum: ${day(textAt(root, `rsm:ExchangedDocument/ram:IssueDateTime/${DATE}`))}`,
        ...(delivered === undefined ? [] : [`Leistungsdatum: ${day(delivered)}`]),
        ...(start === undefined ? [] : [`Leistungszeitraum: ${day(start)} bis ${day(end)}`]),
        `Zahlbar bis: ${day(textAt(root, `${HTS}/ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime/${DATE}`))}`,
      ],
    ])
    const address = `${seller}/ram:PostalTradeAddress`
    expect(textOf(blocks[0] as Block)).toBe(`${textAt(root, `${seller}/ram:Name`)} · ${textAt(root, `${address}/ram:LineOne`)} · ${textAt(root, `${address}/ram:PostcodeCode`)} ${textAt(root, `${address}/ram:CityName`)} · USt-IdNr. ${textAt(root, `${seller}/ram:SpecifiedTaxRegistration/ram:ID`)}`)
  })

  // The terms printed are the XML's (BT-20); the bank details printed
  // beside the code are its account, BIC, account name, remittance and
  // amount due; and the EPC code asks for that amount to that account.
  // A page whose details named another account or amount than the XML
  // would be paid otherwise than the invoice says.
  test.each(samples)("%s's terms, bank details and code are its XML's payment", (_id, sample) => {
    const { blocks, root } = page(sample)
    const means = `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans`
    const texts = blocks.map(textOf)
    const due = textAt(root, `${SUMMATION}/ram:DuePayableAmount`) as string
    expect(texts).toContain(textAt(root, `${HTS}/ram:SpecifiedTradePaymentTerms/ram:Description`))
    const details = texts.filter((each) => /^(Empfänger|IBAN|BIC|Betrag|Referenz): /.test(each)).map((each) => (each.startsWith('IBAN: ') ? each.replaceAll(' ', '').replace('IBAN:', 'IBAN: ') : each))
    expect(details).toEqual([
      `Empfänger: ${textAt(root, `${means}/ram:PayeePartyCreditorFinancialAccount/ram:AccountName`)}`,
      `IBAN: ${textAt(root, `${means}/ram:PayeePartyCreditorFinancialAccount/ram:IBANID`)}`,
      `BIC: ${textAt(root, `${means}/ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID`)}`,
      `Betrag: ${euro(due)}`,
      `Referenz: ${textAt(root, `${HTS}/ram:PaymentReference`)}`,
    ])
    // The code's elements 5 to 8 (EPC069-12 v3.1 2.2): the BIC, the beneficiary, the account and the amount, as short as the EPC writes it.
    const codes = blocks.flatMap((block) => (block.kind === 'epcQrCode' ? [block.payload.split('\n').slice(4, 8)] : []))
    const [whole, rest] = due.split('.') as [string, string]
    const account = `${means}/ram:PayeePartyCreditorFinancialAccount`
    expect(codes).toEqual([[textAt(root, `${means}/ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID`), textAt(root, `${account}/ram:AccountName`), textAt(root, `${account}/ram:IBANID`), `EUR${whole}${rest === '00' ? '' : `.${rest.replace(/0$/, '')}`}`]])
  })
})
