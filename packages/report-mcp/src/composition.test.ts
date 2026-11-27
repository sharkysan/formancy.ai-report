import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

/**
 * CLAUDE.md: nothing in a package reads configuration; the composition
 * root reads it, once. Here that root is main.ts, the bin, and it is the
 * only module that touches the process -- its pipes, and later its
 * environment (0088). And nothing in a package reaches the network: no
 * module, main.ts among them, fetches, or opens a socket.
 *
 * Read from the sources with TypeScript's own parser, as report-server's
 * composition test reads its own, so a module that reached a way in fails
 * here however its import is spelt, and a comment or a sentence that
 * mentions one is not a way in. The manifest's version, which server.ts
 * loads as a module through `node:module`, is the package's own file and
 * no setting, and is no way in.
 */
const here = dirname(fileURLToPath(import.meta.url))
const modules = readdirSync(here).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))

/** The modules configuration is reached through: the process and the file system, with or without `node:`. */
const CONFIGURATION = /^(?:node:)?(?:process|fs|fs\/promises|child_process)$/
/** The modules the network is reached through. */
const NETWORK = /^(?:node:)?(?:http|https|http2|net|tls|dgram|dns)$/

/** Every specifier `source` imports, re-exports, `require`s or imports dynamically, and every identifier and string it names. */
function readsOf(name: string, source: string): { readonly specifiers: string[]; readonly names: string[] } {
  const specifiers: string[] = []
  const names: string[] = []
  const specifier = (node: ts.Node | undefined) => {
    if (node !== undefined && ts.isStringLiteralLike(node)) specifiers.push(node.text)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) specifier(node.moduleReference.expression)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      specifier(node.arguments[0])
    if (ts.isIdentifier(node)) names.push(node.text)
    if (ts.isStringLiteralLike(node)) names.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
  return { specifiers, names }
}

/** Every way `source` reaches configuration: one of those modules, or the `process` global by its name or as `globalThis['process']`. */
function configurationIn(name: string, source: string): string[] {
  const { specifiers, names } = readsOf(name, source)
  return [...specifiers.filter((text) => CONFIGURATION.test(text)).map((text) => `'${text}'`), ...names.filter((text) => text === 'process')]
}

/** Every way `source` reaches the network: one of those modules, or `fetch`, `WebSocket` or `XMLHttpRequest` by name. */
function networkIn(name: string, source: string): string[] {
  const { specifiers, names } = readsOf(name, source)
  return [...specifiers.filter((text) => NETWORK.test(text)), ...names.filter((text) => ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource'].includes(text))]
}

const source = (name: string) => readFileSync(join(here, name), 'utf8')

describe('the composition root', () => {
  // A walk that found no module, or no main.ts, would pass by reading nothing.
  test('is main.ts, among the modules', () => {
    expect(modules).toContain('main.ts')
    expect(modules.length).toBeGreaterThan(3)
  })

  // A module that reached the process or the file system would read a
  // setting nobody passed it, or stdout, which is the protocol's.
  test('is the only module that touches the process, the environment or a file', () => {
    expect(modules.filter((name) => configurationIn(name, source(name)).length > 0)).toEqual(['main.ts'])
  })

  // The tools need nothing but their arguments: a module that fetched, or
  // opened a socket, would send a report somewhere nobody configured.
  test('is, with every other module, no way to the network', () => {
    expect(modules.filter((name) => networkIn(name, source(name)).length > 0)).toEqual([])
  })

  // A guard on the guard: each ordinary way in is found, and what is no
  // way in -- a comment, a sentence, the manifest loaded as a module -- is not.
  test('finds every ordinary way in, and nothing in a comment or a sentence', () => {
    const ways = [
      "import { env } from 'node:process'",
      "import { readFileSync } from 'fs'",
      "export { readFile } from 'node:fs/promises'",
      "const fs = await import('fs')",
      "const fs = require('node:fs')",
      'import fs = require("fs")',
      'const { env } = process',
      "const value = globalThis['process'].env.X",
      "import { spawn } from 'node:child_process'",
    ]
    for (const way of ways) expect(configurationIn('way.ts', way).length, way).toBeGreaterThan(0)
    for (const way of ["import { request } from 'node:https'", "import net from 'net'", 'await fetch(at)', 'new WebSocket(at)'])
      expect(networkIn('way.ts', way).length, way).toBeGreaterThan(0)
    const harmless = [
      '// process.stdin is main.ts’s alone',
      "const said = 'the process answers'",
      "import { createRequire } from 'node:module'",
      "const fetched = 'a report is never fetched'",
    ]
    for (const text of harmless) expect([...configurationIn('harmless.ts', text), ...networkIn('harmless.ts', text)], text).toEqual([])
  })
})
