import { emptyReport } from '@formancy/report-spec'
import type { FieldRef, Inline, QrBillAddress, ReportDefinition, SwissQrBill } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { QrBill } from './document.js'
import { PREVIEW_LABEL, resolveReport } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'

/**
 * A report's payment part resolved into the document's: every text read as
 * a paragraph's in the report's scope, held to SIX's rules -- report-spec's
 * `qr-bill.ts`, the same functions the validator applies to a literal --
 * and made into the code's payload and the slip's printed texts.
 *
 * "IG" is SIX's Swiss Implementation Guidelines for the QR-bill, version
 * 2.4 of 24 February 2026; its Annex A's examples are the golden cases.
 */

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const text = (value: string): readonly Inline[] => [{ kind: 'text', text: value }]
const read = (field: string): readonly Inline[] => [{ kind: 'field', field: header(field) }]

/** An address of literal parts, each one left out that is undefined. */
function address(
  name: string,
  street: string | undefined,
  buildingNumber: string | undefined,
  postalCode: string,
  town: string,
  country: string,
): QrBillAddress {
  return {
    name: text(name),
    ...(street === undefined ? {} : { street: text(street) }),
    ...(buildingNumber === undefined ? {} : { buildingNumber: text(buildingNumber) }),
    postalCode: text(postalCode),
    town: text(town),
    country: text(country),
  }
}

/** The header an invoice's bill may read from: every field nullable, so that a test can hand it a null. */
const FIELDS = [
  { id: 'amount', type: 'decimal' },
  { id: 'count', type: 'integer' },
  { id: 'account', type: 'string' },
  { id: 'reference', type: 'string' },
  { id: 'name', type: 'string' },
  { id: 'town', type: 'string' },
  { id: 'country', type: 'string' },
  { id: 'message', type: 'string' },
  { id: 'billing', type: 'string' },
  { id: 'orderedOn', type: 'date' },
] as const

/** An invoice in English, A4 upright, whose header holds `FIELDS`, carrying `bill`. */
function invoice(bill: SwissQrBill, extra: Partial<ReportDefinition> = {}): ReportDefinition {
  return {
    ...emptyReport('invoice', 'Invoice', 'en'),
    datasets: { header: { id: 'invoice-header', fields: FIELDS.map(({ id, type }) => ({ id, type, label: id, nullable: true })) } },
    paymentPart: bill,
    ...extra,
  }
}

/** Data for `invoice`: every field null but those `values` gives. */
function data(values: Record<string, unknown> = {}): ReportData {
  return {
    header: { ...Object.fromEntries(FIELDS.map(({ id }) => [id, null])), ...values },
    completeness: { complete: true, captured: 0 },
    consistency: 'host-captured',
  }
}

/** `data(values)` without the header field `lacking`: what a preview of data without that column is handed. */
function without(values: Record<string, unknown>, lacking: string): ReportData {
  const { [lacking]: _lacking, ...header } = data(values).header as Record<string, unknown>
  return { ...data(values), header }
}

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-17T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, values: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, values, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

function bill(report: ReportDefinition, values: ReportData, options: ResolveOptions = FINAL): QrBill {
  const part = resolved(report, values, options).document.paymentPart
  if (part === undefined) throw new Error('the document has no payment part')
  return part
}

/** The errors a resolution was refused with, as stage, code and path. */
function refusals(report: ReportDefinition, values: ReportData, options: ResolveOptions = FINAL): string[] {
  const outcome = resolveReport(report, values, options)
  return outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)
}

const SAMPLE_COMPANY = address('Max Muster & Söhne (sample company)', 'Musterstrasse', '123', '8000', 'Seldwyla', 'CH')
const SIMON = address('Simon Muster', 'Musterstrasse', '1', '8000', 'Seldwyla', 'CH')
const SARAH = address('Sarah Beispiel', 'Musterstrasse', '1', '8000', 'Seldwyla', 'CH')
const AMOUNT = { cel: 'header.amount' }

/** The seven lines of a party the code leaves empty: the ultimate creditor always, a debtor when there is none. */
const NOBODY = ['', '', '', '', '', '', '']

interface Example {
  readonly name: string
  readonly bill: SwissQrBill
  /** The header's amount, which the bill reads. */
  readonly amount: string | null
  /** The code's lines, as the IG's table lists them. */
  readonly lines: readonly string[]
  /** What the slip prints, beside the headings. */
  readonly printed: Omit<QrBill, 'kind' | 'payload' | 'headings'>
  readonly payableBy: string
}

/**
 * SIX's examples, IG Annex A. Each table lists the billing information and
 * both alternative procedures, empty where they are not used; IG 4.1.4
 * leaves out a line of status A that is not used when no later line is,
 * and this format holds no alternative procedure, so the code ends at its
 * trailer, or at its billing information. Example 2's eBill procedure is
 * left out with them. Example 4's creditor reference is refused below:
 * its check digits are wrong.
 */
const EXAMPLES: readonly Example[] = [
  {
    name: 'example 1, a QR-IBAN and a QR reference (Table 17)',
    bill: {
      kind: 'swissQrBill',
      language: 'en',
      account: text('CH6431961000004421557'),
      creditor: SAMPLE_COMPANY,
      currency: 'CHF',
      amount: AMOUNT,
      debtor: SIMON,
      reference: text('000008207791225857421286694'),
      message: text('Payment of travel'),
    },
    amount: '50.00',
    lines: [
      'SPC',
      '0200',
      '1',
      'CH6431961000004421557',
      'S',
      'Max Muster & Söhne (sample company)',
      'Musterstrasse',
      '123',
      '8000',
      'Seldwyla',
      'CH',
      ...NOBODY,
      '50.00',
      'CHF',
      'S',
      'Simon Muster',
      'Musterstrasse',
      '1',
      '8000',
      'Seldwyla',
      'CH',
      'QRR',
      '000008207791225857421286694',
      'Payment of travel',
      'EPD',
    ],
    printed: {
      account: 'CH64 3196 1000 0044 2155 7',
      creditor: ['Max Muster & Söhne (sample company)', 'Musterstrasse 123', '8000 Seldwyla'],
      reference: '00 00082 07791 22585 74212 86694',
      additionalInformation: ['Payment of travel'],
      debtor: ['Simon Muster', 'Musterstrasse 1', '8000 Seldwyla'],
      currency: 'CHF',
      amount: '50.00',
    },
    payableBy: 'Payable by',
  },
  {
    name: 'example 2, with billing information (Table 18)',
    bill: {
      kind: 'swissQrBill',
      language: 'en',
      account: text('CH4431999123000889012'),
      creditor: SAMPLE_COMPANY,
      currency: 'CHF',
      amount: AMOUNT,
      debtor: SIMON,
      reference: text('210000000003139471430009017'),
      message: text('Order from 15.10.2020'),
      billingInformation: text('//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30'),
    },
    amount: '1949.75',
    lines: [
      'SPC',
      '0200',
      '1',
      'CH4431999123000889012',
      'S',
      'Max Muster & Söhne (sample company)',
      'Musterstrasse',
      '123',
      '8000',
      'Seldwyla',
      'CH',
      ...NOBODY,
      '1949.75',
      'CHF',
      'S',
      'Simon Muster',
      'Musterstrasse',
      '1',
      '8000',
      'Seldwyla',
      'CH',
      'QRR',
      '210000000003139471430009017',
      'Order from 15.10.2020',
      'EPD',
      '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30',
    ],
    printed: {
      account: 'CH44 3199 9123 0008 8901 2',
      creditor: ['Max Muster & Söhne (sample company)', 'Musterstrasse 123', '8000 Seldwyla'],
      reference: '21 00000 00003 13947 14300 09017',
      additionalInformation: ['Order from 15.10.2020', '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30'],
      debtor: ['Simon Muster', 'Musterstrasse 1', '8000 Seldwyla'],
      currency: 'CHF',
      amount: '1 949.75',
    },
    payableBy: 'Payable by',
  },
  {
    name: 'example 3, without an amount, a debtor or a reference (Table 19)',
    bill: {
      kind: 'swissQrBill',
      language: 'en',
      account: text('CH5204835012345671000'),
      creditor: address('Muster Stiftung (sample foundation)', 'P.O. box', undefined, '3001', 'Bern', 'CH'),
      currency: 'CHF',
    },
    amount: null,
    lines: [
      'SPC',
      '0200',
      '1',
      'CH5204835012345671000',
      'S',
      'Muster Stiftung (sample foundation)',
      'P.O. box',
      '',
      '3001',
      'Bern',
      'CH',
      ...NOBODY,
      '',
      'CHF',
      ...NOBODY,
      'NON',
      '',
      '',
      'EPD',
    ],
    printed: {
      account: 'CH52 0483 5012 3456 7100 0',
      creditor: ['Muster Stiftung (sample foundation)', 'P.O. box', '3001 Bern'],
      reference: null,
      additionalInformation: [],
      debtor: null,
      currency: 'CHF',
      amount: null,
    },
    payableBy: 'Payable by (name/address)',
  },
  {
    name: 'example 5, a creditor in Liechtenstein (Table 21)',
    bill: {
      kind: 'swissQrBill',
      language: 'en',
      account: text('CH5800791123000889012'),
      creditor: address('Max Muster & Söhne (sample company)', 'Musterstrasse', '123', '9490', 'Vaduz', 'LI'),
      currency: 'CHF',
      amount: AMOUNT,
      debtor: SARAH,
      reference: text('RF18539007547034'),
    },
    amount: '199.95',
    lines: [
      'SPC',
      '0200',
      '1',
      'CH5800791123000889012',
      'S',
      'Max Muster & Söhne (sample company)',
      'Musterstrasse',
      '123',
      '9490',
      'Vaduz',
      'LI',
      ...NOBODY,
      '199.95',
      'CHF',
      'S',
      'Sarah Beispiel',
      'Musterstrasse',
      '1',
      '8000',
      'Seldwyla',
      'CH',
      'SCOR',
      'RF18539007547034',
      '',
      'EPD',
    ],
    printed: {
      account: 'CH58 0079 1123 0008 8901 2',
      creditor: ['Max Muster & Söhne (sample company)', 'Musterstrasse 123', 'LI-9490 Vaduz'],
      reference: 'RF18 5390 0754 7034',
      additionalInformation: [],
      debtor: ['Sarah Beispiel', 'Musterstrasse 1', '8000 Seldwyla'],
      currency: 'CHF',
      amount: '199.95',
    },
    payableBy: 'Payable by',
  },
  {
    name: 'example 6, a debtor in Germany (Table 22)',
    bill: {
      kind: 'swissQrBill',
      language: 'en',
      account: text('CH5800791123000889012'),
      creditor: SAMPLE_COMPANY,
      currency: 'CHF',
      amount: AMOUNT,
      debtor: address('Sarah Beispiel', 'Musterstrasse', '1', '78462', 'Konstanz', 'DE'),
      reference: text('RF18539007547034'),
    },
    amount: '199.95',
    lines: [
      'SPC',
      '0200',
      '1',
      'CH5800791123000889012',
      'S',
      'Max Muster & Söhne (sample company)',
      'Musterstrasse',
      '123',
      '8000',
      'Seldwyla',
      'CH',
      ...NOBODY,
      '199.95',
      'CHF',
      'S',
      'Sarah Beispiel',
      'Musterstrasse',
      '1',
      '78462',
      'Konstanz',
      'DE',
      'SCOR',
      'RF18539007547034',
      '',
      'EPD',
    ],
    printed: {
      account: 'CH58 0079 1123 0008 8901 2',
      creditor: ['Max Muster & Söhne (sample company)', 'Musterstrasse 123', '8000 Seldwyla'],
      reference: 'RF18 5390 0754 7034',
      additionalInformation: [],
      debtor: ['Sarah Beispiel', 'Musterstrasse 1', 'DE-78462 Konstanz'],
      currency: 'CHF',
      amount: '199.95',
    },
    payableBy: 'Payable by',
  },
]

describe("SIX's examples", () => {
  // A payload a line out of place pays the wrong party or nobody: a bank
  // reads each element by its line (IG 4.1.4). Every element is present,
  // an empty one as its line, separated by a line feed, with none after the
  // last; and what the slip prints is the code's values, grouped as SIX
  // prints them (IG 3.5, 3.6).
  test.each(EXAMPLES)('$name: the code holds its lines, and the slip prints its values', ({ bill: definition, amount, lines, printed, payableBy }) => {
    const part = bill(invoice(definition), data({ amount }))
    expect(part.payload.split('\n')).toEqual(lines)
    expect(part.payload.endsWith('\n')).toBe(false)
    expect(part).toMatchObject({ kind: 'swissQrBill', ...printed })
    expect(part.headings.payableBy).toBe(payableBy)
  })

  // IG Table 20 prints example 4's creditor reference with check digits
  // that do not match it: modulo 97 it leaves 49, not 1. Read from data,
  // where the validator cannot see it, it is refused as it would be
  // written in the report, and the message never quotes it.
  test("refuses example 4's creditor reference, read from data", () => {
    const definition = invoice({
      kind: 'swissQrBill',
      language: 'en',
      account: text('CH5800791123000889012'),
      creditor: address('Muster Krankenkasse (sample health insurer)', 'Musterstrasse', '12', '8000', 'Seldwyla', 'CH'),
      currency: 'CHF',
      amount: AMOUNT,
      debtor: SARAH,
      reference: read('reference'),
    })
    const outcome = resolveReport(definition, data({ amount: '211.00', reference: 'RF720191230100405JSH0438' }), FINAL)
    expect(outcome.ok ? [] : outcome.errors).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-qr-bill',
        path: '/paymentPart/reference',
        message: 'the reference has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)',
      },
    ])
  })
})

/** Example 2's bill, every text that can be read from data read from it. */
const FROM_DATA: SwissQrBill = {
  kind: 'swissQrBill',
  language: 'de',
  account: read('account'),
  creditor: SAMPLE_COMPANY,
  currency: 'CHF',
  amount: AMOUNT,
  debtor: {
    name: read('name'),
    street: text('Musterstrasse'),
    buildingNumber: text('1'),
    postalCode: text('8000'),
    town: read('town'),
    country: read('country'),
  },
  reference: read('reference'),
  message: read('message'),
  billingInformation: read('billing'),
}

/** Example 2's values, for `FROM_DATA`. */
const EXAMPLE_2 = {
  amount: '1949.75',
  account: 'CH4431999123000889012',
  reference: '210000000003139471430009017',
  name: 'Simon Muster',
  town: 'Seldwyla',
  country: 'CH',
  message: 'Order from 15.10.2020',
  billing: '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30',
}

describe('a bill read from data', () => {
  // The validator holds a literal text to SIX's rules where it is written;
  // a text read from data is held to the same rules once it has a value,
  // or a bank refuses the bill the report printed.
  test("is held to SIX's rules once the data has resolved it", () => {
    const part = bill(invoice(FROM_DATA), data(EXAMPLE_2))
    expect(part.payload.split('\n')).toEqual(EXAMPLES[1]?.lines)
    expect(part.headings).toMatchObject({ paymentPart: 'Zahlteil', payableBy: 'Zahlbar durch' })
  })

  // A person writes an IBAN and a reference in blocks to read them, and a
  // value read from a system often comes with blanks around it; the code
  // holds neither (IG Table 8, IBAN; 4.1.3), so both are dropped and the
  // slip prints the code's own value, grouped.
  test('drops the spaces in the account and the reference, and the blanks around every text', () => {
    const spaced = {
      ...EXAMPLE_2,
      account: ' CH44 3199 9123 0008 8901 2 ',
      reference: '21 00000 00003 13947 14300 09017',
      name: '  Simon Muster ',
      message: 'Order from 15.10.2020  ',
    }
    const part = bill(invoice(FROM_DATA), data(spaced))
    expect(part.payload.split('\n')).toEqual(EXAMPLES[1]?.lines)
    expect(part).toMatchObject({
      account: 'CH44 3199 9123 0008 8901 2',
      reference: '21 00000 00003 13947 14300 09017',
      debtor: ['Simon Muster', 'Musterstrasse 1', '8000 Seldwyla'],
    })
  })

  // A bill's text reads as a paragraph in its place prints it: a format,
  // a field and an expression, so that what the invoice prints and what
  // its slip and code say never differ.
  test('reads each text as a paragraph with the same runs prints it', () => {
    const runs: readonly Inline[] = [
      { kind: 'text', text: 'Order of ' },
      { kind: 'field', field: header('orderedOn'), format: { kind: 'date', style: 'long' } },
      { kind: 'expression', expression: { cel: '" for " + header.name' } },
    ]
    const report = invoice(
      { ...FROM_DATA, message: runs },
      { regions: { reportHeader: [], pageHeader: [], body: [{ id: 'line', kind: 'text', content: runs }], pageFooter: [], summary: [] } },
    )
    const { document } = resolved(report, data({ ...EXAMPLE_2, orderedOn: '2020-10-15' }))
    const [paragraph] = document.body
    expect(paragraph?.kind === 'paragraph' && paragraph.runs.map((run) => ('text' in run ? run.text : '')).join('')).toBe(
      'Order of October 15, 2020 for Simon Muster',
    )
    expect(document.paymentPart?.additionalInformation).toEqual(['Order of October 15, 2020 for Simon Muster', EXAMPLE_2.billing])
  })

  // SCOR stays allowed in EUR in version 2.4, and an IBAN may carry no
  // reference in either currency (IG 4.3.2); only the QR-IBAN and its QR
  // reference became CHF's alone.
  test('pays an IBAN in euros, with a creditor reference or with none', () => {
    const euros: SwissQrBill = { ...FROM_DATA, currency: 'EUR' }
    const scor = bill(invoice(euros), data({ ...EXAMPLE_2, account: 'CH5800791123000889012', reference: 'RF18539007547034' }))
    expect(scor.payload.split('\n').slice(18, 20)).toEqual(['1949.75', 'EUR'])
    const { reference: _reference, ...unreferenced } = euros
    const none = bill(invoice(unreferenced), data({ ...EXAMPLE_2, account: 'CH5800791123000889012' }))
    expect(none.payload.split('\n').slice(27, 29)).toEqual(['NON', ''])
  })

  // Each rule SIX gives, broken by a value from the data: refused on the
  // field that breaks it, and the message names the rule, never the value,
  // which may be a person's name, town or account.
  const BROKEN: readonly (readonly [string, Record<string, unknown>, Partial<SwissQrBill>, string])[] = [
    ['an account whose check digits do not match', { account: 'CH4431999123000889013' }, {}, '/paymentPart/account'],
    ['an IBAN of another country than Switzerland or Liechtenstein', { account: 'DE89370400440532013000' }, {}, '/paymentPart/account'],
    ['a QR reference whose check digit does not match', { reference: '210000000003139471430009018' }, {}, '/paymentPart/reference'],
    ['a QR reference of 26 digits', { reference: '21000000000313947143000901' }, {}, '/paymentPart/reference'],
    ['a creditor reference paid to a QR-IBAN', { reference: 'RF18539007547034' }, {}, '/paymentPart/reference'],
    ['a QR reference paid to an IBAN', { account: 'CH5800791123000889012' }, {}, '/paymentPart/reference'],
    ['a QR-IBAN and a QR reference in euros', {}, { currency: 'EUR' }, '/paymentPart/currency'],
    ["a debtor's name that is empty", { name: '' }, {}, '/paymentPart/debtor/name'],
    ["a debtor's name of 71 characters", { name: 'M'.repeat(71) }, {}, '/paymentPart/debtor/name'],
    ['a town with a character SIX does not allow', { town: 'Seldwyla \u{1F3D4}' }, {}, '/paymentPart/debtor/town'],
    ['a town with a line break in it', { town: 'Seld\nwyla' }, {}, '/paymentPart/debtor/town'],
    ['a country that is not a code', { country: 'Schweiz' }, {}, '/paymentPart/debtor/country'],
    ['billing information without its //', { billing: 'S1/10/1234' }, {}, '/paymentPart/billingInformation'],
    ['a message of 141 characters', { message: 'm'.repeat(141) }, {}, '/paymentPart/message'],
    ['a message and billing information of 141 characters together', { message: 'm'.repeat(100), billing: `//${'b'.repeat(39)}` }, {}, '/paymentPart/message'],
    ['an amount with a third decimal', { amount: '1949.750' }, {}, '/paymentPart/amount'],
    ['an amount of nothing', { amount: '0.00' }, {}, '/paymentPart/amount'],
    ['an amount of a billion', { amount: '1000000000.00' }, {}, '/paymentPart/amount'],
    ['an amount below nothing', { amount: '-5.00' }, {}, '/paymentPart/amount'],
  ]
  test.each(BROKEN)('refuses %s, naming the rule and never the value', (_name, values, patch, path) => {
    const outcome = resolveReport(invoice({ ...FROM_DATA, ...patch }), data({ ...EXAMPLE_2, ...values }), FINAL)
    const errors = outcome.ok ? [] : outcome.errors
    expect(errors.map((error) => `${error.stage} ${error.code} ${error.path}`)).toEqual([`resolve invalid-qr-bill ${path}`])
    for (const value of Object.values(values)) if (typeof value === 'string' && value !== '') expect(errors[0]?.message).not.toContain(value)
  })

  // A bill without a reference is NON, and a QR-IBAN is paid to with a QR
  // reference and nothing else: the account from data is a QR-IBAN.
  test('refuses a QR-IBAN with no reference', () => {
    const { reference: _reference, ...unreferenced } = FROM_DATA
    expect(refusals(invoice(unreferenced), data(EXAMPLE_2))).toEqual(['resolve invalid-qr-bill /paymentPart/reference'])
  })

  // A character SIX does not allow is named by where it is, not by what it
  // is: the message must not carry the text it is in.
  test('names a character it refuses by its position in the text', () => {
    const outcome = resolveReport(invoice(FROM_DATA), data({ ...EXAMPLE_2, town: ' Seldwyla \u{1F3D4}' }), FINAL)
    expect(outcome.ok ? [] : outcome.errors.map(({ message }) => message)).toEqual([
      "the debtor's town is not written in the characters SIX allows (IG 4.1.1): character 11 is outside them",
    ])
  })
})

describe('the amount', () => {
  // An amount that is null leaves the field for the payer to fill in, as no
  // amount does (IG 3.5.3): a donation, a sum the debtor chooses.
  test('is left to the payer when it is null', () => {
    const part = bill(invoice(FROM_DATA), data({ ...EXAMPLE_2, amount: null }))
    expect(part.amount).toBeNull()
    expect(part.payload.split('\n').slice(18, 20)).toEqual(['', 'CHF'])
  })

  // report-core lets an amount through that may be a decimal or null, and
  // a nullable integer is checked as such a value. An integer of francs is
  // not an amount with its cents: printed as one, a bill of 1949 would pay
  // a sum nobody wrote, so it is refused, by its type.
  test('refuses a value that is not a decimal, by its type', () => {
    const outcome = resolveReport(invoice({ ...FROM_DATA, amount: { cel: 'header.count' } }), data({ ...EXAMPLE_2, count: '1949' }), FINAL)
    expect(outcome.ok ? [] : outcome.errors).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-qr-bill',
        path: '/paymentPart/amount',
        message: "the amount gives integer, and a QR-bill's amount is a decimal, or null to leave it for the payer",
      },
    ])
  })

  // An expression that fails is an error that says where it stands; a bill
  // stands in no component, and an error that named none would say nothing.
  test('names the payment part when its expression fails', () => {
    const outcome = resolveReport(invoice({ ...FROM_DATA, amount: { cel: 'divide(header.amount, dec("0"), 2)' } }), data(EXAMPLE_2), FINAL)
    expect(outcome.ok ? [] : outcome.errors).toMatchObject([
      { stage: 'evaluation', code: 'expression-failed', path: '/paymentPart/amount/cel', message: expect.stringMatching(/^the payment part: /) },
    ])
  })
})

describe('a value the bill lacks', () => {
  // A run whose value is null prints as nothing in a paragraph. In a bill
  // it would make the code say less than its texts -- a debtor without a
  // name, a message cut short -- and scan as some other bill, so a final
  // render refuses it, naming the run.
  test('refuses a final render, naming the run', () => {
    const outcome = resolveReport(
      invoice({
        ...FROM_DATA,
        message: [
          { kind: 'text', text: 'Order for ' },
          { kind: 'field', field: header('name') },
        ],
      }),
      data({ ...EXAMPLE_2, name: null }),
      FINAL,
    )
    const message = 'the payment part: this run has no value, and a QR-bill without it would scan as some other bill'
    expect(outcome.ok ? [] : outcome.errors).toEqual([
      { stage: 'resolve', code: 'no-qr-value', path: '/paymentPart/debtor/name/0', message },
      { stage: 'resolve', code: 'no-qr-value', path: '/paymentPart/message/1', message },
    ])
  })

  // A preview prints a null as nothing, as a paragraph does, so that a
  // template can be looked at before its data is whole; what it prints is
  // still held to SIX's rules.
  test('is printed as nothing in a preview', () => {
    const part = bill(invoice(FROM_DATA), data({ ...EXAMPLE_2, message: null, billing: null }), PREVIEW)
    expect(part.payload.split('\n').slice(29)).toEqual(['', 'EPD'])
    expect(part.additionalInformation).toEqual([])
  })

  // A field a preview's data lacks prints nothing and is warned of, and the
  // preview's every page says it is one. Where that leaves a text SIX
  // requires empty, the bill could not be paid, and is refused as a final
  // render would be, saying what the preview lacked.
  test('in a preview, is warned of, and refused where SIX requires the text', () => {
    const shorter = resolved(invoice(FROM_DATA), without(EXAMPLE_2, 'message'), PREVIEW)
    expect(shorter.document.paymentPart?.additionalInformation).toEqual([EXAMPLE_2.billing])
    expect(shorter.warnings.map(({ code, path }) => `${code} ${path}`)).toEqual(['missing-field /header/message'])
    expect(shorter.document.pageHeader[0]).toMatchObject({ runs: [{ text: PREVIEW_LABEL }] })
    const outcome = resolveReport(invoice(FROM_DATA), without(EXAMPLE_2, 'name'), PREVIEW)
    expect(outcome.ok ? [] : outcome.errors).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-qr-bill',
        path: '/paymentPart/debtor/name',
        message: "the debtor's name is empty, and a QR-bill needs it; this preview has no value for a run of it",
      },
    ])
  })
})

describe('the payment part', () => {
  // A value a format cannot show is an error that says where; in a bill,
  // which stands in no component, it names the payment part.
  test('names itself in an error a run of it gives', () => {
    const report = invoice({
      ...FROM_DATA,
      message: [{ kind: 'field', field: header('amount'), format: { kind: 'currency', currency: { kind: 'field', field: header('country') }, scale: 2 } }],
    })
    const outcome = resolveReport(report, data(EXAMPLE_2), FINAL)
    expect(outcome.ok ? [] : outcome.errors).toMatchObject([
      { stage: 'format', code: 'invalid-currency', path: '/paymentPart/message/0', message: expect.stringMatching(/^the payment part: /) },
    ])
  })

  // A report without a bill resolves to a document without one: no key the
  // renderer would have to read as "none".
  test('is not in the document of a report that has none', () => {
    const { paymentPart: _part, ...report } = invoice(FROM_DATA)
    expect(Object.hasOwn(resolved(report, data(EXAMPLE_2)).document, 'paymentPart')).toBe(false)
  })
})
