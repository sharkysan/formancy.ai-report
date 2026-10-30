import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import vfs from 'pdfmake/build/vfs_fonts.js'
import { readPdf } from '@formancy/report-corpus'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { fromBase64 } from './bytes.js'
import { characterMap, codePoint, faceOf, missingGlyph } from './glyphs.js'
import { renderPdf } from './node.js'
import { bareDocument, ledger, paragraph, TIMEOUT } from './testing/documents.js'

/**
 * Characters the embedded faces have no glyph for. pdfmake draws such a
 * character as glyph 0 and writes U+0000 to the text layer, and the render
 * succeeds; the renderer refuses it instead, naming where it is.
 */

const require = createRequire(import.meta.url)
const fonts = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto')
const FILES = { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' } as const
const regular = characterMap(readFileSync(path.join(fonts, FILES.normal)))
const has = (character: string): boolean => regular.has(character.codePointAt(0) as number)

async function refusal(document: ResolvedDocument): Promise<unknown> {
  return renderPdf(document, { maxPages: 5 }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

describe('the character maps', () => {
  // What a Swiss or German report prints, and what Intl writes into a Swiss
  // amount -- the apostrophe de-CH and fr-CH group with, the no-break space
  // before a currency -- all have glyphs. Japanese, Hebrew, an emoji and a
  // tab do not, and nor does the narrow no-break space Intl groups fr-FR
  // amounts with (U+202F): such an amount is refused rather than printed
  // with an empty box between its thousands.
  test('read the characters Roboto draws, and not those it does not', () => {
    const drawn = ["'", ...'äöüßÄÖÜéèçàœÉ€£¥ŁżźćńśąęłŒ’‘“”–—…·', ' ', ' ']
    expect(drawn.filter((character) => !has(character))).toEqual([])
    expect(['山', 'א', '😀', '\t', ' '].filter(has)).toEqual([])
  })

  // The browser entry holds its text to pdfmake's virtual files: the same
  // bytes as the font files, so the same characters, face by face.
  test('are the same from the font files and from the browser build', () => {
    for (const [face, file] of Object.entries(FILES)) {
      const fromFile = characterMap(readFileSync(path.join(fonts, file)))
      expect([...characterMap(fromBase64(vfs[file] as string))], face).toEqual([...fromFile])
      expect(fromFile.has(0x41) && fromFile.has(0xe4), face).toBe(true)
    }
  })

  // A font without a character map, or without a Unicode one in the format
  // this reads, is a font the renderer cannot hold text to.
  test('refuse a font they cannot read', () => {
    expect(() => characterMap(new Uint8Array(12))).toThrow('no character map')
    // A character map with one subtable, Macintosh Roman in format 0: no Unicode map in format 4.
    const font = new Uint8Array(12 + 16 + 4 + 8 + 2)
    const view = new DataView(font.buffer)
    view.setUint16(4, 1)
    font.set([0x63, 0x6d, 0x61, 0x70], 12)
    view.setUint32(12 + 8, 28)
    view.setUint16(28 + 2, 1)
    view.setUint16(28 + 4, 1)
    view.setUint32(28 + 8, 12)
    expect(() => characterMap(font)).toThrow('no Unicode character map in format 4')
  })

  test('name a face, a missing character and a code point', () => {
    expect([faceOf(false, false), faceOf(true, false), faceOf(false, true), faceOf(true, true)]).toEqual(['normal', 'bold', 'italics', 'bolditalics'])
    expect(missingGlyph('Line one\nline two\r\n', regular)).toBeUndefined()
    expect(missingGlyph('Kunde: 山田', regular)).toBe(0x5c71)
    expect(codePoint(0x5c71)).toBe('U+5C71')
    expect(codePoint(0x1f600)).toBe('U+1F600')
  })
})

describe('text without a glyph', () => {
  // pdfmake 0.3.11's own default, pinned: a character Roboto has no glyph
  // for comes back out of the PDF as U+0000, and the PDF is written.
  test(
    'is lost by pdfmake without a word',
    async () => {
      pdfmake.setFonts({ Roboto: { normal: path.join(fonts, FILES.normal).split(path.sep).join('/') } })
      pdfmake.setLocalAccessPolicy(() => true)
      const bytes = await pdfmake.createPdf({ content: ['Kunde: 山田'], defaultStyle: { font: 'Roboto' } }).getBuffer()
      const pdf = await readPdf(new Uint8Array(bytes))
      expect(pdf.pages[0]?.items.map((item) => item.text).join('')).toContain('\u0000')
    },
    TIMEOUT,
  )

  // Each place text prints, refused naming the block or the table and the
  // character, whatever the face.
  test.each([
    ['in a paragraph', [paragraph('Customer: 山田太郎 様')], 'body[0]', 'U+5C71'],
    ['in a bold run', [{ kind: 'paragraph', runs: [{ text: 'Fine ' }, { text: 'שלום', bold: true }] }], 'body[0]', 'U+05E9'],
    ['in a table cell', [ledger('names', [{ kind: 'detail', cells: ['K-1', 'Grüsse 😀', '1.00'] }])], 'names', 'U+1F600'],
    ['in a table header', [{ ...ledger('heads', []), header: ['Key', '名前', 'Amount'] }], 'heads', 'U+540D'],
    ['in the empty text', [{ ...ledger('none', []), emptyText: 'Keine\tZeilen' }], 'none', 'U+0009'],
    ['in a section', [{ kind: 'section', padding: 4, blocks: [paragraph('ok'), paragraph('✓ ok')] }], 'body[0].blocks[1]', 'U+2713'],
    ['in a French amount', [paragraph('Total : 1 234,50 €')], 'body[0]', 'U+202F'],
  ] as const)('is refused %s', async (_, body, subject, point) => {
    const outcome = await refusal(bareDocument('Glyphs', body))
    expect(outcome).toMatchObject({ code: 'unsupported', subject, message: expect.stringContaining(point) as string })
  })

  // The page regions are text too, and print on every page.
  test('is refused in a page region', async () => {
    const document = { ...bareDocument('Glyphs', [paragraph('Body')]), pageHeader: [paragraph('Ref. ☎')] }
    expect(await refusal(document)).toMatchObject({ code: 'unsupported', subject: 'pageHeader[0]' })
  })

  // Line breaks print as breaks, and every character of the corpus's
  // languages as itself.
  test(
    'is never what Roboto draws',
    async () => {
      expect(await refusal(bareDocument('Glyphs', [paragraph("Zürich, Genève\nŁódź · CHF 1'234.50 · 1’234,50 €")]))).toBe('rendered')
    },
    TIMEOUT,
  )
})
