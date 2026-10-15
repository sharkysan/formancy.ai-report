// The whole editor: <report-builder [editor]="editor" />.
export { ReportBuilder } from './builder'

// The editor's root, for a host that arranges the parts itself, and the parts.
export { ReportEditorRoot } from './root'
export type { FocusAfter } from './root'
export { ReportCanvas } from './canvas'
export { ReportOutline } from './outline'
export { ReportPalette } from './palette'
export { ReportPlaces } from './places'
export { ReportProblems } from './problems'
export { ReportProperties } from './properties'
export { ReportStatus } from './status'
export { ReportToolbar } from './toolbar'

// An editor's state as a signal, for a host's own views of it.
export { injectEditorState } from './editor-state'
