/**
 * A payment code printed with an e-invoice -- the QR-bill, an EPC QR code
 * -- held to it once both have resolved: it asks for the amount due for
 * payment (BT-115), or leaves the amount to the payer, and to be paid to
 * the e-invoice's payment account (BT-84).
 *
 * The page and the XML are one invoice, or the page is a second one: a
 * picture that asks for another amount or another account than its
 * structured part says may count as a further invoice under § 14c UStG
 * (BMF, 15 October 2025, UStAE 14c.1 (4a)). report-spec refuses what a
 * template's literals break, its currency among them; what only the data
 * decides -- an amount is always an expression, an account may be read
 * from a field -- is compared here, by value, the account as each code's
 * own rule wrote it: its spaces dropped and its letters capitals. A code
 * whose amount or account its own rules refused is not compared again.
 */
import { compareDecimal } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import type { Render } from './render-context.js'

/** A payment code, as a refusal names it, and where its amount and its account stand. */
export interface PayingCode {
  /** "the payment part", "component pay-code". */
  readonly said: string
  /** "the QR-bill", "the EPC QR code". */
  readonly code: string
  readonly componentId?: string
  readonly amountPath: string
  readonly accountPath: string
}

/**
 * Records what `code`, which asks for `amount` -- null to leave it to the
 * payer -- to `account`, asks for that the e-invoice does not name; nothing
 * in a report that is no e-invoice, or where the e-invoice's account was
 * refused or a preview lacks it.
 */
export function checkPayable(render: Render, code: PayingCode, amount: Decimal | null, account: string): void {
  const payable = render.invoice?.payable
  if (payable === undefined) return
  const refuse = (path: string, message: string): void =>
    render.problems.error({ stage: 'resolve', code: 'invalid-e-invoice', path, message: `${code.said}: ${message}`, ...(code.componentId === undefined ? {} : { componentId: code.componentId }) })
  if (amount !== null && compareDecimal(amount, payable.amount) !== 0) {
    refuse(code.amountPath, `${code.code} asks for another amount than the e-invoice's amount due for payment (BT-115): a page and its XML ask for one amount`)
  }
  if (payable.account !== undefined && account !== payable.account) {
    refuse(code.accountPath, `${code.code} asks to be paid to another account than the e-invoice's payment account (BT-84): a page and its XML name one account`)
  }
}
