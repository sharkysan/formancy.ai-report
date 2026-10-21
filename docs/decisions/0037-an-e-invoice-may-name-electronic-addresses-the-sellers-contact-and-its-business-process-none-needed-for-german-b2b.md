# 0037 — An e-invoice may name the seller's and the buyer's electronic addresses, in five schemes of the CEF's list, the seller's contact and its business process, none of which a German B2B invoice needs: the contact's telephone number and email address held to XRechnung's own expressions, which the e-invoice gate holds to KoSIT's schematron, and a fourth sample and a control judged by both validators; the terms required now, the CEF's whole list, shapes of report-spec's own and a contact of any of its terms lost

- **Status:** accepted; extends [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
- **Date:** 2026-10-20
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/en16931.test.ts`: `ADDRESS_SCHEMES`
    pinned whole, every code of it taken and a code of the CEF's list
    nobody chose (`0060`), one in another case (`em`) and a word (`EMAIL`)
    refused by BR-CL-25; a telephone number of fewer than three ASCII
    digits refused by XRechnung's BR-DE-27, Arabic-Indic digits among
    them, and an email address of another shape by BR-DE-28, which takes
    an address that begins with a dot because its expression does; the
    business process, both addresses and the email address held to the
    token the XSD makes of them, and the contact's name kept whole; the
    table of terms by place (`E_INVOICE_TEXT_TERMS`) with the new places;
    and every rule id a refusal names either one of `EN16931_RULES` or one
    of `XRECHNUNG_RULES`, and every one of each said.
    `src/xrechnung.test.ts`: XRechnung's two expressions pinned as the
    schematron writes them and read as XPath reads them (`xpathRegExp`),
    `\s` as XPath's four characters and `.` as anything but a line feed or
    a carriage return; an escape the two languages read otherwise refused,
    and what JavaScript reads and XPath 2.0 refuses -- a group that begins
    `(?`, `\/`, a `[` inside a class; the telephone number's count of
    digits held to its expression on every text of five characters or
    fewer over eleven chosen to part them -- either end of `[0-9]` and its
    neighbours, the white space `normalize-space` and `\s` read, U+2028,
    Arabic-Indic and mathematical digits; the email address read after
    `normalize-space`; and the longest text a template's literal runs may
    hold, 640,000 characters, checked as a telephone number and as five
    email addresses that make the expression try every split, within
    2 s.
    `src/validate-e-invoice.test.ts`: none of the terms needed, each read
    back whole where it is given; an address's identifier and scheme and a
    contact's three terms each needed in it; a scheme outside the list
    refused, naming the term and BR-CL-25; a literal telephone number,
    email address or business process refused naming the term and the rule
    and never the text; an address or a contact written as a string
    refused unquoted; one read from data left to the render; and the
    buyer's contact (BG-9) refused as `unknown-property`.
  - **The editing core.** report-core's `src/diagnostics/parts.test.ts`
    finds every expression the e-invoice holds, the new texts among them,
    in the order the type holds them.
  - **The runtime.** report-runtime's `src/cii.test.ts`: the business
    process before the guideline, a party's contact after its legal
    organisation and its address after its postal address, at the paths
    the pinned XRechnung schematron reads them at, and with them taken out
    line by line the complete invoice the validators took, byte for byte.
    `src/e-invoice-terms.test.ts`: each written as the data gives it, each
    the data gives as nothing left out -- an address with its scheme, the
    contact whole where it has none of its three -- a contact it gives in
    part refused at each term it lacks, and a preview saying nothing of
    it; what the data gives held to the rule a literal is; and the
    longest telephone number data can give, 64 runs of which 63 read a
    string of the runtime's longest, held to BR-DE-27 within 5 s.
  - **The corpus.** report-corpus's `src/e-invoice-xml.test.ts` reads each
    new term with saxes at the path CEN's binding gives it, and each
    address's scheme as its `schemeID`. `src/starters/e-invoice.test.ts`
    holds the fourth sample, `e-invoice-addressed`: the template, apart
    only in its id, the header field its buyer's address is read from and
    the four terms; and its XML taking the path it is there for, as the
    other three take none of it.
  - **The renderer, on the PDF it produced.** report-render-pdf's
    `src/e-invoice-samples.test.ts` and `src/e-invoice.test.ts` hold the
    fourth sample as they hold the others: its PDF/A-3b embeds the
    runtime's XML byte for byte, and its page prints what the XML holds of
    the terms that test reads -- the firm, the buyer, the head, the lines,
    the totals, the terms of payment, the bank details and the codes --
    and nothing else ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    It reads none of this record's terms, and the sample's page prints
    none of them: they are in its XML alone.
  - **The e-invoice gate.** `scripts/e-invoice/oracle.mjs` holds
    `ADDRESS_SCHEMES` to BR-CL-25's list in CEN's schematron and to FeRD's
    code list 17 at both parties' electronic addresses; each id of
    `XRECHNUNG_RULES` to a rule of XRechnung's schematron, which it reads
    at the location KoSIT's `scenarios.xml` gives the scenario
    `EN16931 XRechnung (CII)` beside CEN's; and each of
    `XRECHNUNG_PATTERNS` to the string of the one variable its rule's test
    reads, that test, character for character, the pattern matched
    against `normalize-space` of the element the runtime writes the term
    as, with no flag, and the rule's context the seller's contact
    (`XRECHNUNG_SHAPES`; `oracle.test.mjs`, a test with a flag, without
    `normalize-space`, of another element, negated, at the buyer's
    contact, or reading two variables, each refused).
    `scripts/e-invoice/corpus.mjs` makes
    `control-br-cl-25.xml` from the fourth sample, its seller's scheme
    written `EMAIL` (`corpus.test.mjs`). On 20 October 2026, on Zulu
    25.0.4.1 under Node 24.21.0 on Windows, the gate passed and recorded
    the run: KoSIT 1.6.3 matched `e-invoice-addressed.xml` to
    `EN16931 (CII)` and accepted it with no message, Mustang 2.26.0 fired
    137 rules on it and on its PDF and failed none, and veraPDF 1.30.3
    found the PDF compliant; KoSIT refused the control with
    `error val-sch.1 BR-CL-25` alone, and Mustang with
    `error 4 FX-SCH-A-000582` alone. The three samples' XML and their
    PDFs' inflated digests were what the record held before. Run again
    without `--record`, it passed against what it had recorded; and again,
    with the oracle holding each rule's test and context, against the same
    record.
  - **The install gate.** `scripts/install-fixture/e-invoice.ts`, from the
    packed tarballs: the four terms written where they are given, the
    business process, both addresses, the buyer's under
    `ADDRESS_SCHEMES`' GLN, and the contact's name, number and address;
    and a contact's telephone number of no digit refused naming
    XRechnung's rule and not the text.
  - **Each watched failing, on 20 October 2026.** report-spec's new and
    changed cases failed, 47 of them, before the model, the rules and the
    reader were there; report-core's walk (1 case), the runtime's writer
    and terms (8), and the corpus's sample (3) each before its code; the
    corpus's reader test, 7 cases, with the runtime's `cii.ts` and
    `cii-parties.ts` put back to `main`'s and rebuilt; the gate's corpus
    and oracle tests before their code; and the oracle, run over the
    pinned schematrons with report-spec's lists changed in memory, named
    `EMAIL` in neither list, a rule `BR-DE-99` XRechnung lacks, and an
    email pattern other than KoSIT's. After review, on the same day: the
    longest-text case with the expression run as written, at a tenth of
    its length, 20.9 s against its bound of 2 s; the count held to the
    expression, with `9` left out of the digits and with a line feed
    taken to end a count, each naming the texts they part on; the new
    refusals of `xpathRegExp` before it made them; the runtime's contact
    given in part, which resolved, and its longest number at a sixteenth
    of its length with report-spec's check put back to the expression,
    21.4 s against 5 s; the oracle's test and context cases before it
    read either, and its two-variable case with the oracle taking any
    number of variables but none; the pinned XRechnung schematron with
    both tests' `normalize-space` dropped and a flag added, which the
    oracle had passed and now names; and the install gate, from the
    packed tarballs, with the runtime's contact left unwritten, naming
    the three terms missing, and with report-spec taking any telephone
    number, saying the report was valid.
  - **Not held by anything here.** That a receiver delivers to an
    address, or that the address is the party's; that an address's value
    is of its scheme's form -- a GLN's check digit, a Leitweg-ID's, an
    email address under `EM`; that the business process is one the buyer
    knows; that a contact's number reaches anybody. That KoSIT's
    XRechnung scenario raises no BR-DE-27 or BR-DE-28 warning on a file
    report-spec takes: no file the gate judges matches that scenario, so
    it rests on `xrechnung.test.ts` and the gate's holding of the
    expressions and the tests that read them, until XRechnung's own
    sample, the next record's, is judged there. That a page prints any of
    this record's terms, which no sample's does and nothing compares with
    one.

## Context

[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
gave an e-invoice the terms a German B2B invoice needs. XRechnung 3.0.2,
which a German public buyer asks for, needs more. Mustang 2.26.0's
XRechnung schematron raised seven notices on FeRD's own EN 16931 sample
(`scripts/e-invoice/recorded/research/EN16931_Einfach.report.xml`, 17
October 2026), and four of them are terms the model lacks: the business
process (PEPPOL-EN16931-R001, BT-23), the seller's and the buyer's
electronic addresses (-R020, -R010; BT-34, BT-49) and the seller's contact
(BR-DE-2; BG-6). The plan for 0.3.0 makes XRechnung a kind of its own next;
these are its required terms, and this record gives them to the format
first, for either kind.

What the pinned files say of them, read on 20 October 2026:
- **EN 16931 asks for none of them.** CEN's 1.3.16 schematron in KoSIT's
  configuration of 2026-08-31 asks only that an electronic address name
  its scheme (BR-62, BR-63), fatal, and that the scheme be of the CEF's
  Electronic Address Scheme list (BR-CL-25), 104 codes; FeRD's EN 16931
  schematron in Mustang 2.26.0 checks it against its code list 17, 102
  codes. Neither the UStG nor FeRD's EN 16931 profile asks for any of the
  four.
- **XRechnung asks for all of them** in its own scenario, which the
  samples do not match: BR-DE-2 the contact, BR-DE-5, -6 and -7 its
  contact point, telephone number and email address, PEPPOL-EN16931-R001,
  -R010 and -R020 the business process and the two addresses, each fatal.
  And it warns of a telephone number with fewer than three digits
  (BR-DE-27) and an email address of another shape (BR-DE-28), each by an
  XPath expression its schematron keeps in a variable,
  `XR-TELEPHONE-REGEX` and `XR-EMAIL-REGEX`.
- **The Factur-X EN 16931 XSD** in Mustang 2.26.0 orders a trade party
  `Name`, `SpecifiedLegalOrganization`, `DefinedTradeContact`,
  `PostalTradeAddress`, `URIUniversalCommunication`,
  `SpecifiedTaxRegistration`; a contact `PersonName`, `DepartmentName`,
  `TelephoneUniversalCommunication`, `EmailURIUniversalCommunication`; and
  the context `BusinessProcessSpecifiedDocumentContextParameter` before
  the guideline. It types an identifier (`udt:IDType`), the business
  process's and each `URIID` among them, as xs:token, and a name and a
  telephone number (`udt:TextType`) as xs:string.

## Decision

**An e-invoice may name four things more**, each optional, none needed
for a German B2B invoice, so that an invoice that names none is written
as before, byte for byte:
- `businessProcess` (BT-23), runs, a token;
- the seller's `electronicAddress` (BT-34, BT-34-1) and the buyer's
  (BT-49, BT-49-1), each an identifier, runs and a token, and its scheme,
  a code the template writes;
- the seller's `contact` (BG-6): its `name` (BT-41), written as the
  contact's `PersonName`, its `telephone` (BT-42) and its `email` (BT-43),
  a token. A contact gives all three, as XRechnung asks: one shape serves
  both kinds.

The buyer's contact (BG-9) is not written, and refused as
`unknown-property`, as every term this version does not write is.

**The schemes are a closed list**, `ADDRESS_SCHEMES`, chosen and narrower
than the CEF's, as 0027's lists are: `EM`, an email address; `0204`, the
Leitweg-ID a German public buyer is reached by; `0225`, France's
addressing scheme; `9930`, a German VAT identifier; `0088`, a GLN. A
scheme outside it is refused by BR-CL-25, where it is written. The gate
holds the list to BR-CL-25's in CEN's schematron and to FeRD's list 17 on
every run.

**A telephone number and an email address are held to XRechnung's shapes**
in every e-invoice, so that no file a template writes earns KoSIT's
warning once the same contact is written as an XRechnung: three ASCII
digits at least, and an address of no white space, one `@` with something
before it, and after it two names at least joined by single dots. Each is
the pinned schematron's own expression, kept as its string in
report-spec's `xrechnung.ts` (`XRECHNUNG_PATTERNS`) and read as XPath 2.0
reads it, after `normalize-space`, as the rule reads it. A refusal names
the rule as XRechnung's (`(XRechnung's BR-DE-28)`), from a list of its own,
`XRECHNUNG_RULES`, beside `EN16931_RULES`; the gate holds each id to a
rule of XRechnung's schematron, each string to the variable its rule
reads, and the rule's test and context to what report-spec reads. The
telephone number's expression, `.*([0-9].*){3,}.*`, is not run as written:
by V8's backtracking engine it takes time that grows with the square of a
text's length -- 20.9 s for 64,000 characters with two digits at the
middle, four times what 32,000 took, measured on 20 October 2026 from the
built package on Node 24.21.0 and an i9-10900K -- and a template may hold
640,000 characters in a text's literal runs, and over a million from data,
where the validator runs on every edit. What it asks of what
`normalize-space` leaves, which holds no line feed or carriage return, is
three of `[0-9]` anywhere, so the digits are counted; a test holds the
count to the expression on every short text.

An address's identifier is held to no shape: neither CEN nor the pinned
XRechnung rules ask one, and what a value under a scheme must be is the
scheme's, the Leitweg-ID's check digits among them, which waits for
XRechnung's own record.

**The runtime writes what the data gives.** Each new text is read as a
paragraph's in the report's scope and held to its rule, as 0027's are; one
the data gives as nothing is left out, an address with its scheme, and the
contact whole where it has none of its three. A contact the data gives in
part is refused by a final render, at each term it lacks, as the validator
refuses a literal one: written with what it has, it would be the contact
an XRechnung of the same template is refused for (BR-DE-5 to -7). A
preview, which lacks what it has no value for, says nothing of it. The CII
writes each at the path CEN's binding gives it, in the XSD's order.

**A fourth sample is judged.** `e-invoice-addressed`, the template with the
four terms, the firm's address by email (`EM`) and the buyer's GLN
(`0088`) read from a header field of its own, is drawn and judged as the
other three are, by Mustang, KoSIT and veraPDF; and `control-br-cl-25.xml`,
the first control made from a sample other than the first, refused by
KoSIT and Mustang. Its identifiers are the standard-setters' own
examples: a telephone number of the Bundesnetzagentur's "Drama Numbers"
for Köln, 0221 4710 000 to 999; email addresses under `.example`, which
RFC 2606 reserves; GS1 Germany's worked GLN, 4012345 00000 9; the name the
German identity card's specimen bears; and Peppol BIS Billing 3.0's
business process.

## Consequences

**What it buys.**
- **XRechnung's required terms in the format**, held by the rules that
  will hold them there, so that the next record makes them required for
  its kind and adds none.
- **A buyer that routes by address** -- an email inbox, a GLN, a VAT
  identifier or France's directory -- is named in the XML, under a scheme
  every pinned validator takes.
- **One reading of a contact's shapes.** What report-spec refuses is what
  KoSIT's expressions warn of: the email address's expression as KoSIT
  writes it, read as XPath reads it, and the telephone number's held to
  its count on every short text; the gate fails when KoSIT writes an
  expression, or the test that reads it, otherwise. That KoSIT itself
  takes the file is not judged yet (Verified by, Not held).

**What it costs.**
- **0.2.0 refuses a report that uses them**, whole, as
  `unknown-property`, so a report saved with one opens only in a release
  that has them: its reader, as tagged `v0.2.0`, takes no other key of the
  invoice, the seller or the buyer, read on 20 October 2026.
- **A contact of all three or none.** EN 16931 lets a contact be an email
  address alone; here it gives a name, a number and an address, or is left
  out, and a seller with no telephone number to give names no contact. A
  template that reads the three from data is refused by a final render
  where the data gives one or two of them.
- **The page need not print them.** 0027 writes the XML from the values
  the page prints. These terms are read from the template's expressions
  and the data as 0027's are, but nothing asks that a page print them:
  the fourth sample prints none, and no test compares them with a page.
- **One expression counted, not run.** The telephone number's check is a
  count of digits, which is what its expression asks of a text after
  `normalize-space`, and not the expression: what shows the two agree is
  that reasoning and the test over every text of five characters or fewer
  from eleven chosen to part them, not KoSIT.
- **XRechnung's shapes in a Factur-X invoice.** A number written in
  letters past two digits, an address with a space in a quoted local part
  or of a single name after its `@` is refused where no validator of the
  EN 16931 profile would refuse it. The words of BR-DE-28 forbid a dot at
  the start of an address and its expression does not; what is held is the
  expression.
- **Five schemes of the CEF's 104.** An address under D-U-N-S, Belgium's
  or Italy's numbers, or Peppol's other national schemes, is refused,
  though CEN takes it; the list is the owner's to widen.
- **No address checked against its scheme.** An email address under
  `0088`, or a GLN with a wrong check digit, passes every rule here.
- **A contact point is a person.** It is written as `PersonName`, never
  `DepartmentName`, which BT-41 may also be.
- **The gate reads one more schematron, and runs longer.** It now fails
  where KoSIT's configuration has no `EN16931 XRechnung (CII)` beside CEN's
  schematron. The fourth sample adds a Mustang run on its XML and on its
  PDF, a file to KoSIT and to veraPDF, and the control a Mustang run.
  Measured on one Windows 11 workstation (i9-10900K) on 20 October 2026,
  on Zulu 25.0.4.1 under Node 24.21.0: before this record the gate took
  107.8 s, its downloads among it, Mustang 82.7 s of it over 28 runs; after
  it, from its cache, 108.5 s, Mustang 94.2 s over 31 runs. The run that
  recorded it took 166.4 s, every tool slower, on the same machine the
  same evening: one run each, so the difference is no measurement of this
  record's cost alone.
- **Two strings copied from KoSIT's schematron.** `XRECHNUNG_PATTERNS`
  holds two expressions of the XRechnung configuration, whose licence was
  not read here; whether copying them is acceptable under
  [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)
  is the owner's question, as 0027 left CEN's codes.

**What it forecloses.** A second reading of a contact's shapes beside
XRechnung's, and an electronic address in a scheme nobody chose.

## Alternatives considered

**The terms required in every e-invoice**, as XRechnung requires them. A
German B2B invoice needs none of them, and neither the BMF nor FeRD's
EN 16931 profile asks for them: every B2B template would have to invent
an address and a contact to print. Required for XRechnung's kind, where
they are asked for.

**The CEF's whole list**, 104 codes. Every code would be one nobody chose,
written into a customer's XML, which 0027's closed lists refuse to do; the
list is widened code by code.

**Shapes of report-spec's own**, an RFC 5322 address or an E.164 number.
KoSIT warns by its own expressions, so a file both took would earn its
warning, or one KoSIT takes be refused here, and nobody would see the two
part.

**The shapes left to XRechnung's kind.** A contact written for a Factur-X
invoice would pass here and earn KoSIT's warning the day the same
template becomes an XRechnung: one term, two rules.

**The rules named in words alone, with no id.** A message that names no id
is one the gate cannot hold to the schematron, and a renamed rule would go
unseen.

**The expressions written as JavaScript by hand.** JavaScript's `\s` takes
more white space than XPath's and its `.` fewer characters, so a
hand-written copy reads otherwise at the edges; the string as KoSIT writes
it, read as XPath reads it, is the one the gate can compare. The telephone
number's count is the one check written by hand, held to that reading on
every short text, because the expression run as written takes minutes on
a text a template may hold.

**BR-DE-27's expression run as written, behind a bound on the number's
length.** A bound short enough to keep the expression quick would refuse
a text KoSIT takes, and a length is no rule of anybody's. **A regular
expression engine that runs in linear time**, such as RE2, is a
dependency of native code or WebAssembly in a package whose two
dependencies are plain JavaScript, to run one expression whose question is
a count.

**A contact of any of its terms.** More of what EN 16931 allows, but
XRechnung's kind would need its own rule for which a contact must give,
and a contact written for one kind would not be the other's.

**The fourth sample as a PDF variant.** KoSIT judges the XML corpus alone,
and a variant carries the first sample's e-invoice; the terms would be
judged by Mustang and veraPDF and not by KoSIT.

**The BR-CL-25 control made from the first sample**, an address added to
it. It would break the sample two ways, a term added and its scheme
wrong, where a control breaks one.
