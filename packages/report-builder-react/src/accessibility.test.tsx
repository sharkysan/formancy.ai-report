/**
 * Every part of the builder, named and audited, over a report that holds
 * every kind of component: each outline row selected in turn, so every kind
 * of property control is drawn, and the builder with a place dialog open.
 *
 * The scenarios audit the states they end in; these audit the states they
 * never reach. Two checks, because neither alone is enough: axe finds what
 * it is sure of, and says nothing of a control named by an empty string
 * when the markup gives it a way to be named; so every element with a role
 * a person operates or reads is also asked its name.
 */
import { createReportEditor, editorText, PROPERTY_KINDS } from '@formancy/report-builder-core'
import type { EditorState, OutlineNode } from '@formancy/report-builder-core'
import type { FieldRef, ReportDefinition } from '@formancy/report-spec'
import { cleanup, screen } from '@testing-library/react'
import { computeAccessibleDescription, computeAccessibleName } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { mount, sessionOver, violations } from './test-support.js'

afterEach(cleanup)

const t = editorText('en')
const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

/** One report with every component kind, a table with columns, every kind of run, and containers in the regions that hold them. */
function everyKind(): ReportDefinition {
  return {
    reportSpecVersion: '0',
    id: 'orders',
    title: 'Orders',
    locale: 'de-CH',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
    styles: [
      { id: 'title', size: 18, bold: true },
      { id: 'small', size: 8 },
    ],
    datasets: {
      header: {
        id: 'order-header',
        fields: [
          { id: 'customer', type: 'string', label: 'Customer', nullable: false },
          { id: 'signature', type: 'image', label: 'Signature', nullable: true },
        ],
      },
      detail: {
        id: 'order-lines',
        fields: [
          { id: 'site', type: 'string', label: 'Site', nullable: false },
          { id: 'sku', type: 'string', label: 'SKU', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
        ],
      },
    },
    parameters: [{ id: 'from', type: 'date', label: 'From', required: true }],
    assets: [{ id: 'logo', mediaType: 'image/png', digest: `sha256:${'ab'.repeat(32)}` }],
    aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: detail('amount') } }],
    regions: {
      reportHeader: [
        {
          id: 'heading',
          kind: 'columns',
          columns: [
            { width: 120, components: [{ id: 'logo-image', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 100, height: 40, fit: 'contain' }] },
            { width: 'fill', components: [{ id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Orders for ' }, { kind: 'field', field: header('customer') }] }] },
          ],
        },
        { id: 'rule', kind: 'line', thickness: 0.5, color: '#999999' },
      ],
      pageHeader: [{ id: 'running', kind: 'text', style: 'small', content: [{ kind: 'parameter', parameter: 'from' }] }],
      body: [
        { id: 'intro', kind: 'text', visibleWhen: { cel: 'params.from != ""' }, content: [{ kind: 'text', text: 'Introduction' }] },
        { id: 'gap', kind: 'spacer', height: 12 },
        {
          id: 'lines',
          kind: 'table',
          dataset: 'detail',
          columns: [
            { id: 'sku', header: 'SKU', width: 80, align: 'left', value: { kind: 'field', field: detail('sku') } },
            { id: 'amount', header: 'Amount', width: 'fill', align: 'right', value: { kind: 'field', field: detail('amount') } },
          ],
          group: { by: detail('site'), direction: 'asc', header: [{ kind: 'field', field: detail('site') }], footer: [] },
          totals: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report' } }] }],
          emptyText: 'No lines.',
          repeatHeader: true,
        },
        {
          id: 'notes',
          kind: 'section',
          padding: 6,
          border: { thickness: 0.5, color: '#333333' },
          components: [
            { id: 'note', kind: 'text', content: [{ kind: 'text', text: 'Note' }] },
            { id: 'box', kind: 'rectangle', width: 200, height: 40, fill: '#eeeeee' },
          ],
        },
        { id: 'keep', kind: 'keepTogether', components: [{ id: 'kept', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'header.customer' } }] }] },
        { id: 'break', kind: 'pageBreak' },
      ],
      pageFooter: [{ id: 'page-of', kind: 'text', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] }],
      summary: [{ id: 'signature-image', kind: 'image', source: { kind: 'field', field: header('signature') }, width: 150, height: 50, fit: 'contain' }],
    },
  }
}

function nodes(state: EditorState): OutlineNode[] {
  const all: OutlineNode[] = []
  const visit = (list: readonly OutlineNode[]): void => {
    for (const node of list) {
      all.push(node)
      visit(node.children)
    }
  }
  for (const region of state.outline) visit(region.nodes)
  return all
}

/** Every outline row's label, and what the properties pane shows for each: read from an editor of its own, before any builder is mounted. */
const ROWS = ((): readonly { readonly label: string; readonly kinds: readonly string[] }[] => {
  const editor = createReportEditor(sessionOver(everyKind()))
  return nodes(editor.state()).map((node) => {
    editor.dispatch(node.column === undefined ? { type: 'select', id: node.id } : { type: 'select', id: node.id, column: node.column })
    return { label: node.label, kinds: editor.state().properties.fields.map((field) => field.kind) }
  })
})()

/** The roles a person operates or reads by name. A status is left out on purpose: the live region says whole sentences, and needs no name to explain them. */
const NAMED = ['button', 'textbox', 'spinbutton', 'combobox', 'checkbox', 'treeitem', 'tree', 'group', 'img', 'list', 'form', 'region', 'dialog']

function unnamed(): string[] {
  return NAMED.flatMap((role) => screen.queryAllByRole(role).filter((element) => computeAccessibleName(element).trim() === '').map((element) => `${role}: ${element.outerHTML.slice(0, 80)}`))
}

describe('every part of the builder', () => {
  // The audit below covers every kind of property control only if some row
  // of this report shows each; a kind no row shows would be a control drawn
  // in no audit.
  test('is drawn for this report: every kind of component, every kind of property', () => {
    expect(ROWS.length).toBeGreaterThan(15)
    expect(new Set(ROWS.flatMap((row) => row.kinds))).toEqual(new Set(PROPERTY_KINDS))
  })

  // Each row's properties, every control in them, named and audited.
  test.each(ROWS.map((row) => row.label))('is named and passes axe with %s selected', async (label) => {
    const { user } = mount(everyKind())
    await user.click(screen.getByRole('treeitem', { name: label }))
    expect(screen.getByRole('treeitem', { name: label, selected: true })).toBeTruthy()
    expect(unnamed()).toEqual([])
    expect(await violations()).toEqual([])
  })

  // The dialog, its places and their indicators on the canvas: a state no
  // scenario ends in.
  test('is named and passes axe with the place dialog open', async () => {
    const { user } = mount(everyKind())
    await user.click(screen.getByRole('treeitem', { name: 'Note' }))
    await user.click(screen.getByRole('button', { name: t('action.moveTo') }))
    expect(screen.getByRole('dialog', { name: t('places.move', { name: 'Note' }) })).toBeTruthy()
    expect(unnamed()).toEqual([])
    expect(await violations()).toEqual([])
  })

  // A box too wide for the column it stands in is marked on the canvas,
  // which a keyboard never rests on; its outline row says the same as its
  // description, so the keyboard learns it where it is.
  test('describes a row too wide for its place, as its canvas box is marked', () => {
    const report = everyKind()
    const side = { id: 'side', kind: 'columns', columns: [{ width: 100, components: [{ id: 'wide', kind: 'rectangle', width: 150, height: 20 }] }, { width: 'fill', components: [] }] }
    mount({ ...report, regions: { ...report.regions, body: [...report.regions.body, side] } } as ReportDefinition)
    const rectangles = screen.getAllByRole('treeitem').filter((row) => computeAccessibleDescription(row) === t('canvas.overflow'))
    expect(rectangles.map((row) => computeAccessibleName(row))).toEqual(['Rectangle (wide)'])
  })

  // A table's column has no place to be moved to on its own, so the tool
  // that would open the dialog for it says it is unavailable, and opens none.
  test('offers no place dialog for a table’s column', async () => {
    const { user } = mount(everyKind())
    await user.click(screen.getByRole('treeitem', { name: 'SKU' }))
    const moveTo = screen.getByRole('button', { name: t('action.moveTo') })
    expect(moveTo.getAttribute('aria-disabled')).toBe('true')
    await user.click(moveTo)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
