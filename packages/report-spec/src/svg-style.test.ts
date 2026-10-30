import { describe, expect, test } from 'vitest'
import { MAX_SVG_CASCADE, MAX_SVG_RULES } from './limits.js'
import { CSS_ADVICE } from './svg-refusal.js'
import { CEILING_MS, cleaned, refused, svg } from './svg-test-support.js'

/** The fill a cleaned drawing's rect is written with. */
function fillOf(inner: string): string | undefined {
  return /<rect[^>]* fill="([^"]*)"/.exec(cleaned(svg(inner)).text)?.[1]
}

describe('the cascade', () => {
  // CSS's cascade for SVG: a presentation attribute, then the stylesheet's
  // rules by specificity and order, then the style attribute. Got wrong,
  // a logo prints in other colours than a browser draws it in.
  test('the style attribute beats the stylesheet, which beats the presentation attribute', () => {
    expect(fillOf('<style>.a{fill:red}</style><rect class="a" width="1" height="1" fill="blue" style="fill:green"/>')).toBe('#008000')
    expect(fillOf('<style>.a{fill:red}</style><rect class="a" width="1" height="1" fill="blue"/>')).toBe('#ff0000')
    expect(fillOf('<rect width="1" height="1" fill="blue"/>')).toBe('#0000ff')
  })

  test('a more specific rule beats a less specific one, whatever their order', () => {
    expect(fillOf('<style>.a.b{fill:red}.a{fill:blue}</style><rect class="a b" width="1" height="1"/>')).toBe('#ff0000')
    expect(fillOf('<style>#r{fill:red}.a.b.c{fill:blue}</style><rect id="r" class="a b c" width="1" height="1"/>')).toBe('#ff0000')
    expect(fillOf('<style>rect.a{fill:red}.a{fill:blue}</style><rect class="a" width="1" height="1"/>')).toBe('#ff0000')
  })

  test('of equal rules the later wins, across stylesheets too', () => {
    expect(fillOf('<style>.a{fill:red}.a{fill:blue}</style><rect class="a" width="1" height="1"/>')).toBe('#0000ff')
    expect(fillOf('<style>.a{fill:red}</style><style>.a{fill:lime}</style><rect class="a" width="1" height="1"/>')).toBe('#00ff00')
    expect(fillOf('<rect width="1" height="1" style="fill:red;fill:blue"/>')).toBe('#0000ff')
  })

  // A type, a class, an id and their compounds, and comma lists of them:
  // svg-to-pdfkit's subset, and what Illustrator writes.
  test('types, classes, ids, compounds and lists all match', () => {
    expect(fillOf('<style>rect{fill:red}</style><rect width="1" height="1"/>')).toBe('#ff0000')
    expect(fillOf('<style>#a{fill:red}</style><rect id="a" width="1" height="1"/>')).toBe('#ff0000')
    expect(fillOf('<style>path, .x , rect.y{fill:red}</style><rect class="y" width="1" height="1"/>')).toBe('#ff0000')
    expect(fillOf('<style>rect.y.z{fill:red}</style><rect class="y" width="1" height="1"/>')).toBeUndefined()
    expect(fillOf('<style>a{fill:red}</style><a><rect width="1" height="1"/></a>')).toBeUndefined()
    expect(cleaned(svg('<style>a{fill:red}</style><a><rect width="1" height="1"/></a>')).text).toContain('<g fill="#ff0000">')
  })

  // A stylesheet is read once, its rules flattened into attributes, and
  // removed and listed; svg-to-pdfkit never sees CSS.
  test('the stylesheet is removed and listed, its text and CDATA read alike', () => {
    const result = cleaned(svg('<style type="text/css"><![CDATA[ .a { fill: red } ]]></style><rect class="a" width="1" height="1"/>'))
    expect(result.text).toBe(svg('<rect width="1" height="1" fill="#ff0000"/>'))
    expect(result.removed).toContainEqual({ kind: 'element', name: 'style', count: 1 })
  })

  // Property names in any case, as CSS reads them; url() quoted or not.
  test('property names are read in any case, and url() quoted', () => {
    expect(fillOf('<rect width="1" height="1" style="FILL: Red"/>')).toBe('#ff0000')
    expect(
      cleaned(svg('<linearGradient id="a"><stop/><stop offset="1"/></linearGradient><rect width="1" height="1" style="fill:url(&quot;#a&quot;)"/>')).text,
    ).toContain('fill="url(#g1)"')
    expect(
      cleaned(svg('<linearGradient id="a"><stop/><stop offset="1"/></linearGradient><rect width="1" height="1" style="fill:url( \'#a\' )"/>')).text,
    ).toContain('fill="url(#g1)"')
  })
})

describe('what CSS is refused', () => {
  // A comment separates, as CSS says: fi/**/ll is two words, never fill,
  // which deleting the comment in place would make it.
  test('a comment separates and is never deleted in place', () => {
    expect(refused(svg('<rect width="1" height="1" style="fi/**/ll:red"/>')).message).toBe(
      `svg/rect@style holds a CSS declaration this format does not read; ${CSS_ADVICE}`,
    )
    expect(fillOf('<rect width="1" height="1" style="/* a */fill/* b */:/* c */red/* d */"/>')).toBe('#ff0000')
  })

  // Each of these is a CSS a browser reads one way and a second, partial
  // reader could read another; refused, never ignored.
  test.each([
    ['an escape', '<style>.\\61{fill:red}</style>', 'holds a CSS escape'],
    ['!important', '<style>.a{fill:red!important}</style>', 'holds !important'],
    ['an import', '<style>@import url(http://example.invalid/a.css);</style>', 'holds an at-rule'],
    ['a media rule', '<style>@media print{rect{fill:red}}</style>', 'holds an at-rule'],
    ['a font face', '<style>@font-face{font-family:x}</style>', 'holds an at-rule'],
    ['a descendant combinator', '<style>g rect{fill:red}</style>', 'a selector this format does not read'],
    ['a child combinator', '<style>g>rect{fill:red}</style>', 'a selector this format does not read'],
    ['an attribute selector', '<style>[x]{fill:red}</style>', 'a selector this format does not read'],
    ['a pseudo-class', '<style>rect:hover{fill:red}</style>', 'a selector this format does not read'],
    ['the universal selector', '<style>*{fill:red}</style>', 'a selector this format does not read'],
    ['a namespace selector', '<style>svg|rect{fill:red}</style>', 'a selector this format does not read'],
    ['an empty selector', '<style>.a,{fill:red}</style>', 'a selector this format does not read'],
    ['a custom property', '<style>.a{--c:red}</style>', 'holds a custom property'],
    ['geometry', '<style>.a{x:5}</style>', 'x is geometry in CSS'],
    ['an unknown property', '<style>.a{fill:red;wobble:2}</style>', 'wobble is not a property this format draws'],
    ['an unclosed rule', '<style>.a{fill:red</style>', 'a CSS rule that is not closed'],
    ['CSS outside a rule', '<style>.a{fill:red} b</style>', 'CSS outside a rule'],
    ['an unclosed comment', '<style>/* x</style>', 'a CSS comment that is not closed'],
    ['an unclosed string', '<style>.a{fill:url("#a)}</style>', 'a CSS string that is not closed'],
    ['CSS markup', '<style><![CDATA[<!-- .a{fill:red} -->]]></style>', 'CSS markup'],
    ['a stylesheet in another language', '<style type="text/less">.a{fill:red}</style>', 'a stylesheet that is not CSS'],
    ['a stylesheet for print alone', '<style media="print">.a{fill:red}</style>', 'for some media alone'],
    ['a filter', '<style>.a{filter:url(#f)}</style>', 'filter is not drawn by this format; expand the appearance'],
    ['a selector past ASCII', '<style>.ü{fill:red}</style>', 'a selector with a byte past ASCII'],
  ])('%s is refused', (_, inner, said) => {
    expect(refused(svg(`${inner}<rect class="a" width="1" height="1"/>`)).message).toContain(said)
  })

  // Inert declarations are removed and listed, whatever CSS writes them
  // in: Inkscape's vendor-prefixed and text properties, and none, normal
  // and auto values that do nothing (0030).
  test('inert declarations are removed and listed', () => {
    const result = cleaned(
      svg(
        '<rect width="1" height="1" style="-inkscape-stroke:none;font-family:\'Ärial\';marker:none;filter:none;mix-blend-mode:normal;isolation:auto;shape-rendering:crispEdges;paint-order:normal;fill:red"/>',
      ),
    )
    expect(result.text).toBe(svg('<rect width="1" height="1" fill="#ff0000"/>'))
    expect(result.removed.map(({ kind, name }) => `${kind} ${name}`)).toEqual([
      'property -inkscape-stroke',
      'property font-family',
      'property marker',
      'property filter',
      'property mix-blend-mode',
      'property isolation',
      'property shape-rendering',
      'property paint-order',
    ])
  })

  // A stroke painted under its fill draws otherwise in svg-to-pdfkit,
  // which paints fill then stroke; an order that keeps fill first is inert.
  test.each(['fill', 'fill stroke', 'markers', 'markers fill stroke'])('paint-order %s is removed', (order) => {
    expect(cleaned(svg(`<rect width="1" height="1" paint-order="${order}"/>`)).removed).toContainEqual({ kind: 'attribute', name: 'paint-order', count: 1 })
  })

  test.each(['stroke', 'stroke fill', 'markers stroke', 'fill fill', 'sideways'])('paint-order %s is refused', (order) => {
    expect(refused(svg(`<rect width="1" height="1" paint-order="${order}"/>`)).message).toBe(
      'svg/rect@paint-order is not drawn by this format; paint the fill before the stroke',
    )
  })

  // Matching is linear in the rules that could match only because the
  // simple selectors are bounded: rules that all match every element
  // cannot be indexed away.
  test('the stylesheets hold at most MAX_SVG_RULES simple selectors', () => {
    const rules = (count: number): string => `<style>${Array.from({ length: count }, (_, i) => `.c${i}{fill:red}`).join('')}</style>`
    expect(cleaned(svg(`${rules(MAX_SVG_RULES)}<rect width="1" height="1"/>`)).ok).toBe(true)
    expect(refused(svg(`${rules(MAX_SVG_RULES + 1)}<rect width="1" height="1"/>`))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the stylesheets hold more than ${MAX_SVG_RULES} selectors; ${CSS_ADVICE}`,
    })
    // A compound counts each of its parts.
    expect(
      refused(svg(`<style>${Array.from({ length: MAX_SVG_RULES / 2 + 1 }, (_, i) => `rect.c${i}{fill:red}`).join('')}</style><rect width="1" height="1"/>`))
        .code,
    ).toBe('too-large')
  })

  // The rules one combination of classes matches are merged once, but
  // elements that each hold a combination of their own are a merge each:
  // review measured 0.8 to 3.2 s for elements of their own sets of classes
  // under rules that all match them. Every rule compared and every
  // declaration merged is counted, and the cascade refused at
  // MAX_SVG_CASCADE's work and a unit past it: here 98 type rules and two
  // class rules, one declaration each, compared and merged for each
  // element of its own pair of classes, 200 units a merge, and a last
  // element whose one rule declares nothing, one unit. Each element is a
  // move, a segment, so that MAX_SVG_SEGMENTS is not what refuses them.
  test('the cascade is bounded by MAX_SVG_CASCADE, each rule compared and each declaration merged counted', () => {
    const rules = `<style>${'path{fill:#123456}'.repeat(98)}${Array.from({ length: 101 }, (_, i) => `.c${i}{fill:#123456}`).join('')}.z{}</style>`
    const pairs: string[] = []
    for (let a = 0; a < 101; a += 1) for (let b = a + 1; b < 101; b += 1) pairs.push(`c${a} c${b}`)
    const merges = MAX_SVG_CASCADE / 200
    expect(Number.isInteger(merges) && merges <= pairs.length).toBe(true)
    const elements = pairs
      .slice(0, merges)
      .map((classes) => `<path d="M0 0" class="${classes}"/>`)
      .join('')
    expect(cleaned(svg(`${rules}${elements}`)).ok).toBe(true)
    expect(refused(svg(`${rules}${elements}<rect width="1" height="1" class="z"/>`))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the stylesheets would be matched against its elements more than ${MAX_SVG_CASCADE} times; ${CSS_ADVICE}`,
    })
  })

  // The shape review measured, refused at the bound rather than worked
  // through: 9,990 elements each of its own set of fourteen classes, under
  // 242 type rules declaring every kept property, took the cleaner 1.8 s
  // before the bound (2026-10-18, Intel i9-10900K, Node 24.21.0).
  test('elements each of their own classes under rules that match them all are refused in linear time', () => {
    const every =
      'fill:#123456;fill-opacity:.5;fill-rule:evenodd;stroke:#654321;stroke-opacity:.5;stroke-width:0;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:1;opacity:1;clip-rule:evenodd'
    const rules = `<style>${Array.from({ length: 14 }, (_, bit) => `.c${bit}{${every}}`).join('')}${`rect{${every}}`.repeat(242)}</style>`
    const classes = (i: number): string =>
      Array.from({ length: 14 }, (_, bit) => ((i >> bit) & 1 ? `c${bit}` : ''))
        .filter((name) => name !== '')
        .join(' ')
    const elements = Array.from({ length: 9990 }, (_, i) => `<rect width="1" height="1" class="${classes(i + 1)}"/>`).join('')
    const started = Date.now()
    expect(refused(svg(`${rules}${elements}`)).message).toContain(`more than ${MAX_SVG_CASCADE} times`)
    expect(Date.now() - started).toBeLessThan(CEILING_MS)
  })
})
