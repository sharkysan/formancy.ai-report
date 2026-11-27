import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * `src/turn/` is held ready to move into formancy (0083): the day formancy
 * releases a turn other products may brief, the folder is deleted for an
 * import of it, which it can only be while it knows nothing of Report. So
 * its code imports formancy's spec, for `DECLINE_KEY`, and its own files,
 * and nothing else -- no `@formancy/report-*` package, and no module of
 * report-ai outside the folder, which is where Report's kinds stand
 * (`kinds.ts`): a kind typed as Report's list rather than a parameter comes
 * in through one of those imports. Read from the files, by what each
 * imports, never by a word in them.
 */
const TURN = dirname(fileURLToPath(import.meta.url))

/** Every module specifier a file imports or re-exports, statically or dynamically. */
function specifiersIn(text: string): string[] {
  const found = [
    ...text.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...text.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
    ...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
  ]
  return found.map((match) => match[1] ?? '')
}

/**
 * What a file of `src/turn/` may import: formancy's spec, a module of the
 * folder itself, at any depth, and, in a test, the tools a suite runs with.
 * `name` is the file's path inside the folder, so that a relative import is
 * resolved from where the file stands.
 */
function refused(specifier: string, name: string): boolean {
  if (specifier === '@formancy/spec') return false
  if (specifier.startsWith('.')) return relative(TURN, resolve(TURN, dirname(name), specifier)).split(sep)[0] === '..'
  if (name.endsWith('.test.ts') && (specifier === 'vitest' || specifier.startsWith('node:') || specifier === '@formancy/builder-core')) return false
  return true
}

/** Every TypeScript file of the folder, in its folders too, so that none escapes the guard by standing a level down. */
const files = readdirSync(TURN, { recursive: true })
  .map(String)
  .filter((name) => name.endsWith('.ts'))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(TURN, name), 'utf8') }))

describe("the turn knows nothing of Report's", () => {
  // A guard that read no file would pass while holding nothing.
  test('reads the turn and the relay, and every other file of the folder', () => {
    expect(files.map((file) => file.name)).toEqual(expect.arrayContaining(['ask.ts', 'relay.ts']))
  })

  // A shortcut through report-core, report-spec or report-ai's kinds would
  // make the folder Report's: it could no longer be deleted for formancy's
  // release, and the record's promise to move it would be broken silently.
  test("imports formancy's spec and its own modules alone", () => {
    const imports = files.flatMap(({ name, text }) =>
      specifiersIn(text)
        .filter((specifier) => refused(specifier, name))
        .map((specifier) => `${name} imports ${specifier}`),
    )
    expect(imports).toEqual([])
  })

  // The reading underneath the guard: an import of each shape it must see,
  // and a word that only looks like one, which it must not. Each keyword is
  // written with an escape, so that this file, which the guard reads too,
  // holds the shapes as data and imports none of them.
  test('finds every shape of import, and no word that only resembles one', () => {
    const text = [
      "\u0069mport { reportHash } from '@formancy/report-spec'",
      "\u0069mport type { RequestKind } from '../kinds.js'",
      "\u0065xport { REQUEST_KINDS } from '../kinds.js'",
      "\u0069mport '@formancy/report-core'",
      "const later = await \u0069mport('@formancy/report-runtime')",
      '// the briefing said: \u0069mport nothing from the report',
    ].join('\n')
    expect(specifiersIn(text)).toEqual(['@formancy/report-spec', '../kinds.js', '../kinds.js', '@formancy/report-core', '@formancy/report-runtime'])
    expect(specifiersIn(text).filter((specifier) => refused(specifier, 'ask.ts'))).toHaveLength(5)
    expect(['@formancy/spec', './ask.js'].filter((specifier) => refused(specifier, 'ask.ts'))).toEqual([])
  })

  // A file a level down is read, and its relative imports are resolved from
  // where it stands: one that reaches the folder's own module is kept, one
  // that climbs out of it to report-ai's kinds is refused, as from the top.
  test('resolves a relative import from where its file stands, at any depth', () => {
    expect(refused('../ask.js', join('deep', 'x.ts'))).toBe(false)
    expect(refused('./deep/x.js', 'ask.ts')).toBe(false)
    expect(refused('../../kinds.js', join('deep', 'x.ts'))).toBe(true)
    expect(refused('../kinds.js', 'ask.ts')).toBe(true)
    expect(refused('vitest', join('deep', 'x.test.ts'))).toBe(false)
    expect(refused('vitest', join('deep', 'x.ts'))).toBe(true)
  })
})
