import { deflateSync } from 'node:zlib'
import { PDFDocument, PDFName } from '@pdfme/pdf-lib'
import { describe, expect, test } from 'vitest'
import { numbersIn, readPdfNumbers, type PdfNumber } from './numbers.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * Every number a PDF writes, read as PDF/A's implementation limits read
 * them (`numbers.ts`): integers to 2,147,483,647, which veraPDF 1.30.3 holds
 * in a dictionary, an array and the content streams it draws but not in a
 * soft mask's group, where ISO 19005-2 holds them all.
 */

const PAST = 2_147_483_648

describe('numbersIn', () => {
  // A token is an integer when it is written without a point, whatever its
  // value, and a real when it is written with one: veraPDF's 6.1.13-1 is a
  // rule of integers, so a reader that took 5669000000.5 for one would fail
  // a PDF that passes, and one that took 5669000000 for a real would pass
  // one that fails.
  test('reads an integer as one, and a real as one, by how it is written', () => {
    expect(numbersIn('5669000000 -5669000000.5 +12 .5 -.25 3. 0')).toEqual([
      { value: 5669000000, integer: true },
      { value: -5669000000.5, integer: false },
      { value: 12, integer: true },
      { value: 0.5, integer: false },
      { value: -0.25, integer: false },
      { value: 3, integer: false },
      { value: 0, integer: true },
    ])
  })

  // Digits that are no number token are no number: inside a literal
  // string, its escaped parentheses and nested ones included; a hex string;
  // a name; a comment; and an operator. A reader that read them would fail
  // every PDF that prints a long number as text.
  test('reads no digits inside a string, a name, a comment or a keyword', () => {
    expect(numbersIn('(12345 \\) (99999999999) ) <3132333435> /F99999999999 % 77777777777\n7 Tf g1 << /K 8 >> [9]')).toEqual([
      { value: 7, integer: true },
      { value: 8, integer: true },
      { value: 9, integer: true },
    ])
  })

  // An object number and a generation are no integers PDF/A counts: a
  // reference is an object of its own (veraPDF's CosIndirect).
  test('reads a reference as no number', () => {
    expect(numbersIn('<< /A 12 0 R /B 12 /C [3 0 R 4] >>')).toEqual([
      { value: 12, integer: true },
      { value: 4, integer: true },
    ])
  })

  // An inline image's data is bytes, not tokens: refused rather than read
  // as numbers or skipped unread.
  test('refuses an inline image, which it does not read', () => {
    expect(() => numbersIn('q BI /W 1 /H 1 ID 99999999999 EI Q')).toThrow('a content stream holds an inline image, whose data this reader does not read')
  })

  // A string that does not end would swallow every number after it, and a
  // reader that read it to the end would find none past the range there.
  test('refuses a string that does not end', () => {
    expect(() => numbersIn('(open 1 0 0 1 99999999999 0 cm')).toThrow('a literal string does not end')
    expect(() => numbersIn('<3132 99999999999 0 m')).toThrow('a hex string does not end')
  })
})

describe('readPdfNumbers', () => {
  /** A PDF whose page draws a form, a tiling pattern beside it and a shading pattern's dictionary, each holding a number past the range, and an embedded file of digits. */
  async function crafted(): Promise<Uint8Array> {
    const document = await PDFDocument.create({ updateMetadata: false })
    const { context } = document
    const page = document.addPage([200, 200])
    const form = context.register(context.flateStream(`q ${PAST + 1} 0 0 1 0 0 cm 0 0 m Q`, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, PAST + 2, 1.5] }))
    context.register(context.stream(`${PAST + 3} 0 m`, { Type: 'Pattern', PatternType: 1, PaintType: 1, TilingType: 2, BBox: [0, 0, 1, 1], XStep: 1, YStep: 1, Resources: {} }))
    page.node.setXObject(PDFName.of('X1'), form)
    page.node.set(PDFName.of('Contents'), context.register(context.stream(Buffer.from(deflateSync(`/X1 Do -${PAST + 4} 0 m`)), { Filter: 'FlateDecode' })))
    context.register(context.stream(`${PAST + 5}`, { Type: 'EmbeddedFile' }))
    context.register(context.obj({ Type: 'Pattern', PatternType: 2, Matrix: [PAST + 6, 0, 0, 1, 0, 0] }))
    return document.save({ useObjectStreams: false })
  }

  /** The numbers of `read` past the range, by value. */
  const past = (read: readonly PdfNumber[]): number[] =>
    read
      .filter((number) => Math.abs(number.value) >= PAST)
      .map((number) => number.value)
      .sort((a, b) => a - b)

  // A form's /BBox in its dictionary, a cm in the form's stream inflated, a
  // move in a tiling pattern's stream and in the page's own, inflated
  // through its /Filter, and a shading pattern's /Matrix, an object with no
  // stream, as pdfkit writes a gradient's: each is read. The embedded file's digits are not
  // a content stream, and are not read: a reader that read every stream as
  // one would fail a PDF/A for its invoice's amounts.
  test("reads every object's numbers and every content stream's, and no other stream's", async () => {
    const read = await readPdfNumbers(await crafted())
    expect(past(read)).toEqual([-(PAST + 4), PAST + 1, PAST + 2, PAST + 3, PAST + 6])
    expect(read.filter((number) => Math.abs(number.value) >= PAST).every((number) => number.integer)).toBe(true)
    expect(read.find((number) => number.value === PAST + 2)?.where).toMatch(/^\d+ 0 obj$/)
    expect(read.find((number) => number.value === PAST + 1)?.where).toMatch(/^\d+ 0 obj's stream$/)
  })

  // What pdfkit writes reads as pdfkit wrote it: a page of text drawn by
  // pdfmake holds its positions as reals and its sizes as integers, and no
  // number past the range.
  test('reads a PDF pdfmake drew', async () => {
    const read = await readPdfNumbers(await pdfmakePdf({ content: [{ text: 'plain', fontSize: 12 }] }))
    expect(read.some((number) => !number.integer)).toBe(true)
    expect(read.some((number) => number.integer && number.value === 12)).toBe(true)
    expect(past(read)).toEqual([])
  })
})
