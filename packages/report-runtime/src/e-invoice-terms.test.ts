import { MAX_INLINES } from '@formancy/report-spec'
import type { EInvoice, FieldRef, Inline, ReportDefinition, VatCategory } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import { resolveReport } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'
import type { RuntimeError } from './resolve-errors.js'
import { invoiceData, invoiceReport, invoiceRow } from './test-support.js'
import { MAX_STRING_LENGTH } from './values.js'

/**
 * An e-invoice's terms but its lines -- its number, its dates, its
 * parties, its categories' reasons, its payment, its paid amount -- read
 * in the report's scope once the data has resolved them, and held to EN
 * 16931's rules (CEN/TC 434's CII artefacts 1.3.17, by number): the very
 * functions report-spec's validator applies to a literal, which it could
 * not apply to a value the data gives.
 */

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const read = (field: string): readonly Inline[] => [{ kind: 'field', field: header(field) }]
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-17T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

function refused(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): readonly RuntimeError[] {
  const outcome = resolveReport(report, data, options)
  if (outcome.ok) throw new Error('resolved, and was expected to be refused')
  return outcome.errors
}

/** The invoice report with its e-invoice changed by `patch`, and its header given the extra fields `fields`, strings unless typed `id:type`, every one nullable. */
function withInvoice(patch: (invoice: EInvoice) => EInvoice, fields: readonly string[] = []): ReportDefinition {
  const report = invoiceReport()
  const own = report.datasets.header as NonNullable<ReportDefinition['datasets']['header']>
  const added = fields.map((field) => {
    const [id = '', type = 'string'] = field.split(':')
    return { id, type: type as 'string' | 'integer' | 'decimal', label: id, nullable: true }
  })
  return { ...report, datasets: { ...report.datasets, header: { ...own, fields: [...own.fields, ...added] } }, eInvoice: patch(report.eInvoice as EInvoice) }
}

const xmlOf = (report: ReportDefinition, data: ReportData): string => resolved(report, data).document.eInvoice?.xml ?? ''

/** A refusal at `path`, its message ending as `ends`, every character of which is matched as itself. */
const refusal = (path: string, ends: string) => expect.objectContaining({ stage: 'resolve', code: 'invalid-e-invoice', path, message: expect.stringMatching(new RegExp(`^the e-invoice: .*${ends.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}$`)) })

describe("an e-invoice's texts", () => {
  // Each needed text the data gives as nothing is refused by the rule that
  // needs it, never written as an empty element the buyer's system would
  // read as the term left out: the number (BR-02), the buyer's name
  // (BR-07), the buyer's street and city (the UStG's full address, which
  // no rule of CEN's asks for), the buyer's country (BR-11).
  test.each([
    ['number', '/eInvoice/number', 'the invoice number (BT-1) is empty, and an e-invoice needs it (BR-02)'],
    ['buyer', '/eInvoice/buyer/name', "the buyer's name (BT-44) is empty, and an e-invoice needs it (BR-07)"],
    ['street', '/eInvoice/buyer/address/line1', "the buyer's address line (BT-50) is empty, and a German invoice gives the full address of the seller and the buyer (§ 14 Abs. 4 Satz 1 Nr. 1 UStG)"],
    ['city', '/eInvoice/buyer/address/city', "the buyer's city (BT-52) is empty, and a German invoice gives the full address of the seller and the buyer (§ 14 Abs. 4 Satz 1 Nr. 1 UStG)"],
    ['country', '/eInvoice/buyer/address/country', "the buyer's country code (BT-55) is empty, and an e-invoice needs it (BR-11)"],
  ])('refuses a needed text the data gives as nothing: %s', (field, path, message) => {
    // The remittance information reads the number too, after "Rechnung ": a text cut short.
    const remittance = field === 'number' ? [refusal('/eInvoice/payment/remittance', 'has a run with no value, and written without it the e-invoice would hold less than its runs print')] : []
    expect(refused(invoiceReport(), invoiceData(undefined, { [field]: null }))).toEqual([refusal(path, message), ...remittance])
    expect(refused(invoiceReport(), invoiceData(undefined, { [field]: '  ' }))).toEqual([refusal(path, message)])
  })

  // An optional text the data gives as nothing, nulls and all, is the
  // term left out of the XML: a nullable field's null is how data says
  // "none". The buyer here then has no VAT identifier, which its lines,
  // standard rated, do not need.
  test('leaves out an optional text the data gives as nothing', () => {
    const xml = xmlOf(invoiceReport(), invoiceData(undefined, { buyerVatId: null }))
    expect(xml).not.toContain('ATU12345678')
    expect(xml.match(/<ram:SpecifiedTaxRegistration>/g)).toHaveLength(1)
    expect(xmlOf(invoiceReport(), invoiceData(undefined, { buyerVatId: ' ' }))).not.toContain('schemeID="VA">ATU')
  })

  // Runs that print something around a null would write a text cut short:
  // "RE-" for an invoice whose number the data lacks. Refused, never
  // written, in a final render.
  test('refuses a text that prints something around a run with no value', () => {
    const report = withInvoice((invoice) => ({ ...invoice, number: [{ kind: 'text', text: 'RE-' }, ...read('number')] }))
    expect(refused(report, invoiceData(undefined, { number: null }))).toEqual([
      refusal('/eInvoice/number', 'the invoice number (BT-1) has a run with no value, and written without it the e-invoice would hold less than its runs print'),
      refusal('/eInvoice/payment/remittance', 'the remittance information (BT-83) has a run with no value, and written without it the e-invoice would hold less than its runs print'),
    ])
  })

  // What the data gives is held to the rule a literal is: a country of the
  // closed list (BR-CL-14), a VAT identifier with a country's prefix
  // (BR-CO-09), its spaces dropped; a text XML can hold. None is quoted.
  test.each([
    [{ country: 'UK' }, '/eInvoice/buyer/address/country', '(BR-CL-14)'],
    [{ buyerVatId: 'UK 123 456' }, '/eInvoice/buyer/vatId', '(BR-CO-09)'],
    [{ buyer: 'Huber\u0000GmbH' }, '/eInvoice/buyer/name', 'that XML 1.0 cannot write'],
  ])('holds what the data gives to its rule: %o', (patch, path, ends) => {
    const errors = refused(invoiceReport(), invoiceData(undefined, patch))
    expect(errors).toEqual([refusal(path, ends)])
    for (const value of Object.values(patch)) expect(errors[0]?.message).not.toContain(value.replace('\u0000', ''))
  })

  // The VAT identifier is written as its rule wrote it, its spaces
  // dropped; the country as its code.
  test('writes each text as its rule took it', () => {
    const xml = xmlOf(invoiceReport(), invoiceData(undefined, { buyerVatId: 'ATU 1234 5678', country: ' AT ' }))
    expect(xml).toContain('<ram:ID schemeID="VA">ATU12345678</ram:ID>')
    expect(xml).toContain('<ram:CountryID>AT</ram:CountryID>')
  })
})

describe("an e-invoice's dates", () => {
  // BR-03: an invoice has an issue date. Every other date is optional,
  // and one the data gives as null is left out.
  test('refuses an issue date with no value, and leaves out a due date with none', () => {
    expect(refused(invoiceReport(), invoiceData(undefined, { issuedOn: null }))).toEqual([refusal('/eInvoice/issued', 'the issue date (BT-2) has no value, and an e-invoice needs it (BR-03)')])
    const xml = xmlOf(invoiceReport(), invoiceData(undefined, { dueOn: null }))
    expect(xml).not.toContain('ram:SpecifiedTradePaymentTerms')
    expect(xml).toContain('<udt:DateTimeString format="102">20261017</udt:DateTimeString>')
  })

  // The editing core types a date as any text, since a date is read as its
  // ISO string. A text that is no day on the calendar would be written as
  // a date no validator reads as one (CII-DT-097), so it is refused.
  test('refuses a date that is no day on the calendar', () => {
    const report = withInvoice((invoice) => ({ ...invoice, due: { cel: 'header.dueText' } }), ['dueText'])
    expect(refused(report, invoiceData(undefined, { dueText: '31.10.2026' }))).toEqual([refusal('/eInvoice/due', 'the payment due date (BT-9) is not a day on the calendar written YYYY-MM-DD')])
    expect(xmlOf(report, invoiceData(undefined, { dueText: '2026-10-31' }))).toContain('<ram:DueDateDateTime>')
  })

  // § 14 (4) 1 no. 6 UStG asks a German invoice for the time of supply: a
  // delivery date or an invoicing period. One whose delivery date the data
  // gives as null, and which has no period, says nothing of it.
  test('refuses an invoice the data leaves without a time of supply', () => {
    expect(refused(invoiceReport(), invoiceData(undefined, { deliveredOn: null }))).toEqual([refusal('/eInvoice/delivered', '(§ 14 Abs. 4 Satz 1 Nr. 6 UStG)')])
  })

  // An invoicing period ends no earlier than it starts (BR-29); it is
  // written in the settlement, its two dates as the data gave them, in
  // place of a delivery date the data does not give.
  test('holds an invoicing period to its order, and writes it in place of a delivery date', () => {
    const report = withInvoice((invoice) => {
      const { delivered: _delivered, ...rest } = invoice
      return { ...rest, period: { start: { cel: 'header.issuedOn' }, end: { cel: 'header.dueOn' } } }
    })
    expect(refused(report, invoiceData(undefined, { dueOn: '2026-10-01' }))).toEqual([refusal('/eInvoice/period', 'the invoicing period ends (BT-74) before it starts (BT-73) (BR-29)')])
    const xml = xmlOf(report, invoiceData())
    expect(xml).toContain(['<ram:BillingSpecifiedPeriod>', '  <ram:StartDateTime>', '    <udt:DateTimeString format="102">20261017</udt:DateTimeString>'].map((line) => `      ${line}`).join('\n'))
    expect(xml).toContain('<ram:ApplicableHeaderTradeDelivery/>')
  })
})

describe('what the whole of an e-invoice needs', () => {
  const exempt = invoiceRow({ position: '2', vat: 'exempt', quantity: '40', amount: '10.00' })

  // BR-CO-26, BR-S-02: a buyer identifies a seller by its VAT identifier or
  // its legal registration, and a standard-rated line needs the seller's
  // VAT identifier or tax number. A seller whose VAT identifier the data
  // gives as nothing has neither.
  test("refuses a seller the data leaves without the identifiers its lines' categories need", () => {
    const report = withInvoice((invoice) => ({ ...invoice, seller: { ...invoice.seller, vatId: read('sellerVatId') } }), ['sellerVatId'])
    const errors = refused(report, invoiceData(undefined, { sellerVatId: null }))
    expect(errors).toEqual([refusal('/eInvoice/seller', '(BR-CO-26)'), refusal('/eInvoice/seller', '(BR-S-02)')])
    expect(xmlOf(report, invoiceData(undefined, { sellerVatId: 'DE 999 999 999' }))).toContain('<ram:ID schemeID="VA">DE999999999</ram:ID>')
  })

  // BR-AE-02: a reverse-charged line moves the tax to the buyer, who is
  // named by its VAT identifier. It is held of the categories the lines are
  // in: an invoice of no reverse-charged line needs none of the buyer.
  test("refuses a buyer the data leaves without a VAT identifier, where a line is reverse-charged", () => {
    const reverse: VatCategory = { id: 'reverse', code: 'AE', rate: '0', reason: said('Steuerschuldnerschaft des Leistungsempfängers') }
    const declared = withInvoice((invoice) => ({ ...invoice, vat: [...invoice.vat, reverse] }))
    // Null where no line is reverse-charged, which prints as nothing.
    const printing = { id: 'vat-reverse', kind: 'text' as const, content: (['vatBasis.reverse', 'vatAmount.reverse'] as const).map((cel) => ({ kind: 'expression' as const, expression: { cel } })) }
    const report = { ...declared, regions: { ...declared.regions, summary: [...declared.regions.summary, printing] } }
    const lines = [invoiceRow(), invoiceRow({ position: '2', vat: 'reverse', quantity: '160', amount: '40.00' })]
    expect(refused(report, invoiceData(lines, { buyerVatId: null }))).toEqual([refusal('/eInvoice/buyer', '(BR-AE-02)')])
    expect(xmlOf(report, invoiceData([invoiceRow()], { buyerVatId: null }))).not.toContain('<ram:CategoryCode>AE</ram:CategoryCode>')
    expect(xmlOf(report, invoiceData(lines))).toContain('<ram:ExemptionReason>Steuerschuldnerschaft des Leistungsempfängers</ram:ExemptionReason>')
  })

  // BR-E-10: an exempt category says why, in the breakdown of a category
  // a line is in. A reason the data gives as nothing is none.
  test('refuses an exempt category the data leaves without its reason, where a line is in it', () => {
    const report = withInvoice((invoice) => ({ ...invoice, vat: invoice.vat.map((category) => (category.code === 'E' ? { ...category, reason: read('reason') } : category)) }), ['reason'])
    expect(refused(report, invoiceData([invoiceRow(), exempt], { reason: null }))).toEqual([refusal('/eInvoice/vat/2/reason', '(BR-E-10)')])
    expect(xmlOf(report, invoiceData([invoiceRow()], { reason: null }))).not.toContain('ram:ExemptionReason')
    expect(xmlOf(report, invoiceData([invoiceRow(), exempt], { reason: 'Steuerfrei nach § 4 Nr. 11 UStG' }))).toContain('<ram:ExemptionReason>Steuerfrei nach § 4 Nr. 11 UStG</ram:ExemptionReason>')
  })
})

describe("an e-invoice's payment account and paid amount", () => {
  // The account a template reads from the data is held by the one rule an
  // EPC QR code's account is: a SEPA country's IBAN, its length and its
  // check digits right, no QR-IBAN (BR-61 needs one). Written as that rule
  // writes it, its spaces dropped and its letters capitals.
  test('holds an account from the data to the IBAN rule, and writes it as the rule does', () => {
    const report = withInvoice((invoice) => ({ ...invoice, payment: { means: '58', iban: read('iban') } }), ['iban'])
    expect(refused(report, invoiceData(undefined, { iban: 'DE84 0123 4567 0012 3456 78' }))).toEqual([refusal('/eInvoice/payment/iban', 'the payment account (BT-84) has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')])
    expect(refused(report, invoiceData(undefined, { iban: null }))).toEqual([refusal('/eInvoice/payment/iban', 'the payment account (BT-84) is empty, and an e-invoice needs it (BR-61)')])
    expect(xmlOf(report, invoiceData(undefined, { iban: 'de83 0123 4567 0012 3456 78' }))).toContain('<ram:IBANID>DE83012345670012345678</ram:IBANID>')
  })

  // BT-113 is a whole number of cents (BR-DEC-16), never rounded; the
  // amount due is the total with VAT less it (BR-CO-16), and both print.
  test('takes a paid amount of whole cents, and refuses one that is not', () => {
    const report = { ...withInvoice((invoice) => ({ ...invoice, paid: { cel: 'dec(header.paid)' } }), ['paid']) }
    const printing = { ...report, regions: { ...report.regions, summary: [...report.regions.summary, { id: 'due', kind: 'text' as const, content: [{ kind: 'expression' as const, expression: { cel: 'string(invoice.paid) + " / " + string(invoice.duePayable)' } }] }] } }
    expect(refused(printing, invoiceData(undefined, { paid: '1.005' }))).toEqual([refusal('/eInvoice/paid', 'the paid amount (BT-113) is not a whole number of cents, and the XML writes it with two decimals at most: it is rounded where the template computes it (BR-DEC-16)')])
    const xml = xmlOf(printing, invoiceData(undefined, { paid: '10' }))
    expect(xml).toContain('<ram:TotalPrepaidAmount>10.00</ram:TotalPrepaidAmount>')
    expect(xml).toContain('<ram:DuePayableAmount>19.75</ram:DuePayableAmount>')
  })
})

describe('what an e-invoice reads in a way it cannot write', () => {
  // A term whose expression fails, or gives what the editing core could
  // only type as anything, is refused where it stands, by its own error,
  // and nothing is written: the issue date's evaluation, a date read from
  // a number, a paid amount read from text, a run of a text that fails.
  test('refuses a term whose expression fails, or gives another type than the term', () => {
    const failing = withInvoice((invoice) => ({ ...invoice, issued: { cel: 'string(divide(dec(1), dec(0), 2))' } }))
    expect(refused(failing, invoiceData())).toEqual([expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', path: '/eInvoice/issued/cel', message: expect.stringMatching(/^the e-invoice: /) })])
    const dated = withInvoice((invoice) => ({ ...invoice, due: { cel: 'header.dueCount' } }), ['dueCount:integer'])
    expect(refused(dated, invoiceData(undefined, { dueCount: '14' }))).toEqual([refusal('/eInvoice/due', 'the payment due date (BT-9) is a date, and this gives an integer')])
    const declared = withInvoice((invoice) => ({ ...invoice, paid: { cel: 'header.paidText' } }), ['paidText'])
    const printing = { id: 'due', kind: 'text' as const, content: (['invoice.paid', 'invoice.duePayable'] as const).map((cel) => ({ kind: 'expression' as const, expression: { cel } })) }
    const paid = { ...declared, regions: { ...declared.regions, summary: [...declared.regions.summary, printing] } }
    expect(refused(paid, invoiceData(undefined, { paidText: '10.00' }))).toEqual([refusal('/eInvoice/paid', 'the paid amount (BT-113) is a decimal, and this gives a string')])
    const run = withInvoice((invoice) => ({ ...invoice, buyerReference: [{ kind: 'expression', expression: { cel: 'string(divide(dec(1), dec(0), 2))' } }] }))
    expect(refused(run, invoiceData())).toEqual([expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', path: '/eInvoice/buyerReference/0/expression/cel' })])
  })
})

describe("an e-invoice's optional parts", () => {
  // A legal registration is written with its scheme where it has one, and
  // left out where the data gives it as nothing; an invoice with no
  // payment instructions writes none, and its codes, which report-spec
  // refuses beside it, cannot be held to an account.
  test('are written where they are, and left out where they are not', () => {
    const registered = withInvoice((invoice) => ({ ...invoice, buyer: { ...invoice.buyer, legalId: { id: read('register'), scheme: '0088' } } }), ['register'])
    expect(xmlOf(registered, invoiceData(undefined, { register: '4012345000009' }))).toContain(['<ram:SpecifiedLegalOrganization>', '          <ram:ID schemeID="0088">4012345000009</ram:ID>'].join('\n'))
    expect(xmlOf(registered, invoiceData(undefined, { register: null }))).not.toContain('SpecifiedLegalOrganization')
    // A German commercial register number has no ISO 6523 scheme, and is written without one.
    const register = withInvoice((invoice) => ({ ...invoice, seller: { ...invoice.seller, legalId: { id: said('HRB 12345') } } }))
    expect(xmlOf(register, invoiceData())).toContain('<ram:SpecifiedLegalOrganization>\n          <ram:ID>HRB 12345</ram:ID>')
    const unpaid = withInvoice((invoice) => {
      const { payment: _payment, ...rest } = invoice
      return rest
    })
    const xml = xmlOf(unpaid, invoiceData())
    expect(xml).not.toContain('SpecifiedTradeSettlementPaymentMeans')
    expect(xml).not.toContain('PaymentReference')
  })
})

describe("an e-invoice's electronic addresses, its seller's contact and its business process", () => {
  /** The invoice report with every term past 0027's read from a header field of its own (0037). */
  const addressed = withInvoice(
    (invoice) => ({
      ...invoice,
      businessProcess: read('process'),
      seller: { ...invoice.seller, electronicAddress: { id: read('sellerAddress'), scheme: 'EM' }, contact: { name: read('contactName'), telephone: read('telephone'), email: read('email') } },
      buyer: { ...invoice.buyer, electronicAddress: { id: read('buyerAddress'), scheme: '0088' } },
    }),
    ['process', 'sellerAddress', 'contactName', 'telephone', 'email', 'buyerAddress'],
  )
  const given = { process: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0', sellerAddress: 'rechnung@muster-soehne.example', contactName: 'Erika Mustermann', telephone: '+49 221 4710 123', email: 'erika.mustermann@muster-soehne.example', buyerAddress: '4012345000009' }

  // What the data gives each is written, each address with the scheme the
  // template names: the receiver's system routes the invoice by them.
  test('writes each as the data gives it, an address with its scheme', () => {
    const xml = xmlOf(addressed, invoiceData(undefined, given))
    for (const written of [
      '<ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>',
      '<ram:URIID schemeID="EM">rechnung@muster-soehne.example</ram:URIID>',
      '<ram:PersonName>Erika Mustermann</ram:PersonName>',
      '<ram:CompleteNumber>+49 221 4710 123</ram:CompleteNumber>',
      '<ram:URIID>erika.mustermann@muster-soehne.example</ram:URIID>',
      '<ram:URIID schemeID="0088">4012345000009</ram:URIID>',
    ]) {
      expect(xml, written).toContain(written)
    }
  })

  // None is needed in a German B2B invoice, so what the data gives as
  // nothing is left out: an address with its scheme, which names nothing
  // without it, and the contact whole where it has none of its three.
  test('leaves out each the data gives as nothing, a contact whole where it has none of its terms', () => {
    const none = { process: null, sellerAddress: ' ', contactName: null, telephone: null, email: null, buyerAddress: null }
    const bare = xmlOf(addressed, invoiceData(undefined, none))
    expect(bare).toBe(xmlOf(invoiceReport(), invoiceData()))
  })

  // A contact gives all three of its terms or none, as the validator holds
  // a literal one to (0037) and as XRechnung needs each (BR-DE-5 to -7):
  // one the data gives in part, written with what it has, is the contact
  // the same template would write as an XRechnung that KoSIT refuses.
  // Refused at each term it lacks, never quoting what it has; a preview,
  // which lacks what it has no value for, says nothing of it.
  test('refuses a contact the data gives in part, at each term it lacks', () => {
    const lacks = (term: string) => `${term} is empty, and a contact gives all three of its terms or none`
    const errors = refused(addressed, invoiceData(undefined, { ...given, contactName: ' ', telephone: null }))
    expect(errors).toEqual([refusal('/eInvoice/seller/contact/name', lacks("the seller's contact point (BT-41)")), refusal('/eInvoice/seller/contact/telephone', lacks("the seller's contact telephone number (BT-42)"))])
    for (const error of errors) expect(error.message).not.toContain(given.email)
    expect(refused(addressed, invoiceData(undefined, { ...given, email: null }))).toEqual([refusal('/eInvoice/seller/contact/email', lacks("the seller's contact email address (BT-43)"))])
    expect(resolved(addressed, invoiceData(undefined, { ...given, telephone: null }), PREVIEW).ok).toBe(true)
  })

  // What the data gives is held to the rule a literal is: a telephone
  // number of fewer than three digits (XRechnung's BR-DE-27), an email
  // address of another shape (BR-DE-28), an identifier with white space
  // the XML's token would collapse. None is quoted.
  test.each([
    [{ telephone: '0 1' }, '/eInvoice/seller/contact/telephone', "the seller's contact telephone number (BT-42) has fewer than three digits, which a telephone number has at least (XRechnung's BR-DE-27)"],
    [{ email: 'erika.mustermann@example' }, '/eInvoice/seller/contact/email', "(XRechnung's BR-DE-28)"],
    [{ process: 'urn:a  b' }, '/eInvoice/businessProcess', 'the business process (BT-23) holds white space the XML would not keep'],
    [{ buyerAddress: '4012345000009 ' }, '/eInvoice/buyer/electronicAddress/id', "the buyer's electronic address (BT-49) holds white space the XML would not keep"],
  ])('holds what the data gives to its rule: %o', (patch, path, said) => {
    const errors = refused(addressed, invoiceData(undefined, { ...given, ...patch }))
    expect(errors).toEqual([expect.objectContaining({ stage: 'resolve', code: 'invalid-e-invoice', path, message: expect.stringContaining(said) })])
    for (const value of Object.values(patch)) expect(errors[0]?.message).not.toContain(value.trim())
  })

  // The longest telephone number data can give, MAX_INLINES runs, all but
  // one each a string of MAX_STRING_LENGTH characters, is held to BR-DE-27
  // in time in proportion to its length: with XRechnung's expression run
  // as written (report-spec's xrechnung.test.ts), a sixteenth of it took
  // 21.4 s to resolve and failed the bound; with the digits counted, the
  // whole took 24 to 26 ms in three runs, measured on 20 October 2026 on
  // Node 24.21.0 and an Intel i9-10900K.
  test('holds the longest telephone number data can give to its rule in time in proportion to its length', () => {
    const half = Array.from({ length: MAX_INLINES / 2 }, () => read('telephone')).flat()
    const held = addressed.eInvoice as EInvoice
    const long: ReportDefinition = { ...addressed, eInvoice: { ...held, seller: { ...held.seller, contact: { name: read('contactName'), telephone: [...half.slice(1), ...said('12'), ...half], email: read('email') } } } }
    const started = Date.now()
    const errors = refused(long, invoiceData(undefined, { ...given, telephone: 'a'.repeat(MAX_STRING_LENGTH) }))
    expect(errors).toEqual([refusal('/eInvoice/seller/contact/telephone', "has fewer than three digits, which a telephone number has at least (XRechnung's BR-DE-27)")])
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})

describe('a preview of an e-invoice', () => {
  // A preview prints what it has: a needed text, a date or an account it
  // has no value for is one it lacks, and the time of supply and the
  // parties' identifiers, which only an absence breaks, it does not hold.
  test('takes a term it has no value for as one it lacks', () => {
    const lacking = invoiceData(undefined, { number: null, issuedOn: null, deliveredOn: null, buyer: null, country: null, buyerVatId: null })
    expect(resolved(invoiceReport(), lacking, PREVIEW).document.eInvoice).toBeUndefined()
  })

  // What the data does give it holds to the rules: a country no validator
  // takes is refused in a preview too, so that the author sees it before a
  // final render does.
  test('holds what the data gives to the rules', () => {
    expect(refused(invoiceReport(), invoiceData(undefined, { country: 'UK' }), PREVIEW)).toEqual([refusal('/eInvoice/buyer/address/country', '(BR-CL-14)')])
  })
})
