import type { Docx, DocxBlock, DocxChartFrame } from './docx/model.js'

/**
 * The charts a Word file draws (0076), as its parts state them: every
 * inline chart of the body, in document order through every table's
 * cells. For a test that asks what a file's chart holds, as
 * `readDocxCodes` answers of its codes; `verifyDocx` holds a file's
 * charts to its document, block by block. A chart with nothing to draw
 * is no chart of the file's, and is not among them.
 */
export function docxCharts(docx: Docx): DocxChartFrame[] {
  const among = (blocks: readonly DocxBlock[]): DocxChartFrame[] =>
    blocks.flatMap((block) =>
      block.kind === 'paragraph'
        ? block.runs.flatMap((run) => (run.kind === 'chart' ? [run.frame] : []))
        : block.rows.flatMap((row) => row.cells.flatMap((cell) => among(cell.blocks))),
    )
  return among(docx.body)
}
