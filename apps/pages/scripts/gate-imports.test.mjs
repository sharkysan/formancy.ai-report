import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, test } from 'vitest'
import { workspaceManifests } from '../../../scripts/upstream-deps.mjs'

/**
 * What the pages' browser gate reaches, read from its modules' syntax: the
 * modules each imports -- static, dynamic and require(), as TypeScript's
 * own pre-processor finds them -- and the packages each resolves by name
 * without importing them: a string handed to `require.resolve`,
 * `import.meta.resolve`, or a function `createRequire` made, bound to any
 * name or called at once. A specifier inside a comment or a string is none.
 * Every file imported by a relative path is followed into.
 *
 * What it cannot see: a specifier computed at run time -- a variable, a
 * template with a substitution -- a require function handed on under
 * another binding, and a file of a package read by its path, as
 * readFileSync reads one. Nor a require function made other than as the
 * value a `const`, `let` or `var` declares, or called at once: one assigned
 * to a name declared before, `createRequire` imported under another name,
 * or called through its module, as `m.createRequire(...)`.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The workspace's packages and apps, by the names their own manifests give them: each needs its build before its exports name a file. */
const WORKSPACE = workspaceManifests(repo).map((manifest) => manifest.name)

/** Whether `specifier` names a package of the workspace, or a file of one. */
const ofTheWorkspace = (specifier) => WORKSPACE.some((name) => specifier === name || specifier.startsWith(`${name}/`))

/** The strings `file`'s text resolves by name, in its order. */
function resolvedBy(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const created = (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createRequire'
  const requires = new Set(['require'])
  const bind = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && created(node.initializer))
      requires.add(node.name.text)
    ts.forEachChild(node, bind)
  }
  bind(source)
  const isRequire = (node) => (ts.isIdentifier(node) && requires.has(node.text)) || created(node)
  const found = []
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const resolving =
        isRequire(callee) ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === 'resolve' && (isRequire(callee.expression) || ts.isMetaProperty(callee.expression)))
      const [first] = node.arguments
      if (resolving && first !== undefined && ts.isStringLiteralLike(first)) found.push(first.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** Every module `file` imports and every package it resolves, and the same of each file it imports by a relative path, each with its importer. */
function reachedFrom(file, seen = new Set()) {
  if (seen.has(file)) return []
  seen.add(file)
  const text = readFileSync(file, 'utf8')
  const from = relative(repo, file).replaceAll('\\', '/')
  const imports = ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) => fileName)
  return [
    ...imports.flatMap((specifier) => [
      { from, how: 'imports', specifier },
      ...(/^\.\.?\//.test(specifier) ? reachedFrom(join(dirname(file), specifier), seen) : []),
    ]),
    ...resolvedBy(file, text).map((specifier) => ({ from, how: 'resolves', specifier })),
  ]
}

// gate-measure.mjs is a module of its own so that a gate measures a page with nothing built but
// the page: one import of a @formancy package, or an import or a resolution of any package of the
// workspace, in it or in anything it imports, and the pages' gate would stop there in a job that
// built only the pages, or wait on the corpus and PDF.js. A released @formancy package needs no
// build, so resolving a file of one, as room.css is, is no reason to refuse.
// The pages' gate is walked too, since it is what has to start with nothing else built.
test.each([
  ['the page reads the Studio shares', 'apps/studio/scripts/gate-measure.mjs'],
  ["the pages' browser gate", 'apps/pages/scripts/browser-test.mjs'],
])('%s, followed through everything it imports, imports no @formancy package and resolves none of the workspace', (_, entry) => {
  const reached = reachedFrom(join(repo, entry))
  // A walk that read no import, or a reader that saw no resolution, would find nothing to refuse either.
  expect(reached.filter(({ how }) => how === 'imports').length).toBeGreaterThan(0)
  expect(reached.filter(({ how }) => how === 'resolves').map(({ specifier }) => specifier)).toContain('axe-core/axe.min.js')
  expect(WORKSPACE).toContain('@formancy/report-corpus')
  const refused = reached.filter(({ how, specifier }) => (how === 'imports' && specifier.startsWith('@formancy/')) || ofTheWorkspace(specifier))
  expect(refused.map(({ from, how, specifier }) => `${from} ${how} ${specifier}`)).toEqual([])
})
