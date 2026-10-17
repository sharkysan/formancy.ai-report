# 5. Building blocks

## Level 1 — the layers

Dependencies point downward only. The two packages at L2 do not know each
other: one path prints a report, the other edits one.

```
apps   studio                  the playground: both builders, the PDF, PDF.js        private
       pages                   the product's pages, static HTML                      private
────────────────────────────────────────────────────────────────────────────────────────────
L3     report-render-pdf       pdfmake · uqr · a Node entry and a browser entry
       report-data-provider    @formancy/data-client: the one door to Data
       report-builder-react    React · DOM            ┐ never each other,
       report-builder-angular  Angular · DOM          ┘ never the other framework
────────────────────────────────────────────────────────────────────────────────────────────
L2     report-runtime          every value decided once        no framework, no engine, no Node
       report-builder-core     the editor model                no framework, no DOM, no Node
────────────────────────────────────────────────────────────────────────────────────────────
L1     report-core             commands · session · compileReport · @formancy/expressions
────────────────────────────────────────────────────────────────────────────────────────────
L0     report-spec             the format · validation · hash · @formancy/spec
                               the payment codes' rules: SIX's and the EPC's

beside report-corpus           private test support: the fixtures, the PDF reader and its
                               checks, readCodes, the starters and samples; over the runtime
```

Each row's three middle columns are its manifest's: what it depends on
among the workspace's packages, what else it installs, and its peers. Its
devDependencies are left out, so the corpus, every package's test support,
stands only where it is a dependency. The versions are the manifests'; the
README's [generated table](../../README.md#what-it-is-tested-with) gives
the upstream packages' and the peers' ranges.

| Package | Depends on, here | From elsewhere | Peers | What it may import, and what holds it |
|---|---|---|---|---|
| `@formancy/report-spec` | — | `@formancy/spec`, for the hash | — | No framework, no PDF engine, no Node: the format names no engine ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)). ES2023's library and no `@types/node`, so a DOM or Node global does not compile |
| `@formancy/report-core` | `report-spec` | `@formancy/expressions` | — | Those two and nothing else, with the same compile-time rule ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), [formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md)) |
| `@formancy/report-runtime` | `report-core`, `report-spec` | `@formancy/expressions` | — | No framework, no PDF engine, no Node, by the same rule; report-core for the one compilation it shares with the editor ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| `@formancy/report-builder-core` | `report-core`, `report-spec` | — | — | Those two, nothing else; no framework, no DOM, no Node ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-render-pdf` | `report-runtime` | `pdfmake`, `uqr` | — | Of this repository's packages, the runtime alone, which re-exports what the renderer needs of the format: report-spec's own rules for the slip and for how an EPC QR code prints ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)). A resolved document and approved bytes in, never a database or an address ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)) |
| `@formancy/report-data-provider` | `report-runtime`, `report-spec` | `@formancy/data-client` | — | The only package that may depend on Formancy Data; `scripts/dependency-licences.mjs` refuses Data reached from any other ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)). The DOM's globals and no `@types/node`, so a `node:` import does not compile |
| `@formancy/report-builder-react` | `report-builder-core`, `report-core`, `report-spec` | — | `react`, `react-dom` | The core packages and React, never Angular or the other builder ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-builder-angular` | `report-builder-core`, `report-core`, `report-spec` | `tslib` | `@angular/core` | The core packages and Angular; `src/dependencies.test.ts` fails on React anywhere in its closure ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-corpus` | `report-runtime` | `pdfjs-dist`, `zxing-wasm` | — | Private, never published: test support ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)) |
| `apps/studio` (`@formancy/report-studio`) | `report-spec`, `report-core`, `report-runtime`, `report-render-pdf`, `report-builder-core`, `report-builder-react`, `report-builder-angular`: every package but the provider; and `report-corpus`, for its starters | `react`, `react-dom`, `@angular/core`, `@angular/common`, `@angular/platform-browser`, `rxjs`, `pdfjs-dist`, `@formancy/themes`, and the faces: `@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | — | Private; the PDF.js viewer lives here and in no published package ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)), and its faces are its own copies ([0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)) |
| `apps/pages` (`@formancy/report-pages`) | — | `react` and `react-dom`, for the server renderer, and the faces: `@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | — | Private; the Studio's stylesheets by import, and facts read from the repository's files when it builds ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)) |

**What holds the layers, and what does not.** The table's dependencies
are held to the manifests by `scripts/architecture.test.mjs`: a manifest
that adds a sibling, an upstream package or a peer fails `pnpm test:repo`
until its row names it
([0026](../decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)).
pnpm links beside a package only what its manifest declares, though the
root's own tools are reachable from every package in the workspace. The
install gate closes that: it installs each published package into a project
that holds only what its kind of host would, so an import the manifest does
not declare fails there (`scripts/install-hosts.mjs`). The rule that L0 to
L2 have no platform is the type checker's: those packages have no
`@types/node` and no DOM library. Nothing checks the direction itself: that
a row's siblings stand in a lower layer of the diagram above, and the
diagram, are review's.

## Level 2 — inside each package

### `@formancy/report-spec` (L0)

The format, and nothing that evaluates it
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).

| Module | Responsibility |
|---|---|
| `types.ts` | `ReportDefinition` at `reportSpecVersion` `'0'`, the draft: page, five regions, components, datasets, parameters, assets, aggregates, styles, provenance |
| `version.ts` | Whether a document is a report this package reads at all, before anything about what it holds; a form or another version is refused naming both ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)) |
| `validate.ts` and `validate-*.ts` | Structural validation, every error with a JSON Pointer and a stable code (`errors.ts`): declarations, components and where each may stand, inlines and formats, the table, aggregates, the payment part and the EPC QR code, the texts of both read by `validate-payment-text.ts`. Kinds are tables, not switches |
| `check.ts` | Reading untrusted input once, through property descriptors, so a getter never runs and a value cannot answer differently when asked again |
| `limits.ts` | Every bound a definition is held to, each with its reason |
| `units.ts`, `page.ts` | The one conversion between millimetres and points, and the page geometry the validator, the builder's rulers and the renderer read |
| `hash.ts` | `@formancy/spec`'s `schemaHash` over an envelope naming the format, only of a report the validator reads |
| `qr-bill.ts`, `payment-part.ts` | SIX's rules for a Swiss QR-bill as functions over text, and the slip's size and place: what the validator applies to literals and the runtime to data ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)). Its `isQrIban` is the QR-IBAN's range, which the EPC's rules read too |
| `payment-reference.ts` | What both payment codes check alike: the remainder modulo 97, an IBAN's check digits by it, and the creditor reference. `qr-bill.ts` and `epc-payload.ts` both read it; what only one code allows stays with that code's rules (0022, [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `epc-qr-code.ts`, `epc-payload.ts`, `sepa.ts` | The EPC QR code: its component; the EPC's rules for each of its fields, and its payload, as functions over text; and the countries of SEPA as one table, each with its IBAN's length and whether it is in the EEA. What the validator applies to literals and the runtime to data (0025) |
| `epc-print.ts` | How an EPC QR code prints: a module's side in its square, and, with Austria's caption, the frame, the caption, the modules' widths and the least version that prints. The validator asks it of a square, and the renderer of the version it encoded (0025) |
| `walk.ts` | The one walk of the components that the core's commands, the builder's outline and the runtime share |

### `@formancy/report-core` (L1)

`openReportSession` holds one document, its revision and its history; every
change is a command that a session commits only when the validator accepts
the result ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).

| Module | Responsibility |
|---|---|
| `session.ts`, `snapshot.ts` | Commit, frozen snapshots sharing what did not change, undo and redo to `DEFAULT_HISTORY_LIMIT` steps, listeners, the stale-hash refusal |
| `draft.ts` | Several commands as one edit, and `tryEdit`: the verdict on a draft without committing it, which a proposal's review would show |
| `commands/` | Pure commands on the document, the components, the declarations and the table; `registry.ts` makes each a descriptor a proposal can carry, its arguments checked before it runs |
| `locations.ts`, `tree.ts` | Where a component stands, and `validLocations`: the places it may go, found by trying each |
| `expressions/` | `compileReport`: every expression compiled where it stands, each member checked as its type, the clock, doubles, division and `matches()` refused, and the order aggregates are computed in ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| `diagnostics/` | What an editor shows about a valid report: the errors the runtime would refuse it for, and warnings an author probably wants |

### `@formancy/report-runtime` (L2)

`resolveReport` turns a report and its data into a `ResolvedDocument`, a
manifest and a preview's warnings, or every reason it will not
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
Each stage is a module, and each decides its question once:

| Module | Responsibility |
|---|---|
| `input.ts`, `data.ts`, `values.ts`, `parameters.ts` | The data contract: read once without running anything, every value held to its field's type, undeclared fields refused, bounded by `MAX_DETAIL_ROWS` |
| `evaluate.ts` | The expressions report-core compiled, evaluated with fixed capabilities within `EXPRESSION_STEP_BUDGET` each and `RENDER_STEP_BUDGET` a render |
| `sort-group.ts`, `totals.ts`, `decimal.ts` | Row order and groups; aggregates computed exactly, BigInt and upstream's `Decimal`, rounded once as declared |
| `format.ts`, `inlines.ts`, `styles.ts` | Every value as the text it prints, for the report's locale, through Intl handed exact digits |
| `lower.ts`, `lower-table.ts`, `images.ts` | The components lowered to blocks; images through the host's lookup, once per render |
| `qr-bill.ts`, `lower-payment-part.ts` | A QR-bill's payload and every text its slip prints, held to report-spec's rules once the data has resolved them ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `lower-epc-qr-code.ts` | An EPC QR code's payload: each text read as a paragraph's and held to report-spec's rules once the data has resolved it, an optional one that prints nothing left unused, and the whole held to the EPC's bytes ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `document.ts` | The renderer-neutral document, the refusal codes, and `MAX_ASSET_BYTES` |

### `@formancy/report-render-pdf` (L3)

`renderPdf` draws a resolved document with pdfmake, or rejects with a
`RenderRefusal` before any PDF is written
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
It is a package boundary, not an engine interface: there is one engine.

| Module | Responsibility |
|---|---|
| `node.ts`, `browser.ts`, `engine.ts` | The two entries: pdfmake's Node build reading font files, or its browser build reading virtual ones. Only that differs. The browser entry imports Liberation Sans's chunk with the first document that has a QR-bill or a captioned EPC QR code, and never for a document with neither, which `report-render-pdf/src/browser.test.ts` holds ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `render.ts` | The passes, each a pdfmake layout: measure the page regions, measure kept blocks and table rows, then lay out the PDF, with an abort read between them |
| `check.ts`, `glyphs.ts`, `widths.ts`, `assets.ts` | What is refused before pdfmake sees the document: a character without a glyph, what is malformed or wider than where it stands, image bytes that are not what they say |
| `bound.ts`, and `check.ts`'s `refuseTall` | What is refused between the passes, once the page regions are measured: a block of fixed height or a line taller than a page's body, and a body whose least height already needs more pages than the limit |
| `words.ts` | What is refused inside every pass, once pdfmake has measured the words and before it lays out a line: a word wider than its table column, or longer than `MAX_WORD_LINES` lines of its paragraph, read from pdfmake's own `_minWidth` ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| `breaks.ts`, `table.ts`, `table-rules.ts` | Where a table's pages break, planned from measured heights, so a group header stays with its first row and totals with the last |
| `qr.ts` | A QR code encoded once by uqr and drawn as one vector path ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)) |
| `bill.ts`, `slip.ts`, `bill-fonts.ts` | A QR-bill's slip as SIX lays it out, in the Liberation Sans the package ships in `fonts/`; `bill-fonts.ts` is those faces for the browser entry's chunk ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `epc.ts` | An EPC QR code encoded once by uqr at level M and drawn as a QR code is; with Austria's caption, in the PSA's frame at the least version that prints, the caption in the same Liberation Sans, laid out by report-spec's `epc-print.ts` ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |

### `@formancy/report-data-provider` (L3)

`readReportData(client, report, binding, options)` reads a report's data
from Formancy Data 0.1.0 through a client the host made, with the host's
token. `binding.ts` holds everything it can check before it reads a record —
the bindings, the fields the person may read, the list the detail form
offers — and `read.ts` the reads themselves: the header record, the detail
rows a page at a time, each lookup's labels. The data it hands over says
`best-effort` ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).

### `@formancy/report-builder-core` (L2)

The editor model: `createReportEditor` makes one person's view of a session
— selection, zoom, the open pane, a drag, hidden panes — and derives from
the document everything a builder shows
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md)).

| Module | Responsibility |
|---|---|
| `editor.ts`, `state.ts`, `model.ts` | The frozen state both builders render, and the actions they send back |
| `outline.ts`, `palette.ts`, `properties.ts`, `property-fields.ts` | The tree a keyboard walks, what may be inserted, and each property as a field whose typed value becomes a command. An EPC payment code's fields stand in the order the code holds its elements, and a new one's square is one every payload the EPC allows prints in, with Austria's frame and without ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `geometry.ts`, `targets.ts` | The design view's layout and zoom, and drop targets from report-core's `validLocations` |
| `keys.ts`, `edits.ts` | `actionForKey`: which key does what, decided once for both builders |
| `text.ts` and `text-*.ts` | Every word, in English, Swiss German and Swiss French |
| `parts.ts` | The `data-report-part` hooks both builders render and `report-builder.css` dresses through the workbench's `--wb-*` variables |
| `scenarios.ts` | `BUILDER_SCENARIOS`: what every builder must do, as data, found by role and accessible name |

### `@formancy/report-builder-react` and `@formancy/report-builder-angular` (L3)

Structurally parallel, and written twice on purpose. Each renders the state,
dispatches actions and moves focus, which only a builder can know about.

| Concern | React | Angular |
|---|---|---|
| Subscription | `use-editor-state.ts`, `useSyncExternalStore` | `editor-state.ts`, a signal; zoneless, `OnPush` |
| The whole editor | `report-builder.tsx` | `builder.ts`, and `root.ts` for a host that arranges the parts |
| Panes | `toolbar.tsx`, `outline.tsx`, `palette.tsx`, `canvas.tsx`, `properties.tsx`, `diagnostics.tsx`, `places.tsx` | `toolbar.ts`, `outline.ts`, `palette.ts`, `canvas.ts`, `properties.ts`, `problems.ts`, `places.ts`, `status.ts` |
| A pointer's drag | pointer events (`pointer-drag.ts`) | HTML drag and drop |
| Built by | tsdown | ng-packagr, finished by `scripts/finalize-angular-dist.mjs` |

Neither ships a stylesheet. The drag is the one behaviour bound differently:
both resolve the pointer through the model, but a touch device gets no drag
in Angular ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).

### `@formancy/report-corpus`

Private test support. The fixtures are reports an engine must render or
refuse — a long table, a row taller than a page, a group ending at a page
boundary, exact decimals, text outside ASCII, an oversized job — each with
what its PDF must show, derived from the document. `read-pdf.ts` reads a
PDF back with PDF.js, each run with the way it reads, so that a turned run,
an EPC QR code's caption, is boxed where it stands; `checks.ts` and
`check-*.ts` judge it, `raster.ts` draws a page and `codes.ts` decodes its
QR codes with ZXing
([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
[0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
`starters/` holds the starter reports with their synthetic data, the
invoice with its QR-bill and the euro invoice with its EPC QR code among
them (`starters/euro-invoice.ts`), and the invoice's samples in four
languages
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
0025).
`trial/` keeps the renderer trial's adapters for pdfmake and pdfme as the
record of the trial
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).

### The applications

**`apps/studio`** is the playground: one report session and one editor per
starter (`workspace.ts`), either builder over it (`builder/`), and the
Preview, which resolves the session's document and prints it with the
renderer's browser entry, drawn by PDF.js on white paper (`preview/`). It
wears formancy.ai's room: `styles/room.css` copies admin.css's variables
under a marking comment, and the builder is recoloured only through the
workbench's variables
([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
Its `scripts/` hold the browser gate and the README pictures' walk.

**`apps/pages`** is the product's pages, prerendered by React's
`renderToStaticMarkup` into static HTML in German, French, Italian and
English. `src/groups.ts` is the list of pages; `scripts/inputs.mjs` reads
the release, the licence's terms and the faces from this repository's files
when it builds; `src/checks/` hold every page's head, links, words and
sitemap ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
[0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).

### The repository's scripts

Not a package, and not shipped: the guards `pnpm test:repo` runs
(`scripts/*.test.mjs`), the install gate (`install-test.mjs`,
`install-hosts.mjs`, `install-fixture/`), the release report
(`release-report/`) and a release's pins (`release/`), the licence and
dependency guards, the demo's deploy (`demo.mjs`) and the pictures
(`pictures.mjs`, `pictures/`). [Verification](10-verification.md) says what
each gate proves.
