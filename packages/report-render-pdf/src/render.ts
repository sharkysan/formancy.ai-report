import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { RenderRefusal, type Block, type PageSetup, type ResolvedDocument, type Table } from '@formancy/report-runtime'
import { checkBill, refusePage, type CheckedBill } from './bill.js'
import { refuseOversized } from './bound.js'
import type { Build, TablePlan } from './build.js'
import { checkDocument, refuseTall, type Checked, type Page } from './check.js'
import {
  bodyMeasurement,
  defaultStyle,
  firstPageHeaderMeasurement,
  layoutDefinition,
  REGION_GAP,
  regionsMeasurement,
  slipReservation,
  type Regions,
} from './definition.js'
import type { Engine } from './engine.js'
import { planFonts, type RenderFonts } from './host-fonts.js'
import { FIT_SLACK, measure, refuseLineUnderHeader, rowPitches, SENTINEL_LINE, SENTINEL_ROOM, tablePlan } from './measure.js'
import type { RenderOptions } from './options.js'
import { embedEInvoice } from './pdfa.js'
import { ABOVE_SLIP, informationContent, PAYMENT_PART, RECEIPT } from './slip.js'

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
 * renderer refuses what it cannot draw (`check.ts`, and `bill.ts` for a
 * QR-bill); between them it decides the page margins, refuses what cannot
 * fit on any page or within the page limit (`bound.ts`), and chooses how
 * each table breaks. A document with a QR-bill has two passes more, one for
 * each part of its slip, which measure their information (`measureSlip`).
 * A document with a Factur-X e-invoice is drawn as a PDF/A-3b on the third
 * pass, which alone embeds its XML (`pdfa.ts`); one with an XRechnung as a
 * plain PDF, the copy its label says it is (0038); and a final render a
 * host asks for as `pdfa: '2b'` as a PDF/A-2b, which embeds nothing and
 * runs no hook (`pdfa-check.ts`, 0057).
 *
 * A document that gives page 1 a header of its own (0060) has one pass
 * more, which measures it as the page header is measured, and two bodies:
 * page 1's, under its own header, and every later page's, under the page
 * header. What a page must hold whole -- a keep-together block, a table's
 * line under its repeated header -- is held to the later pages' body,
 * where pdfmake moves what page 1 cannot hold; a block of fixed height and
 * a line to the shorter of the two, since pdfmake draws an image or an SVG
 * on a page that holds nothing whatever its room, and page 1 under a
 * header of space alone holds nothing; and the page limit to page 1's body
 * and the later pages' it leaves.
 */

export async function render(engine: Engine, document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  const { signal, maxPages, pdfa } = options
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new RangeError(`maxPages must be a whole number of pages, at least 1; it is ${String(maxPages)}`)
  // A level misspelt or not drawn would otherwise be a plain PDF a host files as an archival one.
  if (pdfa !== undefined && pdfa !== '2b') throw new RangeError(`pdfa must be '2b' or left out; it is ${String(pdfa)}`)
  stopIfCancelled(signal)
  // Each host face read with readFont, its layout tables stripped, and the engine's virtual files made, before anything is laid out (0043).
  const fonts = planFonts(document.fonts, await engine.glyphs())
  const checked = await checkDocument(document, fonts, maxPages, pdfa)
  const bill = document.paymentPart === undefined ? undefined : checkBill(document.paymentPart, document.page, await engine.billGlyphs())
  // An EPC QR code's caption prints in Liberation Sans too, which a browser loads only when asked; its words are the PSA's, which the face has glyphs for.
  if (checked.captioned) await engine.billGlyphs()
  await stopIfCancelledSoon(signal)
  const regions = await measureRegions(engine, document, checked, fonts, maxPages)
  await stopIfCancelledSoon(signal)
  const bodyHeight = checked.page.height - regions.header - regions.footer
  if (bodyHeight <= 0) throw new RenderRefusal('content-too-large', `the page header and footer leave no room for the body (${bodyHeight.toFixed(2)} pt)`)
  // Page 1's body, under its own header where it has one (0060): the same as every page's where it prints the page header.
  const firstBody = checked.page.height - regions.first - regions.footer
  if (firstBody <= 0)
    throw new RenderRefusal(
      'content-too-large',
      `the first page header and the page footer leave page 1 no room for its body (${firstBody.toFixed(2)} pt)`,
      'firstPageHeader',
    )
  if (bill !== undefined) await measureSlip(engine, bill, checked.page, document.page, regions, fonts)
  refuseTall(checked.tall, Math.min(bodyHeight, firstBody))
  refuseOversized(document.body, { first: firstBody, later: bodyHeight }, maxPages, fonts, bill === undefined ? 0 : slipReservation(checked.page, regions))
  const plans = await measureBody(engine, checked, fonts, { first: firstBody, later: bodyHeight }, maxPages)
  await stopIfCancelledSoon(signal)
  const finish = checked.pdfa?.subset === 'PDF/A-3b' ? embedEInvoice(checked.pdfa.file, checked.creationDate) : undefined
  const pdf = await engine.run(layoutDefinition(document, checked, regions, plans, fonts, maxPages, bill), fonts.engine, finish)
  await stopIfCancelledSoon(signal)
  return pdf
}

/** How much taller than its section a slip's information may lay out and still fit: rounding, not layout. */
const SECTION_SLACK = 0.01

/**
 * Refuses a QR-bill's slip that cannot be drawn whole where SIX puts it: on
 * a page whose top margin, with the header under it and the instruction to
 * separate over the slip, reaches into it, by report-spec's rule
 * (`refusePage`); or with information taller than its section (SG 6),
 * which would run into the section below it or off the paper. Each part's
 * information is laid out as the slip lays it out (`slip.ts`), on a sheet
 * as tall as its section and the three sentinels around it: what does not
 * fit on the sheet is taller than the section, and pdfmake's next page
 * refuses it. The header is the taller of page 1's and the page header
 * (0060): the slip prints on the last page, which is known only once the
 * pages are laid out, and on a one-page report is page 1.
 */
async function measureSlip(engine: Engine, bill: CheckedBill, page: Page, setup: PageSetup, regions: Regions, fonts: RenderFonts): Promise<void> {
  refusePage(setup, Math.max(regions.header, regions.first) + ABOVE_SLIP)
  for (const part of [PAYMENT_PART, RECEIPT]) {
    const { width, height, millimetres } = part.information
    const refusal = (): RenderRefusal =>
      new RenderRefusal(
        'content-too-large',
        `${part.name}'s information is taller than its section: SIX gives it ${millimetres} mm (${height.toFixed(2)} pt)`,
        'paymentPart',
      )
    const item: Content = { stack: informationContent(bill.bill, part), margin: [0, 0, page.paperWidth - width, 0] }
    const sheet = { width: page.paperWidth, height: height + 3 * SENTINEL_LINE + SECTION_SLACK, left: 0, right: 0 }
    await measure(engine, sheet, [item], resources(fonts, {}), refusal, [], fonts.engine)
  }
}

/**
 * The page header's and footer's heights, measured once, on a page as tall
 * as the printable area: two regions that do not fit on it leave no body.
 * Page 1's own header (0060) is measured on a page of its own, as tall:
 * what does not fit on it is taller than the printable area.
 */
async function measureRegions(engine: Engine, document: ResolvedDocument, checked: Checked, fonts: RenderFonts, maxPages: number): Promise<Regions> {
  const { present, items, build } = regionsMeasurement(document, checked, fonts, maxPages)
  const heights =
    present.length === 0
      ? []
      : (await measureOnPrintable(engine, checked, fonts, items, build, 'the page header and footer are taller than the printable area')).heights
  const space = (blocks: readonly Block[]): number => (blocks.length === 0 ? 0 : heights[present.indexOf(blocks)]! + REGION_GAP)
  const header = space(document.pageHeader)
  const own = document.firstPageHeader
  if (own === undefined) return { header, footer: space(document.pageFooter), first: header }
  if (own.length === 0) return { header, footer: space(document.pageFooter), first: 0 }
  const first = firstPageHeaderMeasurement(own, checked, fonts)
  const measured = await measureOnPrintable(
    engine,
    checked,
    fonts,
    first.items,
    first.build,
    'the first page header is taller than the printable area',
    'firstPageHeader',
  )
  return { header, footer: space(document.pageFooter), first: measured.heights[0]! + REGION_GAP }
}

/** `items` measured on a page as tall as the printable area and their sentinels, refused as `content-too-large` when they do not fit on it. */
async function measureOnPrintable(
  engine: Engine,
  checked: Checked,
  fonts: RenderFonts,
  items: readonly Content[],
  build: Pick<Build, 'images' | 'words'>,
  overflow: string,
  subject?: string,
): Promise<{ readonly heights: readonly number[] }> {
  const { page } = checked
  return measure(
    engine,
    { width: page.paperWidth, height: page.height + SENTINEL_ROOM * (items.length + 2), left: page.margins.left, right: page.margins.right },
    items,
    resources(fonts, build.images),
    () => new RenderRefusal('content-too-large', overflow, subject),
    build.words,
    fonts.engine,
  )
}

/**
 * Measures the body's keep-together blocks and tables, refuses a block no
 * page can hold and a table's line no page holds under its repeated header
 * (`refuseLineUnderHeader`), and plans how each table breaks. On a page as tall as the
 * page limit's bodies and one more -- page 1's, under its own header where
 * it has one (0060), and the later pages' -- content that does not fit on
 * it needs more pages than the limit, whatever else the body holds, so it
 * is refused here, after laying out at most that much of it. What a page
 * must hold whole is held to the later pages' body, where pdfmake moves
 * what page 1 cannot hold.
 *
 * A block inside framed sections has less of each page than the body: their
 * borders and padding above and below it, which is what `inset` holds.
 */
async function measureBody(
  engine: Engine,
  checked: Checked,
  fonts: RenderFonts,
  bodies: { readonly first: number; readonly later: number },
  maxPages: number,
): Promise<ReadonlyMap<Table, TablePlan>> {
  const { measured, page } = checked
  if (measured.length === 0) return new Map()
  const bodyHeight = bodies.later
  const { items, build } = bodyMeasurement(measured, checked, fonts)
  const sheet = (maxPages + 1) * bodyHeight + (bodies.first - bodyHeight)
  const { heights, top, ends } = await measure(
    engine,
    { width: page.paperWidth, height: sheet + SENTINEL_ROOM * (items.length + 2), left: page.margins.left, right: page.margins.right },
    items,
    resources(fonts, build.images),
    () => new RenderRefusal('too-many-pages', `the report needs more than ${maxPages} pages`),
    build.words,
    fonts.engine,
  )
  const plans = new Map<Table, TablePlan>()
  measured.forEach(({ block, at, inset, under }, index) => {
    const room = bodyHeight - inset
    if (block.kind === 'keepTogether' && heights[index]! > room - FIT_SLACK) {
      throw new RenderRefusal(
        'content-too-large',
        `the keep-together block ${at} is ${heights[index]!.toFixed(2)} pt tall; a page's body is ${room.toFixed(2)} pt where it stands`,
        at,
      )
    }
    if (block.kind === 'table') {
      const rows = build.measuredRows.get(block)!
      const pitches = rowPitches(
        rows.map((row) => row.mark),
        top,
        ends[index]!,
      )
      refuseLineUnderHeader(block, under!, pitches[0]!, room)
      plans.set(
        block,
        tablePlan(
          rows.map((row, at) => ({ kind: row.kind, pitch: pitches[at]!, keep: row.keep, prints: row.prints })),
          room,
        ),
      )
    }
  })
  return plans
}

function resources(fonts: RenderFonts, images: Record<string, string>): Required<Pick<TDocumentDefinitions, 'defaultStyle' | 'images'>> {
  return { defaultStyle: defaultStyle(fonts), images }
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
