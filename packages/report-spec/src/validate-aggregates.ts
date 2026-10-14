/**
 * Aggregates: the totals a report computes over its detail rows, declared
 * once and printed by id, and the rounding each declares.
 */
import type { Findings } from './check.js'
import { all, fieldKey, integer, matches, oneOf, optional, readArray, shape } from './check.js'
import { MAX_AGGREGATES, MAX_SCALE } from './limits.js'
import { at } from './pointer.js'
import { DECIMAL } from './syntax.js'
import { AGGREGATE_FUNCTIONS, ROUNDING_MODES } from './types.js'
import type { AggregateDef, AggregateFunction, FieldType, Rounding } from './types.js'
import { declare } from './validate-context.js'
import type { Ctx } from './validate-context.js'
import { readRowValue } from './validate-inline.js'

const NUMERIC: readonly FieldType[] = ['integer', 'decimal']
const ORDERED: readonly FieldType[] = [...NUMERIC, 'date', 'datetime', 'instant']

/**
 * What each function reads, and what it computes from a value of a type:
 * a count is an integer, an average a decimal, and a sum, minimum or
 * maximum the type it read. Unknown when what it read is an expression.
 */
const FUNCTIONS: { readonly [F in AggregateFunction]: { readonly takes: readonly FieldType[] | 'any'; readonly gives: (of: FieldType | undefined) => FieldType | undefined } } = {
  sum: { takes: NUMERIC, gives: (of) => of },
  avg: { takes: NUMERIC, gives: () => 'decimal' },
  min: { takes: ORDERED, gives: (of) => of },
  max: { takes: ORDERED, gives: (of) => of },
  count: { takes: 'any', gives: () => 'integer' },
}

/** A rounding increment: an exact decimal more than 0, with no more places than `scale`. */
function readIncrement(f: Findings, value: unknown, path: string, scale: number | undefined): string | undefined {
  const increment = matches(f, value, path, DECIMAL, 'invalid-decimal', 'an exact decimal such as "0.05"')
  if (increment === undefined) return undefined
  if (increment.startsWith('-') || /^0(?:\.0+)?$/.test(increment)) {
    f.report(path, 'out-of-range', `an increment of ${increment} rounds to nothing; it must be more than 0`)
    return undefined
  }
  const places = increment.split('.')[1]?.length ?? 0
  if (scale !== undefined && places > scale) {
    f.report(path, 'out-of-range', `an increment of ${increment} has ${places} decimal places, more than the ${scale} this rounding keeps`)
    return undefined
  }
  return increment
}

function readRounding(f: Findings, value: unknown, path: string): Rounding | undefined {
  const o = shape(f, value, path, ['scale', 'mode'], ['increment'])
  const scale = integer(f, o?.scale, at(path, 'scale'), 0, MAX_SCALE)
  const mode = oneOf(f, o?.mode, at(path, 'mode'), ROUNDING_MODES)
  const increment = readIncrement(f, o?.increment, at(path, 'increment'), scale)
  return scale === undefined || mode === undefined ? undefined : { scale, mode, ...optional('increment', increment) }
}

function readAggregate(c: Ctx, value: unknown, path: string): { id: string | undefined; gives: FieldType | undefined; aggregate: AggregateDef | undefined } {
  const o = shape(c.f, value, path, ['id', 'fn'], ['of', 'rounding'])
  const id = fieldKey(c.f, o?.id, at(path, 'id'))
  const fn = oneOf(c.f, o?.fn, at(path, 'fn'), AGGREGATE_FUNCTIONS)
  const of = readRowValue(c, o?.of, at(path, 'of'))
  if (o !== undefined && fn !== undefined && fn !== 'count' && !Object.hasOwn(o, 'of')) {
    c.f.report(at(path, 'of'), 'missing-property', `a ${fn} needs a value from each row; only a count may leave it out, to count rows`)
  }
  const takes = fn && FUNCTIONS[fn].takes
  const mismatch = takes !== undefined && takes !== 'any' && of?.type !== undefined && !takes.includes(of.type)
  if (mismatch) c.f.report(at(at(path, 'of'), 'field'), 'aggregate-type-mismatch', `${fn} takes ${takes.join(', ')} values, and this field is a ${of.type}`)
  const rounding = readRounding(c.f, o?.rounding, at(path, 'rounding'))
  // An exact average is rarely a terminating decimal: 1, 1 and 2 average 1.333...
  if (o !== undefined && fn === 'avg' && !Object.hasOwn(o, 'rounding')) {
    c.f.report(at(path, 'rounding'), 'missing-property', 'an average is rarely exact, so it says how it is rounded')
  }
  // A refused aggregate computes nothing known, so what prints it is not refused again for that.
  const gives = mismatch ? undefined : fn && FUNCTIONS[fn].gives(of?.type)
  if (id === undefined || fn === undefined || (o?.of !== undefined && of === undefined)) return { id, gives, aggregate: undefined }
  return { id, gives, aggregate: { id, fn, ...optional('of', of?.value), ...optional('rounding', rounding) } }
}

export function readAggregates(c: Ctx, value: unknown, path: string): readonly AggregateDef[] | undefined {
  const items = readArray(c.f, value, path, MAX_AGGREGATES)
  if (items === undefined) return undefined
  const read = items.map((item, index) => ({ index, ...readAggregate(c, item, at(path, index)) }))
  c.declared.aggregates = declare(
    c.f,
    read.map(({ id, index, gives }) => ({ id, path: at(at(path, index), 'id'), value: gives })),
    'duplicate-id',
    (duplicate) => `another aggregate is already ${duplicate}`,
  )
  return all(read.map(({ aggregate }) => aggregate))
}
