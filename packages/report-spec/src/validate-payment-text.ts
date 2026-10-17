/**
 * The texts a payment code holds, read one way for every code -- a
 * QR-bill's, an EPC QR code's: runs, one at least, read as a paragraph's
 * in the report's scope and encoded in the code; and, when every run is
 * literal, the text they make held to the code's own rule where it is
 * written.
 *
 * A text of literal runs prints the same in every render, so its code's
 * rule is applied to it here; any other is checked by the runtime with the
 * same rule, once the data has resolved it.
 */
import { readArray } from './check.js'
import type { ReportErrorCode } from './errors.js'
import { MAX_INLINES } from './limits.js'
import type { PaymentCheck } from './payment-reference.js'
import { at } from './pointer.js'
import type { Inline } from './types.js'
import type { Ctx } from './validate-context.js'
import { readInlines } from './validate-inline.js'
import type { InlineScope } from './validate-inline.js'

/** Where a payment code's runs are read: in the report's scope, encoded in the code it names. */
export type PaymentScope = InlineScope & { readonly reads: 'report'; readonly encoded: 'a QR-bill' | 'an EPC QR code' }

/** The text runs make when every one is literal; undefined when any is read from data, or there are none, which is refused as too few. */
export function literal(runs: readonly Inline[]): string | undefined {
  if (runs.length === 0) return undefined
  let text = ''
  for (const run of runs) {
    if (run.kind !== 'text') return undefined
    text += run.text
  }
  return text
}

/**
 * A string where a code expects runs, a run or an address, refused as the
 * wrong type without the quote the shared readers give a string they find:
 * written out, it is an IBAN, a name or a street, which may be a person's.
 */
export function unquoted(c: Ctx, path: string, expected: string, scope: PaymentScope): undefined {
  c.f.report(path, 'wrong-type', `expected ${expected}, found a string, which is not quoted: what ${scope.encoded} holds may be a person's`)
  return undefined
}

/** The runs at `path`, one at least, read as a paragraph's are; a string in their place, or in a run's, refused unquoted. */
function readRuns(c: Ctx, value: unknown, path: string, scope: PaymentScope): readonly Inline[] | undefined {
  const items = typeof value === 'string' ? unquoted(c, path, 'an array', scope) : readArray(c.f, value, path, MAX_INLINES)
  const strings = items?.flatMap((item, index) => (typeof item === 'string' ? [index] : [])) ?? []
  for (const index of strings) unquoted(c, at(path, index), 'an object', scope)
  return items === undefined || strings.length > 0 ? undefined : readInlines(c, items, path, scope, 1)
}

/** A text of a code: its runs, and what its rule made of them when they are literal and it accepted them. */
export interface PaymentText<T> {
  readonly runs: readonly Inline[] | undefined
  readonly checked: T | undefined
}

/**
 * The runs at `path`, one at least, and the rule `check` applied to them
 * when they are literal, refused as `code`, `what` breaking it. Absent,
 * nothing is said: whether it may be is the shape's question.
 */
export function readPaymentText<T>(c: Ctx, value: unknown, path: string, scope: PaymentScope, code: ReportErrorCode, what: string, check: (text: string) => PaymentCheck<T>): PaymentText<T> {
  const runs = readRuns(c, value, path, scope)
  const text = runs && literal(runs)
  if (text === undefined) return { runs, checked: undefined }
  const outcome = check(text)
  if (!outcome.ok) c.f.report(path, code, `${what} ${outcome.rule}`)
  return { runs, checked: outcome.ok ? outcome.value : undefined }
}
