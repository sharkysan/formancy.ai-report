/**
 * Formancy Report's formancy form bridge: a report's data read from a
 * formancy form's submissions, against the exact form version that
 * collected each, as the host hands them over (0042), and a report
 * generated from a form version, a first draft whose notes list what it
 * left out (0045). No framework, no Node, no network: the bridge fetches
 * nothing.
 */
export { FORMS_ERROR_CODES, MAX_FORMS_ERRORS } from './errors.js'
export type { FormsError, FormsErrorCode } from './errors.js'
export { generateReport } from './generate.js'
export type { Generated, GenerateNote, GenerateOptions, NoteCode } from './generate.js'
export { MAX_DOCUMENT_DEPTH } from './json.js'
export { KINDS } from './kinds.js'
export type { KindRule, Reading } from './kinds.js'
export { NOTE_CODES } from './notes.js'
export { MAX_EXACT_DIGITS } from './numbers.js'
export { readSubmission, readSubmissions } from './read.js'
export type { ListedSubmission, OptionLabels, ReadOptions, SubmissionInput, SubmissionRead, SubmissionsInput } from './read.js'
