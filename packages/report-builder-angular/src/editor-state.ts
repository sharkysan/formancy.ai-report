/**
 * An editor's state as a signal: the one place this package listens to
 * report-builder-core.
 *
 * The editor's `state()` is a frozen object that stays the same until
 * something changes, and `subscribe` says when it has. That is all a signal
 * needs, so this is a signal set on each notification, rather than an
 * Observable turned into one: nothing here is a stream, and `toSignal` would
 * add RxJS to every builder for the sake of one callback. An OnPush view
 * reading the signal is marked for check when it is set, and zoneless
 * change detection renders it; nothing else schedules a render.
 */
import { effect, linkedSignal } from '@angular/core'
import type { Signal } from '@angular/core'
import type { EditorState, ReportEditor } from '@formancy/report-builder-core'

/**
 * The state of the editor `editor` names, for as long as the view that
 * called this lives. Call it in an injection context: a field initialiser
 * or a constructor.
 *
 * When `editor` names another editor, the signal is that editor's state at
 * once, and the old editor is let go (plan 21's "replacing the session
 * input"). The subscription is an effect's, and its cleanup unsubscribes: on
 * the next editor, and when the view's `DestroyRef` ends the effect, so a
 * destroyed builder leaves no listener behind on an editor that outlives it.
 */
export function injectEditorState(editor: Signal<ReportEditor>): Signal<EditorState> {
  // Read from the editor the input names whenever it names another, so the
  // first render needs no subscription to be right.
  const state = linkedSignal(() => editor().state())
  effect((onCleanup) => {
    const following = editor()
    onCleanup(following.subscribe(() => state.set(following.state())))
    // Whatever changed between the read above and the subscription.
    state.set(following.state())
  })
  return state.asReadonly()
}
