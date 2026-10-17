import { emptyReport } from '@formancy/report-spec'
import type { Component, EpcQrCodeComponent, FieldRef, Inline, ReportDefinition } from '@formancy/report-spec'
import * as spec from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Block, EpcQrCode } from './document.js'
import * as runtime from './index.js'
import { resolveReport } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'

/**
 * An EPC QR code resolved into the document's block: every text read as a
 * paragraph's in the report's scope, held to the EPC's rules --
 * report-spec's `epc-payload.ts`, the same functions the validator applies
 * to a literal -- and written into the payload the renderer encodes.
 *
 * "EPC" is the European Payments Council's EPC069-12, version 3.1 of 19
 * March 2024, by its section; its examples (2.3) are the golden cases.
 * "PSA" is Austria's "QR-Code und BCD Definition", version 3.0.
 */

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const text = (value: string): readonly Inline[] => [{ kind: 'text', text: value }]
const read = (field: string): readonly Inline[] => [{ kind: 'field', field: header(field) }]

/** The header an invoice's code may read from: every field nullable, so that a test can hand it a null. */
const FIELDS = [
  { id: 'amount', type: 'decimal' },
  { id: 'count', type: 'integer' },
  { id: 'name', type: 'string' },
  { id: 'iban', type: 'string' },
  { id: 'bic', type: 'string' },
  { id: 'reference', type: 'string' },
  { id: 'text', type: 'string' },
  { id: 'information', type: 'string' },
  { id: 'invoiceNo', type: 'string' },
  { id: 'issuedOn', type: 'date' },
] as const

/** A code read from the header: the beneficiary's name and IBAN, and whatever `patch` adds. */
function code(patch: Partial<EpcQrCodeComponent> = {}): EpcQrCodeComponent {
  return { id: 'pay-code', kind: 'epcQrCode', size: 85.04, beneficiary: read('name'), iban: read('iban'), ...patch }
}

/** An invoice in German, whose header holds `FIELDS`, its summary `components`. */
function invoice(...components: Component[]): ReportDefinition {
  const report = emptyReport('invoice', 'Rechnung', 'de-DE')
  return {
    ...report,
    datasets: { header: { id: 'invoice-header', fields: FIELDS.map(({ id, type }) => ({ id, type, label: id, nullable: true })) } },
    regions: { ...report.regions, summary: components },
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
  const { [lacking]: _lacking, ...rest } = data(values).header as Record<string, unknown>
  return { ...data(values), header: rest }
}

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-17T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, values: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, values, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

/** The one EPC QR code block the summary of `report` lowers to. */
function block(report: ReportDefinition, values: ReportData, options: ResolveOptions = FINAL): EpcQrCode {
  const codes = resolved(report, values, options).document.body.filter((each): each is EpcQrCode => each.kind === 'epcQrCode')
  if (codes.length !== 1) throw new Error(`the document has ${codes.length} EPC QR codes`)
  return codes[0] as EpcQrCode
}

/** The payload of the one code `patch` makes, read from `values`. */
function payload(patch: Partial<EpcQrCodeComponent>, values: Record<string, unknown>, options: ResolveOptions = FINAL): string {
  return block(invoice(code(patch)), data(values), options).payload
}

/** The errors a resolution was refused with. */
function errors(report: ReportDefinition, values: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: false }>['errors'] {
  const outcome = resolveReport(report, values, options)
  return outcome.ok ? [] : outcome.errors
}

/**
 * The bytes UTF-8 writes `text` in, counted apart from report-spec's own
 * count: `encodeURIComponent` writes each byte past ASCII as one %XX.
 */
function utf8Bytes(text: string): number {
  return encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, '.').length
}

const AMOUNT = { cel: 'header.amount' }

/** A German account and its owner, SWIFT's registry example IBAN, and the head of the payload a code of them alone writes. */
const MAX = { name: 'Max Muster', iban: 'DE89370400440532013000' }
const HEAD = 'BCD\n002\n1\nSCT\n\nMax Muster\nDE89370400440532013000'

describe("the EPC's examples", () => {
  // EPC 2.3's first example, V1, byte for byte: "95 characters including
  // spaces (1) and line feeds (9), 96 byte UTF-8 code payload". It has a
  // BIC, and is written as version 001, as the example is: a code with a
  // BIC is what 001 asks for, and only one without needs 002. A payload a
  // byte off is not the example, and a bank's app reads each element by
  // its line.
  test('V1 is written byte for byte, its IBAN printed in blocks and its amount from the data', () => {
    const v1 = code({
      bic: text('BHBLDEHHXXX'),
      beneficiary: text('Franz Mustermänn'),
      iban: text('DE71 1102 2033 0123 4567 89'),
      amount: AMOUNT,
      purpose: 'GDDS',
      reference: text('RF18 5390 0754 7034'),
    })
    const written = block(invoice(v1), data({ amount: '12.30' })).payload
    expect(written).toBe('BCD\n001\n1\nSCT\nBHBLDEHHXXX\nFranz Mustermänn\nDE71110220330123456789\nEUR12.3\nGDDS\nRF18539007547034')
    expect([[...written].length, utf8Bytes(written)]).toEqual([95, 96])
  })

  // The same example, every text read from data: the same rules applied
  // to a value from the data make the same bytes, the IBAN's spaces
  // dropped and its letters made capitals, as the electronic form writes
  // it (EPC 2.2, AT-C001), and the reference's spaces dropped.
  test('V1 is the same bytes when its every text is read from the data', () => {
    const v1 = code({ bic: read('bic'), amount: AMOUNT, purpose: 'GDDS', reference: read('reference') })
    const values = { bic: 'BHBLDEHHXXX', name: 'Franz Mustermänn', iban: ' de71 1102 2033 0123 4567 89 ', amount: '12.30', reference: 'RF18 5390 0754 7034' }
    expect(payload(v1, values)).toBe('BCD\n001\n1\nSCT\nBHBLDEHHXXX\nFranz Mustermänn\nDE71110220330123456789\nEUR12.3\nGDDS\nRF18539007547034')
  })

  // EPC 2.3's second example, V2, has no BIC and is written in ISO 8859-1,
  // character set 2: "103 characters including spaces (5) and line feeds
  // (10), 103 byte". This code is written in UTF-8 alone, character set 1,
  // so it is the example but for that digit, the same 103 characters, and
  // 104 bytes for the ç. Its empty BIC, purpose and reference are lines.
  test('V2 is written as the example in UTF-8: version 002, its empty elements as lines', () => {
    const v2 = code({ beneficiary: text("François D'Alsace S.A."), iban: text('FR14 2004 1010 0505 0001 3M02 606'), amount: AMOUNT, text: text('Client:Marie Louise La Lune') })
    const written = block(invoice(v2), data({ amount: '12.3' })).payload
    expect(written.split('\n')).toEqual(['BCD', '002', '1', 'SCT', '', "François D'Alsace S.A.", 'FR1420041010050500013M02606', 'EUR12.3', '', '', 'Client:Marie Louise La Lune'])
    expect([[...written].length, utf8Bytes(written)]).toEqual([103, 104])
  })
})

describe('the payload', () => {
  // "The last populated element is not followed by any character or
  // element separator" (EPC 2.2), and every element before it is a line,
  // empty when it is unused (PSA 3). A reader counts lines: a line missing
  // before the text reads the text as the reference, and a line ending at
  // the end is an element the EPC does not have. One case per shape an
  // invoice's code takes.
  test.each([
    ['the account alone', {}, {}, HEAD],
    ['an amount alone', { amount: AMOUNT }, { amount: '45.00' }, `${HEAD}\nEUR45`],
    ['a reference alone', { reference: read('reference') }, { reference: 'RF18 5390 0754 7034' }, `${HEAD}\n\n\nRF18539007547034`],
    ['a text alone', { text: read('text') }, { text: 'Rechnung 2026-0042' }, `${HEAD}\n\n\n\nRechnung 2026-0042`],
    ['information without remittance', { amount: AMOUNT, information: read('information') }, { amount: '45.00', information: 'Danke für Ihren Auftrag' }, `${HEAD}\nEUR45\n\n\n\nDanke für Ihren Auftrag`],
    ['a purpose and a reference', { amount: AMOUNT, purpose: 'GDDS', reference: read('reference') }, { amount: '45.00', reference: 'RF18539007547034' }, `${HEAD}\nEUR45\nGDDS\nRF18539007547034`],
  ] as const)('holds %s, every element before the last a line, and nothing after it', (_name, patch, values, expected) => {
    const written = payload(patch, { ...MAX, ...values })
    expect(written).toBe(expected)
    expect(written.endsWith('\n')).toBe(false)
  })

  // An optional text that prints nothing a payer reads -- the empty
  // string, white space alone, or null, the way a nullable field says
  // "none" -- is an element the code leaves unused, as it would be had the
  // template none: a customer with no BIC on record, an invoice with no
  // reference or no note. The BIC's line empty and version 002, never
  // refused as a BIC that is no BIC, nor a null refused as a text cut
  // short; in a final render as in a preview, which would otherwise print
  // a code that the final render of the same data refuses.
  test('leaves an optional element unused where the data gives it nothing to print, in a final render as in a preview', () => {
    const patch = { bic: read('bic'), reference: read('reference'), information: read('information') }
    for (const nothing of ['', '   ', null]) {
      for (const options of [FINAL, PREVIEW]) {
        expect(payload(patch, { ...MAX, bic: nothing, reference: nothing, information: nothing }, options), `${JSON.stringify(nothing)} ${options.mode}`).toBe(HEAD)
      }
    }
    expect(payload({ amount: AMOUNT, text: read('text') }, { ...MAX, amount: '45.00', text: null })).toBe(`${HEAD}\nEUR45`)
  })

  // The total payload is at most 331 bytes (EPC 2.2), counted in UTF-8's
  // bytes, not in characters: a name of umlauts takes two for each. Each
  // text within its own limit can still bring the whole past it, which only
  // the data shows; refused on the code, saying the count and never a text.
  test('is at most 331 bytes in UTF-8, refused on the code past them', () => {
    const patch = { text: read('text'), information: read('information') }
    const full = { ...MAX, name: 'ä'.repeat(70), text: 't'.repeat(100), information: 'i'.repeat(48) }
    expect(utf8Bytes(payload(patch, full))).toBe(331)
    expect(errors(invoice(code(patch)), data({ ...full, information: 'i'.repeat(49) }))).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-epc-qr-code',
        path: '/regions/summary/0',
        message: 'component pay-code: its payload is 332 bytes long in UTF-8; the EPC allows at most 331 (EPC069-12 2.2), what a version 13 code holds at level M',
        componentId: 'pay-code',
      },
    ])
  })

  // A code's text reads as a paragraph in its place prints it: a format, a
  // field and an expression, so that the invoice's line and what its code
  // sends with the transfer never differ.
  test('reads each text as a paragraph with the same runs prints it', () => {
    const runs: readonly Inline[] = [
      { kind: 'text', text: 'Rechnung ' },
      { kind: 'field', field: header('invoiceNo') },
      { kind: 'text', text: ' vom ' },
      { kind: 'field', field: header('issuedOn'), format: { kind: 'date', style: 'long' } },
    ]
    const report = invoice({ id: 'line', kind: 'text', content: runs }, code({ text: runs }))
    const [paragraph, epc] = resolved(report, data({ ...MAX, invoiceNo: '2026-0042', issuedOn: '2026-10-15' })).document.body as [Block, EpcQrCode]
    const printed = paragraph.kind === 'paragraph' ? paragraph.runs.map((run) => ('text' in run ? run.text : '')).join('') : ''
    expect(printed).toMatch(/^Rechnung 2026-0042 vom 15\. Oktober 2026$/)
    expect(epc.payload.split('\n')[10]).toBe(printed)
  })
})

describe('the block', () => {
  // The renderer draws the code from its block alone: its id for a refusal
  // to name, its payload, its square, and Austria's frame and caption when
  // the template asks for them; absent, no key the renderer must read as
  // "none".
  test('holds the id, the payload, the size and the caption, the caption only when asked for', () => {
    const report = invoice(code(), code({ id: 'framed-code', size: 99.21, caption: 'zahlenMitCode' }))
    const body = resolved(report, data(MAX)).document.body
    expect(body).toStrictEqual([
      { kind: 'epcQrCode', id: 'pay-code', payload: HEAD, size: 85.04 },
      { kind: 'epcQrCode', id: 'framed-code', payload: HEAD, size: 99.21, caption: 'zahlenMitCode' },
    ])
  })

  // A code whose condition does not hold prints nothing, and nothing in it
  // is read: a credit note of nothing to pay hides its code, and its
  // amount of 0.00, which the EPC refuses, is never checked.
  test('is not drawn, nor its values checked, when its condition does not hold', () => {
    const hidden = code({ amount: AMOUNT, visibleWhen: { cel: 'header.amount > dec("0")' } })
    expect(resolved(invoice(hidden), data({ ...MAX, amount: '0.00' })).document.body).toEqual([])
    expect(block(invoice(hidden), data({ ...MAX, amount: '45.00' })).payload).toBe(`${HEAD}\nEUR45`)
  })
})

describe('the amount', () => {
  // "As short as possible" (PSA 3, note 5), which the EPC allows: no
  // trailing zero after the point, no point without a decimal after it.
  // Written from the decimal's own digits, never a JavaScript number, so
  // that the largest amount is exact.
  test.each([
    ['12.30', 'EUR12.3'],
    ['45.00', 'EUR45'],
    ['0.01', 'EUR0.01'],
    ['0.10', 'EUR0.1'],
    ['100', 'EUR100'],
    ['1000.5', 'EUR1000.5'],
    ['999999999.99', 'EUR999999999.99'],
  ])('writes %s as %s', (amount, written) => {
    expect(payload({ amount: AMOUNT }, { ...MAX, amount }).split('\n')[7]).toBe(written)
  })

  // An amount that is null leaves it for the payer to fill in, as no
  // amount does: its line is empty, and a text after it keeps its place.
  test('is left to the payer when it is null', () => {
    expect(payload({ amount: AMOUNT, text: read('text') }, { ...MAX, amount: null, text: 'Spende' })).toBe(`${HEAD}\n\n\n\nSpende`)
  })

  // From 0.01 to 999999999.99 (EPC 2.2), and never rounded: a SEPA credit
  // transfer pays whole cents, and an amount of a third decimal, a zero
  // among them, is refused so that a template that does not round is
  // refused on its first render, not printed as a sum nobody computed.
  test.each([
    ['12.345', 'has more than two decimals; a SEPA credit transfer pays whole cents, so the amount is rounded where it is computed'],
    ['12.340', 'has more than two decimals; a SEPA credit transfer pays whole cents, so the amount is rounded where it is computed'],
    ['0.00', 'is not from 0.01 to 999999999.99, the amounts an EPC QR code pays (EPC069-12 2.2)'],
    ['1000000000.00', 'is not from 0.01 to 999999999.99, the amounts an EPC QR code pays (EPC069-12 2.2)'],
    ['-5.00', 'is not from 0.01 to 999999999.99, the amounts an EPC QR code pays (EPC069-12 2.2)'],
  ])('refuses %s, naming the rule', (amount, rule) => {
    expect(errors(invoice(code({ amount: AMOUNT })), data({ ...MAX, amount }))).toEqual([
      { stage: 'resolve', code: 'invalid-epc-qr-code', path: '/regions/summary/0/amount', message: `component pay-code: the amount ${rule}`, componentId: 'pay-code' },
    ])
  })

  // report-core lets an amount through that may be a decimal or null, and
  // a nullable integer is checked as such a value. An integer of euros is
  // not an amount with its cents: written as one, a code of 45 would pay a
  // sum nobody wrote, so it is refused, by its type.
  test('refuses a value that is not a decimal, by its type', () => {
    expect(errors(invoice(code({ amount: { cel: 'header.count' } })), data({ ...MAX, count: '45' }))).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-epc-qr-code',
        path: '/regions/summary/0/amount',
        message: "component pay-code: the amount gives integer, and an EPC QR code's amount is a decimal in euro, or null to leave it for the payer",
        componentId: 'pay-code',
      },
    ])
  })

  // An expression that fails is an error that names the code it stands in.
  test('names the code when its expression fails', () => {
    const failing = code({ amount: { cel: 'divide(header.amount, dec("0"), 2)' } })
    expect(errors(invoice(failing), data({ ...MAX, amount: '45.00' }))).toMatchObject([
      { stage: 'evaluation', code: 'expression-failed', path: '/regions/summary/0/amount/cel', componentId: 'pay-code', message: expect.stringMatching(/^component pay-code: /) },
    ])
  })
})

describe('a code read from data', () => {
  // Each rule the EPC gives, broken by a value from the data, where the
  // validator could not see it: refused on the field that breaks it, and
  // the message names the code and the rule, never the value, which may be
  // a person's name, account or reference.
  const BROKEN: readonly (readonly [string, Record<string, unknown>, Partial<EpcQrCodeComponent>, string])[] = [
    ['an IBAN whose check digits do not match', { iban: 'DE89370400440532013001' }, {}, 'iban'],
    ['an IBAN of a country outside SEPA', { iban: 'BR9700360305000010009795493P1' }, {}, 'iban'],
    ["an IBAN a digit short of its country's length", { iban: 'DE8937040044053201300' }, {}, 'iban'],
    ['a national account number', { iban: '0532013000' }, {}, 'iban'],
    ['a BIC of nine characters', { bic: 'COBADEFFX' }, { bic: read('bic') }, 'bic'],
    ['a BIC in lower case', { bic: 'cobadeffxxx' }, { bic: read('bic') }, 'bic'],
    ["a BIC of a bank in another country than the account's", { bic: 'BNPAFRPP' }, { bic: read('bic') }, 'bic'],
    ['an account outside the EEA, and no BIC', { iban: 'CH9300762011623852957' }, {}, 'bic'],
    ['an account outside the EEA, and a BIC the data gives empty', { iban: 'CH9300762011623852957', bic: '' }, { bic: read('bic') }, 'bic'],
    ['an account outside the EEA, and a BIC the data gives null', { iban: 'CH9300762011623852957', bic: null }, { bic: read('bic') }, 'bic'],
    ['a name that is empty', { name: '' }, {}, 'beneficiary'],
    ['a name of blanks', { name: '   ' }, {}, 'beneficiary'],
    ['a name of 71 characters', { name: 'M'.repeat(71) }, {}, 'beneficiary'],
    ['a name with a line feed in it', { name: 'Max\nMuster' }, {}, 'beneficiary'],
    ['a name with a tab in it', { name: 'Max\tMuster' }, {}, 'beneficiary'],
    ['a reference whose check digits do not match', { reference: 'RF19539007547034' }, { reference: read('reference') }, 'reference'],
    ['a Belgian structured reference', { reference: '+++090/9337/55493+++' }, { reference: read('reference') }, 'reference'],
    ['a text of 141 characters', { text: 't'.repeat(141) }, { text: read('text') }, 'text'],
    ['a text with a carriage return in it', { text: 'Rechnung\r2026-0042' }, { text: read('text') }, 'text'],
    ['information of 71 characters', { information: 'i'.repeat(71) }, { information: read('information') }, 'information'],
  ]
  test.each(BROKEN)('refuses %s, naming the field and never the value', (_name, values, patch, field) => {
    const refused = errors(invoice(code(patch)), data({ ...MAX, ...values }))
    expect(refused.map((error) => `${error.stage} ${error.code} ${error.path} ${'componentId' in error ? error.componentId : '-'}`)).toEqual([`resolve invalid-epc-qr-code /regions/summary/0/${field} pay-code`])
    expect(refused[0]?.message).toMatch(/^component pay-code: /)
    for (const value of Object.values(values)) if (typeof value === 'string' && value.trim() !== '') expect(refused[0]?.message).not.toContain(value)
  })

  // Every text is checked and every rule broken said, not the first alone:
  // a person who fixes one value and renders again is not refused anew for
  // the next. A BIC whose account is refused is not paired with it.
  test('says every rule the data breaks, in the order the payload holds them', () => {
    const refused = errors(invoice(code({ bic: read('bic'), text: read('text') })), data({ bic: 'COBADEFFX', name: '', iban: 'DE89370400440532013001', text: 't'.repeat(141) }))
    expect(refused.map(({ path }) => path)).toEqual(['/regions/summary/0/bic', '/regions/summary/0/beneficiary', '/regions/summary/0/iban', '/regions/summary/0/text'])
  })

  // Version 002 lets a code leave the BIC out, but "the BIC will continue
  // to be mandatory for SEPA payment transactions involving SCT scheme
  // participants from non-EEA countries" (EPC 2.2): a Swiss account is
  // paid to with its bank's BIC. A final render says so, and does not say a
  // preview lacked anything -- nor where the BIC is read from a field whose
  // null is no BIC.
  test('refuses an account outside the EEA without a BIC, saying why', () => {
    const refusal = {
      stage: 'resolve',
      code: 'invalid-epc-qr-code',
      path: '/regions/summary/0/bic',
      message: "component pay-code: an account outside the EEA is paid to with its bank's BIC: EPC069-12 2.2 keeps the BIC mandatory where SCT scheme participants from non-EEA countries take part",
      componentId: 'pay-code',
    }
    expect(errors(invoice(code()), data({ ...MAX, iban: 'CH9300762011623852957' }))).toEqual([refusal])
    expect(errors(invoice(code({ bic: read('bic') })), data({ ...MAX, iban: 'CH9300762011623852957', bic: null }))).toEqual([refusal])
  })

  // A BIC is not needed inside the EEA, but one that is given must be the
  // account's country's and a BIC; a BIC of Guernsey goes with a British
  // IBAN, as EPC409-09 pairs them.
  test("takes a BIC of the account's country, and writes version 001 for it", () => {
    expect(payload({ bic: read('bic') }, { ...MAX, bic: 'COBADEFFXXX' }).split('\n').slice(0, 5)).toEqual(['BCD', '001', '1', 'SCT', 'COBADEFFXXX'])
    expect(payload({ bic: read('bic') }, { ...MAX, iban: 'GB29NWBK60161331926819', bic: 'RBOSGGSX' }).split('\n').slice(4, 7)).toEqual(['RBOSGGSX', 'Max Muster', 'GB29NWBK60161331926819'])
  })
})

describe('a value the code lacks', () => {
  // A run whose value is null prints as nothing in a paragraph. In a code
  // it would make the transfer say less than the invoice -- a name cut
  // short, a reference without its number -- and scan as some other
  // transfer, so a final render refuses it, naming the code and the run.
  test('refuses a final render, naming the code and the run', () => {
    const short = code({ beneficiary: [{ kind: 'text', text: 'Muster ' }, { kind: 'field', field: header('name') }] })
    expect(errors(invoice(short), data({ ...MAX, name: null }))).toEqual([
      {
        stage: 'resolve',
        code: 'no-qr-value',
        path: '/regions/summary/0/beneficiary/1',
        message: 'component pay-code: this run has no value, and an EPC QR code without it would scan as some other transfer',
        componentId: 'pay-code',
      },
    ])
  })

  // An optional text is cut short as a required one is: where some of its
  // runs print and another's value is null -- "Rechnung " without its
  // number -- a final render refuses it, naming the run, though a text of
  // that null alone is no text and leaves its element unused.
  test('refuses a final render where an optional text prints some runs and lacks another', () => {
    const numbered = code({ information: [{ kind: 'text', text: 'Rechnung ' }, { kind: 'field', field: header('invoiceNo') }] })
    expect(errors(invoice(numbered), data({ ...MAX, invoiceNo: null })).map(({ code: refusal, path }) => `${refusal} ${path}`)).toEqual(['no-qr-value /regions/summary/0/information/1'])
    expect(payload({ information: read('invoiceNo') }, { ...MAX, invoiceNo: null })).toBe(HEAD)
  })

  // A preview prints a null as nothing, as a paragraph does, so that a
  // template can be looked at before its data is whole; an optional text
  // left so is an element the code leaves unused.
  test('is printed as nothing in a preview, an optional text then unused', () => {
    expect(payload({ amount: AMOUNT, text: read('text') }, { ...MAX, amount: '45.00', text: null }, PREVIEW)).toBe(`${HEAD}\nEUR45`)
  })

  // Where a preview's data lacks a text the EPC requires, the code could
  // not be paid by, and is refused as a final render would refuse it,
  // saying what the preview lacked; and an account outside the EEA whose
  // BIC the preview lacks is refused the same way.
  test('in a preview, is refused where the EPC requires the text, saying the preview lacked it', () => {
    expect(errors(invoice(code()), without(MAX, 'iban'), PREVIEW)).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-epc-qr-code',
        path: '/regions/summary/0/iban',
        message: 'component pay-code: the IBAN is empty, and an EPC QR code needs it; this preview has no value for a run of it',
        componentId: 'pay-code',
      },
    ])
    expect(errors(invoice(code({ bic: read('bic') })), without({ ...MAX, iban: 'CH9300762011623852957' }, 'bic'), PREVIEW).map(({ path, message }) => [path, message.endsWith('; this preview has no value for a run of it')])).toEqual([
      ['/regions/summary/0/bic', true],
    ])
  })
})

describe("what an engine reads of report-spec's decisions", () => {
  // An engine depends on the runtime alone, and draws a code and its frame
  // by report-spec's decisions, handed on here: the largest version, the
  // frame, the caption and the modules' widths it is printed at. A number
  // copied into an engine could disagree with the editor's, and nobody
  // would find out until a bank's app could not read a code the editor
  // took.
  test("hands them on as report-spec's own", () => {
    expect(runtime.EPC_MAX_VERSION).toBe(spec.EPC_MAX_VERSION)
    expect(runtime.EPC_MAX_BYTES).toBe(spec.EPC_MAX_BYTES)
    expect(runtime.EPC_FRAME).toBe(spec.EPC_FRAME)
    expect(runtime.EPC_CAPTION).toBe(spec.EPC_CAPTION)
    expect(runtime.EPC_CAPTION_MODULE).toBe(spec.EPC_CAPTION_MODULE)
    expect(runtime.epcCaptionBreak).toBe(spec.epcCaptionBreak)
    expect(runtime.epcLeastVersion).toBe(spec.epcLeastVersion)
    expect(runtime.epcLeastVersion).toBeTypeOf('function')
    expect(runtime.epcModule).toBe(spec.epcModule)
    expect(runtime.qrSymbolModules).toBe(spec.qrSymbolModules)
  })
})
