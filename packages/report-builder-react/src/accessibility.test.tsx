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
 *
 * Where a test reads the DOM it says why, as these do: how a name is
 * given, which jsdom's names cannot show, because jsdom applies no
 * stylesheet and Chromium puts one's text-transform into a name taken from
 * text on the page; and a QR-bill's row and its groups of fields (0039),
 * and an e-invoice's (0044) -- that a group's name is its own and not
 * `aria-labelledby`'s, for that reason, that the drawn name is hidden from
 * the tree, the row's level, place and the role of what holds it, and
 * which of a group's buttons is unavailable -- which no query by role and
 * name returns.
 */
import { BUILDER_SCENARIOS, createReportEditor, editorText, PROPERTY_KINDS } from '@formancy/report-builder-core'
import type { PropertyGroup } from '@formancy/report-builder-core'
import type { EditorState, OutlineNode } from '@formancy/report-builder-core'
import { COMPONENT_KINDS, walkComponents } from '@formancy/report-spec'
import type { FieldRef, ReportDefinition } from '@formancy/report-spec'
import { cleanup, isInaccessible, screen, within } from '@testing-library/react'
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
      summary: [
        { id: 'signature-image', kind: 'image', source: { kind: 'field', field: header('signature') }, width: 150, height: 50, fit: 'contain' },
        { id: 'order-code', kind: 'qrCode', content: [{ kind: 'text', text: 'Orders for ' }, { kind: 'field', field: header('customer') }], size: 85.04, errorCorrection: 'Q' },
        {
          id: 'pay-code',
          kind: 'epcQrCode',
          size: 85.04,
          beneficiary: [{ kind: 'text', text: 'Franz Mustermänn' }],
          iban: [{ kind: 'text', text: 'DE71 1102 2033 0123 4567 89' }],
          bic: [{ kind: 'text', text: 'BHBLDEHHXXX' }],
          amount: { cel: 'totals.total' },
          purpose: 'GDDS',
          text: [{ kind: 'text', text: 'Orders for ' }, { kind: 'field', field: header('customer') }],
          caption: 'zahlenMitCode',
        },
      ],
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
  // in no audit. A kind of component the report lacks -- one the format
  // gained after it was written -- would be a row and a panel drawn in none.
  test('is drawn for this report: every kind of component, every kind of property', () => {
    expect(new Set(walkComponents(everyKind()).map(({ component }) => component.kind))).toEqual(new Set(COMPONENT_KINDS))
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

  // Chromium puts a stylesheet's text-transform into a name it takes from
  // text on the page: report-builder.css draws a region's label in capitals,
  // and the Studio a pane's heading, so a group, the form and the list named
  // by aria-labelledby after them were "BODY", "TEXT: NOTE" and "PROBLEMS"
  // in Chromium, where the Angular builder's, named in words, were not --
  // the browser gate's comparison of the two builders' trees found it. And a
  // region's label left in the tree was read a second time inside its group,
  // a text among the rows. jsdom applies no stylesheet, so its names read
  // the same however they are given: this reads from the DOM how each is.
  test('names its groups, form, list, statuses and dialog in its own words, never by another element’s text', async () => {
    const report = everyKind()
    const { editor, user } = mount({ ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)) } })
    await user.click(screen.getByRole('treeitem', { name: 'Note' }))
    await user.click(screen.getByRole('button', { name: t('action.moveTo') }))
    const { outline, properties } = editor.state()
    const named = [
      ...outline.map((region) => ({ role: 'group', name: region.label })),
      { role: 'form', name: properties.heading },
      { role: 'list', name: t('pane.problems') },
      { role: 'status', name: t('pane.problems') },
      { role: 'dialog', name: t('places.move', { name: 'Note' }) },
    ]
    for (const { role, name } of named) expect(screen.getByRole(role, { name }), `${role} ${name}`).toBeTruthy()
    const builder = screen.getByRole('region', { name: t('editor.label') })
    expect([...builder.querySelectorAll('[aria-labelledby]')].map((element) => element.outerHTML.slice(0, 80))).toEqual([])
    const tree = screen.getByRole('tree', { name: t('pane.outline') })
    expect(outline.flatMap((region) => within(tree).queryAllByText(region.label)).filter((element) => !isInaccessible(element)).map((element) => element.outerHTML)).toEqual([])
  })

  // A QR-bill's parties are groups of fields (0039), named as the outline's
  // regions are: in the editor's words, the name drawn above the fields
  // and hidden from the tree, which would read it a second time among the
  // fields. Its row in the outline is a row at the tree's top, after the
  // regions' groups, and the debtor's button names what it does.
  test('names a QR-bill’s row and each group of its fields in its own words, the name drawn hidden', async () => {
    const billed = BUILDER_SCENARIOS.map((scenario) => scenario.report()).find((report) => report.paymentPart !== undefined)
    if (billed === undefined) throw new Error('no scenario has a report with a payment part')
    const { editor, user } = mount(billed)
    await user.click(screen.getByRole('treeitem', { name: t('canvas.paymentPart') }))
    const groups = editor.state().properties.rows.flatMap((row) => ('group' in row ? [row.group] : []))
    expect(groups.map((group) => group.label)).toEqual([t('group.creditor'), t('group.debtor')])
    for (const group of groups) {
      const drawn = screen.getByRole('group', { name: group.label })
      expect(drawn.hasAttribute('aria-labelledby'), group.label).toBe(false)
      expect(within(drawn).queryAllByText(group.label).filter((element) => !isInaccessible(element)), group.label).toEqual([])
    }
    expect(within(screen.getByRole('group', { name: t('group.debtor') })).getByRole('button', { name: t('action.addDebtor') })).toBeTruthy()
    const row = screen.getByRole('treeitem', { name: t('canvas.paymentPart'), selected: true })
    expect([row.getAttribute('aria-level'), row.parentElement?.getAttribute('role')]).toEqual(['1', 'tree'])
    expect(await violations()).toEqual([])
  })

  // An e-invoice's parties, its VAT categories, its lines and its payment
  // instructions are groups of fields (0044), named as a bill's are. Its
  // row stands at the tree's top after the bill's, the last of the two;
  // a category's move with nowhere to go is aria-disabled and stays
  // focusable, as a tool is, so pressing it says why.
  test('names an e-invoice’s row and each group of its fields in its own words, and marks a move with nowhere to go', async () => {
    const invoiced = BUILDER_SCENARIOS.map((scenario) => scenario.report()).find((report) => report.eInvoice !== undefined && report.paymentPart !== undefined)
    if (invoiced === undefined) throw new Error('no scenario has a report with an e-invoice and a payment part')
    const { editor, user } = mount(invoiced)
    await user.click(screen.getByRole('treeitem', { name: t('outline.eInvoice') }))
    const rows = [t('canvas.paymentPart'), t('outline.eInvoice')].map((name) => screen.getByRole('treeitem', { name }))
    expect(rows.map((row) => [row.getAttribute('aria-level'), row.getAttribute('aria-posinset'), row.getAttribute('aria-setsize'), row.parentElement?.getAttribute('role')])).toEqual([
      ['1', '1', '2', 'tree'],
      ['1', '2', '2', 'tree'],
    ])
    const groups = editor.state().properties.rows.flatMap((row): PropertyGroup[] => ('group' in row ? [row.group] : []))
    expect(groups.map((group) => group.label)).toContain(t('group.vatCategory', { item: 1 }))
    for (const group of groups) {
      const drawn = screen.getByRole('group', { name: group.label })
      expect(drawn.hasAttribute('aria-labelledby'), group.label).toBe(false)
      expect(within(drawn).queryAllByText(group.label).filter((element) => !isInaccessible(element)), group.label).toEqual([])
      expect(within(drawn).queryAllByRole('button').map((button) => [button.textContent, button.getAttribute('aria-disabled')]), group.label).toEqual(group.actions.map((action) => [action.label, action.available ? null : 'true']))
    }
    const up = screen.getByRole('button', { name: t('action.moveVatCategoryUp', { item: 1 }) })
    up.focus()
    expect(document.activeElement).toBe(up)
    expect(await violations()).toEqual([])
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
