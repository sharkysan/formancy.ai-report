import { editorText } from '@formancy/report-builder-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { encodeStarters, decodeStarters } from './codec.js'
import { BLANK, starterLabel, studioStarters } from './starters.js'

const decoded = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))

describe("the Studio's starters", () => {
  // The picker offers the corpus's starters in the corpus's order, then a
  // blank report. A list written out here would keep offering a starter the
  // corpus dropped, or never offer one it added; the names are derived for
  // the same reason, from the id, or from the e-invoice's kind (below).
  test('are the corpus’s, in its order, and a blank report last', () => {
    const listed = studioStarters(decoded.starters)
    expect(listed.map((starter) => starter.id)).toEqual([...STARTERS.map((starter) => starter.id), 'blank'])
    expect(listed.map(starterLabel)).toEqual([
      'Service inspection',
      'Quotation',
      'Grouped equipment',
      'Invoice',
      'Euro invoice',
      'E-invoice (Factur-X)',
      'E-invoice (XRechnung)',
      'Site visit',
      'Order confirmation',
      'Product data sheet',
      'Blank',
    ])
  })

  // The two e-invoices are one template's terms in two kinds (0065): each is
  // called what the builder calls the part, and the kind its heading names
  // ("Factur-X: E-invoice"), so the picker says which kind each is and that
  // they are a pair. Named from their ids they read "E-invoice" and
  // "E-invoice xrechnung", the one saying no kind and the other misspelling
  // its own; and two starters of one name could not be told apart.
  test('call an e-invoice by its kind, the builder’s word for it, and no two alike', () => {
    const words = editorText('en')
    const listed = studioStarters(decoded.starters)
    const invoices = listed.flatMap((starter) => (starter.report.eInvoice === undefined ? [] : [[starter.report.eInvoice.kind, starterLabel(starter)]]))
    expect(invoices).toEqual([
      ['facturX', `${words('outline.eInvoice')} (${words('kind.facturX')})`],
      ['xrechnung', `${words('outline.eInvoice')} (${words('kind.xrechnung')})`],
    ])
    expect(new Set(listed.map(starterLabel)).size).toBe(listed.length)
  })

  // A blank report with no datasets still previews: an empty A4 page, not a
  // refusal for data it never asked for, which would greet the person who
  // picked Blank with an error.
  test('include a blank report that resolves against its data', () => {
    const resolved = resolveReport(BLANK.report, BLANK.data, { mode: 'final', parameters: BLANK.parameters, creationDate: '2026-10-16T08:00:00Z' })
    expect(resolved.ok).toBe(true)
  })
})
