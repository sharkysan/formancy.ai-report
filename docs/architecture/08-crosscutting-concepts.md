# 8. Cross-cutting concepts

Concepts that run through more than one building block, and that a reader
needs in order to follow any of them.

## 8.1 Exact values

A decimal or a large integer travels as a string with its type and never
passes through a JavaScript number, as in Formancy Data
([formancy.ai-data 0008](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0008-exact-values-travel-as-strings.md)).

| Where | How |
|---|---|
| Data in | A decimal only as a canonical string within its field's scale, never a number; an integer as digits or a safe integer ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Expressions | Each member bound as what it was checked as: an integer a `bigint`, a decimal upstream's `Decimal` ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)). A double literal, `double()` and `/` are errors where they are written, because upstream hands an integer and a double back alike: `3 / 2` printed 1 |
| Totals | Computed exactly and rounded once, to the exact total, as declared: each group's and the report's apart, so rounded subtotals need not add up to the rounded total ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Printing | Intl is handed the exact digits, already rounded half away from zero to the places shown. A format that would round a rounded total again is a diagnostic ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| A payment code's amount | A QR-bill's and an EPC QR code's alike: written from its own digits and never rounded; a third decimal is refused, so rounding stays where the total is computed. An EPC QR code's is written as short as it can be, as Austria's PSA asks ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| Lengths | Points, on the hundredth of a point; a finer one is refused, not rounded, so one layout has one stored value and one hash ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |

## 8.2 Refusals

A refusal says what stopped the work and where, and the work leaves nothing
half done behind it. Each layer has its own kind:

| Layer | A refusal is | And leaves |
|---|---|---|
| Format | A validation error: a stable code, a JSON Pointer, the component it is inside | No hash for an invalid report ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| Editing core | A command's `Refusal`, with a stable code | The session as it was, its listeners unnotified ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)) |
| Diagnostics | An error or a warning on a valid report, at the component and the column it is about | An error is what the runtime would refuse; a warning renders as written ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| Runtime | Every reason, each with the stage that found it, a stable code and a JSON Pointer | No document ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Renderer | A `RenderRefusal`: `too-many-pages`, `content-too-large`, `invalid-asset`, `cancelled` or `unsupported`, naming the block, table or asset | No PDF ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| Provider | Every reason, each with a JSON Pointer | No data ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |

**Fail closed** is upstream's rule, and every reader here inherits it
([formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).
A version, a component kind or a property a release does not know is refused
whole, never skipped: the field ignored could be the one that hides a row or
changes a total ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)).
So 0.1.0 refuses a report with a QR code, a payment part or an EPC QR code,
though each is an addition to the same draft version
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
[0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

**A message never quotes a value.** A refusal names the field, the rule and
the place, never the text that broke it: the data and the bill are the
customer's ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md),
[0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
An EPC QR code holds a name, an account and a reference, so its rules say a
length and a character's position, never a character; `invalid-epc-qr-code`
names the code, the field and the rule, from the validator and the runtime
alike; and the renderer names the code by its id, never its payload (0025).
A string written where a payment code expects runs is refused unquoted,
where the shared readers quote what they find (`validate-payment-text.ts`).

## 8.3 Final and preview

A **final** render is the report: it refuses what the data lacks, data the
provider calls incomplete, and a captured count that differs from the rows
given. A **preview** runs on what it has: it prints nothing for a missing
value and warns once per field, and when it lacks anything it labels every
page as a preview of incomplete data and says so in its manifest, so it
cannot pass for the report
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
The label is English, whatever the report's locale.

A code does not carry the page's label. A QR code in a preview encodes what
its content resolved to, and can scan to a shorter reference than the final
one ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
a QR-bill that breaks SIX's rules is refused even in a preview, because it
would scan as a bill no bank pays
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
So is an EPC QR code that breaks the EPC's rules. A preview that lacks the
values of a text the EPC requires prints that text as nothing, so its code
is refused, saying the preview had no value for it. An optional text of that code which the
data gives empty, blank or null is not missing: its element is left unused,
in a final render as in a preview, because a nullable field's null is how
data says "none"
([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

## 8.4 Untrusted input

Templates, expressions, datasets, fonts and images are untrusted even when an
administrator wrote them ([`SECURITY.md`](../../SECURITY.md)).

| Input | How it is read |
|---|---|
| A report | Read once, through property descriptors, so a getter never runs and a proxy that throws is refused; every array, string and number bounded by a constant with its reason in `limits.ts` ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| An expression | CEL, typed member by member, within a step budget each and a step budget a render; no clock, no randomness, no `matches()`, whose time no budget bounds ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Data | Read once without running anything, held to the declared types, a field the report does not declare refused, so nothing it was not written to read rides into a render, a cache or a log ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| An image | An approved asset's id and digest, resolved by the host, never an address; its bytes checked as the PNG or JPEG they say they are before pdfmake sees them, and bounded per asset and per render ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| A font file | Read from its own name table by the licence guard, and refused when it cannot be read; a font inside a script the guard does not see ([§8.7](#87-licences), [0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)) |

**Nothing in a package reaches the network but the provider**, and it only
through the Data client the host made, to the server and with the token the
host chose
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
pdfmake reads no file but the fonts it is given and no address at all,
which the renderer's tests pin
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md));
the corpus hands ZXing its WebAssembly from the package's own file, where
the library would fetch it from a CDN
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
the Studio and the pages ask no other site for anything, which the browser
gate and the pages' checks fail on
([0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).

**Digests are trusted.** The runtime has no hash function without Node or
the DOM, so it does not check an image's bytes against the digest that
names them ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).

## 8.5 Determinism

A report rendered twice from the same data and parameters prints the same
thing. An expression may not call `now()`, `today()` or `random()`, and the
runtime evaluates with fixed capabilities besides
([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
The PDF's creation date is the host's, passed in, so one document renders to
the same bytes ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).
Rows with equal keys keep the provider's order
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
The hash is taken over a canonical form, so key order never changes it
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).

What it does not cover: the characters Intl prints are the engine's ICU's,
so the same report can print differently under another Node
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
[0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md));
and best-effort data from Formancy Data is read at several moments
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).

## 8.6 Three version lines

A report meets three version lines, none of them a package version:
formancy's form spec, Report's own `reportSpecVersion`, and Formancy Data's
contract. [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)
decided that each document says its version inside itself and that a reader
refuses one it does not know, naming it and the ones it reads. One line is
read that way today:

| Line | How it is read |
|---|---|
| `reportSpecVersion` | Read by report-spec's `version.ts` before anything else in a report; another version is refused, naming it and the one the package reads (`report-spec/src/version.test.ts`). It is `'0'`, a draft: nothing written under it is promised to a later release |
| formancy's form spec | Nothing here reads a form. A form handed to report-spec is refused as not a report, its `specVersion` named; reading one through upstream's validator, as 0004 decided, waits for the first code that reads a form |
| Formancy Data's contract | The provider reads no version Data states, which is less than 0004 decided. It is built against 0.1.0 exactly, and a Data whose routes or replies change is refused by the client's checks of their shape, as `unexpected`, or by its server ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |

The tuple a release was tested with is the release report's, derived from
its run
([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)).

## 8.7 Licences

The product is source-available ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)).
Every published package declares `SEE LICENSE IN LICENSE.md` and carries
`LICENSE.md` and `NOTICE`, which `scripts/sync-licenses.mjs` copies in at
build time and `scripts/verify-licenses.mjs` checks. Every production
dependency and every font file a published package ships is held to an
allow-list of permissive licences by `scripts/dependency-licences.mjs`,
reading a font's licence from the font; an exception records a person's
reading of a package's own licence file, at one exact version
([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).

0006 lists what the guard cannot see. Each, and what holds it instead, if
anything:

- **A licence's terms.** The guard trusts the identifier, so a package that
  declares MIT and ships GPL code passes. Nothing holds this: 0006 says the
  inventory review owed before the first paid release is still owed.
- **A font inside a script.** pdfmake's vfs_fonts.js carries Roboto as
  base64, and the renderer's browser build carries Liberation Sans so, for
  the slip and for an EPC QR code's caption. The renderer's
  `browser.test.ts` holds both to the bytes of the font files the guard
  does read
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **Code a package vendors** under a licence of its own. pdfmake's
  svg-to-pdfkit draws every QR code, and an EPC QR code's frame and caption;
  review read its MIT licence on 17 October 2026, and the guard judges it
  by pdfmake's field alone
  ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).

A built app carries the licence and notice texts of everything it bundles
(`scripts/third-party-notices.mjs`, after
[formancy.ai-data 0046](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0046-a-built-app-carries-the-licence-and-notice-texts-of-everything-it-bundles.md)).
The SBOM describes what a consumer installs, not the workspace
([0017](../decisions/0017-the-sbom-describes-what-a-consumer-installs.md)).

## 8.8 Languages

Several sets of words, and they are kept apart:

- **The report's own words** are the author's, in the report's locale. Its
  values are formatted for that locale by Intl
  ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
- **The builders' words** are report-builder-core's one catalogue, in
  English, Swiss German and Swiss French; both builders read it, and the
  scenarios run in all three. A session's undo labels are English sentences
  each editor puts back into its own language
  ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).
  The validator's and the diagnostics' sentences are English: they are
  keyed by stable codes, and their translation is a later step.
- **A QR-bill's headings** are in the slip's own language, one of SIX's
  five, which may differ from the report's
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
- **An EPC QR code's caption** is Austria's words, "Zahlen mit Code", as the
  PSA prints them, whatever the report's language. The builders call the
  code "EPC payment code", "EPC-Zahlcode" or "Code de paiement EPC"; the
  name some banks give it is not used, because nothing here found who owns
  it or what rules come with it
  ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **The product's pages** are German, French, Italian and English, every
  page in each ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)),
  and so is the invoice, as the corpus's samples
  ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)).
  The euro invoice's samples are in German for Austria, French, Italian,
  Spanish, Dutch and English for Ireland, each in its locale; Spanish and
  Dutch are seen only as pictures, since no page is in either. The German
  pages are Switzerland's spelling, and are read by Germans and Austrians
  ([0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
  No native speaker's review of the translations is recorded.

Body text prints in Roboto alone, so a script Roboto lacks — CJK, Hebrew,
Arabic, Thai — is refused rather than printed in boxes
([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
Liberation Sans prints a QR-bill's slip and an EPC QR code's caption. The
caption is drawn in that face or the render fails: where pdfmake's SVG
converter cannot open a face it would warn and draw the text in the last
face it used, and the renderer refuses the warning instead (0022, 0025).

## 8.9 Accessibility

Of the builders, by construction: every drag has a keyboard path, which
report-core's commands are shaped for
([formancy.ai 0046](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0046-keyboard-before-drag.md));
keys are decided once by `actionForKey`; and the tests find elements by role
and accessible name, the rule upstream's
[0034](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0034-accessible-name-only.md)
set for its drivers, so markup a screen reader cannot navigate is markup the
scenarios cannot drive. Where the accessibility tree cannot answer — which
framework drew the builder, a stylesheet's reach, a canvas's pixels — a test
reads the DOM, and its header says why
([`CLAUDE.md`](../../CLAUDE.md)). axe runs at the end of every scenario in each builder, and
the Studio's browser gate measures colour contrast and target size in
Chromium ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
Automated checking is a floor, not a conformance claim.

Of the PDF, nothing yet: no record decides how a generated PDF is read by
assistive technology, and no test reads one so. A QR code's text is not the
PDF's text at all — search, copy and a screen reader find nothing in it —
so a template that wants it read prints it beside the code
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
The EPC means its code to be printed so, beside the details it holds, and
the euro invoice does, which its test reads; nothing checks that any other
template does. An EPC QR code's caption is text, which a reader finds
([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

## 8.10 The room

The builders and the Studio are formancy.ai's interface concept applied, as
Formancy Data's apps are, not a new one. `report-builder.css` is the
builders' only stylesheet; it selects by the hooks both builders render and
colours only through the workbench's `--wb-*` variables. The Studio wears
admin.css's variables, copied and pinned, and the product's pages import
the Studio's stylesheets rather than copy them
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md),
[0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)).
The Studio's bar is one shell for the playground
([formancy.ai 0106](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0106-one-shell-for-every-page-of-the-site.md)).

**The page is the document, not the room.** What prints is the report's own
serialisable styles; no rule of the editor's or the host's reaches a
customer's PDF. The design view is not the PDF and says so by its name; the
Studio's Preview is the PDF, drawn by PDF.js on white paper that no rule of
the room's reaches.
