import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { annotated, annotation, expectAnnotationRefused } from './annotations-test-support.js'
import { checkInlineImages } from './inline-images.js'
import { INFLATER_VALUES, MAX_DOCUMENT_IMAGE_PIXELS, MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_PAGES, MAX_DOCUMENT_VALUES } from './limits.js'
import { AT_A_BOUND, parsed } from './parse-test-support.js'
import { expectPrintRefused, letter, pagesFile, pagesRead, printedWhole, type Body } from './pages-test-support.js'
import { refusal } from './refusals.js'
import { concat, deflatedZeros, latin1, MIB, repeated } from './test-pdf.js'

/**
 * The inline images content streams hold (ISO 32000-1 8.9.7): each found
 * where an operator stands, held to the pixels it declares as an image
 * XObject is, its data delimited exactly -- or the document refused, naming
 * the page or the annotation whose content holds it.
 */

const MAX = MAX_DOCUMENT_IMAGE_PIXELS

/** A page whose content is `content`, unfiltered, drawing with `resources`, beside `objects`. */
const drawing = (content: string | Uint8Array, resources = '<<>>', objects: Readonly<Record<number, Body>> = {}): Uint8Array =>
  pagesFile([letter('', { resources })], { 4: { dict: '', data: typeof content === 'string' ? latin1(content) : content }, ...objects })

/** An inline image of `entries` and `data`, between a `q` and a `Q`, as a content stream writes one. */
const inline = (entries: string, data: string | Uint8Array): Uint8Array =>
  concat([latin1(`q BI ${entries} ID `), typeof data === 'string' ? latin1(data) : data, latin1('\nEI Q\n')])

/** An inline image one pixel past the bound, its data ending where ASCIIHex's does. */
const PAST = `BI /W ${MAX + 1}/H 1/CS/G/BPC 8/F/AHx ID 00>\nEI`

/** The same, unfiltered, and holding neither a string's nor a hexadecimal string's end. */
const OPEN = `BI /W ${MAX + 1}/H 1/CS/G/BPC 8 ID x EI`

/** A tint transform a colour space names. */
const TINT = '<</FunctionType 2/Domain[0 1]/C0[0 0 0 0]/C1[0 0 0 1]/N 1>>'

/**
 * `bytes` behind a proxy that counts every byte read by its index, and
 * throws past `limit`, so that a lexer that reads more than it should
 * stops at the count rather than spins.
 */
function countedBytes(bytes: Uint8Array, limit: number): { readonly bytes: Uint8Array; readonly reads: () => number } {
  let reads = 0
  const proxy = new Proxy(bytes, {
    get(target, key) {
      // An index arrives as a string of digits, and a typed array reads one as its index.
      const first = typeof key === 'string' ? key.charCodeAt(0) : Number.NaN
      if (first >= 0x30 && first <= 0x39) {
        reads += 1
        if (reads > limit) throw new Error('read past the count')
        return target[key as unknown as number]
      }
      const value: unknown = Reflect.get(target, key, target)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  })
  return { bytes: proxy, reads: () => reads }
}

describe('an inline image is delimited', () => {
  // An unfiltered inline image ends where its declared rows end, whatever
  // its bytes are: "EI" inside it, followed by anything but white space, is
  // data. Ended at the first EI it holds, the image would leave the rest of
  // its data to be read as operators -- here an inline image that is none.
  // Its rows are its width times its components times its bits, rounded up
  // to a byte, as many times as its height; its colour space may be one its
  // resources name.
  test('an unfiltered inline image is delimited by its declared length, and data that holds "EI" reads', () => {
    expect(pagesRead(drawing(inline('/W 4/H 1/CS/G/BPC 8', 'EIBI')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 3/H 2/CS/RGB/BPC 4', 'EIBIEIBIEx')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/IM true/W 9/H 3', 'EIBIEx')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/IM true/W 9/H 3/BPC 1', 'EIBIEx')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/Width 2/Height 1/ColorSpace/DeviceGray/BitsPerComponent 16', 'EIBI')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 1/H 2/CS/CS0/BPC 8', 'EIBIEx'), '<</ColorSpace<</CS0/DeviceRGB>>>>'))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 1/H 1/CS[/I/RGB 1<000000FFFFFF>]/BPC 8', 'E')))).toHaveLength(1)
    const two = concat([inline('/W 2/H 1/CS/G/BPC 8', 'EB'), latin1('0 0 m 1 1 l S\n'), inline('/W 2/H 1/CS/G/BPC 8', 'BI')])
    expect(pagesRead(drawing(two))).toHaveLength(1)
    expect(pagesRead(drawing('BI /W 1/H 1/CS/G/BPC 8 ID x EI'))).toHaveLength(1)
  })

  // Flate data ends where the decoder finds its end, and its checksum's
  // four bytes after it: decoded through the document's budget, which a
  // viewer of the report decodes it from, so that a bomb inline in a
  // content is refused as one in a stream is, on the page that holds it.
  test('a Flate inline image is decoded through the budget and a bomb is refused as inflates-too-far', AT_A_BOUND, () => {
    const rows = deflate(latin1('EIBIEIBI'))
    expect(printedWhole(drawing(inline('/W 8/H 1/CS/G/BPC 8/F/Fl', rows))).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 8)
    expect(pagesRead(drawing(inline('/W 8/H 1/CS/G/BPC 8/Filter/FlateDecode', rows)))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 8/H 1/CS/G/BPC 8/F[/Fl]', rows)))).toHaveLength(1)
    expectPrintRefused(drawing(inline('/W 1/H 1/CS/G/BPC 8/F/Fl', deflatedZeros(MAX_DOCUMENT_INFLATED + 1))), 'inflates-too-far', 'inflated', 1)
    expectPrintRefused(drawing(inline('/W 1/H 1/CS/G/BPC 8/F/Fl', 'not deflate')), 'malformed', 'flate-header', 1)
    expectPrintRefused(drawing(concat([latin1('BI /W 8/H 1/CS/G/BPC 8/F/Fl ID '), rows.subarray(0, rows.length - 6)])), 'malformed', 'flate-data', 1)
    expectPrintRefused(drawing(inline('/W 8/H 1/CS/G/BPC 8/F/Fl', concat([rows, latin1('x')]))), 'malformed', 'inline-end', 1)
  })

  // An inline image a viewer decodes is held to the pixels it declares,
  // each image alone, as an image XObject is, whatever its colours: one
  // whose data ends at a marker or where its decoder finds it is never
  // counted in its colour space, which may be one the reader cannot count.
  test('an inline image past the pixels bound is refused', () => {
    const at = (entries: string): Uint8Array => drawing(inline(`${entries}/BPC 8/F/AHx`, '00>'))
    expect(pagesRead(at(`/W ${MAX}/H 1/CS/G`))).toHaveLength(1)
    expectPrintRefused(at(`/W ${MAX + 1}/H 1/CS/G`), 'inflates-too-far', 'image-pixels', 1)
    expectPrintRefused(at(`/Width 1/Height ${MAX + 1}/CS/G`), 'inflates-too-far', 'image-pixels', 1)
    expectPrintRefused(at('/W 10001/H 5000/CS/CMYK'), 'inflates-too-far', 'image-pixels', 1)
    for (const counted of ['/W 10000/H 5000/CS/CMYK', '/W 1/H 1/CS/CS9', '/W 1/H 1/CS/I', '/W 1/H 1/CS/Pattern', '/W 1/H 1']) {
      expect(pagesRead(at(counted))).toHaveLength(1)
    }
    const atTheBound = inline(`/W ${MAX}/H 1/CS/G/BPC 8/F/AHx`, '00>')
    expect(pagesRead(drawing(concat([atTheBound, atTheBound])))).toHaveLength(1)
  })

  // An unfiltered inline image's rows are as long as its width times the
  // components of its colour space times its bits: counted as one, a colour
  // image's rows would end a third of the way through its data, and the
  // rest be read as operators. Its colour space is named abbreviated, in
  // full, or by a name its content's resources hold, counted where it
  // stands there and never looked up again; one the reader cannot count is
  // refused, its data's end unknown.
  test("an unfiltered inline image's components come from its colour space: Gray 1, RGB 3, CMYK 4, Indexed 1, ICCBased by /N, DeviceN by its names, an image mask 1, and one it cannot count is refused", () => {
    const profile = (n: string): Body => ({ dict: `/N ${n}`, data: latin1('an ICC profile') })
    const named = [
      '/N3[/ICCBased 40 0 R]/N4[/ICCBased 41 0 R]/N0[/ICCBased 43 0 R]/Half[/ICCBased 44 0 R]/Bare[/ICCBased 42 0 R]',
      '/Ink[/DeviceN[/Cyan/Magenta/Spot]/DeviceCMYK 42 0 R]/Spot[/Separation/Spot/DeviceCMYK 42 0 R]',
      '/Unnamed[/DeviceN/Spot/DeviceCMYK 42 0 R]/None[/DeviceN[]/DeviceCMYK 42 0 R]',
      '/Gray[/CalGray<</WhitePoint[1 1 1]>>]/Cal[/CalRGB<</WhitePoint[1 1 1]>>]/Lab[/Lab<</WhitePoint[1 1 1]>>]',
      '/Ref 45 0 R/Self/Self',
    ].join('')
    const objects = { 40: profile('3'), 41: profile('4'), 42: TINT, 43: profile('0'), 44: profile('2.5'), 45: '[/ICCBased 40 0 R]' }
    const one = (space: string, bytes: number): Uint8Array => drawing(inline(`/W 1/H 1${space}`, 'x'.repeat(bytes)), `<</ColorSpace<<${named}>>>>`, objects)
    for (const [space, components] of [
      ['/CS/G/BPC 8', 1],
      ['/ColorSpace/DeviceGray/BPC 8', 1],
      ['/CS/RGB/BPC 8', 3],
      ['/CS/DeviceRGB/BPC 8', 3],
      ['/CS/CMYK/BPC 8', 4],
      ['/CS/DeviceCMYK/BPC 8', 4],
      ['/CS[/RGB]/BPC 8', 3],
      ['/CS[/I/RGB 1<000000FFFFFF>]/BPC 8', 1],
      ['/CS[/Indexed/DeviceRGB 1<000000FFFFFF>]/BPC 8', 1],
      ['/CS/N3/BPC 8', 3],
      ['/CS/N4/BPC 8', 4],
      ['/CS/Ref/BPC 8', 3],
      ['/CS/Ink/BPC 8', 3],
      ['/CS/Spot/BPC 8', 1],
      ['/CS/Gray/BPC 8', 1],
      ['/CS/Cal/BPC 8', 3],
      ['/CS/Lab/BPC 8', 3],
      ['/IM true', 1],
      ['/IM true/CS/CMYK', 1],
    ] as const) {
      expect(pagesRead(one(space, components))).toHaveLength(1)
      expectPrintRefused(one(space, components + 1), 'malformed', 'inline-end', 1)
    }
    for (const uncounted of [
      '/BPC 8',
      '/IM false/BPC 8',
      '/CS/Pattern/BPC 8',
      '/CS[/Pattern/DeviceRGB]/BPC 8',
      '/CS/CS9/BPC 8',
      '/CS/I/BPC 8',
      '/CS/Self/BPC 8',
      '/CS/N0/BPC 8',
      '/CS/Half/BPC 8',
      '/CS/Bare/BPC 8',
      '/CS 5/BPC 8',
      '/CS[]/BPC 8',
      '/CS[5]/BPC 8',
      '/CS[/Unknown]/BPC 8',
      '/CS/Unnamed/BPC 8',
      '/CS/None/BPC 8',
      '/CS/G/ColorSpace/DeviceRGB/BPC 8',
      '/IM true/ImageMask true',
    ]) {
      expectPrintRefused(one(uncounted, 1), 'malformed', 'image-space', 1)
    }
  })

  // PDF.js does not end unfiltered or Flate data where its rows or its
  // decoder say: it searches for "EI" and white space, and ends the image
  // at the first it finds, reading the rest of its data as operators. Data
  // that holds them -- inside it, or as its last two bytes, before the
  // white space after it -- is refused, so that an image hidden in another's
  // data, past every bound, never prints in a viewer the reader did not
  // read it for. "EI" followed by anything else is data to both alike.
  test('an inline image whose data a viewer could end sooner is refused', () => {
    const hidden = 'EI q BI /W 99999/H 99999/CS/RGB/BPC 8 ID x EI Q'
    expectPrintRefused(drawing(inline(`/W ${hidden.length}/H 1/CS/G/BPC 8`, hidden)), 'malformed', 'inline-end', 1)
    const stored = deflate(latin1(hidden), { level: 0 })
    expectPrintRefused(drawing(inline(`/W ${hidden.length}/H 1/CS/G/BPC 8/F/Fl`, stored)), 'malformed', 'inline-end', 1)
    for (const white of [' ', '\n', '\r', '\t', '\f', '\0']) {
      expectPrintRefused(drawing(inline('/W 4/H 1/CS/G/BPC 8', `EI${white}x`)), 'malformed', 'inline-end', 1)
    }
    expectPrintRefused(drawing(inline('/W 4/H 1/CS/G/BPC 8', 'abEI')), 'malformed', 'inline-end', 1)
    expect(pagesRead(drawing(inline('/W 6/H 1/CS/G/BPC 8', 'EIEIxE')))).toHaveLength(1)
    expect(pagesRead(drawing(inline(`/W 1/H 1/CS/G/BPC 8/F/AHx`, `${hidden}>`)))).toHaveLength(1)
  })

  // What a viewer decodes DCT, fax, run-length or LZW data with finds the
  // data's end, and the reader decodes none of them: an inline image that
  // starts in one could not be delimited, and the content after it could
  // not be read. ASCIIHex and ASCII85 end at their markers, after which an
  // image's own filter is the viewer's, as it is on an image XObject; a
  // filter the reader passes on nowhere is refused there too.
  test('a DCT inline image is refused as one the reader cannot delimit', () => {
    for (const filter of ['/DCT', '/DCTDecode', '[/DCT]', '/CCF', '/RL', '/LZW', '/Foo', '[/DCT/AHx]']) {
      expectPrintRefused(drawing(inline(`/W 1/H 1/CS/G/BPC 8/F${filter}`, '00>')), 'unsupported-filter', 'inline-filter', 1)
    }
    expect(pagesRead(drawing(inline('/W 1/H 1/CS/G/BPC 8/F[/AHx/DCT]', 'EI BI FFD8>')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 1/H 1/CS/G/BPC 8/F/ASCIIHexDecode', '00>')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 1/H 1/CS/G/BPC 8/F[/A85/Fl]', 'EI BI z~>')))).toHaveLength(1)
    expect(pagesRead(drawing(inline('/W 1/H 1/CS/G/BPC 8/Filter/ASCII85Decode', 'z~>')))).toHaveLength(1)
    expectPrintRefused(drawing(inline('/W 1/H 1/CS/G/BPC 8/F[/AHx/LZW]', '00>')), 'unsupported-filter', 'filter', 1)
    expectPrintRefused(drawing(inline('/W 1/H 1/CS/G/BPC 8/F[/AHx/DCT/Fl]', '00>')), 'unsupported-filter', 'filter', 1)
  })
})

describe('an inline image is found where an operator stands', () => {
  // A string, a comment, a hexadecimal string and a name are no place for
  // an operator: "BI" in one is text, and read as an inline image it would
  // refuse a document for what its text says. Escaped and nested
  // parentheses do not end a string; an end of line ends a comment.
  test('"BI" inside a string or a comment is no inline image', () => {
    expectPrintRefused(drawing(PAST), 'inflates-too-far', 'image-pixels', 1)
    expectPrintRefused(drawing(OPEN), 'inflates-too-far', 'image-pixels', 1)
    for (const content of [
      `(${PAST}) Tj`,
      `(an open string ${OPEN}`,
      `<4142 ${OPEN}`,
      `(a \\) ${PAST}) Tj`,
      `(a (b) ${PAST}) Tj`,
      `(a \\\\) Tj (${PAST}) Tj`,
      `% ${PAST.replace('\n', ' ')}\n0 0 m`,
      '<4249> Tj <BI> Tj',
      '/BI /ABI',
    ]) {
      expect(pagesRead(drawing(content))).toHaveLength(1)
    }
    expectPrintRefused(drawing(`(a) Tj % a comment\r${PAST}`), 'inflates-too-far', 'image-pixels', 1)
    expectPrintRefused(drawing(`[(a)] TJ <<>> BDC <41> Tj ${PAST}`), 'inflates-too-far', 'image-pixels', 1)
  })

  // PDF.js 6.4.299 splits a run of regular bytes only after an operator it
  // knows -- "qBI" is q and BI, but "ABI", or "EBI" after a number written
  // "1E", is one operator and no inline image (Lexer.getObj) -- and drops a
  // BI that stands where a dictionary's key does (Parser.getObj). Read as
  // an inline image where PDF.js reads none, its dictionary and its data
  // would be skipped by the reader and read by PDF.js as operators, an
  // image among them never held. A BI glued to what stands before it, or
  // inside a dictionary, is refused; after one closes, and inside an array,
  // where PDF.js reads one, it is an inline image.
  test('an inline image glued to what stands before it, or inside a dictionary, is refused', () => {
    for (const content of [
      `q${PAST}`,
      `1${PAST}`,
      `A${PAST}`,
      `1E${PAST}`,
      `BBI${PAST.slice(2)}`,
      `/Span<</K ${PAST}>> BDC`,
      `<</K[${PAST}]>> BDC`,
      `>> /Span<</K ${PAST}>> BDC`,
    ]) {
      expectPrintRefused(drawing(content), 'malformed', 'inline-place', 1)
    }
    expectPrintRefused(drawing(`[${PAST}] TJ`), 'inflates-too-far', 'image-pixels', 1)
    expectPrintRefused(drawing(`/Span<</K 1>> BDC ${PAST}`), 'inflates-too-far', 'image-pixels', 1)
    expect(pagesRead(drawing('/Span<</K<<>>>> BDC BI/IM true/W 1/H 1 ID \0\nEI EMC'))).toHaveLength(1)
  })
})

describe('an inline image ends where a viewer ends it', () => {
  // PDF.js 6.4.299 ends unfiltered and Flate data where it finds "EI" and
  // SPACE, LF or CR, and accepts it only where the 15 bytes after look like
  // text and, within 75, an operator it knows follows the operands it takes
  // (findDefaultInlineStreamEnd, pdf.worker.mjs:16875); anywhere else it
  // searches on, and takes what the reader read as operators for image
  // data. After ASCIIHex and ASCII85 it swallows the byte after EI whatever
  // it is (inlineStreamSkipEI, :17095). An EI PDF.js would not end the
  // image at is refused; a real one, followed by Q, reads.
  test('an inline image ends only where PDF.js ends it', () => {
    const unfiltered = (after: string): string => `q 10 0 0 10 0 0 cm BI /W 2/H 2/CS/G/BPC 8 ID \0\xff\0\xff\nEI${after}`
    for (const after of [
      '',
      '\n',
      ' Q',
      '\nQ\n',
      '\r1 0 0 1 0 0 cm Q',
      ' (a) Tj',
      ' /F1 12 Tf',
      ' 0.5 g Q',
      ' 1 2 Q q',
      ' Q \0 q',
      ' BI/IM true/W 1/H 1 ID \0\nEI',
      ' <41> Tj',
      ' (a\\)) Tj',
      ' %c\nQ',
      ' null Tj',
      ' /GS0 gs',
      ' 0.5 sc',
      ' (a(b)c) Tj',
    ]) {
      expect(pagesRead(drawing(unfiltered(after)))).toHaveLength(1)
    }
    for (const after of [
      '\tQ',
      '\fQ',
      '\0Q',
      '(a) Tj',
      '%c\nQ',
      '<41> Tj',
      ' \tQ',
      ' Q\x80',
      ' Q\0\0',
      ' [(a)] TJ',
      ' foo Q',
      ' 1 2 Q',
      ` ${'1 '.repeat(40)}Q`,
      ` ${' '.repeat(80)}Q`,
      ' (a',
      ' <41',
      ' true Q',
      ' 1 2 3 4 5 sc',
      ' [ Tj',
      // Past the 15 bytes PDF.js tests for text, a byte it would not admit, before the operator it accepts: refused, as the ruling reads its test.
      ' (aaaaaaaaaaaaaaaaaaaa\x80) Tj',
    ]) {
      expectPrintRefused(drawing(unfiltered(after)), 'malformed', 'inline-end', 1)
    }
    const flate = (after: string): Uint8Array => concat([latin1('BI /W 2/H 1/CS/G/BPC 8/F/Fl ID '), deflate(latin1('ab')), latin1(`\nEI${after}`)])
    expect(pagesRead(drawing(flate(' Q')))).toHaveLength(1)
    expectPrintRefused(drawing(flate(' [(a)] TJ')), 'malformed', 'inline-end', 1)
    for (const marked of ['/F/AHx ID 00>', '/F/A85 ID z~>']) {
      for (const after of ['', ' (a) Tj', '\n[(a)] TJ', '\r%c']) {
        expect(pagesRead(drawing(`BI /W 1/H 1/CS/G/BPC 8${marked}\nEI${after}`))).toHaveLength(1)
      }
      for (const after of ['(a) Tj', '\t(a) Tj', '<41> Tj', '%c']) {
        expectPrintRefused(drawing(`BI /W 1/H 1/CS/G/BPC 8${marked}\nEI${after}`), 'malformed', 'inline-end', 1)
      }
    }
  })
})

describe('an inline image holds nothing but itself', () => {
  // PDF.js resolves every reference an inline image's dictionary holds: its
  // /SMask and /Mask as images of their own size, an ICC profile, a palette
  // or a tint function under /CS (PDFImage.buildImage, pdf.worker.mjs:39072)
  // -- and no closure holds what it names, so a soft mask of any size would
  // pass the bound, and a renderer would write a reference to an object it
  // never copied. A content's operands are direct; a reference in one is
  // refused, however deep it stands.
  test('an inline image whose dictionary holds a reference is refused', () => {
    for (const entries of ['/CS/G/SMask 30 0 R', '/CS 31 0 R', '/CS[/ICCBased 32 0 R]', '/CS/G/DP<</JBIG2Globals 30 0 R>>', '/CS/G/D[0 30 0 R]']) {
      expectPrintRefused(drawing(inline(`/W 1/H 1/BPC 8${entries}`, 'x')), 'malformed', 'inline-reference', 1)
    }
    expect(pagesRead(drawing(inline('/W 1/H 1/BPC 8/CS/G/D[0 30 0]', 'x')))).toHaveLength(1)
  })
})

describe('an inline image is refused', () => {
  // Data that runs past its declared rows, or stops short of them, ends
  // somewhere other than where the image says: the reader and a viewer
  // would read the content after it differently. So does data whose
  // ASCIIHex or ASCII85 marker is missing, Flate data followed by more
  // than white space, an EI with no white space before it -- which a
  // viewer that searches for one does not find -- and an EI that is not a
  // token of its own.
  test('an inline image without EI where its data ends is malformed', () => {
    for (const content of [
      inline('/W 4/H 1/CS/G/BPC 8', 'abcde'),
      inline('/W 6/H 1/CS/G/BPC 8', 'abcd'),
      latin1('BI /W 4/H 1/CS/G/BPC 8 ID abcd'),
      latin1('BI /W 4/H 1/CS/G/BPC 8 ID abcd EIQ'),
      latin1('BI /W 4/H 1/CS/G/BPC 8 ID abcd XY Q'),
      latin1('BI /W 4/H 1/CS/G/BPC 8 ID abcdEI'),
      latin1(`BI /W ${MAX}/H 1/CS/G/BPC 8 ID abcd\nEI`),
      inline('/W 1/H 1/CS/G/BPC 8/F/AHx', '00'),
      inline('/W 1/H 1/CS/G/BPC 8/F/A85', 'z~'),
      inline('/W 1/H 1/CS/G/BPC 8/F/A85', 'z~ '),
      inline('/W 1/H 1/CS/G/BPC 8/F/A85', 'z~ >'),
      inline('/W 1/H 1/CS/G/BPC 8/F/A85', 'zz'),
    ]) {
      expectPrintRefused(drawing(content), 'malformed', 'inline-end', 1)
    }
    // A marker that is missing ends the data nowhere, never before it: taken
    // as the content's start, the lexer would go back to read the same image
    // again for ever. Counted, so that such a lexer stops rather than spins.
    const document = parsed(pagesFile([letter()]))
    for (const [filter, data] of [
      ['AHx', '00'],
      ['A85', 'zz'],
    ]) {
      const content = latin1(` EI BI /W 1/H 1/CS/G/BPC 8/F/${filter} ID ${data}`)
      const counted = countedBytes(content, 10 * content.length)
      expect(checkInlineImages(document, counted.bytes, { entries: new Map() }, document.budget)).toEqual(refusal('inline-end'))
    }
    const counted = countedBytes(latin1('> EI BI /W 1/H 1/CS/G/BPC 8/F/A85 ID zz'), 400)
    expect(checkInlineImages(document, counted.bytes, { entries: new Map() }, document.budget)).toEqual(refusal('inline-end'))
    // Rows that run past the content end nowhere in it, and are refused
    // before a byte past it is looked at, however many rows they declare.
    const past = countedBytes(latin1(`BI /W ${MAX}/H 1/CS/G/BPC 8 ID abcd\nEI`), 400)
    expect(checkInlineImages(document, past.bytes, { entries: new Map() }, document.budget)).toEqual(refusal('inline-end'))
  })

  // An inline image's dictionary runs from BI to ID in pairs of a name and
  // a value, ID followed by the one white-space byte before its data: one
  // that is not, gives an entry twice, or gives no bits a sample where its
  // rows depend on them, is no image a viewer reads as the reader does.
  test('an inline image whose dictionary is not written as one is malformed', () => {
    for (const written of [
      'BI /W 1/H 1/CS/G/BPC 8',
      'BI /W 1/H 1/CS/G/BPC 8 IDx\nEI',
      'BI W 1/H 1/CS/G/BPC 8 ID x\nEI',
      'BI 5 5/W 1/H 1/CS/G/BPC 8 ID x\nEI',
      'BI /W 1/H 1/CS/G/BPC 8/D[0 1 ID x\nEI',
      'BI /W 1/W 1/H 1/CS/G/BPC 8 ID x\nEI',
      'BI /W 1/H 1/CS/G ID x\nEI',
      'BI /W 1/H 1/CS/G/BPC 3 ID x\nEI',
      'BI /IM true/W 1/H 1/BPC 8 ID x\nEI',
      'BI /W 1/H 1/CS/G/BPC 8/F 5 ID x\nEI',
      'BI /W 1/H 1/CS/G/BPC 8/F[5] ID x\nEI',
    ]) {
      expectPrintRefused(drawing(written), 'malformed', 'inline-image', 1)
    }
    expect(pagesRead(drawing('BI /W 1/H 1/CS/G/BPC 8/D null ID x\nEI'))).toHaveLength(1)
    expectPrintRefused(drawing('BI /W 1/Width 1/H 1/CS/G/BPC 8 ID x\nEI'), 'malformed', 'image-size', 1)
    expectPrintRefused(drawing('BI /H 1/CS/G/BPC 8 ID x\nEI'), 'malformed', 'image-size', 1)
  })
})

describe('every content an inline image may stand in is read for one', () => {
  // A viewer draws an inline image wherever content stands: an
  // annotation's appearance, a form, its /Subtype written by reference or
  // not, a tiling pattern's cell, a Type 3 glyph, a soft mask's group,
  // which PDF.js draws whatever its /Subtype says -- and a glyph the
  // closure reaches by another key first, or through a map it reads as a
  // name map first, which is a glyph all the same. Each is held as a page's
  // content is, a refusal in an appearance naming its annotation and its
  // page, and an appearance's colour spaces counted in its own resources.
  test("an inline image in an appearance's form, a form XObject, a pattern and a Type 3 glyph is held as a page's is", () => {
    const past = latin1(PAST)
    const within = latin1('BI /W 1/H 1/CS/G/BPC 8 ID x\nEI')
    const appeared = (data: Uint8Array, entries = ''): Uint8Array =>
      annotated([annotation('Square', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')], {
        objects: { 40: { dict: `/Type/XObject/Subtype/Form/BBox[0 0 10 10]${entries}`, data } },
      })
    expectAnnotationRefused(appeared(past), 'inflates-too-far', 'image-pixels', 1, { index: 1, subtype: 'Square' })
    expect(pagesRead(appeared(within))[0]?.appearances).toHaveLength(1)
    const named = latin1('BI /W 1/H 1/CS/CS0/BPC 8 ID xyz\nEI')
    expect(pagesRead(appeared(named, '/Resources<</ColorSpace<</CS0/DeviceRGB>>>>'))[0]?.appearances).toHaveLength(1)
    expectAnnotationRefused(appeared(named), 'malformed', 'image-space', 1, { index: 1, subtype: 'Square' })
    const held = (resources: string, objects: (data: Uint8Array) => Readonly<Record<number, Body>>): void => {
      expectPrintRefused(pagesFile([letter('', { resources })], objects(past)), 'inflates-too-far', 'image-pixels')
      expect(printedWhole(pagesFile([letter('', { resources })], objects(within))).closure.size).toBeGreaterThan(0)
    }
    held('<</XObject<</Fm0 30 0 R>>>>', (data) => ({ 30: { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]', data } }))
    held('<</XObject<</Fm0 30 0 R>>>>', (data) => ({ 30: { dict: '/Type/XObject/Subtype 31 0 R/BBox[0 0 10 10]', data }, 31: '/Form' }))
    held('<</Pattern<</P0 30 0 R>>>>', (data) => ({ 30: { dict: '/PatternType 1/PaintType 1/TilingType 1/BBox[0 0 10 10]/XStep 10/YStep 10', data } }))
    held('<</Pattern<</P0 30 0 R>>>>', (data) => ({
      30: { dict: '/PatternType 31 0 R/PaintType 1/TilingType 1/BBox[0 0 10 10]/XStep 10/YStep 10', data },
      31: '1',
    }))
    const type3 = (extra: string): string =>
      `<</Type/Font/Subtype/Type3/FontBBox[0 0 1 1]/FontMatrix[0.001 0 0 0.001 0 0]/CharProcs<</a 40 0 R>>${extra}/FirstChar 97/LastChar 97/Widths[1]>>`
    held('<</Font<</F1 20 0 R>>>>', (data) => ({ 20: type3(''), 40: { dict: '', data } }))
    held('<</Font<</F1 20 0 R>>>>', (data) => ({ 20: type3('/Probe 40 0 R'), 40: { dict: '', data } }))
    held('<</ExtGState<</GS0<</SMask<</S/Luminosity/G 30 0 R>>>>>>>>', (data) => ({ 30: { dict: '/Group<</S/Transparency>>/BBox[0 0 10 10]', data } }))
    held('<</Font<</F1 20 0 R>>/XObject 50 0 R>>', (data) => ({
      20: type3('').replace('/CharProcs<</a 40 0 R>>', '/CharProcs 50 0 R'),
      40: { dict: '', data },
      50: '<</a 40 0 R>>',
    }))
  })

  // A content the closure reaches as content more than once -- a glyph two
  // Type 3 fonts share -- is one content: read again for the second font,
  // its Flate inline image would be decoded and charged twice for one the
  // report carries once.
  test('a content the closure reaches twice is read once', () => {
    const glyph = concat([latin1('BI /W 2/H 1/CS/G/BPC 8/F/Fl ID '), deflate(latin1('ab')), latin1('\nEI')])
    const font = '<</Type/Font/Subtype/Type3/FontBBox[0 0 1 1]/FontMatrix[0.001 0 0 0.001 0 0]/CharProcs<</a 40 0 R>>/FirstChar 97/LastChar 97/Widths[1]>>'
    const file = pagesFile([letter('', { resources: '<</Font<</F1 20 0 R/F2 21 0 R>>>>' })], { 20: font, 21: font, 40: { dict: '', data: glyph } })
    expect(printedWhole(file).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 2)
    // A glyph read as content is decoded: met again as data -- under a key the closure reaches it by after its
    // glyphs, here -- it is not decoded again.
    const procedure = '1000 0 d0 0 0 m 1 1 l S'
    const probed = font.replace('/FontBBox', '/Probe 40 0 R/FontBBox')
    const twice = pagesFile([letter('', { resources: '<</Font<</F1 20 0 R>>>>' })], {
      20: probed,
      40: { dict: '/Filter/FlateDecode', data: deflate(latin1(procedure)) },
    })
    expect(printedWhole(twice).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - procedure.length)
  })

  // A viewer reads a content's inline images from what its filters decode
  // to: read from its encoded bytes, a Flate content would hide every
  // inline image it holds. A page's single stream is read decoded, and
  // kept as encoded; a page's several streams are read joined, an inline
  // image split between two of them found whole; an appearance's form and
  // a form XObject are read decoded.
  test('a content is read for inline images as a viewer decodes it, kept or joined', () => {
    const past = deflate(latin1(PAST))
    expectPrintRefused(pagesFile([letter()], { 4: { dict: '/Filter/FlateDecode', data: past } }), 'inflates-too-far', 'image-pixels', 1)
    const [head, tail] = PAST.split(' ID ') as [string, string]
    const split = pagesFile([letter().replace('/Contents 4 0 R', '/Contents[4 0 R 5 0 R]')], {
      4: { dict: '', data: latin1(head) },
      5: { dict: '', data: latin1(`ID ${tail}`) },
    })
    expectPrintRefused(split, 'inflates-too-far', 'image-pixels', 1)
    const appeared = annotated([annotation('Square', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')], {
      objects: { 40: { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]/Filter/FlateDecode', data: past } },
    })
    expectAnnotationRefused(appeared, 'inflates-too-far', 'image-pixels', 1, { index: 1, subtype: 'Square' })
    const formed = pagesFile([letter('', { resources: '<</XObject<</Fm0 30 0 R>>>>' })], {
      30: { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]/Filter/FlateDecode', data: past },
    })
    expectPrintRefused(formed, 'inflates-too-far', 'image-pixels')
  })

  // A form draws its inline images with its own resources (ISO 32000-1
  // 7.8.3): a colour space they name is counted there, and one only the
  // page that draws the form names is a colour space the reader cannot
  // count, since another page may draw the same form with another.
  test('a form counts the colour spaces of its inline images in its own resources', () => {
    const formed = (own: string): Uint8Array =>
      pagesFile([letter('', { resources: '<</ColorSpace<</CS0/DeviceGray>>/XObject<</Fm0 30 0 R>>>>' })], {
        30: { dict: `/Type/XObject/Subtype/Form/BBox[0 0 10 10]${own}`, data: latin1('BI /W 1/H 1/CS/CS0/BPC 8 ID xyz\nEI') },
      })
    expect(printedWhole(formed('/Resources<</ColorSpace<</CS0/DeviceRGB>>>>')).closure.has(30)).toBe(true)
    expectPrintRefused(formed(''), 'malformed', 'image-space')
  })

  // Pages that share a content draw the same inline images: read again for
  // each, a Flate image would be decoded and charged again for what the
  // reader read once, whatever resources each page draws with. Only an
  // unfiltered image's colour space, named by name, depends on them: it is
  // counted again in each page's resources, and refused on the page whose
  // resources make its rows longer than its data.
  test('a content the pages share is read once, its colour-space names counted for each resources it is drawn with', () => {
    const content = concat([latin1('BI /W 2/H 1/F/Fl ID '), deflate(latin1('ab')), latin1('\nEI BI /W 2/H 1/CS/CS0/BPC 8 ID ab\nEI')])
    const two = (second: string): Uint8Array =>
      pagesFile([letter('', { resources: '5 0 R' }), letter('', { resources: second })], {
        4: { dict: '', data: content },
        5: '<</ColorSpace<</CS0/DeviceGray>>>>',
        6: '<</ColorSpace<</CS0/DeviceGray>>>>',
        7: '<</ColorSpace<</CS0/DeviceRGB>>>>',
      })
    expect(printedWhole(two('5 0 R')).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 2 - content.length)
    expect(printedWhole(two('6 0 R')).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 2 - content.length)
    expectPrintRefused(two('7 0 R'), 'malformed', 'inline-end', 2)
  })
})

describe('the inline images of a document are bounded together', () => {
  // Each value of an inline image's dictionary is read by the grammar at
  // the cost a value of the file is: counted for each content alone, a
  // document's pages could hold a few hundred thousand inline images each
  // and keep the reader for seconds. Every inline image's dictionary in a
  // document is counted together against MAX_DOCUMENT_VALUES -- nine
  // values each here, a key counted as a value and as a name -- and the
  // page that passes it is refused.
  test('the inline images of every content of a document are counted together against MAX_DOCUMENT_VALUES', AT_A_BOUND, () => {
    const images: Body = { dict: '', data: repeated('BI/IM true/W 1/H 1 ID \0 EI ', Math.floor(MAX_DOCUMENT_VALUES / 9 / 2) + 1) }
    expect(pagesRead(pagesFile([letter()], { 4: images }))).toHaveLength(1)
    const two = pagesFile([letter(), letter().replace('/Contents 4 0 R', '/Contents 5 0 R')], { 4: images, 5: images })
    expectPrintRefused(two, 'too-many-objects', 'values', 2)
  })

  // An inline image compressed by Flate is inflated by a pako inflater of
  // its own, which costs what its dictionary's values cost several times
  // over: 117,647 of them, as many as the values bound let their
  // dictionaries count, took 1.3 s. Each is counted for its inflater too,
  // INFLATER_VALUES more, before it is inflated: here seventeen values a
  // dictionary and the inflater's, the images at the bound read and one
  // more refused, where as many images unfiltered read.
  test('a Flate inline image is counted for its inflater against MAX_DOCUMENT_VALUES too', AT_A_BOUND, () => {
    const flate = concat([latin1('q BI /W 1/H 1/CS/G/BPC 8/F/Fl ID '), deflate(latin1('x')), latin1('\nEI Q\n')])
    const plain = latin1('q BI /W 1/H 1/CS/G/BPC 8 ID x\nEI Q\n')
    const atBound = Math.floor(MAX_DOCUMENT_VALUES / (17 + INFLATER_VALUES))
    expect(pagesRead(drawing(repeated(flate, atBound)))).toHaveLength(1)
    expectPrintRefused(drawing(repeated(flate, atBound + 1)), 'too-many-objects', 'values', 1)
    expect(pagesRead(drawing(repeated(plain, atBound + 1)))).toHaveLength(1)
  })
})

describe('the colour-space names a shared content counts are bounded', () => {
  // A content the pages share is lexed once, and only the colour-space
  // names its unfiltered inline images count are counted again for each
  // page's resources -- each a value read, against MAX_DOCUMENT_VALUES, so
  // that a thousand pages, each with its own resources, cannot have a
  // content's thousands of names counted a thousand times unbounded. Pages
  // that share the resources too, as a template's do, count them once.
  test('the colour-space names counted for each page are counted against MAX_DOCUMENT_VALUES, and once for shared resources', AT_A_BOUND, () => {
    const names = 2_100
    const images = Array.from({ length: names }, (_, i) => `BI/W 1/H 1/CS/C${i}/BPC 8 ID x\nEI\n`).join('')
    const spaces = `<<${Array.from({ length: names }, (_, i) => `/C${i}/DeviceGray`).join('')}>>`
    const file = (resources: (page: number) => string): Uint8Array =>
      pagesFile(
        Array.from({ length: MAX_DOCUMENT_PAGES }, (_, i) => letter('', { resources: resources(i) })),
        { 4: { dict: '/Filter/FlateDecode', data: deflate(latin1(images)) }, 5: `<</ColorSpace 6 0 R>>`, 6: spaces },
      )
    expect(pagesRead(file(() => '5 0 R'))).toHaveLength(MAX_DOCUMENT_PAGES)
    // Thirteen values each image's dictionary reads on the first page, a key counted as a value and as a name; one a name on each page after.
    const page = Math.floor((MAX_DOCUMENT_VALUES - 13 * names) / names) + 2
    expectPrintRefused(
      file((i) => `<</ColorSpace 6 0 R/Probe ${i}>>`),
      'too-many-objects',
      'values',
      page,
    )
  })
})

describe('the lexer', () => {
  // A content stream is as large as the budget, and each byte of it is
  // read a bounded number of times however it is written: a lexer that
  // went back to look again -- for the end of every string, or from every
  // inline image -- would take quadratic time over a mebibyte of "(BI)"
  // or a hundred thousand inline images. Held to a count of bytes read,
  // never a time, and stopped at it rather than spinning. The lexer read
  // the strings 1.25 times a byte and the images, their dictionaries read
  // by the grammar, 3.8 times, on 4 November 2026; the counts allow 2 and
  // 5. Each proxied read costs about 0.65 microseconds, so the images take
  // about five seconds, which is the proxy's and not the lexer's.
  test('the lexer is linear', AT_A_BOUND, () => {
    const document = parsed(pagesFile([letter()]))
    const none = { entries: new Map() }
    const strings = countedBytes(repeated('(BI)', MIB / 4), 2 * MIB)
    expect(checkInlineImages(document, strings.bytes, none, document.budget)).toBeUndefined()
    expect(strings.reads()).toBeLessThanOrEqual(2 * MIB)
    const content = repeated('BI/IM true/W 1/H 1 ID \0 EI ', 100_000)
    const images = countedBytes(content, 5 * content.length)
    expect(checkInlineImages(document, images.bytes, none, document.budget)).toBeUndefined()
    expect(images.reads()).toBeLessThanOrEqual(5 * content.length)
  })

  // Every page's content and every form's is read for inline images, and
  // a bomb of zeros that inflates within the budget is as long as the
  // budget: read byte by byte, it cost the reader a pass over every byte
  // of it, where the platform's own search finds that it holds no "BI" and
  // no inline image. Only a "B" is read by its index, to see what follows.
  test('a content that holds no "BI" is not read byte by byte', () => {
    const document = parsed(pagesFile([letter()]))
    const none = { entries: new Map() }
    const zeros = countedBytes(new Uint8Array(MIB), 0)
    expect(checkInlineImages(document, zeros.bytes, none, document.budget)).toBeUndefined()
    expect(zeros.reads()).toBe(0)
    const text = countedBytes(repeated('BT /F1 12 Tf (ABBA) Tj ET\n', 1_000), 3_000)
    expect(checkInlineImages(document, text.bytes, none, document.budget)).toBeUndefined()
    expect(text.reads()).toBe(3_000)
  })
})
