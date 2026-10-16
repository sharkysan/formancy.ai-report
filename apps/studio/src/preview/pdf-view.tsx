/**
 * The PDF the renderer wrote, shown by PDF.js on white paper: each page a
 * canvas with PDF.js's text layer over it, so the text can be selected,
 * copied and found with the browser's search; page navigation, zoom, and the
 * very bytes the pages were drawn from, to download. The paper says it is
 * busy (`aria-busy`) until the newest PDF is drawn, which the browser gate
 * and the README pictures wait for.
 *
 * The paper is the document's, not the room's: white, drawn by PDF.js from
 * the PDF, and no rule of the Studio's reaches inside it (the stylesheets
 * exclude `.paper *`), so what is shown is what prints.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { formatZoom, PX_PER_PT, zoomedIn, zoomedOut } from '@formancy/report-builder-core'
import type { LoadedPdf, PdfLoading } from './pdf-document.js'
import { fitZoom, pageOf } from './view.js'

interface Size {
  readonly width: number
  readonly height: number
}

interface Loaded {
  readonly pdf: LoadedPdf
  readonly sizes: readonly Size[]
  /** The bytes PDF.js loaded: what the pages show, and so what Download PDF gives. */
  readonly from: Uint8Array
}

/** Which pages of `of` have been drawn at `zoom`: the paper is busy until every one has. */
interface Drawn {
  readonly of: Loaded | null
  readonly zoom: number
  readonly pages: ReadonlySet<number>
}

/** The name of the paper: the region the pages lie in, which scrolls, so the keyboard can stop on it. */
export const PAPER_NAME = 'PDF pages'

/** A button that keeps focus when it has nothing to do, and says so, as the builder's tools do. */
function Tool({ label, onPress, unavailable, pressed }: { label: string; onPress: () => void; unavailable?: boolean; pressed?: boolean }): ReactElement {
  return (
    <button type="button" className="tool" aria-disabled={unavailable === true ? true : undefined} aria-pressed={pressed} onClick={() => (unavailable === true ? undefined : onPress())}>
      {label}
    </button>
  )
}

function Page({ loaded, number, zoom, drawn }: { loaded: Loaded; number: number; zoom: number; drawn: (of: Loaded, zoom: number, page: number) => void }): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const size = loaded.sizes[number - 1] ?? { width: 0, height: 0 }
  useEffect(() => {
    if (canvas.current === null || text.current === null) return undefined
    let live = true
    const drawing = loaded.pdf.drawPage(number, zoom, canvas.current, text.current)
    // A draw that is cancelled rejects, or ends having drawn nothing; that is
    // the point of cancelling it, and it is not said to be drawn.
    drawing.done.then(
      () => (live ? drawn(loaded, zoom, number) : undefined),
      () => undefined,
    )
    return () => {
      live = false
      drawing.cancel()
    }
  }, [loaded, number, zoom, drawn])
  const scale = zoom * PX_PER_PT
  const style = {
    width: `${String(Math.floor(size.width * scale))}px`,
    height: `${String(Math.floor(size.height * scale))}px`,
    '--total-scale-factor': String(scale),
    '--scale-round-x': '1px',
    '--scale-round-y': '1px',
  } as CSSProperties
  return (
    <div className="paper-page" role="group" aria-label={pageOf(number, loaded.sizes.length)} data-page={number} style={style}>
      <canvas ref={canvas} aria-hidden="true" />
      <div ref={text} className="paper-text" />
    </div>
  )
}

export function PdfView({ pdf, fileName, stale }: { pdf: Uint8Array; fileName: string; stale: boolean }): ReactElement {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [room, setRoom] = useState(0)
  const [current, setCurrent] = useState(1)
  const [drawn, setDrawn] = useState<Drawn>({ of: null, zoom: 0, pages: new Set() })
  const paper = useRef<HTMLDivElement>(null)
  const pageDrawn = useCallback((of: Loaded, at: number, page: number): void => {
    setDrawn((now) => ({ of, zoom: at, pages: new Set([...(now.of === of && now.zoom === at ? now.pages : []), page]) }))
  }, [])

  // PDF.js loads with the first PDF, not with the page.
  useEffect(() => {
    let live = true
    let loading: PdfLoading | undefined
    import('./pdf-document.js')
      .then(({ loadPdf }) => {
        if (!live) return undefined
        loading = loadPdf(pdf)
        return loading.promise
      })
      .then(async (document) => {
        if (document === undefined) return
        const sizes = await Promise.all(Array.from({ length: document.pageCount }, (_, index) => document.pageSize(index + 1)))
        if (!live) return
        setLoaded({ pdf: document, sizes, from: pdf })
        setFailed(null)
        setCurrent((page) => Math.min(page, sizes.length))
      })
      .catch((error: unknown) => {
        if (live) setFailed(error instanceof Error ? error.message : String(error))
      })
    return () => {
      live = false
      loading?.destroy()
    }
  }, [pdf])

  // The paper's width, for Fit width: measured once laid out, and again
  // whenever the pane changes size.
  useLayoutEffect(() => {
    const element = paper.current
    if (element === null) return undefined
    const measure = (): void => setRoom(element.clientWidth - 2 * parseFloat(getComputedStyle(element).paddingInlineStart || '0'))
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The bytes the pages on the paper were drawn from, not the newest the
  // renderer delivered: between the two, Download PDF gave a PDF the
  // preview did not show yet.
  const from = loaded?.from
  const url = useMemo(() => (from === undefined ? undefined : URL.createObjectURL(new Blob([from.slice().buffer], { type: 'application/pdf' }))), [from])
  useEffect(() => () => (url === undefined ? undefined : URL.revokeObjectURL(url)), [url])

  const pages = loaded?.sizes.length ?? 0
  const widest = Math.max(0, ...(loaded?.sizes.map((size) => size.width) ?? []))
  const shown = zoom === 'fit' ? fitZoom(room, widest) : zoom
  // Busy from the moment a newer render is on its way until PDF.js has the
  // newest PDF and has drawn every page of it at the zoom shown: what is on
  // the paper is, until then, an earlier document, or none.
  const settled = loaded !== null && loaded.from === pdf && drawn.of === loaded && drawn.zoom === shown && drawn.pages.size === pages
  const busy = stale || !settled

  // Which page is "current" follows the scrolling too: the page most in view,
  // so Next page after scrolling goes on from what the person is reading.
  useEffect(() => {
    const element = paper.current
    if (element === null || loaded === null || typeof IntersectionObserver === 'undefined') return undefined
    const seen = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(Number((entry.target as HTMLElement).dataset['page']), entry.intersectionRatio)
        const [page, ratio] = [...seen].reduce((best, each) => (each[1] > best[1] ? each : best), [1, 0])
        if (ratio > 0) setCurrent(page)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    for (const page of element.querySelectorAll('[data-page]')) observer.observe(page)
    return () => observer.disconnect()
  }, [loaded, shown])

  function go(page: number): void {
    setCurrent(page)
    paper.current?.querySelector(`[data-page="${String(page)}"]`)?.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="viewer" data-stale={stale}>
      <div className="viewer-tools">
        <div role="group" aria-label="Pages" className="tool-group">
          <Tool label="Previous page" unavailable={current <= 1} onPress={() => go(current - 1)} />
          <span className="tool-value">{pages === 0 ? '' : pageOf(current, pages)}</span>
          <Tool label="Next page" unavailable={current >= pages} onPress={() => go(current + 1)} />
        </div>
        <div role="group" aria-label="Zoom" className="tool-group">
          <Tool label="Zoom out" unavailable={zoomedOut(shown) === shown} onPress={() => setZoom(zoomedOut(shown))} />
          <span className="tool-value">{formatZoom(shown, 'en')}</span>
          <Tool label="Zoom in" unavailable={zoomedIn(shown) === shown} onPress={() => setZoom(zoomedIn(shown))} />
          <Tool label="Fit width" pressed={zoom === 'fit'} onPress={() => setZoom('fit')} />
        </div>
        {url === undefined ? null : (
          <a className="tool download" href={url} download={fileName}>
            Download PDF
          </a>
        )}
      </div>
      {failed === null ? null : (
        <p role="alert" className="problem-box">
          PDF.js could not show this PDF: {failed}
        </p>
      )}
      {/* A region, and a tab stop: the pages scroll inside it, and a
          keyboard scrolls what it can stop on (axe's scrollable-region-focusable). */}
      <div ref={paper} className="paper" role="region" aria-label={PAPER_NAME} tabIndex={0} aria-busy={busy}>
        {loaded === null ? null : loaded.sizes.map((_, index) => <Page key={index} loaded={loaded} number={index + 1} zoom={shown} drawn={pageDrawn} />)}
      </div>
    </div>
  )
}
