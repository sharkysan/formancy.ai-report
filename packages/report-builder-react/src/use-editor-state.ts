/**
 * The editor's state as a React value.
 *
 * `editor.state()` is deeply frozen and stays the same object until
 * something changes, which is exactly the snapshot `useSyncExternalStore`
 * compares by identity, so React re-renders once per change and never
 * loops. The subscription is the whole of React's part: what the state
 * holds is report-builder-core's, shared with the Angular builder (plan
 * 11.4).
 */
import { useSyncExternalStore } from 'react'
import type { EditorState, ReportEditor } from '@formancy/report-builder-core'

/** Re-renders the component on every change to `editor`'s state; unsubscribes when it unmounts or the editor is replaced. */
export function useEditorState(editor: ReportEditor): EditorState {
  return useSyncExternalStore(editor.subscribe, editor.state, editor.state)
}
