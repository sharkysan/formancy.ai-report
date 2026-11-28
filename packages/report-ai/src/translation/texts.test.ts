import { describe, expect, test } from 'vitest'
import type { WrittenEntry } from './reader.js'
import { escapedPoints, textRefusal } from './texts.js'

/**
 * What a model's text is held to before the format reads it (0085): the
 * characters a report prints, an expression's escapes as CEL decodes
 * them, and a word's spaces at either end.
 */

const BACKSLASH = '\\'

const word = (source: string, text: string): WrittenEntry => ({ key: 'w1', kind: 'word', source, text, places: [] })
const expression = (source: string, text: string): WrittenEntry => ({ key: 'e1', kind: 'expression', source, text, places: [] })

describe('a text held before the format reads it', () => {
  // A character the renderers refuse would be applied, and then refuse the
  // first render in that language (0043).
  test('refuses a character a report does not print, written as it is, in a word and in an expression', () => {
    expect(textRefusal(word('Datum', 'תאריך'))?.message).toMatch(/^it holds U\+05EA, of a script a report does not print/)
    expect(textRefusal(expression("'Datum'", "'\u202eDate'"))?.message).toMatch(/^it holds U\+202E, a bidirectional control/)
  })

  // CEL decodes each escape in a string literal, so plain ASCII can print
  // a control; every escape is read whole, left to right, so an escaped
  // backslash before "u202e" writes a backslash and four letters, and is
  // no control.
  test('refuses an escape that writes a character a report does not print, and reads an escaped backslash as one', () => {
    const control = `"Total ${BACKSLASH}u202e"`
    expect(textRefusal(expression('"Total "', control))).toEqual({ reason: 'character', message: expect.stringMatching(/^it writes U\+202E by an escape/) })
    expect(textRefusal(expression('"Total "', `"Total ${BACKSLASH}U0001F600"`))?.message).toMatch(/^it writes U\+1F600 by an escape, of a script/)
    expect(textRefusal(expression('"Total "', `"Total ${BACKSLASH}x7f ${BACKSLASH}342 ${BACKSLASH}n"`))).toBeUndefined()
    expect(textRefusal(expression('"Total "', `"Total ${BACKSLASH}${BACKSLASH}u202e"`))).toBeUndefined()
  })

  // Each escape is held by what it writes, as CEL decodes it, and never by
  // what report-spec happens to print: a byte written with an upper-case
  // X, or a control written by its name, would pass unread the day
  // `refusedCharacter` refused C0 or C1 controls (#113's N-C), as an
  // escaped quote or backslash would were it read as nothing. An escape
  // CEL refuses writes nothing, for the compiler to refuse.
  test('reads every escape CEL decodes as the character it writes, a named control and an upper-case byte among them', () => {
    const named = ['a', 'b', 'f', 'n', 'r', 't', 'v'].map((name) => `${BACKSLASH}${name}`).join('')
    expect(escapedPoints(`"${named}"`)).toEqual([0x07, 0x08, 0x0c, 0x0a, 0x0d, 0x09, 0x0b])
    expect(escapedPoints(`"${BACKSLASH}X1b ${BACKSLASH}x1B ${BACKSLASH}033"`)).toEqual([0x1b, 0x1b, 0x1b])
    const quotes = [BACKSLASH, '?', '"', "'", '`'].map((each) => `${BACKSLASH}${each}`).join('')
    expect(escapedPoints(`"${quotes}"`)).toEqual([0x5c, 0x3f, 0x22, 0x27, 0x60])
    expect(escapedPoints(`"${BACKSLASH}q ${BACKSLASH}u12"`)).toEqual([])
    // Past the last code point, an escape writes no character, and the compiler refuses it.
    expect(textRefusal(expression('"Total "', `"Total ${BACKSLASH}U00110000"`))).toBeUndefined()
  })

  // A word's spaces at either end part it from the runs beside it; a text
  // that keeps them, whatever it says between them, is not refused for
  // them, and an expression's literals are the compiler's to keep.
  test("refuses a word whose white space at either end is not its source's, and leaves an expression's to the compiler", () => {
    expect(textRefusal(word('Nummer: ', 'Numéro :'))).toEqual({
      reason: 'spaces',
      message: `it begins with "" and ends with "", where its source begins with "" and ends with " ": a word's spaces at either end part it from the words beside it`,
    })
    expect(textRefusal(word(' bis\n', ' au\n'))).toBeUndefined()
    expect(textRefusal(word('Nummer: ', 'Numéro :\u00a0'))?.reason).toBe('spaces')
    expect(textRefusal(expression('"Total " + group.key', '"Total" + group.key'))).toBeUndefined()
  })
})
