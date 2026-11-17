import type { ResolvedDocument } from '@formancy/report-runtime'
import { checkDocument } from './check.js'
import { planFonts } from './fonts.js'
import { writePackage } from './package.js'

/**
 * A resolved document as a Word file (0068): its bytes, or the runtime's
 * `RenderRefusal` and nothing. The same document gives the same bytes.
 *
 * It says what the document says -- every word, every cell, every
 * picture's bytes, the page and its regions -- and leaves lines, pages
 * and their count to Word. It refuses, whole, what belongs to the
 * report's PDF, what nobody has seen Word print as the PDF does, what no
 * engine prints, and what is past its bounds (`check.ts`): a file is
 * never written without something the report prints.
 *
 * Synchronous, with no option and no signal: the writer counts no page,
 * so there is no page limit to pass, and a file at its bound is written
 * in one step that nothing interrupts. A host that must stop one runs it
 * in a worker.
 */
export function renderDocx(document: ResolvedDocument): Uint8Array {
  // The fonts first, as the PDF renderer reads them: a face that is no font is refused before anything is walked.
  const fonts = planFonts(document.fonts)
  return writePackage(document, checkDocument(document, fonts), fonts)
}
