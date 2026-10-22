/**
 * Commands on the report's payment part: the one Swiss QR-bill a report may
 * print at the foot of its last page
 * ([0022](../../../../docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)),
 * put in whole, patched field by field and taken away
 * ([0039](../../../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).
 *
 * The bill belongs to the report, not to a region, so these name no place.
 * Whether what they leave is a bill SIX's rules accept -- its IBAN's check
 * digits, its reference beside its account, its page -- is report-spec's
 * question, which the session asks of every edit alike (0008): a command
 * here judges nothing of the bill but that there is one to change.
 */
import type { PaymentPart, ReportDefinition } from '@formancy/report-spec'
import { patched } from '../lists.js'
import type { Patch } from '../lists.js'
import { refuse } from '../outcome.js'
import type { CommandOutcome, Refusal } from '../outcome.js'

/** A change to some of a bill's properties, but never its kind: `null` removes an optional one, as JSON carries a removal. */
export type PaymentPartPatch = Patch<Omit<PaymentPart, 'kind'>>

const PATH = '/paymentPart'

function missing(): Refusal {
  return refuse('not-found', 'the report has no payment part', { path: PATH })
}

/** The report with `part` for its payment part: added where it has none, in place of the one it has otherwise. */
export function putPaymentPart(report: ReportDefinition, part: PaymentPart): CommandOutcome {
  return { ok: true, report: { ...report, paymentPart: part } }
}

/** The report without its payment part. */
export function removePaymentPart(report: ReportDefinition): CommandOutcome {
  if (report.paymentPart === undefined) return missing()
  const { paymentPart: _removed, ...rest } = report
  return { ok: true, report: rest }
}

/** The report's payment part with `patch` applied; its kind never changes in place. */
export function updatePaymentPart(report: ReportDefinition, patch: PaymentPartPatch): CommandOutcome {
  const part = report.paymentPart
  if (part === undefined) return missing()
  if (Object.hasOwn(patch, 'kind')) return refuse('immutable-property', "a payment part's kind never changes in place; put a new payment part instead", { path: `${PATH}/kind` })
  return { ok: true, report: { ...report, paymentPart: patched(part, patch as Patch<PaymentPart>) } }
}
