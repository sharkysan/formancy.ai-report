/**
 * The properties pane: what it edits for a selection, the fields it shows,
 * and the command a changed field becomes.
 *
 * A change is a typed command through report-core -- `updateComponent`,
 * `updateColumn`, `updatePaymentPart`, `updateEInvoice`, `setTitle`,
 * `setLocale`, `setPage` -- so a property edit is validated, undone and
 * refused like any other edit, and a refused one shows the validator's own
 * message on the field it came from. A bill's IBAN of the other kind takes
 * its reference with it, in the same command (`payment-part.ts`). In a
 * report with an e-invoice, the account it shares with every payment code
 * printed with it -- its own, the bill's, each EPC QR code's -- is written
 * by `setPaymentAccount`, wherever it is typed, so that one edit keeps all
 * of them agreeing, where every one of them is written in the report; where
 * one reads its account from the data, each field writes its own (0044).
 */
import { setLocale, setPage, setPaymentAccount, setTitle, updateColumn, updateComponent, updateEInvoice, updatePaymentPart } from '@formancy/report-core'
import type { Command, ComponentPatch, Diagnostic, EInvoicePatch, PagePatch, PaymentPartPatch, Refusal } from '@formancy/report-core'
import { printableArea, ptToMm, squareRoom } from '@formancy/report-spec'
import type { Inline, ReportDefinition } from '@formancy/report-spec'
import { invoiceFields } from './invoice-fields.js'
import { columnKey, kindLabel, partLabel } from './labels.js'
import type { Selection } from './model.js'
import type { PropertyField, PropertyGroup, PropertyPanel, PropertyRow } from './model-properties.js'
import { pairedReference } from './payment-part.js'
import { paymentPartFields } from './payment-part-fields.js'
import { columnFields, componentFields, fieldWords, flatFields, isGroup, reportFields } from './property-fields.js'
import type { FieldSpec, GroupSpec, PanelSpec } from './property-fields.js'
import { selected } from './selection.js'
import type { Selected } from './selection.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** What the properties pane edits: the report, or what is selected. */
export type PropertyTarget = { readonly kind: 'report'; readonly path: '' } | Selected

/** What the pane edits for `selection`, or undefined when the report has no such thing. */
export function propertyTarget(report: ReportDefinition, selection: Selection | null): PropertyTarget | undefined {
  return selection === null ? { kind: 'report', path: '' } : selected(report, selection)
}

/**
 * The report's own Add for a part it lacks: a group named after the part,
 * with no fields, whose button adds it (0039).
 */
const ADD_PAYMENT_PART: GroupSpec = {
  key: '/paymentPart',
  words: 'canvas.paymentPart',
  fields: [],
  buttons: [{ words: 'action.addQrBill', action: { type: 'addPart', part: 'paymentPart' }, available: true }],
}

/** What the panel shows for `target`, in order: its fields, each by itself or in a group. */
export function specsOf(target: PropertyTarget, report: ReportDefinition, t: EditorText, locale: EditorLocale): PanelSpec[] {
  switch (target.kind) {
    case 'report':
      return [...reportFields(report, t), ...(report.paymentPart === undefined ? [ADD_PAYMENT_PART] : [])]
    case 'component':
      return componentFields(target.component, { report, t, locale, row: false })
    case 'column':
      return columnFields(target.column, { report, t, locale, row: true })
    case 'part':
      return target.part === 'paymentPart'
        ? paymentPartFields(target.bill, { report, t, locale, row: false })
        : invoiceFields(target.invoice, { report, t, locale, row: false })
  }
}

/** Every field the panel shows for `target`, those in a group among them: what a field is found by. */
export function fieldsOf(target: PropertyTarget, report: ReportDefinition, t: EditorText, locale: EditorLocale): FieldSpec[] {
  return flatFields(specsOf(target, report, t, locale))
}

/** A field's accessible name: its words, and its unit where it has one. */
export function fieldLabel(spec: FieldSpec, t: EditorText): string {
  const label = fieldWords(spec.words, t)
  return spec.unit === undefined ? label : t('field.withUnit', { label, unit: t(`unit.${spec.unit}`) })
}

/** A value the pane refused or the session refused, as the pane keeps it: what was typed, and why. */
export interface FieldError {
  readonly input: string | boolean
  readonly message: string
}

/** Whether `path` is `at` or inside it. */
function within(path: string, at: string): boolean {
  return path === at || path.startsWith(`${at}/`)
}

/**
 * The pane for `target`: each field with its value -- what was typed, after
 * a refusal -- and its error: the refusal's, else the first diagnostic
 * about what the field holds; and the same fields as rows, each by itself
 * or in its group, the group with its button.
 */
export function propertyPanel(
  target: PropertyTarget,
  specs: readonly PanelSpec[],
  heading: string,
  errors: ReadonlyMap<string, FieldError>,
  diagnostics: readonly Diagnostic[],
  t: EditorText,
): PropertyPanel {
  const fieldOf = (spec: FieldSpec): PropertyField => {
    const error = errors.get(spec.key)
    const about = error?.message ?? diagnostics.find((diagnostic) => within(diagnostic.path, `${target.path}${spec.key}`))?.message
    return {
      key: spec.key,
      label: fieldLabel(spec, t),
      kind: spec.kind,
      value: error?.input ?? spec.read(),
      ...(spec.options === undefined ? {} : { options: spec.options }),
      ...(spec.placeholder === undefined ? {} : { placeholder: t(spec.placeholder) }),
      required: spec.required,
      ...(about === undefined ? {} : { error: about }),
    }
  }
  const groupOf = (spec: GroupSpec): PropertyGroup => ({
    key: spec.key,
    label: t(spec.words, spec.item === undefined ? {} : { item: spec.item }),
    fields: spec.fields.map(fieldOf),
    actions: spec.buttons.map((button) => ({
      label: t(button.words, button.item === undefined ? {} : { item: button.item }),
      action: button.action,
      available: button.available,
      ...(button.then === undefined ? {} : { then: button.then }),
    })),
  })
  const rows = specs.map((spec): PropertyRow => (isGroup(spec) ? { group: groupOf(spec) } : { field: fieldOf(spec) }))
  return { heading, fields: rows.flatMap((row) => ('group' in row ? row.group.fields : [row.field])), rows }
}

/** The pane's heading: "Report", or the kind and label of what is selected. */
export function propertyHeading(target: PropertyTarget, labels: ReadonlyMap<string, string>, t: EditorText): string {
  switch (target.kind) {
    case 'report':
      return t('properties.report')
    case 'component':
      return t('properties.heading', { kind: kindLabel(target.component.kind, t), name: labels.get(target.component.id) ?? target.component.id })
    case 'column':
      return t('properties.heading', { kind: kindLabel('tableColumn', t), name: labels.get(columnKey(target.table.id, target.column.id)) ?? target.column.id })
    case 'part': {
      const kind = target.part === 'paymentPart' ? 'kind.swissQrBill' : target.invoice.kind === 'xrechnung' ? 'kind.xrechnung' : 'kind.facturX'
      return t('properties.heading', { kind: t(kind), name: partLabel(target.part, t) })
    }
  }
}

/** `current` with the value at `path` replaced by `next`; a `null` removes a property of an object. */
function withValue(current: unknown, path: readonly string[], next: unknown): unknown {
  const [head, ...rest] = path
  if (head === undefined) return next
  if (Array.isArray(current)) return current.map((item: unknown, index) => (index === Number(head) ? withValue(item, rest, next) : item))
  const record: Record<string, unknown> = { ...(current as Record<string, unknown> | undefined) }
  const inner = withValue(record[head], rest, next)
  if (inner === null) delete record[head]
  else record[head] = inner
  return record
}

/** The patch of top-level properties that puts `next` at the pointer `at` in `owner`. */
function patchAt(owner: object, at: string, next: unknown): Record<string, unknown> {
  const [top = '', ...rest] = at.split('/').slice(1)
  return { [top]: rest.length === 0 ? next : withValue((owner as Record<string, unknown>)[top], rest, next) }
}

/** A value put in the target, as the command that puts it, and the words it is announced in where it changes more than its field. */
export interface PropertyChange {
  readonly command: Command
  readonly said?: MessageId
}

/**
 * The account `runs` hold at `account` once `next` is put at `at` inside
 * them, where the report has an e-invoice and every run of it is literal:
 * the account the e-invoice shares with every payment code printed with
 * it, which `setPaymentAccount` writes into each of them as one edit, and
 * the live region says so. Undefined where the field is not the account's,
 * or this account, or any other place's -- BT-84, the bill's, an EPC QR
 * code's -- is read from the data: the command, which would write over a
 * binding, refuses that as `read-from-data`, and it is asked here, so that
 * which places share the account is decided in report-core alone. The
 * field's own command writes its own account then, and the render compares
 * it with the data's (0027).
 */
function sharedAccount(report: ReportDefinition, runs: readonly Inline[] | undefined, account: string, at: string, next: unknown): PropertyChange | undefined {
  if (report.eInvoice === undefined || runs === undefined || !within(at, account)) return undefined
  const written = withValue(runs, at.slice(account.length).split('/').slice(1), next) as readonly Inline[]
  if (!written.every((run) => run.kind === 'text')) return undefined
  const text = written.map((run) => run.text).join('')
  const shared = setPaymentAccount(report, text)
  if (!shared.ok && shared.code === 'read-from-data') return undefined
  return { command: (r) => setPaymentAccount(r, text), said: 'status.accountShared' }
}

/** The change that puts `next` at `at` in the target, in `report`: report-core's own command, typed for what it changes. */
export function propertyChange(report: ReportDefinition, target: PropertyTarget, at: string, next: unknown): PropertyChange {
  switch (target.kind) {
    case 'report': {
      const [top, ...rest] = at.split('/').slice(1)
      if (top === 'title') return { command: (r) => setTitle(r, next as string) }
      if (top === 'locale') return { command: (r) => setLocale(r, next as string) }
      return { command: (r) => setPage(r, withValue({}, rest, next) as PagePatch) }
    }
    case 'component': {
      const { component } = target
      const shared = component.kind === 'epcQrCode' ? sharedAccount(report, component.iban, '/iban', at, next) : undefined
      return (
        shared ?? { command: (r) => updateComponent(r, component.id, component.kind, patchAt(component, at, next) as ComponentPatch<typeof component.kind>) }
      )
    }
    case 'column': {
      const { table, column } = target
      return { command: (r) => updateColumn(r, table.id, column.id, patchAt(column, at, next)) }
    }
    case 'part': {
      if (target.part === 'eInvoice') {
        const { invoice } = target
        return (
          sharedAccount(report, invoice.payment?.iban, '/payment/iban', at, next) ?? {
            command: (r) => updateEInvoice(r, patchAt(invoice, at, next)),
          }
        )
      }
      const shared = sharedAccount(report, target.bill.account, '/account', at, next)
      if (shared !== undefined) return shared
      const { patch, said } = pairedReference(target.bill, patchAt(target.bill, at, next))
      return { command: (r) => updatePaymentPart(r, patch), ...(said === undefined ? {} : { said }) }
    }
  }
}

/** A value the session refused, and what it was written into. */
export interface Written {
  readonly spec: FieldSpec
  /** The value as the command wrote it: points, for a length. */
  readonly value: unknown
  /** The report it was written into. */
  readonly report: ReportDefinition
}

/**
 * The validator's "more than the page holds", said in the unit the field is
 * edited in, with the room the margins leave. report-spec counts in points,
 * and a field edited in millimetres that answered in points would leave the
 * person to convert. Undefined for any other refusal.
 */
export function pageRoomMessage(refusal: Refusal, path: string, written: Written, t: EditorText, format: (value: number) => string): string | undefined {
  const error = refusal.errors?.find((candidate) => within(candidate.path, path))
  if (error?.code !== 'exceeds-printable-area' || written.spec.unit !== 'mm' || typeof written.value !== 'number') return undefined
  // Which side the validator measured is the property's own name: a height,
  // a width, or a square's size, which it measures against `squareRoom`.
  const area = printableArea(written.report.page)
  const room = error.path.endsWith('/height') ? area.height : error.path.endsWith('/size') ? squareRoom(area).length : area.width
  return t('input.exceedsPage', { value: format(ptToMm(written.value)), room: format(ptToMm(room)), unit: t('unit.mm') })
}

/**
 * The validator's message for a value written at `path`: its error at or
 * inside it; else its error about what holds it, the nearest first -- a
 * run's field is refused where its runs are, `/paymentPart/account` for
 * `/paymentPart/account/0/text`, and a shared account's edit is refused at
 * every place it reaches, the field's own among them (0044); else its
 * first, else the refusal's own.
 */
export function refusalMessage(refusal: Refusal, path: string): string {
  const errors = refusal.errors ?? []
  const inside = errors.find((error) => within(error.path, path))
  const around = errors.filter((error) => within(path, error.path)).sort((a, b) => b.path.length - a.path.length)[0]
  return (inside ?? around ?? errors[0])?.message ?? refusal.message
}
