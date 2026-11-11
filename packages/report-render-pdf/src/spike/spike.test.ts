/**
 * SPIKE (Task 15, spike/chart-echarts): throwaway, never merged.
 *
 * Q1, Q3, Q4, Q5 and Q6 in both entries, as browser.test.ts runs the
 * browser entry (pdfmake's browser build, in Node). Each probe records what
 * it measured into `SPIKE_OUT` (a JSON file) when that is set, and asserts
 * softly, so one run reports every question.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import nodePdfmake from 'pdfmake'
import browserPdfmake from 'pdfmake/build/pdfmake.js'
import { readPdf, type PdfPage, type PdfTextItem } from '@formancy/report-corpus'
import { assetDigest, type FontAsset, type ResolvedDocument } from '@formancy/report-runtime'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { renderPdf as renderInBrowser } from '../browser.js'
import { renderPdf as renderInNode } from '../node.js'
import { bareDocument, paragraph, TIMEOUT } from '../testing/documents.js'
import type { Chart, FaceWidths } from './chart.js'
import { LAYOUTS, loads } from './draw-charts.js'
import { BARS, CHARTS, LINE, PIE, TURNED } from './spike-charts.js'

const EDGE = 0.5
const out: Record<string, unknown> = {}
afterAll(() => {
  const file = process.env.SPIKE_OUT
  if (file !== undefined) fs.writeFileSync(file, JSON.stringify(out, null, 2))
})

let warn: MockInstance<typeof console.warn>
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(() => warn.mockRestore())

const hostFont = (file: string, id: string): FontAsset => {
  const bytes = new Uint8Array(fs.readFileSync(new URL(`../../../report-corpus/src/fixtures/host-fonts/${file}`, import.meta.url)))
  return { id, digest: assetDigest(bytes), bytes }
}
const SERIF = { normal: hostFont('LiberationSerif-Regular.ttf', 'serif'), bold: hostFont('LiberationSerif-Bold.ttf', 'serif-bold') }

/** The charts' words around text pdfmake prints in the same faces, regular and bold. */
const withText = (title: string, charts: readonly Chart[]) =>
  bareDocument(title, [paragraph('Kopfzeile fett', { bold: true }), paragraph('Fliesstext normal'), ...(charts as never[])])
const ROBOTO_DOCUMENT = withText('roboto', CHARTS)
const SERIF_DOCUMENT: ResolvedDocument = { ...withText('serif', CHARTS), fonts: { sans: SERIF } }
const CHARTS_ONLY = bareDocument('charts only', CHARTS as never[])
const SERIF_CHARTS_ONLY: ResolvedDocument = { ...CHARTS_ONLY, fonts: { sans: SERIF } }

type Entry = 'node' | 'browser'
const RENDER = { node: renderInNode, browser: renderInBrowser }

/** Who opened a font: svg-to-pdfkit's text (the converter), or pdfmake's provideFont (a measuring document or pdfmake's own text). */
const who = (): string => {
  const stack = new Error().stack ?? ''
  return /SvgElemText|SVGtoPDF|renderSVG/.test(stack) ? 'converter' : /provideFont/.test(stack) ? 'provideFont' : 'other'
}

/** Every read of a file during `run`: the real file system's (what PDFKit's `fs` is in Node) and pdfmake's virtual files (what it is in the browser build). */
async function reads<T>(run: () => Promise<T>): Promise<{ result: T | Error; real: string[]; virtual: string[] }> {
  const real: string[] = []
  const virtual: string[] = []
  const original = fs.readFileSync
  const spyReal = vi.spyOn(fs, 'readFileSync').mockImplementation(((file: unknown, ...rest: unknown[]) => {
    if (typeof file === 'string' && /\.(ttf|otf)$/.test(file)) real.push(`${who()} ${file.replace(/^.*\/node_modules\//, '…/')}`)
    return (original as (...args: unknown[]) => unknown)(file, ...rest)
  }) as typeof fs.readFileSync)
  const vfs = (browserPdfmake as unknown as { virtualfs: { readFileSync: (name: string, options?: unknown) => unknown } }).virtualfs
  const vfsRead = vfs.readFileSync.bind(vfs)
  const spyVirtual = vi.spyOn(vfs, 'readFileSync').mockImplementation((name: string, options?: unknown) => {
    virtual.push(`${who()} ${name}`)
    return vfsRead(name, options)
  })
  try {
    return { result: await run().catch((error: unknown) => error as Error), real, virtual }
  } finally {
    spyReal.mockRestore()
    spyVirtual.mockRestore()
  }
}

interface SvgWord {
  readonly text: string
  readonly bold: boolean
  readonly anchor: 'start' | 'middle' | 'end'
  /** Where the anchor is in the chart's box: the transform applied to (x, y). */
  readonly px: number
  readonly py: number
  readonly turned: boolean
  readonly size: number
  readonly family: string
}

const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[name]!)

/** Each `<text>` ECharts wrote, where it anchors and in what. */
function svgWords(svg: string): SvgWord[] {
  return [...svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)].map(([, attributes = '', raw = '']) => {
    const attr = (name: string) => new RegExp(`(?:^| )${name}="([^"]*)"`).exec(attributes)?.[1]
    const style = attr('style') ?? ''
    const x = Number(attr('x') ?? 0)
    const y = Number(attr('y') ?? 0)
    const transform = attr('transform') ?? ''
    const translate = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(transform)
    const matrix = /matrix\(([^)]*)\)/.exec(transform)
    let px = x
    let py = y
    let turned = false
    if (translate) {
      px = x + Number(translate[1])
      py = y + Number(translate[2])
    } else if (matrix) {
      const [a, b, c, d, e, f] = matrix[1]!.split(',').map(Number) as [number, number, number, number, number, number]
      px = a * x + c * y + e
      py = b * x + d * y + f
      turned = a === 0 && b === -1 && c === 1 && d === 0
    }
    return {
      text: decode(raw),
      bold: /font-weight:bold/.test(style),
      anchor: (attr('text-anchor') ?? 'start') as SvgWord['anchor'],
      px,
      py,
      turned,
      size: Number(/font-size:([\d.]+)px/.exec(style)?.[1]),
      family: /font-family:([^,;]+)/.exec(style)?.[1] ?? '',
    }
  })
}

/** Where svg-to-pdfkit draws `word` in a box at (x0, y0): its run's left, its advance, its baseline (`getBaseline`'s `central`), or turned, its baseline's x and its top. */
function expectedBox(word: SvgWord, widths: FaceWidths, x0: number, y0: number) {
  const w = widths.width(word.family, word.bold, word.size, word.text)
  const m = widths.metrics(word.family, word.bold)
  const ascent = (Math.max(m.ascender, m.bbox.maxY * m.scale) * word.size) / 1000
  const descent = (Math.min(m.descender, m.bbox.minY * m.scale) * word.size) / 1000
  const central = 0.5 * (ascent + descent)
  const shift = word.anchor === 'middle' ? w / 2 : word.anchor === 'end' ? w : 0
  if (!word.turned) return { x: x0 + word.px - shift, width: w, baseline: y0 + word.py + central, angle: 0 }
  // rotate(-90) about the anchor: the run reads upward, its baseline the vertical at the anchor's x plus `central`.
  return { baselineX: x0 + word.px + central, top: y0 + word.py - (w - shift), height: w, angle: 90 }
}

const baselineOf = (item: PdfTextItem) => item.bottom - 0.2 * item.height
const POSTSCRIPT: Record<string, Record<string, string>> = {
  Roboto: { regular: 'Roboto-Regular', bold: 'Roboto-Medium' },
  'formancy-host-sans': { regular: 'LiberationSerif', bold: 'LiberationSerif-Bold' },
}

/** Each chart's words read back on the PDF: one text item each, in its face, where the converter draws it. */
function wordsOnPdf(pages: readonly PdfPage[], charts: readonly Chart[]) {
  const problems: string[] = []
  const placed: unknown[] = []
  let clipFrom = 0
  const clips = pages.flatMap((page) => page.clips.map((clip) => ({ page, clip })))
  for (const chart of charts) {
    const layout = LAYOUTS.get(chart)!
    const at = clips.slice(clipFrom).findIndex(({ clip }) => Math.abs(clip.width - chart.width) <= EDGE && Math.abs(clip.height - chart.height) <= EDGE)
    if (at === -1) {
      problems.push(`${chart.id}: no clip of its box`)
      continue
    }
    const { page, clip } = clips[clipFrom + at]!
    clipFrom += at + 1
    const inBox = page.items.filter((item) => item.x >= clip.x - EDGE && item.x <= clip.x + clip.width + EDGE && item.top >= clip.top - 2 && item.bottom <= clip.top + clip.height + 2)
    const used = new Set<PdfTextItem>()
    for (const word of svgWords(layout.svg)) {
      const box = expectedBox(word, layout.widths, clip.x, clip.top)
      const face = POSTSCRIPT[word.family]?.[word.bold ? 'bold' : 'regular']
      const candidates = inBox.filter((item) => item.text === word.text && !used.has(item))
      const error = (item: PdfTextItem) =>
        box.angle === 0
          ? Math.max(Math.abs(item.x - box.x!), Math.abs(item.width - box.width!), Math.abs(baselineOf(item) - box.baseline!))
          : Math.max(Math.abs(item.x + 0.8 * item.width - box.baselineX!), Math.abs(item.top - box.top!), Math.abs(item.height - box.height!))
      const best = candidates.sort((a, b) => error(a) - error(b))[0]
      if (best === undefined) {
        problems.push(`${chart.id}: "${word.text}" is no text item of its own`)
        continue
      }
      used.add(best)
      const off = error(best)
      const font = best.font.replace(/^[A-Z]{6}\+/, '')
      placed.push({ chart: chart.id, text: word.text, angle: best.angle, font, off: Number(off.toFixed(3)) })
      if (off > EDGE) problems.push(`${chart.id}: "${word.text}" is ${off.toFixed(3)} pt from where the converter's rule puts it`)
      if (best.angle !== box.angle) problems.push(`${chart.id}: "${word.text}" at ${best.angle}°, expected ${box.angle}°`)
      if (font !== face) problems.push(`${chart.id}: "${word.text}" in ${font}, expected ${face}`)
    }
    for (const item of inBox) if (!used.has(item)) problems.push(`${chart.id}: a text item "${item.text}" no <text> wrote`)
  }
  return { problems, placed }
}

/** Each font the PDF uses, by its PostScript name, and how many times it is embedded. */
function embedded(fonts: readonly { readonly name: string; readonly embedded: boolean }[]) {
  const counts: Record<string, number> = {}
  for (const font of fonts) {
    const name = font.name.replace(/^[A-Z]{6}\+/, '')
    counts[name] = (counts[name] ?? 0) + 1
  }
  return { counts, allEmbedded: fonts.every((font) => font.embedded) }
}

describe("Q1 and Q3: ECharts with no DOM, measured by pdfmake's own faces, in each entry", () => {
  for (const entry of ['node', 'browser'] as const) {
    test(
      `${entry}: draws a chart of each kind with no canvas and no image, every word measured in a font it was handed`,
      async () => {
        for (const [name, document] of [
          ['roboto', ROBOTO_DOCUMENT],
          ['serif', SERIF_DOCUMENT],
        ] as const) {
          // A fresh copy of each chart, so LAYOUTS keys this render's layouts.
          const fresh: ResolvedDocument = { ...document, body: document.body.map((block) => ({ ...block })) }
          await RENDER[entry](fresh, { maxPages: 5 }).catch((error: unknown) => error)
          const charts = fresh.body.filter((block) => (block as { kind: string }).kind === 'chart') as unknown as Chart[]
          const record = charts.map((chart) => {
            const layout = LAYOUTS.get(chart)
            if (layout === undefined) return { chart: chart.id, drawn: false }
            const single = layout.asks.filter(([text]) => [...text].length === 1).map(([text]) => text)
            return {
              chart: chart.id,
              drawn: true,
              refused: layout.refused,
              fonts: [...new Set(layout.asks.map(([, font]) => font))],
              asked: layout.asks.map(([text]) => text),
              singleCharacters: single,
              widths: Object.fromEntries(
                ['Umsatz nach Region', '-30.00'].map((text) => [text, layout.widths.width(name === 'roboto' ? 'Roboto' : 'formancy-host-sans', false, 8, text)]),
              ),
              line: layout.widths.line(name === 'roboto' ? 'Roboto' : 'formancy-host-sans', false, 8),
            }
          })
          out[`q1q3-${entry}-${name}`] = record
          for (const each of record) {
            expect.soft(each.drawn, `${entry} ${name} ${each.chart} drawn`).toBe(true)
            expect.soft(each.refused, `${entry} ${name} ${each.chart}: canvas or image asked for`).toEqual([])
          }
        }
      },
      TIMEOUT,
    )
  }
})

describe("Q4 and Q5: the words in the report's faces, read back on the PDF", () => {
  const cases = [
    ['roboto', ROBOTO_DOCUMENT],
    ['serif', SERIF_DOCUMENT],
    ['roboto-charts-only', CHARTS_ONLY],
    ['serif-charts-only', SERIF_CHARTS_ONLY],
    ['roboto-turned', withText('turned', [TURNED])],
    ['serif-turned', { ...withText('turned serif', [TURNED]), fonts: { sans: SERIF } }],
  ] as const
  for (const entry of ['node', 'browser'] as const) {
    test(
      `${entry}: every word one text item in its face, where the converter's rule puts it, each face embedded once`,
      async () => {
        for (const [name, document] of cases) {
          const fresh: ResolvedDocument = { ...document, body: document.body.map((block) => ({ ...block })) }
          const charts = fresh.body.filter((block) => (block as { kind: string }).kind === 'chart') as unknown as Chart[]
          const { result, real, virtual } = await reads(() => RENDER[entry](fresh, { maxPages: 5 }))
          const record: Record<string, unknown> = { fontReadsReal: real, fontReadsVirtual: virtual.filter((file) => /\.ttf$/.test(file)) }
          if (result instanceof Error) {
            record.refused = `${(result as { code?: string }).code ?? ''} ${result.message}`
          } else {
            const pdf = await readPdf(result)
            const { problems, placed } = wordsOnPdf(pdf.pages, charts)
            record.problems = problems
            record.placed = placed
            record.fonts = embedded(pdf.fonts)
            record.bytes = result.length
          }
          out[`q4q5-${entry}-${name}`] = record
          expect.soft(record.refused, `${entry} ${name} refused`).toBeUndefined()
          expect.soft(record.problems, `${entry} ${name}`).toEqual([])
        }
      },
      TIMEOUT,
    )
  }
})

describe('Q6: the same bytes', () => {
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
  const normalised = (svg: string) => svg.replace(/zr\d+-c\d+/g, 'zr-c').replace(/zr\d+-cls-\d+/g, 'zr-cls')
  test(
    'one document with three charts, twice in one process and once in another, and in the browser entry',
    async () => {
      const make = () => ({ ...CHARTS_ONLY, body: [paragraph('Drei Diagramme'), ...CHARTS.map((chart) => ({ ...chart }))] as never[] }) as ResolvedDocument
      const first = make()
      const second = make()
      const a = await renderInNode(first, { maxPages: 5 })
      const b = await renderInNode(second, { maxPages: 5 })
      const c = await renderInBrowser(make(), { maxPages: 5 })
      const plain = bareDocument('plain', [paragraph('Drei Diagramme')])
      const plainSame = digest(await renderInNode(plain, { maxPages: 1 })) === digest(await renderInBrowser(plain, { maxPages: 1 }))
      const svgs = (document: ResolvedDocument) => (document.body.filter((block) => (block as { kind: string }).kind === 'chart') as unknown as Chart[]).map((chart) => LAYOUTS.get(chart)!.svg)
      const [svgA, svgB] = [svgs(first), svgs(second)]
      // Another process: the built Node entry (dist), the same document as JSON.
      const json = JSON.stringify(make())
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD], { input: json, encoding: 'utf8', cwd: new URL('../..', import.meta.url).pathname, maxBuffer: 64 * 1024 * 1024 })
      const other = child.status === 0 ? child.stdout.trim() : `failed: ${child.stderr.slice(0, 400)}`
      out.q6 = {
        inProcess: [digest(a), digest(b)],
        sameInProcess: digest(a) === digest(b),
        otherProcess: other,
        sameInOtherProcess: other === digest(a),
        browserEntry: digest(c),
        sameInBrowserEntry: digest(c) === digest(a),
        plainDocumentSameInBothEntries: plainSame,
        svgsIdenticalRaw: svgA.map((svg, i) => svg === svgB[i]),
        svgsIdenticalButIds: svgA.map((svg, i) => normalised(svg) === normalised(svgB[i]!)),
        idsInFirst: svgA.map((svg) => [...new Set(svg.match(/zr\d+-(?:c|cls-)\d+/g) ?? [])]),
        idsInSecond: svgB.map((svg) => [...new Set(svg.match(/zr\d+-(?:c|cls-)\d+/g) ?? [])]),
        bytes: a.length,
      }
      expect.soft(digest(a)).toBe(digest(b))
      expect.soft(other).toBe(digest(a))
    },
    TIMEOUT,
  )
})

/** The child process: the built Node entry draws the document on stdin and prints its PDF's SHA-256. */
const CHILD = `
import { createHash } from 'node:crypto'
import { renderPdf } from './dist/index.mjs'
let input = ''
for await (const chunk of process.stdin) input += chunk
const bytes = await renderPdf(JSON.parse(input), { maxPages: 5 })
process.stdout.write(createHash('sha256').update(bytes).digest('hex'))
`

describe('laziness: the chart module is imported only for a document that holds a chart', () => {
  test('counted', async () => {
    const before = loads.count
    await renderInBrowser(bareDocument('no chart', [paragraph('Kein Diagramm')]), { maxPages: 1 })
    const afterNone = loads.count
    out.lazy = { before, afterNoChart: afterNone, note: 'loadOnce keeps the module once loaded: earlier tests in this file already loaded it' }
    expect(afterNone).toBe(before)
  })
})

// Keep the imports the probes read, so a type-only edit does not drop them.
void [BARS, LINE, PIE, nodePdfmake]
