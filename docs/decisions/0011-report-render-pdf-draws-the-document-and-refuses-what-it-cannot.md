# 0011 — `report-render-pdf` draws the whole resolved document with pdfmake, and refuses what it cannot draw whole

- **Status:** accepted; extended by [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), which draws QR codes, by [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), which draws a QR-bill's slip, by [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), which draws an EPC QR code and its caption, by [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), which refused every e-invoice until the renderer drew the PDF/A-3 that carries one, by [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), which draws an SVG asset as vectors, only in the form report-spec's `cleanSvg` writes, and bounds what SVGs cost a render and a page, and by [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md), which draws an e-invoice as a PDF/A-3b and refuses what that cannot hold
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** the tests of `@formancy/report-render-pdf`, run by its
  `test:coverage` job in CI. Each proves a claim on the PDF the renderer
  produced, read back with PDF.js
  ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)),
  or holds a refusal to its code and subject:
  - `corpus.test.ts` renders every fixture of `@formancy/report-corpus`
    with the corpus's checks, with an empty list of excused fixtures: the
    gate 0005 names, now on the package that ships.
  - `blocks.test.ts` and `styles.test.ts` read every block kind and style
    back, lines and colours from the PDF's own content streams.
  - `glyphs.test.ts`: a character the face has no glyph for, refused in
    every place text prints, and pdfmake's own loss of it pinned.
  - `widths.test.ts`: a word wider than its table column refused, a long
    word in a paragraph kept inside its column or frame, and a 16,384
    character word refused before pdfmake breaks it.
  - `bounds.test.ts`: a body too long for the page limit refused before
    pdfmake measures it, an abort from a timer reaching a running render,
    a rule or a frame taller than the body refused, the image data bounded.
  - `tables.test.ts` and `breaks.test.ts`: closing rows kept with the row
    before them across a sweep of page ends, and a table's breaks planned,
    laying a 400-group table out at most three times, with the same bytes
    as the rules alone produce.
  - `starters.test.ts`: the starters end to end, swept across page ends.
  - `pdfmake.test.ts` pins each pdfmake 0.3.11 behaviour the renderer reads
    or works around, `_minWidth` and node positions among them.
  - `browser.test.ts`: the browser entry hands pdfmake the Node entry's
    definitions and imports no `node:` module.

  On 15 October 2026 each rule this record adds was reverted on its own
  (the numeric widths, the word check, the glyph check, the own-property
  lookups, the least-height bound, the yield, the rule and frame heights,
  the image data bound, closing rows, planning, a row's cells breaking
  together, the ids on a block's first row, the header taking a one-line
  table's totals); each revert failed its tests, and each file was
  byte-identical afterwards.

## Context

[0005](0005-pdfmake-renders-reports-behind-one-adapter.md) chose pdfmake on
the renderer trial's corpus, through an adapter that refused everything
beyond the trial's document. [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)
gives the renderer the whole of what version 0 prints -- columns,
sections, rectangles, rule weights, colours, styles per row and per cell --
and decides every value before it arrives. Plan 23.4 asks for one package
that runs in Node and in the browser.

A review of the first build of the package, on 15 October 2026, found
pdfmake's defaults losing content where the trial's subset never reached
them, and work that grew faster than the document:

- a fill column handed to pdfmake as `'*'` widened to its longest word, so
  100 W pushed a table to 980 pt on a 595 pt page, its amounts off the
  paper, and the render succeeded;
- a character Roboto has no glyph for printed as glyph 0 and U+0000 in the
  text layer, and the render succeeded;
- an amount in a narrow column was broken across lines mid-number;
- 16,384 W in a 20 pt column took 42 seconds; a 1,600-group table 60
  seconds, laid out once a page; refusing 100,000 rows against five pages
  20 seconds, all of it measuring;
- an abort from a timer arrived only once the PDF was written;
- a rule 800 pt thick was stroked off the paper, and one of 2,000 pt
  crashed pdfmake with an error naming nothing;
- a quotation's total stood alone at the top of a page, apart from its
  subtotal and VAT; a group's subtotal alone under a repeated header.

## Decision

`@formancy/report-render-pdf` takes a `ResolvedDocument` and resolves to a
PDF, or rejects with a `RenderRefusal` naming what stopped it, before any
PDF is written. It keeps 0005's rules -- its own page limit, page regions
measured, keep-together blocks and rows measured, image bytes checked,
fonts from four named files and no address, the creation date the
document's -- and adds these.

- **Two entries, one renderer.** Node's reads pdfmake's Roboto files;
  the browser's uses pdfmake's browser build and its virtual files. Only
  that differs (`node.ts`, `browser.ts`).
- **Every character is held to its face.** The faces' character maps are
  read from the very bytes pdfmake embeds, and a character without a glyph
  -- CJK, Hebrew, an emoji, a tab, the narrow no-break space Intl groups
  fr-FR amounts with -- is refused as `unsupported`, naming the block and
  the code point. `sans` is Roboto; `serif` and `mono` are refused rather
  than printed in Roboto; bold is Roboto Medium.
- **Every width is a number.** A fill column is its share of what the
  fixed ones leave, in a table, a columns block and a framed section;
  pdfmake is never handed `'*'`.
- **Every word fits where it stands.** Once pdfmake has measured the words
  and before it lays out a line, each table cell's widest word is held to
  its column: a word in a cell is never broken, because a number or an
  identifier broken across lines reads as two. A paragraph may break a
  word across up to 16 lines, as the corpus's long identifier needs; a
  longer one is refused.
- **Nothing is taller than the body.** An image, a rectangle, a rule with
  the space around it, a frame's border and padding, a line of text: each
  is refused as `content-too-large` when it is taller than the body where
  it stands.
- **The page limit bounds the work.** A body whose least height -- each
  line of text one line, each row one line and its padding, nothing for a
  spacer -- needs more pages than the limit is refused before pdfmake
  measures it.
- **A table's closing rows stay with what they close.** A group header
  stays with its first row (0005); a group's footers and the totals under
  the last row stay with the row before them, and with its group header
  when it is the group's first; the rows that move with the column header
  take a one-line table's totals with them. A row's cells break together.
- **A table's breaks are planned.** From the measured row heights and
  where pdfmake put the table's first rows, the breaks its rules will ask
  for are made in one more layout, not one layout each; where pdfmake's
  report of the first two pages differs from the arithmetic, nothing is
  planned and the rules alone break the table.
- **A frame is a one-cell table**, whose border and fill pdfmake draws
  around the part on each page; a section without one is its blocks.
- **Images are bounded per render**: two of the largest an asset may be,
  268,443,648 bytes of image data once inflated. Each asset object is
  embedded once.
- **An abort is read between passes**, after the event loop has turned.

## Consequences

**What it buys.**
- **The corpus, the starters and every block kind, proved on the PDF**,
  in the package that ships, with nothing excused.
- **Refusals instead of silent loss** for every case the review found.
- **Work that grows with the document.** Measured on an Intel i9-10900K
  under Node 24.21 on 15 October 2026, three runs each: a table of 1,600
  groups of three rows rendered in 3.4 to 4.4 seconds, where it took 60;
  refusing 100,000 rows against five pages took 236 ms, where it took 20
  seconds.

**What it costs.**
- **pdfmake internals.** The word check reads `_minWidth`, which pdfmake
  writes on each text node before it lays out a line, and the table rules
  read a node's `positions` rather than pdfmake's queries, which walk the
  whole document for each rule. Neither is pdfmake's API.
  `pdfmake.test.ts` fails the day 0.3.11's behaviour changes, and an
  upgrade is a diff somebody runs those tests on.
- **Named destinations.** A kept block's first and last rows carry ids,
  which pdfmake needs to report their pages, and each id is a named
  destination in the PDF: two to a block.
- **Long words in table cells are refused.** A German compound in a
  description column narrower than it, 'Lüftungsanlagenwartungsvertrags-
  verlängerung' in the quotation's, is refused as `content-too-large`,
  naming the table, the row and the column. The template gives the column
  the width, or the text goes in a paragraph.
- **One font.** CJK, Hebrew, Arabic, Thai, emoji and fr-FR amounts are
  refused until fallback fonts with a licence 0006 allows are embedded and
  tested (plan 19).
- **A pass cannot be interrupted.** pdfmake measures and lays out a whole
  document in one synchronous step; an abort is seen only between passes.
  A host that must stop a render at once runs it in a worker it can
  terminate. None is built.
- **Planning covers the common case.** A table inside a frame, or one whose
  rows may split across pages, is broken by its rules alone, one layout
  per break.
- **The least height is a floor.** A body that fits its least height and
  not its real one is still measured whole before it is refused.

**What it forecloses.** A second engine (0005), and breaking a word in a
table cell.

**Added 2026-10-17: QR codes.** The resolved document gains a `qrCode`
block, and the renderer draws it as [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)
decides. uqr 0.1.3 encodes it once, when the document is checked, and it
is drawn in vectors as a square exactly its size. It is refused as
`content-too-large` when no version holds its text, when its modules would
be smaller than 0.4 mm, and where an image of its size would be. Its text
is encoded, never printed, so it is not held to a face: an emoji or a
character Roboto lacks is refused in printed text and encoded in a code.
`blocks.test.ts` does not read it back, because to PDF.js a code is neither
text nor an image. `qr.test.ts` decodes it with ZXing from the page PDF.js
draws, and reads its square from the PDF's content stream.

**Added 2026-10-17: a QR-bill's slip.** The resolved document gains a
`paymentPart`, and the renderer draws it as [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md) decides: SIX's receipt
and payment part, 210 by 105 mm across the foot of the last page, in place
of that page's footer, the body keeping its room at its end. Its Swiss QR
Code is encoded once by the same uqr, at level M and version 25 at most,
and drawn 46 mm square with the Swiss cross. Its text is in a second
face, Liberation Sans 2.1.5, which the package ships under the OFL, since
SIX allows Arial, Frutiger, Helvetica and Liberation Sans and Roboto is
none of them. The slip alone prints in it: *One font* above still holds
for every other text. A bill the slip cannot draw as SIX prints one is
refused as `unsupported` or `content-too-large`, naming `paymentPart` and
the field and never a value; information taller than its section is
refused, never shrunk. `qr-bill.test.ts` and `qr-bill-pages.test.ts` prove
it on the PDF.

**Added 2026-10-17: EPC QR codes.** The resolved document gains an
`epcQrCode` block, and the renderer draws it as
[0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)
decides: encoded once by uqr at level M and version 13 at most, drawn as a
QR code without a caption, and with Austria's caption inside the PSA's
frame, "Zahlen mit Code" up its right side. The caption is the second text
that prints in Liberation Sans: the slip and the caption print in it, and
*One font* above holds for every other text. A code the renderer cannot
draw as the EPC and the PSA print one is refused as `content-too-large`
or `unsupported`, naming the code and never its payload, and a caption
whose face the SVG converter cannot open fails the render rather than
print in another face. `epc-qr-code.test.ts` proves it on the PDF.

**Added 2026-10-17: an e-invoice, refused.** The resolved document gains
`eInvoice`, the XML a PDF embeds, as [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
decides. An e-invoice is drawn as a PDF/A-3 with its XML embedded, which
this release does not write, and in Germany the XML a hybrid invoice
embeds is the invoice, so a plain PDF of one would be the picture without
the invoice. So `checkDocument` refuses every document with an e-invoice,
in both entries and before pdfmake sees it, as `unsupported`, naming
`eInvoice`: first what it does not know -- a file that is not one, XML
that is not text, a file name, a conformance level or a relationship
that is not report-spec's -- and then the rest, as a PDF/A-3 this release
does not draw. No refusal quotes the XML. A preview carries no XML, and
is drawn. The next step lifts the last refusal and draws the PDF/A-3b.
`refusals.test.ts` holds it.

**Added 2026-10-18: an e-invoice, drawn.** The last refusal is lifted
([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
A document with an e-invoice the renderer knows is drawn as a PDF/A-3b
that embeds its XML as `factur-x.xml` and states it in its XMP, through
PDFKit's own calls on the final pass; every other document is drawn as
before. What it does not know is refused as before, and three things more,
each `unsupported` and before pdfmake sees the document, since the PDF/A
cannot hold them: XML holding a lone surrogate, a title holding `&`, `<`,
`>` or a character XML 1.0 cannot write, naming `info.title`, and a CMYK
JPEG, naming the image, in an e-invoice alone. A preview carries no XML,
and is drawn plain. `refusals.test.ts`, `assets.test.ts` and
`e-invoice.test.ts` hold it.

**Added 2026-10-18: SVG images.** An image's asset may be an SVG, and the
renderer draws it as
[0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)
decides: as vectors, through the svg-to-pdfkit pdfmake vendors, in the
image's box, `contain` as the converter's `xMidYMid meet` and `cover` as
its `xMidYMid slice`, inside the viewport's clip, which is the box. It
draws only bytes report-spec's `checkSvg` finds already in the form
`cleanSvg` writes, and refuses any other as `invalid-asset`, naming the
asset and what cleaning would change, before pdfmake runs; a PNG or a
JPEG declared an SVG, and an SVG declared either, is refused saying what
it is. Behind the check stand its own list of the elements that form
holds (`svg-content.ts`) and the converter's image and warning callbacks,
which refuse rather than open a file or draw on past a warning. Two
bounds join the image data's, each refused as `content-too-large`,
naming the asset: `MAX_SVG_DRAWING`, what drawing the SVGs costs one
render, an image in a page region counted on every page `maxPages`
allows, since the converter draws it on each; and report-spec's
`MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS`, the bounds of one drawing, over
every SVG image of the body as though all fell on one page, beside those
of the page regions. Two sentences above hold for a PNG and a JPEG alone:
*each asset object is embedded once*, where an SVG is drawn wherever it
prints; and *fonts from four named files and no address*, where the
converter would open an `<image>`'s file past pdfmake's policy, which the
check, the list and the callback each keep from it, as 0005's addition
says of its *no other file*
([0005](0005-pdfmake-renders-reports-behind-one-adapter.md)).
`svg.test.ts`, `svg-threats.test.ts` and `svg-converter.test.ts` prove it,
and `pdfmake.test.ts` pins the converter.

## Alternatives considered

**Let pdfmake break a long word in a cell**, as it does in a paragraph.
Rejected: 'CHF 10,612,357.00' printed as '…357.0' and '0', two numbers,
and the corpus's checks found the row printing something else.

**A glyph table generated into the source.** Rejected: two copies of one
fact. The maps are read from the bytes pdfmake embeds, so they cannot
drift from the fonts.

**Split long words with invisible break characters.** Rejected: it writes
characters the data does not hold into the text layer, where search and
copy find them.

**Lay the whole body out ourselves** to plan every break. Rejected: a
second layout engine, which would disagree with pdfmake's somewhere. The
plan reads pdfmake's own layout and checks itself against it.

**Run every render in a worker** to make an abort immediate. Not done
here: it is the host's process model, and plan section 14 puts it with
the server's jobs.
