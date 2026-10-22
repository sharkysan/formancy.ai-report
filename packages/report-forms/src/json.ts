/**
 * Reading what a host hands over, once, without running any of it (0042).
 *
 * A form and a submission are untrusted, even from the host's own store. A
 * JSON-parsed object is plain data, but a host may hand over anything
 * JavaScript can hold: a getter that answers differently each time, a proxy
 * whose traps throw, a sparse list, a Date. So every object and list is
 * read through its property descriptors, own members only: a getter is
 * refused and never run, an exception from a trap becomes a refusal, a
 * list's length is read once and bounded before any item is, and what is
 * read afterwards is a copy that cannot change under the read. report-spec
 * reads a report so, and the runtime its data; each reads what it is given
 * and says it in its own vocabulary.
 */
import { MAX_DETAIL_ROWS } from '@formancy/report-runtime'
import { at } from './errors.js'

/**
 * How deep a form or an answer may nest. Chosen, not measured: a form's
 * JSON nests two levels for each group in a group, and a field as deep as
 * a report reads a path (report-spec's `MAX_FORM_PATH_KEYS`) stands 33
 * levels down, which `untrusted.test.ts` reads. A document nested past it
 * is refused, and no stack is spent walking it.
 */
export const MAX_DOCUMENT_DEPTH = 64

/**
 * The longest key a path into a form names; a longer one is named by its
 * container, so no path grows with what a document holds. Chosen, not
 * measured: twice the 64 characters of formancy's longest field key, so
 * that every key a form names a field by is named.
 */
const MAX_NAMED_KEY = 128

/** Why a value could not be read, and where: `wrongType` where it is data of another shape, `tooMany` a list past its bound, and neither what is not data at all. */
export interface Unreadable {
  readonly ok: false
  readonly path: string
  readonly message: string
  readonly wrongType?: true
  readonly tooMany?: true
}

export type Read<T> = { readonly ok: true; readonly value: T } | Unreadable

const unreadable = (path: string, message: string): Unreadable => ({ ok: false, path, message })
const wrongType = (path: string, message: string): Unreadable => ({ ok: false, path, message, wrongType: true })

/** Where a key of a form is: by its name, unless it is longer than any a form names. */
export function formKeyAt(path: string, key: string): string {
  return key.length > MAX_NAMED_KEY ? path : at(path, key)
}

/** Whether an object that is no list is a plain one: made by a literal, JSON.parse or Object.create(null), not a Map, a Date or a class. */
function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * A plain object's own enumerable string-keyed data properties, each read
 * once, in its own order, or why not. `keyAt` says where a key is, for the
 * refusal of what stands under it.
 */
export function readRecord(value: unknown, path: string, keyAt: (path: string, key: string) => string): Read<ReadonlyMap<string, unknown>> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return wrongType(path, 'expected an object of named values')
    if (!isPlainObject(value)) return unreadable(path, 'an object of a class is not data')
    const entries = new Map<string, unknown>()
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') return unreadable(path, 'a property named by a symbol is not data')
      const descriptor = Object.getOwnPropertyDescriptor(value, key) as PropertyDescriptor
      if (!('value' in descriptor)) return unreadable(keyAt(path, key), 'a getter or setter is not data, and is not run')
      if (descriptor.enumerable !== true) return unreadable(keyAt(path, key), 'a property that is not enumerable is not data')
      entries.set(key, descriptor.value)
    }
    return { ok: true, value: entries }
  } catch {
    return unreadable(path, 'an object that throws when read is not data')
  }
}

/**
 * A list's items, each read once, after its length is read once and
 * checked against `max`: a list longer is refused before any item is read.
 */
export function readList(value: unknown, path: string, max: number): Read<readonly unknown[]> {
  try {
    if (!Array.isArray(value)) return wrongType(path, 'expected a list')
    // A proxy describes its length as it likes: only a whole number is a
    // length, and it is compared and looped to as read.
    const length: unknown = (Object.getOwnPropertyDescriptor(value, 'length') as PropertyDescriptor).value
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return unreadable(path, 'a list whose length is not a whole number is not data')
    if (length > max) return { ok: false, path, message: `a list of ${length} items, more than the ${max} a render reads`, tooMany: true }
    const items: unknown[] = []
    for (let index = 0; index < length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index)
      if (descriptor === undefined) return unreadable(at(path, index), 'a hole in a list is not data')
      if (!('value' in descriptor)) return unreadable(at(path, index), 'a getter or setter is not data, and is not run')
      items.push(descriptor.value)
    }
    return { ok: true, value: items }
  } catch {
    return unreadable(path, 'a list that throws when read is not data')
  }
}

/**
 * `value` copied as JSON data, every object and list read as above, or the
 * first reason it is not data. An own `__proto__` is refused wherever it
 * stands: assigned, it replaces an object's prototype, and formancy stores
 * nothing under it (formancy.ai 0185). Lists hold at most the
 * `MAX_DETAIL_ROWS` items a render reads, and nothing nests past
 * `MAX_DOCUMENT_DEPTH`.
 */
export function copyJson(value: unknown, path: string, keyAt: (path: string, key: string) => string, depth = 0): Read<unknown> {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return { ok: true, value }
    case 'number':
      // -0 is read as 0, as JSON writes it.
      return Number.isFinite(value) ? { ok: true, value: value + 0 } : unreadable(path, 'a number that is not finite is not data')
    case 'object':
      if (value === null) return { ok: true, value }
      if (depth >= MAX_DOCUMENT_DEPTH) return unreadable(path, `nested deeper than the ${MAX_DOCUMENT_DEPTH} levels a form or an answer is read to`)
      return Array.isArray(value) ? copyList(value, path, keyAt, depth) : copyRecord(value, path, keyAt, depth)
    default:
      return unreadable(path, `a ${typeof value} is not data`)
  }
}

function copyList(value: unknown, path: string, keyAt: (path: string, key: string) => string, depth: number): Read<unknown> {
  const items = readList(value, path, MAX_DETAIL_ROWS)
  if (!items.ok) return items
  const copy: unknown[] = []
  for (const [index, item] of items.value.entries()) {
    const read = copyJson(item, at(path, index), keyAt, depth + 1)
    if (!read.ok) return read
    copy.push(read.value)
  }
  return { ok: true, value: copy }
}

function copyRecord(value: unknown, path: string, keyAt: (path: string, key: string) => string, depth: number): Read<unknown> {
  const record = readRecord(value, path, keyAt)
  if (!record.ok) return record
  const copy: Record<string, unknown> = {}
  for (const [key, item] of record.value) {
    if (key === '__proto__') return unreadable(path, 'an own __proto__ is not data: assigned, it replaces an object’s prototype, and formancy stores nothing under it')
    const read = copyJson(item, keyAt(path, key), keyAt, depth + 1)
    if (!read.ok) return read
    copy[key] = read.value
  }
  return { ok: true, value: copy }
}
