/**
 * What a builder asks of the editor, and what it is told back: every
 * action, the stable codes a refusal gives, and the outcome. Apart from
 * `model.ts`'s state because actions change for reasons of their own.
 */
import type { Location, Refusal } from '@formancy/report-core'
import type { ComponentKind } from '@formancy/report-spec'
import type { DragSubject, EditorPanel, HideablePanel, HostViewPlace, ReportLevelPart } from './model.js'

/** What a builder asks of the editor. Every pointer gesture has one a keyboard reaches too. */
export type EditorAction =
  | { readonly type: 'select'; readonly id: string | null; readonly column?: string }
  /** Selects a part of the report's own level: its outline row, or its band on the canvas. */
  | { readonly type: 'select'; readonly part: ReportLevelPart }
  | { readonly type: 'selectNext' }
  | { readonly type: 'selectPrevious' }
  | { readonly type: 'selectFirst' }
  | { readonly type: 'selectLast' }
  /** The container the selection stands in, or a column's table: ArrowLeft in the outline. */
  | { readonly type: 'selectParent' }
  /** The first thing the selection holds: ArrowRight in the outline. */
  | { readonly type: 'selectChild' }
  | { readonly type: 'moveUp' }
  | { readonly type: 'moveDown' }
  | { readonly type: 'indent' }
  | { readonly type: 'outdent' }
  | { readonly type: 'delete' }
  | { readonly type: 'duplicate' }
  | { readonly type: 'insert'; readonly kind: ComponentKind; readonly target: Location }
  | { readonly type: 'move'; readonly id: string; readonly target: Location }
  | { readonly type: 'setProperty'; readonly key: string; readonly value: string | boolean }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'setZoom'; readonly zoom: number }
  | { readonly type: 'zoomIn' }
  | { readonly type: 'zoomOut' }
  | { readonly type: 'startDrag'; readonly subject: DragSubject; readonly via?: 'pointer' | 'keyboard' }
  | { readonly type: 'updateDrag'; readonly over: number | null }
  | { readonly type: 'drop' }
  | { readonly type: 'cancelDrag' }
  /**
   * Shows the pane: the one a narrow layout shows, and one that was hidden
   * drawn again. The design view's takes its place back from a host's view
   * shown there.
   */
  | { readonly type: 'openPanel'; readonly panel: EditorPanel }
  | { readonly type: 'hidePanel'; readonly panel: HideablePanel }
  /** Shows the host's view: in the middle it takes the design view's place, and is the pane a narrow layout shows. */
  | { readonly type: 'showHostView' }
  | { readonly type: 'hideHostView' }
  /** Where the host's view stands: the host's to say, from the room it has. */
  | { readonly type: 'placeHostView'; readonly place: HostViewPlace }
  /**
   * Sent by Add image… before a builder opens its file chooser, in the same
   * activation: refused, and said why, when the editor would take no file
   * now. The file chosen goes to `addImage`, which is no action, because
   * reading it and the host keeping it take time.
   */
  | { readonly type: 'chooseImage' }
  /** Removes an image the report declares and nothing draws, in one undo step. */
  | { readonly type: 'removeImage'; readonly asset: string }
  /** Adds a part of the report's own level that it lacks, from example values, in one undo step, and selects it: a QR-bill, SIX's example (0039). */
  | { readonly type: 'addPart'; readonly part: ReportLevelPart }
  /** Adds the optional group of fields at `key` of what is selected, from example values, in one undo step: a bill's debtor. */
  | { readonly type: 'addGroup'; readonly key: string }
  /** Removes the optional group at `key` of what is selected, in one undo step. */
  | { readonly type: 'removeGroup'; readonly key: string }
  /** Adds an item to the end of the list at `key` of what is selected, from example values, in one undo step: an e-invoice's VAT category (0044). */
  | { readonly type: 'addItem'; readonly key: string }
  /** Removes the item at `key` -- the list's pointer and its index, "/vat/1" -- in one undo step. */
  | { readonly type: 'removeItem'; readonly key: string }
  /** Moves the item at `key` to the position `to` of its list, in one undo step. */
  | { readonly type: 'moveItem'; readonly key: string; readonly to: number }

export type EditorActionType = EditorAction['type']

/** Why an action did nothing, as stable codes; the message, in the editor's language, is for a person. */
export const EDITOR_REFUSAL_CODES = [
  /** The editor was disposed. */
  'disposed',
  /** The action is about the selection, and nothing is selected. */
  'nothing-selected',
  /** The component, column or target the action names is not there. */
  'not-found',
  /** First or last already: a move up, a move down, an indent or an outdent with nowhere to go, or a step out of a top-level row or into one that holds nothing; any move or copy of a part of the report's own level, which has one place; and an item of a list moved past either end. */
  'at-edge',
  /** A value the property cannot take, refused before the report was touched: a number that is not one. */
  'invalid-value',
  /** report-core refused the edit; `refusal` is its reason, the validator's errors included. */
  'refused',
  /** A drag action while nothing is being dragged. */
  'not-dragging',
  /** A drop with no target under the pointer. */
  'no-target',
  /**
   * What the state marks unavailable, sent anyway: a kind whose default
   * component the report cannot hold yet, an image with no image to draw; a
   * host's view, asked of an editor made without one; the zoom, while a
   * host's view stands in the design view's place; an image to add, with no
   * store to keep it or no room in the report for it; Remove, for an
   * image something draws; a part the report has already, added, and an
   * e-invoice, which is edited and never made from nothing (0044); and a
   * group's Add or Remove with nothing to do.
   */
  'unavailable',
  /** Undo or redo with no step to take. */
  'no-history',
  /** An image to add while another is being added. */
  'busy',
  /** A file that is not an image the report prints, or past a limit, or of a kind the host does not keep: the report unchanged. */
  'not-an-image',
  /** The host refused to keep the image, or failed to: the report unchanged. */
  'not-kept',
  /** While the host kept the image, the report came to declare another under its id, which an add never replaces. */
  'changed',
] as const

export type EditorRefusalCode = (typeof EDITOR_REFUSAL_CODES)[number]

export type EditorOutcome =
  { readonly ok: true } | { readonly ok: false; readonly code: EditorRefusalCode; readonly message: string; readonly refusal?: Refusal }

/** The outcome of an action that did what it was asked: one frozen object, the editor's and each of its parts'. */
export const DONE: EditorOutcome = Object.freeze({ ok: true })
