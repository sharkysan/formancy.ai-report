# 0075 — A QR-bill's slip is written into a Word file on a page of its own, the file's last, by SIX's geometry stated below both engines, and every line of it is shown to fit before a byte is written

- **Status:** accepted; numbered before [0076](0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md), which names it as held, and written after it, on that record's branch, while 0069 was held for a workbook's export, 0070 to 0073 by a branch not yet merged, and while [0074](0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md) and 0076, whose writer it builds on, were not yet merged; extends [0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md), whose writer refused a payment part as what SIX fixes to the foot of the last page: it writes one, on a page of the file's own, and an e-invoice and a labelled preview are refused as they were; [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), whose slip's places and sizes and whose refusals of a bill move from the PDF renderer to report-runtime, line for line, the PDF as it was; 0074, whose `swissSymbol` the slip's picture is drawn from; [0043](0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md), under which the PDF's slip keeps Liberation Sans, whose widths the writer states again; and [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), as 0068 extends it: a slip in a Word file is proved on the file, read back by a reader that is not its writer; extended by [0077](0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md), under which the header of the slip's page, empty for every other report, is the label of a copy where the document is a copy of an e-invoice
- **Date:** 2026-11-19
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The rules below both engines.** report-runtime's
    `src/bill-check.test.ts` holds `checkQrBill`, each refusal by its
    code, its subject and its words: a kind nobody knows, text that is no
    text, a value past 140 characters, an address of other than two or
    three lines, three lines of additional information, a currency SIX
    does not allow, an amount not written as a slip prints one or past
    SIX's range, a missing heading, a payload that is no text or of 998
    characters, a page of US Letter, one in landscape, a top margin that
    reaches into the slip; that what an engine's face does not draw is
    asked of every text, each heading in its own face, and refuses in the
    engine's words; and `slipBlocks`' order. The PDF renderer's
    `qr-bill.test.ts`, `qr-bill-pages.test.ts`, `refusals.test.ts` and
    its starters' tests pass on the moved code unchanged, and the PDFs of
    the invoice, of its three samples and of the payment reminder in its
    four languages were the same bytes before the move and after it,
    compared once by their SHA-256 on 19 November 2026. In CI the
    renderer's tests hold where each part of the slip is drawn, and the
    e-invoice gate's recording (`scripts/e-invoice/recorded/run.json`)
    holds the digest of the inflated objects of the invoice's and the
    payment reminder's PDF/A-2b, which `staleRecorded` fails a run for
    drawing otherwise; that gate needs Java and was not run for this
    change.
  - **The widths.** report-render-docx's `src/slip-widths.test.ts` reads
    the advances of both faces of the Liberation Sans 2.1.5 the PDF
    renderer ships, by a walk of the font's own tables that is the
    test's, and holds every width the writer states to them, with the
    ascender and the line; and holds the characters that have a width to
    being the ones report-spec's rule lets a bill hold, asked of the
    runtime for every code point up to U+024F and from U+2000 to U+20CF.
    That Arial's advances are the same was read once, on 19 November
    2026, from the Arial 7.07 of Windows 11 Pro 10.0.26200, for every
    character of the table in both faces, with its ascender and
    descender; no test holds it, since no gate has Arial.
  - **The writer, on the file it wrote.** `src/slip.test.ts` writes
    SIX's examples, the second in German, the third -- no amount, no
    debtor, no reference -- in each of the five languages, and a bill
    whose every value is as long as SIX allows in each of them, and holds
    each file by the corpus's `verifyDocx`; holds that no line of any of
    them is wider than its cell, and no line of the information wider
    than SIX's 52 and 87 mm, measured by the font's own tables and never
    by the writer's; that the slip's page names an empty header and an
    empty footer where the report prints them and none where it does not;
    that the page count's field is the file's; that the page is A4
    upright with no margin at its sides and foot whatever the report's
    margins; that the report's section is ended by the last paragraph
    its body holds, after a table the one that follows it, and that only
    a body of nothing is given a line for it; that every text stands on
    a line at least as tall as its face's own at its size, by the font's
    own ascender and descender; that Arial has its other name in a
    report that maps a font of its own; the same bytes twice; that the
    slip's paragraphs, and its page's empty header's and footer's, are
    counted with the file's, written at `MAX_DOCX_PARAGRAPHS` and refused
    one past it; that the corpus's check fails on a blank field's mark
    made heavier, given a third arm or moved, in what was read back; the
    code, scanned with the white the slip leaves around it, as its
    payload byte for byte at level M, from a picture of 600 pixels to
    the inch or more in whole pixels a module; the Swiss cross in the
    picture's pixels, point by point and by its area; how a value is
    broken; and each refusal that is the writer's own -- a character with
    no width, information taller than its section in each part, a title,
    a heading, the instruction and a heading of the information wider
    than its place -- with the longest values SIX allows written.
    `refusals.test.ts` holds the order: an e-invoice and a labelled
    preview before a payment part, and a payment part that is no bill
    last, once every block is right. `starters.test.ts` writes the
    invoice and the payment reminder, a final render and a preview, the
    reminder in its four languages.
  - **Both engines.** `src/slip-against-pdf.test.ts` holds a list of
    bills no engine draws to the same code, subject and sentence from the
    writer and from the PDF renderer; for every bill of the suite, the
    information's lines in the file to the lines PDF.js reads in the
    PDF's receipt and payment part, in order, but for billing
    information wider than a line, whose characters are held and whose
    lines are each engine's; the file's code to the code ZXing reads on
    the PDF's page, its text, bytes, level and version; and what the two
    refuse otherwise, a header that leaves the slip no room on the PDF's
    last page and a character SIX does not allow that Liberation Sans
    draws. `against-pdf.test.ts` holds every word of the invoice's and
    the payment reminder's file, the slip's among them, to the size and
    weight the PDF prints it at.
  - **The corpus's reader and check.** report-corpus's
    `src/docx/read-slip.test.ts` proves `readDocx` on a file of two
    sections written by hand (`src/docx/testing/hand-slip.ts`), and
    refuses a section ended in a cell, two ended before the last, a
    second with a header of its first page's own and a header that ends
    one. `src/check-docx-slip.test.ts` holds `verifyDocx` to passing that
    file and to failing on it with one thing of the slip written
    otherwise, a case each: the slip lower than 192 mm, a margin at a
    side and at the foot, a header in from the edge, another paper, no
    header of its own, a header that holds text, something after the
    slip, another instruction or one set to the left, other widths, a row
    of exactly its height or taller than 105 mm, no line between the two
    parts, a heavier line, the amount in an exact row, the information
    or the amount a section off, a line left out, a value at the
    heading's size, a heading light, another family, grey, a line the
    bill does not print, another message, the acceptance point to the
    left, a line by Word's own rule, space before a line, a code of
    another size or place, without its cross, with a quiet zone of its
    own, a pixel off, too coarse, mirrored, or of another payload; Arial
    without its other name; and a slip where the document has no bill,
    or none where it has. `check-docx.test.ts` holds `wordRefusal` to
    deriving none for a payment part.
  - **Validated against the schema, once, by hand, on 19 November
    2026**, and by no gate, as 0068 and 0076 validated their files:
    against ISO/IEC 29500-4:2016's transitional schemas, as Ecma
    publishes them with ECMA-376's fifth edition, Part 4, with libxml2
    2.13.9. Of every file named under *Not yet opened in Word*, 29, the
    `document.xml`, the `fontTable.xml` and each header's part, and of
    one more with a page header, a page footer and a body that ends in
    a table, those and both footers', 76 parts: none invalid. As
    controls, a font's `w:altName` after its `w:family`, a `w:sectPr`
    before a paragraph's `w:rPr`, and `w:ind` after `w:jc` were each
    refused. The independent review had validated the parts of eleven
    of the files as they were before its fixes, with the same controls.
    The schemas are another body's files and are not in the repository;
    no gate runs this.
  - **Seen failing in the review's fixes, on 19 November 2026.** Each
    case below was written first and failed: a 10 pt value on an 11 pt
    line passed `verifyDocx`, and every bill's file held text on a line
    shorter than its face's own; the code's paragraph on an exact line
    of 10 pt and under a mark of 40 pt passed; a paragraph of 40 pt
    after the slip passed; a body that ended in a table held two
    paragraphs after it, and one that ended in a paragraph an empty
    line more; a file whose report maps a font passed without Arial's
    other name; the slip's page's empty header and footer were counted
    by nothing, and a file was written a paragraph past the bound; and
    a value with two spaces at a break began its next line with one.
  - **Made to fail.** Each of these was broken once in the code and its
    test watched fail, then put back: a width typed wrong,
    the code two points lower, no value broken, no empty header, no
    cross, the row exactly its height, the slip uncounted, a section of
    any height, the slip a point lower, no break after a hyphen, Arial
    without its other name, marks of a point, a line of any width, the
    section ended by a line of two points, a value of any length and any
    currency in the runtime's rule, and the reader taking a section in a
    cell.
  - **The Studio and the install gate.** The Studio's `pipeline.test.ts`
    and `journey.test.tsx` name the invoice and the payment reminder as
    written, and the blank report once a QR-bill is added to it; its
    browser gate's `gate-word.mjs` reads each starter's Download Word
    with the corpus's reader and holds it byte for byte to the file the
    writer writes under Node. `scripts/install-fixture/docx.ts` writes
    the quotation as a bill from the packed packages, and reads with
    Node alone its two sections, the slip's page's margins, the account
    and the instruction as text, Arial's other name and a picture whose
    side is whole pixels a module of the packed runtime's `swissSymbol`;
    and refuses it in a currency SIX does not allow.
  - **Not yet opened in Word.** The files this change writes -- every
    starter and sample a bill pays, in each language it declares, and
    the bills of the tests, each beside its PDF, with a list of what each
    slip should show -- were written for the person who decides to open
    in Word before this change merges, as 0068 asks of a change to what
    the writer writes. When this record was written nobody had opened
    one. That Word prints the slip at the page's foot at its size, 210 by
    105 mm, its top 192 mm down; that it honours a top margin of 188 mm
    and none at the sides and foot, and what it says of them when it
    prints; that a line of an exact height and a row of a least height
    stand where the sum of the heights above them puts them, with a
    cell's top border taking no room; where in its line Word sets a
    baseline, and so whether a line exactly as tall as its face's own
    shows all of its ink; that a picture's line is as tall as the
    picture, where at single spacing Word may add the descent of the
    paragraph's mark, a point of the default face, some 0.2 to 0.3 pt,
    by which the amount under the code would stand 0.1 mm low; that no
    line is broken, in Arial and in Liberation Sans; that the empty
    paragraph after the slip and the empty footer start no second page,
    and the line a body of nothing is given none before it; that the corner marks of a blank field are drawn as marks; that
    the picture is drawn unsmoothed at 46 mm and a Swiss banking app
    reads it from the paper; and what the page count says: all of it is
    held by no test and was seen by nobody.

## Context

0068 wrote a report as a Word file and refused, whole, what belongs to
its PDF. Of a payment part it said that SIX fixes the slip to the
millimetre at the foot of the last page, where a Word file's pages are
Word's. It was then asked that a Word file hold all five of what was
refused -- "it should also add QR-bill, an EPC QR code, an e-invoice, a
chart and a QR code to word". 0074 wrote the two codes and 0076 the
chart. Asked where a QR-bill's slip goes in the file, the person who
decides chose a page of its own at the end of the file, over the foot of
the report's last page, where the PDF prints it. This is the slip. The
e-invoice (0077) is its own decision, and nothing of it is built here.

The forces. A Word file's last page is Word's to find: nothing in the
file says where the report ends on its page, so nothing can put a slip
at that page's foot. A page that holds the slip alone has no such
unknown. SIX fixes the slip's areas, its headings, its sizes and its
code (IG 3, SG 6, 7 and 15). A Word table whose row is of an exact
height cuts what does not fit it, silently, which this repository does
not do. The writer embeds no font and may not depend on the PDF
renderer, which has the slip's face. And the slip's places, its sizes
and what refuses a bill were decided in the PDF renderer alone (0022),
as a code's symbol was before 0074.

## Decision

**1. The page.** A report paid by a QR-bill is a Word file of two
sections. The report's is ended by the last paragraph its body holds --
after a table, the paragraph that follows one -- and only a body of
nothing is given an empty line a point tall for it: a paragraph more
would be a line more on the report's last page, and on a page full to
within a point a blank page before the slip. The slip's is the file's
last:
A4 upright whatever the report's page -- which the rule below both
engines already holds to A4 upright -- with no margin at its sides or its
foot, and a top margin that ends where the instruction to separate
begins, so that the page's first line is the instruction and the slip
starts at report-spec's `QR_BILL_TOP`, 192 mm down, with nothing above it
that could grow.

The slip's page prints neither the report's page header nor its footer.
A section that names none prints the one before it, so where the report
prints either, the slip's section names an empty one in its place,
`word/header3.xml` and `word/footer2.xml`. The writer measures nothing:
a header of unknown height above the slip would push it down its page,
and a footer would print into it.

The page counts. A report's page count is `NUMPAGES`, the file's pages,
as before, so a two-page invoice says "of 3" in a Word file. It is what
the PDF says of a slip that has a page to itself, which it counts.

The slip is cut along two lines, drawn as borders: the top of its three
cells, and the right of the receipt's. Above the line across stands the
bill's instruction to separate, the runtime's word in the render's
language, 8 pt and centred, as the PDF prints it. The line down bears no
scissors.

**2. The geometry, and no line Word may cut.** The slip is a table of one
row and three cells: the receipt, 62 mm; the payment part's title, code
and amount, 56 mm; and its information, 92 mm. In each cell every
paragraph is a line of an exact height or white of an exact height, each
stated in twentieths of a point and rounded once, so each stands where
the sum of what is above it puts it: the titles 5 mm down, the receipt's
information from 12 mm, the code from 17 mm, the amounts from 68 mm, the
acceptance point at 82 mm. A part's
amount section is a table of its own, since two texts stand on one line
at SIX's distances; a blank field is a table of three rows and columns
whose corner cells are bordered on their two outer sides, 3 mm arms of
0.75 pt.

No line is shorter than its face's own. A line of an exact height cuts
what reaches past it, and the face's line -- its ascender and its
descender, 2,288 of its 2,048 units -- is 11.17 pt at 10 pt, where SIX's
pitch for the payment part's values is 11: of SIX's characters, Ś, Č, Ž
and À reach 1,830 to 1,836 units up in Arial 7.07 and ĥ, ĺ and Ů 1,854
in Liberation Sans, with descenders to 431 below, by the review's
reading of both fonts' outlines, so "Śląska" has ink 11.07 pt tall. So a
line is SIX's pitch or the face's line at its size in
whole twentieths, whichever is taller: the payment part's values stand
on 11.2 pt, the amount's on 11.2 and the acceptance point's on 6.75; the
receipt's 8 pt on 9 holds its 8.94. A heading's baseline stays a pitch
above its first value's. Each part's fit is worked out with those lines.

No row that holds text is of an exact height. The slip's row and each
amount's are at least their section's height: a reader that set a line
wider than planned would break it and the row would grow, visibly, where
an exact row would cut it. That is the failure chosen; the geometry is
held another way. The writer leaves Word no line to break: each value is
broken by the writer, into lines no wider than SIX's section, each a
paragraph of its own; every other text is one line, held to the room its
place gives it; and each part's information is held to the height of its
section. What does not fit is refused, before a byte is written, never
cut and never set smaller. The information's lines have 5 mm more in
their cells than they are broken at.

The widths are stated in the writer, `slip-widths.ts`: Liberation Sans
2.1.5's advances for the characters SIX allows a bill, in both faces. A
value is broken at a space, which is then the break, after a hyphen that
no digit follows, and inside a word only where the word is wider than a
line alone.

**3. The face.** The slip is named in Arial, one of the four faces SIX
admits, which a reader with Word has, and the font table gives
Liberation Sans as its other name (`w:altName`), the face the PDF prints
the slip in and whose widths Arial's are. A reader with neither chooses
a face by the table's kind, swiss, and the widths are then that face's.
The file embeds no face, as before. An EPC QR code's caption (0074) is
named in the same Arial and gains the other name with it.

**4. The Swiss QR Code** is `swissSymbol`'s symbol as a picture, 46 mm a
side, a PNG of one bit a pixel in whole pixels a module, 600 to the inch
or more, with no quiet zone of its own -- the slip leaves 5 mm blank
around it, which the layout keeps -- and the Swiss cross drawn into its
pixels: a white square of 7 mm, a black one of 6 mm and the white cross,
each pixel by where its centre stands.

**5. The words** are the runtime's, every one: the headings in the
render's language (`QrBillHeadings`, which 0022 put there), the amount,
the currency, the reference, the addresses and the additional
information as `QrBill` hands them. Nothing moved for them. What moved
below both engines is what the PDF renderer alone decided: where each
part stands and at what size (`slip-print.ts`, from its `slip.ts` and
`qr.ts`) and what refuses a bill (`bill-check.ts`, from its `bill.ts`),
line for line. The renderer keeps what only it knows, the glyphs of the
face it embeds, and says of a text it cannot draw what it said before.

**6. What is refused.** An e-invoice and a labelled preview, as they
were, and before a payment part: an e-invoice paid by a QR-bill is
refused as the e-invoice it is. A bill is looked at last, once every
block and picture is right, where the PDF renderer looks at it. What the
rule below both engines refuses, the writer refuses in the PDF
renderer's words, the page among it: a report with a QR-bill is A4
upright in a Word file too, though its slip has a page of its own.
Information taller than its section is refused in the PDF renderer's
words. The writer's own refusals are two: a character with no width
here, as `unsupported`, and a text wider than its place on one line, as
`content-too-large`. What the PDF refuses of what it measured above the
slip is not the writer's.

**7. The proof** is the file's, as 0068, 0074 and 0076 have it:
`verifyDocx` holds the slip's page by the corpus's own reading of SIX's
numbers, ZXing reads the code from the picture's pixels with the white
the slip leaves around it, and the cross is found in the pixels.

## Consequences

A report paid by a QR-bill has a Word file: the invoice, its samples and
the payment reminder, in each language, and the Studio offers Download
Word for them. One slip is laid out by one set of numbers, and one rule
refuses a bill for both engines.

The costs.

- **The slip is not where the PDF prints it.** It is a page of its own,
  always, where the PDF prints it at the foot of the report's last page
  when it fits. A report's page count in a Word file is one more than
  its PDF's wherever the PDF's slip shared the last page, and the slip's
  page prints no header and no number, where a slip with a page to
  itself in the PDF prints the page header.
- **No scissors.** The line between the receipt and the payment part is
  a cell's border, which cannot be broken where the symbol stands, and
  the PDF's scissors are not drawn. IG 3.7 allows the instruction in the
  symbol's place and names it for the line across.
- **The lines are borders and the row is short.** The slip's row ends
  four points above the paper's foot, the room the paragraph that must
  follow a table and an empty footer take, so the line down the slip
  ends 1.4 mm above the edge. A border's own weight is in no sum here.
- **Zero margins.** The slip's page has none at its sides and foot.
  Word tells a person who prints it that margins lie outside the
  printable area; nobody here has seen what it then does.
- **The payment part's values are 11.2 pt apart, not SIX's 11.** A
  line of 11 pt would cut a hair of a tall accent over a descender, so
  each value of the payment part's information stands 0.2 pt lower than
  the PDF's for every value line above it. Measured on the suite's
  bills on 19 November 2026: SIX's examples hold 4 to 10 value lines
  and end 55.5 to 71.2 mm down their section of 90, their last line up
  to 2.0 pt lower than at 11 pt; the bill whose every value is as long
  as SIX allows holds 13 and ends at 83.1 mm, 2.6 pt lower, 0.9 mm.
  Every bill of the suite still fits. A bill within those few points of
  its section's height is refused as a Word file and printed as a PDF.
  The receipt's lines are the PDF's.
- **A baseline is Word's.** Where in an exact line Word sets the
  baseline is not stated by the file: a line exactly as tall as its
  face's own holds all of its ink only where Word sets the baseline the
  face's ascender below the line's top.
- **A picture's line is Word's.** The code's paragraph states no line,
  so that Word shows the picture whole, and the writer takes its line
  as the picture's height. At single spacing Word adds the descent of
  the paragraph's mark, a point of the default face: some 0.2 to 0.3
  pt, by which the amount section under the code would stand 0.1 mm
  low. An exact line there would show a strip of the code.
- **A reader with neither face.** Named in Arial with Liberation Sans as
  its other name, the slip is set in a face of the reader's choosing
  where it has neither. A line wider there than its cell is broken, its
  row grows and what is under it stands lower, perhaps on a second
  page. Nothing is cut, and nothing says so.
- **A value is broken by the writer.** Each line of a value is a
  paragraph of its own in the file: a person who copies an address
  copies its lines. The writer breaks at spaces and after hyphens, the
  PDF's engine by Unicode's rules with the face's kerning, so a value
  may break elsewhere in the PDF. Billing information wider than a line
  is filled line by line, where the PDF breaks it after its `//` first
  and prints a line more. A bill at the very height of its section may
  be refused by one engine and printed by the other.
- **Not every paragraph is where the PDF's is.** See the payment part's
  values above.
- **A point more after a blank field.** A blank debtor's field that
  ends a part's information must be followed by a paragraph, a point
  tall, where the PDF asks three eighths of a point.
- **SIX's characters alone.** A bill that prints a character SIX does
  not allow is refused by the writer, where the PDF draws what its face
  draws. The runtime resolves no such bill.
- **A report with a QR-bill is A4 upright**, in a Word file as in a
  PDF, by the one rule: the slip's own page would let another paper
  pass, and the rule is not asked twice.
- **Counted, not bounded apart.** A slip is one a file, of at most 997
  characters of payload and four blank fields: its paragraphs, its
  characters and its runs are counted with the file's
  (`MAX_DOCX_PARAGRAPHS`, `MAX_DOCX_CHARACTERS`, `MAX_DOCX_RUNS`), its
  one picture with no bound of its own. Measured on 19 November 2026 on
  an Intel Core i9-10900K shared with other work, under Node 24.21.0:
  the file of a bill whose every value is as long as SIX allows was
  written in 84 to 93 ms the first time in a process and in 41 to 43 ms
  thereafter, the median of ten, in each of three processes, its code's
  picture 1,105 pixels a side and 4,147 bytes; the slip with every field
  blank is 78 paragraphs of the file, with one more where the body
  holds nothing and one each for the empty header and footer of its
  page. A symbol of SIX's largest version
  was not timed: no bill the runtime resolves from the corpus reaches
  it.
- **Two transcriptions more.** The widths and the face's line are
  stated in the writer and in the renderer's font, held together by a
  test. `w:altName`, `w:ind`'s `w:right` and a section in a paragraph's
  properties are elements the writer did not write before: they stand
  where the corpus's vocabulary, transcribed from ECMA-376's schema,
  puts them. Validated once, by hand; see *Verified by*.
- **One refusal's sentence changed.** A payment part of a kind nobody
  knows is refused as one "a report does not know", where the PDF
  renderer said that "the renderer" did not know it: the Word writer
  throws it too. Its code and its subject are as they were.
- **A host's own Arial gains the other name.** A report that maps a
  font named Arial lists it in the font table already; where a slip or
  a caption is written, that entry is given Liberation Sans as its other
  name, as one the writer adds has it.
- **An encode each.** Each engine asks the runtime for the bill's
  symbol, as 0074 says of a code.
- **Not opened in Word.** See *Verified by*.

## Alternatives considered

- **The slip at the foot of the report's last page**, as the PDF prints
  it. Lost to the person's choice, and to this: nothing in a Word file
  says where the last page's body ends. A footer of the last page alone
  needs a section break the writer cannot place, and a floating frame
  anchored to the page's foot overlaps a body that reaches it, with
  nothing refused.
- **A row of exactly the slip's height.** It holds the geometry without
  help and cuts what does not fit: a line broken in a reader's own face
  would lose its last line with nothing saying so.
- **Let Word break the lines**, and bound how many it may make. Any
  bound that holds for a breaker nobody has read is twice the lines a
  width needs, and refuses bills the PDF prints on two lines.
- **Depend on the renderer for the face**, or embed it. The first
  carries pdfmake and ECharts into the writer for a table of numbers;
  the second is a face a Word file would have to carry and a licence
  question 0068 left closed.
- **Name Liberation Sans, with Arial as its other name.** Most readers
  with Word have Arial and not Liberation Sans, and would then rest on
  the other name being honoured.
- **The cross as a second picture over the code.** A drawing over
  another is an anchor nobody has seen Word place; pixels of the one
  picture are read back by the corpus.
- **The scissors as a picture on the line.** An inline picture stands
  beside a border, not on it, and breaking the border needs the row cut
  in three, which the cells' own stacks do not survive.
- **`SECTIONPAGES` for the count**, the report's pages alone. A field
  the writer did not write and no reader here was seen to work out; and
  the PDF counts a slip's own page.
- **Print the report's header on the slip's page**, as the PDF does on a
  slip's own page. Its height is unknown to a writer that measures
  nothing.
- **Move nothing, and state the slip's numbers again in the writer.**
  Two copies of SIX's geometry and of what refuses a bill, which no
  test could hold together on every bill.
- **Refuse a bill only for what the writer cannot write**, and let a
  report on US Letter have its slip on an A4 page. A report the editor
  refuses and the PDF refuses would then have a Word file.

## What follows

- The person who decides opens the files this change wrote in Word, and
  what Word does otherwise than this record says is a change to the
  writer or a cost here.
- The e-invoice as a labelled copy, 0077.
