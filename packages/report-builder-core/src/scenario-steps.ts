/**
 * What a builder scenario is: a report, a language and steps that find
 * every element by its role and its accessible name, and what a runner
 * does for each kind of step. Every runner implements every kind, since
 * the scenarios use every kind (`scenarios.ts`).
 *
 * A runner opens a session over `report()`, mounts its builder over it in
 * `locale`, and does each step in order. A scenario with a `host` makes the
 * editor with that view of the host's (`hostView`), and gives the builder,
 * as the host's view, one button named `control`. A scenario with a
 * `store` makes it with the store `scenarioStore` gives it, which keeps
 * every image a person adds, or refuses each, and records what it kept.
 * - `click`: user-event's click on the element.
 * - `focus`: moves focus to the element, as tabbing to it would. In the
 *   outline that selects the row: focus and selection are one.
 * - `press`: user-event's keyboard, the modifiers held around the key.
 * - `fill`: clears the field, types the text, and tabs away, which commits.
 * - `choose`: selects the option with that label in the combobox.
 * - `host`: dispatches the action to the editor, as the host's own control
 *   for its view does -- the Studio's Preview, in its bar.
 * - `upload`: clicks the button, Add image…, and hands `file` to the file
 *   input beside it, as a person choosing it in the chooser does; no filter
 *   of the input's `accept` drops it on the way. The step ends once the
 *   editor has said what became of the file, and fails when the editor
 *   never took it -- a chooser that never reached the editor.
 * - `present`, `absent`, `focused`: the element is there, is not, has focus.
 * - `value`: the control's value. `text`: the element's text content holds
 *   it. The live region is the status with no name; the problems' count is
 *   the status named by the problems pane.
 * - `invalid`: `aria-invalid="true"`, and an accessible description saying why.
 * - `document`: `check` holds of the session's document.
 * - `kept`: `check` holds of what the scenario's store kept.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import type { AddedImage } from './image-store.js'
import type { EditorAction } from './model.js'
import type { EditorLocale } from './text.js'
import type { HostViewOptions } from './views.js'

/** An element, by its role and its accessible name, and the ARIA states it must have. */
export interface ScenarioQuery {
  readonly role: string
  readonly name: string
  readonly selected?: boolean
}

export const SCENARIO_ACTIONS = ['click', 'focus', 'press', 'fill', 'choose', 'host', 'upload'] as const
export const SCENARIO_EXPECTATIONS = ['present', 'absent', 'focused', 'value', 'text', 'invalid', 'document', 'kept'] as const

/** A file an `upload` step hands the file input: what a runner makes a `File` of. */
export interface ScenarioFile {
  readonly name: string
  /** The type a browser gives a file of this name: what the input's `accept` compares. */
  readonly type: string
  readonly bytes: Uint8Array
}

export type KeyModifier = 'Alt' | 'Control' | 'Meta' | 'Shift'

/** What a host does to its view through the editor: what a `host` step may dispatch. */
export type HostViewAction = Extract<EditorAction, { readonly type: 'showHostView' | 'hideHostView' | 'placeHostView' }>

/** The host's view a scenario's editor is made with, and the one button the runner gives the builder as that view. */
export interface ScenarioHost extends HostViewOptions {
  readonly control: string
}

export type ScenarioStep =
  | ({ readonly do: 'click' | 'focus' } & ScenarioQuery)
  | { readonly do: 'press'; readonly key: string; readonly modifiers?: readonly KeyModifier[] }
  | ({ readonly do: 'fill'; readonly text: string } & ScenarioQuery)
  | ({ readonly do: 'choose'; readonly option: string } & ScenarioQuery)
  | { readonly do: 'host'; readonly action: HostViewAction }
  | ({ readonly do: 'upload'; readonly file: ScenarioFile } & ScenarioQuery)
  | ({ readonly expect: 'present' | 'absent' | 'focused' | 'invalid' } & ScenarioQuery)
  | ({ readonly expect: 'value'; readonly value: string } & ScenarioQuery)
  | ({ readonly expect: 'text'; readonly text: string } & ScenarioQuery)
  | {
      readonly expect: 'document'
      /** What is checked, for the failure message. */
      readonly says: string
      readonly check: (report: ReportDefinition) => boolean
      /** The check is that something stayed as it was, so it holds of the starting report too. */
      readonly unchanged?: true
    }
  | { readonly expect: 'kept'; readonly says: string; readonly check: (kept: readonly AddedImage[]) => boolean }

export interface BuilderScenario {
  readonly name: string
  readonly locale: EditorLocale
  /** The report the session opens: a fresh copy each call. */
  readonly report: () => ReportDefinition
  readonly steps: readonly ScenarioStep[]
  /** A view of the host's own, for the scenarios about one. */
  readonly host?: ScenarioHost
  /** Where the scenario's editor keeps images a person adds: a store that keeps each, or one that refuses each; none when absent. */
  readonly store?: 'keeps' | 'refuses'
}
