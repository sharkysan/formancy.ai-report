import { describe, expect, test } from 'vitest'
import { MAX_NESTING_DEPTH, MAX_REGION_COMPONENTS } from './limits.js'
import { append, edited, editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { EXPRESSION_NAMES, REGION_NAMES } from './types.js'

const FLOW_REGIONS: readonly string[] = ['body', 'summary']

/** The fixture's table, taken out of the body. */
function takeTable(report: Record<string, unknown>): unknown {
  const table = getAt(report, '/regions/body/2')
  removeAt(report, '/regions/body/2')
  return table
}

describe('where components may stand', () => {
  // Page regions repeat on every page at a fixed height; a block that flows,
  // breaks or holds a growing table there has no defined layout. Each of the
  // three is refused in each of the three page-bound regions and read in
  // both flowing ones.
  test('tables, page breaks and keep-together blocks only in the body and the summary', () => {
    for (const region of REGION_NAMES) {
      const allowed = FLOW_REGIONS.includes(region)
      for (const component of [
        { id: 'moved', kind: 'pageBreak' },
        { id: 'moved', kind: 'keepTogether', components: [] },
      ]) {
        const report = editable(richReport())
        const at = append(report, `/regions/${region}`, component)
        expect(refusals(report), `${component.kind} in ${region}`).toEqual(allowed ? [] : [`misplaced-flow-component ${at}`])
      }
      const report = editable(richReport())
      const at = append(report, `/regions/${region}`, takeTable(report))
      expect(refusals(report), `table in ${region}`).toEqual(allowed ? [] : [`misplaced-flow-component ${at}`])
    }
  })

  // A table or a page break is part of the flow. Inside a columns block it
  // would have to break across pages inside one column, and inside a
  // keep-together block it contradicts it; the renderer-neutral document
  // can hold neither. A section adds no layout, so either may stand in one,
  // and a section inside a keep-together block is still inside it.
  test('tables and page breaks stand in the flow: in sections, not in columns or keep-together blocks', () => {
    // With the table taken out, the keep-together block is the body's third.
    const inKeep = edited((r) => {
      const table = takeTable(r)
      setAt(r, '/regions/body/2/components/2', table)
    })
    expect(refusals(inKeep)).toEqual(['nested-flow-component /regions/body/2/components/2'])
    const inColumn = edited((r) =>
      setAt(r, '/regions/body/5', {
        id: 'two',
        kind: 'columns',
        columns: [
          { width: 'fill', components: [{ id: 'inner-break', kind: 'pageBreak' }] },
          { width: 'fill', components: [] },
        ],
      }),
    )
    expect(refusals(inColumn)).toEqual(['nested-flow-component /regions/body/5/columns/0/components/0'])
    const inSection = edited((r) => setAt(r, '/regions/summary/0/components/3', takeTable(r)))
    expect(refusals(inSection)).toEqual([])
    const sectionInKeep = edited((r) => {
      const table = takeTable(r)
      setAt(r, '/regions/body/2/components/2', { id: 'wrapper', kind: 'section', components: [table] })
    })
    expect(refusals(sectionInKeep)).toEqual(['nested-flow-component /regions/body/2/components/2/components/0'])
  })

  // Columns and sections nest as keep-together blocks do, and count toward
  // the same depth: a bound that one container kind could step around
  // bounds nothing.
  test('columns and sections count toward the nesting depth', () => {
    const columns = (inner: unknown, level: number): unknown => ({
      id: `columns-${level}`,
      kind: 'columns',
      columns: [
        { width: 'fill', components: [inner] },
        { width: 'fill', components: [] },
      ],
    })
    const section = (inner: unknown, level: number): unknown => ({ id: `section-${level}`, kind: 'section', components: [inner] })
    for (const [container, step] of [
      [columns, '/columns/0/components/0'],
      [section, '/components/0'],
    ] as const) {
      let deepest: unknown = { id: 'leaf', kind: 'spacer', height: 1 }
      for (let level = MAX_NESTING_DEPTH; level >= 1; level -= 1) deepest = container(deepest, level)
      expect(refusals(edited((r) => setAt(r, '/regions/body/5', deepest)))).toEqual([])
      expect(refusals(edited((r) => setAt(r, '/regions/body/5', container(deepest, 0))))).toEqual([
        `nesting-too-deep /regions/body/5${step.repeat(MAX_NESTING_DEPTH)}`,
      ])
    }
  })

  // The component bound is per region and counts what containers hold, so
  // wrapping components in a keep-together block does not get round it.
  // Once spent, it is reported once, and what follows is not read.
  test('a region holds at most MAX_REGION_COMPONENTS components, counting those inside containers', () => {
    const fill = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `gap-${index}`, kind: 'spacer', height: 1 }))
    const after = { id: 'after', kind: 'spacer', height: 1 }
    const region = (inside: number) => [{ id: 'wrap', kind: 'keepTogether', components: fill(inside) }, after]
    expect(refusals(edited((r) => setAt(r, '/regions/summary', region(MAX_REGION_COMPONENTS - 2))))).toEqual([])
    expect(refusals(edited((r) => setAt(r, '/regions/summary', region(MAX_REGION_COMPONENTS - 1))))).toEqual(['too-many /regions/summary'])
    expect(refusals(edited((r) => setAt(r, '/regions/summary', region(MAX_REGION_COMPONENTS))))).toEqual(['too-many /regions/summary'])
  })

  // Everything that comes in kinds says which with `kind`; without one there
  // is no shape to check it against, and guessing one would read a typo as
  // something else.
  test('a component, inline, format or source without a kind is refused as missing one', () => {
    for (const pointer of [
      '/regions/body/1',
      '/regions/body/0/content/0',
      '/regions/body/2/columns/0/value/format',
      '/regions/body/2/columns/2/value/format/currency',
      '/regions/summary/1/source',
      '/aggregates/0/of',
      '/provenance',
    ]) {
      expect(refusals(edited((r) => removeAt(r, `${pointer}/kind`))), pointer).toEqual([`missing-property ${pointer}/kind`])
    }
  })
})

describe('where values may stand', () => {
  // Every saved condition and computed column is written against these
  // names. If the runtime bound others -- `rows`, `parameters`,
  // `data.header` -- every published template would change meaning or stop
  // compiling, so they are part of the format and fixed here.
  test('an expression reads params, header and totals everywhere, a row in a cell and a group in its rows', () => {
    expect(EXPRESSION_NAMES).toEqual({
      report: ['params', 'header', 'totals'],
      group: ['params', 'header', 'totals', 'group'],
      row: ['params', 'header', 'totals', 'row'],
    })
  })

  // A page number has a value only where pages are drawn: in the page
  // header and footer. Everywhere else -- the report header, the body, the
  // summary, a table's cells, group headers and footers -- it is refused.
  test('page numbers and counts only in the page header and footer', () => {
    for (const region of REGION_NAMES) {
      for (const counter of [{ kind: 'pageNumber' }, { kind: 'pageCount' }]) {
        const report = edited((r) => setAt(r, `/regions/${region}/0`, { id: 'counter', kind: 'text', content: [counter] }))
        const allowed = region === 'pageHeader' || region === 'pageFooter'
        expect(refusals(report), `${counter.kind} in ${region}`).toEqual(allowed ? [] : [`misplaced-page-counter /regions/${region}/0/content/0`])
      }
    }
    for (const pointer of ['/regions/body/2/group/header/2', '/regions/body/2/columns/0/value', '/regions/body/2/totals/0/cells/0/value']) {
      expect(refusals(edited((r) => setAt(r, pointer, { kind: 'pageNumber' }))), pointer).toEqual([`misplaced-page-counter ${pointer}`])
    }
  })

  // A detail field has a value only where there is a current row: in the
  // table's cells. In a group header or footer the one detail field with a
  // single value is the one grouped by; under the table and outside it
  // there is none. A header field has one value everywhere.
  test('detail fields where there is a current row, header fields anywhere', () => {
    const site = { kind: 'field', field: { dataset: 'detail', field: 'site' } }
    const sku = { kind: 'field', field: { dataset: 'detail', field: 'sku' } }
    const nested = edited((r) => setAt(r, '/regions/reportHeader/0/columns/1/components/0/content/1/field', { dataset: 'detail', field: 'site' }))
    expect(refusals(nested)).toEqual(['misplaced-detail-field /regions/reportHeader/0/columns/1/components/0/content/1/field'])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/group/header/1', sku)))).toEqual(['misplaced-detail-field /regions/body/2/group/header/1/field'])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/group/footer/0/cells/0/value', site)))).toEqual([])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/group/footer/0/cells/0/value', sku)))).toEqual([
      'misplaced-detail-field /regions/body/2/group/footer/0/cells/0/value/field',
    ])
    expect(refusals(edited((r) => setAt(r, '/regions/body/2/totals/0/cells/0/value', site)))).toEqual(['misplaced-detail-field /regions/body/2/totals/0/cells/0/value/field'])
    const headerInGroup = edited((r) => setAt(r, '/regions/body/2/group/header/2', { kind: 'field', field: { dataset: 'header', field: 'customer' } }))
    expect(refusals(headerInGroup)).toEqual([])
  })

  // The same rule holds wherever a field is named: a currency read per row
  // stands in a cell, not under the table, and an image is drawn once, so
  // its field is a header field.
  test('the same rule for a currency field and an image field', () => {
    const rowCurrency = { kind: 'field', field: { dataset: 'detail', field: 'site' } }
    const inCell = edited((r) => setAt(r, '/regions/body/2/columns/2/value/format/currency', rowCurrency))
    expect(refusals(inCell)).toEqual([])
    const underTable = edited((r) =>
      setAt(r, '/regions/body/2/totals/0/cells/2/value/format', { kind: 'currency', currency: rowCurrency, scale: 2 }),
    )
    expect(refusals(underTable)).toEqual(['misplaced-detail-field /regions/body/2/totals/0/cells/2/value/format/currency/field'])
    const photo = edited((r) => setAt(r, '/regions/summary/0/components/2/source/field', { dataset: 'detail', field: 'photo' }))
    expect(refusals(photo)).toEqual(['misplaced-detail-field /regions/summary/0/components/2/source/field'])
  })

  // A group's aggregate has a value only while a group is current: in its
  // header and footer. An aggregate over every row has one everywhere,
  // in a cell and in a group's rows included.
  test('aggregates over a group only in its header and footer, over the report anywhere', () => {
    const over = (scope: string) => ({ kind: 'aggregate', aggregate: 'subtotal', over: scope })
    for (const pointer of ['/regions/body/2/group/header/2', '/regions/body/2/group/footer/0/cells/0/value']) {
      expect(refusals(edited((r) => setAt(r, pointer, over('group')))), pointer).toEqual([])
    }
    for (const pointer of ['/regions/body/2/columns/0/value', '/regions/summary/0/components/1/content/0', '/regions/pageFooter/0/content/0']) {
      expect(refusals(edited((r) => setAt(r, pointer, over('group')))), pointer).toEqual([`misplaced-group-aggregate ${pointer}/over`])
      expect(refusals(edited((r) => setAt(r, pointer, over('report')))), pointer).toEqual([])
    }
  })
})

describe('what fits on the page', () => {
  // The page and its margins are in the same document as the content, so a
  // fixed size that can never fit is refused while the author edits, not at
  // render time. A4 portrait with the fixture's margins leaves 510.24 by
  // 728.51 points; landscape swaps the page's sides first.
  test('an image, rectangle or spacer larger than the printable area is refused, at any depth', () => {
    const cases: [string, number, number][] = [
      ['/regions/summary/1/width', 510.24, 510.25],
      ['/regions/summary/1/height', 728.51, 728.52],
      ['/regions/body/3/components/0/width', 510.24, 510.25],
      ['/regions/body/3/components/0/height', 728.51, 728.52],
      ['/regions/body/1/height', 728.51, 728.52],
      ['/regions/reportHeader/0/columns/0/components/0/width', 510.24, 510.25],
    ]
    for (const [pointer, fits, exceeds] of cases) {
      expect(refusals(edited((r) => setAt(r, pointer, fits))), pointer).toEqual([])
      expect(refusals(edited((r) => setAt(r, pointer, exceeds))), pointer).toEqual([`exceeds-printable-area ${pointer}`])
    }
    // Without the fixture's QR-bill, which is printed on A4 in portrait only.
    const landscape = edited((r) => {
      removeAt(r, '/paymentPart')
      setAt(r, '/page/orientation', 'landscape')
      setAt(r, '/regions/summary/1/width', 700)
    })
    expect(refusals(landscape)).toEqual([])
  })

  // Fixed column widths add up; what they leave is shared by the fill
  // columns. Fixed widths wider together than the printable area leave the
  // table or the block no way to be drawn.
  test('the fixed widths of a table or a columns block add up to at most the printable width', () => {
    // The fixture's table has fixed columns of 80, 50, 80 and 70 points.
    const table = (width: number) => edited((r) => setAt(r, '/regions/body/2/columns/0/width', width))
    expect(refusals(table(310.24))).toEqual([])
    expect(refusals(table(310.25))).toEqual(['exceeds-printable-area /regions/body/2/columns'])
    const block = (width: number) => edited((r) => setAt(r, '/regions/reportHeader/0/columns/1/width', width))
    expect(refusals(block(390.24))).toEqual([])
    expect(refusals(block(390.25))).toEqual(['exceeds-printable-area /regions/reportHeader/0/columns'])
  })

  // Margins that leave too little are the page's error, not every image's:
  // with no printable area to measure against, sizes are not measured.
  // These leave 65.28 points, less than the fixture's table or images need.
  test('sizes are not measured against a page whose margins are already refused', () => {
    const report = edited((r) => {
      setAt(r, '/page/margins/left', 300)
      setAt(r, '/page/margins/right', 230)
    })
    expect(refusals(report)).toEqual(['printable-area-too-small /page/margins'])
  })
})
