/**
 * What the editor's state says of the properties pane: the kinds a field
 * is edited as and the role each one's control has, the fields, the groups
 * and their buttons, and the panel a builder draws. A part of `model.ts`'s
 * state (`EditorState`), apart because the pane changes for reasons of its
 * own.
 */
import type { EditorAction } from './model-actions.js'

export const PROPERTY_KINDS = ['text', 'multiline', 'number', 'length', 'select', 'boolean', 'color', 'expression', 'binding', 'style'] as const
/**
 * How a property is edited. A `length` is stored in points and edited in
 * millimetres; a `number` is edited as it is stored. `select`, `binding`
 * and `style` choose one of their options.
 */
export type PropertyKind = (typeof PROPERTY_KINDS)[number]

/**
 * The role the native control for each kind has: what a builder renders,
 * and what a test finds it by. A length and a number are `<input
 * type="number">`; a select, a binding and a style a `<select>`; a boolean
 * a checkbox; the rest text inputs or a textarea.
 */
export const PROPERTY_ROLES = {
  text: 'textbox',
  multiline: 'textbox',
  number: 'spinbutton',
  length: 'spinbutton',
  select: 'combobox',
  boolean: 'checkbox',
  color: 'textbox',
  expression: 'textbox',
  binding: 'combobox',
  style: 'combobox',
} as const satisfies { readonly [K in PropertyKind]: string }

export interface PropertyOption {
  /** What `setProperty` takes for this option. */
  readonly value: string
  readonly label: string
}

/** One property of the selection, as an editor shows it. */
export interface PropertyField {
  /** A JSON Pointer from the selection -- the component, the column or the report -- to the property. */
  readonly key: string
  /** The accessible name, with its unit where it has one: "Height (mm)". */
  readonly label: string
  readonly kind: PropertyKind
  /**
   * What the control shows: a string for every kind but `boolean`. A number
   * or length is written with a point, as `<input type="number">` takes it.
   * After a refused edit, what the person typed.
   */
  readonly value: string | boolean
  readonly options?: readonly PropertyOption[]
  /** What an empty field means, where it means something: "Empty: fills the rest". */
  readonly placeholder?: string
  /** Whether the property must have a value; an optional one is removed by emptying it. */
  readonly required: boolean
  /** Why the last value given was refused, or the diagnostic about what is there now. */
  readonly error?: string
}

/**
 * A button the properties draw: what it says, the action it dispatches,
 * and whether it has somewhere to go. One with nowhere -- the first of a
 * list moved up -- is drawn `aria-disabled` and still sent, as a tool is,
 * so the editor says why nothing happened.
 */
export interface PropertyAction {
  readonly label: string
  readonly action: EditorAction
  readonly available: boolean
  /**
   * Where the keyboard goes once the action is done and drawn, where it
   * goes elsewhere than the button it is on: the button at `button` of the
   * group whose key is `group`, or, without `button`, that group's first
   * field. An item of a list moved takes it to the same button of the
   * group the item stands in now, one removed to the list's Add, and one
   * added to the new item's first field. Absent, it stays on the button,
   * whatever the button says now. Decided here, so that neither builder
   * works it out (0044).
   */
  readonly then?: { readonly group: string; readonly button?: number }
}

/**
 * Fields drawn together under one name -- a party of a QR-bill or of an
 * e-invoice, one of an e-invoice's VAT categories -- and the buttons the
 * group has, in order: Add where an optional group is absent, and has no
 * fields, and Remove where it is there; Move up, Move down and Remove for
 * an item of a list, and Add for the list (0044).
 */
export interface PropertyGroup {
  /** A JSON Pointer from the selection to what the group edits: "/debtor", "/vat/1", "/vat". */
  readonly key: string
  /** Its accessible name: "Debtor". */
  readonly label: string
  readonly fields: readonly PropertyField[]
  readonly actions: readonly PropertyAction[]
}

/** What the form draws, in order: a field by itself, or a group. */
export type PropertyRow = { readonly field: PropertyField } | { readonly group: PropertyGroup }

export interface PropertyPanel {
  /** "Text: Introduction", or "Report" when nothing is selected. */
  readonly heading: string
  /** Every field, in the order shown, those in a group among them: what a field is found by. */
  readonly fields: readonly PropertyField[]
  /** The same fields as the form draws them, each by itself or in its group, in the same order. */
  readonly rows: readonly PropertyRow[]
}
