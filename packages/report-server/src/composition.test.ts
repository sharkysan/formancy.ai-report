import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

/**
 * CLAUDE.md: nothing in a package reads configuration; the composition root
 * reads it, once. Here that root is main.ts, and every other module is
 * handed what it needs -- the environment as a value, files through the
 * secret source main.ts gives. Read from the sources with TypeScript's own
 * parser, so a module that looked a setting up itself fails here rather
 * than in a review, however its import is spelt, and a comment or a
 * sentence that mentions a process is not a way in.
 */
const here = dirname(fileURLToPath(import.meta.url))
const modules = readdirSync(here).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))

/** The modules configuration is reached through: the process and the file system, with or without `node:`. */
const CONFIGURATION = /^(?:node:)?(?:process|fs|fs\/promises)$/

/**
 * Every way `source` reaches configuration: an import or re-export of one of
 * those modules, a dynamic import or `require` of one, and the `process`
 * global by its name or as `globalThis['process']`. An `io.readFile` main.ts
 * hands over is none of these.
 */
function waysIn(name: string, source: string): string[] {
  const found: string[] = []
  const specifier = (node: ts.Node | undefined) => {
    if (node !== undefined && ts.isStringLiteralLike(node) && CONFIGURATION.test(node.text)) found.push(`'${node.text}'`)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) specifier(node.moduleReference.expression)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) specifier(node.arguments[0])
    if (ts.isIdentifier(node) && node.text === 'process') found.push('process')
    if (ts.isStringLiteralLike(node) && node.text === 'process') found.push("'process'")
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
  return found
}

describe('the composition root', () => {
  // A walk that found no module, or no main.ts, would pass by reading nothing.
  test('is main.ts, among the modules', () => {
    expect(modules).toContain('main.ts')
    expect(modules.length).toBeGreaterThan(5)
  })

  // process.env, process.argv and the file system are configuration's ways
  // in; a module that reached one would read a setting nobody passed it. A
  // file read through the source main.ts hands over, `io.readFile`, is
  // main's read.
  test('is the only module that reads the environment, the arguments or a file', () => {
    const readers = modules.filter((name) => waysIn(name, readFileSync(join(here, name), 'utf8')).length > 0)
    expect(readers).toEqual(['main.ts'])
  })

  // A guard on the guard: each ordinary way in, which a regex over the text
  // let through -- `node:process`'s env, `fs` without its prefix -- is found,
  // and what is no way in is not.
  test('finds every ordinary way in, and nothing in a comment or a sentence', () => {
    const ways = [
      "import { env } from 'node:process'",
      "import { openSync } from 'fs'",
      "import { readFile } from 'node:fs/promises'",
      "export { readFileSync } from 'node:fs'",
      "const fs = await import('fs/promises')",
      "const fs = require('node:fs')",
      'import fs = require("fs")',
      'const { env } = process',
      'const value = globalThis.process.env.X',
      "const value = globalThis['process'].env.X",
    ]
    for (const way of ways) expect(waysIn('way.ts', way).length, way).toBeGreaterThan(0)
    const harmless = ['// process.env is read by main.ts alone', '/** Tested without starting a process. */', "const said = 'the process answers'", 'await io.readFile(path)', "import { isIP } from 'node:net'", "import { createHash } from 'node:crypto'"]
    for (const text of harmless) expect(waysIn('harmless.ts', text), text).toEqual([])
  })
})
