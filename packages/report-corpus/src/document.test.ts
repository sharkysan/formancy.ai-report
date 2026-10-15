import { RenderRefusal as RuntimeRefusal } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { verifyRefusal } from './checks.js'
import { pageDimensions, RenderRefusal } from './document.js'
import { imageInvalid } from './fixtures/images.js'

describe('pageDimensions', () => {
  // Every margin check and every boundary fixture is computed from these
  // numbers. A4 written as Letter, or a landscape page left portrait, would
  // move each of them, and a check of "inside the margins" would pass or fail
  // for a page the document never asked for.
  test('gives A4 and Letter in points, and swaps them for landscape', () => {
    const margins = { top: 36, right: 40, bottom: 36, left: 40 }
    expect(pageDimensions({ size: 'A4', orientation: 'portrait', margins })).toEqual({ width: 595.28, height: 841.89 })
    expect(pageDimensions({ size: 'A4', orientation: 'landscape', margins })).toEqual({ width: 841.89, height: 595.28 })
    expect(pageDimensions({ size: 'Letter', orientation: 'portrait', margins })).toEqual({ width: 612, height: 792 })
    expect(pageDimensions({ size: 'Letter', orientation: 'landscape', margins })).toEqual({ width: 792, height: 612 })
  })
})

describe('RenderRefusal', () => {
  // A renderer refuses with the runtime's class, and the checks tell a
  // refusal from a crash by its class. A class of the corpus's own, however
  // alike, would make every refusal the renderer gives read as a crash, and
  // every fixture that expects one fail on a refusal that was right.
  test("is the runtime's own class, the one the checks recognise", () => {
    expect(RenderRefusal).toBe(RuntimeRefusal)
    expect(verifyRefusal(imageInvalid, new RuntimeRefusal('invalid-asset', 'the image asset logo-broken is not a PNG', 'logo-broken'))).toEqual([])
  })
})
