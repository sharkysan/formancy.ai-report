import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef, type PDFObject } from '@pdfme/pdf-lib'

/**
 * Every number a PDF writes, read as PDF/A's implementation limits read
 * them: ISO 19005-2's 6.1.13, which ISO 19005-3 keeps, holds an integer to
 * 2,147,483,647 in magnitude and a real to 3.403 × 10^38, wherever it is
 * written. veraPDF 1.30.3 holds the integers of dictionaries, of arrays and
 * of the content streams it draws -- a page's, and a form's it reaches by
 * `Do` (its rule 6.1.13-1) -- but not of a soft mask's group, a clip's: a
 * cm of 10^12 inside a clip's group passed it on 18 October 2026, where an
 * arc's control points of 5 × 10^17 in a page's stream and in a group's
 * failed. So this reads every one, for a test to hold a PDF to what
 * veraPDF does not see.
 *
 * Read by @pdfme/pdf-lib 6.2.4, the reader `objects.ts` is: every indirect
 * object as pdf-lib parses it, a stream's dictionary among them, and every
 * content stream -- each page's /Contents, each form XObject's, each
 * tiling pattern's -- inflated through its /Filter and read token by token.
 * pdf-lib keeps a parsed number's value and not its token, so outside a
 * stream a number is read from the form pdf-lib writes it in, whole numbers
 * with no point: as pdfkit writes them too (pdfkit.js 173-178), so that a
 * PDF pdfkit wrote is read as written, and a real written `5.0`, which
 * pdfkit never writes, would be read as the integer it equals -- the
 * stricter reading. Inside a content stream every token is read as it is
 * written. No other stream is read: a font, an image, an ICC profile or an
 * embedded invoice is bytes, not numbers PDF/A counts.
 */

/** A number token: its value, and whether it is written as an integer. */
export interface PdfNumberToken {
  readonly value: number
  readonly integer: boolean
}

/** A number the PDF writes, and where: `12 0 obj` for one in the object's dictionary or array, `12 0 obj's stream` for one in its content stream. */
export interface PdfNumber extends PdfNumberToken {
  readonly where: string
}

const WHITESPACE = /[\0\t\n\f\r ]/
const DELIMITER = /[()<>[\]{}/%]/
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

/**
 * The number tokens of `text`, PDF syntax: what stands in a string, a
 * name or a comment is no number, and an object number and a generation
 * before `R` are a reference, which PDF/A does not count as integers. An
 * inline image is refused: its data is bytes, which this does not read;
 * and so is a string that does not end, which would hide what follows.
 */
export function numbersIn(text: string): PdfNumberToken[] {
  const numbers: PdfNumberToken[] = []
  /** How many of the numbers just read are integers with nothing after them yet: the object number and generation an `R` may follow. */
  let pending = 0
  let i = 0
  while (i < text.length) {
    const character = text[i] as string
    if (WHITESPACE.test(character)) {
      i += 1
      continue
    }
    if (character === '%') {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1
      continue
    }
    if (character === '(') {
      i = afterLiteral(text, i)
      pending = 0
      continue
    }
    if (character === '<' && text[i + 1] !== '<') {
      const end = text.indexOf('>', i)
      if (end === -1) throw new Error('a hex string does not end')
      i = end + 1
      pending = 0
      continue
    }
    if (character === '/') {
      i += 1
      while (i < text.length && !WHITESPACE.test(text[i] as string) && !DELIMITER.test(text[i] as string)) i += 1
      pending = 0
      continue
    }
    if (DELIMITER.test(character)) {
      i += character === '<' || (character === '>' && text[i + 1] === '>') ? 2 : 1
      pending = 0
      continue
    }
    let end = i
    while (end < text.length && !WHITESPACE.test(text[end] as string) && !DELIMITER.test(text[end] as string)) end += 1
    const token = text.slice(i, end)
    i = end
    if (NUMBER.test(token)) {
      const integer = !token.includes('.')
      numbers.push({ value: Number(token), integer })
      pending = integer ? pending + 1 : 0
      continue
    }
    if (token === 'R' && pending >= 2) numbers.splice(numbers.length - 2, 2)
    if (token === 'BI' || token === 'ID') throw new Error('a content stream holds an inline image, whose data this reader does not read')
    pending = 0
  }
  return numbers
}

/** Where the literal string that opens at `start` ends: its parentheses balanced, a backslash escaping what follows it; refused where it does not end. */
function afterLiteral(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i += 1) {
    const character = text[i]
    if (character === '\\') i += 1
    else if (character === '(') depth += 1
    else if (character === ')' && --depth === 0) return i + 1
  }
  throw new Error('a literal string does not end')
}

/** Every number `bytes`, a PDF, writes: in every object, and in every content stream, inflated. */
export async function readPdfNumbers(bytes: Uint8Array): Promise<PdfNumber[]> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true })
  const { context } = document
  const pageContents = new Set<PDFObject>()
  for (const page of document.getPages()) {
    const contents = page.node.get(PDFName.of('Contents'))
    for (const ref of contents instanceof PDFArray ? contents.asArray() : [contents])
      if (ref instanceof PDFRef) pageContents.add(context.lookup(ref) as PDFObject)
  }
  const read: PdfNumber[] = []
  const add = (text: string, where: string): void => {
    for (const number of numbersIn(text)) read.push({ ...number, where })
  }
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    const where = `${ref.objectNumber} ${ref.generationNumber} obj`
    if (!(object instanceof PDFRawStream)) {
      add(object.toString(), where)
      continue
    }
    add(object.dict.toString(), where)
    const content =
      pageContents.has(object) ||
      object.dict.get(PDFName.of('Subtype')) === PDFName.of('Form') ||
      object.dict.get(PDFName.of('PatternType'))?.toString() === '1'
    if (content) add(latin1(decodePDFRawStream(object).decode()), `${where}'s stream`)
  }
  return read
}

/** Bytes one character each, as PDF syntax reads them. */
function latin1(bytes: Uint8Array): string {
  let text = ''
  for (let start = 0; start < bytes.length; start += 0x2000) text += String.fromCharCode(...bytes.subarray(start, start + 0x2000))
  return text
}
