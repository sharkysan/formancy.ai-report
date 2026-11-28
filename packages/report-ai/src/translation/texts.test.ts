import { describe, expect, test } from 'vitest'
import type { WrittenEntry } from './reader.js'
import { textRefusal } from './texts.js'

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
