# @formancy/report-render-docx

The Formancy Report Word writer: it writes a resolved report as a Word
file, a `.docx`, that a person can go on writing in, and refuses what
belongs to the report's PDF rather than leave it out. It takes the
renderer-neutral document `@formancy/report-runtime` resolves a report to,
with the approved asset bytes already in it, and never a database
connection, a file name or an address. Why it writes WordprocessingML
itself, what it writes block by block, and what it refuses and why, is
decision
[0068](../../docs/decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md).
No framework, no Node, no DOM and no network: ES2023's library and no
`@types/node`.

**Nobody has opened a file it wrote in Word yet.** What it writes is read
back in the tests by readers that are not the writer, and was validated
against ISO/IEC 29500-4:2016's transitional schema once, by hand; that
Word opens it, and what Word then does with it, is held by no test. 0068
says what was seen, and by whom, when somebody has.

## Write a report as a Word file

```ts
import { resolveReport } from '@formancy/report-runtime'
import { renderDocx, RenderRefusal } from '@formancy/report-render-docx'

const resolution = resolveReport(quotation, quotationData, { mode: 'final', images, creationDate: CREATED })
if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const file: Uint8Array = renderDocx(resolution.document)

let refusal: unknown
try {
  renderDocx(billed)
} catch (error) {
  refusal = error
}
```

Here `quotation` is a report, `quotationData` its data, `images` the
lookup that hands over its assets' bytes, `CREATED` the instant the host
fixes for the render, and `billed` the same quotation resolved with a
QR-bill. The install gate runs these lines from the packed package
(`scripts/install-fixture/docx.ts`).

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
- **A length is rounded to Word's unit**: a size to the half point, a
  rule's weight to the eighth, a length to the twentieth.
- **The file states no language**, since the resolved document carries no
  locale.

## What it refuses

Each as a `RenderRefusal`, whole, naming what it is about:

| What | Code |
|---|---|
| A payment part, an e-invoice of either kind, a preview the runtime labelled, a chart, a QR code and an EPC QR code: each belongs to the report's PDF | `unsupported` |
| A JPEG its Exif block turns or one of four components, an SVG that covers a box of other proportions than its own, and a table or a page break in a section with a border, a fill or padding: nobody has seen Word print them as the PDF does | `unsupported` |
| What no engine prints, by the PDF renderer's code and subject: a table in a columns block, a page break in a page region, a page field outside the page header and footer, a block or a style the document's types do not hold | `unsupported` |
| A `serif` or `mono` token the report maps no font to, a weight or a slant a mapped token has no face for, faces of different families under one token, and a character the mapped face does not draw or a report does not print | `unsupported` |
| What Word's units do not state: a rule or a border lighter than a quarter of a point or heavier than twelve; a rectangle, a column or a framed section under a fortieth of a point, and a picture drawn at under an English Metric Unit, which would be written with no width or no height | `unsupported` |
| A creation date that states no zone, or is no ISO 8601 date: it is another moment on another machine, and the same document would be another file there. One of a day or an hour no calendar has, which the platform reads as the date after it, and one of a year before 0001 or past 9999. `resolveReport` writes an instant with its zone | `unsupported` |
| A picture, a rectangle or fixed columns wider than where they stand; a picture, a rectangle or a spacer taller than the printable area; more than `MAX_DOCX_PARAGRAPHS` paragraphs, a table's cell being one and a rectangle or a section's frame two; `MAX_DOCX_CHARACTERS` characters of text, with what a font's family is written longer than `MAX_DOCX_FAMILY_LENGTH` characters in every run and paragraph; `MAX_DOCX_RUNS` runs, a page field being three, a cell one and each line ending in a text one more; `MAX_DOCX_PICTURES` pictures, each asset counted once, `MAX_DOCX_MEDIA_BYTES` of them as they are stored, or `MAX_DOCX_IMAGE_DATA` of image data, a PNG's scanlines as its header promises them and a JPEG's bytes, which is what the PDF renderer holds a render to | `content-too-large` |
| Bytes that are not the picture or the font they are declared as: a PNG whose image data is not one whole zlib stream of the scanlines its header promises, as zlib reads one, among them; an SVG that is not the drawing report-spec's `cleanSvg` writes; and a font whose family is more than `MAX_DOCX_FAMILY_LENGTH` characters, 31, which is what Word reads of a font's name | `invalid-asset` |

So a report that is paid by a code, is an invoice in law or draws a chart
has no Word file, and neither has a preview of incomplete data: print
those as PDFs. And the writer measures nothing, so what the PDF renderer
refuses for what it measured -- a block taller than a page's body, more
pages than a host allows -- the writer writes. A host that offers the
Word file only beside a PDF that was drawn, as the Studio does, hands a
person nothing the renderer refused.

The bounds are measured, in `src/limits.ts`, but the pictures' count,
which is chosen far under what a zip's directory counts, their image
data's, which is the PDF renderer's, and the family's, which is what
Microsoft says Word reads: a file at them was written in 2.0 to 3.3
seconds and 0.7 to 1.1 GB, for the shapes that were looked for, on the
machine and the day that file names.

It depends on `@formancy/report-runtime`, on `fflate` at exactly 0.8.3,
which zips the parts, and on `pako` at exactly 3.0.2, which inflates a
PNG's image data, as zlib does, to hold it to its header. The package
declares the source-available licence, in `LICENSE.md`.
