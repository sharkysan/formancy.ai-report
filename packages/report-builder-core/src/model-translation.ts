/**
 * What the state says of a model's translation of the language edited
 * (0086): the button that asks, the run while it waits, the review a
 * person accepts rows of, and the sentences a builder draws beside it.
 * Apart from `model.ts` because a model's review changes for reasons of its
 * own. Every word is the editor's catalogue's; a builder decides nothing
 * here, and draws what it finds.
 */
import type { Selection } from './model.js'

/** A button of the part: what it says, and whether pressing it does something now. */
export interface TranslationButton {
  readonly label: string
  /**
   * False where the action would be refused: a builder marks it
   * unavailable and still sends it, so that the editor says why.
   */
  readonly available: boolean
}

/**
 * A model's translation of the language edited, as a builder draws it in
 * the properties pane, whatever is selected, so that a row's focus may
 * select where its word stands and the review stay where it is. Null in
 * the state of an editor given no model.
 */
export interface TranslationState {
  /**
   * Ask a model for the words the language edited lacks: what it says,
   * the language's `word-missing` counted as the switch counts them, and
   * whether a run may start now. Null in the report's own language, whose
   * words are written where they stand, and in a language that lacks
   * nothing. After Apply it asks for the rest.
   */
  readonly ask: TranslationButton | null
  /** A run waits for its model, under this language: a builder draws `stop` beside the status. */
  readonly busy: boolean
  /** Stop's label. */
  readonly stop: string
  /**
   * The part's one sentence, for a polite live region of its own, in
   * formancy.ai 0161's order: a run waiting, an Apply refused, a run that
   * ended without an answer, then what is ready and what would still be
   * missing. Under another language than the run's, only where it waits
   * or is held; a language removed with its run, under every language.
   * Empty when there is nothing to say.
   */
  readonly status: string
  /** The rows held for review in this language, or null: while a run waits, under another language, and when an answer holds nothing to apply. */
  readonly review: TranslationReview | null
  /**
   * What a person should know of the answer outside its rows, a sentence
   * each, under the table or, with no rows, alone: each entry refused and
   * why, what was dropped and why, what stands in the payment part for a
   * person to write, how many entries were left for another run, a list
   * with no room left, and how many the model left untranslated.
   */
  readonly notes: readonly string[]
}

/** The review: a region named by its heading, a table of rows, and its buttons. */
export interface TranslationReview {
  /** The region's heading, and its accessible name: the language, and how many rows. */
  readonly heading: string
  /** The table's column headings: the report's own language, where a word stands, the language edited, and whether a row is accepted. */
  readonly columns: { readonly source: string; readonly where: string; readonly text: string; readonly accepted: string }
  readonly rows: readonly TranslationReviewRow[]
  readonly acceptAll: TranslationButton
  /** Applies the rows accepted as one undo step, counting them. */
  readonly apply: TranslationButton
  readonly discard: TranslationButton
  /** Offered once Apply was refused: the held answer read again against the report as it stands, with no new turn. */
  readonly reviewAgain: TranslationButton | null
}

/** One row: a word or an expression, what the model wrote for it, and whether it is accepted. */
export interface TranslationReviewRow {
  /** The request's key, `w1` or `e1`: what `acceptTranslation` takes. */
  readonly key: string
  readonly kind: 'word' | 'expression'
  /** The word in the report's own language, or the expression's source. */
  readonly source: string
  /** What the model wrote: a word's text, or an expression's source. */
  readonly text: string
  /** Where it stands, in the editor's words: each place's outline label, or the title. */
  readonly where: string
  /** What the focus moving into the row selects, so the design view shows where the word prints: the first component or column it stands in, or null for the title. */
  readonly target: Selection | null
  /** Pressed: a builder draws its toggle with `aria-pressed`. */
  readonly accepted: boolean
  /** The toggle's accessible name, naming the text and its source, never the text alone. */
  readonly toggle: string
}
