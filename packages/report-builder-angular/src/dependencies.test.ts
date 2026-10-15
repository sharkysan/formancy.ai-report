/**
 * What editing a report in Angular brings into an application: this
 * package's dependencies and peers, everything they bring in turn, and
 * nothing of React (plan 21: "Angular dependency closure must not contain
 * React merely to edit a report").
 *
 * Read from the manifest, the installed tree and the source the published
 * entry reaches. The built code is read by scripts/finalize-angular-dist.test.mjs,
 * which runs where the build has run.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const packageDir = join(here, '..')

interface Manifest {
  readonly name: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>
}

const read = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest

/** What an application installs with a package: its dependencies, and the peers it may not do without. */
function needs(manifest: Manifest): string[] {
  const peers = Object.keys(manifest.peerDependencies ?? {}).filter((name) => manifest.peerDependenciesMeta?.[name]?.optional !== true)
  return [...Object.keys(manifest.dependencies ?? {}), ...peers]
}

/** Where `name` resolves from `dir`, as Node resolves a bare name: up through each node_modules. */
function locate(name: string, dir: string): string | undefined {
  for (let at = dir; ; at = dirname(at)) {
    const candidate = join(at, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    if (dirname(at) === at) return undefined
  }
}

/** Every package an application gets with this one, by name. */
function closure(): Set<string> {
  const seen = new Set<string>()
  const visit = (dir: string): void => {
    for (const name of needs(read(dir))) {
      if (seen.has(name)) continue
      const found = locate(name, dir)
      if (found === undefined) throw new Error(`${name}, needed by ${read(dir).name}, is not installed`)
      seen.add(name)
      visit(found)
    }
  }
  visit(packageDir)
  return seen
}

/** Every module the files the published entry reaches import, by the name they import it by. */
function imported(): Set<string> {
  const names = new Set<string>()
  const files = new Set<string>()
  const visit = (file: string): void => {
    if (files.has(file)) return
    files.add(file)
    const code = readFileSync(file, 'utf8')
    // `import 'x'`, or an import or export `from 'x'`: never a quoted string in a type `export type` declares.
    for (const match of code.matchAll(/(?:^|\n)\s*(?:import|export)\s(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g)) {
      const specifier = match[1] as string
      if (specifier.startsWith('.')) visit(join(dirname(file), `${specifier}.ts`))
      else names.add(specifier)
    }
  }
  visit(join(here, 'index.ts'))
  return names
}

const packageOf = (specifier: string): string => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')
const REACT = /^(react|react-dom|@formancy\/report-builder-react)$/

describe('what the Angular builder brings into an application', () => {
  // Plan 21. React in an Angular application only to edit a report is a
  // second framework downloaded, and two bindings drifting in one bundle.
  test('has no React in it, all the way down', () => {
    const all = closure()
    expect(all).toContain('@angular/core')
    expect(all).toContain('@formancy/report-builder-core')
    for (const name of all) expect(name, name).not.toMatch(REACT)
  })

  // The walk above covers what the manifest declares. Code that imported
  // a package the manifest left out would bring in what the walk never
  // saw -- and fail in the application, which has not installed it.
  test('declares every package its published code imports', () => {
    const declared = needs(read(packageDir))
    const names = [...imported()]
    expect(names).toContain('@angular/core')
    for (const specifier of names) expect(declared, specifier).toContain(packageOf(specifier))
  })

  // The guard on the guard: the walk resolves through pnpm's links, and one
  // that resolved nothing would find no React by finding nothing.
  test('is read from the installed tree', () => {
    expect(closure().size).toBeGreaterThan(needs(read(packageDir)).length)
  })
})
