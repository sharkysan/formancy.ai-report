/**
 * A payment part that holds SIX's examples: what a bill a builder adds
 * starts from, and what the starters print, since no creditor's account
 * may stand in a sample
 * ([0039](../../../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).
 *
 * The account is any of SIX's example accounts; the creditor, the debtor
 * and the reference are the ones a builder puts in, report-spec's
 * `QR_BILL_EXAMPLE`, so that a bill edited in a builder is warned of while
 * anything it was given is left. Only what is written in the report: a
 * text read from the data is not known until the render, which holds it to
 * SIX's rules and nothing more. The account and the reference are read by
 * report-spec's checks, which drop the spaces written for reading, so each
 * is compared as the code holds it; a party is the example's when it has
 * the example's parts and no other, each written as the example writes it,
 * the blanks around it aside, as SIX never sends them.
 *
 * One warning for the bill, naming each term that is an example, so that a
 * bill added from nothing is one problem to follow, not one per term.
 */
import { checkQrBillAccount, checkQrBillReference, QR_BILL_EXAMPLE, QR_BILL_EXAMPLE_ACCOUNTS } from '@formancy/report-spec'
import type { Inline, PaymentPart, QrBillAddress, ReportDefinition } from '@formancy/report-spec'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'

const ACCOUNTS: ReadonlySet<string> = new Set(QR_BILL_EXAMPLE_ACCOUNTS)

/** The text `runs` write when every run is literal, what no data can change; undefined otherwise, or for no runs at all. */
function written(runs: readonly Inline[] | undefined): string | undefined {
  return runs?.every((run) => run.kind === 'text') === true ? runs.map((run) => run.text).join('') : undefined
}

/** `text` as the code holds a reference, or undefined where it is none. */
function referenceOf(text: string | undefined): string | undefined {
  const checked = text === undefined ? undefined : checkQrBillReference(text)
  return checked?.ok === true ? checked.value.reference : undefined
}

const EXAMPLE_REFERENCE = referenceOf(QR_BILL_EXAMPLE.reference)

/** Whether `address` is `example`: the same parts, each written as the example writes it. */
function isExample(address: QrBillAddress | undefined, example: { readonly [P in keyof QrBillAddress]?: string }): boolean {
  if (address === undefined) return false
  const parts = new Set([...Object.keys(address), ...Object.keys(example)] as (keyof QrBillAddress)[])
  return [...parts].every((part) => written(address[part])?.trim() === example[part])
}

/** Each term a bill may hold an example of, in the order the code holds them, and whether it does. */
const TERMS: readonly (readonly [term: string, held: (bill: PaymentPart) => boolean])[] = [
  [
    'account',
    (bill) => {
      const text = written(bill.account)
      const checked = text === undefined ? undefined : checkQrBillAccount(text)
      return checked?.ok === true && ACCOUNTS.has(checked.value.iban)
    },
  ],
  ['creditor', (bill) => isExample(bill.creditor, QR_BILL_EXAMPLE.creditor)],
  ['debtor', (bill) => isExample(bill.debtor, QR_BILL_EXAMPLE.debtor)],
  ['reference', (bill) => referenceOf(written(bill.reference)) === EXAMPLE_REFERENCE],
]

/** "account", "account and creditor", "account, creditor and debtor". */
const listed = (terms: readonly string[]): string => (terms.length < 2 ? terms.join('') : `${terms.slice(0, -1).join(', ')} and ${terms.at(-1) as string}`)

export function examplePaymentPartDiagnostics(report: ReportDefinition): Diagnostic[] {
  const bill = report.paymentPart
  if (bill === undefined) return []
  const held = TERMS.filter(([, holds]) => holds(bill)).map(([term]) => term)
  if (held.length === 0) return []
  const one = held.length === 1
  const message = `the payment part's ${listed(held)} ${one ? "is SIX's example" : "are SIX's examples"} (IG 2.4, Annex A), no one's: replace ${one ? 'it' : 'them'} before the bill is sent`
  return [diagnostic('example-payment-part', message, { path: '/paymentPart' })]
}
