import { pageDimensions, printableArea, REGION_NAMES } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { clampZoom, MAX_ZOOM, MIN_ZOOM, PX_PER_PT, zoomedIn, zoomedOut, ZOOM_STEPS } from './geometry.js'
import type { EditorOutcome } from './model-actions.js'
import type { Box, CanvasBox } from './model-canvas.js'
import { editorOver, richReport } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

/** Whether `inner` lies within `outer`, to the hundredth of a point that rounding leaves. */
function inside(inner: Box, outer: Box): boolean {
  const slack = 0.02
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.width <= outer.x + outer.width + slack &&
    inner.y + inner.height <= outer.y + outer.height + slack
  )
}

function boxOf(boxes: readonly CanvasBox[], key: string): CanvasBox {
  const found = boxes.find((box) => box.key === key)
  if (found === undefined) throw new Error(`no box ${key}`)
  return found
}

describe('zoom', () => {
  // One range for both builders, so a zoom that one allows the other
  // cannot refuse.
  test('is clamped to its range, and steps through the presets', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(1.1)).toBe(1.1)
    expect(ZOOM_STEPS[0]).toBe(MIN_ZOOM)
    expect(ZOOM_STEPS.at(-1)).toBe(MAX_ZOOM)
    expect(zoomedIn(1)).toBe(1.25)
    expect(zoomedIn(1.1)).toBe(1.25)
    expect(zoomedIn(MAX_ZOOM)).toBe(MAX_ZOOM)
    expect(zoomedOut(1)).toBe(0.75)
    expect(zoomedOut(1.1)).toBe(1)
    expect(zoomedOut(MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  // CSS has 96 pixels to the inch and PDF 72 points: at 100 % a point is
  // four thirds of a pixel, so an A4 page is as wide on screen as on paper.
  test('converts points to CSS pixels at four thirds of a pixel per point', () => {
    expect(PX_PER_PT).toBeCloseTo(4 / 3, 12)
  })
})

describe('the page', () => {
  // The rulers, the canvas and a host's own chrome read the page from one
  // place, in points as stored and in pixels as drawn.
  test('is given in points and in pixels at the zoom', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'setZoom', zoom: 2 }))
    const { page } = editor.state().document
    expect(page).toMatchObject({ size: 'A4', orientation: 'portrait', width: 595.28, height: 841.89, printable: { width: 481.9, height: 728.51 } })
    expect(page.px.width).toBeCloseTo(595.28 * 2 * PX_PER_PT, 2)
    expect(page.px.margins.left).toBeCloseTo(56.69 * 2 * PX_PER_PT, 2)
  })

  // Landscape swaps the sides, as report-spec's pageDimensions does.
  test('turns with its orientation', () => {
    const report = richReport()
    const { editor } = editorOver({ ...report, page: { ...report.page, orientation: 'landscape' } })
    expect(editor.state().document.page).toMatchObject(pageDimensions({ size: 'A4', orientation: 'landscape' }))
  })

  // The summary counts components in each region, those in containers too,
  // as the format's region budget counts them.
  test('summarises each region with its label and count', () => {
    const { editor } = editorOver()
    expect(editor.state().document.regions.map((region) => [region.region, region.label, region.count])).toEqual([
      ['reportHeader', 'Report header', 4],
      ['pageHeader', 'Page header', 1],
      ['body', 'Body', 9],
      ['pageFooter', 'Page footer', 1],
      ['summary', 'Summary', 3],
    ])
  })
})

describe('the canvas', () => {
  // Plan 8: a one-row design surface may produce many printed pages, and
  // the difference has to be explicit where a person looks.
  test('says it is not the PDF', () => {
    const { editor } = editorOver()
    expect(editor.state().canvas.label).toBe('Design view, not the PDF')
    expect(editor.state().canvas.note).toMatch(/PDF preview/)
  })

  // Each region is a band within the margins, in reading order, the next
  // below the last: a region boundary is where one band ends.
  test('stacks the regions as bands within the margins, in reading order', () => {
    const report = richReport()
    const { editor } = editorOver(report)
    const { regions, sheet } = editor.state().canvas
    const printable = printableArea(report.page)
    expect(regions.map((region) => region.region)).toEqual([...REGION_NAMES])
    let bottom = report.page.margins.top
    for (const region of regions) {
      expect(region.pt.x).toBe(report.page.margins.left)
      expect(region.pt.width).toBe(printable.width)
      expect(region.pt.y).toBeGreaterThanOrEqual(bottom)
      expect(region.pt.height).toBeGreaterThan(0)
      bottom = region.pt.y + region.pt.height
    }
    expect(sheet.pt.width).toBe(595.28)
    expect(sheet.pt.height).toBeGreaterThanOrEqual(Math.max(841.89, bottom + report.page.margins.bottom) - 0.01)
  })

  // An empty region is still a band, so it can be seen, and dropped into.
  test('keeps an empty region as a band that says it is empty', () => {
    const report = richReport()
    const { editor } = editorOver({ ...report, regions: { ...report.regions, summary: [] } })
    const summary = editor.state().canvas.regions.find((region) => region.region === 'summary')
    expect(summary?.empty).toBe(true)
    expect(summary?.pt.height).toBeGreaterThan(0)
  })

  // A box outside its container would be selected by a click on its
  // neighbour; every box lies in its band, and every child in its parent.
  test('puts every box in its region’s band and its container’s box', () => {
    const { editor } = editorOver()
    const { boxes, regions } = editor.state().canvas
    const band = (key: string): Box => {
      const region = editor.state().outline.find((candidate) => JSON.stringify(candidate.nodes).includes(`"key":"${key}"`))?.region
      return regions.find((candidate) => candidate.region === region)?.pt as Box
    }
    for (const box of boxes) if (!box.overflows) expect(inside(box.pt, band(box.key)), box.key).toBe(true)
    for (const [child, parent] of [
      ['logo-image', 'heading'],
      ['title', 'heading'],
      ['note', 'notes'],
      ['box', 'notes'],
      ['kept', 'keep'],
      ['lines/sku', 'lines'],
      ['lines/amount', 'lines'],
    ] as const) {
      expect(inside(boxOf(boxes, child).pt, boxOf(boxes, parent).pt), `${child} in ${parent}`).toBe(true)
    }
  })

  // A flow is a flow: each block of a list starts where the one before it
  // ends.
  test('stacks a list’s blocks one below the other', () => {
    const { editor } = editorOver()
    const { boxes } = editor.state().canvas
    const ids = ['intro', 'gap', 'lines', 'notes', 'keep', 'break']
    for (const [index, id] of ids.slice(1).entries()) {
      const above = boxOf(boxes, ids[index] as string).pt
      expect(boxOf(boxes, id).pt.y, id).toBeCloseTo(above.y + above.height, 2)
    }
    expect(boxOf(boxes, 'gap').pt.height).toBe(12)
  })

  // A columns block and a table share their width the same way: fixed
  // widths as given, fill sharing what is left.
  test('lays columns side by side, fixed widths as given and fill sharing the rest', () => {
    const { editor } = editorOver()
    const { boxes } = editor.state().canvas
    const heading = boxOf(boxes, 'heading').pt
    expect(boxOf(boxes, 'title').pt.x).toBeCloseTo(heading.x + 120, 2)
    expect(boxOf(boxes, 'title').pt.width).toBeCloseTo(heading.width - 120, 2)
    const lines = boxOf(boxes, 'lines').pt
    expect(boxOf(boxes, 'lines/sku').pt).toMatchObject({ x: lines.x, width: 80 })
    expect(boxOf(boxes, 'lines/amount').pt.width).toBeCloseTo(lines.width - 80, 2)
  })

  // Wider than its column is something the layout will have to answer
  // for; the canvas shows it rather than squeezing it to fit (plan 8's
  // overflow indicators).
  test('flags a box wider than the space it stands in', () => {
    const report = richReport()
    const heading = report.regions.reportHeader[0] as Extract<ReportDefinition['regions']['body'][number], { kind: 'columns' }>
    const narrow = { ...heading, columns: [{ ...heading.columns[0], width: 50 }, heading.columns[1]] } as typeof heading
    const { editor } = editorOver({ ...report, regions: { ...report.regions, reportHeader: [narrow, ...report.regions.reportHeader.slice(1)] } })
    expect(boxOf(editor.state().canvas.boxes, 'logo-image').overflows).toBe(true)
    expect(boxOf(editor.state().canvas.boxes, 'title').overflows).toBe(false)
  })

  // A QR code prints as a square of its size, whatever it encodes, so its
  // box is that square and no estimate; one wider than its column is
  // flagged as an image is, not drawn narrower than it prints.
  test('draws a QR code as its square, and flags one wider than its column', () => {
    const report = richReport()
    const code = { id: 'code', kind: 'qrCode', content: [{ kind: 'text', text: 'x' }], size: 80, errorCorrection: 'M' } as const
    const side = {
      id: 'side',
      kind: 'columns',
      columns: [
        { width: 60, components: [code] },
        { width: 'fill', components: [] },
      ],
    } as const
    const { editor } = editorOver({ ...report, regions: { ...report.regions, body: [...report.regions.body, side] } })
    const { boxes } = editor.state().canvas
    expect(boxOf(boxes, 'order-code')).toMatchObject({ pt: { width: 85.04, height: 85.04 }, overflows: false })
    expect(boxOf(boxes, 'code')).toMatchObject({ pt: { width: 80, height: 80 }, overflows: true })
    expect(boxOf(boxes, 'side').pt.height).toBe(80)
  })

  // A larger font, or more words, is a taller text: the estimate is a rule
  // of thumb, but one that moves the right way.
  test('estimates a text taller for more words and a larger font', () => {
    const report = richReport()
    const text = (id: string, words: number, style?: string) => ({
      id,
      kind: 'text' as const,
      ...(style === undefined ? {} : { style }),
      content: [{ kind: 'text' as const, text: 'word '.repeat(words) }],
    })
    const { editor } = editorOver({ ...report, regions: { ...report.regions, body: [text('short', 2), text('long', 200), text('large', 2, 'title')] } })
    const { boxes } = editor.state().canvas
    expect(boxOf(boxes, 'long').pt.height).toBeGreaterThan(boxOf(boxes, 'short').pt.height)
    expect(boxOf(boxes, 'large').pt.height).toBeGreaterThan(boxOf(boxes, 'short').pt.height)
  })

  // Every box is drawn in pixels at the zoom, the same conversion
  // everywhere, so the canvas and its rulers agree.
  test('scales every box with the zoom', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'setZoom', zoom: 1.5 }))
    const { boxes, scale } = editor.state().canvas
    expect(scale).toBeCloseTo(1.5 * PX_PER_PT, 12)
    for (const box of boxes) {
      expect(box.px.x, box.key).toBeCloseTo(box.pt.x * scale, 1)
      expect(box.px.width, box.key).toBeCloseTo(box.pt.width * scale, 1)
    }
  })

  // The selected box is outlined, as its outline row is marked.
  test('marks the selected box', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    expect(
      editor
        .state()
        .canvas.boxes.filter((box) => box.selected)
        .map((box) => box.key),
    ).toEqual(['gap'])
  })

  // A ruler in millimetres, the unit the properties are edited in, with
  // labels only as close together as they can be read.
  test('rules the sheet in millimetres, labelling only where there is room', () => {
    for (const zoom of [MIN_ZOOM, 1, MAX_ZOOM]) {
      const { editor } = editorOver(richReport(), { zoom })
      const { horizontal, vertical } = editor.state().canvas.rulers
      expect(horizontal[0]).toMatchObject({ at: 0, mm: 0, major: true })
      expect(horizontal.every((tick, index) => tick.mm === index * 5)).toBe(true)
      expect(horizontal.at(-1)?.mm).toBe(210)
      expect(vertical.length).toBeGreaterThan(horizontal.length)
      const labelled = horizontal.filter((tick) => tick.label !== undefined)
      expect(labelled.length).toBeGreaterThan(1)
      for (const [index, tick] of labelled.slice(1).entries()) expect(tick.at - (labelled[index] as typeof tick).at, `zoom ${zoom}`).toBeGreaterThanOrEqual(40)
    }
  })
})
