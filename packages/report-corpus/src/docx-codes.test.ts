import { expect, test } from 'vitest'
import { readDocxCodes } from './docx-codes.js'
import { readDocx } from './docx/read.js'
import { HAND_EPC, HAND_QR, handCodeParts } from './docx/testing/hand-codes.js'
import { handDocx, handParts, rewritten } from './docx/testing/hand.js'

/**
 * `readDocxCodes`, on the files written by hand (0074): what a test of a
 * Word file's codes asks it -- what each says, how it is drawn and where
 * it stands -- read from a file no writer wrote.
 */

// The body's two codes, in the document's order, each with what ZXing reads in its picture and the grid its pixels are: a reader that lost
// one, or read the frame's as the first, would have every test built on it compare the wrong code.
test('reads each code of a file: what it says, its grid, its resolution and its module at the extent the file states', async () => {
  const [code, framed, ...more] = await readDocxCodes(readDocx(handDocx(handCodeParts())))
  expect(more).toEqual([])
  expect(code).toMatchObject({ region: 'body', version: 2, modules: 25, pixels: 19, side: 627 })
  expect(code!.read).toMatchObject({ text: HAND_QR.text, bytes: new TextEncoder().encode(HAND_QR.text), ecLevel: 'M', version: 2 })
  // 72 points a side: 627 pixels to the inch, and a module a 33rd of the side.
  expect(code!.resolution).toBeCloseTo(627, 6)
  expect(code!.module).toBeCloseTo(72 / 33, 6)
  expect(code!.picture.width).toBeCloseTo(72, 6)
  expect(framed).toMatchObject({ region: 'body', version: 8, modules: 49, pixels: 12, side: 684 })
  expect(framed!.read).toMatchObject({ text: HAND_EPC.payload, ecLevel: 'M', version: 8 })
  expect(framed!.module).toBeCloseTo(78.04 / 57.5, 4)
})

// A picture that is no symbol's -- the hand-written file's two pixels of colour -- is an image of the report's, and no code.
test('leaves out a picture that is no code’s', async () => {
  expect(await readDocxCodes(readDocx(handDocx(handParts())))).toEqual([])
})

// A code in a page region is that region's: read from the header's part, it is no code of the body.
test('says which region a code stands in', async () => {
  const picture = /<w:p><w:pPr><w:rPr><w:sz w:val="2"\/><w:szCs w:val="2"\/><\/w:rPr><\/w:pPr><w:r>.*?<\/w:drawing><\/w:r><\/w:p>/
  const parts = handCodeParts()
  const document = parts.get('word/document.xml') as string
  const [paragraph] = picture.exec(document) ?? []
  if (paragraph === undefined) throw new Error("the code's paragraph is not found")
  // The code's paragraph moved from the body to the head of the page header, with its relationship and its part named there.
  parts.set('word/document.xml', document.replace(paragraph, ''))
  const header = (parts.get('word/header1.xml') as string)
    .replace(
      '<w:hdr ',
      '<w:hdr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ',
    )
    .replace(/(<w:hdr [^>]*>)/, `$1${paragraph.replace('rId6', 'rId1')}`)
  parts.set('word/header1.xml', header)
  parts.set(
    'word/_rels/header1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',
  )
  const moved = rewritten(
    'word/_rels/document.xml.rels',
    '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/><Relationship Id="rId7"',
    '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/><Relationship Id="rId7x"',
    parts,
  )
  const relationships = (moved.get('word/_rels/document.xml.rels') as string).replace(/<Relationship Id="rId7x"[^>]*\/>/, '')
  moved.set('word/_rels/document.xml.rels', relationships)
  moved.set('word/document.xml', (moved.get('word/document.xml') as string).replace('r:embed="rId7"', 'r:embed="rId6"'))
  const codes = await readDocxCodes(readDocx(handDocx(moved)))
  expect(codes.map((code) => [code.region, code.read?.text])).toEqual([
    ['header', HAND_QR.text],
    ['body', HAND_EPC.payload],
  ])
})
