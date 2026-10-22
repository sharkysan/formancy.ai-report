# 0044 — A person edits a report's e-invoice in either builder, one term a field, in groups; one edit changes the account the e-invoice shares with its payment codes; an e-invoice is edited, not made from nothing: report-core's `putEInvoice`, `updateEInvoice` and `removeEInvoice` and `setPaymentAccount`, which the registry lists; the e-invoice selected from its outline row after the payment part's, its fields a table over every term of either kind, its parties, its contact, its lines and its payment instructions groups, its VAT categories a list added to, moved and removed one step each, a line's codes read from a field or an expression, an XRechnung's own terms a group of their own; the IBAN typed into the e-invoice, its QR-bill or its EPC QR code the account all of them pay, in one step, where all of them write it in the report, and each field's own where one reads it from the data; a payment code added to such a report paying its account; the e-invoice sample a starter of the Studio's; a diagnostic in place of the compound command, the account bound to a parameter and a "make this an e-invoice" action lost, and a warning for a term the page does not print left to a decision of its own

- **Status:** accepted; numbered while 0042 and 0043 were held by branches not yet merged, and numbered before 0045 and merged after it; extends [0012](0012-the-builders-are-native-and-share-one-session.md), whose groups of fields now carry buttons and whose lists are edited item by item, and [0039](0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md), whose part of the report's own level the e-invoice joins and whose bill, printed with an e-invoice, now changes its account with the e-invoice's and is added in its currency to its account; amends [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), under which no builder edited an e-invoice and the e-invoice samples were kept out of the Studio's starters; narrows [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)'s cost that a container's label stands over the label at the top of its last column, for a container no taller than two labels, and its palette default, which in a report with an e-invoice pays the e-invoice's account
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The commands.** report-core's `src/commands/e-invoice.test.ts`:
    `putEInvoice` puts an e-invoice of either kind in a report without one
    or in place of the one it has, the rest the very objects they were,
    and judges none of it, so a standard rate below 0.5 is refused by the
    validator the session asks, at `/eInvoice/vat/0/rate`, the report
    unchanged; `removeEInvoice` takes it away, undo giving back the very
    e-invoice, and refuses a report with none as `not-found` at
    `/eInvoice`; `updateEInvoice` sets what its patch names, removes what
    it gives null, shares the rest, refuses a change of the kind as
    `immutable-property` and a report with none as `not-found`, and leaves
    an XRechnung's buyer's reference removed to the validator, refused by
    BR-DE-15. `setPaymentAccount` changes the account the e-invoice, its
    QR-bill and its EPC QR code share in one edit, one step, which one
    undo takes back whole; changes the codes a report has, the e-invoice
    alone where it has none; leaves each place to refuse the account by
    its own rule, a German account refused by the QR-bill's and the EPC
    code's Swiss BIC by the EPC's pairing, one of wrong check digits at
    all three places, never quoting it; refuses as `read-from-data`,
    naming the place, where the e-invoice, the bill or a code reads its
    account from the data; and refuses a report with no e-invoice, and an
    e-invoice that names no account, as `not-found`. It changes every EPC
    QR code, one behind a condition and one inside a columns block among
    them, in the one edit the session accepts: the review found every
    fixture holding one code, at a region's top, always shown, and a
    mutation taking nested codes out of the edit and one taking hidden
    ones passing all 281 tests; each fails this case. `src/outcome.test.ts`
    gives `read-from-data` its case. All of it was written first and seen
    failing at import before `commands/e-invoice.ts` existed.
    `src/commands/registry.test.ts`, turned round for the e-invoice as
    0039 turned it for the bill: every command `PART_COMMANDS.eInvoice`
    does not list keeps the very e-invoice it found on the e-invoice
    sample given a bill it takes, and each it lists changes it -- its own
    three, `setPaymentAccount` and `replaceDocument`; the payment part's
    half lists `setPaymentAccount` too, and runs every other command on the
    sample and on that billed e-invoice, where the e-invoice's commands
    are edits made rather than refused. Before the registry knew the four
    commands, 17 of its tests failed. Watched failing with `updateEInvoice`
    left out of the e-invoice's list (its "keeps it" failed), `setTitle`
    put in it (its "changes it" failed), `setPaymentAccount` left out of
    the payment part's (its "keeps it, on the billed e-invoice" failed),
    and `removeEInvoice` made to drop the bill too (the bill's "keeps it,
    on the billed e-invoice" failed, where on the sample, refused, it had
    passed).
  - **The fields.** report-builder-core's `src/invoice-fields.test.ts`:
    every term a Factur-X invoice and an XRechnung hold, each given every
    optional term, is reached by a field at it or below it; every term a
    Factur-X invoice may leave out, where it leaves it out, by a field or
    a group at it, or by the one that puts in the part that holds it; every
    field, group and button named once and with no placeholder left, in
    the editor's three languages, over four invoices; the groups in order,
    each with the buttons its kind allows, an XRechnung's own first; and
    each VAT category's buttons available where they have somewhere to go,
    saying where the keyboard goes. That a term added to the format without
    its field does not compile is tsc's: `invoice-fields.ts` is a table
    over every term, part by part. Watched failing with the account name's
    field taken out of the payment instructions' table: tsc stopped at
    TS2741, and, compiled anyway, "reach every term a Factur-X invoice
    holds" failed.
  - **The editor model.** `src/e-invoice.test.ts`: the row after the
    payment part's, named "E-invoice", "E-Rechnung", "Facture
    électronique", which every walk takes last, and none in a report
    without one; the heading saying the kind, "Factur-X" or "XRechnung";
    the moves and Duplicate unavailable and refused as `at-edge` in the
    e-invoice's own words, Delete available; Delete one step, "Remove
    e-invoice", "Deleted the e-invoice.", the row before it selected, undo
    giving back the very e-invoice, and no Add of one anywhere; a problem
    with a term the e-invoice's, listed by its name, counted on its row and
    on the field of the term; a party and a rate edited one step each,
    named for the field; a rate below 0.5, a column printing two terms of
    a line and a code read from a field of another type refused on the
    field typed into, in the validator's words, the report the very
    object; a line's code read from a field or an expression; a party's
    electronic address put in by typing it, by email until its scheme is
    chosen, and taken away by emptying it, the invoicing period by either
    of its dates, a legal registration by its identifier; the seller's
    contact added from values that reach nobody and removed, the payment
    instructions removed where nothing pays them and refused where the EPC
    code asks to be paid to their account; an XRechnung's contact without
    a Remove, and a Skonto line in its payment terms refused on the field
    by BR-DE-18; the VAT categories added, moved and removed one step each,
    a category added being of a breakdown the invoice lacks, in the
    report's words, Add VAT category unavailable where the invoice holds
    every breakdown it adds and, sent there, refused as `unavailable`,
    saying why, and a move past either end, a move to where a category
    stands, a key that names nothing and the last category taken away
    refused; a period kept with the date that stands; an EPC code that
    reads its account from the data written alone; an add or a removal
    the validator refuses saying what was not added or removed -- a
    reverse-charged category over a buyer with no VAT identifier
    (BR-AE-02), the payment instructions an EPC code pays -- a group that
    is part of every invoice of its kind and an item of a list each said
    to be so in the e-invoice's words, its number filled in, where the
    first version said "part of every bill" and printed "{item}"; and a
    key that is no string refused as naming nothing, where it had thrown
    out of `dispatch`. And the account: typed into the e-invoice's IBAN,
    the bill's or the EPC code's, the three pay it in one step, "Change
    IBAN", the live region saying so, undo giving all three back; one the
    bill cannot pay refused on the bill's field in the bill's own rule,
    not the EPC code's BIC of another country, in three languages, and
    emptied on the e-invoice's in its own (BT-84), each field's error
    first the one at its own runs, where the first version showed
    another place's; where the e-invoice reads its account from the data,
    the code's field and the bill's each writing its own, and where a
    code does, the e-invoice's field its own, both refused as
    `read-from-data` by the first version, which sent the shared edit
    whenever the field typed into was written; where one place reads it
    and two are written, one changed alone refused in the rule that holds
    the two together; without an e-invoice an EPC code's IBAN its own.
    And a payment code added: the palette's EPC payment code paying the
    e-invoice's account with its BIC and inserted as it stands,
    unavailable where the e-invoice names no account; Add QR-bill adding a
    bill in the e-invoice's currency to its account, and refused in
    report-spec's words where a bill cannot pay it. Each of these failed
    first, fourteen in all.
    `src/css.test.ts` also holds that a container no taller than two
    labels draws no label of its own, watched failing before the rule.
    `src/editor.test.ts`: the e-invoice selected in a report without one
    refused as `not-found`, and added as `unavailable`, "An e-invoice is
    edited here, never made from nothing". `src/payment-part.test.ts`,
    0039's case turned round: the IBAN typed into a bill printed with an
    e-invoice is the e-invoice's account too, in one step, and a German
    one refused on the bill's field; and Add QR-bill over an e-invoice
    that names no account refused for that, where 0039's case was
    refused for SIX's francs. `src/css.test.ts`: a group's
    unavailable button is dressed as an unavailable tool is, watched
    failing before the rule was there; it reads each rule's list
    selector by selector, where it read a list as one text and passed
    with the hover rule taken away, which the review found, and fails now
    with either rule taken away. Mutated: with the e-invoice never found
    as a part, 42 of the package's tests failed; with the account written
    by each field's own command, 7; with a VAT category's Move up keeping
    the keyboard where it was, the three runs of the list's scenario.
  - **Both builders**
    ([0012](0012-the-builders-are-native-and-share-one-session.md)). The
    scenarios of `src/scenario-e-invoice.ts` in `BUILDER_SCENARIOS` --
    "select the e-invoice in the outline, and edit its buyer and a rate",
    "add, move and remove a VAT category, one step each", "change the
    account the e-invoice shares with its QR-bill and its EPC code, from
    either code", "delete the e-invoice, and bring it back" and "refuse an
    XRechnung's Leitweg-ID and its buyer's reference where they are typed"
    -- run by the core's headless driver, React's `scenarios.test.tsx` and
    Angular's `scenarios.test.ts`, in three languages with axe at the end
    of each. Each builder's `accessibility.test` names the e-invoice's row
    a row at the tree's top after the bill's, each group of its fields in
    the editor's words with its drawn name hidden, every group's buttons
    as the state says, the first category's Move up `aria-disabled` and
    focusable. Against `main`'s React builder over this model, 15 of those
    tests failed, the list's scenario in each language, 0039's three and
    both accessibility tests among them; against `main`'s Angular builder,
    14. The list's scenario presses a category's Move down as well as its
    Move up: with each builder sending the keyboard to a group's first
    button whatever `then` names, the review found the scenario passing,
    since Move up is the first; it fails now in its three languages in
    React and in Angular.
  - **The Studio.** `src/parity.test.tsx` walks the e-invoice starter's
    e-invoice in both builders in three languages: selected, its seller's
    name typed, a rate refused on its field, a category taken away, added
    and moved first and the three undone, its IBAN typed once and undone,
    and the e-invoice deleted and brought back, the trees the same at each
    state. `src/journey.test.tsx` audits the e-invoice starter in both
    builders and both modes, as every starter, its preview printed with
    its one warning, and its e-invoice selected and a rate refused in one
    builder and then the other. `src/studio.test.tsx` holds the Preview's
    list of what a render lacks to be one tab stop, Tab from Final, before
    it, landing on it, watched failing without its `tabIndex`. Adding the starter failed four of the Studio's tests first: the
    picker's names, a preview's title, and both journey tests, which waited
    for a preview printed without a warning.
  - **The browser gate.** `apps/studio/scripts/gate-e-invoice.mjs`, at
    every pass of the journey, in each builder: the e-invoice starter's
    final Download PDF read back in Node, its embedded `factur-x.xml` found
    by pdf-lib and read by namespace, its page's text by PDF.js and its EPC
    QR code decoded from its pixels with ZXing: the XML's total with VAT
    the one the page prints, the code paying the XML's account; the row
    selecting the e-invoice with the keyboard on it; the buyer's electronic
    address typed and the XML naming it under EM, beside the buyer the
    page prints; the first category's rate typed and the XML's tax at it
    the amount the page prints; an IBAN typed once and the XML and the code
    both paying it; and each undone. `gate-parity.mjs` walks the e-invoice
    starter's e-invoice, a VAT category added and a rate refused, and
    compares the two builders' trees there, a category taken away and one
    added -- the starter holds every breakdown an add could give -- and a
    rate refused. The gate's first run failed 40 checks, every one at the
    e-invoice starter: its preview's paper held to the picture of its final
    render, the label every preview page carries among its lines, at each
    pass in each builder; axe's `scrollable-region-focusable` on the
    Preview's list of what the preview lacks, which held no button; the
    contrast of its totals' labels left undecided where a columns block's
    own label stood over its amount's; and the parity walk's Add refused.
    Each is answered above: the starter's paper read with Final on, the
    list a tab stop, a short container drawing no label of its own, Add
    unavailable where nothing can be added and the walk taking a category
    away first. The whole gate then passed on 22 October 2026, 3,892
    checks in 860 s, on Windows 11 Pro, an Intel i9-10900K and Node
    24.21.0, in Chromium as `scripts/browsers.mjs` launches it; the first
    run had taken 1,251 s, failing. The review could not tell whether that
    run was the final tree's, a source having been written after it
    started; after the review's fixes the whole gate passed again on the
    final tree, rebuilt first, 3,892 checks in 873 s by its record's
    `startedAt` and `finishedAt` (05:43:26 to 05:57:59 UTC), the jsdom
    suites of both builders and the Studio running beside its first
    minutes, and another worktree's browser gate having held the Studio's
    port until it started. The README's pictures' check then
    found the three pictures whose bar holds the picker's options saying
    something else, "E-invoice" among them: retaken by their script, their
    records changed and their images did not; after the review's fixes it
    walked its five scenes and found every one saying what it was recorded
    saying.
  - **The e-invoice gate.** The e-invoice starter's variant,
    `variant-e-invoice.pdf`, the base sample's page drawn from the
    starter's own data, as `variantProblems` asks of every starter: recorded
    with `--record` and then judged against the record, accepted by
    veraPDF and Mustang. The judges' tests failed on the record before it
    was taken again, ten of them, and passed on it; the order veraPDF lists
    `control-plain.pdf`'s two refusals in moved in the new record, the PDF
    the same by its digest, and `verapdf.test.mjs` reads a control's
    refusals as the set the judge compares. On 22 October 2026, on one
    Windows 11 workstation (i9-10900K) on Zulu 25.0.4.1 under Node
    24.21.0, two other branches' work running beside it, the recording
    took 157.7 s, Mustang 137.5 s over 37 runs, and the run judged against
    it 153.0 s, Mustang 135.6 s, as its `test-results/e-invoice.json` gave
    them; 0038's record measured 120.8 s, Mustang 104.8 s over 36 runs, on
    a machine less loaded, so the difference is no measurement of this
    record's cost.
  - **From outside.** The install gate draws each packed builder a fifth
    time, over the scenarios' e-invoice selected with a VAT category added,
    and `scripts/install-fixture/structure.ts` holds the e-invoice's row
    after the bill's and each group with its fields and its buttons, each
    `aria-disabled` exactly where the state says, to the core's README.
    It failed first in the Angular hosts, because `structure.ts` read the
    outline's top rows alone, and the e-invoice's report has a table whose
    columns are rows; it reads every row now. The whole install gate then
    passed, in 118 s on the machine above on 22 October 2026, and again
    on the final tree after the review's fixes, in 85 s.
  - **Not held by anything here.** That a person reads what the XML says
    before an e-invoice is sent; that an account typed is the seller's;
    that a rate, an exemption reason or an electronic address typed is the
    right one; that the words a template prints beside the totals --
    "Umsatzsteuer 19 % auf", an "IBAN:" line of its own -- say what the
    XML says, which no edit of the e-invoice changes; and that the page's
    own words for the parties, the dates and the bank say what the XML
    does: report-core holds the totals and the lines to the page (0027)
    and no other term, so the seller's name, VAT identifier or city, the
    issue and the due date, the BIC and the account's name, each changed
    in the e-invoice starter, are accepted with no diagnostic while its
    header and its "BIC:" line print what they printed, which the review
    found.

## Context

[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
gave a report one EN 16931 invoice at its own level, which no command
edited: only a replacement of the whole document could change it, and the
registry test held every command to keeping the very e-invoice. Its
samples were the corpus's and not the Studio's starters, since neither
builder edited one. [0037](0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)
and [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)
added terms and a second kind. [0039](0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)
made the QR-bill a part of the report's own level that a person selects and
edits as a component, and left the e-invoice to this record: in an
e-invoice the bill's IBAN alone is refused, because its account must be the
e-invoice's BT-84.

The maintainer asked for 0.3.0 to edit a QR-bill or an e-invoice in the
builders ("yes, and start 0.3.0", choosing "More invoice formats"), and
accepted the plan's answers: the shared account a compound
`setPaymentAccount`, in one undo step (INV-Q8), and an e-invoice edited
only, a starter giving one, with no "make this an e-invoice" action
(INV-Q9).

The forces:
- **An e-invoice is many fields.** Its parties, its contact, its
  dates, its categories, its lines and its payment, each a text of runs, an
  expression or a code; a name repeated across them -- a city, a rate --
  could not be told apart by a test or a screen reader.
- **One account in four places.** BT-84, a QR-bill's account and every EPC
  QR code's are held to be one by the validator, and each edit is validated
  whole (0008), so a change of any one alone is refused, whichever comes
  first.
- **The account is a payment target.** A command descriptor is what a
  proposal carries (plan 16); a change of whom an invoice is paid by must
  be findable by its command.
- **An e-invoice needs a report shaped for it.** A table over the detail
  dataset printing four of a line's terms, and every total printed; made
  from nothing over a report without them, it would be refused, or would
  be a template no author chose.

## Decision

**report-core edits the e-invoice by three commands and the account by
one**, in `commands/e-invoice.ts`:
- `putEInvoice(report, invoice)`, of either kind, added or in place of
  one; `updateEInvoice(report, patch)`, its terms but never its kind;
  `removeEInvoice(report)`. Each judges nothing of the invoice: EN 16931's
  rules and XRechnung's are report-spec's, which the session asks.
- `setPaymentAccount(report, account)`: the account, as typed, written as
  one literal run into the e-invoice's BT-84, the QR-bill's account and
  every EPC QR code's IBAN, shown or hidden, in one edit, so one undo step.
  Refused as `not-found` without an e-invoice -- no account is shared
  there -- or where it names none, and as a new refusal code,
  `read-from-data`, naming the place, where one of them reads its account
  from the data, which the command would write over with a literal. Whether
  each place takes the account is the validator's to say, each by its own
  rule. A BIC is left as it is: no rule holds a code's to BT-86.

All four are in `COMMANDS` and `ARGUMENTS`. `PART_COMMANDS.eInvoice` lists
the e-invoice's three, `setPaymentAccount` and `replaceDocument`, and
`PART_COMMANDS.paymentPart` gains `setPaymentAccount`: the registry test
reads the lists.

**The e-invoice is a part of the report's own level**
(`REPORT_LEVEL_PARTS`), selected from its outline row, after the payment
part's, and edited as a component is. It prints nothing of its own, so it
has no band on the canvas. It has one place: the moves and Duplicate say so
in its own words, and Delete removes it in one step. A diagnostic at a path
inside `/eInvoice` that names no component is its own.

**An e-invoice is edited, not made from nothing (INV-Q9).** No Add of one is
offered, and an `addPart` of one is refused as `unavailable`. The Studio's
e-invoice starter, "Rechnung (ZUGFeRD)", the corpus's sample, is where a
person starts one: the corpus's `STARTERS` hold it, and the picker calls it
"E-invoice", a letter standing alone keeping its hyphen.

**Its fields are tables over every term** (`invoice-fields.ts`), part by
part, so that a term added to the format without its field does not
compile:
- the invoice's own terms by themselves, or, in an XRechnung, its version,
  the buyer's reference that carries a public buyer's Leitweg-ID and the
  business process as a group "XRechnung", first;
- the seller and the buyer each a group, every field named after the party
  ("Buyer's city"); the seller's contact a group of its own after the
  seller's, optional in a Factur-X invoice, added from values that reach
  nobody -- a name in the report's language, one of the Bundesnetzagentur's
  Köln numbers kept for media, an address under `example.com` -- and part of
  every XRechnung, with no Remove;
- a party's legal registration and electronic address, an identifier and a
  scheme, put in by typing the identifier -- an electronic address by email
  until its scheme is chosen -- and taken away by emptying it;
- the invoicing period put in by either date and taken away with the last;
- each VAT category a group, numbered ("VAT category 2: rate in per
  cent"), with Move up, Move down and Remove, and the list's own group with
  Add VAT category, each one step; a category added is the first of
  Germany's breakdowns the invoice lacks, by report-spec's own rule --
  standard rated at 19 % and at 7 %, exempt, reverse-charged -- under a
  fresh identifier, the last two with a reason in the report's language,
  and where it holds all four, as the e-invoice starter does, Add VAT
  category is unavailable;
- the lines a group: the table, the column of each of the four terms a
  page prints, and the line's identifier, unit and category each read
  from a detail field or an expression -- a choice of the two, and the
  expression's field where it is one, an expression chosen over a field
  reading that field;
- the payment instructions a group, optional in a Factur-X invoice, added
  as a SEPA credit transfer to the palette's account that pays nobody, and
  part of every XRechnung; the due date, the payment terms -- one text of
  several lines, where XRechnung's Skonto would be -- and the paid amount
  after them.

**A group's buttons are a list** (`PropertyGroup`'s `actions`, where 0039
gave it one `action`), each with whether it has somewhere to go -- the
first category's Move up has not, and is drawn `aria-disabled` and still
sent -- and where the keyboard goes once it is done, decided in the model
(`then`): a category moved takes it to the same button of the group the
category stands in now, one removed to the list's Add, one added to its
first field. Both builders follow it.

**The account typed in any one place is the account all of them pay**,
where all of them write it in the report. Wherever the IBAN is typed in a
report with an e-invoice -- the e-invoice's payment instructions, its
QR-bill, an EPC QR code -- the field's edit is `setPaymentAccount`, "Change
IBAN", and the live region says that the e-invoice and every payment code
printed with it pay the account typed. An account one place cannot take is
refused on the field typed into, in that place's rule: a German IBAN in a
report whose QR-bill pays Swiss accounts. The field shows the error at its
own runs first -- the bill's rule on the bill's field, BT-84's on the
e-invoice's -- and another place's only where its own place took the
account. Where any of them reads its account from the data, the shared edit
would write over a binding and is refused as `read-from-data`: the field
asks the command first and, refused so, writes its own account alone, by
its own command, and the render compares it with the data's (0027). Which
places share the account is decided in report-core alone; the builder asks
it rather than walking them again.

**A payment code added to a report with an e-invoice pays its account.**
The palette's EPC payment code pays the e-invoice's BT-84 as written -- its
binding where it reads one -- with its BIC (BT-86) where it names one,
which an account outside the EEA needs, since the account that pays nobody
is refused in every place of such a report; where the e-invoice gives no
payment instructions, the palette says to add them first, as it says an
image needs an image. Add QR-bill gives the bill the e-invoice's currency
and its account, where 0039 gave SIX's example in francs, which every
report with an e-invoice refused; a bill cannot pay a German account, and
there the add is refused in report-spec's words, as 0039's on a Letter page
is.

**The e-invoice starter needed two things of the room around it.** Its
preview carries the runtime's one warning, that a preview is no e-invoice,
which the Studio lists in the Preview with nothing to select: the list,
which scrolls, is one tab stop, as the design view is, where axe's
`scrollable-region-focusable` found a keyboard could not reach it. And its
totals are columns blocks of one line, whose own label, at their top end,
stood on the line of the label of what stands at the top of their last
column, one over the other: a container no taller than two labels draws
none of its own, as a box shorter than its label draws none
(`styles/canvas.css`), which narrows 0025's cost that a component at the
top of a narrow last column has its label printed over its container's.

**Every refusal is report-spec's**, on the field typed into, in its words:
EN 16931's rates and categories, a column printing two terms, a code read
from a field of another type, a Leitweg-ID's check digits under 0204, an
XRechnung's needs (BR-DE-15) and its Skonto line (BR-DE-18). An
XRechnung's copy label is the runtime's, written at the render (0038), and
no term of the e-invoice: nothing here edits or shows it. A button the
state marks unavailable -- Add VAT category with nothing left to add -- is
refused as `unavailable` when it is sent anyway, saying why; an add or a
removal the validator refuses says what was not done ("Did not add VAT
category 4: …"). Availability says whether a group or a list has somewhere
to go, as the toolbar's does: Remove payment instructions while an EPC
code asks for their account stays available and is refused in the
validator's words, as the toolbar's Delete of the table an e-invoice's
lines name is.

**The undo labels and the live region** are the session's English
sentences, each editor saying them in its own words: "Remove e-invoice",
"Add VAT category", "Move VAT category", "Remove VAT category", "Add
contact", "Remove contact", "Add payment instructions", "Remove payment
instructions", and "Change" and a field's name. Swiss French says an added,
removed or moved item without a participle -- "Ajout : Catégorie de TVA 3."
-- as 0039's "Modification : …", since a category and the payment
instructions are feminine.

## Consequences

**What it buys.**
- **An e-invoice edited where it is shown**, by keyboard and by pointer, in
  both builders and three languages, every term a field, refused where EN
  16931's or XRechnung's rules refuse it, undone in one step.
- **One account, changed once.** The e-invoice, its QR-bill and its EPC QR
  code agree after every edit, which the validator held to and no person
  could reach before; and the change of whom it is paid by is one command a
  review can find, `setPaymentAccount`.
- **Three edits proved on the PDF.** The browser gate reads the XML the
  final PDF embeds after the buyer's electronic address, a rate and the
  IBAN are typed, and holds each to the page: the address beside the buyer
  the page prints, the tax at the rate to the amount it prints, the
  account to the EPC QR code decoded from its pixels. No other edit is
  held so.
- **An e-invoice to start from** in the Studio, judged by the e-invoice
  gate as every starter is.

**What it costs.**
- **No e-invoice from nothing.** A report becomes an e-invoice through a
  host, a paste or a starter; an author who deletes one gets it back by
  undo alone.
- **A long form.** An e-invoice's properties are one pane that scrolls:
  the e-invoice starter's are 65 fields, 50 of them in 10 groups, counted
  from the editor's state over the built packages on 22 October 2026;
  nothing measures how a person finds their way through it, and the
  browser gate measures no scrolling pane.
- **The account moves within a country.** `setPaymentAccount` changes no
  BIC: an EPC QR code's BIC is of its account's country, so an account of
  another country is refused until the code's BIC is changed or emptied,
  and one outside the EEA, which needs a BIC, cannot follow from one inside
  it in one edit. A QR-bill pays Swiss and Liechtenstein accounts alone, so
  a report with an e-invoice and a QR-bill keeps a Swiss account.
- **A literal written over a literal only.** Where any place reads its
  account from the data, each field writes its own, and the render
  compares it with the data's; where two others are written, as an
  e-invoice's and its bill's beside a code that reads the data, each is
  held to the other, and one changed alone is refused until the person
  binds them alike or writes the third. A text component that prints the
  IBAN -- the starter's "IBAN:" line -- is the template's words and is not
  changed by it.
- **The page's own words are not held to the XML.** report-core holds an
  e-invoice's totals and its lines to the page (0027) and nothing else, so
  the seller's name, address or VAT identifier, the issue or due date, the
  BIC or the account's name, changed in the e-invoice, is accepted with no
  diagnostic where the page prints it in its own text, as the e-invoice
  starter's header and its "BIC:" line do: the XML then names another
  seller, other dates or another bank than the page, which § 14c UStG may
  count as a second invoice. The person changes both.
- **What a template prints beside a total is its own.** A rate changed in
  the e-invoice changes the amounts the page prints by name, and not the
  words a text writes beside them: the starter's "Umsatzsteuer 19 % auf"
  stays as written.
- **Placeholders that print.** A contact, payment instructions and an
  exempt or reverse-charged category added from nothing hold the editor's
  words and values, which reach nobody and are written into the XML until
  a person replaces them; nothing warns of them, as 0039 warns of SIX's
  examples. An exempt category's reason names no provision, which § 14
  Abs. 4 Satz 1 Nr. 8 UStG asks for.
- **A line's code chosen as a field lists every detail field**, whatever
  its type; the validator refuses one of another type.
- **More published types and actions**: `PropertyGroup.actions` in place of
  0039's `action` (0039's is unreleased), `PropertyAction.available` and
  `then`, three actions (`addItem`, `removeItem`, `moveItem`), the
  e-invoice in `REPORT_LEVEL_PARTS`; report-core's four commands,
  `EInvoicePatch` and the refusal code `read-from-data`.
- **A larger editor model.** report-builder-core's built `index.mjs` was
  222,466 bytes, 61,052 with gzip -9, before this record, and 292,254 and
  77,504 after it, with GNU gzip 1.13, measured on the packages' build of
  the final tree on 22 October 2026; the review's fixes added the last
  6,179 and 1,628 of them.
- **Another starter**, which every starter's check now walks: the corpus's
  tests, the renderer's pictures, the Studio's suites in jsdom, its browser
  gate and the e-invoice gate's variants. Its preview is labelled as no
  e-invoice on every page (0027), so the browser gate holds its paper to
  the picture of its final render.
- **Longer gates.** The browser gate checks the e-invoice in each builder
  at every pass of the journey, the e-invoice starter as every starter,
  and three more states of its parity walk; its whole run took 860 s on
  22 October 2026 on the machine above, and 873 s on the final tree,
  where 0039's took 651 s, with other branches' work beside it, so the
  difference is no measurement of this record's cost. The e-invoice gate draws and judges one variant
  more. The parity test in jsdom walks the e-invoice starter's e-invoice
  in three languages.
- **No native speaker has read** the e-invoice's German and French field
  names, groups and messages.

**What it forecloses.** An e-invoice's terms changed anywhere but through
these commands and `replaceDocument`, and an account changed in one place of
an e-invoice and not the others.

## Alternatives considered

**A diagnostic in place of the compound command** (INV-Q8's second option):
the validator's check of a code's account against BT-84 lowered to a
report-core warning, the runtime still refusing at the render. Each place
would be edited alone, and a report whose accounts disagree would be valid
until it printed, saved and passed on in between; the one rule would be
held in two places of different strength.

**The account bound to a parameter**, every place reading one: the account
would be the host's to supply at every render, which a template that knows
its seller's account does not want, and a literal typed in a field would no
longer be the account.

**A "make this an e-invoice" action** (INV-Q9's other option): over a
report without a table of four suitable columns or printed totals it is
refused, and over one with them it would choose a table, columns, codes and
categories for the author; a starter shows a working one, and creation
waits for the action a host asks for.

**Groups nested in groups** -- the seller's address and contact inside the
seller's group. Neither builder draws a group inside a group, and a name
repeated at two levels would be read twice; the contact is a group after
the seller's.

**A VAT category's buttons left out where they have nowhere to go.** The
buttons of a group would come and go with its place, and the keyboard,
following a category moved, would land on a button that is not there; drawn
`aria-disabled`, as the toolbar's are, they stay.

**A new kind of field for a value read from each row.** Both builders would
draw a new control; a choice and an expression's field are kinds both draw.

**The keyboard left where it was after a move**, on a button that then
moves the next category. A person moving one category twice would move two.

**A warning for a term the page does not print**, beside 0027's
`e-invoice-total-unprinted`, for the seller, the buyer, the dates and the
bank. Which terms a page must print is § 14 Abs. 4 UStG's list, not
EN 16931's, and whether a literal is printed is a comparison of the
template's text with the term's -- "Muster GmbH" in the XML and "Muster
GmbH, Köln" in a header -- which a match of words would pass or fail for
the wrong reason; a date or a field read by both is a comparison of what
they read, as the totals' is. It is a decision over 0027's, of its own,
and is left to one.

**Remove payment instructions unavailable while a code asks for their
account.** Availability would then say what the validator says, for one
group and not for the toolbar's Delete, and a button would change with
the components around it; the validator's refusal names what to change.
