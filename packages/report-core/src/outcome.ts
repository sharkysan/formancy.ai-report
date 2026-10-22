/**
 * What a command gives back: the next report, or the reason there is none.
 *
 * A command is a pure function from a report to an outcome. It never writes
 * to the report it is given, and it refuses -- returns, never throws -- when
 * its own preconditions do not hold: the thing it names exists, the place it
 * names is a place, the kind it was told to expect is the kind there.
 * Whether the result is a valid report is not the command's question; the
 * session asks the validator, once, for every command alike
 * ([0008](../../../docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
 */
import type { ReportDefinition, ReportError } from '@formancy/report-spec'

/**
 * Why an edit was refused, as stable codes. A code is for a program -- the
 * builder decides what to say and where -- and the message is for a person.
 * As with the validator's codes, a code is never reworded once released; a
 * new reason gets a new code. Each has a case in `outcome.test.ts` that is
 * refused with it, which does not compile while one is missing.
 */
export const REFUSAL_CODES = [
  /** The component, declaration, column, footer row or cell the command names does not exist. */
  'not-found',
  /** The parent a location names holds no components: a text, a table, an image. */
  'not-a-container',
  /** A location that contradicts itself: a column outside a columns block, none inside one, or a parent in another region. */
  'invalid-location',
  /** An index that is not a whole number within the list it indexes. */
  'index-out-of-range',
  /** A component moved into itself or into something it holds. */
  'into-itself',
  /** The component a command names is not of the kind the command is for. */
  'kind-mismatch',
  /** A patch that would change what identifies a thing: a component's id or kind, a column's id. */
  'immutable-property',
  /** An add under an id the report already declares: an add never replaces, as a put does. */
  'already-declared',
  /** A command descriptor whose command is not one this package has. */
  'unknown-command',
  /** A command descriptor whose arguments are too few, too many or of the wrong type -- one read from JSON was never type-checked. */
  'invalid-arguments',
  /** The result is not a valid report; `errors` holds the validator's reasons. */
  'invalid-document',
  /** An edit made against a document that is no longer the session's: its hash is not the one the edit expected. */
  'stale-document',
  /** A value the command would write where the report reads it from the data: an account the e-invoice and its payment codes share, one of them bound (0044). */
  'read-from-data',
  /** A field the payment part or the e-invoice reads, directly or through an aggregate, named to a command that removes what reads it: only their own commands change them (0039, 0048). */
  'read-by-part',
] as const

export type RefusalCode = (typeof REFUSAL_CODES)[number]

export interface Refusal {
  readonly ok: false
  readonly code: RefusalCode
  readonly message: string
  /** A JSON Pointer to what the refusal is about, when it is about one place. */
  readonly path?: string
  /** The component the refusal is about, when it is about one. */
  readonly componentId?: string
  /** The validator's errors, for `invalid-document`. */
  readonly errors?: readonly ReportError[]
}

/** The next report, and whatever else the command says about it (a duplicate's new id), or a refusal. */
export type CommandOutcome<E extends object = object> = ({ readonly ok: true; readonly report: ReportDefinition } & Readonly<E>) | Refusal

/** An edit, bound to its arguments: what the session applies. */
export type Command<E extends object = object> = (report: ReportDefinition) => CommandOutcome<E>

/** Where a refusal points. */
export interface Place {
  readonly path?: string | undefined
  readonly componentId?: string | undefined
}

export function refuse(code: RefusalCode, message: string, place: Place = {}): Refusal {
  return {
    ok: false,
    code,
    message,
    ...(place.path === undefined ? {} : { path: place.path }),
    ...(place.componentId === undefined ? {} : { componentId: place.componentId }),
  }
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false
}

/** A name as a message quotes it: at most 40 characters, so no message grows with what a caller passed. */
export function quote(text: string): string {
  return JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}...` : text)
}
