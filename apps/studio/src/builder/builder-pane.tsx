/**
 * The builder the framework switch names, over the editor the Studio holds:
 * React's rendered here, Angular's bootstrapped into an element of its own.
 * Switching unmounts one and mounts the other over the same editor, and so
 * the same session -- the document, its history, the selection and the zoom
 * all stay (0012, plan 21).
 *
 * Each is given the Studio's Preview as its view, which it draws in the
 * design view's place while the editor says so (0029): React's builder
 * as its `hostView`, and Angular's in an element it lends, into which
 * React draws the Preview through a portal. A switch draws the Preview
 * anew in the builder shown.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ReportEditor } from '@formancy/report-builder-core'
import { ReportBuilder } from '@formancy/report-builder-react'

export type Framework = 'react' | 'angular'

export const FRAMEWORKS: ReadonlyArray<{ readonly value: Framework; readonly label: string }> = [
  { value: 'react', label: 'React' },
  { value: 'angular', label: 'Angular' },
]

/**
 * The Angular builder's mount, as a React component: formancy.ai-data's
 * host page's, for its reasons. React owns the element and nothing Angular
 * draws in it. Bootstrapping is asynchronous and effects are not, so an
 * unmount that arrives first -- StrictMode does exactly that, and so does
 * switching back before Angular has started -- marks the late mount to take
 * itself down instead of leaving an application over the editor.
 */
function AngularBuilder({ editor, hostView }: { editor: ReportEditor; hostView: ReactNode }): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'starting' | 'started' | { readonly problem: string }>('starting')
  /** The element Angular's builder lends the host's view, while it stands in the builder's middle. */
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  /**
   * Whether the editor stands the view in the middle now. Angular takes its
   * element back a render after the editor says so; drawn into it until
   * then, the Preview would print a second time beside its copy the Studio
   * already draws beside the builder, under the same id.
   */
  const inTheMiddle = useSyncExternalStore(editor.subscribe, () => editor.state().view === 'host')

  useEffect(() => {
    const element = host.current
    if (element === null) return undefined
    let cancelled = false
    let unmount: (() => void) | undefined
    setState('starting')
    // Loaded when Angular is first asked for, not with the page: the React
    // builder paints without waiting, and the bundle splits where the two
    // frameworks meet.
    import('./angular-bootstrap.js')
      .then(({ mountAngularBuilder }) => mountAngularBuilder(element, editor, setSlot))
      .then((teardown) => {
        if (cancelled) teardown()
        else {
          unmount = teardown
          setState('started')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ problem: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      cancelled = true
      unmount?.()
    }
  }, [editor])

  return (
    <>
      {state === 'started' ? null : typeof state === 'string' ? (
        <p role="status" className="builder-note">
          Starting the Angular builder…
        </p>
      ) : (
        <p role="alert" className="problem-box">
          The Angular builder did not start: {state.problem}
        </p>
      )}
      <div ref={host} className="builder-mount" />
      {slot === null || !inTheMiddle ? null : createPortal(hostView, slot)}
    </>
  )
}

export function BuilderPane({ framework, editor, hostView }: { framework: Framework; editor: ReportEditor; hostView: ReactNode }): ReactElement {
  return framework === 'react' ? (
    <div className="builder-mount">
      <ReportBuilder editor={editor} hostView={hostView} />
    </div>
  ) : (
    <AngularBuilder editor={editor} hostView={hostView} />
  )
}
