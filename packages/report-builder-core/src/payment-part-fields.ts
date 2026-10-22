/**
 * A Swiss QR-bill's fields (0039): every term of report-spec's
 * `SwissQrBill`, as the properties pane shows it when the bill is selected.
 *
 * A table over every term, so a term added to the format without its
 * fields does not compile, in the order the code holds them (IG 2.4, Table
 * 8) -- the account, the creditor, the amount and its currency, the debtor,
 * the reference, the message and the billing information -- then the
 * language of the slip's headings, which is no element of the code. A
 * party is a group, each of its parts a field named after the party; the
 * debtor, which a bill may leave out, is an optional group, added from
 * SIX's example and removed in one step each.
 *
 * Each text is edited run by run as a payment code's is, one line each,
 * since a line break would end its element of the code; an optional one
 * that is absent, or one literal run, is one field. What a field makes of
 * what was typed is the same as everywhere: whether it is a bill SIX's
 * rules take is report-spec's to say when the edit is applied, on the
 * field typed in, in its words. The IBAN's field writes the account
 * alone; the reference an IBAN of the other kind takes with it is
 * `payment-part.ts`'s, added where the value becomes a command
 * (`properties.ts`).
 */
import { QR_BILL_ADDRESS_RULES, QR_BILL_CURRENCIES, QR_BILL_LANGUAGES } from '@formancy/report-spec'
import type { QrBillAddress, SwissQrBill } from '@formancy/report-spec'
import { EXAMPLE_DEBTOR } from './payment-part.js'
import { choiceField, codeTextFields, expressionField, optionalCodeTextFields, optionalGroup } from './property-fields.js'
import type { FieldContext, FieldSpec, GroupSpec, PanelSpec } from './property-fields.js'
import type { MessageId } from './text.js'

type Party = 'creditor' | 'debtor'

/** The words of each part of a party's address, whose they are said in them, so that each name is unique in the form. */
const ADDRESS_WORDS: { readonly [P in Party]: { readonly [K in keyof QrBillAddress]-?: MessageId } } = {
  creditor: {
    name: 'field.creditorName',
    street: 'field.creditorStreet',
    buildingNumber: 'field.creditorBuildingNumber',
    postalCode: 'field.creditorPostalCode',
    town: 'field.creditorTown',
    country: 'field.creditorCountry',
  },
  debtor: {
    name: 'field.debtorName',
    street: 'field.debtorStreet',
    buildingNumber: 'field.debtorBuildingNumber',
    postalCode: 'field.debtorPostalCode',
    town: 'field.debtorTown',
    country: 'field.debtorCountry',
  },
}

/** A party's address, part by part in the order the code holds them, as report-spec's rules list them: a required part edited run by run, an optional one as one field while it is absent or one literal run. */
function addressFields(party: Party, address: QrBillAddress, context: FieldContext): FieldSpec[] {
  return (Object.keys(QR_BILL_ADDRESS_RULES) as (keyof QrBillAddress)[]).flatMap((part) => {
    const key = `/${party}/${part}`
    const words = ADDRESS_WORDS[party][part]
    const runs = address[part]
    return QR_BILL_ADDRESS_RULES[part].required && runs !== undefined ? codeTextFields(runs, key, words, context) : optionalCodeTextFields(runs, key, words, context)
  })
}

/** The words a bill's debtor's button and its history steps say. */
const DEBTOR = { add: 'action.addDebtor', remove: 'action.removeDebtor', added: 'history.addDebtor', removed: 'history.removeDebtor' } as const

/** A language's name in the editor's language, as Intl names it, with a capital as an option's label begins. */
function languageName(code: string, context: FieldContext): string {
  const name = new Intl.DisplayNames([context.locale], { type: 'language' }).of(code) ?? code
  return name.charAt(0).toLocaleUpperCase(context.locale) + name.slice(1)
}

type TermFields = (bill: SwissQrBill, context: FieldContext) => readonly PanelSpec[]

/** Each term's fields, in the order the panel shows them. */
const TERMS: { readonly [K in Exclude<keyof SwissQrBill, 'kind'>]-?: TermFields } = {
  account: (bill, context) => codeTextFields(bill.account, '/account', 'field.iban', context),
  creditor: (bill, context): GroupSpec[] => [{ key: '/creditor', words: 'group.creditor', fields: addressFields('creditor', bill.creditor, context), buttons: [] }],
  amount: (bill) => [expressionField('/amount', { id: 'field.amount' }, bill.amount?.cel, false)],
  currency: (bill) => [choiceField('/currency', { id: 'field.currency' }, 'select', QR_BILL_CURRENCIES.map((code) => ({ value: code, label: code, stored: code })), bill.currency)],
  debtor: (bill, context) => [optionalGroup('/debtor', 'group.debtor', bill.debtor === undefined ? undefined : addressFields('debtor', bill.debtor, context), EXAMPLE_DEBTOR, DEBTOR)],
  reference: (bill, context) => optionalCodeTextFields(bill.reference, '/reference', 'field.paymentReference', context),
  message: (bill, context) => optionalCodeTextFields(bill.message, '/message', 'field.message', context),
  billingInformation: (bill, context) => optionalCodeTextFields(bill.billingInformation, '/billingInformation', 'field.billingInformation', context),
  language: (bill, context) => [
    choiceField(
      '/language',
      { id: 'field.qrBillLanguage' },
      'select',
      QR_BILL_LANGUAGES.map((code) => ({ value: code, label: languageName(code, context), stored: code })),
      bill.language,
    ),
  ],
}

/** A Swiss QR-bill's fields and groups, every term's, in the order the code holds them. */
export function paymentPartFields(bill: SwissQrBill, context: FieldContext): PanelSpec[] {
  return (Object.keys(TERMS) as (keyof typeof TERMS)[]).flatMap((term) => TERMS[term](bill, context))
}
