import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { RefusalCode } from '../outcome.js'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, frozenSample, refused, sampleReport } from '../test-support.js'
import * as components from './components.js'
import * as declarations from './declarations.js'
import * as document from './document.js'
import { ARGUMENTS, COMMANDS, describedCommand } from './registry.js'
import type { CommandDescriptor, CommandName } from './registry.js'
import * as table from './table.js'

/** The sample, with a style and an asset nothing uses, so that removing one is an edit the validator accepts. */
function base(): ReportDefinition {
  const report = sampleReport()
  return {
    ...report,
    styles: [...report.styles, { id: 'spare', italic: true }],
    assets: [...report.assets, { id: 'spare', mediaType: 'image/png', digest: `sha256:${'cd'.repeat(32)}` }],
  }
}

function open(): ReportSession {
  const opening = openReportSession(base())
  if (!opening.ok) throw new Error('the base report did not open')
  return opening.session
}

const HEADER = sampleReport().datasets.header ?? { id: 'none', fields: [] }

/** One descriptor per command, typed over the names: a command without one does not compile. Each is accepted on `base()`, unless it says what refuses it. */
const EXAMPLES: { readonly [N in CommandName]: { readonly descriptor: Extract<CommandDescriptor, { command: N }>; readonly refusedAs?: RefusalCode } } = {
  setTitle: { descriptor: { command: 'setTitle', args: ['Orders'] } },
  setLocale: { descriptor: { command: 'setLocale', args: ['de-DE'] } },
  setPage: { descriptor: { command: 'setPage', args: [{ orientation: 'landscape', margins: { left: 30 } }] } },
  replaceDocument: { descriptor: { command: 'replaceDocument', args: [{ ...sampleReport(), title: 'Pasted' }] } },
  putStyle: { descriptor: { command: 'putStyle', args: ['airy', { size: 14 }] } },
  removeStyle: { descriptor: { command: 'removeStyle', args: ['spare'] } },
  putDataset: { descriptor: { command: 'putDataset', args: ['header', { ...HEADER, fields: HEADER.fields.map((field) => (field.id === 'customer' ? { ...field, label: 'Client' } : field)) }] } },
  // The header's fields are printed and drawn, so the validator refuses a report without it.
  removeDataset: { descriptor: { command: 'removeDataset', args: ['header'] }, refusedAs: 'invalid-document' },
  putField: { descriptor: { command: 'putField', args: ['detail', 'note', { type: 'string', label: 'Note', nullable: true }] } },
  removeField: { descriptor: { command: 'removeField', args: ['detail', 'shipped'] } },
  putParameter: { descriptor: { command: 'putParameter', args: ['note', { type: 'string', label: 'Note', required: false }] } },
  removeParameter: { descriptor: { command: 'removeParameter', args: ['copies'] } },
  moveParameter: { descriptor: { command: 'moveParameter', args: ['from', 2] } },
  putAsset: { descriptor: { command: 'putAsset', args: ['stamp', { mediaType: 'image/png', digest: `sha256:${'ef'.repeat(32)}` }] } },
  removeAsset: { descriptor: { command: 'removeAsset', args: ['spare'] } },
  putAggregate: { descriptor: { command: 'putAggregate', args: ['rows', { fn: 'count' }] } },
  removeAggregate: { descriptor: { command: 'removeAggregate', args: ['gross'] } },
  insertComponent: { descriptor: { command: 'insertComponent', args: [{ region: 'body', parent: 'keep', index: 1 }, { id: 'added', kind: 'spacer', height: 4 }] } },
  removeComponent: { descriptor: { command: 'removeComponent', args: ['gap'] } },
  moveComponent: { descriptor: { command: 'moveComponent', args: ['gap', { region: 'reportHeader', parent: 'heading', column: 1, index: 0 }] } },
  // A removal travels as null: JSON has no undefined, and drops a key that holds one.
  updateComponent: { descriptor: { command: 'updateComponent', args: ['intro', 'text', { visibleWhen: null, keepWithNext: true }] } },
  duplicateComponent: { descriptor: { command: 'duplicateComponent', args: ['keep'] } },
  insertColumn: { descriptor: { command: 'insertColumn', args: ['lines', 0, { id: 'first', header: 'First', width: 20, align: 'left', value: { kind: 'text', text: '-' } }] } },
  removeColumn: { descriptor: { command: 'removeColumn', args: ['lines', 'amount'] } },
  moveColumn: { descriptor: { command: 'moveColumn', args: ['lines', 'sku', 2] } },
  updateColumn: { descriptor: { command: 'updateColumn', args: ['lines', 'shipped-at', { visibleWhen: null, header: 'Sent' }] } },
  setGroup: { descriptor: { command: 'setGroup', args: ['lines', null] } },
  setSort: { descriptor: { command: 'setSort', args: ['lines', null] } },
  insertFooterRow: { descriptor: { command: 'insertFooterRow', args: ['lines', 'totals', 0, { cells: [{ column: 'sku', value: { kind: 'text', text: 'Discount' } }] }] } },
  removeFooterRow: { descriptor: { command: 'removeFooterRow', args: ['lines', 'totals', 1] } },
  moveFooterRow: { descriptor: { command: 'moveFooterRow', args: ['lines', 'totals', 1, 0] } },
  updateFooterRow: { descriptor: { command: 'updateFooterRow', args: ['lines', 'totals', 1, { style: null }] } },
  putFooterCell: { descriptor: { command: 'putFooterCell', args: ['lines', 'totals', 1, { column: 'qty', value: { kind: 'text', text: '-' } }] } },
  removeFooterCell: { descriptor: { command: 'removeFooterCell', args: ['lines', 'groupFooter', 0, 'qty'] } },
}

const DESCRIPTORS: readonly CommandDescriptor[] = Object.values(EXAMPLES).map(({ descriptor }) => descriptor)

/** Values a descriptor read from JSON may hold where an argument should be: every JSON type, empty and not. */
const JUNK: readonly unknown[] = [null, 0, -1, 1.5, '', 'x', true, [], [null], {}, { region: 'nowhere', index: 0 }, { region: 'body', parent: 7, index: 0 }, { region: 'body', column: 'x', index: 0 }]

describe('COMMANDS', () => {
  // A proposal names commands by name. A command added to a module and not
  // to the registry could be called directly and never proposed; derived
  // from the modules' exports, so the registry cannot fall behind them.
  test('holds every command the command modules export, under its own name', () => {
    const exported = Object.entries({ ...document, ...declarations, ...components, ...table })
      .filter(([name, value]) => typeof value === 'function' && name !== 'nextComponentId')
      .map(([name]) => name)
      .sort()
    expect(Object.keys(COMMANDS).sort()).toEqual(exported)
    for (const name of exported) expect(COMMANDS[name as keyof typeof COMMANDS]).toBe({ ...document, ...declarations, ...components, ...table }[name as 'setTitle'])
  })
})

describe('describedCommand', () => {
  // A descriptor is data -- what an AI proposal or a saved macro carries --
  // and runs exactly the command it names, with its arguments.
  test('runs the named command with the given arguments', () => {
    const descriptor: CommandDescriptor = { command: 'moveParameter', args: ['from', 2] }
    expect(accepted(describedCommand(descriptor)(frozenSample()))).toEqual(accepted(declarations.moveParameter(frozenSample(), 'from', 2)))
  })

  // A descriptor read from JSON was never type-checked. A name the registry
  // does not have is refused rather than run; the registry's own prototype
  // is not a command either.
  test.each([
    ['an unknown command', { command: 'dropTable', args: [] }],
    ['a name from the object prototype', { command: 'toString', args: [] }],
    ['a name that is not a string', { command: 42, args: [] }],
  ])('refuses %s', (_name, descriptor) => {
    expect(refused(describedCommand(descriptor as unknown as CommandDescriptor)(frozenSample())).code).toBe('unknown-command')
  })

  // The argument table is written beside the commands, so it could fall
  // behind a signature; the count, at least, is checked against each one.
  test('expects as many arguments as each command takes after the report', () => {
    for (const name of Object.keys(COMMANDS) as CommandName[]) expect(ARGUMENTS[name], name).toHaveLength(COMMANDS[name].length - 1)
  })
})

describe('a descriptor read from JSON', () => {
  // The examples are real edits, so the round trip below compares two
  // commits, not two refusals that happen to agree.
  test.each(DESCRIPTORS)('$command is accepted, or refused as its example says', (descriptor) => {
    const session = open()
    const outcome = session.apply(descriptor)
    const refusedAs = EXAMPLES[descriptor.command].refusedAs
    if (refusedAs !== undefined) expect(refused(outcome).code).toBe(refusedAs)
    else expect([accepted(outcome) === session.document(), session.revision()]).toEqual([true, 1])
  })

  // A proposal arrives as JSON (plan 16), and JSON has no undefined: a
  // removal written as undefined would arrive as a key dropped, or as null
  // in a list, and either do nothing while reporting success or be refused.
  // Read back from JSON, each descriptor does exactly what it did in memory.
  test.each(DESCRIPTORS)('$command does the same read back from JSON', (descriptor) => {
    const direct = open()
    const parsed = open()
    const outcome = direct.apply(descriptor)
    const roundTrip = parsed.apply(JSON.parse(JSON.stringify(descriptor)) as CommandDescriptor)
    expect(roundTrip.ok).toBe(outcome.ok)
    expect(parsed.revision()).toBe(direct.revision())
    expect(parsed.document()).toEqual(direct.document())
  })

  // An untrusted descriptor never throws. A throw would end a proposal
  // applier's loop where a refusal refuses the whole proposal, and an
  // applier that caught it per operation would commit the rest. Too few or
  // too many arguments, or a value of the wrong type in any position, is
  // refused or reaches the validator; the base report is frozen, so a
  // command that wrote to it would throw too.
  test.each(DESCRIPTORS)('$command refuses arguments of the wrong number or shape, never throwing', (descriptor) => {
    const report = frozenSample()
    const run = (args: readonly unknown[]): ReturnType<ReturnType<typeof describedCommand>> => describedCommand({ command: descriptor.command, args } as unknown as CommandDescriptor)(report)
    expect(refused(run([])).code).toBe('invalid-arguments')
    expect(refused(run([...descriptor.args, 'extra'])).code).toBe('invalid-arguments')
    for (const index of descriptor.args.keys()) {
      for (const junk of JUNK) {
        const args = descriptor.args.map((arg: unknown, at: number) => (at === index ? junk : arg))
        expect(() => run(args), `${descriptor.command} with ${JSON.stringify(junk)} at ${index}`).not.toThrow()
      }
    }
  })

  // Arguments that are not a list cannot be counted, and are refused the same way.
  test('refuses arguments that are not a list', () => {
    expect(refused(describedCommand({ command: 'setTitle', args: 'Orders' } as unknown as CommandDescriptor)(frozenSample())).code).toBe('invalid-arguments')
  })
})
