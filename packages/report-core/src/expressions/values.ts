/**
 * The values one evaluation reads: what the data holds, made into what each
 * member was compiled as. One function, so the type an expression was
 * checked as and the value it is handed cannot disagree.
 *
 * Exact values travel as strings with their type (0007; formancy.ai-data
 * 0008). `@formancy/expressions` converts a value itself only for a variable
 * declared at the top level and never null -- an int from a number, a
 * decimal from a string, a timestamp from a string with a zone -- and a
 * member that may be null is declared `dyn`, which it leaves as it is. So
 * every member is converted here, the same way whether it may be null or
 * not, and upstream finds each already of its type.
 */
import { Decimal, decimalFromString } from '@formancy/expressions'
import type { CompiledExpression, ExpressionRead } from './compile-site.js'

/**
 * The data one evaluation reads, by name and member: `{ row: { amount:
 * '12.50' } }`. Each value as the format writes it -- an integer and a
 * decimal as their exact strings, an instant as an ISO 8601 date-time with
 * its zone, a date and a date-time as their ISO strings, a boolean, a
 * string, null where there is no value -- or already as the CEL value: a
 * bigint, upstream's `Decimal`, a `Date`.
 */
export type ExpressionValues = { readonly [name: string]: Readonly<Record<string, unknown>> | undefined }

/** An ISO 8601 date-time with its zone: one without would be read in the host's zone, which a render on another machine does not share. */
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/

const WHOLE = /^-?\d+$/

/** A refusal that names the member and its type, and never quotes the value: data is the customer's, and never reaches a message. */
function notOf(read: ExpressionRead, what: string): TypeError {
  return new TypeError(`${read.name}.${read.member} is not ${what}`)
}

function asInt(read: ExpressionRead, raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return BigInt(raw)
  if (typeof raw === 'string' && WHOLE.test(raw)) return BigInt(raw)
  throw notOf(read, 'an integer, written as its exact digits')
}

function asDecimal(read: ExpressionRead, raw: unknown): Decimal {
  if (raw instanceof Decimal) return raw
  if (typeof raw === 'string') {
    try {
      return decimalFromString(raw)
    } catch {
      // Rethrown below without upstream's message, which quotes the value.
    }
  }
  throw notOf(read, 'a decimal, written as its exact digits')
}

function asInstant(read: ExpressionRead, raw: unknown): Date {
  const instant = raw instanceof Date ? raw : typeof raw === 'string' && ZONED.test(raw) ? new Date(raw) : undefined
  if (instant === undefined || Number.isNaN(instant.getTime())) throw notOf(read, 'an instant: an ISO 8601 date-time with its zone')
  return instant
}

/** The value `raw` is bound as, for `read`. */
function bound(read: ExpressionRead, raw: unknown): unknown {
  if (raw === null && read.nullable) return null
  switch (read.type) {
    case 'int':
      return asInt(read, raw)
    case 'decimal':
      return asDecimal(read, raw)
    case 'timestamp':
      return asInstant(read, raw)
    case 'string':
      if (typeof raw === 'string') return raw
      throw notOf(read, 'a string')
    case 'bool':
      if (typeof raw === 'boolean') return raw
      throw notOf(read, 'a boolean')
    default:
      // An aggregate over an expression of a type the compiler could not
      // tell: what the runtime computed is handed over as it is.
      if (raw !== undefined && raw !== null) return raw
      throw notOf(read, 'a value')
  }
}

/**
 * The value bag `evaluate` takes for `expression`: each member it reads,
 * under the variable it was compiled with, made into the type it was
 * compiled as.
 *
 * Throws a TypeError for a value the data lacks, null where the member is
 * never null, or a value not of the member's type -- an amount as a
 * JavaScript number, an instant without its zone. The runtime validates a
 * dataset against its contract before any expression reads it, so each is
 * a defect, and is said as one: naming the member, never quoting the value.
 */
export function expressionValues(expression: CompiledExpression, values: ExpressionValues): Record<string, unknown> {
  return Object.fromEntries(expression.reads.map((read) => [read.variable, bound(read, values[read.name]?.[read.member])]))
}
