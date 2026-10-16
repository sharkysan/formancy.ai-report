export { createReportEditor } from './editor.js'
export type { ReportEditor, ReportEditorOptions } from './editor.js'

export { EDITOR_PANELS, EDITOR_REFUSAL_CODES, HIDEABLE_PANELS, PROPERTY_KINDS, PROPERTY_ROLES } from './model.js'
export type {
  Announcement,
  Availability,
  Box,
  Canvas,
  CanvasBox,
  CanvasRegion,
  DiagnosticEntry,
  DocumentSummary,
  DragState,
  DragSubject,
  DropTarget,
  EditorAction,
  EditorActionType,
  EditorOutcome,
  EditorPanel,
  EditorRefusalCode,
  EditorState,
  HideablePanel,
  HistoryState,
  OutlineNode,
  OutlineRegion,
  PageGeometry,
  PaletteEntry,
  PartKind,
  PropertyField,
  PropertyKind,
  PropertyOption,
  PropertyPanel,
  RegionSummary,
  RulerTick,
  Selection,
  Size,
} from './model.js'

export { clampZoom, MAX_ZOOM, MIN_ZOOM, PX_PER_PT, zoomedIn, zoomedOut, ZOOM_STEPS } from './geometry.js'
export { targetBeside, targetNear } from './targets.js'
export { actionForKey } from './keys.js'
export type { KeyPress, KeyScope } from './keys.js'

// The editor's own words, in one catalogue both builders read.
export { contentLocale, EDITOR_LOCALES, EDITOR_TEXT, editorText, formatZoom } from './text.js'
export type { EditorLocale, EditorText, MessageId } from './text.js'

// What both builders render, and what report-builder.css dresses.
export { REPORT_ATTRIBUTES, REPORT_PARTS, WORKBENCH_CLASSES } from './parts.js'
export type { ReportPart } from './parts.js'

// What every native builder must pass, as data.
export { BUILDER_SCENARIOS, builderScenarios, SCENARIO_ACTIONS, SCENARIO_EXPECTATIONS, scenarioReport } from './scenarios.js'
export type { BuilderScenario, KeyModifier, ScenarioQuery, ScenarioStep } from './scenarios.js'
