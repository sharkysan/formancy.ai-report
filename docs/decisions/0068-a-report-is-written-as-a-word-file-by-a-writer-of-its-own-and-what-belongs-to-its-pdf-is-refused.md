# 0068 — A report is written as a Word file by a writer of its own, which says what the resolved document says in Word's own pages, and refuses what belongs to its PDF

- **Status:** accepted; numbered while 0067 was another branch's; extends [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), whose proof on the PDF an engine produced is a proof on the file a writer produced: a Word file is read back, by readers that are not its writer, and held to the expectation its PDF is held to; [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), whose Preview offers the file beside the PDF; [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md), whose `imageHeader` now says how a JPEG's Exif block turns it; and [0040](0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md), whose reader now hands on the family of name ID 1 beside a typographic one; and reads again the absence [0056](0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md) put on the start page as "no print format but PDF", with the predicate that held it
- **Date:** 2026-11-17
- **Deciders:** Daniel Bacher
- **Verified by:**
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
    subject and its sentence, the order they are met in to a document
    wrong in every place the writer looks, put right a place at a time,
    and each to returning nothing.
    `src/text.test.ts` holds every string a document carries, found by a
    walk of the document that knows no field by name, to being read back
    as that very text in a file with no element, field or relationship
    the same document without it lacks, for strings a property test
    makes of markup, fields, entities and quotes; a run's spaces, a line
    ending inside a run and inside a cell, the one that ends a paragraph
    or a cell, and each character below to what the record says of it; a
    creation date that states no zone, a day or an hour no calendar has,
    or the year 0000 to its refusal; and that a string does not compile
    where markup stands (`@ts-expect-error`).
    `src/pictures.test.ts` holds a picture's part to the asset's very
    bytes, its extent, a contained picture's place in its box and a
    covering one's crop to its pixels, an SVG's `svgBlip` and its
    fallback, an SVG that is more than a drawing to its refusal, a PNG
    whose data is not its scanlines, is not what its checksum sums, has a
    byte after its end, ends before its last block, states a stored
    block's length and not its complement, uses a length code deflate
    does not define, is a gzip member or is deflate data in no zlib
    stream to theirs, a PNG that inflates to far more than its header
    promises to being inflated no further than a chunk past it, by what
    the inflater handed on, and every kind of the corpus's `IMAGE_KINDS`
    to being written and of its `UNSEEN_JPEGS` to being refused.
    `src/fonts.test.ts` holds a mapped token to the family its face's
    name table states, to name ID 1 where a typographic family stands
    beside it, `sans` unmapped to Roboto, what the PDF refuses of a font
    to its refusal, and a family of as many characters as Word reads to
    being written and one of a character more to being refused, on fonts
    report-spec's font test support made, held as their bytes in
    `src/testing/fonts.ts`. `src/bounds.test.ts` writes a file at each
    bound and refuses one past it; holds a refusal for size to nothing
    after the block that crossed it being read; writes as many paragraphs
    as the bound, each kept with the next; counts what marking a table of
    totals reads; holds a picture, a rule, a page break and a column to
    counting as a paragraph and a rectangle and a section's frame as two;
    a line ending to counting as a run, in a paragraph and in a cell, and
    the two characters together as one; what a family of quotation marks
    is written longer than it is named to being counted for every run, a
    page field's three, every paragraph mark and every cell; the
    pictures' image data to its bound, to a JPEG's bytes, and to being
    counted before a PNG is inflated; their bytes to being counted
    before a picture is read, and an asset past its own limit to being
    refused as that all the same; and the paragraphs', the characters'
    and the runs' bounds to the numbers this record states.
  - **The same bytes.** `src/stable.test.ts`: one document written twice
    is the same bytes; written in a second process fourteen hours ahead
    of UTC and in one eight behind, the same digest, and in one that sets
    its time zone once it has loaded the writer, either way; every entry
    of the zip dated as `package.ts` dates it, in its own header and in
    the directory. Under Node: what the writer gives in a browser, over the
    file fflate serves one, is the Studio's gate's, below.
  - **Against the PDF.** `src/against-pdf.test.ts`, with
    report-render-pdf a devDependency of the suite alone: for every
    starter and fixture both write, without its page regions, every word
    of the Word file with the size, the weight and the slant its run
    states is a word the PDF, read back with PDF.js, draws at that size
    in a face of that weight and slant, and every word of the PDF is one
    of the file's -- what the document leaves to an engine, stated twice,
    held together; a paragraph and a cell with line endings inside them,
    at their start and at their end print as many lines in the PDF,
    counted by where the block after them stands, as the file states
    breaks and one; every document of the corpus's `MALFORMED` list, one
    for each way a document breaks its contract with an engine before
    anything is measured, is refused by both by the same code and
    subject; one document wrong in every place both engines look -- a
    face that is no font, its creation date, its title, its page, each
    region, a block of its body and a picture's bytes -- is refused by
    both for the same place as each is put right; and two documents,
    whose pictures hold a byte more image data than a file may and
    exactly as much with a JPEG after, are refused by both for the
    picture that crossed the bound, which holds the writer's number to
    the renderer's without either drawing a page; and the two documents
    this record says the engines refuse otherwise, a picture past a
    bound of the writer's that is no picture either -- past the bytes a
    file's pictures may store, and past their image data -- are refused
    by the writer for the size and by the renderer as no picture.
    report-corpus's
    `src/fixtures/malformed.test.ts` holds each PNG of that list whose
    data is no stream to being wrong in the one way its title says, by
    zlib's own word for it.
  - **report-spec.** `src/image-header.test.ts` holds a JPEG's
    `orientation` to each of 2 to 8 as PDFKit reads it, and to being
    absent where the image is upright; `src/font-names.test.ts` holds
    `legacyFamily` to name ID 1 beside a typographic family, and to
    being absent without one.
  - **From outside.** `scripts/install-fixture/docx.ts`, which the node
    host's `consume.ts` runs: the packed package, on the fflate and the
    pako a clean npm install gives it, writes the quotation, and Node alone -- its
    zlib over a walk of the zip's directory, no reader of this
    repository's -- finds the parts a Word file is known by, the title
    and the instant in its core properties, the report's title in its
    text and the firm's mark as the very bytes the host approved; written
    again it is the same bytes; and the quotation with a QR-bill is
    refused for its payment part, by the class and the codes the package
    hands on. No install host is a browser's for it: its packed
    declarations are checked against Node's types, with `skipLibCheck`
    off, and never against the DOM's alone. The package's
    `tsconfig.json` has ES2023's library and no `@types/node`, so a
    `node:` import or a DOM global in `src` does not compile; its tests
    are a program of their own
    (`tsconfig.test.json`). `scripts/readme-example.test.mjs` holds the
    example in the package's README to lines that consumer runs.
    `scripts/dependency-licences.mjs` judges fflate and pako;
    `scripts/architecture.test.mjs`, `scripts/ci-test-jobs.test.mjs` and
    `scripts/codecov-config.test.mjs` hold the package to its row, its
    job and its component.
  - **The Studio.** `src/preview/pipeline.test.ts` names what the Word
    file of every starter the page offers is, the blank report among
    them, and holds each one's printed outcome, as a preview and as a
    final render, to handing on the Word file of the very document its
    PDF was drawn from -- read whole by `readDocx` and held by
    `verifyDocx` to the document the suite resolves from the same request
    -- or the writer's refusal, by the subject the table names and the
    corpus's `wordRefusal` derives; and a preview of incomplete data to
    printing, with the writer's refusal of its label beside it.
    `src/preview/word-fault.test.ts`, the one suite that stands in for
    the writer, holds a writer that throws what is no refusal to leaving
    the PDF as it printed, the fault said of the Word file alone, and
    `src/preview/word-chunk.test.ts` a writer whose module does not load
    to the same. `src/preview/chunks.test.ts` holds the writer, with
    fflate and pako, to one chunk of a build of the pipeline, which the
    pipeline imports dynamically and nothing that loads with it imports.
    `src/preview/pdf-view.test.tsx` holds Download Word to following
    Download PDF as the keyboard's next stop, under the starter's id with
    `.docx` and Word's media type, to the file of the render on the paper
    until a newer one is drawn, and, where the writer refused, to no link
    and a note named by its sentence, Download XML still the next stop
    after Download PDF. `src/journey.test.tsx` holds, at every preview
    and final render it walks, the link and the pipeline's very bytes to
    the starters that export and the note to the rest, the blank report
    among the rest once it is given a QR-bill.
    `scripts/gate-download.test.mjs` holds the gate's download of the
    link by its own name. The browser gate's
    `apps/studio/scripts/gate-word.mjs`, at each starter's preview in the
    journey and at an e-invoice's final render, in each builder: where
    the writer writes the report, the file downloaded as a person
    downloads it, saved as the starter's `.docx`, the keyboard's next
    stop after Download PDF, read whole by `readDocx` in Node, held by
    `verifyDocx` to the document the gate resolves under Node from the
    corpus's starter at the instant the file says it was made, and byte
    for byte the file the writer writes of that document under Node;
    where it refuses, no link and the note named by the sentence the
    writer refuses that document with under Node; a pass that read no
    file, or no refusal, fails; the state is measured with the link, or
    the note, on screen; and in the framework switch
    (`gate-switch.mjs`) the Word file offered once the paper has settled
    after an edit holds the edit, as the Download PDF does. The blank
    report, the Studio's own, is held there to its link, its name and the
    reader alone.
  - **The pages.** `apps/pages/src/limits.test.ts` holds what the start
    page says Formancy Report does not do yet to the renderers published
    from `packages/`, the PDF's and this writer: its sentence, "No print
    format but PDF" until this record, is "No Excel, CSV or HTML", true of
    the newest release and of `main` alike, and a third renderer
    published fails there until it is read again.
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
    table in columns and of a table's kept rows. Of the Studio: every
    case of the pipeline's hand-on, and the fault's, before the pipeline
    handed anything on, then the file of another document handed on and a
    starter left out of its table; the viewer's link, its place and its
    note before the viewer drew them; the journey with the viewer's link
    taken out; the gate's download by another link's name; and of the
    gate in Chromium, a final render's note read before its pages were
    drawn, which is why it waits for the paper, and a file held to the
    document of another instant. Of the install gate's consumer: the
    firm's mark held to other bytes than the host approved.
    report-spec's two
    fields failed before they were read. The corpus's reader and its
    checks were written before their tests ran, and the writer before
    its own: each was seen failing in this way and not before its code.
    On 18 November 2026: `starters.test.ts` and the Studio's
    `pipeline.test.ts`, on the sales report `main` brought and neither
    named; the pages' `limits.test.ts`, on the second renderer
    published, before its sentence was read again; the README example's
    guard, before the package had a README
    and with a line of it changed; and the guards of the package's row,
    its job, its component and this record's place in a section and in
    the register, each from the day the package arrived until its
    document was written. And the writer's own suite under coverage,
    which is how CI's test job runs it and how nobody had run it: the
    oversized job in `corpus.test.ts` and the property in `text.test.ts`
    each took past vitest's five seconds there, 5.2 to 6.6, and failed
    for it, with nothing wrong in a file; each now states a bound of its
    own with what was measured. And, the same day, what a review of the
    writer found, each case written first and seen failing on the writer
    as it stood: a PNG of a wrong checksum, with bytes after its data,
    with bytes after it that end in that checksum, and with a mebibyte
    after it, the last by the slices read; the run of 100,000 paragraphs
    each kept with the next, which was not written in 120 seconds; the
    table of totals, by fifty million readings of a row's kind for ten
    thousand rows; a kept block's last row, kept in one cell and not the
    other; a heading over a table of blank cells, kept with the table; a
    line ending that ends a paragraph and a cell, written as a break; a
    creation date with no zone, written, and three digests of one such
    document in three time zones; a rectangle, a column, a framed section
    and a picture that round to nothing, written with no width; and of
    the corpus's check, on the hand-written file, the same line ending,
    the same last row and a chart met before a turned JPEG. A case that
    the lines were counted for failed against the writer once more, after
    it: a run of nothing after a line ending opens a line in the PDF,
    which the writer had taken for no run and so for no line. With the
    thing each guards taken out again: the count of a table's cells taken
    after its rows, the order of the checks changed in four ways, a
    picture's bytes read where the walk meets it, the bound on pictures,
    the reading of fflate's state, the checksum's comparison, the end
    asked for only once all is read, the empty text counted whatever the
    rows, a cell's last ending written, and a date read as the machine
    reads it; and of the Studio, the writer's import outside the guard
    that catches what it throws. And, the same day, what a second review
    found, each case written first and seen failing on the writer as it
    stood: a family of 32 characters, written; a family of quotation
    marks, uncounted, in a paragraph's runs, its mark, a page field and
    a table's cells; the pictures' image data two bytes past its bound,
    a JPEG's bytes past it, and a PNG past it whose data is no stream,
    refused for the data; a PNG whose stored block states no complement
    and one of a length code deflate does not define, each written, here
    and in the corpus's list; a line ending in a run and in a cell, and
    the two characters together, each past the runs' bound and written;
    a process that sets its time zone after it has loaded the writer, by
    fflate's own Error; a creation date of the year 0000, of 30 February,
    of a leap day its year has not, of a thirty-first its month has not
    and of an hour 24, each written; and a rectangle and a framed section
    counted as one paragraph. A picture, a rule, a page break and a
    column were counted already, and their cases passed as they were
    written, as did a face that is no font being refused first. With the
    thing each guards taken out again: the family's bound, a character
    either way; its count for a run, for a mark and for a cell, the
    cell's own token, and the count of its name as written; the image
    data's bound a byte either way, in the writer and in the renderer's
    built file, a JPEG uncounted, the count taken after a PNG is
    inflated, and the count not summed; pako left to read a gzip member,
    its error unread, what it left unread unasked, and a chunk past what
    the header promises let through; a line ending's count in a
    paragraph and in a cell, and the two characters counted as two; each
    of the six counts of a block that is no text; the fonts read after
    the walk; and of the Studio, the writer imported statically. The
    reading of fflate's state and the checksum's comparison, taken out
    above, went with fflate's inflater. And, the same day, what a third
    review found, each case written first and seen failing on the writer
    as it stood: a third picture past the bytes a file's pictures may
    store, which is no picture, refused as none; and the bounds as this
    record states them, 70,000 paragraphs and 140,000 runs, in the case
    that states them and in three that read a refusal's sentence, before
    the bound was moved. A PNG inflated a chunk past what its header
    promises, an asset past its own limit refused as that, and the two
    documents the engines refuse otherwise, held on both, passed as they
    were written. With the thing each guards taken out again: the
    asset's limit read after the file's bytes are counted; the bytes
    counted only once they are sniffed as a picture, in the writer's
    case and in the comparison's; and the inflater's stop moved ten
    chunks on.
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
    WordprocessingML parts, none invalid.
  - **Seen in Word, once, by hand, on 18 November 2026**, and by no
    gate: the files the writer writes of the six starters that export,
    with those of the 20 fixtures of the corpus it writes beside them --
    the bytes this change merges with, written again from its build and
    compared file by file -- opened in Word by the person who decides,
    who found them fine. Nothing more was written down: which Word, which
    of the fixtures' files, and whether Word repeated a header row, kept
    the marked rows, drew an SVG, drew two equal rules as two lines or
    worked the page fields out, of any file.

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
which hands on what report-spec decides, on `fflate` at exactly 0.8.3,
MIT, which zips the file, and on `pako` at exactly 3.0.2, MIT and Zlib,
which inflates a PNG's image data to check it, and which
report-documents inflates with already
([0054](0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md));
neither has a dependency of its own. Its own source has no Node, no DOM
and no network, and compiles with ES2023's library and no types
besides: neither library's declarations need Node's or the DOM's. fflate
itself serves Node one file, which imports `module` and requires
`worker_threads` as it loads, in a `try`, and every other host another;
the writer calls its synchronous half alone, which is the same code in
both. pako serves every host one file. `renderDocx` is synchronous,
takes no option and no
signal: there is no page limit to pass, since the writer counts no page.
The two engines share the document and the refusal, and no interface.
That one entry serves a browser is held by the Studio's gate, through
the workspace: the file a person downloads there, written in Chromium
over the file fflate serves a browser, is byte for byte the one the
writer writes of the same document under Node. The install gate's host
of the packed package is Node's.

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
January 1980, by the local fields of a date made as the file is written,
so that neither the clock nor a machine's time zone, set before the
writer loaded or after, reaches the bytes, and deflated by fflate's own
code;
a PNG and a JPEG, which are compressed already, are stored as they are.

**What it writes**, block by block:

| The document | The Word file |
|---|---|
| `paragraph` | A `w:p`; each run a `w:r` that states its own family, size, weight, slant and colour, black where its style names none, and the paragraph its alignment and its mark's family and size. A run that prints nothing is no run. A line feed, a carriage return, or the two together are a `w:br`: the PDF's engine ends a line at each. But the one that ends the paragraph's last run is none: the PDF's engine ends its last line there and opens no line after it, so `one\n` is one line, and of two that end a text the first is a break. A run of nothing after a line ending is a run to that engine, which opens a line for it, so the ending before it is a break. |
| `keepWithNext` | `w:keepNext` on the paragraph and on every paragraph between it and the next block that prints text or a picture, past spacers, rules, rectangles and other such paragraphs, as the PDF keeps it: Word keeps a paragraph with the paragraph after it and no further. A table prints where a cell of its header or its rows does, and its empty text only in place of detail rows. Over a page break or nothing, it is kept with nothing. |
| a run's `baseline` | `w:vertAlign`, subscript or superscript ([0061](0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)): the run is one set off the line in Word too, at Word's size and rise, not `SHIFTED_SIZE` and `SHIFTED_RISE`, which are the PDF's. |
| `pageNumber`, `pageCount` | Word's `PAGE` and `NUMPAGES` fields, each its beginning, its instruction and its end, written without a stored result: the writer knows no page, and writes no number it does not know. In the page header and footer alone. |
| `table` | A `w:tbl` of fixed layout, its grid the columns' widths, a fill column its share, with the PDF's rules and padding. The header row is `w:tblHeader`; every row is `w:cantSplit`; a row `across` is one cell of `w:gridSpan`; the empty text is a row across the table, in italic, where the PDF prints it. `w:keepNext` on every paragraph of the header row, of a group header's row and of as many rows after it as it keeps less one ([0059](0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md)), and of each row before a group's footer or a total that follows a detail row or the empty text: the rows the PDF keeps on a page, as marks. A cell is one paragraph of the document's string, never a number, a line ending in it a break and the one that ends it none, as in a paragraph; an empty cell an empty paragraph of its size. |
| `columns` | A table of one row with no border and no padding, a cell a column, which Word may continue on the next page. |
| `section` | With a border, a fill or padding, any one of them: a table of one cell with that border, shading and cell margin, around its blocks. Without: its blocks. |
| `image`, PNG or JPEG | An inline picture in a paragraph of its own, whose part is the asset's very bytes, written once however often it is drawn. `contain`: the picture at its own proportions, centred in its box by its paragraph's indent and the space before and after it. `cover`: the box, the picture cropped by `a:srcRect`. |
| `image`, SVG | The same picture with an `asvg:svgBlip` whose part is the asset's very bytes, once report-spec's `checkSvg` has passed them as the drawing `cleanSvg` wrote ([0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)). The picture a reader that does not know the extension shows in its place is one grey pixel, stretched to the box: a grey box, never an empty space. |
| `rule` | An empty paragraph whose line is exactly the PDF's gap above a rule, with a border under it of the rule's weight and colour, and the gap after. The same border is stated as `w:between`: ECMA-376 has Word draw, between two paragraphs of the same borders, the one between them alone (Part 1, 17.3.1.7), so two equal rules that stated only `w:bottom` would print one line. This rests on the standard's wording, not on anything seen in Word. |
| `rectangle` | A table of one cell and one row of exactly its height, shaded and bordered as it is filled and outlined, all outline where it is too small to hold one, as the PDF draws it. |
| `spacer` | An empty paragraph whose line is exactly its height; one of less than a fortieth of a point writes nothing. |
| `pageBreak` | An empty paragraph, a point tall, with `w:pageBreakBefore`. |
| `keepTogether` | Every paragraph of it `w:keepLines`, and `w:keepNext` but what ends it, which is kept with nothing after the block: its last paragraph, or, where a table or a columns block ends it, every paragraph of that table's last row -- a row is kept with the next by every paragraph of it, so a row marked in some of its cells would be half kept. Every row of a table in it is `w:cantSplit`, the last among them, which is what holds that row whole. |
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
It must state an instant: an ISO 8601 date and time with its zone, `Z`
or an offset, which is what the runtime writes, or a date alone, which
is its first moment in UTC. A date and time without a zone is read in
the machine's own, so the same document was another file in another
time zone; it is refused as `unsupported`, and so is a date in any other
form, which the platform reads in a way of its own. And it must state a
day and a time a calendar has: the platform reads on past one -- 30
February as 2 March, an hour 24 as the first of the next day -- and the
instant written would be a date the document does not state, so a date
whose stated fields are not those of the instant it is read as is
refused too, and one whose year, in UTC, is not 0001 to 9999, the years
a core property's date has. The PDF renderer reads the date as the
platform does, and draws each of these.
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
as `invalid-asset`, and so is one of more than 31 characters,
`MAX_DOCX_FAMILY_LENGTH`: Microsoft's notes on how Office implements
the standard say that Word restricts a run's font attributes to less
than 32 characters and a font table's name to between 1 and 31
([MS-OI29500], Part 1 Sections 17.3.2.26 and 17.8.3.10, read on 18
November 2026), which is the face name of Windows, so a longer name is
a family no reader would find, and report-spec's reader holds a family
to no length at all. A name within the bound may still be written
longer: a quotation mark is six characters in an attribute, and every
run and every paragraph mark states the family four times, so what a
family is written past 31 characters is counted, each time, with the
file's characters. Weight and slant are `w:b` and `w:i`. A mapped
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
is refused; and so is a length that rounds to none of its unit where
the file would state it as nothing: a rectangle's side, a column's
width and the width a framed section stands at under a fortieth of a
point, which would be a table of no width or a row of exactly no
height, and a picture drawn at under an English Metric Unit. The PDF
draws each, thin as it is; what Word draws of a table or a picture of
no extent nobody has seen. A spacer that small is no space, and writes
nothing. No value is rounded: a cell is the string the runtime
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
`RenderRefusal`, with the PDF renderer's codes, in this order: a face
that is no font, or whose family a Word file cannot name, as the fonts
are read, before anything is walked; the creation date and the title;
the payment part, the e-invoice and a preview's label; the page; then
the page header, page 1's own, the page footer and the body, each block
in document order; and last the pictures' bytes, in the order the walk
met them. By where a thing stands, then, and not by its kind: a chart or
a code is refused where the walk meets it, after a block no engine
prints that stands before it. It is the PDF renderer's order for what
both refuse, which reads its fonts before it walks and its pictures once
it has walked every block, so a document wrong in several of those
places is refused by both for the same one; a document wrong in a way
only one engine refuses, and in another, is refused by each for what it
meets first.

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
  are declared as are `invalid-asset`: a PNG's image data is inflated
  and held to the scanlines its header promises and to being one whole
  zlib stream, as the PDF renderer holds it. The renderer inflates with
  the platform's `DecompressionStream`, which is zlib under Node and a
  browser's own in a browser, and asynchronous; the writer is
  synchronous, and inflates with pako, a port of zlib's own inflate, its
  window stated so that it reads a zlib stream and no gzip member. So
  what zlib refuses of a
  block, a stream that is cut short and one whose checksum is not its
  data's are pako's error, and a byte after the stream's end is one it
  says it left unread; reading stops with the stream, and with the chunk
  that passes what the header promises. The corpus's `MALFORMED` list is
  one document for each way a document breaks the contract, a PNG for
  each way that was looked for in which its data is no such stream among
  them -- a checksum, bytes after the end, an end that never comes, a
  stored block whose length states no complement, a length code deflate
  does not define, a gzip member -- and both engines refuse every
  document of the list alike, under Node. That pako and the platform's
  decompressor agree on every other stream, and in a browser, is pako's
  claim, as a port of zlib, and no test's here.
- **What Word's units do not state**, each `unsupported`, naming the
  block or the asset: a rule's or a border's weight outside what Word's
  borders hold, and a rectangle, a column, a framed section or a picture
  that rounds to none of its unit, as *Lengths* says.
- **The writer's own bounds.** As `content-too-large`: a picture, a
  rectangle or a spacer taller than the printable area, which no page of
  a Word file holds -- the PDF judges the first two against the body
  between its regions, and refuses no spacer; more than
  `MAX_DOCX_PARAGRAPHS` paragraphs, 70,000, a table's cell being one and
  a rectangle or a section's frame, each a table of its own around its
  paragraph, two; text of more than `MAX_DOCX_CHARACTERS` characters,
  4,000,000, with what a font's family is written past 31 characters in
  every run and paragraph mark that states it; text held in more than
  `MAX_DOCX_RUNS` runs, 140,000, twice the paragraphs, a page field
  being three, as Word
  writes it, a table's cell one, and each line ending in a text one
  more, since it is written as a break and what follows it as a `w:t` of
  its own; more than `MAX_DOCX_PICTURES` pictures, 1,024, each asset
  counted once; pictures of more than `MAX_DOCX_MEDIA_BYTES` together as
  they are stored, each counted once, from its length and before a byte
  of it is read, twice `MAX_ASSET_BYTES`, which bounds the file; and
  pictures of more than `MAX_DOCX_IMAGE_DATA` of
  image data together, each counted once: a PNG's scanlines as its
  header promises them, a JPEG's bytes, an SVG none, which is how the
  PDF renderer counts its `MAX_IMAGE_DATA`, and its number, two of the
  largest PNG an asset may be. The writer inflates every PNG it embeds,
  and a PNG's bytes say little of what it inflates to, so the count is
  taken from its header before it is inflated, and a PNG that takes a
  file past the bound never is. One within it is inflated to what its
  header promises and, where its data holds more, no further than the
  chunk that passes that, 64 KiB at the most: the chunk the writer asks
  pako for, pako 3.0.2's own default, which pako fills before it hands
  it on. So what is inflated of a file's pictures is the bound and a
  chunk at the most, not the bound alone. The renderer inflates a PNG
  before it counts it, and holds a render's pictures to no bound on
  their bytes: so of a picture past either bound that is no picture
  either -- a PNG whose data is no stream, bytes that are not what they
  are declared as -- the renderer refuses the picture and the writer
  the size. The number is stated in both engines, since no
  package below both holds what an engine's pictures may cost it and the
  writer does not depend on the renderer, and `against-pdf.test.ts`
  holds the two together. The paragraphs, the characters and the runs
  are counted in the walk that checks the document, and the pictures as
  each asset is first read, before anything is built. Measured on 17
  November 2026, on an
  Intel Core i9-10900K shared with other work, under Node 24.21.0 with
  fflate 0.8.3, a process a measurement: a table of 100,000 cells
  holding 4,000,000 ampersands between them, each written five
  characters long, was written in 1.9 seconds with 657 MB resident at
  the most; the same cells holding a character each in 1.4 seconds and
  555 MB; at 250,000 cells and 8,000,000 characters, 4.6 seconds and
  1,319 MB, which is why the bounds are not there. The paragraphs'
  bound was 100,000 then, and the runs', once there was one, 200,000:
  what follows was measured at those, on text of ampersands alone,
  until the last paragraphs of this say otherwise. The pictures' count
  is chosen, not measured. Each picture is an entry of the zip, whose
  directory counts its entries in sixteen bits, and fflate writes a
  count past them modulo 65,536 and says nothing: 65,600 pictures,
  inside every other bound, were a file whose directory stated 72
  entries, which no reader opens. The bound stands far under that, and
  over the 128 a document the runtime resolved can hold: 64 assets a
  report declares, and 64 its header's fields name. As `unsupported`: a
  creation date of a year a core property cannot state, the year 0000
  among them, and one of a day or a time no calendar has.

  A count bounds the work only where the work is the count's. Three
  shapes inside the bounds cost its square, and each is now written in
  one pass: paragraphs each kept with the next, a table that closes
  with total after total, and a part's relationships, looked up once
  for every picture drawn. Measured on 18 November 2026, the same way
  on the same machine, busier that day, the table of cells above taking
  2.1 to 2.5 seconds and 720 MB at the most: 100,000 paragraphs each
  kept with the next, 1.1 seconds and 497 MB, where they had taken 163
  seconds; a table of a detail row and 99,998 totals, 1.4 seconds and
  605 MB, where 40,000 had taken 3.8 seconds; 100,000 pictures of one
  asset, 1.9 seconds and 671 MB; 1,024 pictures of an asset each, 0.2
  to 0.3 seconds; the largest PNG an asset may be, 134 MB of scanlines,
  inflated and summed by fflate, which read it then, in 0.8 seconds; and
  a PNG with 20 MB after the end of its image data refused in 0.1, where
  16 MB had taken 4.2.
  And one the paragraphs and the characters did not bound at all, the
  runs, each stating its own properties: one paragraph of 3,999,000 runs
  of a letter each, inside both, held the thread 9.5 seconds and 2.6 GB
  before V8 refused the string the file is built in, a RangeError and no
  refusal, and a page header of a million page fields, which count no
  character, 3 seconds and 1.1 GB. Bounded by `MAX_DOCX_RUNS`, one
  paragraph of 200,000 runs took 1.2 seconds and 484 MB, 66,666 page
  fields 0.8 seconds and 344 MB, and 100,000 paragraphs of two runs
  holding 4,000,000 ampersands, all three bounds at once, 2.4 seconds
  and 559 MB. Those three figures of memory are of another kind than
  every other here: the process's resident memory once the file was
  written, read after the write and by a million bytes, not at its
  most, which is why the last stands 175 MB under the 734 MB the same
  file is given below.

  And a count bounds the work only where each thing counted costs what
  the count takes it for. A second review, that day, found three that
  did not, each inside every bound, and measuring them found a fourth.
  A font's family, stated four times by every run and every paragraph
  mark, and as long as its font made it: a font of 66 KB may name its
  family in 32,767 quotation marks, as many as a name record holds,
  which report-spec's reader passes, and each is six characters in an
  attribute. A paragraph of one run states its family in eight slots,
  its run's four and its mark's, so 350 paragraphs of a letter each are
  550,485,600 characters of that name alone, where a string of V8's
  holds 536,870,888: a RangeError, "Invalid string length", after 0.2 to
  0.3 seconds and 712 to 714 MB, and no refusal -- measured on 18
  November 2026, three processes, on a copy of the built writer with
  the family's bound and its count taken out. A line ending, counted as
  the character it is and written
  as a break and a `w:t` of its own: one paragraph of one run of
  4,000,000 characters, every other a line feed, 4.6 seconds and 1,440
  MB, and 100,000 cells of forty such characters, 4.6 seconds and 979
  MB. A PNG, inflated in full however many a file held: the largest an
  asset may be is a file of 130,527 bytes where its pixels are all
  alike, 321 of them were inside the bounds on the pictures' bytes and
  their count, and eight took 3.7 seconds -- measured on 18 November
  2026, four processes, on a copy of the built writer with the image
  data's bound taken out, pako inflating as it does now. And a rectangle
  or a
  section's frame, a table of its own for the one paragraph it was
  counted as, 993 and 942 characters of XML where a table's cell is 466:
  100,000 filled and outlined rectangles, 3.3 to 3.6 seconds and 1,250
  MB, more than any text had been measured to take. Measured once each
  is counted
  for what it is, the same way on the same machine, with pako 3.0.2
  beside fflate, every text of ampersands, the paragraphs' bound still
  100,000, the memory with the document the writer was handed in it,
  four to twelve processes a shape: the
  table of cells above, 2.0 to 2.5 seconds, and 724 MB in seven
  processes of ten and 993 MB in three; in a mapped family of 31
  letters, 2.5 to 2.9 seconds, and 838 MB in three of four and 1,095 MB
  in one; 100,000 paragraphs of two runs holding 4,000,000 ampersands,
  the three bounds at once, 2.3 to 2.5 seconds and 734 MB, in that
  family 2.8 to 3.1 seconds and 877 MB, and with every paragraph kept
  with the next in one kept block and centred, and every run set off the
  line besides, 3.2 to 3.3 seconds and 946 MB, the longest that was
  found; one paragraph of one run of 4,000,000 characters with 199,999
  line endings, 1.1 seconds and 489 MB; the table of cells with a line
  ending in each, 2.3 to 2.5 seconds, and 743 MB in four processes of
  five and 1,010 MB in one, and in that family 2.6 to 2.9 seconds, and
  857 MB in two of four and 1,112 MB in two, the most memory that was
  found; 50,000 filled and outlined rectangles, 1.4 to 1.5 seconds and
  570 MB, 50,000 framed sections, 1.4 and 567, 50,000 tables of a header
  alone, 2.2 to 2.3 and 734, and 100,000 columns blocks of one column,
  1.8 to 1.9 and 699; the largest PNG inflated in 0.5 to 0.6 seconds,
  and the two a file may hold in 1.0; and a PNG with 20 MB after the end
  of its image data refused in 0.1. A table of cells took the less or
  the more from one process to the next, some 265 MB apart for the same
  document: the 720 MB of the measurements before these were the less,
  and what follows says why.

  And a figure holds for what was measured. A third review, that day,
  found that every figure of memory above was of text V8 holds a byte a
  character -- the text was ampersands throughout -- and that the two
  amounts a table of cells took had no reason given. Measured again on
  18 November 2026, the same way on the same machine, under Node
  24.21.0, whose V8 is 13.6, each shape as it was and with one euro sign
  in its text, six to eight processes each, the paragraphs' bound still
  100,000:

  - **The text.** One character past U+00FF in a part's text, and V8
    holds the string the part is built in, and each copy made of it on
    the way, two bytes a character. The table of 100,000 cells took 732
    to 734 MB as it was and 983 to 985 MB with a euro sign in its
    header's cell, the less of its two amounts each time; 100,000
    paragraphs of two runs, 735 to 737 MB and 952
    to 953; and those paragraphs in the longest family, kept, centred
    and set off the line, 942 to 943 MB and 1,276 to 1,277, in 3.1 to
    3.3 and 3.5 seconds.
  - **The two amounts.** They are V8's, not the text's. They stand some
    285 MB apart with the euro sign and without it: that table took
    1,016 to 1,019 MB in four processes of six, and 1,270 to 1,272 MB
    with the euro sign in four of six. With V8's allocation-site
    pretenuring turned off (`--no-allocation-site-pretenuring`), eight
    processes of eight took the less, 734 to 735 MB. V8 decides while a
    program runs,
    from what survived its young collections, which sites allocate in
    its old generation from the start, and what dies there waits for a
    full collection. Its own traces (`--trace-pretenuring-statistics`,
    `--trace-gc`) show a process that takes the more deciding so of six
    sites more, and its heap growing by some 19 MB at each young
    collection of the write where the other's grows by 5: 654 MB before
    the full collection that follows, against 436.
  - **What decides it.** What the process did before the write. A table
    made alone, as the measurement makes one, took the more in 33
    processes of 107 at 88,000 cells and more, and in none of 241 under
    that. Under it, it took the more once a string of some characters
    was held beside each of its rows, which the writer never reads, as
    a host holds its data's rows beside the document it resolved. And
    how much more hangs on the file: some 285 MB for the table of
    cells, and 468 MB for the one with a line ending in each cell, in
    the one process that took the more of it made alone.
  - **So the most was not the 1,112 MB above.** With a euro sign, in a
    mapped family of 31 letters, the table of 100,000 cells took 1,454
    to 1,478 MB in six processes of eight, and 1,509 to 1,514 MB in four
    of six with a string of 160 characters held beside each row; the one
    with a line ending in each cell took 1,511 MB in one of eight. All
    are past the 1,319 MB the bounds are set to stay under.

  The paragraphs drive it, and the characters do not: at half the
  characters, 2,000,000, those two tables still took 1,366 MB and 1,384
  to 1,406 MB. So `MAX_DOCX_PARAGRAPHS` is 70,000, where it was 100,000,
  and the runs' bound, twice it, 140,000. Not 80,000 and not 75,000:
  with a string of 160 characters beside each row, the table in that
  family took 1,310 to 1,314 MB at 80,000 cells in five processes of
  eight, 5 MB under what the bounds stay under, and the one with line
  endings 1,290 to 1,321 MB at 75,000 in seven of sixteen, with one of
  24 or of 160, past it.

  At the bounds as they are, measured on 18 November 2026, every text of
  ampersands, as it is and with one euro sign in it, in place of its
  first ampersand or, where a file has no text, of its last block; the
  seconds and the resident memory at its most, from the least to the
  most of that many processes each way:

  | The file | As it is | With a euro sign in its text | Processes |
  |---|---|---|---|
  | A table of 70,000 cells holding 4,000,000 ampersands | 1.8 to 2.2 s, 626 to 629 MB | 1.9 to 2.3 s, 827 to 829 MB | 8 |
  | That table in four columns | 1.6 s, 594 to 595 MB | 1.7 to 1.8 s, 786 to 788 MB | 4 |
  | Its cells holding a character each | 1.0 to 1.1 s, 503 to 507 MB | 1.1 s, 628 to 632 MB | 4 |
  | That table in a mapped family of 31 letters, the longest Word reads | 2.1 to 2.3 s, 708 to 710 MB | 2.3 to 2.4 s, 959 to 962 MB | 8 |
  | 70,000 paragraphs of two runs holding 4,000,000 ampersands: the paragraphs, the characters and the runs at once | 1.9 to 2.3 s, 620 MB | 2.0 to 2.6 s, 789 to 791 MB | 5 |
  | Those paragraphs in that family | 2.4 to 2.7 s, 722 to 724 MB | 2.4 to 2.9 s, 950 to 953 MB | 5 |
  | And each kept with the next in one kept block, centred, its runs set off the line | 2.5 to 3.1 s, 765 to 767 MB | 2.6 to 3.0 s, 1,018 to 1,019 MB | 5 |
  | One paragraph of one run of 4,000,000 characters with 139,999 line endings | 1.0 s, 423 to 448 MB | 1.1 s, 571 MB | 4 |
  | The table of cells with a line ending in each | 1.9 to 2.2 s, 641 to 642 MB | 2.1 to 2.2 s, 849 to 851 MB | 8 |
  | That table in that family | 2.2 to 2.5 s, 721 to 723 MB | 2.3 to 3.3 s, 981 to 985 MB | 8 and 32 |
  | 35,000 filled and outlined rectangles | 1.0 s, 473 MB | 1.1 s, 572 to 573 MB | 4 |
  | 35,000 framed sections | 0.9 to 1.0 s, 470 MB | 1.0 to 1.1 s, 565 MB | 4 |
  | 35,000 tables of a header alone | 1.6 to 1.7 s, 591 to 592 MB | 1.7 s, 743 to 745 MB | 4 |
  | 70,000 columns blocks of one column | 1.3 to 1.5 s, 566 to 568 MB | 1.4 s, 689 to 690 MB | 4 |
  | 70,000 paragraphs of a letter, each kept with the next | 0.8 s, 436 to 437 MB | 0.8 s, 509 to 510 MB | 4 |
  | A table of a detail row and 69,998 totals | 1.1 s, 512 to 513 MB | 1.1 to 1.2 s, 642 to 643 MB | 4 |
  | One paragraph of 140,000 runs of a letter | 0.8 to 0.9 s, 443 to 445 MB | 0.9 s, 522 to 523 MB | 4 |
  | A page header of 46,666 page fields | 0.6 s, 346 to 351 MB | 0.7 s, 433 to 437 MB | 4 |
  | 70,000 pictures of one asset | 1.4 to 1.5 s, 551 to 553 MB | 1.5 to 1.6 s, 701 to 704 MB | 4 |
  | 1,024 pictures of an asset each | 0.1 s, 190 to 192 MB | 0.1 s, 193 to 194 MB | 4 |

  The 32 are eight and 24 more, taken to look for the more in the
  heaviest file. None of these processes took the more of V8's two
  amounts, so the five heaviest were measured again with a euro sign and
  with a string held beside each row or paragraph, eight processes each.
  Of 24 characters: none took the more. Of 160: the table of cells with
  a line ending in each took 1,113 to 1,115 MB in every process, and
  that table in the longest family 1,267 to 1,268 MB in every process,
  in 2.5 to 2.6 seconds; the table of cells without line endings took
  845 to 848 MB, in that family 978 to 979, and the kept and centred
  paragraphs 1,043 to 1,044, none of them the more. Of 320, six
  processes: the table with line endings in that family took 1,271 to
  1,272 MB in five. That is the most that was found: 47 MB under what
  the bounds stay under, some 26 MB of it the strings held. With
  pretenuring turned off, the same file with 160 characters beside each
  row took 898 to 899 MB in seven processes of eight and 998 in one. The
  longest a file took is 3.3 seconds. And the pictures' bytes, which are
  read before any of it, four processes each: the largest PNG inflated
  in 0.5 to 0.6 seconds, the two a file may hold in 0.9 to 1.0, and a
  PNG with 20 MB after the end of its image data refused in 0.1.

  These are the shapes that were looked for, and no more is claimed.

A refusal the PDF renderer makes of what it measured -- a block taller
than a page's body, a line it cannot place, a run set off the line alone
on a line, more pages than the host allows -- is not the writer's: it
measures nothing.

**The starters.** `starters.test.ts` is the list, and fails on a starter
it does not name. As they stand on 18 November 2026, the sales report
([0067](0067-a-monthly-sales-report-is-a-starter-whose-bar-chart-and-pie-print-the-totals-its-table-prints.md))
arrived since this record was numbered:

| Starter | Its Word file |
|---|---|
| Service inspection, Quotation, Grouped equipment, Site visit, Order confirmation, Product data sheet | written |
| Invoice, Payment reminder | refused: the payment part |
| Euro invoice | refused: its EPC QR code |
| E-invoice (Factur-X), E-invoice (XRechnung) | a final render refused for its e-invoice, a preview for its label |
| Sales report | refused: its chart, the first of its two |

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
the PDF from, once the PDF is drawn and of no document the renderer
refused, so the page limit that bounds a preview bounds what the writer
is handed on the page's own thread; the writer, with fflate and pako, is
a chunk of the build's own, asked for with the first PDF that printed,
which `chunks.test.ts` holds on a build of the pipeline: an import that
became static would load the writer with the page. It offers the file
after
Download PDF as **Download Word**, the starter's id with `.docx`, the
file of the render on the paper. Where the writer refused, there is no
link, and a note in its place says so in the writer's own sentence: "No
Word file: " and the refusal. Whatever else the writer throws is a fault
of the Word file's alone: the PDF is shown as it printed, and the note
says the writer failed, and how. The link is the room's `tool`, with no
rule of its own, and the note's one rule states no colour; the README's
pictures of the Studio are taken again by their script, their Preview
holding one link more.

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
  time zone, and in the Chromium the Studio's gate downloads it from,
  which a host can store by its digest.
- **A small writer.** Two dependencies with none of their own, no fonts
  and no rasteriser in the package; in the Studio's build it is a chunk
  of 48.5 kB, 18.5 kB gzipped, measured on 17 November 2026 as
  `apps/studio/vite.config.ts` says, of 50.3 kB and 19.1 kB the day
  after, with what a review added, and of 79.4 kB and 28.1 kB once pako
  inflated a PNG's data in it, loaded with the first PDF that printed.
- **Refusals a person can read**, each naming what it is about, and never
  a file that lost something.

**What it costs.**
- **Every starter that is paid by a code, is an invoice in law or
  draws a chart is refused**, in a final render and in a preview. A host
  whose reports carry a QR code of any kind, or a chart, cannot export
  them.
- **Word has opened the files once, by hand, and no test does.** The
  starters' and the fixtures' files were opened in Word before this
  change merged and found fine, and nothing more was written down
  (*Verified by*): that Word repeats the header row, keeps the rows,
  draws the SVG, draws two equal rules as two lines, puts the first
  page's header and both footers where the file says, works both fields
  out, and how any of it looks, is held by no test. The files were
  validated against the schema once, by hand; the schema is not in the
  repository, and nothing in CI repeats either. The Studio's demo is
  served from `main`
  ([0018](0018-the-studio-demo-is-served-at-formancy-ai-report.md)), so
  the files reached the public when this change merged, not at a
  release, and a later change to what the writer writes reaches it the
  same way, with no gate asking that a person open its files first.
  `RELEASING.md` asks it of every release, in the step that verifies one
  by hand.
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
  refuses them and the writer cannot see them. Nor has the writer the
  renderer's budgets for SVG images -- what drawing them costs it, one
  in a page region counted on every page (`MAX_SVG_DRAWING`), and what
  they cost a reader to paint on one page, in weighted segments and in
  transparency groups (report-spec's `MAX_SVG_SEGMENTS` and
  `MAX_SVG_GROUPS`): the writer draws no SVG and embeds each drawing's
  bytes once, so a report whose drawings the renderer refuses for what
  they cost together is written. A report of more than 70,000
  paragraphs, 140,000 runs or 1,024 pictures, of more than 35,000
  rectangles or framed sections, or with more than 140,000 line endings
  in its text, a labelled preview, a spacer taller than the printable
  area, a rectangle, a column, a framed section or a picture that rounds
  to none of Word's units, a creation date that states no zone or a day
  no calendar has, a font whose family is more than 31 characters: the
  writer refuses them and the PDF prints them. The Studio offers the
  file only beside a PDF that was drawn; a host that calls `renderDocx`
  alone gets no such check.
- **Two compression libraries in one package.** fflate zips the file
  and pako inflates a PNG's data, for one check: 29.1 kB more in the
  Studio's chunk of the writer, 9.0 kB gzipped. fflate's own inflater
  would have been one library, and it inflates what zlib refuses, so a
  PNG the PDF renderer refuses was embedded.
- **That the two engines refuse the same PNGs rests on pako being
  zlib's inflate.** The renderer inflates with the platform's
  decompressor and the writer with pako; the corpus's list holds them
  together, under Node, on six ways a PNG's data is no stream, the ways
  that were looked for, and no test compares the two on any other, or in
  a browser, whose decompressor is its own. Every run of the suite runs
  that list, so a bump of pako is read against it.
- **Two pictures are refused otherwise by the two.** A PNG whose image
  data takes a file past what its pictures may hold, and is no stream
  either: the writer refuses its size, before it inflates it, and the
  renderer its data, which it inflates first. And a picture that takes
  a file past the bytes its pictures may store, which the renderer does
  not bound, and is no picture: the writer refuses its size, before it
  reads a byte of it, and the renderer the picture.
  `against-pdf.test.ts` holds both to that.
- **The order two engines refuse in is held for what both refuse.** One
  document wrong in every place both look is refused by both for the
  same place as each is put right, and that is what is held. A table
  wrong in two ways, a document wrong in a way only the renderer
  measures, and one wrong in a way only the writer refuses, are refused
  by each engine for what it meets first.
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
- **The writer holds the thread, and memory, and how much memory is
  V8's to say.** `renderDocx` is synchronous and takes no signal: a file
  at its bounds is written in one step of up to 3.3 seconds that nothing
  interrupts. Of memory it took up to 767 MB where its text is of
  characters up to U+00FF, and up to 1,019 MB where one character of it
  is past that, a euro sign, since V8 then holds the text two bytes a
  character while the file is built. And V8 takes one of two amounts for
  one and the same document, by what the process did before the write:
  the most that was found is 1,272 MB, a table of 70,000 cells with a
  line ending in each, in the longest family Word reads, a euro sign in
  it, in a process that held a string beside each of its rows as a host
  holds its data's rows. That is 47 MB under the 1,319 MB the bounds are
  set to stay under, where the first measurements said 657, and nothing
  but the measurements of *The writer's own bounds* says that no process
  takes more. A host that must stop a write runs it in a worker, and one
  that must bound its memory runs it in a process of its own. Before
  that step it reads the pictures' bytes, and the two largest PNGs a
  file may hold take 1.0 second of it.
- **A report of more than 70,000 paragraphs is not exported, where the
  bound was 100,000.** A table's cell is a paragraph: 70,000 rows of one
  column, 10,000 of seven, or 35,000 boxes, and the runs' bound, twice
  the paragraphs', is 140,000 where it was 200,000. The runtime reads up
  to 100,000 detail rows, so a report it resolves whole may be refused
  as a Word file for its size alone, and prints as a PDF. The bound was
  moved on 18 November 2026, before any release held it, because the
  first was set on figures of text V8 holds a byte a character, in the
  less of its two amounts: with a euro sign in the text, a table of
  100,000 cells took up to 1,514 MB, past the 1,319 MB the bounds are
  set to stay under. It is the paragraphs' bound that moved, since they
  drive what a file costs and the characters do not; and to 70,000,
  since at 80,000 the most that was found was 1,315 MB, 4 MB under that,
  at 75,000 1,321, past it, and at 70,000 1,272. Two processes of one
  amount were seen 24 MB apart, so 4 MB is no room.
- **A font with a long family is not exported.** A report mapped to a
  font whose name ID 1 is more than 31 characters is refused as a Word
  file and prints as a PDF: by Microsoft's own account of what Word
  reads, it would not find the family. A family within the bound that
  escaping writes longer -- one of quotation marks or ampersands enough
  -- takes characters from the file's text, four for each character past
  31, in every run and paragraph mark.
- **A box counts two, and a line ending one.** A rectangle and a framed
  section are each two of the file's 70,000 paragraphs, and each line
  ending in a text one of its 140,000 runs: a report of more than 35,000
  boxes, or of a text of more lines than that bound, is refused.
- **A creation date the PDF draws may be refused**: one of a day or an
  hour no calendar has, which the platform reads as the date after it,
  and one of the year 0000.
- **In the Studio, a preview's PDF waits for its Word file.** The
  pipeline hands a printed render on once the writer's chunk has loaded
  and the file is written (`pipeline.ts`), so the paper shows each PDF
  that much later, the first by the chunk's load as well. And the signal
  that stops a render the person has typed past is read by the renderer
  and by nothing after it: a superseded render whose PDF was already
  drawn still writes its file, on the page's thread, before the next
  begins. Both are bounded by what the preview's page limit lets a
  document hold, and neither is changed here.
- **The README's pictures are taken again**, and every walk of the
  Studio writes a file more at each render.
- **The start page says one thing less.** "No print format but PDF" was
  true of 0.2.0 and is not of `main`; what is true of both is that
  nothing writes a workbook, text or a web page, and the page says that,
  in its four languages, and nothing of the Word writer, which no release
  holds yet.
- **The getting-started guide writes no Word file.** Its quotation draws
  a chart, which the writer refuses, and a second quotation for the
  guide is not written here. The package's README carries the example,
  held to the lines the install gate's consumer runs.
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

**A PNG's data inflated by fflate, which the package zips with.** It was
how the writer first read one, for the sake of one compression library
in a package a browser bundles: fflate's streaming decompressor, the
Adler-32 of what it inflated summed by the writer, and the stream's end
read from two fields of the state fflate 0.8.3 keeps, which nothing it
declares names. The checksum alone, which is all fflate's declared API
allows and passes bytes after a stream that end in that very checksum,
and a second inflate of the data less its last byte, which reads every
PNG twice, were weighed against that reading then. None of the three
makes fflate read a block as zlib does: a second review found that it
inflates a stored block whose length is not followed by its complement
and a length code deflate does not define, with a checksum that sums,
so the writer embedded PNGs the PDF renderer refuses while this record
said the two refused alike.

**The platform's `DecompressionStream` for a PNG's data**, which the
renderer inflates with, so that the two could not differ. It is
asynchronous, and `renderDocx` is not; and a package with neither Node's
types nor the DOM's has no name for it.

**The image data's bound in a package below both engines**,
report-spec's limits or the runtime's, read by each. One number in one
place, and where the bound goes once a third engine reads it. It is not
done here: the number is what two of the largest pictures cost PDFKit
to decode, measured in the renderer, and moving it is a change to
report-spec, the runtime and the renderer with nothing of a Word file in
it. The renderer exports no number for a test to read, so the two are
held together by what each engine refuses, which holds how each counts
as well as what it counts to.

**A font's family counted in full**, every character of it in every run
and mark, against the file's characters. Roboto alone, 24 characters in
a run's four slots, would then be 3,360,000 in a table of 70,000 cells
with nothing in them, more than four fifths of the bound with no text
at all, and a family of fifteen characters past it at 33,334 cells. The
longest family Word reads is what the bounds are measured with, and only
what escaping adds past it is counted.

**A family refused where it is written longer than 31 characters**, with
no count. A family of 30 characters with an ampersand in it, which
Windows holds, would be refused for the ampersand.

**A line ending counted only where it is written**, less the one that
ends a paragraph's or a cell's text. Which one that is, is decided where
the file's nodes are built, and the walk that counts would decide it a
second time; counted as read, a text is counted for at most one run more
than it writes.

**A rectangle counted as one paragraph, and the bound on paragraphs
halved for everything.** A report of 60,000 rows of one column would be
refused for the sake of one of 60,000 boxes.

**A bound on the pictures derived from the zip's own**, 65,535 less the
writer's parts. It would be a number that moves whenever the writer
gains a part, and a file of that many entries to prove at its bound.

**A box that rounds to nothing written as nothing**, as a spacer is. A
rectangle a hundredth of a point wide and a hundred tall is a hundred
points of the page: left out, everything under it would stand
elsewhere than in the PDF.

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
characters, so 70,000 of them would be more than a billion before the
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
