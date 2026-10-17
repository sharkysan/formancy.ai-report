# Working in this repository

## What this is, and what it is not

Formancy Report is a **paid, source-available** module that designs and
renders paginated PDF reports. It builds on the Apache-2.0
[formancy](https://github.com/sharkysan/formancy.ai) packages and, optionally,
on [Formancy Data](https://github.com/sharkysan/formancy.ai-data). It lives
in its own repository, on Formancy Data's licence terms, so that formancy's
licence and its promise -- a self-hoster never hits a paywall -- stay true
without qualification
([0001](docs/decisions/0001-a-paid-module-in-its-own-repository.md)).

Three things follow, and each has a guard:

- **Depend on upstream, never copy it.** `@formancy/*` packages are
  dependencies at **exact** released versions; `scripts/upstream-deps.mjs`
  refuses a range, a `workspace:` link or a path
  ([0002](docs/decisions/0002-depend-on-upstream-never-copy-it.md)). That
  includes Formancy Data's packages: `report-data-provider` depends on
  `@formancy/data-client` at exactly 0.1.0, and nothing else depends on
  Data ([0016](docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
  A generic improvement goes upstream through that
  repository's own contribution rules, not into a patched copy here.
- **Every package declares the source-available licence**, never Apache-2.0.
  `scripts/verify-licenses.mjs` refuses a manifest that says otherwise and a
  tarball without `LICENSE.md` and `NOTICE`. The realistic mistake is a
  manifest copied from upstream.
- **Never call it open source.** Not in a README, a package description, a
  commit message or a landing page. "Source-available" is the phrase, and the
  licence table in `README.md` is the explanation.

A dependency must allow both public source and licensed production use:
permissive licences only, no GPL or AGPL, no source-available or
non-commercial licence. The one exception is Formancy Data's packages, on
this repository's terms from the same rightsholder: they are admitted for
`report-data-provider` alone, at an exact version, with the licence file a
review read (`FORMANCY_DATA`, 0006 as 0016 extends it). A commercial
component needs written redistribution rights. Fonts must be licensed for embedding in generated PDFs.
`scripts/dependency-licences.mjs` holds this for the production dependencies
of every publishable package and every font they ship, reading a font's
licence from the font, and refuses what it cannot read
([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
What it cannot see -- whether a licence's terms are what its identifier says,
code a package vendors, a font inside a script -- is held by review, and 0006
lists it.

## How the pieces fit

Data in, a PDF out, the builders and the Studio around them are built.
`@formancy/report-spec` defines the format, validates a report structurally
and hashes it
([0007](docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
`@formancy/report-core` changes a report through commands, holds it in a
session with undo, says where a component may go, and compiles every
expression for the diagnostics and the runtime
([0008](docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md),
[0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
`@formancy/report-runtime` resolves a report against its data into the
renderer-neutral document, exactly, or refuses it
([0010](docs/decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)),
and `@formancy/report-render-pdf` draws that document with pdfmake and
refuses what it cannot draw whole
([0005](docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](docs/decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
A report's Swiss QR-bill runs through all four: SIX's rules are
report-spec's `qr-bill.ts`, which the validator applies to literals and the
runtime to data; the core compiles its amount; and the renderer draws the
slip in the Liberation Sans it ships in its `fonts` directory
([0022](docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
An EPC QR code, a component, runs through all four the same way: the EPC's
rules are report-spec's `epc-payload.ts`, its countries `sepa.ts` and its
print `epc-print.ts`, and the IBAN's check digits and the creditor
reference are `payment-reference.ts`, which the QR-bill's rules read too;
the runtime writes the payload, and the renderer draws Austria's caption
in the same Liberation Sans
([0025](docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
`@formancy/report-data-provider` reads that data from Formancy Data 0.1.0
through `@formancy/data-client`, as the person whose token the host
supplies, labelled best-effort
([0016](docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
`@formancy/report-builder-core` is the editor model over that session, and
`@formancy/report-builder-react` and `@formancy/report-builder-angular` render
it natively; `BUILDER_SCENARIOS` in the core is what both must do
([0012](docs/decisions/0012-the-builders-are-native-and-share-one-session.md)).
Beside them, `@formancy/report-corpus` is test support and is never published:
the adversarial report fixtures, the starter reports, the reader and
checks that prove a rendered PDF against them, a rasteriser for page images,
`readCodes`, which decodes the QR codes a page prints with ZXing from the
pixels PDF.js draws, and the renderer trial that chose pdfmake. `apps/studio` is the
playground that puts both builders and a PDF.js preview on one page
([0013](docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)),
never published as a package and served at formancy.ai/report/
([0018](docs/decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md));
the PDF.js viewer lives there and in no published package. `apps/pages` is
the product's pages, prerendered to static HTML in German, French, Italian
and English, never published as a package and served beside the Studio at
formancy.ai/report/<lang>/
([0021](docs/decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)):
the facts they state about the release and the licence are read from
`CHANGELOG.md` and `LICENSE.md` when they are built, and `src/groups.ts`
is the list of pages. That is all the product code there is. The package path the plan proposes, each package depending only on those
before it:

1. `report-spec` -- the versioned definition, structural validation, canonical
   hashing and migrations. No framework, no driver, no PDF engine, no Node.
2. `report-core` -- pure document commands, atomic history, diagnostics.
3. `report-builder-core` -- selection, palette, properties, geometry, review
   state; then `report-builder-react` and `report-builder-angular`, native,
   never depending on each other.
4. `report-runtime` -- typed datasets, expressions, grouping, exact aggregates,
   a renderer-neutral output.
5. `report-render-pdf` -- the one chosen engine's adapter. It takes resolved
   input and approved asset bytes, never a database connection or a URL.
6. `report-server-core` / `report-server`, `report-client`, `report-viewer`,
   `report-ai`.
7. `report-data-provider` -- the only package allowed to depend on Formancy
   Data's contracts, at the exact release it was built against (0016);
   `scripts/dependency-licences.mjs` refuses Data reached from any other.

A package arrives with the decision record that says what it may import. When
this map goes stale, the rename is the edit to make here.

## Every change keeps the documentation true

A change is not done until the documents that describe it say so. Update them
in the same pull request as the code, not in a follow-up:

- **`README.md`** when behaviour, a package or a command changes — including
  the *Status* paragraph, which describes one point in time and no other.
- **`CHANGELOG.md`** — a line under *Unreleased* for anything a user or
  integrator would notice, with the reason attached, not only the what. A bump
  of an upstream `@formancy/*` version is always noticed.
- **Decision records** (`docs/decisions/`) — a new record for every decision
  someone could helpfully undo, in the format `docs/decisions/README.md`
  describes: next free number, the cost paragraph, the alternatives, and a
  **Verified by** line naming the test or gate that fails if it is violated.
  Add it to the index. A decision that changes an old one marks the old record
  `superseded by NNNN` or `reversed` rather than editing it away. A decision
  that depends on another repository's record cites it as `formancy.ai 0003`
  or `formancy.ai-data 0035`.
- **Architecture** (`docs/architecture/`, arc42, entered from
  [`docs/README.md`](docs/README.md)) — the section the change touches:
  building blocks for a new package, app or module and what it may import,
  the runtime view for a new flow, the deployment view for what is published
  or served and what a host needs, cross-cutting concepts, quality
  requirements, verification for a new gate, and risks and debt for anything
  accepted rather than fixed. A new decision record is linked from the
  section it bears on, not only listed in the index
  ([0026](docs/decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)).

Keep the voice of the existing documents: say what it costs and what it does
not do, and never claim more than a test shows.

## A claim in prose is backed by something that fails

Documentation drifts silently, because prose does not break. So where a document
states a fact about the repository, something fails when it stops being true,
and the document says what. Three shapes, in order of preference:

1. **Derive it.** `codecov.yml` is generated from the workspace by
   `scripts/codecov-config.mjs`; the README's licence sentence is generated
   from `LICENSE.md` by `scripts/licence-status.mjs`.
2. **Check it.** `scripts/codecov-config.test.mjs` fails when the committed
   file is not what the generator produces; `scripts/check-cla.test.mjs` fails
   when `CLA.md` changes under a signature; `scripts/upstream-deps.test.mjs`
   fails on an inexact upstream version; `scripts/architecture.test.mjs`
   fails on a missing arc42 section, a package or app without its row in the
   building blocks or a row whose dependencies are not its manifest's, a
   decision record no section links, and a link or a path written as code in
   the architecture that lands nowhere. All of them run as `pnpm test:repo`,
   and CI runs that — **a guard that is not a gate is a comment.**
3. **Measure it.** Below.

Counts written into prose go stale. **Prefer wording without a number.** Where a
number is the point, derive it; where that is impossible, date it.

**When you write a guard, make it fail first.** Revert the thing it guards,
watch it fail, put it back. A test that has never failed has not been shown to
test anything. And derive the fact from the code or the data, never from
wording: a check that matches a phrase passes for the wrong reason the moment
the phrase appears somewhere else.

## Measure before you write a number

Numbers here are measured, not estimated. The plan this repository started
from estimates its effort in person-weeks and its render times as targets to
test; those are a plan's numbers and they belong in the plan. A number in this
repository — a timeout, a page limit, a render time, a row cap — comes with how
it was measured, on what, and when.

## A rendered report is proved on the PDF it produced

Decision [0003](docs/decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
held as Formancy Data holds its rule about real databases. The corpus's
checks (`packages/report-corpus/src/checks.ts`) are the tools for it.

- A claim about a report's output is checked on the PDF the engine produced,
  read back with PDF.js: its text, and where each run and image is. Not on
  the engine's input document, and not through a mocked engine.
- Extracted text alone cannot see text drawn over text, so the checks read
  each run's box as well. Boxes are computed from baselines, not traced from
  glyphs: accents that touch, rules, borders, clipping and colour are not
  seen. Page images are the later addition for those (0003), and pixels
  alone could never prove a total. A layout claim says which it rests on.
- A QR code is neither text nor an image to PDF.js, so it is proved from the
  page's pixels: `rasterPixels` draws the page with PDF.js and `readCodes`
  (`packages/report-corpus/src/codes.ts`) decodes every code on it with ZXing,
  for its text, bytes, level, version and place
  ([0020](docs/decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
  extending 0003). That is decoding, not a comparison of page images.
- Never silently drop, clip or truncate content. A report that cannot fit says
  so in a diagnostic; a production render with incomplete data refuses.
- Exact values -- decimals, large integers -- travel as strings with their type
  and are never converted through JavaScript `Number`, as in Formancy Data
  (formancy.ai-data 0008).

## Secrets, identifiers and untrusted input

- **Nothing in a package reads configuration.** The composition root reads it,
  once. A connection string, a token or a row of customer data in a log line,
  an error message or a test fixture is a defect.
- **Templates, expressions, datasets, fonts and images are untrusted**, even
  when an administrator wrote them. Expressions are typed, bounded and run no
  code. Assets are referenced by approved identifier and never fetched by
  address. Nothing in a package reaches the network.
- **Identity comes from the host, verified.** A tenant, a role or a permission
  supplied by the browser is never a decision's input.
- **Fail closed.** An unknown report version, component kind or provider
  contract is refused, never partly rendered. Upstream's
  [0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)
  is the rule and this repository inherits it.

## The user interface is formancy.ai's concept, applied

The builders and the Studio around them are formancy.ai's concept applied,
as Formancy Data's apps are, not a new one
([0012](docs/decisions/0012-the-builders-are-native-and-share-one-session.md),
[0013](docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).

- **The same room.** A dark bench, glass panels, violet for what the person
  acts on and teal for what the system did, with the builder's panes from
  `workbench.css` recoloured only through its `--wb-*` variables and not one
  rule overridden for colour. The Studio wears `admin.css`'s variables,
  copied into `apps/studio/src/styles/room.css` under the marking comment,
  not a palette of its own; its `styles/builder.css` gives the panes the
  admin's geometry without a colour. `report-builder.css` is the only
  stylesheet the builders have. The product's pages import the Studio's
  room, controls, bar and narrow rules rather than copy them, and their
  own rules state no colour (0021).
- **The page is the document, not the room.** What prints is the report's
  own serialisable styles. The editor's CSS, and the host's, never reach a
  customer's printed output. The design view says it is not the PDF, by its
  name; the Studio's Preview is the PDF itself, drawn by PDF.js on white
  paper, and no rule of the room's reaches it.
- **Keyboard first, accessible name only.** Every drag has a keyboard path
  (formancy.ai 0046): the place chooser, and `actionForKey` in the core.
  Tests find elements by role and accessible name and nothing else; where
  the accessibility tree cannot answer -- which framework drew the builder,
  a stylesheet's reach, a canvas's pixels -- a test reads the DOM, and its
  header says which and why.
- **Angular and React are both native**, over one report session, and neither
  depends on the other. `BUILDER_SCENARIOS` is the parity contract, and the
  core's README the structure it finds; both builders run every scenario.
- **One shell for every page of the site** (formancy.ai 0106). The Studio's
  bar is that shell for the playground.
- **A number on a page is derived**, never typed: the zoom through `Intl`,
  every count from the state.

What holds this section:

- **The builders' stylesheet**, `report-builder-core`'s `css.test.ts`: no
  colour literal, no variable the workbench lacks, and no selector but the
  hooks and states both builders render and the workbench's own classes.
- **The scenarios**, run by each builder with axe over the end of every
  one, in three languages, and by the core against the model alone.
- **Plan 21's switch across the frameworks**, `apps/studio/src/studio.test.tsx`:
  edit in Angular, switch, undo in React, switch back, with no listener or
  subscription left behind; and the Studio's `journey.test.tsx`, axe and a
  name on every control at every state of both builders.
- **The Studio's stylesheets**, `apps/studio/src/styles.test.tsx`: no colour
  on a rule that names the builder, no Studio rule but `builder.css`'s
  inside the builder, and nothing on the paper but its own rules.
- **The palette guard**, `scripts/palette.test.mjs` in `pnpm test:repo`:
  every stylesheet that copies `admin.css`'s variables says what admin.css
  says at the commit the test pins, and the same as every other copy.
- **The browser gate**, `apps/studio/scripts/browser-test.mjs`, run as
  `pnpm --filter @formancy/report-studio test:browser` in CI's `browser`
  job, for what jsdom cannot see, with the Studio served under `/report/`
  as formancy.ai serves it: in Chromium, no sideways scroll and
  nothing past either edge down to 320 pixels, the first Tab on the skip
  link and the next into the content, axe's colour-contrast and
  target-size rules at every starter in both builders, each PDF drawn on
  white with the text it prints, the framework switch, a real pointer's
  drag, the place chooser, a pane and the Preview hidden and shown again,
  the design view holding a page at 100 % wherever the Preview stands
  beside it, no rule of the page's on the paper, and no request or
  connection hint to any origin but the built Studio's, its faces included
  ([0023](docs/decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).
- **The pages' stylesheet**, `apps/pages/src/stylesheet.test.ts`: it
  imports the Studio's `room.css` first and only the Studio's stylesheets,
  and declares no colour and no variable of its own. The pages' checks,
  `apps/pages/src/checks/`, hold each page's head, links, words and
  sitemap (0021).
- **The README's pictures**, `scripts/pictures/readme.test.mjs` in
  `pnpm test:repo` and the Studio's `pictures.mjs --check` as
  `test:pictures` in the same CI job: every picture is whole parts of a
  state the page reaches, and a caption quotes only text those parts hold
  (formancy.ai-data 0038).
- **The two builders' accessible trees, compared with each other**:
  `apps/studio/src/parity.test.tsx` in jsdom, over every starter in three
  languages, and the browser gate's `gate-parity.mjs` in Chromium. Release
  gate G3 rests on them (`docs/release/gates.json`).

What nothing holds yet, said: the palette and `builder.css` are copied from
`admin.css` by hand, and nothing fails when upstream's move; the gate runs
Chromium alone, where Formancy Data's runs Firefox and WebKit too; no gate
measures the product's pages in a browser, whose reflow and contrast were
measured by hand (0021); and what
a README picture looks like, and whether a caption's quote is painted in it
rather than scrolled out of its part, which review alone holds.

## Branch names

Name a branch after what it changes, with a prefix for the kind of change:
`feat/report-spec-model`, `fix/table-header-repeat`, `docs/licence-faq`.
Not a generated name: the branch is what a reviewer sees first.

## Branch from `main`, and target `main`

No stacked pull requests. Branch from `main`, target `main`, and where a branch
replaces another say "supersedes #N" in the description rather than stacking.

**A merged branch is deleted by the merge.** GitHub deletes the head branch
when the pull request merges, a repository setting that nothing here can
check (formancy.ai-data 0036; `.github/REPO-METADATA.md`). Never delete a
remote branch by hand. Remove the local branch and its worktree once
`gh pr view N --json state` says `MERGED`, and not before.

**Commit as `Daniel Bacher <dbacher@gmail.com>`**, never
`daniel.bacher@ergon.ch`. The CLA record names that address, and the check
reads commit authors. This repository's local git config sets it; the global
one does not.

**No tool attribution.** No "Generated with Claude Code" line or session link
in pull request descriptions, and no `Co-Authored-By: Claude` or
`Claude-Session` trailers in commits. The author is the person above.

## Tests, and what the bar actually is

**Coverage is reported, not gated.** There is no threshold in
`vitest.coverage.ts` and none is wanted. The bar is this:

- **New behaviour arrives with a test that fails without it.** Test-first, and
  the failure observed.
- **Every case says which failure it prevents**, in a comment, in the same
  voice as the code. "tests the happy path" is not that; "a formancy form read
  as a report would render as an empty one" is.
- **A code path no test reaches is a claim nobody checked.** If it is hard to
  reach, that is usually the design saying something.
- **A suite cannot pass empty.** No `passWithNoTests`: a package with a
  `test:coverage` script has tests.
- Run `pnpm test:coverage` for what you changed and read the report. A file
  whose number dropped is the question, not the failure.

### When the test is wrong and the code is right

It happens. When a test disagrees with the code, work out which is wrong before
changing either. Match the whole property, not the shape it usually has.

## The code reads as though a senior wrote both halves

The standard is not "it works". It is that a senior engineer who knows
pagination, PDF and both frameworks recognises the shape immediately and finds
nothing to explain away.

**One decision, one place.** Grouping, aggregates and rounding are decided once
in the runtime, never again in a builder or the server. The question is never
"is this repeated" but **"if these two ever disagree, would anybody find
out?"**

**No interface with one implementation**, no layer that only forwards, no
abstract base class for two concrete cases. Version 1 has one PDF engine; its
adapter is a package boundary, not a plugin system.

**Duplication is cheaper than the wrong abstraction.** The Angular and React
bindings are written twice on purpose; the behaviour they bind is written once.

### Size is a signal

**600 lines** for a source file, tests excluded; `scripts/source-size.test.mjs`
fails past it. Split by **the reason to change**, never by line count. The
same applies below the file, held by review: a function past about 60 lines, a
`switch` growing a case per component kind, a class whose name needs "and" to
describe it.

## Running one thing

Packages import each other through `dist/`: every `exports` map points there
and nothing aliases a workspace package to its source. A change in one package
is invisible to another's tests until it is built again, so either run
`pnpm build` or let turbo build the dependencies first:

```bash
pnpm exec turbo run test --filter=@formancy/report-spec                    # dependencies built, then that suite
pnpm --filter @formancy/report-spec test                                   # that suite, against dist/ as it stands
pnpm --filter @formancy/report-spec exec vitest run src/version.test.ts    # one file
pnpm --filter @formancy/report-spec exec vitest run -t "a test's name"     # one case
```

## Checks before pushing

The gates are `.github/workflows/gates.yml`, which `ci.yml` calls on every
pull request and `release.yml` calls before it publishes, so a release passes
exactly what CI does:

- **`verify`** runs `pnpm build`, `pnpm typecheck`, `pnpm check:pkg`,
  `node scripts/verify-licenses.mjs`, `node scripts/dependency-licences.mjs`
  and `pnpm test:repo` in one job.
- **`test`** runs each package's `test:coverage` in a job of its own.
  `scripts/ci-test-jobs.test.mjs` fails when that list and the workspace
  disagree.
- **`browser`** runs the Studio's browser gate and its README pictures'
  check in Chromium, as `pnpm exec turbo run test:browser` and
  `test:pictures` for `@formancy/report-studio`, which build what they
  measure first. Locally, `pnpm build`, `pnpm --filter
  @formancy/report-studio exec playwright install chromium` once, then
  `pnpm --filter @formancy/report-studio test:browser` and `test:pictures`.
  A change to what a picture shows is retaken with `node
  scripts/pictures.mjs`, never by hand.
- **`install`** runs `pnpm test:e2e:install`.
- **`report`** builds the release report from what every job above
  collected
  ([0014](docs/decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md),
  [`docs/release/`](docs/release/README.md)). It fails the run when:
  - a job ended other than success or left no results;
  - a published package has no suite;
  - a test or a file was skipped or failed;
  - a test file the checkout holds did not run in its suite -- a test file
    is known by its name, not by the suite's include, so one renamed past
    the include fails here;
  - the browser gate failed a check, stopped, made fewer passes than it
    planned or a pass with no check in it, or the pictures' check did not
    walk a scene `scripts/pictures/scenes.json` gives the app or found a
    picture whose page says something else -- each read from the file it
    writes in the app's `test-results/` -- or either launched another
    Chromium than Playwright pins, or launched it otherwise than
    `scripts/browsers.mjs` says;
  - an install host `scripts/install-hosts.mjs` plans was not checked whole,
    or a builder's was not at its range's floor;
  - two builds of one package differ, or a tarball's built files are not
    every job's;
  - a release gate's evidence or a limitation's `heldBy` test did not pass.

  A job added to gates.yml needs a collect step and an upload, which the
  workflows test holds, and a reader in
  `scripts/release-report/collect.mjs`, which refuses a job it has none for.
  The browsers the gates run in are `scripts/browsers.mjs`'s, Chromium
  alone; a browser added there is one the report expects the gate to have
  run in.

`scripts/workflows.test.mjs` holds the workflows to their shape:
- every third-party action is pinned to a commit;
- no `${{ }}` appears inside a script;
- a release restores no cache;
- every gates job collects and uploads under its own key, and the report
  waits for all of them;
- `release.yml` checks the report before it pins, publishes only what its
  `check` job pinned, and signs and attaches the report beside the SBOM;
- `check` makes the SBOM from the tarballs it pinned, installed by npm
  outside the checkout, and installs no workspace;
- in `publish`, only the npm step holds the token or runs npm, and it comes
  after both signatures;
- nothing in a workflow a release runs sets `continue-on-error`, or runs a
  command inside an `echo`, where bash would lose its failure.

Locally, run the same commands for what you changed.

`pnpm test:repo` also fails until these are done:
- After `LICENSE.md` changes, run `node scripts/licence-status.mjs --write`.
- After a package is added, run `node scripts/codecov-config.mjs --write`, and
  add the package to the `test` job's matrix.
- A new package or app, or a changed dependency or peer, needs its row in
  `docs/architecture/05-building-blocks.md` naming, as code, what its
  manifest declares; a new decision record, a link from the section it
  bears on; and a file the architecture names as code, renamed, its new
  name there.
- A new decision record needs its entry in `docs/release/limitations.json`:
  the costs a user, integrator or operator meets, or why it has none. An
  edited one needs a re-read and
  `node scripts/release-report/limitations.mjs --stamp NNNN`, and that
  includes a Status line naming a later record.
- After a dependency, a peer or a tool of the published packages changes,
  run `node scripts/release-report/readme.mjs --write`.

`test:e2e:install` is the only gate that looks at the packages from outside:
- it packs them;
- installs the tarballs into plain npm projects, one per kind of host, each
  holding only what that host has, and each builder at the newest and the
  oldest release its peer range admits (`scripts/install-hosts.mjs`);
- type-checks each consumer with `skipLibCheck` **off**, against its host's
  types: Node's for the Node packages, the DOM's and not Node's for a builder;
- runs it: `consume.ts` under Node; `react.tsx` drawn by React's server
  renderer in its development and production builds; `angular.ts` compiled
  ahead of time, linked and bundled by `build.mjs`, and drawn by
  platform-server without the JIT compiler; and each builder bundled for a
  browser;
- compiles and runs `docs/getting-started.md` (0015): every block of code in
  the guide names its host in its fence (`ts guide=node`, `tsx guide=react
  file=main.tsx`), and the gate writes the blocks into that host's project
  -- `node`, the `react-app` hosts, `angular` -- type-checks them, runs the
  Node program against the output the guide shows, draws the pages on a
  server and bundles them for a browser. `scripts/getting-started.test.mjs`
  fails when a block names no host, a file is not named in the prose before
  its block, an install line names what the gate does not install, or a
  link or anchor no longer resolves.

That matters because every other gate resolves a package through a symlink to
its source, so an `exports` map that is wrong for a consumer can be right for
the whole suite. It needs `pnpm build` first. A package's public entry points
belong in its host's consumer in `scripts/install-fixture/`, and what both
builders draw is held to report-builder-core's README once, by `structure.ts`
there.

## Conventions that live upstream

Do not restate these here; go and read them in formancy.ai and Formancy Data.

- **Layering: what may import what**, and why a core package has no
  `@types/node` — [formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md).
- **A name and never an address** for anything a document names —
  [formancy.ai 0077](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0077-options-may-come-from-a-named-source.md).
  An asset or a dataset in a report is a named reference the deployment
  resolves.
- **TypeScript is pinned to `~6.0.3`** for the reason the workspace catalog
  gives.
- **Releasing, provenance and signing** — [`RELEASING.md`](RELEASING.md).
- **Reporting a vulnerability** — [`SECURITY.md`](SECURITY.md).
