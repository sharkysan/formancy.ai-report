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

## Node and the browser

| Entry | pdfmake | Fonts |
|---|---|---|
| `@formancy/report-render-pdf` | the Node build | the four Roboto files in pdfmake's package, read from disk |
| `@formancy/report-render-pdf/browser` | the browser build, `pdfmake/build/pdfmake.js` | the same Roboto, from pdfmake's `build/vfs_fonts.js` |

The two entries share everything but the build of pdfmake and where the
fonts come from: the checks, the measuring passes and the document
definitions are one module both import. The browser entry touches no file
system and imports no `node:` module.

What the tests show about the browser entry, run in Node: for every fixture
in the corpus it hands pdfmake the definitions the Node entry does, its PDFs
pass the corpus's checks, it places every run and image where the Node entry
does, and it reaches no Node module. What they do not show is the browser
build in a browser. That is the Studio's browser gate's to check, and it
does not exist yet.

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
  the size it is shown at, after its Exif orientation.
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

## What it refuses

| Code | When |
|---|---|
| `too-many-pages` | The report needs more pages than `maxPages`. pdfmake's own limit would return the first pages as though they were all of it. A body whose least height already needs more is refused before pdfmake measures it. |
| `content-too-large` | Something no page can hold: a keep-together block, an image, a QR code, a rectangle, a rule, a frame's border and padding, or a line of text taller than the body where it stands; anything wider than where it stands; a word in a table cell wider than its column, or a word in a paragraph longer than 16 lines of it; images holding more than 268,443,648 bytes of image data together; page regions that leave no body; a QR code's text that no version holds at its level, or a square too small for that version's modules to be 0.4 mm, the message naming the size it needs. |
| `invalid-asset` | An image's bytes are not the PNG or JPEG they are declared as, are cut off, or are past the limits: 20 MB, 4096 pixels a side. |
| `cancelled` | The signal was aborted. |
| `unsupported` | What the renderer cannot draw as written: a character the font has no glyph for, a font other than `sans`, text that is not a string, a colour that is not `#rrggbb` in lower case, a QR code's level other than L, M, Q and H, half of a surrogate pair without the other in a code's text, which has no UTF-8, a page field outside the page header and footer, a page break inside a page region, a keep-together block or a column, a table inside a column, a table row of the wrong number of cells, a block kind, page size or page field it does not know, blocks nested past 16 deep. |

## QR codes

A code is refused, naming it by its id, rather than drawn as one that may
not scan:

| Code | When |
|---|---|
| `content-too-large` | Its text is longer than any QR code holds at its level: in byte mode, 2953 bytes at L down to 1273 at H (ISO/IEC 18004, table 7). Past 7089 characters, the digits version 40 holds at L and the most any code holds, it is refused unencoded; a character is a code point, an emoji one. |
| `content-too-large` | Its modules would be smaller than **0.4 mm**. ISO/IEC 18004 leaves the module size to the application; SIX's Swiss Implementation Guidelines for the QR-bill, version 2.3, section 6.3, require 0.4 mm when printing, taken here as what a printer prints and a phone reads reliably. The same guidelines print a QR-bill's largest code, version 25, at 46 mm without its quiet zone, modules of 0.393 mm: here it is refused. The message names the smallest square that text needs. |
| `content-too-large` | It is wider than where it stands, or taller than the body, as an image is. |
| `unsupported` | Its size is not a positive finite number, its level is not one of L, M, Q and H, or its text is not a string or holds half a surrogate pair. |

Empty text is drawn as what it is: a version 1 symbol of no data. ZXing,
which the tests read codes with, reports no code in it at all. Of the
runtime's documents, only a preview holds one: it refuses a final render
whose code has a value that is null, or prints nothing.

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
three starters with the runtime and proves their PDFs, swept across page
ends.

`scripts/readme-pictures.ts` draws the repository README's pictures of the
starters with PDF.js, and `pictures.test.ts` holds each to the text of the
page it was drawn from:

```bash
pnpm --filter @formancy/report-render-pdf exec unrun scripts/readme-pictures.ts
```

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
