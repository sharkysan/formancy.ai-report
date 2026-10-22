/**
 * What a QR-bill a person adds starts from, and what an edit of its
 * account does to its reference (INV-Q9, 0039).
 *
 * A bill starts from SIX's own example values, report-spec's
 * `QR_BILL_EXAMPLE`, a bill SIX's rules take as it stands, where one of
 * blank texts would be refused: SIX's third example (IG 2.4, Annex A,
 * Table 19), the one without an amount, a debtor or a reference -- an
 * IBAN, and a creditor that says it is a sample. A debtor added to a bill
 * is SIX's first example's. report-core warns of a bill that holds any of
 * them (`example-payment-part`), from the same list, so a bill added and
 * never edited says so until each is replaced.
 *
 * An account and its reference are of one kind: a QR-IBAN is paid to with
 * a QR reference and nothing else, a QR reference only to a QR-IBAN (IG
 * Table 8, Tp), and each edit is validated whole, so an IBAN of the other
 * kind typed alone would be refused whichever came first. An edit of the
 * account takes the reference with it, in the same command.
 */
import { checkQrBillAccount, checkQrBillReference, QR_BILL_EXAMPLE, QR_BILL_LANGUAGES, qrBillPairing } from '@formancy/report-spec'
import type { Inline, QrBillAddress, QrBillLanguage, QrBillReferenceType, ReportDefinition, SwissQrBill } from '@formancy/report-spec'
import type { PaymentPartPatch } from '@formancy/report-core'
import type { MessageId } from './text.js'

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/** A party of SIX's examples as a bill's address, each part one literal run. */
function address(party: { readonly [P in keyof QrBillAddress]?: string }): QrBillAddress {
  return Object.fromEntries(Object.entries(party).map(([part, text]) => [part, said(text)])) as unknown as QrBillAddress
}

/** The debtor of SIX's first example (IG 2.4, Table 17), which a bill's Add debtor puts in. */
export const EXAMPLE_DEBTOR: QrBillAddress = address(QR_BILL_EXAMPLE.debtor)

/** The slip's language for `report`: the report's own where SIX prints its headings in it, else English, the language of SIX's example. */
function slipLanguage(report: ReportDefinition): QrBillLanguage {
  const language = report.locale.split('-')[0]?.toLowerCase()
  return QR_BILL_LANGUAGES.find((candidate) => candidate === language) ?? 'en'
}

/** The QR-bill a person adds to `report`: SIX's third example, its headings in the report's language where SIX prints in it. */
export function newPaymentPart(report: ReportDefinition): SwissQrBill {
  return { kind: 'swissQrBill', language: slipLanguage(report), account: said(QR_BILL_EXAMPLE.account), creditor: address(QR_BILL_EXAMPLE.creditor), currency: 'CHF' }
}

/** The text `runs` write when every run is literal, what no data can change; undefined otherwise. */
function written(runs: readonly Inline[]): string | undefined {
  return runs.every((run) => run.kind === 'text') ? runs.map((run) => (run as Extract<Inline, { kind: 'text' }>).text).join('') : undefined
}

/** The kind of account `runs` write, as report-spec's check reads it; undefined where the data or an expression says, or it is no account yet. */
function accountKind(runs: readonly Inline[]): 'iban' | 'qrIban' | undefined {
  const text = written(runs)
  const checked = text === undefined ? undefined : checkQrBillAccount(text)
  return checked?.ok === true ? (checked.value.qrIban ? 'qrIban' : 'iban') : undefined
}

/** The type of reference `runs` write -- none, for a bill without one -- as report-spec's check reads it; undefined where it is not known. */
function referenceType(runs: readonly Inline[] | undefined): QrBillReferenceType | undefined {
  if (runs === undefined) return 'NON'
  const text = written(runs)
  const checked = text === undefined ? undefined : checkQrBillReference(text)
  return checked?.ok === true ? checked.value.type : undefined
}

/** A bill's patch, and the words an edit made of it is announced in where it changes more than its field. */
export interface PairedPatch {
  readonly patch: PaymentPartPatch
  readonly said?: MessageId
}

/**
 * `patch` of `bill`, with the reference its account is paid to with where
 * the account it writes is of the other kind than the reference the bill
 * holds -- report-spec's `qrBillPairing` says when. A QR-IBAN, over a bill
 * with no QR reference, is given SIX's example QR reference, which is
 * warned of until it is the creditor's own; an IBAN, over a QR reference,
 * has it taken away. A patch that writes no account, or the reference too,
 * an account or a reference the data gives, and an account that is no
 * account yet, are left as they are: the validator says what it makes of
 * them.
 */
export function pairedReference(bill: SwissQrBill, patch: PaymentPartPatch): PairedPatch {
  if (patch.account === undefined || Object.hasOwn(patch, 'reference')) return { patch }
  const kind = accountKind(patch.account)
  const clash = qrBillPairing(kind, referenceType(bill.reference), patch.currency ?? bill.currency).some((broken) => broken.field === 'reference')
  if (!clash) return { patch }
  return kind === 'qrIban'
    ? { patch: { ...patch, reference: said(QR_BILL_EXAMPLE.reference) }, said: 'status.changedToQrIban' }
    : { patch: { ...patch, reference: null }, said: 'status.changedToIban' }
}
