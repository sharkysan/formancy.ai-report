/**
 * The preview: the session's document resolved against the starter's data
 * by the runtime (0010), and drawn by the renderer's browser entry (0011) --
 * the same two calls a host makes, in the page, with nothing decided here.
 *
 * Every way it can end is an outcome, never an exception: printed, refused
 * by the runtime with its errors, or not drawn, with the renderer's refusal.
 * An exception from here is a fault, and the scheduler reports it as one.
 */
import { renderPdf } from '@formancy/report-render-pdf/browser'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { DataMode, ImageResolver, RefusalCode, RenderManifest, ReportDefinition, RuntimeError } from '@formancy/report-runtime'
import type { StudioStarter } from '../starters/codec.js'

/**
 * The most pages a preview may print. Chosen, not measured: the starters
 * print a few pages each, and the renderer lays a document out on the
 * page's own thread, so an edit that would print hundreds -- a table's rows
 * made tall -- is refused as `too-many-pages` rather than freezing the tab.
 */
export const PREVIEW_PAGE_LIMIT = 40

export interface PreviewRequest {
  readonly report: ReportDefinition
  readonly starter: StudioStarter
  /** `preview` shows what the data lacks with a warning; `final` refuses it (0010). */
  readonly mode: DataMode
  readonly images: ImageResolver
  /** The PDF's creation date: the caller's clock, read once per render. */
  readonly creationDate: string
}

export interface NotDrawn {
  readonly code: RefusalCode
  readonly message: string
  /** What the renderer names: an asset, a table's id, or a block's place in the document. */
  readonly subject: string | undefined
}

export type PreviewOutcome =
  | { readonly kind: 'printed'; readonly pdf: Uint8Array; readonly manifest: RenderManifest; readonly warnings: readonly RuntimeError[] }
  | { readonly kind: 'refused'; readonly errors: readonly RuntimeError[] }
  | { readonly kind: 'not-drawn'; readonly refusal: NotDrawn }

export async function preview(
  request: PreviewRequest,
  signal: AbortSignal,
  { maxPages = PREVIEW_PAGE_LIMIT }: { readonly maxPages?: number } = {},
): Promise<PreviewOutcome> {
  const { report, starter, mode, images, creationDate } = request
  const resolved = resolveReport(report, starter.data, { mode, parameters: starter.parameters, images, creationDate })
  if (!resolved.ok) return { kind: 'refused', errors: resolved.errors }
  try {
    const pdf = await renderPdf(resolved.document, { maxPages, signal })
    return { kind: 'printed', pdf, manifest: resolved.manifest, warnings: resolved.warnings }
  } catch (error) {
    if (!(error instanceof RenderRefusal)) throw error
    return { kind: 'not-drawn', refusal: { code: error.code, message: error.message, subject: error.subject } }
  }
}
