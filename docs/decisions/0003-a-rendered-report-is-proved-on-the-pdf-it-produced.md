# 0003 — A rendered report is proved on the PDF it produced

- **Status:** accepted
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
