import { validateReport } from '@formancy/report-spec'
import type { EInvoice, FacturXInvoice, Inline, ReportDefinition, XRechnungInvoice } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { EditorState } from './model.js'
import type { EditorOutcome } from './model-actions.js'
import { invoicedScenarioReport, xrechnungScenarioReport } from './scenario-e-invoice.js'
import { EDITOR_LOCALES } from './text.js'
import { editorOver } from './test-support.js'

/**
 * An e-invoice's fields (0044): every term it holds, of either kind, is
 * reached by a field or a group, whether the invoice holds it or not, and
 * every name in the form is unique, in every language the editor speaks.
 * That a term added to the format without its field does not compile is
 * tsc's to hold: `invoice-fields.ts` is a table over every term.
 */

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

/** `report` with `invoice` for its e-invoice, checked valid. */
function withInvoice(report: ReportDefinition, invoice: EInvoice): ReportDefinition {
  const copy = { ...report, eInvoice: invoice }
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`not valid: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return copy
}

/** The scenario's Factur-X invoice with every term EN 16931 lets it hold given: each party whole, a period, the payment instructions whole, an exempt category with its reason. */
function fullFacturX(): ReportDefinition {
  const report = invoicedScenarioReport()
  const invoice = report.eInvoice as FacturXInvoice
  const full: FacturXInvoice = {
    ...invoice,
    businessProcess: said('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    buyerReference: said('PO-4711'),
    seller: {
      ...invoice.seller,
      taxNumber: said('215/5823/0416'),
      legalId: { id: said('HRB 12345'), scheme: '0060' },
      electronicAddress: { id: said('rechnung@muster.example'), scheme: 'EM' },
      contact: { name: said('Erika Mustermann'), telephone: said('+49 221 4710 820'), email: said('e.mustermann@muster.example') },
      address: { ...invoice.seller.address, line2: said('Hof 2') },
    },
    buyer: {
      ...invoice.buyer,
      vatId: said('ATU12345678'),
      legalId: { id: said('4012345000009'), scheme: '0088' },
      electronicAddress: { id: said('4012345000009'), scheme: '0088' },
      address: { ...invoice.buyer.address, line2: said('Stiege 3') },
    },
    period: { start: { cel: '"2026-10-01"' }, end: { cel: '"2026-10-20"' } },
    vat: [...invoice.vat, { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei nach § 4 Nr. 8 Buchst. a UStG') }],
    payment: { ...(invoice.payment as NonNullable<FacturXInvoice['payment']>), accountName: said('Muster Haustechnik GmbH'), remittance: said('RE-2026-0901') },
    due: { cel: '"2026-11-05"' },
    terms: said('Zahlbar binnen 14 Tagen'),
    paid: { cel: 'dec("0.00")' },
  }
  return withInvoice(report, full)
}

/** The scenario's XRechnung with every optional term given too. */
function fullXRechnung(): ReportDefinition {
  const report = xrechnungScenarioReport()
  const full = fullFacturX().eInvoice as FacturXInvoice
  const invoice = report.eInvoice as XRechnungInvoice
  const { kind: _kind, profile: _profile, ...terms } = full
  return withInvoice(report, {
    ...terms,
    kind: 'xrechnung',
    version: invoice.version,
    businessProcess: invoice.businessProcess,
    buyerReference: invoice.buyerReference,
    seller: { ...terms.seller, electronicAddress: invoice.seller.electronicAddress, contact: invoice.seller.contact },
    buyer: { ...terms.buyer, electronicAddress: invoice.buyer.electronicAddress },
    payment: invoice.payment,
  })
}

/** The scenario's Factur-X invoice with every term it may leave out left out, and no payment code to need an account. */
function bareFacturX(): ReportDefinition {
  const { paymentPart: _bill, ...report } = invoicedScenarioReport()
  const invoice = report.eInvoice as FacturXInvoice
  const bare: FacturXInvoice = {
    kind: 'facturX',
    profile: invoice.profile,
    type: invoice.type,
    currency: invoice.currency,
    number: invoice.number,
    issued: invoice.issued,
    seller: {
      name: invoice.seller.name,
      vatId: said('DE 123 456 789'),
      address: {
        line1: invoice.seller.address.line1,
        postalCode: invoice.seller.address.postalCode,
        city: invoice.seller.address.city,
        country: invoice.seller.address.country,
      },
    },
    buyer: { name: invoice.buyer.name, address: invoice.buyer.address },
    delivered: invoice.delivered as NonNullable<FacturXInvoice['delivered']>,
    vat: invoice.vat,
    lines: invoice.lines,
  }
  return withInvoice({ ...report, regions: { ...report.regions, summary: report.regions.summary.filter((component) => component.kind !== 'epcQrCode') } }, bare)
}

/** Whether `value` is a text's runs: a list of inline runs. */
function isRuns(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((run: unknown) => typeof run === 'object' && run !== null && 'kind' in run)
}

/**
 * Every term an invoice holds, by its pointer under the e-invoice: a
 * text's runs, an expression, a value read from each row, and every code
 * or identifier written as it is -- each what one field edits -- and none
 * of the kind, which never changes in place.
 */
function terms(value: unknown, at = ''): string[] {
  if (typeof value !== 'object' || value === null || isRuns(value)) return [at]
  if ('cel' in value) return [at]
  if ('kind' in value && ('field' in value || 'expression' in value)) return [at]
  return Object.entries(value).flatMap(([key, inner]) => (at === '' && key === 'kind' ? [] : terms(inner, `${at}/${key}`)))
}

/** The pointers the selected e-invoice's panel edits: each field's, and each group's. */
function reached(state: EditorState): { readonly fields: readonly string[]; readonly groups: readonly string[] } {
  return { fields: state.properties.fields.map((field) => field.key), groups: state.properties.rows.flatMap((row) => ('group' in row ? [row.group.key] : [])) }
}

/** The e-invoice of `report` selected, in `locale`. */
function selected(report: ReportDefinition, locale: (typeof EDITOR_LOCALES)[number] = 'en'): EditorState {
  const { editor } = editorOver(report, { locale })
  ok(editor.dispatch({ type: 'select', part: 'eInvoice' }))
  return editor.state()
}

describe('an e-invoice’s fields', () => {
  // A term with no field is one a person can see in the XML and never
  // change: every term a whole invoice of either kind holds is edited by
  // a field at it or below it, a text run by run.
  test.each([
    ['a Factur-X invoice', fullFacturX],
    ['an XRechnung', fullXRechnung],
  ])('reach every term %s holds', (_kind, report) => {
    const invoice = report().eInvoice
    const { fields } = reached(selected(report()))
    const missing = terms(invoice).filter((term) => !fields.some((key) => key === term || key.startsWith(`${term}/`)))
    expect(missing).toEqual([])
  })

  // And a term an invoice leaves out is one a person can give: each is
  // reached by a field or a group at it, by the group or the field that
  // puts in the part that holds it -- an optional group's Add, a part's
  // identifier, a period's start or end -- whether the invoice holds it or
  // not.
  test('reach every term a Factur-X invoice may leave out, where it leaves it out', () => {
    const all = terms(fullFacturX().eInvoice)
    const { fields, groups } = reached(selected(bareFacturX()))
    const parent = (term: string): string => term.slice(0, term.lastIndexOf('/'))
    const missing = all.filter(
      (term) =>
        !fields.some((key) => key === term || key.startsWith(`${term}/`) || key === `${parent(term)}/id`) &&
        !groups.some((key) => key === term || term.startsWith(`${key}/`)),
    )
    expect(missing).toEqual([])
  })

  // Tests and assistive technology find a field, a group and a button by
  // its name alone: two that read alike -- the seller's city and the
  // buyer's, two categories' rates -- could not be told apart, in any of
  // the editor's languages.
  test.each(EDITOR_LOCALES)('name every field, group and button once, in %s', (locale) => {
    for (const report of [fullFacturX(), fullXRechnung(), bareFacturX(), invoicedScenarioReport()]) {
      const state = selected(report, locale)
      const names = [
        ...state.properties.fields.map((field) => field.label),
        ...state.properties.rows.flatMap((row) => ('group' in row ? [row.group.label, ...row.group.actions.map((action) => action.label)] : [])),
      ]
      const repeated = names.filter((name, at) => names.indexOf(name) !== at)
      expect(repeated, report.eInvoice?.kind).toEqual([])
      expect(names.join(' | '), report.eInvoice?.kind).not.toMatch(/\{\w+\}/)
    }
  })

  // The groups a person meets, in order: an XRechnung's own terms first,
  // then the parties, the seller's contact after the seller, each VAT
  // category and the list's Add, the lines and the payment instructions;
  // a Factur-X invoice's contact and payment instructions optional, an
  // XRechnung's part of it.
  test('stand in groups, each with the buttons its kind allows', () => {
    const groupsOf = (state: EditorState) =>
      state.properties.rows.flatMap((row) => ('group' in row ? [[row.group.label, row.group.actions.map((action) => action.label)] as const] : []))
    expect(groupsOf(selected(invoicedScenarioReport()))).toEqual([
      ['Seller', []],
      ['Seller’s contact', ['Add contact']],
      ['Buyer', []],
      ['VAT category 1', ['Move VAT category 1 up', 'Move VAT category 1 down', 'Remove VAT category 1']],
      ['VAT category 2', ['Move VAT category 2 up', 'Move VAT category 2 down', 'Remove VAT category 2']],
      ['VAT categories', ['Add VAT category']],
      ['Lines', []],
      ['Payment instructions', ['Remove payment instructions']],
    ])
    expect(groupsOf(selected(xrechnungScenarioReport())).map(([name, actions]) => `${name}: ${actions.length}`)).toEqual([
      'XRechnung: 0',
      'Seller: 0',
      'Seller’s contact: 0',
      'Buyer: 0',
      'VAT category 1: 3',
      'VAT category 2: 3',
      'VAT categories: 1',
      'Lines: 0',
      'Payment instructions: 0',
    ])
    expect(selected(xrechnungScenarioReport()).properties.rows[0]).toMatchObject({
      group: { fields: [{ label: 'Version' }, { label: 'Buyer’s reference' }, { label: 'Business process' }] },
    })
  })

  // A move with nowhere to go is drawn unavailable and still sent, as a
  // tool is; each item's buttons say where the keyboard goes once done.
  test('mark the first category’s Move up and the last one’s Move down unavailable, and say where the keyboard goes', () => {
    const rows = selected(invoicedScenarioReport()).properties.rows.flatMap((row) => ('group' in row ? [row.group] : []))
    const [first, second, list] = rows.filter((group) => group.key.startsWith('/vat'))
    expect(first?.actions.map((action) => [action.available, action.then])).toEqual([
      [false, undefined],
      [true, { group: '/vat/1', button: 1 }],
      [true, { group: '/vat', button: 0 }],
    ])
    expect(second?.actions.map((action) => action.available)).toEqual([true, false, true])
    expect(list?.actions).toEqual([{ label: 'Add VAT category', action: { type: 'addItem', key: '/vat' }, available: true, then: { group: '/vat/2' } }])
  })
})
