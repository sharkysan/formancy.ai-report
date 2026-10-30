# 0042 — A report reads a formancy form's submissions against the exact version that collected them, as the host hands them over: a package of its own, `@formancy/report-forms`, fetching nothing; the version validated by the pinned `@formancy/spec` and named by the hash computed of it; every answer under a data path of that version; formancy's kinds mapped once to the report's types, a number by its digits or refused; labels from that version in the report's locale; the binding inside the report; host-captured; a fetching client, a trusted hash, a binding beside the report, rounding and today's labels lost

- **Status:** accepted; numbered while 0039 and 0040 were other branches'; extends [0004](0004-three-version-lines-each-refused-when-unknown.md), whose form line is read now, [0007](0007-a-report-definition-is-its-own-versioned-document.md), whose dataset contract carries the binding, [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md) and [0041](0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md), whose form source the bridge fills; extended by [0045](0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md), whose report generated from a form version writes this binding and reads a kind by this mapping, and by [0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md), whose review writes an override per version on this binding and lifts this record's refusal
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The binding's shape.** `packages/report-spec/src/validate-form-binding.test.ts`,
    and a case for each of the three new codes in `validate.test.ts`: a
    header read from a submission and a detail from a repeater, a group's
    child, a member and `read: 'value'`, and the binding in the hash; one
    row per submission beside no header; each kind in its role; a dataset
    read whole and both datasets or neither; a path of field keys and
    dots, at most `MAX_FORM_PATH_KEYS`; a member of 1 to
    `MAX_FORM_MEMBER_LENGTH` characters, the bound held to the pinned
    formancy's validator; `read` on a string field alone, and `read:
    'label'`, the default spelled out, refused. Written before the code, on
    22 October 2026: 15 of the 126 tests of the two files failed, and all
    passed once it was; the spelled-out default and the longest path, added
    after review, each failed with its rule broken.
  - **The mapping and the reads.** `packages/report-forms/src/kinds.test.ts`,
    `read.test.ts`, `many.test.ts` and `untrusted.test.ts`, written before
    the package had code, each kind read as it maps and every other
    pairing refused naming the field and the version's hash; a version-1
    and a version-2 visit, each with its own version's labels; the hash
    computed and a differing one refused; an answer the version has no
    path for refused by its path and never its value; a field the version
    lacks, moved or retyped; forms at spec 1, 2, 3, 4 and 5 and one Formancy
    Data generated at spec 3; a spec 6 form refused naming both versions;
    getters never run, an own `__proto__`, keys called `constructor`, the
    row bound, the depth bound and the error bound. `kinds.test.ts` also
    reads every formancy kind at every report type and holds what is read
    to the README's table, which restates the mapping. Every read a test
    makes that hands data over is held to the runtime's `checkData`, which
    refuses nothing of it but a null the report's contract does not allow
    (`test-support.ts`). Each rule was then
    broken on its own, 22 of them -- a hash trusted, no answer key
    checked, labels in the form's default locale, a field or a matrix row
    read through inheritance, rows unbounded, a getter run, no spec
    version of the bridge's own, a number handed over as a double, any
    kind read as any type, an integer read from fractional steps, no
    runtime reading of the value, one refusal for every version, an own
    `__proto__` copied, the depth unbounded, a member unchecked, an
    unknown option read, a sourced label taken as its value, an id
    unchecked, a null row dropped, a ranking read as text, a path naming
    any key -- and each failed at least one test. Two failed none at
    first, a matrix row read through inheritance and one refusal for
    every version; each gained its case and failed it. Each file was
    written back as it was read before its break. After review, 28 more
    were broken one at a time, among them a kind widened, the depth bound
    lowered to 12, a list's hole read, a field id assigned, answers read
    before the version's refusal, a page scoping its fields, a host's
    exception let through, a matrix's other rows unread, a long string
    parsed, an option list scanned per answer and the 15 digits lowered to
    14; each failed a test. One failed none at first, a refusal inside an
    answer named at the copy's own path, and failed once a hole in a list
    answer was among the cases.
  - **The number rule.** `packages/report-forms/src/numbers.test.ts`, by
    fast-check, its decimal properties at 20,000 runs each, the 15 written
    into the test rather than read from the module: every decimal of at
    most 15 significant digits from 10^-300 to below 10^15 comes back
    through a double as its digits; any other double is accepted exactly
    when it is a safe integer, or nearer zero than 2^53 and a 15-digit
    decimal is that double, held against `toPrecision` rather than the
    rule's own way, and what is accepted is the double. Watched failing
    with the bound at 17 digits (counterexample 2.2254951312028104e-308),
    with the smallest normal double's guard removed (counterexample
    5e-324), with the bound at 14 and at 10, and, after review, with a
    double past 2^53 read into a decimal field (counterexample
    10000000000000000).
  - **On the PDF (0003).** `packages/report-forms/src/pdf.test.ts`: a
    version-1 visit, read against version 1 and rendered, prints version
    1's "Hoch" on every finding of high severity and version 2's
    "Kritisch" nowhere, every finding a row in its place by the corpus's
    `verify`, and its manifest names version 1's hash. Watched failing
    with the visit read against version 2, and with the bridge dropping
    the last row.
  - **One rule for a submission's id.** `packages/report-runtime/src/data.test.ts`:
    the runtime's `isSubmissionId`, which the bridge reads, accepts
    exactly what a source accepts. Failed before it existed. The bridge's
    refusal says the rule in the runtime's own words,
    `SUBMISSION_ID_SYNTAX` (`read.test.ts`).
  - **The version's scopes are formancy's paths.** `packages/report-forms/src/version.test.ts`:
    the scopes a version is read by give exactly the paths
    `modelDataPaths` writes, for the corpus's forms and, by fast-check,
    500 models of groups, repeaters and pages. Watched failing with a page
    scoping its fields.
  - **Linear in what it is handed.** `packages/report-forms/src/linear.test.ts`:
    ticked boxes and a select of 40,000 options and a group of 10,000
    fields, answered in 40,000 or 20,000 rows, each read in under five
    seconds. Read per answer, as before review, they took 174, 13 and 16
    seconds, and failed; indexed once, each case took under half a second,
    on 22 October 2026 on the machine the measurement below names, at a
    third to a half of its load from other workflows.
  - **The fixture.** `packages/report-corpus/src/forms/site-visit.test.ts`:
    the site visit's report is one the runtime reads and an editor warns
    nothing of, and its two versions differ in one label alone.
  - **The install gate.** `scripts/install-fixture/forms.ts`, in the Node
    host: a form validated by the `@formancy/spec` the packed bridge
    brings, a submission read against it and rendered, its manifest naming
    the version's hash, a moved field and a wrong hash refused, and two
    submissions read by `readSubmissions`, one a row. Watched failing once,
    with one expected label changed, and passing once it was put back. The
    package README's example is its lines (`scripts/readme-example.test.mjs`,
    watched failing with one argument changed in the README). Release gate
    G1 counts `read.test.ts` among its evidence (`docs/release/gates.json`).

## Context

Plan items R11 and R12 ask for a report printed from a formancy form's
submission, against the exact form version that collected it, and a
report that refuses a submission whose version moved or retyped a field
it prints. 0041 gave the manifest somewhere to name a submission and its
version; nothing read one.

What formancy offers, read at 0.7.0, the release this repository pins:

- **A version is its document, and its identity its `schemaHash`.**
  formancy's server keeps each version's schema and hash beside its
  submissions. A submission is the answers formancy's engine stored:
  nested by group, a repeater's rows a list whose rows carry `_id`, an
  answer pruned when a rule hides its field, a list answer `[]` when
  empty.
- **Its API serves the current version.** `GET /f/:path` answers the
  current version's schema; `/versions` lists versions without schemas;
  `/submissions` lists every submission, unpaginated, with the version's
  number and no hash. There is no route for one submission or for an old
  version's schema, and no published client.
- **A number is a double.** The engine checks `typeof value === 'number'`
  and stores what the control gave it. A report prints exact digits, and
  the runtime refuses a decimal as a number (0010).
- **Labels are text of the version**, a string or a message of its
  catalogue, which `resolveText` and `resolvedLocale` read as their own
  (formancy.ai 0185, released in 0.7.0).
- **Untrusted.** A form and a submission are untrusted even from the
  host's own store, and 0004 decided that a form is read through
  upstream's validator at the pinned version, adding no reading of its
  own.

0.3.0's plan answered the questions this record turns on: one package,
`report-forms` (FB-Q1); submissions as JSON from the host, Report never
fetching (FB-Q2); the binding inside the report, on the dataset contract
(FB-Q4); a number a safe integer, else a decimal of at most 15
significant digits, else refused, never rounded (FB-Q7); a matrix and
ticked boxes in, a ranking refused, one repeater the detail table (FB-Q8,
Q9).

## Decision

**A package of its own.** `@formancy/report-forms` reads a report's data
from a formancy form's submissions. It depends on `report-spec`,
`report-runtime` and `@formancy/spec` at the exact release the rest of
the repository pins, the DOM's globals and no `@types/node`. It fetches
nothing: `readSubmission(report, { form, formHash?, submission: { id,
data } }, options)` reads a report of one submission, its answers in the
header and one repeater's rows in the detail; `readSubmissions(report, {
forms, submissions, complete }, options)` one row per submission, each
paired with its version by that version's hash.

**The binding is the report's** (report-spec, draft `'0'`). A dataset
says what it reads -- the header `{ kind: 'submission' }`, the detail `{
kind: 'repeater', repeater }` or `{ kind: 'submissions' }` -- and each of
its fields where: `form: { path, member?, read? }`, a data path in the
dataset's scope of field keys and dots, a matrix row's or an option's
value as its member, and `read: 'value'` where a choice prints its
stored value rather than its label; the label, the default, has no
spelling of its own, so one binding has one hash. A dataset is read
whole, and both or neither; a report of one row per submission has no
header and reads at least one submission. The binding names no form.

**The version is computed.** Each form is copied as data through its
descriptors, a `specVersion` the pinned validator does not know refused
naming both versions, validated by `validateSchema`, and named by
`schemaHash` of exactly that copy. A hash the host gives is compared with
it, never used for it.

**Checked before an answer is read, per render and per version.** The
report, the input's shape, each submission's id by the runtime's own
`isSubmissionId`, each version, and each field the report reads against
each version: a field at its path in its scope, of a kind its type reads,
with the member it names. A field the version lacks is `version-lacks-
field`; one held as another kind, or as no answer, `version-retypes-
field`; a ranking, a file, a signature and ticked boxes of a resolved
source `unsupported-field`. Each names the field and the version's hash.
A path is never guessed from a name, and a version that changed nothing
the report reads prints.

**Every answer under a data path of its version**, walked by the model
and never by the data's keys, each scope indexed once and holding exactly
the paths formancy's `modelDataPaths` writes: an answer the version has
no field for is `unknown-answer`, by its path, the key named where it is
a field key; so is a matrix's answer that holds a row the version has
none of, whichever row the report reads.

**The mapping, decided once (`kinds.ts`).** Text, a hidden value: a
string, or an integer or a decimal held to its one spelling, which is
how Formancy Data writes a decimal. A long text and a time of day: a
string. Rich text: its plain text, by formancy's `richTextToPlain`. A
number: by the number rule. A tick box: a boolean. A select and a radio:
the chosen option's label in the report's locale, from the submission's
own version, or its value; a resolved source's label from the host's
`labels`. A date: a date; a date and time: an instant. A matrix: one row,
the chosen column's label or value. Ticked boxes: one option, ticked or
not. Groups by their key, pages looked through, one repeater the detail.

**The number rule.** An integer field reads a safe integer, as its
digits, and refuses a number field whose version steps through
fractions. A decimal field reads a safe integer, or, nearer zero than
2^53, the shortest decimal that is the double when it has at most 15
significant digits and the double is normal; anything else is
`inexact-number`, never rounded, a double past 2^53 among it, which has
lost its last digits for a decimal field as for an integer one. The
double already in the submission becomes digits; digits never become a
double.

**Absent is null; the version's absence refused.** An answer the
submission does not have is null, and its field's contract decides
whether a final render prints it. Each answer is copied once as data,
read as its kind stores it, and held to its field's type by the
runtime's own `readValue`, at its path in the submission.

**Host-captured, and named.** The data says `host-captured`; a report of
one submission is complete, a list as complete as the host says. Its
source names each submission with the form's id and the hash of the
version that collected it (0041).

**Untrusted throughout.** Getters are refused and never run; own members
only; an own `__proto__` refused in a form and unknown in a submission;
lists bounded by the runtime's `MAX_DETAIL_ROWS` before an item is read;
a string answer by its `MAX_STRING_LENGTH` before it is read, and a rich
text before formancy's parser, whose time grows faster than its input,
reads it; a form or an answer nested past `MAX_DOCUMENT_DEPTH` refused;
a host's `labels` that throws or gives no string `unresolved-label`, its
exception kept from the read; errors bounded by report-spec's
`MAX_ERRORS`, each said once; no message or path holds an answer, and a
refusal of what an answer holds, its keys as much as its values, stands
at the field's own path. Each version's scopes and option lists are
indexed once, so a read takes time linear in what it is handed.

## Consequences

**What it buys.**
- **A reprint of what was collected.** A submission prints the labels,
  the paths and the kinds of the version that collected it, whatever the
  form says today, and the PDF's manifest names that version.
- **Nothing printed wrong while a form moves on.** A version that moved
  a field the report reads is refused by name before an answer is read,
  and one that touched nothing the report reads prints.
- **One reading of each thing.** formancy's validator, hash, labels and
  rich text are formancy's, and the paths the bridge walks are held to
  formancy's `modelDataPaths` by a test; a value's type is the runtime's;
  a submission's id and the words that say its rule are the runtime's;
  the mapping is `kinds.ts`'s, and the README's table is held to it.
- **A Data-generated form reads.** Its decimals written as text read as
  decimals; plan 25.1's regression case is a test.

**What it costs.**
- **The host keeps every version.** formancy 0.7.0 serves the current
  version's schema alone, so a host that did not keep a version's
  document cannot print its submissions against it.
- **The wrong version is caught only by its paths.** A submission paired
  with another version is refused only where one of its answers has no
  field there. Two versions with the same paths and other labels print
  the labels of the one handed over.
- **A computed number is refused.** A total a form computed, a double
  whose shortest decimal has more than 15 significant digits, or one past
  2^53, is `inexact-number`, and the report does not print it; the
  remedy is a text field under a decimal pattern, which a report reads as
  a decimal. An integer field over a number that steps through fractions
  is refused for the version.
- **A number rounded before the bridge saw it prints rounded.** A number
  typed with more than 15 significant digits was rounded when formancy
  stored it as a double, and where the double's shortest decimal is
  short, it prints as that: a typed 0.10000000000000001 prints 0.1.
  Nothing in the double says otherwise.
- **Every field nullable but the proven.** An answer formancy pruned is
  null, so a field declared not nullable refuses a final render of any
  submission that left it out.
- **No review yet.** A version that moved a field is refused until the
  report is changed by hand; the review that resolves it is later work.
- **Refused, not read.** A file, a signature and a ranking; ticked boxes
  whose options a deployment resolves; a radio of `"true"` and `"false"`
  as a boolean; a second repeater; a row formancy nulled, in any repeater
  the submission holds, read by the report or not; a rich text whose
  markup is longer than `MAX_STRING_LENGTH`, however short its words; a
  report of many read from a list of no submissions.
- **A choice that offers nothing is unchecked.** A select or a radio with
  no options in the document and no source takes any value, as
  formancy's engine does (formancy.ai 0076), and its stored value prints
  with `read: 'value'`; its label is refused.
- **The format grows.** The binding is in the draft format, so a report
  that carries one is refused whole by 0.2.0, as `unknown-property`, and
  a review that changes it is a new template release.
- **Time, measured.** Reading one visit with 100,000 findings of six
  fields took a median of 966 ms, and the runtime's `checkData` of the
  same data 497 ms; 100,000 submissions of eleven fields each, one a row,
  2,135 ms (runs two to six of six, and two to four of four, from the
  built package, Node 24.21.0, an Intel i9-10900K at 7 to 13 % load from
  other workflows, 22 October 2026, after review's changes; before them,
  at 34 % load, 927, 483 and 2,794 ms).

**What it forecloses.** A form fetched by address; a version named by a
hash the host gave; a label of another version than the submission's; a
number rounded to fit.

**Added 2026-10-22: the binding written by a generator.** [0045](0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)
generates a report from a form version, `generateReport` in this
package, and writes the binding this record decides: a field at its data
path in its dataset's scope, a matrix row's or an option's value as its
member, `read: 'value'` for a choice that offers no option and names no
source, the detail a repeater's rows or one row per submission. It reads
a kind by `KINDS`, an integer as `planField` reads one, the detail's
repeater by `planRepeater` and a version by `readVersion`, so the draft
binds only what a read of that version finds; `generate-read.test.ts`
reads a submission of the version into every draft of 400 generated
models, and the corpus's version-2 visit into the Studio's starter. The
reading itself is unchanged: `readParts`, which reads what a host hands
over, moved from `read.ts` to `json.ts`, where the generator's options
are read by it too, and `planRepeater` hands over the repeater it found.
A field's id stays the report's, never one made from its path: the
generator gives a field its own key, which formancy holds unique in the
form, and a member its field's key and its value or its place, and
refuses two fields of one id rather than rename either. 0045's review
found one change to the reading: `readVersion` named a refusal of
formancy's validator at the pointer it wrote, whole, and that pointer
may end in a catalogue's locale or a message's id, which may be a name.
It is cut now before its first segment that is neither an index nor a
field key, as a submission's path is cut, each of formancy's codes said
once there, and the 512-character bound it had is gone, since what is
left is bounded by `MAX_DOCUMENT_DEPTH` segments of a key's length
(`read.test.ts`).

**Added 2026-10-22: the review, and the binding overridden per version.**
[0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md) reviews a new version for a report and lifts the refusal
this record makes, "No review yet" no longer a cost. The binding gains
overrides, keyed by a version's `schemaHash`: a field read at another path
in that version, `{ path }`, or nothing of it from that version, `{ omit:
true }`, and the detail's rows from another repeater, `{ repeater }`,
which report-spec holds in shape alone. The per-render check reads them:
`planField` reads a field where its override for the version says, or
hands it null, and `planRepeater` the detail's rows from its override's
repeater (`repeaterIn`), a field of them refused naming those rows; every
version they do not name reads the binding's own path, which a review
that follows a rename moves to where the field is now. A refusal of a
field names what lifts it, a review of that version by
`reviewFormVersion`, where anything does, and a refusal of the detail's
repeater says that the review offers nothing but a rename of it
(`overrides.test.ts`). The package now depends on `report-core` besides,
since a review's resolutions are its commands and the compiler judges
them; it still fetches nothing and reaches no network.

**Added 2026-10-30: formancy 0.11.0.** The repository moved
`@formancy/spec` from 0.7.0 to 0.11.0. Nothing this record decides
changed; what reached the bridge:
- **Spec 5 is read**, by [0004](0004-three-version-lines-each-refused-when-unknown.md)'s
  rule, a version of it read, drafted and reviewed as its spec 4 twin. A
  default left alone is stored as the person's answer, indistinguishable
  from one chosen
  ([formancy.ai 0197](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0197-a-default-is-where-something-fresh-starts.md)),
  and prints as one.
- **An answer has the shape its type says** from formancy 0.8.0, whose
  engine refuses any other before it stores one
  ([formancy.ai 0189](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0189-every-answer-has-the-shape-its-type-says.md)).
  The bridge already refused, for each kind it prints, an answer of
  another JSON type than the kind stores (`kinds.test.ts`), so nothing
  0.8.0 stores reads otherwise. A submission stored before, which
  formancy does not examine again, reads as it did: a group or a repeater
  held as null among it, read as unanswered.
- **A computed repeater's rows carry an `_id`** from 0.11.0, and did not
  before
  ([formancy.ai 0218](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0218-a-computed-repeater-is-the-rules-row-by-row.md)).
  A row is read by its place and never keyed by its id, so both print
  (`read.test.ts`).
- **"The host keeps every version" holds only beside a formancy server
  before 0.8.0.** From 0.8.0, `GET /f/:path/versions/:version` answers a
  version's document and hash by its number
  ([formancy.ai 0207](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0207-a-versions-document-can-be-read.md)),
  which a host can hand over. The bridge still fetches nothing.
- **A version's hash is the one it was.** `schemaHash`'s code is 0.7.0's,
  and the starter that names the corpus's version 2 by its hash still
  names it (`starter.test.ts`).

## Alternatives considered

**Read formancy's server with a client of Report's own.** Rejected (FB-Q2):
the API has no route for one submission or an old version's schema, lists
submissions without their hash, and publishes no client; one written here
would be a second reading of formancy's rules (0002).

**Trust the hash the host passes.** Rejected: the host's record and its
document can disagree, and either could be wrong; computed here, the hash
names the document that is read.

**A binding beside the report, as the Data provider's.** Rejected (FB-Q4):
an undo in the editor could leave it saying what the report no longer
does, caught only at the next render, and the report's hash would not say
which binding it was reviewed against.

**A form named in the binding.** Rejected: a version may rename the form,
which 0041 and FB-Q5 let print; which form a report was made from is its
provenance's.

**Map a field by its key alone, as the Data provider does.** Rejected: a
key is unique in a formancy form, but a matrix row and a ticked option are
no key at all, and a key alone cannot say whether an answer is the
submission's or a row's, which a version can move it between unseen.

**Round a double to 15 digits, or print it as JavaScript writes it.**
Rejected (FB-Q7): either prints a number the form never held.

**Integers only.** Rejected: it refuses every decimal a person typed into
a number field, which the rule shows reads exactly.

**Today's labels, or labels the host passes.** Rejected: plan 12.2 asks a
reprint for the labels of the version that collected the answers, which
the version handed over holds.

**Validate the submission with formancy's engine in server mode.**
Rejected for now: it adds `@formancy/core` to the production closure and
re-judges answers formancy already accepted; the bridge checks what it
reads by kind and by the runtime's reading, and every answer's path.

**Refuse an absent answer.** Rejected: formancy prunes a hidden answer, so
a refusal would refuse every submission whose form hid a field.
