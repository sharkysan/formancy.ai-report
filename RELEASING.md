# Releasing

Releases are cut by [`.github/workflows/release.yml`](.github/workflows/release.yml)
and nowhere else. A release built on a laptop cannot carry provenance — the
attestation is a statement *by GitHub* about which workflow, at which commit,
produced a tarball, and only the workflow can make it.

Nothing has been released yet. The workflow follows Formancy Data's, without
its release report and server image, which arrive here with the packaging and
the server they describe.

## Cutting one

```bash
# 1. Bump every package to the new version (one number across all of them)
node scripts/bump.mjs 0.1.0

# 2. Rename "## Unreleased" in CHANGELOG.md to the version's heading, and say
#    what is knowingly missing, and which upstream @formancy/* versions the
#    release was tested with.

# 3. Verify locally — the workflow runs these again, but finding out here is cheaper
pnpm build && pnpm typecheck && pnpm test:coverage && pnpm check:pkg && pnpm test:repo
node scripts/verify-licenses.mjs
pnpm test:e2e:install

# 4. Get the release commit onto main, through a pull request like any other.

# 5. Rehearse on it, then read the run and the body it built.
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
   and keeps them. Unlike CI, a release restores no Actions cache: a tag's run
   may restore one a main-branch run saved, and every job installs from the
   registry against the lockfile instead.
4. **`check`, in a job that holds `contents: read` and no secret:**
   - It refuses tarballs that are not at the release's version, that declare
     another licence field, or that lack `LICENSE.md` or `NOTICE`.
   - It builds the release body from the version's changelog section. It
     refuses a body with no section, or one over the 125,000 characters
     GitHub accepts.
   - It pins the sha256 of every tarball as its outputs. Only then does it
     generate a CycloneDX SBOM, which it refuses unless it is one, and pins
     that too.

   This job is not one that can write nothing. Every job of a run can write
   to the run's artefacts, this one uploads the SBOM and the body, and
   cdxgen's own dependencies are not locked. The pins are what tie what is
   published to what was checked.
5. **`publish`, only on a tag, the one job with write permissions and an OIDC
   identity.** In order:
   1. It refuses any file it downloaded that `check` did not pin, or pinned
      otherwise. It does this before signing anything, and again in the step
      that holds the npm token.
   2. It signs the SBOM with cosign, keylessly.
   3. It publishes the tarballs `check` passed to npm, with provenance and in
      dependency order.
   4. It creates the GitHub release with the SBOM and its signature attached.

   No step in it carries a condition of its own: the job is the boundary.

`--access public` is about the registry's visibility of a scoped package;
`LICENSE.md` is what says what may be done with it.

There is no container image yet, because there is no server. When the report
server lands, its image is built, signed by digest and attested here, as
Formancy Data's is.

## Rehearsing

`gh workflow run release.yml --ref <branch>`, or **Run workflow** on the
Actions page, runs `tag`, `gates` and `check` on that branch: every gate, the
release body, the SBOM and every check on the tarballs, exactly as a tag
would. It skips `npm-token` and `publish`, so it needs no secret and cannot
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
| `npm-publish` | each version number on npm, forever | the registry; any one of the packages | the signature |
| `github-release` | nothing: a release can be edited or deleted | the GitHub API | npm |

The publish job has never run. `scripts/workflows.test.mjs` holds its shape;
the first tag is the first time it runs.

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
