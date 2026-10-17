# Changelog

All notable changes to Formancy Report. Every package moves on one version
number. The versions of the upstream `@formancy/*` packages this repository
depends on are a separate line, and a change to one is called out explicitly.

Loosely [Keep a Changelog](https://keepachangelog.com), with reasons attached —
a line that says only *what* changed is rarely the line you need six months
later.

## Unreleased

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

  repository does not own (`.github/REPO-METADATA.md`).

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
