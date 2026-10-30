import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import type { ReportEditor, ReportEditorOptions } from '@formancy/report-builder-core'
import { ReportBuilder } from '@formancy/report-builder-react'
import { openReportSession } from '@formancy/report-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { MIDDLE } from './layout.js'
import { decodeStarters, encodeStarters } from './starters/codec.js'
import { studioImages } from './images/image-store.js'
import { studioStarters } from './starters/starters.js'
import { Studio } from './studio.js'
import { createWorkspace } from './workspace.js'
import type { Workspace } from './workspace.js'

/**
 * The Studio's stylesheets, held to the promises studio.css makes: the
 * builder takes the room's geometry from builder.css and its colours only
 * from --wb-* (CLAUDE.md, "The same room"), nothing else of the Studio's
 * reaches into it, and the paper is the document's ("The page is the
 * document, not the room").
 *
 * The rules are read as the browser reads them -- jsdom's CSS object model,
 * in the order studio.css imports them -- and matched with the DOM's own
 * `matches`, not with a pattern over the text, so a selector that reaches
 * the builder or the paper by a route nobody thought of is caught too. What
 * jsdom cannot do -- lay out, compute a colour, resolve a media query -- is
 * the browser gate's.
 *
 * Where the Preview stands in the builder's middle (0029), the builder's
 * own stylesheets join the Studio's: the Preview and its paper are inside
 * the workbench there. PDF.js is stood in for, since jsdom has no canvas;
 * the stand-in writes a text layer as PDF.js does, so the paper has spans.
 */

vi.mock('./preview/pdf-document.js', () => ({
  loadPdf: () => ({
    promise: Promise.resolve({
      pageCount: 1,
      pageSize: () => Promise.resolve({ width: 595.28, height: 841.89 }),
      drawPage: (_page: number, _zoom: number, _canvas: HTMLCanvasElement, text: HTMLElement) => {
        text.innerHTML = '<span>Total</span><br><span class="markedContent"><span>CHF</span></span>'
        return { done: Promise.resolve(), cancel: () => undefined }
      },
    }),
    destroy: () => undefined,
  }),
}))

const styles = join(dirname(fileURLToPath(import.meta.url)))

interface Rule {
  readonly file: string
  readonly selector: string
  /** The properties it declares, each shorthand with the longhands jsdom expands it to. */
  readonly properties: readonly string[]
}

/** The files studio.css imports, in its order, read from its @import lines. */
function files(): string[] {
  const entry = readFileSync(join(styles, 'studio.css'), 'utf8')
  return [...entry.matchAll(/@import '\.\/(.+?)';/g)].map((match) => match[1] ?? '')
}

/** Every style rule of `text`, those inside @media included. */
function rulesOf(file: string, text: string): Rule[] {
  const found: Rule[] = []
  const style = document.createElement('style')
  style.textContent = text
  document.head.append(style)
  const walk = (list: CSSRuleList): void => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule)
        found.push({ file, selector: rule.selectorText, properties: Array.from({ length: rule.style.length }, (_, index) => rule.style.item(index)) })
      else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
    }
  }
  walk((style.sheet as CSSStyleSheet).cssRules)
  style.remove()
  return found
}

/** `file` with each `@import './…';` replaced by the file beside it that it names, as Vite inlines it; any other import refused, as nothing here could read what it brings. */
function inlined(file: string): string {
  const text = readFileSync(file, 'utf8').replace(/@import\s+'(\.\.?\/[^']+\.css)';/g, (_, path: string) => inlined(join(dirname(file), path)))
  if (/@import/.test(text.replace(/\/\*[\s\S]*?\*\//g, ''))) throw new Error(`${file} has an @import the test does not inline`)
  return text
}

/**
 * A stylesheet a package exports, without its comments, as a host's
 * bundler resolves it: report-builder.css with the parts it imports
 * from beside it, so a rule that moved into a part is read where it
 * cascades.
 */
const exported = (specifier: string): string => inlined(createRequire(import.meta.url).resolve(specifier)).replace(/\/\*[\s\S]*?\*\//g, '')

/** Every style rule of the Studio's stylesheets, with its file. */
const rules = (): Rule[] => files().flatMap((file) => rulesOf(file, readFileSync(join(styles, file), 'utf8')))

let workspace: Workspace | undefined

beforeAll(() => {
  // jsdom has no object URLs; the Preview's download link needs one.
  URL.createObjectURL = () => 'blob:studio-styles'
  URL.revokeObjectURL = () => undefined
})

afterEach(() => {
  cleanup()
  workspace?.dispose()
  workspace = undefined
  document.body.replaceChildren()
})

/** Each selector of a list, without the pseudo-element `matches` cannot take: `::selection` applies to what the rest matches. */
const selectorsOf = (list: string): string[] => list.split(/,(?![^(]*\))/).map((one) => one.replace(/::[\w-]+(\([^)]*\))?$/, '').trim() || '*')

/**
 * A selector as it matches at some moment: the states the pointer or the
 * keyboard puts an element in taken off, so a rule for a focused select is
 * matched against every select -- as the browser gate's `rulesOnThePaper`.
 */
const always = (selector: string): string => selector.replace(/:(?:focus-visible|focus-within|focus|hover|active)(?![\w-])/g, '').trim() || '*'

/** A selector that names the builder: the workbench's classes, its parts, its panes, or its Angular element. */
const NAMES_BUILDER = /(^|[\s>+~(,])\.wb(-[\w-]+)?\b|\[data-(report-part|pane|panel)\b|\breport-builder\b/

/**
 * A property that sets a colour, or a shorthand that may: what the
 * workbench's --wb-* variables are for. `border` and `outline` say a
 * colour with their width; `background` and every `*-shadow` paint.
 */
const COLOUR = /colou?r|^background|shadow$|^(border|outline)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^(fill|stroke)$/

/**
 * The room's three rules for every element, the builder's too, as the
 * admin's are (admin.css's `*`, `::selection` and `:focus-visible`): the box
 * model, the selection's violet and the teal focus ring. Nothing else of the
 * room's may reach inside the builder.
 */
const EVERYWHERE = new Set(['*:where(:not(.paper *))', ':where(:not(.paper *))::selection', ':where(:not(.paper *)):focus-visible'])

/** An editor over the scenario report. */
function editorOf(options: ReportEditorOptions = {}): ReportEditor {
  const opening = openReportSession(scenarioReport())
  if (!opening.ok) throw new Error('the scenario report does not open')
  return createReportEditor(opening.session, options)
}

/** The host's view a builder draws in the design view's place: its region is the builder's, what is in it the host's (0029). */
const HOST_VIEW = '[data-report-part="view"]'

/**
 * The React builder's own elements: over the scenario report, the
 * introduction selected and a text being placed by keyboard -- every kind
 * of control it draws -- and again with a host's view in the design view's
 * place, whose region is the builder's and whose content is the host's.
 */
function builder(): Element[] {
  const editor = editorOf()
  editor.dispatch({ type: 'select', id: 'intro' })
  editor.dispatch({ type: 'startDrag', subject: { kind: 'text' }, via: 'keyboard' })
  const { container } = render(<ReportBuilder editor={editor} />)
  const { container: hosting } = render(
    <ReportBuilder editor={editorOf({ hostView: { name: 'Preview', shown: true } })} hostView={<button type="button">Download PDF</button>} />,
  )
  return [
    ...container.querySelectorAll('.wb *'),
    ...[...hosting.querySelectorAll('.wb *')].filter((element) => element.parentElement?.closest(HOST_VIEW) === null),
  ]
}

/** The rules of the builder's two stylesheets, as a host's bundler resolves them. */
const builderSheets = (): Rule[] => [
  ...rulesOf('workbench.css', exported('@formancy/themes/workbench.css')),
  ...rulesOf('report-builder.css', exported('@formancy/report-builder-core/report-builder.css')),
]

/** Those, and every rule of the Studio's that names the builder. */
const builderRules = (): Rule[] => [...builderSheets(), ...rules().filter((rule) => NAMES_BUILDER.test(rule.selector))]

/**
 * The one rule of the builder's that reaches what a host draws in its
 * middle: workbench.css's `.wb *` under `prefers-reduced-motion`, which
 * turns every transition in a workbench off. Nothing in the Preview or on
 * its paper has a transition, so it changes nothing drawn there; the test
 * that admits it fails when it declares anything else.
 */
const INERT = 'workbench.css: .wb *'

/** The properties each rule of `css` whose selector list holds `selector` declares, read from its text: what the browser applies. */
const declaredBy = (css: string, selector: string): string[][] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((block) => selectorsOf(block[1] ?? '').includes(selector))
    .map((block) => [...(block[2] ?? '').matchAll(/([\w-]+)\s*:/g)].map((match) => match[1] ?? ''))

/**
 * The Studio as it opens in a window with no room beside the builder --
 * jsdom's 1024 pixels -- the service inspection printed and its PDF drawn in
 * the React builder's middle. Returns the region the Preview stands in.
 */
async function studio(): Promise<HTMLElement> {
  const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
  const listed = studioStarters(starters)
  const kept = studioImages(images)
  workspace = createWorkspace(listed, { images: kept.store })
  render(<Studio starters={listed} workspace={workspace} images={kept.resolve} />)
  await screen.findByText('Preview: printed.')
  const view = within(screen.getByRole('region', { name: 'Report editor' })).getByRole('region', { name: 'Preview' })
  await waitFor(() => expect(view.querySelector('.paper-text span')).not.toBeNull())
  return view
}

/** The rules of `list` that select an element of `inside`, said as `file: selector`. */
const reaching = (list: readonly Rule[], inside: readonly Element[]): string[] =>
  list.flatMap((rule) =>
    selectorsOf(rule.selector)
      .filter((selector) => inside.some((element) => element.matches(always(selector))))
      .map((selector) => `${rule.file}: ${selector}`),
  )

describe("the Studio's stylesheets", () => {
  // A guard on the guard: the assertions below are about absence, so a
  // reader that found no rules -- an import renamed, @media not walked --
  // would pass them forever.
  test('are read, every file and the rules inside @media', () => {
    const read = rules()
    expect(files()).toEqual(['styles/room.css', 'styles/controls.css', 'styles/shell.css', 'styles/builder.css', 'styles/preview.css', 'styles/narrow.css'])
    expect(read.length).toBeGreaterThan(50)
    expect(read.filter((rule) => rule.file === 'styles/narrow.css').length).toBeGreaterThan(5)
    // and each rule's declarations, which the colour check reads.
    expect(read.find((rule) => /^\.tool,\s*\.quiet$/.test(rule.selector))?.properties).toContain('min-height')
  })

  // The workbench's panes and report-builder.css's parts take their colours
  // from the --wb-* room.css sets, and from nothing else: a Studio rule that
  // paints `.wb-pane` or a part would dress the builder differently here
  // than in a host's page, where only the variables travel -- the same
  // builder, two looks. Geometry is the room's to give (builder.css); colour
  // is not.
  test('declare no colour on a rule that names the builder', () => {
    const painting = (list: readonly Rule[]): string[] =>
      list
        .filter((rule) => NAMES_BUILDER.test(rule.selector))
        .filter((rule) => rule.properties.some((property) => COLOUR.test(property)))
        .map((rule) => `${rule.file}: ${rule.selector} { ${rule.properties.filter((property) => COLOUR.test(property)).join(', ')} }`)
    // A guard on the guard: it finds a colour on the workbench's pane and on
    // a part, and lets the shape of a button through.
    const sample = rulesOf(
      'sample',
      ".wb-pane > header { background-color: rgb(255 255 255 / 2%) } [data-report-part='title'] { color: white } .wb-pane button { border-radius: 999px }",
    )
    expect(painting(sample)).toEqual(['sample: .wb-pane > header { background-color }', "sample: [data-report-part='title'] { color }"])
    expect(rules().filter((rule) => NAMES_BUILDER.test(rule.selector)).length).toBeGreaterThan(0)
    expect(painting(rules())).toEqual([])
  })

  // A rule written for the Studio's own controls -- a select, a button --
  // that also selects the builder's would dress them as the room's
  // controls: taller selects than the inputs beside them, a second focus
  // ring over the builder's own. Matched against the builder as React draws
  // it, every rule but builder.css's and the room's three for every element.
  // What a host's view holds in the builder's middle is the Studio's own
  // Preview, which the Studio's rules dress (0029); the region it stands
  // in is the builder's, and held here with the rest.
  test('reach inside the builder only from builder.css, and with the room’s box model, selection and focus ring', () => {
    const inside = builder()
    expect(inside.some((element) => element.matches('select'))).toBe(true)
    expect(inside.some((element) => element.matches('[role="dialog"] button'))).toBe(true)
    expect(inside.some((element) => element.matches(HOST_VIEW))).toBe(true)
    expect(inside.some((element) => element.matches(`${HOST_VIEW} *`))).toBe(false)
    const studio = rules().filter((rule) => rule.file !== 'styles/builder.css' && !EVERYWHERE.has(rule.selector))
    expect(reaching(studio, inside)).toEqual([])
    // A guard on the guard: builder.css's rules do reach the builder drawn here.
    expect(
      reaching(
        rules().filter((rule) => rule.file === 'styles/builder.css'),
        inside,
      ).length,
    ).toBeGreaterThan(0)
  })

  // report-builder.css lays the builder out without a pane the person hid
  // by giving the workbench's grid fewer columns (0019). Each must be the
  // workbench's own columns without the hidden ones: a width typed apart
  // from workbench.css drifts from it, and a column left in puts the design
  // view in the outline's width. Read as text, because jsdom's CSS object
  // model drops grid properties it does not know.
  test('lay the builder out without a hidden pane in the workbench’s own columns', () => {
    const tracks = [...exported('@formancy/themes/workbench.css').matchAll(/(?:^|\})\s*\.wb\s*\{[^}]*grid-template-columns:\s*([^;]+);/g)].map(
      (match) => (match[1] ?? '').match(/minmax\([^)]*\)/g) ?? [],
    )
    expect(tracks).toHaveLength(1)
    const columns = tracks[0] ?? []
    expect(columns).toHaveLength(3)
    const grids = [
      ...exported('@formancy/report-builder-core/report-builder.css').matchAll(
        /\[data-report-part='editor'\]\.wb:where\(((?:\[data-hidden~='[a-z]+'\])+)\)\s*\{\s*grid-template-columns:\s*([^;]+);/g,
      ),
    ]
    expect(grids).toHaveLength(3)
    for (const [, condition = '', written = ''] of grids) {
      const hidden = [...condition.matchAll(/'([a-z]+)'/g)].map((match) => match[1])
      const kept = columns.filter(
        (_, at) => !(at === 0 && hidden.includes('outline')) && !(at === 2 && hidden.includes('properties') && hidden.includes('diagnostics')),
      )
      expect(written.trim(), hidden.join(' ')).toBe(kept.join(' '))
    }
  })

  // The paper is what prints. A rule of the room's on a page's canvas or on
  // PDF.js's text spans -- a font, a focus ring, box-sizing, a selection
  // colour -- would show something the PDF does not hold. Only rules that
  // are the paper's own (their selector names it) may match inside it: the
  // white page, and the text layer PDF.js expects. Beside the builder those
  // are the Studio's rules; in its middle (0029) the builder's join them,
  // and only the workbench's inert `.wb *` reaches the paper there.
  test('reach nothing on the paper but the rules that are its own, beside the builder and in its middle', async () => {
    const middle = [...(await studio()).querySelectorAll('.paper *')]
    expect(middle.some((element) => element.matches('.paper-text span'))).toBe(true)
    const every = [...rules(), ...builderSheets()].filter((rule) => !rule.selector.includes('.paper'))
    expect(reaching(every, middle)).toEqual([INERT])
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="viewer"><div class="paper" id="beside"><div class="paper-page"><canvas></canvas><div class="paper-text"><span>Total</span><br><span class="markedContent"><span>CHF</span></span></div></div></div></div>',
    )
    const beside = [...document.querySelectorAll('#beside *')]
    expect(beside.length).toBe(7)
    expect(reaching(every, beside)).toEqual([])
    // A guard on the guard: the room's own element rules do reach an element
    // that is not on the paper.
    document.body.insertAdjacentHTML('beforeend', '<button>Off the paper</button>')
    const button = document.querySelector('body > button') as Element
    expect(rules().some((rule) => selectorsOf(rule.selector).some((selector) => button.matches(selector)))).toBe(true)
  })

  // Standing in the design view's place, the Preview is inside the
  // workbench but no pane of it (0029): a pane's rules would dress its
  // Previous page, Zoom and Final as the builder's own controls, and give it
  // a header it does not have. Every rule of workbench.css and
  // report-builder.css as a host's bundler resolves them, and every Studio
  // rule that names the builder, matched against the Preview the Studio
  // draws there: only the workbench's inert `.wb *` reaches it.
  test('let no rule of the builder’s reach inside the Preview standing in its middle but the workbench’s inert one', async () => {
    const view = await studio()
    const inside = [...view.querySelectorAll('*')]
    expect(inside.some((element) => element.matches('button.tool'))).toBe(true)
    expect(inside.some((element) => element.matches('input[type="checkbox"]'))).toBe(true)
    expect(reaching(builderRules(), inside)).toEqual([INERT])
    // The inert rule turns transitions off and nothing else; with a property
    // more it would dress the Preview, and is no longer admitted -- which
    // the reader sees, as it does in a sample.
    expect(declaredBy(exported('@formancy/themes/workbench.css'), '.wb *')).toEqual([['transition']])
    expect(declaredBy('@media (x) { .wb *, .wb .y * { transition: none; color: red } }', '.wb *')).toEqual([['transition', 'color']])
    // A guard on the guard: the same rules do dress the builder's own pane beside it.
    const pane = within(screen.getByRole('region', { name: 'Report editor' }))
      .getByRole('tree', { name: 'Outline' })
      .closest('[data-pane]')
    expect(reaching(builderRules(), [...(pane?.querySelectorAll('*') ?? [])]).filter((rule) => rule !== INERT).length).toBeGreaterThan(0)
  })

  // The Preview's place is decided from one width twice: by layout.ts,
  // which tells the editors where it stands, and here, where narrow.css
  // gives the builder the row; the browser gate and the README pictures'
  // camera read their widths from the stylesheet. Two numbers apart would
  // stand the Preview beside a builder laid out alone in its row, or leave
  // an empty column beside a builder with the Preview in its middle.
  test('give the builder the row up to the width at which layout.ts stands the Preview in its middle', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(join(styles, 'styles', 'narrow.css'), 'utf8')
    document.head.append(style)
    const conditions = [...(style.sheet as CSSStyleSheet).cssRules]
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
      .filter((rule) => [...rule.cssRules].some((inner) => inner instanceof CSSStyleRule && inner.selectorText === '.studio-main'))
      .map((rule) => rule.conditionText)
    style.remove()
    expect(conditions).toEqual([MIDDLE])
  })
})
