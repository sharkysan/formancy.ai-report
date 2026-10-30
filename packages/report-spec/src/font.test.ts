import { describe, expect, test } from 'vitest'
import { readFont } from './font.js'
import { characterMap } from './font-cmap.js'
import {
  caught,
  FONT_EMBEDDING_REFUSALS,
  FONT_FORMATS,
  FONT_REFUSAL_CODES,
  refuse,
  type FontEmbeddingRefusal,
  type FontFormat,
  type FontRefusal,
  type FontRefusalCode,
} from './font-refusal.js'
import { embeddingOf } from './font-tables.js'
import {
  AB,
  cmap,
  composite,
  crowded,
  font,
  format14,
  format4,
  head,
  hhea,
  maxp,
  name,
  NAMES,
  NO_CONTOURS,
  os2,
  patched,
  post,
  seeded,
  sfnt,
  square,
  tableAt,
  tagged,
  u16,
  u32,
  vhea,
  windows,
} from './font-test-support.js'
import { MAX_FONT_BYTES, MAX_FONT_COMPONENTS, MAX_FONT_GLYPH_WORK, MAX_FONT_LINE, MAX_FONT_OUTLINE_WORK, MAX_FONT_POINTS, MIN_FONT_LINE } from './limits.js'

/**
 * report-spec's one reader of a font's bytes (0040), which the renderer
 * reads its faces' character maps through, and a builder and a host's
 * approval will read a host's font through, so that a font one of them
 * accepts is never one another refuses. Every font here is made in code
 * (`font-test-support.ts`); the renderer's tests read Roboto and Liberation
 * Sans through the same reader, from their files.
 */

/** The refusal `readFont` gives `bytes`, failing the test when it accepts them. */
function refusalOf(bytes: Uint8Array): FontRefusal {
  const read = readFont(bytes)
  if (read.ok) throw new Error(`read as ${read.names.postScriptName}`)
  return read
}

/** `text` as a pattern that matches it and nothing else, so a refusal's words are compared as words. */
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('readFont reads', () => {
  // What a builder tells an approver, and what the renderer lays a line out
  // by: a name read from the wrong record, or a metric from the wrong
  // offset, would show one font and print another's line.
  test('a TrueType font: its names, its embedding, its metrics, its style, its glyphs and the characters it maps', () => {
    expect(readFont(font())).toEqual({
      ok: true,
      names: {
        family: 'Probe Sans',
        subfamily: 'Regular',
        postScriptName: 'ProbeSans-Regular',
        postScriptNames: ['ProbeSans-Regular'],
        fullName: 'Probe Sans Regular',
        version: 'Version 1.000',
        copyright: 'Copyright 2026 an invented foundry',
        licence: 'Licensed under an invented licence for tests alone',
        licenceUrl: 'https://example.invalid/licence',
      },
      embedding: 'installable',
      fsType: 0,
      metrics: { unitsPerEm: 1000, ascender: 800, descender: -200, lineGap: 90 },
      style: { weight: 400, italic: false, bold: false, regular: true },
      glyphs: 3,
      characters: new Set([0x41, 0x42]),
    })
  })

  // Apple's TrueType reference names TrueType fonts 'true'; fontkit reads them as TrueType.
  test("a TrueType font whose sfnt version is Apple's 'true'", () => {
    expect(readFont(font({ version: tagged('true') }))).toMatchObject({ ok: true })
  })

  // A face's style, read from the bits the specification gives each, for a
  // builder to propose which face a file is; Roboto Medium says regular,
  // which is why a person decides.
  test.each([
    ['italic', 0x01, { italic: true, bold: false, regular: false }],
    ['bold', 0x20, { italic: false, bold: true, regular: false }],
    ['bold italic', 0x21, { italic: true, bold: true, regular: false }],
  ])('the style of a %s face', (_, fsSelection, style) => {
    expect(readFont(font({ os2: os2({ fsSelection, weight: 700 }) }))).toMatchObject({ ok: true, style: { weight: 700, ...style } })
  })

  // Every number a version holds is read where its version puts it.
  test.each([0, 1, 2, 3, 4, 5])('an OS/2 table of version %i, at its own length', (version) => {
    expect(readFont(font({ os2: os2({ version, fsType: 8, weight: 300 }) }))).toMatchObject({ ok: true, embedding: 'editable', style: { weight: 300 } })
  })

  // loca's long format holds byte offsets, its short one halves of them.
  test('outlines indexed in either format of the index to location', () => {
    expect(readFont(font({ locFormat: 1 }))).toMatchObject({ ok: true, glyphs: 3 })
  })

  // A PostScript table of each version the specification defines, version 2.0 with its glyph names.
  test.each([
    ['1.0', post({ version: 0x00010000 })],
    ['2.0, with its names', post({ version: 0x00020000, indices: [0, 258, 259], names: ['A', 'B'] })],
    ['2.5, with its offsets', Uint8Array.from([...post({ version: 0x00025000 }), ...u16(3), 0, 0, 0])],
    ['3.0', post({ version: 0x00030000 })],
  ])('a PostScript table of version %s', (_, table) => {
    expect(readFont(font({ post: table }))).toMatchObject({ ok: true })
  })

  // A font a builder adds may hold composite glyphs, accents built from a base and a mark.
  test('composite glyphs, whose components the font has', () => {
    expect(readFont(font({ glyphs: [square(), square(400), composite([1, 0])] }))).toMatchObject({ ok: true, glyphs: 3 })
  })

  // A component is placed by bytes or words, and scaled, scaled by x and y
  // or transformed by a matrix: fontkit reads each by its flags, and a walk
  // that took one for another would read the next component's flags from
  // the middle of this one's numbers.
  test.each([
    ['by bytes', { bytes: true }],
    ['scaled', { transform: 'scale' }],
    ['scaled by x and y, by bytes', { bytes: true, transform: 'xy' }],
    ['by a two by two matrix', { transform: 'matrix' }],
  ] as const)('composite glyphs whose components are placed %s', (_, placed) => {
    // One component, so that a walk that read its size otherwise would end past it or short of it; and three.
    for (const components of [[1], [1, 0, 1]])
      expect(readFont(font({ glyphs: [square(), square(400), composite(components, placed)] })), `${components.length}`).toMatchObject({ ok: true })
    const whole = composite([1, 0], placed)
    expect(refusalOf(font({ glyphs: [square(), square(400), whole.subarray(0, whole.length - 2)] }))).toMatchObject({
      code: 'malformed',
      message: expect.stringContaining('has a glyph description that runs past its end') as string,
    })
  })

  // A space has no outline; a font of outlines and spaces is a font.
  test('a glyph with no description, as a space has, beside glyphs with outlines', () => {
    expect(readFont(font({ glyphs: [square(), new Uint8Array(0), square(300)] }))).toMatchObject({ ok: true })
  })
})

describe('readFont refuses a font in a format it does not read, saying which', () => {
  // A person who exported the wrong kind of file is told what to export:
  // each format by its own bytes, never by a file's name.
  test.each([
    ['a collection', Uint8Array.from([...u32(tagged('ttcf')), ...u16(1), ...u16(0), ...u32(1), ...u32(16)]), 'collection', 'is a font collection'],
    ['a WOFF', Uint8Array.from([...u32(tagged('wOFF')), ...u32(0x00010000), ...new Array<number>(40).fill(0)]), 'woff', 'is a WOFF web font'],
    ['a WOFF2', Uint8Array.from([...u32(tagged('wOF2')), ...u32(0x00010000), ...new Array<number>(40).fill(0)]), 'woff2', 'is a WOFF2 web font'],
    [
      'an EOT',
      (() => {
        const eot = new Uint8Array(120)
        new DataView(eot.buffer).setUint32(0, eot.length, true)
        eot.set([0x4c, 0x50], 34)
        return eot
      })(),
      'eot',
      'is an Embedded OpenType web font',
    ],
    ['a PFB', Uint8Array.from([0x80, 0x01, 0x10, 0, 0, 0, ...new Array<number>(16).fill(0x25)]), 'type-1', 'is a PostScript Type 1 font'],
    ['a PFA', Uint8Array.from([...'%!PS-AdobeFont-1.0: Probe 001.000\n'].map((character) => character.charCodeAt(0))), 'type-1', 'is a PostScript Type 1 font'],
    ["an sfnt of 'typ1'", font({ version: tagged('typ1') }), 'type-1', 'is a PostScript Type 1 font'],
  ] as const)('%s', (_, bytes, format, said) => {
    expect(refusalOf(bytes)).toEqual({
      ok: false,
      code: 'format',
      format,
      message: expect.stringMatching(new RegExp(`^${said}.*; export the face to use as a TrueType font file \\(\\.ttf\\)$`)) as string,
    })
  })

  // An EOT is known by its magic number in a header that measures the file: the magic alone, at byte 34 of something else, is not one.
  test('a file with an EOT magic number whose header does not measure it is no EOT', () => {
    const almost = new Uint8Array(120)
    almost.set([0x4c, 0x50], 34)
    expect(refusalOf(almost).code).toBe('not-a-font')
  })

  // CFF waits for the e-invoice gate to prove a CFF face in a PDF/A-3b, as
  // 0040 says: until then it is refused however it comes.
  test.each([
    ["an OpenType font of 'OTTO'", font({ version: tagged('OTTO') }), 'is an OpenType font with CFF outlines'],
    ["a 'CFF ' table in a TrueType sfnt", font({ with: [['CFF ', new Uint8Array(8)]] }), 'has CFF outlines'],
    ['a CFF2 table', font({ with: [['CFF2', new Uint8Array(8)]] }), 'has CFF2 outlines'],
  ])('CFF outlines: %s', (_, bytes, said) => {
    expect(refusalOf(bytes)).toEqual({
      ok: false,
      code: 'cff',
      message: `${said}; use the TrueType edition of the font (.ttf), which most foundries ship beside the OpenType CFF one (.otf)`,
    })
  })

  test.each([
    ['a variable font', [['fvar', new Uint8Array(16)]], 'variable', 'is a variable font'],
    ['colour layers', [['COLR', new Uint8Array(14)]], 'colour', 'has colour glyphs (COLR)'],
    ['SVG glyphs', [['SVG ', new Uint8Array(10)]], 'colour', 'has colour glyphs (SVG)'],
    ['colour bitmaps', [['CBDT', new Uint8Array(4)]], 'colour', 'has colour bitmap glyphs (CBDT)'],
    ["Apple's colour bitmaps", [['sbix', new Uint8Array(8)]], 'colour', 'has colour bitmap glyphs (sbix)'],
  ] as const)('%s', (_, tables, code, said) => {
    expect(refusalOf(font({ with: tables }))).toMatchObject({ ok: false, code, message: expect.stringMatching(new RegExp(`^${escaped(said)}; `)) as string })
  })

  // A bitmap font has no outlines for a PDF to embed: neither its tables nor, behind them, one glyph that draws.
  test.each([
    ['no glyph data', font({ without: ['glyf'] }), 'has no TrueType outlines (glyf and loca)'],
    ['no index to location', font({ without: ['loca'] }), 'has no TrueType outlines (glyf and loca)'],
    [
      'bitmaps beside glyphs that draw nothing',
      font({
        glyphs: [NO_CONTOURS, NO_CONTOURS, new Uint8Array(0)],
        with: [
          ['EBDT', new Uint8Array(8)],
          ['EBLC', new Uint8Array(8)],
        ],
      }),
      'has no glyph with an outline',
    ],
  ])('no outlines: %s', (_, bytes, said) => {
    expect(refusalOf(bytes)).toEqual({ ok: false, code: 'no-outlines', message: `${said}; use a font with TrueType outlines` })
  })

  // Bytes that are no font at all, an image's among them, are told to add a
  // TrueType file, never read as one with fields made up from what they hold.
  test.each([
    ['nothing', new Uint8Array(0)],
    ['three bytes', Uint8Array.from([0, 1, 0])],
    ['a PNG', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['text', Uint8Array.from([...'Not a font at all.'].map((character) => character.charCodeAt(0)))],
  ])('not a font: %s', (_, bytes) => {
    expect(refusalOf(bytes)).toEqual({ ok: false, code: 'not-a-font', message: 'is not a font; add the font as a TrueType file (.ttf)' })
  })
})

describe('the embedding an fsType allows', () => {
  // OS/2's fsType, as the specification defines each value and each
  // version's reading of it (OpenType 1.9.1). A font whose licence bits
  // forbid embedding a subset of its outlines is refused, with no override
  // on a host's word (0040); one that allows it is told apart for the
  // approver.
  test.each([
    [4, 0x0000, 'installable'],
    [4, 0x0004, 'preview-print'],
    [4, 0x0008, 'editable'],
    // Reserved bits, which the specification says a reader can ignore.
    [4, 0x00f0, 'installable'],
    [4, 0xfc08, 'editable'],
    // Versions 0 to 2 read several usage bits as the least restrictive.
    [2, 0x000c, 'editable'],
    [1, 0x0006, 'preview-print'],
    [0, 0x000a, 'editable'],
    // Versions 0 and 1 assigned no bit past 3, and the specification says to ignore them there.
    [0, 0x0100, 'installable'],
    [1, 0x0208, 'editable'],
  ] as const)('version %i, fsType %i: %s', (version, fsType, embedding) => {
    expect(embeddingOf(version, fsType)).toBe(embedding)
    expect(readFont(font({ os2: os2({ version, fsType }) }))).toMatchObject({ ok: true, embedding, fsType })
  })

  test.each([
    [4, 0x0002, 'restricted', 'allows Restricted License embedding alone (fsType 0x0002)'],
    [0, 0x0002, 'restricted', 'allows Restricted License embedding alone (fsType 0x0002)'],
    // Restricted is said first, whatever else is set.
    [4, 0x0302, 'restricted', 'allows Restricted License embedding alone (fsType 0x0302)'],
    [2, 0x0100, 'no-subsetting', 'forbids embedding a subset of it (fsType 0x0100)'],
    [4, 0x0108, 'no-subsetting', 'forbids embedding a subset of it (fsType 0x0108)'],
    [2, 0x0200, 'bitmap-only', 'allows its bitmaps alone to be embedded (fsType 0x0200)'],
    [5, 0x0304, 'bitmap-only', 'allows its bitmaps alone to be embedded (fsType 0x0304)'],
    // Bit 0, which early fonts used by mistake, is reserved in every version.
    [4, 0x0001, 'invalid', 'sets bit 0 of its embedding permissions (fsType 0x0001)'],
    [0, 0x0009, 'invalid', 'sets bit 0 of its embedding permissions (fsType 0x0009)'],
    // From version 3 the usage bits are exclusive.
    [3, 0x000c, 'invalid', 'sets more than one usage permission (fsType 0x000c)'],
    [4, 0x0006, 'invalid', 'sets more than one usage permission (fsType 0x0006)'],
    // A version whose bits nothing here knows.
    [6, 0x0000, 'invalid', 'states its embedding permissions in an OS/2 table of version 6'],
  ] as const)('version %i, fsType %i: refused as %s', (version, fsType, embedding, said) => {
    expect(refusalOf(font({ os2: os2({ version, fsType, length: 100 }) }))).toEqual({
      ok: false,
      code: 'embedding',
      embedding,
      message: expect.stringMatching(new RegExp(`^${escaped(said)}`)) as string,
    })
  })

  // A font refused for its licence bits is refused for them, whatever else is wrong with it, so that a person is told what to ask its vendor for.
  test('is judged before the rest of the font', () => {
    expect(refusalOf(font({ os2: os2({ fsType: 0x0002 }), head: head({ magic: 0 }) })).code).toBe('embedding')
  })

  // A refusal for its licence bits that said only what is wrong would leave
  // a person who brought their brand's typeface with nothing to ask for.
  test('every refusal says what to ask for', () => {
    expect(refusalOf(font({ os2: os2({ fsType: 0x0002 }) })).message).toMatch(
      /; ask the font's vendor for a licence and a file that allow embedding a subset in a PDF$/,
    )
  })
})

describe('readFont holds each table to the specification', () => {
  // A field read where a broken font puts nothing would be a metric made
  // up, a line height the PDF never had, or an error from inside fontkit
  // at print; each is refused at the door instead, naming the table.
  test.each([
    ['the character map', 'cmap', 'character map table (cmap)'],
    ['the font header', 'head', 'font header table (head)'],
    ['the horizontal header', 'hhea', 'horizontal header table (hhea)'],
    ['the horizontal metrics', 'hmtx', 'horizontal metrics table (hmtx)'],
    ['the maximum profile', 'maxp', 'maximum profile table (maxp)'],
    ['the naming table', 'name', 'naming table (name)'],
    ['the OS/2 table', 'OS/2', 'OS/2 and Windows metrics table (OS/2)'],
    ['the PostScript table', 'post', 'PostScript table (post)'],
  ])('without %s', (_, tag, called) => {
    expect(refusalOf(font({ without: [tag] }))).toMatchObject({
      code: 'malformed',
      message: expect.stringMatching(new RegExp(`^has no ${escaped(called)}; `)) as string,
    })
  })

  test.each([
    ['a font header of version 2', { head: head({ major: 2 }) }, 'has a font header of a version the specification does not define'],
    ['a font header without its magic number', { head: head({ magic: 0x5f0f3cf4 }) }, 'has a font header without its magic number'],
    ['15 units to the em', { head: head({ unitsPerEm: 15 }) }, 'has 15 units to the em, where the specification allows 16 to 16384'],
    ['16,385 units to the em', { head: head({ unitsPerEm: 16385 }) }, 'has 16385 units to the em'],
    ['an index to location format of 2', { head: head({ locFormat: 2 }) }, 'has an index to location format the specification does not define'],
    ['glyph data in format 1', { head: head({ glyphDataFormat: 1 }) }, 'has glyph data in a format the specification does not define'],
    [
      'a maximum profile of version 0.5, as a CFF font has',
      { maxp: maxp({ version: 0x00005000 }) },
      'has a maximum profile of another version than the 1.0 TrueType outlines need',
    ],
    ['no glyph at all', { maxp: maxp({ glyphs: 0 }) }, 'has no glyph, not even the .notdef glyph 0'],
    ['a horizontal header of version 2', { hhea: hhea({ major: 2 }) }, 'has a horizontal header of a version the specification does not define'],
    ['horizontal metrics in format 1', { hhea: hhea({ metricDataFormat: 1 }) }, 'has horizontal metrics in a format the specification does not define'],
    ['no horizontal metrics', { hhea: hhea({ metrics: 0 }) }, 'counts 0 horizontal metrics for 3 glyphs'],
    ['more horizontal metrics than glyphs', { hhea: hhea({ metrics: 4 }) }, 'counts 4 horizontal metrics for 3 glyphs'],
    ['horizontal metrics cut short at the end of the file', { hmtx: new Uint8Array(10), last: 'hmtx' }, 'has its horizontal metrics table (hmtx) cut off'],
    // fontkit decodes version 1.0's 32 bytes whole, and a maximum profile it cannot decode leaves PDFKit without a glyph count.
    ['a maximum profile cut short at the end of the file', { maxp: maxp().subarray(0, 6), last: 'maxp' }, 'has its maximum profile table (maxp) cut off'],
    ['a PostScript table of version 4', { post: post({ version: 0x00040000 }) }, 'has a PostScript table of a version the specification does not define'],
    [
      'a PostScript name string past the end of its table',
      { post: post({ version: 0x00020000, indices: [0, 0, 258], strings: [40, 0x41] }) },
      'has its PostScript table (post) cut off',
    ],
    // fontkit reads version 2.5's offsets by the table's own count, one a glyph: three counted, one there.
    [
      'a PostScript table of version 2.5 whose offsets run past the end of the file',
      { post: Uint8Array.from([...post({ version: 0x00025000 }), ...u16(3), 0]), last: 'post' },
      'has its PostScript table (post) cut off',
    ],
  ])('%s', (_, parts, said) => {
    expect(refusalOf(font(parts))).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })

  // A last-resort font's glyphs stand for whole ranges of code points; a run printed in one would print placeholders, not the text.
  test('a last-resort font', () => {
    expect(refusalOf(font({ head: head({ flags: 0x4000 }) }))).toMatchObject({
      code: 'character-map',
      message: expect.stringContaining('is a last-resort font') as string,
    })
  })

  // A glyph fontkit would read past the file's end throws inside pdfmake
  // at print, an error and not a refusal; one a character maps past the
  // glyph count prints nothing.
  test.each([
    ['offsets out of order', () => font({ loca: Uint8Array.from([...u16(0), ...u16(17), ...u16(10), ...u16(51)]) }), 'has glyph offsets out of order'],
    [
      'an offset past the end of the file',
      () => font({ loca: Uint8Array.from([...u16(0), ...u16(17), ...u16(34), ...u16(0xfff0)]) }),
      'has its glyph data table (glyf) cut off',
    ],
    [
      'a description shorter than its header',
      () => font({ glyphs: [square(), Uint8Array.from([0, 1, 0, 0]), square()] }),
      'has a glyph description shorter than its header',
    ],
    [
      'a simple glyph whose points run past its description',
      () => font({ glyphs: [square(), square().subarray(0, 30), square()] }),
      'has a glyph description that runs past its end',
    ],
    [
      'a simple glyph whose instructions run past its description',
      () => font({ glyphs: [square(), patched(square(), 12, u16(400)), square()] }),
      'has a glyph description that runs past its end',
    ],
    [
      'a repeated flag that says more points follow than the description holds',
      () => font({ glyphs: [square(), patched(square(), 14, [0x09, 200]), square()] }),
      'has a glyph description that runs past its end',
    ],
    [
      'a composite of a glyph the font does not have',
      () => font({ glyphs: [square(), square(), composite([3])] }),
      'has a composite glyph made of a glyph the font does not have',
    ],
    [
      'a composite whose components run past its description',
      () => font({ glyphs: [square(), square(), composite([1, 0]).subarray(0, 20)] }),
      'has a glyph description that runs past its end',
    ],
    [
      'a character mapped to a glyph the font does not have',
      () => font({ cmap: cmap([[3, 1, format4([{ start: 0x41, end: 0x43, delta: 1 - 0x41 }])]]) }),
      'maps a character to a glyph the font does not have',
    ],
  ])('a glyph: %s', (_, made, said) => {
    expect(refusalOf(made())).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })

  // fontkit reads a glyph's header for its box when it measures the glyph, even an empty one at the very end of the file.
  test("an empty last glyph whose header fontkit would read past the file's end", () => {
    expect(refusalOf(font({ glyphs: [square(), square(), new Uint8Array(0)], last: 'glyf' }))).toMatchObject({
      code: 'malformed',
      message: expect.stringContaining('has its glyph data table (glyf) cut off') as string,
    })
  })

  // fontkit sees a table only where its recorded length is not 0: PDFKit
  // then reads a property of nothing and throws inside pdfmake, an error
  // and not a refusal. The OS/2 table, whose absence PDFKit survives, is
  // refused empty too: its embedding permissions would be read from a table
  // that says it holds no byte.
  const READ = ['cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'OS/2', 'post'] as const
  test.each(READ)('a %s table recorded as empty, which fontkit does not see', (tag) => {
    const bytes = font()
    expect(refusalOf(patched(bytes, tableAt(bytes, tag).record + 12, u32(0)))).toMatchObject({
      code: 'malformed',
      message: expect.stringMatching(new RegExp(`^has an empty .* table \\(${tag}\\); `)) as string,
    })
  })

  // Past that, fontkit reads a table's fields from its offset whatever its
  // length says, and so does this: refusing a length that understates them
  // would refuse a font PDFKit prints. The length is held inside the file
  // all the same.
  test.each(READ.filter((tag) => tag !== 'loca'))('a %s table whose recorded length understates it, read where fontkit reads it', (tag) => {
    const bytes = font()
    expect(readFont(patched(bytes, tableAt(bytes, tag).record + 12, u32(1)))).toMatchObject({ ok: true })
  })

  // fontkit reads the index to location's offsets to the table's recorded
  // end, and a glyph past the last offset it read it draws as nothing, the
  // render succeeding: text the reader called drawable printed blank. A
  // record short of one offset a glyph and one more is refused, even by a
  // byte, which the specification's table never is.
  test.each([
    ['an offset', 2],
    ['a byte', 1],
  ])('an index to location recorded %s short of its offsets', (_, short) => {
    const bytes = font()
    const loca = tableAt(bytes, 'loca')
    expect(refusalOf(patched(bytes, loca.record + 12, u32(loca.length - short)))).toMatchObject({
      code: 'malformed',
      message: expect.stringContaining('has an index to location table (loca) whose recorded length holds fewer offsets than its 3 glyphs need') as string,
    })
  })

  // fontkit measures every glyph by the vertical metrics where it sees a
  // vertical header beside them, and reads the header's count two bytes
  // early, from the field the specification calls metricDataFormat: a
  // metrics table it reads past the file's end throws inside pdfmake. The
  // bytes held are the ones fontkit reads, not the ones the specification
  // counts, which fontkit never reads by.
  test.each([
    ['read where fontkit reads none counted: a side bearing a glyph', vhea({ metricDataFormat: 0, metrics: 3 }), 6, true],
    ['refused where fontkit reads one side bearing past the file', vhea({ metricDataFormat: 0, metrics: 0 }), 4, false],
    ['refused where fontkit counts three metrics, of four bytes each, past the file', vhea({ metricDataFormat: 3, metrics: 0 }), 10, false],
    ['read where only the specification counts metrics past the file', vhea({ metricDataFormat: 0, metrics: 3 }), 8, true],
  ] as const)('vertical metrics %s', (_, header, length, read) => {
    const bytes = font({
      with: [
        ['vhea', header],
        ['vmtx', new Uint8Array(length)],
      ],
      last: 'vmtx',
    })
    if (read) expect(readFont(bytes)).toMatchObject({ ok: true })
    else
      expect(refusalOf(bytes)).toMatchObject({ code: 'malformed', message: expect.stringContaining('has its vertical metrics table (vmtx) cut off') as string })
  })

  // Where fontkit sees no vertical header, it measures by OS/2 and the
  // horizontal header and never reads the metrics: refusing them would
  // refuse a font PDFKit prints. A header it sees is held whole.
  test('vertical metrics without a header fontkit sees, unread, and a header cut short, refused', () => {
    expect(readFont(font({ with: [['vmtx', new Uint8Array(1)]], last: 'vmtx' }))).toMatchObject({ ok: true })
    const empty = font({
      with: [
        ['vhea', vhea()],
        ['vmtx', new Uint8Array(1)],
      ],
      last: 'vmtx',
    })
    expect(readFont(patched(empty, tableAt(empty, 'vhea').record + 12, u32(0)))).toMatchObject({ ok: true })
    expect(
      refusalOf(
        font({
          with: [
            ['vmtx', new Uint8Array(12)],
            ['vhea', vhea().subarray(0, 34)],
          ],
          last: 'vhea',
        }),
      ),
    ).toMatchObject({ code: 'malformed', message: expect.stringContaining('has its vertical header table (vhea) cut off') as string })
  })

  // The directory is where every other read starts.
  test.each([
    ['cut off in its directory', () => font().subarray(0, 40), 'is cut off in its table directory'],
    [
      'a table past the end of the file',
      () => {
        const bytes = font()
        return patched(bytes, tableAt(bytes, 'head').record + 12, u32(0x7fff_ffff))
      },
      'has font header table (head) that runs past the end of the file',
    ],
    [
      'two tables of one tag',
      () =>
        sfnt([
          ['cmap', cmap([[3, 1, format4(AB)]])],
          ['cmap', cmap([[3, 1, format4(AB)]])],
        ]),
      'has two character map tables (cmap)',
    ],
  ])('a directory %s', (_, made, said) => {
    expect(refusalOf(made())).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })
})

describe("readFont holds a font's line to what pdfmake can lay out", () => {
  /** A font of `unitsPerEm` whose horizontal header has this ascender and descender, the line pdfmake lays it out by. */
  const lined = (ascender: number, descender: number, unitsPerEm = 1000): Uint8Array =>
    font({ head: head({ unitsPerEm }), hhea: hhea({ ascender, descender, metrics: 3 }) })

  // pdfmake lays each line out its ascender less its descender tall and
  // sets its baseline the ascender below the line's top. A line of nothing,
  // or of less, printed every line of a report on one spot, and the
  // renderer's page bound, which counts a line by it, let a report far past
  // its page limit print on one page; an ascender at or below the baseline,
  // or a descender above it, draws the glyphs outside their own line. Each
  // is refused at the door, in numbers alone, and the descender on the
  // baseline that two of the machine's icon fonts have is not.
  test.each([
    ['an ascender on the baseline', 0, -1000, 'has an ascender of 0 units, at or below its baseline, where a line must rise above it'],
    ['an ascender below the baseline', -434, -1000, 'has an ascender of -434 units, at or below its baseline'],
    ['a descender above the baseline', 1000, 1, 'has a descender of 1 units, above its baseline, where a line must reach down to it or below'],
    ['an ascender that is its descender', 1854, 1854, 'has a descender of 1854 units, above its baseline'],
  ])('%s', (_, ascender, descender, said) => {
    expect(refusalOf(lined(ascender, descender))).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })

  // The renderer counts a line of text as its size times its face's line
  // when it refuses a report too long for its page limit, so a line of a
  // few units to the em would let thousands of lines past that bound,
  // printed each over the last; the bounds are read in ems, whatever the
  // units, so a font is held alike at 1000 units and at 2048. A line of
  // the bounds is accepted, one unit past either refused, naming its units.
  test.each([1000, 2048])('a line of MIN_FONT_LINE to MAX_FONT_LINE ems, at %i units to the em', (units) => {
    const floor = MIN_FONT_LINE * units
    const ceiling = MAX_FONT_LINE * units
    const descender = -Math.round(units / 4)
    expect(readFont(lined(floor + descender, descender, units))).toMatchObject({
      ok: true,
      metrics: { unitsPerEm: units, ascender: floor + descender, descender },
    })
    expect(readFont(lined(ceiling + descender, descender, units))).toMatchObject({ ok: true })
    expect(readFont(lined(units, 0, units))).toMatchObject({ ok: true })
    const range = `where a line may be ${MIN_FONT_LINE} to ${MAX_FONT_LINE} ems tall`
    expect(refusalOf(lined(floor + descender - 1, descender, units))).toMatchObject({
      code: 'malformed',
      message: expect.stringContaining(`has a line ${floor - 1} units tall, its ascender less its descender, at ${units} units to the em, ${range}`) as string,
    })
    expect(refusalOf(lined(ceiling + descender + 1, descender, units))).toMatchObject({
      code: 'malformed',
      message: expect.stringContaining(`has a line ${ceiling + 1} units tall`) as string,
    })
  })
})

describe('FONT_REFUSAL_CODES', () => {
  // A builder says each code in a person's language. A code no bytes give,
  // or one with no case, would be words nobody sees or a refusal nobody
  // says. Typed over the codes: a code without a case does not compile.
  const CASES: { readonly [C in FontRefusalCode]: () => Uint8Array } = {
    'not-a-font': () => new Uint8Array(4),
    format: () => Uint8Array.from(u32(tagged('ttcf'))),
    cff: () => font({ version: tagged('OTTO') }),
    variable: () => font({ with: [['fvar', new Uint8Array(16)]] }),
    colour: () => font({ with: [['COLR', new Uint8Array(14)]] }),
    'no-outlines': () => font({ without: ['glyf'] }),
    embedding: () => font({ os2: os2({ fsType: 2 }) }),
    'character-map': () => font({ cmap: cmap([[1, 0, format4(AB)]]) }),
    malformed: () => font({ without: ['head'] }),
    'too-large': () => {
      const big = new Uint8Array(MAX_FONT_BYTES + 1)
      big.set(u32(0x00010000))
      return big
    },
  }

  test.each(FONT_REFUSAL_CODES)('%s is given, by the bytes its case makes', (code) => {
    expect(refusalOf(CASES[code]()).code).toBe(code)
  })

  const FORMAT_CASES: { readonly [F in FontFormat]: number[] } = {
    collection: u32(tagged('ttcf')),
    woff: u32(tagged('wOFF')),
    woff2: u32(tagged('wOF2')),
    eot: (() => {
      const eot = new Array<number>(40).fill(0)
      eot.splice(0, 4, 40, 0, 0, 0)
      eot.splice(34, 2, 0x4c, 0x50)
      return eot
    })(),
    'type-1': [0x80, 0x01],
  }
  test.each(FONT_FORMATS)('the format %s is named', (format) => {
    expect(refusalOf(Uint8Array.from(FORMAT_CASES[format]))).toMatchObject({ code: 'format', format })
  })

  const EMBEDDING_CASES: { readonly [E in FontEmbeddingRefusal]: number } = {
    invalid: 0x0001,
    restricted: 0x0002,
    'bitmap-only': 0x0200,
    'no-subsetting': 0x0100,
  }
  test.each(FONT_EMBEDDING_REFUSALS)('the embedding refusal %s is named', (embedding) => {
    expect(refusalOf(font({ os2: os2({ fsType: EMBEDDING_CASES[embedding] }) }))).toMatchObject({ code: 'embedding', embedding })
  })
})

describe('readFont holds a font to its bounds', () => {
  // fontkit looks each point of a glyph up among its contour ends when it
  // subsets the font: one glyph of 32,767 contours and 65,534 points, 66 KB,
  // took PDFKit 1.6 s. A glyph's points times its contours is bounded.
  // 1,048,577 is 17 times 61,681: the bound and one more, which no square
  // glyph of a point more than 1,024 a contour could pin.
  test(`a glyph of ${MAX_FONT_GLYPH_WORK} points times contours is read, and one of one more refused`, () => {
    expect(readFont(font({ glyphs: [square(), crowded(1024, 1024), square()] }))).toMatchObject({ ok: true })
    expect(17 * 61_681).toBe(MAX_FONT_GLYPH_WORK + 1)
    expect(refusalOf(font({ glyphs: [square(), crowded(17, 61_681), square()] }))).toEqual({
      ok: false,
      code: 'too-large',
      message: `has a glyph of 17 contours and 61681 points, past the ${MAX_FONT_GLYPH_WORK} of the two multiplied that a glyph may be; simplify the glyph's outline in a font editor, or use another font`,
    })
  })

  // A subset holds every glyph a printed character reaches, a composite's
  // components among them, and fontkit decodes each one's points: one 'A'
  // made of 36,733 glyphs at the bound above, a font this reader accepted,
  // took PDFKit 162 s to embed (0043). So the points of all of a font's
  // glyphs are bounded together, whichever of them a render prints. The
  // .notdef glyph is empty here, so that the others' points are the sum.
  test(`glyphs of ${MAX_FONT_POINTS} points together are read, and one point more refused`, () => {
    const glyphs = (count: number): Uint8Array[] => [new Uint8Array(0), ...Array.from({ length: count }, () => crowded(1, 65_536))]
    expect(32 * 65_536).toBe(MAX_FONT_POINTS)
    expect(readFont(font({ glyphs: glyphs(32) }))).toMatchObject({ ok: true })
    expect(refusalOf(font({ glyphs: [...glyphs(32), crowded(1, 1)] }))).toEqual({
      ok: false,
      code: 'too-large',
      message: `has glyphs of more than ${MAX_FONT_POINTS} points together, the most a font's glyphs may have; use a font file that holds fewer scripts`,
    })
  })

  // And their points times contours together: sixteen glyphs at the bound
  // a glyph may reach are read, a seventeenth is refused, though the points
  // of all seventeen are far fewer than the bound above.
  test(`glyphs of ${MAX_FONT_OUTLINE_WORK} points times contours together are read, and more refused`, () => {
    const glyphs = (count: number): Uint8Array[] => [new Uint8Array(0), ...Array.from({ length: count }, () => crowded(1024, 1024))]
    expect(16 * MAX_FONT_GLYPH_WORK).toBe(MAX_FONT_OUTLINE_WORK)
    expect(readFont(font({ glyphs: glyphs(16) }))).toMatchObject({ ok: true })
    expect(refusalOf(font({ glyphs: glyphs(17) }))).toEqual({
      ok: false,
      code: 'too-large',
      message: `has glyphs whose points times contours come to more than ${MAX_FONT_OUTLINE_WORK} together, the most a font's glyphs may; use a font file that holds fewer scripts`,
    })
  })

  // A composite's components are decoded into a list when PDFKit subsets
  // the glyph, however many name one glyph: one composite of 3,490,000,
  // what 20 MiB holds, took PDFKit a second and 431 MiB of heap to embed
  // (0043). The components of all a font's composites are bounded together.
  test(`composites of ${MAX_FONT_COMPONENTS} components together are read, and one more refused`, () => {
    const parts = (count: number): number[] => Array.from({ length: count }, () => 1)
    const half = MAX_FONT_COMPONENTS / 2
    expect(
      readFont(font({ locFormat: 1, glyphs: [square(), square(400), composite(parts(half), { bytes: true }), composite(parts(half), { bytes: true })] })),
    ).toMatchObject({ ok: true })
    expect(
      refusalOf(font({ locFormat: 1, glyphs: [square(), square(400), composite(parts(half), { bytes: true }), composite(parts(half + 1), { bytes: true })] })),
    ).toEqual({
      ok: false,
      code: 'too-large',
      message: `has composite glyphs of more than ${MAX_FONT_COMPONENTS} components together, the most a font's glyphs may have; use a font file that holds fewer scripts`,
    })
  })

  // The most bytes a font may have, refused before a byte of the font is
  // read past what it is; a font of exactly that size is read.
  test(`a font of ${MAX_FONT_BYTES} bytes is read, and one a byte longer refused`, () => {
    const base = font()
    const padding = MAX_FONT_BYTES - base.length - 16
    const largest = font({ with: [['zpad', new Uint8Array(padding)]] })
    expect(largest.length).toBe(MAX_FONT_BYTES)
    expect(readFont(largest)).toMatchObject({ ok: true })
    const longer = font({ with: [['zpad', new Uint8Array(padding + 1)]] })
    expect(longer.length).toBe(MAX_FONT_BYTES + 1)
    expect(refusalOf(longer)).toEqual({
      ok: false,
      code: 'too-large',
      message: `is ${longer.length} bytes, where the most a font may have is ${MAX_FONT_BYTES}; use a font file that holds fewer scripts`,
    })
  })
})

describe('no refusal repeats text the font chose', () => {
  // A refusal reaches a log, a person and a test snapshot. A font's names
  // and tags are text a font chose: a name that holds a customer's address,
  // or markup, would travel with the refusal. Every name and every unknown
  // tag here holds a marker; no message of any refusal holds it, nor
  // anything but printable ASCII. A number the reader decoded -- a version,
  // an fsType, a count -- is said in the reader's own digits.
  const MARKER = 'QzMarker'
  const markedName = name(NAMES.map((entry) => (entry.id === 6 ? entry : { ...entry, text: `${entry.text} ${MARKER}` })))
  const fonts: readonly Uint8Array[] = [
    font({ name: markedName, os2: os2({ fsType: 2 }) }),
    font({
      name: markedName,
      with: [
        ['QzMa', new Uint8Array(4)],
        ['fvar', new Uint8Array(4)],
      ],
    }),
    font({ name: markedName, head: head({ magic: 0 }) }),
    font({ name: name([windows(1, MARKER), windows(2, MARKER), windows(6, `${MARKER}/Bad`)]) }),
    font({ name: name([windows(1, MARKER), windows(2, MARKER), windows(6, `${MARKER}${'x'.repeat(60)}`)]) }),
    sfnt([
      ['QzMa', new Uint8Array(4)],
      ['QzMa', new Uint8Array(4)],
    ]),
    (() => {
      const bytes = font({ with: [['QzMa', new Uint8Array(4)]] })
      return patched(bytes, tableAt(bytes, 'QzMa').record + 12, u32(0x7fff_ffff))
    })(),
  ]

  test.each(fonts.map((bytes, index) => [index, bytes] as const))('refusal %i', (_, bytes) => {
    const refusal = refusalOf(bytes)
    expect(refusal.message).not.toContain(MARKER)
    expect(refusal.message).toMatch(/^[ -~]+$/)
  })
})

describe('caught', () => {
  // The reader's own fault -- a TypeError of its code, not of the font --
  // turned into a refusal would hide it from every test that only checks
  // that bytes are refused; it goes through.
  test('turns a refusal thrown inside the reader into its value, and lets any other error through', () => {
    expect(caught(() => refuse('malformed', 'is broken'))).toMatchObject({ ok: false, code: 'malformed' })
    expect(() =>
      caught(() => {
        throw new TypeError('a fault of the reader')
      }),
    ).toThrow(TypeError)
  })
})

describe('readFont never throws', () => {
  // A font a person adds is untrusted bytes. A reader that threw on some of
  // them -- a DataView read past the end, an offset that wraps, a count
  // that allocates before it is checked -- would surface in a builder as an
  // error rather than a refusal it can say, and in a render as one the
  // renderer cannot name. Every prefix of each font is refused, and a
  // sweep of seeded corruptions is read or refused, each read checked
  // again by `characterMap`, the same map.
  const bases: readonly Uint8Array[] = [
    font(),
    font({
      locFormat: 1,
      glyphs: [square(), composite([0, 0]), square(200), new Uint8Array(0)],
      post: post({ version: 0x00020000, indices: [0, 258, 259, 0], names: ['a', 'b'] }),
    }),
    font({
      os2: os2({ version: 1, fsType: 0x000c }),
      cmap: cmap([
        [0, 3, format4([{ start: 0x20, end: 0x22, glyphs: [1, 0, 2] }])],
        [0, 5, format14([{ selector: 0xfe00, defaults: [[0x20, 2]], mappings: [[0x41, 2]] }])],
        [
          3,
          10,
          Uint8Array.from([
            ...u16(12),
            ...u16(0),
            ...u32(40),
            ...u32(0),
            ...u32(2),
            ...u32(0x41),
            ...u32(0x42),
            ...u32(1),
            ...u32(0x1f600),
            ...u32(0x1f600),
            ...u32(2),
          ]),
        ],
      ]),
      with: [
        ['vhea', vhea()],
        ['vmtx', new Uint8Array(12)],
      ],
    }),
  ]

  test('on every prefix of a font', () => {
    for (const base of bases)
      for (let length = 0; length < base.length; length++) expect(readFont(base.subarray(0, length)).ok, `${length} of ${base.length} bytes`).toBe(false)
  })

  test('on a sweep of seeded corruptions, each read or refused', () => {
    const random = seeded(0xf0a7)
    let read = 0
    for (const base of bases) {
      for (let round = 0; round < 3000; round++) {
        const corrupted = Uint8Array.from(base)
        for (let flips = 1 + Math.floor(random() * 4); flips > 0; flips--) corrupted[Math.floor(random() * corrupted.length)] = Math.floor(random() * 256)
        const outcome = readFont(corrupted)
        if (outcome.ok) {
          read += 1
          const map = characterMap(corrupted)
          expect(map.ok && [...map.characters]).toEqual([...outcome.characters])
        } else expect(outcome.message).toMatch(/^[ -~]+$/)
      }
    }
    // A sweep that refused everything would prove nothing of what is read.
    expect(read).toBeGreaterThan(1000)
  })
})
