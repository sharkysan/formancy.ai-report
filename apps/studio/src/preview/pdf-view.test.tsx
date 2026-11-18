import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { PAPER_NAME, PdfView } from './pdf-view.js'
import type { WordFile } from './pipeline.js'

/**
 * The viewer's controls, in jsdom, over a PDF.js stand-in: jsdom has no
 * canvas for PDF.js to draw on, so what is held here is what the viewer
 * asks PDF.js for and what it offers the person. Drawing and the text layer
 * are the browser gate's.
 */

/**
 * What the stand-in was asked to draw, by which document -- each load is
 * one, numbered from 1 -- the documents let go of, and the load it is
 * holding back, if any.
 */
const pdfjs = vi.hoisted(() => ({
  drawn: [] as { readonly page: number; readonly zoom: number; readonly document: number }[],
  loads: 0,
  destroyed: [] as number[],
  held: null as Promise<void> | null,
}))

vi.mock('./pdf-document.js', () => ({
  loadPdf: () => {
    pdfjs.loads += 1
    const document = pdfjs.loads
    return {
      promise: (pdfjs.held ?? Promise.resolve()).then(() => ({
        pageCount: 3,
        pageSize: () => Promise.resolve({ width: 595.28, height: 841.89 }),
        drawPage: (page: number, zoom: number) => {
          // As PDF.js's own getPage does, asked of a document let go of: at once, not by rejecting.
          if (pdfjs.destroyed.includes(document)) throw new TypeError("Cannot read properties of null (reading 'sendWithPromise')")
          pdfjs.drawn.push({ page, zoom, document })
          return { done: Promise.resolve(), cancel: () => undefined }
        },
      })),
      destroy: () => {
        pdfjs.destroyed.push(document)
      },
    }
  },
}))

/** Each object URL the viewer made, and the bytes behind it. */
const blobs = new Map<string, Blob>()

beforeAll(() => {
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:viewer-test-${String(blobs.size + 1)}`
    blobs.set(url, blob)
    return url
  }
  URL.revokeObjectURL = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

afterEach(() => {
  cleanup()
  pdfjs.drawn.length = 0
  pdfjs.loads = 0
  pdfjs.destroyed.length = 0
  pdfjs.held = null
})

const PDF = new Uint8Array([37, 80, 68, 70])
const NEWER = new Uint8Array([37, 80, 68, 70, 45, 50])

/** The bytes Download PDF gives. */
async function downloaded(): Promise<number[]> {
  const href = screen.getByRole('link', { name: 'Download PDF' }).getAttribute('href') ?? ''
  return [...new Uint8Array(await (blobs.get(href) as Blob).arrayBuffer())]
}

/** A render's Word file, as the pipeline hands one on: a zip by its first bytes, and one of a later render. */
const WORD: WordFile = { kind: 'written', docx: new Uint8Array([80, 75, 3, 4]) }
const NEWER_WORD: WordFile = { kind: 'written', docx: new Uint8Array([80, 75, 3, 4, 20, 0]) }
/** What the writer says of an e-invoice in place of a file, as the pipeline hands its refusal on. */
const SENTENCE = 'the report is an e-invoice, which is the PDF/A-3b that embeds its XML; a Word file is no invoice: print the report as a PDF'
const REFUSED: WordFile = { kind: 'refused', refusal: { code: 'unsupported', message: SENTENCE, subject: 'eInvoice' } }

/** What Download Word gives: its type and its bytes. */
async function downloadedWord(): Promise<{ readonly type: string; readonly bytes: number[] }> {
  const blob = blobs.get(screen.getByRole('link', { name: 'Download Word' }).getAttribute('href') ?? '') as Blob
  return { type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] }
}

/** An e-invoice's XML as the runtime writes one, with its declaration, and one of a later render. */
const XML = '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice>Köln</rsm:CrossIndustryInvoice>\n'
const NEWER_XML = XML.replace('Köln', 'Bonn')

/** What Download XML gives: its type, and its bytes read as UTF-8. */
async function downloadedXml(): Promise<{ readonly type: string; readonly text: string }> {
  const blob = blobs.get(screen.getByRole('link', { name: 'Download XML' }).getAttribute('href') ?? '') as Blob
  return { type: blob.type, text: new TextDecoder().decode(await blob.arrayBuffer()) }
}

describe('the PDF viewer', () => {
  // Each page is a group named by its number, so a screen reader can move
  // page by page; every page is drawn, at the zoom shown.
  test('shows every page, named by its number, each drawn', async () => {
    render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    for (const name of ['Page 1 of 3', 'Page 2 of 3', 'Page 3 of 3']) await screen.findByRole('group', { name })
    await waitFor(() => expect(pdfjs.drawn.map((each) => each.page).sort()).toEqual([1, 2, 3]))
  })

  // Next page on the last page, and Previous on the first, have nothing to
  // do: they say so and keep focus, so a keyboard pressing Enter on them
  // stays where it is rather than being dropped on the page.
  test('moves page by page, and keeps focus at either end', async () => {
    const user = userEvent.setup()
    render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const pages = await screen.findByRole('group', { name: 'Pages' })
    await within(pages).findByText('Page 1 of 3')
    const previous = within(pages).getByRole('button', { name: 'Previous page' })
    expect(previous.getAttribute('aria-disabled')).toBe('true')
    const next = within(pages).getByRole('button', { name: 'Next page' })
    await user.click(next)
    await user.click(next)
    expect(within(pages).getByText('Page 3 of 3')).toBeTruthy()
    expect(next.getAttribute('aria-disabled')).toBe('true')
    await user.click(next)
    expect(document.activeElement).toBe(next)
    expect(within(pages).getByText('Page 3 of 3')).toBeTruthy()
  })

  // The zoom is the design view's steps, said through Intl; Fit width is
  // the zoom it opens at, and is pressed while it holds. jsdom lays nothing
  // out, so the room it measures is none and the fit is 100 %.
  test('zooms by the design view’s steps, from fit width', async () => {
    const user = userEvent.setup()
    render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const zoom = screen.getByRole('group', { name: 'Zoom' })
    expect(within(zoom).getByRole('button', { name: 'Fit width' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(zoom).getByText('100%')).toBeTruthy()
    await user.click(within(zoom).getByRole('button', { name: 'Zoom in' }))
    expect(within(zoom).getByText('125%')).toBeTruthy()
    expect(within(zoom).getByRole('button', { name: 'Fit width' }).getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect(pdfjs.drawn.some((each) => each.zoom === 1.25)).toBe(true))
    await user.click(within(zoom).getByRole('button', { name: 'Fit width' }))
    expect(within(zoom).getByText('100%')).toBeTruthy()
  })

  // The download is the very PDF shown, under the starter's name.
  test('offers the PDF to download', async () => {
    render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const link = await screen.findByRole('link', { name: 'Download PDF' })
    expect(link.getAttribute('download')).toBe('quotation.pdf')
    expect(await downloaded()).toEqual([...PDF])
  })

  // A final render of an e-invoice wrote its XML (0065): Download XML,
  // after Download PDF and the next stop of the keyboard, gives it under
  // the starter's name, as UTF-8, the encoding its declaration names and
  // the one a Factur-X PDF embeds it in. A render that wrote none -- a
  // preview, a report that is no e-invoice -- offers none, rather than a
  // file of nothing or of another render.
  test('offers the XML an e-invoice’s render wrote beside its PDF, and none where it wrote none', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PdfView pdf={PDF} xml={XML} word={REFUSED} name="e-invoice" stale={false} />)
    const xml = await screen.findByRole('link', { name: 'Download XML' })
    expect(xml.getAttribute('download')).toBe('e-invoice.xml')
    expect(await downloadedXml()).toEqual({ type: 'application/xml', text: XML })
    screen.getByRole('link', { name: 'Download PDF' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(xml)
    rerender(<PdfView pdf={NEWER} word={REFUSED} name="e-invoice" stale={false} />)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Download XML' })).toBeNull())
    expect(await downloaded()).toEqual([...NEWER])
  })

  // The XML goes with the PDF it was written beside, as the download does
  // with the pages (below): until PDF.js has drawn a newer render's PDF,
  // Download XML gives the XML of the render on the paper, whose total is
  // the one the person reads there, and the newer one only once it is.
  test('offers the XML of the render it shows, until PDF.js has drawn the newer one', async () => {
    const { rerender } = render(<PdfView pdf={PDF} xml={XML} word={REFUSED} name="e-invoice" stale={false} />)
    await waitFor(() => expect(screen.getByRole('region', { name: PAPER_NAME }).getAttribute('aria-busy')).toBe('false'))
    let release = (): void => undefined
    pdfjs.held = new Promise((resolve) => {
      release = resolve
    })
    rerender(<PdfView pdf={NEWER} xml={NEWER_XML} word={REFUSED} name="e-invoice" stale={false} />)
    expect((await downloadedXml()).text).toBe(XML)
    await act(async () => release())
    await waitFor(() => expect(screen.getByRole('region', { name: PAPER_NAME }).getAttribute('aria-busy')).toBe('false'))
    expect((await downloadedXml()).text).toBe(NEWER_XML)
    expect(await downloaded()).toEqual([...NEWER])
  })

  // The render wrote a Word file of the document its PDF was drawn from
  // (0068): Download Word, after Download PDF and the keyboard's next
  // stop, gives those bytes under the starter's name, as the type Word
  // registered for a .docx, which is what a browser saves it by. A link
  // under another name or type would save a file Word does not open by
  // its name; one before Download PDF would move the download every
  // check and every person finds first.
  test('offers the Word file the render wrote, after Download PDF, under the starter’s name', async () => {
    const user = userEvent.setup()
    render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const word = await screen.findByRole('link', { name: 'Download Word' })
    expect(word.getAttribute('download')).toBe('quotation.docx')
    expect(await downloadedWord()).toEqual({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [80, 75, 3, 4] })
    screen.getByRole('link', { name: 'Download PDF' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(word)
    expect(screen.queryByRole('note')).toBeNull()
  })

  // The Word file goes with the PDF it was written beside, as the XML
  // does: until PDF.js has drawn a newer render's PDF, Download Word gives
  // the file of the render on the paper, whose words the person reads
  // there, and the newer one only once it is. Given the newest at once, it
  // would hold an edit the pages do not show yet.
  test('offers the Word file of the render it shows, until PDF.js has drawn the newer one', async () => {
    const { rerender } = render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    await waitFor(() => expect(screen.getByRole('region', { name: PAPER_NAME }).getAttribute('aria-busy')).toBe('false'))
    let release = (): void => undefined
    pdfjs.held = new Promise((resolve) => {
      release = resolve
    })
    rerender(<PdfView pdf={NEWER} word={NEWER_WORD} name="quotation" stale={false} />)
    expect((await downloadedWord()).bytes).toEqual([80, 75, 3, 4])
    await act(async () => release())
    await waitFor(() => expect(screen.getByRole('region', { name: PAPER_NAME }).getAttribute('aria-busy')).toBe('false'))
    expect((await downloadedWord()).bytes).toEqual([80, 75, 3, 4, 20, 0])
    expect(await downloaded()).toEqual([...NEWER])
  })

  // Where the writer refused the report -- what belongs to its PDF (0068)
  // -- there is no file, and a link to none, or to an earlier render's,
  // would hand a person a report with something left out. A note in the
  // link's place says why, in the writer's own sentence, and is named by
  // it; Download XML stays the keyboard's next stop after Download PDF.
  // A render the writer wrote in its place offers the file again, and no
  // note.
  test('says why there is no Word file where the writer refused, in a note and with no link', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PdfView pdf={PDF} xml={XML} word={REFUSED} name="e-invoice" stale={false} />)
    const note = await screen.findByRole('note', { name: `No Word file: ${SENTENCE}` })
    expect(note.textContent).toBe(`No Word file: ${SENTENCE}`)
    expect(screen.queryByRole('link', { name: 'Download Word' })).toBeNull()
    screen.getByRole('link', { name: 'Download PDF' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Download XML' }))
    rerender(<PdfView pdf={NEWER} word={WORD} name="e-invoice" stale={false} />)
    await screen.findByRole('link', { name: 'Download Word' })
    expect(screen.queryByRole('note')).toBeNull()
  })

  // A fault of the writer's is the Word file's alone (pipeline.ts): the
  // PDF is shown and offered as it printed, and the note says the writer
  // failed, and how, rather than a refusal it did not make -- a person
  // told the report cannot be a Word file would not look for the defect.
  test('says the writer failed where it did, beside the PDF that printed', async () => {
    render(<PdfView pdf={PDF} word={{ kind: 'failed', message: 'out of memory' }} name="quotation" stale={false} />)
    await screen.findByRole('note', { name: 'No Word file: the writer failed: out of memory' })
    expect(screen.queryByRole('link', { name: 'Download Word' })).toBeNull()
    expect(await downloaded()).toEqual([...PDF])
  })

  // A newer PDF arrives before PDF.js has loaded it. Until then the pages
  // on the paper are the older PDF's: a paper that said it was ready, and a
  // download that gave the newer bytes, would hand the person a PDF the
  // preview does not show -- and the browser gate and the README pictures,
  // which wait for the paper to settle, would read the older PDF as the
  // newer one.
  test('is busy, and offers the PDF it shows, until PDF.js has drawn the newer one', async () => {
    const { rerender } = render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const paper = screen.getByRole('region', { name: PAPER_NAME })
    await waitFor(() => expect(paper.getAttribute('aria-busy')).toBe('false'))
    expect(await downloaded()).toEqual([...PDF])

    let release = (): void => undefined
    pdfjs.held = new Promise((resolve) => {
      release = resolve
    })
    rerender(<PdfView pdf={NEWER} word={WORD} name="quotation" stale={false} />)
    expect(paper.getAttribute('aria-busy')).toBe('true')
    expect(await downloaded()).toEqual([...PDF])

    await act(async () => release())
    await waitFor(() => expect(paper.getAttribute('aria-busy')).toBe('false'))
    expect(await downloaded()).toEqual([...NEWER])
  })

  // Between a newer PDF's arrival and PDF.js having it, the paper still
  // shows the older one, and redraws it whenever its zoom or its width
  // changes -- a side pane hidden beside the Preview in the builder's
  // middle (0029) changes the width. Let go of as the newer arrived, the
  // older threw at that redraw and took the whole Studio down; it is let
  // go of once the newer is on the paper, and the last one when the paper
  // goes.
  test('keeps the PDF it shows until the newer one is on the paper, redrawing it meanwhile', async () => {
    const user = userEvent.setup()
    const { rerender, unmount } = render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const paper = screen.getByRole('region', { name: PAPER_NAME })
    await waitFor(() => expect(paper.getAttribute('aria-busy')).toBe('false'))

    let release = (): void => undefined
    pdfjs.held = new Promise((resolve) => {
      release = resolve
    })
    rerender(<PdfView pdf={NEWER} word={WORD} name="quotation" stale={false} />)
    await user.click(within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', { name: 'Zoom in' }))
    await waitFor(() =>
      expect(
        pdfjs.drawn
          .filter((each) => each.document === 1 && each.zoom === 1.25)
          .map((each) => each.page)
          .sort(),
      ).toEqual([1, 2, 3]),
    )
    expect(pdfjs.destroyed).toEqual([])

    await act(async () => release())
    await waitFor(() => expect(paper.getAttribute('aria-busy')).toBe('false'))
    expect(
      pdfjs.drawn
        .filter((each) => each.document === 2)
        .map((each) => each.page)
        .sort(),
    ).toEqual([1, 2, 3])
    expect(pdfjs.destroyed).toEqual([1])
    unmount()
    expect(pdfjs.destroyed).toEqual([1, 2])
  })

  // A newer PDF arriving while the one before it still loads: the one
  // loading is let go of at once, and never reaches the paper.
  test('lets go of a PDF still loading when a newer one arrives', async () => {
    pdfjs.held = new Promise(() => undefined)
    const { rerender } = render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    await waitFor(() => expect(pdfjs.loads).toBe(1))
    pdfjs.held = null
    rerender(<PdfView pdf={NEWER} word={WORD} name="quotation" stale={false} />)
    await waitFor(() => expect(screen.getByRole('region', { name: PAPER_NAME }).getAttribute('aria-busy')).toBe('false'))
    expect(pdfjs.destroyed).toEqual([1])
    expect(new Set(pdfjs.drawn.map((each) => each.document))).toEqual(new Set([2]))
  })

  // The paper scrolls its pages, so the keyboard must be able to stop on
  // it to scroll them (axe's scrollable-region-focusable, WCAG 2.1.1): a
  // region, named, in the tab order.
  test('is a named region the keyboard stops on', async () => {
    render(<PdfView pdf={PDF} word={WORD} name="quotation" stale={false} />)
    const paper = screen.getByRole('region', { name: PAPER_NAME })
    expect(paper.tabIndex).toBe(0)
    await screen.findByRole('group', { name: 'Page 1 of 3' })
  })
})
