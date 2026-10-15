/**
 * The place dialog: the keyboard path for every drag (formancy.ai 0046).
 *
 * While the editor's drag is `via: 'keyboard'` it lists the drag's targets
 * -- the places report-core's `validLocations` accepts, named "Body, after
 * Introduction" -- as buttons, and Cancel. Focus moves into it when it opens;
 * the place focused is the one the canvas marks, so a sighted keyboard user
 * sees where each choice lands before making it. Escape cancels, through the
 * editor's own key map. Choosing a place, and cancelling, are the builder's
 * to finish: it knows where focus goes next.
 */
import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import type { DragState, DropTarget, EditorAction, EditorState, EditorText } from '@formancy/report-builder-core'

export interface PlacesProps {
  readonly state: EditorState
  readonly drag: DragState
  readonly t: EditorText
  readonly ids: string
  readonly act: (action: EditorAction) => void
  readonly choose: (subject: DragState['subject'], target: DropTarget) => void
  readonly cancel: () => void
}

export function Places({ state, drag, t, ids, act, choose, cancel }: PlacesProps): ReactElement {
  const first = useRef<HTMLButtonElement>(null)
  const title = `${ids}-places`
  const nowhere = `${ids}-nowhere`

  // Into the dialog when it opens, and not again: the person moves within it from there.
  useEffect(() => {
    first.current?.focus()
  }, [])

  return (
    // A floating pane of the workbench, so its buttons are the workbench's.
    <div role="dialog" aria-labelledby={title} aria-describedby={drag.nowhere === undefined ? undefined : nowhere} data-report-part="places" className="wb-pane">
      <header id={title}>{drag.title}</header>
      {drag.nowhere === undefined ? null : (
        <p id={nowhere} className="wb-problem">
          {drag.nowhere}
        </p>
      )}
      {state.dropTargets.map((target, at) => (
        <button
          key={target.index}
          ref={at === 0 ? first : undefined}
          type="button"
          data-report-part="place"
          onFocus={() => act({ type: 'updateDrag', over: target.index })}
          onClick={() => choose(drag.subject, target)}
        >
          {target.label}
        </button>
      ))}
      <button ref={state.dropTargets.length === 0 ? first : undefined} type="button" onClick={cancel}>
        {t('places.cancel')}
      </button>
    </div>
  )
}
