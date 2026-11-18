import {
  BASELINE_SHIFTS,
  MAX_KEEP_WITH_ROWS,
  RenderRefusal,
  type Block,
  type Columns,
  type Image,
  type ImageAsset,
  type Paragraph,
  type Rectangle,
  type ResolvedDocument,
  type Section,
  type Table,
} from '@formancy/report-runtime'
import { drawnSize, readPicture, type Picture } from './assets.js'
import { checkColor, checkStyle, checkText, checkWritten } from './check-text.js'
import type { DocxFonts } from './fonts.js'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_MEDIA_BYTES, MAX_DOCX_PARAGRAPHS, MAX_DOCX_PICTURES, MAX_DOCX_RUNS } from './limits.js'
import { PADDING_X } from './look.js'
import { refusePdfOnly, refusePdfOnlyBlock } from './pdf-only.js'
import { cellFace, styledRows } from './rows.js'
import { eighths, emu, MAX_BORDER, MIN_BORDER, twips } from './units.js'
import { fillWidth, fixedWidth } from './widths.js'

/**
 * Everything a Word file's writer refuses, before a byte is written
 * (0068): a document that is refused has written nothing.
 *
 * In this order, so that a refusal is the same whichever way a document
 * is wrong twice: the creation date and the title; what belongs to the
 * PDF of the document itself (`pdf-only.ts`); the page; then the page
 * header, page 1's own, the page footer and the body, each block in
 * document order; and last the pictures' bytes, in the order the walk met
 * them. It is the PDF renderer's order for what both refuse -- its walk,
 * then its `check-images.ts` -- which `against-pdf.test.ts` holds on a
 * document wrong in every one of those places.
 *
 * Four kinds of refusal come of it. **What no engine prints** of a
 * document, which is the PDF renderer's contract with it stated again: a
 * block that stands where none may, a width, a size, a colour, a field
 * the document's types do not hold, bytes that are no picture -- by the
 * PDF renderer's codes and subjects, which `against-pdf.test.ts` holds
 * one list of malformed documents to in both engines. **What belongs to
 * the PDF, and what nobody has seen Word print as the PDF does**, each
 * `unsupported`. **What Word's units do not state**, each `unsupported`:
 * a line lighter or heavier than its borders hold, and a rectangle, a
 * column, a framed section or a picture so small that its width or its
 * height rounds to none of the unit it is written in. And **the writer's
 * own bounds**, each `content-too-large`: a picture, a rectangle or a
 * spacer taller than the printable area, which no page of a Word file
 * holds; and the file's paragraphs, characters, pictures and pictures'
 * bytes (`limits.ts`).
 *
 * What the PDF renderer refuses of what it measured -- a block taller
 * than the body between its regions, a line it cannot place, more pages
 * than a host allows -- is not here: the writer measures nothing.
 */

/** The paper and its printable area, in points. */
export interface Page {
  readonly paperWidth: number
  readonly paperHeight: number
  readonly margins: ResolvedDocument['page']['margins']
  readonly width: number
  readonly height: number
}

/** Portrait sizes in points, as the PDF renderer writes them: ISO A4 is 210 by 297 millimetres, US Letter 8.5 by 11 inches. */
const PAPER: Readonly<Record<ResolvedDocument['page']['size'], { readonly width: number; readonly height: number }>> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
}

/** How deep blocks may nest: the PDF renderer's bound on its recursion, and this walk's. */
export const MAX_DEPTH = 16

export interface Checked {
  readonly page: Page
  /** The creation date as the core properties state it: the document's instant in UTC, to the second. */
  readonly created: string
  /** Every picture's asset as it is embedded, read once however many images draw it. */
  readonly pictures: ReadonlyMap<ImageAsset, Picture>
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

interface Walk {
  readonly fonts: DocxFonts
  readonly page: Page
  /** Every image, in the order the walk met it: its asset is read once every block has been walked (`readPictures`). */
  readonly images: Image[]
  paragraphs: number
  characters: number
  runs: number
}

export function checkDocument(document: ResolvedDocument, fonts: DocxFonts): Checked {
  const created = createdOf(document.info.creationDate)
  // The title goes into the file's properties, never onto a page: held to being text XML holds, and to no font.
  checkWritten(document.info.title, 'the title', 'info.title')
  refusePdfOnly(document)
  const page = pageOf(document.page)
  const walk: Walk = { fonts, page, images: [], paragraphs: 0, characters: 0, runs: 0 }
  const top = { kept: false, column: false, framed: false, width: page.width, depth: 0 }
  checkBlocks(document.pageHeader, 'pageHeader', { ...top, region: true, everyPage: true }, walk)
  if (document.firstPageHeader !== undefined) checkBlocks(document.firstPageHeader, 'firstPageHeader', { ...top, region: true, everyPage: false }, walk)
  checkBlocks(document.pageFooter, 'pageFooter', { ...top, region: true, everyPage: true }, walk)
  checkBlocks(document.body, 'body', { ...top, region: false, everyPage: false }, walk)
  return { page, created, pictures: readPictures(walk.images) }
}

/**
 * The forms of a date ECMAScript reads the same on every machine: a date
 * and time that states its zone, `Z` or an offset, and a date alone,
 * which is its first moment in UTC. A date and time without a zone is
 * read in the machine's own, and anything else in a way the platform
 * chooses.
 */
const INSTANT = /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/

/**
 * The creation date as the core properties state it: the document's
 * instant in UTC, to the second, written out here and never copied. The
 * runtime writes an instant with its zone (`canonicalInstant`); a
 * document made otherwise may state a date that is another moment in
 * another time zone, and the same document would then be another file
 * there, so one that states no instant is refused. The PDF renderer reads
 * the date as the platform does, and draws such a document.
 */
function createdOf(stated: string): string {
  const instant = new Date(stated)
  if (Number.isNaN(instant.getTime())) throw new RenderRefusal('unsupported', `the creation date '${stated}' is not a date`, 'info.creationDate')
  if (!INSTANT.test(stated))
    throw new RenderRefusal(
      'unsupported',
      `the creation date '${stated}' states no instant: a Word file is dated by an ISO 8601 date and time with its zone, Z or an offset, and a date without one is another moment on another machine`,
      'info.creationDate',
    )
  const created = `${instant.toISOString().slice(0, 19)}Z`
  // A core property's date is of four digits a year: one before the year 1 or past 9999 is no W3CDTF date.
  if (!/^\d{4}-/.test(created)) throw new RenderRefusal('unsupported', 'the creation date is of a year a Word file cannot state', 'info.creationDate')
  return created
}

function pageOf(setup: ResolvedDocument['page']): Page {
  // Own sizes only: 'constructor' or 'toString' would find Object's.
  const paper = Object.hasOwn(PAPER, setup.size) ? PAPER[setup.size] : undefined
  if (paper === undefined) throw new RenderRefusal('unsupported', `the page size '${String(setup.size)}' is not one a report prints on`, 'page.size')
  if (setup.orientation !== 'portrait' && setup.orientation !== 'landscape')
    throw new RenderRefusal('unsupported', `the orientation '${String(setup.orientation)}' is not one a report prints in`, 'page.orientation')
  const [paperWidth, paperHeight] = setup.orientation === 'portrait' ? [paper.width, paper.height] : [paper.height, paper.width]
  const { margins } = setup
  if (![margins.top, margins.right, margins.bottom, margins.left].every((margin) => Number.isFinite(margin) && margin >= 0))
    throw new RenderRefusal('unsupported', 'a page margin is negative or not a number', 'page.margins')
  const width = paperWidth - margins.left - margins.right
  const height = paperHeight - margins.top - margins.bottom
  if (width <= 0 || height <= 0)
    throw new RenderRefusal('content-too-large', `the margins leave no printable area (${width.toFixed(2)} × ${height.toFixed(2)} pt)`, 'page.margins')
  return { paperWidth, paperHeight, margins, width, height }
}

/**
 * So many paragraphs, characters and runs of text more, refused past any
 * bound, naming where the count crossed it. A block that writes no run
 * of text, a spacer or a picture, counts none.
 */
function count(walk: Walk, paragraphs: number, characters: number, subject: string, runs = 0): void {
  walk.paragraphs += paragraphs
  walk.characters += characters
  walk.runs += runs
  if (walk.paragraphs > MAX_DOCX_PARAGRAPHS)
    throw new RenderRefusal(
      'content-too-large',
      `the report holds more than ${MAX_DOCX_PARAGRAPHS} paragraphs, a table's cell being one; a Word file holds no more`,
      subject,
    )
  if (walk.characters > MAX_DOCX_CHARACTERS)
    throw new RenderRefusal('content-too-large', `the report's text is more than ${MAX_DOCX_CHARACTERS} characters long; a Word file holds no more`, subject)
  if (walk.runs > MAX_DOCX_RUNS)
    throw new RenderRefusal(
      'content-too-large',
      `the report's text is held in more than ${MAX_DOCX_RUNS} runs, a page field being three and a table's cell one; a Word file holds no more`,
      subject,
    )
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
      if (place.framed)
        throw new RenderRefusal(
          'unsupported',
          `table ${block.id} stands in a section with a border, a fill or padding, which a Word file writes as a table's cell; whether Word repeats the header row of a table inside a cell is not known here: take the section's frame away, or print the report as a PDF`,
          block.id,
        )
      return
    case 'image':
      checkImage(block, place, walk)
      return
    case 'qrCode':
    case 'epcQrCode':
    case 'chart':
      return refusePdfOnlyBlock(block)
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
  let runs = 0
  for (const run of paragraph.runs) {
    runs += 'text' in run ? 1 : 3
    const face = { token: style?.font, bold: ('text' in run ? run.bold : undefined) ?? style?.bold ?? false, italic: style?.italic ?? false }
    if ('text' in run) {
      checkText(run.text, face, walk.fonts, at)
      characters += run.text.length
    } else checkText(PAGE_DIGITS, face, walk.fonts, `${at}'s page field`, at)
  }
  count(walk, 1, characters, at, runs)
}

/** A line's weight held to what Word's borders hold: from a quarter of a point to twelve, in eighths. */
function checkLine(weight: number, what: string, subject: string): void {
  if (eighths(weight) < eighths(MIN_BORDER) || eighths(weight) > eighths(MAX_BORDER))
    throw new RenderRefusal('unsupported', `${what} ${weight} pt thick; a line of a Word file is from ${MIN_BORDER} to ${MAX_BORDER} pt`, subject)
}

/** Something of a fixed height: taller than the printable area, no page of a Word file holds it. */
function tall(height: number, what: string, subject: string, walk: Walk): void {
  if (height > walk.page.height)
    throw new RenderRefusal('content-too-large', `${what} is ${height} pt tall; the printable area is ${walk.page.height.toFixed(2)} pt`, subject)
}

/** A length as a sentence states one: to four digits, so that a share of a width is not its every binary place. */
const shown = (points: number): string => String(Number(points.toPrecision(4)))

/**
 * Whether a length rounds to none of Word's twentieths of a point: one
 * under a fortieth. A table that wide, or a row of exactly that height,
 * would be written as one of no width or no height, which the PDF draws,
 * thin as it is, and nobody has seen Word draw. A spacer that small is no
 * space and writes nothing (`blocks.ts`); a box that small is refused.
 */
const tooSmall = (points: number): boolean => twips(points) < 1
const NO_LENGTH = 'a Word file states no length under a fortieth of a point'

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
 * Every image's asset as it is embedded, read once however many images
 * draw it, in the order the walk met them and once it has walked every
 * block: where the PDF renderer reads them (`check-images.ts` there), so
 * that a document wrong in a block and in a picture's bytes is refused
 * for the block by both.
 *
 * Each new asset is counted before it is read, and refused past
 * `MAX_DOCX_PICTURES`; read, and refused where its bytes are no picture
 * or one nobody has seen Word print as the PDF does (`assets.ts`); and
 * its bytes counted, and refused past `MAX_DOCX_MEDIA_BYTES`. Then each
 * image is held to its picture: an SVG to a box of its own proportions
 * where it covers one, and any picture to an extent Word's unit states.
 */
function readPictures(images: readonly Image[]): Map<ImageAsset, Picture> {
  const pictures = new Map<ImageAsset, Picture>()
  let media = 0
  for (const image of images) {
    const { id } = image.asset
    let picture = pictures.get(image.asset)
    if (picture === undefined) {
      if (pictures.size === MAX_DOCX_PICTURES)
        throw new RenderRefusal(
          'content-too-large',
          `the report holds more than ${MAX_DOCX_PICTURES} pictures, ${id} the first past them; a Word file holds no more`,
          id,
        )
      picture = readPicture(image.asset)
      pictures.set(image.asset, picture)
      media += image.asset.bytes.length
      if (media > MAX_DOCX_MEDIA_BYTES)
        throw new RenderRefusal('content-too-large', `the pictures up to ${id} hold ${media} bytes; a Word file may hold ${MAX_DOCX_MEDIA_BYTES}`, id)
    }
    // An SVG is drawn whole in its picture's box: one that covers a box of other proportions would have to be cropped.
    if (
      picture.kind === 'svg' &&
      image.fit === 'cover' &&
      Math.abs(picture.width * image.height - picture.height * image.width) > 1e-6 * picture.width * image.height
    )
      throw new RenderRefusal(
        'unsupported',
        `the image ${id} is an SVG that covers a box of other proportions than its own, which needs the drawing cropped; whether Word crops one as the PDF does is not known here: a Word file holds an SVG at its own proportions alone`,
        id,
      )
    // A picture's extent is stated in English Metric Units: one that rounds to none would be a picture of no extent.
    const { width, height } = drawnSize(image, picture)
    if (emu(width) < 1 || emu(height) < 1)
      throw new RenderRefusal(
        'unsupported',
        `the image ${id} is drawn ${shown(width)} × ${shown(height)} pt, under the unit a Word file states a picture's extent in, 12,700 to the point: the PDF draws it, and what Word draws of a picture of no extent is not known here`,
        id,
      )
  }
  return pictures
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
  count(walk, 1, 0, at)
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
    count(walk, 1, 0, at)
  }
  checkBlocks(section.blocks, `${at}.blocks`, { ...place, width, framed: place.framed || framed(section), depth: place.depth + 1 }, walk)
}

/** A table held to its shape, as the PDF renderer holds it, and every cell's text to the face it prints in. */
function checkTable(table: Table, width: number, walk: Walk): void {
  const columns = table.columns.length
  const { id } = table
  if (columns === 0) throw new RenderRefusal('unsupported', `table ${id} has no columns`, id)
  if (table.columns.some((column) => column.align !== 'left' && column.align !== 'center' && column.align !== 'right'))
    throw new RenderRefusal('unsupported', `table ${id} aligns a column in a way a report does not know`, id)
  if (table.header.length !== columns)
    throw new RenderRefusal('unsupported', `the header of table ${id} has ${table.header.length} cells for ${columns} columns`, id)
  table.rows.forEach((row, index) => {
    const cells = row.across === true ? 1 : columns
    if (row.cells.length !== cells)
      throw new RenderRefusal(
        'unsupported',
        `row ${index} of table ${id} has ${row.cells.length} cells for ${row.across === true ? 'a row across the table, which has one' : `${columns} columns`}`,
        id,
      )
    if (row.cellStyles !== undefined && row.cellStyles.length !== row.cells.length)
      throw new RenderRefusal('unsupported', `row ${index} of table ${id} has ${row.cellStyles.length} cell styles for ${row.cells.length} cells`, id)
    for (const style of [row.style, ...(row.cellStyles ?? [])]) checkStyle(style ?? undefined, id, walk.fonts)
  })
  checkKeptRows(table)
  checkStyle(table.headerStyle, id, walk.fonts)
  const narrow = table.columns.find((column) => column.width !== 'fill' && !(column.width > 2 * PADDING_X && Number.isFinite(column.width)))
  if (narrow !== undefined) throw new RenderRefusal('unsupported', `table ${id} has a column of ${String(narrow.width)} pt, no wider than its cell padding`, id)
  const widths = table.columns.map((column) => column.width)
  const fixed = fixedWidth(widths)
  if (fixed > width || fillWidth(widths, width) <= 2 * PADDING_X)
    throw new RenderRefusal('content-too-large', `table ${id}'s fixed columns are ${fixed} pt wide; it stands ${width.toFixed(2)} pt wide`, id)
  for (const row of styledRows(table)) {
    let characters = 0
    row.cells.forEach((text, column) => {
      const where =
        row.index !== undefined
          ? `table ${id}, row ${row.index}, column ${column + 1},`
          : row.kind === 'header'
            ? `table ${id}'s header, column ${column + 1},`
            : `table ${id}'s empty text`
      checkText(text, cellFace(row.styles[column]!, row.kind), walk.fonts, where, id)
      characters += text.length
    })
    count(walk, row.cells.length, characters, id, row.cells.length)
  }
}

/** Refuses a table whose rows keep rows otherwise than the runtime writes them (0059), as the PDF renderer does. */
function checkKeptRows(table: Table): void {
  table.rows.forEach((row, index) => {
    const keeps: unknown = row.keepWithRows
    if (keeps === undefined) return
    const at = `row ${index} of table ${table.id}`
    if (row.kind !== 'groupHeader') throw new RenderRefusal('unsupported', `${at} keeps rows with it, and only a group header does`, table.id)
    if (!(typeof keeps === 'number' && Number.isInteger(keeps) && keeps >= 2 && keeps <= MAX_KEEP_WITH_ROWS)) {
      throw new RenderRefusal(
        'unsupported',
        `${at}, a group header, keeps ${typeof keeps === 'number' ? `${keeps} rows` : `rows by a count of type ${typeof keeps}`}; a group header keeps a whole number of them from 2 to ${MAX_KEEP_WITH_ROWS}, and only its first where it says none`,
        table.id,
      )
    }
    let details = 0
    while (table.rows[index + 1 + details]?.kind === 'detail') details++
    if (keeps > details) throw new RenderRefusal('unsupported', `${at}, a group header, keeps ${keeps} rows, and ${details} detail rows follow it`, table.id)
  })
}
