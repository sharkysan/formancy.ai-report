import type { PaymentPart, SwissQrBill } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { openReportSession } from '../session.js'
import { accepted, frozen, frozenSample, refused, sampleReport } from '../test-support.js'
import { putPaymentPart, removePaymentPart, updatePaymentPart } from './payment-part.js'
import type { PaymentPartPatch } from './payment-part.js'

/** The sample's bill, which every case below starts from or replaces. */
const bill = (): SwissQrBill => sampleReport().paymentPart as SwissQrBill

/** SIX's third example (IG 2.4, Annex A, Table 19): an IBAN, no amount, no debtor, no reference. */
const EXAMPLE_3: PaymentPart = {
  kind: 'swissQrBill',
  language: 'en',
  account: [{ kind: 'text', text: 'CH52 0483 5012 3456 7100 0' }],
  creditor: {
    name: [{ kind: 'text', text: 'Muster Stiftung (sample foundation)' }],
    street: [{ kind: 'text', text: 'P.O. box' }],
    postalCode: [{ kind: 'text', text: '3001' }],
    town: [{ kind: 'text', text: 'Bern' }],
    country: [{ kind: 'text', text: 'CH' }],
  },
  currency: 'CHF',
}

/** The sample without its bill. */
function unbilled(): ReturnType<typeof sampleReport> {
  const { paymentPart: _bill, ...report } = sampleReport()
  return report
}

describe('putPaymentPart', () => {
  // A builder adds a bill to a report that has none, and a proposal may
  // replace one whole; either way the rest of the report is the very
  // object it was, so a builder redraws nothing a bill does not touch.
  test('puts a bill in a report without one, or in place of the one it has, and shares the rest', () => {
    const report = frozen(unbilled())
    const added = accepted(putPaymentPart(report, EXAMPLE_3))
    expect(added.paymentPart).toBe(EXAMPLE_3)
    expect(added.regions).toBe(report.regions)
    const replaced = accepted(putPaymentPart(frozenSample(), EXAMPLE_3))
    expect(replaced).toEqual({ ...sampleReport(), paymentPart: EXAMPLE_3 })
  })

  // The command takes the bill whole and judges none of it: SIX's rules
  // are report-spec's, so a bill whose IBAN fails its check digits is
  // refused by the validator the session asks, and the session keeps the
  // report it had (0008).
  test('leaves judging the bill to the validator, which the session asks', () => {
    const opening = openReportSession(unbilled())
    if (!opening.ok) throw new Error('the sample did not open')
    const before = opening.session.document()
    const mistyped = { ...EXAMPLE_3, account: [{ kind: 'text', text: 'CH52 0483 5012 3456 7100 1' }] } as const
    const outcome = refused(opening.session.apply((report) => putPaymentPart(report, mistyped)))
    expect(outcome.code).toBe('invalid-document')
    expect(outcome.errors?.map((error) => `${error.code} ${error.path}`)).toEqual(['invalid-qr-bill /paymentPart/account'])
    expect(opening.session.document()).toBe(before)
  })
})

describe('removePaymentPart', () => {
  // Taking the bill away is one edit, which undo takes back to the very
  // bill it was: the slip's account and reference come back as they were.
  test('takes the bill away, and its undo gives back the very bill', () => {
    const opening = openReportSession(sampleReport())
    if (!opening.ok) throw new Error('the sample did not open')
    const before = opening.session.document().paymentPart
    expect(opening.session.apply((report) => removePaymentPart(report)).ok).toBe(true)
    expect(opening.session.document()).not.toHaveProperty('paymentPart')
    expect(opening.session.undo()).toBe(true)
    expect(opening.session.document().paymentPart).toBe(before)
  })

  // A removal of what is not there would report success for nothing, as
  // every command that names a thing refuses when it is not there.
  test('refuses a report with no bill, naming where one would be', () => {
    expect(refused(removePaymentPart(frozen(unbilled())))).toMatchObject({ code: 'not-found', path: '/paymentPart' })
  })
})

describe('updatePaymentPart', () => {
  // A field of the bill is changed as a component's property is: the
  // patch sets what it names, removes an optional property given null --
  // JSON's way, as a proposal carries it -- and leaves the rest of the
  // bill and of the report the very objects they were.
  test('sets what the patch names, removes what it gives null, and shares the rest', () => {
    const report = frozenSample()
    const account = [{ kind: 'text', text: 'CH58 0079 1123 0008 8901 2' }] as const
    const patched = accepted(updatePaymentPart(report, { account, reference: null, billingInformation: null }))
    const { reference: _reference, billingInformation: _billing, ...rest } = bill()
    expect(patched.paymentPart).toEqual({ ...rest, account })
    expect(patched.paymentPart?.creditor).toBe(report.paymentPart?.creditor)
    expect(patched.regions).toBe(report.regions)
  })

  // The kind says which rules a bill is held to; one changed in place
  // would read a bill by another kind's rules. A patch with no bill to
  // patch is refused, as an update of a component that is not there is.
  test('refuses a change of its kind, and a report with no bill', () => {
    const kind = { kind: 'swissQrBill' } as unknown as PaymentPartPatch
    expect(refused(updatePaymentPart(frozenSample(), kind))).toMatchObject({ code: 'immutable-property', path: '/paymentPart/kind' })
    expect(refused(updatePaymentPart(frozen(unbilled()), { message: null }))).toMatchObject({ code: 'not-found', path: '/paymentPart' })
  })
})
