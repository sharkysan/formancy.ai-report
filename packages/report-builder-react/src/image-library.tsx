/**
 * The report's images, listed under its own properties (0033): a group
 * named by the catalogue, with a row per image the report declares -- its
 * label as text, and a Remove named after the image.
 *
 * A Remove whose image something draws is `aria-disabled`, described by
 * what draws it, and still sends `removeImage`, so the live region says
 * why nothing happened. One that removed its image takes its own button
 * away, so the builder puts the keyboard on the first field, as the way
 * back to the report's properties does.
 */
import type { ReactElement } from 'react'
import type { EditorState, EditorText } from '@formancy/report-builder-core'

export interface ImageLibraryProps {
  readonly state: EditorState
  readonly t: EditorText
  /** Prefix for the element ids this pane mints, unique to its builder. */
  readonly ids: string
  readonly remove: (asset: string) => void
}

export function ImageLibrary({ state, t, ids, remove }: ImageLibraryProps): ReactElement | null {
  const { assets } = state.images
  if (assets.length === 0) return null
  return (
    <div role="group" aria-label={t('images.heading')}>
      {assets.map((image, at) => {
        const why = `${ids}-image-${String(at)}-in-use`
        return (
          <div key={image.id} data-report-part="property">
            <span>{image.label}</span>
            <button
              type="button"
              aria-label={image.removeLabel}
              aria-disabled={image.inUse === undefined ? undefined : true}
              aria-describedby={image.inUse === undefined ? undefined : why}
              onClick={() => remove(image.id)}
            >
              {t('images.remove')}
              {image.inUse === undefined ? null : (
                <span id={why} hidden>
                  {image.inUse}
                </span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
