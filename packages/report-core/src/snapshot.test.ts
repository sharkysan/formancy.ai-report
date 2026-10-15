import { componentAt, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { duplicateComponent, insertComponent, moveComponent, removeComponent } from './commands/components.js'
import { insertColumn } from './commands/table.js'
import { settled, thawed } from './snapshot.js'
import { accepted, sampleReport } from './test-support.js'

/** Every object and array in a value. */
function objectsIn(value: unknown, into: object[] = []): object[] {
  if (typeof value === 'object' && value !== null) {
    into.push(value)
    for (const child of Object.values(value)) objectsIn(child, into)
  }
  return into
}

describe('settled', () => {
  // A committed document is frozen all the way down: a builder that wrote to
  // the document it was handed would change history behind undo's back.
  test('is deeply frozen, equal to what it settled, and shares no object with it', () => {
    const next = sampleReport()
    const result = settled(next, undefined)
    expect(result).toEqual(next)
    expect(objectsIn(result).every((object) => Object.isFrozen(object))).toBe(true)
    const theirs = new Set(objectsIn(next))
    expect(objectsIn(result).some((object) => theirs.has(object))).toBe(false)
  })

  // An edit that changed nothing returns the previous snapshot itself, which
  // is how the session tells a no-op from a change without hashing.
  test('is the previous snapshot itself when nothing differs, whatever the key order', () => {
    const previous = settled(sampleReport(), undefined)
    const reordered = Object.fromEntries(Object.entries(sampleReport()).reverse())
    expect(settled(sampleReport(), previous)).toBe(previous)
    expect(settled(reordered, previous)).toBe(previous)
  })

  // What did not change keeps its identity across a commit, so a React memo
  // or an Angular OnPush component over one component redraws only when that
  // component changed -- and a history entry costs what its edit changed.
  test('shares every unchanged subtree with the previous snapshot, and only those', () => {
    const previous = settled(sampleReport(), undefined)
    const edited = sampleReport()
    const body = edited.regions.body.map((component) => (component.id === 'gap' ? { ...component, height: 24 } : component))
    const result = settled({ ...edited, regions: { ...edited.regions, body } }, previous)
    expect(result).not.toBe(previous)
    expect(result.regions).not.toBe(previous.regions)
    expect(result.regions.body).not.toBe(previous.regions.body)
    expect(result.regions.body[1]).not.toBe(previous.regions.body[1])
    expect(result.regions.body[0]).toBe(previous.regions.body[0])
    expect(result.regions.body[2]).toBe(previous.regions.body[2])
    expect(result.regions.summary).toBe(previous.regions.summary)
    expect(result.styles).toBe(previous.styles)
  })

  // An insert, a remove, a move or a duplicate shifts what comes after it in
  // its list. Matched by position, every component after it would be a new
  // object, with everything it holds, though none of them changed: every
  // memoised view of them would redraw, and the undo step would hold a copy
  // of each. Matched by id, only what the edit changed is new -- here the
  // component removed, or the one a move put into another list and the
  // container it went into.
  test.each([
    ['an insert at the start of the body', (report: ReportDefinition) => insertComponent(report, { region: 'body', index: 0 }, { id: 'added', kind: 'spacer', height: 4 }), []],
    ['removing the first component', (report: ReportDefinition) => removeComponent(report, 'intro'), ['intro']],
    ['a move to the end of its list', (report: ReportDefinition) => moveComponent(report, 'intro', { region: 'body', index: 4 }), []],
    ['a duplicate', (report: ReportDefinition) => duplicateComponent(report, 'gap'), []],
    ['a move into a container', (report: ReportDefinition) => moveComponent(report, 'gap', { region: 'body', parent: 'keep', index: 0 }), ['gap', 'keep']],
  ])('keeps every component it did not change after %s', (_name, command, changed: readonly string[]) => {
    const previous = settled(sampleReport(), undefined)
    const next = settled(accepted(command(previous)), previous)
    const kept = walkComponents(previous).filter(({ component }) => !changed.includes(component.id))
    for (const { component } of kept) expect(componentAt(next, component.id)?.component, component.id).toBe(component)
    for (const id of changed) expect(componentAt(next, id)?.component, id).not.toBe(componentAt(previous, id)?.component)
  })

  // Table columns and declarations are lists with ids too: a column added in
  // front, or the first style removed, leaves the others as they were.
  test('keeps the columns and declarations an edit shifted', () => {
    const previous = settled(sampleReport(), undefined)
    const lines = (report: ReportDefinition): TableComponent => componentAt(report, 'lines')?.component as TableComponent
    const column = { id: 'first', header: 'First', width: 20, align: 'left', value: { kind: 'text', text: '-' } } as const
    const widened = settled(accepted(insertColumn(previous, 'lines', 0, column)), previous)
    expect(lines(widened).columns.slice(1)).toEqual(lines(previous).columns)
    lines(previous).columns.forEach((before, index) => expect(lines(widened).columns[index + 1]).toBe(before))
    const fewer = settled({ ...previous, styles: previous.styles.slice(1) }, previous)
    fewer.styles.forEach((style, index) => expect(style).toBe(previous.styles[index + 1]))
  })

  // A list that grew, an object that lost a key or a value of another shape
  // is a change, however much else matches.
  test('builds anew where the length of a list, the keys of an object or the shape of a value differ', () => {
    const previous = settled({ list: [1, 2], record: { a: 1, b: 2 }, shape: [1] }, undefined)
    const result = settled({ list: [1, 2, 3], record: { a: 1 }, shape: { 0: 1 } }, previous)
    expect(result.list).not.toBe(previous.list)
    expect(result.record).not.toBe(previous.record)
    expect(result.shape).toEqual({ 0: 1 })
    expect(Array.isArray(result.shape)).toBe(false)
  })
})

describe('thawed', () => {
  // exportDocument hands out a copy anything may write to without reaching
  // the session's frozen document.
  test('is an equal, mutable copy that shares nothing', () => {
    const frozenOne = settled(sampleReport(), undefined)
    const copy = thawed(frozenOne)
    expect(copy).toEqual(frozenOne)
    expect(objectsIn(copy).some((object) => Object.isFrozen(object))).toBe(false)
    copy.title = 'Changed'
    copy.regions.body.pop()
    expect(frozenOne.title).toBe('Orders by site')
  })
})
