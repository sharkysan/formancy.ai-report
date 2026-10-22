# 0039 — A person selects a report's QR-bill and edits it field by field in either builder: a part of the report's own level is selected from its outline row after the regions or its band on the canvas and edited as a component is, through report-core's `putPaymentPart`, `updatePaymentPart` and `removePaymentPart`, which the registry lists, with `replaceDocument`, as the commands that may change it; its fields a table over every term of the bill, its creditor and debtor groups, the debtor added from SIX's example and removed in one step; an IBAN of the other kind taking the reference with it; a bill added from nothing SIX's third example, and every bill that holds SIX's examples warned of once, the starters' among them; the IBAN refused where SIX's rules or the e-invoice's account refuse it and confirmed by nothing; a dialog asking for the account first, a confirmation of a changed IBAN, a warning on the editor's own example alone, the account and the reference committed as one group, groups worked out by each builder and the bill as a region of the outline lost

- **Status:** accepted; extends [0012](0012-the-builders-are-native-and-share-one-session.md), whose editor now selects and edits a part of the report's own level as it does a component, and [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), lifting its "nothing edits the bill yet"; narrows [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md) and [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md), whose QR-bill invoice and samples now open with one warning, that their bill pays SIX's example account; numbered before 0040 and 0041 and merged after them; extended by [0044](0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md), under which the e-invoice is a part of the report's own level too, a group's one button is a list of them, and the IBAN typed into a bill printed with an e-invoice is the account the e-invoice shares, changed with it in one step, which this record left refused, and Add QR-bill in a report with an e-invoice gives the bill the e-invoice's currency and account, where this record's SIX example in francs was refused there, and by [0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md), whose batch `PART_COMMANDS` lists for the bill, and whose review offers nothing that changes what a bill prints
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The commands.** report-core's `src/commands/payment-part.test.ts`:
    `putPaymentPart` puts a bill in a report without one, or in place of
    the one it has, the rest the very objects they were, and judges none
    of it, so a bill whose IBAN fails its check digits is refused by the
    validator the session asks, the report unchanged; `removePaymentPart`
    takes the bill away, undo giving back the very bill, and refuses a
    report with none as `not-found` at `/paymentPart`; `updatePaymentPart`
    sets what its patch names, removes what it gives null, shares the
    rest, and refuses a change of the kind as `immutable-property` and a
    report with no bill as `not-found`. `src/commands/registry.test.ts`,
    turned round: every command the registry's `PART_COMMANDS` does not
    list for the payment part keeps the very bill it found, and every one
    it lists changes it, as its example does -- `replaceDocument` among
    them, whose example pastes a report with another bill; which commands
    those are is read from the registry, never typed into the test, and
    the list names commands the registry holds, each once. Watched
    failing with `updatePaymentPart` left out of the list (its "keeps it"
    failed), with `setTitle` put in it (its "changes it" failed), and with
    `replaceDocument` left out once its example pasted another bill (its
    "keeps it" failed; it had passed before only because the bill it
    pasted was equal to the one there, which the session keeps). The
    e-invoice's half reads its own list, `replaceDocument` alone, and
    runs every other command on the e-invoice sample given a bill it
    takes, in euro to a Swiss BT-84, its EPC QR code paying it too: put,
    patched and removed, the bill's commands are edits made, and each
    keeps the very e-invoice -- watched failing with `updatePaymentPart`
    and `removePaymentPart` made to drop the e-invoice, which on the
    sample without a bill, where both were refused, had passed -- and a
    replacement with another number changes it. A command that takes
    nothing after the report, `removePaymentPart`, has no fewer arguments
    to be refused for.
  - **The warning.** report-spec's `src/qr-bill.test.ts` holds
    `QR_BILL_EXAMPLE_ACCOUNTS` to the four accounts of IG 2.4's Annex A,
    as the code holds them, each one the account check takes, and
    `QR_BILL_EXAMPLE`, what a builder starts a bill from, to SIX's rules:
    its account one of the four, an IBAN; each part of each party one its
    rule takes, only an optional one left out; its reference a QR
    reference whose check digit holds. report-core's
    `src/diagnostics/example-payment-part.test.ts`: each example account,
    written as the code holds it, with its spaces, and in two runs, and
    the creditor, the debtor and the reference of `QR_BILL_EXAMPLE`, the
    blanks around a part aside and the reference also without its spaces,
    is warned of once, on `/paymentPart`, as `example-payment-part`, a
    warning; a bill that holds them all is one warning, its words naming
    each term that is an example in the order the code holds them, saying
    what to do and quoting none; an account of another's, one read from
    the data, a party with a part of its own, a part more than the
    example's or a part read from the data, SIX's second example's QR
    reference and a report with no bill are not. Watched failing with a
    party compared by the example's parts alone (the party with a part
    more was warned of). Its case in `src/diagnostics/diagnose.test.ts`
    holds that it is the one diagnostic such an edit of the sample gives,
    the sample's own bill moved off SIX's account so that the sample
    reports nothing.
  - **The editor model.** report-builder-core's `src/payment-part.test.ts`,
    beside 0022's cases, which keep passing but the first, whose billed
    report now opens with the examples' warning alone:
    - the band says it is selected and carries the bill's problems and
      their worst severity, as its outline row does;
    - the row stands after the regions, named "Payment part", "Zahlteil"
      or "Section paiement", in a report with a bill alone; every walk
      takes it last -- End, the arrow from the last component, Home back
      -- and the arrow past it says it is last; a step out of it or into
      it is refused, saying why; the moves and Duplicate are unavailable
      and refused as `at-edge` with the report unchanged, Delete
      available; a selection of a bill that is gone is let go of;
    - the properties: the heading "QR-bill: Payment part" and every term,
      in IG Table 8's order, then the slip's language, each name unique;
      every term of a bill reached by a field or a group whether the bill
      holds it or not; the parties as groups named after them in three
      languages, the debtor's with its Remove; five texts, the amount and
      the language changed one step each, each undo label "Change" and the
      field's name, seven undos giving back the very bill; an IBAN with a
      wrong check digit refused on its field in the validator's words, and
      one apart from the e-invoice's BT-84 refused on its field, each
      leaving the report the very object; a QR-IBAN typed over the added
      bill, an IBAN with no reference, taking SIX's example QR reference
      with it in one step "Change IBAN", the live region saying so and the
      reference's field not marked invalid, the creditor's own QR
      reference typed, an IBAN then typed over it taking it away, said,
      and undo giving back both at once; an IBAN of the same kind, a
      reference computed as one from the data is, and an account
      computed, leaving the reference the very runs it was; a QR-IBAN in a bill in euro refused on the
      IBAN's field in the currency's rule; the debtor removed and SIX's
      example debtor added back, one step each; a group's button with
      nothing to do refused; SIX's five languages named by Intl in the
      editor's language;
    - added from nothing: the report's own properties offer it, as a group
      "Payment part" with Add QR-bill; it is SIX's third example, its
      headings in the report's language where SIX prints in it, else
      English; selected, announced, warned of once as the payment part's,
      its account and its creditor named, and on no field, the IBAN's and
      the creditor's name's among them -- watched failing with the panel
      made to draw a diagnostic of the bill's own path on its fields --
      in one step "Add QR-bill" whose
      undo gives back the very report; refused on a Letter page, a
      landscape one and an e-invoice in euro, "The QR-bill was not added"
      and report-spec's words, the report the very object, and refused
      again once the report has one;
    - removed with Delete in one step "Remove QR-bill", said as "Deleted
      the QR-bill.", the row before it selected -- the billed report's
      last component -- or nothing where it was the only row, and undo
      gives back the very bill;
    - its diagnostics are the payment part's: listed as "Warnung:
      Zahlteil", counted on its row, followed to the bill, and an
      expression's error on the field it is about.

    `src/editor.test.ts`: a part that is none of `REPORT_LEVEL_PARTS` --
    the e-invoice, before this editor knows it, undefined, a name off the
    object's prototype -- sent by a caller tsc never saw is refused as
    `not-found`, to select on a report with a bill and to add on one
    without, nothing selected and nothing committed. Watched failing with
    the selection's check taken out (the e-invoice selected the bill) and
    with the add's (it committed a bill, and every state after it threw).

    `src/scenarios.test.ts` runs the three scenarios of
    `src/scenario-payment-part.ts` against the model in three languages,
    the headless driver reading the part's row, a group's button, which
    keeps the keyboard as its words change, and a click on the band.
    `src/css.test.ts` fails on a rule that dresses a selected box and not
    the selected band, or a box's badge and not the band's: watched
    failing before the rule was there.
  - **Both builders**
    ([0012](0012-the-builders-are-native-and-share-one-session.md)). The
    scenarios "select the QR-bill on the canvas, and edit it field by
    field", "add a QR-bill to a report without one, then delete it and
    bring it back" and "add a QR-bill and make it pay a QR-IBAN with a QR
    reference", in `BUILDER_SCENARIOS`, run by React's
    `scenarios.test.tsx` and Angular's `scenarios.test.ts` in three
    languages with axe at the end of each. Run against `main`'s editor
    model, every case `payment-part.test.ts` adds to 0022's failed, and
    the first two scenarios in every language; the third failed in every
    language, with the two cases of the IBAN's pairing, once the IBAN's
    edit was made to leave the reference alone. Against `main`'s React
    builder over this model, the first two scenarios in every language and
    the guard that every one ran failed, seven tests; against `main`'s
    Angular builder, six. Each
    builder's `accessibility.test` names the bill's row a row at the
    tree's top, after the regions' groups, and each group of its fields in
    the editor's words with its drawn name hidden from the tree; Angular's
    `parts.test.ts` finds `property-group` drawn.
  - **The Studio.** `src/parity.test.tsx` compares the two builders'
    trees, in three languages over every starter, with the bill selected
    -- the invoice's from its row, SIX's example added to every other --
    an IBAN refused on its field, the debtor taken away and given back,
    the bill deleted and brought back. `src/journey.test.tsx` audits the
    invoice's bill selected by its band in one builder, an IBAN refused
    there and in the other, and a bill added to the blank report.
    `src/studio.test.tsx` runs plan 21's switch with the bill selected:
    its IBAN changed in Angular, the bill still selected in React, where
    the change is undone, and redone in Angular, the Preview asked each
    time to print the account as it stands.
  - **The browser gate.** `apps/studio/scripts/gate-payment-part.mjs`, at
    every pass of the journey, in each builder: the invoice's Download PDF
    holding one Swiss QR Code, decoded from the page's pixels with ZXing,
    paying the starter's account; its band clicked in the design view as a
    pointer clicks it, which Playwright does only once nothing drawn over
    the band would take the click, the bill's IBAN then among the
    properties; the bill's row selecting it with the keyboard on it; an
    IBAN with a wrong check digit refused on its field, the PDF's code
    still paying the starter's account; one SIX's rules take typed, the
    live region saying so, and the code the Download PDF draws paying it;
    and the edit undone, the code paying the starter's account again.
    `gate-parity.mjs` walks two more states for every starter, the bill
    selected and an IBAN refused, and compares the two builders' trees at
    each, in Playwright's snapshot and in Chromium's own tree. Its first
    run stopped in the one-pane layout at the bill selected, for every
    starter but the invoice: the outline shown from the toolbar put the
    keyboard on a row, which selected it, so the report's own properties,
    and Add QR-bill, were not shown; the walk now goes back to them first.
    The whole gate then passed on 21 October 2026, 3,402 checks in 708 s,
    on Windows 11 Pro, an Intel i9-10900K and Node 24.21.0, in Chromium as
    `scripts/browsers.mjs` launches it; the README's pictures' check
    found the studio-react picture's Builder part holding the report's new
    Add QR-bill, below what the picture shows; retaken by its script, its
    record changed and its image did not. The band's click was added after
    review: its first run failed in Angular at every pass of the journey,
    not at the band but at the row after it, whose selection was read at
    once after the properties' Report had given the report back, before
    zoneless Angular drew the row selected again; the check now waits for
    the row selected, found by role. The band's check failed in both
    builders with the band made to take no pointer event, and passed as
    built. The whole gate then passed on 22 October 2026, 3,418 checks in
    651 s, on the same machine and Chromium, and the pictures' check found
    every scene as recorded.
  - **From outside.** The install gate draws each packed builder a fourth
    time, over an editor that added a bill and its debtor, and
    `scripts/install-fixture/structure.ts` holds the bill's row after the
    regions' rows, its band selected, and each group of fields named,
    holding its rows and its button, to the core's README: watched failing
    in all four hosts with the band's check turned round. Its Node
    consumer, a host's code type-checked against the packed types, failed
    at first with TS2339 where it read `selection.id`, the cost below, and
    narrows the selection now. It reads `report-builder.css` with the parts
    it imports from the tarball, and names a part the tarball does not
    hold: its reading, run on the packed tarball with `styles/canvas.css`
    taken out, failed naming it.
  - **Not held by anything here.** That a person reads the warning, that
    an IBAN typed is the creditor's, or that a QR reference typed is one
    the creditor's bank and books know.

## Context

0022 put a Swiss QR-bill at the report's own level and said plainly that
nothing edits it in the builders: the design view drew where its slip
prints, its diagnostics were listed as the report's with no row to select,
and the Studio's invoice starter's bill could be changed only as JSON. Its
registry test held every command to keeping the very same bill.

The maintainer asked for 0.3.0 to edit a QR-bill or an e-invoice in the
builders ("yes, and start 0.3.0", choosing "More invoice formats"), and
accepted the plan's answer to how a bill is added from nothing (INV-Q9): SIX's
example values and a warning that they are examples, an e-invoice edited
only. This record is the QR-bill's half; the e-invoice's is the next.

The forces:
- **A part is no component.** It stands in no region, has one place, at
  the foot of the last page, and a report holds one. The editor's
  selection, its outline and its properties knew only components and a
  table's columns.
- **A bill is about twenty fields**, each a text of runs, read in the
  report's scope; its debtor is optional, and SIX's rules need every
  required text, so a bill of blank texts is refused.
- **The IBAN is a payment target**: the most consequential edit a person
  can make, and a command descriptor is what a proposal carries (plan 16).
- **The account is shared in an e-invoice**: a bill printed with one pays
  BT-84 (0027), and each edit is validated whole (0008), so changing the
  bill's IBAN alone is refused.

## Decision

**report-core edits the bill by three commands**, in `commands/payment-part.ts`:
- `putPaymentPart(report, part)`, the bill whole, added or in place of one;
- `updatePaymentPart(report, patch)`, its properties but never its kind,
  `null` removing an optional one;
- `removePaymentPart(report)`.

Each is in `COMMANDS` and `ARGUMENTS`, and none judges the bill: SIX's
rules are report-spec's, which the session asks. The registry names them
in `PART_COMMANDS.paymentPart`, the commands that may change each part of
the report's own level, with `replaceDocument` -- a paste, an import, a
proposal that rewrote the report, whose document may hold another bill --
which is `eInvoice`'s list alone; every other command keeps the very bill
it found, which the registry test holds, reading the lists.

**The editor selects a part of the report's own level as it does a
component.**
- `Selection` is a component, a table's column, or `{ part: 'paymentPart' }`
  (`REPORT_LEVEL_PARTS`, which the e-invoice joins). A part that is none of
  them, from a caller tsc never saw, is refused as `not-found`, to select
  and to add, before anything changes, as an action that is none is:
  `selection.ts` reads each part through a table over them, which a part
  added without its reading does not compile past.
- Its row, `outlineParts`, stands at the tree's top after the regions'
  groups, as the bill prints after every region, named as SIX names the
  part. Every walk takes it, last.
- Its band on the canvas is selected by a click, as a box is, the
  keyboard then on its row, and carries the bill's problem count.
- It has one place and a report has one: the moves, the place chooser and
  Duplicate say so and do nothing, and Delete removes it, in one step,
  selecting the row before it.
- A diagnostic that names no component at a path inside `/paymentPart` is
  the payment part's: counted on its row and band, listed as "Payment
  part", and followed to it.

**Its fields are a table over every term of the bill**
(`payment-part-fields.ts`), in the order its code holds them (IG 2.4, Table
8) -- the IBAN, the creditor, the amount, the currency, the debtor, the
reference, the message and the billing information -- then the language of
the slip's headings, the one term no element of the code. A term added to
`SwissQrBill` without its fields does not compile.
- Each text is edited run by run as an EPC code's is, through the same
  `codeTextFields` and `optionalCodeTextFields`, one line each.
- A party is a group of its address's parts, each named after the party
  ("Creditor's town"), so that every name is unique in the form.
- The debtor is an optional group: Remove debtor takes it away, and Add
  debtor puts SIX's first example's debtor, Simon Muster of Seldwyla, in
  its place, one step each.
- The languages are named by Intl in the editor's language.

**An IBAN of the other kind takes the reference with it.** SIX pays a
QR-IBAN with a QR reference and nothing else, and an IBAN never with one
(IG Table 8, Tp), and each edit is validated whole, so an IBAN of the
other kind typed alone would be refused whichever field came first, and a
bill added from nothing, an IBAN without a reference, could never pay a
QR-IBAN. The IBAN's edit is one `updatePaymentPart` of the account and the
reference wherever report-spec's `qrBillPairing` says the account typed
breaks with the reference the bill holds (`payment-part.ts`): a QR-IBAN
gives the bill SIX's first example's QR reference, report-spec's
`QR_BILL_EXAMPLE`, warned of until it is the creditor's own; an IBAN takes
a QR reference away. The step is "Change IBAN", one undo gives back both,
and the live region says which it did. A reference the data gives, or an
account that is no account yet, is left for the validator and the render
to judge; the currency is not changed, so a QR-IBAN in a bill in euro is
refused still, in the currency's rule, on the IBAN's field.

**A group of fields is a new piece of the properties**: the panel's `rows`
are its fields, each by itself or in a group, with the group's one button,
decided in the model so that neither builder works out where a group
begins. Both builders draw a group as a `group` named in the editor's
words, its name drawn and hidden from the tree, and its button after its
fields, keeping the keyboard where it is as its words change.

**A bill added from nothing is SIX's example.** The report's own properties
offer Add QR-bill where the report has none. The bill is SIX's third example
(IG 2.4, Table 19): its IBAN, the "Muster Stiftung (sample foundation)" of
Bern as its creditor, no amount, no debtor, no reference; its headings in
the report's language where SIX prints in it, else English. The add is one
step, selects the bill, says what it put in and what to give, and leaves the
keyboard on the IBAN, where the bill's own values start. Where the report
cannot take a bill -- another page, an e-invoice, whose bill is in euro to
BT-84 -- the add is refused with report-spec's reason.

**SIX's examples are warned of.** report-spec lists the accounts of IG
2.4's Annex A as `QR_BILL_EXAMPLE_ACCOUNTS`, and what a builder puts in --
example 3's account and creditor, example 1's debtor and its QR reference
-- as `QR_BILL_EXAMPLE`, from which the builder takes them, so that what is
put in and what is warned of cannot drift apart. report-core's diagnostics
warn, as `example-payment-part`, of a bill that holds, written in the
report, one of SIX's example accounts, which pays no creditor, or the
creditor, the debtor or the reference of `QR_BILL_EXAMPLE`, which name no
one: once for the bill, on `/paymentPart`, naming each term that is an
example, so that a bill added from nothing is one problem to follow, not
one per term. A party is the example's while it has the example's parts and
no other, each as the example writes it. The warning is listed among the
problems, linked to the bill, and on no field, until each is replaced, and
the bill prints as written. The starters' bill, which pays SIX's example on
purpose, is warned of too.

**The undo labels** are the session's English sentences, each editor saying
them in its own language: "Add QR-bill", "Remove QR-bill", "Add debtor",
"Remove debtor", and "Change" and a field's name for a field's edit. The
live region names the bill in its own words -- "Deleted the QR-bill.",
"The QR-bill was not added: …" -- not by the part's label in a sentence
made for a component, whose French participle agrees with a masculine name
where the part's, "Section paiement", is feminine; for the same reason the
French editor says a changed field as "Modification : …", which has no
participle to agree with a field's name, many of which are feminine.

**What the builder does to guard the IBAN, and what it does not.** It shows
report-spec's refusal on the field typed in, in its words, and changes
nothing: an IBAN of another country than Switzerland or Liechtenstein, of
the wrong length, or whose check digits do not match; a QR-IBAN in a bill
in euro; in an e-invoice, an account apart from BT-84. An IBAN of the other
kind than the reference takes the reference with it, as above, and says
so. The live region says the IBAN changed, undo takes it back, the Preview
prints it, and an example account is warned of. It asks no
confirmation of a changed IBAN, and the concept does not ask for one: no
edit in these builders is confirmed, since every edit is one command, one
undo step, refused whole or made whole and announced (0008, 0012);
a dialog would be the first modal step in both frameworks for one field,
which INV-Q9 declined for the same reason, and it would ask the person to
type again what they typed. What a confirmation could catch -- a slip of the
hand -- is what the check digits catch: ISO 7064's MOD 97-10, which an IBAN
uses, is made to find every single character mistyped and every two
neighbours swapped, a design the tests here rely on and do not prove. What
neither catches is a valid account of someone else's, typed on purpose or
pasted: whether a person may change whom a bill pays is the host's, through
who it lets edit the report, and when proposals arrive (plan 16, R17 and
R18) their review is to show a change of a bill's account above every other
change, or refuse such a command in a proposal. That review is not built.

**In a report with an e-invoice** the bill's account must be BT-84, so an
edit of either alone is refused, here on the bill's IBAN field in the
validator's words. One edit that changes both is the e-invoice's editing,
which comes with it.

**The stylesheet is split.** `report-builder.css` reached the 600-line
budget, and its rules move, the same rules in the same order, into
`styles/` -- the editor's frame, the outline, the design view, placing, the
properties and the problems -- which the entry imports by relative path and
the package publishes beside it. Its export's name does not change. Every
guard that read it as one text reads it with its imports resolved: the
core's `css.test.ts`, the Studio's `styles.test.tsx` and `gate-page.mjs`,
and the install gate's consumer, which reads the parts from the tarball and
names a part it does not hold.

## Consequences

**What it buys.**
- **The bill edited where it is shown**, by keyboard and by pointer, in
  both builders, in three languages, every edit refused where SIX's rules
  refuse it and undone in one step.
- **One way to edit it**: the three commands a builder sends are the ones a
  proposal names, and the registry says which commands may change the
  bill, `replaceDocument` among them, so a review can find every change of
  whom a bill pays by its command, comparing the bill whole for a
  replacement.
- **A bill's problems where the bill is**, on its row and its band, rather
  than the report's.
- **A bill never added blank**, and one that holds SIX's examples said so
  until each is replaced.

**What it costs.**
- **The starters open with a warning.** The invoice starter and its three
  samples, whose bills pay SIX's example QR-IBAN on purpose, open with
  `example-payment-part` in the problems, where 0022's, 0024's and
  0032's tests held them to none; those tests now admit that warning
  alone, on the bill, for a report with a bill. The Studio's invoice
  shows "Problems 1".
- **Only a written example is warned of**, the accounts SIX's four and the
  parties and the reference only the ones a builder puts in: a text read
  from the data is known at the render alone, and an account that pays no
  creditor for another reason, an example of another edition of SIX's
  guidelines, another of SIX's example parties or references typed by
  hand, and an example party with one part changed are not. The warning
  goes once the account is none of SIX's, which is not to say it is the
  creditor's.
- **The warning is on no field.** A field has one error, which a builder
  draws as invalid; a warning there would mark a valid account invalid. It
  is among the problems, on the bill, and following it selects the bill.
- **An IBAN of the other kind changes the reference too.** A QR-IBAN typed
  over a creditor reference replaces it with SIX's example, and an IBAN
  typed over a QR reference removes it: what was in the reference is gone
  until undo, which the live region says rather than asks. The currency is
  not changed with it: a bill in euro is made a bill in francs before it
  pays a QR-IBAN.
- **`Selection` is a union.** A host's code that read `selection.id`
  reads it of a `ComponentSelection` now, a change to the published types
  of a 0.x package.
- **Every report without a bill offers Add QR-bill**, a report that cannot
  take one among them -- a Letter page, a landscape one, an e-invoice --
  where it is refused when pressed, in report-spec's words, rather than
  offered as unavailable.
- **An e-invoice's bill cannot have its account changed** until the
  e-invoice is edited: the IBAN alone is refused.
- **What the fields do not edit**: a run added to or removed from a text,
  a text's literal run made a binding or a binding a literal, and a
  reference's type, which is read from its text. A debtor bound to the
  data, as the starter's is, removed and added again comes back as SIX's
  example in literal text, and only undo binds it again.
- **A name that can repeat**: a text that prints "Payment part" names its
  row and box as the bill's row and band are named.
- **The Preview's refusal of a bill names no row.** A runtime refusal at
  `/paymentPart` has no component, and the Studio's Preview offers a
  "Select …" for a component alone.
- **More published types and hooks**: `REPORT_LEVEL_PARTS`,
  `ComponentSelection`, `OutlinePart`, `PropertyRow`, `PropertyGroup`,
  `PropertyAction`, three actions, the state's `outlineParts` and the
  `property-group` hook; report-core's three commands, `PART_COMMANDS`,
  `PaymentPartPatch` and a diagnostic code; report-spec's
  `QR_BILL_EXAMPLE_ACCOUNTS`.
- **A stylesheet in parts.** A bundler inlines the parts, as Vite, esbuild
  and the Angular CLI do; a page that links the entry as it stands asks the
  browser for each part beside it, which the package publishes, and a host
  that copies the entry by hand copies `styles/` too.
- **Longer gates.** The browser gate checks the bill in each builder at
  every pass of the journey, and its parity walk two more states a starter
  in each layout; the parity test in jsdom walks seven more states a
  starter in each language. The gate's whole run took 651 s on the machine
  above on 22 October 2026; what the bill's checks add to it was not
  measured apart.
- **report-builder-core's `model.ts` is 570 lines**, near the budget, which
  the e-invoice's editing is to split by its reason to change before it
  adds to it.

**What it forecloses.** A bill as a component in a region, as 0022 does.
Nothing else that cannot be undone.

**Added 2026-10-22: the batch, listed.** [0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md) adds a batch to
the registry, several commands as one, which may hold the bill's own
three or a replacement. So `PART_COMMANDS` lists `batch` for the payment
part and for the e-invoice, beside `replaceDocument`, so that a
proposal's review, once proposals are reviewed, finds a change of whom a
bill pays inside a batch by the same names. Every other command,
`removeFieldWithReaders` among them, keeps the very bill it found: it
refuses, as `read-by-part`, a field the bill or the e-invoice reads
rather than change either. And a form version's review offers nothing
that changes what the bill prints of a field it reads -- nothing printed
of it from a version, another type, its removal -- only a rename that
reads the same answer where it moved, and says why. Both of the registry
test's halves hold the lists, and 0048's review tests the offer.

## Alternatives considered

**A dialog asking for the account and the creditor first**, INV-Q9's other
option. A bill never holds example values, but both frameworks would gain a
modal model for one action, with its focus, its Escape and its scenarios,
and the person would type into a dialog what the properties take anyway.
The example and its warning give the same order of work without it.

**A confirmation of a changed IBAN**, a dialog or the IBAN typed twice. It
asks again what the person meant, and catches nothing the check digits do
not; a redirection typed on purpose passes it. The guard against one belongs
where identity and review are, which the builder is not.

**A warning on the editor's own example alone**, example 3's account, which
the starters do not use, so that they would open clean. It would let off the
account a person starting from the starter most needs to replace, and draw
a line between SIX's examples that SIX does not.

**The warning in the live region alone**, when the bill is added. It is gone
with the next announcement and with a switch of framework, and a host that
diagnoses the report never hears it.

**A warning for each example**, the account, the creditor, the debtor and
the reference each its own. A bill added from nothing would list two
problems, each named "Warning: Payment part", that a person could not tell
apart by their names, and following either goes to the same bill.

**The account and the reference committed as one group**, their fields
kept until both are typed and then applied together, or the IBAN refused
until the reference is typed. It would be the first form in either builder
whose fields wait for an Apply, with its own focus and its own scenarios,
and it would ask the person for a QR reference before the bill pays a
QR-IBAN at all. The IBAN's edit carrying the reference asks for nothing
first, says what it did, and undo takes both back.

**The bill as a region of the outline**, a group "Payment part" holding one
row. A group of one row named as its row is read twice, a report without a
bill would show an empty group, and a row needs a component's id.

**Groups worked out by each builder**, fields carrying their group's key. Each
builder would decide where a group begins and ends, and an absent group with
no fields would have nowhere to stand: the model says it once, in `rows`.

**One generic command**, a part's property put at a path. Untyped, and a
review could not tell an account's change from a message's by the command.

**Angular's `NgTemplateOutlet`** to draw a field in a group and outside one
from one template. It is `@angular/common`'s, which is not the builder's
peer, as `host-view.ts` says; a row component, `property-row.ts`, is
`@angular/core`'s alone.
