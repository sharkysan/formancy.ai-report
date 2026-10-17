# Getting started: a PDF from your data, and the editor in your page

This guide takes an application developer from an empty npm project to a
quotation printed as a PDF, in Node and in a browser, and to the report
editor in a React page that saves what the author changed and previews it as
they work, and in an Angular page that saves. It is written for the 0.1.0
developer preview: the packages are the ones
[README.md](../README.md#packages) lists, the report format is version 0, a
draft, and there is no server package yet, so where a page needs a server
-- to store a report, or to hand it data -- the server is yours.

Formancy Report is source-available, not open source: evaluating and
developing with it, as this guide does, is free, and running it in
production takes a paid licence. The
[licence table](../README.md#licence-in-one-table) says what is free, what is
not, and where a production licence is requested.

**How this guide is kept true.** Every TypeScript block below is compiled
by the install gate, `pnpm test:e2e:install`, against the packages as
`pnpm pack` packs them, installed into plain npm projects with
`skipLibCheck` off, and run there or, where it needs a browser, bundled for
one; CI runs the gate on every pull request and before every release
([0015](./decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)):

- the Node blocks of sections 2 and 6 are one program, checked against
  Node's types and run: it must write a PDF and print exactly the lines this
  guide shows it printing;
- the blocks of sections 3 and 4 are one React page, checked against the
  DOM's types and not Node's, at the newest and the oldest React the React
  builder's peer range admits: its component is drawn by React's server
  renderer, its preview is run under Node against the browser entry of the
  renderer, and every one of its files is bundled for a browser;
- the blocks of section 5, with section 4's `editor.ts`, are one Angular
  page, compiled ahead of time with strict templates at both ends of the
  Angular builder's peer range, its component drawn by Angular's
  platform-server and every file bundled for a browser.

`scripts/getting-started.test.mjs`, in `pnpm test:repo`, fails when a block
of code is not handed to the gate, or imports a package section 1 does not
tell you to install. What neither checks: these pages in a real browser --
nothing here mounts them in a DOM, presses Save or shows the PDF -- the
`angular.json` lines in section 5, and the server routes the pages call,
which are yours.

## 1. Install

The packages are ES modules with an `exports` map; import their entry
points, never a file under `dist/`. Which you install depends on what your
application does.

To render a PDF, in Node or in a browser:

```sh guide=node,react
npm install @formancy/report-runtime @formancy/report-render-pdf
```

To validate and diagnose a report your application stores (section 6):

```sh guide=node
npm install @formancy/report-spec @formancy/report-core
```

To embed the editor in a React page, in a React application:

```sh guide=react
npm install @formancy/report-core @formancy/report-builder-core @formancy/report-builder-react @formancy/themes@0.5.0
```

To embed it in an Angular page, in an Angular application:

```sh guide=angular
npm install @formancy/report-spec @formancy/report-core @formancy/report-builder-core @formancy/report-builder-angular @formancy/themes@0.5.0
```

`@formancy/themes` is formancy's, under Apache-2.0, at the release the
builders are dressed with. Its `workbench.css` lays out the editor's panes,
and `report-builder-core`'s `report-builder.css` dresses what is particular
to reports; a page imports both, the workbench's first. The builder takes
its colours from the workbench's `--wb-*` variables, so a page recolours it
by setting those and never by overriding a rule
([report-builder-core's README](../packages/report-builder-core/README.md#the-stylesheet)).

What the packages are tested with -- Node, TypeScript, React, Angular and
the upstream `@formancy/*` releases -- is the table under
[*What it is tested with*](../README.md#what-it-is-tested-with) in the
README, generated from the run that gated the release, with each builder's
peer range in its *Declared as* column; the install gate checks each
builder, and this guide's pages, at the newest and the oldest release its
range admits. The release report every CI run produces says what that run
actually ran.

## 2. Render a PDF in Node

The program in this section is TypeScript, run by Node through `tsx`. In a
new npm project (`npm init -y`), make the project one of ES modules -- the
packages are ES modules, and the program awaits at its top level -- and add
the tools it is built with, at the releases the install gate builds it
with:

```sh guide=node
npm pkg set type=module
npm install --save-dev typescript@~6.0.3 tsx@^4.20.3 @types/node@^22.10.0
```

and a `tsconfig.json` with the settings the gate type-checks it under --
strict, the library declaration files checked too, and Node's types:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": false,
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "lib": ["ES2023"],
    "types": ["node"],
    "noEmit": true
  },
  "include": ["*.ts"]
}
```

Write the program in `quotation.ts`, check it with `npx tsc`, and run it
with `npx tsx quotation.ts`.

A report is a JSON document: what it prints, from which data, laid out how.
It names the data it reads -- one header record and one list of detail rows
-- as contracts with typed fields, and never says where the data comes
from. This one is a short quotation: a heading, a table of lines, a total
the runtime computes, and a footer with the page count. In `quotation.ts`:

```ts guide=node
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/** Swiss francs to the centime, as every amount here prints. */
const chf = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const

const quotation: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'quotation',
  title: 'Quotation',
  locale: 'en-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'total', bold: true },
    { id: 'footer', size: 8, align: 'center' },
  ],
  datasets: {
    header: {
      id: 'quotation',
      fields: [
        { id: 'number', type: 'string', label: 'Number', nullable: false },
        { id: 'customer', type: 'string', label: 'Customer', nullable: false },
      ],
    },
    detail: {
      id: 'quotation-lines',
      fields: [
        { id: 'description', type: 'string', label: 'Description', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Quantity', nullable: false, scale: 2 },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }],
  regions: {
    reportHeader: [
      { id: 'heading', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Quotation ' }, { kind: 'field', field: { dataset: 'header', field: 'number' } }] },
      { id: 'for', kind: 'text', content: [{ kind: 'text', text: 'For ' }, { kind: 'field', field: { dataset: 'header', field: 'customer' } }] },
      { id: 'gap', kind: 'spacer', height: 12 },
    ],
    pageHeader: [],
    body: [
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'description', header: 'Description', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'description' } } },
          { id: 'quantity', header: 'Quantity', width: 60, align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'quantity' }, format: { kind: 'number', scale: 2, grouping: true } } },
          { id: 'amount', header: 'Amount', width: 90, align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'amount' }, format: chf } },
        ],
        totals: [
          {
            cells: [
              { column: 'description', value: { kind: 'text', text: 'Total' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: chf } },
            ],
            style: 'total',
          },
        ],
        emptyText: 'No lines.',
        repeatHeader: true,
      },
    ],
    summary: [],
    pageFooter: [
      { id: 'page', kind: 'text', style: 'footer', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] },
    ],
  },
}

/** What your application hands over: the record and the rows, and what its query says of them. */
const data: ReportData = {
  header: { number: 'Q-2026-0042', customer: 'Muster AG' },
  detail: [
    { description: 'Maintenance, flat rate', quantity: '1.00', amount: '480.00' },
    { description: 'Filter F7', quantity: '6.00', amount: '231.00' },
    { description: 'Technician', quantity: '3.75', amount: '480.00' },
  ],
  completeness: { complete: true, captured: 3 },
  consistency: 'host-captured',
}
```

Exact numbers travel as strings, `'3.75'`, never as JavaScript numbers,
which have already lost digits by the time the runtime would see them; the
runtime computes the total exactly and rounds it once, as declared.
`completeness` says whether your query handed over every row, and
`consistency` how it read them -- here, captured by the host itself. A field
the report does not declare is refused: a report never carries what it
does not print
([report-runtime's README](../packages/report-runtime/README.md#the-data)).

Then, still in `quotation.ts`, resolve the report against the data, and
draw what the runtime resolved:

```ts guide=node
import { writeFile } from 'node:fs/promises'
import { resolveReport } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'

const creationDate = new Date().toISOString()
const resolution = resolveReport(quotation, data, { mode: 'final', creationDate })
if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const pdf = await renderPdf(resolution.document, { maxPages: 50 })
await writeFile('quotation.pdf', pdf)
```

`resolveReport` holds every value to its field's contract, evaluates the
report's expressions, computes the totals and formats each value for the
report's locale, once; nothing in it fetches anything. `renderPdf` draws the
result with pdfmake in Roboto. The creation date is yours to fix: the same
report, data and date print the same bytes. `maxPages` is required, and a
report that needs more is refused rather than cut short.

What it costs: pdfmake lays out a whole document in one synchronous pass on
the thread that calls it. The render yields between its passes, so an
`AbortSignal` passed as `signal` arrives, but a pass under way runs to its
end; a server that must stay responsive renders in a worker it can
terminate
([report-render-pdf's README](../packages/report-render-pdf/README.md#what-it-does-not-do)).

### When it will not print

Neither call ever returns part of a document. `resolveReport` gives every
reason at once, up to a bound, each with the `stage` that found it, a stable
`code`, a JSON Pointer `path` into what it read and a `message` for a
person, which never holds a value from your data. `renderPdf` rejects with a `RenderRefusal`
whose `code` is one of `REFUSAL_CODES`, each in
[the renderer's table](../packages/report-render-pdf/README.md#what-it-refuses),
and anything else it rejects with is a fault, not the report.

A **final** render is the report as it is kept and sent: it refuses data
your provider calls incomplete, and a field the data lacks. A **preview** is
what an author works against: it prints what it has, warns once for each
field it lacks in the resolution's `warnings`, says in its manifest that it
is a preview, and when the data is incomplete or lacks a field, heads every
page with a label that it is not the report. In `quotation.ts`:

```ts guide=node
import { PREVIEW_LABEL } from '@formancy/report-runtime'
import { RenderRefusal } from '@formancy/report-render-pdf'

// The same quotation, with the query stopped after two of its three lines.
const cut: ReportData = { ...data, detail: (data.detail ?? []).slice(0, 2), completeness: { complete: false, captured: 2 } }

const inFinal = resolveReport(quotation, cut, { mode: 'final', creationDate })
if (!inFinal.ok) for (const error of inFinal.errors) console.log(`final: refused, ${error.stage} ${error.code} at ${error.path}: ${error.message}`)

const inPreview = resolveReport(quotation, cut, { mode: 'preview', creationDate })
if (inPreview.ok) console.log(`preview: ${String(inPreview.manifest.completeness.captured)} lines, every page headed "${PREVIEW_LABEL}"`)

// A customer's name in a script Roboto, the one font a report's text prints in, has no glyphs for.
const named = resolveReport(quotation, { ...data, header: { ...data.header, customer: '山田商事' } }, { mode: 'final', creationDate })
if (named.ok) {
  await renderPdf(named.document, { maxPages: 50 }).catch((error: unknown) => {
    if (!(error instanceof RenderRefusal)) throw error
    console.log(`not drawn: ${error.code}, ${error.message}`)
  })
}
```

This prints:

```text guide=node
final: refused, data incomplete at /completeness/complete: the provider says the data is incomplete; a final render prints every row or none, and never a silently truncated report
preview: 2 lines, every page headed "Preview of incomplete data: not a final report"
not drawn: unsupported, body[1] prints U+5C71, which Roboto has no glyph for: it would print as an empty box, and as nothing in the PDF's text, and no other font is embedded
```

The renderer names where it stopped as a place in the resolved document,
where the report's header comes first: `body[1]` is the line that names the
customer.

## 3. Render in the browser

The browser has the same renderer under another entry point,
`@formancy/report-render-pdf/browser`: the same `renderPdf`, the same
refusals and the same pages. What differs is pdfmake's build and where the
fonts come from: pdfmake's browser build, with Roboto from pdfmake's
`vfs_fonts.js`, the four font files as base64 inside a script, so the page's
bundle carries them. A report with a Swiss QR-bill prints its slip in
Liberation Sans, which the entry imports from a chunk of its own the first
time a document has a bill, so a bundler that splits dynamic imports keeps
it out of a page that prints none. Nothing in it touches a file system or
follows an address.

In `print.ts`, a preview prints the report against sample data:

```ts guide=react file=print.ts
import { resolveReport } from '@formancy/report-runtime'
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf/browser'

/**
 * `report` printed in the page against `sample`, as a preview: what the
 * sample lacks is labelled on every page rather than refused. Rejects with
 * the runtime's reasons, or with the renderer's RenderRefusal.
 */
export async function printPreview(report: ReportDefinition, sample: ReportData, signal: AbortSignal): Promise<Uint8Array> {
  const resolution = resolveReport(report, sample, { mode: 'preview', creationDate: new Date().toISOString() })
  if (!resolution.ok) throw new Error(resolution.errors.map((error) => error.message).join('; '))
  return renderPdf(resolution.document, { maxPages: 40, signal })
}
```

What it costs: the render runs on the page's own thread, so a long report
holds the tab for each of pdfmake's passes. The page bound is yours to
choose: a report that needs more pages is refused as `too-many-pages`, and
one whose least height already needs more is refused before pdfmake lays
out anything. The bytes are the other cost. In the Studio's production
build of 17 October 2026, the chunk holding the runtime and the renderer's
browser entry, pdfmake and its fonts and uqr, the QR code encoder, among
them, was 1,922 kB and 849 kB gzipped, as Vite reported it; the Studio
loads that chunk with the first preview, through `import()`, rather than
with the page. Liberation Sans's chunk was 1,100 kB and 519 kB gzipped,
loaded with the first preview of a report with a bill and never
otherwise.

**Showing the PDF is the page's choice.** Section 4 hands the bytes to the
browser's own viewer in an `<iframe>`; a download link takes the same bytes.
The Studio draws each page with PDF.js instead, and that viewer is not
published: `pdfjs-dist` ships a font under GPL-2.0 with a font exception,
which the dependency rule refuses in a published package
([0006](./decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)),
so it stays inside the private Studio until there is a reviewed exception
for that font or a viewer that leaves `pdfjs-dist` to the host
([0013](./decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
A page that wants PDF.js brings its own.

## 4. Embed the editor in React

The editor works on a **session**: `report-core`'s, which holds the document
and its undo history and commits only what the validator accepts. Over it
sits an **editor**, one person's view of the session -- the selection, the
zoom, the language of the editor's own words -- which the builder draws.
The same two, in `editor.ts`, open a report for the Angular page in section
5:

```ts guide=react,angular file=editor.ts
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import { createReportEditor } from '@formancy/report-builder-core'
import type { ReportEditor } from '@formancy/report-builder-core'

export interface OpenedEditor {
  readonly session: ReportSession
  readonly editor: ReportEditor
}

/** A session over a stored report and an editor over the session, in English; a report the validator refuses is not opened. */
export function openEditor(stored: unknown): OpenedEditor {
  const opening = openReportSession(stored)
  if (!opening.ok) throw new Error(opening.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  return { session: opening.session, editor: createReportEditor(opening.session, { locale: 'en' }) }
}
```

The preview follows the session. It prints at once, and again once the
author pauses; a print the next edit overtakes is aborted through its
signal, which `renderPdf` reads between its passes, and its PDF is never
shown, so the preview never shows an older document after a newer one.
`preview.ts` has no framework in it:

```ts guide=react file=preview.ts
import type { ReportSession } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-runtime'

/** What prints a report for the preview: printPreview bound to sample data, or a request to your server that passes the signal to fetch. */
export type Print = (report: ReportDefinition, signal: AbortSignal) => Promise<Uint8Array>

/** The latest preview: the PDF, or why it was not printed. */
export type Preview = { readonly pdf: Uint8Array } | { readonly refused: string }

/** Prints the session's document now, and again once edits pause for `delay` milliseconds. Returns the function that stops it. */
export function keepPreviewing(session: ReportSession, print: Print, show: (preview: Preview) => void, delay = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: AbortController | undefined
  const start = (): void => {
    const controller = new AbortController()
    running = controller
    print(session.document(), controller.signal).then(
      (pdf) => {
        if (!controller.signal.aborted) show({ pdf })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) show({ refused: error instanceof Error ? error.message : String(error) })
      },
    )
  }
  const unsubscribe = session.subscribe(() => {
    clearTimeout(timer)
    running?.abort()
    timer = setTimeout(start, delay)
  })
  start()
  return () => {
    unsubscribe()
    clearTimeout(timer)
    running?.abort()
  }
}
```

The page draws the builder, a Save button and the preview.
`<ReportBuilder editor={editor} />` takes one prop and fills its container,
so the page gives `.report-page` a height. The session's `hash()` names the
document and stays the same until an edit, and the same again once that
edit is undone, so Save is offered only when there is something to save;
`exportDocument()` is a deep copy of the document, safe to hand to anything.
Undo and redo are the builder's -- its toolbar, and Ctrl+Z and Ctrl+Y -- and
act on the session's history, which outlives the builder; a control of the
page's own sends `editor.dispatch({ type: 'undo' })`. The page, in
`report-page.tsx`:

```tsx guide=react
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { ReportBuilder } from '@formancy/report-builder-react'
import type { ReportDefinition } from '@formancy/report-runtime'
import type { OpenedEditor } from './editor.js'
import { keepPreviewing } from './preview.js'
import type { Preview, Print } from './preview.js'

export interface ReportPageProps {
  readonly opened: OpenedEditor
  /** The same function on every render: a new one starts the preview again. */
  readonly print: Print
  readonly save: (report: ReportDefinition) => void
}

export function ReportPage({ opened: { session, editor }, print, save }: ReportPageProps): ReactElement {
  const hash = useSyncExternalStore(session.subscribe, session.hash, session.hash)
  const [saved, setSaved] = useState(hash)
  const [preview, setPreview] = useState<Preview>()
  useEffect(() => keepPreviewing(session, print, setPreview), [session, print])

  const onSave = (): void => {
    save(session.exportDocument())
    setSaved(hash)
  }
  return (
    <div className="report-page">
      <ReportBuilder editor={editor} />
      <button type="button" disabled={hash === saved} onClick={onSave}>
        Save
      </button>
      {preview === undefined ? null : 'pdf' in preview ? <PdfFrame pdf={preview.pdf} /> : <p role="alert">{preview.refused}</p>}
    </div>
  )
}

/** The browser's own viewer, over a copy of the PDF's bytes, let go of when the next one replaces it. */
function PdfFrame({ pdf }: { readonly pdf: Uint8Array }): ReactElement {
  const url = useMemo(() => URL.createObjectURL(new Blob([pdf.slice().buffer], { type: 'application/pdf' })), [pdf])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <iframe title="Preview" src={url} />
}
```

The page's entry imports the two stylesheets, opens the stored report and
mounts the page. The routes it fetches are your server's: where the report
is stored, and the sample it previews against. In `main.tsx`:

```tsx guide=react file=main.tsx
import '@formancy/themes/workbench.css'
import '@formancy/report-builder-core/report-builder.css'
import { createRoot } from 'react-dom/client'
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { openEditor } from './editor.js'
import { ReportPage } from './report-page.js'
import type { Print } from './preview.js'
import { printPreview } from './print.js'

const stored: unknown = await (await fetch('/reports/quotation')).json()
const sample = (await (await fetch('/reports/quotation/sample')).json()) as ReportData

const opened = openEditor(stored)
const print: Print = (report, signal) => printPreview(report, sample, signal)
const save = (report: ReportDefinition): void => {
  void fetch('/reports/quotation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) })
}

const root = document.getElementById('report')
if (root === null) throw new Error('the page has no element with the id report')
createRoot(root).render(<ReportPage opened={opened} print={print} save={save} />)
```

TypeScript 6 checks that an import made for its effect resolves, and a
stylesheet is no module it resolves: without a declaration, the two imports
above are error TS2882. A bundler's client types declare `*.css` -- Vite's
`vite/client` does -- and a project without them declares
`declare module '*.css'` itself, as the install gate's React project does.

The page made the editor, so the page disposes of it, with
`editor.dispose()`, once no builder shows it; the builder only listens. A
report the page saves is untrusted when it comes back to your server:
section 6 reads one before anything prints it.

What it costs: every committed edit diagnoses the whole report again, and
the preview prints the whole report after every pause; neither is measured
yet. The builder's design view is a sketch for selecting and placing, not
the PDF, and says so by its name
([report-builder-core's README](../packages/report-builder-core/README.md#what-it-does-not-do)).

## 5. Embed the editor in Angular

The Angular builder is a standalone component, `<report-builder
[editor]="editor" />`, with signals and `OnPush`. It provides nothing of its
own and needs no zone.js: the page provides change detection without it,
which is all the builder needs. Its editor is opened by section 4's
`openEditor`: the session and the editor are the same packages' as the
React builder draws, and one session can carry both builders -- the Studio
switches between them over it
([0012](./decisions/0012-the-builders-are-native-and-share-one-session.md)).
The page, in `report-page.ts`:

```ts guide=angular
import { Component, input, output, provideZonelessChangeDetection } from '@angular/core'
import type { ApplicationConfig } from '@angular/core'
import { ReportBuilder } from '@formancy/report-builder-angular'
import type { ReportDefinition } from '@formancy/report-spec'
import type { OpenedEditor } from './editor.js'

export const appConfig: ApplicationConfig = { providers: [provideZonelessChangeDetection()] }

@Component({
  selector: 'app-report-page',
  imports: [ReportBuilder],
  template: `
    <report-builder [editor]="opened().editor" />
    <button type="button" (click)="save()">Save</button>
  `,
})
export class ReportPage {
  readonly opened = input.required<OpenedEditor>()
  readonly saved = output<ReportDefinition>()

  protected save(): void {
    this.saved.emit(this.opened().session.exportDocument())
  }
}
```

The application, in `main.ts`, loads the stored report and hands the page
its editor; a signal set from the response is what tells change detection
to run:

```ts guide=angular file=main.ts
import { Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { ReportDefinition } from '@formancy/report-spec'
import { openEditor } from './editor.js'
import type { OpenedEditor } from './editor.js'
import { appConfig, ReportPage } from './report-page.js'

@Component({
  selector: 'app-root',
  imports: [ReportPage],
  template: `
    @if (opened(); as editing) {
      <app-report-page [opened]="editing" (saved)="save($event)" />
    }
  `,
})
class App {
  protected readonly opened = signal<OpenedEditor | undefined>(undefined)

  constructor() {
    void fetch('/reports/quotation')
      .then((response) => response.json())
      .then((stored: unknown) => this.opened.set(openEditor(stored)))
  }

  protected save(report: ReportDefinition): void {
    void fetch('/reports/quotation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) })
  }
}

bootstrapApplication(App, appConfig).catch((error: unknown) => console.error(error))
```

The stylesheets go in the build's `styles`, the workbench's first. The
install gate builds no `angular.json`, so nothing checks these lines:

```json
"styles": [
  "node_modules/@formancy/themes/workbench.css",
  "node_modules/@formancy/report-builder-core/report-builder.css"
]
```

The preview of section 4 is not Angular's yet in this guide:
`keepPreviewing` has no framework in it, and an Angular page would start it
in an `effect` and stop it in the effect's cleanup, but no block here does,
so nothing has run it in Angular.

## 6. Validate and diagnose a stored report

A report that comes back from storage, or from the editor's Save, is
untrusted until it is read. `validateReport` takes anything and never
throws: it gives the report, read once and sharing nothing with its input,
or the reasons it is not one, up to a bound it says it reached. `diagnose`
then says what the editor's problems pane says, errors first: an **error**
is a report the runtime will refuse to print, and a **warning** something an
author probably did not mean, which prints as written. They are the same
checks, so the editor and the runtime cannot disagree about a report. At
the end of `quotation.ts`:

```ts guide=node
import { validateReport } from '@formancy/report-spec'
import { diagnose } from '@formancy/report-core'

/** Why a stored report would not print as written: the validator's reasons, or the diagnostics, errors first; none when it prints. */
function problemsOf(stored: string): string[] {
  const validation = validateReport(JSON.parse(stored))
  if (!validation.valid) return validation.errors.map((error) => `refused, ${error.code} at ${error.path}: ${error.message}`)
  return diagnose(validation.report).map((problem) => `${problem.severity}, ${problem.code} at ${problem.path}: ${problem.message}`)
}

const clock = { id: 'printed', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'string(now())' } }] }
const stored = {
  'as written': JSON.stringify(quotation),
  'of a later version': JSON.stringify({ ...quotation, reportSpecVersion: '1' }),
  'printing the clock': JSON.stringify({ ...quotation, regions: { ...quotation.regions, summary: [clock] } }),
}
for (const [name, text] of Object.entries(stored)) {
  const problems = problemsOf(text)
  console.log(`${name}: ${problems.length === 0 ? 'prints' : problems.join('; ')}`)
}
```

This prints:

```text guide=node
as written: prints
of a later version: refused, unsupported-version at /reportSpecVersion: reportSpecVersion "1" is not one this package reads; it reads "0"
printing the clock: error, expression-not-reproducible at /regions/summary/0/content/0/expression/cel: now() differs from one render to the next, and a report prints the same from the same data; a date the report needs is a parameter
```

**The version line.** Every report says which version of the format it is
written in, `reportSpecVersion`, independent of every package's version. It
is `'0'`, the draft: nothing written under it is promised to be read by a
later release. A report of a version the packages do not read is refused,
never partly read, because a field this version does not know could be the
one that hides a row or changes a total
([0004](./decisions/0004-three-version-lines-each-refused-when-unknown.md)).
The first release that freezes the format makes it `'1'`.

## Where to go next

- **The Studio**, in a checkout of this repository: `pnpm build`, then
  `pnpm --filter @formancy/report-studio dev`. It opens the starter
  reports, and a blank one, in either builder over one session, beside the
  PDF the session prints ([README](../README.md#the-studio)).
- **Your data from Formancy Data**: `@formancy/report-data-provider` reads
  a report's header and lines from a Formancy Data 0.1.0 server, as the
  person whose token your page holds, labelled best-effort. Running it in
  production needs a Data licence too
  ([its README](../packages/report-data-provider/README.md#read-a-reports-data)).
- **The package READMEs**, for everything this guide leaves out: the
  commands that edit a report as data, the expressions, groups and formats,
  the builders' keyboard and what each one renders.
- **The decision records**, [`docs/decisions/`](./decisions/README.md),
  for why each thing is the way it is and what holds it.
- **The known limitations**, in the release report every CI run produces
  and every release attaches: those the run shows, and those the decision
  records state ([`docs/release/`](./release/README.md),
  [`limitations.json`](./release/limitations.json)).
