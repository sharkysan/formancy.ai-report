import {
  EPC_CAPTION,
  EPC_FRAME,
  epcModule,
  epcSymbol,
  QR_QUIET_ZONE,
  qrSymbol,
  qrSymbolVersion,
  RenderRefusal,
  type EpcQrCode,
  type QrCode,
  type QrSymbol,
} from '@formancy/report-runtime'
import { modulePixels } from './code-png.js'
import { MAX_DOCX_CODE_MODULES, MAX_DOCX_CODES } from './limits.js'
import { BLACK } from './look.js'
import { emptyLine, type BlockNode, type Line, type ParagraphNode, type RelationshipId } from './nodes.js'
import { emu, twips } from './units.js'

/**
 * A QR code and an EPC QR code in a Word file (0074): its symbol the
 * runtime's, where what a code is refused by is decided once for both
 * engines, and its drawing the nodes below.
 *
 * A code is a picture, a paragraph of its own exactly the code's size:
 * the symbol in whole pixels a module, its quiet zone inside it
 * (`code-png.ts`). An EPC QR code without a caption is that too.
 *
 * With Austria's caption (0025) it is the PSA's frame, stated as Word
 * states one, in three nodes that are the code's size together: the
 * white the frame leaves above it in its square, kept with it; a table of
 * one row, exactly as tall as the frame, whose two cells are bordered
 * around by a line half a module wide -- the symbol's picture, its quiet
 * zone the frame's distance of four modules, and the caption's band, in
 * which "Zahlen mit Code" reads from bottom to top at 7 pt -- and the
 * white under it. The module, the frame and the band are report-spec's
 * `epc-print.ts`, the rules the PDF draws by. The picture stands the
 * line's width down from the frame's top, and in from its left as far as
 * its cell leaves it once both are in Word's units: within 0.075 pt of
 * the line's width.
 *
 * What a Word file's frame is not, since a table's borders are what
 * draws it: its corners are square where the PSA's figure rounds them by
 * two modules, and its right line is whole, the caption standing inside
 * it, where the PDF breaks the line around the caption. And the caption
 * is named in Arial, the PSA's own "Arial o.s. non-serifs", which a
 * reader with Word has and whose widths are those of the Liberation Sans
 * the PDF prints it in; the file embeds no face.
 */

export type Code = QrCode | EpcQrCode

/** The family the caption is named in. */
export const CAPTION_FAMILY = 'Arial'

/** Word's twentieths to the point, and the English Metric Units a twentieth is: the units a cell's width and a picture's extent are written in (`units.ts`). */
const TWENTIETHS = 20
const EMU_A_TWENTIETH = 635

/** What the codes a walk met before one hold together: how many they are, and the modules of their symbols. */
export interface HeldCodes {
  readonly count: number
  readonly modules: number
}

/**
 * `code`'s symbol where it stands `width` points wide, or the refusal
 * both engines throw (report-runtime's `qr-symbol.ts`, `epc-symbol.ts`),
 * held to what a file's codes may be together, `held` those met before
 * it (`limits.ts`): refused past `MAX_DOCX_CODES` before anything of it
 * is worked out, and past `MAX_DOCX_CODE_MODULES` once its symbol says
 * how many it has, so that no code is encoded after the one that
 * crossed.
 */
export function codeSymbol(code: Code, width: number, held: HeldCodes): QrSymbol {
  const { id } = code
  if (held.count === MAX_DOCX_CODES)
    throw new RenderRefusal(
      'content-too-large',
      `the report holds more than ${MAX_DOCX_CODES} QR codes, ${id} the first past them; a Word file holds no more`,
      id,
    )
  const symbol = code.kind === 'qrCode' ? qrSymbol(code, width) : epcSymbol(code, width)
  if (held.modules + symbol.modules.length ** 2 > MAX_DOCX_CODE_MODULES)
    throw new RenderRefusal(
      'content-too-large',
      `the report's QR codes up to ${id} hold ${held.modules + symbol.modules.length ** 2} modules between them; a Word file may hold ${MAX_DOCX_CODE_MODULES}, as many as sixteen of the largest symbol`,
      id,
    )
  return symbol
}

/** Whether `code` is drawn in Austria's frame. */
export const captioned = (code: Code): code is EpcQrCode & { readonly caption: 'zahlenMitCode' } => code.kind === 'epcQrCode' && code.caption !== undefined

/**
 * What `code` is of the file's paragraphs, characters and runs
 * (`limits.ts`): a paragraph, its picture's; and in Austria's frame four
 * -- the white above, the picture's, the caption's and the white under --
 * with the caption's characters, in one run.
 */
export function codeCount(code: Code): { readonly paragraphs: number; readonly characters: number; readonly runs: number } {
  return captioned(code) ? { paragraphs: 4, characters: EPC_CAPTION.words.length, runs: 1 } : { paragraphs: 1, characters: 0, runs: 0 }
}

/** What draws a code's picture: the relationship of the part its symbol becomes at so many pixels a module, and its number among the file's pictures. */
export interface CodePictures {
  readonly embed: (code: Code, symbol: QrSymbol, pixels: number) => RelationshipId
  readonly next: () => number
}

/** The symbol's picture, `side` points a side, in a paragraph of its own: `module` is its module's side on the page, which says how fine it is drawn. */
function picture(code: Code, symbol: QrSymbol, side: number, module: number, pictures: CodePictures): ParagraphNode {
  const pixels = modulePixels(module, symbol.modules.length + 2 * QR_QUIET_ZONE)
  return {
    kind: 'paragraph',
    runs: [{ kind: 'picture', picture: { id: pictures.next(), width: side, height: side, embed: pictures.embed(code, symbol, pixels) } }],
    mark: undefined,
    keepNext: false,
    keepLines: false,
  }
}

/** The nodes `code` is written as, its `symbol` the one the checks were handed. */
export function codeNodes(code: Code, symbol: QrSymbol, pictures: CodePictures): BlockNode[] {
  const across = symbol.modules.length + 2 * QR_QUIET_ZONE
  if (!captioned(code)) return [picture(code, symbol, code.size, code.size / across, pictures)]
  const module = epcModule(code.size, qrSymbolVersion(symbol), code.caption)
  const line: Line = { weight: EPC_FRAME.line * module, color: BLACK }
  // The frame's inner edge is its distance from the symbol, and the picture's quiet zone is of that distance: the picture stands the line in.
  const inset = line.weight + (EPC_FRAME.distance - QR_QUIET_ZONE) * module
  const height = (symbol.modules.length + 2 * (EPC_FRAME.line + EPC_FRAME.distance)) * module
  const white = (code.size - height) / 2
  const grid = [twips(code.size - EPC_CAPTION.band), twips(EPC_CAPTION.band)] as const
  const side = across * module
  // The first cell is the picture and the line beside it with nothing over, and Word holds the cell and the picture's distance from
  // its left in twentieths of a point, each rounded by itself: rounded up together they are a hair wider than the cell, and a
  // picture wider than its cell is one Word may fit to it. So from the left the picture stands as many whole twentieths in as the
  // cell, as it is written, leaves the picture, as it is written: within 0.075 pt of the line's width, a twentieth and a half.
  const fromLeft = Math.floor((grid[0] * EMU_A_TWENTIETH - emu(side)) / EMU_A_TWENTIETH) / TWENTIETHS
  const style = { family: CAPTION_FAMILY, size: EPC_CAPTION.size, bold: false, italic: false, color: BLACK }
  const caption: ParagraphNode = {
    kind: 'paragraph',
    runs: [{ kind: 'text', text: EPC_CAPTION.words, style }],
    mark: { family: CAPTION_FAMILY, size: EPC_CAPTION.size },
    align: 'center',
    keepNext: false,
    keepLines: false,
    // Exactly its band: a line of Word's own height for 7 pt is taller than the band is wide.
    line: EPC_CAPTION.band,
  }
  return [
    // Kept with the frame under it: a heading kept with the code is kept with this, and Word keeps a paragraph with the next and no further.
    { ...emptyLine(white), keepNext: true },
    {
      kind: 'table',
      grid,
      padding: { x: 0, y: 0 },
      rows: [
        {
          cantSplit: false,
          height,
          cells: [
            {
              width: grid[0],
              borders: { top: line, left: line, bottom: line },
              content: [{ ...picture(code, symbol, side, module, pictures), indent: fromLeft, before: inset }],
            },
            { width: grid[1], borders: { top: line, bottom: line, right: line }, direction: 'btLr', content: [caption] },
          ],
        },
      ],
    },
    emptyLine(white),
  ]
}
