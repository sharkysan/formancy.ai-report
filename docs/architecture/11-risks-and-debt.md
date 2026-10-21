# 11. Risks and technical debt

Written so that a reader can tell what is known and accepted from what is
merely not done yet.

## 11.1 The register comes first

Every decision record's costs that a user, an integrator or an operator of a
release will meet are in [`limitations.json`](../release/limitations.json),
one sentence each in the record's own terms, or the reason a record has
none. Each entry carries the hash of its record as it was read, so a record
edited since fails `pnpm test:repo` until somebody reads it again; an entry
whose truth a test shows names that test, and the release report fails a
run in which it did not pass. Every run's report prints the register
([`../release/README.md`](../release/README.md)).

This chapter does not restate it. It names the larger risks the records
accept, and the debt that is no single record's.

## 11.2 The larger accepted risks

### The licence has not been read by a lawyer

It is in force and says so at the top. Until a lawyer reviews it, it is a
statement of intent made carefully, and a customer's production agreement
is the document that governs; the legal release gate is open
([0001](../decisions/0001-a-paid-module-in-its-own-repository.md),
[`gates.json`](../release/gates.json)). The CLA has not been reviewed
either.

### The format is a draft

`reportSpecVersion` is `'0'`, and nothing written under it is promised to a
later release: a report written now may need re-authoring or migrating when
the format freezes. 0.2.0's additions — the QR code, the payment
part, the EPC QR code, the e-invoice and the SVG asset — went into the same
draft version, and 0.1.0 refuses a report that uses any of them, whole
([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md),
[0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md),
[0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
[0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

### The renderer leans on pdfmake's defaults and internals

Most of the adapter exists to stop pdfmake doing what it does by default,
and some of it reads what is not pdfmake's API: the widest word it writes
on each text node, and the positions it records on a node. A pdfmake
upgrade can move any of it. Each behaviour is pinned by
`report-render-pdf/src/pdfmake.test.ts` and the corpus, at an exact
version, so an upgrade is a diff somebody runs those tests on
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
A pass cannot be interrupted, and no worker that could be killed is built.

PDFKit's images are leaned on too. report-render-pdf pins PDFKit at
0.19.1, which npm places where pdfmake finds it, and the install gate
holds that pdfmake loads it; a host on pnpm or Yarn, or with a PDFKit of
its own, was not measured and may resolve pdfmake's `^0.19.1` otherwise
([0036](../decisions/0036-the-renderer-pins-pdfkit-at-the-release-0035-was-read-against-until-pdfkit-writes-images-in-the-order-it-embeds-them.md)). PDFKit numbers
a PNG's soft mask, and writes the image, when its decode calls back, so the
renderer wraps each such image's `finalize` in the registry pdfmake keeps
them in, to have them written in the order pdfmake opened them. A 0.19.x
that moved the registry, a PNG's `image` or `finalize` would leave the
images in the order their decodes finish -- bytes that vary, pages that
do not; one that kept `finalize` but called it past `this` on one of its
three decodes would leave every image opened after that one waiting, and
the render would never end, neither printing nor refusing. The renderer's
suite, which runs on the lockfile's 0.19.1, would see neither; the
install gate, which installs what a host would and draws each decode
ahead of another image, fails on both. The fix belongs in PDFKit,
decoding at once or numbering and writing in the order it embeds, and
has not been asked of it; the pins in
`pdfmake.test.ts` and `browser.test.ts` fail when it arrives
([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).

The SVG converter pdfmake vendors, svg-to-pdfkit, is leaned on most of
all. What it would do with an SVG as it came — open an `<image>`'s file
past pdfmake's access policy, write a link to any address with no callback
to stop it, draw text in a face pdfmake chooses, recurse until the stack
overflows, expand `use` until the process dies — is kept from it by
report-spec's cleaner and the renderer's check, with its own list of
elements and the converter's callbacks behind them; and what it does with
an approved drawing — xmldoc's copy, its clip, a group the size of the page
for every clip and translucent gradient, drawn again for every reference —
is pinned by `pdfmake.test.ts`, so an upgrade that changes one shows. A
group of the element's own size, and a callback for links, would be
svg-to-pdfkit's to add; neither has been asked of it
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

### An SVG logo costs every reader, and some files are refused

Every recipient's viewer, and the Studio's Preview on every edit, pays to
paint what a logo holds, and svg-to-pdfkit makes each clip and translucent
gradient a group the size of the page, so a small logo can cost what the
page's pixels cost. The worst drawing the bounds accept, a path every
segment of which crosses its box in a clipped group, added 190 ms to a page
at a device pixel ratio of 1 and 392 ms at 2 drawn 15 mm square, and 269
and 550 ms page-wide, against 63 to 89 ms for a starter page, measured on
18 October 2026 in a headless Chromium drawing in software on one machine;
on a slower reader, a GPU or another browser, nothing here measured it. A
logo in a page header is drawn again on every page, growing the PDF and the
render with the page count. And the price of failing closed is refusals:
live text, Illustrator's editing capabilities, Canva's lettering and a
Canva logo of many shapes, a filter, a mask, a colour with an alpha, and a
drawing past 10,000 weighted segments, which a detailed crest can be. The samples those refusals were counted on are invented, and how
many real logos are refused is not known
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

### An SVG in an e-invoice is held to PDF/A by a bound, not by reading the PDF

An e-invoice is drawn as a PDF/A-3b
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)),
which holds an integer to 2,147,483,647 and nests the graphics state 28
deep at most. svg-to-pdfkit writes a page-sized group's box and a
gradient's matrix through the inverse of the drawing's transform and the
image's box, a gradient's and a clip's in the box it measures on the
outline, and an outline in points of its own, an arc's grown to reach its
ends and a reflected quadratic's walked away from the path, so an approved
logo could pass the range: one whose clip and transparency are shrunk a
millionfold, a point square, wrote a box of 78,520,000,000 into an
e-invoice that said it was a PDF/A-3b, which veraPDF 1.30.3 failed, and an
arc of radii a millionth and a million wrote control points of 5 ×
10^17 at any size. The renderer now refuses such an image in an e-invoice
before pdfmake runs, by an upper bound on every number the converter will
write for it, from the extent report-spec's cleaner measured -- over every
box inside a shape's, since the cleaner holds a curve by its control
points and the converter by its outline -- the image's box and the page,
less a margin of 5.7 % for rounding
(`report-render-pdf/src/svg-pdfa.ts`); a report that is no e-invoice
draws it as before. PDF/A-3 keeps none of PDF/A-1's 32,767 for a
real: veraPDF's PDF/A-3b profile holds a real to 3.403 × 10^38, past the
10^21 at which PDFKit throws; and the groups' `/DeviceRGB` is accepted
beside the sRGB output intent, in the gate's two SVG variants.

What is not held: the bound assumes the converter's arithmetic agrees with
the cleaner's to that margin, which matrices built to cancel one another
term by term could defeat; the bound is checked against the numbers read
back only in the tests and the e-invoice gate, never at print, and veraPDF
reads none in a soft mask's group, a clip's; and the converter's numbers are
pdfmake 0.3.11's, so an upgrade must be measured again
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

### An added image is checked to its header, and kept for good

A person's file is read on the page's main thread: its digest by
`@noble/hashes`, about six times Web Crypto's time in Chromium, 360 ms for
20 MiB on the machine it was measured on. A PNG whose image data does not
inflate to what its header promises, or a JPEG whose scan is corrupt, is
added, kept and declared, and refused as `invalid-asset` only when it
prints; so is a CMYK JPEG added before its report gained a Factur-X
invoice, at the final render. The id a host is handed is the one the add means to
declare, and another editor of the session may declare it meanwhile for
other bytes: a host that keyed its store by id alone could print another
image unseen, and only the documentation of `ImageStore` says to key it
by digest. A `keep` that never settles leaves Add image… unavailable for
the editor's life. The host's store only grows, because a redo needs the bytes; the
Studio holds everything a person adds, up to 64 images of 20 MiB in each
starter's report, in the tab's memory, and nothing measured where the tab
gives out. An added image's id is its file's name folded, and a file's name
can name a person, in a report that goes wherever reports go. And the
runtime still trusts a host's bytes to be what their digest says
(0010): report-spec can now take the digest, and nothing checks it at
print ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).

### Formancy Data is read best-effort, and only a stand-in has answered

The header, each page and each label are read at different moments, so a
row can print twice or not at all and a total can mix moments. The
provider has run against a fixture that answers Data 0.1.0's routes, never
against a Data server with a database and a policy behind it. Every Data
release is a new admission and a release of this package
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).

### Two builders, written twice

Every visible change is made twice and reviewed twice. The scenarios, the
comparison of the two accessible trees, and the install gate's one
statement of the structure both draw (`scripts/install-fixture/structure.ts`)
find a builder drifting from the other or from that statement. What the
core's README says beyond them — where a choice is one no scenario can see
— is prose, and nothing executes prose
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).

### What prints depends on the engine's ICU

Grouping marks, currency symbols and month names come from the JavaScript
engine's ICU, so the same report can print differently under another Node,
and an ICU that changes how fr-CH groups an amount, or where de-AT, nl-NL
or en-IE put the euro sign, fails the samples' pictures and then the pages'
quotes until they are taken again
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
[0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
[0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).

### Tax and invoicing law nobody here checks

The euro invoice's samples print each country's standard VAT rate as one
day's table gave it, and sell parts because a home's maintenance takes a
reduced rate in some of their countries; they print the mentions France's
administration asks of a company's invoice, and not those the other
countries' laws may ask. None is an e-invoice, and the Italian says it is a
courtesy copy of one. The e-invoice samples' German law -- firewood at 7 %,
heating installed for a builder reverse-charged, an instalment's interest
exempt -- was read once in the UStG and not in the UStAE, and they do not
claim that a given case is so. Nothing reads a rate or a law again, and
none of it is a tax adviser's reading
([0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
[0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).

### An e-invoice rests on readings, and on its validators

The Factur-X 1.09.2 / ZUGFeRD 2.5.2 specification sits behind a
registration with FeRD that only the rightsholder can make, and nobody
has: what a Factur-X PDF says of its XML -- the relationship, the
conformance level, and the XMP's fx namespace, prefix, four properties and
extension schema's name -- rests on a transcription of it, marked [S], and
on Mustang's reading the same names, and the release's XSD and schematron
on Mustang's copies of FeRD's. The transcription gives the fx namespace
twice: its §6.3.1 as `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#`,
and its BR-HYBRID-04 as `urn:factur-x:pdfa:CrossIndustryDocument:1p0#`,
without `:invoice`; it calls that an inconsistency and treats §6.3.1 as
authoritative, and the renderer writes §6.3.1's form, as akretion's
generator and PDFlib's sample do [S]. No tool in the gate reads the fx
namespace, so if the specification means the other, every e-invoice
carries the wrong one unseen; the renderer's test compares the values
with the transcription's, and says so, until the official package's XMP
example is recorded. No tool compares the XMP's conformance level with the
XML's profile either, and the gate's own reading does, for every PDF the
renderer draws in it. Mustang exits 0 on a PDF whose XML is valid
whatever its PDF/A says, compares neither a file's declared /CheckSum and
/Size with its bytes nor its relationship, and veraPDF reads no value of
the XMP's extension, so the gate reads Mustang's PDF part and veraPDF's
report, and counts each PDF's files with pdf-lib ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)). report-spec's rules follow CEN's artefacts 1.3.17, and
the pinned tools run 1.3.16, so where the two differ the tools decide, and
a rule renamed in a later release fails the gate until the ids are read
again. The e-invoice is made for Germany: France's XP Z12-012 was not read,
and no French platform's acceptance of the file is known. Its codes come
from lists narrower than CEN's, which are the rightsholder's to widen, and
whether copying them out of CEN's EUPL-1.2 artefacts is acceptable is the
rightsholder's question. Nothing checks that what an invoice states is
right: a wrong rate, a wrong exemption reason or another seller's VAT
identifier passes every rule
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
An electronic address is held to its scheme's list and, but for a
Leitweg-ID under 0204 (0038), to no form of its scheme's: an email address
under a GLN's scheme, or a GLN of a wrong check digit, passes; the two shapes a contact is held to are copied, as
strings, from KoSIT's XRechnung schematron, whose licence was not read;
and the telephone number's is run as the count of digits it asks for, held
to the expression on every short text, and by KoSIT on the XRechnung
sample alone
([0037](../decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)).

An XRechnung rests on more readings still. The Leitweg-ID's format
specification could not be read, so the shape and check digits held of an
address under 0204 are FeRD's description and secondary sources', checked
against KoSIT's test values alone, three of which they refuse; that
XRechnung 3.0 is in force until 31 July 2027 is a secondary source's; and
4.0, which replaces the Skonto syntax an XRechnung's payment terms may not
hold today, is not backward compatible. KoSIT's XRechnung scenario and
Mustang judge one XRechnung, the sample, and Mustang fired 25 rules on it
where FeRD's schematron fired 179 on a Factur-X sample, in the recorded
run. The rules held by the format are held to their tests as the pinned
schematron writes them, and by the sample alone in a file. The copy an
XRechnung's PDF is carries no XML, and says so in the runtime's English
words alone ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).

### Codes nobody scanned, and bills nobody paid

Every code a test prints is decoded by ZXing, and that is all. Neither the
QR code nor the Swiss QR Code marks its text as UTF-8, which ZXing reads
anyway and a reader keeping to ISO/IEC 18004's default would not; an EPC QR
code does not mark it either, and says UTF-8 only in its payload's own
third element. What a phone or a banking app does, nothing here shows, and
the EPC's guidelines are informative: a bank need not read its code at all.
The slip's cross, its scissors and several sizes SIX leaves open are this
repository's choices, as are the line of Austria's frame, its place and the
caption's size, within what the PSA allows; and the frame's corners reach
half a module into the quiet zone, as the PSA's own figure does. Whether a
bank or an app refuses a code for any of these is not known
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
[0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

### An EPC QR code rests on a table, and on readings of the EPC

Which countries the code pays to, and each one's IBAN length, is a table
recorded on one day from the EPC's list and a copy of SWIFT's registry, so
a country joining SEPA, or a length the registry changes, reaches an
installation only through a release. Where the EPC's documents are silent,
0025 reads them, and says so: a BIC of another country than its IBAN's is
refused, an inference neither document states; a BIC is asked for on the
account's side alone, though a payer's bank outside the EEA may need one;
an account's territory is its IBAN's country. And the code's amount has no
currency, so nothing checks that what a template binds to it is in euro.
Each of these is a sentence of the register under "0025", beside the other
costs of 0025 that a user, an integrator or an operator meets, the ones a
test shows naming it
([`limitations.json`](../release/limitations.json),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

### The demo deploys `main`, and nothing watches it

A push to `main` deploys without waiting for that commit's CI; a failed
build leaves the last deployment serving, its log in Cloudflare's
dashboard; nothing here reads what the address serves
([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)).

### No check is required to merge

What stops a red gate from merging is a maintainer reading it
([`GOVERNANCE.md`](../../GOVERNANCE.md)). Every gate in
[Verification](10-verification.md) reports; none can refuse a merge on
its own.

## 11.3 Known technical debt

| Debt | Why it exists | What it costs |
|---|---|---|
| **Two workarounds for upstream's expression API** | `@formancy/expressions`, as 0009 read it at 0.5.0, declares no typed member and cannot say which functions an expression calls, so members are spliced into flat variables and the clock is found by renaming it ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) | Positions after an index read are lost; both rest on upstream behaviour that tests pin. Each goes when upstream offers the API (0002) |
| **Each expression compiled twice per render** | The diagnostics do not hand back their compilation ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) | Time, unmeasured |
| **admin.css's rules copied by hand** | formancy publishes the room's palette (`@formancy/themes/room.css`, which the Studio and the pages import, [0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) but no rule, so `builder.css` carries admin.css's rules for the workbench at e3c5967, and the Studio's other stylesheets its rules for the page, with the colours they type that the room does not carry ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) | When admin.css's geometry or one of those colours moves upstream nothing here fails; review compares them by hand |
| **Two `@formancy/spec` under the Data provider** | report-spec takes 0.6.0, and Formancy Data 0.1.0's packages pin 0.5.0 exactly ([0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) | A consumer of the provider installs both until Data releases against 0.6.0; nothing of one reaches the other |
| **English where a person reads it** | The session's undo labels, the validator's and the diagnostics' sentences, and the preview's label are English ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) | A German or French builder shows an English sentence for a refusal the validator words, and an EPC payment code's square too small for its frame is refused in points, in a field edited in millimetres ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Properties without an editor** | A table's sort, its group and total rows and its footer cells, conditional styles, value formats, a run added to or removed from a text, a QR code's content or an EPC QR code's text (only an optional text that is absent, or one literal run, is typed in and emptied out), a column added to or removed from a columns block or added to a table, and the declarations, but for an image a person adds and the removal of one nothing draws (0033), have commands and no property kind to edit them ([`report-builder-core`'s README](../../packages/report-builder-core/README.md#what-it-does-not-do)) | Written in the definition instead |
| **A payment part is shown, not edited** | No command edits it, and every command keeps it as it was (`report-core/src/commands/registry.test.ts`); the builders draw where its slip prints, with no outline row and no properties ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) | A QR-bill is written in the definition |
| **Each payment code page's status, by hand at every release** | The QR-bill page and the EPC QR code page each say which release holds their code, and the site refuses to render once the changelog names a release a status does not ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md), [0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)) | A release commit fails `pnpm build` and the pages' suite until each page's three sentences are written again, every stale page named in one error (`RELEASING.md`, step 2); and from its merge until the tag publishes the packages, each page says the guide installs a release npm does not serve yet, held by nothing but tagging right after the merge (step 4) |
| **Data's contract version is not read** | [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md) decided the provider would check the version Data states and refuse one it was not built against; the provider that arrived reads Data through a client of exactly 0.1.0 and reads no version ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) | A Data that changes its replies is refused as `unexpected` by the client's shape checks, or by its server, and the refusal names no version |
| **No viewer to install** | Publishing one waits for a reviewed exception for `pdfjs-dist`'s fonts, or a viewer that leaves PDF.js to the host ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) | A host shows the PDF with a viewer of its own |
| **A label over a label in the design view** | A container's label sits at its top end and a component's at its top start, so a component at the top of a narrow column at a container's right end has its label printed over the container's. The euro invoice's code first stood so, and the browser gate's axe could not tell the colour behind the labels ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) | The starter was laid out otherwise; nothing keeps an author from the layout it left |
| **Two picture manifests** | The browser gate holds `pictures.json` to the starters the picker offers, and the samples are not starters ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)) | A third list of pictures is a third manifest, or a change to the gate |
| **A renderer that predates `eInvoice`** | `checkDocument` reads the keys it knows, and 0.1.0's knows no e-invoice ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) | It would draw a resolved e-invoice as a plain PDF, which only two runtimes in one install could hand it, since the packages pin each other exactly |
| **PDFKit's `/CheckSum` and `/ID`, as PDFKit writes them** | A patch would be a copy of upstream (0002), and filing them upstream is the rightsholder's call; `report-render-pdf/src/pdfmake.test.ts` pins both ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) | An e-invoice's embedded file declares its MD5 in 32 hexadecimal digits where ISO 32000-1 asks for 16 bytes, which veraPDF does not flag, and two e-invoices of one title and creation date share a trailer `/ID` |
| **A file beside the fonts, outside pdfmake's policy** | PDFKit reads the ICC profile of a PDF/A from its own `data` directory with `fs` (0031) | A host that bundles the Node entry puts the profile where the bundled PDFKit's `__dirname` points, or every e-invoice render fails; nobody here has bundled one |
| **The fx values wait for a registration** | The official ZUGFeRD package's XMP example sits behind a registration with FeRD only the rightsholder can make (0031) | The renderer's test holds the namespace, prefix and properties to the transcription's values, which agree with Mustang's reading, and to nothing more official |
| **The corpus's table check and a word broken at its hyphen** | report-corpus's `verify` reads a cell's words by line, and misread "Gas-" over "Brennwertkessel", a word pdfmake broke at its hyphen, as measured on 18 October 2026 (0031) | The e-invoice samples' test on the PDF reads its table itself; a starter or a fixture whose cell breaks so is misreported by the corpus's table check |
| **An e-invoice is written in the definition** | Neither builder edits one, and every command keeps it as it was (`report-core/src/commands/registry.test.ts`); the Studio offers none of the corpus's e-invoice samples (0027) | An author writes the block, its lines' named columns and its VAT categories by hand |
| **Every host carries the e-invoice** | `validateReport` reads an e-invoice in every report, and the runtime imports its writer statically (0027) | Bundled minified from each package's source, report-spec, report-core and report-runtime grew from 145,932 to 194,092 bytes, measured with esbuild 0.28.2 on 17 October 2026, whether a host's reports have an e-invoice or not |
| **The XML has no bound of its own** | It is written before a page is counted, so only `MAX_DETAIL_ROWS` bounds it; a bound of its own is the rightsholder's to choose (0027) | At 100,000 lines the XML held 117,280,919 bytes, and resolving took a median of 5.4 s against 2.0 s without it, over five runs from the built package on Node 24.21.0 and an Intel i9-10900K on 17 October 2026 |
| **A header logo counted on every page the limit allows** | `MAX_SVG_DRAWING` is checked before the render, when only `maxPages` is known, not the pages the report will print ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)) | At a limit of 200 pages a header logo may cost 5,000 units however short the report; refusing inside pdfmake's header callback, which knows the count, would admit more |
| **A Canva logo's clips** | Canva clips every shape, each clip a page-sized group, and a drawing may make four units of them (0030) | A Canva logo of five shapes or more is refused; a clip that is one axis-aligned rectangle holding all it clips could be removed by the cleaner instead, and is not |
| **Two lists of SVG hazards, two readers of a drawing, and two lists of its elements** | report-spec cannot import the corpus, which depends on it, so its tests state their own hazards, and the renderer's (`report-render-pdf/src/testing/svg.ts`) are another list; the renderer's `testing/drawing.ts` reads a drawing's exact ink, which the corpus's reader does not; and the renderer's `svg-content.ts` lists the elements a cleaned drawing holds apart from report-spec's tables, on purpose, as a guard behind the check (0030) | A hazard added to one list is not in the other, and nothing says so; the two lists of elements are held equal by `report-render-pdf/src/svg-threats.test.ts` |
| **The builders' stylesheet at the size budget, and dressing by widened selectors** | `report-builder-core/report-builder.css` dresses an image's unavailable Remove and its label by widening two selectors rather than adding rules (0033); at 598 of 600 lines, counted on 19 October 2026, the next hook a builder renders needs the stylesheet split by its reasons to change. It stayed whole when the files beside it at the budget were split, on 20 October 2026: parts it imported would have to be published beside it, in the package's `files` or its `dist`, and every reader of it as one text, `css.test.ts`, the Studio's `styles.test.tsx`, the breakpoints `gate-page.mjs` reads and the install fixture's `consume.ts`, would have to follow its imports. So the split waits for the decision to publish its parts through the package's manifest, which the change that adds the next hook takes with it | `scripts/source-size.test.mjs` fails the change that passes 600; `css.test.ts` holds the selectors to the hooks both builders render, and what the image rows look like is held by review alone |
| **Liberation Sans, twice in the package** | The Node entry reads TrueType files and the browser entry imports them as base64, for the slip and for an EPC QR code's caption ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) | The renderer's tarball went from 268,045 bytes unpacked at 0.1.0 to 2,307,611, as `npm pack --dry-run` reported on 17 October 2026 |
| **The Preview's width, written twice** | The workspace asks the window `layout.ts`'s `MIDDLE`, and the browser gate's passes and the pictures' camera read their widths from `narrow.css`'s query ([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)) | Nothing while `apps/studio/src/styles.test.tsx` holds the two equal; a reader of a third copy would need a test of its own |
| **A workbench rule admitted inside the Preview** | `@formancy/themes`' `.wb *`, which turns transitions off when motion is reduced, reaches everything in the builder, the Preview standing in its middle included, and is upstream's to scope (0029) | A workbench.css that declares more under it fails the Studio's stylesheet test and the browser gate, until upstream scopes it or the Preview stands outside `.wb` |

## 11.4 Planned, and not built

From the README and the open release gates, and nothing more: the server
and its jobs, storage and publication; reviewed AI changes,
whose groundwork is commands as data ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md));
a published PDF viewer; and a consistent read from Formancy Data, which
waits for Data's snapshot export. Whether the runtime checks the bytes a
host hands it against the digest that names them, which report-spec can now
take, is a decision of its own, not taken (0033). The format's own plan names positioned
elements in the page header and footer
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)),
and the renderer's fallback fonts for the scripts Roboto lacks
([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
