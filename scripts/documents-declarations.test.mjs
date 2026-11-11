import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * report-documents promises that no type of its parser's or pako's leaves
 * the package (0054): a host, the renderer and the server are to meet the
 * reader's own model, never pdf-lib's, so that the parser can change
 * behind it. Its built declarations are what a host compiles against, and
 * they import nothing: the package depends on no workspace package, so a
 * module its declarations name is a dependency's, whose type a host would
 * meet. Read after the build, as CI's verify job runs this suite after
 * `pnpm build`; without a build it fails, and says so.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const DECLARATIONS = join(repo, 'packages/report-documents/dist/index.d.mts')

/**
 * The modules a declaration file names -- imported, exported from,
 * imported as a type, required, or referenced by a triple-slash directive
 * -- read from its code, its comments aside, so that a comment that says
 * "imports" is not taken for one.
 */
function modulesNamed(text) {
  const referenced = [...text.matchAll(/^\s*\/\/\/\s*<reference\s+(?:types|path)\s*=\s*["']([^"']+)["']/gm)].map((match) => match[1])
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const named = [
    ...code.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ...code.matchAll(/\bimport\s*["']([^"']+)["']/g),
    ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...code.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1])
  return [...referenced, ...named]
}

describe("report-documents' built declarations", () => {
  // A guard on the guard: a reading that missed one way of naming a module
  // would pass declarations that import pdf-lib's types.
  test('are read for every way a declaration file names a module, and for none a comment says', () => {
    const named = modulesNamed(
      [
        '/// <reference types="node" />',
        "import type { PDFDict } from '@pdfme/pdf-lib'",
        'export { Inflate } from "pako"',
        "import 'side-effect'",
        "type Stream = import('@pdfme/pdf-lib').PDFStream",
        "declare const x: typeof require('cjs')",
        '/** The reader imports nothing from "pdf-lib" here. */',
        "// export { y } from 'commented-out'",
        'export declare const MAX_DOCUMENT_BYTES: number;',
      ].join('\n'),
    )
    expect(named).toEqual(['node', '@pdfme/pdf-lib', 'pako', 'side-effect', '@pdfme/pdf-lib', 'cjs'])
  })

  // A type of pdf-lib's or pako's in them is one every host of the reader
  // compiles against, and the parser could no longer change behind the
  // model: the install gate type-checks a consumer against them, and would
  // pass, since both are the package's dependencies and installed with it.
  test('name no module', () => {
    expect(existsSync(DECLARATIONS), 'packages/report-documents/dist/index.d.mts is missing: run pnpm build first').toBe(true)
    const text = readFileSync(DECLARATIONS, 'utf8')
    // A guard on the guard: the file read is the package's declarations, not an empty one.
    expect(text).toMatch(/\bdeclare function readDocument\b/)
    expect(modulesNamed(text)).toEqual([])
  })
})
