# 5. Building blocks

## Level 1 — the layers

![A hand-drawn sketch of Formancy Report's packages on a dark background, in four columns, Edit, Print, Data in and Serve: the Studio and the product pages at the top; the MCP server for a coding agent below them; the builders, the two renderers, the test support, the form bridge, the data provider, the server and its client below that; then report-builder-core, report-runtime and report-server-core; report-core; and report-spec and report-documents at the bottom. The editing column is violet, the printing column teal, and what is never published is dashed](../images/architecture.svg)

The sketch, drawn by hand, shows each package and app in its layer, the
test support above the runtime it reads rather than beside the layers as
the drawing below sets it, violet what a person edits with, teal what
decides and prints a document, and dashed what is never published.
`scripts/architecture.test.mjs` fails when a workspace package or app is
not in it or is drawn hidden, off its canvas or by reference, when a box
is dashed otherwise than its manifest is private, when a package is drawn
beside or below one its manifest depends on, and when a colour of it is
not the installed room's of its name; not when a box stands in another
column, or its words leave it in a reader's own face, which review holds
([0079](../decisions/0079-every-starters-pdf-and-word-file-are-committed-as-samples-held-to-the-build-and-the-readme-draws-every-package-in-a-sketch.md)).

Dependencies point downward only. The two packages at L2 do not know each
other: one path prints a report, the other edits one.

```
apps   studio                  the playground: both builders, the PDF, PDF.js        private
       pages                   the product's pages, static HTML                      private
────────────────────────────────────────────────────────────────────────────────────────────
L4     report-mcp              @modelcontextprotocol/sdk · zod · Node: Report's checks for a
                               coding agent, over stdio; publishes nothing, takes no address
────────────────────────────────────────────────────────────────────────────────────────────
L3     report-render-pdf       pdfmake · pdfkit · echarts · zrender · a Node entry and a browser entry
                               an e-invoice drawn as a PDF/A-3b that embeds its XML;
                               a chart laid out by ECharts, drawn by pdfmake
       report-render-docx      fflate, pako · the same document written as a Word file,
                               the same bytes each time; what belongs to its PDF refused whole;
                               a code a picture of the symbol the runtime decides
                               no framework, no DOM, no Node, no network
       report-data-provider    @formancy/data-client: the one door to Data's records
       report-forms            @formancy/spec's validator: a form's submissions, handed over;
                               a report generated from a form version; a new version
                               reviewed, its resolutions report-core's commands as data
       report-server           Fastify · @formancy/data-identity: whoami, by the host's token;
                               a template's draft and its images, in files on one volume
       report-client           the host's fetch · DOM: the server's routes, for a host's page
       report-builder-react    React · DOM            ┐ never each other,
       report-builder-angular  Angular · DOM          ┘ never the other framework
────────────────────────────────────────────────────────────────────────────────────────────
L2     report-runtime          every value decided once        no framework, no engine, no Node
                               uqr · a code's symbol, and what refuses one, for every engine
       report-builder-core     the editor model                no framework, no DOM, no Node
       report-server-core      who may do what · the wire      no framework, no DOM, no Node
                               · the draft's and the images' use cases, over a store's port
────────────────────────────────────────────────────────────────────────────────────────────
L1     report-core             commands · session · compileReport · @formancy/expressions
────────────────────────────────────────────────────────────────────────────────────────────
L0     report-documents        the one PDF reader: read whole or refused · the parser, pako
                               no framework, no DOM, no Node, no network
       report-spec             the format · validation · hash · @formancy/spec
                               the payment codes' rules: SIX's and the EPC's;
                               EN 16931's, for an e-invoice; an SVG asset's

beside report-corpus           private test support: the fixtures, the PDF reader and its
                               checks, readCodes, an SVG's drawings and their ink, a chart's
                               clip, marks and words, a reader of a PDF's objects and its
                               XMP, the starters and samples, a formancy form in two
                               versions, its submissions and a report generated from it, a
                               reader of the e-invoice's XML, a reader of a Word file and
                               its checks; over the runtime
```

Each row's three middle columns are its manifest's: what it depends on
among the workspace's packages, what else it installs, and its peers. Its
devDependencies are left out, so the corpus, every package's test support,
stands only where it is a dependency. The versions are the manifests'; the
README's [generated table](../../README.md#what-it-is-tested-with) gives
the upstream packages' and the peers' ranges.

| Package | Depends on, here | From elsewhere | Peers | What it may import, and what holds it |
|---|---|---|---|---|
| `@formancy/report-documents` | — | `@pdfme/pdf-lib`, the parser; `pako` | — | No framework, no DOM, no Node, no network: ES2023's library and no `@types/node`, so a `node:` import, a `fetch` or a `DecompressionStream` does not compile. The one PDF reader ([0054](../decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)): the runtime, the renderer, the server and the builders are to read a PDF through it and through no other code, and the corpus proves pages with PDF.js, which shares no code with it. It reads a PDF whole or refuses it, by `readDocument`, and says whether bytes are a PDF, by `isPdf`; nothing calls it yet, and it depends on no other package of this repository. The parser is `@pdfme/pdf-lib` at exactly 6.2.4 and `pako` at exactly 3.0.2, both permissive, which `scripts/dependency-licences.mjs` holds, and no pdf-lib type leaves the package, which `scripts/documents-declarations.test.mjs` holds of its built declarations |
| `@formancy/report-spec` | — | `@formancy/spec`, for the hash; `@noble/hashes`, for an asset's SHA-256 where it is added | — | No framework, no PDF engine, no Node: the format names no engine ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)). ES2023's library and no `@types/node`, so a DOM or Node global does not compile |
| `@formancy/report-core` | `report-spec` | `@formancy/expressions` | — | Those two and nothing else, with the same compile-time rule ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), [formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md)) |
| `@formancy/report-runtime` | `report-core`, `report-spec` | `@formancy/expressions`, `uqr` | — | No framework, no PDF engine, no Node, by the same rule; report-core for the one compilation it shares with the editor ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)). `uqr` at exactly 0.1.3, MIT, with no dependency of its own, which `scripts/dependency-licences.mjs` judges as any package: it encodes the symbol every engine draws a code from, so that one package decides a code and pins its encoder, and neither engine depends on it ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)) |
| `@formancy/report-builder-core` | `report-core`, `report-spec` | — | — | Those two, nothing else; no framework, no DOM, no Node ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-render-pdf` | `report-runtime` | `pdfmake`, `pdfkit`, `echarts`, `zrender` | — | `echarts` and `zrender`, each at exactly 6.1.0, which `scripts/dependency-licences.mjs` admits for it alone, by the digest of the licence files a review read: no published package but the renderer depends on either itself, and a package that depends on the renderer reaches them through it, which the renderer loads only for a chart with something to draw; what a bundle holds is a build's to show, and the Studio's `notices.test.ts` builds the renderer's browser entry and finds one ECharts and one zrender, in the chunk it imports dynamically alone, while no test yet holds a builder's bundle to holding neither [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md); of this repository's packages, the runtime alone, which decides the symbol of every code the renderer draws, and what refuses one ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)), and re-exports what the renderer needs of the format: report-spec's own rules for the slip and for how an EPC QR code prints ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)), the names an e-invoice's file is embedded by ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)), and `checkSvg`, the check an SVG asset is drawn by ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)), and report-spec's font reader, which its faces' glyphs are read by ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)), and `readFont`, `characterMap` and `refusedCharacter`, which a host's fonts are read, embedded and held to ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)). A resolved document and approved bytes in, never a database or an address ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)); an e-invoice's PDF/A also embeds the ICC profile PDFKit, pdfmake's own dependency, reads from its package, which `scripts/dependency-licences.mjs` holds to a review by its digest ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| `@formancy/report-render-docx` | `report-runtime` | `fflate`, `pako` | — | No framework, no DOM, no Node, no network: ES2023's library and no `@types/node`, so a `node:` import or a DOM global does not compile, and neither library's declarations need either. The Word writer ([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)): a resolved document in, a Word file's bytes out, or the runtime's `RenderRefusal`. Of this repository's packages, the runtime alone, which hands on what the writer needs of the format: `sniffImage`, `imageHeader` and `checkSvg`, which a picture's bytes are read by, `readFont`, by which a mapped face's family and characters are known, and `refusedCharacter`; and which decides the symbol of every code the writer draws, by the rule the PDF renderer asks ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)). Never the PDF renderer, which would bring pdfmake and ECharts with it: what the two engines must agree on is stated in both and held together by `against-pdf.test.ts`, the renderer a devDependency of that suite alone. `fflate` at exactly 0.8.3, MIT, with no dependency of its own, which `scripts/dependency-licences.mjs` judges as any package; the writer zips with its synchronous half alone, the same code in the file fflate serves Node and the one it serves every other host. And `pako` at exactly 3.0.2, MIT and Zlib, with none either, judged the same way: a port of zlib's inflate, which reads a PNG's image data as the platform's decompressor reads it for the PDF renderer, so that what is no stream to the one is none to the other; report-documents inflates with it too |
| `@formancy/report-data-provider` | `report-runtime`, `report-spec` | `@formancy/data-client` | — | The only package that may depend on Formancy Data; `scripts/dependency-licences.mjs` refuses Data reached from any other ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)). The DOM's globals and no `@types/node`, so a `node:` import does not compile |
| `@formancy/report-forms` | `report-core`, `report-runtime`, `report-spec` | `@formancy/spec`, for its validator, the version hash, labels, rich text and the diff, at the release the repository pins | — | The DOM's globals and no `@types/node`, as the Data provider, so a `node:` import does not compile; nothing reaches the network: a host hands each form version and submission over ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)), each form version a report is generated from ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)), and each a review compares a new one with; report-core because a review's resolutions are its commands, judged by its session and its compiler ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)). It never depends on Formancy Data, which `scripts/dependency-licences.mjs` refuses from any package but the provider |
| `@formancy/report-server-core` | `report-spec` | — | — | No framework, no DOM, no Node: ES2023's library and no `@types/node`, so a `node:` import or a `fetch` does not compile. The actions table, the identity it is asked about, the wire a client compiles against and the audit port ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)), and the use cases that decide a tenant's drafts and images over `TemplateStore`, a port with no store behind it here ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)). Of this repository's packages, report-spec alone: the types the wire and the port name, and the functions the use cases judge a draft and an image by -- `validateReport`, `isIdentifier`, `isDigest`, `isFontMediaType`, `sniffImage`, `imageHeader`, `checkSvg`, `assetDigest` and the limits -- so that what a server stores is what the format accepts, decided by the format |
| `@formancy/report-server` | `report-server-core`, `report-spec` | `fastify`, `@fastify/rate-limit`, `@formancy/data-identity` | — | Node and Fastify; Formancy Data's identity verifier at exactly 0.5.0, the one Data package it may depend on, which `scripts/dependency-licences.mjs` admits for it alone ([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)); report-spec for the identifier rule the file store holds a template id to, the use cases' own, and for the body limits and parsers of the draft's routes, `MAX_REPORT_BYTES`, `MAX_ASSET_BYTES` and `ASSET_MEDIA_TYPES`. Never the runtime or the renderer, which its install host, holding only what it declares, would fail on; `src/composition.test.ts` fails on any module but `main.ts` that reads the environment or a file, the file store aside, which reaches its records through `node:fs/promises` alone (0046) |
| `@formancy/report-client` | `report-server-core`, `report-spec` | — | — | The DOM's globals and no `@types/node`, as the Data provider, so a `node:` import in its source does not compile; its suite alone has Node's types, to run the server it asks. report-server-core for the routes it asks, by `ROUTES`' own keys, and the wire types it answers with; report-spec for the media types an image's answer is held to and the two types its methods name. It reaches the network through the `fetch` a host gives it, at the `server` it is given, and follows no redirect. Never the server, a builder or the runtime: the install gate checks it in a browser's host of its own, against the DOM's types alone, bundles it for a browser there, and runs it against the packed server in the server's host |
| `@formancy/report-mcp` | `report-core`, `report-spec` | `@modelcontextprotocol/sdk`, `zod` | — | Node, and a `bin`, `formancy-report-mcp`, which a coding agent's client launches over stdio ([0088](../decisions/0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md)). report-spec's validator and hash and report-core's facts, registry, session and diagnostics are every verdict it gives, so it judges a report no way the builders, a save and a render do not; the SDK at exactly 1.32.2 and zod, its peer, at exactly 4.6.7, both MIT, and the SDK's closure, which carries its HTTP transports, judged as any package by `scripts/dependency-licences.mjs`. `main.ts` alone touches the process, and no module the network, which `src/composition.test.ts` holds; no tool takes an address, a path or a file, which `src/server.test.ts` holds. Never the runtime, the renderer, the server or a builder yet: a render check and the tools that need a server are to bring the runtime, the renderer and the client, and stand it above them |
| `@formancy/report-builder-react` | `report-builder-core`, `report-core`, `report-spec` | — | `react`, `react-dom` | The core packages and React, never Angular or the other builder ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-builder-angular` | `report-builder-core`, `report-core`, `report-spec` | `tslib` | `@angular/core` | The core packages and Angular; `src/dependencies.test.ts` fails on React anywhere in its closure ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-corpus` | `report-runtime` | `pdfjs-dist`, `zxing-wasm`, `saxes`, `@pdfme/pdf-lib` | — | Private, never published: test support ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)). saxes reads the XML the runtime writes, a parser that is not the writer, in the corpus's tests and, resolved from the corpus, in the e-invoice gate's scripts (0027), and a PDF's XMP. pdf-lib reads a PDF's own objects, a reader that is neither the pdfkit that writes them nor PDF.js, in the corpus's tests and the renderer's and, through the corpus's built index, in the e-invoice gate, which reads what each PDF embeds with it and records each PDF by its digest (0031) |
| `apps/studio` (`@formancy/report-studio`) | `report-spec`, `report-core`, `report-runtime`, `report-render-pdf`, `report-render-docx`, `report-builder-core`, `report-builder-react`, `report-builder-angular`: every package but the provider; and `report-corpus`, for its starters | `react`, `react-dom`, `@angular/core`, `@angular/common`, `@angular/platform-browser`, `rxjs`, `pdfjs-dist`, `@formancy/themes`, and the faces: `@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | — | Private; the PDF.js viewer lives here and in no published package ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)), and its faces are its own copies ([0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)) |
| `apps/pages` (`@formancy/report-pages`) | — | `react` and `react-dom`, for the server renderer; `@formancy/themes`, for formancy's room; and the faces: `@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | — | Private; formancy's room and the Studio's stylesheets by import, and facts read from the repository's files when it builds ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md), [0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)). `report-spec` a devDependency alone, which no page imports: `limits.test.ts` reads its component kinds, the blocks it prints and `refusedCharacter` from its `dist`, to hold what the start page says Formancy Report does not do yet ([0056](../decisions/0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md)) |

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
| `definition.ts`, `styles.ts`, `data.ts`, `assets.ts`, `values.ts`, `aggregates.ts`, `components.ts`, `table.ts` | `ReportDefinition` at `reportSpecVersion` `'0'`, the draft, with its five regions, an optional sixth that page 1 prints in place of the page header (`OPTIONAL_REGIONS`, [0060](../decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)), and its provenance; and each part it declares in a module named for it: print styles, the datasets and parameters it reads, assets, values (expressions, formats and the runs of text), aggregates, components and the tables over the detail dataset, each with the condition that selects its rows, up to `MAX_TABLES` ([0062](../decisions/0062-a-report-holds-several-tables-over-its-detail-rows-each-printing-and-totalling-the-rows-its-condition-selects.md)). Its page is `page.ts`'s |
| `version.ts` | Whether a document is a report this package reads at all, before anything about what it holds; a form or another version is refused naming both ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)) |
| `validate.ts` and `validate-*.ts` | Structural validation, every error with a JSON Pointer and a stable code (`errors.ts`): declarations, components and where each may stand, inlines and formats, each table and its total rows in the `table` scope, aggregates, the payment part, the EPC QR code and the e-invoice, the texts of all three read by `validate-payment-text.ts`; and where a dataset is read from a formancy form's submissions, each field's data path, member and choice (`validate-form-binding.ts`, `isFormPath` in `syntax.ts`), the shape alone, which version holds what being report-forms' to say ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)), and a binding's overrides for one form version at a time, keyed by its hash, another path, nothing of a nullable field or another repeater ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)). Kinds are tables, not switches |
| `check.ts` | Reading untrusted input once, through property descriptors, so a getter never runs and a value cannot answer differently when asked again |
| `limits.ts` | Every bound a definition is held to, each with its reason; an image asset's bytes and pixels, which every reader of an image holds it to; and an SVG asset's and a font's, each with how it was measured, on what and when |
| `image-header.ts`, `digest.ts` | What an image's bytes are, by their first bytes alone (`sniffImage`), a PNG's or a JPEG's structure read whole but for a PNG's image data (`imageHeader`), and an asset's SHA-256 by `@noble/hashes` (`assetDigest`): what a builder reads of an image a person adds, and the renderer of one it prints, decided once ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)) |
| `units.ts`, `page.ts` | The one conversion between millimetres and points; and the page sizes and orientations the format names, each size beside its dimensions, and the page geometry the validator, the builder's rulers and the renderer read |
| `hash.ts` | `@formancy/spec`'s `schemaHash` over an envelope naming the format, only of a report the validator reads |
| `qr-bill.ts`, `payment-part.ts` | SIX's rules for a Swiss QR-bill as functions over text, and the slip's size and place: what the validator applies to literals and the runtime to data ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)). Its `isQrIban` is the QR-IBAN's range, which the EPC's rules read too; `QR_BILL_EXAMPLE_ACCOUNTS` and `QR_BILL_EXAMPLE` are SIX's example values, what a builder starts a bill from and report-core warns of ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) |
| `payment-reference.ts` | What both payment codes check alike: the remainder modulo 97, an IBAN's check digits by it, and the creditor reference. `qr-bill.ts` and `epc-payload.ts` both read it; what only one code allows stays with that code's rules (0022, [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `epc-qr-code.ts`, `epc-payload.ts`, `sepa.ts` | The EPC QR code: its component; the EPC's rules for each of its fields, and its payload, as functions over text; and the countries of SEPA as one table, each with its IBAN's length and whether it is in the EEA. What the validator applies to literals and the runtime to data (0025) |
| `epc-print.ts` | How an EPC QR code prints: a module's side in its square, and, with Austria's caption, the frame, the caption, the modules' widths and the least version that prints. The validator asks it of a square, and the renderer of the version it encoded (0025) |
| `e-invoice.ts`, `en16931.ts`, `en16931-*.ts` | The e-invoice: its block at the report's level, of two kinds, a Factur-X invoice or an XRechnung (`XRECHNUNG`, `XRECHNUNG_VERSIONS`, [0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)), the terms both hold (`EInvoiceTerms`), the names the page reads its totals by (`E_INVOICE_NAMES`), the names its file is embedded by (`FACTUR_X`, `FACTUR_X_PROFILES`), and the closed lists its codes come from (`UNIT_CODES`, `COUNTRY_CODES`, `VAT_PREFIXES`, `SCHEME_IDS`, and `ADDRESS_SCHEMES` for the parties' electronic addresses, [0037](../decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)); and EN 16931's rules for each of its terms as functions over text, named by the business term and the rule and never by the value: the rule ids and how a refusal names one in `en16931.ts`, and a module for each kind of term, its texts, decimals, dates, a line's terms and VAT. What the validator applies to literals, as `invalid-e-invoice`, and the runtime to data. Its payment account and BIC are held by the EPC QR code's rules, `checkEpcIban` and `checkEpcBic`; `validate-e-invoice-report.ts` holds what it says of the report around it: its lines what the table over the detail dataset prints, a payment code paid to its account, a title a PDF/A's metadata can hold ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| `xrechnung.ts` | What XRechnung asks that an e-invoice of either kind is held to already: the shapes of the seller's contact's telephone number and email address, BR-DE-27 and BR-DE-28, each the pinned schematron's own XPath expression (`XRECHNUNG_PATTERNS`), the email address's read as XPath reads it (`xpathRegExp`, which the package does not export) and the telephone number's as the count of digits it asks for, in time in proportion to a text's length; with their rule ids in a list of their own, `XRECHNUNG_RULES`. The e-invoice gate holds the ids, the expressions and the tests that read them to KoSIT's XRechnung schematron (0037). And what an XRechnung needs past EN 16931, refused where it is missing by the rule that needs it (`XRECHNUNG_NEEDS`, `XRECHNUNG_TEXT_NEEDS`), the payment terms that hold no Skonto line (`skontoBreak`, BR-DE-18), the rules held by the format alone (`XRECHNUNG_HELD`), and a Leitweg-ID's shape and check digits under scheme 0204, by `payment-reference.ts`'s `mod97` (`leitwegIdBreak`); `en16931-texts.ts` reads them as each kind's text rules (`E_INVOICE_KIND_TEXTS`) (0038) |
| `walk.ts` | The one walk of the components that the core's commands, the builder's outline and the runtime share, over the regions a report holds (`heldRegions`), so that page 1's own header is walked where a report has one and skipped where it has none (0060) |
| `translation.ts`, `report-in.ts` | A report's languages ([0063](../decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)): a translation's types; the one walk of its words, `reportWords`, and of the expression runs where words stand, every other string the format holds named as no word, with its reason, in `NOT_WORDS`, which its test alone reads; `renderLocale`, the report's own locale or a declared one exactly; and `reportIn` and `writtenIn`, the report written in one of its languages, its locale and its slip's language among it, which the validator (`validate-translations.ts`), the core, the runtime and the builders read it by |
| `font.ts`, `font-*.ts` | A font's bytes ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)): `readFont`, which reads a static TrueType font whole -- the names (`font-names.ts`), the embedding its OS/2 fsType allows and the fixed tables (`font-tables.ts`), the outlines walked for their structure (`font-outlines.ts`) -- or refuses it with one of `FONT_REFUSAL_CODES` and what to do (`font-refusal.ts`); and `characterMap`, the characters a font maps, read from the subtable fontkit takes, in format 4 or 12, as fontkit reads it (`font-cmap.ts`), which `readFont` reads too. Every read checked against the bytes, a table read where its record says and its recorded length read as fontkit reads it (`font-file.ts`), nothing recursing on what a font holds, and nothing the font chose in a refusal but a number the reader decoded; the horizontal header's line held to what pdfmake can lay out, `MIN_FONT_LINE` to `MAX_FONT_LINE` ems; the outlines' points, points times contours and composite components bounded together, what a subset of them costs PDFKit ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)). `font-test-support.ts` makes the tests' fonts from their tables and is never exported |
| `font-map.ts`, `font-scripts.ts` | The font map a report declares and the characters it prints ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)): the `FontMap` mapping each of `FONT_FAMILIES` to a `FontFaces` of asset ids, which `validate-font-map.ts` holds to the font assets they name, an image asset mapped a face refused `asset-not-a-font` and a style that sets bold or italic in a mapped family without that face `missing-face`; and the characters a report prints, by an allowlist of Unicode blocks from `Blocks.txt` 18.0.0 -- Latin, Greek and Cyrillic and the punctuation, symbols and marks written with them -- but for the bidirectional controls (`PRINTED_BLOCKS`, `BIDI_CONTROLS`, `refusedCharacter`), which the renderer applies in every face, every other script refused until a fixture proves it |
| `svg.ts`, `svg-*.ts` | An SVG asset ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)): `cleanSvg`, which reads the file's bytes once where the asset is approved, removes and lists what never draws, refuses what would draw unsafely or otherwise than a browser draws it, and writes the rest in one canonical form; and `checkSvg`, which accepts only that form and says what it costs to draw and to paint. A tokenizer of its own, on bytes, with no `TextDecoder` and no DOM (`svg-syntax.ts`); what is kept, removed and refused as tables, not switches (`svg-allow.ts`); CSS and its cascade (`svg-style.ts`); the costs `MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS` bound (`svg-cost.ts`); the extent, how far the numbers the converter writes for a drawing reach wherever it is placed and how deep it nests, which the renderer holds an e-invoice's SVG to and nothing here refuses by (`svg-extent.ts`); and the writer, which builds from its own tree and never copies the input (`svg-write.ts`) |

### `@formancy/report-documents` (L0)

The one PDF reader, which nothing calls yet
([0054](../decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)). `readDocument` reads a PDF's bytes whole,
synchronously, or refuses them: every bound held before the work it
bounds, the first refusal returned as it comes, nothing returned partly
read, and nothing thrown.

| Module | Responsibility |
|---|---|
| `read.ts` | `readDocument`, the one entry: the parse, the pages, the closure and the notices, in that order, each stage's first refusal returned as it comes and anything thrown made a refusal in the reader's own words (`caught`); what it returns frozen where JavaScript freezes |
| `parse.ts`, `xref.ts` | The strict loop: a Uint8Array of the host's realm and the byte bound first, then the header, the last `%%EOF` and `startxref`, and the last trailer's `/Encrypt`, read on the document's one count; every top-level object, table and stream read in order and nothing between them skipped; the cross-reference sections and their claims held to the bounds as each is met, before a row is read, chained from the last `startxref`; and every definition held to the entry the chain gives its number, a shadow refused, an object stream's members among them |
| `grammar.ts`, `reading.ts`, `model.ts`, `bytes.ts` | pdf-lib 6.2.4's `PDFObjectParser` with every token but the keywords read by the reader's own code -- names held flat, strings a view counted twice, numbers read once, references never through `PDFRef.of`, arrays and dictionaries built in the model -- each measured before it is copied, and one count of values a document; the neutral model, which no pdf-lib type leaves; byte searches that need no `Buffer` |
| `inflate.ts` | Every stage of every stream decoded from one budget: Flate by pako 3.0.2, raw after the zlib header, the Adler-32 not compared, its chunks sized to its input; ASCIIHex, ASCII85 and RunLength by pdf-lib's ports of PDF.js, refused before decoding where they could pass the budget; LZW, Crypt, a TIFF predictor and a filter PDF does not define refused; each decoder counted where it is built; a PNG predictor undone on every Flate stage it decodes, and refused where its rows are not as it says; a stream whose data is in another file, a form that stands in for another file's page (`/Ref`) and an image or a form that names one to print in its place (`/OPI`) refused unread |
| `page-tree.ts`, `pages.ts` | The page tree walked once, without recursion, each node once and each count held; each page's boxes, rotation, unit, resources and group, inherited in one pass, and its content joined and charged; layers in the catalog refused |
| `annotations.ts`, `annotation-subtypes.ts`, `notices.ts` | The print rule: an annotation that prints flattened as its appearance, each listing counted on the document's one count; one with no appearance, a link border a viewer would draw, NoRotate on a turned page, XFA and NeedAppearances refused, naming the page and the annotation by the reader's own count; what does not survive printing counted by code, never named |
| `closure.ts`, `images.ts` | Every object the pages draw with, walked without recursion, a container once for each way it is read and each walk after the first counted on the document's one count, a name map read by where it stands; a layer, and a resource that reaches a page, refused; an image held to its pixels by where it stands, never its `/Subtype`, once however often it is reached, and passed on undecoded |
| `inline-images.ts`, `inline-end.ts` | Each content lexed once for its inline images, each image's dictionary counted and held to the pixels bound, its data ended only where PDF.js 6.4.299 ends it (`MIRRORED_PDFJS`, in `inline-end.ts`, which imports `bytes.ts` alone, and which `scripts/mirrored-pdfjs.test.mjs` holds to the corpus's and the Studio's pin) |
| `limits.ts`, `refusals.ts`, `sniff.ts` | Every bound, each with how it was measured at it and one past it, or why it was chosen; the refusal codes, the fixed findings and each code's advice; and `isPdf`, a header at the first byte |

### `@formancy/report-core` (L1)

`openReportSession` holds one document, its revision and its history; every
change is a command that a session commits only when the validator accepts
the result ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).

| Module | Responsibility |
|---|---|
| `session.ts`, `snapshot.ts` | Commit, frozen snapshots sharing what did not change, undo and redo to `DEFAULT_HISTORY_LIMIT` steps, listeners, the stale-hash refusal |
| `draft.ts` | Several commands as one edit, and `tryEdit`: the verdict on a draft without committing it, which a proposal's review would show |
| `commands/` | Pure commands on the document, the components, the declarations, the table and the payment part, `addAsset` among them, which refuses an id already declared where `putAsset` would replace it, and `putPaymentPart`, `updatePaymentPart` and `removePaymentPart` (`commands/payment-part.ts`), which judge nothing of the bill, `addLanguage`, `removeLanguage`, `translateWord` and `translateExpression` (`commands/translations.ts`, 0063), and `putEInvoice`, `updateEInvoice`, `removeEInvoice` and `setPaymentAccount` (`commands/e-invoice.ts`), the last writing the account an e-invoice shares with its QR-bill and every EPC QR code into all of them in one edit, refused where one reads it from the data ([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)), and `putFirstPageHeader` and `removeFirstPageHeader` (`commands/first-page-header.ts`), which give page 1 a header of its own, or the page header back with what its own held, a place in the region refused as `not-found` while a report has none (0060); `registry.ts` makes each a descriptor a proposal can carry, its arguments checked before it runs, and lists in `PART_COMMANDS` the commands that may change a part of the report's own level, `replaceDocument` among them, every other keeping it ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)); `ids.ts` the one rule a new component's id, a copy's and an added asset's are made by (0033); `registry.ts`'s `batch`, several descriptors as one command, validated once at its end and refused whole, a step that throws on what the steps before it left refused, listed in `PART_COMMANDS` beside `replaceDocument`, and `commands/readers.ts`'s `removeFieldWithReaders`, a field with every component, column, style rule alone, footer cell and the row it leaves empty, sort key, group and aggregate that reads it, a field the bill or the e-invoice reads refused; its `fieldReaders`, that walk made once for many fields, the removal and the expressions a change of a field's type reaches ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)) |
| `facts.ts` | `reportFacts()`: what someone writing a report from nothing is told -- the format's vocabularies by report-spec's constants, the very objects, what an expression reads by `SCOPE_NAMES`, `EXPRESSION_NAMES` and `EXPRESSION_TYPES`, every diagnostic's code and severity, every limit report-spec exports as a bound under its constant's name, but those of a file and the validator's count of errors, which `facts.test.ts` names with why, and `NOTES`, each name in it typed against what it names, each number read from its constant, and each held by `facts-notes.test.ts` to what refuses what it says -- which the MCP's `describe_format` answers (0088); its sibling, `registry.ts`'s `describeCommands()`, every command of `COMMANDS` as a descriptor with its arguments in the words a refusal says them in |
| `locations.ts`, `tree.ts` | Where a component stands, and `validLocations`: the places it may go, found by trying each |
| `expressions/` | What an expression reads, asked of the parser the compiler asks, for the diagnostics and the removal alike (`expressions/reads.ts`, 0048); `compileReport`: every expression compiled where it stands, or those asked for alone with every aggregate's, as a review compiles what a change of one field's type reaches (0048), each member checked as its type, the clock, doubles, division and `matches()` refused, and the order aggregates are computed in ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)); `table` declared in a table's total rows and its group's header and footer, and a group's key typed by its own table's field (`members.groupKeys`, 0062). In a report with an e-invoice, and in no other, `invoice`, `vatBasis` and `vatAmount` are bound wherever `totals` is, and refused where they are computed from (`expressions/e-invoice.ts`, 0027) |
| `diagnostics/` | What an editor shows about a valid report: the errors the runtime would refuse it for, and warnings an author probably wants; in an e-invoice, a total the XML holds that the page does not print, or prints otherwise than the XML holds it (`diagnostics/e-invoice.ts`, 0027); and a QR-bill that holds, written in the report, one of report-spec's `QR_BILL_EXAMPLE_ACCOUNTS` or the creditor, the debtor or the QR reference of its `QR_BILL_EXAMPLE` (`diagnostics/example-payment-part.ts`, [0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)); a total of every detail row printed in the total rows of a table that selects its rows (`diagnostics/tables.ts`, 0062); and in each language a report declares, a word it lacks, a translated expression that differs from its source, and what the report written in it gives that its own does not, each naming its language (`diagnostics/words.ts`'s `languageDiagnostics`, whose `wordExpressions` the builders read, 0063). `diagnostics/parts.ts` is the one walk of what a report names: every expression where it stands, and every field and aggregate named outside one, where it is named (`named`), which the removal with readers reads (0048) |

### `@formancy/report-runtime` (L2)

`resolveReport` turns a report and its data into a `ResolvedDocument`, a
manifest and a preview's warnings, or every reason it will not
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
Each stage is a module, and each decides its question once:

| Module | Responsibility |
|---|---|
| `input.ts`, `data.ts`, `values.ts`, `parameters.ts` | The data contract: read once without running anything, every value held to its field's type, undeclared fields refused, bounded by `MAX_DETAIL_ROWS` |
| `source.ts` | Where the data came from, which the manifest carries: each submission of a formancy form with its form's id and the `schemaHash` of the version that collected it, or the Formancy Data form each dataset was read from; held to the syntax of identifiers, by report-spec's `isFormId` and `isSchemaHash`, the provenance's own rules, and a submission id's syntax of its own, `isSubmissionId`, which the form bridge reads too (0042), and to no key its shape does not name; no more submissions than the detail rows given, which `data.ts` counts, and a provider it does not know refused ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)); and the locale a formancy form's labels were read in, where it is not the report's own, held to a report's locale by report-spec's `isLocale` (0063) |
| `languages.ts` | The locale a render prints in, the report's own or one its translations declare, exactly, by report-spec's `renderLocale`, or `undeclared-locale`; the errors that refuse a render in it, one that names no language refusing every render; and a form's labels held to it, `labels-locale-differs`. `evaluate.ts` compiles report-spec's `reportIn`, the report written in that locale, which every later stage reads ([0063](../decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)) |
| `evaluate.ts` | The expressions report-core compiled, evaluated with fixed capabilities within `EXPRESSION_STEP_BUDGET` each and `RENDER_STEP_BUDGET` a render |
| `sort-group.ts`, `totals.ts`, `decimal.ts` | Row order and groups, of the rows a table's condition selects, each kept at its index in the data (`orderTable`, 0062), a chart's categories among them (`categoryGroups`); aggregates computed exactly, BigInt and upstream's `Decimal`, rounded once as declared, by one function, `totalOf`, for the report, each group, each table that selects its rows and each series of a chart |
| `format.ts`, `inlines.ts`, `styles.ts` | Every value as the text it prints, for the report's locale, through Intl handed exact digits; a paragraph's run as the document's, with the baseline its source run set and no key where it set none (0061) |
| `lower.ts`, `lower-table.ts`, `render-context.ts`, `images.ts` | The components lowered to blocks, a table's rows those its condition selects, read once a row, its total rows and its group's header and footer read with its own totals as `table` (`tableScope`, `groupScope`, 0062), and a group header row carrying how many of its group's first rows it is kept with, the stated number or the group's rows where it has fewer, and only above one ([0059](../decisions/0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)); a table every shown column of which is titled with nothing, or with white space alone, written with no header row and no header style, decided here once (`headerOf`, [0078](../decisions/0078-a-table-whose-every-column-title-prints-nothing-has-no-header-row.md)); page 1's own header lowered as the page header is and only where a report has one, none an empty list (0060); images through the host's lookup, once per render, an SVG's answer refused past `MAX_SVG_BYTES` before it is copied (0030) |
| `lower-chart.ts`, `chart-ticks.ts`, `chart-document.ts` | A chart lowered to its block, which holds every word it prints and each value's exact digits beside its text: its categories at most `MAX_CHART_CATEGORIES`, and a pie's no more than its palette's colours, refused before anything is totalled; each series totalled by `totalOf` in the decimals report-core's `seriesType` gives it; its value axis chosen exactly, at most `MAX_TICK_INTERVALS` intervals; a pie's shares exact ratios rounded once to `SHARE_PLACES`, printed by `format.ts`'s `percent` ([0055](../decisions/0055-the-runtime-resolves-a-chart-exactly-its-totals-as-every-total-and-every-word-it-prints.md)) |
| `lower-fonts.ts` | The fonts a report maps, resolved to the bytes the renderer embeds through the same host lookup, widened to assets (`AssetResolver`): each face fetched once, its media type held and its size before its bytes are copied, the copy read with report-spec's `readFont` before they are handed on, a face the host cannot give or that the reader refuses refusing the render, in a preview too ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)) |
| `qr-bill.ts`, `lower-payment-part.ts` | A QR-bill's payload and every text its slip prints, held to report-spec's rules once the data has resolved them ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `lower-epc-qr-code.ts` | An EPC QR code's payload: each text read as a paragraph's and held to report-spec's rules once the data has resolved it, an optional one that prints nothing left unused, and the whole held to the EPC's bytes ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `qr-symbol.ts`, `epc-symbol.ts` | The symbol an engine draws a code from, and what refuses one, decided once for every engine and called by none of the stages above: `qrSymbol` and `epcSymbol`, a QR code's and an EPC QR code's where it stands so wide, and `swissSymbol`, a QR-bill's, each encoded by uqr at its level, never raised, in the smallest version that holds it, an EPC QR code in Austria's frame at the least version report-spec's `epcLeastVersion` prints there; or the `RenderRefusal` an engine throws on, for a square of no size or wider than where it stands, a level, a caption or text no encoder draws, more than `QR_MAX_CHARACTERS` characters, more bytes than a version holds, modules finer than `QR_MIN_MODULE`, and the PSA's rule a framed code breaks ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md), [0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), [0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `bill-check.ts`, `slip-print.ts` | A QR-bill's slip below every engine ([0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)), called by none of the stages above: `checkQrBill`, what refuses a bill before an engine lays its slip out -- its kind, the page, text that is not text, a value longer than any SIX allows, the lines an address and the additional information print, the currency, the amount -- with its Swiss QR Code encoded once by `swissSymbol`, and one thing an engine says itself, whether its face draws a text (`BillUndrawn`); and where SIX puts each part of the slip and at what size, `SLIP_RECEIPT`, `SLIP_PAYMENT_PART` and the constants beside them, the blocks a part's information holds (`slipBlocks`), the code's 46 mm and the Swiss cross. Moved from the PDF renderer's `bill.ts`, `slip.ts` and `qr.ts` line for line, so that the Word writer refuses the same bills in the same words and lays the same slip out |
| `lower-e-invoice.ts`, `e-invoice-lines.ts`, `e-invoice-totals.ts`, `e-invoice-terms.ts`, `e-invoice-payable.ts` | An e-invoice of either kind, by the same readers, each term held to its kind's rules, after the aggregates and before anything is lowered: its lines read once from the rows of the table that prints them, the table printing the very values kept; its totals and VAT breakdown computed once, in `Decimal`, each category's VAT rounded once and never per line; its other terms held to report-spec's rules once the data has resolved them; and, while the codes are lowered, a payment code printed with it held to the amount due and the account ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| `cii.ts`, `cii-parties.ts`, `xml.ts` | The CII XML a final render writes from those values, each element in the profile XSD's order and at the path CEN's binding gives its term, written one way, so that the same report and data are the same bytes; a term the invoice does not hold, the business process, an electronic address or the seller's contact among them, no element at all (0037). A preview writes none (0027) |
| `document.ts` | The renderer-neutral document and the refusal codes; and an e-invoice's file, by its kind: a Factur-X file, its XML with the name, relationship and conformance level it is to be embedded by, or an XRechnung's, its XML with its syntax, guideline and version, which a host takes and sends; `resolve.ts` heads every page of an XRechnung's document with `XRECHNUNG_COPY_LABEL` in the labels' style, a paragraph it exports frozen, `XRECHNUNG_COPY_PARAGRAPH` ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)), and heads page 1's own header, `firstPageHeader`, with every label it heads the page header with, each with a paragraph of its own (0060); `e-invoice-copy.ts` is the label of a copy of an e-invoice ([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)) -- `E_INVOICE_COPY_LABELS`, by the invoice's kind and the render's language, `eInvoiceCopyParagraph`, each as a frozen paragraph, and `readCopyLabel`, which says which label a header opens with and whether as written -- which `resolve.ts` heads every header with, the XRechnung's label and the XML left out, where a host asks for `eInvoice: 'copy'`, and refuses as `no-e-invoice-copy` of a preview and in a language no label is written in; `page-label.ts` is the paragraph every label is; and what a run set below or above the line prints as, for any engine, `SHIFTED_SIZE` of its paragraph's size and its baseline moved by `SHIFTED_RISE`, pdfmake 0.3.11's figures, which the renderer and the corpus read from here, beside report-spec's `BASELINE_SHIFTS`, re-exported ([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)) |

### `@formancy/report-render-pdf` (L3)

`renderPdf` draws a resolved document with pdfmake, or rejects with a
`RenderRefusal` before any PDF is written
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
It is a package boundary, not an engine interface: there is one PDF
engine, and the Word writer beside it is a second function over the same
document, never a second implementation of an interface (0068).

| Module | Responsibility |
|---|---|
| `node.ts`, `node-engine.ts`, `browser.ts`, `browser-engine.ts`, `engine.ts` | The two entries: pdfmake's Node build reading font files, or its browser build reading virtual ones. Only that differs. Each engine's `widths` opens the faces a render's charts print in, in a document of its own pdfmake, and measures a word as PDFKit's `widthOfString`, which a chart is laid out by [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md); `node-engine.ts` and `browser-engine.ts` stand apart from the entries, so that a test reaches them, nothing a host imports does, and the published types import nothing of pdfmake's. Each hands PDFKit's document, laid out and not yet ended, to the final pass's `finish`, the one hook an e-invoice is embedded through ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)). The browser entry imports Liberation Sans's chunk with the first document that has a QR-bill or a captioned EPC QR code, and never for a document with neither, which `report-render-pdf/src/browser.test.ts` holds ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `image-order.ts` | The images PDFKit is still decoding when pdfmake hands its document over -- a PNG with an alpha channel, a palette's transparency or interlacing -- written in the order pdfmake opened them, whichever decode finishes first, so that their soft masks are numbered, and they are written, in that order: the body's images first, then the page regions'. `engine.ts`'s `written` calls it in both entries; it wraps the `finalize` of each such image in PDFKit's registry, typed at the boundary, and of none where one cannot be wrapped ([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)); the package pins PDFKit at the release those details were read in, importing nothing of it ([0036](../decisions/0036-the-renderer-pins-pdfkit-at-the-release-0035-was-read-against-until-pdfkit-writes-images-in-the-order-it-embeds-them.md)) |
| `render.ts` | The passes, each a pdfmake layout: measure the page regions, measure kept blocks and table rows, then lay out the PDF, with an abort read between them, and the body's charts drawn before the second, each laid out by ECharts in its faces' widths, the module that imports it loaded for a chart with something to draw alone, and one with nothing to draw placed without it (`chart-empty.ts`); an e-invoice's file and XMP are added on that last pass alone, and a `pdfa` other than `'2b'` is the caller's `RangeError` before anything is read. Where a document gives page 1 a header of its own, one pass more measures it on a page as tall as the printable area, beside the page header's and footer's pass, which is not changed; page 1 and the later pages are each held to leaving a body, a kept block and a table's line to the later pages' body, the page limit to page 1's body and the later ones it leaves, and the slip to the taller header ([0060](../decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)) |
| `definition.ts`, `content.ts`, `build.ts` | The definition pdfmake lays out: the page regions built anew for each page; page 1's own header in page 1's background, at the margin the page header would stand at, the page header's function drawing nothing on page 1, and page 1's body moved by the difference between the two headers' rooms, an empty node with that top margin, down or up; page 1's own header built as a page region is, with no rule, no named destination and no word recorded for the pass, and every rule that asks whether a node is first on its page reading page 1's top on page 1 (0060); a heading kept with the next block kept with that block's first text, a table's first body row before its header, whose page pdfmake writes over each time it repeats it (`anchorOf`, [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| `check.ts`, `check-table.ts`, `check-faces.ts`, `check-chart.ts`, `check-walk.ts`, `glyphs.ts`, `widths.ts`, `assets.ts` | What is refused before pdfmake sees the document: a character without a glyph, by the faces' maps report-spec's `characterMap` reads, through the runtime ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)), a face a mapped family does not map, a page field's digits in its face, and a character of any script but Latin, Greek and Cyrillic, or a bidirectional control, by code point ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)), what is malformed or wider than where it stands, image bytes that are not what they say, a PNG's or a JPEG's structure read by report-spec's `imageHeader` and a PNG's image data inflated here, an SVG not in the form `cleanSvg` writes, and, through `check-images.ts`, each asset read once and SVGs past what a render may draw (`MAX_SVG_DRAWING`, an image in the page header or footer counted on every page, and one in page 1's own header once, 0060) or a page may cost a reader (0030); a page field in page 1's own header, which is drawn before the pages are counted (0060); in a PDF/A, an e-invoice's or a PDF/A-2b, a CMYK JPEG, which it cannot hold beside its sRGB output intent; and a chart in a page region, page 1's own header among them (0060), one whose words its faces do not draw as a paragraph's, and one whose kind, box, bounds, colours, parts or numbers are not what the drawing lays out (`check-chart.ts`); and a render whose charts together weigh more than `MAX_CHART_DRAWING`, each its kind's weight, a unit a point and each word's weight, measured on the render and on a reader, refused before any is laid out (`checkChartDrawing`, [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md)) |
| `host-fonts.ts`, `face-identity.ts`, `strip-layout.ts` | The fonts a report maps, resolved for the render ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)): `planFonts` reads each face with report-spec's `readFont` in every render, keeping nothing for the next, takes its glyphs and its line, refuses with `drawnAs` a face PDFKit would draw as another -- one of another face's PostScript name with other bytes, the renderer's own Roboto and Liberation Sans included, or of `null` or a name every object has -- and embeds one of the renderer's own bytes whole, and `withoutLayoutTables` strips the records fontkit runs at print -- GSUB, GPOS, GDEF, kern and `morx`, read from fontkit 2.0.4 -- so that a crafted one neither hangs nor crashes a render, closing 0040's open risk; the stripped bytes go into pdfmake's virtual files under names of the render's own, written for each pass and removed from `storage` after it by `engine.ts`'s `registerHostFonts`, so two renders at once never share one. A token a report leaves unmapped prints in Roboto (`sans`) or is refused (`serif`, `mono`), as before; the slip keeps Liberation Sans |
| `bound.ts`, and `check.ts`'s `refuseTall` | What is refused between the passes, once the page regions are measured: a block of fixed height or a line taller than a page's body, the shorter of page 1's and the later pages' where page 1 has a header of its own (0060), and a body whose least height already needs more pages than the limit, each line counted by the face it prints in, a paragraph's by its tallest run's and a table's cells by `table.ts`'s `styledRows`, the one walk `tableContent` builds the table from and check.ts holds its cells to ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)) |
| `words.ts` | What is refused inside every pass, once pdfmake has measured the words and before it lays out a line: a word wider than its table column, or longer than `MAX_WORD_LINES` lines of its paragraph, read from pdfmake's own `_minWidth` ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)); and a chart's word wider than the advance its drawing placed it by (0058) |
| `shifted.ts` | What is refused in the same moment, of a paragraph that holds a run set below or above the line alone, read from pdfmake's own words, the inlines it chains with `noNewLine`: a word that holds such a run and no run on the line printing a character other than a space, as `unsupported`, and one wider than its line, measured as pdfmake measures it with its leading and trailing cuts, as `content-too-large`, each naming the block; `content.ts` hands pdfmake its `sub` and `sup`, and a lowered run's room below its line, `LOWERED_LINE` of its paragraph's size, through `loweredLineHeight`, `bound.ts` counts a line of such runs alone at their size and a lowered run's with its room, and its `checkBaselines`, which `check.ts` calls before pdfmake sees the document, refuses a baseline it does not know, or one on a page field ([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)) |
| `chart-draw.ts`, `chart-measure.ts` | A chart laid out by ECharts [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md): three layouts, the bands, the plot and the drawn, and a pie's two; the plot read by `convertToPixel` and only snapped; and a chart refused, as `content-too-large`, whose category labels do not fit across their slots, whose plot is too short for two tick labels `TICK_CLEARANCE` apart, whose bars are narrower than `MIN_BAR_WIDTH`, or whose pie is narrower than `MIN_PIE_DIAMETER`. `chart-draw.ts` is the one module that imports ECharts' code, and `render.ts` imports it, through `loadOnce`, the first time a document holds a chart with something to draw; `chart-measure.ts` replaces zrender's platform for one layout, and is imported by `chart-draw.ts` alone, so both stand in the chunk a browser loads for a chart. That ECharts and zrender stand in that chunk alone is held by the Studio's `notices.test.ts` and the loads by `browser.test.ts` |
| `chart-option.ts`, `chart-faces.ts` | What ECharts is handed: the ticks' places, each value's worked out in BigInt to `QUOTIENT_UNIT`, a pie's exact shares, every word by index, every colour, and the words' faces, each named by the digest of the bytes the render embeds. `chart-option.ts` imports ECharts' types alone, and `chart-faces.ts` nothing of ECharts |
| `chart-svg.ts`, `chart-arcs.ts` | ECharts' SVG held to what ECharts 6.1.0 was seen to write, its words taken out and read back as the boxes pdfmake prints them in, its style sheet and a line's clip taken out, refused as `unsupported` otherwise; and a pie's arcs written again on its own circle before it is read. They import nothing of ECharts |
| `chart-held.ts`, `chart-empty.ts`, `chart-content.ts` | The rule a chart's words are held to, inside the box, apart, and out of the plot but a value's label; a chart with nothing to draw placed without ECharts; and a chart as pdfmake content, one unbreakable stack of the drawing, each word as pdfmake text detached where it was placed, and a spacer of the box's height. They import nothing of ECharts, so a document whose only charts are empty loads none |
| `breaks.ts`, `table.ts`, `table-rules.ts`, `kept-rows.ts` | Where a table's pages break, planned from measured heights, so a group header stays with its first row, or with as many of its group's first rows as its row carries where they fit under the repeated column header, a block ended on a row that prints, and totals with the last; `kept-rows.ts` refuses, before pdfmake sees the document, a count the runtime would not write ([0059](../decisions/0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)). A table without a header row is handed to pdfmake under a header row of no height, empty stacks with no padding and no rule under it, which the plan reads first as `UNSEEN_HEADER`, so that its first rows are kept and its breaks planned as every table's, and nothing prints where a header would stand ([0078](../decisions/0078-a-table-whose-every-column-title-prints-nothing-has-no-header-row.md)) |
| `qr.ts` | A QR code drawn as one vector path, from the symbol the runtime's `qrSymbol` gave `check.ts` once, and a QR-bill's Swiss QR Code with its cross, from `swissSymbol`'s; no encoder is imported here ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), [0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)) |
| `bill.ts`, `slip.ts`, `bill-fonts.ts` | A QR-bill's slip as pdfmake content, in the Liberation Sans the package ships in `fonts/`: `bill.ts` asks the runtime's `checkQrBill` and says of a text what only the renderer knows, the glyphs of the face it embeds; `slip.ts` draws by the runtime's `slip-print.ts`, with the scissors and the face's own line; `bill-fonts.ts` is those faces for the browser entry's chunk ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)) |
| `e-invoice.ts`, `pdfa.ts` | An e-invoice the renderer knows, and how a PDF/A is drawn. `checkEInvoice` refuses, as `unsupported` and before pdfmake sees the document, a file whose name, relationship or conformance level is not report-spec's, and XML holding a lone surrogate ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)). `pdfa.ts` makes a Factur-X a PDF/A-3b (`PDF_A_3B`) and, through the final pass's hook, embeds the runtime's XML as `factur-x.xml`, changed in nothing, and appends the fx properties and their extension schema to PDFKit's XMP ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)), and a report a host asks for as one a PDF/A-2b (`PDF_A_2B`), which embeds nothing and runs no hook ([0057](../decisions/0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)). An XRechnung's file is known by its syntax, version and guideline and drawn as no PDF/A, a CMYK image drawn in it, its copy refused where its page header, or page 1's own header where it has one (0060), does not open with the runtime's label paragraph, `XRECHNUNG_COPY_PARAGRAPH`, style and all (`checkCopyLabel`); an e-invoice of a kind it does not know is refused ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)) |
| `pdfa-check.ts` | What a document is drawn as, decided once, before pdfmake sees it: `checkPdfA` runs `checkEInvoice` first, then makes a Factur-X a PDF/A-3b, a document the host asks for as `pdfa: '2b'` a PDF/A-2b, and anything else a plain PDF, the answer `Checked.pdfa`, which the definition, the final pass's hook and the image checks read. As a PDF/A-2b it refuses, as `unsupported`, a Factur-X and an XRechnung's copy, naming `eInvoice`, a preview whose page header opens with the runtime's `PREVIEW_LABEL` or `E_INVOICE_PREVIEW_LABEL`, naming `pageHeader`, and a copy of an e-invoice whose page header or page 1's own opens with a copy's label, read by the runtime's `readCopyLabel`, naming that header (0077), each to be rendered without `pdfa`; in either PDF/A, a title PDFKit cannot write into the XMP (`checkPdfATitle`), and a CMYK JPEG (`refuseCmyk`) ([0057](../decisions/0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)) |
| `svg-pdfa.ts` | An SVG in a PDF/A, an e-invoice's or a PDF/A-2b: every number the converter will write for an image of one bounded from above, from report-spec's extent, the box and the page, and the image refused as `unsupported`, naming it and the PDF/A, past the integers a PDF/A-2 or -3 holds less a margin for rounding, or past its 28 graphics states; a report drawn as no PDF/A draws it as before ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md), 0057) |
| `svg-content.ts` | An SVG asset as pdfmake's node: the approved text unchanged, held to the renderer's own list of the elements that form holds, with the converter's `xMidYMid meet` for `contain` and `xMidYMid slice` for `cover`, and an image and a warning callback that refuse the asset ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)) |
| `epc.ts` | An EPC QR code drawn as a QR code is, from the symbol the runtime's `epcSymbol` gave `check.ts` once; with Austria's caption, in the PSA's frame, the caption in the same Liberation Sans, laid out by report-spec's `epc-print.ts` ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), 0074) |

### `@formancy/report-render-docx` (L3)

`renderDocx` writes a resolved document as a Word file, synchronously, or
throws the runtime's `RenderRefusal` before a byte is written
([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
It stands beside the PDF renderer and shares the document and the refusal
with it, and no interface: two functions over one input. It says what the
document says, and leaves lines, pages and their count to Word.

| Module | Responsibility |
|---|---|
| `render.ts`, `index.ts` | `renderDocx(document)`: the fonts planned, the document checked, the package written. The entry hands on the runtime's refusal, its codes and their types, and the writer's bounds |
| `check.ts`, `check-walk.ts`, `check-table.ts`, `check-pictures.ts`, `check-units.ts`, `check-text.ts`, `created.ts` | Everything refused before anything is built, in a stated order, once the fonts are read, the order and the walk of the blocks being `check.ts`'s: the creation date, which must state an instant and a day a calendar has and is written as that instant in UTC (`created.ts`), and the title; what belongs to the PDF of the document itself; the page; then the page header, page 1's own, the page footer and the body, each block in document order, a table held to its shape and every cell's text by `check-table.ts` where the walk meets it; then the pictures' bytes, in the order the walk met them, as the PDF renderer reads them once it has walked every block (`check-pictures.ts`), and last a QR-bill's payment part and its slip, where the PDF renderer checks its bill (0075). What no engine prints is refused by the PDF renderer's code and subject -- a table in a columns block, a page break in a region, a page field in the body, a block, a style or a row the document's types do not hold -- a chart's block among it (`chart-check.ts`) -- what nobody has seen Word print as the PDF does as `unsupported`: an SVG that covers a box of other proportions, and a table or a page break in a section with a border, a fill or padding -- and so is what Word's units do not state (`check-units.ts`): a line outside its borders' weights, and a rectangle, a column, a framed section or a picture whose width or height rounds to none of the unit it is written in. The walk counts the paragraphs, the characters and the runs it would write, and refuses them past their bounds as it counts (`check-walk.ts`) -- a rectangle and a section's frame two paragraphs, a line ending a run, and what a family is written past its bound with the characters -- and the pictures, their image data and their bytes are counted as each asset is first read. `check-text.ts` holds every string a page prints to report-spec's `refusedCharacter`, to what an XML document holds and to the characters its mapped face draws, and a style to the document's kinds |
| `copy.ts` | A copy of an e-invoice ([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)): `copyLabel` reads the label the page header opens with by the runtime's `readCopyLabel` and refuses, as `unsupported`, one printed otherwise than the runtime writes it, page 1's own header without the same label, and a label on page 1's own header alone; `onSlipPage` sets the label 5 mm in from the paper's sides, `COPY_LABEL_INSET`, as the header of a slip's page, which `package.ts` writes in the empty header's place and `check.ts` counts |
| `pdf-only.ts` | What belongs to a report's PDF, each refused as `unsupported` in a sentence that says to print it as one: the document that carries an e-invoice of either kind, in a sentence that says to resolve its copy for the Word file (0077), a preview whose page header opens with the runtime's label, read as `pdfa-check.ts` reads it in the renderer, and an XRechnung's PDF copy, its XML taken off, whose page header or page 1's own opens with `XRECHNUNG_COPY_LABEL`, naming that header (0077). No block is refused here any longer: a code since 0074 and a chart since 0076 are written, and a payment part's slip since 0075 |
| `charts.ts`, `chart-xml.ts`, `chart-check.ts`, `chart-exact.ts` | A chart ([0076](../decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md)). `charts.ts` holds what the check, the count and the two writings share -- which of a chart's words print, trimmed, and the face they are set in -- maps a chart with something to draw to a paragraph of one inline chart exactly its box, and one with nothing to draw to a table of one cell at least as tall (`RowNode`'s `atLeast`), its title and its empty text centred in its middle, and counts a chart with the file's paragraphs and characters, its numbers' digits among them. `chart-xml.ts` writes the part, DrawingML's `c:chartSpace`, from the runtime's block alone: literal data and no reference, each value through `decimal`, the axis's ends and its step, a label a point's own rich text, and every choice DrawingML leaves to Word said. `chart-check.ts` states again what no engine prints of a chart's block, by the PDF renderer's codes, and holds a file's charts to `MAX_DOCX_CHARTS` before anything of one is read, their points to `MAX_DOCX_CHART_POINTS` before a word or a number is, and a number to `MAX_DOCX_CHART_DIGITS` before it is read as one. `chart-exact.ts` reads a number's digits into BigInt, for the ticks' step and whether they hold a value. None imports ECharts or the renderer |
| `codes.ts`, `code-png.ts` | A QR code and an EPC QR code ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)): `codeSymbol` asks the runtime's rule for a code's symbol, once, where `check.ts` meets it, and holds a file's codes to `MAX_DOCX_CODES` before anything of one is worked out and their symbols' modules to `MAX_DOCX_CODE_MODULES` as each is encoded; `codeNodes` maps a code to a picture's paragraph exactly its size, and one in Austria's frame to an empty line kept with a table of one row at least the frame's height (`RowNode`'s `atLeast`) -- the picture, in a cell bordered on each side by half a module, and beside it, outside the line, the caption in a cell turned to read from bottom to top -- and an empty line under it, by report-spec's `epcModule`, `EPC_FRAME` and `EPC_CAPTION`. `code-png.ts` makes the picture: a PNG of one bit a pixel, `modulePixels` whole pixels a module, `CODE_RESOLUTION` to the inch and `MAX_CODE_SIDE` a side at the most, a repeated scanline nothing but PNG's filter, deflated by fflate, summed by a CRC-32 of its own |
| `slip.ts`, `slip-plan.ts`, `slip-widths.ts`, `slip-code.ts`, `page.ts` | A QR-bill's slip ([0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)). `slip-plan.ts` plans it before a byte is written: the runtime's `checkQrBill`, with a character that has no width here refused; each value broken into lines no wider than SIX's section, at a space, after a hyphen that no digit follows, and inside a word only where it is wider than a line; every other text held to the room its place gives it on one line; and each part's information held to its section's height, in the PDF renderer's words. `slip-widths.ts` states the face, Arial with Liberation Sans as its other name, and Liberation Sans 2.1.5's advances for the characters SIX allows a bill, which `slip-widths.test.ts` holds to the renderer's font files. `slip.ts` maps the plan to the page's nodes, by the runtime's `slip-print.ts`: the instruction to separate, and a table of one row and three cells whose every paragraph is a line or white of an exact height, its amounts tables of their own and its blank fields tables of four corner marks, no row that holds text of an exact height (`RowNode`'s `atLeast`); and counts the slip with the file's paragraphs. `slip-code.ts` draws the Swiss QR Code, a PNG of whole pixels a module with no quiet zone and the Swiss cross in its pixels. `page.ts` is the report's paper and margins, held as the PDF renderer holds them. `package.ts` writes the two sections, and an empty header and footer for the slip's page where the report prints one |
| `assets.ts` | A picture's asset before its bytes go into the file: the size limit; its bytes counted with those of the pictures before it, from its length, before a byte of it is read, and refused past `MAX_DOCX_MEDIA_BYTES` as `content-too-large`; the bytes against the type they are declared as, a PNG's or a JPEG's structure by `imageHeader`, a PNG's image data inflated by pako and held to being one whole zlib stream -- what zlib refuses of a block, a checksum that does not sum and a stream cut short pako's error, a byte after its end one pako says it left, and a gzip member none, its window being stated -- and to the scanlines its header promises, an SVG by `checkSvg`, each `invalid-asset` as the renderer refuses it; a picture's image data counted with that of those before it, from its header, before a PNG's is inflated, and refused past `MAX_DOCX_IMAGE_DATA` as `content-too-large`, a PNG within it inflated no further than a chunk of 64 KiB past what its header promises; then a JPEG its Exif block turns, by `JpegHeader.orientation`, and one of four components, `unsupported`. The size a picture is drawn at in its box, worked out once for the checks and the file. And the one grey pixel a reader that draws no SVG shows in a drawing's place |
| `fonts.ts` | The family each font token is named by, and the font table: a mapped token by its normal face's name ID 1, `readFont`'s `legacyFamily` where a typographic family stands before it; `sans` unmapped Roboto; a token with no regular face, faces of different typographic families, a weight or a slant a mapped token has no face for and `serif` or `mono` unmapped refused, and a family of more than `MAX_DOCX_FAMILY_LENGTH` characters, which Word does not read; what a family within that is written longer, escaped, is said for the walk to count (`longer`). Nothing is embedded |
| `look.ts`, `rows.ts`, `widths.ts` | What the document leaves to an engine, the PDF renderer's own, stated again: the sizes text prints at where no style says, a table's bold rows, its rules and padding, the space around a rule, the gap between a region and the body, and a chart's words' size, its bars' gaps, its line's weight and its gridlines; the one walk of a table's cells in the style each prints in, which the checks and the table are both built from, with the rows a group header keeps; and a fill column's share of a width. `against-pdf.test.ts` holds the sizes, the weights and the slant to the PDF, and the rest is review's |
| `limits.ts` | `MAX_DOCX_PARAGRAPHS`, `MAX_DOCX_CHARACTERS`, `MAX_DOCX_RUNS` and `MAX_DOCX_MEDIA_BYTES`, each with how it was measured, on what and when; `MAX_DOCX_IMAGE_DATA`, the PDF renderer's number, stated again; `MAX_DOCX_PICTURES`, chosen far under the entries a zip's directory counts; `MAX_DOCX_CODES` and `MAX_DOCX_CODE_MODULES`, a file's codes and their symbols' modules, with what a file at them was measured to cost (0074); `MAX_DOCX_CHARTS` and `MAX_DOCX_CHART_POINTS`, a file's charts and their points, measured the same way, and `MAX_DOCX_CHART_DIGITS`, derived from the runtime's `MAX_FORMATTED_DIGITS` and `MAX_SCALE` (0076); `MAX_DOCX_FAMILY_LENGTH`, what Word reads of a font's name, looked up; and `ONE_CELL_TABLE`, what a rectangle and a section's frame count as; with the shapes inside them that were measured for costing more than their count, and what each thing counted was measured to cost |
| `units.ts` | Points as Word's units, rounded once and here: twentieths of a point for a length, half-points for a size, eighths for a rule's weight, EMUs for a picture |
| `nodes.ts`, `blocks.ts`, `table.ts` | The file's paragraphs and tables in points, before any XML: each block mapped as the record's table says, a paragraph's and a cell's text without the line ending that ends it, which the PDF prints no line for, and the keep rules marked on them, each in one pass -- a heading through the spacers and rules between it and what it heads, a kept block's every paragraph but those of the paragraph or the row that ends it, the header row, a group header's kept rows, the row before a closing row -- which only a list of nodes can say; a table without a header row written with none and no row marked to repeat ([0078](../decisions/0078-a-table-whose-every-column-title-prints-nothing-has-no-header-row.md)) |
| `wml.ts` | Those nodes as WordprocessingML, every element's children in the order ECMA-376 gives them, every run stating its own family, size, weight, slant and colour, since the file has no style to inherit one from, and every text element keeping its spaces |
| `package.ts` | The parts, their content types and relationships, the core properties, the styles, the settings and the font table, each named by the writer alone and never by anything a document carries; zipped by fflate with every entry dated 1 January 1980, by a date made as each file is written, a PNG and a JPEG stored and the rest deflated; a code's picture a part of its own, stored as the PNG it is, and the family its caption is named in listed in the font table where one is written (0074); a chart a part of its own, named by its number among the file's charts, which the body's part leads to and which has no relationships part (0076) |
| `xml.ts` | The one place a string becomes XML: `text` and `attribute` escape, markup is a type only this module makes, and a string from a document does not compile where markup stands |

### `@formancy/report-data-provider` (L3)

`readReportData(client, report, binding, options)` reads a report's data
from a Formancy Data 0.5.0 server through a client the host made, with
the host's token. `binding.ts` holds everything it can check before it reads a record —
the bindings, the fields the person may read, the list the detail form
offers — and `read.ts` the reads themselves: the header record, the detail
rows a page at a time, each after the last row of the one before, each
lookup's labels. The data it hands over says
`best-effort` ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)),
and names as its source the published form each dataset was read from,
by the id the binding addressed, refusing a form Data answers under
another, and never a record's token ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)).

### `@formancy/report-forms` (L3)

`readSubmission(report, { form, formHash?, submission }, options)` reads
a report's data from one submission of a formancy form, against the
version that collected it, and `readSubmissions(report, { forms,
submissions, complete }, options)` one row per submission, each against
its own version ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)). The host hands every document over and
the bridge fetches nothing. The data it hands over says `host-captured`
and names each submission with its form's id and the hash of its version
([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)).
`generateReport(form, { id, locale, detail? })` starts a report from a
form version: a first draft in model order, the binding its submissions
are read by written, the version named by its hash, and notes, by stable
codes, of what it left out and assumed ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)). Its tests hold every
draft to the runtime's `checkReport`, which compiles its expressions
with report-core; nothing holds every draft to `diagnose` yet, so a
draft's warnings are held on the corpus's starter alone.
`reviewFormVersion(report, { form, formHash?, versions })` reviews a new
version for a report: compatible, review or blocked, an item for each
field the version moved, removed, retyped, relabelled, reused or added
and for its form's id where it changed, and each item's resolutions,
report-core command descriptors and the hash they were computed against,
a declared rename first, which moves the binding to where the field is
now ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)).

| Module | Responsibility |
|---|---|
| `read.ts` | The two readers: everything that can be refused without an answer first -- the report, the input's shape, each id by the runtime's `isSubmissionId`, each version, each field against each version -- then the answers; a refusal anywhere hands over nothing |
| `version.ts` | A form version: copied as data, a `specVersion` the pinned `@formancy/spec` does not read refused naming both, `validateSchema`, its refusals named where it points, cut before a segment that is neither an index nor a field key, and the `schemaHash` computed of that copy; its scopes, pages looked through, each indexed once, and held by `version.test.ts` to the paths `modelDataPaths` writes |
| `kinds.ts` | `KINDS`, formancy's field kinds and the report types each is read as, decided once; and each field the report reads planned against a version, at its override's path for that version or nothing of it, the detail's rows from its override's repeater (`repeaterIn`), a field the version lacks, holds elsewhere or retypes refused naming it, the version's hash and the review that lifts it (0048) |
| `answers.ts` | A submission walked by the version's model, an answer under no data path of it refused, and a matrix's answer held whole to the version's rows and columns; each string held to the runtime's `MAX_STRING_LENGTH` before it is read, each answer read as its kind stores it, a choice's label from the version, or the host's `labels`, in the locale the read names, the report's own unless a translation's (0063), and held to its type by the runtime's `readValue`; a refusal of what an answer holds at the field's own path |
| `numbers.ts` | The number rule: a double to its digits, a safe integer, or, nearer zero than 2^53, a decimal of at most 15 significant digits, never digits to a double, and anything else refused |
| `json.ts`, `errors.ts` | Reading what a host hands over through its descriptors, a getter never run, lists bounded by `MAX_DETAIL_ROWS` before an item is read, nothing nested past `MAX_DOCUMENT_DEPTH`, an input's parts each known and present (`readParts`); and the codes, each refusal a JSON Pointer and never an answer, bounded by report-spec's `MAX_ERRORS` |
| `generate.ts` | `generateReport`: the options held to report-spec's judgement of an id and a locale, the version read by `readVersion`, the detail's repeater found by `planRepeater`, what is said of the whole version, the format's bounds -- fields, components, nothing to print -- refused, the page chosen by the table's columns and a table wider than a landscape page refused, and the report validated and handed over with its notes ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)) |
| `generate-walk.ts` | The version's model walked in order into the draft's outline: a group a section, nested as deep as the format nests and flattened past it, a page looked through, the repeater asked for the table and its rows' fields columns in formancy's `datagridColumns` order, ordered here in time linear in the grid (`gridOrder`), one row per submission a table of the submission's own answers, every other repeater listed |
| `generate-fields.ts` | One formancy field into the fields the draft declares: its type by `KINDS`, its id its key or, a matrix row's and an option's, its field's key and its value where every member's is a field key or its place for every member, its binding, its label on its line and as a field, nullable unless the version proves it answered, the notes its kind and its labels need; a path past a binding, a column's label past a field's, a line's past a text and two fields of one id refused |
| `generate-labels.ts` | The words a draft prints of the form: a label in the report's locale as formancy reads one, its white space one space, a blank one its fallback, said, one the report's catalogue lacks in the default locale's words, said, and one holding a character no font draws refused; and the title, the form's id where it is blank |
| `review.ts` | `reviewFormVersion`: the report, the new version and every version handed over read, one the report names missing refused; each dataset's fields planned against the new version, as a read plans them, each item `review-fields.ts` makes of them; each field the version added said, but where the report reads it, a rename moved it or a resolution would read it; a form's id changed said; the status ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)) |
| `review-fields.ts` | What a review says of each field and of the detail's repeater: for one the version refuses, what the diff says it did and what lifts it -- a declared rename followed, moving the binding and keeping every version handed over where it read, a path a baseline reads where the diff finds the same field, nothing printed, a retype, the removal -- nothing that changes what the payment part or the e-invoice prints; for one that prints from a field the diff calls new since a version the report printed nothing of it from, said; otherwise a relabel where its texts say an old label |
| `review-moves.ts` | Where a declared rename moved what a version held, read from `diffSchemas`' renames and additions, the scopes beneath a renamed container translated as the diff translates them, held to the diff by fast-check |
| `review-resolutions.ts` | Each resolution as a command descriptor -- an override, the binding moved with the versions it knows kept, a retype, the removal with readers, a batch -- with the report's hash, offered only where `tryEdit` takes it and, where it changes a field's type or whether it may be null, `compileReport` refuses nothing new of the expressions report-core's `fieldReaders` says it reaches, each compiled once |
| `review-labels.ts` | A field's label in a version in the report's locale, a member's own label for a member; and the commands that say a new one where the report says an old: the field's label, a line's label run before the run that prints it, found by `generate-layout.ts`'s `labelled`, a column's heading, what prints the field being what the compiler says an expression reads |
| `generate-layout.ts`, `notes.ts` | The outline laid out: a line of label and value, a section with its heading, the table, the title and the page counted, each id the next of its kind, a yes or a no a box read in brackets, the page A4, portrait or landscape by `MIN_COLUMN_WIDTH`; and `NOTE_CODES`, what a draft says it left out and assumed, quoting none of the form's words |

### `@formancy/report-server-core` (L2)

Who may do what to a tenant's reports, decided once, and what a server and
a client say to each other ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)); and what a server decides about a
tenant's drafts and images, as functions of who asks and a store's port, so
that a route, a second store or a second server cannot decide it otherwise
([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)). Later records' use cases and ports join it as they arrive.

| Module | Responsibility |
|---|---|
| `actions.ts` | `CAPACITIES`, the three the settings give the host's roles; `ACTIONS`, every action with the capacities that may take it, frozen; `can(identity, action, policy)`, an action the table does not hold denied, no capacity implying another, roles compared as the host spells them; `capacitiesOf` and `actionsOf`, what whoami answers |
| `identity.ts` | `ReportIdentity`: the subject, the tenant, never empty, and the roles, derived from a verified token alone |
| `wire.ts` | `API_PREFIX`, `/v1`, the API's version line (0046, extending [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)); `ROUTES`, every route the API answers with its audit operation; `WhoAmI` and `Health`; `DRAFT_FORMAT` and the draft slice's wire types (`TemplateSummary`, `TemplateList`, `DraftVersion`, `Draft`, `DraftSaved`, `ImageKept`); `isRevision`, the one test of a revision, which the tag's reader and the save's use case both ask; `draftTag` and `draftVersionOf`, the one writer and the one reader of a draft's version, its revision and its digest, as the `ETag` `"<revision>-<64 hex>"`, which a route answers with and reads `If-Match` by and the client sends; `REFUSALS`, a code and a fixed sentence for every refusal, and `ServerRefusal`, the four that carry a field beside it; `CROSS_ORIGIN_REQUEST_HEADERS`, the headers the routes read, and `CROSS_ORIGIN_RESPONSE_HEADERS`, the `ETag` a page on another origin may read |
| `audit.ts` | `AuditEvent`, one request an API route answered, never a value, who by keyed hash; and `AuditSink`, the port it goes through |
| `answer.ts` | `Answer` and `RefusalAnswer`: what every use case returns, its status beside its body, and a draft's version for the route's `ETag` where there is one; a refusal's body a `ServerRefusal`, so that the four with a field cannot be given without it, and no version, so that no refusal sends an `ETag` |
| `store.ts` | `TemplateStore`, the port a tenant's drafts and images are kept behind, every method taking the tenant first and deciding nothing, an image's question answered by the kind it was kept as; `StoredDraft`, `SaveOutcome` and `StoredImage`, its records, a draft's and a save's with the digest of its report; a save from one revision, swapped by the revision alone, of which exactly one of any concurrent saves wins |
| `drafts.ts` | `listTemplates`, `readDraft` and `saveDraft`, each asking `can` before it reads the request or asks the store; a save checking the id, the `Precondition`, `validateReport`, the report's `id` against the template's, every image kept as the kind it declares and no font declared, for a replace the newest draft read and compared with the version the precondition names, its revision and its digest, then the store's swap, which writes the report the validator returned and the token's subject as `savedBy` |
| `images.ts` | `keepImage` and `readImage`: a keep checking the digest's form, the size, what the bytes sniff as and the media type claimed, a PNG's or JPEG's header or an SVG in `cleanSvg`'s form alone, and the bytes' digest against the path's, before the store sees them |

### `@formancy/report-server` (L3)

`createReportServer(options)` is a Fastify server over a verifier,
the operator's role policy, a template store, an audit sink and the rate
limit, proxies and origins, each held to its setting's rule before anything
is built; and
`main.ts` the composition root that reads the settings once and serves it
(0046, [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).

| Module | Responsibility |
|---|---|
| `app.ts` | The server, over the `store` its caller opened: `no-store` on every answer, the rate limit by client address, a first hook answering a path that is not plain 400 and a request no route answers 404, each counted and before its body is read, the cross-origin hooks, `/health` and HEAD on it, and the API in a context of its own whose preParsing hook verifies the token -- every bad one the one 401 -- before any body is read and before `/v1/whoami` or a route of `drafts.ts` answers; a body past a route's limit 413 under the refusal that route names, one no parser of the route reads 415, any other error a request caused the fixed 400 sentence with its status; a `StoredRecordError` the one 500, logged by why, its file inside the tenant's directory and the tenant's keyed reference, and a `StoreFileSystemError` likewise by Node's code and the operation, never a message, a stack or an absolute path; any other error of its own the one 500; a `store` that lacks a method of the port refused at construction; Node's request timeout; the log naming a request by its method and route |
| `drafts.ts` | `registerDraftRoutes`: the draft slice's five routes, each an adapter over report-server-core's use case of its name that sends what it answers, a draft's version as `ETag` by `draftTag`, an image's bytes under their media type; two contexts of their own parsers, JSON alone up to report-spec's `MAX_REPORT_BYTES` and the three image kinds as bytes up to `MAX_ASSET_BYTES`, each route naming the refusal of a body past its limit; `parsePrecondition`, `If-None-Match: *` alone or one strong `If-Match` that `draftVersionOf` reads as a version, the bare revision and anything else malformed and answered 400 before the use case |
| `unread.ts` | `carriesBody` and `closingUnread`: a request refused before its body is read -- the 401, the cross-origin 403, a preflight that carries a body, a 415 -- has its connection closed with the answer where it carried one, so that Node does not read the rest to keep it open |
| `paths.ts` | `plainPath`: a target with nothing in it a proxy could normalise, by formancy.ai-data 0037's rule |
| `client-errors.ts` | `answerClientError`: what Node's parser cannot read answered with the fixed refusal and `no-store`, the connection closed, nothing logged |
| `identity.ts` | `createReportVerifier`: data-identity's verifier, built once, with the tenant's claim mapped and required, a token without it refused, and the identity handed on frozen |
| `audit.ts` | The trail's hooks: one event per answered request, from `onResponse`, or `onSend` or the connection's close for a client that left; a route with no name in `ROUTES` stopping the server; `auditReference`, who by HMAC over a JSON array; the audit key's 32-byte floor; `logAuditSink`, one log line per event |
| `settings.ts` | `SETTINGS`, every setting the server reads, which the package README lists; `readSettings(env)`, the environment handed to it parsed into what the server runs on or every reason it does not start, a `FORMANCY_REPORT_` variable it does not read and a secret reference to one of the server's own among them, no sentence repeating a value; `FORMANCY_REPORT_STORE_DIR` required, an absolute path, as `storeDir`, and `STORE_DIR_SETTING`, the name serve.ts begins its store sentence with, checked to be one of `SETTINGS`' keys |
| `rate-limit.ts`, `proxies.ts`, `cors.ts` | The rate limit, the trusted proxies and the origins, each a setting's rule and an embedder's, formancy.ai-data's (its 0034, 0071, 0060): `clientAddress`, the address a request is counted and logged by; `crossOrigin`, the preflight routes granting the headers the routes read, the origin carried back with `ETag` exposed to it, and a token-bearing request from an unlisted origin refused before its token or its body is read |
| `file-store.ts` | `openFileTemplateStore(root)`: report-server-core's `TemplateStore` on one directory, a root that is not an absolute, writable directory refused in a sentence about the root that names no setting, since it is opened from code as well as from a container; a tenant's directory the SHA-256 of its claim, a draft one numbered file written to a temporary name, flushed and hard-linked, so that of saves from one revision one wins, as formancy.ai-data 0013's versions, a read and a save answering the digest of the report's text as written; an image under its digest; a template id and a digest checked again before any file operation; `StoredRecordError`, a file that fails a read's checks -- a report its digest does not name, another format, no JSON, an image's bytes not its digest's -- never served, a `savedBy` the digest does not cover passing them, naming its absolute path and its path inside the tenant's directory, which the server's log names it by; `StoreFileSystemError`, every failure of the file system it does not handle, by Node's code, the operation and the path inside the tenant's directory, Node's own error, whose message names the absolute path, never handed on |
| `serve.ts` | `openReportServer(settings, io, logger)`: the identity key and the audit key opened through the source main.ts hands over, the audit key refused when it is the identity key, the store opened on `storeDir` before the server is made and handed to it, a root that does not open refused in the file store's sentence beginning with the setting's name, every refusal one sentence; `readAgainOnSignal`, the key set read again on SIGHUP and the log saying what changed by kid |
| `main.ts` | The composition root: the environment read once, the server opened and served, SIGHUP and SIGTERM handled |

`Dockerfile` beside `src/` is the image ([`packages/report-server/Dockerfile`](../../packages/report-server/Dockerfile)), held by `src/dockerfile.test.ts` and run by the container gate: its code root's, the store's directory the one thing its user owns.

### `@formancy/report-client` (L3)

What a host's page, or its own server, asks the report server with: a
template's draft and the images it declares ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)). It asks the routes by
`ROUTES`' own keys and answers in report-server-core's wire types, so a
route or a refusal's field changed there fails a host's build.

| Module | Responsibility |
|---|---|
| `client.ts` | `createReportClient({ server, token, fetch? })`: a base URL it can put a route's path after, refused otherwise by a sentence that quotes none of it; the host's token asked before every request and held to an RFC 6750 bearer token before fetch sees it; `listTemplates`, `readDraft`, `saveDraft` from `null` or a draft's version, sent as `If-Match` by `draftTag`, `keepImage` and `readImage` by the `sha256:` digest a report writes; each `Answered<T>`, a refusal `REFUSALS` holds answered with its field and anything else not 2xx thrown, naming the route by its pattern; no redirect followed |

### `@formancy/report-mcp` (L4)

What a coding agent's client launches to work on a report template
against Report's own checks, over the Model Context Protocol, after
formancy's `@formancy/mcp`
([0088](../decisions/0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md),
formancy.ai 0056 and 0112). Its tools need nothing but their arguments,
and every verdict they give is report-spec's or report-core's.

| Module | Responsibility |
|---|---|
| `tools.ts` | The tools as plain functions from JSON to JSON, each answering `{ ok, summary, data }`: `describeFormat`, report-core's `reportFacts()`; `checkReport`, the validator's errors, or a valid report's hash, its size against `MAX_REPORT_BYTES` measured as report-spec states it, and `diagnose`'s diagnostics split by the language each names into the report's own and each declared language's; `listCommands`, report-core's `describeCommands()`; `applyCommands`, a session opened on the report given and the commands applied as one batch with an optional `expectedHash`, answering the new report, its hash and its verdict, or the refusal and the hash of the report as given, but none for a stale edit. What a save asks of the server's own state -- the report's id, the images it keeps, no font -- is left to the server and said so |
| `server.ts` | `createReportMcpServer()`: the four tools registered thinly on the SDK's `McpServer`, each with the description `TOOL_DEFINITIONS` holds, the one result envelope and read-only, closed-world annotations; a report taken as any JSON value for report-spec to judge, commands as a list for the registry to; the two `PROMPTS`, `write_a_report` and `translate_a_report`, the latter printing the descriptors `translationSteps` makes, typed by report-core's `StepDescriptor`; the version the manifest's, `PACKAGE_VERSION`, the one file it reads |
| `main.ts` | The bin and the composition root: the server connected to the process's stdin and stdout, and nothing else read or written. `src/composition.test.ts` holds each module to the specifiers it may import, `process` to this module, `createRequire` to the manifest's one read, and `console` and the network to none |

### `@formancy/report-builder-core` (L2)

The editor model: `createReportEditor` makes one person's view of a session
— selection, zoom, the open pane, a drag, hidden panes, and a host's view
the host names, shown or not, in the design view's place or beside the
builder — and derives from the document everything a builder shows
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md),
[0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).
Given a host's store, it adds the image in a file a person chooses, and the
report declares it only once the host has kept its bytes ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).

| Module | Responsibility |
|---|---|
| `editor.ts`, `state.ts`, `views.ts`, `dragging.ts` | The frozen state both builders render, and the actions they send back, every one through the editor's one `dispatch`: the editor's views, the panes, a host's view and the zoom, in `views.ts`, and a drag in `dragging.ts`, each lent what it needs of the editor as `images.ts` is |
| `model.ts`, `model-actions.ts`, `model-canvas.ts`, `model-properties.ts` | The state's types, a file per reason to change: the state itself, the outline and the selection; what a builder dispatches and is told back, an outcome that says where the keyboard goes where the action decided it only once done; the design view; the properties, a group's buttons each saying whether it has somewhere to go, whether it is pressed, and where the keyboard goes once it is done ([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md), [0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)) |
| `outline.ts`, `palette.ts`, `properties.ts`, `property-fields.ts`, `field-specs.ts`, `component-fields.ts`, `run-fields.ts`, `report-fields.ts`, `selection.ts` | The tree a keyboard walks, the payment part's row after the regions among it, what may be inserted, and each property as a field whose typed value becomes a command, by itself or in a group of fields with its buttons: the groups fields are drawn in and their buttons (`property-fields.ts`), how each kind of field reads and writes its value (`field-specs.ts`), each component's and column's fields (`component-fields.ts`), a run's, each run of a paragraph a group of its own with its Subscript and Superscript (`run-fields.ts`, [0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)), and the report's own, its languages a group among them (`report-fields.ts`). A grouped table has a field for the rows its group header is kept with, read as one where none is stated and one written as none ([0059](../decisions/0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)). An EPC payment code's fields stand in the order the code holds its elements, and a new one's square is one every payload the EPC allows prints in, with Austria's frame and without ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)). The report's own fields end, after its page, with what page 1 prints at its top, the page header or a header of its own, the region's presence put in and taken away by report-core's `putFirstPageHeader` and `removeFirstPageHeader`, never a page setting; the outline and the design view hold that region only where the report has it, before the page header ([0060](../decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)) |
| `baselines.ts` | A run of a paragraph set below or above the line, or back on it, as one undo step: the characters a builder says were selected in its field snapped to whole graphemes and split from their run, a bound run set whole, only the run a press set joined to the literal runs beside it on its baseline, the field's text read as a textarea gives it back, CR LF as LF, and a selection of other text than the report holds refused ([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)) |
| `payment-part.ts`, `payment-part-fields.ts`, `part-actions.ts` | A report's QR-bill selected and edited as a component is: SIX's example a bill added from nothing starts from, the reference an IBAN of the other kind takes with it, a table over every term of the bill as fields and groups, the debtor optional, and the actions that add a part, add and remove an optional group, and add, move and remove an item of a list, each one step through the session ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) |
| `invoice-fields.ts` | A report's e-invoice selected and edited as a component is, never added: tables over every term of either kind as fields and groups -- the parties, the seller's contact, each VAT category with its moves and its Remove and the list's Add, the lines, the payment instructions, an XRechnung's own terms first -- a line's codes read from a detail field or an expression; the IBAN typed into the e-invoice, its QR-bill or an EPC QR code written by `setPaymentAccount` where every place writes it in the report, and by the field's own command where one reads it from the data (`properties.ts`), and a payment code added to the report -- the palette's EPC payment code, Add QR-bill -- paying the e-invoice's account (`palette.ts`, `payment-part.ts`, [0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)) |
| `languages.ts`, `word-fields.ts` | A report's languages ([0063](../decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)): the language edited, the editor's own and never the report's, the report's own until another is chosen, and given back to it when it goes; each language's name by Intl and its words missing, report-core's `word-missing` counted; the places the language edited lacks a word, a word's by report-spec's walk and an expression's by report-core's `wordExpressions`, marked on their boxes; the labels and the layout of the report as report-spec's `writtenIn` writes it; a field at a word writing its translation through `translateWord` or `translateExpression`; and the actions that choose a language and remove one |
| `geometry.ts`, `targets.ts` | The design view's layout and zoom, and drop targets from report-core's `validLocations` |
| `keys.ts`, `edits.ts` | `actionForKey`: which key does what, decided once for both builders |
| `images.ts`, `image-store.ts`, `asset-name.ts` | An image a person adds: refused before it is read past its bytes' bound, recognised from its bytes by report-spec's `sniffImage`, read by `imageHeader` or cleaned by `cleanSvg`, a CMYK JPEG refused in a Factur-X invoice, whose PDF is a PDF/A, and added to an XRechnung, whose copy is not (0038), its digest taken by `assetDigest`, named from its file's name, kept by the host's `ImageStore` and only then declared, in one step; the report's images as the state lists them, and Remove for one nothing draws (0033) |
| `text.ts` and `text-*.ts` | Every word, in English, Swiss German and Swiss French |
| `parts.ts` | The `data-report-part` hooks both builders render and `report-builder.css` dresses through the workbench's `--wb-*` variables; `view`, the region a host's view stands in, it does not dress. The stylesheet is an entry that imports its rules from `styles/` beside it, a file per reason to change, which the package publishes ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) |
| `scenarios.ts`, `scenario-*.ts` | `BUILDER_SCENARIOS`: what every builder must do, as data, found by role and accessible name, but for the hidden file input an `upload` hands its file to; what a step is and what a runner does for each kind (`scenario-steps.ts`); beside the list, the scenarios of a subject with fixtures of its own, a host's view, the payment codes, a QR-bill edited, an e-invoice edited (`scenario-e-invoice.ts`, 0044), what page 1 prints at its top (`scenario-first-page.ts`, 0060), images, a table's group (`scenario-table-group.ts`, 0059), a report's several tables, a second inserted and given its condition and a duplicate's condition warned of (`scenario-tables.ts`, [0062](../decisions/0062-a-report-holds-several-tables-over-its-detail-rows-each-printing-and-totalling-the-rows-its-condition-selects.md)), a report's languages (`scenario-languages.ts`, 0063) and a run set below or above the line (`scenario-baselines.ts`, 0061); and the image scenarios' files and the store `scenarioStore` gives each, which records what it kept (0033) |

### `@formancy/report-builder-react` and `@formancy/report-builder-angular` (L3)

Structurally parallel, and written twice on purpose. Each renders the state,
dispatches actions and moves focus, which only a builder can know about.

| Concern | React | Angular |
|---|---|---|
| Subscription | `use-editor-state.ts`, `useSyncExternalStore` | `editor-state.ts`, a signal; zoneless, `OnPush` |
| The whole editor | `report-builder.tsx`, whose `hostView` prop is the host's view | `builder.ts`, and `root.ts` for a host that arranges the parts; `host-view.ts`, the `reportHostView` template a host gives its view as |
| Panes | `toolbar.tsx`, `outline.tsx`, `palette.tsx`, `canvas.tsx`, `properties.tsx`, `diagnostics.tsx`, `places.tsx` | `toolbar.ts`, `outline.ts`, `palette.ts`, `canvas.ts`, `properties.ts` and `property-row.ts`, a field drawn by itself or in a group (0039), `problems.ts`, `places.ts`, `status.ts` |
| A pointer's drag | pointer events (`pointer-drag.ts`) | HTML drag and drop |
| Images (0033) | `image-chooser.tsx`, Add image… and its hidden file input; `image-library.tsx`, the report's images under its properties | `image-chooser.ts`, a directive on the hidden input, which the palette's Add image… opens; `image-library.ts` |
| Built by | tsdown | ng-packagr, finished by `scripts/finalize-angular-dist.mjs` |

Neither ships a stylesheet. The drag is the one behaviour bound differently:
both resolve the pointer through the model, but a touch device gets no drag
in Angular ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).
While the state's `view` is the host's, each draws a bare region in the
design view's place, named after the host's view, with no workbench class,
and leaves the keys pressed in it to the host ([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).
When a run's Subscript or Superscript is pressed, each reads one thing from
the DOM, the selection of the run's text field and the text it is of, and
adds it to the action; what it sets, and where the keyboard goes then, is
the model's ([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)).

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
intents with their profiles' bytes, and every image object by its number
and size with the soft mask it names, by which the renderer's order is
read ([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)). It refuses an encrypted PDF, a
name tree with /Kids, which it does not walk, and a soft mask that is no
reference to an image. `read-pdf.ts` reads the files
the name tree names too, so that a file's bytes come from two readers, and
`xmp.ts` reads the XMP strictly with saxes, each property by its namespace
and with its prefix. `objects.ts` reads with the pdf-lib the one PDF
reader is built on ([0054](../decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)), so a page that reader read is proved
with PDF.js, which shares no code with it, and never with `objects.ts`: a rule
review holds. `objects.ts`'s `inflatedDigest` hashes a PDF's objects
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
each expected drawing as a clip of its size with paint inside it, and its
`drawingsOn` reads every drawing of a page, path by path, as the README's
pictures record them, for those pictures, their test and the Studio's
browser gate
([0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md));
`check-ink.ts` holds a band of the page's pixels around each drawing to
white; `annotations.ts` reads every link a page carries; and
`fixtures/svg.ts` holds the SVG fixtures, in the bytes `cleanSvg` writes,
and `SVG_BOUND`, a drawing at each bound an e-invoice holds an SVG to, with
the smallest box the renderer draws it in, apart from `ALL_FIXTURES`, the
corpus the renderer trial ran on
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
A chart is no image object either, and no asset's drawing:
`check-charts.ts` proves each against the block it was drawn from, with
`check-chart-marks.ts` for its axis, bars and lines, `check-chart-pie.ts`
for its slices, `check-chart-labels.ts` for its legend and its values'
labels, and `check-chart-read.ts` for what they share; `drawings.ts`'s
`drawingsOf` places charts and SVG images in one walk, in document order
through every container, and `curves.ts` samples a curve along its whole
length, for the pie check and the renderer's tests of its arcs.
`fixtures/charts.ts` holds `CHART_FIXTURES`: a chart of each kind, a line
with a series of no value, a pie with a sliver, an empty chart, one at a
page's foot, charts in columns, in a host's face and of words written as
markup, and five the renderer refuses, each for its own reason. The
corpus depends on no renderer, so it reads a chart by copies of the
renderer's grid and axis colours, its share unit and its labels'
distance, which report-render-pdf's `corpus.test.ts` holds to its own
[0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md).
`fixtures/group-keep-with.ts`, `KEEP_WITH_FIXTURES`, is kept apart from it
too: group headers that keep three rows, each placed, for every plausible
number of rows a page, where one and where two of its rows would be left
room on its page, and a last group of two; `check-tables.ts`'s orphan
check holds a header whose row carries a count to that many of its rows
on its page, and every other header as it always has
([0059](../decisions/0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)).
`fixtures/titles-from-groups.ts`, `HEADERLESS_FIXTURES`, is kept apart
from it too: a table whose group headers name its columns, with no
header row, its groups placed as `group-boundary`'s for a page that holds
a row more, and beside it `fixtures/titles-from-groups-report.ts`, the
report as a person writes it, which both engines' tests resolve;
`check-tables.ts`'s `headerless` holds such a table's first line under
its top rule on every page, by the rules a page strokes, with no other
rule over that one and nothing between them however far above, and
`check-docx.ts` holds its Word file to no row marked to repeat
([0078](../decisions/0078-a-table-whose-every-column-title-prints-nothing-has-no-header-row.md)).
`fixtures/first-page-header.ts` holds `FIRST_PAGE_FIXTURES` apart from
`ALL_FIXTURES` too, a long grouped table under a letterhead taller than the page header,
under none and under a header shorter than it, which the trial's adapters
refuse (`trial/undrawn.ts`); `expectation` derives what page 1 shows of
its regions from the document's `firstPageHeader` (`ExpectedFirstPage`),
and `check-page.ts`'s `regionsOn` reads page 1 by its own header and every
other page by the page header, a line of the other header on a page found
wherever it stands
([0060](../decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)).
`fixtures/kept-heading.ts`, `KEPT_HEADING_FIXTURES`, is kept apart from it
too: a heading under one line at the top of the body and a run of two
headings, each over a table longer than any plausible page holds, held
by the lines each places on one page, `Expectation.onOnePage`, which
`check-layout.ts`'s kept-together check reads; no block keeps those lines
together, so the Word writer is not held to them
([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
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
Beside them, four e-invoice samples, the first a starter too, which a
person edits in either builder
([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)):
the German euro
invoice's firm invoicing German businesses, put together from the parts of
the euro invoice's head, table and bank details that
`starters/euro-invoice.ts` exports, with Germany's billing and words
(`starters/e-invoice.ts`,
[0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)),
the fourth naming every term past 0027's, its identifiers the
standard-setters' own examples ([0037](../decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)); and
an XRechnung sample, the first one's template made an XRechnung, to an
invented federal buyer by a Leitweg-ID of KoSIT's test suite
(`starters/xrechnung.ts`, [0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)),
a starter too, the one after the e-invoice, so that the Studio offers one
template in both kinds side by side, each billing its own buyer
([0065](../decisions/0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md)).
Two starters print what 0059 to 0063 added, letters of the same firm
([0064](../decisions/0064-an-order-confirmation-and-a-product-data-sheet-are-starters-that-print-what-0059-to-0063-added.md)):
the order confirmation (`starters/order-confirmation.ts`), one list of
order lines printed as three tables picked by their kind, its deliveries'
headers kept with three lines, the third meeting page 1's foot, and its
letterhead in page 1's own header; and the product data sheet
(`starters/product-data-sheet.ts`), its powers, index and footnotes'
marks set off the line, written in Swiss German with its words in
French, Italian and English, each language's words a table of
`starters/product-data-sheet-words.ts`.
Another letter pays the balance of a customer's overdue invoices by a
QR-bill in the customer's language
([0066](../decisions/0066-a-payment-reminder-is-a-starter-that-pays-the-balance-of-a-customers-overdue-invoices-by-a-qr-bill-in-the-customers-language.md)):
the payment reminder (`starters/payment-reminder.ts`), the customer's
open items printed as two tables picked by their kind, one aggregate over
every item printed as what is due and asked for by the slip, its
letterhead in page 1's own header, written in Swiss German with its words
in French, Italian and English, each language's words a table of
`starters/payment-reminder-words.ts`.
A further letter of the firm draws charts: the monthly sales report
(`starters/sales-report.ts`), a month's sales lines drawn as a bar chart
by product line and a pie by region beside one table of the same lines
grouped by the bar chart's category, every total to the centime, and its
letterhead in page 1's own header
([0067](../decisions/0067-a-monthly-sales-report-is-a-starter-whose-bar-chart-and-pie-print-the-totals-its-table-prints.md)).
`starters/logo.ts` holds the firm's mark, `LOGO`: the corpus's
`SVG_MARK`, named by the digest of its bytes as an approved asset is, and
`LETTERHEAD`, the mark 15 mm square and the gap under it, which the
quotation, both invoices, their samples, the e-invoice samples and the
product data sheet begin their report header with, and the order
confirmation, the payment reminder and the sales report page 1's own
header: the first template asset a starter draws.
`STARTER_IMAGES` holds it beside the inspection's photo, and
`starterImages` is the lookup over them that the corpus's, the renderer's
and the e-invoice gate's resolutions hand the runtime
([0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)).
`testing/cii.ts` reads the XML the runtime writes of them back with saxes,
by namespace, for their tests and, through the index, for the renderer's,
which read it out of the PDF they print.
`lines.ts` reads a run drawn at `SHIFTED_SIZE` of a run beside it, its
baseline moved by `SHIFTED_RISE`, into that run's line, and a run beside
one so read, a charge after its count, against the run on the line that
one was, and records each there, and `offLine` gives each such run with
the run it is read against, which the renderer's tests' line reader, the
README's pictures' among them, reads with (0064); `check-text.ts`'s `shiftedRuns` holds each run a document sets
below or above the line to its size and its move, and fails one read so
that the document does not set; `fixtures/shifted.ts` holds
`SHIFTED_FIXTURES`, formulas, units and marks that print, a lowered run
over a raised one on the next line among them, and the paragraphs the
renderer refuses, apart from `ALL_FIXTURES` as the SVG
fixtures are
([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)).
A Word file is read back by `docx/`, and by nothing of its writer's
([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)): `docx/zip.ts` walks the
zip's directory itself and inflates with Node's zlib, never fflate, and
refuses a name twice, a name that climbs out of the archive, data that
does not sum to its CRC-32 and an entry dated otherwise than the writer
dates every one (`ZIP_EPOCH`); `docx/package.ts` reads the parts by their
content types and every relationship to a part, as ECMA-376's Part 2 has
them, of any package of that part, and refuses a relationship to an
address and a part nothing reaches; `docx/xml.ts` reads a part with
saxes, each element by its namespace and never its prefix, against
`docx/vocabulary.ts`, the closed list of the elements and attributes a
written file holds and the order of each element's children, transcribed
from ISO/IEC 29500-4's transitional schemas; and `docx/read.ts`'s
`readDocx` returns what the file states, in points (`docx/model.ts`), or
throws naming the part. `check-docx.ts` and `check-docx-blocks.ts` judge
it: `verifyDocx` holds a file to the expectation the corpus derives from
the document for its PDF, for what a Word file can show of it, and block
by block to what the document states outright, by the corpus's own
reading of the record's table and never the writer's code; and
`wordRefusal` derives from a document what the writer must refuse of it.
`docx/testing/hand.ts` is a Word file typed out by hand and zipped by
Node's zlib, on which the reader and the checks are proved.
`fixtures/malformed.ts` holds `MALFORMED`, one document for each way a
document breaks its contract with an engine before anything is measured,
which both engines refuse by the same code and subject, its PNGs whose
image data is no zlib stream each held by `fixtures/malformed.test.ts` to
being wrong in the one way it says, by zlib's own error, and
`image-kinds.ts` `UNSEEN_JPEGS`, the JPEGs the writer refuses.
A code in a Word file is proved on the picture the file embeds
([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)):
`docx/png.ts`'s `readPng` reads the one kind of PNG a code is written as
back to its pixels, by its own walk of the chunks and Node's zlib, every
filter undone, and refuses any other file; `code-picture.ts`'s `codeGrid`
holds those pixels to a symbol drawn in whole pixels a module with its
quiet zone around it, four modules on every side and no more, found from
the pixels alone, and `readPictureCode` has ZXing read them, through
`codes.ts`'s `codesIn`, which `readCodes` reads a page with and which
refuses a code ZXing reads only mirrored, turned or with dark and light
exchanged; `check-docx-codes.ts` holds each code, block by block, to its
document -- the picture's extent, place and resolution, what it says and
at which level, the version of its square to the one ZXing reads, an EPC
QR code's version, and Austria's frame to the record's table, its
picture no wider than its cell -- so that `verifyDocx` is waited for;
`docx-codes.ts`'s `readDocxCodes` reads a file's codes for a test, as
`readCodes` a PDF's; `docx/testing/hand-codes.ts` is the file written by
hand those checks are proved on, its pictures made of the runtime's
symbols by Node's zlib; and `fixtures/codes.ts` holds `CODE_FIXTURES`,
the documents with codes both engines draw, apart from `ALL_FIXTURES` as
the SVG fixtures are, each way a code is refused being a document of
`MALFORMED`. `fixture.ts`'s `expectation` derives no key from a row
whose first cell the body prints again.
A QR-bill's slip in a Word file is proved on the page the file states
for it
([0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)):
`docx/read.ts` reads a file of two sections, the report's and after it
the slip's page, and refuses a section ended anywhere but by a paragraph
of the body itself; `check-docx-slip.ts` holds the page to A4 upright
with no margin at its sides and foot and no header or footer of the
report's, the slip to one row of three cells cut along its top and
between the first two, every line to where the exact heights the file
states put it, by SIX's millimetres written out there, at its size and
weight, a blank field to its four corner marks, no row that holds text
to an exact height, and the Swiss QR Code to a picture of whole pixels a
module with the Swiss cross in its pixels (`swissVersion`), which ZXing
reads with the white the slip leaves around it; `readSlipCode` reads a
file's slip's code for a test; `docx/testing/hand-slip.ts` is the file
written by hand those checks are proved on; and `fixtures/bills.ts`
holds the bills both engines' tests draw, SIX's examples and one whose
every value is as long as SIX allows, resolved by the runtime.
A copy of an e-invoice in a Word file is proved on every header the file
states
([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)):
`check-docx-copy.ts` holds the page header, page 1's own and a slip's
page's each to opening with the copy's label alone in its paragraph, at
8 pt, bold and in the label's red, and the slip's page's to holding
nothing else, 5 mm in from the paper's sides, while `check-docx-slip.ts`
holds that header 5 mm down where the document is a copy and at the
paper's edge, empty, where it is none; and its `copyRefusal` derives,
for `wordRefusal`, what the writer must refuse of a document labelled
otherwise than on every header.
A chart in a Word file is proved on the part the file holds
([0076](../decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md)):
`docx/chart-vocabulary.ts` is the closed vocabulary a `c:chartSpace` is
read in, transcribed from the transitional `dml-chart.xsd`, which holds
no `c:externalData`, no reference and no formula; `docx/chart.ts`'s
`readChart`, with `docx/chart-parts.ts`, `docx/chart-series.ts` and
`docx/chart-axes.ts`, which read what every reading shares, a series
and the axes, reads the part into the model and refuses one that two
drawings draw, that leaves a category for Word to name, or that leads to
any other part or states anything of a chart otherwise than a report's
chart does; `check-docx-charts.ts` holds each chart, block by block, to
its document -- its kind, its box, every word, each value's digits, the
axis from the lowest tick to the highest in their step, worked out in
BigInt of its own, the colours, and a chart with nothing to draw as its
words in its box; `docx-charts.ts`'s `docxCharts` reads a file's charts
for a test; `docx/testing/hand-charts.ts` is the file written by hand
those are proved on, each chart's part typed out; and
`fixtures/malformed-charts.ts` holds the charts of `MALFORMED`, each way
a chart's block is refused by both engines.
`trial/` keeps the renderer trial's adapters for pdfmake and pdfme as the
record of the trial
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).

### The applications

**`apps/studio`** is the playground: one report session and one editor per
starter (`workspace.ts`), either builder over it (`builder/`), and the
Preview, which resolves the session's document and prints it with the
renderer's browser entry, drawn by PDF.js on white paper (`preview/`),
and offers the PDF and, where a final render of an e-invoice wrote one,
its XML, the runtime's of that very render, to download; the picker names
an e-invoice starter by its kind, in the builder's words
(`starters/starters.ts`, [0065](../decisions/0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md)),
and lists first the starter the Studio opens on, the invoice, which
`OPENS_ON` names once by its corpus id, the corpus's others after it in
the corpus's order, which stays plan 7's, and Blank last; a corpus
without that starter is refused rather than opened on another
([0082](../decisions/0082-the-studio-opens-on-the-invoice-and-lists-it-first-and-the-corpus-keeps-its-order.md)).
Beside them it offers, as Download Word, the Word file `renderDocx` writes
of the document the PDF was drawn from, a report with a code (0074), a
chart (0076) or a QR-bill's slip (0075) among them, or a note that says why the writer refused it; of a final render of an e-invoice, whose document is the invoice, the Word file is the one written of its copy, which `preview/pipeline.ts` resolves once more from the same request with `eInvoice: 'copy'`, or the runtime's reason there is none ([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)): the writer is asked only once the PDF is drawn, from a chunk
of the build's own, and what it throws that is no refusal leaves the PDF
as it printed (`preview/pipeline.ts`,
[0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
`images/image-store.ts` keeps the starters' images and every image a person
adds in the page, by digest, for the tab's life: the store every editor is
made with and the lookup every Preview hands the runtime ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
`layout.ts` says where the Preview stands: beside the builder in a window
wide enough for the design view to hold a page beside it, and in the
builder's middle, as the editor's host view, in any other; the workspace
tells every editor it holds as the window crosses that width
([0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md),
[0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)). It
wears formancy.ai's room: `main.tsx` imports the released
`@formancy/themes/room.css` after the workbench, `styles/room.css` holds
only what is the Studio's own -- the text's two font stacks and the page --
and the builder is recoloured only through the workbench's variables
([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md),
[0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)).
Its `scripts/` hold the browser gate and the README pictures' walk, and
the gate's unit tests, which the Studio's suite runs.

**`apps/pages`** is the product's pages, prerendered by React's
`renderToStaticMarkup` into static HTML in German, French, Italian and
English. `src/groups.ts` is the list of pages, among them a page for each
payment code that shows its invoice's samples, and the invoices, Word files
and two report designers' pages, which share one layout,
`src/content/topic.tsx`, each with a copy of its own
([0081](../decisions/0081-the-start-page-names-pdf-and-word-pages-for-invoices-word-files-and-each-report-designer-join-it-and-every-package-names-keywords.md));
`scripts/inputs.mjs` reads the release, the licence's terms, the faces,
and the repository and the homepage the published manifests name -- the
repository by `repository.url`, the homepage the English start page (0081)
-- from this repository's files when it builds, and inlines formancy's room from the pages' own
`@formancy/themes` before the Studio's stylesheets (0034); `src/checks/` hold every page's head, links, words and
sitemap, every card's evidence and every word a page takes from the Studio
(0056), and that its footer links formancy.ai's legal notice and privacy
notice, which `src/links.ts` names beside the few other sites a page may
link to ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
[0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).
A page whose code no release had when it was written carries its status,
written against the newest release and said again at each release, and
`src/site.tsx` reads every page's before it renders any
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
[0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
Its `scripts/` hold its browser gate, `browser-test.mjs`, which takes the
Studio's gate's page reads from `apps/studio/scripts/gate-measure.mjs` and
its recorder from `apps/studio/scripts/gate-results.mjs`, so it needs the
Studio's install but not its build; `gate-imports.test.mjs` holds both to
importing no package of the workspace
([0053](../decisions/0053-the-product-pages-are-measured-in-chromium-by-a-browser-gate-of-their-own.md)).

### The repository's scripts

Not a package, and not shipped: the guards `pnpm test:repo` runs
(`scripts/*.test.mjs`), the install gate (`install-test.mjs`,
`install-hosts.mjs`, `install-fixture/`), the container gate
(`container.mjs`), the release report
(`release-report/`) and a release's pins (`release/`), the licence and
dependency guards, the demo's deploy (`demo.mjs`) and the pictures
(`pictures.mjs`, `pictures/`). [Verification](10-verification.md) says what
each gate proves.
