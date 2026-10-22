/**
 * The editor's actions that add or take away more than a field (0039): a
 * part of the report's own level added -- a QR-bill, from SIX's example
 * values -- and an optional group of the selection's fields added or
 * removed, a bill's debtor. Each is one command through the session, one
 * undo step named for it, and refused with the validator's reason where
 * the report cannot take it.
 *
 * Lent what it needs of the editor, as `views.ts` and `images.ts` are, and
 * run through the editor's one `dispatch`.
 */
import { putPaymentPart } from '@formancy/report-core'
import type { CommandOutcome } from '@formancy/report-core'
import type { Edit } from './edits.js'
import { partLabel } from './labels.js'
import type { EditorOutcome, EditorRefusalCode, ReportLevelPart } from './model.js'
import { newPaymentPart } from './payment-part.js'
import { propertyChange, propertyTarget, specsOf } from './properties.js'
import type { PropertyTarget } from './properties.js'
import type { GroupSpec } from './property-fields.js'
import { isGroup } from './property-fields.js'
import { isReportLevelPart } from './selection.js'
import type { Derived, Local } from './state.js'
import type { EditorLocale, EditorText } from './text.js'

/** What the part actions are lent of the editor. */
export interface PartLent {
  readonly current: () => Derived
  readonly local: () => Local
  readonly refuse: (code: EditorRefusalCode, text: string, refusal?: Extract<CommandOutcome, { ok: false }>) => EditorOutcome
  readonly applyEdit: (edit: Edit, name: () => string, refused?: 'status.qrBillNotAdded') => EditorOutcome
}

export interface PartActions {
  addPart(part: ReportLevelPart): EditorOutcome
  addGroup(key: string): EditorOutcome
  removeGroup(key: string): EditorOutcome
}

/** A group a person may add and remove: a bill's debtor. */
type OptionalGroup = GroupSpec & { readonly optional: NonNullable<GroupSpec['optional']> }

export function partActions(lent: PartLent, t: EditorText, locale: EditorLocale): PartActions {
  /** The selection's optional group at `key`, and what the panel edits, or the refusal. */
  function optionalGroup(key: string): { readonly group: OptionalGroup; readonly target: PropertyTarget } | EditorOutcome {
    const { report } = lent.current()
    // The editor keeps its selection one the document has, so there is a target.
    const target = propertyTarget(report, lent.local().selection) as PropertyTarget
    const group = specsOf(target, report, t, locale).find((spec): spec is GroupSpec => isGroup(spec) && spec.key === key)
    if (group === undefined) return lent.refuse('not-found', t('status.notFound', { name: key }))
    if (group.optional === undefined) return lent.refuse('unavailable', t('status.notOptional', { name: t(group.words) }))
    return { group: group as OptionalGroup, target }
  }

  /** The optional group at `key` added, from its example values, or removed: one undo step either way. */
  function toggle(key: string, add: boolean): EditorOutcome {
    const found = optionalGroup(key)
    if ('ok' in found) return found
    const { group, target } = found
    const name = t(group.words)
    if (group.optional.present === add) return lent.refuse('unavailable', t(add ? 'status.alreadyThere' : 'status.notThere', { name }))
    // The selection stays what it was: the group is a part of it.
    const selection = lent.local().selection
    const edit: Edit = {
      command: propertyChange(target, key, add ? group.optional.value : null).command,
      step: { do: 'said', id: add ? group.optional.added : group.optional.removed },
      announce: add ? 'status.added' : 'status.removed',
      then: () => selection,
    }
    return lent.applyEdit(edit, () => name)
  }

  return {
    addPart(part) {
      // A part from a caller tsc never saw -- a builder in plain JavaScript -- may be none of the report's.
      if (!isReportLevelPart(part)) return lent.refuse('not-found', t('status.notFound', { name: String(part) }))
      const { report } = lent.current()
      if (report.paymentPart !== undefined) return lent.refuse('unavailable', t('status.hasQrBill'))
      const bill = newPaymentPart(report)
      const edit: Edit = { command: (r) => putPaymentPart(r, bill), step: { do: 'said', id: 'history.addQrBill' }, announce: 'status.qrBillAdded', then: () => ({ part }) }
      return lent.applyEdit(edit, () => partLabel(part, t), 'status.qrBillNotAdded')
    },
    addGroup: (key) => toggle(key, true),
    removeGroup: (key) => toggle(key, false),
  }
}
