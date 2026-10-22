/**
 * The keyboard's structural edits -- move up and down, indent, outdent,
 * delete, duplicate -- as report-core commands, each with what it says in
 * the history and what is selected once it is made.
 *
 * Each checks only that it has somewhere to go: first already, nothing
 * before it to go into. Whether the result is a valid report is the
 * validator's question, asked when the session applies it, so an indent of
 * a page break into a keep-together block is refused with the validator's
 * reason, never by a rule copied here (0008).
 *
 * A part of the report's own level has one place and a report holds one:
 * its payment part prints where SIX puts the slip, and its e-invoice
 * prints nothing of its own and is written as its XML. Neither has
 * anywhere to move or a copy to make, and Delete takes either away (0039,
 * 0044).
 */
import { duplicateComponent, insertColumn, locationOf, locations, moveColumn, moveComponent, removeColumn, removeComponent, removeEInvoice, removePaymentPart } from '@formancy/report-core'
import type { Command, CommandOutcome } from '@formancy/report-core'
import type { ReportDefinition, TableComponent } from '@formancy/report-spec'
import type { Step } from './history.js'
import type { ReportLevelPart, Selection } from './model.js'
import { siblingsAt } from './places.js'
import type { Selected, SelectedPart } from './selection.js'
import type { MessageId } from './text.js'

/** An edit to make: the command, its history step, what it is announced as and with what besides the name, and what is selected after it. */
export interface Edit {
  readonly command: Command<object>
  readonly step: Step
  readonly announce: MessageId
  readonly values?: Readonly<Record<string, string | number>>
  readonly then: (outcome: CommandOutcome & { readonly ok: true }) => Selection | null
}

/** An edit with nowhere to go, and what to say. */
export interface NoEdit {
  readonly edge: MessageId
}

export type Planned = Edit | NoEdit

/** The longest identifier the format allows (`isIdentifier`). */
const IDENTIFIER_LENGTH = 64

/** A component's or a column's selection: what a move, an indent or an outdent selects after it, as before it. */
function selectionOf(target: Exclude<Selected, { readonly kind: 'part' }>): Selection {
  return target.kind === 'column' ? { id: target.table.id, column: target.column.id } : { id: target.component.id }
}

/** Where a part of the report's own level goes, and why: nowhere, each for its reason. A table over every part. */
const FIXED: { readonly [P in ReportLevelPart]: NoEdit } = { paymentPart: { edge: 'status.partFixed' }, eInvoice: { edge: 'status.eInvoiceFixed' } }

/** What Delete makes of each part of the report's own level: its removal, said in a sentence of its own. A table over every part. */
const REMOVED: { readonly [P in ReportLevelPart]: Pick<Edit, 'command' | 'step' | 'announce'> } = {
  paymentPart: { command: (r) => removePaymentPart(r), step: { do: 'said', id: 'history.removeQrBill' }, announce: 'status.qrBillDeleted' },
  eInvoice: { command: (r) => removeEInvoice(r), step: { do: 'said', id: 'history.removeEInvoice' }, announce: 'status.eInvoiceDeleted' },
}

function fixed(target: SelectedPart): NoEdit {
  return FIXED[target.part]
}

/** Moves the selection one place up or down its list -- a component's, or its table's columns. */
export function moveBy(report: ReportDefinition, target: Selected, delta: -1 | 1): Planned {
  const edge: MessageId = delta < 0 ? 'status.first' : 'status.last'
  if (target.kind === 'part') return fixed(target)
  const then = (): Selection => selectionOf(target)
  if (target.kind === 'column') {
    const { table, column, index } = target
    const to = index + delta
    if (to < 0 || to >= table.columns.length) return { edge }
    return { command: (r) => moveColumn(r, table.id, column.id, to), step: { do: 'move', kind: 'tableColumn' }, announce: 'status.moved', then }
  }
  const { component, location } = target
  const to = location.index + delta
  if (to < 0 || to >= siblingsAt(report, location).length) return { edge }
  return { command: (r) => moveComponent(r, component.id, { ...location, index: to }), step: { do: 'move', kind: component.kind }, announce: 'status.moved', then }
}

/** Into the container just before the selection, at the end of what it holds -- its last column, for a columns block. */
export function indent(report: ReportDefinition, target: Selected): Planned {
  const edge: MessageId = 'status.cannotIndent'
  if (target.kind === 'part') return fixed(target)
  if (target.kind === 'column') return { edge }
  const { component, location } = target
  const before = siblingsAt(report, location)[location.index - 1]
  // The last place inside it, in reading order: report-core's places, so
  // which lists a container holds is report-core's to know, not this file's.
  const into = before === undefined ? undefined : locations(report).filter((place) => place.parent === before).at(-1)
  if (into === undefined) return { edge }
  return { command: (r) => moveComponent(r, component.id, into), step: { do: 'indent', kind: component.kind }, announce: 'status.indented', then: () => selectionOf(target) }
}

/** Out of the container the selection is in, to just after it. */
export function outdent(report: ReportDefinition, target: Selected): Planned {
  const edge: MessageId = 'status.cannotOutdent'
  if (target.kind === 'part') return fixed(target)
  if (target.kind === 'column' || target.location.parent === undefined) return { edge }
  const { component } = target
  // The container stands somewhere: it holds the selection.
  const there = locationOf(report, target.location.parent) as NonNullable<ReturnType<typeof locationOf>>
  return {
    command: (r) => moveComponent(r, component.id, { ...there, index: there.index + 1 }),
    step: { do: 'outdent', kind: component.kind },
    announce: 'status.outdented',
    then: () => selectionOf(target),
  }
}

/**
 * Deletes the selection, selecting what a person expects focus to go to
 * (plan 21): the next in its list, else the one before, else its container;
 * for a column, the next column, else the one before, else its table; for
 * a part of the report's own level, the outline's row before it, else
 * nothing. `order` is the outline's.
 */
export function remove(report: ReportDefinition, target: Selected, order: readonly Selection[]): Edit {
  if (target.kind === 'part') {
    const at = order.findIndex((row) => 'part' in row && row.part === target.part)
    const before = at > 0 ? order[at - 1] : undefined
    return { ...REMOVED[target.part], then: () => before ?? null }
  }
  if (target.kind === 'column') {
    const { table, column, index } = target
    const next = table.columns[index + 1] ?? table.columns[index - 1]
    return {
      command: (r) => removeColumn(r, table.id, column.id),
      step: { do: 'delete', kind: 'tableColumn' },
      announce: 'status.deleted',
      then: () => (next === undefined ? { id: table.id } : { id: table.id, column: next.id }),
    }
  }
  const { component, location } = target
  const siblings = siblingsAt(report, location)
  const next = siblings[location.index + 1] ?? siblings[location.index - 1] ?? location.parent
  return {
    command: (r) => removeComponent(r, component.id),
    step: { do: 'delete', kind: component.kind },
    announce: 'status.deleted',
    then: () => (next === undefined ? null : { id: next }),
  }
}

/** A column id no other column of the table has: the id's base numbered from 2, as report-core numbers a component's. */
function freshColumnId(table: TableComponent, id: string): string {
  const taken = new Set(table.columns.map((column) => column.id))
  const base = id.replace(/-\d+$/, '')
  for (let number = 2; ; number += 1) {
    const suffix = `-${number}`
    const fresh = `${base.slice(0, IDENTIFIER_LENGTH - suffix.length)}${suffix}`
    if (!taken.has(fresh)) return fresh
  }
}

/** Copies the selection to just after it, and selects the copy. */
export function duplicate(target: Selected): Planned {
  if (target.kind === 'part') return fixed(target)
  if (target.kind === 'column') {
    const { table, column, index } = target
    const fresh = freshColumnId(table, column.id)
    return {
      command: (r) => insertColumn(r, table.id, index + 1, { ...column, id: fresh }),
      step: { do: 'duplicate', kind: 'tableColumn' },
      announce: 'status.duplicated',
      then: () => ({ id: table.id, column: fresh }),
    }
  }
  const { component } = target
  return {
    command: (r) => duplicateComponent(r, component.id),
    step: { do: 'duplicate', kind: component.kind },
    announce: 'status.duplicated',
    // duplicateComponent says the copy's id in its outcome.
    then: (outcome) => ({ id: (outcome as unknown as { readonly id: string }).id }),
  }
}
