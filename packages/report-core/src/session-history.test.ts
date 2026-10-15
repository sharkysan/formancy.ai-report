import { REGION_NAMES, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { duplicateComponent, insertComponent, moveComponent, nextComponentId, removeComponent, updateComponent } from './commands/components.js'
import { moveParameter, putStyle, removeStyle } from './commands/declarations.js'
import { setPage, setTitle } from './commands/document.js'
import { moveColumn, setSort } from './commands/table.js'
import type { Command } from './outcome.js'
import { DEFAULT_HISTORY_LIMIT, openReportSession } from './session.js'
import type { ReportSession, SessionOptions } from './session.js'
import { accepted, sampleReport, seeded } from './test-support.js'

function open(options?: SessionOptions): ReportSession {
  const opening = openReportSession(sampleReport(), options)
  if (!opening.ok) throw new Error('the sample report did not open')
  return opening.session
}

const titled =
  (title: string): Command =>
  (report) =>
    setTitle(report, title)

describe('undo and redo', () => {
  // The toolbar asks before it enables a button, and a press with nothing
  // to undo is not an error.
  test('say false and change nothing when there is nothing to undo or redo', () => {
    const session = open()
    const before = session.document()
    expect(session.undo()).toBe(false)
    expect(session.redo()).toBe(false)
    expect(session.document()).toBe(before)
    expect(session.revision()).toBe(0)
    expect(session.undoLabel()).toBeUndefined()
    expect(session.redoLabel()).toBeUndefined()
  })

  // Undo puts back the very snapshot that was there, not a copy of it, so
  // every memoised view of it is valid again; redo does the same forwards.
  test('restore the exact snapshots, each a revision and a notification', () => {
    const session = open()
    let notified = 0
    session.subscribe(() => (notified += 1))
    const first = session.document()
    accepted(session.apply(titled('Second'), { label: 'Rename' }))
    const second = session.document()
    expect(session.undo()).toBe(true)
    expect(session.document()).toBe(first)
    expect(session.redoLabel()).toBe('Rename')
    expect(session.redo()).toBe(true)
    expect(session.document()).toBe(second)
    expect(session.undoLabel()).toBe('Rename')
    expect(session.revision()).toBe(3)
    expect(notified).toBe(3)
  })

  // A new edit after an undo starts a new branch: redoing onto it would
  // replay an edit against a document it was not made against.
  test('a new commit clears what could be redone', () => {
    const session = open()
    accepted(session.apply(titled('One')))
    session.undo()
    expect(session.canRedo()).toBe(true)
    accepted(session.apply(titled('Two')))
    expect(session.canRedo()).toBe(false)
    expect(session.redoLabel()).toBeUndefined()
  })

  // Labels name the step each button would take: the toolbar shows
  // "Undo Rename" and "Redo Move".
  test('label each step with the label it was committed under', () => {
    const session = open()
    accepted(session.apply(titled('One'), { label: 'Rename' }))
    accepted(session.apply((report) => moveParameter(report, 'from', 1), { label: 'Move' }))
    accepted(session.apply(titled('Three')))
    expect(session.undoLabel()).toBe('edit')
    session.undo()
    expect([session.undoLabel(), session.redoLabel()]).toEqual(['Move', 'edit'])
    session.undo()
    expect([session.undoLabel(), session.redoLabel()]).toEqual(['Rename', 'Move'])
  })
})

describe('the history limit', () => {
  // The default is a named constant with its reason, and the session keeps
  // that many steps: one more drops the oldest.
  test(`keeps ${DEFAULT_HISTORY_LIMIT} steps by default, dropping the oldest`, () => {
    const session = open()
    for (let step = 1; step <= DEFAULT_HISTORY_LIMIT + 1; step += 1) accepted(session.apply(titled(`Title ${step}`)))
    let undone = 0
    while (session.undo()) undone += 1
    expect(undone).toBe(DEFAULT_HISTORY_LIMIT)
    expect(session.document().title).toBe('Title 1')
  })

  // A host with tighter memory sets a smaller limit; zero turns undo off.
  test('keeps as many steps as it is given', () => {
    const three = open({ historyLimit: 3 })
    for (const title of ['A', 'B', 'C', 'D', 'E']) accepted(three.apply(titled(title)))
    let undone = 0
    while (three.undo()) undone += 1
    expect(undone).toBe(3)
    expect(three.document().title).toBe('B')
    const none = open({ historyLimit: 0 })
    accepted(none.apply(titled('A')))
    expect(none.canUndo()).toBe(false)
  })
})

describe('a seeded sequence of edits', () => {
  /** A command over the document as it is now, chosen by `next`. */
  function randomCommand(report: ReportDefinition, next: () => number, step: number): Command {
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T
    const index = (): number => Math.floor(next() * 4)
    const ids = walkComponents(report).map(({ component }) => component.id)
    const commands: (() => Command)[] = [
      () => titled(`Title ${step}`),
      () => (r) => insertComponent(r, { region: pick(REGION_NAMES), index: index() }, { id: nextComponentId(r, 'added'), kind: 'spacer', height: 5 + step }),
      () => (r) => removeComponent(r, pick(ids)),
      () => (r) => moveComponent(r, pick(ids), { region: pick(REGION_NAMES), index: index() }),
      () => (r) => duplicateComponent(r, pick(ids)),
      () => (r) => updateComponent(r, pick(ids), 'text', { keepWithNext: next() < 0.5 }),
      () => (r) => putStyle(r, pick(['body', 'small', 'extra']), { size: 8 + (step % 10) }),
      () => (r) => removeStyle(r, pick(report.styles.map(({ id }) => id))),
      () => (r) => setPage(r, { margins: { left: 30 + (step % 40) } }),
      () => (r) => moveColumn(r, 'lines', pick(['sku', 'qty', 'price', 'amount']), index()),
      () => (r) => moveParameter(r, pick(report.parameters.map(({ id }) => id)), index()),
      () => (r) => setSort(r, 'lines', next() < 0.5 ? null : [{ field: { dataset: 'detail', field: 'quantity' }, direction: 'asc' }]),
    ]
    return pick(commands)()
  }

  // Exact undo is the property everything else rests on. Fifty edits drawn
  // from a fixed seed -- inserts, removes, moves across regions, duplicates,
  // style and page edits, some refused, some no-ops -- then all undone and
  // all redone: every step must give back the exact snapshot, and an equal
  // export, it had when it was committed.
  test.each([1, 7, 2026])('undoes and redoes fifty edits exactly (seed %i)', (seed) => {
    const next = seeded(seed)
    const session = open()
    const snapshots = [session.document()]
    const exports = [session.exportDocument()]
    let refusals = 0
    for (let step = 0; step < 50; step += 1) {
      const revision = session.revision()
      const outcome = session.apply(randomCommand(session.document(), next, step))
      if (!outcome.ok) refusals += 1
      if (session.revision() === revision) continue
      snapshots.push(session.document())
      exports.push(session.exportDocument())
    }
    // The sequence exercised both paths, or it proved little.
    expect(snapshots.length).toBeGreaterThan(20)
    expect(refusals).toBeGreaterThan(5)
    for (let at = snapshots.length - 1; at > 0; at -= 1) {
      expect(session.document()).toBe(snapshots[at])
      expect(session.exportDocument()).toEqual(exports[at])
      expect(session.undo()).toBe(true)
    }
    expect(session.document()).toBe(snapshots[0])
    expect(session.undo()).toBe(false)
    for (let at = 1; at < snapshots.length; at += 1) {
      expect(session.redo()).toBe(true)
      expect(session.document()).toBe(snapshots[at])
      expect(session.exportDocument()).toEqual(exports[at])
    }
    expect(session.redo()).toBe(false)
  })
})
