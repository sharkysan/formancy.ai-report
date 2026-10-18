# 5. Building blocks

## Level 1 — the layers

Dependencies point downward only. The two packages at L2 do not know each
other: one path prints a report, the other edits one.

```
apps   studio                  the playground: both builders, the PDF, PDF.js        private
       pages                   the product's pages, static HTML                      private
────────────────────────────────────────────────────────────────────────────────────────────
L3     report-render-pdf       pdfmake · uqr · a Node entry and a browser entry
                               an e-invoice drawn as a PDF/A-3b that embeds its XML
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
                               the payment codes' rules: SIX's and the EPC's;
                               EN 16931's, for an e-invoice; an SVG asset's

beside report-corpus           private test support: the fixtures, the PDF reader and its
                               checks, readCodes, an SVG's drawings and their ink, a reader
                               of a PDF's objects and its XMP, the starters and samples, a
                               reader of the e-invoice's XML; over the runtime
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
| `@formancy/report-render-pdf` | `report-runtime` | `pdfmake`, `uqr` | — | Of this repository's packages, the runtime alone, which re-exports what the renderer needs of the format: report-spec's own rules for the slip and for how an EPC QR code prints ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)), the names an e-invoice's file is embedded by ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)), and `checkSvg`, the check an SVG asset is drawn by ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)). A resolved document and approved bytes in, never a database or an address ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)); an e-invoice's PDF/A also embeds the ICC profile PDFKit, pdfmake's own dependency, reads from its package, which `scripts/dependency-licences.mjs` holds to a review by its digest ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| `@formancy/report-data-provider` | `report-runtime`, `report-spec` | `@formancy/data-client` | — | The only package that may depend on Formancy Data; `scripts/dependency-licences.mjs` refuses Data reached from any other ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)). The DOM's globals and no `@types/node`, so a `node:` import does not compile |
| `@formancy/report-builder-react` | `report-builder-core`, `report-core`, `report-spec` | — | `react`, `react-dom` | The core packages and React, never Angular or the other builder ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-builder-angular` | `report-builder-core`, `report-core`, `report-spec` | `tslib` | `@angular/core` | The core packages and Angular; `src/dependencies.test.ts` fails on React anywhere in its closure ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-corpus` | `report-runtime` | `pdfjs-dist`, `zxing-wasm`, `saxes`, `@pdfme/pdf-lib` | — | Private, never published: test support ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)). saxes reads the XML the runtime writes, a parser that is not the writer, in the corpus's tests and, resolved from the corpus, in the e-invoice gate's scripts (0027), and a PDF's XMP. pdf-lib reads a PDF's own objects, a reader that is neither the pdfkit that writes them nor PDF.js, in the corpus's tests and the renderer's and, through the corpus's built index, in the e-invoice gate, which reads what each PDF embeds with it and records each PDF by its digest (0031) |
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
| `validate.ts` and `validate-*.ts` | Structural validation, every error with a JSON Pointer and a stable code (`errors.ts`): declarations, components and where each may stand, inlines and formats, the table, aggregates, the payment part, the EPC QR code and the e-invoice, the texts of all three read by `validate-payment-text.ts`. Kinds are tables, not switches |
| `check.ts` | Reading untrusted input once, through property descriptors, so a getter never runs and a value cannot answer differently when asked again |
| `limits.ts` | Every bound a definition is held to, each with its reason, and an SVG asset's, each with how it was measured, on what and when |
| `units.ts`, `page.ts` | The one conversion between millimetres and points, and the page geometry the validator, the builder's rulers and the renderer read |
| `hash.ts` | `@formancy/spec`'s `schemaHash` over an envelope naming the format, only of a report the validator reads |
| `qr-bill.ts`, `payment-part.ts` | SIX's rules for a Swiss QR-bill as functions over text, and the slip's size and place: what the validator applies to literals and the runtime to data ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)). Its `isQrIban` is the QR-IBAN's range, which the EPC's rules read too |
| `payment-reference.ts` | What both payment codes check alike: the remainder modulo 97, an IBAN's check digits by it, and the creditor reference. `qr-bill.ts` and `epc-payload.ts` both read it; what only one code allows stays with that code's rules (0022, [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `epc-qr-code.ts`, `epc-payload.ts`, `sepa.ts` | The EPC QR code: its component; the EPC's rules for each of its fields, and its payload, as functions over text; and the countries of SEPA as one table, each with its IBAN's length and whether it is in the EEA. What the validator applies to literals and the runtime to data (0025) |
| `epc-print.ts` | How an EPC QR code prints: a module's side in its square, and, with Austria's caption, the frame, the caption, the modules' widths and the least version that prints. The validator asks it of a square, and the renderer of the version it encoded (0025) |
| `e-invoice.ts`, `en16931.ts` | The e-invoice: its block at the report's level, the names the page reads its totals by (`E_INVOICE_NAMES`), the names its file is embedded by (`FACTUR_X`, `FACTUR_X_PROFILES`), and the closed lists its codes come from (`UNIT_CODES`, `COUNTRY_CODES`, `VAT_PREFIXES`, `SCHEME_IDS`); and EN 16931's rules for each of its terms as functions over text, named by the business term and the rule and never by the value. What the validator applies to literals, as `invalid-e-invoice`, and the runtime to data. Its payment account and BIC are held by the EPC QR code's rules, `checkEpcIban` and `checkEpcBic`; `validate-e-invoice-report.ts` holds what it says of the report around it: its lines what the table over the detail dataset prints, a payment code paid to its account, a title a PDF/A's metadata can hold ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| `walk.ts` | The one walk of the components that the core's commands, the builder's outline and the runtime share |
| `svg.ts`, `svg-*.ts` | An SVG asset ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)): `cleanSvg`, which reads the file's bytes once where the asset is approved, removes and lists what never draws, refuses what would draw unsafely or otherwise than a browser draws it, and writes the rest in one canonical form; and `checkSvg`, which accepts only that form and says what it costs to draw and to paint. A tokenizer of its own, on bytes, with no `TextDecoder` and no DOM (`svg-syntax.ts`); what is kept, removed and refused as tables, not switches (`svg-allow.ts`); CSS and its cascade (`svg-style.ts`); the costs `MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS` bound (`svg-cost.ts`); the extent, how far the numbers the converter writes for a drawing reach wherever it is placed and how deep it nests, which the renderer holds an e-invoice's SVG to and nothing here refuses by (`svg-extent.ts`); and the writer, which builds from its own tree and never copies the input (`svg-write.ts`) |

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
| `expressions/` | `compileReport`: every expression compiled where it stands, each member checked as its type, the clock, doubles, division and `matches()` refused, and the order aggregates are computed in ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)). In a report with an e-invoice, and in no other, `invoice`, `vatBasis` and `vatAmount` are bound wherever `totals` is, and refused where they are computed from (`expressions/e-invoice.ts`, 0027) |
| `diagnostics/` | What an editor shows about a valid report: the errors the runtime would refuse it for, and warnings an author probably wants; in an e-invoice, a total the XML holds that the page does not print, or prints otherwise than the XML holds it (`diagnostics/e-invoice.ts`, 0027) |

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
| `lower.ts`, `lower-table.ts`, `images.ts` | The components lowered to blocks; images through the host's lookup, once per render, an SVG's answer refused past `MAX_SVG_BYTES` before it is copied (0030) |
| `qr-bill.ts`, `lower-payment-part.ts` | A QR-bill's payload and every text its slip prints, held to report-spec's rules once the data has resolved them ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `lower-epc-qr-code.ts` | An EPC QR code's payload: each text read as a paragraph's and held to report-spec's rules once the data has resolved it, an optional one that prints nothing left unused, and the whole held to the EPC's bytes ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `lower-e-invoice.ts`, `e-invoice-lines.ts`, `e-invoice-totals.ts`, `e-invoice-terms.ts`, `e-invoice-payable.ts` | An e-invoice, after the aggregates and before anything is lowered: its lines read once from the rows of the table that prints them, the table printing the very values kept; its totals and VAT breakdown computed once, in `Decimal`, each category's VAT rounded once and never per line; its other terms held to report-spec's rules once the data has resolved them; and, while the codes are lowered, a payment code printed with it held to the amount due and the account ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| `cii.ts`, `cii-parties.ts`, `xml.ts` | The CII XML a final render writes from those values, each element in the profile XSD's order and at the path CEN's binding gives its term, written one way, so that the same report and data are the same bytes. A preview writes none (0027) |
| `document.ts` | The renderer-neutral document, the refusal codes, and `MAX_ASSET_BYTES`; and an e-invoice's file: its XML, with the name, relationship and conformance level it is to be embedded by |

### `@formancy/report-render-pdf` (L3)

`renderPdf` draws a resolved document with pdfmake, or rejects with a
`RenderRefusal` before any PDF is written
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
It is a package boundary, not an engine interface: there is one engine.

| Module | Responsibility |
|---|---|
| `node.ts`, `browser.ts`, `engine.ts` | The two entries: pdfmake's Node build reading font files, or its browser build reading virtual ones. Only that differs. Each hands PDFKit's document, laid out and not yet ended, to the final pass's `finish`, the one hook an e-invoice is embedded through ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)). The browser entry imports Liberation Sans's chunk with the first document that has a QR-bill or a captioned EPC QR code, and never for a document with neither, which `report-render-pdf/src/browser.test.ts` holds ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `render.ts` | The passes, each a pdfmake layout: measure the page regions, measure kept blocks and table rows, then lay out the PDF, with an abort read between them; an e-invoice's file and XMP are added on that last pass alone |
| `check.ts`, `glyphs.ts`, `widths.ts`, `assets.ts` | What is refused before pdfmake sees the document: a character without a glyph, what is malformed or wider than where it stands, image bytes that are not what they say, an SVG not in the form `cleanSvg` writes, and SVGs past what a render may draw (`MAX_SVG_DRAWING`, an image in a page region counted on every page) or a page may cost a reader (0030); and in an e-invoice, a CMYK JPEG, which its PDF/A cannot hold beside its sRGB output intent |
| `bound.ts`, and `check.ts`'s `refuseTall` | What is refused between the passes, once the page regions are measured: a block of fixed height or a line taller than a page's body, and a body whose least height already needs more pages than the limit |
| `words.ts` | What is refused inside every pass, once pdfmake has measured the words and before it lays out a line: a word wider than its table column, or longer than `MAX_WORD_LINES` lines of its paragraph, read from pdfmake's own `_minWidth` ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| `breaks.ts`, `table.ts`, `table-rules.ts` | Where a table's pages break, planned from measured heights, so a group header stays with its first row and totals with the last |
| `qr.ts` | A QR code encoded once by uqr and drawn as one vector path ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)) |
| `bill.ts`, `slip.ts`, `bill-fonts.ts` | A QR-bill's slip as SIX lays it out, in the Liberation Sans the package ships in `fonts/`; `bill-fonts.ts` is those faces for the browser entry's chunk ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `e-invoice.ts`, `pdfa.ts` | An e-invoice the renderer knows, and how it is drawn. `checkEInvoice` refuses, as `unsupported` and before pdfmake sees the document, a file whose name, relationship or conformance level is not report-spec's, XML holding a lone surrogate, and a title PDFKit cannot write into the XMP ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)). `pdfa.ts` makes the document a PDF/A-3b (`PDF_A_3B`) and, through the final pass's hook, embeds the runtime's XML as `factur-x.xml`, changed in nothing, and appends the fx properties and their extension schema to PDFKit's XMP; every other report is drawn as it was ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| `svg-pdfa.ts` | An SVG in an e-invoice: every number the converter will write for an image of one bounded from above, from report-spec's extent, the box and the page, and the image refused as `unsupported`, naming it, past the integers a PDF/A-3 holds less a margin for rounding, or past its 28 graphics states; every other report draws it as before ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| `svg-content.ts` | An SVG asset as pdfmake's node: the approved text unchanged, held to the renderer's own list of the elements that form holds, with the converter's `xMidYMid meet` for `contain` and `xMidYMid slice` for `cover`, and an image and a warning callback that refuse the asset ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)) |
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
— selection, zoom, the open pane, a drag, hidden panes, and a host's view
the host names, shown or not, in the design view's place or beside the
builder — and derives from the document everything a builder shows
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md),
[0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).

| Module | Responsibility |
|---|---|
| `editor.ts`, `state.ts`, `model.ts` | The frozen state both builders render, and the actions they send back |
| `outline.ts`, `palette.ts`, `properties.ts`, `property-fields.ts` | The tree a keyboard walks, what may be inserted, and each property as a field whose typed value becomes a command. An EPC payment code's fields stand in the order the code holds its elements, and a new one's square is one every payload the EPC allows prints in, with Austria's frame and without ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `geometry.ts`, `targets.ts` | The design view's layout and zoom, and drop targets from report-core's `validLocations` |
| `keys.ts`, `edits.ts` | `actionForKey`: which key does what, decided once for both builders |
| `text.ts` and `text-*.ts` | Every word, in English, Swiss German and Swiss French |
| `parts.ts` | The `data-report-part` hooks both builders render and `report-builder.css` dresses through the workbench's `--wb-*` variables; `view`, the region a host's view stands in, it does not dress |
| `scenarios.ts` | `BUILDER_SCENARIOS`: what every builder must do, as data, found by role and accessible name |

### `@formancy/report-builder-react` and `@formancy/report-builder-angular` (L3)

Structurally parallel, and written twice on purpose. Each renders the state,
dispatches actions and moves focus, which only a builder can know about.

| Concern | React | Angular |
|---|---|---|
| Subscription | `use-editor-state.ts`, `useSyncExternalStore` | `editor-state.ts`, a signal; zoneless, `OnPush` |
| The whole editor | `report-builder.tsx`, whose `hostView` prop is the host's view | `builder.ts`, and `root.ts` for a host that arranges the parts; `host-view.ts`, the `reportHostView` template a host gives its view as |
| Panes | `toolbar.tsx`, `outline.tsx`, `palette.tsx`, `canvas.tsx`, `properties.tsx`, `diagnostics.tsx`, `places.tsx` | `toolbar.ts`, `outline.ts`, `palette.ts`, `canvas.ts`, `properties.ts`, `problems.ts`, `places.ts`, `status.ts` |
| A pointer's drag | pointer events (`pointer-drag.ts`) | HTML drag and drop |
| Built by | tsdown | ng-packagr, finished by `scripts/finalize-angular-dist.mjs` |

Neither ships a stylesheet. The drag is the one behaviour bound differently:
both resolve the pointer through the model, but a touch device gets no drag
in Angular ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).
While the state's `view` is the host's, each draws a bare region in the
design view's place, named after the host's view, with no workbench class,
and leaves the keys pressed in it to the host ([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).

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
What a PDF says of itself is read by a second reader, `objects.ts`, with
@pdfme/pdf-lib, which shares no code with the pdfkit that writes it or
with PDF.js: its version, information dictionary and trailer /ID, the
files on the catalog's /AF and in its /Names /EmbeddedFiles tree, each
with its specification's keys, its stream's and its bytes, and its output
intents with their profiles' bytes. It refuses an encrypted PDF and a
name tree with /Kids, which it does not walk. `read-pdf.ts` reads the files
the name tree names too, so that a file's bytes come from two readers, and
`xmp.ts` reads the XMP strictly with saxes, each property by its namespace
and with its prefix. `objects.ts`'s `inflatedDigest` hashes a PDF's objects
with every stream inflated, a JPEG's read as it is, so that two PDFs whose
zlibs deflated one document otherwise hash alike: the e-invoice gate's
record, and the renderer's two entries held to one. `image-kinds.ts`
makes, in code, an image of each kind PDFKit embeds in a way of its own,
which the e-invoice gate draws into an e-invoice and the renderer's tests
draw into one
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
`numbers.ts`'s `readPdfNumbers` reads every number a PDF writes, in its
objects as pdf-lib parses them and in its content streams token by token,
each an integer or a real as it is written: what a PDF/A holds an integer
to, which veraPDF does not read in a soft mask's group, and which the renderer's
tests hold an e-invoice's SVG to (0030).

An SVG image is no image object, so `operators.ts` walks each page's
operators for its painted paths, their paint and the rectangular clip each
was painted inside, skipping what a soft mask paints; `drawings.ts` finds
each expected drawing as a clip of its size with paint inside it;
`check-ink.ts` holds a band of the page's pixels around each drawing to
white; `annotations.ts` reads every link a page carries; and
`fixtures/svg.ts` holds the SVG fixtures, in the bytes `cleanSvg` writes,
and `SVG_BOUND`, a drawing at each bound an e-invoice holds an SVG to, with
the smallest box the renderer draws it in, apart from `ALL_FIXTURES`, the
corpus the renderer trial ran on
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
`starters/` holds the starter reports with their synthetic data, the
invoice with its QR-bill and the euro invoice with its EPC QR code among
them (`starters/euro-invoice.ts`), and the samples of those two: the
QR-bill's invoice in four languages
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
0025), and the euro invoice from Austria, France, Italy, Spain, the
Netherlands and Ireland beside its German starter, one report made for
each country from the words it prints (`starters/euro-invoice-words.ts`)
and from whom it bills, at what rate and to which account, each source
cited and dated (`starters/euro-invoice-countries.ts`)
([0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
Beside them, three e-invoice samples, not starters: the German euro
invoice's firm invoicing German businesses, put together from the parts of
the euro invoice's head, table and bank details that
`starters/euro-invoice.ts` exports, with Germany's billing and words
(`starters/e-invoice.ts`,
[0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
`testing/cii.ts` reads the XML the runtime writes of them back with saxes,
by namespace, for their tests and, through the index, for the renderer's,
which read it out of the PDF they print.
`trial/` keeps the renderer trial's adapters for pdfmake and pdfme as the
record of the trial
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).

### The applications

**`apps/studio`** is the playground: one report session and one editor per
starter (`workspace.ts`), either builder over it (`builder/`), and the
Preview, which resolves the session's document and prints it with the
renderer's browser entry, drawn by PDF.js on white paper (`preview/`).
`layout.ts` says where the Preview stands: beside the builder in a window
wide enough for the design view to hold a page beside it, and in the
builder's middle, as the editor's host view, in any other; the workspace
tells every editor it holds as the window crosses that width
([0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md),
[0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)). It
wears formancy.ai's room: `styles/room.css` copies admin.css's variables
under a marking comment, and the builder is recoloured only through the
workbench's variables
([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
Its `scripts/` hold the browser gate and the README pictures' walk.

**`apps/pages`** is the product's pages, prerendered by React's
`renderToStaticMarkup` into static HTML in German, French, Italian and
English. `src/groups.ts` is the list of pages, among them a page for each
payment code that shows its invoice's samples; `scripts/inputs.mjs` reads
the release, the licence's terms and the faces from this repository's files
when it builds; `src/checks/` hold every page's head, links, words and
sitemap ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
[0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).
A page whose code no release has carries its status, written against the
release then, and `src/site.tsx` reads every page's before it renders any
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
[0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).

### The repository's scripts

Not a package, and not shipped: the guards `pnpm test:repo` runs
(`scripts/*.test.mjs`), the install gate (`install-test.mjs`,
`install-hosts.mjs`, `install-fixture/`), the release report
(`release-report/`) and a release's pins (`release/`), the licence and
dependency guards, the demo's deploy (`demo.mjs`) and the pictures
(`pictures.mjs`, `pictures/`). [Verification](10-verification.md) says what
each gate proves.
