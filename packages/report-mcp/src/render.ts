/**
 * `render_check`: a report rendered with the data an agent passes in, and
 * what the PDF it produced prints, page by page, read back with PDF.js
 * (0089, which applies 0003 to what an agent is told).
 *
 * Every verdict is another package's, in the order a host meets them:
 * report-spec's validator, the runtime's `resolveReport` with its codes,
 * the renderer's `renderPdf` with its own, and then the PDF itself, read by
 * `pdf-text.ts`. What is this package's own is what an agent's call alone
 * brings: the assets come as bytes in the call, each held to the digest it
 * is given with before anything resolves, and three bounds hold what one
 * call may cost -- the report's size, `MAX_REPORT_BYTES`, as a save holds
 * it; the PDF's pages, `MAX_CHECK_PAGES`, which the renderer refuses past
 * before it lays anything out; and the answer's size, `MAX_ANSWER_BYTES`.
 * The data is bounded by the runtime's own rules -- `MAX_DETAIL_ROWS`
 * rows, `MAX_STRING_LENGTH` characters a string -- and, through stdio,
 * by the transport's before them: the SDK reads at most 10 MiB of one
 * message, the report, the data and every asset's base64 together, and
 * ends the server past it, which about 78,000 of the quotation's rows
 * reach (0089).
 *
 * Nothing here is fetched or read from a file, and the PDF is never
 * answered: an agent is told what it prints, and the bytes stay here.
 */
import { DATA_MODES, RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { DataMode, ImageBytes, ImageRef, RenderManifest, ReportData, RuntimeError } from '@formancy/report-runtime'
import { assetDigest, MAX_REPORT_BYTES, validateReport } from '@formancy/report-spec'
import { bytesOf, invalid, plural } from './tools.js'
import type { ToolResult } from './tools.js'

/**
 * The most pages a render check prints: past it the renderer refuses the
 * document, `too-many-pages`, before pdfmake lays it out when its least
 * height already needs more, and never cuts it short.
 */
export const MAX_CHECK_PAGES = 40

/**
 * The most bytes an answer's data may have as JSON: the bound the report
 * itself is held to, so that a check's data is no larger than the largest
 * report an agent may send, though a client may show it twice, as the
 * text and as the structure, as it does an edit's report (0088). Past it
 * the answer is refused, with the page count, and no line of it is cut.
 */
export const MAX_ANSWER_BYTES = MAX_REPORT_BYTES

/** What a render check refuses of the call itself, before or after the packages it asks have judged. */
export const RENDER_CHECK_REFUSALS = [
  /** An argument of another shape than the tool takes: a mode that is neither, an asset that is not its four strings. */
  'invalid-arguments',
  /** A report past `MAX_REPORT_BYTES`, which no save takes. */
  'report-too-large',
  /** An asset's bytes that are not base64. */
  'asset-not-base64',
  /** An asset whose bytes are not the digest it was given with. */
  'asset-not-its-digest',
  /** An answer past `MAX_ANSWER_BYTES`. */
  'answer-too-large',
] as const
export type RenderCheckRefusal = (typeof RENDER_CHECK_REFUSALS)[number]

/** What an agent asks a render check with: the report, its data and what a host would name for a render, and the assets' bytes; an argument left out may arrive as undefined. */
export interface RenderCheckInput {
  readonly report: unknown
  readonly data: unknown
  readonly parameters?: unknown
  /** The locale the render prints in: the report's own when absent, or one its translations declare. */
  readonly locale?: string | undefined
  /** The zone instants print in: UTC when absent. */
  readonly timeZone?: string | undefined
  /** A final render, unless a preview is asked for. */
  readonly mode?: DataMode | undefined
  /** Each approved asset the report or its data names, as `{ asset, digest, mediaType, base64 }`. */
  readonly assets?: unknown
}

/** A page of the PDF, by its number from 1, and its lines as a reader sees them, top to bottom. */
export interface CheckedPage {
  readonly page: number
  readonly lines: readonly string[]
}

/**
 * The creation date every render check prints with: the PDF's metadata
 * holds it and nothing on a page does, so the same call is the same
 * answer, and no clock is read.
 */
const CREATION_DATE = '2000-01-01T00:00:00Z'

/** A refusal of the call's own, as an answer: its code, its sentence, and what it names. */
function refusedHere(code: RenderCheckRefusal, message: string, more: Record<string, unknown> = {}): ToolResult {
  return {
    ok: false,
    summary: `Refused, ${code}: ${message}. Nothing was rendered.`,
    data: { rendered: false, refusal: { code, message, ...more } },
  }
}

/**
 * Base64 as MCP carries bytes, read by its length in whole quanta and one
 * character class with its padding after it, which backtracks nothing: a
 * pattern of quanta took a frame of V8's stack for each and overflowed it
 * from 4,473,916 characters, an asset of 3.35 MB, in a bare Node 24.21
 * process, and sooner on a deeper stack (bisected on 28 November 2026);
 * this reads 10 MiB in 20 ms. Whole quanta with at most two `=` after the
 * alphabet leave `atob` nothing to refuse: of every such string of four
 * and eight characters over five of them, it refused none (28 November
 * 2026).
 */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/** `base64`'s bytes, or undefined where it is not base64. */
function decoded(base64: string): Uint8Array | undefined {
  if (base64.length % 4 !== 0 || !BASE64.test(base64)) return undefined
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at)
  return bytes
}

const isText = (value: unknown): value is string => typeof value === 'string'

/**
 * The assets an agent passed, each read and held to the digest it came
 * with, by its id and that digest, as the runtime asks for one; or the
 * refusal of the first that is not. Read whole before anything resolves,
 * so that bytes that are not their digest never reach the runtime, whether
 * or not the report draws them.
 */
function assetsOf(given: unknown): Map<string, ImageBytes> | ToolResult {
  const found = new Map<string, ImageBytes>()
  if (given === undefined) return found
  if (!Array.isArray(given)) return refusedHere('invalid-arguments', 'assets is a list of { asset, digest, mediaType, base64 }')
  for (const [index, entry] of given.entries()) {
    const { asset, digest, mediaType, base64 } = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>
    if (!isText(asset) || !isText(digest) || !isText(mediaType) || !isText(base64))
      return refusedHere('invalid-arguments', `asset ${String(index)} is not { asset, digest, mediaType, base64 }, each a string`, { index })
    const bytes = decoded(base64)
    if (bytes === undefined) return refusedHere('asset-not-base64', `the bytes of asset ${asset} are not base64`, { asset })
    const actual = assetDigest(bytes)
    if (actual !== digest)
      return refusedHere('asset-not-its-digest', `the bytes of asset ${asset} are ${actual}, not the ${digest} they were given with`, { asset, digest, actual })
    found.set(JSON.stringify([asset, digest]), { mediaType, bytes })
  }
  return found
}

/** The runtime's refusal as an answer: every error, each with its stage, code, path and sentence. */
const unresolved = (errors: readonly RuntimeError[]): ToolResult => ({
  ok: false,
  summary: `The runtime refused the report with this data: ${plural(errors.length, 'error')}, each with its stage, code, path and sentence, in data.runtime. Nothing was rendered.`,
  data: { rendered: false, runtime: errors },
})

/** The renderer's refusal as an answer: its code, its sentence and what it names. */
const undrawn = ({ code, message, subject }: RenderRefusal): ToolResult => ({
  ok: false,
  summary: `The renderer refused the document, ${code}: ${message}. No PDF was printed.`,
  data: { rendered: false, renderer: { code, message, ...(subject === undefined ? {} : { subject }) } },
})

/**
 * A rendered check's answer, held to `max` bytes of JSON: past it, refused
 * with the page count and the size, and no line cut. Exported for its
 * tests, which hold it at the bound and one byte past it.
 */
export function bounded(pages: readonly CheckedPage[], warnings: readonly RuntimeError[], manifest: RenderManifest, max = MAX_ANSWER_BYTES): ToolResult {
  const data = { rendered: true, pages, warnings, manifest }
  const bytes = bytesOf(data)
  if (bytes > max)
    return refusedHere(
      'answer-too-large',
      `the answer, the lines of ${plural(pages.length, 'page')}, is ${String(bytes)} bytes as JSON, past the ${String(max)} an answer may have; check the report with fewer rows`,
      { pages: pages.length, bytes, max },
    )
  const warned = warnings.length === 0 ? '' : `, with ${plural(warnings.length, 'warning')} of what the preview lacks in data.warnings`
  return {
    ok: true,
    summary:
      `Rendered ${plural(pages.length, 'page')}, a ${manifest.mode} render in ${manifest.locale}${warned}. ` +
      'Each page’s lines, top to bottom, are read back with PDF.js from the PDF the renderer produced; the PDF itself is not returned.',
    data,
  }
}

/**
 * The renderer and PDF.js, loaded with the first render check: most of a
 * client's sessions never render. A load that fails is forgotten, so the
 * next check loads them again rather than failing for the rest of the
 * session; concurrent first checks share the one load.
 */
let engines: Promise<readonly [typeof import('@formancy/report-render-pdf'), typeof import('./pdf-text.js')]> | undefined
const loaded = () =>
  (engines ??= Promise.all([import('@formancy/report-render-pdf'), import('./pdf-text.js')]).catch((error: unknown) => {
    engines = undefined
    throw error
  }))

/**
 * `input`'s report rendered with its data, as a host renders it, and what
 * its PDF prints; or the first refusal, by whichever package gave it.
 * `signal` cancels the render between its passes, answered as the
 * renderer's `cancelled`.
 */
export async function renderCheck(input: RenderCheckInput, signal?: AbortSignal): Promise<ToolResult> {
  const validation = validateReport(input.report)
  if (!validation.valid) return invalid(validation.errors, 'The document')
  const report = validation.report
  const bytes = bytesOf(report)
  if (bytes > MAX_REPORT_BYTES)
    return refusedHere('report-too-large', `the report is ${String(bytes)} bytes as JSON, past MAX_REPORT_BYTES, ${String(MAX_REPORT_BYTES)}`, {
      bytes,
      max: MAX_REPORT_BYTES,
    })
  const mode = input.mode ?? 'final'
  if (!DATA_MODES.includes(mode)) return refusedHere('invalid-arguments', `mode is ${DATA_MODES.join(' or ')}`)
  const assets = assetsOf(input.assets)
  if (!(assets instanceof Map)) return assets
  const resolution = resolveReport(report, input.data as ReportData, {
    mode,
    parameters: (input.parameters ?? {}) as Readonly<Record<string, unknown>>,
    images: ({ asset, digest }: ImageRef) => assets.get(JSON.stringify([asset, digest])),
    creationDate: CREATION_DATE,
    ...(input.locale === undefined ? {} : { locale: input.locale }),
    ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
  })
  if (!resolution.ok) return unresolved(resolution.errors)
  const [{ renderPdf }, { pdfLines }] = await loaded()
  let pdf: Uint8Array
  try {
    pdf = await renderPdf(resolution.document, { maxPages: MAX_CHECK_PAGES, ...(signal === undefined ? {} : { signal }) })
  } catch (error) {
    if (error instanceof RenderRefusal) return undrawn(error)
    throw error
  }
  const pages = (await pdfLines(pdf)).map((lines, at) => ({ page: at + 1, lines }))
  return bounded(pages, resolution.warnings, resolution.manifest)
}
