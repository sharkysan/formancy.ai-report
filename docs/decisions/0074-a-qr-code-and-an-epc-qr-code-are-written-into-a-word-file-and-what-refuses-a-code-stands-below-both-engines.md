# 0074 — A QR code and an EPC QR code are written into a Word file as pictures of the symbol report-runtime decides, where what a code is refused by now stands, below both engines

- **Status:** accepted; numbered while 0069 was held for a workbook's export and 0070 to 0073 by a branch not yet merged; extends [0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md), whose writer refused a QR code and an EPC QR code until the rules a code is refused by stood where both engines read them: they stand there, and it draws both, while a payment part, an e-invoice and a chart are refused as they were; [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md) and [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), whose symbol and whose refusals are report-runtime's `qrSymbol` and `epcSymbol`, with uqr the runtime's dependency and the renderer's no longer; [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), whose Swiss QR Code's symbol is the runtime's `swissSymbol`, its slip the PDF's still; [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose package now holds, beside the document, the rule an engine draws a code's block by; and [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), as 0068 extends it: a code in a Word file is proved on the picture the file embeds, its pixels read back by a reader that is not its writer and decoded by ZXing; extended by [0075](0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md), which lifts the refusal of a payment part that this record leaves as it was -- a QR-bill's slip is written on a page of the file's own -- and under which the family the caption is named in, Arial, is listed with Liberation Sans as its other name (`w:altName`), and is listed in a file with a slip too, so that this record's "where a caption is written and in no other file" and "nowhere else" hold of a file with neither; and under which a slip's rows are at least their height too (`RowNode`'s `atLeast`), as a chart's with nothing to draw is under [0076](0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md), so that this record's "the one row the writer writes so" holds of a file with neither
- **Date:** 2026-11-18
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The rules, where they stand.** report-runtime's
    `src/qr-symbol.test.ts` and `src/epc-symbol.test.ts` hold `qrSymbol`,
    `epcSymbol` and `swissSymbol` on the symbol itself: a square of its
    version's modules with no quiet zone of its own, the level its format
    information states, the smallest version that holds its text and
    the next only once it no longer fits, an EPC QR code's least version
    in Austria's frame, a Swiss QR Code's level M and version 25 at the
    most; and on each refusal's code, subject and words: a square of no
    size and one wider than where it stands, a level the standard has
    not, text that is no text or holds half of a surrogate pair, more
    characters than any symbol holds, counted by code point and refused
    unencoded, more bytes than a version holds at its level, counted in
    UTF-8, modules finer than 0.4 mm and a square of exactly that, a
    caption no engine knows, a payload past the EPC's 331 bytes, a framed
    square no version prints in, refused unencoded, and a version whose
    modules are under the PSA's 15 mil; and an encoder's own error passed
    on as what it is. Every call to the encoder is counted, and passed on
    to it.
  - **The PDF, as it was.** report-render-pdf's `src/qr.test.ts`,
    `src/epc-qr-code.test.ts`, `src/qr-bill.test.ts` and
    `src/qr-bill-pages.test.ts` are the files 0020, 0022 and 0025 name,
    with not a line of them changed: each code decoded by ZXing from the
    page PDF.js draws, each refusal by its code, its subject and its
    words, and the encoder's calls counted through the runtime's built
    module. `src/browser.test.ts` holds the browser entry to importing no
    encoder, and `src/corpus.test.ts` draws every code fixture and holds
    its PDF by the corpus's checks, a framed code's caption in the page
    footer as a line of the footer. The README's pictures' check, the
    Studio's browser gate, by the drawings of each Download PDF, and the
    e-invoice gate's recorded corpus hold the PDFs they held. One thing
    the proof of a PDF's code gained: `readCodes` refuses a code ZXing
    reads only mirrored, turned or with dark and light exchanged, where
    it handed one on as the code it read, so every suite that reads a
    page's code holds its symbol to being drawn as it was encoded.
    report-corpus's `src/codes.test.ts` holds that on pages drawn for
    it, and on the same symbol drawn right, which reads.
  - **The corpus's readers.** report-corpus's `src/docx/png.test.ts`
    proves `readPng` on PNGs made there with Node's zlib: a bit a pixel,
    the highest of a byte first, each of PNG's five filters undone,
    Paeth's by the nearest of its three bytes, image data in two chunks
    read as one stream, and each file that is no code's picture refused
    -- no PNG, cut inside a chunk and inside a chunk's length, a chunk
    that does not sum, a chunk of text, no image data, no end, a header
    of another length, colour, interlacing, no pixels, a line too many,
    an unknown filter, data that is no stream. `src/code-picture.test.ts`
    proves `codeGrid` at one, nine and 140 pixels a module and on the
    largest symbol, and refuses a picture that is not square, all white,
    a pixel short in a module, of three modules of quiet zone, a module
    low, cut, of another colour in one pixel, dark in its quiet zone, or
    whose symbol ends more than four modules from the right or from the
    bottom, in the corner of a larger square; and `readPictureCode` to
    the text, the bytes, the level and the place ZXing reads, to nothing
    in a symbol of no data, to refusing two codes in one picture, and to
    refusing a symbol drawn mirrored, with its rows as its columns,
    turned a quarter either way, upside down or light on dark, each of
    which ZXing reads. `src/check-docx-codes.test.ts` holds
    `verifyDocx` to passing a file written by hand
    (`src/docx/testing/hand-codes.ts`), its pictures made there from the
    runtime's symbols by Node's zlib and never by the writer, and to
    failing on it with one thing of a code taken out or written
    otherwise, a case each: the picture's size, a pixel, its quiet zone,
    all white, too coarse, of more pixels than the most, its symbol
    mirrored, with its rows as its columns, in the corner of a larger
    square, one version's square around another version's symbol,
    another text, another level, no bitmap of one bit, cropped, beside
    an SVG, with room around it, beside a word, read by no scanner, an
    EPC QR code's
    at another level and in a larger version than the EPC allows, modules
    finer than 0.4 mm; and of Austria's frame, the caption's words, its
    direction, its size, its weight, its family, its place and its line,
    the frame's weight, the symbol's cell open on the right, a line
    around the caption's band, its height, a row of an exact height, the
    band's width,
    padding, a fill, a turned cell, the picture's place and size, a
    picture a hair wider than its cell with its distance from the left,
    the white above it and that white's keep, a symbol whose modules
    are over the PSA's 20 mil, a frame with no picture, one of one cell
    and one with a line under its picture.
    `src/docx/read.test.ts` holds the reader to a cell turned from bottom
    to top and to refusing one turned any other way.
    `src/docx-codes.test.ts` holds `readDocxCodes`, which the writer's
    suites read a file's codes with, on those files: each code in the
    document's order with what it says, its grid, its resolution and its
    module at the extent the file states, a code in a table, a picture
    that is no code's left out, and a code in the page header as that
    region's. `src/fixtures/fixtures.test.ts` names the code fixtures,
    and `src/fixture.test.ts` holds a key the body prints twice to being
    no key, a table's empty text to counting among what the body prints
    only where the table prints it, and the caption of a framed code in
    a page region to being a line of that region.
  - **The writer, on the file it wrote.** report-render-docx's
    `src/codes.test.ts` reads each code back with the corpus's
    `readDocxCodes`: its text and its very bytes at each of L, M, Q and
    H, umlauts, the euro sign and an emoji among them; the level kept
    where an encoder would raise it; empty text as a symbol of no data;
    the largest symbol, 1273 bytes at H and 7089 digits at L; a picture
    exactly its size, alone in its paragraph between what stands above
    and under it; whole pixels a module, the least that are 600 to the
    inch, the symbol four modules in where ZXing finds it; a module of
    exactly so many pixels given that many; a module in no more whole
    pixels than 2,400 a side hold of its symbol, with every figure this
    record gives of a wide code's picture worked out from the rule;
    modules of exactly 0.4 mm;
    the largest symbol's picture under 16,000 bytes; a code in a column
    and in a frame's padding; a code in each page region read from that
    region's part; a heading kept with a code; each code a part of its
    own and the same document the same bytes; an EPC QR code without a
    caption the very picture a QR code of its payload at M is; one in
    Austria's frame, to each length the file states, the line on each
    side of the symbol's cell and on none of the caption's band, the row
    at least its height; a framed picture
    never wider than its cell with its distance from the left, at every
    size to the hundredth of a point and every version the frame prints
    in; the caption's family in the font table where a caption is
    written and nowhere else; the 331 bytes of version 13 with the
    caption and without; and the
    writer's own refusals, a code past the count, one past the modules,
    as many of version 17 as the count allows and not of version 18, a
    code counted as often as it stands, the same block among them, the
    regions' codes counted with the body's, and a code taller than the
    printable area. `src/codes-once.test.ts`, the one suite that stands
    in the runtime's place to count, holds the writer to asking for each
    code's symbol once and for none past either bound.
    `src/corpus.test.ts` writes every code fixture and holds it by
    `verifyDocx`; `src/starters.test.ts` names the euro invoice as
    written; `src/refusals.test.ts` holds a code the rules refuse to
    being refused in the PDF's words where the walk meets it;
    `src/bounds.test.ts` counts a code as a paragraph, a framed one as
    four with its caption's characters and its run; and
    `src/stable.test.ts` writes the euro invoice from Austria in four
    processes under other time zones to the same digest.
  - **Against the PDF.** `src/against-pdf.test.ts`: for every code
    fixture, the euro invoice and its Austrian sample, each code of the
    Word file, decoded from its picture, is the code the PDF prints,
    decoded from its page, in the document's order -- text, bytes, level
    and version -- in a square of the size of the white the PDF paints
    under it, at the PDF's module; the codes of the page regions are the
    PDF's on every page, page 1's own on page 1; every code of the
    corpus's `MALFORMED` list is refused by both engines in the very same
    words, with every document of that list by the same code and subject;
    a code taller than a page by both as `content-too-large`, naming it;
    and the caption's words at 7 pt in both, a turned run's size read
    from its width.
  - **The Studio.** `src/preview/pipeline.test.ts` names the euro
    invoice's Word file as written, a preview and a final render, and
    holds it by `verifyDocx`; `src/journey.test.tsx` holds its Download
    Word to the pipeline's bytes; and the browser gate's
    `scripts/gate-word.mjs` holds the file a person downloads of it in
    Chromium, in each builder, to the document the gate resolves under
    Node and, byte for byte, to the file the writer writes of it there.
  - **The packed packages.** The install gate's
    `scripts/install-fixture/docx.ts` writes the euro invoice with its
    EPC QR code in Austria's frame from the packed writer, on the uqr a
    clean npm install gives the packed runtime: one picture of one bit a
    pixel, square, of whole pixels a module of the symbol the packed
    `epcSymbol` gives, and the caption among the document's text. No
    decoder is in that host, so what the picture says is not read there.
  - **Seen, once, by hand, on 18 November 2026**, and by no gate: the
    PDF of every starter and sample, in every language, as a final
    render and as a preview, of every fixture of the corpus that prints,
    and of eleven documents of codes made for it -- 108 PDFs -- rendered
    on the build of `main` and on the build of this change and compared
    by their SHA-256, each the same; and 38 documents either build
    refuses, 24 of them for a code, compared by the refusal's code,
    subject and words, each the same but one, a caption no engine knows,
    whose sentence this record changes.
  - **Seen failing, on 18 November 2026**, each with the thing it guards
    taken out of the source, the suites that hold it run, and it put
    back, one at a time. Of the rules, in report-runtime: the level
    raised, a border of the encoder's own, the floor with `<=`, at
    0.39 mm and gone, the square's width and its size unchecked, the
    level, the text and the surrogate unchecked, characters counted as
    code units, the cap gone, every `RangeError` taken for text too
    long, bytes counted as code units; a Swiss QR Code with no version
    bound, at level L, and with its cap, its text and its surrogate
    unchecked; an EPC QR code with its caption, its payload and its
    surrogate unchecked, its cap gone, its square unchecked before it is
    encoded, its version not raised, unbounded, at level Q, with no
    floor, with no check of its version against the PSA, and its bytes
    counted as code units: each failed by a case of the two suites. Of
    the renderer: `browser.test.ts`, which failed on the encoder its
    entry no longer reaches until it was read again. Of the corpus:
    each check of `readPng`, `codeGrid` and `readPictureCode`, each of
    `check-docx-codes.ts` with the picture's two bounds, the walk, and
    `readDocxCodes`'s regions, its tables, its resolution and its
    module, each failed by a case -- three of `readPng` only once their
    cases were written again, a cut that the other check caught and a
    Paeth line that predicted from above alone; a code fixture left out
    of `CODE_FIXTURES`; and `fixture.test.ts`'s key, kept though printed
    twice and dropped for a longer word that holds it. Of the writer:
    the picture with dark and light swapped, without its quiet zone,
    its repeated lines left black, a chunk summed over its data alone,
    eight bits a pixel stated and the bits lowest first; a module's
    pixels at 300 to the inch, unbounded, rounded down, reckoned from
    the picture's side, and rounded up with no hair taken off, which no
    case failed until one was written of a module a last binary place
    over its pixels; a picture a point short; the frame without the
    white above it or the white around it, its picture at the corner,
    its line a module wide, its row as tall as the symbol alone and one
    that may grow, its caption across, in another family, a point
    larger, at the foot of its band, on a line of Word's own and in a
    band a point wider, open on the right and with a line between the
    symbol and the caption; a code counted as no paragraph, a framed one
    as one, its caption as no characters and no run; any number of
    codes, one fewer, any number of modules, the modules' bound with
    `>=` and counted after the walk; a code of any height; a heading not
    kept with the code after it; the caption's family unlisted, and
    listed in every file; every code written into one part; a turned
    cell unwritten; and a symbol asked for twice: each failed by a case
    of the writer's suites. Before any of it, every case of
    `codes.test.ts` failed, on a writer that refused a code as 0068
    refused it; `starters.test.ts` on the euro invoice, whose total's
    label its own letter prints again, until a key printed twice was no
    key; and the corpus's fixture of codes in the page regions, whose
    header code was refused for modules of 1.08 pt, until its square was
    made larger. And the renderer's `corpus.test.ts` on a framed code in
    the page footer, whose caption the checks of a PDF read as a line of
    the body that reached into the footer, until a region's caption was
    derived as that region's line.
  - **Seen failing, on 19 November 2026**, after a review of this change
    found what its proof let pass, each case written first. The corpus's
    check, on a file written by hand whose picture showed its symbol
    mirrored, with its rows as its columns, in the corner of a larger
    square, and as one version's square around another's symbol: it had
    nothing to say against any of the four. `readPictureCode`, on a
    symbol mirrored, transposed, turned and light on dark, and
    `readCodes`, on a page of each: both read it as the code. `codeGrid`,
    on a symbol eight modules from the right and from the bottom. The
    corpus's check and the writer's own, on a framed picture a hair
    wider than its cell, which the writer's was in a 30 mm square:
    78.0614 points in a cell of 78.05. The writer, on
    one block standing 65 times, which it wrote. And `expectation`, on a
    key that a table's unprinted empty text repeats, which it dropped.
    Then, with each rule taken out again and put back: a mirrored, an
    inverted and a turned code read as any, a mirror's own turn said
    too, a turn by its sign, a misread code handed on, any white to the
    right of a symbol and any under it, the picture's version not held
    to the scanner's, a picture wider than its cell, its distance from
    the left to the nearest twentieth and unheld, the codes counted by
    their blocks, the frame's picture the line in to the nearest
    twentieth, and a twentieth nearer than its cell leaves it, and the
    picture's bound at 2,500 pixels, rounded up, and at 500 to the inch:
    each failed by a case.
  - **Seen in Word, on 20 November 2026**, by the person who decides,
    and by no gate: the euro invoice from Austria's Word file, as this
    change first wrote it, its frame a table bordered around the
    picture and the caption and its row of an exact height. Its frame's
    right line was missing, and the white under the code was cut. Four
    variants of that file, its XML edited by hand, were opened in Word
    the same day, and for each was said whether the right line was there
    and whether the white around the code was even: the row at least its
    height, neither; the caption's band two points narrower, the line
    and not the white; both, the line and not the white; the caption
    not turned, neither, its words on the line. So the table stood a
    hair wider in Word than its column, which the narrower band showed,
    and Word cut off the line at its right edge; the exact height cut
    the white at the foot, which a row at least its height did not; and
    with the caption close beside the code inside the frame, the white
    on the right looked the smaller. A fifth was approved in Word that
    day: the symbol's cell bordered on each side, the caption's band
    beside it with no border, and the row at least its height. The
    writer writes that now: its file of the sample is, part for part,
    the one approved, compared once the same day, outside any test.
    Before the change, the corpus's `check-docx-codes.test.ts` failed
    nine of its cases on the hand-written file of the new frame -- the
    file itself, three that read the file whole, and the five of the
    frame's line and row as they are now written -- and the writer's
    `codes.test.ts` its framed case and its framed 331 bytes. Then, with
    each rule taken out and put back: the symbol's cell held on three
    sides, a border on the caption's band let pass, an exact row and a
    row of another height let pass, each failed by its case of the
    corpus; the writer's row written exact again, its symbol's cell
    without the right line and its band bordered on the right, each
    failed by `codes.test.ts`.
  - **Seen in Word, on 20 November 2026**, by the person who decides,
    by hand and by no gate: every other file this change writes -- the
    code fixtures', the euro invoice's and its other samples' -- each
    with its PDF beside it and a list of what it should show, those with
    a frame as they were written again that day with the frame approved
    in Word. They were found fine ("codes sind ok") against the list:
    each code at its PDF's size and crisp, a phone reading it, the
    frame closed with its caption beside it. Nothing more of what Word
    did was written down, and nothing of it is held by a test: that
    Word draws a code's picture at its size and unsmoothed, that a phone
    reads it from the page Word prints, and that the frame stands as the
    file states it rest on that look.
  - **Seen in Word, on 22 November 2026**, for 0.3.0 (`RELEASING.md`,
    step 3), by the person who decides, by hand and by no gate: the euro
    invoice's Word file as built at `69385a8`, the committed
    `samples/euro-invoice.docx`, with every other starter's, against a
    checklist: its code's picture as large as its PDF's, 3.2 cm a side,
    and a phone reading the code from the page Word shows or prints. The
    person reported it in one answer for all the files, "alle word ok".
    Which Word, its build, the operating system, the phone and the app
    were not recorded.

## Context

0068 wrote a report as a Word file and refused, whole, what belongs to
its PDF. Of a QR code and an EPC QR code it said why: "What a code is
refused by is decided in report-render-pdf, and a second writer would
decide it a second time; until those rules stand where both read them, a
document with a code is not written." The roadmap named them first among
what a later record may lift.

It was then asked that a Word file hold all five: a QR-bill, an EPC QR
code, an e-invoice, a chart and a QR code, and before any other feature.
They are four decisions, and this is the first. The others are named
under *What follows*, and nothing of them is built here.

The forces:
- **One decision, one place.** The version that holds a text, the level
  it is encoded at, the 0.4 mm a module is never drawn under, the PSA's
  15 to 20 mil, the least version a framed code prints at: each was
  decided in report-render-pdf's `qr.ts` and `epc.ts`, with uqr, its
  dependency. A writer that encoded for itself would decide each a second
  time, and a report's Word file could pay another account than its PDF
  with nobody finding out.
- **The PDF may not change.** Every PDF's bytes, every recorded digest
  and every picture of a page stand as they are; so does every refusal a
  host has seen.
- **A Word file holds no drawing of the writer's.** The PDF draws a code
  as vectors, one path filled once. A Word file's body is paragraphs,
  tables and pictures, and a symbol is a raster already; but Word scales
  a picture to the paper, and a reader that scales a small picture up
  smooths it.
- **The same document gives the same file** (0068), in Node and in a
  browser.
- **The writer has no face.** It names families and embeds none, and
  Austria's caption is text.
- **A Word table's borders are straight.** The PSA's figure rounds its
  frame's corners by two modules, and the PDF breaks the frame's line
  around the caption.
- **A code costs something to work out.** uqr 0.1.3 encodes the largest
  symbol in some 28 ms and a version 1 in half a millisecond, and the
  writer holds the thread that calls it.
- **Nobody opens Word here.** No runner has Word, and 0068 asks that a
  person open what the writer newly writes before it reaches the public.

## Decision

**What decides a code's symbol, and what refuses one, is
`@formancy/report-runtime`'s, beside the document: `qrSymbol`,
`epcSymbol` and `swissSymbol`, which both engines ask and neither
decides again. The document is as it was. `@formancy/report-render-docx`
draws a QR code and an EPC QR code as a picture of that symbol, a PNG it
makes of whole pixels a module, exactly the code's size; an EPC QR code
in Austria's frame as a table of that picture, the frame's line around
its cell, and the caption beside it; and refuses a code as the PDF
refuses it, in the same words.**

**Where the rules stand.** report-runtime's `qr-symbol.ts` and
`epc-symbol.ts`, moved from report-render-pdf's `qr.ts` and `epc.ts`
line for line: `qrSymbol(code, width)` and `epcSymbol(code, width)` give
a code's symbol where it stands so wide, or throw the `RenderRefusal` an
engine refuses with, and `swissSymbol(payload)` a QR-bill's
(0022). With them `QR_QUIET_ZONE`, `QR_MIN_MODULE`, `QR_MAX_CHARACTERS`
and `SWISS_QR_MAX_CHARACTERS`, the numbers they hold a code to, and
`qrSymbolVersion`. The two refusals of a code's square that the
renderer's walk made itself -- a size that is no positive number, and a
square wider than where it stands -- moved with them, so that all an
engine still decides of a code is whether a page is tall enough for it,
which each measures its own way. The bytes a refusal names are counted
by report-spec's `utf8Length`, where the renderer asked the platform's
`TextEncoder`: the runtime compiles with neither Node's types nor the
DOM's. `uqr` at exactly 0.1.3 is the runtime's dependency, MIT, with
none of its own, and the renderer's no longer; the renderer keeps it as
a devDependency, for the suites that wrap the encoder to count its
calls.

One sentence changed. A caption no engine knows was refused as one
"which the renderer does not know"; said by the writer too, it is one
"which a report does not know". Every other refusal is word for word
what it was.

**The document is as it was.** A `QrCode` block is its text, its size
and its level, an `EpcQrCode` its payload, its size and its caption
(0020, 0025), and an engine works the symbol out when it checks the
document, once, and draws that symbol. Nothing a host resolved before
resolves otherwise, and nothing is refused elsewhere than it was.

**What the writer writes**, block by block, beside 0068's table:

| The document | The Word file |
|---|---|
| `qrCode`, and `epcQrCode` without a caption | An inline picture in a paragraph of its own, exactly `size` points a side, with no indent and no space around it: a PNG of the symbol, its quiet zone of four modules inside it. An EPC QR code without a caption is the very picture a QR code of its payload at level M is. |
| `epcQrCode` with `caption: 'zahlenMitCode'` | Three nodes that are `size` points tall together, as the file states them. An empty line as tall as the white the PSA's frame leaves above it in its square, kept with the table. A table of one row, at least as tall as the frame (`w:hRule`, `atLeast`), of two cells with no padding: the symbol's picture, in a cell bordered on each side by a line half a module wide, whose quiet zone is the frame's distance of four modules, the line's width down from the top, and in from the left as many twentieths of a point as its cell leaves it, which is within 0.075 pt of the line's width; and beside it, outside the line and bordered by none, the caption's band, 7 pt wide, its text turned to read from bottom to top (`w:textDirection`, `btLr`), "Zahlen mit Code" at 7 pt in Arial, black, centred, on a line of exactly 7 pt. And the same empty line under it. |

A heading kept with the next block is kept with a code, as with an
image, and a code in a keep-together block is kept as a picture is. A
code in a page region is written into that region's part.

**The picture.** A PNG of one bit a pixel of grey, black on white, every
module a square of whole pixels, so that no module's edge stands inside a
pixel. As many pixels a module as make the picture 600 to the inch at
the size it prints, `CODE_RESOLUTION`, the least whole number that does:
ten for a module of 0.4 mm, nine for the PSA's 15 mil. And no more of
them than 2,400 pixels a side hold of the symbol's modules and their
quiet zone, `MAX_CODE_SIDE`: twelve for the largest symbol, whose
picture is then 2,220 pixels a side, and 82 for the smallest, 2,378.
The pixels being whole, how wide a code is still 600 to the inch
depends on its version: up to 266.4 points for the largest symbol, 3.7
inches, and up to 287.8 for the version that fares best, just under
four. Past that a picture is the coarser the wider its code: the
largest symbol is 571 to the inch at 280 points, 555 at 288 and 269 at
595, the widest a page holds, and the smallest 597 at 287 points and
288 at 595. `codes.test.ts` works each of these out from the rule, on
19 November 2026 and whenever it runs. Each row of modules
is one scanline as it is and, after it, as many as repeat it, each
nothing but PNG's filter for a line that is the one above it; the image
data is deflated by fflate at its own default level, stated, and the
chunks summed by a CRC-32 of the writer's. The header, the image data and
the end, and nothing else: the same symbol at the same size is the same
bytes, in Node and in a browser. The part is stored in the zip as a PNG
is, since its data is deflated already. Each code is a part of its own,
numbered with the file's other pictures as it is written.

**Austria's frame**, in a Word file. The module is report-spec's
`epcModule` of the version the symbol is, the rule the PDF draws by, and
so are the frame's line, its distance and the caption's band
(`EPC_FRAME`, `EPC_CAPTION`): the PSA's modules of 15 to 20 mil, a
distance of four modules, a line of half a module, within its 0.8, and
the words at 7 pt, the least it allows. Three things are Word's and not
the PSA's figure:

- **The corners are square.** A table's borders draw the frame, and they
  turn no corner by two modules.
- **The right line is whole, and the caption stands beside it, outside
  the frame.** The PSA's figure and the PDF run the line along the
  caption's baseline and break it a module beyond each end of the words;
  a cell's border is one line, and the writer merges no cells to break
  it. The line is the symbol's cell's own right side. Drawn around both
  cells, as this change first wrote it, the line stood at the table's
  right edge, a hair past its column in Word, which cut it off, and the
  caption stood inside the frame beside the code, so that the white on
  the right looked the smaller.
- **The caption is named in Arial.** The PSA asks for "Arial o.s.
  non-serifs", and the PDF prints Liberation Sans, whose widths are
  Arial's: named in Arial, the caption is as long as report-spec counts
  it, and so no longer than the symbol beside it, on a machine that has
  the family, which one with Word has. The file embeds no face, and
  lists the family in its font table where a caption is written and in
  no other file.

**The row is at least the frame's height**, the one row the writer
writes so, where every other is exact: of an exact height, Word cut the
white under the symbol. Word grows such a row to what its cells hold.

The line is held in Word's eighths of a point: half a module is 0.54 to
0.72 pt, written as a half, five eighths or three quarters of a point,
within a sixteenth of what the PDF draws and within the PSA's 0.8 of a
module.

**What is refused.** A code the runtime's rule refuses is refused by the
writer with that refusal, where the walk meets it: by where a thing
stands and not by its kind, as 0068 has it. The writer's own, each
`content-too-large`, naming the code:

- **A code taller than the printable area**, which no page of a Word
  file holds, as a picture is; the PDF judges it against the body
  between its regions.
- **More than `MAX_DOCX_CODES` codes**, 64, counted where the walk meets
  one and before anything of it is worked out, and as often as one
  stands: a block that a document holds twice is two codes, each
  encoded and drawn.
- **Codes of more than `MAX_DOCX_CODE_MODULES` modules between them**,
  501,264, the square of each symbol's side summed: what sixteen of the
  largest symbol hold. Counted as each is encoded, so that none is
  encoded after the one that crossed.

Two bounds, since a count bounds the work only where each thing counted
costs what the count takes it for (0068), and the largest symbol costs
the encoder some sixty times the smallest. So a file holds sixteen of the
largest symbol, or as many as the count allows of a symbol of version
17, 85 modules a side, or less.

Measured on 18 November 2026, on an Intel Core i9-10900K that a build
shared that day, under Node 24.21.0 with uqr 0.1.3 and fflate 0.8.3, a
process a measurement, four each, a document of codes alone on an A4
page: the seconds `renderDocx` held the thread, and the process's
resident memory at its most, of which a document of one paragraph took
0.01 seconds and 150 to 151 MB.

| The file | Seconds | MB |
|---|---|---|
| One code of version 3, 30 mm a side | 0.02 to 0.03 | 151 to 152 |
| One of version 40, 300 points a side | 0.09 to 0.10 | 153 to 154 |
| 64 of version 3, 30 mm a side | 0.18 to 0.22 | 185 to 187 |
| 64 of version 17, 644 bytes at level L | 0.62 to 0.68 | 200 to 202 |
| 64 of version 1, 595 points a side, the largest a page holds | 0.79 to 0.85 | 180 to 195 |
| 64 EPC QR codes of 331 bytes in Austria's frame, 118.6 points a side | 0.53 to 0.56 | 195 to 214 |
| Sixteen of version 40, 1273 bytes at level H, 300 points a side | 0.70 to 0.72 | 171 to 176 |
| Sixteen of version 40, 7089 digits at level L | 0.81 to 0.84 | 177 to 183 |
| Sixteen of version 40, 595 points a side | 0.70 to 0.76 | 170 to 176 |
| Fifteen of version 40 of 7089 digits and 49 of version 1: both bounds at once | 0.88 to 1.61 | 183 to 195 |

These are the shapes that were looked for, and no more is claimed. They
come on top of what the rest of a file costs (0068): a code is a
paragraph of the file's 70,000, and a file at every bound at once was
not measured. With the count alone, before the modules were bounded, 64
of version 40 at 300 points held the thread 2.63 to 2.76 seconds at 1273
bytes and 3.03 to 3.19 at 7089 digits, three processes each. uqr's
`encode` alone, timed in one process on the same day, took 27 to 29 ms
for a symbol of version 40, 4.3 ms for one of version 13, 1.6 ms for
the EPC's example and 0.5 ms for one of version 1.

**The proof** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
as 0068 extends it). A code in a Word file is proved on the picture the
file embeds. The corpus reads the part's bytes back with a PNG reader of
its own (`docx/png.ts`): its chunks walked and summed, its data inflated
by Node's zlib, every filter PNG defines undone, so that the reading
rests on nothing the writer chose. `codeGrid` holds the pixels to a
symbol drawn in whole pixels a module with its quiet zone around it,
found from the pixels alone, and every pixel to the module it stands in.
`readPictureCode` hands them to ZXing, as `readCodes` hands it a page.
`verifyDocx` holds each code, block by block, to its document: the
picture's extent and place, its resolution, what it says, at which
level, an EPC QR code's version to the EPC's and the PSA's, and Austria's
frame to this record's table, by the corpus's own reading of it.

Neither reading is enough alone, as a review of this change showed. The
grid cannot tell a symbol from its mirror, and ZXing reads a mirrored
symbol and says so: a picture whose rows were its symbol's columns
passed, with its text, its level and its version all its document's,
and many a banking app reads no such code. So the corpus's reader,
`codesIn`, refuses a code ZXing reads only mirrored, turned or with
dark and light exchanged, for a Word file's picture and for a PDF's page
alike: `readCodes` had handed such a code on too, and no test of a PDF
would have seen a renderer draw one. And ZXing cannot tell a symbol
from one in the corner of a larger square: `codeGrid` holds the symbol
to ending four modules from the right and from the bottom, as it holds
it to starting four from the top and the left, and `verifyDocx` the
version the picture is a square of to the version ZXing reads in it.

What a
scanner reads is not at hand at once, so `verifyDocx` is waited for,
wherever it is called. The corpus's `CODE_FIXTURES` are the documents
both engines draw, and each way a code is refused is a document of its
`MALFORMED` list, which holds both engines to the same refusal.

**A key the body prints again is no key.** The corpus derives, from a
document, the keys its output is searched for: the first cell of each
table row. The euro invoice's letter asks for "den Rechnungsbetrag", the
label of its table's total, so that word is on two lines of any engine's
output; held by a derived expectation for the first time, its Word file
was said to print a key twice. `expectation` now derives no key the
body's own words print again, and such a row is held by its table, cell
for cell, as every row is. A table's empty text is among those words
only where the table prints it, which is where it has no detail row.

**A framed code's caption in a page region is a line of that region.**
The checks of a PDF tell a page's header and footer from its body by the
text of their lines, which `expectation` derives from a region's
paragraphs. Austria's caption is the one line a region prints that is no
paragraph's: in the page footer it was read as a line of the body that
reached into the footer. `expectation` now derives it with the region's
lines, for both engines' checks. A fixture therefore prints the caption
in its footer or in its body and not in both, and the corpus has one of
each (`epc-qr-code-footer`, `epc-qr-code-placed`).

**The starters.** `starters.test.ts` is the list:

| Starter | Its Word file |
|---|---|
| Service inspection, Quotation, Grouped equipment, Site visit, Order confirmation, Product data sheet | written |
| Euro invoice | written, its EPC QR code a picture; and its samples from six more countries, Austria's in the PSA's frame |
| Invoice, Payment reminder | refused: the payment part |
| E-invoice (Factur-X), E-invoice (XRechnung) | a final render refused for its e-invoice, a preview for its label |
| Sales report | refused: its chart, the first of its two |

**The Studio** offers Download Word for the euro invoice, and for any
report a person gives a code. Nothing of the page changed: the Preview
offers the file the writer wrote, or says why not, as it did.

**What follows.** Three records, in this order, each a pull request of
its own, and before any other feature the roadmap names:

- **0075**, a QR-bill's slip in the Word file, on a page of its own at
  the end, its Swiss QR Code the symbol `swissSymbol` decides.
- **0076**, a chart as Word's own, a DrawingML chart written from the
  runtime's block.
- **0077**, an e-invoice as a copy a person may edit, labelled on every
  page as not the invoice.

Until each is written the writer refuses what it refuses now, and its
sentence says that the report prints as a PDF.

## Consequences

**What it buys.**
- **A report with a code is exported.** The euro invoice and its six
  samples, and any report that carries a QR code, are Word files a person
  can go on writing in.
- **One symbol in both files.** The code a Word file's picture shows is
  the code its PDF draws: the same rule decided it, and the comparison
  holds the two on every fixture.
- **One refusal.** A code the PDF refuses is refused by the writer by
  the same code and subject, in the same words.
- **A code exactly its size**, as in the PDF, with modules at the size
  the rule held them to.
- **A picture that stays sharp.** At 600 pixels to the inch a module's
  edge stands within 0.042 mm of where the symbol puts it, and a printer
  of as many dots draws the picture without scaling it up.
- **A small part.** A typical code's picture is some 700 bytes, and the
  largest symbol's some 8,000.
- **No encoder in an engine.** uqr is one package's dependency, and a
  third engine asks the same rule.

**What it costs.**
- **These files were opened in Word by hand.** Each of them on
  20 November 2026, the euro invoice from Austria after its frame, which
  Word cut, was written as the variant approved there, and the euro
  invoice's again, with every starter's, on 22 November 2026. What Word
  draws of a code's picture, its frame and its turned caption rests on
  those looks, and no test holds it.
- **A raster, where the PDF draws vectors.** Enlarged on a screen, a
  Word file's code shows its pixels sooner than its PDF's would. A
  picture of 600 to the inch is finer than most printers resolve a
  module's edge, and coarser than a path.
- **Word may resample it.** Microsoft's pages say that the default
  picture resolution in Microsoft 365 is 220 pixels to the inch and that
  an option, "Do not compress images in file", turns picture compression
  off ("Reduce the file size of a picture in Microsoft Office" and "Turn
  off picture compression", read on 18 November 2026). Whether Word
  resamples a code's picture when a person saves the file, and what a
  scanner reads of it then, was not tried: a module of 0.4 mm at 220 to
  the inch is three and a half pixels, and no longer a whole number of
  them.
- **A wide code is drawn under 600 to the inch.** From 266 to 288
  points wide, by its version, a code's picture is as many whole pixels
  a module as 2,400 a side hold and no more: at 595 points, the widest
  a page holds, that is 269 to the inch for the largest symbol, twelve
  pixels a module, and 288 for the smallest, 82.
- **The frame's picture stands half a module from the left only to
  within a hair.** Its cell and its distance from the left are whole
  twentieths of a point, so it stands as many of them in as the cell
  leaves it: within 0.075 pt of the line's width, 0.026 mm.
- **A reader that refuses.** `readCodes` throws on a code ZXing reads
  only mirrored, turned or light on dark, so a test cannot read such a
  code to say something else of it; and a symbol that reads at a slant
  of half a degree or more would be refused as turned, which no page
  or picture here is.
- **Austria's frame is not the PSA's figure.** Its corners are square,
  its right line whole and its caption beside it, outside the frame,
  and its line is a half, five eighths or three quarters of a point
  where the PDF draws half a module exactly. Whether a bank or a reader
  minds was asked of nobody.
- **The frame's row may grow.** It is at least the frame's height, so
  where Word lays its cells out taller than the frame, the code stands
  taller than its square by as much; nothing here measures it, and the
  corpus holds what the file states.
- **The caption is in whatever face the reader's machine gives Arial.**
  Where the family is missing Word chooses another, the caption may be
  longer than the symbol is tall, and the file says nothing of it. Its
  line is exactly its band, 7 pt, where Word's own line for 7 pt is
  taller: where Word puts the words on such a line, and whether it cuts
  the top of a letter, nobody has seen.
- **No schema judged the frame.** The caption's cell is turned by
  `w:textDirection`, an element the writer did not write before. It
  stands in a cell's properties where the corpus's vocabulary,
  transcribed from ECMA-376's schema, puts it, after the shading, and the
  reader refuses it anywhere else and with any value but `btLr`. The
  files 0068 validated by hand against the transitional schema held no
  such cell, no file with one was validated, and no schema judges a Word
  file in CI.
- **A code is no text.** Search, copy and a screen reader find nothing
  in a picture, as they find nothing in the PDF's code (0020); and the
  picture carries no description of its own.
- **A person can stretch it.** A picture in a Word file is resized with
  a pointer: a code made smaller has finer modules than the rule held
  it to, and nothing in the file refuses that.
- **A file holds 64 codes, and sixteen of the largest.** A report of
  more is refused as a Word file and prints as a PDF, which bounds
  neither.
- **The runtime has a dependency more.** uqr 0.1.3, 79,278 bytes
  unpacked, installs with every package that depends on the runtime, the
  form bridge and the data provider among them, which draw nothing. Its
  encoder is in no bundle that calls neither rule: the packages declare
  no side effects.
- **Each engine encodes.** A host that prints a PDF and writes a Word
  file of one document encodes each of its codes twice, 28 ms twice for
  the largest symbol.
- **Rules an engine applies live in the runtime.** `qrSymbol` throws an
  engine's refusal, from the package that resolves a report: it is not
  called when a report is resolved, and a host that resolves and never
  renders learns of a code too long for its square only from an engine,
  as before.
- **The renderer's suites reach the encoder through the runtime's built
  module.** They wrap uqr to count its calls, and the calls are now made
  in report-runtime's `dist`: that the wrap still reaches them is what
  those cases passing shows, and a bundler that inlined uqr into the
  runtime would end it.
- **`verifyDocx` is waited for.** ZXing's reading is asynchronous, so
  the check is, in every suite and in the Studio's gate; a caller that
  does not wait holds a promise to an empty list.
- **A derived expectation holds one key fewer** where a report's words
  print a row's first cell again: that word is no longer sought once on
  the pages, and its row is held by its table alone.
- **A page's regions are told by their words.** A report that prints
  Austria's caption in its page footer and under a code in its body is
  one the corpus's checks of a PDF cannot hold by a derived expectation:
  every caption would be taken for the footer's. Nothing here needs one,
  and the Word file's check, which reads the footer from its own part,
  holds such a report.
- **The mapping is read twice**, as 0068's is: the corpus's check walks
  a code's nodes by its own reading of this record's table, and a row
  both misread passes.

**What it forecloses.** Nothing that cannot be undone. A later release
may draw a code otherwise -- a vector, a frame with round corners -- and
the same document then gives other bytes, which 0068 already says of
the file's shape.

## Alternatives considered

**The symbol in the resolved document**, each code's matrix beside its
text, encoded as the report is resolved, as the EPC's payload is the
runtime's already. An engine would draw what it is handed and ask no
rule. It lost on what it would change: where a code is refused, from a
render's `RenderRefusal` to a resolution's error, in a preview too; a
released type, which every document made by hand, the corpus's and a
host's, would have to carry a matrix for; a document that holds a text
and a matrix which an engine cannot hold to each other; and a matrix of
up to 31,329 modules a code in a document a host may store. The
renderer's refusals of a code could not have stayed word for word.

**A package of its own below both engines.** The rules and the encoder
in a published package that depends on the runtime for the block and the
refusal. A package, its row, its job, its tarball and its licence files
for some 250 lines that are about a block the runtime defines.

**The rules in report-spec**, beside `epc-print.ts`. report-spec is the
format and its validation: it throws no refusal, knows no resolved
block, and would carry an encoder into every builder.

**uqr in both engines**, each calling it by the same options. Two
packages pinned to one release by nothing but review, and the options
-- the level never raised, no border, the least and the largest version
-- typed twice: the two decisions this record exists to make one.

**The code as an SVG**, through `svgBlip`, as an asset's drawing is
written (0068). Vectors, and the PDF's own drawing. A reader that does
not know the extension shows the fallback, which would have to be the
code all the same; Austria's caption would be text in an SVG, in a face
the reader's machine chooses; and an SVG a writer makes is one more
thing nobody has seen Word draw.

**One pixel a module.** The smallest picture, and the one a reader
smooths most as it scales it to the paper: a module's edge a ramp a
module wide.

**So many pixels a module, whatever the size.** A code 20 cm wide of 29
modules would be drawn at ten pixels a module, 37 to the inch.

**600 to the inch with no bound on the picture.** The largest symbol at
the largest size a page holds was 4,995 pixels a side, 3,126,870 bytes
of scanlines, which fflate deflated in 46 ms, measured on 18 November
2026 as above; 64 of them held the thread 6.1 to 7.5 seconds.

**The image data deflated at fflate's highest level.** Some 20 % smaller
and twice as long: 88 ms against 46 for that picture.

**A count of codes alone.** 64 of the largest symbol held the thread 2.6
to 3.2 seconds, on top of everything else a file at its bounds costs. A
lower count would have refused a sheet of small codes for what sixteen
large ones cost.

**One part for codes that say the same.** A report's footer and its
body may print one reference twice. The parts are some hundreds of
bytes, and a second key to find a picture by is a second thing to be
wrong.

**The frame around the picture and the caption**, a table bordered
around both cells, its row of an exact height, as this change first
wrote it: the PDF's frame, the caption inside it. Opened in Word, the
line at the table's right edge was cut off and so was the white under
the symbol. With the caption's band two points narrower the line was
there and the white around the code uneven, the caption close beside
it; with the row at least its height and the band as it was, neither
was right.

**The caption not turned**, its words across the band. Opened in Word,
its words lay on the line.

**The right line broken around the caption**, as the PDF breaks it: the
frame three rows, the symbol's cell merged down them (`w:vMerge`), and
the line on the band's cells above and under the caption's. Cells
merged down a table, which the writer writes nowhere else and nobody
here has seen Word draw.

**The frame drawn in the picture**, corners rounded as the PSA's figure
rounds them. The caption would then have to stand over the picture, in a
text box anchored to it, which is a floating object in a file that has
none; or be drawn in it too, in a face the writer has not.

**The frame and the caption as DrawingML shapes**, a rounded rectangle
and a text box. The PSA's figure exactly, and a vocabulary of anchors,
shapes and text boxes, each of which nobody here has seen Word place.

**The caption in the report's sans token.** Roboto, where the report
maps none, is on few machines, and a host may map the token to a face
with serifs, which the PSA rules out.

**Liberation Sans named**, the face the PDF prints the caption in. Few
machines with Word have it, and Word would choose another without a
word.

**A captioned code refused**, until somebody has seen Word print a
frame as the PDF does. The euro invoice from Austria would have no Word
file for the sake of four corners.

**`verifyDocx` as it was, and the codes held by a second check.** A
caller that forgot the second would hold a white square to being a
code's picture and pass.

**The keys stated by each caller** that holds the euro invoice: the
writer's suite, the Studio's and its gate. Three lists of one report's
words, and the next starter whose letter names its total would need a
fourth.
