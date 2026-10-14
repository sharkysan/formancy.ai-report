import { describe, expect, test } from 'vitest'
import { LICENSE_FIELD } from '../verify-licenses.mjs'
import { pinsOf } from './pins.mjs'
import { decide, integrityOf, publishOrder, toPublish } from './publish.mjs'
import { packageTarball } from './test-archive.mjs'

/**
 * What the publish job decides before it calls npm, as in formancy.ai-data
 * (its 0035): the order the tarballs go in, from their own manifests, and
 * what a version already on the registry means. Pure; the call to npm is the
 * publish job's, which has never run, and RELEASING.md says so.
 */
const manifest = (name, dependencies = {}) => ({ name, manifest: { name, version: '0.1.0', dependencies } })
const PACKAGES = [
  manifest('@formancy/report-server', { '@formancy/report-core': '0.1.0', '@formancy/report-render-pdf': '0.1.0' }),
  manifest('@formancy/report-render-pdf', { '@formancy/report-core': '0.1.0', pdfmake: '^0.3.0' }),
  manifest('@formancy/report-core', { '@formancy/report-spec': '0.1.0' }),
  manifest('@formancy/report-spec', { '@formancy/spec': '0.5.0' }),
]

describe('publishOrder', () => {
  // A package published before what it depends on is, for as long as the
  // gap lasts, a version npm serves that nobody can install.
  test('puts each package after the ones it depends on: report-spec first, report-server last', () => {
    const order = publishOrder(PACKAGES)
    expect(order[0]).toBe('@formancy/report-spec')
    expect(order.at(-1)).toBe('@formancy/report-server')
    for (const { name, manifest: declared } of PACKAGES) {
      for (const dependency of Object.keys(declared.dependencies).filter((entry) => order.includes(entry))) {
        expect(order.indexOf(dependency), `${dependency} before ${name}`).toBeLessThan(order.indexOf(name))
      }
    }
  })

  // A cycle has no order to publish in.
  test('refuses a cycle', () => {
    expect(() => publishOrder([manifest('a', { b: '1' }), manifest('b', { a: '1' })])).toThrow(/cycle: a, b/)
  })
})

describe('decide', () => {
  const bytes = Buffer.from('a tarball')
  const tarball = { name: '@formancy/report-spec', version: '0.1.0', integrity: integrityOf(bytes) }

  // A re-run of the publish job finds what the first run published; the
  // same bytes are skipped, so the run can go on to the GitHub release.
  test('publishes a version npm does not have, and skips one it holds with these bytes', () => {
    expect(decide(tarball, undefined)).toBe('publish')
    expect(decide(tarball, tarball.integrity)).toBe('skip')
  })

  // A version is published once. Skipping on the version alone would call a
  // release done whose npm bytes are not the ones the gates ran.
  test('refuses a version npm holds with other bytes', () => {
    expect(() => decide(tarball, integrityOf(Buffer.from('other bytes')))).toThrow(/@formancy\/report-spec@0\.1\.0 is on npm as sha512-.+, not as this tarball's sha512-/)
  })

  // The integrity the registry records is `sha512-` and the base64 digest of
  // the tarball's bytes; a hex digest, or another hash, would never equal
  // npm's, and a re-run would refuse every version the first run published.
  test('computes the integrity in the form npm records', () => {
    expect(integrityOf(Buffer.alloc(0))).toBe('sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==')
  })
})

describe('toPublish', () => {
  /** Two tarballs, and what `check` pinned of both. */
  function release() {
    const files = [
      { path: 'release-tarballs/formancy-report-core-0.1.0.tgz', bytes: packageTarball({ name: '@formancy/report-core', version: '0.1.0', license: LICENSE_FIELD, dependencies: { '@formancy/report-spec': '0.1.0' } }) },
      { path: 'release-tarballs/formancy-report-spec-0.1.0.tgz', bytes: packageTarball({ name: '@formancy/report-spec', version: '0.1.0', license: LICENSE_FIELD }) },
    ]
    return { files, checked: JSON.stringify(pinsOf(files)) }
  }

  // What reaches npm is in dependency order, and is what was checked.
  test('gives the checked tarballs in the order they publish in', () => {
    expect(toPublish(release()).map((entry) => `${entry.name}@${entry.version}`)).toEqual(['@formancy/report-spec@0.1.0', '@formancy/report-core@0.1.0'])
  })

  // The npm step reads NPM_TOKEN; it refuses on its own account, before the
  // first `npm publish`, a tarball check did not pin, so a step added before
  // it cannot hand it something else.
  test('refuses a tarball the check job did not check, and an empty pin', () => {
    const swapped = release()
    swapped.files[1] = { ...swapped.files[1], bytes: packageTarball({ name: '@formancy/report-spec', version: '0.1.0', license: LICENSE_FIELD, description: 'other' }) }
    expect(() => toPublish(swapped)).toThrow(/formancy-report-spec-0\.1\.0\.tgz is not the file the check job checked/)
    expect(() => toPublish({ ...release(), checked: '' })).toThrow(/the check job pinned no file/)
  })
})
