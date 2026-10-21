import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { E_INVOICE_KINDS, XRECHNUNG, XRECHNUNG_VERSIONS } from './e-invoice.js'
import { EN16931_RULES } from './en16931.js'
import { reportHash } from './hash.js'
import { editable, eInvoiceReport, removeAt, setAt, xrechnungInvoice, xrechnungReport } from './test-support.js'
import { validateReport } from './validate.js'
import { XRECHNUNG_RULES } from './xrechnung.js'

/**
 * An e-invoice of the kind `xrechnung` (0038): XRechnung 3.0, KoSIT's CIUS
 * of EN 16931 for a German public buyer, written as CII. Every term the
 * Factur-X kind has and every rule it is held to, and past them what
 * XRechnung's own schematron needs and refuses.
 */

const EI = '/eInvoice'

/** The EPC QR code the fixture's summary holds, which pays the e-invoice's account. */
const EPC = '/regions/summary/3'

/** Runs of one literal text. */
const literal = (text: string): unknown[] => [{ kind: 'text', text }]

/** A copy of `base` with each edit made at a pointer under its e-invoice; undefined removes what is there. */
function edited(base: ReportDefinition, edits: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const document = editable(base)
  for (const [pointer, value] of Object.entries(edits)) {
    if (value === undefined) removeAt(document, `${EI}${pointer}`)
    else setAt(document, `${EI}${pointer}`, JSON.parse(JSON.stringify(value)))
  }
  return document
}

const xrechnung = (edits: Readonly<Record<string, unknown>> = {}): Record<string, unknown> => edited(xrechnungReport(), edits)
const facturX = (edits: Readonly<Record<string, unknown>> = {}): Record<string, unknown> => edited(eInvoiceReport(), edits)

/** The code and path of each error a document is refused with; none when it is valid. */
function refusals(document: unknown): string[] {
  const outcome = validateReport(document)
  return outcome.valid ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`)
}

/** Every message said in this file, so the last case can hold the rule ids they name to the lists the gate reads. */
const heard: string[] = []

/** The message of each error a document is refused with, by its path. */
function messages(document: unknown): Record<string, string> {
  const outcome = validateReport(document)
  const said = outcome.valid ? {} : Object.fromEntries(outcome.errors.map((error) => [error.path, error.message]))
  heard.push(...Object.values(said))
  return said
}

describe('an XRechnung', () => {
  // A second kind beside Factur-X, with its version where Factur-X has its
  // profile: XRechnung 3.0, the major and minor version BT-24 names, which
  // KoSIT's 3.0.2 is a release of. A version this release does not write is
  // refused, never written as 3.0 (fail closed); and neither kind takes the
  // other's key, so that one invoice has one spelling.
  test('is a kind of its own, of a version this release writes', () => {
    expect(E_INVOICE_KINDS).toEqual(['facturX', 'xrechnung'])
    expect(XRECHNUNG_VERSIONS).toEqual(['3.0'])
    expect(XRECHNUNG).toEqual({ '3.0': { guideline: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0', release: '3.0.2', syntax: 'cii' } })
    expect(refusals(xrechnung({ '/version': '2.3' }))).toEqual([`not-one-of ${EI}/version`])
    expect(refusals(xrechnung({ '/version': 3 }))).toEqual([`not-one-of ${EI}/version`])
    expect(refusals(xrechnung({ '/version': undefined }))).toEqual([`missing-property ${EI}/version`])
    expect(refusals(xrechnung({ '/profile': 'en16931' }))).toEqual([`unknown-property ${EI}/profile`])
    expect(refusals(facturX({ '/version': '3.0' }))).toEqual([`unknown-property ${EI}/version`])
    expect(refusals(xrechnung({ '/kind': 'XRechnung' }))).toEqual([`unknown-kind ${EI}/kind`])
  })

  // The validator's copy is what a session commits and what is hashed: an
  // XRechnung read as a Factur-X, or its version dropped, would be another
  // invoice the first edit wrote.
  test('is read back whole, and is part of what the hash names', () => {
    const outcome = validateReport(xrechnungReport())
    expect(outcome.valid ? [] : outcome.errors).toEqual([])
    expect(outcome.valid && outcome.report).toEqual(xrechnungReport())
    expect(reportHash(xrechnungReport())).not.toBe(reportHash(eInvoiceReport()))
  })

  // XRechnung's schematron needs what EN 16931 lets an invoice leave out:
  // the business process (PEPPOL-EN16931-R001), the buyer's reference
  // (BR-DE-15), the payment instructions (BR-DE-1), the seller's contact
  // (BR-DE-2) and both electronic addresses (PEPPOL-EN16931-R020, -R010),
  // each fatal. A template without one would write a file KoSIT's XRechnung
  // scenario refuses; each is refused where it is missing, naming the rule,
  // and the same template as a Factur-X invoice is valid without it.
  test('has what XRechnung needs past EN 16931, each missing one refused by its rule', () => {
    const needs = {
      '/businessProcess': "the business process (BT-23) is not given, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R001)",
      '/buyerReference': "the buyer's reference (BT-10), a public buyer's Leitweg-ID, is not given, and an XRechnung needs it (XRechnung's BR-DE-15)",
      '/payment': "the payment instructions (BG-16) are not given, and an XRechnung needs them (XRechnung's BR-DE-1)",
      '/seller/contact': "the seller's contact (BG-6) is not given, and an XRechnung needs it (XRechnung's BR-DE-2)",
      '/seller/electronicAddress': "the seller's electronic address (BT-34) is not given, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R020)",
      '/buyer/electronicAddress': "the buyer's electronic address (BT-49) is not given, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R010)",
    }
    // The EPC QR code the fixture prints asks for the account the payment instructions give: without them it is refused too, so it goes with them.
    const without = (document: Record<string, unknown>, pointer: string): Record<string, unknown> => {
      if (pointer === '/payment') removeAt(document, EPC)
      return document
    }
    for (const [pointer, message] of Object.entries(needs)) {
      const document = without(xrechnung({ [pointer]: undefined }), pointer)
      expect(refusals(document), pointer).toEqual([`invalid-e-invoice ${EI}${pointer}`])
      expect(messages(document)[`${EI}${pointer}`]).toBe(message)
      expect(refusals(without(facturX({ [pointer]: undefined }), pointer)), pointer).toEqual([])
    }
  })

  // A part whose parent is missing, written as a string or as a list is
  // that parent's fault, said once where the parent is read: a second
  // refusal of the part under it would name a place the document has not.
  test('says a need under a parent that is not an object nowhere but at the parent', () => {
    expect(refusals(xrechnung({ '/seller': undefined }))).toEqual([`missing-property ${EI}/seller`])
    expect(refusals(xrechnung({ '/seller': 'Muster & Söhne GmbH' }))).toEqual([`wrong-type ${EI}/seller`])
    expect(refusals(xrechnung({ '/buyer': [] }))).toEqual([`wrong-type ${EI}/buyer`])
  })

  // A term XRechnung needs that says nothing is as missing as one left
  // out: KoSIT reads each through normalize-space, or as an element that
  // must be there, and a blank one is refused by the same rule, as the
  // validator's EN 16931 terms are. In a Factur-X invoice each may be
  // left out, and a blank one is a second spelling of absent.
  test('has every text it needs say something, each refused by its rule', () => {
    const texts = {
      '/businessProcess': "the business process (BT-23) is empty, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R001)",
      '/buyerReference': "the buyer's reference (BT-10) is empty, and an XRechnung needs it (XRechnung's BR-DE-15)",
      '/seller/electronicAddress/id': "the seller's electronic address (BT-34) is empty, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R020)",
      '/buyer/electronicAddress/id': "the buyer's electronic address (BT-49) is empty, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R010)",
      '/seller/contact/name': "the seller's contact point (BT-41) is empty, and an XRechnung needs it (XRechnung's BR-DE-5)",
      '/seller/contact/telephone': "the seller's contact telephone number (BT-42) is empty, and an XRechnung needs it (XRechnung's BR-DE-6)",
      '/seller/contact/email': "the seller's contact email address (BT-43) is empty, and an XRechnung needs it (XRechnung's BR-DE-7)",
    }
    for (const [pointer, message] of Object.entries(texts)) {
      const document = xrechnung({ [pointer]: literal('  ') })
      expect(refusals(document), pointer).toEqual([`invalid-e-invoice ${EI}${pointer}`])
      expect(messages(document)[`${EI}${pointer}`]).toBe(message)
      expect(messages(facturX({ [pointer]: literal('  ') }))[`${EI}${pointer}`], pointer).toMatch(/is blank: a term the e-invoice does not hold is left out of it$/)
    }
  })

  // BR-DE-18 reads every line of the payment terms that begins with # as
  // a Skonto line of XRechnung's own syntax, fatal where it is not one.
  // This release writes no Skonto (0038, Q4): a structured discount waits
  // for XRechnung 4.0, which replaces the syntax. So an XRechnung's terms
  // hold no line led by #, a well-formed one among them, refused where it
  // is written; a Factur-X invoice's terms are free text.
  test('has payment terms with no line led by #, which BR-DE-18 reads as a Skonto line', () => {
    for (const text of ['Zahlbar binnen 14 Tagen.\n#SKONTO#TAGE=14#PROZENT=2.00#\n', '#SKONTO#TAGE=14#PROZENT=2#', 'Zahlbar binnen 14 Tagen.\r\n \t#']) {
      const document = xrechnung({ '/terms': literal(text) })
      expect(refusals(document), JSON.stringify(text)).toEqual([`invalid-e-invoice ${EI}/terms`])
      expect(messages(document)[`${EI}/terms`]).toBe(
        "the payment terms (BT-20) hold a line that begins with #, which XRechnung reads as a Skonto line of its own syntax, and this release writes none: a discount is said in words (XRechnung's BR-DE-18)",
      )
      expect(refusals(facturX({ '/terms': literal(text) })), JSON.stringify(text)).toEqual([])
    }
    for (const text of ['Zahlbar binnen 14 Tagen. # 1', 'Rechnung Nr. #4711', ' #SKONTO#']) expect(refusals(xrechnung({ '/terms': literal(text) })), JSON.stringify(text)).toEqual([])
  })

  // An electronic address under 0204 says it is a Leitweg-ID, which a
  // public buyer's portal routes the invoice by and checks by its check
  // digits; neither KoSIT nor Mustang does (measured, 0038). So an address
  // under 0204 is held to the Leitweg-ID's shape and check digits, in an
  // invoice of either kind, the scheme saying what the value is. The
  // buyer's reference is not: a B2B XRechnung carries an order number
  // there, and BR-DE-15 asks only that it be given (Q3).
  test('holds an electronic address under 0204 to a Leitweg-ID, and the buyer reference to nothing', () => {
    const leitweg = (id: string) => ({ id: literal(id), scheme: '0204' })
    for (const document of [xrechnung, facturX]) {
      expect(refusals(document({ '/buyer/electronicAddress': leitweg('991-33333TEST-33') }))).toEqual([])
      expect(refusals(document({ '/seller/electronicAddress': leitweg('04011000-12345-03') }))).toEqual([])
      const wrong = document({ '/buyer/electronicAddress': leitweg('991-33333TEST-34') })
      expect(refusals(wrong)).toEqual([`invalid-e-invoice ${EI}/buyer/electronicAddress/id`])
      expect(messages(wrong)[`${EI}/buyer/electronicAddress/id`]).toBe(
        "the buyer's electronic address (BT-49) is under 0204, a Leitweg-ID, and has check digits that do not match the rest of it (the Leitweg-ID's check digits, ISO/IEC 7064 MOD 97-10)",
      )
      expect(refusals(document({ '/buyer/electronicAddress': leitweg('rechnung@bund.example') }))).toEqual([`invalid-e-invoice ${EI}/buyer/electronicAddress/id`])
      // The same text under another scheme is no Leitweg-ID, and held to nothing of one.
      expect(refusals(document({ '/buyer/electronicAddress': { id: literal('991-33333TEST-34'), scheme: '0088' } }))).toEqual([])
    }
    expect(refusals(xrechnung({ '/buyerReference': literal('991-33333TEST-34') }))).toEqual([])
    expect(refusals(xrechnung({ '/buyerReference': literal('PO-4711') }))).toEqual([])
    // One read from data is the render's to check.
    expect(refusals(xrechnung({ '/buyer/electronicAddress': { id: [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }], scheme: '0204' } }))).toEqual([])
  })

  // The title rule is the PDF/A's: PDFKit writes the title into a
  // Factur-X's XMP unescaped (0027, 0031). An XRechnung's copy is a plain
  // PDF with no XMP, and its XML holds no title, so its title is the
  // author's, as any report's is.
  test('has a title of any text, which no XMP holds', () => {
    expect(refusals({ ...editable(xrechnungReport()), title: 'Müller & Söhne <AG>' })).toEqual([])
    expect(refusals({ ...editable(eInvoiceReport()), title: 'Müller & Söhne <AG>' })).toEqual(['invalid-e-invoice /title'])
  })

  // Everything else an XRechnung holds is EN 16931's, held by the same
  // rules as a Factur-X invoice's: a literal country written UK, a rate
  // its code does not allow, a column that does not print a line.
  test("is held to EN 16931's rules as a Factur-X invoice is", () => {
    expect(refusals(xrechnung({ '/seller/address/country': literal('UK') }))).toEqual([`invalid-e-invoice ${EI}/seller/address/country`])
    expect(refusals(xrechnung({ '/vat/0/rate': '0' }))).toEqual([`invalid-e-invoice ${EI}/vat/0/rate`])
    expect(refusals(xrechnung({ '/lines/name': 'missing' }))).toEqual([`unknown-column ${EI}/lines/name`])
    expect(refusals(xrechnung({ '/seller/contact/telephone': literal('+49') }))).toEqual([`invalid-e-invoice ${EI}/seller/contact/telephone`])
    expect(xrechnungInvoice().kind).toBe('xrechnung')
  })
})

describe('the rules an XRechnung is refused by', () => {
  // Every id a refusal above names is one the gate holds to a rule of a
  // pinned schematron: EN 16931's to CEN's, XRechnung's to XRechnung's.
  // An id said that is not listed would escape the gate. Run last.
  test('are ids of the lists the gate reads', () => {
    expect(heard.length).toBeGreaterThan(15)
    const listed: readonly string[] = [...EN16931_RULES, ...XRECHNUNG_RULES]
    for (const message of heard) for (const [id] of message.matchAll(/\b(?:BR-(?:[A-Z]+-)?\d+(?:-[a-z])?|PEPPOL-EN16931-R\d+)\b/g)) expect(listed, `${id} in "${message}"`).toContain(id)
  })
})
