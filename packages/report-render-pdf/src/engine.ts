import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { characterMap, type BillFace, type BillGlyphs, type Face, type Glyphs } from './glyphs.js'
import type { HostFontFiles } from './host-fonts.js'
import { finalizeInOrder, type PdfKitImages } from './image-order.js'
import type { Finish, PdfKitDocument } from './pdfa.js'

/**
 * pdfmake with the renderer's fonts and access policies, as Node's entry
 * (`node.ts`) or the browser's (`browser-engine.ts`) configures it: what
 * runs a definition and returns the PDF's bytes, the characters the faces
 * it embeds have glyphs for, and the widths a chart's words are laid out by,
 * measured in those faces. Everything else a render does is the same in
 * both (`render.ts`).
 */
export interface Engine {
  /**
   * The PDF of `definition`, with `host`'s faces registered in pdfmake's
   * virtual files for this run and removed after it, whether it wrote a
   * PDF, measured or threw (0043). `finish`, where
   * given, acts on PDFKit's document once pdfmake has laid it out and before
   * it is ended, which is where an e-invoice's file and XMP are added
   * (`pdfa.ts`): only the final pass gives one, since a measuring pass
   * throws before its end.
   */
  readonly run: (definition: TDocumentDefinitions, host: HostFontFiles, finish?: Finish) => Promise<Uint8Array>
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
  /**
   * `faces` opened for measuring a chart's words: from a document of the
   * entry's own pdfmake, its fonts and access policies set as `run` sets
   * them, each face opened at once with pdfmake's `provideFont` -- the
   * call a pass opens a text node's face with -- while `host`'s virtual
   * files are registered, and the files removed after, as `run` removes
   * them, whether every face opened or one threw (0043). The document holds
   * no content and is never ended, so it writes no PDF.
   */
  readonly widths: (host: HostFontFiles, faces: readonly MeasuredFace[]) => Promise<FaceWidths>
}

/** A face a chart's words are measured in: its pdfmake family, and which of the family's faces. */
export interface MeasuredFace {
  readonly family: string
  readonly face: Face
}

/** Widths as pdfmake measures them, in the faces `Engine.widths` opened. */
export interface FaceWidths {
  /**
   * The width of `text` at `size` in `family`'s `face`: PDFKit's
   * `widthOfString` of the face pdfmake opened. That is the width pdfmake
   * gives a text node it lays out without wrapping only for text with no
   * whitespace at either end and no tab: pdfmake cuts a run's leading and
   * trailing `\s` -- no-break spaces among them -- out of its width, and
   * expands a tab to four spaces before it measures, and this does neither
   * (`engine.test.ts`). A word reaches it trimmed and without a tab, or is
   * measured apart from how pdfmake prints it. Throws for a face that was
   * not opened: its virtual file is gone by now.
   */
  width(family: string, face: Face, size: number, text: string): number
}

/** pdfmake's virtual file system, as both builds expose it: a plain `storage` object the renderer writes a host face into and removes after, since it has no delete (0043). */
export interface VirtualFs {
  readonly storage: Record<string, unknown>
}

/**
 * Writes `host`'s faces into `virtualfs` for one pass and returns the
 * cleanup that removes them: pdfmake's virtual files are process-wide and
 * have no delete, so each pass adds its render's host faces and takes them
 * out again, and a process holds the faces of the renders in flight and no
 * other. The names are the render's own (`host-fonts.ts`), so a cleanup
 * removes no file another render still reads (0043).
 */
export function registerHostFonts(virtualfs: VirtualFs, host: HostFontFiles): () => void {
  for (const [name, bytes] of host.files) virtualfs.storage[name] = bytes
  return () => {
    for (const name of host.files.keys()) delete virtualfs.storage[name]
  }
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
export async function glyphsOf<F extends string>(
  faces: readonly F[],
  read: (face: F) => Promise<Uint8Array>,
): Promise<Readonly<Record<F, ReadonlySet<number>>>> {
  const maps = await Promise.all(faces.map(async (face) => [face, characterMap(await read(face))] as const))
  return Object.fromEntries(maps) as Record<F, ReadonlySet<number>>
}

/** The glyphs of `faces`, read by `read` the first time they are asked for and kept once every face has been read (`loadOnce`). */
export function glyphsOnce<F extends string>(
  faces: readonly F[],
  read: (face: F) => Promise<Uint8Array>,
): () => Promise<Readonly<Record<F, ReadonlySet<number>>>> {
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
 * The PDF of the document `getStream` hands over, `finish` acting on it
 * first: what each entry's `run` does once it has configured its pdfmake.
 * The images PDFKit is still decoding are written in the order pdfmake
 * opened them, whichever decode finishes first (`image-order.ts`, 0035).
 */
export async function written(document: Promise<unknown>, finish: Finish | undefined): Promise<Uint8Array> {
  const pdf = (await document) as PdfStream & PdfKitDocument & PdfKitImages
  finalizeInOrder(pdf)
  finish?.(pdf)
  return collect(pdf)
}

/** PDFKit's face as pdfmake's `provideFont` opens it, as far as measuring reads it. */
interface PdfKitFace {
  widthOfString(text: string, size: number): number
}

/** pdfmake's PDFKit document, as far as measuring reads it: what opens a face of its font table. */
interface FaceProvider {
  provideFont(family: string, bold: boolean, italics: boolean): PdfKitFace
}

/**
 * `faces` opened at once on the document `getStream` hands over, a document
 * of the entry's pdfmake made while the render's virtual files are
 * registered: what each entry's `widths` does once it has configured its
 * pdfmake, as `written` is what its `run` does.
 */
export async function faceWidths(document: Promise<unknown>, faces: readonly MeasuredFace[]): Promise<FaceWidths> {
  const pdf = (await document) as FaceProvider
  const opened = new Map(
    faces.map(({ family, face }) => [
      `${family}/${face}`,
      pdf.provideFont(family, face === 'bold' || face === 'bolditalics', face === 'italics' || face === 'bolditalics'),
    ]),
  )
  return {
    width: (family, face, size, text) => {
      const font = opened.get(`${family}/${face}`)
      if (font === undefined) throw new Error(`no face ${family} ${face} was opened for measuring`)
      return font.widthOfString(text, size)
    },
  }
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
