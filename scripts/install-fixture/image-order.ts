/*
 * The order the renderer writes the images PDFKit decodes before it
 * embeds them (0035), on the PDFKit this host installed. pdfmake 0.3.11
 * asks for PDFKit at ^0.19.1, which asks for png-js at ^1.1.0, so a host
 * resolves the newest release of each in range, not the one the
 * workspace's lockfile pins, and the order rests on three details of
 * PDFKit's that are not its API. consume.ts runs it and prints what it
 * returns. It lives apart because it changes when PDFKit's internals do,
 * not when a package's API does.
 *
 * A PNG with an alpha channel, one interlaced and one whose palette has
 * transparency -- PDFKit's three decodes -- are drawn large, each at a size
 * of its own, above a small PNG with an alpha channel, whose decode
 * finishes first: images left to their decodes are written out of order,
 * and a decode that calls `finalize` past the renderer's wrapper holds
 * every image after it, so the render never settles and Node ends this
 * host's top-level await with exit code 13.
 *
 * Read with Node alone, as embedding.ts reads: PDFKit writes an object's
 * dictionary as text, so `/SMask n 0 R` stands in the bytes, and its one
 * cross-reference table says where each object is written.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { renderPdf } from '@formancy/report-render-pdf'
import type { Image, ResolvedDocument } from '@formancy/report-runtime'

/** Adam7's seven passes: the first column and row of each, and the steps between them. */
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const

/**
 * A PNG of 8 bits a sample, `side` pixels a side, of PNG's colour type
 * `colour` -- 2 RGB, 3 paletted, 6 RGB and alpha -- each pixel the samples
 * `pixel` gives it, every scanline unfiltered, and in Adam7's passes where
 * it is interlaced; `chunks` stand between the header and the image data.
 */
function png(side: number, colour: 2 | 3 | 6, pixel: (x: number, y: number) => readonly number[], interlace = false, chunks: readonly (readonly [string, Uint8Array])[] = []): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const framed = Buffer.alloc(typed.length + 8)
    framed.writeUInt32BE(data.length, 0)
    typed.copy(framed, 4)
    framed.writeUInt32BE(crc32(typed), typed.length + 4)
    return framed
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(side, 0)
  header.writeUInt32BE(side, 4)
  header.set([8, colour, 0, 0, interlace ? 1 : 0], 8)
  const scanlines: number[] = []
  for (const [left, top, across, down] of interlace ? ADAM7 : [[0, 0, 1, 1] as const]) {
    for (let y = top; y < side; y += down) {
      scanlines.push(0)
      for (let x = left; x < side; x += across) scanlines.push(...pixel(x, y))
    }
  }
  const framed = [chunk('IHDR', header), ...chunks.map(([type, data]) => chunk(type, data)), chunk('IDAT', deflateSync(Uint8Array.from(scanlines))), chunk('IEND', new Uint8Array(0))]
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...framed]))
}

/** Four colours, and an alpha for each: the paletted image's PLTE and tRNS. */
const PALETTE = new Uint8Array([200, 30, 30, 30, 160, 60, 40, 60, 200, 240, 200, 40])
const PALETTE_ALPHA = new Uint8Array([255, 192, 64, 0])

/** In the order the body draws them, which pdfmake opens them in, each with its side; only the interlaced one, in RGB, has no soft mask. */
const DRAWN = [
  { id: 'large-alpha', side: 256, bytes: png(256, 6, (x, y) => [x & 255, y & 255, 128, (x + y) & 255]) },
  { id: 'large-interlaced', side: 240, bytes: png(240, 2, (x, y) => [y, x, 64], true) },
  { id: 'large-paletted', side: 224, bytes: png(224, 3, (x, y) => [(x + y) % 4], false, [['PLTE', PALETTE], ['tRNS', PALETTE_ALPHA]]) },
  { id: 'small-alpha', side: 16, bytes: png(16, 6, (x, y) => [x * 16, y * 16, 64, 255 - x * 8]) },
] as const

const image = ({ id, bytes }: (typeof DRAWN)[number]): Image => ({ kind: 'image', asset: { id, mediaType: 'image/png', bytes }, width: 120, height: 120, fit: 'contain' })

const DOCUMENT: ResolvedDocument = {
  info: { title: 'Images in order', creationDate: '2026-10-19T08:00:00Z' },
  page: { size: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
  pageHeader: [],
  pageFooter: [],
  body: DRAWN.map(image),
}

/** Where each object is written, by number, and its dictionary, empty for an object that is none: read where PDFKit's one cross-reference table says; throws on a table it cannot read. */
function dictionaries(text: string): Map<number, { at: number; dictionary: string }> {
  const start = /startxref\n(\d+)\n%%EOF\n$/.exec(text)
  const lines = text.slice(Number(start?.[1] ?? Number.NaN)).split('\n')
  const count = Number(/^0 (\d+)$/.exec(lines[1] ?? '')?.[1] ?? Number.NaN)
  if (start === null || lines[0] !== 'xref' || !Number.isSafeInteger(count)) throw new Error('the PDF has no cross-reference table where startxref says')
  const read = new Map<number, { at: number; dictionary: string }>()
  for (let object = 1; object < count; object++) {
    const at = Number(/^(\d{10}) 00000 n $/.exec(lines[2 + object] ?? '')?.[1] ?? Number.NaN)
    const opening = `${String(object)} 0 obj\n`
    if (!text.startsWith(opening, at)) throw new Error(`object ${String(object)} is not where the cross-reference table says`)
    read.set(object, { at, dictionary: text.startsWith('<<', at + opening.length) ? text.slice(at, text.indexOf('>>', at)) : '' })
  }
  return read
}

const ascending = (numbers: readonly number[]): boolean => numbers.every((number, at) => at === 0 || number > numbers[at - 1]!)

/** Checks that the renderer, on this host's PDFKit, numbers the soft masks, and writes them and their images, in the order pdfmake opened the images; throws on the first wrong, and says what held. */
export async function imagesInOrder(): Promise<string> {
  const text = Buffer.from(await renderPdf(DOCUMENT, { maxPages: 1 })).toString('latin1')
  const objects = dictionaries(text)
  const images = [...objects].filter(([, { dictionary }]) => /\/Subtype \/Image\n/.test(dictionary))
  const masks = images.flatMap(([, { dictionary }]) => {
    const mask = /\/SMask (\d+) 0 R/.exec(dictionary)
    return mask === null ? [] : [Number(mask[1])]
  })
  const drawn = images.filter(([object]) => !masks.includes(object))
  const widths = drawn.map(([, { dictionary }]) => Number(/\/Width (\d+)/.exec(dictionary)?.[1]))
  const at = (object: number): number => objects.get(object)?.at ?? Number.NaN
  // PDFKit numbers the images as pdfmake opens them, so their widths, in the order of their numbers, say the numbers are in that order.
  if (JSON.stringify(widths) !== JSON.stringify(DRAWN.map(({ side }) => side)) || masks.length !== 3) throw new Error(`the images were not read as the four drawn, three with a soft mask: ${JSON.stringify({ widths, masks })}`)
  if (!ascending(masks) || !ascending(masks.map(at)) || !ascending(drawn.map(([object]) => at(object)))) {
    throw new Error(`the soft masks were numbered, or they or their images written, in another order than pdfmake opened the images, as the decodes finished: ${JSON.stringify({ masks, masksAt: masks.map(at), imagesAt: drawn.map(([object]) => at(object)) })}`)
  }
  // The versions this host resolved, read from their own manifests: png-js's exports no package.json.
  const pdfkit = path.dirname(createRequire(createRequire(import.meta.url).resolve('pdfmake')).resolve('pdfkit/package.json'))
  const version = (directory: string): string => (JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')) as { version: string }).version
  const pngJs = path.dirname(path.dirname(createRequire(path.join(pdfkit, 'package.json')).resolve('png-js')))
  return `a large PNG with an alpha channel, an interlaced one and one with a palette's transparency above a small one with an alpha channel rendered, with their soft masks numbered and both written in the order pdfmake opened them, on PDFKit ${version(pdfkit)} and png-js ${version(pngJs)}`
}
