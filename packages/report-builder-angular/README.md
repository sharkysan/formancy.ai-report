# @formancy/report-builder-angular

Formancy Report Studio's report editor for Angular, written natively: standalone
components, signals and `OnPush`, running without zone.js. It renders
[`@formancy/report-builder-core`](../report-builder-core/README.md)'s state and
sends that package's actions back. It decides nothing of its own about a
report: which key does what, what may go where, what is available, how a field
is labelled and what it is called in German are all report-builder-core's. The
React builder renders the same state, and neither builder depends on the other
([0012](../../docs/decisions/0012-the-builders-are-native-and-share-one-session.md)).
Nothing of React is in this package's dependency closure (plan 21). The package
suite walks the installed tree to show it, and
`scripts/finalize-angular-dist.test.mjs` reads the built code.

## Use

```ts
import { Component, OnDestroy } from '@angular/core'
import { ReportBuilder } from '@formancy/report-builder-angular'
import { createReportEditor } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'

const opening = openReportSession(definition)
if (!opening.ok) throw new Error('not a report')

@Component({
  selector: 'app-studio',
  imports: [ReportBuilder],
  template: `<report-builder [editor]="editor" />`,
})
export class Studio implements OnDestroy {
  // The host makes the editor and disposes of it. The builder only listens.
  readonly editor = createReportEditor(opening.session, { locale: 'de-CH' })

  ngOnDestroy(): void {
    this.editor.dispose()
  }
}
```

The host page dresses it. It imports `@formancy/themes`' `workbench.css`
first, then `@formancy/report-builder-core/report-builder.css`. This package
ships no stylesheet and no component styles. Its elements carry only the
`data-report-part` hooks, their `data-*` states and the workbench's classes
that the core's stylesheet selects by, so the Angular and React builders are
dressed by the same rules.

**The document and its undo history are the session's.** A builder subscribes
to its editor while it is mounted and unsubscribes when it is destroyed. A
builder destroyed and made again over the same editor shows the same document
and can undo what the first one did, and the editor's `listenerCount()` is back
where it started. Given another `[editor]`, the builder draws and acts on the
new one and lets the old one go. Plan 21's switch (edit, put the builder and
its editor away, undo in a builder in another language, switch back, redo)
runs in `src/builder.test.ts` over one session. Its React half is the React
builder's suite and report-builder-core's model test.

## What it renders

Exactly the structure report-builder-core's README sets out under *What a
builder renders*, which the React builder renders too: a region named
"Report editor" with a bar above the panes (the title and the toolbar, with
its four pane buttons), the outline pane with the place chooser floating
over it, the design view -- or the host's view in its place -- the
properties and the problems sharing the third column, and a bar below with
the live region. Every name comes from the core's catalogue in English,
Swiss German and Swiss French.

What is Angular's own:

- **The element is the editor's root.** `<report-builder>` carries the
  root's role, name, hooks and `data-panel` through a host directive,
  `ReportEditorRoot`.
- **Focus moves after a render.** An action that moves focus asks the root,
  and the root moves it in `afterEveryRender`, once what the action changed
  is in the document. Every action comes from one of the builder's own
  listeners, which marks the view for check, so a render follows even an
  action that changed nothing.
- **The host's view is a template.** A host whose editor was made with a
  view of its own gives it as `<ng-template reportHostView>`, and the builder
  stamps it into the design view's place while the editor's `view` is the
  host's
  ([0029](../../docs/decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)):

  ```html
  <report-builder [editor]="editor">
    <ng-template reportHostView><app-preview /></ng-template>
  </report-builder>
  ```

  A template, not projected content, because Angular makes projected
  content once whether its slot is drawn or not: the host's view lives only
  while it is drawn, and the toolbar's Design view destroys it. The builder
  stamps it with `@angular/core` alone, since `NgTemplateOutlet` is
  `@angular/common`'s, which is not this package's peer. A key pressed in
  it is the host's.
- **Drag and drop is HTML's**, from the palette, from a canvas box or from an
  outline row, onto the sheet (the nearest place, `targetNear`, read inside
  the sheet's border) or onto a row (before or after it, `targetBeside`). A
  drag the editor did not start -- a file from the desktop -- is not
  accepted. React drags with pointer events instead, over the same places.

## A layout of your own

`<report-builder>` is the root directive and the parts in the workbench's
panes. A host that wants another arrangement puts the root on its own element
and the parts inside it:

```html
<div [reportEditor]="editor">
  <div reportToolbar></div>
  <div reportPalette></div>
  <div reportOutline></div>
  <section reportCanvas></section>
  <form reportProperties></form>
  <div reportProblems></div>
  <p reportStatus></p>
  <div reportPlaces></div>
</div>
```

Each part is an attribute on the element it is, so the DOM has no wrapper
elements the React builder lacks. The bars, the panes' headers, the Report
button and the problems' count are `<report-builder>`'s template, not parts;
a host that arranges the parts itself writes its own, and draws its own
view where the state's `view` says, in place of `reportCanvas`. The parts inject
`ReportEditorRoot`, which holds the state as a signal and the editor's words.
It also routes key presses through `actionForKey`, dispatches, and moves
focus. `injectEditorState(editorSignal)` is the same signal for a host's own
views. It is set on each of the editor's notifications, not built with
`toSignal`, so no RxJS is needed. Its subscription is an effect's: it follows
the editor the input names, and is let go when the view is destroyed.

## Building

`pnpm --filter @formancy/report-builder-angular build` runs ng-packagr, which
compiles in partial mode into `dist/`, and then
[`scripts/finalize-angular-dist.mjs`](../../scripts/finalize-angular-dist.mjs).
An Angular library publishes from `dist/`, and ng-packagr's `dist/package.json`
is wrong there in four ways. The script fixes each of them:

- it rewrites `workspace:` ranges as pnpm publishes them;
- it sets `files` to what `dist/` holds, where the source's `["dist", …]`
  would pack no code;
- it drops the redirect into `dist/` from `publishConfig` and keeps `access`;
- it copies `LICENSE.md` and `NOTICE` into `dist/` as part of the build, so
  turbo's cache restores them.

It refuses a manifest whose `license` is not the source-available one.

ng-packagr type-checks the published sources against its own configuration,
with the library ES2018 and strict templates, and the build passes it no other.
So the sources stay within ES2018's library: no `flatMap`, no `Object.hasOwn`.
`pnpm typecheck` reads them with ES2023 and does not see this; the build does.

## Tests

`pnpm --filter @formancy/report-builder-angular test:coverage` runs them
under jsdom with zoneless change detection, as an application on Angular 22
runs.

- **Every `BUILDER_SCENARIOS` scenario**, in English, Swiss German and Swiss
  French. Each step finds elements by role and accessible name only, and each
  scenario ends with axe over the whole page at WCAG 2.2 AA, as formancy.ai's
  conformance suite audits. A scenario left out, or a kind of step never
  taken, fails the file.
- **The accessible tree:** every element a person operates or reads is
  named, with every row of every kind selected in turn; the editor is a
  landmark with everything inside it (axe's `region` rule); boxes and places
  are pictures named as the outline and the chooser name them; rows say
  where they stand among their siblings. Each group, the form, the list,
  the statuses and the place chooser are named in the editor's words, never
  after text on the page, which Chromium would read in the stylesheet's
  capitals; jsdom applies no stylesheet, so that test reads from the DOM
  how each name is given. The Studio compares this tree with the React
  builder's, in jsdom and in Chromium.
- **The builder's life:** destroyed and made again, given another editor, and
  plan 21's switch over one session.
- **Keyboard, panes, pointer and properties** behaviour beyond the
  scenarios, the keyboard kept on a problem when another is listed before
  it among them. Each property of every component kind is found by its role
  and name, and axe runs on each selection in turn.
- **The stylesheet's hooks:** the parts rendered are exactly `REPORT_PARTS`,
  the design view's and the host's view's together, since the two are never
  drawn at once; the `data-*` states are exactly those `REPORT_ATTRIBUTES`
  lists, and the classes are only the workbench's.
- **The host's view**: a bare region in the design view's place, with the
  middle pane's `data-pane`, its own part, no workbench class and only the
  host's view in it, stamped while the region is drawn and destroyed with
  it. That test reads the DOM, for the reason the hooks' tests do.
- **The dependency closure:** the manifest, the installed tree and every
  import the published entry reaches. No React anywhere, and nothing imported
  that is not declared.

Each test was seen to fail with the behaviour it guards taken out, except
three:

- The two that walk the installed tree for React could only fail if React
  were installed under this package, which this work did not do.
- The one that keeps a click's focus from arriving late passes whatever the
  builder does, because Angular renders after every listener. It guards
  against that changing.

The scenarios name user-event, but this package's devDependencies do not
include it yet. Until they do, `src/test-user.ts` fires the events user-event
fires for the steps the scenarios take, using Testing Library's `fireEvent`.
It does not type keystroke by keystroke, follow a pointer's path, or activate
on Space's key up.

What this package's tests do not show: layout, colour and contrast, which
jsdom does not compute; drag and drop with a real pointer, which is
dispatched as synthetic events; and focus as a real browser moves it on Tab.
The Studio's browser gate (`apps/studio/scripts/browser-test.mjs`) measures
those in Chromium for this builder in the Studio's page, a real pointer's
drag included, and the root README's pictures of it are taken by a script
and held to the text they show
([0013](../../docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md));
a host's own page is its own to measure.

## What it does not do

- **Nothing draws it in a browser yet.** The install gate compiles it into
  an Angular host ahead of time with strict templates, links it as the
  Angular CLI does, draws it on a server with `@angular/platform-server` and
  bundles it for a browser, at the newest and the oldest Angular 22 its peer
  range admits. What happens after the markup -- focus, keys, a pointer, a
  re-render after an edit -- is this package's suite, in jsdom.
- **Text that is not a number never reaches the editor from a number field.**
  A browser empties an `<input type="number">` holding "tall" before any
  change event fires, so the field says "This cannot be empty." rather than
  "Enter a number.".
- **Most touch browsers fire no HTML drag and drop.** There, as everywhere,
  the place chooser is the path to every place.
- **No measured cost.** Rendering a long report's outline and design view has
  not been timed.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
