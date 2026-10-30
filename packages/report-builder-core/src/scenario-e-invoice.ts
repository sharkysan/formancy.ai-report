/**
 * The builder scenarios about a report's e-invoice, selected and edited as
 * a component is (0044): reached from its outline row, its buyer and a VAT
 * rate typed where they are written and a rate refused there when EN
 * 16931's rules refuse it, its VAT categories added, moved and removed one
 * step each, the account it shares with its QR-bill and its EPC payment
 * code changed from either code and kept agreeing, deleted and brought
 * back; and an XRechnung's Leitweg-ID and buyer's reference refused in
 * report-spec's words.
 */
import { validateReport } from '@formancy/report-spec'
import type { EpcQrCodeComponent, FacturXInvoice, Inline, ReportDefinition, XRechnungInvoice } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import { scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]
const line = (field: string) => ({ dataset: 'detail', field }) as const
const euro = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } as const
/** A run that prints what `cel` gives, in euro. */
const total = (cel: string): Inline => ({ kind: 'expression', expression: { cel }, format: euro })

/** The account the scenario's e-invoice, its QR-bill and its EPC payment code pay at first: one of Switzerland, which a bill can pay, its check digits right. */
export const SCENARIO_ACCOUNT = 'CH93 0076 2011 6238 5295 7'

/** The scenario's EPC payment code: it pays the e-invoice's account, with a Swiss bank's BIC, as an account outside the EEA needs, and asks for the amount due. */
const CODE: EpcQrCodeComponent = {
  id: 'pay-code',
  kind: 'epcQrCode',
  size: 90.71,
  beneficiary: said('Muster Haustechnik GmbH'),
  iban: said(SCENARIO_ACCOUNT),
  bic: said('POFICHBEXXX'),
  amount: { cel: 'invoice.duePayable' },
}

/** The scenario's e-invoice: the site visit invoiced, at 19 % and at 7 %, paid by SEPA credit transfer to the account its codes pay. */
const INVOICE: FacturXInvoice = {
  kind: 'facturX',
  profile: 'en16931',
  type: '380',
  currency: 'EUR',
  number: said('RE-2026-0901'),
  issued: { cel: '"2026-10-22"' },
  seller: {
    name: said('Muster Haustechnik GmbH'),
    vatId: said('DE 123 456 789'),
    address: { line1: said('Industriestraße 7'), postalCode: said('50735'), city: said('Köln'), country: said('DE') },
  },
  buyer: { name: said('Kunde AG'), address: { line1: said('Ring 1'), postalCode: said('1010'), city: said('Wien'), country: said('AT') } },
  delivered: { cel: '"2026-10-20"' },
  vat: [
    { id: 'standard', code: 'S', rate: '19' },
    { id: 'reduced', code: 'S', rate: '7' },
  ],
  lines: {
    table: 'lines',
    name: 'name',
    quantity: 'quantity',
    netPrice: 'price',
    netAmount: 'amount',
    id: { kind: 'field', field: line('position') },
    unit: { kind: 'expression', expression: { cel: '"HUR"' } },
    vat: { kind: 'expression', expression: { cel: '"standard"' } },
  },
  payment: { means: '58', iban: said(SCENARIO_ACCOUNT), bic: said('POFICHBEXXX') },
}

/**
 * The scenario report as an invoice of the site visit: a table of its
 * lines, every total the XML holds printed under it, its EPC payment code,
 * the e-invoice, and a QR-bill in euro to the same account, as one printed
 * with an e-invoice must be (0022, 0027). Checked valid when it is made.
 */
export function invoicedScenarioReport(): ReportDefinition {
  const base = scenarioReport()
  const columns = [
    { id: 'name', header: 'Item', width: 'fill', align: 'left', value: { kind: 'field', field: line('name') } },
    { id: 'quantity', header: 'Hours', width: 56.69, align: 'right', value: { kind: 'field', field: line('quantity') } },
    { id: 'price', header: 'Rate', width: 70.87, align: 'right', value: { kind: 'field', field: line('price'), format: euro } },
    { id: 'amount', header: 'Amount', width: 70.87, align: 'right', value: { kind: 'field', field: line('amount'), format: euro } },
  ] as const
  const totals: Inline[] = [
    'invoice.taxBasisTotal',
    'vatBasis.standard',
    'vatAmount.standard',
    'vatBasis.reduced',
    'vatAmount.reduced',
    'invoice.taxTotal',
    'invoice.grandTotal',
    'invoice.duePayable',
  ].map(total)
  const report: ReportDefinition = {
    ...base,
    title: 'Site visit invoice',
    datasets: {
      detail: {
        id: 'visit-lines',
        fields: [
          { id: 'position', type: 'integer', label: 'Position', nullable: false },
          { id: 'name', type: 'string', label: 'Item', nullable: false },
          { id: 'quantity', type: 'decimal', label: 'Hours', nullable: false, scale: 2 },
          { id: 'price', type: 'decimal', label: 'Rate', nullable: false, scale: 2 },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
        ],
      },
    },
    regions: {
      ...base.regions,
      body: [
        ...base.regions.body,
        { id: 'lines', kind: 'table', dataset: 'detail', columns: [...columns], totals: [], emptyText: 'No lines.', repeatHeader: true },
      ],
      summary: [{ id: 'totals', kind: 'text', content: totals }, CODE],
    },
    eInvoice: INVOICE,
    paymentPart: {
      kind: 'swissQrBill',
      language: 'en',
      account: said(SCENARIO_ACCOUNT),
      creditor: {
        name: said('Muster Haustechnik GmbH'),
        street: said('Industriestrasse'),
        buildingNumber: said('7'),
        postalCode: said('3011'),
        town: said('Bern'),
        country: said('CH'),
      },
      currency: 'EUR',
    },
  }
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the invoiced scenario report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return report
}

/**
 * The invoiced scenario report's e-invoice as an XRechnung (0038), without
 * its QR-bill: what XRechnung needs past EN 16931 given, the buyer a
 * public one reached by KoSIT's test Leitweg-ID, `991-33333TEST-33`, as its
 * reference and its electronic address under 0204.
 */
export function xrechnungScenarioReport(): ReportDefinition {
  const { paymentPart: _bill, ...report } = invoicedScenarioReport()
  const { kind: _kind, profile: _profile, ...terms } = INVOICE
  const leitwegId = said('991-33333TEST-33')
  const eInvoice: XRechnungInvoice = {
    ...terms,
    kind: 'xrechnung',
    version: '3.0',
    businessProcess: said('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    buyerReference: leitwegId,
    seller: {
      ...terms.seller,
      electronicAddress: { id: said('rechnung@muster.example'), scheme: 'EM' },
      contact: { name: said('Erika Mustermann'), telephone: said('+49 221 4710 820'), email: said('e.mustermann@muster.example') },
    },
    buyer: { ...terms.buyer, electronicAddress: { id: leitwegId, scheme: '0204' } },
    payment: INVOICE.payment as NonNullable<FacturXInvoice['payment']>,
  }
  const copy: ReportDefinition = { ...report, eInvoice }
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the XRechnung scenario report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return copy
}

/** The literal text of `runs`, or undefined where a run is no literal. */
const text = (runs: readonly Inline[] | undefined): string | undefined =>
  runs !== undefined && runs.every((run) => run.kind === 'text') ? runs.map((run) => (run as Extract<Inline, { kind: 'text' }>).text).join('') : undefined

/** The accounts the report's e-invoice, its QR-bill and its EPC payment code pay, in that order. */
function accounts(report: ReportDefinition): (string | undefined)[] {
  const code = report.regions.summary.find((component): component is EpcQrCodeComponent => component.kind === 'epcQrCode')
  return [text(report.eInvoice?.payment?.iban), text(report.paymentPart?.account), text(code?.iban)]
}

/** Whether all three pay `account`. */
const payAll = (report: ReportDefinition, account: string): boolean => accounts(report).every((paid) => paid === account)

/** The ids of the report's e-invoice's VAT categories, in order, joined. */
const categories = (report: ReportDefinition): string => (report.eInvoice?.vat ?? []).map((category) => `${category.id} ${category.rate}`).join(', ')

/** The scenarios about the e-invoice, their names in `locale`. */
export function eInvoiceScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const row = t('outline.eInvoice')
  const tree = (name: string, selected?: boolean): ScenarioQuery => ({ role: 'treeitem', name, ...(selected === undefined ? {} : { selected }) })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  const textbox = (name: string): ScenarioQuery => ({ role: PROPERTY_ROLES.text, name })
  const rate = (item: number): ScenarioQuery => textbox(t('field.vatCategoryRate', { item }))
  const iban = textbox(t('field.iban'))
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition = invoicedScenarioReport): BuilderScenario => ({
    name,
    locale,
    report,
    steps,
  })
  const code = t('label.kindDetail', { kind: t('kind.epcQrCode'), detail: 'Muster Haustechnik GmbH' })
  const other = 'CH56 0483 5012 3456 7800 9'

  return [
    // The row a keyboard reaches selects the e-invoice, which is edited
    // field by field in its groups: the buyer's name typed is the buyer's;
    // a code the category's rate cannot have, and a rate a standard-rated
    // category cannot, are refused on their fields and the invoice stays
    // as it was; a rate typed is the category's, one step, and undo gives
    // the rate back.
    scenario('select the e-invoice in the outline, and edit its buyer and a rate', [
      { do: 'focus', ...tree(row) },
      { expect: 'focused', ...tree(row, true) },
      { expect: 'present', role: 'group', name: t('group.buyer') },
      { expect: 'value', ...textbox(t('field.buyerName')), value: 'Kunde AG' },
      { do: 'fill', ...textbox(t('field.buyerName')), text: 'Gasthaus Zur Linde GmbH' },
      { expect: 'document', says: 'the buyer is named as typed', check: (report) => text(report.eInvoice?.buyer.name) === 'Gasthaus Zur Linde GmbH' },
      { do: 'choose', role: PROPERTY_ROLES.select, name: t('field.vatCategoryCode', { item: 2 }), option: t('option.vatE') },
      { expect: 'invalid', role: PROPERTY_ROLES.select, name: t('field.vatCategoryCode', { item: 2 }) },
      { do: 'fill', ...rate(1), text: '0.4' },
      { expect: 'invalid', ...rate(1) },
      { expect: 'document', says: 'the categories are as they were', check: (report) => categories(report) === 'standard 19, reduced 7', unchanged: true },
      { do: 'fill', ...rate(1), text: '16' },
      { expect: 'document', says: 'the standard rate is the one typed', check: (report) => categories(report) === 'standard 16, reduced 7' },
      { do: 'click', ...button(t('action.undo')) },
      { expect: 'document', says: 'undo gave the rate back', check: (report) => categories(report) === 'standard 19, reduced 7' },
      { expect: 'text', ...said, text: t('status.undone', { label: t('history.change', { field: t('field.vatCategoryRate', { item: 1 }) }) }) },
    ]),
    // The VAT categories are a list: Add puts a category at its end that is
    // another breakdown than both -- an exempt one, the invoice holding both
    // of Germany's rates -- the keyboard on its identifier; a category moved
    // up or down takes the keyboard with it, on the same button of the
    // group it stands in now, so that a second press moves it again; the
    // first has nowhere to go up to, which is said; Remove takes one away,
    // the keyboard on Add; and each is one step, which undo takes back.
    scenario('add, move and remove a VAT category, one step each', [
      { do: 'focus', ...tree(row) },
      { do: 'click', ...button(t('action.addVatCategory')) },
      { expect: 'focused', ...textbox(t('field.vatCategoryId', { item: 3 })) },
      { expect: 'document', says: 'a third category is an exempt one', check: (report) => categories(report) === 'standard 19, reduced 7, category3 0' },
      { do: 'click', ...button(t('action.moveVatCategoryUp', { item: 3 })) },
      { expect: 'focused', ...button(t('action.moveVatCategoryUp', { item: 2 })) },
      { expect: 'document', says: 'the new category is second', check: (report) => categories(report) === 'standard 19, category3 0, reduced 7' },
      { do: 'click', ...button(t('action.moveVatCategoryDown', { item: 1 })) },
      { expect: 'focused', ...button(t('action.moveVatCategoryDown', { item: 2 })) },
      {
        expect: 'document',
        says: 'the standard category is second, the new one first',
        check: (report) => categories(report) === 'category3 0, standard 19, reduced 7',
      },
      { do: 'click', ...button(t('action.moveVatCategoryUp', { item: 1 })) },
      { expect: 'text', ...said, text: t('status.first', { name: t('group.vatCategory', { item: 1 }) }) },
      { do: 'click', ...button(t('action.removeVatCategory', { item: 1 })) },
      { expect: 'focused', ...button(t('action.addVatCategory')) },
      { expect: 'document', says: 'the new category is gone', check: (report) => categories(report) === 'standard 19, reduced 7' },
      { do: 'press', key: 'z', modifiers: ['Control'] },
      { expect: 'document', says: 'undo gave it back, first', check: (report) => categories(report) === 'category3 0, standard 19, reduced 7' },
    ]),
    // The e-invoice, its QR-bill and its EPC payment code pay one account,
    // and each edit is validated whole: an IBAN typed into either code is
    // the account all three pay, in one step, which the live region says;
    // one the bill cannot pay, Germany's, is refused on the field typed
    // into, all three paying the account they did; and undo gives all
    // three back the account before.
    scenario('change the account the e-invoice shares with its QR-bill and its EPC code, from either code', [
      { do: 'click', role: 'img', name: t('canvas.paymentPart') },
      { do: 'fill', ...iban, text: other },
      { expect: 'document', says: 'the e-invoice, the bill and the EPC code pay the IBAN typed', check: (report) => payAll(report, other) },
      { expect: 'text', ...said, text: t('status.accountShared', { field: t('field.iban') }) },
      { do: 'click', ...tree(code) },
      { expect: 'value', ...iban, value: other },
      { do: 'fill', ...iban, text: 'DE89 3704 0044 0532 0130 00' },
      { expect: 'invalid', ...iban },
      { expect: 'document', says: 'all three pay the account they did', check: (report) => payAll(report, other), unchanged: true },
      { do: 'fill', ...iban, text: SCENARIO_ACCOUNT },
      { expect: 'document', says: 'all three pay the account typed into the EPC code', check: (report) => payAll(report, SCENARIO_ACCOUNT) },
      { do: 'focus', ...tree(row) },
      { expect: 'value', ...iban, value: SCENARIO_ACCOUNT },
      { do: 'click', ...button(t('action.undo')) },
      { expect: 'document', says: 'undo gave all three the account before', check: (report) => payAll(report, other) },
    ]),
    // Delete on the e-invoice's row takes it away in one step, the keyboard
    // on the row before it, the payment part's; undo brings it back, and
    // the arrow walks to it, last.
    scenario('delete the e-invoice, and bring it back', [
      { do: 'focus', ...tree(row) },
      { do: 'press', key: 'Delete' },
      { expect: 'document', says: 'the e-invoice is gone', check: (report) => report.eInvoice === undefined },
      { expect: 'absent', ...tree(row) },
      { expect: 'focused', ...tree(t('canvas.paymentPart'), true) },
      { expect: 'text', ...said, text: t('status.eInvoiceDeleted') },
      { do: 'press', key: 'z', modifiers: ['Control'] },
      { expect: 'document', says: 'undo gave the e-invoice back', check: (report) => report.eInvoice !== undefined },
      { do: 'press', key: 'ArrowDown' },
      { expect: 'focused', ...tree(row, true) },
    ]),
    // An XRechnung's own terms are a group of their own; its rules are
    // report-spec's, refused where they are typed: a Leitweg-ID under 0204
    // whose check digits are wrong, and a buyer's reference, which an
    // XRechnung needs (BR-DE-15), emptied.
    scenario(
      'refuse an XRechnung’s Leitweg-ID and its buyer’s reference where they are typed',
      [
        { do: 'focus', ...tree(row) },
        { expect: 'present', role: 'group', name: t('group.xrechnung') },
        { do: 'fill', ...textbox(t('field.buyerAddress')), text: '991-33333TEST-34' },
        { expect: 'invalid', ...textbox(t('field.buyerAddress')) },
        { do: 'fill', ...textbox(t('field.buyerReference')), text: '' },
        { expect: 'invalid', ...textbox(t('field.buyerReference')) },
        {
          expect: 'document',
          says: 'the buyer is reached by the Leitweg-ID it was',
          check: (report) =>
            text(report.eInvoice?.buyer.electronicAddress?.id) === '991-33333TEST-33' && text(report.eInvoice?.buyerReference) === '991-33333TEST-33',
          unchanged: true,
        },
      ],
      xrechnungScenarioReport,
    ),
  ]
}
