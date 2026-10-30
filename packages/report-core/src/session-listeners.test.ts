import { describe, expect, test, vi } from 'vitest'
import { setTitle } from './commands/document.js'
import type { Command } from './outcome.js'
import { openReportSession } from './session.js'
import type { ReportSession } from './session.js'
import { accepted, sampleReport } from './test-support.js'

function open(): ReportSession {
  const opening = openReportSession(sampleReport())
  if (!opening.ok) throw new Error('the sample report did not open')
  return opening.session
}

const titled =
  (title: string): Command =>
  (report) =>
    setTitle(report, title)

describe('subscribe', () => {
  // A listener is told synchronously, after the change, so what it reads is
  // the new document and revision.
  test('notifies synchronously after each change, with the change visible', () => {
    const session = open()
    const seen: string[] = []
    session.subscribe(() => seen.push(`${session.revision()} ${session.document().title}`))
    accepted(session.apply(titled('One')))
    session.undo()
    session.redo()
    expect(seen).toEqual(['1 One', '2 Orders by site', '3 One'])
  })

  // A builder destroyed is unsubscribed; a stale subscription would keep it
  // alive and keep calling it (plan 21).
  test('stops notifying after unsubscribe, which may be called twice', () => {
    const session = open()
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)
    unsubscribe()
    unsubscribe()
    accepted(session.apply(titled('One')))
    expect(listener).not.toHaveBeenCalled()
  })

  // Two components may hand in the same function; each subscription is its
  // own, and one unsubscribing does not silence the other.
  test('treats each subscription of one function as its own', () => {
    const session = open()
    const listener = vi.fn()
    const first = session.subscribe(listener)
    session.subscribe(listener)
    accepted(session.apply(titled('One')))
    expect(listener).toHaveBeenCalledTimes(2)
    first()
    accepted(session.apply(titled('Two')))
    expect(listener).toHaveBeenCalledTimes(3)
  })

  // A component destroyed by one notification -- Angular tears down a view
  // while React re-renders -- unsubscribes in the middle of it. It is not
  // called after, and nobody else is skipped.
  test('is safe to unsubscribe from inside a notification, oneself or another', () => {
    const session = open()
    const calls: string[] = []
    let unsubscribeLater = (): void => undefined
    const unsubscribeSelf = session.subscribe(() => {
      calls.push('self')
      unsubscribeSelf()
      unsubscribeLater()
    })
    session.subscribe(() => calls.push('middle'))
    unsubscribeLater = session.subscribe(() => calls.push('later'))
    accepted(session.apply(titled('One')))
    accepted(session.apply(titled('Two')))
    expect(calls).toEqual(['self', 'middle', 'middle'])
  })

  // A listener added during a notification hears the next change, not the
  // one in progress, whose snapshot it reads anyway when it subscribes.
  test('notifies a listener subscribed during a notification from the next change on', () => {
    const session = open()
    const late = vi.fn()
    const once = session.subscribe(() => {
      once()
      session.subscribe(late)
    })
    accepted(session.apply(titled('One')))
    expect(late).not.toHaveBeenCalled()
    accepted(session.apply(titled('Two')))
    expect(late).toHaveBeenCalledTimes(1)
  })
})

describe('a listener that throws', () => {
  // One broken view must not leave the others showing an old document. Every
  // listener runs; the change is committed; then the error is thrown from
  // the call that made the change, so it is not lost either.
  test('does not stop the others, and its error is thrown after all have run', () => {
    const session = open()
    const after = vi.fn()
    session.subscribe(() => {
      throw new Error('view broke')
    })
    session.subscribe(after)
    expect(() => session.apply(titled('One'))).toThrow('view broke')
    expect(after).toHaveBeenCalledTimes(1)
    expect(session.document().title).toBe('One')
    expect(session.revision()).toBe(1)
    expect(() => session.undo()).toThrow('view broke')
    expect(session.document().title).toBe('Orders by site')
    expect(after).toHaveBeenCalledTimes(2)
  })

  // Several failures are all reported, not just the first.
  test('throws an AggregateError when several listeners throw', () => {
    const session = open()
    session.subscribe(() => {
      throw new Error('first')
    })
    session.subscribe(() => {
      throw new Error('second')
    })
    let caught: unknown
    try {
      session.apply(titled('One'))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).errors.map((error: Error) => error.message)).toEqual(['first', 'second'])
    expect(session.revision()).toBe(1)
  })
})

describe('an edit from inside a listener', () => {
  // A listener may react to a change with another edit -- normalising a
  // value, say. It is committed as its own step, and every listener hears
  // both changes.
  test('commits as its own step, and every listener hears it', () => {
    const session = open()
    const seen: string[] = []
    session.subscribe(() => {
      if (session.document().title === 'One') accepted(session.apply(titled('Normalised')))
    })
    session.subscribe(() => seen.push(session.document().title))
    accepted(session.apply(titled('One')))
    expect(session.document().title).toBe('Normalised')
    expect(session.revision()).toBe(2)
    expect(seen).toEqual(['Normalised', 'Normalised'])
  })
})

describe('a session handed to a store hook', () => {
  // useSyncExternalStore and its kin take `subscribe` and `document` as bare
  // functions, so a session whose two read `this` would break there, in
  // the host's render, and not where it was written. `this: void` makes the
  // type refuse such a literal at compile time (typecheck fails on an unused
  // directive here if the declaration is lost), and the real session is shown
  // to work with neither bound.
  test('subscribes and reads with the two methods taken off it', () => {
    const { subscribe, document } = open()
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    expect(document().title).toBe('Orders by site')
    unsubscribe()
    expect(listener).not.toHaveBeenCalled()
  })

  test('refuses, as a type, an implementation that reads this', () => {
    const real = open()
    const implementation: ReportSession = {
      ...real,
      // @ts-expect-error -- a `this` that the caller would not supply
      subscribe(this: { shared: number }, listener: () => void) {
        return real.subscribe(listener)
      },
    }
    expect(implementation).toBeDefined()
  })
})
