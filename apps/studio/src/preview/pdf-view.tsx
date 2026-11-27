/**
 * The PDF the renderer wrote, shown by PDF.js on white paper: each page a
 * canvas with PDF.js's text layer over it, so the text can be selected,
 * copied and found with the browser's search; page navigation, zoom, and the
 * very bytes the pages were drawn from, to download, with the e-invoice's
 * XML the same render wrote, where it wrote one (0065), and its Word file,
 * or a note of why the writer wrote none (0068). The paper says it is
 * busy (`aria-busy`) until the newest PDF is drawn, which the browser gate
 * and the README pictures wait for.
 *
 * The paper is the document's, not the room's: white, drawn by PDF.js from
 * the PDF, and no rule of the Studio's reaches inside it (the stylesheets
 * exclude `.paper *`), so what is shown is what prints.
 *
 * It opens at fit width, at the top of the first page; a document that
 * carries a QR-bill opens with its slip in view, at the foot of its last
 * page (0090). That is the first PDF alone, and only while the person has
 * chosen no zoom: after it, nothing moves the paper but the person.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { formatZoom, PX_PER_PT, zoomedIn, zoomedOut } from '@formancy/report-builder-core'
import type { LoadedPdf, PdfLoading } from './pdf-document.js'
import type { WordFile } from './pipeline.js'
import { billScroll, billZoom, fitZoom, pageOf, slipHeight } from './view.js'

interface Size {
  readonly width: number
  readonly height: number
}

interface Loaded {
  readonly pdf: LoadedPdf
  readonly sizes: readonly Size[]
  /** The bytes PDF.js loaded: what the pages show, and so what Download PDF gives. */
  readonly from: Uint8Array
  /** The e-invoice's XML the render of `from` wrote, if it wrote one: what Download XML gives. */
  readonly xml: string | undefined
  /** The Word file the render of `from` wrote, or why it wrote none: what Download Word gives, or the note in its place says. */
  readonly word: WordFile
}

/** Which pages of `of` have been drawn at `zoom`: the paper is busy until every one has. */
interface Drawn {
  readonly of: Loaded | null
  readonly zoom: number
  readonly pages: ReadonlySet<number>
}

/** The name of the paper: the region the pages lie in, which scrolls, so the keyboard can stop on it. */
export const PAPER_NAME = 'PDF pages'

/** The media type Word registered for a .docx, which a browser saves the file as. */
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** The paper's width less its padding: the room a page is fitted to. */
const roomOf = (paper: HTMLElement): number => paper.clientWidth - 2 * parseFloat(getComputedStyle(paper).paddingInlineStart || '0')

/** The CSS pixels of the paper's padding below its last page. */
const paddingBelow = (paper: HTMLElement): number => parseFloat(getComputedStyle(paper).paddingBlockEnd || '0')

/** Why a render has no Word file, in the writer's own sentence where it refused the report; nothing where it wrote one. */
function noWordFile(word: WordFile): string | undefined {
  if (word.kind === 'written') return undefined
  return word.kind === 'refused' ? word.refusal.message : `the writer failed: ${word.message}`
}

/** A button that keeps focus when it has nothing to do, and says so, as the builder's tools do. */
function Tool({ label, onPress, unavailable, pressed }: { label: string; onPress: () => void; unavailable?: boolean; pressed?: boolean }): ReactElement {
  return (
    <button
      type="button"
      className="tool"
      aria-disabled={unavailable === true ? true : undefined}
      aria-pressed={pressed}
      onClick={() => (unavailable === true ? undefined : onPress())}
    >
      {label}
    </button>
  )
}

function Page({
  loaded,
  number,
  zoom,
  drawn,
}: {
  loaded: Loaded
  number: number
  zoom: number
  drawn: (of: Loaded, zoom: number, page: number) => void
}): ReactElement {
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

/** A download the viewer offers: the object URL of `content` while there is some, made once and let go of when it changes or the viewer goes. */
function useObjectUrl(content: BlobPart | undefined, type: string): string | undefined {
  const url = useMemo(() => (content === undefined ? undefined : URL.createObjectURL(new Blob([content], { type }))), [content, type])
  useEffect(() => () => (url === undefined ? undefined : URL.revokeObjectURL(url)), [url])
  return url
}

/**
 * `pdf` is drawn, and offered as `name`.pdf; `xml`, an e-invoice's XML
 * written by the same render, is offered beside it as `name`.xml; and
 * `word`, the Word file of the document `pdf` was drawn from, after them
 * as `name`.docx, or, where the writer wrote none, a note that says why.
 * `bill` says the document carries a QR-bill, which the paper opens at.
 */
export function PdfView({
  pdf,
  xml,
  word,
  name,
  stale,
  bill = false,
}: {
  pdf: Uint8Array
  xml?: string | undefined
  word: WordFile
  name: string
  stale: boolean
  bill?: boolean
}): ReactElement {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [room, setRoom] = useState(0)
  const [current, setCurrent] = useState(1)
  const [drawn, setDrawn] = useState<Drawn>({ of: null, zoom: 0, pages: new Set() })
  const paper = useRef<HTMLDivElement>(null)
  const note = useId()
  /** Whether the paper still opens as 0090 has it: until its first PDF is on it, or the person chooses a zoom before. */
  const opening = useRef(true)
  /** Set as the first PDF of a document with a QR-bill arrives: the paper opens at the slip once that PDF is laid out, and never again. */
  const toBill = useRef(false)
  const choose = (next: number | 'fit'): void => {
    opening.current = false
    setZoom(next)
  }
  /**
   * The PDF.js document on the paper, let go of only once a newer one is
   * there in its place, or the paper goes. Until then the paper redraws it
   * whenever its width changes -- a side pane hidden, a pane chosen on a
   * phone -- and a document let go of as soon as a newer PDF arrived threw
   * at that redraw, taking the whole Studio with it.
   */
  const onPaper = useRef<PdfLoading | null>(null)
  const pageDrawn = useCallback((of: Loaded, at: number, page: number): void => {
    setDrawn((now) => ({ of, zoom: at, pages: new Set([...(now.of === of && now.zoom === at ? now.pages : []), page]) }))
  }, [])

  useEffect(() => () => onPaper.current?.destroy(), [])

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
        const replaced = onPaper.current
        onPaper.current = loading ?? null
        toBill.current = opening.current && bill
        opening.current = false
        setLoaded({ pdf: document, sizes, from: pdf, xml, word })
        setFailed(null)
        setCurrent((page) => Math.min(page, sizes.length))
        // A draw of it still on its way rejects, and is not said to be drawn.
        replaced?.destroy()
      })
      .catch((error: unknown) => {
        if (live) setFailed(error instanceof Error ? error.message : String(error))
      })
    return () => {
      live = false
      // One still loading is let go of; the one on the paper stays there until another replaces it.
      if (loading !== onPaper.current) loading?.destroy()
    }
  }, [pdf, xml, word, bill])

  // The paper's width, for Fit width: measured once laid out, and again
  // whenever the pane changes size.
  useLayoutEffect(() => {
    const element = paper.current
    if (element === null) return undefined
    const measure = (): void => setRoom(roomOf(element))
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The bytes the pages on the paper were drawn from, not the newest the
  // renderer delivered: between the two, Download PDF gave a PDF the
  // preview did not show yet. The XML is the one that render wrote, for the
  // same reason, as UTF-8, the encoding its declaration names and a
  // Factur-X PDF embeds it in; and the Word file the one written of the
  // document those pages were drawn from, or that render's reason for none.
  const from = loaded?.from
  const url = useObjectUrl(
    useMemo(() => from?.slice().buffer, [from]),
    'application/pdf',
  )
  const xmlUrl = useObjectUrl(loaded?.xml, 'application/xml')
  const docx = loaded?.word.kind === 'written' ? loaded.word.docx : undefined
  const wordUrl = useObjectUrl(
    useMemo(() => docx?.slice().buffer, [docx]),
    DOCX,
  )
  const noWord = loaded === null ? undefined : noWordFile(loaded.word)

  const pages = loaded?.sizes.length ?? 0
  const widest = Math.max(0, ...(loaded?.sizes.map((size) => size.width) ?? []))
  const shown = zoom === 'fit' ? fitZoom(room, widest) : zoom
  // Busy from the moment a newer render is on its way until PDF.js has the
  // newest PDF and has drawn every page of it at the zoom shown: what is on
  // the paper is, until then, an earlier document, or none.
  const settled = loaded !== null && loaded.from === pdf && drawn.of === loaded && drawn.zoom === shown && drawn.pages.size === pages
  const busy = stale || !settled

  // The first PDF of a document with a QR-bill opens at the slip (0090),
  // decided once that PDF is laid out, its downloads among the tools --
  // which wrap a narrow pane's tools onto a second row and take the
  // paper's height. Where the slip is taller than what the paper shows at
  // fit width, the zoom it fits at is set and the decision made again at
  // it; then the paper is scrolled to the slip. All of it before the
  // browser paints, at once and not smoothly: nothing moves on the screen,
  // and no motion is made. A paper with no height is out of sight, and
  // opens as any other.
  //
  // Fit width was measured on the empty paper. Where scrollbars take room,
  // as Chrome's do on Windows, the pages just laid out give it a vertical
  // one, which narrows it under pages fitted to the width before; those
  // overflow it sideways, and the horizontal scrollbar that adds takes the
  // height the slip is fitted to. The observer fits the width again only
  // after this effect, too late for a decision made once: so the width is
  // measured here first and, where it is narrower, fitted again before the
  // decision. Only narrower, so that a scrollbar that comes and goes with
  // the fit cannot loop.
  useLayoutEffect(() => {
    const element = paper.current
    if (!toBill.current || loaded === null || element === null) return
    if (element.clientHeight > 0) {
      const width = roomOf(element)
      if (width < room) {
        setRoom(width)
        return
      }
      const at = billZoom(shown, element.clientHeight - paddingBelow(element))
      if (at !== shown) {
        setZoom(at)
        return
      }
      element.scrollTop = billScroll(element, paddingBelow(element), slipHeight(shown))
    }
    toBill.current = false
  }, [loaded, shown, room])

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
          <Tool label="Zoom out" unavailable={zoomedOut(shown) === shown} onPress={() => choose(zoomedOut(shown))} />
          <span className="tool-value">{formatZoom(shown, 'en')}</span>
          <Tool label="Zoom in" unavailable={zoomedIn(shown) === shown} onPress={() => choose(zoomedIn(shown))} />
          <Tool label="Fit width" pressed={zoom === 'fit'} onPress={() => choose('fit')} />
        </div>
        {url === undefined ? null : (
          <a className="tool download" href={url} download={`${name}.pdf`}>
            Download PDF
          </a>
        )}
        {url === undefined || xmlUrl === undefined ? null : (
          <a className="tool" href={xmlUrl} download={`${name}.xml`}>
            Download XML
          </a>
        )}
        {url === undefined || wordUrl === undefined ? null : (
          <a className="tool" href={wordUrl} download={`${name}.docx`}>
            Download Word
          </a>
        )}
        {/* Named by its own words: a note takes no name from what it holds,
            and a test, the gate and a screen reader's list find it by one. */}
        {noWord === undefined ? null : (
          <p role="note" id={note} aria-labelledby={note} className="word-note">
            No Word file: {noWord}
          </p>
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
