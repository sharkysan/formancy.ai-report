# 0041 — A render's manifest names where its data came from, by identifiers alone: each submission of a formancy form with its form's id and the version that collected it, or the Formancy Data forms each dataset was read from; a digest of the data, the record's token, one form id for every submission and a source of free text lost

- **Status:** accepted; numbered while 0039 and 0040 were held by branches not yet merged; extends [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md) and [0016](0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)
- **Date:** 2026-10-21
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The data check.** `packages/report-runtime/src/data.test.ts`,
    "checkData: where the data came from". A formancy form's source is
    held as a frozen copy that later changes to the host's objects do not
    reach, its submissions naming two versions whose form ids differ, and
    a Formancy Data source by dataset; data that names no source has none.
    Each of these is refused as `invalid-source`, where it stands, in a
    final render and in a preview:
    - a submission's id that holds a space, an `@`, a `/`, a `:` or a
      letter beyond ASCII, or is a number;
    - a submission that carries its answers, or is not an object;
    - a version hash in capitals, with a prefix, or missing;
    - a submission's form id that is not one, or missing, and a form
      source with no submission;
    - a form source carrying data or naming one form for every
      submission, and a Data source naming a record, each by the
      container's path;
    - a Data form id that is not one, forms that are not an object, or a
      form named for no dataset, for a dataset the report does not
      declare, none for one it does, or none at all;
    - a provider the runtime does not know, no provider, and a source that
      is not an object;
    - an id or a form id of 129 characters, where 128 are accepted, and
      more submissions than the detail rows given, or more than one where
      none are, refused before any item is read; rows that cannot be
      counted are their own error and not the source's;
    - a submission named twice.

    A getter in a source -- on the provider, the submissions, the forms, a
    dataset's form or a submission's form among them -- a property that is
    not enumerable, a symbol key and an object or a list that throws when
    read are refused as `not-data`, once, where they stand, and no getter
    is run. Once
    `MAX_DATA_ERRORS` are listed, nothing more of a source is read. No
    message or path of a refusal holds a value of the source, nor a key
    its shape does not name. What the syntax lets through is a case too: a
    single word, a personal number, an IBAN and a file name as ids, and
    any 64 hex digits as a hash, are accepted, which is the cost below.
    Run against `main`'s `data.ts` on 21 October 2026, every case
    failed, on `unknown-property /source`, but that one, which passed
    there for want of anything to repeat. Each rule was then broken on its
    own and its case watched failing: a message that repeated the version
    hash, which is that case's, the check for a submission named twice, the bound,
    the submission id's syntax, keys the source does not know, a Data form
    for a dataset the report does not declare, an unknown provider read as
    Data's, the host's list kept where a copy is, the stop once the list
    of errors is full, a list that throws called invalid rather than not
    data, and a provider behind a getter read on; after review, the same
    day, a submission's form unchecked, one form for every submission
    accepted, the bound at `MAX_DETAIL_ROWS` rather than the rows, no
    submission allowed where no rows are given, rows that cannot be
    counted blamed on the source, a Data source naming no form accepted,
    an unknown key named in its path, and a getter reported again as a
    value missing, three ways; the files were byte-identical afterwards.
  - **The manifest.** `packages/report-runtime/src/resolve.test.ts`: the
    manifest carries the source as the check held it, in a final render
    and in a preview, and has none where the data names none. Watched
    failing with the manifest's line removed.
  - **One rule for a form's id and a version's hash.**
    `packages/report-spec/src/validate-declarations.test.ts`: report-spec's
    `isFormId` and `isSchemaHash`, which the runtime reads, accept exactly
    what a report's provenance accepts. Failed before they existed.
  - **The provider.** `packages/report-data-provider/src/read.test.ts`:
    the data names the forms it read, by dataset, and not the record's
    token; a final render's manifest carries it; a report of one record
    names one form, and a report of no dataset names no source; a form
    Data answers under another id, or under one that is no form id, is
    refused as `unexpected-form` before any record is read. Each case
    failed before `read.ts` did it, and again with its check removed.
  - **The install gate.** `scripts/install-fixture/consume.ts`, in the
    Node host: the quotation read from a server answering Data 0.1.0's
    routes renders with a manifest naming its two forms; a form source a
    host names reaches the manifest as given; and one holding a person's
    name, with its space, where a submission's id stands is refused as
    `invalid-source`. Run against the packages as they were before this
    record, on 21 October 2026, it failed at the Node host's type-check:
    no `DataSource` exported, and no `source` on `ReportData` or
    `RenderManifest`.

## Context

Plan 14 keeps a manifest beside every PDF, which says what it was
resolved from, and 0010 wrote one: the report's hash and version, the
locale and zone, the mode, the data's consistency and completeness, and
every parameter. It says how the data was read and nothing of where from.
A PDF kept for years cannot say which form version collected its answers,
or which submission it printed.

Plan 13.2 names what an envelope of data carries in groups. Its
**identity** is the dataset's id, the contract's version, an execution id
and the provider's version. Its **provenance** is the binding's revision,
a fingerprint of the metadata, the policy's revision and a digest of the
captured payload. Its own caveat: "A digest without retained data or a
retrievable source snapshot cannot reproduce an old report."

0.3.0 reads a report's data from a formancy form's submission, against the
exact version that collected it (plan items R11 and R12). The package that
reads submissions comes later. This record is the first step, so that what
it reads has somewhere to be named. What the two sources offer:

- **formancy.** A form version's identity is its `schemaHash`, which
  formancy's server stores beside each version. A submission has an id,
  which the server makes as a UUID. As 0.3.0's plan reads them, one render
  reads one submission, its answers in the header and one repeater's rows
  in the detail, or many submissions, one a row, which can answer
  different versions. A version may change the form's id: `diffSchemas`
  reports `document.identityChanged` as lossy, not breaking (formancy.ai's
  `packages/spec/src/diff.ts`), and formancy's server keeps every version
  of a form under one record of its own, whatever the schema's id says.
- **Formancy Data 0.1.0.** A published form has an id. It has no version:
  `GET /v1/forms/:id` answers the form, the operations, the fields the
  person may read, the list and deletion, and nothing that names which
  publication it is. Data publishes a form only under its own id. A
  record is addressed by a token, which spells the record's key
  (formancy.ai-data 0012), and a key can be a customer's email address or
  another value of theirs.

0010 holds the data to data minimisation: nothing a report does not print
rides into a render, a cache or a log. A manifest is kept and passed on
longer than any of those.

Planned and not built: the server's artifact of a render (plan item R16),
which keeps the manifest beside the PDF, and an export of a render's
tables, taken from the same resolution. Each would carry this source and
define none of its own.

## Decision

`ReportData` gains an optional `source`, a `DataSource`. `checkData` holds
it, and `RenderManifest` carries it as `source`, absent where the data
names none. It is one of two kinds, by its `provider`:

```ts
{ provider: 'formancy-form', submissions: [{ id: 'b682a5ed-…', form: 'site-visit', formHash: '767a65b3…' }] }
{ provider: 'formancy-data', forms: { header: 'order', detail: 'order-line' } }
```

- **A formancy form** names each submission the data was read from, once,
  with the form's id and the `schemaHash` of the version that collected
  it: one entry for a report of one submission, one a row for a report of
  many, whatever versions they answered. The form's id is the
  submission's and not the source's, since a version may change it.
- **Formancy Data** names the published form each dataset the report
  declares was read from, by dataset, and no form for one it does not.

**Identifiers alone, checked by their syntax.**
- A form's id is report-spec's `FORM_ID` and a version's hash its
  `SCHEMA_HASH`, the rules a report's provenance is held to. report-spec
  now exports them as `isFormId` and `isSchemaHash`, so the two cannot
  read a form differently.
- A submission's id is the runtime's own syntax (`source.ts`): letters,
  digits, `.`, `_` and `-`, starting with a letter or a digit, at most 128
  characters. They are a form id's characters by choice and not by rule,
  since that one is formancy's to change. So a space, an `@`, a `/`, a
  `:`, a letter beyond ASCII and a 129th character are refused, and with
  them a full name, an email address and a sentence. A UUID, a ULID or a
  number fits, and so do a single word and a personal number: the syntax
  does not see meaning, which is a cost below.
- Nothing else: a key a provider's source does not name is refused, by
  its container's path, since the key may be the answer. An answer, a
  payload or a token has no key to ride under.

**Bounded, and refused rather than cut short.** No more submissions than
the data gives detail rows, or one where it gives none: a report of one
submission reads its repeater's rows, and a report of many reads one a
row, so a source naming more says something of the render that is not
so. Never more than `MAX_DETAIL_ROWS`, therefore. A list past the bound is
refused before any item is read; where the rows cannot be counted, which
is their own error, the source is held to `MAX_DETAIL_ROWS`. At least one
submission, each named once. A Data source names at least one form.

**Fail closed.** A provider the runtime does not know is refused, never
read as one it does. Data that names no source is accepted, as it was.

**Read as the data is.** Once, through property descriptors, a getter never
run, held as a frozen copy the host's later changes do not reach; refused
as `invalid-source`, or `not-data` for what JSON cannot hold, at a JSON
Pointer. What is not data is said once, where it stands, and no message
or path holds a value of the source, nor a key its shape does not name. A
preview is held as a final render: a wrong source is wrong in either.

**The Data provider fills its own.** `readReportData` names the forms it
read, by the id the binding addressed each by. Data 0.1.0 publishes a form
only under its own id, so a form Data answers under another id, or under
one that is no formancy form id, is refused before any record is read, as
`unexpected-form`, a new code of the provider's, rather than named in a
manifest or planned from. Data read from no form, for a report that
declares no dataset, names no source. Never the header record's token.

**What the form bridge fills.** The package that reads submissions,
`@formancy/report-forms` as 0.3.0's plan calls it, names each submission's
id as the host hands it over, `form` as the id of the version it validated,
and `formHash` as the `schemaHash` it computes of that version itself,
never one handed over. One entry for one submission, its repeater's rows
in the detail; one a row for a report of many, whose versions may differ
in their form's id as in their hash. The shape takes both, and a version
that only renamed the form, without a change.

**What the runtime does not check.** That a source is true: that the host
read what it names is the provider's statement, as its completeness is.
Nor that a form source's form is the one the report was generated from:
which form a report reads is its binding's to say, which comes with the
form bridge.

## Consequences

**What it buys.**
- **A PDF that says where its data came from.** Kept with its manifest, a
  report printed from a submission names the form, the exact version and
  the submission, and one printed from Data the forms it read. A reprint
  can be asked of the same version, which plan 12.2 asks for its labels.
- **One definition for what comes later.** The server's artifact and an
  export take the source from the resolution, as the manifest does.
- **No answer by its shape.** The manifest still holds nothing the data
  printed, and a source holds no key but the ones its shape names. What
  an identifier a host chose says is the next cost.

**What it costs.**
- **Identifiers by their syntax, not their meaning.** A host whose
  submission ids hold a `:` or an `@`, or run past 128 characters, maps
  them to ids that fit, or names no source. What fits passes whatever it
  means: a single-word name, a personal number such as an AHV number, an
  IBAN, a telephone number or a file name as an id, and any 64 hex digits
  as a version's hash, the SHA-256 of an email address among them, which
  is the fingerprint of the customer's data the alternatives below
  reject. A host that names its submissions by such a value puts it in
  every manifest; `data.test.ts` holds that it passes.
- **A large manifest for many submissions.** Each submission is named,
  with its form's id and its version's hash. At the bound, 100,000
  submissions with UUIDs and the form `site-visit`, the manifest was
  14,400,305 bytes of JSON, 144 a submission, of which the form's id and
  its key are 20 and the hash and its key 78; with ids and form ids of
  128 characters, 35,400,305 bytes, 354 a submission. `checkData` took a
  median of 301 ms for 100,000 rows of one field with the UUIDs' source,
  where the same rows with none took 134 ms, and `resolveReport`, for a
  report that prints nothing from its data, 293 ms against 134 (runs two
  to six of six, from the built package, Node 24.21.0, an Intel i9-10900K
  running two other workflows' builds and tests, 21 October 2026; a
  second run gave 305 and 135 ms, and 317 and 166).
- **As many submissions as rows.** A host that reads several submissions
  into one row, or names submissions whose rows it left out, is refused,
  and names the submissions it printed or no source.
- **No record, and no version, from Data.** The manifest names Data's forms
  and not the record a report printed, nor which publication of each form
  answered, which Data 0.1.0 does not say. A host that must trace a PDF to
  its record keeps its binding beside it.
- **A server that is not Data 0.1.0 refused.** A form answered under
  another id than the one asked was read before this record, and is
  refused as `unexpected-form` now, before any record.
- **Carried as given.** A source a host writes by hand reaches the manifest
  as written, if its syntax holds. The provider's tests are what hold the
  provider's source true.
- **An envelope 0.2.0 refuses.** 0.2.0's runtime refuses data that names a
  source, as `unknown-property`, so a host that names one needs this
  release's runtime; the Data provider of this release hands over data
  that does.
- **Not in it.** A digest of the data, and why, is below. The provider's
  and the runtime's versions are not in it: the release report names what
  a release was tested with, and a host keeps what it installed. An
  execution id is the server's to give, when there is one. A capture time
  is not in it: a submission's time is formancy's to keep, and Data 0.1.0
  reads its pages at several moments.

**What it forecloses.** A manifest that holds an answer by its shape. A
third kind of source without a decision: it is a new provider, which this
runtime refuses.

## Alternatives considered

**A digest of the captured data, as plan 13.2 lists.** Rejected. Without
the data kept, a digest reproduces nothing and shows a reader of the PDF
nothing; with it kept, the server's retention decides what is kept and can
name it there. In every manifest it would be a fingerprint of the
customer's data, which data minimisation keeps out.

**The header record's token in a Data source.** Rejected: the token
spells the record's key (formancy.ai-data 0012), and a key can be the
customer's data.

**The form id Data answers, rather than the one the binding asked for.**
Rejected: the records are read through the id asked for, and a server
answering another would name a form the records did not come from. Data
0.1.0 answers its own, so the two are held equal and a difference refused.

**One form id for every submission** (`{ form, submissions: [{ id,
formHash }] }`), as this record was first written. It holds the id once,
20 bytes a submission fewer. Rejected: a version may change the form's
id, so a report of many submissions across such versions would name one
version's submissions by another's id.

**The form bridge refusing submissions across versions whose form ids
differ.** It would keep the id once. Rejected: a version that only renamed
the form changes no field a report prints, and 0.3.0's plan lets such a
version print without a review (its Q5); refused for the manifest's
shape, it would block a report that prints right.

**Versions, each with its submissions** (`versions: [{ formHash,
submissions }]`). It holds each hash once, a smaller manifest for many
submissions. Rejected for one entry a submission: each says which version
collected it without a join, and the order is the provider's reading
order, which a grouped list loses.

**One version and one submission.** It names a report of one submission
as well. Rejected: a report of many submissions, which the form bridge
plans, would change the shape.

**At most `MAX_DETAIL_ROWS` submissions, whatever the rows**, as first
written. Rejected: a report of one row could name 100,000 submissions, a
manifest of megabytes that says something of the render that is not so.

**An unknown key named in its path**, as the rows name a field the
contract does not declare. Rejected for a source: its shape is closed, so
the key tells a person nothing the message does not, and it may be the
answer.

**A source of free text, or of any keys.** Rejected: nothing could hold it
to identifiers, and anything would ride into the manifest.

**The source as a resolve option, beside the data.** Rejected: a provider
makes the data and its source together, and handed apart they can be
paired wrongly. In the envelope it travels with what it describes, as the
consistency does.

**A source required in a final render.** Rejected: data a host captured
from its own systems has no provider to name, and every host would be
refused.

**A host's own provider, with an opaque id.** Not now. Its id could not be
told from an answer, and fail closed refuses a kind the runtime does not
know; a host that captured its data names none.

**Holding a form source to the report's provenance.** Deferred to the form
bridge's binding, which says which form a report reads: a report started
blank, or from one form, may read another's submissions.
