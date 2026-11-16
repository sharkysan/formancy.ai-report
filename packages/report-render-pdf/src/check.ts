import {
  RenderRefusal,
  type Block,
  type Chart,
  type Columns,
  type EpcQrCode,
  type Image,
  type ImageAsset,
  type QrCode,
  type Rectangle,
  type ResolvedDocument,
  type Section,
} from '@formancy/report-runtime'
import type { CheckedImage } from './assets.js'
import { paragraphLine } from './bound.js'
import { checkChart, checkChartDrawing } from './check-chart.js'
import { checkColor, checkStyle, checkText } from './check-faces.js'
import { checkImages } from './check-images.js'
import { checkTable, checkTableCells } from './check-table.js'
import { tall, type Measured, type Place, type Tall, type Walk } from './check-walk.js'
import { frameOf, RULE_GAP, runFace } from './content.js'
import { epcSymbol } from './epc.js'
import type { RenderFonts } from './host-fonts.js'
import { checkPdfA } from './pdfa-check.js'
import type { PdfA } from './pdfa.js'
import { qrSymbol, type QrSymbol } from './qr.js'
import { checkBaselines } from './shifted.js'
import { fillWidth, fixedWidth } from './widths.js'

/**
 * What the renderer refuses before pdfmake sees the document: what pdfmake
 * cannot print, what is malformed, what stands where it cannot be laid out,
 * what is wider than where it stands, text with a character the face it
 * prints in has no glyph for (`glyphs.ts`), an e-invoice the renderer does
 * not know (`e-invoice.ts`), and what a PDF/A cannot hold (`pdfa-check.ts`):
 * a title PDFKit cannot write into its XMP, a CMYK JPEG beside its sRGB
 * output intent, an SVG whose numbers could pass its integers' range or
 * whose nesting its graphics state's (`svg-pdfa.ts`), and a Factur-X, an
 * XRechnung's copy or a labelled preview asked for as a PDF/A-2b. Every
 * refusal names where the problem is -- `body[2].blocks[0]`, a table's id,
 * an asset's id -- and none of them is a
 * partial render: a document that is refused has drawn nothing.
 *
 * The walk also collects what can only be judged once the page regions are
 * measured -- whatever is too tall for any page's body -- and what the body
 * pass measures: its tables and keep-together blocks, each at the width it
 * stands at. It encodes every QR code and EPC QR code, once, and what it
 * encodes is what every pass draws (`qr.ts`, `epc.ts`). It finds every
 * image, and `check-images.ts` reads each asset once and holds the render to
 * what its images cost together. It holds the render to what its charts
 * cost to draw together (`checkChartDrawing`).
 *
 * Page 1's own header (0060) is walked as a page region, but drawn once, in
 * page 1's background, before the pages are counted: no page field stands
 * in it, and its images are counted once.
 */

/** The paper and its printable area, in points. */
export interface Page {
  readonly paperWidth: number
  readonly paperHeight: number
  readonly margins: ResolvedDocument['page']['margins']
  readonly width: number
  readonly height: number
}

/** Portrait sizes in points, as PDF engines write them: ISO A4 is 210 by 297 millimetres, US Letter 8.5 by 11 inches. */
const PAPER: Readonly<Record<ResolvedDocument['page']['size'], { readonly width: number; readonly height: number }>> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
}

/**
 * How deep blocks may nest. report-spec allows four containers; the
 * renderer recurses through whatever it is given, so a hostile document of
 * ten thousand nested sections would end in a stack overflow rather than a
 * refusal. This bounds the recursion, not a layout.
 */
export const MAX_DEPTH = 16

export interface Checked {
  readonly page: Page
  readonly creationDate: Date
  /** What the document is drawn as, decided once (`pdfa-check.ts`): an e-invoice's PDF/A-3b with the file it embeds, the PDF/A-2b a host asked for, or, undefined, a plain PDF. */
  readonly pdfa: PdfA | undefined
  /** Every image asset as the checks read it: a PNG's or a JPEG's size in pixels, as it is shown, or an SVG's drawing. */
  readonly assets: ReadonlyMap<ImageAsset, CheckedImage>
  /** Every QR code's and EPC QR code's symbol, encoded once. */
  readonly codes: ReadonlyMap<QrCode | EpcQrCode, QrSymbol>
  /** Whether an EPC QR code is captioned: its caption prints in Liberation Sans, which the engine loads for it. */
  readonly captioned: boolean
  /** In the body: judged against its height once the regions are measured. */
  readonly tall: readonly Tall[]
  /** Where each paragraph stands, for a refusal about its words to name. */
  readonly paths: ReadonlyMap<Block, string>
  readonly measured: readonly Measured[]
  /** Every chart of the body, and where it stands, each held to what the drawing lays out (`check-chart.ts`). */
  readonly charts: readonly { readonly block: Chart; readonly at: string }[]
}

export async function checkDocument(document: ResolvedDocument, fonts: RenderFonts, maxPages: number, asked: '2b' | undefined): Promise<Checked> {
  const creationDate = new Date(document.info.creationDate)
  if (Number.isNaN(creationDate.getTime()))
    throw new RenderRefusal('unsupported', `the creation date '${document.info.creationDate}' is not a date`, 'info.creationDate')
  // The title goes into the PDF's metadata, never onto a page, so it is held to being text and not to the font.
  if (typeof document.info.title !== 'string') throw new RenderRefusal('unsupported', 'the title is not text', 'info.title')
  // What it is drawn as -- a Factur-X's PDF/A-3b, an XRechnung's plain copy, the PDF/A-2b asked for -- and what it cannot be, refused (`pdfa-check.ts`).
  const pdfa = checkPdfA(document, asked)
  const page = pageOf(document.page)
  const walk: Walk = { fonts, paths: new Map(), images: [], codes: new Map(), captioned: false, tall: [], measured: [], charts: [] }
  const top: Omit<Place, 'region' | 'everyPage'> = { kept: false, column: false, width: page.width, inset: 0, depth: 0 }
  checkBlocks(document.pageHeader, 'pageHeader', { ...top, region: true, everyPage: true }, walk)
  if (document.firstPageHeader !== undefined) checkBlocks(document.firstPageHeader, 'firstPageHeader', { ...top, region: true, everyPage: false }, walk)
  checkBlocks(document.pageFooter, 'pageFooter', { ...top, region: true, everyPage: true }, walk)
  checkBlocks(document.body, 'body', { ...top, region: false, everyPage: false }, walk)
  checkChartDrawing(walk.charts)
  const assets = await checkImages(walk.images, maxPages, pdfa, page)
  return {
    page,
    creationDate,
    pdfa,
    assets,
    codes: walk.codes,
    captioned: walk.captioned,
    tall: walk.tall,
    paths: walk.paths,
    measured: walk.measured,
    charts: walk.charts,
  }
}

function pageOf(setup: ResolvedDocument['page']): Page {
  // Own sizes only: 'constructor' or 'toString' would find Object's, and crash pdfmake.
  const paper = Object.hasOwn(PAPER, setup.size) ? PAPER[setup.size] : undefined
  if (paper === undefined) throw new RenderRefusal('unsupported', `the page size '${String(setup.size)}' is not one the renderer knows`, 'page.size')
  if (setup.orientation !== 'portrait' && setup.orientation !== 'landscape')
    throw new RenderRefusal('unsupported', `the orientation '${String(setup.orientation)}' is not one the renderer knows`, 'page.orientation')
  const [paperWidth, paperHeight] = setup.orientation === 'portrait' ? [paper.width, paper.height] : [paper.height, paper.width]
  const { margins } = setup
  if (![margins.top, margins.right, margins.bottom, margins.left].every((margin) => Number.isFinite(margin) && margin >= 0)) {
    throw new RenderRefusal('unsupported', 'a page margin is negative or not a number', 'page.margins')
  }
  const width = paperWidth - margins.left - margins.right
  const height = paperHeight - margins.top - margins.bottom
  if (width <= 0 || height <= 0)
    throw new RenderRefusal('content-too-large', `the margins leave no printable area (${width.toFixed(2)} × ${height.toFixed(2)} pt)`, 'page.margins')
  return { paperWidth, paperHeight, margins, width, height }
}

function checkBlocks(blocks: readonly Block[], path: string, place: Place, walk: Walk): void {
  if (place.depth > MAX_DEPTH) throw new RenderRefusal('unsupported', `${path} is nested more than ${MAX_DEPTH} blocks deep`, path)
  blocks.forEach((block, index) => checkBlock(block, `${path}[${index}]`, place, walk))
}

function checkBlock(block: Block, at: string, place: Place, walk: Walk): void {
  switch (block.kind) {
    case 'paragraph': {
      walk.paths.set(block, at)
      if (!place.everyPage && block.runs.some((run) => 'field' in run)) {
        const why = place.region
          ? "page 1's own header is drawn before the pages are counted, and page 1's number and count print in the page footer"
          : 'pdfmake knows the page number only in the page header and footer'
        throw new RenderRefusal('unsupported', `${at} prints a page field; ${why}`, at)
      }
      checkStyle(block.style, at, walk.fonts)
      if (block.runs.some((run) => !('text' in run) && run.field !== 'pageNumber' && run.field !== 'pageCount'))
        throw new RenderRefusal('unsupported', `${at} prints a field the renderer does not know`, at)
      checkBaselines(block, at)
      for (const run of block.runs) {
        if ('text' in run) checkText(run.text, runFace(block.style, run), walk, at)
      }
      // A page number or count prints its digits in the paragraph's face, which a host face may lack: held to it as any text is.
      const field = block.runs.find((run) => 'field' in run)
      if (field !== undefined) checkText(PAGE_DIGITS, runFace(block.style, field), walk, `${at}'s page field`, at)
      // A line as tall as its tallest run's face lays it out (`bound.ts`): taller than the body, pdfmake drops the whole line without a word.
      tall(walk, place, paragraphLine(block, walk.fonts), `a line of ${at}`, at)
      return
    }
    case 'table': {
      if (place.column) throw new RenderRefusal('unsupported', `table ${block.id} stands inside a columns block; a table is part of the flow`, block.id)
      checkTable(block, place.width, walk.fonts)
      const under = checkTableCells(block, place, walk)
      if (!place.region && !place.kept) walk.measured.push({ block, at, width: place.width, inset: place.inset, under })
      return
    }
    case 'image':
      checkImage(block, place, walk)
      walk.images.push({ image: block, everyPage: place.everyPage })
      return
    case 'qrCode':
      checkQrCode(block, place, walk)
      return
    case 'epcQrCode':
      checkEpcQrCode(block, place, walk)
      return
    case 'chart':
      checkChart(block, at, place, walk)
      return
    case 'rule':
      if (!(block.thickness > 0 && Number.isFinite(block.thickness))) throw new RenderRefusal('unsupported', `${at} is a rule ${block.thickness} pt thick`, at)
      checkColor(block.color, at)
      // Its line and the space above and below it (`ruleContent`): taller than the body, it was stroked over the footer and off the paper, or crashed pdfmake.
      tall(walk, place, block.thickness + 2 * RULE_GAP, `the rule ${at}`, at)
      return
    case 'rectangle':
      checkRectangle(block, at, place, walk)
      return
    case 'spacer':
      if (!(block.height >= 0 && Number.isFinite(block.height))) throw new RenderRefusal('unsupported', `${at} is a spacer ${block.height} pt tall`, at)
      return
    case 'pageBreak': {
      const inside = place.region ? 'page region' : place.kept ? 'keep-together block' : place.column ? 'columns block' : undefined
      if (inside !== undefined) throw new RenderRefusal('unsupported', `${at} is a page break inside a ${inside}`, at)
      return
    }
    case 'keepTogether':
      if (!place.region && !place.kept) walk.measured.push({ block, at, width: place.width, inset: place.inset, under: undefined })
      checkBlocks(block.blocks, `${at}.blocks`, { ...place, kept: true, depth: place.depth + 1 }, walk)
      return
    case 'columns':
      checkColumns(block, at, place, walk)
      return
    case 'section':
      checkSection(block, at, place, walk)
      return
    default:
      // A document from a runtime that knows a block this renderer does not.
      throw new RenderRefusal('unsupported', `${at} is a ${String((block as { kind?: unknown }).kind)} block, which the renderer does not know`, at)
  }
}

/** The digits a page number or count prints. */
const PAGE_DIGITS = '0123456789'

function checkImage(image: Image, place: Place, walk: Walk): void {
  const { id } = image.asset
  if (image.fit !== 'contain' && image.fit !== 'cover')
    throw new RenderRefusal('unsupported', `the image ${id} is fitted '${String(image.fit)}', which the renderer does not know`, id)
  if (!(image.width > 0 && image.height > 0 && Number.isFinite(image.width) && Number.isFinite(image.height))) {
    throw new RenderRefusal('unsupported', `the image ${id} is drawn ${image.width} × ${image.height} pt`, id)
  }
  if (image.width > place.width)
    throw new RenderRefusal('content-too-large', `the image ${id} is ${image.width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, id)
  tall(walk, place, image.height, `the image ${id}`, id)
}

/** A QR code is a square that stands where an image may: no wider than where it stands, no taller than the body. */
function checkQrCode(code: QrCode, place: Place, walk: Walk): void {
  const { id, size } = code
  if (!(size > 0 && Number.isFinite(size))) throw new RenderRefusal('unsupported', `the QR code ${id} is drawn ${size} pt a side`, id)
  if (size > place.width) throw new RenderRefusal('content-too-large', `the QR code ${id} is ${size} pt wide; it stands ${place.width.toFixed(2)} pt wide`, id)
  walk.codes.set(code, qrSymbol(code))
  tall(walk, place, size, `the QR code ${id}`, id)
}

/** An EPC QR code is a square that stands where a QR code may, and its caption, when it has one, is drawn inside it. */
function checkEpcQrCode(code: EpcQrCode, place: Place, walk: Walk): void {
  const { id, size } = code
  if (!(size > 0 && Number.isFinite(size))) throw new RenderRefusal('unsupported', `the EPC QR code ${id} is drawn ${size} pt a side`, id)
  if (size > place.width)
    throw new RenderRefusal('content-too-large', `the EPC QR code ${id} is ${size} pt wide; it stands ${place.width.toFixed(2)} pt wide`, id)
  walk.codes.set(code, epcSymbol(code))
  walk.captioned ||= code.caption !== undefined
  tall(walk, place, size, `the EPC QR code ${id}`, id)
}

function checkRectangle(rectangle: Rectangle, at: string, place: Place, walk: Walk): void {
  if (!(rectangle.width > 0 && rectangle.height > 0 && Number.isFinite(rectangle.width) && Number.isFinite(rectangle.height))) {
    throw new RenderRefusal('unsupported', `${at} is a rectangle of ${rectangle.width} × ${rectangle.height} pt`, at)
  }
  checkColor(rectangle.fill, at)
  checkColor(rectangle.stroke, at)
  if (rectangle.width > place.width)
    throw new RenderRefusal('content-too-large', `${at} is a rectangle ${rectangle.width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, at)
  tall(walk, place, rectangle.height, `the rectangle ${at}`, at)
}

function checkColumns(columns: Columns, at: string, place: Place, walk: Walk): void {
  if (columns.columns.length === 0) throw new RenderRefusal('unsupported', `${at} is a columns block with no columns`, at)
  const widths = columns.columns.map((slot) => slot.width)
  if (widths.some((width) => width !== 'fill' && !(width > 0 && Number.isFinite(width))))
    throw new RenderRefusal('unsupported', `${at} has a column of no width`, at)
  const fixed = widths.reduce<number>((sum, each) => sum + fixedWidth(each), 0)
  const fill = fillWidth(widths, place.width)
  if (fixed > place.width || fill <= 0)
    throw new RenderRefusal('content-too-large', `${at}'s fixed columns are ${fixed} pt wide; it stands ${place.width.toFixed(2)} pt wide`, at)
  columns.columns.forEach((slot, index) => {
    const width = slot.width === 'fill' ? fill : slot.width
    checkBlocks(slot.blocks, `${at}.columns[${index}].blocks`, { ...place, column: true, width, depth: place.depth + 1 }, walk)
  })
}

function checkSection(section: Section, at: string, place: Place, walk: Walk): void {
  if (section.border !== undefined) {
    if (!(section.border.thickness > 0 && Number.isFinite(section.border.thickness)))
      throw new RenderRefusal('unsupported', `${at} has a border ${section.border.thickness} pt thick`, at)
    checkColor(section.border.color, at)
  }
  checkColor(section.fill, at)
  if (section.padding !== undefined && !(section.padding >= 0 && Number.isFinite(section.padding)))
    throw new RenderRefusal('unsupported', `${at} has a padding of ${section.padding} pt`, at)
  const frame = frameOf(section)
  const width = place.width - 2 * frame
  if (width <= 0) throw new RenderRefusal('content-too-large', `${at}'s border and padding leave its blocks no width`, at)
  // Its border and padding above and below, on every page it reaches: taller than the body, they leave its blocks no height.
  if (frame > 0) tall(walk, place, 2 * frame, `the border and padding of ${at}`, at)
  checkBlocks(section.blocks, `${at}.blocks`, { ...place, width, inset: place.inset + 2 * frame, depth: place.depth + 1 }, walk)
}

/**
 * Refuses what the body cannot hold once its height is known: a block of
 * fixed height, or a line, taller than a page's body less the frames around
 * it. pdfmake would draw it past the foot of the page, or not at all.
 */
export function refuseTall(tall: readonly Tall[], bodyHeight: number): void {
  for (const each of tall) {
    if (each.height > bodyHeight - each.inset) {
      throw new RenderRefusal(
        'content-too-large',
        `${each.what} is ${each.height.toFixed(2)} pt tall; the body is ${(bodyHeight - each.inset).toFixed(2)} pt where it stands`,
        each.subject,
      )
    }
  }
}
