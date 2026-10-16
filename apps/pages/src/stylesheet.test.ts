import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { inputs, repo } from './test-site.js'

/**
 * The pages wear formancy.ai's room as the Studio wears it, by importing
 * the Studio's stylesheets (0021; CLAUDE.md, "The same room"): the admin's
 * palette keeps the one hand copy it has, the Studio's room.css, which
 * scripts/palette.test.mjs holds to admin.css. A colour the pages typed
 * themselves would be a second room, and nothing would hold it to the
 * first. Read as text, the declarations of pages.css's own rules, after its
 * imports; a colour keyword is recognised as the DOM recognises one.
 */
const file = join(dirname(fileURLToPath(import.meta.url)), 'pages.css')
const text = readFileSync(file, 'utf8').replaceAll('\r\n', '\n').replaceAll(/\/\*[\s\S]*?\*\//g, '')

/**
 * Every `@import` of pages.css, as a path from the repository's root: in
 * either quote, as the build inlines both (scripts/inputs.mjs), and one by
 * `url()` as it is written, which no path below matches. Read by one quote
 * alone, a palette copied into apps/pages and imported in the other passed.
 */
const imports = [...text.matchAll(/@import\s+([^;]*);/g)].map((match) => {
  const path = /^(['"])([^'"]+)\1$/.exec((match[1] ?? '').trim())?.[2]
  return path === undefined ? match[0] : relative(repo, join(dirname(file), path)).replaceAll('\\', '/')
})

/** Every declaration of `css`: its property and its value. */
const declarations = (css: string): [string, string][] => [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map((match) => [match[1] ?? '', (match[2] ?? '').trim()])

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
  // The room arrives by import, first, from the Studio's own files: an
  // import of a file outside the Studio's styles, or none, is a room of the
  // pages' own.
  test("imports the Studio's room first, and only the Studio's stylesheets", () => {
    expect(imports[0]).toBe('apps/studio/src/styles/room.css')
    for (const path of imports) expect(path).toMatch(/^apps\/studio\/src\/styles\/[\w-]+\.css$/)
  })

  // A guard on the guard: the detector finds each way a colour is typed,
  // and passes what reads the room's variables.
  test('knows a typed colour from one read from the room', () => {
    for (const typed of ['#fff', '#080a12', 'rgb(255 255 255 / 4%)', 'hsl(250 100% 70%)', 'white', 'rebeccapurple', '1px solid black']) expect({ typed, found: coloursIn(typed).length > 0 }).toEqual({ typed, found: true })
    for (const read of ['var(--client)', 'color-mix(in srgb, var(--client) 70%, var(--text))', '1px solid var(--edge-strong)', 'transparent', 'inherit', 'auto', '0.5rem 1.25rem', "'/'"]) expect({ read, found: coloursIn(read) }).toEqual({ read, found: [] })
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

  // What the page links is the bundle, with the room inlined: the Studio's
  // variables and its bar's rules are in it, and no @import is left for a
  // browser to fetch under /report/.
  test('is linked as one file, with the Studio’s room and bar in it', () => {
    expect(inputs.stylesheet).toMatch(/:root \{[^}]*--client: #8b7bff;/)
    expect(inputs.stylesheet).toContain('.studio-bar')
    expect(inputs.stylesheet).not.toContain('@import')
  })
})
