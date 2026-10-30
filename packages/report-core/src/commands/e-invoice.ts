/**
 * Commands on the report's e-invoice: the one EN 16931 invoice a report may
 * carry, of either kind
 * ([0027](../../../../docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
 * [0038](../../../../docs/decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)),
 * put in whole, patched term by term and taken away; and the account it
 * shares with every payment code printed with it, changed in one edit
 * ([0044](../../../../docs/decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)).
 *
 * The e-invoice belongs to the report, not to a region, so these name no
 * place. Whether what they leave is an invoice EN 16931's and XRechnung's
 * rules accept -- its rates, its parties, what an XRechnung needs, an
 * account each code can pay -- is report-spec's question, which the session
 * asks of every edit alike (0008): a command here judges nothing of the
 * invoice but that there is one to change.
 */
import { walkComponents } from '@formancy/report-spec'
import type { EInvoice, FacturXInvoice, Inline, ReportDefinition, XRechnungInvoice } from '@formancy/report-spec'
import { patched } from '../lists.js'
import type { Patch } from '../lists.js'
import { refuse } from '../outcome.js'
import type { CommandOutcome, Refusal } from '../outcome.js'
import { updateAt } from '../tree.js'

/**
 * A change to some of an e-invoice's terms, but never its kind: `null`
 * removes an optional one, as JSON carries a removal. A term of the other
 * kind -- an XRechnung's version in a Factur-X invoice -- is the
 * validator's to refuse.
 */
export type EInvoicePatch = Patch<Omit<FacturXInvoice, 'kind'>> & Patch<Pick<XRechnungInvoice, 'version'>>

const PATH = '/eInvoice'

function missing(): Refusal {
  return refuse('not-found', 'the report has no e-invoice', { path: PATH })
}

/** The report with `invoice` for its e-invoice: added where it has none, in place of the one it has otherwise. */
export function putEInvoice(report: ReportDefinition, invoice: EInvoice): CommandOutcome {
  return { ok: true, report: { ...report, eInvoice: invoice } }
}

/** The report without its e-invoice. */
export function removeEInvoice(report: ReportDefinition): CommandOutcome {
  if (report.eInvoice === undefined) return missing()
  const { eInvoice: _removed, ...rest } = report
  return { ok: true, report: rest }
}

/** The report's e-invoice with `patch` applied; its kind never changes in place. */
export function updateEInvoice(report: ReportDefinition, patch: EInvoicePatch): CommandOutcome {
  const invoice = report.eInvoice
  if (invoice === undefined) return missing()
  if (Object.hasOwn(patch, 'kind'))
    return refuse('immutable-property', "an e-invoice's kind never changes in place; put a new e-invoice instead", { path: `${PATH}/kind` })
  return { ok: true, report: { ...report, eInvoice: patched(invoice, patch as Patch<EInvoice>) } }
}

/** Whether every run of `runs` is literal text: what no data can change, and what an edit may write over. */
function literal(runs: readonly Inline[]): boolean {
  return runs.every((run) => run.kind === 'text')
}

/** The refusal for an account the report reads from the data at `path`, which the command would write over with a literal. */
function readFromData(place: string, path: string, componentId?: string): Refusal {
  return refuse(
    'read-from-data',
    `${place} reads its account from the data, which says what it is at the render; bind the e-invoice's account and its payment codes alike, or write them alike`,
    {
      path,
      ...(componentId === undefined ? {} : { componentId }),
    },
  )
}

/**
 * The report with `account` as the account its e-invoice names (BT-84)
 * and every payment code printed with it asks to be paid to -- its
 * QR-bill's and each EPC QR code's, shown or hidden -- each as one literal
 * run, as typed: one edit, so one undo step, where an edit of any one of
 * them alone is refused, since report-spec holds each code to BT-84 (0027).
 * Refused where the report has no e-invoice, whose codes share no account,
 * or one that names no account; and where one of them reads its account
 * from the data, which this would write over. Whether the account is one
 * each place takes -- an IBAN of SEPA's, a QR-bill's of Switzerland or
 * Liechtenstein, no QR-IBAN in euro -- the validator says, each place by
 * its own rule. A BIC is left as it is: no rule holds a code's to BT-86.
 */
export function setPaymentAccount(report: ReportDefinition, account: string): CommandOutcome {
  const payment = report.eInvoice?.payment
  if (report.eInvoice === undefined) return missing()
  if (payment === undefined) return refuse('not-found', 'the e-invoice names no account: its payment instructions (BG-16) give it', { path: `${PATH}/payment` })
  if (!literal(payment.iban)) return readFromData("the e-invoice's payment account (BT-84)", `${PATH}/payment/iban`)
  const bill = report.paymentPart
  if (bill !== undefined && !literal(bill.account)) return readFromData('the QR-bill', '/paymentPart/account')
  const codes = walkComponents(report).filter(({ component }) => component.kind === 'epcQrCode')
  for (const { component, path } of codes) {
    if (component.kind === 'epcQrCode' && !literal(component.iban)) return readFromData('the EPC QR code', `${path}/iban`, component.id)
  }
  const runs: readonly Inline[] = [{ kind: 'text', text: account }]
  let next: ReportDefinition = { ...report, eInvoice: { ...report.eInvoice, payment: { ...payment, iban: runs } } }
  if (bill !== undefined) next = { ...next, paymentPart: { ...bill, account: runs } }
  for (const { path } of codes) next = updateAt<object>(next, path, (code) => ({ ...code, iban: runs }))
  return { ok: true, report: next }
}
