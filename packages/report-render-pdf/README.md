# @formancy/report-render-pdf

The Formancy Report PDF renderer: it draws a resolved report with
[pdfmake](https://github.com/bpampuch/pdfmake), and refuses what it cannot
draw whole rather than return a truncated or partial PDF. It takes the
renderer-neutral document `@formancy/report-runtime` resolves a report to,
with the approved asset bytes already in it, and never a database
connection, a file name or an address. Why pdfmake, and what its adapter
has to work around, is decision
[0005](../../docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md);
what the renderer refuses beyond it, and why, is
[0011](../../docs/decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md).

## Render

```ts
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'

try {
  const pdf: Uint8Array = await renderPdf(document, { maxPages: 200, signal })
  // the whole report, every page of it
} catch (error) {
  if (!(error instanceof RenderRefusal)) throw error // the engine failing, not the report
  // error.code says what stopped it; error.subject names the asset, table
  // or block, such as 'logo' or 'body[3].blocks[0]', when it is about one
  console.warn(`${error.code}: ${error.message}`)
}
```

`renderPdf` resolves to the PDF's bytes, or rejects with a `RenderRefusal`.
A refusal is decided before the PDF is written: a refused report has no
PDF at all. Anything else it rejects with is a fault, and a `maxPages` that
is not a whole number of pages, at least 1, is the caller's: a `RangeError`.

The same document renders to the same bytes: the creation date is the
document's own (`info.creationDate`), and nothing else in the file varies.
That includes where its images stand in the file. PDFKit decodes a PNG
with an alpha channel, a palette's transparency or interlacing before it
embeds it, and numbers its soft mask and writes it when the decode calls
back, in whatever order the decodes finish; the renderer has those images
written in the order pdfmake opened them, which `src/image-order.test.ts`
holds in both entries
([0035](../../docs/decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).
The bytes are one entry's: the browser build deflates with a zlib of its
own, and `src/browser.test.ts` holds an e-invoice from either entry to the
same objects, each stream inflated, not to the same file.

## Node and the browser

| Entry | pdfmake | Fonts |
|---|---|---|
| `@formancy/report-render-pdf` | the Node build | the four Roboto files in pdfmake's package, and for a QR-bill's slip and an EPC QR code's caption the two Liberation Sans files in this package's `fonts`, read from disk; for an e-invoice, PDFKit reads its ICC profile from its own package (below) |
| `@formancy/report-render-pdf/browser` | the browser build, `pdfmake/build/pdfmake.js` | the same Roboto, from pdfmake's `build/vfs_fonts.js`, and the same Liberation Sans from a chunk of the build's own, imported the first time a document has a bill or a captioned EPC QR code |

The two entries share everything but the build of pdfmake and where the
fonts come from: the checks, the measuring passes and the document
definitions are one module both import. The browser entry touches no file
system and imports no `node:` module. Liberation Sans reaches it through a
dynamic import alone, so an app's bundler puts it in a chunk that a host
which never prints a bill or a captioned EPC QR code never loads, which a
test holds. An import that fails is not kept: the document it failed for
rejects with its error, and the next bill or caption imports the chunk
again; once it has loaded, nothing imports it again. The Node entry keeps
its reads of the font files the same way, so a file it could not open just
then fails the render that asked for it and no render after.
Whether a browser fetches a chunk again after a failure, or a chunk a
deploy removed is still there, is not the renderer's to decide: a page
reload is.

What the tests show about the browser entry, run in Node: for every fixture
in the corpus it hands pdfmake the definitions the Node entry does, its PDFs
pass the corpus's checks, it places every run and image where the Node entry
does, and it reaches no Node module. What they do not show is the browser
build in a browser. That is the Studio's browser gate's to check:
`apps/studio/scripts/browser-test.mjs`, in CI's `browser` job, prints
every starter through this entry in Chromium and reads its text back, and
no other browser runs it
([0013](../../docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).

pdfmake is one configuration per process, or per page in a browser: fonts
and access policies are global to it. The renderer sets its own again
before every render, so a host that configures pdfmake for something else
cannot change what a report renders with. The cost runs the other way too:
after a report, the renderer's configuration is in place.

## What it draws

Every block of the resolved document:

- **Paragraphs**, in their size, weight, slant, colour and alignment, and
  a run in bold inside a paragraph that is not.
- **Tables**, their header row repeated on every page they span, each row
  in its kind's style or its own, each cell in its own when it has one, each
  column aligned as it says unless a cell says otherwise. A group header
  `across` the table is one cell over every column. A group header is never
  the last row on a page, and a row that fits on a page is never split. A
  group's footers and the totals under the last row stand on the page of
  the row before them, and with its group header when that row is its
  group's first: a subtotal or a total never stands alone at the top of a
  page. Every column is as wide as it says, a fill column its share of
  what the fixed ones leave, never wider for a long word in it.
- **Images**, in a box the layout reserves whole: `contain` draws all of
  the image at its proportions, as large as the box allows, centred in it;
  `cover` fills the box, centred, and is clipped to it. A JPEG is fitted by
  the size it is shown at, after its Exif orientation. An SVG is drawn as
  vectors (below), fitted by its viewBox.
- **QR codes** (ISO/IEC 18004), encoded by [uqr](https://github.com/unjs/uqr)
  in the smallest version that holds their text at the level asked for,
  never a higher level, and drawn in vectors as a square exactly their size:
  white, with the quiet zone of four modules inside it, and the dark
  modules one black path over it, filled once, so that no viewer draws a
  light line where two rows meet inside a pixel. The square is an SVG,
  which pdfmake places as it places an image: a path in a pdfmake 0.3.11
  canvas is never moved to where the canvas stands. Its text is never
  printed, so it is not held to the font: umlauts, the euro sign and emoji
  are encoded as UTF-8, and text of digits or capitals alone in the denser
  modes for them. Each code is encoded once, when the document is checked,
  and that symbol is the one every pass and every page draws. A heading
  kept with the next block is kept with a code as with an image. What a
  large code adds to a render's time and to the PDF, and what the one fill
  costs against a rectangle for each run, is measured in
  [0020](../../docs/decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md).
- **EPC QR codes** (EPC069-12 version 3.1), the code a SEPA credit
  transfer is initiated from: the runtime's payload encoded as a QR code's
  text is, at level M and in version 13 at most, and drawn as a QR code
  is, or in Austria's frame with "Zahlen mit Code" beside it (below).
- **Rules**, at their thickness and colour, across the width they stand in,
  with 3 pt above and below.
- **Rectangles**, filled, outlined or both, their outline drawn inside the
  box at half a point.
- **Columns**, side by side at their widths, with no gap but what the widths
  leave; a column longer than the page continues on the next.
- **Sections**: with a border, a fill or padding, a frame drawn around the
  part of the section on each page, its blocks laid out inside it as in the
  body, tables and page breaks included; without one, its blocks and nothing
  more.
- **Keep-together blocks**, moved whole to the next page when they do not
  fit, and paragraphs **kept with the next** block.
- **The page header and footer**, on every page, with the page number and
  the page count. The body is laid out between them, after both are
  measured.
- **A QR-bill's payment part**, the receipt and the payment part with its
  Swiss QR Code, across the foot of the last page in place of its page
  footer (below).

## What it refuses

| Code | When |
|---|---|
| `too-many-pages` | The report needs more pages than `maxPages`, a QR-bill's page included. pdfmake's own limit would return the first pages as though they were all of it. A body whose least height already needs more, the room a bill's slip keeps included, is refused before pdfmake measures it. |
| `content-too-large` | Something no page can hold: a keep-together block, an image, a QR code, a rectangle, a rule, a frame's border and padding, or a line of text taller than the body where it stands; anything wider than where it stands; a word in a table cell wider than its column, or a word in a paragraph longer than 16 lines of it; images holding more than 268,443,648 bytes of image data together; SVG images past what a render may draw or a page may cost a reader (below); page regions that leave no body; a QR code's text that no version holds at its level, or a square too small for that version's modules to be 0.4 mm, the message naming the size it needs; an EPC QR code past the EPC's 331 bytes or the PSA's modules (below); a QR-bill the slip cannot hold (below). |
| `invalid-asset` | An image's bytes are not the PNG, JPEG or SVG they are declared as, are cut off, or are past the limits: 20 MB, 4096 pixels a side, and for an SVG a mebibyte; a JPEG that PDFKit would read otherwise than its frame header says -- a JPG or DAC segment before the frame header, which PDFKit takes for it, as an arithmetic-coded JPEG may write its DAC segment, a second frame header, or a frame of other than 1, 3 or 4 components, which PDFKit gives no colour space (0031); an SVG is not exactly the drawing report-spec's `cleanSvg` writes (below). A PNG's or a JPEG's structure is read by report-spec's `imageHeader`, which a builder refuses an image a person adds by too, in the same words (0033); whether a PNG's image data inflates to the scanlines its header promises is read here alone, since it needs the platform's decompressor. |
| `cancelled` | The signal was aborted. |
| `unsupported` | What the renderer cannot draw as written: a character the font has no glyph for, a font other than `sans`, text that is not a string, a colour that is not `#rrggbb` in lower case, a QR code's level other than L, M, Q and H, an EPC QR code's caption it does not know, half of a surrogate pair without the other in a code's text, which has no UTF-8, a page field outside the page header and footer, a page break inside a page region, a keep-together block or a column, a table inside a column, a table row of the wrong number of cells, a block kind, page size or page field it does not know, blocks nested past 16 deep; a QR-bill it cannot draw as SIX prints one (below); an e-invoice it does not know, or one its PDF/A-3b cannot hold, a CMYK JPEG or an SVG whose numbers or nesting it cannot hold among them (below). |

## SVG images

An image asset may be an SVG
([0030](../../docs/decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)),
which a host approves by cleaning it with report-spec's `cleanSvg`, which
the runtime hands on, and keeping the bytes it returns. The renderer
draws an SVG only when report-spec's `checkSvg` finds its bytes already
exactly what `cleanSvg` writes, and refuses any other as `invalid-asset`,
naming the asset and what cleaning would change, before pdfmake runs:
nothing is cleaned, dropped or rewritten at print, so what prints is in
the form that was approved.

- **Drawn as vectors** by the SVG converter pdfmake 0.3.11 vendors,
  svg-to-pdfkit, in the image's box, never as an embedded image: `contain`
  is the converter's `xMidYMid meet`, the whole drawing as large as the box
  allows, centred; `cover` its `xMidYMid slice`, the box filled and the rest
  clipped by the drawing's viewport, which is the box. Nothing is drawn
  outside the box, and a transform on the drawing's root, which the
  cleaner moves inside it, cannot move it out.
- **Guarded twice behind the check.** The text handed to the converter is
  held to the renderer's own list of the elements a cleaned drawing holds
  (`svg-content.ts`), so that a link, text, an image, `use`, a style sheet,
  a comment or a DOCTYPE never reaches it even were the cleaner wrong; and
  the converter's image and warning callbacks refuse the asset, where the
  converter would open an `<image>`'s file past pdfmake's local access
  policy, or draw on past what it could not read and say so only to the
  console. Neither stops a link, which the converter writes for an `<a>`
  whatever its callbacks say; the check and the list do. The list may
  refuse more than report-spec's tables, never less: a test holds it to
  their `SVG_ELEMENTS`.
- **Drawn again on every page in a page region.** pdfmake lays the page
  header and footer out for each page, and the converter draws the drawing
  each time: a PNG is embedded once, an SVG grows the PDF and the render
  by its drawing on every page.
- **Bounded per render.** What drawing the SVGs costs the renderer is held
  to `MAX_SVG_DRAWING` units of what the converter draws -- lines, curves,
  elements, gradient stops and page-sized transparency groups, each
  weighted by what it was measured to cost beside a line, and every 32
  bytes of the drawing, which pdfmake and the converter read again each
  time it is drawn, whatever it draws -- counting an
  image in a page region on every one of `maxPages`, the pages the report
  may have, which is known before the render: a detailed header logo can
  be refused at a high page limit though the report prints two pages. At
  the budget the renderer spends about what `MAX_IMAGE_DATA`'s largest
  images cost it to decode (`assets.ts` says how both were measured, on
  what and when). What they cost a reader is held
  to what one drawing may cost, which was measured as a page's:
  `MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS` over every SVG image of the body,
  as though all fell on one page, and those of the page regions. A
  translucent logo printed twice in the body can be refused for it.
- **Held to PDF/A in an e-invoice** (below): an SVG whose numbers could
  pass the integers a PDF/A-3 holds, or whose drawing nests deeper than
  its graphics state may, is refused there and drawn in any other report.

## QR codes

A code is refused, naming it by its id, rather than drawn as one that may
not scan:

| Code | When |
|---|---|
| `content-too-large` | Its text is longer than any QR code holds at its level: in byte mode, 2953 bytes at L down to 1273 at H (ISO/IEC 18004, table 7). Past 7089 characters, the digits version 40 holds at L and the most any code holds, it is refused unencoded; a character is a code point, an emoji one. |
| `content-too-large` | Its modules would be smaller than **0.4 mm**. ISO/IEC 18004 leaves the module size to the application; SIX's Swiss Implementation Guidelines for the QR-bill, version 2.3, section 6.3, require 0.4 mm when printing, taken here as what a printer prints and a phone reads reliably. The same guidelines print a QR-bill's largest code, version 25, at 46 mm without its quiet zone, modules of 0.393 mm: a `qrCode` that size is refused, and a QR-bill's own code is drawn at SIX's size, not held to this floor (below). The message names the smallest square that text needs. |
| `content-too-large` | It is wider than where it stands, or taller than the body, as an image is. |
| `unsupported` | Its size is not a positive finite number, its level is not one of L, M, Q and H, or its text is not a string or holds half a surrogate pair. |

Empty text is drawn as what it is: a version 1 symbol of no data. ZXing,
which the tests read codes with, reports no code in it at all. Of the
runtime's documents, only a preview holds one: it refuses a final render
whose code has a value that is null, or prints nothing.

## EPC QR codes

An `epcQrCode` block's payload, which the runtime has written and held to
the EPC's rules, is encoded by uqr as UTF-8 at level M, its level never
raised (`boostEcc: false`), in a symbol of version 13 at most (EPC069-12
2.1), once, when the document is checked. The renderer formats and checks nothing of what the payload says;
it decides how the code is drawn. Why it is drawn so, and what that costs,
is [0025](../../docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md).

- **Without a caption** it is drawn exactly as a `qrCode` of its payload at
  level M is: the same square, quiet zone and modules, held to the same
  0.4 mm floor. The EPC gives no size, and no frame.
- **With `caption: 'zahlenMitCode'`** it is drawn as Austria's PSA prints
  one ("QR-Code und BCD Definition", version 3.0, section 5), inside its
  square: modules from 15 to 20 mil (0.381 to 0.508 mm); a frame half a
  module wide, its corners rounded by two modules, its inner edge four
  modules from the symbol on the left, above and below, and its outer edge
  on the square's left and right; and "Zahlen mit Code" at 7 pt in
  Liberation Sans, reading from bottom to top up the right side, beyond
  four modules and in a band of 7 pt, its baseline on the frame's right
  line, which runs along the band's outer edge and is broken a module
  beyond each end of the caption. The caption is centred on the
  symbol and no longer than it, and is text a reader finds. Down, the
  frame is the symbol and nine modules, and stands in the middle of the
  square's height.
- **The version.** Without a caption, the smallest that holds the payload.
  With one, the least whose modules are at most 20 mil and whose symbol is
  as tall as the caption, or the payload's own when that is larger: in a
  30 mm square, the EPC's first example, version 6, would have modules of
  0.556 mm, and is drawn in version 8 at 0.479 mm. A larger version of the
  same payload at the same level scans to the same bytes.
- **What the frame and the caption take.** In a 30 mm square (85.04 pt),
  measured on the PDF on 17 October 2026: across, 8.5 modules and the
  caption's 7 pt band, 18.54 pt, so that the symbol is 78.2 % of the side;
  down, nine modules, and 3.16 pt of the square white above the frame and
  below it.
- **At the corners** the PSA's own figure reaches into the quiet zone: a
  frame four modules from the symbol with corners rounded by two comes
  within 3.49 modules of both of the symbol's edges at each corner, 4.93
  from the corner straight, and so half a module into the square of four
  modules ISO/IEC 18004 keeps quiet. Along the sides the four are white.
- **The square that prints every payload**, up to version 13's 331 bytes,
  with the caption and without, is 32 mm (90.71 pt) or more: version 13's
  modules are 0.416 mm in it without the caption and 0.381 mm with it. A
  30 mm square refuses a payload past 287 bytes without the caption and
  past 251 with it. The builders' new code is 32 mm for this.

The EPC's and the PSA's rules the renderer refuses by are report-spec's,
handed on by the runtime (`EPC_MAX_BYTES`, `EPC_MAX_VERSION`, `epcModule`,
`EPC_FRAME`, `EPC_CAPTION`, `epcLeastVersion`, `epcCaptionBreak`); the 0.4
mm floor and a square wider than where it stands are the renderer's own,
as for every QR code. The caption's length, 51.36 pt, is its advance in
Liberation Sans, which a test holds to the PDF. A refusal names the code by its id and never quotes the payload:

| Code | When |
|---|---|
| `content-too-large` | A payload of more than 331 bytes: refused unencoded when it is longer than that in characters, and once the encoder finds no version up to 13 holds it otherwise. |
| `content-too-large` | Without a caption, modules smaller than 0.4 mm, the message naming the square the payload needs. |
| `content-too-large` | With the caption, a square in which no version prints, below 68.06 pt or above 118.6 pt, refused before encoding; or a payload whose version has modules under 15 mil in its square. |
| `content-too-large` | It is wider than where it stands, or taller than the body, as a QR code is. |
| `unsupported` | Its size is not a positive finite number, its caption is not one the renderer knows, or its payload is not a string or holds half a surrogate pair. |

pdfmake's SVG converter draws the caption, and where it cannot open a face
it warns and draws the text in the face it drew in last: the renderer
fails the render instead, as an engine's failure and not a refusal.

## QR-bills

A document's `paymentPart`, a Swiss QR-bill the runtime has resolved and
held to SIX's rules, is drawn as SIX's slip: the receipt and the payment
part, 210 by 105 mm across the foot of the report's last page. The numbers
are SIX's: its Swiss Implementation Guidelines for the QR-bill, version 2.4
("IG"), and its Style Guide, version 1.1 ("SG"). Why it is drawn so, and
what that costs, is [0022](../../docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md).

- **Where.** The slip spans the paper's width and ends at its foot (IG 3.1),
  whatever the page margins. It is the last page's footer, drawn there in
  place of the page footer; the page header is drawn as on every page. The
  body keeps the slip's room at its end: when the last page has less room
  left, the slip takes a page of its own, which the footers before it count.
- **The code.** The payload as UTF-8 at level M, in the smallest version
  that holds it and none past 25 (IG 6), 46 mm square without a quiet zone
  of its own, since the slip leaves 5 mm unprinted around it; and the Swiss
  cross over its centre, SIX's logo of 7 mm (IG 6.4.2): a white square of
  7 mm, a black one of 6 mm and a white cross, as schoero's generator draws
  it; manuelbl's draws the same black square and cross on modules it clears
  instead of a white square. It is not held to a `qrCode`'s 0.4 mm floor:
  at version 25 a module is 0.393 mm, at the size SIX prescribes.
- **The text.** In Liberation Sans, one of the four fonts SIX allows (IG
  3.4): the titles 11 pt bold; the receipt's headings 6 pt bold and its
  values 8 pt, a line every 9 pt; the payment part's 8 and 10 pt, every 11
  pt; a blank line between blocks; the amount 11 pt below its heading on
  the receipt and 13 pt in the payment part (SG 15). Each section stands
  where SG 6 puts it. The additional information is printed in the payment
  part alone (IG 3.6.2), and nothing the bill does not hold has a heading.
- **The blank fields.** A bill without an amount, or without a debtor, has
  fields for the payer's hand, marked by their corners, 3 mm arms of 0.75 pt:
  30 by 10 and 40 by 15 mm for the amount, 52 by 20 and 65 by 25 mm for the
  debtor (IG 3.5.3, 3.5.4; SG 7).
- **The lines it is cut along.** One across the paper at the slip's top and
  one between the receipt and the payment part, half a point, each with the
  mark IG 3.7 asks of a line: above the one across, the instruction to
  separate, in the slip's language, 8 pt, centred; on the one down, a
  scissors symbol, filled in black, 2.5 by 3 mm, from 5 mm below the
  slip's top, where the line is broken for it. It keeps inside the 5 mm
  left unprinted beside the line, and is drawn as paths, since Liberation
  Sans has no glyph for U+2702. Its size and place are manuelbl's
  generator's; the drawing is this package's own.

A bill is refused, naming `paymentPart` and the field, and never quoting a
value, which may be a name, an address or an account:

| Code | When |
|---|---|
| `unsupported` | A payment part of a kind the renderer does not know; a page that is not A4 in portrait; text that is not text, half of a surrogate pair in the payload, or a character Liberation Sans has no glyph for; an amount not written as the slip prints one, or outside report-spec's range, 0.01 to 999 999 999.99; a currency other than CHF and EUR; an address of more than three lines, additional information of more than two, or a value longer than 140 characters, the longest SIX allows. |
| `content-too-large` | A payload of more than 997 characters, refused unencoded, or whose UTF-8 is more than version 25 holds at level M, 997 bytes (IG 6.2); a page whose top margin, with the page header and the instruction to separate, reaches into the slip, by report-spec's `qrBillPageBreak`, and a top margin alone in the editor's words; information taller than its section, 56 mm on the receipt and 85 mm in the payment part (SG 6). |

What the slip does not do:

- **Shrink its text to fit.** SIX allows the payment part's values from 6 to
  10 pt. The slip prints them at the recommended sizes and refuses
  information taller than its section.
- **Print alternative procedures, an ultimate creditor, or a bill "not for
  payment".** The format holds none of them.
- **Decide SIX's rules again.** The runtime holds a bill to them once.
  Where the renderer refuses by one of them -- the page, the currencies,
  the amount's range and the longest value -- it is report-spec's own,
  handed on by the runtime (`QR_BILL_TOP`, `qrBillPageBreak`,
  `QR_BILL_CURRENCIES`, `checkQrBillAmount`,
  `MAX_QR_BILL_ADDITIONAL_INFORMATION`), and the slip is report-spec's
  `QR_BILL_SIZE` at `QR_BILL_TOP`. The renderer decides only what drawing
  decides: the lines an address and the additional information print,
  each section's height, an amount's printed form, and the code's 997.

## E-invoices

A document that carries an e-invoice, `document.eInvoice`, as
[0027](../../docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md) decides, is drawn as what an e-invoice is in
Germany: a PDF/A-3b that embeds the XML the runtime wrote, the hybrid
invoice whose XML is the invoice
([0031](../../docs/decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)), in either entry.

- **PDF/A-3b, for an e-invoice alone.** Its definition gets `version`
  1.7 and `subset` `PDF/A-3b`, so PDFKit writes the pdfaid identification,
  an sRGB output intent with its ICC profile, and the XMP. Level b is the
  one in reach: level a needs a structure tree pdfmake does not build, and
  PDFKit has no level u. Every other report is drawn as it was.
- **The file, changed in nothing.** On the final pass alone, through
  PDFKit's own document before it ends, `pdfa.ts` embeds the XML's UTF-8
  bytes as `factur-x.xml`, `text/xml`, related as `Alternative` -- the
  name, relationship and conformance level report-spec gives them
  (`FACTUR_X`, `FACTUR_X_PROFILES`, handed on by the runtime) [S] -- dated
  with the document's creation date, so the same document draws to the
  same bytes. The measuring passes have no file, and lay the pages out as
  the PDF prints them.
- **The XMP says what the file is.** The fx properties -- the file's
  name, the document type, the version and the conformance level -- and an
  extension schema that declares them are appended to PDFKit's XMP, the
  four descriptions in the renderer's own words.
- **A preview is a plain PDF.** The runtime writes the XML only in a final
  render; a preview carries none, embeds nothing, and is labelled on every
  page.
- **An XRechnung's copy is a plain PDF too**
  ([0038](../../docs/decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).
  An XRechnung's XML is the invoice, which a host takes from the resolved
  document and sends; its file, of the kind `xrechnung`, names its syntax,
  guideline and version and nothing to embed it as. Its document is drawn
  as every report is -- no PDF/A, no file, no XMP, a title of any text and
  a CMYK logo drawn -- and its page header opens with the runtime's
  `XRECHNUNG_COPY_PARAGRAPH`, `XRECHNUNG_COPY_LABEL` in small red bold,
  so every page says it is the copy. Never a ZUGFeRD hybrid of the
  XRECHNUNG profile.

It refuses, as `unsupported` and before pdfmake sees the document:

- an e-invoice of a kind it does not know, a Factur-X file without its
  kind among them; one whose XML is not text; a Factur-X file whose file
  name, conformance level or relationship is not report-spec's; and an
  XRechnung's whose syntax, version or guideline is not report-spec's;
- an XRechnung whose page header does not open with the copy's label as
  the runtime writes it, `XRECHNUNG_COPY_PARAGRAPH`, its style and all,
  naming `pageHeader`: a final picture of an invoice that says nothing of
  what it is, or says it in white or at one point, where PDF.js would
  still find the text. That the label names no font, and prints in the
  renderer's, and that the paper is white, the renderer drawing none, are
  what the check does not read;
- XML holding a lone surrogate, which an encoder would write as another
  character;
- a title holding `&`, `<`, `>` or a character XML 1.0 cannot write,
  naming `info.title`: PDFKit writes the title into the XMP unescaped.
  report-spec refuses such a title in an e-invoice report, so only a
  document made otherwise reaches this;
- a CMYK JPEG in a Factur-X invoice, naming the image: PDFKit draws it in
  DeviceCMYK, which no PDF/A with an sRGB output intent may hold. An
  XRechnung's copy, no PDF/A, draws it. A preview draws it, so a
  template finds out at its final render. The component count is read
  from the frame header PDFKit reads, since a DAC segment shaped as a frame
  of four components once had an RGB JPEG drawn in DeviceCMYK past this
  refusal (measured on 18 October 2026, veraPDF failing it on 6.2.4.3-3),
  and a JPEG PDFKit would read otherwise is refused as `invalid-asset` in
  every report (above);
- an SVG image whose numbers could pass the 2,147,483,647 a PDF/A-3 holds
  an integer to, or whose drawing svg-to-pdfkit nests more than 28
  graphics states deep, its limit (`svg-pdfa.ts`), naming the image and
  saying what to do. The converter writes a page-sized group's box and a
  gradient's matrix through the inverse of the drawing's transform and
  the box, a gradient's and a clip's in the box it measures on the
  outline, and an outline in points of its own, so a logo whose clip and
  transparency are shrunk a millionfold wrote a box of 78,520,000,000 a
  point square, an e-invoice that said it was a PDF/A and was not, which
  veraPDF 1.30.3 failed, and an arc whose radii the converter grows to
  reach its ends wrote control points of 5 × 10^17 at any size (measured
  on 18 October 2026). The renderer bounds every number the converter will
  write, from report-spec's extent of the drawing -- over every box inside
  a shape's, and the points the converter draws each outline with -- the
  image's box and fit and the page, the image anywhere on it, and refuses
  past `SVG_INTEGER_BOUND`: the integer less a margin of 5.7 % for
  rounding, derived from report-spec's bounds as its comment says.
  report-corpus's `SVG_BOUND`, its groups shrunk so, is drawn on A4 in
  `SVG_BOUND_SIDE`, 41.6 pt square, and refused a hundredth smaller; each
  of report-spec's invented exporter samples the cleaner accepts makes its
  page-sized groups under no shrink and nests five deep at most. The bound
  is not held for matrices built to cancel one another term by term, whose
  products floating point gets wrong.

Every other kind of image PDFKit embeds is drawn in an e-invoice:
report-corpus's `IMAGE_KINDS` -- grey and colour JPEGs, and PNGs of every
colour type, with alpha, a palette, its transparency or a colour key, at
1 and 16 bits, interlaced -- which the e-invoice gate has veraPDF and
Mustang judge in one. A colour key is drawn as PDFKit's PNG reader,
png-js 1.1.0, reads it, in every report since 0.1.0: a grey key by its
high byte, and an RGB key as twelve numbers where ISO 32000-1 asks two a
component, which a viewer may ignore; report-corpus's test pins both.

A refusal never quotes the XML, which holds names, accounts and VAT
identifiers. What it leaves as PDFKit 0.19.1 writes it, `src/pdfmake.test.ts`
pins: the embedded file's `/CheckSum` in 32 hexadecimal digits where ISO
32000-1 asks for 16 bytes, and one trailer `/ID` for two PDFs of one title
and creation date.

**One file besides the fonts.** PDFKit reads the output intent's profile
from its own `data/sRGB_IEC61966_2_1.icc` with `fs`, past pdfmake's access
policy, which governs only what pdfmake opens: a render of an e-invoice
reads that file and the fonts, and nothing else through
`fs.readFileSync`, which a test holds. A
host that bundles the Node entry puts the profile where the bundled
PDFKit's `__dirname` points, or every e-invoice render fails. The browser
entry's profile is the base64 copy in pdfmake's browser build, held to the
same bytes. The profile is the ICC's sRGB2014, which the dependency-licence
guard admits by its digest, with the ICC's licence sentence a review read
([0006](../../docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).

**What the tests show, and what they do not.** `src/e-invoice.test.ts`
reads each of the corpus's e-invoice samples back from its PDF with readers
that are not PDFKit -- the file with PDF.js and pdf-lib, the XMP with saxes
-- and `src/e-invoice-samples.test.ts` holds what the page prints to the XML
read out of the same PDF, and the XRechnung sample's copy to the XML its
document carries; `src/xrechnung.test.ts` reads the copy back as a plain
PDF that embeds nothing, the label first on every page of one that runs to
two. `src/svg-pdfa.test.ts` reads every number of an
SVG's e-invoice back with report-corpus's `readPdfNumbers`, content streams
included, which veraPDF does not read, and holds the bound to at least
every number each drawing's PDF writes. Whether a validator takes the PDF
is the e-invoice gate's: veraPDF and Mustang judge the samples' PDFs
there, an SVG at every bound among the variants, and nothing here. The fx namespace, prefix and properties rest on a
transcription of the specification, which no validator reads; the tests
compare them with the transcription's values, and say so.

## Fonts

Every report prints in **Roboto 3.014**, from pdfmake's own package, under
the SIL Open Font License 1.1, which allows embedding fonts in documents.
The dependency-licence guard reads that licence from the font files
themselves ([0006](../../docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
The browser entry's copy in `vfs_fonts.js` is base64 inside a script, which
the guard cannot read; a test holds it to the very bytes of those files.
Each PDF embeds the subset of each face it uses.

- `sans` is Roboto. **`serif` and `mono` are refused** as `unsupported`:
  pdfmake ships no serif or monospaced font, and printing one in Roboto would
  be a substitution nobody sees until they read the PDF. They need fonts
  whose licence the guard allows, and none is shipped yet.
- Bold is **Roboto Medium**, the heaviest face pdfmake ships, and italic is
  Roboto Italic.
- **Every character is held to the face it prints in**, read from the
  faces' own character maps, and one without a glyph is refused as
  `unsupported`, naming the block and the code point: pdfmake would print
  it as an empty box, and as U+0000 in the PDF's text. One font means no
  fallback: CJK, Hebrew, Arabic, Thai and emoji are refused, and so is an
  fr-FR amount, which Intl groups with a narrow no-break space (U+202F)
  that Roboto lacks. Swiss amounts, de-CH and fr-CH alike, print.

A QR-bill's slip and an EPC QR code's caption, and nothing else, print in
**Liberation Sans 2.1.5**, regular and bold, under the SIL Open Font
License 1.1: SIX allows Arial, Frutiger, Helvetica and Liberation Sans on a
slip, and Roboto is none of them; for "Zahlen mit Code" the PSA's figure
says "Font family Arial o.s. non-serifs". The package ships the two font
files in `fonts`, with their licence and authors, and the guard reads
their licence from the files. The browser
entry's copy is base64 in a chunk the build makes of them, held to their
bytes by a test. Both faces map every character SIX allows in a bill (IG
4.1.1), which a test holds too.

## What it does not do

- **Cancel inside a pass.** pdfmake measures, lays out and writes a
  document in one synchronous step. The render yields to the event loop
  between passes, so an abort from a timer or a closed request arrives, and
  it reads the signal before the first pass, between passes, and before the
  PDF is returned: a cancelled render resolves nothing, but a pass under way
  runs to its end. A host that must stop at once runs renders in a worker
  it can terminate.
- **Bound measuring by the page limit, always.** A body whose least height
  needs more pages than the limit is refused before pdfmake sees it; one
  that fits its least height and not its real one is measured whole first.
- **Break a word in a table cell.** A number or an identifier broken across
  lines reads as two, so a cell's word wider than its column is refused,
  and the template gives the column the width.
- **Keep a paragraph with the next block everywhere.** Not inside a
  keep-together block, a column or a page region, and not past the end of a
  framed section: a heading that ends a framed section is not kept with
  what follows it.
- **Refuse a spacer at the foot of a page.** One that does not fit what is
  left of a page moves to the next and starts there, without its space.
- **Measure page regions per page.** They are measured once, every page
  field printed as `maxPages`, so a region that wraps only for some page
  numbers is measured at its widest.
- **Draw an SVG as a browser does, compared.** That the PDF shows what a
  browser draws of the same cleaned drawing is held by report-spec's allow
  lists and by review; no browser's rendering is compared with the PDF.
- **Decode a JPEG's scan.** Its structure is checked, up to the scan, and a
  corrupt scan inside a well-formed JPEG reaches the PDF. A PNG's image data
  is inflated and checked; data with bytes after its zlib stream is refused,
  as the Compression Streams standard refuses it.
- **Mark a QR code's text as UTF-8.** uqr writes no ECI designator, and
  ISO/IEC 18004 reads byte mode as ISO/IEC 8859-1 unless one says
  otherwise, so a reader that keeps to that default reads an umlaut as two
  Latin-1 characters. ZXing, which the tests read codes with, reads them
  as UTF-8, as the tests show for umlauts, the euro sign and an emoji; what
  every phone does, nothing here shows.

## Tests

`pnpm --filter @formancy/report-render-pdf test` renders every fixture of
`@formancy/report-corpus` and proves each PDF with the corpus's checks, or
holds a refusal to the one the fixture allows
([0003](../../docs/decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
These are the tests decision 0005 names. Each block kind is read back from
the PDF it produced: its text and images with PDF.js, through the corpus's
reader, and its lines, rectangles, clips and text colours from the PDF's own
content streams (`src/testing/drawing.ts`), which PDF.js's text does not
show. A QR code is read as a scanner reads it: the page drawn by PDF.js and
decoded by ZXing (`readCodes` in the corpus), for its text, its bytes, its
level, its version and where it stands. `starters.test.ts` resolves the
starters with the runtime and proves their PDFs: plan 7's three swept
across page ends, the invoice down to its bill's code, decoded from the
page and asking for the total the page prints, and the euro invoice down
to its EPC QR code, decoded from the page, asking for that total and
standing beside the payment details it holds, each printed in plain
text. `samples.test.ts` does the same for the corpus's invoice samples,
the invoice in German, French, Italian and English: one page each, its
totals in its locale's format, its slip's headings in its language and in
no other's, and its code asking for the total it prints.
`euro-samples.test.ts` does it for the euro invoice's samples, the
starter and the invoice from Austria, France, Italy, Spain, the
Netherlands and Ireland: one page each, its totals as `Intl` formats its
locale at the rate the test states, its code decoded at level M asking
for the total it prints, with the payment details beside it, and
Austria's caption on the Austrian sample alone
([0028](../../docs/decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
Each of them, and `e-invoice-samples.test.ts` for the e-invoice samples'
PDF/A-3b, finds the firm's mark at the head of the page
(`src/testing/letterhead.ts`): one drawing in its blue at the margins'
corner, 15 mm square, in its two paints, with no image and no text beside
it or in the 12 pt under it; by the pixels, nothing of it past its box;
and the quotation's on its first page alone
([0032](../../docs/decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)).
`epc-qr-code.test.ts` proves EPC QR codes on their PDF: the EPC's
examples decoded byte for byte at level M, and 331 bytes in version 13;
the caption read back by PDF.js, its text, its turn, its face and its
length; the frame from the content stream; and the quiet zone, the
frame's line and the caption from the pixels. `qr-bill.test.ts` and
`qr-bill-pages.test.ts` prove a QR-bill's slip on its PDF: SIX's
examples, resolved by the runtime, decoded byte for byte; every heading
and value read back where SIX puts it, at its size and in its face; the
lines, the scissors on the line down, the corner marks and the cross from
the content stream, and the cross from the pixels too; and the page the
slip goes on.

`svg.test.ts` proves an SVG image on its PDF: no image embedded, a clip of
exactly its box with its paths inside it in its own colours, read by the
corpus's reader through the transparency groups a clip path draws into,
`contain`'s proportions, and from the pixels `cover` and a
root's transform painting nothing outside the box, each beside the same
drawing as it came, which does; and the budget at its bound and one past
it, an image in a page region counted on every page. `svg-threats.test.ts`
refuses each hazard svg-to-pdfkit meets in an SVG as it came -- a local
image, text, a style sheet, an entity, a `use` fan-out, a link -- before
pdfmake runs, and shows each guard behind the check hold without it; holds
the renderer's list of elements to report-spec's; and draws a drawing
shrunk, and a gradient composed, to the bound, where past it PDFKit threw
from inside pdfmake, refusing the drawing past it as `invalid-asset`.
`svg-converter.test.ts` draws every drawing the tests hold, and a thousand
seeded mutations of them the cleaner accepts, through the converter's
throwing callbacks; holds the worst drawing the bounds accept, rasterised
page-wide, to sixteen times a starter page rasterised in the same process;
and holds the converter's colour names to the cleaner's.
`pdfmake.test.ts` pins the converter as it is: the file it opens past the
access policy, the link it writes whatever its callbacks say, the drawing
xmldoc hands it, its warnings, its clip and the page-sized groups it draws
for every reference. Every SVG the renderer draws in these tests is held
to carrying no annotation.

`scripts/readme-pictures.ts` draws the repository README's pictures of the
starters and of both invoices' samples with PDF.js, and `pictures.test.ts`
holds each to the page it was drawn from: its lines and where each
starts, and its drawings, path by path:

```bash
pnpm --filter @formancy/report-render-pdf exec unrun scripts/readme-pictures.ts
```

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
