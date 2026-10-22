/**
 * Formancy Report's formancy form bridge (0042): a report's data read from
 * a formancy form's submissions, against the exact form version that
 * collected each, as the host hands them over. No framework, no Node, no
 * network: the bridge fetches nothing.
 */
export { FORMS_ERROR_CODES, MAX_FORMS_ERRORS } from './errors.js'
export type { FormsError, FormsErrorCode } from './errors.js'
export { MAX_DOCUMENT_DEPTH } from './json.js'
export { KINDS } from './kinds.js'
export type { KindRule, Reading } from './kinds.js'
export { MAX_EXACT_DIGITS } from './numbers.js'
export { readSubmission, readSubmissions } from './read.js'
export type { ListedSubmission, OptionLabels, ReadOptions, SubmissionInput, SubmissionRead, SubmissionsInput } from './read.js'
