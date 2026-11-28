/**
 * A model's translation of the language edited, reviewed word by word in
 * the editor, against the model alone
 * ([0086](../../../docs/decisions/0086-a-person-reviews-a-models-translation-word-by-word-in-either-builder-and-applies-what-they-accepted-as-one-undo-step.md)):
 * the run held for the language it was asked for, and only said under
 * another; a language removed while its run waits stopping it; rows
 * accepted one at a time or all; Apply one labelled undo step against the
 * proposal's hash, refused once the report moved, and Review again leaving
 * out what a person wrote; Discard forgetting a run that waits; and a
 * run's ending landing only while it is the one in flight. The model is a
 * script that answers when the test says so, and reads the request it was
 * sent, so every word it writes is one it was asked for.
 */
import { createRelay, ModelBusyError } from '@formancy/report-ai'
import type { AskModel, ModelPrompt, RequestKind } from '@formancy/report-ai'
import type { EditOptions, ReportSession } from '@formancy/report-core'
import { MAX_BATCH_COMMANDS } from '@formancy/report-core'
import { MAX_INLINES, MAX_TEXT_LENGTH, MAX_WORDS, reportHash } from '@formancy/report-spec'
import type { ReportDefinition, TextComponent, Translation } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { ReportEditor } from './editor.js'
import type { EditorOutcome } from './model-actions.js'
import type { TranslationState } from './model-translation.js'
import { billedReport, richReport, sessionOver } from './test-support.js'
import type { EditorLocale } from './text.js'

const FRENCH = 'French (Switzerland)'

/** One turn the model was asked, and how to answer it. */
interface Turn {
  readonly prompt: ModelPrompt<RequestKind>
  readonly answer: (text: string) => void
  readonly fail: (error: unknown) => void
}

/** A model that answers when it is told to, and records each turn and each time it was told to stop. */
function heldModel() {
  const turns: Turn[] = []
  const cancelled = vi.fn()
  const ask: AskModel<RequestKind> = (prompt, turn) =>
    new Promise<string>((answer, fail) => {
      turns.push({ prompt, answer, fail })
      turn.onCancel(cancelled)
    })
  return { model: { ask }, turns, cancelled }
}

/** What the request of `prompt` asked: its locale, and each word and expression by key and source. */
interface Asked {
  readonly into: string
  readonly words: readonly { readonly key: string; readonly source: string }[]
  readonly expressions: readonly { readonly key: string; readonly source: string }[]
}

/** A word as this model writes it: its source behind "fr", its spaces at either end kept. */
const french = (source: string): string => source.replace(/\S(?:[\s\S]*\S)?/, (core) => `fr ${core}`)

/** An answer to the first turn of `prompt`: every word asked written by `write`, every expression as its source, and anything `extra` adds. */
function answerTo(prompt: ModelPrompt<RequestKind>, write: (source: string) => string = french, extra: Readonly<Record<string, string>> = {}): string {
  const asked = JSON.parse(prompt.user) as Asked
  const words = Object.fromEntries(asked.words.map(({ key, source }) => [key, write(source)]))
  return JSON.stringify({
    into: asked.into,
    words: { ...words, ...extra },
    expressions: Object.fromEntries(asked.expressions.map(({ key, source }) => [key, source])),
  })
}

/** The keys of `prompt`'s request, by the source each was asked for. */
const keysOf = (prompt: ModelPrompt<RequestKind>): ReadonlyMap<string, string> =>
  new Map((JSON.parse(prompt.user) as Asked).words.map(({ key, source }) => [source, key]))

/** `report` written in French and Italian too, with nothing written in either. */
function inTwoLanguages(report: ReportDefinition = richReport()): ReportDefinition {
  const none = (locale: string): Translation => ({ locale, words: [], expressions: [] })
  return { ...report, translations: [none('fr-CH'), none('it-CH')] }
}

/** An editor over a new session of `report`, given `model`, with French edited. */
function editing(model: ReturnType<typeof heldModel>['model'] | undefined, report = inTwoLanguages(), locale: EditorLocale = 'en') {
  const session = sessionOver(report)
  const editor = createReportEditor(session, { locale, ...(model === undefined ? {} : { model }) })
  expect(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
  return { session, editor }
}

const translation = (editor: ReportEditor): TranslationState => editor.state().translation as TranslationState
const missing = (editor: ReportEditor, locale = 'fr-CH'): number => editor.state().languages.declared.find((each) => each.locale === locale)?.missing ?? -1
const frenchOf = (session: ReportSession): Translation | undefined => session.document().translations?.find(({ locale }) => locale === 'fr-CH')

/** Asks, and answers the first turn as `answerTo` does: the editor holding the answer for review. */
async function answered(editor: ReportEditor, held: ReturnType<typeof heldModel>, write?: (source: string) => string): Promise<EditorOutcome> {
  const run = editor.askTranslation()
  const turn = held.turns.at(-1) as Turn
  turn.answer(answerTo(turn.prompt, write))
  return run
}

describe('a model’s translation, without a model', () => {
  // A host that gives no model gets builders that draw nothing new: a
  // button that asks nobody would be a promise the editor cannot keep.
  test('is drawn as nothing, and asking or acting on it is refused', async () => {
    const { editor } = editing(undefined)
    expect(editor.state().translation).toBeNull()
    expect(await editor.askTranslation()).toEqual({ ok: false, code: 'unavailable', message: 'No model was given to this editor to ask.' })
    expect(editor.dispatch({ type: 'applyTranslation' })).toMatchObject({ ok: false, code: 'unavailable' })
  })

  // A model with nothing to call is the host's mistake, said when the
  // editor is made rather than when a person presses Ask.
  test('refuses a model with no ask, as the editor is made', () => {
    expect(() => createReportEditor(sessionOver(richReport()), { model: {} as never })).toThrow(RangeError)
  })
})

describe('asking a model for the words a language lacks', () => {
  // Ask counts what the switch counts, and is offered where words are
  // missing: never in the report's own language, whose words are written
  // where they stand.
  test('offers Ask in a language that lacks words, counting them, and nowhere else', () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    expect(translation(editor)).toEqual({
      ask: { label: `Ask a model for the missing words: ${String(missing(editor))}`, available: true },
      busy: false,
      stop: 'Stop asking',
      discard: null,
      status: '',
      review: null,
      notes: [],
    })
    expect(editor.dispatch({ type: 'setLanguage', locale: 'de-CH' })).toEqual({ ok: true })
    expect(translation(editor).ask).toBeNull()
  })

  // Asked anyway, by a host or a builder that drew a button it should not
  // have, the editor says why nothing is asked: the report's own words are
  // written where they stand, and a language that lacks nothing has
  // nothing to ask for.
  test('refuses to ask in the report’s own language and in one that lacks nothing, asking nobody', async () => {
    const held = heldModel()
    const { editor, session } = editing(held.model)
    editor.dispatch({ type: 'setLanguage', locale: 'de-CH' })
    expect(await editor.askTranslation()).toEqual({
      ok: false,
      code: 'unavailable',
      message: 'The report’s own words are written where they stand: choose another of its languages to ask a model for its words.',
    })
    editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })
    await answered(editor, held)
    editor.dispatch({ type: 'acceptAllTranslations' })
    editor.dispatch({ type: 'applyTranslation' })
    expect(frenchOf(session)?.words.length).toBeGreaterThan(0)
    expect(translation(editor).ask).toBeNull()
    expect(await editor.askTranslation()).toEqual({ ok: false, code: 'unavailable', message: `${FRENCH} lacks no word.` })
    expect(held.turns).toHaveLength(1)
  })

  // While a turn waits, the part says so and offers Stop; nothing has
  // reached the report, and the answer, once it comes, is rows to review,
  // never words written.
  test('waits with Stop, and holds the answer as rows for review, nothing applied', async () => {
    const held = heldModel()
    const { session, editor } = editing(held.model)
    const run = editor.askTranslation()
    expect(held.turns.map(({ prompt }) => [prompt.kind, (JSON.parse(prompt.user) as Asked).into])).toEqual([['translation', 'fr-CH']])
    expect(translation(editor)).toMatchObject({
      busy: true,
      status: `Asking a model for the words ${FRENCH} lacks, and checking its answer.`,
      ask: { available: false },
      review: null,
    })
    const asked = (JSON.parse((held.turns[0] as Turn).prompt.user) as Asked).words
    ;(held.turns[0] as Turn).answer(answerTo((held.turns[0] as Turn).prompt))
    expect(await run).toEqual({ ok: true })
    const state = translation(editor)
    expect(state.busy).toBe(false)
    expect(state.status).toBe(`Words ready to review: ${String(asked.length)}. Nothing has been applied.`)
    expect(state.review?.heading).toBe(`${FRENCH}: a model’s translation, words to review: ${String(asked.length)}`)
    expect(state.review?.rows.map(({ key, source, text, accepted }) => [key, source, text, accepted])).toEqual(
      asked.map(({ key, source }) => [key, source, french(source), false]),
    )
    expect(session.revision()).toBe(0)
  })

  // A row says where its word stands in the editor's own words, and what
  // the focus moving into it selects, so that the design view shows the
  // place; its toggle is named by the text and its source, never the text
  // alone, which two rows may share.
  test('says where each row stands, what its focus selects, and names its toggle by both texts', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    await answered(editor, held)
    const rows = new Map(translation(editor).review?.rows.map((row) => [row.source, row]))
    expect(rows.get('Introduction')).toMatchObject({ where: 'Introduction', target: { id: 'intro' }, toggle: 'Accept “fr Introduction” for “Introduction”' })
    expect(rows.get('Amount')).toMatchObject({ target: { id: 'lines', column: 'amount' } })
    expect(rows.get('Orders')).toMatchObject({ where: 'Title', target: null })
  })

  // A row's focus selects where its word stands, and the review is no part
  // of what is selected: selecting each row's target, as a builder does
  // when the focus moves into it, leaves every row, its acceptance and the
  // heading as they were.
  test('stays as it was while each row’s target is selected in turn', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    await answered(editor, held)
    editor.dispatch({ type: 'acceptTranslation', key: translation(editor).review?.rows[0]?.key as string, accepted: true })
    const before = translation(editor).review
    for (const { target } of before?.rows ?? []) {
      expect(editor.dispatch(target === null ? { type: 'select', id: null } : { type: 'select', ...target })).toEqual({ ok: true })
      expect(translation(editor).review).toEqual(before)
    }
    expect(editor.state().selection).not.toBeNull()
  })

  // A drag or a zoom step builds the state again, and a review of many rows
  // would walk the report's words again each time: the rows are the same
  // while the report, the review and what is accepted are.
  test('keeps its rows while the report and the review stay as they were', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    await answered(editor, held)
    const rows = translation(editor).review?.rows
    expect(editor.dispatch({ type: 'zoomIn' })).toEqual({ ok: true })
    expect(translation(editor).review?.rows).toBe(rows)
    editor.dispatch({ type: 'acceptAllTranslations' })
    expect(translation(editor).review?.rows).not.toBe(rows)
  })

  // A row is drawn against the report as it stands: once the component its
  // word stood in is deleted, it stands nowhere and selects nothing, rather
  // than select what is gone, and Apply then meets the moved report.
  test('says a row whose word the report no longer prints stands nowhere, and selects nothing', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    await answered(editor, held)
    expect(editor.dispatch({ type: 'select', id: 'intro' })).toEqual({ ok: true })
    expect(editor.dispatch({ type: 'delete' })).toEqual({ ok: true })
    const row = translation(editor).review?.rows.find(({ source }) => source === 'Introduction')
    expect(row).toMatchObject({ where: '', target: null })
  })
})

describe('the run held for its language', () => {
  // A French review drawn under Italian would be headed French over an
  // Italian design view, and its Apply would land French: under another
  // language the part says only where the run is (formancy.ai 0164).
  test('is drawn under its own language alone, and under another only said', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const run = editor.askTranslation()
    expect(editor.dispatch({ type: 'setLanguage', locale: 'it-CH' })).toEqual({ ok: true })
    const waiting = `A model is translating into ${FRENCH}. Choose ${FRENCH} to follow it, or to stop it.`
    expect(translation(editor)).toMatchObject({ busy: false, status: waiting, review: null, ask: { available: false } })
    expect(editor.dispatch({ type: 'stopTranslation' })).toEqual({ ok: false, code: 'unavailable', message: waiting })
    ;(held.turns[0] as Turn).answer(answerTo((held.turns[0] as Turn).prompt))
    await run
    const waits = `A model’s translation into ${FRENCH} is waiting for review. Choose ${FRENCH} to review it. Nothing has been applied.`
    expect(translation(editor)).toMatchObject({ status: waits, review: null, notes: [] })
    for (const action of [{ type: 'acceptAllTranslations' }, { type: 'applyTranslation' }, { type: 'discardTranslation' }] as const)
      expect(editor.dispatch(action)).toEqual({ ok: false, code: 'unavailable', message: waits })
    expect(await editor.askTranslation()).toMatchObject({ ok: false, code: 'busy' })
    expect(editor.dispatch({ type: 'setLanguage', locale: 'de-CH' })).toEqual({ ok: true })
    expect(translation(editor)).toMatchObject({ ask: null, status: waits, review: null })
    expect(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(translation(editor).review?.rows.length).toBeGreaterThan(0)
  })

  // A run whose language is gone would wait for good, offered under no
  // language; the editor sees the removal, so the run is stopped, its turn
  // told, and the removal said under every language.
  test('a language removed while its run waits stops the run, tells its model, and says so', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const run = editor.askTranslation()
    expect(editor.dispatch({ type: 'removeLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(held.cancelled).toHaveBeenCalledTimes(1)
    const removed = `${FRENCH} was removed from the report, and the model’s translation into it with it. Nothing has been applied.`
    expect(translation(editor)).toMatchObject({ busy: false, status: removed })
    ;(held.turns[0] as Turn).answer(answerTo((held.turns[0] as Turn).prompt))
    expect(await run).toEqual({ ok: false, code: 'not-answered', message: `${FRENCH} was removed before the model answered, and nothing it answers is held.` })
    expect(editor.dispatch({ type: 'undo' })).toEqual({ ok: true })
    expect(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(translation(editor)).toMatchObject({ status: removed, review: null, ask: { available: true } })
  })

  // A run that came to nothing is over, and its language's removal says
  // nothing of it; a removal said is dismissed by Discard, from any
  // language, so that a report left with no other language is not left
  // with the sentence for good.
  test('says nothing of a run that came to nothing when its language is removed, and a removal said goes with Discard', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const declined = editor.askTranslation()
    ;(held.turns.at(-1) as Turn).answer('{"declined": "No."}')
    await declined
    expect(editor.dispatch({ type: 'removeLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(translation(editor).status).toBe('')
    expect(editor.dispatch({ type: 'undo' })).toEqual({ ok: true })
    editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })
    void editor.askTranslation()
    expect(editor.dispatch({ type: 'removeLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(translation(editor)).toMatchObject({
      status: expect.stringContaining('was removed from the report'),
      discard: { label: 'Discard', available: true },
    })
    expect(editor.dispatch({ type: 'discardTranslation' })).toEqual({ ok: true })
    expect(translation(editor)).toMatchObject({ status: '', discard: null })
  })

  // A review held for a language removed would be applied into none.
  test('a language removed while its review is held takes the review with it', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    await answered(editor, held)
    expect(editor.dispatch({ type: 'removeLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(translation(editor).status).toBe(`${FRENCH} was removed from the report, and the model’s translation into it with it. Nothing has been applied.`)
    expect(editor.dispatch({ type: 'undo' })).toEqual({ ok: true })
    expect(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })).toEqual({ ok: true })
    expect(translation(editor).review).toBeNull()
  })
})

describe('accepting rows', () => {
  // A person who reads French well enough for the headings and not for
  // the terms keeps the ones they can vouch for: each row is a toggle, and
  // Apply counts what is accepted.
  test('accepts a row, takes it back, and accepts every row, Apply counting them', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    await answered(editor, held)
    const rows = translation(editor).review?.rows ?? []
    const [first] = rows
    expect(editor.dispatch({ type: 'acceptTranslation', key: first?.key as string, accepted: true })).toEqual({ ok: true })
    expect(translation(editor).review).toMatchObject({ apply: { label: 'Apply the accepted words: 1', available: true }, acceptAll: { available: true } })
    expect(
      translation(editor)
        .review?.rows.filter((row) => row.accepted)
        .map((row) => row.key),
    ).toEqual([first?.key])
    expect(editor.dispatch({ type: 'acceptTranslation', key: first?.key as string, accepted: false })).toEqual({ ok: true })
    expect(translation(editor).review?.apply).toEqual({ label: 'Apply the accepted words: 0', available: false })
    expect(editor.dispatch({ type: 'applyTranslation' })).toEqual({
      ok: false,
      code: 'unavailable',
      message: 'Nothing is accepted yet: accept a word to apply it.',
    })
    expect(editor.dispatch({ type: 'acceptAllTranslations' })).toEqual({ ok: true })
    expect(translation(editor).review).toMatchObject({ apply: { label: `Apply the accepted words: ${String(rows.length)}` }, acceptAll: { available: false } })
    // A key a caller made up names no row.
    expect(editor.dispatch({ type: 'acceptTranslation', key: 'w999', accepted: true })).toEqual({
      ok: false,
      code: 'not-found',
      message: 'Nothing is called w999.',
    })
  })

  // Pressed twice, a toggle that is already where it is sent changes
  // nothing and tells no listener, so a builder that sends the state it
  // drew draws nothing again; with nothing held, it is refused.
  test('changes nothing for a row or all already accepted, and refuses with nothing held', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const none = { ok: false, code: 'unavailable', message: 'No model’s translation is held here.' }
    expect(editor.dispatch({ type: 'acceptTranslation', key: 'w1', accepted: true })).toEqual(none)
    expect(editor.dispatch({ type: 'acceptAllTranslations' })).toEqual(none)
    expect(editor.dispatch({ type: 'reviewTranslationAgain' })).toEqual(none)
    await answered(editor, held)
    editor.dispatch({ type: 'acceptAllTranslations' })
    const state = editor.state()
    const heard = vi.fn()
    editor.subscribe(heard)
    expect(editor.dispatch({ type: 'acceptAllTranslations' })).toEqual({ ok: true })
    expect(editor.dispatch({ type: 'acceptTranslation', key: state.translation?.review?.rows[0]?.key as string, accepted: true })).toEqual({ ok: true })
    expect(heard).not.toHaveBeenCalled()
    expect(editor.state()).toBe(state)
  })
})

describe('applying what was accepted', () => {
  // One step, whatever the count, so that one Undo takes back exactly what
  // Apply wrote; made against the hash of the report the proposal was made
  // on, so a report that moved refuses it by the session's own rule.
  test('is one undo step, labelled with the language and the count, made with the proposal’s hash', async () => {
    const held = heldModel()
    const session = sessionOver(inTwoLanguages())
    const applied: (EditOptions | undefined)[] = []
    const recorded: ReportSession = { ...session, apply: (command: never, options?: EditOptions) => (applied.push(options), session.apply(command, options)) }
    const editor = createReportEditor(recorded, { model: held.model })
    editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })
    await answered(editor, held)
    const answeredOn = reportHash(session.document())
    const before = missing(editor)
    const keys = keysOf((held.turns[0] as Turn).prompt)
    for (const source of ['Introduction', 'Note']) editor.dispatch({ type: 'acceptTranslation', key: keys.get(source) as string, accepted: true })
    expect(editor.dispatch({ type: 'applyTranslation' })).toEqual({ ok: true })
    expect(session.revision()).toBe(1)
    expect(applied.at(-1)).toEqual({ label: `Translate words into ${FRENCH}: 2`, expectedHash: answeredOn })
    expect(frenchOf(session)?.words).toEqual([
      { word: 'Introduction', text: 'fr Introduction' },
      { word: 'Note', text: 'fr Note' },
    ])
    expect(missing(editor)).toBe(before - 2)
    expect(editor.state().status.text).toBe(`Translated into ${FRENCH}, words: 2. Words still missing: ${String(before - 2)}.`)
    expect(editor.state().history.undoLabel).toBe(`Translate words into ${FRENCH}: 2`)
    expect(translation(editor)).toMatchObject({ review: null, status: '', ask: { available: true } })
    expect(editor.dispatch({ type: 'undo' })).toEqual({ ok: true })
    expect(frenchOf(session)?.words).toEqual([])
    expect(missing(editor)).toBe(before)
  })

  // Two editors in two languages read one history: the step a person
  // applied in English is said in Swiss German by the other.
  test('is said in each editor’s own words', async () => {
    const held = heldModel()
    const { session, editor } = editing(held.model)
    await answered(editor, held)
    editor.dispatch({ type: 'acceptAllTranslations' })
    editor.dispatch({ type: 'applyTranslation' })
    const count = frenchOf(session)?.words.length ?? 0
    expect(missing(editor)).toBe(0)
    expect(editor.state().status.text).toBe(`Translated into ${FRENCH}, words: ${String(count)}. It lacks no word now.`)
    expect(createReportEditor(session, { locale: 'de-CH' }).state().history.undoLabel).toBe(`Wörter auf Französisch (Schweiz) übersetzen: ${String(count)}`)
  })

  // A word a person wrote while the review was held is theirs: Apply is
  // refused whole by the session, nothing changed, and Review again reads
  // the same answer against the report as it stands, with no new turn,
  // leaving that word out and saying why.
  test('is refused once the report moved, and Review again leaves out what a person wrote', async () => {
    const held = heldModel()
    const { session, editor } = editing(held.model)
    await answered(editor, held)
    const keys = keysOf((held.turns[0] as Turn).prompt)
    editor.dispatch({ type: 'acceptAllTranslations' })
    expect(session.apply({ command: 'translateWord', args: ['fr-CH', 'Introduction', 'Présentation'] }).ok).toBe(true)
    const moved = session.revision()
    const stale = 'Not applied: the report has changed since the model answered. Review again to read its answer against the report as it is now.'
    expect(editor.dispatch({ type: 'applyTranslation' })).toMatchObject({ ok: false, code: 'refused', message: stale, refusal: { code: 'stale-document' } })
    expect(session.revision()).toBe(moved)
    expect(translation(editor)).toMatchObject({ status: stale, review: { reviewAgain: { label: 'Review again', available: true } } })
    editor.dispatch({ type: 'acceptTranslation', key: keys.get('Note') as string, accepted: false })
    expect(editor.dispatch({ type: 'reviewTranslationAgain' })).toEqual({ ok: true })
    expect(held.turns).toHaveLength(1)
    const again = translation(editor)
    expect(again.review?.reviewAgain).toBeNull()
    expect(again.review?.rows.map((row) => row.key)).not.toContain(keys.get('Introduction'))
    expect(again.review?.rows.filter((row) => !row.accepted).map((row) => row.source)).toEqual(['Note'])
    expect(again.notes).toContain('Not written, because a person has written them since: “Introduction”')
    expect(editor.dispatch({ type: 'applyTranslation' })).toEqual({ ok: true })
    expect(frenchOf(session)?.words.find(({ word }) => word === 'Introduction')?.text).toBe('Présentation')
  })

  // What the session refuses for any other reason is said in its words,
  // beside Review again: the part never says a refused Apply landed.
  test('says another refusal in the session’s words', async () => {
    const held = heldModel()
    const session = sessionOver(inTwoLanguages())
    const refusing = {
      ...session,
      apply: (command: never, options?: EditOptions) =>
        options?.expectedHash === undefined
          ? session.apply(command, options)
          : {
              ok: false,
              code: 'invalid-document',
              message: 'invalid',
              errors: [{ code: 'too-long', path: '/translations/0', message: 'the list is too long' }],
            },
    } as ReportSession
    const editor = createReportEditor(refusing, { model: held.model })
    editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' })
    await answered(editor, held)
    editor.dispatch({ type: 'acceptAllTranslations' })
    expect(editor.dispatch({ type: 'applyTranslation' })).toMatchObject({ ok: false, code: 'refused', message: 'Not applied: the list is too long' })
    expect(translation(editor).review?.reviewAgain).not.toBeNull()
  })
})

describe('a run that ends, or is ended', () => {
  // Discard forgets what is held and a run that waits: its model is told,
  // and an answer arriving later is held for nobody (formancy.ai 0157).
  test('Discard forgets a waiting run, and its later answer is never held', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const run = editor.askTranslation()
    expect(editor.dispatch({ type: 'discardTranslation' })).toEqual({ ok: true })
    expect(held.cancelled).toHaveBeenCalledTimes(1)
    expect(editor.state().status.text).toBe(`Discarded the model’s translation into ${FRENCH}. Nothing has been applied.`)
    ;(held.turns[0] as Turn).answer(answerTo((held.turns[0] as Turn).prompt))
    expect(await run).toMatchObject({ ok: false, code: 'not-answered' })
    expect(translation(editor)).toMatchObject({ busy: false, status: '', review: null, ask: { available: true } })
  })

  // An answer to a run discarded and asked again is not the second run's
  // answer: only the run in flight lands, so the first's ending never
  // overwrites the second waiting (formancy.ai 0164's D10).
  test('lands only while it is the one in flight', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const first = editor.askTranslation()
    editor.dispatch({ type: 'discardTranslation' })
    const second = editor.askTranslation()
    expect(await first).toMatchObject({ ok: false, code: 'not-answered' })
    expect(translation(editor)).toMatchObject({ busy: true })
    ;(held.turns[1] as Turn).answer(answerTo((held.turns[1] as Turn).prompt))
    expect(await second).toEqual({ ok: true })
    expect(translation(editor).review).not.toBeNull()
  })

  // Stop ends the run as stopped, said; nothing more is asked, and Ask is
  // offered again.
  test('Stop ends it as stopped, its model told, and asks nothing more', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const run = editor.askTranslation()
    expect(editor.dispatch({ type: 'stopTranslation' })).toEqual({ ok: true })
    expect(await run).toEqual({ ok: false, code: 'not-answered', message: 'Stopped. Nothing has been applied.' })
    expect(held.cancelled).toHaveBeenCalledTimes(1)
    expect(held.turns).toHaveLength(1)
    expect(translation(editor)).toMatchObject({ busy: false, status: 'Stopped. Nothing has been applied.', ask: { available: true } })
    expect(editor.dispatch({ type: 'stopTranslation' })).toEqual({ ok: false, code: 'unavailable', message: 'No model is being asked.' })
  })

  // Each way a run ends without an answer is said as itself, so that a
  // person does not reword a request when the network was down.
  test('says a decline with its reason, a model it could not reach, and one that never answered as asked', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const declined = editor.askTranslation()
    ;(held.turns.at(-1) as Turn).answer('{"declined": "I do not write Swiss French."}')
    expect(await declined).toMatchObject({ code: 'not-answered' })
    expect(translation(editor).status).toBe('Nothing has been applied. The model declined, and said why: I do not write Swiss French.')
    const offline = editor.askTranslation()
    ;(held.turns.at(-1) as Turn).fail(new Error('offline'))
    await offline
    expect(translation(editor).status).toBe('Nothing has been applied. The model could not be reached: offline')
    const prose = editor.askTranslation()
    for (let turn = 0; turn < 3; turn += 1) {
      await vi.waitFor(() => expect(held.turns).toHaveLength(3 + turn))
      ;(held.turns.at(-1) as Turn).answer('Bonjour.')
    }
    await prose
    expect(translation(editor)).toMatchObject({
      status: `Nothing has been applied. Attempts: 3, and the answer was still no translation into ${FRENCH}.`,
      ask: { available: true },
    })
  })

  // A model busy with another request was asked nothing, and one that
  // failed with nothing to say is still said as unreachable, never as an
  // answer that was wrong.
  test('says a model busy with another request, and one it could not reach that gave no reason', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const busy = editor.askTranslation()
    ;(held.turns.at(-1) as Turn).fail(new ModelBusyError())
    await busy
    expect(translation(editor).status).toBe('Nothing has been applied. The model is answering another request: finish or stop that one first.')
    const silent = editor.askTranslation()
    ;(held.turns.at(-1) as Turn).fail(42)
    await silent
    expect(translation(editor).status).toBe('Nothing has been applied. The model could not be reached.')
    // A run that came to nothing is over, said under its own language alone.
    editor.dispatch({ type: 'setLanguage', locale: 'it-CH' })
    expect(translation(editor)).toMatchObject({ status: '', ask: { available: true } })
    expect(editor.dispatch({ type: 'discardTranslation' })).toEqual({ ok: false, code: 'unavailable', message: 'No model’s translation is held here.' })
  })

  // A request past the bound a host's server reads a body under is never
  // sent, and the part says how large it would be (0085).
  test('says a request too large to send, asking nobody', async () => {
    const held = heldModel()
    const report = inTwoLanguages()
    const long = (index: number): TextComponent => ({
      id: `long-${String(index)}`,
      kind: 'text',
      content: [{ kind: 'text', text: `Wort ${String(index)} ${'a'.repeat(MAX_TEXT_LENGTH - 20)}` }],
    })
    const body = [...report.regions.body, ...Array.from({ length: 30 }, (_, index) => long(index))]
    const { editor } = editing(held.model, { ...report, regions: { ...report.regions, body } })
    expect(await editor.askTranslation()).toMatchObject({
      ok: false,
      code: 'not-answered',
      message: expect.stringMatching(/^Nothing was asked\. The request would be [\d,]+ bytes, past the 262,144 a request may have/),
    })
    expect(held.turns).toEqual([])
  })

  // An editor its host closed asks nobody.
  test('refuses to ask once the editor is disposed', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    editor.dispose()
    expect(await editor.askTranslation()).toMatchObject({ ok: false, code: 'disposed' })
    expect(held.turns).toEqual([])
  })

  // A host's onCancel, or a relay's subscriber, that throws while the
  // editor ends a run must not leave the run said as waiting with nothing
  // behind it, every action refused: the editor changes its state first
  // and tells the host after, and what the host threw surfaces once the
  // action is done, as a session listener's does (0008).
  test('a language removed while its run waits ends the run even when the host’s stop throws', async () => {
    const turns: Turn[] = []
    const ask: AskModel<RequestKind> = (prompt, turn) =>
      new Promise<string>((answer, fail) => {
        turns.push({ prompt, answer, fail })
        turn.onCancel(() => {
          throw new Error('the host failed to cancel')
        })
      })
    const { editor } = editing({ ask })
    const run = editor.askTranslation()
    expect(() => editor.dispatch({ type: 'removeLanguage', locale: 'fr-CH' })).toThrow('the host failed to cancel')
    expect(editor.state().languages.edited).toBe('de-CH')
    expect(translation(editor).status).toBe(`${FRENCH} was removed from the report, and the model’s translation into it with it. Nothing has been applied.`)
    expect(await run).toMatchObject({ ok: false, code: 'not-answered' })
    expect(editor.dispatch({ type: 'setLanguage', locale: 'it-CH' })).toEqual({ ok: true })
    expect(translation(editor).ask?.available).toBe(true)
  })

  // The same through a relay, whose turn a stop clears and whose
  // subscriber throws as it hears so: Discard leaves nothing held, and Stop
  // ends the run as stopped.
  test('Discard and Stop end the run when a relay’s subscriber throws as its turn is cleared', async () => {
    const relay = createRelay<RequestKind>()
    relay.subscribe(() => {
      if (relay.waiting() === undefined) throw new Error('the subscriber failed')
    })
    const { editor } = editing({ ask: relay.ask })
    const discarded = editor.askTranslation()
    expect(relay.waiting()).toBeDefined()
    expect(() => editor.dispatch({ type: 'discardTranslation' })).toThrow('the subscriber failed')
    expect(translation(editor)).toMatchObject({ busy: false, status: '', ask: { available: true } })
    expect(await discarded).toMatchObject({ ok: false, code: 'not-answered' })
    const stopped = editor.askTranslation()
    expect(() => editor.dispatch({ type: 'stopTranslation' })).toThrow('the subscriber failed')
    expect(await stopped).toEqual({ ok: false, code: 'not-answered', message: 'Stopped. Nothing has been applied.' })
    expect(translation(editor)).toMatchObject({ busy: false, status: 'Stopped. Nothing has been applied.', ask: { available: true } })
  })

  // A run waiting in an editor the host disposed would be paid for, for
  // an answer nothing will show.
  test('is stopped when the editor is disposed, and says so', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const run = editor.askTranslation()
    editor.dispose()
    expect(held.cancelled).toHaveBeenCalledTimes(1)
    expect(await run).toMatchObject({ ok: false, code: 'disposed' })
  })
})

describe('what an answer says outside its rows', () => {
  // A refused entry and one nobody asked are never rows, and a person
  // reads why under the table; a word of the payment part is never asked,
  // and is said as a person's to write.
  test('says what was refused and why, what was dropped, and what is a person’s to write', async () => {
    const held = heldModel()
    const { editor } = editing(held.model, inTwoLanguages(billedReport()))
    const run = editor.askTranslation()
    const turn = held.turns[0] as Turn
    const hebrew = (source: string): string => (source === 'Introduction' ? 'הקדמה' : french(source))
    const answer = JSON.parse(answerTo(turn.prompt, hebrew)) as { words: Record<string, string> }
    turn.answer(JSON.stringify({ ...answer, words: { ...answer.words, w99: 'fr Inventé' } }))
    await run
    const { notes, review } = translation(editor)
    expect(review?.rows.map((row) => row.source)).not.toContain('Introduction')
    expect(notes).toEqual([
      expect.stringMatching(/^Refused, “הקדמה” for “Introduction”: it holds U\+05D4, of a script a report does not print/),
      'Not written, because nobody asked for them: “w99”',
      'For a person to write, since they stand in the payment part: “Orders”',
    ])
  })

  // A key a model wrote under the other member names no source: quoted by
  // what the request asked under it, the note would say a word nobody
  // asked for is one that stands in the review as a row.
  test('quotes a key written under the wrong member as the key it is', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const run = editor.askTranslation()
    const turn = held.turns[0] as Turn
    const answer = JSON.parse(answerTo(turn.prompt)) as { words: Record<string, string>; expressions: Record<string, string> }
    turn.answer(JSON.stringify({ ...answer, expressions: { w1: '"fr"' } }))
    await run
    expect(translation(editor).notes).toEqual(['Not written, because nobody asked for them: “w1”'])
    expect(translation(editor).review?.rows.map((row) => row.key)).toContain('w1')
  })

  // A word a person put into the payment part while the model answered is
  // a person's to write, said once with the payment part's other words,
  // not again as a word dropped.
  test('says a word put into the payment part meanwhile once, with the payment part’s words', async () => {
    const held = heldModel()
    const { editor, session } = editing(held.model, inTwoLanguages(billedReport()))
    const run = editor.askTranslation()
    expect(session.apply({ command: 'updatePaymentPart', args: [{ message: [{ kind: 'text', text: 'Introduction' }] }] }).ok).toBe(true)
    ;(held.turns[0] as Turn).answer(answerTo((held.turns[0] as Turn).prompt))
    await run
    const { notes, review } = translation(editor)
    expect(review?.rows.map((row) => row.source)).not.toContain('Introduction')
    expect(notes.filter((note) => note.includes('“Introduction”'))).toEqual(['For a person to write, since they stand in the payment part: “Introduction”'])
  })

  // A language with no room left that still lacks words is not one that
  // lacks nothing: nothing is asked, and the part says why, and how many
  // were left for another run once these land (0085's `later`, `noRoom`).
  test('says what was left for another run, and a language with no room left for more', async () => {
    const held = heldModel()
    const report = inTwoLanguages()
    const orphans = Array.from({ length: MAX_WORDS - 2 }, (_, index) => ({ word: `Gone ${String(index)}`, text: `Parti ${String(index)}` }))
    const full = { ...report, translations: [{ locale: 'fr-CH', words: orphans, expressions: [] }, ...(report.translations ?? []).slice(1)] }
    const { editor } = editing(held.model, full)
    const lacking = missing(editor)
    await answered(editor, held)
    const room = `${FRENCH} holds as many words as a language may, 1,024: no more are asked for until some are removed.`
    expect(translation(editor).review?.rows).toHaveLength(2)
    expect(translation(editor).notes).toEqual([`Not asked in this run, words: ${String(lacking - 2)}`, room])
    editor.dispatch({ type: 'acceptAllTranslations' })
    editor.dispatch({ type: 'applyTranslation' })
    expect(await editor.askTranslation()).toEqual({ ok: true })
    expect(held.turns).toHaveLength(1)
    expect(translation(editor)).toMatchObject({
      status: `Nothing was asked: no word ${FRENCH} lacks is one a model may be asked for, as said below.`,
      review: null,
      notes: [`Not asked in this run, words: ${String(lacking - 2)}`, room],
      ask: { available: true },
    })
  })
})

describe('an answer with nothing to apply', () => {
  // A model that left every word empty and one whose every word was
  // refused are two things a person does two things about: ask again, or
  // read why. Neither is held for review, and Ask is offered again
  // (formancy.ai 0161).
  test('says a model that wrote nothing apart from one whose every word was refused, and offers Ask again', async () => {
    const held = heldModel()
    const { editor } = editing(held.model)
    const lacking = missing(editor)
    await answered(editor, held, () => '')
    expect(translation(editor)).toMatchObject({
      status: 'The model left every word untranslated. Nothing has been applied.',
      review: null,
      notes: [`Left untranslated by the model, words: ${String(lacking)}`],
      ask: { available: true },
    })
    await answered(editor, held, () => 'הקדמה')
    const refused = translation(editor)
    expect(refused).toMatchObject({
      status: 'The model wrote words, and none of them can be applied: each is listed below, with why. Nothing has been applied.',
      review: null,
      ask: { available: true },
    })
    expect(refused.notes).toHaveLength(lacking)
  })

  // A language that lacks more words than one batch holds is asked for a
  // batch, and the rest is said as left for the next run, once these land.
  test('says what is left for another run past one batch', async () => {
    const held = heldModel()
    const report = inTwoLanguages()
    const texts = Array.from({ length: Math.ceil((MAX_BATCH_COMMANDS + 1) / MAX_INLINES) }, (_, text): TextComponent => ({
      id: `words-${String(text)}`,
      kind: 'text',
      content: Array.from({ length: MAX_INLINES }, (_, run) => ({ kind: 'text', text: `Wort ${String(text * MAX_INLINES + run)} ` })),
    }))
    const { editor } = editing(held.model, { ...report, regions: { ...report.regions, body: [...report.regions.body, ...texts] } })
    const lacking = missing(editor)
    await answered(editor, held)
    expect(translation(editor).review?.rows).toHaveLength(MAX_BATCH_COMMANDS)
    expect(translation(editor).notes).toEqual([`Left for another run, once these are applied, words: ${String(lacking - MAX_BATCH_COMMANDS)}`])
  })
})

describe('a model’s translation in another editor language', () => {
  // Every word of the part is the catalogue's: a Swiss German editor
  // says the review in Swiss German, the language named by Intl.
  test('says the review in the editor’s own words', async () => {
    const held = heldModel()
    const { editor } = editing(held.model, inTwoLanguages(), 'de-CH')
    await answered(editor, held)
    const state = translation(editor)
    expect(state.review?.heading).toMatch(/^Französisch \(Schweiz\): die Übersetzung eines Modells, zu prüfende Wörter: \d+$/)
    expect(state.review?.rows[0]?.toggle).toMatch(/^«fr .+» für «.+» annehmen$/)
    expect(state.review?.columns).toEqual({ source: 'Deutsch (Schweiz)', where: 'Wo es steht', text: 'Französisch (Schweiz)', accepted: 'Angenommen' })
  })
})
