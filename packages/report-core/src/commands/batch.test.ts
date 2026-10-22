import { describe, expect, test, vi } from 'vitest'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, frozenSample, refused, sampleReport } from '../test-support.js'
import { removeComponent } from './components.js'
import { batch, describedCommand, MAX_BATCH_COMMANDS } from './registry.js'
import type { CommandDescriptor, StepDescriptor } from './registry.js'

/**
 * A batch is several command descriptors as one command (0048, extending
 * 0008): what a review's resolution, or a proposal, carries as data when
 * one edit takes several commands -- a relabel that changes a field and
 * each text that says its label. It is a transaction written down: one
 * undo step, one notification, validated once at its end, all or nothing.
 */

/** A session over the sample, and how many times it has notified. */
function watched(): { readonly session: ReportSession; readonly notified: () => number } {
  const opening = openReportSession(sampleReport())
  if (!opening.ok) throw new Error('the sample did not open')
  const listener = vi.fn()
  opening.session.subscribe(listener)
  return { session: opening.session, notified: () => listener.mock.calls.length }
}

const batched = (...steps: unknown[]): CommandDescriptor => ({ command: 'batch', args: [steps as StepDescriptor[]] })

describe('a batch', () => {
  // A relabel changes a field's label and the text that prints it: two
  // undo steps would let a person undo half of it, and two notifications
  // would draw the half-done report in both builders.
  test('applies its commands as one edit: one undo step, one notification, its label its own', () => {
    const { session, notified } = watched()
    const before = session.document()
    const outcome = session.apply(batched({ command: 'setTitle', args: ['Batched'] }, { command: 'updateComponent', args: ['note', 'text', { content: [{ kind: 'text', text: 'Danke.' }] }] }), { label: 'Relabel' })
    const after = accepted(outcome)
    expect([after.title, after.regions.body.find((component) => component.id === 'keep')?.kind]).toEqual(['Batched', 'keepTogether'])
    expect(JSON.stringify(after)).toContain('Danke.')
    expect([session.revision(), notified(), session.undoLabel()]).toEqual([1, 1, 'Relabel'])
    session.undo()
    expect(session.document()).toBe(before)
  })

  // Between two of its commands the report may be one the validator
  // refuses, as a transaction's draft may be: a style named before it is
  // declared. Validated per command, a batch could not hold that edit.
  test('is validated once, at its end', () => {
    const { session } = watched()
    const outcome = session.apply(
      batched({ command: 'updateComponent', args: ['note', 'text', { style: 'airy' }] }, { command: 'putStyle', args: ['airy', { size: 14 }] }),
    )
    expect(accepted(outcome).styles.map(({ id }) => id)).toContain('airy')
  })

  // All or nothing: a resolution refused halfway would otherwise leave the
  // report half resolved. The refusal is the first refused command's own,
  // word for word, so a host says what it would have said of that command.
  test('is refused whole, with the first refusal, running nothing after it', () => {
    const { session, notified } = watched()
    const before = session.document()
    const alone = refused(removeComponent(frozenSample(), 'nowhere'))
    const refusal = refused(session.apply(batched({ command: 'setTitle', args: ['First'] }, { command: 'removeComponent', args: ['nowhere'] }, { command: 'setTitle', args: ['Never'] })))
    expect(refusal).toEqual(alone)
    expect([session.document(), session.revision(), notified(), session.canUndo()]).toEqual([before, 0, 0, false])
  })

  // And an end the validator refuses refuses all of it, with the
  // validator's reasons, as any edit's.
  test('is refused whole where its end is invalid', () => {
    const { session, notified } = watched()
    const before = session.document()
    const refusal = refused(session.apply(batched({ command: 'setTitle', args: ['First'] }, { command: 'removeStyle', args: ['title'] })))
    expect(refusal.code).toBe('invalid-document')
    expect([session.document(), session.revision(), notified()]).toEqual([before, 0, 0])
  })

  // A batch is one step already: one inside another would be a second way
  // of writing the same edit, and nesting read from JSON has no depth a
  // stack could be trusted with.
  test('holds commands, never another batch', () => {
    const refusal = refused(describedCommand(batched({ command: 'setTitle', args: ['First'] }, batched({ command: 'setTitle', args: ['Inner'] })))(frozenSample()))
    expect([refusal.code, refusal.message]).toEqual(['invalid-arguments', 'step 2 of the batch is a batch: a batch holds commands, and is one edit already'])
  })

  // A batch read from JSON was never type-checked: each step is checked
  // as any descriptor is, and junk where a step should be is refused,
  // never thrown -- a throw would end a host's loop over resolutions.
  test.each([null, 0, 'setTitle', true, [], [{ command: 'setTitle', args: ['x'] }]])('refuses %j where a step should be, never throwing', (junk) => {
    const run = () => describedCommand(batched({ command: 'setTitle', args: ['First'] }, junk))(frozenSample())
    expect(run).not.toThrow()
    expect([refused(run()).code, refused(run()).message]).toEqual(['invalid-arguments', 'step 2 of the batch is not a command: an object naming one, and its arguments'])
  })

  // A step runs on the report the steps before it left, which nothing has
  // validated yet: a document replaced by one of nothing, a text with no
  // content, a table with no columns. A command written for a report the
  // validator accepts would throw on it, and a throw would end a host's
  // loop over resolutions; the step is refused instead, the session left
  // as it was.
  test.each([
    ['a document of nothing, then a component removed', [{ command: 'replaceDocument', args: [{}] }, { command: 'removeComponent', args: ['note'] }]],
    ['a document of nothing, then a field removed with its readers', [{ command: 'replaceDocument', args: [{}] }, { command: 'removeFieldWithReaders', args: ['header', 'customer'] }]],
    ['a text of no content, then a field removed with its readers', [{ command: 'insertComponent', args: [{ region: 'body', index: 0 }, { kind: 'text', id: 'bare' }] }, { command: 'removeFieldWithReaders', args: ['header', 'customer'] }]],
    ['a table of no columns, then a column removed', [{ command: 'insertComponent', args: [{ region: 'body', index: 0 }, { kind: 'table', id: 'bare' }] }, { command: 'removeColumn', args: ['bare', 'sku'] }]],
  ])('refuses a step that cannot run on what the steps before it left, never throwing: %s', (_name, steps) => {
    const { session, notified } = watched()
    const before = session.document()
    const apply = () => session.apply(JSON.parse(JSON.stringify(batched(...steps))) as CommandDescriptor)
    expect(apply).not.toThrow()
    const refusal = refused(apply())
    expect([refusal.code, refusal.message]).toEqual(['invalid-arguments', 'step 2 of the batch could not run on the report the steps before it left: the batch is refused whole'])
    expect([session.document(), session.revision(), notified()]).toEqual([before, 0, 0])
  })

  // Each step is a descriptor, refused as one: a name that is no command,
  // arguments of the wrong number.
  test('refuses a step as its own descriptor would be refused', () => {
    expect(refused(describedCommand(batched({ command: 'dropTable', args: [] }))(frozenSample())).code).toBe('unknown-command')
    expect(refused(describedCommand(batched({ command: 'setTitle', args: [] }))(frozenSample())).code).toBe('invalid-arguments')
  })

  // Bounded, as a proposal is (plan 16): a batch of a million commands
  // read from JSON would run a million commands before the validator
  // saw any of it. At the bound, a batch.
  test('holds at most MAX_BATCH_COMMANDS commands', () => {
    const steps = (count: number): StepDescriptor[] => Array.from({ length: count }, (_, index) => ({ command: 'setTitle', args: [`Title ${index}`] }))
    expect(accepted(batch(frozenSample(), steps(MAX_BATCH_COMMANDS))).title).toBe(`Title ${MAX_BATCH_COMMANDS - 1}`)
    const refusal = refused(batch(frozenSample(), steps(MAX_BATCH_COMMANDS + 1)))
    expect([refusal.code, refusal.message]).toEqual(['invalid-arguments', `a batch holds at most ${MAX_BATCH_COMMANDS} commands, and this one ${MAX_BATCH_COMMANDS + 1}`])
  })

  // A batch of nothing changes nothing, and commits nothing.
  test('of no commands commits nothing', () => {
    const { session, notified } = watched()
    const before = session.document()
    expect(accepted(session.apply(batched()))).toBe(before)
    expect([session.revision(), notified()]).toEqual([0, 0])
  })

  // As every command, it never writes to the report it is given.
  test('leaves the report it was given as it was', () => {
    const report = frozenSample()
    expect(() => batch(report, [{ command: 'setTitle', args: ['Frozen'] }, { command: 'removeComponent', args: ['gap'] }])).not.toThrow()
    expect(report.title).toBe('Orders by site')
  })
})
