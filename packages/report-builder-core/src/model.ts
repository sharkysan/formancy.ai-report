/**
 * What an editor's state is made of: the plain, deeply frozen data a
 * builder renders, and the actions it dispatches back.
 *
 * Nothing here is a framework's. React reads a state with
 * `useSyncExternalStore` and Angular sets a signal from it; what either
 * shows is this, computed once, so the two builders cannot offer different
 * choices for the same document (plan 21).
 *
 * The state is here; what it says of the design view is `model-canvas.ts`'s,
 * of the properties `model-properties.ts`'s, and what a builder dispatches,
 * and is told back, `model-actions.ts`'s: each its own reason to change.
 */
import type { Location } from '@formancy/report-core'
import type { DiagnosticCode, DiagnosticSeverity } from '@formancy/report-core'
import type { Component, ComponentKind, RegionName } from '@formancy/report-spec'
import type { ImageLibrary } from './image-store.js'
import type { Box, Canvas, PageGeometry } from './model-canvas.js'
import type { PropertyPanel } from './model-properties.js'
import type { EditorLocale } from './text.js'

/**
 * The parts a report holds at its own level, in no region, that an editor
 * selects and edits as it does a component: its payment part, the Swiss
 * QR-bill at the foot of its last page (0022, 0039), and its e-invoice, the
 * EN 16931 invoice its XML holds (0027, 0038, 0044).
 */
export const REPORT_LEVEL_PARTS = ['paymentPart', 'eInvoice'] as const
export type ReportLevelPart = (typeof REPORT_LEVEL_PARTS)[number]

/** A component, or one column of a table, named by the table's id and the column's. */
export interface ComponentSelection {
  readonly id: string
  readonly column?: string
}

/** What is selected: a component or a table's column, or a part of the report's own level. */
export type Selection = ComponentSelection | { readonly part: ReportLevelPart }

/** What an outline row or a canvas box stands for: a component of a kind, or a table's column. */
export type PartKind = ComponentKind | 'tableColumn'

export interface RegionSummary {
  readonly region: RegionName
  readonly label: string
  /** Components in the region, counting those inside containers. */
  readonly count: number
}

export interface DocumentSummary {
  readonly id: string
  readonly title: string
  readonly locale: string
  readonly page: PageGeometry
  readonly regions: readonly RegionSummary[]
}

/** One row of the outline: a component, or a table's column, and what it holds. */
export interface OutlineNode {
  /** Unique in the report: the component's id, or `<table id>/<column id>`. */
  readonly key: string
  /** The component's id; for a column, its table's. */
  readonly id: string
  /** The column's id, for a table's column. */
  readonly column?: string
  readonly kind: PartKind
  /** What a person calls it: unique among the outline's labels, so it can be an accessible name. */
  readonly label: string
  /** 0 at a region's top level. `aria-level` is one more. */
  readonly depth: number
  /** For a component inside a columns block, which column it stands in, from 0. */
  readonly slot?: number
  readonly selected: boolean
  /** Diagnostics about it, errors and warnings together. */
  readonly problems: number
  /** The worst of those diagnostics, when there are any: what colour its count is drawn in. */
  readonly severity?: DiagnosticSeverity
  /**
   * Wider than the space it stands in, as its canvas box is marked: said on
   * the row too, so a keyboard learns what a pointer resting on the box does.
   */
  readonly overflows: boolean
  readonly children: readonly OutlineNode[]
}

export interface OutlineRegion {
  readonly region: RegionName
  readonly label: string
  readonly nodes: readonly OutlineNode[]
}

/**
 * A row of the outline for a part of the report's own level, after the
 * regions' groups, at the tree's top: the payment part, which prints after
 * every region, at the foot of the last page, and the e-invoice, which
 * prints nothing of its own and is written as the XML.
 */
export interface OutlinePart {
  readonly part: ReportLevelPart
  /** Unique in the outline: no component's id holds a capital, nor a column's key. */
  readonly key: string
  /** What a person calls it: the payment part as SIX names it, "Payment part"; the e-invoice, "E-invoice". */
  readonly label: string
  readonly selected: boolean
  /** Diagnostics about it, errors and warnings together. */
  readonly problems: number
  /** The worst of those diagnostics, when there are any. */
  readonly severity?: DiagnosticSeverity
}

/** What the palette offers: a kind, and the component inserting it would put in, or why there is none. */
export interface PaletteEntry {
  readonly kind: ComponentKind
  readonly label: string
  /** The default component, with an id `nextComponentId` gave; null when the report lacks what one needs. */
  readonly component: Component | null
  /** Why there is no component: what the report has to declare first. */
  readonly unavailable?: string
}

/** A diagnostic as the editor lists it, linked to what it is about. */
export interface DiagnosticEntry {
  /**
   * Which diagnostic this is, unique in the list and the same while it is
   * listed: its code, where it points and, in an expression, which
   * characters. A builder keys the entry's element by it, so a problem
   * listed before another leaves the other's element, and the keyboard on
   * it, where they were.
   */
  readonly key: string
  readonly severity: DiagnosticSeverity
  readonly code: DiagnosticCode
  /** report-core's sentence, in the author's terms. */
  readonly message: string
  /** What it is about: a component's outline label, or the report. */
  readonly where: string
  /** The accessible name of the entry: "Error: Introduction". */
  readonly label: string
  /** What activating it selects; null for a diagnostic about the report as a whole. */
  readonly target: Selection | null
}

export interface HistoryState {
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** The step undo would take back, in the editor's language when this package labelled it. */
  readonly undoLabel: string | null
  readonly redoLabel: string | null
}

/** What is being placed: a new component of a kind, or an existing component by id. */
export type DragSubject = { readonly kind: ComponentKind } | { readonly id: string }

/** A place the subject being dragged may go, as the validator accepts it. */
export interface DropTarget {
  /** Its position in `dropTargets`, which `updateDrag` takes. */
  readonly index: number
  readonly location: Location
  /** "Body, after Introduction": what a screen reader says and a keyboard chooses by. */
  readonly label: string
  /** The component it lands right after, when there is one. */
  readonly afterId?: string
  /** The component it lands right before, when there is one. */
  readonly beforeId?: string
  /** Where its indicator is drawn on the canvas. */
  readonly pt: Box
  readonly px: Box
}

export interface DragState {
  readonly subject: DragSubject
  /** 'pointer' while a pointer drags; 'keyboard' while a person chooses a place from a list. */
  readonly via: 'pointer' | 'keyboard'
  /** The target the pointer is over, by its index, or null. */
  readonly over: number | null
  /** "Insert Text: choose a place": the heading of the list a keyboard chooses from. */
  readonly title: string
  /** Said when no place takes the subject; absent otherwise. */
  readonly nowhere?: string
}

/**
 * Which actions have somewhere to go: those about the selection, judged
 * from its place alone -- the validator still has the last word -- and the
 * zoom's, judged from its range. A builder marks the others unavailable,
 * and still sends them, so the editor says why nothing happened.
 */
export interface Availability {
  readonly delete: boolean
  readonly duplicate: boolean
  readonly moveUp: boolean
  readonly moveDown: boolean
  readonly indent: boolean
  readonly outdent: boolean
  readonly moveTo: boolean
  /** Below `MAX_ZOOM`, with the design view drawn: the zoom is its. */
  readonly zoomIn: boolean
  /** Above `MIN_ZOOM`, with the design view drawn. */
  readonly zoomOut: boolean
  /** At any zoom but 100 %, with the design view drawn. */
  readonly zoomReset: boolean
  /** With a store the host gave, no image being added, and room in the report for another. */
  readonly addImage: boolean
}

export const EDITOR_PANELS = ['outline', 'canvas', 'properties', 'diagnostics'] as const
/** Which pane a narrow layout shows. A wide one shows every pane not hidden and ignores it. */
export type EditorPanel = (typeof EDITOR_PANELS)[number]

/** The panes a person may hide to give the design view their room: every one but the design view. */
export const HIDEABLE_PANELS = ['outline', 'properties', 'diagnostics'] as const satisfies readonly EditorPanel[]
export type HideablePanel = (typeof HIDEABLE_PANELS)[number]

/**
 * Where a host's view stands: in the design view's place, which a builder
 * draws it in, or beside the builder, where the host draws it itself.
 */
export const HOST_VIEW_PLACES = ['middle', 'beside'] as const
export type HostViewPlace = (typeof HOST_VIEW_PLACES)[number]

/**
 * A view of the host's own -- the Studio's PDF preview -- as the editor
 * holds it: its name, whether the person has it shown, and where the host
 * says there is room for it. One person's view, like the hidden panes:
 * never the report's.
 */
export interface HostView {
  /** In the host's words: a builder names the region it draws the view in by it. */
  readonly name: string
  readonly shown: boolean
  readonly place: HostViewPlace
}

/** The latest announcement for the builder's live region; `sequence` counts them, so saying the same twice is still two. */
export interface Announcement {
  readonly text: string
  readonly sequence: number
}

export interface EditorState {
  readonly locale: EditorLocale
  /** The session's revision this state was built from. */
  readonly revision: number
  readonly zoom: number
  /** The zoom as the person's language writes a percentage. */
  readonly zoomLabel: string
  readonly document: DocumentSummary
  readonly selection: Selection | null
  readonly outline: readonly OutlineRegion[]
  /** The outline's rows for the parts of the report's own level, after its regions: its payment part, where it has one. */
  readonly outlineParts: readonly OutlinePart[]
  readonly palette: readonly PaletteEntry[]
  /** The report's images, and whether a builder offers Add image… (0033). */
  readonly images: ImageLibrary
  readonly properties: PropertyPanel
  readonly canvas: Canvas
  readonly diagnostics: readonly DiagnosticEntry[]
  readonly history: HistoryState
  readonly drag: DragState | null
  /** Where the subject being dragged may go; empty when nothing is. */
  readonly dropTargets: readonly DropTarget[]
  readonly can: Availability
  readonly panel: EditorPanel
  /**
   * The panes the person hid, in the order they stand in. A builder draws
   * none of them; opening one shows it again. Never `panel`, so a narrow
   * layout always has its pane.
   */
  readonly hidden: readonly HideablePanel[]
  /** The host's view, for an editor made with one: the same object until it changes. */
  readonly hostView: HostView | null
  /**
   * What the middle pane shows: the design view, or the host's view while
   * it is shown in the design view's place. Decided here, so neither
   * builder works it out from `hostView` again.
   */
  readonly view: 'design' | 'host'
  readonly status: Announcement
}
