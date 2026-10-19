# 9. Quality requirements

Each requirement is stated so that it can fail, and names what fails when it
does. A quality goal nothing can fail is a preference.

## 9.1 Quality tree

```
Formancy Report
├── A correct PDF                                       ← whole and exact, or refused
│   ├── every row once, in order, nothing cut
│   ├── totals exact, rounded once as declared
│   ├── a QR code, a QR-bill and an EPC QR code that decode as written
│   └── an e-invoice a PDF/A-3b that embeds the XML its page was printed from
├── Agreement                                           ← the editor and the runtime
│   ├── the editor refuses what the runtime would, in an expression or a literal
│   ├── the two builders do the same things
│   └── an e-invoice's page prints the totals its XML holds, from one computation
├── Safety                                              ← fail closed; untrusted input
│   ├── an unknown version, kind or property refused whole
│   ├── input read without running anything, and bounded
│   ├── an SVG drawn only in the form it was approved in
│   └── nothing reaches the network but the provider, through the host's client
├── Accessibility
│   ├── every control reachable by keyboard, role and name
│   └── axe clean; contrast and target size measured in Chromium
├── Licensability
│   └── every production dependency, font file and ICC profile, as the guard
│       reads them, allows licensed production
└── Maintainability
    ├── no source file past the size budget
    └── what a document states is derived or checked
```

## 9.2 Scenarios, and what holds each

| # | Scenario | Measure | Held by |
|---|---|---|---|
| Q1 | A table runs across pages | Every row once and in order, each with its own cells; the column header on every page; no group header alone at a page's foot; nothing past a margin; no text over text — judged on the PDF | The corpus's checks (`report-corpus/src/checks.test.ts`), run on every fixture by `report-render-pdf/src/corpus.test.ts` with no fixture excused ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), [0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)) |
| Q2 | A job needs more pages than its limit | Refused as `too-many-pages`, never the first pages returned as though they were all | The `oversized` fixture through `corpus.test.ts`; `bounds.test.ts` for a body refused before pdfmake measures it ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| Q3 | A text holds a character no embedded face can draw | Refused as `unsupported`, naming the block and the code point | `report-render-pdf/src/glyphs.test.ts` ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| Q4 | Data hands a decimal as a JavaScript number | Refused; a decimal arrives only as a canonical string | `report-runtime/src/values.test.ts`, `data.test.ts` ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Q5 | A total is declared with a rounding | Computed exactly, rounded once, never through a double | `report-runtime/src/totals.test.ts`, `decimal.test.ts` ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Q6 | An expression calls `now()`, divides with `/`, or writes a double | An error where it is written, in the editor and in the render alike | `report-core/src/expressions/reproducible.test.ts`, `exactness.test.ts`, `diagnostics/diagnose.test.ts` ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| Q7 | Data carries a field the report does not declare | Refused, so it rides into no render, cache or log | `report-runtime/src/data.test.ts` ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Q8 | A final render lacks a value, or the provider calls the data incomplete | Refused; a preview prints and labels every page instead | `report-runtime/src/data.test.ts`, `resolve.test.ts` ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Q9 | A report of another `reportSpecVersion`, or a formancy form, is opened | Refused whole, naming both versions | `report-spec/src/version.test.ts` ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)) |
| Q10 | A report holds getters, proxies that throw, `__proto__` keys or values JSON cannot hold | Refused without running any of it, and no message echoes a value | `report-spec/src/validate-input.test.ts` ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| Q11 | An edit is refused — by its command, by the validator, or as stale | The same document object, the same revision and history; no listener notified | `report-core/src/session.test.ts` ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)) |
| Q12 | The same scenario runs in both builders | Both pass every one of `BUILDER_SCENARIOS`, in three languages, with axe at the end; their accessible trees compared with each other, in jsdom and in Chromium | Each builder's scenarios, React's `scenarios.test.tsx` and Angular's `scenarios.test.ts`; `apps/studio/src/parity.test.tsx`; the browser gate's `gate-parity.mjs` — release gate G3 ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| Q13 | Edit in Angular, switch to React, undo | The edit is undone; no listener or subscription is left behind | `apps/studio/src/studio.test.tsx`, and the browser gate the other way ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| Q14 | A QR code's modules would be finer than 0.4 mm | Refused, the message naming the square that would do; codes that are drawn decode, read by ZXing from the page's pixels | `report-render-pdf/src/qr.test.ts` ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)) |
| Q15 | A QR-bill's IBAN is mistyped, as a literal or in the data | `invalid-qr-bill` on the field, from the same function in the editor and the render; SIX's own examples decoded byte for byte from the page | `report-spec/src/qr-bill.test.ts`, `report-runtime/src/qr-bill.test.ts`, `report-render-pdf/src/qr-bill.test.ts` ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| Q16 | An EPC QR code's IBAN is mistyped, as a literal or in the data, or its data makes its payload too long | `invalid-epc-qr-code` on the field, from the same functions in the editor and the render, its check digits the QR-bill's own; the EPC's own examples decoded byte for byte from the page as the runtime wrote them | `report-spec/src/epc-payload.test.ts`, `payment-reference.test.ts`, `validate-epc-qr-code.test.ts`, `report-runtime/src/lower-epc-qr-code.test.ts`, `report-render-pdf/src/epc-qr-code.test.ts` ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| Q17 | An EPC QR code in Austria's frame is given a square its modules cannot print in | Refused in the same words by the validator and the renderer, from report-spec's one rule, which reaches the renderer through the runtime | `report-spec/src/epc-print.test.ts`, `validate-epc-qr-code.test.ts`, `report-render-pdf/src/epc-qr-code.test.ts`, and the install gate's `consume.ts` (0025) |
| Q18 | An e-invoice's page leaves out a total its XML holds, or prints one at fewer than two places or in another currency | `e-invoice-total-unprinted` or `e-invoice-format-differs`, an error where it is written; the page and the XML read the very values of one computation, each category's VAT rounded once and never per line, held against an independent BigInt reading of EN 16931 | `report-core/src/diagnostics/e-invoice.test.ts`, `report-runtime/src/e-invoice-totals.test.ts`, the samples' page against their XML in `report-corpus/src/starters/e-invoice.test.ts`, and on the PDF, against the XML read out of it, in `report-render-pdf/src/e-invoice-samples.test.ts` ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| Q19 | A report with an e-invoice is rendered, final or as a preview | A final render writes the XML or is refused, and one that wrote none and recorded no reason throws as a defect; the renderer draws it as a PDF/A-3b that embeds the XML byte for byte, which veraPDF and Mustang accept for the corpus's samples and for the first sample's e-invoice drawn on every starter's pages and on a page of every image kind PDFKit embeds, or refuses it as `unsupported` where it does not know the file or the PDF/A cannot hold the document; a preview writes none, embeds nothing and is labelled on every page | `report-runtime/src/lower-e-invoice.test.ts`, `report-render-pdf/src/e-invoice.test.ts`, `refusals.test.ts`, and the `e-invoice` gate (0027, 0031) |
| Q20 | A GPL, non-commercial or unlicensed package, an unreadable font or an ICC profile nobody reviewed reaches a published package | The `verify` job fails, naming it and the route it came in by | `scripts/dependency-licences.mjs` and its test ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)) |
| Q21 | An upstream dependency is declared as a range or a path | `pnpm test:repo` fails | `scripts/upstream-deps.test.mjs` ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)) |
| Q22 | A package's `exports` are wrong for a consumer, or it imports what it does not declare | The install gate fails in a plain project for that kind of host | `pnpm test:e2e:install` — release gate G1 ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) |
| Q23 | The Studio is narrowed to 320 pixels, or asks another origin for anything | No sideways scroll and nothing past either edge; any request outside the built Studio fails a pass | `apps/studio/scripts/browser-test.mjs` ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), [0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)) |
| Q24 | A decision record, a package or a dependency is added, or a test this architecture names is renamed, and the architecture is not changed with it | `pnpm test:repo` fails | `scripts/architecture.test.mjs` ([0026](../decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)) |
| Q25 | The Studio is opened in a 1366 by 768, 1440 by 900, 1536 by 864 or 1920 by 1080 window | The Preview's first page in view without scrolling, in the design view's place with the outline and the properties beside it; past 2052 pixels, beside the builder | `apps/studio/scripts/gate-place.mjs`, at those passes in both builders ([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)) |
| Q26 | A host hands the renderer an SVG as a person saved it, never cleaned: a local image, a link, text, a style sheet, an entity, a `use` fan-out | Refused as `invalid-asset`, naming the asset and none of its value, before pdfmake runs; and the renderer's list of elements and the converter's callbacks each refuse without the check before them | `report-spec/src/svg-threats.test.ts`, `report-render-pdf/src/svg-threats.test.ts`, the install gate's `consume.ts` ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)) |
| Q27 | An approved SVG logo is drawn `cover`, or with a transform on its root, or in a page header | Drawn as vectors inside a clip of its box, nothing of it in the pixels past that box, and in a page header on every page; a render whose SVGs would cost more than `MAX_SVG_DRAWING`, a page region's counted on every page, refused as `content-too-large`, naming the asset | `report-render-pdf/src/svg.test.ts`, and the corpus's SVG fixtures through `corpus.test.ts` and `verifyInk` (0030) |
| Q28 | An approved SVG logo whose clips or transparency are shrunk far below its box, whose outlines the converter draws far past the numbers it holds, or nested 29 graphics states deep, is drawn in an e-invoice | Refused as `unsupported`, naming the image and what to do, before pdfmake runs; or drawn, with no integer in the PDF/A-3 past 2,147,483,647, in any object or content stream; the same logo drawn as before in a report that is no e-invoice | `report-render-pdf/src/svg-pdfa.test.ts` through report-corpus's `readPdfNumbers`, and veraPDF on `variant-svg-bound.pdf` in the `e-invoice` gate (0030, [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| Q29 | A person adds a file: a GIF named `logo.png`, a PNG past `MAX_ASSET_SIDE`, an SVG with text, a CMYK JPEG in an e-invoice, one the host refuses, the same logo twice | Refused or not added, the reason in the live region, the report unchanged and nothing kept; one that is added is kept by the host first and declared in one undo step, in both builders, by keyboard or pointer, through the platform's chooser in Chromium, the keyboard never left on the page by an undo or a redo | report-builder-core's `images.test.ts` and the image scenarios, each builder's `scenarios.test` and `image-chooser.test`, `apps/studio/src/studio.test.tsx` and `src/images/image-store.test.ts`, and the browser gate's `gate-images.mjs` ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)) |

## 9.3 Bounds, and how each was chosen

Every bound the code enforces is a named constant, so this table names the
constant and where its value and its reason are written, rather than
repeating the number. A measured figure is dated and names its machine.

| Bound | Where | How it was chosen |
|---|---|---|
| Steps an expression may take, and a render in all | `EXPRESSION_STEP_BUDGET`, `RENDER_STEP_BUDGET` in `report-runtime/src/evaluate.ts` | The render's budget measured on 15 October 2026 on an Intel i9-10900K under Node 24.21, binding included: about 5 to 6.5 seconds of evaluation on that machine ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)). Another machine's seconds are not measured |
| Detail rows | `MAX_DETAIL_ROWS`, `report-runtime/src/data.ts` | Chosen, not derived, as its comment says: at the renderer trial's 48 rows a page it is over 2,000 pages, so it bounds the runtime's own checking, sorting and totalling before a page is laid out. At the bound, checking rows of nine fields took a median of 1.5 seconds and ordering them 0.5, on 15 October 2026 on that machine |
| An image's bytes | `MAX_ASSET_BYTES`, `report-spec/src/limits.ts`, which the runtime and the renderer read too | The renderer trial's limit, as its comment says; nothing measured behind it ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| An image's pixels, and image data per render | `MAX_ASSET_SIDE`, `report-spec/src/limits.ts`; `MAX_IMAGE_DATA`, `report-render-pdf/src/assets.ts` | Two of the largest images an asset may be, once inflated; what PDFKit took to embed one, two and four of them is measured beside the constant, on 15 October 2026, on that machine ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| A definition's arrays, strings and numbers | `report-spec/src/limits.ts`, each with its reason | Chosen, not measured: lowering one later refuses reports that were valid ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| Undo steps | `DEFAULT_HISTORY_LIMIT`, `report-core/src/session.ts` | Chosen, not measured ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)) |
| The images a person adds, in a builder and in the Studio | `MAX_ASSET_BYTES` and `MAX_ASSET_SIDE`, and the format's `MAX_ASSETS`; nothing smaller in the Studio's `images/image-store.ts` | The format's own, not chosen for an upload: nothing measured a smaller one, and nothing measured where the Studio's tab gives out holding them (0033) |
| The Studio's preview pages | `PREVIEW_PAGE_LIMIT`, `apps/studio/src/preview/pipeline.ts` | Chosen, not measured, so an edit that would print hundreds of pages is refused rather than freeze the tab |
| Where the Studio's Preview stands | `MIDDLE`, `apps/studio/src/layout.ts`, and the same query in `narrow.css`, held equal by `apps/studio/src/styles.test.tsx` | Measured for 0019 in Chromium on 16 October 2026: beside the Preview and both side panes, the design view holds an A4 page at 100 % whole in a 2052px window and is 2px short at 2049px. The builder's floor of 32rem in `shell.css` is chosen, not measured ([0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md), [0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)) |
| A QR code's smallest module | `MIN_MODULE`, `report-render-pdf/src/qr.ts` | Borrowed from SIX's QR-bill guidelines; nothing here printed a code or scanned one with a phone ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)) |
| An EPC QR code's payload | `EPC_MAX_BYTES`, `report-spec/src/epc-payload.ts`; `EPC_MAX_VERSION`, `report-spec/src/epc-print.ts` | The EPC's own (EPC069-12, 2.1 and 2.2), not chosen here. The validator counts what literal texts write, and the runtime the whole payload once its data is known ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| A captioned EPC QR code's modules | `EPC_CAPTION_MODULE`, `report-spec/src/epc-print.ts` | Austria's PSA's widths, which come with its frame; a code without the caption keeps `MIN_MODULE`. The squares a captioned code prints in follow from them, and `epc-print.test.ts` finds where they end by trying squares a hundredth of a point apart (0025) |
| A new EPC payment code's square | `EPC_SIDE`, `report-builder-core/src/palette.ts` | The least whole millimetre in which every payload the EPC allows prints, with the frame and without, as its comment says; the euro invoice's square is the same, for the same reason (0025) |
| An SVG asset: its bytes, as it came and as written; its depth, elements, stops, dashes, numbers and style rules; what it costs to paint, and the page-sized groups it makes | The `MAX_SVG_*` constants in `report-spec/src/limits.ts` | Measured, each beside its constant: on 18 October 2026, on that machine under Node 24.21.0 with pdfmake 0.3.11, and in Chromium 156's headless shell with PDF.js 6.4.299, with the aim that the worst drawing a bound accepts, 15 mm square, cost a reader about what one more starter page does; what the bounds give is two to six starter pages at 15 mm and three to eight page-wide, since a bound that kept the aim against a path every segment of which spans the box would refuse detailed logos. `MAX_SVG_REMOVED_NAMES`, how many names a person is shown, is chosen ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)) |
| What drawing SVGs costs one render | `MAX_SVG_DRAWING`, `report-render-pdf/src/assets.ts` | Each thing the converter draws weighted by what it cost beside a line, and every 32 bytes of the drawing, measured over whole renders of a header logo on many pages on 18 October 2026, and the budget set at about what `MAX_IMAGE_DATA`'s largest images cost the renderer to decode (0030) |
| The numbers an SVG may write, and how deep it may nest, in an e-invoice | `PDF_A_INTEGER`, `PDF_A_NESTING` and `SVG_INTEGER_BOUND`, `report-render-pdf/src/svg-pdfa.ts` | Not chosen: PDF/A's own limits, 2,147,483,647 and 28 (ISO 19005-2, 6.1.13, as veraPDF 1.30.3 holds them), the integer less a margin for rounding derived from `MAX_SVG_COORDINATE` and `MAX_SVG_DEPTH`, 5.7 %, as its comment says (0030) |

What renders have measured, on that one machine under Node 24.21, each on
one day, with the runs its record describes, and held by nothing:

- a table of 1,600 groups of three rows in 3.4 to 4.4 seconds, and 100,000
  rows refused against five pages in 236 ms, on 15 October 2026
  ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md));
- a version 40 QR code adding 72.2 to 73.5 kB and taking a render from 12 to
  15 ms to 136 to 207 ms, on 17 October 2026
  ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
- the invoice starter with its QR-bill in 263 to 300 ms and 53,730 bytes,
  against 70 to 82 ms and 23,985 bytes without it, on 17 October 2026
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md));
- the euro invoice starter with its EPC QR code in 86 to 116 ms and 31,487
  bytes, with Austria's caption in 114 to 135 ms and 38,207 bytes, against
  74 to 81 ms and 26,348 bytes with a spacer of the code's height in its
  place, on 17 October 2026
  ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md));
- an e-invoice of 100,000 lines, which only `MAX_DETAIL_ROWS` bounds,
  writing 117,280,919 bytes of XML and resolving in a median of 5.4 s
  against 2.0 s without it, and one of 10,000 lines 11,710,910 bytes in
  0.44 s against 0.23 s, five runs each from the built package under Node
  24.21.0, on 17 October 2026
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md));
- the e-invoice samples drawn as PDF/A-3b in 36,712 to 37,801 bytes and
  medians of 83 to 91 ms, against 28,215 to 29,237 bytes and 81 to 94 ms
  drawn plain, nine renders each, alternated, from the built packages, on
  18 October 2026 while the machine ran other work
  ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md));
- the firm's mark at the head of the starters adding 430 bytes to the
  quotation's PDF, 342 to the invoice's, 367 to the euro invoice's and 330
  to the e-invoice sample's, and no time a median could tell from the
  spread: with it, medians 4 ms shorter to 5 ms longer than without it,
  each drawn nine times with it and nine without, alternated, in two runs
  from the built packages on 18 October 2026; the invoices' and the
  e-invoice samples' figures above were measured before the mark
  ([0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md));
- an SVG logo of 30,000 lines in the page header of a 32-page report adding
  2.79 s to the render against one of a single rectangle, medians of five
  whole renders under Node 24.21.0 on 18 October 2026, a logo the bounds
  now refuse, of which the weights were measured; and the worst drawing the
  bounds accept drawn by PDF.js page-wide at scale 2 in 446 to 448 ms, about
  eight times the quotation starter's first page, the same day, a page
  the converter's test still draws without the firm's mark (0032)
  ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

What adding an image has measured, in Playwright 1.64.1's Chromium
156.0.8078.4, headless, on that machine under Windows 11 Pro, on 19
October 2026, and held by nothing: report-spec's `assetDigest` on a page
of its own, report-spec's build bundled by Vite 8.3.4 and timed through
`page.evaluate`, a median of five runs of 18.3 ms for 1 MiB, 91.1 ms for
5 MiB and 359.7 ms for 20 MiB, `crypto.subtle.digest` 3.0, 14.5 and
58.0 ms; and in the Studio's built page, served as the browser gate
serves it, from the file input's change to "Added image", PNGs of 1.0,
5.2 and 19.7 MB in medians of three of 37 to 38, 156 to 158 and 482 to
517 ms in the React builder and 34 to 35, 156 to 159 and 523 to 565 ms
in the Angular one, over two runs. Under Node 24.21.0 the same day,
`imageHeader` read a 20 MiB PNG of 1,747,622 empty image data chunks in
38 ms, keeping nothing of them, and one of 19.7 MB in 2,401 chunks in a
median of five of 97 ms. The Studio's page chunk grew by
28,491 bytes with it, 9.6 kB gzipped, and the Preview's shrank by 3,426,
the renderer's reader having moved into report-spec ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).

**What is not measured, said.** What a commit costs — the whole report
validated and diagnosed again on every edit, a keystroke in a property field
included — what `validLocations` costs when a drag starts, and what
compiling every expression per keystroke costs. The records name the
benchmark that would hold them and say it is not built
([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md),
[0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
One drawing time is a gate: `report-render-pdf/src/svg-converter.test.ts`
fails when PDF.js takes sixteen times as long or more to draw the worst
SVG the bounds accept as to draw a starter page in the same process, a
ceiling twice the eight times measured on one machine, held as a ratio so
that a slower runner is not a slower drawing, and not
measured on CI (0030). No render time is: short of a test's timeout, a
render that becomes slower fails nothing.

## 9.4 Quality attributes not pursued yet

Stated because an unstated non-goal reads as an oversight:

- **Collaborative editing.** Snapshots do not merge; two people editing one
  draft conflict, and the second save is refused by its hash
  ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
- **A consistent read from Formancy Data.** Best-effort until Data has a
  snapshot export ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **Stopping a render mid-pass.** It needs a worker that can be killed, and
  none is built ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
- **Text Roboto has no glyphs for** — CJK, Hebrew, Arabic, Thai, emoji.
  Refused until fallback fonts the licence policy allows are embedded and
  tested
  ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
- **Positioned elements and a second detail table.** Each is a format change
  ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
- **An accessible PDF.** Nothing decides or tests how assistive technology
  reads a generated PDF ([§8.9](08-crosscutting-concepts.md#89-accessibility)).
