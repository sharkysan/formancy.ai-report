/**
 * The report's aggregates, computed exactly, once, here (0007): over every
 * detail row for `totals`, and over a group's rows for `group`.
 *
 * - **In report-core's order.** An aggregate's expression may read another
 *   aggregate's total, so each is computed after every one it reads, in the
 *   order `compileReport` gives (0009); an aggregate that could never be
 *   computed has already refused the report.
 * - **Each row read once.** What an aggregate reads from a row is read once
 *   per render, with the report's totals, and kept by the row's index; a
 *   group's aggregate is the same function over its rows' values. So a
 *   group's subtotal and the report's total are totals of the same values,
 *   and the subtotals of a sum that declares no rounding add up to the
 *   total. A declared rounding is applied to each group's exact sum and to
 *   the report's, once each, so rounded subtotals need not add up to the
 *   rounded total: two groups of 0.02, rounded to 0.05, print 0.00 and 0.00
 *   over 0.05.
 * - **Exact, and of one kind.** Integers as BigInt, decimals as `Decimal`,
 *   through `decimal.ts`; nothing passes through a JavaScript number. A
 *   total report-core compiled as a decimal is a decimal, its 0 too, and so
 *   is one whose kind the compiler could not tell (`dyn`) once it declares a
 *   rounding or meets a decimal; a group's total is of the report total's
 *   kind, so an expression reading `group.<id>` meets one type.
 * - **Nulls are skipped**, and so is a value a preview's data lacks. Over no
 *   values a count and a sum are 0 and the rest null (0007).
 * - **Declared rounding is applied once**, to the exact result: an average
 *   always declares one, and a sum, a minimum or a maximum of decimals may.
 *   A rounding on a total that is an integer or a moment is refused, never
 *   ignored.
 */
import { compareDecimal, Decimal } from '@formancy/expressions'
import type { AggregateDef, Rounding } from '@formancy/report-spec'
import { averageDecimals, roundDecimalAs, sumDecimals } from './decimal.js'
import type { TypedValue } from './format.js'
import { fieldValue, rowScope, valueOf } from './render-context.js'
import type { AggregateValues, Render, Totals } from './render-context.js'
import type { ResolveErrorCode } from './resolve-errors.js'
import type { OrderedRow } from './sort-group.js'
import { fixedWidth } from './sort-group.js'

/** Why a total has no value: its code and what to say. */
interface Refusal {
  readonly code: ResolveErrorCode
  readonly message: string
}

type Total = TypedValue | null | Refusal

const isRefusal = (value: Total): value is Refusal => value !== null && 'code' in value

const integer = (value: bigint): TypedValue => ({ type: 'integer', value })
const decimal = (value: Decimal): TypedValue => ({ type: 'decimal', value })
const asDecimal = (value: TypedValue): Decimal => (value.type === 'integer' ? new Decimal(value.value, 0) : (value.value as Decimal))

/** How one aggregate is totalled: its definition, whether its numbers are decimals whatever they hold, and the text order. */
interface Totalling {
  readonly aggregate: AggregateDef
  readonly decimals: boolean
  readonly collator: Intl.Collator
}

/** Values as numbers of one kind: integers while every one is and decimals are not asked for, else decimals; undefined when one is not a number. */
function numbers(
  values: readonly TypedValue[],
  decimals: boolean,
): { readonly integers: readonly bigint[] } | { readonly decimals: readonly Decimal[] } | undefined {
  if (!decimals && values.every((value) => value.type === 'integer')) return { integers: values.map((value) => value.value as bigint) }
  if (!values.every((value) => value.type === 'integer' || value.type === 'decimal')) return undefined
  return { decimals: values.map(asDecimal) }
}

const NOT_NUMBERS: Refusal = { code: 'aggregate-value-type', message: 'totals integers and decimals, and a value it read is neither' }

function sum(values: readonly TypedValue[], decimals: boolean): Total {
  const read = numbers(values, decimals)
  if (read === undefined) return NOT_NUMBERS
  return 'integers' in read ? integer(read.integers.reduce((total, value) => total + value, 0n)) : decimal(sumDecimals(read.decimals))
}

function average(values: readonly TypedValue[], rounding: Rounding): Total {
  const read = numbers(values, true) as { readonly decimals: readonly Decimal[] } | undefined
  if (read === undefined) return NOT_NUMBERS
  const result = averageDecimals(read.decimals, rounding)
  return result === null ? null : decimal(result)
}

const ordered = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** -1, 0 or 1 for two values of one kind: numbers by value, text as the report's language sorts it, dates as days, moments in time order. */
function comparator(values: readonly TypedValue[], collator: Intl.Collator): ((a: TypedValue, b: TypedValue) => number) | undefined {
  const types = new Set(values.map(({ type }) => type))
  if ([...types].every((type) => type === 'integer' || type === 'decimal')) return (a, b) => compareDecimal(asDecimal(a), asDecimal(b))
  const only = types.size === 1 ? [...types][0] : undefined
  if (only === 'string') return (a, b) => collator.compare(a.value as string, b.value as string)
  if (only === 'date') return (a, b) => ordered(a.value as string, b.value as string)
  if (only === 'datetime' || only === 'instant') return (a, b) => ordered(fixedWidth(a.value as string), fixedWidth(b.value as string))
  return undefined
}

/** The least (`sign` -1) or greatest (1) value, the first of equals as written; null over none. */
function extreme(values: readonly TypedValue[], sign: -1 | 1, totalling: Totalling): Total {
  const compare = comparator(values, totalling.collator)
  if (compare === undefined)
    return { code: 'aggregate-value-type', message: 'takes the least or greatest of values of one kind, and the values it read are of several' }
  const found = values.reduce<TypedValue | null>((kept, value) => (kept === null || Math.sign(compare(value, kept)) === sign ? value : kept), null)
  return found?.type === 'integer' && totalling.decimals ? decimal(asDecimal(found)) : found
}

/** `total` rounded as `rounding` declares: a decimal at the rounding's scale. */
function rounded(total: Total, rounding: Rounding | undefined): Total {
  if (rounding === undefined || total === null || isRefusal(total)) return total
  if (total.type === 'decimal') return decimal(roundDecimalAs(total.value, rounding))
  return {
    code: 'rounding-not-decimal',
    message: `declares a rounding, and its total is ${total.type === 'integer' ? 'an integer' : `a ${total.type}`}, which has no places to round`,
  }
}

/** The aggregate over the values read from some rows -- each null or typed -- or over `rows` rows when it reads nothing. */
function reduce(totalling: Totalling, read: readonly (TypedValue | null)[] | undefined, rows: number): Total {
  const { aggregate, decimals } = totalling
  const values = (read ?? []).filter((value): value is TypedValue => value !== null)
  switch (aggregate.fn) {
    case 'count':
      return integer(BigInt(read === undefined ? rows : values.length))
    case 'avg':
      // report-spec requires an average to declare its rounding.
      return values.length === 0 ? null : average(values, aggregate.rounding as Rounding)
    case 'sum':
      return rounded(sum(values, decimals), aggregate.rounding)
    case 'min':
      return rounded(extreme(values, -1, totalling), aggregate.rounding)
    case 'max':
      return rounded(extreme(values, 1, totalling), aggregate.rounding)
  }
}

/**
 * Every aggregate of `render`'s report, over its detail rows and, through
 * `over`, over any of them; or undefined when one could not be computed,
 * each reason recorded. `render` has every input but the totals.
 */
export function computeTotals(render: Omit<Render, 'totals'>): Totals | undefined {
  const { report, expressions, data, problems } = render
  const collator = new Intl.Collator(report.locale, { usage: 'sort' })
  const rows: readonly OrderedRow[] = data.detail.map((record, index) => ({ index, record }))
  const read = new Map<string, readonly (TypedValue | null)[]>()
  const totals = new Map<string, TypedValue | null>()
  const totallings = new Map<string, Totalling>()
  const refuse = (index: number, refusal: Refusal): void => {
    problems.error({
      stage: 'resolve',
      code: refusal.code,
      path: `/aggregates/${index}`,
      message: `aggregate ${report.aggregates[index]?.id} ${refusal.message}`,
    })
  }
  let computed = true

  for (const id of expressions.compilation.aggregateOrder) {
    const index = report.aggregates.findIndex((aggregate) => aggregate.id === id)
    const aggregate = report.aggregates[index] as AggregateDef
    const compiled = expressions.compilation.members.totals.get(id)?.type
    const decimals = compiled === 'decimal' || (compiled === 'dyn' && aggregate.rounding !== undefined)
    const of = aggregate.of
    if (of !== undefined) {
      const path = `/aggregates/${index}/of/expression/cel`
      const values = rows.map((row) => (of.kind === 'field' ? fieldValue(render, row.record, of.field) : valueOf(render, rowScope(render, totals, row), path)))
      if (values.some((value) => value === undefined)) {
        computed = false
        continue
      }
      read.set(id, values as (TypedValue | null)[])
    }
    const totalling: Totalling = { aggregate, decimals, collator }
    const total = reduce(totalling, read.get(id), rows.length)
    if (isRefusal(total)) {
      computed = false
      refuse(index, total)
      continue
    }
    totals.set(id, total)
    // A group's total is of its report total's kind: one that met a decimal is a decimal in every group.
    totallings.set(id, total?.type === 'decimal' ? { ...totalling, decimals: true } : totalling)
  }
  if (!computed) return undefined

  return {
    report: totals,
    over(group: readonly OrderedRow[]): AggregateValues {
      const values = new Map<string, TypedValue | null>()
      for (const aggregate of report.aggregates) {
        const each = read.get(aggregate.id)
        // Never refused: a group's values are some of those the report's
        // total took, of the kinds it took, totalled as the same kind and
        // rounded as it was. Every refusal `reduce` has is about the kinds
        // of values, and a share of values has no kind the whole lacks.
        values.set(
          aggregate.id,
          reduce(
            totallings.get(aggregate.id) as Totalling,
            each && group.map((row) => each[row.index] as TypedValue | null),
            group.length,
          ) as TypedValue | null,
        )
      }
      return values
    },
  }
}
