import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { finalizeAngularDist } from './finalize-angular-dist.mjs'
import { LICENSE_FIELD, LICENSE_FILES } from './verify-licenses.mjs'

/**
 * scripts/finalize-angular-dist.mjs: ng-packagr's dist/ made into the package
 * this repository publishes. An Angular library packs from dist/, so its
 * dist/package.json is the manifest a consumer installs, and what ng-packagr
 * copies into it from the source checkout is wrong there in ways no other
 * gate inside the workspace sees: every workspace sibling resolves it through
 * a symlink to its source.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(repo, 'scripts', 'finalize-angular-dist.mjs')
const write = (file, text) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** What ng-packagr writes into dist/package.json for a manifest like this repository's Angular builder's. */
const NG_PACKAGR_MANIFEST = {
  name: '@formancy/report-builder-angular',
  version: '0.1.0',
  license: LICENSE_FIELD,
  type: 'module',
  sideEffects: false,
  files: ['dist', 'LICENSE.md', 'NOTICE'],
  publishConfig: { directory: 'dist', linkDirectory: false, access: 'public' },
  dependencies: { '@formancy/report-core': 'workspace:*', '@formancy/report-spec': 'workspace:^', tslib: '^2.8.0' },
  peerDependencies: { '@angular/core': '^22.0.0', '@formancy/report-builder-core': 'workspace:~' },
  module: 'fesm2022/formancy-report-builder-angular.mjs',
  typings: 'types/formancy-report-builder-angular.d.ts',
  // The source manifest's own `.` comes first since it declares exports for
  // the workspace; ng-packagr rewrites it for dist and adds ./package.json.
  exports: {
    '.': { types: './types/formancy-report-builder-angular.d.ts', default: './fesm2022/formancy-report-builder-angular.mjs' },
    './package.json': { default: './package.json' },
  },
}

const made = []
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A repository with three siblings and an Angular package that ng-packagr has built: `manifest` is its dist/package.json. */
function fixture(manifest = NG_PACKAGR_MANIFEST) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'finalize-')))
  made.push(root)
  write(join(root, 'LICENSE.md'), '# Formancy Report Source-Available Licence\n')
  write(join(root, 'NOTICE'), 'Formancy Report\n')
  write(join(root, 'packages', 'spec', 'package.json'), JSON.stringify({ name: '@formancy/report-spec', version: '0.3.0' }))
  write(join(root, 'packages', 'core', 'package.json'), JSON.stringify({ name: '@formancy/report-core', version: '0.2.0' }))
  write(join(root, 'packages', 'builder-core', 'package.json'), JSON.stringify({ name: '@formancy/report-builder-core', version: '0.1.0' }))
  const pkg = join(root, 'packages', 'angular')
  write(join(pkg, 'package.json'), JSON.stringify({ ...manifest, exports: undefined, module: undefined, typings: undefined }))
  write(join(pkg, 'dist', 'package.json'), JSON.stringify(manifest))
  write(join(pkg, 'dist', 'fesm2022', 'formancy-report-builder-angular.mjs'), 'export {}\n')
  write(join(pkg, 'dist', 'types', 'formancy-report-builder-angular.d.ts'), 'export {}\n')
  return { root, pkg, dist: join(pkg, 'dist') }
}

describe('finalizing an ng-packagr dist', () => {
  // ng-packagr copies `workspace:` ranges verbatim, and pnpm rewrites them
  // only when it publishes from the source manifest. Left in dist, the
  // tarball's first `npm install` fails on a protocol no registry knows.
  // Rewritten as pnpm rewrites them: `*` to the exact version, `^` and `~`
  // to that version under the same operator.
  test('rewrites workspace ranges to the siblings’ versions, as pnpm publishes them', () => {
    const { root, pkg, dist } = fixture()
    finalizeAngularDist(pkg, root)
    const manifest = json(join(dist, 'package.json'))
    expect(manifest.dependencies).toEqual({ '@formancy/report-core': '0.2.0', '@formancy/report-spec': '^0.3.0', tslib: '^2.8.0' })
    expect(manifest.peerDependencies).toEqual({ '@angular/core': '^22.0.0', '@formancy/report-builder-core': '~0.1.0' })
  })

  // A workspace range naming a package this repository does not have would
  // otherwise be written as `undefined`, or left as it was.
  test('refuses a workspace range for a package the repository does not have', () => {
    const { root, pkg } = fixture({ ...NG_PACKAGR_MANIFEST, dependencies: { '@formancy/report-ai': 'workspace:*' } })
    expect(() => finalizeAngularDist(pkg, root)).toThrow(/@formancy\/report-ai.*workspace:\*.*no package in this repository/)
  })

  // The source manifest's `files` says what to pack from the source
  // directory -- "dist" first. Packed from inside dist, that names a
  // directory that is not there, and the tarball carries the manifest, the
  // licence and no code at all. The list is what dist holds.
  test('lists in `files` what dist holds, and nothing it does not', () => {
    const { root, pkg, dist } = fixture()
    finalizeAngularDist(pkg, root)
    const manifest = json(join(dist, 'package.json'))
    expect(manifest.files).toEqual(['LICENSE.md', 'NOTICE', 'fesm2022', 'types'])
    for (const entry of manifest.files) expect(existsSync(join(dist, entry)), entry).toBe(true)
  })

  // The source's publishConfig.directory is what makes pnpm pack dist;
  // copied into dist it points at dist/dist. `access` stays: without it a
  // scoped package is published restricted, and the publish fails.
  test('drops the redirect into dist, and keeps the rest of publishConfig', () => {
    const { root, pkg, dist } = fixture()
    finalizeAngularDist(pkg, root)
    expect(json(join(dist, 'package.json')).publishConfig).toEqual({ access: 'public' })
  })

  // The source manifest's `types` names ./dist/types/..., so the workspace
  // resolves the package before it is packed. Copied into dist it names
  // dist/dist/types, a file no consumer has; `exports` carries the types.
  test('drops a `types` that points into dist from inside dist, and keeps the exports’ types', () => {
    const { root, pkg, dist } = fixture()
    const written = json(join(dist, 'package.json'))
    writeFileSync(join(dist, 'package.json'), `${JSON.stringify({ ...written, types: './dist/types/x.d.ts' }, null, 2)}\n`)
    finalizeAngularDist(pkg, root)
    const manifest = json(join(dist, 'package.json'))
    expect(manifest).not.toHaveProperty('types')
    expect(manifest.exports['.'].types).toBe(written.exports['.'].types)
  })

  // The licence travels with the tarball (0001, scripts/sync-licenses.mjs),
  // and dist is turbo's cached build output: copied by the build, the files
  // are restored with the cache, where copied after it they were lost on the
  // next restore (formancy.ai measured it). The manifest says where the
  // terms are, and an Apache-2.0 one copied from upstream is refused.
  test('copies LICENSE.md and NOTICE into dist, under the manifest that names them', () => {
    const { root, pkg, dist } = fixture()
    finalizeAngularDist(pkg, root)
    for (const file of LICENSE_FILES) expect(readFileSync(join(dist, file), 'utf8')).toBe(readFileSync(join(root, file), 'utf8'))
    expect(json(join(dist, 'package.json')).license).toBe(LICENSE_FIELD)

    const upstream = fixture({ ...NG_PACKAGR_MANIFEST, license: 'Apache-2.0' })
    expect(() => finalizeAngularDist(upstream.pkg, upstream.root)).toThrow(/license is Apache-2\.0/)
  })

  // Run before ng-packagr, there is nothing to finalize, and a dist with no
  // manifest would pack the source's.
  test('refuses a package ng-packagr has not built', () => {
    const { root, pkg, dist } = fixture()
    rmSync(dist, { recursive: true })
    expect(() => finalizeAngularDist(pkg, root)).toThrow(/no dist\/package\.json.*ng-packagr has not run/)
  })

  // The build runs it as a script with the package directory. A check of
  // "am I the script Node ran" that never matches -- a Windows path against
  // a URL -- would make the build finalize nothing and still succeed.
  test('does its work when the build runs it', () => {
    const { pkg, dist } = fixture()
    // Run as the build runs it, it reads the siblings of this repository.
    write(join(dist, 'package.json'), JSON.stringify({ ...NG_PACKAGR_MANIFEST, dependencies: { '@formancy/report-spec': 'workspace:*' }, peerDependencies: {} }))
    const ran = spawnSync(process.execPath, [script, pkg], { encoding: 'utf8' })
    expect(ran.status, ran.stderr).toBe(0)
    expect(json(join(dist, 'package.json')).dependencies['@formancy/report-spec']).toBe(json(join(repo, 'packages', 'report-spec', 'package.json')).version)
    expect(readFileSync(join(dist, 'LICENSE.md'), 'utf8')).toBe(readFileSync(join(repo, 'LICENSE.md'), 'utf8'))
  })
})

/**
 * The Angular builder as `pnpm build` left it, which the verify job builds
 * before it runs these. Outside CI, before a build, there is nothing to read,
 * and the checks say so by not running; in CI a missing dist fails them.
 */
const angular = join(repo, 'packages', 'report-builder-angular')
const built = existsSync(join(angular, 'dist', 'package.json'))

describe.runIf(built || process.env.CI === 'true')('the Angular builder as built', () => {
  const dist = join(angular, 'dist')
  const manifest = () => json(join(dist, 'package.json'))
  /** Every module the built code imports, by the name it is imported by. */
  const imported = () => {
    const names = new Set()
    for (const file of readdirSync(join(dist, 'fesm2022')).filter((name) => name.endsWith('.mjs'))) {
      const code = readFileSync(join(dist, 'fesm2022', file), 'utf8')
      for (const match of code.matchAll(/(?:^|[\s;])(?:import|export)\s*(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]/g)) names.add(match[1])
      for (const match of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) names.add(match[1])
    }
    return names
  }
  const packageOf = (specifier) => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')

  // Editing a report in Angular must not bring React into an application
  // (plan 21): the published manifest and the published code name none of
  // it, nor the React builder that would bring it.
  test('names no React, in its manifest or its code', () => {
    const named = [...Object.keys(manifest().dependencies ?? {}), ...Object.keys(manifest().peerDependencies ?? {}), ...[...imported()].map(packageOf)]
    expect(named.length).toBeGreaterThan(0)
    for (const name of named) expect(name, name).not.toMatch(/^(react|react-dom|@formancy\/report-builder-react)$/)
  })

  // An import the manifest does not declare is one a consumer's install
  // never brings: the code fails where it is first loaded, not here.
  test('declares every package its code imports', () => {
    const declared = new Set([...Object.keys(manifest().dependencies ?? {}), ...Object.keys(manifest().peerDependencies ?? {})])
    expect(imported().size).toBeGreaterThan(0)
    for (const specifier of imported()) expect(declared, specifier).toContain(packageOf(specifier))
  })

  // That it inlines nothing from node_modules is held with every other
  // published package's build, by dependency-licences.test.mjs (0006).

  // What finalize-angular-dist.mjs is for, on the real thing: the build ran
  // it, and it did its work.
  test('was finalized by the build', () => {
    const { dependencies, peerDependencies, files, license } = manifest()
    expect(JSON.stringify({ dependencies, peerDependencies })).not.toContain('workspace:')
    expect(license).toBe(LICENSE_FIELD)
    expect(files).toEqual(readdirSync(dist).filter((name) => name !== 'package.json').sort())
    for (const file of LICENSE_FILES) expect(files).toContain(file)
  })
})

// The fixture above is a copy of what ng-packagr writes, kept honest against
// the real one where there is one to compare with.
describe.runIf(built)('the fixture', () => {
  test('has the shape ng-packagr gives the real manifest', () => {
    const real = json(join(angular, 'dist', 'package.json'))
    for (const field of ['module', 'typings', 'type', 'sideEffects']) expect(NG_PACKAGR_MANIFEST[field], field).toBe(real[field])
    expect(Object.keys(NG_PACKAGR_MANIFEST.exports)).toEqual(Object.keys(real.exports))
  })
})
