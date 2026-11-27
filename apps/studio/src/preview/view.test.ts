import { MAX_ZOOM, MIN_ZOOM, PX_PER_PT } from '@formancy/report-builder-core'
import { QR_BILL_SIZE } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { BILL_ZOOM_FLOOR, billScroll, billZoom, count, fitZoom, pageOf, slipHeight } from './view.js'

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

  // The slip is report-spec's QR_BILL_SIZE, 105 mm, at whatever zoom the
  // page is drawn at: a height taken from anything else -- the page's, the
  // receipt's -- would open the paper on a box the renderer drew nothing in.
  test('says how tall a QR-bill’s slip stands on the paper at a zoom', () => {
    expect(slipHeight(1)).toBeCloseTo(QR_BILL_SIZE.height * PX_PER_PT, 9)
    expect(slipHeight(0.5)).toBeCloseTo(slipHeight(1) / 2, 9)
  })

  // A document with a QR-bill opens at fit width where its slip fits the
  // paper's view there (0090). Where it does not -- a 1280 by 720 window,
  // measured, has 260 pixels of paper for a 278 pixel slip -- the zoom is
  // the largest at which it does, to the hundredth below, so the slip is
  // never a pixel taller than its view; never past fit width, which would
  // scroll the page sideways; and never under half, at which a 10 pt line
  // is 6.7 pixels high: a window too short for that keeps the page
  // readable and shows the slip from its top.
  test('opens a QR-bill at fit width where its slip fits, and else at the largest zoom it fits at, never under half or past fit', () => {
    expect(billZoom(0.7, 600)).toBe(0.7)
    expect(billZoom(0.7, slipHeight(0.7))).toBe(0.7)
    const shorter = billZoom(0.7, 240)
    expect(shorter).toBe(0.6)
    expect(slipHeight(shorter)).toBeLessThanOrEqual(240)
    expect(slipHeight(shorter + 0.01)).toBeGreaterThan(240)
    expect(billZoom(0.7, 100)).toBe(BILL_ZOOM_FLOOR)
    expect(BILL_ZOOM_FLOOR).toBe(0.5)
    expect(billZoom(0.4, 100)).toBe(0.4)
  })

  // The slip is the last thing on the paper, at the foot of the last page,
  // above the paper's padding (0022). Where it fits the view the paper opens
  // scrolled to its end, the slip's foot at the view's; where it does not,
  // its top at the view's top, so the title and the Swiss QR Code are in
  // view rather than the amount alone; and a paper that holds its pages
  // whole is not scrolled at all.
  test('opens the paper with the slip in view: at its end where the slip fits, at the slip’s top where it does not', () => {
    expect(billScroll({ scrollHeight: 1000, clientHeight: 400 }, 20, 300)).toBe(600)
    expect(billScroll({ scrollHeight: 1000, clientHeight: 400 }, 20, 500)).toBe(1000 - 20 - 500)
    expect(billScroll({ scrollHeight: 300, clientHeight: 400 }, 20, 200)).toBe(0)
  })
})
