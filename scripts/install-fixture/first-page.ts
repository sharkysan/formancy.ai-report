/*
 * Page 1's own header (0060), from the packed packages under Node.
 * consume.ts runs it and prints what it returns; it lives apart because
 * consume.ts stood near its size budget when it came.
 *
 * - report-spec names the region among REGION_NAMES as its one optional
 *   region, heldRegions lists it only where a report holds it, before the
 *   page header, and a page number in it is refused as
 *   misplaced-page-counter;
 * - report-core's putFirstPageHeader and removeFirstPageHeader run
 *   through a session as a proposal carries them, read back from JSON,
 *   each one undo step, and a page number is offered none of its places;
 * - a report with one is validated, resolved -- the same report without it
 *   to a document without the key -- and drawn on two pages, page 1's own
 *   header on page 1 alone and the page header on page 2 alone, each read
 *   from the drawing of its page as a fill no other block paints.
 */
import { heldRegions, OPTIONAL_REGIONS, REGION_NAMES, validateReport } from '@formancy/report-spec'
import type { Component, RectangleComponent, ReportDefinition } from '@formancy/report-spec'
import { openReportSession, validLocations } from '@formancy/report-core'
import type { CommandDescriptor, CommandOutcome } from '@formancy/report-core'
import { resolveReport } from '@formancy/report-runtime'
import type { ReportData, ResolvedDocument } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'
import { inflateSync } from 'node:zlib'

/** A filled band, the one block of its region: its fill tells its page's drawing apart. */
const band = (id: string, fill: string): RectangleComponent => ({ id, kind: 'rectangle', width: 200, height: 20, fill })

const OWN = '#0a6e5c'
const RUNNING = '#7b2d8e'

/** An order of two pages, its page header a band of its own colour, and no header of page 1's own. */
const order: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'first-page',
  title: 'Order',
  locale: 'en',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
  styles: [],
  datasets: {},
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [],
    pageHeader: [band('running', RUNNING)],
    body: [
      { id: 'opening', kind: 'text', content: [{ kind: 'text', text: 'Order 2026-0042' }] },
      { id: 'break', kind: 'pageBreak' },
      { id: 'closing', kind: 'text', content: [{ kind: 'text', text: 'Terms of delivery' }] },
    ],
    pageFooter: [],
    summary: [],
  },
}

/** What PDFKit writes for a fill of `hex`, as consume.ts reads the SVG logo's disc. */
const fillOf = (hex: string): string => `${[1, 3, 5].map((at) => String(Number.parseInt(hex.slice(at, at + 2), 16) / 255)).join(' ')} scn`

/** Each page's drawing, in page order: the page tree's kids, each one's content stream, inflated where PDFKit compressed it. */
function pageDrawings(pdf: Uint8Array): string[] {
  const text = new TextDecoder('latin1').decode(pdf)
  const objectAt = (id: string): number => {
    const at = text.indexOf(`\n${id} 0 obj`)
    if (at < 0) throw new Error(`the PDF has no object ${id}`)
    return at
  }
  const kids = /\/Type \/Pages[^>]*?\/Kids \[([^\]]*)\]/.exec(text)?.[1]
  if (kids === undefined) throw new Error('the PDF has no page tree')
  return [...kids.matchAll(/(\d+) 0 R/g)].map((kid) => {
    const page = objectAt(kid[1] ?? '')
    const contents = /\/Contents (\d+) 0 R/.exec(text.slice(page, text.indexOf('endobj', page)))?.[1]
    if (contents === undefined) throw new Error(`page object ${String(kid[1])} names no content stream`)
    const start = text.indexOf('stream\n', objectAt(contents)) + 'stream\n'.length
    const stream = pdf.subarray(start, text.indexOf('endstream', start))
    try {
      return inflateSync(stream).toString('latin1')
    } catch {
      return Buffer.from(stream).toString('latin1')
    }
  })
}

const data: ReportData = { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' }

function resolved(report: ReportDefinition): ResolvedDocument {
  const resolution = resolveReport(report, data, { mode: 'final', parameters: {}, creationDate: '2026-11-15T08:00:00Z' })
  if (!resolution.ok) throw new Error(`the order was refused: ${resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  return resolution.document
}

export async function firstPageDrawn(): Promise<string> {
  if (!REGION_NAMES.includes('firstPageHeader') || JSON.stringify(OPTIONAL_REGIONS) !== '["firstPageHeader"]')
    throw new Error(`report-spec does not name page 1's own header as its one optional region: ${JSON.stringify(OPTIONAL_REGIONS)}`)

  // Through a session, as a proposal carries the commands: put in, undone and redone, taken away, undone, and refused where there is none.
  const opening = openReportSession(order)
  if (!opening.ok) throw new Error(`the order did not open a session: ${opening.errors.map((error) => error.code).join(', ')}`)
  const { session } = opening
  const descriptor = (command: string, args: readonly unknown[]): CommandDescriptor => JSON.parse(JSON.stringify({ command, args })) as CommandDescriptor
  const own: Component[] = [band('letterhead', OWN)]
  const put: CommandOutcome = session.apply(descriptor('putFirstPageHeader', [own]))
  const withOwn = session.document()
  if (!put.ok || withOwn.regions.firstPageHeader?.length !== 1) throw new Error('putFirstPageHeader did not give page 1 a header of its own')
  if (!session.undo() || session.document().regions.firstPageHeader !== undefined || !session.redo() || session.document() !== withOwn)
    throw new Error("page 1's own header was not put in as one undo step")
  const removed: CommandOutcome = session.apply(descriptor('removeFirstPageHeader', []))
  if (!removed.ok || session.document().regions.firstPageHeader !== undefined) throw new Error('removeFirstPageHeader did not give page 1 the page header back')
  const again: CommandOutcome = session.apply(descriptor('removeFirstPageHeader', []))
  if (again.ok || again.code !== 'not-found') throw new Error('removeFirstPageHeader was not refused where page 1 has no header of its own')
  if (!session.undo() || session.document() !== withOwn) throw new Error("page 1's own header was not taken away as one undo step")

  // Listed where it is, before the page header; offered no page number, which has no value in it.
  if (
    heldRegions(withOwn.regions)
      .map(([region]) => region)
      .join() !== 'reportHeader,firstPageHeader,pageHeader,body,pageFooter,summary'
  )
    throw new Error("heldRegions does not list page 1's own header before the page header")
  const counter: Component = { id: 'counter', kind: 'text', content: [{ kind: 'pageNumber' }] }
  const offered = new Set(validLocations(withOwn, counter).map((location) => location.region))
  if ([...offered].sort().join() !== 'pageFooter,pageHeader') throw new Error(`a page number was offered ${[...offered].join(', ')}`)
  const numbered = validateReport({ ...withOwn, regions: { ...withOwn.regions, firstPageHeader: [counter] } })
  if (numbered.valid || !numbered.errors.some((error) => error.code === 'misplaced-page-counter' && error.path.startsWith('/regions/firstPageHeader/0')))
    throw new Error('a page number in the first page header was not refused as misplaced-page-counter')

  // Printed: page 1 under its own header alone, page 2 under the page header alone.
  if ('firstPageHeader' in resolved(order)) throw new Error('a report without a first page header resolved to a document with one')
  const document = resolved(withOwn)
  if (document.firstPageHeader?.length !== 1) throw new Error("page 1's own header did not reach the resolved document")
  const pdf = await renderPdf(document, { maxPages: 5 })
  const pages = pageDrawings(pdf)
  if (pages.length !== 2) throw new Error(`the order printed ${String(pages.length)} pages, not 2`)
  const [first = '', second = ''] = pages
  if (!first.includes(fillOf(OWN)) || first.includes(fillOf(RUNNING)) || !second.includes(fillOf(RUNNING)) || second.includes(fillOf(OWN)))
    throw new Error('page 1 did not print its own header alone, and page 2 the page header alone')
  return `page 1's own header was put in, undone, redone, taken away and refused where there was none through the packed report-core's session from JSON, offered no page number and refused one, and printed on page 1 of a ${String(pdf.length)}-byte PDF of two pages in the page header's place, the page header on page 2 alone`
}
