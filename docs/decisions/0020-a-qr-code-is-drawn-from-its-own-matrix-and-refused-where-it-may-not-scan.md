# 0020 — A QR code is drawn from its own matrix, exactly its size, and refused where it may not scan

- **Status:** accepted; extended by [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), which draws a QR-bill's Swiss QR Code at SIX's size, by [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), which draws an EPC QR code as a QR code, or at the PSA's widths in Austria's frame, and by [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), whose SVG assets the same converter draws, in the one form report-spec's `cleanSvg` writes
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-qr-code.test.ts` covers:
    - the shape, and nothing else: no colour or fill of its own;
    - content of one run at least, refused as `too-few` with none;
    - never in a table: not in a cell, a group header or a footer cell;
    - a QR code in every region and every container an image stands in;
    - its content read as a paragraph's in its place, and a page number or
      count refused in it in every region;
    - a square the printable area holds both ways, refused once when it
      holds neither, upright and landscape;
    - that square measured against `squareRoom`, the largest square the
      printable area holds, which the builders size and name it by.
  - **The editing core.** report-core's `src/diagnostics/parts.test.ts`
    reads a QR code exactly as a text with the same content in its place.
    Its expression is compiled in the report's scope and named after the
    code, and the sample report holds every kind of component.
  - **The runtime.** The *QR codes* cases of report-runtime's
    `src/lower.test.ts` cover:
    - the text: what a paragraph with the same content prints, formatted as
      it is;
    - a value a preview lacks: encoded as nothing, warned about, and
      refused in a final render;
    - a field or parameter whose value is null, and content that prints
      nothing: refused in a final render, naming the code and where, and
      encoded as they resolve in a preview;
    - a page number or count that reaches it all the same: thrown, never
      encoded as nothing;
    - a value the content cannot format: refused, naming the code.
  - **The renderer, on the PDF it produced**
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/qr.test.ts` decodes each page with ZXing from
    the pixels PDF.js draws (the corpus's `readCodes`). It reads each square
    from the PDF's own content stream (`src/testing/drawing.ts`), which says
    which shapes one fill painted. It holds:
    - the text read back byte for byte as UTF-8, at the level asked for, at
      each of L, M, Q and H. The text has umlauts, the euro sign and an emoji
      outside the Basic Multilingual Plane.
    - the level asked for kept at L, M and Q, for text sized so that uqr
      would raise each one level;
    - empty text drawn as a version 1 symbol, which ZXing reads as no code;
    - one white square exactly its size where it stands, the code four
      modules in, and the next block below it;
    - the dark modules filled once, as one path, each run of them in a row
      one rectangle of it;
    - no light line between rows: the finder pattern's column black in the
      pixels PDF.js draws;
    - a code still where it stands when a heading after it makes pdfmake
      lay the document out again;
    - a code in a column, and inside a frame's padding;
    - a code at modules of exactly 0.4 mm, read back;
    - the largest code a QR-bill prints, version 25 at 46 mm without its
      quiet zone, refused for its modules of 0.393 mm;
    - version 40 at H, and 7089 digits at L, both read back;
    - a code in the page footer, printed on every page and encoded once;
    - a heading kept with a code, standing alone and in a frame;
    - a code's side counted in the least height of a body;
    - each refusal below, with its code and its subject, and characters
      counted as code points.

    `src/browser.test.ts` holds the browser entry to the Node entry's
    definitions for codes.
  - **The reader.** report-corpus's `src/codes.test.ts` reads every code
    on a page, in reading order, with its level, its version and its place
    in points, and two codes side by side at one top from the left, whatever
    their versions. With `globalThis.fetch` made to throw, decoding still
    works, so it fetches nothing. `src/raster.test.ts` holds `rasterPixels` to
    `rasterPage`'s page, pixel for pixel. `src/trial/undrawn.test.ts` holds
    both trial adapters to refusing a code.
  - **The builders.**
    - report-builder-core's palette, properties, outline and geometry tests
      cover the code's default, fields, label and square. The properties
      test holds the palette's default size and the room the pane names to
      the largest square the validator accepts, upright and landscape.
    - React's `src/accessibility.test.tsx` and Angular's
      `src/properties.test.ts` fail when their report lacks a kind of
      `COMPONENT_KINDS`.
    - The Studio's `src/parity.test.tsx` places every kind the palette
      offers in both builders and compares them.
  - **Each rule, reverted on its own, on 16 October 2026.** Each revert
    failed its test. The rules reverted were:
    - the renderer's:
      - the keep-with-next anchor;
      - encoding once;
      - `boostEcc: false`;
      - the quiet zone;
      - one rectangle per run;
      - the white square;
      - the 0.4 mm floor;
      - the level, surrogate and length checks;
      - the width and height checks;
      - the least height;
      - the match on uqr's length error;
      - uqr in the browser entry's imports;
    - the empty-page check of the renderer's test documents;
    - the corpus reader's `wasmBinary` override;
    - report-spec's square and its page-counter refusal;
    - report-core's reading of a code's content, and its scope;
    - the runtime's naming of the code in a format refusal;
    - the builders' cap and room against the shorter side, and the levels'
      shares written by Intl.
  - **Each rule added on review, reverted on its own, on 17 October
    2026.** Each revert failed its test, or the test was written first and
    failed until the rule was there. The rules were:
    - report-spec's one run at least, and its square measured by
      `squareRoom`;
    - the runtime's refusals of a value that is null and of content that
      prints nothing, both only in a final render, and its throw on a page
      counter;
    - the renderer's one fill, which a fill per run failed both by the
      count and by the pixels, 64 of 255; its SVG, which a polyline failed
      on the second layout; `boostEcc: false` at L, M and Q, which uqr
      raised to M, Q and H; its count of code points; and, on the SVG
      again, the keep-with-next anchor, the quiet zone, one rectangle per
      run and the white square;
    - the corpus reader's rounded tops;
    - the builders' `squareRoom`, which failed with the pane measuring
      against the width and again with the palette sizing by it, and the
      one address in every catalogue;
    - report-spec's refusals of a colour or a fill and of a code in a
      table, each made to accept it, and the renderer's floor lowered to
      0.39 mm, which drew the QR-bill's largest code.
  - **The encoder is wrapped, and thrown from once.** `qr.test.ts` wraps
    uqr's `encode` in a `vi.fn` for the whole file, which passes every
    call on to the real encoder so that the tests can count the calls.
    One test makes it throw an error of its own, to show that error is
    passed on as the engine's failure. Every code a test reads was encoded
    by uqr.
  - **Not held by anything here.** That a code scans on a phone, or
    printed. ZXing reading PDF.js's drawing is the only scanner the tests
    have.

## Context

Version 0 has no QR code
([0007](0007-a-report-definition-is-its-own-versioned-document.md)'s
components), and plan 10 puts barcodes after version 1. A report often
carries one: a link to the record it prints, or a reference to pay or look
up by. Until now the only way was an image the host made and approved as
an asset.

pdfmake, the engine
([0005](0005-pdfmake-renders-reports-behind-one-adapter.md)), has a `qr`
node of its own. The alternatives below say what it draws.

ISO/IEC 18004 asks for a quiet zone of four modules around the symbol. It
leaves the module's size to the application. SIX's Swiss Implementation
Guidelines for the QR-bill, version 2.3, section 6.3, require "a minimum
module size of 0.4 mm ... when printing". A QR-bill is more than a QR
code (plan 19), and 0.4 mm is the figure this record borrows from it.

0003 asks for a claim about output to be proved on the PDF. The corpus's
reader saw text and the boxes of images. A code is neither, so nothing
could say what a drawn code says.

## Decision

**The format has a `qrCode` component.**
- **Its fields.** `content` is runs, as a paragraph's, and one at least:
  a code of no runs would encode nothing in every render. `size` is the
  side of the square in points, with the quiet zone inside it.
  `errorCorrection` is one of ISO/IEC 18004's four levels, L, M, Q and H.
- **Where it stands.** Wherever an image may.
- **What its content reads.** What a paragraph in its place reads.
- **No page number or count.** Its content is resolved once, before pages
  are counted, so a page number or count is refused in it in every region
  (`misplaced-page-counter`).
- **Its size** is held to `squareRoom`, the shorter side of the
  printable area, and refused once when that side is short. The builders
  read the same function.
- **A draft-format addition.** `reportSpecVersion` stays `'0'`, and 0.1.0,
  which does not know the kind, refuses a report that holds one as
  `unknown-kind`.

**The runtime hands the engine the text.** A `QrCode` block holds the text
the content prints, formatted by the same function a paragraph's runs go
through, with the component's id. **A final render refuses a code that
would say less than its content**, naming the code: a run whose value is
null, as `no-qr-value`, and content that prints nothing, as
`empty-qr-code`. A paragraph prints null as nothing and a reader sees the
gap; a scanner does not. A preview encodes them as they resolve.

**The renderer encodes it with uqr and draws its matrix.**
- **The encoder.** uqr 0.1.3, an exact dependency of report-render-pdf,
  encodes the text. It writes UTF-8 in byte mode, or digits and capitals
  in their denser modes, in the smallest version that holds the text at
  the level asked for. It never raises the level (`boostEcc: false`).
- **Encoded once.** The code is encoded when the document is checked, and
  every pass and every page draws that symbol (`check.ts`, `Build.codes`).
- **Drawn as vectors, the dark modules filled once.** An SVG exactly
  `size` points a side, drawn in modules and scaled to the size: a white
  square, then every dark module in one black path, each run of them in a
  row a rectangle of it. A run filled on its own is blended into the page
  on its own, and where two rows meet inside a pixel a viewer draws a light
  line between them.
- **An SVG, because a canvas cannot hold the path.** pdfmake 0.3.11 moves a
  canvas's rectangles, lines and polylines to where the canvas stands, but
  never a `path`. A polyline's points it moves in place and does not put
  back when a page break makes it lay the document out again. It places an
  SVG as it places an image.
- **The quiet zone inside the square.** A module is `size` over the
  symbol's modules and eight, so four modules of white lie on every side.
- **Refused, naming the code by its id, before anything is drawn.** As
  `content-too-large`:
  - text no version holds at its level;
  - text past 7089 characters, the most any version holds, refused before
    it is encoded. A character is a code point, an emoji one;
  - modules smaller than 0.4 mm, with a message that names the smallest
    square the text needs;
  - a code wider than where it stands, or taller than the body, as an
    image is.

  As `unsupported`: a size that is not a positive finite number, a level
  the standard does not have, text that is not a string, or text holding
  half of a surrogate pair.
- **In the flow.** A heading kept with the next block is kept with a code,
  as with an image, and a code's side counts in the least height of a
  body.

**The corpus reads codes as a scanner does.**
- `rasterPixels` gives the page PDF.js draws.
- `readCodes` decodes every QR code on it with zxing-wasm 3.1.5. It gives
  each code's text, bytes, level, version and place in points.
- zxing-wasm fetches its WebAssembly from a CDN unless it is handed the
  bytes. Here they are read from the package's own file, and nothing
  reaches the network.
- zxing-wasm is under the MIT licence and lives in the private corpus
  alone.

**The builders offer it.**
- **The palette's default.** A 30 mm square, held to the printable area,
  at level M, encoding the catalogue's address.
- **Its fields.** Its content is edited run by run, as a text's is. Its
  size is edited in millimetres. Each level is named with the share it
  restores, written by Intl: "Low (7%)".

## Consequences

**What it buys.**
- **A code exactly its size.** A 30 mm code is 30 mm, its quiet zone
  included, whatever its version. pdfmake's node would draw the palette's
  own 30 mm code at 20.5 mm.
- **No light line across a bar.** With a fill for each run, PDF.js drew
  the finder pattern's column of an 85.04 pt code with pixels 62 of 255
  between rows, at four pixels to the point. Filled once, it is black.
- **No final code that says less than its content.** A value that is null,
  or content of nothing, refuses the final render instead of printing a
  code that scans as some other reference, or as none.
- **No module finer than 0.4 mm.** A square too small for its text is
  refused, and the message names the size that would do.
- **The text's own bytes.** UTF-8, four bytes for an emoji, read back by
  ZXing at every level.
- **One decision.** What `check.ts` refused and what `content.ts` drew are
  one symbol. A footer code printed on every page is encoded once.
- **The report's own text.** Fields, parameters, aggregates and
  expressions go into a code formatted as a paragraph prints them, and the
  editor diagnoses them. No host needs an encoder.
- **Proof on the PDF.** The tests read what the page says to a scanner,
  not what the encoder was asked to draw.
- **A small encoder.** uqr 0.1.3 has no dependency, and its package is
  79,278 bytes unpacked, as npm reports it.

**What it costs.**
- **0.1.0 refuses a report with a code.** It refuses the whole report as
  `unknown-kind`, never skipping the code: fail closed
  ([0004](0004-three-version-lines-each-refused-when-unknown.md)). The
  format stays at the draft version, so a report saved with a code opens
  only in a release that has the kind.
- **A borrowed minimum.** 0.4 mm is the QR-bill's figure, taken as a
  general one. Nothing here printed a code or scanned one with a phone. A
  small square with long text is refused where a fine printer might have
  printed it, and a coarse printer may blur a code this allows.
  - **Finer than the QR-bill's own largest code.** The same guidelines put
    a QR-bill's most content, 997 characters at level M, in a version 25
    code of 117 modules a side (section 6.2), and print every QR-bill
    code at 46 by 46 mm without its quiet zone (section 6.4): modules of
    0.393 mm. A `qrCode` that size is refused, which `qr.test.ts` holds.
  - **The QR-bill is not held to it.** When it comes (plan 19), it draws
    its code at the size SIX prescribes, not to this floor. That is a
    later record's decision.
- **No character set marked.** uqr writes no ECI designator, and ISO/IEC
  18004 reads byte mode as ISO/IEC 8859-1 unless one says otherwise.
  - ZXing reads the text as UTF-8, as the tests show.
  - A reader that keeps to the default reads an umlaut as two other
    characters.
  - What phones do, nothing here shows.
- **Its text is not the PDF's text.** Search, copy and a screen reader find
  nothing in a code. A template that wants its text read prints it beside
  the code.
- **A preview's code can say less.** A preview encodes a value it lacks,
  or one that is null, as nothing, as a paragraph prints nothing. The page
  says it is a preview, but the code does not, so it can scan to a shorter
  reference than the final one. Empty content is drawn as a version 1
  symbol of no data, which ZXing reports as no code at all. A final render
  refuses all three.
- **A large code takes time and bytes.** Through `renderPdf`, a version 40
  code added 72.2 to 73.5 kB to a PDF, and a render that took 12 to 15 ms
  without it took 136 to 207 ms with it. Measured on 17 October 2026 by a
  script outside the repository, on an Intel i9-10900K under Node 24.21:
  - **The documents.** An A4 page of one 9 pt paragraph and no page
    header or footer, rendered without a code and then with one after it,
    300 pt a side. At each of L, M, Q and H, the code held the most bytes
    version 40 holds at that level, in byte mode: 2953, 2331, 1663 and
    1273 lower-case x's.
  - **The runs.** Each document rendered once to warm up, then five times.
  - **What is counted.** The time is the whole of `renderPdf`, until its
    promise resolved. The bytes are the difference in the PDF's length.
- **One path takes more bytes and more time than a rectangle per run.**
  The same script drew the same four symbols with pdfmake 0.3.11 alone,
  on a page holding nothing else, five times each after one to warm up,
  timed from `createPdf` to the end of its stream, the bytes counted
  against an empty page's PDF:
  - **As the renderer draws them**, one SVG path, they added 72.2 to
    73.6 kB and took 101 to 147 ms.
  - **As a canvas of a rectangle for each run**, 34.2 to 35.2 kB and 36
    to 58 ms.

  The path is written point by point, four for each run.
- **pdfmake's SVG converter draws every code.** pdfmake 0.3.11 vendors
  svg-to-pdfkit: in `js/3rd-party/svg-to-pdfkit` for Node, and inside
  `build/pdfmake.js` for the browser. The `LICENSE` beside its source, in
  `src/3rd-party/svg-to-pdfkit`, is MIT, which review read on 17 October
  2026. 0006's guard judges it by pdfmake's field alone. It reads the SVG
  the renderer writes and nothing else.
- **One kind of code, one look.** No Micro QR, Data Matrix or 1D barcode.
  A code is black on white, square, without a logo. The level is the only
  choice: the version, the mask and the mode are the encoder's. A `style`
  or `styleWhen` on a code is accepted, as on every component, and changes
  nothing it draws: no error says so.
- **Not a QR-bill** (plan 19). No Swiss cross, no payment part, and the
  content's syntax is not checked.
- **No code per row.** A table's cell holds one run, so a code per row
  cannot be drawn, as an image per row cannot (0007).
- **Held to the shorter side.** report-spec checks the square against
  `squareRoom`, the shorter side of the printable area, once. The builder
  names that side's room when it refuses a size, from the same function.
- **One more exact dependency in a published package.** uqr 0.1.3's code is
  Project Nayuki's QR Code generator, modified. Its `LICENSE` names both
  holders under MIT; review read it on 17 October 2026, and 0006's guard
  reads the identifier
  ([0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
  An encoder fix reaches an installation only through a release of this
  module.
- **A decoder in the tests.** zxing-wasm 3.1.5's reader is 966,895 bytes
  of WebAssembly. Each read draws the whole page at four pixels to the
  point, 2382 by 3368 pixels for A4, and decodes all of it. A test that
  reads a code is slower than one that reads text; by how much has not
  been measured on its own.

**What it forecloses.** pdfmake's own `qr` node, and a `qrCode` drawn
finer than 0.4 mm. The format addition is a draft's, and nothing else here
cannot be undone.

**Added 2026-10-17: the QR-bill.** [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md) is the later record the costs
above leave the bill's code to. A QR-bill's Swiss QR Code is not a
`qrCode`. It is encoded by the same uqr at level M, version 25 at most,
and drawn as the same SVG, its dark modules one path filled once. It is
46 mm square without a quiet zone of its own, with the Swiss cross over
its centre, and is not held to this record's 0.4 mm floor. A `qrCode`
still is: `qr.test.ts`'s case of version 25 at 46 mm still refuses it.
And a `qrCode` is still not a QR-bill: it draws no cross, and nothing
checks what its content holds. A bill is a report's payment part.

**Added 2026-10-17: the EPC QR code.** [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)'s `epcQrCode` is
not a `qrCode` either: its payload is written by the runtime from fields
the EPC's rules check. It is encoded by the same uqr at level M, version
13 at most, and drawn as the same SVG. Without Austria's caption it is
drawn as a `qrCode` of its payload at M is, and held to this record's
0.4 mm floor. With the caption it is held to the PSA's 15 to 20 mil
instead, inside the PSA's frame, so its modules may be as fine as 0.381
mm. A `qrCode` still checks nothing of what its content holds: a SEPA
payload written into one is not an EPC QR code, and nothing says so.

**Added 2026-10-18: the converter draws an asset's SVG too.** *pdfmake's
SVG converter draws every code* above says the converter reads the SVG
the renderer writes and nothing else. Since
[0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)
it also draws an SVG asset a host approved: only in the one form
report-spec's `cleanSvg` writes, which the renderer checks before it hands
the drawing on, behind its own list of the elements that form holds and
the converter's image and warning callbacks, which refuse the asset. A
code's SVG is not held to that form: the renderer writes it from the
code's matrix, and it holds nothing a host or a customer wrote. And the
corpus finds an SVG image by a clip of its size with paint inside, so a
code's square, which the converter clips too, is a clip nothing expects,
and is not reported.

## Alternatives considered

**pdfmake's own `qr` node.** It is in the engine already and costs no
dependency. Read in pdfmake 0.3.11's `src/qrEnc.js`, and measured with its
`measure` on 17 October 2026:
- **A code is smaller than asked.** A module is `Math.floor(fit / modules)`
  whole points. A version 25 code fitted to 46 mm is 117 pt, 41.3 mm. The
  palette's 30 mm code for `https://formancy.ai/report/` at M is 58 pt,
  20.5 mm.
- **A code too small is drawn as nothing.** A fit below the module count
  gives modules of 0 pt, and nothing says so.
- **Nothing holds a module to a floor.** Any version is drawn at whatever
  whole points the fit allows, 1 pt (0.35 mm) included.
- **CESU-8, not UTF-8.** A character outside the Basic Multilingual Plane
  is written as its two UTF-16 halves, three bytes each, not as UTF-8's
  four, so an emoji is not the bytes a UTF-8 reader expects.
- **No quiet zone unless `padding` asks for one.**
- **A refusal that names nothing.** Text no version holds is thrown as a
  string, not an Error.

Working around each would be a second set of checks over an encoder this
repository does not control.

**A rectangle for each run, in a pdfmake canvas.** What this record drew
first, and what pdfmake's own node draws. Each rectangle is filled on its
own, so where two rows meet inside a pixel the viewer blends them twice:
PDF.js drew pixels 62 of 255 between the rows of a finder pattern.

**One canvas `path`, or one `polyline`.** Read in pdfmake 0.3.11's
`helpers/tools.js` and tried on 17 October 2026. Its `offsetVector` never
moves a `path`: one was drawn at the page's corner, not where its canvas
stood. A polyline's points it moves in place, and its `resetXY` does not
put them back. After a page break rule made it lay the document out
again, a polyline was drawn at 200, 228.13 where its canvas stood at 100,
114.06. `qr.test.ts`'s case of a code before such a heading fails with
one.

**bwip-js.** It is under the MIT licence and draws QR codes and many
other symbologies, 1D barcodes included. Checked on 17 October 2026, on
bwip-js 4.11.4:
- **Unlicensed fonts.** Its package ships `fonts/OCRA7.ttf` and
  `fonts/OCRB7.ttf`. Their name tables declare no licence, and no licence
  file in the package covers them, so 0006's guard refuses it as it
  stands.
- **Size.** Its encoder alone is 2.1 MB (`dist/bwipp.mjs`), and the
  package is 12.9 MB unpacked, as npm reports it, against uqr's 79 kB.

It may come later for 1D barcodes, such as a delivery note's EAN or Code
128, once its fonts are left out or licensed.

**An image the host makes.** This works today: a header field of type
`image`, holding an approved asset the host resolves (0007). What it
loses:
- **Every host needs an encoder**, and a step that approves each code's
  bytes as an asset.
- **A raster.** Its modules are the host's pixels, scaled to the box,
  where the renderer's are vectors.
- **No checks.** Nothing checks the module's size, or that the code
  scans.
- **The host's text, not the report's.** The builder cannot show or edit
  it, and the report's formats do not apply.
