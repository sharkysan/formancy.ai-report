# 0038 — A report's e-invoice may be an XRechnung 3.0, in CII alone: its XML, written by the one writer, is the invoice a host takes from the resolved document, and its PDF a plain copy labelled so on every page; what XRechnung needs past EN 16931 refused where it is missing by the rule that needs it, a `#` line in its payment terms refused until XRechnung 4.0, a Leitweg-ID under 0204 held to its check digits, and KoSIT's XRechnung scenario and Mustang judging a sample and four controls; the ZUGFeRD XRECHNUNG hybrid, a refused PDF, UBL, a Leitweg-ID check on every buyer's reference and Skonto written in XRechnung's syntax lost

- **Status:** accepted; extends [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), narrowing for this kind alone the plain PDF it and [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md) foreclose, and [0037](0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md), whose terms an XRechnung needs and whose Leitweg-ID it checks; narrows [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md), whose builder refuses a CMYK JPEG now in a Factur-X invoice alone
- **Date:** 2026-10-21
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-xrechnung.test.ts`: the
    kind `xrechnung` beside `facturX`, of a version of
    `XRECHNUNG_VERSIONS` alone, `XRECHNUNG` pinned whole, neither kind
    taking the other's key, and the XRechnung read back whole and counted
    in the hash; each of the six parts XRechnung needs past EN 16931 left
    out and refused there, naming its rule, and the same left out of a
    Factur-X invoice valid, and one under a parent written as a string or
    a list said at the parent alone; each of the seven texts it needs written blank
    and refused by its rule, where a Factur-X invoice's is "blank: a term
    the e-invoice does not hold is left out of it"; payment terms with a
    line led by `#`, a well-formed Skonto line among them, refused by
    BR-DE-18 in an XRechnung and taken in a Factur-X invoice, and a `#`
    inside a line or after a no-break space taken in both; an electronic
    address under 0204 held to a Leitweg-ID in either kind, its check
    digits and its shape, the same text under 0088 held to nothing, and
    the buyer's reference held to no Leitweg-ID; an XRechnung's title of
    any text, where a Factur-X invoice's is refused; and every rule id a
    refusal names one of `EN16931_RULES` or `XRECHNUNG_RULES`.
    `src/xrechnung.test.ts`: `XRECHNUNG_RULES`, `XRECHNUNG_NEEDS`,
    `XRECHNUNG_TEXT_NEEDS` and `XRECHNUNG_HELD` pinned whole, every id the
    needs and the shapes name listed and none listed that nothing names,
    and no held rule a refused one; the lines `skontoBreak` refuses held to
    a reading of the lines BR-DE-18 reads, `tokenize(. , '(\r?\n)')` and
    `normalize-space`, on every text of five characters or fewer over
    seven that part them, and the longest text a template's runs may hold
    checked within 2 s; `leitwegIdBreak` taking every Leitweg-ID of
    KoSIT's test suite, in its CII and its UBL instances, whose check
    digits MOD 97-10 gives, refusing the three whose digits it does not
    give, 00 written for 97, and thirteen texts of another shape, taking a
    fine address of 30 characters and a coarse one of 12, its digits
    computed in the test by BigInt, and refusing the longest text within
    2 s. `src/en16931.test.ts`: the XRechnung's text
    table EN 16931's but for the eight terms it says, `neededBy` naming an
    XRechnung rule as XRechnung's, and `checkElectronicAddress` holding a
    Leitweg-ID after its term's rule, in either kind.
  - **The editing core.** report-core's `src/expressions/e-invoice.test.ts`:
    `invoice`, `vatBasis` and `vatAmount` bound in an XRechnung as in a
    Factur-X invoice of the same terms, member by member, refused in an
    aggregate's expression as there, and the sample diagnosed clean.
    `src/diagnostics/parts.test.ts`: every expression an XRechnung holds
    found, the buyer's reference read from data among them.
  - **The runtime.** report-runtime's `src/xrechnung.test.ts`: a final
    render's file `{ kind: 'xrechnung', xml, syntax: 'cii', guideline,
    version: '3.0' }`, its BT-24 KoSIT's `XR-CIUS-ID`, and `XRECHNUNG`
    handed on as report-spec's own object; the XML byte for byte the XML a
    Factur-X invoice of the same terms writes, BT-24 apart; every page's
    header opened by `XRECHNUNG_COPY_PARAGRAPH`, `XRECHNUNG_COPY_LABEL` in
    the labels' style, pinned whole and frozen, where a Factur-X invoice's
    final render has none; a preview writing none and labelled as every
    e-invoice's is; the buyer's reference and its address given by data as
    nothing refused by BR-DE-15 and PEPPOL-EN16931-R010, a contact given as
    nothing refused at each term by BR-DE-5 to -7, a Skonto line from data
    refused by BR-DE-18 and written in a Factur-X invoice, and a Leitweg-ID
    from data of wrong check digits refused. `src/lower-e-invoice.test.ts`
    holds a Factur-X file to its kind, and `src/cii.test.ts` the three
    samples' XML byte for byte, the writer now handed its guideline.
  - **The corpus.** report-corpus's `src/starters/xrechnung.test.ts`: one
    sample, "Rechnung (XRechnung)", no starter and no Factur-X sample; the
    Factur-X sample's template apart in nothing but its id, title, kind and
    version, the addressed sample's business process, address and contact,
    the buyer's reference and address read from the Leitweg-ID, the header
    field that gives it and the head's line that prints it; valid and
    diagnosed clean; resolving to its XML and a labelled document; and its
    XML taking its path at CEN's paths. `src/starters/e-invoice.test.ts`
    holds its amounts to its data computed in BigInt and its page --
    table, totals, head with the Leitweg-ID, terms, bank details and code
    -- to its XML, as every sample's. `src/e-invoice-xml.test.ts`: the same
    report as an XRechnung holds every term at the same path with the same
    text and attributes, BT-24 apart, read by saxes.
  - **The renderer, on the PDF it produced.** report-render-pdf's
    `src/xrechnung.test.ts`: the sample's copy a PDF 1.3 with no metadata,
    no output intent, no associated file and nothing in the name tree, by
    pdf-lib, no attachment by PDF.js; on a copy whose table runs to two
    pages, the label the first line of every page and on it once; the same
    pages from both entries and the same bytes twice.
    `src/e-invoice-samples.test.ts`: the copy embeds nothing, its XML's
    amounts are its data's in BigInt, and what its page prints, read by
    PDF.js where it stands, is what its XML holds and nothing else, the
    label first ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    `src/refusals.test.ts`: a file of a kind the renderer does not know, a
    Factur-X file without its kind, and an XRechnung of another syntax,
    version or guideline refused naming `eInvoice`, never the XML; an
    XRechnung whose page header does not open with the label as the
    runtime writes it refused naming `pageHeader`, seven ways, a page
    number run in the label, and the label in white, at one point and in
    no style of its own among them; and the one it knows drawn in both
    entries, a title with `&` among them. `src/assets.test.ts`: a CMYK JPEG
    drawn in an XRechnung's copy, which a Factur-X invoice refuses.
  - **The builders' core, and the Studio where it meets the renderer.**
    report-builder-core's `src/images.test.ts`: a CMYK JPEG a person adds
    refused in a Factur-X invoice, as before, and added to an XRechnung.
    The Studio's `src/images/image-store.test.ts`: on the XRechnung
    sample, the editor takes the image and the final render draws it in
    the copy, where on the e-invoice sample both refuse it, so that the
    two places that decide it are held to one answer for each kind.
  - **The e-invoice gate.** `scripts/e-invoice/corpus.mjs` takes the
    XRechnung sample beside the Factur-X ones, each entry with its kind's
    KoSIT scenario (`KINDS`) and the guideline Mustang must read it as,
    draws no PDF of it, and makes four controls of it, each without one
    term XRechnung needs or with one line BR-DE-18 refuses
    (`corpus.test.mjs`). `kosit.mjs` and `mustang.mjs` judge each entry by
    its own scenario and guideline (`kosit.test.mjs`, `mustang.test.mjs`).
    `oracle.mjs` holds each need's rule to a fatal rule of the pinned
    XRechnung schematron whose context and test are the element the
    runtime writes the term as (`XRECHNUNG_PLACES`), BR-DE-18 to reading
    the lines `skontoBreak` refuses (`XRECHNUNG_SKONTO`), each held id to a
    rule there whose context and test are, white space aside, the ones its
    reason was read against (`XRECHNUNG_HELD_RULES`), each version and
    guideline to the schematron's `XR-MAJOR-MINOR-VERSION` and
    `XR-CIUS-ID`, which it reads by resolving its `concat`, and each
    version's release to the one the register pins the configuration to
    (`oracle.test.mjs`, and over the pinned schematron on 21 October 2026
    with report-spec's lists or the schematron changed in memory, each
    change named). `mustang.test.mjs` holds the rules Mustang fired on the
    recorded XRechnung sample and on the first Factur-X sample, 25 and
    179. On 21 October 2026, on Zulu 25.0.4.1 under Node 24.21.0 on
    Windows, the gate passed and recorded the run: KoSIT 1.6.3 matched
    `e-invoice-xrechnung.xml` to `EN16931 XRechnung (CII)` and accepted it
    with no message, and refused `control-br-de-15.xml`,
    `control-br-de-2.xml`, `control-peppol-en16931-r020.xml` and
    `control-br-de-18.xml` each with `error val-sch.2` and the one rule it
    breaks alone; Mustang 2.26.0 read the sample as the XRechnung's
    guideline, fired 25 rules on it and failed none, and refused each
    control with `error 27` and the same rule alone. The four Factur-X
    samples' XML and their PDFs' inflated digests were what the record
    held before. Run again without `--record`, it passed against what it
    had recorded, and again after review, the held rules' tests and the
    release held, with nothing recorded anew.
  - **The install gate.** `scripts/install-fixture/e-invoice.ts`, from the
    packed tarballs: an XRechnung of the addressed invoice's terms and
    KoSIT's test Leitweg-ID validated; one without its buyer's reference
    refused by BR-DE-15, and one of a Leitweg-ID of wrong check digits by
    its rule, neither quoting it; a final render's file of its kind, CII
    and version, report-spec's `XRECHNUNG` handed on by the runtime, its
    XML the addressed Factur-X invoice's byte for byte but for BT-24 and
    the buyer's reference and address; its page header the label, the
    runtime's paragraph whole; and its copy a PDF that embeds nothing and
    states no PDF/A. Its first run on
    21 October 2026 failed where 0037's consumer read XRechnung's telephone
    rule as the first of `XRECHNUNG_RULES`, which this record grew; it now
    reads it from `XRECHNUNG_PATTERNS`, and the gate passed.
  - **The guide.** `docs/getting-started.md`'s section "An XRechnung: take
    the XML" is compiled with the Node program and run by the install
    gate, which holds the two lines it prints
    ([0015](0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)).
  - **Each watched failing, on 21 October 2026.** report-spec's new and
    changed cases, 20 of them, before the kind, the rules and the checks
    were there; report-core's 2 before its walk knew the kind; the
    runtime's 9 before its resolver, writer and file did; the corpus's
    sample tests before the sample, which failed to import; the renderer's
    12 refusals before its checks; the gate's oracle tests against
    `main`'s oracle; the validator's case of a need under a parent written
    as a list, which it refused a second time. After the code: the
    renderer's copy and page tests, 5, with the runtime's label taken out
    and rebuilt, its plain-copy test with PDF/A drawn for every e-invoice,
    and its case of a page number in the label with a field read as no
    text; and the oracle over the pinned
    schematron with BT-10 needed by BR-DE-16, the payment instructions by
    BR-DE-2, BT-41 by BR-DE-6 and BT-42 by BR-DE-27, a guideline of
    `xrechnung_3.0.2`, a held id KoSIT lacks, and BR-DE-18 reading lines
    led by `#SKONTO` in a copy of the schematron, each named, and the
    schematron as pinned passing. After review: the oracle's cases of a
    held rule rewritten or moved and of another release, before the
    oracle held either, and over the pinned schematron BR-DE-16 taking
    `VA` alone, BR-DE-23-b refusing a payment reference, BR-DE-23-a moved,
    BR-DE-14 rewritten, a release of 3.0.3 and a held id with no pinned
    test, each named; the runtime's paragraph case before its export; the
    renderer's three cases of the label's style before it compared the
    paragraph whole; its CMYK case with the refusal widened to every
    e-invoice; builder-core's XRechnung case before its refusal was
    narrowed, and the Studio's with builder-core's refusal widened again
    and rebuilt; and `mustang.test.mjs`'s counts with one of them changed.
  - **Not held by anything here.** That a portal -- ZRE, OZG-RE or a
    Land's -- takes the file, routes it by its Leitweg-ID, or that the
    Leitweg-ID is a buyer's; the Leitweg-ID's format specification, which
    could not be read (Context); that XRechnung 3.0 is in force until any
    date; a customer's template, since only the sample and its controls
    meet KoSIT's XRechnung scenario; the XRechnung schematron's rules
    outside the lists this record names, which only the sample shows
    held; what a held rule's test calls, BR-DE-19's `xr:checkIBAN`, which
    the oracle does not pin with it; and Mustang's copy of that schematron,
    which judges the sample and the controls but which the oracle does not
    read.

## Context

[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
turned XRechnung down for the German B2B invoice, "it waits as a profile",
and named its absence a cost: "no XRECHNUNG or Leitweg-ID, so no German
public buyer". [0037](0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)
gave the format the terms XRechnung needs, optional for either kind, and
left the rest to this record: which of them an XRechnung needs, how it is
told apart, what a host gets and what the renderer draws. The owner chose
"More invoice formats" for 0.3.0 and accepted the plan's recommendations
for its questions: a plain PDF labelled as the copy (Q1), CII alone (Q2),
a Leitweg-ID checked where scheme 0204 names one (Q3), a `#` line in the
payment terms refused until XRechnung 4.0 (Q4), the standard-setters' own
test values (Q11) and XRechnung 3.0.2 (Q12).

What the pinned files say, read on 21 October 2026:
- **KoSIT's configuration of 2026-08-31**, the one
  `docs/release/e-invoice-tools.json` pins, is "Validator Configuration
  XRechnung 3.0.2", running XRechnung's schematron 2.6.0 for 3.0.2 and
  CEN's 1.3.16. Its scenario `EN16931 XRechnung (CII)` matches a CII file
  whose BT-24 is
  `urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`,
  the schematron's `XR-CIUS-ID`, built from `XR-MAJOR-MINOR-VERSION`,
  `3.0`; it runs the D16B schema, CEN's schematron and XRechnung's, lowers
  BR-CL-23 to a warning and raises CII-SR-452 to -454, -465 and -466 to
  errors.
- **XRechnung's CII schematron needs, fatally,** the business process
  (PEPPOL-EN16931-R001), the payment instructions (BR-DE-1), the seller's
  contact (BR-DE-2) and its name, telephone number and email address
  (BR-DE-5 to -7), the buyer's reference (BR-DE-15), and both electronic
  addresses (PEPPOL-EN16931-R020, -R010); the plan listed the reference,
  the payment, the contact and the addresses, and R001 is as fatal. It
  holds every `#`-led line of the first payment-terms description to its
  Skonto syntax, `#SKONTO#TAGE=n#PROZENT=n.nn#`, and the text after the
  last such line to begin with a line break (BR-DE-18). It checks a
  Leitweg-ID's presence, never its form.
- **KoSIT's XRechnung 3.0.2 test suite of 2026-08-31**,
  `xrechnung-3.0.2-testsuite-2026-08-31.zip`, SHA-256 1e81ef75…3d7, the
  digest GitHub gives its asset: nineteen Leitweg-IDs among its CII and
  UBL instances' buyer references and addresses under 0204, beside the
  word `Leitweg-ID` that one gives as its buyer's reference, of which
  sixteen have the check digits ISO/IEC 7064 MOD 97-10 gives and three
  do not, and the validator takes all of them; its CII instances alone
  hold sixteen, two of them of wrong digits. Instance 03.06a addresses a "Testkäufer" by
  `991-33333TEST-33`, whose fine address says it is a test's.
- **Mustang 2.26.0**, run by hand on a hand-made XRechnung of the
  addressed sample, read it as the XRechnung guideline, compiled CEN's
  schematron and its own copy of XRechnung's (`xslt/XR_30`), and accepted
  it; it refused it without its buyer's reference, contact, seller's
  address or business process, and with a malformed Skonto line, each by
  that rule alone, as KoSIT did; and it and KoSIT accepted it with a
  Leitweg-ID of wrong check digits, and with a well-formed Skonto line.
- **Not read.** The Leitweg-ID-Formatspezifikation 2.0.2: the copies at
  e-rechnung.service.rlp.de and xeinkauf.de refused or reset the
  connection from here on 21 October 2026. Its shape -- a coarse address
  of 2 to 12 digits, an optional fine address of up to 30 letters and
  digits in either case, two check digits, joined by hyphens, the digits
  by MOD 97-10 as an IBAN's -- is FeRD's data sheet's and secondary
  sources', as the plan found them, and agrees with every Leitweg-ID of
  KoSIT's test suite. Nor KoSIT's "Versionen und Bundles" page, so that
  3.0 is in force until at least 31 July 2027 rests on a secondary source.

## Decision

**A second kind, `xrechnung`, beside `facturX`.** An XRechnung holds the
terms a Factur-X invoice does, by the same rules (`EInvoiceTerms`), with
`version`, of `XRECHNUNG_VERSIONS` (`'3.0'`), where Factur-X has its
profile. `XRECHNUNG` names each version's BT-24, KoSIT's `XR-CIUS-ID`, the
release it was read from, 3.0.2, and its syntax, `cii`; the gate holds the
first to the pinned schematron and the release to the register. A kind or a
version this release does not write is refused, never written as another.

**What XRechnung needs is needed, by the rule that needs it.** An
XRechnung without one of the six parts of `XRECHNUNG_NEEDS` -- the
business process, the buyer's reference, the payment instructions, the
seller's contact, the seller's and the buyer's electronic addresses -- is
refused there, `invalid-e-invoice`, naming the rule:
"(XRechnung's BR-DE-15)". Its texts are held by
`E_INVOICE_KIND_TEXTS.xrechnung`, EN 16931's table with the seven texts of
`XRECHNUNG_TEXT_NEEDS` needed, so a blank one, a literal where it is
written and one from data at the render, is refused by the same rule, a
contact the data gives none of among them, which a Factur-X invoice leaves
out. `XRECHNUNG_RULES` grows by the ten rules a refusal now names.

**Rules nothing the format can say breaks are held, and listed.** BR-DE-3,
-4, -8, -9 (the UStG's full address), -14 (every category's rate, which the
writer writes), -16 (BR-S-02, -E-02, -AE-02 ask the same of S, E and AE),
-17 (380), -19 (the EPC QR code's IBAN rule), -21 (BT-24, which the writer
writes) and -23-a and -b (a credit transfer names its account, and the
format writes no card or mandate) are in `XRECHNUNG_HELD`, each with what
holds it, refused by no message of their own; the gate holds each id to a
rule of the schematron, and the rule's context and test, white space
aside, to the ones its reason was read against, so that a rule KoSIT
rewrites fails the gate until the reason is read again.

**One writer.** The runtime resolves an XRechnung as it resolves a
Factur-X invoice, by the same readers, totals and writer; `cii.ts` is
handed the guideline it opens with, and an XRechnung's XML is a Factur-X
invoice's of the same terms, byte for byte, but for BT-24. CII alone:
UBL waits for a buyer who needs it, with its own record.

**What a host gets is the XML.** A final render's `document.eInvoice` is
an `EInvoiceFile` of its kind: a `FacturXFile`, which now says its kind, or
an `XRechnungFile`, `{ kind: 'xrechnung', xml, syntax, guideline, version
}`, with nothing to embed it as. A host takes the XML and sends it -- to a
portal, by email, over Peppol, as the buyer asks; nothing here sends it.

**What `renderPdf` draws is a copy, and says so (Q1).** The runtime opens
every page's header of a final XRechnung with `XRECHNUNG_COPY_LABEL`,
"Copy of an XRechnung: the invoice is its XML, and this PDF is not the
invoice", as it heads a preview's. The renderer draws the document as
every report: no PDF/A, no file, no XMP; a title of any text and a CMYK
logo drawn, since neither reaches a PDF/A. A builder refuses a CMYK JPEG
a person adds to a Factur-X invoice alone, and adds it to an XRechnung,
narrowing [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)'s
refusal to the kind whose PDF cannot hold one. The renderer refuses an
XRechnung whose page header does not open with the label as the runtime
writes it, the paragraph `XRECHNUNG_COPY_PARAGRAPH`, style and all --
the text in white or at one point would say nothing to a reader, and
PDF.js would still find it -- naming `pageHeader`, and one of another
syntax, version or guideline, naming `eInvoice`, and an `eInvoice` of a
kind it does not know. This narrows, for this kind
alone, what 0027 forecloses ("a plain PDF of a report that is an
e-invoice") and 0031 ("a plain PDF of a final e-invoice"): a Factur-X
invoice's final render is still the PDF/A-3b that embeds it, and an
XRechnung's PDF is no e-invoice and says so.

**A Skonto line is refused until XRechnung 4.0 (Q4).** No line of an
XRechnung's payment terms may begin with `#`, white space before it
aside, as BR-DE-18 reads its lines (`skontoBreak`, BR-DE-18), a
well-formed Skonto line among them: XRechnung 4.0 replaces the syntax, and
a structured discount is its record's. A Factur-X invoice's terms are
free text, as they were. The lines are found in one pass, never by an
expression that backtracks.

**A Leitweg-ID is checked where scheme 0204 says it is one (Q3).** An
electronic address under 0204, in an invoice of either kind, is held to a
Leitweg-ID's shape and check digits after its term's rule
(`leitwegIdBreak`, `checkElectronicAddress`), refused as `is under 0204, a
Leitweg-ID, and ...`, naming no rule id, since none is anybody's
schematron's. The buyer's reference is held to nothing past BR-DE-15: a
business buyer's XRechnung carries an order number there. Its expression
is anchored at both ends and its repeats bounded, so a text of any length
is decided within its first 46 characters, the longest Leitweg-ID's: four
texts of 640,000 characters, the most a template's literal runs hold,
took under 0.1 ms each, measured on 21 October 2026 from the built
package on Node 24.21.0 and an Intel i9-10900K. The digits use the
modulo 97 the payment codes do (`payment-reference.ts`'s `mod97`).

**A sample and four controls are judged.** "Rechnung (XRechnung)",
`e-invoice-xrechnung`, the Factur-X sample's template made an XRechnung,
from the euro invoice's heating firm to an invented "Bundesamt für
Beispielwesen" in Bonn, for servicing its heating, its Leitweg-ID
`991-33333TEST-33` from KoSIT's test suite (Q11) and its other
identifiers the addressed sample's; its head prints the Leitweg-ID. The
gate judges its XML in KoSIT's XRechnung scenario and with Mustang, draws
no PDF of it, and refuses four controls made from it: without its buyer's
reference (BR-DE-15), without its seller's contact (BR-DE-2), without the
seller's electronic address (PEPPOL-EN16931-R020), and with a Skonto line
of a percentage without two decimals (BR-DE-18). A Leitweg-ID of wrong
check digits is no control: neither tool refuses one.

## Consequences

**What it buys.**
- **A German public buyer can be invoiced.** The XML an XRechnung writes
  is accepted by KoSIT's own XRechnung scenario and by Mustang's, and
  each control is refused by both for the one rule it breaks.
- **One invoice, one writer.** An XRechnung's XML is a Factur-X invoice's
  of the same terms but for BT-24, its totals the runtime's one
  computation, the page proved against it on the PDF as every sample's.
- **What XRechnung needs is refused where it is written**, by the rule
  that needs it, a literal in the editor and data at the render, before
  KoSIT would refuse the file; and the gate fails when KoSIT moves one of
  those rules.
- **A copy that says what it is.** A seller keeps a picture of an
  XRechnung that no person or software takes for the invoice.

**What it costs.**
- **0.2.0 refuses a report with an XRechnung** whole, as `unknown-kind`;
  and **the resolved document's `eInvoice` now names its kind**, so a
  0.3.0 renderer refuses a Factur-X file without one, made by hand or by
  another release's runtime, as a kind it does not know.
- **No Skonto in an XRechnung.** A `#`-led line, a well-formed one that
  KoSIT takes among them, is refused; a seller who grants a discount says
  it in words, which no buyer's system reads, until XRechnung 4.0.
- **CII alone.** A buyer who asks for UBL, and a Peppol access point that
  wants it, cannot be served.
- **XRechnung 3.0 alone, and its standard scenario.** 4.0 is not backward
  compatible; the extension and CVD scenarios, credit notes, allowances,
  charges and every term outside 0027's and 0037's are not written.
- **More needed than EN 16931 asks.** An XRechnung gives a business
  process, a buyer's reference, payment instructions, a contact of three
  terms and both electronic addresses, or is refused; a seller with no
  telephone number to give cannot issue one (0037's contact of all three).
- **A Leitweg-ID's form rests on what was not read.** The shape and the
  computation are FeRD's description and secondary sources', checked
  against KoSIT's test values alone; if the specification allows what
  this refuses -- a coarse address past 12 digits, a character outside
  letters and digits -- such an address is refused, and if a portal
  checks more, nothing here knows. KoSIT's own suite carries three
  Leitweg-IDs this refuses, of wrong check digits; a template that copied
  them would be refused.
- **A Leitweg-ID under 0204 is checked in a Factur-X invoice too.** One of
  wrong check digits, which 0037 took, is refused there now.
- **The copy is a final picture without its invoice.** It prints what the
  XML holds, proved on the sample's PDF, but carries no XML: a host that
  sends the PDF alone sends no invoice, and the label is all that says so.
- **The label is English, in the runtime's words and style**, as the
  preview's are, on every page of a German invoice; a template cannot word
  it or style it otherwise.
- **A CMYK logo an XRechnung holds** is refused at the final render once
  its e-invoice is made a Factur-X invoice, as one added before a report
  had an e-invoice is (0033).
- **The title rule is the Factur-X invoice's alone**, so a template whose
  title holds `&` is valid as an XRechnung and refused as a Factur-X
  invoice.
- **Every host carries the second kind.** `validateReport` reads it in
  every report and the runtime and the renderer know it, whether or not a
  host's reports are XRechnungen; not measured.
- **Mustang checks an XRechnung with fewer rules.** It fired 25 on the
  sample, CEN's and its copy of XRechnung's, against 179 of FeRD's on a
  Factur-X sample; KoSIT runs the schema, CEN's and XRechnung's.
- **The gate runs longer.** One sample and four controls add five Mustang
  runs and five files to KoSIT. Measured on one Windows 11 workstation
  (i9-10900K) on 21 October 2026, on Zulu 25.0.4.1 under Node 24.21.0:
  before this record the gate took 149.8 s, its downloads among them,
  Mustang 119.0 s over 31 runs; after it, from its cache, 125.2 s and
  123.0 s recording the run and 124.3 s against the record, Mustang
  110.5 s, 109.2 s and 109.8 s over 36 runs; and after review, against
  the record, 120.8 s, Mustang 104.8 s, as the run's own results file,
  `test-results/e-invoice.json`, which the repository does not keep, gave
  them. One run before and four after, beside other work: the difference
  is no measurement of this record's cost, and Mustang's five runs more
  did not show in it. CI's 20-minute timeout is still unmeasured against.
- **Strings and values copied from KoSIT's artefacts.** The guideline,
  the contexts and tests the oracle holds rules to, and the sample's
  Leitweg-ID are KoSIT's configuration's and test suite's, whose licences
  were not read; whether copying them is acceptable under
  [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)
  is the owner's question, as 0027 and 0037 left CEN's codes and KoSIT's
  expressions.
- **The marks.** The sample's title says "XRechnung", KoSIT's standard's
  name; whether a sample may, as 0027 left ZUGFeRD's, is the owner's to
  read.

**What it forecloses.** An XRechnung drawn as a hybrid, a second writer of
its XML, and a renderer that draws an e-invoice whose kind it does not
know.

## Alternatives considered

**ZUGFeRD's XRECHNUNG profile, a hybrid that embeds `xrechnung.xml` (Q1
b).** The federal portals take XRechnung as XML alone, and the hybrid's
file name and conformance level rest on a specification behind a
registration nobody here has made; it buys a buyer nothing the EN 16931
hybrid does not. And a PDF that carries an XRechnung would be the
invoice twice.

**`renderPdf` refusing a final XRechnung (Q1 a).** A host would show the
preview's label on a final invoice's picture, or no picture; the copy is
proved against the XML as the hybrid's page is, and says what it is.

**XRechnung as a profile of the Factur-X kind**, `profile: 'xrechnung'`.
It is no Factur-X profile: it has no conformance level, no relationship and
no file a PDF embeds, and needs terms Factur-X does not; one kind with two
shapes of file would be a switch on its profile wherever it is read.

**UBL beside CII, or instead (Q2).** A second writer of one invoice, as
0027 turned down; KoSIT's UBL scenarios would judge it at no download, when
a buyer asks.

**The Leitweg-ID checked in every XRechnung's buyer's reference (Q3).** A
business buyer's XRechnung carries its order number there, which BR-DE-15
takes; checked always, a valid invoice would be refused. **Not checked at
all.** An address of wrong check digits routes the invoice nowhere, and no
validator of the gate's sees it.

**Skonto written in XRechnung's syntax, a structured discount (Q4).** A
model of days and percentages written as `#SKONTO#` lines, which
XRechnung 4.0 replaces; written now, it would be read again in a year.
**BR-DE-18 read as KoSIT reads it**, taking a well-formed line: the line
would be free text the editor checks for a syntax nobody models, and a
template's own words could be read as a discount.

**The needs as required properties of the shape.** A missing one would be
`missing-property`, naming no rule; a refusal that names XRechnung's rule
says why an XRechnung needs it, which is what the gate holds.

**The held rules as refusals of their own.** BR-DE-16 is BR-S-02's
condition for this release's categories; a second message for one fault
would say it twice, and the rest are broken by nothing the format can say.

**The copy's label written by the renderer.** It would be a second place
that decides what a page prints; the runtime labels a preview, and labels
the copy the same way, and the renderer only refuses a copy without it.
**The label held by its text alone.** PDF.js finds the text in white or
at one point, so a copy that says nothing to a reader would pass; the
paragraph is compared whole with the one the runtime exports.

**A builder refusing a CMYK JPEG in every e-invoice**, as 0033 did. The
builder and the renderer would disagree on what an XRechnung holds, and
nothing would say so; a print shop's logo would be kept from a copy that
prints it.

**A Leitweg-ID of wrong check digits as a control.** Neither tool refuses
one, and a control no tool refuses is one the gate refuses.

**XRechnung 4.0 (Q12).** Preliminary, not for productive use, its bundle
expected in 2027 (secondary sources), and not backward compatible; it is
its own record.
