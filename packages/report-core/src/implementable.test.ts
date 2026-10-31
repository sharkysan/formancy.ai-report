import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from '@formancy/report-spec'
import type { ReportSession } from './session.js'

/**
 * `subscribe`, `document` and `hash` are methods whose `this` is `void`: a store hook
 * (`useSyncExternalStore(session.subscribe, session.hash, session.hash)`, as the guide
 * writes it) takes them off the session and calls them alone. A method keeps the check an
 * implementation was always held to, its parameters compared both ways under `strict`; a
 * function-typed property compares them one way, and would refuse an implementation with a
 * narrower parameter that compiles today. `this: void` says no `this` is needed.
 *
 * What fails is `pnpm typecheck`, which reads this file; the calls say each runs detached.
 */
describe("a session's detached members, as a host writes them", () => {
  const document = { title: 'Orders' } as ReportDefinition

  // A session turned into function-typed properties would refuse the narrower
  // listener below (TS2328), a public change made as a lint fix: this is the
  // case that fails when the members become properties.
  test('take an implementation whose parameter is narrower, as a method allows', () => {
    const heard: unknown[] = []
    const session: Pick<ReportSession, 'subscribe' | 'document' | 'hash'> = {
      subscribe: (listener: () => undefined) => {
        heard.push(listener())
        return () => undefined
      },
      document: () => document,
      hash: () => 'sha256:abc',
    }
    const { subscribe, document: read, hash } = session
    subscribe(() => undefined)
    expect(heard).toEqual([undefined])
    expect(read()).toBe(document)
    expect(hash()).toBe('sha256:abc')
  })

  // A class whose methods read `this` implements the interface, and is called
  // on its instance: `this: void` binds a caller, not an implementation. This
  // case documents that, and guards nothing: it compiles with the members made
  // properties and with `this: void` removed alike.
  test('take a class that implements them', () => {
    class Held implements Pick<ReportSession, 'subscribe' | 'document' | 'hash'> {
      readonly listeners = new Set<() => void>()
      subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => void this.listeners.delete(listener)
      }
      document(): ReportDefinition {
        return document
      }
      hash(): string {
        return `sha256:${this.listeners.size}`
      }
    }
    const held = new Held()
    held.subscribe(() => undefined)
    expect(held.listeners.size).toBe(1)
    expect(held.hash()).toBe('sha256:1')
  })

  // Each of the three refuses, as a type, a literal written in place whose
  // function reads a `this` its caller would not supply; the directive fails
  // typecheck as unused if the member loses `this: void`.
  test('refuse, as a type, a literal whose function reads this', () => {
    const base: Pick<ReportSession, 'subscribe' | 'document' | 'hash'> = { subscribe: () => () => undefined, document: () => document, hash: () => '' }
    const literals: unknown[] = [
      {
        ...base,
        // @ts-expect-error -- subscribe reads a `this` that a detached call lacks
        subscribe(this: { shared: number }) {
          return () => undefined
        },
      } satisfies Pick<ReportSession, 'subscribe'>,
      {
        ...base,
        // @ts-expect-error -- document reads a `this` that a detached call lacks
        document(this: { shared: number }) {
          return document
        },
      } satisfies Pick<ReportSession, 'document'>,
      {
        ...base,
        // @ts-expect-error -- hash reads a `this` that a detached call lacks
        hash(this: { shared: number }) {
          return ''
        },
      } satisfies Pick<ReportSession, 'hash'>,
    ]
    expect(literals).toHaveLength(3)
  })
})
