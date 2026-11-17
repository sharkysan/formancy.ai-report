# 0068 — A report is written as a Word file by a writer of its own, which says what the resolved document says in Word's own pages, and refuses what belongs to its PDF

- **Status:** accepted; numbered while 0067 was another branch's; extends [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), whose proof on the PDF an engine produced is a proof on the file a writer produced: a Word file is read back, by readers that are not its writer, and held to the expectation its PDF is held to; [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), whose Preview offers the file beside the PDF; [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md), whose `imageHeader` now says how a JPEG's Exif block turns it; and [0040](0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md), whose reader now hands on the family of name ID 1 beside a typographic one
- **Date:** 2026-11-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **Written before the Studio's part.** The reader, the writer, the
    comparison with the PDF and report-spec's two fields are built, and
    each entry below names a test that exists and was seen failing. The
    entries **From outside** and **The Studio** name the tests and the
    gate this change still writes; the record is corrected to what was
    built, and this entry removed, before the change is merged.
  - **The reader.** report-corpus's `src/docx/read.test.ts` proves
    `readDocx` on a file written by hand in `src/docx/testing/hand.ts`
    and zipped there by Node's zlib, never by the writer: the parts by
    their content types, every relationship followed to a part, the
    document's paragraphs, runs, fields, tables and pictures, the header
    and footer parts by the kind of their reference, and the section's
    page. It reads a closed vocabulary (`src/docx/vocabulary.ts`): an
    element or an attribute the list does not hold, an element's children
    out of the order ECMA-376 gives them, a second of one that stands
    once, XML that is not well-formed, a document type, a processing
    instruction, a relationship to an address, to no part of the package
    or used by nothing in its part, a part no relationship reaches, a
    field other than `PAGE` and `NUMPAGES`, a `w:t` without
    `xml:space="preserve"`, and a zip entry dated otherwise than the
    writer dates one are each refused, naming the part. The zip is read
    by the corpus's own walk of the central directory and Node's
    `inflateRawSync` (`src/docx/zip.ts`), the package by ECMA-376's Part
    2 (`src/docx/package.ts`), the XML by saxes: none is fflate.
    `src/check-docx.test.ts` holds `verifyDocx` to passing the
    hand-written file and to failing on it with one thing taken out or
    written otherwise, a case each: a row, a cell's text, a word, the
    space a run ends in, the header row's mark, a kept row's, a row's
    whole-ness, a picture's bytes, a page field, a run's colour, slant,
    size and weight, a run set off the line, an alignment, a heading's
    keep, a rule's weight, colour and its line between two rules, a
    spacer's height, a rectangle's size and fill, a section's border,
    fill and padding, a column's width, a picture's place and size, a
    page break, a kept block, the paragraph between two tables, the
    paper, its turn, a margin, a region's distance, page 1's own header,
    the gap under a header, the title, the creation date and the font
    table; and `wordRefusal` to each refusal below that belongs to the
    PDF or that nobody has seen in Word.
  - **The writer, on the file it wrote.** report-render-docx's
    `src/corpus.test.ts` writes every fixture of the corpus -- section
    20's, the SVG ones, the kept rows', page 1's own header's, the charts'
    and those of runs set off the line -- and proves each on the file with
    `verifyDocx`, against the expectation the corpus derives from the
    document and what the document states outright, or holds it to the
    refusal the corpus's `wordRefusal` derives from the document; a
    fixture the PDF renderer refuses for what it measured, and the writer
    writes, is named there with why. `src/starters.test.ts` names every
    starter by its id as written or as refused, with the refusal's code
    and subject, in every language the starter declares, as a final
    render and as a preview, and fails on a starter it does not name.
    `src/blocks.test.ts` holds each row of the table below to the file.
    `src/refusals.test.ts` holds each refusal below to its code, its
    subject and its sentence, and to returning nothing.
    `src/text.test.ts` holds every string a document carries, found by a
    walk of the document that knows no field by name, to being read back
    as that very text in a file with no element, field or relationship
    the same document without it lacks, for strings a property test
    makes of markup, fields, entities and quotes; a run's spaces, a line
    ending and each character below to what the record says of it; and
    that a string does not compile where markup stands
    (`@ts-expect-error`). `src/pictures.test.ts` holds a picture's part
    to the asset's very bytes, its extent, a contained picture's place in
    its box and a covering one's crop to its pixels, an SVG's `svgBlip`
    and its fallback, an SVG that is more than a drawing and a PNG whose
    data is not its scanlines to their refusal, and every kind of the
    corpus's `IMAGE_KINDS` to being written and of its `UNSEEN_JPEGS` to
    being refused. `src/fonts.test.ts` holds a mapped token to the family
    its face's name table states, to name ID 1 where a typographic family
    stands beside it, `sans` unmapped to Roboto, and what the PDF refuses
    of a font to its refusal. `src/bounds.test.ts` writes a file at each
    bound and refuses one past it.
  - **The same bytes.** `src/stable.test.ts`: one document written twice
    is the same bytes; written in a second process fourteen hours ahead
    of UTC and in one eight behind, the same digest; every entry of the
    zip dated as `package.ts` dates it, in its own header and in the
    directory. In Node: no test loads the file fflate serves a browser.
  - **Against the PDF.** `src/against-pdf.test.ts`, with
    report-render-pdf a devDependency of the suite alone: for every
    starter and fixture both write, without its page regions, every word
    of the Word file with the size, the weight and the slant its run
    states is a word the PDF, read back with PDF.js, draws at that size
    in a face of that weight and slant, and every word of the PDF is one
    of the file's -- what the document leaves to an engine, stated twice,
    held together; and every document of the corpus's `MALFORMED` list,
    one for each way a document breaks its contract with an engine before
    anything is measured, is refused by both by the same code and
    subject.
  - **report-spec.** `src/image-header.test.ts` holds a JPEG's
    `orientation` to each of 2 to 8 as PDFKit reads it, and to being
    absent where the image is upright; `src/font-names.test.ts` holds
    `legacyFamily` to name ID 1 beside a typographic family, and to
    being absent without one.
  - **From outside.** `scripts/install-fixture/docx.ts`, which the node
    host's `consume.ts` runs: the packed package writes a document, and
    Node alone finds its parts. The package's `tsconfig.json` has ES2023's
    library and no `@types/node`, so a `node:` import or a DOM global in
    `src` does not compile; its tests are a program of their own
    (`tsconfig.test.json`). `scripts/dependency-licences.mjs` judges
    fflate; `scripts/architecture.test.mjs`, `scripts/ci-test-jobs.test.mjs`
    and `scripts/codecov-config.test.mjs` hold the package to its row, its
    job and its flag.
  - **The Studio.** `src/preview/pipeline.test.ts` holds every starter's
    printed outcome to handing on the Word file of the very document its
    PDF was drawn from, read whole by `readDocx`, or the writer's refusal;
    `src/preview/pdf-view.test.tsx` holds Download Word to following
    Download PDF under the starter's id with `.docx`, to the file of the
    render on the paper until a newer one is drawn, and, where the writer
    refused, to no link and the note that says why;
    `src/journey.test.tsx` holds, at every preview and final render it
    walks, the link to the starters that export and the note to the rest.
    The browser gate's `apps/studio/scripts/gate-word.mjs`, at each
    starter's preview in the journey, in each builder: the file
    downloaded as a person downloads it, saved as the starter's `.docx`,
    read whole by `readDocx` in Node and holding the edit the journey
    typed, as the Download PDF does; and the state measured with the
    link, or the note, on screen.
  - **Seen failing, on 17 November 2026**, each with the thing it guards
    taken out and put back. Of the reader: an entry's date, a name twice,
    a CRC-32, a path, the order of an element's children, an attribute
    the vocabulary does not hold, a document type, a relationship to an
    address, a part nothing reaches, a foreign field, a `w:t` that does
    not keep its spaces, a relationship nothing uses. Of `verifyDocx`:
    the line between two rules, a paragraph's keep, a picture's bytes,
    the header row's mark, a cell's text, a run's style, the paragraph
    between two tables, the keys' order; of `wordRefusal`, the payment
    part. Of the writer: `w:tblHeader`, `xml:space`, `w:between`,
    `w:keepNext`, `w:b`, `w:cantSplit`, a run's properties out of their
    order, both escapers, the zip's date as the clock and as an instant,
    the refusal of what belongs to the PDF and of a chart, a heading's
    keep, the paragraph between two tables, a kept block's lines, a
    total's keep, a group header's kept rows, the gap under a header,
    page 1's footer, the page's turn. Of the comparison with the PDF:
    `TABLE_SIZE`, `DEFAULT_SIZE`, a total's weight, the empty text's
    slant, and the writer's refusal of a page break in a region, of a
    table in columns and of a table's kept rows. report-spec's two
    fields failed before they were read. The corpus's reader and its
    checks were written before their tests ran, and the writer before
    its own: each was seen failing in this way and not before its code.
  - **Seen, once, by hand, on 17 November 2026**, and by no gate: a file
    written by hand of every construct this record chooses -- runs of
    every style, runs set off the line, a table with its header marked, a
    row across it, kept rows and totals, a borderless and a framed
    one-cell table, a box of exact height, a bordered and an exact
    paragraph, pictures contained, cropped and with an `svgBlip`, a page
    break, page fields, a header for page 1 and one for the rest, a footer
    for both, and the section's page -- validated against ISO/IEC
    29500-4:2016's transitional `wml.xsd` with libxml2 2.11.9, in
    `document.xml`, both headers, the footer, `styles.xml`,
    `settings.xml` and `fontTable.xml`; that file with `w:jc` before
    `w:spacing` in a `w:pPr`, `w:tblLayout` before `w:tblW`, `w:gridSpan`
    before `w:tcW`, `w:titlePg` before `w:pgSz` and an element the schema
    does not know, each refused by the schema, and `w:sz` before `w:b` in
    a `w:rPr` not, the schema making a run's properties a choice. And of
    what the writer writes: the files of every starter that exports, in
    every language, of every fixture of the corpus it writes, of a page
    of every image kind contained and covering, and of one of every
    block, 39 files, validated the same way in each of their 231
    WordprocessingML parts, none invalid. **Nobody has opened a file in
    Word.**

## Context

The runtime resolves a report into a renderer-neutral document
([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)),
and one engine drew it: report-render-pdf, with pdfmake
([0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
The roadmap had "Word and HTML, after Excel" under what a render can be.
A person who is handed a report and has to go on writing in it -- a
remark under a table, a paragraph before it is sent -- has a PDF, which is
not written in. A Word file is asked for, and before Excel.

The forces:
- **Word lays out its own pages.** A Word file is WordprocessingML
  (ECMA-376) in a zip: paragraphs, tables and pictures, which the reader's
  Word breaks into lines and pages with the faces that reader has. It is
  not the PDF in another container, and no writer can make it one. What is
  the same as the PDF has to be said, and held on the file; what is Word's
  has to be said too.
- **Never drop, clip or truncate.** A report that cannot be written whole
  is not written. A Word file that left out the slip, or printed a chart's
  numbers as a list, would be a report that prints otherwise than its PDF
  with nothing saying so.
- **Some of a report belongs to its PDF.** A QR-bill's slip stands where
  SIX puts it on a page
  ([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md));
  an e-invoice is its PDF/A-3b or its XML beside a labelled copy
  ([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
  [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md));
  a chart is laid out by ECharts, which the licence rule admits for
  report-render-pdf alone
  ([0058](0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md),
  [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md));
  and the rules a QR code is refused by -- the version that holds its
  text, the 0.4 mm module, the PSA's frame -- are decided once, in
  report-render-pdf's `qr.ts` and `epc.ts`
  ([0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
  [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **Everything a report carries is untrusted.** A title, a cell, a font's
  name, an SVG's bytes: each is something somebody else wrote, and a Word
  file is XML, in which a string that is not escaped is markup, a field
  Word runs, or a relationship to an address Word fetches.
- **The same document gives the same file.** A PDF's bytes are the
  document's
  ([0035](0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md));
  a zip writer stamps each entry with the clock unless it is told
  otherwise.
- **No Word in CI.** No runner opens Word, and nothing in the repository
  judges WordprocessingML: no schema, no validator.
- **No interface with one implementation.** Version 1 has one PDF engine
  behind a package boundary
  ([0005](0005-pdfmake-renders-reports-behind-one-adapter.md)). A second
  output is a second function over the one document, not an exporter
  interface with two cases.

## Decision

**`@formancy/report-render-docx` writes a resolved document as a Word
file: `renderDocx(document)` returns the bytes, or throws the runtime's
`RenderRefusal` and returns nothing. It writes WordprocessingML itself,
zipped by fflate, the same bytes for the same document; it says what the
document says -- every word, every cell, every picture's bytes, the page
and its regions -- and leaves lines, pages and their count to Word; and
it refuses, whole, what belongs to the PDF and what nobody has seen Word
print as the PDF does.**

**The package.** Beside report-render-pdf, on `@formancy/report-runtime`,
which hands on what report-spec decides, and on `fflate` at exactly
0.8.3, MIT, with no dependency of its own. Its own source has no Node, no
DOM and no network, and compiles with ES2023's library and no types
besides: fflate's declarations need neither Node's nor the DOM's. fflate
itself serves Node one file, which imports `module` and asks for
`worker_threads` where its asynchronous half is used, and every other
host another; the writer calls its synchronous half alone, which is the
same code in both. `renderDocx` is synchronous, takes no option and no
signal: there is no page limit to pass, since the writer counts no page.
The two engines share the document and the refusal, and no interface.
That one entry serves a browser is held from outside by the Studio's
gate alone, through the workspace; the install gate's host of it is
Node's.

**The file.** `[Content_Types].xml`; the package's relationships;
`docProps/core.xml`, the title and the creation date; `word/document.xml`
and its relationships; `word/styles.xml`, which states only what Word
would otherwise add -- no space between paragraphs, a single line -- and
the default face and size; `word/settings.xml`, which states the
compatibility mode Word itself writes, 15, so that it is read as a
document of the current format; `word/fontTable.xml`; a header part for
the page header, one for page 1's own, a footer part, each with its
relationships where it draws a picture; and a part for each picture, in
that order. Parts are named by what they are and their order,
`word/media/image1.png`, relationships by their order in their part, and
pictures numbered as they are written. Every entry of the zip is dated 1
January 1980, by its local fields, so that neither the clock nor a
machine's time zone reaches the bytes, and deflated by fflate's own code;
a PNG and a JPEG, which are compressed already, are stored as they are.

**What it writes**, block by block:

| The document | The Word file |
|---|---|
| `paragraph` | A `w:p`; each run a `w:r` that states its own family, size, weight, slant and colour, black where its style names none, and the paragraph its alignment and its mark's family and size. A run that prints nothing is no run. A line feed, a carriage return, or the two together are a `w:br`: the PDF's engine ends a line at each. |
| `keepWithNext` | `w:keepNext` on the paragraph and on every paragraph between it and the next block that prints text or a picture, past spacers, rules, rectangles and other such paragraphs, as the PDF keeps it: Word keeps a paragraph with the paragraph after it and no further. Over a page break or nothing, it is kept with nothing. |
| a run's `baseline` | `w:vertAlign`, subscript or superscript ([0061](0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)): the run is one set off the line in Word too, at Word's size and rise, not `SHIFTED_SIZE` and `SHIFTED_RISE`, which are the PDF's. |
| `pageNumber`, `pageCount` | Word's `PAGE` and `NUMPAGES` fields, each its beginning, its instruction and its end, written without a stored result: the writer knows no page, and writes no number it does not know. In the page header and footer alone. |
| `table` | A `w:tbl` of fixed layout, its grid the columns' widths, a fill column its share, with the PDF's rules and padding. The header row is `w:tblHeader`; every row is `w:cantSplit`; a row `across` is one cell of `w:gridSpan`; the empty text is a row across the table, in italic, where the PDF prints it. `w:keepNext` on every paragraph of the header row, of a group header's row and of as many rows after it as it keeps less one ([0059](0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)), and of each row before a group's footer or a total that follows a detail row or the empty text: the rows the PDF keeps on a page, as marks. A cell is one paragraph of the document's string, never a number; an empty cell an empty paragraph of its size. |
| `columns` | A table of one row with no border and no padding, a cell a column, which Word may continue on the next page. |
| `section` | With a border, a fill or padding, any one of them: a table of one cell with that border, shading and cell margin, around its blocks. Without: its blocks. |
| `image`, PNG or JPEG | An inline picture in a paragraph of its own, whose part is the asset's very bytes, written once however often it is drawn. `contain`: the picture at its own proportions, centred in its box by its paragraph's indent and the space before and after it. `cover`: the box, the picture cropped by `a:srcRect`. |
| `image`, SVG | The same picture with an `asvg:svgBlip` whose part is the asset's very bytes, once report-spec's `checkSvg` has passed them as the drawing `cleanSvg` wrote ([0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)). The picture a reader that does not know the extension shows in its place is one grey pixel, stretched to the box: a grey box, never an empty space. |
| `rule` | An empty paragraph whose line is exactly the PDF's gap above a rule, with a border under it of the rule's weight and colour, and the gap after. The same border is stated as `w:between`: ECMA-376 has Word draw, between two paragraphs of the same borders, the one between them alone (Part 1, 17.3.1.7), so two equal rules that stated only `w:bottom` would print one line. This rests on the standard's wording, not on anything seen in Word. |
| `rectangle` | A table of one cell and one row of exactly its height, shaded and bordered as it is filled and outlined, all outline where it is too small to hold one, as the PDF draws it. |
| `spacer` | An empty paragraph whose line is exactly its height; one of less than a fortieth of a point writes nothing. |
| `pageBreak` | An empty paragraph, a point tall, with `w:pageBreakBefore`. |
| `keepTogether` | Every paragraph of it but the last `w:keepNext` and every one `w:keepLines`; every row of a table in it `w:cantSplit`. |
| the page | `w:pgSz`, turned where the document's is, and `w:pgMar`; the header's and the footer's distance from the paper's edge are the margins, so that both stand inside the printable area with the body between them, as the document says. |
| `pageHeader`, `pageFooter` | Word's header and footer; a header ends, and a footer begins, with an empty line as tall as the PDF's gap between a region and the body. One that holds nothing is no part. |
| `firstPageHeader` | `w:titlePg` and a header of the first page's own, or no part where the list is empty, which ECMA-376 has Word print as a blank one (Part 1, 17.10.5) ([0060](0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)); the footer is referenced for the first page and for the rest. |

Between two tables, and after a table that ends a cell, a footer or the
body, and in a cell that holds nothing, stands one empty paragraph a
point tall, so that two tables stay two and a cell ends with a paragraph,
as WordprocessingML's readers expect; no block of the document is one.
Nothing else is added.

**Text.** One module, `xml.ts`, makes markup, and markup is a type of its
own: `text` escapes a string as an element's text, `attribute` as an
attribute's value, an element is built of those and of literals the
writer typed, and a string from a document does not compile where
markup stands. Each escaper is whole: it writes any string so that a
parser reads that string back -- a carriage return in text and a tab, a
line feed and a carriage return in an attribute as character references
-- or throws. Every `w:t` says `xml:space="preserve"`: Word strips the
spaces at either end of one that does not, the runtime lowers each
inline to a run of its own, and a run that ends in a space is the
commonest a report has. Before anything is written, every string a page
prints is held to what a report prints, report-spec's
`refusedCharacter`, the rule the PDF is held to; and to what an XML
document holds and Word prints as text: a control character other than a
line feed and a carriage return -- Unicode's General_Category Cc, U+0000
to U+001F and U+007F to U+009F, a tab among them -- U+2028, U+2029,
U+FFFE, U+FFFF and half a surrogate pair are refused as `unsupported`,
naming the block and the code point. The title is written and printed in
no face, so it is held to XML's characters alone, in any script, as the
PDF holds it to being text. The creation date is parsed, refused where
it is no date as the PDF refuses it, and written by the writer as the
instant it is, in UTC, to the second: never the document's own string.
Nothing a document carries is a part's name, a relationship's target or
a field's instruction: those are the writer's own, and the file holds no
relationship to an address.

**Fonts.** The file names families and embeds none. A font token the
report maps
([0043](0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md))
is named by the family its normal face states, read by `readFont`: name
ID 1, the family Word lists a face under, which `readFont` hands on as
`legacyFamily` where the font states a typographic family before it --
to Word "Probe Sans Light" is a family of its own and "Probe Sans"
another. The name goes into all four of a run's font slots. `sans`
unmapped is Roboto, the face the PDF prints it in; `serif` and `mono`
unmapped are refused, as the PDF refuses them, and so is a weight or a
slant a mapped token has no face for, which Word would synthesise; a
token whose faces are of different typographic families is refused,
since the file names one family for it; and a family whose name is
nothing, or holds a control character or one XML does not, is refused
as `invalid-asset`. Weight and slant are `w:b` and `w:i`. A mapped
face's characters are known, so text is held to them as the PDF holds
it; Roboto's bytes are not in the package. `fontTable.xml` states each
family's kind by its token -- swiss, roman or modern, the last of fixed
pitch -- which is what a reader without the face chooses another by.

**Lengths.** One module, `units.ts`, turns points into Word's units and
rounds once: twentieths of a point for a length, half-points for a size,
eighths of a point for a rule's and a border's weight, EMUs for a
picture. So a length is the document's to within a fortieth of a point,
a size to within a quarter, a weight to within a sixteenth. A weight
Word's border does not hold, under a quarter of a point or over twelve,
is refused. No value is rounded: a cell is the string the runtime
formatted.

**What the document leaves to an engine** -- a paragraph's and a
table's size where their style states none, bold for a table's header,
group and total rows, italic for its empty text, its rules and padding,
the space around a rule, a rectangle's outline, the gap between a region
and the body -- is the PDF renderer's, stated again in `look.ts`.
`against-pdf.test.ts` holds the sizes, the weights and the slant to the
PDF; the rules, the padding, the gaps and the colours print nothing it
reads, and are held by review.

**What is refused**, before a byte is written, as the runtime's
`RenderRefusal`, with the PDF renderer's codes, in this order: the
creation date and the title; the payment part, the e-invoice and a
preview's label; the page; then the page header, page 1's own, the page
footer and the body, each block in document order.

- **What belongs to the PDF**, each `unsupported`, naming it:
  - a **payment part**. SIX fixes the slip to the millimetre at the foot
    of the last page; a Word file's pages are Word's, and a letter without
    its slip is another letter;
  - an **e-invoice**, of either kind. A Factur-X invoice is the PDF/A-3b
    that embeds its XML, and an XRechnung's page is the labelled copy of
    an XML a host sends; a Word file is neither, and one a person may
    change is no copy;
  - a **labelled preview**: a document whose page header opens with the
    runtime's `PREVIEW_LABEL` or `E_INVOICE_PREVIEW_LABEL`, read as the
    PDF renderer reads it where it refuses a preview as a PDF/A
    ([0057](0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)).
    In a Word file the label is a paragraph a person deletes, and the
    file would then pass for the report. So an e-invoice's preview is
    refused as its final render is, by the rule and not by what a
    starter happens to carry; a preview that lacks nothing carries no
    label, and is written;
  - a **chart**. Its marks and its words are placed by ECharts, which no
    package but report-render-pdf may depend on;
  - a **QR code** and an **EPC QR code**. What a code is refused by is
    decided in report-render-pdf, and a second writer would decide it a
    second time; until those rules stand where both read them, a
    document with a code is not written.
- **What nobody has seen Word print as the PDF does**, each
  `unsupported`, naming the asset, the table or the block:
  - a **JPEG its Exif block turns**. PDFKit turns it; whether Word does is
    not known here, and reports of it differ. report-spec's `imageHeader`
    says a JPEG's `orientation` where it is 2 to 8, absent where it is
    upright, from the walk that already read it;
  - a **JPEG of four components**, which the PDF draws in CMYK;
  - an **SVG that covers a box of other proportions than its own**, which
    needs a drawing cropped;
  - a **table in a framed section**, which is a table inside a table's
    cell, whose header row this record does not rely on Word to repeat;
    padding alone frames a section, so a table in one that only pads is
    refused too;
  - a **page break in a framed section**: Word starts no page inside a
    cell.
- **What no engine prints**, as report-render-pdf refuses it, by its
  code and its subject: a table in a columns block, a page break in a
  page region, a keep-together block or a column, a page field outside
  the page header and footer, a block, a field, a fit, a size, a colour,
  an alignment or a table's row the document's types do not hold, blocks
  nested past sixteen, a page the margins leave nothing of, and a
  picture, a rectangle or fixed columns wider than where they stand, as
  `content-too-large`. Bytes that are not the picture or the font they
  are declared as are `invalid-asset`: a PNG's image data is inflated,
  by fflate's streaming decompressor, and held to the scanlines its
  header promises, as the PDF renderer holds it. The corpus's
  `MALFORMED` list is one document for each, and both engines refuse
  every one alike.
- **The writer's own bounds.** As `content-too-large`: a picture, a
  rectangle or a spacer taller than the printable area, which no page of
  a Word file holds -- the PDF judges the first two against the body
  between its regions, and refuses no spacer; more than
  `MAX_DOCX_PARAGRAPHS` paragraphs, a table's cell being one, 100,000;
  text of more than `MAX_DOCX_CHARACTERS` characters, 4,000,000; and
  pictures of more than `MAX_DOCX_MEDIA_BYTES` together, each counted
  once, twice `MAX_ASSET_BYTES`, as the PDF renderer's bound counts two
  images of the largest kind. All three are counted in the walk that
  checks the document, before anything is built. Measured on 17
  November 2026, on an Intel Core i9-10900K shared with other work,
  under Node 24.21.0 with fflate 0.8.3, a process a measurement: a table
  of 100,000 cells holding 4,000,000 ampersands between them, each
  written five characters long, was written in 1.9 seconds with 657 MB
  resident at the most; the same cells holding a character each in 1.4
  seconds and 555 MB; at 250,000 cells and 8,000,000 characters, 4.6
  seconds and 1,319 MB, which is why the bounds are not there. As
  `unsupported`: a creation date of a year a core property cannot state.

A refusal the PDF renderer makes of what it measured -- a block taller
than a page's body, a line it cannot place, a run set off the line alone
on a line, more pages than the host allows -- is not the writer's: it
measures nothing.

**The starters.** `starters.test.ts` is the list, and fails on a starter
it does not name. As they stand on the day of this record:

| Starter | Its Word file |
|---|---|
| Service inspection, Quotation, Grouped equipment, Site visit, Order confirmation, Product data sheet | written |
| Invoice, Payment reminder | refused: the payment part |
| Euro invoice | refused: its EPC QR code |
| E-invoice (Factur-X), E-invoice (XRechnung) | a final render refused for its e-invoice, a preview for its label |

**What is the same as the PDF, and what is Word's.** The same, stated in
the file and held on it: every word in its order, in the region it
stands in; every table's cells, row by row; the header row marked as the
one to repeat, and the rows the PDF keeps on a page marked as kept; each
run's family, size, weight, slant and colour, and how it is set against
the line; each paragraph's alignment; each picture's bytes, its box and
its crop; a rule's weight and colour, a rectangle's size and paints, a
spacer's height, a section's frame, a columns block's widths; the paper,
its margins, the first page's own header; a page's number and count as
fields. These are what the file says, not what Word then does. Word's,
and claimed by nothing here: where a line and a page break, and how many
pages there are; whether it repeats the marked row and keeps the marked
ones, and what it does with a row marked not to split that is taller
than a page, which the PDF splits; whether a kept block taller than a
page is split, which the PDF refuses; what a keep mark inside a framed
section's cell holds together; the face, where the reader lacks the
family, and the face of the family Word draws as bold, where the PDF
draws the one the report mapped, Roboto Medium for the renderer's own;
how far a run set off the line is moved; a line's height; a picture's
colours; and the points the file adds that the document has not -- one
between two tables, after a table that ends a cell, a footer or the
body, and at the head of a page a break starts.

**The proof** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
extended). A claim about a report's Word file is checked on the file the
writer produced, read back by the corpus's `readDocx`: the zip by a walk
of its own and Node's zlib, the XML by saxes, a closed vocabulary in the
order ECMA-376 gives each element's children, transcribed from the
schema for the elements the writer writes. `verifyDocx` holds it to the
expectation the corpus derives from the document for its PDF, for what a
Word file can show of it, and, block by block, to what the document
states outright, by the corpus's own reading of the table above, never
the writer's code. Its sizes, weights and slant where the document
states none are held to the PDF itself. Not on the strings the writer
built, and not through a mocked writer.

**The Studio.** The Preview writes the Word file of the document it drew
the PDF from, and offers it after Download PDF as **Download Word**, the
starter's id with `.docx`, the file of the render on the paper. Where
the writer refused, there is no link, and a note in its place says so in
the writer's own sentence: "No Word file: " and the refusal. The link is
the room's `tool`, with no rule of its own; the README's pictures of the
Studio are taken again by their script, their Preview holding one link
more.

**The roadmap.** Word leaves it, before Excel; HTML stays, after Excel.
What this record refuses and a later one may lift is named there: the
codes, once their rules stand below both engines; the pictures nobody
has seen in Word, a table and a page break in a framed section; faces
embedded; a raster for an SVG; and a gate that judges the file by
ECMA-376's schemas.

**What another export cites.** 0069, a workbook of a report's tables, is
a separate record. From this one it can take, rather than argue again:
the reasons a payment part, an e-invoice, a chart and the codes belong
to the PDF, each with its record -- whether a workbook, which never
claims to be the report, refuses any of them is 0069's to decide; that
an export is a function over the resolved document beside `renderPdf`,
with the runtime's refusal and no shared interface; that a file is dated
by a constant and proved on its bytes, read back by readers that are not
its writer, the corpus's zip and package readers among them, which read
any package of ECMA-376's Part 2; that every string is written by one
escaping module whose markup is a type; and that the Preview offers the
file of the render on the paper, or says why not. The refusals live in
this package's `pdf-only.ts`; once two exports refuse the same thing,
the predicate moves to report-runtime, beside the document, and is not
written twice.

## Consequences

**What it buys.**
- **A report a person can go on writing in**, with its tables as Word's
  tables, their header rows marked to repeat, its header and footer as
  Word's, and its page numbers as fields Word works out.
- **The same file for the same document**, in any Node process and any
  time zone, which a host can store by its digest.
- **A small writer.** One dependency with none of its own, no fonts and
  no rasteriser in the package; the Studio loads it with its first
  render.
- **Refusals a person can read**, each naming what it is about, and never
  a file that lost something.

**What it costs.**
- **Every starter that is paid by a code or is an invoice in law is
  refused**, in a final render and in a preview, and so will a starter
  that draws a chart be. A host whose reports carry a QR code of any
  kind cannot export them.
- **Nobody has opened a file in Word.** That Word opens what this writer
  writes, repeats the header row, keeps the rows, draws the SVG, draws
  two equal rules as two lines, puts the first page's header and both
  footers where the file says, works both fields out, and how any of it
  looks, is held by no test. The files were validated against the schema
  once, by hand; the schema is not in the repository, and nothing in CI
  repeats it. The Studio's demo is served from `main`
  ([0018](0018-the-studio-demo-is-served-at-formancy-ai-report.md)), so
  the files reach the public when this change merges, not at a release:
  a person opens the starters' files in Word before it merges, and says
  here what was seen, or the Studio's link waits.
- **The order of an element's children is transcribed, twice.** The
  writer writes them in ECMA-376's order and the corpus's reader holds
  them to it, from a table copied out of the schema for the elements in
  use. A mistake made in both passes; a schema in a gate would find it.
- **The mapping is read twice too.** The corpus's check walks a document
  and a file by its own reading of the table above. A row both misread
  passes.
- **A reader without the face sees another.** Roboto, the renderer's own
  face, is on few machines: Word chooses a sans face of its own, lines
  break elsewhere, and the file says nothing of it. A host that maps its
  house font is read in it where that font is installed.
- **Bold is Word's bold.** The PDF draws the face the report mapped as
  bold; Word draws the bold of the family by its own rule. The faces of
  a token must be of one typographic family, and no more is asked of
  them.
- **Word may print what the PDF refuses, and the other way round.** A
  kept block taller than a page, a line no page holds, a run set off the
  line that Word breaks onto a line of its own, a character Roboto has
  no glyph for, a picture taller than the body between a tall header and
  footer, a report of more pages than a host allows: the PDF renderer
  refuses them and the writer cannot see them. A report of more than
  100,000 paragraphs, a labelled preview, a spacer taller than the
  printable area: the writer refuses them and the PDF prints them. The
  Studio offers the file only beside a PDF that was drawn; a host that
  calls `renderDocx` alone gets no such check.
- **A page field prints nothing in a reader that works no field out.** A
  previewer or a converter that shows a field's stored result shows
  "Page  of ", since the file stores none. Which readers do was not
  tried.
- **An SVG is a grey box in a reader that does not draw `svgBlip`**,
  which Microsoft's Open XML SDK lists as Office 2019's and later. No
  rasteriser is in the package, so the fallback cannot be the drawing.
- **A turned JPEG, a CMYK JPEG, an SVG that covers, and a table or a
  page break in a framed section are refused**, each until someone has
  seen what Word does with it.
- **The contract's refusals and the engine's look are stated twice.**
  What any engine must refuse of a document, and what the document leaves
  to an engine, are report-render-pdf's and now the writer's too, with
  the readings they rest on: a table's styled rows, a column's share of a
  width, whether a section is framed, what a heading is kept with. The
  corpus's `MALFORMED` list holds the refusals to each other, and
  `against-pdf.test.ts` the sizes, the weights and the slant; a table's
  rules and padding, a rule's space, a rectangle's outline, the gap under
  a header and every colour are held by review. The comparison is of
  words, not runs: a cell printed bold in one engine and light in the
  other passes where the same word is printed both ways elsewhere in the
  document.
- **A length is rounded to Word's unit**: a size to the half point, so
  9.25 points is written 9.5; a weight to the eighth; a length to the
  twentieth.
- **The file is a little taller than the document.** A point between two
  tables, after a table that ends a cell, a footer or the body, and at
  the head of a page a break starts.
- **The file states no language.** The resolved document carries no
  locale, so Word proofs the text in the reader's own.
- **Every run states its properties.** No style carries them, so the
  XML is long, some 480 characters a table cell, and a person who wants
  every cell another size changes them cell by cell, not by a style.
- **The writer holds the thread, and memory.** `renderDocx` is
  synchronous and takes no signal: a file at its bounds is written in
  one step of about two seconds that nothing interrupts, in some 650 MB,
  and a host that must stop one runs it in a worker.
- **The README's pictures are taken again**, and every walk of the
  Studio writes a file more at each render.
- **report-spec's `JpegHeader` and `FontNames` grow a field each**,
  absent on every JPEG read as upright and every font without a
  typographic family, so that no expectation of either changes.

**What it forecloses.** Nothing that cannot be undone: the package is
its own, nothing else depends on it, and the Studio's link is one link.
The file's shape is not a contract: a later release may write styles,
embed faces or draw codes, and the same document then gives other bytes.

## Alternatives considered

**The `docx` package.** MIT, and it writes what this writer writes and
far more. Read on npm on 17 November 2026, 9.15.4 unpacks to 20 MB and
depends on fflate, nanoid and `@types/node`, the last a production
dependency of a package that would stand in a browser's bundle; and its
core properties write `dcterms:created` and `dcterms:modified` from
`new Date()` with no option to pass either, so the same document would
give other bytes each second until its output was rewritten. Escaping
would be its, read on its word. A writer of the few dozen elements a
resolved document needs is smaller than the adapter that would hold a
library to them.

**A writer over JSZip.** 3.10.2 is `(MIT OR GPL-3.0-or-later)`, which
`scripts/dependency-licences.mjs` reads as an expression with an allowed
branch, and declares four dependencies of its own. fflate declares none
and deflates synchronously.

**Entries stored, not deflated**, and no dependency at all.
WordprocessingML is long: the hand-written file's `document.xml`, most
of it a table of 157 rows of three cells, was 216,007 characters. A
report of many rows would be a file of many megabytes.

**The platform's `CompressionStream`.** No dependency either, but
asynchronous, and the bytes are whichever zlib the runtime carries: the
same document would not give the same file in Node and in a browser, or
across releases of either.

**The look and the contract stated once, in report-runtime**, as 0061
stated what a shifted run prints as, with report-render-pdf importing
them. It is where they belong once two engines read them, and it is not
done here: the readings are the PDF renderer's `styledRows`, `cellFace`,
`runFace`, `framed`, `columnWidths` and its checks, in modules whose
every move is proved by the corpus's PDFs, the README's pictures and the
e-invoice gate's recording staying as they are -- a change of its own,
with nothing of a Word file in it, and one that would have had this
change touch the PDF of every report. Until it is made, the two
statements are held together by the comparison and the list above, and
what they do not hold is a cost above.

**Embedding the faces**, as Word obfuscates them. A face whose fsType
allows preview and print alone may not go into a document that is
edited, so some mapped faces would embed and others not; Roboto's bytes
would have to ship in the package or come from pdfmake; nothing here
subsets a font for Word, so a file would carry each face whole; and that
Word then draws in it is no test's. A later record's.

**Each face named by its own name ID 1, with `w:b` and `w:i` as its
style-linked subfamily says.** It is how Word finds a face, and would
print a Light and a SemiBold cut mapped as normal and bold in those very
faces. It needs a font's `fsSelection`, which the reader does not hand
on, and nobody has seen Word do it.

**A raster of an SVG as its fallback.** It needs a rasteriser: fills by
either rule, strokes with their joins, caps and dashes, gradients, clip
paths and groups, proved against the PDF's own drawing. A package of its
own. A library that brings one in WebAssembly was not weighed: it would
be a second drawing of every SVG to hold to the PDF's.

**An SVG as the picture itself, with no fallback.** Word writes a
raster there and the SVG in the extension; whether it reads an SVG in the
raster's place nobody here has seen.

**An empty fallback**, one transparent pixel. A reader that draws no
SVG would show nothing where the drawing is, and say nothing: the one
thing a report may not do.

**Refusing every SVG.** Most of the starters that are written print the
firm's mark, an SVG; a host with a drawn logo would export nothing.

**A stored result in a page field**, so that a reader that works no
field out shows a number. The writer knows no page: any number it
stored would be one it does not know, and a placeholder would be words
the report did not write.

**Two equal rules kept apart by the paragraph that keeps two tables
apart.** A point the document has not, where `w:between` adds none.

**Writing a labelled preview with its label.** An invoice's preview
would export, and its label is one keystroke from gone.

**Drawing the codes here**, a PNG written from the matrix. Sound in
itself -- a code's matrix is a raster already -- but what a code is
refused by would then be decided in two packages, and moving it below
both is a change to report-render-pdf that this record does not make.

**The slip in the Word file**, as a table or as boxes anchored to the
page. Its place and its sizes are SIX's, on the last page, which only
Word knows; and its face is one the reader may not have.

**A Word file without what is refused**, the letter without its slip,
the page without its chart. Dropped content, with the file looking
whole.

**A chart as a picture drawn by report-render-pdf.** The writer would
depend on the renderer, pdfmake and ECharts with it, for one block.

**The PDF's geometry for a run set off the line**, a smaller size and a
raised position. The run would look the PDF's and be no subscript to
Word: not found as one, not kept as one when the paragraph is edited.

**Paragraph styles for what runs share.** A shorter file and one a
person restyles at once, and a second thing for the reader to resolve
before it can say what a run prints in. Later, if a file's size asks for
it.

**A count of paragraphs alone as the bound.** A cell may be 16,384
characters, so 100,000 of them would be a billion and a half before the
XML, its bytes and the deflate each copied them: a fault for want of
memory, not a refusal.

**The schema in the repository, or a gate that fetches it.** The proof
this record lacks. ECMA-376's schemas are another body's files, to be
admitted as the e-invoice tools are, by digest, with a validator a runner
has and a job of its own. Named on the roadmap, not built here.

**An exporter interface**, `render(document, format)`. Two functions
with nothing in common but their input, and a third on its way that
writes tables alone.

**Word export in the builders.** A builder edits a report and prints
nothing; a host renders.
