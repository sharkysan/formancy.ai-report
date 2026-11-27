# 6. Runtime view

The main flows, end to end. The first two are what the design is arranged
around: an edit that cannot leave the document invalid, and a render that
cannot return part of a PDF.

## 6.1 An edit, from a key to both builders

```
a person presses Ctrl+D on an outline row
   │
   ▼
builder ──▶ actionForKey(press, 'outline')      decided once, in report-builder-core
   │              └─▶ { type: 'duplicate' }
   ▼
editor.dispatch(action) ──▶ session.apply: report-core's duplicateComponent
   ├─ the edit carries a hash that is not the document's ──▶ stale-document;
   │                                                        nothing changes
   ▼
the command, a pure function, runs on the frozen snapshot itself
   ├─ refused by its own preconditions ──▶ nothing changes
   ▼
validateReport(result)
   ├─ refused ──▶ nothing changes: not the document, its identity, the revision,
   │              the history; no listener hears of it
   ▼
commit the validator's copy, deeply frozen, sharing every part that did not
change with the snapshot before it; one labelled undo step, and none when
nothing changed
   │
   ▼
listeners, synchronously ──▶ the editor derives its state again: outline, design
   │                         view, properties, and the diagnostics of compileReport
   ├──▶ React: useSyncExternalStore re-renders what changed identity
   └──▶ Angular: the state's signal changes, and OnPush marks what read it
```

A refused edit is the same object, the same revision and the same history,
and `session.test.ts` holds each way an edit can be refused to that
([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
The keyboard is the first path, not the alternative: the drag is a second
way to the same commands, its targets the places `validLocations` found by
trying each ([formancy.ai 0046](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0046-keyboard-before-drag.md),
[0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).

An edit in another language than the report's own takes the same path.
The language shown is the editor's view state, chosen in the bar's
switch, which stands there only while the report declares a
translation:

```
a person types "Commande" into the Title field, French shown
   │
   ▼
the field stands at a word ──▶ report-core's translateWord('fr-CH', 'Bestellung', 'Commande');
   │                           an expression that prints words, translateExpression;
   │                           any other field, the command it always dispatches
   ▼
session.apply, validateReport and commit, as above: one undo step
   │
   ▼
the editor derives its state again: the words it shows from report-spec's
writtenIn(report, 'fr-CH'), a word French lacks the report's own, marked
missing; and diagnose(), which lists every language's, a word missing an
error that names its language
```

So the field, the design view and the problems read the report in the
language shown by the walk the runtime prints it by, and a word still
missing is shown as missing, never as written
([0063](../decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)).

## 6.2 A render, from data to bytes

```
host: resolveReport(report, data, { mode, locale, parameters, images, creationDate, timeZone })
   │
   ▼
validate the report again, compile every expression     it arrives as untrusted input
   ├─ a locale neither the report's own nor a translation's ──▶ undeclared-locale
   ├─ an error the editor's diagnostics would give, of no language or of the
   │  render's: a word missing in it among them ──▶ refused
   ▼
the report written in the render's locale: reportIn, its words and the
expressions that print words that locale's, its locale and its slip's
language the render's, no translations (languages.ts); every stage below
reads it, as it read a report in one language
   ▼
check the data: one header record and one detail list, each value held to its
field's type, a field the report does not declare refused, MAX_DETAIL_ROWS;
where it names its source, the syntax of identifiers and its shape's keys (0041)
   ├─ a source past either, more submissions than rows, or a provider unknown ──▶ refused
   ├─ a form's labels read in another locale than the render's ──▶ labels-locale-differs
   ├─ final, and a field missing or the data incomplete ──▶ refused
   ├─ preview ──▶ go on: nothing printed for it, one warning per field
   ▼
evaluate conditions and expressions        fixed capabilities; EXPRESSION_STEP_BUDGET
   │                                       each, RENDER_STEP_BUDGET a render
   ▼
order and group the rows; compute each aggregate exactly, then round it once;
each table's rows those its condition selects, its totals over them (6.21)
   ▼
an e-invoice's lines, read once from its table's rows; its totals computed
once; its other terms held to EN 16931's rules (6.8)
   ▼
format every value for the locale          Intl handed exact digits, never a double
   ▼
a chart, where it stands: its categories grouped as a table's rows are, each
series totalled by the aggregates' function, its axis ticked exactly, every
word formatted (6.18)
   ├─ more categories than MAX_CHART_CATEGORIES, or a pie than its palette's
   │  colours, or a pie's value negative ──────────────────────▶ refused
   ▼
images through the host's lookup, by id and digest, once each; an SVG
past MAX_SVG_BYTES refused (6.9)
   ▼
the fonts a report maps, through the same lookup, read with readFont before
they are handed over; a face it cannot give or that is refused refuses the
render (0043)
   ▼
a QR-bill's texts, and an EPC QR code's, resolved and held to their code's
rules; the EPC QR code's payload written (6.7)
   ▼
in a final render, an e-invoice's CII XML, written from those values (6.8)
   │
   ▼
ResolvedDocument + manifest, naming the template's hash, the render's locale
and the data's source where it has one
(+ a preview's warnings)                                     every reason, or none
   │
   ▼
renderPdf(document, { maxPages, signal, pdfa })
   ├─ pdfa neither '2b' nor left out ────────────────────────▶ RangeError
   ├─ before pdfmake sees it: a glyph per character, nothing malformed or
   │ wider than where it stands, each asset's bytes, an SVG's in the form
   │ cleanSvg writes and within what SVGs may cost (6.9), a bill, each
   │ code encoded once and held to its square ───────────────▶ RenderRefusal
   │ an e-invoice it does not know; asked for as pdfa: '2b', a
   │ Factur-X, an XRechnung's copy or a labelled preview (6.19);
   │ in a Factur-X invoice or a PDF/A-2b, a title its XMP cannot
   │ hold, a CMYK JPEG, an SVG whose numbers or nesting its
   │ PDF/A cannot hold (6.9) ────────────────────────────────▶ unsupported
   │ a chart in a page region, of a kind it does not know, past
   │ MAX_TICK_INTERVALS or MAX_CHART_SERIES, or with a word its
   │ face cannot draw (6.18) ────────────────────────────────▶ unsupported
   │ a chart of more than MAX_CHART_CATEGORIES, and a render's
   │ charts past MAX_CHART_DRAWING together (6.18) ──────────▶ content-too-large
   ├─ a bill or a captioned EPC QR code: Liberation Sans read, and in a
   │ browser its chunk imported
   ├─ measure the page regions, and page 1's own header in a pass of its
   │ own (6.20); the body's margins follow
   ├─ a block of fixed height taller than the body ──────────▶ content-too-large
   ├─ least height already past maxPages ────────────────────▶ too-many-pages
   ├─ the body's charts laid out by ECharts, in the widths pdfmake
   │ prints in; words that would meet, labels that do not fit
   │ across, bars too thin (6.18) ───────────────────────────▶ content-too-large
   ├─ measure kept blocks and table rows; one no page holds,
   │ or a row's line no page holds under its table's
   │ repeated header (0011) ─────────────────────────────────▶ content-too-large
   ├─ plan where each table breaks
   ├─ lay out the PDF; a page past maxPages ─────────────────▶ too-many-pages
   │       in every pass, a word wider than its column ──────▶ content-too-large
   │       a word that holds a run set below or above the
   │       line and no run on it (0061) ─────────────────────▶ unsupported
   │       such a word wider than its line ──────────────────▶ content-too-large
   │       an abort is read between passes ──────────────────▶ cancelled
   ├─ an e-invoice: a PDF/A-3b, and on this last pass alone its XML embedded
   │ and its XMP written, through PDFKit's document before it ends (6.8)
   ├─ pdfa: '2b': a PDF/A-2b on this last pass, nothing embedded (6.19)
   ▼
Uint8Array
```

The runtime never returns part of a document and the renderer never
resolves to part of a PDF
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
A run set below or above the line travels with its baseline, and the
document states what it prints as; the renderer hands it to pdfmake as
pdfmake's own `sub` or `sup`, and reads pdfmake's words of only the
paragraphs that hold one
([0061](../decisions/0061-a-paragraphs-run-may-be-set-below-or-above-the-line-in-any-character-its-face-draws-and-prints-only-beside-a-run-on-the-line.md)).
Every value reaching the renderer is already the string it prints, so the
renderer has no total to round twice. The PDF's creation date is the one the
host passed, so one document renders to the same bytes every time
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)),
and the images PDFKit is still decoding when pdfmake hands the document
over are written in the order pdfmake opened them, however their decodes
finish
([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).
A render that names a locale is that report printed in it: a report
without translations, rendered with no locale or its own named, takes
the path it took before the option, and one whose French lacks a word
prints in its own language and in every other that is whole (0063).
The resolved document is an engine's whole input, and a second engine
reads it: `renderDocx` writes it as a Word file, or refuses it (6.22).

## 6.3 A read from Formancy Data

```
host: a data client, carrying the person's token
   │
   ▼
readReportData(client, report, binding, { cap, signal })
   ├─ the report valid, the cap within MAX_DETAIL_ROWS?
   ├─ every declared dataset bound, and nothing else?
   ├─ each form Data answers published under the id the binding names?
   ├─ every declared field one this person may read, and none an image?
   ├─ the detail form offers this person a list; its parent is one field?
   │       any no ──▶ refused, before a single record is read
   ▼
the header's record
the detail rows, a page at a time, until Data says none follow or the cap is reached
each lookup's labels, distinct tokens, a page of them a request
   │       a label this person may not see ──▶ refused, whole
   ▼
ReportData, its consistency 'best-effort', its source the forms it read,
none where it read none ──▶ resolveReport, as in 6.2
```

Every request runs Data's policy again, so the provider is exactly as
authorised as the token. The header, each page and each label are read at
different moments: a row inserted between two pages can be printed twice or
not at all, which is what `best-effort` and the manifest say
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
The manifest names the forms read, by dataset and by the ids the binding
addressed, and no record: a record's token spells its key, which can be
the customer's own data ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)).

## 6.4 Switching frameworks over one session

```
the Studio: one session and one editor per starter, made when it is first picked
   │
   ├─ Angular builder mounted over the editor ──▶ an edit ──▶ the session commits
   │
   ├─ the switch moved to React
   │     Angular builder destroyed ──▶ its subscription ends; the editor stays
   │     React builder mounted over the SAME editor
   │
   └─ Undo, in React ──▶ the snapshot that stood before the Angular edit
```

The session holds the document and its history; the editor holds the
selection, the zoom and the open pane; a builder holds nothing that must
outlive it, so switching keeps all three
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).
`apps/studio/src/studio.test.tsx` runs this in jsdom, with no listener or
subscription left behind, and the browser gate runs it the other way in
Chromium.

## 6.5 The Studio's preview

```
an edit commits
   │
   ▼
latest(): the request waits a moment for the next one; a newer one aborts the
          render under way, whose result is then delivered to nobody
   │
   ▼
preview(): resolveReport, in the mode the Preview is in and the language the
           builder shows ──▶ renderPdf from
           '@formancy/report-render-pdf/browser', up to PREVIEW_PAGE_LIMIT pages
   ├─ refused by the runtime ──▶ every reason, each with a button that selects
   │                             the component it is about
   ├─ refused by the renderer ──▶ its code and what it names
   ▼
renderDocx, from a chunk of its own, of the document the PDF was drawn from (6.22)
   ├─ refused by the writer ──▶ no link, and a note: "No Word file: " and its sentence
   ├─ anything else it throws ──▶ the PDF as it printed; the note says the writer failed
   ▼
PDF.js draws each page on white paper with its text layer; Download PDF gives
the bytes those pages were drawn from, Download XML, where that final
render of an e-invoice wrote one, the XML the runtime wrote beside them, and
Download Word the file the writer wrote of that document
```

The Preview makes the same two calls a host makes, with nothing decided in
the Studio ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
It prints in the language the builder shows, the editor's
`languages.edited`, which a framework switch keeps, so a language whose
words are not all written is refused there as the runtime refuses it,
`word-missing` by word, until the last one is (0063).
A render the renderer cannot stop mid-pass finishes into nothing rather
than replacing a newer one. A final render of an e-invoice hands on the
XML the runtime wrote, `document.eInvoice.xml`, the one writer's
(`cii.ts`), which the viewer keeps with the PDF it was written beside, so
that Download XML gives the XML of the render on the paper, as UTF-8: the
Factur-X's the very bytes its PDF/A-3b embeds, the XRechnung's beside a
copy that embeds nothing. A preview writes none, and none is offered
([0065](../decisions/0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md)).
The Word file is written of the document the PDF was drawn from, once the
PDF is drawn and of no document the renderer refused, so the page limit
that bounds a preview bounds what the writer is handed on the page's own
thread. The viewer keeps it with the PDF it was written beside, as the
XML, so that Download Word gives the file of the render on the paper,
under the starter's id. Where the writer refused, the link is not drawn
and a note says why in the writer's own sentence, which is how a person
learns that an e-invoice and a labelled preview have no Word file; a
report with a QR code or an EPC QR code has one, the euro invoice among
them (0074), and so has one with a chart, the sales report among them
(0076), and one paid by a QR-bill, the invoice and the payment reminder
among them, its slip the file's last page (0075). A fault of the writer's, or a chunk
that did not load, is the Word file's alone and leaves the PDF as it
printed, which `word-fault.test.ts` and `word-chunk.test.ts` hold, a
suite each; and the writer, with the two libraries it zips and inflates
with, is a chunk the pipeline asks for where a PDF has printed and
nothing loads before, which `chunks.test.ts` holds on a build of the
pipeline. The printed render is handed on with its Word file, so the
paper shows each PDF once the writer's chunk has loaded and the file is
written, and the signal that stops a superseded render is read by the
renderer and by nothing after it: a render whose PDF was drawn writes
its file though a newer one waits. Neither is changed by 0068, which
names both as costs
([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).

Where the Preview stands is the editor's to hold and the window's to say
([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)):

```
the window crosses MIDDLE, 128.25rem (layout.ts, and narrow.css's query)
   │
   ▼
the workspace: placeHostView, to every editor it holds ── 'middle' up to
               2052px, 'beside' past it
   │
   ▼
the bar's Preview ──▶ showHostView ──▶ view: 'host' ──▶ the builder draws a region
   │                                                    named Preview in the design
   │                                                    view's place, and the
   │                                                    Studio's Preview in it prints
   ▼
the toolbar's Design view ──▶ openPanel('canvas') ──▶ view: 'design': the design
                                                       view back with the keyboard
                                                       in it; the Preview not
                                                       drawn, nothing printed
```

Beside the builder, the bar's Preview shows and hides the Preview the
Studio draws there, and the toolbar's Design view leaves it, as
[0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md)
had it. In the middle, React's builder draws the Preview as its `hostView`.
Angular's stamps the Studio's `reportHostView` template, which holds an
empty slot, and React draws the Preview into the slot through a portal,
only while the editor's `view` is the host's, so that as the Preview moves
beside the builder it is never drawn twice. So the Preview is one
component in either builder, and a framework switch draws it again. While
it stands in the middle the zoom, which is the design view's, is
unavailable.

As the window crosses the width with the keyboard in the middle pane,
the builder puts it on what stands there now; the keyboard on a Preview
beside the builder, the Studio takes along into the middle. The Preview's
viewer keeps the PDF on its paper, and redraws it as a pane hidden or
shown resizes the paper, until PDF.js has loaded the newer one.

## 6.6 A Swiss QR-bill, from a literal to the slip

```
the definition's payment part, an IBAN written in it
   │
   ▼
validateReport: SIX's rules over every literal text ──▶ invalid-qr-bill, on the field
   │            a page not A4 in portrait, or a top margin past
   │            the slip's top ─────────────────────────────▶ payment-part-page
   ▼
resolveReport: each text read as a paragraph's in the report's scope
   ├─ final, and a run null ──────────────────────────▶ no-qr-value
   ├─ what it resolved to breaks a rule ──────────────▶ invalid-qr-bill, the field and
   │                                                    the rule, never the value
   ▼
QrBill: the payload in SIX's order, the headings in the slip's language, every
        value written as the slip prints it
   ▼
renderPdf: checks again what would draw another slip; the Swiss QR Code encoded
           once, at level M and version 25 at most
   ▼
the slip, 210 by 105 mm across the foot of the last page in place of its footer,
in Liberation Sans; on a page of its own when the last page has too little room
```

The validator and the runtime call the same functions in report-spec's
`qr-bill.ts`, and the IBAN's check digits and the creditor reference in
`payment-reference.ts`, which the EPC QR code's rules read too, so the
editor and a render cannot read SIX differently. A preview whose bill
breaks a rule is refused too, because a code that scans as a bill no bank
pays has no drawing worth showing
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).

## 6.7 An EPC QR code, from a field to the payload

```
an epcQrCode where a QR code may stand, an IBAN written in it
   │
   ▼
validateReport: the EPC's rules over each literal text ─▶ invalid-epc-qr-code, on the field
   │            the same for a reference and a text both; a BIC the IBAN does
   │            not go with, or none where one is needed; literal texts
   │            already past the EPC's bytes; a captioned square no version
   │            prints in
   ▼
resolveReport: each text read as a paragraph's in the report's scope
   ├─ its condition does not hold ───────────────────▶ neither drawn nor checked
   ├─ an optional text empty, blank or null ─────────▶ its element left unused
   ├─ final, and a null run cuts a text short ───────▶ no-qr-value
   ├─ preview, a required text without a value ──────▶ invalid-epc-qr-code
   ├─ what it resolved to breaks a rule ─────────────▶ invalid-epc-qr-code, the field and
   │                                                   the rule, never the value
   ▼
EpcQrCode: report-spec's epcPayload of the checked texts, held to EPC_MAX_BYTES
   ▼
renderPdf: the payload encoded once, by the runtime's epcSymbol and uqr (0074),
           at level M and EPC_MAX_VERSION at most
   ├─ past the EPC's bytes, or modules its square cannot print ─▶ content-too-large,
   │                                              naming the code, never its payload
   ├─ no caption: drawn as a QR code of its payload is, held to the same floor
   ├─ Austria's caption: the PSA's frame, at the least version the PSA's modules
   │  allow in its square, or the payload's own when larger; "Zahlen mit Code"
   │  in Liberation Sans up its right side
   ▼
the code in its square, where the template put it
```

The validator and the runtime call the same functions in report-spec's
`epc-payload.ts`, and read one table of the code's texts, `EPC_TEXT_FIELDS`,
for what each is called and whether it may be left out, so the editor and a
render cannot read the EPC differently. The payload is written once, by the
runtime. The renderer encodes the string it is handed and decides only what
drawing decides — the version, the modules, the frame — by report-spec's
`epc-print.ts`, which reaches it through the runtime. A preview whose code
breaks a rule is refused, as a bill's is: it would scan as a transfer no
bank makes
([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

## 6.8 An e-invoice, from the table to the PDF/A-3b

```
the definition's eInvoice: its lines the table over the detail dataset, named
with the four columns that print each line's name, quantity, net price and
net amount
   │
   ▼
validateReport: EN 16931's rules over each literal ─────▶ invalid-e-invoice, the term
   │                                                      and the rule, never the value
   │            a named column, the table or what holds it
   │            hidden; a payment code paid to another
   │            account; a title holding &, < or > ─────▶ refused
   ▼
compileReport: invoice, vatBasis and vatAmount bound wherever totals is, in a
   │           report with an e-invoice alone; read where they are computed
   │           from ────────────────────────────────────▶ expression-unknown-name
   │           a total the XML holds unprinted, or printed
   │           otherwise ───────────────────────────────▶ e-invoice-total-unprinted,
   │                                                      e-invoice-format-differs
   ▼
resolveReport, after the aggregates and before anything is lowered:
   ├─ each row's four terms read once, by the columns that print them; the
   │  table prints the very values kept
   ├─ a net amount other than its quantity times its net price, rounded once,
   │  a line identifier an earlier line has, a quantity or a net price its
   │  column prints at fewer places than it has ────────▶ invalid-e-invoice
   ├─ the totals and the VAT breakdown, once, in Decimal: each category's VAT
   │  rounded once, half away from zero, never per line; bound for the page
   ├─ every other term, once the data has resolved it, held to the same rules
   ▼
resolveReport, while the page and its payment part are lowered:
   ├─ a QR-bill or an EPC QR code asking for another amount than the amount
   │  due, or another account ──────────────────────────▶ invalid-e-invoice
   ▼
resolveReport, once they are lowered:
   ├─ preview ──▶ no XML; e-invoice-preview; every page labelled
   ▼
final: the CII XML from those very values ──────────────▶ document.eInvoice
   ▼
renderPdf: a file, a relationship or a level it does not
   │       know, a lone surrogate, a title its XMP cannot
   │       hold, a CMYK JPEG ───────────────────────────▶ unsupported
   ├─ the measuring passes: neither version nor subset nor file nor XMP,
   │  the pages laid out as the final pass lays them out
   ├─ the final pass: version 1.7, subset PDF/A-3b; before PDFKit ends the
   │  document, the XML's UTF-8 bytes embedded as factur-x.xml, text/xml,
   │  Alternative, dated the document; the fx properties and their
   │  extension schema appended to the XMP
   ▼
PDFKit ends it: the pdfaid identification, the sRGB output intent with
the ICC profile it reads from its own package, the XMP ─▶ a PDF/A-3b
```

The validator and the runtime call the same functions in report-spec's
`en16931-*.ts`, one module for each kind of term, their rules named by
`en16931.ts`, so the editor and a render cannot read EN 16931
differently, and an e-invoice's account is held by the EPC QR code's
rule. The page and the XML read one evaluation of each
line and one computation of each total: the names the page prints are bound
to the very totals the XML is written from, and the editing core refuses a
page that leaves one out or prints it otherwise. A final render writes the
XML or refuses; one that wrote none and recorded no reason throws, as a
defect
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
The terms a German B2B invoice does not need -- the business process, the
parties' electronic addresses, the seller's contact -- go the same way:
read in the report's scope, held to their rules, and, where the data gives
one as nothing, left out of the XML, an address with its scheme and a
contact whole where it has none of its terms; a contact the data gives in
part a final render refuses, at each term it lacks ([0037](../decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)).
The renderer decides none of what the file says: it embeds the runtime's
bytes changed in nothing, under the name, relationship and conformance
level report-spec gives them, and refuses a document whose values it does
not know. The file and the XMP are added on the final pass alone, so the
measuring passes lay the page out as the PDF prints it, and a preview,
which carries no XML, is drawn as a plain PDF
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).

An XRechnung goes the same way to its XML: the same readers, held to its
kind's rules, which need what XRechnung needs and refuse a `#` line in
its payment terms, and the same writer, BT-24 its version's. Its file is
no Factur-X file: `{ kind: 'xrechnung', xml, syntax, guideline, version
}`, the invoice, which the host takes from the resolved document and
sends, and the runtime heads every page with `XRECHNUNG_COPY_LABEL`. The
renderer draws that document as a plain PDF, the copy, a CMYK image in it
drawn, and refuses one whose page header, or page 1's own header where it
has one (6.20), does not open with the label as the runtime writes it,
`XRECHNUNG_COPY_PARAGRAPH`, style and all
([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).

```
resolveReport(xrechnung, data, { mode: 'final' })
   ├─ a needed term missing, blank, a # line, a Leitweg-ID's digits ─▶ refused, by its rule
   ▼
document.eInvoice = { kind: 'xrechnung', xml, syntax: 'cii', guideline, version }
   ├─▶ the host sends xml: a portal, email, Peppol          the invoice
   ▼
renderPdf(document) ── no PDF/A, no file, every page labelled ─▶ its copy
```

## 6.9 An SVG, from the file a person saved to the page

```
a host is handed a logo as a drawing program saved it
   │
   ▼
cleanSvg(bytes), where the host approves it          report-spec, at approval, once
   ├─ text, an embedded picture, use or symbol, a reference out of the file,
   │  a filter, a mask, an internal subset, a byte past ASCII kept, a bound
   │  passed ──────────────────────────────────────────▶ refused, a code and
   │                                                     what to do, never a value
   ├─ what never draws ──▶ removed, and listed by kind and name with a count
   ├─ CSS flattened into attributes; the root's paint and transform moved
   │  onto a group inside it; a link written as the group it draws as
   ▼
the canonical form: ASCII, absolute numbers, one matrix a transform, ids
renamed; its cost to paint, and to draw; its extent: the inverses its
page-sized groups and the matrices its gradients are drawn under, the
points the converter draws its outlines with, and how deep it nests it
   ▼
the host keeps those bytes, and declares the asset by their digest
   │
   ▼
resolveReport: images through the host's lookup (6.2)
   ├─ an answer past MAX_SVG_BYTES ─────────────────────▶ invalid-asset, before
   │                                                     it is copied
   ▼
renderPdf: checkSvg(bytes)                            report-spec's, through the runtime
   ├─ anything cleaning would change ──────────────────▶ invalid-asset, naming
   │                                                     the asset and the change
   ├─ the SVGs past MAX_SVG_DRAWING, the page header's and
   │  footer's counted on every page maxPages allows, page
   │  1's own header's once (6.20); the body's past one
   │  drawing's bounds, as though on one page ──────────▶ content-too-large
   ├─ in an e-invoice, numbers that at the image's box,
   │  anywhere on its page, could pass the PDF/A-3's
   │  integers less a margin for rounding, or a nesting
   │  past its 28 graphics states ──────────────────────▶ unsupported, naming
   │                                                     the image and what to do
   ├─ the renderer's own list of elements ──────────────▶ invalid-asset
   ▼
pdfmake's svg-to-pdfkit draws it in the image's box: contain as xMidYMid meet,
cover as xMidYMid slice, clipped to the box
   ├─ it would open an image, or it warns ─────────────▶ invalid-asset, from
   │                                                     its callbacks
   ▼
vectors on the page, drawn again on every page in the page header or footer
```

The rules are report-spec's alone, so the host's approval, a builder's
upload ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md), 6.10) and the renderer cannot read an SVG differently, and
the renderer cleans nothing: what it draws is bytes `cleanSvg` wrote, or
nothing. The renderer's list and the converter's callbacks stand behind the
check, for a fault in the cleaner, and neither replaces it: the converter
writes a link and draws text without a callback, which only the check and
the list refuse. That the bytes are the drawing a person approved rests on
the host's lookup, which the runtime trusts to return what the digest
pins ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md),
[0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
In an e-invoice, whose PDF/A-3 holds an integer to 2,147,483,647, the
converter's numbers for a drawing are bounded before it runs, from the
extent the cleaner measured, the box and the page, since some of them --
a page-sized group's box, a gradient's matrix -- grow as the box shrinks;
a report that is no e-invoice draws the same drawing as before
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).

## 6.10 An image, from the file a person chooses to the Preview

```
Add image… pressed: click, Enter or Space                 either builder
   │ dispatch chooseImage
   ├─ no store, a report full, an image being added ──▶ said why; no chooser
   ▼
input.click(), in the same activation ──▶ the platform's file chooser
   │ change: files[0] taken, then value cleared, so the same file is a change again
   ▼
editor.addImage(file)                                     report-builder-core
   ├─ file.size past MAX_ASSET_BYTES ──────────────────▶ refused, never read
   ├─ adding: "Adding logo.png…"                         Add image… aria-busy
   ▼
bytes = await file.arrayBuffer(), held to the bound again
   ▼
sniffImage(bytes): what the bytes are, never the name   report-spec
   ├─ PNG, JPEG: imageHeader, every chunk's CRC, the sides;
   │  a CMYK JPEG in a Factur-X invoice refused
   ├─ SVG: cleanSvg (6.9), its drawing the asset
   ├─ anything else, a refusal, a type the store keeps not ──▶ said, in the
   │                                                     editor's words
   ▼
assetDigest(bytes) ── the report holds those bytes ──▶ kept again under
   │                                                     their id, said;
   ▼                                                     nothing declared
id: the file's name folded, numbered as it stands by     report-core
    nextAssetId, never an id this editor had kept
   ▼
await store.keep({ asset, mediaType, digest, bytes, … })  the host
   ├─ { ok: false }, a rejection ──────────────────────▶ said; nothing declared
   ▼
addAsset, one undo step "Add image"                       the session
   ├─ the id declared meanwhile ───────────────────────▶ changed; nothing replaced
   ▼
"Added image logo. Insert it with Image."; Image draws it, in the place chosen
   ▼
the Preview re-renders (6.5); the host's lookup answers by id and digest
```

The host keeps the bytes before the session holds the declaration, because
the Studio's Preview renders on every change of the document and the
runtime's lookup is synchronous: the other order would print
`missing-asset` for a moment. Undo and redo take and give back the
declaration alone, and `keep` is called once, so a host keeps what it was
handed for as long as a redo may need it; the Studio keeps everything for
the tab's life (`images/image-store.ts`). The id `keep` is handed is the
one the add means: another editor may declare it first, for other bytes,
so a store keys by digest; and the editor waits for `keep` to settle. A PNG's image data is not
inflated and a JPEG's scan not decoded until it prints (6.2). Remove, under
the report's own properties, takes back the declaration of an image nothing
draws, in one step, and leaves the bytes where the host keeps them
([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
Where the host keeps its images on the report server, `keep` is
report-client's `keepImage`, and the host puts the bytes in the cache its
lookup reads before `keep` resolves, since the lookup cannot ask the server
while the Preview prints (6.17, [0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).

## 6.11 A QR-bill's IBAN, from the field to the slip's code

```
the bill selected: its outline row after the regions,     either builder
or a click on its band; or Add QR-bill in the report's
properties, SIX's third example, the keyboard on the IBAN
   │ dispatch setProperty('/account/0/text', 'CH58 3000 …')
   ▼
payment-part-fields.ts: the IBAN's field writes one run   report-builder-core
   ▼
payment-part.ts: of the other kind than the reference?   report-builder-core
   ├─ a QR-IBAN over none or a creditor reference ──────▶ SIX's example QR reference
   ├─ an IBAN over a QR reference ──────────────────────▶ the reference taken away
   ▼
updatePaymentPart(report, { account, reference? }),     report-core
one undo step "Change IBAN"; the session asks the validator
   ├─ SIX's rules: country, length, check digits, a      report-spec
   │  QR-IBAN in francs alone ───────────────────────────▶ refused on the field,
   ├─ an e-invoice's BT-84 another account ─────────────▶ in the validator's words;
   │                                                       the report unchanged
   ▼
diagnose: SIX's examples held? ──▶ example-payment-part, once, the payment
   │                                part's, on its row, its band and in the problems
   ▼
"Changed IBAN.", and the reference's change if there was one; the Preview
re-renders (6.5) ──▶ resolveReport (6.6) ──▶ the slip's
                                                  Swiss QR Code holds the IBAN
                                                  typed, without its spaces
```

The builders send what a person typed, and the editor's field writes it
as the run it replaces, with the reference SIX pays an account of its kind
with where the bill's is of the other (`qrBillPairing` says when); whether
it is an account SIX's rules take is report-spec's, asked once by the
session for every edit
([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
Nothing confirms a changed IBAN: the refusal on the field, the
announcement, undo, the Preview and the warning on SIX's examples are what
the editor does, and who may change whom a bill pays is the host's
([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).
The browser gate types an IBAN into each builder and decodes the code the
Download PDF draws from its pixels (`apps/studio/scripts/gate-payment-part.mjs`).

## 6.12 A read from a formancy form's submission

```
host: a form version it kept, and a submission of it, as formancy stored them
   │
   ▼
readSubmission(report, { form, formHash?, submission: { id, data } }, { labels, locale? })
   ├─ the report valid, its datasets read from a form, not one row per submission?
   ├─ the locale it names, if any, the report's own or one its translations declare?
   ├─ the input { form, formHash?, submission: { id, data } }, and nothing else?
   ├─ the submission's id one a source names (the runtime's isSubmissionId)?
   ├─ the form copied as data, its specVersion one the pinned @formancy/spec reads?
   ├─ validateSchema accepts it; schemaHash of the copy, and the host's hash that one?
   ├─ every field the report reads at its path in this version, of a kind its type reads?
   │       any no ──▶ refused, naming the field and the version's hash, before an answer is read
   ▼
the submission walked by the version's model
   │       an answer under no data path of the version ──▶ refused, by its path
   ▼
each field's answer: absent or null is null; a choice's label from this version,
in the locale read, the report's own unless a translation's is named; a number
by the number rule; held to its type by readValue
   ▼
ReportData, 'host-captured', its source the submission, the form's id, the
version's hash and, where it is not the report's own, the locale read
──▶ resolveReport, as in 6.2, which refuses it in another locale
```

`readSubmissions(report, { forms, submissions, complete })` is the same
read once for each submission, one a row, each paired with its version by
the hash the host stored beside it and checked against the hash computed
here; each version's fields are checked once, and the host says whether
the list is complete. The bridge fetches nothing: a host that prints an
old submission hands over the version that collected it, kept beside it
or fetched by its number from formancy's server, which serves each
version's document and hash from 0.8.0
([formancy.ai 0207](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0207-a-versions-document-can-be-read.md),
[0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)).
A version that moved, removed or retyped a field the report reads is
refused for every submission of it, the refusal naming the review that
would lift it, until a review's resolution is applied (6.15); one that
touched nothing the report reads prints, and a field it added is never
read by itself. Where a review decided for a version, the field is read
at its override's path in that version, or nothing of it prints from it;
every version the binding does not name reads its own path, which a
followed rename moves to where the field is now.

## 6.13 A report started from a formancy form version

```
host: a form version, and what the person asks for: an id, a locale, the table
   │
   ▼
generateReport(form, { id, locale, detail? })
   ├─ the options an id and a locale report-spec takes, a detail a repeater's path
   │  or one row per submission, and nothing else?
   ├─ the form read as 6.12 reads one: copied, validated, named by its hash?
   ├─ the detail's repeater found at its path, as a read finds it?
   │       any no ──▶ refused, each reason a code and a JSON Pointer
   ▼
the version's model walked in order: a line per answer, a section per group,
a page looked through, the repeater the table, every other part listed in a note
   │       past the format's bounds, a label no font draws, or nothing to print
   │       ──▶ refused, never cut to fit
   ▼
the page: portrait for a table of up to six columns of 80 pt, landscape, said,
for up to nine
   │       wider than a landscape page ──▶ refused, never cut to its first columns
   ▼
{ report, notes }: the provenance naming the version, the binding written,
a field never null only where the version proves it answered
   │
   ▼
readSubmission(report, a submission of that version) ──▶ as in 6.12
```

The same version and options give the same report, to its hash; a later
version is read into it, or refused, as any version is, and nothing
regenerates the report: no base is kept beside it to merge one into
([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)). The Studio opens the corpus's site visit, generated from its
version 2, as a starter.

## 6.14 An e-invoice's account, typed once, to the XML and every code

```
the e-invoice selected from its outline row, its bill     either builder
from its band, or an EPC QR code from its row
   │ dispatch setProperty('/payment/iban/0/text', 'DE89 3704 …'),
   │ or the bill's '/account/0/text', or the code's '/iban/0/text'
   ▼
properties.ts: a report with an e-invoice, every run       report-builder-core
of the field's account literal? ──no──▶ the field's own command
   ▼ yes
setPaymentAccount(report, 'DE89 3704 …') asked first:     report-core
   ├─ BT-84, the bill's or a code's read from the data:
   │  read-from-data ─────────────────────────────────────▶ the field's own command,
   │                                                         the render comparing it
   ▼ none read from the data: committed, one undo step       with the data's (0027)
"Change IBAN": BT-84, the bill's account and each EPC QR
code's IBAN, shown or hidden, one literal run each
   ▼ the session asks the validator, each place by its own rule
   ├─ BT-84 and an EPC code: SEPA's, no QR-IBAN; a code's  report-spec
   │  BIC of the account's country; a bill: Switzerland ─▶ refused on the field
   │  or Liechtenstein                                      typed into, in the
   ▼                                                        validator's words, its
                                                            own place's first
"Changed IBAN. The e-invoice and every payment code printed with it pay the
account typed."; the Preview re-renders (6.5) ──▶ resolveReport (6.6) ──▶
a final render: the PDF/A-3b's factur-x.xml names the account (6.8), and
each code's payload pays it
```

Each edit is validated whole
([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)),
and the validator holds every payment code printed with an e-invoice to its
BT-84 (0027), so a change of any one of them alone would be refused: the
builder writes all of them by the one command a review finds by its name
([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)).
Which places share the account, and whether one reads it from the data, is
the command's to say: the builder asks it before committing, and where one
reads the data the field writes its own account alone, which the validator
holds to the places that are written and the render to the data's.
`report-builder-core/src/e-invoice.test.ts` holds both ways, and
`report-core/src/commands/e-invoice.test.ts` a code nested in a columns
block and one behind a condition changed in the one edit.
The browser gate types the account into each builder, reads the XML the
final Download PDF embeds and decodes its EPC QR code from its pixels
(`apps/studio/scripts/gate-e-invoice.mjs`).

## 6.15 A review of a form's new version

```
host: the new version, every version the report names, and any other it keeps
   │
   ▼
reviewFormVersion(report, { form, formHash?, versions })
   ├─ the report valid, a dataset read from a form?
   ├─ each version read as 6.12 reads one, the new one's hash the host's?
   ├─ every version the report names handed over: its provenance's, its overrides'?
   │       any no ──▶ refused, each reason a code and a JSON Pointer
   ▼
diffSchemas(each named version, the new one): what changed, by data path;
the moves a declared rename made, beneath a renamed group or repeater too
   ├─ the form's id changed ──▶ an item, blocking nothing
   ▼
each field the report reads, planned against the new version as 6.12 plans it
   ├─ refused ──▶ an item that blocks, the diff's kind, its resolutions:
   │              follow-rename (declared, first) · follow-reviewed · print-nothing · retype · remove
   │              a field the payment part or the e-invoice reads: a rename alone, and said
   ├─ prints from a field the diff calls new since a version that printed none of it
   │              ──▶ an item: print-nothing · remove, and no relabel
   ├─ prints, an old label still in a text ──▶ an item: relabel, a batch
   └─ prints ──▶ nothing
the detail's repeater refused ──▶ an item: its rename, declared or a baseline's, or nothing
each field the version added, where the report reads, of a kind it reads ──▶ said
   ▼
each resolution tried: tryEdit takes it; and where it changes a field's type or
whether it may be null, compileReport over what fieldReaders says it reaches,
each expression compiled once as the report stands, refuses nothing new?
   │       no ──▶ not offered
   ▼
{ status: compatible | review | blocked, formHash, reportHash, items }
   │
   ▼
the host shows it; a person picks a resolution
   ▼
session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash })
   ├─ the report since changed? ──▶ stale-document, nothing changes
   ├─ the end invalid, or a step refused or thrown? ──▶ refused whole, nothing changes
   ▼
one undo step: the binding moved to where a declared rename put the field,
each version handed over named where it read; or an override on the binding,
keyed by the version's hash; or the field's type, or the field gone with
what reads it, or the new label
   ▼
review again: the hash moved, so every other resolution of the last review is stale;
a later version that keeps the field where the rename put it prints unreviewed
```

Nothing is applied by the review: a rename the form's author declared is
offered first and labelled declared, and never followed by itself; a path
is never guessed from a name, and one a version the report names reads is
offered only where formancy's diff finds the same field there; a relabel
is offered for the texts that say an old label word for word, and a field
the version added is said and never added ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)).
The removal is report-core's `removeFieldWithReaders`, which finds a
field's readers by the diagnostics' walk and the parser the compiler
asks, and refuses a field the QR-bill or the e-invoice reads; a
resolution of several commands is a `batch`, one command, one undo step.
read by itself.

## 6.16 A request to the server, from the token to the trail

```
a host's backend, or its page on an origin the operator lists
   │  GET /v1/whoami, or a route of the draft slice (6.17)
   │  Authorization: Bearer <the host's JWT>
   ▼
Node's parser: a request it cannot read ──▶ 400, 408 or 431 bad-request, no-store
   ▼
report-server (createReportServer)
   ├─ onRequest, the root's first hook, before any body is read; each counted:
   │    a path that is not plain? ──▶ 400 path-not-plain, connection closed
   │                                  (the matched route's event, if one matched)
   │    a route ROUTES names? ── no ──▶ 404 not-found, connection closed, no event
   ├─ onRequest: the rate limit, by the client address (a named proxy's X-Forwarded-For)
   │       over it ──▶ 429 rate-limited
   ├─ preParsing, before any body is read: a token-bearing request a browser
   │  marks cross-site, from an origin not listed? ──▶ 403 cross-origin-refused,
   │  the token not read
   ├─ preParsing: one Bearer token, verified by data-identity -- the algorithm the
   │  key's kind pins, iss, aud, exp and sub -- and the tenant claim present
   │       any no ──▶ 401 unauthenticated, the verifier's reason in the log
   │  (either refusal of a request that carries a body closes its connection)
   ├─ a route that reads a body: a length declared past its limit ──▶ 413
   │  report-too-large or image-too-large, unread; a body that declares no
   │  length ──▶ the same 413 once it is read past the limit; a media type
   │  it does not read ──▶ 415, unread, closing as the refusals above
   ▼
whoami: the subject, the tenant, the roles, and what the actions table gives
those roles under the operator's policy (can, capacitiesOf, actionsOf);
or a route of the draft slice, sending what its use case answers
   ▼
onSend: Cache-Control no-store; the listed origin carried back
   ▼
onResponse (or onSend, or the connection's close, for a client that left):
one audit event -- the route, the status, the outcome's code, whether it was
identified, the tenant and the actor by keyed hash or null -- to the sink,
the server's own log line
```

Every refusal is a code and a fixed sentence that quotes nothing of the
request, and every bad token is the one 401 whatever was wrong with it
([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)).
A request that takes longer than 300 s to arrive, Node's own default, is
cut; a preflight is answered by the API path's OPTIONS route, uncounted,
and refused before its body is read when it carries one.
The verifier fetches nothing: its key is the one the operator's settings
name, a secret, a public key, or a key set read from a file and read again
on SIGHUP, by data-identity's own read
([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).
At start, before any of this, `main.ts` reads the settings once; one it
needs and lacks, or one it would refuse, stops it with a sentence naming
it.

## 6.17 A draft saved, a swap lost, and a reload

```
a host's page: a session opened from GET /v1/templates/invoice/draft,
revision 3 under its digest, ETag "3-…", every image it declares read into
the host's cache
   │  Save: report-client's saveDraft('invoice', report, draft), the Draft it read
   ▼
PUT /v1/templates/invoice/draft   If-Match: "3-…"   Content-Type: application/json
   │  6.16's hooks: the path, the rate limit, the origin, the token -- before
   │  any body is read; JSON alone, up to MAX_REPORT_BYTES
   ▼
the route (report-server's drafts.ts)
   ├─ If-Match and If-None-Match parsed: one strong tag draftVersionOf reads
   │  as a version, or * alone ── anything else, the bare "3" among it ──▶ 400
   │  bad-request, before the use case
   ▼
saveDraft (report-server-core), in this order, nothing written until the last:
   ├─ can(identity, 'draft.save', policy) ── no ──▶ 403 forbidden
   ├─ invoice is report-spec's identifier ── no ──▶ 400 template-id-invalid
   ├─ a precondition ── none ──▶ 428 precondition-required
   ├─ validateReport(body) ── no ──▶ 422 report-invalid, with its errors
   ├─ the report's id is invoice ── no ──▶ 422 template-id-mismatch
   ├─ every image it declares kept for the tenant as that kind, no font ──▶ 422 asset-not-kept
   ├─ store.newest is revision 3 under the digest the tag names ── no ──▶ 412
   ▼
store.save(tenant, 'invoice', 3, { savedBy: the token's sub, report })
   │  file store: tenants/<sha256 of the claim>/templates/invoice/draft/
   ├─ newest is not 3 ─────────────────────────────▶ not written: 412
   ▼
4.json written to a temporary name, flushed, then link(temporary, 4.json)
   ├─ EEXIST: another save from 3 linked first ────▶ not written: 412
   ▼
200 { template, revision: 4, digest }, ETag "4-…"; the page's next save is from it

412 draft-changed { revision: 4 }, no ETag, nothing written
   ▼
the host says someone saved since, and offers a reload: GET the draft again,
read its images, open a NEW session from revision 4 and dispose of the old
editor -- never replaceDocument in the old session, whose undo would bring
the stale text back as an edit and let a save from 4 overwrite the other
author's work
```

The use case decides everything but the swap, and the store decides the
swap alone: two saves from the draft at revision 3 both pass every
check, the comparison of its digest included, and the link lets exactly
one of them name revision 4's file. The loser is told the revision that
stands, in the refusal's body and with no `ETag`, since a tag comes only
with the draft it names, and the host reads that one before anything
else is saved. A page that still holds a draft at revision 3 that a
restore or a power cut took away, where another save has been given the
number 3 since, names the digest of the draft it read, so the comparison
refuses it before the swap, which compares revisions alone and would let
it through, unless the two hold the same report to the byte, whose save
goes through; only a draft's newest file removed while the server runs,
by hand or by a restore, between one save's comparison and its swap,
lets a save win over a draft its author never saw. Every revision stays
on disk; a read serves the newest, its record's digest checked and the
report served as it was saved, never validated again
([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).
A read of a record that is not JSON, not this format's, or whose report
its digest does not name is 500 `internal`, logged by its path inside
the tenant's directory and the tenant's keyed reference; the digest
covers the report and not `savedBy`, so a record whose `savedBy` alone
was edited is served as edited.

An image is kept the same way, by `PUT /v1/assets/{digest}`: the capacity,
the digest's form, the size, what the bytes sniff as and the media type
claimed, the header or the SVG's form, and the digest of the bytes, then
the store links `<64 hex>.<png|jpg|svg>` unless it is there already. The
host keeps the bytes in its cache before `keep` resolves (6.10), and a
save that declares an image the tenant has not kept, or kept as another
kind than it declares, is refused, naming it.

## 6.18 A chart, from the rows to its marks

What a chart prints is decided once, by the runtime; the renderer draws
the block, and decides nothing a reader reads.

```
resolveReport, a chart in the body or the summary, its condition true
   │  every aggregate already totalled (6.2)
   ▼
chartBlock(render, chart, path, style)                    report-runtime's lower-chart.ts
   ▼
categoryGroups(detail rows, the category's field, order, locale)
   ├─ asc, desc: the table's orderRows and groupRows, the rows without one last
   ├─ data: each key once at its first row, found by canonicalKey through a Map
   ├─ more than MAX_CHART_CATEGORIES ────────────────────▶ chart-too-many-categories
   ├─ a pie of more categories than its palette's colours ─▶ chart-too-many-categories
   ▼                                              both before anything is totalled
each category's label: its key in category.format, or category.nullLabel
   ├─ a format that cannot print it ─────────────────────▶ format, at …/category
   ▼
each series at each category: totalOf(the series as an aggregate,
totalsInDecimals(seriesType(report, series).type, rounding), its values, rows)
   ├─ a rounding of an integer total, past report-core's check ──▶ rounding-not-decimal
   ▼                                     null where the series has no value there
nothing to draw: no rows, no value, a pie whose values are all zero
   ├─ yes, and not a pie with a negative value ──▶ the title and the empty text alone
   ▼
bar, line                                  pie
chartTicks(every value of every series,    a negative value ──▶ chart-negative-share
  bar or line, valueFormat.scale)          whole = the sum of its slices as totalled
each value and tick in valueFormat,        share = ratioRounded(value, whole,
  in the report's scope                      SHARE_PLACES + 2, half away from zero)
  ├─ refused ──▶ format, at …/valueFormat  value in valueFormat, share by percent
a legend of its series, two or more        a legend of its categories,
                                             `label: value (share)` with value labels
   ▼
the chart block: every word it prints, each value's exact digits beside its text,
its ticks, its colours by place ──▶ the ResolvedDocument (6.2)
   ▼
renderPdf (6.2): checkChart, before pdfmake sees it      report-render-pdf's check-chart.ts
   ├─ in a page region; a kind, a box, a colour or a style it does not know;
   │  past MAX_TICK_INTERVALS or MAX_CHART_SERIES; its parts unmatched; a
   │  word with a control character, or one its face has no glyph for; a
   │  value no decimal, uneven ticks, a slice below zero ───▶ unsupported
   ├─ more than MAX_CHART_CATEGORIES categories or slices; wider than
   │  where it stands; taller than the body ──────────────▶ content-too-large
   ▼
checkChartDrawing: the render's charts weighed together, each its kind's
weight, a unit a point and each word's weight, before any is laid out
   ├─ past MAX_CHART_DRAWING, at the chart that crossed it ─▶ content-too-large
   ▼
drawCharts: each chart's faces from the render's plan, opened by Engine.widths
   ├─ nothing to draw ──▶ drawEmpty: its title and empty text placed, no ECharts
   ▼
chart-draw.ts, imported through loadOnce with the first chart that has marks
   ▼
withMeasurer: zrender's measureText answers in pdfmake's widths, 国 in the
face's line, for one layout, and is put back after it
   ▼
layout 1, the bands: where the title and the legend stand
layout 2, the plot: ECharts fits it between the bands, read by convertToPixel
   ├─ bars narrower than MIN_BAR_WIDTH ───────────────────▶ content-too-large
   ▼
snapped: its top on a half point, each interval whole points; tickEvery
   ├─ too short for two tick labels TICK_CLEARANCE apart, or
   │  a category label wider than its slot less half a line ─▶ content-too-large
   ▼
layout 3, drawn; a pie, laid out in its square, its arcs written again on its circle
   ├─ a pie's square narrower than MIN_PIE_DIAMETER ──────▶ content-too-large
   ▼
readChartSvg: the SVG held to what ECharts 6.1.0 writes, each <text> taken out
and read back as the box pdfmake prints its word in, its clips taken out
   ├─ anything else, or a word the block does not hold ───▶ unsupported
   ▼
held: words that would meet, leave the box or stand in the plot ──▶ content-too-large
   ▼
chartContent, in every pass: one unbreakable stack of the SVG, each word as
pdfmake text where ECharts placed it, and a spacer of the box's height
```

Every refusal names the chart by its id and says counts, never a value, a
label or a category. A chart's number and the table's beside it are read
by `fieldValue`, grouped by `sort-group.ts`, totalled by `totalOf` and
printed by the one formatter, so where both print a total of the same
rows in the same format, they print the same text
([0055](../decisions/0055-the-runtime-resolves-a-chart-exactly-its-totals-as-every-total-and-every-word-it-prints.md)).
The ticks are BigInt division on a decimal's units, and a share an exact
ratio rounded once and printed without rounding again, so nothing a chart
prints passes through a double. The renderer makes nothing of the block
but coordinates: a value's place, its distance from the lowest tick in
the ticks' interval worked out in BigInt and made a double at the end,
and a slice's exact share; every word it draws is in the block, looked up
by index, and a word ECharts wrote that the block does not hold is
refused. ECharts lays the chart out, and the renderer only snaps the plot
it chose and reads back where every word went: a chart whose words would
meet or leave its box, whose labels do not fit across, or whose bars are
too thin to see, is refused, naming it and its box and saying sizes,
never moved, cut or turned to fit; and a render whose charts together
weigh more than `MAX_CHART_DRAWING` is refused before any of them is laid
out [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md).

## 6.19 A PDF/A-2b, from the host's option to the PDF

Numbered 6.19 while 6.18, a chart's resolution, was held by a branch not
yet merged, the chart runtime's pull request (#72).

```
host: renderPdf(document, { maxPages, pdfa: '2b' })        a final render
   ├─ pdfa anything but '2b' or left out ────────────────────▶ RangeError
   ▼
checkPdfA(document, '2b'), once, before pdfmake sees it:
   ├─ an e-invoice it does not know ─────────────────────────▶ unsupported, as without pdfa
   ├─ a Factur-X, or an XRechnung's copy ────────────────────▶ unsupported, eInvoice
   ├─ a page header opening with the runtime's PREVIEW_LABEL
   │  or E_INVOICE_PREVIEW_LABEL, one run ───────────────────▶ unsupported, pageHeader
   ├─ a title its XMP cannot hold ───────────────────────────▶ unsupported, info.title
   ▼
Checked.pdfa = { subset: 'PDF/A-2b' }, which each reader takes:
   ├─ the images: a CMYK JPEG, an SVG past PDF/A's integers
   │  or 28 graphics states (6.9) ───────────────────────────▶ unsupported, the image
   ├─ the measuring passes: neither version nor subset, the pages
   │  laid out as the final pass lays them out
   ├─ the final pass: version 1.7, subset PDF/A-2b; no hook runs,
   │  so nothing is embedded
   ▼
PDFKit ends it: the pdfaid identification, part 2 and B, the
sRGB output intent with the ICC profile it reads from its own
package, the XMP ────────────────────────────────────────────▶ a PDF/A-2b
```

A document is drawn as a PDF/A-2b only where the host asks, and the
renderer decides what it is drawn as in one place, `checkPdfA` in
`pdfa-check.ts`: the definition, the hook and the image checks read its
answer and none of them decides it again. The renderer has no mode, so a
preview is known by the label the runtime heads its every page with, as
an XRechnung's copy is by its own (0038): a labelled preview is refused
as a PDF/A-2b, since it would be kept as the report, and one that lacks
nothing carries no label and is drawn as its final render is. The pages
are the plain render's, so an archive holds the PDF the person saw. The
e-invoice gate draws every starter that is no e-invoice so, and has
veraPDF judge them with its PDF/A-2b profile, `--flavour 2b` and never by
what the file says it is
([0057](../decisions/0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)).

## 6.20 A first page's own header, from the region to page 1's top

```
the definition's firstPageHeader, beside the page header      absent, [] or components
   ├─ a table, a chart, a page break, a kept block ─────────▶ misplaced-flow-component
   ├─ a page number or count ───────────────────────────────▶ misplaced-page-counter,
   ▼                                                          sent to the page footer
resolveReport: lowered as the page header is, each condition once
   ├─ every component hidden, or none written ──▶ [], never the page header's blocks
   ├─ a preview, an e-invoice preview, an XRechnung ──▶ its label heads both headers
   ▼
document.firstPageHeader                        present exactly when the report's is
   ▼
renderPdf: walked as a page region drawn once
   ├─ a page field, a page break ───────────────────────────▶ unsupported
   ├─ an XRechnung's that does not open with the copy ──────▶ unsupported, naming
   │                                                          firstPageHeader
   ├─ its SVGs counted once toward MAX_SVG_DRAWING
   ├─ the page header and footer measured, as for every report
   ├─ page 1's own header measured in a pass of its own
   │  taller than the printable area, or leaving page 1
   │  no body with the footer ──────────────────────────────▶ content-too-large,
   │                                                          naming firstPageHeader
   ├─ a block of fixed height past the shorter body ────────▶ content-too-large
   ├─ kept blocks and table lines held to the later pages' body, the page
   │  limit to page 1's body and the later pages' it leaves, the slip to
   │  the taller header
   ▼
pdfmake, its top margin the page header's
   page 1: no header; its background is page 1's own header, at the margins,
           in a box as large as the page; the body opened by an empty node
           whose top margin is the two rooms' difference, down or up
   page 2 on: the page header, as before
```

Which header a page prints is decided by the renderer, which alone knows
the pages, as the slip's page is (6.6); the runtime resolves every value
once and evaluates nothing per page. Page 1's own header cannot stand in
pdfmake's header, whose box is the top margin, one for every page: a
taller one would lose lines there, and room given to it there would be
taken from every later page. So it is drawn in page 1's background, and
page 1's body is moved by the difference, on behaviours of pdfmake 0.3.11
that `report-render-pdf/src/pdfmake.test.ts` holds. A report without the
region is resolved to a document without the key, measured in the passes,
on the sheets and with the messages it always was, and drawn object for
object as before
([0060](../decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)).

## 6.21 Several tables, from the detail rows to each table's totals

```
resolveReport, a table in the body or the summary, its condition true
   │  every aggregate already totalled over every detail row (6.2)
   ▼
tableBlock(render, table, path, style)                 report-runtime's lower-table.ts
   ├─ every column hidden ──▶ nothing, and no condition read
   ▼
selectedRows: no rowsWhen ──▶ every detail row; table = the report's totals, the same values
   │  rowsWhen read once a detail row, in the row's scope -- params, header,
   │  totals, row -- in the data's order, each reading within RENDER_STEP_BUDGET
   ├─ fails for a row ──────────────────────▶ evaluation, naming the row by its index in the data
   ├─ a preview lacks a field it reads ─────▶ the row left out, one warning per field
   ▼
orderTable(report, table, detail, selected)                         sort-group.ts
   │  the selected rows ordered and grouped by orderRows and groupRows,
   │  each kept at its index in the data
   ▼
table = Totals.over(the selected rows)      each declared aggregate, rounded once
   ▼
each cell in its row's scope; a group's header and footer in groupScope, which
binds group and table; the total rows in tableScope (render-context.ts), which
binds table beside totals
   ├─ no row selected ──▶ the empty text, the total rows beneath it, totals of nothing
   ▼
the table block: the rows it prints, as every table's ──▶ the ResolvedDocument (6.2)
```

What a table prints is decided once, in its lowering: the rows its
condition selects, ordered and grouped by `sort-group.ts` and totalled by
`Totals.over`, the function a group's totals are, so a table's subtotal
and its total are of the rows printed above them. `totals` stays every
detail row's, under every table and in the summary, a payment code, the
e-invoice and a chart, and a table without a condition is handed the
report's totals themselves as `table`, so a report without conditions
resolves to the document it did. A render in a language the report
declares (0063) reads the condition as written, since a condition is no
word (`NOT_WORDS`), so every language selects the same rows. An
e-invoice's lines' table has no condition, which the validator holds, so
`e-invoice-lines.ts` orders every row as before. The document gains nothing: a table is the rows it prints,
and the renderer draws any number of them as it drew one
([0062](../decisions/0062-a-report-holds-several-tables-over-its-detail-rows-each-printing-and-totalling-the-rows-its-condition-selects.md)).

## 6.22 A Word file, from the resolved document to its parts

```
renderDocx(document)                                       report-render-docx's render.ts
   │
   ▼
planFonts: each mapped face read once by readFont; the family each token is named by
   ├─ bytes that are no font, a family with no name Word can state or
   │  one longer than MAX_DOCX_FAMILY_LENGTH, which Word does not read ─▶ invalid-asset
   ├─ a token with no regular face, or faces of two families ──────────▶ unsupported
   ▼
checkDocument: before a byte is written, in this order                          check.ts
   ├─ a creation date that is no date, states no instant, a day no
   │  calendar has or a year no core property has; a title XML cannot
   │  hold ────────────────────────────────────────────────────────────▶ unsupported
   ├─ an e-invoice, a preview's label ─────────────────────────────────▶ unsupported
   ├─ a page of no known size or turn; margins that leave nothing ─────▶ unsupported,
   │                                                                     content-too-large
   │  then one walk: the page header, page 1's own, the page footer and
   │  the body, each block in document order:
   ├─ a chart ─────────────────────────────────────────────────────────▶ unsupported
   ├─ a QR code or an EPC QR code: past MAX_DOCX_CODES, before anything
   │  of it is worked out ─────────────────────────────────────────────▶ content-too-large
   │  its symbol, by the runtime's qrSymbol or epcSymbol, once: what
   │  the PDF renderer refuses, in its words ──────────────────────────▶ unsupported,
   │                                                                     content-too-large
   │  past MAX_DOCX_CODE_MODULES, its symbol's modules with those of
   │  the codes before it; taller than the printable area ─────────────▶ content-too-large
   ├─ a table or a page break in a framed section ─────────────────────▶ unsupported
   ├─ what no engine prints, by the PDF renderer's code and subject ───▶ unsupported,
   │                                                                     content-too-large
   ├─ a character a report does not print, XML does not hold or the
   │  mapped face does not draw; a face the report maps no font to ────▶ unsupported
   ├─ a line outside the weights of Word's borders; a rectangle, a
   │  column or a framed section under a fortieth of a point ──────────▶ unsupported
   ├─ past MAX_DOCX_PARAGRAPHS, MAX_DOCX_CHARACTERS or MAX_DOCX_RUNS,
   │  counted as it walks: a rectangle and a frame two paragraphs, a
   │  line ending a run, what a family is written past its bound with
   │  the characters ──────────────────────────────────────────────────▶ content-too-large
   │  then the pictures, each asset read once, in the order the walk
   │  met them:                                                      check-pictures.ts
   ├─ past MAX_DOCX_PICTURES, counted before an asset is read ─────────▶ content-too-large
   ├─ an asset of no bytes, or of more than an asset may be ───────────▶ invalid-asset
   ├─ past MAX_DOCX_MEDIA_BYTES, counted from an asset's length before
   │  a byte of it is read ────────────────────────────────────────────▶ content-too-large
   ├─ bytes that are not the picture they are declared as, by their
   │  first bytes and their structure ─────────────────────────────────▶ invalid-asset
   ├─ past MAX_DOCX_IMAGE_DATA, counted from a picture's header before
   │  a PNG's data is inflated ────────────────────────────────────────▶ content-too-large
   ├─ a PNG whose image data is no whole zlib stream of its scanlines,
   │  inflated by pako as zlib inflates it ────────────────────────────▶ invalid-asset
   ├─ a JPEG its Exif block turns or of four components ───────────────▶ unsupported
   ├─ an SVG that covers a box of other proportions, a picture drawn
   │  at under an English Metric Unit ─────────────────────────────────▶ unsupported
   ├─ a QR-bill's payment part, last, where the PDF renderer checks its
   │  bill: what the runtime's checkQrBill refuses, in its words, and a
   │  character SIX does not allow a bill, which has no width here ────▶ unsupported,
   │                                                                     content-too-large
   │  a line wider than its place, a part's information taller than its
   │  section; past the file's bounds with the slip's paragraphs ──────▶ content-too-large
   ▼
each region's blocks as paragraphs and tables, in points          nodes.ts, blocks.ts, table.ts
   │  a text without the line ending that ends it; the keep rules mark
   │  them, each in one pass: a heading through to what it heads, a kept
   │  block but what ends it, the header row, a group header's kept
   │  rows, the row before a closing row
   │  a code a picture's paragraph exactly its size; in Austria's frame
   │  an empty line kept with a table of its picture, its cell bordered
   │  around, and its caption beside it, the row at least the frame's
   │  height, and an empty line under it                                      codes.ts
   ▼
WordprocessingML, every element's children in ECMA-376's order; every
string through text or attribute, markup a type of its own               wml.ts, xml.ts
   ▼
the parts, their content types and relationships, named by the writer alone;
a code's picture a PNG made of its symbol, whole pixels a module          code-png.ts
a QR-bill's slip the file's last section, a page of its own            slip.ts
zipped by fflate, every entry dated 1 January 1980                          package.ts
   ▼
Uint8Array ── the same bytes for the same document
```

The writer reads the document the PDF renderer reads and nothing else: no
option, no signal, no clock. Everything it refuses it refuses before
anything is built, so a file is written whole or not at all, and by where
a thing stands, not by its kind: a face that is no font, as the fonts
are read, the creation date and the title, what
belongs to the PDF of the document itself, the page, then each region's
blocks in document order -- a chart no engine draws, or a code the rules
refuse, where the walk meets it, after a block no engine prints that
stands before it -- then the pictures' bytes, and a QR-bill's payment
part last, where the PDF renderer checks its bill. A code's symbol is the runtime's, asked
for once where the walk meets the code, and the picture written is of
that symbol: what is refused and what is written are one decision, and
the PDF's ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)). A chart is held where the walk meets it too: to
the file's bound on its charts before anything of it is read, to what
any engine refuses of its block, to the bound on its points before a
word or a number of it is read, and counted with the paragraphs and the
characters; it is written as a part of its own as the body is built,
from the block alone, and nothing of it is laid out
([0076](../decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md)). A QR-bill's slip is the one thing the writer
lays out, on a page that holds nothing else: the runtime's rule refuses
a bill no engine draws, in the PDF renderer's words; each value is
broken into lines by the widths of the slip's face, and a line wider
than its place or information taller than its section refuses the
bill; and the slip is written as the file's last section, each line and
each white of an exact height, so that each section stands where SIX
puts it, no line shorter than its face's own, and no row of an exact
height, since either would cut what does not fit it
([0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)). A report that carries an e-invoice is
resolved twice by its host: once as the invoice, whose document carries
the XML and is drawn as its PDF, and once with `eInvoice: 'copy'`, whose
document opens every header with the copy's label, carries no XML, and
is what the writer is handed. The writer refuses the first for its
e-invoice; of the second it reads the label before any block is walked,
refuses a header that does not open with it as written, and writes it
once more as the header of a slip's page
([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)). The writer's `refusals.test.ts` holds that order on a
document wrong in every one of those places, put right a place at a time,
and the corpus's `wordRefusal` derives from a document on its own what
the writer must refuse of what belongs to the PDF. What belongs to the
PDF is refused by a sentence that says to print the report as one; what
no engine prints is refused by the code and the subject the PDF renderer
refuses it by, which the corpus's `MALFORMED` documents hold of both
engines for a document wrong once, and `against-pdf.test.ts` for one
wrong in every place both look, where the two refuse it for the same
place at each step. A document wrong in a way only one engine refuses,
and in another, is refused by each for what it meets first.

What is written says what the document says and lays nothing out: a table
is a Word table with its header row marked as the one to repeat, a kept
row marked as kept, a page's number a field Word works out. Where a line
and a page break, how many pages there are, and whether Word does what a
mark asks, are Word's, and no test here says. The writer measures
nothing, so a refusal the PDF renderer makes of what it measured -- a
block taller than a page's body, more pages than a host allows -- the
writer does not make: a host that offers the file only beside a PDF that
was drawn, as the Studio does (6.5), hands a person nothing the renderer
refused
([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
