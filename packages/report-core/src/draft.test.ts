import { describe, expect, test, vi } from 'vitest'
import { insertComponent, removeComponent } from './commands/components.js'
import { putStyle } from './commands/declarations.js'
import { setTitle } from './commands/document.js'
import { tryEdit } from './draft.js'
import type { Draft } from './draft.js'
import type { CommandOutcome } from './outcome.js'
import { accepted, frozenSample, refused, sampleReport } from './test-support.js'

describe('tryEdit', () => {
  // A proposal's review shows the validator's verdict before Apply (plan
  // 16). It comes from the same draft a transaction edits and the same
  // validation it commits by, so the preview and the commit cannot
  // disagree; the report it is given is frozen here, so a write to it would
  // throw.
  test('gives the validated result of several commands, the draft invalid in between', () => {
    const report = frozenSample()
    const result = accepted(
      tryEdit(report, (draft) => {
        draft.apply((r) => insertComponent(r, { region: 'body', index: 0 }, { id: 'airy-gap', kind: 'spacer', height: 10, style: 'airy' }))
        draft.apply((r) => putStyle(r, 'airy', { size: 14 }))
      }),
    )
    expect(result.regions.body[0]?.id).toBe('airy-gap')
    expect(report.regions.body[0]?.id).toBe('intro')
    expect(report).toEqual(sampleReport())
  })

  // One refused operation refuses the proposal, and nothing after it runs:
  // a later step written against what the refused one would have made could
  // do anything.
  test('gives the first refusal, running nothing after it', () => {
    const after = vi.fn((report: Parameters<typeof setTitle>[0]): CommandOutcome => setTitle(report, 'Never'))
    const refusal = refused(
      tryEdit(frozenSample(), (draft) => {
        draft.apply((r) => setTitle(r, 'First'))
        draft.apply((r) => removeComponent(r, 'nowhere'))
        draft.apply(after)
      }),
    )
    expect(refusal.code).toBe('not-found')
    expect(after).not.toHaveBeenCalled()
  })

  // The end is validated whole: a step that left a style undeclared is
  // reported with the validator's reasons, pointing at the component.
  test("gives the validator's errors for an invalid end", () => {
    const refusal = refused(tryEdit(frozenSample(), (draft) => draft.apply((r) => insertComponent(r, { region: 'body', index: 0 }, { id: 'b', kind: 'spacer', height: 5, style: 'missing' }))))
    expect(refusal).toMatchObject({ code: 'invalid-document', componentId: 'b' })
    expect(refusal.errors?.map(({ code }) => code)).toEqual(['unknown-style'])
  })

  // A preview that awaited between steps would be a preview of half the
  // proposal; it is refused as a transaction refuses it.
  test('throws a TypeError for a callback that returns a promise, and ends the draft', async () => {
    let kept: Draft | undefined
    const run = async (draft: Draft): Promise<void> => {
      kept = draft
      await Promise.resolve()
    }
    let pending: Promise<void> | undefined
    // @ts-expect-error -- an edit runs synchronously; an async callback does not compile
    expect(() => tryEdit(frozenSample(), (draft) => (pending = run(draft)))).toThrow(TypeError)
    await pending
    expect(() => kept?.document()).toThrow(/ended/)
  })
})
