import { expectation, plainText, type Fixture } from '../fixture.js'
import { documentOf, heading, paragraph } from './build.js'
import { pagesOfText, PRINTABLE_WIDTH } from './geometry.js'
import { uniqueWords } from './words.js'

/**
 * A paragraph of 2500 words over several pages, after an identifier of 300
 * characters with no space in it -- wider than the page at any plausible
 * character width. The engine must break the identifier somewhere rather than
 * run it off the page, and keep every word of the paragraph. The identifier
 * comes first, so it wraps on the first page and the check can find it there
 * whole.
 */
export const IDENTIFIER = `ID-${'X'.repeat(297)}`
export const PARAGRAPH_WORDS = uniqueWords(2500)

const title = heading('Terms and conditions')
const text = PARAGRAPH_WORDS.join(' ')
const document = documentOf('Long paragraph', [title, paragraph(IDENTIFIER), paragraph(text)])
const pages = pagesOfText(text.length + IDENTIFIER.length, PRINTABLE_WIDTH, 2)

export const longParagraph: Fixture = {
  id: 'long-paragraph',
  title: 'A long paragraph and an unbroken identifier: all of it, inside the margins',
  document,
  maxPages: 30,
  expect: expectation(document, {
    keys: PARAGRAPH_WORDS,
    exactText: [plainText(title.runs) ?? ''],
    wrappedText: [IDENTIFIER],
    minPagesExpected: pages.min,
    maxPagesExpected: pages.max,
  }),
}
