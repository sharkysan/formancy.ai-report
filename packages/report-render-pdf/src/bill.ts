import { checkQrBill, refuseBillPage, type CheckedBill, type PageSetup, type QrBill } from '@formancy/report-runtime'
import { codePoint, missingGlyph, type BillGlyphs } from './glyphs.js'

/**
 * A QR-bill's payment part held to what the renderer draws, before
 * anything is laid out, and its Swiss QR Code, encoded once.
 *
 * What refuses a bill is the runtime's, decided once below every engine
 * (`checkQrBill`, 0075): the kind, the page, text that is not text, an
 * amount or currency SIX does not print, the number of lines, the longest
 * value and the code's size, each in words the Word writer refuses it in
 * too. What is the renderer's own is what only it knows: the glyphs of
 * the Liberation Sans it embeds, which every text the slip prints is held
 * to here, in the face it prints in.
 */

export type { CheckedBill }

/** Refuses `page` for a slip, with `above` printed under its top margin: the runtime's rule, which is report-spec's. */
export const refusePage: (page: PageSetup, above?: number) => void = refuseBillPage

/** Refuses what the renderer cannot draw of `bill` on `page`, the top margin alone before the header is measured, and encodes its code. */
export function checkBill(bill: QrBill, page: PageSetup, glyphs: BillGlyphs): CheckedBill {
  return checkQrBill(bill, page, (text, face) => {
    const missing = missingGlyph(text, glyphs[face])
    return missing === undefined ? undefined : `prints ${codePoint(missing)}, which Liberation Sans has no glyph for: it would print as an empty box`
  })
}
