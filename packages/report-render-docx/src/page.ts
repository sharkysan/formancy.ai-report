import { RenderRefusal, type ResolvedDocument } from '@formancy/report-runtime'

/**
 * The page a Word file's sections state (0068): the document's paper,
 * turned where it is, and its margins, held to what a report prints on
 * as the PDF renderer holds them.
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
export const PAPER: Readonly<Record<ResolvedDocument['page']['size'], { readonly width: number; readonly height: number }>> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
}

/** The document's page, or the refusal of a size, an orientation or margins no report prints on. */
export function pageOf(setup: ResolvedDocument['page']): Page {
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
