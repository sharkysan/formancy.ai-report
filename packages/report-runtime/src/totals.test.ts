import { emptyReport } from '@formancy/report-spec'
import type { AggregateDef, FieldRef, ReportDefinition, RowValue } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Table } from './document.js'
import { resolveReport } from './resolve.js'
import type { RuntimeError } from './resolve-errors.js'
import { below, seeded } from './test-support.js'

const detail = (field: string): FieldRef => ({ dataset: 'detail', field })
const expression = (cel: string): RowValue => ({ kind: 'expression', expression: { cel } })

const AGGREGATES: readonly AggregateDef[] = [
  { id: 'rows', fn: 'count' },
  { id: 'rated', fn: 'count', of: { kind: 'field', field: detail('rate') } },
  { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
  { id: 'quantities', fn: 'sum', of: { kind: 'field', field: detail('quantity') } },
  { id: 'rates', fn: 'sum', of: { kind: 'field', field: detail('rate') } },
  { id: 'mean', fn: 'avg', of: { kind: 'field', field: detail('amount') }, rounding: { scale: 2, mode: 'half-even' } },
  { id: 'cash', fn: 'sum', of: expression('row.amount * dec("1.081")'), rounding: { scale: 2, mode: 'half-away-from-zero', increment: '0.05' } },
  { id: 'share', fn: 'sum', of: expression('divide(row.amount * dec("100"), totals.subtotal, 4)') },
  { id: 'least', fn: 'min', of: { kind: 'field', field: detail('amount') } },
  { id: 'earliest', fn: 'min', of: { kind: 'field', field: detail('dueOn') } },
  { id: 'latest', fn: 'max', of: { kind: 'field', field: detail('shippedAt') } },
  { id: 'recorded', fn: 'max', of: { kind: 'field', field: detail('recordedAt') } },
  // report-spec takes a minimum of no text field; one of an expression giving text is report-core's to allow (0009).
  { id: 'first', fn: 'min', of: expression('row.label') },
]

/** A report that prints every aggregate in `aggregates`, each as one paragraph of its own, in order; `share` is declared first, so it must wait for `subtotal`. */
function report(aggregates: readonly AggregateDef[] = AGGREGATES): ReportDefinition {
  const ordered = [...aggregates].sort((a, b) => (a.id === 'share' ? -1 : b.id === 'share' ? 1 : 0))
  return {
    ...emptyReport('totals', 'Totals', 'en'),
    datasets: {
      detail: {
        id: 'lines',
        fields: [
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
          { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
          { id: 'rate', type: 'decimal', label: 'Rate', nullable: true, scale: 3 },
          { id: 'dueOn', type: 'date', label: 'Due on', nullable: true },
          { id: 'shippedAt', type: 'datetime', label: 'Shipped at', nullable: true },
          { id: 'recordedAt', type: 'instant', label: 'Recorded', nullable: false },
          { id: 'label', type: 'string', label: 'Label', nullable: false },
          { id: 'pieces', type: 'integer', label: 'Pieces', nullable: true },
        ],
      },
    },
    aggregates: ordered,
    regions: {
      reportHeader: [],
      pageHeader: [],
      body: aggregates.map(({ id }) => ({ id: `print-${id}`, kind: 'text' as const, content: [{ kind: 'aggregate' as const, aggregate: id, over: 'report' as const }] })),
      pageFooter: [],
      summary: [],
    },
  }
}

interface Line {
  amount: string
  quantity?: string
  rate?: string | null
  dueOn?: string | null
  shippedAt?: string | null
  recordedAt?: string
  label?: string
  pieces?: string | null
}

const line = (amount: string, extra: Partial<Line> = {}): Record<string, unknown> => ({
  amount,
  quantity: '1',
  rate: null,
  dueOn: null,
  shippedAt: null,
  recordedAt: '2026-01-01T00:00:00Z',
  label: 'x',
  pieces: null,
  ...extra,
})

type Outcome = { readonly ok: true; readonly printed: Readonly<Record<string, string>> } | { readonly ok: false; readonly errors: readonly RuntimeError[] }

function totals(rows: readonly Record<string, unknown>[], definition: ReportDefinition = report()): Outcome {
  const outcome = resolveReport(definition, { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' }, { mode: 'final', creationDate: '2026-10-15T08:00:00Z' })
  if (!outcome.ok) return outcome
  const printed = Object.fromEntries(
    outcome.document.body.map((block, index) => [definition.regions.body[index]?.id.replace('print-', ''), block.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : '')).join('') : '']),
  )
  return { ok: true, printed }
}

function printed(rows: readonly Record<string, unknown>[], definition?: ReportDefinition): Readonly<Record<string, string>> {
  const outcome = totals(rows, definition)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.printed
}

/** Cents as the decimal string they are: 1234n as '12.34', -5n as '-0.05'. */
function cents(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

/** `numerator / denominator` rounded to a whole number, ties as `mode` says: the reference, written apart from `decimal.ts`. */
function divided(numerator: bigint, denominator: bigint, mode: 'even' | 'away'): bigint {
  const negative = numerator < 0n !== denominator < 0n
  const [n, d] = [numerator < 0n ? -numerator : numerator, denominator < 0n ? -denominator : denominator]
  let quotient = n / d
  const twice = 2n * (n % d)
  if (twice > d || (twice === d && (mode === 'away' || quotient % 2n === 1n))) quotient += 1n
  return negative ? -quotient : quotient
}

describe('totals', () => {
  // The quotation's arithmetic, against a reference in plain BigInt: a sum
  // to the cent, an average rounded once, half to even, and a gross total
  // rounded to the nearest 0.05, half away from zero -- over amounts that
  // a double would get wrong, positive and negative.
  test('are exact, rounded once as each declares, over many rows', () => {
    const next = seeded(20261015)
    for (let run = 0; run < 20; run++) {
      const amounts = Array.from({ length: 1 + below(next, 60) }, () => BigInt(below(next, 2_000_000)) - 400_000n)
      const shown = printed(amounts.map((amount) => line(cents(amount))))
      const sum = amounts.reduce((total, amount) => total + amount, 0n)
      // Each amount times 1.081 is in hundred-thousandths; a step of 0.05 is 5,000 of them.
      const gross = amounts.reduce((total, amount) => total + amount * 1081n, 0n)
      expect(shown['subtotal']).toBe(cents(sum))
      expect(shown['mean']).toBe(cents(divided(sum, BigInt(amounts.length), 'even')))
      expect(shown['cash']).toBe(cents(divided(gross, 5000n, 'away') * 5n))
      expect(shown['rows']).toBe(String(amounts.length))
    }
  })

  // A value of 0.1 + 0.2 kind: exact, not 0.30000000000000004.
  test('add decimals without passing through a float', () => {
    expect(printed([line('0.10'), line('0.20')])['subtotal']).toBe('0.30')
  })

  // Nulls are not values: a count of a field counts the rows that have
  // one, and a sum skips the rest (0007).
  test('skip nulls', () => {
    const shown = printed([line('1.00', { rate: '0.081' }), line('2.00'), line('3.00', { rate: '0.019' })])
    expect([shown['rows'], shown['rated'], shown['rates']]).toEqual(['3', '2', '0.100'])
  })

  // Over no values a count and a sum are 0, and a minimum, a maximum and an
  // average have none, which prints as nothing (0007).
  test('over no rows: count and sum 0, the rest nothing', () => {
    const shown = printed([])
    expect(shown).toMatchObject({ rows: '0', rated: '0', subtotal: '0', quantities: '0', mean: '', least: '', earliest: '', latest: '' })
    // A sum with a declared rounding is a decimal's 0, at the rounding's scale.
    expect(shown['cash']).toBe('0.00')
  })

  // A sum of integers stays an integer however large, never a double.
  test('sum integers as integers', () => {
    expect(printed([line('1.00', { quantity: '9007199254740993' }), line('1.00', { quantity: '2' })])['quantities']).toBe('9007199254740995')
  })

  // A minimum or a maximum is of its kind: amounts by value, dates as days,
  // times with their fractions in time order, instants as moments -- not as
  // strings, by which '09:30:00.5Z' would sort before '09:30:00Z', the same
  // moment as 10:30 at +01:00 -- and text as the report's language sorts it,
  // Ä before b, where its code would put it after.
  test('take the least and the greatest of each kind in its own order', () => {
    const shown = printed([
      line('10.00', { dueOn: '2026-02-01', shippedAt: '2026-01-01T10:00:00', recordedAt: '2026-01-01T10:30:00+01:00', label: 'b' }),
      line('9.50', { dueOn: '2026-01-31', shippedAt: '2026-01-01T10:00:00.5', recordedAt: '2026-01-01T09:30:00.5Z', label: 'Ä' }),
      line('-0.01', { dueOn: null, shippedAt: null, recordedAt: '2026-01-01T09:00:00Z', label: 'c' }),
    ])
    expect([shown['least'], shown['earliest'], shown['latest'], shown['recorded'], shown['first']]).toEqual(['-0.01', '2026-01-31', '2026-01-01T10:00:00.5', '2026-01-01T09:30:00.5Z', 'Ä'])
  })

  // A share of the whole reads the whole: it is computed after the total
  // it reads, though it is declared before it, and the shares add up.
  test('compute an aggregate after the totals its expression reads', () => {
    expect(printed([line('25.00'), line('75.00')])['share']).toBe('100.0000')
  })

  // A total that cannot be read from a row is no total: the evaluation's
  // error refuses the report, naming the aggregate and the row.
  test('refuse an aggregate whose expression fails for a row', () => {
    const failing: AggregateDef = { id: 'failing', fn: 'sum', of: expression('divide(row.amount, row.amount, 2)') }
    const outcome = totals([line('1.00'), line('0')], report([failing]))
    expect(!outcome.ok && outcome.errors).toEqual([expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', aggregateId: 'failing', row: 1 })])
  })

  // A rounding on a total that has no places is a mistake in the report,
  // and refused, never silently ignored: by the editor's diagnostics, before
  // any data is read, where the compiler knows the total's type.
  test.each([
    ['an integer', { id: 'quantities', fn: 'sum', of: { kind: 'field', field: detail('quantity') }, rounding: { scale: 0, mode: 'half-even', increment: '5' } }],
    ['a date', { id: 'earliest', fn: 'min', of: { kind: 'field', field: detail('dueOn') }, rounding: { scale: 0, mode: 'half-even' } }],
  ] as const)('refuse a declared rounding on a total that is %s', (_name, rounded) => {
    const outcome = totals([line('1.00', { dueOn: '2026-01-31' })], report([rounded]))
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)).toEqual(['expressions rounding-not-decimal /aggregates/0/rounding'])
  })

  // Where only the data says what the total is -- a date that may be null
  // is read as dyn (0009) -- the rounding is refused once the total turns
  // out to be a date, never ignored.
  test('refuse a declared rounding on a total the data shows to be a date', () => {
    const rounded: AggregateDef = { id: 'earliest', fn: 'min', of: expression('row.dueOn'), rounding: { scale: 0, mode: 'half-even' } }
    const outcome = totals([line('1.00', { dueOn: '2026-01-31' })], report([rounded]))
    expect(!outcome.ok && outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)).toEqual(['resolve rounding-not-decimal /aggregates/0'])
  })
})

describe('totals the compiler could not type', () => {
  // A value that may be null is checked as dyn (0009), so an expression
  // choosing between two of them can give a number in one row and text in
  // another. Such a total is refused where it is declared, never computed
  // from the rows that happen to be numbers.
  test.each(['sum', 'avg', 'min'] as const)('refuse a %s over values of several kinds', (fn) => {
    const rounding = fn === 'avg' ? { rounding: { scale: 2, mode: 'half-even' as const } } : {}
    const mixed: AggregateDef = { id: 'mixed', fn, of: expression('row.rate != null ? row.rate : row.label'), ...rounding }
    const outcome = totals([line('1.00', { rate: '0.500' }), line('1.00')], report([mixed]))
    expect(!outcome.ok && outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)).toEqual(['resolve aggregate-value-type /aggregates/0'])
  })

  // A total that met a decimal is a decimal in every group too, even one
  // whose rows all held integers: an expression reading group.<id> meets
  // one type, and adding a decimal to it works in every group.
  test('are decimals in every group once the report total met one', () => {
    const mixed: AggregateDef = { id: 'mixed', fn: 'sum', of: expression('row.rate != null ? row.rate : row.pieces') }
    const definition = report([mixed])
    const grouped: ReportDefinition = {
      ...definition,
      regions: {
        ...definition.regions,
        body: [
          {
            id: 'lines',
            kind: 'table',
            dataset: 'detail',
            columns: [{ id: 'label', header: 'Label', width: 'fill', align: 'left', value: { kind: 'field', field: detail('label') } }],
            group: {
              by: detail('label'),
              direction: 'asc',
              header: [{ kind: 'expression', expression: { cel: 'string(group.mixed + dec("0.000"))' } }],
              footer: [],
            },
            totals: [{ cells: [{ column: 'label', value: { kind: 'aggregate', aggregate: 'mixed', over: 'report' } }] }],
            emptyText: 'None',
            repeatHeader: true,
          },
        ],
      },
    }
    const rows = [line('1.00', { label: 'a', rate: '0.500' }), line('1.00', { label: 'b', pieces: '2' }), line('1.00', { label: 'b', pieces: '3' })]
    const outcome = resolveReport(grouped, { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' }, { mode: 'final', creationDate: '2026-10-15T08:00:00Z' })
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; '))
    const table = outcome.document.body[0] as Table
    expect(table.rows.filter((row) => row.kind !== 'detail').map((row) => row.cells[0])).toEqual(['0.500', '5.000', '5.500'])
  })
})

/** A table over `aggregate`, grouped by label, printing it in each group's footer and in its total row; the footers' cells and the total's. */
function groupedTotals(aggregate: AggregateDef, rows: readonly Record<string, unknown>[]): { readonly subtotals: readonly string[]; readonly total: string } {
  const definition = report([aggregate])
  const grouped: ReportDefinition = {
    ...definition,
    regions: {
      ...definition.regions,
      body: [
        {
          id: 'lines',
          kind: 'table',
          dataset: 'detail',
          columns: [{ id: 'amount', header: 'Amount', width: 'fill', align: 'right', value: { kind: 'field', field: detail('amount') } }],
          group: { by: detail('label'), direction: 'asc', header: [{ kind: 'field', field: detail('label') }], footer: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: aggregate.id, over: 'group' } }] }] },
          totals: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: aggregate.id, over: 'report' } }] }],
          emptyText: 'None',
          repeatHeader: true,
        },
      ],
    },
  }
  const outcome = resolveReport(grouped, { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' }, { mode: 'final', creationDate: '2026-10-15T08:00:00Z' })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => error.message).join('; '))
  const table = outcome.document.body[0] as Table
  return { subtotals: table.rows.filter((row) => row.kind === 'groupFooter').map((row) => row.cells[0] as string), total: table.rows.at(-1)?.cells[0] as string }
}

describe('group totals', () => {
  // A sum that declares a rounding is rounded once per group and once for
  // the report, each from its exact sum: two groups of 0.02, rounded to
  // 0.05, print 0.00 and 0.00 over a total of 0.05. Rounding the total
  // from the printed subtotals instead would print 0.00 for 0.04 of
  // amounts; the subtotals add up only when no rounding is declared.
  test('round each subtotal and the total once, from their exact sums', () => {
    const cash: AggregateDef = { id: 'cash', fn: 'sum', of: { kind: 'field', field: detail('amount') }, rounding: { scale: 2, mode: 'half-away-from-zero', increment: '0.05' } }
    expect(groupedTotals(cash, [line('0.02', { label: 'x' }), line('0.02', { label: 'y' })])).toEqual({ subtotals: ['0.00', '0.00'], total: '0.05' })
  })

  // A subtotal is the same function over a group's rows as the total over
  // all of them, so the subtotals of a sum that declares no rounding add up
  // to the total, whatever the order the provider sent the rows in.
  test('add up to the report total', () => {
    const next = seeded(15102026)
    const sites = ['Bern', 'Thun', 'Biel', 'Chur']
    const rows = Array.from({ length: 80 }, () => line(cents(BigInt(below(next, 100_000))), { label: sites[below(next, sites.length)] as string }))
    const { subtotals, total } = groupedTotals(AGGREGATES[2] as AggregateDef, rows)
    const toCents = (text: string): bigint => BigInt(text.replace('.', ''))
    expect(subtotals).toHaveLength(sites.length)
    expect(subtotals.reduce((sum, each) => sum + toCents(each), 0n)).toBe(toCents(total))
    expect(toCents(total)).toBe(rows.reduce((sum, row) => sum + toCents(row.amount as string), 0n))
  })
})
