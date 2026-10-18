/**
 * PDF.js, as the preview uses it: the one module that imports `pdfjs-dist`.
 *
 * PDF.js stays inside this private app: `pdfjs-dist` ships Liberation Sans
 * under GPL-2.0 with a font exception, which 0006 refuses in a published
 * package's closure (plan 23.4). The Studio loads none of PDF.js's standard
 * fonts -- the renderer embeds Roboto in every PDF it writes -- so none is
 * bundled.
 *
 * The worker is PDF.js's own prebuilt file, which Vite copies beside the
 * bundle and names by URL (`?url`), rather than a worker Vite bundles, whose
 * code the notices plugin could not see (formancy.ai-data 0046). This is
 * the modern build: it uses `Map.prototype.getOrInsertComputed`, which a
 * browser older than that method lacks, and there the preview says it
 * failed.
 */
import { GlobalWorkerOptions, getDocument, TextLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PX_PER_PT } from '@formancy/report-builder-core'

GlobalWorkerOptions.workerSrc = worker

export interface LoadedPdf {
  readonly pageCount: number
  /** Each page's size in points, from 1. */
  pageSize(number: number): Promise<{ readonly width: number; readonly height: number }>
  /** Draws page `number` at `zoom` -- 1 is the paper's size on screen -- into `canvas`, and its text into `text`. */
  drawPage(number: number, zoom: number, canvas: HTMLCanvasElement, text: HTMLElement): { readonly done: Promise<void>; cancel(): void }
}

export interface PdfLoading {
  readonly promise: Promise<LoadedPdf>
  /** Stops loading, or lets go of the loaded document and its worker. */
  destroy(): void
}

/**
 * Loads `bytes`. PDF.js hands its data to the worker and detaches it, so a
 * copy is loaded: the bytes the person downloads stay whole.
 */
export function loadPdf(bytes: Uint8Array): PdfLoading {
  const task = getDocument({ data: bytes.slice() })
  return {
    promise: task.promise.then(loaded),
    destroy: () => {
      void task.destroy()
    },
  }
}

function loaded(document: PDFDocumentProxy): LoadedPdf {
  return {
    pageCount: document.numPages,
    async pageSize(number) {
      const [left = 0, bottom = 0, right = 0, top = 0] = (await document.getPage(number)).view
      return { width: right - left, height: top - bottom }
    },
    drawPage(number, zoom, canvas, text) {
      let cancelled = false
      let task: RenderTask | undefined
      let layer: TextLayer | undefined
      // An async function, so that PDF.js's getPage on a document already let
      // go of -- which throws at once rather than rejecting -- is a draw that
      // did not happen, not a throw in the caller's render.
      const done = (async () => {
        const page = await document.getPage(number)
        if (cancelled) return
        task = paint(page, zoom, canvas)
        text.replaceChildren()
        layer = new TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: page.getViewport({ scale: zoom * PX_PER_PT }) })
        await Promise.all([task.promise, layer.render()])
      })()
      return {
        done,
        cancel() {
          cancelled = true
          task?.cancel()
          layer?.cancel()
        },
      }
    },
  }
}

/**
 * The page drawn at the screen's resolution: the canvas has a pixel per
 * device pixel, and is laid out at the page's size in CSS pixels.
 */
function paint(page: PDFPageProxy, zoom: number, canvas: HTMLCanvasElement): RenderTask {
  const viewport = page.getViewport({ scale: zoom * PX_PER_PT })
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * ratio)
  canvas.height = Math.floor(viewport.height * ratio)
  canvas.style.width = `${String(Math.floor(viewport.width))}px`
  canvas.style.height = `${String(Math.floor(viewport.height))}px`
  return page.render({ canvas, viewport, ...(ratio === 1 ? {} : { transform: [ratio, 0, 0, ratio, 0, 0] }) })
}
