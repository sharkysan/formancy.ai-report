import { BASELINE_SHIFTS, RenderRefusal, type Inline, type Paragraph } from '@formancy/report-runtime'
import { SLACK } from './words.js'

/**
 * A run set below or above the line (0061), held to a word with a run on
 * the line before pdfmake lays out a line of it.
 *
 * pdfmake sets such a run at 0.58 of its size (`TextInlines.js`) and lays
 * the line out as tall as its runs' own lines, its baseline its tallest
 * ascender down (`Line.js`); it moves the run up or down only when it draws
 * it (`Renderer.js`'s `offsetText`). A line of nothing but such runs is laid
 * out at their small height and drawn above its own top, into the line
 * before. pdfmake breaks a line only between its words: the inlines
 * `TextBreaker` chains with `noNewLine`, where a run's last word and the
 * next run's first make one, are one word, which `LayoutBuilder` puts on a
 * line whole once it starts one.
 *
 * So once pdfmake has measured the words and before it lays out the first
 * line -- from the function it calls for the first page's background, as
 * `words.ts` does -- each recorded paragraph's words are read from pdfmake
 * itself, `_inlines`, and every word that holds a run set below or above
 * the line must:
 * - **hold a run on the line**, one set on it that prints a character other
 *   than a space: a word whose only other run prints a space, or nothing,
 *   stands as alone as one of no other run, and is refused as
 *   `unsupported`, naming the paragraph;
 * - **fit its line**, measured as pdfmake measures a word that starts one
 *   (`Line.hasEnoughSpaceForInline`): its inlines' widths, less the first's
 *   leading cut and every one's trailing cut. pdfmake breaks a word wider
 *   than its line anywhere, and a piece of it could hold such a run alone:
 *   refused as `content-too-large`, naming the paragraph.
 *
 * Only a paragraph that holds such a run is recorded, so every other is
 * laid out as it was. `_inlines`, `noNewLine`, `sup`, `sub`, `width`,
 * `leadingCut` and `trailingCut` are pdfmake's own, not part of its API;
 * `pdfmake.test.ts` holds that 0.3.11 still writes them where this reads.
 */

/** A paragraph holding a run set below or above the line, as handed to pdfmake, and the width of its lines. */
export interface ShiftedRoom {
  /** The node as handed to pdfmake, which writes its words onto it as `_inlines`. */
  readonly node: object
  /** The width of one line, in points. */
  readonly width: number
  /** Where it is, `body[2]`, for a refusal to name. */
  readonly subject: string
}

/** One of pdfmake's words, as far as the check reads it: its width and its cuts as `TextInlines.measure` writes them on every word. */
interface Word {
  readonly text: string
  readonly width: number
  readonly leadingCut: number
  readonly trailingCut: number
  readonly sup?: boolean
  readonly sub?: boolean
  readonly noNewLine?: boolean
}

/** Whether a run of the document is set below or above the line. */
export function isShifted(run: Inline): boolean {
  return 'text' in run && run.baseline !== undefined
}

/**
 * Refuses a paragraph that sets a run off the line in a way the renderer
 * does not know: a baseline other than report-spec's, or one on a page
 * field, which takes none. pdfmake would print either on the line, as
 * though nothing were set (0011). Called by check.ts, before anything is
 * built.
 */
export function checkBaselines(paragraph: Paragraph, at: string): void {
  const known = paragraph.runs.every((run) => {
    const { baseline } = run as { readonly baseline?: unknown }
    return baseline === undefined || ('text' in run && BASELINE_SHIFTS.some((shift) => shift === baseline))
  })
  if (!known) throw new RenderRefusal('unsupported', `${at} sets a run below or above the line in a way the renderer does not know`, at)
}

/** Refuses the first recorded paragraph with a word that could leave a run set below or above the line alone on a line. */
export function checkShifted(rooms: readonly ShiftedRoom[]): void {
  for (const { node, width, subject } of rooms) {
    const inlines = (node as { readonly _inlines?: unknown })._inlines
    // Every recorded node is measured before the first page's background: one without words is a pdfmake that measures otherwise.
    if (!Array.isArray(inlines)) throw new Error(`pdfmake has measured no words of ${subject}, which sets a run below or above the line`)
    for (const word of words(inlines as readonly Word[])) {
      if (!word.some((inline) => inline.sup === true || inline.sub === true)) continue
      if (!word.some(onLine)) {
        throw new RenderRefusal(
          'unsupported',
          `${subject} sets a run below or above the line in a word with no text on the line, which pdfmake could print on a line of its own, drawn into the line before; write it against its word with no space, or with a no-break space (U+00A0)`,
          subject,
        )
      }
      const wide = word.reduce((sum, inline) => sum + inline.width - inline.trailingCut, 0) - word[0]!.leadingCut
      // A word without its width or its cuts would measure as no number, and pass: a pdfmake that measures otherwise stops the render.
      if (!Number.isFinite(wide)) throw new Error(`pdfmake has measured a word of ${subject} without its width and its cuts`)
      if (wide > width + SLACK) {
        throw new RenderRefusal(
          'content-too-large',
          `a word of ${subject} that sets a run below or above the line is ${wide.toFixed(2)} pt wide, and its line ${width.toFixed(2)} pt; pdfmake would break it, and could leave that run on a line of its own`,
          subject,
        )
      }
    }
  }
}

/** A run set on the line that prints a character other than a space: what keeps a line its full height and a run beside it off the line before. */
function onLine(inline: Word): boolean {
  return inline.sup !== true && inline.sub !== true && /\S/u.test(inline.text)
}

/** pdfmake's words: each inline with those it is chained to by `noNewLine`, which no line break separates. */
function words(inlines: readonly Word[]): Word[][] {
  const found: Word[][] = []
  let current: Word[] = []
  for (const inline of inlines) {
    current.push(inline)
    if (inline.noNewLine === true) continue
    found.push(current)
    current = []
  }
  if (current.length > 0) found.push(current)
  return found
}
