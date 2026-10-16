/*
 * docs/getting-started.md's Angular page, from outside the workspace (0015).
 *
 * The install gate writes the guide's Angular blocks into guide/ in the
 * Angular builder's own host -- the page needs nothing the builder does not
 * declare but the workbench's stylesheet -- at the newest and the oldest
 * Angular the builder's peer range admits. ngc compiles them with this file,
 * ahead of time with strict templates, as a browser's code; the gate
 * bundles this file for Node with the builder linked, and every one of the
 * guide's modules for a browser.
 *
 * This draws the guide's page with @angular/platform-server, as angular.ts
 * draws the builder, with the guide's own `appConfig` -- change detection
 * without zone.js -- over an editor the guide's `openEditor` opened: the
 * builder as report-builder-core's README sets out, a Save button, nothing
 * said by Angular's development mode, one listener while the page was
 * alive and none once it was destroyed. The guide's main.ts bootstraps the
 * same page in a browser, which nothing here runs; nor does anything press
 * Save.
 */
import { Component, VERSION } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { BEFORE_APP_SERIALIZED, provideServerRendering, renderApplication } from '@angular/platform-server'
import type { ReportDefinition } from '@formancy/report-spec'
import { openEditor } from './guide/editor.js'
import { appConfig, ReportPage } from './guide/report-page.js'
import { elementsIn, readMarkup, spokenText } from './markup.js'
import { insertAndSelect, reportToDraw, structureProblems } from './structure.js'

/** What could be wrong, collected, so one run names every difference rather than the first. */
const wrong: string[] = []
const expect = (holds: boolean, what: string): void => {
  if (!holds) wrong.push(what)
}

// The report structure.ts reads, opened by the guide's openEditor.
const opened = openEditor(reportToDraw())
insertAndSelect(opened.editor)
const listening = opened.editor.listenerCount()
/** How many listeners the editor had once the page was drawn, before the application was destroyed. */
let drawn: number | undefined

/** A host of the guide's page, as its main.ts is, with the editor already opened. */
@Component({ selector: 'app-root', imports: [ReportPage], template: '<app-report-page [opened]="opened" (saved)="saved($event)" />' })
class Host {
  protected readonly opened = opened
  protected saved(report: ReportDefinition): void {
    wrong.push(`the page saved ${report.id} while it was drawn, which nobody asked it to`)
  }
}

const said: string[] = []
const { error, warn } = console
console.error = console.warn = (...args: unknown[]): void => {
  said.push(args.map(String).join(' '))
}
let html: string
try {
  html = await renderApplication(
    (context: BootstrapContext) =>
      bootstrapApplication(
        Host,
        {
          providers: [
            ...appConfig.providers,
            provideServerRendering(),
            { provide: BEFORE_APP_SERIALIZED, multi: true, useValue: (): void => void (drawn = opened.editor.listenerCount()) },
          ],
        },
        context,
      ),
    { document: '<html><head></head><body><app-root></app-root></body></html>', url: '/' },
  )
} finally {
  console.error = error
  console.warn = warn
}
if (said.length > 0) throw new Error(`Angular said this while drawing the guide's page:\n${said.join('\n')}`)

const page = elementsIn(readMarkup(html)).find((element) => element.tag === 'app-report-page')
if (page === undefined) throw new Error("the guide's page was not drawn")
const [root] = elementsIn(page).filter((element) => element.tag === 'report-builder')
if (root === undefined) throw new Error("the guide's page draws no <report-builder>")
wrong.push(...structureProblems(root, opened.editor.state()))
expect(elementsIn(page).filter((element) => element.tag === 'button' && spokenText(element) === 'Save').length === 1, 'the page has not one Save button')
expect(drawn === listening + 1, `the editor had ${String(listening)} listeners before the page was drawn and ${String(drawn)} once it was, not one more`)
expect(opened.editor.listenerCount() === listening, `the editor had ${String(listening)} listeners before the page was drawn and ${String(opened.editor.listenerCount())} after the application was destroyed`)

opened.editor.dispose()
if (wrong.length > 0) throw new Error(`the guide's Angular page, on Angular ${VERSION.full}:\n- ${wrong.join('\n- ')}`)

console.log(
  `ok: Angular ${VERSION.full} drew the guide's page on the server with the guide's appConfig, compiled ahead of time and linked: the builder as report-builder-core's README sets out and a Save button, nothing said by Angular's development mode, one listener while the page was alive and none once it was destroyed`,
)
