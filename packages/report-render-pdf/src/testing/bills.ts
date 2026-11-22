import type { Block, QrBill, ResolvedDocument } from '@formancy/report-runtime'
import { bareDocument, documentOf } from './documents.js'

/**
 * QR-bills for the renderer's tests: the corpus's, which the Word writer's
 * tests draw too (0075), resolved by the runtime from a report that
 * carries one, under the names these tests read them by. `SIX_EXAMPLES`
 * are SIX's examples (IG Annex A, Tables 17 to 22), but example 4, whose
 * creditor reference has wrong check digits; `GERMAN` is example 2 in
 * German, whose headings hold umlauts: "Währung", "Zusätzliche
 * Informationen".
 */
export { BILL_EXAMPLES as SIX_EXAMPLES, GERMAN_BILL as GERMAN, resolvedBill } from '@formancy/report-corpus'

/** The corpus's page with its page header and footer, `body`, and `bill` at the foot of its last page. */
export function billDocument(bill: QrBill, body: readonly Block[] = []): ResolvedDocument {
  return { ...documentOf('Invoice', body), paymentPart: bill }
}

/** The same without page regions, so that every run on a page is the body's or the slip's. */
export function bareBillDocument(bill: QrBill, body: readonly Block[] = []): ResolvedDocument {
  return { ...bareDocument('Invoice', body), paymentPart: bill }
}
