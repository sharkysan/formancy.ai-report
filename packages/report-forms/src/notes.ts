/**
 * What a report generated from a form left out, and what it assumed
 * (0045): each a stable code, the place in the form it is about, and a
 * sentence for a person. A generated report is a first draft, and these
 * are what its author reads before printing it as it is.
 *
 * The notes come in a stable order: what is said of the whole form first,
 * in this list's order, then what is said of each field, in model order,
 * the rows of the table where the repeater stands; of one field, what its
 * kind is printed as, then how it and its rows or options are labelled,
 * then whether it is declared always answered. The place is a JSON Pointer
 * into the form handed over, `/form/model/fields/8/fields/3`, a row's or
 * an option's `/form/model/fields/7/rows/1`. A note names a field by its
 * data path, of field keys, a row or an option by its place, and the
 * report's own locale and counts; it quotes nothing else the form holds --
 * no title, label, option, value, message or locale of its own --
 * which may name a person.
 */

export const NOTE_CODES = [
  /** The version's title is blank: the report is titled by the form's id. */
  'untitled',
  /** The version has no catalogue in the report's locale: its labels are its default locale's. */
  'labels-default-locale',
  /** The version names layouts, arrangements for filling it in: the report follows none, and is in model order. */
  'layouts-not-followed',
  /** The form has pages, which are steps of filling it in (plan 12.2): the report makes no page break of one. */
  'pages-not-breaks',
  /** The table has more columns than a portrait page gives the room a heading's word needs: the page is landscape. */
  'table-landscape',
  /** A static text: it shows the person filling in the form something and holds no answer. */
  'static-excluded',
  /** A field this release prints nothing of: a file, a signature, a ranking, or ticked boxes whose options a deployment resolves or that offer none. */
  'unsupported-excluded',
  /** A repeater the table does not read: a report has one detail table, or none was asked for. */
  'repeater-excluded',
  /** A group, a matrix or ticked boxes deeper than the format nests sections: its heading and its lines stand in the section around it. */
  'group-flattened',
  /** A number read as an integer: it steps by whole numbers from a whole number. */
  'number-integer',
  /** A number read as a decimal by the number rule (0042): to the places its step and its least value have, or printed as its digits where it has no step. */
  'number-decimal',
  /** A tick box, or an option of ticked boxes, printed as a box: `[x]` ticked, `[ ]` not, nothing where the form holds no answer. */
  'yes-no-box',
  /** A time of day, which a report has no type for: printed as formancy stores it, `HH:MM`. */
  'time-as-text',
  /** A rich text: printed as its plain text, its formatting lost. */
  'rich-text-plain',
  /** A hidden field, which the person filling in the form never saw: printed as an answer. */
  'hidden-printed',
  /** A choice whose options a deployment resolves: it prints the labels the host gives when it reads a submission (`labels`). */
  'choice-host-labels',
  /** A choice that offers no option and names no source: it prints its stored value, since it has no label to print. */
  'choice-value',
  /** A field, a group or a repeater with no label, or a blank one: labelled by its key; a row or an option by its value. */
  'unlabelled',
  /** A label the version's catalogue in the report's locale lacks: in its default locale's words, as formancy shows it. */
  'label-default-locale',
  /** A field's label longer than a field's label holds (`MAX_LABEL_LENGTH`): its line prints it whole, and the field is labelled by its row's or option's label, or its id. */
  'long-label',
  /** A field declared not nullable: the version proves it always answered, required and hidden by no rule. */
  'present-always',
] as const
export type NoteCode = (typeof NOTE_CODES)[number]

export interface GenerateNote {
  readonly code: NoteCode
  /** A JSON Pointer into the form handed over: `/form` and its own parts for the whole form, a field's place for a field. */
  readonly path: string
  /** For a person: what was left out or assumed, and why. */
  readonly message: string
}
