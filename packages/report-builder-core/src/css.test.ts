/**
 * report-builder.css, read as text with its imports resolved: what it may
 * colour with and what it may select. The file dresses both builders, so it
 * may target only what both render -- the `data-report-part` hooks and
 * their `data-*` states -- and colour only through the workbench's `--wb-*`
 * variables, so the Studio recolours the editor by setting those and never
 * by overriding a rule.
 *
 * The entry a host imports holds its header, an `@import` of each part in
 * `styles/` and one rule of its own; the parts hold the rest, a file per
 * reason to change. Every check below reads the entry as a bundler builds
 * it, each import replaced by the part it names, so a rule cannot pass by
 * standing in a part the checks did not read.
 */
import entry from '../report-builder.css?raw'
import { describe, expect, test } from 'vitest'
import { REPORT_ATTRIBUTES, REPORT_PARTS, WORKBENCH_CLASSES } from './parts.js'

/**
 * The variables formancy.ai 0.5.0's `packages/themes/workbench.css` defines,
 * read from the file at that tag, and 0.7.0's, which the Studio pins: the
 * file did not change between the tags. Typed here because
 * `@formancy/themes` is not a dependency of this package.
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

/** The selectors of one rule's list, split at its own commas and not at those inside a pseudo-class's parentheses. */
function selectorsOf(list: string): string[] {
  const found: string[] = []
  let depth = 0
  let start = 0
  for (let at = 0; at < list.length; at += 1) {
    const char = list[at]
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (char === ',' && depth === 0) {
      found.push(list.slice(start, at).trim())
      start = at + 1
    }
  }
  return [...found, list.slice(start).trim()]
}

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

/**
 * The parts beside the entry, by their path from it: `./styles/editor.css`.
 * vitest reads each as written (vitest.config.ts includes them); one the
 * directory does not hold is one a host's bundler would not find either.
 */
const PARTS = new Map(Object.entries(import.meta.glob<string>('../styles/*.css', { query: '?raw', import: 'default', eager: true })).map(([path, text]) => [path.replace(/^\.\.\//, './'), text]))

/** The relative paths `text` imports, in order: `@import './styles/editor.css';`. Refuses an import of anything else. */
function importsOf(text: string): string[] {
  return [...uncommented(text).matchAll(/@import\s+([^;]*);/g)].map((match) => {
    const path = /^'(\.\/[^']+\.css)'$/.exec((match[1] ?? '').trim())?.[1]
    if (path === undefined) throw new Error(`an @import the entry may not have: ${match[0]}`)
    return path
  })
}

/** `text` with each of its imports replaced by the part it names: what a bundler builds, and what a host's page applies. */
function resolved(text: string): string {
  return text.replace(/@import\s+'(\.\/[^']+\.css)';/g, (_, path: string) => {
    const part = PARTS.get(path)
    if (part === undefined) throw new Error(`report-builder.css imports ${path}, which is not beside it`)
    return part
  })
}

const css = resolved(entry)
const RULES = uncommented(css)

describe('report-builder.css', () => {
  // vitest gives a test an empty string for a stylesheet it was not told to
  // process, and every check below would pass on nothing; this one fails
  // first (vitest.config.ts includes the file).
  test('is read as written, not as vitest’s empty stand-in', () => {
    expect(entry.startsWith('/*')).toBe(true)
    expect(PARTS.size).toBeGreaterThan(0)
    for (const [path, text] of PARTS) expect(text.startsWith('/*'), path).toBe(true)
    expect(css).toContain("[data-report-part='canvas']")
  })

  // A part the entry does not import dresses nothing, and is published for
  // nothing; one it imports twice cascades twice; and an import of
  // anything but a part beside it -- a package, a URL, a file further away
  // -- is one a host's bundler resolves its own way, or a browser fetches.
  // Each part is imported once, by its path beside the entry, and nothing
  // else is: the parts, in the order they cascade in, are the rules.
  test('imports every part in styles/ once, by its path beside the entry, and nothing else', () => {
    const imported = importsOf(entry)
    expect(imported.length).toBeGreaterThan(0)
    expect(new Set(imported).size).toBe(imported.length)
    expect([...imported].sort()).toEqual([...PARTS.keys()].sort())
    for (const [path, text] of PARTS) expect(importsOf(text), path).toEqual([])
    // A guard on the guard: an import it does not understand is refused, not skipped.
    expect(() => importsOf("@import url('x.css');")).toThrow(/may not have/)
    expect(() => resolved("@import './styles/nowhere.css';")).toThrow(/not beside it/)
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

  // The payment part's band is placed by the left, top, width and height
  // the state gives it, which only an absolutely positioned box obeys:
  // undressed, it would stand in the sheet's flow over the report header,
  // whatever its numbers said. It is drawn as a region's band is, by the
  // same rules -- placed, outlined, its label above it -- and tinted as an
  // empty one is: room nothing in the regions may take.
  test('dresses the payment part’s band by every rule that dresses a region’s', () => {
    const selectors = [...RULES.matchAll(/([^{}]+)\{/g)].map((match) => (match[1] ?? '').trim())
    const regions = selectors.filter((selector) => selector.includes("[data-report-part='region']"))
    expect(regions.length).toBeGreaterThanOrEqual(3)
    for (const selector of regions) expect(selector).toContain("[data-report-part='payment-part']")
  })

  // The band is what a pointer selects the bill by (0039), as a box is a
  // component's: selected, it is drawn as a selected box is, and the count
  // of its problems stands at its corner as a box's does. A band left out
  // of those rules would be selected with nothing on the sheet to say so,
  // and its badge would stand in the flow over the report header.
  test('dresses a selected payment part’s band, and its badge, by the rules that dress a selected box’s', () => {
    const selectors = [...RULES.matchAll(/([^{}]+)\{/g)].map((match) => (match[1] ?? '').trim())
    const selectedBoxes = selectors.filter((selector) => selector.includes("[data-report-part='box']") && selector.includes("[data-selected='true']"))
    const badges = selectors.filter((selector) => selector.includes("[data-report-part='box']") && selector.includes("> [data-report-part='badge']"))
    expect(selectedBoxes.length).toBeGreaterThanOrEqual(1)
    expect(badges.length).toBeGreaterThanOrEqual(1)
    for (const selector of [...selectedBoxes, ...badges]) expect(selector).toContain("[data-report-part='payment-part']")
  })

  // A container no taller than two labels -- a columns block of one line,
  // as each of the e-invoice starter's totals is (0044) -- has its own
  // label at its top end on the same line as the label of what stands at
  // the top of its last column; drawn, one covered the other, and axe could
  // not tell the colour behind either. Such a container draws no label of
  // its own, as a box shorter than its label draws none.
  test('draws no label of its own on a container no taller than two labels', () => {
    const queries = [...RULES.matchAll(/@container\s*\(height < ([\d.]+)rem\)\s*\{([^@]*?)\}\s*\}/g)].map((match) => ({ height: Number(match[1]), body: match[2] ?? '' }))
    const containers = queries.filter((query) => query.height >= 1.75 && /\[data-kind='columns'\][^{]*>\s*\[data-report-part='box-label'\]/.test(query.body))
    expect(containers.length).toBe(1)
    expect(containers[0]?.body).toMatch(/display:\s*none/)
    for (const kind of ['section', 'columns', 'keepTogether', 'table']) expect(containers[0]?.body).toContain(`[data-kind='${kind}']`)
  })

  // A group's button with nowhere to go -- the first VAT category's Move
  // up (0044) -- is aria-disabled and still sent, as a tool is: drawn
  // otherwise than a tool, it would look like one that does something, and
  // hovered otherwise, like one that wakes. Every selector that dresses an
  // unavailable tool, its state and pseudo-class kept -- `:hover` among
  // them -- stands in its rule with the group's button's counterpart.
  // Each rule's list is read selector by selector, split at its own commas
  // and not at those inside `:is()`, since one selector of a list taken
  // away leaves the list's text holding the others.
  test('draws a group’s unavailable button as an unavailable tool is drawn, hovered or not', () => {
    const DISABLED = "button[aria-disabled='true']"
    const lists = [...RULES.matchAll(/([^{}]+)\{/g)].map((match) => selectorsOf((match[1] ?? '').trim()))
    const tools = lists.flatMap((list) => list.filter((selector) => selector.includes("[data-report-part='toolbar']") && selector.includes(DISABLED)).map((selector) => ({ selector, list })))
    expect(tools.length).toBeGreaterThanOrEqual(2)
    for (const { selector, list } of tools) {
      const state = selector.slice(selector.indexOf(DISABLED) + DISABLED.length)
      expect(list, selector).toContain(`[data-report-part='property-group'] > ${DISABLED}${state}`)
    }
  })

  // The source-size guard counts stylesheets, each file on its own; the
  // editor's chrome is the report-specific part only, and the workbench has
  // the rest. A part past the budget is split by its reason to change, as
  // the entry was.
  test('stays under the source-size budget, file by file', () => {
    for (const [path, text] of [['../report-builder.css', entry], ...PARTS] as const) expect(text.split('\n').length, path).toBeLessThanOrEqual(600)
  })
})
