/*
 * What both builders draw, checked once: the editor both are drawn over, and
 * the accessible structure report-builder-core's README sets out, read from
 * the markup a server renderer wrote. react.tsx and angular.ts each find the
 * editor's root in their framework's markup and hand it here, so the two
 * builders are held to one statement of the structure, not to two copies
 * that could drift apart unnoticed.
 *
 * The checks say what in the markup is wrong and never stop at the first, so
 * one run names every difference.
 */
import { BUILDER_SCENARIOS, createReportEditor, editorText, HIDEABLE_PANELS, REPORT_PARTS } from '@formancy/report-builder-core'
import type { EditorState, ImageStore, ReportEditor, ReportPart } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import { emptyReport } from '@formancy/report-spec'
import type { ReportDefinition, TextComponent } from '@formancy/report-spec'
import { elementsIn, spokenText } from './markup.js'
import type { MarkupElement } from './markup.js'

/**
 * The report the builders are drawn over: a blank one whose body holds a
 * text that prints the clock, which a report may not -- a problem to draw,
 * on its row, on its box and in the problems' list and count. Its outline
 * is flat, and not empty, which is what structureProblems reads.
 */
export function reportToDraw(): ReportDefinition {
  const blank: ReportDefinition = emptyReport('builder-check', 'Prüfbericht', 'de-CH')
  const clock: TextComponent = { id: 'clock', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'string(now())' } }] }
  return { ...blank, regions: { ...blank.regions, body: [clock] } }
}

/**
 * `editor`, over reportToDraw(), with one text inserted after the clock and
 * selected, so the properties drawn are a component's and not the report's.
 */
export function insertAndSelect(editor: ReportEditor): ReportEditor {
  if (!editor.dispatch({ type: 'insert', kind: 'text', target: { region: 'body', index: 1 } }).ok) throw new Error('the editor did not insert a text')
  if (editor.state().diagnostics.length === 0) throw new Error('the clock was not diagnosed, so there is no problem to see drawn')
  return editor
}

/**
 * A Swiss German editor over reportToDraw(), with a text inserted and
 * selected. Swiss German, so every name checked is the catalogue's and none
 * is English by accident.
 */
export function editorToDraw(): ReportEditor {
  const opening = openReportSession(reportToDraw())
  if (!opening.ok) throw new Error('the report did not open a session')
  return insertAndSelect(createReportEditor(opening.session, { locale: 'de-CH' }))
}

/** The host's view each host draws the builder with a second time (0029): its name, and the words the host draws in it. */
export const HOST_VIEW = { name: 'Vorschau', text: 'Die Ansicht des Hosts' } as const

/** editorToDraw()'s editor, made with the host's view shown in the design view's place. */
export function editorWithHostView(): ReportEditor {
  const opening = openReportSession(reportToDraw())
  if (!opening.ok) throw new Error('the report did not open a session')
  return insertAndSelect(createReportEditor(opening.session, { locale: 'de-CH', hostView: { name: HOST_VIEW.name, shown: true } }))
}

/**
 * editorToDraw()'s report with two images declared, `logo`, which an image
 * after the clock draws, and `spare`, which nothing draws, in an editor
 * made with a host's store and nothing selected (0033): Add image… and its
 * input at the palette's end, and the report's images listed under its
 * fields, the Remove of `logo` unavailable.
 */
export function editorWithImages(): ReportEditor {
  const report = reportToDraw()
  const digest = (byte: string): string => `sha256:${byte.repeat(32)}`
  const opening = openReportSession({
    ...report,
    assets: [
      { id: 'logo', mediaType: 'image/svg+xml', digest: digest('ab') },
      { id: 'spare', mediaType: 'image/png', digest: digest('cd') },
    ],
    regions: {
      ...report.regions,
      body: [...report.regions.body, { id: 'mark', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 40, height: 40, fit: 'contain' }],
    },
  })
  if (!opening.ok) throw new Error('the report with images did not open a session')
  const store: ImageStore = { accept: ['image/png', 'image/svg+xml'], keep: async () => ({ ok: true }) }
  return createReportEditor(opening.session, { locale: 'de-CH', images: store })
}

/**
 * editorToDraw()'s report given a QR-bill through the editor, from SIX's
 * example, and a debtor added to it, the bill selected (0039): its row
 * after the regions, its band selected on the canvas, and its fields in the
 * properties, its creditor and its debtor each a group, the debtor's with
 * its Remove.
 */
export function editorWithBill(): ReportEditor {
  const opening = openReportSession(reportToDraw())
  if (!opening.ok) throw new Error('the report did not open a session')
  const editor = createReportEditor(opening.session, { locale: 'de-CH' })
  if (!editor.dispatch({ type: 'addPart', part: 'paymentPart' }).ok || !editor.dispatch({ type: 'addGroup', key: '/debtor' }).ok)
    throw new Error('the editor did not add a QR-bill and its debtor')
  return editor
}

/**
 * The report of the shared scenarios that holds an e-invoice and a QR-bill
 * in euro to its account, its e-invoice selected and a VAT category added
 * (0044): its row after the bill's, no band of its own on the canvas, and
 * its fields in groups -- the parties, each VAT category with its moves and
 * its Remove, the first's Move up unavailable, and the list's Add. Read
 * from BUILDER_SCENARIOS, the package's own, so that the report is the one
 * both builders' suites run.
 */
export function editorWithEInvoice(): ReportEditor {
  const report = BUILDER_SCENARIOS.map((scenario) => scenario.report()).find(
    (candidate) => candidate.eInvoice !== undefined && candidate.paymentPart !== undefined,
  )
  if (report === undefined) throw new Error('no shared scenario has a report with an e-invoice and a QR-bill')
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the e-invoice report did not open a session')
  const editor = createReportEditor(opening.session, { locale: 'de-CH' })
  if (!editor.dispatch({ type: 'select', part: 'eInvoice' }).ok || !editor.dispatch({ type: 'addItem', key: '/vat' }).ok)
    throw new Error('the editor did not select the e-invoice and add a VAT category')
  return editor
}

/**
 * Everything about `root` -- the editor's root element, as a builder drew it
 * for `state` -- that is not as report-builder-core's README says: one
 * sentence per difference, empty when there is none.
 */
export function structureProblems(root: MarkupElement, state: EditorState): string[] {
  const t = editorText(state.locale)
  const everything = [root, ...elementsIn(root)]
  const wrong: string[] = []
  const expect = (holds: boolean, what: string): void => {
    if (!holds) wrong.push(what)
  }
  const attribute = (element: MarkupElement | undefined, name: string): string | undefined => element?.attributes.get(name)
  const parts = (part: ReportPart, within: MarkupElement = root): MarkupElement[] =>
    elementsIn(within).filter((element) => attribute(element, 'data-report-part') === part)
  const withRole = (role: string, within: MarkupElement = root): MarkupElement[] => elementsIn(within).filter((element) => attribute(element, 'role') === role)
  /**
   * The name assistive technology gives `element` from its attributes: the
   * text of what `aria-labelledby` points to, else its `aria-label`. The
   * README asks for the editor's words in `aria-label`, which each
   * builder's own suite holds; a labelledby is still read here, so a name
   * given the other way is checked for what it says, and one whose ids do
   * not line up names nothing.
   */
  const nameOf = (element: MarkupElement | undefined): string | undefined => {
    const ids = attribute(element, 'aria-labelledby')?.split(' ')
    if (ids === undefined) return attribute(element, 'aria-label')
    const labels = ids.map((id) => everything.find((candidate) => attribute(candidate, 'id') === id))
    return labels.every((label) => label !== undefined) ? labels.map((label) => spokenText(label as MarkupElement)).join(' ') : undefined
  }

  // Every hook the markup carries is one report-builder.css dresses: a part
  // renamed in the builder and not in the core would be drawn undressed.
  const known = new Set<string>(REPORT_PARTS)
  const unknown = everything.map((element) => attribute(element, 'data-report-part')).filter((part) => part !== undefined && !known.has(part))
  expect(unknown.length === 0, `parts REPORT_PARTS does not name: ${unknown.join(', ')}`)

  // The root: a region named by the catalogue -- a <section> with a name is
  // one, and so is anything with the role -- with the workbench's grid and
  // the state's panel. Without the name it is no landmark; without the grid
  // and the panel, report-builder.css lays out nothing and a narrow screen
  // shows every pane at once.
  expect(
    attribute(root, 'data-report-part') === 'editor' && (root.tag === 'section' || attribute(root, 'role') === 'region'),
    `the root <${root.tag}> is not the editor's region`,
  )
  expect(nameOf(root) === t('editor.label'), `the root is named ${String(nameOf(root))}, not ${t('editor.label')}`)
  expect(
    attribute(root, 'class')?.split(' ').includes('wb') === true && attribute(root, 'data-panel') === state.panel,
    'the root lacks the wb grid or the state panel',
  )
  expect(spokenText(root).includes(state.document.title), `the report's title ${state.document.title} is not shown`)

  // The toolbar: named, one tab stop rather than a keyboard walking every
  // tool, the zoom as the state says it, and a button for each pane, which on a
  // narrow screen is the only way to reach the others.
  const [toolbar] = withRole('toolbar')
  const tools = toolbar === undefined ? [] : elementsIn(toolbar).filter((element) => element.tag === 'button')
  expect(
    withRole('toolbar').length === 1 && nameOf(toolbar) === t('toolbar.label') && attribute(toolbar, 'data-report-part') === 'toolbar',
    'there is not one toolbar, named by the catalogue',
  )
  expect(tools.filter((tool) => attribute(tool, 'tabindex') === '0').length === 1, 'the toolbar is not one tab stop')
  const zoom = toolbar === undefined ? [] : parts('zoom', toolbar)
  expect(zoom.length === 1 && spokenText(zoom[0] as MarkupElement) === state.zoomLabel, `the zoom does not read ${state.zoomLabel}`)
  for (const pane of [t('pane.outline'), t('pane.canvas'), t('pane.properties'), t('pane.problems')]) {
    expect(
      tools.some((tool) => spokenText(tool) === pane),
      `the toolbar has no button named ${pane}`,
    )
  }

  // A Hide in each side pane the state shows, named after it as the toolbar
  // names the pane, which is how a person gives the design view the room.
  const paneNames = { outline: t('pane.outline'), properties: t('pane.properties'), diagnostics: t('pane.problems') }
  const hides = parts('hide-pane')
  const named = HIDEABLE_PANELS.filter((panel) => !state.hidden.includes(panel)).map((panel) => t('action.hidePane', { pane: paneNames[panel] }))
  expect(
    hides.length === named.length && hides.every((hide, at) => hide.tag === 'button' && nameOf(hide) === named[at] && spokenText(hide) === t('action.hide')),
    `the panes shown have not each a ${t('action.hide')} named ${named.join(', ')}`,
  )

  // The palette: a group with a button per entry the state offers, each named
  // by its label, so no kind the editor offers is missing or misnamed. Where
  // the host keeps images, Add image… stands last (0033): a palette item of
  // no kind, unavailable when the state says so, and beside it the hidden
  // file input it opens, taking what the state accepts. Without a store,
  // neither is drawn: a button that opens nothing is no way to add an image.
  const [palette] = parts('palette')
  const items = palette === undefined ? [] : parts('palette-item', palette)
  const entries = items.filter((item) => attribute(item, 'data-kind') !== undefined)
  const adds = items.filter((item) => attribute(item, 'data-kind') === undefined)
  expect(attribute(palette, 'role') === 'group' && nameOf(palette) === t('pane.palette'), 'the palette is not a group named by the catalogue')
  expect(
    entries.length === state.palette.length && state.palette.every((entry, at) => spokenText(entries[at] as MarkupElement) === entry.label),
    'the palette does not offer the state palette, by label',
  )
  const inputs = palette === undefined ? [] : elementsIn(palette).filter((element) => element.tag === 'input' && attribute(element, 'type') === 'file')
  if (state.images.store) {
    const [add] = adds
    expect(
      adds.length === 1 && add === items.at(-1) && add?.tag === 'button' && spokenText(add) === t('images.add'),
      `the palette does not end with one ${t('images.add')}`,
    )
    expect((attribute(add, 'aria-disabled') === 'true') === !state.can.addImage, `${t('images.add')} is not unavailable exactly when the state says`)
    expect(
      inputs.length === 1 && inputs[0]?.attributes.has('hidden') === true && attribute(inputs[0], 'accept') === state.images.accept,
      `there is not one hidden file input accepting ${state.images.accept}`,
    )
  } else {
    expect(adds.length === 0 && inputs.length === 0, `${t('images.add')} is drawn for a host that keeps no images`)
  }

  // The outline: a tree, a group per region named by its label, a treeitem
  // per node, then one per part of the report's own level -- its payment
  // part (0039) -- and the selection where the state has it. A group left
  // unnamed is a region a screen reader cannot tell from the next; a row
  // too few hides a component, or the bill, from a keyboard.
  const [tree] = withRole('tree')
  // Every node, a table's columns under it among them, in the tree's order: the e-invoice's report has a table (0044).
  const walked = (list: EditorState['outline'][number]['nodes']): { readonly label: string; readonly selected: boolean }[] =>
    list.flatMap((node) => [node, ...walked(node.children)])
  const nodes: readonly { readonly label: string; readonly selected: boolean }[] = [
    ...state.outline.flatMap((region) => walked(region.nodes)),
    ...state.outlineParts,
  ]
  const rows = tree === undefined ? [] : withRole('treeitem', tree)
  expect(
    withRole('tree').length === 1 && nameOf(tree) === t('pane.outline') && attribute(tree, 'data-report-part') === 'outline',
    'there is not one tree, named by the catalogue',
  )
  const groups = tree === undefined ? [] : withRole('group', tree)
  expect(
    groups.length === state.outline.length && state.outline.every((region, at) => nameOf(groups[at]) === region.label),
    'the tree has not a group per region, labelled by it',
  )
  expect(
    rows.length === nodes.length && nodes.every((node, at) => spokenText(rows[at] as MarkupElement) === node.label),
    'the tree has not a treeitem per outline node, by label',
  )
  expect(
    rows.every((row, at) => attribute(row, 'aria-selected') === String(nodes[at]?.selected)),
    'the selected row is not the selected node',
  )

  // The middle pane. The design view: a canvas named as not the PDF, so
  // nobody takes it for the print, with a named picture per box. Or, while
  // the state's `view` is the host's, the host's view in its place (0029):
  // one region named after it, with the middle pane's hook and the view
  // part, a focus target and no tab stop, and no class -- no workbench pane,
  // so no rule of report-builder.css dresses what the host drew -- holding
  // what the host drew and no design view.
  if (state.view === 'host') {
    const views = parts('view')
    const [view] = views
    expect(
      views.length === 1 && (view?.tag === 'section' || attribute(view, 'role') === 'region') && nameOf(view) === state.hostView?.name,
      `the host's view is not one region named ${String(state.hostView?.name)}`,
    )
    expect(
      attribute(view, 'data-pane') === 'canvas' && attribute(view, 'tabindex') === '-1' && attribute(view, 'class') === undefined,
      "the host's view is not the middle pane's bare region, a focus target and no tab stop",
    )
    expect(view !== undefined && spokenText(view) === HOST_VIEW.text, `the host's view does not hold what the host drew, ${HOST_VIEW.text}`)
    expect(parts('canvas').length === 0, "the design view is drawn beside the host's view")
  } else {
    const [canvas] = parts('canvas')
    const boxes = canvas === undefined ? [] : parts('box', canvas)
    expect(nameOf(canvas) === state.canvas.label, `the design view is not named ${state.canvas.label}`)
    expect(
      boxes.length === state.canvas.boxes.length &&
        state.canvas.boxes.every((box, at) => attribute(boxes[at], 'role') === 'img' && nameOf(boxes[at]) === box.label),
      'the design view has not a picture per box, named by it',
    )
    // A payment part's band: a picture named as SIX names the part, marked selected as the bill is (0039).
    const bands = canvas === undefined ? [] : parts('payment-part', canvas)
    const band = state.canvas.paymentPart
    expect(
      band === null
        ? bands.length === 0
        : bands.length === 1 &&
            attribute(bands[0], 'role') === 'img' &&
            nameOf(bands[0]) === band.label &&
            (attribute(bands[0], 'data-selected') === 'true') === band.selected,
      'the design view has not the payment part’s band the state has, named and selected as it is',
    )
    expect(parts('view').length === 0, "a host's view is drawn beside the design view")
  }

  // The properties: a form named by its heading, a row per field and, for
  // the report's own, a group of a row per image, each with a Remove named
  // by the image, unavailable while something draws it; then the problems,
  // each a button named by its label; and the live region, without which
  // nothing an action did is said.
  const [form] = parts('properties')
  const images = state.selection === null ? state.images.assets : []
  expect(form?.tag === 'form' && nameOf(form) === state.properties.heading, `the properties are not a form named ${state.properties.heading}`)
  expect(
    form !== undefined && parts('property', form).length === state.properties.fields.length + images.length,
    'the properties have not a row per field and per image',
  )
  // Each group of fields the state draws -- a QR-bill's party, the report's
  // Add of a bill (0039), an e-invoice's party, VAT category or list
  // (0044) -- a group named by its label, hooked as one, holding its
  // fields' rows and its buttons, each named by what it says and
  // aria-disabled exactly where the state says it has nowhere to go.
  const fieldGroups = state.properties.rows.flatMap((row) => ('group' in row ? [row.group] : []))
  const drawnGroups = form === undefined ? [] : parts('property-group', form)
  expect(
    drawnGroups.length === fieldGroups.length &&
      fieldGroups.every((group, at) => {
        const drawn = drawnGroups[at] as MarkupElement
        const buttons = elementsIn(drawn).filter((element) => element.tag === 'button')
        return (
          attribute(drawn, 'role') === 'group' &&
          nameOf(drawn) === group.label &&
          parts('property', drawn).length === group.fields.length &&
          buttons.length === group.actions.length &&
          buttons.every(
            (button, index) =>
              spokenText(button) === group.actions[index]?.label && (attribute(button, 'aria-disabled') === 'true') === !group.actions[index]?.available,
          )
        )
      }),
    'the properties have not a group per group of fields, named by its label, with its rows and its buttons, each unavailable where the state says',
  )
  const [library] = form === undefined ? [] : withRole('group', form).filter((group) => nameOf(group) === t('images.heading'))
  const imageRows = library === undefined ? [] : parts('property', library)
  expect(
    images.length === 0 ||
      (imageRows.length === images.length &&
        images.every((image, at) => {
          const [remove] = elementsIn(imageRows[at] as MarkupElement).filter((element) => element.tag === 'button')
          return (
            spokenText(imageRows[at] as MarkupElement).startsWith(image.label) &&
            nameOf(remove) === image.removeLabel &&
            (attribute(remove, 'aria-disabled') === 'true') === (image.inUse !== undefined)
          )
        })),
    `the report's images are not a group named ${t('images.heading')} of a row each, with its Remove`,
  )
  const problems = parts('diagnostic')
  expect(
    problems.length === state.diagnostics.length &&
      state.diagnostics.every((entry, at) => {
        const [button] = elementsIn(problems[at] as MarkupElement).filter((element) => element.tag === 'button')
        return attribute(problems[at], 'data-severity') === entry.severity && button !== undefined && spokenText(button) === entry.label
      }),
    'the problems are not a button per diagnostic, named by its label',
  )
  // "Problems 2": a status, so a change in the count is said.
  const count = withRole('status').find((status) => nameOf(status) === t('pane.problems'))
  expect(
    count !== undefined && spokenText(count) === `${t('pane.problems')} ${String(state.diagnostics.length)}`,
    `the problems' status does not read ${t('pane.problems')} ${String(state.diagnostics.length)}`,
  )
  expect(
    parts('status').some((status) => attribute(status, 'role') === 'status'),
    'there is no live region',
  )

  return wrong
}
