/**
 * A report's payment part lowered to the document's: each text read in the
 * report's scope, held to SIX's rules, and made into the bill
 * (`qr-bill.ts`).
 *
 * - **Read as a paragraph.** Every text is its runs, read as a paragraph's
 *   in the report's scope and joined as a QR code's content is
 *   (`joinedText`): a final render refuses a run whose value is null, as
 *   `no-qr-value`, since the bill's code would say less than its texts.
 * - **Held to SIX's rules.** report-spec's checks, the very functions its
 *   validator applies to a literal, are applied to every text once it has
 *   resolved: a literal passes again, and a value from data is held where
 *   the validator could not see it. A rule broken is `invalid-qr-bill` on
 *   the field, naming the rule and never the value, which may be a
 *   person's name or account.
 * - **The same in a preview.** A preview prints a value that is null, or
 *   one its data lacks, as nothing, as a paragraph does; the bill that
 *   leaves is held to the same rules, and refused where it breaks one,
 *   saying the preview had no value for it. A bill SIX refuses cannot be
 *   drawn as one: its code would scan as a bill no bank pays.
 * - **The amount** is a decimal, or null for the payer to fill in. Any
 *   other value is refused by its type, and a decimal is written with its
 *   own digits, never rounded: one with more than two places is refused.
 * - **Printed with an e-invoice**, it asks for the amount due and to be
 *   paid to the e-invoice's account (`e-invoice-payable.ts`).
 */
import { decimalFromString, decimalToString } from '@formancy/expressions'
import {
  checkQrBillAccount,
  checkQrBillAdditionalInformation,
  checkQrBillAmount,
  checkQrBillReference,
  checkQrBillText,
  QR_BILL_ADDRESS_RULES,
  QR_BILL_BILLING_RULE,
  QR_BILL_MESSAGE_RULE,
  qrBillPairing,
} from '@formancy/report-spec'
import type { Expression, Inline, PaymentPart, PaymentPartKind, QrBillAddress, QrBillCheck, QrBillTextRule, SwissQrBill } from '@formancy/report-spec'
import type { QrBill } from './document.js'
import { checkPayable } from './e-invoice-payable.js'
import { joinedText } from './inlines.js'
import type { Encoder } from './inlines.js'
import { qrBillPart } from './qr-bill.js'
import type { CheckedAddress } from './qr-bill.js'
import { reportScope, valueOf } from './render-context.js'
import type { Render, Scope } from './render-context.js'

const PATH = '/paymentPart'

/** What an error in the payment part names it by: it stands in no component. */
const PART: Encoder = { said: 'the payment part', code: 'a QR-bill' }

/** What lowering one bill reads, and records its errors in. */
interface Lowering {
  readonly render: Render
  readonly scope: Scope
}

function refuse({ render }: Lowering, path: string, message: string): undefined {
  render.problems.error({ stage: 'resolve', code: 'invalid-qr-bill', path, message })
  return undefined
}

/**
 * The text the runs at `path` print, held to `check`, as `what` names it in
 * an error: what the check made of it, or undefined when a run or the rule
 * refused it, which is recorded. Absent runs print nothing, which the rule
 * judges: an optional text, nothing; a required one, empty.
 */
function checked<T>(lowering: Lowering, runs: readonly Inline[] | undefined, path: string, what: string, check: (text: string) => QrBillCheck<T>): T | undefined {
  const joined = joinedText(lowering.render, lowering.scope, runs ?? [], path, PART)
  if (joined === undefined) return undefined
  const outcome = check(joined.text)
  if (outcome.ok) return outcome.value
  return refuse(lowering, path, `${what} ${outcome.rule}${joined.lacking ? '; this preview has no value for a run of it' : ''}`)
}

const ADDRESS_PARTS = Object.entries(QR_BILL_ADDRESS_RULES) as readonly (readonly [keyof QrBillAddress, QrBillTextRule])[]

/** A party's address, each part held to its rule; undefined when a part is refused, which is recorded. */
function address(lowering: Lowering, value: QrBillAddress, path: string, party: 'creditor' | 'debtor'): CheckedAddress | undefined {
  const parts: Partial<Record<keyof QrBillAddress, string>> = {}
  let whole = true
  for (const [part, rule] of ADDRESS_PARTS) {
    const text = checked(lowering, value[part], `${path}/${part}`, `the ${party}'s ${rule.said}`, (each) => checkQrBillText(each, rule))
    if (text === undefined) whole = false
    else parts[part] = text
  }
  return whole ? (parts as CheckedAddress) : undefined
}

/** The amount as the code writes it, null for the payer to fill in, or undefined when it is refused, which is recorded. */
function amount(lowering: Lowering, expression: Expression | undefined): string | null | undefined {
  if (expression === undefined) return null
  const path = `${PATH}/amount`
  const value = valueOf(lowering.render, lowering.scope, `${path}/cel`)
  if (value === undefined || value === null) return value
  if (value.type !== 'decimal') return refuse(lowering, path, `the amount gives ${value.type}, and a QR-bill's amount is a decimal, or null to leave it for the payer`)
  const outcome = checkQrBillAmount(decimalToString(value.value))
  return outcome.ok ? outcome.value : refuse(lowering, path, `the amount ${outcome.rule}`)
}

/** `bill`, resolved and held to SIX's rules; undefined when anything of it is refused, which is recorded. */
function swissQrBill(lowering: Lowering, bill: SwissQrBill): QrBill | undefined {
  const account = checked(lowering, bill.account, `${PATH}/account`, 'the account', checkQrBillAccount)
  const creditor = address(lowering, bill.creditor, `${PATH}/creditor`, 'creditor')
  const sum = amount(lowering, bill.amount)
  const debtor = bill.debtor === undefined ? null : address(lowering, bill.debtor, `${PATH}/debtor`, 'debtor')
  const reference = bill.reference === undefined ? null : checked(lowering, bill.reference, `${PATH}/reference`, 'the reference', checkQrBillReference)
  const message = checked(lowering, bill.message, `${PATH}/message`, 'the message', (text) => checkQrBillText(text, QR_BILL_MESSAGE_RULE))
  const billing = checked(lowering, bill.billingInformation, `${PATH}/billingInformation`, 'the billing information', (text) => checkQrBillText(text, QR_BILL_BILLING_RULE))
  // What two texts break together, each already held to its own rules.
  const together = message === undefined || billing === undefined ? undefined : checkQrBillAdditionalInformation(message, billing)
  if (together !== undefined) refuse(lowering, `${PATH}/message`, together)
  if (account !== undefined && sum !== undefined) {
    const asked = { said: PART.said, code: 'the QR-bill', amountPath: `${PATH}/amount`, accountPath: `${PATH}/account` }
    checkPayable(lowering.render, asked, sum === null ? null : decimalFromString(sum), account.iban)
  }
  const pairing = account === undefined || reference === undefined ? [] : qrBillPairing(account.qrIban ? 'qrIban' : 'iban', reference?.type ?? 'NON', bill.currency)
  for (const { field, rule } of pairing) refuse(lowering, `${PATH}/${field}`, rule)
  if (together !== undefined || pairing.length > 0) return undefined
  if (account === undefined || creditor === undefined || sum === undefined || debtor === undefined || reference === undefined || message === undefined || billing === undefined) return undefined
  return qrBillPart({ language: bill.language, account, creditor, currency: bill.currency, amount: sum, debtor, reference, message, billingInformation: billing })
}

type PartLowerer<K extends PaymentPartKind> = (lowering: Lowering, part: Extract<PaymentPart, { kind: K }>) => QrBill | undefined

/** How each kind of payment part is lowered. A table over every kind, so a kind added to report-spec without a way down does not compile. */
const PARTS: { readonly [K in PaymentPartKind]: PartLowerer<K> } = {
  swissQrBill,
}

/** `render`'s payment part, lowered; undefined when the report has none, or when it is refused, which is recorded. */
export function lowerPaymentPart(render: Render): QrBill | undefined {
  const part = render.report.paymentPart
  if (part === undefined) return undefined
  return PARTS[part.kind]({ render, scope: reportScope(render, render.totals.report) }, part)
}
