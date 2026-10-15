import { COMPONENT_KINDS, componentAt } from '@formancy/report-spec'
import type { Component, ComponentKind } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { EditorOutcome, PropertyField } from './model.js'
import { PROPERTY_KINDS, PROPERTY_ROLES } from './model.js'
import { editorOver, richReport } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

function field(fields: readonly PropertyField[], key: string): PropertyField {
  const found = fields.find((candidate) => candidate.key === key)
  if (found === undefined) throw new Error(`no field ${key} among ${fields.map((candidate) => candidate.key).join(', ')}`)
  return found
}

/** The rich report's component of each kind: every kind has one. */
const OF_KIND: { readonly [K in ComponentKind]: string } = {
  text: 'intro',
  image: 'logo-image',
  line: 'rule',
  rectangle: 'box',
  spacer: 'gap',
  columns: 'heading',
  section: 'notes',
  table: 'lines',
  pageBreak: 'break',
  keepTogether: 'keep',
}

describe('the report’s own properties', () => {
  // With nothing selected the panel is the report's: its title, language
  // and page, the page's margins in millimetres.
  test('are shown when nothing is selected', () => {
    const { editor } = editorOver()
    const { heading, fields } = editor.state().properties
    expect(heading).toBe('Report')
    expect(fields.map((candidate) => [candidate.key, candidate.label, candidate.kind, candidate.value])).toEqual([
      ['/title', 'Title', 'text', 'Orders'],
      ['/locale', 'Language', 'text', 'de-CH'],
      ['/page/size', 'Page size', 'select', 'A4'],
      ['/page/orientation', 'Orientation', 'select', 'portrait'],
      ['/page/margins/top', 'Top margin (mm)', 'length', '20'],
      ['/page/margins/right', 'Right margin (mm)', 'length', '20'],
      ['/page/margins/bottom', 'Bottom margin (mm)', 'length', '20'],
      ['/page/margins/left', 'Left margin (mm)', 'length', '20'],
    ])
  })

  // A property edit is a command through the session: one undo step,
  // labelled with what changed.
  test('change through the session, as one undoable step each', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'setProperty', key: '/title', value: 'Quarterly orders' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/page/orientation', value: 'landscape' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/page/margins/left', value: '25' }))
    expect(session.document().title).toBe('Quarterly orders')
    expect(session.document().page.orientation).toBe('landscape')
    expect(session.document().page.margins.left).toBe(70.87)
    expect(editor.state().history.undoLabel).toBe('Change Left margin')
    expect(editor.state().status.text).toBe('Changed Left margin.')
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().page.margins.left).toBe(56.69)
  })

  // The report's language is the validator's to judge; a tag it refuses
  // shows its reason on the field, and one it takes is stored.
  test('change the report’s language, or show why not', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'setProperty', key: '/locale', value: 'fr-CH' }))
    expect(session.document().locale).toBe('fr-CH')
    expect(editor.dispatch({ type: 'setProperty', key: '/locale', value: 'french' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/locale')).toMatchObject({ value: 'french', error: expect.stringMatching(/BCP 47/) })
    expect(session.document().locale).toBe('fr-CH')
  })

  // A length shown as 20 mm and left as it was must not be stored again
  // through the conversion, which would move it by a hundredth of a point
  // and make leaving a field an edit.
  test('leave a length alone when it is given back as it was shown', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    // 12 pt shows as 4.23 mm, which stored again would be 11.99 pt.
    expect(field(editor.state().properties.fields, '/height').value).toBe('4.23')
    const state = editor.state()
    ok(editor.dispatch({ type: 'setProperty', key: '/height', value: ' 4.23 ' }))
    expect(session.revision()).toBe(0)
    expect(editor.state()).toBe(state)
  })
})

describe('a refused value', () => {
  // The validator's reason on the field the person typed in, what they
  // typed kept there, and the report unchanged (0008). A length is edited
  // in millimetres, so a length too large for the page is said in
  // millimetres, with the room there is: report-spec's sentence counts in
  // points, and would leave the person converting 1133.86 back into 400.
  test('is shown on its field with the reason, in the field’s unit, and changes nothing', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    const outcome = editor.dispatch({ type: 'setProperty', key: '/height', value: '400' })
    expect(outcome).toMatchObject({ ok: false, code: 'refused' })
    const height = field(editor.state().properties.fields, '/height')
    expect(height.value).toBe('400')
    expect(height.error).toBe('400 mm is more than the 257 mm the margins leave.')
    expect(session.revision()).toBe(0)
    expect(editor.state().status.text).toBe('Height (mm): 400 mm is more than the 257 mm the margins leave.')
  })

  // The room is the side the validator measured, in the person's language:
  // a width against the page's width, its numbers as Swiss French writes them.
  test('says a width too wide against the page’s width, in the editor’s language', () => {
    const { editor } = editorOver(richReport(), { locale: 'fr-CH' })
    const number = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 })
    ok(editor.dispatch({ type: 'select', id: 'box' }))
    editor.dispatch({ type: 'setProperty', key: '/width', value: '999.5' })
    expect(field(editor.state().properties.fields, '/width').error).toBe(`${number.format(999.5)} mm dépassent les ${number.format(170)} mm que laissent les marges.`)
  })

  // A number field given something that is not a number is refused before
  // the report is touched, in the person's language.
  test('that is not a number is refused in the editor’s language', () => {
    const { editor } = editorOver(richReport(), { locale: 'fr-CH' })
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    expect(editor.dispatch({ type: 'setProperty', key: '/height', value: 'tall' })).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(field(editor.state().properties.fields, '/height').error).toBe('Saisissez un nombre.')
    expect(editor.dispatch({ type: 'setProperty', key: '/height', value: '' })).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(field(editor.state().properties.fields, '/height').error).toBe('Ce champ ne peut pas être vide.')
  })

  // Swiss French writes 12,5; the field takes the comma as the decimal
  // point rather than refusing what the person's keyboard types.
  test('takes a decimal comma', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/height', value: '12,5' }))
    expect((componentAt(session.document(), 'gap')?.component as Extract<Component, { kind: 'spacer' }>).height).toBe(35.43)
  })

  // An error is about one value in one place; once the person has moved
  // on -- another selection, a good value, an edit anywhere -- it goes.
  test('is forgotten once the selection changes, the value is good, or the document changes', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    editor.dispatch({ type: 'setProperty', key: '/height', value: '400' })
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    expect(field(editor.state().properties.fields, '/height').error).toBeUndefined()
    editor.dispatch({ type: 'setProperty', key: '/height', value: '400' })
    ok(editor.dispatch({ type: 'setProperty', key: '/height', value: '5' }))
    expect(field(editor.state().properties.fields, '/height')).toMatchObject({ value: '5' })
    expect(field(editor.state().properties.fields, '/height').error).toBeUndefined()
    editor.dispatch({ type: 'setProperty', key: '/height', value: '400' })
    session.undo()
    expect(field(editor.state().properties.fields, '/height').error).toBeUndefined()
  })

  // A key no field has is a builder's mistake, refused rather than written
  // somewhere in the report.
  test('for a key no field has is refused', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    expect(editor.dispatch({ type: 'setProperty', key: '/id', value: 'renamed' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.dispatch({ type: 'setProperty', key: '/height', value: true })).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(session.revision()).toBe(0)
  })
})

describe('a component’s properties', () => {
  // Every kind has a panel, derived from report-spec's type for it, with
  // the properties every component shares at the end.
  test('exist for every kind, with style and condition last', () => {
    const { editor } = editorOver()
    for (const kind of COMPONENT_KINDS) {
      ok(editor.dispatch({ type: 'select', id: OF_KIND[kind] }))
      const keys = editor.state().properties.fields.map((candidate) => candidate.key)
      expect(keys.slice(-2), kind).toEqual(['/style', '/visibleWhen'])
      expect(editor.state().properties.heading, kind).toMatch(/^[^:]+: .+/)
    }
  })

  // Each kind's own properties, as the format has them: what an author can
  // change without editing JSON (plan 8).
  test('are each kind’s own, in the format’s terms', () => {
    const { editor } = editorOver()
    const keys = (id: string): string[] => {
      ok(editor.dispatch({ type: 'select', id }))
      return editor.state().properties.fields.map((candidate) => candidate.key).slice(0, -2)
    }
    expect(keys('intro')).toEqual(['/content/0/text', '/keepWithNext'])
    expect(keys('title')).toEqual(['/content/0/text', '/content/1', '/keepWithNext'])
    expect(keys('kept')).toEqual(['/content/0/expression', '/keepWithNext'])
    expect(keys('logo-image')).toEqual(['/source', '/width', '/height', '/fit'])
    expect(keys('rule')).toEqual(['/thickness', '/color'])
    expect(keys('box')).toEqual(['/width', '/height', '/fill', '/stroke'])
    expect(keys('gap')).toEqual(['/height'])
    expect(keys('heading')).toEqual(['/columns/0/width', '/columns/1/width'])
    expect(keys('notes')).toEqual(['/fill', '/padding', '/border/thickness', '/border/color'])
    expect(keys('lines')).toEqual(['/emptyText', '/headerStyle'])
    expect(keys('break')).toEqual([])
    expect(keys('keep')).toEqual([])
  })

  // The kind decides the control, and the control's role is what a test
  // and a screen reader find it by.
  test('use a control of the kind each property needs', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'title' }))
    const fields = editor.state().properties.fields
    expect(fields.map((candidate) => [candidate.label, candidate.kind])).toEqual([
      ['Part 1: Text', 'multiline'],
      ['Part 2: Field', 'binding'],
      ['Keep with next', 'boolean'],
      ['Style', 'style'],
      ['Show only when', 'expression'],
    ])
    expect(field(fields, '/content/1').options?.map((option) => [option.value, option.label])).toEqual([
      ['field:header:customer', 'Customer'],
      ['parameter:from', 'Parameter: From'],
    ])
    expect(field(fields, '/style').options?.map((option) => option.value)).toEqual(['', 'title', 'small'])
    expect(new Set(PROPERTY_KINDS)).toEqual(new Set(Object.keys(PROPERTY_ROLES)))
  })

  // A printed total chooses among the report's aggregates.
  test('choose the aggregate a printed total prints', () => {
    const report = richReport()
    const total = { id: 'grand', kind: 'text', content: [{ kind: 'aggregate', aggregate: 'total', over: 'report' }] } as const
    const { editor, session } = editorOver({ ...report, aggregates: [...report.aggregates, { id: 'lines', fn: 'count' }], regions: { ...report.regions, summary: [total] } })
    ok(editor.dispatch({ type: 'select', id: 'grand' }))
    const aggregate = field(editor.state().properties.fields, '/content/0/aggregate')
    expect(aggregate).toMatchObject({ label: 'Total', kind: 'select', value: 'total' })
    expect(aggregate.options?.map((option) => option.value)).toEqual(['total', 'lines'])
    ok(editor.dispatch({ type: 'setProperty', key: '/content/0/aggregate', value: 'lines' }))
    expect(componentAt(session.document(), 'grand')?.component).toMatchObject({ content: [{ kind: 'aggregate', aggregate: 'lines', over: 'report' }] })
  })

  // One field per run of a text, so a run bound to a field can be rebound
  // to a parameter without retyping the rest.
  test('rebind a run, keep a flag, and set a style', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'title' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/content/1', value: 'parameter:from' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/keepWithNext', value: true }))
    ok(editor.dispatch({ type: 'setProperty', key: '/style', value: '' }))
    const title = componentAt(session.document(), 'title')?.component
    expect(title).toEqual({ id: 'title', kind: 'text', keepWithNext: true, content: [{ kind: 'text', text: 'Orders for ' }, { kind: 'parameter', parameter: 'from' }] })
    expect(editor.dispatch({ type: 'setProperty', key: '/content/1', value: 'parameter:nope' })).toMatchObject({ ok: false, code: 'invalid-value' })
  })

  // An optional property emptied is removed, so it is the renderer's
  // default again; `null` is report-core's removal (0008).
  test('remove an optional property when it is emptied', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/visibleWhen', value: '  ' }))
    ok(editor.dispatch({ type: 'select', id: 'rule' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/color', value: '' }))
    ok(editor.dispatch({ type: 'select', id: 'notes' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/border/thickness', value: '' }))
    const document = session.document()
    expect(componentAt(document, 'intro')?.component).not.toHaveProperty('visibleWhen')
    expect(componentAt(document, 'rule')?.component).not.toHaveProperty('color')
    expect(componentAt(document, 'notes')?.component).not.toHaveProperty('border')
  })

  // A colour is stored in lower case; one typed in capitals is the same
  // colour, not a refusal.
  test('write a colour in lower case, and give a section a border it had not', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'notes' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/border/thickness', value: '' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/border/color', value: '#AA00CC' }))
    expect(componentAt(session.document(), 'notes')?.component).toMatchObject({ border: { thickness: 1, color: '#aa00cc' } })
    ok(editor.dispatch({ type: 'setProperty', key: '/border/thickness', value: '2' }))
    expect(componentAt(session.document(), 'notes')?.component).toMatchObject({ border: { thickness: 2, color: '#aa00cc' } })
  })

  // A width is a length or "fill"; an empty field is fill, as its
  // placeholder says.
  test('take a column width as millimetres, or fill when empty', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'heading' }))
    const first = field(editor.state().properties.fields, '/columns/0/width')
    expect(first).toMatchObject({ label: 'Column 1 width (mm)', kind: 'length', placeholder: 'Empty: fills the rest', required: false })
    ok(editor.dispatch({ type: 'setProperty', key: '/columns/0/width', value: '' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/columns/1/width', value: '50' }))
    const heading = componentAt(session.document(), 'heading')?.component as Extract<Component, { kind: 'columns' }>
    expect(heading.columns.map((slot) => slot.width)).toEqual(['fill', 141.73])
    expect(field(editor.state().properties.fields, '/columns/0/width').value).toBe('')
  })

  // An image draws an asset or an image field; the choice is one list.
  test('choose an image’s source among assets and image fields', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'logo-image' }))
    expect(field(editor.state().properties.fields, '/source').options).toEqual([
      { value: 'asset:logo', label: 'Asset: logo' },
      { value: 'field:header:signature', label: 'Signature' },
    ])
    ok(editor.dispatch({ type: 'setProperty', key: '/source', value: 'field:header:signature' }))
    expect(componentAt(session.document(), 'logo-image')?.component).toMatchObject({ source: { kind: 'field', field: { dataset: 'header', field: 'signature' } } })
  })

  // An expression with an error the runtime would refuse shows it where
  // the author types it, not only in the problems list.
  test('show a diagnostic on the expression it is about', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/visibleWhen', value: 'params.nope' }))
    expect(field(editor.state().properties.fields, '/visibleWhen').error).toMatch(/nope/)
  })
})

describe('a table column’s properties', () => {
  // A column is selected and edited like a component, through
  // updateColumn.
  test('are its heading, width, alignment, value and condition', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'amount' }))
    const { heading, fields } = editor.state().properties
    expect(heading).toBe('Column: Amount')
    expect(fields.map((candidate) => candidate.key)).toEqual(['/header', '/width', '/align', '/value', '/style', '/visibleWhen'])
    expect(field(fields, '/value').options?.map((option) => option.value)).toEqual(['field:detail:site', 'field:detail:sku', 'field:detail:amount', 'field:header:customer', 'parameter:from'])
    ok(editor.dispatch({ type: 'setProperty', key: '/header', value: 'Total' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/align', value: 'center' }))
    const table = componentAt(session.document(), 'lines')?.component as Extract<Component, { kind: 'table' }>
    expect(table.columns[1]).toMatchObject({ header: 'Total', align: 'center' })
  })
})
