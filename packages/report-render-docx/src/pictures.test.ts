import { deflateSync, inflateSync } from 'node:zlib'
import {
  encodePng,
  IMAGE_KINDS,
  pngOf,
  readZip,
  SVG_MARK,
  SVG_WINDOW,
  UNSEEN_JPEGS,
  verifyDocx,
  type DocxParagraph,
  type DocxPicture,
} from '@formancy/report-corpus'
import { imageHeader, MAX_ASSET_BYTES } from '@formancy/report-runtime'
import type { Image, ImageAsset } from '@formancy/report-runtime'
import { Unzlib } from 'fflate'
import { describe, expect, test, vi } from 'vitest'
import { SVG_FALLBACK } from './assets.js'
import { renderDocx } from './render.js'
import { documentOf, fixtureOf, refusalOf, written } from './testing/support.js'

/**
 * A picture in a Word file (0068), on the file: its part the asset's
 * very bytes, its extent and its place in its box, its crop, an SVG
 * beside the picture a reader that draws none shows, and every kind of
 * image the PDF embeds written or refused. A Word file embeds bytes as
 * they are, so what is no picture, or is an SVG that is more than a
 * drawing, is refused before it goes in.
 */

/** A PNG 200 pixels wide and 100 tall. */
const WIDE: ImageAsset = { id: 'wide', mediaType: 'image/png', bytes: encodePng(200, 100, (x, y) => [x, y, 128]) }
/** An SVG whose viewBox is 120 by 120, and one of 200 by 100. */
const MARK: ImageAsset = { id: 'mark', mediaType: 'image/svg+xml', bytes: SVG_MARK }
const WINDOW: ImageAsset = { id: 'window', mediaType: 'image/svg+xml', bytes: SVG_WINDOW }

const image = (asset: ImageAsset, width: number, height: number, fit: Image['fit'] = 'contain'): Image => ({ kind: 'image', asset, width, height, fit })

/** The picture of each image paragraph of a file's body, with its paragraph. */
function picturesOf(blocks: readonly unknown[]): { readonly paragraph: DocxParagraph; readonly picture: DocxPicture }[] {
  return (blocks as DocxParagraph[]).flatMap((paragraph) =>
    paragraph.kind === 'paragraph' ? paragraph.runs.flatMap((run) => (run.kind === 'picture' ? [{ paragraph, picture: run.picture }] : [])) : [],
  )
}

const one = (block: Image): { readonly paragraph: DocxParagraph; readonly picture: DocxPicture } => picturesOf(written(documentOf([block])).body)[0]!

describe('a PNG or a JPEG', () => {
  // The part is the asset, byte for byte: a file that re-encoded a picture would print other pixels than the PDF with nothing saying so.
  test("is a part of the asset's very bytes, named by its order and stored as it is", () => {
    const bytes = renderDocx(documentOf([image(WIDE, 100, 50)]))
    const entry = readZip(bytes).find((each) => each.name === 'word/media/image1.png')
    expect(entry?.bytes).toEqual(WIDE.bytes)
    // Compressed already: deflating it again buys nothing and costs a host the time.
    expect(entry?.method).toBe('stored')
    expect(one(image(WIDE, 100, 50)).picture.part).toMatchObject({ name: 'word/media/image1.png', contentType: 'image/png' })
  })

  // A contained picture keeps its proportions and stands in the middle of its box, which the paragraph reserves whole: drawn at the box's size it would be stretched.
  test.each([
    ['in a box of its own proportions', [100, 50], { width: 100, height: 50, indent: 0, before: 0, after: 0 }],
    ['in a taller box', [120, 120], { width: 120, height: 60, indent: 0, before: 30, after: 30 }],
    ['in a wider box', [300, 50], { width: 100, height: 50, indent: 100, before: 0, after: 0 }],
  ] as const)('contained %s is drawn at its own proportions, centred', (_name, [width, height], expected) => {
    const { paragraph, picture } = one(image(WIDE, width, height))
    expect({ width: picture.width, height: picture.height, indent: paragraph.indent, before: paragraph.before, after: paragraph.after }).toEqual(expected)
    expect(picture.crop).toBeUndefined()
  })

  // A covering picture fills its box and loses what its proportions leave over, equally at both sides: uncropped it would be squeezed into the box.
  test.each([
    ['a square box', [60, 60], { left: 0.25, top: 0, right: 0.25, bottom: 0 }],
    ['a box four times as wide as tall', [200, 50], { left: 0, top: 0.25, right: 0, bottom: 0.25 }],
  ] as const)('covering %s is cropped by what its pixels leave over', (_name, [width, height], crop) => {
    const { paragraph, picture } = one(image(WIDE, width, height, 'cover'))
    expect({ width: picture.width, height: picture.height, crop: picture.crop }).toEqual({ width, height, crop })
    expect([paragraph.indent, paragraph.before, paragraph.after]).toEqual([0, 0, 0])
  })

  // A crop of nothing written all the same would be an element for a reader to trip on, and a rounding away from it a sliver cut from the picture.
  test('covering a box of its own proportions is cropped by nothing', () => {
    expect(one(image(WIDE, 100, 50, 'cover')).picture.crop).toBeUndefined()
  })

  // An asset is one part however often it is drawn, and each part that draws it has a relationship of its own to it.
  test('drawn in the header and twice in the body is one part, each picture numbered as it is written', () => {
    const docx = written(documentOf([image(WIDE, 100, 50), image(WIDE, 50, 25)], { pageHeader: [image(WIDE, 20, 10)] }))
    expect([...docx.parts.keys()].filter((name) => name.startsWith('word/media/'))).toEqual(['word/media/image1.png'])
    expect(picturesOf(docx.header!.blocks).map(({ picture }) => picture.id)).toEqual([1])
    expect(picturesOf(docx.body).map(({ picture }) => picture.id)).toEqual([2, 3])
    expect(docx.relationships('word/header1.xml').map(({ target }) => target)).toEqual(['word/media/image1.png'])
  })
})

describe('an SVG', () => {
  // The drawing is embedded as the host approved it, beside a picture for a reader that draws no SVG: without the second, such a reader shows nothing where the logo is.
  test("is embedded as the asset's very bytes, beside a grey pixel for a reader that draws none", () => {
    const { picture } = one(image(MARK, 40, 40))
    expect(picture.svg).toMatchObject({ name: 'word/media/image1.svg', contentType: 'image/svg+xml' })
    expect(picture.svg?.bytes).toEqual(SVG_MARK)
    expect(picture.part).toMatchObject({ name: 'word/media/image2.png', contentType: 'image/png' })
    expect(picture.part.bytes).toEqual(SVG_FALLBACK)
  })

  // The fallback is typed out in the source: held here to being the picture its comment says, one grey pixel.
  test('has a fallback that is a PNG of one pixel, grey', () => {
    const header = imageHeader(SVG_FALLBACK)
    expect(header).toMatchObject({ ok: true, mediaType: 'image/png', width: 1, height: 1, bitsPerPixel: 8 })
    expect(header.ok && header.mediaType === 'image/png' && [...inflateSync(header.data)]).toEqual([0, 0xbf])
  })

  // One fallback for every SVG, and an SVG's text deflated: a logo on every page region is not a part each.
  test('shares its fallback with every other SVG, and is deflated', () => {
    const bytes = renderDocx(documentOf([image(MARK, 40, 40), image(WINDOW, 80, 40)]))
    const entries = readZip(bytes).filter((each) => each.name.startsWith('word/media/'))
    expect(entries.map(({ name, method }) => [name, method])).toEqual([
      ['word/media/image1.svg', 'deflated'],
      ['word/media/image2.png', 'stored'],
      ['word/media/image3.svg', 'deflated'],
    ])
  })

  // Its proportions are its viewBox's: contained in a box of others, it is drawn at its own and centred, as a PNG is.
  test("contained in a wider box is drawn at its viewBox's proportions, centred", () => {
    const { paragraph, picture } = one(image(MARK, 80, 40))
    expect({ width: picture.width, height: picture.height, indent: paragraph.indent }).toEqual({ width: 40, height: 40, indent: 20 })
  })

  const svg = (inner: string, head = ''): ImageAsset => ({
    id: 'drawing',
    mediaType: 'image/svg+xml',
    bytes: new TextEncoder().encode(`${head}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`),
  })

  // An SVG is the one place bytes from outside enter the file as XML that Word parses. Only the drawing `cleanSvg` writes goes in:
  // each of these is a file a person could upload, and none of them is embedded.
  test.each([
    ['a script', svg('<script>alert(1)</script><rect width="10" height="10"/>')],
    ['a handler', svg('<rect width="10" height="10" onload="alert(1)"/>')],
    ['an image at an address', svg('<image href="https://example.com/track.png" width="10" height="10"/>')],
    ['a link', svg('<a href="https://example.com/"><rect width="10" height="10"/></a>')],
    ['a foreign object', svg('<foreignObject width="10" height="10"><p xmlns="http://www.w3.org/1999/xhtml">x</p></foreignObject>')],
    ['an entity of its own', svg('<text>&e;</text>', '<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]>')],
    ['a style that fetches', svg('<style>@import url(https://example.com/x.css);</style><rect width="10" height="10"/>')],
    ['a drawing that is not in the form it was approved in', svg('<rect   width="10"   height="10"   fill="red"/>')],
  ])('with %s is refused, naming the asset, and nothing of it is written', (_name, asset) => {
    expect(refusalOf(documentOf([image(asset, 20, 20)]))).toMatchObject({ code: 'invalid-asset', subject: 'drawing' })
  })
})

describe('every kind of image the PDF embeds', () => {
  // Each kind PDFKit embeds in a way of its own is one a host may hold: a Word file embeds the bytes, so each is the same part, and each is held to the file.
  test.each(IMAGE_KINDS.map((asset) => [asset.id, asset] as const))('%s is written as its bytes', (id, asset) => {
    const document = documentOf([image(asset, 32, 32)])
    const docx = written(document)
    expect(verifyDocx(fixtureOf(id, document), docx)).toEqual([])
    expect(picturesOf(docx.body)[0]!.picture.part.bytes).toEqual(asset.bytes)
  })

  // The two the PDF draws otherwise than their bytes say -- turned, and in CMYK -- are refused: nobody has seen what Word does with either.
  test.each(UNSEEN_JPEGS.map((asset) => [asset.id, asset] as const))('%s is refused, naming it', (id, asset) => {
    expect(refusalOf(documentOf([image(asset, 32, 32)]))).toMatchObject({ code: 'unsupported', subject: id })
  })
})

describe('bytes that are not the picture they are declared as', () => {
  const header = (width: number, height: number): Uint8Array => {
    const bytes = new Uint8Array(13)
    const view = new DataView(bytes.buffer)
    view.setUint32(0, width)
    view.setUint32(4, height)
    // Eight bits of grey a pixel.
    bytes.set([8, 0, 0, 0, 0], 8)
    return bytes
  }
  /** A grey PNG of 4 by 4 pixels whose image data is `data` deflated: 20 bytes, when it is whole. */
  const png = (data: Uint8Array, deflated = true): ImageAsset => ({
    id: 'scan',
    mediaType: 'image/png',
    bytes: pngOf([
      ['IHDR', header(4, 4)],
      ['IDAT', deflated ? new Uint8Array(deflateSync(data)) : data],
      ['IEND', new Uint8Array(0)],
    ]),
  })
  const refused = (asset: ImageAsset): string => {
    const refusal = refusalOf(documentOf([image(asset, 20, 20)]))
    expect(refusal).toMatchObject({ code: 'invalid-asset', subject: asset.id })
    return refusal.message
  }

  // A whole PNG of the same shape is written: the refusals below are of its data, not of the way this test builds one.
  test('are told from a PNG whose image data is what its header promises', () => {
    expect(picturesOf(written(documentOf([image(png(new Uint8Array(20)), 20, 20)])).body)).toHaveLength(1)
  })

  /** The zlib stream of the whole picture's image data: its header, its deflate data, and the four bytes of its checksum. */
  const STREAM = new Uint8Array(deflateSync(new Uint8Array(20)))
  const SUM = STREAM.slice(-4)

  // The PDF renderer inflates a PNG's data and refuses one that is not its scanlines; a Word file embeds the bytes unread by Word until
  // someone opens it, so the same are refused here, by the decompressor the package zips with. The last four are streams that inflate to
  // the very scanlines the header promises and are damaged all the same, which only the checksum and the place the stream ends can say:
  // the corpus's list of malformed documents holds both engines to each (`against-pdf.test.ts`).
  test.each([
    ['image data that does not inflate', png(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), false), /has image data that does not inflate/],
    ['fewer scanlines than its header promises', png(new Uint8Array(15)), /has image data of 15 bytes where its header promises 20/],
    ['more image data than its header promises', png(new Uint8Array(4096)), /has more image data than the 20 bytes its header promises/],
    ['a scanline with a filter PNG does not define', png(Uint8Array.from({ length: 20 }, (_, index) => (index === 5 ? 9 : 0))), /unknown filter type \(9\)/],
    ['image data its checksum does not sum', png(Uint8Array.from([...STREAM.slice(0, -1), STREAM.at(-1)! ^ 0xff]), false), /does not inflate/],
    ['bytes after the end of its image data', png(Uint8Array.from([...STREAM, 1, 2, 3, 4, 5, 6, 7, 8]), false), /does not inflate/],
    ['bytes after its image data that end in its checksum', png(Uint8Array.from([...STREAM, 1, 2, 3, 4, ...SUM]), false), /does not inflate/],
    ['one byte after its image data, and its checksum again', png(Uint8Array.from([...STREAM.slice(0, -3), ...SUM]), false), /does not inflate/],
    [
      'image data that ends before its last block',
      png(Uint8Array.from([0x78, 0x01, 0, 20, 0, 0xeb, 0xff, ...new Uint8Array(20), 0, 20, 0, 1]), false),
      /does not inflate/,
    ],
    ['a zlib header and a checksum with no data between them', png(Uint8Array.from([0x78, 0x9c, 0, 0, 0, 1]), false), /does not inflate/],
  ])('a PNG with %s is refused', (_name, asset, sentence) => {
    expect(refused(asset)).toMatch(sentence)
  })

  // fflate keeps what it has not read and joins every later slice to it, so reading on past a stream's end costs the square of what
  // follows it: sixteen megabytes after a stream of thirty bytes held the thread 4.2 seconds before this was held. The writer stops
  // where the stream ends, by the decompressor's own word for it (`assets.ts`), which this is the proof of: not a clock, the slices read.
  test('a PNG with a mebibyte after the end of its image data is refused at that end, the rest unread', () => {
    const data = new Uint8Array(STREAM.length + (1 << 20)).fill(0x55)
    data.set(STREAM)
    const push = vi.spyOn(Unzlib.prototype, 'push')
    try {
      expect(refused(png(data, false))).toMatch(/does not inflate/)
      expect(push).toHaveBeenCalledTimes(1)
    } finally {
      push.mockRestore()
    }
  })

  // What a host declared and what the bytes are disagree: embedded under the declared type, Word would be handed a JPEG named .png.
  test.each<[string, ImageAsset, RegExp]>([
    ['a PNG declared a JPEG', { ...WIDE, mediaType: 'image/jpeg' }, /is declared a JPEG and is not one: it is a PNG/],
    ['an SVG declared a PNG', { ...MARK, mediaType: 'image/png' }, /is declared a PNG and is not one: it is an SVG/],
    ['a PNG declared an SVG', { ...WIDE, mediaType: 'image/svg+xml' }, /is declared an SVG and is not one: it is a PNG/],
    ['text declared a PNG', { id: 'wide', mediaType: 'image/png', bytes: new TextEncoder().encode('not a picture') }, /is declared a PNG and is not one$/],
    ['a font declared an image', { id: 'wide', mediaType: 'font/ttf', bytes: WIDE.bytes } as unknown as ImageAsset, /a media type a Word file does not hold/],
    ['no bytes at all', { id: 'wide', mediaType: 'image/png', bytes: undefined as unknown as Uint8Array }, /has no bytes/],
    ['more bytes than an asset may be', { id: 'wide', mediaType: 'image/png', bytes: new Uint8Array(MAX_ASSET_BYTES + 1) }, /the limit is 20971520/],
  ])('%s is refused', (_name, asset, sentence) => {
    expect(refused(asset)).toMatch(sentence)
  })
})
