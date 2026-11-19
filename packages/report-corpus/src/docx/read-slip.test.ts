import { describe, expect, test } from 'vitest'
import { readDocx } from './read.js'
import { handSlipParts, slipWhite } from './testing/hand-slip.js'
import { HAND_SEPARATOR, handDocx, rewritten, SECTION } from './testing/hand.js'

/**
 * The corpus's reader on a file of two sections (0075): the report's, and
 * after it the page of a QR-bill's slip, proved on the file written by
 * hand in `testing/hand-slip.ts`. Each refusal is a file the writer must
 * never produce: a section ended where a reader does not look for one
 * would be a page of the file no check holds.
 */

const DOCUMENT = 'word/document.xml'
const refused = (parts: ReadonlyMap<string, string | Uint8Array>) => (): unknown => readDocx(handDocx(parts))
const written = (from: string, to: string): Map<string, string | Uint8Array> => rewritten(DOCUMENT, from, to, handSlipParts())

describe('readDocx reads the hand-written file of a slip', () => {
  const docx = readDocx(handDocx(handSlipParts()))

  // The report's page is the first section's, and the slip's its own: read as one, the slip's margins would be taken for the report's.
  test("as two sections: the report's page and body, and the slip's page after it", () => {
    expect(docx.page.margins).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
    expect(docx.body).toHaveLength(2)
    expect(docx.body.at(-1)).toMatchObject({ kind: 'paragraph', runs: [], endsSection: true, line: { height: 1, rule: 'exact' } })
    expect(docx.body[0]).not.toHaveProperty('endsSection')
    expect(docx.slip?.page).toEqual({
      width: 595.3,
      height: 841.9,
      orientation: 'portrait',
      margins: { top: 534, right: 0, bottom: 0, left: 0 },
      header: 0,
      footer: 0,
      titlePage: false,
    })
    expect(docx.slip?.blocks.map((block) => block.kind)).toEqual(['paragraph', 'table', 'paragraph'])
  })

  // Each section's own header and footer: the report's print its words, and the slip's are parts of their own.
  test('each section with the header and the footer it names', () => {
    expect([docx.header?.part, docx.footer?.part]).toEqual(['word/header1.xml', 'word/footer1.xml'])
    expect([docx.slip?.header?.part, docx.slip?.footer?.part]).toEqual(['word/header3.xml', 'word/footer2.xml'])
    expect(docx.slip?.header?.blocks).toHaveLength(1)
  })

  // What 0075 added to a paragraph and to the font table: read, or a check built on them would see nothing.
  test("a line's distance from the right, and a family's other name", () => {
    const [, table] = docx.slip!.blocks
    const acceptance = table?.kind === 'table' ? table.rows[0]!.cells[0]!.blocks.at(-1) : undefined
    expect(acceptance).toMatchObject({ kind: 'paragraph', align: 'right', indentRight: 14.15, indent: 0 })
    expect(docx.fonts).toEqual([
      { name: 'Roboto', family: 'swiss', pitch: 'variable' },
      { name: 'Arial', altName: 'Liberation Sans', family: 'swiss', pitch: 'variable' },
    ])
  })
})

describe('readDocx refuses, naming the part', () => {
  const ENDING = `<w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>${SECTION}</w:pPr></w:p>`

  test.each([
    // A section ended inside the slip's own cell: a page break nobody placed, inside the slip.
    [
      'a section ended inside a cell',
      written(
        `${slipWhite(435)}`,
        `<w:p><w:pPr><w:spacing w:line="435" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>${SECTION}</w:pPr></w:p>`,
      ),
      /a section ended inside a cell, or more than one before the last/,
    ],
    // Three sections: the middle one's page is neither the report's nor the slip's.
    ['two sections ended before the last', written(ENDING, `${ENDING}${ENDING}`), /a section ended inside a cell, or more than one before the last/],
    [
      'a second section with a header of its first page’s own',
      written('<w:sectPr><w:headerReference w:type="default" r:id="rId6"/>', '<w:sectPr><w:headerReference w:type="first" r:id="rId6"/>'),
      /a second section with a header or a footer of its first page's own/,
    ],
  ])('%s', (_name, parts, message) => {
    expect(refused(parts)).toThrow(message)
  })

  // A header's part is one story: a section ended in it is no section of the document.
  test('a header that ends a section', () => {
    const parts = handSlipParts()
    const header = (parts.get('word/header3.xml') as string).replace(
      HAND_SEPARATOR,
      HAND_SEPARATOR.replace('</w:pPr>', '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr>'),
    )
    expect(refused(parts.set('word/header3.xml', header))).toThrow(/word\/header3\.xml: a header that ends a section/)
  })
})
