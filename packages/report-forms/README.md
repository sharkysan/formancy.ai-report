# @formancy/report-forms

Formancy Report's form bridge. It reads a report's data from a
[formancy](https://github.com/sharkysan/formancy.ai) form's submissions,
each against the exact form version that collected it, as the host hands
them over, and hands over the data `@formancy/report-runtime` renders
from, or every reason it will not. And it starts a report from a form
version: a first draft that names the version and reads its submissions,
with notes of what it left out. And it reviews a new form version for a
report: whether its submissions print, and what would make them, each
resolution a report-core command as data. No framework, no Node, no
network: the bridge fetches nothing. What it decides, and why, is decision
[0042](../../docs/decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)
for reading,
[0045](../../docs/decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)
for generating and
[0048](../../docs/decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)
for reviewing.

**The host hands the documents over.** For a report of one submission,
the form version the submission answered and the submission, `{ id, data
}`, as formancy stored it: its answers fill the header and one repeater's
rows the detail. For a report of one row per submission, every version
they answered and the submissions, each with its version's `schemaHash`,
by which it is paired with its version. A host reading formancy's own
server keeps each version's document beside its submissions, or fetches
the one a submission names by its number: `GET /f/:path/versions/:version`
answers the document and its `schemaHash` from formancy 0.8.0
([formancy.ai 0207](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0207-a-versions-document-can-be-read.md)),
where 0.7.0's API served the current version's alone.

**The version is computed, not trusted.** Each form is validated by the
`@formancy/spec` this package pins, and named by the `schemaHash` computed
here of exactly that document. A hash the host gives that is not the
form's is refused. A form of a `specVersion` the validator does not read
is refused with both versions named ([0004](../../docs/decisions/0004-three-version-lines-each-refused-when-unknown.md)).

**Host-captured, and named.** A stored submission is one document written
at one moment, so the data says `host-captured`. Its source names each
submission with the form's id and the version's hash, and the render's
manifest carries it
([0041](../../docs/decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)).

## Read a submission

```ts
import { readSubmission, readSubmissions } from '@formancy/report-forms'
import type { FormsError, SubmissionRead } from '@formancy/report-forms'
import { resolveReport } from '@formancy/report-runtime'
import { schemaHash } from '@formancy/spec'

const visit: SubmissionRead = readSubmission(visitReport, { form: visitForm, formHash: schemaHash(visitForm), submission: { id: visitId, data: visitData } })
if (!visit.ok) throw new Error(visit.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const visitPrint = resolveReport(visitReport, visit.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z' })

const visits: SubmissionRead = readSubmissions(visitsReport, { forms: [visitForm], submissions: visitSubmissions, complete: true })
```

The install gate runs these lines from the packed packages, and they are
held to it (`scripts/readme-example.test.mjs`). `formHash` is optional:
the hash is computed either way, and where the host gives the one it
stored, the two must agree. `readSubmissions(report, { forms,
submissions, complete })` reads a report of one row per submission, each
`{ id, formHash, data }` paired with its version by that hash, and at
least one, since the source names each it was read from; `complete` is
the host's statement that these are all of them.

**The binding is in the report**, on its dataset contracts (report-spec
validates its shape). The header reads `{ kind: 'submission' }`; the
detail `{ kind: 'repeater', repeater: 'findings' }` or `{ kind:
'submissions' }`. Each field says where its answer is:

```json
{ "id": "inspector", "type": "string", "label": "Inspektor", "nullable": true, "form": { "path": "inspector.name" } }
{ "id": "safety", "type": "string", "label": "Sicherheit", "nullable": true, "form": { "path": "condition", "member": "safety" } }
{ "id": "outcomeCode", "type": "string", "label": "Code", "nullable": true, "form": { "path": "outcome", "read": "value" } }
```

A path is the answer's data path in the dataset's scope, field keys
joined by dots, as formancy writes a group's child; the scopes the bridge
reads a version by give exactly the paths formancy's `modelDataPaths`
writes (`version.test.ts`). A choice prints its label, or its stored value
with `read: 'value'`; `read: 'label'` is refused, the label having no
spelling of its own. The binding names no form: a submission of any
version whose fields are where the report reads them prints.

**The mapping**, decided once in `kinds.ts`:

| formancy kind | read as | how |
|---|---|---|
| `text`, `hidden` | `string`, `integer`, `decimal` | as stored; a number written as text is held to its type's one spelling |
| `textarea` | `string` | as stored |
| `time` | `string` | `HH:MM`, as stored: a report has no time of day |
| `richtext` | `string` | its plain text, by formancy's `richTextToPlain`; the formatting is lost |
| `number` | `integer`, `decimal` | by the number rule, below |
| `checkbox` | `boolean` | |
| `select`, `radio` | `string` | the option's label in the report's locale, from the submission's own version; or its stored value, with `read: 'value'`. Options a deployment resolves (`optionsSource`) are labelled by the host's `labels` |
| `date` | `date` | |
| `datetime` | `instant` | formancy's is UTC, with `Z` |
| `matrix` | `string` | one row, its `member`: the chosen column's label or value |
| `selectboxes` | `boolean` | one option, its `member`: ticked or not; `[]` ticks none |
| `repeater` | the detail | one repeater's rows; a repeater in a repeater formancy refuses |
| `group`, `page` | nothing | a group's fields are read by its key and theirs; a page is looked through |
| `ranking`, `file`, `signature` | refused | as `unsupported-field` |
| `static` | nothing | it holds no answer |

The table is held to what the bridge reads, every kind at every report
type (`kinds.test.ts`): a kind is read as exactly the types it lists, and
refused as any other.

**The number rule.** A formancy `number` is a double. An integer field
reads a safe integer, as its digits. A decimal field reads a safe
integer, or, nearer zero than 2^53, the shortest decimal that is the
double when it has at most 15 significant digits: every decimal of at
most 15 significant digits a person typed comes back as exactly what was
typed, less its trailing zeros, which the field's scale prints. Anything
else -- a computed `0.1 + 0.2`, a double whose shortest decimal is longer,
a number past 2^53, which has lost its last digits whichever field reads
it -- is refused as `inexact-number`, never rounded. What the rule cannot
see: a number typed with more than 15 significant digits was rounded when
formancy stored it as a double, and where that double's shortest decimal
is short it prints as that: a typed `0.10000000000000001` prints `0.1`. A
form that must hold more digits writes them as text under a decimal
pattern, as Formancy Data does, and the report reads that text as a
decimal.

**Absent is null.** An answer the submission does not have -- a hidden
field formancy pruned, a question never reached -- is null, which prints
as nothing; a field declared not nullable then refuses a final render. A
field the **version** does not have is something else: refused.

**Per render, against each version:** a field the report reads that the
submission's version lacks, holds in another scope or holds as a kind
its type does not read is refused, naming the field, the version's hash
and the review that would lift it, where anything does, before any answer
is read, as `version-lacks-field` or `version-retypes-field`; the
detail's repeater's refusal says a review offers nothing but a rename of
it. A version that changed
nothing the report reads prints; a field it added is never read by
itself. A path is never guessed from a name. Where a review decided for
that version, the binding's override for it, keyed by the version's
hash, says where the version holds the field, or that nothing of it
prints from that version (below); every version it does not name is read
at the binding's own path, which a followed rename moves to where the
field is now.

**Untrusted, both of them.** The form and the submission are read once,
through property descriptors, own members only: a getter is refused and
never run, an own `__proto__` refused in a form and unknown in a
submission, a key such as `constructor` read as the answer's own. Every
answer key must be a data path of the version, and every row a matrix's
answer holds one of the version's rows, or the submission is refused: it
was collected by another version. A repeater's rows and the submissions
are bounded by the runtime's `MAX_DETAIL_ROWS` before one is read, and a
string answer by its `MAX_STRING_LENGTH` before it is read, a rich text
before formancy's parser reads it. A host's `labels` that gives no string,
or throws, is `unresolved-label`, its exception never escaping the read.
No message and no path holds an answer: a refusal of what an answer holds,
its keys as much as its values, stands at the field's own path. A read
takes time linear in what it is handed, each version's scopes and option
lists indexed once (`linear.test.ts`).

## Start a report from a form

```ts
import { generateReport } from '@formancy/report-forms'
import type { Generated } from '@formancy/report-forms'

const draft: Generated = generateReport(visitForm, { id: 'site-visit-draft', locale: 'de-CH', detail: { kind: 'repeater', repeater: 'findings' } })
if (!draft.ok) throw new Error(draft.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const assumed = draft.notes.map((note) => `${note.code} at ${note.path}`)
const draftVisit = readSubmission(draft.report, { form: visitForm, submission: { id: visitId, data: visitData } })
```

The install gate runs these lines too (`scripts/readme-example.test.mjs`).
`generateReport(form, { id, locale, detail? })` reads the version as a
submission's is read -- validated by the pinned `@formancy/spec`, named by
the hash computed of it -- and writes a report a person starts from:

- **In model order**, the version's own order of its fields; a layout the
  version names is an arrangement for filling it in, and is not followed.
- **A line for each answer**: its label, from the version in `locale`,
  and its value, a date and an instant in the report's locale, a decimal
  to the places its step and its least value have, a yes or a no as a
  box, `[x]` or `[ ]`. A label's white space is one space; one longer
  than a field's label holds prints whole on its line, and the field is
  labelled shorter.
- **A group is a section** headed by its label, as deep as the format
  nests sections; a deeper one stands in the section around it. A matrix
  and ticked boxes are a section of a line a row or an option.
- **A page is nothing**: it is a step of filling the form in, never a page
  break.
- **One table**: `detail: { kind: 'repeater', repeater }` makes the rows of
  the repeater at that data path the table, where the repeater stands, a
  column for each field of its rows, in its grid's order where it is one;
  `{ kind: 'submissions' }` one row per submission, with no header. Every
  other repeater is left out, said; without `detail`, every one.
- **A page that gives the table room**: A4, portrait for a table of up
  to six columns and landscape, said, for up to nine, each column 80 pt,
  which holds a heading's word of 72 pt in the renderer's Roboto
  (`generate-print.test.ts`). The renderer breaks no word in a cell, so
  a wider word of a heading or an answer is refused when the draft
  prints.
- **The pages counted** in the footer, `1 / 2`, in no language's words.
- **The version named**: `provenance` is `{ kind: 'form', form, formHash }`,
  the hash computed of the version handed over.
- **The binding written**, so that `readSubmission` reads a submission of
  that version into the draft. A field is not nullable only where the
  version proves it always answered: required, and no `visible` rule on
  it, its group or its repeater, and no `skip` rule on its page.

The same version and the same options give the same report, to its
`reportHash` (`generate.test.ts`), and a version that differs only in what
the report does not hold -- a choice's labels, read when a submission is --
gives the same report naming another version. Nothing of the draft is
kept as a base: a later version of the form is reviewed against the
report itself (below).

**The notes** list, in model order, by a code from `NOTE_CODES` and the
field's place in the form, what the draft left out -- a static text, a
file, a signature, a ranking, ticked boxes whose options a deployment
resolves or that offer none, a repeater the table does not read -- and
what it assumed: each number's reading, each box, a time of day and a
rich text printed as text, a hidden field printed though the person never
saw it, a choice that prints its value or the host's labels, a field
labelled by its key and a row by its value, a label in the default
language's words, a label longer than a field's, a field declared always
answered, a landscape page, a blank title, labels in the form's default
language, layouts not followed, pages not broken.

**Refused, never cut to fit**: a form whose draft would hold more fields
than a dataset does (`MAX_DATASET_FIELDS`), more columns than a landscape
page gives room (`too-many-columns`) or more components than a region, a
column headed longer than a field's label, a label holding a character no
font draws, a field deeper than a binding's path reaches, a matrix row or
an option whose field's key leaves no room for an id, two fields that
would share an id -- never renamed by likeness to tell them apart -- and a
form or a repeater holding nothing a report prints. A member's id is its
field's key and its value where every member's value is a field key, and
its place for every member where one is not. The form is untrusted, read
as a submission's version is, its notes and errors quoting none of its
labels, values or locales.

## Review a new form version

```ts
import { reviewFormVersion } from '@formancy/report-forms'
import type { FormReview } from '@formancy/report-forms'
import { openReportSession } from '@formancy/report-core'

const review: FormReview = reviewFormVersion(draft.report, { form: renamedForm, versions: [visitForm] })
if (!review.ok) throw new Error(review.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const follow = review.items[0]?.resolutions[0]
const opening = openReportSession(draft.report)
const applied = opening.ok && follow !== undefined ? opening.session.apply(follow.descriptor, { expectedHash: follow.expectedHash }) : undefined
```

The install gate runs these lines too (`scripts/readme-example.test.mjs`).
`reviewFormVersion(report, { form, formHash?, versions })` reads the new
version as a read does, and compares it, through formancy's
`diffSchemas`, with each version the report names: the one its
provenance says it was made from, and each its overrides name, all of
which the host hands over in `versions` -- one missing is refused as
`missing-version`. Hand over every other version you keep too: it is
compared with nothing, and a rename followed keeps it reading where it
read; one you keep back, which printed at the old path, is refused once
the binding moves, until its own review. At most `MAX_DETAIL_ROWS`
versions, as `readSubmissions` takes forms. It returns a status and an
item for each thing the version did that the report meets:

- **`blocked`**: a field the report reads, or the detail's repeater, that
  the version removed, moved or retyped, which the per-render check
  refuses. Only that blocks: a version that changed nothing the report
  reads is **`compatible`**, and one whose changes print as they are --
  a relabel, a field added, a reused key, the form's id changed -- is
  **`review`**.
- **Each item** names the report's dataset and field by its id, what the
  version did as the diff names it (`field.renamed`, `field.removed`,
  `field.typeChanged`, `field.relabelled`, `field.added`, ...), whether it
  blocks and with what code, and never a label, an option or an answer.
- **Its resolutions**, each a report-core command descriptor and the
  `reportHash` it was computed against, applied through a session with
  that hash as `expectedHash`, so a stale one is refused and nothing
  changes:
  - `follow-rename`, **offered first and labelled `declared`**, where the
    form's author declared a rename (`renamedFrom`) of the field or of a
    group or repeater holding it. It moves the binding to the field's new
    path, names that version reading it there, and names every other
    version you handed over reading the old path, but one that already
    holds the field where the rename put it, as formancy's diff finds,
    which reads it there too: each prints as it did or as the reviewed
    version does, and a later version that keeps the field where the
    rename put it prints without another review. It is never followed by
    itself, and a path is never guessed from a name: a key changed
    without `renamedFrom` is a removal and an addition.
  - `follow-reviewed`, not labelled declared: the path a version the
    report names reads the field at, where formancy's diff finds the same
    field in the new version, read there in that version alone -- what a
    version a followed rename did not know is offered.
  - `print-nothing`: an override printing nothing of the field from that
    version's submissions, declaring the field nullable where it was not.
  - `retype`: another type every version the report reads the field from
    holds it as. A version that holds it as text, retyped to a number,
    refuses each of its submissions whose answer spells none, which the
    resolution says.
  - `remove`: the field removed with everything that reads it -- report-core's
    `removeFieldWithReaders` -- what it takes listed in `removes` by
    pointers into the report.
  - `relabel`: a batch saying the version's new label wherever the report
    still says an old one -- the field's own label, a line's label before
    the run that prints it, a column's heading over it. Offered, never
    applied.
- **A field the QR-bill or the e-invoice reads** is offered a rename and
  nothing else: printing nothing of it, another type or its removal would
  change what the bill or the invoice says, and only their own commands
  change them. The item says so. **The detail's repeater**, removed or
  retyped, is offered its rename, declared or read so by a version the
  report names, and nothing else, which its item and its refusal say.
- **A field that prints from a field formancy calls new** since a version
  the report printed nothing of it from -- a key that version vacated
  and this one reused -- is said, offered nothing printed or its removal,
  and no relabel.
- **A field the version added** is said, in the scope of a dataset the
  report reads, and never added. **A version that names its form by
  another id** is said: it may be another form.

A resolution is offered only where the session takes it and, where it
changes a field's type or whether it may be null, it leaves no expression
the compiler refuses that it did not refuse before: printing nothing of a
decimal compared with `==` is not offered, since a nullable decimal loses
`==` (0009). The compiler is asked of the expressions report-core's
`fieldReaders` says such a change reaches, each once, never of the whole
report for each resolution.

**The override** a review writes is the report's, on the binding,
keyed by the version's `schemaHash`:

```json
{ "id": "name", "type": "string", "label": "Name", "nullable": true, "form": { "path": "inspector.name", "overrides": { "<the version's hash>": { "path": "technician.name" } } } }
{ "id": "count", "type": "string", "label": "Count", "nullable": true, "form": { "path": "count", "overrides": { "<the version's hash>": { "omit": true } } } }
{ "id": "rows", "fields": [], "form": { "kind": "repeater", "repeater": "findings", "overrides": { "<the version's hash>": { "repeater": "defects" } } } }
```

A followed rename writes the binding's own path anew, and names the
version it reviewed at that same path and the versions it knew at the old
one:

```json
{ "id": "name", "type": "string", "label": "Name", "nullable": true, "form": { "path": "technician.name", "overrides": { "<the old version's hash>": { "path": "inspector.name" }, "<the reviewed version's hash>": { "path": "technician.name" } } } }
```

report-spec validates it structurally and hashes it with the report: a
key that is no hash, both or neither of a path and nothing, nothing
printed of a field never null, and none at all are refused, and at most
`MAX_FORM_OVERRIDES` are held.

## What it does not do

- **Fetch.** Nothing here reaches the network. The host hands over each
  version and each submission, from its own store or from formancy's
  server, which serves a version's document by its number from 0.8.0 and
  lists a form's submissions, a page at a time from 0.11.0, but has no
  route for one submission.
- **Tell two versions apart by their answers.** A submission paired with
  another version is refused only where one of its answers has no field in
  that version. Two versions with the same paths are the host's to keep
  apart.
- **Apply a review.** A review offers; the host applies, through a
  report-core session, and a builder pane that shows one is later work.
  A generated draft keeps no base to merge a new version into, and
  nothing regenerates a report.
- **Follow a rename alone where it does not lift the refusal.** A field
  renamed and retyped in one version is offered no rename, since
  following it would still refuse; its other resolutions are.
- **Print nothing of a removed field from every later version at once.**
  Printing nothing names one version, so each later version that lacks
  the field too is refused until it is reviewed, or the field removed.
- **Tell a reused key from the field.** A key a version removed the field
  from, never reviewed, and a later version reused for another field,
  prints that field's answers as the report's; a review says so only
  against a version the report names that printed nothing of the field
  there.
- **Judge a retype by the answers.** A version that holds the field as
  text, retyped to a number, refuses each of its submissions whose answer
  spells none.
- **Finish fast at the format's bounds.** Each change of a field's type
  or nullability a review offers is compiled over the expressions it
  reaches: a report of 2,500 components each reading ten of 64 header
  fields, none of which may be null, reviewed against a version that
  removed every field, took 49 to 50 s (0048).
- **Find a relabel the report names no version of.** A relabel is offered
  for texts that say a label of a version the report names -- its
  provenance and its overrides' -- so a label a version the report was
  never reviewed against gave a field is not seen.
- **Lay a draft out for print.** A generated report is a first draft, a
  line for each answer under the form's own title; nobody would print it
  as it is, and an author makes it the report.
- **Print a file or a signature.** Both are refused until the host can
  approve them as image assets.
- **Read a yes-or-no radio as a boolean.** A radio prints its label or its
  value; only the Data provider reads Data's `"true"` and `"false"` as one.
- **Check a choice that offers nothing.** A select or a radio with no
  options in the document and no source takes any value but an empty one,
  as formancy's engine does from 0.8.0 (formancy.ai 0076, 0189): its
  stored value prints with `read: 'value'`, its label is refused, and an
  empty value is refused as `invalid-answer`, as it is for any choice.
- **Hold an answer to its field's pattern.** The bridge runs no
  `pattern`: an answer the pattern refuses, which formancy's engine never
  stores, prints. A version whose pattern can be made to backtrack, which
  formancy's server published until 0.12.0 refused one at publish
  ([formancy.ai 0226](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0226-a-pattern-is-analysed-as-it-runs.md)),
  is read like any other and costs a render nothing.
- **Read a row formancy nulled.** formancy nulls a repeater row it strips
  rather than shift its siblings; a submission holding one is refused, in
  any repeater it holds, whether the report reads that repeater or not.
- **Read a long rich text.** A rich text whose markup is longer than the
  runtime's `MAX_STRING_LENGTH` is refused before it is parsed, however
  short its words.
- **Read more than one repeater.** The detail reads one; a report of a
  form's other repeaters cannot be expressed in this version of the format.

**Licence.** Source-available, not open source: see
[`LICENSE.md`](../../LICENSE.md). It depends on formancy's Apache-2.0
`@formancy/spec`.
