import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * An Angular package publishes from the dist/ ng-packagr writes, never from
 * its source directory.
 *
 * ng-packagr writes dist/package.json with the exports, module and typings a
 * consumer resolves; packed from the source directory, the tarball would
 * carry the source manifest, whose exports point into dist/ from outside it,
 * and an `npm install` of it would resolve nothing. `publishConfig.directory`
 * is what makes pnpm pack dist/, and `linkDirectory: false` keeps the
 * workspace linking the source directory, where the workspace resolves it.
 * Which packages are Angular ones is derived, never listed: every package
 * with an ng-package.json.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Every package directory with an ng-package.json, and its manifest. */
function angularPackages() {
  return readdirSync(join(repo, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(repo, 'packages', entry.name, 'ng-package.json')))
    .map((entry) => ({ dir: `packages/${entry.name}`, manifest: JSON.parse(readFileSync(join(repo, 'packages', entry.name, 'package.json'), 'utf8')) }))
}

describe('an Angular package', () => {
  // A guard on the guard: a walk that found none would pass the next test
  // for every manifest it never read.
  test('is found by its ng-package.json', () => {
    expect(angularPackages().map(({ manifest }) => manifest.name)).toContain('@formancy/report-builder-angular')
  })

  // Packed from its source directory, the tarball's exports point at files
  // it does not contain.
  test('publishes from dist/ and links its source directory in the workspace', () => {
    const wrong = angularPackages()
      .filter(({ manifest }) => manifest.publishConfig?.directory !== 'dist' || manifest.publishConfig?.linkDirectory !== false)
      .map(({ dir }) => dir)
    expect(wrong).toEqual([])
  })
})
