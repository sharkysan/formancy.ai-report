import { describe, expect, test } from 'vitest'
import { MAX_SVG_DEPTH } from './limits.js'
import { KEPT_ELEMENTS, REFUSED_ELEMENTS, REMOVED_ELEMENTS } from './svg-allow.js'
import { SVG_ADVICE } from './svg-refusal.js'
import { CEILING_MS, cleaned, refused, svg } from './svg-test-support.js'

const RECT = '<rect width="1" height="1"/>'
const GRADIENT = '<linearGradient id="a"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>'

describe('elements', () => {
  // What never draws is removed with everything in it, and listed: the
  // drawing printed is the one before any animation starts.
  test.each([...REMOVED_ELEMENTS])('%s is removed with what it holds, and listed', (name) => {
    const result = cleaned(svg(`<${name}><rect width="5" height="5"/><text>x</text></${name}>${RECT}`))
    expect(result.text).toBe(cleaned(svg(RECT)).text)
    expect(result.removed).toContainEqual({ kind: 'element', name, count: 1 })
  })

  // Each refused element with its code and what to do: text in a font
  // pdfmake picks, a picture past the asset checks, a reference a fan-out
  // could kill the process with, an appearance svg-to-pdfkit draws as
  // nothing (0030).
  test.each([...REFUSED_ELEMENTS])('%s is refused as %o', (name, { code, advice }) => {
    expect(refused(svg(`<g><${name}/></g>`))).toEqual({ ok: false, code, message: `svg/g/${name} is ${name}; ${advice}` })
  })

  // Fail closed: an SVG element nobody decided about is refused, named.
  test.each(['feGaussianBlur', 'solidcolor', 'hatch', 'meshgradient', 'iframe', 'font-face'])('%s is refused, named', (name) => {
    expect(refused(svg(`<${name}/>`))).toEqual({ ok: false, code: 'unsupported', message: `svg/${name} is ${name}, which this format does not draw; ${SVG_ADVICE.unsupported}` })
  })

  test('a nested svg is refused', () => {
    expect(refused(svg('<g><svg viewBox="0 0 1 1"/></g>')).message).toBe('svg/g/svg is an svg inside the drawing, and this format draws one svg alone; ungroup it into the outer drawing')
  })

  // A clip path holds shapes alone, a gradient stops alone, a shape
  // nothing that draws: svg-to-pdfkit would draw a group inside a clip
  // path, which a browser ignores.
  test.each([
    ['a group in a clip path', '<clipPath id="c"><g/></clipPath>', 'svg/clipPath/g is not drawn inside a clipPath; move it out of the clipPath'],
    ['a stop outside a gradient', '<g><stop/></g>', 'svg/g/stop is not drawn inside a g; move it out of the g'],
    ['a shape in a shape', '<rect><rect/></rect>', 'svg/rect/rect is not drawn inside a rect; move it out of the rect'],
    ['a gradient in a stop', '<linearGradient><stop><linearGradient/></stop></linearGradient>', 'svg/linearGradient/stop/linearGradient is not drawn inside a stop; move it out of the stop'],
  ])('%s is refused', (_, inner, message) => {
    expect(refused(svg(inner))).toEqual({ ok: false, code: 'unsupported', message })
  })

  // What the kept table names is every element a cleaned drawing is
  // written with; the differential test in svg.test.ts holds the output
  // to it.
  test('the kept elements are the drawing ones', () => {
    expect([...KEPT_ELEMENTS]).toEqual(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop', 'clipPath'])
  })

  // What draws nothing is removed and listed rather than written: a hidden
  // element, a shape of no size, a shape in defs, a group left empty.
  test('what draws nothing is removed and listed', () => {
    const result = cleaned(
      svg(`<g display="none"><rect width="5" height="5"/></g><rect width="0" height="5"/><circle r="0"/><ellipse rx="1"/><polyline points="1 1"/><defs><rect width="5" height="5"/></defs><g><g/></g>${RECT}`),
    )
    expect(result.text).toBe(cleaned(svg(RECT)).text)
    expect(result.removed).toEqual([
      { kind: 'element', name: 'g', count: 3 },
      { kind: 'element', name: 'rect', count: 2 },
      { kind: 'element', name: 'circle', count: 1 },
      { kind: 'element', name: 'ellipse', count: 1 },
      { kind: 'element', name: 'polyline', count: 1 },
      { kind: 'element', name: 'defs', count: 1 },
    ])
  })

  // A negative size is an error SVG does not draw; drawing it as none
  // would hide the error.
  test.each(['<rect width="-1" height="1"/>', '<circle r="-1"/>', '<ellipse rx="1" ry="-1"/>', '<rect width="1" height="1" rx="-1"/>'])('%s is refused as out of range', (inner) => {
    expect(refused(svg(inner)).code).toBe('out-of-range')
  })

  test('an odd count of points is refused', () => {
    expect(refused(svg('<polygon points="0 0 1 1 2"/>')).message).toBe('svg/polygon@points holds an odd count of coordinates; give every point both of its coordinates')
  })

  // A group with nothing written on it draws as its children do; its id,
  // which nothing could refer to, is listed.
  test('a group with nothing on it is unwrapped', () => {
    const result = cleaned(svg(`<g id="layer"><g>${RECT}</g></g>`))
    expect(result.text).toBe(cleaned(svg(RECT)).text)
    expect(result.removed).toEqual([{ kind: 'attribute', name: 'id', count: 1 }])
  })

  // An SVG that paints nothing is refused rather than printed as an empty
  // box (0030).
  test.each([
    ['no shape', '<g/>'],
    ['shapes painted with none', '<rect width="1" height="1" fill="none"/>'],
    ['an invisible fill', '<rect width="1" height="1" fill-opacity="0"/>'],
    ['a stroke of no width', '<rect width="1" height="1" fill="none" stroke="red" stroke-width="0"/>'],
    ['a gradient with no stops', '<linearGradient id="a"/><rect width="1" height="1" fill="url(#a)"/>'],
  ])('%s is refused', (_, inner) => {
    expect(refused(svg(inner))).toEqual({ ok: false, code: 'unsupported', message: 'the drawing paints nothing; give what it draws a fill or a stroke' })
  })

  // An element is judged before CSS says it is hidden, so a hidden layer
  // that holds text or a filter is refused as a shown one is (0030): what
  // a browser would not draw is still a construct this format has no rule
  // for, and the cascade that hides it is read after the tree.
  test('a hidden layer holding text or a filter is refused as a shown one is', () => {
    expect(refused(svg(`<g display="none"><text>x</text></g>${RECT}`)).code).toBe('text')
    expect(refused(svg(`<g style="display:none"><filter id="f"/></g>${RECT}`)).code).toBe('unsupported')
  })

  test('a hidden root paints nothing', () => {
    expect(refused(svg(RECT, ' display="none"')).message).toBe('svg is hidden: the drawing paints nothing; show the drawing')
  })
})

describe('attributes', () => {
  // What a person, a screen reader or a script reads, removed and listed.
  test('accessibility, scripting and data attributes are removed and listed', () => {
    const result = cleaned(svg('<rect width="1" height="1" data-name="x" aria-label="y" role="img" tabindex="0" focusable="false" lang="de" onclick="alert(1)" xml:lang="de" xml:space="preserve"/>'))
    expect(result.text).toBe(cleaned(svg(RECT)).text)
    expect(result.removed.map(({ name }) => name)).toEqual(['data-name', 'aria-label', 'role', 'tabindex', 'focusable', 'lang', 'onclick', 'xml:lang', 'xml:space'])
  })

  // A browser may hide an element by its conditional-processing attributes
  // even outside a switch; removing them would print what the approver
  // never saw (0030).
  test.each(['systemLanguage="fr"', 'requiredExtensions="x"', 'requiredFeatures="x"'])('%s is refused', (attribute) => {
    expect(refused(svg(`<rect width="1" height="1" ${attribute}/>`)).message).toBe(`svg/rect@${attribute.split('=')[0]} is a conditional-processing attribute, by which a browser may hide the element; remove ${attribute.split('=')[0]} from it`)
  })

  // Fail closed: an attribute nobody decided about is refused, named when
  // it can be; a browser honours transform-origin and the converter does
  // not.
  test.each([
    ['wobble="1"', `svg/rect@wobble is not an attribute this format draws as a browser draws it; ${SVG_ADVICE.unsupported}`],
    ['pathLength="10"', `svg/rect@pathLength is not an attribute this format draws as a browser draws it; ${SVG_ADVICE.unsupported}`],
    ['transform-origin="5 5"', 'svg/rect@transform-origin is not drawn by this format; apply the transform about the origin'],
    ['mask="url(#m)"', 'svg/rect@mask is not drawn by this format; flatten the transparency'],
    [`${'x'.repeat(65)}="1"`, `svg/rect@an attribute is not an attribute this format draws as a browser draws it; ${SVG_ADVICE.unsupported}`],
  ])('%s is refused', (attribute, message) => {
    expect(refused(svg(`<rect width="1" height="1" ${attribute}/>`))).toEqual({ ok: false, code: 'unsupported', message })
  })

  test('a transform on a gradient or a stop is refused, on defs removed as inert', () => {
    expect(refused(svg('<linearGradient transform="scale(2)"/>')).message).toBe("svg/linearGradient@transform transforms an element this format does not transform; move the transform onto a group around it, or onto a gradient's gradientTransform")
    expect(cleaned(svg(`<defs transform="scale(2)"/>${RECT}`)).removed).toContainEqual({ kind: 'attribute', name: 'transform', count: 1 })
  })

  // The report's box and fit decide the size, the proportions and the
  // clipping; the root keeps its viewBox alone.
  test("the root's size and its other attributes are removed and listed", () => {
    const result = cleaned(svg(RECT, ' width="200mm" height="80mm" x="0" y="0" version="1.1" baseProfile="full" preserveAspectRatio="none" zoomAndPan="magnify" contentScriptType="x" contentStyleType="y" overflow="visible" enable-background="new"'))
    expect(result.text).toBe(cleaned(svg(RECT)).text)
    expect(result.removed.map(({ name }) => name)).toEqual(['width', 'height', 'x', 'y', 'version', 'baseProfile', 'preserveAspectRatio', 'zoomAndPan', 'contentScriptType', 'contentStyleType', 'overflow', 'enable-background'])
  })
})

describe("the root's paint and transform", () => {
  // A root transform written on the root would move the drawing and its
  // clip off the report's box -- over a QR-bill's amount, say; written on
  // a group inside the root, both stay in the box (0030).
  test('a root transform is moved onto a group inside the root', () => {
    expect(cleaned(svg(RECT, ' transform="translate(400 300)"')).text).toBe(svg(`<g transform="matrix(1 0 0 1 400 300)">${RECT}</g>`))
  })

  // Dropped, Figma's root fill="none" would print every stroke-only path
  // as a black fill, silently.
  test("a root fill, and Affinity's root style, are carried on that group", () => {
    expect(cleaned(svg('<path d="M0 0 L5 5" stroke="red"/>', ' fill="none"')).text).toBe(svg('<g fill="none"><path d="M0 0 L5 5" stroke="#ff0000"/></g>'))
    expect(cleaned(svg(RECT, ' style="fill-rule:evenodd;stroke-linejoin:round"')).text).toBe(svg(`<g fill-rule="evenodd" stroke-linejoin="round">${RECT}</g>`))
    expect(cleaned(svg(RECT, ' class="r"').replace('>', '><style>svg.r{opacity:.5}</style>')).text).toBe(svg(`<g opacity="0.5">${RECT}</g>`))
  })

  // The group the root's paint moves onto is a level of the written
  // drawing, so the written depth is held to the bound, not only the
  // file's: a second cleaning would refuse it otherwise.
  test('the moved group counts as a level of the written drawing', () => {
    const nested = (levels: number): string => `${'<g>'.repeat(levels)}${RECT}${'</g>'.repeat(levels)}`.replaceAll('<g>', '<g fill-rule="evenodd">')
    expect(cleaned(svg(nested(MAX_SVG_DEPTH - 2))).ok).toBe(true)
    expect(refused(svg(nested(MAX_SVG_DEPTH - 2), ' fill="red"'))).toMatchObject({ code: 'too-deep', message: expect.stringContaining('is written past') })
  })
})

describe('links', () => {
  // An `a` is read as the group it draws as: its transform, paint and class
  // rules kept, its link removed; unwrapping it would move its children or
  // change their colour (0030), and the converter would write its
  // href as a link annotation, javascript: or not.
  test('a link is a group with its attributes, and its address is gone', () => {
    const result = cleaned(svg(`<a href="javascript:app.alert(1)" xlink:href="https://example.invalid/" xmlns:xlink="http://www.w3.org/1999/xlink" target="_blank" transform="translate(5)" fill="red">${RECT}</a>`))
    expect(result.text).toBe(svg(`<g transform="matrix(1 0 0 1 5 0)" fill="#ff0000">${RECT}</g>`))
    expect(result.text).not.toMatch(/javascript|example|href/)
    expect(result.removed).toContainEqual({ kind: 'element', name: 'a', count: 1 })
  })
})

describe('references', () => {
  // A reference names a gradient or a clip path in the file and nothing
  // else, so documentCallback is never needed and nothing outside the file
  // is read.
  test.each([
    ['names nothing', '<rect width="1" height="1" fill="url(#nowhere)"/>', 'svg/rect@fill names nothing in the file; put what it names into the file, or remove the reference'],
    ['names a shape', '<rect id="r" width="1" height="1"/><rect width="1" height="1" fill="url(#r)"/>', 'svg/rect[2]@fill names a rect, not a gradient; name a gradient'],
    ['clips with a gradient', `${GRADIENT}<rect width="1" height="1" clip-path="url(#a)"/>`, 'svg/rect@clip-path names a linearGradient, not a clip path; name a clip path'],
    ['names another file', '<rect width="1" height="1" fill="url(logo.svg#a)"/>', 'svg/rect@fill refers to something outside the file; put what it names into the file'],
    ['names an address', '<rect width="1" height="1" fill="url(http://example.invalid/a.svg#a)"/>', 'svg/rect@fill refers to something outside the file; put what it names into the file'],
    ['names data', '<rect width="1" height="1" fill="url(data:image/svg+xml,a)"/>', 'svg/rect@fill refers to something outside the file; put what it names into the file'],
    ['names something hidden', `<g display="none">${GRADIENT}</g><rect width="1" height="1" fill="url(#a)"/>`, 'svg/rect@fill names a gradient inside what is removed; move what it names into defs'],
    ['takes an href on a shape', '<rect width="1" height="1" href="#a"/>', `svg/rect@href is a reference this format does not follow; ${SVG_ADVICE.reference}`],
    ['gives an id twice', '<rect id="a" width="1" height="1"/><rect id="a" width="1" height="1"/>', 'svg/rect[2]@id is an id another element has too; give each element an id of its own'],
  ])('one that %s is refused', (_, inner, message) => {
    expect(refused(svg(inner))).toEqual({ ok: false, code: 'reference', message })
  })

  // A url() this format does not read is not a reference at all.
  test('a url() with a space in it is refused', () => {
    expect(refused(svg('<rect width="1" height="1" fill="url(#a b)"/>'))).toEqual({ ok: false, code: 'unsupported', message: 'svg/rect@fill is not none or url(#id); write it as none or url(#id)' })
    expect(refused(svg('<rect width="1" height="1" fill="url(#a$)"/>'))).toEqual({ ok: false, code: 'reference', message: 'svg/rect@fill names an id this format does not read; give what it names an id of ASCII letters, digits, _, ., : and -' })
  })

  // href and xlink:href both: readers choose between them differently.
  test('a gradient with href and xlink:href both is refused', () => {
    expect(refused(svg('<linearGradient xmlns:xlink="http://www.w3.org/1999/xlink" href="#b" xlink:href="#b"/>')).message).toBe(
      'svg/linearGradient@xlink:href: href and xlink:href both, which readers choose between differently; keep one of them',
    )
  })

  // Ids are renamed in document order, so the written form is one and the
  // same however the file named them; what nothing refers to is removed.
  test('ids are renamed in document order and the unused removed', () => {
    const result = cleaned(svg(`<clipPath id="7a"><rect width="9" height="9"/></clipPath><linearGradient id="z"><stop/><stop offset="1"/></linearGradient>${GRADIENT}<rect width="1" height="1" fill="url(#a)" clip-path="url(#7a)"/><rect width="2" height="2" stroke="url(#z)"/>`))
    expect(result.text).toBe(
      svg('<clipPath id="c1"><rect width="9" height="9"/></clipPath><linearGradient id="g1"><stop/><stop offset="1"/></linearGradient><linearGradient id="g2"><stop stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><rect width="1" height="1" fill="url(#g2)" clip-path="url(#c1)"/><rect width="2" height="2" stroke="url(#g1)"/>'),
    )
    expect(cleaned(svg(`<linearGradient id="unused"><stop/></linearGradient>${RECT}`)).removed).toEqual([{ kind: 'element', name: 'linearGradient', count: 1 }])
  })

  // A fallback colour is kept, written as every colour is.
  test('a paint with a fallback keeps it', () => {
    expect(cleaned(svg(`${GRADIENT}<rect width="1" height="1" fill="url(#a) RED"/><rect width="1" height="1" stroke="url(#a) none"/>`)).text).toContain('fill="url(#g1) #ff0000"')
  })
})

describe('gradients', () => {
  // A gradient takes what it does not set from the gradient it names, its
  // stops when it has none, and is written without an href; an unbounded
  // or circular chain is refused, as svg-to-pdfkit would recurse on it
  // until the stack overflows (0030).
  test('a chain of three is flattened into one', () => {
    const chain = '<linearGradient id="c" x1="0.25"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><linearGradient id="b" href="#c" y1="0.5"/><linearGradient id="a" href="#b" x2="0.75"/>'
    const result = cleaned(svg(`${chain}<rect width="1" height="1" fill="url(#a)"/>`))
    expect(result.text).toBe(svg('<linearGradient id="g1" x1="0.25" y1="0.5" x2="0.75"><stop stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><rect width="1" height="1" fill="url(#g1)"/>'))
    expect(result.removed).toEqual([{ kind: 'element', name: 'linearGradient', count: 2 }])
  })

  test('a chain at the depth bound is read, past it refused', () => {
    const chain = (length: number): string =>
      Array.from({ length }, (_, i) => (i === length - 1 ? `<linearGradient id="g${i}"><stop/><stop offset="1"/></linearGradient>` : `<linearGradient id="g${i}" href="#g${i + 1}"/>`)).join('')
    expect(cleaned(svg(`${chain(MAX_SVG_DEPTH)}<rect width="1" height="1" fill="url(#g0)"/>`)).ok).toBe(true)
    expect(refused(svg(`${chain(MAX_SVG_DEPTH + 1)}<rect width="1" height="1" fill="url(#g0)"/>`))).toMatchObject({ code: 'too-deep', message: expect.stringContaining(`a chain of more than ${MAX_SVG_DEPTH} gradients`) })
  })

  test.each([
    ['a cycle', '<linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/>', 'reference', 'svg/linearGradient[2]@href is a cycle of gradients naming each other; make one of them name none'],
    ['an href to a shape', '<linearGradient id="a" href="#r"/><rect id="r" width="1" height="1"/>', 'reference', 'svg/linearGradient@href names no gradient in the file; name a gradient in the file'],
    ['an href outside the file', '<linearGradient id="a" href="other.svg#b"/>', 'reference', 'svg/linearGradient@href refers to something outside the file; put the gradient it names into the file'],
    ['a spread this format does not draw', '<linearGradient id="a" spreadMethod="reflect"><stop/><stop/></linearGradient>', 'unsupported', 'svg/linearGradient@spreadMethod is a spread this format draws as pad alone; expand the repeated gradient into shapes, or use pad'],
    ['a focal radius', '<radialGradient id="a" fr="0.1"><stop/><stop/></radialGradient>', 'unsupported', `svg/radialGradient@fr is not an attribute this format draws as a browser draws it; ${SVG_ADVICE.unsupported}`],
    ['no radius', '<radialGradient id="a" r="0"><stop/><stop/></radialGradient>', 'out-of-range', 'svg/radialGradient@r is a radial gradient of no radius; give it a radius, or paint with its last colour'],
    ['a percentage of the viewport', '<linearGradient id="a" gradientUnits="userSpaceOnUse" x2="50%"><stop/><stop/></linearGradient>', 'unsupported', 'svg/linearGradient@x2 is a percentage, which this format reads only for an offset, an opacity and a gradient in its box; write it in user units, px, pt, pc, mm, cm or in'],
    ['units it does not know', '<linearGradient id="a" gradientUnits="strokeBox"><stop/><stop/></linearGradient>', 'unsupported', `svg/linearGradient@gradientUnits is not userSpaceOnUse or objectBoundingBox; ${SVG_ADVICE.unsupported}`],
  ])('%s is refused', (_, gradient, code, message) => {
    expect(refused(svg(`${gradient}<rect width="1" height="1" fill="url(#a)"/>`))).toEqual({ ok: false, code, message })
  })

  // A gradient's percentages in its box are fractions of it; stop offsets
  // are clamped to 0..1 as SVG clamps them; its transform is written as a
  // matrix.
  test("a gradient's geometry is written in its own units", () => {
    expect(cleaned(svg('<radialGradient id="a" cx="50%" fy="10%" r="2" gradientTransform="rotate(90)"><stop offset="-1"/><stop offset="150%"/></radialGradient><rect width="1" height="1" fill="url(#a)"/>')).text).toContain(
      '<radialGradient id="g1" cx="0.5" r="2" fy="0.1" gradientTransform="matrix(0 1 -1 0 0 0)"><stop offset="0"/><stop offset="1"/></radialGradient>',
    )
  })

  // pad is the spread both readers draw alike, and is kept as written.
  test('a pad spread is kept', () => {
    expect(cleaned(svg('<linearGradient id="a" spreadMethod="pad"><stop/><stop offset="1"/></linearGradient><rect width="1" height="1" fill="url(#a)"/>')).text).toContain('spreadMethod="pad"')
  })

  // A gradient of one stop is drawn by both readers as that stop's colour
  // at its opacity; kept as it is, its stop-opacity cannot be dropped.
  test('a single stop keeps its opacity', () => {
    expect(cleaned(svg('<linearGradient id="a"><stop stop-color="red" stop-opacity=".5"/></linearGradient><rect width="1" height="1" fill="url(#a)"/>')).text).toContain('<stop stop-color="#ff0000" stop-opacity="0.5"/>')
  })
})

describe('clip paths', () => {
  // A clip path with nothing in it hides what it clips: refused, never
  // drawn as no clip.
  test('a clip path left empty and still used is refused', () => {
    expect(refused(svg('<clipPath id="c"><rect width="0" height="1"/></clipPath><rect width="1" height="1" clip-path="url(#c)"/>')).message).toBe(
      'svg/clipPath is a clip path with nothing in it, which hides what it clips; put the shape it clips to inside it, or remove the clip',
    )
  })

  // A clip path clipped again is a second reference svg-to-pdfkit follows
  // with no bound; refused.
  test('a clip inside a clip path is refused', () => {
    expect(refused(svg('<clipPath id="c" clip-path="url(#d)"><rect width="1" height="1"/></clipPath>')).message).toBe('svg/clipPath is clipped inside a clip path; clip it once, with one clip path')
    expect(refused(svg('<clipPath id="c"><rect width="1" height="1" clip-path="url(#d)"/></clipPath>')).message).toBe('svg/clipPath/rect is clipped inside a clip path; clip it once, with one clip path')
  })

  // Removing a group left empty can leave what it referred to unused, and
  // removing that can empty another group; what is kept is found from the
  // shapes up, so a second cleaning removes nothing (found by the
  // mutations).
  test('what draws is found from the shapes up', () => {
    const result = cleaned(svg('<clipPath id="c"><rect width="9" height="9"/></clipPath><g clip-path="url(#c)"><rect width="0" height="1"/></g><rect width="1" height="1"/>'))
    expect(result.text).toBe(svg('<rect width="1" height="1"/>'))
    expect(result.removed).toEqual([
      { kind: 'element', name: 'rect', count: 1 },
      { kind: 'element', name: 'clipPath', count: 1 },
      { kind: 'element', name: 'g', count: 1 },
    ])
  })

  // Removed in rounds, a chain of groups each holding the clip path the
  // last one used took a round for every link, each a pass over the whole
  // drawing: 3,300 links, 298 kB, took 2.5 s to clean (2026-10-18, Intel
  // i9-10900K, Node 24.21.0). Found from the shapes up, each element is
  // visited once.
  test("a chain of groups each holding the last one's clip path is cleaned in one pass", () => {
    const links = 3300
    let inner = '<g clip-path="url(#c1)"/>'
    for (let k = 1; k < links; k += 1) inner += `<g clip-path="url(#c${k + 1})"><clipPath id="c${k}"><rect width="1" height="1"/></clipPath></g>`
    inner += `<clipPath id="c${links}"><rect width="1" height="1"/></clipPath><rect width="1" height="1"/>`
    const started = Date.now()
    expect(cleaned(svg(inner)).text).toBe(svg('<rect width="1" height="1"/>'))
    expect(Date.now() - started).toBeLessThan(CEILING_MS)
  })

  // What is written on an element is what draws there (`WRITTEN_ON`):
  // a stop's colour on a shape draws nowhere, nor does paint on defs or a
  // fill on a clip path, whose shapes clip in no colour. Each is removed
  // and listed, so that the written drawing holds nothing that two readers
  // could disagree about the meaning of.
  test('what draws nowhere on an element is removed from it and listed', () => {
    const result = cleaned(svg('<defs fill="red"><clipPath id="c" fill="blue" clip-rule="evenodd"><rect width="9" height="9"/></clipPath></defs><rect width="9" height="9" stop-color="red" stop-opacity="0.5" clip-path="url(#c)"/>'))
    expect(result.text).toBe(svg('<defs><clipPath id="c1" clip-rule="evenodd"><rect width="9" height="9"/></clipPath></defs><rect width="9" height="9" clip-path="url(#c1)"/>'))
    expect(result.removed.filter(({ kind }) => kind === 'property').map(({ name, count }) => `${name} x${count}`).sort()).toEqual(['fill x2', 'stop-color x1', 'stop-opacity x1'])
  })

  // A clip path's shapes inherit clip-rule from the group or the defs it
  // is in. The cleaner writes the rule on the clip path itself, so that the
  // clip never rests on defs, which it cleans of every property: removed
  // there and not written here, a ring clipped even-odd would clip as a
  // filled square.
  test('a clip rule a clip path would inherit is written on it', () => {
    const clip = '<clipPath id="c"><path d="M0 0H9V9H0z M2 2H7V7H2z"/></clipPath><rect width="9" height="9" clip-path="url(#c)"/>'
    expect(cleaned(svg(`<defs clip-rule="evenodd">${clip.slice(0, clip.indexOf('<rect'))}</defs>${clip.slice(clip.indexOf('<rect'))}`)).text).toContain('<clipPath id="c1" clip-rule="evenodd">')
    expect(cleaned(svg(`<g clip-rule="evenodd" fill="#000000">${clip}</g>`)).text).toContain('<clipPath id="c1" clip-rule="evenodd">')
    expect(cleaned(svg(clip, ' style="clip-rule:evenodd"')).text).toContain('<clipPath id="c1" clip-rule="evenodd">')
    expect(cleaned(svg(clip)).text).toContain('<clipPath id="c1">')
  })

  test('clip path units are kept, other units refused', () => {
    expect(cleaned(svg('<clipPath id="c" clipPathUnits="objectBoundingBox"><rect width="1" height="1"/></clipPath><rect width="1" height="1" clip-path="url(#c)"/>')).text).toContain('clipPathUnits="objectBoundingBox"')
    expect(refused(svg('<clipPath id="c" clipPathUnits="x"><rect width="1" height="1"/></clipPath>')).code).toBe('unsupported')
  })
})

describe('the viewBox', () => {
  // The viewBox is what contain and cover keep the proportions of.
  test('is read, or taken from the root size when there is none', () => {
    expect(cleaned(svg(RECT)).viewBox).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(cleaned(`<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="20">${RECT}</svg>`)).toMatchObject({ viewBox: { x: 0, y: 0, width: 10 * (96 / 25.4), height: 20 } })
    expect(cleaned(svg(RECT).replace('viewBox="0 0 100 100"', 'viewBox="-5,-5 , 20 10"')).text).toContain('viewBox="-5 -5 20 10"')
  })

  test.each([
    ['no viewBox and no size', '<svg xmlns="http://www.w3.org/2000/svg" width="10">', 'out-of-range', 'svg has no viewBox, and no width and height to take one from; give the svg a viewBox'],
    ['a side under one unit', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0.5 10">', 'out-of-range', 'svg@viewBox gives the drawing a side under one unit; scale the drawing up in the drawing program'],
    ['three numbers', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10">', 'unsupported', 'svg@viewBox is not four numbers; write it as four numbers: x, y, width and height'],
    ['a size in percent', '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">', 'unsupported', 'svg@width is a percentage, which this format reads only for an offset, an opacity and a gradient in its box; write it in user units, px, pt, pc, mm, cm or in'],
  ])('%s is refused', (_, open, code, message) => {
    expect(refused(`${open}${RECT}</svg>`)).toEqual({ ok: false, code, message })
  })
})
