import {
  BASELINE_SHIFTS,
  RenderRefusal,
  type Block,
  type Chart,
  type Columns,
  type Image,
  type ImageAsset,
  type Paragraph,
  type QrSymbol,
  type Rectangle,
  type ResolvedDocument,
  type Section,
} from '@formancy/report-runtime'
import type { Picture } from './assets.js'
import { checkChart } from './chart-check.js'
import { chartCount } from './charts.js'
import { readPictures } from './check-pictures.js'
import { checkTable } from './check-table.js'
import { checkColor, checkStyle, checkText, checkWritten } from './check-text.js'
import { checkLine, NO_LENGTH, shown, tooSmall } from './check-units.js'
import { count, family, tall, type Walk } from './check-walk.js'
import { codeCount, codeSymbol, type Code } from './codes.js'
import { copyLabel } from './copy.js'
import { createdOf } from './created.js'
import type { DocxFonts } from './fonts.js'
import { ONE_CELL_TABLE } from './limits.js'
import { lineEndings } from './nodes.js'
import { pageOf, type Page } from './page.js'
import { refusePdfOnly } from './pdf-only.js'
import { slipCount } from './slip.js'
import { planSlip, type PlannedSlip } from './slip-plan.js'
import { fillWidth, fixedWidth } from './widths.js'

/**
 * Everything a Word file's writer refuses, before a byte is written
 * (0068): a document that is refused has written nothing.
 *
 * In this order, so that a refusal is the same whichever way a document
 * is wrong twice: before any of this, a face that is no font, or whose
 * family a Word file cannot name, which is refused as the fonts are read
 * (`render.ts`, `fonts.ts`); then the creation date (`created.ts`) and
 * the title; what
 * belongs to the PDF of the document itself (`pdf-only.ts`) and a copy
 * of an e-invoice not labelled as one on every header (`copy.ts`, 0077);
 * the page;
 * then the page header, page 1's own, the page footer and the body, each
 * block in document order, a table where the walk meets it
 * (`check-table.ts`); the pictures' bytes, in the order the walk met
 * them (`check-pictures.ts`); and last a QR-bill's payment part and its
 * slip (`slip-plan.ts`, 0075). It is the PDF renderer's order for what
 * both refuse -- its
 * fonts, its walk, its `check-images.ts`, then its bill -- which
 * `against-pdf.test.ts` holds on a document wrong in every one of those
 * places.
 *
 * Four kinds of refusal come of it. **What no engine prints** of a
 * document, which is the PDF renderer's contract with it stated again: a
 * block that stands where none may, a width, a size, a colour, a field
 * the document's types do not hold, bytes that are no picture -- by the
 * PDF renderer's codes and subjects, which `against-pdf.test.ts` holds
 * one list of malformed documents to in both engines; a code among it,
 * by the one rule both engines ask (0074, `codes.ts`), and a chart, whose
 * contract is stated again (0076, `chart-check.ts`). **What belongs to
 * the PDF, and what nobody has seen Word print as the PDF does**, each
 * `unsupported`. **What Word's units do not state**, each `unsupported`
 * (`check-units.ts`): a line lighter or heavier than its borders hold,
 * and a rectangle, a column, a framed section or a picture so small that
 * its width or its height rounds to none of the unit it is written in.
 * And **the writer's own bounds**, each `content-too-large`: a picture, a
 * rectangle or a spacer taller than the printable area, which no page of
 * a Word file holds; and the file's paragraphs, its text's characters
 * and runs, as the walk counts them (`check-walk.ts`), its codes, its
 * charts and their points, its pictures, their bytes and their image
 * data (`limits.ts`); and a slip's line wider than its place, or
 * information taller than its section.
 *
 * What the PDF renderer refuses of what it measured -- a block taller
 * than the body between its regions, a line it cannot place, more pages
 * than a host allows -- is not here: the writer measures nothing.
 *
 * This module is the order and the walk: where each block stands, what
 * may not stand there, and what each kind of block is held to that no
 * module of its own holds. It changes when the order does, when a kind of
 * block is added, or when what may stand where does.
 */

/** How deep blocks may nest: the PDF renderer's bound on its recursion, and this walk's. */
export const MAX_DEPTH = 16

export interface Checked {
  readonly page: Page
  /** The creation date as the core properties state it: the document's instant in UTC, to the second. */
  readonly created: string
  /** Every picture's asset as it is embedded, read once however many images draw it. */
  readonly pictures: ReadonlyMap<ImageAsset, Picture>
  /** Every QR code's and EPC QR code's symbol, as the runtime decided it, once: what is refused and what is written are one symbol. */
  readonly codes: ReadonlyMap<Code, QrSymbol>
  /** The QR-bill's slip, planned line by line, where the document is paid by one (0075). */
  readonly slip?: PlannedSlip
  /** The label every header opens with, as the document carries it, where the document is a copy of an e-invoice (0077). */
  readonly copy?: Paragraph
}

/** Where a block stands. */
interface Place {
  /** In a page region, not the body. */
  readonly region: boolean
  /** In the page header or footer, which every page prints with its number: not page 1's own header, nor the body. */
  readonly everyPage: boolean
  readonly kept: boolean
  readonly column: boolean
  /** Inside a section with a frame, which a Word file writes as a table's cell. */
  readonly framed: boolean
  readonly width: number
  readonly depth: number
}

export function checkDocument(document: ResolvedDocument, fonts: DocxFonts): Checked {
  const created = createdOf(document.info.creationDate)
  // The title goes into the file's properties, never onto a page: held to being text XML holds, and to no font.
  checkWritten(document.info.title, 'the title', 'info.title')
  refusePdfOnly(document)
  const copy = copyLabel(document)
  const labelled = copy === undefined ? {} : { copy }
  const page = pageOf(document.page)
  const walk: Walk = { fonts, page, images: [], codes: new Map(), met: 0, modules: 0, charts: 0, points: 0, paragraphs: 0, characters: 0, runs: 0, families: 0 }
  const top = { kept: false, column: false, framed: false, width: page.width, depth: 0 }
  checkBlocks(document.pageHeader, 'pageHeader', { ...top, region: true, everyPage: true }, walk)
  if (document.firstPageHeader !== undefined) checkBlocks(document.firstPageHeader, 'firstPageHeader', { ...top, region: true, everyPage: false }, walk)
  checkBlocks(document.pageFooter, 'pageFooter', { ...top, region: true, everyPage: true }, walk)
  const before = walk.paragraphs
  checkBlocks(document.body, 'body', { ...top, region: false, everyPage: false }, walk)
  const empty = walk.paragraphs === before
  const pictures = readPictures(walk.images)
  // The payment part last, where the PDF renderer checks it: a document wrong in a block and in its bill is refused for the block by both.
  if (document.paymentPart === undefined) return { page, created, pictures, codes: walk.codes, ...labelled }
  const slip = planSlip(document.paymentPart, document.page)
  // Its page's paragraphs; the line a body of nothing is given to end the report's section with; and the empty header's and footer's
  // of its page, where the report prints its own (`package.ts`).
  const { paragraphs, characters, runs } = slipCount(slip)
  const beside = (empty ? 1 : 0) + (document.pageHeader.length > 0 ? 1 : 0) + (document.pageFooter.length > 0 ? 1 : 0)
  count(walk, paragraphs + beside, characters, 'paymentPart', runs)
  // Of a copy that header's paragraph is the label and no empty line (`package.ts`, 0077): the one paragraph counted above, with its text and its run.
  if (copy !== undefined) count(walk, 0, (copy.runs[0] as { readonly text: string }).text.length + family(walk, copy.style?.font, 2), 'paymentPart', 1)
  return { page, created, pictures, codes: walk.codes, slip, ...labelled }
}

function checkBlocks(blocks: readonly Block[], path: string, place: Place, walk: Walk): void {
  if (place.depth > MAX_DEPTH) throw new RenderRefusal('unsupported', `${path} is nested more than ${MAX_DEPTH} blocks deep`, path)
  blocks.forEach((block, index) => checkBlock(block, `${path}[${index}]`, place, walk))
}

function checkBlock(block: Block, at: string, place: Place, walk: Walk): void {
  switch (block.kind) {
    case 'paragraph':
      checkParagraph(block, at, place, walk)
      return
    case 'table':
      if (place.column) throw new RenderRefusal('unsupported', `table ${block.id} stands inside a columns block; a table is part of the flow`, block.id)
      checkTable(block, place.width, walk)
      if (place.framed) {
        // What is not known of a table inside a cell: of one with a header row, whether Word repeats it; of one without (0078), whether
        // Word breaks the table across pages at all, its rows kept as the PDF keeps them. Either is refused, for its own reason.
        const unknown =
          block.header === undefined
            ? 'whether Word breaks a table inside a cell across pages, its rows kept together as the PDF keeps them, is not known here'
            : 'whether Word repeats the header row of a table inside a cell is not known here'
        throw new RenderRefusal(
          'unsupported',
          `table ${block.id} stands in a section with a border, a fill or padding, which a Word file writes as a table's cell; ${unknown}: take the section's frame away, or print the report as a PDF`,
          block.id,
        )
      }
      return
    case 'image':
      checkImage(block, place, walk)
      return
    case 'qrCode':
    case 'epcQrCode':
      checkCode(block, place, walk)
      return
    case 'chart':
      checkDrawnChart(block, place, walk)
      return
    case 'rule':
      if (!(block.thickness > 0 && Number.isFinite(block.thickness))) throw new RenderRefusal('unsupported', `${at} is a rule ${block.thickness} pt thick`, at)
      checkColor(block.color, at)
      checkLine(block.thickness, `${at} is a rule`, at)
      count(walk, 1, 0, at)
      return
    case 'rectangle':
      checkRectangle(block, at, place, walk)
      return
    case 'spacer':
      if (!(block.height >= 0 && Number.isFinite(block.height))) throw new RenderRefusal('unsupported', `${at} is a spacer ${block.height} pt tall`, at)
      tall(block.height, `the spacer ${at}`, at, walk)
      count(walk, 1, 0, at)
      return
    case 'pageBreak': {
      const inside = place.region ? 'page region' : place.kept ? 'keep-together block' : place.column ? 'columns block' : undefined
      if (inside !== undefined) throw new RenderRefusal('unsupported', `${at} is a page break inside a ${inside}`, at)
      if (place.framed)
        throw new RenderRefusal(
          'unsupported',
          `${at} is a page break inside a section with a border, a fill or padding, which a Word file writes as a table's cell; Word starts no page inside a cell: take the section's frame away, or print the report as a PDF`,
          at,
        )
      count(walk, 1, 0, at)
      return
    }
    case 'keepTogether':
      checkBlocks(block.blocks, `${at}.blocks`, { ...place, kept: true, depth: place.depth + 1 }, walk)
      return
    case 'columns':
      checkColumns(block, at, place, walk)
      return
    case 'section':
      checkSection(block, at, place, walk)
      return
    default:
      throw new RenderRefusal('unsupported', `${at} is a ${String((block as { kind?: unknown }).kind)} block, which a Word file does not hold`, at)
  }
}

/** The digits a page number or count prints. */
const PAGE_DIGITS = '0123456789'

function checkParagraph(paragraph: Paragraph, at: string, place: Place, walk: Walk): void {
  if (!place.everyPage && paragraph.runs.some((run) => 'field' in run)) {
    const why = place.region
      ? "page 1's own header holds none, and page 1's number and count print in the page footer"
      : "a page's number and count print in the page header and footer alone"
    throw new RenderRefusal('unsupported', `${at} prints a page field; ${why}`, at)
  }
  const { style } = paragraph
  checkStyle(style, at, walk.fonts)
  if (paragraph.runs.some((run) => !('text' in run) && run.field !== 'pageNumber' && run.field !== 'pageCount'))
    throw new RenderRefusal('unsupported', `${at} prints a field a report does not know`, at)
  const known = paragraph.runs.every((run) => {
    const { baseline } = run as { readonly baseline?: unknown }
    return baseline === undefined || ('text' in run && BASELINE_SHIFTS.some((shift) => shift === baseline))
  })
  if (!known) throw new RenderRefusal('unsupported', `${at} sets a run below or above the line in a way a report does not know`, at)
  let characters = 0
  // A page field is written as three runs, its start, its instruction and its end; an empty run of text, which writes nothing, is still read.
  let [runs, endings] = [0, 0]
  for (const run of paragraph.runs) {
    runs += 'text' in run ? 1 : 3
    const face = { token: style?.font, bold: ('text' in run ? run.bold : undefined) ?? style?.bold ?? false, italic: style?.italic ?? false }
    if ('text' in run) {
      checkText(run.text, face, walk.fonts, at)
      characters += run.text.length
      endings += lineEndings(run.text)
    } else checkText(PAGE_DIGITS, face, walk.fonts, `${at}'s page field`, at)
  }
  // Every run states the paragraph's family, and so does its mark; a line ending states nothing, and is a run to the bound alone.
  count(walk, 1, characters + family(walk, style?.font, runs + 1), at, runs + endings)
}

function checkImage(image: Image, place: Place, walk: Walk): void {
  const { id } = image.asset
  if (image.fit !== 'contain' && image.fit !== 'cover')
    throw new RenderRefusal('unsupported', `the image ${id} is fitted '${String(image.fit)}', which a report does not know`, id)
  if (!(image.width > 0 && image.height > 0 && Number.isFinite(image.width) && Number.isFinite(image.height)))
    throw new RenderRefusal('unsupported', `the image ${id} is drawn ${image.width} × ${image.height} pt`, id)
  if (image.width > place.width)
    throw new RenderRefusal('content-too-large', `the image ${id} is ${image.width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, id)
  tall(image.height, `the image ${id}`, id, walk)
  walk.images.push(image)
  count(walk, 1, 0, id)
}

/**
 * A code is a square that stands where an image may. What it is refused
 * by but the file's bounds and its height is the runtime's, the one
 * decision both engines ask (0074): its symbol is asked for once where
 * it stands, held to what a file's codes may be together, and that
 * symbol is the one written (`codes.ts`). A block that stands twice is
 * two codes, each asked for where it stands and each counted.
 */
function checkCode(code: Code, place: Place, walk: Walk): void {
  const { id } = code
  const symbol = codeSymbol(code, place.width, { count: walk.met, modules: walk.modules })
  walk.codes.set(code, symbol)
  walk.met += 1
  walk.modules += symbol.modules.length ** 2
  tall(code.size, `the ${code.kind === 'qrCode' ? 'QR code' : 'EPC QR code'} ${id}`, id, walk)
  const { paragraphs, characters, runs } = codeCount(code)
  count(walk, paragraphs, characters, id, runs)
}

/**
 * A chart is a box that stands where an image may, in the body. What it
 * is refused by but its height is `chart-check.ts`'s, the contract every
 * engine holds a chart's block to and the file's bounds on its charts;
 * one that passes is counted with the file's paragraphs and characters,
 * every word and every digit its part states among them (`charts.ts`).
 */
function checkDrawnChart(chart: Chart, place: Place, walk: Walk): void {
  const points = checkChart(chart, place, walk.fonts, { count: walk.charts, points: walk.points })
  tall(chart.height, `the chart ${chart.id}`, chart.id, walk)
  if (chart.empty === undefined) walk.charts += 1
  walk.points += points
  const { paragraphs, characters, runs, families } = chartCount(chart)
  count(walk, paragraphs, characters + family(walk, chart.style?.font, families), chart.id, runs)
}

function checkRectangle(rectangle: Rectangle, at: string, place: Place, walk: Walk): void {
  if (!(rectangle.width > 0 && rectangle.height > 0 && Number.isFinite(rectangle.width) && Number.isFinite(rectangle.height)))
    throw new RenderRefusal('unsupported', `${at} is a rectangle of ${rectangle.width} × ${rectangle.height} pt`, at)
  checkColor(rectangle.fill, at)
  checkColor(rectangle.stroke, at)
  if (rectangle.width > place.width)
    throw new RenderRefusal('content-too-large', `${at} is a rectangle ${rectangle.width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, at)
  tall(rectangle.height, `the rectangle ${at}`, at, walk)
  if (tooSmall(rectangle.width) || tooSmall(rectangle.height))
    throw new RenderRefusal('unsupported', `${at} is a rectangle of ${rectangle.width} × ${rectangle.height} pt; ${NO_LENGTH}`, at)
  count(walk, ONE_CELL_TABLE, 0, at)
}

function checkColumns(columns: Columns, at: string, place: Place, walk: Walk): void {
  if (columns.columns.length === 0) throw new RenderRefusal('unsupported', `${at} is a columns block with no columns`, at)
  const widths = columns.columns.map((slot) => slot.width)
  if (widths.some((width) => width !== 'fill' && !(width > 0 && Number.isFinite(width))))
    throw new RenderRefusal('unsupported', `${at} has a column of no width`, at)
  const fixed = fixedWidth(widths)
  const fill = fillWidth(widths, place.width)
  if (fixed > place.width || fill <= 0)
    throw new RenderRefusal('content-too-large', `${at}'s fixed columns are ${fixed} pt wide; it stands ${place.width.toFixed(2)} pt wide`, at)
  // Each column is a cell of the block's table, a fill column at its share.
  const narrow = widths.map((width) => (width === 'fill' ? fill : width)).find(tooSmall)
  if (narrow !== undefined) throw new RenderRefusal('unsupported', `${at} has a column ${shown(narrow)} pt wide; ${NO_LENGTH}`, at)
  columns.columns.forEach((slot, index) => {
    // A cell ends with a paragraph, which an empty column or one that ends with a table is given.
    count(walk, 1, 0, at)
    checkBlocks(
      slot.blocks,
      `${at}.columns[${index}].blocks`,
      { ...place, column: true, width: slot.width === 'fill' ? fill : slot.width, depth: place.depth + 1 },
      walk,
    )
  })
}

/** Whether a section has a frame: a border, a fill or padding, any of which makes it a table's cell. Without one it is its blocks and nothing more. */
export function framed(section: Section): boolean {
  return section.border !== undefined || section.fill !== undefined || (section.padding ?? 0) > 0
}

function checkSection(section: Section, at: string, place: Place, walk: Walk): void {
  if (section.border !== undefined) {
    if (!(section.border.thickness > 0 && Number.isFinite(section.border.thickness)))
      throw new RenderRefusal('unsupported', `${at} has a border ${section.border.thickness} pt thick`, at)
    checkColor(section.border.color, at)
    checkLine(section.border.thickness, `${at} has a border`, at)
  }
  checkColor(section.fill, at)
  if (section.padding !== undefined && !(section.padding >= 0 && Number.isFinite(section.padding)))
    throw new RenderRefusal('unsupported', `${at} has a padding of ${section.padding} pt`, at)
  const frame = (section.border?.thickness ?? 0) + (section.padding ?? 0)
  const width = place.width - 2 * frame
  if (width <= 0) throw new RenderRefusal('content-too-large', `${at}'s border and padding leave its blocks no width`, at)
  if (framed(section)) {
    // A frame is a table of one cell, as wide as where the section stands.
    if (tooSmall(place.width))
      throw new RenderRefusal(
        'unsupported',
        `${at} is a section with a border, a fill or padding where it stands ${shown(place.width)} pt wide; ${NO_LENGTH}`,
        at,
      )
    count(walk, ONE_CELL_TABLE, 0, at)
  }
  checkBlocks(section.blocks, `${at}.blocks`, { ...place, width, framed: place.framed || framed(section), depth: place.depth + 1 }, walk)
}
