import type { EpcQrCodeComponent, FacturXInvoice, Inline, ReportDefinition, XRechnungInvoice } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { eInvoiceReport } from './image-test-support.js'
import type { EditorState } from './model.js'
import type { EditorOutcome } from './model-actions.js'
import type { PropertyField, PropertyGroup } from './model-properties.js'
import { invoicedScenarioReport, SCENARIO_ACCOUNT, xrechnungScenarioReport } from './scenario-e-invoice.js'
import { EDITOR_LOCALES } from './text.js'
import { editorOver, richReport } from './test-support.js'

/**
 * A report's e-invoice in the editor (0044): selected from its outline row
 * after the payment part's, edited field by field in its groups, its VAT
 * categories a list, the account it shares with its payment codes one
 * edit wherever it is typed, deleted in one step and never added from
 * nothing; and every refusal on its field, in report-spec's words.
 */

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

/** The e-invoice a report holds; fails the test without one. */
function invoiceOf(report: ReportDefinition): FacturXInvoice | XRechnungInvoice {
  if (report.eInvoice === undefined) throw new Error('no e-invoice')
  return report.eInvoice
}

/** The field of the panel labelled `label`; fails the test without one. */
function field(state: EditorState, label: string): PropertyField {
  const found = state.properties.fields.find((candidate) => candidate.label === label)
  if (found === undefined) throw new Error(`no field ${label} among ${state.properties.fields.map((candidate) => candidate.label).join(' | ')}`)
  return found
}

/** The group of the panel named `label`; fails the test without one. */
function group(state: EditorState, label: string): PropertyGroup {
  const found = state.properties.rows.flatMap((row) => ('group' in row ? [row.group] : [])).find((candidate) => candidate.label === label)
  if (found === undefined) throw new Error(`no group ${label}`)
  return found
}

/** The literal text of `runs`. */
const text = (runs: readonly Inline[] | undefined): string | undefined => runs?.map((run) => (run.kind === 'text' ? run.text : `[${run.kind}]`)).join('')

/** The account each EPC QR code of `report` pays. */
const codeAccounts = (report: ReportDefinition): (string | undefined)[] =>
  Object.values(report.regions)
    .flat()
    .filter((component): component is EpcQrCodeComponent => component.kind === 'epcQrCode')
    .map((code) => text(code.iban))

/** An editor over `report` with its e-invoice selected. */
function selectedInvoice(report: ReportDefinition = invoicedScenarioReport(), locale: (typeof EDITOR_LOCALES)[number] = 'en'): ReturnType<typeof editorOver> {
  const opened = editorOver(report, { locale })
  ok(opened.editor.dispatch({ type: 'select', part: 'eInvoice' }))
  return opened
}

/** Sets the field labelled `label` of the selection to `value`. */
function set(opened: ReturnType<typeof editorOver>, label: string, value: string | boolean): EditorOutcome {
  return opened.editor.dispatch({ type: 'setProperty', key: field(opened.editor.state(), label).key, value })
}

describe('a report with an e-invoice, in the editor', () => {
  // The e-invoice prints nothing of its own, so the outline is where a
  // person finds it: a row after the regions, after the payment part's,
  // named in the editor's words, which every walk takes last.
  test('has a row after the payment part’s, named in three languages, which every walk takes last', () => {
    for (const [locale, part, invoice] of [
      ['en', 'Payment part', 'E-invoice'],
      ['de-CH', 'Zahlteil', 'E-Rechnung'],
      ['fr-CH', 'Section paiement', 'Facture électronique'],
    ] as const) {
      const { editor } = editorOver(invoicedScenarioReport(), { locale })
      expect(editor.state().outlineParts.map((row) => [row.part, row.label]), locale).toEqual([
        ['paymentPart', part],
        ['eInvoice', invoice],
      ])
      ok(editor.dispatch({ type: 'selectLast' }))
      expect(editor.state().selection, locale).toEqual({ part: 'eInvoice' })
      ok(editor.dispatch({ type: 'selectPrevious' }))
      expect(editor.state().selection, locale).toEqual({ part: 'paymentPart' })
    }
    // A report without a bill has the e-invoice's row alone, and none without an e-invoice.
    expect(editorOver(eInvoiceReport()).editor.state().outlineParts.map((row) => row.part)).toEqual(['eInvoice'])
    expect(editorOver(richReport()).editor.state().outlineParts).toEqual([])
  })

  // The heading says which kind of e-invoice it is: its PDF is the
  // hybrid's, or a copy of an XRechnung's XML.
  test('heads its properties with its kind, in three languages', () => {
    expect(selectedInvoice().editor.state().properties.heading).toBe('Factur-X: E-invoice')
    expect(selectedInvoice(xrechnungScenarioReport(), 'de-CH').editor.state().properties.heading).toBe('XRechnung: E-Rechnung')
    // Swiss French sets a no-break space before its colon.
    expect(selectedInvoice(invoicedScenarioReport(), 'fr-CH').editor.state().properties.heading).toBe('Factur-X : Facture électronique')
  })

  // It has one place and a report holds one: the moves and Duplicate are
  // unavailable and refused, saying why in its own words -- not the
  // bill's, which SIX puts at the foot of a page -- and Delete is there.
  test('is not moved or copied, and says why', () => {
    const { editor, session } = selectedInvoice()
    expect(editor.state().can).toMatchObject({ delete: true, duplicate: false, moveUp: false, moveDown: false, indent: false, outdent: false, moveTo: false })
    for (const type of ['moveUp', 'moveDown', 'indent', 'outdent', 'duplicate'] as const) {
      expect(editor.dispatch({ type }), type).toMatchObject({ ok: false, code: 'at-edge', message: 'E-invoice prints nothing of its own and is written as its XML: it is not moved or copied.' })
    }
    expect(session.revision()).toBe(0)
  })

  // Delete takes the e-invoice away in one step, said in a sentence of its
  // own, the row before it selected; undo gives back the very e-invoice.
  // Nothing adds one back: an e-invoice is edited, not made (INV-Q9).
  test('is deleted in one step, and undo gives back the very e-invoice', () => {
    const { editor, session } = selectedInvoice()
    const before = session.document().eInvoice
    ok(editor.dispatch({ type: 'delete' }))
    expect(session.document().eInvoice).toBeUndefined()
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
    expect(editor.state().history.undoLabel).toBe('Remove e-invoice')
    expect(editor.state().status.text).toBe('Deleted the e-invoice.')
    expect(editor.state().properties.rows.some((row) => 'group' in row && row.group.actions.some((action) => action.action.type === 'addPart'))).toBe(false)
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().eInvoice).toBe(before)
    // Without a bill, the row before it is the report's last component.
    const plain = selectedInvoice(eInvoiceReport())
    ok(plain.editor.dispatch({ type: 'delete' }))
    expect(plain.editor.state().selection).toEqual({ id: 'totals' })
  })

  // A problem with a term of the e-invoice is the e-invoice's: listed by
  // its name, counted on its row, followed to it, and on the field of the
  // term it is about.
  test('lists the problems of its terms as its own, on their fields', () => {
    const report = invoicedScenarioReport()
    const broken = { ...report, eInvoice: { ...invoiceOf(report), issued: { cel: 'header.missing' } } }
    const { editor } = editorOver(broken)
    const entry = editor.state().diagnostics.find((candidate) => candidate.target !== null && 'part' in candidate.target && candidate.target.part === 'eInvoice')
    expect(entry).toMatchObject({ severity: 'error', where: 'E-invoice', label: 'Error: E-invoice' })
    expect(editor.state().outlineParts.find((row) => row.part === 'eInvoice')).toMatchObject({ problems: 1, severity: 'error' })
    ok(editor.dispatch({ type: 'select', part: 'eInvoice' }))
    expect(field(editor.state(), 'Issue date').error).toBe(entry?.message)
  })
})

describe('the e-invoice’s properties', () => {
  // Each term is edited where it is shown, each one step named for its
  // field, in its own words; undo gives back the very e-invoice.
  test('edit a party and a VAT rate, one step each, named for the field', () => {
    const opened = selectedInvoice()
    const before = opened.session.document().eInvoice
    ok(set(opened, 'Buyer’s name', 'Gasthaus Zur Linde GmbH'))
    expect(opened.editor.state().history.undoLabel).toBe('Change Buyer’s name')
    ok(set(opened, 'VAT category 2: rate in per cent', '7.00'))
    expect(opened.editor.state().history.undoLabel).toBe('Change VAT category 2: rate in per cent')
    expect(opened.editor.state().status.text).toBe('Changed VAT category 2: rate in per cent.')
    expect([text(invoiceOf(opened.session.document()).buyer.name), invoiceOf(opened.session.document()).vat[1]?.rate]).toEqual(['Gasthaus Zur Linde GmbH', '7.00'])
    ok(opened.editor.dispatch({ type: 'undo' }))
    ok(opened.editor.dispatch({ type: 'undo' }))
    expect(opened.session.document().eInvoice).toBe(before)
  })

  // What EN 16931's rules refuse is refused on the field typed into, in
  // report-spec's words, never quoting the value, and changes nothing: a
  // standard rate below 0.5 (BR-CO-17); a column printing two terms of a
  // line; a code read from a field of another type.
  test('refuse what EN 16931’s rules refuse, on the field typed into, in the validator’s words', () => {
    const opened = selectedInvoice()
    const before = opened.session.document()
    expect(set(opened, 'VAT category 1: rate in per cent', '0.4')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'VAT category 1: rate in per cent').error).toMatch(/BR-CO-17/)
    expect(set(opened, 'Column of the net price', 'quantity')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'Column of the net price').error).toMatch(/a column prints one term of a line/)
    expect(set(opened, 'Unit read from', 'field:position')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'Unit read from').error).toMatch(/integer/)
    expect(opened.session.document()).toBe(before)
  })

  // A line's code is read from a detail field or an expression: choosing
  // an expression over a field reads that field, so nothing the line
  // holds changes but how it is written, and the expression is a field
  // of its own.
  test('read a line’s code from a field or an expression', () => {
    const opened = selectedInvoice()
    ok(set(opened, 'Line identifier read from', 'expression'))
    expect(invoiceOf(opened.session.document()).lines.id).toEqual({ kind: 'expression', expression: { cel: 'row.position' } })
    expect(field(opened.editor.state(), 'Expression of the line identifier').value).toBe('row.position')
    ok(set(opened, 'Expression of the line identifier', 'string(row.position)'))
    expect(invoiceOf(opened.session.document()).lines.id).toEqual({ kind: 'expression', expression: { cel: 'string(row.position)' } })
    ok(set(opened, 'Unit read from', 'field:name'))
    expect(invoiceOf(opened.session.document()).lines.unit).toEqual({ kind: 'field', field: { dataset: 'detail', field: 'name' } })
    expect(opened.editor.state().properties.fields.some((candidate) => candidate.label === 'Expression of the unit')).toBe(false)
  })

  // A party's electronic address is put in by typing it, by email until
  // its scheme is chosen, and taken away by emptying it; the invoicing
  // period by either of its dates, and taken away with the last of them.
  test('put a part in by typing its identifier or its date, and take it away by emptying it', () => {
    const opened = selectedInvoice()
    ok(set(opened, 'Buyer’s electronic address', 'invoices@kunde.example'))
    expect(invoiceOf(opened.session.document()).buyer.electronicAddress).toEqual({ id: said('invoices@kunde.example'), scheme: 'EM' })
    ok(set(opened, 'Buyer’s electronic address scheme', '0088'))
    expect(invoiceOf(opened.session.document()).buyer.electronicAddress?.scheme).toBe('0088')
    ok(set(opened, 'Buyer’s electronic address', ''))
    expect(invoiceOf(opened.session.document()).buyer).not.toHaveProperty('electronicAddress')
    ok(set(opened, 'Invoicing period from', '"2026-10-01"'))
    expect(invoiceOf(opened.session.document()).period).toEqual({ start: { cel: '"2026-10-01"' } })
    ok(set(opened, 'Invoicing period from', ''))
    expect(invoiceOf(opened.session.document())).not.toHaveProperty('period')
    ok(set(opened, 'Seller’s legal registration', 'HRB 12345'))
    expect(invoiceOf(opened.session.document()).seller.legalId).toEqual({ id: said('HRB 12345') })
  })

  // A period gives a start, an end or both: the end emptied while the start
  // stands leaves the period with its start, and a start left empty where
  // there is no period is no edit at all, so nothing is announced or put in
  // the history.
  test('keep a period with the date that stands, and make no edit of an empty date where there is none', () => {
    const opened = selectedInvoice()
    ok(set(opened, 'Invoicing period from', '"2026-10-01"'))
    ok(set(opened, 'Invoicing period to', '"2026-10-20"'))
    ok(set(opened, 'Invoicing period to', ''))
    expect(invoiceOf(opened.session.document()).period).toEqual({ start: { cel: '"2026-10-01"' } })
    const plain = selectedInvoice()
    ok(set(plain, 'Invoicing period from', ''))
    expect(plain.session.revision()).toBe(0)
  })

  // The seller's contact is added from values that reach nobody, its name
  // in the report's language, and removed, one step each; the payment
  // instructions are removed where nothing needs them, and refused where
  // an EPC code asks to be paid to their account, in the validator's
  // words.
  test('add and remove the seller’s contact, and the payment instructions where nothing pays them', () => {
    const opened = selectedInvoice()
    ok(opened.editor.dispatch({ type: 'addGroup', key: '/seller/contact' }))
    expect(invoiceOf(opened.session.document()).seller.contact).toEqual({ name: said('Name of the contact'), telephone: said('+49 221 4710 000'), email: said('contact@example.com') })
    expect(opened.editor.state().history.undoLabel).toBe('Add contact')
    expect(opened.editor.state().status.text).toBe('Added Seller’s contact.')
    ok(opened.editor.dispatch({ type: 'removeGroup', key: '/seller/contact' }))
    expect(invoiceOf(opened.session.document()).seller).not.toHaveProperty('contact')
    const before = opened.session.document()
    expect(opened.editor.dispatch({ type: 'removeGroup', key: '/payment' })).toMatchObject({ ok: false, code: 'refused' })
    expect(opened.editor.state().status.text).toMatch(/asks to be paid to an account, and the e-invoice names none/)
    expect(opened.session.document()).toBe(before)
    const plain = selectedInvoice(eInvoiceReport())
    ok(plain.editor.dispatch({ type: 'addGroup', key: '/payment' }))
    expect(invoiceOf(plain.session.document()).payment).toEqual({ means: '58', iban: said('DE36 0000 0000 0000 0000 00') })
    expect(plain.editor.state().history.undoLabel).toBe('Add payment instructions')
  })

  // An XRechnung needs its contact and its payment instructions: neither
  // has a Remove, and either taken away by a caller is refused as no
  // group to remove.
  test('give an XRechnung’s contact and payment instructions no Remove', () => {
    const { editor } = selectedInvoice(xrechnungScenarioReport())
    expect(group(editor.state(), 'Seller’s contact').actions).toEqual([])
    expect(editor.dispatch({ type: 'removeGroup', key: '/seller/contact' })).toMatchObject({ ok: false, code: 'unavailable' })
  })

  // An XRechnung's own rules are refused where they are typed, in
  // report-spec's words: a Skonto line in its payment terms (BR-DE-18).
  test('refuse a Skonto line in an XRechnung’s payment terms, on the field', () => {
    const opened = selectedInvoice(xrechnungScenarioReport())
    expect(set(opened, 'Payment terms', '#SKONTO#TAGE=14#PROZENT=2.00#\n')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'Payment terms').error).toMatch(/BR-DE-18/)
  })
})

describe('the e-invoice’s VAT categories', () => {
  /** The categories' ids and rates, in order. */
  const listed = (report: ReportDefinition): string => invoiceOf(report).vat.map((category) => `${category.id} ${category.code} ${category.rate}`).join(', ')

  // Add puts a category of a breakdown the invoice lacks at the end,
  // under a fresh identifier; a move and a removal are one step each, each
  // named in the history; undo takes each back.
  test('add, move and remove one, one step each', () => {
    const opened = selectedInvoice()
    ok(opened.editor.dispatch({ type: 'addItem', key: '/vat' }))
    expect(listed(opened.session.document())).toBe('standard S 19, reduced S 7, category3 E 0')
    expect(invoiceOf(opened.session.document()).vat[2]?.reason).toEqual(said('Exempt from VAT'))
    expect([opened.editor.state().history.undoLabel, opened.editor.state().status.text]).toEqual(['Add VAT category', 'Added VAT category 3.'])
    ok(opened.editor.dispatch({ type: 'moveItem', key: '/vat/2', to: 0 }))
    expect(listed(opened.session.document())).toBe('category3 E 0, standard S 19, reduced S 7')
    expect([opened.editor.state().history.undoLabel, opened.editor.state().status.text]).toEqual(['Move VAT category', 'Moved VAT category 3 to place 1.'])
    ok(opened.editor.dispatch({ type: 'removeItem', key: '/vat/1' }))
    expect(listed(opened.session.document())).toBe('category3 E 0, reduced S 7')
    expect([opened.editor.state().history.undoLabel, opened.editor.state().status.text]).toEqual(['Remove VAT category', 'Removed VAT category 2.'])
    ok(opened.editor.dispatch({ type: 'undo' }))
    expect(listed(opened.session.document())).toBe('category3 E 0, standard S 19, reduced S 7')
    expect(opened.editor.state().selection).toEqual({ part: 'eInvoice' })
  })

  // In a German report, a reverse-charged category added says the words
  // § 14a Abs. 5 UStG asks for.
  test('give a category added the report’s words', () => {
    const report = invoicedScenarioReport()
    // A reverse charge needs the buyer's VAT identifier (BR-AE-02), which the buyer is given.
    const invoice = invoiceOf(report) as FacturXInvoice
    const opened = selectedInvoice({
      ...report,
      locale: 'de-DE',
      eInvoice: { ...invoice, buyer: { ...invoice.buyer, vatId: said('ATU12345678') }, vat: [...invoice.vat, { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei nach § 4 Nr. 8 Buchst. a UStG') }] },
    })
    ok(opened.editor.dispatch({ type: 'addItem', key: '/vat' }))
    expect(invoiceOf(opened.session.document()).vat[3]).toEqual({ id: 'category4', code: 'AE', rate: '0', reason: said('Steuerschuldnerschaft des Leistungsempfängers') })
  })

  // An invoice that holds each breakdown Add VAT category could add --
  // standard rated at 19 % and 7 %, exempt and reverse-charged, as the
  // e-invoice starter does -- has nowhere for another to go: the button is
  // unavailable, and pressed it is refused as unavailable, as every
  // action the state marks so is, saying why, the report unchanged.
  test('mark Add VAT category unavailable where every breakdown it adds is taken, and refuse it as unavailable, saying why', () => {
    const report = invoicedScenarioReport()
    const invoice = invoiceOf(report) as FacturXInvoice
    const full = {
      ...report,
      eInvoice: {
        ...invoice,
        buyer: { ...invoice.buyer, vatId: said('ATU12345678') },
        vat: [...invoice.vat, { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei') }, { id: 'reverse', code: 'AE', rate: '0', reason: said('Reverse charge') }],
      },
    } as ReportDefinition
    const opened = selectedInvoice(full)
    expect(group(opened.editor.state(), 'VAT categories').actions[0]?.available).toBe(false)
    expect(group(selectedInvoice().editor.state(), 'VAT categories').actions[0]?.available).toBe(true)
    const before = opened.session.document()
    expect(opened.editor.dispatch({ type: 'addItem', key: '/vat' })).toMatchObject({
      ok: false,
      code: 'unavailable',
      message: 'The e-invoice declares every VAT breakdown a category added could be: change one of its categories instead.',
    })
    expect(opened.session.document()).toBe(before)
  })

  // A move past either end, a key that names no item and a list the
  // selection has not are refused before the report is touched; the last
  // category taken away is report-spec's to refuse, an invoice needing one.
  test('refuse a move past either end, a key that names nothing, and the last one taken away', () => {
    const opened = selectedInvoice()
    const before = opened.session.document()
    expect(opened.editor.dispatch({ type: 'moveItem', key: '/vat/0', to: -1 })).toMatchObject({ ok: false, code: 'at-edge', message: 'VAT category 1 is already first.' })
    expect(opened.editor.dispatch({ type: 'moveItem', key: '/vat/1', to: 2 })).toMatchObject({ ok: false, code: 'at-edge', message: 'VAT category 2 is already last.' })
    for (const key of ['/vat/2', '/vat/x', '/vat/01', '/lines/0', '/nowhere']) expect(opened.editor.dispatch({ type: 'removeItem', key }), key).toMatchObject({ ok: false, code: 'not-found' })
    expect(opened.editor.dispatch({ type: 'moveItem', key: '/vat/1', to: 1 })).toMatchObject({ ok: false, code: 'at-edge', message: 'Nothing was moved.' })
    expect(opened.editor.dispatch({ type: 'addItem', key: '/seller' })).toMatchObject({ ok: false, code: 'not-found' })
    ok(opened.editor.dispatch({ type: 'removeItem', key: '/vat/1' }))
    expect(opened.editor.dispatch({ type: 'removeItem', key: '/vat/0' })).toMatchObject({ ok: false, code: 'refused' })
    ok(opened.editor.dispatch({ type: 'undo' }))
    expect(opened.session.document()).toBe(before)
  })
})

describe('the account the e-invoice shares with its payment codes', () => {
  // Wherever the IBAN is typed -- the e-invoice's field, the bill's, the
  // EPC code's -- the e-invoice and every payment code printed with it
  // pay it, in one step, which the live region says and one undo takes
  // back (INV-Q8).
  test.each([
    ['the e-invoice’s', { part: 'eInvoice' } as const],
    ['the QR-bill’s', { part: 'paymentPart' } as const],
    ['the EPC code’s', { id: 'pay-code' } as const],
  ])('is changed in all three from %s field, in one step', (_where, selection) => {
    const opened = editorOver(invoicedScenarioReport())
    ok(opened.editor.dispatch({ type: 'select', ...selection }))
    const before = opened.session.document()
    ok(set(opened, 'IBAN', 'CH56 0483 5012 3456 7800 9'))
    const after = opened.session.document()
    expect([text(invoiceOf(after).payment?.iban), text(after.paymentPart?.account), ...codeAccounts(after)]).toEqual(Array(3).fill('CH56 0483 5012 3456 7800 9'))
    expect(opened.editor.state().history.undoLabel).toBe('Change IBAN')
    expect(opened.editor.state().status.text).toBe('Changed IBAN. The e-invoice and every payment code printed with it pay the account typed.')
    expect(opened.session.revision()).toBe(1)
    ok(opened.editor.dispatch({ type: 'undo' }))
    expect([opened.session.document().eInvoice, opened.session.document().paymentPart, opened.session.document().regions]).toEqual([before.eInvoice, before.paymentPart, before.regions])
  })

  // An account one place cannot take is refused on the field typed into,
  // in that place's rule, and none of the three changes. Typed into the
  // bill's field, the bill's own rule is the one said -- not the EPC
  // code's BIC of another country, which the validator may list first --
  // since a person reads the field's error as being about that field.
  test.each(EDITOR_LOCALES)('refuses, in %s, an account the bill cannot pay, on the field typed into, in the bill’s own rule', (locale) => {
    const opened = editorOver(invoicedScenarioReport(), { locale })
    ok(opened.editor.dispatch({ type: 'select', part: 'paymentPart' }))
    const before = opened.session.document()
    expect(opened.editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'DE89 3704 0044 0532 0130 00' })).toMatchObject({ ok: false, code: 'refused' })
    const error = opened.editor.state().properties.fields.find((candidate) => candidate.key === '/account/0/text')?.error
    expect(error).toMatch(/Switzerland or Liechtenstein/)
    expect(error).not.toMatch(/BIC/)
    expect(opened.session.document()).toBe(before)
  })

  // Typed into the e-invoice's field, which takes a German account, the
  // field says why the edit was refused, in the words of a place that
  // refused it; emptied, the e-invoice's own rule is the one said, not a
  // code's that needs the account too.
  test('refuses on the e-invoice’s field in the words of the place that refused, its own first', () => {
    const opened = selectedInvoice()
    const before = opened.session.document()
    expect(set(opened, 'IBAN', 'DE89 3704 0044 0532 0130 00')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'IBAN').error).toMatch(/QR-bill|EPC/)
    expect(set(opened, 'IBAN', '')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'IBAN').error).toMatch(/BT-84/)
    expect(field(opened.editor.state(), 'IBAN').error).not.toMatch(/QR-bill|EPC/)
    expect(opened.session.document()).toBe(before)
  })

  // Where a code reads its account from the data, the render compares it
  // with the e-invoice's (0027): its field writes that code's binding alone,
  // and nothing else changes.
  test('is the code’s own where the code reads its account from the data', () => {
    const report = invoicedScenarioReport()
    const bound = {
      ...report,
      datasets: { ...report.datasets, header: { id: 'visit', fields: [{ id: 'account', type: 'string' as const, label: 'Account', nullable: false }, { id: 'other', type: 'string' as const, label: 'Other account', nullable: false }] } },
      regions: { ...report.regions, summary: report.regions.summary.map((component) => (component.kind === 'epcQrCode' ? { ...component, iban: [{ kind: 'field' as const, field: { dataset: 'header' as const, field: 'account' } }] } : component)) },
    }
    const opened = editorOver(bound)
    ok(opened.editor.dispatch({ type: 'select', id: 'pay-code' }))
    const before = opened.session.document()
    ok(set(opened, 'IBAN', 'field:header:other'))
    expect(opened.editor.state().status.text).toBe('Changed IBAN.')
    expect(opened.session.document().eInvoice).toBe(before.eInvoice)
    expect(opened.session.document().paymentPart).toBe(before.paymentPart)
  })

  // Where the e-invoice reads its account from the data, a code's account
  // and the bill's are each the field's own to write (0044), and the render
  // compares each with the data's (0027): the shared edit, which would
  // write over the binding, is refused whole, so a field that sent it
  // could never change its code's account at all.
  test('is each code’s own where the e-invoice reads its account from the data', () => {
    const report = invoicedScenarioReport()
    const invoice = invoiceOf(report) as FacturXInvoice
    const bound: ReportDefinition = {
      ...report,
      datasets: { ...report.datasets, header: { id: 'visit', fields: [{ id: 'account', type: 'string', label: 'Account', nullable: false }] } },
      eInvoice: { ...invoice, payment: { ...(invoice.payment as NonNullable<FacturXInvoice['payment']>), iban: [{ kind: 'field', field: { dataset: 'header', field: 'account' } }] } },
    }
    const opened = editorOver(bound)
    ok(opened.editor.dispatch({ type: 'select', id: 'pay-code' }))
    const before = opened.session.document()
    ok(set(opened, 'IBAN', 'CH56 0483 5012 3456 7800 9'))
    expect(opened.editor.state().status.text).toBe('Changed IBAN.')
    expect(codeAccounts(opened.session.document())).toEqual(['CH56 0483 5012 3456 7800 9'])
    expect([opened.session.document().eInvoice, opened.session.document().paymentPart]).toEqual([before.eInvoice, before.paymentPart])
    ok(opened.editor.dispatch({ type: 'select', part: 'paymentPart' }))
    ok(set(opened, 'IBAN', 'CH56 0483 5012 3456 7800 9'))
    expect(opened.editor.state().status.text).toBe('Changed IBAN.')
    expect(text(opened.session.document().paymentPart?.account)).toBe('CH56 0483 5012 3456 7800 9')
    expect(opened.session.document().eInvoice).toBe(before.eInvoice)
  })

  // The other way round: where a code reads its account from the data,
  // the e-invoice's field writes BT-84 alone, the code left to the data
  // and the render to compare.
  test('is the e-invoice’s own where a code reads its account from the data', () => {
    const { paymentPart: _bill, ...report } = invoicedScenarioReport()
    const bound: ReportDefinition = {
      ...report,
      datasets: { ...report.datasets, header: { id: 'visit', fields: [{ id: 'account', type: 'string', label: 'Account', nullable: false }] } },
      regions: { ...report.regions, summary: report.regions.summary.map((component) => (component.kind === 'epcQrCode' ? { ...component, iban: [{ kind: 'field' as const, field: { dataset: 'header' as const, field: 'account' } }] } : component)) },
    }
    const opened = selectedInvoice(bound)
    const before = opened.session.document()
    ok(set(opened, 'IBAN', 'CH56 0483 5012 3456 7800 9'))
    expect(opened.editor.state().status.text).toBe('Changed IBAN.')
    expect(text(invoiceOf(opened.session.document()).payment?.iban)).toBe('CH56 0483 5012 3456 7800 9')
    expect(opened.session.document().regions).toBe(before.regions)
  })

  // What that leaves (0044's cost): where one place reads its account from
  // the data and two others are written, each written one is held to the
  // other, so one changed alone is refused on its field, in the words of
  // the rule that holds them together.
  test('refuses one of two written accounts changed alone, where a third reads its account from the data', () => {
    const report = invoicedScenarioReport()
    const bound: ReportDefinition = {
      ...report,
      datasets: { ...report.datasets, header: { id: 'visit', fields: [{ id: 'account', type: 'string', label: 'Account', nullable: false }] } },
      regions: { ...report.regions, summary: report.regions.summary.map((component) => (component.kind === 'epcQrCode' ? { ...component, iban: [{ kind: 'field' as const, field: { dataset: 'header' as const, field: 'account' } }] } : component)) },
    }
    const opened = selectedInvoice(bound)
    const before = opened.session.document()
    expect(set(opened, 'IBAN', 'CH56 0483 5012 3456 7800 9')).toMatchObject({ ok: false, code: 'refused' })
    expect(field(opened.editor.state(), 'IBAN').error).toMatch(/^the QR-bill asks to be paid to another account than the e-invoice's payment account \(BT-84\)/)
    expect(opened.session.document()).toBe(before)
  })

  // Without an e-invoice no account is shared: an EPC code's IBAN is its
  // own, and is changed alone.
  test('is no shared account without an e-invoice', () => {
    const opened = editorOver(richReport())
    ok(opened.editor.dispatch({ type: 'select', id: 'pay-code' }))
    ok(set(opened, 'IBAN', 'DE89 3704 0044 0532 0130 00'))
    expect(opened.editor.state().status.text).toBe('Changed IBAN.')
    expect(codeAccounts(opened.session.document())).toEqual(['DE89 3704 0044 0532 0130 00'])
  })

  // The scenario's account is one the three pay at first: what the cases
  // above change is the account they share.
  test('starts from one account the three pay', () => {
    const report = invoicedScenarioReport()
    expect([text(invoiceOf(report).payment?.iban), text(report.paymentPart?.account), ...codeAccounts(report)]).toEqual(Array(3).fill(SCENARIO_ACCOUNT))
  })
})

describe('a payment code added to a report with an e-invoice', () => {
  // Every payment code printed with an e-invoice is held to its account
  // (BT-84), so the palette's account that pays nobody is refused in every
  // place: the EPC code the palette offers pays the e-invoice's account,
  // as written -- its binding where it reads one -- with its bank's BIC,
  // which an account outside the EEA needs, and is inserted as it stands.
  test('pays the e-invoice’s account, with its BIC, and is inserted as it stands', () => {
    const opened = editorOver(invoicedScenarioReport())
    const entry = opened.editor.state().palette.find((candidate) => candidate.kind === 'epcQrCode')
    const payment = invoiceOf(opened.session.document()).payment
    expect(entry?.component).toMatchObject({ kind: 'epcQrCode', iban: payment?.iban, bic: payment?.bic })
    ok(opened.editor.dispatch({ type: 'insert', kind: 'epcQrCode', target: { region: 'summary', index: 2 } }))
    expect(codeAccounts(opened.session.document())).toEqual([SCENARIO_ACCOUNT, SCENARIO_ACCOUNT])
  })

  // An e-invoice without payment instructions names no account, and a
  // payment code printed with it would ask for one: the palette says what
  // to add first, as it says an image needs an image.
  test('is unavailable where the e-invoice names no account, saying what to add first', () => {
    const { editor } = editorOver(eInvoiceReport())
    expect(editor.state().palette.find((candidate) => candidate.kind === 'epcQrCode')).toMatchObject({ component: null, unavailable: 'Add the e-invoice’s payment instructions first: a payment code printed with it is paid to their account.' })
    expect(editor.dispatch({ type: 'insert', kind: 'epcQrCode', target: { region: 'summary', index: 1 } })).toMatchObject({ ok: false, code: 'unavailable' })
  })

  // A QR-bill printed with an e-invoice asks for its currency and its
  // account: Add QR-bill gives it both, where SIX's example in francs
  // would be refused in every report with an e-invoice, so the bill is
  // added where the e-invoice's account is one a bill can pay -- of
  // Switzerland or Liechtenstein -- and refused in report-spec's words
  // where it is not.
  test('adds a QR-bill in the e-invoice’s currency to its account, and is refused in the validator’s words where a bill cannot pay it', () => {
    const { paymentPart: _bill, ...report } = invoicedScenarioReport()
    const opened = editorOver(report)
    ok(opened.editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
    const bill = opened.session.document().paymentPart
    expect([bill?.currency, text(bill?.account)]).toEqual(['EUR', SCENARIO_ACCOUNT])
    const german = eInvoiceReport()
    const invoice = invoiceOf(german) as FacturXInvoice
    const paid = editorOver({ ...german, eInvoice: { ...invoice, payment: { means: '58', iban: said('DE89 3704 0044 0532 0130 00') } } })
    const before = paid.session.document()
    expect(paid.editor.dispatch({ type: 'addPart', part: 'paymentPart' })).toMatchObject({ ok: false, code: 'refused' })
    expect(paid.editor.state().status.text).toMatch(/^The QR-bill was not added: .*Switzerland or Liechtenstein/)
    expect(paid.session.document()).toBe(before)
  })
})

describe('the e-invoice’s groups, sent what no builder sends', () => {
  // A builder in plain JavaScript may send a key that is no string; the
  // editor refuses it as naming nothing, as it refuses such a part or
  // field, rather than throw out of dispatch.
  test('refuse a key that is no string, as naming nothing', () => {
    const { editor, session } = selectedInvoice()
    for (const action of [{ type: 'addItem' }, { type: 'addItem', key: 42 }, { type: 'removeItem' }, { type: 'removeItem', key: null }, { type: 'moveItem', to: 0 }, { type: 'moveItem', key: 7, to: 0 }, { type: 'addGroup' }, { type: 'removeGroup', key: {} }]) {
      expect(editor.dispatch(action as never), JSON.stringify(action)).toMatchObject({ ok: false, code: 'not-found' })
    }
    expect(session.revision()).toBe(0)
  })

  // A group that is no optional one is said to be part of every invoice
  // of its kind, in the e-invoice's words and not the bill's, and an item
  // of a list to be added and removed by the list's buttons, its number
  // filled in.
  test('say why a group that is part of every e-invoice, or an item of a list, is not added or removed', () => {
    const { editor } = selectedInvoice()
    expect(editor.dispatch({ type: 'removeGroup', key: '/seller' })).toMatchObject({ ok: false, code: 'unavailable', message: 'Seller: part of every Factur-X invoice, never added or removed.' })
    expect(editor.dispatch({ type: 'addGroup', key: '/vat/0' })).toMatchObject({ ok: false, code: 'unavailable', message: 'VAT category 1 belongs to a list: its own buttons add and remove its items.' })
    expect(selectedInvoice(xrechnungScenarioReport()).editor.dispatch({ type: 'removeGroup', key: '/seller/contact' })).toMatchObject({ ok: false, code: 'unavailable', message: 'Seller’s contact: part of every XRechnung invoice, never added or removed.' })
  })

  // Refused by the validator, an add, a removal and a move each say what
  // was not done: a reverse-charged category added to an invoice whose
  // buyer has no VAT identifier (BR-AE-02), and the payment instructions
  // removed while an EPC code asks to be paid to their account.
  test('say what was not done when the validator refuses an add or a removal', () => {
    const report = invoicedScenarioReport()
    const invoice = invoiceOf(report) as FacturXInvoice
    const opened = selectedInvoice({ ...report, eInvoice: { ...invoice, vat: [...invoice.vat, { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei') }] } })
    expect(opened.editor.dispatch({ type: 'addItem', key: '/vat' })).toMatchObject({ ok: false, code: 'refused' })
    expect(opened.editor.state().status.text).toMatch(/^Did not add VAT category 4: .*BR-AE-02/)
    expect(opened.editor.dispatch({ type: 'removeGroup', key: '/payment' })).toMatchObject({ ok: false, code: 'refused' })
    expect(opened.editor.state().status.text).toMatch(/^Did not remove Payment instructions: .*asks to be paid to an account, and the e-invoice names none/)
  })
})
