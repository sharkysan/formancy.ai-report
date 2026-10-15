import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import type { Content, DynamicContent, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { pageDimensions, RenderRefusal, type Block, type EngineAdapter, type RenderOptions, type ResolvedDocument, type Table } from '../document.js'
import { checkImageAsset } from './pdfmake-assets.js'
import { contentOf, DEFAULT_SIZE, newBuild, PADDING_X, type Fields, type TablePlan } from './pdfmake-content.js'
import { FIT_SLACK, measure, rowPitches, SENTINEL_ROOM, tablePlan } from './pdfmake-measure.js'

/**
 * The renderer trial's pdfmake adapter: a `ResolvedDocument` rendered with
 * pdfmake 0.3.11, refused rather than truncated, clipped or dropped.
 *
 * Three passes, each a pdfmake layout. The first measures the page header
 * and footer, and the second the body's keep-together blocks and table rows
 * (`pdfmake-measure.ts`), because pdfmake loses what does not fit where it
 * must without saying so. The third is the PDF, laid out again by pdfmake
 * for each page break a keep-with-next or group-header rule asks for
 * (`pdfmake-content.ts`). Between them the adapter decides the page margins,
 * refuses what cannot fit on any page, and chooses how each table breaks.
 *
 * The page regions: pdfmake draws its header inside the top page margin and
 * its footer inside the bottom one, and lays the body out between. So
 * pdfmake's margins are the document's enlarged by each region's measured
 * height and a 6pt gap, and each region is drawn at the document's own
 * margin: the header from the top of the printable area down, the footer
 * ending at its bottom. Nothing of the body can reach into either.
 *
 * Fonts: Roboto 3.014 from pdfmake's own package, embedded and subset by
 * PDFKit. It is licensed under the SIL Open Font License 1.1, which allows
 * embedding in documents. pdfmake reads no other file: its local-access
 * policy allows those four files and nothing else, and its URL policy denies
 * every address.
 */

const require = createRequire(import.meta.url)
const pdfmakeDirectory = path.dirname(require.resolve('pdfmake/package.json'))
const roboto = (file: string): string => path.join(pdfmakeDirectory, 'fonts', 'Roboto', file).split(path.sep).join('/')
const FONTS = {
  Roboto: { normal: roboto('Roboto-Regular.ttf'), bold: roboto('Roboto-Medium.ttf'), italics: roboto('Roboto-Italic.ttf'), bolditalics: roboto('Roboto-MediumItalic.ttf') },
}
const FONT_FILES: ReadonlySet<string> = new Set(Object.values(FONTS.Roboto))
const DEFAULT_STYLE = { font: 'Roboto', fontSize: DEFAULT_SIZE }

/** Between the page header and the body, and between the body and the page footer. */
const REGION_GAP = 6

/**
 * pdfmake is one configuration per process. It is set again before every
 * document, in the same synchronous step as `createPdf`, which reads it, so
 * that nothing else in the process that configures pdfmake can change the
 * fonts or the access policies a render runs with.
 */
async function runPdfmake(definition: TDocumentDefinitions): Promise<Uint8Array> {
  pdfmake.setFonts(FONTS)
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.setLocalAccessPolicy((file) => FONT_FILES.has(file))
  return new Uint8Array(await pdfmake.createPdf(definition).getBuffer())
}

/** The paper and its printable area, in points. */
interface Page {
  readonly paperWidth: number
  readonly paperHeight: number
  readonly margins: ResolvedDocument['page']['margins']
  readonly width: number
  readonly height: number
}

async function render(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  const { signal, maxPages } = options
  stopIfCancelled(signal)
  const creationDate = new Date(document.info.creationDate)
  if (Number.isNaN(creationDate.getTime())) throw new RenderRefusal('unsupported', `the creation date '${document.info.creationDate}' is not a date`, 'info.creationDate')
  const { width: paperWidth, height: paperHeight } = pageDimensions(document.page)
  const { margins } = document.page
  const page: Page = { paperWidth, paperHeight, margins, width: paperWidth - margins.left - margins.right, height: paperHeight - margins.top - margins.bottom }
  checkBlocks(document.pageHeader, 'pageHeader', 'region', page.width)
  checkBlocks(document.pageFooter, 'pageFooter', 'region', page.width)
  checkBlocks(document.body, 'body', 'body', page.width)

  // pdfmake lays a document out and writes it in one synchronous step, during
  // which no abort can even be delivered: one is seen between passes.
  const regions = await measureRegions(document, page, maxPages)
  stopIfCancelled(signal)
  const bodyHeight = page.height - regions.header - regions.footer
  if (bodyHeight <= 0) throw new RenderRefusal('content-too-large', `the page header and footer leave no room for the body (${bodyHeight.toFixed(2)} pt)`)
  for (const block of document.body) {
    if (block.kind === 'image' && block.height > bodyHeight) {
      throw new RenderRefusal('content-too-large', `the image ${block.asset.id} is ${block.height} pt tall; the body is ${bodyHeight.toFixed(2)} pt`, block.asset.id)
    }
  }
  const plans = await measureBody(document, page, bodyHeight, maxPages)
  stopIfCancelled(signal)
  const pdf = await layout(document, page, regions, plans, { creationDate, maxPages })
  stopIfCancelled(signal)
  return pdf
}

/** Space each page region takes from the printable area, its gap to the body included; nothing for a region with no blocks. */
interface Regions {
  readonly header: number
  readonly footer: number
}

/**
 * The page header's and footer's heights, measured once, with each page
 * field printed as the page limit: as many digits as the field can have. On
 * a page as tall as the printable area: two regions that do not fit on it
 * leave no body.
 */
async function measureRegions(document: ResolvedDocument, page: Page, maxPages: number): Promise<Regions> {
  const fields: Fields = { pageNumber: maxPages, pageCount: maxPages }
  const present = [document.pageHeader, document.pageFooter].filter((blocks) => blocks.length > 0)
  if (present.length === 0) return { header: 0, footer: 0 }
  const build = newBuild('measure', page.width, 0)
  const items = present.map((blocks): Content => ({ stack: contentOf(blocks, build, fields) }))
  const { heights } = await measure(
    runPdfmake,
    { width: page.paperWidth, height: page.height + SENTINEL_ROOM * (items.length + 2), left: page.margins.left, right: page.margins.right },
    items,
    { defaultStyle: DEFAULT_STYLE, images: build.images },
    () => new RenderRefusal('content-too-large', 'the page header and footer are taller than the printable area'),
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
 */
async function measureBody(document: ResolvedDocument, page: Page, bodyHeight: number, maxPages: number): Promise<ReadonlyMap<Table, TablePlan>> {
  const measured = document.body.flatMap((block, index) => (block.kind === 'table' || block.kind === 'keepTogether' ? [{ block, at: `body[${index}]` }] : []))
  if (measured.length === 0) return new Map()
  const build = newBuild('measure', page.width, 0)
  const items = measured.map(({ block }) => contentOf([block], build)[0]!)
  const { heights, top, ends } = await measure(
    runPdfmake,
    { width: page.paperWidth, height: (maxPages + 1) * bodyHeight + SENTINEL_ROOM * (items.length + 2), left: page.margins.left, right: page.margins.right },
    items,
    { defaultStyle: DEFAULT_STYLE, images: build.images },
    () => new RenderRefusal('too-many-pages', `the report needs more than ${maxPages} pages`),
  )
  const plans = new Map<Table, TablePlan>()
  measured.forEach(({ block, at }, index) => {
    if (block.kind === 'keepTogether' && heights[index]! > bodyHeight - FIT_SLACK) {
      throw new RenderRefusal('content-too-large', `the keep-together block ${at} is ${heights[index]!.toFixed(2)} pt tall; a page's body is ${bodyHeight.toFixed(2)} pt`, at)
    }
    if (block.kind === 'table') {
      const rows = build.measuredRows.get(block)!
      const pitches = rowPitches(rows.map((row) => row.mark), top, ends[index]!)
      plans.set(block, tablePlan(rows.map((row, at) => ({ kind: row.kind, pitch: pitches[at]! })), bodyHeight))
    }
  })
  return plans
}

/**
 * The PDF. pdfmake's own page limit, `maxPagesNumber`, cuts the document
 * short; the adapter's throws out of the layout instead, from the function
 * pdfmake calls for each page's background, as the page after the last one
 * allowed is added. So no more than one page past the limit is ever laid out.
 */
async function layout(
  document: ResolvedDocument,
  page: Page,
  regions: Regions,
  plans: ReadonlyMap<Table, TablePlan>,
  settings: { readonly creationDate: Date; readonly maxPages: number },
): Promise<Uint8Array> {
  const { margins } = page
  const bodyTop = margins.top + regions.header
  const build = newBuild('render', page.width, bodyTop, plans)
  const region = (blocks: readonly Block[], margin: [number, number, number, number]): DynamicContent | undefined => {
    if (blocks.length === 0) return undefined
    return (pageNumber, pageCount) => ({ stack: contentOf(blocks, build, { pageNumber, pageCount }), margin })
  }
  const header = region(document.pageHeader, [margins.left, margins.top, margins.right, 0])
  const footer = region(document.pageFooter, [margins.left, REGION_GAP, margins.right, 0])
  // Once now, so that their images are in the dictionary before pdfmake reads it.
  header?.(1, 1, { width: page.paperWidth, height: page.paperHeight, orientation: document.page.orientation })
  footer?.(1, 1, { width: page.paperWidth, height: page.paperHeight, orientation: document.page.orientation })
  const definition: TDocumentDefinitions = {
    info: { title: document.info.title, creationDate: settings.creationDate },
    pageSize: { width: page.paperWidth, height: page.paperHeight },
    pageMargins: [margins.left, bodyTop, margins.right, margins.bottom + regions.footer],
    defaultStyle: DEFAULT_STYLE,
    content: contentOf(document.body, build),
    images: build.images,
    ...(header === undefined ? {} : { header }),
    ...(footer === undefined ? {} : { footer }),
    background: (number) => {
      if (number > settings.maxPages) throw new RenderRefusal('too-many-pages', `the report needs more than ${settings.maxPages} pages`)
      return null
    },
    pageBreakBefore: (node, queries) => {
      const rule = node.headlineLevel === undefined ? undefined : build.rules.get(node.headlineLevel)
      return rule?.(node, queries) ?? false
    },
  }
  return runPdfmake(definition)
}

type Where = 'body' | 'kept' | 'region'

/**
 * What the adapter refuses before pdfmake sees it: what pdfmake cannot
 * print, what is malformed, and what is wider than the page. Every image's
 * bytes are checked here (`pdfmake-assets.ts`).
 */
function checkBlocks(blocks: readonly Block[], path: string, where: Where, width: number): void {
  blocks.forEach((block, index) => {
    const at = `${path}[${index}]`
    if (block.kind === 'paragraph' && where !== 'region' && block.runs.some((run) => 'field' in run)) {
      throw new RenderRefusal('unsupported', `${at} prints a page field; pdfmake knows the page number only in the page header and footer`, at)
    }
    if (block.kind === 'pageBreak' && where !== 'body') {
      throw new RenderRefusal('unsupported', `${at} is a page break inside a ${where === 'kept' ? 'keep-together block' : 'page region'}`, at)
    }
    if (block.kind === 'image') {
      checkImageAsset(block.asset)
      const { id } = block.asset
      if (!(block.width > 0 && block.height > 0 && Number.isFinite(block.width) && Number.isFinite(block.height))) {
        throw new RenderRefusal('unsupported', `the image ${id} is drawn ${block.width} × ${block.height} pt`, id)
      }
      if (block.width > width) throw new RenderRefusal('content-too-large', `the image ${id} is ${block.width} pt wide; the printable width is ${width.toFixed(2)} pt`, id)
    }
    if (block.kind === 'table') checkTable(block, width)
    if (block.kind === 'keepTogether') checkBlocks(block.blocks, `${at}.blocks`, where === 'region' ? 'region' : 'kept', width)
  })
}

function checkTable(table: Table, width: number): void {
  const columns = table.columns.length
  if (columns === 0) throw new RenderRefusal('unsupported', `table ${table.id} has no columns`, table.id)
  const rows = [table.header, ...table.rows.map((row) => row.cells)]
  const short = rows.findIndex((cells) => cells.length !== columns)
  if (short >= 0) {
    throw new RenderRefusal('unsupported', `the ${short === 0 ? 'header' : `row ${short}`} of table ${table.id} has ${rows[short]!.length} cells for ${columns} columns`, table.id)
  }
  const narrow = table.columns.find((column) => column.width !== 'fill' && !(column.width > 2 * PADDING_X))
  if (narrow !== undefined) throw new RenderRefusal('unsupported', `table ${table.id} has a column of ${String(narrow.width)} pt, no wider than its cell padding`, table.id)
  const fixed = table.columns.reduce((sum, column) => sum + (column.width === 'fill' ? 0 : column.width), 0)
  const fills = table.columns.filter((column) => column.width === 'fill').length
  if (fixed > width || (fills > 0 && (width - fixed) / fills <= 2 * PADDING_X)) {
    throw new RenderRefusal('content-too-large', `table ${table.id}'s fixed columns are ${fixed} pt wide; the printable width is ${width.toFixed(2)} pt`, table.id)
  }
}

function stopIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new RenderRefusal('cancelled', 'the render was cancelled')
}

export const pdfmakeAdapter: EngineAdapter = {
  name: 'pdfmake',
  version: (require('pdfmake/package.json') as { version: string }).version,
  render,
}
