/**
 * Dragging with a pointer: a palette entry, a box on the canvas or an outline
 * row, dropped on the canvas or beside an outline row.
 *
 * The drag itself is the editor's state machine (`startDrag`, `updateDrag`,
 * `drop`, `cancelDrag`), and where a drop may land is its `dropTargets`,
 * which are report-core's `validLocations`; this file only turns pointer
 * positions into a target's index with `targetNear` and `targetBeside`. So a
 * pointer is never offered a place the session would refuse, and the
 * keyboard path -- the place dialog -- offers exactly the same places
 * (formancy.ai 0046: every drag has a keyboard path, built first).
 *
 * A press becomes a drag only once it has moved, so a click stays a click:
 * activating a palette entry opens the place dialog, and clicking a box
 * selects it. Mouse and pen drag; a touch scrolls, as the page needs it to,
 * and a tap is a click.
 */
import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { targetBeside, targetNear } from '@formancy/report-builder-core'
import type { DragSubject, OutlineNode, ReportEditor } from '@formancy/report-builder-core'

/**
 * How far a press may wander, in CSS pixels, and still be a click: Windows'
 * default drag rectangle (`SM_CXDRAG`, `SM_CYDRAG`), which is what a person
 * on that system already has in their hands. A convention, not a measurement.
 */
const DRAG_DISTANCE = 4

/** Where a drag can land: the outline's tree, and the canvas with its sheet. */
export interface DropZones {
  readonly tree: RefObject<HTMLElement | null>
  readonly canvas: RefObject<HTMLElement | null>
  readonly sheet: RefObject<HTMLElement | null>
}

export interface PointerDrag {
  /** Watches a press on something that can be dragged; it becomes a drag once it moves. */
  press(event: ReactPointerEvent<HTMLElement>, subject: DragSubject): void
  /** True, once, for the click a drag ended in, before any key or press: that click must not also select or open what it ended on. */
  swallowClick(): boolean
  /** Remembers which node an outline row draws, so a drag over the row can find the places beside it. */
  row(element: HTMLElement | null, node: OutlineNode): void
}

interface Press {
  readonly subject: DragSubject
  readonly x: number
  readonly y: number
}

export function usePointerDrag(editor: ReportEditor, zones: DropZones, placed: () => void): PointerDrag {
  const pressed = useRef<Press | null>(null)
  const dragging = useRef(false)
  const swallow = useRef(false)
  const rows = useRef(new WeakMap<Element, OutlineNode>())
  // The latest of each, read when an event arrives, so a re-render never
  // re-subscribes -- which would cancel a drag in flight.
  const onPlaced = useRef(placed)
  onPlaced.current = placed
  const where = useRef(zones)
  where.current = zones

  useEffect(() => {
    /** The target under the pointer: beside the outline row it is over, else the nearest on the sheet, else none. */
    function over(event: PointerEvent): number | null {
      const targets = editor.state().dropTargets
      const zones = where.current
      const at = event.target instanceof Element ? event.target : null
      if (at === null) return null
      const row = at.closest('[role="treeitem"]')
      if (row !== null && zones.tree.current?.contains(row) === true) {
        const node = rows.current.get(row)
        if (node === undefined || node.column !== undefined) return null
        const box = row.getBoundingClientRect()
        return targetBeside(targets, node.id, event.clientY < box.top + box.height / 2 ? 'before' : 'after')
      }
      const sheet = zones.sheet.current
      if (sheet === null || zones.canvas.current?.contains(at) !== true) return null
      // The targets are in pixels from the sheet's padding edge, where its
      // absolutely placed children start: inside its border.
      const box = sheet.getBoundingClientRect()
      return targetNear(targets, { x: event.clientX - box.left - sheet.clientLeft, y: event.clientY - box.top - sheet.clientTop })
    }

    /** Forgets the press, and says whether it had become a drag the editor still holds. */
    function release(): boolean {
      const was = dragging.current && editor.state().drag?.via === 'pointer'
      pressed.current = null
      dragging.current = false
      return was
    }

    function onMove(event: PointerEvent): void {
      const press = pressed.current
      if (press === null) return
      if (!dragging.current) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_DISTANCE) return
        if (!editor.dispatch({ type: 'startDrag', subject: press.subject, via: 'pointer' }).ok) {
          pressed.current = null
          return
        }
        dragging.current = true
      }
      // Ended elsewhere -- Escape, or the subject deleted under it -- and not to be revived.
      if (editor.state().drag?.via !== 'pointer') {
        release()
        return
      }
      editor.dispatch({ type: 'updateDrag', over: over(event) })
    }

    function onUp(): void {
      if (!release()) return
      swallow.current = true
      // With nothing under the pointer the editor ends the drag and says nothing moved.
      if (editor.dispatch({ type: 'drop' }).ok) onPlaced.current()
    }

    function onCancel(): void {
      if (release()) editor.dispatch({ type: 'cancelDrag' })
    }

    // The click a drop ends in comes straight after the release, with no key
    // or press between. A drop that ended away from where it began ends in
    // no click on what it began on; a key or a new press then is the
    // person's next act, whose click is theirs to keep.
    function forget(): void {
      swallow.current = false
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', forget, true)
    window.addEventListener('pointerdown', forget, true)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', forget, true)
      window.removeEventListener('pointerdown', forget, true)
      // A drag in flight belongs to the builder that started it.
      if (release()) editor.dispatch({ type: 'cancelDrag' })
    }
  }, [editor])

  return {
    press(event, subject) {
      swallow.current = false
      if (event.button !== 0 || event.pointerType === 'touch') return
      pressed.current = { subject, x: event.clientX, y: event.clientY }
    },
    swallowClick() {
      const was = swallow.current
      swallow.current = false
      return was
    },
    row(element, node) {
      if (element !== null) rows.current.set(element, node)
    },
  }
}
