# 0015 — The getting-started guide's code is compiled and run by the install gate, against the packed packages

- **Status:** accepted
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:** `pnpm test:e2e:install`, the `install` job of
  `.github/workflows/gates.yml`, which `ci.yml` runs on every pull request
  and `release.yml` before it publishes:
  - `docs/getting-started.md` is read by `scripts/getting-started.mjs`
    before anything is packed, and a block the gate would not run fails the
    run there (watched failing with the tag of the guide's first Node block
    removed: "docs/getting-started.md line 99: a ts block with no guide= tag,
    which the install gate would never compile or run", in under a second);
  - the Node blocks are one program in the Node host, type-checked with the
    rest of its code and run by `scripts/install-fixture/guide-node.ts`,
    which fails unless the program writes `quotation.pdf` as a PDF and
    prints exactly the lines the guide's output blocks show (watched failing
    against output blocks written before the program had run: each line of
    the packages' own messages differed, and the guide now shows theirs);
  - the React blocks are a page in a host of their own, `react-app`, at the
    newest and the oldest React the React builder's peer range admits: its
    component drawn by React's server renderer and its preview run by
    `guide-react.tsx`, every module bundled for a browser;
  - the Angular blocks are a page in the Angular builder's own hosts, at
    both ends of its range: compiled ahead of time with strict templates,
    drawn on `@angular/platform-server` by `guide-angular.ts`, every module
    bundled for a browser with the builder linked.

  Watched failing with three blocks broken at once, each failing in every
  host that builds it: `renderPdf(…, { pages: 50 })` for `maxPages` (node:
  "error TS2353: Object literal may only specify known properties, and
  'pages' does not exist in type 'RenderOptions'"); `keepPreviewing` showing
  a print whether or not the next edit overtook it (react-app and
  react-app-floor: "the previews shown came from prints 0, 1, 2, 3, where
  only print 3, of the latest document, should follow 1"); and
  `[editor]="opened()"` in the Angular template (angular and angular-floor,
  ngc: "error TS2739: Type 'OpenedEditor' is missing the following
  properties from type 'ReportEditor'"). The second break first passed: the
  runner's overtaken print got its aborted signal, and `renderPdf` refuses
  an aborted signal before its first pass, so the guide's own check was
  never reached. The runner now holds that print past its abort and lets it
  finish, as a pass already under way or a server that already answered
  does, and records which print each PDF shown came from.

  `scripts/getting-started.test.mjs`, in `pnpm test:repo`, for what the
  gate cannot see, each case watched failing against the guide: every
  block of code carries a tag (the tag removed, naming line 99); every host
  a block names is one the gate plans; every package a host's blocks import
  is named by one of its install lines (watched failing with
  `@formancy/report-spec` imported in the React page and named in no React
  install line -- which the gate passes, since npm installs it there as the
  builder's dependency); every package an install line names is one the
  gate installs into that host, at the version the line pins (watched
  failing with `@formancy/themes@0.4.0`); and every host's guide modules are
  covered by its type-check, imported by its runner, run by a step and, for
  a page, bundled (watched failing with `guide` taken out of the Angular
  host's `include`). The reading's refusals are held on fixtures.
  `scripts/install-hosts.test.mjs` holds `react-app`'s packages and
  framework, and that the builder's own `react` host gains neither the
  renderer nor the stylesheet.

## Context

Formancy Data runs its guide in CI as written
([formancy.ai-data 0032](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0032-a-clean-install-is-the-composed-stack-and-ci-runs-its-guide.md)):
its guide is commands, and its gate runs them. This repository's guide is
for an application developer, so it is mostly TypeScript: a report and its
data, the calls that print it in Node and in a browser, and the editor in a
React and an Angular page. Code in prose drifts silently -- an option
renamed, an export moved, a template binding the wrong type -- and the
README's one example was held line by line to a copy of it in
`consume.ts` (`scripts/readme-example.test.mjs`), a second place for the
same lines.

The install gate is the one place that compiles against the packed
packages, with `skipLibCheck` off, in projects that hold only what their
host would (0012). What the design rests on, read in the gate and its
hosts:

- The builders' own hosts hold only what each builder declares, so that an
  import the builder never declared fails there. The guide's React page
  previews in the browser and imports the renderer; put in the React
  builder's host, it would make the renderer resolvable there, and a
  builder importing it undeclared would pass. The guide's Angular page
  imports nothing the Angular builder does not declare, and needs only the
  workbench's stylesheet beside it, a package with no code.
- npm installs a package's dependencies at the top of `node_modules`, so a
  block that imports a package the guide never told a reader to install
  compiles in the gate.
- TypeScript 6 checks that a side-effect import resolves, and a stylesheet
  is no module it resolves; a bundler's client types declare `*.css`.
- `renderPdf` reads its signal before its first pass, between passes and
  before it returns.
- Before this record, nothing installed the renderer's browser entry from
  its tarball, type-checked it with the DOM's types or bundled it for a
  browser; the Studio's browser gate runs it from the workspace.

## Decision

Every block of code in `docs/getting-started.md` names the host that builds
it in its info string (`ts guide=node`, `ts guide=react,angular
file=editor.ts`), and the install gate builds it there. One reading,
`scripts/getting-started.mjs`, serves the gate and the guard:

- **A block is code a host compiles, or it is refused.** A TypeScript or
  JavaScript block with no tag, a fence with no language, a JavaScript
  block, a host the gate does not build, a second module for a host that
  runs one, and a tag on any other kind of block are refused with their
  line. Blocks of one host and one file are one module, in the guide's
  order; a block may name several hosts.
- **The Node program runs in the Node host**, which already holds every
  package but the builders against Node's types, and its output is the
  guide's: a `text` block tagged for the host is compared exactly with what
  the program printed, so the refusals the guide shows are the packages'
  own words.
- **The React page has a host of its own, `react-app`**: the React builder
  and the renderer, each with what it declares, and `@formancy/themes` at
  the release the Studio declares, beside React at both ends of the
  builder's peer range, with the module resolution a bundler has and the
  DOM's types alone. Its runner draws the page with React's server
  renderer and runs `keepPreviewing` against the guide's `printPreview` in
  Node through the browser entry; its entry, which imports the stylesheets
  and mounts the page, is bundled and never run.
- **The Angular page is built by the Angular builder's own hosts**, which
  gain the workbench's stylesheet and the guide's modules and steps: the
  same compilation, a server build and run of the page with the guide's
  `appConfig`, and a browser build of each module.
- **What the gate cannot see, the guard holds**: no block escapes the
  reading; a host's imports are what its install lines name; its install
  lines name what the gate installs, at the versions they pin; and every
  module a host is given is type-checked, run and, for a page, bundled.
- **What nothing runs is said in the guide**: the pages in a browser, the
  `angular.json` lines, and the server routes the pages call.

The gate records in `test-results/install.json`, per host, the modules it
wrote and the line each block opens on, and prints them; nothing judges
that record. "Every tagged block ran" is held instead by the reading being
total and by the guard, statically, so `pnpm test:repo` holds it without
running the gate.

## Consequences

**What it buys.** The guide's code is the packed packages' as a reader
installs them: an option renamed, an export moved, a template that binds
the wrong type, or a preview that shows a stale PDF fails a job, in the host
the code is for. Section 1's install lines are held to the code and to the
gate. The renderer's browser entry is installed from its tarball,
type-checked against the DOM's types and bundled for a browser for the
first time.

**What it costs.**

- **Two more npm projects, and the guide's steps in the Node host and both
  Angular hosts.** On one machine on
  2026-10-16 (Windows 11, Node 24.21.0, npm 11.19.0, npm's cache warm), the
  whole gate took 51.2 s before this record and 65.4 s after it, by `time`
  over `pnpm test:e2e:install`, one run each.
- **A message changed in a package changes the guide.** The output blocks
  quote the runtime's, the validator's, the diagnostics' and the renderer's
  messages; a change to one fails the gate until the guide shows the new
  one, which is the point and still an edit.
- **The guide's prose about behaviour is held where the behaviour is.**
  That a final render refuses incomplete data is the runtime's suite's to
  show; the gate shows that the guide's code does what it says when run. A
  sentence with no code under it is held by review.
- **A typed version.** The React and Angular install lines pin
  `@formancy/themes`; the guard holds the pin to what the gate installs,
  which is the Studio's declared release.
- **The pages are drawn over another report.** `install-fixture/structure.ts`
  reads a flat outline with a problem in it, so the runners draw the guide's
  pages over its report, opened through the guide's own `openEditor`, and
  run the preview over the quotation starter.
- **Not a browser.** Nothing mounts either page in a DOM: the effect that
  starts the React page's preview, the PDF in its iframe, a press of Save
  and the Angular entry's bootstrap are compiled and bundled and never run.
  The Angular page in the guide has no preview, so `keepPreviewing` has run
  beside React and under Node only.

**What it forecloses.** JavaScript examples in the guide, until the gate
runs JavaScript; and an example whose output varies from run to run, which
an exact comparison cannot hold.

## Alternatives considered

- **Examples held line by line to a consumer**, as the README's is to
  `consume.ts`. Two copies of each line, and a guide the size of this one
  would make the consumer the guide.
- **The React page in the React builder's own hosts.** Rejected for the
  reason in Context: the renderer would resolve there, and a builder's
  undeclared import of it would pass.
- **A host of the guide's own for Angular too.** One more Angular install,
  the slowest of the gate's, for a page that needs nothing the builder's
  host lacks but a stylesheet with no code.
- **The guide's blocks recorded in install.json and judged by the release
  report against the checkout.** The gate reads the guide of the checkout it
  runs in, so the comparison could fail only if the reading were wrong,
  which the guard shows without a run.
- **A job of its own for the guide.** Another clean install path to keep
  true, where the install gate already packs, installs and type-checks with
  `skipLibCheck` off.
- **Output held by its codes alone.** An exact comparison is simpler, and
  catches a message the guide quotes changing under it.

## Older records

Applied and unchanged: 0012's hosts, each holding only what its host would
-- the guide's React page is a host of its own for that reason -- and 0014's
report, which holds the new hosts as it holds the others: planned by
`install-hosts.mjs`, each step done, each builder's framework at its range's
floor at the floor.
