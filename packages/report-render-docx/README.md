# @formancy/report-render-docx

The Formancy Report Word writer: it writes a resolved report as a Word
file, a `.docx`, that a person can go on writing in, and refuses what
belongs to the report's PDF rather than leave it out. It takes the
renderer-neutral document `@formancy/report-runtime` resolves a report to,
with the approved asset bytes already in it, and never a database
connection, a file name or an address. Why it writes WordprocessingML
itself, what it writes block by block, and what it refuses and why, is
decision
[0068](../../docs/decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md),
how it writes a QR code and an EPC QR code
[0074](../../docs/decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md),
how it writes a chart
[0076](../../docs/decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md),
how it writes a QR-bill's slip
[0075](../../docs/decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md),
and how it writes a report that carries an e-invoice
[0077](../../docs/decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md).
No framework, no Node, no DOM and no network: ES2023's library and no
`@types/node`.

**Word has opened its files once, by hand, and no test does.** What it
writes is read back in the tests by readers that are not the writer, and
was validated against ISO/IEC 29500-4:2016's transitional schema once, by
hand; the files of the starters and the corpus's fixtures were opened in
Word once, before it merged, and found fine. What Word does with a file
is held by no test, and 0068 says what was seen. The files with a QR
code or an EPC QR code, which the writer writes since 0074, were opened
in Word once, by hand, on 20 November 2026, and 0074 says what was seen.
The files with a chart, which it writes since 0076 as Word's own chart,
were opened in Word once, by hand, the same day, and 0076 says what was
seen; everything Word lays out of one -- where a word stands, what the
value axis says -- is held by no test. The files with a QR-bill's
slip, which it writes since 0075 on a page of its own, were opened in
Word once, by hand, the same day, and 0075 says what was seen;
everything Word prints of the page -- where the slip stands, its lines,
its code -- is held by no test.
A copy of an e-invoice, which it writes since 0077, nobody had
opened in Word when that record was written, and it says so; that
Word prints the label on every page is unseen.

## Write a report as a Word file

```ts
import { resolveReport } from '@formancy/report-runtime'
import { renderDocx, RenderRefusal } from '@formancy/report-render-docx'

const resolution = resolveReport(quotation, quotationData, { mode: 'final', images, creationDate: CREATED })
if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const file: Uint8Array = renderDocx(resolution.document)

let refusal: unknown
try {
  renderDocx(unpayable)
} catch (error) {
  refusal = error
}
```

Here `quotation` is a report, `quotationData` its data, `images` the
lookup that hands over its assets' bytes, `CREATED` the instant the host
fixes for the render, and `unpayable` the same quotation resolved with a
QR-bill and then given a currency SIX does not allow, which no runtime
resolves. The install gate runs these lines from the packed package
(`scripts/install-fixture/docx.ts`), and writes the quotation with its
QR-bill too, its slip the file's last page.

`renderDocx` returns the file's bytes, or throws a `RenderRefusal` and
returns nothing: `refusal` above is one, its `code` `unsupported` and its
`subject` `paymentPart`. A refusal is decided before a byte is written,
and its message says what stopped the file and what to do. Anything else
it throws is a fault of the writer's. It is synchronous and takes no
option and no signal: it counts no page, so there is no page limit to
pass, and a host that must stop one runs it in a worker. The package
hands on the runtime's `RenderRefusal`, `REFUSAL_CODES` and their types,
so a caller catches what it throws without importing the runtime.

**The same document is the same bytes**, in any Node process and any time
zone: every entry of the zip is dated 1 January 1980, the creation date is
the document's own (`info.creationDate`), and nothing reads the clock.
The Studio's browser gate holds the file a person downloads in Chromium to
the bytes the writer gives under Node.

## What the file says, and what is Word's

The file says what the document says: every word in its order, every
table's cells, each run's family, size, weight, slant and colour, each
picture's very bytes, the paper, its margins and its regions. The header
row is marked as the one to repeat and the rows the PDF keeps on a page
are marked as kept; a page's number and count are Word's `PAGE` and
`NUMPAGES` fields, written without a stored result; page 1's own header
is Word's different first page.

Where a line and a page break, how many pages there are, whether Word
repeats and keeps what is marked, and the face where the reader lacks the
family, are Word's. The file is not the PDF in another container, and no
test claims it prints as the PDF does.

- **Fonts are named, never embedded.** A font token the report maps is
  named by its normal face's family, name ID 1, the one Word lists a face
  under; `sans` unmapped is Roboto, which few machines have, so Word
  chooses a sans face of its own there. Bold and italic are Word's of
  that family.
- **An SVG is the asset's own drawing**, as an `svgBlip`, an extension
  Microsoft's Open XML SDK lists as Office 2019's; a reader that does not
  know it shows a grey box in its place.
- **A QR code and an EPC QR code are pictures of their symbols**, the
  symbol the PDF draws, which `@formancy/report-runtime` decides for
  both: a PNG the writer makes, black on white, whole pixels a module,
  its quiet zone inside it, in a paragraph of its own exactly the code's
  size. It is 600 pixels to the inch at that size, in the fewest whole
  pixels a module that are, and never more pixels a module than 2,400 a
  side hold: so a code wider than 266 to 288 points, by its symbol's
  version, is drawn coarser, the largest symbol at 269 to the inch
  where it is 595 points wide. An
  EPC QR code in Austria's frame is a table of one row, at least the
  frame's height: its picture, in a cell the frame's line borders on
  each side, and beside it, outside the line, "Zahlen mit Code", which
  reads from bottom to top at 7 pt in Arial. The cell's borders are the
  frame, so its corners are square and its right line whole, the
  caption beside it, where the PDF rounds the corners and runs the line
  along the words, broken around them. A code is a raster here and
  vectors in the PDF. Of what Word prints, the frame of the euro invoice
  from Austria alone has been seen: written first around the picture
  and the caption, with a row of an exact height, it lost its right
  line and the white under the code, and it is now written as the
  variant approved in Word on 20 November 2026.
- **A chart is Word's own chart**, a part of the file
  (`word/charts/chartN.xml`) that the body draws inline in exactly the
  chart's box, written from the runtime's block alone. Its data are
  literals in that part: the file holds no workbook, the part has no
  relationship and names no cell, and "Edit Data" has nothing to open.
  Each value is the report's digits, never read as a JavaScript number,
  and the value axis is the report's ticks, its ends and its step
  stated. The title, the axes' titles, the categories, the legend and
  each value's label are the runtime's text, a pie's shares in its
  legend's entries; the value axis's labels alone are Word's, at the
  places and with the grouping the ticks print, in the reader's own
  separators with no currency or unit. Every colour is
  the report's and every word's face is stated. Where a word stands is
  Word's, as lines and pages are: the PDF refuses a chart whose words
  would meet, and the Word file of it is written. Word reads the numbers
  as doubles to draw. A chart with nothing to draw is its title and its
  empty text in a cell at least as tall as its box. What Word draws of a
  chart was seen once, by hand, on 20 November 2026: each chart in its
  place, its values, colours and order as the PDF's, and the sales
  report's value axis grouped, `20’000.00` on Swiss settings.
- **A QR-bill's slip is a page of its own**, the file's last, in a
  section of its own: A4 upright with no margin at its sides and foot,
  the slip 192 mm down, the instruction to separate above its top line,
  and neither the report's page header nor its footer, so the file is a
  page longer than the PDF wherever the PDF's slip shares the last page,
  and a page count counts it. The slip is a table of one row and three
  cells, its lines borders -- the line between the receipt and the
  payment part bears no scissors -- in which every line is of an exact
  height, so that each section stands where SIX puts it, none shorter
  than its face's own, which would cut ink -- the payment part's values
  stand 11.2 pt apart, where SIX's pitch and the PDF's is 11 -- and no
  row that holds text is exact: the writer breaks each value into its lines and holds
  every line to the width of its place by Liberation Sans's widths,
  which Arial's are, and refuses a bill whose lines do not fit. It is
  named in Arial, with Liberation Sans as its other name in the font
  table; a reader with neither sets it in a face of other widths, where
  a line may break and move what is under it. The Swiss QR Code is a
  picture of 46 mm, whole pixels a module, the Swiss cross in its
  pixels. What Word prints of the page was seen once, by hand, on 20
  November 2026: the slip alone on the last page, at its foot, and its
  code readable.
- **A length is rounded to Word's unit**: a size to the half point, a
  rule's weight to the eighth, a length to the twentieth.
- **The file states no language**, since the resolved document carries no
  locale.

## What it refuses

Each as a `RenderRefusal`, whole, naming what it is about:

| What | Code |
|---|---|
| A document that carries an e-invoice of either kind, which is the invoice and belongs to its PDF: a Word file is written of its copy, and the sentence says how to ask for it. A preview the runtime labelled. And an XRechnung's PDF copy with its XML taken off, whose page header or page 1's own opens with the label that says "this PDF" is not the invoice | `unsupported` |
| A document labelled as a copy of an e-invoice otherwise than on every header: the label printed otherwise than the runtime writes it, in white or at one point; page 1's own header without it, or with another; a label on page 1's own header alone | `unsupported` |
| A QR-bill no engine draws, in the words the PDF renderer refuses it in: a kind nobody knows, a page that is not A4 upright, text that is not text, an amount or a currency SIX does not print, more lines than a slip prints; and a character SIX does not allow a bill, which has no width to show its line to fit by | `unsupported` |
| And of a QR-bill: information taller than its section, in the PDF renderer's words, a heading, a currency or an amount wider than its place on one line, a payload past SIX's 997 characters, and a top margin that reaches into the slip | `content-too-large` |
| A chart no engine prints, by the PDF renderer's code, naming the chart: in a page region, of a kind or a size no report knows, past the runtime's bounds, with parts that do not match, a word that is no text a chart prints, a tick's among them, or numbers that are no axis and no shares | `unsupported`, and `content-too-large` past `MAX_CHART_CATEGORIES` |
| A JPEG its Exif block turns or one of four components, an SVG that covers a box of other proportions than its own, and a table or a page break in a section with a border, a fill or padding: nobody has seen Word print them as the PDF does | `unsupported` |
| What no engine prints, by the PDF renderer's code and subject: a table in a columns block, a page break in a page region, a page field outside the page header and footer, a block or a style the document's types do not hold | `unsupported` |
| A QR code or an EPC QR code the runtime's rule refuses, in the words the PDF renderer refuses it in: a square of no size, a level, a caption or text no encoder draws | `unsupported` |
| And of a code: a square wider than where it stands, text or a payload no symbol holds, modules finer than 0.4 mm, or outside the PSA's 15 to 20 mil in Austria's frame | `content-too-large` |
| A `serif` or `mono` token the report maps no font to, a weight or a slant a mapped token has no face for, faces of different families under one token, and a character the mapped face does not draw or a report does not print | `unsupported` |
| What Word's units do not state: a rule or a border lighter than a quarter of a point or heavier than twelve; a rectangle, a column or a framed section under a fortieth of a point, and a picture drawn at under an English Metric Unit, which would be written with no width or no height | `unsupported` |
| A creation date that states no zone, or is no ISO 8601 date: it is another moment on another machine, and the same document would be another file there. One of a day or an hour no calendar has, which the platform reads as the date after it, and one of a year before 0001 or past 9999. `resolveReport` writes an instant with its zone | `unsupported` |
| A picture, a chart, a rectangle or fixed columns wider than where they stand; a picture, a code, a chart, a rectangle or a spacer taller than the printable area; more than `MAX_DOCX_CODES` codes, 64, or codes whose symbols hold more than `MAX_DOCX_CODE_MODULES` modules between them, what sixteen of the largest symbol hold; more than `MAX_DOCX_CHARTS` charts, 64, charts of more than `MAX_DOCX_CHART_POINTS` points between them, 25,600, what sixteen of the largest chart hold, or a chart's number written in more than `MAX_DOCX_CHART_DIGITS` characters, 330; more than `MAX_DOCX_PARAGRAPHS` paragraphs, a table's cell being one and a rectangle or a section's frame two; `MAX_DOCX_CHARACTERS` characters of text, with what a font's family is written longer than `MAX_DOCX_FAMILY_LENGTH` characters in every run and paragraph; `MAX_DOCX_RUNS` runs, a page field being three, a cell one and each line ending in a text one more; `MAX_DOCX_PICTURES` pictures, each asset counted once, `MAX_DOCX_MEDIA_BYTES` of them as they are stored, or `MAX_DOCX_IMAGE_DATA` of image data, a PNG's scanlines as its header promises them and a JPEG's bytes, which is what the PDF renderer holds a render to | `content-too-large` |
| Bytes that are not the picture or the font they are declared as: a PNG whose image data is not one whole zlib stream of the scanlines its header promises, as zlib reads one, among them; an SVG that is not the drawing report-spec's `cleanSvg` writes; and a font whose family is more than `MAX_DOCX_FAMILY_LENGTH` characters, 31, which is what Word reads of a font's name | `invalid-asset` |

So a preview of incomplete data has no Word file, and neither has the
document that is an invoice in law: print those as PDFs. A report that
carries an e-invoice has one all the same, written of its copy:

```ts
const copy = resolveReport(invoice, data, { mode: 'final', eInvoice: 'copy', creationDate: CREATED })
if (copy.ok) renderDocx(copy.document) // the invoice's page, labelled on every page as a copy that is not the invoice
```

The runtime labels the copy, in the render's language, at the top of the
page header and of page 1's own, and hands it on with no XML; the writer
holds every header to that label and writes it once more as the header
of a QR-bill's slip's page, which is a section of the file's own. The
file embeds nothing: the e-invoice is still the Factur-X PDF/A-3b, or
the XRechnung's XML, from the render without the option. A person may
change a copy, its label and its totals among it, and nothing ties it to
the XML afterwards: that is the cost, and why every page says what it
is. The file says so only of a document the runtime resolved as a copy:
a Factur-X's final render whose XML a host takes off carries no label
and is written as any report, and an XRechnung's, labelled as its PDF,
is refused. A report paid by a
QR-bill has one, its slip on a page of its own at the end. A chart is in the file, as Word's own chart: its data in the
file's own part and no workbook, so "Edit Data" has nothing to open; its
values the report's digits and its words the runtime's, but the value
axis's labels, which Word writes from the numbers; and its layout
Word's, so a chart the PDF refuses because its words would meet is
written all the same. And the writer measures nothing, so what the PDF renderer
refuses for what it measured -- a block taller than a page's body, more
pages than a host allows -- the writer writes. A host that offers the
Word file only beside a PDF that was drawn, as the Studio does, hands a
person nothing the renderer refused.

The bounds are measured, in `src/limits.ts`, but the pictures' count,
which is chosen far under what a zip's directory counts, their image
data's, which is the PDF renderer's, and the family's, which is what
Microsoft says Word reads. A file at them was written in up to 3.3
seconds, in up to 767 MB of resident memory where its text is of
characters up to U+00FF, and up to 1,019 MB where one character of it is
past that, a euro sign: V8 then holds the text two bytes a character
while the file is built. And V8 takes one of two amounts for one and the
same file, by what the process did before the write: the most that was
found is 1,272 MB, in a process that held a string beside each row of
the document, as a host holds its data's rows. Those are the files that
were looked for, on the machine and the day `src/limits.ts` names, which
also says why `MAX_DOCX_PARAGRAPHS` is 70,000: a report of 70,000 detail
rows in a table of one column, or of 10,000 in one of seven, is refused,
though the runtime reads 100,000.
A host that must stop a write runs it in a worker, and one that must
bound its memory in a process of its own.

A file's codes are bounded twice, since the largest symbol takes the
encoder some sixty times what the smallest takes: by their count, and by
the modules of their symbols. Measured on 18 November 2026 on that
machine, a document of codes alone: 64 of the EPC's 331 bytes in
Austria's frame were written in 0.5 to 0.6 seconds, 64 of version 1 at
the largest size a page holds in 0.8 to 0.9, sixteen of the largest
symbol in 0.7 to 0.8, and fifteen of them with 49 small ones in 0.9 to
1.6, each in under 215 MB; 64 of the largest, which the modules' bound
now refuses, had held the thread 2.6 to 3.2 seconds.

It depends on `@formancy/report-runtime`, which decides a code's symbol,
on `fflate` at exactly 0.8.3, which zips the parts and deflates a code's
picture, and on `pako` at exactly 3.0.2, which inflates a PNG's image
data, as zlib does, to hold it to its header. The package
declares the source-available licence, in `LICENSE.md`.
