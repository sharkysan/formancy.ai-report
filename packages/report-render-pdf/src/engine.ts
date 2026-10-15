import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { characterMap, type Face, type Glyphs } from './glyphs.js'

/**
 * pdfmake with the renderer's fonts and access policies, as Node's entry
 * (`node.ts`) or the browser's (`browser.ts`) configures it: what runs a
 * definition and returns the PDF's bytes, and the characters the faces it
 * embeds have glyphs for. Everything else a render does is the same in both
 * (`render.ts`).
 */
export interface Engine {
  readonly run: (definition: TDocumentDefinitions) => Promise<Uint8Array>
  readonly glyphs: () => Promise<Glyphs>
}

/** The glyphs of the four faces, from their bytes, read once by `read` and kept: the fonts do not change while the process runs. */
export function glyphsOnce(read: (face: Face) => Promise<Uint8Array>): () => Promise<Glyphs> {
  let glyphs: Promise<Glyphs> | undefined
  return () =>
    (glyphs ??= (async () => {
      const faces: readonly Face[] = ['normal', 'bold', 'italics', 'bolditalics']
      const maps = await Promise.all(faces.map(async (face) => [face, characterMap(await read(face))] as const))
      return Object.fromEntries(maps) as unknown as Glyphs
    })())
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
