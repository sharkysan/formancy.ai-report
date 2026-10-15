#!/usr/bin/env node
/**
 * Install the packed packages into projects that know nothing about this
 * repository, and run them.
 *
 * **Why no other gate can see this.** `pnpm build`, `typecheck`, `test:coverage`
 * and `check:pkg` all run inside the workspace, against the tree they were
 * built from. A workspace sibling resolves a package through a symlink to its
 * source directory, so an `exports` map that is wrong for a real consumer can
 * be right for every test in the repository. formancy.ai shipped a package with
 * no `exports` at all for four releases that way, while ninety-five tests and
 * `publint` said nothing.
 *
 * **What this proves, and only this.** The tarballs `pnpm pack` produces
 * install into plain npm projects, one per kind of host, each holding only
 * what that host would (`install-hosts.mjs` says what, and why apart); every
 * entry point resolves; the types resolve with `skipLibCheck` off, against
 * the types that host has and no others; and the code runs. The Node
 * packages are driven end to end. The React builder is drawn by React's
 * server renderer, in its development and its production build, and bundled
 * for a browser. The Angular builder is compiled into a host ahead of time,
 * linked, drawn by Angular's platform-server and bundled for a browser.
 * Each builder is checked at the newest release its peer range admits and
 * at the oldest. Each consumer in `install-fixture/` says what it checks
 * and what it cannot. Neither builder is mounted in a DOM here: no focus, no
 * key, no pointer, no re-render after an edit.
 *
 * It does **not** talk to npm about these packages, so it says nothing about
 * the registry copy; the frameworks and tools come from the registry.
 *
 * **What it leaves behind.** `test-results/install.json` at the root, written
 * however the gate ends: whether it passed, the Node and npm it ran under,
 * every `@formancy/*` package a clean `npm install` resolved, each tarball's
 * name, sha256, npm integrity and the hash of its `dist/` -- what a release
 * report reads, once there is one (formancy.ai-data 0035) -- and, per
 * consumer, the framework it was installed beside, how far it got and what
 * each step said. With `--keep-tarballs <dir>` the tarballs are copied there
 * before the work directory goes, so the release publishes exactly these.
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { planProjects } from './install-hosts.mjs'
import { distHash, distOfTarball } from './release/dist-hash.mjs'
import { installed } from './release/installed.mjs'
import { integrityOf } from './release/publish.mjs'
import { readTarball } from './release/tarball.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')

/** Every publishable package, as a name and the directory to pack from. */
function publishable() {
  const root = join(repo, 'packages')
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const file = join(root, entry.name, 'package.json')
      let manifest
      try {
        manifest = JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        return []
      }
      if (manifest.private === true || manifest.name === undefined) return []
      return [{ name: manifest.name, dir: join(root, entry.name) }]
    })
}

/**
 * Run a program, on either platform, and answer what it printed.
 *
 * `pnpm`, `npm` and `npx` are `.cmd` shims on Windows, so the bare name is
 * `spawn ENOENT` there -- and Node 20 and later refuse to spawn a `.cmd` at
 * all without a shell, which is `EINVAL`. So Windows gets a shell with every
 * argument quoted, and everywhere else gets the executable directly, which is
 * the safer of the two and is what CI runs. `node` is this Node, directly.
 *
 * NODE_ENV is the step's to set and nobody else's: inherited as
 * `production`, it would make `npm install` leave out the tools and make the
 * React builder's development run its production one.
 */
const WINDOWS = process.platform === 'win32'
const execute = promisify(execFile)
/** The colour codes ngc always writes, which would reach install.json as escape codes. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

async function run(command, args, cwd, env = {}) {
  const { NODE_ENV: _ignored, ...inherited } = process.env
  const options = { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...inherited, ...env } }
  try {
    if (command === 'node') return (await execute(process.execPath, args, options)).stdout
    if (!WINDOWS) return (await execute(command, args, options)).stdout
    // One command line rather than arguments beside `shell`, which Node
    // would concatenate unescaped all the same, and warns about (DEP0190).
    const quoted = args.map((arg) => (/[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg))
    return (await execute([`${command}.cmd`, ...quoted].join(' '), { ...options, shell: true })).stdout
  } catch (error) {
    // Said once: the command, then what it printed, which is where tsc, ngc
    // and a failed check say what is wrong, without ngc's colours.
    const said = `${error.stdout ?? ''}${error.stderr ?? ''}`.replace(ANSI, '').trim()
    throw new Error(`${[command, ...args].join(' ')} failed${said === '' ? `: ${error.message}` : `:\n${said.slice(0, 6000)}`}`)
  }
}

/**
 * A program installed in the project. `--no`, so a binary missing from the
 * project fails here: without it npx fetches whatever package on the
 * registry has that name, and `ngc` and `tsc` are both the names of
 * unrelated packages there.
 */
const inProject = (command, cwd, env) => (command[0] === 'node' ? run('node', command.slice(1), cwd, env) : run('npx', ['--no', '--', ...command], cwd, env))

/**
 * Every `@formancy/*` package a project's `npm install` resolved, this
 * repository's and upstream's, by version. Read right after the install,
 * because the projects are deleted at the end. formancy.ai-data also records
 * each runtime dependency its report's *Tested on* names; that list arrives
 * here with the report.
 */
function resolvedIn(project) {
  const scope = join(project, 'node_modules', '@formancy')
  if (!existsSync(scope)) return []
  return readdirSync(scope)
    .map((name) => `@formancy/${name}`)
    .flatMap((name) => {
      const found = installed(project, name)
      return found === undefined ? [] : [{ name, version: found.version }]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The manifest a tarball carries, as npm will read it. */
const manifestOf = (file) => JSON.parse(readTarball(readFileSync(file)).get('package/package.json')?.toString('utf8') ?? '{}')

/** What the report and the release need of a tarball: its bytes' hashes and what its dist/ holds. */
function describeTarball(name, file) {
  const bytes = readFileSync(file)
  return {
    name,
    version: manifestOf(file).version ?? null,
    file: basename(file),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    // What npm records as the tarball's integrity, and the registry as its dist.integrity.
    integrity: integrityOf(bytes),
    distHash: distHash(distOfTarball(readTarball(bytes))),
  }
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`

/**
 * Installs `project` in a directory of its own under `work` and runs its
 * steps in order, filling `entry` in as each passes. Answers what to print.
 */
async function check(project, entry, tarballs) {
  const dir = join(work, project.name)
  mkdirSync(dir, { recursive: true })
  // The fixture is copied rather than generated: TypeScript inside a template
  // literal inside a script is the shape that cost upstream two broken attempts.
  cpSync(join(here, 'install-fixture'), dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    json({
      name: `formancy-report-install-${project.name}`,
      private: true,
      type: 'module',
      dependencies: { ...Object.fromEntries(project.packages.map((name) => [name, `file:${tarballs.get(name)}`])), ...project.framework },
      devDependencies: project.tools,
    }),
  )
  writeFileSync(join(dir, project.tsconfig.file), json(project.tsconfig.content))

  // npm rather than pnpm, deliberately: pnpm in a directory under a workspace
  // can still find the workspace, and resolving through it is the thing this
  // test exists to avoid.
  await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error'], dir)
  entry.npmInstalled = true
  entry.resolved = resolvedIn(dir)
  entry.installed = Object.fromEntries(Object.keys(project.framework).map((name) => [name, installed(dir, name)?.version ?? null]))

  // What a builder's project is apart for. Anything that brings Node's types
  // into it -- a dependency of the builder's, or of a tool -- lets a builder
  // declaration that references them pass here and fail in a browser host.
  if (project.host !== 'node' && installed(dir, '@types/node') !== undefined) throw new Error(`${project.name} has @types/node installed, which a browser host's code is checked without`)

  const framework = Object.entries(entry.installed).map(([name, version]) => `${name} ${String(version)}`).join(', ')
  const lines = [`\n${project.name}: ${project.consumer}${framework === '' ? '' : `, beside ${framework}`}`]
  for (const [at, step] of project.steps.entries()) {
    const said = (await inProject(step.command, dir, step.env)).trim()
    entry.steps[at].done = true
    entry.steps[at].said = said
    lines.push(`  ${step.name}: ${said === '' ? 'passed' : said.replaceAll('\n', '\n    ')}`)
  }
  return lines.join('\n')
}

const keepAt = process.argv.indexOf('--keep-tarballs')
const keep = keepAt === -1 ? undefined : resolve(process.argv[keepAt + 1] ?? '')
if (keepAt !== -1 && process.argv[keepAt + 1] === undefined) throw new Error('--keep-tarballs needs a directory')

const work = mkdtempSync(join(tmpdir(), 'formancy-report-install-'))
const record = { startedAt: new Date().toISOString(), node: process.version, npm: null, resolved: [], tarballs: [], consumers: [] }
let failure

try {
  const packages = publishable()
  // A walk that finds none has gone wrong, and a test over zero packages
  // passes by having nothing to check.
  if (packages.length < 1) {
    throw new Error(`only found ${String(packages.length)} publishable packages; the walk is wrong`)
  }

  const tarballs = new Map()
  for (const { name, dir } of packages) {
    const out = await run('pnpm', ['pack', '--pack-destination', work], dir)
    const file = out.trim().split('\n').at(-1)
    if (file === undefined || !file.endsWith('.tgz')) {
      throw new Error(`pnpm pack said something unexpected for ${name}: ${out}`)
    }
    tarballs.set(name, file.startsWith(work) ? file : join(work, file))
  }
  console.log(`packed ${String(tarballs.size)} packages`)
  record.tarballs = [...tarballs].map(([name, file]) => describeTarball(name, file))
  if (keep !== undefined) {
    mkdirSync(keep, { recursive: true })
    for (const file of tarballs.values()) cpSync(file, join(keep, basename(file)))
  }
  record.npm = (await run('npm', ['--version'], work)).trim()

  // Planned from the manifests the tarballs carry, which are what npm reads.
  const projects = planProjects(new Map([...tarballs].map(([name, file]) => [name, manifestOf(file)])))
  record.consumers = projects.map(({ name, consumer, at, steps }) => ({ project: name, consumer, at, npmInstalled: false, installed: {}, resolved: [], steps: steps.map((step) => ({ step: step.name, done: false, said: null })) }))
  console.log(`installing ${String(projects.length)} projects into plain npm projects, each with what its host has, and checking each…`)

  // At once: most of the time is npm's, waiting on the network.
  const outcomes = await Promise.allSettled(projects.map((project, at) => check(project, record.consumers[at], tarballs)))
  const failed = []
  for (const [at, outcome] of outcomes.entries()) {
    if (outcome.status === 'fulfilled') console.log(outcome.value)
    else failed.push(`${projects[at].name}: ${String(outcome.reason?.message ?? outcome.reason)}`)
  }
  const resolved = new Map(record.consumers.flatMap(({ resolved: found }) => found).map((entry) => [`${entry.name}@${entry.version}`, entry]))
  record.resolved = [...resolved.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  if (failed.length > 0) throw new Error(failed.join('\n\n'))

  console.log('\ninstall test passed: the packed tarballs work in projects that are not this one')
} catch (error) {
  failure = error
  console.error('\ninstall test FAILED')
  console.error(String(error?.message ?? error))
} finally {
  rmSync(work, { recursive: true, force: true })
  mkdirSync(join(repo, 'test-results'), { recursive: true })
  const result = { ...record, finishedAt: new Date().toISOString(), passed: failure === undefined, ...(failure === undefined ? {} : { error: String(failure?.message ?? failure) }) }
  writeFileSync(join(repo, 'test-results', 'install.json'), json(result), 'utf8')
}

process.exit(failure === undefined ? 0 : 1)
