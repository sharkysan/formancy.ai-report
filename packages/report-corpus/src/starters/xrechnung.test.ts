import { diagnose } from '@formancy/report-core'
import { checkReport, resolveReport, XRECHNUNG, XRECHNUNG_COPY_LABEL } from '@formancy/report-runtime'
import type { Block, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { elementsAt, readCii, textAt, textsAt } from '../testing/cii.js'
import { E_INVOICE, E_INVOICE_ADDRESSED, E_INVOICE_SAMPLES } from './e-invoice.js'
import { starterImages, STARTERS } from './index.js'
import { XRECHNUNG_SAMPLE, XRECHNUNG_SAMPLES } from './xrechnung.js'

/**
 * The XRechnung sample (0038): the e-invoice's template as an XRechnung
 * 3.0, from the euro invoice's heating firm to an invented federal buyer,
 * its Leitweg-ID one of KoSIT's test values. What the runtime makes of it
 * is read back here, as the XML a host takes and the document a copy is
 * drawn from; that its amounts are its data's and its page its XML's,
 * `e-invoice.test.ts` holds of it as of every e-invoice sample.
 */

const CREATED = '2026-10-16T08:00:00Z'

function resolved(): ResolvedDocument {
  const outcome = resolveReport(XRECHNUNG_SAMPLE.report, XRECHNUNG_SAMPLE.data, {
    mode: 'final',
    parameters: XRECHNUNG_SAMPLE.parameters,
    images: starterImages,
    creationDate: CREATED,
  })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; '))
  expect(outcome.warnings).toEqual([])
  return outcome.document
}

const HTA = 'rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement'

/** Every leaf at which two values differ, as a pointer. */
const differences = (a: unknown, b: unknown, at = ''): string[] => {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b) ? [] : [at]
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  return keys.flatMap((key) => differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}/${key}`))
}

describe('the XRechnung sample', () => {
  // One sample, "Rechnung (XRechnung)", in German, apart from the Factur-X
  // samples, which a PDF/A-3b embeds: its PDF is a copy, and the gate
  // judges its XML in KoSIT's XRechnung scenario. A sample, not a
  // starter: neither builder edits an e-invoice yet (0027).
  test('is one, in German, no starter and no Factur-X sample', () => {
    expect(XRECHNUNG_SAMPLES).toEqual([XRECHNUNG_SAMPLE])
    expect([XRECHNUNG_SAMPLE.id, XRECHNUNG_SAMPLE.title, XRECHNUNG_SAMPLE.report.locale, XRECHNUNG_SAMPLE.report.eInvoice?.kind]).toEqual([
      'e-invoice-xrechnung',
      'Rechnung (XRechnung)',
      'de-DE',
      'xrechnung',
    ])
    expect(STARTERS).not.toContain(XRECHNUNG_SAMPLE)
    expect(E_INVOICE_SAMPLES).not.toContain(XRECHNUNG_SAMPLE)
  })

  // The e-invoice's template, so that what the gate passes in KoSIT's
  // XRechnung scenario is the template an author has, made an XRechnung:
  // apart from the Factur-X sample only in its id and title, its kind and
  // version where the profile was, what XRechnung needs past EN 16931 --
  // the addressed sample's business process, seller's address and contact
  // (0037), the buyer's reference and electronic address read from the
  // Leitweg-ID the data gives -- the header field that gives it, and the
  // line of the head that prints it.
  test("is the e-invoice's template, made an XRechnung and apart in nothing else", () => {
    expect(differences(E_INVOICE.report, XRECHNUNG_SAMPLE.report)).toEqual([
      '/datasets/header/fields/14',
      '/eInvoice/businessProcess',
      '/eInvoice/buyer/electronicAddress',
      '/eInvoice/buyerReference',
      '/eInvoice/kind',
      '/eInvoice/profile',
      '/eInvoice/seller/contact',
      '/eInvoice/seller/electronicAddress',
      '/eInvoice/version',
      '/id',
      '/regions/reportHeader/4/columns/1/components/6',
      '/title',
    ])
    const [addressed, xrechnung] = [E_INVOICE_ADDRESSED.report.eInvoice, XRECHNUNG_SAMPLE.report.eInvoice]
    expect([xrechnung?.businessProcess, xrechnung?.seller.contact, xrechnung?.seller.electronicAddress]).toEqual([
      addressed?.businessProcess,
      addressed?.seller.contact,
      addressed?.seller.electronicAddress,
    ])
  })

  // A sample the validator refuses, or whose expressions the editor marks,
  // is a broken XRechnung shown as an example.
  test('validates, with no diagnostic at all', () => {
    const outcome = checkReport(XRECHNUNG_SAMPLE.report)
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
    expect(
      diagnose(XRECHNUNG_SAMPLE.report).map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`),
    ).toEqual([])
  })

  // Its own data in a final render resolves to the XML a host takes, named
  // as an XRechnung 3.0 in CII, and a document every page of which says it
  // is the copy.
  test('resolves its own data to its XML, and a document labelled as the copy', () => {
    const document = resolved()
    expect(document.eInvoice).toEqual({
      kind: 'xrechnung',
      xml: expect.stringMatching(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rsm:CrossIndustryInvoice /),
      syntax: 'cii',
      guideline: XRECHNUNG['3.0'].guideline,
      version: '3.0',
    })
    const label = document.pageHeader[0] as Block
    expect(label.kind === 'paragraph' && label.runs.map((run) => ('text' in run ? run.text : '')).join('')).toBe(XRECHNUNG_COPY_LABEL)
  })

  // The path it is there for, at the paths CEN's binding gives each term:
  // BT-24 XRechnung's, the buyer's reference and its electronic address
  // under 0204 the Leitweg-ID the data gives, the business process, the
  // seller's address by email and its contact. The Leitweg-ID is KoSIT's
  // own test value, from its XRechnung 3.0.2 test suite of 2026-08-31
  // (instance 03.06a), with right check digits, for the federal test
  // portal: a real authority's would route the invoice to it.
  test('takes the path it is there for', () => {
    const root = readCii(resolved().eInvoice?.xml ?? '')
    const addressed = (party: string) =>
      elementsAt(root, `${HTA}/ram:${party}/ram:URIUniversalCommunication/ram:URIID`).map((element) => `${element.attributes['schemeID']}:${element.text}`)
    const contact = `${HTA}/ram:SellerTradeParty/ram:DefinedTradeContact`
    expect({
      guideline: textAt(root, 'rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID'),
      process: textAt(root, 'rsm:ExchangedDocumentContext/ram:BusinessProcessSpecifiedDocumentContextParameter/ram:ID'),
      reference: textsAt(root, `${HTA}/ram:BuyerReference`),
      seller: addressed('SellerTradeParty'),
      buyer: addressed('BuyerTradeParty'),
      contact: ['ram:PersonName', 'ram:TelephoneUniversalCommunication/ram:CompleteNumber', 'ram:EmailURIUniversalCommunication/ram:URIID'].map((at) =>
        textAt(root, `${contact}/${at}`),
      ),
      buyerName: textAt(root, `${HTA}/ram:BuyerTradeParty/ram:Name`),
    }).toEqual({
      guideline: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
      process: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
      reference: ['991-33333TEST-33'],
      seller: ['EM:rechnung@formancy-haustechnik.example'],
      buyer: ['0204:991-33333TEST-33'],
      contact: ['Erika Mustermann', '+49 221 4710 820', 'e.mustermann@formancy-haustechnik.example'],
      buyerName: 'Bundesamt für Beispielwesen',
    })
  })
})
