/**
 * A drag, by a pointer or by the keyboard through the place chooser
 * (formancy.ai 0046): what it carries, a component the report has or a
 * palette entry; the places it may drop, report-core's `validLocations`
 * for it, kept while the document, the subject and the zoom stay the same;
 * the place it is over; and the drop, which is the editor's move or insert
 * at that place. A drag is the editor's own: nothing reaches the report
 * until it drops.
 */
import type { Location } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import type { ComponentKind } from '@formancy/report-spec'
import { kindLabel } from './labels.js'
import { DONE } from './model.js'
import type { DragSubject, DropTarget, EditorOutcome, EditorRefusalCode } from './model.js'
import { dragged } from './state.js'
import type { Derived, Local } from './state.js'
import { dropTargets } from './targets.js'
import type { EditorText } from './text.js'

/** What the editor lends its drag: its document and its own state, its words for a component, and the move and the insert a drop ends in. */
export interface DragEditing {
  current(): Derived
  local(): Local
  setLocal(next: Partial<Local>): void
  announce(text: string): Partial<Local>
  refuse(code: EditorRefusalCode, text: string): EditorOutcome
  /** What the outline calls the component or row keyed `key`. */
  labelOf(key: string): string
  insert(kind: ComponentKind, target: Location): EditorOutcome
  move(id: string, target: Location): EditorOutcome
}

/** The editor's drag over `editing`, in the words of `t`: its actions, and the places the drag in progress may drop, which the state lists. */
export function dragActions(editing: DragEditing, t: EditorText) {
  const { setLocal, announce, refuse } = editing
  let targetsCache: { readonly derived: Derived; readonly subject: string; readonly zoom: number; readonly targets: readonly DropTarget[] } | undefined

  function targets(): readonly DropTarget[] {
    const { drag, zoom } = editing.local()
    if (drag === null) return []
    const now = editing.current()
    const subject = JSON.stringify(drag.subject)
    if (targetsCache?.derived === now && targetsCache.subject === subject && targetsCache.zoom === zoom) return targetsCache.targets
    const component = dragged(now, drag.subject)
    const found = component === null ? [] : dropTargets(now.report, component, { labels: now.labels, layout: now.layout, zoom }, t)
    targetsCache = { derived: now, subject, zoom, targets: found }
    return found
  }

  function startDrag(subject: DragSubject, via: 'pointer' | 'keyboard'): EditorOutcome {
    const now = editing.current()
    if ('id' in subject) {
      if (componentAt(now.report, subject.id) === undefined) return refuse('not-found', t('status.notFound', { name: subject.id }))
    } else {
      const entry = now.palette.find((candidate) => candidate.kind === subject.kind)
      if (entry === undefined || entry.component === null) return refuse('unavailable', entry?.unavailable ?? t('status.notFound', { name: subject.kind }))
    }
    const name = 'id' in subject ? editing.labelOf(subject.id) : kindLabel(subject.kind, t)
    setLocal({ drag: { subject, via, over: null }, ...announce(t('status.choosePlace', { name })) })
    return DONE
  }

  function updateDrag(over: number | null): EditorOutcome {
    const { drag } = editing.local()
    if (drag === null) return refuse('not-dragging', t('status.notMoved'))
    if (over !== null && targets()[over] === undefined) return refuse('not-found', t('status.notFound', { name: String(over) }))
    if (over !== drag.over) setLocal({ drag: { ...drag, over } })
    return DONE
  }

  function drop(): EditorOutcome {
    const { drag } = editing.local()
    if (drag === null) return refuse('not-dragging', t('status.notMoved'))
    const target = drag.over === null ? undefined : targets()[drag.over]
    if (target === undefined) {
      setLocal({ drag: null })
      return refuse('no-target', t('status.notMoved'))
    }
    return 'id' in drag.subject ? editing.move(drag.subject.id, target.location) : editing.insert(drag.subject.kind, target.location)
  }

  function cancelDrag(): EditorOutcome {
    if (editing.local().drag === null) return refuse('not-dragging', t('status.notMoved'))
    setLocal({ drag: null, ...announce(t('status.notMoved')) })
    return DONE
  }

  return { targets, startDrag, updateDrag, drop, cancelDrag }
}
