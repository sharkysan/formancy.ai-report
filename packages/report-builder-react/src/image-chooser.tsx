/**
 * Add image…: the palette's last button, where the host keeps images
 * (0033), and the file input it opens, hidden beside it.
 *
 * The button sends `chooseImage` and, when the editor will take a file
 * now, calls the input's `click()` at once, in the same activation -- a
 * click, Enter or Space -- which opens the platform's chooser; awaiting
 * anything first would lose the activation, and the browser would open
 * nothing. The input is outside the accessibility tree and never has
 * focus: the keyboard stays on the button throughout.
 *
 * On the input's change the file is taken into a local before `value` is
 * cleared, because in a browser clearing it empties `files`; it is cleared
 * so that the same file chosen again is a change again. A chooser closed
 * without a file changes nothing, and nothing is sent. What the file is,
 * and whether it is added, is the editor's to say, in the live region.
 */
import { useRef } from 'react'
import type { ReactElement } from 'react'
import type { EditorState, EditorText } from '@formancy/report-builder-core'

export interface ImageChooserProps {
  readonly state: EditorState
  readonly t: EditorText
  /** Prefix for the element ids this pane mints, unique to its builder. */
  readonly ids: string
  /** Sends `chooseImage`: whether the editor takes a file now, else it has said why not. */
  readonly choose: () => boolean
  /** Hands the editor the file a person chose. */
  readonly add: (file: File) => void
}

export function ImageChooser({ state, t, ids, choose, add }: ImageChooserProps): ReactElement | null {
  const input = useRef<HTMLInputElement>(null)
  const { images } = state
  if (!images.store) return null
  const why = `${ids}-unavailable-add-image`
  return (
    <>
      <button
        type="button"
        data-report-part="palette-item"
        aria-disabled={state.can.addImage ? undefined : true}
        aria-describedby={images.unavailable === undefined ? undefined : why}
        aria-busy={images.adding === null ? undefined : true}
        onClick={() => {
          if (choose()) input.current?.click()
        }}
      >
        {t('images.add')}
        {images.unavailable === undefined ? null : (
          <span id={why} hidden>
            {images.unavailable}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={images.accept}
        onChange={(event) => {
          const chosen = event.currentTarget
          const file = chosen.files?.[0]
          chosen.value = ''
          if (file !== undefined) add(file)
        }}
      />
    </>
  )
}
