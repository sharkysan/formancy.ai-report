# 2. Constraints

Constraints, unlike decisions, were not chosen here. They are written down
because several of the [decision records](../decisions/README.md) look
arbitrary without them.

## Technical constraints

| Constraint | Consequence |
|---|---|
| **formancy's packages are released elsewhere, at their own pace** | Report depends on them at exact versions and copies nothing ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)) but the lint and format rules, which formancy.ai has not released yet: the repository's tooling carries a copy of them, and no package does, until it pins `@formancy/code-style` ([0050](../decisions/0050-every-typescript-and-javascript-file-is-linted-and-formatted-by-the-rules-the-four-repositories-share.md)). What upstream lacks is worked around and the workaround pinned by a test: an expression's members are spliced into flat variables, and a call to the clock is found by renaming it, because `@formancy/expressions` offers neither a typed member nor a way to ask which functions an expression calls ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)). formancy's room arrives the same way, as `@formancy/themes/room.css` at the release pinned, and the Studio and the pages import it rather than copy admin.css ([0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) |
| **Formancy Data pins its own formancy release** | `@formancy/data-client` and `@formancy/data-core` 0.1.0 depend on `@formancy/spec` 0.5.0 exactly, so the Data provider's tree holds that release beside the 0.12.0 report-spec takes until Data releases against a newer one; nothing of one reaches the other ([0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)) |
| **Angular 22 decides the TypeScript line** | The workspace catalog pins `typescript` to `~6.0.3`, inside the `>=6.0 <6.1` Angular 22 declares, and says so beside the pin. The Angular package is built by ng-packagr, which type-checks it against ES2018's library under its own configuration, so a newer array method passes `pnpm typecheck` and fails the build ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| **`pdfjs-dist` 6.4 needs Node 22.13** | The root `engines` field says `>=22.13.0`, because the PDF reader every rendered-output test rests on is PDF.js ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)). The floor is advisory: pnpm's `engine-strict` is off and no published package declares `engines` |
| **The format, the editing core, the runtime and the editor model run in a browser and in Node from one build** | Their TypeScript library is ES2023 alone and they have no `@types/node`, so a DOM or Node global does not compile ([formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md), [0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)). The cost shows where the platform would have done the work: report-spec reads an SVG's bytes with a tokenizer of its own, since it has no `TextDecoder` and no DOM ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)); and a hash must be a pure one, as `@noble/hashes`' SHA-256 is, which reaches the runtime through `@formancy/spec`. The runtime does not check an image's bytes against their digest with it, and trusts the host's lookup ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose reason, that there was no hash function, 0030 corrects) |
| **pdfmake keeps one configuration per process** | Its fonts and access policies are global. The renderer sets its own again before every render, so nothing else in a host's process changes what a report renders with, and a host using pdfmake for something else finds the renderer's configuration in place afterwards ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)) |
| **pdfmake lays a document out in one synchronous step** | An abort is read only between passes; a pass under way runs to its end. A host that must stop a render at once runs it in a worker it can terminate, and none is built ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md), [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| **A PDF embeds its fonts in a customer's document** | A font is licensed for embedding or it does not ship, and its licence is read from the font, not from its package ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)). Body text is Roboto alone, so a character Roboto lacks is refused ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| **SIX's implementation guidelines for the Swiss QR-bill** | The slip is 210 by 105 mm at the foot of an A4 page in portrait, in a face SIX lists — Roboto is none of them, so the slip prints in Liberation Sans, which the renderer ships ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)) |
| **The EPC's guidelines for the EPC QR code, EPC069-12** | They fix what the code holds and how it is encoded — its elements in their order, its level, its largest version and its bytes — and nothing of where it stands or how large it prints. So it is a component that stands wherever a QR code may, not a payment part, and its square is the author's ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Austria's PSA for the same code** | Where the EPC leaves room it is stricter: an amount as short as it can be written. Its frame, its caption "Zahlen mit Code" and its modules' widths come together, and here they are one option, `caption: 'zahlenMitCode'`. For the caption it asks Arial or a sans-serif like it, and the caption prints in the slip's Liberation Sans (0025) |
| **SEPA's countries, and each IBAN's length, are other people's lists** | EPC409-09 says which countries and territories a SEPA credit transfer reaches and which of them are in the EEA; SWIFT's IBAN Registry gives each country's IBAN length, read here from python-stdnum's copy of it. Both are recorded once, in report-spec's `sepa.ts`, so a change in either reaches an installation only through a release (0025) |
| **EN 16931, as CEN/TC 434's validation artefacts for CII state its rules and code lists** | Each rule is fatal: a code outside its list, a line without a unit or a negative net price makes a file every validator refuses. So report-spec holds them, one set of checks for a literal and for the data, and a final render writes no file that breaks one it holds. Its rules follow CEN's 1.3.17, and the gate's pinned validators run 1.3.16 ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| **Factur-X 1.09.2 / ZUGFeRD 2.5.2, one joint specification given only on registration** | It fixes the CII the EN 16931 profile writes, and how a PDF carries it: the relationship, the conformance level and the XMP. Nobody here has registered or read it, so those values rest on a transcription of it, marked [S], and the release's XSD and schematron on Mustang's copies of FeRD's (0027) |
| **XRechnung 3.0.2, as KoSIT's validator configuration of 2026-08-31 runs it** | A German public buyer asks for XRechnung, KoSIT's CIUS of EN 16931, as XML: its schematron needs a business process, a buyer's reference, payment instructions, the seller's contact and both electronic addresses, and reads a `#` line of the payment terms as its Skonto syntax. Report writes it in CII alone, version 3.0, its PDF a labelled copy; the Leitweg-ID's format specification could not be read, and 4.0 is not backward compatible ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)) |
| **PDF/A-3, as veraPDF's PDF/A-3B profile reads it** | A Factur-X invoice is a PDF/A-3 that embeds its XML; an XRechnung's PDF is a plain copy (0038). pdfmake and PDFKit reach level b alone: level a needs a structure tree pdfmake does not build, and PDFKit has no level u. A CMYK image beside the sRGB output intent fails it, and so does an XMP that is not well-formed, which PDFKit writes of a title holding `&`, `<` or `>`, so a Factur-X invoice refuses both. PDFKit reads the output intent's ICC profile from its own `data` directory, past pdfmake's access policy. ISO 19005-3's own text was not read: veraPDF's profile is what the e-invoice gate holds a PDF to ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| **§ 14 and § 14c UStG, as the BMF's letter of 15 October 2025 reads them** | A German seller must issue e-invoices to German businesses from 2027 or 2028, by its turnover and with exceptions (§ 27 Abs. 38 UStG), and a ZUGFeRD hybrid in the EN 16931 profile counts. Its XML is the leading part, and a page that says another thing than its XML may be a further invoice under § 14c, so the page and the XML read one computation of each total. § 14 Abs. 4 asks for the full address, so the seller's and the buyer's street, post code and city are needed where EN 16931 needs only the country (0027) |
| **Formancy Data 0.1.0 has no snapshot export** | The provider reads the header, each page and each label at different moments, and says so in the data it hands over ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| **ICU decides how Intl prints** | Grouping marks, currency symbols and month names are the engine's, so one report can print differently on two engines; fr-FR's narrow no-break space has no glyph in Roboto and such an amount is refused ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |

## Licence constraints

The source is public and production use is licensed, which rules out more
than it looks like it should ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md),
[0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)):

- No GPL or AGPL code in what ships, whose terms allow no further
  restriction such as a paid production licence; no LGPL, whose conditions
  on bundled JavaScript have no settled reading; no SSPL.
- No source-available or non-commercial licence from anybody else, because
  Report's licence cannot grant production rights to somebody else's code.
  Formancy Data's packages are the one exception to that rule, from the
  same rightsholder on the same terms, each for one package alone: Data's
  client for the provider, Data's identity verifier for the server; the
  guard calls it an admission, because its own exceptions are something else
  ([glossary](12-glossary.md#words-used-for-two-things),
  [0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md),
  [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).
- A commercial component needs written redistribution rights, and the
  guard admits none without a change to 0006. That is one reason Prince was
  not trialled ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).

## Organisational constraints

| Constraint | Consequence |
|---|---|
| **A single maintainer, who is the rightsholder** | Said plainly in [`GOVERNANCE.md`](../../GOVERNANCE.md). The records name one decider |
| **A paid module beside an Apache-2.0 project** | Its own repository, so formancy's licence and its promise that a self-hoster never hits a paywall stay true without qualification ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)) |
| **The licence is in force and no lawyer has read it** | It says so at the top, and the release gate for a legal review is open in [`gates.json`](../release/gates.json) ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)) |
| **Three repositories in step** | A generic improvement goes through formancy.ai's or Formancy Data's own review and release before it can be used here ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)) |
| **Contributions under a CLA** | Checked on every pull request by `scripts/check-cla.mjs`, as formancy.ai's [0098](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0098-the-cla-is-checked-in-the-repository.md) does, and explained in [`CONTRIBUTING.md`](../../CONTRIBUTING.md) |
| **No check is required to merge** | `main`'s ruleset forbids deletion and force-pushes and requires no status check, so what stops a red check from merging is a maintainer reading it ([`GOVERNANCE.md`](../../GOVERNANCE.md)) |
| **The delivery plan is kept out of the repository** | Records cite it as "plan section N", which a reader of this repository cannot follow. [`gates.json`](../release/gates.json) names its release gates by id for that reason, with none of the plan's wording |

## Conventions

- ES modules only: every published package is `"type": "module"`, and
  every entry its `exports` map gives for code is an `.mjs` file with its
  types; report-builder-core's map gives its stylesheet beside them.
- `tsconfig.base.json`: `strict`, with `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` and `erasableSyntaxOnly`.
- One version number across every package, set by `scripts/bump.mjs`; the
  upstream versions and the report format's version are separate lines
  ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)).
- 600 lines for a source file, scripts and stylesheets included, tests
  excluded; `scripts/source-size.test.mjs` fails past it.
- "Source-available", never "open source", anywhere ([`CLAUDE.md`](../../CLAUDE.md)).
