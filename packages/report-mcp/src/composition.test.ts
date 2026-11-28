import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
 * - `createRequire` is server.ts's alone, taken from `node:module` as
 *   `import { createRequire } from 'node:module'` and in no other way --
 *   not aliased, not re-exported, not by a namespace or a string -- and
 *   called once, for the package's own manifest, `../package.json`, a
 *   function it makes never kept to load anything else;
 * - `console` is no module's: standard output is the protocol's, and a
 *   line written there corrupts the stream a client reads;
 * - `fetch`, `WebSocket`, `XMLHttpRequest` and `EventSource` are no
 *   module's, main.ts's among them;
 * - render.ts reaches the renderer and pdf-text.ts only through
 *   `import()`, and a type, so that a session that never renders never
 *   loads them, nor the native canvas PDF.js requires (0089);
 * - pdf-text.ts calls PDF.js's `getDocument` by that name alone, with an
 *   object literal of `READ_OPTIONS` and nothing else: no address of a
 *   standard font, a CMap, a profile or a decoder, no URL, no worker
 *   fetch and no factory, which is what keeps pdfjs-dist's own fonts
 *   unread, as the licence guard's admission of them says (0089); and
 *   its verbosity `VerbosityLevel.ERRORS`, since at a louder one PDF.js
 *   writes an `Info:` line to standard output, the protocol's.
 *
 * Read from the sources with TypeScript's parser, as report-server's
 * composition test reads its own, so an import is found however it is
 * spelt -- static, re-exported, dynamic or required -- and a comment or a
 * sentence that names one is not one. What it does not read: a name built
 * as the module runs, as `globalThis['pro' + 'cess']`, and the base a
 * `createRequire` is given. It holds against an accident, not against a
 * module written to get past it.
 */
const here = dirname(fileURLToPath(import.meta.url))

/**
 * What the suites share, which no module's list names: a module that
 * imported it would fail its list, so the entry and the bin never reach it.
 */
const SUPPORT = 'test-support.ts'

/** The modules of `directory` and every directory in it, by their paths with `/` between their parts, on Windows too: every `.ts` file but a test. */
function modulesIn(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts') && path !== SUPPORT)
    .toSorted()
}
const modules = modulesIn(here)

/** The specifiers each module may import, and nothing else. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  'index.ts': ['./tools.js', './render.js', './server.js'],
  'main.ts': ['@modelcontextprotocol/sdk/server/stdio.js', './server.js'],
  'pdf-text.ts': ['@formancy/report-runtime', 'pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/types/src/display/api.js'],
  'render.ts': ['@formancy/report-runtime', '@formancy/report-spec', '@formancy/report-render-pdf', './pdf-text.js', './tools.js'],
  'server.ts': [
    'node:module',
    '@modelcontextprotocol/sdk/server/mcp.js',
    '@modelcontextprotocol/sdk/shared/stdio.js',
    '@modelcontextprotocol/sdk/types.js',
    '@formancy/report-core',
    '@formancy/report-runtime',
    'zod',
    './render.js',
    './tools.js',
  ],
  'tools.ts': ['@formancy/report-core', '@formancy/report-spec'],
}

/** The one module that may touch the process, and the one that may make a `require`, with the one argument it may give it. */
const PROCESS = 'main.ts'
const REQUIRER = 'server.ts'
const MANIFEST = '../package.json'
/** Where `createRequire` comes from, and the one name it may be taken by. */
const MODULE = 'node:module'
const REQUIRE = 'createRequire'
const NETWORK = ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource']
/** What a module may load only when it is first asked for, through `import()`, or name as a type. */
const LAZY: Readonly<Record<string, readonly string[]>> = { 'render.ts': ['@formancy/report-render-pdf', './pdf-text.js'] }
/** The module that reads a PDF, the one function it reads with, and the options it may give it: none that names where to fetch or read anything from. */
const READER = 'pdf-text.ts'
const OPEN = 'getDocument'
const READ_OPTIONS = ['data', 'disableFontFace', 'useSystemFonts', 'verbosity']
/** The one verbosity it may give: PDF.js's `info` writes to console.info, standard output in Node, which is the protocol's; at ERRORS it writes nothing. */
const QUIET = 'VerbosityLevel.ERRORS'

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

/**
 * Whether `declaration` takes `createRequire` from `node:module` the one
 * way allowed, `import { createRequire } from 'node:module'`: one named
 * value, by its own name. An alias, a namespace, a default or a type would
 * let a call by another name, or by a string, past the rule that holds
 * every call of it.
 */
function takesTheRequire(declaration: ts.ImportDeclaration): boolean {
  const clause = declaration.importClause
  const named = clause?.namedBindings
  if (clause === undefined || clause.isTypeOnly || clause.name !== undefined || named === undefined || !ts.isNamedImports(named)) return false
  const [only, ...more] = named.elements
  return more.length === 0 && only !== undefined && !only.isTypeOnly && only.propertyName === undefined && only.name.text === REQUIRE
}

/** Whether `declaration` imports or re-exports types alone: `import type`, or every name it takes marked `type`. */
function typesAlone(declaration: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  if (ts.isExportDeclaration(declaration)) return declaration.isTypeOnly
  const clause = declaration.importClause
  if (clause === undefined) return false
  if (clause.isTypeOnly) return true
  const named = clause.namedBindings
  return clause.name === undefined && named !== undefined && ts.isNamedImports(named) && named.elements.every((element) => element.isTypeOnly)
}

/** What is wrong with a call of `getDocument`, `call`: its one argument an object literal of `READ_OPTIONS` alone, each written out. */
function openedOtherwise(call: ts.CallExpression): string | undefined {
  const [options, ...more] = call.arguments
  if (options === undefined || more.length > 0 || !ts.isObjectLiteralExpression(options))
    return `calls ${OPEN} with what is not one object literal of its options`
  for (const property of options.properties) {
    if (!(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) || !ts.isIdentifier(property.name))
      return `calls ${OPEN} with an option it does not write out`
    if (!READ_OPTIONS.includes(property.name.text)) return `calls ${OPEN} with ${property.name.text}`
    if (property.name.text === 'verbosity' && !(ts.isPropertyAssignment(property) && property.initializer.getText() === QUIET))
      return `calls ${OPEN} with a verbosity other than ${QUIET}`
  }
  return undefined
}

/** What is wrong with module `name`, whose source is `source`, against the rules above, each said once. */
function problemsOf(name: string, source: string): string[] {
  const allowed = ALLOWED[name]
  const problems = new Set<string>(allowed === undefined ? [`${name} has no list of what it may import`] : [])
  const specifier = (node: ts.Node | undefined, declaration?: ts.ImportDeclaration) => {
    if (node === undefined) return
    if (!ts.isStringLiteralLike(node)) problems.add(`${name} imports what is not a string it names`)
    else if (!(allowed ?? []).includes(node.text)) problems.add(`${name} imports ${node.text}`)
    else if (node.text === MODULE && (declaration === undefined || !takesTheRequire(declaration)))
      problems.add(`${name} takes ${MODULE} otherwise than as import { ${REQUIRE} } from '${MODULE}'`)
  }
  /** A lazy module named anywhere but in `import()` or for types alone is loaded with `name`. */
  const eager = (node: ts.Node | undefined, declaration?: ts.ImportDeclaration | ts.ExportDeclaration) => {
    if (node !== undefined && ts.isStringLiteralLike(node) && (LAZY[name] ?? []).includes(node.text) && (declaration === undefined || !typesAlone(declaration)))
      problems.add(`${name} loads ${node.text} with itself, where it may load it only through import()`)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      specifier(node.moduleSpecifier, node)
      eager(node.moduleSpecifier, node)
    }
    if (ts.isExportDeclaration(node)) {
      specifier(node.moduleSpecifier)
      eager(node.moduleSpecifier, node)
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      specifier(node.moduleReference.expression)
      eager(node.moduleReference.expression)
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier(node.arguments[0])
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      specifier(node.arguments[0])
      eager(node.arguments[0])
    }
    if (name === READER && ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === OPEN && node.propertyName !== undefined)
      problems.add(`${name} takes ${OPEN} under another name`)
    if (name === READER && ts.isIdentifier(node) && node.text === OPEN && !declared(node)) {
      const call = node.parent
      const problem = ts.isCallExpression(call) && call.expression === node ? openedOtherwise(call) : `keeps ${OPEN} to call it elsewhere`
      if (problem !== undefined) problems.add(`${name} ${problem}`)
    }
    if (ts.isIdentifier(node) && !declared(node)) {
      if (node.text === 'process' && name !== PROCESS) problems.add(`${name} touches the process`)
      if (node.text === 'console') problems.add(`${name} writes to the console`)
      if (NETWORK.includes(node.text)) problems.add(`${name} reaches the network through ${node.text}`)
      if (node.text === REQUIRE && (name !== REQUIRER || !loadsTheManifest(node))) problems.add(`${name} makes a require for something other than ${MANIFEST}`)
    }
    if (literal(node, 'process') && name !== PROCESS) problems.add(`${name} touches the process`)
    if (literal(node, 'console')) problems.add(`${name} writes to the console`)
    if (literal(node, REQUIRE)) problems.add(`${name} names ${REQUIRE} by a string`)
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

  // A module in a directory of src/ would be held to nothing, though the
  // build compiles it: the walk reads every directory, and names a module
  // by its path, with `/` on Windows too, so that it fails the case above.
  test('reads every directory of src/, a module by its path in it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'report-mcp-modules-'))
    try {
      mkdirSync(join(directory, 'http'))
      for (const file of ['tools.ts', 'http/listen.ts', 'http/listen.test.ts', 'http/notes.md']) writeFileSync(join(directory, file), '')
      expect(modulesIn(directory)).toEqual(['http/listen.ts', 'tools.ts'])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  // A guard on the guard: each way past it is found in the module it is
  // planted in, and what is no way past it is not.
  test('finds each way past it, however it is spelt', () => {
    const planted: readonly (readonly [string, string])[] = [
      ['server.ts', "import { createRequire as load } from 'node:module'\nconst fs = load(import.meta.url)('node:fs')"],
      ['server.ts', "import * as module from 'node:module'\nconst fs = module['createRequire'](import.meta.url)('node:fs')"],
      ['server.ts', "import module from 'node:module'\nconst version = module.createRequire(import.meta.url)('../package.json')"],
      ['server.ts', "export { createRequire } from 'node:module'"],
      ['server.ts', "const { createRequire: load } = await import('node:module')\nconst fs = load(import.meta.url)('node:fs')"],
      ['server.ts', "import { type createRequire } from 'node:module'"],
      ['render.ts', "import { renderPdf } from '@formancy/report-render-pdf'"],
      ['render.ts', "export { pdfLines } from './pdf-text.js'"],
      ['render.ts', "import * as text from './pdf-text.js'"],
      ['pdf-text.ts', "const task = getDocument({ data, standardFontDataUrl: '/standard_fonts/' })"],
      ['pdf-text.ts', 'const task = getDocument({ ...options, data })'],
      ['pdf-text.ts', 'const task = getDocument(options)'],
      ['pdf-text.ts', "import { getDocument as open } from 'pdfjs-dist/legacy/build/pdf.mjs'"],
      ['pdf-text.ts', 'const read = getDocument'],
      ['pdf-text.ts', "const task = getDocument({ data, ['cMapUrl']: '/cmaps/' })"],
      ['pdf-text.ts', 'const task = getDocument({ data, verbosity: VerbosityLevel.INFOS })'],
      ['pdf-text.ts', 'const task = getDocument({ data, verbosity: 5 })'],
      ['pdf-text.ts', 'const task = getDocument({ data, verbosity })'],
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
    // Every way that gets past, named at once, rather than the first.
    expect(planted.filter(([name, way]) => problemsOf(name, way).length === 0).map(([name, way]) => `${name}: ${way}`)).toEqual([])
    const harmless: readonly (readonly [string, string])[] = [
      ['server.ts', "import { createRequire } from 'node:module'\nconst version = createRequire(import.meta.url)('../package.json')"],
      ['main.ts', 'await server.connect(new StdioServerTransport(process.stdin, process.stdout))'],
      ['tools.ts', '// console.log and process.env are no module’s; fetch is the server half’s, through report-client'],
      ['tools.ts', "const said = 'the console, the process and a fetch are named in a sentence'"],
      ['tools.ts', "import { reportHash } from '@formancy/report-spec'"],
      ['render.ts', "const engines = Promise.all([import('@formancy/report-render-pdf'), import('./pdf-text.js')])"],
      ['render.ts', "import type { CheckedLines } from './pdf-text.js'"],
      [
        'pdf-text.ts',
        'const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: VerbosityLevel.ERRORS })',
      ],
    ]
    for (const [name, text] of harmless) expect(problemsOf(name, text), `${name}: ${text}`).toEqual([])
  })
})
