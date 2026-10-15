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
| Upstream `@formancy/*` | 0.5.0, exact: `@formancy/spec`, for the report hash |
| formancy form spec | none read yet; 1 to 4, as `@formancy/spec` 0.5.0 accepts them, when forms are |
| `reportSpecVersion` | "0", the draft |
| Formancy Data | none until Data publishes |
| Node | 22.13 or later |
| TypeScript | `~6.0.3` |
| Angular, React | none built against yet; 22 and 19 with the builders |
| pnpm | 12.4.2 |

**Node 22.13 or later, up from 22.12.** `pdfjs-dist` 6.4.299, which reads
every PDF the checks judge, declares `>=22.13.0 || >=24`. `engine-strict` is
off, so 22.12 still installs; what fails there has not been measured.
