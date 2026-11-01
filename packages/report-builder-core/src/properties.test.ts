import { COMPONENT_KINDS, componentAt, emptyReport, mmToPt, ptToMm, validateReport } from '@formancy/report-spec'
import type { Component, ComponentKind, PageSettings, QrCodeComponent, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { EditorOutcome } from './model-actions.js'
import type { PropertyField } from './model-properties.js'
import { PROPERTY_KINDS, PROPERTY_ROLES } from './model-properties.js'
import { defaultComponent } from './palette.js'
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
  qrCode: 'order-code',
  epcQrCode: 'pay-code',
  line: 'rule',
  rectangle: 'box',
  spacer: 'gap',
  columns: 'heading',
  section: 'notes',
  table: 'lines',
  chart: 'sales',
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
    expect(field(editor.state().properties.fields, '/width').error).toBe(
      `${number.format(999.5)} mm dépassent les ${number.format(170)} mm que laissent les marges.`,
    )
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
      return editor
        .state()
        .properties.fields.map((candidate) => candidate.key)
        .slice(0, -2)
    }
    expect(keys('intro')).toEqual(['/content/0/text', '/keepWithNext'])
    expect(keys('title')).toEqual(['/content/0/text', '/content/1', '/keepWithNext'])
    expect(keys('kept')).toEqual(['/content/0/expression', '/keepWithNext'])
    expect(keys('logo-image')).toEqual(['/source', '/width', '/height', '/fit'])
    expect(keys('order-code')).toEqual(['/content/0/text', '/content/1', '/size', '/errorCorrection'])
    expect(keys('pay-code')).toEqual([
      '/beneficiary/0/text',
      '/iban/0/text',
      '/bic',
      '/amount',
      '/purpose',
      '/reference',
      '/text/0/text',
      '/text/1',
      '/information',
      '/size',
      '/caption',
    ])
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
    const { editor, session } = editorOver({
      ...report,
      aggregates: [...report.aggregates, { id: 'lines', fn: 'count' }],
      regions: { ...report.regions, summary: [total] },
    })
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
    expect(title).toEqual({
      id: 'title',
      kind: 'text',
      keepWithNext: true,
      content: [
        { kind: 'text', text: 'Orders for ' },
        { kind: 'parameter', parameter: 'from' },
      ],
    })
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
    expect(componentAt(session.document(), 'logo-image')?.component).toMatchObject({
      source: { kind: 'field', field: { dataset: 'header', field: 'signature' } },
    })
  })

  // A QR code's content is edited run by run as a text's is, its square as
  // one length, and its level as one of the four the format has. Each
  // level says the share of the code it restores, written as the editor's
  // language writes a percentage, by Intl: a hand-written "7 %" is the
  // German of Germany, not Switzerland's.
  test('edit a QR code’s content, its size and its level', () => {
    const { editor, session } = editorOver(richReport(), { locale: 'de-CH' })
    ok(editor.dispatch({ type: 'select', id: 'order-code' }))
    const fields = editor.state().properties.fields
    expect(fields.map((candidate) => [candidate.label, candidate.kind, candidate.value]).slice(0, -2)).toEqual([
      ['Teil 1: Text', 'multiline', 'Orders for '],
      ['Teil 2: Feld', 'binding', 'field:header:customer'],
      ['Grösse (mm)', 'length', '30'],
      ['Fehlerkorrektur', 'select', 'Q'],
    ])
    const percent = (share: number) => new Intl.NumberFormat('de-CH', { style: 'percent' }).format(share)
    expect(field(fields, '/errorCorrection').options).toEqual([
      { value: 'L', label: `Niedrig (${percent(0.07)})` },
      { value: 'M', label: `Mittel (${percent(0.15)})` },
      { value: 'Q', label: `Quartil (${percent(0.25)})` },
      { value: 'H', label: `Hoch (${percent(0.3)})` },
    ])
    ok(editor.dispatch({ type: 'setProperty', key: '/content/0/text', value: 'https://example.com/orders/' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/size', value: '25' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/errorCorrection', value: 'H' }))
    expect(componentAt(session.document(), 'order-code')?.component).toEqual({
      id: 'order-code',
      kind: 'qrCode',
      content: [
        { kind: 'text', text: 'https://example.com/orders/' },
        { kind: 'field', field: { dataset: 'header', field: 'customer' } },
      ],
      size: 70.87,
      errorCorrection: 'H',
    })
    expect(editor.dispatch({ type: 'setProperty', key: '/errorCorrection', value: 'X' })).toMatchObject({ ok: false, code: 'invalid-value' })
  })

  // The options' words are English's too, and Swiss French's, each from
  // its own catalogue.
  test('name a QR code’s levels in each language', () => {
    for (const [locale, labels] of [
      ['en', ['Low', 'Medium', 'Quartile', 'High']],
      ['fr-CH', ['Faible', 'Moyenne', 'Quartile', 'Élevée']],
    ] as const) {
      const { editor } = editorOver(richReport(), { locale })
      ok(editor.dispatch({ type: 'select', id: 'order-code' }))
      const percent = (share: number) => new Intl.NumberFormat(locale, { style: 'percent' }).format(share)
      const expected = [0.07, 0.15, 0.25, 0.3].map((share, index) => `${labels[index] as string} (${percent(share)})`)
      expect(
        field(editor.state().properties.fields, '/errorCorrection').options?.map((option) => option.label),
        locale,
      ).toEqual(expected)
    }
  })

  // A square is measured against the shorter side of what the margins
  // leave, as the validator measures it. Said against the width on a page
  // whose height is shorter, the refusal would name more room than there
  // is -- "100 mm is more than the 170 mm" -- and read as no reason at all.
  test('say a QR code too large for the page against the side that is short', () => {
    const report = richReport()
    const { editor } = editorOver({ ...report, page: { ...report.page, margins: { ...report.page.margins, top: 300, bottom: 300 } } })
    ok(editor.dispatch({ type: 'select', id: 'order-code' }))
    expect(editor.dispatch({ type: 'setProperty', key: '/size', value: '100' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/size').error).toBe('100 mm is more than the 85.33 mm the margins leave.')
  })

  // The palette sizes a new code, and this pane names the room a refused
  // size lacks; the validator decides which sizes stand. Were either
  // builder to measure a square its own way -- against the width on a page
  // whose height is shorter -- it would offer a code the validator refuses,
  // or name room there is not. Both are held to the largest size the
  // validator accepts: upright, where the width is short, and landscape,
  // where the height is.
  test('hold a QR code to the room the validator gives it, in the palette and here alike', () => {
    const pages: readonly PageSettings[] = [
      { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 260, bottom: 56.69, left: 260 } },
      { size: 'A4', orientation: 'landscape', margins: { top: 260, right: 42.52, bottom: 260, left: 42.52 } },
    ]
    const millimetres = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })
    for (const page of pages) {
      const blank = emptyReport('square', 'Square', 'en')
      const withCode = (size: number): ReportDefinition => ({
        ...blank,
        page,
        regions: { ...blank.regions, body: [{ id: 'code', kind: 'qrCode', content: [{ kind: 'text', text: 'A' }], size, errorCorrection: 'M' }] },
      })
      // Where 30 mm does not fit, the palette's default is the largest square the validator accepts.
      const { size } = defaultComponent(withCode(50), 'qrCode') as QrCodeComponent
      expect(size, page.orientation).toBeLessThan(mmToPt(30))
      expect([validateReport(withCode(size)).valid, validateReport(withCode(Math.round((size + 0.01) * 100) / 100)).valid], page.orientation).toEqual([
        true,
        false,
      ])
      // And it is the room this pane names for a size too large.
      const { editor } = editorOver(withCode(50))
      ok(editor.dispatch({ type: 'select', id: 'code' }))
      expect(editor.dispatch({ type: 'setProperty', key: '/size', value: '100' })).toMatchObject({ ok: false, code: 'refused' })
      expect(field(editor.state().properties.fields, '/size').error, page.orientation).toBe(
        `100 mm is more than the ${millimetres.format(ptToMm(size))} mm the margins leave.`,
      )
    }
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
    expect(field(fields, '/value').options?.map((option) => option.value)).toEqual([
      'field:detail:site',
      'field:detail:sku',
      'field:detail:amount',
      'field:header:customer',
      'parameter:from',
    ])
    ok(editor.dispatch({ type: 'setProperty', key: '/header', value: 'Total' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/align', value: 'center' }))
    const table = componentAt(session.document(), 'lines')?.component as Extract<Component, { kind: 'table' }>
    expect(table.columns[1]).toMatchObject({ header: 'Total', align: 'center' })
  })
})
