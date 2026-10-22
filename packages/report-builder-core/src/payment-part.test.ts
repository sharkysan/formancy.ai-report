import { emptyReport, QR_BILL_EXAMPLE, QR_BILL_EXAMPLE_ACCOUNTS, QR_BILL_SIZE } from '@formancy/report-spec'
import type { Inline, ReportDefinition, SwissQrBill } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { PX_PER_PT } from './geometry.js'
import { eInvoiceReport } from './image-test-support.js'
import type { EditorAction, EditorOutcome, EditorState, PropertyField, PropertyGroup } from './model.js'
import { EDITOR_LOCALES, editorText } from './text.js'
import { billedReport, editorOver, richReport } from './test-support.js'

/**
 * A report with a payment part -- a Swiss QR-bill, which report-spec holds
 * at the report's level, not in a region -- in the editor: opened, kept
 * whole by every other edit, shown where its slip prints, selected from the
 * outline and the canvas, and edited field by field (0022, 0039).
 */

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

/** `report` with `count` spacers of 20 pt more at the end of its body: a body taller than the page. */
function longer(report: ReportDefinition, count: number): ReportDefinition {
  const spacers = Array.from({ length: count }, (_, index) => ({ id: `filler-${String(index)}`, kind: 'spacer' as const, height: 20 }))
  return { ...report, regions: { ...report.regions, body: [...report.regions.body, ...spacers] } }
}

/** One literal run. */
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/** The bill a report holds; fails the test without one. */
function billOf(report: ReportDefinition): SwissQrBill {
  if (report.paymentPart === undefined) throw new Error('no bill')
  return report.paymentPart
}

/** The field of the panel labelled `label`; fails the test without one. */
function field(state: EditorState, label: string): PropertyField {
  const found = state.properties.fields.find((candidate) => candidate.label === label)
  if (found === undefined) throw new Error(`no field ${label} among ${state.properties.fields.map((candidate) => candidate.label).join(' | ')}`)
  return found
}

/** The groups the panel draws, by their names. */
function groups(state: EditorState): Map<string, PropertyGroup> {
  return new Map(state.properties.rows.flatMap((row) => ('group' in row ? [[row.group.label, row.group] as const] : [])))
}

/** The editor over the billed report, with its payment part selected. */
function selectedBill(locale: (typeof EDITOR_LOCALES)[number] = 'en'): ReturnType<typeof editorOver> {
  const opened = editorOver(billedReport(), { locale })
  ok(opened.editor.dispatch({ type: 'select', part: 'paymentPart' }))
  return opened
}

/** The billed report as an e-invoice too: a bill in euro to the e-invoice's account (BT-84), as one printed with an e-invoice must be (0027). */
function invoicedBill(): ReportDefinition {
  const report = eInvoiceReport()
  const account = [{ kind: 'text', text: 'CH93 0076 2011 6238 5295 7' }] as const
  return {
    ...report,
    eInvoice: { ...(report.eInvoice as NonNullable<ReportDefinition['eInvoice']>), payment: { means: '58', iban: account } },
    paymentPart: { kind: 'swissQrBill', language: 'de', account, creditor: billOf(billedReport()).creditor, currency: 'EUR' },
  } as ReportDefinition
}

describe('a report with a payment part, in the editor', () => {
  // A bill is the report's, so an editor that rebuilt a report from its
  // regions, or a command that spread only what it knew, would print an
  // invoice without its slip, and nothing on the canvas would say so.
  test('opens with nothing to report but SIX’s example account, and every other edit and its undo keep the very same bill', () => {
    const { editor, session } = editorOver(billedReport())
    expect(editor.state().diagnostics.map((entry) => entry.code)).toEqual(['example-payment-part'])
    const bill = session.document().paymentPart
    expect(bill?.kind).toBe('swissQrBill')
    const actions: EditorAction[] = [
      { type: 'select', id: 'intro' },
      { type: 'moveDown' },
      { type: 'duplicate' },
      { type: 'delete' },
      { type: 'insert', kind: 'text', target: { region: 'body', index: 0 } },
      { type: 'move', id: 'gap', target: { region: 'summary', index: 0 } },
      { type: 'select', id: null },
      { type: 'setProperty', key: '/title', value: 'Orders, invoiced' },
      { type: 'setProperty', key: '/page/margins/top', value: '15' },
      { type: 'undo' },
      { type: 'undo' },
      { type: 'redo' },
    ]
    for (const action of actions) {
      ok(editor.dispatch(action))
      expect(session.document().paymentPart, action.type).toBe(bill)
    }
    expect(session.document().title).toBe('Orders, invoiced')
  })

  // SIX prints the slip across the foot of an A4 page in portrait, and
  // report-spec refuses any other page for a report with a bill: the
  // editor shows that refusal on the field, in the validator's words, and
  // the page stays as it was.
  test('refuses a page the bill cannot be printed on, with the reason on its field', () => {
    for (const [key, value] of [
      ['/page/orientation', 'landscape'],
      ['/page/size', 'Letter'],
    ] as const) {
      const { editor, session } = editorOver(billedReport())
      const outcome = editor.dispatch({ type: 'setProperty', key, value })
      expect(outcome.ok ? 'applied' : outcome.code, key).toBe('refused')
      const found = editor.state().properties.fields.find((candidate) => candidate.key === key)
      expect(found, key).toMatchObject({ value })
      expect(found?.error, key).toMatch(/^a QR-bill is printed across the foot of an A4 page in portrait/)
      expect(session.document().page, key).toEqual(billedReport().page)
    }
  })

  // The page header and the body start at the top margin, and the slip is
  // the page's foot: a top margin past the slip's top would print the
  // invoice into it. The editor refuses the edit on the field with the
  // spec's reason, where the margin is written, rather than leaving it to
  // the first render; up to the slip's top, the margin is the author's.
  test('refuses a top margin that leaves the slip no room, with the reason on its field', () => {
    const { editor, session } = editorOver(billedReport())
    ok(editor.dispatch({ type: 'setProperty', key: '/page/margins/top', value: '192' }))
    expect(session.document().page.margins.top).toBe(544.25)
    const outcome = editor.dispatch({ type: 'setProperty', key: '/page/margins/top', value: '195' })
    expect(outcome.ok ? 'applied' : outcome.code).toBe('refused')
    const found = editor.state().properties.fields.find((candidate) => candidate.key === '/page/margins/top')
    expect(found).toMatchObject({ value: '195' })
    expect(found?.error).toMatch(/^the top margin reaches 552\.76 pt down the page, past the top of the QR-bill's slip at 544\.25 pt/)
    expect(session.document().page.margins.top).toBe(544.25)
  })
})

describe('the payment part’s band', () => {
  // Where the slip prints is room the regions do not have on the last
  // page; a design view without it would show a body that fits where the
  // PDF has none. The band is the slip's size, from the spec's one number,
  // across the whole sheet and down to its foot, as the slip ignores the
  // margins.
  test('is drawn across the foot of the sheet, as large as the slip', () => {
    const { editor } = editorOver(billedReport())
    const { paymentPart, sheet } = editor.state().canvas
    expect(sheet.pt.height).toBe(841.89)
    expect(paymentPart?.pt).toEqual({ x: 0, y: 841.89 - QR_BILL_SIZE.height, width: QR_BILL_SIZE.width, height: QR_BILL_SIZE.height })
    expect(paymentPart?.pt.width).toBe(sheet.pt.width)
  })

  // A region drawn under the band would look as if it printed beside the
  // slip. The regions stand above it, the gap a region's label takes
  // between; a body too long for the page makes the sheet longer, and the
  // band stays at its foot, below the last of them.
  test('stands below every region, the sheet growing when they reach it', () => {
    for (const report of [billedReport(), longer(billedReport(), 40)]) {
      const { editor } = editorOver(report)
      const { paymentPart, sheet, regions } = editor.state().canvas
      if (paymentPart === null) throw new Error('no band')
      const lowest = Math.max(...regions.map((region) => region.pt.y + region.pt.height))
      expect(paymentPart.pt.y).toBeGreaterThanOrEqual(lowest + 14 - 0.01)
      expect(paymentPart.pt.y + paymentPart.pt.height).toBeCloseTo(sheet.pt.height, 2)
    }
    const long = editorOver(longer(billedReport(), 40)).editor.state().canvas
    const lowest = Math.max(...long.regions.map((region) => region.pt.y + region.pt.height))
    expect(long.sheet.pt.height).toBeGreaterThan(841.89)
    expect(long.paymentPart?.pt.y).toBeCloseTo(lowest + 14, 2)
  })

  // A report without a bill has no slip to show, and its sheet is what it
  // was: the page, or the regions and the bottom margin when they run past.
  test('is not drawn for a report without a payment part, whose sheet stays as it was', () => {
    for (const report of [richReport(), longer(richReport(), 40)]) {
      const { paymentPart, sheet, regions } = editorOver(report).editor.state().canvas
      expect(paymentPart).toBeNull()
      const lowest = Math.max(...regions.map((region) => region.pt.y + region.pt.height))
      expect(sheet.pt.height).toBeCloseTo(Math.max(841.89, lowest + report.page.margins.bottom), 2)
    }
  })

  // Drawn in pixels at the zoom by the same conversion as every box, so
  // the band and the rulers agree.
  test('scales with the zoom', () => {
    const { editor } = editorOver(billedReport(), { zoom: 1.5 })
    const { paymentPart, scale } = editor.state().canvas
    expect(scale).toBeCloseTo(1.5 * PX_PER_PT, 12)
    expect(paymentPart?.px.y).toBeCloseTo((paymentPart?.pt.y ?? 0) * scale, 1)
    expect(paymentPart?.px.height).toBeCloseTo(QR_BILL_SIZE.height * scale, 1)
  })

  // The band is named as SIX names the part, in the editor's language: its
  // name is what a screen reader says, and its label what is drawn.
  test('is named in the editor’s language', () => {
    const names = EDITOR_LOCALES.map((locale) => editorOver(billedReport(), { locale }).editor.state().canvas.paymentPart?.label)
    expect(names).toEqual(['Payment part', 'Zahlteil', 'Section paiement'])
  })

  // The band is what a pointer selects the bill by, as a box is a
  // component's: it says it is selected, and carries the count of the
  // bill's problems and their worst severity, as the bill's outline row
  // does, so the design view marks it as it marks a box.
  test('says it is selected, and how many problems the bill has, as its outline row does', () => {
    const { editor } = editorOver(billedReport())
    expect(editor.state().canvas.paymentPart).toMatchObject({ selected: false, problems: 1, severity: 'warning' })
    ok(editor.dispatch({ type: 'select', part: 'paymentPart' }))
    expect(editor.state().canvas.paymentPart).toMatchObject({ selected: true, problems: 1, severity: 'warning' })
    expect(editor.state().outlineParts).toEqual([{ part: 'paymentPart', key: 'paymentPart', label: 'Payment part', selected: true, problems: 1, severity: 'warning' }])
    expect(editor.state().canvas.boxes.some((box) => box.selected)).toBe(false)
  })
})

describe('the payment part in the outline', () => {
  // A keyboard reaches the bill as it reaches a component: through a row
  // of its own after the regions, since it prints after all of them, at
  // the foot of the last page, named as the band is, in the editor's
  // language. A report with no bill has no such row.
  test('is a row after the regions, named as SIX names the part, in a report that has one', () => {
    const rows = EDITOR_LOCALES.map((locale) => editorOver(billedReport(), { locale }).editor.state().outlineParts.map((row) => row.label))
    expect(rows).toEqual([['Payment part'], ['Zahlteil'], ['Section paiement']])
    expect(editorOver(richReport()).editor.state().outlineParts).toEqual([])
  })

  // Every walk takes the row: the arrows from the last component, End,
  // Home back from it, and the arrow past it, which says it is last.
  test('is walked by every step of the outline, last', () => {
    const { editor } = editorOver(billedReport())
    ok(editor.dispatch({ type: 'selectLast' }))
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
    ok(editor.dispatch({ type: 'selectPrevious' }))
    const before = editor.state().selection
    expect(before !== null && 'id' in before).toBe(true)
    ok(editor.dispatch({ type: 'selectNext' }))
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
    const outcome = editor.dispatch({ type: 'selectNext' })
    expect(outcome).toMatchObject({ ok: false, code: 'at-edge', message: 'Payment part is already last.' })
    ok(editor.dispatch({ type: 'selectFirst' }))
    expect(editor.state().selection).toEqual({ id: 'heading' })
  })

  // The bill stands in no container and holds no row: a step out or in
  // says so, as at a region's top, and changes nothing.
  test('refuses a step out of it or into it, saying why', () => {
    const { editor } = selectedBill()
    expect(editor.dispatch({ type: 'selectParent' })).toMatchObject({ ok: false, code: 'at-edge', message: 'Payment part is not inside a container.' })
    expect(editor.dispatch({ type: 'selectChild' })).toMatchObject({ ok: false, code: 'at-edge', message: 'Payment part holds nothing.' })
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
  })

  // SIX puts the slip at the foot of the last page, and a report holds one:
  // the toolbar's moves and Duplicate have nowhere to take it, say so when
  // pressed anyway, and change nothing. Delete is the one it takes.
  test('takes no move and no copy, and says why', () => {
    const { editor, session } = selectedBill()
    expect(editor.state().can).toMatchObject({ delete: true, duplicate: false, moveUp: false, moveDown: false, indent: false, outdent: false, moveTo: false })
    const before = session.document()
    for (const type of ['moveUp', 'moveDown', 'indent', 'outdent', 'duplicate'] as const) {
      expect(editor.dispatch({ type }), type).toMatchObject({ ok: false, code: 'at-edge', message: 'Payment part prints at the foot of the last page, where SIX puts it: it is not moved or copied.' })
    }
    expect(session.document()).toBe(before)
  })

  // A selection the report no longer has is let go of, as a deleted
  // component's is: an undo that takes the bill away leaves nothing
  // selected, never a selection of nothing.
  test('lets go of the selection when the bill is gone', () => {
    const { editor } = editorOver(richReport())
    expect(editor.dispatch({ type: 'select', part: 'paymentPart' })).toMatchObject({ ok: false, code: 'not-found' })
    ok(editor.dispatch({ type: 'select', id: null }))
    ok(editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
    ok(editor.dispatch({ type: 'undo' }))
    expect(editor.state().selection).toBeNull()
  })
})

describe('the payment part’s properties', () => {
  // The fields follow the order the code holds the bill's elements (IG
  // Table 8): the account, the creditor, the amount and its currency, the
  // debtor, the reference and the additional information, then the
  // language of the slip's headings, which is not in the code. Each name
  // is unique in the form, so a party's parts say whose they are.
  test('are every term of the bill, in the order the code holds them, under the bill’s heading', () => {
    const { editor } = selectedBill()
    const { properties } = editor.state()
    expect(properties.heading).toBe('QR-bill: Payment part')
    expect(properties.fields.map((each) => [each.key, each.label, each.kind])).toEqual([
      ['/account/0/text', 'IBAN', 'text'],
      ['/creditor/name/0/text', 'Creditor’s name', 'text'],
      ['/creditor/street', 'Creditor’s street', 'text'],
      ['/creditor/buildingNumber', 'Creditor’s building number', 'text'],
      ['/creditor/postalCode/0/text', 'Creditor’s postal code', 'text'],
      ['/creditor/town/0/text', 'Creditor’s town', 'text'],
      ['/creditor/country/0/text', 'Creditor’s country', 'text'],
      ['/amount', 'Amount', 'expression'],
      ['/currency', 'Currency', 'select'],
      ['/debtor/name/0', 'Debtor’s name', 'binding'],
      ['/debtor/street', 'Debtor’s street', 'text'],
      ['/debtor/buildingNumber', 'Debtor’s building number', 'text'],
      ['/debtor/postalCode/0/text', 'Debtor’s postal code', 'text'],
      ['/debtor/town/0/text', 'Debtor’s town', 'text'],
      ['/debtor/country/0/text', 'Debtor’s country', 'text'],
      ['/reference', 'Reference', 'text'],
      ['/message', 'Message', 'text'],
      ['/billingInformation', 'Billing information', 'text'],
      ['/language', 'Language of the headings', 'select'],
    ])
    const bill = billOf(billedReport())
    expect(field(editor.state(), 'IBAN').value).toBe('CH44 3199 9123 0008 8901 2')
    expect(field(editor.state(), 'Creditor’s street').value).toBe('Musterstrasse')
    expect(field(editor.state(), 'Amount').value).toBe(bill.amount?.cel)
    expect(field(editor.state(), 'Reference').value).toBe('21 00000 00003 13947 14300 09017')
  })

  // A term of the bill with no field is one a person can never change in
  // the builders; the fields come from a table over every term, which does
  // not compile while one lacks its fields, and every term has a field
  // here whether the bill holds it or not.
  test('reach every term of a bill, held or not', () => {
    const { editor } = selectedBill()
    ok(editor.dispatch({ type: 'removeGroup', key: '/debtor' }))
    const keys = editor.state().properties.fields.map((each) => each.key)
    const groupKeys = editor.state().properties.rows.flatMap((row) => ('group' in row ? [row.group.key] : []))
    const terms = Object.keys({ ...billOf(billedReport()), debtor: null, billingInformation: null }).filter((term) => term !== 'kind')
    for (const term of terms) expect([...keys, ...groupKeys].some((key) => key === `/${term}` || key.startsWith(`/${term}/`)), term).toBe(true)
  })

  // The creditor and the debtor are drawn as groups, each named after its
  // party; the debtor, which a bill may leave out, has a button to take it
  // away. Named in the editor's words in each language.
  test('draw each party as a group named after it, the debtor with its Remove', () => {
    for (const [locale, creditor, debtor, remove] of [
      ['en', 'Creditor', 'Debtor', 'Remove debtor'],
      ['de-CH', 'Zahlungsempfänger', 'Zahlungspflichtiger', 'Zahlungspflichtigen entfernen'],
      ['fr-CH', 'Créancier', 'Débiteur', 'Retirer le débiteur'],
    ] as const) {
      const shown = groups(selectedBill(locale).editor.state())
      expect([...shown.keys()], locale).toEqual([creditor, debtor])
      expect(shown.get(creditor)?.action, locale).toBeUndefined()
      expect(shown.get(creditor)?.fields.length, locale).toBe(6)
      expect(shown.get(debtor)?.action, locale).toEqual({ label: remove, action: { type: 'removeGroup', key: '/debtor' } })
    }
  })

  // Every text of the bill is edited where it is written, through one
  // command, as one undo step named after its field; undo takes the bill
  // back to the very object it was.
  test('change the bill one field at a time, each one undo step named after its field', () => {
    const { editor, session } = selectedBill()
    const before = session.document().paymentPart
    for (const [label, value, read] of [
      ['IBAN', 'CH64 3196 1000 0044 2155 7', (bill: SwissQrBill) => bill.account],
      ['Creditor’s name', 'Muster Haustechnik AG', (bill: SwissQrBill) => bill.creditor.name],
      ['Creditor’s town', 'Zürich', (bill: SwissQrBill) => bill.creditor.town],
      ['Message', 'Order 4711', (bill: SwissQrBill) => bill.message],
      ['Billing information', '//S1/10/4711', (bill: SwissQrBill) => bill.billingInformation],
    ] as const) {
      ok(editor.dispatch({ type: 'setProperty', key: field(editor.state(), label).key, value }))
      expect(read(billOf(session.document())), label).toEqual([{ kind: 'text', text: value }])
      expect(editor.state().history.undoLabel, label).toBe(`Change ${label}`)
      expect(editor.state().status.text, label).toBe(`Changed ${label}.`)
    }
    ok(editor.dispatch({ type: 'setProperty', key: '/amount', value: 'dec("10.00")' }))
    expect(billOf(session.document()).amount).toEqual({ cel: 'dec("10.00")' })
    ok(editor.dispatch({ type: 'setProperty', key: '/language', value: 'fr' }))
    expect(billOf(session.document()).language).toBe('fr')
    for (let step = 0; step < 7; step += 1) ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().paymentPart).toBe(before)
  })

  // An IBAN whose check digits are wrong is the commonest mistake there is
  // in a payment target. report-spec refuses it where it is typed, in its
  // words on the field, and the bill pays the account it did: a refused
  // edit changes nothing (0008).
  test('refuse an IBAN SIX’s rules refuse, on its field, in the validator’s words, the bill unchanged', () => {
    const { editor, session } = selectedBill()
    const before = session.document()
    const outcome = editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH44 3199 9123 0008 8901 3' })
    expect(outcome).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state(), 'IBAN')).toMatchObject({ value: 'CH44 3199 9123 0008 8901 3', error: expect.stringMatching(/check digits/) as string })
    expect(session.document()).toBe(before)
  })

  // A bill printed with an e-invoice pays the e-invoice's account (BT-84),
  // so its IBAN changed alone names two accounts for one invoice. The
  // validator refuses it, and the field says so in its words; changing
  // both at once is a later command's (0039 leaves it to the e-invoice's
  // editing).
  test('refuse an IBAN apart from the e-invoice’s account, on its field', () => {
    const { editor, session } = editorOver(invoicedBill())
    ok(editor.dispatch({ type: 'select', part: 'paymentPart' }))
    const before = session.document()
    expect(editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH52 0483 5012 3456 7100 0' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(editor.state(), 'IBAN').error).toMatch(/another account than the e-invoice's payment account \(BT-84\)/)
    expect(session.document()).toBe(before)
  })

  // SIX ties the account's kind to the reference: a QR-IBAN is paid to
  // with a QR reference and nothing else, and a QR reference only to a
  // QR-IBAN (IG Table 8, Tp). Each edit is validated whole, so an IBAN of
  // the other kind typed alone would be refused whichever field came
  // first, and a bill added from nothing, an IBAN with no reference,
  // could never pay a QR-IBAN. So the IBAN's edit takes the reference
  // with it, in one step named after the IBAN, and says so: a QR-IBAN
  // typed over a bill with no QR reference brings SIX's example QR
  // reference, warned of until it is the creditor's own; an IBAN typed
  // over a QR reference takes it away. Undo gives back both at once.
  test('take the reference with an IBAN of the other kind, in one step, and say so', () => {
    const { editor, session } = editorOver(richReport())
    ok(editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
    const added = session.document()
    ok(editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH58 3000 0000 0000 0000 0' }))
    expect(billOf(session.document())).toMatchObject({ account: said('CH58 3000 0000 0000 0000 0'), reference: said(QR_BILL_EXAMPLE.reference) })
    expect(field(editor.state(), 'Reference')).toEqual(expect.objectContaining({ value: '00 00082 07791 22585 74212 86694' }))
    expect(field(editor.state(), 'Reference')).not.toHaveProperty('error')
    expect(editor.state().history.undoLabel).toBe('Change IBAN')
    expect(editor.state().status.text).toBe('Changed IBAN. A QR-IBAN is paid to with a QR reference, so the reference is SIX’s example until you give the creditor’s own.')
    expect(editor.state().diagnostics.map((entry) => entry.message)).toEqual([expect.stringMatching(/^the payment part's creditor and reference are SIX's examples/)])
    ok(editor.dispatch({ type: 'setProperty', key: '/reference', value: '21 00000 00003 13947 14300 09017' }))
    const own = session.document()
    ok(editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH93 0076 2011 6238 5295 7' }))
    expect(billOf(session.document()).account).toEqual(said('CH93 0076 2011 6238 5295 7'))
    expect(billOf(session.document())).not.toHaveProperty('reference')
    expect(editor.state().status.text).toBe('Changed IBAN. An IBAN is never paid to with a QR reference, so the reference was taken away.')
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document()).toBe(own)
    ok(editor.dispatch({ type: 'undo' }))
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document()).toBe(added)
  })

  // What the IBAN's edit leaves of the reference it does not have to
  // change: an IBAN of the same kind keeps it; a reference computed, as
  // one read from the data is, or an account computed, is the render's to
  // judge, and the reference stays as it was. A QR-IBAN in
  // a bill in euro is refused even with a QR reference given it -- both
  // are for francs alone -- on the IBAN's field, in the validator's words,
  // the report unchanged.
  test('leave the reference where the IBAN does not change its kind or the data gives it, and refuse a QR-IBAN in euro', () => {
    const kept = selectedBill()
    const reference = billOf(kept.session.document()).reference
    ok(kept.editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH58 3000 0000 0000 0000 0' }))
    expect(billOf(kept.session.document()).reference).toBe(reference)
    expect(kept.editor.state().status.text).toBe('Changed IBAN.')
    const bound = { ...billedReport(), paymentPart: { ...billOf(billedReport()), reference: [{ kind: 'expression', expression: { cel: '"RF18 5390 0754 7034"' } }] } } as ReportDefinition
    const data = editorOver(bound)
    ok(data.editor.dispatch({ type: 'select', part: 'paymentPart' }))
    const read = billOf(data.session.document()).reference
    ok(data.editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH93 0076 2011 6238 5295 7' }))
    expect(billOf(data.session.document()).reference).toBe(read)
    const reckoned = { ...billedReport(), paymentPart: { ...billOf(billedReport()), account: [{ kind: 'expression', expression: { cel: '"CH44 3199 9123 0008 8901 2"' } }] } } as ReportDefinition
    const computed = editorOver(reckoned)
    ok(computed.editor.dispatch({ type: 'select', part: 'paymentPart' }))
    const its = billOf(computed.session.document()).reference
    ok(computed.editor.dispatch({ type: 'setProperty', key: field(computed.editor.state(), 'IBAN').key, value: '"CH93 0076 2011 6238 5295 7"' }))
    expect(billOf(computed.session.document()).account).toEqual([{ kind: 'expression', expression: { cel: '"CH93 0076 2011 6238 5295 7"' } }])
    expect(billOf(computed.session.document()).reference).toBe(its)
    const euro = editorOver({ ...richReport(), locale: 'en-CH' })
    ok(euro.editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
    ok(euro.editor.dispatch({ type: 'setProperty', key: '/currency', value: 'EUR' }))
    const before = euro.session.document()
    expect(euro.editor.dispatch({ type: 'setProperty', key: '/account/0/text', value: 'CH58 3000 0000 0000 0000 0' })).toMatchObject({ ok: false, code: 'refused' })
    expect(field(euro.editor.state(), 'IBAN').error).toMatch(/^a QR-IBAN and a QR reference are for invoices in CHF only/)
    expect(euro.session.document()).toBe(before)
  })

  // The debtor is optional: Remove takes it away in one step, and the
  // group stays, holding the Add that puts SIX's example debtor back,
  // in one step, both named in the history.
  test('remove the debtor and add one back, one undo step each', () => {
    const { editor, session } = selectedBill()
    ok(editor.dispatch({ type: 'removeGroup', key: '/debtor' }))
    expect(billOf(session.document()).debtor).toBeUndefined()
    expect(editor.state().history.undoLabel).toBe('Remove debtor')
    expect(editor.state().status.text).toBe('Removed Debtor.')
    expect(groups(editor.state()).get('Debtor')).toEqual({ key: '/debtor', label: 'Debtor', fields: [], action: { label: 'Add debtor', action: { type: 'addGroup', key: '/debtor' } } })
    ok(editor.dispatch({ type: 'addGroup', key: '/debtor' }))
    expect(billOf(session.document()).debtor).toEqual({
      name: [{ kind: 'text', text: 'Simon Muster' }],
      street: [{ kind: 'text', text: 'Musterstrasse' }],
      buildingNumber: [{ kind: 'text', text: '1' }],
      postalCode: [{ kind: 'text', text: '8000' }],
      town: [{ kind: 'text', text: 'Seldwyla' }],
      country: [{ kind: 'text', text: 'CH' }],
    })
    expect(editor.state().history.undoLabel).toBe('Add debtor')
    ok(editor.dispatch({ type: 'undo' }))
    ok(editor.dispatch({ type: 'undo' }))
    expect(billOf(session.document()).debtor).toEqual(billOf(billedReport()).debtor)
  })

  // A group's button sent when it has nothing to do -- an Add while the
  // debtor is there, a Remove while it is not, a group the panel does not
  // have -- says so and changes nothing.
  test('refuse a group’s button with nothing to do', () => {
    const { editor, session } = selectedBill()
    const before = session.document()
    expect(editor.dispatch({ type: 'addGroup', key: '/debtor' })).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.dispatch({ type: 'addGroup', key: '/creditor' })).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.dispatch({ type: 'removeGroup', key: '/nowhere' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(session.document()).toBe(before)
    ok(editor.dispatch({ type: 'removeGroup', key: '/debtor' }))
    const removed = session.document()
    expect(editor.dispatch({ type: 'removeGroup', key: '/debtor' })).toMatchObject({ ok: false, code: 'unavailable', message: 'Debtor is not there.' })
    expect(session.document()).toBe(removed)
  })

  // Each of SIX's five languages is offered for the headings, by its name
  // in the editor's language, as the language itself names none here.
  test('offer SIX’s five languages for the headings, named in the editor’s language', () => {
    const options = (locale: (typeof EDITOR_LOCALES)[number]) => field(selectedBill(locale).editor.state(), editorText(locale)('field.qrBillLanguage')).options?.map((option) => `${option.value} ${option.label}`)
    expect(options('en')).toEqual(['de German', 'fr French', 'it Italian', 'en English', 'rm Romansh'])
    expect(options('de-CH')).toEqual(['de Deutsch', 'fr Französisch', 'it Italienisch', 'en Englisch', 'rm Rätoromanisch'])
  })
})

describe('a QR-bill added from nothing', () => {
  // A report without a bill offers one from its own properties, and a bill
  // needs every required text: one added blank would be refused. So it is
  // SIX's third example (IG 2.4, Annex A, Table 19) -- an IBAN, a
  // creditor, no amount, debtor or reference -- its headings in the
  // report's language where SIX prints in it, and the warning that its
  // account and its creditor are SIX's stays listed, linked to the bill,
  // until they are replaced (INV-Q9). The warning is the bill's and not
  // the IBAN's field's: a field's one error is drawn as invalid, and the
  // example's IBAN is a valid one.
  test('is SIX’s example, selected, its example values warned of but not on the IBAN, in one undo step', () => {
    const { editor, session } = editorOver(richReport())
    const before = session.document()
    expect(groups(editor.state()).get('Payment part')).toEqual({ key: '/paymentPart', label: 'Payment part', fields: [], action: { label: 'Add QR-bill', action: { type: 'addPart', part: 'paymentPart' } } })
    ok(editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
    expect(billOf(session.document())).toEqual({
      kind: 'swissQrBill',
      language: 'de',
      account: [{ kind: 'text', text: 'CH52 0483 5012 3456 7100 0' }],
      creditor: {
        name: [{ kind: 'text', text: 'Muster Stiftung (sample foundation)' }],
        street: [{ kind: 'text', text: 'P.O. box' }],
        postalCode: [{ kind: 'text', text: '3001' }],
        town: [{ kind: 'text', text: 'Bern' }],
        country: [{ kind: 'text', text: 'CH' }],
      },
      currency: 'CHF',
    })
    expect(QR_BILL_EXAMPLE_ACCOUNTS).toContain('CH5204835012345671000')
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
    expect(editor.state().status.text).toBe('Added a QR-bill with SIX’s example values. Give the creditor’s own account and address before it is sent.')
    expect(editor.state().diagnostics.map((entry) => [entry.code, entry.severity, entry.label, entry.target])).toEqual([['example-payment-part', 'warning', 'Warning: Payment part', { part: 'paymentPart' }]])
    expect(editor.state().diagnostics[0]?.message).toMatch(/^the payment part's account and creditor are SIX's examples/)
    expect(field(editor.state(), 'IBAN')).not.toHaveProperty('error')
    expect(field(editor.state(), 'Creditor’s name')).not.toHaveProperty('error')
    expect(editor.state().history.undoLabel).toBe('Add QR-bill')
    expect(groups(editor.state()).has('Payment part')).toBe(false)
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document()).toBe(before)
  })

  // The slip's headings are in one of SIX's five languages: the report's
  // own where it is one, English, the example's, where it is not.
  test('prints its headings in the report’s language where SIX does, else in English', () => {
    for (const [locale, language] of [
      ['fr-CH', 'fr'],
      ['it-CH', 'it'],
      ['en-GB', 'en'],
      ['nl-NL', 'en'],
    ] as const) {
      const { editor, session } = editorOver({ ...richReport(), locale })
      ok(editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
      expect(billOf(session.document()).language, locale).toBe(language)
    }
  })

  // The bill takes the page SIX prints it on, and in a report that is an
  // e-invoice it is in the e-invoice's currency to its account: on a
  // Letter page, a landscape one and an e-invoice in euro the add is
  // refused in report-spec's words, and a second add has nothing to do.
  // None changes the report.
  test('is refused where the report cannot take it, and refused again once there is one', () => {
    for (const [report, words] of [
      [{ ...richReport(), page: { ...richReport().page, size: 'Letter' } }, /^The QR-bill was not added: a QR-bill is printed across the foot of an A4 page in portrait, and this page is Letter in portrait/],
      [{ ...richReport(), page: { ...richReport().page, orientation: 'landscape' } }, /^The QR-bill was not added: a QR-bill is printed across the foot of an A4 page in portrait, and this page is A4 in landscape/],
      [eInvoiceReport(), /^The QR-bill was not added: .*the e-invoice's currency, EUR \(BT-5\)/],
    ] as const) {
      const { editor, session } = editorOver(report)
      const before = session.document()
      expect(editor.dispatch({ type: 'addPart', part: 'paymentPart' }), String(words)).toMatchObject({ ok: false, code: 'refused' })
      expect(editor.state().status.text).toMatch(words)
      expect(session.document()).toBe(before)
    }
    const { editor } = editorOver(billedReport())
    expect(editor.dispatch({ type: 'addPart', part: 'paymentPart' })).toMatchObject({ ok: false, code: 'unavailable', message: 'The report has a QR-bill already.' })
  })
})

describe('a QR-bill removed', () => {
  // Delete takes the bill away as it takes a component, in one undo step
  // named for it, and the keyboard goes to the row before it; undo gives
  // back the very bill.
  test('goes in one undo step, the row before it selected, and comes back whole', () => {
    const { editor, session } = selectedBill()
    const bill = session.document().paymentPart
    ok(editor.dispatch({ type: 'delete' }))
    expect(session.document()).not.toHaveProperty('paymentPart')
    expect(editor.state().history.undoLabel).toBe('Remove QR-bill')
    expect(editor.state().status.text).toBe('Deleted the QR-bill.')
    expect(editor.state().selection).toEqual({ id: 'order-code' })
    expect(editor.state().canvas.paymentPart).toBeNull()
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().paymentPart).toBe(bill)
  })

  // A report whose bill is its only row has nothing before it: deleted,
  // nothing is selected, and the keyboard goes to the tree, as an undo of
  // an insert leaves it.
  test('leaves nothing selected where it was the outline’s only row', () => {
    const { editor, session } = editorOver(emptyReport('slip', 'Slip', 'de-CH'))
    ok(editor.dispatch({ type: 'addPart', part: 'paymentPart' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(session.document().paymentPart).toBeUndefined()
    expect(editor.state().selection).toBeNull()
  })
})

describe('the payment part’s diagnostics', () => {
  // A diagnostic about the bill names no component -- the bill stands in
  // none -- so it was the report's, with no row to go to. It is the bill's
  // now: listed as the payment part's, counted on its row and its band,
  // and following it selects the bill.
  test('are the bill’s, listed as the payment part’s, and selecting one selects it', () => {
    const { editor } = editorOver(billedReport(), { locale: 'de-CH' })
    const [entry] = editor.state().diagnostics
    expect(entry).toMatchObject({ code: 'example-payment-part', where: 'Zahlteil', label: 'Warnung: Zahlteil', target: { part: 'paymentPart' } })
    expect(editor.state().outlineParts[0]).toMatchObject({ problems: 1, severity: 'warning' })
    ok(editor.dispatch({ type: 'select', ...(entry?.target as { readonly part: 'paymentPart' }) }))
    expect(editor.state().selection).toEqual({ part: 'paymentPart' })
  })

  // An expression of the bill that does not compile is an error on its
  // field, as one in a component's is: the amount's diagnostic reaches the
  // Amount field.
  test('reach the field they are about', () => {
    const { editor } = selectedBill()
    ok(editor.dispatch({ type: 'setProperty', key: '/amount', value: 'totals.nowhere' }))
    expect(field(editor.state(), 'Amount').error).toMatch(/nowhere/)
    expect(editor.state().diagnostics.find((entry) => entry.code === 'expression-unknown-name')?.target).toEqual({ part: 'paymentPart' })
  })
})
