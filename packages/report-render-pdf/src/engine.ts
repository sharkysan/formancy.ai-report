import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { characterMap, type BillFace, type BillGlyphs, type Face, type Glyphs } from './glyphs.js'

/**
 * pdfmake with the renderer's fonts and access policies, as Node's entry
 * (`node.ts`) or the browser's (`browser.ts`) configures it: what runs a
 * definition and returns the PDF's bytes, and the characters the faces it
 * embeds have glyphs for. Everything else a render does is the same in both
 * (`render.ts`).
 */
export interface Engine {
  readonly run: (definition: TDocumentDefinitions) => Promise<Uint8Array>
  /** Roboto's four faces, which a report's own text prints in. */
  readonly glyphs: () => Promise<Glyphs>
  /**
   * Liberation Sans's two faces, which a QR-bill's slip and an EPC QR
   * code's caption print in: read the first time a document has a payment
   * part or a captioned code, and in a browser loaded then, so that a host
   * that never prints either never loads them. Once they are read, `run`
   * has them for a document that prints them.
   */
  readonly billGlyphs: () => Promise<BillGlyphs>
}

/** Roboto's faces, as pdfmake names them. */
export const FACES: readonly Face[] = ['normal', 'bold', 'italics', 'bolditalics']

/** Liberation Sans's, as pdfmake names them. */
export const BILL_FACES: readonly BillFace[] = ['normal', 'bold']

/**
 * What `load` loads, loaded by the first call and kept for every call after
 * it: the fonts do not change while the process or the page runs. Calls made
 * while it loads share the one load. A load that fails is not kept: the
 * calls that shared it fail, and the next call loads again, so that a file
 * the process could not open just then, or a chunk the browser could not
 * fetch, fails the documents that asked for it and no document after.
 */
export function loadOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | undefined
  return () =>
    (loading ??= load().catch((error: unknown) => {
      loading = undefined
      throw error
    }))
}

/** The glyphs of `faces`, from the bytes `read` reads for each. */
export async function glyphsOf<F extends string>(faces: readonly F[], read: (face: F) => Promise<Uint8Array>): Promise<Readonly<Record<F, ReadonlySet<number>>>> {
  const maps = await Promise.all(faces.map(async (face) => [face, characterMap(await read(face))] as const))
  return Object.fromEntries(maps) as Record<F, ReadonlySet<number>>
}

/** The glyphs of `faces`, read by `read` the first time they are asked for and kept once every face has been read (`loadOnce`). */
export function glyphsOnce<F extends string>(faces: readonly F[], read: (face: F) => Promise<Uint8Array>): () => Promise<Readonly<Record<F, ReadonlySet<number>>>> {
  return loadOnce(() => glyphsOf(faces, read))
}

/** PDFKit's document, as both of pdfmake's builds hand it out: a readable stream, ended to be written. */
export interface PdfStream {
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown
  on(event: 'end', listener: () => void): unknown
  on(event: 'error', listener: (error: unknown) => void): unknown
  end(): unknown
}

/**
 * The PDF's bytes, read from PDFKit's stream. pdfmake's own `getBuffer`
 * listens for the end of the stream and never for an error, so a stream that
 * fails leaves its promise pending forever; this one rejects.
 */
export function collect(stream: PdfStream): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => {
      const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      resolve(bytes)
    })
    stream.end()
  })
}
