import { eInvoiceCopyParagraph, PREVIEW_LABEL } from '@formancy/report-runtime'
import type { Block, Paragraph } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { verifyDocx, wordRefusal } from './check-docx.js'
import type { ResolvedDocument } from './document.js'
import { readDocx } from './docx/read.js'
import { HAND_SLIP_DOCUMENT, handSlipParts } from './docx/testing/hand-slip.js'
import { DECLARATION, HAND_DOCUMENT, HAND_SEPARATOR, handDocx, handParts, mark, relationships, rewritten, text, TYPE, W } from './docx/testing/hand.js'
import { expectation, type Fixture } from './fixture.js'

/**
 * What `verifyDocx` holds a copy of an e-invoice to (0077), proved on
 * files written by hand (`docx/testing/hand.ts`, `hand-slip.ts`), never
 * on one the writer wrote: each file passes as it stands, and with the
 * label taken out of a header, printed otherwise, or set elsewhere on a
 * slip's page the check says so. A check that never failed on a defect
 * has not been shown to see it.
 */

type Parts = Map<string, string | Uint8Array>

const LABEL = eInvoiceCopyParagraph('facturX', 'de-DE') as Paragraph
const WORDS = (LABEL.runs[0] as { readonly text: string }).text
const FONT = '<w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/>'

/** The label's paragraph as a file states it: the words alone, 8 pt, bold, in the label's red; `more` its paragraph's own properties. */
const labelled = (more = '', look = '<w:b/><w:color w:val="B00020"/>', size = 8): string =>
  `<w:p><w:pPr>${more}${mark(size)}</w:pPr><w:r><w:rPr>${FONT}${look}<w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr>${text(WORDS)}</w:r></w:p>`

const fixtureOf = (document: ResolvedDocument): Fixture => ({
  id: 'hand-copy',
  title: 'A copy of an e-invoice, written by hand',
  document,
  maxPages: 2,
  expect: expectation(document, { maxPagesExpected: 2 }),
})

const copyOf = (document: ResolvedDocument): ResolvedDocument => ({ ...document, pageHeader: [{ ...LABEL }, ...document.pageHeader] })
const COPY = fixtureOf(copyOf(HAND_DOCUMENT))
const SLIP_COPY = fixtureOf(copyOf(HAND_SLIP_DOCUMENT))

const HEADER = 'word/header1.xml'
const OPENS = `<w:hdr ${W}>`

/** The hand-written file as a copy's: its page header opens with the label. */
const copyParts = (label = labelled(), parts: Parts = handParts()): Parts => rewritten(HEADER, OPENS, `${OPENS}${label}`, parts)

const INSET = '<w:ind w:left="283" w:right="283"/>'
const SLIP_SECTION = 'w:header="0" w:footer="0"'

/** The hand-written file of a slip as a copy's: the label opens the page header and is the slip's page's header, 5 mm in and 5 mm down. */
const slipCopyParts = (own = labelled(INSET), down = 'w:header="283" w:footer="0"'): Parts => {
  const parts = rewritten('word/document.xml', SLIP_SECTION, down, copyParts(labelled(), handSlipParts()))
  return parts.set('word/header3.xml', `${DECLARATION}<w:hdr ${W}>${own}</w:hdr>`)
}

const problems = async (parts: ReadonlyMap<string, string | Uint8Array>, fixture: Fixture): Promise<string> =>
  (await verifyDocx(fixture, readDocx(handDocx(parts)))).join('\n')

// The files as they were typed are their documents, whole: without this, every case below could fail for a reason of its own.
test('the hand-written copies are their documents, with nothing to say against them', async () => {
  expect(await problems(copyParts(), COPY)).toBe('')
  expect(await problems(slipCopyParts(), SLIP_COPY)).toBe('')
})

describe('verifyDocx fails on a copy whose page header', () => {
  // Each a way a writer loses the one thing that tells a reader the page is no invoice, with every other word in its place.
  test.each<[string, () => Parts, RegExp]>([
    ['does not hold the label', () => handParts(), /the page header does not open with the label of a copy/],
    ['holds the label under another paragraph', () => rewritten(HEADER, '<w:p><w:pPr><w:spacing', `${labelled()}<w:p><w:pPr><w:spacing`), /does not open with/],
    [
      'holds the label among other words',
      () =>
        copyParts(
          labelled().replace('</w:r></w:p>', `</w:r><w:r><w:rPr>${FONT}<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>${text(' (Entwurf)')}</w:r></w:p>`),
        ),
      /does not open with the label of a copy, alone in its paragraph/,
    ],
    ['prints the label light', () => copyParts(labelled('', '<w:color w:val="B00020"/>')), /otherwise than at 8 pt, bold and in #b00020/],
    ['prints the label in black', () => copyParts(labelled('', '<w:b/><w:color w:val="000000"/>')), /otherwise than at 8 pt, bold and in #b00020/],
    ['prints the label in white', () => copyParts(labelled('', '<w:b/><w:color w:val="FFFFFF"/>')), /otherwise than at 8 pt, bold and in #b00020/],
    ['prints the label at one point', () => copyParts(labelled('', '<w:b/><w:color w:val="B00020"/>', 1)), /otherwise than at 8 pt, bold and in #b00020/],
    ['prints the label slanted', () => copyParts(labelled('', '<w:b/><w:i/><w:color w:val="B00020"/>')), /otherwise than at 8 pt, bold and in #b00020/],
  ])('%s', async (_name, parts, said) => {
    expect(await problems(parts(), COPY)).toMatch(said)
  })

  // Word prints page 1's own header in the page header's place where the section says page 1 has one: a file that says so and names
  // none prints page 1 of the copy with no header, and no label.
  test('says page 1 has a header of its own and names none', async () => {
    const parts = rewritten('word/document.xml', '</w:sectPr>', '<w:titlePg/></w:sectPr>', copyParts())
    expect(await problems(parts, COPY)).toMatch(/page 1's own header is missing, where every page of a copy says that it is one/)
  })

  // The check is of a copy alone: the same file is whole for the document that is none, and a label is asked of no other report.
  test('and says nothing of a label where the document is no copy', async () => {
    expect(await problems(handParts(), fixtureOf(HAND_DOCUMENT))).toBe('')
  })
})

describe('verifyDocx fails on a copy whose page 1 has a header of its own that', () => {
  const first = copyOf({ ...HAND_DOCUMENT, firstPageHeader: [{ kind: 'paragraph', runs: [{ text: 'Page one' }], style: { size: 8 } }] })
  const FIRST = fixtureOf({ ...first, firstPageHeader: [{ ...LABEL }, ...(first.firstPageHeader ?? [])] })
  const own = `<w:p><w:pPr>${mark(8)}</w:pPr><w:r><w:rPr>${FONT}<w:color w:val="000000"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>${text('Page one')}</w:r></w:p>`
  const gap = '<w:p><w:pPr><w:spacing w:line="120" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>'
  /** The copy's file with a header of page 1's own, `held`, and the page footer for page 1 too. */
  const firstParts = (held: string): Parts => {
    let parts = copyParts()
    parts = rewritten(
      'word/document.xml',
      '<w:footerReference w:type="default" r:id="rId5"/>',
      '<w:headerReference w:type="first" r:id="rId7"/><w:footerReference w:type="default" r:id="rId5"/><w:footerReference w:type="first" r:id="rId5"/>',
      parts,
    )
    parts = rewritten('word/document.xml', '</w:sectPr>', '<w:titlePg/></w:sectPr>', parts)
    parts = rewritten(
      '[Content_Types].xml',
      '<Override PartName="/word/footer1.xml"',
      '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml"',
      parts,
    )
    parts.set(
      'word/_rels/document.xml.rels',
      relationships(
        [`${TYPE}/styles`, 'styles.xml'],
        [`${TYPE}/settings`, 'settings.xml'],
        [`${TYPE}/fontTable`, 'fontTable.xml'],
        [`${TYPE}/header`, 'header1.xml'],
        [`${TYPE}/footer`, 'footer1.xml'],
        [`${TYPE}/image`, 'media/image1.png'],
        [`${TYPE}/header`, 'header2.xml'],
      ),
    )
    return parts.set('word/header2.xml', `${DECLARATION}<w:hdr ${W}>${held}${gap}</w:hdr>`)
  }

  // Page 1 prints its own header in the page header's place: a label on every page but the first is no label on the page a reader sees first.
  test('is labelled passes, and one that is not is said', async () => {
    expect(await problems(firstParts(`${labelled()}${own}`), FIRST)).toBe('')
    expect(await problems(firstParts(own), FIRST)).toMatch(/page 1's own header does not open with the label of a copy/)
    expect(await problems(firstParts(`${labelled('', '<w:color w:val="B00020"/>')}${own}`), FIRST)).toMatch(
      /page 1's own header prints the label of a copy otherwise/,
    )
  })
})

describe("verifyDocx fails on a copy whose slip's page", () => {
  // The slip's page is a section of its own, which prints an empty header in the report's place (0075): on a copy that is a page that
  // prints an invoice's slip and says nothing of what it is. So its header is the label, alone, where it cannot push the slip down.
  test.each<[string, () => Parts, RegExp]>([
    ['has an empty header', () => slipCopyParts(HAND_SEPARATOR), /the header of the slip's page does not open with the label of a copy/],
    ['holds more than the label', () => slipCopyParts(`${labelled(INSET)}${HAND_SEPARATOR}`), /holds more than the label of a copy/],
    ['sets the label at the paper’s edge', () => slipCopyParts(labelled()), /sets the label 0 and 0 pt in from the paper's sides/],
    ['sets the label in from one side alone', () => slipCopyParts(labelled('<w:ind w:left="283"/>')), /sets the label 14\.15 and 0 pt in/],
    [
      'prints the label light',
      () => slipCopyParts(labelled(INSET, '<w:color w:val="B00020"/>')),
      /the header of the slip's page prints the label of a copy otherwise/,
    ],
    [
      'has its header at the paper’s edge',
      () => slipCopyParts(labelled(INSET), SLIP_SECTION),
      /one that does not stand 5 mm down, where a copy's label stands/,
    ],
    [
      "prints the report's own header",
      () =>
        rewritten(
          'word/document.xml',
          '<w:headerReference w:type="default" r:id="rId6"/>',
          '<w:headerReference w:type="default" r:id="rId4"/>',
          slipCopyParts(),
        ),
      /holds more than the label of a copy, or is the report's own/,
    ],
  ])('%s', async (_name, parts, said) => {
    // The reader refuses a relationship nothing uses: the case that names the report's header leaves the slip's own unused, and is read without it.
    const made = parts()
    if (_name === "prints the report's own header") {
      made.delete('word/header3.xml')
      made.set('[Content_Types].xml', (made.get('[Content_Types].xml') as string).replace(/<Override PartName="\/word\/header3\.xml"[^>]*\/>/, ''))
      made.set('word/_rels/document.xml.rels', (made.get('word/_rels/document.xml.rels') as string).replace(/<Relationship Id="rId6"[^>]*\/>/, ''))
    }
    expect(await problems(made, SLIP_COPY)).toMatch(said)
  })

  // The other way round: a slip's page of a report that is no copy keeps its empty header at the paper's edge, as 0075 has it.
  test('and a report that is no copy is still held to an empty header at the paper’s edge', async () => {
    const plain = fixtureOf(HAND_SLIP_DOCUMENT)
    expect(await problems(handSlipParts(), plain)).toBe('')
    const moved = rewritten('word/document.xml', SLIP_SECTION, 'w:header="283" w:footer="0"', handSlipParts())
    expect(await problems(moved, plain)).toMatch(/one that stands in from the paper's edge/)
  })
})

describe('wordRefusal, of a document whose headers say it is a copy', () => {
  const other: Block = { kind: 'paragraph', runs: [{ text: 'Rechnung' }] }
  const document = (pageHeader: readonly Block[], firstPageHeader?: readonly Block[]): ResolvedDocument => ({
    ...HAND_DOCUMENT,
    pageHeader,
    ...(firstPageHeader === undefined ? {} : { firstPageHeader }),
  })
  const white: Block = { ...LABEL, style: { ...LABEL.style, color: '#ffffff' } }
  const french = eInvoiceCopyParagraph('facturX', 'fr-FR') as Paragraph

  // A copy as the runtime resolves one owes no refusal: every header opens with the one label, as written.
  test('derives none for a copy labelled on every header as the runtime labels one', () => {
    expect(wordRefusal(document([{ ...LABEL }, other]))).toBeUndefined()
    expect(wordRefusal(document([{ ...LABEL }, other], [{ ...LABEL }]))).toBeUndefined()
    expect(wordRefusal(document([other]))).toBeUndefined()
  })

  // A copy labelled on some pages, or in words nobody can read, is written as a file whose other pages pass for the invoice.
  test('derives one for a label printed otherwise, missing from a header, or another than the page header’s', () => {
    expect(wordRefusal(document([white, other]))).toEqual({ code: 'unsupported', subject: 'pageHeader' })
    expect(wordRefusal(document([other], [{ ...LABEL }]))).toEqual({ code: 'unsupported', subject: 'pageHeader' })
    expect(wordRefusal(document([{ ...LABEL }], [other]))).toEqual({ code: 'unsupported', subject: 'firstPageHeader' })
    expect(wordRefusal(document([{ ...LABEL }], []))).toEqual({ code: 'unsupported', subject: 'firstPageHeader' })
    expect(wordRefusal(document([{ ...LABEL }], [white]))).toEqual({ code: 'unsupported', subject: 'firstPageHeader' })
    expect(wordRefusal(document([{ ...LABEL }], [{ ...french }]))).toEqual({ code: 'unsupported', subject: 'firstPageHeader' })
  })

  // The order is the writer's: the e-invoice itself, then a preview's label, then a copy's.
  test('after the e-invoice and a preview’s label', () => {
    const invoice = { kind: 'facturX' } as NonNullable<ResolvedDocument['eInvoice']>
    expect(wordRefusal({ ...document([white]), eInvoice: invoice })).toEqual({ code: 'unsupported', subject: 'eInvoice' })
    const preview: Block = { ...LABEL, runs: [{ text: PREVIEW_LABEL }] }
    expect(wordRefusal(document([preview], [{ ...LABEL }]))).toEqual({ code: 'unsupported', subject: 'pageHeader' })
  })
})
