// How the e-invoice gate draws what it judges (0031): every sample
// resolved once in a final render, as a host resolves it, and drawn by the
// renderer as built; each variant drawn with the base sample's e-invoice;
// and the PDF/A-2b corpus (0056), every starter, variant and control of
// scripts/e-invoice/pdfa-2b.mjs drawn as the renderer draws one for a host
// that asks for `pdfa: '2b'`. The packages are handed in, as
// scripts/e-invoice.mjs imports them from their dist/, so that nothing
// here imports a package itself.

import { blocksDocument, boundDocument, PDF_BASE, svgDocument, TRANSLUCENT_SVG } from './pdf-corpus.mjs'
import { PDF_A_2B_BASE } from './pdfa-2b.mjs'

/** The instant every sample is resolved at: the XML reads no clock, and a final render needs one. */
const CREATED = '2026-10-17T08:00:00Z'

/** The most pages a PDF of the corpus may have: every sample prints on one (the renderer's e-invoice-samples.test.ts reads each as one), and one that grows is refused rather than judged unread. */
const MAX_PAGES = 1
/** The most pages a variant may have, and a PDF/A-2b: a bound on the work, since nothing reads a variant's pages; the longest printed two on 18 October 2026. */
const VARIANT_MAX_PAGES = 10
/** What a host asks the renderer for to draw a final render as a PDF/A-2b (0056). */
const AS_2B = { maxPages: VARIANT_MAX_PAGES, pdfa: '2b' }

/**
 * Every sample resolved once, in a final render, as a host resolves it,
 * with the firm's mark it prints at its head (0032), and drawn from the very
 * document whose XML the corpus holds; and each variant drawn with the base
 * sample's e-invoice, a starter resolved as a host resolves it, and an SVG
 * as an approved asset holds it, in the form report-spec's `cleanSvg`
 * writes. And the PDF/A-2b: each starter as a 2b (`drawStarter2b`), each
 * variant of the 2b corpus as a 2b with no e-invoice, its blocks and SVGs
 * on the quotation's page and its fixtures as they are (`drawVariant2b`),
 * and the quotation without `pdfa` (`drawPlain2bBase`).
 */
export function samplesOf({ spec, runtime, renderer, corpus }) {
  const { starterImages: images } = corpus
  const documents = new Map()
  const documentOf = (sample) => {
    if (!documents.has(sample.id)) {
      const outcome = runtime.resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, images, creationDate: CREATED })
      if (!outcome.ok)
        throw new Error(`the sample ${sample.id} does not resolve: ${outcome.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
      documents.set(sample.id, outcome.document)
    }
    return documents.get(sample.id)
  }
  // `undefined` draws the e-invoice the runtime resolved, `null` none, and `{ xml }` that one with another XML.
  const draw = (id, eInvoice) => {
    const { eInvoice: own, ...plain } = documents.get(id)
    const document = eInvoice === undefined ? { ...plain, eInvoice: own } : eInvoice === null ? plain : { ...plain, eInvoice: { ...own, ...eInvoice } }
    return renderer.renderPdf(document, { maxPages: MAX_PAGES })
  }
  const starterDocument = (id) => {
    const starter = corpus.STARTERS.find((each) => each.id === id)
    if (starter === undefined) throw new Error(`a PDF variant draws the starter ${id}, which report-corpus does not have`)
    const outcome = runtime.resolveReport(starter.report, starter.data, { mode: 'final', parameters: starter.parameters, images, creationDate: CREATED })
    if (!outcome.ok) throw new Error(`the starter ${id} does not resolve: ${outcome.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
    return outcome.document
  }
  const fixtureDocument = (id) => {
    const fixture = corpus.ALL_FIXTURES.find((each) => each.id === id)
    if (fixture === undefined) throw new Error(`a PDF variant draws the fixture ${id}, which report-corpus does not have`)
    return fixture.document
  }
  // The gate's own drawing is held to being cleanSvg's form as written, so that what veraPDF judges is the drawing a reviewer reads.
  const svgAssets = () => {
    const translucent = new TextEncoder().encode(TRANSLUCENT_SVG)
    const cleaned = spec.cleanSvg(translucent)
    if (!cleaned.ok || Buffer.compare(Buffer.from(cleaned.bytes), Buffer.from(translucent)) !== 0)
      throw new Error(`variant-svg.pdf’s translucent drawing is not in the form cleanSvg writes: ${cleaned.ok ? 'cleaning changes it' : cleaned.message}`)
    const svg = (id, bytes) => ({ id, mediaType: 'image/svg+xml', bytes })
    return [svg('svg-mark', corpus.SVG_MARK), svg('svg-window', corpus.SVG_WINDOW), svg('svg-translucent', translucent)]
  }
  const bound = (base) => boundDocument(base, { id: 'svg-bound', mediaType: 'image/svg+xml', bytes: corpus.SVG_BOUND }, corpus.SVG_BOUND_SIDE)
  // What a variant draws, on `base`'s page where it adds to one: the same pages for the PDF/A-3b's and the PDF/A-2b's.
  const variantPage = (base, draws) =>
    draws.blocks === true
      ? blocksDocument(base, corpus.IMAGE_KINDS)
      : draws.svg === true
        ? svgDocument(base, svgAssets())
        : draws.bound === true
          ? bound(base)
          : draws.fixture !== undefined
            ? fixtureDocument(draws.fixture)
            : starterDocument(draws.starter)
  const drawVariant = (draws) => {
    const base = documents.get(PDF_BASE)
    return renderer.renderPdf({ ...variantPage(base, draws), eInvoice: base.eInvoice }, { maxPages: VARIANT_MAX_PAGES })
  }
  const drawStarter2b = (id) => renderer.renderPdf(starterDocument(id), AS_2B)
  const drawVariant2b = (draws) => renderer.renderPdf(variantPage(starterDocument(PDF_A_2B_BASE), draws), AS_2B)
  const drawPlain2bBase = () => renderer.renderPdf(starterDocument(PDF_A_2B_BASE), { maxPages: VARIANT_MAX_PAGES })
  return { documentOf, draw, drawVariant, drawStarter2b, drawVariant2b, drawPlain2bBase }
}
