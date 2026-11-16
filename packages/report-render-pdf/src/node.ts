import type { ResolvedDocument } from '@formancy/report-runtime'
import { engine } from './node-engine.js'
import type { RenderOptions } from './options.js'
import { render } from './render.js'

/**
 * Renders `document` to a PDF, or rejects with a `RenderRefusal` saying why
 * it was not printed: `too-many-pages`, `content-too-large`,
 * `invalid-asset`, `cancelled` or `unsupported`. A refused render returns
 * nothing, never a truncated or partial PDF. The same document renders to
 * the same bytes.
 */
export function renderPdf(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  return render(engine, document, options)
}
