import { describe, expect, test } from 'vitest'
import { E_INVOICE_CURRENCIES, E_INVOICE_KINDS, INVOICE_TYPE_CODES, PAYMENT_MEANS_CODES, VAT_CATEGORY_CODES } from './e-invoice.js'
import { EN16931_RULES } from './en16931.js'
import { reportHash } from './hash.js'
import { MAX_VAT_CATEGORIES } from './limits.js'
import { editable, eInvoiceReport, getAt, removeAt, richReport, setAt } from './test-support.js'
import type { ReportDefinition } from './types.js'
import { validateReport } from './validate.js'

const EI = '/eInvoice'

/** Runs of one literal text. */
const literal = (text: string): unknown[] => [{ kind: 'text', text }]

/** The e-invoice report with each edit made at its full pointer, a copy of each value; undefined removes what is there. */
function report(edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const document = editable(eInvoiceReport())
  for (const [pointer, value] of Object.entries(edits)) {
    if (value === undefined) removeAt(document, pointer)
    else setAt(document, pointer, JSON.parse(JSON.stringify(value)))
  }
  return document
}

/** The e-invoice report with each edit made at a pointer under the e-invoice. */
function invoice(edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return report(Object.fromEntries(Object.entries(edits).map(([pointer, value]) => [`${EI}${pointer}`, value])))
}

/** The code and path of each error a document is refused with; none when it is valid. */
function refusals(document: unknown): string[] {
  const outcome = validateReport(document)
  return outcome.valid ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`)
}

/** Every message said in this file, so the last case can hold the rule ids they name to the list the gate reads. */
const heard: string[] = []

/** The message of each error a document is refused with, by its path. */
function messages(document: unknown): Record<string, string> {
  const outcome = validateReport(document)
  const said = outcome.valid ? {} : Object.fromEntries(outcome.errors.map((error) => [error.path, error.message]))
  heard.push(...Object.values(said))
  return said
}

/** The EPC QR code the fixture's summary holds, which pays the e-invoice's account. */
const EPC = '/regions/summary/3'

describe('an e-invoice', () => {
  // The validator's copy is what a session commits and what is hashed. An
  // e-invoice it read and left out of its copy would be dropped by the
  // first edit, and not count in the hash that publication pins.
  test('is read back whole, and is part of what the hash names', () => {
    const outcome = validateReport(eInvoiceReport())
    expect(outcome.valid ? [] : outcome.errors).toEqual([])
    expect(outcome.valid && outcome.report).toEqual(eInvoiceReport())
    const without = report({ [EI]: undefined })
    const read = validateReport(without)
    expect(read.valid && Object.hasOwn(read.report, 'eInvoice')).toBe(false)
    expect(reportHash(eInvoiceReport())).not.toBe(reportHash(without as unknown as ReportDefinition))
    expect(reportHash(invoice({ '/vat/1/rate': '7' }) as unknown as ReportDefinition)).not.toBe(reportHash(eInvoiceReport()))
  })

  // One kind today, Factur-X in the EN 16931 profile, type 380, in euro.
  // Anything else -- XRechnung, BASIC, a credit note, francs -- is refused,
  // never written as though it were this (fail closed).
  test('is of a kind, a profile, a type and a currency this version writes', () => {
    expect(E_INVOICE_KINDS).toEqual(['facturX'])
    expect(INVOICE_TYPE_CODES).toEqual(['380'])
    expect(E_INVOICE_CURRENCIES).toEqual(['EUR'])
    expect(refusals(invoice({ '/kind': 'xRechnung' }))).toEqual([`unknown-kind ${EI}/kind`])
    expect(refusals(invoice({ '/kind': undefined }))).toEqual([`missing-property ${EI}/kind`])
    expect(refusals(invoice({ '/profile': 'basic' }))).toEqual([`not-one-of ${EI}/profile`])
    expect(refusals(invoice({ '/type': '381' }))).toEqual([`not-one-of ${EI}/type`])
    expect(refusals(invoice({ '/type': 380 }))).toEqual([`not-one-of ${EI}/type`])
    expect(refusals(invoice({ '/currency': 'CHF' }))).toEqual([`not-one-of ${EI}/currency`])
    expect(refusals(report({ [EI]: [] }))).toEqual([`wrong-type ${EI}`])
  })

  // Strict, as every shape is: allowances and charges, a credit note's
  // preceding invoice, a typo, are refused rather than ignored -- ignored,
  // a freight charge would be on the page and missing from the XML.
  test('has what an invoice needs, and nothing this version does not write', () => {
    for (const key of ['profile', 'type', 'currency', 'number', 'issued', 'seller', 'buyer', 'vat', 'lines']) {
      expect(refusals(invoice({ [`/${key}`]: undefined })), key).toEqual([`missing-property ${EI}/${key}`])
    }
    for (const key of ['buyerReference', 'payment', 'due', 'terms', 'paid']) expect(refusals(invoice({ [`/${key}`]: undefined })), key).toEqual(key === 'payment' ? [`invalid-e-invoice ${EPC}/iban`] : [])
    expect(refusals(invoice({ '/delivered': undefined }))).toEqual([])
    expect(refusals(invoice({ '/period': undefined }))).toEqual([])
    expect(refusals(invoice({ '/allowances': [] }))).toEqual([`unknown-property ${EI}/allowances`])
    expect(refusals(invoice({ '/seller/electronicAddress': literal('x') }))).toEqual([`unknown-property ${EI}/seller/electronicAddress`])
    expect(refusals(invoice({ '/buyer/taxNumber': literal('x') }))).toEqual([`unknown-property ${EI}/buyer/taxNumber`])
    expect(refusals(invoice({ '/payment/card': literal('x') }))).toEqual([`unknown-property ${EI}/payment/card`])
    for (const key of ['line1', 'postalCode', 'city', 'country']) {
      expect(refusals(invoice({ [`/seller/address/${key}`]: undefined })), key).toEqual([`missing-property ${EI}/seller/address/${key}`])
    }
    expect(refusals(invoice({ '/seller/address/line2': undefined }))).toEqual([])
  })

  // Every text is one run at least where it is present. An optional one
  // with none would be a second spelling of its absence, with a hash of
  // its own; a required one with none would leave EN 16931's term empty.
  test('has one run at least in every text it holds', () => {
    for (const pointer of ['/number', '/seller/name', '/seller/address/line2', '/buyer/legalId/id', '/buyerReference', '/terms', '/vat/2/reason', '/payment/iban']) {
      expect(refusals(invoice({ [pointer]: [] })), pointer).toEqual([`too-few ${EI}${pointer}`])
    }
  })

  // Its texts are read in the report's scope, as a paragraph's in the
  // summary are: never a detail field, which has no current row there,
  // nor a group's aggregate. Each is written into the XML, resolved once
  // before there are pages, so a page number or count has no value in any
  // of them; and an image field is drawn, never written.
  test("reads what a paragraph in the report's scope reads, and never a page number or count", () => {
    expect(refusals(invoice({ '/terms/1': { kind: 'aggregate', aggregate: 'lines', over: 'report' } }))).toEqual([])
    expect(refusals(invoice({ '/number/1': { kind: 'field', field: { dataset: 'detail', field: 'sku' } } }))).toEqual([`misplaced-detail-field ${EI}/number/1/field`])
    expect(refusals(invoice({ '/terms/1': { kind: 'aggregate', aggregate: 'lines', over: 'group' } }))).toEqual([`misplaced-group-aggregate ${EI}/terms/1/over`])
    expect(refusals(invoice({ '/buyer/name/0/field/field': 'signature' }))).toEqual([`binding-type-mismatch ${EI}/buyer/name/0/field`])
    for (const counter of [{ kind: 'pageNumber' }, { kind: 'pageCount' }]) {
      const document = invoice({ '/number/1': counter })
      expect(refusals(document), counter.kind).toEqual([`misplaced-page-counter ${EI}/number/1`])
      expect(messages(document)[`${EI}/number/1`]).toBe('what an e-invoice encodes is resolved once, before pages are counted, so a page number or count has no value in it')
    }
  })

  // Its dates and its paid amount are expressions, compiled and typed by
  // the core, not here: empty, one has nothing to evaluate.
  test('has dates and a paid amount that are expressions', () => {
    for (const pointer of ['/issued', '/delivered', '/period/start', '/due', '/paid']) {
      expect(refusals(invoice({ [pointer]: { cel: ' ' } })), pointer).toEqual([`empty-expression ${EI}${pointer}/cel`])
    }
    expect(refusals(invoice({ '/issued': '2026-10-17' }))).toEqual([`wrong-type ${EI}/issued`])
  })
})

describe('a literal text of the e-invoice', () => {
  // A text of literal runs is written the same into every invoice, so EN
  // 16931's rules are applied where it is written: a country written UK,
  // or a VAT identifier of the wrong prefix, is refused in the editor, not
  // by the buyer's system after the render was called final.
  test("is held to EN 16931's rules where it is written", () => {
    expect(refusals(invoice({ '/seller/address/country': literal('UK') }))).toEqual([`invalid-e-invoice ${EI}/seller/address/country`])
    expect(refusals(invoice({ '/buyer/address/country': literal('EL') }))).toEqual([`invalid-e-invoice ${EI}/buyer/address/country`])
    expect(refusals(invoice({ '/buyer/vatId': literal('UK123456789') }))).toEqual([`invalid-e-invoice ${EI}/buyer/vatId`])
    expect(refusals(invoice({ '/seller/name': literal('  ') }))).toEqual([`invalid-e-invoice ${EI}/seller/name`])
    expect(refusals(invoice({ '/buyerReference': literal(' ') }))).toEqual([`invalid-e-invoice ${EI}/buyerReference`])
    expect(refusals(invoice({ '/seller/address/line1': literal('Industriestraße\u00007') }))).toEqual([`invalid-e-invoice ${EI}/seller/address/line1`])
    // An account refused is not known, and no code is compared with it.
    expect(refusals(invoice({ '/payment/iban': literal('DE71 1102 2033 0123 4567 88') }))).toEqual([`invalid-e-invoice ${EI}/payment/iban`])
    // Literal runs are read as the text they make together.
    expect(refusals(invoice({ '/seller/address/country': [{ kind: 'text', text: 'D' }, { kind: 'text', text: 'E' }] }))).toEqual([])
  })

  // The message names the term, its BT and the rule, and never the text:
  // a name, a VAT identifier or an IBAN may be a person's.
  test('is refused naming the term and the rule, never the text', () => {
    const said = messages(
      invoice({
        '/seller/address/country': literal('UK'),
        '/buyer/vatId': literal('UK123456789'),
        '/seller/name': literal(' '),
        '/seller/address/line1': literal('Rutschmann\u0000weg'),
        '/terms': literal(' '),
      }),
    )
    expect(said).toEqual({
      [`${EI}/seller/name`]: "the seller's name (BT-27) is empty, and an e-invoice needs it (BR-06)",
      [`${EI}/seller/address/line1`]: "the seller's address line (BT-35) holds a character at character 11 that XML 1.0 cannot write",
      [`${EI}/seller/address/country`]: "the seller's country code (BT-40) is not a country code of those this release takes, a list narrower than ISO 3166-1's (BR-CL-14)",
      [`${EI}/buyer/vatId`]: "the buyer's VAT identifier (BT-48) does not begin with a country code this release takes as a VAT prefix, then the number it gives (BR-CO-09)",
      [`${EI}/terms`]: 'the payment terms (BT-20) is blank: a term the e-invoice does not hold is left out of it',
    })
    for (const message of Object.values(said)) expect(message).not.toMatch(/UK|Rutschmann/)
  })

  // What a literal breaks past CEN's rules is said by what asks for it: an
  // empty city by the UStG's full address, which no rule of CEN's needs; an
  // invoice number with two spaces by the token the XSD collapses it to; a
  // BIC by the EPC QR code's rule. Each is the template's to fix where it
  // is written, before a render.
  test('is refused for what the UStG, the XSD and the EPC ask of it, saying which', () => {
    const said = messages(invoice({ '/seller/address/city': literal(' '), '/number': literal('RE-2026  0042'), '/payment/bic': literal('FMNCDEF') }))
    expect(said).toEqual({
      [`${EI}/number`]: 'the invoice number (BT-1) holds white space the XML would not keep: its schema types the term as a token, read with each tab and line break as a space, two spaces as one, and none at either end',
      [`${EI}/seller/address/city`]: "the seller's city (BT-37) is empty, and a German invoice gives the full address of the seller and the buyer (§ 14 Abs. 4 Satz 1 Nr. 1 UStG)",
      [`${EI}/payment/bic`]: "the payment account's BIC (BT-86) is not a BIC: four letters or digits for the bank, two letters for its country, two letters or digits for its place, and three for a branch or none (ISO 9362)",
    })
  })

  // A text written as a plain string, or a party or an address written as
  // one, is refused as the wrong type without the quote the shared check
  // gives a string it finds: what is written there is a name, an address
  // or an account, which may be a person's.
  test('is refused unquoted when it is written as a string, not as runs', () => {
    const document = invoice({ '/seller/name': 'Pia Rutschmann', '/buyer/address': 'Musterstrasse 1, 8000 Bern', '/payment': 'DE71 1102 2033 0123 4567 89', '/buyer/legalId': '4012345000009' })
    expect(refusals(document).sort()).toEqual([
      `wrong-type ${EI}/buyer/address`,
      `wrong-type ${EI}/buyer/legalId`,
      `wrong-type ${EI}/payment`,
      `wrong-type ${EI}/seller/name`,
    ])
    for (const message of Object.values(messages(document))) expect(message).not.toMatch(/Rutschmann|Muster|1102|4012/)
    expect(refusals(report({ [EI]: 'Rechnung' }))).toEqual([`wrong-type ${EI}`])
  })

  // What a field, a parameter or an expression resolves to is not known
  // until a render, and is the runtime's to hold to the same rules:
  // refused here, a template that reads its buyer from the data could not
  // be written.
  test('is the only text checked: one read from the data is left to the render', () => {
    const region = [{ kind: 'parameter', parameter: 'region' }]
    expect(refusals(invoice({ '/seller/address/country': region, '/seller/vatId': region, '/payment/iban': region, '/vat/2/reason': region }))).toEqual([])
  })

  // A legal registration's scheme is a literal the template writes, held
  // to the list (BR-CL-11): the Leitweg-ID routes an invoice to a public
  // buyer and is not one.
  test('gives a legal registration in a scheme of the list, or none', () => {
    expect(refusals(invoice({ '/buyer/legalId/scheme': '0002' }))).toEqual([])
    expect(refusals(invoice({ '/buyer/legalId/scheme': undefined }))).toEqual([])
    const document = invoice({ '/buyer/legalId/scheme': '0204' })
    expect(refusals(document)).toEqual([`invalid-e-invoice ${EI}/buyer/legalId/scheme`])
    expect(messages(document)[`${EI}/buyer/legalId/scheme`]).toBe("the scheme of the buyer's legal registration identifier (BT-47-1) is not a scheme of those this release takes, a list narrower than ISO 6523's (BR-CL-11)")
    expect(refusals(invoice({ '/seller/legalId/scheme': 88 }))).toEqual([`wrong-type ${EI}/seller/legalId/scheme`])
  })
})

describe('the parties and the time of supply', () => {
  // BR-CO-26: a buyer identifies the seller by its VAT identifier or its
  // legal registration. BR-S-02, BR-E-02, BR-AE-02: a line of any category
  // needs the seller's VAT identifier or its tax number. A template
  // without them is refused once, on the seller, naming the rules of the
  // categories it declares.
  test("hold the seller's identification", () => {
    expect(refusals(invoice({ '/seller/taxNumber': undefined, '/seller/legalId': undefined }))).toEqual([])
    expect(refusals(invoice({ '/seller/vatId': undefined }))).toEqual([])
    const document = invoice({ '/seller/vatId': undefined, '/seller/taxNumber': undefined, '/seller/legalId': undefined })
    expect(refusals(document)).toEqual([`invalid-e-invoice ${EI}/seller`, `invalid-e-invoice ${EI}/seller`])
    const outcome = validateReport(document)
    const said = outcome.valid ? [] : outcome.errors.map((error) => error.message)
    heard.push(...said)
    expect(said).toEqual([
      'the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), one of which a buyer identifies a seller by (BR-CO-26)',
      'the seller has neither a VAT identifier (BT-31) nor a tax registration identifier (BT-32), one of which a line of these VAT categories needs (BR-S-02, BR-E-02, BR-AE-02)',
    ])
  })

  // BR-AE-02: reverse charge names the buyer by its VAT identifier or its
  // legal registration. Without a reverse-charged category, a buyer may
  // have neither.
  test("hold the buyer's identification where a category is reverse-charged", () => {
    expect(refusals(invoice({ '/buyer/vatId': undefined }))).toEqual([])
    expect(refusals(invoice({ '/buyer/vatId': undefined, '/buyer/legalId': undefined }))).toEqual([`invalid-e-invoice ${EI}/buyer`])
    expect(refusals(invoice({ '/buyer/vatId': undefined, '/buyer/legalId': undefined, '/vat/3': undefined }))).toEqual([])
  })

  // § 14 (4) 1 no. 6 UStG: a German invoice says when it was supplied,
  // by a delivery date or an invoicing period. A period is a start, an
  // end or both (BR-CO-19).
  test('hold the time of supply, and a period that is one', () => {
    const document = invoice({ '/delivered': undefined, '/period': undefined })
    expect(refusals(document)).toEqual([`invalid-e-invoice ${EI}/delivered`])
    expect(messages(document)[`${EI}/delivered`]).toBe('a German invoice says when it was supplied: a delivery date (BT-72), an invoicing period (BG-14), or both (§ 14 Abs. 4 Satz 1 Nr. 6 UStG)')
    expect(refusals(invoice({ '/period/start': undefined }))).toEqual([])
    expect(refusals(invoice({ '/period': {} }))).toEqual([`invalid-e-invoice ${EI}/period`])
    expect(refusals(invoice({ '/period/middle': { cel: 'params.from' } }))).toEqual([`unknown-property ${EI}/period/middle`])
  })
})

describe('the VAT categories', () => {
  // Three codes, S, E and AE; Z, K, G, O, L, M and B wait. A category of a
  // code this version does not write is refused, never written as another.
  test('are of a code this version writes', () => {
    expect(VAT_CATEGORY_CODES).toEqual(['S', 'E', 'AE'])
    expect(refusals(invoice({ '/vat/0/code': 'Z' }))).toEqual([`not-one-of ${EI}/vat/0/code`])
  })

  // BR-CO-18: an invoice has one VAT breakdown at least. The list is
  // bounded before it is read, as every list is.
  test('are one at least and at most MAX_VAT_CATEGORIES', () => {
    const document = invoice({ '/vat': [] })
    expect(refusals(document)).toEqual([`invalid-e-invoice ${EI}/vat`])
    expect(messages(document)[`${EI}/vat`]).toBe('an e-invoice declares one VAT category at least, the VAT breakdown (BG-23) its lines are in (BR-CO-18)')
    const rates = (count: number): unknown[] => Array.from({ length: count }, (_, index) => ({ id: `rate${index}`, code: 'S', rate: String(index + 1) }))
    const many = invoice({ '/vat': rates(MAX_VAT_CATEGORIES), '/buyer/vatId': undefined, '/buyer/legalId': undefined })
    expect(refusals(many)).toEqual([])
    expect(refusals(invoice({ '/vat': rates(MAX_VAT_CATEGORIES + 1) }))).toEqual([`too-many ${EI}/vat`])
  })

  // An id is what the page reads a category's basis and amount by,
  // `vatBasis.<id>`, and what a line names its category by: a field key,
  // unique, as every declaration's id is.
  test('each have an id of their own that an expression reads', () => {
    expect(refusals(invoice({ '/vat/1/id': 'standard' }))).toEqual([`duplicate-id ${EI}/vat/1/id`])
    expect(refusals(invoice({ '/vat/1/id': 'reduced-rate' }))).toEqual([`invalid-id ${EI}/vat/1/id`])
  })

  // BR-S-05, BR-E-05, BR-AE-05, and the rate this version takes: a
  // standard rate more than 0, the others 0, each a percentage below 100.
  test('have the rate their code allows', () => {
    expect(refusals(invoice({ '/vat/0/rate': '0' }))).toEqual([`invalid-e-invoice ${EI}/vat/0/rate`])
    expect(refusals(invoice({ '/vat/2/rate': '7' }))).toEqual([`invalid-e-invoice ${EI}/vat/2/rate`])
    expect(refusals(invoice({ '/vat/3/rate': '19' }))).toEqual([`invalid-e-invoice ${EI}/vat/3/rate`])
    expect(refusals(invoice({ '/vat/0/rate': '100' }))).toEqual([`invalid-e-invoice ${EI}/vat/0/rate`])
    expect(refusals(invoice({ '/vat/0/rate': 19 }))).toEqual([`wrong-type ${EI}/vat/0/rate`])
    expect(messages(invoice({ '/vat/0/rate': '0.00' }))[`${EI}/vat/0/rate`]).toBe("the VAT category's rate (BT-119) is 0, and a standard rated category's rate is more than 0 (BR-S-05)")
    // BR-CO-17 rounds a rate below 0.5 to 0, and then wants a tax that rounds to 0.
    expect(refusals(invoice({ '/vat/1/rate': '0.4' }))).toEqual([`invalid-e-invoice ${EI}/vat/1/rate`])
    expect(messages(invoice({ '/vat/1/rate': '0.4' }))[`${EI}/vat/1/rate`]).toMatch(/^the VAT category's rate \(BT-119\) is below 0\.5, .* \(BR-CO-17\)$/)
  })

  // BR-S-10, BR-E-10, BR-AE-10: an exempt or reverse-charged category says
  // why, where the property is; a standard rated one gives no reason.
  test('give a reason where they are exempt or reverse-charged, and only there', () => {
    expect(refusals(invoice({ '/vat/0/reason': literal('Steuerfrei') }))).toEqual([`invalid-e-invoice ${EI}/vat/0/reason`])
    expect(refusals(invoice({ '/vat/2/reason': undefined }))).toEqual([`invalid-e-invoice ${EI}/vat/2/reason`])
    expect(refusals(invoice({ '/vat/3/reason': undefined }))).toEqual([`invalid-e-invoice ${EI}/vat/3/reason`])
    expect(messages(invoice({ '/vat/2/reason': undefined }))[`${EI}/vat/2/reason`]).toBe('an exempt category gives its exemption reason (BR-E-10)')
  })

  // BR-S-08, BR-E-01, BR-AE-01: two categories that would be one
  // breakdown would each claim all of its lines. 19 and 19.00 are one
  // rate. The later is refused, where it differs from its own.
  test('are one breakdown each', () => {
    expect(refusals(invoice({ '/vat/1/rate': '19.00' }))).toEqual([`invalid-e-invoice ${EI}/vat/1/rate`])
    expect(refusals(invoice({ '/vat/4': { id: 'exempt2', code: 'E', rate: '0', reason: literal('Steuerfrei') } }))).toEqual([`invalid-e-invoice ${EI}/vat/4/code`])
    expect(messages(invoice({ '/vat/1/rate': '19.00' }))[`${EI}/vat/1/rate`]).toBe(
      "the VAT category's rate (BT-119) is the rate of an earlier standard rated category, and the standard rated lines have one breakdown for each rate (BR-S-08)",
    )
    expect(messages(invoice({ '/vat/4': { id: 'exempt2', code: 'E', rate: '0', reason: literal('Steuerfrei') } }))[`${EI}/vat/4/code`]).toBe(
      'the VAT category (BT-118) is a second exempt category, and the exempt lines have exactly one breakdown (BR-E-01)',
    )
  })
})

describe('the lines', () => {
  // A line is a row of the table over the detail dataset, by that table's
  // id: an id that is not the table's names lines nobody prints. A report
  // with no such table has no line to write (BR-16).
  test("are the rows of the report's table over the detail dataset", () => {
    expect(refusals(invoice({ '/lines/table': 'positions' }))).toEqual([`invalid-e-invoice ${EI}/lines/table`])
    expect(messages(invoice({ '/lines/table': 'positions' }))[`${EI}/lines/table`]).toBe('the lines are the rows of the table over the detail dataset, "lines", and this names another')
    const tableless = report({ '/regions/body/2': undefined })
    expect(refusals(tableless)).toEqual([`invalid-e-invoice ${EI}/lines/table`])
    expect(messages(tableless)[`${EI}/lines/table`]).toBe('an e-invoice has one line at least, a row of the table over the detail dataset, and this report has no such table (BR-16)')
  })

  // The name, quantity, net price and net amount are the columns that
  // print them, so the page and the XML read one evaluation of each line.
  // A column the table does not have prints nothing; one column naming two
  // terms prints one of them.
  test('are printed by columns of that table, one term each', () => {
    expect(refusals(invoice({ '/lines/netPrice': 'unit-price' }))).toEqual([`unknown-column ${EI}/lines/netPrice`])
    expect(refusals(invoice({ '/lines/netPrice': 'amount' }))).toEqual([`invalid-e-invoice ${EI}/lines/netAmount`])
    expect(refusals(invoice({ '/lines/name': 'Sku' }))).toEqual([`invalid-id ${EI}/lines/name`])
  })

  // A line the XML holds and the page hides would be a second invoice's
  // line (UStAE 14c.1 (4a)): no column that prints a term, no table that
  // prints the lines and no container around it may have a condition.
  test('are printed whatever the data: no column, table or container of theirs may be hidden', () => {
    expect(refusals(report({ '/regions/body/2/columns/4/visibleWhen': undefined }))).toEqual([])
    expect(refusals(invoice({ '/lines/name': 'shipped-at' }))).toEqual([`invalid-e-invoice ${EI}/lines/name`, `binding-type-mismatch ${EI}/lines/name`])
    expect(refusals(report({ '/regions/body/2/visibleWhen': { cel: 'true' } }))).toEqual([`invalid-e-invoice ${EI}/lines/table`])
    const sectioned = report({ '/regions/body/2': { id: 'framed', kind: 'section', visibleWhen: { cel: 'true' }, components: [getAt(eInvoiceReport(), '/regions/body/2')] } })
    expect(refusals(sectioned)).toEqual([`invalid-e-invoice ${EI}/lines/table`])
    expect(messages(sectioned)[`${EI}/lines/table`]).toBe('the lines are printed by a table that may be hidden, or that stands in a component that may be: every line the XML holds is printed')
  })

  // What each column prints is a detail field or an expression, read once
  // per row: a literal, a parameter or a total is the same in every row,
  // and a header field too. A field's type is the term's: a name is a
  // string, a quantity, price and amount a number. An expression's type is
  // the core's to check, where it is compiled.
  test('read each term from the row, of the type the term is', () => {
    expect(refusals(report({ '/regions/body/2/columns/0/value': { kind: 'text', text: 'Article' } }))).toEqual([`invalid-e-invoice ${EI}/lines/name`])
    expect(refusals(report({ '/regions/body/2/columns/1/value': { kind: 'parameter', parameter: 'min_quantity' } }))).toEqual([`invalid-e-invoice ${EI}/lines/quantity`])
    expect(refusals(report({ '/regions/body/2/columns/3/value': { kind: 'aggregate', aggregate: 'subtotal', over: 'report' } }))).toEqual([`invalid-e-invoice ${EI}/lines/netAmount`])
    expect(refusals(report({ '/regions/body/2/columns/0/value': { kind: 'field', field: { dataset: 'header', field: 'customer' } } }))).toEqual([`invalid-e-invoice ${EI}/lines/name`])
    expect(refusals(report({ '/regions/body/2/columns/0/value': { kind: 'field', field: { dataset: 'detail', field: 'quantity' } } }))).toEqual([`binding-type-mismatch ${EI}/lines/name`])
    expect(refusals(report({ '/regions/body/2/columns/2/value': { kind: 'field', field: { dataset: 'detail', field: 'sku' } } }))).toEqual([`binding-type-mismatch ${EI}/lines/netPrice`])
    expect(refusals(report({ '/regions/body/2/columns/0/value': { kind: 'expression', expression: { cel: 'row.sku' } } }))).toEqual([])
    expect(messages(report({ '/regions/body/2/columns/1/value': { kind: 'parameter', parameter: 'min_quantity' } }))[`${EI}/lines/quantity`]).toBe(
      'the invoiced quantity (BT-129) is read from each row, and its column prints a parameter: it prints a detail field or an expression',
    )
  })

  // The line's identifier, unit and category are codes a page need not
  // print, read from each row as an aggregate reads it: a detail field of
  // the code's type, or an expression.
  test('read their codes from each row', () => {
    expect(refusals(invoice({ '/lines/unit': { kind: 'field', field: { dataset: 'detail', field: 'quantity' } } }))).toEqual([`binding-type-mismatch ${EI}/lines/unit/field`])
    expect(refusals(invoice({ '/lines/id': { kind: 'field', field: { dataset: 'detail', field: 'quantity' } } }))).toEqual([])
    expect(refusals(invoice({ '/lines/id': { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }))).toEqual([`binding-type-mismatch ${EI}/lines/id/field`])
    expect(refusals(invoice({ '/lines/vat': { kind: 'field', field: { dataset: 'detail', field: 'category' } } }))).toEqual([`unknown-field ${EI}/lines/vat/field/field`])
    expect(refusals(invoice({ '/lines/vat': { kind: 'field', field: { dataset: 'header', field: 'customer' } } }))).toEqual([`not-one-of ${EI}/lines/vat/field/dataset`])
  })
})

describe('the payment instructions', () => {
  // BT-81: SEPA credit transfer or credit transfer, and no other means
  // this version writes. A credit transfer names its account (BR-61).
  test('are a credit transfer to an account', () => {
    expect(PAYMENT_MEANS_CODES).toEqual(['58', '30'])
    expect(refusals(invoice({ '/payment/means': '30' }))).toEqual([])
    expect(refusals(invoice({ '/payment/means': '31' }))).toEqual([`not-one-of ${EI}/payment/means`])
    expect(refusals(invoice({ '/payment/iban': undefined }))).toEqual([`missing-property ${EI}/payment/iban`])
  })

  // A literal account is held by the rule an EPC QR code's is: the
  // message names the term and the rule, never the account.
  test('name an account the rule of a SEPA credit transfer takes', () => {
    const document = invoice({ '/payment/iban': literal('CH44 3199 9123 0008 8901 2') })
    expect(refusals(document)).toEqual([`invalid-e-invoice ${EI}/payment/iban`])
    expect(messages(document)[`${EI}/payment/iban`]).toMatch(/^the payment account \(BT-84\) is a QR-IBAN/)
  })
})

describe('a payment code printed with an e-invoice', () => {
  // A slip that asks to be paid otherwise than the XML says is a page that
  // says something else than its invoice: refused where both are literal,
  // on the code, which is what a payer reads. The amount is an expression,
  // and whether it is the invoice's is the render's question.
  test('asks to be paid to the account the e-invoice names', () => {
    expect(refusals(report({ [`${EPC}/iban`]: literal('DE89 3704 0044 0532 0130 00'), [`${EPC}/bic`]: undefined }))).toEqual([`invalid-e-invoice ${EPC}/iban`])
    const document = report({ [`${EPC}/iban`]: literal('DE89 3704 0044 0532 0130 00'), [`${EPC}/bic`]: undefined })
    expect(messages(document)[`${EPC}/iban`]).toBe("the EPC QR code asks to be paid to another account than the e-invoice's payment account (BT-84): a page and its XML name one account")
    // Spaces and case are the reader's: the account is one.
    expect(refusals(report({ [`${EPC}/iban`]: literal('de7111022033 01234567 89') }))).toEqual([])
    const missing = invoice({ '/payment': undefined })
    expect(messages(missing)[`${EPC}/iban`]).toBe('the EPC QR code asks to be paid to an account, and the e-invoice names none: its payment instructions (BG-16) give the account (BT-84)')
  })

  // A code read from data on either side is not known until a render,
  // and the runtime compares them then.
  test('is compared only where both accounts are literal', () => {
    const region = [{ kind: 'parameter', parameter: 'region' }]
    expect(refusals(invoice({ '/payment/iban': region }))).toEqual([])
    expect(refusals(report({ [`${EPC}/iban`]: region }))).toEqual([])
  })

  // A hidden code is still printed by some render: it is held whatever
  // its condition says.
  test('is held whether or not it is shown', () => {
    expect(refusals(report({ [`${EPC}/visibleWhen`]: { cel: 'false' }, [`${EPC}/iban`]: literal('DE89 3704 0044 0532 0130 00'), [`${EPC}/bic`]: undefined }))).toEqual([`invalid-e-invoice ${EPC}/iban`])
  })

  // A QR-bill asks for the e-invoice's currency, EUR, and its account: a
  // slip in francs beside an invoice in euro asks for another payment.
  test('is a QR-bill in euro to the e-invoice account', () => {
    const iban = literal('CH52 0483 5012 3456 7100 0')
    const bill = { ...richReport().paymentPart, currency: 'EUR', account: iban, reference: literal('RF18 5390 0754 7034') }
    const withBill = (edits: Readonly<Record<string, unknown>>): Record<string, unknown> => report({ '/paymentPart': bill, [EPC]: undefined, [`${EI}/payment/iban`]: iban, ...edits })
    expect(refusals(withBill({}))).toEqual([])
    expect(refusals(withBill({ '/paymentPart/currency': 'CHF' }))).toEqual([`invalid-e-invoice /paymentPart/currency`])
    expect(messages(withBill({ '/paymentPart/currency': 'CHF' }))['/paymentPart/currency']).toBe("a QR-bill printed with an e-invoice asks for the e-invoice's currency, EUR (BT-5)")
    expect(refusals(withBill({ '/paymentPart/account': literal('CH93 0076 2011 6238 5295 7') }))).toEqual([`invalid-e-invoice /paymentPart/account`])
    expect(refusals(withBill({ [`${EI}/payment`]: undefined }))).toEqual([`invalid-e-invoice /paymentPart/account`])
  })
})

describe('what the e-invoice is held against, when it could not be read', () => {
  // A value refused where it is, or read from data, is not known: the
  // e-invoice says nothing more of it, so one mistake is reported once,
  // and a slip read from the data is left to the render to compare.
  test('is reported once, where it is, and not again by the e-invoice', () => {
    const iban = literal('CH52 0483 5012 3456 7100 0')
    const bill = { ...richReport().paymentPart, currency: 'EUR', account: iban, reference: literal('RF18 5390 0754 7034') }
    const withBill = (edits: Readonly<Record<string, unknown>>): Record<string, unknown> => report({ '/paymentPart': bill, [EPC]: undefined, [`${EI}/payment/iban`]: iban, ...edits })
    expect(refusals(withBill({ '/paymentPart/account': [{ kind: 'parameter', parameter: 'region' }] }))).toEqual([])
    expect(refusals(withBill({ '/paymentPart/account': literal('CH52 0483 5012 3456 7100 1') }))).toEqual(['invalid-qr-bill /paymentPart/account'])
    // A component refused leaves the regions unread: the lines' table and
    // the codes in them are not looked for, rather than reported missing.
    expect(refusals(report({ '/regions/summary/0/kind': 'chart' }))).toEqual(['unknown-kind /regions/summary/0/kind'])
    expect(refusals(report({ '/title': 42 }))).toEqual(['wrong-type /title'])
  })
})

describe('the title of an e-invoice', () => {
  // The renderer writes the title into the PDF/A's XMP, and its engine
  // writes it there unescaped: "Müller & Söhne <AG>" makes metadata that
  // is not XML, and a PDF that fails PDF/A. The title is the template's
  // own string, so it is refused where it is written, and the same title
  // without an e-invoice is the author's.
  test('holds no &, < or >, and nothing XML cannot write', () => {
    for (const title of ['Müller & Söhne', 'A < B', 'A > B', 'Rechnung\u0001']) {
      const document = report({ '/title': title })
      expect(refusals(document), title).toEqual(['invalid-e-invoice /title'])
      expect(refusals(report({ '/title': title, [EI]: undefined })), title).toEqual([])
    }
    expect(messages(report({ '/title': 'Müller & Söhne' }))['/title']).toBe("an e-invoice's title is written into its PDF/A's metadata, where &, < and > cannot stand as written: this one holds one")
    expect(refusals(report({ '/title': 'Müller + Söhne "AG"' }))).toEqual([])
  })
})

describe('the rules the validator names', () => {
  // Every rule id a refusal above said is one the gate holds to a fatal
  // rule of the pinned schematron: an id said here that it does not list
  // would escape the gate. Run last, over every message heard.
  test('are ids of the list the gate reads', () => {
    expect(heard.length).toBeGreaterThan(10)
    for (const message of heard) for (const [id] of message.matchAll(/BR-[A-Z0-9]+(?:-[0-9]+)?/g)) expect(EN16931_RULES, `${id} in "${message}"`).toContain(id)
  })
})
