/*
 * The Angular builder from outside the workspace, built and run the way an
 * Angular CLI host builds and runs it. It is installed from its tarball in a
 * project that holds only what an Angular host has: the builder, the
 * packages it declares, and Angular. There are no Node types and no other
 * @formancy package. The gate then:
 *
 * - compiles this file ahead of time with ngc and strict templates, as a
 *   browser host's code (DOM types, no Node types, skipLibCheck OFF), so
 *   `<report-builder [editor]>` below is checked against the builder's
 *   published declarations, as a host's template is;
 * - bundles it with build.mjs, whose compiler-cli linker turns the
 *   builder's partial declarations -- and Angular's own -- into definitions,
 *   as the CLI's build does, refusing a library its Angular is too old for;
 * - runs the bundle under Node in Angular's development mode, without
 *   Angular's JIT compiler, drawing the builder with @angular/platform-server.
 *
 * It does all of that again at the oldest Angular the peer range admits.
 *
 * What it cannot show is anything a browser does after the markup: focus, a
 * key, a pointer, a re-render after an edit. Those are the package suite's,
 * in jsdom, inside the workspace.
 */
import { Component, provideZonelessChangeDetection, reflectComponentType, VERSION } from '@angular/core'
import type { ComponentMirror, Signal, Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { BEFORE_APP_SERIALIZED, provideServerRendering, renderApplication } from '@angular/platform-server'
import * as builder from '@formancy/report-builder-angular'
import { injectEditorState, ReportBuilder, ReportEditorRoot, ReportHostView } from '@formancy/report-builder-angular'
import type { FocusAfter } from '@formancy/report-builder-angular'
import type { EditorState, ReportEditor } from '@formancy/report-builder-core'
import { elementsIn, readMarkup } from './markup.js'
import type { MarkupElement } from './markup.js'
import { editorToDraw, editorWithBill, editorWithEInvoice, editorWithHostView, editorWithImages, HOST_VIEW, structureProblems } from './structure.js'

/** What could be wrong, collected, so one run names every difference rather than the first. */
const wrong: string[] = []
const expect = (holds: boolean, what: string): void => {
  if (!holds) wrong.push(what)
}

/**
 * Whether Angular's JIT compiler is loaded: @angular/compiler publishes its
 * facade on the global `ng` as it loads, and that facade is what lets a
 * partial declaration link itself at run time. A host's build ships no JIT
 * compiler, so a builder that needs one, or imports it, would fail there.
 */
const jit = (): boolean => (globalThis as { readonly ng?: { readonly ɵcompilerFacade?: unknown } }).ng?.ɵcompilerFacade !== undefined

// For the type-checker: a host's code against the declarations -- where
// focus goes, and the signal a host's own view reads -- in report-builder-
// core's types and Angular's. A declaration that lost either import, or
// changed the signal's type, does not compile here.
export const focus: FocusAfter = { to: 'pane', panel: 'properties' }
export const follow: (editor: Signal<ReportEditor>) => Signal<EditorState> = injectEditorState

// Every export, as the package's module has it rather than as a list here
// says: a part added later is checked without this file changing.
const components = new Map<string, ComponentMirror<unknown>>()
for (const [name, value] of Object.entries(builder)) {
  if (value === injectEditorState || value === ReportEditorRoot || value === ReportHostView) continue
  // reflectComponentType reads the class's ɵcmp: null for a class that was not linked as a component.
  const mirror = typeof value === 'function' ? reflectComponentType(value as Type<unknown>) : null
  if (mirror === null) {
    wrong.push(`${name} is exported and is not a component`)
    continue
  }
  components.set(name, mirror)
  expect(mirror.isStandalone, `${name} is not standalone, so a host's imports cannot take it`)
  expect(typeof (value as { readonly ɵfac?: unknown }).ɵfac === 'function', `${name} has no factory (ɵfac)`)
}

// The directive every part injects: a definition, a factory, and no component's.
const root: { readonly ɵdir?: unknown; readonly ɵfac?: unknown } = ReportEditorRoot
expect(reflectComponentType(ReportEditorRoot) === null && typeof root.ɵdir === 'object' && typeof root.ɵfac === 'function', 'ReportEditorRoot is not a linked directive with a factory')

// The template a host gives as its own view (0029): a directive too, on an ng-template, never a part drawn as an element.
const hostView: { readonly ɵdir?: unknown; readonly ɵfac?: unknown } = ReportHostView
expect(reflectComponentType(ReportHostView) === null && typeof hostView.ɵdir === 'object' && typeof hostView.ɵfac === 'function', 'ReportHostView is not a linked directive with a factory')

// <report-builder [editor]="editor" />, as the README writes it.
expect(components.get('ReportBuilder')?.selector === 'report-builder', `ReportBuilder's selector is ${String(components.get('ReportBuilder')?.selector)}, not report-builder`)

// "Each part is an attribute on the element it is, so the DOM has no wrapper
// elements the React builder lacks": every part's selector is an element
// with an attribute, never an element of its own.
const parts = [...components].filter(([name]) => name !== 'ReportBuilder')
for (const [name, mirror] of parts) {
  expect(/^[a-z]+\[report[A-Z][A-Za-z]*\]$/.test(mirror.selector), `${name}'s selector ${mirror.selector} is not an attribute on an element`)
}

const editor: ReportEditor = editorToDraw()
const state: EditorState = editor.state()
const listening = editor.listenerCount()
/** How many listeners the editor had once the page was drawn, before the application was destroyed. */
let drawn: number | undefined
/** The editor drawn a second time, with a host's view shown in the design view's place (0029). */
const viewing: ReportEditor = editorWithHostView()
/** And a third, made with a host's store, over a report with two images (0033). */
const imaging: ReportEditor = editorWithImages()
/** And a fourth, with a QR-bill added and selected, its debtor added (0039). */
const billing: ReportEditor = editorWithBill()
/** And a fifth, with an e-invoice selected and a VAT category added (0044). */
const invoicing: ReportEditor = editorWithEInvoice()

/**
 * A host's component, as a host writes it. ngc compiles its template with
 * strict templates against the builder's declarations: an `[editor]` the
 * declarations do not take is NG8002 at build time, and an editor of
 * another type is TS2322.
 */
@Component({ selector: 'app-root', imports: [ReportBuilder], template: '<report-builder [editor]="editor" />' })
class Host {
  protected readonly editor: ReportEditor = editor
}

/** A host's component that gives the builder its own view, as `<ng-template reportHostView>`. */
@Component({
  selector: 'app-root',
  imports: [ReportBuilder, ReportHostView],
  template: '<report-builder [editor]="editor"><ng-template reportHostView><p>{{ text }}</p></ng-template></report-builder>',
})
class Viewing {
  protected readonly editor: ReportEditor = viewing
  protected readonly text = HOST_VIEW.text
}

/** A host's component whose editor keeps the images a person adds: the builder draws Add image… and the report's images. */
@Component({ selector: 'app-root', imports: [ReportBuilder], template: '<report-builder [editor]="editor" />' })
class Imaging {
  protected readonly editor: ReportEditor = imaging
}

/** A host's component whose report has a QR-bill, selected: the builder draws its row, its band and its parties. */
@Component({ selector: 'app-root', imports: [ReportBuilder], template: '<report-builder [editor]="editor" />' })
class Billing {
  protected readonly editor: ReportEditor = billing
}

/** A host's component whose report has an e-invoice, selected: the builder draws its row and its groups with their buttons. */
@Component({ selector: 'app-root', imports: [ReportBuilder], template: '<report-builder [editor]="editor" />' })
class Invoicing {
  protected readonly editor: ReportEditor = invoicing
}

/**
 * `root` drawn as a host's server draws a page, failing on anything
 * Angular's development mode says while it does: an unknown property, a
 * changed expression, a missing required input. `serialized` is called with
 * the page drawn and the application still alive, just before it is written
 * out. Returns the builder's element.
 */
async function serverDraw(root: Type<unknown>, serialized: () => void = () => undefined): Promise<MarkupElement> {
  const said: string[] = []
  const { error, warn } = console
  console.error = console.warn = (...args: unknown[]): void => {
    said.push(args.map(String).join(' '))
  }
  let html: string
  try {
    html = await renderApplication(
      (context: BootstrapContext) =>
        bootstrapApplication(root, { providers: [provideServerRendering(), provideZonelessChangeDetection(), { provide: BEFORE_APP_SERIALIZED, multi: true, useValue: serialized }] }, context),
      { document: '<html><head></head><body><app-root></app-root></body></html>', url: '/' },
    )
  } finally {
    console.error = error
    console.warn = warn
  }
  if (said.length > 0) throw new Error(`Angular said this while drawing the builder:\n${said.join('\n')}`)
  // <app-root> holds the builder's element, which is the editor's root: the
  // host directive makes <report-builder> the region, with no wrapper.
  const page = elementsIn(readMarkup(html))
  const hosts = page.filter((element) => element.tag === 'app-root')
  const builders = hosts.flatMap((host) => host.children).filter((child) => typeof child !== 'string' && child.tag === 'report-builder')
  const [drawnRoot] = builders
  if (hosts.length !== 1 || builders.length !== 1 || drawnRoot === undefined || typeof drawnRoot === 'string') throw new Error('the page does not hold one <report-builder> in the host')
  return drawnRoot
}

wrong.push(...structureProblems(await serverDraw(Host, () => void (drawn = editor.listenerCount())), state))
// Drawn again with a host's view shown in the design view's place (0029):
// the template the host gave, stamped into the region the builder lends it,
// and no design view.
wrong.push(...structureProblems(await serverDraw(Viewing), viewing.state()).map((problem) => `with a host's view: ${problem}`))
viewing.dispose()
// Drawn a third time with a host's store (0033): Add image… and its hidden input, and the report's images, each with its Remove.
wrong.push(...structureProblems(await serverDraw(Imaging), imaging.state()).map((problem) => `with images: ${problem}`))
imaging.dispose()
// Drawn a fourth time with a QR-bill added and selected (0039): its row, its band selected, its parties as groups.
wrong.push(...structureProblems(await serverDraw(Billing), billing.state()).map((problem) => `with a QR-bill: ${problem}`))
billing.dispose()
// Drawn a fifth time with an e-invoice selected and a VAT category added (0044): its row after the bill's, its groups and their buttons.
wrong.push(...structureProblems(await serverDraw(Invoicing), invoicing.state()).map((problem) => `with an e-invoice: ${problem}`))
invoicing.dispose()

// Drawing changed nothing. The editor's state reached the root through
// [editor] -- an input the root requires, so a page drawn without it fails
// -- and the root subscribed while the page was alive, in an effect, and let
// go when the server destroyed the application: a builder that kept its
// listener would keep every editor a server ever drew.
expect(editor.state() === state, 'drawing the builder changed the editor state')
expect(drawn === listening + 1, `the editor had ${String(listening)} listeners before the page was drawn and ${String(drawn)} once it was, not one more`)
expect(editor.listenerCount() === listening, `the editor had ${String(listening)} listeners before the page was drawn and ${String(editor.listenerCount())} after the application was destroyed`)
expect(!jit(), "Angular's JIT compiler was loaded, so a declaration the build did not link would have linked itself here and not in a host's build")

editor.dispose()
if (wrong.length > 0) throw new Error(`the Angular builder, compiled ahead of time and drawn on the server:\n- ${wrong.join('\n- ')}`)

console.log(
  `ok: Angular ${VERSION.full} drew the packed builder on the server, compiled ahead of time and linked without the JIT compiler, in Swiss German, as report-builder-core's README sets out: one region named by the catalogue, a toolbar that is one tab stop with a button per pane, a Hide in each side pane, a palette of ${String(state.palette.length)}, a tree with a group per region and a row per node, a design view of named pictures, a form named by its heading, the report's problems listed and counted, and the live region, and with a host's view its template stamped into the region it stands in instead of the design view, and with a host's store Add image… and its hidden input, and the report's images, each with its Remove; every data-report-part one REPORT_PARTS names; nothing said by Angular's development mode and nothing changed; one listener while the page was alive and none once it was destroyed; ${String(components.size)} standalone components with a factory, ReportEditorRoot a directive, and each of the ${String(parts.length)} parts an attribute on an element`,
)
