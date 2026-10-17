import { RenderRefusal, type Block, type Columns, type EpcQrCode, type Image, type ImageAsset, type KeepTogether, type QrCode, type Rectangle, type ResolvedDocument, type Section, type Table, type TextStyle } from '@formancy/report-runtime'
import { checkImageAsset, MAX_IMAGE_DATA, type Pixels } from './assets.js'
import { frameOf, RULE_GAP } from './content.js'
import { epcSymbol } from './epc.js'
import { codePoint, faceOf, missingGlyph, type Glyphs } from './glyphs.js'
import { qrSymbol, type QrSymbol } from './qr.js'
import { COLOR, FONTS, LINE_FACTOR } from './style.js'
import { KIND_BOLD, PADDING_X, PADDING_Y } from './table.js'
import { fillWidth, fixedWidth } from './widths.js'

/**
 * What the renderer refuses before pdfmake sees the document: what pdfmake
 * cannot print, what is malformed, what stands where it cannot be laid out,
 * what is wider than where it stands, and text with a character the face
 * it prints in has no glyph for (`glyphs.ts`). Every refusal names where the
 * problem is -- `body[2].blocks[0]`, a table's id, an asset's id -- and none
 * of them is a partial render: a document that is refused has drawn nothing.
 *
 * The walk also collects what can only be judged once the page regions are
 * measured -- whatever is too tall for any page's body -- and what the body
 * pass measures: its tables and keep-together blocks, each at the width it
 * stands at. It encodes every QR code and EPC QR code, once, and what it
 * encodes is what every pass draws (`qr.ts`, `epc.ts`).
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

/** A block that is drawn at a fixed height, which no page may be too short for. */
export interface Tall {
  readonly height: number
  /** The vertical space framed sections around it take from a page: their borders and padding, above and below. */
  readonly inset: number
  readonly what: string
  readonly subject: string
}

/** A table or keep-together block of the body that the body pass measures, at the width it stands at. */
export interface Measured {
  readonly block: Table | KeepTogether
  readonly at: string
  readonly width: number
  readonly inset: number
}

export interface Checked {
  readonly page: Page
  readonly creationDate: Date
  /** Every image's size in pixels, as it is shown. */
  readonly pixels: ReadonlyMap<ImageAsset, Pixels>
  /** Every QR code's and EPC QR code's symbol, encoded once. */
  readonly codes: ReadonlyMap<QrCode | EpcQrCode, QrSymbol>
  /** Whether an EPC QR code is captioned: its caption prints in Liberation Sans, which the engine loads for it. */
  readonly captioned: boolean
  /** In the body: judged against its height once the regions are measured. */
  readonly tall: readonly Tall[]
  /** Where each paragraph stands, for a refusal about its words to name. */
  readonly paths: ReadonlyMap<Block, string>
  readonly measured: readonly Measured[]
}

/** Where a block stands. */
interface Place {
  readonly region: boolean
  /** Inside a keep-together block. */
  readonly kept: boolean
  /** Inside a columns block. */
  readonly column: boolean
  readonly width: number
  readonly inset: number
  readonly depth: number
}

interface Walk {
  readonly glyphs: Glyphs
  readonly paths: Map<Block, string>
  readonly images: { readonly image: Image; readonly at: string }[]
  readonly codes: Map<QrCode | EpcQrCode, QrSymbol>
  captioned: boolean
  readonly tall: Tall[]
  readonly measured: Measured[]
}

export async function checkDocument(document: ResolvedDocument, glyphs: Glyphs): Promise<Checked> {
  const creationDate = new Date(document.info.creationDate)
  if (Number.isNaN(creationDate.getTime())) throw new RenderRefusal('unsupported', `the creation date '${document.info.creationDate}' is not a date`, 'info.creationDate')
  // The title goes into the PDF's metadata, never onto a page, so it is held to being text and not to the font.
  if (typeof document.info.title !== 'string') throw new RenderRefusal('unsupported', 'the title is not text', 'info.title')
  const page = pageOf(document.page)
  const walk: Walk = { glyphs, paths: new Map(), images: [], codes: new Map(), captioned: false, tall: [], measured: [] }
  const top: Omit<Place, 'region'> = { kept: false, column: false, width: page.width, inset: 0, depth: 0 }
  checkBlocks(document.pageHeader, 'pageHeader', { ...top, region: true }, walk)
  checkBlocks(document.pageFooter, 'pageFooter', { ...top, region: true }, walk)
  checkBlocks(document.body, 'body', { ...top, region: false }, walk)
  const pixels = new Map<ImageAsset, Pixels>()
  let data = 0
  for (const { image } of walk.images) {
    if (pixels.has(image.asset)) continue
    const read = await checkImageAsset(image.asset)
    data += read.data
    if (data > MAX_IMAGE_DATA) throw new RenderRefusal('content-too-large', `the images up to ${image.asset.id} hold ${data} bytes of image data; a render may hold ${MAX_IMAGE_DATA}`, image.asset.id)
    pixels.set(image.asset, read)
  }
  return { page, creationDate, pixels, codes: walk.codes, captioned: walk.captioned, tall: walk.tall, paths: walk.paths, measured: walk.measured }
}

function pageOf(setup: ResolvedDocument['page']): Page {
  // Own sizes only: 'constructor' or 'toString' would find Object's, and crash pdfmake.
  const paper = Object.hasOwn(PAPER, setup.size) ? PAPER[setup.size] : undefined
  if (paper === undefined) throw new RenderRefusal('unsupported', `the page size '${String(setup.size)}' is not one the renderer knows`, 'page.size')
  if (setup.orientation !== 'portrait' && setup.orientation !== 'landscape') throw new RenderRefusal('unsupported', `the orientation '${String(setup.orientation)}' is not one the renderer knows`, 'page.orientation')
  const [paperWidth, paperHeight] = setup.orientation === 'portrait' ? [paper.width, paper.height] : [paper.height, paper.width]
  const { margins } = setup
  if (![margins.top, margins.right, margins.bottom, margins.left].every((margin) => Number.isFinite(margin) && margin >= 0)) {
    throw new RenderRefusal('unsupported', 'a page margin is negative or not a number', 'page.margins')
  }
  const width = paperWidth - margins.left - margins.right
  const height = paperHeight - margins.top - margins.bottom
  if (width <= 0 || height <= 0) throw new RenderRefusal('content-too-large', `the margins leave no printable area (${width.toFixed(2)} × ${height.toFixed(2)} pt)`, 'page.margins')
  return { paperWidth, paperHeight, margins, width, height }
}

function checkBlocks(blocks: readonly Block[], path: string, place: Place, walk: Walk): void {
  if (place.depth > MAX_DEPTH) throw new RenderRefusal('unsupported', `${path} is nested more than ${MAX_DEPTH} blocks deep`, path)
  blocks.forEach((block, index) => checkBlock(block, `${path}[${index}]`, place, walk))
}

function checkBlock(block: Block, at: string, place: Place, walk: Walk): void {
  switch (block.kind) {
    case 'paragraph':
      walk.paths.set(block, at)
      if (!place.region && block.runs.some((run) => 'field' in run)) {
        throw new RenderRefusal('unsupported', `${at} prints a page field; pdfmake knows the page number only in the page header and footer`, at)
      }
      checkStyle(block.style, at)
      if (block.runs.some((run) => !('text' in run) && run.field !== 'pageNumber' && run.field !== 'pageCount')) throw new RenderRefusal('unsupported', `${at} prints a field the renderer does not know`, at)
      for (const run of block.runs) {
        if ('text' in run) checkText(run.text, faceOf(run.bold ?? block.style?.bold ?? false, block.style?.italic ?? false), walk, at)
      }
      tall(walk, place, (block.style?.size ?? 0) * LINE_FACTOR, `a line of ${at}`, at)
      return
    case 'table':
      if (place.column) throw new RenderRefusal('unsupported', `table ${block.id} stands inside a columns block; a table is part of the flow`, block.id)
      checkTable(block, place.width)
      checkTableText(block, walk)
      tall(walk, place, tallestCellLine(block), `a line of table ${block.id}`, block.id)
      if (!place.region && !place.kept) walk.measured.push({ block, at, width: place.width, inset: place.inset })
      return
    case 'image':
      checkImage(block, place, walk)
      walk.images.push({ image: block, at })
      return
    case 'qrCode':
      checkQrCode(block, place, walk)
      return
    case 'epcQrCode':
      checkEpcQrCode(block, place, walk)
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
      if (!place.region && !place.kept) walk.measured.push({ block, at, width: place.width, inset: place.inset })
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

/** Something drawn at a fixed height in the body: judged against the body once the regions are measured. A page region's is judged by measuring the region. */
function tall(walk: Walk, place: Place, height: number, what: string, subject: string): void {
  if (!place.region) walk.tall.push({ height, inset: place.inset, what, subject })
}

/**
 * Text, held to being a string -- an array would reach pdfmake as inlines
 * carrying any property of its own, a link among them -- and to the face it
 * prints in, which must have a glyph for each of its characters.
 */
function checkText(text: unknown, face: keyof Glyphs, walk: Walk, at: string, subject = at): void {
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `${at} prints something that is not text`, subject)
  const missing = missingGlyph(text, walk.glyphs[face])
  if (missing !== undefined) {
    throw new RenderRefusal('unsupported', `${at} prints ${codePoint(missing)}, which Roboto has no glyph for: it would print as an empty box, and as nothing in the PDF's text, and no other font is embedded`, subject)
  }
}

/** Every cell of `table` as text in the face it prints in: the renderer's weight for its row's kind, under the cell's style. */
function checkTableText(table: Table, walk: Walk): void {
  const at = `table ${table.id}`
  const face = (style: TextStyle | null | undefined, bold: boolean, italic = false): keyof Glyphs => faceOf(style?.bold ?? bold, style?.italic ?? italic)
  table.header.forEach((text, column) => checkText(text, face(table.headerStyle, KIND_BOLD.header), walk, `${at}'s header, column ${column + 1},`, table.id))
  checkText(table.emptyText, face(undefined, KIND_BOLD.empty, true), walk, `${at}'s empty text`, table.id)
  table.rows.forEach((row, index) => {
    row.cells.forEach((text, column) => {
      checkText(text, face(row.cellStyles?.[column] ?? row.style, KIND_BOLD[row.kind]), walk, `${at}, row ${index}, column ${column + 1},`, table.id)
    })
  })
}

function checkStyle(style: TextStyle | undefined, at: string): void {
  if (style === undefined) return
  // Own tokens only: 'constructor' would find Object's, and crash pdfmake.
  if (style.font !== undefined && !Object.hasOwn(FONTS, style.font)) {
    throw new RenderRefusal('unsupported', `${at} is set in the ${String(style.font)} font; the renderer embeds Roboto alone, as the sans font, and prints no other in its place`, at)
  }
  if (style.size !== undefined && !(style.size > 0 && Number.isFinite(style.size))) throw new RenderRefusal('unsupported', `${at} is set at ${style.size} pt`, at)
  if (style.align !== undefined && style.align !== 'left' && style.align !== 'center' && style.align !== 'right') throw new RenderRefusal('unsupported', `${at} is aligned '${String(style.align)}'`, at)
  checkColor(style.color, at)
}

function checkColor(color: string | undefined, at: string): void {
  // pdfmake prints a colour it cannot read as black, without a word.
  if (color !== undefined && !COLOR.test(color)) throw new RenderRefusal('unsupported', `${at} names the colour '${color}', which is not #rrggbb in lower case`, at)
}

function checkTable(table: Table, width: number): void {
  const columns = table.columns.length
  if (columns === 0) throw new RenderRefusal('unsupported', `table ${table.id} has no columns`, table.id)
  if (table.columns.some((column) => column.align !== 'left' && column.align !== 'center' && column.align !== 'right')) throw new RenderRefusal('unsupported', `table ${table.id} aligns a column in a way the renderer does not know`, table.id)
  if (table.header.length !== columns) throw new RenderRefusal('unsupported', `the header of table ${table.id} has ${table.header.length} cells for ${columns} columns`, table.id)
  table.rows.forEach((row, index) => {
    const cells = row.across === true ? 1 : columns
    if (row.cells.length !== cells) {
      throw new RenderRefusal('unsupported', `row ${index} of table ${table.id} has ${row.cells.length} cells for ${row.across === true ? 'a row across the table, which has one' : `${columns} columns`}`, table.id)
    }
    if (row.cellStyles !== undefined && row.cellStyles.length !== row.cells.length) {
      throw new RenderRefusal('unsupported', `row ${index} of table ${table.id} has ${row.cellStyles.length} cell styles for ${row.cells.length} cells`, table.id)
    }
    for (const style of [row.style, ...(row.cellStyles ?? [])]) checkStyle(style ?? undefined, table.id)
  })
  checkStyle(table.headerStyle, table.id)
  const narrow = table.columns.find((column) => column.width !== 'fill' && !(column.width > 2 * PADDING_X && Number.isFinite(column.width)))
  if (narrow !== undefined) throw new RenderRefusal('unsupported', `table ${table.id} has a column of ${String(narrow.width)} pt, no wider than its cell padding`, table.id)
  const widths = table.columns.map((column) => column.width)
  const fixed = widths.reduce<number>((sum, each) => sum + fixedWidth(each), 0)
  if (fixed > width || fillWidth(widths, width) <= 2 * PADDING_X) {
    throw new RenderRefusal('content-too-large', `table ${table.id}'s fixed columns are ${fixed} pt wide; it stands ${width.toFixed(2)} pt wide`, table.id)
  }
}

/** The tallest line a cell of the table prints, with the cell's padding: a row no page can start. */
function tallestCellLine(table: Table): number {
  const styles = [table.headerStyle, ...table.rows.flatMap((row) => [row.style, ...(row.cellStyles ?? [])])]
  const size = Math.max(0, ...styles.map((style) => style?.size ?? 0))
  return size * LINE_FACTOR + 2 * PADDING_Y
}

function checkImage(image: Image, place: Place, walk: Walk): void {
  const { id } = image.asset
  if (image.fit !== 'contain' && image.fit !== 'cover') throw new RenderRefusal('unsupported', `the image ${id} is fitted '${String(image.fit)}', which the renderer does not know`, id)
  if (!(image.width > 0 && image.height > 0 && Number.isFinite(image.width) && Number.isFinite(image.height))) {
    throw new RenderRefusal('unsupported', `the image ${id} is drawn ${image.width} × ${image.height} pt`, id)
  }
  if (image.width > place.width) throw new RenderRefusal('content-too-large', `the image ${id} is ${image.width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, id)
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
  if (size > place.width) throw new RenderRefusal('content-too-large', `the EPC QR code ${id} is ${size} pt wide; it stands ${place.width.toFixed(2)} pt wide`, id)
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
  if (rectangle.width > place.width) throw new RenderRefusal('content-too-large', `${at} is a rectangle ${rectangle.width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, at)
  tall(walk, place, rectangle.height, `the rectangle ${at}`, at)
}

function checkColumns(columns: Columns, at: string, place: Place, walk: Walk): void {
  if (columns.columns.length === 0) throw new RenderRefusal('unsupported', `${at} is a columns block with no columns`, at)
  const widths = columns.columns.map((slot) => slot.width)
  if (widths.some((width) => width !== 'fill' && !(width > 0 && Number.isFinite(width)))) throw new RenderRefusal('unsupported', `${at} has a column of no width`, at)
  const fixed = widths.reduce<number>((sum, each) => sum + fixedWidth(each), 0)
  const fill = fillWidth(widths, place.width)
  if (fixed > place.width || fill <= 0) throw new RenderRefusal('content-too-large', `${at}'s fixed columns are ${fixed} pt wide; it stands ${place.width.toFixed(2)} pt wide`, at)
  columns.columns.forEach((slot, index) => {
    const width = slot.width === 'fill' ? fill : slot.width
    checkBlocks(slot.blocks, `${at}.columns[${index}].blocks`, { ...place, column: true, width, depth: place.depth + 1 }, walk)
  })
}

function checkSection(section: Section, at: string, place: Place, walk: Walk): void {
  if (section.border !== undefined) {
    if (!(section.border.thickness > 0 && Number.isFinite(section.border.thickness))) throw new RenderRefusal('unsupported', `${at} has a border ${section.border.thickness} pt thick`, at)
    checkColor(section.border.color, at)
  }
  checkColor(section.fill, at)
  if (section.padding !== undefined && !(section.padding >= 0 && Number.isFinite(section.padding))) throw new RenderRefusal('unsupported', `${at} has a padding of ${section.padding} pt`, at)
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
      throw new RenderRefusal('content-too-large', `${each.what} is ${each.height.toFixed(2)} pt tall; the body is ${(bodyHeight - each.inset).toFixed(2)} pt where it stands`, each.subject)
    }
  }
}
