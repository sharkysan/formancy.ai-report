/**
 * The payment part: its shape, the page it is printed on, and SIX's rules
 * applied to every text no data can change.
 *
 * Its texts are runs read in the report's scope and encoded in the bill's
 * QR code, so they read what a paragraph in the summary reads and never a
 * page number or count. A text of literal runs prints the same in every
 * render, so `qr-bill.ts`'s rules are applied to it here, where it is
 * written; any other is checked by the runtime with the same rules, once
 * the data has resolved it.
 */
import { kindOf, oneOf, optional, readArray, readObject, shape, strictKeys } from './check.js'
import { MAX_INLINES } from './limits.js'
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
import type { Inline, PageSettings } from './types.js'
import type { Ctx } from './validate-context.js'
import { readExpression, readInlines } from './validate-inline.js'
import type { InlineScope } from './validate-inline.js'

/** Where a bill's runs are read: in the report's scope, encoded in its QR code. */
const SCOPE: InlineScope = { region: 'paymentPart', reads: 'report', encoded: 'a QR-bill' }

/**
 * Where each rule of the page is reported: the A4 rule on the page, whose
 * size and orientation are what the author changes, and the slip's room on
 * the top margin.
 */
const PAGE_FIELDS: { readonly [F in QrBillPageBreak['field']]: string } = { page: '/page', topMargin: '/page/margins/top' }

/** The text runs make when every one is literal; undefined when any is read from data, or there are none, which is refused as too few. */
function literal(runs: readonly Inline[]): string | undefined {
  if (runs.length === 0) return undefined
  let text = ''
  for (const run of runs) {
    if (run.kind !== 'text') return undefined
    text += run.text
  }
  return text
}

/** A text of the bill: its runs, and what SIX's rule made of them when they are literal and it accepted them. */
interface Text<T> {
  readonly runs: readonly Inline[] | undefined
  readonly checked: T | undefined
}

/**
 * A string where the bill expects runs, a run or an address, refused as
 * the wrong type without the quote the shared readers give a string they
 * find: written out, it is an IBAN, a name or a street, which may be a
 * person's.
 */
function unquoted(c: Ctx, path: string, expected: string): undefined {
  c.f.report(path, 'wrong-type', `expected ${expected}, found a string, which is not quoted: what a QR-bill holds may be a person's`)
  return undefined
}

/** The runs at `path`, one at least, read as a paragraph's are; a string in their place, or in a run's, refused unquoted. */
function readRuns(c: Ctx, value: unknown, path: string): readonly Inline[] | undefined {
  const items = typeof value === 'string' ? unquoted(c, path, 'an array') : readArray(c.f, value, path, MAX_INLINES)
  const strings = items?.flatMap((item, index) => (typeof item === 'string' ? [index] : [])) ?? []
  for (const index of strings) unquoted(c, at(path, index), 'an object')
  return items === undefined || strings.length > 0 ? undefined : readInlines(c, items, path, SCOPE, 1)
}

/**
 * The runs at `path`, one at least, and the rule `check` applied to them
 * when they are literal, refused as `what` breaking it. Absent, nothing is
 * said: whether it may be is the shape's question.
 */
function readText<T>(c: Ctx, value: unknown, path: string, what: string, check: (text: string) => QrBillCheck<T>): Text<T> {
  const runs = readRuns(c, value, path)
  const text = runs && literal(runs)
  if (text === undefined) return { runs, checked: undefined }
  const outcome = check(text)
  if (!outcome.ok) c.f.report(path, 'invalid-qr-bill', `${what} ${outcome.rule}`)
  return { runs, checked: outcome.ok ? outcome.value : undefined }
}

type AddressPart = keyof QrBillAddress

const ADDRESS_PARTS = Object.entries(QR_BILL_ADDRESS_RULES) as readonly (readonly [AddressPart, QrBillTextRule])[]
const REQUIRED_PARTS = ADDRESS_PARTS.filter(([, rule]) => rule.required).map(([part]) => part)
const OPTIONAL_PARTS = ADDRESS_PARTS.filter(([, rule]) => !rule.required).map(([part]) => part)

/** A party's address, each part read in the order the code holds them and held to its rule. */
function readAddress(c: Ctx, value: unknown, path: string, party: 'creditor' | 'debtor'): QrBillAddress | undefined {
  const o = typeof value === 'string' ? unquoted(c, path, 'an object') : shape(c.f, value, path, REQUIRED_PARTS, OPTIONAL_PARTS)
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
