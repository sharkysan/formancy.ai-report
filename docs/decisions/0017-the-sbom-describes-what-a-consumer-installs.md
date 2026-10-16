# 0017 — The SBOM describes what a consumer installs: the published tarballs, installed by npm

- **Status:** accepted; changes how
  [0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md)'s
  SBOM is made
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **`scripts/workflows.test.mjs`.** `release.yml`'s `check` job makes the
    SBOM from the tarballs it pinned. It installs them with `npm install
    --ignore-scripts --legacy-peer-deps` in a directory under
    `RUNNER_TEMP`, then runs cdxgen with `--required-only` there. No step
    of the job runs pnpm, so the workspace is not installed. Watched
    failing against the workflow as the v0.1.0 tag ran it.
  - **`scripts/release-report/verify-publish.test.mjs`.** The check refuses
    an SBOM that leaves out a published package at the release's version,
    or an upstream package a published package's install brings, directly
    or through another. It is not asked for one that only the private
    Studio declares. Each case was watched failing against the check as
    the tag ran it.
  - **`scripts/release-report/tested-on.test.mjs`.** The report marks an
    upstream package `shipped` when a published package's `dependencies`
    bring it. `@formancy/data-core` is shipped, through
    `@formancy/data-client`. `@formancy/themes`, which only the Studio
    declares, is direct but not shipped. Watched failing before the mark
    existed.
  - **By hand, on 16 October 2026.** The new step's commands were run on
    the v0.1.0 tag run's own tarballs (run 38886579245). They gave 43
    components: the eight packages at 0.1.0, formancy's and Data's
    packages, and pdfmake's and the expression engine's closures, tslib
    2.8.1 among them. `pins.mjs sbom` accepted that SBOM against the run's
    report, with its upstream list derived again with the `shipped` mark.

## Context

The v0.1.0 tag's run passed every gate, then `check` refused the SBOM: "the
SBOM names no tslib, which a published package depends on". Nothing was
published. 0014 had said this was where the SBOM would first be seen: "it
cannot run here without an install, so the first rehearsal is the first
time it is checked, and it fails closed if cdxgen leaves one out." No
rehearsal ran before the tag, so the tag was the first time.

Run again locally on the same commit, cdxgen 12.8.4 with `--required-only`
over the pnpm workspace gave 52 components:
- **What does not ship, marked required:** vitest, Playwright, ng-packagr,
  the Testing Library packages, `@angular/build` and a TypeScript
  `5.6.1-rc`.
- **What does ship, missing:** tslib, which `@formancy/report-builder-angular`
  depends on.
- **The release itself, missing:** none of the eight packages being
  published, because in the workspace they are links, not packages.

The check was half right. It found the tslib that cdxgen left out. It also
asked for `@formancy/themes`, which no published package depends on. The
report's upstream list marks a package `direct` when any workspace manifest
names it, the private Studio's included, and the check asked for every
direct one. An SBOM that describes the release correctly would have been
refused for leaving it out.

## Decision

**The SBOM is made from the tarballs `check` pinned, installed as a
consumer installs them.** The step:
1. writes a `package.json` naming `formancy-report` at the release's
   version, in a directory under `RUNNER_TEMP`, outside the checkout;
2. installs every tarball there with `npm install --ignore-scripts
   --legacy-peer-deps`;
3. runs cdxgen 12.8.4 with `--required-only` over that directory.

What the SBOM says:
- **Only what ships.** It lists the published packages, their
  dependencies and the dependencies' own closure, at the versions npm
  resolved during the run.
- **No peers.** React, Angular and the other peers are the host's to bring,
  so they are not in it.
- **No lifecycle scripts.** No install script of any package ran while it
  was made.
- **No workspace.** The `check` job no longer installs the workspace, so
  nothing can read it in place of what ships.

**The check asks for what a consumer installs.** The report marks each
upstream package `shipped` when a published package's `dependencies` name
it, or a shipped package's own do. The check requires:
- every published package, at the release's version;
- every runtime dependency;
- every shipped upstream package.

Each is still held to the version the suites loaded.

## Consequences

**What it buys.**
- **An SBOM that describes the artefact.** A customer or an auditor reading
  it sees what an install brings, not the tools this repository tests
  with.
- **A check that a correct SBOM passes.** The SBOM is held to the release's
  own packages and their installed closure. Nothing that only the Studio
  or a test uses is asked of it.
- **A smaller `check` job.** It installs nothing from the lockfile and runs
  no install script.

**What it costs.**
- **Versions resolved on the day.** A transitive dependency's version, such
  as fontkit under pdfmake, is the one npm resolved during the run. The
  check holds the report's runtime dependencies and upstream packages to
  the versions the suites loaded, but not the rest of the closure. The
  install gate resolves its hosts' installs the same way, and nothing
  compares the two.
- **No peers.** The SBOM does not say which React or Angular a host runs.
  The release report's peers table says which ones the suites loaded and
  the install gate drew.
- **One more registry install in a release.** It is unlocked, as cdxgen's
  own dependencies already were. That is why the tarballs are pinned
  before the step runs and the SBOM is pinned once the check accepts it.
- **Still unrun on GitHub.** The step's commands were run by hand on a
  Windows machine against the tag run's tarballs. Their first run on a
  runner is the next rehearsal or tag.

**What it forecloses.** Nothing that cannot be undone: the step is one
step of `release.yml`.

## Alternatives considered

**Keep cdxgen on the workspace and add tslib to the SBOM by hand.**
Rejected. That would leave every test tool in it marked as required, and
the next dependency cdxgen missed would be found only at the next tag.

**cdxgen without `--required-only`, filtered afterwards.** Rejected. The
filter would be a second definition of what ships, written beside the one
npm already applies when it installs a tarball.

**One SBOM per package, from `pnpm deploy --prod`.** Rejected. Eight
documents, made from the lockfile's versions rather than what a consumer
resolves, where one SBOM of the release is what 0014 attaches and signs.

**Drop `@formancy/themes` from the report.** Rejected. The report's
upstream table is meant to name what the workspace loads, the Studio's
packages included. The `shipped` mark says which of them a consumer
installs, without hiding the rest.
