import { describe, expect, test } from 'vitest'
import { PAGE_SIZES, pageDimensions, printableArea } from './page.js'
import { mmToPt, ptToMm, roundPt } from './units.js'

describe('mmToPt and ptToMm', () => {
  // The one conversion every length goes through: an inch is 72 points and
  // 25.4 millimetres, both exactly.
  test('convert an inch exactly, both ways', () => {
    expect(mmToPt(25.4)).toBe(72)
    expect(ptToMm(72)).toBe(25.4)
  })

  // Lengths are stored to the hundredth of a point. A4's sides are the
  // values PDF engines use for it; 20 mm is the default margin.
  test('round points to the hundredth', () => {
    expect(mmToPt(20)).toBe(56.69)
    expect(mmToPt(210)).toBe(595.28)
    expect(mmToPt(297)).toBe(841.89)
    expect(roundPt(10.004999)).toBe(10)
    expect(roundPt(10.005001)).toBe(10.01)
  })

  // Rounding is symmetric about zero, so an offset to the left and the same
  // offset to the right are the same length; and it never returns -0, which
  // Object.is and a strict equality in a test would tell apart from 0.
  test('round symmetrically about zero and never return -0', () => {
    expect(mmToPt(-20)).toBe(-56.69)
    expect(roundPt(-10.005001)).toBe(-10.01)
    expect(Object.is(mmToPt(-0.001), 0)).toBe(true)
    expect(Object.is(ptToMm(-0.001), 0)).toBe(true)
  })

  // A length typed in millimetres to two decimals is stored in points and
  // shown in millimetres again. Over the whole first metre, it comes back
  // as typed: the editor never shows a value the author did not type.
  test('give back every millimetre value with two decimals up to a metre', () => {
    for (let hundredths = 0; hundredths <= 100_000; hundredths += 1) {
      const millimetres = hundredths / 100
      if (ptToMm(mmToPt(millimetres)) !== millimetres) expect(ptToMm(mmToPt(millimetres))).toBe(millimetres)
    }
  })
})

describe('page geometry', () => {
  // The renderer, the builder's rulers and the validator's margin check all
  // read the page's size here; three tables of sizes would disagree in the
  // second decimal.
  test('A4 and Letter in points, and landscape swaps the sides', () => {
    expect(PAGE_SIZES).toEqual({ A4: { width: 595.28, height: 841.89 }, Letter: { width: 612, height: 792 } })
    expect(pageDimensions({ size: 'A4', orientation: 'landscape' })).toEqual({ width: 841.89, height: 595.28 })
    expect(pageDimensions({ size: 'Letter', orientation: 'portrait' })).toEqual({ width: 612, height: 792 })
  })

  // The printable area is what the margins leave, to the hundredth: A4
  // less margins of 0.07 and 523.21 points is 72 exactly, where the
  // unrounded subtraction gives 71.99999999999989 and a margin check would
  // refuse a page that leaves exactly an inch.
  test('the printable area is the page less its margins, to the hundredth', () => {
    expect(595.28 - 0.07 - 523.21).toBeLessThan(72)
    const page = { size: 'A4', orientation: 'portrait', margins: { top: 10, right: 523.21, bottom: 20, left: 0.07 } } as const
    expect(printableArea(page)).toEqual({ width: 72, height: 811.89 })
  })
})
