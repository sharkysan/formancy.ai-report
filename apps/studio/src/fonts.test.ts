import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * The Studio's faces come from its own build (0023): its page names nothing
 * on another origin, so opening it tells no other site who opened it, and
 * the faces styles/fonts.css imports are the ones the room's stacks ask
 * for. Read from the source as the build reads it: index.html as a parser
 * reads a page, and each Fontsource stylesheet fonts.css imports from the
 * package this app resolves it to. The built page's requests, and that each
 * face loaded, are the browser gate's.
 */

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(app, 'package.json'))

/** What the families of each `@font-face` of `css` are, unquoted. */
const facesOf = (css: string): string[] => [...css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*['"]?([^;'"]+)['"]?\s*;/g)].map((match) => match[1] ?? '')

/** The stylesheets fonts.css imports, by the specifier it imports each with. */
const imported = [...readFileSync(join(app, 'src', 'styles', 'fonts.css'), 'utf8').matchAll(/^@import\s+'([^']+)';$/gm)].map((match) => match[1] ?? '')

/** The families of every face fonts.css imports. */
const declared = new Set(imported.flatMap((specifier) => facesOf(readFileSync(require.resolve(specifier), 'utf8'))))

/** Each font stack room.css's :root sets, by its variable: the families it names, in order. */
const stacks = Object.fromEntries(
  [...(/:root\s*\{([^}]*)\}/.exec(readFileSync(join(app, 'src', 'styles', 'room.css'), 'utf8'))?.[1] ?? '').matchAll(/(--display|--sans|--mono)\s*:\s*([^;]+);/g)].map((match) => [
    match[1] ?? '',
    (match[2] ?? '').split(',').map((family) => family.trim().replaceAll(/^['"]|['"]$/g, '')),
  ]),
)

describe("the Studio's faces (0023)", () => {
  // A stylesheet, a font or a preconnect on another origin is the visitor's
  // address handed to that origin before anything is drawn -- Google's, for
  // as long as the faces came from Google Fonts. The page's own files are
  // relative; the icon is said as data:, and nothing else may be absolute.
  test('index.html names no address on another origin', () => {
    const page = new DOMParser().parseFromString(readFileSync(join(app, 'index.html'), 'utf8'), 'text/html')
    const named = [...page.querySelectorAll('[href], [src]')].map((element) => element.getAttribute('href') ?? element.getAttribute('src') ?? '')
    // A guard on the guard: the icon and the script are read.
    expect(named).toEqual(expect.arrayContaining(['data:,', '/src/main.tsx']))
    const here = 'https://formancy.ai/report/'
    expect(named.filter((address) => !address.startsWith('data:') && new URL(address, here).origin !== new URL(here).origin)).toEqual([])
  })

  // A stack that names no face the build serves draws its text in the
  // system's fallback, which nothing would notice: a font request that
  // never happens fails no load. And a face served that no stack names is
  // bytes every deploy carries for nothing.
  test("are the ones the room's stacks name, each stack one of them", () => {
    expect(Object.keys(stacks).sort()).toEqual(['--display', '--mono', '--sans'])
    expect(imported.length).toBeGreaterThan(0)
    for (const [stack, families] of Object.entries(stacks)) expect({ stack, serves: families.filter((family) => declared.has(family)).length > 0 }).toEqual({ stack, serves: true })
    const named = new Set(Object.values(stacks).flat())
    expect([...declared].filter((family) => !named.has(family))).toEqual([])
  })
})
