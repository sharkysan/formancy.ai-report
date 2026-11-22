# 0077 — A report that carries an e-invoice is written into a Word file as the copy the runtime resolves and labels, which says on every page, in the render's language, that it is not the invoice, and which carries no XML

- **Status:** accepted; the last of the four records 0074 named, written on the branch of [0075](0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md) while 0069 was held for a workbook's export, 0070 to 0073 by a branch not yet merged, and while [0074](0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md), [0076](0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md) and 0075, whose writer it builds on, were not yet merged; extends [0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md), whose writer refused every report that carries an e-invoice: the invoice's own document is refused as it was, and a Word file is written of its copy; [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose `resolveReport` takes one option more; [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md), whose way of labelling -- the runtime writes the paragraph, an engine holds a document to it -- is the copy's; [0057](0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md), whose `pdfa-check.ts` refuses a copy as a PDF/A-2b beside a preview; [0063](0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md), under which the label is in the render's language; [0065](0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md), whose Preview's Download Word of a final render of an e-invoice now gives a file; 0075, whose slip's page prints the label as its header where the document is a copy; and [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), as 0068 extends it: a copy in a Word file is proved on the file, read back by a reader that is not its writer
- **Date:** 2026-11-19
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The runtime, which labels.** report-runtime's
    `src/e-invoice-copy.test.ts` holds that a final render asked for as
    `eInvoice: 'copy'` opens the page header, and page 1's own where the
    report has one, each with a paragraph of its own that is the label of
    its kind in the render's language; that an XRechnung's copy carries
    that label in the place of its PDF's and never both; that the copy
    carries no `eInvoice` and is the final render in everything else;
    that its manifest says `copy`; that it is refused where the invoice
    is refused, by the same errors, of a preview, as any other value of
    the option, and in a language no label is written in, at the locale;
    that the option says nothing of a report without an e-invoice, in a
    final render and in a preview; that a report written in a second
    language (0063) and rendered in it is labelled in that language, and
    refused at that translation's locale where it is one no label is
    written in; every label, word for word, French's colon set off by a
    space that does not break, each
    found by a locale's first subtag and none by `constructor`; that the
    paragraphs are frozen and in the style every label of the runtime is
    printed in; and `readCopyLabel`: the label a header opens with, none
    under another block or among other runs, and the words printed in
    white, at one point, light, slanted, without a style or with a
    property the runtime does not write found and said not to be as
    written.
  - **The writer, on the file it wrote.** report-render-docx's
    `src/copy.test.ts` writes the copy of every e-invoice sample of the
    corpus, the four Factur-X and the XRechnung, in each language each
    declares, and holds each file by the corpus's `verifyDocx` -- its
    lines and its totals as any report's, and the label on every header
    the file states, at 8 pt, bold and in its red; that every part of the
    file is one a report's file has and none holds the root element of
    the invoice's XML, which the invoice's own document does; that the
    invoice itself is refused, naming `eInvoice` and the option that
    asks for the copy, and its preview, naming `pageHeader`; the same
    bytes twice; a copy under each label, with a header of
    page 1's own; the copy the runtime resolves of each starter with a
    header of page 1's own, empty and of the report's own words, and of
    the Factur-X sample paid by a QR-bill too, each held by `verifyDocx`
    and opening every header the file states with the label; a copy
    paid by a QR-bill, whose slip's page's header
    is the label alone, 5 mm down and 5 mm in, its top margin the one of
    a report that is no copy; that label counted with the file's
    paragraphs, as the one 0075 counts for that header, and its words
    with the file's characters, written at each bound and refused one
    past it;
    each refusal of a document labelled otherwise than on every header,
    by its subject and its sentence and as the corpus derives it; an
    XRechnung's final render with its XML taken off, and a document
    that opens either header with its PDF's label in any style, refused
    as its PDF copy, naming the header; the
    order, after the e-invoice and before any block; and that a report
    which only quotes the label is written and is no copy.
    `refusals.test.ts` holds the sentences of the e-invoice's refusals,
    and `starters.test.ts` each e-invoice starter three ways: its final
    render refused for its e-invoice, its preview for its label, and its
    copy written.
  - **Both engines.** `src/against-pdf.test.ts` holds every word of the
    copy of each e-invoice starter to the size, weight and slant the PDF
    of that same document prints it at, the body's as every starter's;
    the label's words, as the Word file's page header states them, to
    the words the PDF of the same copy prints anywhere on its pages; the EPC
    QR code each copy is paid by, to the code ZXing reads on that PDF;
    and that the PDF drawn of a copy embeds nothing. report-render-pdf's
    `src/pdfa-check.test.ts` holds that the renderer draws a copy of
    either kind as a plain PDF that embeds nothing, and refuses it as a
    PDF/A-2b, naming `pageHeader`, before pdfmake is handed anything, and
    a document labelled as a copy on page 1's own header alone, naming
    `firstPageHeader`.
  - **The corpus's check.** report-corpus's
    `src/check-docx-copy.test.ts` proves `verifyDocx` on files written by
    hand, which pass as they stand and fail with one thing written
    otherwise, a case each: the page header without the label, with it
    under another paragraph or among other words, light, black, white, at
    one point or slanted; page 1's own header without it, with it light,
    or said to be there and named by nothing; a slip's page whose header is empty, holds more than the
    label, sets it at the paper's edge or in from one side alone, prints
    it light, stands at the paper's edge, or is the report's own; that a
    report which is no copy is asked for no label and keeps its slip's
    empty header at the edge; and `wordRefusal`, which derives none for a
    copy labelled on every header and one for each way it is not, and
    one for an XRechnung's PDF label on either header.
  - **Made to fail.** Each of these was broken once in the code and its
    test watched fail, then put back: the runtime without the option, at
    which nine cases of its suite failed; the corpus's check without
    `copyProblems` and the slip's header held to empty, at which eighteen
    failed, every case that names a defect among them; the writer before
    `copy.ts`, at which sixteen failed; the renderer's 2b rule, the
    Studio's pipeline writing the file of the document it drew, the copy
    still carrying its XML, the slip's label uncounted, and the slip's
    label set at the paper's edge; and, after review, the label read in
    the report's own language in place of the render's, the writer and
    the corpus without the refusal of an XRechnung's PDF label, the 2b
    rule reading the page header alone, and the slip's page without its
    label under the copy the runtime resolves of a report paid by a
    QR-bill.
  - **The Studio and the install gate.** The Studio's `pipeline.test.ts`
    holds the Word file of each e-invoice starter's final render to the
    copy it resolves for itself, the XML beside it the invoice's, and a
    render in a language no label is written in printed with its XML and
    the reason it has no Word file; `journey.test.tsx` names a final
    render of an e-invoice as written. Its browser gate's `gate-word.mjs`
    resolves the copy under Node as the page does, holds that it is one,
    and holds the downloaded file to it by the corpus's reader and check
    and byte for byte to the file the writer writes under Node.
    `scripts/install-fixture/docx.ts` writes the copy of the fixture's
    e-invoice from the packed packages and reads, with Node alone, the
    label opening its page header, bold, red and at 8 pt, the invoice's
    number, and no part that holds the XML or leads outside the package;
    and refuses the invoice itself.
  - **Seen in Word, on 20 November 2026**, by the person who decides,
    by hand and by no gate, as 0068 asks of a change to what the writer
    writes: every file this change writes -- the copy of every e-invoice
    sample, both e-invoice starters among them, in each language each
    declares, each beside the PDF of the same copy and the PDF of its
    invoice, the e-invoice starter's copy with the label in each of the
    other five languages, beside the PDF of the same copy, and the
    starter's copy with a slip's page, 11 Word files -- with a list of
    what each should show. They were found fine ("Beide ok") against the list: the red
    label at the top of every page, page 1 and a slip's page among them.
    On 22 November 2026, once 0074, 0076 and 0075 as they merged and the
    fix to a heading kept with a table (0011) were taken into this
    change, the writer wrote each of those Word files again, and the
    renderer each of the 15 PDFs beside them, and every one is the same
    bytes as the file opened, compared once, outside any test.
    Nothing more of what Word did was written down -- not how the label
    wrapped where it is wider than the page, nor what Word said as it
    opened a file -- and nothing of it is held by a test: that Word
    prints the header on every page, page 1 included; that the label is
    its first line, red and bold; that the body starts under the header
    and not behind it; that Word opens the file with no prompt about
    links or embedded content; and that on a slip's page the label
    stands 5 mm from the top and the sides and the slip where 0075 puts
    it, pushed by nothing, rest on that look.

## Context

0068 wrote a report as a Word file and refused, whole, what belongs to
its PDF. Of an e-invoice it said that the invoice is the PDF/A-3b that
embeds its XML, or the XML a host sends, and that a Word file is
neither. It was then asked that a Word file hold all five of what was
refused -- "it should also add QR-bill, an EPC QR code, an e-invoice, a
chart and a QR code to word". 0074 wrote the two codes, 0076 the chart
and 0075 the slip. Asked how an e-invoice goes into a Word file, the
person who decides chose a labelled copy: the file prints the invoice's
page and says that it is a copy and not the e-invoice. This is that
copy, and the last of the four.

The forces. An e-invoice is its XML (0027): a Factur-X is the PDF/A-3b
that embeds it (0031), and an XRechnung the XML a host sends, whose PDF
is already a labelled copy (0038). A Word file can be neither, and a
person may change every figure in it. A Factur-X's final render carries
no label, since it is the invoice, so the document a host hands the PDF
renderer is not one a Word file can be written of. The XRechnung's label
says "this PDF is not the invoice", which in a Word file is a sentence
about something else. The labels the runtime writes are English,
whatever the report's language. The writer knows no locale: a resolved
document carries none. A QR-bill's slip has a page of its own in the
file, whose header 0075 leaves empty. And 0068's reason for refusing a
labelled preview -- the label is a paragraph a person deletes -- is as
true of any label in a Word file.

## Decision

**1. Who labels: the runtime, where a host asks for the copy.**
`resolveReport` takes one option more, `eInvoice: 'copy'`. Of a final
render of a report that carries an e-invoice it resolves the copy: every
header the document has -- the page header, and page 1's own where the
report has one (0060) -- opens with the copy's label, a paragraph of its
own in each, in the style every label of the runtime is printed in, and
the manifest says `eInvoice: 'copy'`. The writer decides no word: it
reads the label with the runtime's `readCopyLabel`, holds every header
to it, and writes what it is handed. One decision, in one place, as 0038
has it for the XRechnung's PDF.

The invoice's own document, the one that carries the XML, is refused by
the writer as it was, `unsupported` naming `eInvoice`, in a sentence
that now says what to ask for. So of a document the runtime resolved, a
Word file of an e-invoice report exists only of one that carries the
label.

A host may take the XML off the invoice's own document and hand the
writer the rest, which no runtime resolves. Of an XRechnung that is its
PDF's copy, every page of which says "this PDF is not the invoice": the
writer refuses a document whose page header or page 1's own opens with
that label, in any style, `unsupported` naming the header, as what only
the PDF prints. Of a Factur-X it is the invoice's page with no label at
all, which nothing tells from a report that is no invoice, and it is
written; that is among the costs.

**2. The copy carries no XML.** The invoice's terms are held and its XML
written exactly as for the invoice, so that a copy is of an invoice that
exists and is refused where the invoice is; then the document is handed
on without `eInvoice`. No engine can embed or send anything from a copy,
because there is nothing in it to take.

**3. The words, in the render's language.** The label says three things:
that this is a copy, what the invoice is, and that this is not it. In
English, of a Factur-X, "Copy of an e-invoice: the invoice is the PDF
that embeds its XML, and this document is not the invoice", and of an
XRechnung, "Copy of an XRechnung: the invoice is its XML, and this
document is not the invoice". It is written in the six languages the
starters print in -- German, English, Spanish, French, Italian and Dutch
-- as `E_INVOICE_COPY_LABELS` in the runtime's `e-invoice-copy.ts`, and
found by the first subtag of the locale the render prints in (0063). It
says "this document", not "this Word file": the copy is a resolved
document, and whatever is made of it is no invoice. The XRechnung's
existing label was not reused, since it names the PDF.

A copy in a language no label is written in is refused by the runtime,
`no-e-invoice-copy` at the locale, naming the six. The label is the one
thing that tells a reader what the page is, and in a language the page
does not speak it tells them nothing; 0063 already refuses to print a
form's labels in a language a render does not name.

**4. Every page.** A Word file prints a header on every page of the
section that references it, and the report's section references the page
header and, where the report has one, page 1's own; both open with the
label. A file of a report paid by a QR-bill has a second section, the
slip's page, whose header 0075 leaves empty. Of a copy that page's
header is the label, alone -- the one thing the writer writes that the
runtime could not, since the page is the file's and no document has it
-- 5 mm from the paper's top and 5 mm in from its sides, the margin SIX
keeps clear around a slip's sections, where the page's own margins,
none, would put it at the paper's edge. Nothing else of the report's
header stands there: a line or two of 8 pt at the top of a page whose
body starts 188 mm down pushes nothing. The label is counted with the
file's paragraphs.

A document whose headers do not all open with the same label as the
runtime writes it is refused before any block is walked, `unsupported`:
the page header's label printed otherwise, in white or at one point,
which says nothing to a reader; page 1's own header without it, with it
printed otherwise or with another kind's or language's; and a label on
page 1's own header alone. The runtime labels every header, so each is a
document made otherwise.

**5. Factur-X and XRechnung.** Both are written, by the same rule, and
their copies differ in one thing: what the label says the invoice is,
the PDF that embeds its XML or the XML. The XRechnung's copy carries the
copy's label in the place of its PDF's, never both.

**6. A preview stays refused.** A preview of an e-invoice writes no XML,
so there is no invoice it is a copy of: the runtime refuses the option
in a preview, and the writer refuses a labelled preview as it did
(0068). Both labels are paragraphs a person deletes. What is left of a
copy without its label is the page of a final render, every figure of
which is the invoice's; what is left of a preview is a sample that
passes for the report.

**7. The PDF renderer.** A copy carries no e-invoice and is a document
like any other to it: drawn as a plain PDF that embeds nothing, with the
label on every page. Asked for as a PDF/A-2b it is refused, in
`pdfa-check.ts`, beside a preview and for the same reason: archived, it
would be kept as the invoice. It is refused where any header it holds
opens with a copy's label, page 1's own among them, naming that header.

**8. Where a person gets the e-invoice.** Not from the Word file. The
Studio's Preview resolves an e-invoice's final render once more as the
copy for Download Word alone; Download PDF beside it is the Factur-X
with its XML or the XRechnung's PDF copy, and Download XML the XML the
runtime wrote, as they were (0065). A host does the same: one
`resolveReport` for the invoice it keeps and sends, one with the option
for the Word file.

**9. The option says nothing of a report that carries no e-invoice.**
Such a report resolves as it always did, in a final render and in a
preview, so a host that writes every report's Word file may ask for the
copy of each.

## Consequences

It buys the last of the five: every starter has a Word file, and a host
whose reports are e-invoices can hand a person a file to go on writing
in, which says what it is on every page in the reader's language.

What it costs:

- **A person may change a copy, and its figures may then disagree with
  the XML.** Nothing in the file is tied to the invoice: a total typed
  over in Word is a total. That is what a Word file is for, and it is
  why the file is a copy and says so on every page; the invoice is the
  PDF or the XML a host kept, which nobody edits. And the label itself is
  a paragraph a person deletes, on every header in turn. What is left is
  an unlabelled page of the invoice's final figures, which is what a
  paper copy of any invoice is. Nothing here prevents it.
- **Two resolutions for one e-invoice.** The copy is another document
  than the invoice, so a host resolves twice, and so does the Studio's
  Preview for every final render of an e-invoice. The copy is not drawn
  as a PDF there, so the page limit that bounds what the writer is
  handed (0068) holds the invoice the copy is of, and the copy has one
  line more in each header.
- **Six languages, four of them read by no native speaker.** The
  labels were written with this change, and nobody whose language is
  French, Italian, Spanish or Dutch has read them. A report
  in any other language has no Word file while it is an e-invoice, and
  the refusal says so; each language added is a label of each kind.
- **The older labels stay English.** A preview's and the XRechnung's
  PDF's are as 0038 left them, so one report's PDF copy says in English
  what its Word copy says in German.
- **A header's label is held by its paragraph, not by a mark on the
  document.** A copy is known to an engine by the paragraph its page
  header opens with. A host that builds a document by hand with those
  words in white is refused; one that builds a document without them has
  an ordinary report, which is what it built. That includes a Factur-X's
  final render with its XML taken off: written as a report, with no
  label, a picture of the invoice that says nothing of what it is. The
  writer holds a file to what the runtime resolved, and cannot tell such
  a document from one that is no invoice without a mark the alternatives
  below decline.
- **The copy's file is titled as the invoice.** The file's
  `dc:title` is the report's title as the invoice's PDF has it,
  "Rechnung (ZUGFeRD)" of the e-invoice starter, so Word's File > Info
  and a list of files name the copy as the invoice. A title of the
  copy's own would be a word the runtime does not have in any language:
  its label is a sentence, written for a page, and no title.
- **A host that wrote an XRechnung's PDF copy as a Word file is
  refused.** Before this change the writer wrote an XRechnung's final
  render with its XML taken off, labelled "this PDF is not the invoice";
  it is refused now, naming the header, and the copy is what to ask for.
- **`pdf-only.ts`'s sentences changed**, and a host that matched them
  reads other words; the code and the subject are as they were.
- **A slip's page of a copy is not the slip's page of a report.** Its
  header stands 5 mm down and holds a line, where 0075's holds nothing
  at the edge: one more thing Word prints, which was seen once, by hand,
  and is held by no test.
- **`against-pdf.test.ts` holds a word the PDF broke after a hyphen by
  its parts.** The e-invoice starter's body was compared with its PDF
  for the first time here, and pdfmake breaks "Gas-Brennwertkessel" in a
  narrow column where the file has one word.
- **These files were opened in Word once, by hand.** Each of them on
  20 November 2026, against the list it came with. What Word prints of
  a copy -- its header on every page, the label as its first line, the
  body under it, a slip's page's label -- rests on that look, and no
  test holds it; see *Verified by*.

It forecloses nothing: a mark on the document, a label in more
languages, and a Word file that embeds the XML could each be added.

## Alternatives considered

- **The writer labels the file itself**, with words of its own, whenever
  a document carries an e-invoice. Then the invoice's own document would
  give a file and a host would resolve once. The writer has no locale to
  choose a language by, the words would be decided in two packages, and
  a document that carries the XML would be one the writer writes of,
  with nothing but the writer's care keeping the XML out.
- **Reuse the XRechnung's label and paragraph.** It says "this PDF", is
  English, and has no Factur-X counterpart; a Word file that says of
  itself that it is a PDF tells its reader something false.
- **The copy keeps its `eInvoice`, marked as a copy.** The PDF renderer
  would have to learn the mark or draw a PDF/A-3b that embeds the
  invoice under a label saying it is not one; with no XML in the copy
  there is nothing to learn.
- **A flag on the document instead of a paragraph read back.** A second
  thing to keep in step with the paragraph, which a document could carry
  without the label; 0038 and 0057 already read the runtime's labels.
- **English where no label is written.** A label in a language the page
  does not speak, which is what the XRechnung's PDF has today; chosen
  against for something a person will read as the only sign of what the
  file is.
- **Refuse a copy of a report without an e-invoice.** Stricter, and it
  makes every host branch on the report before it asks.
- **Refuse an e-invoice paid by a QR-bill**, rather than label the
  slip's page. It would leave a report that validates and prints with no
  Word file for want of one line.
- **The report's whole header on the slip's page.** Its height is
  unknown to a writer that measures nothing, which is why 0075 left it
  out.
- **Write a copy of a preview too**, under both labels. Two labels in
  one header, on data that is a sample.
- **Embed the XML in the Word file**, as an attachment or a custom part.
  A file a person edits that carries an invoice it may no longer agree
  with, a part Word may drop on saving, and what SECURITY.md, as this
  change words it, puts in scope where a Word file of an e-invoice holds
  it: anything of the invoice beyond its printed page.
- **A watermark across the page, or a text box.** A drawing nobody has
  seen Word place, where a header's first paragraph is what 0068 already
  writes and the corpus already reads.

## What follows

- What Word was seen to print is written under this record's *Seen in
  Word*; whatever a Word is seen to print otherwise than this record
  says is a change to the writer or a cost here.
- A native speaker's reading of the French, Italian, Spanish and Dutch
  labels.
- The same six languages for a preview's label and the XRechnung's
  PDF's, which is 0038's to change.
