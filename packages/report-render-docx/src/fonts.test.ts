import { ALL_FIXTURES, type DocxParagraph } from '@formancy/report-corpus'
import { readFont, refusedCharacter } from '@formancy/report-runtime'
import type { Block, FontAsset, ResolvedFonts } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { documentOf, paragraph, refusalOf, written } from './testing/support.js'

/**
 * The families a Word file names (0068), on the file. A token the report
 * maps is named by what its normal face's name table states, read from
 * the corpus's host fonts, Liberation Serif and Mono 2.1.5; `sans`
 * unmapped is Roboto; and what the PDF refuses of a font -- a token
 * mapped to nothing, a weight or a slant with no face, a character the
 * face lacks, bytes that are no font -- the writer refuses too.
 *
 * Liberation states no typographic family, so a face whose two families
 * differ is made of names alone here: the font reader is replaced for
 * such a face, and for no other. report-spec's own tests hold the reader
 * to a font's bytes (`font-names.test.ts`).
 */

interface FakeNames {
  readonly family: string
  readonly legacyFamily?: string
}

const fakes = vi.hoisted(() => new Map<Uint8Array, unknown>())

vi.mock('@formancy/report-runtime', async (original) => {
  const actual = await original<typeof import('@formancy/report-runtime')>()
  return { ...actual, readFont: (bytes: Uint8Array) => (fakes.get(bytes) as ReturnType<typeof actual.readFont> | undefined) ?? actual.readFont(bytes) }
})

/** A face made of names alone, which draws Basic Latin. */
function fake(id: string, names: FakeNames): FontAsset {
  const bytes = new Uint8Array([fakes.size])
  fakes.set(bytes, {
    ok: true,
    names: { subfamily: 'Regular', postScriptName: id, postScriptNames: [id], ...names },
    characters: new Set(Array.from({ length: 95 }, (_, index) => 0x20 + index)),
  })
  return { id, digest: `sha256:${'0'.repeat(64)}`, bytes }
}

const HOST = ALL_FIXTURES.find((fixture) => fixture.id === 'host-fonts')!.document.fonts as ResolvedFonts
const SERIF = HOST.serif!
const MONO = HOST.mono!

const familyOf = (asset: FontAsset): string => {
  const read = readFont(asset.bytes)
  if (!read.ok) throw new Error(read.message)
  return read.names.family
}

/** The family each run of the body's paragraphs names, and whether it is bold and italic. */
const faces = (fonts: ResolvedFonts | undefined, ...blocks: readonly Block[]): (readonly [string | undefined, boolean, boolean])[] =>
  (written(documentOf(blocks, fonts === undefined ? {} : { fonts })).body as DocxParagraph[]).flatMap((block) =>
    block.runs.map((run) => [run.props.family, run.props.bold, run.props.italic] as const),
  )

describe('a font token the report maps', () => {
  // The family is read from the face, never typed: a file that named another would be drawn in another face wherever the host's is installed.
  test("is named by the family its normal face's name table states", () => {
    expect([familyOf(SERIF.normal), familyOf(MONO.normal)]).toEqual(['Liberation Serif', 'Liberation Mono'])
    expect(faces(HOST, paragraph('serif', { font: 'serif' }), paragraph('mono', { font: 'mono', bold: true }), paragraph('sans'))).toEqual([
      ['Liberation Serif', false, false],
      ['Liberation Mono', true, false],
      ['Roboto', false, false],
    ])
  })

  // Weight and slant are Word's own properties on the one family: the four faces of a token are one name in the file.
  test('prints its bold, italic and bold italic as the family with weight and slant', () => {
    const styles = [{ bold: true }, { italic: true }, { bold: true, italic: true }]
    expect(faces(HOST, ...styles.map((style) => paragraph('x', { font: 'serif', ...style })))).toEqual([
      ['Liberation Serif', true, false],
      ['Liberation Serif', false, true],
      ['Liberation Serif', true, true],
    ])
  })

  // A reader without the face chooses another by the kind the font table states: a mono face listed as swiss would be replaced by a proportional one.
  test('is listed in the font table by its kind, a mono face of fixed pitch', () => {
    expect(written(documentOf([paragraph('x')], { fonts: HOST })).fonts).toEqual([
      { name: 'Roboto', family: 'swiss', pitch: 'variable' },
      { name: 'Liberation Serif', family: 'roman', pitch: 'variable' },
      { name: 'Liberation Mono', family: 'modern', pitch: 'fixed' },
    ])
  })

  // Text with no token prints in the mapped sans where there is one, as the PDF prints it: Roboto would be a face the report never chose.
  test('as sans is the family of text that names no token, and the default of the file', () => {
    const docx = written(documentOf([paragraph('plain'), paragraph('sans', { font: 'sans' })], { fonts: { sans: SERIF } }))
    expect((docx.body as DocxParagraph[]).map((block) => block.runs[0]!.props.family)).toEqual(['Liberation Serif', 'Liberation Serif'])
    expect(docx.defaults.run.family).toBe('Liberation Serif')
    expect(docx.fonts).toEqual([{ name: 'Liberation Serif', family: 'swiss', pitch: 'variable' }])
  })
})

describe('what the PDF refuses of a font is refused', () => {
  // Printing a serif paragraph in Roboto is a substitution nobody sees until the file is read.
  test.each(['serif', 'mono'] as const)('a %s token the report maps to nothing, naming the block', (font) => {
    expect(refusalOf(documentOf([paragraph('x', { font })]))).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    const table: Block = {
      kind: 'table',
      id: 'lines',
      columns: [{ width: 'fill', align: 'left' }],
      header: ['Key'],
      headerStyle: { font },
      rows: [],
      emptyText: '',
    }
    expect(refusalOf(documentOf([table]))).toMatchObject({ code: 'unsupported', subject: 'lines' })
  })

  // Word would draw a bold or a slant of its own making where the family has no such face: the faux face the PDF never prints.
  test('a weight or a slant the token maps no face for, naming the block', () => {
    // The corpus maps mono to a regular and a bold face alone.
    const refusal = refusalOf(documentOf([paragraph('x', { font: 'mono', italic: true })], { fonts: HOST }))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect(refusal.message).toMatch(/prints italic text in the mono font, which maps no italic face; Word would synthesise one/)
    const run: Block = { kind: 'paragraph', runs: [{ text: 'x', bold: true }], style: { font: 'mono', italic: true } }
    expect(refusalOf(documentOf([run], { fonts: HOST })).message).toMatch(/maps no boldItalic face/)
  })

  // The first character a report prints that Liberation Mono has no glyph for: Word would draw it in a face of its choosing.
  const lacking = (() => {
    const read = readFont(MONO.normal.bytes)
    if (!read.ok) throw new Error(read.message)
    for (let point = 0xa0; point < 0x3000; point++) if (refusedCharacter(point) === undefined && !read.characters.has(point)) return point
    throw new Error('Liberation Mono draws every character a report prints')
  })()

  test('a character the mapped face has no glyph for, naming the block and the code point', () => {
    const text = `a${String.fromCodePoint(lacking)}b`
    const refusal = refusalOf(documentOf([paragraph(text, { font: 'mono' })], { fonts: HOST }))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect(refusal.message).toContain(`U+${lacking.toString(16).toUpperCase().padStart(4, '0')}`)
    expect(refusal.message).toMatch(/the mono font's regular face, the asset mono, has no glyph for/)
  })

  // Roboto's bytes are not in the package: what it lacks is written, and is Word's to draw. Said, so that nobody reads the refusal above as holding for every face.
  test('but not of Roboto, whose characters the writer does not know', () => {
    expect(faces(undefined, paragraph(`a${String.fromCodePoint(lacking)}b`))).toEqual([['Roboto', false, false]])
  })

  // A page number prints its digits in the footer's face: one that lacks them is refused where the field stands.
  test('a page field in a face that has no digits, naming the paragraph', () => {
    const letters = fake('letters', { family: 'Letters' })
    ;(fakes.get(letters.bytes) as { characters: Set<number> }).characters = new Set([0x20, 0x41])
    const footer: Block = { kind: 'paragraph', runs: [{ field: 'pageNumber' }], style: { font: 'serif' } }
    expect(refusalOf(documentOf([], { pageFooter: [footer], fonts: { serif: { normal: letters } } }))).toMatchObject({
      code: 'unsupported',
      subject: 'pageFooter[0]',
    })
  })

  test('bytes that are no font, naming the asset', () => {
    const broken: FontAsset = { id: 'broken', digest: SERIF.normal.digest, bytes: new Uint8Array([1, 2, 3, 4]) }
    expect(refusalOf(documentOf([paragraph('x')], { fonts: { serif: { normal: broken } } }))).toMatchObject({ code: 'invalid-asset', subject: 'broken' })
  })
})

describe('a face whose family Word lists under another name', () => {
  // To Word, "Probe Sans Light" is a family of its own and "Probe Sans" another: a file that named the typographic family would be drawn in its regular face.
  test('is named by the family of name ID 1, in every run and in the font table', () => {
    const light = fake('light', { family: 'Probe Sans', legacyFamily: 'Probe Sans Light' })
    const fonts: ResolvedFonts = { serif: { normal: light } }
    expect(faces(fonts, paragraph('x', { font: 'serif' }))).toEqual([['Probe Sans Light', false, false]])
    expect(written(documentOf([paragraph('x')], { fonts })).fonts[1]).toEqual({ name: 'Probe Sans Light', family: 'roman', pitch: 'variable' })
  })

  // A file names one family for a token: faces of two families under one name would print the second in the first's bold, by Word's rule.
  test('with a bold face of another family is refused, naming the face', () => {
    const fonts: ResolvedFonts = { serif: { normal: fake('one', { family: 'Probe Serif' }), bold: fake('other', { family: 'Another Serif' }) } }
    const refusal = refusalOf(documentOf([paragraph('x', { font: 'serif' })], { fonts }))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'other' })
    expect(refusal.message).toMatch(/the serif font's bold face, the asset other, is of another family than its regular face/)
  })

  // The faces of one typographic family are one font, whatever name ID 1 calls each: a semibold cut mapped as bold is named by the regular's family, with `w:b`.
  test("with a bold face of the same typographic family is written, in the normal face's name", () => {
    const fonts: ResolvedFonts = {
      serif: { normal: fake('regular', { family: 'Probe Serif' }), bold: fake('semibold', { family: 'Probe Serif', legacyFamily: 'Probe Serif SemiBold' }) },
    }
    expect(faces(fonts, paragraph('x', { font: 'serif', bold: true }))).toEqual([['Probe Serif', true, false]])
  })

  // A family's name is a string from a font's bytes, written into an attribute: escaped there, it names the family and nothing else.
  test('with markup in its name is named by that very name', () => {
    const name = `A&B "C" <D>'s`
    const fonts: ResolvedFonts = { serif: { normal: fake('marked', { family: name }) } }
    const docx = written(documentOf([paragraph('x', { font: 'serif' })], { fonts }))
    expect((docx.body[0] as DocxParagraph).runs[0]!.props.family).toBe(name)
    expect(docx.fonts.map((font) => font.name)).toEqual(['Roboto', name])
  })

  // An attribute's line feed is a space to any reader, and a control character is no name: neither is a family a reader could match.
  test.each([
    ['a line feed', 'Probe\nSerif'],
    ['a tab', 'Probe\tSerif'],
    ['a control character', 'Probe\u0007Serif'],
    ['nothing but spaces', '   '],
    ['half a surrogate pair', 'Probe\ud800'],
  ])('with %s in its name is refused, naming the asset', (_name, family) => {
    const fonts: ResolvedFonts = { serif: { normal: fake('named', { family }) } }
    expect(refusalOf(documentOf([paragraph('x')], { fonts }))).toMatchObject({ code: 'invalid-asset', subject: 'named' })
  })
})
