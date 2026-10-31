import { emptyReport, validateReport } from '@formancy/report-spec'
import type { AggregateDef, ReportDefinition, Rounding } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { thawed } from '../snapshot.js'
import type { Mutable } from '../snapshot.js'
import { eInvoiceSample, sampleReport, setAt } from '../test-support.js'
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
const GROUP_HEADER = '/regions/body/2/group/header/2/expression/cel'
const STATISTICS = '/regions/summary/0/components/1/content/0'
const GROUP_SUBTOTAL = '/regions/body/2/group/footer/0/cells/2/value'

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
  'expression-type': {
    edit: set(CLOSING_WHEN, 'params.copies + "x" == "1x"'),
    expected: { path: CLOSING_WHEN, componentId: 'closing', position: { start: 0, end: 19 } },
  },
  // A condition must be a boolean, and an integer parameter is not one.
  'expression-policy': { edit: set(INTRO_WHEN, 'params.copies'), expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 13 } } },
  // A parameter nobody declared reads as nothing at run time.
  'expression-unknown-name': {
    edit: set(INTRO_WHEN, 'params.nope == false'),
    expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 11 } },
  },
  // There is no current row outside a table's cells.
  'expression-out-of-scope': {
    edit: set(INTRO_WHEN, 'row.shipped == true'),
    expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 3 } },
  },
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
  // int(double) printed 4.35 as 434 cents, as though it were exact.
  'expression-inexact': {
    edit: set(TOTAL_VALUE, 'dec(string(int(double(string(totals.gross)))))'),
    expected: { path: TOTAL_VALUE, componentId: 'lines', position: { start: 15, end: 43 }, hint: expect.stringContaining('dec(') as string },
  },
  // A backtracking pattern can take minutes inside one step of the budget.
  'expression-unbounded': {
    edit: set(INTRO_WHEN, 'header.customer.matches("^a+$")'),
    expected: { path: INTRO_WHEN, componentId: 'intro', position: { start: 0, end: 31 } },
  },
  // Which parameter size(params) counts depends on nothing the editor can
  // check, and the runtime binds a parameter by its id, never the whole set.
  'expression-dynamic-read': {
    edit: set(CLOSING_WHEN, 'size(params) > 0 && totals.lines > 0'),
    expected: { path: CLOSING_WHEN, componentId: 'closing', position: { start: 5, end: 11 } },
  },
  // A sum of strings has no value: a sum takes integers and decimals.
  'expression-aggregate-type': { edit: set(GROSS, 'row.sku'), expected: { path: GROSS } },
  // A total that reads itself can never be computed.
  'aggregate-cycle': { edit: set(GROSS, 'row.amount * dec("1.081") + totals.gross'), expected: { path: GROSS, position: { start: 28, end: 40 } } },
  // A total rounded half-even to one place, then printed whole, is rounded
  // twice: 2.45 became 2.5 and then 3, where once it is 2.
  'format-rounds-again': {
    edit: set(`${STATISTICS}/format`, { kind: 'number', scale: 0, grouping: false }),
    expected: { path: `${STATISTICS}/format`, componentId: 'statistics' },
  },
  // A count has no places: every render refused its rounding, which the
  // editor said nothing about.
  'rounding-not-decimal': {
    edit: set('/aggregates/1/rounding', { scale: 0, mode: 'half-even', increment: '5' }),
    expected: { path: '/aggregates/1/rounding' },
  },
  // A total the XML holds and the page does not print: the page shows
  // another invoice than the one it carries. The sample made the e-invoice
  // sample, its reduced rate's amount printed by nothing.
  'e-invoice-total-unprinted': {
    edit: (report) => {
      delete report.paymentPart
      Object.assign(report, thawed(eInvoiceSample()))
      setAt(report, '/regions/summary/5/content/3', { kind: 'text', text: '-' })
    },
    expected: { path: '/eInvoice/vat/1' },
  },
  // A total the XML holds to the cent, printed at no places: 871.63 on
  // the file and 872 on the page, two invoices. The e-invoice sample, its
  // total with VAT printed whole.
  'e-invoice-format-differs': {
    edit: (report) => {
      delete report.paymentPart
      Object.assign(report, thawed(eInvoiceSample()))
      setAt(report, '/regions/summary/4/content/9/format', { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 0 })
    },
    expected: { path: '/regions/summary/4/content/9/format', componentId: 'invoice-totals' },
  },
  'unused-style': { edit: (report) => report.styles.push({ id: 'spare', bold: true }), expected: { path: '/styles/5' } },
  'unused-asset': {
    edit: (report) => report.assets.push({ id: 'spare', mediaType: 'image/png', digest: `sha256:${'12'.repeat(32)}` }),
    expected: { path: '/assets/2' },
  },
  'unused-parameter': {
    edit: (report) => report.parameters.push({ id: 'spare', type: 'string', label: 'Spare', required: false }),
    expected: { path: '/parameters/5' },
  },
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
  // A bill left paying SIX's example account, as one a builder adds starts.
  'example-payment-part': { edit: set('/paymentPart/account', [{ kind: 'text', text: 'CH44 3199 9123 0008 8901 2' }]), expected: { path: '/paymentPart' } },
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

describe('font assets', () => {
  // A font asset the font map maps is used, even though no image draws it;
  // the unused-asset diagnostic would otherwise fire on every typeface a
  // report prints in (0043).
  test('a mapped font asset is not unused', () => {
    const report = edited((report) => {
      report.assets.push({ id: 'brand', mediaType: 'font/ttf', digest: `sha256:${'c3'.repeat(32)}` })
      setAt(report, '/fonts', { sans: { normal: 'brand' } })
    })
    expect(diagnose(report)).toEqual([])
  })

  // A font asset no token maps is a leftover like any other, and says so in
  // the words a font deserves, not an image's.
  test('an unmapped font asset is unused, named as a font', () => {
    const report = edited((report) => report.assets.push({ id: 'brand', mediaType: 'font/ttf', digest: `sha256:${'c3'.repeat(32)}` }))
    expect(diagnose(report)).toEqual([{ code: 'unused-asset', severity: 'warning', path: '/assets/2', message: 'font "brand" is mapped to no font token' }])
  })
})

describe('expression diagnostics', () => {
  /** The code, position and message of each diagnostic for the sample with `cel` at `pointer`. */
  const at = (pointer: string, cel: string): Diagnostic[] => diagnose(edited(set(pointer, cel)))

  // A name that is no scope's at all is unknown, not out of scope.
  test('calls a name no scope binds unknown, at its position', () => {
    expect(at(INTRO_WHEN, 'foo == 1 && params.draft == false')).toEqual([
      expect.objectContaining({ code: 'expression-unknown-name', position: { start: 0, end: 3 } }),
    ])
  })

  // group has a value only in a group's header and footer; the table's
  // totals are over every row.
  test('says where a scope name has a value when it is read outside it', () => {
    const [diagnostic] = at(TOTAL_VALUE, 'totals.gross + group.lines')
    expect(diagnostic).toMatchObject({ code: 'expression-out-of-scope', componentId: 'lines', position: { start: 15, end: 20 } })
    expect(diagnostic?.message).toContain("group's header and footer")
  })

  // A group header computes with the value its group is keyed by, checked
  // as the field grouped by: the sample groups by a string field, so the key
  // joins a string and is no number. Without it, a header could print its
  // key only as a field, never compare or compute with it.
  test('reads the group key in a group header, as the type of the field grouped by', () => {
    expect(at(GROUP_HEADER, '" " + group.key + " (" + string(group.lines) + ")"')).toEqual([])
    expect(at(GROUP_HEADER, 'string(group.key + 1)').map(({ code }) => code)).toEqual(['expression-type'])
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
    expect(
      at(AMOUNT_WHEN, 'row.nope > dec("1") && row.sku == "a" && row.nope < dec("3")').map(({ code, position, componentId, columnId }) => [
        code,
        position,
        componentId,
        columnId,
      ]),
    ).toEqual([
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
    const report = edited(
      (r) => r.parameters.push({ id: 'spare', type: 'string', label: 'Spare', required: false }),
      set(CLOSING_WHEN, 'params["a b"] == "x" && totals.lines > 0'),
    )
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
    expect(at(CLOSING_WHEN, 'size(params) > 0 && params["copies"] > 0').map(({ code, position }) => [code, position])).toEqual([
      ['expression-dynamic-read', undefined],
    ])
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
      r.aggregates[2] = {
        id: 'gross',
        fn,
        of: { kind: 'expression', expression: { cel } },
        ...(fn === 'avg' ? { rounding: { scale: 2, mode: 'half-even' } } : {}),
      }
    })
    expect(
      diagnose(report)
        .filter(({ path }) => path === GROSS)
        .map(({ code }) => code),
    ).toEqual(codes)
  })

  // Every reproducibility problem is reported, each where it is.
  test('reports every clock or random call, each with its own position', () => {
    expect(at(INTRO_VALUE, 'string(now()) + string(random()) + string(params.copies)').map(({ code, position }) => `${code} ${position?.start}`)).toEqual([
      'expression-not-reproducible 7',
      'expression-not-reproducible 23',
    ])
  })

  // A double reached a printed integer through int(): 4.35 printed as 434
  // cents, and a sum of such columns was 4 cents short of the exact one,
  // with no diagnostic. Integer division printed 3 / 2 as 1. Each is
  // refused where it is written, with what keeps the number exact.
  test.each([
    [
      'a double through int()',
      TOTAL_VALUE,
      'string(int(double(string(totals.gross)) * 100.0))',
      [
        ['double-call', 11],
        ['double-literal', 42],
      ],
    ],
    [
      'a double in a condition',
      AMOUNT_WHEN,
      'double(string(row.amount)) > 1.5',
      [
        ['double-call', 0],
        ['double-literal', 29],
      ],
    ],
    ['integer division', INTRO_VALUE, 'string(params.copies / 2)', [['integer-division', 21]]],
  ])('refuses %s, where it is written', (_name, pointer, cel, found) => {
    const diagnostics = at(pointer, cel)
    expect(diagnostics.map(({ code, position }) => [code, position?.start])).toEqual(found.map(([, start]) => ['expression-inexact', start]))
    expect(diagnostics.map(({ hint }) => hint)).toEqual(
      found.map(([kind]) => expect.stringContaining(kind === 'integer-division' ? 'divide(dec(' : 'dec("') as string),
    )
  })

  // Exact division, and a remainder, which drops nothing, are what an author
  // writes instead.
  test('accepts exact division and a remainder', () => {
    expect(at(INTRO_VALUE, 'string(divide(dec(params.copies), dec(2), 2)) + string(params.copies % 2)')).toEqual([])
  })

  // "^(a+)+$" over 29 letters and a b took 39 seconds in one resolve: a
  // backtracking pattern is one call of a few steps to the budget.
  test('refuses matches(), whose time no budget bounds', () => {
    expect(at(INTRO_WHEN, 'header.customer.matches("^(a+)+$")').map(({ code, position }) => [code, position])).toEqual([
      ['expression-unbounded', { start: 0, end: 34 }],
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

describe("a QR-bill's amount", () => {
  const AMOUNT = '/paymentPart/amount/cel'

  // The code holds the amount as a decimal of two places (IG Table 8,
  // Amt), and null leaves it for the payer to fill in. A value that may be
  // null -- a parameter with no default -- is checked by the render, which
  // sees it. Each of these is an amount the runtime can write.
  test('is a decimal, or null', () => {
    for (const cel of ['totals.subtotal', 'dec("1949.75")', 'round(totals.gross, 2)', 'null', 'params.threshold']) {
      expect(diagnose(edited(set(AMOUNT, cel))), cel).toEqual([])
    }
  })

  // An integer, a string, a boolean or an instant has no place in the
  // amount: every render would refuse it, and the editor says so where it
  // is written, naming what it gives, with the way to a decimal where there
  // is one.
  test('is refused as anything else, saying what it gives', () => {
    for (const [cel, type, hint] of [
      ['params.copies', 'int', true],
      ['header.customer', 'string', true],
      ['params.draft', 'bool', false],
      ['timestamp("2026-01-01T00:00:00Z")', 'timestamp', false],
    ] as const) {
      expect(diagnose(edited(set(AMOUNT, cel))), cel).toEqual([
        {
          severity: 'error',
          code: 'expression-type',
          message: `a QR-bill's amount is a decimal, or null to leave it for the payer, and this expression gives ${type}`,
          path: AMOUNT,
          ...(hint ? { hint: 'dec() makes a decimal of an integer, or of a string of digits' } : {}),
        },
      ])
    }
  })

  // A double is not exact, which is said first and as itself: 12.50 is
  // the commonest way to write an amount, and the commonest mistake.
  test('is never a double', () => {
    expect(diagnose(edited(set(AMOUNT, '12.50'))).map(({ code, path }) => `${code} ${path}`)).toEqual([`expression-inexact ${AMOUNT}`])
  })
})

describe("an EPC QR code's amount", () => {
  const AMOUNT = '/regions/summary/3/amount/cel'

  // The EPC's amount is a decimal in euro (EPC069-12 2.2, AT-T002), and
  // null leaves it for the payer, by the one rule a QR-bill's is held to:
  // what passes here is what the runtime can write after `EUR`.
  test('is a decimal, or null', () => {
    for (const cel of ['totals.subtotal', 'dec("12.30")', 'round(totals.gross, 2)', 'null', 'params.threshold']) {
      expect(diagnose(edited(set(AMOUNT, cel))), cel).toEqual([])
    }
  })

  // Refused as anything else, in words that name the EPC QR code, not a
  // QR-bill, and on the code itself: a report holding both would
  // otherwise send the author to the bill, and the editor could not open
  // the code's properties from the diagnostic.
  test('is refused as anything else, naming the code it is the amount of', () => {
    expect(diagnose(edited(set(AMOUNT, 'params.copies')))).toEqual([
      {
        severity: 'error',
        code: 'expression-type',
        message: "an EPC QR code's amount is a decimal, or null to leave it for the payer, and this expression gives int",
        path: AMOUNT,
        componentId: 'payment-code',
        hint: 'dec() makes a decimal of an integer, or of a string of digits',
      },
    ])
  })
})

describe('rounding', () => {
  /** The codes of the diagnostics for the sample's group subtotal, rounded as `rounding` and printed as `format`. */
  const printed = (rounding: object | undefined, format: object): string[] =>
    diagnose(
      edited(
        (report) => {
          const { rounding: _gone, ...subtotal } = report.aggregates[0] as AggregateDef
          report.aggregates[0] = rounding === undefined ? subtotal : { ...subtotal, rounding: rounding as Rounding }
        },
        set(`${GROUP_SUBTOTAL}/format`, format),
      ),
    ).map(({ code, path }) => `${code} ${path}`)
  const chf = (scale: number): object => ({ kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale })

  // The display rounds once more only where it shows fewer places than the
  // total keeps; at as many or more, it shows the rounded total as it is.
  // Without a declared rounding the display's is the only one.
  test.each([
    ['at the scale the rounding keeps', { scale: 2, mode: 'half-even' }, chf(2), []],
    ['at more places than the rounding keeps', { scale: 2, mode: 'half-even' }, chf(3), []],
    ['to 0.05 at two places', { scale: 2, mode: 'half-away-from-zero', increment: '0.05' }, chf(2), []],
    ['with no rounding declared, at no places', undefined, chf(0), []],
    ['at fewer places than the rounding keeps', { scale: 2, mode: 'half-even' }, chf(1), [`format-rounds-again ${GROUP_SUBTOTAL}/format`]],
    [
      'to 0.05, at one place',
      { scale: 2, mode: 'half-away-from-zero', increment: '0.05' },
      { kind: 'number', scale: 1, grouping: true },
      [`format-rounds-again ${GROUP_SUBTOTAL}/format`],
    ],
  ])('allows or refuses a total printed %s', (_name, rounding, format, codes) => {
    expect(printed(rounding, format)).toEqual(codes)
  })

  // A sum of decimals has places to round, and so does one whose type only
  // the data says, which the runtime rounds as a decimal. An integer, a
  // date and an instant have none.
  test.each([
    ['a sum of decimals', 'subtotal', []],
    ['a count', 'lines', ['rounding-not-decimal /aggregates/1/rounding']],
    ['the latest instant', 'latest', ['rounding-not-decimal /aggregates/4/rounding']],
  ])('allows a rounding on %s, or refuses it', (_name, id, codes) => {
    const index = sampleReport().aggregates.findIndex((aggregate) => aggregate.id === id)
    expect(diagnose(edited(set(`/aggregates/${index}/rounding`, { scale: 2, mode: 'half-even' }))).map(({ code, path }) => `${code} ${path}`)).toEqual(codes)
  })
})

describe('unused declarations', () => {
  // Reading a name whole -- size(params), an index computed at run time --
  // is an error of its own, and may read any member, so none of them is
  // also called unused.
  test('counts a whole read of a name as a read of every member', () => {
    const report = edited(
      (r) => r.parameters.push({ id: 'spare', type: 'string', label: 'Spare', required: false }),
      set(CLOSING_WHEN, 'size(params) > 0 && totals.lines > 0'),
    )
    expect(diagnose(report).map(({ code }) => code)).toEqual(['expression-dynamic-read'])
  })

  // A header field nothing reads is unused too. Once an expression reads
  // it, it is used -- and the parameter the replaced expression read is
  // the one left unused.
  test('counts reads in expressions, and reports an unread header field', () => {
    const report = edited((r) => r.datasets.header?.fields.push({ id: 'spare', type: 'string', label: 'Spare', nullable: true }))
    expect(diagnose(report)).toEqual([expect.objectContaining({ code: 'unused-field', path: '/datasets/header/fields/4' })])
    expect(
      diagnose(
        edited(set(INTRO_VALUE, 'header.spare'), (r) => r.datasets.header?.fields.push({ id: 'spare', type: 'string', label: 'Spare', nullable: true })),
      ),
    ).toEqual([expect.objectContaining({ code: 'unused-parameter', path: '/parameters/4' })])
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
    const blank = edited(
      set('/regions/body/3/components/1/content', [
        { kind: 'text', text: '  ' },
        { kind: 'text', text: '' },
      ]),
    )
    expect(diagnose(blank).map(({ code }) => code)).toEqual(['empty-text'])
    const bound = edited(
      set('/regions/body/3/components/1/content', [
        { kind: 'text', text: '' },
        { kind: 'parameter', parameter: 'from' },
      ]),
    )
    expect(diagnose(bound)).toEqual([])
  })
})
