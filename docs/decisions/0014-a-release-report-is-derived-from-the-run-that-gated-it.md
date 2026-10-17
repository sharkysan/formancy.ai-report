# 0014 — A release report is derived from the run that gated the release, and says what it did not test

- **Status:** accepted. Where it says G3 is open, partly evidenced, because
  nothing compares the two builders' accessible trees, it describes the
  register before that comparison: since it was added later that day
  ([0012](0012-the-builders-are-native-and-share-one-session.md)'s
  *Verified by*), G3 rests on its evidence alone, and no gate of the
  register is partly evidenced. Its SBOM is no longer cdxgen's reading of
  the workspace, which the v0.1.0 tag's run refused for leaving out tslib:
  it is made from the published tarballs as npm installs them, and held to
  what a consumer installs
  ([0017](0017-the-sbom-describes-what-a-consumer-installs.md)). The
  gates have a fifth job, the e-invoice gate, whose results the report
  reads, shows and fails a run on
  ([0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
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
    suite, a file collect did not find and one it refused, the guards'
    results missing unless verify is allowed missing, the install gate's
    record missing unless install is allowed missing -- each as collect
    leaves it, its file not found under the reader that expected it -- the
    install gate failed, a host install-hosts.mjs plans
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
    of two runs, or holding one key twice; a browser gate that failed a
    check, ended in an error, made fewer passes than it planned, made a pass
    with no check in it, planned none, or left no results in a browser the
    gates run in unless browser is allowed missing -- though not a file of
    it from before `--since` -- and one that launched another browser than
    Playwright pins, launched it headed or did not say how, or ran another
    Playwright; a pictures' check that found a picture no longer showing its
    page, did not walk a scene scenes.json gives its app or walked one it
    does not, ended in an error, left no results, or walked in another
    browser than the pin or launched it otherwise; and the browser job's
    artefact missing in CI. The install plan is install-hosts.mjs's own for
    the published manifests, each builder at the newest and the floor of its
    peer ranges, and the scenes each app's check is held to are every scene
    scenes.json gives that app.
  - `scripts/release-report/gates.test.mjs` -- the committed register
    holds; G1 to G7 and `legal` in order; at least one of evidence and a
    reason; no empty list of evidence; file evidence a test of a package
    with a suite or of the repository's guards; a job one of gates.yml's; a
    document committed; a browser gate an app with a `test:browser` script;
    no `says`; a gate whose only evidence is a document `stated`, never
    `passed`; a browser gate `passed` only in every browser the gates run
    in, with no failed check, no error and every planned pass made with a
    check in it; a gate
    with a reason `open` whatever its evidence, and `failed` when that
    evidence did not pass.
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
    each browser the run launched and what launched it, a headed launch said
    as one -- or none, or no browser job at all -- the jobs
    that built every published package (watched failing with every job of
    every package joined), each open and each stated gate; and the
    Markdown's "not measured" cells, its install hosts, its Browser section
    with each gate's passes made of those planned and each pictures' check's
    scenes walked of scenes.json's, the browser builds Playwright pins beside those the run
    launched, its links to later records, its method and the dirty mark of a
    local run.
  - `scripts/release-report/collect.test.mjs` -- a test's meta and the
    coverage map left out, the `dist/` of a package packed from its `dist/`
    hashed as its tarball carries it, a private package's left out, each
    suite's test files listed from the checkout by name and not by its
    include -- a `.test.tsx` its include misses among them, a file git lists
    but the disk lacks left out, a test file in no package with a suite the
    guards' -- a turbo replay and a summary from before `--since` listed, a
    coverage summary written before its vitest.json started and a turbo task
    that does not span it refused as another run's, a job with no reader
    refused, each app's browser gate read in every browser the gates run in
    and its pictures' check read, a gate's file whose browser, asked for or
    launched, is not the one it is filed under refused, one that left nothing
    listed, a stale one refused on a machine, a local run reading the
    install gate and the browser gate, and each file not found filed under
    the reader that expected it -- the guards' under verify, a package's
    under test, the gate's and the pictures' under browser, the install
    gate's under install -- with a stale one refused rather than not found.
  - `scripts/release-report/gate-results.test.mjs` and
    `scripts/pictures/session.test.mjs` -- the browser gate's file keeps the
    passes it planned and the Playwright that launched its browser, written
    when it ended in an error too, and whether that browser ran headless, as
    `scripts/browsers.mjs`'s launchedAs() records it for the gate and the
    pictures alike; the pictures' check's keeps the scenes it walked and no
    plan of its own, and an error only when one ended the walk.
  - `scripts/release-report/tested-on.test.mjs` -- every runtime dependency
    and every peer of every published package named, TypeScript's range read
    from the catalog, the Playwright the browser gates load and the build it
    pins for each browser they run in, launched as `LAUNCH_OPTIONS` says,
    and the README's generated block current.
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
  - `scripts/workflows.test.mjs` -- the report's needs without `install` or
    `browser`, the browser job without its collect step, its pictures'
    check without its condition, an upload without `overwrite`, `${{ matrix.package }}` in a collect script,
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
  what a test file is known by here; that the passes a browser gate planned
  are every width its app's stylesheets call for, which only the gate
  derives and the report takes as written; and the publish job's behaviour
  beyond the one run it has had, 0.1.0's on 16 October 2026, where every
  step succeeded: a `publish` run again over versions npm already holds has
  never run, and the workflows test holds its shape.

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
  ran it; pnpm; the browser each gate launched, beside the build the
  Playwright it ran pins for it; and the tools, TypeScript and PDF.js among
  them.
- **Results:** per package, with wall time and coverage reported and never
  gated, each suite held to every test file the checkout holds for it --
  named as vitest's default include names a test, not by the suite's own
  include; the repository's guards, held the same way to every other test
  file; the install gate, host by host, held to the hosts
  `scripts/install-hosts.mjs` plans from the published manifests and not
  only to its own `passed`.
- **Browser:** each app's browser gate, in every browser the gates run in
  (`scripts/browsers.mjs`, Chromium alone), from the file it writes however
  it ends: its checks, failed and passed, and every pass it planned before
  its first, so a pass not made, or made with no check in it, is a width
  skipped; and each app's README pictures' check, from its own file, held
  to every scene `scripts/pictures/scenes.json` gives the app, which the
  report reads itself, as 0013 asks. Each is held to the build Playwright
  pins, launched as `scripts/browsers.mjs` launches it: the headless shell
  and the full browser share a version, so how it was launched is what
  says which ran.
- **Build identity:** the tarballs the install gate packed, installed and
  ran, by sha256, and their built files against every job's `dist/`.
- **The release gates**, by id from `docs/release/gates.json`: G1 to G7 and
  the legal review. Evidence passed in this run, stated in a document, or
  open with its reason; a gate may be partly evidenced and still open, as G3
  is, whose switch across the frameworks the Studio's tests and browser gate
  hold, and whose builders' accessible trees nothing compares.
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
  must pass; G3's builders' scenarios, the Studio's switch across the
  frameworks and its browser gate must pass in every run, and it stays open
  because nothing compares the two builders' accessible trees; the rest are
  open with a reason, and every report says so.
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
characters of GitHub's 125,000. With the Studio's browser gate and its
pictures' check beside them, the gate's file recording 992 checks over 8
passes, the same machine measured the same way that day: collecting took
390 to 481 ms and building the report 354 to 392 ms after a first build of
1,615 ms; the collected results were 706,088 bytes, the report's JSON
155,410 bytes and its Markdown 45,792 bytes; and the body was 36,974
characters. Building the report from the synthetic run took 6.5 ms, the
first build in each of two processes. The report job's wall time on CI, the
artefacts' sizes there and the seconds each collect step adds are not
measured yet; the job's limit is verify's fifteen minutes, whose install it
shares, until three green runs give a slowest time to triple. On that
machine, report-spec, report-core, report-runtime and report-builder-core,
built again uncached by that run's `--force`, packed to tarballs
byte-identical to those the install gate had recorded 37 minutes before;
the builders and the renderer were not rebuilt, and two runners have never
been compared. Later that day the same machine's report failed a run on
the Angular builder: the install gate had packed the `dist/` turbo replayed
from its cache, written by a forced build 34 minutes earlier under the same
task hash, and a forced build in the same run gave other bytes. Four
builds since, one with ng-packagr's cache cleared, gave the same bytes as
each other; the replayed output was gone, and what made it differ was not
found.

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
`collect.mjs`, or the job fails; the Studio's browser job has both. Its
results are the files the Studio's gate and its pictures' check write: a
gate that stopped part way, or a scene the pictures did not reach, fails
the run as a skipped test does, and a browser added to
`scripts/browsers.mjs` is one the report expects the gate to have run in.
The passes a gate planned are its own word, written before its first pass:
they come from the app's stylesheets, which only the app's gate reads, so a
gate that planned too few would pass. The pictures' scenes are not: the
report reads scenes.json itself.
A browser gate is evidence of its own kind, judged from its own file
wherever it ran, as a test file is, so a local report judges it from that
machine's run; the `browser` job's own end is judged by the needs, like any
job's. Every file named as vitest names a test must run in the suite of the
package it is in, or in the guards' when it is in none: a file another job
runs under such a name fails the run until the report reads that job's
results as its suite, and a local report after one file run alone fails, by
design. A local report cannot pass a gate that rests on a job, because a job's
result is the gates run's `needs`; it says so, and allows the job missing
only when asked, in its banner. What it allows missing is a reader of
collect's -- verify, browser or install -- whose files that machine did not
write: collect files each file it did not find under the reader that
expected it, and the report leaves those out; a file of that reader that is
there from before `--since` still fails it.

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
`publish`. The first tag: everything `publish` does. And the first run of
the browser job with its collect step: that the gate's and the pictures'
files are where the Studio's scripts write them on a Linux runner, and that
the Chromium launched there is the build Playwright pins.

**Not held by anything:** that the open reasons of G4 to G7 are still true;
the `npm` environment's deployment policy, which is the repository's
setting; and whether "Verified by" paths resolve.

**What it forecloses:** publishing on evidence another workflow produced;
publishing bytes no gate installed; and a release body, a tuple of tested
versions or a report typed by hand.

**Added 2026-10-17: the e-invoice gate.** `gates.yml` gains a fifth job
that leaves results, `e-invoice`, as [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
decides: Mustang and KoSIT's validator over the XML the runtime writes of
the corpus's e-invoice samples and over controls. collect.mjs reads its
`test-results/e-invoice.json` under a reader of its own, `e-invoice`, in
CI and on a machine, so `--allow-missing` names it beside `verify`,
`browser` and `install`, and the report waits for the job. The report
gains a section after the browser's: the Java and the tools the gate ran,
and every file of its corpus, a sample or a control, with each tool's
verdict. It fails the run when the gate left no results, did not pass,
recorded a tool other than `docs/release/e-invoice-tools.json` pins -- by
version, by the SHA-256 the gate measured of the bytes it ran, or, for
each JAR, by the version the tool reported of itself -- ran in CI on a
Java of another major version than the register names, judged no sample
every tool must accept or made no control a tool must refuse, or has a
tool's verdict missing or other than its corpus expects on a file. It
reads the register itself and holds the gate's measurements and the
tools' own words to it, not the gate's `passed`; a machine's run is shown
on its Java and not held to one. The Java's vendor is not the report's to
hold: `workflows.test.mjs` holds the job's `actions/setup-java` to the
register's distribution. Its summary line says whether the e-invoice gate
passed. `collect.test.mjs`, `report.test.mjs`, `render.test.mjs` and
`workflows.test.mjs` hold it.

## Alternatives considered

- **A committed per-version report.** It cannot hold its own run's results,
  and a typed copy of a CI log is the drift this repository forbids
  (formancy.ai-data 0035's reason).
- **The tagged commit's CI artefacts.** The release would publish on evidence
  it did not produce, from a run that may have expired or never happened.
- **Keeping the tuple typed in the CHANGELOG (0004 as it was).** It names
  what somebody believed was tested, and nothing fails when it is wrong.
- **Data's gates register rule, exactly one of evidence and a reason.** G3
  would then be either open, with its scenarios, the Studio's switch and
  its browser gate run and judged by nobody, or passed, while nothing
  compares the two builders' accessible trees. A gate partly evidenced is
  open, and its evidence must still pass.
- **Holding a suite to its own vitest include.** The include is what is on
  trial: a file renamed past it, or an include narrowed, is a file that
  silently stops running, and a report that reads the include would agree.
  A test file is known by its name instead, and each one belongs to the
  package with a suite it is in, or to the guards.
- **Deriving the browser gate's passes in the report**, as the install
  hosts are. The passes come from the Studio's stylesheet and the builders'
  installed one, read by the app's own gate code, which loads axe-core and
  the built packages: the report would import an app into every gates run
  and a second reading of its breakpoints. Instead the gate writes its plan
  before its first pass, and the report holds what it made to that.
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
  browser gate brought its section, Browser, when it landed; with one
  browser, Data's matrix is that section's table.
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
