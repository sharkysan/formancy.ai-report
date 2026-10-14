/**
 * What a Formancy Report definition is, before anything about what it holds.
 *
 * A report is its own document, not a formancy form with pages added: it has
 * its own version line, independent of formancy's `specVersion`, of Formancy
 * Data's generated form spec and bindings versions, and of this package's npm
 * version. Package versions alone cannot say whether two documents are
 * compatible; this can.
 *
 * A message here quotes what the document holds, shortened: a version string
 * is the document's to choose, and a message that echoed it whole would grow
 * with it.
 */
import { quote } from './check.js'

/**
 * The format's name. A canonical hash of a report is taken over an envelope
 * that names it, so a report and a form whose JSON bodies happen to be equal
 * can never share a hash.
 */
export const REPORT_FORMAT = 'formancy-report'

/**
 * The version of the report definition this package reads. A string of
 * digits, as formancy writes `specVersion`.
 *
 * Version 0 is the draft: the format is being designed, and no document
 * written under it is promised to be read by a later release. The release
 * that first freezes the format makes it 1, and from then a frozen version
 * keeps its meaning.
 */
export const REPORT_SPEC_VERSION = '0'

/** Whether a document is a report of the version this package reads, and why not when it is not. */
export type SpecVersionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'not-a-report' | 'unsupported-version'; readonly message: string }

/** The field that holds a value, when `value` is an object that has it. */
function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined
}

/**
 * Whether `document` is a report definition of `REPORT_SPEC_VERSION`.
 *
 * Refuses rather than guesses. A document with no `reportSpecVersion` string
 * is not a report, and a formancy form -- the document most likely to arrive
 * here by mistake -- is named as one. A report of another version is refused,
 * never partly read: a field this version does not know could be the one that
 * hides a row or changes a total.
 */
export function checkSpecVersion(document: unknown): SpecVersionCheck {
  const version = field(document, 'reportSpecVersion')
  if (typeof version !== 'string') {
    const form = field(document, 'specVersion')
    const message =
      typeof form === 'string'
        ? `this is a formancy form (specVersion ${quote(form)}), not a report definition`
        : 'this is not a report definition: it has no reportSpecVersion string'
    return { ok: false, code: 'not-a-report', message }
  }
  if (version !== REPORT_SPEC_VERSION) {
    return { ok: false, code: 'unsupported-version', message: `reportSpecVersion ${quote(version)} is not one this package reads; it reads ${quote(REPORT_SPEC_VERSION)}` }
  }
  return { ok: true }
}
