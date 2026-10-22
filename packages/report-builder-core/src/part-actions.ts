/**
 * The editor's actions that add or take away more than a field (0039,
 * 0044): a part of the report's own level added -- a QR-bill, from SIX's
 * example values; never an e-invoice, which is edited and not made from
 * nothing -- an optional group of the selection's fields added or removed,
 * a bill's debtor, an e-invoice's contact or its payment instructions; and
 * an item of a list of groups added, moved or removed, an e-invoice's VAT
 * category. Each is one command through the session, one undo step named
 * for it, and refused with the validator's reason where the report cannot
 * take it, saying what was not added or removed; an action the state marks
 * unavailable, sent anyway, is refused as `unavailable`, saying why.
 *
 * Lent what it needs of the editor, as `views.ts` and `images.ts` are, and
 * run through the editor's one `dispatch`.
 */
import { putPaymentPart } from '@formancy/report-core'
import type { CommandOutcome } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import type { Edit } from './edits.js'
import { partLabel } from './labels.js'
import type { ReportLevelPart } from './model.js'
import type { EditorOutcome, EditorRefusalCode } from './model-actions.js'
import { newPaymentPart } from './payment-part.js'
import { propertyChange, propertyTarget, specsOf } from './properties.js'
import type { PropertyTarget } from './properties.js'
import type { GroupSpec, ListSpec } from './property-fields.js'
import { isGroup } from './property-fields.js'
import { isReportLevelPart } from './selection.js'
import type { Derived, Local } from './state.js'
import type { EditorLocale, EditorText } from './text.js'

/** What the part actions are lent of the editor. */
export interface PartLent {
  readonly current: () => Derived
  readonly local: () => Local
  readonly refuse: (code: EditorRefusalCode, text: string, refusal?: Extract<CommandOutcome, { ok: false }>) => EditorOutcome
  readonly applyEdit: (edit: Edit, name: () => string, refused?: 'status.qrBillNotAdded' | 'status.addRefused' | 'status.removeRefused') => EditorOutcome
}

export interface PartActions {
  addPart(part: ReportLevelPart): EditorOutcome
  addGroup(key: string): EditorOutcome
  removeGroup(key: string): EditorOutcome
  addItem(key: string): EditorOutcome
  removeItem(key: string): EditorOutcome
  moveItem(key: string, to: number): EditorOutcome
}

/** A group a person may add and remove: a bill's debtor, an e-invoice's contact or payment instructions. */
type OptionalGroup = GroupSpec & { readonly optional: NonNullable<GroupSpec['optional']> }

/** A list's own group, which says what its list is: an e-invoice's VAT categories. */
type ListGroup = GroupSpec & { readonly list: ListSpec }

/** What each part of the report's own level is added as, or why it is not: a table over every part. */
const ADDED: { readonly [P in ReportLevelPart]: (report: ReportDefinition) => Edit | 'status.hasQrBill' | 'status.eInvoiceNotMade' } = {
  paymentPart: (report) => {
    if (report.paymentPart !== undefined) return 'status.hasQrBill'
    const bill = newPaymentPart(report)
    return { command: (r) => putPaymentPart(r, bill), step: { do: 'said', id: 'history.addQrBill' }, announce: 'status.qrBillAdded', then: () => ({ part: 'paymentPart' }) }
  },
  // An e-invoice is edited and never made from nothing (INV-Q9): a starter
  // gives one, and a report's tables, parties and categories are the
  // author's to put together first.
  eInvoice: () => 'status.eInvoiceNotMade',
}

export function partActions(lent: PartLent, t: EditorText, locale: EditorLocale): PartActions {
  /** What the panel edits and the groups it shows, for the selection the editor keeps, one the document has. */
  function panel(): { readonly target: PropertyTarget; readonly groups: readonly GroupSpec[]; readonly report: ReportDefinition } {
    const { report } = lent.current()
    const target = propertyTarget(report, lent.local().selection) as PropertyTarget
    return { target, groups: specsOf(target, report, t, locale).filter(isGroup), report }
  }

  /** A group's name, its item's number filled in: "VAT category 2". */
  function nameOf(group: GroupSpec): string {
    return t(group.words, group.item === undefined ? {} : { item: group.item })
  }

  /**
   * A key from a caller tsc never saw -- a builder in plain JavaScript --
   * may be no string: it names nothing, and is refused as a part or a
   * field that names nothing is, rather than thrown on. Undefined for a
   * string.
   */
  function unnamed(key: unknown): EditorOutcome | undefined {
    return typeof key === 'string' ? undefined : lent.refuse('not-found', t('status.notFound', { name: String(key) }))
  }

  /**
   * Why `group`, no optional one, is not added or removed: a bill's is part
   * of every bill (0039); an e-invoice's is part of every invoice of its
   * kind, or, an item of a list, is added and removed by the list's buttons
   * (0044).
   */
  function notOptional(group: GroupSpec, target: PropertyTarget): string {
    const name = nameOf(group)
    if (target.kind !== 'part' || target.part !== 'eInvoice') return t('status.notOptional', { name })
    if (group.item !== undefined) return t('status.notOptionalItem', { name })
    return t('status.notOptionalInvoice', { name, kind: t(target.invoice.kind === 'xrechnung' ? 'kind.xrechnung' : 'kind.facturX') })
  }

  /** The selection's optional group at `key`, and what the panel edits, or the refusal. */
  function optionalGroup(key: string): { readonly group: OptionalGroup; readonly target: PropertyTarget; readonly report: ReportDefinition } | EditorOutcome {
    const { target, groups, report } = panel()
    const group = groups.find((spec) => spec.key === key)
    if (group === undefined) return lent.refuse('not-found', t('status.notFound', { name: key }))
    if (group.optional === undefined) return lent.refuse('unavailable', notOptional(group, target))
    return { group: group as OptionalGroup, target, report }
  }

  /** The optional group at `key` added, from its example values, or removed: one undo step either way. */
  function toggle(key: string, add: boolean): EditorOutcome {
    const found = optionalGroup(key)
    if ('ok' in found) return found
    const { group, target, report } = found
    const name = nameOf(group)
    if (group.optional.present === add) return lent.refuse('unavailable', t(add ? 'status.alreadyThere' : 'status.notThere', { name }))
    // The selection stays what it was: the group is a part of it.
    const selection = lent.local().selection
    const announced = group.optional.announced ?? { added: 'status.added', removed: 'status.removed' }
    const edit: Edit = {
      command: propertyChange(report, target, key, add ? group.optional.value : null).command,
      step: { do: 'said', id: add ? group.optional.added : group.optional.removed },
      announce: add ? announced.added : announced.removed,
      then: () => selection,
    }
    return lent.applyEdit(edit, () => name, add ? 'status.addRefused' : 'status.removeRefused')
  }

  /**
   * The list at `list` of the selection -- the pointer its own group names
   * -- and what the panel edits, or the refusal for a key that names none.
   */
  function listAt(list: string): { readonly group: ListGroup; readonly items: readonly unknown[]; readonly target: PropertyTarget; readonly report: ReportDefinition } | EditorOutcome {
    const { target, groups, report } = panel()
    const group = groups.find((spec): spec is ListGroup => spec.list?.key === list)
    if (group === undefined) return lent.refuse('not-found', t('status.notFound', { name: list }))
    return { group, items: group.list.items, target, report }
  }

  /** The list and the index an item's key -- "/vat/1" -- names, or the refusal. */
  function itemAt(key: string): ({ readonly index: number } & Exclude<ReturnType<typeof listAt>, EditorOutcome>) | EditorOutcome {
    const slash = key.lastIndexOf('/')
    const index = Number(key.slice(slash + 1))
    const found = listAt(key.slice(0, slash))
    if ('ok' in found) return found
    if (!Number.isInteger(index) || index < 0 || index >= found.items.length || key.slice(slash + 1) !== String(index)) return lent.refuse('not-found', t('status.notFound', { name: key }))
    return { ...found, index }
  }

  /** An edit of the list as a whole: the list at its key put back as `next`, one undo step `step`, the selection kept. */
  function listEdit(found: Exclude<ReturnType<typeof listAt>, EditorOutcome>, next: readonly unknown[], step: keyof ListSpec & ('added' | 'removed' | 'moved'), announce: Edit['announce'], name: string, n?: number): EditorOutcome {
    const selection = lent.local().selection
    const edit: Edit = {
      command: propertyChange(found.report, found.target, found.group.list.key, next).command,
      step: { do: 'said', id: found.group.list[step] },
      announce,
      then: () => selection,
      ...(n === undefined ? {} : { values: { n } }),
    }
    return lent.applyEdit(edit, () => name, step === 'added' ? 'status.addRefused' : step === 'removed' ? 'status.removeRefused' : undefined)
  }

  return {
    addPart(part) {
      // A part from a caller tsc never saw -- a builder in plain JavaScript -- may be none of the report's.
      if (!isReportLevelPart(part)) return lent.refuse('not-found', t('status.notFound', { name: String(part) }))
      const added = ADDED[part](lent.current().report)
      if (typeof added === 'string') return lent.refuse('unavailable', t(added))
      return lent.applyEdit(added, () => partLabel(part, t), 'status.qrBillNotAdded')
    },
    addGroup: (key) => unnamed(key) ?? toggle(key, true),
    removeGroup: (key) => unnamed(key) ?? toggle(key, false),
    addItem(key) {
      const found = unnamed(key) ?? listAt(key)
      if ('ok' in found) return found
      // Add drawn unavailable -- nothing the list could take -- and sent anyway.
      if (found.group.list.full !== undefined) return lent.refuse('unavailable', t(found.group.list.full))
      const name = t(found.group.list.item, { item: found.items.length + 1 })
      return listEdit(found, [...found.items, found.group.list.value], 'added', 'status.itemAdded', name)
    },
    removeItem(key) {
      const found = unnamed(key) ?? itemAt(key)
      if ('ok' in found) return found
      const name = t(found.group.list.item, { item: found.index + 1 })
      return listEdit(found, found.items.filter((_, at) => at !== found.index), 'removed', 'status.itemRemoved', name)
    },
    moveItem(key, to) {
      const found = unnamed(key) ?? itemAt(key)
      if ('ok' in found) return found
      const name = t(found.group.list.item, { item: found.index + 1 })
      if (to === found.index) return lent.refuse('at-edge', t('status.notMoved'))
      if (!Number.isInteger(to) || to < 0 || to >= found.items.length) return lent.refuse('at-edge', t(to < found.index ? 'status.first' : 'status.last', { name }))
      const moved = found.items.filter((_, at) => at !== found.index)
      moved.splice(to, 0, found.items[found.index])
      return listEdit(found, moved, 'moved', 'status.itemMoved', name, to + 1)
    },
  }
}
