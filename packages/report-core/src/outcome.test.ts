import { describe, expect, test } from 'vitest'
import { insertComponent, moveComponent, removeComponent, updateComponent } from './commands/components.js'
import { addAsset, removeStyle } from './commands/declarations.js'
import { setPaymentAccount } from './commands/e-invoice.js'
import { removeFieldWithReaders } from './commands/readers.js'
import { describedCommand } from './commands/registry.js'
import type { CommandDescriptor } from './commands/registry.js'
import { updateColumn } from './commands/table.js'
import { REFUSAL_CODES } from './outcome.js'
import type { Command, CommandOutcome, RefusalCode } from './outcome.js'
import { openReportSession } from './session.js'
import { eInvoiceSample, frozen, frozenSample, refused, sampleReport } from './test-support.js'

const spacer = { id: 'added', kind: 'spacer', height: 4 } as const

/** A command applied by a session on the sample, for the refusals only a session gives. */
function inSession(command: Command, expectedHash?: string): CommandOutcome {
  const opening = openReportSession(sampleReport())
  if (!opening.ok) throw new Error('the sample did not open')
  return opening.session.apply(command, expectedHash === undefined ? {} : { expectedHash })
}

/**
 * One edit per refusal code that is refused with it. A builder maps each
 * code to what it says and where; a code no edit gives, or a new one with
 * no case, would be a message nobody sees or a refusal nobody handles.
 * Typed over the codes: a code without a case does not compile.
 */
const CASES: { readonly [C in RefusalCode]: () => CommandOutcome } = {
  'not-found': () => removeComponent(frozenSample(), 'nowhere'),
  'not-a-container': () => insertComponent(frozenSample(), { region: 'body', parent: 'intro', index: 0 }, spacer),
  'invalid-location': () => insertComponent(frozenSample(), { region: 'body', column: 0, index: 0 }, spacer),
  'index-out-of-range': () => insertComponent(frozenSample(), { region: 'body', index: 99 }, spacer),
  'into-itself': () => moveComponent(frozenSample(), 'keep', { region: 'body', parent: 'keep', index: 0 }),
  'kind-mismatch': () => updateComponent(frozenSample(), 'gap', 'text', {}),
  'immutable-property': () => updateColumn(frozenSample(), 'lines', 'sku', { id: 'other' } as never),
  'already-declared': () => addAsset(frozenSample(), 'logo', { mediaType: 'image/png', digest: `sha256:${'cd'.repeat(32)}` }),
  'unknown-command': () => describedCommand({ command: 'dropTable', args: [] } as unknown as CommandDescriptor)(frozenSample()),
  'invalid-arguments': () => describedCommand({ command: 'setTitle', args: [] } as unknown as CommandDescriptor)(frozenSample()),
  'invalid-document': () => inSession((report) => removeStyle(report, 'title')),
  'stale-document': () => inSession((report) => removeComponent(report, 'gap'), '0'.repeat(64)),
  'read-from-data': () => {
    const report = eInvoiceSample()
    const bound = {
      ...report,
      eInvoice: {
        ...(report.eInvoice as NonNullable<typeof report.eInvoice>),
        payment: { means: '58', iban: [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }] },
      },
    } as typeof report
    return setPaymentAccount(frozen(bound), 'DE89 3704 0044 0532 0130 00')
  },
  // The QR-bill's debtor is the customer: only the bill's own commands change what it reads.
  'read-by-part': () => removeFieldWithReaders(frozenSample(), 'header', 'customer'),
}

describe('REFUSAL_CODES', () => {
  test.each(REFUSAL_CODES)('%s is given, by the edit its case makes', (code) => {
    expect(refused(CASES[code]()).code).toBe(code)
  })
})
