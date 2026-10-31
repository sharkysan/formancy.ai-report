/**
 * Reading untrusted input once, and checking the values in it: the
 * vocabulary every part of validation is written in.
 *
 * Every object and array is read once, through its property descriptors,
 * into a copy; validation then works on the copy and builds the report it
 * returns from what it checked. A getter is refused, never run, and a value
 * read once cannot answer differently later.
 *
 * One convention holds throughout: `undefined` means absent, or present but
 * unreadable -- and in that case already reported. Every function here
 * handed `undefined` returns `undefined` and says nothing, so a missing or
 * unreadable value is reported once, where it is, and not again by every
 * check that wanted it.
 *
 * And one more: no message and no path grows with what a document holds.
 * A string is quoted to 40 characters, and a property name longer than any
 * the format has is refused before a path is built from it.
 */
import type { Width } from './components.js'
import type { ReportError, ReportErrorCode } from './errors.js'
import { MAX_ERRORS, MAX_FONT_SIZE, MAX_KEY_LENGTH, MAX_LENGTH_PT, MIN_FONT_SIZE } from './limits.js'
import { at } from './pointer.js'
import { isFieldKey, isIdentifier } from './syntax.js'
import { roundPt } from './units.js'

/** The errors one validation has found, bounded, and the components they can be attributed to. */
export class Findings {
  readonly #errors: ReportError[] = []
  readonly #components = new Map<string, string>()
  #overflowed = false

  report(path: string, code: ReportErrorCode, message: string): void {
    if (this.#errors.length < MAX_ERRORS) this.#errors.push({ path, code, message })
    else this.#overflowed = true
  }

  /** Records that the component at `path` has `id`, so that errors under it name it. */
  component(path: string, id: string): void {
    this.#components.set(path, id)
  }

  /** The errors in the order found, each naming the innermost component it is inside, and a last one when more were found than listed. */
  errors(): ReportError[] {
    const errors = this.#errors.map((error) => {
      const componentId = this.#owner(error.path)
      return componentId === undefined ? error : { ...error, componentId }
    })
    if (this.#overflowed) {
      errors.push({ path: '', code: 'too-many-errors', message: `more than ${MAX_ERRORS} errors were found; the first ${MAX_ERRORS} are listed` })
    }
    return errors
  }

  /** The id of the component whose path is the longest prefix of `path`. */
  #owner(path: string): string | undefined {
    for (let prefix = path; ; prefix = prefix.slice(0, prefix.lastIndexOf('/'))) {
      const id = this.#components.get(prefix)
      if (id !== undefined || prefix === '') return id
    }
  }
}

/** A value as a message can quote it: strings shortened and quoted, objects named, never stringified. */
export function describe(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return `the string ${quote(value)}`
  if (typeof value === 'number' || typeof value === 'boolean') return `${typeof value} ${String(value)}`
  if (typeof value !== 'object') return `a ${typeof value}`
  try {
    return Array.isArray(value) ? 'an array' : 'an object'
  } catch {
    return 'an object that cannot be read'
  }
}

/** A string as a message quotes it: at most 40 characters of it. Every string from a document passes through here before a message holds it. */
export function quote(text: string): string {
  return JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}...` : text)
}

/** Allowed values as a message lists them. */
export function list(values: readonly (string | boolean)[]): string {
  return values.map((value) => (typeof value === 'string' ? `"${value}"` : String(value))).join(', ')
}

/** A property's value as JSON data, or undefined after reporting why it is not. */
function readProperty(f: Findings, owner: object, key: string | number, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key)
  if (descriptor === undefined) {
    f.report(path, 'not-json', 'a hole in an array is not JSON data')
    return undefined
  }
  if (!('value' in descriptor)) {
    f.report(path, 'not-json', 'a getter or setter is not JSON data, and is not run')
    return undefined
  }
  const value: unknown = descriptor.value
  switch (typeof value) {
    case 'string':
    case 'boolean':
    case 'object':
      return value
    case 'number':
      if (Number.isFinite(value)) return value + 0 // -0 is read as 0, as JSON writes it
      f.report(path, 'not-json', 'a number that is not finite is not JSON data')
      return undefined
    default:
      f.report(path, 'not-json', `${describe(value)} is not JSON data`)
      return undefined
  }
}

/** A plain object's own enumerable data properties, copied, or undefined after reporting why not. */
export function readObject(f: Findings, value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      f.report(path, 'wrong-type', `expected an object, found ${describe(value)}`)
      return undefined
    }
    // A plain object's prototype is Object.prototype, from this realm or
    // another, or null. Anything else -- a Map, a Date, a class -- would be
    // read as an object of its own properties, which is not what it holds.
    const prototype: unknown = Object.getPrototypeOf(value)
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
      f.report(path, 'wrong-type', 'expected a plain object, found an instance of a class')
      return undefined
    }
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const key of Object.keys(value)) {
      // Reported where its object is and left out of the copy, so no path is
      // built from it; the error alone keeps the report from being valid.
      if (key.length > MAX_KEY_LENGTH)
        f.report(path, 'too-long', `holds a property name ${key.length} characters long, ${quote(key)}; no name in the format is longer than ${MAX_KEY_LENGTH}`)
      else copy[key] = readProperty(f, value, key, at(path, key))
    }
    return copy
  } catch {
    f.report(path, 'not-json', 'this value threw when it was read')
    return undefined
  }
}

/**
 * An array's elements, copied, or undefined after reporting why not. Its
 * length is read once, as a number, and checked before any element is
 * read: a proxy's length that answered differently when asked again would
 * otherwise pass the bound and then be read past it.
 */
export function readArray(f: Findings, value: unknown, path: string, max: number): unknown[] | undefined {
  if (value === undefined) return undefined
  try {
    if (!Array.isArray(value)) {
      f.report(path, 'wrong-type', `expected an array, found ${describe(value)}`)
      return undefined
    }
    const length: unknown = value.length
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
      f.report(path, 'not-json', 'an array whose length is not a whole number is not JSON data')
      return undefined
    }
    if (length > max) {
      f.report(path, 'too-many', `holds ${length} entries; at most ${max} are allowed`)
      return undefined
    }
    const copy: unknown[] = []
    for (let index = 0; index < length; index += 1) copy.push(readProperty(f, value, index, at(path, index)))
    return copy
  } catch {
    f.report(path, 'not-json', 'this value threw when it was read')
    return undefined
  }
}

/** An array with at least `min` and at most `max` elements. One with too few is still returned, so its elements are checked too. */
export function readList(f: Findings, value: unknown, path: string, min: number, max: number): unknown[] | undefined {
  const items = readArray(f, value, path, max)
  if (items !== undefined && items.length < min) f.report(path, 'too-few', `holds ${items.length} entries; at least ${min} are needed`)
  return items
}

/** Reports every property a shape does not have, and every required one that is absent. */
export function strictKeys(f: Findings, o: Record<string, unknown>, path: string, required: readonly string[], optional: readonly string[] = []): void {
  for (const key of Object.keys(o)) {
    if (!required.includes(key) && !optional.includes(key)) {
      f.report(at(path, key), 'unknown-property', `${quote(key)} is not a property this version of the format has here`)
    }
  }
  for (const key of required) if (!Object.hasOwn(o, key)) f.report(at(path, key), 'missing-property', `${quote(key)} is required here`)
}

/** An object with exactly the properties a shape allows. */
export function shape(
  f: Findings,
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> | undefined {
  const o = readObject(f, value, path)
  if (o !== undefined) strictKeys(f, o, path, required, optional)
  return o
}

/** The `kind` of an object that has one, among `kinds`. */
export function kindOf<K extends string>(f: Findings, o: Record<string, unknown>, path: string, kinds: readonly K[]): K | undefined {
  const where = at(path, 'kind')
  if (!Object.hasOwn(o, 'kind')) {
    f.report(where, 'missing-property', `"kind" is required: it says which of ${list(kinds)} this is`)
    return undefined
  }
  const kind = reference(f, o.kind, where)
  if (kind === undefined) return undefined
  if ((kinds as readonly string[]).includes(kind)) return kind as K
  f.report(where, 'unknown-kind', `${quote(kind)} is not a kind this version knows; it knows ${list(kinds)}`)
  return undefined
}

export function text(f: Findings, value: unknown, path: string, max: number): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    f.report(path, 'wrong-type', `expected a string, found ${describe(value)}`)
    return undefined
  }
  if (value.length > max) {
    f.report(path, 'too-long', `is ${value.length} characters long; at most ${max} are allowed`)
    return undefined
  }
  return value
}

/** A string naming something declared elsewhere; whether it is declared is the caller's question. */
export function reference(f: Findings, value: unknown, path: string): string | undefined {
  return text(f, value, path, Number.POSITIVE_INFINITY)
}

export function flag(f: Findings, value: unknown, path: string): boolean | undefined {
  if (value === undefined || typeof value === 'boolean') return value
  f.report(path, 'wrong-type', `expected true or false, found ${describe(value)}`)
  return undefined
}

export function oneOf<const T extends string | boolean>(f: Findings, value: unknown, path: string, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined
  if ((allowed as readonly unknown[]).includes(value)) return value as T
  f.report(path, 'not-one-of', `expected ${allowed.length === 1 ? '' : 'one of '}${list(allowed)}, found ${describe(value)}`)
  return undefined
}

/** A finite number from `min` to `max`. */
export function number(f: Findings, value: unknown, path: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number') {
    f.report(path, 'wrong-type', `expected a number, found ${describe(value)}`)
    return undefined
  }
  if (value < min || value > max) {
    f.report(path, 'out-of-range', `${value} is outside the range allowed here, ${min} to ${max}`)
    return undefined
  }
  return value
}

/** A whole number from `min` to `max`. */
export function integer(f: Findings, value: unknown, path: string, min: number, max: number): number | undefined {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    f.report(path, 'not-an-integer', `${value} is not a whole number`)
    return undefined
  }
  return number(f, value, path, min, max)
}

/**
 * A number of points from `min` to `max`, on the hundredth of a point that
 * lengths are stored to. A finer one is refused rather than rounded: two
 * spellings of one stored length would hash differently, and a length that
 * rounds to 0 would pass as more than 0.
 */
function measure(f: Findings, value: unknown, path: string, min: number, max: number): number | undefined {
  const length = number(f, value, path, min, max)
  if (length === undefined || roundPt(length) === length) return length
  f.report(path, 'too-precise', `${length} has more than two decimal places; lengths are stored to the hundredth of a point`)
  return undefined
}

/** A length in points: from 0, or more than 0, up to MAX_LENGTH_PT. */
export function points(f: Findings, value: unknown, path: string, least: 'zero' | 'positive'): number | undefined {
  const length = measure(f, value, path, 0, MAX_LENGTH_PT)
  if (length === 0 && least === 'positive') {
    f.report(path, 'out-of-range', 'a length of 0 points draws nothing; it must be more than 0')
    return undefined
  }
  return length
}

/** A font size in points, from MIN_FONT_SIZE to MAX_FONT_SIZE. */
export function fontSize(f: Findings, value: unknown, path: string): number | undefined {
  return measure(f, value, path, MIN_FONT_SIZE, MAX_FONT_SIZE)
}

/** A width: a length in points, or "fill" for a share of what fixed widths leave. */
export function width(f: Findings, value: unknown, path: string): Width | undefined {
  if (value === 'fill') return value
  if (typeof value === 'string') {
    f.report(path, 'wrong-type', `expected a width in points or "fill", found ${describe(value)}`)
    return undefined
  }
  return points(f, value, path, 'positive')
}

/** A string matching `pattern`; `expected` says in words what it should look like. */
export function matches(f: Findings, value: unknown, path: string, pattern: RegExp, code: ReportErrorCode, expected: string): string | undefined {
  const string = reference(f, value, path)
  if (string === undefined || pattern.test(string)) return string
  f.report(path, code, `expected ${expected}, found ${quote(string)}`)
  return undefined
}

const IDENTIFIER_RULE = 'lower-case letters, digits and hyphens, starting with a letter, at most 64 characters'

export function identifier(f: Findings, value: unknown, path: string): string | undefined {
  const id = reference(f, value, path)
  if (id === undefined || isIdentifier(id)) return id
  f.report(path, 'invalid-id', `${quote(id)} is not an identifier: ${IDENTIFIER_RULE}`)
  return undefined
}

const FIELD_KEY_RULE = 'letters, digits and underscores, starting with a letter or an underscore, at most 64 characters, as a formancy form writes a field key'

/** A name an expression reads: a field, a parameter or an aggregate. */
export function fieldKey(f: Findings, value: unknown, path: string): string | undefined {
  const key = reference(f, value, path)
  if (key === undefined || isFieldKey(key)) return key
  f.report(path, 'invalid-id', `${quote(key)} is not a field key: ${FIELD_KEY_RULE}`)
  return undefined
}

/** Every value, or undefined when any of them is. */
export function all<T>(values: readonly (T | undefined)[]): T[] | undefined {
  const present: T[] = []
  for (const value of values) {
    if (value === undefined) return undefined
    present.push(value)
  }
  return present
}

/** `{ [key]: value }`, or `{}` when value is absent: an optional property spread into a result. */
export function optional<K extends string, V>(key: K, value: V | undefined): { readonly [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { readonly [P in K]?: V }
}
