import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { PAPER_NAME, PdfView } from './pdf-view.js'

/**
 * The viewer's controls, in jsdom, over a PDF.js stand-in: jsdom has no
 * canvas for PDF.js to draw on, so what is held here is what the viewer
 * asks PDF.js for and what it offers the person. Drawing and the text layer
 * are the browser gate's.
 */

/** What the stand-in was asked to draw, and the load it is holding back, if any. */
const pdfjs = vi.hoisted(() => ({ drawn: [] as { readonly page: number; readonly zoom: number }[], held: null as Promise<void> | null }))

vi.mock('./pdf-document.js', () => ({
  loadPdf: () => ({
    promise: (pdfjs.held ?? Promise.resolve()).then(() => ({
      pageCount: 3,
      pageSize: () => Promise.resolve({ width: 595.28, height: 841.89 }),
      drawPage: (page: number, zoom: number) => {
        pdfjs.drawn.push({ page, zoom })
        return { done: Promise.resolve(), cancel: () => undefined }
      },
    })),
    destroy: () => undefined,
  }),
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
  pdfjs.held = null
})

const PDF = new Uint8Array([37, 80, 68, 70])
const NEWER = new Uint8Array([37, 80, 68, 70, 45, 50])

/** The bytes Download PDF gives. */
async function downloaded(): Promise<number[]> {
  const href = screen.getByRole('link', { name: 'Download PDF' }).getAttribute('href') ?? ''
  return [...new Uint8Array(await (blobs.get(href) as Blob).arrayBuffer())]
}

describe('the PDF viewer', () => {
  // Each page is a group named by its number, so a screen reader can move
  // page by page; every page is drawn, at the zoom shown.
  test('shows every page, named by its number, each drawn', async () => {
    render(<PdfView pdf={PDF} fileName="quotation.pdf" stale={false} />)
    for (const name of ['Page 1 of 3', 'Page 2 of 3', 'Page 3 of 3']) await screen.findByRole('group', { name })
    await waitFor(() => expect(pdfjs.drawn.map((each) => each.page).sort()).toEqual([1, 2, 3]))
  })

  // Next page on the last page, and Previous on the first, have nothing to
  // do: they say so and keep focus, so a keyboard pressing Enter on them
  // stays where it is rather than being dropped on the page.
  test('moves page by page, and keeps focus at either end', async () => {
    const user = userEvent.setup()
    render(<PdfView pdf={PDF} fileName="quotation.pdf" stale={false} />)
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
    render(<PdfView pdf={PDF} fileName="quotation.pdf" stale={false} />)
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
    render(<PdfView pdf={PDF} fileName="quotation.pdf" stale={false} />)
    const link = await screen.findByRole('link', { name: 'Download PDF' })
    expect(link.getAttribute('download')).toBe('quotation.pdf')
    expect(await downloaded()).toEqual([...PDF])
  })

  // A newer PDF arrives before PDF.js has loaded it. Until then the pages
  // on the paper are the older PDF's: a paper that said it was ready, and a
  // download that gave the newer bytes, would hand the person a PDF the
  // preview does not show -- and the browser gate and the README pictures,
  // which wait for the paper to settle, would read the older PDF as the
  // newer one.
  test('is busy, and offers the PDF it shows, until PDF.js has drawn the newer one', async () => {
    const { rerender } = render(<PdfView pdf={PDF} fileName="quotation.pdf" stale={false} />)
    const paper = screen.getByRole('region', { name: PAPER_NAME })
    await waitFor(() => expect(paper.getAttribute('aria-busy')).toBe('false'))
    expect(await downloaded()).toEqual([...PDF])

    let release = (): void => undefined
    pdfjs.held = new Promise((resolve) => {
      release = resolve
    })
    rerender(<PdfView pdf={NEWER} fileName="quotation.pdf" stale={false} />)
    expect(paper.getAttribute('aria-busy')).toBe('true')
    expect(await downloaded()).toEqual([...PDF])

    await act(async () => release())
    await waitFor(() => expect(paper.getAttribute('aria-busy')).toBe('false'))
    expect(await downloaded()).toEqual([...NEWER])
  })

  // The paper scrolls its pages, so the keyboard must be able to stop on
  // it to scroll them (axe's scrollable-region-focusable, WCAG 2.1.1): a
  // region, named, in the tab order.
  test('is a named region the keyboard stops on', async () => {
    render(<PdfView pdf={PDF} fileName="quotation.pdf" stale={false} />)
    const paper = screen.getByRole('region', { name: PAPER_NAME })
    expect(paper.tabIndex).toBe(0)
    await screen.findByRole('group', { name: 'Page 1 of 3' })
  })
})
