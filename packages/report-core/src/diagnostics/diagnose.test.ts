import { emptyReport, validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { thawed } from '../snapshot.js'
import type { Mutable } from '../snapshot.js'
import { sampleReport, setAt } from '../test-support.js'
import { DIAGNOSTIC_CODES, DIAGNOSTIC_SEVERITIES } from './codes.js'
import type { Diagnostic, DiagnosticCode } from './codes.js'
import { diagnose } from './diagnose.js'

type Edit = (report: Mutable<ReportDefinition>) => void

const set =
  (pointer: string, value: unknown): Edit =>
  (report) =>
    setAt(report, pointer, value)

const INTRO_WHEN = '/regions/body/0/visibleWhen/cel'
const INTRO_VALUE = '/regions/body/0/content/2/expression/cel'
const CLOSING_WHEN = '/regions/summary/0/visibleWhen/cel'
const TOTAL_VALUE = '/regions/body/2/totals/1/cells/1/value/expression/cel'
const AMOUNT_WHEN = '/regions/body/2/columns/3/styleWhen/0/when/cel'
const GROSS = '/aggregates/2/of/expression/cel'

/** The sample, edited, and checked still valid: diagnostics are about valid reports. */
function edited(...edits: Edit[]): ReportDefinition {
  const report = thawed(sampleReport())
  for (const edit of edits) edit(report)
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the edit made the sample invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

/** One break of the sample, and the one diagnostic it gives. */
interface Case {
  readonly edit: Edit
  readonly expected: Omit<Diagnostic, 'severity' | 'code' | 'message'>
}

/**
 * One case per code, each breaking exactly one thing in a sample that
 * diagnoses clean, so the case shows that the code is given for that and
 * for nothing around it. Typed over the codes: a code without a case does
 * not compile.
 */
const CASES: { readonly [C in DiagnosticCode]: Case } = {
  // An expression typed half-way is the commonest error there is.
  'expression-syntax': { edit: set(INTRO_WHEN, 'params.draft =='), expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 15, end: 15 } } },
  // Nesting past upstream's depth bound is refused before it is checked.
  'expression-limit': {
    edit: set(CLOSING_WHEN, `${'('.repeat(20)}totals.lines > 0${')'.repeat(20)}`),
    expected: { path: CLOSING_WHEN, componentId: 'closing', position: { start: 16, end: 16 } },
  },
  // An integer parameter plus a string has no meaning in CEL: the member is
  // checked as the integer it is, not as an unknown.
  'expression-type': { edit: set(CLOSING_WHEN, 'params.copies + "x" == "1x"'), expected: { path: CLOSING_WHEN, componentId: 'closing', position: { start: 0, end: 19 } } },
  // A condition must be a boolean, and an integer parameter is not one.
  'expression-policy': { edit: set(INTRO_WHEN, 'params.copies'), expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 13 } } },
  // A parameter nobody declared reads as nothing at run time.
  'expression-unknown-name': { edit: set(INTRO_WHEN, 'params.nope == false'), expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 11 } } },
  // There is no current row outside a table's cells.
  'expression-out-of-scope': { edit: set(INTRO_WHEN, 'row.shipped == true'), expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 3 } } },
  // An image field's value is an asset id: drawn, never computed with.
  'expression-unreadable-field': {
    edit: set(INTRO_VALUE, 'string(header.signature) + string(params.copies)'),
    expected: { path: INTRO_VALUE, componentId: 'intro', position: { start: 7, end: 23 } },
  },
  // Two renders of the same data must print the same thing.
  'expression-not-reproducible': {
    edit: set(INTRO_WHEN, 'params.draft == false && today() > timestamp("2026-01-01T00:00:00Z")'),
    expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 25, end: 32 } },
  },
  // Which parameter size(params) counts depends on nothing the editor can
  // check, and the runtime binds a parameter by its id, never the whole set.
  'expression-dynamic-read': { edit: set(CLOSING_WHEN, 'size(params) > 0 && totals.lines > 0'), expected: { path: CLOSING_WHEN, componentId: 'closing', position: { start: 5, end: 11 } } },
  // A sum of strings has no value: a sum takes integers and decimals.
  'expression-aggregate-type': { edit: set(GROSS, 'row.sku'), expected: { path: GROSS } },
  // A total that reads itself can never be computed.
  'aggregate-cycle': { edit: set(GROSS, 'row.amount * dec("1.081") + totals.gross'), expected: { path: GROSS, position: { start: 28, end: 40 } } },
  'unused-style': { edit: (report) => report.styles.push({ id: 'spare', bold: true }), expected: { path: '/styles/5' } },
  'unused-asset': { edit: (report) => report.assets.push({ id: 'spare', mediaType: 'image/png', digest: `sha256:${'12'.repeat(32)}` }), expected: { path: '/assets/2' } },
  'unused-parameter': { edit: (report) => report.parameters.push({ id: 'spare', type: 'string', label: 'Spare', required: false }), expected: { path: '/parameters/5' } },
  'unused-field': {
    edit: (report) => report.datasets.detail?.fields.push({ id: 'spare', type: 'string', label: 'Spare', nullable: true }),
    expected: { path: '/datasets/detail/fields/8' },
  },
  'unused-aggregate': { edit: (report) => report.aggregates.push({ id: 'spare', fn: 'count' }), expected: { path: '/aggregates/5' } },
  // The body moved whole into the summary: everything still prints, after nothing.
  'empty-body': {
    edit: (report) => {
      report.regions.summary.unshift(...report.regions.body)
      report.regions.body = []
    },
    expected: { path: '/regions/body' },
  },
  'empty-text': { edit: set('/regions/body/3/components/1/content', []), expected: { path: '/regions/body/3/components/1/content', componentId: 'note' } },
}

describe('diagnose', () => {
  // The sample uses everything it declares and every expression in it
  // compiles: a diagnostic on it would be a false alarm on a sound report.
  test('finds nothing in a sound report', () => {
    expect(diagnose(sampleReport())).toEqual([])
  })

  test.each(DIAGNOSTIC_CODES)('gives %s for what it is about, and nothing else', (code) => {
    const { edit, expected } = CASES[code]
    const diagnostics = diagnose(edited(edit))
    expect(diagnostics).toEqual([{ ...expected, code, severity: DIAGNOSTIC_SEVERITIES[code], message: expect.any(String) as string }])
  })
})

describe('expression diagnostics', () => {
  /** The code, position and message of each diagnostic for the sample with `cel` at `pointer`. */
  const at = (pointer: string, cel: string): Diagnostic[] => diagnose(edited(set(pointer, cel)))

  // A name that is no scope's at all is unknown, not out of scope.
  test('calls a name no scope binds unknown, at its position', () => {
    expect(at(INTRO_WHEN, 'foo == 1 && params.draft == false')).toEqual([expect.objectContaining({ code: 'expression-unknown-name', position: { start: 0, end: 3 } })])
  })

  // group has a value only in a group's header and footer; the table's
  // totals are over every row.
  test('says where a scope name has a value when it is read outside it', () => {
    const [diagnostic] = at(TOTAL_VALUE, 'totals.gross + group.lines')
    expect(diagnostic).toMatchObject({ code: 'expression-out-of-scope', componentId: 'lines', position: { start: 15, end: 20 } })
    expect(diagnostic?.message).toContain("group's header and footer")
  })

  // A parameter, a field and an aggregate are single values, not maps:
  // reading a member of one reads nothing at run time -- an aggregate over
  // an expression included, whatever type it computes.
  test.each([
    [INTRO_WHEN, 'params.from.year == 1 && params.draft == false', { start: 0, end: 16 }],
    [TOTAL_VALUE, 'totals.gross.amount', { start: 0, end: 19 }],
  ])('refuses a member read of a value that has none: %s', (pointer, cel, position) => {
    const [diagnostic, ...more] = at(pointer, cel)
    expect(more).toEqual([])
    expect(diagnostic).toMatchObject({ code: 'expression-unknown-name', position })
  })

  // Every member is checked as its type, so a decimal meets a decimal and an
  // integer is converted before it does, wherever each is written; and a
  // decimal is not converted again (0.5.0 has no dec(decimal)). A decimal
  // that may be null is checked as dyn, which upstream orders against a
  // decimal but refuses to test for equality with one
  // (decimal_equality_mismatch); the runtime compiles it the same way, so
  // the two refuse it together.
  test.each([
    ['a decimal compared with a decimal', AMOUNT_WHEN, 'row.amount < dec("0")', []],
    ['the same, the other way round', AMOUNT_WHEN, 'dec("0") > row.amount', []],
    ['a decimal that may be null, ordered against a decimal', AMOUNT_WHEN, 'dec("1") < params.threshold', []],
    ['a decimal that may be null, tested for equality with a decimal', AMOUNT_WHEN, 'dec("1") == params.threshold', ['expression-type']],
    ['a boolean parameter as a condition', INTRO_WHEN, 'params.draft', []],
    ['a decimal converted again', AMOUNT_WHEN, 'dec(row.amount) < dec("0")', ['expression-type']],
    ['an integer compared with a decimal', AMOUNT_WHEN, 'row.quantity < dec("0")', ['expression-type']],
    ['a boolean that may be null as a condition', AMOUNT_WHEN, 'row.shipped', ['expression-policy']],
  ])('checks %s by the member types', (_name, pointer, cel, codes) => {
    expect(at(pointer, cel).map(({ code }) => code)).toEqual(codes)
  })

  // The compiler's message names what the author wrote, not the name the
  // read is checked under.
  test('says a member as the author wrote it in a message from the compiler', () => {
    const [diagnostic] = at(INTRO_VALUE, 'params.copies + "x"')
    expect(diagnostic?.code).toBe('expression-type')
    expect(diagnostic?.message).not.toContain('params_copies')
    expect(at(INTRO_WHEN, 'params.copies')[0]?.message).not.toContain('params_copies')
  })

  // Each read of a member nothing declares is reported where it is, so
  // the underline does not run across the text between two of them.
  test('reports each read of an unknown member at its own position, with the column it is in', () => {
    expect(at(AMOUNT_WHEN, 'row.nope > dec("1") && row.sku == "a" && row.nope < dec("3")').map(({ code, position, componentId, columnId }) => [code, position, componentId, columnId])).toEqual([
      ['expression-unknown-name', { start: 0, end: 8 }, 'lines', 'amount'],
      ['expression-unknown-name', { start: 41, end: 49 }, 'lines', 'amount'],
    ])
  })

  // A read written as an index is the same read, checked the same way. The
  // compiler's position counts the text as it checks it, which is shorter
  // than an index, so a position past such a read cannot be given; the
  // diagnostic still names the expression and the component.
  test('checks a read written as an index, without a position it cannot give', () => {
    expect(at(AMOUNT_WHEN, 'row["amount"] < dec("0")')).toEqual([])
    const [diagnostic] = at(AMOUNT_WHEN, 'row["amount"] + "x" == "y"')
    expect(diagnostic).toMatchObject({ code: 'expression-type', path: AMOUNT_WHEN, componentId: 'lines' })
    expect(diagnostic?.position).toBeUndefined()
  })

  // A member's id is a field key, an identifier, so a read by any other key
  // reads no member; it is refused where it is, and credits no member as
  // read.
  test('refuses a read by a key that is no identifier, crediting nothing', () => {
    const report = edited((r) => r.parameters.push({ id: 'spare', type: 'string', label: 'Spare', required: false }), set(CLOSING_WHEN, 'params["a b"] == "x" && totals.lines > 0'))
    expect(diagnose(report).map(({ code, position }) => [code, position])).toEqual([
      ['expression-unknown-name', { start: 0, end: 13 }],
      ['unused-parameter', undefined],
    ])
  })

  // An aggregate whose expression does not compile has no type anyone
  // could check a read of it against; a read of it is not refused too, so
  // the author sees the one error that matters, where it is.
  test('reports an aggregate whose expression does not compile once, where it is', () => {
    expect(diagnose(edited(set(GROSS, 'row.amount *'))).map(({ code, path }) => `${code} ${path}`)).toEqual([`expression-syntax ${GROSS}`])
  })

  // Where a read is written as an index, the text checked is shorter than
  // the author's, and a position past it is not given rather than given
  // wrong: so for a whole read, and for a call to the clock.
  test('gives no position past a read written as an index', () => {
    expect(at(CLOSING_WHEN, 'size(params) > 0 && params["copies"] > 0').map(({ code, position }) => [code, position])).toEqual([['expression-dynamic-read', undefined]])
    expect(at(AMOUNT_WHEN, 'row["amount"] < dec("0") || now() > timestamp("2026-01-01T00:00:00Z")').map(({ code, position }) => [code, position])).toEqual([
      ['expression-not-reproducible', undefined],
    ])
  })

  // Every member is bound, null when it has no value, so has() on one asks
  // nothing; the compiler refuses it, and != null is the way to ask.
  test('refuses has() on a member', () => {
    expect(at(AMOUNT_WHEN, 'has(row.shippedAt)').map(({ code }) => code)).toEqual(['expression-type'])
    expect(at(AMOUNT_WHEN, 'row.shippedAt != null')).toEqual([])
  })

  // A comprehension's variable with the name a read is checked under would
  // capture a read inside it; upstream's rewrite refuses rather than change
  // what the expression means, and so does the check. Outside the
  // comprehension the variable has no meaning, and the read is checked.
  test('refuses a comprehension variable with the name a read inside it is checked under', () => {
    const [diagnostic] = at(AMOUNT_WHEN, '[1].exists(row_amount, row.amount < dec("0"))')
    expect(diagnostic).toMatchObject({ code: 'expression-policy', path: AMOUNT_WHEN })
    expect(diagnostic?.message).toContain('row_amount')
    expect(at(AMOUNT_WHEN, '[1].exists(row_amount, row_amount > 0) && row.amount < dec("0")')).toEqual([])
  })

  // An aggregate's expression gives the value its function totals: a sum
  // or an average of integers or decimals, a minimum or a maximum of those,
  // of instants or of dates written as strings; a count of anything, a
  // list included.
  test.each([
    ['sum', 'row.quantity', []],
    ['avg', 'row.recordedAt', ['expression-aggregate-type']],
    ['min', 'row.shippedAt', []],
    ['min', 'row.shipped == true', ['expression-aggregate-type']],
    ['max', 'row.shipped == true', ['expression-aggregate-type']],
    ['count', 'row.shipped', []],
    ['count', '[row.amount]', []],
  ] as const)('checks what %s of %s takes', (fn, cel, codes) => {
    const report = edited((r) => {
      r.aggregates[2] = { id: 'gross', fn, of: { kind: 'expression', expression: { cel } }, ...(fn === 'avg' ? { rounding: { scale: 2, mode: 'half-even' } } : {}) }
    })
    expect(diagnose(report).filter(({ path }) => path === GROSS).map(({ code }) => code)).toEqual(codes)
  })

  // Every reproducibility problem is reported, each where it is.
  test('reports every clock or random call, each with its own position', () => {
    expect(at(INTRO_VALUE, 'string(now()) + string(random()) + string(params.copies)').map(({ code, position }) => `${code} ${position?.start}`)).toEqual([
      'expression-not-reproducible 7',
      'expression-not-reproducible 23',
    ])
  })

  // What upstream suggests travels with the error: here, how to write a
  // decimal literal.
  test("passes on upstream's hint", () => {
    const [diagnostic] = at(INTRO_VALUE, 'string(dec(params.copies) * 0.19)')
    expect(diagnostic).toMatchObject({ code: 'expression-type' })
    expect(diagnostic?.hint).toContain('dec("0.19")')
  })
})

describe('unused declarations', () => {
  // Reading a name whole -- size(params), an index computed at run time --
  // is an error of its own, and may read any member, so none of them is
  // also called unused.
  test('counts a whole read of a name as a read of every member', () => {
    const report = edited((r) => r.parameters.push({ id: 'spare', type: 'string', label: 'Spare', required: false }), set(CLOSING_WHEN, 'size(params) > 0 && totals.lines > 0'))
    expect(diagnose(report).map(({ code }) => code)).toEqual(['expression-dynamic-read'])
  })

  // A header field nothing reads is unused too. Once an expression reads
  // it, it is used -- and the parameter the replaced expression read is
  // the one left unused.
  test('counts reads in expressions, and reports an unread header field', () => {
    const report = edited((r) => r.datasets.header?.fields.push({ id: 'spare', type: 'string', label: 'Spare', nullable: true }))
    expect(diagnose(report)).toEqual([expect.objectContaining({ code: 'unused-field', path: '/datasets/header/fields/4' })])
    expect(diagnose(edited(set(INTRO_VALUE, 'header.spare'), (r) => r.datasets.header?.fields.push({ id: 'spare', type: 'string', label: 'Spare', nullable: true })))).toEqual([
      expect.objectContaining({ code: 'unused-parameter', path: '/parameters/4' }),
    ])
  })
})

describe('a blank report', () => {
  // The report an author starts from declares nothing, so nothing is
  // unused; it only has nothing in its body yet.
  test('has only its empty body to report', () => {
    expect(diagnose(emptyReport('blank', 'Blank', 'en')).map(({ code }) => code)).toEqual(['empty-body'])
  })
})

describe('what is not a diagnostic', () => {
  // A table needs the detail dataset it reads; the validator refuses one
  // without it, so a session never holds one and no warning is needed.
  test('a table without a detail dataset is refused by the validator', () => {
    const { detail: _gone, ...datasets } = sampleReport().datasets
    const outcome = validateReport({ ...sampleReport(), datasets })
    expect(outcome.valid === false && outcome.errors.map(({ code, path }) => `${code} ${path}`)).toContain('unknown-dataset /regions/body/2/dataset')
  })
})

describe('content', () => {
  // Spaces print nothing a reader sees; a bound value prints whatever the
  // data holds, so it is not empty.
  test('calls a text of blank literal runs empty, and one with a value not', () => {
    const blank = edited(set('/regions/body/3/components/1/content', [{ kind: 'text', text: '  ' }, { kind: 'text', text: '' }]))
    expect(diagnose(blank).map(({ code }) => code)).toEqual(['empty-text'])
    const bound = edited(set('/regions/body/3/components/1/content', [{ kind: 'text', text: '' }, { kind: 'parameter', parameter: 'from' }]))
    expect(diagnose(bound)).toEqual([])
  })
})
