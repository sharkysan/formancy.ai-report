# Releasing

Releases are cut by [`.github/workflows/release.yml`](.github/workflows/release.yml)
and nowhere else. A release built on a laptop cannot carry provenance — the
attestation is a statement *by GitHub* about which workflow, at which commit,
produced a tarball, and only the workflow can make it.

Nothing has been released yet. The workflow follows Formancy Data's, release
report included
([0014](docs/decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md),
[`docs/release/`](docs/release/README.md)), without its server image, which
arrives here with the server it describes.

## Cutting one

```bash
# 1. Bump every package to the new version (one number across all of them)
node scripts/bump.mjs 0.1.0

# 2. Rename "## Unreleased" in CHANGELOG.md to the version's heading, and say
#    what is knowingly missing. What the release was tested with is the
#    release report's, from the run that gates it; the body carries it.

# 3. Verify locally — the workflow runs these again, but finding out here is cheaper
pnpm build && pnpm typecheck && pnpm test:coverage && pnpm check:pkg && pnpm test:repo
node scripts/verify-licenses.mjs
pnpm test:e2e:install
#    and, to read the report of what ran on this machine, "The release report"
#    below

# 4. Get the release commit onto main, through a pull request like any other.

# 5. Rehearse on it, then read the run, its release report and the body it built.
gh workflow run release.yml --ref main

# 6. Tag that commit and push the tag, and nothing else.
git tag -a v0.1.0 -m "Formancy Report 0.1.0"
git push origin v0.1.0
```

Pushing the tag is what starts the release. Everything after that is the
workflow's job.

## What the workflow does

In this order, so that every check on what would be published runs before
anything that cannot be taken back:

1. **`tag`: decides once whether this run publishes** — only on the push of a
   `v*` tag — and refuses a tag that disagrees with the manifests. A tag
   saying `v0.2.0` on a tree saying `0.1.0` would publish the wrong version
   under the right name, which cannot be fixed afterwards.
2. **`npm-token`: the token must work, beside the gates.** Set, accepted by
   `npm whoami`, and a warning when the account wants a one-time password on
   writes. A missing or refused token is red while the gates are still
   running, not after them.
3. **`gates`: the gates CI runs, from
   [`gates.yml`](.github/workflows/gates.yml)** — build, types, packaging,
   licences and the repository guards; each package's suite on a runner of
   its own; and the install gate, which packs, installs and runs the tarballs
   and keeps them. Every job collects what it found, and the last, `report`,
   builds the release report of this run and the release body -- the
   version's changelog section and the report's summary -- and fails the run
   on the report's problems, on a tag that is not the manifests' version, on
   a version with no section, and on a body over the 125,000 characters
   GitHub accepts ([`docs/release/`](docs/release/README.md)). Unlike CI, a
   release restores no Actions cache: a tag's run may restore one a
   main-branch run saved, and every job installs from the registry against
   the lockfile instead.
4. **`check`, in a job that holds `contents: read` and no secret:**
   - It refuses a report that is not this run's, green and whole: of another
     commit, run, release or version, partial, local, or with problems; and
     a report directory holding anything but the report and the body.
   - It refuses tarballs that are not, byte for byte, the ones the report
     says the install gate installed and ran, one per published package; that
     are not at the release's version; that declare another licence field;
     or that lack `LICENSE.md` or `NOTICE`. It refuses a body that is missing
     or too long.
   - It pins the sha256 of the report, the body and every tarball as its
     outputs. Only then does it generate a CycloneDX SBOM, from those
     tarballs installed by npm in a directory outside the checkout, with no
     lifecycle script and no peer, so that it describes what a consumer
     installs and not the workspace
     ([0017](docs/decisions/0017-the-sbom-describes-what-a-consumer-installs.md)).
     It refuses the SBOM unless it is one, names every published package at
     the release's version, every runtime dependency and every upstream
     package their install brings, and names each at the version the suites
     loaded; and pins that too.

   This job is not one that can write nothing. Every job of a run can write
   to the run's artefacts, this one uploads the SBOM, and cdxgen's own
   dependencies are not locked. The pins are what tie what is published to
   what was checked.
5. **`publish`, only on a tag, the one job with write permissions and an OIDC
   identity.** In order:
   1. It refuses any file it downloaded that `check` did not pin, or pinned
      otherwise, and a report that is not this run's, green and whole. It
      does this before signing anything, and again, with each tarball held to
      the report's record of it, in the step that holds the npm token.
   2. It signs the SBOM, and the report's Markdown and JSON, with cosign,
      keylessly.
   3. It publishes the tarballs `check` passed to npm, with provenance and in
      dependency order.
   4. It creates the GitHub release from the body the report job built, with
      the SBOM, the report and their signatures attached.

   No step in it carries a condition of its own: the job is the boundary.

`--access public` is about the registry's visibility of a scoped package;
`LICENSE.md` is what says what may be done with it.

There is no container image yet, because there is no server. When the report
server lands, its image is built, signed by digest and attested here, as
Formancy Data's is.

## The release report

Every run of the gates ends in one, a release's included, and a release
attaches it signed ([`docs/release/`](docs/release/README.md) says what it
holds and what fails it). In short:
- which run it is;
- what that run was tested on -- the runtime dependencies as published, as
  the suites loaded them and as a clean install resolved them; each
  builder's React or Angular as declared, as its suites ran it, and as each
  install host resolved it at both ends of its peer range; upstream
  `@formancy/*`; Node, pnpm, TypeScript and PDF.js; the Chromium the browser
  gate launched and the Playwright that pins it;
- each package's results, held to every test file the checkout holds for
  it;
- the Studio's browser gate, held to every pass it planned and a check in
  each, and its README pictures' check, held to every scene
  `scripts/pictures/scenes.json` gives the Studio, each launched as
  `scripts/browsers.mjs` launches the build Playwright pins;
- the install gate host by host, held to the hosts it plans;
- each tarball's built files against the `dist/` every job built;
- the release gates from [`gates.json`](docs/release/gates.json);
- the known limitations: the run's, then those the decision records state,
  from [`limitations.json`](docs/release/limitations.json);
- its problems, any one of which fails the run.

To build one on a machine, from that machine's own runs:

```bash
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
pnpm build && pnpm test:repo
pnpm exec turbo run test:coverage --force --summarize   # every package, fresh, with its wall time
pnpm test:browser && pnpm test:pictures                  # the Studio in Chromium, and its README pictures
node scripts/install-test.mjs
node scripts/release-report/collect.mjs --local --since "$since"
node scripts/release-report/report.mjs --local --allow-missing install
```

It writes `release-report/release-report.md` and `.json`, and exits 1 on any
problem. Every file it reads must be from after `--since` and from the one
run that wrote its suite's results, and every test file of a package must
have run: a report after one file run alone fails, by design. `--allow-missing
install` is for G1, which rests on the install job, and a job's result exists
only in a gates run; the install gate's own record is read whatever it
allows. The browser gate needs Chromium once on the machine (`pnpm --filter
@formancy/report-studio exec playwright install chromium`); its file and the
pictures' check's are read as in CI, and G3, which rests on the browser gate,
is judged from them. On a machine that did not run them, `--allow-missing
install,browser` (or `verify`) allows each of those readers' files not
found, and what rests on them, and the banner says so; a file that is there
from before `--since` is refused all the same -- run it again or remove it.
A release refuses a local report.

## Rehearsing

`gh workflow run release.yml --ref <branch>`, or **Run workflow** on the
Actions page, runs `tag`, `gates` and `check` on that branch: every gate, the
release report, the release body, the SBOM and every check on the report and
the tarballs, exactly as a tag would. It skips `npm-token` and `publish`, so it needs no secret and cannot
publish or sign; its jobs hold `contents: read` and nothing else. It names
the release `dry-run`. Its body uses the version's changelog section when
there is one and `Unreleased` otherwise, so a rehearsal on the release
commit renders the body that will be released.

Agents ask before dispatching it, and never tag or publish.

## If a step after npm fails

Only the GitHub release comes after npm. Run the failed `publish` job again.
`scripts/release/publish.mjs` skips every version npm already holds with the
same bytes, refuses one npm holds with other bytes, and the release is then
created. Signatures are logged in Rekor before npm is reached, and those
entries stay even when a release never happens.

| Step | What cannot be taken back | Can fail on | Already done when it fails |
|---|---|---|---|
| `sign-sbom` | a Rekor log entry | Sigstore | nothing published |
| `sign-report` | a Rekor log entry for each of the report's two files | Sigstore | the SBOM's signature |
| `npm-publish` | each version number on npm, forever | the registry; any one of the packages | the signatures |
| `github-release` | nothing: a release can be edited or deleted | the GitHub API | npm |

The publish job has never run. `scripts/workflows.test.mjs` holds its shape;
the first tag is the first time it runs.

## The demo on formancy.ai

Cloudflare deploys the Studio at https://formancy.ai/report/ on every push
to `main`, through Workers Builds
([0018](docs/decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)).
The Worker `formancy-report-studio` is connected to this repository. It
builds with `pnpm build` and deploys with `node scripts/demo.mjs`, the two
halves of `pnpm demo:deploy`, with the settings in
[REPO-METADATA.md](.github/REPO-METADATA.md#the-demos-worker-on-cloudflare).
So the demo is main's Studio, not the latest release's, and a release
needs nothing more for it.

`node scripts/demo.mjs` refuses:
- a checkout with changes;
- a Worker config in `apps/studio/wrangler.json` that is not the demo's;
- a built page that asks for a file by an absolute path.

Then it deploys with the pinned Wrangler, with the commit in the
deployment's message. A failed build leaves the last deployment serving.
Its log is on the Worker's page in Cloudflare's dashboard, and nothing in
this repository reads it. After a deploy, open the address and see a
starter print.

By hand, from a clean checkout, with a Cloudflare login that can edit
Workers on formancy.ai's zone:

```bash
npx --yes wrangler@4.146.0 login     # once per machine
pnpm demo:deploy
```

`node scripts/demo.mjs --dry-run`, after `pnpm build`, does everything but
the upload, with no login.

## Provenance

`npm publish --provenance` under `id-token: write` makes npm record a
[sigstore](https://www.sigstore.dev/) attestation binding each tarball to the
workflow run, the commit and the repository that built it. Anyone can check it:

```bash
npm audit signatures
```

**Requirements**: the repository is public, every manifest carries a
`repository` field matching it, and publishing happens from GitHub Actions.

## Secrets

`NPM_TOKEN` must be an Automation or Granular Access token. A classic token on
an account that enforces 2FA on writes demands a one-time password at publish
time, and the `npm-token` job checks for that beside the gates. A rehearsal
does not read it.

It is a secret of the `npm` environment, not of the repository. The two jobs
that read it, `npm-token` and `publish`, name that environment, and its
deployment policy admits only `v*` tags. So a workflow pushed to any other
branch or tag cannot read it, where a repository secret could be read by a
workflow on any branch a collaborator pushes. The environment and its policy
are repository settings ([REPO-METADATA.md](.github/REPO-METADATA.md)).
`scripts/workflows.test.mjs` holds that the jobs name the environment.
Nothing here can check that the policy is set.
