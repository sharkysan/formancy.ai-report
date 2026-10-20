/**
 * When: each date term of the e-invoice, held to a day on the calendar,
 * the invoicing period, which ends no earlier than it starts, and the
 * time of supply a German invoice states.
 */
import { en16931Rule } from './en16931.js'
import type { En16931Rule } from './en16931.js'
import { no, ok } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'
import { isCalendarDate } from './syntax.js'

/** A date term of the e-invoice: what a refusal calls it, and the rule a final render's null breaks where the e-invoice needs it. */
export interface EInvoiceDateRule {
  readonly what: string
  readonly required?: En16931Rule
}

export type EInvoiceDateTerm = 'BT-2' | 'BT-9' | 'BT-72' | 'BT-73' | 'BT-74'

/** Each date term, by its business term. */
export const E_INVOICE_DATES: { readonly [T in EInvoiceDateTerm]: EInvoiceDateRule } = {
  'BT-2': { what: 'the issue date (BT-2)', required: 'BR-03' },
  'BT-9': { what: 'the payment due date (BT-9)' },
  'BT-72': { what: 'the delivery date (BT-72)' },
  'BT-73': { what: "the invoicing period's start (BT-73)" },
  'BT-74': { what: "the invoicing period's end (BT-74)" },
}

/**
 * A date term the data resolved, held to a day on the calendar written
 * YYYY-MM-DD, as the runtime holds a date. The editing core types a date
 * term as the ISO string a date field is read as, so any text passes it;
 * one that is not a day -- a name, 2026-02-29, a moment with its time --
 * would be written as a date no validator reads as one.
 */
export function checkEInvoiceDate(text: string): PaymentCheck<string> {
  return isCalendarDate(text) ? ok(text) : no('is not a day on the calendar written YYYY-MM-DD')
}

/**
 * The rule an invoicing period breaks whose dates the data resolved, or
 * undefined: it ends no earlier than it starts (BR-29). Both are calendar
 * dates written YYYY-MM-DD, as the runtime's dates are, so they compare as
 * text.
 */
export function checkInvoicingPeriod(start: string, end: string): string | undefined {
  if (!isCalendarDate(start) || !isCalendarDate(end)) return 'the invoicing period is not two dates written YYYY-MM-DD'
  return end < start ? en16931Rule('BR-29', 'the invoicing period ends (BT-74) before it starts (BT-73)') : undefined
}

/** The rule an invoicing period breaks by holding neither date (BR-CO-19), or undefined: `start` and `end` say which it holds. */
export function periodBreak(start: boolean, end: boolean): string | undefined {
  return start || end ? undefined : en16931Rule('BR-CO-19', 'an invoicing period has a start (BT-73), an end (BT-74), or both')
}

/**
 * The rule an invoice breaks that says nothing of when it was supplied, or
 * undefined: § 14 (4) 1 no. 6 UStG asks a German invoice for the time of
 * supply, which the XML gives as a delivery date or an invoicing period.
 * Not one of CEN's rules: FeRD's BR-FX-DE-04, as the specification is
 * transcribed [S], only warns of an invoice without one.
 */
export function supplyBreak(delivered: boolean, period: boolean): string | undefined {
  return delivered || period ? undefined : 'a German invoice says when it was supplied: a delivery date (BT-72), an invoicing period (BG-14), or both (§ 14 Abs. 4 Satz 1 Nr. 6 UStG)'
}
