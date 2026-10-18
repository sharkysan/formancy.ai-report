import { describe, expect, test, vi } from 'vitest'

/**
 * The one module that imports PDF.js, over a stand-in for it: jsdom has no
 * canvas for PDF.js to draw on, so what is held here is what the viewer is
 * handed back, not a drawing. The drawing is the browser gate's.
 */

/** PDF.js's own getPage on a document already let go of: its transport is gone, and it throws at once. */
const gone = vi.hoisted(() => (): never => {
  throw new TypeError("Cannot read properties of null (reading 'sendWithPromise')")
})

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  TextLayer: class {},
  getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: gone }), destroy: () => Promise.resolve() }),
}))

describe('PDF.js, as the viewer asks it', () => {
  // The viewer draws a page inside a React effect. A throw there is the
  // render's, and with no boundary above it React takes the whole Studio
  // down: a document let go of -- a newer PDF arrived as a pane was hidden
  // -- did exactly that. Its draw is one that did not happen, a rejection
  // the viewer already passes over.
  test('a page asked of a document let go of is a draw that did not happen, not a throw', async () => {
    const { loadPdf } = await import('./pdf-document.js')
    const document = await loadPdf(new Uint8Array([37, 80, 68, 70])).promise
    let drawing: Promise<void> | undefined
    expect(() => {
      drawing = document.drawPage(1, 1, window.document.createElement('canvas'), window.document.createElement('div')).done
    }).not.toThrow()
    await expect(drawing).rejects.toThrow(TypeError)
  })
})
