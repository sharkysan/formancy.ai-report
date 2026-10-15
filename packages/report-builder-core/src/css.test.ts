/**
 * report-builder.css, read as text: what it may colour with and what it may
 * select. The file dresses both builders, so it may target only what both
 * render -- the `data-report-part` hooks and their `data-*` states -- and
 * colour only through the workbench's `--wb-*` variables, so the Studio
 * recolours the editor by setting those and never by overriding a rule.
 */
import css from '../report-builder.css?raw'
import { describe, expect, test } from 'vitest'
import { REPORT_ATTRIBUTES, REPORT_PARTS, WORKBENCH_CLASSES } from './parts.js'

/**
 * The variables formancy.ai 0.5.0's `packages/themes/workbench.css` defines,
 * read from the file at that tag. Typed here because `@formancy/themes` is
 * not a dependency of this package; when the Studio brings it, this list is
 * read from the file instead.
 */
const WORKBENCH_VARIABLES = ['--wb-ink', '--wb-bench', '--wb-panel', '--wb-surface', '--wb-rule', '--wb-muted', '--wb-signal', '--wb-derived', '--wb-invalid', '--wb-ok', '--wb-caution', '--wb-sans', '--wb-mono']

/** CSS's named colours (CSS Color 4), which are colour literals as much as `#fff` is. */
const NAMED_COLOURS = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue
chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink
deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey
honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle
tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/)

/** The text without comments, which may name a colour in prose. */
function uncommented(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** The text with every `var(--x, fallback)` cut to `var(--x)`: a fallback may hold a literal, and is the one place one may stand. */
function withoutFallbacks(text: string): string {
  let out = ''
  let at = 0
  for (;;) {
    const start = text.indexOf('var(', at)
    if (start === -1) return out + text.slice(at)
    let depth = 0
    let comma = -1
    let end = start + 4
    for (; end < text.length; end += 1) {
      const char = text[end]
      if (char === '(') depth += 1
      else if (char === ')') {
        if (depth === 0) break
        depth -= 1
      } else if (char === ',' && depth === 0 && comma === -1) comma = end
    }
    out += text.slice(at, start) + (comma === -1 ? text.slice(start, end + 1) : `${text.slice(start, comma)})`)
    at = end + 1
  }
}

/** The colour literals in `text`: hex, colour functions and named colours. */
function colourLiterals(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(match[0])
  for (const match of text.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi)) found.push(match[0])
  // Only in declaration values: a selector or a property name is not a colour.
  for (const declaration of text.matchAll(/:\s*([^;{}]+);/g)) {
    for (const word of (declaration[1] ?? '').toLowerCase().matchAll(/[a-z]+/g)) if (NAMED_COLOURS.includes(word[0])) found.push(word[0])
  }
  return found
}

const RULES = uncommented(css)

describe('report-builder.css', () => {
  // vitest gives a test an empty string for a stylesheet it was not told to
  // process, and every check below would pass on nothing; this one fails
  // first (vitest.config.ts includes the file).
  test('is read as written, not as vitest’s empty stand-in', () => {
    expect(css.startsWith('/*')).toBe(true)
    expect(css).toContain("[data-report-part='canvas']")
  })

  // A colour typed into the editor's stylesheet is one the Studio cannot
  // recolour through the workbench's variables (CLAUDE.md: "not one rule
  // overridden for colour"), and one that is wrong on a dark bench.
  test('has no colour literal outside a var() fallback', () => {
    expect(colourLiterals(withoutFallbacks(RULES))).toEqual([])
  })

  // The guard itself: it finds each shape of literal it claims to find,
  // and lets a fallback through.
  test('the guard finds every shape of colour literal, and allows a fallback', () => {
    expect(colourLiterals(withoutFallbacks('a { color: #fff; background: rgb(0 0 0); border-color: rebeccapurple; }'))).toEqual(['#fff', 'rgb(', 'rebeccapurple'])
    expect(colourLiterals(withoutFallbacks('a { color: var(--wb-ink, #17222e); outline-color: var(--wb-signal, rgb(1 2 3)); }'))).toEqual([])
    expect(colourLiterals(withoutFallbacks('[data-report-part="red"] { color: var(--wb-ink); }'))).toEqual([])
  })

  // A variable the workbench does not define is a colour nobody sets: the
  // rule draws in the browser's default, on every theme.
  test('reads only the workbench’s variables', () => {
    const used = new Set([...RULES.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]))
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) expect(WORKBENCH_VARIABLES, name).toContain(name)
  })

  // A part the builders do not render is a rule that dresses nothing, and
  // usually a part renamed in one place only.
  test('styles only parts the builders render', () => {
    const styled = new Set([...RULES.matchAll(/data-report-part\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))
    expect(styled.size).toBeGreaterThan(0)
    for (const part of styled) expect(REPORT_PARTS, part).toContain(part)
  })

  // Every attribute it selects by is one the builders set; a framework's
  // own class -- React's or Angular's -- would dress one builder and not
  // the other.
  test('selects by the builders’ data attributes and the workbench’s shell classes only', () => {
    for (const match of RULES.matchAll(/\[\s*([\w-]+)/g)) expect(REPORT_ATTRIBUTES, match[1]).toContain(match[1])
    const classes = new Set([...RULES.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]))
    for (const name of classes) expect(Object.values(WORKBENCH_CLASSES), name).toContain(name)
  })

  // The source-size guard counts stylesheets; the editor's chrome is the
  // report-specific part only, and the workbench has the rest.
  test('stays under the source-size budget', () => {
    expect(css.split('\n').length).toBeLessThanOrEqual(600)
  })
})
