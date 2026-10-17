import { COMPONENT_KINDS, QR_BILL_ADDRESS_RULES, walkComponents } from '@formancy/report-spec'
import type { EpcQrCodeComponent, Inline, ReportDefinition, SwissQrBill, TextComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { frozenSample, sampleReport } from '../test-support.js'
import { expressionSites, reportParts } from './parts.js'
import type { ExpressionSite } from './parts.js'

/** The pointer of every `cel` string in a JSON value: every expression it holds, found without knowing the format. */
function celPointers(value: unknown, base = ''): string[] {
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) => (key === 'cel' && typeof child === 'string' ? [`${base}/cel`] : celPointers(child, `${base}/${key}`)))
}

describe('expressionSites', () => {
  // The walk is what decides each expression's scope; an expression it
  // missed would be checked by nobody and fail only when a report renders.
  // Derived from the document itself, so a new place for an expression in
  // the format fails here until the walk knows it.
  test('finds every expression in the report', () => {
    const report = frozenSample()
    expect(expressionSites(report).map(({ path }) => path).sort()).toEqual(celPointers(report).sort())
  })

  // Each expression is compiled against the names its place binds and with
  // the policy of what it is for (0007's scopes; plan 15). One in a table's
  // column names the column too, so the editor opens that column's
  // properties rather than the whole table's; one in the payment part names
  // no component, and comes after every component's.
  test('gives each expression its scope, its kind, and the component and column it is in', () => {
    const said = ({ path, scope, kind, componentId, columnId }: ExpressionSite): string => `${scope} ${kind} ${componentId ?? '-'}${columnId === undefined ? '' : `/${columnId}`} ${path}`
    expect(expressionSites(frozenSample()).map(said)).toEqual([
      'report visible intro /regions/body/0/visibleWhen/cel',
      'report visible intro /regions/body/0/styleWhen/0/when/cel',
      'report computed intro /regions/body/0/content/2/expression/cel',
      'row computed lines/amount /regions/body/2/columns/3/value/expression/cel',
      'row visible lines/amount /regions/body/2/columns/3/styleWhen/0/when/cel',
      'report visible lines/shipped-at /regions/body/2/columns/4/visibleWhen/cel',
      'row visible lines/shipped-at /regions/body/2/columns/4/styleWhen/0/when/cel',
      'group computed lines /regions/body/2/group/header/2/expression/cel',
      'group computed lines /regions/body/2/group/footer/0/cells/1/value/expression/cel',
      'report computed lines /regions/body/2/totals/1/cells/1/value/expression/cel',
      'report visible closing /regions/summary/0/visibleWhen/cel',
      'report computed statistics /regions/summary/0/components/1/content/3/expression/cel',
      'report computed order-code /regions/summary/2/content/2/expression/cel',
      'report computed payment-code /regions/summary/3/amount/cel',
      'report computed payment-code /regions/summary/3/information/1/expression/cel',
      'report computed - /paymentPart/amount/cel',
      'report computed - /paymentPart/message/1/expression/cel',
      'row computed - /aggregates/2/of/expression/cel',
    ])
  })
})

describe('a bare table', () => {
  // Sort keys, a group and totals are optional; a table with none of them
  // is walked for its columns alone.
  test('is walked for its columns alone', () => {
    const report = sampleReport()
    const lines = report.regions.body[2]
    if (lines?.kind !== 'table') throw new Error('the sample has no table')
    const { sort: _sort, group: _group, totals: _totals, ...bare } = lines
    const parts = reportParts({ ...report, regions: { ...report.regions, body: [bare] } })
    expect(parts.expressions.filter(({ componentId }) => componentId === 'lines').map(({ path }) => path)).toEqual([
      '/regions/body/0/columns/3/value/expression/cel',
      '/regions/body/0/columns/3/styleWhen/0/when/cel',
      '/regions/body/0/columns/4/visibleWhen/cel',
      '/regions/body/0/columns/4/styleWhen/0/when/cel',
    ])
  })
})

describe('reportParts', () => {
  // READERS is total by type, but a reader that throws, or misses what its
  // kind holds, shows only on a report that holds that kind. The sample is
  // that report for every test here; a kind added to the format and not to
  // the sample would be read by none of them.
  test('reads a report that holds every component kind', () => {
    const report = frozenSample()
    expect(new Set(walkComponents(report).map(({ component }) => component.kind))).toEqual(new Set(COMPONENT_KINDS))
    expect(() => reportParts(report)).not.toThrow()
  })

  // What the report uses is what the unused-declaration warnings are
  // measured against: every style, asset, field, parameter and aggregate
  // named anywhere outside an expression.
  test('collects every reference outside expressions', () => {
    const parts = reportParts(frozenSample())
    expect(new Set(parts.styles)).toEqual(new Set(sampleReport().styles.map(({ id }) => id)))
    expect(new Set(parts.assets)).toEqual(new Set(['logo', 'seal']))
    expect(new Set(parts.parameters)).toEqual(new Set(['from', 'threshold', 'currency']))
    expect(new Set(parts.aggregates)).toEqual(new Set(['subtotal', 'lines', 'average', 'latest']))
    expect(new Set(parts.fields.map(({ dataset, field }) => `${dataset}.${field}`))).toEqual(
      new Set([
        'header.customer',
        'header.orderedOn',
        'header.currency',
        'header.signature',
        'detail.sku',
        'detail.quantity',
        'detail.unit_price',
        'detail.shippedAt',
        'detail.site',
        'detail.amount',
        'detail.recordedAt',
      ]),
    )
  })
})

describe('a QR code', () => {
  // A QR code encodes what its content prints, read as a paragraph in its
  // place is read: the fields, parameters and aggregates it names are used,
  // and an expression in it is compiled in the report's scope and named
  // after the code. Read any other way, an expression in it would go
  // unchecked until a render refused it, and a declaration only it names
  // would be called unused.
  test('is read as a text with the same content in its place is', () => {
    const report = sampleReport()
    const code = report.regions.summary[2]
    if (code?.kind !== 'qrCode') throw new Error('the sample has no QR code at the end of its summary')
    const { size: _size, errorCorrection: _errorCorrection, ...shared } = code
    const asText: TextComponent = { ...shared, kind: 'text' }
    const swapped = { ...report, regions: { ...report.regions, summary: [...report.regions.summary.slice(0, 2), asText, ...report.regions.summary.slice(3)] } }
    const parts = reportParts(report)
    expect(parts).toEqual(reportParts(swapped))
    expect(parts.expressions).toContainEqual({ cel: '" from " + params.from', scope: 'report', kind: 'computed', path: '/regions/summary/2/content/2/expression/cel', componentId: 'order-code' })
  })
})

describe('an EPC QR code', () => {
  /** The sample with its EPC QR code replaced by what `change` makes of it. */
  function withCode(change: (code: EpcQrCodeComponent) => EpcQrCodeComponent): ReportDefinition {
    const report = sampleReport()
    const code = report.regions.summary[3]
    if (code?.kind !== 'epcQrCode') throw new Error('the sample has no EPC QR code at the end of its summary')
    return { ...report, regions: { ...report.regions, summary: [...report.regions.summary.slice(0, 3), change(code)] } }
  }

  // Its texts are read as a paragraph's in its place, in the report's
  // scope, and its amount as a value, each named after the code: the
  // editor opens the code's properties for either. Read any other way, an
  // expression in a code would go unchecked until a render refused it.
  test("is read in the report's scope, its amount as the code's amount, named after the code", () => {
    expect(reportParts(frozenSample()).expressions.filter(({ componentId }) => componentId === 'payment-code')).toEqual([
      { cel: 'totals.subtotal', scope: 'report', kind: 'computed', path: '/regions/summary/3/amount/cel', componentId: 'payment-code', amount: 'an EPC QR code' },
      { cel: '" for " + header.customer', scope: 'report', kind: 'computed', path: '/regions/summary/3/information/1/expression/cel', componentId: 'payment-code' },
    ])
  })

  // Every text a code holds is read: with an expression in each, the sites
  // found are every expression the code holds, found without knowing the
  // format, in the order its payload holds them. A text the walk left out
  // would be one nobody checks.
  test('reads every text it holds, in the order its payload holds them', () => {
    const run = (at: string): Inline[] => [{ kind: 'expression', expression: { cel: `"${at}"` } }]
    const everywhere = withCode(({ reference: _reference, ...code }) => ({
      ...code,
      bic: run('bic'),
      beneficiary: run('beneficiary'),
      iban: run('iban'),
      text: run('text'),
      information: run('information'),
    }))
    const found = expressionSites(everywhere).filter(({ componentId }) => componentId === 'payment-code')
    expect(found.map(({ path }) => path)).toEqual(['bic', 'beneficiary', 'iban', 'amount', 'text', 'information'].map((key) => (key === 'amount' ? '/regions/summary/3/amount/cel' : `/regions/summary/3/${key}/0/expression/cel`)))
    expect(found.map(({ path }) => path).sort()).toEqual(celPointers(everywhere.regions.summary[3], '/regions/summary/3').sort())
    const withReference = withCode((code) => ({ ...code, reference: run('reference') }))
    expect(expressionSites(withReference).map(({ path }) => path)).toContain('/regions/summary/3/reference/0/expression/cel')
  })

  // A code needs only its size, its beneficiary and its IBAN: one without
  // an amount, a BIC or any remittance is read for what it holds.
  test('is read for what it holds when it holds only what it must', () => {
    const bare = withCode(({ bic: _bic, amount: _amount, purpose: _purpose, reference: _reference, information: _information, ...code }) => code)
    expect(expressionSites(bare).filter(({ componentId }) => componentId === 'payment-code')).toEqual([])
  })

  // What its texts name is used: a parameter and an aggregate named
  // nowhere else are no unused declarations.
  test('collects what its texts name', () => {
    const parts = reportParts(
      withCode((code) => ({
        ...code,
        beneficiary: [{ kind: 'parameter', parameter: 'copies' }],
        information: [{ kind: 'aggregate', aggregate: 'gross', over: 'report' }],
      })),
    )
    expect(parts.parameters).toContain('copies')
    expect(parts.aggregates).toContain('gross')
  })
})

describe('a payment part', () => {
  // A QR-bill's texts are read as a paragraph's in the report's scope, and
  // its amount as a value, compiled where it stands and named by its path:
  // the bill stands in no component. Read any other way, an expression in
  // a bill would go unchecked until a render refused it, and a field only
  // the bill prints would be called unused.
  test("is read in the report's scope, its amount as the bill's amount", () => {
    const parts = reportParts(frozenSample())
    expect(parts.expressions.filter(({ path }) => path.startsWith('/paymentPart/'))).toEqual([
      { cel: 'totals.subtotal', scope: 'report', kind: 'computed', path: '/paymentPart/amount/cel', amount: 'a QR-bill' },
      { cel: '" for " + header.customer', scope: 'report', kind: 'computed', path: '/paymentPart/message/1/expression/cel' },
    ])
  })

  // Every text a bill holds is read, each part of both addresses among
  // them: with an expression in each, the sites found are every expression
  // the document holds, found without knowing the format. A text the walk
  // left out would be one nobody checks.
  test('reads every text it holds, and every part of both addresses', () => {
    const report = sampleReport()
    const run = (at: string): Inline[] => [{ kind: 'expression', expression: { cel: `"${at}"` } }]
    const address = (party: string) => Object.fromEntries(Object.keys(QR_BILL_ADDRESS_RULES).map((part) => [part, run(`${party} ${part}`)]))
    const bill = report.paymentPart as SwissQrBill
    const everywhere: ReportDefinition = {
      ...report,
      paymentPart: {
        ...bill,
        account: run('account'),
        creditor: address('creditor') as unknown as SwissQrBill['creditor'],
        debtor: address('debtor') as unknown as SwissQrBill['creditor'],
        reference: run('reference'),
        message: run('message'),
        billingInformation: run('billing'),
      },
    }
    const found = expressionSites(everywhere).filter(({ path }) => path.startsWith('/paymentPart/'))
    expect(found.map(({ path }) => path).sort()).toEqual(celPointers(everywhere.paymentPart, '/paymentPart').sort())
    expect(found).toHaveLength(17)
    expect(found.every(({ scope, kind, componentId }) => scope === 'report' && kind === 'computed' && componentId === undefined)).toBe(true)
  })

  // A bill needs only its language, its account, its creditor and its
  // currency: SIX's third example has no amount, no debtor, no reference
  // and no message. A walk that read an absent text as present would throw
  // on the commonest donation slip there is.
  test('is read for what it holds when it holds only what it must', () => {
    const report = sampleReport()
    const { amount: _amount, debtor: _debtor, reference: _reference, message: _message, billingInformation: _billing, ...bare } = report.paymentPart as SwissQrBill
    const parts = reportParts({ ...report, paymentPart: { ...bare, account: [{ kind: 'expression', expression: { cel: 'header.customer' } }] } })
    expect(parts.expressions.filter(({ path }) => path.startsWith('/paymentPart/')).map(({ path }) => path)).toEqual(['/paymentPart/account/0/expression/cel'])
  })

  // What the bill's texts name is used: a header field, a parameter and an
  // aggregate named nowhere else are no unused declarations.
  test('collects what its texts name', () => {
    const report = sampleReport()
    const bill = report.paymentPart as SwissQrBill
    const named: ReportDefinition = {
      ...report,
      paymentPart: {
        ...bill,
        message: [
          { kind: 'parameter', parameter: 'copies' },
          { kind: 'aggregate', aggregate: 'gross', over: 'report' },
        ],
      },
    }
    const parts = reportParts(named)
    expect(parts.parameters).toContain('copies')
    expect(parts.aggregates).toContain('gross')
    expect(parts.fields).toContainEqual({ dataset: 'header', field: 'customer' })
  })
})
