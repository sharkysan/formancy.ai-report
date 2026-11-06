import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, test } from 'vitest'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * Every module `file` imports, as TypeScript's own pre-processor finds
 * them -- static, dynamic and require(), so one inside a comment is none --
 * and the same of every file it imports by a relative path, followed into:
 * each said as the importer's path from the repository and the specifier.
 */
function importsFrom(file, seen = new Set()) {
  if (seen.has(file)) return []
  seen.add(file)
  return ts
    .preProcessFile(readFileSync(file, 'utf8'), true, true)
    .importedFiles.flatMap(({ fileName: specifier }) => [
      `${relative(repo, file).replaceAll('\\', '/')}: ${specifier}`,
      ...(/^\.\.?\//.test(specifier) ? importsFrom(join(dirname(file), specifier), seen) : []),
    ])
}

// gate-measure.mjs is a module of its own so that a gate measures a page with nothing built but
// the page: one import of a @formancy package, in it or in anything it imports, and the pages' gate
// would stop at that import in a job that built only the pages, or wait on the corpus and PDF.js.
// The pages' gate is walked too, since it is what has to start with nothing else built.
test.each([
  ['the page reads the Studio shares', 'apps/studio/scripts/gate-measure.mjs'],
  ["the pages' browser gate", 'apps/pages/scripts/browser-test.mjs'],
])('%s, followed through everything it imports, imports no @formancy package', (_, entry) => {
  const imports = importsFrom(join(repo, entry))
  // A walk that read no import would find no @formancy package in it either.
  expect(imports.length).toBeGreaterThan(0)
  expect(imports.filter((imported) => imported.includes(': @formancy/'))).toEqual([])
})
