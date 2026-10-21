# Architecture decision records

Every decision here was actually made, in the order the numbers suggest, while
building Formancy Report, but for 0027, which was numbered before 0028 and
merged after it, and says so, and 0031, which was numbered while 0029 and
0030 were held by branches not yet merged, and says so too, as 0034 does
of 0033. Where a decision was reversed or narrowed later,
the record says so and points at the one that superseded it. Where a decision
rests on one made in formancy.ai or in Formancy Data, the record cites it as
`formancy.ai NNNN` or `formancy.ai-data NNNN` with a link, and does not
restate it.

## Why these exist

Two audiences:

1. **Contributors**, who need to know why the obvious simpler thing was not
   done, so they do not helpfully undo it.
2. **Customers and evaluators**, deciding whether to build on this module, who
   want the reasoning and not just the result — especially about the licence
   and about what the module refuses to do with their data and their documents.

## Format

The format is formancy.ai-data's:
[MADR](https://adr.github.io/madr/)-shaped, trimmed to what is load-bearing.

```markdown
# NNNN — Title in the imperative

- **Status:** accepted | superseded by NNNN | reversed
- **Date:** YYYY-MM-DD
- **Deciders:** who
- **Verified by:** the tests, gates or files that hold this decision in place

## Context

The forces. What was true when the decision was made.

## Decision

What was decided, in one or two sentences.

## Consequences

What this buys, what it costs, and what it forecloses. The cost paragraph is
not optional: a record with no downside is marketing, not a decision.

## Alternatives considered

Each with the reason it lost.
```

**Verified by** is the field that distinguishes a decision record from an
opinion. If a decision is load-bearing, something in the repository fails when
it is violated — a test, a CI gate, a script the workflow runs. A record whose
only enforcement is "we remember" says so plainly.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-a-paid-module-in-its-own-repository.md) | A paid module lives in its own repository, under Formancy Data's terms, in force before a lawyer has read them | accepted |
| [0002](0002-depend-on-upstream-never-copy-it.md) | Depend on released upstream packages at exact versions; never copy them | accepted |
| [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md) | A rendered report is proved on the PDF it produced, read back with PDF.js; never on the engine's input, never through a mocked engine | accepted; extended by 0020, 0025, 0030 and 0031 |
| [0004](0004-three-version-lines-each-refused-when-unknown.md) | Three version lines -- formancy's form spec, Report's format, Formancy Data's contract -- each refused when unknown; package versions alone establish nothing | accepted; extended by 0014 |
| [0005](0005-pdfmake-renders-reports-behind-one-adapter.md) | pdfmake renders version 1's reports, behind one adapter that refuses rather than truncates; pdfme lost on the corpus, and HTML engines and Prince were not trialled | accepted; its claim that pdfmake reads no file but its fonts narrowed by 0030; amended by 0031, under which an e-invoice's render reads PDFKit's ICC profile besides the fonts; extended by 0035, under which one document renders to the same bytes with images PDFKit decodes before it embeds |
| [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md) | Every production dependency and every font a published package ships is under a permissive licence; GPL, AGPL, non-commercial and unlicensed are refused | accepted; extended by 0016, 0022 and 0031 |
| [0007](0007-a-report-definition-is-its-own-versioned-document.md) | A report definition is its own versioned document, with a flowing body, one detail table, declared aggregates and print styles as tokens | accepted; extended by 0020, 0022, 0025, 0027 and 0030 |
| [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md) | Edits are commands, and a refused edit changes nothing | accepted |
| [0009](0009-an-expression-is-checked-and-bound-member-by-member.md) | An expression is checked and bound member by member, by one compilation the editor and the runtime share | accepted; extended by 0027 |
| [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md) | The runtime resolves a report into a renderer-neutral document, exactly, or refuses it: data held to its contract, totals exact and rounded once, values formatted once | accepted; extended by 0022, 0025, 0027 and 0030, which corrects its reason for trusting digests |
| [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md) | `report-render-pdf` draws the whole resolved document with pdfmake, and refuses what it cannot draw whole | accepted; extended by 0020, 0022, 0025, 0027, 0030, 0031 and 0035 |
| [0012](0012-the-builders-are-native-and-share-one-session.md) | The builders are native, share one session through one editor model, and are held to each other by shared scenarios | accepted; its untested parts held by 0013's Studio; extended by 0033 |
| [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md) | The Studio is formancy.ai's room with a report builder in it, its PDF.js viewer stays inside it, and its README pictures are taken by a script | accepted; its faces the build's own since 0023; its copied palette superseded by 0034; extended by 0033 |
| [0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md) | A release report is derived from the run that gated the release, and says what it did not test | accepted; its SBOM made by 0017, and extended by 0027 and 0031 |
| [0015](0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md) | The getting-started guide's code is compiled and run by the install gate, against the packed packages: the Node program, a React page of its own, and the Angular page in the builder's hosts | accepted |
| [0016](0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md) | The Data provider reads Formancy Data 0.1.0 best-effort, as the person whose token it carries, and checks what it can before it reads a record; Data's packages are admitted by 0006's guard for it alone | accepted |
| [0017](0017-the-sbom-describes-what-a-consumer-installs.md) | The SBOM describes what a consumer installs: the published tarballs, installed by npm with no script and no peer, and held to the packages a consumer's install brings | accepted |
| [0018](0018-the-studio-demo-is-served-at-formancy-ai-report.md) | The Studio's demo is served at formancy.ai/report/ by a Worker of its own, from a build with a relative base that the browser gate serves under that path, and Cloudflare deploys it from main on every push | accepted; extended by 0021, and its gate's font exception gone since 0023 |
| [0019](0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md) | A person hides the builder's side panes and the Studio's Preview for the design view's room, and the Studio puts the Preview beside the builder only where the design view holds a page | accepted; its Preview under the builder superseded by 0029 |
| [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md) | A QR code is encoded by uqr and drawn from its own matrix, exactly its size with its quiet zone inside it, and refused where its text fits no version or its modules would be finer than 0.4 mm; pdfmake's own `qr` node and bwip-js lost | accepted; extended by 0022, 0025 and 0030 |
| [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md) | The product's pages are static HTML, prerendered in German, French, Italian and English, built in this repository and served beside the Studio at formancy.ai/report/ by its Worker | accepted; its faces its own copies since 0023, and extended by 0024 and 0028; its room by the Studio's copy superseded by 0034 |
| [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md) | A report carries at most one Swiss QR-bill, a payment part at the foot of its last page: SIX's rules are one set of checks in report-spec that the validator applies to literals and the runtime to data, and the slip is drawn to SIX's layout in Liberation Sans 2.1.5, which the renderer ships under the OFL; a component in a region, schoero's swissqrbill and an unembedded Helvetica lost | accepted; extended by 0025 and 0027 |
| [0023](0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md) | The Studio and the product pages serve their own faces, from Fontsource's packages through their own builds, and ask no other site for anything: the browser gate fails on any request or connection hint to another origin, and the pages' checks on any file a page fetches from one | accepted |
| [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md) | The invoice comes in German, French, Italian and English as the corpus's samples, not the Studio's starters, their pictures in a manifest of their own, `samples.json`, apart from the one the browser gate holds to the starters; a QR-bill page in each language shows them, and its status names the release it was written against, so the next release stops the pages' build until it is read again | accepted; extended by 0028 and 0032 |
| [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md) | A report prints the EPC QR code a SEPA credit transfer is initiated from, as a component in a region: the EPC's rules are one set of checks in report-spec beside the QR-bill's, sharing its IBAN check digits and creditor reference, the runtime writes the payload, uqr encodes it at level M, and Austria's frame and "Zahlen mit Code" are an option, drawn at the PSA's widths in Liberation Sans; a `qrCode` with a payload template, a payment part and the npm libraries lost | accepted; extended by 0027 and 0028 |
| [0026](0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md) | The architecture is documented in arc42's twelve sections under formancy.ai's file names, and a guard in `pnpm test:repo` holds them to the repository: every record linked from a section, every workspace package a row of the building blocks naming its manifest's dependencies, every link and every path written as code landing; GitHub's heading anchors are read once, for every check that follows a link; review alone and a table generated from the manifests lost | accepted |
| [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md) | A report carries at most one EN 16931 invoice, which the runtime writes as Factur-X 1.09.2 / ZUGFeRD 2.5.2 CII from the values its page prints: its totals computed once for both, EN 16931's rules one set of checks in report-spec beside the payment codes', its codes from closed lists, the XML judged by Mustang and KoSIT pinned in a gate of their own, and every e-invoice refused by the renderer until it draws the PDF/A-3 that carries one; XRechnung alone, UBL, the XML beside the PDF, a library, the template's own sums and line terms of their own lost | accepted; numbered before 0028 and merged after it, which it extends; extended by 0031, which lifts the renderer's last refusal, by 0032, and by 0037 |
| [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md) | The euro invoice comes as samples from Austria, France, Italy, Spain, the Netherlands and Ireland beside its German starter, each selling the boiler's parts at its country's standard VAT rate, from an invented firm, to an account of right check digits, their pictures in `samples.json`; an EPC QR code page in each language shows them, the site checks every page's status before it renders any, and the pages refuse the name 0025 keeps off everything here | accepted; extended by 0027, 0031 and 0032 |
| [0029](0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md) | The Studio's Preview stands in the builder's middle, in the design view's place, in every window up to 2052px, with the outline and the properties beside it: the editor holds a host's view, both builders draw it as a bare region named after it, which report-builder.css does not dress and their keys do not reach, the Studio places it by the window's width, its bar shows and hides it, and the toolbar's Design view gives the design view its place back; stacking it under a shorter builder, tabs, a Studio-only overlay and a builder input with no editor state lost | accepted |
| [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md) | An image asset may be an SVG of drawing elements alone: report-spec's `cleanSvg` cleans it once, where it is approved, into one canonical form, removing and listing what never draws and refusing text, embedded pictures, `use` and every reference out of the file; the renderer draws only that form, checked by `checkSvg`, behind its own list of elements and the converter's throwing callbacks; what it costs to clean, to draw and to paint is bounded as measured, an image in a page region counted on every page; drawing it as it came, DOMPurify, saxes in production, a raster made at approval and cleaning at print lost | accepted; extended by 0033 |
| [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md) | An e-invoice is drawn as a PDF/A-3b that embeds its XML as `factur-x.xml` and states it in its XMP, through PDFKit's own calls on the final pass and for an e-invoice alone: the ICC profile PDFKit embeds admitted by its digest, the PDF read back by readers that are not PDFKit, and veraPDF and Mustang judging it in the e-invoice gate; PDF/A for every report, pdfmake's `files`, a library that attaches the XML afterwards and a patched PDFKit lost | accepted; numbered while 0029 and 0030 were other branches'; extended by 0032 and 0033 |
| [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md) | The quotation, the QR-bill invoice and the euro invoice, their samples and the e-invoice samples print one invented, wordless firm's mark at the top left of their first page: the corpus's SVG mark, approved as any asset is and handed over by the host's lookup, the first template asset a starter draws, and the pictures of the PDFs hold the drawings their pages draw; a mark per firm, a PNG made in code, a drawing of its own, the top right and the page header lost | accepted |
| [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md) | A person adds an image in either builder: report-builder-core reads the file, recognises it from its bytes, checks it as the renderer reads it, cleans an SVG and takes its SHA-256 with @noble/hashes, and the host keeps the bytes through a store given to the editor before the report declares the asset, in one undo step; an image nothing draws is removed from the report's properties; the Studio keeps what is added in the page; a prop on each builder, Web Crypto, a digest from the host and the insert in the same step lost | accepted |
| [0034](0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md) | The Studio and the product pages wear formancy's room by importing the released `@formancy/themes/room.css`, never a copy, and Report takes formancy 0.6.0 whole: the Studio after the workbench, the pages first, no stylesheet here setting one of its variables; the copy with a moved pin, an `@import` in the Studio's room, the Studio's packages for the pages and the packages left on 0.5.0 lost | accepted; numbered while 0033 was another branch's |
| [0035](0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md) | The renderer writes the images PDFKit decodes before it embeds them -- a PNG with an alpha channel, a palette's transparency or interlacing -- in the order pdfmake opened them, by wrapping each one's `finalize` in PDFKit's registry for the document's life, so that one document renders to the same bytes however its decodes finish; held on the PDF in both entries, on the PDFKit a host resolves by the install gate, and the hazard pinned in pdfmake alone; PNGs made to embed at once, a digest by object graph with the claim narrowed, a renumbering pass, one zlib thread, waiting for every decode, a patched PDFKit and rerunning the gate lost | accepted; extends 0005 and 0011 |
| [0036](0036-the-renderer-pins-pdfkit-at-the-release-0035-was-read-against-until-pdfkit-writes-images-in-the-order-it-embeds-them.md) | report-render-pdf pins PDFKit at exactly 0.19.1, the release 0035's wrapper was read against, importing nothing of it, so that npm places it where pdfmake finds it, and the install gate holds that pdfmake loads it; until PDFKit writes images in the order it embeds them. Leaving it to pdfmake's range, a host's override and a bundled copy lost |
| [0037](0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md) | An e-invoice may name the seller's and the buyer's electronic addresses, in five schemes of the CEF's list, the seller's contact and its business process, none of which a German B2B invoice needs: the contact's telephone number and email address held to XRechnung's own expressions, which the e-invoice gate holds to KoSIT's schematron, and a fourth sample and a control judged by both validators; the terms required now, the CEF's whole list, shapes of report-spec's own and a contact of any of its terms lost | accepted; extends 0027 |
