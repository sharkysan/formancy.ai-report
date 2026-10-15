import { capped, plural, quoted, type Page } from './check-page.js'
import { normalise } from './fixture.js'
import { lineHas } from './lines.js'

/**
 * Each key once, in order. Keys are found as whole-word sequences in the
 * words of every line, read page by page, top to bottom; an inversion is
 * reported between a key and the one before it that was found exactly once,
 * so one swapped pair is one problem.
 */
export function keys(pages: readonly Page[], expected: readonly string[]): string[] {
  const words = pages.flatMap(({ page, lines }) => lines.flatMap((line) => line.words.map((word) => ({ word, page: page.number }))))
  const byFirstWord = new Map<string, number[]>()
  words.forEach(({ word }, position) => byFirstWord.set(word, [...(byFirstWord.get(word) ?? []), position]))
  const missing: string[] = []
  const repeated: string[] = []
  const misordered: string[] = []
  let previous: { key: string; position: number } | undefined
  for (const key of expected) {
    const sought = normalise(key).split(' ')
    const positions = (byFirstWord.get(sought[0]!) ?? []).filter((start) => sought.every((word, offset) => words[start + offset]?.word === word))
    const [position] = positions
    if (position === undefined) {
      missing.push(`${key} is missing`)
    } else if (positions.length > 1) {
      repeated.push(`${key} appears ${positions.length} times, on pages ${positions.map((at) => words[at]!.page).join(', ')}`)
    } else {
      if (previous !== undefined && position < previous.position) {
        misordered.push(`${key} (page ${words[position]!.page}) comes before ${previous.key} (page ${words[previous.position]!.page})`)
      }
      previous = { key, position }
    }
  }
  return [...capped(missing), ...capped(repeated), ...capped(misordered)]
}

export function exactText(pages: readonly Page[], expected: readonly string[]): string[] {
  return expected.filter((text) => !pages.some(({ lines }) => lines.some((line) => lineHas(line, text)))).map((text) => `'${text}' is not on any page`)
}

/**
 * Text an engine may break anywhere, found as a run of whole body lines on
 * one page that read exactly it once every line break and space is taken
 * out. Bounded by the lines' ends, so text printed longer than it is -- a
 * line of it printed twice -- does not pass.
 */
export function wrappedText(pages: readonly Page[], expected: readonly string[]): string[] {
  return expected
    .filter((text) => !pages.some(({ body }) => readsAs(body.map((line) => line.text.replace(/\s+/g, '')), text.replace(/\s+/g, ''))))
    .map((text) => `${quoted(text)} (${plural(text.length, 'character')}) is not printed as lines of its own on one page, even with line breaks removed`)
}

/** Whether some run of consecutive `lines` joins to exactly `text`. */
function readsAs(lines: readonly string[], text: string): boolean {
  return lines.some((_, first) => {
    let joined = ''
    for (const line of lines.slice(first)) {
      joined += line
      if (joined === text) return true
      if (!text.startsWith(joined)) return false
    }
    return false
  })
}

/**
 * A character the font has no glyph for is drawn as its `.notdef` box,
 * which PDF.js extracts as U+0000 (measured with Roboto, which has no CJK
 * glyphs); a code PDF.js cannot map to Unicode extracts as U+FFFD. Either
 * is text a reader does not see as written, whatever the fixture expects of
 * that line, so every run is checked for both.
 */
export function glyphs(pages: readonly Page[]): string[] {
  return pages.flatMap(({ page }) =>
    page.items.flatMap((item) => {
      const codes = [...new Set(item.text.match(/[\u0000�]/g) ?? [])].map((code) => `U+${code.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
      return codes.length === 0 ? [] : [`page ${page.number}: ${quoted(item.text.replace(/\u0000/g, '␀'))} has ${codes.join(' and ')}, a character no glyph was drawn for`]
    }),
  )
}
