/**
 * What an editor's state is made of: the plain, deeply frozen data a
 * builder renders, and the actions it dispatches back.
 *
 * Nothing here is a framework's. React reads a state with
 * `useSyncExternalStore` and Angular sets a signal from it; what either
 * shows is this, computed once, so the two builders cannot offer different
 * choices for the same document (plan 21).
 */
import type { Location, Refusal } from '@formancy/report-core'
import type { DiagnosticCode, DiagnosticSeverity } from '@formancy/report-core'
import type { Component, ComponentKind, Margins, Orientation, PageSizeName, RegionName } from '@formancy/report-spec'
import type { ImageLibrary } from './image-store.js'
import type { EditorLocale } from './text.js'

/** What is selected: a component, or one column of a table, named by the table's id and the column's. */
export interface Selection {
  readonly id: string
  readonly column?: string
}

/** What an outline row or a canvas box stands for: a component of a kind, or a table's column. */
export type PartKind = ComponentKind | 'tableColumn'

/** A rectangle: in points on the page, or in CSS pixels at the editor's zoom. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

/** The page as the report sets it, in points, and as the canvas draws it, in CSS pixels at the zoom. */
export interface PageGeometry {
  readonly size: PageSizeName
  readonly orientation: Orientation
  /** Points. */
  readonly width: number
  /** Points. */
  readonly height: number
  /** Points. */
  readonly margins: Margins
  /** Points: what the margins leave. */
  readonly printable: Size
  /** CSS pixels at the editor's zoom. */
  readonly px: Size & { readonly margins: Margins }
}

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

/** What the palette offers: a kind, and the component inserting it would put in, or why there is none. */
export interface PaletteEntry {
  readonly kind: ComponentKind
  readonly label: string
  /** The default component, with an id `nextComponentId` gave; null when the report lacks what one needs. */
  readonly component: Component | null
  /** Why there is no component: what the report has to declare first. */
  readonly unavailable?: string
}

export const PROPERTY_KINDS = ['text', 'multiline', 'number', 'length', 'select', 'boolean', 'color', 'expression', 'binding', 'style'] as const
/**
 * How a property is edited. A `length` is stored in points and edited in
 * millimetres; a `number` is edited as it is stored. `select`, `binding`
 * and `style` choose one of their options.
 */
export type PropertyKind = (typeof PROPERTY_KINDS)[number]

/**
 * The role the native control for each kind has: what a builder renders,
 * and what a test finds it by. A length and a number are `<input
 * type="number">`; a select, a binding and a style a `<select>`; a boolean
 * a checkbox; the rest text inputs or a textarea.
 */
export const PROPERTY_ROLES = {
  text: 'textbox',
  multiline: 'textbox',
  number: 'spinbutton',
  length: 'spinbutton',
  select: 'combobox',
  boolean: 'checkbox',
  color: 'textbox',
  expression: 'textbox',
  binding: 'combobox',
  style: 'combobox',
} as const satisfies { readonly [K in PropertyKind]: string }

export interface PropertyOption {
  /** What `setProperty` takes for this option. */
  readonly value: string
  readonly label: string
}

/** One property of the selection, as an editor shows it. */
export interface PropertyField {
  /** A JSON Pointer from the selection -- the component, the column or the report -- to the property. */
  readonly key: string
  /** The accessible name, with its unit where it has one: "Height (mm)". */
  readonly label: string
  readonly kind: PropertyKind
  /**
   * What the control shows: a string for every kind but `boolean`. A number
   * or length is written with a point, as `<input type="number">` takes it.
   * After a refused edit, what the person typed.
   */
  readonly value: string | boolean
  readonly options?: readonly PropertyOption[]
  /** What an empty field means, where it means something: "Empty: fills the rest". */
  readonly placeholder?: string
  /** Whether the property must have a value; an optional one is removed by emptying it. */
  readonly required: boolean
  /** Why the last value given was refused, or the diagnostic about what is there now. */
  readonly error?: string
}

export interface PropertyPanel {
  /** "Text: Introduction", or "Report" when nothing is selected. */
  readonly heading: string
  readonly fields: readonly PropertyField[]
}

/** A component's or a column's box on the canvas. */
export interface CanvasBox {
  readonly key: string
  readonly id: string
  readonly column?: string
  readonly kind: PartKind
  readonly label: string
  readonly depth: number
  readonly selected: boolean
  readonly problems: number
  /** The worst diagnostic about it, when there is one. */
  readonly severity?: DiagnosticSeverity
  /** Wider than the space it stands in: the layout will have to say what happens to it. */
  readonly overflows: boolean
  readonly pt: Box
  readonly px: Box
}

export interface CanvasRegion {
  readonly region: RegionName
  readonly label: string
  readonly empty: boolean
  readonly pt: Box
  readonly px: Box
}

/**
 * Where a report's payment part prints: a Swiss QR-bill's slip, the receipt
 * and the payment part, across the foot of the report's last page. Drawn as
 * a band the slip's size at the sheet's foot, below every region, and named
 * as SIX names the part. The slip itself is the renderer's to draw.
 */
export interface CanvasPaymentPart {
  readonly label: string
  readonly pt: Box
  readonly px: Box
}

export interface RulerTick {
  /** CSS pixels from the sheet's edge. */
  readonly at: number
  readonly mm: number
  readonly major: boolean
  readonly label?: string
}

/**
 * The design view: one sheet as wide as the page, the regions stacked on it
 * as bands, each component's flow box inside its band, and a payment part's
 * band at the sheet's foot. A design-mode
 * approximation for selecting and placing things -- text measured by a rule
 * of thumb, a table as one row of each kind -- and never the PDF, which the
 * renderer lays out (plan 8).
 */
export interface Canvas {
  /** The canvas's accessible name, which says it is not the PDF. */
  readonly label: string
  /** The sentence shown with it, saying the same to a sighted reader. */
  readonly note: string
  /** CSS pixels per point at this zoom. */
  readonly scale: number
  readonly sheet: { readonly pt: Box; readonly px: Box }
  readonly regions: readonly CanvasRegion[]
  /** The payment part's band, for a report that has one; null for one that has none. */
  readonly paymentPart: CanvasPaymentPart | null
  readonly boxes: readonly CanvasBox[]
  readonly rulers: { readonly horizontal: readonly RulerTick[]; readonly vertical: readonly RulerTick[] }
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

/** What a builder asks of the editor. Every pointer gesture has one a keyboard reaches too. */
export type EditorAction =
  | { readonly type: 'select'; readonly id: string | null; readonly column?: string }
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

export type EditorActionType = EditorAction['type']

/** Why an action did nothing, as stable codes; the message, in the editor's language, is for a person. */
export const EDITOR_REFUSAL_CODES = [
  /** The editor was disposed. */
  'disposed',
  /** The action is about the selection, and nothing is selected. */
  'nothing-selected',
  /** The component, column or target the action names is not there. */
  'not-found',
  /** First or last already: a move up, a move down, an indent or an outdent with nowhere to go, or a step out of a top-level row or into one that holds nothing. */
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
   * store to keep it or no room in the report for it; and Remove, for an
   * image something draws.
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

export type EditorOutcome = { readonly ok: true } | { readonly ok: false; readonly code: EditorRefusalCode; readonly message: string; readonly refusal?: Refusal }
