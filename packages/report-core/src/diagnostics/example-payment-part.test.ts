import { QR_BILL_EXAMPLE, QR_BILL_EXAMPLE_ACCOUNTS } from '@formancy/report-spec'
import type { Inline, QrBillAddress, ReportDefinition, SwissQrBill } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { sampleReport } from '../test-support.js'
import { diagnose } from './diagnose.js'

/** The sample, its bill with `changes`. */
function billed(changes: Partial<SwissQrBill>): ReportDefinition {
  const report = sampleReport()
  return { ...report, paymentPart: { ...(report.paymentPart as SwissQrBill), ...changes } }
}

/** One literal run. */
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/** A party of SIX's, in plain text, as a bill's address of literal runs. */
const party = (parts: Readonly<Record<string, string>>): QrBillAddress => Object.fromEntries(Object.entries(parts).map(([part, text]) => [part, said(text)])) as unknown as QrBillAddress

/** The diagnostics of `report` about its bill. */
const aboutBill = (report: ReportDefinition): string[] =>
  diagnose(report)
    .filter((diagnostic) => diagnostic.path.startsWith('/paymentPart'))
    .map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}`)

const WARNED = ['warning example-payment-part /paymentPart']

describe('a bill that holds SIX’s examples', () => {
  // A bill a builder adds starts from SIX's example values (0039), and one
  // sent as it was would ask its payer to pay an account that is no
  // creditor's. A warning, not an error: the report prints as written, a
  // starter among them, and the warning stays listed while the account is
  // one of SIX's. Each of SIX's examples, as the code holds it and written
  // for reading, with its blanks and in more than one run.
  test('is warned of, on the bill, for each of SIX’s example accounts however it is written', () => {
    for (const account of QR_BILL_EXAMPLE_ACCOUNTS) {
      const spaced = account.replace(/(.{4})/g, '$1 ').trim()
      for (const runs of [said(account), said(spaced), [...said(spaced.slice(0, 9)), ...said(spaced.slice(9))]]) {
        expect(aboutBill(billed({ account: runs })), JSON.stringify(runs)).toEqual(WARNED)
      }
    }
  })

  // What else a builder puts in is SIX's too -- the creditor of the bill
  // it adds, the debtor it adds, the QR reference it gives a bill made to
  // pay a QR-IBAN -- and a bill whose account was replaced but that still
  // names SIX's sample foundation as its creditor, or still refers to
  // SIX's example invoice, would print it unwarned. Each is warned of
  // while it is all the example, blanks around a part aside, and the
  // reference also as the code holds it, without its spaces.
  test('is warned of for the creditor, the debtor and the reference a builder puts in from SIX’s examples', () => {
    const padded = party(Object.fromEntries(Object.entries(QR_BILL_EXAMPLE.creditor).map(([part, text]) => [part, ` ${text} `])))
    for (const changes of [
      { creditor: party(QR_BILL_EXAMPLE.creditor) },
      { creditor: padded },
      { debtor: party(QR_BILL_EXAMPLE.debtor) },
      { reference: said(QR_BILL_EXAMPLE.reference) },
      { reference: said(QR_BILL_EXAMPLE.reference.replaceAll(' ', '')) },
    ]) {
      expect(aboutBill(billed(changes)), JSON.stringify(changes)).toEqual(WARNED)
    }
  })

  // One warning for the bill, however much of it is an example: a bill
  // added from nothing is one problem to follow, not one per term. Its
  // words name each term that is an example, in the order the code holds
  // them, say what to do, and quote none of them: no value of a bill is in
  // a message (0022).
  test('is one warning naming each term that is an example, quoting none', () => {
    const message = (changes: Partial<SwissQrBill>): string | undefined => diagnose(billed(changes)).find((diagnostic) => diagnostic.code === 'example-payment-part')?.message
    expect(message({ account: said(QR_BILL_EXAMPLE.account) })).toBe("the payment part's account is SIX's example (IG 2.4, Annex A), no one's: replace it before the bill is sent")
    const whole = { account: said(QR_BILL_EXAMPLE.account), creditor: party(QR_BILL_EXAMPLE.creditor), debtor: party(QR_BILL_EXAMPLE.debtor), reference: said(QR_BILL_EXAMPLE.reference) }
    expect(message(whole)).toBe("the payment part's account, creditor, debtor and reference are SIX's examples (IG 2.4, Annex A), no one's: replace them before the bill is sent")
    expect(message({ creditor: party(QR_BILL_EXAMPLE.creditor), reference: said(QR_BILL_EXAMPLE.reference) })).toMatch(/^the payment part's creditor and reference are /)
    expect(diagnose(billed(whole)).filter((diagnostic) => diagnostic.code === 'example-payment-part')).toHaveLength(1)
    expect(message(whole)).not.toMatch(/CH\s?52|Muster|Bern|Seldwyla|00082/)
    expect(diagnose(billed(whole)).find((diagnostic) => diagnostic.code === 'example-payment-part')).not.toHaveProperty('componentId')
  })

  // An account of the creditor's own is what a bill should pay; one read
  // from the data is not known until the render, which holds it to SIX's
  // rules and nothing more. A party with one part of its own, one more
  // part than the example has, or one part read from the data is a person
  // editing it, no longer the example; SIX's second example's QR
  // reference, which the sample pays with, is no builder's, and a bill
  // with no debtor, no reference, or written text that is no reference, which
  // `diagnose` may be handed though no session holds it, refers to no
  // example. None is warned of, nor is a report with no bill.
  test('is the only bill warned of', () => {
    const { buildingNumber: _number, ...creditor } = party({ ...QR_BILL_EXAMPLE.creditor, buildingNumber: '1' })
    for (const changes of [
      { account: said('CH66 3080 8001 2345 6789 0') },
      { account: [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }] },
      { creditor: party({ ...QR_BILL_EXAMPLE.creditor, town: 'Thun' }) },
      { creditor: party({ ...QR_BILL_EXAMPLE.creditor, buildingNumber: '1' }) },
      { creditor: { ...creditor, name: [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }] } },
      { debtor: party({ ...QR_BILL_EXAMPLE.debtor, name: 'Pia Rutschmann' }) },
      { reference: said('21 00000 00003 13947 14300 09017') },
      { debtor: undefined },
      { reference: undefined },
      { reference: said('Invoice 2026-114') },
    ] as Partial<SwissQrBill>[]) {
      expect(aboutBill(billed(changes)), JSON.stringify(changes)).toEqual([])
    }
    const { paymentPart: _bill, ...unbilled } = sampleReport()
    expect(diagnose(unbilled).map((diagnostic) => diagnostic.code)).not.toContain('example-payment-part')
  })
})
