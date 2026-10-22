/**
 * The words a report generated from a form prints of it (0045): its title,
 * and each label, read from the version in the report's locale as formancy
 * reads one, a message its catalogue lacks in its default locale's.
 *
 * A label prints on one line, so each run of white space in it -- a tab,
 * a line break -- is one space, as HTML lays a line of text out, and none
 * stands at either end. A label that is blank then is none, and the
 * field is labelled by its key, a row or an option by its value, said. A
 * label holding a character no font draws -- a control character, half of
 * a surrogate pair, a direction override or isolate, a line or paragraph
 * separator -- is refused by its place in the form, never dropped: the
 * renderer would refuse it when it printed (0011), after the person had
 * worked on the draft, and a direction control would show a builder's
 * label in another order than it prints (0048). Whether a font draws any
 * other character -- a soft hyphen, a joiner a script needs -- is the
 * renderer's to say, which holds the fonts; the generator holds none. A
 * review's relabel is held to the same rule.
 */
import type { Text } from '@formancy/spec'
import { resolveText } from '@formancy/spec'
import type { Draft } from './generate-fields.js'

/** A label as the report prints it, and what is said of how it was had, where it is not the version's own in the report's locale. */
export interface Label {
  readonly text: string
  /** None, so the fallback; or the default locale's, which the report's catalogue lacks. */
  readonly said?: 'unlabelled' | 'label-default-locale'
}

/** White space as HTML collapses it: a space, a tab, a line feed, a form feed, a carriage return. */
const WHITE_SPACE = /[\t\n\f\r ]+/g

/**
 * What no font draws: a control character, a tab and a line break among
 * them; half of a surrogate pair; the explicit direction embeddings,
 * overrides and isolates (U+202A to U+202E, U+2066 to U+2069), which
 * reorder the text around them where it is shown; and the line and
 * paragraph separators.
 */
const UNDRAWN = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\u202A-\u202E\u2066-\u2069]/u

/** Whether every character of `text` is one a font may draw, by `UNDRAWN`. */
export const drawable = (text: string): boolean => !UNDRAWN.test(text)

/** `text` as one line prints it: each run of white space one space, none at either end. */
export const oneLine = (text: string): string => text.replace(WHITE_SPACE, ' ').trim()

/** Whether `text` is a message the version's catalogue in the report's locale lacks, which formancy reads in its default locale's; said of the whole form where it has no such catalogue. */
function fromDefault(draft: Draft, text: Text | undefined): boolean {
  const messages = draft.version.schema.i18n?.messages
  if (messages === undefined || typeof text !== 'object' || !Object.hasOwn(messages, draft.locale)) return false
  return !Object.hasOwn(messages[draft.locale] as object, text.$t)
}

/** `text` in the report's locale, read from the version on one line, or `fallback` where it is none or blank, said either way. */
export function labelOf(draft: Draft, text: Text | undefined, fallback: string): Label {
  const resolved = resolveText(draft.version.schema, text, draft.locale)
  const line = resolved === undefined ? '' : oneLine(resolved)
  if (line === '') return { text: oneLine(fallback), said: 'unlabelled' }
  return fromDefault(draft, text) ? { text: line, said: 'label-default-locale' } : { text: line }
}

/** Whether `label` prints, after refusing at `where` one that holds a character no font draws, naming `what` it labels and the character, never the label. */
export function printable(draft: Draft, label: string, where: string, what: string): boolean {
  const found = UNDRAWN.exec(label)
  if (found === null) return true
  const point = (found[0].codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0')
  draft.f.report(where, 'label-unprintable', `${what} is labelled with U+${point}, a control character, half of a surrogate pair, a direction control or a line or paragraph separator, which no font draws; it is refused, never dropped`)
  return false
}

/** The draft's title: the form's, on one line, or its id where that is blank, said; or undefined after refusing one no font draws. */
export function titleOf(draft: Draft): string | undefined {
  const { schema } = draft.version
  const title = oneLine(schema.title)
  if (title === '') {
    draft.notes.push({ code: 'untitled', path: '/form/title', message: "the form version's title is blank, so the report is titled by the form's id" })
    return schema.id
  }
  return printable(draft, title, '/form/title', "the form's title") ? title : undefined
}
