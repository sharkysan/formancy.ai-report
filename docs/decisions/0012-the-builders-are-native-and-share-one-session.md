# 0012 — The builders are native, share one session through one editor model, and are held to each other by shared scenarios

- **Status:** accepted; the costs *No test mounts both builders* and *No
  browser in the suites* describe 2026-10-15. Since [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)
  the Studio's `studio.test.tsx` runs plan 21's switch across the two
  frameworks over one session in jsdom, its `journey.test.tsx` audits both
  builders at every state, its browser gate measures layout, contrast,
  target size and a real pointer's drag in Chromium, and its README
  pictures are checked. Since 2026-10-16 the two builders' accessible trees
  are compared with each other, in jsdom and in Chromium, the step this
  record named next; *Verified by* and *What holds nothing yet* say what
  holds them now.
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** each package's `test:coverage` job in CI, the `verify` job
  and the `install` job:
  - `report-builder-core`'s `scenarios.test.ts` runs every one of
    `BUILDER_SCENARIOS`, in English, Swiss German and Swiss French, against
    the model alone, and holds that the scenarios use every kind of step and
    cover what plan 21 lists. `editor-shared.test.ts` holds plan 21's switch
    at the model -- edit in one editor, dispose it, undo in a second, redo in
    a third -- with no subscription left on the session, and that a listener
    of one editor that throws leaves the other's edit finished.
    `css.test.ts` holds the stylesheet to the workbench's variables and to
    the hooks both builders render.
  - `report-builder-react`'s `scenarios.test.tsx` and
    `report-builder-angular`'s `scenarios.test.ts` each run every scenario in
    all three languages, finding elements by role and accessible name only,
    with axe over each end state, and fail when a scenario or a kind of step
    is skipped. Angular's `parts.test.ts` holds its rendered hooks to
    `REPORT_PARTS`, `REPORT_ATTRIBUTES` and the workbench's classes.
  - Each builder's `builder.test.ts` or `lifecycle.test.tsx` holds that a
    destroyed builder leaves no listener on its editor, that a new one over
    the same editor keeps the document and the history, and that a builder
    given another editor lets the first go.
  - `report-builder-angular`'s `dependencies.test.ts` and
    `scripts/finalize-angular-dist.test.mjs` hold that the Angular package
    names no React in its manifest, its installed tree or its built code.
  - `scripts/dependency-licences.test.mjs` holds that every published
    package's build inlines nothing from `node_modules`: tsdown's
    configuration for the core and React builders, the bundle's source map
    for the Angular one.
  - `scripts/finalize-angular-dist.test.mjs` holds what the Angular build
    makes of ng-packagr's `dist/package.json`.
  - `pnpm test:e2e:install` installs `report-builder-core`'s tarball into a
    plain npm project and drives an editor under Node. It installs each
    builder in a project of its own with only what its host has, at both
    ends of its peer range, and holds what each draws on a server to the
    structure the core's README sets out (`scripts/install-fixture/structure.ts`):
    React's server renderer in its development and production builds, and
    Angular's platform-server over a host compiled ahead of time and linked
    without the JIT compiler.

  - The two builders' accessible trees, compared with each other in the
    Studio. Its `parity.test.tsx` mounts both side by side over one editor
    and takes the editor through its states by its own actions -- every
    kind of component placed, one row of each kind selected, a move's
    chooser, a problem, a refusal, undo and redo, each pane -- over every
    starter, in all three languages, and at each requires the two trees,
    as dom-accessibility-api reads them, to be the same. Its browser gate
    (`apps/studio/scripts/gate-parity.mjs`) walks each builder, on a page of
    its own, through the same states by the same steps, for every starter,
    in the one-pane layout and the side-by-side one, and requires the same
    Playwright snapshot and the same Chromium tree -- every role, name,
    description, value and state, normalised only as `accessible-tree.mjs`
    says and `scripts/accessible-tree.test.mjs` holds -- and no name in
    either that changes with the page's `text-transform`. Measured on
    16 October 2026 on one Windows 11 workstation (Intel i9-10900K, Node
    24.21.0), once each: the gate took 253 s with the walk in its two
    layouts and 163 s before it, and the parity test 18.6 s in the
    Studio's suite run alone.

  On 15 October 2026 a review compared the two builders' accessible trees
  and behaviour and found them apart in places the scenarios did not
  reach. Each became a scenario, a shared rule in the core's README, or a
  test in the builder that lacked it; each fix was reverted on its own and
  its test seen to fail, and each file was byte-identical afterwards. On
  16 October 2026 the comparison found them apart where the review had not
  looked, and in Chromium alone: the React builder named its outline's
  groups, its form and its problems' list after text on the page, which
  Chromium reads in the stylesheet's capitals ("BODY" where Angular's said
  "Body"), and left each region's label in the tree as text; both named
  the problems' count and the place chooser the same way, "PROBLEMS" in
  both; and a problem listed before the one the keyboard was on moved the
  keyboard -- to the page in React, onto the new problem in Angular. Each
  became a rule in the core's README (a name is the editor's words; a
  problem's element is keyed by what it is, `DiagnosticEntry.key`) and a
  test in each builder, seen to fail before its fix; the comparisons were
  seen to fail on the builders as they were.

  What holds nothing yet: the pictures in the builders' own READMEs, taken
  by hand; a pointer's gesture, which each framework binds differently
  (*What it costs*) and no comparison reaches; and a state neither the
  Studio's parity test nor its gate takes the builders to, a pointer's drag
  under way among them.

## Context

Plan 11.4 and plan 21 ask for native Angular and React builders over one
report session: React reads the session with `useSyncExternalStore`, Angular
with signals and `OnPush`; the session owns the document, the revision and
the undo history; a builder can be destroyed and another, of either
framework, mounted over the same session without losing anything or leaving
a subscription behind. The critical integration test edits in Angular,
switches to React, undoes and switches back. Plan 21 also asks for parity
"through roles and accessible names in each native builder", and for an
Angular dependency closure without React.

0008 put the document and history in `report-core`'s session. What was left
was everything an editor holds that is not the report: what is selected,
which palette entries apply, what each property field is called and what
it may hold, where each box is drawn, which places a drag may land in, which
key does what, what the live region says, and in which language. Written
once per framework, each of these is a decision two builders could make
differently without anybody finding out.

formancy.ai's own builders (formancy.ai 0046, its builder-core,
builder-react and builder-angular) set the pattern: a framework-free core,
two native bindings, and parity asserted by user-visible behaviour.

## Decision

- **One editor model, `@formancy/report-builder-core`, with no framework,
  no DOM and no Node** (its TypeScript library is ES2023 only). It may
  import `@formancy/report-core` and `@formancy/report-spec`, nothing else.
  It holds one person's view of a session -- selection, zoom, open pane,
  drag, refused field values, announcements -- and derives everything a
  builder shows from the document: outline, palette, property fields,
  canvas geometry, drop targets (report-core's `validLocations`),
  diagnostics, availability. Its state is deeply frozen and keeps its
  identity until something changes; an action tells listeners once. Keys
  are decided once, by `actionForKey`. Every word is in one catalogue in
  three languages, and the session keeps each step's label as an English
  sentence that each editor puts back into its own language.
- **Two native builders, `@formancy/report-builder-react` and
  `@formancy/report-builder-angular`.** Each may import the core packages
  and its own framework, and never the other builder or the other
  framework. Each renders the state, dispatches actions and moves focus,
  which only the builder can know about. Neither decides what the model
  decides. The binding is written twice on purpose; the behaviour is
  written once.
- **One session, many editors.** The host creates an editor per builder,
  or shares one, and disposes it; a builder subscribes while it is mounted
  and never disposes what it did not create.
- **The scenarios are the parity contract.** `BUILDER_SCENARIOS` is data in
  the core: steps that find elements by role and accessible name, and
  checks on the session's document. Each builder runs all of them, in all
  three languages, with axe. The structure they find -- and the choices a
  scenario cannot see, like where the toolbar stands and what a pane
  button does -- is written once, in the core's README under *What a
  builder renders*. Where the two builders were found to differ, the
  difference became a scenario or a rule there.
- **The stylesheet is the core's, by data attributes, on the workbench's
  tokens.** `report-builder.css` selects only by `data-report-part`, the
  `data-*` states and the tree's ARIA, colours only through formancy's
  `--wb-*` variables with no fallback, and lays out the bars and the narrow
  layout. Both builders render the same hooks, so one stylesheet dresses
  both; neither builder ships a style of its own.
- **The Angular package is built by ng-packagr, in partial compilation
  mode, into `dist/`, and published from there.** `scripts/finalize-angular-dist.mjs`
  makes ng-packagr's `dist/package.json` the published manifest: workspace
  ranges rewritten, `files` what `dist/` holds, the redirect into `dist/`
  dropped, the licence files copied in by the build. The React and core
  packages are built by tsdown, like the others.

## Consequences

**What it buys.**
- **One answer to every question a builder asks.** Which places a drop may
  go, what a field is called, what Ctrl+D does, what colour a problem count
  is: decided in the model, so the two builders cannot answer differently.
- **Parity a test can see.** A builder that renders a name the other does
  not, or misses a step, fails the shared scenarios. The core runs them
  against the model too, so a name a scenario asks for that the state never
  gives fails there, before either framework is involved.
- **Plan 21's switch at the model, for free.** The session holds the
  document and history; an editor holds nothing that must outlive it. Any
  number of editors over one session, in any order, see one document.
- **A host can use either framework alone.** The Angular closure has no
  React, and the React package does not know Angular exists.

**What it costs.**
- **Two bindings to keep.** Every visible change is made twice, once per
  framework, and reviewed twice. The scenarios hold what they reach; what
  they do not reach -- the exact tab order, a pointer gesture each
  framework binds differently -- is held by each builder's own tests and by
  the core's README, which nothing executes. The review that found the
  builders apart found each difference by reading both.
- **The contract is prose where the scenarios stop.** A choice written only
  in the core's README drifts the way prose does. Since the two builders'
  trees are compared, one builder drifting from the other is found; both
  drifting together from the README is not.
- **No test mounts both builders.** Plan 21's critical test runs at the
  model and within each framework, not across them, until the Angular
  package can be imported inside the workspace.
- **Pointer drag is written twice and differently.** React binds pointer
  events, Angular HTML drag and drop. Both resolve the pointer through the
  model's `targetNear` and `targetBeside`, but a touch device gets no drag
  in Angular, and their thresholds differ.
- **ng-packagr constrains the Angular sources.** It type-checks them against
  ES2018's library with its own configuration, so a newer array method
  passes `pnpm typecheck` and fails the build. Its `dist/` layout is why
  the manifest needs finalizing at all, and why the source manifest must
  send pnpm to `dist/`.
- **The session's labels are English.** A host reading the session sees
  English sentences, whatever language its editors speak; a copy of
  report-builder-core loaded twice shows the other copy's steps in English.
- **No browser in the suites.** jsdom decides nothing about layout,
  contrast or real pointers. The README pictures are taken by hand and
  held by nothing yet.

**What it forecloses.** A builder written for a third framework is a third
binding, and runs the same scenarios. A builder that wants a behaviour the
other lacks adds it to the model or the contract first.

## Alternatives considered

**One builder as web components**, used from both frameworks. One binding,
so no drift. Rejected: plan 11.4 asks for native builders, and formancy's
own are native; a custom element sits outside Angular's change detection
and React's rendering, so neither framework's tooling, testing library or
accessibility conventions apply inside it.

**The model inside each builder**, as formancy's form builders once had it.
No third package. Rejected: every rule would be written twice, and plan 21's
"if these two ever disagree, would anybody find out?" answers itself.

**Parity by snapshot**, comparing each builder's rendered DOM. Rejected:
two frameworks render different but equivalent markup, and a snapshot fails
on the markup while passing a missing accessible name. Roles and names are
what a person meets.

**A parity check over a serialised accessible tree of both builders.**
Stronger than the scenarios: it would have found the differences the review
found by hand. Not done on 15 October 2026, because it needed both builders
mounted in one test, which waited for the Angular manifest; it was the next
step, not a rejected one, and since 16 October 2026 the Studio, which
mounts both, takes it (*Verified by*). It is beside the scenarios, not in
place of them: a tree compared says the two builders agree, and only a
scenario says what either does.

**Each builder's own stylesheet.** Rejected: two stylesheets drift, and a
Studio would recolour two sets of rules.

**Angular built by tsdown, like the others.** Rejected: Angular's partial
compilation for libraries is ng-packagr's, and a library compiled any other
way is not one an Angular application links.
