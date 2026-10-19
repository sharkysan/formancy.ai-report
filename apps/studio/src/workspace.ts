/**
 * What the Studio has open: one report session per starter, and one editor
 * over each, both made the first time the starter is picked and kept while
 * the page lives.
 *
 * The session holds the document and its history (0008); the editor holds
 * one person's view of it -- selection, zoom, the pane a narrow screen
 * shows (0012), and the Preview, shown or not and where it stands (0029).
 * Whichever builder is shown, React's or Angular's, renders the same
 * editor, so switching frameworks keeps all of it, and a builder that is
 * unmounted leaves the editor to whoever made it: here. Every editor is
 * made with the one store the page keeps images in (0033), so an image
 * added in one starter's builder, in either framework, is one the
 * Preview's lookup answers for.
 */
import { createReportEditor } from '@formancy/report-builder-core'
import type { EditorLocale, ImageStore, ReportEditor } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import { MIDDLE, placeIn, PREVIEW_NAME } from './layout.js'
import type { StudioStarter } from './starters/codec.js'

export interface Opened {
  readonly starter: StudioStarter
  readonly session: ReportSession
  readonly editor: ReportEditor
}

export interface Workspace {
  /** The starter's session and editor, made the first time it is opened. */
  open(id: string): Opened
  /** Disposes every editor it made, and stops following the window. */
  dispose(): void
}

export interface WorkspaceOptions {
  /** The language of the editors' own words; English when absent. */
  readonly locale?: EditorLocale
  /** The window's answer to `MIDDLE`, which says where the Preview has room; the window's own when absent. */
  readonly room?: MediaQueryList
  /** Where an image a person adds is kept: the page's (`images/image-store.ts`); none, and no Add image…, when absent. */
  readonly images?: ImageStore
}

export function createWorkspace(starters: readonly StudioStarter[], { locale = 'en', room = window.matchMedia(MIDDLE), images }: WorkspaceOptions = {}): Workspace {
  const opened = new Map<string, Opened>()
  // Every editor is told, not only the one shown: a starter picked again
  // after the window crossed the width draws its Preview where there is
  // room for it now, from its first frame.
  const follow = (): void => {
    for (const { editor } of opened.values()) editor.dispatch({ type: 'placeHostView', place: placeIn(room) })
  }
  room.addEventListener('change', follow)
  return {
    open(id) {
      const known = opened.get(id)
      if (known !== undefined) return known
      const starter = starters.find((each) => each.id === id)
      if (starter === undefined) throw new RangeError(`the Studio has no starter '${id}'`)
      const opening = openReportSession(starter.report)
      if (!opening.ok) throw new Error(`the starter '${id}' is not a valid report: ${opening.errors.map((error) => `${error.path} ${error.message}`).join('; ')}`)
      // Each starter opens with its PDF in sight, where the window has room for it.
      const editor = createReportEditor(opening.session, { locale, hostView: { name: PREVIEW_NAME, shown: true, place: placeIn(room) }, ...(images === undefined ? {} : { images }) })
      const made = { starter, session: opening.session, editor }
      opened.set(id, made)
      return made
    },
    dispose() {
      room.removeEventListener('change', follow)
      for (const { editor } of opened.values()) editor.dispose()
      opened.clear()
    },
  }
}
