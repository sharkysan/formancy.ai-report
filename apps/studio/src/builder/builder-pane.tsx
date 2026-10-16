/**
 * The builder the framework switch names, over the editor the Studio holds:
 * React's rendered here, Angular's bootstrapped into an element of its own.
 * Switching unmounts one and mounts the other over the same editor, and so
 * the same session -- the document, its history, the selection and the zoom
 * all stay (0012, plan 21).
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
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
function AngularBuilder({ editor }: { editor: ReportEditor }): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'starting' | 'started' | { readonly problem: string }>('starting')

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
      .then(({ mountAngularBuilder }) => mountAngularBuilder(element, editor))
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
    </>
  )
}

export function BuilderPane({ framework, editor }: { framework: Framework; editor: ReportEditor }): ReactElement {
  return framework === 'react' ? (
    <div className="builder-mount">
      <ReportBuilder editor={editor} />
    </div>
  ) : (
    <AngularBuilder editor={editor} />
  )
}
