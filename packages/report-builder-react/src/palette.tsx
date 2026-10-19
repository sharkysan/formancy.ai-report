/**
 * The palette: one button per kind of component the format has.
 *
 * Activating one -- a click, Enter or Space -- opens the place dialog for
 * that kind, the keyboard path every drag has. Pressing one and moving is
 * the pointer path to the same places. An entry the report cannot hold yet
 * (an image with nothing to draw) stays in the list, `aria-disabled` and
 * described by what to declare first, so it is found rather than missed.
 * Where the host keeps images, Add image… stands last (`chooser`, 0033).
 */
import type { ReactElement, ReactNode } from 'react'
import type { EditorState, EditorText } from '@formancy/report-builder-core'
import type { ComponentKind } from '@formancy/report-spec'
import type { PointerDrag } from './pointer-drag.js'

export interface PaletteProps {
  readonly state: EditorState
  readonly t: EditorText
  /** Prefix for the element ids this pane mints, unique to its builder. */
  readonly ids: string
  readonly drag: PointerDrag
  /** Opens the place dialog for a new component of `kind`, focus to return to `from`. */
  readonly place: (kind: ComponentKind, from: HTMLElement) => void
  /** Add image… and its file input, after the entries; nothing where the host keeps no images. */
  readonly chooser?: ReactNode
}

export function Palette({ state, t, ids, drag, place, chooser }: PaletteProps): ReactElement {
  return (
    <div role="group" aria-label={t('pane.palette')} data-report-part="palette">
      {state.palette.map((entry) => {
        const why = `${ids}-unavailable-${entry.kind}`
        return (
          <button
            key={entry.kind}
            type="button"
            data-report-part="palette-item"
            data-kind={entry.kind}
            aria-disabled={entry.component === null ? true : undefined}
            aria-describedby={entry.unavailable === undefined ? undefined : why}
            onPointerDown={(event) => drag.press(event, { kind: entry.kind })}
            onClick={(event) => {
              if (!drag.swallowClick()) place(entry.kind, event.currentTarget)
            }}
          >
            {entry.label}
            {entry.unavailable === undefined ? null : (
              <span id={why} hidden>
                {entry.unavailable}
              </span>
            )}
          </button>
        )
      })}
      {chooser}
    </div>
  )
}
