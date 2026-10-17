import { walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { EditorOutcome, OutlineNode } from './model.js'
import { editorOver, richReport } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

function flat(nodes: readonly OutlineNode[]): OutlineNode[] {
  return nodes.flatMap((node) => [node, ...flat(node.children)])
}

describe('the outline', () => {
  // The outline is the accessible structure of the report: every region, in
  // the order a reader meets them, named in the person's language.
  test('lists the regions in reading order, in the editor’s language', () => {
    const { editor } = editorOver(richReport(), { locale: 'de-CH' })
    expect(editor.state().outline.map((region) => [region.region, region.label])).toEqual([
      ['reportHeader', 'Berichtskopf'],
      ['pageHeader', 'Seitenkopf'],
      ['body', 'Hauptteil'],
      ['pageFooter', 'Seitenfuss'],
      ['summary', 'Zusammenfassung'],
    ])
  })

  // Every component is in the outline exactly once, at its depth, in the
  // walk's order: a component missing from it is one no keyboard reaches.
  test('holds every component once, in the walk’s order, at its depth', () => {
    const report = richReport()
    const { editor } = editorOver(report)
    const components = editor.state().outline.flatMap((region) => flat(region.nodes)).filter((node) => node.kind !== 'tableColumn')
    expect(components.map((node) => [node.id, node.depth])).toEqual(walkComponents(report).map(({ component, depth }) => [component.id, depth]))
  })

  // A table's columns are what a person selects to change a heading or a
  // width; they sit under the table, one level down.
  test('lists a table’s columns under it', () => {
    const { editor } = editorOver()
    const table = editor.state().outline[2]?.nodes.find((node) => node.id === 'lines')
    expect(table?.children.map((node) => [node.key, node.kind, node.column, node.label, node.depth])).toEqual([
      ['lines/sku', 'tableColumn', 'sku', 'SKU', 1],
      ['lines/amount', 'tableColumn', 'amount', 'Amount', 1],
    ])
  })

  // In a columns block, which column a component stands in is what tells
  // the two halves of a letterhead apart.
  test('says which column of a columns block each child stands in', () => {
    const { editor } = editorOver()
    const heading = editor.state().outline[0]?.nodes[0]
    expect(heading?.children.map((node) => [node.id, node.slot])).toEqual([
      ['logo-image', 0],
      ['title', 1],
    ])
  })

  // A label is what a person reads and what a screen reader says: a text
  // by what it prints, a bound run by what it binds, everything else by its
  // kind and what it draws.
  test('labels each component by what it prints or draws', () => {
    const { editor } = editorOver()
    const labels = Object.fromEntries(editor.state().outline.flatMap((region) => flat(region.nodes)).map((node) => [node.key, node.label]))
    expect(labels).toEqual({
      heading: 'Columns',
      'logo-image': 'Image: logo',
      title: 'Orders for [Customer]',
      rule: 'Line',
      running: '[From]',
      intro: 'Introduction',
      gap: 'Spacer',
      lines: 'Table',
      'lines/sku': 'SKU',
      'lines/amount': 'Amount',
      notes: 'Section',
      note: 'Note',
      box: 'Rectangle',
      keep: 'Keep together',
      kept: '[expression]',
      break: 'Page break',
      'page-of': 'Page [page] of [pages]',
      'signature-image': 'Image: Signature',
      'order-code': 'QR code: Orders for [Customer]',
      'pay-code': 'EPC payment code: Franz Mustermänn',
    })
  })

  // Two items with one name cannot be told apart by a screen reader, and a
  // test cannot find either by it: where labels would repeat, each says
  // its id.
  test('makes repeated labels unique with the id', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'duplicate' }))
    const body = editor.state().outline[2]?.nodes.map((node) => node.label)
    expect(body?.slice(0, 2)).toEqual(['Introduction (intro)', 'Introduction (intro-2)'])
  })

  // A long paragraph is not an outline row; it is cut where a person can
  // still recognise it, and says it was cut.
  test('cuts a long text’s label short, and collapses its spaces', () => {
    const report: ReportDefinition = richReport()
    const long = { id: 'long', kind: 'text', content: [{ kind: 'text', text: `  A   very long   paragraph ${'x'.repeat(80)}` }] } as const
    const { editor } = editorOver({ ...report, regions: { ...report.regions, body: [long, ...report.regions.body] } })
    const label = editor.state().outline[2]?.nodes[0]?.label ?? ''
    expect(label.startsWith('A very long paragraph x')).toBe(true)
    expect(label.endsWith('…')).toBe(true)
    expect(label.length).toBeLessThanOrEqual(41)
  })

  // A total in a text is named by the aggregate it prints.
  test('labels a printed total by its aggregate', () => {
    const report: ReportDefinition = richReport()
    const total = { id: 'grand', kind: 'text', content: [{ kind: 'text', text: 'Total ' }, { kind: 'aggregate', aggregate: 'total', over: 'report' }] } as const
    const { editor } = editorOver({ ...report, regions: { ...report.regions, summary: [total] } })
    expect(editor.state().outline[4]?.nodes[0]?.label).toBe('Total [total]')
  })

  // A text with nothing to print would be a row with no name.
  test('labels a text that prints nothing by its kind', () => {
    const report: ReportDefinition = richReport()
    const empty = { id: 'blank', kind: 'text', content: [{ kind: 'text', text: '   ' }] } as const
    const { editor } = editorOver({ ...report, regions: { ...report.regions, body: [empty, ...report.regions.body] } })
    expect(editor.state().outline[2]?.nodes[0]?.label).toBe('Text')
  })

  // A QR code is named by what it encodes, as a text by what it prints,
  // but says it is a code: a text and a code of the same words would
  // otherwise be one name for two rows. One whose only run is empty text,
  // which report-spec allows and a final render refuses, would be
  // "QR code: ", a name that trails off.
  test('labels a QR code by its kind and what it encodes, or its kind alone', () => {
    const report: ReportDefinition = richReport()
    const link = { id: 'link', kind: 'qrCode', content: [{ kind: 'text', text: 'https://example.com/a/' }, { kind: 'parameter', parameter: 'from' }], size: 60, errorCorrection: 'M' } as const
    const blank = { id: 'blank', kind: 'qrCode', content: [{ kind: 'text', text: '' }], size: 60, errorCorrection: 'M' } as const
    const { editor } = editorOver({ ...report, regions: { ...report.regions, summary: [link, blank] } })
    expect(editor.state().outline[4]?.nodes.map((node) => node.label)).toEqual(['QR code: https://example.com/a/[From]', 'QR code'])
    expect(editorOver({ ...report, regions: { ...report.regions, summary: [link] } }, { locale: 'fr-CH' }).editor.state().outline[4]?.nodes[0]?.label).toBe('Code QR : https://example.com/a/[From]')
  })

  // The selected row is the one `aria-selected` marks and focus goes to.
  test('marks the selected row, a column included', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'amount' }))
    const selected = editor.state().outline.flatMap((region) => flat(region.nodes)).filter((node) => node.selected)
    expect(selected.map((node) => node.key)).toEqual(['lines/amount'])
  })

  // An error shown only in the problems list is easy to miss; the row it
  // is about carries a count.
  test('counts the diagnostics about each row', () => {
    const report = richReport()
    const broken = { ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.nope' } } : component)) } }
    const { editor } = editorOver(broken)
    const intro = editor.state().outline[2]?.nodes[0]
    expect(intro?.problems).toBe(1)
    expect(editor.state().outline[2]?.nodes[1]?.problems).toBe(0)
  })

  // A count is drawn in the colour of the worst problem it counts. Decided
  // here, from the diagnostics, rather than by each builder from the
  // problems list: two builders that each worked it out could draw one
  // error red and the other amber, and nothing would compare them. An error
  // wins whichever comes first, and a row with none has no severity. A
  // table's column and its table are two counts: an error in a column is
  // not the table's.
  test('says the worst severity of a row’s problems, and the same on its canvas box', () => {
    const report = richReport()
    const broken: ReportDefinition = {
      ...report,
      styles: [...report.styles, { id: 'unused', size: 9 }],
      regions: {
        ...report.regions,
        body: report.regions.body.map((component) => {
          if (component.id === 'intro') return { ...component, content: [{ kind: 'text', text: '' }], visibleWhen: { cel: 'params.nope' } }
          if (component.kind === 'table') return { ...component, columns: component.columns.map((column) => (column.id === 'sku' ? { ...column, value: { kind: 'expression', expression: { cel: 'params.nope' } } } : column)) }
          return component.id === 'gap' ? { id: 'blank', kind: 'text', content: [{ kind: 'text', text: '' }] } : component
        }),
      },
    } as ReportDefinition
    const { editor } = editorOver(broken)
    const rows = new Map(editor.state().outline.flatMap((region) => flat(region.nodes)).map((node) => [node.key, node]))
    expect(rows.get('intro')).toMatchObject({ problems: 2, severity: 'error' })
    expect(rows.get('blank')).toMatchObject({ problems: 1, severity: 'warning' })
    expect(rows.get('note')?.severity).toBeUndefined()
    expect(rows.get('lines/sku')).toMatchObject({ problems: 1, severity: 'error' })
    expect(rows.get('lines')).toMatchObject({ problems: 0 })
    expect(rows.get('lines')?.severity).toBeUndefined()
    const boxes = new Map(editor.state().canvas.boxes.map((box) => [box.key, box]))
    expect(boxes.get('intro')?.severity).toBe('error')
    expect(boxes.get('blank')?.severity).toBe('warning')
    expect(boxes.get('note')?.severity).toBeUndefined()
  })

  // A box wider than the space it stands in is marked on the canvas, where
  // a pointer finds it; the row says the same, so a keyboard, which never
  // rests on a box, learns it too.
  test('says which rows are wider than the space they stand in, as the canvas does', () => {
    const report = richReport()
    const side = { id: 'side', kind: 'columns', columns: [{ width: 100, components: [{ id: 'wide', kind: 'rectangle', width: 150, height: 20 }] }, { width: 'fill', components: [] }] }
    const { editor } = editorOver({ ...report, regions: { ...report.regions, body: [...report.regions.body, side] } } as ReportDefinition)
    const rows = editor.state().outline.flatMap((region) => flat(region.nodes))
    expect(rows.filter((node) => node.overflows).map((node) => node.key)).toEqual(['wide'])
    expect(editor.state().canvas.boxes.filter((box) => box.overflows).map((box) => box.key)).toEqual(['wide'])
  })
})
