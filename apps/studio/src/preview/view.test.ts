import { MAX_ZOOM, MIN_ZOOM, PX_PER_PT } from '@formancy/report-builder-core'
import { describe, expect, test } from 'vitest'
import { count, fitZoom, pageOf } from './view.js'

describe("the viewer's numbers", () => {
  // Every number on the page is derived and printed through Intl
  // (CLAUDE.md): "1 pages" and a count printed without its grouping are
  // the typed-in strings that rule is against.
  test('say a count with its plural, through Intl', () => {
    expect(count(1, 'page', 'pages')).toBe('1 page')
    expect(count(2, 'page', 'pages')).toBe('2 pages')
    expect(count(1234, 'problem', 'problems')).toBe('1,234 problems')
    expect(pageOf(2, 12)).toBe('Page 2 of 12')
  })

  // Fit width: the page as wide as the paper's room, never wider -- a
  // preview that scrolled sideways at its opening zoom on a phone is the
  // failure -- and never past the zoom range the design view has.
  test('fits a page to the room it has, within the zoom range', () => {
    const a4 = 595.28
    expect(fitZoom(a4 * PX_PER_PT, a4)).toBe(1)
    expect(fitZoom(300, a4) * a4 * PX_PER_PT).toBeLessThanOrEqual(300)
    expect(fitZoom(300, a4)).toBe(0.37)
    expect(fitZoom(10, a4)).toBe(MIN_ZOOM)
    expect(fitZoom(100_000, a4)).toBe(MAX_ZOOM)
    expect(fitZoom(0, 0)).toBe(1)
  })
})
