/*
 * A PDF/A-2b, from the packed packages under Node: the quotation drawn in a
 * final render with `pdfa: '2b'`, the archival PDF an e-invoice is not
 * (D-pdfa). consume.ts runs it and prints what it returns. What only this
 * gate sees is the PDFKit a clean npm install gives pdfmake, the one
 * report-render-pdf pins (0036), and the profile it reads from its own
 * directory there; embedding.ts reads PDFKit's bytes with Node alone.
 */
import { resolveReport } from '@formancy/report-runtime'
import type { ImageResolver } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'
import { readEmbedding, SRGB2014 } from './embedding.js'
import type { Embedding } from './embedding.js'
import { logo, quotation, quotationData } from './quotation.js'

const images: ImageResolver = (ref) => (ref.asset === 'logo' && ref.digest === logo.digest ? { mediaType: 'image/svg+xml', bytes: logo.bytes } : undefined)

export async function archivedPdfA(): Promise<string> {
  const resolution = resolveReport(quotation, quotationData, { mode: 'final', images, creationDate: '2026-10-15T08:00:00Z' })
  if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const pdf = await renderPdf(resolution.document, { maxPages: 50, pdfa: '2b' })
  const embedding: Embedding = readEmbedding(pdf)
  const xmp = embedding.xmp ?? ''
  const held: Readonly<Record<string, boolean>> = {
    'PDF 1.7': embedding.version === '1.7',
    'no file associated or named': embedding.associated.length === 0 && embedding.names.length === 0,
    'PDF/A-2b in the XMP': xmp.includes('<pdfaid:part>2</pdfaid:part>') && xmp.includes('<pdfaid:conformance>B</pdfaid:conformance>'),
    'the reviewed sRGB2014 output intent': JSON.stringify(embedding.outputProfiles) === JSON.stringify([SRGB2014]),
  }
  const missed = Object.keys(held).filter((check) => held[check] !== true)
  if (missed.length > 0)
    throw new Error(`the quotation was not drawn as a PDF/A-2b; it lacks ${missed.join('; ')}: ${JSON.stringify({ ...embedding, xmp: embedding.xmp?.length })}`)
  return `the quotation drawn as a ${pdf.length}-byte PDF/A-2b that says so in its XMP, embeds nothing and carries the reviewed sRGB profile`
}
