# Changelog

All notable changes to Formancy Report. Every package moves on one version
number. The versions of the upstream `@formancy/*` packages this repository
depends on are a separate line, and a change to one is called out explicitly.

Loosely [Keep a Changelog](https://keepachangelog.com), with reasons attached —
a line that says only *what* changed is rarely the line you need six months
later.

## Unreleased

**Every starter opens with nothing in the problems pane.** The quotation
declared a print style, `strong`, that nothing used, so the first thing the
Studio showed a new author was a warning about it, and the README's picture
showed it too. The style is gone, and a corpus test now fails on any
diagnostic a starter raises, warnings included. The pictures were taken again
by the script.

**Formancy Report is source-available, on Formancy Data's terms, and the
licence is in force before a lawyer has read it** ([0001](docs/decisions/0001-a-paid-module-in-its-own-repository.md)).
Free to read, fork, evaluate, develop and test, including in companies and
without an expiry; a paid licence to run in production; a separate agreement
to redistribute. Customer data, report templates and the documents rendered
from them remain the customer's. `LICENSE.md` Version 1 is in force from
14 October 2026 and says at the top that no lawyer has reviewed it. Its
terms are Formancy Data's Version 1.1, so a Report + Data bundle is one kind
of agreement. An AGPL-plus-commercial model was the working direction until
this decision; it was withdrawn because it would have needed a compatibility
review for every bundle, and because Data already had a clear production
boundary to price against.

**The repository has Formancy Data's pipeline** ([0002](docs/decisions/0002-depend-on-upstream-never-copy-it.md)).
It brings:

- **Contributions under a CLA**, checked on every pull request against the
  hash of the text signed.
- **Workflows.** `gates.yml` with a `verify` job, a `test` job per package and
  an `install` job, called by `ci.yml` and by a `release.yml` that publishes
  only the tarballs the install gate ran, pinned by hash, with provenance and
  a signed SBOM. CodeQL and dependency review run in `security.yml`.
- **Guards under `pnpm test:repo`**, each watched failing first: the licence
  field and files of every package, exact upstream versions, a generated
  `codecov.yml`, the README's licence sentence generated from `LICENSE.md`,
  the 600-line source budget, the test matrix against the workspace, and the
  workflows' shape.

Left out until there is something for them to prove: Formancy Data's release
report and container gates. Its browser gate, its README pictures' check and
its third-party notices in built apps came with the Studio.

**`@formancy/report-spec` names the report format and refuses what it does not
read.** `REPORT_FORMAT` and `REPORT_SPEC_VERSION` ('0', the draft) are
independent of formancy's `specVersion` and of every package version.
`checkSpecVersion` reads a report of that version. It refuses a formancy form
as not a report, naming its `specVersion`, and refuses a report of another
version, naming both versions, rather than reading part of it. Both are
quoted and shortened in the message, because a version string is the
document's to choose. It is the package that proves the pipeline: build,
packaging checks, the licence in the tarball and the install gate all run on
it.

**`@formancy/report-spec` defines the report, validates it and hashes it**
([0007](docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
`ReportDefinition` is a document of its own rather than a formancy form with
pages added, because a form's pages are navigation and its version line is
formancy's. It is still version '0', the draft: nothing written under it is
promised to be read by a later release, because the format is being fitted
to the three starter reports before it freezes. What it holds:

- **Layout.** A page, and five regions of flowing components with no
  absolute coordinates. Lengths are in points to the hundredth, and a finer
  one is refused rather than rounded, so one layout has one hash.
- **One table.** One table over one detail dataset, with one grouping level
  whose key orders the rows first. Its totals are rows, so a quotation can
  show a subtotal, a tax line and a total.
- **Aggregates.** Declared once and printed by id, over the current group or
  every row, with declared rounding.
- **Bindings.** Every field reference is one shape. Dataset field,
  parameter and aggregate ids are formancy field keys, so a form's or Data's
  key binds unrenamed and CEL reads it with a dot.
- **Images and currencies from the data.** An image can come from an
  `image` field: a photo or a signature taken with a form, resolved by the
  host from an approved id and digest, never an address. A currency can come
  from a field or a parameter.
- **Styles.** Print styles are tokens, not CSS, with conditional style
  rules.
- **Expressions.** The names an expression reads, in each place, are fixed
  in the format, because every saved condition is written against them.

What comes with it:

- **`validateReport`** collects every error, each with a JSON Pointer, a
  stable code and the component it is in. It also refuses a fixed size the
  page cannot hold, while the author edits rather than at render time. A
  template is untrusted input even when an administrator wrote it, so it:
  - never throws;
  - never runs a getter;
  - reads every array's length once, before reading an element;
  - echoes no input into a message or a path.
- **`reportHash`** hashes only a report the validator reads, over an
  envelope that names the format, so a form and a report never share a hash
  and nothing invalid is ever pinned.
- **`emptyReport`, `walkComponents` and `componentAt`**, the units and the
  page geometry are written once here, so the editor, the core and the
  runtime do not each write their own.

**`@formancy/report-spec` now depends on `@formancy/spec` 0.5.0**, at that
exact version, for `schemaHash`: the report hash uses formancy's
canonicalisation rather than a second one.

**pdfmake renders reports, chosen by a trial on an adversarial corpus**
([0005](docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[the trial](docs/renderer-trial.md)). `@formancy/report-corpus`, private and
never published, holds fourteen fixtures, each one way a report goes wrong:
a row lost at a page break, a header that does not repeat, a group header
left at the foot of a page, a summary that just fits or just does not, exact
decimals, text outside ASCII, an invalid image, an oversized job. pdfmake
0.3.11 and pdfme 6.2.4 each rendered all of them through a trial adapter.
pdfmake passed every fixture or refused it as the fixture allows; pdfme's
adapter left a group header last on a page. pdfmake was faster on every
timed document, and the trial document dates and qualifies every time. The
adapter keeps its own page limit, measures the page regions and every
keep-together block and table row before laying out, and checks image bytes
first, because pdfmake's defaults lose content without saying so. There is
no renderer package yet; `report-render-pdf` grows from that adapter.

**A rendered report is proved on the PDF it produced**
([0003](docs/decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
The corpus's checks read the PDF back with PDF.js, never the engine's input
and never a mocked engine. They hold every row once and in order, with its
own cells in column order on its own lines, so a value on the wrong row is a
failure; the column header above the table on every page it reaches; the
page header above and the footer below the body on every page, numbered; no
empty page and no heading alone at a page's foot; nothing past a margin or
over other text; every font embedded and every character drawn; and every
image at its size. What they cannot see -- rules, borders, clipping, colour,
glyphs touching beyond their computed boxes -- waits for page images.

**Dependency and font licences are a gate**
([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
`scripts/dependency-licences.mjs` runs in the `verify` job and walks the
production dependencies of every publishable package as installed, and every
font they ship. Permissive licences pass; GPL, AGPL, LGPL, SSPL,
source-available and non-commercial licences, a missing licence and a WITH
clause nobody has reviewed are refused, with the route the package came in
by. A font's licence is read from the font's own name table, because a
package's `license` field says nothing about the fonts it ships: `pdfjs-dist`
declares Apache-2.0 and ships GPL-licensed Liberation Sans. A repository test
also holds every publishable package's build to inlining nothing from
`node_modules`, since the walk never follows a devDependency. Review held this
until the renderer experiment brought the first third-party PDF libraries.

**Three version lines, each refused when unknown**
([0004](docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).
formancy's form spec, Report's own format and Formancy Data's contract move
independently of every package version, and a document says its version
inside itself. A release records the tuple it supports; the one this release
is built for:

| Line | Supported |
|---|---|
| Upstream `@formancy/*` | 0.5.0, exact: `@formancy/spec`, for the report hash; `@formancy/expressions`, for every expression |
| formancy form spec | none read yet; 1 to 4, as `@formancy/spec` 0.5.0 accepts them, when forms are |
| `reportSpecVersion` | "0", the draft |
| Formancy Data | none until Data publishes |
| Node | 22.13 or later |
| TypeScript | `~6.0.3` |
| Angular, React | `@angular/core` ^22 and `react`/`react-dom` ^19, as peers of the builders; tested against 22.2.2 and 19.3.1 |
| pnpm | 12.4.2 |

**Node 22.13 or later, up from 22.12.** `pdfjs-dist` 6.4.299, which reads
every PDF the checks judge, declares `>=22.13.0 || >=24`. `engine-strict` is
off, so 22.12 still installs; what fails there has not been measured.

**`@formancy/report-core` edits a report through commands, and a refused edit
changes nothing** ([0008](docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
0007 makes the format strict, so an editor has to keep the document valid at
every step; this is the package that does. It follows formancy's builder
session rather than reusing its form commands. What it holds:

- **Commands.** Pure functions over a `ReportDefinition` for the title,
  locale and page; styles, datasets, fields, parameters, assets and
  aggregates; inserting, removing, moving, updating and duplicating
  components at any depth; and the table's columns, group, sort and footer
  rows. A command refuses, with a stable code, what it names and cannot
  find. It never clamps an index, so a keyboard move and a pointer drop
  agree. A component's patch is typed by its kind.
- **Commands as data.** `COMMANDS` and `CommandDescriptor` make each command
  data, for a proposal. A proposal arrives as JSON from a model:
  - a removal is `null`, because JSON has no undefined and a removal written
    as one would arrive as no change at all;
  - a descriptor whose arguments are too few, too many or of the wrong type
    is refused with `invalid-arguments` rather than thrown, so a bad
    operation refuses its proposal whole.
- **`openReportSession`.** It commits a command's result only when
  `validateReport` accepts the whole of it, so a refused edit leaves the same
  document object, revision and history, and notifies nobody.
  - Committed documents are deeply frozen, so `useSyncExternalStore` and
    Angular signals can compare by identity.
  - What an edit did not change keeps its object, matched by id within its
    list, so an insert at the top of the body does not redraw everything
    below it.
  - Undo and redo restore the exact snapshots, labelled, with 200 steps kept
    by default.
  - A transaction is one step, validated once at the end. Its callback runs
    synchronously: an await inside it would commit half a proposal, so an
    async one does not compile and a promise is refused before anything
    commits.
  - An edit bound to a `reportHash` that is no longer current is refused as
    stale, and a command that edits the session while it runs throws, so no
    edit is lost under another.
- **`tryEdit`** gives a transaction's verdict without committing it, from the
  same draft: what a proposal's review shows before Apply (plan 16).
- **`locationOf`, `locations` and `validLocations`** tell a builder where a
  component stands, every place one could go, and the places the validator
  accepts it in. Drop targets come from asking the validator, so they cannot
  disagree with what the session then commits.
- **`diagnose`** lists the errors the runtime would refuse a report for, and
  warns of unused declarations, an empty body and a text that prints nothing.

**`@formancy/report-core` compiles every expression once, for the editor and
the runtime** ([0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
`compileReport` gives the programs, what each reads, the members each name
holds, the aggregate order and the errors. `expressionValues` binds a
program's values. If the runtime assembled its own compile options, it could
accept what the editor refuses, `now()` among them, or bind a value as a
type the editor never checked it as. What it decides:

- **Every member read is checked as its type.** `params.copies + "x"` is an
  error, and `row.amount < dec("0")` is fine whichever side the decimal is
  on.
- **Decimals are used as decimals.** An exact value is used as what it is:
  `row.amount * dec("1.081")`. `dec(row.amount)` is a type error, because
  0.5.0 has no `dec(decimal)`.
- **Refused, because a report renders the same from the same data:**
  `now()`, `today()`, `random()`, a name read whole (`size(params)`), and an
  image field read as a value.
- **Aggregates are computed in the order they read each other.** One that
  reads its own total is an error, at the read that closes the circle.
- **Each error points at the component, the table column and each read**,
  not at a stretch that covers unrelated text.

**`@formancy/report-core` depends on `@formancy/expressions` 0.5.0**, at that
exact version, to compile expressions with the compiler the runtime will use
rather than a second one. Its 0.5.0 declares a variable only by its whole
name, so each member read is spliced, by its own `rewritePath`, into one
variable declared with the member's type. A decimal that may be null is
checked as `dyn`, which 0.5.0 will not test for equality with a decimal.

**A report can be designed in a native React or Angular builder, over one
session** ([0012](docs/decisions/0012-the-builders-are-native-and-share-one-session.md)).
Three packages arrive, and what holds them to each other is the reason for
their shape:

- **`@formancy/report-builder-core`** is the editor both builders render:
  one person's view of a report-core session -- selection, zoom, open
  pane, drag -- and everything a builder shows, derived from the document
  once: the outline, the palette, the property fields (a length edited in
  millimetres, refused in millimetres too), the design view's geometry,
  the drop targets (report-core's `validLocations`, so a builder never
  offers a drop the session refuses), the diagnostics, which actions have
  somewhere to go, and a live region's announcements. Its state is deeply
  frozen and keeps its identity until something changes. Keys are decided
  once, in `actionForKey`, with every drag's keyboard path (formancy.ai
  0046). Every word is in one catalogue, in English, Swiss German and Swiss
  French. No framework, no DOM, no Node. Several editors share one session:
  the document and its undo history live only there, so a builder of either
  framework can be destroyed and another mounted without losing a step.
  What it puts into a report -- a new text's "New text" -- is in the
  report's language, because it prints; the session keeps each step's label
  as an English sentence any reader of it can show, and each editor says it
  in its own language. `report-builder.css` dresses both builders through
  formancy's `--wb-*` variables and `data-report-part` hooks, never a
  framework's class or a colour of its own.
- **`@formancy/report-builder-react`** and **`@formancy/report-builder-angular`**
  render that state natively: `useSyncExternalStore`, and signals with
  `OnPush` and no zone.js. Neither depends on the other, and the Angular
  package's closure has no React (plan 21). Both render one accessible
  structure: a region named "Report editor", a toolbar that is one tab
  stop with buttons for the panes a narrow screen shows one at a time, a
  tree whose focus is its selection, a place chooser for every drag, a form
  of properties with a way back to the report's own, a counted and
  announced list of problems, and a design view of named pictures, labelled
  as not the PDF.
- **`BUILDER_SCENARIOS`** is that structure as data: steps that find
  elements by role and accessible name. Each builder runs every one, in all
  three languages, with axe over each end state, and the core runs them
  against the model. A review that compared the two builders found them
  apart in places the scenarios did not reach -- a narrow screen
  stuck on the outline, focus lost after deleting the last row, no way back
  to the report's properties, tools that said nothing, problems never
  announced, a pointer read a pixel off -- and each is now a scenario, a
  rule both builders follow, or a test.
- **The Angular package is built by ng-packagr** into `dist/`, and
  `scripts/finalize-angular-dist.mjs` makes ng-packagr's manifest the one
  that is published; pnpm packs it from `dist/`. The install gate imports
  it from its tarball, as it does the React builder (below).

What waits for the Studio: a browser gate for layout, contrast and real
pointers, a check of the README pictures, and a test that mounts both
builders over one session.

**`@formancy/report-runtime` resolves a report against its data, exactly, or
refuses it** ([0010](docs/decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
`resolveReport` returns the renderer-neutral document a PDF engine draws, a
manifest of what it was resolved from, and a preview's warnings; or every
reason it will not, tagged with the stage that found it, never part of a
document. Grouping, totals, rounding and formatting are decided here once, so
that a renderer, a builder or the server never decides them again. What it
holds:

- **The data contract.** Every value is held to its field's type before
  anything reads it. A decimal arrives as a canonical string and is refused
  as a JavaScript number, which has already lost digits; a field the report
  does not declare is refused, so nothing it does not print rides along into
  a render, a cache or a log. Missing is not null: a field the data lacks is
  an error in a final render, never an empty cell.
- **Final and preview.** A final render refuses data the provider calls
  incomplete. A preview prints what it has, warns once per missing field,
  and labels every page and its manifest, so that it is never taken for the
  report.
- **Exact totals.** Integers as BigInt, decimals exact; a declared rounding
  is applied once, to each group's exact total and to the report's apart.
- **Formatting** through Intl, handed exact digits already rounded half away
  from zero, never a double. A date prints as the same day in every time
  zone; only an instant is shown in the zone the host names. A locale or
  zone the engine lacks is refused rather than replaced by the host's.
- **Bounds.** 100,000 detail rows, 20,000 steps an expression and 5,000,000
  a render, 20 MB an image, each asset asked for once and shared.

**`@formancy/report-render-pdf` draws a resolved report with pdfmake, and
refuses what it cannot draw whole**
([0005](docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](docs/decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
`renderPdf` resolves to the PDF's bytes or rejects with a `RenderRefusal`
whose code says why; a refused report has no PDF at all. It grew from the
renderer trial's adapter and draws all of version 0: columns, framed
sections, rectangles, rules of any weight and colour, styles per row and per
cell, images fitted to their box. Every fixture of the corpus passes, with
none excused. Beyond the trial's rules, from a review of its first build:

- **A width is a number.** A fill column handed to pdfmake as `'*'` widened
  to its longest word, and pushed a table's amounts off the paper while the
  render succeeded.
- **A word in a table cell is never broken.** 'CHF 10,612,357.00' broke
  into '…357.0' and '0', two numbers; a word wider than its column is
  refused, naming the table, row and column. A paragraph still breaks a
  long word, over up to 16 lines, and refuses a longer one before pdfmake
  spends a minute breaking it.
- **Every character is held to its font.** pdfmake printed a character
  Roboto lacks as an empty box and U+0000 in the text; CJK, Hebrew, emoji,
  a tab and an fr-FR amount's narrow no-break space are refused instead,
  until fallback fonts exist.
- **A table's closing rows stay with what they close**: a subtotal, a VAT
  line, a total never stand alone at the top of a page.
- **Work that grows with the document.** A table's breaks are planned, so a
  1,600-group table renders in about 4 seconds instead of 60; a body too
  long for the page limit is refused before pdfmake measures it; an abort
  from a timer reaches a render between its passes.
- **Nothing taller than the page**: a rule, a frame, the images' data
  together.

It runs in Node and has a browser entry, built and tested in Node, that is
not yet in the package's `exports`.

**`@formancy/report-core` refuses an expression that would print an inexact
number, and a rounding the runtime would refuse**
([0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
A double literal, `double()` and a division with `/` are errors
(`expression-inexact`), because upstream hands an integer and a double back
alike: `int(double("4.35") * 100.0)` printed 434 as though it were exact, and
`3 / 2` printed 1, a rounding nobody declared. `divide(dec(a), dec(b),
places)` is the exact division. `matches()` is an error
(`expression-unbounded`): one backtracking pattern took 39 seconds inside a
single step of the budget. A rounding on a total that has no places
(`rounding-not-decimal`), and a number format that would round a rounded
total again (`format-rounds-again`), are errors too: every render refused
the first while the editor said nothing.

**A group header reads its own key**
([0007](docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md),
[0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
`group.key` is the value the current group is keyed by, typed as the field
grouped by, so a header can compute with it rather than only print it. An
aggregate may not be called `key` (`reserved-id`).

**The year 0000 is refused** in a date, a date and time, an instant and a
parameter's default: Intl prints it as the year 1, without its era, a year
nobody wrote.

**Three starter reports** in `@formancy/report-corpus`, each proved end to
end on the PDF it renders: a service inspection with long notes, a framed
defect, a photo from the data and a sign-off; a Swiss quotation with its
supplier, line items, subtotal, VAT, cash rounding and total; and an
equipment register grouped by site. The README shows a page of each, drawn
from the PDF by PDF.js, and a test holds each picture to the text of its page.

**The README's "Render a report" runs in the install gate**, line for line,
from the packed packages, on the quotation starter: a test fails when the
README's lines are not the consumer's.

**The install gate checks each builder as its host would use it, from its
tarball.** It installed both builders and imported neither. publint and attw
read their manifests, but nothing outside the workspace loaded their code or
checked their declarations against the React or Angular a host installs.

- **A project per kind of host**, holding only what that host has
  (`scripts/install-hosts.mjs`). In one project shared with the Node
  consumer, a builder resolves what a browser host lacks: Node's types, or a
  package it never declared.
- **Both ends of each peer range.** npm installs the newest release a range
  admits, so a builder that needs a later API, or carries its own React,
  passes there. Each builder is also installed with its framework at the
  range's floor, read from the packed manifest, and the gate prints the
  versions it installed.
- **React:** `react.tsx` is type-checked as a browser's code (DOM types, no
  Node types, `skipLibCheck` off). It draws `<ReportBuilder>` with
  `react-dom/server` in React's development build, which must say nothing,
  and in its production build, which is what a host's bundler ships.
- **Angular, ahead of time.** `angular.ts` is a host's component,
  `<report-builder [editor]="editor" />`. ngc compiles it with strict
  templates against the builder's declarations. `build.mjs` bundles it,
  linking with `@angular/compiler-cli`'s linker as the Angular CLI does, and
  that linker refuses a library published for a newer Angular. The bundle is
  then drawn by `@angular/platform-server` without the JIT compiler. While
  the page lives the editor has one more listener, and none once the
  application is destroyed.
- **One statement of the structure.** What both builders draw is held once to
  report-builder-core's README by `structure.ts`: names from the editor's
  catalogue, a palette button, outline row, box and problem for each in the
  state, and every `data-report-part` one `REPORT_PARTS` names.
- **A browser bundle.** Each builder is bundled for a browser by esbuild, so a
  Node built-in in its code fails.

Each break below was seen to fail the gate on a tarball broken for it, with
the unbroken tarballs passing. Each check in `structure.ts` was also seen to
fail on each builder's real markup, broken once per check. A declaration
file that renames the `[editor]` mapping fails at ngc (NG8002); one that
imports a package the builder does not declare (TS2307), or references
Node's types (TS2688), fails at the type check. Code fails at its run when
it imports an undeclared package, carries its own React, renames the input
only at run time (NG0950), keeps its listener on the editor after the
application is destroyed, or imports Angular's JIT compiler. It also fails
at its run when it drops a part from a template's imports, which leaves the
palette undrawn. React's development JSX fails in the production build. An
API newer than the floor of React's range fails at the floor only. A Node
built-in fails the browser build. A library declared for a newer Angular is
refused by the linker, and one published fully compiled leaves the builder
nothing to link. A manifest with `workspace:` or `catalog:` versions is
refused by npm. A builder with a peer its host does not install, or no peer
on its framework, is refused when the gate plans its projects. One whose
dependency brings Node's types into a browser host's project is refused once
it is installed.

What it does not show: either builder mounted in a DOM -- focus, keys, a
pointer, a re-render after an edit -- which is each package's suite, in jsdom.
A React server render runs no effects, so the React check shows that nothing
subscribes while drawing, not that unmounting unsubscribes. Angular runs in
its development mode only. The Angular CLI drives the linker through OXC by
default; the gate drives the same linker through its Babel plugin.

The gate costs more than twice what it did. On one Windows machine (Node
24.21, npm 11.19, npm cache warm, 16 October 2026), the gate as it stood
before this change took 23.0, 20.6 and 19.5 seconds over three runs. This
one took 52.8, 49.9 and 49.2, with its five projects installed at once.

**`png-js` 1.1.0 is a reviewed licence exception**
([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
It reaches the renderer through pdfmake and PDFKit and declares no licence;
the LICENSE it ships is MIT.

**The Studio: the starters in both builders, with the real PDF beside them**
([0013](docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
`apps/studio`, private and never published, opens each starter and a blank
report in the React or the Angular builder over one session per starter,
and previews the PDF the session prints: resolved by the runtime, rendered
in the page by `@formancy/report-render-pdf/browser`, and drawn by PDF.js on
white paper, with Download PDF giving the bytes on the paper. A refusal is
listed with a button that selects its component. `pnpm --filter
@formancy/report-studio dev` serves it on port 4394. It wears formancy.ai's
admin palette, copied under the mark Formancy Data uses and pinned to
admin.css at e3c5967 by the palette guard, with the builder's panes
recoloured only through `--wb-*` and given the admin's geometry without its
colours; and the README's pictures of it are taken by a script and held to
the text they show, as Formancy Data's are. The PDF.js viewer stays inside
the app, because 0006 refuses `pdfjs-dist`'s Liberation Sans in a published
closure. The fonts come from Google Fonts, as in Formancy Data's apps, not
self-hosted as formancy.ai's admin serves them.

**Two new gates in CI's `browser` job.** The Studio's browser gate measures
in Chromium what jsdom cannot: layout from 320 pixels up, the keyboard's
path, axe with contrast and target size, every starter's PDF drawn on white,
the framework switch, a pointer's drag, the place chooser, Final and the
Preview's zoom. The README pictures' check walks the same page again. The
Studio's own suite joins the `test` matrix and `codecov.yml`.

**The builders: three fixes the Studio found, each a shared scenario or a
test in both builders.** An undo that leaves nothing selected -- of a
duplicate, of an insert -- now puts focus on the outline's tree rather than
on its first row, which focus selected, so the next Delete deleted a
component nobody chose. An empty report's outline is an empty tree with a
sentence beside it saying so, where it held region groups with no rows,
which axe refuses (`aria-required-children`). A place chooser drawn by a
builder that did not open it -- after a framework switch, the drag is the
editor's -- no longer takes the keyboard when it is drawn, and Cancel or
Escape in it lands on the palette entry of what was being placed instead
of on the page. In React, a pointer drag that dropped away from where it
began no longer swallows the next keyboard press of a palette entry. The
report's title is a hook of its own, `data-report-part="title"`, drawn on
one line in the text colour, and the design view's note wraps to its pane.
