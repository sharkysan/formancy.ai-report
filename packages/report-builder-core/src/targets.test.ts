import { locationOf, validLocations } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Box, DropTarget, EditorOutcome } from './model.js'
import { targetBeside, targetNear } from './targets.js'
import { editorOver, richReport } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

describe('drop targets', () => {
  // The places offered are the places the session accepts: report-core
  // asks the validator place by place, and the editor offers exactly
  // those, never a second copy of the rules (0008).
  test('for a kind are exactly where validLocations accepts its default component', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'pageBreak' } }))
    const entry = editor.state().palette.find((candidate) => candidate.kind === 'pageBreak')
    const expected = validLocations(session.document(), entry?.component as NonNullable<typeof entry>['component'] & object)
    expect(editor.state().dropTargets.map((target) => target.location)).toEqual(expected)
    expect(editor.state().dropTargets.every((target) => target.location.region === 'body' || target.location.region === 'summary')).toBe(true)
  })

  // Where a component already is would be offered as a move that does
  // nothing; it is left out, as formancy's builder leaves it out.
  test('for a component are where it may move, without where it stands', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { id: 'gap' } }))
    const here = locationOf(session.document(), 'gap')
    const locations = editor.state().dropTargets.map((target) => target.location)
    expect(locations).not.toContainEqual(here)
    expect(locations).toEqual(validLocations(session.document(), 'gap').filter((location) => JSON.stringify(location) !== JSON.stringify(here)))
    expect(editor.state().dropTargets.map((target) => target.index)).toEqual(locations.map((_, index) => index))
  })

  // A screen reader announces the place, and a keyboard chooses it by its
  // name: region or container, and the neighbour it lands beside.
  test('are named by where they are and what they land beside', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    const labels = editor.state().dropTargets.map((target) => target.label)
    expect(labels).toContain('Report header, before Columns')
    expect(labels).toContain('Columns, column 2, after Orders for [Customer]')
    expect(labels).toContain('Body, after Introduction')
    expect(labels).toContain('Section, after Rectangle')
    expect(labels).toContain('Summary, after Image: Signature')
    expect(new Set(labels).size).toBe(labels.length)
  })

  // An empty list has no neighbour to name: the place is the list.
  test('name an empty list by itself', () => {
    const report = richReport()
    const { editor } = editorOver({ ...report, regions: { ...report.regions, summary: [] } })
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    expect(editor.state().dropTargets.map((target) => target.label)).toContain('Inside Summary')
  })

  // A move is named in the list as it is without the component moved, the
  // list report-core counts its index in: one place down is "after" the
  // next one, not "after" itself.
  test('for a move are named without the component that moves', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { id: 'intro' } }))
    const labels = editor.state().dropTargets.map((target) => target.label)
    expect(labels).toContain('Body, after Spacer')
    expect(labels).not.toContain('Body, after Introduction')
    expect(labels).not.toContain('Body, before Introduction')
  })

  // The indicator a drop target draws is in the list it lands in: a line
  // across the list, at the edge of its neighbour.
  test('each draws its indicator across its list, at its neighbour’s edge', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    const { dropTargets, canvas } = editor.state()
    const box = (key: string): Box => canvas.boxes.find((candidate) => candidate.key === key)?.pt as Box
    const after = dropTargets.find((target) => target.label === 'Body, after Introduction')
    expect(after?.afterId).toBe('intro')
    expect(after?.pt.y).toBeCloseTo(box('intro').y + box('intro').height - after!.pt.height / 2, 2)
    expect(after?.pt.x).toBe(box('intro').x)
    const inSection = dropTargets.find((target) => target.label === 'Section, before Note')
    expect(inSection?.beforeId).toBe('note')
    expect(inSection?.pt.width).toBeCloseTo(box('note').width, 2)
    for (const target of dropTargets) expect(target.px.x).toBeCloseTo(target.pt.x * canvas.scale, 1)
  })
})

/** The targets `targetNear` picks for some point near each one's indicator, swept down its middle a twentieth of a pixel at a time. */
function reachable(targets: readonly DropTarget[]): Set<number> {
  const found = new Set<number>()
  for (const target of targets) {
    const x = target.px.x + target.px.width / 2
    for (let y = target.px.y - 8; y <= target.px.y + target.px.height + 8; y += 0.05) {
      const hit = targetNear(targets, { x, y })
      if (hit !== null) found.add(hit)
    }
  }
  return found
}

describe('finding a target under the pointer', () => {
  // A container with no padding or border ends where the last thing in it
  // ends, so "Section, after Note" and "Body, after Section" were drawn on
  // the same line, and the pointer could only ever land on one of them. The
  // inner place is drawn inside the container instead, and every place the
  // keyboard is offered, a pointer reaches somewhere, at every zoom.
  test('every place has an indicator the pointer can reach, at every zoom', () => {
    const report = richReport()
    const flush: ReportDefinition = {
      ...report,
      regions: { ...report.regions, body: [...report.regions.body, { id: 'outer', kind: 'section', components: [{ id: 'inner', kind: 'keepTogether', components: [{ id: 'deep', kind: 'text', content: [{ kind: 'text', text: 'Deep' }] }] }] }] },
    }
    for (const zoom of [0.25, 1, 4]) {
      for (const subject of [{ kind: 'text' } as const, { id: 'intro' }, { id: 'gap' }]) {
        const { editor } = editorOver(flush, { zoom })
        ok(editor.dispatch({ type: 'startDrag', subject }))
        const { dropTargets } = editor.state()
        expect(dropTargets.length).toBeGreaterThan(10)
        expect([...reachable(dropTargets)].sort((a, b) => a - b), `${JSON.stringify(subject)} at ${zoom}`).toEqual(dropTargets.map((target) => target.index))
      }
    }
    const { editor } = editorOver(flush)
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    const named = (label: string): Box => editor.state().dropTargets.find((target) => target.label === label)?.pt as Box
    // The outer place keeps its edge; each deeper one is a line further in:
    // down from where its container begins, up from where it ends.
    expect(named('Body, after Page break').y).toBeLessThan(named('Section (outer), before Keep together (inner)').y)
    expect(named('Section (outer), before Keep together (inner)').y).toBeLessThan(named('Keep together (inner), before Deep').y)
    expect(named('Keep together (inner), after Deep').y).toBeLessThan(named('Section (outer), after Keep together (inner)').y)
    expect(named('Section (outer), after Keep together (inner)').y).toBeLessThan(named('Body, after Section (outer)').y)
  })

  // A drop goes where the indicator nearest the pointer is drawn, among
  // the lists the pointer is over: the deepest list wins a tie, so a drop
  // inside a section is not taken for one beside it.
  test('targetNear picks the nearest indicator whose list the pointer is over', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    const { dropTargets } = editor.state()
    const after = dropTargets.find((target) => target.label === 'Body, after Introduction')!
    expect(targetNear(dropTargets, { x: after.px.x + 5, y: after.px.y + 3 })).toBe(after.index)
    const inSection = dropTargets.find((target) => target.label === 'Section, before Note')!
    expect(targetNear(dropTargets, { x: inSection.px.x + 5, y: inSection.px.y })).toBe(inSection.index)
    expect(targetNear(dropTargets, { x: -500, y: 0 })).toBeNull()
    expect(targetNear([], { x: 0, y: 0 })).toBeNull()
  })

  // Dropping on an outline row's upper or lower half means before or after
  // it, in its own list.
  test('targetBeside finds the place before or after an outline row', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    const { dropTargets } = editor.state()
    expect(dropTargets[targetBeside(dropTargets, 'note', 'before') ?? -1]?.label).toBe('Section, before Note')
    expect(dropTargets[targetBeside(dropTargets, 'note', 'after') ?? -1]?.label).toBe('Section, after Note')
    expect(targetBeside(dropTargets, 'missing', 'after')).toBeNull()
  })
})

describe('dragging', () => {
  // Pointer drag as a state machine: pick up, hover, drop -- the same
  // insert the keyboard path makes.
  test('start, hover and drop insert the palette’s component there', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'spacer' } }))
    expect(editor.state().drag).toMatchObject({ subject: { kind: 'spacer' }, via: 'pointer', over: null, title: 'Insert Spacer: choose a place' })
    const target = editor.state().dropTargets.find((candidate) => candidate.label === 'Body, after Introduction')!
    ok(editor.dispatch({ type: 'updateDrag', over: target.index }))
    expect(editor.state().drag?.over).toBe(target.index)
    ok(editor.dispatch({ type: 'drop' }))
    expect(session.document().regions.body.map((component) => component.id).slice(0, 2)).toEqual(['intro', 'spacer'])
    expect(editor.state().drag).toBeNull()
    expect(editor.state().dropTargets).toEqual([])
    expect(editor.state().selection).toEqual({ id: 'spacer' })
  })

  // Dragging an existing component moves it.
  test('drop moves a component being dragged', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { id: 'note' } }))
    expect(editor.state().drag?.title).toBe('Move Note: choose a place')
    const target = editor.state().dropTargets.find((candidate) => candidate.label === 'Body, before Introduction')!
    ok(editor.dispatch({ type: 'updateDrag', over: target.index }))
    ok(editor.dispatch({ type: 'drop' }))
    expect(session.document().regions.body[0]?.id).toBe('note')
  })

  // Escape, or a drop over nothing, puts nothing anywhere and says so.
  test('cancel, or a drop over no target, changes nothing', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { id: 'gap' } }))
    ok(editor.dispatch({ type: 'cancelDrag' }))
    expect(editor.state().drag).toBeNull()
    ok(editor.dispatch({ type: 'startDrag', subject: { id: 'gap' } }))
    ok(editor.dispatch({ type: 'updateDrag', over: 0 }))
    ok(editor.dispatch({ type: 'updateDrag', over: null }))
    expect(editor.dispatch({ type: 'drop' })).toMatchObject({ ok: false, code: 'no-target', message: 'Nothing was moved.' })
    expect(editor.state().drag).toBeNull()
    expect(session.revision()).toBe(0)
  })

  // The machine refuses what its state does not allow, rather than
  // guessing: hovering or dropping with nothing picked up, a target that
  // is not one, a subject that is not there.
  test('refuses what its state does not allow', () => {
    const { editor } = editorOver()
    expect(editor.dispatch({ type: 'updateDrag', over: 0 })).toMatchObject({ ok: false, code: 'not-dragging' })
    expect(editor.dispatch({ type: 'drop' })).toMatchObject({ ok: false, code: 'not-dragging' })
    expect(editor.dispatch({ type: 'cancelDrag' })).toMatchObject({ ok: false, code: 'not-dragging' })
    expect(editor.dispatch({ type: 'startDrag', subject: { id: 'missing' } })).toMatchObject({ ok: false, code: 'not-found' })
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    expect(editor.dispatch({ type: 'updateDrag', over: 10_000 })).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.dispatch({ type: 'updateDrag', over: 0.5 })).toMatchObject({ ok: false, code: 'not-found' })
  })

  // A kind with nowhere to go -- a second detail table -- opens a list that
  // says so, instead of an empty one.
  test('says when nowhere takes the subject', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'table' }, via: 'keyboard' }))
    expect(editor.state().dropTargets).toEqual([])
    expect(editor.state().drag).toMatchObject({ via: 'keyboard', nowhere: 'Nowhere in this report can take Table.' })
  })

  // A kind the report cannot hold yet cannot be picked up at all.
  test('refuses to pick up a kind the report cannot hold yet', () => {
    const report: ReportDefinition = { ...richReport(), assets: [], datasets: {}, aggregates: [], parameters: [], regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] } }
    const { editor } = editorOver(report)
    const outcome = editor.dispatch({ type: 'startDrag', subject: { kind: 'image' } })
    expect(outcome).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.state().drag).toBeNull()
  })

  // The keyboard path chooses a place from the same list and inserts
  // there; the list closes when the edit is made.
  test('a keyboard choice from the list is an insert, and ends the drag', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'line' }, via: 'keyboard' }))
    const target = editor.state().dropTargets.find((candidate) => candidate.label === 'Summary, after Image: Signature')!
    ok(editor.dispatch({ type: 'insert', kind: 'line', target: target.location }))
    expect(editor.state().drag).toBeNull()
    expect(componentAt(session.document(), 'line')?.region).toBe('summary')
  })
})
