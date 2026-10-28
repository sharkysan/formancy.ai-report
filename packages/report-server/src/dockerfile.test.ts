import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { DEFAULT_PORT } from './settings.js'

/**
 * The server's image (0046), as its Dockerfile writes it, held to the
 * repository it is built from; the running image is the container gate's
 * (scripts/container.mjs).
 *
 * The Dockerfile copies an explicit list of packages, because copying the
 * whole repository would invalidate the dependency layer on every source
 * change. The cost is that a workspace dependency added and not copied
 * builds an image that passes every test and exits on startup with
 * ERR_MODULE_NOT_FOUND, which formancy.ai shipped once and
 * formancy.ai-data's own dockerfile.test.ts guards against: so does this.
 */
const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const read = (...path: string[]) => readFileSync(join(repo, ...path), 'utf8').replaceAll('\r\n', '\n')

interface Manifest {
  name: string
  dependencies?: Record<string, string>
}

const manifestOf = (directory: string) => JSON.parse(read('packages', directory, 'package.json')) as Manifest

/** The package directory of a workspace package, read from every manifest under packages/ rather than from a list. */
function directoryOf(name: string): string {
  for (const directory of readdirSync(join(repo, 'packages'))) {
    try {
      if (manifestOf(directory).name === name) return directory
    } catch {
      // Not a package directory in this checkout.
    }
  }
  throw new Error(`no workspace package is called ${name}`)
}

/** Every workspace package directory `from` needs at run time, itself included, transitively. */
function workspaceClosure(from: string): Set<string> {
  const found = new Set<string>()
  const pending = [from]
  while (pending.length > 0) {
    const directory = pending.pop()
    if (directory === undefined || found.has(directory)) continue
    found.add(directory)
    for (const [name, range] of Object.entries(manifestOf(directory).dependencies ?? {})) {
      // `workspace:` is what makes it this repository's; a published dependency needs no COPY.
      if (range.startsWith('workspace:')) pending.push(directoryOf(name))
    }
  }
  return found
}

/**
 * The Dockerfile's instructions, comments and blank lines left out, and
 * `text`, the same joined by their newlines: what Docker builds from. A
 * line commented out is no instruction, so nothing here is matched in a
 * comment, where a COPY someone disabled would still read as present.
 */
const instructions = read('packages', 'report-server', 'Dockerfile')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#') && line.trim() !== '')
const text = instructions.join('\n')

describe('the container build', () => {
  // The failure this prevents is not a build error: the image builds, the
  // suite is green, and the container exits on startup with a module it
  // cannot find.
  test('copies every workspace package the server depends on, manifest early and source late', () => {
    const needed = [...workspaceClosure('report-server')].sort()
    expect(needed.filter((directory) => !instructions.includes(`COPY packages/${directory}/ packages/${directory}/`))).toEqual([])
    expect(needed.filter((directory) => !instructions.includes(`COPY packages/${directory}/package.json packages/${directory}/`))).toEqual([])
    const manifests = instructions.findIndex((line) => line.includes('/package.json packages/'))
    const install = instructions.findIndex((line) => line.startsWith('RUN pnpm install'))
    const sources = instructions.findIndex((line) => /^COPY packages\/[\w-]+\/ /.test(line))
    expect([manifests < install, install < sources]).toEqual([true, true])
  })

  // A guard on the guard: a closure that silently came back empty, or
  // lost the server, would make the test above pass forever.
  test('reads the closure from the manifests', () => {
    expect(workspaceClosure('report-server')).toEqual(new Set(['report-server', 'report-server-core', 'report-spec']))
    expect(workspaceClosure('report-server-core')).toEqual(new Set(['report-server-core', 'report-spec']))
  })

  // SV-Q5: Node 26, whose permission model has a network scope the
  // renderer's workers will need, at an exact digest, in both stages, so
  // that the image a release builds is the one this gate ran. The tag says
  // which release the digest is; the digest is what is pulled.
  test('builds and runs on one Node 26 image, pinned by its digest', () => {
    const bases = instructions.filter((line) => line.startsWith('FROM ')).map((line) => line.split(' ')[1])
    expect(bases).toHaveLength(2)
    expect(new Set(bases).size).toBe(1)
    expect(bases[0]).toMatch(/^node:26\.\d+\.\d+-alpine\d+\.\d+@sha256:[0-9a-f]{64}$/)
  })

  // The pnpm the image installs with is the one the repository pins, so
  // the image is built as CI builds: the lockfile read by the same release.
  test('installs with the pnpm the repository pins, from the lockfile, running no install script', () => {
    const pinned = (JSON.parse(read('package.json')) as { packageManager: string }).packageManager
    expect(instructions).toContain(`RUN npm install -g --ignore-scripts ${pinned}`)
    expect(instructions.find((line) => line.startsWith('RUN pnpm install'))).toMatch(/--frozen-lockfile --ignore-scripts/)
  })

  // The licence travels with the image: the runtime tree comes from `pnpm
  // deploy`, which packs what the manifest's `files` lists, and those are
  // copied into each package by sync-licenses.mjs at build time.
  test('is built with the licence in place', () => {
    expect(instructions).toContain('COPY LICENSE.md NOTICE tsconfig.base.json ./')
    expect(instructions).toContain('COPY scripts/sync-licenses.mjs scripts/')
    expect(instructions).toContain('RUN pnpm --filter @formancy/report-server... build && node scripts/sync-licenses.mjs')
    expect(instructions).toContain('RUN pnpm --filter @formancy/report-server --prod deploy /app')
  })

  // The tree the server runs from is root's, and only readable to the user
  // it runs as: copied as that user's, a process made to write could
  // rewrite its own code, and the change would outlive a restart. The one
  // directory the image gives that user is the store's.
  test('gives the user it runs as the store’s directory and nothing of its code', () => {
    expect(instructions.filter((line) => line.startsWith('COPY --from='))).toEqual(['COPY --from=build /app /app'])
    expect(instructions.filter((line) => /\b(?:chown|chmod)\b|--chown|--chmod/.test(line))).toEqual(['RUN mkdir -p /var/lib/formancy-report && chown node:node /var/lib/formancy-report'])
  })

  // Unprivileged: the store's volume, which the operator mounts, has its
  // directory given to the user the server runs as, so a new named volume
  // is that user's.
  test('runs as node, owning the store directory, and starts main.mjs, which the build makes', () => {
    const user = instructions.findIndex((line) => line === 'USER node')
    const store = instructions.findIndex((line) => line === 'RUN mkdir -p /var/lib/formancy-report && chown node:node /var/lib/formancy-report')
    const command = instructions.findIndex((line) => line === 'CMD ["node", "dist/main.mjs"]')
    expect([store !== -1, store < user, user < command, command === instructions.length - 1]).toEqual([true, true, true, true])
    expect(read('packages', 'report-server', 'tsdown.config.ts')).toContain("entry: ['src/index.ts', 'src/main.ts']")
  })

  // The port it listens on, says it exposes and probes is the settings'
  // default, so an image run without PORT answers where it says it does.
  test('exposes, sets and probes the settings’ default port', () => {
    expect(text).toContain(`PORT=${String(DEFAULT_PORT)}`)
    expect(instructions).toContain(`EXPOSE ${String(DEFAULT_PORT)}`)
    expect(text).toMatch(new RegExp(`HEALTHCHECK [^\\n]*\\n\\s+CMD node -e "fetch\\('http://127\\.0\\.0\\.1:'\\+\\(process\\.env\\.PORT\\|\\|${String(DEFAULT_PORT)}\\)\\+'/health'\\)`))
  })

  // The build context is the repository root; without these left out, a
  // machine's node_modules, dist or .git would ride into the image's first
  // stage, and a stale local build could stand in for the one the image
  // makes.
  test('leaves a machine’s installs, builds and history out of the build context', () => {
    const ignored = read('.dockerignore').split('\n').map((line) => line.trim())
    for (const entry of ['**/node_modules', '**/dist', '**/coverage', '**/.turbo', '.git', '**/test-results', 'release-results', 'release-tarballs', '.e-invoice-cache']) expect(ignored, entry).toContain(entry)
  })
})
