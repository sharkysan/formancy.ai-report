# @formancy/report-forms

Formancy Report's form bridge. It reads a report's data from a
[formancy](https://github.com/sharkysan/formancy.ai) form's submissions,
each against the exact form version that collected it, as the host hands
them over, and hands over the data `@formancy/report-runtime` renders
from, or every reason it will not. No framework, no Node, no network: the
bridge fetches nothing. What it decides, and why, is decision
[0042](../../docs/decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md).

**The host hands the documents over.** For a report of one submission,
the form version the submission answered and the submission, `{ id, data
}`, as formancy stored it: its answers fill the header and one repeater's
rows the detail. For a report of one row per submission, every version
they answered and the submissions, each with its version's `schemaHash`,
by which it is paired with its version. A host reading formancy's own
server keeps each version's document beside its submissions; formancy
0.7.0's API serves the current version's schema alone.

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
its type does not read is refused, naming the field and the version's
hash, before any answer is read, as `version-lacks-field` or
`version-retypes-field`. A version that changed nothing the report reads
prints; a field it added is never read by itself. A path is never guessed
from a name.

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

## What it does not do

- **Fetch.** Nothing here reaches the network. formancy 0.7.0's server has
  no route for one submission or an old version's schema; the host keeps
  them.
- **Tell two versions apart by their answers.** A submission paired with
  another version is refused only where one of its answers has no field in
  that version. Two versions with the same paths are the host's to keep
  apart.
- **Review a new version.** A version that moved a field the report reads
  is refused until the report is changed; the review that lifts it is
  later work.
- **Print a file or a signature.** Both are refused until the host can
  approve them as image assets.
- **Read a yes-or-no radio as a boolean.** A radio prints its label or its
  value; only the Data provider reads Data's `"true"` and `"false"` as one.
- **Check a choice that offers nothing.** A select or a radio with no
  options in the document and no source takes any value, as formancy's
  engine does (formancy.ai 0076): its stored value prints with `read:
  'value'`, and its label is refused.
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
