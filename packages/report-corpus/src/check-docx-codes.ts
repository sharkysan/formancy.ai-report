import { EPC_CAPTION, EPC_FRAME, EPC_MAX_VERSION, epcCaptionBreak, epcModule } from '@formancy/report-runtime'
import { codeGrid, readPictureCode, type CodeGrid } from './code-picture.js'
import type { EpcQrCode, QrCode } from './document.js'
import type { DocxBorder, DocxParagraph, DocxTable } from './docx/model.js'
import { readPng, type GreyPixels } from './docx/png.js'

/**
 * A QR code and an EPC QR code held to what a Word file states for them
 * (0074, extending 0068 and 0003), by the corpus's own reading of that
 * record's table and never the writer's code.
 *
 * In two steps, since a scanner's reading is not at hand at once. First,
 * on the file's nodes and the picture's pixels: the picture alone in its
 * paragraph, exactly the size the document gives the code, a PNG of the
 * symbol in whole pixels a module with its quiet zone, fine enough for
 * its size (`codeGrid`); and, around a captioned code, Austria's frame and
 * caption as a table states them. Then, on what ZXing reads in those
 * pixels (`decodedProblems`): the text, its very bytes and the level.
 *
 * What it cannot show is what Word then prints of the picture, or that a
 * phone reads it from the paper.
 */

/** A code whose picture the first step passed, kept for the second. */
export interface PendingCode {
  readonly at: string
  readonly block: QrCode | EpcQrCode
  readonly png: GreyPixels
  readonly grid: CodeGrid
}

/** What a walk of a file's blocks gathers of its codes. */
export interface FoundCodes {
  /** Each code whose picture is a symbol's, for what a scanner reads in it to be held to the document. */
  readonly pending: PendingCode[]
  /** Every paragraph a code is written as, its picture's among them: no image of the document's is one of these. */
  readonly paragraphs: Set<DocxParagraph>
}

/** A length in points read back from Word's units is the document's to within half of the coarsest unit, a twentieth of a point. */
const NEAR = 0.026
const near = (read: number, stated: number, within = NEAR): boolean => Math.abs(read - stated) <= within

/** The quiet zone a code's picture holds on every side of its symbol, in modules (ISO/IEC 18004). */
const QUIET = 4

/** Word's unit of length to the point: a twentieth. */
const TWENTIETHS = 20

/**
 * The least a code's picture holds of pixels to the inch at the size it
 * prints: 600, an office printer's, so that a module's edge stands within
 * a 600th of an inch of where the symbol puts it however a reader
 * resamples the picture. And the most pixels a side it is, 2,400: a
 * picture under 600 to the inch is fine enough where one more pixel a
 * module would take it past that many, which is where its code is wider
 * than 266 to 288 points, by its symbol's version.
 */
const RESOLUTION = 600
const MOST_PIXELS = 2400

/** The smallest module a code without Austria's caption prints at, in points: 0.4 mm (0020). */
const MIN_MODULE = (0.4 * 72) / 25.4

const BLACK = '#000000'

/** The family the caption is named in: the PSA's own, "Arial o.s. non-serifs", whose widths are those of the Liberation Sans the PDF prints it in. */
const CAPTION_FAMILY = 'Arial'

const named = (block: QrCode | EpcQrCode): string => `the ${block.kind === 'qrCode' ? 'QR code' : 'EPC QR code'} ${block.id}`

/**
 * The picture of `block` in `paragraph`, which it stands in alone, `side`
 * points a side: its pixels and its grid, or nothing where a problem was
 * said of it.
 */
function pictured(block: QrCode | EpcQrCode, paragraph: DocxParagraph, side: number, say: (problem: string) => void): Omit<PendingCode, 'at'> | undefined {
  const what = named(block)
  const [run, more] = paragraph.runs
  if (run?.kind !== 'picture' || more !== undefined) {
    say(`${what} is not a paragraph of one picture`)
    return undefined
  }
  const { picture } = run
  if (!near(picture.width, side) || !near(picture.height, side))
    say(`${what} is a picture of ${picture.width} × ${picture.height} pt where its symbol and quiet zone are ${side} pt a side`)
  if (picture.part.contentType !== 'image/png' || picture.svg !== undefined) say(`${what} is embedded as something other than a PNG`)
  if (picture.crop !== undefined) say(`${what} is a picture cropped, which cuts into its quiet zone`)
  try {
    const png = readPng(picture.part.bytes)
    const grid = codeGrid(png)
    // A picture coarser than this is one whose modules a reader smooths as it scales the picture up to the paper; one of more pixels than
    // the most is one a reader must hold for nothing. Fine enough is 600 to the inch, or as many pixels a module as the most hold.
    const across = grid.modules + 2 * QUIET
    if (png.width * 72 < RESOLUTION * picture.width - 1e-6 && png.width + across <= MOST_PIXELS)
      say(`${what} is a picture of ${png.width} pixels across ${picture.width} pt, fewer than ${RESOLUTION} to the inch`)
    if (png.width > MOST_PIXELS) say(`${what} is a picture of ${png.width} pixels a side, more than the ${MOST_PIXELS} a code's is at the most`)
    return { block, png, grid }
  } catch (error) {
    say(`${what}: ${(error as Error).message}`)
    return undefined
  }
}

/** A QR code, or an EPC QR code without a caption: its picture, a paragraph of its own exactly the code's size, with no room around it. */
export function plainCode(block: QrCode | EpcQrCode, node: DocxParagraph, at: string, say: (problem: string) => void): PendingCode[] {
  if (node.indent !== 0 || node.before !== 0 || node.after !== 0 || node.line !== undefined)
    say(`${named(block)} stands with room around it, or on a line of a stated height`)
  const read = pictured(block, node, block.size, say)
  if (read === undefined) return []
  // The floor every code with a quiet zone is drawn at, held on the file: its modules at the extent it states.
  const module = block.size / (read.grid.modules + 2 * QUIET)
  if (module < MIN_MODULE - 1e-9)
    say(`${named(block)} has modules of ${((module * 25.4) / 72).toFixed(3)} mm at its size, finer than the 0.4 mm a code prints at`)
  return [{ at, ...read }]
}

const sameBorder = (read: DocxBorder | undefined, stated: DocxBorder): boolean =>
  read !== undefined && near(read.weight, stated.weight, 1 / 16 + 0.001) && read.color === stated.color

/** A paragraph that holds nothing and is exactly `height` points tall. */
const emptyLine = (node: DocxParagraph, height: number): boolean =>
  node.runs.length === 0 && node.line?.rule === 'exact' && near(node.line.height, height) && node.bottom === undefined && !node.pageBreakBefore

/**
 * An EPC QR code with Austria's caption (0025), as record 0074 writes
 * it: the white above the frame, the frame, and the white under it, the
 * code's size together. The frame is a table of one row, at least as
 * tall as the PSA's frame, of two cells. The symbol's, bordered on each
 * side by a line half a module wide: its picture, its quiet zone the
 * frame's distance of four modules, half a module down from the top, and
 * in from the left as many twentieths of a point as its cell leaves it.
 * And beside it, outside the line and bordered by none, the caption's
 * band, 7 pt, in which "Zahlen mit Code" reads from bottom to top at
 * 7 pt. The module is report-spec's `epcModule` of the version the
 * picture is, the rule both engines draw by.
 */
export function captionedCode(
  block: EpcQrCode,
  [lead, frame, trail]: readonly [DocxParagraph, DocxTable, DocxParagraph],
  at: string,
  say: (problem: string) => void,
): PendingCode[] {
  const what = named(block)
  const [row, ...rows] = frame.rows
  const [symbol, band, ...cells] = row?.cells ?? []
  if (row === undefined || rows.length > 0 || symbol === undefined || band === undefined || cells.length > 0) {
    say(`${what}, captioned, is not a table of one row of two cells`)
    return []
  }
  const [picture, ...beside] = symbol.blocks
  if (picture?.kind !== 'paragraph' || beside.length > 0) {
    say(`${what}, captioned, has no paragraph of its picture alone in its first cell`)
    return []
  }
  // What its picture is drawn at is known once its version is, which the picture's own pixels say: held to the extent the file states below.
  const stated = picture.runs[0]?.kind === 'picture' ? picture.runs[0].picture.width : block.size
  const read = pictured(block, picture, stated, say)
  if (read === undefined) return []
  const { modules, version } = read.grid
  const module = epcModule(block.size, version, block.caption)
  const line: DocxBorder = { weight: EPC_FRAME.line * module, color: BLACK }
  const inset = line.weight + EPC_FRAME.distance * module
  const height = modules * module + 2 * inset
  if (!near(stated, (modules + 2 * QUIET) * module))
    say(`${what} is a picture ${stated} pt a side where its ${modules + 2 * QUIET} modules of ${module} pt are ${(modules + 2 * QUIET) * module}`)
  const white = (block.size - height) / 2
  if (!emptyLine(lead, white) || !emptyLine(trail, white))
    say(`${what} does not stand between two empty lines of ${white} pt, the white above and under its frame`)
  const width = block.size - EPC_CAPTION.band
  if (frame.grid.length !== 2 || !near(frame.grid[0]!, width) || !near(frame.grid[1]!, EPC_CAPTION.band))
    say(`${what}'s frame is ${frame.grid.join(' and ')} pt across where its symbol's room is ${width} and its caption's band ${EPC_CAPTION.band}`)
  // Of an exact height, Word cut the white under the symbol (0074): at least the frame's height, the row is as tall as Word lays its picture out.
  if (row.height?.rule !== 'atLeast') say(`${what}'s frame is not a row at least its height, where an exact one cut the white under its symbol in Word`)
  else if (!near(row.height.value, height)) say(`${what}'s frame is a row of at least ${row.height.value} pt where the PSA's frame is ${height} pt tall`)
  if (Object.keys(frame.borders).length > 0 || (['top', 'left', 'bottom', 'right'] as const).some((side) => frame.margins?.[side] !== 0))
    say(`${what}'s frame is a table with rules of its own, or one that pads its cells`)
  // The frame's right line is the symbol's cell's, and the caption stands beside it, outside the line: a line at the table's own right
  // edge, around the caption, is one Word cut off (0074).
  if (!(['top', 'left', 'bottom', 'right'] as const).every((side) => sameBorder(symbol.borders[side], line)))
    say(`${what}'s frame is not a line of ${line.weight} pt, half a module, on each side of its symbol's cell`)
  if (Object.keys(band.borders).length > 0) say(`${what}'s caption's band is bordered, where the caption stands outside the frame's line`)
  if (symbol.shade !== undefined || band.shade !== undefined || symbol.direction !== undefined) say(`${what}'s frame is filled, or turns its symbol's cell`)
  // Word holds the cell and the picture's distance from its left in twentieths of a point, each rounded by itself, and the cell is the
  // picture and half a module with nothing over: so the picture stands as many whole twentieths in as its cell leaves it, which is
  // within 0.075 pt of half a module. One more, and the picture ends a hair past its cell, where Word may fit it to the cell.
  const [cell] = frame.grid
  const fromLeft = cell === undefined ? 0 : Math.floor((cell - stated) * TWENTIETHS + 1e-6) / TWENTIETHS
  if (!near(picture.indent, fromLeft, 1e-6) || !near(picture.before, line.weight) || picture.after !== 0)
    say(`${what}'s picture does not stand half a module, ${line.weight} pt, down from its frame's top and ${fromLeft} pt in from its left`)
  if (cell !== undefined && picture.indent + stated > cell + 1e-6)
    say(`${what}'s picture, ${stated} pt wide and ${picture.indent} pt in from the left, is wider than its cell of ${cell} pt`)
  captionProblems(what, band, say)
  return [{ at, ...read }]
}

/** The caption's cell: its one paragraph of "Zahlen mit Code" at 7 pt, black and upright, centred on a line of exactly its band, reading from bottom to top. */
function captionProblems(what: string, band: DocxTable['rows'][number]['cells'][number], say: (problem: string) => void): void {
  const [caption, ...more] = band.blocks
  const [run, ...runs] = caption?.kind === 'paragraph' ? caption.runs : []
  if (caption?.kind !== 'paragraph' || more.length > 0 || run?.kind !== 'text' || runs.length > 0 || run.text !== EPC_CAPTION.words) {
    say(`${what}'s caption is not one paragraph of '${EPC_CAPTION.words}'`)
    return
  }
  if (band.direction !== 'btLr') say(`${what}'s caption does not read from bottom to top`)
  const { props } = run
  if (props.size !== EPC_CAPTION.size || props.bold || props.italic || props.color !== BLACK || props.shift !== undefined)
    say(`${what}'s caption is not ${EPC_CAPTION.size} pt, black and upright on its line`)
  if (props.family !== CAPTION_FAMILY) say(`${what}'s caption names the family ${String(props.family)} where the PSA names ${CAPTION_FAMILY}`)
  if (caption.align !== 'center' || caption.line?.rule !== 'exact' || !near(caption.line.height, EPC_CAPTION.band))
    say(`${what}'s caption is not centred beside its symbol on a line of exactly its band, ${EPC_CAPTION.band} pt`)
}

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, index) => byte === right[index])

/**
 * What ZXing reads in each code's picture, held to the document: its
 * text, the text's very bytes in UTF-8, and the level it asks for, M for
 * an EPC QR code; read as it is drawn, never mirrored, turned or light
 * on dark, which the reader refuses (`codesIn`). A code of no text is a
 * symbol of no data, which ZXing reads as no code. And the version its
 * pixels are, which no document states, held to the version ZXing reads
 * and to what the document's rules leave it: an EPC QR code's within the
 * EPC's and, captioned, with the PSA's modules in its square. Where the
 * symbol stands in its picture the pixels have said already
 * (`codeGrid`).
 */
export async function decodedProblems(pending: readonly PendingCode[]): Promise<string[]> {
  const problems: string[] = []
  for (const { at, block, png, grid } of pending) {
    const what = `${at}: ${named(block)}`
    const text = block.kind === 'qrCode' ? block.text : block.payload
    const level = block.kind === 'qrCode' ? block.errorCorrection : 'M'
    const read = await readPictureCode(png).catch((error: unknown) => (error as Error).message)
    if (typeof read === 'string') problems.push(`${what}: ${read}`)
    else if (read === undefined) {
      if (text !== '') problems.push(`${what} is a picture no scanner reads a code in`)
    } else {
      if (read.text !== text || !sameBytes(read.bytes, new TextEncoder().encode(text)))
        problems.push(`${what} scans to other text, or other bytes, than its own`)
      if (read.ecLevel !== level) problems.push(`${what} is at level ${read.ecLevel} where it asks for ${level}`)
      // The version the pixels are a square of is the one the document's rules are held to below, and the modules at the picture's
      // extent are that square's: a scanner that reads another version's symbol in it reads other modules than were held.
      if (read.version !== grid.version)
        problems.push(`${what} is a picture of a version ${grid.version} symbol in which a scanner reads one of version ${read.version}`)
    }
    if (block.kind !== 'epcQrCode') continue
    if (grid.version > EPC_MAX_VERSION) problems.push(`${what} is a version ${grid.version} symbol, larger than the EPC allows`)
    const broken = block.caption === undefined ? undefined : epcCaptionBreak(block.size, grid.version)
    if (broken !== undefined) problems.push(`${what} is not printed as the PSA prints one: ${broken}`)
  }
  return problems
}
