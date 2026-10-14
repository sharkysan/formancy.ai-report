# Working in this repository

## What this is, and what it is not

Formancy Report is a **paid, source-available** module that designs and
renders paginated PDF reports. It builds on the Apache-2.0
[formancy](https://github.com/sharkysan/formancy.ai) packages and, optionally,
on [Formancy Data](https://github.com/sharkysan/formancy.ai-data). It lives
in its own repository, on Formancy Data's licence terms, so that formancy's
licence and its promise -- a self-hoster never hits a paywall -- stay true
without qualification
([0001](docs/decisions/0001-a-paid-module-in-its-own-repository.md)).

Three things follow, and each has a guard:

- **Depend on upstream, never copy it.** `@formancy/*` packages are
  dependencies at **exact** released versions; `scripts/upstream-deps.mjs`
  refuses a range, a `workspace:` link or a path
  ([0002](docs/decisions/0002-depend-on-upstream-never-copy-it.md)). That
  includes Formancy Data's packages, so Report has no Data dependency until
  Data publishes one. A generic improvement goes upstream through that
  repository's own contribution rules, not into a patched copy here.
- **Every package declares the source-available licence**, never Apache-2.0.
  `scripts/verify-licenses.mjs` refuses a manifest that says otherwise and a
  tarball without `LICENSE.md` and `NOTICE`. The realistic mistake is a
  manifest copied from upstream.
- **Never call it open source.** Not in a README, a package description, a
  commit message or a landing page. "Source-available" is the phrase, and the
  licence table in `README.md` is the explanation.

A dependency must allow both public source and licensed production use:
permissive licences only, no GPL or AGPL, no source-available or
non-commercial licence. A commercial component needs written redistribution
rights. Fonts must be licensed for embedding in generated PDFs. Held by review
until the first third-party runtime dependency arrives with the renderer, and
by a guard from then on.

## How the pieces fit

Almost nothing is built. `@formancy/report-spec` defines the format, validates
a report structurally and hashes it
([0007](docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md));
that is all the product code there is. The package path the plan proposes,
each package depending only on those before it:

1. `report-spec` -- the versioned definition, structural validation, canonical
   hashing and migrations. No framework, no driver, no PDF engine, no Node.
2. `report-core` -- pure document commands, atomic history, diagnostics.
3. `report-builder-core` -- selection, palette, properties, geometry, review
   state; then `report-builder-react` and `report-builder-angular`, native,
   never depending on each other.
4. `report-runtime` -- typed datasets, expressions, grouping, exact aggregates,
   a renderer-neutral output.
5. `report-render-pdf` -- the one chosen engine's adapter. It takes resolved
   input and approved asset bytes, never a database connection or a URL.
6. `report-server-core` / `report-server`, `report-client`, `report-viewer`,
   `report-ai`.
7. `report-data-provider` -- the only package allowed to depend on Formancy
   Data's contracts, and only once Data has released them.

A package arrives with the decision record that says what it may import. When
this map goes stale, the rename is the edit to make here.

## Every change keeps the documentation true

A change is not done until the documents that describe it say so. Update them
in the same pull request as the code, not in a follow-up:

- **`README.md`** when behaviour, a package or a command changes — including
  the *Status* paragraph, which describes one point in time and no other.
- **`CHANGELOG.md`** — a line under *Unreleased* for anything a user or
  integrator would notice, with the reason attached, not only the what. A bump
  of an upstream `@formancy/*` version is always noticed.
- **Decision records** (`docs/decisions/`) — a new record for every decision
  someone could helpfully undo, in the format `docs/decisions/README.md`
  describes: next free number, the cost paragraph, the alternatives, and a
  **Verified by** line naming the test or gate that fails if it is violated.
  Add it to the index. A decision that changes an old one marks the old record
  `superseded by NNNN` or `reversed` rather than editing it away. A decision
  that depends on another repository's record cites it as `formancy.ai 0003`
  or `formancy.ai-data 0035`.

Keep the voice of the existing documents: say what it costs and what it does
not do, and never claim more than a test shows.

## A claim in prose is backed by something that fails

Documentation drifts silently, because prose does not break. So where a document
states a fact about the repository, something fails when it stops being true,
and the document says what. Three shapes, in order of preference:

1. **Derive it.** `codecov.yml` is generated from the workspace by
   `scripts/codecov-config.mjs`; the README's licence sentence is generated
   from `LICENSE.md` by `scripts/licence-status.mjs`.
2. **Check it.** `scripts/codecov-config.test.mjs` fails when the committed
   file is not what the generator produces; `scripts/check-cla.test.mjs` fails
   when `CLA.md` changes under a signature; `scripts/upstream-deps.test.mjs`
   fails on an inexact upstream version. All of them run as `pnpm test:repo`,
   and CI runs that — **a guard that is not a gate is a comment.**
3. **Measure it.** Below.

Counts written into prose go stale. **Prefer wording without a number.** Where a
number is the point, derive it; where that is impossible, date it.

**When you write a guard, make it fail first.** Revert the thing it guards,
watch it fail, put it back. A test that has never failed has not been shown to
test anything. And derive the fact from the code or the data, never from
wording: a check that matches a phrase passes for the wrong reason the moment
the phrase appears somewhere else.

## Measure before you write a number

Numbers here are measured, not estimated. The plan this repository started
from estimates its effort in person-weeks and its render times as targets to
test; those are a plan's numbers and they belong in the plan. A number in this
repository — a timeout, a page limit, a render time, a row cap — comes with how
it was measured, on what, and when.

## A rendered report is proved on the PDF it produced

The rule this repository will hold once there is a renderer, as Formancy Data
holds its rule about real databases. It becomes decision 0003 with the
renderer experiment.

- A claim about a report's output is checked on the PDF the chosen engine
  produced: extracted text for rows and totals, page images for layout and
  overlap. Not on the engine's input document, and not through a mocked engine.
- Text extraction alone cannot see overlapping text, and pixels alone cannot
  prove a total. A layout claim needs both.
- Never silently drop, clip or truncate content. A report that cannot fit says
  so in a diagnostic; a production render with incomplete data refuses.
- Exact values -- decimals, large integers -- travel as strings with their type
  and are never converted through JavaScript `Number`, as in Formancy Data
  (formancy.ai-data 0008).

## Secrets, identifiers and untrusted input

- **Nothing in a package reads configuration.** The composition root reads it,
  once. A connection string, a token or a row of customer data in a log line,
  an error message or a test fixture is a defect.
- **Templates, expressions, datasets, fonts and images are untrusted**, even
  when an administrator wrote them. Expressions are typed, bounded and run no
  code. Assets are referenced by approved identifier and never fetched by
  address. Nothing in a package reaches the network.
- **Identity comes from the host, verified.** A tenant, a role or a permission
  supplied by the browser is never a decision's input.
- **Fail closed.** An unknown report version, component kind or provider
  contract is refused, never partly rendered. Upstream's
  [0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)
  is the rule and this repository inherits it.

## The user interface is formancy.ai's concept, applied

There is no UI here yet. When the Studio and the builders arrive, they are
formancy.ai's concept applied, as Formancy Data's apps are, not a new one:

- **The same room.** A dark bench, glass panels, violet for what the person
  acts on and teal for what the server did, with the builder's panes from
  `workbench.css` recoloured only through its `--wb-*` variables and not one
  rule overridden for colour.
- **The page is the document, not the room.** What prints is the report's own
  serialisable styles. The editor's CSS, and the host's, never reach a
  customer's printed output.
- **Keyboard first, accessible name only.** Every drag has a keyboard path
  (formancy.ai 0046). Tests find elements by role and accessible name and
  nothing else, and axe runs in the suite.
- **Angular and React are both native**, over one report session, and neither
  depends on the other. The cross-framework test -- edit in Angular, switch to
  React, undo, switch back -- comes with the first builder.
- **One shell for every page of the site** (formancy.ai 0106).
- **A number on a page is derived**, never typed.

What will hold these, brought with the first UI from formancy.ai-data: the
browser gates, the palette guard and the README pictures' check.

## Branch names

Name a branch after what it changes, with a prefix for the kind of change:
`feat/report-spec-model`, `fix/table-header-repeat`, `docs/licence-faq`.
Not a generated name: the branch is what a reviewer sees first.

## Branch from `main`, and target `main`

No stacked pull requests. Branch from `main`, target `main`, and where a branch
replaces another say "supersedes #N" in the description rather than stacking.

**A merged branch is deleted by the merge.** GitHub deletes the head branch
when the pull request merges, a repository setting that nothing here can
check (formancy.ai-data 0036; `.github/REPO-METADATA.md`). Never delete a
remote branch by hand. Remove the local branch and its worktree once
`gh pr view N --json state` says `MERGED`, and not before.

**Commit as `Daniel Bacher <dbacher@gmail.com>`**, never
`daniel.bacher@ergon.ch`. The CLA record names that address, and the check
reads commit authors. This repository's local git config sets it; the global
one does not.

**No tool attribution.** No "Generated with Claude Code" line or session link
in pull request descriptions, and no `Co-Authored-By: Claude` or
`Claude-Session` trailers in commits. The author is the person above.

## Tests, and what the bar actually is

**Coverage is reported, not gated.** There is no threshold in
`vitest.coverage.ts` and none is wanted. The bar is this:

- **New behaviour arrives with a test that fails without it.** Test-first, and
  the failure observed.
- **Every case says which failure it prevents**, in a comment, in the same
  voice as the code. "tests the happy path" is not that; "a formancy form read
  as a report would render as an empty one" is.
- **A code path no test reaches is a claim nobody checked.** If it is hard to
  reach, that is usually the design saying something.
- **A suite cannot pass empty.** No `passWithNoTests`: a package with a
  `test:coverage` script has tests.
- Run `pnpm test:coverage` for what you changed and read the report. A file
  whose number dropped is the question, not the failure.

### When the test is wrong and the code is right

It happens. When a test disagrees with the code, work out which is wrong before
changing either. Match the whole property, not the shape it usually has.

## The code reads as though a senior wrote both halves

The standard is not "it works". It is that a senior engineer who knows
pagination, PDF and both frameworks recognises the shape immediately and finds
nothing to explain away.

**One decision, one place.** Grouping, aggregates and rounding are decided once
in the runtime, never again in a builder or the server. The question is never
"is this repeated" but **"if these two ever disagree, would anybody find
out?"**

**No interface with one implementation**, no layer that only forwards, no
abstract base class for two concrete cases. Version 1 has one PDF engine; its
adapter is a package boundary, not a plugin system.

**Duplication is cheaper than the wrong abstraction.** The Angular and React
bindings are written twice on purpose; the behaviour they bind is written once.

### Size is a signal

**600 lines** for a source file, tests excluded; `scripts/source-size.test.mjs`
fails past it. Split by **the reason to change**, never by line count. The
same applies below the file, held by review: a function past about 60 lines, a
`switch` growing a case per component kind, a class whose name needs "and" to
describe it.

## Running one thing

Packages import each other through `dist/`: every `exports` map points there
and nothing aliases a workspace package to its source. A change in one package
is invisible to another's tests until it is built again, so either run
`pnpm build` or let turbo build the dependencies first:

```bash
pnpm exec turbo run test --filter=@formancy/report-spec                    # dependencies built, then that suite
pnpm --filter @formancy/report-spec test                                   # that suite, against dist/ as it stands
pnpm --filter @formancy/report-spec exec vitest run src/version.test.ts    # one file
pnpm --filter @formancy/report-spec exec vitest run -t "a test's name"     # one case
```

## Checks before pushing

The gates are `.github/workflows/gates.yml`, which `ci.yml` calls on every
pull request and `release.yml` calls before it publishes, so a release passes
exactly what CI does:

- **`verify`** runs `pnpm build`, `pnpm typecheck`, `pnpm check:pkg`,
  `node scripts/verify-licenses.mjs` and `pnpm test:repo` in one job.
- **`test`** runs each package's `test:coverage` in a job of its own.
  `scripts/ci-test-jobs.test.mjs` fails when that list and the workspace
  disagree.
- **`install`** runs `pnpm test:e2e:install`.

`scripts/workflows.test.mjs` holds the workflows to their shape:
- every third-party action is pinned to a commit;
- no `${{ }}` appears inside a script;
- a release restores no cache;
- `release.yml` publishes only what its `check` job pinned.

Locally, run the same commands for what you changed.

`pnpm test:repo` also fails until two things are done:
- After `LICENSE.md` changes, run `node scripts/licence-status.mjs --write`.
- After a package is added, run `node scripts/codecov-config.mjs --write`, and
  add the package to the `test` job's matrix.

`test:e2e:install` is the only gate that looks at the packages from outside:
- it packs them;
- installs the tarballs into a plain npm project;
- type-checks it with `skipLibCheck` **off**;
- runs it under Node.

That matters because every other gate resolves a package through a symlink to
its source, so an `exports` map that is wrong for a consumer can be right for
the whole suite. It needs `pnpm build` first.
`scripts/install-fixture/consume.ts` is the consumer; a package's public entry
points belong in it.

## Conventions that live upstream

Do not restate these here; go and read them in formancy.ai and Formancy Data.

- **Layering: what may import what**, and why a core package has no
  `@types/node` — [formancy.ai 0008](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0008-layered-packages.md).
- **A name and never an address** for anything a document names —
  [formancy.ai 0077](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0077-options-may-come-from-a-named-source.md).
  An asset or a dataset in a report is a named reference the deployment
  resolves.
- **TypeScript is pinned to `~6.0.3`** for the reason the workspace catalog
  gives.
- **Releasing, provenance and signing** — [`RELEASING.md`](RELEASING.md).
- **Reporting a vulnerability** — [`SECURITY.md`](SECURITY.md).
