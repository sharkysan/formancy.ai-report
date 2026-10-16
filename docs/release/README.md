# The release report

Every run of the gates ends in a report of what that run was tested on and
what it found ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md),
as formancy.ai-data's 0035). It is a build output of the run, never a
committed document: a report typed by hand would describe a run nobody can
find.

- **On a pull request or a push to main**, it is the `release-report`
  artefact of the CI run and the run's summary page.
- **On a release**, it is attached to the GitHub release as
  `formancy-report-<tag>-release-report.md` and `.json`, each with a
  `.sigstore` bundle signed by the workflow that ran the gates, beside the
  SBOM; the release body carries its summary.

`.github/workflows/gates.yml` runs the gates for both, so a release's gate is
CI's. Each job collects what it found into one results file
(`scripts/release-report/collect.mjs`) and uploads it; the last job, `report`,
builds the report from all of them (`scripts/release-report/report.mjs`).

## What it holds

1. **Subject:** the version, the release (a tag, `dry-run` or none), the
   commit, the run, and each job's attempt, runner image and Node.
2. **Tested on:** every runtime dependency of every published package -- its
   published range, the version the suites loaded and what a clean
   `npm install` of the tarballs resolved; each builder's peers, as
   declared, as its suites ran them, and as each install host resolved
   them, at the newest and the oldest release the range admits; upstream
   `@formancy/*`; Node as each job ran it and the install gate's npm; pnpm;
   and the tools, TypeScript and PDF.js among them.
3. **Results:** a row per package with a suite -- files, tests, what did not
   pass, the task's wall time from turbo, vitest's span, and coverage,
   reported and never gated -- then the repository's guards, and the install
   gate with each host it installed. Each suite is held to every test file
   the checkout holds for it, known by its name as vitest's default include
   knows one and not by the suite's own include, which is what is on trial:
   a file in a package with a suite is that package's, any other the
   guards'.
4. **Build identity:** each published package's tarball as the install gate
   packed, installed and ran it, by sha256, and the hash of its built files
   against the `dist/` every job built.
5. **Release gates:** G1 to G7 and the legal review, from
   [`gates.json`](gates.json).
6. **Known limitations:** those the run shows, as fixed sentences with the
   run's facts, then those the decision records state, from
   [`limitations.json`](limitations.json).
7. **How this report was made:** where each section comes from.
8. **Problems:** what fails the run. Empty on a green run, and the report
   says so.

## What fails it

A job of the gates that ended other than success; a job's results missing,
twice, under another job's name, or from another commit or run; a published
package with no suite; a package with no results, no tests, a test that did
not pass -- skipped is not passed -- a file that failed, or vitest calling
the run unsuccessful; a test file the checkout holds that its suite did not
run, whether its include missed it or only part of the suite ran; a coverage
summary or a turbo task of another run than the suite's `vitest.json`; the
install gate missing, failed, packing other than one tarball per published
package, or packing one at another version than the root manifest's; a host
`scripts/install-hosts.mjs` plans that the gate has no record of, or one it
recorded and nobody planned; a host with its install or a step unfinished; a
builder's host that resolved no framework, or at the floor one other than
its peer range's floor; a published package whose `dist/` no job recorded,
so its tarball is compared with nothing; two builds of one package that
differ, or a tarball whose built files are not every job's; a gate whose
evidence did not pass, or a limitation whose `heldBy` test did not; either
register not holding; and, for a release, a tag that is not the root
manifest's version, a version with no changelog section, or a body longer
than the 125,000 characters GitHub accepts. A local report also fails on
results of more than one commit or run, or one key twice.

## What a release does with it

`release.yml`'s `check` job, with read-only permissions and no secret,
refuses a report that is not this run's, green and whole -- of another
commit, run, release or version, partial, local, or with problems -- a
report directory holding anything but the report and the body, a tarball
that is not byte for byte the one the report says the install gate
installed, and a body that is missing or too long. It pins the report and
the tarballs by sha256 before cdxgen runs, then refuses an SBOM that leaves
out a runtime dependency or an upstream package the report names, or names
one at another version than the suites loaded, and pins the SBOM. The
`publish` job refuses anything it downloaded that is not what was pinned,
and the report again, before it signs the SBOM and the report and before
npm receives anything (`scripts/release/pins.mjs`, `publish.mjs`).

## The two registers

Both are held by `pnpm test:repo` and read by every run.

**[`limitations.json`](limitations.json)** has an entry for every decision
record: the costs it states that a user, integrator or operator of a release
will meet, one sentence each in the record's own terms, or, in `none`, why it
has none. Each entry's `reviewed` is the sha256 of its record as it was read,
so any edit to a record -- a later record changing its Status line included
-- fails until somebody reads it again:

```bash
node scripts/release-report/limitations.mjs --changed     # records edited since they were read
node scripts/release-report/limitations.mjs --missing     # records with no entry
node scripts/release-report/limitations.mjs --stamp 0014  # after reading 0014 again
```

The fence detects change, not meaning: a stamp without a reading passes. A
line can outlive its truth until its record changes, which is why CLAUDE.md
asks for a record whenever a decision changes. Where a test already shows
that a line still holds, `heldBy` names it, and the report fails a run in
which it did not pass.

**[`gates.json`](gates.json)** names, for each of the plan's gates by id,
the evidence a run must pass, the reason it is open, or both. The plan is a
working document kept out of the repository, so no gate's wording is here.
Evidence is a test `file` -- of a package with a suite, or one of the
repository's guards -- a gates.yml `job`, or a `document`. A gate passes in
a run when everything but its documents passed; a document is shown as
stated, with its last change and how many commits it is behind, and never
as passed in the run. A gate with a reason is open whatever its evidence,
and the evidence it has must pass all the same: G3's builders' scenarios run
in every run, and the cross-framework test it waits for is the Studio's. The
`legal` gate waits for a lawyer's review of `LICENSE.md`, and
`scripts/licence-status.test.mjs` fails when it is given evidence, or loses
its reason, while the licence's version line says no lawyer has reviewed it
([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)); that the
reason still names the review is held by review.

## Building one on a machine

[`RELEASING.md`](../../RELEASING.md#the-release-report) has the commands.
`--since` has no default. A results file left by an earlier run, read as this
one's, is the failure local mode has to rule out, and only the person running
it knows from when; a file that started before it is listed as stale and the
report fails. That holds for every file a suite's row is built from: its
`vitest.json`, its `coverage/coverage-summary.json` and turbo's run summary
of its task, which `--summarize` writes and a cache hit or a run without it
leaves behind from an earlier one. Each is held to the suite's own run as
well: a coverage summary written before its `vitest.json` started, or a
turbo task that does not span that start, is another run's and is refused.
A `vitest.json` of one file, run after the whole suite, fails the report
for every other test file of its package, which did not run in it. The
results directory is held to one commit and one run, each key once: a
collect of another commit, or a CI run's artefacts left beside this
machine's, fails the report. A gate that rests on a job -- G1 rests on
`install` -- has no result on a machine, because a job's result is the gates
run's `needs`: the report says so unless that job is allowed missing, and a
local report says "local" at the top, names its commit "with uncommitted
changes" when the tree held any, names what it allowed missing when it is
partial, and a release refuses it.

Every test of the report builds it from `scripts/release-report/synthetic-run.mjs`,
a whole green run made by hand, so the report is derivable with no CI at
all.
