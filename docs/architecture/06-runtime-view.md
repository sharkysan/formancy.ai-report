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

## 6.2 A render, from data to bytes

```
host: resolveReport(report, data, { mode, parameters, images, creationDate, timeZone })
   │
   ▼
validate the report again, compile every expression     it arrives as untrusted input
   ├─ an error the editor's diagnostics would give ──▶ refused
   ▼
check the data: one header record and one detail list, each value held to its
field's type, a field the report does not declare refused, MAX_DETAIL_ROWS;
where it names its source, the syntax of identifiers and its shape's keys (0041)
   ├─ a source past either, more submissions than rows, or a provider unknown ──▶ refused
   ├─ final, and a field missing or the data incomplete ──▶ refused
   ├─ preview ──▶ go on: nothing printed for it, one warning per field
   ▼
evaluate conditions and expressions        fixed capabilities; EXPRESSION_STEP_BUDGET
   │                                       each, RENDER_STEP_BUDGET a render
   ▼
order and group the rows; compute each aggregate exactly, then round it once
   ▼
an e-invoice's lines, read once from its table's rows; its totals computed
once; its other terms held to EN 16931's rules (6.8)
   ▼
format every value for the locale          Intl handed exact digits, never a double
   ▼
images through the host's lookup, by id and digest, once each; an SVG
past MAX_SVG_BYTES refused (6.9)
   ▼
a QR-bill's texts, and an EPC QR code's, resolved and held to their code's
rules; the EPC QR code's payload written (6.7)
   ▼
in a final render, an e-invoice's CII XML, written from those values (6.8)
   │
   ▼
ResolvedDocument + manifest, naming the data's source where it has one
(+ a preview's warnings)                                     every reason, or none
   │
   ▼
renderPdf(document, { maxPages, signal })
   ├─ before pdfmake sees it: a glyph per character, nothing malformed or
   │ wider than where it stands, each asset's bytes, an SVG's in the form
   │ cleanSvg writes and within what SVGs may cost (6.9), a bill, each
   │ code encoded once and held to its square ───────────────▶ RenderRefusal
   │ an e-invoice it does not know; in a Factur-X invoice, a title
   │ its XMP cannot hold, a CMYK JPEG, an SVG whose numbers or
   │ nesting its PDF/A cannot hold (6.9) ────────────────────▶ unsupported
   ├─ a bill or a captioned EPC QR code: Liberation Sans read, and in a
   │ browser its chunk imported
   ├─ measure the page regions; the body's margins follow
   ├─ a block of fixed height taller than the body ──────────▶ content-too-large
   ├─ least height already past maxPages ────────────────────▶ too-many-pages
   ├─ measure kept blocks and table rows; one no page holds ─▶ content-too-large
   ├─ plan where each table breaks
   ├─ lay out the PDF; a page past maxPages ─────────────────▶ too-many-pages
   │       in every pass, a word wider than its column ──────▶ content-too-large
   │       an abort is read between passes ──────────────────▶ cancelled
   ├─ an e-invoice: a PDF/A-3b, and on this last pass alone its XML embedded
   │ and its XMP written, through PDFKit's document before it ends (6.8)
   ▼
Uint8Array
```

The runtime never returns part of a document and the renderer never
resolves to part of a PDF
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
Every value reaching the renderer is already the string it prints, so the
renderer has no total to round twice. The PDF's creation date is the one the
host passed, so one document renders to the same bytes every time
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)),
and the images PDFKit is still decoding when pdfmake hands the document
over are written in the order pdfmake opened them, however their decodes
finish
([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).

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
preview(): resolveReport, in the mode the Preview is in ──▶ renderPdf from
           '@formancy/report-render-pdf/browser', up to PREVIEW_PAGE_LIMIT pages
   ├─ refused by the runtime ──▶ every reason, each with a button that selects
   │                             the component it is about
   ├─ refused by the renderer ──▶ its code and what it names
   ▼
PDF.js draws each page on white paper with its text layer; Download PDF gives
the bytes those pages were drawn from
```

The Preview makes the same two calls a host makes, with nothing decided in
the Studio ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
A render the renderer cannot stop mid-pass finishes into nothing rather
than replacing a newer one.

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
renderPdf: the payload encoded once by uqr, at level M and EPC_MAX_VERSION at most
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
drawn, and refuses one whose page header does not open with the label as
the runtime writes it, `XRECHNUNG_COPY_PARAGRAPH`, style and all
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
   ├─ the SVGs past MAX_SVG_DRAWING, a page region's counted
   │  on every page maxPages allows; the body's past one
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
vectors on the page, drawn again on every page in a page region
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
