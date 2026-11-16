/**
 * The panel's own shapes: the groups fields are drawn in and their
 * buttons -- a QR-bill's parties (0039), an e-invoice's parties, its VAT
 * categories and their list (0044), the report's languages (0063), and
 * each run of a paragraph, with its Subscript and Superscript (0061) --
 * what a text is named by, and what fields are built from.
 *
 * How a field is shown, and how what is typed becomes a value, is
 * `field-specs.ts`'s. Which fields each thing has is
 * `component-fields.ts`'s, a component's runs of text `run-fields.ts`'s,
 * a paragraph's runs' groups among them, the report's own
 * `report-fields.ts`'s, and a word written in another language
 * `word-fields.ts`'s (0063).
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { fieldWords } from './field-specs.js'
import type { FieldSpec, FieldWords } from './field-specs.js'
import type { Edited } from './languages.js'
import type { EditorAction, GroupFocus } from './model-actions.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** What a text is named by: its words, or its words and the number of the list's item it is of. */
export type TextName = MessageId | { readonly id: MessageId; readonly item: number }

/**
 * A group's button: its words -- with the item's number, for an item of a
 * list, what they name, the language a Remove takes away, or the field
 * they are about, `of`, a run's -- and, where it shows less than its name
 * says, the words it shows (`text`); the action it sends, whether it has
 * somewhere to go, whether it is pressed, for a button that is on or off
 * (0061), and where the keyboard goes once it is done (`PropertyAction`'s
 * `then`).
 */
export interface GroupButton {
  readonly words: MessageId
  readonly item?: number
  /** What the words name, where they name something: the language a Remove takes away (0063). */
  readonly name?: string
  /** The field the words name, where they name one: the run a Subscript sets (0061). */
  readonly of?: FieldWords
  readonly text?: MessageId
  readonly action: EditorAction
  readonly available: boolean
  readonly pressed?: boolean
  readonly then?: GroupFocus
}

/**
 * A list of groups the properties edit item by item -- an e-invoice's VAT
 * categories (0044) -- as its own group says it: where it is, the items
 * it holds, what Add puts at its end, the words each item is named by, and
 * how the history names adding, removing and moving one. Where the list
 * could take nothing more, `full` says why, and its Add is unavailable.
 */
export interface ListSpec {
  readonly key: string
  readonly items: readonly unknown[]
  readonly value: unknown
  readonly full?: MessageId
  readonly item: MessageId
  readonly added: MessageId
  readonly removed: MessageId
  readonly moved: MessageId
}

/**
 * Fields drawn together under one name, and the buttons the group has. An
 * optional group -- a bill's debtor -- also says what adding it puts at
 * its key and how the history names adding and removing it; its button is
 * Add while it is absent, when it has no fields, and Remove while it is
 * there. A list's own group has no fields and its Add, and says what its
 * list is (`list`); each item of it is a group of its own, numbered `n`
 * from 1, with Move up, Move down and Remove. A run of a paragraph is a
 * group named as its one field is, by the field's words (0061).
 */
export interface GroupSpec {
  readonly key: string
  readonly words: MessageId | FieldWords
  readonly item?: number
  readonly fields: readonly FieldSpec[]
  readonly buttons: readonly GroupButton[]
  readonly optional?: {
    readonly present: boolean
    readonly value: unknown
    readonly added: MessageId
    readonly removed: MessageId
    readonly announced?: { readonly added: MessageId; readonly removed: MessageId }
  }
  readonly list?: ListSpec
}

/** What a panel shows, in order: a field by itself, or a group of fields. */
export type PanelSpec = FieldSpec | GroupSpec

export function isGroup(spec: PanelSpec): spec is GroupSpec {
  return 'fields' in spec
}

/** Every field of `specs`, those in a group among them, in the order shown. */
export function flatFields(specs: readonly PanelSpec[]): FieldSpec[] {
  return specs.flatMap((spec) => (isGroup(spec) ? spec.fields : [spec]))
}

/** The words an optional group's button and its history steps say, and, where "Added {name}." would not agree with its name, what the live region says. */
export interface OptionalWords {
  readonly add: MessageId
  readonly remove: MessageId
  readonly added: MessageId
  readonly removed: MessageId
  readonly announced?: { readonly added: MessageId; readonly removed: MessageId }
}

/**
 * The optional group at `key`: its fields and a Remove while it is there,
 * `fields` given; an Add and no fields while it is not, which puts `value`
 * at its key.
 */
export function optionalGroup(key: string, words: MessageId, fields: readonly FieldSpec[] | undefined, value: unknown, said: OptionalWords): GroupSpec {
  const present = fields !== undefined
  return {
    key,
    words,
    fields: fields ?? [],
    buttons: [
      present
        ? { words: said.remove, action: { type: 'removeGroup', key }, available: true }
        : { words: said.add, action: { type: 'addGroup', key }, available: true },
    ],
    optional: { present, value, added: said.added, removed: said.removed, ...(said.announced === undefined ? {} : { announced: said.announced }) },
  }
}

/** A group's name, in a language: "VAT category 2", or a run's, as its field is named, "Part 2: Text". */
export function groupName(group: GroupSpec, t: EditorText): string {
  if (typeof group.words === 'object') return fieldWords(group.words, t)
  return t(group.words, group.item === undefined ? {} : { item: group.item })
}

/** A button's name, in a language: "Remove VAT category 2", "Remove French", "Part 2: Text, subscript". */
export function buttonName(button: GroupButton, t: EditorText): string {
  return t(button.words, {
    ...(button.item === undefined ? {} : { item: button.item }),
    ...(button.name === undefined ? {} : { name: button.name }),
    ...(button.of === undefined ? {} : { name: fieldWords(button.of, t) }),
  })
}

/** What fields are built from: the report, the editor's words and language, and what each name reads where the thing stands. */
export interface FieldContext {
  readonly report: ReportDefinition
  readonly t: EditorText
  /** For a number an option's words hold, written as the language writes it. */
  readonly locale: EditorLocale
  /** Whether a detail field has a value where the thing stands: a table's cell. */
  readonly row: boolean
  /** The language whose words the fields at a word write, where it is not the report's own (0063). */
  readonly edited?: Edited
}
