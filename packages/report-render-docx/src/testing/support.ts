import { deflateSync } from 'node:zlib'
import { expectation, pngOf, readDocx, STARTER_IMAGES, type Docx, type Fixture, type Starter } from '@formancy/report-corpus'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { Block, ImageAsset, Paragraph, ReportData, ResolvedDocument, ResolveOptions, TextStyle } from '@formancy/report-runtime'
import { renderDocx } from '../render.js'

/**
 * What the writer's tests share: a document written and read back by the
 * corpus's reader, never by anything of the writer's (0068); a refusal
 * caught as what it says; and small documents built as the corpus builds
 * its fixtures.
 */

/** Fixed, so that a document is the same file every time. */
export const CREATED = '2026-10-15T08:00:00Z'

/** `document` written, and the file read back whole. */
export function written(document: ResolvedDocument): Docx {
  return readDocx(renderDocx(document))
}

/** What the writer refuses `document` as; fails the test where it writes it, or throws anything else. */
export function refusalOf(document: ResolvedDocument): { readonly code: string; readonly subject: string | undefined; readonly message: string } {
  try {
    renderDocx(document)
  } catch (error) {
    if (error instanceof RenderRefusal) return { code: error.code, subject: error.subject, message: error.message }
    throw error
  }
  throw new Error('the document was written, where a refusal was expected')
}

export function paragraph(text: string, style?: TextStyle): Paragraph {
  return { kind: 'paragraph', runs: [{ text }], ...(style === undefined ? {} : { style }) }
}

/** A document of `body` on an A4 page with 50 points of margin, with nothing in its page regions unless `more` says so. */
export function documentOf(body: readonly Block[], more: Partial<ResolvedDocument> = {}): ResolvedDocument {
  return {
    info: { title: 'A document', creationDate: CREATED },
    page: { size: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
    pageHeader: [],
    pageFooter: [],
    body,
    ...more,
  }
}

/** The bytes of a pixel of each kind of PNG `blank` makes, with its bit depth and its colour type: grey, and RGB with alpha at eight bits and at sixteen. */
const PIXELS = { grey: [1, 8, 0], rgba: [4, 8, 6], deep: [8, 16, 6] } as const

/**
 * A PNG of `width` by `height` pixels, every byte of every scanline
 * nothing: `deep`, sixteen bits of RGB with alpha, is the most a pixel
 * may be, eight bytes. What it holds once inflated is its header's to
 * say, `height` times one byte more than its pixels across, and its file
 * is small, since nothing deflates to little: the pictures the bounds on
 * image data are tried with. `stream` is its image data where a test
 * wants other than those scanlines, framed and summed as a chunk all the
 * same.
 */
export function blank(id: string, width: number, height: number, kind: keyof typeof PIXELS = 'deep', stream?: Uint8Array): ImageAsset {
  const [bytes, depth, colour] = PIXELS[kind]
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([depth, colour, 0, 0, 0], 8)
  const data = stream ?? new Uint8Array(deflateSync(new Uint8Array(height * (1 + width * bytes))))
  return {
    id,
    mediaType: 'image/png',
    bytes: pngOf([
      ['IHDR', header],
      ['IDAT', data],
      ['IEND', new Uint8Array(0)],
    ]),
  }
}

/**
 * A PNG of one grey pixel, padded with a text chunk to exactly `length`
 * bytes; `mark` tells one such picture from another. Its file is as
 * large as it is asked to be and it inflates to two bytes: the pictures
 * the bound on a file's stored bytes is tried with.
 */
export function padded(id: string, length: number, mark: number): ImageAsset {
  const header = new Uint8Array(13)
  new DataView(header.buffer).setUint32(0, 1)
  new DataView(header.buffer).setUint32(4, 1)
  header.set([8, 0, 0, 0, 0], 8)
  const data = new Uint8Array(deflateSync(new Uint8Array([0, mark])))
  // The signature, and twelve bytes of framing a chunk, around the header, the text, the image data and the end.
  const text = new Uint8Array(length - 8 - 4 * 12 - header.length - data.length).fill(0x78)
  text.set(new TextEncoder().encode('Comment\0'))
  return {
    id,
    mediaType: 'image/png',
    bytes: pngOf([
      ['IHDR', header],
      ['tEXt', text],
      ['IDAT', data],
      ['IEND', new Uint8Array(0)],
    ]),
  }
}

/** `document` as a fixture, its expectation derived as every fixture's is: what `verifyDocx` holds its file to. */
export function fixtureOf(id: string, document: ResolvedDocument, stated: Partial<Fixture['expect']> = {}): Fixture {
  return { id, title: id, document, maxPages: 99, expect: expectation(document, { maxPagesExpected: 99, ...stated }) }
}

/** `starter` resolved against `data`, its own where none is given, as a host resolves it: a final render unless `options` say otherwise. */
export function resolved(starter: Starter, options: Partial<ResolveOptions> = {}, data: ReportData = starter.data): ResolvedDocument {
  const outcome = resolveReport(starter.report, data, {
    mode: 'final',
    parameters: starter.parameters,
    images: (ref) => STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest),
    creationDate: CREATED,
    ...options,
  })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}
