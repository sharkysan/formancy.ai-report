# 5. Building blocks

## Level 1 — the layers

Dependencies point downward only. The two packages at L2 do not know each
other: one path prints a report, the other edits one.

```
apps   studio                  the playground: both builders, the PDF, PDF.js        private
       pages                   the product's pages, static HTML                      private
────────────────────────────────────────────────────────────────────────────────────────────
L3     report-render-pdf       pdfmake · pdfkit · uqr · a Node entry and a browser entry
                               an e-invoice drawn as a PDF/A-3b that embeds its XML
       report-data-provider    @formancy/data-client: the one door to Data's records
       report-forms            @formancy/spec's validator: a form's submissions, handed over;
                               a report generated from a form version; a new version
                               reviewed, its resolutions report-core's commands as data
       report-server           Fastify · @formancy/data-identity: whoami, by the host's token
       report-builder-react    React · DOM            ┐ never each other,
       report-builder-angular  Angular · DOM          ┘ never the other framework
────────────────────────────────────────────────────────────────────────────────────────────
L2     report-runtime          every value decided once        no framework, no engine, no Node
       report-builder-core     the editor model                no framework, no DOM, no Node
       report-server-core      who may do what · the wire      no framework, no DOM, no Node
────────────────────────────────────────────────────────────────────────────────────────────
L1     report-core             commands · session · compileReport · @formancy/expressions
────────────────────────────────────────────────────────────────────────────────────────────
L0     report-spec             the format · validation · hash · @formancy/spec
                               the payment codes' rules: SIX's and the EPC's;
                               EN 16931's, for an e-invoice; an SVG asset's

beside report-corpus           private test support: the fixtures, the PDF reader and its
                               checks, readCodes, an SVG's drawings and their ink, a reader
                               of a PDF's objects and its XMP, the starters and samples, a
                               formancy form in two versions, its submissions and a report
                               generated from it, a reader of the e-invoice's XML; over the
                               runtime
```

Each row's three middle columns are its manifest's: what it depends on
among the workspace's packages, what else it installs, and its peers. Its
devDependencies are left out, so the corpus, every package's test support,
stands only where it is a dependency. The versions are the manifests'; the
README's [generated table](../../README.md#what-it-is-tested-with) gives
the upstream packages' and the peers' ranges.

| Package | Depends on, here | From elsewhere | Peers | What it may import, and what holds it |
|---|---|---|---|---|
| `@formancy/report-spec` | — | `@formancy/spec`, for the hash; `@noble/hashes`, for an asset's SHA-256 where it is added | — | No framework, no PDF engine, no Node: the format names no engine ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)). ES2023's library and no `@types/node`, so a DOM or Node global does not compile |
| `@formancy/report-core` | `report-spec` | `@formancy/expressions` | — | Those two and nothing else, with the same compile-time rule ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), [formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md)) |
| `@formancy/report-runtime` | `report-core`, `report-spec` | `@formancy/expressions` | — | No framework, no PDF engine, no Node, by the same rule; report-core for the one compilation it shares with the editor ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| `@formancy/report-builder-core` | `report-core`, `report-spec` | — | — | Those two, nothing else; no framework, no DOM, no Node ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-render-pdf` | `report-runtime` | `pdfmake`, `pdfkit`, `uqr` | — | Of this repository's packages, the runtime alone, which re-exports what the renderer needs of the format: report-spec's own rules for the slip and for how an EPC QR code prints ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)), the names an e-invoice's file is embedded by ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)), and `checkSvg`, the check an SVG asset is drawn by ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)), and report-spec's font reader, which its faces' glyphs are read by ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)), and `readFont`, `characterMap` and `refusedCharacter`, which a host's fonts are read, embedded and held to ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)). A resolved document and approved bytes in, never a database or an address ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)); an e-invoice's PDF/A also embeds the ICC profile PDFKit, pdfmake's own dependency, reads from its package, which `scripts/dependency-licences.mjs` holds to a review by its digest ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| `@formancy/report-data-provider` | `report-runtime`, `report-spec` | `@formancy/data-client` | — | The only package that may depend on Formancy Data; `scripts/dependency-licences.mjs` refuses Data reached from any other ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)). The DOM's globals and no `@types/node`, so a `node:` import does not compile |
| `@formancy/report-forms` | `report-core`, `report-runtime`, `report-spec` | `@formancy/spec`, for its validator, the version hash, labels, rich text and the diff, at the release the repository pins | — | The DOM's globals and no `@types/node`, as the Data provider, so a `node:` import does not compile; nothing reaches the network: a host hands each form version and submission over ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)), each form version a report is generated from ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)), and each a review compares a new one with; report-core because a review's resolutions are its commands, judged by its session and its compiler ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)). It never depends on Formancy Data, which `scripts/dependency-licences.mjs` refuses from any package but the provider |
| `@formancy/report-server-core` | `report-spec` | — | — | No framework, no DOM, no Node: ES2023's library and no `@types/node`, so a `node:` import or a `fetch` does not compile. The actions table, the identity it is asked about, the wire a client compiles against and the audit port ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)). Of this repository's packages, report-spec alone, for the two types the draft's wire names (`ReportDefinition`, `ReportError`), imported as types; the use cases that validate what a server stores join it with the records that build them |
| `@formancy/report-server` | `report-server-core` | `fastify`, `@fastify/rate-limit`, `@formancy/data-identity` | — | Node and Fastify; Formancy Data's identity verifier at exactly 0.3.0, the one Data package it may depend on, which `scripts/dependency-licences.mjs` admits for it alone ([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)). Never the runtime or the renderer, which its install host, holding only what it declares, would fail on; `src/composition.test.ts` fails on any module but `main.ts` that reads the environment or a file (0046) |
| `@formancy/report-builder-react` | `report-builder-core`, `report-core`, `report-spec` | — | `react`, `react-dom` | The core packages and React, never Angular or the other builder ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-builder-angular` | `report-builder-core`, `report-core`, `report-spec` | `tslib` | `@angular/core` | The core packages and Angular; `src/dependencies.test.ts` fails on React anywhere in its closure ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| `@formancy/report-corpus` | `report-runtime` | `pdfjs-dist`, `zxing-wasm`, `saxes`, `@pdfme/pdf-lib` | — | Private, never published: test support ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)). saxes reads the XML the runtime writes, a parser that is not the writer, in the corpus's tests and, resolved from the corpus, in the e-invoice gate's scripts (0027), and a PDF's XMP. pdf-lib reads a PDF's own objects, a reader that is neither the pdfkit that writes them nor PDF.js, in the corpus's tests and the renderer's and, through the corpus's built index, in the e-invoice gate, which reads what each PDF embeds with it and records each PDF by its digest (0031) |
| `apps/studio` (`@formancy/report-studio`) | `report-spec`, `report-core`, `report-runtime`, `report-render-pdf`, `report-builder-core`, `report-builder-react`, `report-builder-angular`: every package but the provider; and `report-corpus`, for its starters | `react`, `react-dom`, `@angular/core`, `@angular/common`, `@angular/platform-browser`, `rxjs`, `pdfjs-dist`, `@formancy/themes`, and the faces: `@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | — | Private; the PDF.js viewer lives here and in no published package ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)), and its faces are its own copies ([0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)) |
| `apps/pages` (`@formancy/report-pages`) | — | `react` and `react-dom`, for the server renderer; `@formancy/themes`, for formancy's room; and the faces: `@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | — | Private; formancy's room and the Studio's stylesheets by import, and facts read from the repository's files when it builds ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md), [0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) |

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
| `definition.ts`, `styles.ts`, `data.ts`, `assets.ts`, `values.ts`, `aggregates.ts`, `components.ts`, `table.ts` | `ReportDefinition` at `reportSpecVersion` `'0'`, the draft, with its five regions and its provenance; and each part it declares in a module named for it: print styles, the datasets and parameters it reads, assets, values (expressions, formats and the runs of text), aggregates, components and the table. Its page is `page.ts`'s |
| `version.ts` | Whether a document is a report this package reads at all, before anything about what it holds; a form or another version is refused naming both ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)) |
| `validate.ts` and `validate-*.ts` | Structural validation, every error with a JSON Pointer and a stable code (`errors.ts`): declarations, components and where each may stand, inlines and formats, the table, aggregates, the payment part, the EPC QR code and the e-invoice, the texts of all three read by `validate-payment-text.ts`; and where a dataset is read from a formancy form's submissions, each field's data path, member and choice (`validate-form-binding.ts`, `isFormPath` in `syntax.ts`), the shape alone, which version holds what being report-forms' to say ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)), and a binding's overrides for one form version at a time, keyed by its hash, another path, nothing of a nullable field or another repeater ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)). Kinds are tables, not switches |
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
| `walk.ts` | The one walk of the components that the core's commands, the builder's outline and the runtime share |
| `font.ts`, `font-*.ts` | A font's bytes ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)): `readFont`, which reads a static TrueType font whole -- the names (`font-names.ts`), the embedding its OS/2 fsType allows and the fixed tables (`font-tables.ts`), the outlines walked for their structure (`font-outlines.ts`) -- or refuses it with one of `FONT_REFUSAL_CODES` and what to do (`font-refusal.ts`); and `characterMap`, the characters a font maps, read from the subtable fontkit takes, in format 4 or 12, as fontkit reads it (`font-cmap.ts`), which `readFont` reads too. Every read checked against the bytes, a table read where its record says and its recorded length read as fontkit reads it (`font-file.ts`), nothing recursing on what a font holds, and nothing the font chose in a refusal but a number the reader decoded; the horizontal header's line held to what pdfmake can lay out, `MIN_FONT_LINE` to `MAX_FONT_LINE` ems; the outlines' points, points times contours and composite components bounded together, what a subset of them costs PDFKit ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)). `font-test-support.ts` makes the tests' fonts from their tables and is never exported |
| `font-map.ts`, `font-scripts.ts` | The font map a report declares and the characters it prints ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)): the `FontMap` mapping each of `FONT_FAMILIES` to a `FontFaces` of asset ids, which `validate-font-map.ts` holds to the font assets they name, an image asset mapped a face refused `asset-not-a-font` and a style that sets bold or italic in a mapped family without that face `missing-face`; and the characters a report prints, by an allowlist of Unicode blocks from `Blocks.txt` 18.0.0 -- Latin, Greek and Cyrillic and the punctuation, symbols and marks written with them -- but for the bidirectional controls (`PRINTED_BLOCKS`, `BIDI_CONTROLS`, `refusedCharacter`), which the renderer applies in every face, every other script refused until a fixture proves it |
| `svg.ts`, `svg-*.ts` | An SVG asset ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)): `cleanSvg`, which reads the file's bytes once where the asset is approved, removes and lists what never draws, refuses what would draw unsafely or otherwise than a browser draws it, and writes the rest in one canonical form; and `checkSvg`, which accepts only that form and says what it costs to draw and to paint. A tokenizer of its own, on bytes, with no `TextDecoder` and no DOM (`svg-syntax.ts`); what is kept, removed and refused as tables, not switches (`svg-allow.ts`); CSS and its cascade (`svg-style.ts`); the costs `MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS` bound (`svg-cost.ts`); the extent, how far the numbers the converter writes for a drawing reach wherever it is placed and how deep it nests, which the renderer holds an e-invoice's SVG to and nothing here refuses by (`svg-extent.ts`); and the writer, which builds from its own tree and never copies the input (`svg-write.ts`) |

### `@formancy/report-core` (L1)

`openReportSession` holds one document, its revision and its history; every
change is a command that a session commits only when the validator accepts
the result ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).

| Module | Responsibility |
|---|---|
| `session.ts`, `snapshot.ts` | Commit, frozen snapshots sharing what did not change, undo and redo to `DEFAULT_HISTORY_LIMIT` steps, listeners, the stale-hash refusal |
| `draft.ts` | Several commands as one edit, and `tryEdit`: the verdict on a draft without committing it, which a proposal's review would show |
| `commands/` | Pure commands on the document, the components, the declarations, the table and the payment part, `addAsset` among them, which refuses an id already declared where `putAsset` would replace it, and `putPaymentPart`, `updatePaymentPart` and `removePaymentPart` (`commands/payment-part.ts`), which judge nothing of the bill, and `putEInvoice`, `updateEInvoice`, `removeEInvoice` and `setPaymentAccount` (`commands/e-invoice.ts`), the last writing the account an e-invoice shares with its QR-bill and every EPC QR code into all of them in one edit, refused where one reads it from the data ([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)); `registry.ts` makes each a descriptor a proposal can carry, its arguments checked before it runs, and lists in `PART_COMMANDS` the commands that may change a part of the report's own level, `replaceDocument` among them, every other keeping it ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)); `ids.ts` the one rule a new component's id, a copy's and an added asset's are made by (0033); `registry.ts`'s `batch`, several descriptors as one command, validated once at its end and refused whole, a step that throws on what the steps before it left refused, listed in `PART_COMMANDS` beside `replaceDocument`, and `commands/readers.ts`'s `removeFieldWithReaders`, a field with every component, column, style rule alone, footer cell and the row it leaves empty, sort key, group and aggregate that reads it, a field the bill or the e-invoice reads refused; its `fieldReaders`, that walk made once for many fields, the removal and the expressions a change of a field's type reaches ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)) |
| `locations.ts`, `tree.ts` | Where a component stands, and `validLocations`: the places it may go, found by trying each |
| `expressions/` | What an expression reads, asked of the parser the compiler asks, for the diagnostics and the removal alike (`expressions/reads.ts`, 0048); `compileReport`: every expression compiled where it stands, or those asked for alone with every aggregate's, as a review compiles what a change of one field's type reaches (0048), each member checked as its type, the clock, doubles, division and `matches()` refused, and the order aggregates are computed in ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)). In a report with an e-invoice, and in no other, `invoice`, `vatBasis` and `vatAmount` are bound wherever `totals` is, and refused where they are computed from (`expressions/e-invoice.ts`, 0027) |
| `diagnostics/` | What an editor shows about a valid report: the errors the runtime would refuse it for, and warnings an author probably wants; in an e-invoice, a total the XML holds that the page does not print, or prints otherwise than the XML holds it (`diagnostics/e-invoice.ts`, 0027); and a QR-bill that holds, written in the report, one of report-spec's `QR_BILL_EXAMPLE_ACCOUNTS` or the creditor, the debtor or the QR reference of its `QR_BILL_EXAMPLE` (`diagnostics/example-payment-part.ts`, [0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)). `diagnostics/parts.ts` is the one walk of what a report names: every expression where it stands, and every field and aggregate named outside one, where it is named (`named`), which the removal with readers reads (0048) |

### `@formancy/report-runtime` (L2)

`resolveReport` turns a report and its data into a `ResolvedDocument`, a
manifest and a preview's warnings, or every reason it will not
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
Each stage is a module, and each decides its question once:

| Module | Responsibility |
|---|---|
| `input.ts`, `data.ts`, `values.ts`, `parameters.ts` | The data contract: read once without running anything, every value held to its field's type, undeclared fields refused, bounded by `MAX_DETAIL_ROWS` |
| `source.ts` | Where the data came from, which the manifest carries: each submission of a formancy form with its form's id and the `schemaHash` of the version that collected it, or the Formancy Data form each dataset was read from; held to the syntax of identifiers, by report-spec's `isFormId` and `isSchemaHash`, the provenance's own rules, and a submission id's syntax of its own, `isSubmissionId`, which the form bridge reads too (0042), and to no key its shape does not name; no more submissions than the detail rows given, which `data.ts` counts, and a provider it does not know refused ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)) |
| `evaluate.ts` | The expressions report-core compiled, evaluated with fixed capabilities within `EXPRESSION_STEP_BUDGET` each and `RENDER_STEP_BUDGET` a render |
| `sort-group.ts`, `totals.ts`, `decimal.ts` | Row order and groups; aggregates computed exactly, BigInt and upstream's `Decimal`, rounded once as declared |
| `format.ts`, `inlines.ts`, `styles.ts` | Every value as the text it prints, for the report's locale, through Intl handed exact digits |
| `lower.ts`, `lower-table.ts`, `images.ts` | The components lowered to blocks; images through the host's lookup, once per render, an SVG's answer refused past `MAX_SVG_BYTES` before it is copied (0030) |
| `lower-fonts.ts` | The fonts a report maps, resolved to the bytes the renderer embeds through the same host lookup, widened to assets (`AssetResolver`): each face fetched once, its media type held and its size before its bytes are copied, the copy read with report-spec's `readFont` before they are handed on, a face the host cannot give or that the reader refuses refusing the render, in a preview too ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)) |
| `qr-bill.ts`, `lower-payment-part.ts` | A QR-bill's payload and every text its slip prints, held to report-spec's rules once the data has resolved them ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `lower-epc-qr-code.ts` | An EPC QR code's payload: each text read as a paragraph's and held to report-spec's rules once the data has resolved it, an optional one that prints nothing left unused, and the whole held to the EPC's bytes ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `lower-e-invoice.ts`, `e-invoice-lines.ts`, `e-invoice-totals.ts`, `e-invoice-terms.ts`, `e-invoice-payable.ts` | An e-invoice of either kind, by the same readers, each term held to its kind's rules, after the aggregates and before anything is lowered: its lines read once from the rows of the table that prints them, the table printing the very values kept; its totals and VAT breakdown computed once, in `Decimal`, each category's VAT rounded once and never per line; its other terms held to report-spec's rules once the data has resolved them; and, while the codes are lowered, a payment code printed with it held to the amount due and the account ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| `cii.ts`, `cii-parties.ts`, `xml.ts` | The CII XML a final render writes from those values, each element in the profile XSD's order and at the path CEN's binding gives its term, written one way, so that the same report and data are the same bytes; a term the invoice does not hold, the business process, an electronic address or the seller's contact among them, no element at all (0037). A preview writes none (0027) |
| `document.ts` | The renderer-neutral document and the refusal codes; and an e-invoice's file, by its kind: a Factur-X file, its XML with the name, relationship and conformance level it is to be embedded by, or an XRechnung's, its XML with its syntax, guideline and version, which a host takes and sends; `resolve.ts` heads every page of an XRechnung's document with `XRECHNUNG_COPY_LABEL` in the labels' style, a paragraph it exports frozen, `XRECHNUNG_COPY_PARAGRAPH` ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)) |

### `@formancy/report-render-pdf` (L3)

`renderPdf` draws a resolved document with pdfmake, or rejects with a
`RenderRefusal` before any PDF is written
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
It is a package boundary, not an engine interface: there is one engine.

| Module | Responsibility |
|---|---|
| `node.ts`, `browser.ts`, `engine.ts` | The two entries: pdfmake's Node build reading font files, or its browser build reading virtual ones. Only that differs. Each hands PDFKit's document, laid out and not yet ended, to the final pass's `finish`, the one hook an e-invoice is embedded through ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)). The browser entry imports Liberation Sans's chunk with the first document that has a QR-bill or a captioned EPC QR code, and never for a document with neither, which `report-render-pdf/src/browser.test.ts` holds ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `image-order.ts` | The images PDFKit is still decoding when pdfmake hands its document over -- a PNG with an alpha channel, a palette's transparency or interlacing -- written in the order pdfmake opened them, whichever decode finishes first, so that their soft masks are numbered, and they are written, in that order: the body's images first, then the page regions'. `engine.ts`'s `written` calls it in both entries; it wraps the `finalize` of each such image in PDFKit's registry, typed at the boundary, and of none where one cannot be wrapped ([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)); the package pins PDFKit at the release those details were read in, importing nothing of it ([0036](../decisions/0036-the-renderer-pins-pdfkit-at-the-release-0035-was-read-against-until-pdfkit-writes-images-in-the-order-it-embeds-them.md)) |
| `render.ts` | The passes, each a pdfmake layout: measure the page regions, measure kept blocks and table rows, then lay out the PDF, with an abort read between them; an e-invoice's file and XMP are added on that last pass alone |
| `check.ts`, `glyphs.ts`, `widths.ts`, `assets.ts` | What is refused before pdfmake sees the document: a character without a glyph, by the faces' maps report-spec's `characterMap` reads, through the runtime ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)), a face a mapped family does not map, a page field's digits in its face, and a character of any script but Latin, Greek and Cyrillic, or a bidirectional control, by code point ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)), what is malformed or wider than where it stands, image bytes that are not what they say, a PNG's or a JPEG's structure read by report-spec's `imageHeader` and a PNG's image data inflated here, an SVG not in the form `cleanSvg` writes, and SVGs past what a render may draw (`MAX_SVG_DRAWING`, an image in a page region counted on every page) or a page may cost a reader (0030); and in an e-invoice, a CMYK JPEG, which its PDF/A cannot hold beside its sRGB output intent |
| `host-fonts.ts`, `face-identity.ts`, `strip-layout.ts` | The fonts a report maps, resolved for the render ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)): `planFonts` reads each face with report-spec's `readFont` in every render, keeping nothing for the next, takes its glyphs and its line, refuses with `drawnAs` a face PDFKit would draw as another -- one of another face's PostScript name with other bytes, the renderer's own Roboto and Liberation Sans included, or of `null` or a name every object has -- and embeds one of the renderer's own bytes whole, and `withoutLayoutTables` strips the records fontkit runs at print -- GSUB, GPOS, GDEF, kern and `morx`, read from fontkit 2.0.4 -- so that a crafted one neither hangs nor crashes a render, closing 0040's open risk; the stripped bytes go into pdfmake's virtual files under names of the render's own, written for each pass and removed from `storage` after it by `engine.ts`'s `registerHostFonts`, so two renders at once never share one. A token a report leaves unmapped prints in Roboto (`sans`) or is refused (`serif`, `mono`), as before; the slip keeps Liberation Sans |
| `bound.ts`, and `check.ts`'s `refuseTall` | What is refused between the passes, once the page regions are measured: a block of fixed height or a line taller than a page's body, and a body whose least height already needs more pages than the limit, each line counted by the face it prints in, a paragraph's by its tallest run's and a table's cells by `table.ts`'s `styledRows`, the one walk `tableContent` builds the table from and check.ts holds its cells to ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)) |
| `words.ts` | What is refused inside every pass, once pdfmake has measured the words and before it lays out a line: a word wider than its table column, or longer than `MAX_WORD_LINES` lines of its paragraph, read from pdfmake's own `_minWidth` ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| `breaks.ts`, `table.ts`, `table-rules.ts` | Where a table's pages break, planned from measured heights, so a group header stays with its first row and totals with the last |
| `qr.ts` | A QR code encoded once by uqr and drawn as one vector path ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)) |
| `bill.ts`, `slip.ts`, `bill-fonts.ts` | A QR-bill's slip as SIX lays it out, in the Liberation Sans the package ships in `fonts/`; `bill-fonts.ts` is those faces for the browser entry's chunk ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| `e-invoice.ts`, `pdfa.ts` | An e-invoice the renderer knows, and how it is drawn. `checkEInvoice` refuses, as `unsupported` and before pdfmake sees the document, a file whose name, relationship or conformance level is not report-spec's, XML holding a lone surrogate, and a title PDFKit cannot write into the XMP ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)). `pdfa.ts` makes the document a PDF/A-3b (`PDF_A_3B`) and, through the final pass's hook, embeds the runtime's XML as `factur-x.xml`, changed in nothing, and appends the fx properties and their extension schema to PDFKit's XMP; every other report is drawn as it was ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)). An XRechnung's file is known by its syntax, version and guideline and drawn as no PDF/A, a CMYK image drawn in it, its copy refused where its page header does not open with the runtime's label paragraph, `XRECHNUNG_COPY_PARAGRAPH`, style and all (`checkCopyLabel`); an e-invoice of a kind it does not know is refused ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)) |
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
| `answers.ts` | A submission walked by the version's model, an answer under no data path of it refused, and a matrix's answer held whole to the version's rows and columns; each string held to the runtime's `MAX_STRING_LENGTH` before it is read, each answer read as its kind stores it, a choice's label from the version in the report's locale or the host's `labels`, and held to its type by the runtime's `readValue`; a refusal of what an answer holds at the field's own path |
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
a client say to each other ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)). The use cases and the
stores' ports join it with the records that build them.

| Module | Responsibility |
|---|---|
| `actions.ts` | `CAPACITIES`, the three the settings give the host's roles; `ACTIONS`, every action with the capacities that may take it, frozen; `can(identity, action, policy)`, an action the table does not hold denied, no capacity implying another, roles compared as the host spells them; `capacitiesOf` and `actionsOf`, what whoami answers |
| `identity.ts` | `ReportIdentity`: the subject, the tenant, never empty, and the roles, derived from a verified token alone |
| `wire.ts` | `API_PREFIX`, `/v1`, the API's version line (0046, extending [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)); `ROUTES`, every route the API answers with its audit operation; `WhoAmI` and `Health`; `DRAFT_FORMAT` and the draft slice's wire types (`TemplateSummary`, `TemplateList`, `Draft`, `DraftSaved`, `ImageKept`); `REFUSALS`, a code and a fixed sentence for every refusal, and `ServerRefusal`, the four that carry a field beside it; `CROSS_ORIGIN_REQUEST_HEADERS` |
| `audit.ts` | `AuditEvent`, one request an API route answered, never a value, who by keyed hash; and `AuditSink`, the port it goes through |

### `@formancy/report-server` (L3)

`createReportServer(options)` is a Fastify server over a verifier,
the operator's role policy, an audit sink and the rate limit, proxies and
origins, each held to its setting's rule before anything is built; and
`main.ts` the composition root that reads the settings once and serves it
(0046, [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).

| Module | Responsibility |
|---|---|
| `app.ts` | The server: `no-store` on every answer, the rate limit by client address, a first hook answering a path that is not plain 400 and a request no route answers 404, each counted and before its body is read, the cross-origin hooks, `/health` and HEAD on it, and the API in a context of its own whose preHandler verifies the token -- every bad one the one 401 -- before `/v1/whoami` answers; an error a request caused the fixed 400 sentence with its status, an error of its own the one 500; Node's request timeout; the log naming a request by its method and route |
| `paths.ts` | `plainPath`: a target with nothing in it a proxy could normalise, by formancy.ai-data 0037's rule |
| `client-errors.ts` | `answerClientError`: what Node's parser cannot read answered with the fixed refusal and `no-store`, the connection closed, nothing logged |
| `identity.ts` | `createReportVerifier`: data-identity's verifier, built once, with the tenant's claim mapped and required, a token without it refused, and the identity handed on frozen |
| `audit.ts` | The trail's hooks: one event per answered request, from `onResponse`, or `onSend` or the connection's close for a client that left; a route with no name in `ROUTES` stopping the server; `auditReference`, who by HMAC over a JSON array; the audit key's 32-byte floor; `logAuditSink`, one log line per event |
| `settings.ts` | `SETTINGS`, every setting the server reads, which the package README lists; `readSettings(env)`, the environment handed to it parsed into what the server runs on or every reason it does not start, a `FORMANCY_REPORT_` variable it does not read and a secret reference to one of the server's own among them, no sentence repeating a value |
| `rate-limit.ts`, `proxies.ts`, `cors.ts` | The rate limit, the trusted proxies and the origins, each a setting's rule and an embedder's, formancy.ai-data's (its 0034, 0071, 0060): `clientAddress`, the address a request is counted and logged by; `crossOrigin`, the preflight routes, the origin carried back, and a token-bearing request from an unlisted origin refused before its token is read |
| `serve.ts` | `openReportServer(settings, io, logger)`: the identity key and the audit key opened through the source main.ts hands over, the audit key refused when it is the identity key, every refusal one sentence; `readAgainOnSignal`, the key set read again on SIGHUP and the log saying what changed by kid |
| `main.ts` | The composition root: the environment read once, the server opened and served, SIGHUP and SIGTERM handled |

`Dockerfile` beside `src/` is the image ([`packages/report-server/Dockerfile`](../../packages/report-server/Dockerfile)), held by `src/dockerfile.test.ts` and run by the container gate: its code root's, the store's directory the one thing its user owns.

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
| `model.ts`, `model-actions.ts`, `model-canvas.ts`, `model-properties.ts` | The state's types, a file per reason to change: the state itself, the outline and the selection; what a builder dispatches and is told back; the design view; the properties, a group's buttons each saying whether it has somewhere to go and where the keyboard goes once it is done ([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)) |
| `outline.ts`, `palette.ts`, `properties.ts`, `property-fields.ts`, `selection.ts` | The tree a keyboard walks, the payment part's row after the regions among it, what may be inserted, and each property as a field whose typed value becomes a command, by itself or in a group of fields with its one button. An EPC payment code's fields stand in the order the code holds its elements, and a new one's square is one every payload the EPC allows prints in, with Austria's frame and without ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| `payment-part.ts`, `payment-part-fields.ts`, `part-actions.ts` | A report's QR-bill selected and edited as a component is: SIX's example a bill added from nothing starts from, the reference an IBAN of the other kind takes with it, a table over every term of the bill as fields and groups, the debtor optional, and the actions that add a part, add and remove an optional group, and add, move and remove an item of a list, each one step through the session ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) |
| `invoice-fields.ts` | A report's e-invoice selected and edited as a component is, never added: tables over every term of either kind as fields and groups -- the parties, the seller's contact, each VAT category with its moves and its Remove and the list's Add, the lines, the payment instructions, an XRechnung's own terms first -- a line's codes read from a detail field or an expression; the IBAN typed into the e-invoice, its QR-bill or an EPC QR code written by `setPaymentAccount` where every place writes it in the report, and by the field's own command where one reads it from the data (`properties.ts`), and a payment code added to the report -- the palette's EPC payment code, Add QR-bill -- paying the e-invoice's account (`palette.ts`, `payment-part.ts`, [0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)) |
| `geometry.ts`, `targets.ts` | The design view's layout and zoom, and drop targets from report-core's `validLocations` |
| `keys.ts`, `edits.ts` | `actionForKey`: which key does what, decided once for both builders |
| `images.ts`, `image-store.ts`, `asset-name.ts` | An image a person adds: refused before it is read past its bytes' bound, recognised from its bytes by report-spec's `sniffImage`, read by `imageHeader` or cleaned by `cleanSvg`, a CMYK JPEG refused in a Factur-X invoice, whose PDF is a PDF/A, and added to an XRechnung, whose copy is not (0038), its digest taken by `assetDigest`, named from its file's name, kept by the host's `ImageStore` and only then declared, in one step; the report's images as the state lists them, and Remove for one nothing draws (0033) |
| `text.ts` and `text-*.ts` | Every word, in English, Swiss German and Swiss French |
| `parts.ts` | The `data-report-part` hooks both builders render and `report-builder.css` dresses through the workbench's `--wb-*` variables; `view`, the region a host's view stands in, it does not dress. The stylesheet is an entry that imports its rules from `styles/` beside it, a file per reason to change, which the package publishes ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) |
| `scenarios.ts`, `scenario-*.ts` | `BUILDER_SCENARIOS`: what every builder must do, as data, found by role and accessible name, but for the hidden file input an `upload` hands its file to; what a step is and what a runner does for each kind (`scenario-steps.ts`); beside the list, the scenarios of a subject with fixtures of its own, a host's view, the payment codes, a QR-bill edited, an e-invoice edited (`scenario-e-invoice.ts`, 0044) and images; and the image scenarios' files and the store `scenarioStore` gives each, which records what it kept (0033) |

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
(`starters/xrechnung.ts`, [0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).
`starters/logo.ts` holds the firm's mark, `LOGO`: the corpus's
`SVG_MARK`, named by the digest of its bytes as an approved asset is, and
`LETTERHEAD`, the mark 15 mm square and the gap under it, which the
quotation, both invoices, their samples and the e-invoice samples begin
their report header with: the first template asset a starter draws.
`STARTER_IMAGES` holds it beside the inspection's photo, and
`starterImages` is the lookup over them that the corpus's, the renderer's
and the e-invoice gate's resolutions hand the runtime
([0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)).
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
Its `scripts/` hold the browser gate and the README pictures' walk.

**`apps/pages`** is the product's pages, prerendered by React's
`renderToStaticMarkup` into static HTML in German, French, Italian and
English. `src/groups.ts` is the list of pages, among them a page for each
payment code that shows its invoice's samples; `scripts/inputs.mjs` reads
the release, the licence's terms and the faces from this repository's files
when it builds, and inlines formancy's room from the pages' own
`@formancy/themes` before the Studio's stylesheets (0034); `src/checks/` hold every page's head, links, words and
sitemap, and that its footer links formancy.ai's legal notice and privacy
notice, which `src/links.ts` names beside the few other sites a page may
link to ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
[0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).
A page whose code no release had when it was written carries its status,
written against the newest release and said again at each release, and
`src/site.tsx` reads every page's before it renders any
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
[0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).

### The repository's scripts

Not a package, and not shipped: the guards `pnpm test:repo` runs
(`scripts/*.test.mjs`), the install gate (`install-test.mjs`,
`install-hosts.mjs`, `install-fixture/`), the container gate
(`container.mjs`), the release report
(`release-report/`) and a release's pins (`release/`), the licence and
dependency guards, the demo's deploy (`demo.mjs`) and the pictures
(`pictures.mjs`, `pictures/`). [Verification](10-verification.md) says what
each gate proves.
