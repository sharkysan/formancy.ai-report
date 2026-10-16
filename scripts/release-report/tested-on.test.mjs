import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { readmeTable, stale } from './readme.mjs'
import { published, testedOn, workspace } from './tested-on.mjs'

/**
 * What the checkout says it is tested with (0014; formancy.ai-data 0035),
 * held to the tree: the README's generated block to what is installed, and
 * testedOn() to every dependency and peer a published package declares.
 * Runs in `pnpm test:repo`, after `pnpm install`; nothing here needs a build.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const facts = testedOn(repo)

const local = new Set(workspace(repo).map(({ manifest }) => manifest.name))
/** Every entry of `field` a published package declares that is somebody else's, as the manifests say it. */
const declared = (field) =>
  published(repo).flatMap(({ manifest }) =>
    Object.entries(manifest[field] ?? {})
      .filter(([name, range]) => !local.has(name) && !String(range).startsWith('workspace:') && !name.startsWith('@formancy/'))
      .map(([name, range]) => ({ package: manifest.name, name, range })),
  )

describe('testedOn()', () => {
  // A runtime dependency added to a published package and missing here would
  // be published as a range the report never names beside a version.
  test('names every runtime dependency of every published package, with the package that declares it', () => {
    const named = facts.runtime.map(({ package: owner, name, range }) => ({ package: owner, name, range }))
    expect(named).toEqual(expect.arrayContaining(declared('dependencies')))
    expect(named).toHaveLength(declared('dependencies').length)
    expect(named.map((entry) => entry.name)).toContain('pdfmake')
  })

  // A builder's peers are what a host brings; one missing here would be a
  // framework the report never says which version of ran.
  test('names every peer of every published package, with the version its suites load', () => {
    const named = facts.peers.map(({ package: owner, name, range }) => ({ package: owner, name, range }))
    expect(named).toEqual(expect.arrayContaining(declared('peerDependencies')))
    expect(named).toHaveLength(declared('peerDependencies').length)
    expect(named.map((entry) => entry.name)).toEqual(expect.arrayContaining(['react', '@angular/core']))
  })

  // The upstream packages the workspace declares are depended on exactly
  // (0002), so the version loaded is the version declared.
  test('names the upstream packages, each loaded at the version declared', () => {
    const direct = facts.upstream.filter((entry) => entry.direct)
    expect(direct.map((entry) => entry.name)).toEqual(expect.arrayContaining(['@formancy/expressions', '@formancy/spec']))
    for (const entry of direct) expect(entry.version, entry.name).toBe(entry.declared)
  })

  // A lookup that found nothing would render an empty row that equals
  // itself, and the README test below would pass on a table of blanks.
  test('finds a version for every tool and every package it names', () => {
    const version = /^\d+\.\d+/
    expect(facts.tooling.map((tool) => tool.name)).toEqual(expect.arrayContaining(['typescript', 'pdfjs-dist']))
    for (const tool of facts.tooling) {
      expect(tool.versions.length, tool.name).toBeGreaterThan(0)
      for (const entry of tool.versions) expect(entry.version, tool.name).toMatch(version)
    }
    // TypeScript is declared `catalog:` at the root; the range is the catalog's.
    expect(facts.tooling.find((tool) => tool.name === 'typescript').declared).toMatch(/^~6\./)
    for (const entry of [...facts.runtime, ...facts.peers]) expect(entry.loaded, entry.name).toMatch(version)
    for (const entry of facts.upstream) expect(entry.version, entry.name).toMatch(version)
    expect(facts.node.ci.length).toBeGreaterThan(0)
    expect(facts.packageManager).toEqual({ name: 'pnpm', version: expect.stringMatching(version), declared: expect.stringMatching(/^pnpm@/) })
  })
})

describe('the README block', () => {
  // A dependency bumped without the README following would leave the README
  // naming a version nobody runs any more, which is the drift a generated
  // block exists to stop.
  test('says what testedOn() says', () => {
    expect(
      stale(facts, repo).map(({ file }) => file),
      'run node scripts/release-report/readme.mjs --write',
    ).toEqual([])
  })

  // Every row derived: a peer as declared and as its builder's suites load
  // it, and the sentence that sends a reader to the run's own report.
  test('names each peer with its builder, and says where a run’s versions are', () => {
    const table = readmeTable(facts)
    const react = facts.peers.find((entry) => entry.name === 'react')
    expect(table).toContain(`| \`react\`, a peer of \`${react.package}\` | ${react.loaded}, in its suites | \`${react.range}\` |`)
    expect(table).toContain('is in the release report every CI run produces and every release attaches, signed.')
  })
})
