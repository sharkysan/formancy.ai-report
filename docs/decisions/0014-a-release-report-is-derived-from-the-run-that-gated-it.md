# 0014 — A release report is derived from the run that gated the release, and says what it did not test

- **Status:** accepted
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:** the `report` job in `.github/workflows/gates.yml`, which
  `ci.yml` runs on every pull request and every push to main and
  `release.yml` runs before its `check` and `publish` jobs: it builds the
  report from every other job's results and fails the run on anything in its
  problems. Not yet proved by a CI run: the first pull request run is the
  first time GitHub runs it. Built on one machine on 2026-10-16 from the
  synthetic run the tests use, and from a real local run (below).

  In `pnpm test:repo`, each case watched failing first, with its rule
  removed or its file changed:
  - `scripts/release-report/report.test.mjs` -- a green run, local and in
    CI, has no problems, and each defect gives exactly its sentence: a
    package's results removed, a test skipped, a test failed, a file failed
    with every test passed, vitest's `success: false`, a suite of no tests,
    a test file the checkout holds that its suite did not run, results that
    do not list the checkout's test files, a published package with no
    suite, a file collect missed, the guards' results missing unless verify
    is allowed missing, the install gate's record missing unless install is
    allowed missing, the install gate failed, a host install-hosts.mjs plans
    with no record and one it does not plan, a host with a step not done or
    its npm install unfinished, a builder's host that resolved no framework,
    resolved one other than its range's floor at the floor, or was installed
    at the other end, a plan that cannot be made, a tarball missing, a
    tarball at another version than the root manifest's, a published
    package whose `dist/` no job recorded, two jobs' `dist/` differing, a tarball's
    `dist/` differing, a `heldBy` test that failed, a limitations register
    that does not hold, a job of the gates that ended `failure`, a job the
    needs do not name, an artefact twice, an artefact no job leaves, an
    artefact holding another job's results, results of another run and of
    another commit, a gate's evidence file that did not run, a gate's job
    that failed, a gate's job that has no result on a machine unless that
    job is allowed missing, a partly evidenced gate whose evidence failed, a
    gates register out of order, a tag that is not the root manifest's
    version, a version with no changelog section, a rehearsal with neither
    its version's section nor Unreleased, a body past 125,000 characters on
    a release but not in CI, and a local report's results of two commits,
    of two runs, or holding one key twice. The install plan is
    install-hosts.mjs's own for the published manifests, each builder at the
    newest and the floor of its peer ranges.
  - `scripts/release-report/gates.test.mjs` -- the committed register
    holds; G1 to G7 and `legal` in order; at least one of evidence and a
    reason; no empty list of evidence; file evidence a test of a package
    with a suite or of the repository's guards; a job one of gates.yml's; a
    document committed; no `says`; a gate whose only evidence is a document
    `stated`, never `passed`; a gate with a reason `open` whatever its
    evidence, and `failed` when that evidence did not pass.
  - `scripts/release-report/limitations.test.mjs` -- an entry for every
    record and a record for every entry, each read as the record stands, one
    of limitations and `none`, none for a superseded record, a known area,
    one sentence each, no line twice, a `heldBy` that is a test a run reports
    on, and a stamp that rewrites one hash and nothing else.
  - `scripts/release-report/render.test.mjs` -- each derived limitation, its
    template removed: Node as each job ran it, the dependencies published as
    ranges, a clean install past the suites, the peers each install host
    installed, and what a builder's suites ran said only when they ran,
    every version a clean install resolved with the hosts that resolved it,
    no browser while gates.yml has no `browser` job, the jobs
    that built every published package (watched failing with every job of
    every package joined), each open and each stated gate; and the
    Markdown's "not measured" cells, its install hosts, its links to later
    records, its method and the dirty mark of a local run.
  - `scripts/release-report/collect.test.mjs` -- a test's meta and the
    coverage map left out, the `dist/` of a package packed from its `dist/`
    hashed as its tarball carries it, a private package's left out, each
    suite's test files listed from the checkout by name and not by its
    include -- a `.test.tsx` its include misses among them, a file git lists
    but the disk lacks left out, a test file in no package with a suite the
    guards' -- a turbo replay and a summary from before `--since` listed, a
    coverage summary written before its vitest.json started and a turbo task
    that does not span it refused as another run's, a job with no reader
    refused, and a local run reading the install gate.
  - `scripts/release-report/tested-on.test.mjs` -- every runtime dependency
    and every peer of every published package named, TypeScript's range read
    from the catalog, and the README's generated block current.
  - `scripts/release-report/verify-publish.test.mjs`,
    `scripts/release/pins.test.mjs` and `scripts/release/publish.test.mjs`
    -- a report of another commit, run, release or version, partial, local,
    or with problems; a report directory holding another file; a tarball
    missing, of no published package, or not byte for byte the install
    gate's; a body missing or too long; an SBOM without a runtime dependency
    or a direct upstream package, or naming one at another version; a pin
    keyed by file name alone; check's command line handed a report of another
    run or a tarball the gate did not install; the downloads not holding the
    report's directory to its pin; and the npm step not holding the report
    or each tarball to the install gate's record.
  - `scripts/workflows.test.mjs` -- the report's needs without `install`, an
    upload without `overwrite`, `${{ matrix.package }}` in a collect script,
    `merge-multiple: true`, `--force` dropped, a collect step without its
    condition, `check` out of publish's needs, the report's signing step
    renamed, a report signature not attached, `check` not downloading the
    report before it pins, `yaml` imported into `pins.mjs`, a step of
    `publish` before the signatures handed the npm token or running npm
    itself, the token in the job's env, and `continue-on-error` on a gates
    step, a gates job or a signing step.
  - `scripts/licence-status.test.mjs` -- the legal gate given evidence in
    the real register, and the check removed.
  - `scripts/release-notes.test.mjs` -- the body is the section and the
    report's summary.

  **Not mechanically enforced, and said:** that a gate's evidence is the
  right evidence for it, and that a register line is a fair summary of its
  record and still true -- each held by review, and a line can outlive its
  truth until its record changes; that `scripts/install-test.mjs` records
  each host's tools and the runtime dependencies a clean install resolved,
  which only a run of the install gate shows; that a builder's host at the
  newest end resolved the newest release its range admits, which only the
  registry knows -- the report holds it to resolving one, and the floor to
  the floor; that a test is in a file named as vitest names one, which is
  what a test file is known by here; and the publish job's behaviour, which
  has never run: the workflows test holds its shape until the first tag.

## Context

Plan section 23.4 asks for the first release once G1, G2 and G3, the install
gate, the dependency-licence guard and a clean rehearsal of `release.yml`
have passed, and plan 2.3 schedules Formancy Data's release report
([formancy.ai-data 0035](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0035-a-release-report-is-derived-from-the-run-that-gated-it.md))
for the packaging slice, with a gates register seeded from the plan and a
limitations register with an entry per decision record. Before this:

- `release.yml` ran the gates, pinned the tarballs and the SBOM by sha256 in
  `check` and published only what was pinned. Nothing said which versions a
  release was tested with, or which gates it had passed.
- [0004](0004-three-version-lines-each-refused-when-unknown.md)'s tuple was
  typed into the CHANGELOG, and said so: it could name something no run
  tested, and only review would catch it.
- The install gate already wrote `test-results/install.json` -- each
  tarball's sha256 and `dist/` hash, each host's framework -- and every
  suite its `test-results/vitest.json`, for a report that did not exist yet.
- The limitations the records state were scattered across twelve cost
  paragraphs, none of them where a customer would look.

Report has no database, no shared cases across engines, no container and no
getting-started guide, so most of Data's report has nothing to say here.
What it does have, Data's does not: two native builders, each a peer of a
framework whose range admits more releases than any run installs.

## Decision

The gates workflow's every job collects what it found into one results
file and uploads it, and its last job builds the release report from all of
them and fails the run on its problems. The report is a build output of
that run, never a committed document: a CI artefact and job summary on every
pull request, and, on a release, an asset signed by the workflow that ran
the gates, as in formancy.ai-data 0035.

It contains:

- **Which run it is:** version, release, commit, run, and each job's
  attempt, runner image and Node.
- **Tested on:** every runtime dependency of every published package, as
  published, as the suites loaded it and as a clean `npm install` of the
  tarballs resolved it; each builder's peers, as declared, as its suites
  ran them and as each install host resolved them, at the newest and the
  oldest release the range admits; upstream `@formancy/*`; Node as each job
  ran it; pnpm; and the tools, TypeScript and PDF.js among them.
- **Results:** per package, with wall time and coverage reported and never
  gated, each suite held to every test file the checkout holds for it --
  named as vitest's default include names a test, not by the suite's own
  include; the repository's guards, held the same way to every other test
  file; the install gate, host by host, held to the hosts
  `scripts/install-hosts.mjs` plans from the published manifests and not
  only to its own `passed`.
- **Build identity:** the tarballs the install gate packed, installed and
  ran, by sha256, and their built files against every job's `dist/`.
- **The release gates**, by id from `docs/release/gates.json`: G1 to G7 and
  the legal review. Evidence passed in this run, stated in a document, or
  open with its reason; a gate may be partly evidenced and still open, as G3
  is, whose cross-framework test is the Studio's.
- **Limitations:** derived from the run, then a register,
  `docs/release/limitations.json`, held to the records by hash.

A release checks the report, the tarballs, the SBOM and the body in a job
with read-only permissions and no secret, pins by sha256 what it checked,
then publishes exactly those tarballs, signs the report beside the SBOM and
attaches both, all in one job that runs only on the push of a version tag
and refuses anything it downloaded that is not what was pinned, or a report
that is not this run's, green and whole.

## Consequences

**What it buys.**
- **A release names what it was tested on, from the run that tested it.**
  0004's tuple, typed until now, is derived: the upstream versions, the
  React and Angular each host ran, Node, pnpm and TypeScript.
- **npm receives what the gates installed and ran,** and the report shows
  each tarball's built files equal to the `dist/` every job built; a build
  that differs between runners fails the run closed.
- **A gate is said, never assumed.** G1 and G2 rest on evidence each run
  must pass; G3 is open for the Studio's test while its builders' scenarios
  must pass in every run; the rest are open with a reason, and every report
  says so.
- **A changed record cannot leave a stale limitation unread.**
- **The report is derivable on one machine.** `synthetic-run.mjs` is a
  whole green run made by hand; every test builds the report from it, and
  so can anybody, with no CI.

**What it costs.** Measured on 2026-10-16 on one Windows 11 machine (Intel
i9-10900K, Node 24.21.0), not on CI, three times each with the shell's clock,
over that machine's results of the repository's guards, every package's
suite and the install gate: collecting them took 385 to 403 ms -- `git
ls-files`, which lists the test files each suite is held to, took 86 to
127 ms of that on its own -- and building the report from them 345 to
346 ms; the collected results were 555,578 bytes, the report's JSON 66,807
bytes and its Markdown 40,887 bytes; and the body built from the Unreleased
section with this change's own entry in it, to be measured only, was 33,442
characters of GitHub's 125,000. Building the report from the synthetic run
took 6.5 ms, the first build in each of two processes. The report job's wall
time on CI, the artefacts' sizes there and the seconds each collect step
adds are not measured yet; the job's limit is verify's fifteen minutes,
whose install it shares, until three green runs give a slowest time to
triple. On that machine, report-spec, report-core, report-runtime and
report-builder-core, built again uncached by that run's `--force`, packed to
tarballs byte-identical to those the install gate had recorded 37 minutes
before; the builders and the renderer were not rebuilt, and two runners have
never been compared.

The SBOM is what cdxgen finds, held only to name every runtime dependency
and every upstream package the report names, at the version the suites
loaded. What cdxgen 12.8.4 names for this repository has not been seen:
it cannot run here without an install, so the first rehearsal is the first
time it is checked, and it fails closed if cdxgen leaves one out.

Every new record needs a register entry, and any edit to a record, a typo
included, needs a re-read and a stamp; the fence detects change, not
meaning, and a rubber-stamped hash passes. A dependency or a peer bumped
must regenerate the README's block (`node scripts/release-report/readme.mjs
--write`). A job added to gates.yml needs a collect step and a reader in
`collect.mjs`, or the job fails; the Studio's browser job is the first that
will. Every file named as vitest names a test must run in the suite of the
package it is in, or in the guards' when it is in none: a file another job
runs under such a name fails the run until the report reads that job's
results as its suite, and a local report after one file run alone fails, by
design. A local report cannot pass a gate that rests on a job, because a job's
result is the gates run's `needs`; it says so, and allows the job missing
only when asked, in its banner.

The published ranges accept versions no run tested: `tslib` is a range, and
each builder's peer range admits every React 19 and every Angular 22 while
the install gate runs two of each. Nothing in the product refuses an
untested version: tested on is not accepted by. A package's own suites run
its source, not its `dist/`; only the install gate runs the tarballs.

**What only GitHub can show, and has not yet.** The first pull request run:
that `toJSON(needs)` in a reusable workflow gives the test matrix's one
aggregate result, that the download puts each artefact in a directory of
its own, and that separate runners build byte-identical `dist/` for each
published package -- the Angular builder's through ng-packagr among them --
which only one machine's builds have shown. The first job run again: that
`overwrite: true` replaces that job's earlier artefact and nothing else. A
rehearsal: that `check` can download the report and the tarballs, that
cdxgen names what the report names, and that `check`'s outputs reach
`publish`. The first tag: everything `publish` does.

**Not held by anything:** that the open reasons of G4 to G7 are still true;
the `npm` environment's deployment policy, which is the repository's
setting; and whether "Verified by" paths resolve.

**What it forecloses:** publishing on evidence another workflow produced;
publishing bytes no gate installed; and a release body, a tuple of tested
versions or a report typed by hand.

## Alternatives considered

- **A committed per-version report.** It cannot hold its own run's results,
  and a typed copy of a CI log is the drift this repository forbids
  (formancy.ai-data 0035's reason).
- **The tagged commit's CI artefacts.** The release would publish on evidence
  it did not produce, from a run that may have expired or never happened.
- **Keeping the tuple typed in the CHANGELOG (0004 as it was).** It names
  what somebody believed was tested, and nothing fails when it is wrong.
- **Data's gates register rule, exactly one of evidence and a reason.** G3
  would then be either open, with its builders' scenarios run and judged by
  nobody, or passed, while the cross-framework test it needs does not
  exist. A gate partly evidenced is open, and its evidence must still pass.
- **Holding a suite to its own vitest include.** The include is what is on
  trial: a file renamed past it, or an include narrowed, is a file that
  silently stops running, and a report that reads the include would agree.
  A test file is known by its name instead, and each one belongs to the
  package with a suite it is in, or to the guards.
- **Holding the install gate to its own `passed`.** One flag its writer
  sets; a host left out of its record, or a step not done, would be
  printed as checked. The plan the gate runs is derived again from the
  published manifests, by the same function.
- **A typed list of what the SBOM must name.** A dependency added later
  would go unchecked, with nothing failing; the report's own list is
  derived from the manifests.
- **Judging a job's evidence on a machine from that job's local files.** A
  job's result is the job's end, which only the gates run's `needs` reports;
  a local reading would be a second definition of "passed" for one gate.
- **Porting Data's shared-case matrix, browser matrix and container
  sections now.** Each would be a section with nothing to show, and a report
  that prints empty tables reads as one that checked something. The Studio's
  browser gates add their section when they land.
- **The plan's gate sentences in the register.** The plan is a working
  document kept out of the repository; the report prints the gate's id with
  its evidence, and a `says` key fails the register's guard.

## Older records

None is superseded. [0004](0004-three-version-lines-each-refused-when-unknown.md)'s
tuple is now derived per run, and its Status line says so; its record of
what a release supports stays as written. [0001](0001-a-paid-module-in-its-own-repository.md)'s
legal review is the register's `legal` gate, which
`scripts/licence-status.test.mjs` keeps open while `LICENSE.md` says no
lawyer has reviewed it, as formancy.ai-data holds its gate 10.
