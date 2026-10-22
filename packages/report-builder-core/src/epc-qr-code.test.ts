import { componentAt, EPC_MAX_VERSION, epcCaptionBreak, epcModule, mmToPt, validateReport } from '@formancy/report-spec'
import type { Component, EpcQrCodeComponent, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { EditorOutcome } from './model-actions.js'
import type { PropertyField } from './model-properties.js'
import { defaultComponent } from './palette.js'
import { createReportEditor } from './editor.js'
import { editorOver, richReport } from './test-support.js'
import { EDITOR_LOCALES } from './text.js'

/**
 * An EPC payment code in the editor: the palette's default, its name in
 * the outline, its box on the canvas, and its properties -- each text of
 * the code edited as a text's runs are, the rules the EPC sets judged by
 * report-spec's validator when an edit is applied, as every other value
 * is (0008).
 */

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

function field(fields: readonly PropertyField[], key: string): PropertyField {
  const found = fields.find((candidate) => candidate.key === key)
  if (found === undefined) throw new Error(`no field ${key} among ${fields.map((candidate) => candidate.key).join(', ')}`)
  return found
}

/** What the validator refuses in `report`: nothing, for a report it takes. */
function problems(report: ReportDefinition): string[] {
  const outcome = validateReport(report)
  return outcome.valid ? [] : outcome.errors.map((error) => `${error.code} ${error.path}: ${error.message}`)
}

/** The rich report's EPC code, as the session now holds it. */
function code(report: ReportDefinition): EpcQrCodeComponent {
  return componentAt(report, 'pay-code')?.component as EpcQrCodeComponent
}

/** An editor over the rich report with its EPC code selected. */
function selected(locale: (typeof EDITOR_LOCALES)[number] = 'en'): ReturnType<typeof editorOver> {
  const opened = editorOver(richReport(), { locale })
  ok(opened.editor.dispatch({ type: 'select', id: 'pay-code' }))
  return opened
}

describe('a new EPC payment code', () => {
  // A new code needs a name and an account, which report-spec requires,
  // and has to be valid for the insert to be taken at all. The account is
  // one no bank keeps, so that a code inserted and never edited cannot
  // pay anybody: bank code 00000000, where every bank code in the
  // Bundesbank's Bankleitzahlendatei valid from 7 September to 6 December
  // 2026 starts with a digit from 1 to 8 (13,760 records, read on 17
  // October 2026), its check digits computed as ISO 13616 gives them. The
  // name is the report's language, as a new text's words are; no amount,
  // so the payer fills it in, and no frame, which is Austria's option.
  test('is a 32 mm square paying a name to an account no bank keeps', () => {
    const report: ReportDefinition = { ...richReport(), locale: 'en' }
    const fresh = defaultComponent(report, 'epcQrCode')
    expect(fresh).toEqual({
      id: 'epc-qr-code',
      kind: 'epcQrCode',
      size: mmToPt(32),
      beneficiary: [{ kind: 'text', text: 'Name of the beneficiary' }],
      iban: [{ kind: 'text', text: 'DE36 0000 0000 0000 0000 00' }],
    })
    expect(problems({ ...report, regions: { ...report.regions, body: [...report.regions.body, fresh as Component] } })).toEqual([])
    const words = (['de-CH', 'fr-CH'] as const).map((locale) => (defaultComponent({ ...report, locale }, 'epcQrCode') as EpcQrCodeComponent).beneficiary)
    expect(words).toEqual([[{ kind: 'text', text: 'Name des Empfängers' }], [{ kind: 'text', text: 'Nom du bénéficiaire' }]])
  })

  // Its square prints every payload the EPC allows, up to the 331 bytes
  // of version 13, whether or not the author then asks for Austria's
  // frame: a template made from it would otherwise print one invoice and
  // refuse the next by the length of its data alone. With the caption,
  // report-spec's rule takes version 13 in it; without, version 13's
  // modules are at least 0020's 0.4 mm, the renderer's floor. 32 mm is the
  // least whole millimetre that does both, where 30 mm prints neither, as
  // report-render-pdf's `epc-qr-code.test.ts` shows on the PDF.
  test('is a square in which every payload the EPC allows prints, with the frame or without', () => {
    const fresh = defaultComponent({ ...richReport(), locale: 'en' }, 'epcQrCode') as EpcQrCodeComponent
    const prints = (size: number): readonly [boolean, boolean] => [epcModule(size, EPC_MAX_VERSION, undefined) >= mmToPt(0.4), epcCaptionBreak(size, EPC_MAX_VERSION) === undefined]
    expect(prints(fresh.size)).toEqual([true, true])
    expect(prints(mmToPt(31))).toEqual([true, false])
    expect(prints(mmToPt(30))).toEqual([false, false])
  })

})

describe('an EPC payment code’s name', () => {
  // It is named by whom it pays, and says it is a payment code: a text
  // and a code paying the same name would otherwise be two rows of one
  // name. A name read from the data is named by its field, as a bound
  // run is.
  test('is its kind and its beneficiary, in each language', () => {
    const labels = EDITOR_LOCALES.map((locale) => editorOver(richReport(), { locale }).editor.state().outline[4]?.nodes.find((node) => node.id === 'pay-code')?.label)
    expect(labels).toEqual(['EPC payment code: Franz Mustermänn', 'EPC-Zahlcode: Franz Mustermänn', 'Code de paiement EPC : Franz Mustermänn'])
    const report = richReport()
    const bound = { ...code(report), beneficiary: [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }] } as const
    const { editor } = editorOver({ ...report, regions: { ...report.regions, summary: [bound] } })
    expect(editor.state().outline[4]?.nodes.map((node) => node.label)).toEqual(['EPC payment code: [Customer]'])
  })

  // The palette offers it in the format's order, after the QR code.
  test('is the palette’s, in each language', () => {
    const names = EDITOR_LOCALES.map((locale) => editorOver(richReport(), { locale }).editor.state().palette.find((entry) => entry.kind === 'epcQrCode')?.label)
    expect(names).toEqual(['EPC payment code', 'EPC-Zahlcode', 'Code de paiement EPC'])
  })
})

describe('an EPC payment code on the canvas', () => {
  // It prints as a square of its size, whatever it pays, the frame and
  // caption inside it; one wider than its column is flagged, not drawn
  // narrower than it prints.
  test('is its square, and flagged where it is wider than its column', () => {
    const report = richReport()
    const narrow = { ...code(report), id: 'narrow', size: 80 }
    const side = { id: 'side', kind: 'columns', columns: [{ width: 60, components: [narrow] }, { width: 'fill', components: [] }] } as const
    const { boxes } = editorOver({ ...report, regions: { ...report.regions, body: [...report.regions.body, side] } }).editor.state().canvas
    const box = (id: string) => boxes.find((candidate) => candidate.id === id)
    expect(box('pay-code')).toMatchObject({ pt: { width: 85.04, height: 85.04 }, overflows: false })
    expect(box('narrow')).toMatchObject({ pt: { width: 80, height: 80 }, overflows: true })
  })
})

describe('an EPC payment code’s properties', () => {
  // In the order the code holds them, then its square and its frame. A
  // required text is edited run by run, as a text's content is, each run
  // named by the text it belongs to; an optional one that is absent, or
  // one literal run, is one field, emptied to remove it. No text is a
  // textarea: a line break ends its line of the code, and report-spec
  // refuses one.
  test('are its texts in the order it encodes them, then its square and its frame', () => {
    const { editor } = selected()
    const fields = editor.state().properties.fields
    expect(fields.map((each) => [each.key, each.label, each.kind, each.value, each.required]).slice(0, -2)).toEqual([
      ['/beneficiary/0/text', 'Beneficiary', 'text', 'Franz Mustermänn', true],
      ['/iban/0/text', 'IBAN', 'text', 'DE71 1102 2033 0123 4567 89', true],
      ['/bic', 'BIC', 'text', 'BHBLDEHHXXX', false],
      ['/amount', 'Amount', 'expression', 'totals.total', false],
      ['/purpose', 'Purpose code', 'text', 'GDDS', false],
      ['/reference', 'RF creditor reference', 'text', '', false],
      ['/text/0/text', 'Remittance text, part 1: Text', 'text', 'Orders for ', true],
      ['/text/1', 'Remittance text, part 2: Field', 'binding', 'field:header:customer', true],
      ['/information', 'Note to the payer', 'text', '', false],
      ['/size', 'Size (mm)', 'length', '30', true],
      ['/caption', 'Caption', 'select', 'zahlenMitCode', false],
    ])
  })

  // An empty BIC is version 002, a code without one, which report-spec
  // takes for an account in the EEA. But the EPC keeps the BIC mandatory
  // where "SCT scheme participants from non-EEA countries" take part (2.2),
  // the payer's bank among them, which no template knows: the empty field
  // says so, where the author decides, in each language.
  test('say what an empty BIC means, and whose bank may need one', () => {
    const placeholders = EDITOR_LOCALES.map((locale) => {
      const { editor } = selected(locale)
      ok(editor.dispatch({ type: 'setProperty', key: '/bic', value: '' }))
      return field(editor.state().properties.fields, '/bic').placeholder
    })
    expect(placeholders).toEqual([
      'Empty: none, which a payer’s bank outside the EEA may need',
      'Leer: keiner, den die Bank eines Zahlers ausserhalb des EWR brauchen kann',
      'Vide : aucun, dont la banque d’un payeur hors de l’EEE peut avoir besoin',
    ])
  })

  // The parts of a text say which text they are part of, in each
  // language: "Part 2: Field" alone would not tell the remittance text's
  // run from a name's. An edit of one is labelled so too, and undone in
  // another editor of the session in that one's words.
  test('name a part of a text by the text it belongs to, in each language', () => {
    const parts = EDITOR_LOCALES.map((locale) => {
      const fields = selected(locale).editor.state().properties.fields
      return [field(fields, '/text/0/text').label, field(fields, '/text/1').label]
    })
    expect(parts).toEqual([
      ['Remittance text, part 1: Text', 'Remittance text, part 2: Field'],
      ['Verwendungszweck, Teil 1: Text', 'Verwendungszweck, Teil 2: Feld'],
      ['Communication, partie 1 : Texte', 'Communication, partie 2 : Champ'],
    ])
    const { editor, session } = selected()
    ok(editor.dispatch({ type: 'setProperty', key: '/text/0/text', value: 'Invoice for ' }))
    expect(code(session.document()).text).toEqual([{ kind: 'text', text: 'Invoice for ' }, { kind: 'field', field: { dataset: 'header', field: 'customer' } }])
    expect(editor.state().history.undoLabel).toBe('Change Remittance text, part 1: Text')
    expect(createReportEditor(session, { locale: 'de-CH' }).state().history.undoLabel).toBe('Ändern: Verwendungszweck, Teil 1: Text')
  })

  // An IBAN is checked by the validator when it is written, as every
  // value is: one whose check digits are wrong is refused on its field in
  // report-spec's words, which name the rule and never the account, and
  // the code still pays the account it did. Spaces and lower case are a
  // person's way of writing one, and are taken.
  test('refuse an IBAN whose check digits are wrong, on its field, without quoting it', () => {
    const { editor, session } = selected()
    const wrong = 'DE71 1102 2033 0123 4567 88'
    expect(editor.dispatch({ type: 'setProperty', key: '/iban/0/text', value: wrong })).toMatchObject({ ok: false, code: 'refused' })
    const iban = field(editor.state().properties.fields, '/iban/0/text')
    expect(iban.value).toBe(wrong)
    expect(iban.error).toMatch(/check digits/)
    expect(iban.error).not.toMatch(/1102|DE71/)
    expect(session.revision()).toBe(0)
    ok(editor.dispatch({ type: 'setProperty', key: '/iban/0/text', value: 'de71 1102 2033 0123 4567 89' }))
    expect(code(session.document()).iban).toEqual([{ kind: 'text', text: 'de71 1102 2033 0123 4567 89' }])
  })

  // An optional text that is absent is an empty field: typed into, it is
  // one run of what was typed; emptied, it is gone, as every optional
  // property is, and the code leaves its element empty. Left empty where
  // it was absent, nothing is edited. Without a BIC an account in the EEA
  // is still paid (version 002), and an amount removed is the payer's to
  // fill in.
  test('add an optional text by typing it, and remove it, or any optional value, by emptying it', () => {
    const { editor, session } = selected()
    ok(editor.dispatch({ type: 'setProperty', key: '/information', value: 'Thank you for your order' }))
    expect(code(session.document()).information).toEqual([{ kind: 'text', text: 'Thank you for your order' }])
    expect(field(editor.state().properties.fields, '/information').value).toBe('Thank you for your order')
    expect(editor.state().history.undoLabel).toBe('Change Note to the payer')
    for (const key of ['/information', '/bic', '/purpose', '/amount', '/caption']) ok(editor.dispatch({ type: 'setProperty', key, value: '' }))
    const emptied = code(session.document())
    for (const key of ['information', 'bic', 'purpose', 'amount', 'caption']) expect(Object.hasOwn(emptied, key), key).toBe(false)
    // Nor is it said to be: the state is the one it was, with no "Changed" for a screen reader to announce.
    const [revision, state] = [session.revision(), editor.state()]
    for (const key of ['/reference', '/purpose']) ok(editor.dispatch({ type: 'setProperty', key, value: '' }))
    expect(session.revision()).toBe(revision)
    expect(editor.state()).toBe(state)
  })

  // What two texts break together is the validator's to say too, on the
  // field the person typed in: a creditor reference beside a remittance
  // text, which the EPC allows one of, and a BIC of a bank in another
  // country than the account's.
  test('refuse a reference beside a remittance text, and a BIC of another country than the account’s', () => {
    const { editor, session } = selected()
    expect(editor.dispatch({ type: 'setProperty', key: '/reference', value: 'RF18 5390 0754 7034' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/reference').error).toMatch(/never both/)
    expect(editor.dispatch({ type: 'setProperty', key: '/bic', value: 'AAAAFRPPXXX' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/bic').error).toMatch(/another country/)
    expect(editor.dispatch({ type: 'setProperty', key: '/purpose', value: 'gdds' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/purpose').error).toMatch(/four capital letters/)
    expect(session.revision()).toBe(0)
  })

  // A text takes text: a builder that sent a checkbox's true to one would
  // write its own mistake into the code, and is refused before the report
  // is touched, whether the text is absent, one run or the purpose.
  test('refuse what is not text for a text, before the report is touched', () => {
    const { editor, session } = selected()
    const outcomes = ['/information', '/bic', '/purpose'].map((key) => editor.dispatch({ type: 'setProperty', key, value: true }))
    expect(outcomes.map((outcome) => (outcome.ok ? 'applied' : outcome.code))).toEqual(['invalid-value', 'invalid-value', 'invalid-value'])
    expect(session.revision()).toBe(0)
  })

  // The frame is chosen or not, and the code alone is the absence of
  // one. With it, the PSA's modules of 15 to 20 mil need a square of
  // 68.06 pt at least, which the validator says on the field; alone, the
  // same square stands, and the frame chosen for it then is refused for
  // the room it lacks.
  test('choose the frame or the code alone, the square held to what each prints in', () => {
    const { editor, session } = selected()
    expect(field(editor.state().properties.fields, '/caption').options).toEqual([
      { value: '', label: 'Code alone' },
      { value: 'zahlenMitCode', label: 'Frame and “Zahlen mit Code” (Austria)' },
    ])
    expect(editor.dispatch({ type: 'setProperty', key: '/size', value: '20' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/size').error).toMatch(/at least 68\.06 pt/)
    ok(editor.dispatch({ type: 'setProperty', key: '/caption', value: '' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/size', value: '20' }))
    expect(code(session.document()).size).toBe(mmToPt(20))
    expect(editor.dispatch({ type: 'setProperty', key: '/caption', value: 'zahlenMitCode' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state().properties.fields, '/caption').error).toMatch(/at least 68\.06 pt/)
  })

  // The options' words are each language's own.
  test('name the frame’s options in each language', () => {
    const labels = EDITOR_LOCALES.map((locale) => field(selected(locale).editor.state().properties.fields, '/caption').options?.map((option) => option.label))
    expect(labels).toEqual([
      ['Code alone', 'Frame and “Zahlen mit Code” (Austria)'],
      ['Nur der Code', 'Rahmen mit «Zahlen mit Code» (Österreich)'],
      ['Code seul', 'Cadre avec « Zahlen mit Code » (Autriche)'],
    ])
  })

  // The amount is an expression the editor compiles as the runtime will:
  // one that gives a string is marked on its field before any render
  // could refuse it, with report-core's reason.
  test('show what is wrong with an amount on its field', () => {
    const { editor } = selected()
    ok(editor.dispatch({ type: 'setProperty', key: '/amount', value: 'header.customer' }))
    expect(field(editor.state().properties.fields, '/amount').error).toMatch(/^an EPC QR code's amount is a decimal/)
  })
})
