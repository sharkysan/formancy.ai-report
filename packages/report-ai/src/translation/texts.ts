import { refusedCharacter } from '@formancy/report-spec'
import type { CharacterRefusal } from '@formancy/report-spec'
import type { WrittenEntry } from './reader.js'

/**
 * What a model's text must be before it is held to the format and the
 * compiler (0085): in characters a report prints, by report-spec's
 * `refusedCharacter`, the rule the renderers print by, and for an
 * expression in what its string literals decode to; and, for a word, with
 * the white space its source has at either end, which is what parts it
 * from the words beside it in a line. The format refuses neither: a
 * character the renderers refuse is refused at the first render in that
 * language, and a space lost runs two words together without a sound.
 */

/** What kept a text from being held: a character a report does not print, or the spaces at its ends. */
export interface TextRefusal {
  readonly reason: 'character' | 'spaces'
  readonly message: string
}

/** `point` as Unicode writes it. */
const codeOf = (point: number): string => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`

/** Why a character does not print, in report-spec's terms. */
const WHY: { readonly [R in CharacterRefusal]: string } = {
  'bidi-control': 'a bidirectional control, which a report never prints: nothing here reorders a line',
  script: 'of a script a report does not print: a report prints Latin, Greek and Cyrillic, with the punctuation and the symbols written with them',
}

/** The first character of `text` a report does not print, and why, or undefined. */
function unprinted(text: string): { readonly point: number; readonly why: CharacterRefusal } | undefined {
  for (const character of text) {
    const point = character.codePointAt(0) as number
    const why = refusedCharacter(point)
    if (why !== undefined) return { point, why }
  }
  return undefined
}

/**
 * Every escape in a CEL source, left to right, each consumed whole, so
 * that an escaped backslash is never read as the start of another: a
 * Unicode escape of four or eight hex digits, a byte of two after `x` or
 * `X`, an octal of three, or a backslash before any one character.
 */
const ESCAPE = /\\(?:u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|[xX]([0-9a-fA-F]{2})|([0-3][0-7]{2})|([\s\S]))/g

/**
 * What each escape of one character writes, as cel-js 8.0.0's
 * `STRING_ESCAPES` decodes it: a quote, a backslash or a question mark as
 * itself, and the seven controls C names. Read by what it writes, so that
 * a control written by its name is held as one written by its digits,
 * whatever `refusedCharacter` prints.
 */
const NAMED: Readonly<Record<string, number>> = {
  '\\': 0x5c,
  '?': 0x3f,
  '"': 0x22,
  "'": 0x27,
  '`': 0x60,
  a: 0x07,
  b: 0x08,
  f: 0x0c,
  n: 0x0a,
  r: 0x0d,
  t: 0x09,
  v: 0x0b,
}

/**
 * The code point each escape in `cel` writes, left to right, as CEL
 * decodes a string literal's; an escape CEL refuses writes none. Exported
 * for its suite; the package exports `proposeTranslation` alone.
 */
export function escapedPoints(cel: string): number[] {
  return [...cel.matchAll(ESCAPE)].flatMap(([, four, eight, byte, octal, one]) => {
    const digits = four ?? eight ?? byte
    if (digits !== undefined) return [Number.parseInt(digits, 16)]
    if (octal !== undefined) return [Number.parseInt(octal, 8)]
    return one !== undefined && Object.hasOwn(NAMED, one) ? [NAMED[one] as number] : []
  })
}

/**
 * The first character an expression's escapes write that a report does not
 * print, or undefined. CEL decodes a string literal's escapes, so a source
 * of plain ASCII can print a control the renderers refuse; a raw string,
 * which decodes nothing, is read here as though it did, and refused where
 * it would not print one, the safe side.
 */
function unprintedEscape(cel: string): { readonly point: number; readonly why: CharacterRefusal } | undefined {
  for (const point of escapedPoints(cel)) {
    const why = point > 0x10ffff ? undefined : refusedCharacter(point)
    if (why !== undefined) return { point, why }
  }
  return undefined
}

/**
 * The white space `text` begins and ends with: what `trimStart` and
 * `trimEnd` take away, the white space and line terminators `\s` names,
 * found in one pass. A pattern anchored at the end, `\s*$`, is tried again
 * at every space of a run that something else ends, which a model's text
 * of many spaces would make quadratic.
 */
function edges(text: string): readonly [string, string] {
  return [text.slice(0, text.length - text.trimStart().length), text.slice(text.trimEnd().length)]
}

/** Why `entry`'s text is no row, before the format and the compiler read it, or undefined where nothing here keeps it from being one. */
export function textRefusal(entry: WrittenEntry): TextRefusal | undefined {
  const held = unprinted(entry.text)
  if (held !== undefined) return { reason: 'character', message: `it holds ${codeOf(held.point)}, ${WHY[held.why]}` }
  if (entry.kind === 'expression') {
    const escaped = unprintedEscape(entry.text)
    return escaped === undefined ? undefined : { reason: 'character', message: `it writes ${codeOf(escaped.point)} by an escape, ${WHY[escaped.why]}` }
  }
  const [begins, ends] = edges(entry.text)
  const [sourceBegins, sourceEnds] = edges(entry.source)
  if (begins === sourceBegins && ends === sourceEnds) return undefined
  const said = (start: string, end: string): string => `begins with ${JSON.stringify(start)} and ends with ${JSON.stringify(end)}`
  return {
    reason: 'spaces',
    message: `it ${said(begins, ends)}, where its source ${said(sourceBegins, sourceEnds)}: a word's spaces at either end part it from the words beside it`,
  }
}
