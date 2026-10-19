/**
 * The id an image a person adds is declared under, read from its file's
 * name: `Logo Müller AG.svg` is `logo-muller-ag` (0033). It is the
 * editor's reading of a name, so it is here; report-core numbers it where
 * the report already has it (`nextAssetId`), and report-spec's identifier
 * rule is what it meets.
 *
 * The id reaches the report, and a file's name can carry a person's name:
 * the report prints none of it, but whoever holds the report reads it.
 */

/** Latin letters a decomposition leaves whole, as their usual spelling in plain letters. */
const FOLDS: ReadonlyMap<string, string> = new Map([
  ['ß', 'ss'],
  ['æ', 'ae'],
  ['ø', 'o'],
  ['œ', 'oe'],
  ['ł', 'l'],
  ['đ', 'd'],
  ['ð', 'd'],
  ['þ', 'th'],
  ['ı', 'i'],
])

/** Any one of them, from the table itself, so the two cannot disagree. */
const FOLDED = new RegExp(`[${[...FOLDS.keys()].join('')}]`, 'g')

/**
 * The longest base: the identifier's 64 characters less the `-999` that a
 * thousandth image of the same name is numbered with, so that the number
 * stands beside the whole name.
 */
const LONGEST = 60

/**
 * A base for `nextAssetId`: the name without its last extension, lower-case,
 * its letters decomposed and their marks dropped, then folded, every run of
 * anything but `a-z` and `0-9` one hyphen. A name that does not start with
 * a letter is prefixed `image-`, and one with nothing left is `image`.
 */
export function assetBase(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const plain = stem
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(FOLDED, (letter) => FOLDS.get(letter) as string)
  const words = plain.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const base = words === '' ? 'image' : /^[a-z]/.test(words) ? words : `image-${words}`
  return base.slice(0, LONGEST).replace(/-+$/, '')
}
