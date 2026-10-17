# 12. Glossary

Terms that mean something specific here, and that a reader will otherwise
reasonably misread.

| Term | Meaning in Formancy Report |
|---|---|
| **Admission** | `FORMANCY_DATA` in `scripts/dependency-licences.mjs`: a Formancy Data package let through the licence guard at one exact version, with the licence file the review read, reached from the provider alone. Not one of the script's `EXCEPTIONS`, though it is the one exception to the policy in plain words; see below ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md), [0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| **Aggregate** | A total declared once in a report and printed by id: computed exactly, once, in the runtime, over a group's rows or every detail row, and read by expressions as `group.<id>` and `totals.<id>` ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| **Best-effort** | The consistency of data the provider read from Formancy Data 0.1.0, whose header, pages and labels come from different moments ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| **BIC** | A bank's code, as ISO 9362 writes it: eight or eleven characters, for the bank, its country, its location and perhaps a branch. An EPC QR code needs one only for an account outside the EEA, and one it holds must be of the account's country, by the codes EPC409-09 gives each territory's BICs and IBANs: 0025's inference, which neither EPC document states ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Builder** | `@formancy/report-builder-react` or `@formancy/report-builder-angular`: the native markup over an editor, which renders its state and dispatches what the person did ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| **Command** | A pure function from a report and its arguments to the next report or a refusal. Every command is also a **descriptor**, its name and arguments as data, which is what a proposal would carry ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)) |
| **Corpus** | `@formancy/report-corpus`: the private package of fixtures, the PDF reader and the checks every rendered PDF is proved with ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)) |
| **Creditor reference** | ISO 11649's structured reference: `RF`, two check digits, then letters or digits, checked modulo 97 as an IBAN is. A QR-bill may hold one, and it is the one structured reference an EPC QR code holds; both read its check from `payment-reference.ts`, the QR-bill keeping its case and the EPC QR code making it capitals ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Design view** | The builder's drawing of the page, for selecting and placing. It is not the PDF and says so: text heights are a rule of thumb and nothing is paginated |
| **Diagnostic** | An error or a warning about a valid report. An error is what the runtime would refuse it for; a warning renders as written ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| **Editor** | What `createReportEditor` returns: one person's view of a session — the selection, the zoom, the open and hidden panes, a drag. Not the builder that draws it ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md), [0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md)) |
| **EPC QR code** | `epcQrCode`: the code a banking app initiates a SEPA credit transfer from, as the European Payments Council's guidelines, EPC069-12, define it. A component that stands wherever a QR code may, not a payment part; its payload is written by the runtime from texts held to report-spec's rules, and Austria's frame and caption are an option. The builders call it "EPC payment code" ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Final** and **preview** | The two modes of a render. A final render is the report and refuses what the data lacks; a preview prints what it has and, when it lacks anything, says so on every page ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| **Fixture** | A resolved document an engine must render or refuse, with what its PDF must show, derived from the document itself |
| **IBAN** | An account as ISO 13616 writes it: two letters for its country, two check digits, then the account. Both payment codes check its check digits by the one function in `payment-reference.ts`; which countries, lengths and cases each takes is its own code's rule, a QR-bill's of Switzerland or Liechtenstein and an EPC QR code's of a country of SEPA ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Manifest** | What a render was resolved from: the report's hash, its locale and zone, the mode, the data's consistency and completeness, the parameters ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| **Payment code** | A code a report prints for a payment: a QR-bill's Swiss QR Code, or an EPC QR code. Each is held to its own rules in report-spec, and the two share `payment-reference.ts`'s checks and `validate-payment-text.ts`'s reading of their texts ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Payment part** | `paymentPart`: at most one Swiss QR-bill, at the report's own level and in no region ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)). An EPC QR code is not one: it is a component (0025) |
| **PSA** | Austria's guideline for the EPC QR code, its "QR-Code und BCD Definition", read in the English edition. Where the EPC leaves room it is stricter — an amount as short as it can be written — and it adds a frame, the caption "Zahlen mit Code" and modules' widths, which `caption: 'zahlenMitCode'` asks for together ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **QR-IBAN** | An IBAN of Switzerland or Liechtenstein whose institution is in the range SIX keeps for QR-bills paid with a QR reference. `isQrIban` in `qr-bill.ts` decides it once: a QR-bill reads it to pair the account with its reference, and an EPC QR code's rules refuse one as the code's account, by SIX's rule rather than the EPC's ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Region** | One of a report's five ordered lists of components: the report header, the page header, the body, the page footer and the summary ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| **Release gate** | One of the delivery plan's gates, G1 to G7 and the legal review, each with its evidence or the reason it is open in [`gates.json`](../release/gates.json) |
| **Release report** | What every run of the gates reports about itself and fails on; a release attaches it, signed ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| **`reportSpecVersion`** | The report format's version, inside every report; `'0'`, a draft. Independent of the package versions and of formancy's `specVersion` ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)) |
| **Resolved document** | `ResolvedDocument`: a report after the runtime has read its data, every value the string it prints and every length a point. The renderer's only input ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| **Room** | formancy.ai's admin look, which the Studio wears: a dark bench, glass panels, violet for what the person acts on and teal for what the system did ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) |
| **Run** | One piece of a text's content, of one of report-spec's `INLINE_KINDS`: a literal, a bound field, a parameter, an expression, an aggregate, the page number or the page count |
| **Sample** | One of the invoice's four editions in the corpus, in German, French, Italian and English. Not a starter: the Studio's picker does not offer the other three ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)) |
| **SEPA** | The Single Euro Payments Area: the countries and territories a SEPA credit transfer reaches, as the EPC's list EPC409-09 gives them, and which of them are in the EEA, the European Economic Area. `sepa.ts` is that list as one table, with each country's IBAN length; an EPC QR code pays an IBAN of one of them and of nowhere else ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Session** | What `openReportSession` returns: one report, its revision and its undo history, shared by every editor over it ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)) |
| **Slip** | A QR-bill's receipt and payment part as SIX lays them out, 210 by 105 mm across the foot of the last page ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| **Starter** | A report the Studio's picker offers, with synthetic data built in; kept in the corpus |
| **Studio** | `apps/studio`, the playground with both builders and the PDF, online at formancy.ai/report/ ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), [0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)) |
| **Upstream** | formancy.ai and Formancy Data, their repositories and their published packages ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)) |
| **Workbench** | formancy's stylesheet, `@formancy/themes/workbench.css`, and the builder panes it dresses; a host recolours it through its `--wb-*` variables |

## Words used for two things

**"Gate"** is three things, and the documents say which. A *job* of
`gates.yml` — `verify`, `test`, `browser`, `install`, `report`; the
Studio's *browser gate*, a script that runs inside the `browser` job; and a
*release gate*, G1 to G7, which a run's evidence passes or which stays open.

**"Preview"** is the Studio's Preview, the pane that shows the PDF, and a
render in preview mode. The pane can show a final render; a preview-mode
render can be made by any host.

**"Page"** is a page of a PDF, the report's page settings, a product page
in `apps/pages`, and a page of Formancy Data's list the provider reads.

**"Exception"** is two things in the licence policy. In
`scripts/dependency-licences.mjs`, an `EXCEPTIONS` entry is a person's
reading of one package's licence file at one version, which corrects its
metadata and is held to the allow-list like any other licence. In plain
words, as `CLAUDE.md` and [§2](02-constraints.md#licence-constraints) use
it, Formancy Data's packages are the one exception to the rule that no
source-available licence is admitted; the script calls that an
*admission*, above
([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md),
[0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).

**"QR code"** is the `qrCode` component, which encodes whatever content the
template writes and checks none of it, and the symbol every code prints. A
QR-bill's Swiss QR Code and an EPC QR code are drawn as QR codes are, by
the same encoder and as the same path, and neither is a `qrCode`: a SEPA
payload written into one is not an EPC QR code, and nothing says so
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

**"Refused"** is said of a validation error, a command's refusal, a runtime
error and a `RenderRefusal` alike. Each layer's kind is in
[§8.2](08-crosscutting-concepts.md#82-refusals).

**"Plan"** is the delivery plan, a working document kept out of the
repository, which records cite by section; and "planned", which these
documents say only where the README or a record does.
