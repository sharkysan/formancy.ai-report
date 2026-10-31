import { describe, expect, test } from 'vitest'
import { edited, refusals, removeAt, setAt } from './test-support.js'

/** A FieldRef to a detail field. */
const detail = (field: string) => ({ dataset: 'detail', field })

/** The fixture's detail fields by type, one of each. */
const DETAIL_BY_TYPE = {
  string: 'site',
  integer: 'quantity',
  decimal: 'amount',
  boolean: 'shipped',
  date: 'dueOn',
  datetime: 'shippedAt',
  instant: 'recordedAt',
  image: 'photo',
} as const

const NUMERIC = ['integer', 'decimal']
const TEMPORAL = ['date', 'datetime', 'instant']

describe('formats against what they format', () => {
  // A format is checked against the type of what it formats: numbers and
  // currencies over integers and decimals, dates over the three temporal
  // types, text over anything that prints. An image prints only as an
  // image, so a cell that shows one is refused for that, whatever its
  // format.
  test('each format kind over every field type, in a cell', () => {
    const formats = {
      number: { kind: 'number', scale: 2, grouping: true },
      currency: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
      date: { kind: 'date', style: 'short' },
      text: { kind: 'text', transform: 'lower' },
    }
    const fits: Record<string, readonly string[]> = { number: NUMERIC, currency: NUMERIC, date: TEMPORAL }
    const at = '/regions/body/2/columns/0/value'
    for (const [kind, format] of Object.entries(formats)) {
      for (const [type, field] of Object.entries(DETAIL_BY_TYPE)) {
        const report = edited((r) => setAt(r, at, { kind: 'field', field: detail(field), format }))
        const expected =
          type === 'image' ? [`binding-type-mismatch ${at}/field`] : (fits[kind]?.includes(type) ?? true) ? [] : [`format-type-mismatch ${at}/format`]
        expect(refusals(report), `${kind} over ${type}`).toEqual(expected)
      }
    }
  })

  // The same check over a parameter and over an aggregate, whose type is
  // what it computes: a count is an integer, an average a decimal, and a
  // sum, minimum or maximum the type of its field. An expression's type is
  // known only once the runtime compiles it, so its format is not checked.
  test('formats over parameters, aggregates and expressions', () => {
    const number = { kind: 'number', scale: 0, grouping: false }
    const date = { kind: 'date', style: 'long' }
    expect(refusals(edited((r) => setAt(r, '/regions/summary/0/components/0/content/0/format', date)))).toEqual([
      'format-type-mismatch /regions/summary/0/components/0/content/0/format',
    ])
    const aggregate = (id: string, format: unknown) =>
      edited((r) => setAt(r, '/regions/summary/0/components/1/content/0', { kind: 'aggregate', aggregate: id, over: 'report', format }))
    for (const id of ['lines', 'average', 'subtotal']) expect(refusals(aggregate(id, number)), id).toEqual([])
    for (const id of ['latest', 'earliest']) {
      expect(refusals(aggregate(id, date)), id).toEqual([])
      expect(refusals(aggregate(id, number)), id).toEqual(['format-type-mismatch /regions/summary/0/components/1/content/0/format'])
    }
    expect(refusals(aggregate('lines', date))).toEqual(['format-type-mismatch /regions/summary/0/components/1/content/0/format'])
    expect(refusals(aggregate('gross', date))).toEqual([])
    expect(refusals(edited((r) => setAt(r, '/regions/body/0/content/2/format', date)))).toEqual([])
  })
})

describe('aggregates against what they aggregate', () => {
  // A sum or an average is arithmetic; a minimum or a maximum is an order,
  // which dates and instants have too ("last inspected per site"); a count
  // counts anything, photos and flags included.
  test('each function over every field type', () => {
    const takes: Record<string, readonly string[] | 'any'> = {
      sum: NUMERIC,
      avg: NUMERIC,
      min: [...NUMERIC, ...TEMPORAL],
      max: [...NUMERIC, ...TEMPORAL],
      count: 'any',
    }
    for (const [fn, types] of Object.entries(takes)) {
      for (const [type, field] of Object.entries(DETAIL_BY_TYPE)) {
        const aggregate = { id: 'probe', fn, of: { kind: 'field', field: detail(field) }, rounding: { scale: 2, mode: 'half-even' } }
        const report = edited((r) => setAt(r, '/aggregates/6', aggregate))
        const fits = types === 'any' || types.includes(type)
        expect(refusals(report), `${fn} over ${type}`).toEqual(fits ? [] : ['aggregate-type-mismatch /aggregates/6/of/field'])
      }
    }
  })

  // An exact average is rarely a terminating decimal -- 1, 1 and 2 average
  // 1.333... -- so an average declares where it is rounded rather than
  // leaving it to whatever precision the runtime happens to use.
  test('an average declares its rounding', () => {
    expect(refusals(edited((r) => removeAt(r, '/aggregates/3/rounding')))).toEqual(['missing-property /aggregates/3/rounding'])
    expect(refusals(edited((r) => removeAt(r, '/aggregates/0/rounding')))).toEqual([])
  })

  // A count without anything to count counts rows; every other function
  // needs a value from each row.
  test('only a count may leave out what it reads', () => {
    expect(refusals(edited((r) => removeAt(r, '/aggregates/0/of')))).toEqual(['missing-property /aggregates/0/of'])
    expect(refusals(edited((r) => setAt(r, '/aggregates/1/of', { kind: 'field', field: detail('shippedAt') })))).toEqual([])
  })

  // An aggregate reads the detail rows. A header field has one value per
  // report, so totalling it is a mistake the format refuses.
  test('reads detail fields only', () => {
    expect(refusals(edited((r) => setAt(r, '/aggregates/0/of/field', { dataset: 'header', field: 'customer' })))).toEqual([
      'not-one-of /aggregates/0/of/field/dataset',
    ])
  })

  // An increment is what Swiss cash rounding needs: 0.05. It is an exact
  // decimal more than 0, with no more places than the scale prints.
  test('a rounding increment is a positive decimal within the scale', () => {
    const increment = (value: string, scale = 2) => edited((r) => setAt(r, '/aggregates/2/rounding', { scale, mode: 'half-away-from-zero', increment: value }))
    for (const value of ['0.05', '0.5', '1', '10', '0.01']) expect(refusals(increment(value)), value).toEqual([])
    for (const value of ['0', '0.00', '-0.05', '0.005']) expect(refusals(increment(value)), value).toEqual(['out-of-range /aggregates/2/rounding/increment'])
    expect(refusals(increment('0.005', 3))).toEqual([])
    for (const value of ['1e-2', '.05', '0,05', '-0']) expect(refusals(increment(value)), value).toEqual(['invalid-decimal /aggregates/2/rounding/increment'])
  })
})

describe('currencies and images from the data', () => {
  // A currency may come from the data, per report or per row, or from a
  // parameter. A code is a string; a number or a date read as one would
  // print as a currency nobody has.
  test('a currency field or parameter is a string', () => {
    const at = '/regions/body/2/columns/2/value/format/currency'
    expect(refusals(edited((r) => setAt(r, `${at}/field`, { dataset: 'header', field: 'orderedOn' })))).toEqual([`binding-type-mismatch ${at}/field`])
    expect(refusals(edited((r) => setAt(r, at, { kind: 'parameter', parameter: 'currency' })))).toEqual([])
    expect(refusals(edited((r) => setAt(r, at, { kind: 'parameter', parameter: 'threshold' })))).toEqual([`binding-type-mismatch ${at}/parameter`])
    expect(refusals(edited((r) => setAt(r, at, { kind: 'parameter', parameter: 'missing' })))).toEqual([`unknown-parameter ${at}/parameter`])
  })

  // A photo or a signature captured with a form is an image field: drawn
  // by an image, never printed as text, sorted or grouped by. An image of
  // a field that is not an image has nothing to draw.
  test('an image field is drawn, and only an image field is', () => {
    expect(refusals(edited((r) => setAt(r, '/regions/body/0/content/1/field/field', 'signature')))).toEqual([
      'binding-type-mismatch /regions/body/0/content/1/field',
    ])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/sort/0/field/field', 'photo')))).toEqual(['binding-type-mismatch /regions/body/2/sort/0/field'])
    const groupByPhoto = edited((r) => {
      setAt(r, '/regions/body/2/group/by/field', 'photo')
      setAt(r, '/regions/body/2/group/header', [{ kind: 'text', text: 'Photo' }])
    })
    expect(refusals(groupByPhoto)).toEqual(['binding-type-mismatch /regions/body/2/group/by'])
    expect(refusals(edited((r) => setAt(r, '/regions/summary/0/components/2/source/field/field', 'orderedOn')))).toEqual([
      'binding-type-mismatch /regions/summary/0/components/2/source/field',
    ])
  })
})

describe('sorting and grouping', () => {
  // Rows are ordered by the group's key first, so a sort key on that field,
  // or a field sorted by twice, orders nothing; a reader of the sort keys
  // would think it did.
  test('no field is sorted by twice, or sorted by and grouped by', () => {
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/sort/1', { field: detail('sku'), direction: 'asc' })))).toEqual([
      'duplicate-sort-key /regions/body/2/sort/1/field',
    ])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/sort/0/field/field', 'site')))).toEqual(['duplicate-sort-key /regions/body/2/sort/0/field'])
    const ungrouped = edited((r) => {
      removeAt(r, '/regions/body/2/group')
      setAt(r, '/regions/body/2/sort/1', { field: detail('site'), direction: 'asc' })
    })
    expect(refusals(ungrouped)).toEqual([])
  })

  // A sort key and a group key are detail fields: a header field has one
  // value for every row, so ordering by it orders nothing.
  test('sort and group keys are detail fields', () => {
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/sort/0/field/dataset', 'header')))).toEqual(['not-one-of /regions/body/2/sort/0/field/dataset'])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/group/by/dataset', 'header')))).toEqual(['not-one-of /regions/body/2/group/by/dataset'])
  })

  // When the field grouped by is not one the dataset has, that is the one
  // error: the group's header is not then refused field by field for
  // naming a detail field that is not the unknown one.
  test('an unknown group key is reported once', () => {
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/group/by/field', 'warehouse')))).toEqual(['unknown-field /regions/body/2/group/by/field'])
  })
})
