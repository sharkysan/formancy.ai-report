import { describe, expect, test } from 'vitest'
import { MAX_SVG_COORDINATE } from './limits.js'
import { readNumber, writeNumber } from './svg-number.js'
import { floats, measure, readPath, writePath } from './svg-path.js'
import { SVG_ADVICE } from './svg-refusal.js'
import { cleaned, refused, svg } from './svg-test-support.js'

/** The path data a cleaned `<path d=…>` is written with. */
function written(d: string): string {
  return writePath(readPath(d, 'test'))
}

describe('numbers', () => {
  // JavaScript writes no exponent between 10^-6 and 10^21, and svg-to-pdfkit
  // and sax read exponents differently, so nothing below a millionth -- a
  // millionth of a unit of a viewBox at least one wide -- is written, and
  // no -0, NaN or Infinity reaches the output.
  test('a magnitude under a millionth is written as 0, and so is -0', () => {
    expect(['1e-7', '-0', '0.0000009', '-1e-300', '0'].map((text) => writeNumber(readNumber(text, 'test')))).toEqual(['0', '0', '0', '0', '0'])
    expect(['0.000001', '1.5e-3', '1E2', '+5', '.5', '5.', '0012.50'].map((text) => writeNumber(readNumber(text, 'test')))).toEqual(['0.000001', '0.0015', '100', '5', '0.5', '5', '12.5'])
  })

  // PDFKit throws `unsupported number` past 10^21, naming no asset; a
  // number past MAX_SVG_COORDINATE is refused here, naming where, and the
  // bound itself is a number a drawing may hold.
  test('a number at the bound is read, one past it refused', () => {
    expect(writeNumber(readNumber('999999.999999999', 'test'))).toBe('999999.999999999')
    expect(cleaned(svg(`<rect width="${MAX_SVG_COORDINATE}" height="1"/>`)).text).toContain(`width="${MAX_SVG_COORDINATE}"`)
    expect(refused(svg(`<rect width="${MAX_SVG_COORDINATE}.000001" height="1"/>`))).toEqual({ ok: false, code: 'out-of-range', message: `svg/rect@width holds a number past ${MAX_SVG_COORDINATE}; ${SVG_ADVICE['out-of-range']}` })
    expect(refused(svg(`<rect width="-${MAX_SVG_COORDINATE + 1}" height="1"/>`)).code).toBe('out-of-range')
    expect(refused(svg('<rect width="1e30" height="1"/>')).code).toBe('out-of-range')
    expect(refused(svg('<rect width="1e400" height="1"/>')).code).toBe('out-of-range')
  })

  // Relative steps sum exactly (svg-number.ts): `l.1.2` repeated reaches
  // 0.3, never 0.30000000000000004, so the written form grows no digits
  // the author did not write, and moves no point the author drew.
  test('relative steps sum to their exact decimal sum', () => {
    expect(written('M0 0 l.1.2 .2.1')).toBe('M0 0 L0.1 0.2 L0.3 0.3')
    expect(written(`M0 0 l${'.1 .1 '.repeat(30)}`).split(' ').slice(-2)).toEqual(['L3', '3'])
    // Past nine places the float is written, as its shortest round trip.
    expect(written('M0 0 l0.1234567891 0 0.1 0')).toBe('M0 0 L0.1234567891 0 L0.2234567891 0')
  })

  // A path that walks off the page by relative steps is refused where it
  // leaves, as one that starts there is.
  test('a relative path past the bound is refused', () => {
    expect(cleaned(svg(`<path d="M999999 0 l1 0"/>`)).text).toContain(`L${MAX_SVG_COORDINATE} 0`)
    expect(refused(svg(`<path d="M999999 0 l1.000001 0"/>`))).toMatchObject({ code: 'out-of-range', message: `svg/path@d reaches a point past ${MAX_SVG_COORDINATE}; ${SVG_ADVICE['out-of-range']}` })
  })
})

describe('path data', () => {
  // SVG 2's grammar, as the files that use its corners write it: implicit
  // repetition after a move (a line), and after any other command (the
  // same command), the compact arc flags, numbers run together by a sign
  // or a point, relative commands, and S and T reflecting.
  test.each([
    ['M10 10 20 20 30 10', 'M10 10 L20 20 L30 10'],
    ['m10 10 10 10', 'M10 10 L20 20'],
    ['M0,0L10,10,20,0', 'M0 0 L10 10 L20 0'],
    ['M0-1-2-3', 'M0 -1 L-2 -3'],
    ['M.5.5.5.5', 'M0.5 0.5 L0.5 0.5'],
    ['M1 1 h5 v5 H0 V0 z', 'M1 1 H6 V6 H0 V0 Z'],
    ['M0 0 c1 1 2 2 3 3 s1 1 2 2', 'M0 0 C1 1 2 2 3 3 S4 4 5 5'],
    ['M0 0 q1 1 2 2 t2 2', 'M0 0 Q1 1 2 2 T4 4'],
    ['M0 0 a1 1 0 00 1 1', 'M0 0 A1 1 0 0 0 1 1'],
    ['M0 0a5 5 30 1 1 10 10', 'M0 0 A5 5 30 1 1 10 10'],
    ['M0 0 a1,1,0,1,0,2,2', 'M0 0 A1 1 0 1 0 2 2'],
    ['M0 0 L1 1 Z m1 1 l1 1', 'M0 0 L1 1 Z M1 1 L2 2'],
    ['  M 1e1 1E-1  ', 'M10 0.1'],
  ])('%s is written %s', (d, expected) => {
    expect(written(d)).toBe(expected)
    // Read again, the written form is itself.
    expect(written(expected)).toBe(expected)
  })

  // SVG would draw up to the error; a path drawn only partly is not the
  // author's, so malformed data is refused whole.
  test.each(['M0 0 L', 'L0 0', 'M0 0 Z 5', 'M0,', 'M0 0,,1 1', 'M0 0 X1 1', 'M0 0 A1 1 0 2 0 1 1', 'M,0 0', 'M0 0 L1 1,', 'M0 0 L1e 1'])('%s is refused whole', (d) => {
    expect(refused(svg(`<path d="${d}"/>`))).toEqual({ ok: false, code: 'unsupported', message: 'svg/path@d is malformed path data; save the drawing again from the program it was made in' })
  })

  // A path with no data draws nothing, as SVG says, and is removed rather
  // than written.
  test('a path with no data is removed', () => {
    const result = cleaned(svg('<path d=" "/><path/><rect width="1" height="1"/>'))
    expect(result.text).not.toContain('<path')
    expect(result.removed).toContainEqual({ kind: 'element', name: 'path', count: 2 })
  })
})

describe('what a path costs', () => {
  // The converter's own construction, replayed: the counts limits.ts
  // weights are of what svg-to-pdfkit draws, so a bound set on them holds
  // for what is drawn.
  test('a line, a close and a move are a command each, a curve one curve', () => {
    expect(measure(floats(readPath('M0 0 L3 4 Z', 'test')))).toEqual({ moves: 1, lines: 2, curves: 0, length: 10, box: [0, 0, 3, 4] })
    expect(measure(floats(readPath('M0 0 C0 1 1 1 1 0 S2 -1 2 0 Q3 1 4 0 T6 0', 'test')))).toMatchObject({ moves: 1, lines: 0, curves: 4 })
  })

  // A gradient in its box is scaled to the shape's box (svg-transform.ts),
  // so the box measured is never smaller than the outline: a curve's
  // control points and a reflected one are held, and an arc is held to the
  // circle about its centre that holds the control points of the curves
  // the converter draws it with, however it sweeps.
  test("the box holds every point of the outline", () => {
    expect(measure(floats(readPath('M0 0 C0 5 4 5 4 0', 'test'))).box).toEqual([0, 0, 4, 5])
    expect(measure(floats(readPath('M0 0 C0 5 4 5 4 0 S8 -5 8 0', 'test'))).box).toEqual([0, -5, 8, 5])
    const [left, top, right, bottom] = measure(floats(readPath('M0 0 A5 5 0 0 1 10 0', 'test'))).box
    expect(left <= 0 && top <= -5 && right >= 10 && bottom >= 0).toBe(true)
  })

  // The converter's curves bulge past the ellipse they stand for: an arc
  // of the unit circle from 21 degrees round to (1, 0), the long way, is
  // drawn in curves that reach x = -1.0000162 near the half turn, where the
  // box of its ellipse's diameter about its end stops at -1 (measured on
  // 18 October 2026 by replaying `source.js`'s arc). Their control points
  // lie within hypot(1, 4/3 × tan 15°), 1.0619, of the centre, for a curve
  // per 60 degrees at most, and the box holds that circle.
  test("an arc's box holds the curves the converter draws it with", () => {
    const [left, top, right, bottom] = measure(floats(readPath('M0.933580426 0.35836795 A1 1 0 1 1 1 0', 'test'))).box
    expect(left).toBeLessThan(-1.0000162)
    expect([left, top, right, bottom].every((side) => Math.abs(side) < 1.062)).toBe(true)
  })

  // svg-to-pdfkit draws an arc as one curve per 60 degrees at its default
  // precision (source.js:1054, 2628), a line when a radius is zero, and
  // nothing when it ends where it starts. That one is counted a line all
  // the same: counted nothing, a mebibyte of such arcs cost seven
  // segments, and every reader of the file reads every byte of it.
  test('an arc is a curve per 60 degrees, a line with no radius or when it ends where it starts', () => {
    const arc = (d: string): number => measure(floats(readPath(d, 'test'))).curves
    expect(arc('M0 0 A5 5 0 0 1 10 0')).toBe(3)
    expect(arc('M0 0 A5 5 0 0 1 5 5')).toBe(2)
    expect(arc('M0 0 A10 10 0 0 1 1 0')).toBe(1)
    expect(arc('M0 0 A5 5 0 1 1 0.0001 0')).toBe(6)
    // Radii too small to reach the end are scaled up, as SVG says, to a half turn.
    expect(arc('M0 0 A1 1 0 0 1 10 0')).toBe(3)
    expect(measure(floats(readPath('M0 0 A0 5 0 0 1 10 0', 'test')))).toMatchObject({ lines: 1, curves: 0 })
    expect(measure(floats(readPath('M3 3 A5 5 0 0 1 3 3', 'test')))).toMatchObject({ moves: 1, lines: 1, curves: 0 })
  })

  // S reflects the last control point only after C or S, T only after Q
  // or T, as the converter does; a wrong reflection would bound a dash
  // count on another outline than the one drawn.
  test('the outline length follows the converter reflecting or not', () => {
    const length = (d: string): number => Math.round(measure(floats(readPath(d, 'test'))).length * 1000) / 1000
    expect(length('M0 0 C0 1 1 1 1 0 S2 -1 2 0')).toBe(length('M0 0 C0 1 1 1 1 0 C1 -1 2 -1 2 0'))
    expect(length('M0 0 L1 0 S2 -1 2 0')).toBe(length('M0 0 L1 0 C1 0 2 -1 2 0'))
  })
})

describe('transforms', () => {
  // Every SVG 1.1 transform function, composed left to right into one
  // matrix, the identity not written: what the converter composes too.
  test.each([
    ['translate(10)', 'matrix(1 0 0 1 10 0)'],
    ['translate(10, 20)', 'matrix(1 0 0 1 10 20)'],
    ['scale(2)', 'matrix(2 0 0 2 0 0)'],
    ['scale(2 3)', 'matrix(2 0 0 3 0 0)'],
    ['rotate(90)', 'matrix(0 1 -1 0 0 0)'],
    ['rotate(90 10 10)', 'matrix(0 1 -1 0 20 0)'],
    ['skewX(45)', 'matrix(1 0 0.9999999999999999 1 0 0)'],
    ['skewY(45)', 'matrix(1 0.9999999999999999 0 1 0 0)'],
    ['matrix(1,0,0,1,5,5)', 'matrix(1 0 0 1 5 5)'],
    ['translate(10 0) scale(2)', 'matrix(2 0 0 2 10 0)'],
    ['translate(1)scale(2) , rotate(0)', 'matrix(2 0 0 2 1 0)'],
  ])('%s is written %s', (transform, expected) => {
    expect(cleaned(svg(`<rect width="1" height="1" transform="${transform}"/>`)).text).toContain(`transform="${expected}"`)
  })

  test('the identity is not written', () => {
    expect(cleaned(svg('<rect width="1" height="1" transform="translate(0) scale(1) rotate(0)"/>')).text).not.toContain('transform')
  })

  // CSS's functions and units are not SVG's, and svg-to-pdfkit reads none
  // of them; a matrix that flattens the drawing draws nothing a reader
  // shows, and a reader may refuse it.
  test.each(['rotate(30deg)', 'translateX(10)', 'translate(10px)', 'scale(1 2 3)', 'matrix(1 0 0 1)', 'translate(1),', 'translate(1) x'])('%s is refused', (transform) => {
    expect(refused(svg(`<rect width="1" height="1" transform="${transform}"/>`)).code).toBe('unsupported')
  })

  test('a transform that flattens is refused', () => {
    expect(refused(svg('<rect width="1" height="1" transform="scale(0 1)"/>'))).toEqual({ ok: false, code: 'out-of-range', message: 'svg/rect@transform flattens what it transforms to nothing; remove what it flattens, or give the transform an area' })
  })

  // With every point and every composed entry under the bound, every
  // coordinate the converter computes stays below PDFKit's 10^21.
  test('a composed transform past the bound is refused', () => {
    expect(refused(svg('<g transform="scale(1000)"><rect width="1" height="1" transform="scale(1000.001)"/></g>'))).toEqual({
      ok: false,
      code: 'out-of-range',
      message: `svg/g/rect is transformed past ${MAX_SVG_COORDINATE}; ${SVG_ADVICE['out-of-range']}`,
    })
    expect(cleaned(svg('<g transform="scale(1000)"><rect width="1" height="1" transform="scale(1000)"/></g>')).ok).toBe(true)
  })

  // PDFKit writes a gradient's pattern under the matrix its shape is drawn
  // under, the shape's box when the gradient is drawn in it, and the
  // gradient's own transform: three matrices each within the bound compose
  // to a million cubed, and a group turned and scaled a millionfold,
  // painting a shape a million wide with a gradient of the same transform,
  // threw `unsupported number` from inside PDFKit in a box 550 points wide.
  // The three are composed where the shape is drawn, and refused past the
  // bound, in its box or in user space.
  test("a gradient transformed past the bound where its shape is drawn is refused", () => {
    const turned = (scale: number, units = ''): string =>
      svg(
        `<linearGradient id="g"${units} gradientTransform="matrix(${scale} ${scale} -${scale} ${scale} 0 0)"><stop/><stop offset="1" stop-color="#f00"/></linearGradient>` +
          `<g transform="matrix(${scale} ${scale} -${scale} ${scale} 0 0)"><rect width="${scale}" height="${scale}" fill="url(#g)"/></g>`,
      )
    expect(refused(turned(1_000_000))).toEqual({ ok: false, code: 'out-of-range', message: `svg/g/rect paints a gradient transformed past ${MAX_SVG_COORDINATE}; ${SVG_ADVICE['out-of-range']}` })
    expect(refused(turned(1000, ' gradientUnits="userSpaceOnUse"').replace('<rect width="1000"', '<rect width="1"')).code).toBe('out-of-range')
    expect(cleaned(turned(10)).ok).toBe(true)
    // The same drawing, its rect painted in one colour, draws no pattern and is accepted.
    expect(cleaned(turned(1000).replace('fill="url(#g)"', 'fill="#f00"')).ok).toBe(true)
  })

  // The box the converter draws a gradient in is its outline's, which lies
  // anywhere inside the box of a curve's control points the cleaner holds,
  // so the gradient's matrix is bounded over every box inside that one. A
  // curve from 10^6 out to -10^6 and back, scaled by 200,000 and painted
  // with a gradient moved on half its box's width: in the cleaner's box its
  // translation is 0, but the converter's box starts at -500,000, and it
  // wrote a pattern matrix of 5 × 10^12 in a box of 100 points, measured on
  // 18 October 2026. Over every box inside the cleaner's the translation
  // reaches 2 × 10^11, and it is refused; unscaled, 10^6, and drawn.
  test("a gradient that passes the bound in a box inside its shape's is refused", () => {
    const curved = (scale: string): string =>
      svg(
        '<linearGradient id="g" gradientTransform="matrix(0.000002 0 0 1 0.5 0)"><stop/><stop offset="1" stop-color="#f00"/></linearGradient>' +
          `<g transform="scale(${scale})"><path d="M1000000 0 C-1000000 0 -1000000 1 1000000 1 Z" fill="url(#g)"/></g>`,
      )
    expect(refused(curved('200000'))).toEqual({ ok: false, code: 'out-of-range', message: `svg/g/path paints a gradient transformed past ${MAX_SVG_COORDINATE}; ${SVG_ADVICE['out-of-range']}` })
    expect(cleaned(curved('1')).ok).toBe(true)
  })

  // svg-to-pdfkit inverts the matrix a clip or a group opacity is drawn
  // under, to find the page's box in its user space: under two scales of a
  // millionth that box's corners pass 10^21, and PDFKit threw `unsupported
  // number` from inside pdfmake, an error and not a refusal, for an asset
  // the cleaner had approved. A matrix that shrinks past the bound's
  // reciprocal is refused as one that magnifies past it is.
  test('a composed transform that shrinks past the bound is refused', () => {
    expect(refused(svg('<g transform="scale(0.001)"><rect width="1" height="1" transform="scale(0.0009)"/></g>'))).toEqual({
      ok: false,
      code: 'out-of-range',
      message: `svg/g/rect shrinks what it transforms, or flattens it, past a factor of ${MAX_SVG_COORDINATE}; ${SVG_ADVICE['out-of-range']}`,
    })
    // A shear that all but flattens: its own entries are ordinary, its inverse's ten million.
    expect(refused(svg('<g transform="matrix(1 1 1 1.0000001 0 0)"><rect width="1" height="1"/></g>')).code).toBe('out-of-range')
    expect(cleaned(svg('<g transform="scale(0.001)"><rect width="1" height="1" transform="scale(0.001)"/></g>')).ok).toBe(true)
  })
})
