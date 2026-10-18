# 4. Solution strategy

The ideas the rest of the design follows from. Each links to the record that
argues it.

## 1. A report is its own document, and is valid or refused whole

`ReportDefinition` is a versioned document of its own, not a form with pages
added ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
Its body flows: a table that grows pushes what follows down, and version 0
has no absolute coordinate anywhere. Print styles are tokens, not CSS, so
nothing a browser cascades reaches a customer's page. Datasets are typed
contracts, aggregates are declared once and printed by id, and an image is
an approved asset pinned by digest.

Validation is hand-written rather than a JSON Schema, because the rules that
matter are cross-references, placement and scope. It collects every error
with a JSON Pointer and a stable code, reads each value once without running
a getter, and never throws. The hash is taken only of a report the validator
reads, over an envelope that names the format, so a form and a report with
equal bodies never share one.

What it costs is strictness: one typo refuses the whole document, so an
editor has to keep the document valid at every step. The next idea is how.

## 2. A session never holds an invalid report

Every edit is a command: a pure function from a report to the next report or
a refusal with a stable code. A session commits a command's result only when
the validator accepts the whole of it, keeps the validator's copy frozen,
and shares every part that did not change with the snapshot before it. A
refused edit changes nothing — not the document, not its identity, not the
history, and no listener hears of it
([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).

Two things follow for free. Undo restores the very snapshot that was there,
so every memoised view of it is valid again in either framework. And where a
component may go is asked of the validator by trying the move, so there is
no second copy of the placement rules to fall behind it. Every command is
also data, a descriptor that survives JSON, which is the groundwork for a
reviewed proposal that is not built yet.

## 3. One decision, one place

The question is never "is this repeated" but "if these two ever disagreed,
would anybody find out?" ([`CLAUDE.md`](../../CLAUDE.md)). So:

- **Values are decided in the runtime.** Grouping, sorting, totals, rounding
  and formatting happen once, there; the renderer draws the strings it is
  handed and decides nothing about a value
  ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
- **Expressions are compiled once, for both sides.** `compileReport` in the
  editing core is what the editor's diagnostics report and what the runtime
  evaluates, so the editor refuses what the runtime would for an expression
  ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
  What only a render measures — a glyph, a word's width, the pages — the
  editor does not see.
- **Each payment code's rules are one set of functions.** SIX's for a
  QR-bill (`qr-bill.ts`), and the EPC's for an EPC QR code
  (`epc-payload.ts`, its countries one table in `sepa.ts`). The validator
  applies them to a literal and the runtime to what the data resolves to;
  they live in the format package because it is the one both can call. What
  the two codes share is written once, in `payment-reference.ts`: an IBAN's
  check digits and the creditor reference, both checked modulo 97. The
  EPC's rules read the QR-IBAN's range from `qr-bill.ts` rather than copy
  it, and how a captioned EPC QR code prints is decided in `epc-print.ts`,
  which the validator asks of a square for every version and the renderer
  of the version it encoded. Two copies of any of these could disagree, and
  nobody would find out until a bank refused a payment
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **An e-invoice's totals are computed once, for the page and its XML.**
  The runtime computes them (`e-invoice-totals.ts`), the table prints the
  very values each line was read as, the page reads the totals by name,
  and the XML is written from the same values. A page that says another
  VAT amount than its XML may be a further invoice under § 14c UStG, so
  the two are one computation rather than two that agree. EN 16931's rules
  are one set of functions in report-spec (`en16931.ts`), as the payment
  codes' are, and the e-invoice's account is held by the EPC QR code's rule
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
  The renderer embeds that XML, changed in nothing, in the PDF/A-3b it
  draws of an e-invoice, and of no other report, and decides nothing of
  what the file says
  ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
- **The builders render; the model decides.** Keys, drop targets, words and
  what is available are the editor model's, and each builder binds them in
  its own framework. The binding is written twice on purpose; the behaviour
  once ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).

## 4. Refuse, never truncate

pdfmake's defaults lose content without saying so: its page limit returns
the first pages as though they were all, a header line that does not fit is
dropped, a block taller than a page is not drawn and a PDF still comes back.
The renderer exists largely to stop that: it keeps its own page limit,
measures the page regions, kept blocks and rows before laying out, holds
every word to its column and every character to a glyph, and refuses with a
code and the block it is about
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).

The runtime does the same for data. A final render refuses what the data
lacks, data the provider calls incomplete, and a field the report does not
declare; a preview prints what it has, warns once for each field it lacks,
and, when it lacks anything, says at the top of every page that it is not a
final report ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
And a reader that meets a version, a kind or a property it does not know
refuses the document whole, which is upstream's fail-closed rule applied
here ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md),
[formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).

## 5. A rendered report is proved on the PDF it produced

A claim about output is checked on the bytes the engine wrote, read back
with PDF.js — every row and value, repeated headers, regions, overlap and
margins — never on the engine's input and never through a mocked engine
([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
A QR code is neither text nor an image to PDF.js, so it is decoded from the
page's pixels with ZXing, as a scanner reads it
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
The engine itself was chosen that way: pdfmake and pdfme ran the same
corpus, judged by the same checks, and pdfme lost on a group header left
alone at a page's foot
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).

## 6. Depend, never copy, and let the licence choose the dependencies

formancy's packages are dependencies at exact released versions, and none
of their code is here: one engine decides what an expression and a decimal
mean, in a form and in a report
([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)). Every
production dependency and every font file a published package ships is
walked and held to an allow-list of permissive licences, the fonts read from
their own name tables
([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
The walk trusts a licence's identifier, and does not see a font inside a
script or code a package vendors: [§8.7](08-crosscutting-concepts.md#87-licences)
says what holds those instead, and what nothing does.

The licence is an architectural force here, not paperwork: it ruled out
Prince, and of the faces SIX lists for a QR-bill's slip, Liberation Sans is
the one that is not a commercial face
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
An EPC QR code's caption, for which Austria's PSA asks Arial or a
sans-serif like it, prints in that same face
([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

## 7. What the repository says about itself is derived, or checked

Prose does not break, so a fact stated about the repository is derived from
it or held by something that fails. The release report is built from the
run that gated the release, never typed
([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md));
the getting-started guide's code is compiled and run by the install gate
([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md));
the README's pictures are taken by a script and held to the text they show
([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
These documents are held the same way, by `scripts/architecture.test.mjs`,
for what a test can see: that each section exists, that every package has
its row in the building blocks with the dependencies its manifest declares,
that every record is cited, that every link lands, and that every path
written as code names a file
([0026](../decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)).
