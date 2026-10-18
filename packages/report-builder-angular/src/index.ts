// The whole editor: <report-builder [editor]="editor" />, and the template a host gives as its own view in the design view's place.
export { ReportBuilder } from './builder'
export { ReportHostView } from './host-view'

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
