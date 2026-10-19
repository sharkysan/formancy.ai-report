/**
 * Every command by name, and a command as data: a name and its arguments.
 *
 * A proposal -- from an AI, from a saved macro, from another window -- is a
 * bounded list of operations, not code (plan 16). A descriptor is one such
 * operation, and it runs through exactly the function the builder calls, so
 * a proposal and a click cannot do the same thing two ways.
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

export const COMMANDS = Object.freeze({
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
})

export type CommandName = keyof typeof COMMANDS

/** A command's arguments after the report. */
type ArgumentsOf<F> = F extends (report: ReportDefinition, ...rest: infer A) => unknown ? A : never

/** A command as data: its name and its arguments after the report, typed per command. */
export type CommandDescriptor = {
  readonly [N in CommandName]: { readonly command: N; readonly args: Readonly<ArgumentsOf<(typeof COMMANDS)[N]>> }
}[CommandName]

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
