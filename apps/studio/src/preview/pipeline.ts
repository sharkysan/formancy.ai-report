/**
 * The preview: the session's document resolved against the starter's data
 * by the runtime (0010), and drawn by the renderer's browser entry (0011) --
 * the same two calls a host makes, in the page, with nothing decided here.
 *
 * Every way it can end is an outcome, never an exception: printed, refused
 * by the runtime with its errors, or not drawn, with the renderer's refusal.
 * An exception from here is a fault, and the scheduler reports it as one.
 *
 * A printed final render of an e-invoice hands on its XML as well, the one
 * the runtime wrote (0027, 0038), which a host takes from the same resolved
 * document: the Factur-X's, which the PDF embeds as it is, or the
 * XRechnung's, beside its copy (0065).
 *
 * And every printed render hands on the Word file of the document its PDF
 * was drawn from (0068), written by report-render-docx once the PDF is
 * there, or why there is none: the writer's refusal of what belongs to the
 * PDF. Nothing is written of a document the renderer did not draw, so the
 * page limit that bounds the PDF bounds what the writer is handed, on the
 * page's own thread.
 */
import { renderPdf } from '@formancy/report-render-pdf/browser'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { DataMode, ImageResolver, RefusalCode, RenderManifest, ReportDefinition, ResolvedDocument, RuntimeError } from '@formancy/report-runtime'
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
  /** The language it prints in: the one the builder shows, the report's own or one its translations declare (0063); the report's own when absent. */
  readonly locale?: string
}

export interface NotDrawn {
  readonly code: RefusalCode
  readonly message: string
  /** What the renderer names: an asset, a table's id, or a block's place in the document. */
  readonly subject: string | undefined
}

/**
 * The Word file of a printed render: written; refused by the writer, with
 * its reason; or not written for a fault of the writer's, which is the
 * Word file's alone and never the PDF's beside it.
 */
export type WordFile =
  | { readonly kind: 'written'; readonly docx: Uint8Array }
  | { readonly kind: 'refused'; readonly refusal: NotDrawn }
  | { readonly kind: 'failed'; readonly message: string }

export type PreviewOutcome =
  | {
      readonly kind: 'printed'
      readonly pdf: Uint8Array
      /** The e-invoice's XML the runtime wrote, as the resolved document holds it: a final render of an e-invoice's alone. */
      readonly xml: string | undefined
      /** The Word file of the document `pdf` was drawn from, or why there is none (0068). */
      readonly word: WordFile
      readonly manifest: RenderManifest
      readonly warnings: readonly RuntimeError[]
    }
  | { readonly kind: 'refused'; readonly errors: readonly RuntimeError[] }
  | { readonly kind: 'not-drawn'; readonly refusal: NotDrawn }

export async function preview(
  request: PreviewRequest,
  signal: AbortSignal,
  { maxPages = PREVIEW_PAGE_LIMIT }: { readonly maxPages?: number } = {},
): Promise<PreviewOutcome> {
  const { report, starter, mode, images, creationDate, locale } = request
  const resolved = resolveReport(report, starter.data, {
    mode,
    parameters: starter.parameters,
    images,
    creationDate,
    ...(locale === undefined ? {} : { locale }),
  })
  if (!resolved.ok) return { kind: 'refused', errors: resolved.errors }
  let pdf: Uint8Array
  try {
    pdf = await renderPdf(resolved.document, { maxPages, signal })
  } catch (error) {
    if (!(error instanceof RenderRefusal)) throw error
    return { kind: 'not-drawn', refusal: notDrawn(error) }
  }
  const { document, manifest, warnings } = resolved
  return { kind: 'printed', pdf, xml: document.eInvoice?.xml, word: await wordFile(document), manifest, warnings }
}

const notDrawn = (refusal: RenderRefusal): NotDrawn => ({ code: refusal.code, message: refusal.message, subject: refusal.subject })

/**
 * `document` as a Word file (0068), beside the PDF already drawn of it.
 * The writer is a chunk of its own, asked for with the first PDF that
 * printed. Whatever it throws that is no refusal, a chunk that did not
 * load among it, is a fault of the Word file's alone: thrown on, it would
 * be the preview's, and the PDF the renderer drew would never be shown.
 */
async function wordFile(document: ResolvedDocument): Promise<WordFile> {
  try {
    const { renderDocx } = await import('@formancy/report-render-docx')
    return { kind: 'written', docx: renderDocx(document) }
  } catch (error) {
    if (error instanceof RenderRefusal) return { kind: 'refused', refusal: notDrawn(error) }
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}
