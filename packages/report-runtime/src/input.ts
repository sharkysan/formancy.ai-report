/**
 * Reading the data a host hands over, once, without running any of it.
 *
 * Datasets and parameters are untrusted input, even from the host's own
 * provider. A JSON-parsed object is plain data, but a host may hand over
 * anything JavaScript can hold: a getter that answers differently each time
 * it is asked, a proxy whose traps throw, a sparse array. So every object
 * and list is read through its property descriptors into a copy, as
 * report-spec reads a report: a getter is refused unrun, an exception from a
 * trap becomes a refusal, and what is checked afterwards is the copy, which
 * cannot change under the check.
 */

/** Why a container could not be read at all. */
export type ContainerCode = 'wrong-type' | 'not-data' | 'too-many'

/** A property of a record that could not be read, with the key it has when it has a string one. */
export interface PropertyProblem {
  readonly key?: string
  readonly message: string
}

export type RecordRead =
  | { readonly ok: true; readonly entries: ReadonlyMap<string, unknown>; readonly problems: readonly PropertyProblem[] }
  | { readonly ok: false; readonly code: Exclude<ContainerCode, 'too-many'>; readonly message: string }

/** An item of a list that could not be read, by its index. */
export interface ItemProblem {
  readonly index: number
  readonly message: string
}

/** Stands in a read list where an item could not be read; its problem says why. */
export const UNREADABLE: unique symbol = Symbol('unreadable')

export type ListRead =
  | { readonly ok: true; readonly items: readonly unknown[]; readonly problems: readonly ItemProblem[] }
  | { readonly ok: false; readonly code: ContainerCode; readonly message: string }

const ACCESSOR = 'a getter or setter is not data, and is not run'

/** Whether `value` is a plain object: made by a literal, JSON.parse or Object.create(null), not a class instance, an array or a Map. */
function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * A plain object's own enumerable string-keyed data properties, each read
 * once, in the object's own order. A property that is not data -- a getter,
 * a symbol key, a hidden property -- is a problem of the record and left
 * out; anything else about the object refuses it whole.
 */
export function readRecord(value: unknown): RecordRead {
  try {
    if (!isPlainObject(value)) return { ok: false, code: 'wrong-type', message: 'expected an object of named values' }
    const entries = new Map<string, unknown>()
    const problems: PropertyProblem[] = []
    let symbols = false
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') {
        symbols = true
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key) as PropertyDescriptor
      if (!('value' in descriptor)) problems.push({ key, message: ACCESSOR })
      else if (descriptor.enumerable !== true) problems.push({ key, message: 'a property that is not enumerable is not data' })
      else entries.set(key, descriptor.value)
    }
    if (symbols) problems.push({ message: 'a property named by a symbol is not data' })
    return { ok: true, entries, problems }
  } catch {
    return { ok: false, code: 'not-data', message: 'an object that throws when read is not data' }
  }
}

/**
 * A list's items, each read once, after its length is checked against
 * `max`: a list longer than that is refused before any item is read. A hole
 * or a getter is a problem at its index, and `UNREADABLE` stands in its
 * place.
 */
export function readList(value: unknown, max: number): ListRead {
  try {
    if (!Array.isArray(value)) return { ok: false, code: 'wrong-type', message: 'expected a list' }
    // A proxy describes its length as it likes: an object whose valueOf
    // answers the bound one number and the loop another, or Infinity. Only a
    // whole number is a length, and it is compared and looped to as read.
    const length: unknown = (Object.getOwnPropertyDescriptor(value, 'length') as PropertyDescriptor).value
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0)
      return { ok: false, code: 'not-data', message: 'a list whose length is not a whole number is not data' }
    if (length > max) return { ok: false, code: 'too-many', message: `a list of ${length} items, more than the ${max} allowed` }
    const items: unknown[] = []
    const problems: ItemProblem[] = []
    for (let index = 0; index < length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index)
      if (descriptor !== undefined && 'value' in descriptor) {
        items.push(descriptor.value)
        continue
      }
      items.push(UNREADABLE)
      problems.push({ index, message: descriptor === undefined ? 'a hole in a list is not data' : ACCESSOR })
    }
    return { ok: true, items, problems }
  } catch {
    return { ok: false, code: 'not-data', message: 'a list that throws when read is not data' }
  }
}
