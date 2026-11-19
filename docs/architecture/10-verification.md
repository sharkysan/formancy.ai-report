# 10. Verification

What is checked, how, and what each check proves — and what it does not.
The organising rule is
[0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md):
a claim about a report's output is proved on the PDF the engine produced.

## 10.1 Proved on the PDF

```
a fixture: a resolved document, and what its PDF must show, derived from it
   │
   ▼
the real renderer, its creation date fixed           never a mocked engine
   │
   ▼
PDF.js reads the bytes back: each page's size, every text run, its box and
the way it reads, every image and where it is drawn, every painted path with
its paint and the rectangular clip it stands in, every font and whether it
is embedded
   │
   ├─▶ the checks: rows once and in order, values on their own rows, the header
   │   on every page, regions where they belong, no empty page, no heading alone
   │   at a foot, no text over text or an image, nothing past a margin, a glyph
   │   for every character, kept blocks whole, each SVG drawing in a clip of
   │   its box with paint inside it
   │
   ├─▶ for a QR code: PDF.js draws the page, ZXing decodes every code on it — its
   │   text, bytes, level, version and place
   │
   ├─▶ for an SVG image: PDF.js draws the page, and a band around its box is
   │   white
   │
   ├─▶ for a chart: its clip found in the one walk that places SVG images, its
   │   words each one run in its box and its face, its gridlines at its ticks,
   │   each bar its value's length, each line through its markers, each slice
   │   its share's sector on its circle, each legend entry beside its swatch
   │   and each value's label at its mark
   │
   └─▶ for an e-invoice: PDF.js reads the files it embeds, pdf-lib its own
       objects — /AF, the name tree, each file's keys and bytes, the output
       intent's profile — and saxes its XMP, every property by its namespace;
       and for an SVG in one, pdf-lib every number of every object and
       content stream, to the range a PDF/A holds an integer to
```

Each check was given a real PDF that shows the fault it looks for, and was
watched failing with itself removed (`report-corpus/src/checks.test.ts`).
The renderer runs every fixture of the corpus with none excused
(`report-render-pdf/src/corpus.test.ts`), and every starter and each
sample of both invoices (`starters.test.ts`, `samples.test.ts`,
`report-render-pdf/src/euro-samples.test.ts`); the corpus's own
`starters/euro-samples.test.ts` states each euro sample's rate, account,
parties and words, and recomputes its total in BigInt
([0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)). The same corpus chose the
engine ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[`../renderer-trial.md`](../renderer-trial.md)).

**Several tables over one detail dataset.**
`report-render-pdf/src/several-tables.test.ts` resolves an order printed
as three tables, each selecting its lines by a condition, through the
runtime, draws it, and holds the PDF line by line to what the test itself
selects, orders and totals from the data: each table's rows under its own
header, its groups' subtotals and its total, the summary's total of every
row, and the empty table's text and total of 0. The corpus's checks hold
the layout, every row once and in its place and no run over another. A
fourth table over lines another prints too, the order's largest lines,
is held line by line alone: the corpus's checks know a row by its key,
once on the page, and cannot hold a row printed in two tables, so where
two tables' conditions overlap, nothing but the lines the PDF reads
holds the layout
([0062](../decisions/0062-a-report-holds-several-tables-over-its-detail-rows-each-printing-and-totalling-the-rows-its-condition-selects.md)).

**The payment codes, at every layer that reads them.** Each code's rules
are report-spec's alone, held there by suites of their own, and every
reader of them is held where it reads them. What the two codes share, an
IBAN's check digits and the creditor reference, is held once, by
`report-spec/src/payment-reference.test.ts`, and the QR-bill's suite passes
on it unchanged
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

| Where | A Swiss QR-bill | An EPC QR code |
|---|---|---|
| The rules, over text | `report-spec/src/qr-bill.test.ts` | `report-spec/src/epc-payload.test.ts`, the countries' table by `sepa.test.ts`, the print by `epc-print.test.ts` |
| The validator, on literal texts | `validate-payment-part.test.ts` | `validate-epc-qr-code.test.ts` |
| The editing core: its texts and its amount compiled in the report's scope | `report-core/src/diagnostics/parts.test.ts`, `diagnose.test.ts` | The same two |
| The runtime, on data | `report-runtime/src/lower-payment-part.test.ts`, `qr-bill.test.ts` | `report-runtime/src/lower-epc-qr-code.test.ts` |
| The renderer, on the PDF it produced: the code decoded from the pixels, the text read back | `report-render-pdf/src/qr-bill.test.ts`, `qr-bill-pages.test.ts` | `report-render-pdf/src/epc-qr-code.test.ts`, which also reads the caption, the frame and the quiet zone from the PDF's text, its drawing and its pixels |
| The symbol and what refuses it, decided once for both engines ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)) | `report-runtime/src/qr-symbol.test.ts`, its Swiss QR Code's cases | `report-runtime/src/epc-symbol.test.ts` |
| The Word writer, on the file it wrote: the code decoded from its picture's pixels | Refused, with the slip: `report-render-docx/src/refusals.test.ts` | `report-render-docx/src/codes.test.ts`, with Austria's frame as a table states it, and `against-pdf.test.ts`, the file's code held to the PDF's |
| A starter, its code decoded by `readCodes` and asking for the total the page prints | The invoice, in `report-render-pdf/src/starters.test.ts` | The euro invoice, in the same file, with the details the code holds read beside it; `report-corpus/src/starters/starters.test.ts` holds its payload to a total recomputed in BigInt; and its six samples, in `report-render-pdf/src/euro-samples.test.ts`, each in its locale |
| The editing core's commands and the warning on SIX's examples | `report-core/src/commands/payment-part.test.ts`, `registry.test.ts`, which reads the commands that may change the bill and the e-invoice from the registry, `replaceDocument` among them, and runs the bill's own on an e-invoice that takes one, and `diagnostics/example-payment-part.test.ts` ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) | The bill's commands keep every EPC QR code; an account is an `updateComponent` |
| The builders | `report-builder-core/src/payment-part.test.ts`, with an IBAN of the other kind taking the reference with it, and `editor.test.ts`, a part the editor has none of refused; the scenarios "select the QR-bill on the canvas, and edit it field by field", "add a QR-bill to a report without one, then delete it and bring it back" and "add a QR-bill and make it pay a QR-IBAN with a QR reference", run by the core, React and Angular; the Studio's `parity.test.tsx`, `journey.test.tsx` and `studio.test.tsx` with the bill selected ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)) | `report-builder-core/src/epc-qr-code.test.ts`, and the scenario "insert an EPC payment code, and type its account", run by the core, React and Angular |
| The bill's band clicked, and an IBAN typed in a builder, decoded from the Download PDF's pixels | The browser gate's `apps/studio/scripts/gate-payment-part.mjs`, in each builder at every pass of the journey, in Chromium, where the stylesheet decides what takes a click (0039) | The e-invoice starter's account typed into its e-invoice, the code its final Download PDF draws decoded from its pixels paying the account its embedded XML names (`apps/studio/scripts/gate-e-invoice.mjs`, 0044) |
| An e-invoice edited, and the account it shares with its payment codes | `report-core/src/commands/e-invoice.test.ts` and `registry.test.ts`, which reads the commands that may change it from the registry; `report-builder-core/src/invoice-fields.test.ts`, every term reached by a field, and `e-invoice.test.ts`; the scenarios of `scenario-e-invoice.ts`, run by the core, React and Angular in three languages; the Studio's `parity.test.tsx` and `journey.test.tsx`; and the browser gate's `apps/studio/scripts/gate-e-invoice.mjs`, the XML the final PDF embeds read back after each of its three edits -- the buyer's electronic address, a rate, the IBAN -- and held to the page, no other term of the e-invoice held to what the page prints in its own words ([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)) | `setPaymentAccount` changes every EPC QR code's account with the e-invoice's |
| The browser entry's Liberation Sans | `report-render-pdf/src/browser.test.ts` | The same, which holds the chunk to loading only for a bill or a captioned code |
| The packed packages | The install gate's `consume.ts` | The same |

**An e-invoice, on its XML and on the PDF/A-3b that embeds it.** The XML
is held where it is written and read back by a parser that is not its
writer, and the page is held to it twice: on the document the runtime
resolved, and on the PDF the renderer drew, against the XML read out of
that PDF
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)):

| Where | What holds it |
|---|---|
| The rules, over text, and the closed lists | `report-spec/src/en16931.test.ts` |
| The validator, on the block and the report around it | `validate-e-invoice.test.ts` |
| The editing core: the names, and what the page must print | `report-core/src/expressions/e-invoice.test.ts`, `report-core/src/diagnostics/e-invoice.test.ts` |
| The runtime: the totals against a BigInt reading of EN 16931, the lines, the terms, the preview, the XML's bytes and its escaping | `e-invoice-totals.test.ts`, `e-invoice-lines.test.ts`, `e-invoice-terms.test.ts`, `lower-e-invoice.test.ts`, `cii.test.ts`, `xml.test.ts` |
| The renderer, drawing what it knows as a PDF/A-3b: one file, `factur-x.xml`, the runtime's XML byte for byte from two readers, as text/xml, `Alternative`, on `/AF` and in the name tree, dated the document; the XMP's PDF/A-3b and fx properties against the values the transcription gives [S]; the reviewed sRGB profile; and a preview that embeds nothing | `report-render-pdf/src/e-invoice.test.ts`; the browser entry, its profile the base64 copy, in `browser.test.ts` |
| The renderer, refusing what it does not know or the PDF/A cannot hold, an e-invoice's or a PDF/A-2b's -- a CMYK JPEG, an SVG whose numbers could pass its integers or whose nesting its graphics state -- and in every report a JPEG PDFKit would read otherwise than its frame header says, pdfmake never called; drawing every other kind of image in an e-invoice, and a CMYK JPEG in an XRechnung's copy, which is no PDF/A; and what it leaves of PDFKit pinned | `refusals.test.ts`, `assets.test.ts`, `svg-pdfa.test.ts`, `pdfmake.test.ts` |
| The page on the PDF against the XML read out of it, every line, total, head and bank detail, the amounts against BigInt, and two controls watched failing where they differ | `report-render-pdf/src/e-invoice-samples.test.ts` |
| The readers: a PDF's objects with pdf-lib, its images and the soft masks they name among them, its catalog's keys and its name tree's (`catalogKeys`, `nameTreeKeys`), and its digest with every stream inflated, its XMP with saxes, its attachments with PDF.js; and an image of each kind PDFKit embeds, held to the way it embeds it | `report-corpus/src/objects.test.ts`, `xmp.test.ts`, `read-pdf.test.ts`, `image-kinds.test.ts` |
| The images PDFKit decodes before it embeds them, in both entries, as a plain PDF and as an e-invoice: a large PNG with an alpha channel, one interlaced and one with a palette's transparency, each at a size of its own, above a small one with an alpha channel, read with pdf-lib and the file's cross-reference table, each offset held to its object; their widths in the order of their numbers, which PDFKit gives as pdfmake opens them, and the renderer's order itself, which fails without it: the masks numbered, and the images and the masks written, in that order; the wrapper on stand-ins, an image it cannot wrap leaving all to their decodes; and the hazard itself pinned in pdfmake alone, in both builds, to fail when PDFKit orders them ([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)) | `report-render-pdf/src/image-order.test.ts`; the pins in `pdfmake.test.ts` and `browser.test.ts`; on the PDFKit a clean install resolves, the install gate's `scripts/install-fixture/image-order.ts` |
| The samples: their XML against a BigInt computation of their data, and each line, total row, head and bank detail the page resolved to against the XML the same render wrote | `report-corpus/src/starters/e-invoice.test.ts` |
| The XML read by a parser that is not the writer, every term at the path CEN's binding gives it | `report-corpus/src/e-invoice-xml.test.ts`, through `testing/cii.ts` |
| The samples' XML, their PDFs and the variants that carry the first sample's e-invoice on other pages, judged by the tools a receiver runs | The `e-invoice` gate (§10.2) |
| The packed packages | The install gate's `consume.ts`, through `scripts/install-fixture/e-invoice.ts`: an e-invoice validated, resolved to its XML and drawn as a PDF/A-3b, whose bytes `scripts/install-fixture/embedding.ts` reads without a PDF reader -- the XML byte for byte as `factur-x.xml` on the catalog's `/AF` and in the name tree, the relationship, the XMP and the reviewed sRGB profile, at the PDFKit a clean npm install resolves -- and its preview drawn embedding nothing |

**A PDF/A-2b, on the PDF it produced.** What a document is drawn as is
decided once, before pdfmake sees it, and a PDF/A-2b is read back by the
readers that read an e-invoice's PDF/A-3b, every starter that is no
e-invoice against its plain render
([0057](../decisions/0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)):

| Where | What holds it |
|---|---|
| The decision: a `pdfa` other than `'2b'` the caller's `RangeError`; a Factur-X, an XRechnung's copy and a preview the runtime labels refused as `unsupported`, naming `eInvoice` or `pageHeader`, and drawn without `pdfa`; an e-invoice it does not know refused alike with and without; a title its XMP cannot hold refused, naming `info.title`; the definition's version 1.7 and subset PDF/A-2b, and a plain one's neither | `report-render-pdf/src/pdfa-check.test.ts` |
| The images a PDF/A-2b cannot hold: a CMYK JPEG in the body and a page region, and an SVG past its integers or its nesting, refused naming the image and the PDF/A-2b, every number read back; the same drawn without `pdfa`, and every other kind of image drawn in one | `assets.test.ts`, `svg-pdfa.test.ts` |
| Every starter that is no e-invoice: PDF 1.7, its XMP part 2 and B, one sRGB output intent byte for byte PDFKit's profile, nothing on `/AF` or in the name tree, no action, form or annotation, and the plain render's pages, faces and fonts; a preview that lacks nothing drawn as its final render; the same bytes twice | `report-render-pdf/src/pdfa-2b.test.ts` |
| The profile, read for a PDF/A alone, and a PDF/A-2b whose profile cannot be read rejected with the file system's error and no PDF; the browser entry's definitions, profile and objects the Node entry's | `pdfmake.test.ts`, `browser.test.ts` |
| Every starter that is no e-invoice, four variant pages on the quotation's, a page of charts among them (0058), and the corpus's two fonts fixtures, judged by veraPDF's PDF/A-2b profile, and two controls refused | The `e-invoice` gate (§10.2) |
| The packed packages | The install gate's `consume.ts`, through `scripts/install-fixture/pdfa.ts`: the quotation drawn as a PDF/A-2b and read with Node alone -- PDF 1.7, no file associated or named, part 2 and B in its XMP, the reviewed sRGB2014 output intent -- and a Factur-X refused as one in `scripts/install-fixture/e-invoice.ts` |

**An SVG asset, at every layer that reads it.** Its rules are report-spec's
alone, and every reader of them is held where it reads them
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)):

| Where | What holds it |
|---|---|
| The rules: what is kept, removed and refused, the cascade, numbers, paths, the bounds, the hazards | `report-spec/src/svg.test.ts` and its siblings, every drawing read back by saxes against `svg-allow.ts`'s tables and held to the fixed point, over every sample and a thousand seeded mutations |
| The format's media type | `validate-declarations.test.ts` |
| The runtime: an answer past `MAX_SVG_BYTES` refused before its bytes are read | `report-runtime/src/lower.test.ts` |
| The renderer, on the PDF it produced: no image, a clip of the box with the drawing's paths and colours in it, `contain`'s proportions, nothing past the box by the pixels, a page header's drawing on every page, the budget at its bound and past it | `report-render-pdf/src/svg.test.ts` |
| The renderer, against an SVG never cleaned, and each guard without the one before it | `report-render-pdf/src/svg-threats.test.ts`, and `browser.test.ts` in the browser build |
| Every drawing the cleaner accepts, through the converter's throwing callbacks; the worst the bounds accept, to sixteen times a starter page's time to draw; the converter's colour names | `report-render-pdf/src/svg-converter.test.ts` |
| In an e-invoice: each drawing the defect was measured on, and those found beside it, drawn with no integer in its PDF/A past the range, read from every object and content stream, or refused before pdfmake runs; the same drawn in a report that is no e-invoice; an image in a page region, and each image of an asset in its own box; the bound at least every number each PDF writes, and where it passes 10^8 within twice the largest, four times for a gradient in the box of a curve whose control points reach past it; the corpus's drawing at every bound drawn in its side and refused a hundredth smaller; the extent of drawings worked out by hand, over every box inside a curve's and with the points the converter draws an outline with; a gradient refused in every report where a box inside its shape's would take it past `MAX_SVG_COORDINATE`; the exporter samples' groups and nesting; the reader of a PDF's numbers | `report-render-pdf/src/svg-pdfa.test.ts`, `report-spec/src/svg-extent.test.ts`, `report-spec/src/svg-path.test.ts`, `report-spec/src/svg.test.ts`, `report-corpus/src/numbers.test.ts`; veraPDF in the `e-invoice` gate |
| The converter as pdfmake 0.3.11 vendors it: the file it opens, the link it writes, xmldoc's copy, its warnings, its clip, its groups | `report-render-pdf/src/pdfmake.test.ts` |
| The reader of paths, clips and masks, the drawings found, the ink around them | `report-corpus/src/read-pdf.test.ts`, `drawings.test.ts`, `check-ink.test.ts` |
| The packed packages | The install gate's `consume.ts`: a saved drawing cleaned, printed with no image in the PDF and its disc and its box's clip in the page's drawing, and refused as it was saved |

**A chart, from its block to its PDF.** What it prints is the runtime's,
held there (0055); how it is drawn is the renderer's, and every reader of
what the renderer drew is held where it reads it [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md):

| Where | What holds it |
|---|---|
| The admission: ECharts and zrender at one version, by their licence files' digests, for the renderer alone, a route behind the renderer and a package's own tslib among the cases | `scripts/dependency-licences.test.mjs` |
| The measurer: a word in pdfmake's width, in both entries; `国` in its face's line; a font not handed, a canvas and an image refused; the platform put back; nothing of the widths kept; a face known by its bytes | `report-render-pdf/src/engine.test.ts`, `fonts.test.ts`, `chart-faces.test.ts`, `chart-measure.test.ts` |
| What the drawing leans on in ECharts 6.1.0 and zrender 6.1.0: the probe, the cache, no canvas, the pie's label layout, the snapped gridlines | `report-render-pdf/src/echarts.test.ts` |
| The option: the ticks' places, exact; each bar on zero; each slice its exact share; every word by index; every colour named; nothing wrapped, cut, hidden or turned | `report-render-pdf/src/chart-option.test.ts` |
| The SVG ECharts writes, held, its words read back, and a pie's arcs on its own circle | `report-render-pdf/src/chart-svg.test.ts`, `chart-arcs.test.ts` |
| The layout and its refusals, over fixed charts and seeded ones; a second zrender refused | `report-render-pdf/src/chart-draw.test.ts`, `chart-held.test.ts` |
| What is refused before anything is laid out; a render's charts weighed together and refused past `MAX_CHART_DRAWING`, at the bound and one unit past it; and pdfmake's extra layouts for kept headings, which the bound does not count | `report-render-pdf/src/charts.test.ts` |
| The chart in the document: its words after its marks, at a page's foot, in a column, a section and a keep-together block, the same bytes twice and in another process; pdfmake's detached nodes; a heading left behind by a block that prints no text | `report-render-pdf/src/chart-content.test.ts`, `pdfmake.test.ts`, `flow.test.ts` |
| The browser entry: ECharts loaded for the first chart with marks and for no other document, and the Node entry's objects drawn | `report-render-pdf/src/browser.test.ts` |
| The browser entry bundled: one ECharts and one zrender, in the chunk it imports dynamically alone, and d3's licence among its notices | `apps/studio/src/notices.test.ts` |
| On the PDF: every chart fixture judged by the corpus's checks, each refusal by its own message, and the corpus's copies of the renderer's constants held to its own | `report-render-pdf/src/corpus.test.ts` |
| The check, on real renders and on reads doctored to show each fault; the walk that places charts and SVG images; the reader's subpaths and curves | `report-corpus/src/check-charts.test.ts`, `drawings.test.ts`, `fixture.test.ts`, `read-pdf.test.ts`, `curves.test.ts` |
| A chart's marks inside a PDF/A-3b, judged by veraPDF and Mustang, and inside a PDF/A-2b, judged by veraPDF's PDF/A-2b profile | The `e-invoice` gate's `variant-charts.pdf` and `pdfa-2b-charts.pdf` (§10.2), once its record holds them, and `scripts/e-invoice/pdfa-2b.test.mjs`, which holds the second to drawing what the first draws |
| The packed packages: the getting-started guide's quotation with a bar chart of its lines, compiled and run in Node and bundled for a browser | The install gate's `scripts/install-fixture/chart.ts` and the guide |

**A font's bytes, read once, and held to the reader at print.** The
reader is report-spec's alone, and fontkit, which PDFKit prints with, is
held to it on the faces the renderer ships ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)):

| Where | What holds it |
|---|---|
| The reader, on fonts made in code: each format, kind and fsType value accepted or refused as the specification and this decision read them, each table's fields and bounds, the character map in formats 4 and 12 as fontkit takes and reads it, the names and the encodings fontkit decodes them in, the outlines' structure, each recorded length as fontkit reads it, the variation sequences and vertical metrics fontkit reads, the horizontal header's line, the bounds at themselves and one past, nothing the font chose in a refusal, every prefix refused and 9,000 seeded corruptions read or refused without a throw | `report-spec/src/font.test.ts`, `font-cmap.test.ts`, `font-names.test.ts` |
| The runtime: the reader, its codes and its bounds handed on as report-spec's own | `report-runtime/src/fonts.test.ts` |
| The renderer: Roboto's and Liberation Sans's faces read to the values measured from their files, the line constants their own lines, fontkit mapping every code point as the reader does, every recorded length of the tables the reader reads refused or drawn by fontkit glyph for glyph alike, and seeded corruptions the reader accepts embedded by PDFKit, mapped and named alike; glyphs.ts's map the reader's on a face whose maps disagree; the glyph check, unchanged, on the reader | `report-render-pdf/src/fonts.test.ts`, `glyphs.test.ts` |
| A host's fonts, mapped and embedded ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)): the format's map held to its references and its faces; the runtime's resolution and its refusals; on the PDF, Latin, Greek and Cyrillic in Liberation Serif and Mono, every run held to its face's PostScript name, the text verbatim, the fonts embedded; text with no token and a table in a mapped sans, and the slip in Liberation Sans, read from the PDF; each render in the bytes it was handed; a character the face lacks, a page field's digits, a face not mapped, a script but Latin, Greek and Cyrillic, a bidirectional control and a font the reader refuses each refused; a face's own line held to the body, a run's in its own face, a table's cells by the one walk it is built from, and each line's least height to the face it prints in, a face whose line the reader refuses refused; a face PDFKit would draw as another -- of another face's PostScript name, in any record, with other bytes, or of `null` or a prototype's name -- refused, and one of the renderer's own bytes printed as the renderer's; a style's size held to the format's; two renders of one face at once, and no face left in pdfmake's virtual files; the layout tables stripped on the render's path, a `morx` that hung fontkit and a GSUB it threw on rendered, fontkit's version pinned; the printed blocks held to fontkit's Unicode data, and every character Roboto maps printed; a font's outlines bounded together; the browser entry embedding a host font the Node entry does; a host-font PDF/A-3b accepted by veraPDF and Mustang | `report-corpus/src/fixtures/host-fonts.ts`, `report-render-pdf/src/corpus.test.ts`, `host-fonts.test.ts`, `face-identity.test.ts`, `tables.test.ts`, `refusals.test.ts`, `strip-layout.test.ts`, `scripts.test.ts`, `browser.test.ts`; `report-runtime/src/lower-fonts.test.ts`; `report-spec/src/font-map.test.ts`, `font-scripts.test.ts`, `font.test.ts`; the `e-invoice` gate's `variant-host-fonts.pdf` |
| The packed packages | The install gate's `scripts/install-fixture/fonts.ts`: the runtime's reader report-spec's, the packed renderer's Liberation Sans read to its values, and a restricted copy and a collection refused by their codes; and a report mapping the packed Liberation Sans rendered, that face, subset, the one font its PDF embeds, and a copy of it of one metric changed refused |

**A run set below or above the line, from the format to the PDF.** The
geometry is stated once, in the runtime's document, and held to what
pdfmake draws on the PDF; whether such a run could stand alone on a line
is read from pdfmake's own words, never decided again
([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)):

| Where | What holds it |
|---|---|
| The format: each kind that takes a baseline, in every place a paragraph stands, in the hash; a page counter's refused, and every place that is not a paragraph's refused as `misplaced-baseline` | `report-spec/src/validate-baseline.test.ts`, and the code's case in `validate.test.ts` |
| A relabel, and an edit as one undo step | `report-forms/src/review.test.ts`; `report-core/src/session.test.ts` |
| The runtime: the baseline carried, no key where none is set, the geometry and report-spec's names; a translation's text at the run's baseline, and a word so set that the language lacks refused as `word-missing` (0063) | `report-runtime/src/lower.test.ts`, `languages.test.ts` |
| The renderer, on the PDF it produced: the size and the move in Roboto and Liberation Serif, a wrapped paragraph overlapping no other line, a line that holds a lowered run given room below for a raised run on the next and every other line its face's, page 1's own header's runs drawn and refused as the body's and page 1's body below its lowered line's room (0060), a translated word at its run's baseline (0063), and each refusal naming its block | `report-render-pdf/src/shifted.test.ts`; the least height, `bounds.test.ts`; pdfmake's words where the renderer reads them, `pdfmake.test.ts` |
| The reader: a run so set read into its line, a charge after its count among them, and one read so that the document does not set failed, over every fixture; page 1 held to its own header's runs, and every later page to the page header's (0060) | `report-corpus/src/lines.test.ts`, `check-text.test.ts`; `SHIFTED_FIXTURES` and every other fixture through `report-render-pdf/src/corpus.test.ts` |
| The builders: the split, the join and the action; each run's group and its buttons; the scenarios in both builders | `report-builder-core/src/baselines.test.ts`, `properties.test.ts`, `scenario-baselines.ts`'s scenarios run by each builder |
| The packed packages | The install gate's `scripts/install-fixture/shifted.ts`, through the packed runtime, renderer and editor, and `structure.ts`, the buttons both builders draw on a server |

**The firm's mark, on every page that prints it.** Which reports carry it
is stated in the corpus's test, never read from the starters, and where it
prints is read off the PDF the engine produced
([0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)):

| Where | What holds it |
|---|---|
| The corpus: the mark the drawing `cleanSvg` writes of it as saved, cleaning to itself with nothing removed, its digest pinned, a disc and two paths in two paints and no text as saxes reads it; the reports that declare it, by a list the test states, each beginning its report header with it and drawing it once with no diagnostic but, for a QR-bill invoice, that its bill pays SIX's example account (0039), refused `missing-asset` without the host's bytes; the inspection and the register declaring none | `report-corpus/src/starters/logo.test.ts` |
| The renderer, on the PDF it produced: on the page of every invoice and sample, the e-invoice samples' PDF/A-3b among them, one drawing in the mark's blue, at the margins' corner, 42.52 pt a side, in its two paints, no image, and no text beside it or in the 12 pt under it; by the pixels, on the German QR-bill invoice and the Austrian sample, the disc blue, the drop white and a band of 2 pt around the box white; the quotation's on its first page alone, under its running head; the quotation's first page holding 25 of 30 line items under the mark and 27 without it; the quotation's page boundaries measured again, each window holding totals on both sides of its boundary; the mark's reach in an e-invoice a thousandth of the PDF/A-3 bound; the converter's slowness guard drawn against the quotation without its mark | `report-render-pdf/src/samples.test.ts`, `euro-samples.test.ts`, `e-invoice-samples.test.ts`, `starters.test.ts` |
| The browser entry, the mark's bytes crossed into the page as base64 | `apps/studio/src/preview/pipeline.test.ts`; in Chromium, the browser gate, which holds every pictured page's drawings in the Download PDF to `docs/images/pictures.json` |
| The pictures of the PDFs: each line of the pictured page with where it starts, and its drawings, every clip a painted path stands inside with its box, its paints and each path's paint and box, read by the corpus's `drawingsOn`, held to the PDF written now; a picture fails when a line moves or a drawing or a path of one is added, removed, moved, resized or repainted, and not when a path is redrawn inside its own box, nor for a rule, a border or an image, which no manifest records | `report-render-pdf/src/pictures.test.ts`; `drawingsOn` by `report-corpus/src/drawings.test.ts`, a mark redrawn inside its own box among its cases |
| The packed packages | The install gate's `consume.ts`: the quotation printed through the README's lines with its mark, its disc in the clip of its box in the page's drawing; its `guide-react.tsx`: the quotation with its mark previewed through the guide's `printPreview` and the host's lookup; `report-render-pdf/src/install-fixture.test.ts`, which holds the copy's mark to the corpus's |

**A formancy submission, from the version that collected it to the page.**
The bridge is held at every layer that reads what it reads, and its one
claim about print -- that a reprint uses the labels of the version that
collected the answers -- on the PDF
([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)):

| Where | What holds it |
|---|---|
| The binding's shape in the report | `report-spec/src/validate-form-binding.test.ts`, and a case of each of its codes in `validate.test.ts` |
| The mapping, every kind and every pairing it refuses, every formancy kind read at every report type and held to the README's table | `report-forms/src/kinds.test.ts` |
| The scopes a version is read by, the paths formancy's `modelDataPaths` writes, for the corpus's forms and generated models | `report-forms/src/version.test.ts`, by fast-check |
| A read linear in what it is handed | `report-forms/src/linear.test.ts` |
| One submission and many, the version's hash, an answer under no path of the version, a field it lacks or retypes refused before any answer is read, every spec version and a form Formancy Data generated; every read's data held to the runtime's `checkData` | `report-forms/src/read.test.ts`, `many.test.ts`, through `test-support.ts` |
| What a host may hand over that is no data | `report-forms/src/untrusted.test.ts` |
| The number rule, as a property of every decimal of at most 15 significant digits and of any double | `report-forms/src/numbers.test.ts`, by fast-check |
| A report generated from a version, every part of a form printed or listed, deterministic by its hash, its notes by code and quoting no word of the form, the format's bounds refused at their values; any model's draft compiled by the runtime, a submission of its version that answered nothing and one that answered everything read into it, the second resolved and one draft in twenty rendered; and, on the PDF, its table on a page that gives each column a heading's word, refused one column more | `report-forms/src/generate.test.ts`, `generate-kinds.test.ts`, `generate-untrusted.test.ts`, `generate-print.test.ts`, and `generate-read.test.ts` by fast-check ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)) |
| The Studio's site visit starter, the generator's draft of the corpus's version 2 to its hash and its data the bridge's reading | `report-forms/src/starter.test.ts`; on its PDF, `report-render-pdf/src/starters.test.ts`; with nothing in the problems pane, `report-corpus/src/starters/starters.test.ts` |
| On the PDF: a version-1 visit printing version 1's label and not version 2's, every finding a row by the corpus's `verify`, the manifest naming version 1's hash | `report-forms/src/pdf.test.ts`, over the corpus's site visit, held to differing in one label by `report-corpus/src/forms/site-visit.test.ts` |
| A binding's overrides, one version at a time, in the report's hash | `report-spec/src/validate-form-binding.test.ts`, and `invalid-form-override`'s case in `validate.test.ts` ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)) |
| The per-render check reading an override, its refusal naming the review and a row's the rows the override reads, and the detail's saying a review offers nothing but a rename | `report-forms/src/overrides.test.ts` |
| A review: the kinds the diff names a field's change by -- renamed, removed, retyped, an option or a row removed, relabelled, a text changed, added -- and the form's id changed, each against the resolutions it is offered; a declared rename first, no path guessed, a relabel offered, a new field said, nothing the compiler would refuse offered, nothing that changes what the payment part or the e-invoice prints offered, a stale or tampered resolution refused, a missing version refused, no label quoted | `report-forms/src/review.test.ts`; where a rename moved a field, held to `diffSchemas` itself, `review-moves.test.ts` by fast-check |
| The versions after a review: the binding moved by a followed rename, every version handed over kept where it read, a later version printing unreviewed, a reused key never read, a version not handed over offered the path a named one reads | `report-forms/src/review-later.test.ts` |
| A batch, one command, all or nothing, one undo step, a step that throws refused; a field removed with every reader the walk and the parser find, a style rule alone, a footer row it leaves empty, a field the bill or the e-invoice reads refused; the expressions a change of a field's type reaches, compiled alone, adding what the whole report compiled adds for every field of three samples | `report-core/src/commands/batch.test.ts`, `readers.test.ts`, `expressions/compile-report.test.ts`, both halves of `registry.test.ts` |
| On the PDF: a version-3 visit refused, its review's declared renames applied, and the same visit printing the technician's name and licence from their new paths | `report-forms/src/review-pdf.test.ts`, over the corpus's version 3, held to differing from version 2 in the rename alone by `report-corpus/src/forms/site-visit.test.ts` |
| The packed packages | The install gate's `consume.ts`, through `scripts/install-fixture/forms.ts`: a form validated by the `@formancy/spec` the bridge brings, a submission read and rendered, two read one a row, a moved field and a wrong hash refused; a renamed group refused naming the review, reviewed, its declared rename applied through the packed report-core's session, the visit then read and the resolution stale |

**A PDF a report will print, read by one reader.** Nothing prints one
yet. The reader is report-documents' alone, held on PDFs its test support
writes byte by byte, never a person's file, and the pages a report prints
of one are to be proved with PDF.js, which shares no code with it
([0054](../decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)):

| Where | What holds it |
|---|---|
| The strict loop: the header, the end, encryption, every object read in order and nothing between them skipped, the cross-reference chained and held to every definition, a shadow refused, an object stream's members in order | `report-documents/src/parse.test.ts`, `xref.test.ts` |
| The reader's own tokens: names, strings, numbers and references, each at its bound and one past it, the one count of values, no pdf-lib number, array or dictionary made, no reference reaching `PDFRef.of` and no name of a file reaching `PDFName.of` | `report-documents/src/grammar.test.ts`, `parse.test.ts`, `read.test.ts` |
| Every stage of every stream from one budget, each decoder counted where it is built, a filter it does not decode refused, and the pako and pdf-lib internals the reader relies on, pinned; UPNG, which pdf-lib imports, never called while a file is read | `report-documents/src/inflate.test.ts`, `parse.test.ts`, `read.test.ts` |
| The pages, the print rule, the closure and the notices: what prints is what a viewer shows, or the document is refused naming the page and the annotation; what does not survive printing counted and never named | `report-documents/src/page-tree.test.ts`, `pages.test.ts`, `annotations.test.ts`, `closure.test.ts`, `notices.test.ts` |
| An image held to its pixels by where it stands, passed on undecoded; an inline image ended only where PDF.js ends it, each content lexed once | `report-documents/src/images.test.ts`, `inline-images.test.ts`, `inline-shared.test.ts`; and `scripts/mirrored-pdfjs.test.mjs`, which holds the PDF.js it mirrors to the corpus's and the Studio's |
| Each bound through `readDocument`, at it and one past it; the composition, never a throw, the host's realm alone, a frozen copy, and 2,000 seeded mutations each read whole or refused | `report-documents/src/limits.test.ts`, `read.test.ts` |
| The packed package | The install gate's `scripts/install-fixture/documents.ts`: the PDF the packed renderer drew read whole, and refused with a byte before its header |

What each bound costs, in time and heap, and how many real files the
reader refuses are measurements, dated in `limits.ts` and in 0054, and
held by nothing.

**A group header and the rows it keeps, at every layer that reads the
count.** The count is the format's, resolved against its group once, by
the runtime, and kept by the blocks, rules and planned breaks that keep
every group header with its first row; where its rows do not fit, a case
states the count it expects from the heights it computes, since the
corpus's fixture is built of rows that fit
([0059](../decisions/0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)):

| Where | What holds it |
|---|---|
| The member in the format, its bound and its place in the hash | `report-spec/src/validate-table.test.ts` |
| An edit of it, a count out of range refused with nothing changed, undone | `report-core/src/commands/table.test.ts` |
| The count on the group header row, at most the group's rows, written only above one, and a report that states none resolved as before | `report-runtime/src/lower-table.test.ts` |
| The blocks a count makes and the count that fits, a whole group merged with its footers, a block ended on a row that prints | `report-render-pdf/src/breaks.test.ts` |
| On the PDF: headers swept across page ends, a small group whole, a count past the page limit refused as too many pages, fewer kept where the stated rows do not fit, rows with no text, a blank footer row after a subtotal among them, a table in a framed section and one whose rows split | `report-render-pdf/src/group-rows.test.ts` |
| A long table planned in a few layouts, to the bytes the rules alone make | `report-render-pdf/src/tables.test.ts` |
| A count the runtime would not write, refused naming the table | `report-render-pdf/src/refusals.test.ts` |
| The orphan check holding a header to its count, and every other header as before; the fixture placed for every plausible number of rows a page | `report-corpus/src/checks.test.ts`, `report-corpus/src/fixtures/fixtures.test.ts`, rendered by `report-render-pdf/src/corpus.test.ts` and `browser.test.ts` |
| The field in both builders, typed, refused, written as none and undone; given back as it reads, no edit; shown on a group whose header has no text, absent without a group | `report-builder-core/src/scenarios.test.ts` and `properties.test.ts`, React's `scenarios.test.tsx`, Angular's `scenarios.test.ts`, and the Studio's `parity.test.tsx` |

**A first page's own header, at every layer that reads it.** Which header
a page prints is decided once, by the renderer, and every layer that reads
the region is held where it reads it; a report without it is held to
printing as it did, on the PDF, by the suites and the gates that already
hold it
([0060](../decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)):

| Where | What holds it |
|---|---|
| The format: absent, empty and holding components, each read back and hashed apart; what stands in it, a page field refused; its own budget; one space of ids | `report-spec/src/validate-first-page-header.test.ts`; the every-region cases of `validate-placement.test.ts`, `validate-qr-code.test.ts` and `validate-epc-qr-code.test.ts`; the walk's order in `walk.test.ts`; its words the report's own, in `words.test.ts`, whose guard reads a fixture holding it (0063) |
| The editing core: put and removed, one undo step each; a place in it refused while a report has none; `validLocations`, `fieldReaders` and `removeFieldWithReaders` reaching it | `report-core/src/commands/first-page-header.test.ts`, and both commands' shapes in `registry.test.ts` |
| The runtime: no key for a report without it; its blocks, none an empty list; every label the page header carries heading it; printed in a translation's words, as the page header is (0063) | `report-runtime/src/first-page-header.test.ts`, `languages.test.ts` |
| The renderer, on the PDF it produced: each of the corpus's `FIRST_PAGE_FIXTURES` read on page 1 as under a page header like its own and on every later page as under the page header alone; a one-page report, a QR-bill's slip under it and held below the taller header; a kept heading, a kept block, a table only page 1's taller body holds; its SVG counted once; no destination named for a heading in it | `report-render-pdf/src/first-page-header.test.ts` |
| The renderer, refusing: a page field or a page break in it, one too tall, one leaving page 1 no body, a page header leaving the later pages none, an image page 1's shorter body cannot hold, and under a page header taller than page 1's own a kept block, an image and a table's line under its header that only page 1's taller body could hold, each beside one that prints; an XRechnung's without the copy paragraph; and drawing the copy label at the head of page 1 | `report-render-pdf/src/refusals.test.ts`, `xrechnung.test.ts` |
| What it rests on in pdfmake 0.3.11: the background laid out in a box as large as the page, an empty node's top margin moving the next line, up for a negative one, a header function returning null, as the renderer's does, a table's fill painted under its text beneath the background | `report-render-pdf/src/pdfmake.test.ts`, "pdfmake's page top" |
| The checks: page 1 printing the page header in its own's place or of none, page 2 printing page 1's, page 1's body above its own header's foot, each a real PDF watched failing; the fixtures apart from `ALL_FIXTURES`, and both trial adapters refusing a document with one | `report-corpus/src/checks.test.ts`, `fixtures/fixtures.test.ts`, `trial/undrawn.test.ts` |
| Both builders: the choice in the report's properties, the region's group and band only where it is, a text placed in it by keyboard and a page number offered none of it, in three languages, with axe | `report-builder-core/src/scenario-first-page.ts`, run by `scenarios.test.ts` and by React's and Angular's runners; `properties.test.ts`, `targets.test.ts`, `outline.test.ts`, `geometry.test.ts`; the Studio's `parity.test.tsx`, both builders' trees compared as page 1 is given a header of its own and the page header back |
| The packed packages | The install gate's `consume.ts`, through `scripts/install-fixture/first-page.ts`: both commands through a session as a proposal carries them, from JSON, each one undo step, the removal refused where there is none; a page number offered none of the region's places and refused in it by the validator; and a report with one resolved, the same report without it to no key, and drawn on two pages, page 1's own header's fill on page 1 alone and the page header's on page 2 alone, read from each page's content stream |

**A report in several languages, from its words to the page.** Which
strings are words is one walk in report-spec, and each layer that reads
a language is held where it reads it; the claim that a translated render
prints that language's words and none of the report's own in another, on
the PDF
([0063](../decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)):

| Where | What holds it |
|---|---|
| A translation's shape and bounds, and each language validated by every rule each place of its words holds them to, refused at the translation and naming the place | `report-spec/src/validate-translations.test.ts`, and a case of each of its codes in `validate.test.ts` |
| The places a word stands, and every other string the format holds named as no word, the fixtures held whole by the validator's own shapes, so that a string added to the format is one or the other by a decision | `report-spec/src/words.test.ts` |
| The report written in a language: every word and translated expression replaced and nothing else, the slip's language, no translations left, and a near locale refused | `report-spec/src/report-in.test.ts` |
| A word missing, once a word and a language; an expression a word only where it prints text and holds a quote; a translated expression compiled at every place its source stands, of its type and reading exactly what its source reads; what the report written in a language gives that its own does not; an unused translation | `report-core/src/diagnostics/words.test.ts`, `diagnose.test.ts` |
| Adding, removing and writing a language's words, one undo step each, by descriptor as a batch or a proposal carries them | `report-core/src/commands/translations.test.ts`, `registry.test.ts` |
| A render in a named locale: the report's own unchanged, an undeclared locale refused, every kind of word printed in the translation's, its numbers, dates and row order the locale's, a word missing refused in that language alone, the slip, the manifest, a chart, and form labels read in another locale refused | `report-runtime/src/languages.test.ts` |
| A form's labels read in the locale a read names, a generated report in one language, and a review's retype judged in every language | `report-forms/src/read.test.ts`, `many.test.ts`, `generate.test.ts`, `review.test.ts` |
| The corpus's invoice in four languages, whole in each, and written in each to the invoice written in it alone, word for word | `report-corpus/src/starters/invoice-languages.test.ts`, and its size in `report-size.test.ts` |
| On the PDF: each language's words and none of the report's own in another, its total as the locale writes it, the slip's headings in its language and its code's message, each PDF equal by `inflatedDigest` to the invoice written in that language alone; every starter and sample the same bytes with its own locale named as with none | `report-render-pdf/src/languages.test.ts` |
| The builders: a language added, shown, its missing words marked and listed by it, a word written from its field, the view back to the report's own, in both builders and three languages, with axe | `scenario-languages.ts` in `BUILDER_SCENARIOS`, run by the core and both builders' suites; the model in `report-builder-core/src/languages.test.ts`; the marks in React's `properties.test.tsx` and Angular's `parts.test.ts` |
| The Studio: the Preview in the language the builder shows, across the framework switch, refused while a word is missing; both builders' trees with a language shown; the journey's names and axe | `apps/studio/src/studio.test.tsx`, `src/preview/pipeline.test.ts`, `parity.test.tsx`, `journey.test.tsx`; in Chromium, the browser gate's `gate-languages.mjs` |
| The packed packages | The install gate's `scripts/install-fixture/languages.ts`, run by `consume.ts`: French written through the packed session, refused while unfinished, then printed in fr-CH, its PDF titled in French |

What it does not see: a translated e-invoice's XML and PDF/A-3b, which
no external judge of the e-invoice gate reads; and whether a translation
says what the report's own words say, which review alone holds.

**The starters that print what 0059 to 0063 added.** An order
confirmation and a product data sheet, each held on the PDF it produced
and walked wherever a starter is
([0064](../decisions/0064-an-order-confirmation-and-a-product-data-sheet-are-starters-that-print-what-0059-to-0063-added.md)):

| Where | What holds it |
|---|---|
| The order confirmation's three tables, each picking one kind of its lines, each kind arriving out of its table's order, its deliveries of unlike sizes kept with three lines, its letterhead in page 1's own header and its pages counted; the data sheet whole in four languages, each the sheet written in it alone, its nine runs off the line the same in each and no Unicode super- or subscript in it; both under the firm's mark, the order confirmation's in page 1's own header | `report-corpus/src/starters/order-confirmation.test.ts`, `product-data-sheet.test.ts`, `logo.test.ts`, `starters.test.ts`, and their size in `report-size.test.ts` |
| On the PDF: each table's lines across the page break, totals recomputed in BigInt; the corpus's `verify` over both pages; the mark on page 1 alone and the running header from page 2; the third delivery's header on page 2 with its first three lines, and on page 1 with two of them when the count is taken out | `report-render-pdf/src/order-confirmation.test.ts` |
| On the PDF, in each of four languages: each run off the line by `shiftedRuns`, every line of the page, its values as Intl writes them and the U-value recomputed in BigInt, no German word that differs, and the PDF equal by `inflatedDigest` to the sheet written in that language alone | `report-render-pdf/src/product-data-sheet.test.ts` |
| A run set off the line read into its line by the corpus's rule, by the README's pictures' reader and in Chromium by the browser gate's | `report-corpus/src/lines.test.ts` (`offLine`); the pictures' lines in `report-render-pdf/src/pictures.test.ts`; `apps/studio/scripts/gate-page.mjs`'s `drawnPages`, its pictured pages held to `docs/images/pictures.json` |
| Both builders over both, a language the report does not declare added; the journey; the preview pipeline; the picker; a table column's label in the design view on the line under its table's, and axe's contrast of every label decided | `apps/studio/src/parity.test.tsx`, `journey.test.tsx`, `src/preview/pipeline.test.ts`, `src/starters/starters.test.ts`, `report-builder-core/src/css.test.ts`; in Chromium, the browser gate |
| veraPDF and Mustang on both as PDF/A-3b variants, veraPDF on both as PDF/A-2b | The e-invoice gate, `scripts/e-invoice/pdf-corpus.mjs` and its recorded run |

What it does not see: whether the board's values are a board's, and
whether its French, Italian and English say what its German says, which
review alone holds.

**The e-invoice pair in the Studio.** The XRechnung a starter beside the
e-invoice, the picker naming each by its kind, and a final render's XML
offered beside its PDF
([0065](../decisions/0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md)):

| Where | What holds it |
|---|---|
| The XRechnung the starter after the e-invoice, marked as the firm's letters are, and every starter's rule held of it | `report-corpus/src/starters/xrechnung.test.ts`, `starters.test.ts`, `logo.test.ts` |
| Its page, the copy, pictured; drawn as no PDF/A-2b | `report-render-pdf/src/pictures.test.ts`, `pdfa-2b.test.ts` |
| The picker's names, by kind, in the builder's words, none twice | `apps/studio/src/starters/starters.test.ts`, `studio.test.tsx` |
| The XML a final render hands on: the runtime's, the Factur-X's the bytes its PDF embeds, the XRechnung's beside a PDF that embeds none, read by namespace, its guideline its kind's and its total the page's; none in a preview; and, as each starter opens, byte for byte the XML the e-invoice gate recorded and judged | `apps/studio/src/preview/pipeline.test.ts` |
| Download XML beside Download PDF, the keyboard's next stop, the XML of the render on the paper until PDF.js has drawn a newer one, as UTF-8 under the starter's id; none where the render wrote none | `apps/studio/src/preview/pdf-view.test.tsx`; at every preview and final render the journey walks, each starter's final render in one builder, the two taking turns, `journey.test.tsx` |
| In Chromium, in both builders at every pass that walks the journey, eight of twelve: downloaded as a person downloads it, saved as the starter's `.xml`, Tab from Download PDF onto it, the Factur-X's the very bytes its Download PDF embeds and the XRechnung's beside a copy that embeds nothing, its guideline its kind's and its total the page's; and that state measured, Download XML on screen, as every other state is | The browser gate's `apps/studio/scripts/gate-e-invoice.mjs` (`downloadXmlChecks`), its download read by `gate-download.mjs`, whose test holds the link read by its own name; `browser-test.mjs`'s `measured` |
| No PDF/A-3b variant of the XRechnung's page, which a variant would draw as a PDF that says it is an XRechnung's copy and carries a Factur-X invoice: the variants read from each starter's kind of e-invoice and `KINDS` | `scripts/e-invoice/pdf-corpus.test.mjs` (`variantProblems`) |

What it does not see: an XML a person edited, which no validator judges
until a host's own run does, and whether a person finds Download XML,
which appears only with Final on.

**The payment reminder.** A QR-bill under page 1's own header, paying the
balance of two tables over one list, in four languages
([0066](../decisions/0066-a-payment-reminder-is-a-starter-that-pays-the-balance-of-a-customers-overdue-invoices-by-a-qr-bill-in-the-customers-language.md)):

| Where | What holds it |
|---|---|
| The two tables' conditions; the items' four kinds, one fee, their signs and their order, and each invoice's days overdue against its dates; the bill asking for `totals.balance` by the reminder's reference and message, its payload line by line; the letterhead in page 1's own header and the running header; the German reminder with three translations, every word written anew, whole, and written in each language the reminder written in it alone, its slip in that language | `report-corpus/src/starters/payment-reminder.test.ts`, `starters.test.ts`, `logo.test.ts`, and its size in `report-size.test.ts` |
| On the PDF, in each of four languages: both tables line by line, every total and what is due recomputed in BigInt and formatted with Intl; the slip's headings in that language alone; the code decoded by `readCodes`, asking for what is due by the reminder's reference and message; no German word that differs; the corpus's `verify` above the slip, each row known by its first two cells; the PDF equal by `inflatedDigest` to the reminder written in that language alone; and, with forty invoices more, the running header from page 2 and the slip on the last page alone | `report-render-pdf/src/payment-reminder.test.ts` |
| Its picture; drawn as a PDF/A-2b; the same bytes with its own locale named as with none | `report-render-pdf/src/pictures.test.ts`, `pdfa-2b.test.ts`, `languages.test.ts` |
| Both builders over it in three languages, Romansh added and its QR-bill selected; the journey; the preview pipeline; the picker | `apps/studio/src/parity.test.tsx`, `journey.test.tsx`, `src/preview/pipeline.test.ts`, `src/starters/starters.test.ts`, `src/studio.test.tsx`; in Chromium, the browser gate |
| veraPDF and Mustang on it as a PDF/A-3b variant, veraPDF as a PDF/A-2b | The e-invoice gate, `scripts/e-invoice/pdf-corpus.mjs` and its recorded run |

What it does not see: a host's days overdue and the signs of what a host
hands over, which only the host holds, and whether its French, Italian
and English say what its German says, which review alone holds.

**A starter's charts and its table, agreeing on the page.** The monthly
sales report, a bar chart and a pie of its lines beside one table of them
grouped by the bar chart's category, held on the PDF it produced and walked
wherever a starter is
([0067](../decisions/0067-a-monthly-sales-report-is-a-starter-whose-bar-chart-and-pie-print-the-totals-its-table-prints.md)):

| Where | What holds it |
|---|---|
| Both charts and the table over one field of every line, sorted alike, every value to the centime; its lines out of order, in product lines of unlike sizes, with credit notes, every line in its month and inside a chart's bounds; each bar and slice as the runtime resolves it, and each legend entry, to its total recomputed in BigInt and its share rounded once; its letterhead in page 1's own header | `report-corpus/src/starters/sales-report.test.ts`, `logo.test.ts`, `starters.test.ts`, and its size in `report-size.test.ts` |
| On the PDF: the table's lines across the page break, totals recomputed in BigInt; the corpus's `verify` over both pages, the charts' checks among it; each bar measured against the gridlines, as tall as its total, under its category and labelled with the digits its group's total prints in the table, the labels adding up to the month's; each slice measured by its turn to its region's exact share within a tenth of a point of arc, which a pie of the legend's rounded shares misses, its legend entry the region's total and its share rounded once; the mark on page 1 alone and the running header from page 2 | `report-render-pdf/src/sales-report.test.ts` |
| Its page 1 pictured; drawn as PDF/A-2b, its definition the plain render's with zrender's numbered names of its classes and clips read by the order they first stand in; printed with its own locale named as with none | `report-render-pdf/src/pictures.test.ts`, `pdfa-2b.test.ts`, `languages.test.ts` |
| Both builders over it, a chart's row selected among a row of each kind, in three languages and a language the report does not declare; the journey; the preview pipeline; the picker | `apps/studio/src/parity.test.tsx`, `journey.test.tsx`, `src/preview/pipeline.test.ts`, `src/starters/starters.test.ts`, `studio.test.tsx`; in Chromium, the browser gate |
| veraPDF and Mustang on it as a PDF/A-3b variant, veraPDF as a PDF/A-2b | The e-invoice gate, `scripts/e-invoice/pdf-corpus.mjs` and its recorded run |

What it does not see: a bar a cent off its total, which stands far less
than the quarter of a point the bar is measured to; its label prints the
digits, and holds the cent. And whether the builders could edit what a
chart totals, which they cannot yet (0052).

**A Word file, on the file its writer produced.** A Word file is no PDF,
and PDF.js reads nothing of it, so 0003's rule is held by another reader:
a claim about a report's Word file is checked on the bytes
`renderDocx` returned, read back by the corpus's `readDocx`, never on the
strings the writer built and never through a mocked writer
([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md),
extending 0003).

```
a fixture: a resolved document, and what its PDF must show, derived from it
   │
   ▼
the real writer ─────────▶ refused: held to the code and the subject the corpus's
   │                       wordRefusal derives from the document on its own
   ▼
readDocx reads the bytes back: the zip by a walk of its own and Node's zlib, the
package by ECMA-376's Part 2, every part's XML by saxes against a closed
vocabulary in the order ECMA-376 gives each element's children
   │
   ├─▶ verifyDocx: every key once and in order, every table's header, rows and
   │   cells, the header row marked to repeat, the kept rows marked, the regions'
   │   lines, the footer's page fields, the images' bytes, the runs set off the
   │   line; and, block by block, what the document states outright
   │
   └─▶ against the PDF of the same document, read with PDF.js: every word at the
       size, in the weight and the slant the other engine prints it in, and a
       text with line endings on as many lines as the file states
```

The reader shares no code with the writer: it is proved on a file typed
out by hand and zipped by Node's zlib (`report-corpus/src/docx/read.test.ts`),
and each check on that file with one thing taken out or written otherwise
(`report-corpus/src/check-docx.test.ts`). The writer runs every fixture of
the corpus and every starter, in every language it declares, as a final
render and as a preview, each written and verified or refused as the
corpus derives (`report-render-docx/src/corpus.test.ts`,
`starters.test.ts`); `blocks.test.ts` holds each row of the record's
table to the file, `refusals.test.ts` each refusal to its code, its
subject and its sentence, `text.test.ts` every string a document carries,
found by a walk that knows no field by name, to being read back as that
very text, `pictures.test.ts` a picture's part to the asset's bytes,
`fonts.test.ts` a token to the family its face states, and a family to
what Word reads of one, `bounds.test.ts` a file at each bound and one
past it, with the shapes inside the bounds that had cost the square of
their count and each thing a count had taken for less than it is
written as, and `stable.test.ts` the same bytes. `against-pdf.test.ts`
is what holds the two engines together,
since what the document leaves to an engine and what an engine must
refuse of a document are stated in each: the sizes, the weights and the
slant on the pages both write; the lines a paragraph and a cell with line
endings print, counted on the PDF by where the block after them stands
and held to the breaks the file states; every document of the corpus's
`MALFORMED` list refused by both by the same code and subject; one
document wrong in every place both engines look, refused by both for the
same place as each is put right; the image data a document's
pictures may hold, a number in each engine, by the picture each refuses
at; and the two documents the record says they refuse otherwise, a
picture past a bound of the writer's that is no picture either, by the
writer refusing its size and the renderer the picture. The Studio's
pipeline, its viewer and
its journey hold the file a person is offered to the document its PDF was
drawn from (`apps/studio/src/preview/pipeline.test.ts`), a writer that
throws or does not load to leaving the PDF as it printed
(`word-fault.test.ts`, `word-chunk.test.ts`), the writer and its two
libraries to a chunk the pipeline imports dynamically
(`chunks.test.ts`), and the browser gate holds
the file Chromium downloads to the document resolved under Node and to
the bytes Node writes (`apps/studio/scripts/gate-word.mjs`).

**A code in a Word file, on its picture.** A code is neither text nor a
table to the reader of a Word file, as it is neither text nor an image
to PDF.js: it is proved on the picture the file embeds, by two readings
that are not the writer's
([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md),
extending 0068 and 0003). The corpus's `readPng` reads the part's bytes
back to pixels by its own walk of the chunks and Node's zlib, undoing
every filter PNG defines; `codeGrid` holds those pixels to a symbol in
whole pixels a module with its quiet zone around it, every pixel to the
module it stands in; and ZXing reads them, as it reads a page, for the
text, its bytes, the level and the version. `verifyDocx` holds each to
its document, and so returns a promise, which every suite and the gate
wait for. `against-pdf.test.ts` holds a file's codes to the codes
decoded from the PDF of the same document, in squares of the PDF's size,
and both engines to refusing a code in the same words. Decoding is not
a comparison of pictures, here as for a PDF. What it does not show is
what Word draws of the picture, or what a phone reads of what Word
prints: nobody had opened a file with a code in Word when 0074 was
written.

**A chart in a Word file, on its part.** A chart with something to draw
is a part of the file, Word's own chart, and is proved on that part by
readers that are not the writer
([0076](../decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md),
extending 0068 and 0003). The corpus's `readDocx` reads the part by a
closed vocabulary of its own, transcribed from the schema a second time,
and holds it to the one form a report's chart is written in: a part that
leads to a workbook or an address, names a cell, or leaves to Word what
a report's chart states -- a title of Word's own, a smoothed line, a
missing value drawn as zero -- is refused. `verifyDocx` holds each chart
to its block: its kind, its box, every word, each value's digits as a
string, never as a number, the axis's ends as the block's lowest and
highest tick and its step as theirs, worked out in the corpus's own
BigInt, and the colours. Reader and check are proved on a file typed out
by hand, which passes as it stands and fails with one thing written
otherwise. `against-pdf.test.ts` holds every word a chart's part states
to a word the PDF draws, at that size in a face of that weight and
slant, and every word the PDF draws of a chart to one the part states or
a tick's text; and both engines to refusing each malformed chart by the
same code and subject. What none of it shows is anything Word draws:
where it puts a word, whether two meet, how long a bar is, and what it
writes on the value axis. Nobody had opened a file with a chart in Word
when 0076 was written.

What it does not show is Word. That Word opens the file, repeats the
marked row, keeps the marked ones, draws the SVG, puts page 1's header
where the file says and works both fields out is held by no test, and no
schema judges the file in CI: 39 written files were validated against
ISO/IEC 29500-4:2016's transitional schema once, by hand, on 17 November
2026, which 0068 records as an observation. The order of an element's
children is transcribed from the schema twice, in the writer and in the
reader's vocabulary, and the record's table is read twice, by the writer
and by the corpus's check: a mistake made in both passes. The comparison
with the PDF is of words, not runs, on bodies without their page
regions; a table's rules and padding, a rule's space, a rectangle's
outline, the gap under a header and every colour print nothing it reads,
and are review's.

**What it does not see.** A rule or a border through a row, a shape over a
line, a clipped glyph, white text on white: none is text or an image to
PDF.js, and the paths it reads are an SVG drawing's and a chart's alone. A
drawing is found by the size of its clip, so another of the same size, a
QR code's, could stand in for it, and a chart beside an SVG image of its
very size is told from it by their order alone. Of a chart: an empty
chart's box, which it draws nothing to mark; a pie's arc up to about half
a point off its circle, which `chart-arcs.test.ts` holds the renderer to
more tightly; document order where columns break across pages; a value's
label or a legend entry in a face whose metrics stand apart from the three
its tolerance was measured on; a colour a reader cannot tell from its
neighbour; and a mark under a word (0058). A run's box is computed from
its baseline and font size, so an accent reaching into the line below is
not seen. Pages are not compared
with approved pictures; decoding a code is not that. That no check reads
an engine's input and no engine is mocked is held by review alone
([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
[0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).

## 10.2 The gates

`.github/workflows/gates.yml` runs on every pull request and every push to
`main` through `ci.yml`, and before every release through `release.yml`, so
a release passes exactly what CI passes.

| Job | Command | What it proves | What it does not |
|---|---|---|---|
| `verify` | `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm check:pkg`, `node scripts/verify-licenses.mjs`, `node scripts/dependency-licences.mjs`, `pnpm test:repo` | Everything builds; no core package reaches a Node or DOM global; the vitest, Vite and tsdown configs type-check, through `tsconfig.tools.json`; every TypeScript and JavaScript file git holds meets the shared lint rules, typed through the tsconfig the typecheck checks it in, and is as Prettier writes it, which the check reads and never writes -- each watched failing on 30 October 2026, on a floating promise and on a double-quoted string planted in `packages/report-spec/src/version.ts`, the file put back byte for byte ([0050](../decisions/0050-every-typescript-and-javascript-file-is-linted-and-formatted-by-the-rules-the-four-repositories-share.md)); each package's manifest and types are right by publint and attw; every published package declares the licence and ships it; every production dependency and font file is under an admissible licence, by its identifier and the font's name table ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)); the repository's guards (§10.3) | That a package works outside the workspace, where a symlink to its source no longer resolves it; a licence's terms beyond its identifier, a font inside a script, code a package vendors ([§8.7](08-crosscutting-concepts.md#87-licences)); whether what a lint rule reports is a defect, and whether a disable comment's reason is true |
| `test` | Each package's and app's `test:coverage`, one job each | Each suite passes on a runner of its own. Coverage is reported to Codecov and gated nowhere | A package's suite runs its source, not the `dist` that ships ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| `browser` | The Studio's `test:browser`, with the build served under `/report/` as formancy.ai serves it, and `test:pictures`, with it served at the root of an origin nothing resolves; then the pages' `test:browser`, their build served under `/report/` with the demo's headers; all three in Chromium | What jsdom cannot see: no sideways scroll down to 320 pixels, the first Tab on the skip link, axe finding nothing on it shown and measuring its contrast, and Enter on it, given the focus where the first Tab missed it, putting the keyboard on `<main>`, axe's contrast and target size at every starter in both builders, every starter's PDF drawn on white with the text it prints and its Download PDF drawing what `docs/images/pictures.json` records, each Download PDF read as the Preview offers it when it is downloaded, read again where a render replaced and revoked the address read before the download, and a failure at the address still on the link said as it failed (`apps/studio/scripts/gate-download.mjs`, whose race `gate-download.test.mjs` holds in the Studio's suite), the switch between frameworks, a real pointer's drag, a pane and the Preview hidden and shown again, the Preview where the window has room for it — in the builder's middle up to 2052 pixels, its first page in the first viewport at 1366, 1440, 1536 and 1920, and beside the builder past that — and swapped with the design view both ways by keyboard, a side pane hidden, or on a phone the bar's Preview pressed, the moment an edit prints, the two builders' accessible trees compared, every variable of the installed `@formancy/themes/room.css` and its colour scheme as the built page computes them, an image added in each builder from the keyboard through the platform's file chooser, placed, printed, undone and redone, the file input empty again, and nothing sent: no request but to `blob:` and `data:` addresses and GETs without a query of the files the build wrote, and no WebSocket ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)), the invoice's QR-bill selected in each builder, an IBAN refused on its field and one typed, and the Swiss QR Code the Download PDF draws, decoded from its pixels, paying it ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)), each e-invoice starter's final Download XML in each builder, the keyboard's next stop after Download PDF, the Factur-X's the very bytes its Download PDF embeds and the XRechnung's beside a copy that embeds nothing ([0065](../decisions/0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md)), French added to the invoice in each builder from the keyboard, the Preview refusing it while its words are missing and printing the report's own again, undone with its switch (0063), each starter's Word file as its Download Word gives it in each builder, the keyboard's next stop after Download PDF, read whole by the corpus's `readDocx` in Node, held to the document resolved there and byte for byte the file the writer writes of it there, or, where the writer refuses the report, no link and the note of why, and the Word file of an edit holding the edit ([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)), and no request or connection hint to any other origin; every pass served under the headers the deploy writes, for the gate's address, the content security policy refusing the page nothing, and PDF.js printing in its worker rather than on the page's thread ([0051](../decisions/0051-the-demo-is-served-under-a-content-security-policy-that-admits-its-own-files-alone.md)); every page of the product pages' built sitemap answering as itself, at 320 pixels with and without the web fonts, a phone, one pixel past each breakpoint their built stylesheet writes in rem, a laptop and a screen, with no sideways scroll and nothing past either edge, axe finding nothing, the first Tab from the load on the skip link and Enter on it putting the keyboard on `<main>`, the released room, every face loaded, nothing fetched or hinted outside the built pages and nothing the policy refused, by the Studio's gate's own reads in `apps/studio/scripts/gate-measure.mjs` ([0053](../decisions/0053-the-product-pages-are-measured-in-chromium-by-a-browser-gate-of-their-own.md)); the README's pictures say what their page says ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), [0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md), [0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md), [0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md), [0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md), [0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) | Firefox and WebKit; what a picture or a product page looks like; a link from a product page to the Studio, which is not served beside the pages; the first viewport from 769 to 1365 pixels |
| `install` | `pnpm test:e2e:install` | The packed tarballs install into plain npm projects, one per kind of host; every entry resolves; the types check with `skipLibCheck` off against that host's types alone; the Node packages run end to end, a render's manifest naming the data's source among them, the Data provider's forms and a form submission a host names, and one holding a full name refused ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)), the renderer's images among them written in the order pdfmake opened them on the PDFKit the install resolved, each of its three decodes ahead of another image, so that one called past the renderer's wrapper ends the run unsettled (0035), and a PDF/A-2b of the quotation read with Node alone, a Factur-X refused as one (0057), and a report's French written through the packed session, refused while a word is missing and printed in fr-CH once it is whole (0063), and the quotation written as a Word file by the packed writer on the fflate and the pako a clean install gives it, its parts read with Node's zlib alone, its title, its instant and the firm's mark's very bytes in it, the same bytes twice, and the quotation with a QR-bill refused for its payment part ([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)); each builder is drawn on a server, with and without a host's view in its design view's place, with a host's store for images, with a QR-bill selected and in two languages, the second shown -- its switch in the bar, its boxes marked missing and a field's note (0063) -- and bundled for a browser, at the newest and the oldest release its peer range admits; the report server, in a Node host holding it and report-client and what they declare and nothing else, made over a file store on a directory of its own and listening in that host's process, answering `/health`, the one 401 and whoami for a token signed with `node:crypto` alone, with data-identity 0.3.0 from the registry ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md), [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)), and, through the packed client, a draft saved, read back at its version, its revision and its digest, with the token's subject as `savedBy`, and a save from the draft read refused `draft-changed` once another has saved from it, one audit event for each of the client's requests; report-client in a browser's host of its own, type-checked against the DOM's types with `@types/node` refused there, taking a save from a `Draft` or a `DraftSaved` as it came, and what it exports bundled for a browser ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)); the getting-started guide's code is compiled and run ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) | A builder mounted in a DOM — no focus, key, pointer or re-render there; the registry's copy of a package; the server's image, which is the container gate's; report-client in a browser, and the guide's draft host, which are bundled and never run against a server there; the Word writer's packed declarations against the DOM's types alone, which are checked against Node's, and its file in Word |
| `container` | `node scripts/container.mjs`, on the runner's Docker, with nothing installed | The server's image, built from the checkout by `packages/report-server/Dockerfile` on its pinned Node 26 base and run: unconfigured, it stops naming every setting it needs and no module is missing; with a secret reference it cannot resolve, it exits 1 with that one sentence and no stack trace; configured, it answers `/health`, refuses no token, a forgery and a tenantless token with the one 401, answers whoami for a token the gate signed, answers nothing else, says `no-store`, runs as `node`, carries the repository's `LICENSE.md` and `NOTICE` by their digests, writes `/var/lib/formancy-report` and no path of its own code in `/app`, logs one audit line per answered request holding no token, no part of one and no claim's value, lives through SIGHUP, stops on SIGTERM with exit 0, and answers whoami on a read-only root file system, the store's directory then a volume, which the server needs writable to start; keeps an author's draft across a restart on the same named volume, the report read back deep-equal at revision 1 under its digest, in the body and the `ETag`, keeps a PNG and reads it back byte for byte by its digest, and saves and reads a draft on a read-only root, its store a volume (0049); given a key set file, it names its kids when it starts and, on SIGHUP, reads it again, a token under the kid added answered after and not before; and the rate limit, the trusted proxies and the origins it is given change what it does, or stop it naming the setting. It writes its record, test-results/container.json, however it ends, and removes every container it started (0046) | A published image, which no release makes yet; the image's operating system packages and their licences; more than one instance; TLS and a proxy in front of it; any architecture but the runner's |
| `e-invoice` | `pnpm build`, then `node scripts/e-invoice.mjs --java "$JAVA_HOME/bin/java"`, on the Java the register names | Mustang and KoSIT's validator accept the XML the runtime writes of each e-invoice sample, KoSIT in its kind's scenario, `EN16931 (CII)` for a Factur-X invoice and `EN16931 XRechnung (CII)` for the XRechnung sample, whose PDF is a copy no tool judges, four controls of it each refused for the one rule of XRechnung's it breaks, and report-spec's XRechnung needs, the contexts and tests of the rules it holds by the format, its Skonto reading and its version held to XRechnung's schematron, and its release to the register ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)), and veraPDF and Mustang the PDF/A-3b the renderer draws of it, the firm's mark drawn in it as an SVG ([0032](../decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)), each at the release `docs/release/e-invoice-tools.json` pins and refused unless its SHA-256 is the registered one, veraPDF and the copy inside Mustang no older than the register's floor; and veraPDF and Mustang accept the first sample's e-invoice drawn on variants -- every starter's pages but an XRechnung's, whose copy is no PDF/A (0065), the fonts fixture, a page of every image kind PDFKit embeds with a QR code, a rectangle, a rule and a logo in its header, a page of SVGs in every way svg-to-pdfkit paints one, report-corpus's SVG at every bound an e-invoice holds one to, in the smallest box the renderer draws it in, and a page each of report-corpus's bar, line and pie charts and of a bar in a host's serif face, laid out by ECharts [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md); veraPDF alone, in a second run with `--flavour 2b`, each result held to its PDF/A-2b profile, accepts every starter that is no e-invoice drawn as a PDF/A-2b, four variant pages on the quotation's, the corpus's charts among them, and the corpus's two fonts fixtures, and refuses the quotation drawn plain and the e-invoice sample's PDF/A-3b, which it accepts as a 3b when left to detect the flavour, the gate's own reading holding each sample's and variant's XMP to part 2 and B and finding nothing embedded (0057); each control, broken one named way, is judged exactly as the corpus expects, at least one tool refusing it and each tool refusing at least one control of its format, with exactly the messages expected, Java's HTTP and HTTPS proxies pointed at a dead port (a raw socket is not caught); Mustang is judged by its PDF part as well as its exit status, which is 0 on a PDF whose XML is valid whatever its PDF/A says, and pdf-lib counts each PDF's files and compares their bytes with the XML, and the gate's reading of each sample's and variant's XMP holds its file name and its conformance level to the XML it embeds; a warning or a notice fails the run unless `scripts/e-invoice/accepted.json` accepts it with its reason; report-spec's closed lists and rule ids are held to the schematrons the tools run, and its XRechnung rule ids and the two shapes it holds a seller's contact to, each expression's string, the test that reads it and the rule's context, to XRechnung's schematron in the same configuration ([0037](../decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)); a run fails where the corpus recorded in `scripts/e-invoice/recorded/` for the judges' tests is not the one it judged, a PDF by a digest of its objects inflated ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) | A customer's template, since only the samples, the starters and their variants are judged; the fx namespace, which no tool reads, and the XMP's conformance level against the XML's profile, which no tool compares and the gate's own reading does; CEN's release 1.3.17, which report-spec's rules follow, since the pinned tools run 1.3.16; that a receiver takes the file; that KoSIT's XRechnung scenario takes a customer's XRechnung, since the sample is the one file judged in it; a Leitweg-ID's check digits, which neither tool checks (0038). On 18 October 2026 it had passed on Windows, on Zulu 25 and Temurin 17, and had not run in CI; with 0037's fourth sample and its control it passed on 20 October 2026, and with 0038's XRechnung sample and its four controls on 21 October 2026, on Windows, on Zulu 25; 0057's PDF/A-2b corpus was judged as it expects on 11 November 2026 on a Mac, on Zulu 22.0.1, as evidence, and recorded on 15 November 2026 on an Apple M2 Mac, on Corretto 17.0.6, CI's run on Temurin 17 being the gate |
| `report` | `node scripts/release-report/report.mjs` | Every job above left results of this run; no test or test file was skipped or missed by its suite; every planned browser pass was made; every planned install host was checked whole; the e-invoice gate judged every file as its corpus expects, by the tools of its format, XML, PDF or PDF/A-2b, each tool at its register's version and bytes, no veraPDF below its floor and, in CI, on the register's Java major version; the container gate made every check `scripts/container.mjs` plans and no other, each passed, on an image that said it runs the Node of the base the Dockerfile names, as `node` -- the base itself is the Dockerfile's digest, which Docker verifies and `dockerfile.test.ts` pins, and is not compared again (0046); two builds of a package agree; each release gate's evidence and each limitation's `heldBy` test passed ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md), 0027) | Whether a limitation's sentence is still true: the register's fence detects a record's change, not its meaning |

Beside them: `cla.yml` holds every commit author of a pull request to a
signature on the CLA as it stands (`scripts/check-cla.mjs`), and
`security.yml` runs CodeQL and, on a pull request, GitHub's dependency
review. None of these is required to merge: `main`'s ruleset requires no
status check ([`GOVERNANCE.md`](../../GOVERNANCE.md)).

**The product pages' suite**, one of the `test` job's, reads the pages the
build writes back with the DOM, as a crawler reads them, and holds them
to these rules
([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)):

| What | What holds it |
|---|---|
| Every page's head, links and their headings, words and sitemap, each check broken once and watched naming its subject | `apps/pages/src/site.test.ts`, `checks.test.ts` |
| Every card's evidence: each file of the checkout, a test or a gate's entry, one list for the card in every language, and the cards a page shows its group's ([0056](../decisions/0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md)) | `apps/pages/src/evidence.test.ts` |
| Every word a page takes from the Studio, in quotes in a scene of `docs/images/readme/captured.json`, and said on every page of its group (0056) | `apps/pages/src/studio-words.test.ts` |
| What the start page says Formancy Report does not do yet, each absence but the one list of detail rows held to report-spec's component kinds and printed blocks, or to the published packages' manifests, the report format said to be a draft while report-spec reads version 0, and every absence listed in every language with the roadmap linked (0056) | `apps/pages/src/limits.test.ts` |
| Every page's status: the site refusing to render, in one error, once the changelog names another release, the start page's line first; the start page's topic cards, totals, hero and dated absences, and its link to the changelog's Unreleased refused once that heading is gone ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md), [0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md), 0056) | `apps/pages/src/site.test.ts`, `product.test.ts`, `qr-bill.test.ts`, `epc-qr-code.test.ts` |

What it does not see: whether a sentence claims more than its tests show,
whether a card's list holds every test its claim needs, and the
translations, which review holds; what a page looks like in a browser,
which no test of the suite opens.

## 10.3 The repository's guards

`pnpm test:repo` runs every `scripts/**/*.test.mjs`. They hold the files
that describe the repository rather than a package. Among them:

| Guard | Fails when |
|---|---|
| `upstream-deps.test.mjs` | An `@formancy/*` dependency from outside the workspace, in the root manifest or a workspace's, is a range, a link or a path ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)) |
| `dependency-licences.test.mjs` | The licence policy's rules, each on a fixture, then the real tree: a package, a font, an ICC profile no review admits, and a Formancy Data package reached from any but the one package it is admitted for ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md), [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)) |
| `container.test.mjs` | The container gate leaves no record when it cannot run Docker, runs anything when the report imports its checks (0046), or stops planning the draft slice's three checks: a restart on one volume, an image read back, a save on a read-only root (0049) |
| `licence-status.test.mjs` | A document's licence sentence says another version, date or address than `LICENSE.md` ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)) |
| `workflows.test.mjs` | A workflow loses its shape: an unpinned third-party action, a `${{ }}` in a script, a cache in a release, a job without its collect step ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)), `verify` without `pnpm lint` and `pnpm format:check` after the build and the typecheck and before the guards (0050), or the `browser` job without the pages' gate before its collect step, or without the pages' files among those it uploads (0053) |
| `lint.test.mjs` | A TypeScript or JavaScript file git holds is not linted, has a rule at `warn` or a rule of the recommended sets off beyond the shared relaxations, is in no tsconfig lint types it with but for the install fixtures, or resolves to another style; lint types with other tsconfigs than every `tsc` of the root's and each workspace's typecheck runs; or the format check stops naming a misformatted file of an extension git holds (0050) |
| `prettier-merge.test.mjs` | A merge of `main` across the format through `scripts/prettier-merge.mjs` conflicts where only one side changed what a line says, stops conflicting where both did, or stops merging a side Prettier cannot parse unformatted, as a conflict that says so; Formancy Data's, which nothing compares with Data's (0050) |
| `ci-test-jobs.test.mjs`, `codecov-config.test.mjs` | The `test` matrix or `codecov.yml` and the workspace disagree |
| `getting-started.test.mjs` | A block of the guide escapes the install gate, or a link or anchor in it no longer resolves ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) |
| `palette.test.mjs` | A stylesheet of any kind Vite bundles, or a page's `<style>`, here sets a variable of the installed `@formancy/themes/room.css` or types one of its colours at any alpha; an app takes the room nowhere, twice, or before the last `@formancy/themes/workbench.css`, or names either outside its entry; the Studio and the pages resolve it to different bytes; the Studio's `theme-color` is not the room's ground, or its font stacks not the workbench's; or the installed room and workbench part ([0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) |
| `pictures/readme.test.mjs` | A README picture's caption quotes what the parts its capture recorded in `docs/images/readme/captured.json` do not say, or a picture's bytes are not the ones captured ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) |
| `release-report/limitations.test.mjs` | A record has no register entry, or changed since it was read ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| `e-invoice/*.test.mjs` | A module of the e-invoice gate stops doing its part: the judges, veraPDF's among them, over the run recorded in `scripts/e-invoice/recorded/`; the registers, the admitted licence, veraPDF's floor and the accepted warnings; the cache's hash check; the corpus, the PDFs and their controls; the reader of the tools' XML; the digest of a PDF's objects; the unzip; the recording, which holds no path of the machine it ran on (0027, 0031) |
| `mirrored-pdfjs.test.mjs` | The corpus or the Studio pins another `pdfjs-dist` than the release whose ends of an inline image report-documents copied, `MIRRORED_PDFJS` in `inline-end.ts`, or pins it by a range ([0054](../decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)) |
| `documents-declarations.test.mjs` | report-documents' built declarations, which a host compiles against, name a module -- imports, exports from, or references one -- so that a type of pdf-lib's or pako's would reach a host; or it is missing, the build not run, which in CI runs before this suite (0054) |
| `source-size.test.mjs` | A source file passes 600 lines |
| `architecture.test.mjs` | A section of these documents is missing; a workspace package or app has no row in [the building blocks](05-building-blocks.md), or its row names other dependencies than its manifest; a decision record is cited by no section; a relative link here does not reach a file or a heading GitHub would give it; or a path written here as code names nothing the checkout holds ([0026](../decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)) |
| `heading-anchors.test.mjs` | The one reading of GitHub's heading anchors, which this guard, the guide's and the product pages' link check share, gives one of its fixture headings another anchor than the one written beside it |

## 10.4 The release gates

[`gates.json`](../release/gates.json) names each of the delivery plan's
release gates by id, with the evidence a run must pass or the reason it is
open, and the release report states each. G1, G2 and G3 rest on evidence
every run must pass: the install gate, the dependency guards, and the
form bridge's reading of every formancy spec version; the
corpus, the starters and the checks; the builders' scenarios, the switch
across frameworks and the two accessible trees compared. G4 to G7 belong to
later releases and say why, and the legal gate waits for a lawyer
([`../release/README.md`](../release/README.md)).

## 10.5 The honest limits

- **One browser.** The browser gates and the pictures run in Chromium alone
  (`scripts/browsers.mjs`), where Formancy Data's run Firefox and WebKit too.
- **The product's pages are opened, not looked at.** Their checks read the
  HTML and stylesheets the build writes, and their own browser gate,
  `apps/pages/scripts/browser-test.mjs`, measures every page of the
  sitemap as numbers and computed results: nothing says what a page looks
  like, and a link to the Studio, which is not served beside them, is not
  followed ([0053](../decisions/0053-the-product-pages-are-measured-in-chromium-by-a-browser-gate-of-their-own.md)). Before it, their reflow and
  contrast were measured by hand in Chromium when each page arrived
  ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
  [0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
  [0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
- **No real Formancy Data server.** The provider's tests and the install gate
  run against a stand-in that answers 0.1.0's routes in Data's shapes, with
  no database and no policy ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **No identity provider, and one container on one machine.** The server's
  tokens are signed by its tests and its gates with keys of their own;
  nothing here verified a token Entra ID, Auth0 or Keycloak issued. The
  container gate had run the image by hand, on Docker Desktop on one
  Windows workstation, on 22 October 2026, and not yet on a CI runner; and
  no gate puts a proxy or TLS in front of it
  ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)).
  Its three draft checks had run on no Docker at all when they were
  written, since Docker did not answer, on 28 October 2026, on the machine
  they were written on: their requests were driven against the built
  server under Node, across a restart on one store directory, and CI's
  container job is their first run in a container (0049).
- **No Word, and no schema.** A Word file is read back by the corpus's
  own reader and held to its document and to its PDF; nothing in CI
  opens one in Word or judges one by ECMA-376's schemas, and no other
  reader of the format -- LibreOffice, a previewer, a converter -- was
  tried. The files were validated against the schema once, by hand, and
  the starters' and the fixtures' files opened in Word once, by hand,
  those with a code (0074) or a chart (0076) not yet.
  The demo is `main`'s, so the files reach the public at a merge
  ([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
- **No phone, no bank, no paper.** ZXing decodes every code a test prints,
  from a PDF's page and from a Word file's picture (0074);
  nothing here scanned one with a phone, paid a bill, initiated a transfer
  from an EPC QR code in a banking app, or printed a slip or a code
  ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
  [0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **No e-invoice received.** The samples' XML is judged by two validators
  and their PDF/A-3b by two more, and both are read back by parsers that
  did not write them; nothing here has handed the file to a receiver, an
  ERP or a platform, nothing reads the XMP's fx namespace against the
  specification's own, which sits behind a registration nobody here has
  made, and a customer's template goes through none of the tools, only
  through the rules and the check that each total is printed
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
  [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
- **An SVG's numbers bounded, not read back, at print.** In an e-invoice
  the renderer refuses an SVG by a bound on the numbers the converter will
  write, never by reading the PDF it wrote. The bound is held on the
  drawings `svg-pdfa.test.ts` reads back, and veraPDF reads none of a
  soft mask's group's numbers, a clip's, which only `readPdfNumbers` in
  the tests does; matrices built to cancel one another term by term could take the
  converter's own arithmetic past the bound's margin, and nothing here
  holds that
  ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
- **No browser's SVG, and no real exporter's.** That the PDF shows what a
  browser draws of the same cleaned drawing is held by report-spec's tables
  and by review; and the samples of what drawing programs write are
  invented, never compared with a real export. The worst drawing's time to
  draw was measured on one machine, in a headless Chromium drawing in
  software
  ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
- **One element found by the DOM, and Space in a browser alone.** The
  builders' scenarios find the hidden file input Add image… opens beside
  the button in the DOM, since it has no role; and Space on Add image… is
  pressed in the Angular builder only by the browser gate, whose
  Playwright chooser fires a change for any file, the same one included,
  so the gate reads the input to see it was cleared ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
- **Copied by hand.** The builder's geometry, `builder.css`, and the
  colours admin.css's rules type that the room does not carry, which the
  Studio's rules type as they do, are copied from formancy.ai's admin.css,
  and nothing fails when upstream moves them
  ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md));
  the palette, and every tint of it, is imported, released, since
  [0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md).
- **The demo is not checked.** Nothing here reads what formancy.ai/report/
  serves, or whether a deploy happened
  ([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)).
- **A PDF's bounds, on one laptop.** What each of report-documents'
  bounds costs was measured on one Apple M2 on battery, under Node and one
  Chromium, from 6 to 8 November 2026. Every run's times were read for a
  sleep found in its power log: runs a sleep reached were dropped and one
  series discarded whole, one series at 16 ran across sleeps and was kept,
  and whether the 24 series' Chromium half did is unknown, its log gone.
  No runner times a read, and the criterion of a second and 256 MiB gates
  nothing. The files it was measured on are its
  own hostile files and a sample of 1,484 PDFs from one Mac and Report's
  renderer, none of them a customer's, none holding an inline image, the
  largest 1.27 MB ([0054](../decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)).
- **Automated accessibility is a floor.** axe finds what a machine can, and
  no manual audit is recorded.
- **A page's claims, by their tests' names.** Every card on the product
  pages names files the checkout holds, tests or gates a passing run ran;
  that each still tests what its card says, that a card names every
  test its claim needs, and every sentence outside a card are held by
  review, as is the rule that no page compares Report with another product
  ([0056](../decisions/0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md)).
- **The middle layout, in part.** The README's pictures are taken past
  2052 pixels and at 390, so none shows the Preview in the builder's middle
  at a laptop's width; the camera takes no width between the Studio's
  breakpoints. The gate's 1366 by 657 is a screen less an assumed 111
  pixels of browser, measured on no browser
  ([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).
- **These documents.** `architecture.test.mjs` holds their shape, their
  links, the paths they name and the building blocks' dependencies; whether
  a sentence here is still true of its record, which layer a package stands
  in, and which package a bare file name is in are held by review, as the
  register's wording is.
