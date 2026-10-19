/**
 * What undo and redo say they take back, in the language of whoever reads
 * it.
 *
 * The session holds one history for every editor over it, and a step's
 * label is a string it keeps and shows to anyone who asks: a host's own
 * toolbar, a history view, a proposal's review. So the label the session
 * keeps is a sentence, in English, never an encoding only this package
 * reads.
 *
 * Two editors in two languages read the same steps, though, and an English
 * sentence would be shown in German. So this package also remembers, for
 * every label it wrote, the step it stands for as data -- the verb, the
 * kind, the property -- in one map shared by every editor this copy of the
 * package made, and each editor says a step it finds there in its own
 * words. A label it did not write, a proposal's or a host's, is shown as
 * written. A copy of this package loaded twice -- two versions in one
 * application -- shares no map, and each shows the other's steps in
 * English.
 */
import { kindLabel } from './labels.js'
import type { PartKind } from './model.js'
import { fieldWords } from './property-fields.js'
import type { FieldWords } from './property-fields.js'
import { editorText } from './text.js'
import type { EditorText, MessageId } from './text.js'

/**
 * One step this package made, as data. An image's steps name no image: an
 * id in the label would make a sentence per image ever added.
 */
export type Step =
  | { readonly do: 'insert' | 'delete' | 'move' | 'duplicate' | 'indent' | 'outdent'; readonly kind: PartKind }
  | { readonly do: 'change'; readonly field: FieldWords }
  | { readonly do: 'addImage' }
  | { readonly do: 'removeImage' }

/** The language of the label the session keeps. */
const KEPT = editorText('en')

/**
 * Every label this package wrote, and the step it stands for. It holds one
 * entry per distinct sentence -- a verb and a kind, or a property's words --
 * so it is bounded by the catalogue, not by how many edits were made.
 */
const WRITTEN = new Map<string, Step>()

/** `step` in the words of `t`. */
function said(step: Step, t: EditorText): string {
  if (step.do === 'change') return t('history.change', { field: fieldWords(step.field, t) })
  if (step.do === 'addImage' || step.do === 'removeImage') return t(`history.${step.do}`)
  return t(`history.${step.do}` as MessageId, { kind: kindLabel(step.kind, t) })
}

/** The label a session keeps for `step`: an English sentence, remembered as the step it stands for. */
export function stepLabel(step: Step): string {
  const label = said(step, KEPT)
  WRITTEN.set(label, step)
  return label
}

/** A session's step label as this editor shows it: a step this package labelled in the editor's language, anyone else's as written. */
export function shownLabel(label: string | undefined, t: EditorText): string | null {
  if (label === undefined) return null
  const step = WRITTEN.get(label)
  return step === undefined ? label : said(step, t)
}
