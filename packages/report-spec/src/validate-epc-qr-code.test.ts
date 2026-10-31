import { describe, expect, test } from 'vitest'
import { REGION_NAMES } from './definition.js'
import { EPC_CAPTIONS } from './epc-qr-code.js'
import { reportHash } from './hash.js'
import { append, edited, editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** Where the fixture's EPC QR code is: last in the summary. */
const CODE = '/regions/summary/3'

/** Runs of one literal text. */
const literal = (text: string): unknown[] => [{ kind: 'text', text }]

/** A run of the customer's name, which the header dataset supplies. */
const customer = [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }]

/** The fixture with each edit made, at a pointer under its EPC QR code; undefined removes. */
function code(edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return edited((r) => {
    for (const [pointer, value] of Object.entries(edits)) {
      if (value === undefined) removeAt(r, `${CODE}${pointer}`)
      else setAt(r, `${CODE}${pointer}`, value)
    }
  })
}

/** The message of each error a document is refused with, by its path. */
function messages(document: unknown): Record<string, string> {
  const outcome = validateReport(document)
  return outcome.valid ? {} : Object.fromEntries(outcome.errors.map((error) => [error.path, error.message]))
}

/** An EPC QR code of the fixture's account alone, to stand anywhere. */
function alone(id = 'pay'): unknown {
  return { id, kind: 'epcQrCode', size: 85.04, beneficiary: literal('Franz Mustermänn'), iban: literal('DE71 1102 2033 0123 4567 89') }
}

describe('an EPC QR code', () => {
  // The fixture is what every case below edits: were its code not the
  // EPC's first sample, literal where these cases expect it, they would
  // pass for the wrong reason.
  test("is the fixture's EPC sample, literal where the cases expect it", () => {
    const report = editable(richReport())
    expect(getAt(report, CODE)).toMatchObject({
      kind: 'epcQrCode',
      iban: literal('DE71 1102 2033 0123 4567 89'),
      bic: literal('BHBLDEHHXXX'),
      purpose: 'GDDS',
      caption: 'zahlenMitCode',
    })
    expect(refusals(report)).toEqual([])
  })

  // The validator's copy is what a session commits and what is hashed. A
  // field read and left out of it would be dropped by the first edit.
  test('is read back whole, and is part of what the hash names', () => {
    const outcome = validateReport(richReport())
    expect(outcome.valid && outcome.report.regions.summary[3]).toEqual(richReport().regions.summary[3])
    expect(reportHash(richReport())).not.toBe(reportHash(code({ '/purpose': undefined }) as never))
  })

  // A code is its square, the account and its owner: EPC069-12 2.2 makes
  // the name and the IBAN mandatory, and the rest optional. Its shape is
  // strict as every shape is: no currency, which is euro; no level, which
  // is M; no version, which is the payload's; no colour.
  test('has a size, a beneficiary and an IBAN, and nothing it does not know', () => {
    for (const key of ['size', 'beneficiary', 'iban']) expect(refusals(code({ [`/${key}`]: undefined })), key).toEqual([`missing-property ${CODE}/${key}`])
    for (const key of ['bic', 'amount', 'purpose', 'reference', 'information', 'caption']) expect(refusals(code({ [`/${key}`]: undefined })), key).toEqual([])
    for (const key of ['currency', 'errorCorrection', 'version', 'color', 'content']) {
      expect(refusals(code({ [`/${key}`]: 'EUR' })), key).toEqual([`unknown-property ${CODE}/${key}`])
    }
  })

  // A text present holds one run at least; one the code leaves empty is
  // absent, so that one code has one spelling and one hash.
  test('holds one run at least in each text it has', () => {
    for (const key of ['beneficiary', 'iban', 'bic', 'reference', 'information'])
      expect(refusals(code({ [`/${key}`]: [] })), key).toEqual([`too-few ${CODE}/${key}`])
  })

  // The same for a run: an optional text written as an empty or blank
  // literal is the element left out, spelt a second way with a hash of its
  // own, and its spaces would be encoded as a text of nothing (EPC069-12
  // 2.2 gives every element it holds one character at least). Refused on
  // its field, in the same words for each, where the BIC's and the
  // reference's own shapes would have refused it as no BIC and no
  // reference.
  test('refuses an optional text written empty or blank, which is the text left out', () => {
    const LEFT_OUT = 'is blank, and an element the code holds has one character at least (EPC069-12 2.2): a text the code does not hold is left out'
    const fields = [
      ['bic', 'the BIC', {}],
      ['reference', 'the reference', {}],
      ['text', 'the text', { '/reference': undefined }],
      ['information', 'the information', {}],
    ] as const
    for (const [key, what, others] of fields) {
      for (const blank of ['', '  ']) {
        const report = code({ ...others, [`/${key}`]: literal(blank) })
        expect(refusals(report), `${key} ${JSON.stringify(blank)}`).toEqual([`invalid-epc-qr-code ${CODE}/${key}`])
        expect(messages(report)[`${CODE}/${key}`]).toBe(`${what} ${LEFT_OUT}`)
      }
    }
    expect(messages(code({ '/beneficiary': literal(' ') }))[`${CODE}/beneficiary`]).toBe("the beneficiary's name is empty, and an EPC QR code needs it")
  })

  // A code holds nothing and does not flow: a box of fixed size, as a QR
  // code is, standing wherever one may -- the PSA asks for the lower edge
  // of the page, which a page footer or a column at the summary's end is.
  test('stands wherever a QR code does: in every region and in every container', () => {
    for (const region of REGION_NAMES) {
      const report = editable(richReport())
      append(report, `/regions/${region}`, alone())
      expect(refusals(report), region).toEqual([])
    }
    for (const pointer of ['/regions/reportHeader/0/columns/0/components/1', '/regions/body/3/components/2', '/regions/summary/0/components/3']) {
      expect(refusals(edited((r) => setAt(r, pointer, alone()))), pointer).toEqual([])
    }
  })

  // A table's cell holds a run, read once a row: a code there would be a
  // code per row, which nothing draws.
  test('cannot stand in a table cell', () => {
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/columns/0/value', alone())))).toEqual(['unknown-kind /regions/body/2/columns/0/value/kind'])
  })

  // A square is measured against the printable area as a QR code's is.
  test('is a square the printable area holds', () => {
    expect(refusals(code({ '/size': 510.25, '/caption': undefined }))).toEqual([`exceeds-printable-area ${CODE}/size`])
  })

  // Its texts are read once, as a paragraph's in its place: a header field
  // or a parameter, never a detail field outside the table. A page number
  // or count is refused in every region, the page footer among them: what
  // a code encodes is resolved whole before pages are counted, and a
  // counter would be encoded as nothing.
  test('reads what a paragraph in its place reads, and never a page number or count', () => {
    expect(refusals(code({ '/beneficiary': customer, '/information/1': { kind: 'parameter', parameter: 'region' } }))).toEqual([])
    expect(refusals(code({ '/text': [{ kind: 'field', field: { dataset: 'detail', field: 'site' } }], '/reference': undefined }))).toEqual([
      `misplaced-detail-field ${CODE}/text/0/field`,
    ])
    for (const region of REGION_NAMES) {
      for (const key of ['beneficiary', 'information']) {
        const report = editable(richReport())
        const at = append(report, `/regions/${region}`, { ...(alone() as object), [key]: [{ kind: 'text', text: 'Seite ' }, { kind: 'pageNumber' }] })
        expect(refusals(report), `${key} in ${region}`).toEqual([`misplaced-page-counter ${at}/${key}/1`])
      }
    }
  })
})

describe('the texts of an EPC QR code', () => {
  // A literal text prints the same in every render, so the EPC's rules are
  // applied where it is written: a mistyped IBAN is refused in the editor,
  // not by the payer's bank.
  test('are refused where a literal one breaks the EPC rules', () => {
    expect(refusals(code({ '/iban': literal('DE71 1102 2033 0123 4567 88') }))).toEqual([`invalid-epc-qr-code ${CODE}/iban`])
    expect(refusals(code({ '/bic': literal('BHBLDEHH XXX') }))).toEqual([`invalid-epc-qr-code ${CODE}/bic`])
    expect(refusals(code({ '/beneficiary': literal('x'.repeat(71)) }))).toEqual([`invalid-epc-qr-code ${CODE}/beneficiary`])
    expect(refusals(code({ '/reference': literal('+++090/9337/55493+++') }))).toEqual([`invalid-epc-qr-code ${CODE}/reference`])
    expect(refusals(code({ '/reference': undefined, '/text': literal('Rechnung\n2026-0042') }))).toEqual([`invalid-epc-qr-code ${CODE}/text`])
    expect(refusals(code({ '/information': literal('i'.repeat(71)) }))).toEqual([`invalid-epc-qr-code ${CODE}/information`])
    // Literal runs are read as the text they make together.
    expect(
      refusals(
        code({
          '/iban': [
            { kind: 'text', text: 'DE71 1102 2033 ' },
            { kind: 'text', text: '0123 4567 89' },
          ],
        }),
      ),
    ).toEqual([])
  })

  // The message says which field broke which rule, and never quotes the
  // text: an IBAN, a name or a reference may be a person's.
  test('are refused naming the field and the rule, never the text', () => {
    const said = messages(
      code({
        '/iban': literal('DE71 1102 2033 0123 4567 88'),
        '/bic': literal('bhbldehhxxx'),
        '/beneficiary': literal('Pia-Maria Rutschmann-Schnyder'.repeat(3)),
        '/reference': literal('RF19 5390 0754 7034'),
        '/information': literal('Danke,\nPia'),
      }),
    )
    expect(said).toEqual({
      [`${CODE}/iban`]: 'the IBAN has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)',
      [`${CODE}/bic`]:
        'the BIC is not a BIC: four letters or digits for the bank, two letters for its country, two letters or digits for its place, and three for a branch or none (ISO 9362)',
      [`${CODE}/beneficiary`]: "the beneficiary's name is 87 characters long; the EPC allows at most 70",
      [`${CODE}/reference`]: 'the reference has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)',
      [`${CODE}/information`]: 'the information holds a control character or a line break at character 7, which would end its line of the code early',
    })
    for (const message of Object.values(said)) expect(message).not.toMatch(/1102|bhbl|Rutschmann|5390|Pia/)
  })

  // A text written as a plain string is not runs: refused as the wrong
  // type, without the quote the shared check gives a string it finds.
  test('are refused unquoted when written as a string, not as runs', () => {
    const report = code({ '/iban': 'DE71 1102 2033 0123 4567 89', '/beneficiary': ['Franz Mustermänn'] })
    expect(refusals(report).sort()).toEqual([`wrong-type ${CODE}/beneficiary/0`, `wrong-type ${CODE}/iban`])
    for (const message of Object.values(messages(report))) expect(message).not.toMatch(/1102|Mustermänn/)
  })

  // What a field, a parameter or an expression prints is not known until
  // a render, and is the runtime's to check with the same rules.
  test('are checked only when literal: one read from the data is left to the render', () => {
    expect(refusals(code({ '/iban': customer, '/bic': customer, '/beneficiary': customer, '/reference': customer }))).toEqual([])
    expect(
      refusals(
        code({
          '/iban': [
            { kind: 'text', text: 'DE71 ' },
            { kind: 'parameter', parameter: 'region' },
          ],
        }),
      ),
    ).toEqual([])
  })

  // "Only one of the elements may be populated" (EPC069-12 2.2, {Or}): a
  // code with both would have its reference read and its text dropped, or
  // the other way round, by whichever bank's app reads it.
  test('hold a creditor reference or a text, never both', () => {
    expect(refusals(code({ '/reference': undefined, '/text': literal('Rechnung 2026-0042') }))).toEqual([])
    const both = code({ '/text': literal('Rechnung 2026-0042') })
    expect(refusals(both)).toEqual([`invalid-epc-qr-code ${CODE}/text`])
    expect(messages(both)[`${CODE}/text`]).toBe('a code holds a creditor reference or a text, never both: only one of the two may be populated (EPC069-12 2.2)')
    // Read from the data, both are still both.
    expect(refusals(code({ '/reference': customer, '/text': customer }))).toEqual([`invalid-epc-qr-code ${CODE}/text`])
  })

  // A Swiss account is paid to with its bank's BIC (EPC069-12 2.2): a
  // literal one without, or with a BIC of another country, is refused on
  // the BIC. A German account needs none.
  test('pair the BIC with the IBAN, where both are known', () => {
    const swiss = literal('CH93 0076 2011 6238 5295 7')
    expect(refusals(code({ '/bic': undefined }))).toEqual([])
    expect(refusals(code({ '/iban': swiss, '/bic': undefined }))).toEqual([`invalid-epc-qr-code ${CODE}/bic`])
    expect(refusals(code({ '/iban': swiss, '/bic': literal('UBSWCHZH80A') }))).toEqual([])
    expect(refusals(code({ '/iban': swiss }))).toEqual([`invalid-epc-qr-code ${CODE}/bic`])
    expect(refusals(code({ '/iban': swiss, '/bic': customer }))).toEqual([])
    expect(messages(code({ '/iban': swiss, '/bic': undefined }))[`${CODE}/bic`]).toMatch(/^an account outside the EEA is paid to with its bank's BIC/)
  })

  // The payload is at most 331 bytes (EPC069-12 2.2). What literal texts
  // write before any data is read is already that many bytes at least:
  // past it, no data can make a code of it, and it is refused where it is
  // written. A name of 70 umlauts is 140 bytes; with the fixture's BIC,
  // IBAN and purpose, a text of 140 characters and information of 70, the
  // code is 408 bytes before its amount, each text within its own length.
  test('are refused when the literal texts alone pass 331 bytes', () => {
    const full = {
      '/beneficiary': literal('ä'.repeat(70)),
      '/reference': undefined,
      '/text': literal('t'.repeat(140)),
      '/information': literal('i'.repeat(70)),
    }
    expect(refusals(code(full))).toEqual([`invalid-epc-qr-code ${CODE}`])
    expect(messages(code(full))[CODE]).toBe(
      'its literal texts alone make a payload that is 408 bytes long in UTF-8; the EPC allows at most 331 (EPC069-12 2.2), what a version 13 code holds at level M',
    )
    // Read from the data, the text may be empty: the rest alone fits.
    expect(refusals(code({ ...full, '/text': customer }))).toEqual([])
  })
})

describe('the purpose of an EPC QR code', () => {
  // A purpose code is written into the template, four capitals: what the
  // transfer is for is the template's, not the data's.
  test('is four capital letters, written as a string', () => {
    expect(refusals(code({ '/purpose': 'SALA' }))).toEqual([])
    expect(refusals(code({ '/purpose': 'gdds' }))).toEqual([`invalid-epc-qr-code ${CODE}/purpose`])
    expect(refusals(code({ '/purpose': literal('GDDS') }))).toEqual([`wrong-type ${CODE}/purpose`])
  })
})

describe('the amount of an EPC QR code', () => {
  // The amount is a value the runtime computes, as a QR-bill's is: an
  // expression, never a number written into the template.
  test('is an expression', () => {
    expect(refusals(code({ '/amount': { cel: 'dec("12.30")' } }))).toEqual([])
    expect(refusals(code({ '/amount': 12.3 }))).toEqual([`wrong-type ${CODE}/amount`])
    expect(refusals(code({ '/amount': { cel: ' ' } }))).toEqual([`empty-expression ${CODE}/amount/cel`])
  })
})

describe("an EPC QR code's caption", () => {
  // Austria's frame and caption are an option, and the only one: a caption
  // this version does not know is refused, never drawn as some other.
  test("is Austria's, or none", () => {
    expect(EPC_CAPTIONS).toEqual(['zahlenMitCode'])
    expect(refusals(code({ '/caption': 'girocode' }))).toEqual([`not-one-of ${CODE}/caption`])
  })

  // With the caption, the PSA prints modules from 15 to 20 mil (PSA v3.0
  // 5), and the caption stands beside the symbol, no longer than it is
  // tall. A square in which no version from 1 to 13 does both, below 68.06
  // pt or above 118.6, is refused on its size: the renderer would refuse
  // it whatever the payload. Without the caption, the same square is the
  // author's, and the renderer holds it to 0020's floor.
  test('refuses a size in which no version prints the modules the PSA allows beside the caption', () => {
    expect(refusals(code({ '/size': 68.05 }))).toEqual([`invalid-epc-qr-code ${CODE}/size`])
    expect(refusals(code({ '/size': 118.61 }))).toEqual([`invalid-epc-qr-code ${CODE}/size`])
    expect(refusals(code({ '/size': 68.06 }))).toEqual([])
    expect(refusals(code({ '/size': 118.6 }))).toEqual([])
    expect(refusals(code({ '/size': 68.05, '/caption': undefined }))).toEqual([])
    expect(refusals(code({ '/size': 118.61, '/caption': undefined }))).toEqual([])
    expect(messages(code({ '/size': 38.86 }))[`${CODE}/size`]).toMatch(
      /^with the caption, a code needs a square of at least 68\.06 pt, and this one is 38\.86 pt/,
    )
  })
})
