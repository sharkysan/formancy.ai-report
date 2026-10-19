import { provideZonelessChangeDetection } from '@angular/core'
import type { ApplicationRef } from '@angular/core'
import { createApplication } from '@angular/platform-browser'
import { createReportEditor, EDITOR_LOCALES, SCENARIO_PNG } from '@formancy/report-builder-core'
import type { EditorAction, EditorLocale, EditorState, KeptImage, OutlineNode, ReportEditor } from '@formancy/report-builder-core'
import { ReportBuilder } from '@formancy/report-builder-react'
import { openReportSession } from '@formancy/report-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { computeAccessibleDescription, computeAccessibleName, getRole } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { StudioAngularBuilder } from './builder/angular-builder.js'
import { STUDIO_EDITOR, STUDIO_SLOT } from './builder/angular-editor.js'
import { PREVIEW_NAME } from './layout.js'
import { decodeStarters, encodeStarters } from './starters/codec.js'
import { studioStarters } from './starters/starters.js'

/**
 * The two builders' accessible trees, compared in jsdom: React's and
 * Angular's mounted side by side over one editor, and the editor taken
 * through its states by its own actions, in each of its languages. At every
 * state both trees are written the same way -- each element's role, name,
 * description and states, and the text, as dom-accessibility-api reads them
 * -- and must be the same.
 *
 * What it adds to the browser gate's comparison (scripts/gate-parity.mjs),
 * which walks the starters in English in Chromium: the editor's other two
 * languages, so a word one builder says in English, or not at all, is found;
 * every kind of component the palette offers, placed, and a row of each kind
 * in every starter selected, so every kind of property form, and the
 * report's own fields, are compared, where the gate selects a text and the
 * report; and the place chooser for every kind. What it cannot see, and the gate does: a
 * name a stylesheet changes -- jsdom applies none -- focus, which the steps
 * here do not move, and the panes a narrow screen hides.
 *
 * The editor is made as the Studio makes it, with its Preview shown in the
 * design view's place (0029); a button the Studio's Preview has stands in
 * for it, the same in both -- React's builder is given it as its view, and
 * the Studio's Angular builder lends its slot for it, as it lends it to
 * the real Preview -- so the region each builder draws it in is compared,
 * and not the Preview, which is one React component in both.
 *
 * The editor keeps images as the Studio's does (0033), so both builders
 * draw Add image… and the report's images; its store answers only when the
 * walk lets it, so the state while an image is being added is compared.
 *
 * The normalisation is the gate's, for the same reasons
 * (apps/studio/scripts/accessible-tree.mjs): a relation by id is left out,
 * and the name and the description it gives kept; an element with no role
 * and nothing said of it -- the Angular builder's component hosts -- is
 * passed through; what is hidden from the tree is left out. Whitespace in a
 * text is one space, and a text of nothing but whitespace is none: a
 * template's line breaks, never a word.
 */

const { starters } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))

/** Attributes that point by id, or say the name again: what the name and the description already hold. */
const RELATIONS = new Set(['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'aria-flowto'])
/** Roles that say nothing of their own. */
const ROLELESS = new Set(['generic', 'none', 'presentation'])
/** What can give an element with no role of its own a name or a description; without one, it has neither, and nothing is computed. */
const NAMING = ['aria-label', 'aria-labelledby', 'aria-describedby', 'title']

/**
 * Hidden from the tree: by `hidden` or `aria-hidden`, or never drawn. jsdom
 * applies no stylesheet here, so nothing else hides an element, and asking
 * jsdom for each element's computed style, as dom-accessibility-api's own
 * check does, made one comparison of the two trees take seconds.
 */
const hidden = (element: Element): boolean => element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true' || ['script', 'style', 'template'].includes(element.localName)

/** A form control's value and checked state, as a person reads them. */
function control(element: Element): string[] {
  if (element instanceof HTMLInputElement && element.type === 'checkbox') return [`checked=${String(element.checked)}`]
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return [`value=${JSON.stringify(element.value)}`]
  return []
}

/**
 * jsdom's computed style, asked once for each kind of element. The suite
 * loads no stylesheet, and the builders set nothing but a box's geometry
 * inline, so an element's display and visibility here -- all that
 * dom-accessibility-api reads -- are its tag's, its `hidden`'s and its own
 * inline display's. Asked of jsdom for every element, as a name's
 * computation asks for each element under it, they were most of the time
 * the comparisons took: about 70 ms a reading.
 */
const styles = new Map<string, CSSStyleDeclaration>()
function getComputedStyle(element: Element, pseudo?: string | null): CSSStyleDeclaration {
  const key = [element.localName, element.hasAttribute('hidden'), element instanceof HTMLElement ? element.style.display : '', pseudo ?? ''].join('|')
  const known = styles.get(key) ?? window.getComputedStyle(element, pseudo)
  styles.set(key, known)
  return known
}
const options = { getComputedStyle, computedStyleSupportsPseudoElements: false }

/** The accessible tree under `root`, a line a node, indented two spaces a level. */
function tree(root: Element): string[] {
  const lines: string[] = []
  const visit = (node: Node, depth: number): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (text !== '') lines.push(`${'  '.repeat(depth)}text ${JSON.stringify(text)}`)
      return
    }
    if (!(node instanceof Element) || hidden(node)) return
    const role = getRole(node)
    const roleless = role === null || ROLELESS.has(role)
    const said = !roleless || NAMING.some((attribute) => node.hasAttribute(attribute))
    const name = said ? computeAccessibleName(node, options) : ''
    const description = said ? computeAccessibleDescription(node, options) : ''
    const kept = !roleless || name !== '' || description !== ''
    if (kept) {
      const states = [...node.attributes].filter((attribute) => attribute.name.startsWith('aria-') && !RELATIONS.has(attribute.name)).map((attribute) => `${attribute.name}=${JSON.stringify(attribute.value)}`)
      const native = ['disabled', 'required'].filter((attribute) => node.hasAttribute(attribute))
      const focus = node instanceof HTMLElement && (node.tabIndex >= 0 || node.hasAttribute('tabindex')) ? [`tabindex=${String(node.tabIndex)}`] : []
      lines.push([`${'  '.repeat(depth)}${role ?? node.localName} ${JSON.stringify(name)}`, ...(description === '' ? [] : [`description=${JSON.stringify(description)}`]), ...states, ...native, ...control(node), ...focus].join(' '))
    }
    // A textarea's text is its default value, which the tree reads as its value, said above, and never as text: React writes it there and Angular does not.
    if (node instanceof HTMLTextAreaElement) return
    for (const child of node.childNodes) visit(child, kept ? depth + 1 : depth)
  }
  visit(root, 0)
  return lines
}

interface Mounted {
  readonly editor: ReportEditor
  readonly react: HTMLElement
  readonly angular: HTMLElement
  readonly app: ApplicationRef
  /** Lets the store answer for the image being added. */
  readonly release: () => void
}

let mounted: Mounted | undefined

afterEach(() => {
  cleanup()
  mounted?.app.destroy()
  mounted?.editor.dispose()
  mounted = undefined
  document.body.replaceChildren()
})

/** What stands in for the Studio's Preview in both builders' middle: one of its controls. */
const STAND_IN = 'Download PDF'

/** The two builders, React's and the Studio's Angular one, side by side over one editor of `report` in `locale`, its Preview shown in the middle. */
async function mountBoth(report: unknown, locale: EditorLocale): Promise<Mounted> {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the starter did not open')
  let answer = (): void => undefined
  const images = { keep: () => new Promise<KeptImage>((resolve) => (answer = () => resolve({ ok: true }))) }
  const editor = createReportEditor(opening.session, { locale, hostView: { name: PREVIEW_NAME, shown: true, place: 'middle' }, images })
  const react = document.body.appendChild(document.createElement('div'))
  render(<ReportBuilder editor={editor} hostView={<button type="button">{STAND_IN}</button>} />, { container: react })
  const angular = document.body.appendChild(document.createElement('div'))
  const lend = (slot: HTMLElement | null): void => slot?.replaceChildren(Object.assign(document.createElement('button'), { type: 'button', textContent: STAND_IN }))
  const app = await createApplication({ providers: [provideZonelessChangeDetection(), { provide: STUDIO_EDITOR, useValue: editor }, { provide: STUDIO_SLOT, useValue: lend }] })
  app.bootstrap(StudioAngularBuilder, angular.appendChild(document.createElement('report-studio-builder')))
  await app.whenStable()
  mounted = { editor, react, angular, app, release: () => answer() }
  return mounted
}

/** Every outline row, in the outline's order. */
function rows(state: EditorState): OutlineNode[] {
  const all: OutlineNode[] = []
  const visit = (nodes: readonly OutlineNode[]): void => {
    for (const node of nodes) {
      all.push(node)
      visit(node.children)
    }
  }
  for (const region of state.outline) visit(region.nodes)
  return all
}

const select = (node: OutlineNode | null): EditorAction => (node === null ? { type: 'select', id: null } : node.column === undefined ? { type: 'select', id: node.id } : { type: 'select', id: node.id, column: node.column })

/**
 * Takes the editor through its states, comparing the two trees at each: as
 * opened, with the Preview in the design view's place, and the design view
 * given its place back; the place chooser for every kind the palette
 * offers, each kind that has a place then placed there; every row
 * selected; a move's chooser; a condition naming no parameter, with its
 * problem; a top margin the page cannot hold, refused; an image being
 * added, Add image… pressed while it is, and the image listed, then
 * removed; undo and redo; each pane; the zoom; and the Preview shown in
 * the middle again, a pane hidden and shown beside it, the Preview placed
 * beside the builder and back, and hidden.
 */
async function walk({ editor, react, angular, app, release }: Mounted): Promise<string[]> {
  const states: string[] = []
  const same = async (state: string): Promise<void> => {
    await app.whenStable()
    expect(tree(angular), `${state}: the Angular builder's tree, against the React builder's`).toEqual(tree(react))
    states.push(state)
  }
  const dispatch = async (action: EditorAction, state: string): Promise<void> => {
    act(() => void editor.dispatch(action))
    await same(state)
  }

  await same('opened, the Preview in the design view’s place')
  await dispatch({ type: 'openPanel', panel: 'canvas' }, 'the design view given its place back')
  for (const entry of editor.state().palette) {
    await dispatch({ type: 'startDrag', subject: { kind: entry.kind }, via: 'keyboard' }, `the place chooser for ${entry.kind}`)
    const first = editor.state().dropTargets[0]
    if (editor.state().drag === null || first === undefined) {
      await dispatch({ type: 'cancelDrag' }, `${entry.kind}: no place`)
      continue
    }
    await dispatch({ type: 'insert', kind: entry.kind, target: first.location }, `${entry.kind} placed`)
  }
  // One row of each kind, and one table column: each kind's property form,
  // which is what a selection changes; a second row of a kind is the same
  // form over other values.
  const kinds = new Map<string, OutlineNode>()
  for (const node of rows(editor.state())) if (!kinds.has(node.column === undefined ? node.kind : 'column')) kinds.set(node.column === undefined ? node.kind : 'column', node)
  for (const node of kinds.values()) await dispatch(select(node), `${node.label} selected`)

  const text = rows(editor.state()).find((node) => node.kind === 'text' && node.column === undefined)
  if (text === undefined) throw new Error('no text was placed')
  await dispatch(select(text), 'a text selected')
  await dispatch({ type: 'startDrag', subject: { id: text.id }, via: 'keyboard' }, 'the place chooser for a move')
  await dispatch({ type: 'cancelDrag' }, 'the move cancelled')
  const condition = editor.state().properties.fields.find((field) => field.kind === 'expression')
  if (condition === undefined) throw new Error('a text has no condition field')
  await dispatch({ type: 'setProperty', key: condition.key, value: 'params.missing' }, 'a condition naming no parameter')
  await dispatch(select(null), 'the report selected')
  const margin = editor.state().properties.fields.find((field) => field.kind === 'length')
  if (margin === undefined) throw new Error('the report has no length field')
  await dispatch({ type: 'setProperty', key: margin.key, value: '400' }, 'a margin the page cannot hold, refused')
  const file = { name: 'logo.png', size: SCENARIO_PNG.length, arrayBuffer: async () => Uint8Array.from(SCENARIO_PNG).buffer }
  let adding: Promise<unknown> = Promise.resolve()
  act(() => void (adding = editor.addImage(file)))
  await waitFor(() => expect(editor.state().images.adding).toBe('logo.png'))
  await same('an image being added')
  await dispatch({ type: 'chooseImage' }, 'Add image… pressed while an image is being added')
  await act(async () => {
    release()
    await adding
  })
  const added = editor.state().images.assets.at(-1)
  if (added === undefined || editor.state().images.adding !== null) throw new Error('the image was not added')
  await same('an image added, listed under the report’s properties')
  await dispatch({ type: 'removeImage', asset: added.id }, 'the image removed')
  await dispatch({ type: 'undo' }, 'undone')
  await dispatch({ type: 'redo' }, 'redone')
  for (const panel of ['canvas', 'properties', 'diagnostics', 'outline'] as const) await dispatch({ type: 'openPanel', panel }, `the ${panel} pane`)
  await dispatch({ type: 'zoomIn' }, 'zoomed in')
  await dispatch({ type: 'showHostView' }, 'the Preview shown in the middle again')
  await dispatch({ type: 'hidePanel', panel: 'outline' }, 'the outline hidden beside the Preview')
  await dispatch({ type: 'openPanel', panel: 'outline' }, 'the outline shown beside it again')
  await dispatch({ type: 'placeHostView', place: 'beside' }, 'the Preview placed beside the builder')
  await dispatch({ type: 'placeHostView', place: 'middle' }, 'the Preview placed back in the middle')
  await dispatch({ type: 'hideHostView' }, 'the Preview hidden')
  return states
}

describe('the two builders, side by side over one editor', () => {
  // A builder that names, describes or marks anything otherwise than the
  // other -- in any language, at any state the editor reaches -- fails
  // here, with the state and the lines that differ.
  for (const locale of EDITOR_LOCALES) {
    for (const starter of studioStarters(starters)) {
      test(`${locale}, ${starter.id}: draw one accessible tree at every state`, async () => {
        const states = await walk(await mountBoth(starter.report, locale))
        // The guard on the guard: a walk that stopped early compared fewer states than it names.
        expect(states).toEqual(expect.arrayContaining(['opened, the Preview in the design view’s place', 'a condition naming no parameter', 'a margin the page cannot hold, refused', 'an image being added', 'the image removed', 'zoomed in', 'the Preview hidden']))
      })
    }
  }

  // The serialisation is the comparison: one that wrote nothing, or lost
  // the names, would pass two builders that differed.
  test('write a tree with every control in it, named', async () => {
    const both = await mountBoth(studioStarters(starters)[0]?.report, 'en')
    const lines = tree(both.react)
    expect(lines[0]).toBe('region "Report editor"')
    expect(lines).toEqual(expect.arrayContaining([expect.stringMatching(/^ +toolbar "Report tools"/), expect.stringMatching(/^ +tree "Outline"/), expect.stringMatching(/^ +button "Undo" aria-disabled="true"/)]))
    // and the host's view, in both: a builder that drew the region and not
    // what the host gave it -- Angular's slot never filled -- fails here.
    await both.app.whenStable()
    for (const drawn of [lines, tree(both.angular)]) expect(drawn).toEqual(expect.arrayContaining([expect.stringMatching(/^ +region "Preview" tabindex=-1$/), expect.stringMatching(new RegExp(`^ +button "${STAND_IN}" tabindex=0$`))]))
  })
})
