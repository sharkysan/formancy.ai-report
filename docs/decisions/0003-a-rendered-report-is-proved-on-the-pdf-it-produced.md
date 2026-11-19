# 0003 — A rendered report is proved on the PDF it produced

- **Status:** accepted; extended by [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), which reads QR codes from the page's pixels, by [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), which reads a run turned on the page, by [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), which reads an SVG image from its painted paths, its clip and its pixels, and by [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md), which reads the files a PDF embeds and what it says of itself with a second reader, pdf-lib, and its XMP with saxes, by [0058](0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md), which reads a chart by its clip, its paths and its words, and by [0060](0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md), whose checks read page 1 by its own header where the document gives it one, and every later page by the page header, and by [0061](0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md), which reads a run set below or above the line into the line it stands on, and holds its size and its baseline, and by [0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md), under which a claim about a report's Word file is checked on the file its writer produced, read back by readers that are not its writer and held to the expectation its PDF is held to, and by [0074](0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md), under which a code in a Word file is proved on the picture the file embeds, its pixels read back by the corpus's own PNG reader and decoded by ZXing, and by [0076](0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md), under which a chart in a Word file is proved on the part the file holds, read back by the corpus's reader by a closed vocabulary and held to its block
- **Date:** 2026-10-14
- **Deciders:** Daniel Bacher
- **Verified by:** `packages/report-corpus`, whose suite runs in its own job of
  `gates.yml`'s `test` matrix on every pull request and before every release.
  - **The reader.** `src/read-pdf.test.ts` proves it on PDFs pdfmake writes
    inside the test, read back with PDF.js. Pages are numbered from 1 with
    their size in points, text is measured down from the page's top edge,
    fonts are reported as embedded or only named, and images are found with
    the boxes they are drawn in.
  - **The checks.** `src/checks.test.ts` gives each check a real PDF, written
    by pdfmake inside the test, that shows the fault it looks for, and a
    correct PDF that passes them all. The faults: a row lost, repeated or out
    of order; a value on another row, a changed digit, a lost cell, one
    row's placeholder standing in for another's, columns out of order; a
    word lost from a wrapped row, on its own page or the next; a column
    header that does not repeat, over a continued row too; a page header
    missing or drawn into the body; a footer at the top of the page, or
    drawn into the last row between its cells; an empty page; a group or
    column header alone at a page's foot; text over text or under an image;
    text past each margin; a character drawn without a glyph; an image
    missing or drawn at another size; a kept block split, or moved out of
    order across a page boundary. With each check removed in turn, its test
    was watched failing.
  - **The expectations.** `src/fixture.test.ts` and
    `src/fixtures/fixtures.test.ts` hold what a fixture expects to the
    document it is derived from, and each boundary fixture to its
    arithmetic.
  - **The engines.** The renderer trial's tests run each candidate engine on
    the corpus and judge its output with those same checks.

  That no check reads an engine's input document, and that no engine is
  mocked, is **not mechanically enforced**. Nothing fails if somebody adds
  either, so review holds it, and `CLAUDE.md` says so in as many words.

## Context

What a report promises is about the pages. Every row appears once. The
column headers repeat on each page a table reaches. A total says what its
rows add up to, and a footer is not drawn over the last line. Nothing crosses
a margin, and no group heading is left alone at the foot of a page (plan
section 20). None of that is visible in the engine's input. pdfmake's
document definition says `headerRows: 1`, but whether the header was drawn
again on page 3 is a fact about page 3. The input says what was asked for.
Only the PDF says what was done, and the engine decides everything in
between: line breaks, page breaks, where a row that does not fit goes.

A mocked engine would be a transcription of what its author believed the
engine does, which is the belief under test.
[formancy.ai-data 0003](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0003-real-databases-in-every-test-run.md)
refused mocked database drivers for that reason, and its "a mock that passes
is a statement about the mock" applies to a PDF engine word for word.

PDF.js (`pdfjs-dist`, Apache-2.0) is the library the viewer will use (plan
section 6). In Node it extracts each page's text with a transform per run, so
a run's position on the page can be computed, as well as its string.

## Decision

A claim about a report's output is checked on the PDF bytes the chosen engine
produced. They are read back with PDF.js into pages, and each page into text
runs with their boxes, the images drawn and where, and the fonts used and
whether each is embedded. Rows and the values on them, repeated headers, the
page regions and their numbers, empty pages, overlap between text and text
or text and an image, margins and orphaned headings are judged on that. Never on the engine's input document, and never
through a mocked engine. The engine runs for real in the test, with its
output's creation date fixed so that a run is repeatable.

Pixel comparison is a later addition, for what text positions cannot see. It
arrives with the first fixture that needs it, and until then a layout claim
says that it rests on positions.

## Consequences

**What it buys.**
- **The customer's file.** A green check means the PDF a customer would
  receive had the property. Nothing is inferred from what the engine was
  asked to do.
- **A fair comparison.** An engine is chosen, upgraded or replaced against the
  same checks, on its own output, so a candidate cannot pass by being
  described well.
- **The viewer's reading.** The text a check reads is the text PDF.js gives
  any caller, the future viewer's search and selection included.

**What it costs.**
- **What is not text is not seen.** A rule or border drawn through a row, a
  shape over a line, a glyph cut by a clipping path, white text on white: none
  of these is visible to text extraction. Until pixel comparison arrives,
  "nothing overlaps" means no text run's box meets another's or an image's.
  `CLAUDE.md` asks for page images for overlap; this record narrows that until
  a fixture needs them, and says so.
- **Boxes are computed, not traced.** A run's box comes from its baseline and
  font size, with a descent allowance the reader states, not from the glyphs'
  outlines. A check can therefore be wrong by part of a line, and its
  tolerances are written beside it. An accent or an ogonek reaches past its
  box. The review measured the fonts fixture set at 0.85 of its line height:
  an ogonek met the acute of a capital in the line below by 2.21 × 1.09 pt,
  while their boxes shared 0.04 pt, under the 1 pt the overlap check allows.
  No fixture sets lines that tight, and none of this is seen until page
  images arrive.
- **Position, never order.** PDF.js returns text in the order the content
  stream draws it, and pdfmake draws a page's body before its header and
  footer. A check finds a header by where it is on the page, never by where it
  comes in the list.
- **PDF.js is part of the measurement.** A change in how it extracts text is a
  change in what every check sees. It is pinned at an exact version in the
  corpus, and it sets this repository's Node floor
  ([0004](0004-three-version-lines-each-refused-when-unknown.md)).
- **Slower than a suite over objects.** Every check renders and parses a real
  PDF. That cost has not been measured on its own.

**What it forecloses.** An engine-free suite for claims about output, and a
report proved by snapshotting what was handed to the engine.

**Added 2026-10-17: a QR code is read from the page's pixels.** To PDF.js
a QR code is neither text nor an image, so nothing above could say what a
drawn code says. [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md) reads it as a
scanner does: the corpus's `rasterPixels` gives the page as PDF.js draws
it, and `readCodes` decodes every code on it with ZXing (zxing-wasm), for
its text, its bytes, its level, its version and where it stands. That is
decoding, not the comparison of page images this record leaves for later:
nothing compares a page with an approved picture, and what is neither
text, an image nor a code is still not seen. `src/codes.test.ts` holds the
reader, and `src/raster.test.ts` holds `rasterPixels` to `rasterPage`'s
page, pixel for pixel.

**Added 2026-10-17: a run turned on the page.** An EPC QR code's caption
reads from bottom to top
([0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
Read as an upright run, its box would lie across the page from where it
starts, over whatever stands to its right. `readPdf` now gives every run
its angle, counter-clockwise from the page's x-axis to the hundredth of a
degree, and a turned run the box its letters' box turns into, still
computed from its baseline and its size: a quarter turn is its size wide
and its advance tall. A run across the page keeps the box it had. `lines`
makes a run that does not read across the page a line of its own, after
the lines that do, so that a caption is never joined to the text beside
it. `src/read-pdf.test.ts` and `src/lines.test.ts` hold both.

**Added 2026-10-18: what a PDF says of itself.** An e-invoice is a PDF/A-3b
that embeds its XML
([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)),
and what it embeds, how it relates the file to itself and what its XMP
says are neither text nor an image to the checks above. They are read the
same way, from the PDF the engine produced: `readPdf` gives the files the
name tree names, read by PDF.js; `readPdfObjects` (`src/objects.ts`) reads
the PDF's own objects with a second reader, `@pdfme/pdf-lib`, which shares
no code with the PDFKit that writes them or with PDF.js -- the version, the
information dictionary and `/ID`, every file on the catalog's `/AF` and in
the name tree with its specification's keys and its bytes inflated, the
output intents with their profiles, and the XMP -- so that an embedded
file's bytes come from two readers; and `readXmp` (`src/xmp.ts`) reads the
XMP strictly with saxes, every prefix resolved, each property found by its
namespace. A PDF the reader of objects cannot read as PDFKit writes one --
an encrypted one, a name tree with `/Kids` -- is refused, not read in part.
`src/objects.test.ts`, `src/xmp.test.ts` and `src/read-pdf.test.ts` hold
them, on PDFs PDFKit writes in the test with a file and without. Whether a
validator takes such a PDF is no reader's to say: veraPDF and Mustang are
the e-invoice gate's.

**Added 2026-10-18: an SVG image, read from its paths, its clip and its
pixels.** An SVG asset is drawn as vectors
([0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)),
so the PDF holds no image for it, and nothing above would see one.
`readPdf` now gives each page its painted paths, each with its box through
the current matrix and the forms it is drawn in, its paint, its fill and
stroke colours (`pattern` for a gradient) and the innermost rectangular
clip it was painted inside; and the rectangular clips themselves. What a
soft mask paints is skipped, since the converter paints a clip path's
mask in white, which would pass for a drawing's own white. A clip is a
rectangle by its four corners on the page, never by its path's bounds,
which a diamond shares with its square. `drawings.ts` finds each expected
drawing as a clip of its size with paint inside it, a page region's on
every page, and the margin and overlap checks read its box as an image's.
A path painted inside a clip may reach past it, as `cover` does, so what
shows past the box is the pixels' to say: `verifyInk` draws the page at
four pixels to the point and holds a 2 pt band around each drawing to
white. That reads pixels for one property; it is not the comparison of
page images this record leaves for later. A drawing is known by its size,
so another drawing of the same size, a QR code, could stand in for one.
`src/read-pdf.test.ts`, `src/drawings.test.ts` and `src/check-ink.test.ts`
hold them.

**Added 2026-11-15: a chart, read from its clip, its paths and its
words.** A chart's marks are paths the converter draws inside a clip of
its box, and its words are pdfmake's text
([0058](0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md)),
so neither the image checks nor the drawings' alone could say a chart
printed what the runtime resolved. report-corpus's `check-charts.ts`, with
`check-chart-marks.ts`, `check-chart-pie.ts`, `check-chart-labels.ts` and
`check-chart-read.ts` beside it, holds each chart to its block, which the
expectation derives (`ExpectedChart`):
- **Where it stands.** Charts and SVG images are placed by one walk,
  `drawingsOf`, in document order through every container, each as a clip
  of its size holding painted paths; a chart's clip is claimed once, and
  a chart drawn twice is said.
- **Its words.** Each is one run's text inside its box, as often as the
  chart holds it, in its face -- its token's host face, or Roboto's where
  `sans` maps none, its title bold -- and no two meet. A word empty once
  trimmed prints nothing, and is not proved.
- **Its axis.** A gridline at each tick, the category axis's line along
  the plot's foot, each tick's label on its gridline and each category's
  under its slot.
- **Its bars**, each its value's length, standing at the value's place
  among the ticks, worked out from the runtime's decimals.
- **Its lines**, one stroked path for each series with a value, a subpath
  for each stretch of two values or more, through its markers' centres.
- **Its slices.** Every point of a slice's outline lies in its sweep, and
  every curve's end, and every point sampled along each curve, on its
  circle within `EDGE`; a slice is one subpath, and draws a curve where
  its arc is 0.1 · √2 pt or longer.
- **Its legend**, each entry's words beside its swatch, in the paint of
  what it names; and **its values' labels**, each at its own mark.
- **Nothing to draw.** An empty chart has no clip, so it is proved by its
  title and its empty text, each once, no farther apart than its box, and
  nothing painted between them in a chart's colour, sought in its own
  flow after the chart drawn before it.

What it does not see, 0058 says: an empty chart's box; a chart beside an
SVG image of its very size but by their order; a pie's arc bulging
0.47 pt off its circle, which the renderer's own `chart-arcs.test.ts`
holds tighter; document order where columns break across pages; and a
value label or a legend entry in a face whose metrics stand farther off
than the three its tolerance was measured on. `check-charts.test.ts`
holds the check on real renders and on reads doctored to show each fault;
`read-pdf.test.ts` holds each path's subpaths and each curve with its
control points, which the reader now gives; and `curves.test.ts` the one
sampler of a curve that the check and the renderer's tests share.

**Added 2026-11-15: a run set below or above the line, read into its
line.** A paragraph's run may be set below or above the line
([0061](0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)),
drawn smaller and with its baseline moved, so `lines` would have made it a
line of its own and "H2O" would be found nowhere. `lines` now joins a run
drawn at exactly `SHIFTED_SIZE` of a run beside it, its baseline that
run's moved by `SHIFTED_RISE` of that size, within a hundredth of a point
and standing within 0.3 of the size from it, into that run's line, and
records it on the line with its text, its size and its move; every line
carries the list, empty where it joined nothing, and no other run is
grouped otherwise. `shiftedRuns` holds each run a document sets so to
its size and its baseline on the PDF, and fails a run read so that the
document does not set, so that every fixture of `ALL_FIXTURES` and
`SVG_FIXTURES` shows the join reads nothing new. The run's box is still
computed from its baseline and its size: what its glyphs touch on the
line above or below is not seen, as no touching accent is.
`src/lines.test.ts` and `src/check-text.test.ts` hold them.

## Alternatives considered

**Assert on the engine's input document.** Rejected: it records what was
asked, and every property in plan section 20 is decided inside the engine.

**Mock the engine.** Rejected, for the reason formancy.ai-data 0003 gives:
the mock passes because it agrees with its author.

**Compare the PDF's bytes with an approved file.** Rejected. With a fixed
creation date pdfmake writes byte-identical output, so a golden file would be
stable. But a byte difference says that something changed, not whether a row
went missing. An engine upgrade changes every byte and teaches people to
approve the new file unread. Plan section 14 promises reproducible content and
tested layout, not byte equality.

**Compare page images first.** Rejected as the first step. It needs a
rasteriser in every run and approved images per platform, and pixels cannot
prove a total. It is the later addition, for what positions cannot see.

**Another text extractor, such as poppler's `pdftotext`.** Rejected: a native
binary on every machine and runner, when PDF.js is already the viewer's
library and runs in Node.
