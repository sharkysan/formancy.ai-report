/**
 * A run set below or above the line from what a person selected (0061):
 * the selection snapped to whole characters and split from its run, a bound
 * run set whole, and only the run a press set joined to the literal runs
 * beside it on its baseline; and the editor's action that makes a press
 * one edit through the session, or refuses it with the report unchanged.
 */
import type { ReportSession } from '@formancy/report-core'
import { componentAt, MAX_INLINES } from '@formancy/report-spec'
import type { Inline, ReportDefinition, TextComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { setBaseline } from './baselines.js'
import type { ReportEditor } from './editor.js'
import type { EditorAction } from './model-actions.js'
import { editorOver, richReport } from './test-support.js'

const text = (value: string, baseline?: 'subscript' | 'superscript'): Inline => ({ kind: 'text', text: value, ...(baseline === undefined ? {} : { baseline }) })
const field: Inline = { kind: 'field', field: { dataset: 'header', field: 'power' } }

describe('setBaseline', () => {
  // The digit of H2O selected in its one run: three runs, the middle one
  // lowered, and the press says where it stands, so the keyboard can follow
  // it there. Set whole, the formula would print every letter lowered.
  test('splits the selected characters from their run and sets them', () => {
    expect(setBaseline([text('H2O')], 0, 'subscript', { start: 1, end: 2 })).toEqual({
      content: [text('H'), text('2', 'subscript'), text('O')],
      at: 1,
    })
    expect(setBaseline([text('m2')], 0, 'superscript', { start: 1, end: 2 })).toEqual({ content: [text('m'), text('2', 'superscript')], at: 1 })
    expect(setBaseline([text('10-3 s')], 0, 'superscript', { start: 2, end: 4 })).toEqual({
      content: [text('10'), text('-3', 'superscript'), text(' s')],
      at: 1,
    })
  })

  // A selection that cuts a character in two -- an accent from its letter,
  // half of an emoji's surrogate pair -- would leave a run of a mark alone,
  // or of half a character the face cannot draw. It is widened to the whole
  // characters it touches, as Intl.Segmenter counts graphemes.
  test('snaps a selection to whole characters, never cutting one', () => {
    const accented = 'Aéx'
    expect(setBaseline([text(accented)], 0, 'superscript', { start: 2, end: 3 })).toEqual({
      content: [text('A'), text('é', 'superscript'), text('x')],
      at: 1,
    })
    const emoji = 'a\u{1F600}b'
    expect(setBaseline([text(emoji)], 0, 'subscript', { start: 2, end: 3 })).toEqual({
      content: [text('a'), text('\u{1F600}', 'subscript'), text('b')],
      at: 1,
    })
  })

  // Nothing selected, or everything, is the whole run: a press with the
  // caret in the field sets what it stands in, and makes no empty run on
  // either side.
  test('sets the whole run when nothing, or all of it, is selected', () => {
    expect(setBaseline([text('a'), text('2')], 1, 'superscript', { start: 1, end: 1 })).toEqual({ content: [text('a'), text('2', 'superscript')], at: 1 })
    expect(setBaseline([text('a'), text('2')], 1, 'superscript', { start: 0, end: 1 })).toEqual({ content: [text('a'), text('2', 'superscript')], at: 1 })
    expect(setBaseline([text('a'), text('2')], 1, 'superscript')).toEqual({ content: [text('a'), text('2', 'superscript')], at: 1 })
  })

  // A field's value is not known until print, so a range in its control --
  // an expression's source, say -- means nothing: it is set whole.
  test('sets a bound run whole, whatever is selected', () => {
    expect(setBaseline([text('10'), field], 1, 'superscript', { start: 0, end: 2 })).toEqual({
      content: [text('10'), { ...field, baseline: 'superscript' }],
      at: 1,
    })
    expect(setBaseline([text('10'), { ...field, baseline: 'superscript' }], 1, null)).toEqual({ content: [text('10'), field], at: 1 })
  })

  // A pressed button sets its text back on the line: the run takes no
  // `baseline` key at all, which is how the format says "on the line", and
  // it joins the literal runs on the line beside it, so H2O is one run
  // again rather than three a person would have to edit apart.
  test('sets a run back on the line and joins it to its neighbours there', () => {
    expect(setBaseline([text('H'), text('2', 'subscript'), text('O')], 1, null)).toEqual({ content: [text('H2O')], at: 0 })
    const [only] = setBaseline([text('H'), text('2', 'subscript'), text('O')], 1, null).content
    expect(only).not.toHaveProperty('baseline')
    // Part of a lowered run set back on the line, beside the line's text before it.
    expect(setBaseline([text('H'), text('23', 'subscript')], 1, null, { start: 0, end: 1 })).toEqual({
      content: [text('H2'), text('3', 'subscript')],
      at: 0,
    })
  })

  // A run set to the baseline of the run beside it is joined to it, so
  // the content stays in as few runs as it can; a bound run beside it is
  // never joined, as a value is no text.
  test('joins the run it set to a literal neighbour on the same baseline, and never to a bound one', () => {
    expect(setBaseline([text('x'), text('2', 'superscript'), text('3')], 2, 'superscript')).toEqual({ content: [text('x'), text('23', 'superscript')], at: 1 })
    expect(setBaseline([{ ...field, baseline: 'subscript' }, text('2')], 1, 'subscript')).toEqual({
      content: [{ ...field, baseline: 'subscript' }, text('2', 'subscript')],
      at: 1,
    })
  })

  // Runs a host or a paste wrote apart, elsewhere in the content, are the
  // person's: a press joins only the run it set, and two literal runs
  // side by side that it did not touch stay two (0061).
  test('leaves runs it did not set as they were, joined or not', () => {
    const content = [text('Order '), text('No. '), text('H2O')]
    expect(setBaseline(content, 2, 'subscript', { start: 1, end: 2 })).toEqual({
      content: [text('Order '), text('No. '), text('H'), text('2', 'subscript'), text('O')],
      at: 3,
    })
  })

  // A split never makes a run of nothing: a selection at the run's start
  // or end makes two runs, not three with one empty.
  test('makes no empty run', () => {
    const split = setBaseline([text('CO2')], 0, 'subscript', { start: 2, end: 3 })
    expect(split).toEqual({ content: [text('CO'), text('2', 'subscript')], at: 1 })
    expect(setBaseline([text('2x')], 0, 'superscript', { start: 0, end: 1 })).toEqual({ content: [text('2', 'superscript'), text('x')], at: 0 })
    for (const run of split.content) expect(run.kind === 'text' && run.text !== '').toBe(true)
  })
})

describe('the setBaseline action', () => {
  /** The rich report with its introduction's text replaced by `content`. */
  function withIntro(content: readonly Inline[]): ReportDefinition {
    const report = richReport()
    const body = report.regions.body.map((component) => (component.id === 'intro' && component.kind === 'text' ? { ...component, content } : component))
    return { ...report, regions: { ...report.regions, body } }
  }

  /** The introduction's runs as the session has them. */
  const intro = (session: ReportSession): readonly Inline[] => (componentAt(session.document(), 'intro')?.component as TextComponent).content

  function opened(content: readonly Inline[]): { readonly editor: ReportEditor; readonly session: ReportSession } {
    const over = editorOver(withIntro(content))
    expect(over.editor.dispatch({ type: 'select', id: 'intro' }).ok).toBe(true)
    return over
  }

  // A press is one edit through the session, named in the history and
  // undone whole: an undo that took back half a split would leave a
  // formula with a run of nothing (0008). It says where the keyboard goes,
  // the pressed button of the run that holds the text it set, which the
  // split moved: the builders follow it, and neither works it out.
  test('splits what is selected in one undo step, and sends the keyboard to the run it set', () => {
    const { editor, session } = opened([text('H2O')])
    const outcome = editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected: { start: 1, end: 2, text: 'H2O' } })
    expect(outcome).toEqual({ ok: true, then: { group: '/content/1', button: 0 } })
    expect(intro(session)).toEqual([text('H'), text('2', 'subscript'), text('O')])
    expect(editor.state().status.text).toBe('Set Text below the line.')
    expect(editor.state().history.undoLabel).toBe('Set below the line')
    expect(editor.dispatch({ type: 'undo' }).ok).toBe(true)
    expect(intro(session)).toEqual([text('H2O')])
    expect(editor.dispatch({ type: 'redo' }).ok).toBe(true)
    expect(intro(session)).toEqual([text('H'), text('2', 'subscript'), text('O')])
    // The pressed button sets its run back on the line, joined, and the keyboard goes to the button it pressed.
    expect(editor.dispatch({ type: 'setBaseline', key: '/content/1', baseline: null })).toEqual({ ok: true, then: { group: '/content/0', button: 0 } })
    expect(intro(session)).toEqual([text('H2O')])
    expect(editor.state().status.text).toBe('Set Part 2: Text back on the line.')
  })

  // A field's value is known only at print, so the characters selected in
  // its control mean nothing: the whole run is raised, Superscript's
  // button the keyboard's.
  test('sets a bound run whole, whatever its control had selected', () => {
    const { editor, session } = opened([text('10'), { kind: 'parameter', parameter: 'from' }])
    const outcome = editor.dispatch({ type: 'setBaseline', key: '/content/1', baseline: 'superscript', selected: { start: 0, end: 2, text: 'other' } })
    expect(outcome).toEqual({ ok: true, then: { group: '/content/1', button: 1 } })
    expect(intro(session)).toEqual([text('10'), { kind: 'parameter', parameter: 'from', baseline: 'superscript' }])
  })

  // A value the session refused stays in its field as typed, and the
  // selection a builder reads is of that text: applied to the report's,
  // its offsets would set the wrong characters below the line. Refused,
  // and said why, the report unchanged, with nothing selected in it too,
  // where the whole run would be set from a field that shows other text --
  // as is a selection no field could give, from a caller tsc never saw.
  test('refuses a selection of other text than the report holds', () => {
    const { editor, session } = opened([text('H2O')])
    for (const selected of [
      { start: 2, end: 2, text: 'H2SO4' },
      { start: 1, end: 2, text: 'H2SO4' },
    ]) {
      const stale = editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected })
      expect(stale, JSON.stringify(selected)).toMatchObject({ ok: false, code: 'invalid-value' })
      expect(editor.state().status.text).toBe(
        'Text shows what was typed, not what the report holds: commit it, or press Escape, before setting part of it below or above the line.',
      )
    }
    for (const selected of [null, 'H2O', { start: 2, end: 1, text: 'H2O' }, { start: 0, end: 9, text: 'H2O' }, { start: 0.5, end: 2, text: 'H2O' }]) {
      const action = { type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected } as unknown as EditorAction
      expect(editor.dispatch(action), JSON.stringify(selected)).toMatchObject({ ok: false, code: 'invalid-value' })
    }
    expect(intro(session)).toEqual([text('H2O')])
    expect(editor.state().history.canUndo).toBe(false)
  })

  // In another language the field shows the translation, and a selection
  // of its characters means nothing in the report's own run: applied, its
  // offsets would set other characters off the line in every language, and
  // refused as a stale value, the person would be told to commit what they
  // never typed (0063). Part of a run is refused, saying where it is set,
  // the report unchanged; nothing or all of it selected sets the run whole,
  // in every language, as a run's other properties are.
  test('sets a run whole from another language, and refuses part of it there, saying where it is set', () => {
    const report = { ...withIntro([text('Water')]), translations: [{ locale: 'fr-CH', words: [{ word: 'Water', text: 'Eau' }], expressions: [] }] }
    const { editor, session } = editorOver(report)
    expect(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }).ok).toBe(true)
    expect(editor.dispatch({ type: 'select', id: 'intro' }).ok).toBe(true)
    const part = editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected: { start: 0, end: 1, text: 'Eau' } })
    expect(part).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.state().status.text).toBe(
      "Part of Text is set below or above the line in the report's own language: switch to it, or select nothing to set all of Text.",
    )
    expect(intro(session)).toEqual([text('Water')])
    expect(editor.state().history.canUndo).toBe(false)
    for (const selected of [
      { start: 1, end: 1, text: 'Eau' },
      { start: 0, end: 3, text: 'Eau' },
    ]) {
      expect(editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected }), JSON.stringify(selected)).toMatchObject({ ok: true })
      expect(intro(session)).toEqual([text('Water', 'subscript')])
      expect(editor.dispatch({ type: 'undo' }).ok).toBe(true)
    }
    // A selection no field could give is refused there too, as in the report's own language.
    const action = { type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected: null } as unknown as EditorAction
    expect(editor.dispatch(action)).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(intro(session)).toEqual([text('Water')])
  })

  // A text field gives back a line broken by CR LF, or by CR alone, as LF,
  // as the platform reads a textarea's value: a run a host, a paste or a
  // proposal wrote so -- which the format takes and the renderer prints as
  // a line break -- never showed its field the text the report holds, and
  // every press on it was refused as a stale value no commit or Escape
  // could change. The field's text is read as the run's, and its offsets
  // counted back into the run's, CR LF two units there.
  test('sets the characters selected in a run that breaks its line with CR LF, as its field shows it', () => {
    const { editor, session } = opened([text('Water:\r\nH2O\rCO2')])
    const lowered = editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected: { start: 8, end: 9, text: 'Water:\nH2O\nCO2' } })
    expect(lowered).toEqual({ ok: true, then: { group: '/content/1', button: 0 } })
    expect(intro(session)).toEqual([text('Water:\r\nH'), text('2', 'subscript'), text('O\rCO2')])
    // After the lone CR, which the field shows as one LF as well.
    expect(editor.dispatch({ type: 'setBaseline', key: '/content/2', baseline: 'subscript', selected: { start: 4, end: 5, text: 'O\nCO2' } }).ok).toBe(true)
    expect(intro(session)).toEqual([text('Water:\r\nH'), text('2', 'subscript'), text('O\rCO'), text('2', 'subscript')])
    // A selection that ends after a line break takes its CR LF whole, never half of it.
    const { editor: other, session: second } = opened([text('a\r\nb')])
    expect(other.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'superscript', selected: { start: 0, end: 2, text: 'a\nb' } }).ok).toBe(true)
    expect(intro(second)).toEqual([text('a\r\n', 'superscript'), text('b')])
  })

  // A key that names no run with a baseline to set -- past the content's
  // end, a page counter's, nothing at all, or of no text component -- and
  // a baseline the format does not have are refused, never thrown on, the
  // latter as a value that is none of the options, not as a name that
  // names nothing.
  test('refuses what names no run with a baseline, and a baseline the format lacks', () => {
    const { editor, session } = editorOver()
    expect(editor.dispatch({ type: 'select', id: 'page-of' }).ok).toBe(true)
    for (const key of ['/content/1', '/content/9', '/content', 'content/0', 3]) {
      const action = { type: 'setBaseline', key, baseline: 'superscript' } as unknown as EditorAction
      expect(editor.dispatch(action), String(key)).toMatchObject({ ok: false, code: 'not-found' })
    }
    const sideways = { type: 'setBaseline', key: '/content/0', baseline: 'sideways' } as unknown as EditorAction
    expect(editor.dispatch(sideways)).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(editor.state().status.text).toBe('Choose one of the options.')
    expect(editor.dispatch({ type: 'select', id: 'order-code' }).ok).toBe(true)
    expect(editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'superscript' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.dispatch({ type: 'select', id: null }).ok).toBe(true)
    expect(editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'superscript' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(session.canUndo()).toBe(false)
  })

  // A run's group is part of every text, and holds no Add or Remove: a
  // host that sends either for it is told so, about the text. Before 0061
  // a text had no groups and both were refused as naming nothing; the
  // refusal that followed the groups was the QR-bill's, which says a part
  // is part of every bill.
  test("refuses to add or remove a run's group, saying it is part of the text", () => {
    const { editor, session } = opened([text('H2O'), text(' and more')])
    for (const type of ['addGroup', 'removeGroup'] as const) {
      expect(editor.dispatch({ type, key: '/content/1' }), type).toMatchObject({ ok: false, code: 'unavailable' })
      expect(editor.state().status.text).toBe('Part 2: Text is part of the text: it is edited in its field, never added or removed.')
    }
    expect(session.canUndo()).toBe(false)
  })

  // The state never offers a press that changes nothing -- a pressed
  // button sends `null` -- but a caller may send one: no empty step is
  // put in the history for it.
  test('refuses a press that would change nothing', () => {
    const { editor, session } = opened([text('a'), text('2', 'superscript')])
    expect(editor.dispatch({ type: 'setBaseline', key: '/content/1', baseline: 'superscript' })).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.state().status.text).toBe('Part 2: Text is set so already.')
    expect(session.canUndo()).toBe(false)
  })

  // A split adds up to two runs, and a paragraph holds at most
  // MAX_INLINES: the validator refuses a split past it when the session
  // applies the edit, with its reason, and nothing changes (0008). A
  // check of its own here would be a second rule, which nobody would find
  // disagreeing with report-spec's.
  test('refuses a split past MAX_INLINES, the report unchanged', () => {
    const content = [...Array.from({ length: MAX_INLINES - 2 }, () => text('x', 'subscript')), text('H2O')]
    const { editor, session } = opened(content)
    const outcome = editor.dispatch({
      type: 'setBaseline',
      key: `/content/${String(MAX_INLINES - 2)}`,
      baseline: 'superscript',
      selected: { start: 1, end: 2, text: 'H2O' },
    })
    expect(outcome).toMatchObject({ ok: false, code: 'refused' })
    expect(intro(session)).toEqual(content)
    expect(session.canUndo()).toBe(false)
    expect(editor.state().status.text.startsWith(`Part ${String(MAX_INLINES - 1)}: Text was not changed: `)).toBe(true)
  })
})
