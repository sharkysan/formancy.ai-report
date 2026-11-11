/**
 * Zoom, the page in points and pixels, and the design view's layout.
 *
 * The layout here is a design-mode approximation for selecting and placing
 * things, and never the PDF (plan 8): the renderer owns text measurement
 * and pagination. It stacks each region's components as one flow on one
 * sheet, measures a text by a rule of thumb and a table as one row of each
 * kind, so a one-row design surface stands for what may print as many pages.
 * A payment part, which prints at the foot of the last page, is a band at
 * the sheet's foot, below all of them.
 * Every number in it is a rule of thumb named below, not a measurement.
 */
import { pageDimensions, printableArea, QR_BILL_SIZE, REGION_NAMES, walkComponents } from '@formancy/report-spec'
import type { Component, Inline, Margins, RegionName, ReportDefinition, Width } from '@formancy/report-spec'
import { columnKey } from './labels.js'
import type { PartKind } from './model.js'
import type { Box, PageGeometry, RulerTick } from './model-canvas.js'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
/** The zooms Zoom in and Zoom out step through; any zoom in the range can be set. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

/** CSS pixels per point at 100 %: CSS has 96 pixels to the inch, PDF 72 points, so a page is its paper size on screen. */
export const PX_PER_PT = 96 / 72

/** `zoom` within MIN_ZOOM and MAX_ZOOM. A value that is not a finite number is the caller's to refuse. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Within this of a step counts as the step, so 1.25 after arithmetic is still 1.25. */
const SAME_ZOOM = 1e-9

export function zoomedIn(zoom: number): number {
  return ZOOM_STEPS.find((step) => step > zoom + SAME_ZOOM) ?? MAX_ZOOM
}

export function zoomedOut(zoom: number): number {
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - SAME_ZOOM) ?? MIN_ZOOM
}

/** Font size a text without a style's size is estimated at. The renderer's default decides what prints. */
const DEFAULT_FONT_SIZE = 10
/** Line height as a share of the font size. */
const LINE_HEIGHT = 1.2
/** An average character's width as a share of the font size: a rule of thumb for a proportional face. */
const CHARACTER_WIDTH = 0.5
/** Characters a bound run is estimated at: a value is not known while designing. */
const BOUND_RUN = 12
/** One table row: a line of the default font and a little padding. */
const TABLE_ROW = DEFAULT_FONT_SIZE * LINE_HEIGHT + 4
/** An empty region or container is drawn this tall, so it can be seen, and dropped into. */
const EMPTY_LIST = 18
/** Between two regions' bands, where a band's label sits. */
const BAND_GAP = 14
/** A page break's marker. */
const PAGE_BREAK = 8
/** Room above and below a rule, so a hairline can be clicked. */
const RULE_ROOM = 2

/** Rounded to the hundredth, as points are stored and as pixels are worth drawing. */
function hundredths(value: number): number {
  return Math.round(value * 100) / 100 + 0
}

function rounded(box: Box): Box {
  return { x: hundredths(box.x), y: hundredths(box.y), width: hundredths(box.width), height: hundredths(box.height) }
}

/** `box`, in points, as CSS pixels at `zoom`. */
export function toPx(box: Box, zoom: number): Box {
  const scale = zoom * PX_PER_PT
  return rounded({ x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale })
}

/** A box, laid out, for one component or table column. */
export interface LaidPart {
  readonly key: string
  readonly id: string
  readonly column?: string
  readonly kind: PartKind
  readonly depth: number
  readonly box: Box
  readonly overflows: boolean
}

export interface Layout {
  readonly sheet: Box
  readonly regions: readonly { readonly region: RegionName; readonly box: Box; readonly empty: boolean }[]
  /** The payment part's band, for a report that has one: the slip's size, across the sheet's foot. */
  readonly paymentPart: Box | null
  /** Every component and table column, in the walk's order. */
  readonly parts: readonly LaidPart[]
  /** Each list a component may be put in -- a region, a container, a column of a columns block -- by `listKey`. */
  readonly lists: ReadonlyMap<string, Box>
}

/** The key of a list: its region, its container, or its container and column. */
export function listKey(place: { readonly region: RegionName; readonly parent?: string; readonly column?: number }): string {
  if (place.parent === undefined) return place.region
  return place.column === undefined ? place.parent : `${place.parent}#${place.column}`
}

/** Each width as laid out: a fixed one as given, fill sharing what fixed widths leave, never below nothing. */
function shares(widths: readonly Width[], available: number): number[] {
  const fixed = widths.reduce<number>((sum, width) => sum + (width === 'fill' ? 0 : width), 0)
  const fills = widths.filter((width) => width === 'fill').length
  const fill = fills === 0 ? 0 : Math.max(0, (available - fixed) / fills)
  return widths.map((width) => (width === 'fill' ? fill : width))
}

function fixedTotal(widths: readonly Width[]): number {
  return widths.reduce<number>((sum, width) => sum + (width === 'fill' ? 0 : width), 0)
}

function characters(content: readonly Inline[]): number {
  return content.reduce((sum, run) => sum + (run.kind === 'text' ? run.text.length : BOUND_RUN), 0)
}

/** Lays out a report's regions on one sheet. */
export function layoutReport(report: ReportDefinition): Layout {
  const parts: LaidPart[] = []
  const lists = new Map<string, Box>()
  const depths = new Map(walkComponents(report).map(({ component, depth }) => [component.id, depth]))
  const fontSize = (component: Component): number => report.styles.find((style) => style.id === component.style)?.size ?? DEFAULT_FONT_SIZE

  /** Stacks `list` from `y`, records its box under `key`, and gives its height. */
  const stack = (list: readonly Component[], key: string, x: number, y: number, width: number): number => {
    let cursor = y
    for (const component of list) cursor += place(component, x, cursor, width)
    const height = list.length === 0 ? EMPTY_LIST : cursor - y
    lists.set(key, { x, y, width, height })
    return height
  }

  /** Lays out one component at `x`, `y` in `width`, and gives its height. */
  const place = (component: Component, x: number, y: number, width: number): number => {
    const depth = depths.get(component.id) ?? 0
    const at = parts.length
    const record = (height: number, boxWidth = width, overflows = false): number => {
      parts.splice(at, 0, { key: component.id, id: component.id, kind: component.kind, depth, box: { x, y, width: boxWidth, height }, overflows })
      return height
    }
    switch (component.kind) {
      case 'text': {
        const size = fontSize(component)
        const lines = Math.max(1, Math.ceil((characters(component.content) * CHARACTER_WIDTH * size) / Math.max(width, 1)))
        return record(lines * size * LINE_HEIGHT)
      }
      case 'image':
      case 'chart':
      case 'rectangle':
        return record(component.height, component.width, component.width > width)
      case 'qrCode':
      case 'epcQrCode':
        return record(component.size, component.size, component.size > width)
      case 'line':
        return record(component.thickness + 2 * RULE_ROOM)
      case 'spacer':
        return record(component.height)
      case 'pageBreak':
        return record(PAGE_BREAK)
      case 'columns': {
        const widths = component.columns.map((column) => column.width)
        let left = x
        let height = 0
        for (const [index, columnWidth] of shares(widths, width).entries()) {
          height = Math.max(height, stack(component.columns[index]?.components ?? [], `${component.id}#${index}`, left, y, columnWidth))
          left += columnWidth
        }
        return record(height, width, fixedTotal(widths) > width)
      }
      case 'section': {
        const inset = (component.border?.thickness ?? 0) + (component.padding ?? 0)
        return record(stack(component.components, component.id, x + inset, y + inset, Math.max(0, width - 2 * inset)) + 2 * inset)
      }
      case 'keepTogether':
        return record(stack(component.components, component.id, x, y, width))
      case 'table': {
        const rows = 2 + (component.group === undefined ? 0 : 1 + component.group.footer.length) + (component.totals?.length ?? 0)
        const height = rows * TABLE_ROW
        const widths = component.columns.map((column) => column.width)
        let left = x
        for (const [index, columnWidth] of shares(widths, width).entries()) {
          const column = component.columns[index]
          if (column !== undefined) {
            parts.push({
              key: columnKey(component.id, column.id),
              id: component.id,
              column: column.id,
              kind: 'tableColumn',
              depth: depth + 1,
              box: { x: left, y, width: columnWidth, height },
              overflows: false,
            })
          }
          left += columnWidth
        }
        return record(height, width, fixedTotal(widths) > width)
      }
    }
  }

  const { margins } = report.page
  const printable = printableArea(report.page)
  const page = pageDimensions(report.page)
  const regions: { region: RegionName; box: Box; empty: boolean }[] = []
  let y = margins.top
  for (const region of REGION_NAMES) {
    const list = report.regions[region]
    const height = stack(list, region, margins.left, y, printable.width)
    regions.push({ region, box: { x: margins.left, y, width: printable.width, height }, empty: list.length === 0 })
    y += height + BAND_GAP
  }
  const end = y - BAND_GAP
  // The slip prints across the paper's foot, below the last page's content
  // and over its bottom margin, so the band ends where the sheet does: at
  // the page's foot, or lower, a gap below the regions, when they reach it.
  const slip = report.paymentPart === undefined ? null : QR_BILL_SIZE
  const height = hundredths(Math.max(page.height, slip === null ? end + margins.bottom : end + BAND_GAP + slip.height))
  return {
    sheet: { x: 0, y: 0, width: page.width, height },
    regions: regions.map((region) => ({ ...region, box: rounded(region.box) })),
    paymentPart: slip === null ? null : rounded({ x: 0, y: height - slip.height, width: slip.width, height: slip.height }),
    parts: parts.map((part) => ({ ...part, box: rounded(part.box) })),
    lists: new Map([...lists].map(([key, box]) => [key, rounded(box)])),
  }
}

function marginsPx(margins: Margins, zoom: number): Margins {
  const scale = zoom * PX_PER_PT
  return {
    top: hundredths(margins.top * scale),
    right: hundredths(margins.right * scale),
    bottom: hundredths(margins.bottom * scale),
    left: hundredths(margins.left * scale),
  }
}

/** The page in points, and in CSS pixels at `zoom`. */
export function pageGeometry(report: ReportDefinition, zoom: number): PageGeometry {
  const { width, height } = pageDimensions(report.page)
  const scale = zoom * PX_PER_PT
  return {
    size: report.page.size,
    orientation: report.page.orientation,
    width,
    height,
    margins: report.page.margins,
    printable: printableArea(report.page),
    px: { width: hundredths(width * scale), height: hundredths(height * scale), margins: marginsPx(report.page.margins, zoom) },
  }
}

/** Points in a millimetre. */
const PT_PER_MM = 72 / 25.4
/** A tick every this many millimetres; every second one is major. */
const TICK_MM = 5
/** Label spacings to choose from, in millimetres: the first whose labels stand at least MIN_LABEL_GAP apart. */
const LABEL_EVERY_MM = [10, 20, 50, 100] as const
/** The least room between two ruler labels, in CSS pixels, for them to be read. */
const MIN_LABEL_GAP = 40

/** A ruler's ticks along `lengthPt` at `zoom`, in millimetres. */
export function rulerTicks(lengthPt: number, zoom: number): RulerTick[] {
  const scale = zoom * PX_PER_PT
  const every = LABEL_EVERY_MM.find((mm) => mm * PT_PER_MM * scale >= MIN_LABEL_GAP) ?? 100
  const ticks: RulerTick[] = []
  for (let mm = 0; mm * PT_PER_MM <= lengthPt + 0.01; mm += TICK_MM) {
    const at = hundredths(mm * PT_PER_MM * scale)
    ticks.push({ at, mm, major: mm % (2 * TICK_MM) === 0, ...(mm % every === 0 ? { label: String(mm) } : {}) })
  }
  return ticks
}
