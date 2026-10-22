/**
 * The builder scenarios about a report's payment part, its Swiss QR-bill,
 * selected and edited as a component is (0039): reached from the canvas's
 * band and from its outline row, its IBAN typed where it is written and
 * refused there when SIX's rules refuse it, its debtor added and removed,
 * a bill added to a report from nothing, warned of while it holds SIX's
 * examples, deleted and brought back, and one added and made to pay a
 * QR-IBAN with its QR reference.
 */
import { QR_BILL_EXAMPLE } from '@formancy/report-spec'
import type { ReportDefinition, SwissQrBill } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import { scenarioReport } from './scenario-report.js'
import { billedReport } from './scenario-payments.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

/** Whether the report's bill holds `text`, one literal run, at `read`; or, for undefined, holds nothing there. */
const billHas = (report: ReportDefinition, read: (bill: SwissQrBill) => unknown, text: string | undefined): boolean =>
  report.paymentPart !== undefined && JSON.stringify(read(report.paymentPart)) === JSON.stringify(text === undefined ? undefined : [{ kind: 'text', text }])

/** The scenarios about the payment part, their names in `locale`. */
export function paymentPartScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const part = t('canvas.paymentPart')
  const tree = (name: string, selected?: boolean): ScenarioQuery => ({ role: 'treeitem', name, ...(selected === undefined ? {} : { selected }) })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  const iban: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.iban') }
  const debtorName: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.debtorName') }
  const reference: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.paymentReference') }
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  const warning = button(t('problem.item', { severity: t('severity.warning'), where: part }))
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition): BuilderScenario => ({ name, locale, report, steps })
  const debtor = (bill: SwissQrBill): unknown => bill.debtor?.name
  const account = (bill: SwissQrBill): unknown => bill.account
  const referenced = (bill: SwissQrBill): unknown => bill.reference

  return [
    // The band a pointer clicks and the row a keyboard reaches select the
    // bill, which is edited field by field: an IBAN whose check digits are
    // wrong is refused on its field and the bill pays the account it did,
    // and the warning that it pays SIX's example account goes once it pays
    // the one typed. The debtor, which a bill may leave out, is added from
    // SIX's example and removed by its group's button, the keyboard staying
    // on the button, and undo brings it back.
    scenario(
      'select the QR-bill on the canvas, and edit it field by field',
      [
        { do: 'click', role: 'img', name: part },
        { expect: 'focused', ...tree(part, true) },
        { expect: 'present', role: 'group', name: t('group.creditor') },
        { expect: 'value', ...iban, value: 'CH44 3199 9123 0008 8901 2' },
        { do: 'fill', ...iban, text: 'CH44 3199 9123 0008 8901 3' },
        { expect: 'invalid', ...iban },
        { expect: 'document', says: 'the bill pays the account it did', check: (report) => billHas(report, (bill) => bill.account, 'CH44 3199 9123 0008 8901 2'), unchanged: true },
        { expect: 'present', ...warning },
        { do: 'fill', ...iban, text: 'CH58 3000 0000 0000 0000 0' },
        { expect: 'document', says: 'the bill pays the IBAN typed', check: (report) => billHas(report, (bill) => bill.account, 'CH58 3000 0000 0000 0000 0') },
        { expect: 'absent', ...warning },
        { do: 'click', ...button(t('action.addDebtor')) },
        { expect: 'focused', ...button(t('action.removeDebtor')) },
        { expect: 'document', says: 'the bill’s debtor is SIX’s example’s', check: (report) => billHas(report, debtor, 'Simon Muster') },
        { do: 'fill', ...debtorName, text: 'Pia Rutschmann' },
        { expect: 'document', says: 'the debtor is named as typed', check: (report) => billHas(report, debtor, 'Pia Rutschmann') },
        { do: 'click', ...button(t('action.removeDebtor')) },
        { expect: 'focused', ...button(t('action.addDebtor')) },
        { expect: 'document', says: 'the bill has no debtor', check: (report) => billHas(report, debtor, undefined) },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { expect: 'document', says: 'undo gave the debtor back', check: (report) => billHas(report, debtor, 'Pia Rutschmann') },
        { expect: 'text', ...said, text: t('status.undone', { label: t('history.removeDebtor') }) },
      ],
      billedReport,
    ),
    // A report without a bill is given SIX's example from its own
    // properties, selected, the keyboard on its IBAN, where the bill's own
    // values start, and warned of; following the warning reaches the
    // bill's row, Delete there takes the bill away with the keyboard on the
    // row before, undo brings it back, and the arrow walks to it.
    scenario(
      'add a QR-bill to a report without one, then delete it and bring it back',
      [
        { expect: 'absent', ...tree(part) },
        { do: 'click', ...button(t('action.addQrBill')) },
        { expect: 'focused', ...iban },
        { expect: 'present', ...tree(part, true) },
        { expect: 'document', says: 'the report has SIX’s example bill', check: (report) => billHas(report, (bill) => bill.account, 'CH52 0483 5012 3456 7100 0') },
        { expect: 'present', role: 'img', name: part },
        { expect: 'text', ...said, text: t('status.qrBillAdded') },
        { do: 'click', ...warning },
        { expect: 'focused', ...tree(part, true) },
        { do: 'press', key: 'Delete' },
        { expect: 'document', says: 'the bill is gone', check: (report) => report.paymentPart === undefined },
        { expect: 'absent', role: 'img', name: part },
        { expect: 'focused', ...tree(t('kind.spacer'), true) },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { expect: 'document', says: 'undo gave the bill back', check: (report) => report.paymentPart !== undefined },
        { do: 'press', key: 'ArrowDown' },
        { expect: 'focused', ...tree(part, true) },
      ],
      scenarioReport,
    ),
    // A bill added from nothing pays an IBAN, and SIX pays a QR-IBAN with a
    // QR reference and nothing else, so neither could be typed first. The
    // QR-IBAN typed takes SIX's example QR reference with it, in one step,
    // which the live region says; the creditor's own QR reference typed
    // after it is the bill's, and undo gives back the example's.
    scenario(
      'add a QR-bill and make it pay a QR-IBAN with a QR reference',
      [
        { do: 'click', ...button(t('action.addQrBill')) },
        { expect: 'focused', ...iban },
        { do: 'fill', ...iban, text: 'CH58 3000 0000 0000 0000 0' },
        {
          expect: 'document',
          says: 'the bill pays the QR-IBAN typed, with SIX’s example QR reference',
          check: (report) => billHas(report, account, 'CH58 3000 0000 0000 0000 0') && billHas(report, referenced, QR_BILL_EXAMPLE.reference),
        },
        { expect: 'text', ...said, text: t('status.changedToQrIban', { field: t('field.iban') }) },
        { expect: 'value', ...reference, value: QR_BILL_EXAMPLE.reference },
        { do: 'fill', ...reference, text: '21 00000 00003 13947 14300 09017' },
        { expect: 'document', says: 'the bill pays with the QR reference typed', check: (report) => billHas(report, referenced, '21 00000 00003 13947 14300 09017') },
        { expect: 'value', ...iban, value: 'CH58 3000 0000 0000 0000 0' },
        { do: 'click', ...button(t('action.undo')) },
        { expect: 'document', says: 'undo gave back SIX’s example QR reference', check: (report) => billHas(report, referenced, QR_BILL_EXAMPLE.reference) },
      ],
      scenarioReport,
    ),
  ]
}
