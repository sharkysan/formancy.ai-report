# 0027 — A report carries at most one EN 16931 invoice, which the runtime writes as Factur-X 1.09.2 / ZUGFeRD 2.5.2 CII from the values its page prints: its totals computed once for both, EN 16931's rules one set of checks in report-spec, the XML judged by Mustang and KoSIT pinned in a gate, and every e-invoice refused by the renderer until it draws the PDF/A-3 that carries one

- **Status:** accepted; numbered before [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)
  and merged after it, so it extends that record, whose EPC QR code page
  now says what an e-invoice is; extended by
  [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
  the next step, which lifts the renderer's last refusal and draws the
  PDF/A-3b that embeds the XML, so that where this record says no PDF
  carries an e-invoice it describes the step before that one; and by
  [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md),
  under which the e-invoice samples print the firm's mark, the XML they
  write unchanged; and by
  [0037](0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md),
  under which an e-invoice may name the parties' electronic addresses,
  the seller's contact and its business process, none of them needed, and
  a fourth sample and a control judged by both validators; and by
  [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md),
  under which an e-invoice may be an XRechnung 3.0, which this record
  turned down for the German B2B invoice, its PDF a plain copy labelled
  so on every page: the plain PDF this record forecloses, narrowed for
  that kind alone; and amended by
  [0044](0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md),
  under which either builder edits an e-invoice field by field through
  report-core's commands, its account changed with its payment codes' in
  one edit, and the e-invoice sample is a starter of the Studio's, which
  this record kept out of its picker
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-e-invoice.test.ts` holds
    an e-invoice:
    - read back whole, and counted in the hash;
    - of a kind, a profile, a type and a currency this version writes, and
      no property it does not write, allowances and charges among them;
    - one run at least in every text it holds, read as a paragraph's in
      the report's scope, and a page number or count refused in every one;
    - a literal text, code or rate that breaks its rule refused as
      `invalid-e-invoice`, naming the business term and the rule and never
      the text, whether written as runs or as a string; a text read from
      data left to the render; an empty city named by the UStG's full
      address, an invoice number of two spaces by the token the XSD makes
      of it, and a BIC by the EPC QR code's rule;
    - the seller's identification, the buyer's where a category is
      reverse-charged, the time of supply, and a period that is one;
    - one VAT category at least and at most `MAX_VAT_CATEGORIES`, each of
      a code this version writes, at the rate its code allows -- a standard
      rate 0.5 or more (BR-CO-17) -- with a reason where it is exempt or
      reverse-charged and only there, and one breakdown each;
    - the lines the rows of the table over the detail dataset, printed by
      four of its columns, none of which, nor the table nor a container
      around it, may be hidden, each term read from a field of its type;
    - a QR-bill or an EPC QR code printed with it held to the e-invoice's
      account, and a QR-bill to its currency, shown or hidden, and either
      refused where the e-invoice names no account;
    - a title holding no `&`, `<` or `>`, and nothing XML 1.0 cannot write.

    `src/en16931.test.ts` holds the rules themselves: the constants an
    e-invoice is named by [S]; the names it gives its expressions, none of
    them a name every report binds; the types each line term is read from;
    each closed list pinned to its chosen codes, and a code that only
    looks like one -- `UK`, `Stk` -- refused; a VAT identifier's prefix;
    every text held to the characters XML 1.0 writes, an identifier or a
    code the XML writes as a token to no white space a token collapses, to
    its term's own rule, and the payment account and its BIC to the EPC QR
    code's; the street, post code and city to the UStG's full address and
    every other needed term to the CEN rule that needs it; a decimal of
    whole cents, never rounded, and a net price never negative; the
    categories' rates compared by value, a standard rate below 0.5 refused
    (BR-CO-17), and a second exempt or reverse-charged category by BR-E-01
    and BR-AE-01; the seller's and the buyer's identification,
    the time of supply, a period and a day on the calendar; and that
    `EN16931_RULES` is every rule id a function names and no other.
    `src/validate.test.ts` holds a case for `invalid-e-invoice`, and
    `src/hash.test.ts` and `src/walk.test.ts` an e-invoice each.
  - **The editing core.** report-core's `src/expressions/e-invoice.test.ts`:
    `invoice`, `vatBasis` and `vatAmount` typed member by member as the
    decimals they are, `invoice.paid` only where a paid amount is
    declared, nothing bound in a report that is no e-invoice, the names
    read wherever `totals` is, and refused in an aggregate's expression,
    in the e-invoice's own and in the columns that print a line; each date,
    the paid amount and each line term held to its type, `dec()` the hint
    for an integer paid amount. `src/diagnostics/e-invoice.test.ts` holds
    `e-invoice-total-unprinted`, a run behind a condition counted as
    printed, and `e-invoice-format-differs`: a total, or a line's net
    amount, printed at fewer than two places or in another currency than
    the e-invoice's, a net price in another currency, an item's name in
    another case. `src/commands/registry.test.ts` holds every command to
    keeping the very `eInvoice` object, and `src/commands/table.test.ts`
    the session to refusing a named column removed, hidden or given a
    literal. `src/diagnostics/parts.test.ts`, `members.test.ts` and
    `diagnose.test.ts` hold the sites, the scopes and the code.
  - **The runtime.** report-runtime's `src/e-invoice-totals.test.ts` holds
    each of EN 16931's formulas against an independent BigInt reading of
    its rules, at several rates and over many lines: VAT rounded once per
    category and never per line, a half away from zero on either side of
    it, a breakdown for each category a line is in in declared order, and
    the names bound to the very values the XML is written from.
    `src/e-invoice-lines.test.ts` holds the lines to the table's rows in
    its order, read once a row, the table printing the very value the XML
    holds, a table of no rows refused in a final render (BR-16), a net
    amount that is not its quantity times its net price rounded once to
    the cent refused, a line identifier an earlier line has refused, a
    quantity or a price its column prints at fewer places than it has
    refused, and what a preview totals, a text term of blanks among what it
    lacks. `src/e-invoice-terms.test.ts` holds every other term
    once its data has resolved it. `src/lower-e-invoice.test.ts` holds the
    file as report-spec names it, the same bytes for the same report and
    data, a preview that writes no XML, warns and labels every page, a
    QR-bill or an EPC QR code held to the amount due and the account, a
    final render that wrote no XML and recorded no reason thrown as a
    defect rather than handed on, and the hand-on of report-spec's
    `FACTUR_X` and `FACTUR_X_PROFILES`. `src/cii.test.ts` pins the XML byte
    for byte, as Mustang 2.26.0 and KoSIT 1.6.3 accepted it in a run by
    hand on 17 October 2026, which nothing repeats: the gate judges the
    corpus's samples, not that file. `src/xml.test.ts` holds its escaping
    and the characters it refuses.
  - **The renderer.** report-render-pdf's `src/refusals.test.ts`, "an
    e-invoice": every document with an e-invoice refused as `unsupported`,
    naming `eInvoice`, in the Node entry and the browser entry, pdfmake
    never called; each value it does not know refused first, in words of
    its own and never quoting the XML; and the same document without the
    e-invoice still drawn.
  - **The corpus.** report-corpus's `src/e-invoice-xml.test.ts` reads the
    runtime's XML with saxes, another parser, by namespace, and finds every
    term at the path CEN's binding gives it and no text at another.
    `src/starters/e-invoice.test.ts` holds the three samples: one template,
    the euro invoice's firm, account and BIC, the firm's address parted
    into its street, post code and city and lines of another shape
    refused, each line's identifier its position and never its article
    number; their XML against a BigInt computation of their data, line by
    line, category by category and total by total; and each table line,
    total row, head and bank detail the runtime resolved against the XML
    the same render wrote. That the
    euro invoice starter, whose parts the samples are put together from,
    is byte for byte what it was is `src/starters/euro-samples.test.ts`'s,
    by
    [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)'s
    digest. `src/testing/cii.test.ts` holds the reader, and
    `src/trial/undrawn.test.ts` both trial adapters to refusing a document
    with an e-invoice.
  - **The gate** (`scripts/e-invoice.mjs`, the `e-invoice` job in
    `gates.yml`). It fetches Mustang 2.26.0, KoSIT's validator 1.6.3 and
    its XRechnung configuration of 2026-08-31 from the URLs
    `docs/release/e-invoice-tools.json` registers, each refused unless its
    SHA-256 is the registered one; runs Mustang on each file and KoSIT once
    over all of them, with Java's HTTP and HTTPS proxies pointed at a dead
    port (a raw socket is not caught), on the Java the register names in
    CI; and fails on any file a tool judges otherwise than the corpus
    expects. The corpus is the three samples' XML, which both must accept
    in KoSIT's scenario `EN16931 (CII)`, and controls, each broken one
    named way -- on 17 October 2026 the schema, BR-CO-14, BR-CO-17, BR-27,
    BR-CL-23, and XML that is not well-formed -- which each tool must
    refuse with exactly the messages the corpus expects. A run fails too
    where the corpus recorded in `scripts/e-invoice/recorded/` is not the
    one it judged (`scripts/e-invoice/record.mjs`), so the judges' tests
    never read a corpus gone stale; a run recorded with `--record` holds no
    path of the machine it ran on, and KoSIT's console without its results
    table, which wraps each path across lines. A warning or a notice fails
    it unless `scripts/e-invoice/accepted.json` accepts it, with its
    reason, in that file, and an accepted entry no run raised fails it too.
    Every code of every list report-spec writes is held to the lists of
    both pinned schematrons, and every rule id `EN16931_RULES` names to a
    fatal rule there. Each module of `scripts/e-invoice/` has a test, the
    judges' over the run recorded in `scripts/e-invoice/recorded/`;
    `scripts/workflows.test.mjs` holds the job's order, its Java to the
    register's and `actions/setup-java` to a commit; and the release
    report reads its results (`collect.test.mjs`, `report.test.mjs`,
    `render.test.mjs`), holding each tool to the register by the SHA-256
    the gate measured of the bytes it ran and, for each JAR, by the version
    the tool reported of itself, and, in CI, the Java's major version to
    the register's; its vendor is held by `workflows.test.mjs` alone.
    It passed on 17 October 2026 on Zulu 25.0.4.1 and on Temurin 17.0.20.1,
    on Windows; it has not run in CI.
  - **The install gate** (`pnpm test:e2e:install`). Its Node consumer
    validates an e-invoice of its own from the packed packages, the corpus
    being never packed; refuses a seller's country outside the list by
    its rule without quoting it; resolves it in a final render to CII XML
    holding the totals computed by hand and the guideline report-spec
    names, with the page printing the XML's total; holds the runtime's
    `FACTUR_X` and `FACTUR_X_PROFILES` to report-spec's own; sees
    `renderPdf` refuse it as `unsupported`, naming `eInvoice`; and draws
    its preview, which carries no XML and is labelled on every page.
  - **Each rule reverted on its own, on 17 October 2026.** Each revert
    failed a test, or the test was written first and failed until the rule
    was there:
    - report-spec's, 50 of them, over the rules, the closed lists, the
      reader and the report around the block;
    - report-core's, 18, of which two survived: a test that named a field
      the sample's aggregate read as well, now met by one no aggregate
      reads, and the compiled paid amount kept rather than compiled twice,
      which changes no output and which no test of the output can see;
    - report-runtime's, 38, the tests of the terms, the payable check, the
      CII writer and the preview having been written after their code;
    - the renderer's, 7, its refusals each removed alone, the final one
      lifted and the call removed;
    - the samples', 16, of which one, a discount written as a negative
      price, never reached a test: the sample's own data refused it when
      the module loaded; and the CII reader's, 5;
    - the gate's, 35, of which one survived, a term a control edits once
      written twice, now met by a case of its own;
    - and once every part had landed, on the branch as a whole, 21 more,
      each failing its test: report-spec's account rule for BT-84, the
      title's three characters, a code added to a closed list, BR-27, the
      whole cents of BR-DEC-23 and rates compared by value; report-core's
      total with VAT left unheld and its names bound in a report that is
      no e-invoice; report-runtime's VAT rounded per line, and half to
      even, a preview that writes its XML or does not warn, a payment
      code's amount and account left uncompared, and `&` unescaped; the
      renderer's last refusal lifted, and its call removed; the gate's
      lists not held to CEN's schematron, and a warning taken unlisted;
      and, from the packed tarballs, the renderer's last refusal lifted
      and the runtime's XML not written, each failing the install gate's
      consumer. Every source in `packages/`, `scripts/` and `apps/` was
      byte-identical afterwards, by SHA-256.
    - and after three reviews of the branch, each rule they added reverted
      alone and its tests run, every one failing them: report-spec's 14 --
      BR-CO-17 and its bound, BR-E-01 and BR-AE-01, the UStG's address
      twice and its words, the token's check, its white space four ways and
      one of its terms, and the BIC -- report-runtime's 9, report-core's 9,
      and the gate's and the release report's 12. The runtime's, the
      core's, the samples' and the release report's new tests were seen
      failing before their rules were there; report-spec's were written
      first and seen failing by the reverts alone; the recording's failed
      on the first recording, and the stale corpus's the first run of the
      gate after the samples' XML changed.
    - and after the branch was rebased onto
      [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)'s
      `main` on 17 October 2026, the samples' module was rebuilt on its
      euro invoice, the firm, account and BIC read from
      `euro-invoice-countries.ts` and the words from
      `euro-invoice-words.ts`. The samples' reverts above were not run
      again on the rebuilt module; only the rule the rebuild added, the
      firm's address refused in another shape, was reverted, on 18
      October 2026, and seen failing its test.
  - **Not held by anything here.**
    - That the XML is the invoice a PDF carries, and that the PDF prints
      what it holds: no PDF carries one yet, so the page is held to the
      XML on the document the runtime resolved.
      [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)'s
      proof on the PDF waits for the step that draws one.
    - The values marked [S] below, which rest on a transcription of the
      specification, not on the specification.
    - A customer's template: only the samples go through Mustang and
      KoSIT, and the editing core sees that a total is printed, and with
      what format, not what is printed beside it.
    - That an invoice's content is right: a wrong rate, a wrong exemption
      reason or another seller's VAT identifier passes every rule.
    - That a receiver, an ERP or a platform accepts the file.

## Context

Germany's businesses must be able to receive e-invoices since 1 January
2025. From 1 January 2027 a seller whose turnover was above EUR 800,000 in
the year before must issue them to German businesses, and from 1 January
2028 every seller must (§ 27 Abs. 38 UStG; the BMF's FAQ of March 2026),
where both are established in Germany, and but for an invoice of 250 euro
or less, a ticket and a small business's invoice, which may always be
another kind (UStAE 14.1 Abs. 6 Sätze 3 and 4, in the BMF's letter of 15
October 2025, Rn. 22).
The BMF names "the hybrid format ZUGFeRD from version 2.0.1 -- except the
profiles MINIMUM and BASIC-WL" among the formats that count (letter of 15
October 2025, GZ III C 2 - S 7287-a/00019/007/243, UStAE 14.1 Abs. 14), and
FeRD recommends the EN 16931 profile. A report printed what an invoice
says, and nothing an ERP reads.

What the BMF says of the hybrid's two parts decides the shape. In a hybrid
format the structured data are the leading part, and prevail where the
picture differs (UStAE 14.4 Abs. 3). A picture that shows other invoice
details -- "eine andere Leistungsbeschreibung", another VAT amount -- may be
a further invoice, to be examined under § 14c UStG, and input VAT may be
deducted from the structured part alone (UStAE 14c.1 Abs. 4a). The same
paragraph does not object to technically caused small deviations, a
description shortened for the page or a difference of rounding among
them, while the picture stays a copy of the same content. Every detail
§ 14 Abs. 4 asks for must be in the structured part (Rn. 35). So a page
that says another thing than its XML may be a second invoice, and one
computation for both keeps the question from arising.

The documents, read on 17 October 2026:
- **ZUGFeRD 2.5.2 and Factur-X 1.09.2**, one joint specification published
  on 4 August 2026, in force from 1 September 2026, CII D22B and "fully
  backward compatible with D16B" (FeRD's and FNFE-MPE's pages and press
  releases). The next release is expected in autumn 2026.
- **The specification itself was not read**, nor FeRD's own XSD and
  schematron, which come with it: the release's XSD and schematron run
  here are Mustang 2.26.0's copies (`schema/ZF_250`, `xslt/ZF_250`), so
  that "1.09.2 / 2.5.2" rests on Mustang's copy of them. FeRD gives the
  specification for a name and an email address, and FNFE-MPE for an
  email address; the registration has not been made. What it says of the
  PDF -- the relationship each
  country expects, the XMP extension's namespace, prefix and values, which
  PDF/A levels it allows -- is read from phax/kaltblut's section-by-section
  transcription of Factur-X 1.09 and 1.09.2, marked [S] wherever it is
  used. The profile's identifier, `urn:cen.eu:en16931:2017`, is the
  Factur-X 1.09.2 schematron's code list, read in akretion's copy.
- **CEN/TC 434's validation artefacts for CII**, release 1.3.17 of 12
  October 2026 (EUPL-1.2): the rules of EN 16931, each fatal, and its code
  lists. The validators pinned here carry release 1.3.16: Mustang
  2.26.0's FeRD schematron, and KoSIT's XRechnung configuration of
  2026-08-31.
- **The BMF's letter of 15 October 2025 and its FAQ**, and § 14 and § 27 of
  the UStG on gesetze-im-internet.de.

The forces:
- **One computation.** The invoice starter's VAT is a footer cell,
  `round(totals.subtotal * dec("0.081"), 2)`, and its total a second
  aggregate. They agree because its subtotal is whole centimes. An XML
  written beside them would be a third computation, and nobody would see
  where the three parted.
- **The rules decide the file.** CEN's rules and code lists are fatal: a
  code outside its list, a line without a unit, a negative net price makes
  a file every validator refuses. A render called final must not write one.
- **Exact values.** Amounts and rates travel as strings, and never through
  a JavaScript number (formancy.ai-data 0008, and [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
- **Personal data.** An invoice holds names, addresses, accounts and VAT
  identifiers, and a refusal never quotes one.
- **The size of the work.** #25, the QR-bill, changed 131 files (`git show
  --stat 5495089`). An e-invoice touches the same four layers, and adds a
  PDF/A-3 mode, a reader for its attachments and a gate of Java tools.

## Decision

**It lands in two steps, each failing closed.** This record decides the
model, the rules, the totals, the XML and the gate over the XML. The next
step draws the PDF/A-3b that embeds the XML, and extends this record; until
it lands, the renderer refuses every e-invoice, so that no e-invoice is
ever drawn without its XML.

**The format has `eInvoice`**, at the report's level and in no region, as
a payment part is
([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)):
one invoice per PDF.
- **What it is.** Of kind `facturX`, profile `en16931`, type `380`, currency
  `EUR`, each refused as a value this version does not write when it is
  another. Its VAT categories are standard rated (S), exempt (E) and
  reverse-charged (AE); a category is an id an expression reads, a code, a
  rate and, for E and AE, the reason. It has no allowances and no charges,
  at the document or the line, and refuses them as `unknown-property`.
- **What it holds.** The invoice number (BT-1); the seller (BT-27, BT-31,
  BT-32, BT-30 with its scheme, and the address) and the buyer (BT-44,
  BT-48, BT-47 with its scheme, and the address), a buyer having no BT-32;
  the buyer's reference (BT-10); the payment instructions (BT-81 `58` or
  `30`, the account BT-84, BT-86, BT-85, BT-83); and the payment terms
  (BT-20), where a Skonto is written. Each is runs, one at least, read as a
  paragraph's in the report's scope; an optional one absent is a term the
  XML leaves out, never an empty list of runs. No text holds a page number
  or count (`misplaced-page-counter`), since the XML is written before there
  are pages. The issue date (BT-2), the delivery date (BT-72), the period
  (BT-73, BT-74), the due date (BT-9) and the paid amount (BT-113) are
  expressions.
- **The lines are the table's.** `lines` names the table over the detail
  dataset and the four of its columns that print each line's item name
  (BT-153), quantity (BT-129), net price (BT-146) and net amount (BT-131):
  what each column prints, once per row, is what the line holds. The line's
  identifier (BT-126), its unit (BT-130) and its category are codes a page
  need not print, each a `RowValue` read from the row. No named column, nor
  the table, nor a container around it, may be hidden, two terms may not
  name one column, and a column must bind a detail field or an expression
  of its term's type.
- **A draft-format addition.** `reportSpecVersion` stays `'0'`. 0.1.0
  refuses a report with an e-invoice whole, as `unknown-property`: measured
  on 17 October 2026 on report-spec as tagged `v0.1.0`.

**The codes come from closed lists**, each chosen, narrower than CEN's,
and held to CEN's 1.3.17 and the pinned 1.3.16 lists on 17 October 2026:
`UNIT_CODES`, the units of UN/ECE Recommendation 20 a German invoice
counts, times, weighs and measures in (BR-CL-23); `COUNTRY_CODES`, the EU's
members, Iceland, Liechtenstein, Norway, Switzerland and the United Kingdom
(BR-CL-14); `VAT_PREFIXES`, those and `EL` (BR-CO-09); and `SCHEME_IDS`,
SIREN, SIRET, D-U-N-S and GLN (BR-CL-11). A rate is a percentage from 0 to
below 100 with two decimals at most, compared by value: `19` and `19.00`
are one rate. A standard rate is 0.5 or more: BR-CO-17 rounds the rate
before it reads the tax, XPath's round(0.4) is 0, and a breakdown whose
rate rounds to 0 must hold a tax that rounds to 0, which a standard rated
one's does not past a small basis; a review found both pinned validators
refusing 0.4 on 17 October 2026, and a control of the gate now does.

**EN 16931's rules are one set of checks, in report-spec** (`en16931.ts`),
as functions over text, each answering the value the XML is written with or
the rule broken, named by its business term and its business rule and never
by the value, as 0022 decided for SIX's. The validator applies them to a
literal, as `invalid-e-invoice`; the runtime applies the same functions to
what the data resolves each text to. What a refusal calls each term, and
which rule needs it, is one table for both (`E_INVOICE_TEXTS`,
`E_INVOICE_DECIMALS`, `E_INVOICE_DATES`, `E_INVOICE_TEXT_TERMS`, and each
line term's own). The rules follow CEN's 1.3.17; `EN16931_RULES` is every
id they name, and the gate holds each to a fatal rule of the pinned 1.3.16.
- **The payment account (BT-84) is the EPC QR code's account rule**
  (`checkEpcIban`,
  [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)):
  an IBAN of a country of SEPA, of that country's length, its check digits
  right, and no QR-IBAN, for code 58 and 30 alike; and its BIC (BT-86) is
  the EPC QR code's BIC rule (`checkEpcBic`). An invoice that prints an EPC
  QR code beside it names one account and one bank, each held by one rule.
- **What the law asks past CEN.** The seller's and the buyer's street, post
  code and city are needed by § 14 Abs. 4 Satz 1 Nr. 1 UStG, "die
  vollständige Anschrift" (`FULL_ADDRESS`), and a refusal names that
  section: CEN's BR-08 and BR-10 need only the postal address, and BR-09
  and BR-11 its country.
- **An identifier is a token.** The XSD types an identifier and a code as
  xs:token, which a schema-aware reader collapses: the invoice number, the
  registration identifiers, the post codes, the BIC and a line's
  identifier hold no tab, no line break, no two spaces in a row and no
  space at either end. An invoice number with two spaces was accepted by
  both validators on 17 October 2026, and such a reader reads them as
  one.
- **A net amount and a paid amount are whole numbers of cents** (BR-DEC-23,
  BR-DEC-16): `10.500` is written `10.50`, and `10.505` is refused, never
  rounded. A net price is never negative (BR-27), so a discount is a line
  of negative quantity at a positive price.
- **The time of supply is the UStG's.** A German invoice says when it was
  supplied, by a delivery date, a period or both (§ 14 Abs. 4 Satz 1 Nr.
  6 UStG), which no rule of CEN's asks.
- **The title** of a report with an e-invoice holds no `&`, `<` or `>`, and
  nothing XML 1.0 cannot write: pdfkit 0.19.1 writes a title into a PDF/A's
  XMP unescaped, and the next step draws one. The title is the template's
  own string, never data; the page may print the three characters.
- **A payment code printed with it** -- a QR-bill, an EPC QR code -- asks
  to be paid to the account the e-invoice names, a QR-bill in its currency,
  and is refused where the e-invoice names none.

**The page reads the totals by name.** In a report with an e-invoice, and
in no other, every place that reads `totals` also reads three names
(`E_INVOICE_NAMES`): `invoice.lineTotal` (BT-106), `taxBasisTotal`
(BT-109), `taxTotal` (BT-110), `grandTotal` (BT-112), `duePayable` (BT-115)
and, where a paid amount is declared, `paid` (BT-113); and `vatBasis.<id>`
and `vatAmount.<id>` (BT-116, BT-117) for each declared category, null when
no line is in it, which prints as nothing. The editing core binds them
member by member
([0009](0009-an-expression-is-checked-and-bound-member-by-member.md)), and
refuses a read of them where they are computed from -- an aggregate's
expression, the e-invoice's own, the columns that print a line -- and in
any other report, as `expression-unknown-name`. `EXPRESSION_NAMES` is
unchanged: these are a list of their own
([0007](0007-a-report-definition-is-its-own-versioned-document.md)'s
addition).

**A total the XML holds is printed.** report-core's
`e-invoice-total-unprinted`, an error, refuses a report whose texts and
tables print none of the total without VAT (`taxBasisTotal`, or
`lineTotal`, equal to it here), the VAT, the total with VAT, or each
declared category's basis and amount; and, where a paid amount is
declared, the paid amount and the amount due. It is static: a run behind a
condition counts as printing what it reads. And `e-invoice-format-differs`,
an error, refuses a format that prints what the XML holds otherwise: a run
that reads a total, or the column of a line's net amount, at fewer than two
places or in another currency than the e-invoice's, named as a code; the
column of a net price in another currency; the column of an item's name in
upper or lower case. A review found each of them valid, undiagnosed and
resolved on 17 October 2026, the page printing 872 € where the XML held
871.63.

**The runtime computes the totals once** (`e-invoice-totals.ts`), in
`Decimal`, after the table's columns and before anything that reads them
([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)):
- each line's net amount, as its column prints it, held to its quantity
  times its net price, rounded once to the cent, half away from zero, as
  EN 16931 defines it -- this version writes no line allowance, charge or
  base quantity -- and as XRechnung 3.0.2 gives it (PEPPOL-EN16931-R120,
  which it says CII cannot test yet): no rule of CEN's tests it, Mustang
  recomputes it, and a review found it warning of 3 × 0.33 written as
  1.00 on 17 October 2026;
- each line's identifier its own: BT-126 is "Eindeutige Bezeichnung für
  die betreffende Rechnungsposition", and the later of two is refused;
- a quantity and a net price printed at the places they have: one whose
  column's format shows fewer, by value, is refused, row by row;
- BT-106, the sum of the lines, and BT-109 equal to it;
- for each category a line is in, BT-116, the sum of its lines, and BT-117,
  BT-116 times the rate over 100, rounded once to two places, half away from
  zero: per category, never per line;
- BT-110, the sum of the categories' VAT; BT-112, BT-109 and BT-110; BT-115,
  BT-112 less BT-113.

The page and the XML read the very values: the table prints the value kept
for the XML, and the names are bound to the totals the XML is written from.

**The runtime writes the XML** (`xml.ts`, `cii.ts`, `cii-parties.ts`), as it
writes a QR-bill's payload, and hands the document `eInvoice`: `{ xml,
fileName, relationship, conformanceLevel }`, the last three report-spec's
`FACTUR_X` and `FACTUR_X_PROFILES` [S].
- `rsm:CrossIndustryInvoice` with its declaration and no byte order mark,
  a line feed after each line and two spaces a level, each element in the
  profile XSD's order at the path CEN's binding gives its term, elements D16B
  shares with D22B alone, amounts at two places from their own digits,
  dates as format 102, and only `TaxTotalAmount` naming its currency.
- Text escapes `&`, `<` and `>`, an attribute the double quote too, and a
  tab, a line feed and a carriage return in an attribute, and a carriage
  return in text, as references, so that a parser gives them back; and an
  element the XSD types as a token holds no white space a token
  collapses, so that a schema-aware reader gives it back too. A character
  XML 1.0 cannot hold is refused where it is read, never dropped.
- A breakdown for each category a line is in, in declared order; the lines
  in the table's order; no clock. The same report and data are the same
  bytes.
- A delivery the XSD requires once is written empty where the invoice gives
  a period and no delivery date.

**A payment code asks for what the XML says.** A QR-bill or an EPC QR code
printed with an e-invoice asks for the amount due (BT-115), or leaves the
amount to the payer, and is paid to BT-84, compared by value once both have
resolved (`e-invoice-payable.ts`), as `invalid-e-invoice` on the code.

**A preview is not the invoice.** It prints the totals of what it has, holds
what the data gives to the rules, and writes no XML; it warns
`e-invoice-preview`, so that every page carries a label:
`E_INVOICE_PREVIEW_LABEL`, "Preview: not an e-invoice, and not a final
report", where nothing else is lacking, and `PREVIEW_LABEL` where data is.
A final render writes the XML or refuses; one that wrote none and recorded
no reason throws, as a defect, rather than hand on a document a renderer
would draw as a plain PDF.

**The renderer refuses every e-invoice** (`e-invoice.ts`, called by
`checkDocument`, in both entries, before pdfmake sees the document), as
`unsupported`, naming `eInvoice`: "an e-invoice is drawn as PDF/A-3, which
this release does not do". First it refuses what it does not know -- a file
that is not one, XML that is not text, a file name, a conformance level or
a relationship that is not report-spec's -- in words of its own, so that
those refusals stay when the next step lifts the last.
([0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)'s
addition.)

**The samples.** The corpus's `E_INVOICE_SAMPLES` are the euro invoice's
heating firm invoicing German businesses, "Rechnung (ZUGFeRD)", not Studio
starters, as 0024 made the invoice's other languages samples: the sample,
at 19 % and 7 % with a delivery date and SEPA (58); reverse charge (AE)
with the buyer's VAT identifier, a period and a credit transfer (30); and
an exempt line beside standard-rated ones, a discount line and a paid
amount. The payment means is a code of the definition, so the
reverse-charge sample's report is the sample's with `30` and an id of its
own. Its EPC QR code asks for `invoice.duePayable`.

**The gate judges the XML.** A job of its own, `e-invoice`, runs Mustang
and KoSIT on the samples' XML and the controls, with Java's HTTP and
HTTPS proxies pointed at a dead port (a raw socket is not caught), the
tools pinned by URL, version and SHA-256 in
`docs/release/e-invoice-tools.json` and fetched into a gitignored cache,
as formancy.ai-health's validator gate does; in CI on the Java the
register names, whose major version the release report holds, and on a
machine on the Java it has, which the report shows. A
tool's verdict is judged from what it reports, not from its exit code
alone. The tools run in CI and no package carries them.

## Consequences

**What it buys.**
- **One invoice.** The page prints the totals the XML holds, from one
  computation, at their places and in their currency, and the lines the
  table printed, from one evaluation of each row; a payment code asks for
  the amount the XML says is due, to the account it names. Two
  computations could part by a cent, which the BMF does not object to as a
  difference of rounding; a picture with another VAT amount may be a
  further invoice under § 14c UStG, and one computation keeps either from
  arising.
- **One reading of EN 16931.** What the editor refuses in a literal and what
  the runtime refuses in data are one function, named by one table, and
  the account an e-invoice and an EPC QR code name is held by one rule.
- **A final render writes no file its rules refuse.** One whose data
  breaks a rule `en16931.ts` holds is refused before anything is drawn,
  naming the term and the rule and never the value.
- **A second opinion.** Mustang and KoSIT's validator judge the samples'
  XML on every pull request, and the controls show that each sees what it
  must.
- **Fail closed between the steps.** A preview prints, labelled; a final
  render is refused by the renderer rather than drawn without its XML.

**What it costs.**
- **0.1.0 refuses a report with an e-invoice**, whole, as
  `unknown-property` ([0004](0004-three-version-lines-each-refused-when-unknown.md)).
- **No e-invoice can be printed by this release.** A final render resolves
  and writes the XML, and the renderer refuses the document. The XML is in
  the resolved document, `document.eInvoice.xml`, and nothing here embeds
  it.
- **EN 16931, type 380, euro, and S, E and AE alone.** No credit note, no
  other currency -- no franc from a Swiss seller -- and no Z, K, G, O, L, M
  or B: a German supply at 0 % that EN 16931 codes Z cannot be invoiced, and
  no intra-EU supply. No BASIC, EXTENDED, XRECHNUNG or Leitweg-ID, so no
  German public buyer, and no structured Skonto.
- **No allowances and no charges.** Freight and a discount are lines: a
  discount a line of negative quantity at a positive price.
- **The table prints all four terms.** An invoice that shows no unit price
  cannot be an e-invoice, and no named column may be hidden by a condition,
  nor the table, nor what holds it.
- **Narrower lists than CEN's.** Units, countries, VAT prefixes and schemes
  are the codes someone chose, from lists CEN keeps far longer: a code
  outside the lists here, a packaging unit among them, is refused though
  CEN would take it, and a seller or a buyer outside Europe cannot be
  named. `EL` is taken as a VAT prefix while the pinned 1.3.16 takes it,
  which CEN's 1.3.17 does not, though its message still allows it; the
  gate fails on a release that refuses it.
- **Rule ids are 1.3.17's, checked by 1.3.16's tools.** Where the two differ
  -- `EL` -- the pinned oracle decides, and a rule renamed in a later
  release, as BR-CO-27 became CII-SR-470 in 2.5.2, fails the gate until the
  ids are read again.
- **The payment account is SEPA's.** BT-84 is held to the EPC QR code's
  rule for code 30 as for 58, so a credit transfer to an account outside
  SEPA is refused. To share it, the EPC QR code's refusal of a QR-IBAN now
  says "a SEPA credit transfer in euro carries none".
- **A title without `&`, `<` and `>`.** "Müller & Söhne" can be printed on
  the page, never in an e-invoice report's title.
- **Every total is printed, and that is all that is checked.**
  `e-invoice-total-unprinted` sees that a run reads a total, not what it
  computes from it, nor whether its condition holds, and it holds every
  declared category, since which ones the lines use is known only at
  render. A condition, a style rule, a QR code and a payment code's amount
  print nothing.
- **The totals are not read where they are computed from.** The
  e-invoice's own texts cannot quote the amount due: a remittance that
  names it is refused.
- **A date term is a text to the editor.** `header.customer` passes where a
  date is asked for, as a date field is read as its ISO string; the render
  refuses what is no day on the calendar.
- **VAT is per category.** An ERP that rounds each line's VAT may differ
  from what this writes by up to half a cent a line; CEN tests BR-CO-17 and
  BR-S-09 within one unit of the currency either way, a euro, and the
  exact product rounded once lies inside it.
- **A line multiplies.** A net amount that is not its quantity times its
  net price, rounded once to the cent, is refused, a preview's too: a
  price per hundred, a line discount or charge, and an amount an ERP
  rounded otherwise cannot be written. The gate has no control for it:
  Mustang reports it as a warning on a file it calls valid, and KoSIT
  accepts it, so neither refuses it as a control must be refused.
- **Printed as the XML holds it.** A total and a line's net amount are
  printed at two places or more, in euro named as a code; a net price in
  euro too; an item's name in the case the data gives it; a quantity and a
  net price at every place the data gives them. A page that rounds to
  whole euros, or prints names in capitals by a format, is no e-invoice.
- **Identifiers without stray white space.** An invoice number, a
  registration identifier, a post code, a BIC or a line's identifier that
  data padded with blanks, or wrote with two spaces, is refused, not
  trimmed: a token's reader and the page would read two values.
- **Each line its identifier.** A line identifier an earlier line has is
  refused: a template that writes the article number as BT-126, as the
  samples first did, is refused at the second line of one article. The
  samples' is now the line's position.
- **A full address.** The seller's and the buyer's street, post code and
  city are needed, as the UStG asks, though EN 16931 needs the country
  alone: an address in a country without post codes cannot be written.
- **No due date or terms is asked.** CEN's 1.3.15 refused a positive amount
  due with neither a due date (BT-9) nor payment terms (BT-20) (BR-CO-25,
  fatal, in its `schematron/abstract/EN16931-CII-model.sch`), and FeRD's
  EXTENDED schematron in Mustang 2.26.0 still does; 1.3.16, 1.3.17 and the
  EN 16931 profile the pinned validators run do not, and neither does
  this, so a receiver still on 1.3.15 refuses such a file.
- **A QR-bill with an e-invoice is in euro**, so one paid to a QR-IBAN
  with a QR reference, which SIX keeps for francs, cannot be printed with
  one.
- **An empty delivery element.** An invoice with a period and no delivery
  date writes `ram:ApplicableHeaderTradeDelivery` empty, which the XSD
  requires; Mustang's FeRD schematron warns of it (PEPPOL-EN16931-R008), and
  the gate accepts that warning in the reverse-charge sample alone, saying
  why. A receiver running Mustang sees the warning.
- **What is not checked.** That a payment code's BIC is the e-invoice's,
  or that a BIC belongs to the account's bank; a VAT identifier past its
  prefix, or that its country issued it; that a rate is one a country
  applies, or the right one for a line; that an exemption reason says what
  the law says; France's rules (BR-FR) and XRechnung's. Northern Ireland's
  `XI`, a country and a VAT prefix in CEN's lists, is in neither of
  these: the lists are the owner's to widen.
- **The [S] values.** The relationship `Alternative`, the conformance level
  `EN 16931` and the XMP's namespace, prefix, document type and version
  rest on a transcription of the specification, and the release's XSD and
  schematron on Mustang 2.26.0's copies of FeRD's. Nothing embeds the
  values yet, and nothing here can tell them, or the copies, from the
  specification's own until the owner registers, downloads ZUGFeRD 2.5.2
  and records its hashes and its XMP extension example.
- **Germany only.** France is not claimed: which profiles AFNOR's XP Z12-012
  accepts, how its four details map and whether a platform takes the file
  were not read, and the buyer's SIREN is the only one of them the XML
  holds.
- **Every host carries the e-invoice.** `validateReport` reads an
  e-invoice in every report, and the runtime imports its writer
  statically, so a builder host or the Studio bundles the rules and the
  writer whether or not its reports have one. Measured on 17 October 2026
  with esbuild 0.28.2 (`--bundle --minify --format=esm --platform=neutral`,
  every `@formancy/*` package external, from each package's
  `src/index.ts`, gzip -9), against c212358: report-spec 56,157 to 78,125
  bytes (18,683 to 25,568 gzipped), report-core 40,347 to 47,985 (13,660
  to 16,123), report-runtime 49,428 to 67,982 (17,168 to 23,317); what a
  report without one resolves and renders to is unchanged.
- **The XML has no bound of its own.** It is written before a page is
  counted, so `MAX_DETAIL_ROWS` bounds it: 100,000 lines of short names
  wrote 117,280,919 bytes, 1,173 a line, and `resolveReport` took a median
  of 5.4 s against 2.0 s without the e-invoice; 10,000 lines wrote
  11,710,910 bytes in a median of 0.44 s against 0.23 s. Measured on 17
  October 2026 from the built package, five runs each, Node 24.21.0, an
  Intel i9-10900K. A bound of its own is the owner's to choose.
- **A renderer that predates `eInvoice`**, 0.1.0's among them, reads only
  the keys it knows and would draw a resolved e-invoice as a plain PDF. The
  packages pin each other exactly, so that takes two runtimes in one
  install.
- **A gate of Java tools.** The `e-invoice` job needs a Java 11 or later --
  Temurin 17 in CI -- and about 70 MB of downloads, cached on the register
  in CI and never in a release. On a Windows 11 workstation (i9-10900K) on
  17 October 2026 it took 44 s on Zulu 25.0.4.1 with its downloads, 28 to
  30 s from its cache, and 37 to 40 s on Temurin 17.0.20.1, and its job
  installs and builds the workspace first, which took 34 s uncached. Its
  20-minute timeout is a guess until CI's first runs are timed, and its
  exit codes on Linux are not measured. KoSIT crashed on Java 17 unless its stdin was an
  empty pipe, and lost its configuration on a relative path; Mustang wrote
  German in the console's code page unless told otherwise; the gate starts
  both so.
- **What the tools carry.** Each download holds works under their own
  licences, which nobody here reviewed one by one: Saxon in both JARs,
  veraPDF, under the GPL or the MPL, in Mustang's, and CEN/TC 434's EUPL-1.2
  schematron in Mustang's and in the configuration. They run in CI, and no
  package carries them, so
  [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md),
  which governs what a package ships, does not reach them. The recorded
  KoSIT and Mustang reports the judges' tests read quote CEN's rule texts,
  and the recorded run of FeRD's sample XRechnung's.
- **The codes are copied from an EUPL-1.2 artefact.** The closed lists hold
  codes found in CEN's lists; whether copying them, and committing the
  recorded reports, is acceptable under 0006 is the owner's question.
- **The marks.** AWV e.V. holds the word marks ZUGFeRD and Factur-X. The
  samples' title says "ZUGFeRD", the code says Factur-X, and neither
  mark's logo is printed; the logo's conditions, the DIN statement on
  EN 16931, FNFE-MPE's terms and FeRD members' essential patents are the
  owner's to read.
- **The samples' law was read once.** That firewood is at 7 %, heating
  installed for a builder reverse-charged, and instalment interest agreed
  apart exempt was read in the UStG on gesetze-im-internet.de on 17
  October 2026 and no further: the UStAE was not read, and the samples do
  not claim that a given case is so.

**What it forecloses.** A second computation of an e-invoice's totals, in a
template, a builder or a server; XML written anywhere but the runtime; and a
plain PDF of a report that is an e-invoice.

**Added 2026-10-18: the PDF/A-3b.**
[0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)
is the next step this record names. The renderer's last refusal is lifted:
a final render of an e-invoice is drawn as a PDF/A-3b that embeds the XML
as `factur-x.xml` and states it in its XMP, and the refusals of what the
renderer does not know stay, as this record meant them to. So what this
record says of the step between -- no e-invoice printed, the renderer
refusing every one, the page held to its XML on the resolved document
alone, nothing embedding the [S] values, a gate of about 70 MB of
downloads that judges XML alone -- describes this record's step, and 0031
says what holds now: the page held to the XML its PDF embeds, veraPDF and
Mustang judging the PDF, and the gate's downloads measured again. The
costs written above stand as they were written, and this record's
register keeps those of them a release with 0031 still meets.

## Alternatives considered

**XRechnung alone.** Pure XML for German public buyers, BT-10 mandatory,
and no page. The page is what Formancy Report makes, and a B2B invoice
needs none of XRechnung's additions. It waits as a profile.

**UBL, or Peppol BIS.** Belgium's mandate asks for it. One Factur-X file
serves Germany, and France once XP Z12-012 is read; UBL would be a second
writer of one invoice.

**The XML beside the PDF**, handed over apart. Nobody would prove the two
agree, and a PDF that differs from the XML may be a second invoice under
§ 14c UStG.

**A library**, read on the npm registry on 17 October 2026.
`@stackforge-eu/factur-x` is EUPL-1.2, copyleft, which 0006 refuses.
`node-zugferd` (MIT, a beta), `factur-x-kit`, `@stafyniaksacha/facturx`,
`@fin.cx/einvoice` (MIT) and `@lucaapp/zugferd-ts` (Apache-2.0) attach XML
to a PDF someone else drew, so they would rewrite this renderer's PDF and
decide PDF/A a second time. `@e-invoice-eu/core` (WTFPL) draws a page only
through LibreOffice, `facturx-sdk` (MIT) embeds only into a PDF that is
already PDF/A, and `@attestwire/en16931` (MIT) writes XML alone. Each would
be a second reading of EN 16931 beside the one the validator needs for a
literal, none was shown to keep amounts out of `Number`, and none derives
the XML from what a page prints. Mustang (Apache-2.0) is Java, and is the
oracle.

**BASIC, EXTENDED, MINIMUM or BASIC WL.** MINIMUM and BASIC WL do not count
in Germany; BASIC is a subset that gains a seller nothing; EXTENDED waits
for what needs it.

**The template's own aggregates, checked against the XML.** Per-rate sums
the author writes as conditions, a sum of rounded VAT that is no aggregate,
and a second computation either way.

**Line terms as `RowValue`s of their own**, the first draft. The XML would
read each term from its own value and the page from the table's columns: a
second evaluation of each line beside the first, which nothing compares.

**Country codes as two capitals**, as the QR-bill's are. CEN's lists refuse
`UK`, which that admits, and a unit as `Stk` would pass a shape and fail
BR-CL-23.

**BT-84 held to its check digits alone**, as first proposed. An invoice
that prints an EPC QR code beside its XML would hold one account to two
rules, and the XML could name an account the code refuses.

**The names in `EXPRESSION_NAMES`, for every report.** A report that is no
e-invoice would bind totals it never computes. They are a list of their
own, bound only where there is an e-invoice.

**XML written by the renderer**, or by a package of its own. The renderer
would decide what the invoice says, which 0011 keeps it from; a package
between the runtime and the renderer would be a layer that only forwards.

**A plain PDF of an e-invoice until the PDF/A-3 lands.** It would print, and
in Germany be a picture of an invoice without the invoice, handed over as
though it were one.

**One pull request**, the model and the PDF/A-3 together: larger than #25,
which was 131 files and 7,629 lines added.

**The title left out of the PDF's Info and an escaped `dc:title` in the
XMP**, for the next step. Measured on 17 October 2026 to pass veraPDF
1.30.3, but only as a language alternative, and every e-invoice would lose
its Info title and share its trailer `/ID` with every other of its creation
date. A title without three characters costs less.

**The Leitweg-ID's scheme, 0204, in the list.** It routes an invoice to a
German public buyer in BT-10 and is no legal registration; it waits with
XRechnung, and D-U-N-S, 0060, took its place.

**A bound of 10,000 lines on the XML**, about 12 MB, proposed from the
measurement above. Not taken by this record: the owner chooses the number.
