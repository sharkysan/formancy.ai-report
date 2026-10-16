/**
 * What the Studio has open: one report session per starter, and one editor
 * over each, both made the first time the starter is picked and kept while
 * the page lives.
 *
 * The session holds the document and its history (0008); the editor holds
 * one person's view of it -- selection, zoom, the pane a narrow screen
 * shows (0012). Whichever builder is shown, React's or Angular's, renders
 * the same editor, so switching frameworks keeps all of it, and a builder
 * that is unmounted leaves the editor to whoever made it: here.
 */
import { createReportEditor } from '@formancy/report-builder-core'
import type { EditorLocale, ReportEditor } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import type { StudioStarter } from './starters/codec.js'

export interface Opened {
  readonly starter: StudioStarter
  readonly session: ReportSession
  readonly editor: ReportEditor
}

export interface Workspace {
  /** The starter's session and editor, made the first time it is opened. */
  open(id: string): Opened
  /** Disposes every editor it made. */
  dispose(): void
}

export function createWorkspace(starters: readonly StudioStarter[], locale: EditorLocale = 'en'): Workspace {
  const opened = new Map<string, Opened>()
  return {
    open(id) {
      const known = opened.get(id)
      if (known !== undefined) return known
      const starter = starters.find((each) => each.id === id)
      if (starter === undefined) throw new RangeError(`the Studio has no starter '${id}'`)
      const opening = openReportSession(starter.report)
      if (!opening.ok) throw new Error(`the starter '${id}' is not a valid report: ${opening.errors.map((error) => `${error.path} ${error.message}`).join('; ')}`)
      const made = { starter, session: opening.session, editor: createReportEditor(opening.session, { locale }) }
      opened.set(id, made)
      return made
    },
    dispose() {
      for (const { editor } of opened.values()) editor.dispose()
      opened.clear()
    },
  }
}
