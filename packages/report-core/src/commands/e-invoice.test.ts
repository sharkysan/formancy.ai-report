import { walkComponents } from '@formancy/report-spec'
import type { EpcQrCodeComponent, FacturXInvoice, Inline, ReportDefinition, XRechnungInvoice } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, eInvoiceSample, frozen, refused, sampleReport, xrechnungSample } from '../test-support.js'
import { putEInvoice, removeEInvoice, setPaymentAccount, updateEInvoice } from './e-invoice.js'
import type { EInvoicePatch } from './e-invoice.js'

/** One literal run. */
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/** The e-invoice sample's e-invoice, which every case below starts from or replaces. */
const invoice = (): FacturXInvoice => eInvoiceSample().eInvoice as FacturXInvoice

/** The e-invoice sample without its e-invoice. */
function plain(): ReportDefinition {
  const { eInvoice: _invoice, ...report } = eInvoiceSample()
  return report
}

function open(report: ReportDefinition): ReportSession {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  return opening.session
}

/** The report's EPC QR codes, wherever they stand. */
function codes(report: ReportDefinition): EpcQrCodeComponent[] {
  return Object.values(report.regions)
    .flat()
    .filter((component): component is EpcQrCodeComponent => component.kind === 'epcQrCode')
}

/** An IBAN of another German account, its check digits right: the one the EPC's and ISO 13616's documents print. */
const OTHER = 'DE89 3704 0044 0532 0130 00'

/**
 * The e-invoice sample with a QR-bill it takes, as report-core's registry
 * test makes it: its payment account (BT-84) one of Switzerland, which a
 * bill can pay, its EPC QR code paying it too, with a Swiss bank's BIC,
 * and the bill in euro to it, as one printed with an e-invoice must be.
 */
function billed(): ReportDefinition {
  const report = eInvoiceSample()
  const account = said('CH93 0076 2011 6238 5295 7')
  const summary = report.regions.summary.map((component) =>
    component.kind === 'epcQrCode' ? { ...component, iban: account, bic: said('POFICHBEXXX') } : component,
  )
  const bill = sampleReport().paymentPart as NonNullable<ReportDefinition['paymentPart']>
  return {
    ...report,
    regions: { ...report.regions, summary },
    eInvoice: { ...invoice(), payment: { ...(invoice().payment as NonNullable<FacturXInvoice['payment']>), iban: account } },
    paymentPart: { kind: 'swissQrBill', language: 'de', account, creditor: bill.creditor, currency: 'EUR' },
  }
}

describe('putEInvoice', () => {
  // A host, a paste or a proposal puts an e-invoice in whole, into a
  // report without one or in place of the one it has, of either kind; the
  // rest of the report is the very object it was, so a builder redraws
  // nothing an e-invoice does not touch.
  test('puts an e-invoice in a report without one, or in place of the one it has, and shares the rest', () => {
    const report = frozen(plain())
    const added = accepted(putEInvoice(report, invoice()))
    expect(added.eInvoice).toEqual(invoice())
    expect(added.regions).toBe(report.regions)
    const xrechnung = xrechnungSample().eInvoice as XRechnungInvoice
    const replaced = accepted(putEInvoice(frozen(eInvoiceSample()), xrechnung))
    expect(replaced.eInvoice).toBe(xrechnung)
    expect(replaced.datasets).toEqual(eInvoiceSample().datasets)
  })

  // The command takes the invoice whole and judges none of it: EN 16931's
  // rules are report-spec's, so an e-invoice whose rate a standard-rated
  // category cannot have is refused by the validator the session asks, in
  // its words, and the session keeps the report it had (0008).
  test('leaves judging the e-invoice to the validator, which the session asks', () => {
    const session = open(plain())
    const before = session.document()
    const broken: FacturXInvoice = { ...invoice(), vat: [{ id: 'standard', code: 'S', rate: '0.4' }, ...invoice().vat.slice(1)] }
    const outcome = refused(session.apply((report) => putEInvoice(report, broken)))
    expect(outcome.code).toBe('invalid-document')
    expect(outcome.errors?.map((error) => `${error.code} ${error.path}`)).toEqual(['invalid-e-invoice /eInvoice/vat/0/rate'])
    expect(session.document()).toBe(before)
  })
})

describe('removeEInvoice', () => {
  // Taking the e-invoice away is one edit, which undo takes back to the
  // very e-invoice it was: its parties, its categories and its account
  // come back as they were.
  test('takes the e-invoice away, and its undo gives back the very e-invoice', () => {
    const session = open(eInvoiceSample())
    const before = session.document().eInvoice
    expect(session.apply((report) => removeEInvoice(report)).ok).toBe(true)
    expect(session.document()).not.toHaveProperty('eInvoice')
    expect(session.undo()).toBe(true)
    expect(session.document().eInvoice).toBe(before)
  })

  // A removal of what is not there would report success for nothing.
  test('refuses a report with no e-invoice, naming where one would be', () => {
    expect(refused(removeEInvoice(frozen(sampleReport())))).toMatchObject({ code: 'not-found', path: '/eInvoice' })
  })
})

describe('updateEInvoice', () => {
  // A term of the e-invoice is changed as a component's property is: the
  // patch sets what it names, removes an optional term given null -- as a
  // proposal carries a removal in JSON -- and leaves the rest of the
  // invoice and of the report the very objects they were.
  test('sets what the patch names, removes what it gives null, and shares the rest', () => {
    const report = frozen(eInvoiceSample())
    const buyer = { ...invoice().buyer, name: said('Gasthaus Zur Linde GmbH') }
    const patched = accepted(updateEInvoice(report, { buyer, paid: null, terms: said('Zahlbar binnen 14 Tagen') }))
    const { paid: _paid, ...rest } = invoice()
    expect(patched.eInvoice).toEqual({ ...rest, buyer, terms: said('Zahlbar binnen 14 Tagen') })
    expect(patched.eInvoice?.seller).toBe(report.eInvoice?.seller)
    expect(patched.regions).toBe(report.regions)
  })

  // The kind says which rules an invoice is held to and what a host takes
  // from it, a PDF/A-3b or an XML alone; one changed in place would read
  // an invoice by another kind's rules. A patch with no invoice to patch
  // is refused, as an update of a component that is not there is.
  test('refuses a change of its kind, and a report with no e-invoice', () => {
    const kind = { kind: 'xrechnung' } as unknown as EInvoicePatch
    expect(refused(updateEInvoice(frozen(eInvoiceSample()), kind))).toMatchObject({ code: 'immutable-property', path: '/eInvoice/kind' })
    expect(refused(updateEInvoice(frozen(sampleReport()), { terms: null }))).toMatchObject({ code: 'not-found', path: '/eInvoice' })
  })

  // What an XRechnung needs past EN 16931 is report-spec's to say: the
  // buyer's reference removed is the validator's refusal, naming the rule
  // that needs it, and the session keeps the XRechnung it had.
  test('leaves what an XRechnung needs to the validator, which refuses it by the rule that needs it', () => {
    const session = open(xrechnungSample())
    const before = session.document()
    const outcome = refused(session.apply((report) => updateEInvoice(report, { buyerReference: null })))
    expect(outcome.errors?.map((error) => error.path)).toEqual(['/eInvoice/buyerReference'])
    expect(outcome.errors?.[0]?.message).toContain('BR-DE-15')
    expect(session.document()).toBe(before)
  })
})

describe('setPaymentAccount', () => {
  // The e-invoice's account (BT-84) is the one every payment code printed
  // with it asks to be paid to, and each edit is validated whole (0008),
  // so an edit of any one of them alone is refused: one command changes
  // the e-invoice's, the QR-bill's and every EPC QR code's together, as
  // the account typed, and leaves everything else the very object it was.
  test('changes the account the e-invoice, its QR-bill and its EPC QR code share, in one edit', () => {
    const report = frozen(billed())
    const changed = accepted(setPaymentAccount(report, 'CH58 0079 1123 0008 8901 2'))
    const account = said('CH58 0079 1123 0008 8901 2')
    expect(changed.eInvoice?.payment?.iban).toEqual(account)
    expect(changed.paymentPart?.account).toEqual(account)
    expect(codes(changed).map((code) => code.iban)).toEqual([account])
    expect(changed.eInvoice?.payment?.bic).toBe(report.eInvoice?.payment?.bic)
    expect(changed.eInvoice?.seller).toBe(report.eInvoice?.seller)
    expect(changed.paymentPart?.creditor).toBe(report.paymentPart?.creditor)
    expect(changed.regions.body).toBe(report.regions.body)
  })

  // One undo step takes all of them back, as one edit made them: undo of
  // half an account change would leave a report the validator refuses.
  test('is one step in a session, which one undo takes back whole', () => {
    const session = open(billed())
    const before = session.document()
    accepted(session.apply((report) => setPaymentAccount(report, 'CH58 0079 1123 0008 8901 2')))
    expect(session.revision()).toBe(1)
    expect(session.undo()).toBe(true)
    expect(session.document().eInvoice).toBe(before.eInvoice)
    expect(session.document().paymentPart).toBe(before.paymentPart)
    expect(session.document().regions).toBe(before.regions)
  })

  // The validator holds every EPC QR code to BT-84, shown or hidden and at
  // any depth: a code behind a condition, and one inside a columns block,
  // left out of the edit would keep the old account, and the edit would be
  // refused as asking for another -- or, were the validator to miss one,
  // a hidden code would print the old account on the day its condition
  // holds. Both are changed in the one edit, which the session accepts.
  test('changes every EPC QR code, one behind a condition and one inside a columns block', () => {
    const report = billed()
    const top = report.regions.summary.find((component) => component.kind === 'epcQrCode') as EpcQrCodeComponent
    const nested = { ...top, id: 'nested-code' }
    const summary = [
      ...report.regions.summary.map((component) => (component.id === top.id ? { ...top, visibleWhen: { cel: 'true' } } : component)),
      {
        id: 'pay-columns',
        kind: 'columns' as const,
        columns: [
          { width: 'fill' as const, components: [nested] },
          { width: 'fill' as const, components: [] },
        ],
      },
    ]
    const session = open({ ...report, regions: { ...report.regions, summary } })
    accepted(session.apply((current) => setPaymentAccount(current, 'CH58 0079 1123 0008 8901 2')))
    const ibans = walkComponents(session.document()).flatMap(({ component }) => (component.kind === 'epcQrCode' ? [[component.id, component.iban]] : []))
    expect(ibans).toEqual([
      [top.id, said('CH58 0079 1123 0008 8901 2')],
      ['nested-code', said('CH58 0079 1123 0008 8901 2')],
    ])
    expect(session.revision()).toBe(1)
  })

  // An e-invoice without a QR-bill has its EPC QR code alone to keep in
  // step, and one with neither its own account alone.
  test('changes the codes a report has, and the e-invoice alone where it has none', () => {
    const one = accepted(setPaymentAccount(frozen(eInvoiceSample()), OTHER))
    expect([one.eInvoice?.payment?.iban, ...codes(one).map((code) => code.iban)]).toEqual([said(OTHER), said(OTHER)])
    expect(one).not.toHaveProperty('paymentPart')
    const bare = {
      ...eInvoiceSample(),
      regions: { ...eInvoiceSample().regions, summary: eInvoiceSample().regions.summary.filter((component) => component.kind !== 'epcQrCode') },
    }
    expect(accepted(setPaymentAccount(frozen(bare), OTHER)).eInvoice?.payment?.iban).toEqual(said(OTHER))
  })

  // The command writes the account and judges none of it: whether each
  // place takes it is report-spec's to say, each by its own rule, in the
  // validator's words, never quoting the account. A German account is
  // one a QR-bill cannot pay, so the bill refuses it where the e-invoice
  // would take it, and the EPC QR code's Swiss BIC, which the command
  // leaves as it was, is now another country's than its account's; one
  // whose check digits are wrong is refused at all three; and the session
  // keeps the report it had.
  test('leaves each place to refuse the account by its own rule, the report unchanged', () => {
    const session = open(billed())
    const before = session.document()
    const german = refused(session.apply((report) => setPaymentAccount(report, OTHER)))
    expect(german.code).toBe('invalid-document')
    expect(german.errors?.map((error) => `${error.code} ${error.path}`).sort()).toEqual([
      'invalid-epc-qr-code /regions/summary/3/bic',
      'invalid-qr-bill /paymentPart/account',
    ])
    expect(german.errors?.[0]?.message).not.toContain('DE89')
    const mistyped = refused(session.apply((report) => setPaymentAccount(report, 'CH58 0079 1123 0008 8901 3')))
    expect(mistyped.errors?.map((error) => error.path).sort()).toEqual(['/eInvoice/payment/iban', '/paymentPart/account', '/regions/summary/3/iban'].sort())
    expect(session.document()).toBe(before)
  })

  // Where a place reads the account from the data, it is the data's to
  // say and the render's to compare (0027): written over with the account
  // typed, a binding would become a literal, which no edit here makes
  // without saying so. The command refuses, naming the place, and changes
  // nothing.
  test('refuses where the e-invoice or a code reads its account from the data, naming the place', () => {
    const bound: readonly Inline[] = [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }]
    const invoiceBound = { ...billed(), eInvoice: { ...invoice(), payment: { ...(invoice().payment as NonNullable<FacturXInvoice['payment']>), iban: bound } } }
    expect(refused(setPaymentAccount(frozen(invoiceBound), OTHER))).toMatchObject({ code: 'read-from-data', path: '/eInvoice/payment/iban' })
    const billBound = { ...billed(), paymentPart: { ...(billed().paymentPart as NonNullable<ReportDefinition['paymentPart']>), account: bound } }
    expect(refused(setPaymentAccount(frozen(billBound), OTHER))).toMatchObject({ code: 'read-from-data', path: '/paymentPart/account' })
    const report = billed()
    const codeBound = {
      ...report,
      regions: {
        ...report.regions,
        summary: report.regions.summary.map((component) => (component.kind === 'epcQrCode' ? { ...component, iban: bound } : component)),
      },
    }
    expect(refused(setPaymentAccount(frozen(codeBound), OTHER))).toMatchObject({
      code: 'read-from-data',
      path: '/regions/summary/3/iban',
      componentId: 'payment-code',
    })
  })

  // Without an e-invoice no account is shared: a QR-bill and an EPC QR
  // code may pay two accounts, and each is edited alone. Without payment
  // instructions the e-invoice names no account to change.
  test('refuses a report with no e-invoice, and an e-invoice that names no account', () => {
    expect(refused(setPaymentAccount(frozen(sampleReport()), OTHER))).toMatchObject({ code: 'not-found', path: '/eInvoice' })
    const { payment: _payment, ...unpaid } = invoice()
    expect(refused(setPaymentAccount(frozen({ ...plain(), eInvoice: unpaid }), OTHER))).toMatchObject({ code: 'not-found', path: '/eInvoice/payment' })
  })
})
