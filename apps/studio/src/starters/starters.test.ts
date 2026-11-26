import { editorText } from '@formancy/report-builder-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { encodeStarters, decodeStarters } from './codec.js'
import { BLANK, OPENS_ON, starterLabel, studioStarters } from './starters.js'

const decoded = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))

describe("the Studio's starters", () => {
  // The picker offers the invoice first, the starter the Studio opens on
  // (0082), then the corpus's others in the corpus's order, then a blank
  // report. A list written out here would keep offering a starter the
  // corpus dropped, or never offer one it added; the names are derived for
  // the same reason, from the id, or from the e-invoice's kind (below). The
  // corpus's own order, plan 7's, is the corpus's test's to hold: a Studio
  // that reordered the corpus instead would reorder every sample, table and
  // page that reads it.
  test('are the invoice first, then the corpus’s others in its order, and a blank report last', () => {
    const listed = studioStarters(decoded.starters)
    expect(listed.map((starter) => starter.id)).toEqual(['invoice', ...STARTERS.map((starter) => starter.id).filter((id) => id !== 'invoice'), 'blank'])
    expect(listed.map(starterLabel)).toEqual([
      'Invoice',
      'Service inspection',
      'Quotation',
      'Grouped equipment',
      'Euro invoice',
      'E-invoice (Factur-X)',
      'E-invoice (XRechnung)',
      'Site visit',
      'Order confirmation',
      'Product data sheet',
      'Payment reminder',
      'Sales report',
      'Blank',
    ])
  })

  // The Studio opens on the starter its id names, and lists it first: a
  // corpus that dropped it, or renamed its id, would otherwise open the
  // Studio on whichever starter came first -- the service inspection, the
  // stress test 0082 moved the first look away from -- with nothing
  // failing. Refused by its id, the page draws nothing, and every suite
  // that lists the starters fails.
  test('refuse a corpus that holds no starter of the id the Studio opens on', () => {
    const without = decoded.starters.filter((starter) => starter.id !== OPENS_ON)
    expect(without).toHaveLength(decoded.starters.length - 1)
    expect(() => studioStarters(without)).toThrow(`the Studio opens on the starter "${OPENS_ON}", and the corpus holds none of that id`)
  })

  // The two e-invoices are one template in both kinds, each billing its own
  // buyer (0065): each is called what the builder calls the part, and the
  // kind its heading names ("Factur-X: E-invoice"), so the picker says
  // which kind each is and that the two are one template's. Named from their ids they read "E-invoice" and
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
