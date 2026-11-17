# 0068 — A report is written as a Word file by a writer of its own, which says what the resolved document says in Word's own pages, and refuses what belongs to its PDF

- **Status:** accepted; numbered while 0067 was another branch's; extends [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), whose proof on the PDF an engine produced is a proof on the file a writer produced: a Word file is read back, by readers that are not its writer, and held to the expectation its PDF is held to; [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), whose Preview offers the file beside the PDF; and [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md), whose `imageHeader` now says how a JPEG's Exif block turns it
- **Date:** 2026-11-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **Written before the code.** Of what follows, only the last entry has
    happened. Each other names the test or the gate this change writes,
    test-first; the record is corrected to what was built, and this entry
    removed, before the change is merged.
  - **The reader.** report-corpus's `src/docx/read.test.ts` proves
    `readDocx` on packages written by hand inside the test and zipped by
    Node's zlib, never by the writer: the parts by their content types,
    every relationship followed to a part, the document's paragraphs, runs,
    fields, tables and pictures, the header and footer parts by the kind
    of their reference, and the section's page. It reads a closed
    vocabulary (`src/docx/vocabulary.ts`): an element or an attribute the
    list does not hold, an element's children out of the order ECMA-376
    gives them, XML that is not well-formed, a relationship to an address
    or to no part of the package, a part no relationship reaches, a field
    other than `PAGE` and `NUMPAGES`, and a zip entry dated otherwise than
    the writer dates one are each refused, naming the part. The zip is read
    by the corpus's own walk of the central directory and Node's
    `inflateRawSync`, the XML by saxes: neither is fflate.
    `src/check-docx.test.ts` holds `verifyDocx` to failing on a file that
    lost a row, a cell, a word, a header row's mark, a kept row's, a
    picture's bytes or a page field, one defect a case.
  - **The writer, on the file it wrote.** report-render-docx's
    `src/corpus.test.ts` writes every fixture of the corpus -- section
    20's, the SVG ones, the kept rows', page 1's own header's, the charts'
    and those of runs set off the line -- and proves each on the file with
    `verifyDocx`, against the expectation the corpus derives from the
    document and holds its PDF to, or holds it to the refusal the corpus's
    `wordRefusal` derives from the document. `src/starters.test.ts` names
    every starter by its id as written or as refused, with the refusal's
    code and subject, in every language the starter declares, and fails on
    a starter it does not name. `src/refusals.test.ts` holds each refusal
    below to its code, its subject and its sentence, and to returning
    nothing. `src/text.test.ts` holds every string a document carries -- a
    title, a run, a cell, a column header, an empty text, a font's family
    -- written with `&`, `<`, `>`, quotes, `]]>`, a closing `w:t` and a
    field's instruction in it, to being read back as that very text, in a
    file with no element, field or relationship the same document without
    it lacks; and each character below to its refusal.
    `src/pictures.test.ts` holds a picture's part to the asset's very
    bytes, its extent, a contained picture's place in its box and a
    covering one's crop to its pixels, an SVG's `svgBlip` and its
    fallback, and every kind of the corpus's `IMAGE_KINDS` to being written
    or refused. `src/fonts.test.ts` holds a mapped token to the family its
    face's name table states, `sans` unmapped to Roboto, and the other two
    unmapped to a refusal. `src/bounds.test.ts` writes a file at each bound
    and refuses one past it.
  - **The same bytes.** `src/stable.test.ts`: one document written twice is
    the same bytes; written in a second process under another time zone,
    the same digest; every entry of the zip dated as `package.ts` dates
    it.
  - **Against the PDF.** `src/against-pdf.test.ts`, with report-render-pdf
    a devDependency of the suite alone: for every starter and fixture both
    write, each run of the Word file is a run of the PDF, read back with
    PDF.js, of the same text, size and weight -- what the document leaves
    to an engine, stated twice, held together; and a document of each kind
    an engine must refuse for where a block stands is refused by both, by
    the same code and subject.
  - **report-spec.** `src/image-header.test.ts` holds a JPEG's
    `orientation` to each of 2 to 8 as PDFKit reads it, and to being
    absent where the image is upright.
  - **From outside.** `scripts/install-fixture/docx.ts`, which the node
    host's `consume.ts` runs: the packed package writes a document, and
    Node alone finds its parts. The package's `tsconfig.json` has ES2023's
    library and no `@types/node`, so a `node:` import or a DOM global in
    `src` does not compile. `scripts/dependency-licences.mjs` judges
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
    `settings.xml` and `fontTable.xml`. **Seen failing** the same day:
    that file with `w:jc` before `w:spacing` in a `w:pPr`, `w:tblLayout`
    before `w:tblW`, `w:gridSpan` before `w:tcW`, `w:titlePg` before
    `w:pgSz` and an element the schema does not know, each refused by the
    schema; `w:sz` before `w:b` in a `w:rPr` was not, the schema making a
    run's properties a choice. **Nobody has opened a file in Word.**

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
  name: each is a string somebody else wrote, and a Word file is XML, in
  which a string that is not escaped is markup, a field Word runs, or a
  relationship to an address Word fetches.
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
0.8.3, MIT, with no dependency of its own. No Node, no DOM, no network,
one entry for a server and a browser. `renderDocx` is synchronous, takes
no option and no signal: there is no page limit to pass, since the
writer counts no page. The two engines share the document and the
refusal, and no interface.

**The file.** `[Content_Types].xml`; the package's relationships;
`word/document.xml`; `word/styles.xml`, which states only what Word would
otherwise add -- no space between paragraphs, a single line -- and the
default face; `word/settings.xml`, which states the compatibility mode
Word itself writes, 15, so that it is read as a document of the current
format; `word/fontTable.xml`; a header part for the page header, one for
page 1's own, a footer part; a part for each picture; and
`docProps/core.xml`, the title and the creation date the document
carries. Parts are named by their order, `word/media/image1.png`,
relationships by their order in their part, and pictures numbered as
they are written. Every entry of the zip is dated 1 January 1980, by its
local fields, so that neither the clock nor a machine's time zone reaches
the bytes, and deflated by fflate's own code, the same in every process.

**What it writes**, block by block:

| The document | The Word file |
|---|---|
| `paragraph` | A `w:p`; each run a `w:r` that states its own family, size, weight, slant and colour, and the paragraph its alignment; `keepWithNext` is `w:keepNext`. A line feed, a carriage return, or the two together are a `w:br`: the PDF's engine ends a line at each. |
| a run's `baseline` | `w:vertAlign`, subscript or superscript ([0061](0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)): the run is one set off the line in Word too, at Word's size and rise, not `SHIFTED_SIZE` and `SHIFTED_RISE`, which are the PDF's. |
| `pageNumber`, `pageCount` | Word's `PAGE` and `NUMPAGES` fields, written without a cached result: the writer knows no page, and writes no number it does not know. In the page header and footer alone. |
| `table` | A `w:tbl` of fixed layout, its grid the columns' widths, a fill column its share. The header row is `w:tblHeader`; every row is `w:cantSplit`; a row `across` is one cell of `w:gridSpan`; a group header's cells are `w:keepNext`, and those of as many rows after it as it keeps less one ([0059](0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)); the empty text is a row across the table, in italic, where the PDF prints it. A cell's text is the document's string, never a number. |
| `columns` | A table of one row with no border and no padding, a cell a column, which Word may continue on the next page. |
| `section` | With a border, a fill or padding: a table of one cell with that border, shading and cell margin, around its blocks. Without: its blocks. |
| `image`, PNG or JPEG | An inline picture whose part is the asset's very bytes, written once however often it is drawn. `contain`: the picture at its own proportions, centred in its box by its paragraph's indent and spacing. `cover`: the box, the picture cropped by `a:srcRect`. |
| `image`, SVG | The same picture with an `asvg:svgBlip` whose part is the asset's very bytes, the drawing `cleanSvg` wrote ([0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)). The picture a reader that does not know the extension shows in its place is one grey pixel, stretched to the box: a grey box, never an empty space. |
| `rule` | An empty paragraph with a bottom border of the rule's weight and colour. |
| `rectangle` | A table of one cell and one row of exactly its height, shaded and bordered as it is filled and outlined. |
| `spacer` | An empty paragraph whose line is exactly its height. |
| `pageBreak` | An empty paragraph, a point tall, with `w:pageBreakBefore`. |
| `keepTogether` | Every paragraph of it but the last `w:keepNext` and every one `w:keepLines`; a columns block's row in it `w:cantSplit`. |
| the page | `w:pgSz` and `w:pgMar`; the header's and the footer's distance from the paper's edge are the margins, so that both stand inside the printable area with the body between them, as the document says. |
| `pageHeader`, `pageFooter` | Word's header and footer. |
| `firstPageHeader` | `w:titlePg` and a header of the first page's own, or none where the list is empty ([0060](0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)); the footer is referenced for the first page and for the rest. |

Between two tables, and after a table that ends a cell, a header, a
footer or the body, stands one empty paragraph a point tall, so that two
tables stay two and a cell ends with a paragraph, as WordprocessingML's
readers expect; no block of the document is one. Nothing else is added.

**Text.** One function writes a string as XML text and one as an
attribute, in `xml.ts`, and nothing else writes a string. Before
anything is written, every string is held to what a report prints,
report-spec's `refusedCharacter`, the rule the PDF is held to; and to
what an XML document holds and Word prints as text: a control character
other than a line feed and a carriage return, U+2028, U+2029, U+FFFE,
U+FFFF and half a surrogate pair are refused as `unsupported`, naming the
block and the code point. Nothing a document carries is a part's name, a
relationship's target or a field's instruction: those are the writer's
own, and the file holds no relationship to an address.

**Fonts.** The file names families and embeds none. A font token the
report maps
([0043](0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md))
is named by the family its normal face's name table states, read by
`readFont`; `sans` unmapped is Roboto, the face the PDF prints it in;
`serif` and `mono` unmapped are refused, as the PDF refuses them; a token
whose faces state different families is refused. Weight and slant are
`w:b` and `w:i`. `fontTable.xml` states each family's kind by its token
-- swiss, roman or modern, the last of fixed pitch -- which is what a
reader without the face chooses another by.

**Lengths.** One module, `units.ts`, turns points into Word's units and
rounds once: twentieths of a point for a length, half-points for a size,
eighths of a point for a rule's and a border's weight, EMUs for a
picture. A weight Word's border does not hold, under a quarter of a point
or over twelve, is refused. No value is rounded: a cell is the string
the runtime formatted.

**What the document leaves to an engine** -- a table's size where its
cells state none, bold for its header, group and total rows, its rules
and padding, the space around a rule, a rectangle's outline -- is the PDF
renderer's, stated again in `look.ts`. `against-pdf.test.ts` holds the
sizes and the weights to the PDF; the rules, the padding and the spaces
are held by review.

**What is refused**, before a byte is written, as the runtime's
`RenderRefusal`, with the PDF renderer's codes:

- **What belongs to the PDF**, each `unsupported`, naming it:
  - a **payment part**. SIX fixes the slip to the millimetre at the foot
    of the last page; a Word file's pages are Word's, and a letter without
    its slip is another letter;
  - an **e-invoice**, of either kind. A Factur-X invoice is the PDF/A-3b
    that embeds its XML, and an XRechnung's page is the labelled copy of
    an XML a host sends; a Word file is neither, and one a person may
    change is no copy;
  - a **chart**. Its marks and its words are placed by ECharts, which no
    package but report-render-pdf may depend on;
  - a **QR code** and an **EPC QR code**. What a code is refused by is
    decided in report-render-pdf, and a second writer would decide it a
    second time; until those rules stand where both read them, a
    document with a code is not written.
- **What nobody has seen Word print as the PDF does**, each
  `unsupported`, naming the asset or the table:
  - a **JPEG its Exif block turns**. PDFKit turns it; whether Word does is
    not known here, and reports of it differ. report-spec's `imageHeader`
    says a JPEG's `orientation` where it is 2 to 8, absent where it is
    upright, from the walk that already read it;
  - a **JPEG of four components**, which the PDF draws in CMYK;
  - an **SVG that covers a box of other proportions than its own**, which
    needs a drawing cropped;
  - a **table in a framed section**, which is a table inside a table's
    cell, whose header row this record does not rely on Word to repeat.
- **What no engine prints**, as report-render-pdf refuses it: a table in
  a columns block, a page break in a page region, a keep-together block
  or a column, a page field outside the page header and footer, a block,
  a field, a fit, a size, a colour or an alignment the document's types
  do not hold, blocks nested past sixteen, a page the margins leave
  nothing of; and as `content-too-large`, a picture, a rectangle or fixed
  columns wider than where they stand, and a picture, a rectangle or a
  spacer taller than the printable area. Bytes that are not the picture
  or the font they are declared as are `invalid-asset`.
- **Past its bounds**, as `content-too-large`: more than
  `MAX_DOCX_PARAGRAPHS` paragraphs, a table's cell being one, 100,000;
  and pictures of more than `MAX_DOCX_MEDIA_BYTES` together, each
  counted once, twice `MAX_ASSET_BYTES`, as the PDF renderer's bound
  counts two images of the largest kind. Both are chosen, not measured:
  `bounds.test.ts` writes a file at each, and what the largest costs is
  that test's to say.

A refusal the PDF renderer makes of what it measured -- a block taller
than a page's body, a line it cannot place, more pages than the host
allows -- is not the writer's: it measures nothing.

**The starters.** As they stand on the day of this record, six are
written and five refused, each for the first thing the writer meets:

| Starter | Its Word file |
|---|---|
| Service inspection, Quotation, Grouped equipment, Site visit, Order confirmation, Product data sheet | written |
| Invoice, Payment reminder | refused: the payment part |
| Euro invoice | refused: its EPC QR code |
| E-invoice (Factur-X), E-invoice (XRechnung) | a final render refused for its e-invoice, a preview for its EPC QR code |

**What is the same as the PDF, and what is Word's.** The same, held on
the file: every word in its order, in the region it stands in; every
table's cells, row by row; the header row marked as the one to repeat,
and a group header's rows as kept; each run's family, size, weight,
slant and colour; each picture's bytes and its box; the paper, its
margins, the first page's own header; a page's number and count as
fields. Word's, and claimed by nothing here: where a line and a page
break, and how many pages there are; whether a kept block taller than a
page is split, which the PDF refuses; the face, where the reader lacks
the family, and the face of the family Word draws as bold, where the PDF
draws the one the report mapped, Roboto Medium for the renderer's own;
how far a run set off the line is moved; a line's height; a picture's
colours.

**The proof** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
extended). A claim about a report's Word file is checked on the file the
writer produced, read back by the corpus's `readDocx`: the zip by a walk
of its own and Node's zlib, the XML by saxes, a closed vocabulary in the
order ECMA-376 gives each element's children, transcribed from the
schema for the elements the writer writes. It is held to the
expectation the corpus derives from the document for its PDF
(`verifyDocx`), and its sizes and weights to the PDF itself. Not on the
strings the writer built, and not through a mocked writer.

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
has seen in Word; faces embedded; a raster for an SVG; and a gate that
judges the file by ECMA-376's schemas.

**What another export cites.** 0069, a workbook of a report's tables, is
a separate record. From this one it takes, rather than decides again:
what belongs to the PDF and why -- the payment part, the e-invoice, the
chart, the codes; that an export is a function over the resolved
document beside `renderPdf`, with the runtime's refusal and no shared
interface; that a file is dated by a constant and proved on its bytes,
read back by readers that are not its writer, the corpus's package
reader among them, which reads any package of ECMA-376's Part 2; that
every string is written by one escaping function; and that the Preview
offers the file of the render on the paper, or says why not.

## Consequences

**What it buys.**
- **A report a person can go on writing in**, with its tables as Word's
  tables, their header rows marked to repeat, its header and footer as
  Word's, and its page numbers as fields that stay right when the text
  grows.
- **The same file for the same document**, in any process and any time
  zone, which a host can store by its digest.
- **A small writer.** One dependency with none of its own, no fonts and
  no rasteriser in the package; the Studio loads it with its first
  render.
- **Refusals a person can read**, each naming what it is about, and never
  a file that lost something.

**What it costs.**
- **Five of eleven starters are refused**, every one that is paid by a
  code or is an invoice in law, and so will a starter that draws a chart
  be. A host whose reports carry a QR code of any kind cannot export
  them.
- **Nobody has opened a file in Word.** That Word opens what this writer
  writes, repeats the header row, keeps the rows, draws the SVG, puts the
  first page's header and both footers where the file says, and how any
  of it looks, is held by no test. The constructs were validated against
  the schema once, by hand, on a file written by hand; the schema is not
  in the repository, and nothing in CI repeats it. A person opens the
  starters' files before a release that ships this.
- **The order of an element's children is transcribed, twice.** The
  writer writes them in ECMA-376's order and the corpus's reader holds
  them to it, from a table copied out of the schema for the elements in
  use. A mistake made in both passes; a schema in a gate would find it.
- **A reader without the face sees another.** Roboto, the renderer's own
  face, is on few machines: Word chooses a sans face of its own, lines
  break elsewhere, and the file says nothing of it. A host that maps its
  house font is read in it where that font is installed.
- **Bold is Word's bold.** The PDF draws the face the report mapped as
  bold; Word draws the bold of the family by its own rule.
- **An SVG is a grey box in a reader that does not draw `svgBlip`**,
  which Microsoft's Open XML SDK lists as Office 2019's and later. No
  rasteriser is in the package, so the fallback cannot be the drawing.
- **A turned JPEG, a CMYK JPEG, an SVG that covers and a table in a
  framed section are refused**, each until someone has seen what Word
  does with it.
- **The contract's refusals and the engine's look are stated twice.**
  What any engine must refuse of a document, and what the document leaves
  to an engine, are report-render-pdf's and now the writer's too.
  `against-pdf.test.ts` holds the refusals for where a block stands, and
  the sizes and weights, to each other; a table's rules and padding, a
  rule's space and a rectangle's outline are held by review.
- **Word may print what the PDF refuses, and the other way round.** A
  kept block taller than a page, a line no page holds, a report of more
  pages than a host allows: the PDF renderer refuses them and the writer
  cannot see them. The Studio offers the file only beside a PDF that was
  drawn; a host that calls `renderDocx` alone gets no such check.
- **The file states no language.** The resolved document carries no
  locale, so Word proofs the text in the reader's own.
- **Every run states its properties.** No style carries them, so the
  XML is long -- the hand-written file's parts, 231,784 bytes, were
  13,205 zipped, by zlib and not by fflate -- and a person who wants
  every cell another size changes them cell by cell, not by a style.
- **The writer holds the thread.** `renderDocx` is synchronous and takes
  no signal: a file at its bound is written in one step that nothing
  interrupts, and a host that must stop one runs it in a worker.
- **A PNG's image data is not inflated.** `imageHeader` checks every
  chunk's length and CRC; a PNG whose data does not inflate to its
  scanlines, which the PDF renderer refuses, is written as it is.
- **The README's pictures are taken again**, and every walk of the
  Studio writes a file more at each render.
- **report-spec's `JpegHeader` grows a field**, absent on every JPEG it
  read as upright, so that no expectation of one changes.

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

**Embedding the faces**, as Word obfuscates them. A face whose fsType
allows preview and print alone may not go into a document that is
edited, so some mapped faces would embed and others not; Roboto's bytes
would have to ship in the package or come from pdfmake; nothing here
subsets a font for Word, so a file would carry each face whole; and that
Word then draws in it is no test's. A later record's.

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

**Refusing every SVG.** Three of the six starters that are written print
the firm's mark, an SVG; a host with a drawn logo would export nothing.

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

**The schema in the repository, or a gate that fetches it.** The proof
this record lacks. ECMA-376's schemas are another body's files, to be
admitted as the e-invoice tools are, by digest, with a validator a runner
has and a job of its own. Named on the roadmap, not built here.

**An exporter interface**, `render(document, format)`. Two functions
with nothing in common but their input, and a third on its way that
writes tables alone.

**Word export in the builders.** A builder edits a report and prints
nothing; a host renders.
