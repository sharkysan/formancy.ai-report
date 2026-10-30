import { describe, expect, test } from 'vitest'
import { crc32, IMAGE_REFUSAL_CODES, imageHeader, sniffImage } from './image-header.js'
import type { ImageRefusal, ImageRefusalCode } from './image-header.js'
import { DATA, crcOf, exifSegment, frameSegment, ihdr, jpegOf, NONE, pngOf, rgbPng } from './image-test-support.js'
import { MAX_ASSET_SIDE } from './limits.js'
import { cleanSvg } from './svg.js'
import { utf8 } from './svg-test-support.js'

/**
 * The reading of a PNG's or a JPEG's structure that an upload and the
 * renderer share (0033): what a builder refuses when a person adds an image
 * is what the renderer would refuse at every print, decided once. The
 * renderer's own `assets.test.ts` holds the same refusals through its
 * check, unchanged since the reader moved here; these hold the reader
 * itself, where builder-core reaches it.
 */

/** The refusal `imageHeader` gives `bytes`, failing the test when it reads them. */
function refusalOf(bytes: Uint8Array): ImageRefusal {
  const read = imageHeader(bytes)
  if (read.ok) throw new Error(`read as ${read.mediaType}, ${read.width} × ${read.height}`)
  return read
}

/** A deterministic stream of numbers below one, so that a sweep of mutations is the same every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

describe('crc32', () => {
  // A wrong CRC refuses every PNG a person adds, or passes a corrupt one
  // to the host. Pinned to zlib's own (Node 24.21.0's `zlib.crc32`, taken on
  // 18 October 2026), and to the bit-by-bit definition the fixtures frame
  // chunks with, for every length up to 300 bytes.
  test.each([
    ['the standard check value, of "123456789"', utf8('123456789'), 0xcbf43926],
    ['an end chunk, of "IEND"', utf8('IEND'), 0xae426082],
    ['nothing', NONE, 0],
  ])("is zlib's for %s", (_, bytes, crc) => {
    expect(crc32(bytes)).toBe(crc)
  })

  test('is the definition, bit by bit, for every length up to 300 bytes', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, index) => (index * 151 + 7) % 256)
    for (let length = 0; length <= 300; length++) expect(crc32(bytes.subarray(0, length)), `${length} bytes`).toBe(crcOf(bytes.subarray(0, length)))
    expect(crc32(bytes)).toBe(0x2494a4ca)
    // A chunk's CRC is taken of its range of the file, never of a copy of it.
    expect(crc32(bytes, 7, 200)).toBe(crcOf(bytes.subarray(7, 200)))
  })
})

describe('sniffImage', () => {
  // What a file is, judged from its first bytes and never from its name or
  // the type a browser guessed: a GIF named logo.png is no PNG, and a PNG
  // named logo.svg is one.
  test.each([
    ['a PNG', rgbPng(), 'image/png'],
    ['a JPEG', jpegOf(), 'image/jpeg'],
    ['an SVG', utf8('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'],
    ['an SVG after an XML declaration', utf8('<?xml version="1.0"?><svg/>'), 'image/svg+xml'],
    ['an SVG after white space', utf8(' \t\r\n<svg/>'), 'image/svg+xml'],
    ['an SVG after a UTF-8 byte order mark', Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('<svg/>')]), 'image/svg+xml'],
    ['a GIF', utf8('GIF89a\x01\x00\x01\x00'), undefined],
    ['text', utf8('Not an image at all.'), undefined],
    ['nothing', NONE, undefined],
    ['a PNG signature cut short', rgbPng().subarray(0, 7), undefined],
    ['a lone FF', Uint8Array.from([0xff]), undefined],
  ])('reads %s', (_, bytes, mediaType) => {
    expect(sniffImage(bytes)).toBe(mediaType)
  })

  // A file saved as UTF-16 or UTF-32 is still an SVG a person meant to add:
  // read as one, the cleaner says to save it as UTF-8, where "not a PNG, a
  // JPEG or an SVG" would send them looking for another file.
  test.each([
    ['UTF-16, big-endian', [0xfe, 0xff, 0, 0x3c]],
    ['UTF-16, little-endian', [0xff, 0xfe, 0x3c, 0]],
    ['UTF-32, big-endian', [0, 0, 0xfe, 0xff, 0, 0, 0, 0x3c]],
  ])('reads an SVG in %s by its byte order mark, which the cleaner refuses as its encoding', (_, bytes) => {
    const file = Uint8Array.from(bytes)
    expect(sniffImage(file)).toBe('image/svg+xml')
    expect(cleanSvg(file)).toMatchObject({ ok: false, code: 'encoding' })
  })
})

describe('imageHeader refuses, saying why', () => {
  // Each is a file the renderer refuses at every print, as `invalid-asset`,
  // in these words after the asset's name. Refused here, it is refused when
  // a person adds it, before a host keeps bytes no report could print.
  test.each([
    ['bytes cut off between chunks', () => rgbPng().subarray(0, 40), 'malformed', 'is cut off at byte 33'],
    ['bytes cut off inside a chunk', () => rgbPng().subarray(0, 48), 'malformed', 'is cut off at byte 33'],
    [
      'a header whose CRC is wrong',
      () => Uint8Array.from(rgbPng(), (byte, index) => (index === 29 ? byte ^ 0xff : byte)),
      'malformed',
      'has the wrong CRC on its IHDR chunk',
    ],
    [
      'image data whose CRC is wrong',
      () => Uint8Array.from(rgbPng(), (byte, index) => (index === 41 ? byte ^ 0xff : byte)),
      'malformed',
      'has the wrong CRC on its IDAT chunk',
    ],
    [
      'image data before the header',
      () =>
        pngOf([
          ['IDAT', DATA],
          ['IHDR', ihdr(8, 8)],
          ['IEND', NONE],
        ]),
      'malformed',
      'does not start with its header chunk',
    ],
    [
      'a header of the wrong length',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8).subarray(0, 12)],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'malformed',
      'has a header chunk of the wrong length',
    ],
    [
      'a colour type with a bit depth it does not allow',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8, { depth: 4 })],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'malformed',
      'has an invalid colour type and bit depth (2, 4)',
    ],
    [
      'a colour type PNG does not define',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8, { colour: 5 })],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'malformed',
      'has an invalid colour type and bit depth (5, 8)',
    ],
    [
      'an interlace method PNG does not define',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8, { interlace: 2 })],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'malformed',
      'has an unknown compression, filter or interlace method',
    ],
    [
      'no image data',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8)],
          ['IEND', NONE],
        ]),
      'malformed',
      'has no image data',
    ],
    [
      'no end chunk',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8)],
          ['IDAT', DATA],
        ]),
      'malformed',
      'is cut off at byte 51',
    ],
    ['bytes after the end chunk', () => Uint8Array.from([...rgbPng(), 0]), 'malformed', 'has bytes after its end chunk'],
    [
      'a paletted image without its palette',
      () =>
        pngOf([
          ['IHDR', ihdr(8, 8, { colour: 3 })],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'malformed',
      'is paletted and has no palette',
    ],
    [
      'a JPEG with a stray byte between segments',
      () => Uint8Array.from([0xff, 0xd8, 0x00, ...jpegOf().subarray(2)]),
      'malformed',
      'has a malformed segment at byte 2',
    ],
    // A fill byte, which the standard allows before a marker and no encoder writes, read as a marker of its own would shift every segment after it.
    [
      'a JPEG with a fill byte before a marker',
      () => Uint8Array.from([0xff, 0xd8, 0xff, ...jpegOf().subarray(2)]),
      'malformed',
      'has a malformed segment at byte 2',
    ],
    ['a JPEG segment longer than the file', () => jpegOf().subarray(0, 30), 'malformed', 'has a segment that runs past its end at byte 2'],
    [
      'a JPEG frame header too short to hold a size',
      () => Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x05, 8, 0, 8, 0xff, 0xd9]),
      'malformed',
      'has a frame header of the wrong length',
    ],
    [
      'a JPEG scan before its frame header',
      () => Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x3f, 0xff, 0xd9]),
      'malformed',
      'has image data before its frame header',
    ],
    ['a JPEG cut off in its scan', () => jpegOf({ end: false }), 'malformed', 'is cut off: it does not end with an end-of-image marker'],
    ['a JPEG of tables and no scan', () => jpegOf({ scan: false }), 'malformed', 'is cut off before its image data'],
    [
      'a JPEG with a DAC segment before its frame header',
      () => jpegOf({ components: 3, segments: frameSegment({ marker: 0xcc, components: 4 }) }),
      'malformed',
      'has a DAC segment (FFCC) before its frame header, which PDFKit would read as the frame header',
    ],
    [
      'a JPEG with a JPG segment before its frame header',
      () => jpegOf({ components: 3, segments: frameSegment({ marker: 0xc8, components: 4 }) }),
      'malformed',
      'has a JPG segment (FFC8) before its frame header, which PDFKit would read as the frame header',
    ],
    ['a JPEG of two frame headers', () => jpegOf({ components: 3, segments: frameSegment({ components: 4 }) }), 'malformed', 'has two frame headers'],
    ['a JPEG of two components', () => jpegOf({ components: 2 }), 'malformed', 'has a frame header of 2 components, where PDFKit draws 1, 3 or 4'],
    ['an SVG', () => utf8('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'not-raster', 'is neither a PNG nor a JPEG'],
    ['a GIF', () => utf8('GIF89a'), 'not-raster', 'is neither a PNG nor a JPEG'],
  ])('%s', (_, made, code, message) => {
    expect(refusalOf(made())).toEqual({ ok: false, code, message })
  })

  // A picture's size is what a person is told when it is refused, in their
  // own language, so it travels with the refusal and is not read back out
  // of an English message.
  test.each([
    [
      'a PNG of no pixels',
      () =>
        pngOf([
          ['IHDR', ihdr(0, 8)],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'no-pixels',
      0,
      8,
      'has no pixels (0 × 8)',
    ],
    [
      'a PNG wider than the limit',
      () =>
        pngOf([
          ['IHDR', ihdr(MAX_ASSET_SIDE + 1, 1)],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      'too-large',
      4097,
      1,
      'is 4097 × 1 pixels; the limit is 4096 pixels a side',
    ],
    ['a JPEG taller than the limit', () => jpegOf({ height: 5000, width: 10 }), 'too-large', 10, 5000, 'is 10 × 5000 pixels; the limit is 4096 pixels a side'],
    ['a JPEG of no pixels', () => jpegOf({ height: 0, width: 10 }), 'no-pixels', 10, 0, 'has no pixels (10 × 0)'],
  ])('%s, with its size', (_, made, code, width, height, message) => {
    expect(refusalOf(made())).toEqual({ ok: false, code, message, width, height })
  })

  // What a person adds is untrusted bytes. A reader that threw on some of
  // them -- a DataView read past the end, a length that wraps -- would
  // surface in a builder as an error rather than a refusal it can say.
  test('refuses every prefix of a PNG and a JPEG, and a sweep of corrupted bytes, without throwing', () => {
    const files = [rgbPng(), jpegOf({ exif: exifSegment(6), components: 3 })]
    const random = seeded(2033)
    for (const file of files) {
      for (let length = 0; length < file.length; length++) expect(imageHeader(file.subarray(0, length)).ok, `${length} bytes`).toBe(false)
      for (let round = 0; round < 2000; round++) {
        const corrupted = Uint8Array.from(file)
        for (let flips = 1 + Math.floor(random() * 3); flips > 0; flips--) corrupted[Math.floor(random() * corrupted.length)] = Math.floor(random() * 256)
        expect(() => imageHeader(corrupted)).not.toThrow()
      }
    }
  })
})

describe('IMAGE_REFUSAL_CODES', () => {
  // A builder says each code in a person's language. A code no bytes give,
  // or a new one with no case, would be words nobody sees or a refusal
  // nobody says. Typed over the codes: a code without a case does not compile.
  const CASES: { readonly [C in ImageRefusalCode]: () => Uint8Array } = {
    'not-raster': () => utf8('GIF89a'),
    malformed: () => rgbPng().subarray(0, 40),
    'no-pixels': () => jpegOf({ width: 0 }),
    'too-large': () => jpegOf({ width: MAX_ASSET_SIDE + 1 }),
  }

  test.each(IMAGE_REFUSAL_CODES)('%s is given, by the bytes its case makes', (code) => {
    expect(refusalOf(CASES[code]()).code).toBe(code)
  })
})

describe('imageHeader reads', () => {
  // The renderer fits an image by this size and computes the scanlines its
  // data must inflate to from the rest; a builder tells a person the size.
  test('a PNG: its size, its bits a pixel, whether it is interlaced, and its image data as it stands', () => {
    expect(imageHeader(rgbPng())).toEqual({ ok: true, mediaType: 'image/png', width: 8, height: 8, bitsPerPixel: 24, interlaced: false, data: DATA })
  })

  // A person's file can be 20 MiB of empty image data chunks, a PNG of one
  // pixel to every reading but the inflate: a view kept of each chunk held
  // 237 MB of a page's heap for 1,747,622 of them (Node 24.21.0, 19 October
  // 2026). The data is copied once, into one array, however it was split.
  test('image data split over a great many chunks, held as one array', () => {
    const empty = Array.from({ length: 10_000 }, (): readonly [string, Uint8Array] => ['IDAT', NONE])
    const read = imageHeader(pngOf([['IHDR', ihdr(8, 8)], ...empty, ['IDAT', DATA], ...empty, ['IEND', NONE]]))
    expect(read).toMatchObject({ ok: true, mediaType: 'image/png' })
    if (!read.ok || read.mediaType !== 'image/png') return
    expect(read.data).toBeInstanceOf(Uint8Array)
    expect(read.data).toEqual(DATA)
    // Image data of empty chunks alone is image data, which the renderer finds does not inflate.
    expect(
      imageHeader(
        pngOf([
          ['IHDR', ihdr(8, 8)],
          ['IDAT', NONE],
          ['IEND', NONE],
        ]),
      ),
    ).toMatchObject({ ok: true, data: NONE })
  })

  // A width and a height read the wrong way round -- a JPEG's frame header
  // gives the height first -- would squeeze every wide image into a tall box.
  test.each([
    [
      'a PNG',
      () =>
        pngOf([
          ['IHDR', ihdr(16, 8)],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      { width: 16, height: 8 },
    ],
    ['a JPEG', () => jpegOf({ width: 16, height: 8 }), { width: 16, height: 8 }],
  ])('the size of %s, 16 wide and 8 tall', (_, made, size) => {
    expect(imageHeader(made())).toMatchObject({ ok: true, ...size })
  })

  test.each([
    ['a grey PNG of 1 bit', { colour: 0, depth: 1 }, 1],
    ['a grey PNG of 16 bits', { colour: 0, depth: 16 }, 16],
    ['a grey PNG with alpha', { colour: 4, depth: 8 }, 16],
    ['an RGBA PNG of 16 bits', { colour: 6, depth: 16 }, 64],
  ])('the bits a pixel of %s', (_, kind, bitsPerPixel) => {
    expect(
      imageHeader(
        pngOf([
          ['IHDR', ihdr(8, 8, kind)],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      ),
    ).toMatchObject({ bitsPerPixel })
  })

  test('a paletted PNG with its palette, an interlaced one, and image data split over chunks, in order', () => {
    expect(
      imageHeader(
        pngOf([
          ['IHDR', ihdr(8, 8, { colour: 3 })],
          ['PLTE', Uint8Array.from([0, 0, 0, 255, 255, 255])],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      ),
    ).toMatchObject({ bitsPerPixel: 8 })
    expect(
      imageHeader(
        pngOf([
          ['IHDR', ihdr(8, 8, { interlace: 1 })],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      ),
    ).toMatchObject({ interlaced: true })
    expect(
      imageHeader(
        pngOf([
          ['IHDR', ihdr(8, 8)],
          ['IDAT', DATA.subarray(0, 2)],
          ['tEXt', utf8('Comment\0made in code')],
          ['IDAT', DATA.subarray(2)],
          ['IEND', NONE],
        ]),
      ),
    ).toMatchObject({ data: DATA })
  })

  // The largest picture an asset may be is one the renderer prints: a
  // limit applied with > where it means >= would refuse it at the door.
  test(`a picture ${MAX_ASSET_SIDE} pixels a side, the largest an asset may be`, () => {
    // A refusal of its size carries the size too, so `ok` is what tells them apart.
    expect(
      imageHeader(
        pngOf([
          ['IHDR', ihdr(MAX_ASSET_SIDE, MAX_ASSET_SIDE)],
          ['IDAT', DATA],
          ['IEND', NONE],
        ]),
      ),
    ).toMatchObject({ ok: true, width: MAX_ASSET_SIDE, height: MAX_ASSET_SIDE })
    expect(imageHeader(jpegOf({ width: MAX_ASSET_SIDE, height: MAX_ASSET_SIDE }))).toMatchObject({ ok: true, width: MAX_ASSET_SIDE, height: MAX_ASSET_SIDE })
  })

  // PDFKit draws a JPEG of one component in DeviceGray, three in DeviceRGB
  // and four in DeviceCMYK (pdfkit.js 3808-3812), which an e-invoice's
  // PDF/A refuses; the renderer reads which from here.
  test.each([1, 3, 4])('a JPEG of %i components', (components) => {
    expect(imageHeader(jpegOf({ components }))).toEqual({ ok: true, mediaType: 'image/jpeg', width: 8, height: 8, components })
  })

  // PDFKit has read the frame header by then, so a DAC segment after it is a table like any other.
  test('a JPEG with a DAC segment after its frame header', () => {
    expect(imageHeader(jpegOf({ components: 3, afterFrame: frameSegment({ marker: 0xcc, components: 4 }) }))).toMatchObject({ ok: true, components: 3 })
  })

  // PDFKit turns a JPEG by its first Exif block's orientation: 5 to 8 a
  // quarter turn, so it is shown as wide as its frame is tall; 2 to 4 keep
  // its size, 4 the last that does; one out of range, or a block it cannot
  // read, is none.
  test.each([
    [1, { width: 16, height: 8 }],
    [2, { width: 16, height: 8 }],
    [3, { width: 16, height: 8 }],
    [4, { width: 16, height: 8 }],
    [5, { width: 8, height: 16 }],
    [6, { width: 8, height: 16 }],
    [7, { width: 8, height: 16 }],
    [8, { width: 8, height: 16 }],
    [9, { width: 16, height: 8 }],
  ])('a JPEG of Exif orientation %i at the size it is shown', (orientation, size) => {
    expect(imageHeader(jpegOf({ width: 16, height: 8, exif: exifSegment(orientation) }))).toMatchObject({ ok: true, ...size })
  })

  test('a JPEG by its first Exif block alone', () => {
    expect(imageHeader(jpegOf({ width: 16, height: 8, exif: [...exifSegment(1), ...exifSegment(6)] }))).toMatchObject({ ok: true, width: 16, height: 8 })
  })

  test.each([
    ['cut short', [0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0]],
    ['in an unknown byte order', [0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x58, 0x58, 0, 42, 0, 0, 0, 8]],
    ['without the TIFF mark', [0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 41, 0, 0, 0, 8]],
    ['pointing past its end', [0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 80]],
    ['with an entry cut short', [0xff, 0xe1, 0, 18, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1]],
    [
      'without an orientation',
      [0xff, 0xe1, 0, 30, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x10, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0],
    ],
    [
      'in little-endian order, turned',
      [0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0],
    ],
    ['that is not Exif', [0xff, 0xe1, 0, 8, 0x58, 0x4d, 0x50, 0, 0, 0]],
  ])('a JPEG whose Exif block is %s', (name, exif) => {
    expect(imageHeader(jpegOf({ width: 16, height: 8, exif }))).toMatchObject({
      ok: true,
      ...(name.endsWith('turned') ? { width: 8, height: 16 } : { width: 16, height: 8 }),
    })
  })
})
