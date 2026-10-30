import { describe, expect, test } from 'vitest'
import { reportHash } from './hash.js'
import { PAYMENT_PART_KINDS, QR_BILL_CURRENCIES, QR_BILL_LANGUAGES } from './payment-part.js'
import { edited, editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

const PART = '/paymentPart'

/** Runs of one literal text. */
const literal = (text: string): unknown[] => [{ kind: 'text', text }]

/** The fixture with each edit made, at a pointer under the payment part. */
function bill(edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return edited((r) => {
    for (const [pointer, value] of Object.entries(edits)) {
      if (value === undefined) removeAt(r, `${PART}${pointer}`)
      else setAt(r, `${PART}${pointer}`, value)
    }
  })
}

/** The message of each error a document is refused with, by its path. */
function messages(document: unknown): Record<string, string> {
  const outcome = validateReport(document)
  return outcome.valid ? {} : Object.fromEntries(outcome.errors.map((error) => [error.path, error.message]))
}

describe('a payment part', () => {
  // The validator's copy is what a session commits and what is hashed. A
  // payment part it read and left out of its copy would be dropped by the
  // first edit, and not count in the hash that publication pins.
  test('is read back whole, and is part of what the hash names', () => {
    const outcome = validateReport(richReport())
    expect(outcome.valid && outcome.report.paymentPart).toEqual(richReport().paymentPart)
    const without = edited((r) => removeAt(r, PART))
    const read = validateReport(without)
    expect(read.valid && Object.hasOwn(read.report, 'paymentPart')).toBe(false)
    expect(reportHash(richReport())).not.toBe(reportHash(without as never))
  })

  // One kind today. A kind this version does not know -- a later one, or
  // the EPC code, which is not a payment part -- is refused, never skipped:
  // a bill skipped is a payment nobody can make (fail closed).
  test('is of a kind this version knows', () => {
    expect(PAYMENT_PART_KINDS).toEqual(['swissQrBill'])
    expect(refusals(bill({ '/kind': 'epcQrCode' }))).toEqual([`unknown-kind ${PART}/kind`])
    expect(refusals(bill({ '/kind': undefined }))).toEqual([`missing-property ${PART}/kind`])
    expect(refusals(edited((r) => setAt(r, PART, [])))).toEqual([`wrong-type ${PART}`])
  })

  // A bill's shape is strict, as every shape is: a property this version
  // does not know -- an ultimate creditor, which SIX says must not be
  // filled in, or a typo -- is refused rather than ignored.
  test('has a language, an account, a creditor and a currency, and nothing it does not know', () => {
    for (const key of ['language', 'account', 'creditor', 'currency']) {
      expect(refusals(bill({ [`/${key}`]: undefined })), key).toEqual([`missing-property ${PART}/${key}`])
    }
    for (const key of ['amount', 'debtor', 'reference', 'message', 'billingInformation']) {
      expect(refusals(bill({ [`/${key}`]: undefined })), key).toEqual(key === 'reference' ? [`invalid-qr-bill ${PART}/reference`] : [])
    }
    expect(refusals(bill({ '/ultimateCreditor': richReport().paymentPart?.creditor }))).toEqual([`unknown-property ${PART}/ultimateCreditor`])
    expect(refusals(bill({ '/creditor/addressLine1': literal('Musterstrasse 123') }))).toEqual([`unknown-property ${PART}/creditor/addressLine1`])
  })

  // The five languages of SIX's headings (IG 2.4, Annex C) and its two
  // currencies (IG Table 8, Ccy), and no others: a slip in Spanish, or in
  // dollars, is not a QR-bill any bank reads.
  test('is in one of the five languages and one of the two currencies SIX has', () => {
    expect(QR_BILL_LANGUAGES).toEqual(['de', 'fr', 'it', 'en', 'rm'])
    expect(QR_BILL_CURRENCIES).toEqual(['CHF', 'EUR'])
    for (const language of QR_BILL_LANGUAGES) expect(refusals(bill({ '/language': language })), language).toEqual([])
    expect(refusals(bill({ '/language': 'es' }))).toEqual([`not-one-of ${PART}/language`])
    expect(refusals(bill({ '/language': 'de-CH' }))).toEqual([`not-one-of ${PART}/language`])
    expect(refusals(bill({ '/currency': 'USD' }))).toEqual([`not-one-of ${PART}/currency`])
  })

  // Every text is one run at least where it is present. An optional one
  // with none would be a second spelling of its absence, with a hash of
  // its own; a required one with none would print nothing where SIX needs
  // something.
  test('has one run at least in every text it holds', () => {
    for (const pointer of ['/account', '/creditor/name', '/creditor/street', '/debtor/town', '/reference', '/message', '/billingInformation']) {
      expect(refusals(bill({ [pointer]: [] })), pointer).toEqual([`too-few ${PART}${pointer}`])
    }
  })

  // Its texts are read in the report's scope, as a paragraph's in the
  // summary are: a header field, a parameter, an aggregate over every row,
  // never a detail field, which has no current row there. Each is encoded
  // in the bill's QR code, resolved once before there are pages, so a page
  // number or count has no value in any of them; and an image field is
  // drawn, never printed.
  test("reads what a paragraph in the report's scope reads, and never a page number or count", () => {
    const lines = { kind: 'aggregate', aggregate: 'lines', over: 'report' }
    expect(refusals(bill({ '/message/2': lines, '/debtor/street': [{ kind: 'parameter', parameter: 'region' }] }))).toEqual([])
    expect(refusals(bill({ '/message/1': { kind: 'field', field: { dataset: 'detail', field: 'site' } } }))).toEqual([
      `misplaced-detail-field ${PART}/message/1/field`,
    ])
    expect(refusals(bill({ '/message/1': { kind: 'aggregate', aggregate: 'lines', over: 'group' } }))).toEqual([
      `misplaced-group-aggregate ${PART}/message/1/over`,
    ])
    expect(refusals(bill({ '/debtor/name/0/field/field': 'signature' }))).toEqual([`binding-type-mismatch ${PART}/debtor/name/0/field`])
    for (const counter of [{ kind: 'pageNumber' }, { kind: 'pageCount' }]) {
      const report = bill({ '/message/1': counter })
      expect(refusals(report), counter.kind).toEqual([`misplaced-page-counter ${PART}/message/1`])
      expect(messages(report)[`${PART}/message/1`]).toBe(
        'what a QR-bill encodes is resolved once, before pages are counted, so a page number or count has no value in it',
      )
    }
  })

  // The amount is an expression, compiled and typed by the core, not
  // here: empty, it has nothing to evaluate.
  test('has an amount that is an expression', () => {
    expect(refusals(bill({ '/amount': { cel: ' ' } }))).toEqual([`empty-expression ${PART}/amount/cel`])
    expect(refusals(bill({ '/amount': '12.50' }))).toEqual([`wrong-type ${PART}/amount`])
  })
})

describe('the page of a report with a payment part', () => {
  // The slip is 210 by 105 mm across the foot of an A4 page (IG 3.1). On
  // Letter it would not span the page, and in landscape it would not stand
  // at its foot: either way, not where SIX prints it. Refused once, on the
  // page, whose properties are what the author changes.
  test('is A4 in portrait', () => {
    for (const [size, orientation] of [
      ['A4', 'landscape'],
      ['Letter', 'portrait'],
      ['Letter', 'landscape'],
    ]) {
      const report = edited((r) => setAt(r, '/page', { ...(getAt(r, '/page') as object), size, orientation }))
      expect(refusals(report), `${size} ${orientation}`).toEqual(['payment-part-page /page'])
      expect(messages(report)['/page']).toBe(`a QR-bill is printed across the foot of an A4 page in portrait, and this page is ${size} in ${orientation}`)
    }
  })

  // The page header and the body start at the top margin, and the slip
  // is the page's foot, 105 mm tall: a top margin past the slip's top
  // would print the invoice into it. The editor refuses it where the
  // margin is written, as the renderer would refuse it at the first
  // render, by the same rule (`qrBillPageBreak`).
  test('leaves the slip its room below the top margin', () => {
    expect(refusals(edited((r) => setAt(r, '/page/margins/top', 544.25)))).toEqual([])
    const report = edited((r) => setAt(r, '/page/margins/top', 544.26))
    expect(refusals(report)).toEqual(['payment-part-page /page/margins/top'])
    expect(messages(report)['/page/margins/top']).toBe(
      "the top margin reaches 544.26 pt down the page, past the top of the QR-bill's slip at 544.25 pt, 105 mm above the paper's foot",
    )
  })

  // A page that is not A4 in portrait has no slip to keep room for: its
  // size is what the author changes, and one refusal says so.
  test('is refused once, on the page, when it is neither A4 in portrait nor leaves the room', () => {
    const report = edited((r) => {
      setAt(r, '/page/size', 'Letter')
      setAt(r, '/page/margins/top', 560)
    })
    expect(refusals(report)).toEqual(['payment-part-page /page'])
  })

  // Without a payment part, the page is the author's to choose: any size,
  // and any top margin that leaves the printable area.
  test('is any page without one', () => {
    for (const [pointer, value] of [
      ['/page/orientation', 'landscape'],
      ['/page/margins/top', 600],
    ] as const) {
      const report = edited((r) => {
        setAt(r, pointer, value)
        removeAt(r, PART)
      })
      expect(refusals(report), pointer).toEqual([])
    }
  })
})

describe('a literal text on the bill', () => {
  // A text of literal runs prints the same in every render, so SIX's
  // rules are applied where it is written: a mistyped IBAN is refused in
  // the editor, not by a final render, or by the payer's bank.
  test("is held to SIX's rules where it is written", () => {
    expect(refusals(bill({ '/account': literal('CH44 3199 9123 0008 8901 3') }))).toEqual([`invalid-qr-bill ${PART}/account`])
    expect(refusals(bill({ '/reference': literal('21 00000 00003 13947 14300 09018') }))).toEqual([`invalid-qr-bill ${PART}/reference`])
    expect(refusals(bill({ '/creditor/country': literal('ch') }))).toEqual([`invalid-qr-bill ${PART}/creditor/country`])
    expect(refusals(bill({ '/creditor/name': literal('x'.repeat(71)) }))).toEqual([`invalid-qr-bill ${PART}/creditor/name`])
    expect(refusals(bill({ '/creditor/town': literal('  ') }))).toEqual([`invalid-qr-bill ${PART}/creditor/town`])
    expect(refusals(bill({ '/creditor/street': literal('Musterstrasse\n123') }))).toEqual([`invalid-qr-bill ${PART}/creditor/street`])
    expect(refusals(bill({ '/debtor/postalCode': literal('8'.repeat(17)) }))).toEqual([`invalid-qr-bill ${PART}/debtor/postalCode`])
    expect(refusals(bill({ '/billingInformation': literal('S1/10/1234') }))).toEqual([`invalid-qr-bill ${PART}/billingInformation`])
    // Literal runs are read as the text they make together.
    expect(
      refusals(
        bill({
          '/account': [
            { kind: 'text', text: 'CH44 3199 9123 ' },
            { kind: 'text', text: '0008 8901 2' },
          ],
        }),
      ),
    ).toEqual([])
  })

  // The message says what the rule is and which field broke it, and never
  // quotes the text: an IBAN, a name or a town may be a person's.
  test('is refused naming the field and the rule, never the text', () => {
    const said = messages(
      bill({
        '/account': literal('CH44 3199 9123 0008 8901 3'),
        '/creditor/country': literal('ch'),
        '/creditor/name': literal('Pia-Maria Rutschmann-Schnyder'.repeat(3)),
        '/debtor/postalCode': literal('Grosse Marktgasse 28'),
      }),
    )
    expect(said).toEqual({
      [`${PART}/account`]: 'the account has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)',
      [`${PART}/creditor/name`]: "the creditor's name is 87 characters long; SIX allows at most 70",
      [`${PART}/creditor/country`]: "the creditor's country is not a country code: two capital letters, as ISO 3166-1 writes one, such as CH",
      [`${PART}/debtor/postalCode`]: "the debtor's postal code is 20 characters long; SIX allows at most 16",
    })
    for (const message of Object.values(said)) expect(message).not.toMatch(/3199|Rutschmann|Marktgasse|"ch"/)
  })

  // A text written as a plain string, a run written as one, or an address
  // written as one, is not runs: refused as the wrong type, as everywhere,
  // but without the quote the shared check gives a string it finds. What
  // is written there is an IBAN, a name or an address, which may be a
  // person's, and the refusal reaches logs and the editor's screen.
  test('is refused unquoted when it is written as a string, not as runs', () => {
    const report = bill({
      '/account': 'CH44 3199 9123 0008 8901 2',
      '/creditor/name': 'Pia Rutschmann',
      '/creditor/town': ['Seldwyla'],
      '/debtor': 'Simon Muster, Musterstrasse 1, 8000 Bern',
    })
    expect(refusals(report).sort()).toEqual([
      `wrong-type ${PART}/account`,
      `wrong-type ${PART}/creditor/name`,
      `wrong-type ${PART}/creditor/town/0`,
      `wrong-type ${PART}/debtor`,
    ])
    for (const message of Object.values(messages(report))) expect(message).not.toMatch(/3199|Rutschmann|Seldwyla|Muster/)
  })

  // The message and the billing information share their 140 characters
  // (IG Table 8, AddInf): each within its own bound, the two together
  // past it, refused on the message.
  test('is a message and billing information within 140 characters together', () => {
    const billing = `//${'b'.repeat(68)}`
    expect(refusals(bill({ '/message': literal('a'.repeat(70)), '/billingInformation': literal(billing) }))).toEqual([])
    const report = bill({ '/message': literal('a'.repeat(71)), '/billingInformation': literal(billing) })
    expect(refusals(report)).toEqual([`invalid-qr-bill ${PART}/message`])
    expect(messages(report)[`${PART}/message`]).toBe('the message and the billing information are 141 characters long together; SIX allows at most 140')
  })

  // What a field, a parameter or an expression prints is not known until
  // a render, and is the runtime's to check with the same rules: refused
  // here, a template that reads its debtor from the data could not be
  // written.
  test('is the only text checked: one read from the data is left to the render', () => {
    const customer = [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }]
    expect(refusals(bill({ '/account': customer, '/reference': customer, '/creditor/country': customer, '/message': customer }))).toEqual([])
    expect(
      refusals(
        bill({
          '/account': [
            { kind: 'text', text: 'CH44 ' },
            { kind: 'parameter', parameter: 'region' },
          ],
        }),
      ),
    ).toEqual([])
  })
})

describe('the account, the reference and the currency of a bill', () => {
  // A QR-IBAN is paid to with a QR reference and nothing else, an IBAN
  // with a creditor reference or none (IG Table 8, Tp); from version 2.4,
  // valid from 14 November 2026, a QR-IBAN and a QR reference only in CHF
  // (IG 2.4, 2.10). Where the texts are literal, a pair SIX refuses is
  // refused where it is written, on the reference or on the currency.
  test('pair as SIX pairs them, where the texts are literal', () => {
    const iban = literal('CH52 0483 5012 3456 7100 0')
    const creditorReference = literal('RF18 5390 0754 7034')
    expect(refusals(bill({ '/account': iban, '/reference': creditorReference }))).toEqual([])
    expect(refusals(bill({ '/account': iban, '/reference': undefined }))).toEqual([])
    expect(refusals(bill({ '/account': iban, '/reference': creditorReference, '/currency': 'EUR' }))).toEqual([])
    expect(refusals(bill({ '/reference': undefined }))).toEqual([`invalid-qr-bill ${PART}/reference`])
    expect(refusals(bill({ '/reference': creditorReference }))).toEqual([`invalid-qr-bill ${PART}/reference`])
    expect(refusals(bill({ '/account': iban }))).toEqual([`invalid-qr-bill ${PART}/reference`])
    expect(refusals(bill({ '/currency': 'EUR' }))).toEqual([`invalid-qr-bill ${PART}/currency`])
    expect(messages(bill({ '/reference': undefined }))[`${PART}/reference`]).toBe('a QR-IBAN is paid to with a QR reference, and this bill has none')
  })

  // A QR reference is for CHF whatever the account is: a literal one in a
  // bill in EUR is refused even when the account is read from the data.
  test('refuse a literal QR reference in EUR whatever the account', () => {
    const customer = [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }]
    expect(refusals(bill({ '/account': customer, '/currency': 'EUR' }))).toEqual([`invalid-qr-bill ${PART}/currency`])
    expect(refusals(bill({ '/account': customer, '/reference': customer, '/currency': 'EUR' }))).toEqual([])
  })
})

describe('the fixture', () => {
  // Every case above edits the fixture's bill; were it not literal where
  // these cases expect it, they would pass for the wrong reason.
  test('holds a bill whose account and reference are literal and pair', () => {
    const report = editable(richReport())
    expect(getAt(report, `${PART}/account`)).toEqual(literal('CH44 3199 9123 0008 8901 2'))
    expect(getAt(report, `${PART}/reference`)).toEqual(literal('21 00000 00003 13947 14300 09017'))
    expect(refusals(report)).toEqual([])
  })
})
