import { describe, expect, test } from 'vitest'
import { LICENSE_FIELD } from '../verify-licenses.mjs'
import { pinProblems, pinsOf, sbomProblems, sha256, tarballProblems } from './pins.mjs'
import { packageTarball } from './test-archive.mjs'

/**
 * What release.yml's `check` job checks of the tarballs and the SBOM, and
 * what its `publish` job refuses: anything downloaded that is not, byte for
 * byte, what `check` pinned. Every job of a run can write to its artefacts,
 * so the job that holds the npm token takes nobody's word for what it was
 * handed. Pure; the release has never run, and RELEASING.md says so.
 */
const SPEC = { name: '@formancy/report-spec', version: '0.1.0', license: LICENSE_FIELD }
const tarball = (manifest = SPEC, options) => ({ path: 'release-tarballs/formancy-report-spec-0.1.0.tgz', bytes: packageTarball(manifest, options) })

describe('tarballProblems', () => {
  // The tarball the install gate packed, at the version the tag names, under
  // the source-available terms, carrying them: what npm may receive.
  test('accepts a tarball at the release version that declares and carries its licence', () => {
    expect(tarballProblems(tarball(), '0.1.0')).toEqual([])
  })

  // A tag that says one version over a tarball of another would publish the
  // wrong bytes under the right name, which nothing can take back.
  test('refuses a tarball of another version', () => {
    expect(tarballProblems(tarball(), '0.2.0')).toEqual(['release-tarballs/formancy-report-spec-0.1.0.tgz is @formancy/report-spec@0.1.0, not at the release version 0.2.0'])
  })

  // A package under the @formancy scope with no terms inside, or declaring
  // Apache-2.0, would be read as the scope's open-source packages are.
  test('refuses a tarball that declares other terms, or leaves the licence files out', () => {
    expect(tarballProblems(tarball({ ...SPEC, license: 'Apache-2.0' }), '0.1.0')).toEqual([`release-tarballs/formancy-report-spec-0.1.0.tgz declares the licence Apache-2.0, not "${LICENSE_FIELD}"`])
    expect(tarballProblems(tarball(SPEC, { without: ['LICENSE.md', 'NOTICE'] }), '0.1.0')).toEqual([
      'release-tarballs/formancy-report-spec-0.1.0.tgz carries no LICENSE.md',
      'release-tarballs/formancy-report-spec-0.1.0.tgz carries no NOTICE',
    ])
  })
})

describe('pinProblems', () => {
  const files = [tarball(), { path: 'formancy-report-v0.1.0-sbom.cdx.json', bytes: Buffer.from('{"bomFormat":"CycloneDX"}') }]

  // A pin is the file's name and the sha256 of its bytes, and the same files
  // pinned and downloaded agree.
  test('accepts exactly the files that were pinned', () => {
    const pinned = pinsOf(files)
    expect(pinned['formancy-report-spec-0.1.0.tgz']).toBe(sha256(files[0].bytes))
    expect(pinProblems(JSON.stringify(pinned), files)).toEqual([])
  })

  // Swapped bytes under the pinned name, a file nobody pinned, and a pinned
  // file that did not arrive: each would publish or sign something `check`
  // never saw, or publish less than it passed.
  test('refuses changed bytes, an unpinned file and a missing one', () => {
    const pinned = JSON.stringify(pinsOf(files))
    const swapped = [{ ...files[0], bytes: packageTarball({ ...SPEC, description: 'other' }) }, files[1]]
    expect(pinProblems(pinned, swapped)).toEqual(['formancy-report-spec-0.1.0.tgz is not the file the check job checked'])
    expect(pinProblems(pinned, [...files, { path: 'release-tarballs/extra-0.1.0.tgz', bytes: Buffer.from('x') }])).toEqual(['extra-0.1.0.tgz was not checked by the check job'])
    expect(pinProblems(pinned, [files[1]])).toEqual(['formancy-report-spec-0.1.0.tgz was checked but did not arrive'])
  })

  // An output that never arrived is '', and must not read as "nothing to check".
  test('refuses when the check job pinned nothing', () => {
    expect(pinProblems('', files)).toEqual(['the check job pinned no file'])
    expect(pinProblems('{}', files)).toEqual(['the check job pinned no file'])
  })
})

describe('sbomProblems', () => {
  // A file that is not a CycloneDX document would be signed and attached to
  // the release as its bill of materials.
  test('accepts a CycloneDX document and refuses anything else', () => {
    expect(sbomProblems(Buffer.from('{"bomFormat":"CycloneDX","components":[]}'))).toEqual([])
    expect(sbomProblems(Buffer.from('{"bomFormat":"SPDX"}'))).toEqual(['the SBOM is not a CycloneDX document'])
    expect(sbomProblems(Buffer.from('not json'))).toEqual(['the SBOM is not JSON'])
  })
})
