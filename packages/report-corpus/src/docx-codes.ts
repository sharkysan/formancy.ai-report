import { codeGrid, readPictureCode, type CodeGrid } from './code-picture.js'
import type { PixelCode } from './codes.js'
import type { Docx, DocxBlock, DocxPicture } from './docx/model.js'
import { readPng } from './docx/png.js'

/**
 * The codes a Word file's pictures show (0074, extending 0003), read as a
 * scanner reads them: every picture of the file that is a symbol's --
 * whole pixels a module, black on white, its quiet zone around it
 * (`codeGrid`) -- decoded by ZXing from the pixels the corpus's own PNG
 * reader gives. For a test that asks what a file's code says and how it
 * is drawn, as `readCodes` answers of a PDF's page; `verifyDocx` holds a
 * file's codes to its document, block by block.
 */

/** A code in a Word file: where its picture stands, the picture, its grid, and what a scanner reads in it. */
export interface DocxCode extends CodeGrid {
  /** The part of the file its picture stands in: the body's, or a header's or the footer's. */
  readonly region: 'body' | 'header' | 'firstHeader' | 'footer'
  /** The picture as the file states it: its extent in points and the part it embeds. */
  readonly picture: DocxPicture
  /** The picture's pixels a side. */
  readonly side: number
  /** The pixels the picture holds to the inch, at the extent the file states. */
  readonly resolution: number
  /** A module's side on the page, in points, at the extent the file states. */
  readonly module: number
  /** What ZXing reads in the picture, placed in the picture's pixels; undefined where it reads no code, as in a symbol of no data. */
  readonly read: PixelCode | undefined
}

/** Every picture among `blocks`, however deep, in document order. */
function picturesOf(blocks: readonly DocxBlock[]): DocxPicture[] {
  return blocks.flatMap((block) =>
    block.kind === 'paragraph'
      ? block.runs.flatMap((run) => (run.kind === 'picture' ? [run.picture] : []))
      : block.rows.flatMap((row) => row.cells.flatMap((cell) => picturesOf(cell.blocks))),
  )
}

/**
 * The codes of `docx`: the page header's, page 1's own header's, the page
 * footer's and the body's, each in document order. A picture that is no
 * symbol's is no code, and is left out. Throws where ZXing reads a
 * symbol's picture only mirrored, turned or light on dark (`codesIn`): a
 * test that reads a file's codes holds each to being drawn as it was
 * encoded, whatever else it asks of them.
 */
export async function readDocxCodes(docx: Docx): Promise<DocxCode[]> {
  const regions: readonly (readonly [DocxCode['region'], readonly DocxBlock[]])[] = [
    ['header', docx.header?.blocks ?? []],
    ['firstHeader', docx.firstHeader?.blocks ?? []],
    ['footer', docx.footer?.blocks ?? []],
    ['body', docx.body],
  ]
  const codes: DocxCode[] = []
  for (const [region, blocks] of regions) {
    for (const picture of picturesOf(blocks)) {
      let symbol: { readonly png: ReturnType<typeof readPng>; readonly grid: CodeGrid }
      try {
        const png = readPng(picture.part.bytes)
        symbol = { png, grid: codeGrid(png) }
      } catch {
        // A photograph, a mark, an SVG's fallback: any picture that is not a symbol in whole pixels a module.
        continue
      }
      const { png, grid } = symbol
      codes.push({
        ...grid,
        region,
        picture,
        side: png.width,
        resolution: (png.width * 72) / picture.width,
        module: picture.width / (grid.modules + 8),
        read: await readPictureCode(png),
      })
    }
  }
  return codes
}
