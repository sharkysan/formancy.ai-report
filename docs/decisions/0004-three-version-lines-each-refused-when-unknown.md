# 0004 — Three version lines, each refused when unknown

- **Status:** accepted; the tuple a release was tested with is derived from the run that gated it, by [0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md)
- **Date:** 2026-10-14
- **Deciders:** Daniel Bacher
- **Verified by:** `packages/report-spec/src/version.test.ts`, which proves
  that a report of the version the package reads is read. A report of any
  other `reportSpecVersion` is refused with both versions named. A formancy
  form is refused as not a report, with its `specVersion` named. Anything
  without a `reportSpecVersion` string is refused, a version written as a
  number included. `scripts/upstream-deps.test.mjs`, in `pnpm test:repo`,
  proves that every `@formancy/*` dependency outside this workspace is an
  exact released version, and that only upstream versions the lockfile
  installs are exempt from pnpm's minimum release age. Each is proved on
  fixtures, then on the real tree.

  **Not mechanically enforced:**
  - **The upstream version.** No manifest here depends on an upstream
    `@formancy/*` package yet, so on the real tree the upstream-deps check
    checks an empty set, and the 0.5.0 below is the version planned, with
    nothing installed behind it.
  - **The form spec range.** No code here reads a form yet.
  - **The Data contract.** There is no Data dependency until Data publishes
    one ([0002](0002-depend-on-upstream-never-copy-it.md)).
  - **The Node floor.** The root `engines` field states it. pnpm's
    `engine-strict` is off, and no published package declares `engines`.
  - **The tuple in the CHANGELOG.** It is typed by hand and held by review.

## Context

A Formancy Report document meets three version lines, and none of them is a
package version.

- **formancy's form spec.** Every form carries `specVersion`, a string of
  digits that moves independently of formancy's packages
  ([formancy.ai 0009](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0009-independent-spec-version.md)).
  `@formancy/spec` 0.5.0 reads versions 1 to 4 and writes 4 by default.
  Formancy Data's generator writes 3, and its server serves no other, because
  a host whose renderer is still at 0.3.0 refuses a spec 4 document outright
  ([formancy.ai-data 0042](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0042-generated-forms-stay-on-spec-3-after-spec-4-is-released.md)).
- **Report's own format.** Every report definition carries
  `reportSpecVersion`. It is "0", the draft, in `@formancy/report-spec`. A
  report is its own document and not a form with pages, which 0002 already
  forecloses.
- **Formancy Data's contract.** This is what Data's runtime API and records
  look like to a reader. Data versions it in pieces today: a bindings version,
  2, and `/v1` routes. Report has no provider contract of its own yet, and
  Data has published nothing.

Package versions say none of this. `@formancy/spec` 0.5.0 reads four form
versions. Data at 0.1.0 writes one of them. A host at 0.3.0 reads three. Two
installs with the same package versions can disagree about whether a document
is readable, and only the number inside the document answers it. Plan item
R01 asks for the tuple a release supports to be written down (plan section
11.5).

## Decision

The three lines are independent, and each document says its version inside
itself. A reader that meets a version it does not know refuses the document,
naming that version and the ones it reads, and never reads part of it. That
is upstream's fail-closed rule
([formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md))
applied to versions. A field a version does not know could be the one that
hides a row or changes a total.

- **Report's format** is read by `@formancy/report-spec` alone. "0" is a
  draft: nothing written under it is promised to a later release. The first
  freeze makes it "1", and a frozen version keeps its meaning from then on.
- **A form** is read through upstream's validator at the pinned version,
  which refuses a version it does not know. Report accepts what that validator
  accepts and adds no reading of its own.
- **Data's contract** is read only by `report-data-provider`, which checks the
  version Data says and refuses one it was not built against.

Package versions alone never establish document compatibility. Each release
records the tuple it supports in its CHANGELOG section. The first tuple:

| Line | Supported |
|---|---|
| Upstream `@formancy/*` | 0.5.0, exact (0002): `@formancy/spec`, for the report hash ([0007](0007-a-report-definition-is-its-own-versioned-document.md)); `@formancy/expressions`, for every expression ([0009](0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| formancy form spec | none read yet; 1 to 4, as `@formancy/spec` 0.5.0 accepts them, when forms are. Formancy Data 0.1.0 generates 3 |
| `reportSpecVersion` | "0", the draft |
| Formancy Data | none until Data publishes 0.1.0; then exactly that release, which the provider is built against |
| Node | 22.13 or later |
| TypeScript | `~6.0.3`, the line the workspace catalog pins |
| Angular, React | `@angular/core` ^22 and `react`/`react-dom` ^19, as peers of the builders ([0012](0012-the-builders-are-native-and-share-one-session.md)); the versions each release was tested against are in its CHANGELOG section |
| pnpm | 12.4.2, the `packageManager` field |

Node is 22.13 rather than the 22.12 that formancy.ai-data runs on because of
`pdfjs-dist` 6.4, which the PDF reader of
[0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md) uses. Its
`engines` field says `>=22.13.0 || >=24`, so the root `engines` field was
raised from 22.12 with the renderer experiment. The engine and font versions
join the tuple with the renderer package.

## Consequences

**What it buys.**
- **One question per document.** Whether a document can be read is answered
  by the number in it, in an error message that names that number, and never
  by reading a changelog.
- **No silent change of meaning.** Upgrading a package cannot make a stored
  document mean something else. A version the package does not know is
  refused.

**What it costs.**
- **Four numbers.** A user meets three version lines and the package
  versions. Each answers a different question, and the tuple table exists
  because nobody can hold them in their head.
- **A draft can be abandoned.** Nothing written at "0" is promised to a later
  release, so an early adopter may re-author or migrate a report when the
  format freezes.
- **The tuple is typed, not derived.** Formancy Data derives its tuple from
  the run that gated the release
  ([formancy.ai-data 0035](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0035-a-release-report-is-derived-from-the-run-that-gated-it.md)).
  Here it is written by hand until that report arrives, so it can name
  something no run tested, and review is all that catches it.
- **The Node floor is advisory.** With `engine-strict` off, Node 22.12 installs
  without complaint. What `pdfjs-dist` fails on there has not been measured.
- **A refusal is a support call.** A document from a newer release fails
  loudly in an older reader. That is the point, and it still costs somebody
  an upgrade.

**What it forecloses.** Reading "what can be read" of a newer document, and
inferring compatibility from package version ranges.

## Alternatives considered

**Let the report's version follow the package version.** Rejected, for
formancy.ai 0009's reason: every package release would look as if it might
break stored reports.

**A report as a formancy form with pages, under `specVersion`.** Rejected in
0002, which forecloses widening the form spec. A report and a form will also
hash differently: the canonical hash, not yet written, is to be taken over an
envelope that names the format, `REPORT_FORMAT`.

**Read an unknown version as well as possible, ignoring unknown fields.**
Rejected: formancy.ai 0022. The field ignored could be the one that hides a
row.

**Accept only the spec 3 forms Data generates.** Rejected. A host's own forms
may be spec 4, and upstream's validator reads them. Refusing them would be
Report narrowing upstream for no reason of its own.
