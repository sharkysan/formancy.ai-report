import { describe, expect, test } from 'vitest'
import type { ReportEditor } from './editor.js'
import type { EditorState } from './model.js'

/**
 * `subscribe` and `state` are methods whose `this` is `void`: the React builder hands
 * them to `useSyncExternalStore` bare, and any store hook does. A method keeps the check an
 * implementation was always held to, its parameters compared both ways under `strict`; a
 * function-typed property compares them one way, and would refuse an implementation with a
 * narrower parameter that compiles today. `this: void` says no `this` is needed.
 *
 * What fails is `pnpm typecheck`, which reads this file; the calls say each runs detached.
 */
describe("an editor's detached members, as a host writes them", () => {
  const state = { view: 'design' } as unknown as EditorState

  // An editor turned into function-typed properties would refuse the narrower
  // listener below (TS2322): a public change made as a lint fix.
  test('take an implementation whose parameter is narrower, as a method allows', () => {
    const heard: unknown[] = []
    const editor: Pick<ReportEditor, 'subscribe' | 'state'> = {
      subscribe: (listener: () => undefined) => {
        heard.push(listener())
        return () => undefined
      },
      state: () => state,
    }
    const { subscribe, state: read } = editor
    subscribe(() => undefined)
    expect(heard).toEqual([undefined])
    expect(read()).toBe(state)
  })

  // A class whose methods read `this` implements the interface, and is called on its instance: `this: void`
  // binds a caller, not an implementation.
  test('take a class that implements them', () => {
    class Held implements Pick<ReportEditor, 'subscribe' | 'state'> {
      readonly listeners = new Set<() => void>()
      subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => void this.listeners.delete(listener)
      }
      state(): EditorState {
        return state
      }
    }
    const held = new Held()
    held.subscribe(() => undefined)
    expect(held.listeners.size).toBe(1)
    expect(held.state()).toBe(state)
  })

  // Each refuses, as a type, a literal written in place whose function reads a
  // `this` its caller would not supply; the directive fails typecheck as
  // unused if the member loses `this: void`.
  test('refuse, as a type, a literal whose function reads this', () => {
    const literals: unknown[] = [
      {
        // @ts-expect-error -- subscribe reads a `this` that a detached call lacks
        subscribe(this: { shared: number }) {
          return () => undefined
        },
      } satisfies Pick<ReportEditor, 'subscribe'>,
      {
        // @ts-expect-error -- state reads a `this` that a detached call lacks
        state(this: { shared: number }) {
          return state
        },
      } satisfies Pick<ReportEditor, 'state'>,
    ]
    expect(literals).toHaveLength(2)
  })
})
