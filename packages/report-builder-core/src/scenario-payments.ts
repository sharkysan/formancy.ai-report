/**
 * The builder scenarios about the payment codes: a report whose Swiss
 * QR-bill the design view draws at the sheet's foot and every edit keeps
 * whole (0022), and an EPC payment code inserted by keyboard, its account
 * and its BIC typed where they are written (0025).
 */
import type { EpcQrCodeComponent, ReportDefinition } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model.js'
import { body, scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { contentLocale, editorText } from './text.js'
import type { EditorLocale } from './text.js'

/**
 * The scenario report with a Swiss QR-bill for its payment part: SIX's
 * QR-IBAN and QR reference (IG 2.4, Annex A), every text literal, as the
 * report reads no data.
 */
function billedReport(): ReportDefinition {
  return {
    ...scenarioReport(),
    paymentPart: {
      kind: 'swissQrBill',
      language: 'en',
      account: [{ kind: 'text', text: 'CH44 3199 9123 0008 8901 2' }],
      creditor: {
        name: [{ kind: 'text', text: 'Max Muster & Söhne' }],
        street: [{ kind: 'text', text: 'Musterstrasse' }],
        buildingNumber: [{ kind: 'text', text: '123' }],
        postalCode: [{ kind: 'text', text: '8000' }],
        town: [{ kind: 'text', text: 'Seldwyla' }],
        country: [{ kind: 'text', text: 'CH' }],
      },
      currency: 'CHF',
      amount: { cel: 'dec("1949.75")' },
      reference: [{ kind: 'text', text: '21 00000 00003 13947 14300 09017' }],
      message: [{ kind: 'text', text: 'Site visit' }],
    },
  }
}

/** Whether `report`'s payment part is still all of the one `billedReport` gave it. */
const billKept = (report: ReportDefinition): boolean => JSON.stringify(report.paymentPart) === JSON.stringify(billedReport().paymentPart)

/** Whether the body has an EPC payment code whose text at `key` is `text`, one literal run, or, for undefined, absent. */
const codeHas = (report: ReportDefinition, key: 'iban' | 'bic', text: string | undefined): boolean => {
  const code = report.regions.body.find((component): component is EpcQrCodeComponent => component.kind === 'epcQrCode')
  return code !== undefined && JSON.stringify(code[key]) === JSON.stringify(text === undefined ? undefined : [{ kind: 'text', text }])
}

/** The payment scenarios, their names in `locale`. */
export function paymentScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const region = t('region.body')
  const spacer = t('kind.spacer')
  const tree = (name: string, selected?: boolean): ScenarioQuery => ({ role: 'treeitem', name, ...(selected === undefined ? {} : { selected }) })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  const newCode = t('label.kindDetail', { kind: t('kind.epcQrCode'), detail: editorText(contentLocale(scenarioReport().locale))('default.epcBeneficiary') })
  const iban: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.iban') }
  const bic: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.bic') }
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition = scenarioReport): BuilderScenario => ({ name, locale, report, steps })

  return [
    // A payment part is the report's, not a region's, and nothing edits it
    // yet: the design view shows where its slip prints, an edit elsewhere
    // keeps it whole, and a page it cannot be printed on is refused on the
    // field that asked for it.
    scenario(
      'a payment part is drawn at the sheet’s foot, and edits keep it',
      [
        { expect: 'present', role: 'img', name: t('canvas.paymentPart') },
        { do: 'fill', role: PROPERTY_ROLES.text, name: t('field.title'), text: 'Site visit, invoiced' },
        { expect: 'document', says: 'the title is the one typed, and the bill is whole', check: (report) => report.title === 'Site visit, invoiced' && billKept(report) },
        { do: 'choose', role: PROPERTY_ROLES.select, name: t('field.orientation'), option: t('option.landscape') },
        { expect: 'invalid', role: PROPERTY_ROLES.select, name: t('field.orientation') },
        { expect: 'document', says: 'the page is upright still, and the bill is whole', check: (report) => report.page.orientation === 'portrait' && billKept(report) },
        { do: 'click', ...tree(spacer) },
        { do: 'press', key: 'Delete' },
        { expect: 'document', says: 'the spacer is gone, and the bill is whole', check: (report) => !body(report).includes('gap') && billKept(report) },
        { expect: 'present', role: 'img', name: t('canvas.paymentPart') },
      ],
      billedReport,
    ),
    // A payment code is inserted as any kind is, and its account typed where
    // it is written: an IBAN whose check digits are wrong is refused on its
    // field, and the code still pays the account it did. An optional text
    // -- the BIC -- is added by typing it into its empty field, and removed
    // by emptying it, as every optional property is.
    scenario('insert an EPC payment code, and type its account', [
      { do: 'focus', ...button(t('kind.epcQrCode')) },
      { do: 'press', key: 'Enter' },
      { do: 'focus', ...button(t('target.after', { where: region, name: spacer })) },
      { do: 'press', key: 'Enter' },
      { expect: 'focused', ...tree(newCode, true) },
      { do: 'fill', ...iban, text: 'DE71 1102 2033 0123 4567 88' },
      { expect: 'invalid', ...iban },
      { expect: 'document', says: 'the new code pays the account it started with', check: (report) => codeHas(report, 'iban', 'DE36 0000 0000 0000 0000 00') },
      { do: 'fill', ...iban, text: 'DE71 1102 2033 0123 4567 89' },
      { expect: 'document', says: 'the code pays the IBAN typed, with no BIC', check: (report) => codeHas(report, 'iban', 'DE71 1102 2033 0123 4567 89') && codeHas(report, 'bic', undefined) },
      { do: 'fill', ...bic, text: 'BHBLDEHHXXX' },
      { expect: 'document', says: 'the code holds the BIC typed', check: (report) => codeHas(report, 'bic', 'BHBLDEHHXXX') },
      { do: 'fill', ...bic, text: '' },
      { expect: 'document', says: 'the code holds no BIC again', check: (report) => codeHas(report, 'bic', undefined) },
      { expect: 'value', ...bic, value: '' },
    ]),
  ]
}
