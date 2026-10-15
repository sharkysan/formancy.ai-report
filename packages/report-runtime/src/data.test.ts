import { Decimal, decimalToString } from '@formancy/expressions'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { checkData, CONSISTENCY_MODES, MAX_DETAIL_ROWS } from './data.js'
import type { CheckedData, DataCheck, ReportData } from './data.js'
import type { DataError } from './data-errors.js'
import { MAX_DATA_ERRORS } from './data-errors.js'
import { sampleData, sampleReport, sampleRow } from './test-support.js'

/** The checked data, failing the test with the errors when it was refused. */
function checked(outcome: DataCheck): CheckedData {
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return outcome.data
}

/** The errors of a refusal, failing the test when the data was accepted. */
function errors(outcome: DataCheck): readonly DataError[] {
  if (outcome.ok) throw new Error('accepted, and a refusal was expected')
  return outcome.errors
}

/** Each error as its code and path, the two a program reads. */
const where = (list: readonly DataError[]): string[] => list.map((error) => `${error.code} ${error.path}`)

const final = { mode: 'final' } as const
const preview = { mode: 'preview' } as const

/** `data` with its own fields replaced. */
function withData(overrides: Record<string, unknown>, rows?: readonly Record<string, unknown>[]): ReportData {
  return { ...sampleData(rows), ...overrides } as ReportData
}

describe('checkData', () => {
  // Every value is held as the type its contract declares, so that sorting,
  // totalling and formatting never read a string as a number.
  test('reads data the contract describes into typed values', () => {
    const data = checked(checkData(sampleReport(), sampleData(), final))
    const row = data.detail[0]
    expect(row?.quantity).toBe(3n)
    expect(row?.amount).toBeInstanceOf(Decimal)
    expect(decimalToString(row?.amount as Decimal)).toBe('12.50')
    expect(row?.recordedAt).toBe('2026-01-01T08:00:00Z')
    expect(row?.urgent).toBe(false)
    expect(data.header?.reference).toBe(42n)
    expect(data.header?.signature).toBeNull()
    expect(data.consistency).toBe('host-captured')
    expect(data.completeness).toEqual({ complete: true, captured: 1 })
    expect(data.mode).toBe('final')
  })

  // The host keeps its objects: a value changed after the check must not
  // reach a render the check approved.
  test('holds a frozen copy that later changes to the input do not reach', () => {
    const row = sampleRow()
    const input = sampleData([row])
    const data = checked(checkData(sampleReport(), input, final))
    row.sku = 'changed'
    ;(input.header as Record<string, unknown>).customer = 'changed'
    expect(data.detail[0]?.sku).toBe('A-1')
    expect(data.header?.customer).toBe('Muster AG')
    expect(Object.isFrozen(data)).toBe(true)
    expect(Object.isFrozen(data.detail)).toBe(true)
    expect(Object.isFrozen(data.detail[0])).toBe(true)
    expect(Object.isFrozen(data.header)).toBe(true)
  })

  // A field whose id names a property of Object.prototype is read as the
  // record's own, and a record never answers for one it lacks.
  test('holds records that inherit nothing', () => {
    const report = sampleReport()
    const fields = report.datasets.detail?.fields as unknown as { id: string; type: string; label: string; nullable: boolean }[]
    fields.push({ id: 'constructor', type: 'string', label: 'Constructor', nullable: true })
    const data = checked(checkData(report, sampleData([sampleRow({ constructor: 'x' })]), final))
    expect(data.detail[0]?.constructor).toBe('x')
    expect(data.header?.toString).toBeUndefined()
  })

  // A value of the wrong type is refused where it is, with the code that
  // says why, in every mode: a preview of wrong data is wrong too.
  test.each([
    ['amount', 12.5, 'decimal-as-number'],
    ['amount', '12.505', 'decimal-scale'],
    ['quantity', 2 ** 53, 'unsafe-integer'],
    ['quantity', '03', 'invalid-integer'],
    ['shippedAt', '2026-01-01T09:30:00Z', 'invalid-datetime'],
    ['recordedAt', '2026-01-01T08:00:00', 'invalid-instant'],
    ['dueOn', '2026-02-30', 'invalid-date'],
    ['urgent', 'false', 'wrong-type'],
  ])('refuses %s as %j with %s', (field, value, code) => {
    for (const mode of [final, preview]) {
      expect(where(errors(checkData(sampleReport(), sampleData([sampleRow(), sampleRow({ [field]: value })]), mode)))).toEqual([`${code} /detail/1/${field}`])
    }
  })

  // Null is a value only where the contract allows it, and then it is held
  // as null, which prints as nothing.
  test('accepts null where the contract allows it and refuses it elsewhere', () => {
    const data = checked(checkData(sampleReport(), sampleData([sampleRow({ site: null, rate: null })]), final))
    expect(data.detail[0]?.site).toBeNull()
    expect(where(errors(checkData(sampleReport(), sampleData([sampleRow({ sku: null })]), final)))).toEqual(['unexpected-null /detail/0/sku'])
    const header = { ...sampleData().header, customer: null }
    expect(where(errors(checkData(sampleReport(), withData({ header }), final)))).toEqual(['unexpected-null /header/customer'])
  })

  // A field the data lacks altogether is not null: in a final render it is
  // an error, never an empty cell (0007).
  test('refuses a missing field in a final render', () => {
    const row = sampleRow()
    delete row.rate
    const refused = errors(checkData(sampleReport(), sampleData([row]), final))
    expect(where(refused)).toEqual(['missing-field /detail/0/rate'])
  })

  // A preview may run on a sample without every field. It says which are
  // missing, once per field rather than once per row, and leaves them
  // missing -- not null -- so whatever reads one finds it absent.
  test('in a preview, warns once per missing field and leaves it missing, not null', () => {
    const rows = [sampleRow(), sampleRow(), sampleRow()]
    delete rows[1]?.rate
    delete rows[2]?.rate
    const outcome = checkData(sampleReport(), sampleData(rows), preview)
    const data = checked(outcome)
    expect(outcome.ok && where(outcome.warnings)).toEqual(['missing-field /detail/1/rate'])
    expect(outcome.ok && outcome.warnings[0]?.message).toContain('2 of 3 rows')
    expect(Object.hasOwn(data.detail[1] as object, 'rate')).toBe(false)
    expect(data.detail[0]?.rate).toBeInstanceOf(Decimal)
  })

  // Data minimisation: a report never carries what it does not print. A
  // field the contract does not declare is refused rather than carried
  // along into a render, a cache or a log.
  test('refuses a field the contract does not declare, in every mode', () => {
    for (const mode of [final, preview]) {
      const refused = errors(checkData(sampleReport(), sampleData([sampleRow({ salary: '1000.00' })]), mode))
      expect(where(refused)).toEqual(['undeclared-field /detail/0/salary'])
      expect(refused[0]?.message).toContain('never carries what it does not print')
    }
  })

  // A path is built from a key in the data, so it is escaped as RFC 6901
  // says, and a key longer than any field id is never put into one.
  test('escapes keys in paths and never puts a long key into one', () => {
    expect(where(errors(checkData(sampleReport(), sampleData([sampleRow({ 'a/b~c': 1 })]), final)))).toEqual(['undeclared-field /detail/0/a~1b~0c'])
    const long = 'k'.repeat(65)
    const refused = errors(checkData(sampleReport(), sampleData([sampleRow({ [long]: 1 })]), final))
    expect(where(refused)).toEqual(['undeclared-field /detail/0'])
    expect(refused[0]?.message).not.toContain(long)
  })

  // A dataset the report declares and the data lacks is an error in a final
  // render; in a preview it is a warning, and every field of it is missing.
  test('refuses a declared dataset the data lacks, and warns in a preview', () => {
    const { header: _header, ...noHeader } = sampleData()
    expect(where(errors(checkData(sampleReport(), noHeader as ReportData, final)))).toEqual(['missing-dataset /header'])
    const outcome = checkData(sampleReport(), noHeader as ReportData, preview)
    expect(outcome.ok && where(outcome.warnings)).toEqual(['missing-dataset /header'])
    expect(checked(outcome).header).toEqual({})
    const { detail: _detail, ...noDetail } = sampleData([])
    expect(where(errors(checkData(sampleReport(), noDetail as ReportData, final)))).toEqual(['missing-dataset /detail'])
    expect(checked(checkData(sampleReport(), noDetail as ReportData, preview)).detail).toEqual([])
  })

  // Data for a dataset the report does not declare is refused, for the same
  // reason as an undeclared field.
  test('refuses a dataset the report does not declare', () => {
    const report: ReportDefinition = { ...sampleReport(), datasets: {} }
    const refused = errors(checkData(report, { ...sampleData(), completeness: { complete: true, captured: 1 } }, final))
    expect(where(refused)).toEqual(['undeclared-dataset /header', 'undeclared-dataset /detail'])
  })

  // An empty detail list is a dataset with no rows -- the empty state --
  // not a missing one.
  test('accepts a detail dataset with no rows', () => {
    expect(checked(checkData(sampleReport(), sampleData([]), final)).detail).toEqual([])
  })

  // No silent truncation: a final render prints every row or none, so data
  // the provider says is incomplete is refused; a preview may show a sample,
  // and says so.
  test('refuses incomplete data in a final render, and warns in a preview', () => {
    const incomplete = withData({ completeness: { complete: false, captured: 1, cap: 1 } })
    expect(where(errors(checkData(sampleReport(), incomplete, final)))).toEqual(['incomplete /completeness/complete'])
    const outcome = checkData(sampleReport(), incomplete, preview)
    expect(outcome.ok && where(outcome.warnings)).toEqual(['incomplete /completeness/complete'])
  })

  // The count the provider reports is the count it handed over; a
  // disagreement means rows were lost or added on the way, which no render
  // may paper over.
  test('refuses a captured count other than the rows given, or past the cap', () => {
    expect(where(errors(checkData(sampleReport(), withData({ completeness: { complete: true, captured: 2 } }), preview)))).toEqual([
      'completeness-mismatch /completeness/captured',
    ])
    expect(where(errors(checkData(sampleReport(), withData({ completeness: { complete: true, captured: 1, cap: 0 } }), preview)))).toEqual([
      'completeness-mismatch /completeness/cap',
    ])
  })

  // What the provider says about its capture decides whether a final render
  // may print; a statement that cannot be read is refused, never assumed
  // complete.
  test.each([
    ['not an object', 'complete', ''],
    ['no complete', { captured: 1 }, '/complete'],
    ['complete not a boolean', { complete: 'yes', captured: 1 }, '/complete'],
    ['a negative count', { complete: true, captured: -1 }, '/captured'],
    ['a fractional count', { complete: true, captured: 0.5 }, '/captured'],
    ['a cap as a string', { complete: true, captured: 1, cap: '1' }, '/cap'],
    ['an unknown property', { complete: true, captured: 1, sampled: true }, '/sampled'],
  ])('refuses completeness with %s', (_name, completeness, path) => {
    expect(where(errors(checkData(sampleReport(), withData({ completeness }), final)))).toEqual([`invalid-completeness /completeness${path}`])
  })

  // How consistent the capture is travels with the data, so the render can
  // say so; a mode the runtime does not know is refused, not assumed.
  test('accepts each consistency mode and refuses any other', () => {
    for (const consistency of CONSISTENCY_MODES) expect(checked(checkData(sampleReport(), withData({ consistency }), final)).consistency).toBe(consistency)
    expect(where(errors(checkData(sampleReport(), withData({ consistency: 'snapshot' }), final)))).toEqual(['invalid-consistency /consistency'])
    const { consistency: _consistency, ...none } = sampleData()
    expect(where(errors(checkData(sampleReport(), none as ReportData, final)))).toEqual(['invalid-consistency /consistency'])
  })

  // Fail closed: a part of the envelope the runtime does not know is
  // refused, never ignored.
  test('refuses an unknown property of the envelope and anything but an object', () => {
    expect(where(errors(checkData(sampleReport(), withData({ provenance: {} }), final)))).toEqual(['unknown-property /provenance'])
    expect(where(errors(checkData(sampleReport(), [] as unknown as ReportData, final)))).toEqual(['wrong-type '])
  })

  // The row bound is checked before any row is read, so a list of a billion
  // rows costs one comparison.
  test('refuses more than MAX_DETAIL_ROWS rows before reading any', () => {
    const rows = new Array(MAX_DETAIL_ROWS + 1) as Record<string, unknown>[]
    const refused = errors(checkData(sampleReport(), withData({ completeness: { complete: true, captured: rows.length } }, rows), final))
    expect(where(refused)).toEqual(['too-many-rows /detail'])
  })

  // A report without a header or a detail dataset reads none: the checked
  // data has no header, no rows, and a provider that captured no rows.
  test('reads no dataset the report does not declare', () => {
    const { header: _header, ...detailOnly } = sampleReport().datasets
    const report: ReportDefinition = { ...sampleReport(), datasets: detailOnly }
    const { header: _data, ...noHeader } = sampleData()
    expect(checked(checkData(report, noHeader as ReportData, final)).header).toBeUndefined()
    const { detail: _detail, ...headerOnly } = sampleReport().datasets
    const { detail: _rows, ...noDetail } = sampleData([])
    expect(checked(checkData({ ...sampleReport(), datasets: headerOnly }, noDetail as ReportData, final)).detail).toEqual([])
    const counted = { ...noDetail, completeness: { complete: true, captured: 1 } } as ReportData
    expect(where(errors(checkData({ ...sampleReport(), datasets: headerOnly }, counted, final)))).toEqual(['completeness-mismatch /completeness/captured'])
  })

  // In a preview, a header field the data lacks is warned about once, as
  // the header's.
  test('in a preview, warns about a field the header lacks', () => {
    const { currency: _currency, ...header } = sampleData().header as Record<string, unknown>
    const outcome = checkData(sampleReport(), withData({ header }), preview)
    expect(outcome.ok && where(outcome.warnings)).toEqual(['missing-field /header/currency'])
    expect(outcome.ok && outcome.warnings[0]?.message).toContain('the header record')
  })

  // Detail that is not a list is the wrong shape, refused whole.
  test('refuses detail that is not a list', () => {
    expect(where(errors(checkData(sampleReport(), withData({ detail: {} }), final)))).toEqual(['wrong-type /detail'])
  })

  // Rows, records and values that are not data are each refused where they
  // are, and a getter is never run.
  test('refuses what is not data where it is, without running a getter', () => {
    let ran = false
    const getter = {
      ...sampleRow(),
      get amount(): string {
        ran = true
        return '1.00'
      },
    }
    const symbol = { ...sampleRow(), [Symbol('hidden')]: 1 }
    // eslint-disable-next-line no-sparse-arrays
    const rows = [getter, , 'row', symbol] as Record<string, unknown>[]
    const refused = errors(checkData(sampleReport(), withData({ completeness: { complete: true, captured: 4 } }, rows), final))
    expect(where(refused)).toEqual(['not-data /detail/0/amount', 'not-data /detail/1', 'wrong-type /detail/2', 'not-data /detail/3'])
    expect(ran).toBe(false)
  })

  // Errors are bounded, and once the bound is reached nothing more is read:
  // a dataset of junk costs the work of the first errors, not of every row.
  test('lists at most MAX_DATA_ERRORS errors and stops reading after them', () => {
    let read = false
    const watched = new Proxy(sampleRow(), {
      ownKeys: (target) => {
        read = true
        return Reflect.ownKeys(target)
      },
    })
    const rows = [...Array.from({ length: MAX_DATA_ERRORS + 10 }, () => sampleRow({ amount: 1 })), watched]
    const refused = errors(checkData(sampleReport(), sampleData(rows), final))
    expect(refused).toHaveLength(MAX_DATA_ERRORS + 1)
    expect(refused.at(-1)?.code).toBe('too-many-errors')
    expect(read).toBe(false)
  })

  // The data is the customer's: no message and no path repeats a value,
  // whatever is wrong with it.
  test('never repeats a value in a message or a path', () => {
    const secret = 'SECRET-4711'
    const rows = [sampleRow({ amount: secret, quantity: secret, sku: `${secret}\uD800`, dueOn: secret, recordedAt: secret, urgent: secret, extra: secret })]
    const header = { customer: 1, orderedOn: secret, currency: 2, reference: secret, signature: { asset: secret, digest: secret } }
    const refused = errors(checkData(sampleReport(), withData({ header, completeness: { complete: secret, captured: 1 }, consistency: secret }, rows), final))
    expect(refused.length).toBeGreaterThan(10)
    for (const error of refused) {
      expect(error.message).not.toContain('SECRET')
      expect(error.path).not.toContain('SECRET')
    }
  })
})
