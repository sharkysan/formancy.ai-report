import { afterEach, describe, expect, test, vi } from 'vitest'

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

describe("PDF.js's worker, under the demo's Trusted Types (0051)", () => {
  type Rules = { createScriptURL(url: string): string | null }
  /** A browser's Trusted Types, recording the policies made, with a default one already or not. */
  function trustedTypes(defaultPolicy: unknown = null) {
    const made: Array<{ name: string; rules: Rules }> = []
    vi.stubGlobal('trustedTypes', { defaultPolicy, createPolicy: (name: string, rules: Rules) => made.push({ name, rules }) })
    return made
  }
  async function load(): Promise<string> {
    vi.resetModules()
    await import('./pdf-document.js')
    return String((await import('pdfjs-dist')).GlobalWorkerOptions.workerSrc)
  }
  afterEach(() => vi.unstubAllGlobals())

  // PDF.js hands `new Worker` its address as a string. Refused, it does not
  // fail: it runs the worker's code on the page's thread, and every preview
  // prints there. The default policy lets that one address through; any
  // other comes back as nothing, which the browser refuses.
  test('the default policy lets the worker PDF.js is given through, and no other address', async () => {
    const made = trustedTypes()
    const address = await load()
    expect(made.map(({ name }) => name)).toEqual(['default'])
    const rules = made[0]?.rules
    expect(rules?.createScriptURL(address)).toBe(address)
    expect(rules?.createScriptURL('https://example.invalid/pdf.worker.min.mjs')).toBeNull()
    expect(rules?.createScriptURL(`${address}#`)).toBeNull()
  })

  // A rule for markup or a script's text would let a string into innerHTML
  // or a script, which are the sinks the policy is there to refuse.
  test('and says nothing of markup or of a script, which stay refused', async () => {
    const made = trustedTypes()
    await load()
    expect(Object.keys(made[0]?.rules ?? {})).toEqual(['createScriptURL'])
  })

  // A second default policy throws, at the module's evaluation, and the
  // preview would be gone for a policy somebody else already made.
  test('is not made again where a default policy is made already', async () => {
    const made = trustedTypes({})
    await load()
    expect(made).toEqual([])
  })

  // jsdom, and a browser without Trusted Types: no policy, and the worker
  // named as before.
  test('is not made where the browser has no Trusted Types, and the worker is still named', async () => {
    expect(await load()).toMatch(/pdf\.worker\.min\.mjs/)
  })
})

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
