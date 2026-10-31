/**
 * The place dialog: the keyboard path for every drag (formancy.ai 0046).
 *
 * While the editor's drag is `via: 'keyboard'` it lists the drag's targets
 * -- the places report-core's `validLocations` accepts, named "Body, after
 * Introduction" -- as buttons, and Cancel. Focus moves into it when this
 * builder opens it (the builder's `openPlaces`), never merely because it is
 * drawn: a dialog another builder opened stays where the keyboard left it.
 * The place focused is the one the canvas marks, so a sighted keyboard user
 * sees where each choice lands before making it. Escape cancels, through the
 * editor's own key map. Choosing a place, and cancelling, are the builder's
 * to finish: it knows where focus goes next.
 */
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
  const nowhere = `${ids}-nowhere`

  return (
    // A floating pane of the workbench, so its buttons are the workbench's.
    // Named in the editor's words, as the header says, never after the
    // header, whose name a host's stylesheet could set in capitals.
    <div
      role="dialog"
      aria-label={drag.title}
      aria-describedby={drag.nowhere === undefined ? undefined : nowhere}
      data-report-part="places"
      className="wb-pane"
    >
      <header>{drag.title}</header>
      {drag.nowhere === undefined ? null : (
        <p id={nowhere} className="wb-problem">
          {drag.nowhere}
        </p>
      )}
      {state.dropTargets.map((target) => (
        <button
          key={target.index}
          type="button"
          data-report-part="place"
          onFocus={() => act({ type: 'updateDrag', over: target.index })}
          onClick={() => choose(drag.subject, target)}
        >
          {target.label}
        </button>
      ))}
      <button type="button" onClick={cancel}>
        {t('places.cancel')}
      </button>
    </div>
  )
}
