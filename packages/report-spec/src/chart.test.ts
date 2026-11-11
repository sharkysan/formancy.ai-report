import { expect, test } from 'vitest'
import { CHART_PALETTE } from './chart.js'

/** WCAG 2.x relative luminance of a #rrggbb colour, sRGB linearised, and its contrast with white paper. */
function contrastWithWhite(color: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(color.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
}

// A series drawn in a colour that does not stand out from white paper is a
// series a reader cannot find (WCAG 2.2 1.4.11).
test.each(CHART_PALETTE)('%s contrasts at least 3:1 with white', (color) => {
  expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(3)
})

// Two series of one colour are told apart by nothing, and a colour the
// validator's COLOR pattern refuses could not be written back.
test('names eight colours, each once, each lower-case #rrggbb', () => {
  expect(new Set(CHART_PALETTE).size).toBe(8)
  for (const color of CHART_PALETTE) expect(color).toMatch(/^#[0-9a-f]{6}$/)
})
