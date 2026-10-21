# Changelog

All notable changes to Formancy Report. Every package moves on one version
number. The versions of the upstream `@formancy/*` packages this repository
depends on are a separate line, and a change to one is called out explicitly.

Loosely [Keep a Changelog](https://keepachangelog.com), with reasons attached —
a line that says only *what* changed is rarely the line you need six months
later.

## Unreleased

**A report's e-invoice may be an XRechnung 3.0, for a German public
buyer**
([0038](docs/decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).
A public buyer asks for XRechnung, KoSIT's CIUS of EN 16931, as XML, and
0.2.0 could write only the Factur-X hybrid a German business takes. An
e-invoice of the new kind `xrechnung`, version `3.0`, is written in CII by
the same writer, its XML a Factur-X invoice's of the same terms but for
BT-24, KoSIT's XRechnung identifier. A final render's `document.eInvoice`
is then `{ kind: 'xrechnung', xml, syntax: 'cii', guideline, version }`:
the invoice, which your application takes and sends -- the packages send
nothing -- and `renderPdf` draws the document as a plain PDF, no PDF/A and
nothing embedded, a CMYK logo among what it draws, every page headed
`XRECHNUNG_COPY_LABEL`, since a PDF of an XRechnung is a copy; it refuses
an XRechnung's document whose page header does not open with the label as
the runtime writes it, `XRECHNUNG_COPY_PARAGRAPH`, style and all, since
the text in white or at one point would say nothing to a reader. A builder
refuses a CMYK JPEG a person adds to a Factur-X invoice alone, whose
PDF/A-3b cannot hold one, and adds it to an XRechnung, so that the editor
and the renderer agree. An XRechnung needs what XRechnung's schematron
needs past EN 16931 -- a business process, a buyer's reference (a public
buyer's Leitweg-ID), payment instructions, the seller's contact and both
electronic addresses -- each refused where it is missing or blank by the
rule that needs it, "(XRechnung's BR-DE-15)". Its payment terms may hold
no line led by `#`, which XRechnung reads as its own Skonto syntax: a
Skonto waits for XRechnung 4.0, which replaces that syntax. An electronic
address under scheme 0204 is held to a Leitweg-ID's shape and its check
digits (ISO/IEC 7064 MOD 97-10), in an e-invoice of either kind, since
neither validator the e-invoice gate runs checks them and a wrong one
routes an invoice nowhere; the buyer's reference is not, since a business
buyer's XRechnung carries an order number there. The Leitweg-ID's format
specification could not be read; the check rests on FeRD's description and
KoSIT's test values. **The resolved document's `eInvoice` now names its
kind**, `'facturX'` or `'xrechnung'`, and the renderer refuses one without
it; `EInvoiceFile` is now the union of `FacturXFile` and `XRechnungFile`,
so TypeScript code that reads `fileName`, `relationship` or
`conformanceLevel` compiles once it has checked that `kind` is
`'facturX'`. report-spec exports `XRECHNUNG`, `XRECHNUNG_VERSIONS`,
`XRECHNUNG_NEEDS`, `XRECHNUNG_TEXT_NEEDS`, `XRECHNUNG_HELD`,
`E_INVOICE_KIND_TEXTS`, `checkElectronicAddress`, `leitwegIdBreak`,
`skontoBreak`, `isXRechnungRule`, `xrechnungRule` and the types
`XRechnungInvoice`, `XRechnungTerms`, `XRechnungVersion`, `XRechnungNeed`,
`EInvoiceTerms` and `EInvoiceTextRules`; `checkEInvoiceText` takes the
kind; the runtime exports `XRECHNUNG_COPY_LABEL`,
`XRECHNUNG_COPY_PARAGRAPH`, `XRECHNUNG`, `XRECHNUNG_VERSIONS` and the
types `FacturXFile`, `XRechnungFile`, `XRechnungTerms` and
`XRechnungVersion`. A sample, "Rechnung (XRechnung)", is accepted by
KoSIT's XRechnung scenario and Mustang, and four controls of it -- no
buyer's reference, no contact, no seller's electronic address, a malformed
Skonto line -- are refused by both for that rule alone. The e-invoice gate
holds each rule report-spec needs, and each it holds by the format, to its
context and test in XRechnung's pinned schematron, and `XRECHNUNG`'s
release to the one its register pins. The getting-started guide's Node
program now takes an XRechnung's XML. CII alone: no UBL. 0.2.0 refuses a
report with an XRechnung, as `unknown-kind`.

**An e-invoice may name the parties' electronic addresses, the seller's
contact and its business process**
([0037](docs/decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)).
A buyer that routes invoices by an address -- an email inbox, a GLN, a
German VAT identifier, France's directory, a public buyer's Leitweg-ID --
can now have it named in the XML, and XRechnung, which a German public
buyer asks for and which comes next, requires all four, so they are in
the format first, for either kind. None is needed for a German business
invoice, and an invoice that names none writes the same XML as before,
byte for byte. An address's scheme is one of five codes of the CEF's
list, refused otherwise (BR-CL-25). A contact gives its name, telephone
number and email address together, and a final render refuses one whose
data gives only some of them, rather than write a contact an XRechnung
would be refused for. The contact's telephone number and email address
are held to the shapes KoSIT's XRechnung scenario warns of, its own
expressions, which the e-invoice gate holds, with the tests that read
them, to its schematron; no file the gate judges is one KoSIT reads as
an XRechnung, so that no file earns the warning rests on those tests,
not on KoSIT. The telephone number's three digits are counted rather
than matched by KoSIT's expression, which, run by V8, took 20.9 s on a
text of 64,000 characters, a tenth of what a template's literal runs may
hold, and four times as long at each doubling (measured as 0037 says).
report-spec exports `ADDRESS_SCHEMES` and `checkAddressScheme`,
the types `AddressScheme`, `ElectronicAddress` and `SellerContact`, and
`XRECHNUNG_RULES` and `XRECHNUNG_PATTERNS`, the XRechnung rule ids its
refusals name and the two expressions. A fourth e-invoice sample uses
every new term, and Mustang, KoSIT and veraPDF accept it; its page
prints none of them. A control with a scheme outside the list is refused
by both validators. 0.2.0 refuses a report that uses them, as
`unknown-property`.

**report-render-pdf pins PDFKit at 0.19.1**
([0036](docs/decisions/0036-the-renderer-pins-pdfkit-at-the-release-0035-was-read-against-until-pdfkit-writes-images-in-the-order-it-embeds-them.md)).
The order the renderer writes a document's images in, below, wraps three
details of PDFKit 0.19.1 that are not its API, and pdfmake asks for
PDFKit at `^0.19.1`, so a later 0.19.x could have moved under a host's
install unseen until the install gate's next run. The renderer now
declares PDFKit at exactly 0.19.1, importing nothing of it, so that npm
gives pdfmake that release, and the install gate fails when pdfmake loads
another. Under pnpm or Yarn, or beside a host's own PDFKit, which copy
pdfmake loads was not measured; a host can hold it with its own
overrides. The pin goes when PDFKit writes images in the order it embeds
them and pdfmake takes that release. The browser entry is unchanged:
pdfmake's browser build carries its own PDFKit.

**One document renders to the same bytes again when it has PNGs with
transparency or interlacing.** PDFKit decodes such a PNG before it embeds
it, and numbered its soft mask and wrote it when the decode called back,
in whatever order the decodes finished, so a report with two or more of
them could print different bytes for the same report, data and date:
the e-invoice gate's page of every image kind came out as another PDF in
32 of 300 draws in Node, its objects inflated in 29, and the gate failed
once on it on #41. A host that caches, deduplicates or signs PDFs by
their bytes would have met it as well. The renderer now has those images
written in the order pdfmake opened them, in both entries, at no measured
cost in time; a PDF whose images already came back in order is the same
file as before, and every PDF the e-invoice gate records is unchanged. It
wraps three details of PDFKit's that are not its API, and a host resolves
PDFKit within pdfmake's range: a release that moved one would print
varying bytes again, or, moving how one of its decodes calls back, leave
such a render never ending. So the install gate now checks the order, and
that the render ends, on the PDFKit a clean install resolves
([0035](docs/decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).

**A release report no longer says a version ran in no suite when the
suites ran it under a second entry.** 0.2.0's body said a clean install
resolved `@formancy/spec` 0.6.0 and 0.5.0 "which no suite ran", when the
suites ran both: Data's client pins 0.5.0 beside report-spec's 0.6.0, and
each version was held against the other's entry alone. A version is now
named past the suites only when they ran no copy of it under that name,
as Formancy Health's report already said it. 0.2.0's release on GitHub
keeps the sentence it was published with.

**The README says what Formancy Report does before anything else.** It
opened with a server and AI proposals, which are planned and not built,
and with SQL datasets as a source of data, which are not built either,
and its status restated, record by record, what 0.2.0's section below
says. It now opens with what the module is, the Studio's picture and a
list of what it does, each line with its decision record, then a short
dated status that links here. The detail it dropped is in the decision
records, the changelog's earlier sections, the package READMEs, the
architecture and `CLAUDE.md`. Every picture is still there: the nine
samples of the two invoices in other languages and countries fold open in
two blocks, one per invoice, and the hero's caption, shortened in
`scripts/pictures/scenes.json`, is written by its script. Every other
caption and generated block is as it was.

## 0.2.0 — 2026-10-19

**The second release, still a developer preview.** It is for evaluating
Formancy Report and building against it. It is not for reports a business
keeps: the report format is still version "0", the draft, and a report
written under it is not promised to be read by a later release
([0004](docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).

The eight packages 0.1.0 published are published at 0.2.0:
`@formancy/report-spec`, `report-core`, `report-runtime`,
`report-render-pdf`, `report-data-provider`, `report-builder-core`,
`report-builder-react` and `report-builder-angular`. They are under the
Formancy Report Source-Available Licence, which no lawyer has reviewed yet
([0001](docs/decisions/0001-a-paid-module-in-its-own-repository.md)).

They depend on these packages, each at an exact version but one:
- formancy's `@formancy/spec` 0.6.0, for report-spec's report hash, and
  `@formancy/expressions` 0.6.0, for report-core and report-runtime; 0.1.0
  took both at 0.5.0
  ([0034](docs/decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md));
- `@noble/hashes` 2.4.0, for report-spec's `assetDigest`, which
  `@formancy/spec` 0.6.0 already installed
  ([0033](docs/decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md));
- pdfmake 0.3.11, and uqr 0.1.3, which encodes the renderer's QR codes
  ([0020](docs/decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
- Formancy Data's `@formancy/data-client` 0.1.0, for the Data provider
  alone. It is under Data's source-available licence, so running the
  provider in production needs a Data production licence too. It brings
  Data's `@formancy/data-core` 0.1.0 and, pinned by both, formancy's
  `@formancy/spec` 0.5.0, so a host of the provider installs two
  `@formancy/spec`;
- tslib, for the Angular builder, at `^2.8.0`, as at 0.1.0.

The React builder takes React 19 as a peer, `^19.0.0`, and the Angular
builder takes Angular 22, `^22.0.0`, as at 0.1.0. The install gate installs
each builder and draws it at both ends of its range. The Studio,
`apps/studio`, the product's pages, `apps/pages`, and the test corpus stay
private.

**What it adds is invoices, mostly.** A report can print a QR code
([0020](docs/decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
carry a Swiss QR-bill, held to SIX's rules and printed in the Liberation
Sans the renderer now ships
([0022](docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md));
print the EPC QR code a SEPA credit transfer is paid from, held to the
EPC's rules
([0025](docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md));
and carry an EN 16931 e-invoice, whose Factur-X / ZUGFeRD XML the runtime
writes from the values its page prints
([0027](docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)),
and which the renderer draws as the PDF/A-3b that embeds it, the German
hybrid invoice
([0031](docs/decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
An image asset may be an SVG, a logo drawn as vectors, cleaned once where
a host approves it
([0030](docs/decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md));
the quotation and both invoice starters print an invented firm's mark
([0032](docs/decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md));
and a person adds an image in either builder, which the host keeps before
the report declares it (0033). Report builds on formancy 0.6.0, and the
Studio and the product's pages wear formancy's own room, imported rather
than copied (0034). In either builder a person hides the panes whose room
the design view needs
([0019](docs/decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md)),
and a host may show a view of its own in the design view's place, as the
Studio shows its Preview wherever it does not fit beside the builder
([0029](docs/decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).
The Studio, as the pages do, serves its own faces and asks no other site
for anything
([0023](docs/decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).
The product has pages in German, French, Italian and English
([0021](docs/decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)),
one of them for the QR-bill
([0024](docs/decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md))
and one for the EPC QR code
([0028](docs/decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)),
which now say that the newest release holds each code; the EPC QR code
page says that Formancy Report draws an e-invoice, where it said its source
did. And the architecture is documented in arc42's sections, held to the
repository by a guard
([0026](docs/decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)).
The entries below say what each costs.

**A report written for 0.1.0.** 0.2.0 reads version "0", as 0.1.0 does, and
what it adds to the format are component kinds, properties and a media type
that 0.1.0 refuses whole, so a report that uses one opens in 0.2.0 and not
in 0.1.0. Two of the corpus's three starters of 0.1.0, the service
inspection and the equipment register, and the getting-started guide's
quotation are 0.1.0's definitions unchanged, which 0.2.0 validates,
resolves and renders: the starters in its suites, the guide's in the
install gate, against the packed packages. The corpus's fixtures are
0.1.0's renderer-neutral documents unchanged, which 0.2.0's renderer
draws, and no more than that: nothing validates or resolves them. No test
reads any other report written for 0.1.0, the quotation starter as 0.1.0
had it among them. Of the reports 0.1.0 printed, the entries below name
one kind 0.2.0 refuses: one that draws a JPEG PDFKit reads otherwise than
its frame header says, which 0.1.0 drew wrong, refused now as
`invalid-asset` (0031). They name two defects of 0.1.0 that 0.2.0 fixes
besides: a decimal string read in time in the square of its length, which
could hold a render for minutes, and one failed read of the fonts, which
was kept and failed every later render in the process.

Of the exported types, one changed shape: report-core's `Members` requires
the e-invoice's `invoice`, `vatBasis` and `vatAmount` maps, so code that
builds one adds them (0027). Others grew members: report-spec's
`ComponentKind` and `Component` by the QR code and the EPC QR code, and its
`AssetMediaType` by `image/svg+xml`; report-runtime's `Block` by `QrCode`
and `EpcQrCode`; report-core's `ScopeName` by the e-invoice's three names;
the codes four packages refuse with, report-spec's `ReportErrorCode`,
report-core's `RefusalCode`, report-runtime's `ResolveErrorCode` and
report-builder-core's `EditorRefusalCode`; and report-builder-core's
`EditorAction`, `ReportPart` and `ScenarioStep`. Where a list stands beside
one, as `COMPONENT_KINDS` beside `ComponentKind`, it grew with it. Code
written against 0.1.0 that switches over one of them to `never`, or keys a
`Record` by one, stops compiling against 0.2.0 until it handles the new
members.

Not in this release:
- **What release gates G4 to G7 ask for.** That is a complete Data
  snapshot, a report server, the AI proposal workflow, and a paid pilot.
- **A consistent read from Formancy Data.** The provider's data is
  best-effort until Data has a snapshot export
  ([0016](docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **A published PDF viewer.** PDF.js ships a font under GPL-2.0 with a
  font-embedding exception, and the dependency-licence gate refuses that in a
  published package
  ([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
  The Studio previews with it.
- **An e-invoice for France.** The e-invoice is made for Germany. Which
  profiles AFNOR's XP Z12-012 accepts, how its four details map and whether
  a platform takes the file were not read, and of those details the XML
  holds the buyer's SIREN alone, so France is not claimed (0027, 0031).
- **Editing a QR-bill or an e-invoice in a builder.** Neither builder edits
  either: each is written in the report's definition, and the design view
  shows where a bill's slip prints (0022, 0027). The EPC QR code is in both
  builders' palette.
- **A payment by a banking app.** That a QR-bill or an EPC QR code is paid
  is not tested: ZXing reads each code from the page PDF.js draws, and no
  banking app has scanned one, nor has one been printed (0022, 0025).

The release report that this release's run builds lists, under "Known
limitations", what each decision record says a user will meet.

**The release's SBOM check reads which version each published package is
given**
([0017](docs/decisions/0017-the-sbom-describes-what-a-consumer-installs.md)).
A consumer's install of 0.2.0 holds `@noble/hashes` twice: 2.4.0, which
report-spec declares, and 1.8.0, which pdfkit declares under pdfmake. The
check held every copy of a runtime dependency's name to the one version
the suites loaded, so the 0.2.0 rehearsal's `check` job refused a correct
SBOM for pdfkit's copy; a rehearsal publishes nothing. It now reads the
SBOM's dependency graph: each published package must be given each runtime
dependency it declares at the version its suites loaded, an SBOM that
records no such dependency is refused, and every upstream package is still
held to a version the suites loaded. A dependency's dependency is held to
nothing, as before.

**A person adds an image in either builder**
([0033](docs/decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
A report could print a logo, and since 0032 the starters show one, but
only a host could declare an image; a person who wanted their own logo
had to ask for it. Now a host that gives the editor a place to keep
images gets **Add image…**, last in the Insert palette of both builders,
which opens the platform's file chooser, by keyboard or pointer. The file
is recognised from its bytes, never its name, its structure checked as
the renderer reads it -- an SVG cleaned by report-spec's `cleanSvg`
(0030) -- kept by the host, and only then declared, in one undo step, so
a preview never prints `missing-asset` in between. Insert's Image draws
the image just added.

- **`@formancy/report-builder-core`:** `createReportEditor`'s `images`
  option, an `ImageStore` with `keep` and the media types the host keeps,
  and `editor.addImage(file)`, which takes a DOM `File` as it stands; the
  state's `images`, with the report's images as the builders list them,
  and `can.addImage`; the actions `chooseImage` and `removeImage`; the
  refusal codes `busy`, `not-an-image`, `not-kept` and `changed`; and the
  types `ImageFile`, `AddedImage`, `KeptImage`, `ImageStore`,
  `ImageLibrary` and `LibraryAsset`. The live region says why a file was
  refused -- not an image, too large, too wide, an SVG with text, a type
  the host does not keep, a CMYK JPEG in an e-invoice, whose PDF/A cannot
  hold one (0031) -- in the editor's words, and the host's refusal in the
  host's. Bytes the report declares already are not declared again, and
  go to the host again under the id they are declared by, so that a
  report opened where another host kept its images can be given them by
  choosing the file. Remove, under the report's own properties, takes
  back an image nothing draws, in one step, and says what draws one it
  cannot. The words are in all three catalogues. The image scenarios join
  `BUILDER_SCENARIOS`, with an `upload` step and a `kept` expectation, and
  `SCENARIO_PNG`, `SCENARIO_PNG_DIGEST`, `SCENARIO_REFUSAL` and
  `scenarioStore` are exported for a builder's runner.
- **The asset's id is read from the file's name**: `Logo Müller AG.svg`
  becomes `logo-muller-ag`, and where the report has the name already it
  is numbered as it stands, a second `IMG_4711.png` being `img-4711-2`,
  never `img-2`. An editor never hands a host an id it had the host keep
  other bytes under, since an undo can declare that asset again. A file's
  name can name a person, and the id reaches the report, so a host that
  minds tells people so; the builders offer no other id.
- **`@formancy/report-builder-react` and `@formancy/report-builder-angular`**
  draw Add image… and its hidden file input, and the report's images with
  their Remove; nothing new to bind, since the editor carries the store.
  Angular's `ReportEditorRoot` gains `attempt(action, focus)`, which moves
  the keyboard only when the action was done, for a host that arranges
  the parts itself. An undo or a redo that takes away the image row the
  keyboard stood on leaves it on the first field, as a Remove does, not on
  the page.
  `report-builder.css` gains no line: two of its selectors widen, so an
  image's unavailable Remove is drawn as an unavailable tool is, and its
  label as a field's.
- **`@formancy/report-spec`:** `assetDigest`, an asset's SHA-256 as the
  format writes it; `sniffImage` and `imageHeader`, the reader of a PNG's
  and a JPEG's structure the renderer used, moved here with every chunk's
  CRC, so that a builder refuses what the renderer would refuse at every
  print, a PNG's image data held in one array however many chunks it was
  split over, where a view of each of a person's million empty chunks
  held 237 MB of the page's heap; and `MAX_ASSET_BYTES` and
  `MAX_ASSET_SIDE`, moved here.
  `@formancy/report-runtime` still exports `MAX_ASSET_BYTES` under the same
  name, and re-exports the readers for the renderer, whose refusals are
  unchanged.
- **Dependency change: `@formancy/report-spec` depends on `@noble/hashes`
  2.4.0, MIT, at an exact version.** It was already installed beneath
  `@formancy/spec` 0.6.0, and its SHA-256 was already in a builder's
  bundle through `reportHash`: it takes the digest synchronously, where
  the editor needs it, and Web Crypto would not.
- **`@formancy/report-core`:** `addAsset`, which refuses an id already
  declared, with the new refusal code `already-declared`, where `putAsset`
  replaces one; and `nextAssetId`, which numbers a file's name as it
  stands and counts as taken the ids a builder has handed a host.
- **The Studio** keeps every image a person adds in the page, for as long
  as the tab is open, and sends it nowhere; a reload forgets it. Its
  browser gate adds one in each builder through the platform's chooser,
  prints it, undoes and redoes it, and holds that nothing is sent: no
  request but to `blob:` and `data:` addresses and GETs without a query of
  the files the build wrote, and no WebSocket. Its pictures were retaken
  by their script.
- **What it costs:** an image's data is first read whole when it prints,
  so a PNG whose image data is corrupt is added and refused then, as
  `invalid-asset`, and a CMYK JPEG added before the report gains an
  e-invoice is refused at its final render; the digest takes the page's
  main thread, 360 ms for 20 MiB in Chromium on the machine measured on
  19 October 2026; the host's store only grows, since a redo needs the
  bytes; the id an add hands the host is the one it means to declare, so
  a store keys what it keeps by digest, never by id alone, the runtime
  checking no bytes against their digest; a `keep` that never settles
  leaves the editor busy; and the Studio's page grew by 28,491 bytes,
  9.6 kB gzipped.

**Report takes formancy 0.6.0, and the Studio and the product pages wear
formancy's room by importing it, never a copy**
([0034](docs/decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)).
The Studio carried admin.css's colours copied by hand, held to the values
of one commit, so a colour formancy moved moved nothing here, and said
nothing; formancy 0.6.0 publishes them as `@formancy/themes/room.css`
([formancy.ai 0178](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0178-the-rooms-palette-is-published.md)).

- **The upstream `@formancy/*` packages move from 0.5.0 to 0.6.0, exact**:
  `@formancy/spec` for report-spec's report hash, `@formancy/expressions`
  for report-core and report-runtime, `@formancy/themes` for the Studio,
  the pages and the getting-started guide's install lines. The spec
  version stays 4, and a report's hash is the one it was: report-spec
  reads `schemaHash` alone, which the release did not touch, and its
  pinned digest held. `@formancy/expressions` 0.6.0's built files are
  0.5.0's but for the version.
- **A host that installs `@formancy/report-data-provider` gets two
  `@formancy/spec`**, 0.6.0 through report-spec and 0.5.0 through
  `@formancy/data-client` and `@formancy/data-core` 0.1.0, which pin it
  exactly, until Formancy Data releases against 0.6.0. Nothing of one
  reaches the other: the provider reads a form's fields with Data's types.
  The second copy is 1,157,810 bytes as pnpm installed it, measured on 19
  October 2026; the README's table lists it as transitive.
- **The Studio imports `@formancy/themes/room.css` after the workbench**,
  in `main.tsx`, and its `styles/room.css` keeps only its own: the text's
  two font stacks, which room.css leaves to the page, and the page's
  rules. **The pages import it first** in `pages.css`, from a pin of their
  own, and their `THIRD-PARTY-NOTICES.txt` names `@formancy/themes` now,
  since they serve its text. The released room holds the copy's 23
  variables at the copy's values, compared declaration by declaration
  with main's `styles/room.css`, and `workbench.css` did not change
  between the two releases: with the room imported, the README's five
  pictures came out byte for byte as main's.
- **The Studio's tints of the room's violet and teal mix its variables**,
  `color-mix(in srgb, var(--client) 15%, transparent)` where they typed
  `rgb(139 123 255 / 15%)` as admin.css's rules do, because a typed tint
  stays behind when the room moves its colour. The glow's gradients say
  `in srgb`, the space typed stops are drawn in; a mixed stop alone moves a
  gradient to Oklab. It is the same colour to one step of 255: the Studio
  as it opens, screenshot as PNG in Chromium 156 at 2100 by 900 pixels and
  twice the density on 19 October 2026, differs from a build with the
  tints typed in 21,382 of its 7,560,000 pixels, each by 1 of 255, all
  under the bar's blurred glass at the top. The colours admin.css's rules
  type that the room does not carry stay typed, as admin.css types them.
- **The README's pictures of the Studio were retaken by their script**,
  for the stylesheet they were taken with; the lossy WebP carries that one
  step as up to 15 of 255 in up to a tenth of a picture's pixels. The two
  pictures of the whole Studio, React's and Angular's, are not
  repeatable: two takes of one build differ by up to 11 of 255 on the
  PDF's paper in the Preview, which no rule of the room reaches, and what
  moves it is not traced.
- **The palette guard refuses a copy instead of holding one.**
  `scripts/palette.test.mjs` fails on a stylesheet, of any kind the
  Studio's Vite bundles, or a page's `<style>`, here that sets a variable
  of the installed room.css or types one of its colours at any alpha, the
  names and colours read from the file; on an app that takes the room
  nowhere, twice or before the last `workbench.css`, or names either
  anywhere but in its entry; on the Studio and the pages resolving it to
  different bytes; on the Studio's `theme-color` not being the room's
  ground; and on its font stacks not being the workbench's.
- **The browser gate reads the room on the built page**: at every pass,
  every variable the installed room.css sets and its colour scheme, as
  the page computes them, so a stylesheet that sets one again by any path
  the build takes, or a workbench taken after the room, fails there.
- **The getting-started guide** installs `@formancy/themes@0.6.0`, and
  says a page that wants formancy's own dark room imports
  `@formancy/themes/room.css` after the workbench.

**The quotation and both invoices, with every sample of them, print an
invented firm's mark at the top left of their first page**
([0032](docs/decisions/0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)).
A report could carry a logo -- a PNG or a JPEG, and since 0030 an SVG --
but nothing a person sees showed it: no starter declared an asset, so the
Studio offered Image disabled on them, and only reports built for a test
printed a template's asset from the definition to the PDF. The mark is the corpus's own
invented drawing, a deep-blue disc with a white gable over a white drop,
with no word in it, approved as a customer's logo is, 15 mm square above
the line that says whom the report is from.

- **A host that prints one of these starters hands over the mark**, by its
  id and digest, or the render is refused `missing-asset`. The README's
  "Render a report" and the Data provider's README pass `images` now, and
  the install gate prints the quotation with its mark from the packed
  packages through those lines. The getting-started guide's
  `printPreview` takes the host's lookup as a parameter now, so that the
  quotation starter previews there with its mark, and its page reads the
  report's approved assets from the host's server beside the sample: a
  page that copied it before passes none, and refuses a report with a
  logo as `missing-asset`.
- **0.1.0 refuses these starters as 0.2.0 has them**, since they declare an
  SVG asset (0030).
- **`@formancy/report-corpus`** (never published): `LOGO` and
  `LETTERHEAD` in `starters/logo.ts`; `STARTER_IMAGES` holds the mark
  beside the inspection's photo, and `starterImages` is the lookup over
  them; `drawingsOn` reads a page's drawings, path by path, for the
  pictures, their test and the Studio's browser gate alike. The e-invoice
  samples carry the mark too, drawn into each PDF/A-3b; the XML they write
  is unchanged. The service inspection and the equipment register print
  none. The invoice's and the euro invoice's pinned JSON digests moved.
- **The quotation's first page holds 25 line items, where it held 27**,
  measured on 18 October 2026 at every count from 20 to 75, and held by
  its test at 30. Its page-break test's windows were measured again, and
  now fail when the layout moves past the boundary they test: on main the
  totals first carried a line to the next page at 25 and at 56 line
  items, and the windows began at 27 and at 64.
- **The pictures of the PDFs record where each line of their page starts
  and what it draws**, every clip a painted path stands inside with its
  box, its paints and each of its paths, and `pictures.test.ts` holds them
  to the PDF written now, the Studio's browser gate the drawings to its
  Download PDF: the mark prints no text, and a picture taken without it
  passed before. A path redrawn inside its own box, and a rule, a border
  or an image, are still not seen. Every picture was retaken by its
  script, the Studio's too.
- **What it costs a PDF:** 330 to 430 bytes, and no render time a median
  could tell from the spread, measured on 18 October 2026.

**An image asset may be an SVG, a logo drawn as vectors, cleaned once
when it is approved into the one form the renderer draws**
([0030](docs/decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
A firm's logo is a vector file, and the format took a PNG or a JPEG
alone. pdfmake draws SVG through the svg-to-pdfkit it vendors, which, handed
a file as a drawing program saved it, opens an `<image>`'s local file past
pdfmake's access policy, writes a link annotation to any address,
`javascript:` included, draws text in a face pdfmake picks past the glyph
check, and overflows its stack on deep nesting; a `use` fan-out of 1,091
bytes took it 4.8 s and 1,974 MB, and one of ten times as many rectangles
killed the process out of memory, measured on 18 October 2026; and a
transform on the root moves a logo anywhere on the page, a payment slip
included. So a host approves an SVG
by cleaning it, keeps the bytes the cleaner writes, and the renderer
draws those and nothing else: nothing is cleaned, dropped or rewritten at
print.

- **`@formancy/report-spec`:**
  - `ASSET_MEDIA_TYPES` gains `image/svg+xml`. The format stays at version
    `'0'`. **0.1.0 refuses a report that declares an SVG asset**, as
    `not-one-of` on its media type.
  - `cleanSvg(bytes)` reads an SVG once, where it is approved, with a
    tokenizer of its own on bytes: it keeps drawing elements alone, removes
    what never draws and lists it by kind and name with a count, never a
    value, refuses what would draw unsafely or otherwise than a browser
    draws it, and writes the rest in one canonical form, ASCII, numbers
    regenerated, transforms composed, ids renamed. The root's paint and
    transform move onto a group inside it, so a transform cannot move a
    logo off its box and Figma's root `fill="none"` keeps a stroke
    unfilled. A clip rule a clip path would inherit is written on it, so
    that its clip never rests on `defs`. Cleaning what it
    wrote gives the same bytes, and its time is linear in the file's: a
    mebibyte of each shape of value a pattern could have made quadratic is
    held to a test's ceiling.
  - `checkSvg(bytes)`, the renderer's: the drawing and what it costs, when
    the bytes are already what `cleanSvg` writes, and a refusal naming the
    first difference otherwise.
  - Both give the drawing's `extent`, `SvgExtent`: how far the numbers
    svg-to-pdfkit writes for it reach wherever it is placed -- the
    inverses its page-sized groups are drawn under, the matrices of its
    gradients and the box a clip in objectBoundingBox units draws in, each
    over every box inside a shape's, since the converter measures a curve
    on its outline and the cleaner by its control points, and the points
    the converter draws its outlines with, an arc's grown to reach its ends
    and a reflected quadratic's among them -- and how deep it nests the
    graphics state, for the renderer to hold an e-invoice to. Nothing is
    refused by it at approval.
  - **What is refused, each with what to do** -- every refusal ends with
    advice, its own or its code's: text, so a lettered logo
    is converted to outlines first; an embedded picture; `use` and
    `symbol`; a reference to anything outside the file; a DOCTYPE with an
    internal subset, whose entities are never expanded; patterns, masks,
    markers, filters, `foreignObject`, `switch`, conditional-processing
    attributes; a colour with an alpha, `hsl()` and `transparent`. Of
    thirteen invented samples of what drawing programs write, every plain
    export is accepted, and live text, Illustrator's editing capabilities
    and Canva's lettering, which Canva writes as `symbol` and `use`, are
    refused.
  - `SVG_REFUSAL_CODES`, `SVG_ELEMENTS`, the elements a cleaned drawing
    is written with, and the `MAX_SVG_*` bounds in `limits.ts`, the first
    of its bounds that were measured, each saying how, on what and when,
    but for how many removed names a person is shown, which is chosen:
    bytes as the file comes and as written, depth, elements, stops, dashes,
    numbers, style rules and the cascade's work (`MAX_SVG_CASCADE`), what a
    drawing costs a reader to paint (`MAX_SVG_SEGMENTS`, a clip path
    counted for every element it clips) and the page-sized transparency
    groups it makes (`MAX_SVG_GROUPS`). `MAX_SVG_COORDINATE` holds every
    number, every transform composed from the root and its inverse, and
    the matrix a gradient is drawn under in any box inside its shape's,
    which the converter's box of a curve is: past it, PDFKit threw from
    inside pdfmake for drawings the cleaner had accepted, and a gradient
    the shape's own box held under it wrote 5 × 10^12 in the converter's. `MAX_SVG_SEGMENTS` is
    10,000: a path every segment of which crosses its box cost a reader
    1.15 to 1.84 s at 30,000 and 0.12 to 0.55 s at 10,000, measured on 18
    October 2026, so a detailed crest may need simplifying first.
  - saxes 6.0.0 is a devDependency, the tests' second reader of every
    cleaned drawing. Nothing is added to what the package installs.
- **`@formancy/report-runtime`:** re-exports `checkSvg`, `cleanSvg`,
  `SVG_REFUSAL_CODES`, `SVG_ELEMENTS`, `MAX_SVG_BYTES`, `MAX_SVG_SEGMENTS`,
  `MAX_SVG_GROUPS`, `MAX_SVG_COORDINATE` and `MAX_SVG_DEPTH` and their
  types, `SvgExtent` among them, for an engine and for a host that
  approves assets beside its render code. A host's answer for an SVG past
  `MAX_SVG_BYTES`, a mebibyte, is refused as `invalid-asset` before it is
  copied, as one past 20 MB is for any asset.
- **`@formancy/report-render-pdf`:**
  - An SVG image is drawn as vectors in its box, `contain` as
    `xMidYMid meet` and `cover` as `xMidYMid slice`, clipped to the box,
    never embedded as an image.
  - It draws only bytes `checkSvg` accepts, and refuses any other as
    `invalid-asset`, naming the asset and what cleaning would change,
    before pdfmake runs. A PNG or a JPEG declared an SVG, and an SVG
    declared either, is refused saying what it is.
  - Behind the check, its own list of the elements a cleaned drawing
    holds, held to report-spec's `SVG_ELEMENTS`, and converter callbacks
    that refuse an image and a warning. Neither stops a link, which the
    converter writes whatever its callbacks say; the check and the list
    do.
  - **A logo in a page header or footer is drawn again on every page**, so
    it grows the PDF and the render with every page, where a PNG is
    embedded once: a header logo of 30,000 lines, more than a drawing may
    now hold, took a 32-page render 2.8 s longer than one of a single
    rectangle, measured on 18 October 2026 (0030 says how).
    `MAX_SVG_DRAWING` bounds what drawing SVGs costs one render, every 32
    bytes of a drawing counted beside what it draws, since pdfmake and the
    converter read its whole text each time; a page region's is counted on
    every page `maxPages` allows, so at 200 pages a header logo may cost
    5,000 units however short the report; and every SVG of a body is held
    to one drawing's bounds as though all fell on one page. Both are
    refused as `content-too-large`, naming the asset.
  - **A reader pays for what a logo paints.** svg-to-pdfkit makes every
    clip and translucent gradient a group the size of the page, and a
    rasteriser pays for a segment on every row it spans, so the worst
    drawing the bounds accept, 15 mm square, added 0.19 s to a page drawn
    at a device pixel ratio of 1 and 0.39 s at 2, and page-wide 0.27 s and
    0.55 s, in headless Chromium on 18 October 2026, against 0.06 to 0.09 s
    for a starter page.
  - **In an e-invoice, an SVG is held to what its PDF/A-3 can hold**, and
    refused as `unsupported`, naming the image and saying what to do,
    before pdfmake runs: one whose numbers could pass the 2,147,483,647 a
    PDF/A holds an integer to, less a margin of 5.7 % for rounding, or
    whose drawing svg-to-pdfkit nests more than 28 graphics states deep.
    The converter writes a page-sized group's box and a gradient's matrix
    through the inverse of the drawing's transform and the image's box,
    and an outline in points of its own: a logo whose clip and
    transparency are shrunk a millionfold, approved and drawn a point
    square, wrote a box of 78,520,000,000 into an e-invoice that said it
    was a PDF/A-3b, which veraPDF 1.30.3 failed, and an arc whose radii
    the converter grows to reach its ends wrote control points of 5 ×
    10^17 at any size, measured on 18 October 2026. A logo shrunk so is now
    refused on A4 below 41.6 pt square, where a test holds report-corpus's
    `SVG_BOUND`, shrunk alike, and such an arc, or a path of thousands of
    reflected quadratics, at any size; the invented exporter samples make
    their page-sized groups under no shrink and nest five deep at most. A
    report that is no e-invoice draws every such SVG as before.
- **`@formancy/report-corpus`:** `readPdfNumbers` reads every number a
  PDF writes, in its objects and its content streams, each an integer or a
  real as written, since veraPDF reads none in a soft mask's group, a
  clip's; and
  `SVG_BOUND`, a drawing at each bound an e-invoice holds an SVG to, with
  `SVG_BOUND_SIDE`, the smallest box the renderer draws it in. The PDF
  reader gives each page its painted
  paths, their paint and the rectangular clip each was painted inside,
  skipping what a soft mask paints, and no longer throws on a transparency
  group's form, to which PDF.js hands no matrix; `verify` finds each SVG
  drawing by a clip of its size with paint inside it, and `verifyInk`
  holds a band of the page's pixels around it to white; `readAnnotations`
  reads a page's links; `SVG_FIXTURES` draws a mark and a clipped gradient
  `contain` and `cover`, in the body and in a page header on three pages.
  The renderer trial's adapters refuse an SVG image.
- **The e-invoice gate** draws the first sample's e-invoice with a page of
  SVGs in every way svg-to-pdfkit paints one -- a clip path, a gradient, a
  translucent stop, a group at an opacity, a dash -- and with `SVG_BOUND`
  in its smallest box, each a variant veraPDF and Mustang accept.
- **What it does not do:** draw text in an SVG, inline `use`, turn a
  colour's alpha into an opacity, follow a reference out of the file, or
  compare the PDF with a browser's drawing of the same SVG. What prints
  is in the approved form; that it is the drawing approved rests on the
  host's lookup, which the runtime trusts to return the bytes the digest
  pins, as before. An e-invoice's SVG is refused by a bound on its
  numbers, never by reading the PDF back, and the bound assumes the
  converter's arithmetic strays no further than its margin, which
  matrices built to cancel one another term by term could defeat. The reason 0010 gave for that, no hash function without
  Node or the DOM, has not held since 0.1.0, and 0030 says so. No starter
  has a logo yet, and neither builder adds an image asset or approves an
  SVG: a builder places only an image of an asset or a field the report
  already has.

**A report's e-invoice is drawn as the PDF/A-3b that embeds its XML: the
German hybrid invoice**
([0031](docs/decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
In a German ZUGFeRD invoice the XML the PDF embeds is the invoice, so the
renderer refused every e-invoice rather than hand over the picture without
it. A final render of a report with an e-invoice is now a PDF/A-3b that
carries the runtime's XML as `factur-x.xml`, the page and the invoice it
prints in one file, in the EN 16931 profile and for Germany: France is
still not claimed.

- **`@formancy/report-render-pdf`:**
  - A document whose e-invoice it knows is drawn as a PDF/A-3b, and on the
    final pass alone, through PDFKit's own document before it ends, embeds
    the runtime's XML byte for byte as `factur-x.xml`, `text/xml`, related
    as `Alternative` and dated with the document's creation date, and
    appends the fx properties and their extension schema to the XMP. Every
    other report is drawn as before: PDF/A for every report would refuse a
    0.1.0 template's CMYK logo, or its title with an `&`.
  - It refuses, as `unsupported` and before pdfmake sees the document, a
    CMYK JPEG in an e-invoice, naming the image, since DeviceCMYK beside the
    PDF/A's sRGB output intent is no PDF/A; XML holding a lone surrogate,
    which an encoder would write as another character; and a title holding
    `&`, `<`, `>` or a character XML 1.0 cannot write, naming `info.title`,
    which PDFKit writes into the XMP unescaped.
  - It reads a JPEG's frame header where PDFKit reads it, and refuses as
    `invalid-asset`, in every report, a JPEG PDFKit would read otherwise:
    a JPG or DAC segment before the frame header, which PDFKit takes for
    it, a second frame header, or a frame of other than one, three or four
    components, which PDFKit gives no colour space. A DAC segment shaped as
    a frame of four components had an RGB JPEG drawn in DeviceCMYK past
    the e-invoice's refusal, which veraPDF failed; 0.1.0 drew such JPEGs
    wrong in any report, and a template holding one now stops rendering,
    an arithmetic-coded JPEG that writes its DAC segment first among them.
  - Every other kind of image PDFKit embeds is drawn in an e-invoice, and
    the e-invoice gate judges one of each. A PNG whose transparency is a
    colour key is drawn, as since 0.1.0, as PDFKit's png-js reads it: a
    grey key by its high byte, and an RGB key as twelve numbers where a PDF
    reader wants six. Pinned in the corpus and not patched.
  - A render of an e-invoice reads one file besides the fonts: PDFKit's ICC
    profile, `data/sRGB_IEC61966_2_1.icc`, which PDFKit reads with `fs`,
    past pdfmake's access policy. A host that bundles the Node entry puts
    it where the bundled PDFKit's `__dirname` points.
  - What PDFKit writes is left as it writes it, and pinned: a `/CheckSum`
    of 32 hexadecimal digits, and one trailer `/ID` for two PDFs of one
    title and creation date, as the corpus's three samples share one. A
    patch would be a copy of PDFKit.
  - The browser entry draws an e-invoice's every object as the Node entry
    does, each stream inflated, which a test now holds; not its bytes,
    since pdfmake's browser build deflates with a zlib of its own: 37,307
    bytes of the first sample against Node's 37,578, measured on 18 October
    2026.
  - The samples are 8,497 to 8,564 bytes larger as PDF/A-3b than plain, and
    were no slower beyond the noise of a busy machine, measured on 18
    October 2026 (0031 says how).
- **The page is proved against the XML on the PDF:** each sample's every
  line and total, as PDF.js reads it, is the XML read out of the same PDF,
  whose amounts BigInt recomputes from the data; a template that prints a
  total of its own, or a column other than the one its e-invoice names, is
  caught where it differs.
- **`@formancy/report-corpus`:** reads what a PDF embeds and says of
  itself: `readPdfObjects`, with `@pdfme/pdf-lib` 6.2.4 (MIT), now among
  its dependencies rather than its devDependencies since its source imports
  it and the e-invoice gate runs that source; `readXmp`, with saxes; and
  `readPdf`'s attachments, with PDF.js. `inflatedDigest` hashes a PDF's
  objects with every stream inflated, for a PDF whose bytes another zlib
  may write otherwise; it was the gate's own and moved here, so that the
  renderer's browser test reads it too. `IMAGE_KINDS` makes in code an
  image of each kind PDFKit embeds in a way of its own. The corpus is
  never published.
- **The dependency guard reads ICC profiles**, since every e-invoice a
  customer sends embeds one and a profile states no terms to read: every
  `.icc` or `.icm` file in the production dependencies of a published
  package, and every file there whose header is a profile's, but code and
  text it does not open, is refused unless `ICC_PROFILES` holds its
  SHA-256 with the licence sentence a review read. It holds PDFKit's, the ICC's sRGB2014, which "may be
  copied, distributed, embedded, made, used, and sold without restriction".
- **The e-invoice gate judges the PDF:** veraPDF 1.30.3, fetched from Maven
  Central and refused unless its SHA-256 is the registered one, and
  Mustang judge each sample's PDF/A-3b; seven variants, the first sample's
  e-invoice drawn on every starter's pages, on the fonts fixture's, and on
  a page of every image kind PDFKit embeds with a QR code, a rectangle, a
  rule and a logo in its header, since a customer's e-invoice draws more
  than the samples' one page; and seven PDF controls. Mustang is read in
  its PDF part as well, since it exits 0 on a PDF/A failure where the XML
  is valid (its issue #1293), and pdf-lib counts each PDF's files and
  compares their bytes, since neither tool compares a file's declared
  checksum or size with its bytes, nor its relationship with the
  profile's, which three controls show. The gate holds what each sample's
  and variant's XMP states, its file name and its conformance level, to
  the XML it embeds, since Mustang holds the level to a fixed list alone.
  veraPDF's licence, GPL-3.0-or-later OR MPL-2.0, is admitted for the gate
  at 1.30.3 alone, and a floor of 1.30.2 keeps it and the copy inside
  Mustang past CVE-2026-54078 and CVE-2026-54079. The downloads are now
  86,368,974 bytes, and a run from the cache took 103 s on Zulu 25 and
  130 s on Temurin 17, beside other work on one workstation on 18 October
  2026. A change to what a starter draws now fails the job until the gate
  is recorded again with `--record`. The release report judges each file
  by the tools of its format, XML or PDF, with a veraPDF column, shows a
  variant as one, and fails a run that ran a veraPDF below the floor, its
  own or Mustang's, rather than resting on the gate's refusal alone.
- **The install gate draws the e-invoice** from the packed tarballs and
  reads the PDF's bytes with Node alone: the one file, its name and
  relationship, the XML byte for byte, the XMP and the reviewed profile,
  at the PDFKit a clean npm install resolves; its preview embeds nothing.
- **The XMP's fx values still rest on a transcription** of the Factur-X
  specification: its namespace, prefix, properties and schema name, which
  Mustang agrees with by name. The transcription gives the namespace two
  ways, with `:invoice` in its section 6.3.1, which the renderer writes,
  and without it in its rule BR-HYBRID-04. No validator reads the
  namespace, and the official package's XMP example needs a registration
  with FeRD the rightsholder has not made; the renderer's test holds the
  values to the transcription's, and says so.
- **The EPC QR code page's limits say it**, in its four languages: its
  samples are no e-invoice, and Formancy Report's source now draws one as a
  PDF/A-3b that embeds its XML, for Germany alone, which veraPDF, Mustang
  and KoSIT judge on the German samples. 0028 asked the change that draws
  the PDF/A-3 to say so there; the new words are no native speaker's.
- **The documents:** decision 0031 and its register entry; the records it
  extends or amends, 0003, 0005, 0006, 0011, 0014, 0027 and 0028, each
  read again and stamped, 0005's and 0014's again after the review, 0027's costs kept as written and the three lines
  of its register that 0031 outdates moved to 0031's; and the
  architecture's sections: PDF/A-3 among the constraints, `pdfa.ts` and
  the readers in the building blocks, the flow from the table to the
  PDF/A-3b in the runtime view, PDFKit's profile in what a host needs, the
  proof on the PDF and the gate on PDFs in verification, and what 0031
  accepts in risks and debt.

**The Studio's Preview stands in the design view's place in any window
too narrow for it beside the builder**
([0029](docs/decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).
Asked on 17 October 2026 why the preview is not visible on a normal
screen: below 2053px it stood under a builder as tall as the window, so
its first page began 1092px down a 1440 by 900 window and 960px down a
1366 by 768 one, and a visitor saw no PDF without scrolling.

- **`@formancy/report-builder-core`:** the `hostView` option names a view
  of the host's own. The state's `hostView` says whether it is shown and
  where, `'middle'` or `'beside'`, and `view` what the middle pane shows.
  `showHostView`, `hideHostView` and `placeHostView` change it, and the
  toolbar's Design view, `openPanel('canvas')`, takes the middle back from
  it. While the host's view stands there the zoom, which is the design
  view's, is unavailable and says so, rather than change a readout beside
  the host's own and nothing anybody sees. Six new `BUILDER_SCENARIOS`, and
  a `host` step kind that every runner of them implements.
- **Both builders** draw a host's view in the design view's place, as a
  bare region named after it, with none of report-builder.css's rules --
  the workbench's reduced-motion `.wb *` reaches it -- and none of the
  builder's keys: Ctrl+Z pressed in the Preview undoes nothing, nor, in
  React, in a portal the host opens from it. React takes it as the
  `hostView` prop, Angular as `<ng-template reportHostView>`, and either
  exists only while it is drawn. When the host swaps the middle pane from
  under the keyboard, as the window crosses the width, the keyboard goes
  to what stands there rather than down to the page.
- **The Studio:**
  - Up to 2052px the Preview stands in the builder's middle, the outline
    and the properties beside it, so a property edited there prints in
    sight. Measured in Chromium on 18 October 2026, nothing scrolled, its
    first page shows 332px in a 1366 by 768 window at 81 %, 464px in 1440
    by 900 at 90 %, 506px in 1536 by 864 at 102 % and 722px in 1920 by
    1080 at 150 %. From 2053px nothing changed.
  - The bar's Preview shows and hides it at every width, and the toolbar's
    Design view gives the design view its place back. Every starter opens
    with its Preview shown, and keeps whether it is.
  - From 769 to about 1000px the middle is what the side panes leave, 87px
    at 769, and the Preview there scrolls rather than cut off a control;
    hiding a side pane gives it room. On a phone the page scrolls past the
    bar to the builder, as it did under 0019, and the Preview in its middle
    scrolls as one.
  - A window shorter than the bar and 32rem of builder scrolls the page
    instead of squeezing the panes.
  - The keyboard on the Preview beside the builder goes with it into the
    middle as the window narrows, and in Angular only one Preview is drawn
    while it moves out again.
  - The Preview keeps the PDF on its paper until PDF.js has loaded the
    newer one. It let the older one go as the newer arrived, and a redraw in
    between threw and blanked the whole Studio, every edit with it: a side
    pane hidden, or on a phone the bar's Preview pressed, within about 50 ms
    of an edit printing did it every time in review. Main's viewer let
    the PDF go the same way, where only a window resized, or the Preview's
    own zoom pressed, at that moment reached it.
- **The browser gate** checks where the Preview stands at every pass, its
  first page in the first viewport, the swap both ways by keyboard, the
  window crossing 2052px, and a side pane hidden, or on a phone the bar's
  Preview pressed, the moment an edit prints, with four light passes more:
  1366 by 657, 1366 by 768, 1536 by 864 and 1920 by 1080. The workbench's
  reduced-motion `.wb *`, which now reaches the Preview, is admitted on it
  and its paper while it declares transitions alone.
- **The install gate** draws each packed builder a second time with a
  host's view, held to report-builder-core's README by `structure.ts`.
- **The README's phone picture** is retaken: the Studio opens there on the
  Preview, the builder's one pane.
- **The getting-started guide** no longer says `ReportBuilder` takes one
  prop.

**A report can carry an EN 16931 e-invoice, whose Factur-X / ZUGFeRD XML
the runtime writes from the values its page prints, and which the entry
above draws**
([0027](docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
From 1 January 2027 a German seller above EUR 800,000 of turnover must
issue e-invoices to German businesses, and from 1 January 2028 every
seller must, where both are established in Germany and but for an invoice
of 250 euro or less, a ticket and a small business's invoice; a ZUGFeRD
PDF in the EN 16931 profile counts, and in it the embedded XML is the
invoice. A report printed the picture alone, and an
XML written beside it would have been a second computation of the same
totals, and a picture that says something else than its XML may be a
further invoice under § 14c UStG, as the BMF's letter of 15 October 2025
says. So the page and the XML now read one
evaluation of each line and one computation of each total. The PDF/A-3b
that embeds the XML is the entry above; this step had the renderer refuse
every e-invoice rather than print the picture without the invoice.

- **`@formancy/report-spec`:**
  - An `eInvoice` block at the report's level: kind `facturX`, the EN 16931
    profile, a commercial invoice (380) in euro, its seller, buyer, dates,
    VAT categories, lines, payment instructions, terms and paid amount.
    Its texts are runs, read as a paragraph's in the report's scope, and a
    page number or count is refused in every one, since the XML is written
    before there are pages.
  - **Its lines are the table's:** `lines` names the table over the detail
    dataset and the four columns that print each line's name, quantity,
    net price and net amount, none of which may be hidden, so that the
    page and the XML read one evaluation of each line. A line's
    identifier, unit and VAT category are codes read from each row.
  - EN 16931's rules as functions over text (`en16931.ts`), which the
    validator applies to literals as `invalid-e-invoice` and the runtime to
    data, each refusal naming the business term and the rule and never the
    value: a name, an IBAN or a VAT identifier is personal data.
  - Units, countries, VAT prefixes and schemes come from closed lists
    (`UNIT_CODES`, `COUNTRY_CODES`, `VAT_PREFIXES`, `SCHEME_IDS`), each
    chosen, narrower than CEN's and held to its lists: a shape check would
    pass `UK` or `Stk`, which every validator refuses after the render was
    called final.
  - VAT categories S, E and AE, at most `MAX_VAT_CATEGORIES`, rates compared
    by value; no allowances and no charges, so a discount is a line of
    negative quantity at a positive price, since a negative net price is
    refused (BR-27). A net amount is a whole number of cents and never
    rounded. A standard rate is 0.5 or more, since BR-CO-17 rounds a lower
    one to 0 and both pinned validators then refuse its tax. A German
    invoice says when it was supplied, and gives the seller's and the
    buyer's street, post code and city, as § 14 Abs. 4 Satz 1 Nr. 1 UStG
    asks, which EN 16931 does not.
  - An identifier or a code the XSD types as a token -- the invoice
    number, the registration identifiers, the post codes, the BIC, a
    line's identifier -- holds no tab, line break, double space or space at
    either end: a schema-aware reader collapses them, and would read
    another identifier than the page prints.
  - **The payment account is held to the EPC QR code's IBAN rule**, and
    its BIC to its BIC rule, so an invoice that prints a code beside its
    XML names one account and one bank by one rule each; the IBAN rule's
    refusal of a QR-IBAN now says "a SEPA credit transfer in euro carries
    none". A QR-bill or an EPC QR code printed with an
    e-invoice is paid to its account, and a QR-bill in its currency.
  - The title of a report with an e-invoice may not hold `&`, `<` or `>`:
    the renderer writes it into the PDF/A's metadata, where pdfkit does not
    escape it. Its page may print them.
  - `FACTUR_X` and `FACTUR_X_PROFILES`, the names the PDF carries,
    resting on a transcription of the Factur-X 1.09.2 specification until
    the specification itself, behind a registration, is read.
  - The format stays at version `'0'`. **0.1.0 refuses a report with an
    e-invoice**, whole, as `unknown-property`.
  - The validator reads an e-invoice in every report, so a host that
    bundles report-spec, report-core and report-runtime carries its rules
    and its writer whether its reports have one or not: 145,932 bytes
    minified grew to 194,092, measured on 17 October 2026 (0027 says how).
- **`@formancy/report-core`:** in a report with an e-invoice, and in no
  other, every place that reads `totals` reads `invoice`, `vatBasis` and
  `vatAmount`, the totals the runtime computes for the page and the XML;
  they are refused where they are computed from. The e-invoice's dates, its
  paid amount, its line codes and the named columns are typed by their
  business terms. A new error, `e-invoice-total-unprinted`, refuses a page
  that leaves out a total the XML holds, since a picture without the VAT
  is not the invoice; another, `e-invoice-format-differs`, one that prints
  a total or a line's net amount at fewer than two places or in another
  currency, a net price in another currency, or an item's name in another
  case, since a page of 872 € over an XML of 871.63 is two invoices. Every
  command keeps the e-invoice as it was. The exported `Members` type now
  requires `invoice`, `vatBasis` and `vatAmount` maps, and `SCOPE_NAMES`
  holds the three names, so code outside the repository that builds a
  `Members` value must add them. `ExpressionSite` gains an optional
  `format`, the format a run prints its expression with.
- **`@formancy/report-runtime`:**
  - EN 16931's totals and VAT breakdown computed once, in `Decimal`
    (`e-invoice-totals.ts`): each category's VAT rounded once, half away
    from zero, never per line. The table prints the very value the XML is
    written from, and the names are bound to the very totals.
  - The CII XML of a Factur-X 1.09.2 / ZUGFeRD 2.5.2 invoice in the EN 16931
    profile, in `document.eInvoice` with the name, relationship and
    conformance level the renderer embeds it by. It is written one way,
    so the same report and data are the same bytes.
  - Every text, date and line term held to EN 16931's rules once the data
    resolves it, and a final render with no lines refused. A line's net
    amount is refused unless it is its quantity times its net price,
    rounded once to the cent, as EN 16931 defines it and Mustang
    recomputes it; a line identifier an earlier line has is refused, since
    it is each line's own; and a quantity or a net price its column prints
    at fewer places than the data gives is refused, since the page would
    round what the XML does not. A QR-bill or an EPC QR code printed with
    an e-invoice must ask for the amount due, or leave it to the payer. A
    final render that wrote no XML and recorded no reason throws, as a
    defect, rather than hand on a document a renderer would draw as a
    plain PDF.
  - A preview writes no XML, warns `e-invoice-preview` and labels every page
    "Preview: not an e-invoice, and not a final report"
    (`E_INVOICE_PREVIEW_LABEL`): a complete preview would otherwise look
    like the invoice. A preview that lacks data keeps `PREVIEW_LABEL`.
  - The XML has no bound but the 100,000 detail rows a render reads at
    most: at that many lines it was 117 MB, measured on 17 October 2026
    from the built package, the median of five runs, on Node 24.21.0 and
    an Intel i9-10900K.
- **`@formancy/report-render-pdf`:** a document with an e-invoice whose
  file name, conformance level or relationship it does not know is refused
  as `unsupported`, naming `eInvoice`, in both entries and before pdfmake
  sees it; this step refused every other e-invoice too, and the entry
  above draws them.
- **`@formancy/report-corpus`:** three e-invoice samples, not starters, the
  euro invoice's firm invoicing German businesses: at 19 % and 7 % paid by
  SEPA credit transfer; reverse charge with an invoicing period; and an
  exempt line, a discount line and a payment on account. Their XML is held
  to a BigInt computation, and each line and total the page resolves to the
  XML. A line's identifier is its position: the article number the table
  prints is the seller's own, which two lines of one article would share.
  saxes 6.0.0 (ISC) reads the XML in the corpus's tests and, through the
  corpus, in the e-invoice gate's scripts; the corpus is never published.
- **A gate of its own, `e-invoice`:** Mustang 2.26.0 and KoSIT's validator
  1.6.3 with its XRechnung configuration of 2026-08-31, each fetched by URL
  and refused unless its SHA-256 is the one `docs/release/e-invoice-tools.json`
  registers, run on the Java the register names, with Java's HTTP and
  HTTPS proxies pointed at a dead port (a raw socket is not caught), over
  the samples' XML and controls each broken one named way, a standard rate
  of 0.49 % that breaks BR-CO-17 among them; and report-spec's code lists
  and rule ids held to
  the schematrons they run. A warning fails it unless
  `scripts/e-invoice/accepted.json` accepts it with its reason, and a run
  fails where the corpus recorded for the judges' tests is not the one it
  judged; a recording holds no path of the machine it was made on. The
  release report reads its verdicts and fails a run on them, holding each
  tool to its register by the hash the gate measured and the version the
  tool reported of itself, and the Java's major version in CI to the
  register's. The tools run in CI and no package carries them.
- **The install gate validates and resolves an e-invoice** of its own from
  the packed packages, reads its XML for the totals its page prints, and
  draws its labelled preview; the entry above draws the e-invoice.
- **The EPC QR code page's limits said what an e-invoice was at this
  step**, in its four languages: the PDF is still no e-invoice, and the
  runtime writes the XML of a ZUGFeRD or Factur-X invoice, for Germany
  alone, which nothing embedded in a PDF then; the entry above says it
  again. The page said only
  the first, which 0028 had said a change that builds an e-invoice must say
  again; a paragraph added to 0028 says the same, its costs left as they
  were written, and its register was read again and holds. The new words
  are no native speaker's.
- **The architecture's sections place it**
  ([`docs/architecture/`](docs/README.md#architecture)): EN 16931,
  Factur-X / ZUGFeRD and the UStG among the constraints, its modules and
  saxes in the building blocks, its flow from the table to the XML in the
  runtime view, the gate's tools in the deployment view, exact totals and
  closed lists among the cross-cutting concepts, a page that differs from
  its XML and the XML's measured cost among the quality requirements, the
  gate in verification, and what 0027 accepts in risks and debt.

**The EPC QR code has a page in four languages, and the euro invoice
comes as samples from Austria, France, Italy, Spain, the Netherlands and
Ireland**
([0028](docs/decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
A reader who looked for the code in their language found no page, and the
one euro invoice showed Germany's words, rate and account alone.

- **The corpus's `EURO_INVOICE_SAMPLES`:** the euro invoice starter,
  unchanged and still the German sample, and six samples in de-AT, fr-FR,
  it-IT, es-ES, nl-NL and en-IE. Each sells the starter's boiler parts to
  a private customer, from an invented firm of its country, at its
  country's standard VAT rate as the EU's Your Europe table gave it on 17
  October 2026, in words no native speaker has reviewed. They sell parts
  rather than the starter's maintenance because France and Ireland tax a
  home's maintenance at a reduced rate, as the French administration's
  and Revenue's own pages say, and Italy does too by secondary sources:
  the standard rate printed on that work would have been wrong there.
  Each writes its firm and its customer's address as its country does; the
  French prints the legal form, share capital and SIREN France's
  administration asks of a company's invoice. The Austrian sample wears
  Austria's frame and "Zahlen mit Code", and no other does; the Italian
  says it is a courtesy copy of the electronic invoice, and where its
  customer finds the original. What else each country's invoicing law
  asks, nobody here checked whole, and decision 0028 says what is known to
  be missing.
- **Their accounts pay nobody, as far as could be read.** Each IBAN's
  check digits are right, the national ones as well as ISO 13616's. The
  German, Austrian, French, Spanish and Dutch ones are of a bank code their
  countries' registers, read the same day, give no bank. The Italian and
  Irish registers could not be read, and those two accounts claim nothing
  more than their check digits.
- **They are proved on their PDFs** by report-render-pdf's
  `euro-samples.test.ts`: one page each, every amount as `Intl` formats
  its locale, and the code decoded from the page asking for the total it
  prints, beside the details it holds. They are not starters, so the
  Studio's picker, pictures and browser gate are what they were.
- **Their pictures** are `docs/images/euro-invoice-at.png`,
  `euro-invoice-fr.png`, `euro-invoice-it.png`, `euro-invoice-es.png`,
  `euro-invoice-nl.png` and `euro-invoice-ie.png`, in
  `docs/images/samples.json` beside the QR-bill invoice's samples. The
  README shows each.
- **The EPC QR code page**, `/report/de/epc-qr-code/`,
  `/report/fr/qr-code-sepa/`, `/report/it/qr-code-sepa/` and
  `/report/en/epc-qr-code/`: what 0025's code does, each card resting on
  tests the page's suite holds to the checkout, what it does not do, the
  euro invoice from each country with the page's own language's first, how
  to try it, and
  where it stands, with a link to the record that cites where each rate
  and register was read. It and the QR-bill page link each other: one for
  an invoice to an account in Switzerland or Liechtenstein, in francs or
  euro, the other for one paid by a SEPA transfer in euro.
- **The site checks every page's status before it renders any,** and
  names each stale page in one error: with two pages each refusing on its
  own, a release commit would have met the second only after fixing the
  first. The EPC QR code page's status refuses a release after 0.1.0, as
  the QR-bill page's does.
- **The pages refuse the name some German banks give the code,** in any
  case, its two words joined or apart by spaces, dashes, hyphens or
  invisible characters, in a page's source, its text and its attributes:
  0025 keeps it off everything here, its owner and its rules unknown, and
  nothing held that on the pages.
- **RELEASING.md**'s second step names both pages' statuses.

**The architecture is documented, in arc42's sections, as formancy.ai's
is** ([`docs/README.md`](docs/README.md),
[0026](docs/decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)). The rightsholder asked that
every change be documented, and the architecture had no document beyond
the decision records: nothing said in one place what each package may
import, how a report goes from data to a PDF, what a host needs, or what
each gate proves and does not.

- **`docs/architecture/`**: introduction and goals, constraints, context,
  strategy, building blocks, runtime view, deployment, cross-cutting
  concepts, quality requirements, verification, risks and debt, and a
  glossary, each linking the records behind what it states and naming the
  test or gate that holds a claim where one does. It describes `main` as of
  the EPC QR code
  ([0025](docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)),
  which it places beside the QR-bill wherever the sections describe a
  payment code, and says "planned" only where the README or a record does.
  The quality goals are not ranked, because no record ranks them.
- **`scripts/architecture.test.mjs`**, in `pnpm test:repo`: it fails when
  a section or the entry is missing; when a workspace package or app,
  read from `pnpm-workspace.yaml`'s globs and each manifest, has no row in
  the building blocks' table, or its row names other dependencies, peers
  or packages from elsewhere than its manifest declares; when a decision
  record is linked from no section; when a relative link there reaches no
  file, or a fragment no heading GitHub would anchor; and when a path
  written there as code names nothing the checkout holds. So a new
  package, dependency or record, or a renamed file the sections name,
  fails the guard until the architecture says so. The table names no
  versions, because a typed version is wrong after the next upgrade and
  nothing would fail; the README's generated table has them. Each rule was
  watched failing with its defect planted. What a section says about a
  record, and which layer a package stands in, are held by review.
- **GitHub's heading anchors are read once**, by `scripts/heading-anchors.mjs`,
  for the architecture's guard, the getting-started guide's and the product
  pages' link check. Each had its own copy, and on a heading with a link
  and an entity in it the three gave three anchors, so a link one passed
  another could refuse.
- **`CLAUDE.md`** asks for the architecture section a change touches, as
  formancy.ai's does, and the README's documents start from
  `docs/README.md`.

**A report can print an EPC QR code, which a banking app pays a SEPA
credit transfer from**
([0025](docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
A euro invoice can be paid by a banking app that reads a code printed on
it, the code the EPC's guidelines EPC069-12, version 3.1, define. A
report could print one only as a QR code whose content the template
wrote out element by element, and nothing checked it: an IBAN typed
wrong, an amount in the report's locale's format, or a payload past the
331 bytes the EPC allows would have printed a code no app pays, or one
that pays someone else.

- **`@formancy/report-spec`:**
  - An `epcQrCode` component, standing wherever a QR code may: its
    `size`; `beneficiary` and `iban`, runs; an optional `bic`, `reference`
    or `text` -- never both -- and `information`, runs; `amount`, an
    expression; `purpose`, four capital letters; and `caption:
    'zahlenMitCode'`, Austria's frame. Each text is read as a paragraph's
    in the report's scope, and a page number or count is refused in every
    one, since all are encoded before there are pages.
  - The EPC's rules, as functions over text: `checkEpcIban`,
    `checkEpcBic`, `epcPairing`, `checkEpcReference`, `checkEpcText` with
    `EPC_BENEFICIARY_RULE`, `EPC_TEXT_RULE` and `EPC_INFORMATION_RULE`,
    `checkEpcField` over the one table of the code's texts,
    `EPC_TEXT_FIELDS`, and `epcBlank`, `checkEpcPurpose`,
    `checkEpcAmount`, `epcPayload`, `checkEpcPayload`, `EPC_MAX_BYTES` and
    `utf8Length`; and how a code is printed:
    `EPC_MAX_VERSION`, `qrSymbolModules`, `epcModule`, `EPC_FRAME`,
    `EPC_CAPTION`, `EPC_CAPTION_MODULE`, `epcLeastVersion` and
    `epcCaptionBreak`.
  - An IBAN is of a country of SEPA, of that country's length, with its
    check digits right, and no QR-IBAN, which SIX keeps for QR-bills in
    francs: a transfer in euro to one is not credited. A BIC is of the
    account's country, and is required for an account outside the EEA, as
    the EPC still requires it there. Which countries those are is one
    table, recorded from the EPC's list, EPC409-09 version 8.0, with the
    lengths python-stdnum's copy of release 101 of SWIFT's IBAN Registry
    gives; SWIFT's own file was not read. A creditor reference is written
    in capitals, as the IBAN is, since the payer may not change it.
  - A blank literal text is refused, as the text left out: an element the
    code holds has one character at least, and a second spelling of an
    absent one would hash apart from it.
  - The validator applies the rules to literal texts as
    `invalid-epc-qr-code`, and the runtime the same functions to data, so
    the editor and the render cannot read the EPC two ways. A refusal names
    the field and the rule, never the text, which may be a person's name or
    account.
  - **The IBAN's check digits and the creditor reference are the
    QR-bill's own**, moved out of its rules into one module both codes
    read: a second copy could disagree about which account is typed right.
    `QrBillCheck` is now the shared `PaymentCheck`.
  - The format stays at version `'0'`. **0.1.0 refuses a report with an
    EPC QR code**, whole, as `unknown-kind`.
- **`@formancy/report-core`:** a new code is named `epc-qr-code`. Its texts
  are compiled in the report's scope, and its amount must give a decimal
  or null, by the one rule a QR-bill's amount is held to; the error names
  the code it is the amount of, and the code's id.
- **`@formancy/report-runtime`:**
  - An `EpcQrCode` block, holding the EPC's payload: SCT in euro in UTF-8,
    version `001` with a BIC and `002` without, every element up to the
    last a line and nothing after it. The EPC's first example is written
    byte for byte.
  - The amount is written as short as it can be, `EUR12.3`, as Austria's
    PSA asks, from the decimal's own digits, and never rounded: one with a
    third decimal is refused, so the template rounds where it computes the
    total.
  - Every text is held to the EPC's rules once the data has resolved it,
    a null that cuts one short refuses a final render, and a preview that
    lacks a text the EPC requires is refused. An optional text the data
    gives empty, blank or null is left out of the code, in a final render
    as in a preview: a nullable field's null is how data says "none".
  - It hands on report-spec's print decisions an engine draws by, as
    report-spec's own objects, as it does the QR-bill's.
- **`@formancy/report-render-pdf`:**
  - An EPC QR code is encoded by uqr at level M, never past version 13,
    and without a caption is drawn exactly as a QR code is, held to the
    same 0.4 mm floor.
  - With `caption: 'zahlenMitCode'` it is drawn as Austria's PSA prints
    one: modules of 15 to 20 mil, a frame with rounded corners four
    modules from the symbol on the left, above and below, and "Zahlen mit
    Code" up its right side, beside the frame's line there, in the
    Liberation Sans the package ships. Where a short payload would print
    modules wider than 20 mil, the version is raised, rather than refusing
    the code, and it scans to the same bytes: otherwise one template would
    print one invoice and refuse the next by the length of its data. A
    captioned square is 68.06 to 118.6 pt (24.0 to 41.8 mm).
  - It refuses a payload past 331 bytes, modules outside the floor or the
    PSA's widths, and a caption it cannot draw in Liberation Sans, naming
    the code and never its payload.
- **`@formancy/report-builder-core` and both builders:** "EPC payment
  code" in the palette, a 32 mm square paying the report's language's
  "Name of the beneficiary" to `DE36 0000 0000 0000 0000 00`, an account
  no bank keeps, with no amount and no frame. 32 mm, not a QR code's 30:
  it is the least whole millimetre in which every payload the EPC allows
  prints, with the frame and without, and in 30 mm a template would
  refuse an invoice by the length of its data alone. Its fields follow
  the code's elements, each text on one line, since a line break would
  end its element, and an optional text is added by typing it and removed
  by emptying it; an empty BIC says that a payer's bank outside the EEA
  may need one. A shared scenario inserts one by keyboard and types its
  account.
- **`@formancy/report-corpus`:** `readPdf` gives every text run its angle
  and a turned run its true box, and `lines` keeps a turned run apart, so
  the caption is never read as part of the line beside it.
- **A fifth starter, "Rechnung mit SEPA-Zahlcode"**, a German heating
  firm's invoice in euro, in the corpus and the Studio. Its code pays the
  invoice's exact total by a creditor reference read from the data, and
  its page prints the beneficiary, the IBAN, the BIC, the amount and the
  reference beside the code, as the EPC means a code to be printed, in a
  32 mm square, as a new code's. The code stands at the left of the
  details, under their heading: at the top of a narrow column at the
  block's right end, the design view printed its label over its
  container's, and the browser gate could read neither. Its account and
  BIC are invented, and are no bank's. The README shows its page.
- **The install gate prints an EPC QR code**, with Austria's caption, from
  the packed packages, on a report whose lines are euros -- nothing ties
  the code's amount to euro, and a total in francs would be asked for as
  so many euros -- finds Liberation Sans in the PDF, and holds the
  caption's size rule to one set of words in the validator and the
  renderer.

**The Swiss QR-bill has a page in four languages, and the invoice comes
as samples in French, Italian and English**
([0024](docs/decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)).
The rightsholder asked for pages that promote the invoices, and for
template samples in European languages. The pages had nothing on the
QR-bill, and the invoice existed in German alone.

- **The corpus's `INVOICE_SAMPLES`:** the invoice starter, unchanged and
  still the German sample, and the same invoice in French, Italian and
  English. Each bills the same work from an invented firm of its region,
  in its own words, with its amounts and dates in fr-CH, it-CH or en-CH
  and the slip's headings in SIX's words for its language. They are not
  starters, so the Studio's picker, pictures and browser gate are what
  they were. report-render-pdf's `samples.test.ts` proves each on the PDF
  it printed, down to the code decoded from the page asking for the
  total it prints.
- **Their pictures** are `docs/images/invoice-fr.png`, `invoice-it.png`
  and `invoice-en.png`, in a manifest of their own,
  `docs/images/samples.json`: the browser gate holds every picture
  `pictures.json` lists to a starter its picker offers. The German
  sample's picture is the starter's. The README shows all four.
- **The QR-bill page**, `/report/de/qr-rechnung/`, `/report/fr/facture-qr/`,
  `/report/it/fattura-qr/` and `/report/en/swiss-qr-bill/`: what 0022's
  bill does and what it does not, SIX's paper for a bill sent on paper
  among the latter, the four samples with the page's own language first,
  how to try it, and where it stands. A shared link to it shows its own
  language's sample. The product page introduces it, as it does the
  healthcare page, and a new check fails a product page that does not
  link a topic page from its content.
- **Its status names the release it was written against, and is said
  where a reader starts.** The hero and the product page's teaser say the
  bill is in no release yet, and the try-it text that the guide installs
  0.1.0, which refuses a report with one: said at the foot alone, it
  came after a reader had left for the guide. The pages refuse to render
  once the changelog names a release after 0.1.0, naming the three
  sentences, so the release commit fails the pages' suite until they are
  written again.
- **The pages read the lines of both manifests**, so a sample's
  description quotes what its picture prints. The wording check reads a
  picture's quotes as the document's own words, rather than as a price,
  in that picture's own description alone, and fails a picture described
  otherwise than its figure: it excused every figure's amounts on every
  page.
- **A link to a heading of a repository file is checked for the
  heading**, by the anchors GitHub gives the file's headings: the QR-bill
  page links two READMEs' sections, and a renamed heading would have
  left the link landing at the top of the file, every check green.
- **Each invoice sample's report has its own id**; the four shared the
  starter's, and a host that keys reports by id would have taken them for
  one.

**A decimal's spelling is read in time linear in its length.** In 0.1.0,
`report-spec`'s validator and `report-runtime`'s data check read a negative
decimal under one -- `-0.5` -- with a pattern that tried every split of its
digits when the string then failed. A string of `-0.`, a long run of digits
and one wrong character took time in the square of its length: about a
quarter of a second for a value of the runtime's longest string, 16,384
characters, so a page of such values held a render for minutes, and longer
in a report definition, whose strings have no such cap. Both now read a
string one way only, and accept and refuse the same spellings: the suites'
cases, and 200,000 random strings compared once when the pattern changed.
Found by CodeQL on the QR-bill's amount, which reads data with the same
pattern.

**A report can carry a Swiss QR-bill**
([0022](docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
A Swiss invoice is paid by its QR-bill, the receipt and the payment part
at the foot of its page, and a report could print one only as an image the
host drew. SIX fixes where the slip stands, the faces it prints in, its
headings, its code's size and what that code may hold: a component in a
region could keep none of it, and Roboto is not one of the faces.

- **`@formancy/report-spec`:**
  - `paymentPart`, at the report's level and in no region: a
    `swissQrBill` with its language, one of SIX's five; the account; the
    creditor's and, optionally, the debtor's structured address; CHF or
    EUR; an amount, an expression; and an optional reference, message and
    billing information. Each text is runs, read as a paragraph's in the
    report's scope, and a page number or count is refused in every one.
  - A report with one is on an A4 page in portrait, and its top margin
    reaches no lower than the slip's top, or it is refused as
    `payment-part-page`, on `/page` or on `/page/margins/top`: the page
    header and the body start at the top margin, and one past the slip's
    top would print the invoice into it.
  - SIX's rules, as functions over text: `checkQrBillAccount`,
    `checkQrBillReference`, `checkQrBillText` with `QR_BILL_ADDRESS_RULES`,
    `QR_BILL_MESSAGE_RULE` and `QR_BILL_BILLING_RULE`,
    `checkQrBillAdditionalInformation`, `qrBillPairing` and
    `checkQrBillAmount`; `QR_BILL_SIZE`, the slip's 210 by 105 mm;
    `QR_BILL_TOP`, its top, 544.25 pt down the A4 page; and
    `qrBillPageBreak`, the page rule, which the validator applies to the
    page and the renderer to the page with what it measures above the
    slip.
  - The validator applies them to a text of literal runs, as
    `invalid-qr-bill`, and the runtime applies the same functions to data,
    so the editor and the render cannot read SIX two ways. A refusal names
    the field and the rule, never the text, which may be a person's name
    or account.
  - The rules are version 2.3's, and version 2.4's QR-IBAN and QR
    reference for CHF only. 2.4 is valid from 14 November 2026, and a bill
    printed now may be paid after it, so a EUR bill to a QR-IBAN is
    refused already.
  - The format stays at version `'0'`. **0.1.0 refuses a report with a
    payment part**, whole, as `unknown-property`.
- **`@formancy/report-core`:**
  - A bill's texts are compiled in the report's scope.
  - Its amount must give a decimal or null; an integer or a string is an
    error, with `dec()` as the hint.
  - Every command keeps the bill as it was, and none edits it yet.
- **`@formancy/report-runtime`:**
  - The document's `paymentPart`, a `QrBill`: the code's payload in SIX's
    order, and every text the slip prints, its headings in the slip's
    language and its values grouped as SIX prints them.
  - Every text is held to SIX's rules once the data has resolved it, as
    `invalid-qr-bill`, and a null in one refuses a final render.
  - **A preview refuses a bill SIX would refuse**, where any other missing
    value prints as nothing: its code would scan as a bill no bank pays.
  - The amount is never rounded. One with a third decimal is refused, so
    the template rounds where it computes the total.
  - It hands on report-spec's six QR-bill decisions an engine draws by,
    as report-spec's own objects: `QR_BILL_SIZE`, `QR_BILL_TOP`,
    `qrBillPageBreak` with its type `QrBillPageBreak`,
    `QR_BILL_CURRENCIES`, `checkQrBillAmount` and
    `MAX_QR_BILL_ADDITIONAL_INFORMATION`. The renderer depends on the
    runtime alone, and a copy of any of them in it could put the slip a
    hair from where the editor draws its band, or refuse a page the editor
    took, and nobody would find out.
- **`@formancy/report-render-pdf`:**
  - The slip: SIX's receipt and payment part across the foot of the last
    page, in place of its page footer, or on a page of its own when the
    body leaves no room. Its code is at level M, version 25 at most, 46 mm
    square with the Swiss cross. Every heading and value stands where
    SIX's Style Guide puts it, blank fields are marked by their corners,
    and the line across carries the instruction above it and the line
    down a scissors symbol, as SIX's guidelines (3.7) ask of each line.
    The symbol is drawn as paths, since Liberation Sans has no glyph for
    it; its size and place are manuelbl's generator's.
  - **It ships Liberation Sans 2.1.5**, regular and bold, under the SIL
    Open Font License 1.1, in a new `fonts` directory: SIX allows Arial,
    Frutiger, Helvetica and Liberation Sans on a slip, and Roboto is none
    of them. The browser entry imports them from a chunk of its own the
    first time a document has a bill. The fonts are in the tarball twice,
    as TrueType and as base64, and it grows from 268,045 bytes unpacked at
    0.1.0 to 2,307,611 on 17 October 2026, as npm counted them.
  - It refuses a bill it cannot draw as SIX prints one as `unsupported` or
    `content-too-large`, naming `paymentPart`. Information taller than its
    section is refused, not shrunk. Where the refusal is one of SIX's
    rules -- the page, the currencies, the amount's range, the longest
    value -- it is report-spec's, through the runtime, so what the editor
    accepts and what the renderer draws cannot part: a top margin past
    the slip's top is refused in the editor's words, and one that the page
    header and the instruction above the slip push into it by the same
    rule.
  - **A font that could not be read once is read again by the next
    render**, and a font that was read is still read once. In 0.1.0 one
    failed read of the fonts' glyphs -- in Node, a font file the process
    could not open just then -- was kept, and every later render in the
    process failed with it. In a browser the same holds for the QR-bill's
    fonts chunk, which a dropped network or a deploy that replaced it
    would otherwise have made fail every bill until the page reloaded.
    Whether a browser fetches a chunk again after a failure is the
    browser's, and a chunk a deploy removed still fails until a reload.
  - A QR-bill's code is not held to a `qrCode`'s 0.4 mm floor: SIX prints
    it at 46 mm, 0.393 mm a module at version 25.
- **`@formancy/report-builder-core` and both builders:**
  - The design view draws a band the slip's size at the sheet's foot,
    named "Payment part" in the editor's language: the canvas's
    `paymentPart`, `null` without a bill, which both builders draw as the
    `payment-part` part, dressed by the region bands' rules.
  - A report with a bill opens, edits and undoes without losing it.
  - Letter, landscape, or a top margin past the slip, is refused, with
    the reason on the field. A page header or the instruction to separate
    reaching into the slip is refused only by a render, which alone
    measures them. Nothing edits the bill yet.
- **A fourth starter, the invoice "Rechnung mit QR-Zahlteil"**, in the
  corpus and the Studio. Its bill pays the invoice's exact total by a QR
  reference read from the data. The README shows its page.
- **`NOTICE` names Liberation Sans**, its copyright and its licence, which
  travels beside the fonts as `fonts/LICENSE-LiberationSans.txt`.
- **The Studio's `THIRD-PARTY-NOTICES.txt` carries Liberation Sans's
  licence**, under `@formancy/report-render-pdf`, for the chunk its fonts
  are bundled in. The notices plugin now takes a notice for a file of this
  repository's own packages.
- **The licence guard reads Liberation Sans 2's sentence**, "Licensed
  under the SIL Open Font License, Version 1.1", as OFL-1.1, at that
  version exactly
  ([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
  Without it the guard refused the renderer's own fonts.
- **The install gate prints a bill** from the packed packages and finds
  Liberation Sans in the PDF. A tarball without its `fonts` would print
  every other report and fail only a host's bill; the gate fails it.

**The Studio and the product pages serve their own faces, and ask no
other site for anything**
([0023](docs/decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).
They took Archivo and IBM Plex from Google Fonts, so every reader's
browser told Google its address before a word was drawn. The pages are
for readers in Switzerland, Germany and Austria, one of them in
healthcare. The Landgericht München I held such a transfer without
consent unlawful on 20 January 2022 (3 O 17493/20). formancy.ai's own
pages stopped doing it in its 0154.

- **The faces are Fontsource's packages**, at admin.css's weights:
  `@fontsource-variable/archivo` with its width axis,
  `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`, each at
  5.3.0, under the OFL. The Studio imports them through
  `src/styles/fonts.css`, and the pages import that file and copy the
  font files into `site/fonts/` from their own packages.
- **The faces' notices travel with them**: in the Studio's
  `THIRD-PARTY-NOTICES.txt`, and in the pages' new
  `site/THIRD-PARTY-NOTICES.txt`.
- **What it costs**, measured on 17 October 2026: 887,348 bytes in 59
  font files in each build. A reader's browser fetches only the subsets
  the text uses: in Chromium, 190,724 bytes in six files for the Studio
  up to its starter picker, 151,832 in four for a product page in German
  or French. A reader with a font named Archivo installed
  sees the headings in it, since the room's stack names Archivo first.
- **The browser gate fails on any request outside the built Studio**, a
  connection hint to another host included, where it allowed Google's.
  The pages' checks refuse a stylesheet, a font, a hint or a picture
  that a page's HTML or stylesheet names on another site; no gate opens
  the pages in a browser.
- **The README pictures were retaken.** The faces from the build differ
  from Google's files by antialiasing in a few hundred pixels per
  picture; the text each picture shows is unchanged.

**The product has pages a search engine can read, in German, French,
Italian and English**
([0021](docs/decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)).
The rightsholder asked for pages people search for and find, with
examples, for invoices and for healthcare. The Studio is drawn by a script,
in English, and says `noindex`, so a search engine found nothing to read.

- **`apps/pages`, never published:** the product page,
  `/report/<lang>/`, and the healthcare page, `/report/de/gesundheitswesen/`,
  `/report/fr/sante/`, `/report/it/sanita/` and `/report/en/healthcare/`.
  - Static HTML, prerendered at build time. No script runs on a page, so a
    reader without JavaScript, and a crawler, reads all of it.
  - Each page names its translations as alternates, with English as the
    default, and `/report/sitemap.xml` lists them all.
  - A shared link shows the page's title and description, through Open
    Graph and X's card, and the product page's link the quotation
    starter's picture. The healthcare page's shows none: no picture here
    is of a healthcare document.
  - The release and its date, and the licence's version and terms, are
    read from `CHANGELOG.md` and `LICENSE.md` when the pages are built. A
    row of the licence's table that changes stops the build until it is
    translated.
  - The pages import the Studio's stylesheets, its room among them, and
    have no colour of their own.
  - The healthcare page says what works today, formancy's forms and
    Report's PDFs, and that Formancy Health is in development with
    nothing released, dated 17 October 2026.
  - The invoice pages come with the QR-bill and EPC features, not before.
- **`scripts/demo.mjs`** stages the pages beside the Studio under
  `/report/`. It refuses a path both builds hold, and a page of either
  that asks for a file by an absolute path. The Studio stays at
  `/report/`, with its `noindex`.
- **One step is the rightsholder's:** the sitemap is submitted in Google
  Search Console, or named in formancy.ai's robots.txt, which this
  repository does not own (`.github/REPO-METADATA.md`).

**A report can print a QR code**
([0020](docs/decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
A report often carries a code a phone opens: a link to the record it
prints, or a reference to pay or look up by. Version 0 could print one
only as an image the host encoded and approved as an asset. pdfmake's own
`qr` node rounds a module down to whole points: it would draw the
palette's 30 mm code at 20.5 mm, and a code too small for its modules as
nothing, without a word.

- **`@formancy/report-spec`:**
  - A `qrCode` component. `content` is runs, as a paragraph's, one at
    least, since a code of none encodes nothing. `size` is the side of the
    square in points, its quiet zone inside it. `errorCorrection` is one
    of `QR_ERROR_CORRECTION`: L, M, Q or H.
  - It stands wherever an image may, and its size is held to
    `squareRoom`, the shorter side of the printable area, which the
    builders read too, so that they never offer or name another room.
  - A page number or count in it is refused as `misplaced-page-counter`,
    because its content is resolved before pages are counted.
  - The format stays at version `'0'`, the draft. **0.1.0 refuses a
    report that holds a QR code**, whole, as `unknown-kind`, rather than
    print it without the code.
- **`@formancy/report-core`:** a new code is named `qr-code`. An
  expression in its content is compiled and diagnosed as a paragraph's
  in its place.
- **`@formancy/report-runtime`:** a `QrCode` block, holding the text the
  content prints, formatted as a paragraph's runs are. A final render
  refuses a code with a value that is null in its content, as
  `no-qr-value`, or whose content prints nothing, as `empty-qr-code`: a
  paragraph prints null as nothing and a reader sees the gap, but a code
  that encoded less scans as some other reference. A preview encodes it as
  it resolves.
- **`@formancy/report-render-pdf`:**
  - It depends on **uqr 0.1.3**, under the MIT licence, at that exact
    version. uqr encodes each code once.
  - Each code is drawn in vectors, as a square exactly its size with its
    quiet zone of four modules inside, and its dark modules one path,
    filled once. A fill for each run left light lines between rows where
    PDF.js drew them; the path takes about twice the bytes, and more time,
    as 0020 measures. It is an SVG, because pdfmake 0.3.11 never moves a
    canvas path to where its canvas stands.
  - It refuses as `content-too-large`: text no version holds at the
    level, text past 7089 characters, counted as code points, modules
    finer than 0.4 mm, with the size the text needs, and a code wider or
    taller than where it stands. It refuses a malformed code as
    `unsupported`.
  - 0.4 mm is the minimum of SIX's QR-bill guidelines (version 2.3,
    section 6.3), taken as a general one. The largest code those
    guidelines print, version 25 at 46 mm, has modules of 0.393 mm, and a
    QR code that size is refused: this is not a QR-bill.
  - The code marks no character set. ZXing reads its UTF-8, and a reader
    that keeps to the standard's Latin-1 default does not.
- **`@formancy/report-builder-core` and both builders:**
  - QR code in the palette: a 30 mm square at level M, encoding
    https://formancy.ai/report/.
  - Its content is edited run by run, and its size in millimetres.
  - Each level is named with the share of the code it restores, in
    three languages.
- **The tests read each code back from the PDF as a scanner does.** They
  use zxing-wasm 3.1.5, in the private corpus alone, from its own
  WebAssembly file, and fetch nothing. Codes side by side are read from
  the left, their tops compared to the nearest point.

**A person hides the panes whose room the design view needs**
([0019](docs/decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md)).
On the demo, in a window 1536px wide, which is a 1920 screen at 125 %, the
design view was 395px of a page 846px wide, and nothing could be closed:
the toolbar's pane buttons choose what a narrow screen shows, and did
nothing visible there.

- **`@formancy/report-builder-core`:** a `hidePanel` action and the
  state's `hidden`. `openPanel` shows a hidden pane again. The design view
  cannot be hidden, and the pane a narrow layout shows never is.
  `HIDEABLE_PANELS` lists the others.
- **Both builders:**
  - Each side pane's header has a Hide: Hide Outline, Hide Properties,
    Hide Problems. It leaves the pane out and puts the keyboard in the
    design view.
  - The toolbar's pane buttons bring a pane back.
  - `report-builder.css` lays the grid out without the hidden panes, read
    from the root's `data-hidden`.
- **A container's label in the design view** is drawn above the boxes
  inside it. Under them, axe could not tell the colour behind it, which
  showed once the design view held a whole page.
- **The Studio:**
  - A Preview toggle in the bar. A hidden Preview prints nothing.
  - The Preview stands beside the builder only in windows over 2052px,
    where the design view holds an A4 page at 100 % whole. Narrower, it is
    under the builder, and at 1536px the design view is 839px.
  - The README's pictures are taken at 2100px for it.

## 0.1.0 — 2026-10-16

**The first release, a developer preview.** It is for evaluating Formancy
Report and building against it. It is not for reports a business keeps: the
report format is version "0", a draft, and a report written under it is not
promised to be read by a later release
([0004](docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).

Eight packages are published at 0.1.0: `@formancy/report-spec`,
`report-core`, `report-runtime`, `report-render-pdf`,
`report-data-provider`, `report-builder-core`, `report-builder-react` and
`report-builder-angular`. They are under the
Formancy Report Source-Available Licence, which no lawyer has reviewed yet
([0001](docs/decisions/0001-a-paid-module-in-its-own-repository.md)).

They depend on three packages at exact versions:
- formancy's `@formancy/expressions` 0.5.0;
- pdfmake 0.3.11;
- Formancy Data's `@formancy/data-client` 0.1.0, for the Data provider
  alone. It is under Data's source-available licence, so running the
  provider in production needs a Data production licence too.

The React builder takes React 19 as a peer, and the Angular builder takes
Angular 22. The install gate installs each builder and draws it at both ends
of its range. The Studio, `apps/studio`, and the test corpus stay private.
`pnpm demo` builds the packages and serves the Studio from a clone, and the
README opens with a picture of it, taken by the same script as the others:
Data's and formancy.ai's READMEs open with one, and Report's first was
below its whole Status. The Studio is also online at
https://formancy.ai/report/, beside formancy.ai's playground, so it can be
tried without a clone. A Cloudflare Worker of its own serves it, apart from
formancy.ai's Apache-2.0 site, and Cloudflare deploys it from `main` on every
push, as it deploys formancy.ai's site, with no Cloudflare token in GitHub.
The Studio is now built with a relative base, and its browser gate serves
it under `/report/` as formancy.ai does
([0018](docs/decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)).

Not in this release:
- **A consistent read from Formancy Data.** The provider's data is
  best-effort until Data has a snapshot export
  ([0016](docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **A published PDF viewer.** PDF.js ships a font under GPL-2.0 with a
  font-embedding exception, and the dependency-licence gate refuses that in a
  published package
  ([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
  The Studio previews with it.
- **What release gates G4 to G7 ask for.** That is a complete Data
  snapshot, a report server, the AI proposal workflow, and a paid pilot.

The release report that this release's run builds lists, under "Known
limitations", what each decision record says a user will meet.

**A Formancy Data provider, which reads Data 0.1.0 best-effort**
([0016](docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
Formancy Data 0.1.0 was published on 16 October 2026.
`@formancy/report-data-provider` reads a report's data from it through
`@formancy/data-client` at exactly that release, with the person's own
token. It reads the header's one record, the detail rows fifty a page, and
each lookup's label.

Before it reads a record, it checks:
- the binding;
- the fields the person may read;
- the list;
- the parent, through the person's menu.

A refusal anywhere hands over nothing. Its data is labelled `best-effort`:
Data 0.1.0 has no snapshot, so the header, each page and each label are
read at different moments, and every render's manifest says so.

The licence guard admits Data's two packages, for the provider alone. Each
is admitted at its exact version and with the licence file the review
read. 0006 had said this pull request would have to decide that
([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).

The install gate reads the quotation starter's data from a server that
answers Data 0.1.0's routes, using the `@formancy/data-client` that npm
installs. It requires the quotation's own data back, rendered. That server
is a fixture, and nothing here has run the provider against a real Data
server.

**A getting-started guide, whose code the install gate compiles and runs**
([0015](docs/decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)).
`docs/getting-started.md` takes an application developer from an empty npm
project to a quotation printed as a PDF in Node and in a browser, and to the
editor in a React page that saves and previews and in an Angular page that
saves. Prose code drifts silently, so every block of it is handed to the
install gate against the packed packages: the Node program must write a PDF
and print exactly the
lines the guide shows, the React page has a project of its own that also
installs the renderer -- the builder's own project still holds only what the
builder declares -- and the Angular page is compiled into the Angular
builder's projects, each page drawn on a server and bundled for a browser at
both ends of its builder's peer range. That also installs the renderer's
browser entry from its tarball, type-checks it against the DOM's types and
bundles it for a browser, which nothing did before. The guide is read as
GitHub reads it, with marked: a fence in a list item or a quote is code and
is compiled, a fence inside an HTML comment, which no reader sees, is not,
and an indented block or an untagged install or output block is refused.
The guide sets a reader's Node project up as the gate sets up its own --
ES modules, the tools at the gate's ranges, and a `tsconfig.json` with the
gate's compiler settings, which now include `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess` in every host -- and names, before each block,
the file it goes in. A guard in `pnpm test:repo` fails when a block escapes
the gate, a file goes unnamed, an install line names what the gate does not
install, or a link or anchor no longer resolves. The gate takes longer: 51.2
s before and 65.4 s after on one machine, one run each.

**The two builders' accessible trees are compared with each other, and the
differences that found are gone**
([0012](docs/decisions/0012-the-builders-are-native-and-share-one-session.md)).
The shared scenarios held the React and the Angular builder to each other
only where a scenario finds a control by role and name; what else each
drew -- a description, a state, a name as a real browser computes it --
nothing compared, and release gate G3 asks for equivalent accessible
controls. The Studio now compares them twice. Its suite mounts both
builders side by side over one editor and requires the same tree at each
state of a walk by the editor's own actions -- every kind placed, a row of
each kind selected, a problem, a refusal, undo, each pane -- over every
starter, in all three languages. Its browser
gate walks each builder through the same states of every starter in
Chromium -- the place chooser, a selection, a problem, a refusal, undo,
each pane, in the one-pane layout and the side-by-side one -- and requires
the same Playwright snapshot and the same tree Chromium itself computes,
leaving out only ids and wrappers that say nothing (`accessible-tree.mjs`
says which, and a test holds it). What it found, each now a test in the
builder that was wrong and seen to fail first:

- **A name after text on the page.** The React builder named its
  outline's region groups, its properties form and its problems' list after
  a heading drawn on the page, and Chromium puts a stylesheet's
  `text-transform` into such a name: "BODY", "TEXT: NOTE", "PROBLEMS", where
  the Angular builder's said "Body". Both builders named the problems'
  count and the place chooser that way. Every such name is now
  `aria-label` in the editor's words, a rule in report-builder-core's
  README, and the browser gate fails on any name in either builder that the
  page's `text-transform` changes.
- **A region's label read twice.** The React builder left it in the tree as
  text inside its group; it is hidden there, as Angular's was.
- **The keyboard moved by a new problem.** A problem listed before the one
  the keyboard was on dropped the keyboard to the page in React, and in
  Angular left it on the same button now naming the new problem. Each
  problem's element is now kept by what it is: `DiagnosticEntry.key`, new
  in report-builder-core's state.

With plan 21's switch across the frameworks and the subscriptions it
leaves already held by the Studio, gate G3 rests on its evidence and has
no open reason. The comparison costs time: on one Windows 11 workstation
on 16 October 2026 the browser gate took 253 s, 163 s before it, and the
jsdom comparison 18.6 s run alone. The README's pictures were retaken by
the script: their recorded text lost the region labels React read twice,
and no picture changed.

**Every starter opens with nothing in the problems pane.** The quotation
declared a print style, `strong`, that nothing used, so the first thing the
Studio showed a new author was a warning about it, and the README's picture
showed it too. The style is gone, and a corpus test now fails on any
diagnostic a starter raises, warnings included. The pictures were taken again
by the script.

**Formancy Report is source-available, on Formancy Data's terms, and the
licence is in force before a lawyer has read it** ([0001](docs/decisions/0001-a-paid-module-in-its-own-repository.md)).
Free to read, fork, evaluate, develop and test, including in companies and
without an expiry; a paid licence to run in production; a separate agreement
to redistribute. Customer data, report templates and the documents rendered
from them remain the customer's. `LICENSE.md` Version 1 is in force from
14 October 2026 and says at the top that no lawyer has reviewed it. Its
terms are Formancy Data's Version 1.1, so a Report + Data bundle is one kind
of agreement. An AGPL-plus-commercial model was the working direction until
this decision; it was withdrawn because it would have needed a compatibility
review for every bundle, and because Data already had a clear production
boundary to price against.

**The repository has Formancy Data's pipeline** ([0002](docs/decisions/0002-depend-on-upstream-never-copy-it.md)).
It brings:

- **Contributions under a CLA**, checked on every pull request against the
  hash of the text signed.
- **Workflows.** `gates.yml` with a `verify` job, a `test` job per package and
  an `install` job, called by `ci.yml` and by a `release.yml` that publishes
  only the tarballs the install gate ran, pinned by hash, with provenance and
  a signed SBOM. The SBOM describes what a consumer installs, made from those
  tarballs as npm installs them, without the peers a host brings
  ([0017](docs/decisions/0017-the-sbom-describes-what-a-consumer-installs.md)).
  CodeQL and dependency review run in `security.yml`.
- **Guards under `pnpm test:repo`**, each watched failing first: the licence
  field and files of every package, exact upstream versions, a generated
  `codecov.yml`, the README's licence sentence generated from `LICENSE.md`,
  the 600-line source budget, the test matrix against the workspace, and the
  workflows' shape.

Left out until there is something for them to prove: Formancy Data's release
report and container gates. Its browser gate, its README pictures' check and
its third-party notices in built apps came with the Studio.

**`@formancy/report-spec` names the report format and refuses what it does not
read.** `REPORT_FORMAT` and `REPORT_SPEC_VERSION` ('0', the draft) are
independent of formancy's `specVersion` and of every package version.
`checkSpecVersion` reads a report of that version. It refuses a formancy form
as not a report, naming its `specVersion`, and refuses a report of another
version, naming both versions, rather than reading part of it. Both are
quoted and shortened in the message, because a version string is the
document's to choose. It is the package that proves the pipeline: build,
packaging checks, the licence in the tarball and the install gate all run on
it.

**`@formancy/report-spec` defines the report, validates it and hashes it**
([0007](docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
`ReportDefinition` is a document of its own rather than a formancy form with
pages added, because a form's pages are navigation and its version line is
formancy's. It is still version '0', the draft: nothing written under it is
promised to be read by a later release, because the format is being fitted
to the three starter reports before it freezes. What it holds:

- **Layout.** A page, and five regions of flowing components with no
  absolute coordinates. Lengths are in points to the hundredth, and a finer
  one is refused rather than rounded, so one layout has one hash.
- **One table.** One table over one detail dataset, with one grouping level
  whose key orders the rows first. Its totals are rows, so a quotation can
  show a subtotal, a tax line and a total.
- **Aggregates.** Declared once and printed by id, over the current group or
  every row, with declared rounding.
- **Bindings.** Every field reference is one shape. Dataset field,
  parameter and aggregate ids are formancy field keys, so a form's or Data's
  key binds unrenamed and CEL reads it with a dot.
- **Images and currencies from the data.** An image can come from an
  `image` field: a photo or a signature taken with a form, resolved by the
  host from an approved id and digest, never an address. A currency can come
  from a field or a parameter.
- **Styles.** Print styles are tokens, not CSS, with conditional style
  rules.
- **Expressions.** The names an expression reads, in each place, are fixed
  in the format, because every saved condition is written against them.

What comes with it:

- **`validateReport`** collects every error, each with a JSON Pointer, a
  stable code and the component it is in. It also refuses a fixed size the
  page cannot hold, while the author edits rather than at render time. A
  template is untrusted input even when an administrator wrote it, so it:
  - never throws;
  - never runs a getter;
  - reads every array's length once, before reading an element;
  - echoes no input into a message or a path.
- **`reportHash`** hashes only a report the validator reads, over an
  envelope that names the format, so a form and a report never share a hash
  and nothing invalid is ever pinned.
- **`emptyReport`, `walkComponents` and `componentAt`**, the units and the
  page geometry are written once here, so the editor, the core and the
  runtime do not each write their own.

**`@formancy/report-spec` now depends on `@formancy/spec` 0.5.0**, at that
exact version, for `schemaHash`: the report hash uses formancy's
canonicalisation rather than a second one.

**pdfmake renders reports, chosen by a trial on an adversarial corpus**
([0005](docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[the trial](docs/renderer-trial.md)). `@formancy/report-corpus`, private and
never published, holds fourteen fixtures, each one way a report goes wrong:
a row lost at a page break, a header that does not repeat, a group header
left at the foot of a page, a summary that just fits or just does not, exact
decimals, text outside ASCII, an invalid image, an oversized job. pdfmake
0.3.11 and pdfme 6.2.4 each rendered all of them through a trial adapter.
pdfmake passed every fixture or refused it as the fixture allows; pdfme's
adapter left a group header last on a page. pdfmake was faster on every
timed document, and the trial document dates and qualifies every time. The
adapter keeps its own page limit, measures the page regions and every
keep-together block and table row before laying out, and checks image bytes
first, because pdfmake's defaults lose content without saying so. There is
no renderer package yet; `report-render-pdf` grows from that adapter.

**A rendered report is proved on the PDF it produced**
([0003](docs/decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
The corpus's checks read the PDF back with PDF.js, never the engine's input
and never a mocked engine. They hold every row once and in order, with its
own cells in column order on its own lines, so a value on the wrong row is a
failure; the column header above the table on every page it reaches; the
page header above and the footer below the body on every page, numbered; no
empty page and no heading alone at a page's foot; nothing past a margin or
over other text; every font embedded and every character drawn; and every
image at its size. What they cannot see -- rules, borders, clipping, colour,
glyphs touching beyond their computed boxes -- waits for page images.

**Dependency and font licences are a gate**
([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
`scripts/dependency-licences.mjs` runs in the `verify` job and walks the
production dependencies of every publishable package as installed, and every
font they ship. Permissive licences pass; GPL, AGPL, LGPL, SSPL,
source-available and non-commercial licences, a missing licence and a WITH
clause nobody has reviewed are refused, with the route the package came in
by. A font's licence is read from the font's own name table, because a
package's `license` field says nothing about the fonts it ships: `pdfjs-dist`
declares Apache-2.0 and ships GPL-licensed Liberation Sans. A repository test
also holds every publishable package's build to inlining nothing from
`node_modules`, since the walk never follows a devDependency. Review held this
until the renderer experiment brought the first third-party PDF libraries.

**Three version lines, each refused when unknown**
([0004](docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).
formancy's form spec, Report's own format and Formancy Data's contract move
independently of every package version, and a document says its version
inside itself. A release records the tuple it supports; the one this release
is built for:

| Line | Supported |
|---|---|
| Upstream `@formancy/*` | 0.5.0, exact: `@formancy/spec`, for the report hash; `@formancy/expressions`, for every expression |
| formancy form spec | none read yet; 1 to 4, as `@formancy/spec` 0.5.0 accepts them, when forms are |
| `reportSpecVersion` | "0", the draft |
| Formancy Data | 0.1.0, exact: `@formancy/data-client`, depended on by `@formancy/report-data-provider` alone ([0016](docs/decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| Node | 22.13 or later |
| TypeScript | `~6.0.3` |
| Angular, React | `@angular/core` ^22 and `react`/`react-dom` ^19, as peers of the builders; tested against 22.2.2 and 19.3.1 |
| pnpm | 12.4.2 |

**Node 22.13 or later, up from 22.12.** `pdfjs-dist` 6.4.299, which reads
every PDF the checks judge, declares `>=22.13.0 || >=24`. `engine-strict` is
off, so 22.12 still installs; what fails there has not been measured.

**`@formancy/report-core` edits a report through commands, and a refused edit
changes nothing** ([0008](docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
0007 makes the format strict, so an editor has to keep the document valid at
every step; this is the package that does. It follows formancy's builder
session rather than reusing its form commands. What it holds:

- **Commands.** Pure functions over a `ReportDefinition` for the title,
  locale and page; styles, datasets, fields, parameters, assets and
  aggregates; inserting, removing, moving, updating and duplicating
  components at any depth; and the table's columns, group, sort and footer
  rows. A command refuses, with a stable code, what it names and cannot
  find. It never clamps an index, so a keyboard move and a pointer drop
  agree. A component's patch is typed by its kind.
- **Commands as data.** `COMMANDS` and `CommandDescriptor` make each command
  data, for a proposal. A proposal arrives as JSON from a model:
  - a removal is `null`, because JSON has no undefined and a removal written
    as one would arrive as no change at all;
  - a descriptor whose arguments are too few, too many or of the wrong type
    is refused with `invalid-arguments` rather than thrown, so a bad
    operation refuses its proposal whole.
- **`openReportSession`.** It commits a command's result only when
  `validateReport` accepts the whole of it, so a refused edit leaves the same
  document object, revision and history, and notifies nobody.
  - Committed documents are deeply frozen, so `useSyncExternalStore` and
    Angular signals can compare by identity.
  - What an edit did not change keeps its object, matched by id within its
    list, so an insert at the top of the body does not redraw everything
    below it.
  - Undo and redo restore the exact snapshots, labelled, with 200 steps kept
    by default.
  - A transaction is one step, validated once at the end. Its callback runs
    synchronously: an await inside it would commit half a proposal, so an
    async one does not compile and a promise is refused before anything
    commits.
  - An edit bound to a `reportHash` that is no longer current is refused as
    stale, and a command that edits the session while it runs throws, so no
    edit is lost under another.
- **`tryEdit`** gives a transaction's verdict without committing it, from the
  same draft: what a proposal's review shows before Apply (plan 16).
- **`locationOf`, `locations` and `validLocations`** tell a builder where a
  component stands, every place one could go, and the places the validator
  accepts it in. Drop targets come from asking the validator, so they cannot
  disagree with what the session then commits.
- **`diagnose`** lists the errors the runtime would refuse a report for, and
  warns of unused declarations, an empty body and a text that prints nothing.

**`@formancy/report-core` compiles every expression once, for the editor and
the runtime** ([0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
`compileReport` gives the programs, what each reads, the members each name
holds, the aggregate order and the errors. `expressionValues` binds a
program's values. If the runtime assembled its own compile options, it could
accept what the editor refuses, `now()` among them, or bind a value as a
type the editor never checked it as. What it decides:

- **Every member read is checked as its type.** `params.copies + "x"` is an
  error, and `row.amount < dec("0")` is fine whichever side the decimal is
  on.
- **Decimals are used as decimals.** An exact value is used as what it is:
  `row.amount * dec("1.081")`. `dec(row.amount)` is a type error, because
  0.5.0 has no `dec(decimal)`.
- **Refused, because a report renders the same from the same data:**
  `now()`, `today()`, `random()`, a name read whole (`size(params)`), and an
  image field read as a value.
- **Aggregates are computed in the order they read each other.** One that
  reads its own total is an error, at the read that closes the circle.
- **Each error points at the component, the table column and each read**,
  not at a stretch that covers unrelated text.

**`@formancy/report-core` depends on `@formancy/expressions` 0.5.0**, at that
exact version, to compile expressions with the compiler the runtime will use
rather than a second one. Its 0.5.0 declares a variable only by its whole
name, so each member read is spliced, by its own `rewritePath`, into one
variable declared with the member's type. A decimal that may be null is
checked as `dyn`, which 0.5.0 will not test for equality with a decimal.

**A report can be designed in a native React or Angular builder, over one
session** ([0012](docs/decisions/0012-the-builders-are-native-and-share-one-session.md)).
Three packages arrive, and what holds them to each other is the reason for
their shape:

- **`@formancy/report-builder-core`** is the editor both builders render:
  one person's view of a report-core session -- selection, zoom, open
  pane, drag -- and everything a builder shows, derived from the document
  once: the outline, the palette, the property fields (a length edited in
  millimetres, refused in millimetres too), the design view's geometry,
  the drop targets (report-core's `validLocations`, so a builder never
  offers a drop the session refuses), the diagnostics, which actions have
  somewhere to go, and a live region's announcements. Its state is deeply
  frozen and keeps its identity until something changes. Keys are decided
  once, in `actionForKey`, with every drag's keyboard path (formancy.ai
  0046). Every word is in one catalogue, in English, Swiss German and Swiss
  French. No framework, no DOM, no Node. Several editors share one session:
  the document and its undo history live only there, so a builder of either
  framework can be destroyed and another mounted without losing a step.
  What it puts into a report -- a new text's "New text" -- is in the
  report's language, because it prints; the session keeps each step's label
  as an English sentence any reader of it can show, and each editor says it
  in its own language. `report-builder.css` dresses both builders through
  formancy's `--wb-*` variables and `data-report-part` hooks, never a
  framework's class or a colour of its own.
- **`@formancy/report-builder-react`** and **`@formancy/report-builder-angular`**
  render that state natively: `useSyncExternalStore`, and signals with
  `OnPush` and no zone.js. Neither depends on the other, and the Angular
  package's closure has no React (plan 21). Both render one accessible
  structure: a region named "Report editor", a toolbar that is one tab
  stop with buttons for the panes a narrow screen shows one at a time, a
  tree whose focus is its selection, a place chooser for every drag, a form
  of properties with a way back to the report's own, a counted and
  announced list of problems, and a design view of named pictures, labelled
  as not the PDF.
- **`BUILDER_SCENARIOS`** is that structure as data: steps that find
  elements by role and accessible name. Each builder runs every one, in all
  three languages, with axe over each end state, and the core runs them
  against the model. A review that compared the two builders found them
  apart in places the scenarios did not reach -- a narrow screen
  stuck on the outline, focus lost after deleting the last row, no way back
  to the report's properties, tools that said nothing, problems never
  announced, a pointer read a pixel off -- and each is now a scenario, a
  rule both builders follow, or a test.
- **The Angular package is built by ng-packagr** into `dist/`, and
  `scripts/finalize-angular-dist.mjs` makes ng-packagr's manifest the one
  that is published; pnpm packs it from `dist/`. The install gate imports
  it from its tarball, as it does the React builder (below).

What waits for the Studio: a browser gate for layout, contrast and real
pointers, a check of the README pictures, and a test that mounts both
builders over one session.

**`@formancy/report-runtime` resolves a report against its data, exactly, or
refuses it** ([0010](docs/decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
`resolveReport` returns the renderer-neutral document a PDF engine draws, a
manifest of what it was resolved from, and a preview's warnings; or every
reason it will not, tagged with the stage that found it, never part of a
document. Grouping, totals, rounding and formatting are decided here once, so
that a renderer, a builder or the server never decides them again. What it
holds:

- **The data contract.** Every value is held to its field's type before
  anything reads it. A decimal arrives as a canonical string and is refused
  as a JavaScript number, which has already lost digits; a field the report
  does not declare is refused, so nothing it does not print rides along into
  a render, a cache or a log. Missing is not null: a field the data lacks is
  an error in a final render, never an empty cell.
- **Final and preview.** A final render refuses data the provider calls
  incomplete. A preview prints what it has, warns once per missing field,
  and labels every page and its manifest, so that it is never taken for the
  report.
- **Exact totals.** Integers as BigInt, decimals exact; a declared rounding
  is applied once, to each group's exact total and to the report's apart.
- **Formatting** through Intl, handed exact digits already rounded half away
  from zero, never a double. A date prints as the same day in every time
  zone; only an instant is shown in the zone the host names. A locale or
  zone the engine lacks is refused rather than replaced by the host's.
- **Bounds.** 100,000 detail rows, 20,000 steps an expression and 5,000,000
  a render, 20 MB an image, each asset asked for once and shared.

**`@formancy/report-render-pdf` draws a resolved report with pdfmake, and
refuses what it cannot draw whole**
([0005](docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0011](docs/decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
`renderPdf` resolves to the PDF's bytes or rejects with a `RenderRefusal`
whose code says why; a refused report has no PDF at all. It grew from the
renderer trial's adapter and draws all of version 0: columns, framed
sections, rectangles, rules of any weight and colour, styles per row and per
cell, images fitted to their box. Every fixture of the corpus passes, with
none excused. Beyond the trial's rules, from a review of its first build:

- **A width is a number.** A fill column handed to pdfmake as `'*'` widened
  to its longest word, and pushed a table's amounts off the paper while the
  render succeeded.
- **A word in a table cell is never broken.** 'CHF 10,612,357.00' broke
  into '…357.0' and '0', two numbers; a word wider than its column is
  refused, naming the table, row and column. A paragraph still breaks a
  long word, over up to 16 lines, and refuses a longer one before pdfmake
  spends a minute breaking it.
- **Every character is held to its font.** pdfmake printed a character
  Roboto lacks as an empty box and U+0000 in the text; CJK, Hebrew, emoji,
  a tab and an fr-FR amount's narrow no-break space are refused instead,
  until fallback fonts exist.
- **A table's closing rows stay with what they close**: a subtotal, a VAT
  line, a total never stand alone at the top of a page.
- **Work that grows with the document.** A table's breaks are planned, so a
  1,600-group table renders in about 4 seconds instead of 60; a body too
  long for the page limit is refused before pdfmake measures it; an abort
  from a timer reaches a render between its passes.
- **Nothing taller than the page**: a rule, a frame, the images' data
  together.

It runs in Node and has a browser entry, built and tested in Node, that is
not yet in the package's `exports`.

**`@formancy/report-core` refuses an expression that would print an inexact
number, and a rounding the runtime would refuse**
([0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
A double literal, `double()` and a division with `/` are errors
(`expression-inexact`), because upstream hands an integer and a double back
alike: `int(double("4.35") * 100.0)` printed 434 as though it were exact, and
`3 / 2` printed 1, a rounding nobody declared. `divide(dec(a), dec(b),
places)` is the exact division. `matches()` is an error
(`expression-unbounded`): one backtracking pattern took 39 seconds inside a
single step of the budget. A rounding on a total that has no places
(`rounding-not-decimal`), and a number format that would round a rounded
total again (`format-rounds-again`), are errors too: every render refused
the first while the editor said nothing.

**A group header reads its own key**
([0007](docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md),
[0009](docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
`group.key` is the value the current group is keyed by, typed as the field
grouped by, so a header can compute with it rather than only print it. An
aggregate may not be called `key` (`reserved-id`).

**The year 0000 is refused** in a date, a date and time, an instant and a
parameter's default: Intl prints it as the year 1, without its era, a year
nobody wrote.

**Three starter reports** in `@formancy/report-corpus`, each proved end to
end on the PDF it renders: a service inspection with long notes, a framed
defect, a photo from the data and a sign-off; a Swiss quotation with its
supplier, line items, subtotal, VAT, cash rounding and total; and an
equipment register grouped by site. The README shows a page of each, drawn
from the PDF by PDF.js, and a test holds each picture to the text of its page.

**The README's "Render a report" runs in the install gate**, line for line,
from the packed packages, on the quotation starter: a test fails when the
README's lines are not the consumer's.

**The install gate checks each builder as its host would use it, from its
tarball.** It installed both builders and imported neither. publint and attw
read their manifests, but nothing outside the workspace loaded their code or
checked their declarations against the React or Angular a host installs.

- **A project per kind of host**, holding only what that host has
  (`scripts/install-hosts.mjs`). In one project shared with the Node
  consumer, a builder resolves what a browser host lacks: Node's types, or a
  package it never declared.
- **Both ends of each peer range.** npm installs the newest release a range
  admits, so a builder that needs a later API, or carries its own React,
  passes there. Each builder is also installed with its framework at the
  range's floor, read from the packed manifest, and the gate prints the
  versions it installed.
- **React:** `react.tsx` is type-checked as a browser's code (DOM types, no
  Node types, `skipLibCheck` off). It draws `<ReportBuilder>` with
  `react-dom/server` in React's development build, which must say nothing,
  and in its production build, which is what a host's bundler ships.
- **Angular, ahead of time.** `angular.ts` is a host's component,
  `<report-builder [editor]="editor" />`. ngc compiles it with strict
  templates against the builder's declarations. `build.mjs` bundles it,
  linking with `@angular/compiler-cli`'s linker as the Angular CLI does, and
  that linker refuses a library published for a newer Angular. The bundle is
  then drawn by `@angular/platform-server` without the JIT compiler. While
  the page lives the editor has one more listener, and none once the
  application is destroyed.
- **One statement of the structure.** What both builders draw is held once to
  report-builder-core's README by `structure.ts`: names from the editor's
  catalogue, a palette button, outline row, box and problem for each in the
  state, and every `data-report-part` one `REPORT_PARTS` names.
- **A browser bundle.** Each builder is bundled for a browser by esbuild, so a
  Node built-in in its code fails.

Each break below was seen to fail the gate on a tarball broken for it, with
the unbroken tarballs passing. Each check in `structure.ts` was also seen to
fail on each builder's real markup, broken once per check. A declaration
file that renames the `[editor]` mapping fails at ngc (NG8002); one that
imports a package the builder does not declare (TS2307), or references
Node's types (TS2688), fails at the type check. Code fails at its run when
it imports an undeclared package, carries its own React, renames the input
only at run time (NG0950), keeps its listener on the editor after the
application is destroyed, or imports Angular's JIT compiler. It also fails
at its run when it drops a part from a template's imports, which leaves the
palette undrawn. React's development JSX fails in the production build. An
API newer than the floor of React's range fails at the floor only. A Node
built-in fails the browser build. A library declared for a newer Angular is
refused by the linker, and one published fully compiled leaves the builder
nothing to link. A manifest with `workspace:` or `catalog:` versions is
refused by npm. A builder with a peer its host does not install, or no peer
on its framework, is refused when the gate plans its projects. One whose
dependency brings Node's types into a browser host's project is refused once
it is installed.

What it does not show: either builder mounted in a DOM -- focus, keys, a
pointer, a re-render after an edit -- which is each package's suite, in jsdom.
A React server render runs no effects, so the React check shows that nothing
subscribes while drawing, not that unmounting unsubscribes. Angular runs in
its development mode only. The Angular CLI drives the linker through OXC by
default; the gate drives the same linker through its Babel plugin.

The gate costs more than twice what it did. On one Windows machine (Node
24.21, npm 11.19, npm cache warm, 16 October 2026), the gate as it stood
before this change took 23.0, 20.6 and 19.5 seconds over three runs. This
one took 52.8, 49.9 and 49.2, with its five projects installed at once.

**`png-js` 1.1.0 is a reviewed licence exception**
([0006](docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
It reaches the renderer through pdfmake and PDFKit and declares no licence;
the LICENSE it ships is MIT.

**The Studio: the starters in both builders, with the real PDF beside them**
([0013](docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
`apps/studio`, private and never published, opens each starter and a blank
report in the React or the Angular builder over one session per starter,
and previews the PDF the session prints: resolved by the runtime, rendered
in the page by `@formancy/report-render-pdf/browser`, and drawn by PDF.js on
white paper, with Download PDF giving the bytes on the paper. A refusal is
listed with a button that selects its component. `pnpm --filter
@formancy/report-studio dev` serves it on port 4394. It wears formancy.ai's
admin palette, copied under the mark Formancy Data uses and pinned to
admin.css at e3c5967 by the palette guard, with the builder's panes
recoloured only through `--wb-*` and given the admin's geometry without its
colours; and the README's pictures of it are taken by a script and held to
the text they show, as Formancy Data's are. The PDF.js viewer stays inside
the app, because 0006 refuses `pdfjs-dist`'s Liberation Sans in a published
closure. The fonts come from Google Fonts, as in Formancy Data's apps, not
self-hosted as formancy.ai's admin serves them.

**Two new gates in CI's `browser` job.** The Studio's browser gate measures
in Chromium what jsdom cannot: layout from 320 pixels up, the keyboard's
path, axe with contrast and target size, every starter's PDF drawn on white,
the framework switch, a pointer's drag, the place chooser, Final and the
Preview's zoom. The README pictures' check walks the same page again. The
Studio's own suite joins the `test` matrix and `codecov.yml`.

**The builders: three fixes the Studio found, each a shared scenario or a
test in both builders.** An undo that leaves nothing selected -- of a
duplicate, of an insert -- now puts focus on the outline's tree rather than
on its first row, which focus selected, so the next Delete deleted a
component nobody chose. An empty report's outline is an empty tree with a
sentence beside it saying so, where it held region groups with no rows,
which axe refuses (`aria-required-children`). A place chooser drawn by a
builder that did not open it -- after a framework switch, the drag is the
editor's -- no longer takes the keyboard when it is drawn, and Cancel or
Escape in it lands on the palette entry of what was being placed instead
of on the page. In React, a pointer drag that dropped away from where it
began no longer swallows the next keyboard press of a palette entry. The
report's title is a hook of its own, `data-report-part="title"`, drawn on
one line in the text colour, and the design view's note wraps to its pane.

**Every run of the gates ends in a release report, and a release publishes
only what its own report passed**
([0014](docs/decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md),
[docs/release/](docs/release/README.md)). Formancy Data's release report,
ported and fitted to what this repository has. Every job of `gates.yml`
collects what it found and uploads it; a last `report` job builds the report
from all of them and fails the run on anything it cannot show. It says what
the run was tested on -- every runtime dependency as published, as the
suites loaded it and as a clean install resolved it; each builder's React or
Angular as declared, as its suites ran it and as each install host
installed it at both ends of its peer range; upstream `@formancy/*`; Node,
pnpm, TypeScript and PDF.js; the Chromium the browser gate launched beside
the build the Playwright it ran pins -- each package's results, the Studio's
browser gate and its README pictures' check, the tarballs by sha256 against
the `dist/` every job built, the release gates, and the known
limitations: those the run shows, then a register with an entry for every
decision record, held to each record by hash. A suite is held to every test
file the checkout holds for it, known by its name rather than by the suite's
own include, because a file renamed past the include, or an include
narrowed, would otherwise stop running with every count still green. The
install gate is held to every host `scripts/install-hosts.mjs` plans, each
step done and each builder's framework resolved, at its range's floor where
it should be, rather than to the one flag the gate writes. The browser
gate is held to every pass it planned, each with a check in it, and the
pictures' check to every scene `scripts/pictures/scenes.json` gives the
Studio, read from that file rather than from the check, each from the file
it writes however it ends, because a gate that stopped part way passes every
check it reached. Both are held to the Chromium build Playwright pins,
launched headless as `scripts/browsers.mjs` says, because Playwright pins
the headless shell and the full browser at one version. A published
package with no suite fails the run too. What 0004's table above says
a release was tested against is now derived from the run that gates it, in
the report and in the release body, because a version typed here could name
one no run tested; the table stays as what this release is built for.

The gates are the plan's, in `docs/release/gates.json`: G1 and G2 rest on
evidence each run must pass; G3 rests on the builders' scenarios, the
Studio's switch across the frameworks over one session and its browser
gate, and stays open because no test compares the two builders' accessible
trees with each other; G4 to G7 belong to later releases; and the legal
review stays open while `LICENSE.md` says no lawyer has read it, which
`scripts/licence-status.test.mjs` now holds. In a
release, `check` refuses a report that is not this run's, green and whole,
and tarballs that are not the ones the report says the install gate ran,
before it pins anything; `publish` refuses anything else again, then signs
the report beside the SBOM and attaches both to the GitHub release, whose
body is the changelog section and the report's summary. The install gate now
records each host's tools and the runtime dependencies a clean install
resolved, for the report. Not yet run on GitHub: the first pull request is
the report job's first run, and the first tag `publish`'s.
