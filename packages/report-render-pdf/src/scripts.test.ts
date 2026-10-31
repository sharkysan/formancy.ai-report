import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { characterMap, PRINTED_BLOCKS, refusedCharacter } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'

/**
 * The characters a report prints (report-spec's `font-scripts.ts`, 0043),
 * held to Unicode data of another source: the script property fontkit
 * itself chooses a shaper by, from the unicode-properties it loads. Every
 * code point of every printed block must be Latin, Greek, Cyrillic, Common
 * (punctuation, symbols, digits) or Inherited (combining marks), or private
 * use, which that data gives the script 'null'. A block that swallowed its
 * neighbour -- Armenian past Cyrillic Supplement, or a part of Alphabetic
 * Presentation Forms past the Latin ligatures -- would hold characters of
 * another script, and fails here; so did Greek and Coptic's Coptic letters
 * and two Bopomofo tone marks among the Spacing Modifier Letters, which the
 * list now leaves out.
 *
 * unicode-properties is older Unicode than 18.0.0, and reads a code point
 * it has no character for as Common: a character assigned since is not
 * held. That the bounds are Blocks.txt 18.0.0's is review-held (0043).
 */
const own = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)))
const fromFontkit = createRequire(createRequire(createRequire(own.resolve('pdfmake')).resolve('pdfkit')).resolve('fontkit'))
const { getScript } = fromFontkit('unicode-properties') as { getScript(point: number): string }

/** The scripts the printed blocks may hold: Latin, Greek and Cyrillic, what is common to every script, the marks that take their base's, and private use. */
const PRINTED_SCRIPTS: ReadonlySet<string> = new Set(['Latin', 'Greek', 'Cyrillic', 'Common', 'Inherited', 'null'])

describe('the printed blocks, by fontkit’s Unicode data', () => {
  // A character of any other script in a printed block would print unshaped
  // or out of order where the renderer claims it prints.
  test('hold no character of a script the renderer does not print', () => {
    const others: string[] = []
    for (const { block, from, to } of PRINTED_BLOCKS) {
      for (let point = from; point <= to; point += 1) {
        const script = getScript(point)
        if (!PRINTED_SCRIPTS.has(script)) others.push(`U+${point.toString(16).toUpperCase().padStart(4, '0')} ${script} in ${block}`)
      }
    }
    expect(others).toEqual([])
  })

  // The data is read, not empty: Latin, Greek, Cyrillic, a combining mark,
  // a private-use character, Coptic and Hebrew come back as themselves, so a
  // getScript that answered one thing for all could not pass the case above.
  test('is the data it is taken for', () => {
    expect([0x41, 0x3b1, 0x414, 0x301, 0xe000, 0x3e2, 0x5d0].map(getScript)).toEqual(['Latin', 'Greek', 'Cyrillic', 'Inherited', 'null', 'Coptic', 'Hebrew'])
  })
})

describe('a report that maps no font', () => {
  // A report that maps nothing prints in Roboto as in 0.2.0, which refused a
  // character Roboto has no glyph for: so long as every character Roboto
  // maps prints, the allowlist refuses nothing 0.2.0 printed, and changes
  // only what the refusal of one it did not says (0043).
  test('prints every character Roboto maps, in each of its faces', () => {
    const fonts = path.join(path.dirname(own.resolve('pdfmake/package.json')), 'fonts', 'Roboto')
    for (const file of ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf']) {
      const read = characterMap(new Uint8Array(readFileSync(path.join(fonts, file))))
      if (!read.ok) throw new Error(`${file}: ${read.message}`)
      expect(
        [...read.characters].filter((point) => refusedCharacter(point) !== undefined),
        file,
      ).toEqual([])
    }
  })
})
