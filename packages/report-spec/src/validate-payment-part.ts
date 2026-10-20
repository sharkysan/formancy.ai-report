/**
 * The payment part: its shape, the page it is printed on, and SIX's rules
 * applied to every text no data can change.
 *
 * Its texts are runs read in the report's scope and encoded in the bill's
 * QR code, so they read what a paragraph in the summary reads and never a
 * page number or count. A text of literal runs prints the same in every
 * render, so `qr-bill.ts`'s rules are applied to it here, where it is
 * written, as `validate-payment-text.ts` reads every payment code's texts;
 * any other is checked by the runtime with the same rules, once the data
 * has resolved it.
 */
import { kindOf, oneOf, optional, readObject, shape, strictKeys } from './check.js'
import type { PageSettings } from './page.js'
import { PAYMENT_PART_KINDS, QR_BILL_CURRENCIES, QR_BILL_LANGUAGES } from './payment-part.js'
import type { PaymentPart, PaymentPartKind, QrBillAddress, SwissQrBill } from './payment-part.js'
import { at } from './pointer.js'
import {
  checkQrBillAccount,
  checkQrBillAdditionalInformation,
  checkQrBillReference,
  checkQrBillText,
  QR_BILL_ADDRESS_RULES,
  QR_BILL_BILLING_RULE,
  QR_BILL_MESSAGE_RULE,
  qrBillPageBreak,
  qrBillPairing,
} from './qr-bill.js'
import type { QrBillCheck, QrBillPageBreak, QrBillTextRule } from './qr-bill.js'
import type { Ctx } from './validate-context.js'
import { readExpression } from './validate-inline.js'
import { readPaymentText, unquoted } from './validate-payment-text.js'
import type { PaymentScope, PaymentText } from './validate-payment-text.js'
import type { Inline } from './values.js'

/** Where a bill's runs are read: in the report's scope, encoded in its QR code. */
const SCOPE: PaymentScope = { region: 'paymentPart', reads: 'report', encoded: 'a QR-bill' }

/**
 * Where each rule of the page is reported: the A4 rule on the page, whose
 * size and orientation are what the author changes, and the slip's room on
 * the top margin.
 */
const PAGE_FIELDS: { readonly [F in QrBillPageBreak['field']]: string } = { page: '/page', topMargin: '/page/margins/top' }

/** A text of the bill, read as every payment code's is, and refused as `invalid-qr-bill` when SIX's rule refuses it. */
function readText<T>(c: Ctx, value: unknown, path: string, what: string, check: (text: string) => QrBillCheck<T>): PaymentText<T> {
  return readPaymentText(c, value, path, SCOPE, 'invalid-qr-bill', what, check)
}

type AddressPart = keyof QrBillAddress

const ADDRESS_PARTS = Object.entries(QR_BILL_ADDRESS_RULES) as readonly (readonly [AddressPart, QrBillTextRule])[]
const REQUIRED_PARTS = ADDRESS_PARTS.filter(([, rule]) => rule.required).map(([part]) => part)
const OPTIONAL_PARTS = ADDRESS_PARTS.filter(([, rule]) => !rule.required).map(([part]) => part)

/** A party's address, each part read in the order the code holds them and held to its rule. */
function readAddress(c: Ctx, value: unknown, path: string, party: 'creditor' | 'debtor'): QrBillAddress | undefined {
  const o = typeof value === 'string' ? unquoted(c, path, 'an object', SCOPE) : shape(c.f, value, path, REQUIRED_PARTS, OPTIONAL_PARTS)
  if (o === undefined) return undefined
  const address: Partial<Record<AddressPart, readonly Inline[]>> = {}
  let whole = true
  for (const [part, rule] of ADDRESS_PARTS) {
    const { runs } = readText(c, o[part], at(path, part), `the ${party}'s ${rule.said}`, (text) => checkQrBillText(text, rule))
    if (runs !== undefined) address[part] = runs
    else if (o[part] !== undefined || rule.required) whole = false
  }
  return whole ? (address as QrBillAddress) : undefined
}

const BILL_REQUIRED = ['kind', 'language', 'account', 'creditor', 'currency']
const BILL_OPTIONAL = ['amount', 'debtor', 'reference', 'message', 'billingInformation']

/** Whether a property that is present was read: absent is read, as nothing. */
const read = (o: Record<string, unknown>, key: string, value: unknown): boolean => o[key] === undefined || value !== undefined

function readSwissQrBill(c: Ctx, o: Record<string, unknown>, path: string, page: PageSettings | undefined): SwissQrBill | undefined {
  strictKeys(c.f, o, path, BILL_REQUIRED, BILL_OPTIONAL)
  const broken = page && qrBillPageBreak(page)
  if (broken !== undefined) c.f.report(PAGE_FIELDS[broken.field], 'payment-part-page', broken.rule)
  const language = oneOf(c.f, o.language, at(path, 'language'), QR_BILL_LANGUAGES)
  const account = readText(c, o.account, at(path, 'account'), 'the account', checkQrBillAccount)
  const creditor = readAddress(c, o.creditor, at(path, 'creditor'), 'creditor')
  const currency = oneOf(c.f, o.currency, at(path, 'currency'), QR_BILL_CURRENCIES)
  const amount = readExpression(c.f, o.amount, at(path, 'amount'))
  const debtor = readAddress(c, o.debtor, at(path, 'debtor'), 'debtor')
  const reference = readText(c, o.reference, at(path, 'reference'), 'the reference', checkQrBillReference)
  const message = readText(c, o.message, at(path, 'message'), 'the message', (text) => checkQrBillText(text, QR_BILL_MESSAGE_RULE))
  const billing = readText(c, o.billingInformation, at(path, 'billingInformation'), 'the billing information', (text) => checkQrBillText(text, QR_BILL_BILLING_RULE))
  if (message.checked !== undefined && billing.checked !== undefined) {
    const together = checkQrBillAdditionalInformation(message.checked, billing.checked)
    if (together !== undefined) c.f.report(at(path, 'message'), 'invalid-qr-bill', together)
  }
  if (currency !== undefined) {
    // An account or a reference read from data is not known yet, nor is one
    // already refused; an absent reference is known: the bill has none.
    const kind = account.checked === undefined ? undefined : account.checked.qrIban ? 'qrIban' : 'iban'
    const type = o.reference === undefined ? 'NON' : reference.checked?.type
    for (const { field, rule } of qrBillPairing(kind, type, currency)) c.f.report(at(path, field), 'invalid-qr-bill', rule)
  }
  if (
    language === undefined ||
    account.runs === undefined ||
    creditor === undefined ||
    currency === undefined ||
    !read(o, 'amount', amount) ||
    !read(o, 'debtor', debtor) ||
    !read(o, 'reference', reference.runs) ||
    !read(o, 'message', message.runs) ||
    !read(o, 'billingInformation', billing.runs)
  ) {
    return undefined
  }
  return {
    kind: 'swissQrBill',
    language,
    account: account.runs,
    creditor,
    currency,
    ...optional('amount', amount),
    ...optional('debtor', debtor),
    ...optional('reference', reference.runs),
    ...optional('message', message.runs),
    ...optional('billingInformation', billing.runs),
  }
}

type PartReader<P extends PaymentPart> = (c: Ctx, o: Record<string, unknown>, path: string, page: PageSettings | undefined) => P | undefined

/** How each kind of payment part is read. A table over every kind, so a kind added to PAYMENT_PART_KINDS without a reader does not compile. */
const PARTS: { readonly [K in PaymentPartKind]: PartReader<Extract<PaymentPart, { kind: K }>> } = {
  swissQrBill: readSwissQrBill,
}

/** The payment part at `path`, read on `page`, the report's page when it could be read. Absent, the report has none. */
export function readPaymentPart(c: Ctx, value: unknown, path: string, page: PageSettings | undefined): PaymentPart | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, PAYMENT_PART_KINDS)
  if (o === undefined || kind === undefined) return undefined
  return PARTS[kind](c, o, path, page)
}
