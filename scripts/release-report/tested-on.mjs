// What this checkout is tested with, as far as the tree itself can say (0014;
// formancy.ai-data 0035's tested-on, without its database images and
// browsers): every runtime dependency a published package declares and the
// version the suites load, each peer a builder declares and the version its
// suites run against, the upstream @formancy/* packages, Node, pnpm, and the
// tools -- TypeScript and PDF.js among them.
//
// Static facts, derived from the manifests and from what is installed;
// nothing here is typed but the list of tools. What a run actually ran -- the
// Node of each job, and the React and Angular each install host resolved --
// comes from that run's results, in the report; this is what the README's
// generated table and the report's "range -> loaded" columns read.
//
// Run after `pnpm install`. Nothing here needs a build.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { mustBeInstalled } from '../release/installed.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * What the report and the README call tooling, and where each is resolved
 * from: the workspace root, one package, or every package that declares it.
 * The one typed list; tested-on.test.mjs fails when an entry names nothing
 * installed.
 */
const TOOLING = [
  { name: 'typescript', dir: '.' },
  { name: 'vitest', dir: '.' },
  // The reader every claim about a rendered PDF is checked with (0003).
  { name: 'pdfjs-dist', dir: 'packages/report-corpus' },
  { name: 'jsdom', declared: true },
  { name: 'axe-core', declared: true },
]

const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** Every workspace package: `{ dir, manifest }`, dir repository-relative, in path order. */
export function workspace(root = repo) {
  const found = []
  for (const group of ['packages', 'apps']) {
    if (!existsSync(join(root, group))) continue
    for (const name of readdirSync(join(root, group)).sort()) {
      const file = join(root, group, name, 'package.json')
      if (existsSync(file)) found.push({ dir: `${group}/${name}`, manifest: readJson(file) })
    }
  }
  return found
}

/** The packages a release publishes: every package under packages/ that is not private. */
export function published(root = repo) {
  return workspace(root).filter(({ dir, manifest }) => dir.startsWith('packages/') && manifest.private !== true)
}

/** A package that is no workspace sibling, no `workspace:` link and no upstream @formancy/* package: somebody else's. */
const thirdParty = (local) => ([name, range]) => !local.has(name) && !String(range).startsWith('workspace:') && !name.startsWith('@formancy/')

/** Every entry of `field` of every published package that is somebody else's: the range it is published with and the version its suites load. */
function declaredBy(root, packages, local, field) {
  return [...packages]
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
    .flatMap(({ dir, manifest }) => Object.entries(manifest[field] ?? {}).filter(thirdParty(local)).map(([name, range]) => ({ package: manifest.name, name, range, loaded: mustBeInstalled(join(root, dir), name).version })))
}

/** Every upstream @formancy/* package a workspace manifest names, and theirs, recursively; each as Node loads it. */
function upstream(root, packages, local) {
  const seen = new Map()
  const visit = (fromDir, name, declared, direct) => {
    const found = mustBeInstalled(fromDir, name)
    const key = `${name}@${found.version}`
    const entry = seen.get(key) ?? { name, version: found.version, declared: null, direct: false }
    if (declared !== null) entry.declared = declared
    entry.direct ||= direct
    if (seen.has(key)) return
    seen.set(key, entry)
    for (const [inner] of Object.entries(readJson(join(found.dir, 'package.json')).dependencies ?? {})) {
      if (inner.startsWith('@formancy/')) visit(found.dir, inner, null, false)
    }
  }
  for (const { dir, manifest } of packages) {
    for (const field of FIELDS) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if (name.startsWith('@formancy/') && !local.has(name)) visit(join(root, dir), name, String(spec), true)
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

/** Every `node-version` an `actions/setup-node` step of a workflow sets, with where. */
export function setupNodeVersions(root = repo) {
  const dir = join(root, '.github', 'workflows')
  const found = []
  for (const file of readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort()) {
    const workflow = YAML.parse(readFileSync(join(dir, file), 'utf8'))
    for (const [job, definition] of Object.entries(workflow?.jobs ?? {})) {
      for (const step of definition?.steps ?? []) {
        if (String(step.uses ?? '').startsWith('actions/setup-node') && step.with?.['node-version'] !== undefined) {
          found.push({ workflow: file, job, version: String(step.with['node-version']) })
        }
      }
    }
  }
  return found
}

/** How the workspace declares a tool: the range in the root manifest, the catalog's for `catalog:`, or the manifest of the one directory it is read from. */
function declaredRange(root, packages, name, dir) {
  const owner = dir === '.' ? readJson(join(root, 'package.json')) : packages.find((entry) => entry.dir === dir)?.manifest
  const spec = FIELDS.map((field) => owner?.[field]?.[name]).find((value) => value !== undefined) ?? null
  if (spec !== 'catalog:') return spec
  return YAML.parse(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')).catalog?.[name] ?? null
}

/** The tools, each with how the workspace declares it and every version the directories that use it load. */
function tooling(root, packages) {
  return TOOLING.map(({ name, dir, declared }) => {
    const dirs = declared ? packages.filter(({ manifest }) => FIELDS.some((field) => manifest[field]?.[name] !== undefined)).map((entry) => entry.dir) : [dir]
    if (dirs.length === 0) throw new Error(`no workspace package declares ${name}, which the report names as tooling`)
    const versions = new Map()
    for (const from of dirs) {
      const { version } = mustBeInstalled(join(root, from), name)
      versions.set(version, [...(versions.get(version) ?? []), from])
    }
    return { name, declared: declared ? null : declaredRange(root, packages, name, dir), versions: [...versions].map(([version, from]) => ({ version, from })) }
  })
}

/** The package manager corepack runs, from the root's `packageManager`: `pnpm@12.4.2` is pnpm 12.4.2, a `+sha…` suffix dropped. */
function packageManager(manifest) {
  const declared = manifest.packageManager
  const match = /^(@?[^@]+)@([^+]+)/.exec(String(declared ?? ''))
  if (match === null) throw new Error('the root package.json declares no packageManager, which corepack runs')
  return { name: match[1], version: match[2], declared }
}

/** Everything above, for `root`. Throws, naming the package, when a lookup finds nothing. */
export function testedOn(root = repo) {
  const packages = workspace(root)
  const local = new Set(packages.map(({ manifest }) => manifest.name))
  const rootManifest = readJson(join(root, 'package.json'))
  return {
    runtime: declaredBy(root, published(root), local, 'dependencies'),
    peers: declaredBy(root, published(root), local, 'peerDependencies'),
    upstream: upstream(root, packages, local),
    node: {
      engines: rootManifest.engines?.node ?? null,
      ci: setupNodeVersions(root),
      declared: published(root)
        .filter(({ manifest }) => manifest.engines?.node !== undefined)
        .map(({ manifest }) => ({ package: manifest.name, node: manifest.engines.node })),
    },
    packageManager: packageManager(rootManifest),
    tooling: tooling(root, packages),
  }
}
