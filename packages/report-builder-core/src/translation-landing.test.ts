/**
 * A run whose answer cannot be proposed (0086): report-ai's
 * `proposeTranslation` is replaced here by one that throws, since no answer
 * of a model makes the real one throw, and the editor must not be left
 * saying a model is being asked with no run behind it, Ask refused as busy
 * and Stop doing nothing. A file of its own because the replacement holds
 * for every case in the file.
 */
import type { AskModel, RequestKind } from '@formancy/report-ai'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { TranslationState } from './model-translation.js'
import { richReport, sessionOver } from './test-support.js'

vi.mock('@formancy/report-ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@formancy/report-ai')>()
  return {
    ...original,
    proposeTranslation: () => {
      throw new Error('the proposal failed')
    },
  }
})

describe('an answer that cannot be proposed', () => {
  // What the proposal threw is handed on, once the run is let go of and
  // the part no longer says a model is being asked: Ask is offered again.
  test('lets go of the run, and of its waiting, before the throw is handed on', async () => {
    const ask: AskModel<RequestKind> = (prompt) => {
      const asked = JSON.parse(prompt.user) as { into: string; words: { key: string; source: string }[] }
      return Promise.resolve(JSON.stringify({ into: asked.into, words: Object.fromEntries(asked.words.map(({ key, source }) => [key, source])) }))
    }
    const report = { ...richReport(), translations: [{ locale: 'fr-CH', words: [], expressions: [] }] }
    const editor = createReportEditor(sessionOver(report), { model: { ask } })
    editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })
    await expect(editor.askTranslation()).rejects.toThrow('the proposal failed')
    expect(editor.state().translation as TranslationState).toMatchObject({ busy: false, status: '', review: null, ask: { available: true } })
  })
})
