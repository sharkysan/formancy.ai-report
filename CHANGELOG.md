# Changelog

All notable changes to Formancy Report. Every package moves on one version
number. The versions of the upstream `@formancy/*` packages this repository
depends on are a separate line, and a change to one is called out explicitly.

Loosely [Keep a Changelog](https://keepachangelog.com), with reasons attached —
a line that says only *what* changed is rarely the line you need six months
later.

## Unreleased

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
report, browser and container gates, and third-party notices in built apps.

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
  that is published. Its source manifest does not yet send pnpm to `dist/`,
  so packed from its own directory it cannot be imported, and the install
  gate does not import it yet; it does install and drive
  `report-builder-core` under Node.

What waits for the Studio: a browser gate for layout, contrast and real
pointers, a check of the README pictures, and a test that mounts both
builders over one session.
