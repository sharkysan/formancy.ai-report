import pdfmake from 'pdfmake'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { vi } from 'vitest'
import { renderPdf } from '../node.js'

/**
 * How many times pdfmake laid out the last pass of rendering `document`:
 * each layout asks for the first page's background once. pdfmake 0.3.11
 * lays the whole document out again for each page break a
 * `pageBreakBefore` hook asks for (src/LayoutBuilder.js 137-141), which is
 * how a table's breaks and a kept heading's move cost a render.
 */
export async function lastPassLayouts(document: ResolvedDocument, maxPages: number): Promise<number> {
  const passes: number[] = []
  const createPdf = pdfmake.createPdf.bind(pdfmake)
  const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
    const pass = passes.push(0) - 1
    const background = definition.background
    return createPdf(
      {
        ...definition,
        background: (page, size) => {
          if (page === 1) passes[pass]! += 1
          return typeof background === 'function' ? background(page, size) : null
        },
      },
      options,
    )
  })
  try {
    await renderPdf(document, { maxPages })
  } finally {
    spy.mockRestore()
  }
  return passes.at(-1)!
}
