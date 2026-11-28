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
 * Unicode escape of four or eight hex digits, a byte of two, an octal of
 * three, or a backslash before any one character.
 */
const ESCAPE = /\\(?:u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|x([0-9a-fA-F]{2})|([0-3][0-7]{2})|[\s\S])/g

/**
 * The first character an expression's escapes write that a report does not
 * print, or undefined. CEL decodes a string literal's escapes, so a source
 * of plain ASCII can print a control the renderers refuse; a raw string,
 * which decodes nothing, is read here as though it did, and refused where
 * it would not print one, the safe side.
 */
function unprintedEscape(cel: string): { readonly point: number; readonly why: CharacterRefusal } | undefined {
  for (const [, four, eight, byte, octal] of cel.matchAll(ESCAPE)) {
    const digits = four ?? eight ?? byte
    const point = digits !== undefined ? Number.parseInt(digits, 16) : octal !== undefined ? Number.parseInt(octal, 8) : undefined
    const why = point === undefined || point > 0x10ffff ? undefined : refusedCharacter(point)
    if (point !== undefined && why !== undefined) return { point, why }
  }
  return undefined
}

/** The white space `text` begins and ends with. */
function edges(text: string): readonly [string, string] {
  return [(/^\s*/u.exec(text) as RegExpExecArray)[0], (/\s*$/u.exec(text) as RegExpExecArray)[0]]
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
