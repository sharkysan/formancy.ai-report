export { createReportEditor } from './editor.js'
export type { ReportEditor, ReportEditorOptions } from './editor.js'
export type { HostViewOptions } from './views.js'

export { EDITOR_PANELS, HIDEABLE_PANELS, HOST_VIEW_PLACES, REPORT_LEVEL_PARTS } from './model.js'
export { EDITOR_REFUSAL_CODES } from './model-actions.js'
export { PROPERTY_KINDS, PROPERTY_ROLES } from './model-properties.js'
export type {
  Announcement,
  Availability,
  ComponentSelection,
  DiagnosticEntry,
  DocumentSummary,
  DragState,
  DragSubject,
  DropTarget,
  EditorPanel,
  EditorState,
  HideablePanel,
  HistoryState,
  HostView,
  HostViewPlace,
  OutlineNode,
  OutlinePart,
  OutlineRegion,
  PaletteEntry,
  PartKind,
  RegionSummary,
  ReportLevelPart,
  Selection,
} from './model.js'
export type { EditorAction, EditorActionType, EditorOutcome, EditorRefusalCode } from './model-actions.js'
export type { Box, Canvas, CanvasBox, CanvasPaymentPart, CanvasRegion, PageGeometry, RulerTick, Size } from './model-canvas.js'
export type { PropertyAction, PropertyField, PropertyGroup, PropertyKind, PropertyOption, PropertyPanel, PropertyRow } from './model-properties.js'

// Where a host keeps the images a person adds, and the report's images as the state lists them (0033).
export type { AddedImage, ImageFile, ImageLibrary, ImageStore, KeptImage, LibraryAsset } from './image-store.js'

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
export { BUILDER_SCENARIOS, builderScenarios } from './scenarios.js'
export { SCENARIO_ACTIONS, SCENARIO_EXPECTATIONS } from './scenario-steps.js'
export type { BuilderScenario, HostViewAction, KeyModifier, ScenarioFile, ScenarioHost, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
export { scenarioReport } from './scenario-report.js'
export { SCENARIO_PNG, SCENARIO_PNG_DIGEST, SCENARIO_REFUSAL, scenarioStore } from './scenario-images.js'
export type { ScenarioStore } from './scenario-images.js'
