// One hash for a package's built `dist/`, so a tarball can be compared with the
// dist/ a job built (formancy.ai-data 0035). The install gate records it for
// every tarball it packs, for the release report that arrives with packaging.
//
// sha256 over the sorted lines `relative/path\0<sha256 of the file>\n`, one
// per file: the same files with the same bytes give the same hash wherever
// they were built, whatever order a directory listing or an archive holds
// them in, and a renamed, added or changed file changes it.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** The hash of `files`: a Map, or pairs, of `/`-separated path relative to dist/ and its bytes. */
export function distHash(files) {
  const lines = [...files]
    .map(([path, bytes]) => [path.replaceAll('\\', '/'), sha256(bytes)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, digest]) => `${path}\0${digest}\n`)
  return `sha256:${sha256(lines.join(''))}`
}

/** Every file under `dir`, keyed by its `/`-separated path relative to it; undefined when there is no such directory. */
export function filesUnder(dir) {
  if (!existsSync(dir)) return undefined
  const files = new Map()
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) files.set(relative(dir, full).replaceAll('\\', '/'), readFileSync(full))
    }
  }
  walk(dir)
  return files
}

/** What every tarball carries beside its build, packed from dist/ or not. */
const BESIDE_THE_BUILD = new Set(['package/package.json', 'package/README.md', 'package/LICENSE.md', 'package/NOTICE'])

/**
 * The built files of a packed tarball, as `filesUnder` gives a directory's:
 * its `package/dist/`, or, for a package packed from its dist/ (an Angular
 * package, through `publishConfig.directory`), everything in `package/` but
 * the manifest, the README and the licence files.
 */
export function distOfTarball(entries) {
  const files = new Map()
  for (const [path, bytes] of entries) if (path.startsWith('package/dist/')) files.set(path.slice('package/dist/'.length), bytes)
  if (files.size > 0) return files
  for (const [path, bytes] of entries) if (path.startsWith('package/') && !BESIDE_THE_BUILD.has(path)) files.set(path.slice('package/'.length), bytes)
  return files
}
