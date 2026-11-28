import * as corpus from '@formancy/report-corpus'
import { EURO_INVOICE_SAMPLES, pageLines, readPdf, SHIFTED_FIXTURES, starterImages, STARTERS } from '@formancy/report-corpus'
import type { Starter } from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import * as reader from './pdf-text.js'
import { pdfLines } from './pdf-text.js'

/**
 * The render check's reader against the corpus's (0089, after 0003).
 *
 * One rule written twice -- the corpus is test support and never
 * published -- so the two readings of the same PDF are held equal: every
 * starter's final render, page by page and line by line; and beyond the
 * starters, the Euro invoice in each country, Austria's caption turned up
 * the side of its code among them, and the corpus's runs set below or
 * above the line, whose rule is the reader's least obvious part. A report
 * that lines up otherwise than any of these can still read differently in
 * the two, which 0089 says.
 *
 * The corpus is this suite's devDependency and never the package's: the
 * install gate's host holds only what report-mcp declares.
 */

/** `starter` resolved as a final render, as the render check resolves one, with the corpus's images. */
function resolved(starter: Starter): ResolvedDocument {
  const resolution = resolveReport(starter.report, starter.data, {
    mode: 'final',
    parameters: starter.parameters,
    images: starterImages,
    creationDate: '2000-01-01T00:00:00Z',
  })
  if (!resolution.ok) throw new Error(`${starter.id} did not resolve: ${resolution.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return resolution.document
}

/** The PDF of `document`, or undefined where the renderer refuses it, as a refused fixture is. */
async function printed(document: ResolvedDocument): Promise<Uint8Array | undefined> {
  try {
    return await renderPdf(document, { maxPages: 40 })
  } catch (error) {
    if (error instanceof RenderRefusal) return undefined
    throw error
  }
}

/** The corpus's reading of `pdf`: each page's lines, as `pageLines` reads them. */
async function corpusLines(pdf: Uint8Array): Promise<string[][]> {
  return (await readPdf(pdf)).pages.map((page) => pageLines(page).map(({ text }) => text))
}

/**
 * A PDF of one page that prints a line in Helvetica, never embedded: the
 * one kind of PDF PDF.js reads a font of its own for, from the standard
 * fonts pdfjs-dist ships -- Liberation Sans 1 for Helvetica -- when it is
 * told where they are. Written by hand, its cross-reference table's
 * offsets counted, since the renderer embeds every face it prints.
 */
function helvetica(text: string): Uint8Array {
  const content = `BT /F1 12 Tf 72 770 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, at) => {
    const offset = pdf.length
    pdf += `${String(at + 1)} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

/**
 * The PDFs both readers read, each with whether the renderer may refuse
 * it: a starter and a Euro invoice sample never, so that one refused stops
 * no comparison without failing; a run set off the line only where the
 * corpus expects it refused.
 */
/**
 * How long warming the renderer may take, and the guard on the guard below,
 * which renders every document at once: the sales report's first render,
 * ECharts loaded with it, took 2.0 s in a bare Node 24.21 on an i9-10900K,
 * three runs of three, and the guard took 6.2 s under coverage beside
 * another build (28 November 2026). After the warming, the slowest
 * comparison took 0.80 s under coverage, inside vitest's own 5 s.
 */
const WARMING = 30_000

const documents: readonly (readonly [string, () => ResolvedDocument, boolean])[] = [
  ...STARTERS.map((starter) => [starter.id, () => resolved(starter), false] as const),
  ...EURO_INVOICE_SAMPLES.filter(({ id }) => !STARTERS.some((starter) => starter.id === id)).map(
    (sample) => [sample.id, () => resolved(sample), false] as const,
  ),
  ...SHIFTED_FIXTURES.map(({ id, document, expect: expected }) => [id, () => document, expected.outcome !== 'render'] as const),
]

describe('the lines a render check answers', () => {
  // The renderer loads ECharts with the first chart it draws: loaded here,
  // once, so that no comparison pays it inside its own bound.
  beforeAll(async () => {
    const sales = STARTERS.find(({ id }) => id === 'sales-report')
    if (sales === undefined) throw new Error('the corpus has no sales report')
    await printed(resolved(sales))
  }, WARMING)

  // A reader that joined runs otherwise than the corpus's -- another gap
  // for a word, a lowered run left a line of its own, a turned caption
  // read among the lines -- would tell an agent of lines no check here
  // proves; each PDF is read by both and the two held equal.
  test.each(documents)('are the corpus’s pageLines of the same PDF: %s', async (_id, document, mayRefuse) => {
    const pdf = await printed(document())
    if (pdf === undefined) {
      expect(mayRefuse, 'the renderer refused a document the corpus expects printed').toBe(true)
      return
    }
    const lines = await pdfLines(pdf)
    expect(lines).toEqual(await corpusLines(pdf))
    expect(lines.flat().length).toBeGreaterThan(0)
  })

  // The fractions the rule is written with are the corpus's, each: a gap
  // for a word moved in one reader alone would read the corpus's PDFs
  // alike anywhere between 0.15 and 0.25 em, and nothing else would see it.
  test('are read by the corpus’s fractions, each of them', () => {
    const fractions = ['DESCENT', 'SAME_LINE', 'WORD_GAP', 'SHIFT_TOLERANCE', 'JOIN_GAP'] as const
    expect(Object.fromEntries(fractions.map((name) => [name, reader[name]]))).toEqual(Object.fromEntries(fractions.map((name) => [name, corpus[name]])))
  })

  // A guard on the guard: the documents compared hold what makes the rule
  // more than baselines -- a run set off its line, a run turned off the
  // horizontal -- and every starter prints.
  test(
    'compare every starter, a run set off its line and a caption turned up the side',
    async () => {
      const pdfs = await Promise.all(documents.map(async ([id, document]) => [id, await printed(document())] as const))
      expect(EURO_INVOICE_SAMPLES.every(({ id }) => pdfs.some(([printedId, pdf]) => printedId === id && pdf !== undefined))).toBe(true)
      const read = await Promise.all(pdfs.flatMap(([id, pdf]) => (pdf === undefined ? [] : [readPdf(pdf).then((reading) => [id, reading] as const)])))
      expect(STARTERS.every(({ id }) => read.some(([printedId]) => printedId === id))).toBe(true)
      expect(read.some(([, { pages }]) => pages.some((page) => pageLines(page).some(({ shifted }) => shifted.length > 0)))).toBe(true)
      expect(read.some(([, { pages }]) => pages.some(({ items }) => items.some(({ angle }) => angle !== 0)))).toBe(true)
    },
    WARMING,
  )
})

describe('what reading a PDF reaches', () => {
  // PDF.js reads a standard font, a CMap, an ICC profile or a decoder only
  // from an address it is given, and none is: a reading that fetched, or
  // read a file -- pdfjs-dist's own fonts among them, which 0089 admits
  // only as never loaded -- would be one a PDF could point anywhere. The
  // invoice embeds every face it prints; the hand-made page prints in
  // Helvetica, which PDF.js would read Liberation Sans 1 for, and its text
  // is read by the metrics PDF.js carries instead.
  test('fetches nothing and reads no file, pdfjs-dist’s own standard fonts among them', async () => {
    const invoice = STARTERS.find(({ id }) => id === 'invoice')
    if (invoice === undefined) throw new Error('the corpus has no invoice starter')
    const pdf = await printed(resolved(invoice))
    if (pdf === undefined) throw new Error('the invoice did not print')
    const fetching = vi.spyOn(globalThis, 'fetch')
    const modules = vi.spyOn(process, 'getBuiltinModule')
    try {
      expect((await pdfLines(pdf)).flat().length).toBeGreaterThan(0)
      expect(await pdfLines(helvetica('Helvetica, never embedded'))).toEqual([['Helvetica, never embedded']])
      expect(fetching).not.toHaveBeenCalled()
      const asked = modules.mock.calls.map(([name]) => String(name).replace(/^node:/, ''))
      expect(asked.filter((name) => /^(fs|fs\/promises|http|https|net|child_process|worker_threads)$/.test(name))).toEqual([])
    } finally {
      fetching.mockRestore()
      modules.mockRestore()
    }
  })

  // What is no PDF is refused by PDF.js, and the reading rejects rather
  // than answering no pages.
  test('rejects bytes that are no PDF', async () => {
    await expect(pdfLines(new TextEncoder().encode('no PDF at all'))).rejects.toThrow()
  })
})
