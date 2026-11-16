import type { ResolvedDocument } from '@formancy/report-runtime'
import { engine } from './browser-engine.js'
import type { RenderOptions } from './options.js'
import { render } from './render.js'

export { REFUSAL_CODES, RenderRefusal } from '@formancy/report-runtime'
export type { RefusalCode, ResolvedDocument } from '@formancy/report-runtime'
export type { RenderOptions } from './options.js'

/**
 * The renderer in a browser: pdfmake's browser build, its fonts virtual
 * files and every address denied, Liberation Sans a chunk of its own that
 * only a document with a bill or a captioned code loads -- the engine,
 * `browser-engine.ts`'s -- behind the same renderer as the Node entry
 * (`render.ts`).
 */

/**
 * Renders `document` to a PDF in a browser, or rejects with a
 * `RenderRefusal` saying why it was not printed, exactly as the Node entry
 * does: the same refusals, the same pages.
 */
export function renderPdf(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  return render(engine, document, options)
}
