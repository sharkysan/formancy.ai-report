import type { DraftVersion, ServerRefusal } from './wire.js'

/**
 * What every use case returns: the answer it gives, with the status the
 * route sends it under, or the refusal it gives, with its status. A route
 * is an adapter over a use case and decides nothing of its own, so the
 * status is the use case's -- the one place a code and its status meet.
 *
 * `version` is the draft's version where the answer has one, for the route
 * to send as the `ETag` the next `If-Match` names. It is beside the body
 * and not only in it, because an image's body has none.
 */
export type Answer<T> = { readonly ok: true; readonly status: 200 | 201; readonly body: T; readonly version?: DraftVersion }

/**
 * A use case's refusal. Its body is a `ServerRefusal`, so that the four
 * refusals that carry a field cannot be given without it. It carries no
 * version, so the route sends no `ETag` with it: a tag comes only with the
 * draft it names, and a client that sent back a refusal's tag would save
 * over a draft it never read (0049). `draft-changed` names the revision
 * that stands in its body instead.
 */
export type RefusalAnswer = {
  readonly ok: false
  readonly status: 400 | 403 | 404 | 412 | 413 | 415 | 422 | 428
  readonly body: ServerRefusal
}

/** A use case's answer, with `version` only where there is one. */
export function answer<T>(status: Answer<T>['status'], body: T, version?: DraftVersion): Answer<T> {
  return version === undefined ? { ok: true, status, body } : { ok: true, status, body, version }
}

/** A use case's refusal. */
export function refuse(status: RefusalAnswer['status'], body: ServerRefusal): RefusalAnswer {
  return { ok: false, status, body }
}
