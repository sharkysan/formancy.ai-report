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
the format freezes. The additions since 0.1.0 — the QR code, the payment
part and the EPC QR code — went into the same draft version, and 0.1.0
refuses a report that uses any of them, whole
([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md),
[0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

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
and an ICU that changes how fr-CH groups an amount fails the samples'
pictures and then the pages' quotes until they are taken again
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
[0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)).

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
| **The palette and the builder's geometry copied by hand** | formancy.ai's room is not yet a package to import ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) | When admin.css moves upstream nothing here fails; review compares the pin by hand |
| **English where a person reads it** | The session's undo labels, the validator's and the diagnostics' sentences, and the preview's label are English ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) | A German or French builder shows an English sentence for a refusal the validator words, and an EPC payment code's square too small for its frame is refused in points, in a field edited in millimetres ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Properties without an editor** | A table's sort, its group and total rows and its footer cells, conditional styles, value formats, a run added to or removed from a text, a QR code's content or an EPC QR code's text (only an optional text that is absent, or one literal run, is typed in and emptied out), a column added to or removed from a columns block or added to a table, and the declarations have commands and no property kind to edit them ([`report-builder-core`'s README](../../packages/report-builder-core/README.md#what-it-does-not-do)) | Written in the definition instead |
| **A payment part is shown, not edited** | No command edits it, and every command keeps it as it was (`report-core/src/commands/registry.test.ts`); the builders draw where its slip prints, with no outline row and no properties ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) | A QR-bill is written in the definition |
| **The QR-bill page's status, by hand at every release** | The page says which release holds the bill, and the pages refuse to render once the changelog names a release the status does not ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)) | A release commit fails `pnpm build` and the pages' suite until its three sentences are written again (`RELEASING.md`, step 2) |
| **Data's contract version is not read** | [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md) decided the provider would check the version Data states and refuse one it was not built against; the provider that arrived reads Data through a client of exactly 0.1.0 and reads no version ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) | A Data that changes its replies is refused as `unexpected` by the client's shape checks, or by its server, and the refusal names no version |
| **No viewer to install** | Publishing one waits for a reviewed exception for `pdfjs-dist`'s fonts, or a viewer that leaves PDF.js to the host ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) | A host shows the PDF with a viewer of its own |
| **A label over a label in the design view** | A container's label sits at its top end and a component's at its top start, so a component at the top of a narrow column at a container's right end has its label printed over the container's. The euro invoice's code first stood so, and the browser gate's axe could not tell the colour behind the labels ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) | The starter was laid out otherwise; nothing keeps an author from the layout it left |
| **Two picture manifests** | The browser gate holds `pictures.json` to the starters the picker offers, and the samples are not starters ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)) | A third list of pictures is a third manifest, or a change to the gate |
| **Liberation Sans, twice in the package** | The Node entry reads TrueType files and the browser entry imports them as base64, for the slip and for an EPC QR code's caption ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) | The renderer's tarball went from 268,045 bytes unpacked at 0.1.0 to 2,307,611, as `npm pack --dry-run` reported on 17 October 2026 |

## 11.4 Planned, and not built

From the README and the open release gates, and nothing more: the server
and its jobs, storage and publication; reviewed AI changes, whose groundwork
is commands as data ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md));
a published PDF viewer; and a consistent read from Formancy Data, which
waits for Data's snapshot export. The format's own plan names positioned
elements in the page header and footer
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)),
and the renderer's fallback fonts for the scripts Roboto lacks
([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
