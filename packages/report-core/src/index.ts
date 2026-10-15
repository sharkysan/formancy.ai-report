export { openReportSession, DEFAULT_HISTORY_LIMIT } from './session.js'
export type { EditOptions, ReportSession, SessionOpening, SessionOptions } from './session.js'
export { tryEdit } from './draft.js'
export type { Draft, Synchronous } from './draft.js'
export type { Mutable } from './snapshot.js'

export { REFUSAL_CODES } from './outcome.js'
export type { Command, CommandOutcome, Refusal, RefusalCode } from './outcome.js'
export type { Patch } from './lists.js'
export type { Location } from './tree.js'
export { locationOf, locations, validLocations } from './locations.js'

export { replaceDocument, setLocale, setPage, setTitle } from './commands/document.js'
export type { PagePatch } from './commands/document.js'
export {
  moveParameter,
  putAggregate,
  putAsset,
  putDataset,
  putField,
  putParameter,
  putStyle,
  removeAggregate,
  removeAsset,
  removeDataset,
  removeField,
  removeParameter,
  removeStyle,
} from './commands/declarations.js'
export { duplicateComponent, insertComponent, moveComponent, nextComponentId, removeComponent, updateComponent } from './commands/components.js'
export type { ComponentPatch } from './commands/components.js'
export {
  insertColumn,
  insertFooterRow,
  moveColumn,
  moveFooterRow,
  putFooterCell,
  removeColumn,
  removeFooterCell,
  removeFooterRow,
  setGroup,
  setSort,
  updateColumn,
  updateFooterRow,
} from './commands/table.js'
export type { FooterRows } from './commands/table.js'
export { ARGUMENTS, COMMANDS, describedCommand } from './commands/registry.js'
export type { CommandDescriptor, CommandName } from './commands/registry.js'

export { compileReport } from './expressions/compile-report.js'
export type { ReportCompilation } from './expressions/compile-report.js'
export type { CompiledExpression, ExpressionRead } from './expressions/compile-site.js'
export { expressionValues } from './expressions/values.js'
export type { ExpressionValues } from './expressions/values.js'
export { EXPRESSION_TYPES, SCOPE_NAMES } from './expressions/members.js'
export type { ExpressionMember, Members, ScopeName } from './expressions/members.js'
export { UNREPRODUCIBLE_FUNCTIONS } from './expressions/reproducible.js'
export type { UnreproducibleFunction } from './expressions/reproducible.js'
export { diagnose } from './diagnostics/diagnose.js'
export { DIAGNOSTIC_CODES, DIAGNOSTIC_SEVERITIES } from './diagnostics/codes.js'
export type { Diagnostic, DiagnosticCode, DiagnosticSeverity } from './diagnostics/codes.js'
export { expressionSites } from './diagnostics/parts.js'
export type { ExpressionSite } from './diagnostics/parts.js'
