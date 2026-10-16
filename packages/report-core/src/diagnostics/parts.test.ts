import { COMPONENT_KINDS, walkComponents } from '@formancy/report-spec'
import type { TextComponent } from '@formancy/report-spec'
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
  // properties rather than the whole table's.
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
    const swapped = { ...report, regions: { ...report.regions, summary: [...report.regions.summary.slice(0, 2), asText] } }
    const parts = reportParts(report)
    expect(parts).toEqual(reportParts(swapped))
    expect(parts.expressions).toContainEqual({ cel: '" from " + params.from', scope: 'report', kind: 'computed', path: '/regions/summary/2/content/2/expression/cel', componentId: 'order-code' })
  })
})
