import { describe, expect, test } from 'vitest'
import { readWorkflow } from './workflows.mjs'

/**
 * The shape of the workflows a release depends on, parsed with `yaml`, as
 * formancy.ai-data holds its own: CI and the release run one gates workflow;
 * the release decides once whether it publishes; every check on what it
 * would publish runs in a job that holds `contents: read` and no secret, and
 * pins what it checked; and everything permanent is in one job behind one
 * condition, which publishes only what was pinned, with npm, which nothing
 * can undo, as late as it can be. This holds the shape, not the behaviour:
 * the publish job has never run, and a rehearsal exercises everything else.
 */
const gates = readWorkflow(undefined, '.github/workflows/gates.yml')
const ci = readWorkflow(undefined, '.github/workflows/ci.yml')
const release = readWorkflow(undefined, '.github/workflows/release.yml')

const PUBLISHING = "${{ github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v') }}"
const ONLY_WHEN_PUBLISHING = "needs.tag.outputs.publishing == 'true'"

/** Every step of every job of a workflow, with its job's id. */
const steps = (workflow) => Object.entries(workflow.jobs).flatMap(([job, definition]) => (definition.steps ?? []).map((step) => ({ job, step })))

/** Every string a step hands to the runner: its run, each `with` and each `env` value. */
const handed = (step) => [step.run, ...Object.values(step.with ?? {}), ...Object.values(step.env ?? {})].filter((value) => typeof value === 'string')

describe('ci.yml', () => {
  // CI and the release must run the same gates; two copies of them drift.
  // A secret is handed over by name: `secrets: inherit` would give the gates
  // every secret the repository holds.
  test('is one job that runs gates.yml with the coverage token and nothing else', () => {
    expect(Object.keys(ci.jobs)).toEqual(['gates'])
    expect(ci.jobs.gates.uses).toBe('./.github/workflows/gates.yml')
    expect(ci.jobs.gates.secrets).toEqual({ CODECOV_TOKEN: '${{ secrets.CODECOV_TOKEN }}' })
  })
})

describe('release.yml', () => {
  // A job added beside these would run with whatever it is given, outside
  // the order this file is about.
  test('has exactly its five jobs, on a version tag and on a dispatch', () => {
    expect(Object.keys(release.jobs)).toEqual(['tag', 'npm-token', 'gates', 'check', 'publish'])
    expect(release.on.push.tags).toEqual(['v*'])
    expect(Object.keys(release.on)).toEqual(['push', 'workflow_dispatch'])
    expect(release.permissions).toEqual({ contents: 'read' })
  })

  // The condition written twice is two conditions, one day different; a
  // dispatch must never satisfy it, and a missing output must not either.
  test('decides once, in the tag job, whether this run publishes', () => {
    const mode = release.jobs.tag.steps.find((step) => step.id === 'mode')
    expect(mode.env.PUBLISHING).toBe(PUBLISHING)
    expect(mode.run).toContain('publishing=$PUBLISHING')
    expect(Object.keys(release.jobs.tag.outputs).sort()).toEqual(['publishing', 'release', 'version'])
    expect(JSON.stringify(release).split('startsWith(github.ref').length - 1).toBe(1)
  })

  // The token is checked beside the gates, and read by no job but the two
  // that run only on a tag's push.
  test('reads NPM_TOKEN only in the npm-token and publish jobs, each behind the one condition', () => {
    expect(release.jobs['npm-token'].if).toBe(ONLY_WHEN_PUBLISHING)
    expect(release.jobs.publish.if).toBe(ONLY_WHEN_PUBLISHING)
    const reading = Object.entries(release.jobs).filter(([, job]) => JSON.stringify(job).includes('secrets.NPM_TOKEN')).map(([id]) => id)
    expect(reading).toEqual(['npm-token', 'publish'])
  })

  // A repository secret is readable by a workflow on any branch a
  // collaborator pushes; one in an environment whose deployment policy
  // admits only `v*` tags is not. The policy is a repository setting no test
  // here can see (REPO-METADATA.md); that the two jobs ask for it is held here.
  test('reads the npm token from the npm environment, in the two jobs that need it and no other', () => {
    expect(Object.entries(release.jobs).filter(([, job]) => job.environment !== undefined).map(([id, job]) => `${id}: ${String(job.environment)}`)).toEqual(['npm-token: npm', 'publish: npm'])
  })

  // The job that installs and builds holds nothing it could misuse; only the
  // job behind the condition may write or sign. No image yet, so no
  // `packages: write`.
  test('gives publish, and only publish, more than reading the repository', () => {
    for (const [id, job] of Object.entries(release.jobs)) {
      if (id === 'publish' || id === 'gates') continue
      expect(job.permissions ?? { contents: 'read' }, id).toEqual({ contents: 'read' })
    }
    expect(release.jobs.publish.permissions).toEqual({ contents: 'write', 'id-token': 'write' })
  })

  // A release passes no secret to the gates, so the coverage upload never
  // runs in one, and its gates are CI's with the release named.
  test('runs the gates with the release named and no secret', () => {
    expect(release.jobs.gates.uses).toBe('./.github/workflows/gates.yml')
    expect(release.jobs.gates.with).toEqual({ release: '${{ needs.tag.outputs.release }}' })
    expect(release.jobs.gates).not.toHaveProperty('secrets')
  })

  // Every check on the content runs before the first permanent step, and
  // npm, whose versions nothing can delete, comes after the signature and
  // before only the GitHub release, which can be edited.
  test('publishes after every check, in one job, with npm second to last', () => {
    const publish = release.jobs.publish
    expect(publish.needs).toEqual(expect.arrayContaining(['tag', 'npm-token', 'gates', 'check']))
    expect(publish.steps.filter((step) => step.if !== undefined).map((step) => step.id ?? step.name)).toEqual([])
    const ids = publish.steps.map((step) => step.id)
    const order = ['downloads-checked', 'sign-sbom', 'npm-publish', 'github-release']
    expect(ids.filter((id) => order.includes(id))).toEqual(order)
  })

  // Every job of a run can write to its artefacts, `check` included, and
  // cdxgen, which `check` runs, has dependencies nothing locks. So `check`
  // pins the tarballs before cdxgen runs and the SBOM after, and `publish`
  // refuses, before it signs anything and again before npm, whatever it
  // downloads that is not what was pinned.
  test('pins what check checked before cdxgen runs, and publishes nothing else', () => {
    const check = release.jobs.check
    expect(check.outputs).toEqual({ checked: '${{ steps.tarballs-checked.outputs.checked }}', sbom: '${{ steps.sbom-checked.outputs.checked }}' })
    const ids = check.steps.map((step) => step.id)
    expect(ids.filter((id) => ['tarballs-checked', 'sbom', 'sbom-checked'].includes(id))).toEqual(['tarballs-checked', 'sbom', 'sbom-checked'])
    expect(check.steps.slice(0, ids.indexOf('tarballs-checked')).filter((step) => /cdxgen|npx/.test(String(step.run)))).toEqual([])
    const publish = release.jobs.publish
    expect(publish.env).toMatchObject({ CHECKED: '${{ needs.check.outputs.checked }}', CHECKED_SBOM: '${{ needs.check.outputs.sbom }}', VERSION: '${{ needs.tag.outputs.version }}' })
    const downloads = publish.steps.findIndex((step) => step.id === 'downloads-checked')
    expect(publish.steps[downloads].run).toContain('scripts/release/pins.mjs downloads')
    expect(publish.steps.slice(downloads + 1).filter((step) => String(step.uses).startsWith('actions/download-artifact'))).toEqual([])
    expect(publish.steps.find((step) => step.id === 'npm-publish').run).toContain('scripts/release/publish.mjs')
  })

  // A file named from a ref is a path a dispatch from `feat/x` gives a `/`;
  // every name comes from the tag job's `release` instead.
  test('names nothing from a ref outside the tag job’s mode step', () => {
    const ref = /GITHUB_REF(?:_NAME)?\b|github\.ref(?:_name)?\b/
    const naming = steps(release)
      .filter(({ job, step }) => !(job === 'tag' && step.id === 'mode'))
      .filter(({ step }) => handed(step).some((value) => ref.test(value)))
      .map(({ job, step }) => `${job}: ${step.id ?? step.name ?? step.uses}`)
    expect(naming).toEqual([])
    expect(Object.values(release.jobs).filter((job) => Object.values(job.env ?? {}).some((value) => ref.test(String(value))))).toEqual([])
  })
})

describe('gates.yml', () => {
  // An expression inside a script is text a matrix value or a tag name can
  // write shell into; through `env` it is only ever a value.
  test('puts no expression inside a script, here or in the release', () => {
    for (const workflow of [gates, release]) {
      expect(steps(workflow).filter(({ step }) => String(step.run ?? '').includes('${{')).map(({ job, step }) => `${job}: ${step.name ?? step.run}`)).toEqual([])
    }
  })

  // gates.yml is code a release runs with its permissions, and a tag is a
  // pointer whoever owns the action can move.
  test('pins every third-party action to a commit, here and in the release', () => {
    for (const workflow of [gates, release]) {
      const loose = steps(workflow)
        .map(({ step }) => step.uses)
        .filter((uses) => typeof uses === 'string' && !uses.startsWith('actions/') && !uses.startsWith('./'))
        .filter((uses) => !/@[0-9a-f]{40}$/.test(uses))
      expect(loose).toEqual([])
    }
  })

  // A tag's run may restore a cache a main-branch run saved, and a cache is
  // what any code that ran in that job left in the store: a dependency the
  // tests execute could reach the dist/ npm receives through it. CI keeps
  // its caches; a release or a rehearsal installs from the registry against
  // the lockfile.
  test('restores no cache in a release or a rehearsal', () => {
    const caches = steps(gates).filter(({ step }) => String(step.uses).startsWith('actions/cache'))
    expect(caches.length).toBeGreaterThan(0)
    expect(caches.filter(({ step }) => step.if !== "inputs.release == ''").map(({ job, step }) => `${job}: ${step.name ?? step.with?.path}`)).toEqual([])
    expect(steps(release).filter(({ step }) => String(step.uses).startsWith('actions/cache')).map(({ job }) => job)).toEqual([])
  })

  // The suite runs fresh, the package reaching the command through the
  // environment rather than an expression in the script.
  test('runs each package fresh, the package from the environment', () => {
    const run = gates.jobs.test.steps.find((step) => String(step.run).includes('turbo run test:coverage'))
    expect(run.run).toBe('pnpm exec turbo run test:coverage --filter="$PACKAGE" --force --summarize')
    expect(run.env).toEqual({ PACKAGE: '${{ matrix.package }}' })
  })

  // The tarballs a release publishes are the ones this job installed and ran.
  test('keeps the tarballs the install gate packed, installed and ran', () => {
    const install = gates.jobs.install.steps
    expect(install.map((step) => step.run).filter(Boolean)).toContain('node scripts/install-test.mjs --keep-tarballs release-tarballs')
    expect(install.find((step) => step.with?.name === 'release-tarballs')?.with).toEqual({ name: 'release-tarballs', path: 'release-tarballs/', 'if-no-files-found': 'error', overwrite: true })
  })
})
