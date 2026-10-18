import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

/**
 * Real PDFs for the reader's and the checks' own tests, made by pdfmake from
 * plain document definitions. Not an engine adapter: a test writes the exact
 * PDF it needs -- a missing row, a footer left off a page, a file embedded
 * -- and proves a check sees it on the bytes, never on a mocked page.
 *
 * pdfmake is one configuration per process, so this sets it once: Roboto from
 * pdfmake's own package (Roboto 3, SIL Open Font License 1.1, which allows
 * embedding), Helvetica as an unembedded standard font for the one test that
 * needs a font missing from the file, no URL access, and local access to those
 * files only. A PDF/A subset makes pdfkit read its own ICC profile besides,
 * with `fs` and past pdfmake's policy (pdfkit.js 5265).
 */
const pdfmakeDirectory = path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json'))
const roboto = (file: string): string => path.join(pdfmakeDirectory, 'fonts', 'Roboto', file).split(path.sep).join('/')

const fonts = {
  Roboto: {
    normal: roboto('Roboto-Regular.ttf'),
    bold: roboto('Roboto-Medium.ttf'),
    italics: roboto('Roboto-Italic.ttf'),
    bolditalics: roboto('Roboto-MediumItalic.ttf'),
  },
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
}
const allowed = new Set<string>(Object.values(fonts).flatMap((family) => Object.values(family)))

pdfmake.setFonts(fonts)
pdfmake.setUrlAccessPolicy(() => false)
pdfmake.setLocalAccessPolicy((file) => allowed.has(file.split(path.sep).join('/')))

/** What `file` takes in pdfkit 0.19.1 (pdfkit.js 5160-5244), `relationship` among it, which @types/pdfkit 0.17.6 leaves out. */
export interface PdfKitFileOptions {
  readonly name: string
  readonly type?: string
  readonly description?: string
  readonly hidden?: boolean
  readonly creationDate?: Date
  readonly modifiedDate?: Date
  /** Written as the file specification's /AFRelationship. */
  readonly relationship?: string
}

/** PDFKit's document as pdfmake's `getStream` hands it over, before it is ended: what a test adds to a PDF through it. */
export interface PdfKitDocument {
  /** Embeds `bytes`, an ArrayBuffer, since a typed array falls through to `fs.readFileSync` (pdfkit.js 5172-5184). */
  file(bytes: ArrayBuffer, options: PdfKitFileOptions): unknown
  appendXML(xml: string): void
}

/** The ArrayBuffer of exactly `bytes`, copied out of whatever larger buffer they are a view of. */
export function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/**
 * The PDF pdfmake makes of `definition`, with a fixed creation date. `finish`,
 * where given, acts on PDFKit's document between `getStream` and `end`, as
 * the renderer's own hook does: where a file is embedded and XMP appended.
 * `getStream` hands over the very document `getBuffer` then ends
 * (pdfmake's `OutputDocument.js`).
 */
export async function pdfmakePdf(definition: TDocumentDefinitions, finish?: (document: PdfKitDocument) => void): Promise<Uint8Array> {
  const output = pdfmake.createPdf({ ...definition, info: { title: 'corpus test', creationDate: new Date('2026-01-01T00:00:00Z'), ...definition.info } })
  finish?.(await output.getStream())
  return new Uint8Array(await output.getBuffer())
}
