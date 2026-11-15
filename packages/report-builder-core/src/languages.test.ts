/**
 * A report's languages in the editor (0063): the language a person edits,
 * the report's own until another is chosen and the editor's own, never the
 * report's; the outline, the design view and the bar in that language's
 * words, a word it lacks shown in the report's own and marked; the fields
 * at words writing translations, and every other field the report's own;
 * a language added and removed at the report's level; and problems that
 * name their language.
 */
import { reportWords } from '@formancy/report-spec'
import type { ReportDefinition, TextComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { EditorState } from './model.js'
import type { EditorOutcome } from './model-actions.js'
import type { PropertyField } from './model-properties.js'
import { billedReport, editorOver } from './test-support.js'

const FRENCH = 'French (Switzerland)'

function ok(outcome: EditorOutcome): void {
  expect(outcome).toEqual({ ok: true })
}

/** The billed report with a French translation of `words`, and of `expressions` by their sources. */
function inFrench(words: Readonly<Record<string, string>> = {}, report: ReportDefinition = billedReport(), expressions: Readonly<Record<string, string>> = {}) {
  return {
    ...report,
    translations: [
      {
        locale: 'fr-CH',
        words: Object.entries(words).map(([word, text]) => ({ word, text })),
        expressions: Object.entries(expressions).map(([cel, written]) => ({ cel, expression: { cel: written } })),
      },
    ],
  }
}

/** The billed report with the introduction's own words followed by an expression that prints words, and one that prints a name alone. */
function withExpressions(): ReportDefinition {
  const report = billedReport()
  const body = report.regions.body.map((component) =>
    component.id === 'intro'
      ? ({
          ...component,
          content: [...(component as TextComponent).content, { kind: 'expression', expression: { cel: 'header.customer + " AG"' } }],
        } as TextComponent)
      : component,
  )
  return { ...report, regions: { ...report.regions, body } }
}

const field = (state: EditorState, key: string): PropertyField | undefined => state.properties.fields.find((candidate) => candidate.key === key)
const box = (state: EditorState, key: string) => state.canvas.boxes.find((candidate) => candidate.key === key)
const distinctWords = (report: ReportDefinition): number => new Set(reportWords(report).map(({ text }) => text)).size

describe('a report in its own language alone', () => {
  // Every report before 0063 has one language: the editor draws it as it
  // always did -- no switch, no mark on a box, no note on a field.
  test('offers no switch, marks no box and notes no field', () => {
    const { editor } = editorOver()
    const state = editor.state()
    expect(state.languages).toEqual({
      edited: 'de-CH',
      declared: [{ locale: 'de-CH', name: 'German (Switzerland)', label: 'German (Switzerland), the report’s own', own: true, missing: 0 }],
    })
    expect(state.canvas.boxes.filter((candidate) => 'missing' in candidate)).toEqual([])
    expect(state.properties.fields.filter((candidate) => 'note' in candidate || 'missing' in candidate)).toEqual([])
    for (const id of ['intro', 'note', 'lines']) {
      ok(editor.dispatch({ type: 'select', id }))
      expect(editor.state().properties.fields.filter((candidate) => 'note' in candidate)).toEqual([])
    }
  })
})

describe('adding and removing a language', () => {
  // A language is added by its tag at the report's level, in one step, and
  // every word is then missing in it: the problems say so, each by its
  // language, and the switch counts them.
  test('adds a language by its tag, in one undo step, its words missing as problems naming it', () => {
    const { editor, session } = editorOver(billedReport())
    ok(editor.dispatch({ type: 'setProperty', key: '/translations/-', value: ' fr-CH ' }))
    expect(session.document().translations).toEqual([{ locale: 'fr-CH', words: [], expressions: [] }])
    const state = editor.state()
    expect(state.history.undoLabel).toBe('Add language')
    expect(state.status.text).toBe(`Added ${FRENCH}. Its words are missing until they are written: choose it as the edited language to write them.`)
    const missing = distinctWords(session.document())
    expect(state.languages.declared[1]).toEqual({ locale: 'fr-CH', name: FRENCH, label: `${FRENCH}, words missing: ${missing}`, own: false, missing })
    expect(state.languages.edited).toBe('de-CH')
    expect(state.diagnostics.filter((entry) => entry.language === 'fr-CH')).toHaveLength(missing)
    expect(state.diagnostics.map((entry) => entry.label)).toContain(`Error in ${FRENCH}: Introduction`)
    expect(field(state, '/translations/-')?.value).toBe('')
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().translations).toBeUndefined()
  })

  // The report's own language, one it has and a tag that is none are each
  // refused where they were typed, the report unchanged.
  test('refuses the report’s own language, one it has and a tag that is none, on the field', () => {
    const { editor, session } = editorOver(inFrench())
    for (const tag of ['de-CH', 'fr-CH', 'not a tag']) {
      const outcome = editor.dispatch({ type: 'setProperty', key: '/translations/-', value: tag })
      expect(outcome.ok, tag).toBe(false)
      expect(field(editor.state(), '/translations/-')?.error, tag).toBeDefined()
      expect(field(editor.state(), '/translations/-')?.value, tag).toBe(tag)
    }
    expect(session.document().translations).toHaveLength(1)
  })

  // Remove takes the language with its words, in one step, and the view
  // goes back to the report's own: a view of a language the report no
  // longer has would show words nothing prints. The keyboard goes to Add
  // language, the group's first field, as its Remove goes with it.
  test('removes a language with its words in one undo step, the view back to the report’s own', () => {
    const { editor, session } = editorOver(inFrench({ Introduction: 'Présentation' }))
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    ok(editor.dispatch({ type: 'select', id: null }))
    const group = editor
      .state()
      .properties.rows.flatMap((row) => ('group' in row ? [row.group] : []))
      .find((candidate) => candidate.key === '/translations')
    expect(group?.label).toBe('Languages')
    expect(group?.actions).toEqual([
      { label: `Remove ${FRENCH}`, action: { type: 'removeLanguage', locale: 'fr-CH' }, available: true, then: { group: '/translations' } },
    ])
    ok(editor.dispatch({ type: 'removeLanguage', locale: 'fr-CH' }))
    expect(session.document().translations).toBeUndefined()
    expect(editor.state().languages.edited).toBe('de-CH')
    expect(editor.state().history.undoLabel).toBe('Remove language')
    expect(editor.state().status.text).toBe(`Removed ${FRENCH} and its words.`)
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().translations).toHaveLength(1)
    expect(editor.state().languages.edited).toBe('de-CH')
  })

  // The language added, viewed and then undone away is no longer there to
  // show: the view goes back to the report's own with it.
  test('gives the view back to the report’s own when the language shown is undone away', () => {
    const { editor } = editorOver(billedReport())
    ok(editor.dispatch({ type: 'setProperty', key: '/translations/-', value: 'fr-CH' }))
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    expect(editor.state().languages.edited).toBe('fr-CH')
    ok(editor.dispatch({ type: 'undo' }))
    expect(editor.state().languages.edited).toBe('de-CH')
    expect(editor.state().canvas.boxes.filter((candidate) => 'missing' in candidate)).toEqual([])
  })

  // Only a language the report is written in is shown or removed: one it
  // is not would show the report's own words under another's name.
  test('refuses to show or remove a language the report is not written in', () => {
    const { editor } = editorOver(inFrench())
    for (const type of ['setLanguage', 'removeLanguage'] as const) {
      const outcome = editor.dispatch({ type, locale: 'it-CH' })
      expect(outcome).toMatchObject({ ok: false, code: 'not-found', message: 'The report is not written in Italian (Switzerland).' })
    }
    expect(editor.state().languages.edited).toBe('de-CH')
  })
})

describe('the language edited', () => {
  // The design view and the outline show the language edited: a word it
  // has in its words, one it lacks in the report's own, marked, so that a
  // person sees what is still to write, and never takes a German word for
  // a French one.
  test('shows its words, and the report’s own where it lacks one, marked', () => {
    const { editor } = editorOver(inFrench({ Introduction: 'Présentation' }))
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    const state = editor.state()
    expect(state.languages.edited).toBe('fr-CH')
    expect(state.status.text).toBe(`Showing the words in ${FRENCH}.`)
    expect(box(state, 'intro')).toMatchObject({ label: 'Présentation' })
    expect(box(state, 'intro')).not.toHaveProperty('missing')
    expect(state.outline.flatMap((region) => region.nodes).find((node) => node.id === 'intro')?.label).toBe('Présentation')
    for (const key of ['note', 'lines/sku', 'lines', 'page-of']) expect(box(state, key)?.missing, key).toBe(`Not written in ${FRENCH} yet`)
    expect(state.canvas.paymentPart?.missing).toBe(`Not written in ${FRENCH} yet`)
    // A QR code's content is a code a scanner reads, and holds no word.
    expect(box(state, 'order-code')).not.toHaveProperty('missing')
    expect(state.document.title).toBe('Orders')
    ok(editor.dispatch({ type: 'setLanguage', locale: 'de-CH' }))
    expect(box(editor.state(), 'intro')).toMatchObject({ label: 'Introduction' })
    expect(editor.state().canvas.boxes.filter((candidate) => 'missing' in candidate)).toEqual([])
  })

  // A word is looked up by its text, so one translation prints wherever it
  // stands: the field says how many places that is, empty until written,
  // the report's own word its placeholder; emptied, it takes the
  // translation back. The report's own word is never touched.
  test('writes a word’s translation from its field, wherever the word stands, and takes it back emptied', () => {
    const { editor, session } = editorOver(inFrench())
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    expect(field(editor.state(), '/title')).toMatchObject({
      label: 'Title',
      value: '',
      placeholder: 'Orders',
      required: false,
      missing: true,
      note: `Not written in ${FRENCH} yet. Places it stands in: 2`,
    })
    ok(editor.dispatch({ type: 'setProperty', key: '/title', value: 'Commandes' }))
    expect(session.document().translations?.[0]?.words).toEqual([{ word: 'Orders', text: 'Commandes' }])
    expect(session.document().title).toBe('Orders')
    const state = editor.state()
    expect(state.document.title).toBe('Commandes')
    expect(state.canvas.paymentPart).not.toHaveProperty('missing')
    expect(field(state, '/title')).toMatchObject({ value: 'Commandes', note: `In ${FRENCH}. Places it stands in: 2` })
    expect(field(state, '/title')).not.toHaveProperty('missing')
    expect(state.history.undoLabel).toBe('Change Title')
    ok(editor.dispatch({ type: 'setProperty', key: '/title', value: '' }))
    expect(session.document().translations?.[0]?.words).toEqual([])
  })

  // Every field at a word writes its translation -- a column's header, a
  // table's empty text, a text's runs, a bill's message -- and every field
  // that holds no word edits the report as it does in its own language:
  // a QR code's content prints the same in every language.
  test('writes a header, an empty text, a text’s runs and a bill’s message, and leaves what holds no word to the report’s own', () => {
    const { editor, session } = editorOver(inFrench())
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    const writes = (
      selection: { readonly id: string; readonly column?: string } | { readonly part: 'paymentPart' },
      key: string,
      word: string,
      text: string,
    ) => {
      ok(editor.dispatch({ type: 'select', ...selection }))
      expect(field(editor.state(), key), key).toMatchObject({ value: '', placeholder: word, missing: true })
      ok(editor.dispatch({ type: 'setProperty', key, value: text }))
      expect(session.document().translations?.[0]?.words.find((entry) => entry.word === word)?.text, key).toBe(text)
    }
    writes({ id: 'lines', column: 'sku' }, '/header', 'SKU', 'Article')
    writes({ id: 'lines' }, '/emptyText', 'No lines.', 'Aucune ligne.')
    writes({ id: 'intro' }, '/content/0/text', 'Introduction', 'Présentation')
    writes({ id: 'page-of' }, '/content/2/text', ' of ', ' sur ')
    writes({ part: 'paymentPart' }, '/message', 'Orders', 'Commandes')
    ok(editor.dispatch({ type: 'select', id: 'order-code' }))
    expect(field(editor.state(), '/content/0/text')).toMatchObject({ value: 'Orders for ', required: true })
    expect(field(editor.state(), '/content/0/text')).not.toHaveProperty('note')
    ok(editor.dispatch({ type: 'setProperty', key: '/content/0/text', value: 'Order of ' }))
    expect(JSON.stringify(session.document().regions.summary)).toContain('Order of ')
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'sku' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/width', value: '30' }))
    expect(field(editor.state(), '/width')?.value).toBe('30')
  })

  // An expression that prints words is translated whole, as another
  // expression; one that prints the data alone holds no word and is the
  // report's own in every language.
  test('writes an expression that prints words as another expression, and leaves one that prints none to the report’s own', () => {
    const { editor, session } = editorOver(inFrench({}, withExpressions()))
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(field(editor.state(), '/content/1/expression')).toMatchObject({
      kind: 'expression',
      value: '',
      placeholder: 'header.customer + " AG"',
      missing: true,
    })
    ok(editor.dispatch({ type: 'setProperty', key: '/content/1/expression', value: 'header.customer + " SA"' }))
    expect(session.document().translations?.[0]?.expressions).toEqual([{ cel: 'header.customer + " AG"', expression: { cel: 'header.customer + " SA"' } }])
    ok(editor.dispatch({ type: 'select', id: 'kept' }))
    expect(field(editor.state(), '/content/0/expression')).toMatchObject({ value: 'header.customer', required: true })
    expect(field(editor.state(), '/content/0/expression')).not.toHaveProperty('note')
  })

  // The report's own language is the one its words are written in: its
  // field names it in every language's view, and changes it.
  test('keeps the Language field the report’s own, in every language’s view', () => {
    const { editor, session } = editorOver(inFrench())
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    expect(field(editor.state(), '/locale')?.value).toBe('de-CH')
    ok(editor.dispatch({ type: 'setProperty', key: '/locale', value: 'de-DE' }))
    expect(session.document().locale).toBe('de-DE')
    expect(editor.state().languages.edited).toBe('fr-CH')
  })

  // A word missing is the field's note, never its error: an error on every
  // field of the report's own language for a French word it lacks would
  // mark as wrong what the person typed right.
  test('says a word missing on no field’s error, in either language', () => {
    const { editor } = editorOver(inFrench())
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(field(editor.state(), '/content/0/text')).not.toHaveProperty('error')
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    expect(field(editor.state(), '/content/0/text')).not.toHaveProperty('error')
  })
})

describe('the problems of several languages', () => {
  // One word missing in two languages is two problems at one path: a key
  // of the code and the path alone would number the second, and move the
  // keyboard when the first is written.
  test('tells one word missing in two languages apart, by its language', () => {
    const report = { ...billedReport(), translations: ['fr-CH', 'it-CH'].map((locale) => ({ locale, words: [], expressions: [] })) }
    const { editor } = editorOver(report)
    const keys = editor.state().diagnostics.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.filter((key) => key.endsWith(' it-CH'))).toHaveLength(distinctWords(report))
    expect(keys.some((key) => /\s\d+$/.test(key))).toBe(false)
    expect(editor.state().languages.declared.map((language) => language.label)).toEqual([
      'German (Switzerland), the report’s own',
      `${FRENCH}, words missing: ${distinctWords(report)}`,
      `Italian (Switzerland), words missing: ${distinctWords(report)}`,
    ])
  })
})

describe('what the language actions and fields refuse, or leave alone', () => {
  // Choosing the language already shown is no change: a builder that sent
  // it on every render would otherwise announce it again and again.
  test('changes nothing, and says nothing, for the language already shown', () => {
    const { editor } = editorOver(inFrench())
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    const before = editor.state()
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    expect(editor.state()).toBe(before)
  })

  // A builder in plain JavaScript may send a locale that is no string: it
  // is refused as one the report is not written in, never thrown on.
  test('refuses a locale that is no tag, as a caller tsc never saw may send one', () => {
    const { editor } = editorOver(inFrench())
    for (const type of ['setLanguage', 'removeLanguage'] as const) {
      const outcome = editor.dispatch({ type, locale: 7 as unknown as string })
      expect(outcome).toMatchObject({ ok: false, code: 'not-found', message: 'The report is not written in 7.' })
    }
  })

  // Add language left empty adds nothing and is no step; a value that is
  // no text -- a checkbox's -- is refused before the session is asked.
  test('adds nothing for an empty tag, and refuses one that is no text', () => {
    const { editor, session } = editorOver(billedReport())
    ok(editor.dispatch({ type: 'setProperty', key: '/translations/-', value: '  ' }))
    expect(session.canUndo()).toBe(false)
    expect(editor.dispatch({ type: 'setProperty', key: '/translations/-', value: true })).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(session.document().translations).toBeUndefined()
  })

  // A word's field given back as it shows is no edit, and a value that is
  // no text is refused: neither writes a translation nobody typed.
  test('writes nothing for a word given back as shown, and refuses a value that is no text', () => {
    const { editor, session } = editorOver(inFrench({ Introduction: 'Présentation' }))
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/content/0/text', value: 'Présentation' }))
    expect(session.canUndo()).toBe(false)
    expect(editor.dispatch({ type: 'setProperty', key: '/content/0/text', value: false })).toMatchObject({ ok: false, code: 'invalid-value' })
  })

  // A language with every word written is offered by its name alone: a
  // count of none would read as though something were still missing.
  test('offers a language with every word written by its name alone', () => {
    const report = billedReport()
    const words = Object.fromEntries([...new Set(reportWords(report).map(({ text }) => text))].map((word) => [word, `fr ${word}`]))
    const { editor } = editorOver(inFrench(words, report))
    expect(editor.state().languages.declared[1]).toEqual({ locale: 'fr-CH', name: FRENCH, label: FRENCH, own: false, missing: 0 })
  })

  // A bill's message of several runs is written run by run, its word in
  // the language edited and its binding the report's own; a message that
  // holds no word is edited as the report's own, in every language.
  test('writes a bill’s message run by run, and leaves one that holds no word to the report’s own', () => {
    const billed = billedReport()
    const bill = billed.paymentPart as NonNullable<ReportDefinition['paymentPart']>
    const runs = {
      ...billed,
      paymentPart: {
        ...bill,
        message: [
          { kind: 'text', text: 'Orders of ' },
          { kind: 'field', field: { dataset: 'header', field: 'customer' } },
        ],
      },
    }
    const { editor } = editorOver(inFrench({}, runs as ReportDefinition))
    ok(editor.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    ok(editor.dispatch({ type: 'select', part: 'paymentPart' }))
    expect(field(editor.state(), '/message/0/text')).toMatchObject({ placeholder: 'Orders of ', missing: true })
    expect(field(editor.state(), '/message/1')).toMatchObject({ kind: 'binding' })
    expect(field(editor.state(), '/message/1')).not.toHaveProperty('note')
    const digits = { ...billed, paymentPart: { ...bill, message: [{ kind: 'text', text: '2026-11' }] } }
    const second = editorOver(inFrench({}, digits as ReportDefinition)).editor
    ok(second.dispatch({ type: 'setLanguage', locale: 'fr-CH' }))
    ok(second.dispatch({ type: 'select', part: 'paymentPart' }))
    expect(field(second.state(), '/message')).toMatchObject({ value: '2026-11' })
    expect(field(second.state(), '/message')).not.toHaveProperty('note')
  })
})
