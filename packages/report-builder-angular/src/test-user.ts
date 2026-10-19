/**
 * A person's input, fired as a browser fires it. Only test files import
 * this; the published entry never reaches it.
 *
 * The scenarios name user-event, which formancy.ai's builder-angular tests
 * with, and which this package's devDependencies do not have yet. Until they
 * do, these fire the events user-event fires for the steps the scenarios
 * take, through Testing Library's `fireEvent`, and no more:
 *
 * - a click is pointer and mouse down, focus moving to what was pressed or
 *   the nearest thing around it that takes focus, pointer and mouse up, and
 *   the click;
 * - a key goes to whatever has focus, with its modifiers. Enter on a button
 *   that nothing prevented clicks it, as browsers do;
 * - filling a field focuses it, replaces its value with an input event, and
 *   leaves it, which fires the change event a commit listens for;
 * - choosing an option sets the select and fires its change.
 *
 * - a file chosen in the chooser a file input opened sets the input's
 *   files and fires its input and change events, as a browser does once
 *   the chooser closes, with no filter of `accept` on the way.
 *
 * What they leave out -- keystroke by keystroke typing, a pointer's path,
 * Space's activation on key up -- no scenario relies on. Space on Add
 * image… is held in a browser, by the Studio's gate (gate-images.mjs).
 */
import { fireEvent } from '@testing-library/angular'
import { expect } from 'vitest'

/** What a press holds down around its key. */
export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift'

/** What has focus: the body when nothing else does, as in a browser. */
const focused = (): HTMLElement => document.activeElement as HTMLElement

export function click(element: Element): void {
  fireEvent.pointerDown(element)
  fireEvent.mouseDown(element)
  element.closest<HTMLElement>('button, input, select, textarea, [tabindex]')?.focus()
  fireEvent.pointerUp(element)
  fireEvent.mouseUp(element)
  fireEvent.click(element)
}

export function press(key: string, modifiers: readonly Modifier[] = []): void {
  const target = focused()
  const held = { altKey: modifiers.includes('Alt'), ctrlKey: modifiers.includes('Control'), metaKey: modifiers.includes('Meta'), shiftKey: modifiers.includes('Shift') }
  const unprevented = fireEvent.keyDown(target, { key, ...held })
  if (unprevented && key === 'Enter' && target instanceof HTMLButtonElement) fireEvent.click(target)
  fireEvent.keyUp(focused(), { key, ...held })
}

/** Types `text` over what `field` holds -- a new value, which is all a scenario types -- and leaves it, which fires its change. */
export function fill(field: HTMLElement, text: string): void {
  const input = field as HTMLInputElement
  input.focus()
  fireEvent.input(input, { target: { value: text } })
  fireEvent.change(input)
  input.blur()
}

/** The file input beside Add image…: the one element found by reading the DOM, since a hidden input has no role (0033). */
export function fileInputOf(button: HTMLElement): HTMLInputElement {
  const input = button.parentElement?.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error(`no file input beside ${button.textContent ?? 'the button'}`)
  return input
}

/** `file` chosen in the chooser `input` opened. */
export function pick(input: HTMLInputElement, file: File): void {
  fireEvent.input(input, { target: { files: [file] } })
  fireEvent.change(input, { target: { files: [file] } })
}

export function choose(field: HTMLElement, label: string): void {
  const select = field as HTMLSelectElement
  const option = [...select.options].find((candidate) => candidate.text === label)
  expect(option, `an option ${label}`).toBeDefined()
  select.focus()
  fireEvent.change(select, { target: { value: (option as HTMLOptionElement).value } })
}
