import { SHIFTED_SIZE } from '@formancy/report-runtime'
import { capped, plural, points, quoted, type Page } from './check-page.js'
import type { Expectation, ExpectedFontName, ExpectedShiftedRun } from './fixture.js'
import { normalise } from './fixture.js'
import { lineHas, SHIFT_TOLERANCE, type ShiftedRun } from './lines.js'

/** A font's subset prefix in a PDF: six upper-case letters and a plus sign before the PostScript name. */
const SUBSET_PREFIX = /^[A-Z]{6}\+/

/**
 * Each run held to the face it prints in (0043): every text item whose text
 * holds the fixture's marker is drawn in a font whose PostScript name, after
 * the subset prefix the PDF gives every embedded subset, is the one the
 * fixture names. The marker is a distinctive word, since PDF.js splits a run
 * into several items at a script boundary; a run mapped to serif that
 * printed in Roboto, or in the mono face, is caught here, where the
 * extracted text alone would read the same.
 */
export function fontNames(pages: readonly Page[], expected: readonly ExpectedFontName[]): string[] {
  const items = pages.flatMap(({ page }) => page.items)
  return expected.flatMap(({ text, postScriptName }) => {
    const drawn = items.filter((item) => item.text.includes(text))
    if (drawn.length === 0) return [`no run holds ${quoted(text)}, to hold to the ${postScriptName} face`]
    const names = [...new Set(drawn.map((item) => item.font.replace(SUBSET_PREFIX, '')))]
    return names.length === 1 && names[0] === postScriptName
      ? []
      : [`${quoted(text)} is drawn in ${names.map((name) => quoted(name)).join(', ')}; expected ${quoted(postScriptName)}`]
  })
}

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
    .filter(
      (text) =>
        !pages.some(({ body }) =>
          readsAs(
            body.map((line) => line.text.replace(/\s+/g, '')),
            text.replace(/\s+/g, ''),
          ),
        ),
    )
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
      const codes = [...new Set([...item.text].filter((char) => char === '\u0000' || char === '\uFFFD'))].map(
        (code) => `U+${code.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
      )
      return codes.length === 0
        ? []
        : [`page ${page.number}: ${quoted(item.text.replaceAll('\u0000', '␀'))} has ${codes.join(' and ')}, a character no glyph was drawn for`]
    }),
  )
}

/** How a run set below or above the line is said in a problem. */
const SET = { subscript: 'below the line', superscript: 'above the line' } as const

/**
 * Each run the document sets below or above the line read so on the PDF
 * (0061): read into the line it stands on by the line reader, which reads
 * only a run drawn at `SHIFTED_SIZE` of the run beside it and moved by
 * `SHIFTED_RISE` of that run's size (`lines.ts`), set the way the document
 * sets it, and drawn at `SHIFTED_SIZE` of its paragraph's size where the
 * paragraph states one. A page region's run is held on every page, the
 * body's once. A run printed on the line, at another size or moved
 * otherwise is not read so, and is missing here; and a run read so that
 * the document does not set is reported too, so that a document that sets
 * none -- every fixture before 0061 -- holds that the reader read none so.
 * A run is matched by its text as one run of extracted text has it.
 */
export function shiftedRuns(pages: readonly Page[], expected: Pick<Expectation, 'shiftedRuns' | 'pageRegionShiftedRuns'>): string[] {
  const left = pages.map(({ lines }) => lines.flatMap((line) => line.shifted.map((run) => ({ run, line: line.text }))))
  const problems: string[] = []
  const take = (found: { run: ShiftedRun }[], sought: ExpectedShiftedRun): boolean => {
    const at = found.findIndex(({ run }) => matches(run, sought))
    if (at >= 0) found.splice(at, 1)
    return at >= 0
  }
  pages.forEach(({ page }, index) => {
    for (const sought of expected.pageRegionShiftedRuns) {
      if (!take(left[index]!, sought)) problems.push(`page ${page.number}: the page region's ${described(sought)} is not read so`)
    }
  })
  for (const sought of expected.shiftedRuns) {
    if (!left.some((found) => take(found, sought)))
      problems.push(`${described(sought)} is not read so on any page: printed on the line, at another size or moved otherwise`)
  }
  pages.forEach(({ page }, index) => {
    for (const { run, line } of left[index]!) {
      problems.push(
        `page ${page.number}: ${quoted(run.text)} is read set ${SET[run.shift]} at ${points(run.size)} pt, on ${quoted(line)}, which the document does not set`,
      )
    }
  })
  return capped(problems)
}

function matches(run: ShiftedRun, sought: ExpectedShiftedRun): boolean {
  if (normalise(run.text) !== sought.text || run.shift !== sought.shift) return false
  return sought.size === undefined || Math.abs(run.size - SHIFTED_SIZE * sought.size) <= SHIFT_TOLERANCE
}

function described({ text, shift, size }: ExpectedShiftedRun): string {
  return `${quoted(text)}, set ${SET[shift]}${size === undefined ? '' : ` at ${points(SHIFTED_SIZE * size)} pt`},`
}
