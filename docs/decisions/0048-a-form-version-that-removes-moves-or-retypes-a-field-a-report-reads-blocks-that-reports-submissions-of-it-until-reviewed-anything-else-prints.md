# 0048 — A form version that removes, moves or retypes a field a report reads blocks that report's submissions of it until reviewed; anything else prints: compatibility judged per render, by the check 0042 makes of each version, never by a version accepted; `reviewFormVersion` in `@formancy/report-forms` compares the new version through formancy's `diffSchemas` with each version the report was made from or reviewed against, which the host hands over, and offers, as report-core commands computed against the report's hash, a rename the form's author declared first and labelled declared, which moves the binding to where the field is now and keeps every version it was handed reading where it read, a path a version the report names reads where the diff finds the same field, nothing printed from that version, another type every version reads, or the field removed with everything that reads it, never applying one, never guessing a path, and nothing that changes what the payment part or the e-invoice prints; the override per version written on the binding inside the report, keyed by the version's hash, a path or nothing; a relabel offered for the texts that still say an old label, a new field and a reused key said and never followed; report-core's batch, several commands as one, and the command that removes a field with its readers, found by the walk and the parser the compiler asks; an accepted review per version, a binding beside the report, a stored base, a rename followed by itself or for one version alone, a path guessed and a second reading of CEL lost

- **Status:** accepted; numbered while 0043 and 0044, and 0046 and 0047, were other branches'; extends [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), whose batch is one command, [0039](0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md), whose `PART_COMMANDS` lists the batch, [0042](0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md), whose binding carries the overrides and whose per-render refusal names the review, and [0045](0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md), whose draft is reviewed with no base kept and whose rule of a label no font draws a relabel is held to
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The overrides' shape.** `packages/report-spec/src/validate-form-binding.test.ts`,
    and a case for the new code, `invalid-form-override`, in
    `validate.test.ts`: a field read at another path in one version, or
    nothing of it from one, and the detail's rows from another repeater;
    nothing printed only of a field that may be null; both or neither of
    a path and nothing, `omit: false`, a path that is none, a member, and
    none at all refused; an override at the binding's own path or
    repeater accepted, the record of a version a followed rename moved
    the binding to, and part of the hash; a version named by its
    `schemaHash` alone; no override on a one-record dataset; at most
    `MAX_FORM_OVERRIDES`, and at the bound a binding; and the overrides
    in the report's hash, in no order. Written before the code, on 22
    October 2026: 10 of the 136 tests of the two files failed, and all
    passed once it was. Six rules were then broken on their own --
    nothing printed of a field never null, the own path, the own
    repeater, no overrides, a key of any spelling, the bound doubled --
    and each failed a test. The review of the same day reversed two of
    them: the case for the own path was turned to accept it, failed, and
    passed once the rule was lifted.
  - **The batch.** `packages/report-core/src/commands/batch.test.ts`: one
    undo step, one notification and its label, validated once at its
    end, refused whole with the first refusal word for word and nothing
    after it run, an invalid end refused with the validator's reasons, a
    batch in a batch refused, junk where a step should be refused and
    never thrown, a step that cannot run on what the steps before it left
    -- a document of nothing, a text of no content, a table of no columns
    -- refused and never thrown, the session left as it was, a step
    refused as its own descriptor would be, `MAX_BATCH_COMMANDS` held and
    at the bound a batch, a batch of nothing committing nothing, and the
    report given left as it was. `commands/registry.test.ts` holds it in
    both of the registry's halves: listed in `PART_COMMANDS` for the
    payment part and the e-invoice, each example changing the part -- the
    bill's language in a batch, a replacement in one -- and every other
    command keeping it. Written before the code: all 15 of its tests
    failed, as `unknown-command`. Four rules broken -- a batch in a
    batch, a step no object, the bound one higher, a refusal run past --
    each failed. The four cases of a step that throws were written at
    the review and each threw a `TypeError` before the step was guarded.
  - **The removal with readers.** `packages/report-core/src/commands/readers.test.ts`:
    the text that prints a field, the column whose value's format reads
    it, an image drawn from it inside a section, a style rule that reads
    it removed alone, the column or the table it styled kept with its
    other rules, two of one column, one found through an aggregate after
    the other, named in their order, the columns and the aggregate that read it and the text
    that prints that aggregate, a chain of aggregates to its end with an
    EPC QR code's amount and a cell read twice through two of them gone
    once, a footer row left with no cell gone whole -- its cell reading
    an aggregate of the field as the group's, or under a column that
    went -- a table every column of which goes gone whole, a table its
    own condition reads it in gone whole, a group whose header reads it
    gone with its footer's cell once, two cells of a totals row and one
    of the next each named once in order, the group by it, the sort key
    and the sort with its last, a reader found by a member, by a key in
    brackets and by a whole read, none in an expression that does not
    parse, a container removed once with what it holds, a field the
    QR-bill or the e-invoice reads refused as `read-by-part`, directly
    and through an aggregate, a column the e-invoice names refused whole
    by the session, one undo step, an undeclared field refused, and a
    field nothing reads removed alone; each removal's pointers, in
    document order. Its `fieldReaders`: the removal the command's, and,
    for every field of the sample, the e-invoice sample and the sample
    whose group header reads the group's key, at every other type and at
    its other nullability, what its expressions compiled alone add to
    the report's diagnostics what the whole report compiled adds;
    `expressions/compile-report.test.ts` holds `compileReport` asked for
    some expressions to them and every aggregate's. `outcome.test.ts`
    gives `read-by-part` its case. Written before the code: the file
    could not load. Nine rules broken -- a table of no columns kept, no
    chain, the QR-bill let through, a group kept for its key, a cell
    held twice, a whole read not a reader, a container's child removed
    again, the sort kept empty, a sort key named at the wrong place by
    the walk -- each failed; the table's and the cell's were in the code
    before a case held them, and each gained its case and failed it. At
    the review four cases changed -- the rule, the chain, the row, the
    group's footer -- and failed before the code did; then the rules'
    order, the group's key left out of what a change reaches, the chain left out of it,
    every aggregate left out of a part compiled, a rule taking its
    holder, a row left empty and an aggregate read as `group.<id>` no
    reader were broken one at a time, and each failed a test.
  - **The per-render check, overridden.** `packages/report-forms/src/overrides.test.ts`:
    a field read where an override says, in that version alone; nothing
    of it from a version, in a report of one submission and of many; the
    detail's rows from the repeater an override names; no override of
    another version followed; every refusal of a field or a repeater
    naming the version's hash and `reviewFormVersion`; and a field of
    the rows refused naming the rows its version's override reads.
    Written before the code: all four failed. Five rules broken -- an
    override ignored, nothing printed read, a repeater's override
    ignored, another version's override followed, the review unnamed --
    each failed; at the review, the rows named by the binding's own
    repeater, and the repeater's refusal promising a resolution other
    than a rename, each failed one.
  - **Where a rename moved a field.** `packages/report-forms/src/review-moves.test.ts`:
    the corpus's version 3, whose renamed group takes its name and
    licence with it though the diff reports the group alone; nothing
    moved that the form did not declare; a renamed repeater's rows'
    fields; and, by fast-check, 500 models of groups, repeaters and
    pages whose fields are kept, renamed or removed and new ones added, every move
    held to `diffSchemas` itself -- from a path the old version held to
    one the new holds, neither a removal nor an addition of the diff's,
    every `field.renamed` a move, every path the diff did not remove in
    the new version where it was or where a move took it. Written before
    the code: the file could not load. A group's rename not carried and
    an added field taken for a move each failed it.
  - **The review.** `packages/report-forms/src/review.test.ts`: a version
    that changed nothing printed compatible, the report's own version
    too; a field added said, in its scope, and never added, a static
    text not said; a declared rename blocked, offered first, labelled
    declared, followed only when applied, and the old version read where
    it was; a renamed group followed to the field beneath; a key changed
    without `renamedFrom` never taken for the field of that key
    elsewhere; the detail's repeater followed; a rename read from the
    version an override reads; a rename that would not lift the refusal
    alone not offered; a removed field printed nothing of from that
    version or removed with what it takes listed; a field made nullable
    where nothing of it prints, said; nothing offered the compiler would
    refuse -- a decimal compared with `==`, a count appended to text
    retyped a number; a version reviewed with nothing printed from it
    compatible; each type every version reads offered, none that one
    does not, and a retype from text saying which versions it refuses
    words of; an option or a matrix row a field reads, removed, named as
    the diff names it; the detail's repeater removed or made a group
    offered nothing, and saying so, as its refusal does; a relabel
    offered for each text that says an old label before the field's own
    value and for the heading over its column, no other column's,
    applied by none, none for a label the report cannot hold, no text
    says any more, or holding a direction control, and an option's own
    label for an option, and a label the catalogue changed said as a
    text changed; a stale resolution refused, a tampered one refused
    whole, each applied as one undo step; a report of one row per
    submission reviewed as one of one; a report that names no version
    offered no rename and named no change; nothing that changes what the
    QR-bill or the e-invoice reads offered, and saying so, a declared
    rename of a field the bill reads offered; no removal the session
    would refuse offered -- of a field whose column the e-invoice names --
    which failed with the validator's verdict ignored; a version that names its
    form by another id said; a review blocked where one item blocks; a
    missing version refused by its hash, the version an override of the
    detail's repeater names among them; more versions than a read is
    handed forms refused; a report, a version, a binding or versions
    that are none refused; and no label of either version in anything it
    says, a relabel's among it. Written before the code: the file could
    not load. Its first implementation failed one case -- a field a
    declared rename moved from an override's version said added -- and
    was changed. Then 17 rules were broken on their own -- a rename
    guessed by name, not labelled declared, offered last, an offer the
    compiler or the session refuses, a moved field said added, a static
    text said, review called compatible, an override's version not
    compared, a missing version passed, a relabel of another field's
    line, an option relabelled by its field's label, a retype an earlier
    or the new version does not read, a stale hash, a removal that says
    nothing of what it takes, a repeater not followed -- and each failed
    a test but one, a retype the new version does not read, which gained
    a text turned date and failed it. Coverage then showed paths no case
    reached; their cases were written after the code, and four more
    rules broken against them -- a page scoping its fields in the moves,
    a report of many read as a repeater's, a field nothing prints of
    from the version reviewed as read, a label no font draws relabelled
    -- each failed. Two of the readers' paths, a table's own condition
    and a group's footer, were added the same way.
  - **The versions after a review.** `packages/report-forms/src/review-later.test.ts`:
    a version after a followed rename, its `renamedFrom` kept or
    dropped, printing unreviewed and its review compatible; the
    binding's own path moved and the versions known named where they
    read it; a key the rename vacated, reused by a later version, not
    read, and said added; the detail's rows of a later version that kept
    the renamed repeater printed; a version handed over kept reading
    where it read; one not handed over offered the path, or the
    repeater, the version the report was made from reads, not labelled
    declared, and nothing where the diff finds another field there; and
    a field a version gave back after one the report printed nothing of
    it from said, offered nothing printed or its removal, never a
    relabel; and a version handed over that already holds the field
    where the rename put it read there, one that holds it nowhere kept
    refused at the old path. Written at the review of 22 October 2026, before the code:
    five of its cases failed against the binding left where it was, and
    three more, the diff's say, the baseline's repeater and a later
    version handed over, were written after it, the last failing until
    the versions kept were chosen by what each holds. The review's 37
    rules -- the versions known not kept, a later one held to the old
    path, one holding the field nowhere let go, the binding not moved,
    the version reviewed not named, the repeater's versions not kept,
    the payment part unnamed, let through or unsaid,
    no compile asked of a nothing printed, of one never null or of a
    retype, no path a baseline reads offered, one offered whatever the
    diff says, no repeater a baseline reads offered, a retype's cost
    unsaid, a rename offered that lifts nothing, a reused key unsaid, a
    repeater's item and its refusal promising more, a relabel quoting
    its label, an offered path or a printed one said added, an id
    changed unsaid, blocked only where every item blocks, the versions
    unbounded, the generator's refusal naming the review, a direction
    control or a separator drawn, no column relabelled or any column of
    the label, a row's refusal naming the binding's repeater, and
    report-core's five above -- were then broken one at a time, each
    file put back byte for byte, and each failed a test.
  - **On the PDF (0003).** `packages/report-forms/src/review-pdf.test.ts`:
    the corpus's version-3 visit refused by the starter made from
    version 2, both fields named; the review blocked, each field's
    declared rename first; each applied through a session against the
    hash it was computed for; the review then compatible; and the same
    visit resolved and rendered, read back with PDF.js and the corpus's
    `verify`, printing `Name: Lea Gerber` and `Ausweis: BE-6203` from the
    technician's group, its manifest naming version 3, and a version-2
    visit still printing its inspector. Watched failing with the rename
    not labelled declared.
  - **The fixture.** `packages/report-corpus/src/forms/site-visit.test.ts`:
    version 3 is version 2 with the inspector's group renamed, declared,
    and nothing else, and its visit answers it alone. Failed before it
    existed.
  - **The install gate.** `scripts/install-fixture/forms.ts`, in the Node
    host: the packed bridge refuses a version that renamed the draft's
    group, naming the review; reviews it against the version the draft
    was made from; the packed report-core's session takes the declared
    rename against its hash; the version's visit then reads; and the
    same resolution is stale. The package README's "Review a new form
    version" is its lines (`scripts/readme-example.test.mjs`, watched
    failing before the section was written).

## Context

Plan item R12 asks that a report refuse a submission whose form version
moved or retyped a field it prints, until its author reviews the change,
and that the review be one undo step (plan 12.3, 13.2's "compatible,
review required or blocked"). 0042 gave every render the refusal: a
field the version lacks, holds elsewhere or retypes refuses every
submission of that version, naming the field and the hash. Nothing lifted
it but the report changed by hand, and a change by hand that read the
new path broke every old version's submissions.

What there was:

- **formancy's `diffSchemas(before, after)`** classifies every change by
  data path and cost: `field.added`, `field.removed`, `field.renamed` --
  only a rename declared with `renamedFrom` -- `field.typeChanged`,
  `field.relabelled`, options, constraints, the form's id and a
  catch-all, each with a `detail` in English that quotes labels and
  values. A rename of a group carries its children, and the diff reports
  the group alone (formancy.ai 0108). A field at the same data path, the
  diff reporting nothing there, is the same field.
- **A version is a document the host keeps** (0042): formancy 0.7.0's
  server serves the current version's schema alone.
- **report-core changes a report through commands**, a session commits
  only what the validator accepts, and an edit carries the hash it was
  made against, refused as stale once that is not the session's (0008).
  A transaction is several commands as one undo step, but only as code: a
  descriptor is one command.
- **What an expression reads is the compiler's to say**: report-core's
  diagnostics already ask the parser the compiler asks for the paths an
  expression reads (`unused.ts`), and the walk that finds every field
  named outside one is the diagnostics' (`parts.ts`).
- **The plan's stage C answered the questions this turns on**, and the
  user accepted the plan's recommendations: the binding inside the
  report, on the dataset contract (FB-Q4); no review for every version,
  only one that moves, retypes or removes a printed field blocking
  (FB-Q5); no stored generated base, relabels offered (FB-Q6); "no
  automatic rebind after a rename" (plan 13.6); "a harmless additional
  column does not automatically appear" (plan 12.3).

## Decision

**Compatibility is judged per render, as 0042 judges it.** A version
blocks a report only where the per-render check refuses it: a field the
report reads, or the detail's repeater, that the version removed, moved
or retyped from where the binding reads it. Every other version prints,
reviewed or not (FB-Q5), a version after a followed rename that keeps
the field where the rename put it among them. The check is unchanged but
for three things: it reads a binding's override for the version it is
reading; its refusal of a field says what lifts it, `reviewFormVersion`,
a review of that version, where anything does; and its refusal of the
detail's repeater says that a review offers nothing but a rename of it.

**The override is the report's** (FB-Q4), on the binding: `form: { path,
member?, read?, overrides?: { [schemaHash]: { path } | { omit: true } }
}` for a field, and `{ kind: 'repeater', repeater, overrides?: {
[schemaHash]: { repeater } } }` for the detail. A version named there is
read at the override's path, or nothing of the field prints from it,
which needs the field nullable; every version it does not name reads the
binding's own path. An override may read that own path: it names the
version a followed rename moved the binding to. report-spec holds the
shape and only the shape: a key that is no hash (`invalid-digest`), both
or neither of a path and nothing, nothing printed of a field never null
(`invalid-form-override`), none at all (`too-few`) and more than
`MAX_FORM_OVERRIDES` (`too-many`) refused. The overrides are a map by
hash, so the report's hash says which versions it was reviewed against,
in no order.

**`reviewFormVersion(report, { form, formHash?, versions })`** reads the
new version as a read does and compares it, through `diffSchemas`, with
each version the report names -- its provenance's, and each its
overrides name -- which the host hands over; one missing is refused as
`missing-version`, by its hash. Any other version the host keeps is
compared with nothing and kept reading where it read when a rename is
followed. At most `MAX_DETAIL_ROWS` versions are read, as many as
`readSubmissions` is handed forms. It returns `{ status, formHash,
reportHash, items }`: `blocked` where an item blocks, `review` where
items print as they are, `compatible` where there is none (plan 13.2).
Each item names the report's dataset and field by its id, what the
version did as the diff names it, whether it blocks and with what code,
and never a label, an option or an answer: the diff's own `detail`
quotes them, and is not passed on. Its resolutions, in order:

- **`follow-rename`, first, labelled `declared`**, where the form's
  author declared a rename of the field, or of a group or repeater
  holding it, from where a baseline reads it, offered where that alone
  lifts the refusal. It moves the binding's own path to where the
  version holds the field, names that version reading it there, and
  names every other version it was handed reading the old path -- but
  one that already holds the field where the rename put it, as the diff
  from it finds, which reads it there too: every version it knows reads
  as it did or as the reviewed one does, one that holds the field at
  neither path stays refused, and a later version that keeps the field
  there prints without a review. The moves are read from
  the diff, which decides which renames it accepts, and the paths beneath
  a renamed container translated as the diff translates them, by the key
  each had before; a property test holds the translation to the diff
  (`review-moves.ts`). **A path is never guessed from a name**: a key
  changed without `renamedFrom` is a removal and an addition, and a field
  of the same key elsewhere is not taken for it.
- **`follow-reviewed`**, not labelled declared: a path a baseline reads
  the field at, where the diff from it finds the same field in the new
  version -- nothing added, removed, renamed or retyped there, nothing
  moved away -- read there in that version alone. It is what a version
  the review that moved the binding was not handed is offered: one
  between two the report names, still holding the field where the
  version the report was made from does.
- **`print-nothing`**: an override printing nothing of the field from
  that version, the field declared nullable where it was not, and said.
- **`retype`**: each type every version the report reads the field from,
  the new one among them, holds it as, by `KINDS`. A version that holds
  it as text, read as a number where it spells one, prints its words
  today: the resolution names it, and says its submissions are refused
  where the answer spells no number.
- **`remove`**: the field removed with everything that reads it, what it
  takes listed by pointers into the report.

**A field the payment part or the e-invoice reads**, directly or through
an aggregate, is offered a rename, declared or reviewed, and nothing
else: printing nothing of it, another type or its removal would change
whom a bill names, what it asks for, or what an invoice says is due,
under another command's name (0039), so the item says the part reads it,
which only its own commands change. **The detail's repeater**, which the
version removed or holds as another kind, is offered its declared
rename, the same way, or the repeater a baseline reads the rows from
where the diff finds it unchanged, and nothing else, which the item
says.

And for a field that prints, **`relabel`**: where the version labels it
otherwise in the report's locale and a text still says a baseline's
label -- the field's own label, a line's label run before the run that
prints it, written as the generator writes one, a column's heading over
it -- a batch saying the new label in each, what prints the field being
what the compiler says an expression reads (FB-Q6). A label is held to
0045's rule of what no font draws, a direction control and a line or
paragraph separator among it now. **A field that prints from a field
the diff calls added** since a baseline the report printed nothing of it
from, or refused it in -- a key that version vacated and this one reused,
or gave back -- is an item that blocks nothing, offered nothing printed
from the version or the field's removal, and no relabel. **A field the
version added** is an item with no resolution: said, in the scope of a
dataset the report reads, as the diff from a baseline calls it, unless
the report reads it, a rename moved it there or a resolution would read
it; and never added (plan 12.3). **A version that names its form by
another id**, which formancy calls a lossy change, is an item that
blocks nothing: it may be another form.

**Nothing is applied.** Each resolution is a report-core command
descriptor and the `reportHash` it was computed against: a host applies
it through a session with that hash as `expectedHash`, so a stale one is
refused, and the session validates its end, so an invalid one is refused
whole (0008). A resolution is offered only where the session takes it
and, where it changes a field's type or whether it may be null, it leaves
no expression the compiler refuses that it did not refuse before; the
review asks `tryEdit` and `compileReport`, never a rule of its own -- the
compiler over the expressions report-core's `fieldReaders` says such a
change reaches, each compiled once as the report stands. A removal is
validated, not compiled: every reader goes with the field.

**A batch is one command** (extending 0008): `batch(report, steps)`, a
descriptor `{ command: 'batch', args: [steps] }`, runs its steps one after
the other and gives the report the last leaves, which the session
validates once, or the first refusal, word for word, nothing after it
run: a transaction written down. A step that is no descriptor, or a
batch, is refused as `invalid-arguments`, and so is a batch of more than
`MAX_BATCH_COMMANDS`, 1,000, chosen, before any of it runs; and so is a
step that throws on the report the steps before it left, which no
validator has seen. A batch may hold any command, so `PART_COMMANDS`
lists it for the payment part and the e-invoice, as it lists
`replaceDocument` (extending 0039).

**`removeFieldWithReaders(report, role, id)`** removes a field with every
component, column, style rule, footer cell, sort key, group and aggregate
that reads it, and every reader of such an aggregate, to the end of the
chain; a footer row left with no cell, whole; a table every column of
which goes, whole; what stands in a component that goes, with it, once.
What reads a field is the diagnostics' walk, which now records where it
names each field and aggregate (`parts.ts`'s `named`), and, in an
expression, what the parser the compiler asks says it reads, through the
one function `unused.ts` now asks too (`expressions/reads.ts`). Each
reader goes with what holds it: a component for its content or its
condition; a column for its value or its condition; a style rule alone,
since a rule says how something prints, never what; a group for its key
or header. A field the payment part or the e-invoice reads, directly or
through an aggregate, is refused as `read-by-part`: their own commands
change them (0039). Its outcome lists what went, as pointers.
`fieldReaders(report)` is the same walk and one reading of every
expression, kept for many fields: the removal, and the expressions a
change of a field's type reaches -- each that reads it, each that reads
an aggregate that does, in turn, and, for a field a table is grouped by,
each that reads the group's key -- which `compileReport(report, them)`
compiles alone, with every aggregate's.

## Consequences

**What it buys.**
- **A form moves on, and the report keeps printing what it can.** A
  version that touched nothing printed prints; one that moved a printed
  field is refused by name until its author decides; once a rename is
  followed, the versions after it that keep the field there print
  unreviewed, and every version the review was handed goes on printing
  as it did.
- **A rename the form's author declared costs one click**, and no path is
  ever followed that nobody declared or the diff did not vouch for: an
  answer cannot print under another field's label by a guess.
- **One undo step for any resolution**, in either builder and on a
  server alike: a resolution is data, computed once, applied by the
  session every edit goes through.
- **The report says which versions it was reviewed against**, by its
  hash: a published template carries its reviews (R14), and an undo in
  the editor takes the review back with what it changed.
- **One reading of each thing.** What changed is formancy's diff; what
  blocks is 0042's check; what is valid is the validator's; what an
  expression reads is the parser the compiler asks; what a kind reads
  as is `KINDS`. The review adds no rule of its own to any of them.

**What it costs.**
- **The host hands over every version the report names.** A review needs
  the version the report was made from and each its overrides name; one
  missing is refused, so a host that did not keep a version cannot
  review against it. A version it keeps and does not hand over when a
  rename is followed, one that printed at the old path, is refused once
  the binding moves, until its own review offers the path the version
  the report was made from reads.
- **A version blocks until someone applies a resolution.** Nothing is
  followed by itself, a declared rename included: the version's
  submissions are refused until the author, or a host acting for one,
  applies it.
- **A field removed from the form blocks every later version.** Printing
  nothing of it names one version, so each later version that lacks it
  too is refused until reviewed in turn, or the field is removed from
  the report.
- **A rename that does not lift the refusal alone is not offered.** A
  field renamed and retyped in one version is offered printing nothing,
  a type, or its removal; following the rename first is the author's to
  do by hand.
- **A field the payment part or the e-invoice reads is offered a rename
  and nothing else.** A version that removed or retyped one blocks with
  nothing on offer until the part is changed by its own commands to read
  something else, and the item says so.
- **The detail's repeater removed or retyped is offered nothing** but a
  rename of it, declared or reviewed: printing none of its rows from a
  version, or removing the detail, is the author's to do.
- **Printing nothing makes a field nullable**, which an expression reads
  as `dyn` (0009); where that would leave an expression the compiler
  refuses -- a decimal compared with `==` -- it is not offered, and the
  removal is.
- **A retype is judged by kind, never by answers.** A version that holds
  the field as text, retyped to a number, refuses each of its
  submissions whose answer spells none, `invalid-answer`; the
  resolution names those versions, and the review cannot see which
  submissions those are.
- **A key a version vacated and a later one reused is read as the
  field.** The per-render check reads a field wherever the binding's
  path finds one of a kind it reads: a key a version removed the field
  from, never reviewed, and a later version reused for another field,
  prints that field's answers as the report's. The review says so only
  against a version the report names that printed nothing of the
  field there.
- **A review knows no order of versions.** Where the versions it compares
  with disagree on what stands at a path -- one's diff finding the field,
  another's a new one -- it says what each says, and the author decides.
- **A relabel is found by exact words.** A text that says the old label
  -- the field's own, a line's label run before the run that prints the
  field, as the generator writes one, or a column's heading over it --
  is offered the new one; a label written otherwise, reworded or inside
  a sentence is not found, and a label a version the report names
  nowhere gave the field is not seen; nor is a member field's composite
  label of a matrix row, "Zustand: Sicherheit".
- **A relabel the format cannot hold is not offered**, a field's label
  or a heading past `MAX_LABEL_LENGTH` among it, and the item says only
  that the form labels the field otherwise.
- **A removal takes more than the field.** Every component, column,
  rule, cell, sort key, group and aggregate that reads it goes, a footer
  row of no cell left and a table of no column left whole, a section a
  condition of which reads it with all it holds; the resolution lists
  them before anyone applies it. A field the QR-bill or the e-invoice
  reads is never removed this way.
- **A new field is said and nothing more.** It reaches the report only
  when an author places it; a matrix row or an option a version adds to
  a field the report reads is not said, the diff naming it at its
  field's path.
- **A field made optional is not said.** A version that no longer
  requires a field the report declares never null, or hides it by a
  rule, blocks nothing and prints until a final render meets a
  submission that left it out, which refuses as `unexpected-null` (0042).
- **Overrides accumulate.** Each version reviewed is named, and a
  followed rename names each version it was handed that read the old
  path, up to 64 for a field or the detail; past that the session
  refuses the binding, the rename is not offered, and the report is
  better started again from the form (0045).
- **Bounded, measured.** A review of the corpus's starter against
  version 3 took 7 to 11 ms; of a draft of 64 fields against a version
  that removed every one 75 to 83 ms, renamed every one, declared, 108
  to 118 ms and relabelled every one 39 to 44 ms; and a batch of 1,000
  commands, applied by a session to that draft and undone, 2 to 3 ms:
  runs two to six of six. At the format's bounds -- 2,500 components,
  500 a region, each reading eight of 64 header fields in its value and
  two in its condition, and 64 detail fields -- against a version that
  removed every field, a review took 6.4 to 6.6 s where every field may
  be null, and 49 to 50 s where none may, each nothing printed then
  compiled over every expression its field reaches: runs two and three
  of three. From the built packages, Node 24.21.0, an Intel i9-10900K,
  22 October 2026 at 09:22 to 09:25 UTC, the processor at 1 % load
  from other workflows before and 11 % after. Before the review compiled
  only what a change reaches, a review of 146 components took 38.1 s
  and one at the bounds did not finish in ten minutes, measured by the
  review the same morning.

**What it forecloses.** A version accepted by itself, a rename followed
by itself, a path found by likeness, a review whose resolution is a
callback rather than data, and a binding that lives beside the report.

## Alternatives considered

**An accepted review for every version (FB-Q5 (b)).** A version prints
only once a review accepted it, even an empty one. Stricter. Rejected:
it costs a review per form release that hosts would automate into the
per-render rule anyway, and plan 12.3 asks that a change block "affected
reports", not every one.

**The binding beside the report, a `FormBinding` the host keeps (FB-Q4
(b)).** The template's hash would survive a review. Rejected, as 0042
rejected it: an undo in the editor could leave the binding saying what
the report no longer does, and a published template would not say which
versions it was reviewed against.

**Follow a declared rename by itself.** The rename costs the data nothing
by formancy's own account. Rejected by plan 13.6, "no automatic rebind
after a rename": the report is the author's document, and a review that
changed it unseen is a change nobody approved; offered first and
labelled, it is one click.

**Match a field moved without a declared rename by its key or its
label.** Rejected: formancy reports it as a removal and an addition for
the reason this one would be wrong -- a guess that moves one field's
answers into another's, under its label.

**Follow a rename for the one version reviewed, the binding left where
it was.** This record's first answer: one override for one review, and
the binding's own path the one the report was made from. Rejected at its
review: every later version that kept the field where the rename put it
was refused until reviewed in turn, one review per release, the cost
FB-Q5 (a) was chosen to avoid; and a key the rename vacated, reused by a
later version for another field, printed that field's answers as the
report's with no review ever asked for. Moving the binding costs an
override for each version it knows that does not hold the field where
the rename put it, which this answer had held to be the larger cost; it is the smaller, since a form's
later versions are its many and its earlier ones are known.

**Carry a reviewed path forward per render.** The check would read a
field where the latest review put it. Rejected: the check knows each
version by its hash alone, never which came after which.

**Refuse an override at the binding's own path.** One reading, one
spelling. Rejected: the version a followed rename moved the binding to
would go unnamed, and the next rename of the field, declared from it,
could not be seen.

**Offer printing nothing, another type or a removal of a field the
payment part reads, marked as touching it.** Rejected: the part changes
by its own commands alone (0039), and a mark a host may not show would
change what a bill asks for under another name.

**Refuse a version whose form's id is not the provenance's.** Rejected:
formancy lets a version change its form's id, a lossy change by its own
diff, and the per-render check does not ask; the review says it.

**Compile the whole report for every resolution.** Rejected at the
review: at the format's bounds a review did not finish in ten minutes,
the compiler asked once for each resolution, where a change of one
field's type reaches only what reads it.

**Refuse every format character in a label, `\p{Cf}`.** Rejected: a soft
hyphen, and the joiners Persian and the Indic scripts need, are format
characters too, and whether Roboto draws one is the renderer's to say;
the direction controls and the separators, which no font draws and which
reorder or break what a builder shows, are refused.

**A stored generated base, merged three ways (FB-Q6 (b), (c)).** Rejected
by 0045: a second document to keep in step, and conflicts a person
resolves anyway. The relabel offered is that merge's one useful case.

**A review as a session method, or callbacks a builder runs.** Rejected:
a resolution must travel from a server to a browser, and back from an
AI's proposal (R17), as data the session checks; a callback can be
neither sent nor checked.

**Several commands as a transaction on the host's side, not a batch.**
No new command. Rejected: a transaction is code, so a resolution of
several commands -- a relabel -- could not be sent as data, and two
descriptors applied one after the other would be two undo steps, half
of which a person could undo.

**Validate per step of a batch.** Rejected, as 0008 rejected it for a
command: a style named before it is declared is a valid batch whose
middle is not a valid report. So a step runs on what no validator has
seen, and one that throws there is refused rather than thrown.

**Remove only the field, and let the validator list what refers to it.**
`removeField` does, and the review could say "change these first".
Rejected: an expression that reads a field is no reference the
validator sees -- the compiler refuses it later -- so the report would
validate and refuse every render; the readers are found once, by the
compiler's own reading.

**Find a field's readers with a parser of the review's own.** Rejected:
report-core's diagnostics already ask `@formancy/expressions`' parser,
as the compiler does, and a second reading of CEL would disagree with it
at the first bracket or macro.

**Take `diffSchemas`' `detail` as an item's message.** It says what
changed in English. Rejected: it quotes labels and values, which may name
a person, and ends up in a log.
