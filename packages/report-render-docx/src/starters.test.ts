import { STARTERS, verifyDocx, wordRefusal } from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { fixtureOf, refusalOf, resolved, written } from './testing/support.js'

/**
 * Every starter, end to end (0068): its definition resolved by the
 * runtime against its synthetic data, in each language it declares, as a
 * final render and as a preview, and its Word file written and proved on
 * the file -- or refused, by the code and the subject this suite names
 * for it. The table below is record 0068's, starter by starter, as record
 * 0074 changed it for the euro invoice and 0076 for the sales report: a
 * starter
 * that is written where the record says refused, or the other way round,
 * fails here, and so does one the table does not name.
 */

interface Refused {
  readonly code: 'unsupported'
  readonly subject: string
}

/** What a starter's Word file is: written, or refused -- a final render and a preview for the same thing, or each for its own. */
type Outcome = 'written' | { readonly final: Refused; readonly preview: Refused }

const refused = (subject: string): Refused => ({ code: 'unsupported', subject })
const both = (subject: string): Outcome => ({ final: refused(subject), preview: refused(subject) })

const STARTER_FILES: Readonly<Record<string, Outcome>> = {
  'service-inspection': 'written',
  quotation: 'written',
  'grouped-equipment': 'written',
  'site-visit': 'written',
  'order-confirmation': 'written',
  'product-data-sheet': 'written',
  // Paid by an EPC QR code, which the writer draws since 0074: what refuses one is decided below both engines.
  'euro-invoice': 'written',
  // Paid by a QR-bill, whose slip belongs to the last page of its PDF.
  invoice: both('paymentPart'),
  'payment-reminder': both('paymentPart'),
  // An invoice in law: its final render is its PDF/A-3b or the copy of its XML, and its preview is labelled as not the invoice, a label a Word file would hold as a paragraph.
  'e-invoice': { final: refused('eInvoice'), preview: refused('pageHeader') },
  'e-invoice-xrechnung': { final: refused('eInvoice'), preview: refused('pageHeader') },
  // Draws a bar chart and a pie, each Word's own chart since 0076, written from the runtime's block with no ECharts.
  'sales-report': 'written',
}

// A starter added to the corpus is read before it is said to export: one paid by a QR-bill is refused, and must say so here.
test('every starter is named as written or as refused, and no other', () => {
  expect(STARTERS.map((starter) => starter.id).sort()).toEqual(Object.keys(STARTER_FILES).sort())
})

describe.each(STARTERS.map((starter) => [starter.id, starter] as const))('%s', (id, starter) => {
  const outcome = STARTER_FILES[id]
  const locales = [starter.report.locale, ...(starter.report.translations ?? []).map((each) => each.locale)]
  const renders = locales.flatMap((locale) => (['final', 'preview'] as const).map((mode) => [locale, mode] as const))

  test.each(renders)('in %s, as a %s render', async (locale, mode) => {
    const document = resolved(starter, { mode, locale })
    if (outcome === undefined || outcome === 'written') {
      // Every word, cell, mark, picture and code the report prints, on the file; and nothing the corpus says a Word file may not hold.
      expect(wordRefusal(document)).toBeUndefined()
      expect(await verifyDocx(fixtureOf(id, document), written(document))).toEqual([])
    } else {
      // Refused whole, for the first thing a Word file cannot hold, as the corpus derives it from the document too.
      expect(refusalOf(document)).toMatchObject(outcome[mode])
      expect(wordRefusal(document)).toEqual(outcome[mode])
    }
  })
})

// A refusal a person reads says what to do: each sentence names what stopped the file, and none quotes the report's words.
test("a refused starter's sentence says what it is about and what to do", () => {
  const sentences = STARTERS.flatMap((starter) => {
    const outcome = STARTER_FILES[starter.id]
    return outcome === undefined || outcome === 'written' ? [] : (['final', 'preview'] as const).map((mode) => refusalOf(resolved(starter, { mode })).message)
  })
  expect(sentences.length).toBeGreaterThan(0)
  for (const sentence of sentences) expect(sentence).toMatch(/print (the report|the preview) as a PDF/)
})
