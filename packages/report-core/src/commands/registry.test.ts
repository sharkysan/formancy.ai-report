import type { Inline, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { RefusalCode } from '../outcome.js'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, eInvoiceSample, frozenSample, refused, sampleReport } from '../test-support.js'
import * as components from './components.js'
import * as declarations from './declarations.js'
import * as document from './document.js'
import * as eInvoice from './e-invoice.js'
import * as paymentPart from './payment-part.js'
import * as readers from './readers.js'
import { ARGUMENTS, batch, COMMANDS, describedCommand, PART_COMMANDS } from './registry.js'
import type { CommandDescriptor, CommandName } from './registry.js'
import * as table from './table.js'

/** `report` -- the sample unless another is given -- with a style and an asset nothing uses, so that removing one is an edit the validator accepts. */
function base(report: ReportDefinition = sampleReport()): ReportDefinition {
  return {
    ...report,
    styles: [...report.styles, { id: 'spare', italic: true }],
    assets: [...report.assets, { id: 'spare', mediaType: 'image/png', digest: `sha256:${'cd'.repeat(32)}` }],
  }
}

function open(report?: ReportDefinition): ReportSession {
  const opening = openReportSession(base(report))
  if (!opening.ok) throw new Error('the base report did not open')
  return opening.session
}

const HEADER = sampleReport().datasets.header ?? { id: 'none', fields: [] }
const INVOICE_SAMPLE = eInvoiceSample().eInvoice
if (INVOICE_SAMPLE === undefined) throw new Error('the e-invoice sample has no e-invoice to edit')
const BILL = sampleReport().paymentPart
if (BILL === undefined) throw new Error('the sample has no bill to edit')

/** One literal run. */
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/** One descriptor per command, typed over the names: a command without one does not compile. Each is accepted on `base()`, unless it says what refuses it. */
const EXAMPLES: { readonly [N in CommandName]: { readonly descriptor: Extract<CommandDescriptor, { command: N }>; readonly refusedAs?: RefusalCode } } = {
  setTitle: { descriptor: { command: 'setTitle', args: ['Orders'] } },
  setLocale: { descriptor: { command: 'setLocale', args: ['de-DE'] } },
  // The sample's QR-bill is printed on A4 in portrait, so its page keeps both.
  setPage: { descriptor: { command: 'setPage', args: [{ size: 'A4', margins: { left: 30 } }] } },
  // A paste from another report, whose bill is another: a replacement may change every part of the report's own level.
  replaceDocument: { descriptor: { command: 'replaceDocument', args: [{ ...sampleReport(), title: 'Pasted', paymentPart: { ...BILL, language: 'it' } }] } },
  putStyle: { descriptor: { command: 'putStyle', args: ['airy', { size: 14 }] } },
  removeStyle: { descriptor: { command: 'removeStyle', args: ['spare'] } },
  putDataset: {
    descriptor: {
      command: 'putDataset',
      args: ['header', { ...HEADER, fields: HEADER.fields.map((field) => (field.id === 'customer' ? { ...field, label: 'Client' } : field)) }],
    },
  },
  // The header's fields are printed and drawn, so the validator refuses a report without it.
  removeDataset: { descriptor: { command: 'removeDataset', args: ['header'] }, refusedAs: 'invalid-document' },
  putField: { descriptor: { command: 'putField', args: ['detail', 'note', { type: 'string', label: 'Note', nullable: true }] } },
  removeField: { descriptor: { command: 'removeField', args: ['detail', 'shipped'] } },
  putParameter: { descriptor: { command: 'putParameter', args: ['note', { type: 'string', label: 'Note', required: false }] } },
  removeParameter: { descriptor: { command: 'removeParameter', args: ['copies'] } },
  moveParameter: { descriptor: { command: 'moveParameter', args: ['from', 2] } },
  addAsset: { descriptor: { command: 'addAsset', args: ['stamp', { mediaType: 'image/png', digest: `sha256:${'ef'.repeat(32)}` }] } },
  putAsset: { descriptor: { command: 'putAsset', args: ['stamp', { mediaType: 'image/png', digest: `sha256:${'ef'.repeat(32)}` }] } },
  removeAsset: { descriptor: { command: 'removeAsset', args: ['spare'] } },
  putAggregate: { descriptor: { command: 'putAggregate', args: ['rows', { fn: 'count' }] } },
  removeAggregate: { descriptor: { command: 'removeAggregate', args: ['gross'] } },
  insertComponent: {
    descriptor: {
      command: 'insertComponent',
      args: [
        { region: 'body', parent: 'keep', index: 1 },
        { id: 'added', kind: 'spacer', height: 4 },
      ],
    },
  },
  removeComponent: { descriptor: { command: 'removeComponent', args: ['gap'] } },
  moveComponent: { descriptor: { command: 'moveComponent', args: ['gap', { region: 'reportHeader', parent: 'heading', column: 1, index: 0 }] } },
  // A removal travels as null: JSON has no undefined, and drops a key that holds one.
  updateComponent: { descriptor: { command: 'updateComponent', args: ['intro', 'text', { visibleWhen: null, keepWithNext: true }] } },
  duplicateComponent: { descriptor: { command: 'duplicateComponent', args: ['keep'] } },
  insertColumn: {
    descriptor: { command: 'insertColumn', args: ['lines', 0, { id: 'first', header: 'First', width: 20, align: 'left', value: { kind: 'text', text: '-' } }] },
  },
  removeColumn: { descriptor: { command: 'removeColumn', args: ['lines', 'amount'] } },
  moveColumn: { descriptor: { command: 'moveColumn', args: ['lines', 'sku', 2] } },
  updateColumn: { descriptor: { command: 'updateColumn', args: ['lines', 'shipped-at', { visibleWhen: null, header: 'Sent' }] } },
  setGroup: { descriptor: { command: 'setGroup', args: ['lines', null] } },
  setSort: { descriptor: { command: 'setSort', args: ['lines', null] } },
  insertFooterRow: {
    descriptor: { command: 'insertFooterRow', args: ['lines', 'totals', 0, { cells: [{ column: 'sku', value: { kind: 'text', text: 'Discount' } }] }] },
  },
  removeFooterRow: { descriptor: { command: 'removeFooterRow', args: ['lines', 'totals', 1] } },
  moveFooterRow: { descriptor: { command: 'moveFooterRow', args: ['lines', 'totals', 1, 0] } },
  updateFooterRow: { descriptor: { command: 'updateFooterRow', args: ['lines', 'totals', 1, { style: null }] } },
  putFooterCell: { descriptor: { command: 'putFooterCell', args: ['lines', 'totals', 1, { column: 'qty', value: { kind: 'text', text: '-' } }] } },
  removeFooterCell: { descriptor: { command: 'removeFooterCell', args: ['lines', 'groupFooter', 0, 'qty'] } },
  // The sample's bill with its headings in French, whole; then patched, its message removed and its account SIX's first example's; then taken away.
  putPaymentPart: { descriptor: { command: 'putPaymentPart', args: [{ ...BILL, language: 'fr' }] } },
  updatePaymentPart: {
    descriptor: { command: 'updatePaymentPart', args: [{ message: null, account: [{ kind: 'text', text: 'CH64 3196 1000 0044 2155 7' }] }] },
  },
  removePaymentPart: { descriptor: { command: 'removePaymentPart', args: [] } },
  // The e-invoice sample's e-invoice, put in whole; then patched, its terms
  // given and its paid amount removed; then taken away; and its account
  // changed with every payment code's (0044). The sample is no e-invoice,
  // and its bill asks for francs to a QR-IBAN, which an e-invoice in euro
  // refuses: on it each is refused, and each is an edit made on the billed
  // e-invoice below.
  putEInvoice: { descriptor: { command: 'putEInvoice', args: [INVOICE_SAMPLE] }, refusedAs: 'invalid-document' },
  updateEInvoice: { descriptor: { command: 'updateEInvoice', args: [{ terms: said('Zahlbar binnen 14 Tagen'), paid: null }] }, refusedAs: 'not-found' },
  removeEInvoice: { descriptor: { command: 'removeEInvoice', args: [] }, refusedAs: 'not-found' },
  setPaymentAccount: { descriptor: { command: 'setPaymentAccount', args: ['CH58 0079 1123 0008 8901 2'] }, refusedAs: 'not-found' },
  // The column whose style rule reads whether a line shipped goes with the field.
  removeFieldWithReaders: { descriptor: { command: 'removeFieldWithReaders', args: ['detail', 'shipped'] } },
  // A title and the bill's language as one edit: a batch may hold any command, the bill's own among them.
  batch: {
    descriptor: {
      command: 'batch',
      args: [
        [
          { command: 'setTitle', args: ['Batched'] },
          { command: 'updatePaymentPart', args: [{ language: 'fr' }] },
        ],
      ],
    },
  },
}

const DESCRIPTORS: readonly CommandDescriptor[] = Object.values(EXAMPLES).map(({ descriptor }) => descriptor)

/** Values a descriptor read from JSON may hold where an argument should be: every JSON type, empty and not. */
const JUNK: readonly unknown[] = [
  null,
  0,
  -1,
  1.5,
  '',
  'x',
  true,
  [],
  [null],
  {},
  { region: 'nowhere', index: 0 },
  { region: 'body', parent: 7, index: 0 },
  { region: 'body', column: 'x', index: 0 },
]

describe('COMMANDS', () => {
  // A proposal names commands by name. A command added to a module and not
  // to the registry could be called directly and never proposed; derived
  // from the modules' exports, so the registry cannot fall behind them. The
  // two that name a new component or asset, and `fieldReaders`, which says
  // what reads each field, read a report and change none, so they are no
  // commands. The batch is the registry's own: it runs commands by their
  // descriptors (0048).
  test('holds every command the command modules export, under its own name', () => {
    const modules = { ...document, ...declarations, ...components, ...table, ...paymentPart, ...eInvoice, ...readers, batch }
    const exported = Object.entries(modules)
      .filter(([name, value]) => typeof value === 'function' && !['nextComponentId', 'nextAssetId', 'fieldReaders'].includes(name))
      .map(([name]) => name)
      .sort()
    expect(Object.keys(COMMANDS).sort()).toEqual(exported)
    for (const name of exported) expect(COMMANDS[name as keyof typeof COMMANDS]).toBe(modules[name as 'setTitle'])
  })

  // The commands each part of the report's own level is edited by are
  // named in the registry, once: what the tests below hold to keeping a
  // part is every other command, so a name listed that is no command, or
  // listed twice, would hold nothing.
  test('names, for each part a report holds at its own level, commands it holds', () => {
    for (const [part, names] of Object.entries(PART_COMMANDS)) {
      expect(new Set(names).size, part).toBe(names.length)
      for (const name of names) expect(Object.keys(COMMANDS), `${part}: ${name}`).toContain(name)
    }
  })
})

/**
 * The e-invoice sample with a QR-bill it takes: its payment account
 * (BT-84) one of Switzerland, which a bill can pay, its EPC QR code
 * paying it too, with a Swiss bank's BIC, as an account outside the EEA
 * needs, and the bill in euro to it, as one printed with an e-invoice
 * must be (0022, 0027). On it the commands of either part are edits the
 * validator accepts, so that what keeps the other part is shown by an
 * edit made, not by one refused.
 */
function billedEInvoice(): ReportDefinition {
  const report = eInvoiceSample()
  const invoice = report.eInvoice as NonNullable<ReportDefinition['eInvoice']>
  const account = said('CH93 0076 2011 6238 5295 7')
  const summary = report.regions.summary.map((component) =>
    component.kind === 'epcQrCode' ? { ...component, iban: account, bic: said('POFICHBEXXX') } : component,
  )
  return {
    ...report,
    regions: { ...report.regions, summary },
    eInvoice: { ...invoice, payment: { ...(invoice.payment as NonNullable<typeof invoice.payment>), iban: account } },
    paymentPart: { kind: 'swissQrBill', language: 'de', account, creditor: (BILL as NonNullable<typeof BILL>).creditor, currency: 'EUR' },
  }
}

const BILLED = billedEInvoice()
const INVOICE = BILLED.eInvoice as NonNullable<ReportDefinition['eInvoice']>
const BILLED_BILL = BILLED.paymentPart as NonNullable<ReportDefinition['paymentPart']>

/**
 * The examples as they run on the billed e-invoice, where an example's
 * arguments are another report's or the sample refuses it: the bill's
 * own, in French and patched to French, as its bill takes them; a
 * replacement, that report with another number and another bill's
 * headings; the e-invoice put whole, with another number; and a batch that
 * holds such a replacement. The rest
 * run as written: the e-invoice's patch, its removal and the account the
 * two share, another Swiss account, are edits of it as they stand.
 */
const ON_E_INVOICE: { readonly [N in CommandName]?: Extract<CommandDescriptor, { command: N }> } = {
  replaceDocument: {
    command: 'replaceDocument',
    args: [{ ...BILLED, title: 'Pasted', eInvoice: { ...INVOICE, number: said('RE-2026') }, paymentPart: { ...BILLED_BILL, language: 'it' } }],
  },
  putPaymentPart: { command: 'putPaymentPart', args: [{ ...BILLED_BILL, language: 'fr' }] },
  updatePaymentPart: { command: 'updatePaymentPart', args: [{ language: 'fr' }] },
  putEInvoice: { command: 'putEInvoice', args: [{ ...INVOICE, number: said('RE-2027') }] },
  // A batch that holds a replacement changes what the replacement does (0048).
  batch: {
    command: 'batch',
    args: [
      [
        { command: 'setTitle', args: ['Batched'] },
        { command: 'replaceDocument', args: [{ ...BILLED, eInvoice: { ...INVOICE, number: said('RE-2028') } }] },
      ],
    ],
  },
}

/** Every example as it runs on the billed e-invoice. */
const ON_BILLED: readonly CommandDescriptor[] = DESCRIPTORS.map((descriptor): CommandDescriptor => ON_E_INVOICE[descriptor.command] ?? descriptor)

/** What refuses an example on the billed e-invoice: its lines are printed by the column and from the header the examples remove. */
const REFUSED_ON_BILLED: { readonly [N in CommandName]?: RefusalCode } = {
  removeDataset: 'invalid-document',
  removeColumn: 'invalid-document',
}

/**
 * Each command the registry lists for a part, with the report its example
 * is an edit of: the sample, where the sample accepts it; else the billed
 * e-invoice, where every example is one.
 */
function listedEdits(names: readonly CommandName[]): readonly { readonly descriptor: CommandDescriptor; readonly on: 'sample' | 'billed e-invoice' }[] {
  return DESCRIPTORS.filter((descriptor) => names.includes(descriptor.command)).map((descriptor) =>
    EXAMPLES[descriptor.command].refusedAs === undefined
      ? { descriptor, on: 'sample' }
      : { descriptor: ON_E_INVOICE[descriptor.command] ?? descriptor, on: 'billed e-invoice' },
  )
}

describe('the payment part', () => {
  /** The commands the registry lists as ones that may change the payment part (0039, 0044). */
  const editing: readonly CommandName[] = PART_COMMANDS.paymentPart

  // The commands the registry lists for the payment part -- its own three,
  // the account it shares with an e-invoice, and a replacement of the
  // whole document -- are the only ones that may change it, and no other
  // may drop it: an edit to a title, or to the e-invoice printed with it,
  // that lost the report's QR-bill would send an invoice nobody can pay,
  // and say nothing. Every other command, run on a report that holds one
  // -- the sample, and the billed e-invoice, where the e-invoice's own
  // commands are edits made rather than refused -- leaves the very bill it
  // found. Which ones those are is read from the registry, never typed
  // here, so a command added to edit the bill is held to editing it and
  // no other is let off.
  test.each(DESCRIPTORS.filter((descriptor) => !editing.includes(descriptor.command)))('$command keeps it as it was, on the sample', (descriptor) => {
    const session = open()
    const before = session.document().paymentPart
    expect(before).toBeDefined()
    session.apply(descriptor)
    expect(session.document().paymentPart).toBe(before)
  })

  test.each(ON_BILLED.filter((descriptor) => !editing.includes(descriptor.command)))('$command keeps it as it was, on the billed e-invoice', (descriptor) => {
    const session = open(BILLED)
    const before = session.document().paymentPart
    const outcome = session.apply(descriptor)
    expect(outcome.ok ? 'accepted' : outcome.code).toBe(REFUSED_ON_BILLED[descriptor.command] ?? 'accepted')
    expect(session.document().paymentPart).toBe(before)
  })

  // And each command the registry lists does edit it, as its example
  // shows on the report it is an edit of: one listed that kept the bill
  // would let a command off the tests above for nothing.
  test.each(listedEdits(editing))('$descriptor.command, listed as one that may change it, changes it on the $on', ({ descriptor, on }) => {
    const session = open(on === 'sample' ? undefined : BILLED)
    const before = session.document().paymentPart
    expect(accepted(session.apply(descriptor)).paymentPart).not.toBe(before)
  })
})

describe('the e-invoice', () => {
  /** The commands the registry lists as ones that may change the e-invoice: its own four and a replacement of the whole document (0044). */
  const editing: readonly CommandName[] = PART_COMMANDS.eInvoice

  // None but the commands the registry lists for it -- its put, patch and
  // removal, the account it shares, a replacement of the whole document --
  // may drop or change it: an edit to a title, or to the bill printed with
  // it, that lost the report's e-invoice would render a page whose XML is
  // gone, and say nothing. Every command the registry does not list for
  // it, run on a report that is one and holds a bill, is the edit its
  // example is -- the bill's own put, patched and removed among them --
  // refused only where the e-invoice's lines need what it removes, and
  // leaves the very e-invoice it found.
  test.each(ON_BILLED.filter((descriptor) => !editing.includes(descriptor.command)))('$command keeps it as it was', (descriptor) => {
    const session = open(BILLED)
    const before = session.document().eInvoice
    expect(before).toBeDefined()
    const outcome = session.apply(descriptor)
    expect(outcome.ok ? 'accepted' : outcome.code).toBe(REFUSED_ON_BILLED[descriptor.command] ?? 'accepted')
    expect(session.document().eInvoice).toBe(before)
  })

  // And each command the registry lists for it does change it, as its
  // example shows: the e-invoice's own, the account, and a replacement
  // whose e-invoice is another's.
  test.each(ON_BILLED.filter((descriptor) => editing.includes(descriptor.command)))('$command, listed as one that may change it, changes it', (descriptor) => {
    const session = open(BILLED)
    const before = session.document().eInvoice
    expect(accepted(session.apply(descriptor)).eInvoice).not.toBe(before)
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
    const run = (args: readonly unknown[]): ReturnType<ReturnType<typeof describedCommand>> =>
      describedCommand({ command: descriptor.command, args } as unknown as CommandDescriptor)(report)
    // A command that takes nothing after the report has no fewer to be given.
    if (descriptor.args.length > 0) expect(refused(run([])).code).toBe('invalid-arguments')
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
