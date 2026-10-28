import type { ServerRefusal } from './wire.js'

/**
 * What every use case returns: the answer it gives, with the status the
 * route sends it under, or the refusal it gives, with its status. A route
 * is an adapter over a use case and decides nothing of its own, so the
 * status is the use case's -- the one place a code and its status meet.
 *
 * `revision` is the draft's revision where the answer has one, for the
 * route to send as the `ETag` the next `If-Match` names. It is beside the
 * body and not only in it, because an image's body has none.
 */
export type Answer<T> = { readonly ok: true; readonly status: 200 | 201; readonly body: T; readonly revision?: number }

/**
 * A use case's refusal. Its body is a `ServerRefusal`, so that the four
 * refusals that carry a field cannot be given without it.
 */
export type RefusalAnswer = {
  readonly ok: false
  readonly status: 400 | 403 | 404 | 412 | 413 | 415 | 422 | 428
  readonly body: ServerRefusal
  readonly revision?: number
}

/** A use case's answer, with `revision` only where there is one. */
export function answer<T>(status: Answer<T>['status'], body: T, revision?: number): Answer<T> {
  return revision === undefined ? { ok: true, status, body } : { ok: true, status, body, revision }
}

/** A use case's refusal, with `revision` only where a revision stands that the route's `ETag` names. */
export function refuse(status: RefusalAnswer['status'], body: ServerRefusal, revision?: number): RefusalAnswer {
  return revision === undefined ? { ok: false, status, body } : { ok: false, status, body, revision }
}
