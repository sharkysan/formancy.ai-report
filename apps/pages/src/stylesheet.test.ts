import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { inputs, repo } from './test-site.js'

/**
 * The pages wear formancy.ai's room as the Studio wears it (0021, 0034;
 * CLAUDE.md, "The same room"): the palette by importing the released
 * @formancy/themes/room.css, from the pages' own dependency, and the rest
 * by importing the Studio's stylesheets. A colour the pages typed
 * themselves would be a second room, and nothing would hold it to the
 * first; scripts/palette.test.mjs holds every stylesheet here to setting
 * none of the room's variables. Read as text, the declarations of
 * pages.css's own rules, after its imports; a colour keyword is recognised
 * as the DOM recognises one.
 */
const file = join(dirname(fileURLToPath(import.meta.url)), 'pages.css')
const text = readFileSync(file, 'utf8')
  .replaceAll('\r\n', '\n')
  .replaceAll(/\/\*[\s\S]*?\*\//g, '')

/**
 * Every `@import` of pages.css: a file beside it as a path from the
 * repository's root and a package's stylesheet by its specifier, in either
 * quote, as the build inlines both (scripts/inputs.mjs), and one by `url()`
 * as it is written, which nothing below matches. Read by one quote alone, a
 * palette copied into apps/pages and imported in the other passed.
 */
const imports = [...text.matchAll(/@import\s+([^;]*);/g)].map((match) => {
  const path = /^(['"])([^'"]+)\1$/.exec((match[1] ?? '').trim())?.[2]
  if (path === undefined) return match[0]
  return /^\.\.?\//.test(path) ? relative(repo, join(dirname(file), path)).replaceAll('\\', '/') : path
})

/** The released room, as the pages' own manifest resolves it, as the build does. */
const RELEASED_ROOM = '@formancy/themes/room.css'
const room = readFileSync(createRequire(join(dirname(file), '..', 'package.json')).resolve(RELEASED_ROOM), 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '')

/** Each declaration of the released room's :root, as the release writes it. */
const roomDeclarations = [...(/:root\s*\{([^}]*)\}/.exec(room)?.[1] ?? '').matchAll(/(--[\w-]+\s*:[^;]+;)/g)].map((match) => match[1] ?? '')

/** Every declaration of `css`: its property and its value. */
const declarations = (css: string): [string, string][] =>
  [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map((match) => [match[1] ?? '', (match[2] ?? '').trim()])

/** Whether the DOM takes `word` as a colour: a named one, not a keyword every property takes. */
function namesColour(word: string): boolean {
  if (/^(?:transparent|currentcolor|inherit|initial|unset|revert|none)$/i.test(word)) return false
  const probe = document.createElement('i')
  probe.style.color = word
  return probe.style.color !== ''
}

/** The colours `value` states itself, past the room's variables it reads. */
function coloursIn(value: string): string[] {
  const own = value.replaceAll(/var\(--[\w-]+\)/g, '')
  return [...(own.match(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi) ?? []), ...(own.match(/[a-z]+/gi) ?? []).filter(namesColour)]
}

describe("the pages' stylesheet (0021)", () => {
  // The room arrives by import, first: formancy's released palette, then
  // the Studio's room, which reads it, then the Studio's other files. An
  // import of any other file, or none, is a room of the pages' own.
  test("imports formancy's room first, then the Studio's, and only the Studio's stylesheets besides", () => {
    expect(imports.slice(0, 2)).toEqual([RELEASED_ROOM, 'apps/studio/src/styles/room.css'])
    for (const path of imports.slice(1)) expect(path).toMatch(/^apps\/studio\/src\/styles\/[\w-]+\.css$/)
  })

  // A guard on the guard: the detector finds each way a colour is typed,
  // and passes what reads the room's variables.
  test('knows a typed colour from one read from the room', () => {
    for (const typed of ['#fff', '#080a12', 'rgb(255 255 255 / 4%)', 'hsl(250 100% 70%)', 'white', 'rebeccapurple', '1px solid black'])
      expect({ typed, found: coloursIn(typed).length > 0 }).toEqual({ typed, found: true })
    for (const read of [
      'var(--client)',
      'color-mix(in srgb, var(--client) 70%, var(--text))',
      '1px solid var(--edge-strong)',
      'transparent',
      'inherit',
      'auto',
      '0.5rem 1.25rem',
      "'/'",
    ])
      expect({ read, found: coloursIn(read) }).toEqual({ read, found: [] })
  })

  // The failure this prevents is a second room: a colour typed here, or a
  // variable of the palette set again, that admin.css and the Studio move
  // without.
  test('declares no colour and no variable of its own', () => {
    const own = text.replaceAll(/^@import[^\n]*\n/gm, '')
    const found = declarations(own).filter(([property, value]) => property.startsWith('--') || coloursIn(value).length > 0)
    expect(declarations(own).length).toBeGreaterThan(50)
    expect(found).toEqual([])
  })

  // What the page links is the bundle, with the room inlined: every
  // declaration of the released room's :root as the release writes it, and
  // the Studio's bar's rules, are in it, and no @import is left for a
  // browser to fetch under /report/.
  test('is linked as one file, with formancy’s room and the Studio’s bar in it', () => {
    expect(roomDeclarations.length).toBeGreaterThan(10)
    expect(roomDeclarations.filter((declaration) => !inputs.stylesheet.includes(declaration))).toEqual([])
    expect(inputs.stylesheet).toContain('.studio-bar')
    expect(inputs.stylesheet).not.toContain('@import')
  })
})
