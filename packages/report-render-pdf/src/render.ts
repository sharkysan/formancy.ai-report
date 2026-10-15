import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { RenderRefusal, type Block, type ResolvedDocument, type Table } from '@formancy/report-runtime'
import { refuseOversized } from './bound.js'
import type { TablePlan } from './build.js'
import { checkDocument, refuseTall, type Checked } from './check.js'
import { bodyMeasurement, DEFAULT_STYLE, layoutDefinition, REGION_GAP, regionsMeasurement, type Regions } from './definition.js'
import type { Engine } from './engine.js'
import { FIT_SLACK, measure, rowPitches, SENTINEL_ROOM, tablePlan } from './measure.js'
import type { RenderOptions } from './options.js'

/**
 * A resolved document rendered with pdfmake, refused rather than truncated,
 * clipped or dropped: the renderer both entries share, given the one thing
 * they do differently, the engine that runs a pdfmake definition with its
 * fonts ([0005](../../../docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).
 *
 * Three passes, each a pdfmake layout. The first measures the page header
 * and footer, and the second the body's keep-together blocks and table rows
 * (`measure.ts`), because pdfmake loses what does not fit where it must
 * without saying so. The third is the PDF, laid out again by pdfmake for
 * each page break a keep-with-next or table rule asks for. Before them the
 * renderer refuses what it cannot draw (`check.ts`); between them it
 * decides the page margins, refuses what cannot fit on any page or within
 * the page limit (`bound.ts`), and chooses how each table breaks.
 */

export async function render(engine: Engine, document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  const { signal, maxPages } = options
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new RangeError(`maxPages must be a whole number of pages, at least 1; it is ${String(maxPages)}`)
  stopIfCancelled(signal)
  const checked = await checkDocument(document, await engine.glyphs())
  await stopIfCancelledSoon(signal)
  const regions = await measureRegions(engine, document, checked, maxPages)
  await stopIfCancelledSoon(signal)
  const bodyHeight = checked.page.height - regions.header - regions.footer
  if (bodyHeight <= 0) throw new RenderRefusal('content-too-large', `the page header and footer leave no room for the body (${bodyHeight.toFixed(2)} pt)`)
  refuseTall(checked.tall, bodyHeight)
  refuseOversized(document.body, bodyHeight, maxPages)
  const plans = await measureBody(engine, checked, bodyHeight, maxPages)
  await stopIfCancelledSoon(signal)
  const pdf = await engine.run(layoutDefinition(document, checked, regions, plans, maxPages))
  await stopIfCancelledSoon(signal)
  return pdf
}

/**
 * The page header's and footer's heights, measured once, on a page as tall
 * as the printable area: two regions that do not fit on it leave no body.
 */
async function measureRegions(engine: Engine, document: ResolvedDocument, checked: Checked, maxPages: number): Promise<Regions> {
  const { present, items, build } = regionsMeasurement(document, checked, maxPages)
  if (present.length === 0) return { header: 0, footer: 0 }
  const { page } = checked
  const { heights } = await measure(
    engine,
    { width: page.paperWidth, height: page.height + SENTINEL_ROOM * (items.length + 2), left: page.margins.left, right: page.margins.right },
    items,
    resources(build.images),
    () => new RenderRefusal('content-too-large', 'the page header and footer are taller than the printable area'),
    build.words,
  )
  const space = (blocks: readonly Block[]): number => (blocks.length === 0 ? 0 : heights[present.indexOf(blocks)]! + REGION_GAP)
  return { header: space(document.pageHeader), footer: space(document.pageFooter) }
}

/**
 * Measures the body's keep-together blocks and tables, refuses a block no
 * page can hold, and plans how each table breaks. On a page as tall as the
 * page limit's bodies and one more: content that does not fit on it needs
 * more pages than the limit, whatever else the body holds, so it is refused
 * here, after laying out at most that much of it.
 *
 * A block inside framed sections has less of each page than the body: their
 * borders and padding above and below it, which is what `inset` holds.
 */
async function measureBody(engine: Engine, checked: Checked, bodyHeight: number, maxPages: number): Promise<ReadonlyMap<Table, TablePlan>> {
  const { measured, page } = checked
  if (measured.length === 0) return new Map()
  const { items, build } = bodyMeasurement(measured, checked)
  const { heights, top, ends } = await measure(
    engine,
    { width: page.paperWidth, height: (maxPages + 1) * bodyHeight + SENTINEL_ROOM * (items.length + 2), left: page.margins.left, right: page.margins.right },
    items,
    resources(build.images),
    () => new RenderRefusal('too-many-pages', `the report needs more than ${maxPages} pages`),
    build.words,
  )
  const plans = new Map<Table, TablePlan>()
  measured.forEach(({ block, at, inset }, index) => {
    const room = bodyHeight - inset
    if (block.kind === 'keepTogether' && heights[index]! > room - FIT_SLACK) {
      throw new RenderRefusal('content-too-large', `the keep-together block ${at} is ${heights[index]!.toFixed(2)} pt tall; a page's body is ${room.toFixed(2)} pt where it stands`, at)
    }
    if (block.kind === 'table') {
      const rows = build.measuredRows.get(block)!
      const pitches = rowPitches(rows.map((row) => row.mark), top, ends[index]!)
      plans.set(block, tablePlan(rows.map((row, at) => ({ kind: row.kind, pitch: pitches[at]! })), room))
    }
  })
  return plans
}

function resources(images: Record<string, string>): Required<Pick<TDocumentDefinitions, 'defaultStyle' | 'images'>> {
  return { defaultStyle: DEFAULT_STYLE, images }
}

function stopIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new RenderRefusal('cancelled', 'the render was cancelled')
}

/**
 * `stopIfCancelled`, once the event loop has turned. Every await of a pass
 * resolves without it turning -- pdfmake's work is synchronous and PDFKit's
 * stream events come on the microtask queue -- so without this an abort
 * from a timer arrived only once the PDF was written: a 417-page render
 * resolved after 10.7 seconds with a PDF its caller had abandoned after 50
 * milliseconds (2026-10-15).
 */
async function stopIfCancelledSoon(signal: AbortSignal | undefined): Promise<void> {
  if (signal !== undefined) await new Promise((resolve) => setTimeout(resolve, 0))
  stopIfCancelled(signal)
}
