import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, test } from 'vitest'
import { distHash, distOfPackage, distOfTarball, filesUnder } from './dist-hash.mjs'
import { readTarball } from './tarball.mjs'
import { header, tgz } from './test-archive.mjs'

/**
 * The built-in `.tgz` reader and the dist hash (formancy.ai-data 0035), over
 * an archive the tests write themselves (test-archive.mjs), so every field the reader
 * depends on is one the test set: a real packer's output is read by the
 * install gate in every run.
 */
let dirs = []
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

const LONG = `package/dist/${'nested/'.repeat(14)}module.mjs`

const FILES = [
  ['package/package.json', Buffer.from('{"name":"@formancy/report-spec"}')],
  ['package/dist/index.mjs', Buffer.from('export const a = 1\n')],
  [LONG, Buffer.from('export const deep = true\n'.repeat(40))],
]

describe('a packed tarball', () => {
  // npm's packer puts a path past a hundred bytes in the ustar prefix. A
  // reader that ignored it would see `module.mjs` where the archive holds
  // `package/dist/nested/.../module.mjs`: a dist with a file at its root
  // that no build made, and a hash that differs from every job's.
  test('reads every file, a name longer than a hundred bytes included', () => {
    expect(Buffer.byteLength(LONG)).toBeGreaterThan(100)
    const entries = readTarball(tgz(FILES))
    expect([...entries.keys()]).toEqual(FILES.map(([path]) => path))
    for (const [path, bytes] of FILES) expect(entries.get(path)?.equals(bytes), path).toBe(true)
  })

  // A release report compares the dist/ of the tarball npm receives with the
  // dist/ every job built on disk. The same files must hash alike from either.
  test('hashes its dist/ as the same files on disk hash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'formancy-report-dist-'))
    dirs.push(dir)
    for (const [path, bytes] of FILES.filter(([path]) => path.startsWith('package/dist/'))) {
      const file = join(dir, path.slice('package/dist/'.length))
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, bytes)
    }
    const fromTarball = distHash(distOfTarball(readTarball(tgz(FILES))))
    expect(fromTarball).toBe(distHash(filesUnder(dir)))
    // And a changed byte changes it, or the comparison proves nothing.
    writeFileSync(join(dir, 'index.mjs'), 'export const a = 2\n')
    expect(distHash(filesUnder(dir))).not.toBe(fromTarball)
  })

  // An Angular package packs from its dist/, so its tarball has no
  // package/dist/: its built files are at package/ itself. Read as an empty
  // dist, every Angular tarball would hash alike, whatever it held.
  test('reads the built files of a package packed from its dist/', () => {
    const packedFromDist = [
      ['package/package.json', Buffer.from('{"name":"@formancy/report-builder-angular"}')],
      ['package/LICENSE.md', Buffer.from('terms')],
      ['package/NOTICE', Buffer.from('notice')],
      ['package/README.md', Buffer.from('readme')],
      ['package/fesm2022/a.mjs', Buffer.from('export const a = 1\n')],
      ['package/types/a.d.ts', Buffer.from('export declare const a: 1\n')],
    ]
    expect([...distOfTarball(readTarball(tgz(packedFromDist))).keys()].sort()).toEqual(['fesm2022/a.mjs', 'types/a.d.ts'])
  })

  // The release report holds that tarball's built files to the dist/ every
  // job built. That dist/ holds the manifest finalize-angular-dist.mjs
  // writes, which pnpm rewrites again when it packs, and the licence files:
  // hashed whole on disk, it would never equal the tarball's.
  test('hashes a package packed from its dist/ alike from disk and from its tarball', () => {
    const dir = mkdtempSync(join(tmpdir(), 'formancy-report-dist-'))
    dirs.push(dir)
    const built = { 'fesm2022/a.mjs': 'export const a = 1\n', 'types/a.d.ts': 'export declare const a: 1\n' }
    for (const [path, text] of Object.entries({
      ...built,
      'package.json': '{"name":"x","version":"0.1.0"}',
      'LICENSE.md': 'terms',
      NOTICE: 'notice',
      'README.md': 'readme',
    })) {
      mkdirSync(dirname(join(dir, 'dist', path)), { recursive: true })
      writeFileSync(join(dir, 'dist', path), text)
    }
    const packed = tgz([
      ['package/package.json', Buffer.from('{"name":"x","version":"0.1.0","dependencies":{"y":"0.1.0"}}')],
      ...Object.entries(built).map(([path, text]) => [`package/${path}`, Buffer.from(text)]),
    ])
    const fromTarball = distHash(distOfTarball(readTarball(packed)))
    expect(distHash(distOfPackage(dir, { publishConfig: { directory: 'dist' } }))).toBe(fromTarball)
    // A package packed from its source directory keeps every file of dist/.
    expect([...distOfPackage(dir, {}).keys()]).toContain('package.json')
    expect(distOfPackage(join(dir, 'nowhere'), {})).toBeUndefined()
  })

  // A truncated or altered download whose header no longer adds up is not
  // read as an archive with fewer files.
  test('refuses a header that does not hold its checksum', () => {
    const archive = Buffer.concat([header('package/x', 0), Buffer.alloc(1024)])
    archive[0] = 'q'.charCodeAt(0)
    expect(() => readTarball(gzipSync(archive))).toThrow(/checksum/)
  })
})
