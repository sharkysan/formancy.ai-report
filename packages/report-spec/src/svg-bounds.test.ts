import { describe, expect, test } from 'vitest'
import { MAX_SVG_BYTES, MAX_SVG_DEPTH, MAX_SVG_ELEMENTS, MAX_SVG_GROUPS, MAX_SVG_REMOVED_NAMES, MAX_SVG_SEGMENTS, MAX_SVG_STOPS } from './limits.js'
import { SVG_ADVICE } from './svg-refusal.js'
import { cleaned, refused, svg, utf8 } from './svg-test-support.js'

const RECT = '<rect width="1" height="1"/>'

/** A positive number as the cleaner writes it, `length` characters long, from 1 to 16. */
function numberOf(length: number): string {
  if (length <= 6) return '1'.repeat(length)
  return length === 7 ? '1000000' : `111111.${'1'.repeat(length - 7)}`
}

/** A move, which costs one segment, with a dash array of numbers `lengths` characters long, written as the cleaner writes it. */
function dashed(lengths: readonly number[]): string {
  return `<path d="M0 0" stroke-dasharray="${lengths.map(numberOf).join(' ')}"/>`
}

/** An even count of dash lengths, 1 to 16 characters each, that `dashed` writes in exactly `length` bytes, from 39 to 580. */
function dashesFor(length: number): number[] {
  const fixed = dashed([]).length - 1
  let count = 2
  while (fixed + count + 16 * count < length) count += 2
  let rest = length - fixed - count
  return Array.from({ length: count }, (_, i) => {
    const taken = Math.min(16, rest - (count - 1 - i))
    rest -= taken
    return taken
  })
}

/**
 * A drawing in the form the cleaner writes it, of exactly `length` bytes --
 * moves of long dash arrays, which cost a segment each, the last two
 * taking up the rest -- and the same drawing as a person saved it, its
 * colour written short, three bytes fewer.
 */
function ofLength(length: number): { readonly clean: string; readonly saved: string } {
  const unit = dashed(Array.from({ length: 32 }, () => 16))
  const wrap = (inner: string): string => svg(`<rect width="1" height="1" fill="#aabbcc"/>${inner}`)
  const fixed = wrap('').length
  const units = Math.floor((length - fixed - 100) / unit.length)
  const rest = length - fixed - units * unit.length
  const first = rest >= 619 ? 580 : rest - 39
  const clean = wrap(`${unit.repeat(units)}${dashed(dashesFor(first))}${dashed(dashesFor(rest - first))}`)
  if (clean.length !== length) throw new Error(`built ${clean.length} bytes for ${length}`)
  return { clean, saved: clean.replace('#aabbcc', '#abc') }
}

/** A filled path of a move and `lines` crossing lines. */
function lines(count: number, attributes = ''): string {
  return `<path d="M0 0${' L50 50 L0 50'.repeat(Math.floor(count / 2))}${count % 2 === 1 ? ' L9 9' : ''}"${attributes}/>`
}

describe('the bounds of an SVG', () => {
  // Every bound is a number a test reaches: accepted at itself, refused one
  // past, with the code a host can tell a person.
  test('bytes: a file of MAX_SVG_BYTES is read, one more refused', () => {
    const open = svg(`${RECT}<!--`).slice(0, -'</svg>'.length)
    const at = (length: number): Uint8Array => utf8(`${open}${'x'.repeat(length - open.length - '--></svg>'.length)}--></svg>`)
    expect(cleaned(at(MAX_SVG_BYTES)).ok).toBe(true)
    expect(refused(at(MAX_SVG_BYTES + 1))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the file is ${MAX_SVG_BYTES + 1} bytes; the limit is ${MAX_SVG_BYTES}; ${SVG_ADVICE['too-large']}`,
    })
  })

  // The written form can be several times its input; one that would pass
  // the bound is refused when it is approved, not at every print after it
  // (0030).
  test('bytes: a drawing whose cleaned form would pass MAX_SVG_BYTES is refused', () => {
    // An odd dash array is written doubled, and each 1e5 as 100000: four times the bytes.
    const moves = `<path d="M0 0" stroke-dasharray="${Array.from({ length: 15 }, () => '1e5').join(' ')}"/>`.repeat(MAX_SVG_SEGMENTS - 10)
    expect(moves.length).toBeLessThan(MAX_SVG_BYTES)
    const refusal = refused(svg(`${RECT}${moves}`))
    expect(refusal.code).toBe('too-large')
    expect(refusal.message).toMatch(new RegExp(`^the cleaned drawing would be \\d+ bytes; the limit is ${MAX_SVG_BYTES}; ${SVG_ADVICE['too-large']}$`))
  })

  // The written form is held to the bound exactly, as the file is: a
  // drawing whose cleaned form is MAX_SVG_BYTES is approved, and one whose
  // cleaned form is a byte more is refused, though the file as saved, its
  // colour written short, is under the bound either way.
  test('bytes: a drawing written in MAX_SVG_BYTES is approved, one written a byte longer refused', () => {
    const approved = ofLength(MAX_SVG_BYTES)
    expect(approved.saved.length).toBeLessThan(MAX_SVG_BYTES)
    const written = cleaned(approved.saved)
    expect(written.bytes.length).toBe(MAX_SVG_BYTES)
    expect(written.text).toBe(approved.clean)
    const longer = ofLength(MAX_SVG_BYTES + 1)
    expect(longer.saved.length).toBeLessThan(MAX_SVG_BYTES)
    expect(refused(longer.saved)).toEqual({
      ok: false,
      code: 'too-large',
      message: `the cleaned drawing would be ${MAX_SVG_BYTES + 1} bytes; the limit is ${MAX_SVG_BYTES}; ${SVG_ADVICE['too-large']}`,
    })
  })

  test('depth: MAX_SVG_DEPTH levels are read, one more refused', () => {
    const nested = (levels: number): string => `${'<g fill-rule="evenodd">'.repeat(levels - 2)}${RECT}${'</g>'.repeat(levels - 2)}`
    expect(cleaned(svg(nested(MAX_SVG_DEPTH))).ok).toBe(true)
    expect(refused(svg(nested(MAX_SVG_DEPTH + 1)))).toMatchObject({ code: 'too-deep', message: expect.stringContaining(`nests past ${MAX_SVG_DEPTH} levels`) })
  })

  test('elements: MAX_SVG_ELEMENTS are read, one more refused', () => {
    const empties = (count: number): string => `${'<defs/>'.repeat(count)}${RECT}`
    expect(cleaned(svg(empties(MAX_SVG_ELEMENTS - 2))).ok).toBe(true)
    expect(refused(svg(empties(MAX_SVG_ELEMENTS - 1)))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the drawing has more than ${MAX_SVG_ELEMENTS} elements; ${SVG_ADVICE['too-large']}`,
    })
  })

  // The group the root's paint moves onto is an element of the written
  // drawing, so the written count is held to the bound too.
  test('elements: the written drawing is held to MAX_SVG_ELEMENTS', () => {
    // Moves alone, a segment each, and gradients of every stop each, painting one move each.
    const MOVE = '<path d="M0 0"/>'
    const gradients = 140
    const stops = Array.from({ length: MAX_SVG_STOPS }, () => '<stop/>').join('')
    const used = Array.from({ length: gradients }, (_, i) => `<linearGradient id="a${i}">${stops}</linearGradient><path d="M0 0" fill="url(#a${i})"/>`).join('')
    const inner = `${used}${MOVE.repeat(MAX_SVG_ELEMENTS - 1 - gradients * (MAX_SVG_STOPS + 2))}`
    expect(cleaned(svg(inner)).drawn.elements).toBe(MAX_SVG_ELEMENTS)
    expect(refused(svg(inner, ' fill="red"'))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the cleaned drawing has more than ${MAX_SVG_ELEMENTS} elements; ${SVG_ADVICE['too-large']}`,
    })
  })

  test('stops: MAX_SVG_STOPS in a gradient are read, one more refused', () => {
    const gradient = (count: number): string => `<linearGradient id="a">${'<stop/>'.repeat(count)}</linearGradient><rect width="1" height="1" fill="url(#a)"/>`
    expect(cleaned(svg(gradient(MAX_SVG_STOPS))).ok).toBe(true)
    expect(refused(svg(gradient(MAX_SVG_STOPS + 1)))).toEqual({
      ok: false,
      code: 'too-large',
      message: `svg/linearGradient has more than ${MAX_SVG_STOPS} stops; ${SVG_ADVICE['too-large']}`,
    })
  })

  test('segments: MAX_SVG_SEGMENTS weighted segments are read, one more refused', () => {
    expect(cleaned(svg(lines(MAX_SVG_SEGMENTS - 1))).segments).toBe(MAX_SVG_SEGMENTS)
    expect(refused(svg(lines(MAX_SVG_SEGMENTS)))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the drawing costs ${MAX_SVG_SEGMENTS + 1} weighted segments to paint; the limit is ${MAX_SVG_SEGMENTS}; ${SVG_ADVICE['too-large']}`,
    })
  })

  test('groups: MAX_SVG_GROUPS units are read, one more refused', () => {
    const clips = (count: number): string => `<clipPath id="c">${RECT}</clipPath>${`<rect width="1" height="1" clip-path="url(#c)"/>`.repeat(count)}`
    expect(cleaned(svg(clips(MAX_SVG_GROUPS))).groups).toBe(MAX_SVG_GROUPS)
    expect(refused(svg(clips(MAX_SVG_GROUPS + 1)))).toEqual({
      ok: false,
      code: 'too-large',
      message: `the drawing makes ${MAX_SVG_GROUPS + 1} units of transparency groups; the limit is ${MAX_SVG_GROUPS}; flatten its clips and its transparency`,
    })
  })

  // The list a person is shown does not grow with what a file holds
  // (0030), and a name is repeated only when it is short ASCII.
  test('removed: MAX_SVG_REMOVED_NAMES names are listed, the rest counted', () => {
    const attributes = Array.from({ length: MAX_SVG_REMOVED_NAMES + 8 }, (_, i) => `data-a${i}="x"`).join(' ')
    const result = cleaned(svg(`<rect width="1" height="1" ${attributes} data-a0b="x"/>`))
    expect(result.removed).toHaveLength(MAX_SVG_REMOVED_NAMES)
    expect(result.removedMore).toBe(9)
    expect(cleaned(svg(`<rect width="1" height="1" data-${'x'.repeat(64)}="1" data-ü="2"/>`)).removed).toEqual([
      { kind: 'attribute', name: 'an attribute with a long or non-ASCII name', count: 2 },
    ])
    expect(cleaned(svg(`<x:${'y'.repeat(70)} xmlns:x="urn:x"/>${RECT}`)).removed).toContainEqual({
      kind: 'element',
      name: 'an element in another namespace',
      count: 1,
    })
  })
})

describe('what a drawing costs', () => {
  // Each shape counts the commands svg-to-pdfkit draws it with (limits.ts):
  // a move, a line or a close 1, a curve 3, an arc a curve per 60 degrees.
  test.each([
    ['a rect', RECT, 5],
    ['a rounded rect', '<rect width="10" height="10" rx="2"/>', 1 + 4 + 4 * 2 * 3 + 1],
    ['a circle', '<circle r="5"/>', 1 + 6 * 3 + 1],
    ['an ellipse', '<ellipse rx="5" ry="2"/>', 1 + 6 * 3 + 1],
    ['a line, stroked', '<line x2="5" stroke="red"/>', 2 * 3],
    ['a polygon', '<polygon points="0 0 5 0 5 5"/>', 4],
    ['a curve', '<path d="M0 0 C1 1 2 2 3 3"/>', 4],
  ])('%s costs its commands', (_, shape, segments) => {
    expect(cleaned(svg(shape)).segments).toBe(segments)
  })

  // A stroke costs a reader its outline twice more, three times in all
  // when the shape is filled too; a shape painted with nothing counts its
  // commands once, for the converter still builds it.
  test('a stroke counts its commands twice more', () => {
    expect(cleaned(svg(lines(9, ' fill="none" stroke="red"'))).segments).toBe(10 * 2)
    expect(cleaned(svg(lines(9, ' stroke="red"'))).segments).toBe(10 * 3)
    expect(cleaned(svg(`${lines(9, ' fill="none"')}${RECT}`)).segments).toBe(10 + 5)
  })

  // svg-to-pdfkit draws a clip path again for every element it clips, and
  // writes a gradient again for every shape painted with it, so neither is
  // counted once (0030).
  test('a clip path counts once per reference, a gradient its stops once per use', () => {
    const clip = `<clipPath id="c">${lines(99)}</clipPath>`
    expect(cleaned(svg(`${clip}${'<rect width="1" height="1" clip-path="url(#c)"/>'.repeat(3)}`)).segments).toBe(3 * 5 + 3 * 100)
    const gradient = `<linearGradient id="a">${'<stop/>'.repeat(10)}</linearGradient>`
    expect(cleaned(svg(`${gradient}<g fill="url(#a)">${RECT.repeat(3)}</g>`)).segments).toBe(3 * (5 + 10))
  })

  // A dash costs a reader what a segment does, and a dash array at a tiny
  // period on a long outline is hundreds of thousands of them: counted as
  // the outline over the period, an upper bound (0030). A dash array of
  // more entries draws more dashes a period: `1 2 3`, doubled as SVG
  // doubles it, is three dashes in each period of twelve.
  test('every dash a stroke could draw counts', () => {
    expect(cleaned(svg('<path d="M0 0 L100 0" fill="none" stroke="red" stroke-dasharray="1 1"/>')).segments).toBe(2 * 2 + 50)
    expect(cleaned(svg('<path d="M0 0 L120 0" fill="none" stroke="red" stroke-dasharray="1 2 3"/>')).segments).toBe(2 * 2 + 3 * (120 / 12))
    expect(refused(svg('<path d="M0 0 L100 0" fill="none" stroke="red" stroke-dasharray="0.001"/>')).code).toBe('too-large')
    // A dash array on what is not stroked draws no dash.
    expect(cleaned(svg('<path d="M0 0 L100 0 L0 1" stroke-dasharray="0.001"/>')).segments).toBe(3)
  })

  // Every clip, every group with an opacity under 1 and every translucent
  // gradient is a transparency group the size of the page, a translucent
  // gradient two (0030); a shape's own opacity is
  // folded into its colour, and a single stop is drawn as a colour.
  test('groups count what makes a page-sized transparency group', () => {
    const translucent = '<linearGradient id="t"><stop/><stop offset="1" stop-opacity="0.5"/></linearGradient>'
    const opaque = '<linearGradient id="o"><stop/><stop offset="1"/></linearGradient>'
    expect(cleaned(svg(`${translucent}<rect width="1" height="1" fill="url(#t)"/>`)).groups).toBe(2)
    expect(cleaned(svg(`${opaque}<rect width="1" height="1" fill="url(#o)" fill-opacity="0.5"/>`)).groups).toBe(2)
    expect(cleaned(svg(`${opaque}<rect width="1" height="1" fill="url(#o)" opacity="0.5"/>`)).groups).toBe(2)
    expect(cleaned(svg(`${opaque}<rect width="1" height="1" fill="url(#o)"/>`)).groups).toBe(0)
    expect(cleaned(svg('<linearGradient id="s"><stop stop-opacity="0.5"/></linearGradient><rect width="1" height="1" fill="url(#s)"/>')).groups).toBe(0)
    expect(cleaned(svg(`<g opacity="0.5">${RECT}</g><rect width="1" height="1" opacity="0.5"/>`)).groups).toBe(1)
    expect(refused(svg(`${translucent}<rect width="1" height="1" fill="url(#t)" stroke="url(#t)"/><g opacity="0.5">${RECT}</g>`)).code).toBe('too-large')
  })

  // What the converter draws each time, for the renderer's budget: moves,
  // lines and closes, curves, every element it reads and every stop it
  // writes. A clip path's shapes are read again for every element it
  // clips, and a gradient's stops written again for every shape painted
  // with it: counted once, a header logo of one clip path on a thousand
  // shapes, or of a 64-stop gradient on four hundred, would cost the
  // renderer on every page many times what its budget held it to.
  test('drawn counts what the converter draws, by kind', () => {
    expect(cleaned(svg('<circle r="5"/><rect width="1" height="1"/>')).drawn).toEqual({ lines: 2 + 5, curves: 6, elements: 3, stops: 0 })
    const clip = `<clipPath id="c">${RECT}${RECT}</clipPath>`
    // The root, the clip path, its two shapes, and three shapes each clipping it: 7 elements, and the clip path's two shapes again for each of the three.
    expect(cleaned(svg(`${clip}${'<rect width="2" height="2" clip-path="url(#c)"/>'.repeat(3)}`)).drawn).toEqual({
      lines: 3 * 5 + 3 * 2 * 5,
      curves: 0,
      elements: 7 + 3 * 2,
      stops: 0,
    })
    const gradient = `<linearGradient id="a">${'<stop/>'.repeat(4)}</linearGradient>`
    expect(cleaned(svg(`${gradient}<g fill="url(#a)" stroke="url(#a)">${RECT.repeat(3)}</g>`)).drawn.stops).toBe(3 * 2 * 4)
  })
})
