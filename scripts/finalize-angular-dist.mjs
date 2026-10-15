// Make ng-packagr's dist/ into the package this repository publishes.
//
// Called from an Angular package's build, after ng-packagr, with the package
// directory:
//
//   node ../../scripts/finalize-angular-dist.mjs .
//
// An Angular library packs from dist/, where ng-packagr writes its own
// package.json. Its `exports`, `module` and `typings` are right for dist; the
// rest it copies from the source manifest, and five things in that copy are
// wrong for a directory that is itself the package -- the fifth is the
// source's `types`, which points into dist from outside it and is dropped:
//
// 1. `workspace:` ranges, verbatim. pnpm rewrites them when it publishes from
//    a source manifest, never in a dist/ it did not write, so the tarball's
//    first `npm install` would fail on a protocol no registry knows. Rewritten
//    here as pnpm rewrites them, to the versions of this repository's packages.
// 2. `files`, which names what to pack from the SOURCE directory: "dist"
//    first. Packed from inside dist that names nothing, and the tarball would
//    carry a manifest, a licence and no code. It becomes what dist holds.
// 3. `publishConfig.directory`, which is what makes pnpm pack dist at all and
//    which, copied into dist, points at dist/dist. The rest of publishConfig
//    stays: without `access` a scoped package is published restricted.
// 4. The licence files, which ng-packagr does not copy. They are copied here,
//    as part of the build, because dist is turbo's cached build output:
//    written after the build they are lost on the next cache restore, which
//    formancy.ai measured (its finalize script, step 3) and which stopped its
//    release at the licence gate.
//
// The manifest's `license` must already say where the terms are; one that
// says anything else -- Apache-2.0, copied from upstream -- is refused, as
// scripts/verify-licenses.mjs refuses it in the source.

import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LICENSE_FIELD, LICENSE_FILES } from './verify-licenses.mjs'

const repository = join(dirname(fileURLToPath(import.meta.url)), '..')

/** This repository's packages, by name: the versions a `workspace:` range stands for. */
function workspaceVersions(root) {
  const versions = new Map()
  for (const entry of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
    const file = join(root, 'packages', entry.name, 'package.json')
    if (!entry.isDirectory() || !existsSync(file)) continue
    const { name, version } = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof name === 'string') versions.set(name, version)
  }
  return versions
}

/** A `workspace:` range as pnpm publishes it: `*` the exact version, `^` and `~` that version under the operator, anything else as written. */
function published(name, range, versions) {
  const version = versions.get(name)
  if (version === undefined) throw new Error(`${name} is ${range}, and there is no package in this repository by that name`)
  const rest = range.slice('workspace:'.length)
  if (rest === '*') return version
  if (rest === '^' || rest === '~') return `${rest}${version}`
  return rest
}

/** Finalizes `packageDir`'s dist/ in the repository at `root`, and gives the manifest it wrote. */
export function finalizeAngularDist(packageDir, root = repository) {
  const dist = join(packageDir, 'dist')
  const manifestPath = join(dist, 'package.json')
  if (!existsSync(manifestPath)) throw new Error(`no dist/package.json in ${packageDir}: ng-packagr has not run`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (manifest.license !== LICENSE_FIELD) {
    throw new Error(`${manifest.name}: license is ${String(manifest.license)}, expected "${LICENSE_FIELD}"`)
  }

  const versions = workspaceVersions(root)
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (typeof range === 'string' && range.startsWith('workspace:')) manifest[section][name] = published(name, range, versions)
    }
  }

  // The source's `types` names ./dist/types/... so the workspace resolves the
  // package unpacked; inside dist that is dist/dist. `exports` carries the
  // types a consumer resolves.
  delete manifest.types

  if (manifest.publishConfig !== undefined) {
    const { directory: _directory, linkDirectory: _linkDirectory, ...rest } = manifest.publishConfig
    if (Object.keys(rest).length === 0) delete manifest.publishConfig
    else manifest.publishConfig = rest
  }

  for (const file of LICENSE_FILES) {
    const source = join(root, file)
    if (!existsSync(source)) throw new Error(`no ${file} at the repository root`)
    copyFileSync(source, join(dist, file))
  }

  // npm packs package.json whatever `files` says; everything else is listed.
  manifest.files = readdirSync(dist)
    .filter((name) => name !== 'package.json')
    .sort()

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

// Run as a script by the build; imported, by its test, it does nothing.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/finalize-angular-dist.mjs')) {
  finalizeAngularDist(resolve(process.argv[2] ?? process.cwd()))
}
