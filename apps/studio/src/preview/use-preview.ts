/**
 * The preview of a session's current document, kept current: every edit
 * asks for a render, the scheduler runs the latest once the edits stop
 * (`latest.ts`), and what it delivers is shown until the next one arrives.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DataMode, ImageResolver } from '@formancy/report-runtime'
import type { Opened } from '../workspace.js'
import { latest } from './latest.js'
import type { Latest } from './latest.js'
import type { PreviewOutcome, PreviewRequest } from './pipeline.js'

/**
 * How long a render waits for the next edit. Chosen, not measured: longer
 * than the gap between keys when a person types a title, so a word renders
 * once rather than once a letter, and short enough that the preview follows
 * a pause.
 */
export const PREVIEW_DELAY = 400

export interface Shown {
  readonly outcome: PreviewOutcome
  readonly mode: DataMode
}

export interface PreviewState {
  /** The latest outcome delivered; null until the first. */
  readonly shown: Shown | null
  /** A render is waiting or running: what is shown is of an earlier document, or of the other mode. */
  readonly rendering: boolean
  /** A render that failed rather than refused: a fault in the page, said as one. */
  readonly fault: string | null
}

export function usePreview(opened: Opened, images: ImageResolver, mode: DataMode): PreviewState {
  const { session, starter } = opened
  const document = useSyncExternalStore(session.subscribe, session.document)
  const [state, setState] = useState<PreviewState>({ shown: null, rendering: true, fault: null })
  const renders = useRef<Latest<PreviewRequest> | null>(null)
  const lastMode = useRef<DataMode | null>(null)

  useEffect(() => {
    const made = latest<PreviewRequest, Shown>({
      delay: PREVIEW_DELAY,
      // The runtime and the renderer -- pdfmake and its fonts, most of the
      // Studio's bytes -- load with the first render, not with the page.
      run: async (request, signal) => {
        const { preview } = await import('./pipeline.js')
        return { outcome: await preview(request, signal), mode: request.mode }
      },
      deliver: (shown) => setState({ shown, rendering: false, fault: null }),
      fail: (error) => setState((now) => ({ ...now, rendering: false, fault: error instanceof Error ? error.message : String(error) })),
    })
    renders.current = made
    return () => {
      made.dispose()
      renders.current = null
      lastMode.current = null
    }
  }, [])

  useEffect(() => {
    // The first render, and a switch between preview and final, run at once;
    // an edit waits for the next.
    const now = lastMode.current !== mode
    lastMode.current = mode
    setState((was) => (was.rendering ? was : { ...was, rendering: true }))
    renders.current?.request({ report: document, starter, mode, images, creationDate: new Date().toISOString() }, { now })
  }, [document, starter, mode, images])

  return state
}
