/**
 * Copy-on-write edits to lists and objects: the vocabulary every command is
 * written in. Each returns a new list or object and leaves its input as it
 * was, so a command never writes to the report it was given.
 */
import { refuse } from './outcome.js'
import type { Place, Refusal } from './outcome.js'

/**
 * A change to some of an object's properties. A value sets a property;
 * `null` removes one that is optional. A required property cannot be given
 * `null`, so a patch cannot remove one.
 *
 * `null`, not `undefined`, because a patch is also data: a proposal carries
 * it as JSON, which has no undefined and drops a key that holds one. A
 * removal written with undefined would arrive as no change at all.
 */
export type Patch<T> = { readonly [K in keyof T]?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K] }

/**
 * `target` with `patch` applied: the properties it names set, or removed
 * where it gives `null`. A property given `undefined` -- possible only for a
 * caller tsc never saw -- is left as it is, as it would be once the patch
 * had been through JSON.
 */
export function patched<T extends object>(target: T, patch: Patch<T>): T {
  const next = { ...target } as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key]
    else if (value !== undefined) next[key] = value
  }
  return next as T
}

/** A refusal unless `index` is a whole number from 0 to `last`, inclusive. */
export function checkIndex(index: number, last: number, what: string, place: Place = {}): Refusal | undefined {
  if (Number.isInteger(index) && index >= 0 && index <= last) return undefined
  const range = last < 0 ? 'there is nothing to index' : `it is a whole number from 0 to ${last}`
  return refuse('index-out-of-range', `${String(index)} is not a position in ${what}: ${range}`, place)
}

export function insertedAt<T>(list: readonly T[], index: number, item: T): T[] {
  return [...list.slice(0, index), item, ...list.slice(index)]
}

export function removedAt<T>(list: readonly T[], index: number): T[] {
  return [...list.slice(0, index), ...list.slice(index + 1)]
}

export function replacedAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((existing, at) => (at === index ? item : existing))
}

/** The item at `from` moved so that it ends at `to`; the others keep their order. */
export function movedTo<T>(list: readonly T[], from: number, to: number): T[] {
  const item = list[from] as T
  return insertedAt(removedAt(list, from), to, item)
}
