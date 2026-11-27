import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

/**
 * What each module of the package may reach, as an allowlist (0088).
 *
 * CLAUDE.md: nothing in a package reads configuration, the composition
 * root reads it once, and nothing in a package reaches the network. The
 * SDK's closure installs Express, Hono, an HTTP client and a process
 * spawner beside this package, so a list of what is refused would pass the
 * next import of any of them; each module is held instead to the
 * specifiers it may import, and a module with no list fails. Besides:
 *
 * - `process` is main.ts's alone, the composition root and the bin;
 * - `createRequire` is server.ts's alone, called once, for the package's
 *   own manifest, `../package.json`, and a function it makes is never kept
 *   to load anything else;
 * - `console` is no module's: standard output is the protocol's, and a
 *   line written there corrupts the stream a client reads;
 * - `fetch`, `WebSocket`, `XMLHttpRequest` and `EventSource` are no
 *   module's, main.ts's among them.
 *
 * Read from the sources with TypeScript's parser, as report-server's
 * composition test reads its own, so an import is found however it is
 * spelt -- static, re-exported, dynamic or required -- and a comment or a
 * sentence that names one is not one.
 */
const here = dirname(fileURLToPath(import.meta.url))
const modules = readdirSync(here)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .toSorted()

/** The specifiers each module may import, and nothing else. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  'index.ts': ['./tools.js', './server.js'],
  'main.ts': ['@modelcontextprotocol/sdk/server/stdio.js', './server.js'],
  'server.ts': ['node:module', '@modelcontextprotocol/sdk/server/mcp.js', '@modelcontextprotocol/sdk/types.js', '@formancy/report-core', 'zod', './tools.js'],
  'tools.ts': ['@formancy/report-core', '@formancy/report-spec'],
}

/** The one module that may touch the process, and the one that may make a `require`, with the one argument it may give it. */
const PROCESS = 'main.ts'
const REQUIRER = 'server.ts'
const MANIFEST = '../package.json'
const NETWORK = ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource']

/** Whether `node` is a string literal with `text`. */
const literal = (node: ts.Node | undefined, text?: string): boolean =>
  node !== undefined && ts.isStringLiteralLike(node) && (text === undefined || node.text === text)

/** Whether `node`, an identifier, is a name an import or an export declares rather than a use of it. */
const declared = (node: ts.Identifier): boolean =>
  ts.isImportSpecifier(node.parent) || ts.isImportClause(node.parent) || ts.isNamespaceImport(node.parent) || ts.isExportSpecifier(node.parent)

/** Whether `node`, a `createRequire` identifier, is called and its result called at once with the manifest alone: `createRequire(…)('../package.json')`. */
function loadsTheManifest(node: ts.Identifier): boolean {
  const made = node.parent
  if (!ts.isCallExpression(made) || made.expression !== node) return false
  const loaded = made.parent
  return ts.isCallExpression(loaded) && loaded.expression === made && loaded.arguments.length === 1 && literal(loaded.arguments[0], MANIFEST)
}

/** What is wrong with module `name`, whose source is `source`, against the rules above, each said once. */
function problemsOf(name: string, source: string): string[] {
  const allowed = ALLOWED[name]
  const problems = new Set<string>(allowed === undefined ? [`${name} has no list of what it may import`] : [])
  const specifier = (node: ts.Node | undefined) => {
    if (node === undefined) return
    if (!ts.isStringLiteralLike(node)) problems.add(`${name} imports what is not a string it names`)
    else if (!(allowed ?? []).includes(node.text)) problems.add(`${name} imports ${node.text}`)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) specifier(node.moduleReference.expression)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      specifier(node.arguments[0])
    if (ts.isIdentifier(node) && !declared(node)) {
      if (node.text === 'process' && name !== PROCESS) problems.add(`${name} touches the process`)
      if (node.text === 'console') problems.add(`${name} writes to the console`)
      if (NETWORK.includes(node.text)) problems.add(`${name} reaches the network through ${node.text}`)
      if (node.text === 'createRequire' && (name !== REQUIRER || !loadsTheManifest(node)))
        problems.add(`${name} makes a require for something other than ${MANIFEST}`)
    }
    if (literal(node, 'process') && name !== PROCESS) problems.add(`${name} touches the process`)
    if (literal(node, 'console')) problems.add(`${name} writes to the console`)
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
  return [...problems]
}

const source = (name: string) => readFileSync(join(here, name), 'utf8')

describe('what each module may reach', () => {
  // A module the guard has no list for would reach anything; one listed
  // and gone would hold nothing.
  test('is listed for every module, and for none that is not there', () => {
    expect(modules).toEqual(Object.keys(ALLOWED).toSorted())
  })

  // Each module imports only what its list names, main.ts alone touches
  // the process, server.ts alone loads its manifest, and no module writes
  // to the console or reaches the network.
  test('holds every module to its list', () => {
    expect(Object.fromEntries(modules.map((name) => [name, problemsOf(name, source(name))]))).toEqual(Object.fromEntries(modules.map((name) => [name, []])))
  })

  // A guard on the guard: each way past it is found in the module it is
  // planted in, and what is no way past it is not.
  test('finds each way past it, however it is spelt', () => {
    const planted: readonly (readonly [string, string])[] = [
      ['server.ts', "import express from 'express'"],
      ['server.ts', "import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'"],
      ['main.ts', "import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'"],
      ['tools.ts', "import spawn from 'cross-spawn'"],
      ['tools.ts', "export { Hono } from 'hono'"],
      ['tools.ts', "const fs = await import('node:fs')"],
      ['tools.ts', "const fs = require('fs')"],
      ['tools.ts', "import { createRequire } from 'node:module'"],
      ['server.ts', "const fs = createRequire(import.meta.url)('node:fs')"],
      ['server.ts', "const load = createRequire(import.meta.url)\nconst manifest = load('../package.json')"],
      ['server.ts', "const env = createRequire(import.meta.url)('node:process').env"],
      ['tools.ts', "console.log('a line on the stream a client reads')"],
      ['main.ts', "globalThis['console'].error('x')"],
      ['tools.ts', "const at = process.env['FORMANCY_REPORT_URL']"],
      ['server.ts', "const value = globalThis['process'].env.X"],
      ['main.ts', 'await fetch(at)'],
      ['tools.ts', 'new WebSocket(at)'],
      ['report.ts', 'export const x = 1'],
    ]
    for (const [name, way] of planted) expect(problemsOf(name, way).length, `${name}: ${way}`).toBeGreaterThan(0)
    const harmless: readonly (readonly [string, string])[] = [
      ['server.ts', "import { createRequire } from 'node:module'\nconst version = createRequire(import.meta.url)('../package.json')"],
      ['main.ts', 'await server.connect(new StdioServerTransport(process.stdin, process.stdout))'],
      ['tools.ts', '// console.log and process.env are no module’s; fetch is the server half’s, through report-client'],
      ['tools.ts', "const said = 'the console, the process and a fetch are named in a sentence'"],
      ['tools.ts', "import { reportHash } from '@formancy/report-spec'"],
    ]
    for (const [name, text] of harmless) expect(problemsOf(name, text), `${name}: ${text}`).toEqual([])
  })
})
