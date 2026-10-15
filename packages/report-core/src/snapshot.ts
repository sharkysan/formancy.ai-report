/**
 * Snapshots: the frozen documents a session holds, and the mutable copies
 * it hands out.
 */

/** A deeply mutable copy of a readonly type: what `exportDocument` returns. */
export type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The id an item of a list is known by, when it has one: a component's, a table column's, a declaration's. */
function idOf(item: unknown): string | undefined {
  return isRecord(item) && typeof item.id === 'string' ? item.id : undefined
}

/**
 * What each item of `next` is compared with: the item of `before` with the
 * same id, so an insert, a remove or a move does not make everything after
 * it look changed; otherwise the item at the same position, for items that
 * have no id -- a column slot, a footer row, a cell, an inline run.
 */
function counterparts(next: readonly unknown[], before: readonly unknown[]): unknown[] {
  const byId = new Map<string, unknown>()
  for (const item of before) {
    const id = idOf(item)
    if (id !== undefined && !byId.has(id)) byId.set(id, item)
  }
  return next.map((item, index) => {
    const id = idOf(item)
    return id !== undefined && byId.has(id) ? byId.get(id) : before[index]
  })
}

function settle(next: unknown, previous: unknown): unknown {
  if (typeof next !== 'object' || next === null) return next
  if (Array.isArray(next)) {
    const before: readonly unknown[] = Array.isArray(previous) ? previous : []
    const compared = counterparts(next, before)
    const items = next.map((item: unknown, index) => settle(item, compared[index]))
    const same = Array.isArray(previous) && before.length === items.length && items.every((item, index) => item === before[index])
    return same ? previous : Object.freeze(items)
  }
  const before = isRecord(previous) ? previous : undefined
  const entries = Object.keys(next).map((key) => [key, settle((next as Record<string, unknown>)[key], before?.[key])] as const)
  const same = before !== undefined && Object.keys(before).length === entries.length && entries.every(([key, value]) => Object.hasOwn(before, key) && before[key] === value)
  return same ? previous : Object.freeze(Object.fromEntries(entries))
}

/**
 * `next` as a deeply frozen snapshot that shares every subtree equal to its
 * counterpart in `previous`, itself a snapshot this made, or is `previous`
 * itself when the two are equal. An object's counterpart is the value under
 * the same key; a list item's is the item with the same id in the same list,
 * or the one at the same position when it has no id. Key order does not
 * count, as it does not in the canonical hash.
 *
 * So an edit leaves every component, column and declaration it did not
 * change as it was, wherever an insert, a remove or a move within its list
 * shifted it. A component moved into another list is compared with what
 * stood at its new position there, and is usually a new object.
 *
 * Built new, never by freezing `next` in place, so nothing a caller still
 * holds becomes frozen under it, and a caller's later write cannot reach
 * the snapshot. The sharing is what makes a history of whole-document
 * snapshots cost what its edits changed, and what lets a builder keep a
 * component's rendering while that component's object is the same.
 */
export function settled<T>(next: T, previous: unknown): T {
  return settle(next, previous) as T
}

/** A deep, mutable copy of JSON data. A snapshot is JSON by construction: the validator read it. */
export function thawed<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>
}
