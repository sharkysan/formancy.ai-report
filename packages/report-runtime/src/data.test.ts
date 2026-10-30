import { Decimal, decimalToString } from '@formancy/expressions'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { checkData, CONSISTENCY_MODES, MAX_DETAIL_ROWS } from './data.js'
import { isSubmissionId } from './source.js'
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

/** The schemaHash of two versions of a form, as formancy writes one, and two submissions' ids, as formancy's server makes them. */
const VERSION_1 = '767a65b36d4c02adf432d91ccdf7f8f285eebdbfc2987fb08fecd846b721dc42'
const VERSION_2 = 'd8cc5753df5172bcbaadc0d008086218262ca11896ae860c27b976933be012cb'
const FIRST = 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380'
const SECOND = '8861b39c-51df-4cc0-b71e-63a6d3f16b1b'

/** A submission of the site visit's first version; `more` replaces or adds what it names. */
const submission = (more: Record<string, unknown> = {}): Record<string, unknown> => ({ id: FIRST, form: 'site-visit', formHash: VERSION_1, ...more })
/** A formancy form's source: each submission with the form and the version that collected it. */
const formSource = (submissions: readonly unknown[] = [submission()], more: Record<string, unknown> = {}): Record<string, unknown> => ({
  provider: 'formancy-form',
  submissions,
  ...more,
})
/** Formancy Data's source: the published form each of the sample report's datasets was read from. */
const dataSource = (forms: Record<string, unknown> = { header: 'order', detail: 'order-line' }): Record<string, unknown> => ({
  provider: 'formancy-data',
  forms,
})
/** `count` detail rows, as a report of that many submissions reads them, one a row. */
const rows = (count: number): Record<string, unknown>[] => Array.from({ length: count }, (_, index) => sampleRow({ sku: `A-${String(index + 1)}` }))

describe('checkData: where the data came from', () => {
  // A render's manifest names the form version and the submissions its data
  // came from (0041): a PDF kept for years is traced to what collected it
  // only if the source travels with the data and is held as it was given,
  // whatever the host does with its objects afterwards. formancy lets a new
  // version change the form's id -- `diffSchemas` calls it lossy, not
  // breaking -- so each submission names its own version's form id: one
  // id for the whole source would misname one version's submissions.
  test('holds a formancy form source, each submission with its form and version, as a frozen copy', () => {
    const submissions = [submission(), submission({ id: SECOND, form: 'site-visit-2026', formHash: VERSION_2 })]
    const given = formSource(submissions)
    const data = checked(checkData(sampleReport(), withData({ source: given }, rows(2)), final))
    expect(data.source).toEqual({ provider: 'formancy-form', submissions })
    ;(submissions[0] as { id: string }).id = 'changed'
    given['submissions'] = []
    expect(data.source).toEqual({ provider: 'formancy-form', submissions: [submission(), { id: SECOND, form: 'site-visit-2026', formHash: VERSION_2 }] })
    const source = data.source as { submissions: readonly object[] }
    expect([Object.isFrozen(data.source), Object.isFrozen(source.submissions), Object.isFrozen(source.submissions[0])]).toEqual([true, true, true])
  })

  // Formancy Data's provider names the published forms it read, by the
  // dataset each filled; data a host captured itself names no source, and
  // the checked data says none rather than invent one.
  test('holds a Formancy Data source by dataset, and no source where the data names none', () => {
    const data = checked(checkData(sampleReport(), withData({ source: dataSource() }), final))
    expect(data.source).toEqual({ provider: 'formancy-data', forms: { header: 'order', detail: 'order-line' } })
    expect(Object.isFrozen((data.source as { forms: object }).forms)).toBe(true)
    expect(Object.hasOwn(checked(checkData(sampleReport(), sampleData(), final)), 'source')).toBe(false)
  })

  // A source names identifiers and nothing else (0041). An answer -- a
  // name, an email address, the submission's own data -- would ride into
  // every manifest kept beside a PDF, which data minimisation keeps out of
  // the data itself; a provider the runtime does not know is refused, not
  // read as one it does (fail closed). A key the shape does not name is
  // refused where it stands, by its container's path: the key may be the
  // answer.
  test.each([
    ['a submission id holding a space', formSource([submission({ id: 'Erika Mustermann' })]), '/source/submissions/0/id'],
    ['an email address for a submission id', formSource([submission({ id: 'erika@example.ch' })]), '/source/submissions/0/id'],
    ['a submission id holding a slash', formSource([submission({ id: 'visit/7' })]), '/source/submissions/0/id'],
    ['a submission id holding a colon', formSource([submission({ id: `urn:uuid:${FIRST}` })]), '/source/submissions/0/id'],
    ['a submission id beyond ASCII', formSource([submission({ id: 'zürich-7' })]), '/source/submissions/0/id'],
    ['a submission id as a number', formSource([submission({ id: 4711 })]), '/source/submissions/0/id'],
    ['a submission carrying its answers', formSource([submission({ answers: { name: 'Erika' } })]), '/source/submissions/0'],
    ['a version hash in capitals', formSource([submission({ formHash: VERSION_1.toUpperCase() })]), '/source/submissions/0/formHash'],
    ['a version hash with a prefix', formSource([submission({ formHash: `sha256:${VERSION_1}` })]), '/source/submissions/0/formHash'],
    ['a submission with no version', formSource([{ id: FIRST, form: 'site-visit' }]), '/source/submissions/0/formHash'],
    ['a submission whose form id is not one', formSource([submission({ form: 'Site visit' })]), '/source/submissions/0/form'],
    ['a submission with no form', formSource([{ id: FIRST, formHash: VERSION_1 }]), '/source/submissions/0/form'],
    ['a submission that is not an object', formSource([FIRST]), '/source/submissions/0'],
    ['a form source with no submission', formSource([]), '/source/submissions'],
    ['a form source carrying data', formSource(undefined, { data: { name: 'Erika' } }), '/source'],
    ['a form source naming one form for every submission', formSource(undefined, { form: 'site-visit' }), '/source'],
    ['a Data source naming a record', { ...dataSource(), record: 'o-1' }, '/source'],
    ['a Data form id that is not one', dataSource({ header: 'the orders', detail: 'order-line' }), '/source/forms/header'],
    ['a Data source naming a form for no dataset', dataSource({ header: 'order', detail: 'order-line', lines: 'order-line' }), '/source/forms'],
    ['a Data source whose forms are not an object', { provider: 'formancy-data', forms: 'order' }, '/source/forms'],
    ['a provider the runtime does not know', { provider: 'host', forms: {} }, '/source/provider'],
    ['no provider', { submissions: [submission()] }, '/source/provider'],
    ['a source that is not an object', 'formancy-form', '/source'],
  ])('refuses %s', (_name, source, path) => {
    for (const mode of [final, preview]) expect(where(errors(checkData(sampleReport(), withData({ source }), mode)))).toEqual([`invalid-source ${path}`])
  })

  // What the syntax cannot see, said as 0041's cost: a single word, a
  // personal number or an IBAN fits a submission's id, a file name a form's,
  // and any 64 hex digits a version's hash, a digest of an email address
  // among them. Were the syntax narrowed, the limitation would overstate
  // the cost, and this case says so.
  test('accepts what fits the syntax, whatever it means', () => {
    const ids = ['Mustermann', '756.1234.5678.97', 'CH9300762011623852957', 'erika.mustermann-example.ch']
    const source = formSource(
      ids.map((id, index) => submission({ id, form: index === 0 ? 'Lohnausweis_Mustermann_2026.pdf' : 'site-visit', formHash: 'f'.repeat(64) })),
    )
    expect(checked(checkData(sampleReport(), withData({ source }, rows(ids.length)), final)).source).toEqual(source)
  })

  // The form bridge names each submission by the id the host hands it,
  // and refuses one by `isSubmissionId` before it reads an answer (0042).
  // Were that another reading than this check's, a submission the bridge
  // read whole would be refused when it renders, or one it refused would be
  // accepted here.
  test('isSubmissionId accepts what a source accepts as a submission id, and nothing else', () => {
    const ids = [
      FIRST,
      'Mustermann',
      '756.1234.5678.97',
      '7',
      'a'.repeat(128),
      'a'.repeat(129),
      'Erika Mustermann',
      'erika@example.ch',
      'visit/7',
      'zürich-7',
      '-7',
      '.7',
      '_x',
      '',
      4711,
      null,
    ]
    for (const id of ids) {
      const accepted = checkData(sampleReport(), withData({ source: formSource([submission({ id })]) }), final).ok
      expect(isSubmissionId(id), String(id)).toBe(accepted)
    }
  })

  // A Data source says which form each dataset was read from; one that
  // names a form for a dataset the report does not declare, or none for one
  // it does, or no form at all, says something of the render that is not so.
  test('refuses a Data source whose forms are not the datasets the report declares', () => {
    const { detail: _detail, ...headerOnly } = sampleReport().datasets
    const { detail: _rows, ...noDetail } = sampleData([])
    const letter = { ...sampleReport(), datasets: headerOnly }
    const lettered = (source: unknown): ReportData => ({ ...noDetail, completeness: { complete: true, captured: 0 }, source }) as unknown as ReportData
    expect(checked(checkData(letter, lettered(dataSource({ header: 'order' })), final)).source).toEqual({
      provider: 'formancy-data',
      forms: { header: 'order' },
    })
    expect(where(errors(checkData(letter, lettered(dataSource()), final)))).toEqual(['invalid-source /source/forms/detail'])
    expect(where(errors(checkData(sampleReport(), withData({ source: dataSource({ header: 'order' }) }), final)))).toEqual(['invalid-source /source/forms'])
    expect(where(errors(checkData(sampleReport(), withData({ source: dataSource({}) }), final)))).toEqual(['invalid-source /source/forms'])
    const blank = { ...sampleReport(), datasets: {} }
    const nothing = { completeness: { complete: true, captured: 0 }, consistency: 'host-captured', source: dataSource({}) } as unknown as ReportData
    expect(where(errors(checkData(blank, nothing, final)))).toEqual(['invalid-source /source/forms'])
  })

  // Bounded before it is read, as the rows are: no id longer than a form's
  // may be (128 characters), and no more submissions than the data gives
  // detail rows, or one where it gives none -- a report of one submission
  // reads its repeater's rows, a report of many one a row -- so never more
  // than MAX_DETAIL_ROWS. A source naming more says something of the render
  // that is not so, and its list costs one comparison, whatever it holds.
  test('refuses a source too long or too many for its rows before reading past the bound', () => {
    const long = 'a'.repeat(129)
    expect(where(errors(checkData(sampleReport(), withData({ source: formSource([submission({ id: long })]) }), final)))).toEqual([
      'invalid-source /source/submissions/0/id',
    ])
    expect(where(errors(checkData(sampleReport(), withData({ source: formSource([submission({ form: long })]) }), final)))).toEqual([
      'invalid-source /source/submissions/0/form',
    ])
    expect(where(errors(checkData(sampleReport(), withData({ source: dataSource({ header: long, detail: 'order-line' }) }), final)))).toEqual([
      'invalid-source /source/forms/header',
    ])
    const at = 'a'.repeat(128)
    expect(checked(checkData(sampleReport(), withData({ source: formSource([submission({ id: at, form: at })]) }), final)).source).toBeDefined()
    const two = formSource([submission(), submission({ id: SECOND })])
    expect(where(errors(checkData(sampleReport(), withData({ source: two }), final)))).toEqual(['invalid-source /source/submissions'])
    expect(checked(checkData(sampleReport(), withData({ source: two }, rows(2)), final)).source).toEqual(two)
    expect(checked(checkData(sampleReport(), withData({ source: formSource() }, []), final)).source).toEqual(formSource())
    const { detail: _detail, ...headerOnly } = sampleReport().datasets
    const { detail: _rows, ...noDetail } = sampleData([])
    const letter = { ...sampleReport(), datasets: headerOnly }
    expect(where(errors(checkData(letter, { ...noDetail, source: two } as unknown as ReportData, final)))).toEqual(['invalid-source /source/submissions'])
    expect(checked(checkData(letter, { ...noDetail, source: formSource() } as unknown as ReportData, final)).source).toEqual(formSource())
    // A sparse list of one past the rows: read item by item, its holes would be errors.
    expect(where(errors(checkData(sampleReport(), withData({ source: formSource(new Array(3)) }, rows(2)), final)))).toEqual([
      'invalid-source /source/submissions',
    ])
    // Rows that cannot be counted are the rows' error, never the source's.
    expect(where(errors(checkData(sampleReport(), withData({ detail: 'rows', source: two }), final)))).toEqual(['wrong-type /detail'])
  })

  // The source is read as the data is, once and without running anything:
  // a getter could answer the check one id and the manifest another. What
  // is not data is said once, where it stands, and never again as a value
  // the source lacks.
  test('refuses what is not data in a source, once, without running a getter', () => {
    let ran = false
    const getter = (value: unknown): PropertyDescriptor => ({
      enumerable: true,
      get: () => {
        ran = true
        return value
      },
    })
    const hiddenId = Object.defineProperty({ form: 'site-visit', formHash: VERSION_1 }, 'id', getter(FIRST))
    // eslint-disable-next-line no-sparse-arrays
    const refused = errors(
      checkData(sampleReport(), withData({ source: formSource([hiddenId, , submission({ id: SECOND, formHash: VERSION_2 })]) }, rows(3)), final),
    )
    expect(where(refused)).toEqual(['not-data /source/submissions/0/id', 'not-data /source/submissions/1'])
    const hiddenForm = Object.defineProperty({ id: FIRST, formHash: VERSION_1 }, 'form', getter('site-visit'))
    expect(where(errors(checkData(sampleReport(), withData({ source: formSource([hiddenForm]) }), final)))).toEqual(['not-data /source/submissions/0/form'])
    const hiddenSubmissions = Object.defineProperty({ provider: 'formancy-form' }, 'submissions', getter([submission()]))
    expect(where(errors(checkData(sampleReport(), withData({ source: hiddenSubmissions }), final)))).toEqual(['not-data /source/submissions'])
    const hiddenForms = Object.defineProperty({ provider: 'formancy-data' }, 'forms', getter({ header: 'order', detail: 'order-line' }))
    expect(where(errors(checkData(sampleReport(), withData({ source: hiddenForms }), final)))).toEqual(['not-data /source/forms'])
    const hiddenHeader = dataSource(Object.defineProperty({ detail: 'order-line' }, 'header', getter('order')))
    expect(where(errors(checkData(sampleReport(), withData({ source: hiddenHeader }), final)))).toEqual(['not-data /source/forms/header'])
    const unlisted = Object.defineProperty({ provider: 'formancy-form' }, 'submissions', { value: [submission()], enumerable: false })
    expect(where(errors(checkData(sampleReport(), withData({ source: unlisted }), final)))).toEqual(['not-data /source/submissions'])
    // A provider behind a getter is not read as any provider; a symbol key
    // and an object that throws when read are not data either.
    const hiddenProvider = Object.defineProperty({ forms: { header: 'order', detail: 'order-line' } }, 'provider', getter('formancy-data'))
    expect(where(errors(checkData(sampleReport(), withData({ source: hiddenProvider }), final)))).toEqual(['not-data /source/provider'])
    expect(ran).toBe(false)
    expect(where(errors(checkData(sampleReport(), withData({ source: { ...dataSource(), [Symbol('hidden')]: 1 } }), final)))).toEqual(['not-data /source'])
    const throwing = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('read')
        },
      },
    )
    expect(where(errors(checkData(sampleReport(), withData({ source: throwing }), final)))).toEqual(['not-data /source'])
    const throwingList = new Proxy([], {
      getOwnPropertyDescriptor: () => {
        throw new Error('read')
      },
    })
    expect(where(errors(checkData(sampleReport(), withData({ source: formSource(throwingList) }), final)))).toEqual(['not-data /source/submissions'])
  })

  // Errors are bounded, and once the bound is reached nothing more of the
  // source is read: a source of junk costs the work of the first errors,
  // not of every submission.
  test('lists at most MAX_DATA_ERRORS errors of a source and stops reading after them', () => {
    let read = false
    const watched = new Proxy(submission({ id: SECOND, formHash: VERSION_2 }), {
      ownKeys: (target) => {
        read = true
        return Reflect.ownKeys(target)
      },
    })
    const junk = Array.from({ length: MAX_DATA_ERRORS + 10 }, (_, index) => submission({ id: `${String(index)} ` }))
    const refused = errors(checkData(sampleReport(), withData({ source: formSource([...junk, watched]) }, rows(junk.length + 1)), final))
    expect(refused).toHaveLength(MAX_DATA_ERRORS + 1)
    expect(refused.at(-1)?.code).toBe('too-many-errors')
    expect(read).toBe(false)
  })

  // "Each submission's id" names each once: one named twice is a host that
  // paired its data with something other than what it says it read.
  test('refuses a submission named twice', () => {
    const twice = formSource([submission(), submission({ formHash: VERSION_2 })])
    expect(where(errors(checkData(sampleReport(), withData({ source: twice }, rows(2)), final)))).toEqual(['invalid-source /source/submissions/1/id'])
  })

  // A source that breaks its rules may be holding an answer, so its
  // refusal is the one place it must not reappear: no message and no path
  // holds a value of it, nor a key the shape does not name, whatever is
  // wrong.
  test('never repeats a value or an unknown key of a source in a message or a path', () => {
    const secret = 'SECRET 4711'
    const hiddenKey = Object.defineProperty(submission(), secret, { enumerable: true, get: () => secret })
    const sources = [
      formSource([{ id: secret, form: secret, formHash: secret, answers: secret }, submission({ id: secret })], { form: secret, data: secret }),
      formSource([{ ...submission(), [secret]: 1 }, hiddenKey], { [secret]: 1 }),
      { provider: secret, forms: { header: secret } },
      dataSource({ header: secret, detail: [secret], [secret]: 'order' }),
      { ...dataSource(), [secret]: 'order' },
      { provider: 'formancy-form', submissions: secret },
    ]
    for (const source of sources) {
      const refused = errors(checkData(sampleReport(), withData({ source }, rows(2)), final))
      expect(refused.length).toBeGreaterThan(0)
      for (const error of refused) expect(`${error.path} ${error.message}`).not.toContain('SECRET')
    }
  })
})
