import { describe, expect, test } from 'vitest'
import { REPORT_ERROR_CODES } from './errors.js'
import type { ReportError, ReportErrorCode } from './errors.js'
import { MAX_ASSETS, MAX_ERRORS, MAX_LABEL_LENGTH, MAX_NESTING_DEPTH } from './limits.js'
import { editable, getAt, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** Edits a document in place and returns what to validate. */
type Edit = (report: Record<string, unknown>) => unknown

const set =
  (pointer: string, value: unknown): Edit =>
  (report) => {
    setAt(report, pointer, value)
    return report
  }

const remove =
  (pointer: string): Edit =>
  (report) => {
    removeAt(report, pointer)
    return report
  }

const both =
  (...edits: Edit[]): Edit =>
  (report) => {
    for (const edit of edits) edit(report)
    return report
  }

const unchanged: Edit = (report) => report

/** `count` assets with distinct ids, the fixture's two first. */
function assets(count: number): unknown[] {
  const fixture = richReport().assets
  const extra = Array.from({ length: count - fixture.length }, (_, index) => ({
    id: `asset-${index}`,
    mediaType: 'image/png',
    digest: `sha256:${'12'.repeat(32)}`,
  }))
  return [...fixture, ...extra]
}

/** `depth` keep-together blocks, each inside the one before, around one text. */
function nested(depth: number): unknown {
  let inner: unknown = { id: 'deep', kind: 'text', content: [{ kind: 'text', text: 'deep' }] }
  for (let level = depth; level >= 1; level -= 1) inner = { id: `level-${level}`, kind: 'keepTogether', components: [inner] }
  return inner
}

/** Every region, empty. */
function emptyRegions(): unknown {
  return { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] }
}

/** Where the fixture binds a header field, each a FieldRef's `dataset`. */
const HEADER_BINDINGS = [
  '/regions/reportHeader/0/columns/1/components/0/content/1/field',
  '/regions/body/0/content/1/field',
  '/regions/body/2/columns/2/value/format/currency/field',
  '/regions/summary/0/components/2/source/field',
  '/regions/summary/2/content/1/field',
  '/paymentPart/debtor/name/0/field',
  '/paymentPart/message/1/field',
]

interface Case {
  /** Breaks exactly the rule the code names, in a valid report. */
  readonly refuse: Edit
  /** The nearest edit that keeps the report valid: the rule refuses the one thing, not its neighbourhood. */
  readonly accept: Edit
  /** Where each error with this code points. */
  readonly at: readonly string[]
  /** The codes of the other errors the refusal is expected to bring, in order; none unless said. */
  readonly alongside?: readonly ReportErrorCode[]
}

/**
 * One refusal per error code. Typed over every code, so a code added to
 * REPORT_ERROR_CODES without a case here does not compile, and the runtime
 * check below fails for a code that is listed but not typed.
 */
const CASES: { readonly [C in ReportErrorCode]: Case } = {
  // A formancy form is the document most likely to arrive here by mistake;
  // read as a report it would render as an empty one. Structural errors about
  // it would bury the one thing worth saying.
  'not-a-report': {
    refuse: () => ({ specVersion: '3', id: 'order', title: 'Order', model: { fields: [] } }),
    accept: unchanged,
    at: [''],
  },
  // A report of another version is refused, never partly read: a property
  // this version does not know could be the one that hides a row.
  'unsupported-version': { refuse: set('/reportSpecVersion', '1'), accept: set('/reportSpecVersion', '0'), at: ['/reportSpecVersion'] },
  // NaN is not JSON: a margin of NaN lays out nowhere, and the canonical hash
  // throws on it. Refused where it is, not later as a crash.
  'not-json': { refuse: set('/page/margins/top', Number.NaN), accept: set('/page/margins/top', 0), at: ['/page/margins/top'] },
  // Errors are bounded, and a list cut short says so: a caller that saw
  // exactly MAX_ERRORS errors could not otherwise tell it had them all.
  'too-many-errors': {
    refuse: set(
      '/regions/body',
      Array.from({ length: MAX_ERRORS + 1 }, (_, index) => ({ id: `gap-${index}`, kind: 'spacer', height: 0 })),
    ),
    accept: set(
      '/regions/body',
      Array.from({ length: MAX_ERRORS + 1 }, (_, index) => ({ id: `gap-${index}`, kind: 'spacer', height: 1 })),
    ),
    at: [''],
    alongside: Array.from({ length: MAX_ERRORS }, () => 'out-of-range' as const),
  },
  // A title that is a number would print as one, or not at all, depending on
  // the renderer; the format says string and means it.
  'wrong-type': { refuse: set('/title', 42), accept: set('/title', 'Orders'), at: ['/title'] },
  // A spacer without a height has no size; a renderer would have to guess one.
  'missing-property': { refuse: remove('/regions/body/1/height'), accept: set('/regions/body/1/height', 1), at: ['/regions/body/1/height'] },
  // Strict shapes: a property this version does not know -- a typo, or a
  // later version's -- is refused rather than ignored, because ignoring it
  // could drop what the author meant.
  'unknown-property': { refuse: set('/regions/body/1/width', 10), accept: set('/regions/body/1/style', 'body'), at: ['/regions/body/1/width'] },
  // A component kind this version does not know is refused, never skipped:
  // a skipped block is silently missing content (fail closed).
  'unknown-kind': { refuse: set('/regions/body/1/kind', 'chart'), accept: set('/regions/body/1/kind', 'spacer'), at: ['/regions/body/1/kind'] },
  // A page size the renderer has no dimensions for would print at a default
  // size the author never chose. Letter is one, for a report without the
  // fixture's QR-bill, which is printed on A4.
  'not-one-of': { refuse: set('/page/size', 'A3'), accept: both(remove('/paymentPart'), set('/page/size', 'Letter')), at: ['/page/size'] },
  // A 3.99pt font is below the smallest size the format allows; 4 is the
  // boundary and is allowed.
  'out-of-range': { refuse: set('/styles/1/size', 3.99), accept: set('/styles/1/size', 4), at: ['/styles/1/size'] },
  // A scale of 2.5 decimal places means nothing; 20 is the largest allowed.
  'not-an-integer': {
    refuse: set('/datasets/detail/fields/3/scale', 2.5),
    accept: set('/datasets/detail/fields/3/scale', 20),
    at: ['/datasets/detail/fields/3/scale'],
  },
  // Lengths are stored to the hundredth of a point. A millimetre value
  // converted without rounding would be a second spelling of the same
  // margin, with a hash of its own.
  'too-precise': { refuse: set('/page/margins/top', 56.6929), accept: set('/page/margins/top', 56.7), at: ['/page/margins/top'] },
  // An unbounded string is unbounded work for every later stage; the bound
  // itself is allowed.
  'too-long': { refuse: set('/title', 'x'.repeat(MAX_LABEL_LENGTH + 1)), accept: set('/title', 'x'.repeat(MAX_LABEL_LENGTH)), at: ['/title'] },
  // Arrays are bounded before they are read: a template with a million
  // asset references is refused without reading them.
  'too-many': { refuse: set('/assets', assets(MAX_ASSETS + 1)), accept: set('/assets', assets(MAX_ASSETS)), at: ['/assets'] },
  // A columns block with one column is a block, and the format has
  // sections for that; two to four columns are what it lays out.
  'too-few': {
    refuse: remove('/regions/reportHeader/0/columns/0'),
    accept: set('/regions/reportHeader/0/columns/2', { width: 'fill', components: [] }),
    at: ['/regions/reportHeader/0/columns'],
  },
  // A condition of only whitespace is no condition; the runtime would have
  // to decide whether that means always or never.
  'empty-expression': {
    refuse: set('/regions/body/0/visibleWhen/cel', ' \n'),
    accept: set('/regions/body/0/visibleWhen/cel', 'true'),
    at: ['/regions/body/0/visibleWhen/cel'],
  },
  // Identifiers are stable keys that bindings, diagnostics and history refer
  // to; one with capitals or spaces would be spelled two ways. Sixty-four
  // characters is the longest allowed.
  'invalid-id': { refuse: set('/regions/body/1/id', 'Gap'), accept: set('/regions/body/1/id', `g${'a'.repeat(63)}`), at: ['/regions/body/1/id'] },
  // An underscore is not BCP 47; a renderer would fall back to a locale the
  // author never chose and format every date and number in it.
  'invalid-locale': { refuse: set('/locale', 'de_CH'), accept: set('/locale', 'fr-CH'), at: ['/locale'] },
  // Colours are lower-case #rrggbb only, so one colour has one spelling and
  // one hash.
  'invalid-color': { refuse: set('/styles/0/color', '#1A1A2E'), accept: set('/styles/0/color', '#ffffff'), at: ['/styles/0/color'] },
  // A lower-case code is not ISO 4217; a formatter might guess it, or not.
  'invalid-currency': {
    refuse: set('/regions/body/2/group/footer/0/cells/1/value/format/currency/code', 'chf'),
    accept: set('/regions/body/2/group/footer/0/cells/1/value/format/currency/code', 'EUR'),
    at: ['/regions/body/2/group/footer/0/cells/1/value/format/currency/code'],
  },
  // An asset is pinned by its content digest so rendering never follows a
  // mutable "latest logo"; a digest that is not sha256 lower-case hex pins
  // nothing.
  'invalid-digest': {
    refuse: set('/assets/0/digest', `sha256:${'AB'.repeat(32)}`),
    accept: set('/assets/0/digest', `sha256:${'cd'.repeat(32)}`),
    at: ['/assets/0/digest'],
  },
  // 2026 is not a leap year: a default of 29 February would be refused by
  // every date parser after the report was published.
  'invalid-default': {
    refuse: set('/parameters/0/default', '2026-02-29'),
    accept: set('/parameters/0/default', '2028-02-29'),
    at: ['/parameters/0/default'],
  },
  // An IBAN with one digit typed wrong pays nobody, or somebody else: in a
  // literal no data can change, it is refused where it is written, not by
  // the payer's bank. Another QR-IBAN, as literal, is accepted.
  'invalid-qr-bill': {
    refuse: set('/paymentPart/account/0/text', 'CH44 3199 9123 0008 8901 3'),
    accept: set('/paymentPart/account/0/text', 'CH64 3196 1000 0044 2155 7'),
    at: ['/paymentPart/account'],
  },
  // A rounding increment is an exact decimal; '.05' is a spelling a
  // decimal parser may read, or not.
  'invalid-decimal': {
    refuse: set('/aggregates/2/rounding/increment', '.05'),
    accept: set('/aggregates/2/rounding/increment', '0.10'),
    at: ['/aggregates/2/rounding/increment'],
  },
  // Margins that leave less than an inch either way leave nothing to lay a
  // report out in. 0.07 and 523.21 points either side of A4 leave exactly
  // 72 -- 71.99999999999989 before rounding, which is why it is rounded.
  // The fixture's content needs more than an inch, so both sides of the
  // case empty the regions, and the margin is the only difference.
  'printable-area-too-small': {
    refuse: both(set('/regions', emptyRegions()), set('/page/margins/left', 0.07), set('/page/margins/right', 523.22)),
    accept: both(set('/regions', emptyRegions()), set('/page/margins/left', 0.07), set('/page/margins/right', 523.21)),
    at: ['/page/margins'],
  },
  // A scale on an integer field says the source holds decimals it does not.
  'scale-on-non-decimal': {
    refuse: set('/datasets/detail/fields/2/scale', 0),
    accept: set('/datasets/detail/fields/4/scale', 0),
    at: ['/datasets/detail/fields/2/scale'],
  },
  // Two parameters with one id: the host would supply one value and the
  // report would read it as both.
  'duplicate-id': { refuse: set('/parameters/1/id', 'from'), accept: set('/parameters/1/id', 'to'), at: ['/parameters/1/id'] },
  // In a group's header and footer, group.key is the value grouped by; an
  // aggregate called key would be read there as one or the other, and an
  // author could not tell which.
  'reserved-id': {
    refuse: set('/aggregates/6', { id: 'key', fn: 'count' }),
    accept: set('/aggregates/6', { id: 'keys', fn: 'count' }),
    at: ['/aggregates/6/id'],
  },
  // A style that does not exist would print in a default the author never
  // chose.
  'unknown-style': { refuse: set('/regions/body/1/style', 'heading'), accept: set('/regions/body/1/style', 'code'), at: ['/regions/body/1/style'] },
  // A reference into a dataset the report does not declare would print
  // nothing where a customer's name belongs. Every binding of the header
  // dataset is refused, and the nearest valid report binds none.
  'unknown-dataset': {
    refuse: remove('/datasets/header'),
    accept: both(
      remove('/datasets/header'),
      set('/regions/reportHeader/0/columns/1/components/0/content/1', { kind: 'text', text: 'customer' }),
      set('/regions/body/0/content/1', { kind: 'text', text: 'today' }),
      set('/regions/body/2/columns/2/value/format/currency', { kind: 'code', code: 'CHF' }),
      set('/regions/summary/0/components/2/source', { kind: 'asset', asset: 'seal' }),
      set('/regions/summary/2/content/1', { kind: 'text', text: 'customer' }),
      set('/paymentPart/debtor/name/0', { kind: 'text', text: 'Simon Muster' }),
      set('/paymentPart/message/1', { kind: 'text', text: '15.10.2020' }),
    ),
    at: HEADER_BINDINGS.map((binding) => `${binding}/dataset`),
  },
  // A sum over a field the dataset does not have would total nothing, or
  // fail in front of a customer.
  'unknown-field': {
    refuse: set('/aggregates/0/of/field/field', 'total'),
    accept: set('/aggregates/0/of/field/field', 'unit_price'),
    at: ['/aggregates/0/of/field/field'],
  },
  // A parameter nobody declared has no form field to collect it, so it is
  // always empty.
  'unknown-parameter': {
    refuse: set('/regions/pageHeader/0/content/0/parameter', 'to'),
    accept: both(
      set('/parameters/6', { id: 'to', type: 'date', label: 'To', required: false }),
      set('/regions/pageHeader/0/content/0/parameter', 'to'),
    ),
    at: ['/regions/pageHeader/0/content/0/parameter'],
  },
  // An image of an asset the template does not name could only be resolved
  // by fetching something, which rendering never does.
  'unknown-asset': {
    refuse: set('/regions/summary/1/source/asset', 'banner'),
    accept: set('/regions/summary/1/source/asset', 'logo'),
    at: ['/regions/summary/1/source/asset'],
  },
  // A total that names no declared aggregate has nothing to print.
  'unknown-aggregate': {
    refuse: set('/regions/body/2/totals/0/cells/2/value/aggregate', 'sum'),
    accept: set('/regions/body/2/totals/0/cells/2/value/aggregate', 'gross'),
    at: ['/regions/body/2/totals/0/cells/2/value/aggregate'],
  },
  // A total under a column the table does not have has nowhere to print.
  'unknown-column': {
    refuse: set('/regions/body/2/totals/0/cells/0/column', 'site'),
    accept: set('/regions/body/2/totals/0/cells/0/column', 'price'),
    at: ['/regions/body/2/totals/0/cells/0/column'],
  },
  // A page break in a page footer would break every page, forever.
  'misplaced-flow-component': {
    refuse: set('/regions/pageFooter/1', { id: 'late-break', kind: 'pageBreak' }),
    accept: set('/regions/summary/3', { id: 'late-break', kind: 'pageBreak' }),
    at: ['/regions/pageFooter/1'],
  },
  // A page break inside a keep-together block contradicts it, and inside a
  // column has no meaning; inside a section, it is in the flow.
  'nested-flow-component': {
    refuse: set('/regions/body/3/components/2', { id: 'inner-break', kind: 'pageBreak' }),
    accept: set('/regions/summary/0/components/3', { id: 'inner-break', kind: 'pageBreak' }),
    at: ['/regions/body/3/components/2'],
  },
  // The body is laid out before pages are counted; a page number there has
  // no single value.
  'misplaced-page-counter': {
    refuse: set('/regions/body/0/content/3', { kind: 'pageNumber' }),
    accept: set('/regions/pageHeader/0/content/1', { kind: 'pageCount' }),
    at: ['/regions/body/0/content/3'],
  },
  // A detail field outside a table has no current row: it would print the
  // first row's value, or the last, and look like a header value.
  'misplaced-detail-field': {
    refuse: set('/regions/body/0/content/1', { kind: 'field', field: { dataset: 'detail', field: 'site' } }),
    accept: set('/regions/body/0/content/1', { kind: 'field', field: { dataset: 'header', field: 'customer' } }),
    at: ['/regions/body/0/content/1/field'],
  },
  // Under the table there is no current group: a group's subtotal there
  // would be the last group's, printed as though it were the whole table's.
  'misplaced-group-aggregate': {
    refuse: set('/regions/body/2/totals/0/cells/2/value/over', 'group'),
    accept: set('/regions/body/2/group/footer/0/cells/1/value/over', 'report'),
    at: ['/regions/body/2/totals/0/cells/2/value/over'],
  },
  // Version 0 has one primary detail dataset and one table over it; a second
  // table would raise questions of order and totals the format does not
  // answer yet.
  'second-detail-table': {
    refuse: (report) => {
      setAt(report, '/regions/summary/3', { ...(getAt(report, '/regions/body/2') as object), id: 'lines-again' })
      return report
    },
    accept: (report) => {
      const table = getAt(report, '/regions/body/2')
      removeAt(report, '/regions/body/2')
      setAt(report, '/regions/summary/3', table)
      return report
    },
    at: ['/regions/summary/3'],
  },
  // Containers nest at most MAX_NESTING_DEPTH deep, which bounds the work of
  // every later stage that walks them; the bound itself is allowed.
  'nesting-too-deep': {
    refuse: set('/regions/body/5', nested(MAX_NESTING_DEPTH + 1)),
    accept: set('/regions/body/5', nested(MAX_NESTING_DEPTH)),
    at: [`/regions/body/5${'/components/0'.repeat(MAX_NESTING_DEPTH)}`],
  },
  // Component ids are unique across the whole report, not per region:
  // selection, diagnostics and undo history name a component by id alone.
  'duplicate-component-id': {
    refuse: set('/regions/summary/1/id', 'intro'),
    accept: set('/regions/summary/1/id', 'outro'),
    at: ['/regions/summary/1/id'],
  },
  // Two columns with one id: a total names a column by id and could land
  // under either.
  'duplicate-column-id': {
    refuse: set('/regions/body/2/columns/4/id', 'sku'),
    accept: set('/regions/body/2/columns/4/id', 'shipped'),
    at: ['/regions/body/2/columns/4/id'],
  },
  // Two footer cells under one column: one of the two values would be
  // printed over the other, or dropped.
  'duplicate-footer-cell': {
    refuse: set('/regions/body/2/totals/0/cells/1/column', 'sku'),
    accept: set('/regions/body/2/totals/0/cells/1/column', 'price'),
    at: ['/regions/body/2/totals/0/cells/1/column'],
  },
  // Groups are ordered by their key before any sort key, so sorting by the
  // field grouped by orders nothing, and an author reading the sort keys
  // would think it did.
  'duplicate-sort-key': {
    refuse: set('/regions/body/2/sort/1', { field: { dataset: 'detail', field: 'site' }, direction: 'desc' }),
    accept: set('/regions/body/2/sort/1', { field: { dataset: 'detail', field: 'quantity' }, direction: 'desc' }),
    at: ['/regions/body/2/sort/1/field'],
  },
  // An image wider than the printable area cannot be placed on any page; the
  // author hears so while editing, not from a failed render.
  'exceeds-printable-area': {
    refuse: set('/regions/summary/1/width', 510.25),
    accept: set('/regions/summary/1/width', 510.24),
    at: ['/regions/summary/1/width'],
  },
  // A QR-bill is printed across the foot of an A4 page in portrait (IG
  // 3.1): on a landscape page it is not at the page's foot, and on Letter
  // it does not span the page. Without a bill, landscape is the author's.
  'payment-part-page': {
    refuse: set('/page/orientation', 'landscape'),
    accept: both(remove('/paymentPart'), set('/page/orientation', 'landscape')),
    at: ['/page'],
  },
  // A sum of site names is not a number.
  'aggregate-type-mismatch': {
    refuse: set('/aggregates/0/of/field/field', 'site'),
    accept: set('/aggregates/0/of/field/field', 'quantity'),
    at: ['/aggregates/0/of/field'],
  },
  // A number format on a text field would print nothing, or NaN.
  'format-type-mismatch': {
    refuse: set('/regions/body/2/columns/0/value/format', { kind: 'number', scale: 0, grouping: false }),
    accept: set('/regions/body/2/columns/0/value/format', { kind: 'text', transform: 'lower' }),
    at: ['/regions/body/2/columns/0/value/format'],
  },
  // An image of a text field has no picture to draw; it would print an
  // empty box where the signature belongs.
  'binding-type-mismatch': {
    refuse: set('/regions/summary/0/components/2/source/field/field', 'customer'),
    accept: both(
      set('/datasets/header/fields/4', { id: 'stamp', type: 'image', label: 'Stamp', nullable: true }),
      set('/regions/summary/0/components/2/source/field/field', 'stamp'),
    ),
    at: ['/regions/summary/0/components/2/source/field'],
  },
}

function errorsOf(document: unknown): readonly ReportError[] {
  const outcome = validateReport(document)
  return outcome.valid ? [] : outcome.errors
}

describe('the error codes', () => {
  // A code with no case is a refusal nobody has watched happen; a case for a
  // code that is not listed is a test of nothing.
  test('each has exactly one refusal case, and none is listed twice', () => {
    expect(new Set(REPORT_ERROR_CODES).size).toBe(REPORT_ERROR_CODES.length)
    expect(Object.keys(CASES).sort()).toEqual([...REPORT_ERROR_CODES].sort())
  })
})

describe('validateReport, one rule at a time', () => {
  // Every case below starts from this report; if it were not valid, every
  // refusal would pass for the wrong reason.
  test('reads the fixture, and returns what it read', () => {
    const outcome = validateReport(richReport())
    expect(outcome.valid ? [] : outcome.errors).toEqual([])
    expect(outcome).toEqual({ valid: true, report: richReport() })
  })

  for (const [code, rule] of Object.entries(CASES) as [ReportErrorCode, Case][]) {
    describe(code, () => {
      test('is refused where the rule is broken, and nowhere else', () => {
        const outcome = validateReport(rule.refuse(editable(richReport())))
        expect(outcome.valid).toBe(false)
        const errors = outcome.valid ? [] : outcome.errors
        expect(errors.filter((error) => error.code === code).map((error) => error.path)).toEqual(rule.at)
        expect(errors.filter((error) => error.code !== code).map((error) => error.code)).toEqual(rule.alongside ?? [])
      })

      test('is not refused by the nearest valid edit', () => {
        expect(errorsOf(rule.accept(editable(richReport())))).toEqual([])
      })
    })
  }
})

describe('what an error says', () => {
  // A message is read by a person in the builder's review area. One that
  // says "[object Object]" or "undefined" has interpolated the wrong thing.
  test('every refusal above has a message written for a person', () => {
    for (const rule of Object.values(CASES)) {
      for (const error of errorsOf(rule.refuse(editable(richReport())))) {
        expect(error.message.length, error.code).toBeGreaterThan(10)
        expect(error.message, error.code).not.toMatch(/\[object |undefined|NaN/)
      }
    }
  })

  // The builder links an error to the component it is about. The innermost
  // component is named, not the container around it, and an error outside
  // every component names none.
  test('names the innermost component an error is inside, and none outside components', () => {
    const report = editable(richReport())
    setAt(report, '/regions/reportHeader/0/columns/1/components/0/style', 'missing')
    setAt(report, '/regions/body/2/totals/0/cells/0/column', 'missing')
    setAt(report, '/title', 7)
    const errors = errorsOf(report)
    expect(errors).toEqual([
      expect.objectContaining({ code: 'wrong-type', path: '/title' }),
      expect.objectContaining({ code: 'unknown-style', path: '/regions/reportHeader/0/columns/1/components/0/style', componentId: 'title' }),
      expect.objectContaining({ code: 'unknown-column', path: '/regions/body/2/totals/0/cells/0/column', componentId: 'lines' }),
    ])
    expect(errors[0]).not.toHaveProperty('componentId')
  })

  // Every error is collected, not only the first: an author fixing one at a
  // time would make as many round trips as there are mistakes.
  test('collects errors from unrelated parts of one report', () => {
    const report = editable(richReport())
    setAt(report, '/locale', 'english')
    setAt(report, '/regions/summary/1/fit', 'stretch')
    setAt(report, '/regions/pageFooter/0/content/1', { kind: 'pageNumber', start: 1 })
    expect(errorsOf(report).map((error) => [error.code, error.path])).toEqual([
      ['invalid-locale', '/locale'],
      ['unknown-property', '/regions/pageFooter/0/content/1/start'],
      ['not-one-of', '/regions/summary/1/fit'],
    ])
  })

  // The marker appears only past the bound: exactly MAX_ERRORS errors are
  // all listed, with nothing claiming more were found.
  test('lists exactly MAX_ERRORS errors without claiming there were more', () => {
    const report = editable(richReport())
    setAt(
      report,
      '/regions/body',
      Array.from({ length: MAX_ERRORS }, (_, index) => ({ id: `gap-${index}`, kind: 'spacer', height: 0 })),
    )
    const errors = errorsOf(report)
    expect(errors).toHaveLength(MAX_ERRORS)
    expect(errors.map((error) => error.code)).not.toContain('too-many-errors')
  })
})
