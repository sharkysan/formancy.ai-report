/**
 * Every command by name, and a command as data: a name and its arguments.
 *
 * A proposal -- from an AI, from a saved macro, from another window -- is a
 * bounded list of operations, not code (plan 16). A descriptor is one such
 * operation, and it runs through exactly the function the builder calls, so
 * a proposal and a click cannot do the same thing two ways. A batch is
 * several of them as one command (0048): a transaction written down, so
 * that an edit of several commands -- a review's resolution -- travels as
 * data and is applied as one step.
 */
import { DATASET_ROLES, REGION_NAMES } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { quote, refuse } from '../outcome.js'
import type { Command, CommandOutcome } from '../outcome.js'
import { duplicateComponent, insertComponent, moveComponent, removeComponent, updateComponent } from './components.js'
import {
  addAsset,
  moveParameter,
  putAggregate,
  putAsset,
  putDataset,
  putField,
  putParameter,
  putStyle,
  removeAggregate,
  removeAsset,
  removeDataset,
  removeField,
  removeParameter,
  removeStyle,
} from './declarations.js'
import { replaceDocument, setLocale, setPage, setTitle } from './document.js'
import { putEInvoice, removeEInvoice, setPaymentAccount, updateEInvoice } from './e-invoice.js'
import { putPaymentPart, removePaymentPart, updatePaymentPart } from './payment-part.js'
import { removeFieldWithReaders } from './readers.js'
import {
  insertColumn,
  insertFooterRow,
  moveColumn,
  moveFooterRow,
  putFooterCell,
  removeColumn,
  removeFooterCell,
  removeFooterRow,
  setGroup,
  setSort,
  updateColumn,
  updateFooterRow,
} from './table.js'

/** Every command a batch may hold: every command but the batch. */
const STEPS = Object.freeze({
  setTitle,
  setLocale,
  setPage,
  replaceDocument,
  putStyle,
  removeStyle,
  putDataset,
  removeDataset,
  putField,
  removeField,
  putParameter,
  removeParameter,
  moveParameter,
  addAsset,
  putAsset,
  removeAsset,
  putAggregate,
  removeAggregate,
  insertComponent,
  removeComponent,
  moveComponent,
  updateComponent,
  duplicateComponent,
  insertColumn,
  removeColumn,
  moveColumn,
  updateColumn,
  setGroup,
  setSort,
  insertFooterRow,
  removeFooterRow,
  moveFooterRow,
  updateFooterRow,
  putFooterCell,
  removeFooterCell,
  putPaymentPart,
  updatePaymentPart,
  removePaymentPart,
  putEInvoice,
  updateEInvoice,
  removeEInvoice,
  setPaymentAccount,
  removeFieldWithReaders,
})

export const COMMANDS = Object.freeze({ ...STEPS, batch })

export type CommandName = keyof typeof COMMANDS

/** A command a batch may hold: any but a batch. */
export type StepName = keyof typeof STEPS

/**
 * The commands that may change each part a report holds at its own level,
 * in no region: its payment part (0022, 0039), by the three made to edit
 * it, and its e-invoice (0027, 0044), by its own three; both by
 * `setPaymentAccount`, which changes the account an e-invoice and its
 * payment codes share in one edit; and either by `replaceDocument`, a
 * paste, an import or a proposal that rewrote the report, whose document
 * may hold another part than the one it replaces. Every other command
 * keeps each part the very object it found; registry.test.ts holds both
 * halves, reading which commands are which from here. A proposal that
 * names one of these may change whom a payment reaches -- a replacement
 * whatever else it changes, and `setPaymentAccount` always -- which 0039
 * and 0044 ask a proposal's review to show above every other change, the
 * part compared whole for a replacement, once proposals are reviewed. A
 * batch may hold any of them, so it is listed for both (0048).
 */
export const PART_COMMANDS = Object.freeze({
  paymentPart: Object.freeze(['putPaymentPart', 'updatePaymentPart', 'removePaymentPart', 'setPaymentAccount', 'replaceDocument', 'batch'] as const),
  eInvoice: Object.freeze(['putEInvoice', 'updateEInvoice', 'removeEInvoice', 'setPaymentAccount', 'replaceDocument', 'batch'] as const),
}) satisfies { readonly [part in 'paymentPart' | 'eInvoice']: readonly CommandName[] }

/** A command's arguments after the report. */
type ArgumentsOf<F> = F extends (report: ReportDefinition, ...rest: infer A) => unknown ? A : never

/** A command as data: its name and its arguments after the report, typed per command. */
export type CommandDescriptor = {
  readonly [N in CommandName]: { readonly command: N; readonly args: Readonly<ArgumentsOf<(typeof COMMANDS)[N]>> }
}[CommandName]

/** A command a batch may hold, as data. */
export type StepDescriptor = Exclude<CommandDescriptor, { readonly command: 'batch' }>

/**
 * Commands one batch holds. Chosen, not measured, as a proposal's bound
 * (plan 16): the largest batch a review writes is a relabel, a command for
 * the field and one for each text that says its label, far fewer; and a
 * batch read from JSON is refused past it before any of it runs. What a
 * batch at the bound costs is measured in 0048.
 */
export const MAX_BATCH_COMMANDS = 1000

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLocation(value: unknown): boolean {
  return (
    isObject(value) &&
    (REGION_NAMES as readonly unknown[]).includes(value.region) &&
    typeof value.index === 'number' &&
    (value.parent === undefined || typeof value.parent === 'string') &&
    (value.column === undefined || typeof value.column === 'number')
  )
}

/**
 * What an argument read from JSON must be before its command runs, each
 * with the words a refusal says it in. Only what the command itself reads:
 * whether a string names something, or a number is a position in its list,
 * the command decides; a whole value it stores -- a component, a column, a
 * footer row, a dataset, a document -- the validator judges.
 */
const SHAPES = {
  text: { is: (value: unknown) => typeof value === 'string', said: 'a string' },
  index: { is: (value: unknown) => typeof value === 'number', said: 'a number' },
  object: { is: isObject, said: 'an object' },
  objectOrNull: { is: (value: unknown) => value === null || isObject(value), said: 'an object, or null to remove it' },
  listOrNull: { is: (value: unknown) => value === null || Array.isArray(value), said: 'a list, or null to remove it' },
  list: { is: (value: unknown) => Array.isArray(value), said: 'a list' },
  location: { is: isLocation, said: 'a location: a region, an index, and a parent id and a column where it names them' },
  role: { is: (value: unknown) => (DATASET_ROLES as readonly unknown[]).includes(value), said: "'header' or 'detail'" },
  footer: { is: (value: unknown) => value === 'totals' || value === 'groupFooter', said: "'totals' or 'groupFooter'" },
  value: { is: () => true, said: 'a value' },
} as const

type Shape = keyof typeof SHAPES

/**
 * The shape of each command's arguments after the report, in order. A
 * table over every command, so a command added to `COMMANDS` without its
 * shapes does not compile; a test holds each list to its command's length.
 */
export const ARGUMENTS: { readonly [N in CommandName]: readonly Shape[] } = {
  setTitle: ['text'],
  setLocale: ['text'],
  setPage: ['object'],
  replaceDocument: ['value'],
  putStyle: ['text', 'object'],
  removeStyle: ['text'],
  putDataset: ['role', 'value'],
  removeDataset: ['role'],
  putField: ['role', 'text', 'object'],
  removeField: ['role', 'text'],
  putParameter: ['text', 'object'],
  removeParameter: ['text'],
  moveParameter: ['text', 'index'],
  addAsset: ['text', 'object'],
  putAsset: ['text', 'object'],
  removeAsset: ['text'],
  putAggregate: ['text', 'object'],
  removeAggregate: ['text'],
  insertComponent: ['location', 'value'],
  removeComponent: ['text'],
  moveComponent: ['text', 'location'],
  updateComponent: ['text', 'text', 'object'],
  duplicateComponent: ['text'],
  insertColumn: ['text', 'index', 'value'],
  removeColumn: ['text', 'text'],
  moveColumn: ['text', 'text', 'index'],
  updateColumn: ['text', 'text', 'object'],
  setGroup: ['text', 'objectOrNull'],
  setSort: ['text', 'listOrNull'],
  insertFooterRow: ['text', 'footer', 'index', 'value'],
  removeFooterRow: ['text', 'footer', 'index'],
  moveFooterRow: ['text', 'footer', 'index', 'index'],
  updateFooterRow: ['text', 'footer', 'index', 'object'],
  putFooterCell: ['text', 'footer', 'index', 'object'],
  removeFooterCell: ['text', 'footer', 'index', 'text'],
  putPaymentPart: ['object'],
  updatePaymentPart: ['object'],
  removePaymentPart: [],
  putEInvoice: ['object'],
  updateEInvoice: ['object'],
  removeEInvoice: [],
  setPaymentAccount: ['text'],
  removeFieldWithReaders: ['role', 'text'],
  batch: ['list'],
}

/** Why `args` are not arguments `name` takes, or undefined when they are. Never quotes an argument. */
function misfit(name: CommandName, args: unknown): string | undefined {
  const shapes = ARGUMENTS[name]
  if (!Array.isArray(args) || args.length !== shapes.length) {
    return `${name} takes ${shapes.length} ${shapes.length === 1 ? 'argument' : 'arguments'} after the report: ${shapes.map((shape) => SHAPES[shape].said).join('; ')}`
  }
  const wrong = shapes.findIndex((shape, index) => !SHAPES[shape].is(args[index]))
  return wrong === -1 ? undefined : `argument ${wrong + 1} of ${name} is not ${SHAPES[shapes[wrong] as Shape].said}`
}

/**
 * The command a descriptor names, bound to its arguments. A descriptor read
 * from JSON was never type-checked, so it is checked here: a name that is
 * not a command gives a command that refuses with `unknown-command`, and
 * arguments too few, too many or of a type the command cannot read give one
 * that refuses with `invalid-arguments`. Either way the descriptor never
 * throws. What the command makes of arguments of the right types reaches
 * the validator, as any edit's result does.
 */
export function describedCommand(descriptor: CommandDescriptor): Command {
  const { command, args } = descriptor as { readonly command: unknown; readonly args: unknown }
  if (typeof command !== 'string' || !Object.hasOwn(COMMANDS, command)) {
    const name = typeof command === 'string' ? quote(command) : 'a command with no name'
    return () => refuse('unknown-command', `${name} is not a command this package has`)
  }
  const name = command as CommandName
  const wrong = misfit(name, args)
  if (wrong !== undefined) return () => refuse('invalid-arguments', wrong)
  const run = COMMANDS[name] as (report: ReportDefinition, ...rest: unknown[]) => CommandOutcome
  return (report) => run(report, ...(args as unknown[]))
}

/**
 * The commands `steps` describe, run one after the other as one command:
 * the report the last leaves, which the session then validates once, as a
 * transaction's end; or the first refusal, word for word, and nothing
 * after it runs. A step is checked as any descriptor is, and one that is
 * no object, or is a batch itself, is refused; so is a batch of more than
 * `MAX_BATCH_COMMANDS` commands, before any runs. Never throws on what a
 * batch read from JSON holds: a step runs on the report the steps before
 * it left, which nothing has validated yet -- a document replaced by one
 * of nothing, a table inserted with no columns -- and a command written
 * for a report the validator accepts may throw on that; such a step is
 * refused, the batch with it.
 */
export function batch(report: ReportDefinition, steps: readonly StepDescriptor[]): CommandOutcome {
  if (steps.length > MAX_BATCH_COMMANDS)
    return refuse('invalid-arguments', `a batch holds at most ${MAX_BATCH_COMMANDS} commands, and this one ${steps.length}`)
  let working = report
  for (const [index, step] of steps.entries()) {
    if (!isObject(step)) return refuse('invalid-arguments', `step ${index + 1} of the batch is not a command: an object naming one, and its arguments`)
    if ((step as { readonly command?: unknown }).command === 'batch')
      return refuse('invalid-arguments', `step ${index + 1} of the batch is a batch: a batch holds commands, and is one edit already`)
    const outcome = stepOn(working, step, index)
    if (!outcome.ok) return outcome
    working = outcome.report
  }
  return { ok: true, report: working }
}

/** `step` run on `working`, or refused where it throws on a report no validator has seen; what it threw is not quoted, since it may quote the report. */
function stepOn(working: ReportDefinition, step: StepDescriptor, index: number): CommandOutcome {
  try {
    return describedCommand(step)(working)
  } catch {
    return refuse('invalid-arguments', `step ${index + 1} of the batch could not run on the report the steps before it left: the batch is refused whole`)
  }
}
