/**
 * A run that throws where it should resolve (0086): report-ai's
 * `translateMissing` and `proposeTranslation` are wrapped here, each made to
 * throw once by a case, since no answer of a model makes the real ones
 * throw, and the editor must not be left saying a model is being asked
 * with no run behind it, Ask refused as busy and Stop doing nothing. A
 * file of its own because the wrapping holds for every case in the file.
 */
import { proposeTranslation, translateMissing } from '@formancy/report-ai'
import type { AskModel, RequestKind } from '@formancy/report-ai'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { TranslationState } from './model-translation.js'
import { richReport, sessionOver } from './test-support.js'

vi.mock('@formancy/report-ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@formancy/report-ai')>()
  return { ...original, proposeTranslation: vi.fn(original.proposeTranslation), translateMissing: vi.fn(original.translateMissing) }
})

/** A model that writes every word asked as its source. */
const ask: AskModel<RequestKind> = (prompt) => {
  const asked = JSON.parse(prompt.user) as { into: string; words: { key: string; source: string }[] }
  return Promise.resolve(JSON.stringify({ into: asked.into, words: Object.fromEntries(asked.words.map(({ key, source }) => [key, source])) }))
}

/** An editor given that model, with French edited and nothing written in it. */
function editing() {
  const report = { ...richReport(), translations: [{ locale: 'fr-CH', words: [], expressions: [] }] }
  const editor = createReportEditor(sessionOver(report), { model: { ask } })
  editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })
  return editor
}

describe('a run that throws', () => {
  // What the run threw is handed on, once the run is let go of and the
  // part no longer says a model is being asked: Ask is offered again.
  test('in its turns lets go of the run, and of its waiting, before the throw is handed on', async () => {
    vi.mocked(translateMissing).mockRejectedValueOnce(new Error('the run failed'))
    const editor = editing()
    await expect(editor.askTranslation()).rejects.toThrow('the run failed')
    expect(editor.state().translation as TranslationState).toMatchObject({ busy: false, status: '', review: null, ask: { available: true } })
  })

  // The same one step later, where the answer is proposed.
  test('in its proposal lets go of the run, and of its waiting, before the throw is handed on', async () => {
    vi.mocked(proposeTranslation).mockImplementationOnce(() => {
      throw new Error('the proposal failed')
    })
    const editor = editing()
    await expect(editor.askTranslation()).rejects.toThrow('the proposal failed')
    expect(editor.state().translation as TranslationState).toMatchObject({ busy: false, status: '', review: null, ask: { available: true } })
  })
})
