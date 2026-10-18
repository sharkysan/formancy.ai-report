import { describe, expect, test } from 'vitest'
import { MAX_SVG_DASHES } from './limits.js'
import { SVG_NAMED_COLOURS } from './svg-colours.js'
import { SVG_ADVICE } from './svg-refusal.js'
import { cleaned, refused, svg } from './svg-test-support.js'

/** The attributes a cleaned rect is written with, after its geometry. */
function paint(attributes: string): string {
  const text = cleaned(svg(`<rect width="1" height="1" ${attributes}/>`)).text
  return /<rect width="1" height="1"([^/]*)\/>/.exec(text)?.[1]?.trim() ?? ''
}

describe('colours', () => {
  // Every colour is written as lower-case #rrggbb, the one form every
  // reader reads alike; svg-to-pdfkit's table of names lacks one CSS has,
  // so a name reaching it could print black.
  test.each([
    ['#ABC', '#aabbcc'],
    ['#A1b2C3', '#a1b2c3'],
    ['rgb(31,78,121)', '#1f4e79'],
    ['rgb( 300 , 0 , 0 )', '#ff0000'],
    ['rgb(10%, 20%, 30%)', '#1a334d'],
    ['rgb(100%,0%,50.5%)', '#ff0081'],
    ['YellowGreen', '#9acd32'],
    ['white', '#ffffff'],
  ])('%s is written %s', (colour, hex) => {
    expect(paint(`fill="${colour}"`)).toBe(`fill="${hex}"`)
  })

  // A colour with an alpha would have to become an opacity, a second
  // decision; hsl() and the system colours are not read (0030). Each is
  // refused rather than drawn in another colour.
  test.each(['#abcd', '#aabbccdd', 'rgba(1,2,3,0.5)', 'hsl(120, 50%, 50%)', 'hsla(1,2%,3%,.4)', 'transparent', 'ButtonText', 'rgb(1 2 3)', 'rgb(1,2%,3)', 'context-fill', '#ab', '#aabbc'])('%s is refused', (colour) => {
    expect(refused(svg(`<rect width="1" height="1" fill="${colour}"/>`))).toEqual({
      ok: false,
      code: 'unsupported',
      message: 'svg/rect@fill is a colour this format does not read: one with an alpha, hsl(), transparent or a system colour; write it as #rrggbb, with fill-opacity, stroke-opacity or stop-opacity for its alpha',
    })
  })

  // The table is CSS Color 4's 148 names, gray and grey alike; the
  // renderer's tests hold it equal to svg-to-pdfkit's.
  test('the named colours are CSS Color 4 s, each #rrggbb', () => {
    expect(SVG_NAMED_COLOURS.size).toBe(148)
    expect([...SVG_NAMED_COLOURS.values()].every((hex) => /^#[0-9a-f]{6}$/.test(hex))).toBe(true)
    expect([SVG_NAMED_COLOURS.get('rebeccapurple'), SVG_NAMED_COLOURS.get('grey'), SVG_NAMED_COLOURS.get('gray')]).toEqual(['#663399', '#808080', '#808080'])
  })

  // currentColor is the colour `color` gives, which is then not written;
  // with none given, a drawing's colour is black, as in an img.
  test('currentColor is written as the colour it stands for', () => {
    expect(paint('fill="currentColor" color="#123456"')).toBe('fill="#123456"')
    expect(paint('stroke="currentcolor"')).toBe('stroke="#000000"')
    expect(cleaned(svg('<g color="red"><rect width="1" height="1" fill="currentColor"/></g>')).text).toContain('fill="#ff0000"')
    expect(cleaned(svg('<linearGradient id="a" color="lime"><stop stop-color="currentColor"/></linearGradient><rect width="1" height="1" fill="url(#a)"/>')).text).toContain('stop-color="#00ff00"')
  })

  // An inherited currentColor is the keyword, so a child of another colour
  // paints in its own (CSS Color 4, 6.4); svg-to-pdfkit would paint it in
  // its parent's, so the child's paint is written on the child.
  test("a child of another colour paints an inherited currentColor in its own", () => {
    const text = cleaned(svg('<g fill="currentColor" color="red"><rect width="1" height="1"/><rect width="2" height="2" color="blue"/><rect width="3" height="3" color="red"/></g>')).text
    expect(text).toBe(svg('<g fill="#ff0000"><rect width="1" height="1"/><rect width="2" height="2" fill="#0000ff"/><rect width="3" height="3"/></g>'))
  })
})

describe('opacities, widths and keywords', () => {
  // SVG clamps an opacity, an offset and a percentage to 0..1; written as
  // the number it comes to.
  test.each([
    ['opacity="50%"', 'opacity="0.5"'],
    ['fill-opacity="1.5"', 'fill-opacity="1"'],
    ['stroke-opacity="-2"', 'stroke-opacity="0"'],
    ['opacity=".25"', 'opacity="0.25"'],
    // Past nine places a percentage is the float, its shortest round trip.
    ['opacity="50.12345678%"', `opacity="${50.12345678 / 100}"`],
  ])('%s is written %s', (attribute, expected) => {
    expect(paint(attribute)).toBe(expected)
  })

  // Units are converted at CSS's 96 to the inch, as svg-to-pdfkit converts
  // them; a unit of a font or a viewport has nothing to resolve against.
  test.each([
    ['stroke-width="10mm"', `stroke-width="${10 * (96 / 25.4)}"`],
    ['stroke-width="1in"', 'stroke-width="96"'],
    ['stroke-width="3pt"', 'stroke-width="4"'],
    ['stroke-width="1pc"', 'stroke-width="16"'],
    ['stroke-width="2.54cm"', 'stroke-width="96"'],
    ['stroke-width="2PX"', 'stroke-width="2"'],
  ])('%s is written %s', (attribute, expected) => {
    expect(paint(attribute)).toBe(expected)
  })

  test.each(['stroke-width="1em"', 'stroke-width="2vw"', 'stroke-width="5%"', 'stroke-width="1 px"', 'stroke-width="x"'])('%s is refused', (attribute) => {
    expect(refused(svg(`<rect width="1" height="1" ${attribute}/>`)).code).toBe('unsupported')
  })

  // A negative width or a miter limit under 1 is an error SVG does not
  // draw.
  test('a negative width and a miter limit under 1 are refused as out of range', () => {
    expect(refused(svg('<rect width="1" height="1" stroke-width="-1"/>')).code).toBe('out-of-range')
    expect(refused(svg('<rect width="1" height="1" stroke-miterlimit="0.5"/>')).code).toBe('out-of-range')
  })

  // Keywords are read in any case, as CSS reads them, and written in one;
  // a value the converter would draw otherwise is refused, named.
  test.each([
    ['stroke-linejoin="ROUND"', 'stroke-linejoin="round"'],
    ['fill-rule="EvenOdd"', 'fill-rule="evenodd"'],
    ['stroke-linecap="square"', 'stroke-linecap="square"'],
    ['clip-rule="nonzero"', 'clip-rule="nonzero"'],
  ])('%s is written %s', (attribute, expected) => {
    expect(paint(attribute)).toBe(expected)
  })

  test.each([
    ['stroke-linejoin="arcs"', 'svg/rect@stroke-linejoin is a line join svg-to-pdfkit does not draw; use miter, round or bevel'],
    ['visibility="hidden"', 'svg/rect@visibility is hidden; remove what is hidden, or show it'],
    ['vector-effect="non-scaling-stroke"', 'svg/rect@vector-effect is a stroke whose width depends on the box it is drawn in; expand the stroke'],
    ['fill-rule="odd"', `svg/rect@fill-rule is not a value of fill-rule this format reads; ${SVG_ADVICE.unsupported}`],
    ['display="flex"', `svg/rect@display is not a value of display this format reads; ${SVG_ADVICE.unsupported}`],
    ['opacity="inherit"', 'svg/rect@opacity inherits a property that does not inherit; give it its value'],
    ['fill="initial"', 'svg/rect@fill is a CSS-wide keyword; give it its value'],
  ])('%s is refused', (attribute, message) => {
    expect(refused(svg(`<rect width="1" height="1" ${attribute}/>`))).toEqual({ ok: false, code: 'unsupported', message })
  })

  // Values that draw as though absent are read and not written: inherit on
  // what inherits, the visible visibility, no vector effect, a display that
  // shows.
  test('values that draw as though absent are not written', () => {
    expect(paint('fill="inherit" visibility="visible" vector-effect="none" display="inline" color="red"')).toBe('')
  })
})

describe('clip-path', () => {
  // A paint may follow its url with a fallback; a clip-path has none, and
  // what follows its url is not a clip-path a browser reads: refused, not
  // read as the url alone.
  test('what follows a clip path url is refused', () => {
    const clip = '<clipPath id="c"><rect width="1" height="1"/></clipPath>'
    expect(cleaned(svg(`${clip}<rect width="1" height="1" clip-path="url(#c) "/>`)).text).toContain('clip-path="url(#c1)"')
    expect(refused(svg(`${clip}<rect width="1" height="1" clip-path="url(#c) red"/>`))).toEqual({ ok: false, code: 'unsupported', message: 'svg/rect@clip-path is not none or url(#id); write it as none or url(#id)' })
  })
})

describe('dash arrays', () => {
  // An odd list is doubled as SVG doubles it, written doubled, so neither
  // reader relies on doing so; all zeros is the solid line SVG draws.
  test('an odd list is doubled, all zeros is none', () => {
    expect(paint('stroke-dasharray="1, 2 3"')).toBe('stroke-dasharray="1 2 3 1 2 3"')
    expect(paint('stroke-dasharray="0 0"')).toBe('stroke-dasharray="none"')
    expect(paint('stroke-dasharray="none"')).toBe('stroke-dasharray="none"')
    expect(paint('stroke-dashoffset="-2mm"')).toBe(`stroke-dashoffset="${-2 * (96 / 25.4)}"`)
  })

  // A dash array is bounded after doubling, so the written form is never
  // past the bound a second cleaning holds it to.
  test('a dash array at the bound is read, past it refused, counted doubled', () => {
    const dashes = (count: number): string => Array.from({ length: count }, () => '1').join(' ')
    expect(paint(`stroke-dasharray="${dashes(MAX_SVG_DASHES)}"`)).toBe(`stroke-dasharray="${dashes(MAX_SVG_DASHES)}"`)
    expect(refused(svg(`<rect width="1" height="1" stroke-dasharray="${dashes(MAX_SVG_DASHES + 2)}"/>`))).toEqual({
      ok: false,
      code: 'too-large',
      message: `svg/rect@stroke-dasharray has more than ${MAX_SVG_DASHES} dashes; give it at most ${MAX_SVG_DASHES} entries`,
    })
    expect(refused(svg(`<rect width="1" height="1" stroke-dasharray="${dashes(MAX_SVG_DASHES / 2 + 1)}"/>`)).code).toBe('too-large')
  })

  test.each(['1,,2', '1 -2', ',1', '1 x'])('%s is refused', (dashes) => {
    expect(refused(svg(`<rect width="1" height="1" stroke-dasharray="${dashes}"/>`)).code).toMatch(/unsupported|out-of-range/)
  })
})
