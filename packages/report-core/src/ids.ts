/**
 * The ids new things take: a prefix itself when it is free, and otherwise
 * the prefix numbered. One rule for a component the palette inserts, a
 * copy a duplicate makes and an image a person adds (0033), so that the
 * ids an author reads in the outline and in the report's images are made
 * alike, and every one is an identifier the validator accepts. A copy is
 * numbered from its original's base, `intro-2` copied being `intro-3`; a
 * file's name is numbered as it stands, `img-4711` taken being `img-4711-2`.
 */
import { isIdentifier } from '@formancy/report-spec'
import { quote } from './outcome.js'

/** The longest identifier the format allows: `isIdentifier`'s rule in report-spec, at most 64 characters. */
const IDENTIFIER_LENGTH = 64

/** A trailing number an id was given to make it unique: `-2` in `intro-2`. */
const NUMBERED = /-\d+$/

/** `prefix` if `taken` lacks it, otherwise `base` -- the prefix without a number it was given, unless one is said -- numbered from 2, within the identifier's length. */
export function freshId(prefix: string, taken: ReadonlySet<string>, base: string = prefix.replace(NUMBERED, '')): string {
  if (!taken.has(prefix)) return prefix
  for (let number = 2; ; number += 1) {
    const suffix = `-${number}`
    const id = `${base.slice(0, IDENTIFIER_LENGTH - suffix.length)}${suffix}`
    if (!taken.has(id)) return id
  }
}

/** A RangeError naming `said` when `prefix` is not an identifier, which would give an id the validator refuses. */
export function checkPrefix(prefix: string, said: string = prefix): void {
  if (!isIdentifier(prefix)) throw new RangeError(`${quote(said)} is not an identifier: lower-case letters, digits and hyphens, starting with a letter`)
}

/** `freshId` of `prefix`, once `checkPrefix` has held it to the identifier rule. */
export function nextId(prefix: string, taken: ReadonlySet<string>, said: string = prefix): string {
  checkPrefix(prefix, said)
  return freshId(prefix, taken)
}
