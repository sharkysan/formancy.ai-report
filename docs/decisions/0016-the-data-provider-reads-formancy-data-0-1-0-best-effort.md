# 0016 — The Data provider reads Formancy Data 0.1.0 best-effort, as the person, and checks what it can before it reads a record

- **Status:** accepted
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **`packages/report-data-provider/src/read.test.ts`.** It runs the real
    `@formancy/data-client` 0.1.0 over a fixture that answers Data 0.1.0's
    routes (`test-support.ts`). The client calls a reply that is not in
    Data's shape `unexpected`, so a fixture that drifts from the contract
    fails. Every case was watched failing against a provider that refused
    everything. The cases cover:
    - an order and its lines read into data that a final render resolves,
      without the column the report does not declare, and with the
      customer's label rather than its token;
    - every page, at offsets 0, 50 and 100;
    - the cap, as incomplete data that a final render refuses and a preview
      prints;
    - `parent: 'header'` by the menu's one field, and refused when the menu
      names none or two;
    - each binding mismatch, an unreadable field, an image field and an
      unlisted form, all refused with no record request;
    - Data's refusals, on any request and on a later page, with nothing
      handed over;
    - labels at most 50 tokens a request, and an unseen label refused
      without the token in the error;
    - an abort, which rejects;
    - a decimal past the report's scale, handed over unchanged and refused
      by the runtime.
  - **The install gate.** `scripts/install-fixture/consume.ts` reads the
    quotation starter's data from a server answering Data 0.1.0's routes.
    It uses the packed provider and the `@formancy/data-client` 0.1.0 that
    npm installs from the registry, type-checked with `skipLibCheck` off.
    What it reads must be the quotation's own data, labelled best-effort,
    and must render. The package README's example is those lines
    (`scripts/readme-example.test.mjs`, watched failing with one argument
    changed in the README).
  - **The licence admission**, which extends
    [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md),
    is held by `scripts/dependency-licences.test.mjs`. It was watched
    failing with each rule mutated in turn: admission at any version, no
    digest compared, no route checked, unused admissions kept, and the
    pointer not read.

## Context

Plan section 23.4 puts `@formancy/report-data-provider` in the first
release as R13-lite. It reads a published Formancy Data form's records
through `@formancy/data-client` at exactly Data 0.1.0, using Data's current
runtime contract (the menu, read, list and lookups). The user's instruction
was to wait until Data 0.1.0 was released, and to watch for it. It was
published on npm on 16 October 2026 at 06:50 UTC, as `@formancy/data-client`
and the `@formancy/data-core` it depends on.

What Data 0.1.0 offers a reader of records, read from the published
declarations and Data's decisions:

- **The route families.**
  - `GET /v1/forms` is the person's menu, with each form's children and the
    lookup field that names their parent (formancy.ai-data 0045).
  - `GET /v1/forms/:id` is the published document, the fields the person may
    read, and whether they may list records (0044).
  - `records/read` reads one record by its token.
  - `records/list` reads fifty rows a page with `hasMore`, and no total.
  - `lookups/:source/resolve` gives the labels of the tokens the person may
    see, and leaves the others out.
- **No snapshot.** Nothing reads a header and its lines in one transaction.
  Data's snapshot export is D01–D04, not built.
- **Values as the generated form holds them** (formancy.ai-data 0008):
  - decimals and large integers as canonical strings;
  - dates as `YYYY-MM-DD`;
  - an instant as `…Z`;
  - a time of day as `HH:MM`;
  - a float as a number;
  - a nullable yes-or-no as a radio of `"true"` and `"false"`;
  - a lookup as its token.
- **Policy per request.** The server asks the policy on every request
  (formancy.ai-data 0022), as the person whose bearer token the client
  sends.

On Report's side, the runtime holds every value to its field's type, once
([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
It has a consistency label for exactly this: `best-effort`, "explicitly
neither".

## Decision

`readReportData(client, report, binding, { cap, signal })` reads a report's
data from Data through a client the host made, with the host's token. It
returns `ReportData` labelled `best-effort`, or every reason it will not,
each with a JSON Pointer and never a value.

**It checks what it can before it reads a record:**
- that the report is valid;
- that the cap is from 1 to `MAX_DETAIL_ROWS`;
- that every declared dataset is bound and nothing else is;
- that every declared field is one the form lets this person read, and no
  field is an image, which Data 0.1.0 cannot fill;
- that the detail form offers this person a list;
- that `parent: 'header'` finds exactly one field in the menu.

**It then reads:**
- the header record;
- the detail rows a page at a time, moving by the page asked for, until
  Data says none follow or the cap is reached;
- each lookup's labels, distinct tokens, at most `LIST_PAGE_SIZE` a
  request.

A refusal anywhere hands over nothing.

**It hands values over as Data spells them**, with two translations that
need knowledge of Data's contract, which only this package may have:
- a yes-or-no radio becomes a boolean for a field the report declares
  `boolean`;
- a lookup becomes its label.

A label the person may not see is refused, naming the field and where it
first is.

**Its dependency** is `@formancy/data-client` at exactly 0.1.0 (0002), with
the release-age exemption pnpm writes for a release adopted on its first day
(formancy.ai-data 0055).

**Its licence is admitted by 0006's guard, as 0006 asked.**
`FORMANCY_DATA` in `scripts/dependency-licences.mjs` admits each Data
package at one exact version under three conditions:
- its `SEE LICENSE IN LICENSE.md` file hashes to the digest the review read;
- the review read the Formancy Data Source-Available Licence Version 1.1,
  the same file as Data's tag;
- it is reached only from `@formancy/report-data-provider`.

## Consequences

**What it buys.**
- **A report from Data without glue code.** A host binds a report to two
  published forms and gets the data the runtime renders. That data is held
  to the same contracts as any host's data.
- **Refusals before reading.** A typo in a binding, a field the policy
  hides or a form the person may not list is named before any customer
  record is read.
- **No new authority.** The provider is exactly as authorised as the token
  the host supplies. Data's policy decides every answer, so a browser
  render is as safe as the host's session and no safer.

**What it costs.**
- **Best-effort data.** The header, each page and each label come from
  different moments. Pages move by offset, so a row inserted or deleted
  between two pages can be printed twice or not at all, and a total can mix
  states. The data says `best-effort`, and the manifest carries it. A
  consistent capture waits for Data's snapshot export.
- **Requests grow with the report.** A report of `n` lines takes `n / 50`
  list requests and a resolve for every 50 distinct tokens of each lookup.
  Every request runs the policy again. Nothing here measured how long that
  takes.
- **Two licences in production.** The provider depends on Data's packages,
  which are under the Formancy Data Source-Available Licence. A host that
  runs it in production needs a production licence for Data as well as for
  Report. The rightsholder is the same and the terms are the same, so it is
  one agreement type, not two families. The admission is the first licence
  the policy reads other than a permissive one, and it is keyed to one
  version, so every Data upgrade is a fresh review.
- **Some columns cannot print.**
  - A float is a number, which the runtime refuses for a decimal.
  - A repeater's rows are not a report's fields.
  - An image has no asset.
  - A label the person may not see refuses the whole report rather than
    print nothing.
- **A fixture, not Data.** The provider's tests and the install gate run
  against a server that answers Data 0.1.0's routes in Data's shapes and
  nothing more: no database, no policy, no concurrency. That Data's answers
  are what its decisions say is Data's to prove (formancy.ai-data 0003).
  Nothing here has run against a real Data server, which R13's full gate,
  on PostgreSQL and SQL Server, will.

**What it forecloses.** A Data release other than 0.1.0. The client speaks
0.1.0's routes, and a newer Data that changes them is refused by the
client's shape checks as `unexpected`, or by its server. Moving to a new
Data release is a release of this package, with a new admission.

## Alternatives considered

**Build against Data's main branch, or a git dependency, before the
release.** Rejected by the user ("wait until version 0.1.0 is released")
and by 0002: a build that depends on what happened to be on one machine.

**Copy the client, or call the routes with `fetch` directly.** Rejected:
0002, and the client already holds Data's rules for a host. It sends the
token per request and never in a URL, refuses a name that is not one path
segment, checks the shape of every reply and stops a lookup on an abort
(formancy.ai-data 0029, 0061). A second reading of those rules would
disagree with Data's first.

**Print the lookup's token.** Rejected: a report would print an opaque
string where a person expects a name, and a host would resolve the labels
itself, in every host.

**Print nothing where a label is hidden.** Rejected: a report that silently
drops a value is the failure CLAUDE.md names. The person sees the field
named and can ask for access, or the author can leave the field out.

**Admit Data's packages through `EXCEPTIONS` as a permissive licence.**
Rejected. An exception corrects metadata to what a licence file says, and
Data's file says it is source-available, not MIT. Recorded as MIT, it would
be a false statement in the one list that exists to hold true ones.

**Wait for Data's snapshot export (D01–D04) and ship no provider until
then.** Rejected by the plan: 0.1.0 is a developer preview, and a provider
that says it is best-effort is worth more to an evaluator than none. Its
label travels with every render.
